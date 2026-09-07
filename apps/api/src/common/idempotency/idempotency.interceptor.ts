import { createHash } from "node:crypto";
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { from, lastValueFrom, type Observable } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequest } from "../types/authenticated-request";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * 예약(처리 중) 행의 수명. 핸들러 실행 중 프로세스가 죽어 응답이 기록되지 못한
 * 예약 행이 이 시간이 지나면 회수되어, 같은 키의 진짜 재시도가 영구히 막히지 않는다.
 *
 * FIX-119A(H-1) 불변식: **클라이언트 쓰기 타임아웃 < PENDING_TTL_MS**.
 * admin 클라이언트는 쓰기 요청을 60초에 끊고(`apps/admin/src/lib/admin-api.ts`의
 * `WRITE_FETCH_TIMEOUT_MS = 60_000`) 운영자에게 재시도를 안내한다. 예약 TTL이
 * 그 60초와 같으면, "정확히 타임아웃이 난 요청"(=핸들러가 60초 넘게 도는 요청)의
 * 재시도가 도착하는 시점에 예약 행이 이미 만료돼 있어 아래 reserve()의 만료 회수
 * 분기가 **아직 살아 있는 요청의 예약을 크래시 잔재로 오인**해 회수하고 핸들러를
 * 다시 실행한다 → 이중 반영. POST /admin/users에서는 재실행이 ADMIN_EMAIL_EXISTS
 * 409로 끝나고 catch 분기가 키를 지워 첫 응답의 tempPassword가 영구 유실된다
 * (계정 삭제 API도 없어 복구 불가).
 *
 * 그래서 예약 TTL을 10분으로 둔다 — 클라이언트가 포기한 뒤에도 서버 핸들러가
 * 실제로 끝날 때까지 예약이 살아 있어, 재시도는 회수 대신 waitForCompletion()
 * 경로로 들어가 완료 응답을 재생하거나 409 "아직 처리 중"으로 안내받는다.
 * 대가는 진짜 크래시 잔재의 회수가 최대 10분 늦어지는 것뿐이고(그 키를 다시
 * 쓰는 재시도만, 그것도 409 대기 응답으로 안내되며 다른 키·다른 요청은 무관),
 * 이중 반영·응답 유실보다 훨씬 가볍다.
 */
const PENDING_TTL_MS = 10 * 60 * 1000;
/**
 * `idempotency_keys.idem_key`의 컬럼 폭(varchar(120), prisma/schema.prisma) 그 자체.
 *
 * ⚠️ 두 시점 — 종전에는 이 상한이 **어디에도** 없었다(그때는 참이었다: 우리 클라이언트가
 * 만드는 키는 uuid(36자) 또는 `onb-child-<base36 시각>-<난수 8자>`(~30자)뿐이라
 * 120자를 넘길 일이 없었다 — apps/admin/src/lib/admin-api.ts의 newIdempotencyKey,
 * apps/mobile/src/stores/onboarding-progress.store.ts의 generateIdempotencyKey,
 * apps/mobile/src/offline/types.ts의 generateOfflineId). 하지만 값은 **요청 헤더**라
 * 우리가 만든 것만 도착하지는 않는다. 121자를 보내면 아래 reserve()의 INSERT가
 * Prisma P2000("값이 컬럼보다 길다")으로 터졌고, 저장소 전체에 P2000을 400으로 옮기는
 * 핸들러가 0건이라 GlobalExceptionFilter를 지나 그대로 **500**이 됐다(실측:
 * `POST /children` + 121자 헤더 → 500). 같은 인터셉터가 지출 생성·수정, 예산, import
 * 확정, 커스텀 카테고리에도 걸려 있어 앱의 **모든 멱등 쓰기 경로**가 같은 모양이었다.
 *
 * 이제 상한을 넘는 키는 400으로 거절한다. **자르지 않는 이유**가 이 상수의 핵심이다:
 * 조용히 `.slice(0, 120)`하면 앞 120자가 같은 서로 다른 두 키가 **같은 키**가 되고,
 * 그 순간 두 번째 요청은 첫 요청의 응답을 그대로 돌려받는다(reserve()의 replay 분기).
 * 즉 "지출을 새로 기록했다"는 응답을 받고도 아무것도 기록되지 않는 조용한 유실 —
 * 500보다 나쁘다. 값을 고칠 수 있는 쪽(요청을 보낸 클라이언트)에게 사유를 돌려주는
 * 400이 옳다.
 */
const IDEMPOTENCY_KEY_MAX_LENGTH = 120;

const RETRY_INTERVAL_MS = 50;
const RETRY_ATTEMPTS = 60; // ~3s of total wait for a concurrent in-flight request to finish

type IdempotencyKeyRow = {
  requestHash: string;
  responseJson: Prisma.JsonValue | null;
  statusCode: number | null;
};

type ReplayableResponse = {
  statusCode?: number;
  status?: (code: number) => unknown;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * R19-F: `idempotency_keys.user_id` is a `uuid` column, so the actor id has to
 * be a uuid to be stored at all. Every real actor already is one — both
 * `users.id` (mobile/JWT) and `admin_users.id` (admin cookie session) are
 * `gen_random_uuid()` columns — so the normal path returns the id untouched.
 *
 * The one exception is the dev/test-only legacy `x-admin-token` guard
 * (AdminTokenGuard), which fabricates the literal actor id `"dev-admin"`. Left
 * as-is that would blow up the INSERT with a uuid parse error and turn an
 * opt-in header into a 500 on the dev/QA scripts that use the shared token.
 * Folding such an id into a deterministic uuid keeps the scoping property that
 * matters (same actor → same uuid, different actors → different uuids) without
 * a schema change, and keeps the key space disjoint from real uuids in
 * practice (a sha256-derived value colliding with a random uuid is the same
 * negligible risk as two random uuids colliding).
 */
function toActorUuid(actorId: string): string {
  if (UUID_PATTERN.test(actorId)) {
    return actorId;
  }
  const hex = createHash("sha256").update(`wooriai:idempotency-actor:${actorId}`).digest("hex");
  // RFC 9562 layout: version nibble 8 (custom) + the 10xx variant bits.
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * 상한을 넘는 `Idempotency-Key`의 거절 본문. 저장소의 기존 400 형식을 그대로 따른다 —
 * `VALIDATION_ERROR` + `details.fields[].constraints`(admin-users-lookup.service.ts의
 * 최소 길이 거절, bootstrap.ts의 DTO 거절과 같은 봉투). `field`에는 본문 필드가 아니라
 * 헤더 이름을 적는다: 실제로 고쳐야 하는 자리가 본문이 아니라 헤더이기 때문이다.
 */
function keyTooLongError() {
  return new BadRequestException({
    code: "VALIDATION_ERROR",
    message: "요청 값을 다시 확인해주세요.",
    details: {
      fields: [
        {
          field: "Idempotency-Key",
          constraints: { maxLength: `Idempotency-Key는 ${IDEMPOTENCY_KEY_MAX_LENGTH}자 이하여야 해요.` }
        }
      ]
    }
  });
}

function conflictError(message: string) {
  return new HttpException({ code: "IDEMPOTENCY_KEY_CONFLICT", message }, HttpStatus.CONFLICT);
}

/**
 * 재생(replay) 응답에 저장된 원본 상태코드를 적용한다.
 *
 * Nest는 인터셉터 체인이 모두 끝난 뒤 reply() 단계에서 라우트의 정적
 * 상태코드(@HttpCode 또는 메서드 기본값 200/201)를 한 번 더 덮어쓰기
 * 때문에, 여기서 단순히 status()만 호출하면 저장된 상태코드가 라우트
 * 기본값과 다른 경우(예: 동적으로 201을 반환했던 원본) 되돌려진다.
 * status()를 잠시 가로채 그 한 번의 늦은 덮어쓰기를 무시하고 곧바로
 * 원래 구현으로 복원한다.
 */
function applyReplayStatus(response: ReplayableResponse, statusCode: number) {
  if (typeof response.status !== "function") {
    return;
  }
  const originalStatus = response.status.bind(response);
  originalStatus(statusCode);
  response.status = () => {
    response.status = originalStatus;
    return response;
  };
}

/**
 * Opt-in per-route interceptor: when the caller sends an `Idempotency-Key`
 * header, this makes the decorated mutation endpoint safe to retry. The same
 * key + same request body replays the first response instead of re-running
 * the handler; the same key with a *different* body 409s
 * (IDEMPOTENCY_KEY_CONFLICT); no header at all is a no-op passthrough.
 *
 * Concurrency: the `idempotency_keys` table's
 * `@@unique([userId, endpoint, idemKey])` constraint is the actual
 * concurrency guard. Two racing requests with the same key both try to
 * INSERT a reservation row before running the handler; only one wins the
 * unique constraint and actually executes the handler, the other short-polls
 * until the winner's response is persisted and replays it. This is what
 * keeps a double-fire of e.g. "create expense" from creating two expenses.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headerValue = request.headers?.["idempotency-key"];
    const idemKey = (Array.isArray(headerValue) ? headerValue[0] : headerValue)?.trim();

    if (!idemKey) {
      return next.handle();
    }

    // 키 검사는 **인증 주체 확인보다 앞**이다: 아래 actorId 분기는 키가 있어도 주체가 없으면
    // 그냥 통과시키므로, 뒤에 두면 같은 121자 헤더가 경로에 따라 400이 되기도 하고 조용히
    // 무시되기도 한다. 길이는 요청만 보면 판정할 수 있으니 여기서 한 번에 끝낸다.
    if (idemKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw keyTooLongError();
    }

    // 인증 주체는 일반 사용자(JWT) 또는 관리자 세션(AdminAuthGuard가 채우는
    // request.adminUser) 둘 다 될 수 있다. admin은 users 테이블에 없는 별개
    // 계정이지만 idempotency_keys.user_id에는 FK가 없어(000002 마이그레이션)
    // admin id를 그대로 스코프 키로 쓸 수 있다.
    const actorId = request.user?.id ?? request.adminUser?.id;
    if (!actorId) {
      return next.handle();
    }
    const userId = toActorUuid(actorId);

    const rawRequest = context
      .switchToHttp()
      .getRequest<{ route?: { path?: string }; originalUrl?: string; url?: string; method?: string }>();
    // endpoint에는 라우트 패턴(:childId)을 쓰되, 해시에는 파라미터가 치환된 실제
    // URL을 포함한다 — 같은 키+같은 body로 다른 리소스(childId 등)에 요청했을 때
    // 첫 응답이 잘못 재생되지 않고 409(다른 요청)로 구분되게 하기 위함이다.
    const routePath = rawRequest.route?.path ?? rawRequest.url ?? "unknown";
    // `endpoint`도 같은 varchar(120) 컬럼이라 여기서 자른다. **키와 달리 자르는 것이 맞다**:
    //  - 실측(현재 등록된 라우트 전수) 최장값은 49자
    //    (`POST:/api/v1/admin/content-revisions/:id/rollback`)라 이 slice는 지금 한 번도 걸리지
    //    않는다. 걸릴 수 있는 건 route.path가 없어 url로 폴백하는 가상의 경우뿐이다.
    //  - 설령 걸려 서로 다른 두 엔드포인트가 같은 문자열로 접혀도 **첫 응답이 잘못 재생되지는
    //    않는다**: 아래 requestHash가 파라미터까지 치환된 실제 경로(actualPath)를 포함하므로
    //    두 요청의 해시가 갈리고, reserve()는 replay가 아니라 409(다른 요청)로 끊는다.
    //    즉 최악이 "잘못된 409"이지 "남의 응답"이 아니다 — 그래서 키(400 거절)와 결론이 갈린다.
    const endpoint = `${rawRequest.method ?? "POST"}:${routePath}`.slice(0, IDEMPOTENCY_KEY_MAX_LENGTH);
    const actualPath = (rawRequest.originalUrl ?? rawRequest.url ?? "").split("?")[0];
    const requestHash = createHash("sha256")
      .update(`${actualPath}\n${JSON.stringify(request.body ?? {})}`)
      .digest("hex");
    const response = context.switchToHttp().getResponse<ReplayableResponse>();

    return from(this.handle(userId, endpoint, idemKey, requestHash, response, next));
  }

  private async handle(
    userId: string,
    endpoint: string,
    idemKey: string,
    requestHash: string,
    response: ReplayableResponse,
    next: CallHandler
  ) {
    const reservation = await this.reserve(userId, endpoint, idemKey, requestHash);

    if (reservation.outcome === "conflict") {
      throw conflictError("이미 다른 요청 본문으로 사용된 Idempotency-Key예요.");
    }

    if (reservation.outcome === "replay") {
      const completed = await this.waitForCompletion(userId, endpoint, idemKey);
      // 원본이 기록한 상태코드로 재생한다(즉시 완료·대기 후 완료 공통 경로).
      applyReplayStatus(response, completed.statusCode ?? HttpStatus.OK);
      return completed.responseJson;
    }

    try {
      const result = await lastValueFrom(next.handle());
      // Nest는 인터셉터 실행 전에 라우트의 확정 상태코드(@HttpCode 또는
      // 메서드 기본값 200/201)를 response에 미리 찍어 두므로, 핸들러 완료
      // 시점의 response.statusCode가 실제로 전송될 상태코드다(핸들러가
      // passthrough로 바꾼 값 포함). 이를 그대로 저장해 재생 시 동일한
      // 상태로 응답할 수 있게 한다.
      await this.prisma.idempotencyKey.update({
        where: { userId_endpoint_idemKey: { userId, endpoint, idemKey } },
        data: {
          responseJson: (result ?? null) as Prisma.InputJsonValue,
          statusCode: response.statusCode ?? HttpStatus.OK,
          // 완료된 응답은 재생 가능 기간(24h) 동안 보존한다.
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
        }
      });
      return result;
    } catch (error) {
      // Free the key on failure so a genuine retry (not a duplicate side-effect
      // attempt) can succeed later instead of being stuck replaying a failure
      // forever.
      await this.prisma.idempotencyKey.deleteMany({ where: { userId, endpoint, idemKey } }).catch(() => undefined);
      throw error;
    }
  }

  private async reserve(
    userId: string,
    endpoint: string,
    idemKey: string,
    requestHash: string
  ): Promise<{ outcome: "owner" } | { outcome: "replay" } | { outcome: "conflict" }> {
    try {
      // 예약 단계에서는 짧은 TTL(PENDING_TTL_MS)만 부여한다. 완료 시점에 24h로
      // 연장되므로, 핸들러 도중 크래시로 응답이 기록되지 못한 예약 행은 그
      // TTL이 지나면 만료·회수된다. TTL 값의 근거(클라이언트 쓰기 타임아웃보다
      // 반드시 길어야 하는 이유)는 PENDING_TTL_MS 선언부 주석 참고.
      await this.prisma.idempotencyKey.create({
        data: { userId, endpoint, idemKey, requestHash, expiresAt: new Date(Date.now() + PENDING_TTL_MS) }
      });
      // 확률적 전역 청소: 완료/예약 만료 행을 회수해 테이블 무한 성장을 막는다.
      if (Math.random() < 0.02) {
        void this.prisma.idempotencyKey
          .deleteMany({ where: { expiresAt: { lt: new Date() } } })
          .catch(() => undefined);
      }
      return { outcome: "owner" };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { userId_endpoint_idemKey: { userId, endpoint, idemKey } },
        select: { requestHash: true, responseJson: true, statusCode: true, expiresAt: true }
      });
      if (!existing) {
        // The reservation that won the race failed and was deleted between our
        // failed insert and this lookup; treat as a fresh attempt.
        return this.reserve(userId, endpoint, idemKey, requestHash);
      }
      if (existing.expiresAt < new Date()) {
        // 만료된 행(PENDING_TTL이 지나도록 응답이 기록되지 않은 크래시 잔재, 또는
        // 24h 지난 완료 응답)은 회수하고 새 시도로 취급한다. 아직 처리 중일 수도
        // 있는 예약을 여기서 회수하지 않도록 PENDING_TTL_MS는 클라이언트 쓰기
        // 타임아웃보다 길게 잡혀 있다(선언부 주석의 H-1 불변식).
        await this.prisma.idempotencyKey
          .deleteMany({
            where: { userId, endpoint, idemKey, expiresAt: { lt: new Date() } }
          })
          .catch(() => undefined);
        return this.reserve(userId, endpoint, idemKey, requestHash);
      }
      if (existing.requestHash !== requestHash) {
        return { outcome: "conflict" };
      }
      return { outcome: "replay" };
    }
  }

  private async waitForCompletion(userId: string, endpoint: string, idemKey: string): Promise<IdempotencyKeyRow> {
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      const row = await this.prisma.idempotencyKey.findUnique({
        where: { userId_endpoint_idemKey: { userId, endpoint, idemKey } },
        select: { requestHash: true, responseJson: true, statusCode: true }
      });
      if (!row) {
        throw conflictError("이전 요청 처리에 실패했어요. 다시 시도해 주세요.");
      }
      if (row.statusCode != null) {
        return row;
      }
      await sleep(RETRY_INTERVAL_MS);
    }
    throw conflictError("이전 요청이 아직 처리 중이에요. 잠시 후 다시 시도해 주세요.");
  }
}
