import { CHILD_REMOVAL_INVALIDATE_KEYS } from "./child-deletion";

/**
 * FAM-121A: 초대 수락 여정(FAM-003)의 순수 계획 로직.
 *
 * 두 개의 데드엔드를 여기서 정리한다.
 * 1) 비로그인 방문: 예전에는 "로그인 후 참여할 수 있어요" 안내 문구만 있고 로그인으로 가는 길도,
 *    돌아오는 길도 없었다. 초대 토큰을 로그인 라우트 파라미터로 실어 보내고(`/login?invite=...`),
 *    로그인 성공 직후 같은 수락 화면으로 되돌린다 -- 별도 스토어 없이 라우트 파라미터만 쓰는
 *    가장 단순한 보존 경로다(온보딩 resume 스토어처럼 앱 재시작 후까지 살아남을 필요가 없다:
 *    사용자가 초대 링크를 다시 열면 그만이다).
 * 2) 수락 성공: 예전에는 defaultHouseholdId만 바꿔서 선택된 아이는 이전 가구 아이 그대로였고,
 *    ["children"]/["household-members"]도 그대로라 새 가구가 화면에 반영되지 않았다. R19-C의
 *    삭제/탈퇴 뒤처리와 같은 규율로 캐시를 비우고 새 가구의 첫 아이를 골라준다.
 *
 * react-native / expo-router import 없이 유지(child-switch.ts·child-deletion.ts와 같은 규율)해서
 * vitest에서 그대로 단위 테스트한다.
 */

/**
 * 가구 참여 후 무효화해야 하는 쿼리 키. 아이가 통째로 바뀔 수 있으므로 삭제/탈퇴와 같은 집합
 * (["children"] + 아이 스코프 7종)에 가구 구성원 목록을 더한다 -- 방금 새 구성원이 된 가구의
 * 멤버 목록(FAM-001)이 캐시된 예전 가구 것으로 남으면 안 된다.
 */
export const HOUSEHOLD_JOIN_INVALIDATE_KEYS: ReadonlyArray<ReadonlyArray<string>> = [
  ...CHILD_REMOVAL_INVALIDATE_KEYS,
  ["household-members"]
];

/** 로그인 화면이 초대 토큰을 받아 두는 라우트 파라미터 이름. */
export const INVITE_RESUME_PARAM = "invite";

/** expo-router의 useLocalSearchParams는 string | string[] | undefined를 준다. */
function firstParamValue(param: unknown): string | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 초대 수락 화면 경로. 토큰이 비어 있으면 null(= 갈 곳 없음). */
export function acceptInviteHref(token: unknown): string | null {
  const value = firstParamValue(token);
  return value ? `/family/accept/${encodeURIComponent(value)}` : null;
}

/**
 * 비로그인 방문자가 누르는 "로그인하고 참여하기"의 목적지. 토큰을 파라미터로 함께 보내
 * 로그인 성공 후 `resumeHrefAfterLogin`이 이 초대로 정확히 되돌아올 수 있게 한다.
 */
export function loginHrefForInvite(token: unknown): string | null {
  const value = firstParamValue(token);
  return value ? `/login?${INVITE_RESUME_PARAM}=${encodeURIComponent(value)}` : null;
}

/**
 * 로그인 성공 직후 갈 곳. 초대 토큰이 실려 있으면 수락 화면으로 복귀하고(= 중단된 여정 재개),
 * 없으면 null을 돌려줘 호출측이 기존 목적지(온보딩 / 탭)를 그대로 쓰게 한다.
 */
export function resumeHrefAfterLogin(inviteParam: unknown): string | null {
  return acceptInviteHref(inviteParam);
}

export type HouseholdJoinPlan =
  /** 새로 참여한 가구의 아이로 전환하고 홈으로. */
  | { kind: "select"; childId: string; notice: string; href: string }
  /** 고를 아이가 없거나 이미 그 가구 아이를 보고 있음 -- 선택을 건드리지 않고 가족 화면으로. */
  | { kind: "keep"; href: string };

/**
 * @param householdId 방금 참여한 가구.
 * @param children 참여 직후 서버가 돌려준 아이 목록(GET /children는 사용자가 속한 모든 가구의
 *   아이를 주므로 가구로 걸러야 한다). 조회 자체가 실패했거나 데모 세션이라 신뢰할 수 없으면
 *   `null` -- 무엇을 고를지 알 수 없으므로 선택을 건드리지 않는다(허위 전환 안내 금지).
 * @param currentChildId 지금 선택된 아이. 이미 새 가구의 아이면 전환도 안내도 없다.
 */
export function planAfterHouseholdJoin(input: {
  householdId: string;
  children: ReadonlyArray<{ id: string; householdId: string; nickname: string }> | null;
  currentChildId: string | null;
}): HouseholdJoinPlan {
  const joined = (input.children ?? []).filter(
    (child) =>
      typeof child?.id === "string" && child.id.length > 0 && child.householdId === input.householdId
  );
  if (joined.length === 0) {
    return { kind: "keep", href: "/family" };
  }
  if (joined.some((child) => child.id === input.currentChildId)) {
    return { kind: "keep", href: "/family" };
  }
  const next = joined[0];
  return {
    kind: "select",
    childId: next.id,
    notice: `${next.nickname}(으)로 전환했어요. 설정 > 아이 관리에서 바꿀 수 있어요.`,
    href: "/(tabs)"
  };
}
