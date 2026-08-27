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
 *    입력 화면 자체는 EXP-001 픽셀 락 캡처 경로라 이번 라운드에서 건드리지 않는다.
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
 * "연결된 준비템 보기" 링크, 또는 연결이 없을 때 `null`.
 *
 * 준비템 상세는 자기 화면에서 선택된 아이(`useSelectedChildStore`)로 상세를 부르므로
 * 경로에 childId를 실을 필요가 없다 — 기록 탭·알림함이 쓰는 것과 같은 `/items/{id}` 형태다.
 */
export function linkedItemTemplateLink(linkedItemTemplateId?: string | null): LinkedItemTemplateLink | null {
  const id = typeof linkedItemTemplateId === "string" ? linkedItemTemplateId.trim() : "";
  if (id.length === 0) return null;
  return { label: LINKED_ITEM_LINK_LABEL, href: `/items/${id}` };
}
