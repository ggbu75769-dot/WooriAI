import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pressable, Share, Text, View } from "react-native";
import { createInvite, LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN, type InviteRole } from "../../src/api/client";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, PrimaryButton, ScreenHeader, SecondaryButton } from "../../src/ui";

const roleOptions: Array<{ role: InviteRole; label: string; description: string }> = [
  { role: "co_parent", label: "공동부모", description: "지출 기록과 예산을 함께 관리할 수 있어요" },
  { role: "viewer", label: "보기 전용", description: "기록만 확인할 수 있어요" },
  { role: "gift_participant", label: "선물 참여", description: "선물 준비 목록만 함께 볼 수 있어요" }
];

const createFailedText = "초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

function formatInviteExpiry(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return `${date.getMonth() + 1}월 ${date.getDate()}일까지 유효해요`;
}

export default function FamilyInviteScreen() {
  const [role, setRole] = useState<InviteRole>("co_parent");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);

  const invite = useMutation({
    mutationFn: () => createInvite(authToken!, householdId!, role, "link")
  });

  const handleShare = async () => {
    if (!invite.data) return;
    try {
      await Share.share({ message: `우리아이 가족 초대 링크: ${invite.data.inviteUrl}` });
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <AppScreen>
      <View testID="screen-FAM-002" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="가족 관리" title="가족 초대" subtitle="함께할 역할을 선택하고 초대 링크를 만들어요" />

        <Card style={{ gap: 8 }}>
          {roleOptions.map((option) => (
            <Pressable
              key={option.role}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}, ${option.description}`}
              accessibilityState={{ selected: role === option.role }}
              disabled={invite.isPending}
              onPress={() => setRole(option.role)}
              style={[roleRowStyle, role === option.role ? roleRowSelectedStyle : null]}
            >
              <View style={{ flex: 1 }}>
                <Text style={role === option.role ? roleLabelSelectedStyle : roleLabelStyle}>{option.label}</Text>
                <Text style={roleDescriptionStyle}>{option.description}</Text>
              </View>
              {role === option.role ? <Text style={roleCheckStyle}>✓</Text> : null}
            </Pressable>
          ))}
        </Card>

        {!householdId ? <Text style={mutedTextStyle}>가구 정보가 없어서 초대를 만들 수 없어요.</Text> : null}

        <PrimaryButton
          label={invite.isPending ? "링크 만드는 중..." : "초대 링크 만들기"}
          disabled={!authToken || !householdId || invite.isPending}
          onPress={() => invite.mutate()}
        />

        {invite.isError ? <Text style={{ color: theme.colors.danger }}>{createFailedText}</Text> : null}

        {invite.data ? (
          <Card style={{ gap: 10 }}>
            <Text style={inviteSuccessTitleStyle}>초대 링크가 준비됐어요</Text>
            {/*
              FAM-121B: `selectable` gives a real copy affordance (길게 눌러 복사) without
              adding a clipboard dependency — expo-clipboard is not in apps/mobile's
              dependencies and this ticket doesn't introduce new ones, so Share stays the
              one-tap path and long-press-to-copy covers "copy the link" natively.
            */}
            <Text
              selectable
              accessibilityHint="길게 눌러서 링크를 복사할 수 있어요"
              style={inviteLinkStyle}
            >
              {invite.data.inviteUrl}
            </Text>
            <Text style={inviteExpiryStyle}>{formatInviteExpiry(invite.data.expiresAt)}</Text>
            <SecondaryButton label="링크 공유하기" onPress={handleShare} />
            {/*
              Honest warning, matching how the server stores invites: only a sha256 hash
              of the token is kept, so this link can never be shown again. 가족 화면의
              "대기 중인 초대"에서 취소하고 새로 만드는 것이 유일한 복구 경로다.
            */}
            <Text style={mutedTextStyle}>
              이 링크는 지금 화면에서만 볼 수 있어요. 지금 공유하거나 길게 눌러 복사해 두세요. 잃어버리면 가족 화면의 “대기 중인 초대”에서 취소하고 새로 만들 수 있어요.
            </Text>
            {isTestSession ? (
              <Text style={mutedTextStyle}>테스트 모드예요. 이 초대 링크는 실제로 전송되지 않아요.</Text>
            ) : null}
          </Card>
        ) : null}
      </View>
    </AppScreen>
  );
}

const roleRowStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.small,
  borderWidth: 1,
  flexDirection: "row",
  gap: 10,
  paddingHorizontal: 14,
  paddingVertical: 12
} as const;

const roleRowSelectedStyle = {
  backgroundColor: theme.colors.primary100,
  borderColor: theme.colors.mainCoral
} as const;

const roleLabelStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "700"
} as const;

const roleLabelSelectedStyle = {
  color: theme.colors.mainCoral,
  fontSize: 14,
  fontWeight: "800"
} as const;

const roleDescriptionStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  marginTop: 2
} as const;

const roleCheckStyle = {
  color: theme.colors.mainCoral,
  fontSize: 16,
  fontWeight: "800"
} as const;

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 12
} as const;

const inviteSuccessTitleStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "800"
} as const;

const inviteLinkStyle = {
  color: theme.colors.mainCoral,
  fontSize: 13,
  fontWeight: "700"
} as const;

const inviteExpiryStyle = {
  color: theme.colors.gray600,
  fontSize: 12
} as const;
