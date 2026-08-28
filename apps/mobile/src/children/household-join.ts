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
 * 3) 라운드 60 #3 — 수락 **후**의 데드엔드 두 개: 아이를 만들 수 없는 역할(viewer/gift_participant)을
 *    온보딩으로 보내 403을 무한 재시도하게 하던 길과, 아이 목록 조회 실패를 "아이 없음"으로
 *    단정해 중복 아이를 만들 수 있게 하던 길. 갈래가 3개(select/keep/onboarding)에서
 *    5개(+blocked/+retry)로 늘었다.
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
  | { kind: "keep"; href: string }
  /**
   * 라운드 49 QA(P3-10): 참여는 했는데 **볼 아이가 하나도 없다** -- 온보딩을 마치지 않은
   * 사용자가 초대 링크로 들어온 경우(데모 세션은 항상 여기, `children: null`)와, 아직 아이가
   * 없는 가구에 참여한 실세션이 모두 이 자리다.
   *
   * 라운드 60 #3: 단, 이 길은 **아이를 등록할 수 있는 사람**에게만 유효하다(아래 "blocked").
   */
  | { kind: "onboarding"; notice: string; href: string }
  /**
   * 라운드 60 #3 (막다른 길 ①): 참여는 했고 볼 아이도 없는데, **내 역할로는 아이를 만들 수
   * 없다**(viewer / gift_participant). 온보딩으로 보내면 ONB-002의 `POST /children`이 서버에서
   * 403 FORBIDDEN으로 막히고(apps/api/src/onboarding/children.controller.ts의
   * `@RequireHouseholdRoles("owner", "co_parent")`), 화면은 "저장하지 못했어요 … 다시 시도해
   * 주세요"만 되풀이한다 -- 다시 눌러도 절대 풀리지 않는 실패 앞의 무한 재시도다.
   *
   * 그래서 온보딩이 아니라 **사실 안내**로 착지한다: 이 사람이 할 수 있는 일은 등록이 아니라
   * 기다림이고, 실제로 통하는 다음 행동은 관리자에게 부탁하는 것이다(INVITE_FORBIDDEN_MESSAGE와
   * 같은 규율 -- 재시도를 권하지 않는다).
   */
  | { kind: "blocked"; notice: string; href: string }
  /**
   * 라운드 60 #3 (막다른 길 ②): 아이 목록 **조회 자체가 실패**했다. 예전에는 `.catch(() => null)`이
   * 실패를 "아이 없음"과 같은 값으로 접어서, 아이가 멀쩡히 있는 가구에 참여한 사람도 온보딩으로
   * 떨어져 **아이를 한 번 더 만들 수 있었다**(중복 아이). 모르는 것을 안다고 말하지 않는다:
   * 사실("불러오지 못했어요")과 재시도만 준다.
   */
  | { kind: "retry"; notice: string; href: string };

/**
 * 아이를 등록할 수 없는 역할. 서버의 허용 목록(`owner`/`co_parent`)의 여집합을 **명시적으로**
 * 적는다 -- 모르는 역할(null/undefined, 새로 생긴 역할 문자열)까지 잠그면, 역할을 알 수 없는
 * 기존 경로(데모 세션·역할 미상 응답)가 조용히 안내 화면으로 바뀐다. 모를 때는 종전 경로를
 * 유지하고, **확실히 막힌 두 역할만** 갈라낸다.
 */
const CHILD_CREATE_BLOCKED_ROLES = ["viewer", "gift_participant"] as const;

/** 이 역할로는 아이를 만들 수 없는가(= 온보딩으로 보내면 403이 확정인가). */
export function isChildCreateBlockedRole(role: string | null | undefined): boolean {
  return typeof role === "string" && (CHILD_CREATE_BLOCKED_ROLES as readonly string[]).includes(role);
}

/** 라운드 60 #3: 아이 등록 권한이 없는 참여자의 착지 문구. 재시도를 권하지 않는다. */
export const HOUSEHOLD_JOIN_VIEWER_NOTICE =
  "아직 등록된 아이가 없어요. 가족 관리자가 아이를 등록하면 바로 볼 수 있어요.";

/** 라운드 60 #3: 아이 목록 조회가 실패했을 때의 문구. "아이 없음"을 단정하지 않는다. */
export const HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE =
  "가족 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * @param householdId 방금 참여한 가구.
 * @param children 참여 직후 서버가 돌려준 아이 목록(GET /children는 사용자가 속한 모든 가구의
 *   아이를 주므로 가구로 걸러야 한다). 조회 자체가 실패했거나 데모 세션이라 신뢰할 수 없으면
 *   `null` -- 무엇을 고를지 알 수 없으므로 선택을 건드리지 않는다(허위 전환 안내 금지).
 * @param currentChildId 지금 선택된 아이. 이미 새 가구의 아이면 전환도 안내도 없다.
 * @param role 참여 응답이 돌려준 **이 가구에서의 내 역할**(AcceptInviteResponse.household.role).
 *   생략하면 "모름"이고, 모름은 종전 경로를 그대로 쓴다.
 * @param childrenLoadFailed 아이 목록 조회가 **실패**했는가. `children: null`과 구분되는 사실이다
 *   -- 데모 세션은 조회를 하지 않아 null이지만 실패한 것이 아니다(false).
 */
export function planAfterHouseholdJoin(input: {
  householdId: string;
  children: ReadonlyArray<{ id: string; householdId: string; nickname: string }> | null;
  currentChildId: string | null;
  role?: string | null;
  childrenLoadFailed?: boolean;
}): HouseholdJoinPlan {
  const joined = (input.children ?? []).filter(
    (child) =>
      typeof child?.id === "string" && child.id.length > 0 && child.householdId === input.householdId
  );
  if (joined.length === 0) {
    /**
     * 라운드 60 #3 — 막다른 길 ②(조회 실패)를 **가장 먼저** 가른다.
     *
     * 조회가 실패했다면 이 가구에 아이가 있는지 없는지 우리는 모른다. 역할이 무엇이든
     * "아직 등록된 아이가 없어요"도, "아이 정보를 등록하면"도 모두 단정이다. 모를 때 할 수
     * 있는 정직한 말은 하나뿐이다: 못 불러왔고, 다시 해 보자.
     *
     * 이미 보고 있는 아이가 있는 사람은 종전대로 가족 화면에 남는다 -- 그 사람에게 이 실패는
     * "새 가구의 아이를 못 골랐다"일 뿐이고, 탭으로 돌아갈 길이 이미 있다.
     */
    if (input.childrenLoadFailed && !input.currentChildId) {
      return { kind: "retry", notice: HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE, href: "/family" };
    }
    /**
     * 라운드 49 QA(P3-10) — 막다른 길 제거.
     *
     * 고를 아이가 없고 **지금 보고 있는 아이도 없으면**, /family는 갈 곳이 아니다: 탭 밖
     * 화면이라 하단 탭이 없고, 탭으로 되돌아가려 해도 온보딩 게이트(app/(tabs)/_layout.tsx의
     * `!hasReachedHome`)가 다시 "/"로 밀어낸다. 데모 세션은 `children`이 언제나 null이라
     * (허위 전환 안내 금지 규칙) 이 경로에 항상 떨어졌고, 초대 링크로 앱을 처음 연 사용자는
     * 참여 직후 그대로 갇혔다.
     *
     * 가장 단순하고 정직한 길은 **온보딩 시작점**이다 -- 이 사람에게 실제로 남은 일이 아이
     * 등록 하나뿐이고, 온보딩을 마치면 탭이 열린다. 아이가 이미 있는 사용자(currentChildId)는
     * 종전대로 가족 화면에 남는다: 그 사람은 탭으로 돌아갈 길이 있다.
     *
     * 라운드 60 #3: 단, **아이를 만들 수 있는 사람에게만** 그렇다. 보기 전용·선물 참여로
     * 초대받은 사람에게 온보딩은 길이 아니라 403 벽이다(위 "blocked" 주석).
     */
    if (!input.currentChildId) {
      if (isChildCreateBlockedRole(input.role)) {
        return { kind: "blocked", notice: HOUSEHOLD_JOIN_VIEWER_NOTICE, href: "/family" };
      }
      return {
        kind: "onboarding",
        notice: "아직 볼 수 있는 아이가 없어요. 아이 정보를 등록하면 바로 시작할 수 있어요.",
        href: "/onboarding/child-status"
      };
    }
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
