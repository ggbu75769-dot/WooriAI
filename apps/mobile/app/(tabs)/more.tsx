import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { getHome, LOCAL_SESSION_TOKEN } from "../../src/api/client";
// EXP-106 내보내기 흐름은 설정 화면과 공유하는 공용 모듈에 있다 (CLEAN-123/A3).
import {
  EXPORT_MENU_TITLE,
  EXPORT_SIGNED_OUT_CAPTION,
  ExpenseCsvExportCard,
  ExpenseCsvExportToast,
  useExpenseCsvExport
} from "../../src/export/ExpenseCsvExport";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { MoreSettingsPixelStyles } from "../../src/pixelLock/styles";
import { theme } from "../../src/theme";
// AppScreen only -- the pixel-locked more screen must stay the compact reference menu (no header
// or coral CTA button from the shared kit); see "locks the more route" in src/ui-pixel-lock-flow.test.ts.
import { AppScreen } from "../../src/ui";

const moreAvatarImage = require("../../assets/illustrations/toddler.png");
const moreReferenceScreenId = "pixel-screen-SET-001 SET-001 · FAM-001 · IMP-001";
// UX-5B-9: 미리보기(로그아웃) 메뉴도 라벨과 목적지가 일치하도록 정리 -- "알림 설정"→/settings,
// "데이터 백업"→/import, "고객센터"→/settings/privacy 같은 눈속임 라우팅을 제거했다.
const moreMenuRows = [
  { icon: "♙", title: "프로필 관리", route: "/family" },
  { icon: "⌁", title: "엑셀로 가져오기", route: "/import" },
  { icon: "?", title: "약관 및 개인정보", route: "/settings/privacy" }
] as const;

const previewProfile = { nickname: "다온이", stageLabel: "24개월" };
// Shown only while a real/test session's home query is still loading, so the no-session preview
// profile above never flashes on screen for a signed-in user before their real data arrives.
const loadingProfile = { nickname: "...", stageLabel: "..." };

// UX-5B-7: 하드코딩된 "버전 0.0.0 · com.anonymous.wooriai" 대신 expo-constants가 읽어주는
// 실제 앱 설정의 버전을 표시한다. (패키지명은 expo-application 미설치로 표시하지 않는다.)
const appInfoText = `버전 ${Constants.expoConfig?.version ?? "알 수 없음"}`;

function MoreMenuRow({ icon, title, caption, onPress }: { icon: string; title: string; caption?: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${title}, ${caption}` : title}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={moreMenuRowStyle()}
    >
      <Text style={moreMenuIconStyle}>{icon}</Text>
      <Text style={moreMenuTitleStyle}>{title}</Text>
      {caption ? <Text style={moreMenuCaptionStyle}>{caption}</Text> : <Text accessible={false} style={moreMenuChevronStyle}>›</Text>}
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
  const visibleProfile = hasSession ? (home.data?.child ?? loadingProfile) : previewProfile;

  // EXP-106 데이터 내보내기(CSV): 기간 선택 카드는 아래 메뉴 행으로 접었다 폈다 한다. 상태·수집·
  // 공유·토스트는 설정 화면과 공유하는 src/export/ExpenseCsvExport.tsx가 전부 담당한다.
  const csvExport = useExpenseCsvExport();

  const handleSearchPress = () => {
    router.push(hasSession ? "/(tabs)/records" : "/settings");
  };

  // NOTI-102: 알림 센터가 실제 기능이 되어 "알림 설정 · 준비 중" 비활성 행 대신 /notifications로 이동한다.
  // NAV-121: 로그인 상태에서 /settings로 가는 유일한 진입점 -- 이 행이 없으면 아이 관리 · 알림 설정 ·
  // 통계 동의 철회 · 로그아웃에 도달할 방법이 없다. (비로그인 미리보기는 헤더 ⌕ 버튼이 /settings로 간다.)
  const sessionMenuRows: Array<{ icon: string; title: string; caption?: string; onPress?: () => void }> = [
    { icon: "♙", title: "프로필 관리", onPress: () => router.push("/family") },
    { icon: "◐", title: "설정", onPress: () => router.push("/settings") },
    { icon: "♧", title: "알림", onPress: () => router.push("/notifications") },
    { icon: "⌁", title: "엑셀 가져오기", onPress: () => router.push("/import") },
    // EXP-106: 엑셀 가져오기의 반대 방향(데이터 이동성) -- 지출 기록을 CSV로 공유 시트에 내보낸다.
    { icon: "⇪", title: EXPORT_MENU_TITLE, onPress: csvExport.toggleCard },
    { icon: "?", title: "약관 및 개인정보", onPress: () => router.push("/settings/privacy") },
    { icon: "ⓘ", title: "앱 정보", onPress: () => Alert.alert("앱 정보", appInfoText) }
  ];
  const previewMenuRowActions: Array<{ icon: string; title: string; caption?: string; onPress?: () => void }> = [
    ...moreMenuRows.map((row) => ({
      icon: row.icon,
      title: row.title,
      onPress: () => router.push(row.route)
    })),
    // EXP-106: 미리보기(로그아웃)에서는 내보낼 세션 데이터가 없으므로 비활성 행 패턴
    // (캡션 + onPress 없음)으로 로그인 준비 안내만 보여준다.
    { icon: "⇪", title: EXPORT_MENU_TITLE, caption: EXPORT_SIGNED_OUT_CAPTION, onPress: undefined },
    // UX-5B-9: "앱 정보"는 어딘가로 위장 이동하는 대신 실제 버전 정보를 보여준다.
    { icon: "ⓘ", title: "앱 정보", onPress: () => Alert.alert("앱 정보", appInfoText) }
  ];
  const visibleMenuRows = hasSession ? sessionMenuRows : previewMenuRowActions;

  return (
    <AppScreen>
      <View testID={moreReferenceScreenId} style={moreReferenceFrameStyle()}>
        <View style={moreHeaderRowStyle}>
          <Text style={moreTitleStyle}>더보기</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasSession ? "기록 검색" : "설정"}
            hitSlop={4}
            onPress={handleSearchPress}
            style={moreSearchButtonStyle}
          >
            <Text style={moreSearchTextStyle}>⌕</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${visibleProfile.nickname} 프로필 관리`}
          onPress={() => router.push("/family")}
          style={moreProfileCardStyle}
        >
          <Image source={moreAvatarImage} style={moreAvatarStyle()} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={moreChildNameStyle}>{visibleProfile.nickname}</Text>
            <Text style={moreChildAgeStyle}>{visibleProfile.stageLabel}</Text>
          </View>
        </Pressable>

        <View style={moreMenuGroupStyle()}>
          {visibleMenuRows.map((row) => (
            <MoreMenuRow key={row.title} icon={row.icon} title={row.title} caption={row.caption} onPress={row.onPress} />
          ))}
        </View>

        <ExpenseCsvExportCard controller={csvExport} />

        <ExpenseCsvExportToast controller={csvExport} />
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

const moreMenuCaptionStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "700"
} as const;
