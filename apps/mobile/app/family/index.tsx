import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { createInvite, listHouseholdMembers } from "../../src/api/client";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, FamilyAvatarGroup, StatusBadge } from "../../src/ui";
import { FamilyPixelStyles } from "../../src/pixelLock/styles";

const previewMembers = [
  { id: "preview-mom", avatar: "엄", displayName: "엄마 (나)", role: "owner", status: "active" },
  { id: "preview-dad", avatar: "아", displayName: "아빠", role: "co_parent", status: "active" },
  { id: "preview-grandma", avatar: "할", displayName: "할머니", role: "viewer", status: "pending" }
] as const;

const familyReferenceScreenId = "pixel-screen-FAM-001 FAM-001";
function familyReferenceFrameStyle() {
  return {
    gap: 16,
    transform: [
      { translateX: FamilyPixelStyles.horizontalOffset },
      { translateY: FamilyPixelStyles.topOffset },
      { scale: FamilyPixelStyles.scale }
    ]
  } as const;
}
const familyInviteRows = [
  { icon: "↗", title: "링크로 초대", value: "" },
  { icon: "□", title: "초대 코드 공유", value: "DAON2025" }
] as const;

function FamilyPixelStatusBar() {
  return (
    <View style={familyStatusBarStyle}>
      <Text style={familyStatusTextStyle}>9:41</Text>
      <View style={familySignalGroupStyle}>
        <View style={familySignalDotStyle} />
        <View style={familySignalPillStyle} />
        <View style={familyBatteryStyle} />
      </View>
    </View>
  );
}

function FamilyInviteRow({ icon, title, value, onPress }: { icon: string; title: string; value?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={familyInviteRowStyle}>
      <Text style={familyInviteIconStyle}>{icon}</Text>
      <Text style={familyInviteTitleStyle}>{title}</Text>
      {value ? <Text style={familyInviteValueStyle}>{value}</Text> : null}
      <Text style={familyInviteChevronStyle}>›</Text>
    </Pressable>
  );
}

export default function FamilyScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(accessToken && householdId),
    queryFn: () => listHouseholdMembers(accessToken!, householdId!)
  });
  const quickInvite = useMutation({
    mutationFn: () => createInvite(accessToken!, householdId!, "co_parent", "link"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
      router.push("/family/invite");
    }
  });
  const visibleMembers = members.data?.members ?? previewMembers;
  const avatarNames = visibleMembers.map((member) => ("avatar" in member ? member.avatar : member.displayName));
  const openInvite = () => {
    if (accessToken && householdId) quickInvite.mutate();
    else router.push("/family/invite");
  };

  return (
    <AppScreen>
      <View accessibilityLabel={familyReferenceScreenId} style={familyReferenceFrameStyle()}>
        <FamilyPixelStatusBar />

        <View style={familyHeaderRowStyle}>
          <Text style={familyBackStyle}>‹</Text>
          <Text style={familyTitleStyle}>가족과 함께</Text>
        </View>

        <View style={familyAvatarRowStyle}>
          <FamilyAvatarGroup names={avatarNames} />
          <Pressable onPress={openInvite} style={familyPlusButtonStyle}>
            <Text style={familyPlusTextStyle}>+</Text>
          </Pressable>
        </View>

        <Card style={familyProfileCardStyle}>
          <Text style={familyProfileTitleStyle}>우리아이 가족계정</Text>
          <View style={familyProfileBodyStyle}>
            <FamilyAvatarGroup names={["다"]} />
            <View>
              <Text style={familyProfileNameStyle}>다온이 패밀리</Text>
              <Text style={familyProfileMetaStyle}>엄마 · 아빠 · 할머니</Text>
            </View>
          </View>
        </Card>

        <Text style={familySectionTitleStyle}>초대하기</Text>
        <View style={familyInviteGroupStyle}>
          {familyInviteRows.map((row) => (
            <FamilyInviteRow key={row.title} icon={row.icon} title={row.title} value={row.value} onPress={openInvite} />
          ))}
        </View>

        <Text style={familySectionTitleStyle}>멤버 관리</Text>
        <View style={familyMemberGroupStyle}>
          {visibleMembers.map((member) => (
            <View key={member.id} style={familyMemberRowStyle}>
              <FamilyAvatarGroup names={["avatar" in member ? member.avatar : member.displayName]} />
              <Text style={familyMemberNameStyle}>{member.displayName}</Text>
              <StatusBadge label={member.role === "owner" ? "관리자" : "멤버"} tone={member.role === "owner" ? "warning" : "neutral"} />
            </View>
          ))}
        </View>

        <Pressable onPress={openInvite} style={familyInviteButtonStyle}>
          <Text style={familyInviteButtonTextStyle}>가족 초대하기</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const familyStatusBarStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 14
} as const;

const familyStatusTextStyle = {
  color: theme.colors.gray900,
  fontSize: 11,
  fontWeight: "800"
} as const;

const familySignalGroupStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 5
} as const;

const familySignalDotStyle = {
  backgroundColor: theme.colors.gray900,
  borderRadius: 4,
  height: 7,
  width: 7
} as const;

const familySignalPillStyle = {
  backgroundColor: theme.colors.gray900,
  borderRadius: 5,
  height: 8,
  width: 10
} as const;

const familyBatteryStyle = {
  backgroundColor: theme.colors.gray900,
  borderRadius: 2,
  height: 8,
  width: 14
} as const;

const familyHeaderRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 4
} as const;

const familyBackStyle = {
  color: theme.colors.gray900,
  fontSize: 24,
  fontWeight: "900"
} as const;

const familyTitleStyle = {
  color: theme.colors.gray900,
  fontSize: 22,
  fontWeight: "800",
  lineHeight: 30
} as const;

const familyAvatarRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const familyPlusButtonStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.10)",
  borderRadius: 22,
  borderWidth: 1,
  height: 44,
  justifyContent: "center",
  width: 44,
  ...theme.shadows.card
} as const;

const familyPlusTextStyle = {
  color: theme.colors.gray900,
  fontSize: 24,
  fontWeight: "700"
} as const;

const familyProfileCardStyle = {
  gap: 14,
  paddingVertical: 18
} as const;

const familyProfileTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800"
} as const;

const familyProfileBodyStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 12
} as const;

const familyProfileNameStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800",
  lineHeight: 22
} as const;

const familyProfileMetaStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18
} as const;

const familySectionTitleStyle = {
  color: theme.colors.gray900,
  fontSize: 15,
  fontWeight: "800",
  marginTop: 2
} as const;

const familyInviteGroupStyle = {
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: 18,
  borderWidth: 1,
  overflow: "hidden"
} as const;

const familyInviteRowStyle = {
  alignItems: "center",
  borderBottomColor: "rgba(74, 63, 53, 0.08)",
  borderBottomWidth: 1,
  flexDirection: "row",
  gap: 10,
  minHeight: 52,
  paddingHorizontal: 14
} as const;

const familyInviteIconStyle = {
  color: theme.colors.gray600,
  fontSize: 15,
  width: 18
} as const;

const familyInviteTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 14,
  fontWeight: "800"
} as const;

const familyInviteValueStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "700"
} as const;

const familyInviteChevronStyle = {
  color: theme.colors.gray600,
  fontSize: 18,
  fontWeight: "700"
} as const;

const familyMemberGroupStyle = {
  gap: 8
} as const;

const familyMemberRowStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: 16,
  borderWidth: 1,
  flexDirection: "row",
  gap: 10,
  minHeight: 52,
  paddingHorizontal: 12,
  ...theme.shadows.card
} as const;

const familyMemberNameStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 15,
  fontWeight: "800"
} as const;

const familyInviteButtonStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.12)",
  borderRadius: 16,
  borderWidth: 1,
  height: 52,
  justifyContent: "center"
} as const;

const familyInviteButtonTextStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "800"
} as const;
