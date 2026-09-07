import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Expense as PrismaExpense } from "@prisma/client";
import type { MemberRole } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isUuid } from "../common/validation/uuid";
import { ExpensesStoreService } from "../onboarding/expenses-store.service";
import { toExpenseAuditSnapshot } from "../onboarding/store-shared";
import { PushDispatchService } from "../push/push-dispatch.service";
import { toDeletedExpenseSnapshot, toExpenseSnapshot } from "./expense-snapshot";
import type { UpdateExpenseDto } from "./dto/expense.dto";

function memberRoleFor(user: AuthenticatedUser, householdId: string): MemberRole | null {
  return user.households.find((household) => household.id === householdId)?.role ?? null;
}

function canEdit(role: MemberRole | null) {
  return role === "owner" || role === "co_parent";
}

const VERSION_CONFLICT_MESSAGE = "다른 곳에서 먼저 변경됐어요. 최신 내용을 다시 불러와 주세요.";

/**
 * 라운드 107 트랙 A(정찰 S1-1) — `expense.update` 감사 봉투의 `changed`에 설 수 있는 **축 이름의
 * 전부**. `UpdateExpenseDto`가 받는 필드에서 `expectedVersion`(동시성 가드일 뿐 지출의 축이
 * 아니다)만 뺀 목록이고, 목록 밖의 키는 어떤 경우에도 봉투에 서지 않는다.
 *
 * 왜 요청 본문의 키를 그대로 쓰지 않고 이 대장으로 한 번 거르나: 전역 ValidationPipe가
 * `forbidNonWhitelisted`라 오늘은 알 수 없는 키가 여기 닿지 않지만, 그 보장은 **다른 파일**에
 * 있다. 봉투에 서는 문자열의 출처가 사용자 입력이면 안 된다는 규율은 이 파일 안에서 스스로
 * 지킨다(자유 문자열을 값으로 싣지 않으려고 이 라운드를 한 것이므로, 키 자리로 우회되면 같은 결함이다).
 *
 * `itemName`·`merchant`·`memo`가 이 목록에 **있는 것이 의도**다 — 봉투가 싣는 것은 그 축을
 * 건드렸다는 **사실**이지 값이 아니다(`custom-categories.service.ts`의 `changed: ["name","active"]`와
 * 같은 모양). 그리고 `custom_category.update`가 그은 선을 그대로 따른다: `changed`는
 * **이 요청이 실은 축**이지 값이 실제로 달라졌는지가 아니다 — 같은 값으로 다시 저장한 요청도
 * "그 축을 건드린 요청"으로 남는 편이 요청 모양을 되짚는 쪽에 정직하다.
 */
const EXPENSE_UPDATE_AUDIT_AXES = [
  "categoryId",
  "amountKrw",
  "spentOn",
  "itemName",
  "memo",
  "merchant",
  "paymentMethod",
  "expenseType"
] as const;

/**
 * 라운드 106 T9 — 지출을 가리키지 못하는 `:expenseId`의 **단 하나의 출구**.
 *
 * 문구·코드가 갈리지 않게 한 곳에서 만든다(`custom-categories.service.ts`의
 * `duplicateNameError()`와 같은 형식). 갈래는 둘이고 응답은 하나다:
 * ① 형식은 맞지만 그런 지출이 없는 id, ② 아예 UUID가 아닌 id(아래 `requireExpenseIdShape`).
 */
function expenseNotFound() {
  return new NotFoundException({ code: "EXPENSE_NOT_FOUND", message: "지출 기록을 찾을 수 없어요." });
}

/**
 * Owns MOB-103's optimistic-concurrency layer for expenses: `version` exposure,
 * `expectedVersion` conditional update/delete, and the 409 VERSION_CONFLICT
 * contract (design doc docs/5차/round5a-sprint1-plan.md §2.2).
 *
 * Deliberately does NOT reimplement expense field validation/business rules
 * (category existence, future-date checks, item-name trimming, household
 * access, ...) -- those stay owned by ExpensesStoreService.{create,update,
 * delete,get,list}Expense, which this service delegates to. This file only
 * adds the version bookkeeping around those calls, specifically so it never
 * needs to edit the onboarding store services (owned by concurrent work this
 * sprint).
 *
 * Optimistic-lock mechanics: `expectedVersion` conflict detection is a
 * compare-and-swap directly on the `version` column (`updateMany` scoped to
 * `id + version + deletedAt: null`), performed *before* delegating to the
 * store's own field mutation. Winning the CAS is what serializes concurrent
 * requests against the same version -- a loser's `updateMany` affects 0 rows
 * and short-circuits to the conflict branch before the store's own update
 * ever runs. If the store call subsequently throws (e.g. validation error),
 * the CAS's version bump is rolled back so a rejected request never burns a
 * version number.
 */
@Injectable()
export class ExpensesVersionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExpensesStoreService) private readonly store: ExpensesStoreService,
    // PUSH-113: 전역 PushModule이 제공하는 발송 훅. @Optional() — 이 서비스만 따로
    // 조립하는 단위 테스트/부분 모듈에서는 없어도 되고, 그 경우 훅은 그냥 건너뛴다.
    @Optional() @Inject(PushDispatchService) private readonly pushDispatch?: PushDispatchService
  ) {}

  async getExpense(user: AuthenticatedUser, expenseId: string) {
    this.requireExpenseIdShape(expenseId);
    const dto = await this.store.getExpense(user, expenseId);
    return this.hydrateOne(dto as { id: string });
  }

  /**
   * API-124: 목록 페이지네이션은 스토어(ExpensesStoreService.listExpenses)가 소유한다 —
   * 정렬 계약과 커서 술어가 한 곳에 있어야 하기 때문. 여기서는 종전처럼 version만
   * 덧입히고 `hasMore`/`nextCursor`를 그대로 통과시킨다. hydrateMany의 2차 조회도
   * 이제 전량이 아니라 페이지(최대 limit건)에만 걸린다.
   */
  async listExpenses(
    user: AuthenticatedUser,
    childId: string,
    query: { yearMonth?: string; limit?: number; cursor?: string } = {}
  ) {
    const result = await this.store.listExpenses(user, childId, query.yearMonth, {
      limit: query.limit,
      cursor: query.cursor
    });
    const typed = result as {
      expenses: Array<{ id: string }>;
      totalAmountKrw: number;
      hasMore: boolean;
      nextCursor: string | null;
    };
    return {
      expenses: await this.hydrateMany(typed.expenses),
      totalAmountKrw: typed.totalAmountKrw,
      hasMore: typed.hasMore,
      nextCursor: typed.nextCursor
    };
  }

  async hydrateHome<T extends { recentExpenses: Array<{ id: string }> }>(home: T): Promise<T> {
    return { ...home, recentExpenses: await this.hydrateMany(home.recentExpenses) };
  }

  async createExpense(
    user: AuthenticatedUser,
    childId: string,
    input: Parameters<ExpensesStoreService["createExpense"]>[2]
  ) {
    const dto = await this.store.createExpense(user, childId, input);
    // PUSH-113: 지출 생성 직후, 활성 디바이스들로 예산 경계 푸시 발송을 시도한다.
    // fire-and-forget — PushDispatchService.onExpenseCreated는 예외를 절대 던지지
    // 않으므로(내부에서 전부 삼키고 로그) 실패해도 지출 생성 응답/인앱 알림 흐름에
    // 영향이 없다. push 비활성 시에는 즉시 no-op.
    void this.pushDispatch?.onExpenseCreated((dto as { id: string }).id);
    return this.hydrateOne(dto as { id: string });
  }

  /**
   * CS-101(라운드 56): 응답 본문(`expense`)과 **감사 로그용 스냅샷**을 함께 돌려준다.
   * 삭제(deleteExpense)는 스토어가 `{householdId, before, after}`를 실어 주고 컨트롤러가
   * 그대로 기록하는데, 수정에는 그 자리가 없어 "금액이 혼자 바뀌었어요" 문의에 답할
   * 근거가 남지 않았다. householdId도 여기서만 알 수 있다(응답 DTO에는 없다).
   * 컨트롤러는 `result.expense`만 응답으로 돌려주므로 API 계약은 그대로다.
   *
   * ## 라운드 107 트랙 A(정찰 S1-1) — 봉투에서 자유 문자열을 뺐다
   *
   * 종전: `before = toExpenseSnapshot(row)`, `after = expense`(클라이언트로 나가는 갱신 결과
   * 그대로). 두 모양 다 사용자가 적은 **품목명·판매처·메모**를 원문으로 담고 있어, 그 문자열이
   * `audit_logs`에 730일 남고 어드민 감사 뷰어·CSV로 나가고 계정 삭제 후에도 잔존했다.
   *
   * 지금: 봉투는 `toExpenseAuditSnapshot`으로만 뜬다(빼고 남긴 축의 근거는 그 함수 머리말).
   * 자유 문자열 세 축은 **값 대신 `changed`의 축 이름으로만** 남는다 —
   * `custom_category.update`가 이미 쓰는 그 모양이고 새 방식이 아니다.
   * `version`은 이 경로만 before/after를 정확히 알므로 여기서 붙인다.
   *
   * ⚠️ **응답(`expense`)은 한 바이트도 바뀌지 않는다.** 축소는 감사 봉투에만 적용된다 —
   * `after`가 더 이상 `expense`와 같은 객체가 아니라는 것이 이 변경의 요점이다
   * (409 충돌 payload·델타 동기화가 쓰는 `toExpenseSnapshot`은 그대로다).
   */
  async updateExpense(user: AuthenticatedUser, expenseId: string, body: UpdateExpenseDto) {
    this.requireExpenseIdShape(expenseId);
    const { expectedVersion, ...fields } = body;
    const raw = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    const row = this.authorizeExpenseRow(user, raw, true);
    const changed = EXPENSE_UPDATE_AUDIT_AXES.filter((axis) => fields[axis] !== undefined);
    const before = { ...toExpenseAuditSnapshot(row), version: row.version };
    const audit = { householdId: row.householdId, before };

    if (expectedVersion === undefined) {
      const updated = await this.store.updateExpense(user, expenseId, fields);
      const bumped = await this.prisma.expense.update({
        where: { id: expenseId },
        data: { version: { increment: 1 } }
      });
      const expense = { ...(updated as Record<string, unknown>), version: bumped.version };
      return { expense, ...audit, after: { ...toExpenseAuditSnapshot(updated), version: bumped.version, changed } };
    }

    const gate = await this.prisma.expense.updateMany({
      where: { id: expenseId, version: expectedVersion, deletedAt: null },
      data: { version: { increment: 1 } }
    });
    if (gate.count === 0) {
      throw await this.versionConflictFor(user, expenseId);
    }

    try {
      const updated = await this.store.updateExpense(user, expenseId, fields);
      const final = await this.prisma.expense.findUnique({ where: { id: expenseId }, select: { version: true } });
      const version = final?.version ?? expectedVersion + 1;
      const expense = {
        ...(updated as Record<string, unknown>),
        version
      };
      return { expense, ...audit, after: { ...toExpenseAuditSnapshot(updated), version, changed } };
    } catch (error) {
      await this.rollbackVersionBump(expenseId, expectedVersion);
      throw error;
    }
  }

  async deleteExpense(user: AuthenticatedUser, expenseId: string, expectedVersion?: number) {
    this.requireExpenseIdShape(expenseId);
    const raw = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    this.authorizeExpenseRow(user, raw, true);

    if (expectedVersion === undefined) {
      const result = await this.store.deleteExpense(user, expenseId);
      await this.prisma.expense.update({ where: { id: expenseId }, data: { version: { increment: 1 } } });
      return result;
    }

    const gate = await this.prisma.expense.updateMany({
      where: { id: expenseId, version: expectedVersion, deletedAt: null },
      data: { version: { increment: 1 } }
    });
    if (gate.count === 0) {
      throw await this.versionConflictFor(user, expenseId);
    }

    try {
      return await this.store.deleteExpense(user, expenseId);
    } catch (error) {
      await this.rollbackVersionBump(expenseId, expectedVersion);
      throw error;
    }
  }

  /**
   * 라운드 106 T9 — `:expenseId`가 **UUID 형식일 때만** Prisma 술어에 닿게 한다.
   *
   * 종전(이 줄이 없던 시점): `GET/PATCH/DELETE /api/v1/expenses/<UUID가 아닌 값>`의 id가
   * 그대로 `expenses.id`(`@db.Uuid`) 술어에 실렸다 — PATCH·DELETE는 바로 아래
   * `expense.findUnique`, GET은 스토어의 `requireExpenseAccess`가 그 첫 자리다. Prisma는
   * 그 값을 드라이버 단에서 거절하고(`Inconsistent column data: Error creating UUID` —
   * 판정 근거는 `common/validation/uuid.ts` 머리말, R24-M2가 커서에서 실측한 것과 같은
   * 예외다), HttpException이 아니므로 `GlobalExceptionFilter`가 **500 INTERNAL_SERVER_ERROR
   * "잠시 후 다시 시도해주세요."** 로 내보냈다. 원인은 클라이언트가 보낸 id인데 화면에는
   * 서버 장애로 보이고, 그 안내대로 다시 눌러도 결과가 같다 — DNC-018이 금지하는 틀린
   * 안내다. 그리고 모바일 오프라인 아웃박스는 5xx를 일시 실패로 보고 무한히 재전송하므로
   * (`apps/mobile/src/offline/remote-api.ts`) 성공할 수 없는 수정/삭제 하나가 큐 맨 앞에서
   * 뒤의 멀쩡한 지출까지 막는 poison pill이 된다 — 같은 파일의
   * `LINKED_PRODUCT_LINK_NOT_FOUND`가 400으로 옮긴 그 실패와 **같은 종류**다.
   *
   * 지금: 어떤 지출도 가리킬 수 없는 id이므로 형식은 맞지만 없는 id와 **같은 404
   * `EXPENSE_NOT_FOUND`**로 끝낸다(새 오류 코드 0건). 라운드 103
   * `custom-categories.service.ts`가 `isUuid`로 같은 판단을 한 선례와 같은 형식이고,
   * 정규식 사본을 늘리지 않으려고 판정은 `common/validation/uuid.ts` 한 벌을 그대로 쓴다.
   *
   * 권한 판정보다 앞서는 것이 의도다: 이 검사는 DB를 한 줄도 읽지 않는 **모양 검사**라
   * 어떤 지출의 존재 여부도 말하지 않고(오라클 없음), 전역 ValidationPipe가 본문·쿼리를
   * 먼저 거르는 순서와 같은 자리에 선다.
   */
  private requireExpenseIdShape(expenseId: string): void {
    if (!isUuid(expenseId)) {
      throw expenseNotFound();
    }
  }

  private async rollbackVersionBump(expenseId: string, expectedVersion: number) {
    // 우리 CAS가 만든 bump(expectedVersion+1)가 아직 최신일 때만 되돌린다.
    // 그 사이 다른 요청이 성공해 version이 더 나아갔다면 깎으면 안 된다(버전 역행 방지).
    await this.prisma.expense
      .updateMany({
        where: { id: expenseId, version: expectedVersion + 1 },
        data: { version: { decrement: 1 } }
      })
      .catch(() => undefined);
  }

  /**
   * 라운드 108 T24 후속 — 409 `current`가 나가는 읽기를 **호출자의 가구로 좁힌다.**
   *
   * 종전(그때도 참이고 오늘도 참이다): `findUnique({ where: { id: expenseId } })` 한 줄이었고,
   * "남의 지출이 실리지 않는다"는 보장은 전적으로 **호출자 계약**이었다 — 두 호출부
   * (`updateExpense`·`deleteExpense`)가 이 메서드를 부르기 **전에** `authorizeExpenseRow`를
   * 지난다는 사실. 그 사실은 오늘 두 자리 모두 그대로이므로(전수로 따라가 확인했다)
   * **오늘 실제로 새는 값은 없다.** 바뀌는 것은 그 보장이 서 있는 자리다.
   *
   * 라운드 108 T24가 역돌연변이로 재어 낸 것이 그것이다: `authorizeExpenseRow`의 역할 검사를
   * 지워도 **성공 갈래는** 스토어(`ExpensesStoreService.requireExpenseAccess`)가 대신 403을 던져
   * 기존 테스트가 전부 초록이었고, **CAS가 실패하는 갈래에서만** 이 메서드가 남의 지출을 다시
   * 읽어 409 `current`에 품목명·판매처·메모·금액을 그대로 실어 보냈다 — 인가 두 벌이 서로를
   * 가려 주는 바람에 그 갈래에는 지키는 눈이 없었다.
   *
   * 지금: 읽기 자체에 **호출자의 가구 집합**을 술어로 세운다(`sync.service.ts`의 델타 동기화가
   * 같은 모양으로 이미 쓰는 `householdId: { in: householdIds }` 그대로다). 관문이 살아 있는
   * 오늘은 **항등**이다 — `authorizeExpenseRow`가 `row.householdId`의 구성원임을 판정한 뒤에만
   * 여기 닿기 때문이다. 그래서 **사용자에게 나가는 값은 한 축도 줄지 않는다.**
   *
   * 왜 축을 줄이는 쪽(라운드 107이 감사 봉투에 한 것)을 고르지 않았나: 이 값은 감사 기록이
   * 아니라 **사용자가 충돌을 해소하라고** 주는 값이다. 모바일 충돌 화면의 "두 값 나란히 보기"가
   * 비교 항목으로 내놓는 여덟 축(apps/mobile/src/offline/sync-engine.ts `diffExpenseFields`:
   * categoryId·amountKrw·spentOn·itemName·merchant·memo·paymentMethod·expenseType)에
   * 품목명·판매처·메모가 들어 있어, 그것을 뺀 순간 사용자는 서버 값을 보지 못한 채 고르게 된다
   * (라운드 48 QA(P2-6)가 `paymentMethod` 하나 빠졌을 때 실측한 그 허위 표시와 같은 종류다).
   *
   * 행이 아예 없을 때(하드 삭제 경합, 그리고 이제는 가구 밖 행)를 종전 그대로 `current: null`로
   * 두는 것도 의도다 — 계약이 `null`을 허용하고(packages/contracts `versionConflictResponseSchema`),
   * 404로 갈라 나가면 상태코드 계약이 바뀐다.
   */
  private async versionConflictFor(user: AuthenticatedUser, expenseId: string) {
    const householdIds = user.households.map((household) => household.id);
    const row = await this.prisma.expense.findFirst({
      where: { id: expenseId, householdId: { in: householdIds } }
    });
    const current = !row ? null : row.deletedAt ? toDeletedExpenseSnapshot(row) : toExpenseSnapshot(row);
    return new HttpException(
      { code: "VERSION_CONFLICT", message: VERSION_CONFLICT_MESSAGE, current },
      HttpStatus.CONFLICT
    );
  }

  private authorizeExpenseRow(
    user: AuthenticatedUser,
    row: PrismaExpense | null,
    requireEdit: boolean
  ): PrismaExpense {
    if (!row) {
      throw expenseNotFound();
    }
    const role = memberRoleFor(user, row.householdId);
    if (!role || (requireEdit && !canEdit(role))) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "지출 기록 접근 권한이 없어요." });
    }
    return row;
  }

  private async hydrateOne<T extends { id: string }>(dto: T): Promise<T & { version: number }> {
    const row = await this.prisma.expense.findUnique({ where: { id: dto.id }, select: { version: true } });
    return { ...dto, version: row?.version ?? 1 };
  }

  private async hydrateMany<T extends { id: string }>(dtos: T[]): Promise<Array<T & { version: number }>> {
    if (dtos.length === 0) return [];
    const rows = await this.prisma.expense.findMany({
      where: { id: { in: dtos.map((dto) => dto.id) } },
      select: { id: true, version: true }
    });
    const versionById = new Map(rows.map((row) => [row.id, row.version]));
    return dtos.map((dto) => ({ ...dto, version: versionById.get(dto.id) ?? 1 }));
  }
}
