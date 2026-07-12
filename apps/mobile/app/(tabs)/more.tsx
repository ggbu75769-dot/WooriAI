import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { getHome, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { MoreSettingsPixelStyles } from "../../src/pixelLock/styles";
import { theme } from "../../src/theme";
import { AppScreen } from "../../src/ui";

const moreAvatarImage = require("../../assets/illustrations/toddler.png");
const moreReferenceScreenId = "pixel-screen-SET-001 SET-001 · FAM-001 · IMP-001";
const moreMenuRows = [
  { icon: "♙", title: "프로필 관리", route: "/family" },
  { icon: "♧", title: "알림 설정", route: "/settings" },
  { icon: "⌁", title: "데이터 백업", route: "/import" },
  { icon: "?", title: "고객센터", route: "/settings/privacy" },
  { icon: "ⓘ", title: "앱 정보", route: "/settings/privacy" }
] as const;

const previewProfile = { nickname: "다온이", stageLabel: "24개월" };

const appInfoText = "버전 0.0.0 · com.anonymous.wooriai";

function MoreMenuRow({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={moreMenuRowStyle()}>
      <Text style={moreMenuIconStyle}>{icon}</Text>
      <Text style={moreMenuTitleStyle}>{title}</Text>
      <Text style={moreMenuChevronStyle}>›</Text>
    </Pressable>
  );
}

export default function MoreScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const hasSession = Boolean(authToken && childId);
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: hasSession,
    queryFn: () => getHome(authToken!, childId!)
  });
  const visibleProfile = hasSession && home.data ? home.data.child : previewProfile;

  const handleSearchPress = () => {
    router.push(hasSession ? "/(tabs)/records" : "/settings");
  };

  const sessionMenuRows = [
    { icon: "♙", title: "프로필 관리", onPress: () => router.push("/family") },
    { icon: "♧", title: "알림 설정", onPress: () => router.push("/notifications") },
    { icon: "⌁", title: "엑셀 가져오기", onPress: () => router.push("/import") },
    { icon: "?", title: "약관 및 개인정보", onPress: () => router.push("/settings/privacy") },
    { icon: "ⓘ", title: "앱 정보", onPress: () => Alert.alert("앱 정보", appInfoText) }
  ];
  const previewMenuRowActions = moreMenuRows.map((row) => ({
    icon: row.icon,
    title: row.title,
    onPress: () => router.push(row.route)
  }));
  const visibleMenuRows = hasSession ? sessionMenuRows : previewMenuRowActions;

  return (
    <AppScreen>
      <View accessibilityLabel={moreReferenceScreenId} style={moreReferenceFrameStyle()}>
        <View style={moreHeaderRowStyle}>
          <Text style={moreTitleStyle}>더보기</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasSession ? "기록 검색" : "설정"}
            onPress={handleSearchPress}
            style={moreSearchButtonStyle}
          >
            <Text style={moreSearchTextStyle}>⌕</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/family")} style={moreProfileCardStyle}>
          <Image source={moreAvatarImage} style={moreAvatarStyle()} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={moreChildNameStyle}>{visibleProfile.nickname}</Text>
            <Text style={moreChildAgeStyle}>{visibleProfile.stageLabel}</Text>
          </View>
        </Pressable>

        <View style={moreMenuGroupStyle()}>
          {visibleMenuRows.map((row) => (
            <MoreMenuRow key={row.title} icon={row.icon} title={row.title} onPress={row.onPress} />
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

function moreReferenceFrameStyle() {
  return {
    gap: 18 + MoreSettingsPixelStyles.rowGap,
    marginHorizontal: MoreSettingsPixelStyles.screenPadding - theme.spacing.screen,
    paddingTop: 0,
    transform: [{ translateX: MoreSettingsPixelStyles.horizontalOffset }, { translateY: MoreSettingsPixelStyles.topOffset }]
  } as const;
}

const moreHeaderRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const moreTitleStyle = {
  color: theme.colors.gray900,
  fontSize: 22,
  fontWeight: "800",
  lineHeight: 30
} as const;

const moreSearchButtonStyle = {
  alignItems: "center",
  height: 36,
  justifyContent: "center",
  width: 36
} as const;

const moreSearchTextStyle = {
  color: theme.colors.gray900,
  fontSize: 22,
  fontWeight: "700"
} as const;

const moreProfileCardStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 12,
  paddingVertical: 2
} as const;

function moreAvatarStyle() {
  return {
    borderRadius: MoreSettingsPixelStyles.avatarSize / 2,
    height: MoreSettingsPixelStyles.avatarSize,
    width: MoreSettingsPixelStyles.avatarSize
  } as const;
}

const moreChildNameStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800",
  lineHeight: 21
} as const;

const moreChildAgeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "700",
  lineHeight: 18
} as const;

function moreMenuGroupStyle() {
  return {
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.08)",
    borderRadius: MoreSettingsPixelStyles.cardRadius,
    borderWidth: 1,
    overflow: "hidden"
  } as const;
}

function moreMenuRowStyle() {
  return {
    alignItems: "center",
    borderBottomColor: "rgba(74, 63, 53, 0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: MoreSettingsPixelStyles.rowHeight,
    paddingHorizontal: 14
  } as const;
}

const moreMenuIconStyle = {
  color: theme.colors.gray600,
  fontSize: 14,
  width: 18
} as const;

const moreMenuTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 14,
  fontWeight: "700"
} as const;

const moreMenuChevronStyle = {
  color: theme.colors.gray600,
  fontSize: 18,
  fontWeight: "700"
} as const;
