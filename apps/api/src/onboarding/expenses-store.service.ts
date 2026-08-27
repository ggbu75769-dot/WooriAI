import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { EXPENSE_LIST_DEFAULT_LIMIT } from "@wooriai/contracts";
import { getSeoulMonthRange, type ExpenseSource, type ExpenseType, type PaymentMethod } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isUuid } from "../common/validation/uuid";
import { ChildAccessService } from "./child-access.service";
import {
  assertNotFutureDate,
  cleanOptionalText,
  markLinkedItemPrepared,
  requireMoneyKrw,
  toDateOnly,
  toExpenseDto,
  type DbClient,
  type ExpenseRow
} from "./store-shared";

export type CreateExpenseInput = {
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  memo?: string;
  linkedItemTemplateId?: string;
  expenseType?: ExpenseType;
  source?: ExpenseSource;
};

export type UpdateExpenseInput = {
  categoryId?: string;
  amountKrw?: number;
  spentOn?: string;
  itemName?: string;
  memo?: string | null;
  /** 라운드 48 QA(P2-6): 충돌 병합이 고른 결제 수단을 실제로 반영하기 위한 additive optional. */
  paymentMethod?: PaymentMethod;
  expenseType?: ExpenseType;
};

export type ListExpensesOptions = {
  limit?: number;
  cursor?: string;
};

/**
 * API-124: 지출 목록 keyset 커서. `expensesForChild`의 정렬 계약
 * (spentOn desc, createdAt desc, id desc — FIX-121A)의 전체 정렬키를 그대로 담는다.
 * 세 값이 모두 있어야 "이 행 다음부터" 술어를 결정적으로 만들 수 있다.
 */
export type ExpenseListCursor = {
  spentOn: Date;
  createdAt: Date;
  id: string;
};

const EXPENSE_CURSOR_SEPARATOR = "|";

/**
 * R24-L4: 커서의 `createdAt` 조각은 **항상 `Date.prototype.toISOString()`이 찍는
 * UTC 밀리초 3자리 형태**다(`YYYY-MM-DDTHH:mm:ss.sssZ`). 이것이 이 커서의 정밀도
 * 불변식이다 — `expenses.created_at`은 `timestamptz(6)`(마이크로초)이지만 Prisma
 * 클라이언트가 만드는 값은 JS `Date`라 밀리초 단위이고, 그래서 커서 왕복
 * (Date → ISO ms 문자열 → Date)이 무손실이다.
 *
 * 만약 raw SQL/복구/백필로 **sub-ms 정밀도의 `created_at` 행**이 들어오면 이
 * 불변식이 깨져 커서 경계에서 행이 유실될 수 있다(마이크로초가 잘려 내림된 커서
 * 값이 그 행 자신과 같아져 `created_at < 커서` 술어에서 빠진다). 백필은
 * `date_trunc('milliseconds', now())`로 넣을 것 — 자세한 조건·증상·해소는
 * docs/operations/known-limitations.md 참고.
 */
const CREATED_AT_ISO_MS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** base64("<spentOn YYYY-MM-DD>|<createdAt ISO 8601>|<id>") — sync/cursor.ts와 같은 모양의 불투명 문자열. */
export function encodeExpenseCursor(row: { spentOn: Date; createdAt: Date; id: string }): string {
  const raw = [
    // `toISOString()`은 항상 밀리초 3자리 UTC — 위 CREATED_AT_ISO_MS_PATTERN의 불변식이
    // 여기서 성립하고, 디코더가 같은 형태만 받아들인다(R24-L4).
    row.spentOn.toISOString().slice(0, 10),
    row.createdAt.toISOString(),
    row.id
  ].join(EXPENSE_CURSOR_SEPARATOR);
  return Buffer.from(raw, "utf8").toString("base64");
}

/**
 * 커서 문자열 → 정렬키. **인코더가 만들 수 없는 값은 전부 손상 커서로 보고**
 * 400 `EXPENSE_CURSOR_INVALID`로 돌린다(조용히 무시하면 클라이언트가 첫 페이지를
 * 다음 페이지로 오인해 무한 루프에 빠질 수 있다 — sync.service.ts와 같은 태도).
 *
 * R24-M2: `id`는 UUID 형식까지 확인한다. 종전에는 빈 문자열만 걸러서, 구조는
 * 맞지만 id가 UUID가 아닌 커서(`base64("2026-07-06|...|not-a-uuid")`)가 그대로
 * Prisma의 `@db.Uuid` 술어에 들어가 드라이버 예외 → **500**이 됐다. 사용자
 * 입력이 원인인 오류이므로 여기서 400으로 잡는다.
 *
 * R24-L4: `createdAt`도 인코더가 찍는 밀리초 3자리 ISO 형태만 받아들인다 —
 * sub-ms 정밀도(`...05.123456Z`)는 인코더가 만들 수 없는 값이라 손상 커서다.
 * (`new Date()`가 잘라 삼키면 경계에서 행이 유실될 수 있다.)
 */
export function decodeExpenseCursor(value: string): ExpenseListCursor {
  const raw = Buffer.from(value, "base64").toString("utf8");
  const parts = raw.split(EXPENSE_CURSOR_SEPARATOR);
  if (parts.length !== 3) {
    throw new BadRequestException({ code: "EXPENSE_CURSOR_INVALID", message: "목록 커서가 올바르지 않아요." });
  }
  const [spentOnPart, createdAtPart, id] = parts;
  const spentOn = new Date(`${spentOnPart}T00:00:00.000Z`);
  const createdAt = new Date(createdAtPart);
  if (
    !isUuid(id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(spentOnPart) ||
    !CREATED_AT_ISO_MS_PATTERN.test(createdAtPart) ||
    Number.isNaN(spentOn.getTime()) ||
    Number.isNaN(createdAt.getTime())
  ) {
    throw new BadRequestException({ code: "EXPENSE_CURSOR_INVALID", message: "목록 커서가 올바르지 않아요." });
  }
  return { spentOn, createdAt, id };
}

/**
 * REF-118: expense CRUD + aggregation split out of the former
 * onboarding-store.service.ts god service. Public HTTP contract (via
 * finance/expenses.service.ts delegation), error codes and response shapes are
 * unchanged. Also hosts the row-level insert (`insertExpense`) that the import
 * pipeline reuses inside its confirm transaction, and the expense aggregation
 * helpers (sumExpenses/expensesForChild/totalExpenseKrw) the budget and
 * reporting services build on.
 *
 * FIX-118B(F5) 접근검증 규약: `user`를 받는 메서드(createExpense/listExpenses/
 * getExpense/updateExpense/deleteExpense/requireExpenseAccess/
 * requireExpenseBelongsToChild)는 스스로 requireChildAccess를 호출해 권한을
 * 확인한다. 반면 REF-118 분리 과정에서 다른 서비스가 재사용해야 해 public이 된
 * childId/householdId 기반 메서드(insertExpense/expensesForChild/sumExpenses)는
 * **접근검증을 하지 않는다** — 호출자가 먼저 requireChildAccess(또는
 * requireExpenseAccess) 등으로 해당 아이/지출에 대한 권한을 확인한 뒤 호출해야
 * 한다. 각 메서드의 JSDoc에 같은 경고를 반복해 둔다.
 */
@Injectable()
export class ExpensesStoreService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService
  ) {}

  /**
   * R19-B: 지출 행 삽입과 (연결된 준비템이 있을 때) 그 준비템의 상태 표시를 한
   * 트랜잭션으로 묶는다 — insertExpense가 둘 다 같은 client로 수행하므로,
   * 중간에 죽어도 "지출은 남았는데 준비템은 미준비" 또는 그 반대가 될 수 없다.
   * 가져오기 확정 경로(import-pipeline)는 이미 자기 트랜잭션 안에서
   * insertExpense를 호출하고 있어 동일한 원자성을 그대로 얻는다.
   */
  async createExpense(user: AuthenticatedUser, childId: string, input: CreateExpenseInput) {
    const child = await this.childAccess.requireChildAccess(user, childId, true);
    const created = await this.prisma.$transaction((tx) => this.insertExpense(tx, child.householdId, childId, user, input));
    return toExpenseDto(created);
  }

  /**
   * API-124: 커서 페이지네이션. 종전에는 `yearMonth`를 생략하면 아이의 **전 기간**
   * 지출 행을 전량 실어 보냈다(그리고 finance 계층이 그 전량에 대해 version 2차
   * 조회를 한 번 더 했다) — 기록이 쌓일수록 한 요청이 무한정 커지는 구조였다.
   * 이제 `limit`(기본 200, 상한 500)만큼만 읽고, 다음 페이지는 `nextCursor`로 잇는다.
   * `sync.service.ts`와 같은 `take: limit + 1` 방식이라 별도 count 쿼리 없이
   * `hasMore`를 판정한다.
   *
   * ⚠️ `totalAmountKrw`는 **페이지 합이 아니라 조회 범위 전체의 합**을 유지한다.
   * 종전 구현이 "로드한 배열의 합"이었기 때문에, 페이지네이션만 넣고 그대로 두면
   * 화면의 총액이 스크롤에 따라 달라지는 허위 표시가 된다. 그래서 배열 합
   * (`totalExpenseKrw`)이 아니라 DB 집계인 `sumExpenses`로 계산한다 — DNC-015의
   * gift 제외 규칙(expenseType === "expense")은 이미 그 함수가 단일 소스로 들고
   * 있으므로 새로 만들지 않고 그대로 재사용한다. 범위(range)도 종전과 동일하게
   * `yearMonth`가 있으면 그 달, 없으면 전 기간이다.
   */
  async listExpenses(user: AuthenticatedUser, childId: string, yearMonth?: string, options: ListExpensesOptions = {}) {
    await this.childAccess.requireChildAccess(user, childId);
    const limit = options.limit ?? EXPENSE_LIST_DEFAULT_LIMIT;
    const after = options.cursor ? decodeExpenseCursor(options.cursor) : undefined;

    const [rows, totalAmountKrw] = await Promise.all([
      this.expensesForChild(childId, yearMonth, limit + 1, after),
      this.sumExpenses(childId, yearMonth ? getSeoulMonthRange(yearMonth) : undefined)
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      expenses: page.map((expense) => toExpenseDto(expense)),
      totalAmountKrw,
      hasMore,
      // 빈 페이지면 클라이언트가 들고 있던 커서를 그대로 돌려준다(sync.service.ts와 동일).
      nextCursor: last ? encodeExpenseCursor(last) : (options.cursor ?? null)
    };
  }

  async getExpense(user: AuthenticatedUser, expenseId: string) {
    return toExpenseDto(await this.requireExpenseAccess(user, expenseId));
  }

  async updateExpense(user: AuthenticatedUser, expenseId: string, input: UpdateExpenseInput) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    const data: Prisma.ExpenseUpdateInput = {};

    if (input.categoryId !== undefined) {
      await this.requireExistingCategory(input.categoryId);
      data.categoryId = input.categoryId;
    }
    if (input.amountKrw !== undefined) data.amountKrw = requireMoneyKrw(input.amountKrw);
    if (input.spentOn !== undefined) {
      assertNotFutureDate(input.spentOn);
      data.spentOn = toDateOnly(input.spentOn);
    }
    if (input.itemName !== undefined) {
      const itemName = input.itemName.trim();
      if (!itemName) {
        throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
      }
      data.itemName = itemName;
    }
    if (input.memo !== undefined) data.memo = cleanOptionalText(input.memo ?? undefined);
    // 라운드 48 QA(P2-6): DTO가 이미 PAYMENT_METHODS로 좁혀 두었으므로 여기서는 그대로 옮긴다
    // (생성 경로 insertExpense와 같은 취급). 보내지 않으면 손대지 않는다.
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
    if (input.expenseType !== undefined) data.expenseType = input.expenseType;

    const updated = await this.prisma.expense.update({ where: { id: expense.id }, data });
    return toExpenseDto(updated);
  }

  /**
   * R19-B: 지출을 지워도 그 지출이 올려 둔 준비템의 `prepared` 표시는 **되돌리지
   * 않는다**. 지출 기록을 지우는 이유는 대부분 오기입 정정/중복 제거이지 "물건을
   * 반품했다"가 아니고, 상태를 같이 내리면 사용자가 손으로 확인해 둔 준비 완료가
   * 예고 없이 사라져 준비템 화면이 흔들린다. 준비 완료를 취소하고 싶다면
   * PATCH /children/:childId/items/:itemTemplateId/status가 명시적 수단이다.
   * (child_item_statuses.expenseId FK는 삭제된 지출 행을 계속 가리킨다 — 지출은
   * soft delete이고(DNC-014), 하드 퍼지 시에는 data-retention-purge 잡이
   * expenseId를 null로 끊는다.)
   */
  async deleteExpense(user: AuthenticatedUser, expenseId: string) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    const before = toExpenseDto(expense);
    const now = new Date();
    const deleted = await this.prisma.expense.update({
      where: { id: expense.id },
      data: { deletedAt: now, deletedByUserId: user.id }
    });
    return {
      success: true,
      householdId: deleted.householdId,
      before,
      after: { ...before, deletedAt: deleted.deletedAt?.toISOString() ?? null }
    };
  }

  /**
   * Row-level insert shared by createExpense and the import pipeline's confirm
   * transaction (which passes its own transaction client). Validation order and
   * error codes are unchanged from the god-service original.
   *
   * ⚠️ 호출 전 접근검증 필수 (FIX-118B/F5): 이 메서드는 입력값 검증(품목명/금액/
   * 날짜/카테고리·준비템 존재)만 하고 `user`가 `childId`/`householdId`에 접근할
   * 수 있는지는 **확인하지 않는다**. 호출자가 먼저
   * ChildAccessService.requireChildAccess(user, childId, true)로 편집 권한을
   * 확인한 뒤 호출해야 한다 (createExpense는 직접, import-pipeline은
   * requireImportJobAccess(edit)로 확인한 job의 childId/householdId를 넘긴다).
   *
   * R19-B: `linkedItemTemplateId`가 있으면 같은 client로 준비템 상태까지
   * 표시한다 — 아래 markLinkedItemPrepared 호출부 주석 참고.
   */
  async insertExpense(
    client: DbClient,
    householdId: string,
    childId: string,
    user: AuthenticatedUser,
    input: CreateExpenseInput
  ): Promise<ExpenseRow> {
    const itemName = input.itemName.trim();
    if (!itemName) {
      throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
    }
    assertNotFutureDate(input.spentOn);
    await this.requireExistingCategory(input.categoryId, client);
    if (input.linkedItemTemplateId) {
      await this.requireExistingItemTemplateAnyStatus(input.linkedItemTemplateId, client);
    }

    const created = await client.expense.create({
      data: {
        householdId,
        childId,
        createdByUserId: user.id,
        categoryId: input.categoryId,
        amountKrw: requireMoneyKrw(input.amountKrw),
        spentOn: toDateOnly(input.spentOn),
        itemName,
        merchant: cleanOptionalText(input.merchant),
        paymentMethod: input.paymentMethod ?? "unknown",
        memo: cleanOptionalText(input.memo),
        linkedItemTemplateId: input.linkedItemTemplateId ?? null,
        expenseType: input.expenseType ?? "expense",
        source: input.source ?? "manual"
      }
    });

    // R19-B / DNC-002: "구매 후 기록 → 준비템 상태 체크" 고리. 준비템에 연결된
    // 지출이 생기면 그 준비템을 자동으로 준비 완료로 표시한다 — 사용자가 이미
    // gifted/not_needed로 정리해 둔 항목은 건드리지 않는다(markLinkedItemPrepared
    // 주석의 보존 규칙). 여기(행 삽입 지점)에 두어야 수동 생성/가져오기 확정 등
    // 모든 지출 생성 경로가 같은 client(=같은 트랜잭션) 안에서 동일하게 동작한다.
    if (input.linkedItemTemplateId) {
      await markLinkedItemPrepared(client, {
        childId,
        itemTemplateId: input.linkedItemTemplateId,
        userId: user.id,
        expenseId: created.id
      });
    }

    return created;
  }

  async requireExpenseAccess(user: AuthenticatedUser, expenseId: string, edit = false): Promise<ExpenseRow> {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.deletedAt) {
      throw new NotFoundException({ code: "EXPENSE_NOT_FOUND", message: "지출 기록을 찾을 수 없어요." });
    }

    await this.childAccess.requireChildAccess(user, expense.childId, edit);
    return expense;
  }

  async requireExpenseBelongsToChild(user: AuthenticatedUser, expenseId: string, childId: string) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    if (expense.childId !== childId) {
      throw new ForbiddenException({ code: "EXPENSE_CHILD_MISMATCH", message: "지출 기록이 해당 아이 소속이 아니에요." });
    }
    return expense;
  }

  async requireExistingCategory(categoryId: string, client: DbClient = this.prisma) {
    const exists = await client.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요."
      });
    }
  }

  private async requireExistingItemTemplateAnyStatus(itemTemplateId: string, client: DbClient = this.prisma) {
    const exists = await client.itemTemplate.findUnique({ where: { id: itemTemplateId }, select: { id: true } });
    if (!exists) {
      throw new BadRequestException({ code: "EXPENSE_LINKED_ITEM_TEMPLATE_INVALID", message: "연결된 준비템을 찾을 수 없어요." });
    }
  }

  /**
   * ⚠️ 호출 전 접근검증 필수 (FIX-118B/F5): childId만 받는 원시 조회다 — 권한
   * 확인이 없으므로 호출자가 requireChildAccess를 먼저 통과시켜야 한다
   * (listExpenses / ReportingStoreService.getHome 등이 그 규약을 지킨다).
   *
   * PERF-121(F1): `take`는 "최신순 N건"만 필요한 호출자(홈의 recentExpenses)를 위한
   * LIMIT이다. 정렬 계약(spentOn desc, createdAt desc, id desc)을 이 한 곳에 유지하려고
   * 별도 메서드를 만들지 않고 옵션으로 받는다 — 최신 N건은 정렬 순서에 의존하므로
   * 정렬 정의가 갈라지면 안 된다. 생략하면 종전대로 전량을 돌려준다.
   *
   * FIX-121A(F1): `{ id: "desc" }`는 결정적 타이브레이커다. (spentOn, createdAt)이
   * 모두 같은 행이 실제로 생긴다 — 가져오기 확정(import-pipeline)은 한 트랜잭션
   * 안에서 여러 지출을 삽입하므로 `created_at` 기본값(now())이 트랜잭션 시작
   * 시각으로 **전부 동일**하다. 타이브레이커가 없으면 Postgres가 동률 행을 어떤
   * 순서로든 돌려줄 수 있어, PERF-121의 `LIMIT 3` 치환(홈)이 종전 "전량 정렬 후
   * slice(0,3)"와 다른 행을 뽑을 수 있었다. 홈(recentExpenses)과 기록 탭
   * (listExpenses)이 같은 이 경로를 쓰므로 둘이 함께 안정된다.
   *
   * API-124(F1): `after`는 keyset 커서다 — 정렬키 (spentOn, createdAt, id) 전체에 대한
   * 사전식 "미만" 술어라 위 정렬 계약과 정확히 맞물린다. OFFSET을 쓰지 않으므로 페이지
   * 사이에 행이 생기거나 지워져도 건너뜀/중복이 생기지 않는다(이것이 이 커서의 실제
   * 이득이다). FIX-121A의 `id` 타이브레이커가 여기서 두 번째 역할을 한다 — 동률 행이
   * 있어도 커서가 가리키는 지점이 유일하게 정해진다.
   *
   * R24-M3 이력: Prisma는 튜플 비교 `(spent_on, created_at, id) < (...)`를 표현할 수
   * 없어 위 술어가 3분기 OR로 나가고, OR 자체는 인덱스 시작점이 되지 못한다(Filter로
   * 앞 페이지 행을 전부 버리는 O(offset) 재스캔 — 실측 offset 10,000에서 buffers 47배).
   * 이를 후속(A)로 해소했다: 아래 `spentOnBounds`의 `lte: after.spentOn`이 OR가 함의하는
   * 상한을 AND로 명시해, 000017 인덱스의 (child_id, spent_on) 범위가 Index Cond로
   * 올라간다(실측 10,255 → 228 buf). 남는 비용은 커서 날짜와 같은 `spent_on` 동률 구간
   * 하나에 비례할 뿐이다.
   *
   * 적용 범위 정확히(R26 리뷰 정정): 이 45배 이득과 "lte를 지우면 회귀한다"는 경고는
   * **yearMonth 없이 호출되는 경우**에 대한 것이다. 모바일 클라이언트는 항상 yearMonth를
   * 붙이므로(client.ts의 effectiveYearMonth) 앱 트래픽에서는 월 범위 gte/lt가 이미 스캔을
   * 한 달로 묶어 O(offset) 문제 자체가 없고, 그 플랜에서 lte는 사실상 무해한 잉여다.
   * lte를 유지하는 이유는 yearMonth 생략이 허용된 공개 API이기 때문이다 — 그 경로의
   * 플랜 모양은 perf-indexes.db.test.ts의 R24-M3 후속A 단언이 고정한다. 판단·실측 이력은
   * docs/operations/perf-index-notes.md의 R24-M3 절 참고.
   */
  async expensesForChild(
    childId: string,
    yearMonth?: string,
    take?: number,
    after?: ExpenseListCursor
  ): Promise<ExpenseRow[]> {
    const range = yearMonth ? getSeoulMonthRange(yearMonth) : null;
    // R24-M3 후속(A): OR 3분기는 모두 spentOn <= after.spentOn을 함의한다. 이 상한을
    // AND 조건으로도 명시하면 플래너가 idx_expenses_list_keyset의 (child_id, spent_on)
    // 범위를 Index Cond로 쓸 수 있어 깊은 커서의 O(offset) 재스캔이 사라진다
    // (실측 10,255 → 228 buf). 결과 집합은 불변 — 왕복 동치는 e2e가 고정한다.
    const spentOnBounds = {
      ...(range ? { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) } : {}),
      ...(after ? { lte: after.spentOn } : {})
    };
    return this.prisma.expense.findMany({
      where: {
        childId,
        deletedAt: null,
        ...(Object.keys(spentOnBounds).length > 0 ? { spentOn: spentOnBounds } : {}),
        ...(after
          ? {
              OR: [
                { spentOn: { lt: after.spentOn } },
                { spentOn: after.spentOn, createdAt: { lt: after.createdAt } },
                { spentOn: after.spentOn, createdAt: after.createdAt, id: { lt: after.id } }
              ]
            }
          : {})
      },
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...(take === undefined ? {} : { take })
    });
  }

  /**
   * DNC-015 합산 술어의 서버 쪽 인메모리 판본 — 이미 읽어 온 행 배열을 더할 때만 쓴다.
   * 조회 범위 전체의 합은 항상 DB 집계인 `sumExpenses`가 낸다(listExpenses 주석 참고).
   *
   * CLN-131(상호 참조): 같은 규칙이 세 곳에 산다 —
   *   - 서버: 이 함수와 `sumExpenses`(`expenseType: "expense"` where 절)
   *   - 모바일: `countsTowardMonthlyTotal`(apps/mobile/src/offline/expense-list-reconciliation.ts)
   * 모바일 판본은 `expenseType`이 **없는** 레거시 오프라인 페이로드를 지출로 간주하지만,
   * 여기 엄격 비교와 의미 차이는 없다: Prisma 스키마의 `expenses.expense_type`이 not-null
   * (`ExpenseType @default(expense)`)이라 DB에서 온 행은 값이 항상 채워져 있다.
   * 모바일은 관례상 contracts/서버 코드에 의존하지 않으므로 술어를 공유하지 않고
   * 값으로 미러링한다 — 한쪽을 바꾸면 반드시 다른 쪽도 함께 본다.
   */
  totalExpenseKrw(expenses: ExpenseRow[]) {
    return expenses.filter((expense) => expense.expenseType === "expense").reduce((sum, expense) => sum + expense.amountKrw, 0);
  }

  /**
   * ⚠️ 호출 전 접근검증 필수 (FIX-118B/F5): expensesForChild와 동일하게 childId
   * 기반 집계만 수행한다 — 예산(getBudget/upsertBudget)·리포트 경로가 각자
   * requireChildAccess를 먼저 호출한 뒤 사용한다.
   *
   * DNC-015: `expenseType: "expense"` 필터가 선물(gift)을 합계에서 제외한다 —
   * 범위 유무와 무관하게 항상 적용된다.
   *
   * PERF-121(F1): `range`를 생략하면 전 기간 합계다(홈의 totalExpenseKrw). 종전에는
   * 홈이 전 행을 읽어 JS에서 더했지만, 같은 술어의 SUM을 DB에 맡기는 것이 동치이면서
   * 행을 하나도 옮기지 않는다. categoryBreakdown의 선택적 range 관례와 동일한 모양.
   */
  async sumExpenses(childId: string, range?: { startInclusive: string; endExclusive: string }) {
    const result = await this.prisma.expense.aggregate({
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        ...(range ? { spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) } } : {})
      },
      _sum: { amountKrw: true }
    });
    return result._sum.amountKrw ?? 0;
  }
}
