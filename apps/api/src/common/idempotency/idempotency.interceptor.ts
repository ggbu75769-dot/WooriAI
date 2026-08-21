import { createHash } from "node:crypto";
import {
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
// 예약(처리 중) 행의 수명. 핸들러 실행 중 프로세스가 죽어 응답이 기록되지 못한
// 예약 행이 이 시간이 지나면 회수되어, 같은 키의 진짜 재시도가 영구히 막히지 않는다.
const PENDING_TTL_MS = 60 * 1000;
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

    const userId = request.user?.id ?? request.adminUser?.id;
    if (!userId) {
      return next.handle();
    }

    const rawRequest = context
      .switchToHttp()
      .getRequest<{ route?: { path?: string }; originalUrl?: string; url?: string; method?: string }>();
    // endpoint에는 라우트 패턴(:childId)을 쓰되, 해시에는 파라미터가 치환된 실제
    // URL을 포함한다 — 같은 키+같은 body로 다른 리소스(childId 등)에 요청했을 때
    // 첫 응답이 잘못 재생되지 않고 409(다른 요청)로 구분되게 하기 위함이다.
    const routePath = rawRequest.route?.path ?? rawRequest.url ?? "unknown";
    const endpoint = `${rawRequest.method ?? "POST"}:${routePath}`.slice(0, 120);
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
      // 예약 단계에서는 짧은 TTL만 부여한다. 완료 시점에 24h로 연장되므로,
      // 핸들러 도중 크래시로 응답이 기록되지 못한 예약 행은 곧 만료·회수된다.
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
        // 만료된 행(크래시로 남은 예약, 또는 24h 지난 완료 응답)은 회수하고
        // 새 시도로 취급한다.
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
