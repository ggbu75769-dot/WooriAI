/**
 * 라운드 41 UX-U(B-ⓐ) — 지출 상세(app/expenses/[expenseId].tsx)에 붙는 "어떻게 남은 기록인가"
 * 한 줄의 문구.
 *
 * 배경: 상세 화면은 `Expense.source`("manual" | "excel_import" | "purchase_followup" | "admin",
 * src/api/client.ts)를 이미 응답으로 받고도 쓰지 않았다. 그래서 엑셀로 한꺼번에 들여온 기록과
 * 손으로 적은 기록이 화면에서 똑같이 보였고, 사용자가 "내가 이걸 언제 적었지?" 하고 기억을
 * 뒤지게 만들었다(특히 임포트 직후 금액/분류가 낯설게 보이는 행에서).
 *
 * 표기 규칙:
 *  - 손으로 적은 기록("manual")에는 **아무 말도 하지 않는다**. 그게 기본값이라 한 줄을 붙여 봐야
 *    알려 주는 것이 없고, 모든 화면에 상시 한 줄이 늘어날 뿐이다.
 *  - 모르는 값(계약에 없는 새 source, 값 없음)에도 아무 말도 하지 않는다 — 지어낸 설명을 사실처럼
 *    적는 것보다 낫다(CLAUDE.md 허위 데이터 표시 금지).
 *  - "admin"은 운영자가 대신 손댄 기록이라는 뜻인데, 사용자가 읽는 화면에서 그 사실을 어떤 말로
 *    옮겨야 정확한지 이 트랙이 정할 수 없다. 그래서 지금은 침묵한다 — 문구가 정해지면 여기 한
 *    곳만 고치면 된다.
 *
 * 화면은 이 값을 FAM-127의 "기록한 사람" 줄과 **같은 라벨/값 구조**로 그린다(새 표기 관례를
 * 만들지 않는다). React/react-native에 의존하지 않으므로 vitest에서 그대로 단위 테스트한다.
 */

/** 읽기 전용 한 줄의 라벨 — "기록한 사람" 줄과 같은 자리, 같은 caption 스타일이다. */
export const EXPENSE_SOURCE_LINE_LABEL = "기록 방식";

/** 이 모듈이 읽는 최소 모양 — src/api/client.ts의 `Expense`가 그대로 대입된다. */
export type ExpenseSourceValue = string | null | undefined;

const SOURCE_TEXTS: Record<string, string> = {
  excel_import: "엑셀로 가져온 기록",
  purchase_followup: "구매 확인으로 남긴 기록"
};

/**
 * 지출의 `source`를 사용자가 읽는 한 줄로 옮긴다. 말할 것이 없으면 `null`(줄 자체를 생략).
 */
export function expenseSourceLineText(source: ExpenseSourceValue): string | null {
  if (typeof source !== "string") return null;
  const key = source.trim();
  if (key.length === 0) return null;
  return SOURCE_TEXTS[key] ?? null;
}

/** 화면이 그대로 그릴 라벨/값 한 쌍. 말할 것이 없으면 `null`. */
export function expenseSourceLine(source: ExpenseSourceValue): { label: string; value: string } | null {
  const value = expenseSourceLineText(source);
  if (!value) return null;
  return { label: EXPENSE_SOURCE_LINE_LABEL, value };
}
