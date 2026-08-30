import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { hasApiErrorCode } from "../../../src/api/api-error";
import {
  acceptInvite,
  getInvite,
  listChildren,
  LOCAL_SESSION_TOKEN,
  type AcceptInviteResponse
} from "../../../src/api/client";
import {
  HOUSEHOLD_JOIN_ESCAPE_LABEL,
  HOUSEHOLD_JOIN_INVALIDATE_KEYS,
  householdJoinEscapePlan,
  loginHrefForInvite,
  planAfterHouseholdJoin
} from "../../../src/children/household-join";
// 라운드 70 A: 만료·사용된 초대(재시도로 절대 풀리지 않는 실패)의 문구·판정 단일 소스.
import {
  INVITE_UNAVAILABLE_ALREADY_JOINED_HINT,
  INVITE_UNAVAILABLE_DETAIL,
  INVITE_UNAVAILABLE_ESCAPE_LABEL,
  INVITE_UNAVAILABLE_NEXT_STEP,
  INVITE_UNAVAILABLE_TITLE,
  isInviteUnavailableError
} from "../../../src/family/invite-accept-messages";
import { formatInviteExpiry } from "../../../src/family/memberLabels";
// 라운드 41 K-3: 참여 직후 표·가구 목록을 서버 기준으로 한 벌로 다시 받는다(재검증 단일 소스).
import { revalidateHouseholdRoles } from "../../../src/family/useExpenseEntryGate";
// 라운드 73 트랙 E: 오프라인 갈래인지 묻는 값 둘만 읽는다(문구를 이 화면이 다시 짓지 않는다).
import { OFFLINE_LOAD_NOTICE, OFFLINE_SAVE_NOTICE } from "../../../src/offline/messages";
import { useLoadErrorCopy, useSaveErrorCopy } from "../../../src/offline/use-load-error-copy";
import { useOnboardingProgressStore } from "../../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../../src/stores/selected-child.store";
import { useSessionStore } from "../../../src/stores/session.store";
import { theme } from "../../../src/theme";
import { announceForA11y, AppScreen, Card, PrimaryButton, ScreenHeader, SecondaryButton } from "../../../src/ui";

const roleLabel: Record<string, string> = {
  co_parent: "공동부모",
  viewer: "보기 전용",
  gift_participant: "선물 참여"
};

/**
 * 재시도로 **풀리는** 실패(네트워크·5xx)의 문구. 라운드 70 A는 이 문장과 그 아래 [다시 시도]를
 * 한 글자도 바꾸지 않았다 — 그 갈래에서는 잠시 후 다시 누르는 것이 실제로 통하는 행동이다.
 *
 * ## 라운드 73 트랙 E(GAP-073 #5) — 그 "잠시 후"가 참이 아닌 한 갈래
 *
 * 연결이 아예 없으면 기다릴 대상이 없다. 그 사실은 이 화면만의 것이 아니라 앱 전체의 공용
 * 판정이고(src/offline/messages.ts), 이 여정에서만 앱이 다른 말을 하고 있었다 — 초대 링크를
 * 지하철에서 누른 사람이 읽는 두 문장이 정확히 여기였다.
 *
 * 그래서 **온라인 갈래는 그대로 두고 오프라인 갈래만** 공용 문장으로 간다:
 *  - **조회**는 주어 한 조각("초대 정보를")만 더한다 — 접두 + 공용 문장이 아래 종전 문자열과
 *    바이트 단위로 같아서, 이 파일이 그 리터럴을 더 들고 있지 않아도 된다.
 *  - **참여(저장)**는 공용 문장에서 만들 수 없는 자기 문장을 갖고 있어(주어가 "저장"이 아니라
 *    "가족에 참여") 아래 상수가 그대로 남는다. 오프라인일 때만 공용 문장이 그 자리를 대신한다.
 */
const acceptFailedText = "가족에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.";
const alreadyMemberText = "이미 이 가족의 구성원이에요.";

// 이미 구성원인 사람이 다시 수락하면 서버는 409 HOUSEHOLD_ALREADY_MEMBER로 거절한다. 재시도로는
// 절대 풀리지 않는 실패라 일반적인 "잠시 후 다시" 대신 전용 문구를 쓴다.
//
// 라운드 45 UX-Z: 예전에는 응답 JSON 문자열에서 코드 조각을 부분 검색했다(error.message에
// 담긴 본문 전체를 훑었다). 그 방식은 코드가 아니라 **문자열 어디에든** 그 조각이 있으면 참이라(서버가
// 보내는 사람이 읽는 message나 다른 필드에 우연히 섞여도 참이 된다) 판정이 조용히 틀릴 수 있다.
// 이제는 서버 봉투에서 꺼낸 코드로 판정한다(src/api/api-error.ts). 이 화면은 문구 표를 쓰지 않고
// 자기 문구를 유지한다 -- 같은 409라도 여기서 사용자가 알아야 할 사실은 "권한"이 아니라 "이미
// 이 가족의 구성원"이기 때문이다.
function acceptErrorText(error: unknown): string {
  return hasApiErrorCode(error, "HOUSEHOLD_ALREADY_MEMBER") ? alreadyMemberText : acceptFailedText;
}

export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = String(params.token ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const isDemoSession = authToken === LOCAL_SESSION_TOKEN;
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  // FIX-121C(F4): app/(tabs)/_layout.tsx의 온보딩 게이트(`!hasReachedHome && !isTestSession`)를
  // 통과시키기 위한 플래그. 카카오/OIDC 로그인 경로는 이걸 세우지 않으므로(테스트 로그인만 세운다,
  // app/(auth)/login.tsx:145) 초대 링크로 처음 온 사용자는 참여 직후 "/(tabs)"로 보내도 게이트가
  // "/"로 되돌리고, 가구 주인이 예산을 건너뛴 계정이면 온보딩 이어하기(ONB-006)로 떨어졌다.
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);
  // 라운드 60 리뷰(P1-1): 재시도 카드의 탈출구가 어디로 가야 하는지는 "이 계정이 탭 셸에 이미
  // 도달한 적 있는가"로 갈린다 -- 판정은 순수 함수(householdJoinEscapePlan)가 든다.
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);
  const queryClient = useQueryClient();
  // FAM-121A: 비로그인 방문자가 로그인 화면으로 갈 때 초대 토큰을 함께 실어 보내는 목적지.
  // 로그인 성공 후 app/(auth)/login.tsx가 이 초대 수락 화면으로 되돌려 준다.
  const loginHref = loginHrefForInvite(token);

  const invite = useQuery({
    queryKey: ["invite", token],
    enabled: Boolean(token),
    queryFn: () => getInvite(token)
  });

  /**
   * 라운드 60 #3: 참여는 성공했는데 **아이 목록 조회가 실패**한 사람이 머무는 자리.
   *
   * 예전에는 그 실패가 `.catch(() => null)`로 "아이 없음"과 같은 값이 되어, 아이가 멀쩡히 있는
   * 가구에 참여한 사람까지 온보딩으로 떨어졌다(= 아이를 한 번 더 만들 수 있었다). 이제는
   * 화면에 머물면서 **같은 뒤처리만 다시** 태운다 -- 초대 수락(POST)은 이미 성공했으므로 절대
   * 다시 부르지 않는다(다시 부르면 409 HOUSEHOLD_ALREADY_MEMBER뿐이다).
   */
  const [joinedResult, setJoinedResult] = useState<AcceptInviteResponse | null>(null);
  const [joinRetryNotice, setJoinRetryNotice] = useState<string | null>(null);
  const [isFinishingJoin, setIsFinishingJoin] = useState(false);

  const accept = useMutation({
    mutationFn: () => acceptInvite(authToken!, token),
    /**
     * FAM-121A: 예전에는 defaultHouseholdId만 바꾸고 끝나서 ["children"]·["household-members"]가
     * 예전 가구 응답 그대로 남고, 선택된 아이도 이전 가구 아이를 계속 가리켰다. R19-C의
     * 삭제/탈퇴 뒤처리(app/settings/privacy.tsx)와 같은 순서로 정리한다:
     * 새 목록 조회 -> 캐시 무효화 -> 계획대로 아이 재선택 + 안내 -> 이동.
     */
    onSuccess: async (result) => {
      setJoinedResult(result);
      if (!isTestSession) {
        /**
         * 라운드 60 리뷰(P1-3) — **기본 가구를 덮어쓰지 않는다.**
         *
         * 종전에는 여기서 `defaultHouseholdId`를 새 가구로 갈아 끼웠다. 그 값은 아이가 없는
         * 가구를 가리킬 수 있는 **유일한** 값이라(아이 → 가구 판정은 아이가 있어야 선다),
         * 갈아 끼우는 순간 원래 가구는 앱 안에서 되돌아갈 근거를 잃었다. 트랙 A가 쓰기·관리
         * 화면을 "보고 있는 아이의 가구"로 옮겨 절반을 막았지만, 아이가 아직 없는 원래 가구는
         * 여전히 아무 화면도 가리킬 수 없었다.
         *
         * 그래서 규칙을 뒤집는다: **알고 있는 가구 목록에 더하기만 한다.** 목록에 더하는 일은
         * 바로 아래 `setHouseholdRole`이 이미 한다(라운드 40 J-2 — 목록을 알고 있으면 그 하나만
         * 보탠다), 그리고 그 목록이 곧 가족 화면의 "다른 가구 보기" 후보다
         * (src/family/household-scope.ts).
         *
         * 예외 하나: 기본 가구를 **아직 모르는** 계정(가구 없이 로그인해 초대로 처음 가구가
         * 생긴 사람)에는 덮어쓸 값 자체가 없다. 이때만 채운다 -- 비워 두면 아이도 가구도 없는
         * 계정이 되어 가족·설정 화면이 "연결된 가구가 없어요"로 남는다. 로그인 시점의
         * households[0] 초기화는 그대로다(그것은 첫 진입의 사실이다).
         */
        if (!useSessionStore.getState().defaultHouseholdId) {
          useSessionStore.setState({ defaultHouseholdId: result.household.id });
        }
        // UX-R(M): 참여 응답이 내려준 **내 역할**을 여기서 담는다. 보기 전용·선물 참여
        // 참여자는 로그인 시점에 이 가구가 아직 없었으므로(초대를 이제 막 수락했다) 로그인
        // 응답만으로는 역할을 영영 알 수 없다 — 이 한 줄이 그 사람들에게 정직한 기록 CTA를
        // 만든다.
        //
        // 데모 세션은 위 defaultHouseholdId와 **같은 이유로** 제외한다: local-backend의
        // acceptInvite는 참여자를 데모 사용자(엄마·owner)가 아니라 별도의 "아빠" 구성원으로
        // 모사하므로, 그 초대 역할을 내 역할로 담으면 데모에서 owner가 자기 초대를 눌러 본
        // 것만으로 기록 입구가 잠긴다. 알 수 없음으로 두면 데모는 예전 그대로다.
        useSessionStore.getState().setHouseholdRole(result.household.id, result.household.role);
        // 라운드 41 K-3: 위 한 줄은 **한 가구에 대한 사실**이라 `householdIds`(서버가 말한 가구
        // 목록)를 채우지 못한다 — 로그인 시점에 가구가 없던 계정(households: [])은 그 목록이
        // null인 채로 남고, 그러면 단일 가구 폴백이 꺼져 보기 전용이 잠기지 않는다. 잠기지
        // 않으니 잠금 안내도, 그 안내에 달린 J-3 재검증도 발화하지 않아 재로그인 전까지
        // 회복 경로가 없었다(저장 → 403 → failed 행이 그대로 되살아난다).
        //
        // 그래서 참여 응답을 처리하는 이 자리에서 GET /me를 한 번 더 태워 **표와 목록을 한 벌로**
        // 갱신한다. 새 모듈을 만들지 않고 J-3의 재검증 경로를 그대로 재사용하고, 스로틀만
        // 건너뛴다(force) — 표가 방금 바뀐 것을 아는 순간이라 "같은 사실을 반복해 묻는다"는
        // 스로틀의 전제가 성립하지 않는다. 조회는 백그라운드라 아래 이동 흐름을 붙잡지 않는다.
        revalidateHouseholdRoles({ force: true });
      }
      await finishHouseholdJoin(result);
    }
  });

  /**
   * 라운드 70 A — **이 초대는 끝났다**를 화면 전체가 한 번에 아는 자리.
   *
   * 서버는 이 사실을 세 갈래로 말한다: 조회 404(INVITE_NOT_FOUND) · 조회 400(INVITE_NOT_PENDING) ·
   * 수락 400(INVITE_NOT_PENDING). 세 갈래가 **같은 문장**을 읽어야 한다는 것이 이 트랙의 회귀
   * 계약인데, 그 보장을 테스트에만 맡기지 않고 **구조로** 세운다: 판정이 하나이므로 아래에서
   * 그리는 카드도 하나이고, 세 갈래는 같은 문자열이 아니라 **같은 노드**를 본다.
   *
   * 두 코드를 가르지 않는 이유(오라클 금지)는 src/family/invite-accept-messages.ts 머리말에 있다.
   * 네트워크·5xx는 이 판정에 걸리지 않으므로 그 갈래의 카드·버튼·문구는 종전 그대로다.
   */
  const inviteUnavailable = isInviteUnavailableError(invite.error) || isInviteUnavailableError(accept.error);

  /**
   * 라운드 73 트랙 E — 두 문장이 **연결을 확인한다**(그것만 바뀐다).
   *
   * 판정은 공용 훅 한 벌이고(에러로 전환되는 순간 연결을 한 번 묻는다 — 화면이 직접 폴을
   * 띄우지 않는다), 문구도 공용 단일 소스다. 조회는 온라인 갈래에만 주어를 붙여 종전 문자열을
   * 그대로 만들고, 참여는 온라인 갈래에서 종전 판정(acceptErrorText)을 그대로 지난다.
   *
   * ⚠️ 오프라인 문장이 서는 조건이 `=== OFFLINE_SAVE_NOTICE`인 것이 계약이다.
   * `resolveSaveErrorCopy`의 순서는 **아는 코드 → 오프라인 → 모르는 실패**라, 이 비교가 참이면
   * "서버가 아무 코드도 주지 않았다"가 이미 참이다. 그래서 409 HOUSEHOLD_ALREADY_MEMBER는
   * 연결 판정이 어긋난 순간에도 오프라인 문장에 가려지지 않는다 — 그 갈래의 문구도 판정도
   * 한 글자도 바뀌지 않는다(라운드 70 A).
   */
  const inviteLoadErrorCopy = useLoadErrorCopy(invite.isError);
  const inviteLoadErrorText =
    inviteLoadErrorCopy.title === OFFLINE_LOAD_NOTICE
      ? inviteLoadErrorCopy.title
      : `초대 정보를 ${inviteLoadErrorCopy.title}`;
  const acceptSaveErrorCopy = useSaveErrorCopy(accept.isError, accept.error);

  /**
   * 라운드 79 리뷰(M-1) — 프롭 둘(`accessibilityLiveRegion` + `accessibilityRole="alert"`)은
   * **안드로이드에서만** 자동 낭독을 만든다. iOS/VoiceOver에는 live region이 없고 alert 역할에
   * 대응하는 트레이트도 없어, 프롭만으로는 [참여하기]를 누른 사람이 실패를 소리로 듣지 못한다.
   * 크로스플랫폼 관례는 `announceForA11y`다((auth)/login.tsx와 같은 조건 — 포커스가 눌린 버튼에
   * 남는다). 읽어 주는 문장은 아래 갈래가 그리는 것과 **같은 식**이다(눈과 귀가 다른 말을 하지
   * 않는다 — a11y-contract.test.ts가 두 자리의 식이 같은지를 계약으로 문다).
   */
  useEffect(() => {
    if (accept.isError && !inviteUnavailable) {
      announceForA11y(acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error));
    }
  }, [accept.isError, accept.error, acceptSaveErrorCopy, inviteUnavailable]);

  /**
   * 참여 성공 **이후**의 뒤처리 한 벌: 아이 목록 조회 -> 캐시 무효화 -> 계획대로 착지.
   * 조회 실패("retry" 계획) 때 버튼 하나로 이 함수만 다시 태울 수 있게 mutation 밖으로 뺐다.
   */
  async function finishHouseholdJoin(result: AcceptInviteResponse) {
    setIsFinishingJoin(true);
    try {
      // 데모(local-backend) 세션은 가구가 하나뿐이라 "다른 가구로 참여"를 모사하지 않는다
      // (FIX-118B(F3)와 같은 정직성 규칙) -- 알 수 없음으로 두어 허위 전환 안내를 막는다.
      //
      // 라운드 60 #3: 예전의 `.catch(() => null)`은 **조회 실패**와 **조회하지 않음(데모)**을
      // 같은 값으로 접었고, 순수 모듈은 둘 다 "아이 없음"으로 읽었다. 이제 실패를 별도의
      // 사실(childrenLoadFailed)로 실어 보낸다 -- 데모는 실패한 적이 없으므로 false다.
      const lookup = isDemoSession
        ? { children: null, failed: false }
        : await listChildren(authToken!)
            .then((response) => ({ children: response.children, failed: false }))
            .catch(() => ({ children: null, failed: true }));
      await Promise.all(
        HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
      );
      const plan = planAfterHouseholdJoin({
        householdId: result.household.id,
        children: lookup.children,
        currentChildId: selectedChildId,
        // UX-R(M)이 이미 담아 둔 그 역할이다 -- 참여 응답만이 이 가구에서의 내 역할을 안다.
        role: result.household.role,
        childrenLoadFailed: lookup.failed
      });
      const joinedText = `${result.household.name}과 함께해요.`;
      // 라운드 60 #3(막다른 길 ②): 조회 실패는 이동하지 않고 화면에 머문다. 안내는 순수 모듈의
      // 문구를 그대로 쓰고, [다시 시도]가 이 함수를 다시 태운다(수락 POST는 다시 부르지 않는다).
      if (plan.kind === "retry") {
        setJoinRetryNotice(plan.notice);
        announceForA11y(plan.notice);
        return;
      }
      setJoinRetryNotice(null);
      if (plan.kind === "select") {
        setSelectedChildId(plan.childId);
        // 이 분기(= 참여한 가구에 이미 아이가 있음)는 실질적으로 온보딩이 끝난 상태다:
        // 아이 프로필은 가구 주인이 이미 만들어 뒀고, 참여자가 다시 만들 것도 없다. 그래서
        // 탭 셸로 보내기 전에 홈 도달을 표시해 게이트가 되돌리지 못하게 한다. "keep" 분기는
        // 목적지가 /family(탭 밖)라 게이트를 지나지 않으므로 건드리지 않는다.
        markHomeReached();
        announceForA11y(plan.notice);
        Alert.alert("가족에 참여했어요", `${joinedText}\n${plan.notice}`, [
          { text: "확인", onPress: () => router.replace(plan.href) }
        ]);
        return;
      }
      // 라운드 49 QA(P3-10): 볼 아이가 하나도 없는 참여자는 /family(탭 밖)에 갇히는 대신
      // 온보딩 시작점으로 잇는다 -- 계획과 안내 문구는 순수 모듈이 정한다.
      //
      // 라운드 60 #3(막다른 길 ①): 아이를 만들 수 없는 역할은 온보딩 대신 "blocked" 안내로
      // 착지한다. 두 갈래 모두 안내 문구를 그대로 읽어 주므로 처리는 한 자리에서 같다.
      if (plan.kind === "onboarding" || plan.kind === "blocked") {
        // 라운드 60 리뷰(P1-2): blocked의 목적지는 이제 탭 셸이다 -- select 분기와 같은 이유로
        // (온보딩 게이트를 지나는 목적지는 그 둘뿐이다) 홈 도달을 함께 표시한다. 아이를 만들
        // 권한이 없는 사람에게 온보딩은 애초에 지날 길이 아니므로, 게이트가 되돌리면 그대로
        // 갇힌다. onboarding 분기는 목적지가 탭 밖이라 종전 그대로 세우지 않는다.
        if (plan.kind === "blocked") markHomeReached();
        announceForA11y(plan.notice);
        Alert.alert("가족에 참여했어요", `${joinedText}\n${plan.notice}`, [
          { text: "확인", onPress: () => router.replace(plan.href) }
        ]);
        return;
      }
      Alert.alert("가족에 참여했어요", joinedText, [
        { text: "확인", onPress: () => router.replace(plan.href) }
      ]);
    } finally {
      setIsFinishingJoin(false);
    }
  }

  return (
    <AppScreen>
      <View testID="screen-FAM-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="가족 관리" title="초대 수락" subtitle="초대받은 가족에 참여해요" />

        {invite.isLoading ? (
          <Card>
            <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
          </Card>
        ) : null}

        {/* 재시도로 풀리는 실패(네트워크·5xx)만 이 카드에 남는다 — 카드도 버튼도 종전 그대로이고,
            문구는 오프라인일 때만 공용 문장으로 갈린다(라운드 73 E). */}
        {invite.isError && !inviteUnavailable ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>{inviteLoadErrorText}</Text>
            <SecondaryButton label={inviteLoadErrorCopy.actionLabel} onPress={() => invite.refetch()} />
          </Card>
        ) : null}

        {/* 라운드 70 A(막다른 길 ① — 수락 **전**): 만료·사용된 초대. 세 갈래(조회 404 · 조회 400 ·
            수락 400)가 모두 이 한 카드를 본다. [다시 시도]는 없다 — 다시 눌러 풀리는 것이
            아무것도 없는 실패에 재시도 버튼을 세우는 것은 안내가 아니라 시간 낭비다. 대신
            "새 링크를 요청하세요"라는 사실과, 지금 이 자리에서 할 수 있는 행동 하나를 준다. */}
        {inviteUnavailable ? (
          <View accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Card style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.danger }}>{INVITE_UNAVAILABLE_TITLE}</Text>
              <Text style={mutedTextStyle}>{INVITE_UNAVAILABLE_DETAIL}</Text>
              <Text style={mutedTextStyle}>{INVITE_UNAVAILABLE_NEXT_STEP}</Text>
              {/* 라운드 70 리뷰(S-1): 세션이 있는 사람에게만 서는 한 줄. 판정 근거는 토큰이
                  아니라 **내 세션 상태**라 오라클이 아니고(문구 모듈 머리말), 비로그인
                  방문자의 화면은 종전과 한 글자도 다르지 않다. */}
              {authToken ? <Text style={mutedTextStyle}>{INVITE_UNAVAILABLE_ALREADY_JOINED_HINT}</Text> : null}
              <SecondaryButton
                // 라운드 70 리뷰(P-A): 형제 버튼들(아래 라운드 60 #3 카드)과 같은 관례로,
                // 짧은 라벨이 못 나르는 맥락("이 초대는 두고")을 낭독에 실어 준다.
                accessibilityLabel="초대 없이 앱 둘러보기"
                label={INVITE_UNAVAILABLE_ESCAPE_LABEL}
                onPress={() => {
                  // 아래 라운드 60 #3 카드와 같은 계획 함수를 쓴다. 그 호출부는 성격이 다른
                  // 카드(수락은 **이미 성공**했고 뒤처리만 실패한 자리)라 이 라운드가 손대지
                  // 않기로 한 자리이므로, 공용 핸들러로 합치지 않고 같은 세 줄을 여기 둔다.
                  //
                  // 라운드 70 리뷰(M-1) — **세션 축이 하나 더 있다.** `householdJoinEscapePlan`은
                  // 수락 **후** 카드에서 태어난 함수라 세션이 있다는 것을 전제한다: 두 목적지
                  // (탭 셸 · 온보딩 시작점)는 모두 저장에 세션이 필요하다. 그런데 이 카드는
                  // 수락 **전** 막다른 길이라 **계정이 없는 방문자도** 여기에 선다(로그인 CTA는
                  // 이 갈래에서 접힌다). 그 사람을 온보딩으로 내려놓으면 아이 정보를 적게 한
                  // 뒤 저장에서 막히는, 이 라운드가 없애려던 바로 그 형태의 막다른 길이 된다.
                  // 그래서 세션이 없으면 루트("/")로 보낸다 — app/index.tsx가 **비세션 목적지의
                  // 단일 소스**다(그 화면이 만료 여부를 보고 /login 또는 /launch-animation을
                  // 고른다). 여기서 그 판정을 다시 적지 않는다.
                  if (!authToken) {
                    router.replace("/");
                    return;
                  }
                  const escape = householdJoinEscapePlan({ currentChildId: selectedChildId, hasReachedHome });
                  if (escape.marksHomeReached) markHomeReached();
                  router.replace(escape.href);
                }}
              />
            </Card>
          </View>
        ) : null}

        {/* 끝난 초대에서는 미리보기도 접는다 — "3일 남음"이 "만료되었거나 유효하지 않아요" 옆에
            서면 앱이 두 가지를 동시에 말하게 된다. 접으면 세 갈래의 화면이 완전히 같아진다. */}
        {invite.data && !inviteUnavailable ? (
          <Card style={{ gap: 8 }}>
            <Text style={inviteHouseholdNameStyle}>{invite.data.householdName}</Text>
            <Text style={inviteRoleStyle}>{roleLabel[invite.data.role] ?? invite.data.role}</Text>
            <Text style={inviteExpiryStyle}>{formatInviteExpiry(invite.data.expiresAt)}</Text>
          </Card>
        ) : null}

        {/* 끝난 초대(수락 400)는 위 카드가 말한다 — 여기 남는 것은 재시도로 풀리는 실패와
            HOUSEHOLD_ALREADY_MEMBER이고, 그 둘의 문구·판정은 종전 그대로다. */}
        {accept.isError && !inviteUnavailable ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>
            {acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error)}
          </Text>
        ) : null}

        {/* 라운드 60 #3(막다른 길 ②): 참여는 됐고 아이 목록만 못 받았다. "아이가 없다"고
            단정하지 않고 사실만 말한 뒤, 같은 뒤처리만 다시 태우는 [다시 시도]를 준다 --
            초대 수락(POST)은 이미 성공했으므로 다시 부르지 않는다(409만 남는다). */}
        {joinRetryNotice && joinedResult ? (
          <View accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Card style={{ gap: 10 }}>
              <Text style={{ color: theme.colors.brown }}>{`${joinedResult.household.name}과 함께해요.`}</Text>
              <Text style={{ color: theme.colors.danger }}>{joinRetryNotice}</Text>
              <SecondaryButton
                accessibilityLabel="가족 정보 다시 불러오기"
                disabled={isFinishingJoin}
                label={isFinishingJoin ? "다시 시도하는 중..." : "다시 시도"}
                onPress={() => void finishHouseholdJoin(joinedResult)}
              />
              {/* 라운드 60 리뷰(P1-1): 탈출구. 오프라인처럼 "잠시 후"로 풀리지 않는 실패에서
                  [다시 시도] 하나만 두면 참여를 마친 사람이 이 화면에 묶인다(수락은 이미
                  성공했으므로 다시 누를 수도, 뒤로 갈 수도 없다). 목적지는 계정 상태가
                  정한다 -- 판정은 순수 모듈에 있고 화면은 그 결과만 따른다. */}
              <SecondaryButton
                accessibilityLabel="나중에 하고 앱 둘러보기"
                disabled={isFinishingJoin}
                label={HOUSEHOLD_JOIN_ESCAPE_LABEL}
                onPress={() => {
                  const escape = householdJoinEscapePlan({ currentChildId: selectedChildId, hasReachedHome });
                  if (escape.marksHomeReached) markHomeReached();
                  router.replace(escape.href);
                }}
              />
            </Card>
          </View>
        ) : null}

        {/* 라운드 70 A(ⓔ): 끝난 초대에서는 **지킬 수 없는 약속을 하지 않는다.** 종전에는 이
            아래 두 갈래가 `invite.isError`와 무관하게 그려져서, 계정이 없는 사람이 "로그인하면
            이 초대로 바로 돌아와서 참여할 수 있어요."를 믿고 카카오 로그인·약관 동의·계정
            생성까지 마치고 돌아와 **똑같은 실패**를 다시 읽었다. 참여 버튼도 같은 이유로 접는다
            (그 버튼이 이 갈래의 [다시 시도]다 — 눌러 봐야 같은 400이 온다). */}
        {inviteUnavailable ? null : !authToken ? (
          <>
            <Text style={mutedTextStyle}>로그인하면 이 초대로 바로 돌아와서 참여할 수 있어요.</Text>
            <PrimaryButton
              label="로그인하고 참여하기"
              disabled={!loginHref}
              onPress={() => {
                // FIX-121C(F4): push가 아니라 replace. 로그인 성공 후 login.tsx가 이 수락 화면을
                // 다시 replace로 열기 때문에, push로 쌓아 두면 스택에 수락 화면이 두 겹 남는다 --
                // 참여 뒤 뒤로가기로 옛 수락 화면에 돌아와 다시 "참여하기"를 누르면 409
                // (HOUSEHOLD_ALREADY_MEMBER)만 보게 된다. 로그인 화면은 초대 토큰을 파라미터로
                // 들고 가므로 되돌아올 길은 스택이 아니라 그 파라미터가 보장한다.
                if (loginHref) router.replace(loginHref);
              }}
            />
          </>
        ) : (
          <PrimaryButton
            label={accept.isPending ? "참여하는 중..." : "가족에 참여하기"}
            // 라운드 60 #3: 이미 참여에 성공했다면(joinedResult) 이 버튼은 다시 눌릴 수 없다 --
            // 뒤처리만 실패해 화면에 남은 상태에서 다시 누르면 409뿐이다. 재시도는 위 카드가 맡는다.
            disabled={!invite.data || accept.isPending || Boolean(joinedResult)}
            onPress={() => accept.mutate()}
          />
        )}
      </View>
    </AppScreen>
  );
}

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13
} as const;

const inviteHouseholdNameStyle = {
  color: theme.colors.brown,
  fontSize: 16,
  fontWeight: "800"
} as const;

const inviteRoleStyle = {
  color: theme.colors.mainCoral,
  fontSize: 13,
  fontWeight: "700"
} as const;

const inviteExpiryStyle = {
  color: theme.colors.gray600,
  fontSize: 12
} as const;
