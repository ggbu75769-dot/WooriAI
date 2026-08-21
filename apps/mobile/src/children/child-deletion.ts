import { CHILD_SCOPED_QUERY_KEY_PREFIXES } from "./child-switch";

/**
 * R19-C(F2): 아이 프로필 삭제 / 가구 탈퇴 이후 어디로 갈지 정하는 순수 계획 함수.
 *
 * 라운드 16에서 다자녀(설정 > 아이 관리)가 들어오기 전에는 "삭제 = 마지막 아이 삭제"였기 때문에
 * app/settings/privacy.tsx가 성공 시 무조건 /onboarding/child-status로 보냈다. 둘째를 지운
 * 사용자까지 온보딩으로 튕기던 잔여를 여기서 정리한다 -- 남은 아이가 있으면 그중 첫째를 골라
 * 홈으로 돌려보내고, 하나도 없을 때만 온보딩으로 간다.
 *
 * react-native import 없이 유지(child-switch.ts와 같은 규율)해서 vitest에서 그대로 단위 테스트한다.
 */

/**
 * 삭제/탈퇴 후 무효화해야 하는 쿼리 키. 선택된 아이가 통째로 바뀌므로 아이 전환(MOB-118)과
 * 똑같은 7개 아이 스코프 키 전부 + 목록 자체(["children"])를 비운다. 예전에는 ["children"]과
 * ["home"] 둘만 지워서 지출/준비템/리포트/예산 캐시에 삭제된 아이의 데이터가 남았다.
 */
export const CHILD_REMOVAL_INVALIDATE_KEYS: ReadonlyArray<ReadonlyArray<string>> = [
  ["children"],
  ...CHILD_SCOPED_QUERY_KEY_PREFIXES
];

export type ChildRemovalPlan =
  | { kind: "select"; childId: string; notice: string }
  | { kind: "onboarding" };

/**
 * @param remaining 삭제/탈퇴 직후 서버가 돌려준 남은 아이 목록. 목록 조회 자체가 실패하면
 *   `null`을 넘긴다 -- 무엇을 고를지 알 수 없으므로 예전과 같은 보수적 경로(온보딩)로 간다.
 *   이 경우에도 다음 실행에서 MOB-116 복구(hasReachedHome=true + selectedChildId 없음)가
 *   남은 아이를 다시 찾아주므로 영구적으로 막히지 않는다.
 */
export function planAfterChildRemoval(
  remaining: ReadonlyArray<{ id: string; nickname: string }> | null
): ChildRemovalPlan {
  const next = remaining?.find((child) => typeof child?.id === "string" && child.id.length > 0);
  if (!next) {
    return { kind: "onboarding" };
  }
  return {
    kind: "select",
    childId: next.id,
    notice: `${next.nickname}(으)로 전환했어요. 설정 > 아이 관리에서 바꿀 수 있어요.`
  };
}
