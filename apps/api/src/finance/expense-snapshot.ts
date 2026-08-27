import type { Expense as PrismaExpense } from "@prisma/client";

/**
 * Shared, minimal expense row -> wire-shape helpers used by the version/conflict
 * layer (expenses.service.ts) and the delta sync module (../sync). Deliberately
 * kept outside the onboarding store services (whose own
 * `toExpenseDto`/`fromDateOnly` this mirrors) so this Round 5A work never touches
 * that file, which other work in this sprint owns concurrently.
 */

export function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Field set intentionally mirrors store-shared.ts's
 * `toExpenseDto`, plus `version`. Used for the `current` payload of a 409
 * VERSION_CONFLICT response and for delta-sync `upsert` change entries.
 *
 * 라운드 48 QA(P2-6): `paymentMethod`·`linkedItemTemplateId`를 더해 위 "toExpenseDto의 미러"라는
 * 선언을 실제로 지킨다. 두 필드는 라운드 48 T3에서 toExpenseDto에 열렸는데 이 스냅숏에는
 * 반영되지 않아, **같은 지출이 경로에 따라 다른 모양으로** 나갔다.
 *
 * 그 어긋남이 사용자에게 닿던 자리가 409 충돌 화면이다("두 값 나란히 보기",
 * apps/mobile/app/sync-status.tsx). 로컬 대기 행에는 사용자가 고른 결제 수단이 있는데 서버
 * 스냅숏에는 그 키가 아예 없으니, 두 값이 늘 다른 것으로 잡혀 **바꾼 적 없는 결제 수단이 매번
 * 충돌 항목으로 뜨고** 서버 쪽 값은 "없음"으로 그려졌다 — 서버가 실제로 들고 있는 값을 두고
 * 없다고 말하는 허위 표시이고, 그걸 보고 "다른 기기 값"을 고르면 멀쩡한 값을 지우게 된다.
 *
 * `linkedItemTemplateId`는 충돌 **판정** 대상이 아니다 — 모바일 `diffExpenseFields`의 표시 집합에
 * 없고(사용자가 충돌 화면에서 고를 수 있는 값이 아니다), 모바일 어댑터도 이 키를 충돌 스냅숏으로
 * 옮기지 않는다(apps/mobile/src/offline/remote-api.ts `toEngineConflictSnapshot`). 그래도 여기서
 * 함께 싣는 이유는 이 함수의 다른 소비자인 **델타 동기화의 upsert 엔트리** 때문이다: 같은 지출이
 * 목록 응답에는 연결을 달고 오고 델타에는 달지 않고 오면, 어느 경로로 캐시가 채워졌느냐에 따라
 * 지출 상세의 "연결된 준비템" 행이 있다 없다 한다.
 */
export function toExpenseSnapshot(expense: PrismaExpense) {
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
    expenseType: expense.expenseType,
    source: expense.source,
    createdByUserId: expense.createdByUserId,
    version: expense.version
  };
}

export function toDeletedExpenseSnapshot(expense: Pick<PrismaExpense, "id" | "version">) {
  return { id: expense.id, deleted: true as const, version: expense.version };
}
