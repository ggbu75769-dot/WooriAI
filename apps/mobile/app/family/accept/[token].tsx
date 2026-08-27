import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { hasApiErrorCode } from "../../../src/api/api-error";
import { acceptInvite, getInvite, listChildren, LOCAL_SESSION_TOKEN } from "../../../src/api/client";
import {
  HOUSEHOLD_JOIN_INVALIDATE_KEYS,
  loginHrefForInvite,
  planAfterHouseholdJoin
} from "../../../src/children/household-join";
import { formatInviteExpiry } from "../../../src/family/memberLabels";
// 라운드 41 K-3: 참여 직후 표·가구 목록을 서버 기준으로 한 벌로 다시 받는다(재검증 단일 소스).
import { revalidateHouseholdRoles } from "../../../src/family/useExpenseEntryGate";
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

const loadFailedText = "초대 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
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
  const queryClient = useQueryClient();
  // FAM-121A: 비로그인 방문자가 로그인 화면으로 갈 때 초대 토큰을 함께 실어 보내는 목적지.
  // 로그인 성공 후 app/(auth)/login.tsx가 이 초대 수락 화면으로 되돌려 준다.
  const loginHref = loginHrefForInvite(token);

  const invite = useQuery({
    queryKey: ["invite", token],
    enabled: Boolean(token),
    queryFn: () => getInvite(token)
  });

  const accept = useMutation({
    mutationFn: () => acceptInvite(authToken!, token),
    /**
     * FAM-121A: 예전에는 defaultHouseholdId만 바꾸고 끝나서 ["children"]·["household-members"]가
     * 예전 가구 응답 그대로 남고, 선택된 아이도 이전 가구 아이를 계속 가리켰다. R19-C의
     * 삭제/탈퇴 뒤처리(app/settings/privacy.tsx)와 같은 순서로 정리한다:
     * 새 목록 조회 -> 캐시 무효화 -> 계획대로 아이 재선택 + 안내 -> 이동.
     */
    onSuccess: async (result) => {
      if (!isTestSession) {
        useSessionStore.setState({ defaultHouseholdId: result.household.id });
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
      // 데모(local-backend) 세션은 가구가 하나뿐이라 "다른 가구로 참여"를 모사하지 않는다
      // (FIX-118B(F3)와 같은 정직성 규칙) -- 알 수 없음으로 두어 허위 전환 안내를 막는다.
      const children = isDemoSession
        ? null
        : await listChildren(authToken!)
            .then((response) => response.children)
            .catch(() => null);
      await Promise.all(
        HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
      );
      const plan = planAfterHouseholdJoin({
        householdId: result.household.id,
        children,
        currentChildId: selectedChildId
      });
      const joinedText = `${result.household.name}과 함께해요.`;
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
      Alert.alert("가족에 참여했어요", joinedText, [
        { text: "확인", onPress: () => router.replace(plan.href) }
      ]);
    }
  });

  return (
    <AppScreen>
      <View testID="screen-FAM-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="가족 관리" title="초대 수락" subtitle="초대받은 가족에 참여해요" />

        {invite.isLoading ? (
          <Card>
            <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
          </Card>
        ) : null}

        {invite.isError ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
            <SecondaryButton label="다시 시도" onPress={() => invite.refetch()} />
          </Card>
        ) : null}

        {invite.data ? (
          <Card style={{ gap: 8 }}>
            <Text style={inviteHouseholdNameStyle}>{invite.data.householdName}</Text>
            <Text style={inviteRoleStyle}>{roleLabel[invite.data.role] ?? invite.data.role}</Text>
            <Text style={inviteExpiryStyle}>{formatInviteExpiry(invite.data.expiresAt)}</Text>
          </Card>
        ) : null}

        {accept.isError ? <Text style={{ color: theme.colors.danger }}>{acceptErrorText(accept.error)}</Text> : null}

        {!authToken ? (
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
            disabled={!invite.data || accept.isPending}
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
