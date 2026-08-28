import { formatKrw } from "../money";
import { formatSpentOn } from "../expenses/records-list-view";

/**
 * 라운드 49 C-04: 준비템 상세의 **역링크** — "이 준비템으로 기록한 지출".
 *
 * 지금까지 연결은 한 방향으로만 보였다. 지출 기록 화면에서 준비템을 고르면 서버가
 * `child_item_statuses.expense_id`에 그 지출을 박고 준비 상태를 준비 완료로 올리는데
 * (apps/api/src/onboarding/store-shared.ts markLinkedItemPrepared), 그 반대편인 준비템
 * 상세에는 "얼마를 언제 썼는지"가 어디에도 없었다. 핵심 루프의 마지막 칸("구매 후
 * 기록/상태 체크")에서 사용자가 확인할 수 있는 것은 준비 완료 배지뿐이라, **기록이
 * 실제로 남았는지**는 지출 탭까지 가야 알 수 있었다.
 *
 * ## 정직성 규칙
 * - 값은 전부 서버 응답 그대로다. 금액은 `linkedExpense.amountKrw`, 날짜는 `spentOn` —
 *   가격대(priceBandText)로 금액을 **추정하지 않는다**(범위라 특정 값을 지어내는 셈이다).
 * - 서버가 삭제된 지출(expenses.deleted_at)을 애초에 싣지 않는다. 그래도 이 모듈은
 *   `linkedExpense`가 null/undefined면 줄을 만들지 않으므로, 구버전 서버 응답(필드 없음)이나
 *   로컬 픽스처에서도 없는 기록을 지어내지 않는다.
 * - 세션 게이트가 여기 있다: 비세션 미리보기(ITEM-002 픽셀 락 캡처)는 기록할 대상도 볼
 *   기록도 없고, 캡처에 줄이 한 줄 더 들어가면 기준 이미지와 어긋난다. 화면이 아니라
 *   모듈이 판정을 들고 있어야 두 조건이 갈라지지 않는다(item-trust-notes.ts와 같은 관례).
 *
 * ## 표기
 * 금액은 `formatKrw`("38,500원"), 날짜는 `formatSpentOn`("8월 27일) — 둘 다 기록 탭/홈이
 * 쓰는 그 함수다. 같은 지출이 화면마다 다른 모양으로 보이지 않게 하기 위해 새 포맷터를
 * 만들지 않는다.
 */
export type LinkedExpenseSummary = {
  id: string;
  amountKrw: number;
  spentOn: string;
};

export type LinkedExpenseRow = {
  /** 지출 상세로 가는 경로. 세션 화면에서만 쓰인다. */
  href: string;
  /** 눈에 보이는 한 줄. */
  text: string;
  /** 스크린 리더 문장 — 링크만 따로 읽혀도 무엇으로 가는 줄인지 알 수 있게 한다. */
  accessibilityLabel: string;
};

/** 줄 앞머리 문구. 화면과 테스트가 같은 문자열을 본다. */
export const LINKED_EXPENSE_ROW_PREFIX = "이 준비템으로 기록한 지출";

export function linkedExpenseRow(input: {
  hasSession: boolean;
  linkedExpense: LinkedExpenseSummary | null | undefined;
}): LinkedExpenseRow | null {
  if (!input.hasSession) return null;
  const expense = input.linkedExpense;
  if (!expense || !expense.id) return null;

  const amountText = formatKrw(expense.amountKrw);
  const dateText = formatSpentOn(expense.spentOn);
  return {
    href: `/expenses/${expense.id}`,
    text: `${LINKED_EXPENSE_ROW_PREFIX}: ${amountText} · ${dateText}`,
    accessibilityLabel: `${LINKED_EXPENSE_ROW_PREFIX} ${amountText}, ${dateText}. 지출 상세 보기`
  };
}
