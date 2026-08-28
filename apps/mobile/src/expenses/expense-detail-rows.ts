/**
 * 라운드 48 T3 — 지출 상세(app/expenses/[expenseId].tsx)의 **읽기 전용 행** 단일 소스.
 *
 * 왜 생겼나: `paymentMethod`와 `linkedItemTemplateId`는 오랫동안 **쓰기 전용 필드**였다.
 * 빠른 기록 시트(app/expenses/new.tsx)는 결제 수단을 골라 저장했고 준비템 상세는 지출에
 * 준비템을 연결해 저장했는데, 서버 DTO(apps/api/src/onboarding/store-shared.ts
 * `toExpenseDto`)가 둘 다 싣지 않아 **사용자가 자기가 고른 값을 다시 볼 방법이 아예
 * 없었다**. 서버가 두 필드를 additive로 열었으므로(라운드 48 T3), 이 모듈이 그 값을
 * 화면 문구로 옮기는 규칙을 한 곳에 모은다.
 *
 * 규칙(이 파일의 다른 순수 모듈들과 같은 관례):
 *  - **값이 없으면 행 자체가 없다.** 빈 자리표시자("-", "미지정")를 만들지 않는다
 *    (src/expenses/expense-source-line.ts · records-list-view.ts의 작성자 라벨과 같은 판단).
 *  - **모르는 값은 지어내지 않고 원본을 통과시킨다** — `sourceLabelKo`/`expenseTypeLabelKo`가
 *    쓰는 관례 그대로다. 서버가 결제 수단을 하나 더 늘렸을 때 그것을 "카드"로 둔갑시키는
 *    것이 낯선 코드를 그대로 보여주는 것보다 나쁘다.
 *  - 결제 수단 라벨 문구는 **입력 화면과 한 글자도 다르면 안 된다**. 사용자가 "계좌 이체"로
 *    고른 값이 상세에서 "이체"로 보이면 같은 값이 두 이름을 갖는다. 그래서 매핑을 화면이
 *    아니라 이 모듈에 두고, 아래 테스트(expense-detail-rows.test.ts)가 입력 화면
 *    (app/expenses/new.tsx의 `quickExpensePaymentMethods`)의 리터럴과 대조해 드리프트를 막는다.
 *    입력 화면은 EXP-001 픽셀 락 캡처 경로다. 라운드 49에서 그 화면에 판매처 입력칸을 더할
 *    때도 **세션이 있을 때만 렌더되는 자리**(authToken 게이트 뒤)에만 손을 댔다 — 비세션
 *    초기 렌더는 한 픽셀도 바뀌지 않는다.
 *
 * CSV 내보내기(src/export/expense-csv.ts)도 `paymentMethodLabelKo`를 여기서 가져다 쓴다 --
 * 앱에서 "모바일 결제"로 읽은 값이 엑셀에서 다른 단어로 보이면 안 된다는, CSV-127이
 * 구분(`expenseTypeLabelKo`) 열에서 이미 세운 것과 같은 규칙이다.
 */

import { expenseTypeLabelKo } from "./records-list-view";

/** 상세 화면의 "결제 수단" 행 라벨. */
export const PAYMENT_METHOD_ROW_LABEL = "결제 수단";
/** 상세 화면의 "판매처" 행 라벨 — CSV의 같은 열 이름과 한 단어를 쓴다. */
export const MERCHANT_ROW_LABEL = "판매처";
/** 상세 화면의 "연결된 준비템" 행 라벨. */
export const LINKED_ITEM_ROW_LABEL = "연결된 준비템";
/**
 * 그 행의 링크 문구. **품목 이름을 쓰지 않는다** — 지출 응답에는 준비템 이름이 없고,
 * 이름 한 줄을 위해 상세 화면이 요청을 하나 더 쏘게 만들 이유도 없다. 이름을 모르는 채
 * 그럴듯한 이름을 적는 것은 허위 표시라, "무엇을 볼 수 있는지"만 말한다.
 */
export const LINKED_ITEM_LINK_LABEL = "연결된 준비템 보기";

/**
 * 결제 수단 코드 → 한국어 라벨. 키/문구는 app/expenses/new.tsx의
 * `quickExpensePaymentMethods`와 **같은 값**이다(위 드리프트 주석 참고).
 * `unknown`은 "사용자가 고르지 않았다"는 뜻이므로 여기에 없다 — 아래에서 null이 된다.
 */
export const PAYMENT_METHOD_LABELS_KO = {
  card: "카드",
  cash: "현금",
  transfer: "계좌 이체",
  mobile_pay: "모바일 결제"
} as const;

/**
 * 표시할 결제 수단 문구, 또는 표시하지 않을 때 `null`.
 *
 * `null`이 되는 경우: 값 없음(구 서버 응답 · 로컬 목업 · 오프라인 대기 행), 빈 문자열,
 * 그리고 `"unknown"` — 서버 기본값이라 "결제 수단: 알 수 없음"이라고 적으면 사용자가
 * 고르지도 않은 항목을 화면이 굳이 말하는 셈이 된다.
 */
export function paymentMethodLabelKo(paymentMethod?: string | null): string | null {
  const code = typeof paymentMethod === "string" ? paymentMethod.trim() : "";
  if (code.length === 0 || code === "unknown") return null;
  return PAYMENT_METHOD_LABELS_KO[code as keyof typeof PAYMENT_METHOD_LABELS_KO] ?? code;
}

export type LinkedItemTemplateLink = {
  /** 눌러서 이동하는 행에 그릴 문구(= 접근성 라벨). */
  label: string;
  /** expo-router 경로 — app/items/[itemTemplateId].tsx. */
  href: `/items/${string}`;
};

/**
 * 이 링크가 어느 아이의 맥락에서 눌리는지 — 라운드 49 C-05.
 *
 * `expenseChildId`는 **이 지출이 속한 아이**(지출 응답이 항상 싣는 값이고, 상세 화면이 이미
 * 다른 용도로 읽고 있다), `selectedChildId`는 **지금 앱에서 선택된 아이**다.
 */
export type LinkedItemScope = {
  expenseChildId?: string | null;
  selectedChildId?: string | null;
};

/**
 * "연결된 준비템 보기" 링크, 또는 링크를 만들지 않을 때 `null`.
 *
 * 목적지(app/items/[itemTemplateId].tsx)는 경로의 childId가 아니라 **전역으로 선택된 아이**
 * (`useSelectedChildStore`)로 상세를 부른다 — 기록 탭·알림함이 쓰는 것과 같은 `/items/{id}`
 * 형태라 경로만 보고는 어느 아이인지 알 수 없다.
 *
 * 라운드 49 C-05: 그래서 이 링크는 **아이가 어긋나면 아예 만들지 않는다.** 예전에는 지출이
 * 속한 아이를 보지 않고 링크를 그려서, A의 지출 상세(딥링크·알림함·검색으로 지금 선택된
 * 아이와 무관하게 열릴 수 있다)에서 "연결된 준비템 보기"를 누르면 **B의 준비템 상세**가
 * 열렸다 — 화면은 "이 지출에 연결된 준비템"이라고 말하는데 실제로 보여주는 것은 다른 아이의
 * 준비 상태인, 사실과 다른 안내였다. 형제 판정이 이미 같은 결론을 내고 있다
 * (src/commerce/purchase-followup.store.ts `isFollowupForSelectedChild`,
 * src/items/expense-link-prompt.ts의 `ExpenseLinkPromptScope`).
 *
 * 이 파일의 관례대로 **확실하지 않으면 행을 만들지 않는다**(위 헤더 주석):
 * - 두 아이 id가 다르면 만들지 않는다(위 오연결 그 자체).
 * - 둘 중 하나라도 없으면 만들지 않는다 — 선택된 아이 스토어가 아직 rehydrate 전이거나
 *   지출 응답이 아직 없는 순간이다. 어느 아이로 갈지 모르는 링크를 그려 두느니 잠깐
 *   행이 없는 편이 낫고, 값이 채워지면 화면이 다시 렌더되면서 행이 나타난다. 링크를
 *   누른 김에 선택된 아이를 지출 쪽으로 바꿔 주는 "친절"도 하지 않는다 — 그 한 번의 탭이
 *   앱 전체(홈·기록·리포트)의 아이를 소리 없이 갈아치우기 때문이다.
 *
 * `scope`는 **선택 인자가 아니다**: 빠뜨리면 아이를 보지 않던 예전 동작으로 조용히 되돌아가므로
 * 호출부가 항상 두 값을 함께 넘기도록 타입으로 강제한다(selectPromptEligibleFollowup과 같은 이유).
 */
export function linkedItemTemplateLink(
  linkedItemTemplateId: string | null | undefined,
  scope: LinkedItemScope
): LinkedItemTemplateLink | null {
  const id = typeof linkedItemTemplateId === "string" ? linkedItemTemplateId.trim() : "";
  if (id.length === 0) return null;
  const expenseChildId = typeof scope.expenseChildId === "string" ? scope.expenseChildId.trim() : "";
  const selectedChildId = typeof scope.selectedChildId === "string" ? scope.selectedChildId.trim() : "";
  if (expenseChildId.length === 0 || selectedChildId.length === 0) return null;
  if (expenseChildId !== selectedChildId) return null;
  return { label: LINKED_ITEM_LINK_LABEL, href: `/items/${id}` };
}

// ---------------------------------------------------------------------------
// GAP-054 #1 — 환불 기록이 수정 한 번에 지출로 둔갑하던 자리
// ---------------------------------------------------------------------------

/**
 * 무슨 일이 있었나.
 *
 * 지출 상세(app/expenses/[expenseId].tsx)는 저장 payload의 `expenseType`을 화면 상태 하나로
 * **재구성**했다 — `isGift ? "gift" : "expense"`. 그런데 이 화면의 `isGift`는 응답의
 * `expenseType === "gift"`로만 세팅된다. 원본이 `refund`인 기록을 열면 isGift는 false이고,
 * 메모 한 글자만 고쳐 저장해도 payload에 `"expense"`가 실려 **환불이 지출로 덮였다.**
 *
 * 결과는 조용하고 되돌릴 수 없다: 환불은 월 합계에서 빠지는 구분인데(DNC-015) 지출로 바뀌는
 * 순간 합계가 오염되고, 앱에는 다시 `refund`로 되돌릴 입력 경로가 아예 없다(서버
 * CreateExpenseDto·UpdateExpenseDto 모두 expense|gift만 받는다 — 환불은 엑셀 가져오기·
 * 서버 경로로만 생긴다). 사용자가 화면에서 고른 적 없는 값이 저장되는, 말 그대로 허위 기록이다.
 *
 * 고치는 방법은 "환불을 보낼 수 있게" 하는 것이 아니라 **말하지 않는 것**이다. 서버 PATCH는
 * 부분 갱신이라 키를 빼면 그 필드를 건드리지 않는다(보내지 않은 값은 서버가 그대로 둔다).
 * 오프라인 아웃박스도 같은 규칙을 이미 갖고 있다: `recordLocalUpdate`가 `undefined` 값을
 * 걷어내고(`omitUndefinedValues`), 로컬 payload의 expenseType은 refund 기록에서는 애초에
 * undefined이며(sync-controller의 `adoptServerExpense`가 refund를 undefined로 접는다),
 * `toExpensePatch`가 `undefined`를 실으면 JSON에서 키 자체가 사라진다. 그래서 이 함수가
 * `undefined`를 돌려주는 것만으로 온라인·오프라인 두 경로 모두에서 refund가 보존된다.
 */

/** 원본 구분이 환불인가. 화면은 이 판정 하나로 배지·선물 비활성·payload를 함께 정한다. */
export function isRefundExpenseType(expenseType?: string | null): boolean {
  return expenseType === "refund";
}

/**
 * 상세 화면 상단의 구분 배지 문구, 또는 배지를 달지 않을 때 `null`.
 *
 * **환불에만** 붙인다. 기본값인 "지출"은 거의 모든 기록에 같은 단어를 붙이는 소음이고,
 * "선물"은 바로 아래 체크박스가 이미 켜진 상태로 말하고 있다 — 같은 사실을 두 번 적지 않는다
 * (기록 목록 행 부제가 `expenseTypeSubtitlePrefix`로 내린 것과 같은 판단). 환불만 예외인
 * 이유는 이 화면에 그 사실을 말하는 다른 자리가 하나도 없기 때문이다.
 *
 * 문구는 지어내지 않고 기존 단일 소스(`expenseTypeLabelKo`)에서 가져온다 — 기록 탭·CSV의
 * 구분 열에서 "환불"로 읽은 값이 여기서만 다른 단어가 되지 않게.
 */
export function expenseTypeBadgeLabel(expenseType?: string | null): string | null {
  return isRefundExpenseType(expenseType) ? expenseTypeLabelKo("refund") : null;
}

/** 배지 옆 한 줄 — 저장해도 구분이 유지된다는 사실만 말한다(해요체, DNC-018). */
export const REFUND_BADGE_NOTICE = "환불로 기록된 내역이에요. 수정해도 환불로 남아요.";

/**
 * 환불 기록에서 선물 체크박스를 **비활성으로** 두는 이유 한 줄.
 *
 * 환불이면서 선물인 기록은 서버에도 존재할 수 없다(`expense_type`은 셋 중 하나다). 체크박스를
 * 열어 두면 사용자가 켤 수는 있는데 저장은 위 규칙대로 expenseType을 보내지 않으므로 아무 일도
 * 일어나지 않는다 — 그 조용한 무시가 이 티켓이 고치려는 바로 그 종류의 거짓말이다. 그래서
 * 누를 수 없게 만들고, 왜 누를 수 없는지를 함께 적는다.
 */
export const REFUND_GIFT_DISABLED_REASON = "환불 기록은 선물로 바꿀 수 없어요.";

/**
 * 저장 payload에 실을 `expenseType`, 또는 **키를 싣지 않을 때** `undefined`.
 *
 * - 원본이 refund: `undefined` — 위 주석대로 서버·아웃박스 양쪽에서 키가 사라져 환불이 남는다.
 * - 그 밖(gift/expense/값 없음): 종전 그대로 체크박스 상태를 그대로 보낸다. 지출↔선물 토글은
 *   이 화면의 정상 동작이고 한 글자도 바뀌지 않는다.
 */
export function expenseTypeForPatch(
  originalExpenseType: string | null | undefined,
  isGift: boolean
): "gift" | "expense" | undefined {
  if (isRefundExpenseType(originalExpenseType)) return undefined;
  return isGift ? "gift" : "expense";
}

// ---------------------------------------------------------------------------
// GAP-054 #10 — 결제 수단이 읽기 전용이던 자리
// ---------------------------------------------------------------------------

/**
 * 서버 `UpdateExpenseDto`는 라운드 48 QA(P2-6)부터 `paymentMethod`를 받는다. 그런데 상세
 * 화면은 그 값을 **읽기만** 했다 — 빠른 기록 시트에서 잘못 고른 결제 수단을 앱 안에서 고칠
 * 방법이 없어, CSV 내보내기·가져오기 왕복이 유일한 수정 경로였다(판매처가 라운드 49 C-03에서
 * 정확히 같은 이유로 입력칸이 된 것과 같은 구멍이다).
 *
 * 선택지·문구는 새로 만들지 않는다: 빠른 기록 시트가 고르게 하는 네 가지
 * (`PAYMENT_METHOD_LABELS_KO`, 위 드리프트 가드가 대조한다)를 그대로 순환한다. `unknown`은
 * 목록에 넣지 않는다 — "고르지 않았다"는 서버 기본값이지 사용자가 고를 수 있는 선택지가
 * 아니고(그래서 `paymentMethodLabelKo`가 null을 돌려준다), 목록에 넣으면 이미 고른 값을 다시
 * "안 고름"으로 되돌리는 뜻 없는 상태가 생긴다.
 */
export const EDITABLE_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS_KO) as (keyof typeof PAYMENT_METHOD_LABELS_KO)[];

/** 아직 고르지 않은 기록(`unknown`·값 없음)의 컨트롤 문구 — 없는 값을 지어내지 않는다. */
export const PAYMENT_METHOD_UNSET_LABEL = "고르지 않았어요";

/** 순환 컨트롤의 접근성 라벨 — 빠른 기록 시트의 같은 컨트롤과 한 글자도 다르지 않다. */
export const PAYMENT_METHOD_CHANGE_LABEL = "결제 수단 변경";

/** 컨트롤에 그릴 현재 문구. 고른 적 없으면 위 문구로, 고른 값이면 그 라벨로. */
export function paymentMethodControlLabel(paymentMethod?: string | null): string {
  return paymentMethodLabelKo(paymentMethod) ?? PAYMENT_METHOD_UNSET_LABEL;
}

/**
 * "결제 수단 변경"을 한 번 눌렀을 때의 다음 값 — 빠른 기록 시트의 순환 컨트롤과 같은 관례다.
 *
 * 고른 적 없는 기록(`unknown`·값 없음·모르는 코드)에서는 목록의 **첫 값**으로 들어간다.
 * 되돌아갈 자리가 없다는 뜻이기도 하다: 한 번 고르고 나면 "안 고름"으로는 돌아갈 수 없는데,
 * 그것이 사실에 맞다 — 사용자가 실제로 골랐기 때문이다.
 */
export function nextPaymentMethod(current?: string | null): keyof typeof PAYMENT_METHOD_LABELS_KO {
  const index = EDITABLE_PAYMENT_METHODS.indexOf(current as keyof typeof PAYMENT_METHOD_LABELS_KO);
  if (index < 0) return EDITABLE_PAYMENT_METHODS[0];
  return EDITABLE_PAYMENT_METHODS[(index + 1) % EDITABLE_PAYMENT_METHODS.length];
}

/**
 * 저장 payload에 실을 `paymentMethod`, 또는 키를 싣지 않을 때 `undefined`.
 *
 * 화면이 한 번도 결제 수단을 건드리지 않았고 원본도 고른 적이 없으면(`unknown`·값 없음)
 * **키를 싣지 않는다** — 서버 기본값을 굳이 다시 써 넣을 이유가 없고, 오프라인 로컬 payload에
 * 없던 키를 만들면 충돌 화면이 "바꾼 적 없는 결제 수단"을 비교 항목으로 띄우기 때문이다
 * (라운드 48 QA(P2-6)가 `toEngineConflictSnapshot`에서 내린 것과 같은 판단).
 *
 * **모르는 코드도 싣지 않는다.** 서버가 결제 수단을 하나 더 늘려 이 앱이 모르는 값을 내려보낸
 * 기록에서 사용자가 결제 수단을 건드리지 않았다면, 그 값을 그대로 되돌려 보내는 것보다 키를
 * 빼서 서버 값을 그대로 두는 편이 안전하다(보내면 서버 `@IsIn` 검증에 걸려 저장 전체가 400이
 * 된다 — 결제 수단과 무관한 수정까지 함께 실패한다). 사용자가 컨트롤을 눌러 고른 값은 항상
 * 이 네 가지 중 하나이므로 편집 경로는 영향을 받지 않는다.
 */
export function paymentMethodForPatch(
  selected?: string | null
): keyof typeof PAYMENT_METHOD_LABELS_KO | undefined {
  const code = typeof selected === "string" ? selected.trim() : "";
  return EDITABLE_PAYMENT_METHODS.includes(code as keyof typeof PAYMENT_METHOD_LABELS_KO)
    ? (code as keyof typeof PAYMENT_METHOD_LABELS_KO)
    : undefined;
}
