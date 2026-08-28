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
