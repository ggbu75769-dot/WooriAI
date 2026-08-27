import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { acceptInvite, getInvite, listChildren, LOCAL_SESSION_TOKEN } from "../../../src/api/client";
import {
  HOUSEHOLD_JOIN_INVALIDATE_KEYS,
  loginHrefForInvite,
  planAfterHouseholdJoin
} from "../../../src/children/household-join";
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

// requestJson throws `new Error(JSON.stringify(body))`, so the server's error code (e.g.
// HOUSEHOLD_ALREADY_MEMBER from a 409) lives inside the message string. Retrying can never
// succeed for that case, so it gets a dedicated copy instead of the generic retry nudge.
function acceptErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return message.includes("ALREADY_MEMBER") ? alreadyMemberText : acceptFailedText;
}

function formatInviteExpiry(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return `${date.getMonth() + 1}월 ${date.getDate()}일까지 유효해요`;
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
                if (loginHref) router.push(loginHref);
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
