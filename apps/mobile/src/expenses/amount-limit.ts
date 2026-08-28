/**
 * GAP-054 #2 — 금액 상한의 단일 소스.
 *
 * 서버 amount 컬럼은 int4라 2,147,483,647을 넘는 값은 저장이 아니라 5xx로 끝난다. 문제는
 * 실패의 모양이다: 오프라인 아웃박스는 로컬 저장을 먼저 성공시키고 flush에서야 5xx를 만나
 * 무한 재시도 poison이 된다(진단 docs/5차/budget-app-gap-analysis.md P0-2). 그래서 이 값은
 * 입력 칸(클라 가드)과 서버 DTO(@Max)가 **같은 숫자**를 물어야 하고, 그 숫자를 여기 한 곳에
 * 둔다. 지출·예산 입력 화면(트랙 A·C)이 모두 이 모듈을 import한다.
 *
 * 사용자에게는 int4를 말하지 않는다 — 한도 초과라는 사실과 한도 값만 말한다(해요체, DNC-018:
 * 죄책감 유발 금지).
 */

export const EXPENSE_AMOUNT_MAX_KRW = 2_147_483_647;

/** 입력 칸 아래 안내 한 줄. 초과 입력을 막은 이유를 사실대로 말한다. */
export function amountOverLimitMessage(maxKrw: number = EXPENSE_AMOUNT_MAX_KRW): string {
  return `한 번에 기록할 수 있는 금액은 ${maxKrw.toLocaleString("ko-KR")}원까지예요.`;
}

/** 상한 초과 여부. NaN·음수는 여기서 판단하지 않는다(기존 가드가 담당). */
export function isAmountOverLimit(amountKrw: number, maxKrw: number = EXPENSE_AMOUNT_MAX_KRW): boolean {
  return Number.isFinite(amountKrw) && amountKrw > maxKrw;
}
