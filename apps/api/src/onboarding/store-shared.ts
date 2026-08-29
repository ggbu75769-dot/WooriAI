import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  assertMoneyKrw,
  calculateChildStage,
  getSeoulMonthRange,
  getSeoulToday,
  isBeforeEntryDateFloor,
  isFutureSeoulDate,
  isValidCalendarDate,
  ENTRY_DATE_MAX_PAST_YEARS,
  type ChildStageCode,
  type ChildStageMode,
  type ExpenseSource,
  type ExpenseType,
  type ItemStatus,
  type MemberRole,
  type PaymentMethod
} from "@wooriai/domain";
import type { AuthenticatedUser } from "../common/types/authenticated-request";

/**
 * REF-118: shared row types, DTO mappers and validation helpers split out of the
 * former onboarding-store.service.ts god service. Everything here is pure
 * (no Prisma access, no DI) and is consumed by the decomposed store services:
 * onboarding-core, expenses-store, items-catalog, import-pipeline,
 * reporting-store (all in this directory).
 *
 * R19-B 예외 1건: `markLinkedItemPrepared`만 순수 함수가 아니다 — 호출자가 넘긴
 * DbClient로 child_item_statuses에 쓴다 (DI는 여전히 없다). 여기 두는
 * 이유는 순환 의존 때문이다: ItemsCatalogService가 이미 ExpensesStoreService를
 * 주입하고 있어(updateItemStatus의 expenseId 검증), 반대로 expenses-store가
 * items-catalog를 주입하면 DI 사이클이 된다. 그래서 "지출↔준비템 상태" 규칙을
 * 양쪽이 공유할 수 있는 이 모듈의 공용 함수로 뽑았다.
 */

export type DbClient = Prisma.TransactionClient;

export type ChildRow = {
  id: string;
  householdId: string;
  nickname: string;
  stageMode: ChildStageMode;
  dueDate: Date | null;
  birthDate: Date | null;
  manualStage: ChildStageCode | null;
  preparedItemsSetAt: Date | null;
  deletedAt: Date | null;
};

export type ExpenseRow = {
  id: string;
  childId: string;
  householdId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: Date;
  itemName: string;
  merchant: string | null;
  paymentMethod: PaymentMethod;
  memo: string | null;
  linkedItemTemplateId: string | null;
  linkedProductLinkId: string | null;
  expenseType: ExpenseType;
  source: ExpenseSource;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export function memberRoleFor(user: AuthenticatedUser, householdId: string): MemberRole | null {
  return user.households.find((household) => household.id === householdId)?.role ?? null;
}

export function canEdit(role: MemberRole | null) {
  return role === "owner" || role === "co_parent";
}

export function toDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly.slice(0, 10)}T00:00:00.000Z`);
}

export function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toChildDto(child: ChildRow) {
  const today = process.env.WOORIAI_STAGE_TODAY;
  const calculated =
    child.stageMode === "pregnant"
      ? calculateChildStage({ stageMode: "pregnant", dueDate: fromDateOnly(child.dueDate!), today })
      : child.stageMode === "born"
        ? calculateChildStage({ stageMode: "born", birthDate: fromDateOnly(child.birthDate!), today })
        : calculateChildStage({ stageMode: "manual", manualStage: child.manualStage!, today });

  return {
    id: child.id,
    householdId: child.householdId,
    nickname: child.nickname,
    stageMode: child.stageMode,
    dueDate: child.dueDate ? fromDateOnly(child.dueDate) : null,
    birthDate: child.birthDate ? fromDateOnly(child.birthDate) : null,
    manualStage: child.manualStage ?? null,
    currentStage: calculated.stageCode,
    stageLabel: calculated.stageLabel
  };
}

export type ChildDto = ReturnType<typeof toChildDto>;

/**
 * 라운드 48 T3: `paymentMethod`·`linkedItemTemplateId`는 **쓰기 전용 필드**였다 — 입력
 * 화면(apps/mobile/app/expenses/new.tsx)과 준비템 연결 경로가 저장은 하는데(insertExpense)
 * 어떤 응답에도 실리지 않아 사용자가 자기가 고른 값을 다시 볼 방법이 없었다. 둘 다
 * **additive**라 구 클라이언트는 그대로 동작한다(CAT-124 `selectable` 관례와 같다).
 *
 * ⚠️ 페이로드 크기(PERF-121): 이 DTO 하나가 홈(recentExpenses) · 목록 · 동기화 응답을 함께
 * 먹인다. 그래서 필드를 **스칼라 두 개**만 늘린다 — 준비템 이름/상태 같은 조인 값을 여기에
 * 얹으면 목록 한 페이지(최대 500건)마다 조인이 따라붙는다. 준비템 이름이 필요한 화면은
 * 이미 있는 `GET /children/:childId/items/:itemTemplateId`로 따로 물어본다.
 *
 * 라운드 49 C-06: `linkedProductLinkId`가 더 이상 다크 필드가 아니다 — "샀어요"(구매 확인
 * 카드)에서 이어지는 생성 경로가 클릭한 제휴 링크의 id를 실어 보내고 insertExpense가 그것을
 * 저장한다. 저장한 값은 되읽을 수 있어야 하므로(라운드 48 T3이 결제 수단·연결 준비템에서
 * 세운 것과 같은 규칙: **쓰기 전용 필드를 만들지 않는다**) 여기서 함께 노출한다. 값이 없는
 * 기록에서는 null이고, 그 자리에 아무 화면도 그리지 않는다.
 *
 * ⚠️ DNC-009: 이 필드는 **기록·정산용**이다. 어떤 링크로 샀는지를 남길 뿐이고,
 * 추천 점수·정렬(apps/mobile/src/items/item-ranking.ts)에 절대 유입되면 안 된다 —
 * 수수료율이 추천 순서를 바꾸는 순간 사용자에게 보이는 순위가 거짓이 된다. 이 값을
 * 읽는 코드를 추가할 때 그 경로가 랭킹으로 이어지지 않는지 먼저 확인할 것.
 *
 * ⚠️ 스칼라 한 개 추가라 위 PERF-121 규칙(조인 금지)은 그대로 지켜진다. 제휴 링크의
 * URL·플랫폼·수수료 같은 값은 여기에 얹지 않는다.
 */
export function toExpenseDto(expense: ExpenseRow) {
  return {
    id: expense.id,
    childId: expense.childId,
    categoryId: expense.categoryId,
    amountKrw: expense.amountKrw,
    spentOn: fromDateOnly(expense.spentOn),
    itemName: expense.itemName,
    merchant: expense.merchant ?? null,
    paymentMethod: expense.paymentMethod,
    memo: expense.memo ?? null,
    linkedItemTemplateId: expense.linkedItemTemplateId ?? null,
    linkedProductLinkId: expense.linkedProductLinkId ?? null,
    expenseType: expense.expenseType,
    source: expense.source,
    createdByUserId: expense.createdByUserId
  };
}

/** Pure DTO assembly shared by OnboardingCore's toBudgetDto and ReportingStore's getHome
 *  (PERF-103), so getHome can fetch usedAmountKrw inside its Promise.all without changing
 *  the response shape. */
export function buildBudgetDto(childId: string, yearMonth: string, amountKrw: number, usedAmountKrw: number) {
  return {
    childId,
    yearMonth,
    amountKrw,
    usedAmountKrw,
    remainingAmountKrw: amountKrw - usedAmountKrw
  };
}

export function currentYearMonth() {
  return getSeoulMonthRange(process.env.WOORIAI_STAGE_TODAY ?? getSeoulToday()).yearMonth;
}

export function currentYear() {
  return currentYearMonth().slice(0, 4);
}

export function referenceNow() {
  return process.env.WOORIAI_STAGE_TODAY
    ? new Date(`${process.env.WOORIAI_STAGE_TODAY}T00:00:00+09:00`)
    : new Date();
}

/**
 * 라운드 68 A — 지출 발생일의 **과거 하한**(20년). 라운드 67 B가 예정일에 세운
 * `assertDueDateWithinFullTerm`과 **같은 형식·같은 기준 시각**(`referenceNow()`)이다.
 *
 * 없던 규칙이다. 이 층이 보던 것은 형식·실존 달력·미래 금지 셋뿐이었고(`assertNotFutureDate` —
 * 이름이 곧 범위였다), 그래서 `2026-08-14`를 `2016-08-14`로 한 자리 잘못 친 지출이 그대로
 * 저장됐다. 그 지출은 **누적 총액에는 들어가는데**(전 기간 서버 집계 — reporting-store.service.ts)
 * 앱의 읽는 쪽 넷이 전부 20년에서 잠겨 있어 어느 화면에서도 그 달을 열 수 없다: 총액은 늘었는데
 * 그 금액이 어느 달에 있는지 물어볼 자리가 없고, 지우려 해도 도달할 수 없다.
 *
 * ## 숫자를 짓지 않는다
 * 하한은 도메인의 `ENTRY_DATE_MAX_PAST_MONTHS`(240) 한 곳에만 있고, 앱의 달력 픽커·기록 탭
 * 딥링크가 **같은 그 값**을 읽는다(apps/mobile/src/expenses/import-landing-month.ts). 이 층이
 * 240을 다시 적으면 한쪽만 바뀌는 드리프트가 확정이다(라운드 54 P2-8).
 *
 * ## 하한 당일은 통과시킨다
 * 그 날은 달력 픽커가 고를 수 있게 열어 두는 날이라, 여기서 거절하면 픽커에서 고른 날짜가
 * 저장 직전에 막힌다(라운드 67 B가 만삭 당일에 내린 것과 같은 판단).
 *
 * ## 이미 저장된 값은 고치지 않는다
 * 마이그레이션 0건이다. 지금 하는 일은 **새로 들어오는 값을 막는 것**뿐이고, 표시·회수 판단은
 * 별도 결정이다.
 */
export function assertExpenseDateWithinPastFloor(spentOn: string) {
  if (isBeforeEntryDateFloor(spentOn, referenceNow())) {
    throw new BadRequestException({
      code: "EXPENSE_DATE_TOO_OLD",
      message: `${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 날은 고를 수 없어요.`
    });
  }
}

/**
 * 지출 발생일이 저장 가능한 범위 안인가.
 *
 * 라운드 68 A 메모: 이름은 미래 갈래만 말하지만 이 함수는 이제 **두 경계**를 본다(위쪽 = 미래
 * 금지, 아래쪽 = 20년 하한). 이름을 범위에 맞게 바꾸려면 이 트랙이 소유하지 않은 호출부
 * (expenses-store.service.ts의 생성·수정 두 자리)를 함께 고쳐야 해서 다음 라운드로 미룬다 —
 * 대신 하한 판정을 `assertExpenseDateWithinPastFloor`라는 자기 이름으로 바로 위에 세워 두고
 * 여기서 부른다. 이 한 자리를 지나면 **쓰는 경로 셋이 모두** 하한을 갖는다: 지출 생성 · 지출
 * 수정 · 엑셀 가져오기 행 판정(import-pipeline.service.ts의 `validationStatusForImportRow`가
 * 이 함수를 부르고, 그 행은 `invalid_date`가 되어 미리보기에서 사유를 달고 `selected`에서
 * 빠진다 — DNC-012 "승인 전에는 저장하지 않는다").
 */
export function assertNotFutureDate(spentOn: string) {
  if (!isValidCalendarDate(spentOn)) {
    throw new BadRequestException({ code: "EXPENSE_DATE_INVALID", message: "날짜를 다시 확인해 주세요." });
  }

  try {
    if (isFutureSeoulDate(spentOn, referenceNow())) {
      throw new BadRequestException({ code: "EXPENSE_FUTURE_DATE", message: "미래 날짜의 지출은 저장할 수 없어요." });
    }
    assertExpenseDateWithinPastFloor(spentOn);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({ code: "EXPENSE_DATE_INVALID", message: "날짜를 다시 확인해 주세요." });
  }
}

export function requireMoneyKrw(value: unknown) {
  try {
    return assertMoneyKrw(value);
  } catch {
    throw new BadRequestException({ code: "EXPENSE_AMOUNT_INVALID", message: "금액은 0보다 큰 원화 정수만 입력할 수 있어요." });
  }
}

export function cleanOptionalText(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

/**
 * 사용자가 스스로 "이미 해결됐다"고 고른 상태들 — 지출 기록이 덮어쓰면 안 된다.
 * `gifted`(선물로 받음)와 `not_needed`(안 살래요)는 둘 다 "이 준비템은 더 이상
 * 사야 할 대상이 아니다"라는 사용자 판단이고, 연결된 지출이 하나 생겼다고 해서
 * 그 판단을 `prepared`로 바꿔 쓰는 것은 사용자 입력을 임의로 고쳐 쓰는 것이다
 * (예: 선물로 받은 유모차의 부속품 지출을 남겨도 "선물로 받음"은 유지돼야 한다).
 * `not_prepared`/`interested`/미존재는 아직 아무 판단이 없는 상태라 자동 표시 대상.
 */
const RESOLVED_ITEM_STATUSES: ReadonlySet<ItemStatus> = new Set<ItemStatus>(["gifted", "not_needed"]);

export type MarkLinkedItemPreparedResult = "marked" | "linked" | "preserved";

/**
 * R19-B / DNC-002 핵심 루프의 마지막 고리: "구매 후 기록 → 준비템 상태 체크".
 * `linkedItemTemplateId`가 붙은 지출이 생기면 그 준비템을 자동으로 `prepared`로
 * 올린다 — 지출을 남겼는데도 준비템이 영원히 미준비로 남아 ITEM-114 준비율이
 * 정체되던 문제(정찰 발견 2)를 없앤다.
 *
 * 규칙
 * - 상태 행이 없거나 `not_prepared`/`interested`면 `prepared`로 올리고 expenseId를 연결한다.
 * - 이미 `gifted`/`not_needed`면 **아무것도 하지 않는다** (RESOLVED_ITEM_STATUSES 주석 참고).
 * - 이미 `prepared`면 상태는 그대로 두고, 연결된 지출이 없을 때만 expenseId를 채운다
 *   (먼저 연결된 지출 기록을 나중 지출이 밀어내지 않도록 — 최초 연결을 보존).
 * - 지출 삭제 시 되돌리지 않는다 (deleteExpense 주석 참고).
 * - 보존 규칙은 **원자적**이다 (FIX-119A/M-2): 아래 findUnique는 빠른 경로일 뿐이고,
 *   실제 쓰기는 gifted/not_needed 행을 건드리지 않는 조건부 문이라 읽기와 쓰기
 *   사이에 다른 트랜잭션이 gifted/not_needed를 커밋해도 덮어쓰지 않는다.
 * - 지출 종류(expense/gift)는 구분하지 않고 항상 `prepared`다. `gifted`는 사용자가
 *   직접 고르는 상태이지 자동 부여 대상이 아니고, 준비템 `prepared` 탭과 준비율이
 *   읽는 상태가 `prepared`이기 때문이다.
 *
 * ⚠️ 접근검증은 하지 않는다 — 호출자(insertExpense)가 이미 통과시킨 childId/지출에
 * 대해서만 호출된다. itemTemplateId 존재 여부도 호출자가 먼저 검증한다.
 */
export async function markLinkedItemPrepared(
  client: DbClient,
  params: { childId: string; itemTemplateId: string; userId: string; expenseId: string }
): Promise<MarkLinkedItemPreparedResult> {
  const { childId, itemTemplateId, userId, expenseId } = params;
  const existing = await client.childItemStatus.findUnique({
    where: { childId_itemTemplateId: { childId, itemTemplateId } },
    select: { status: true, expenseId: true }
  });

  if (existing && RESOLVED_ITEM_STATUSES.has(existing.status)) {
    return "preserved";
  }

  if (existing?.status === "prepared") {
    if (existing.expenseId) return "preserved";
    // FIX-119A(M-2): 조건부 update. findUnique 이후 다른 트랜잭션이 이 행을
    // gifted/not_needed로 바꿨거나 이미 다른 지출을 연결했다면 아무것도 쓰지
    // 않는다(0행 매치 → "preserved"). 무조건 update였다면 사용자가 방금 고른
    // "선물로 받음"에 지출을 덧씌우게 된다.
    const linked = await client.childItemStatus.updateMany({
      where: { childId, itemTemplateId, status: "prepared", expenseId: null },
      data: { expenseId, updatedByUserId: userId }
    });
    return linked.count > 0 ? "linked" : "preserved";
  }

  // FIX-119A(M-2): 단일 원자 문(INSERT ... ON CONFLICT DO UPDATE ... WHERE)으로 쓴다.
  //
  // 이전에는 Prisma upsert의 update 절이 무조건 status='prepared'였다. 위
  // findUnique를 통과한 뒤(행 없음/not_prepared/interested) 커밋된 다른
  // 트랜잭션이 같은 (childId, itemTemplateId)를 gifted/not_needed로 만들면,
  // 충돌을 흡수한 update가 그 사용자 판단을 prepared로 덮어썼다 — 보존 규칙이
  // 읽기-후-쓰기 사이의 창에서 깨진다(RESOLVED_ITEM_STATUSES 주석 참고).
  //
  // DO UPDATE에 WHERE를 달면 보존 규칙이 **쓰기 시점의 행 상태**로 원자적으로
  // 판정된다: 충돌 상대가 gifted/not_needed면 갱신도 반환도 없고(→"preserved"),
  // 그 외(또는 신규 삽입)면 갱신된다(→"marked"). 유니크 위반 예외가 아니라
  // ON CONFLICT로 흡수하므로 트랜잭션 중단(P2002 → tx abort) 위험도 없다.
  // updated_at은 @updatedAt(Prisma 애플리케이션 레벨)이라 raw 경로에서 직접 찍는다.
  const written = await client.$queryRaw<{ id: string }[]>`
    INSERT INTO child_item_statuses (child_id, item_template_id, status, expense_id, updated_by_user_id)
    VALUES (${childId}::uuid, ${itemTemplateId}::uuid, 'prepared'::item_status, ${expenseId}::uuid, ${userId}::uuid)
    ON CONFLICT (child_id, item_template_id) DO UPDATE
      SET status = 'prepared'::item_status,
          expense_id = EXCLUDED.expense_id,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = now()
      WHERE child_item_statuses.status::text <> ALL (${[...RESOLVED_ITEM_STATUSES]}::text[])
    RETURNING id
  `;
  return written.length > 0 ? "marked" : "preserved";
}
