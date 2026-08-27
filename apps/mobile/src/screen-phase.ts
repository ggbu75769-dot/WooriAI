/**
 * MOB-130: 조회 화면(홈·준비템·준비템 상세·가족)의 로딩/에러/정상 3분기 판정.
 *
 * 종전에는 각 화면이 아래 순서로 직접 분기했다.
 *
 *   if (hasSession && (q.isLoading || !q.data)) return 스켈레톤;
 *   if (hasSession && q.isError)                return 에러 카드;
 *
 * react-query v5에서 쿼리가 에러로 확정되면 `isPending`/`isLoading`은 false로 떨어지지만
 * `data`는 undefined로 남는다. 그래서 `!q.data`가 참이 되어 첫 분기가 영원히 잡고,
 * 뒤에 있는 에러 카드(= "다시 시도" 버튼이 달린 유일한 복구 수단)에는 절대 도달하지
 * 못했다 — 5xx/타임아웃 시 스켈레톤이 영구히 펄스했다.
 *
 * 판정을 이 순수 함수 하나로 모으고 **에러를 로딩보다 먼저** 본다. 데이터가 없는 상태의
 * 에러(첫 로드 실패)든, 캐시가 있는 상태의 에러(새로고침 실패)든 사용자는 실패 사실과
 * 재시도 수단을 받는다 — 실패를 로딩으로 위장하지 않는다.
 *
 * 호출 측은 `isPending`을 넘긴다(`isLoading`이 아니라): 화면들은 쿼리의 `enabled`가
 * 세션 여부와 일치하므로 활성 상태에서 둘은 같은 값이고, `isPending`이 "아직 데이터가
 * 한 번도 없다"는 의미를 그대로 표현한다.
 */
export type ScreenPhase = "loading" | "error" | "ready";

export type ScreenPhaseInput = {
  /** react-query v5 `isPending`: 성공/실패로 확정되기 전(= 캐시된 데이터가 아직 없음). */
  isPending: boolean;
  /** react-query v5 `isError`: 재시도까지 끝나고 에러로 확정됨. */
  isError: boolean;
  /** 화면이 실제로 렌더할 데이터가 손에 있는지(`Boolean(query.data)`). */
  hasData: boolean;
};

export function resolveScreenPhase({ isPending, isError, hasData }: ScreenPhaseInput): ScreenPhase {
  // 에러 우선. isPending/hasData 조합이 어떻든 실패는 실패로 보여 주고 재시도를 연다.
  if (isError) return "error";
  // 아직 확정 전이거나, 확정됐는데도 렌더할 데이터가 없으면 스켈레톤.
  if (isPending || !hasData) return "loading";
  return "ready";
}
