import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
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

type MoreMenuRoute = (typeof moreMenuRows)[number]["route"];

function MoreMenuRow({ icon, title, route }: { icon: string; title: string; route: MoreMenuRoute }) {
  return (
    <Pressable onPress={() => router.push(route)} style={moreMenuRowStyle()}>
      <Text style={moreMenuIconStyle}>{icon}</Text>
      <Text style={moreMenuTitleStyle}>{title}</Text>
      <Text style={moreMenuChevronStyle}>›</Text>
    </Pressable>
  );
}

export default function MoreScreen() {
  return (
    <AppScreen>
      <View accessibilityLabel={moreReferenceScreenId} style={moreReferenceFrameStyle()}>
        <View style={moreHeaderRowStyle}>
          <Text style={moreTitleStyle}>더보기</Text>
          <Pressable onPress={() => router.push("/settings")} style={moreSearchButtonStyle}>
            <Text style={moreSearchTextStyle}>⌕</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/family")} style={moreProfileCardStyle}>
          <Image source={moreAvatarImage} style={moreAvatarStyle()} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={moreChildNameStyle}>다온이</Text>
            <Text style={moreChildAgeStyle}>24개월</Text>
          </View>
        </Pressable>

        <View style={moreMenuGroupStyle()}>
          {moreMenuRows.map((row) => (
            <MoreMenuRow key={row.title} icon={row.icon} title={row.title} route={row.route} />
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
