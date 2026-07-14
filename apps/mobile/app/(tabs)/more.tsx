import { useQuery } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { getHome, LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { MoreSettingsPixelStyles } from "../../src/pixelLock/styles";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppIcon, AppScreen, EmptyStateCard, SampleDataBanner, type AppIconName } from "../../src/ui";

const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
const moreReferenceScreenId = "pixel-screen-SET-001 SET-001 · FAM-001 · IMP-001";
const appInfoText = "버전 0.0.0 · com.anonymous.wooriai";

type MenuRow = {
  icon: AppIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function MoreMenuRow({ icon, title, subtitle, onPress }: MenuRow) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={moreMenuRowStyle()}>
      <AppIcon color={theme.colors.coral[600]} name={icon} size={22} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={moreMenuTitleStyle}>{title}</Text>
        <Text style={moreMenuSubtitleStyle}>{subtitle}</Text>
      </View>
      <AppIcon color={theme.colors.gray600} name="chevron-right" size={22} />
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

  if (!hasSession && !isPixelLockMode) {
    return <Redirect href="/launch-animation" />;
  }

  if (hasSession && home.isLoading) {
    return (
      <AppScreen>
        {isTestSession ? <SampleDataBanner /> : null}
        <EmptyStateCard title="프로필을 불러오고 있어요." actionLabel="잠시만요" />
      </AppScreen>
    );
  }

  if (hasSession && home.isError) {
    return (
      <AppScreen>
        <EmptyStateCard title="프로필을 불러오지 못했어요." actionLabel="다시 시도" onPress={() => home.refetch()} />
      </AppScreen>
    );
  }

  const profile = hasSession ? home.data?.child : isPixelLockMode ? { nickname: "우리아이", stageLabel: "샘플 단계" } : null;
  if (!profile) return <Redirect href="/onboarding/child-status" />;

  const rows: MenuRow[] = [
    { icon: "account-outline", title: "내 계정", subtitle: "로그인과 계정 정보를 관리해요", onPress: () => router.push("/profile" as Href) },
    { icon: "account-child-outline", title: "아이 프로필", subtitle: "아이 정보와 성장 단계를 확인해요", onPress: () => router.push("/children" as Href) },
    { icon: "account-group-outline", title: "가족", subtitle: "멤버와 권한, 초대를 관리해요", onPress: () => router.push("/family") },
    { icon: "wallet-outline", title: "비용 설정", subtitle: "예산과 기록 설정을 관리해요", onPress: () => router.push("/budget") },
    { icon: "file-excel-outline", title: "엑셀 가져오기", subtitle: "저장 전 미리보기로 확인해요", onPress: () => router.push("/import") },
    { icon: "shield-lock-outline", title: "약관 및 개인정보", subtitle: "동의와 데이터 삭제를 관리해요", onPress: () => router.push("/settings/privacy") },
    { icon: "information-outline", title: "앱 정보", subtitle: "버전과 서비스 정보를 확인해요", onPress: () => Alert.alert("앱 정보", appInfoText) }
  ];

  return (
    <AppScreen>
      <View accessibilityLabel={moreReferenceScreenId} style={moreReferenceFrameStyle()}>
        {isTestSession ? <SampleDataBanner /> : null}
        <Text style={moreTitleStyle}>내 프로필</Text>

        <Pressable accessibilityRole="button" onPress={() => router.push("/children" as Href)} style={moreProfileCardStyle}>
          <AppIcon color={theme.colors.coral[600]} name="account-child-circle" size={52} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={moreChildNameStyle}>{profile.nickname}</Text>
            <Text style={moreChildAgeStyle}>{profile.stageLabel}</Text>
          </View>
          <AppIcon color={theme.colors.gray600} name="chevron-right" size={22} />
        </Pressable>

        <View style={moreMenuGroupStyle()}>
          {rows.map((row) => (
            <MoreMenuRow key={row.title} {...row} />
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

const moreTitleStyle = {
  color: theme.colors.gray900,
  fontSize: 22,
  fontWeight: "800",
  lineHeight: 30
} as const;

const moreProfileCardStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: MoreSettingsPixelStyles.cardRadius,
  borderWidth: 1,
  flexDirection: "row",
  gap: 12,
  minHeight: 76,
  paddingHorizontal: 14
} as const;

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
    minHeight: Math.max(MoreSettingsPixelStyles.rowHeight, 62),
    paddingHorizontal: 14,
    paddingVertical: 9
  } as const;
}

const moreMenuTitleStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "700"
} as const;

const moreMenuSubtitleStyle = {
  color: theme.colors.gray600,
  fontSize: 11,
  lineHeight: 16
} as const;
