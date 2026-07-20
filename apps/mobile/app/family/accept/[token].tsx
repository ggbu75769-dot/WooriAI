import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { acceptInvite, getInvite, fixtureSessionToken } from "../../../src/api/client";
import { useSessionStore } from "../../../src/stores/session.store";
import { theme } from "../../../src/theme";
import { AppScreen, Card, PrimaryButton, ScreenHeader, SecondaryButton } from "../../../src/ui";

const roleLabel: Record<string, string> = {
  co_parent: "기록 가능",
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
  const authToken = accessToken ?? (isTestSession ? fixtureSessionToken : null);

  const invite = useQuery({
    queryKey: ["invite", token],
    enabled: Boolean(token),
    queryFn: () => getInvite(token)
  });

  const accept = useMutation({
    mutationFn: () => acceptInvite(authToken!, token),
    onSuccess: (result) => {
      if (!isTestSession) {
        useSessionStore.setState({ defaultHouseholdId: result.household.id });
      }
      Alert.alert("가족에 참여했어요", `${result.household.name}과 함께해요.`, [
        { text: "확인", onPress: () => router.replace("/family") }
      ]);
    }
  });

  return (
    <AppScreen>
      <View testID="screen-FAM-003" accessibilityLabel="screen-FAM-003" style={{ gap: theme.spacing.section }}>
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

        {!authToken ? <Text style={mutedTextStyle}>로그인 후 가족에 참여할 수 있어요.</Text> : null}
        {accept.isError ? <Text style={{ color: theme.colors.danger }}>{acceptErrorText(accept.error)}</Text> : null}

        <PrimaryButton
          label={accept.isPending ? "참여하는 중..." : "가족에 참여하기"}
          disabled={!invite.data || !authToken || accept.isPending}
          onPress={() => accept.mutate()}
        />
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
