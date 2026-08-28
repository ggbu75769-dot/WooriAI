import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Alert, Image, Pressable, Text, View } from "react-native";
import {
  getHome,
  listChildren,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN
} from "../../src/api/client";
// EXP-106 내보내기 흐름은 설정 화면과 공유하는 공용 모듈에 있다 (CLEAN-123/A3).
import {
  EXPORT_MENU_TITLE,
  EXPORT_SIGNED_OUT_CAPTION,
  ExpenseCsvExportCard,
  ExpenseCsvExportToast,
  useExpenseCsvExport
} from "../../src/export/ExpenseCsvExport";
// 라운드 41 UX-U(A): 로그인 메뉴의 정보 구조(행 구성 · 이름 · 목적지)는 순수 모듈이 단일 소스다.
// DSN-053 P2-D: 그 모듈이 구획(MORE_MENU_SECTIONS)까지 정한다 -- 화면은 그 순서대로 그룹 박스만 만든다.
import {
  buildMoreSessionMenuRows,
  MORE_MENU_SECTIONS,
  MORE_PROFILE_CARD_ROUTE,
  type MoreMenuSection
} from "../../src/settings/more-menu";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { MoreSettingsPixelStyles } from "../../src/pixelLock/styles";
import { theme } from "../../src/theme";
// AppScreen only -- the pixel-locked more screen must stay the compact reference menu (no header
// or coral CTA button from the shared kit); see "locks the more route" in src/ui-pixel-lock-flow.test.ts.
// 라운드 49 QA(P2-3): EmptyStateCard·SkeletonRow가 더해졌지만 **세션 경로에서만** 그려진다 --
// 비로그인 미리보기(SET-001 픽셀 락 캡처)의 렌더는 한 픽셀도 바뀌지 않는다.
import { AppScreen, EmptyStateCard } from "../../src/ui";
// DSN-053 P2-D: stage pill은 앱이 이미 쓰는 한 벌(coral[50] 배경 · coral[700] 12/700)이다.
import { StageBadge } from "../../src/ui/StageBadge";
import { SkeletonRow } from "../../src/ui/Skeleton";

const moreAvatarImage = require("../../assets/illustrations/toddler.png");
// SET-001 승인 캡처의 가구 카드 마크. 브랜딩 자산은 P0에서 이미 같은 바이트로 맞춰져 있다.
const moreHouseholdLogoImage = require("../../assets/illustrations/logo_mark.png");
const moreReferenceScreenId = "pixel-screen-SET-001 SET-001 · FAM-001 · IMP-001";
// UX-5B-9: 미리보기(로그아웃) 메뉴도 라벨과 목적지가 일치하도록 정리 -- "알림 설정"→/settings,
// "데이터 백업"→/import, "고객센터"→/settings/privacy 같은 눈속임 라우팅을 제거했다.
// D1 후속(실기기 피드백 2 "아이콘들이 다 예전걸로 돌아간 것 같음"): 행 글리프(♙ ⌁ ?)를
// 탭바(app/(tabs)/_layout.tsx)와 같은 Ionicons outlined 계열로 바꾼다. 문구·순서·목적지는
// 그대로다 -- 같은 항목은 설정 화면(app/settings/index.tsx)·세션 메뉴(src/settings/more-menu.ts)와
// 같은 아이콘을 쓴다(가구=people, 가져오기=download, 약관·개인정보=shield-checkmark).
//
// 라운드 49 QA(P3-5): 첫 행의 아이콘이 person-circle-outline(=아이 프로필 계열)이었는데
// 목적지는 가구 화면(/family)이라, **같은 목적지가 화면마다 다른 그림**으로 보였다(세션 메뉴와
// 설정의 "가족 관리"는 people-outline). 라벨·순서·목적지는 픽셀 락 때문에 그대로 두고 아이콘만
// 맞춘다(SET-001 기준 이미지는 이미 D1 후속 재캡처 대상이다).
const moreMenuRows = [
  { icon: "people-outline", title: "프로필 관리", route: "/family" },
  { icon: "download-outline", title: "엑셀로 가져오기", route: "/import" },
  { icon: "shield-checkmark-outline", title: "약관 및 개인정보", route: "/settings/privacy" }
] as const satisfies readonly { icon: keyof typeof Ionicons.glyphMap; title: string; route: string }[];

const previewProfile = { nickname: "다온이", stageLabel: "24개월" };
// Shown only while a real/test session's home query is still loading, so the no-session preview
// profile above never flashes on screen for a signed-in user before their real data arrives.
const loadingProfile = { nickname: "...", stageLabel: "..." };

// UX-5B-7: 하드코딩된 "버전 0.0.0 · com.anonymous.wooriai" 대신 expo-constants가 읽어주는
// 실제 앱 설정의 버전을 표시한다. (패키지명은 expo-application 미설치로 표시하지 않는다.)
const appInfoText = `버전 ${Constants.expoConfig?.version ?? "알 수 없음"}`;

function MoreMenuRow({
  icon,
  title,
  caption,
  grouped = false,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption?: string;
  /**
   * DSN-053 P2-D: 세션("프로필") 구획 안의 행 문법 — 최소 높이 64에 coral[50] 원 40 안의
   * coral[700] 아이콘. **기본값 false**라 비로그인 미리보기(SET-001 픽셀 락 캡처)의 행은
   * 예전 그대로 44dp 높이 + 14px 인라인 아이콘이다(한 노드도 달라지지 않는다).
   */
  grouped?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${title}, ${caption}` : title}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={grouped ? moreSectionRowStyle : moreMenuRowStyle()}
    >
      {/* 아이콘은 장식이다 -- 행 이름·캡션은 바깥 Pressable의 accessibilityLabel이 읽어 준다.
          크기·색·열 폭은 예전 Text 스타일 토큰(moreMenuIconStyle)에서 그대로 읽어 쓴다. */}
      {grouped ? (
        <View style={moreSectionRowIconCircleStyle}>
          <Ionicons accessible={false} name={icon} size={22} color={theme.colors.coral[700]} />
        </View>
      ) : (
        <Ionicons
          accessible={false}
          name={icon}
          size={moreMenuIconStyle.fontSize}
          color={moreMenuIconStyle.color}
          style={{ width: moreMenuIconStyle.width }}
        />
      )}
      <Text style={grouped ? moreSectionRowTitleStyle : moreMenuTitleStyle}>{title}</Text>
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
  /**
   * DSN-053 P2-D — 가구 카드의 "보호자 N명 · 아이 M명".
   *
   * 두 조회 모두 **앱이 이미 쓰고 있는 캐시 키**를 그대로 읽는다: `["children"]`은 리포트 탭·
   * 아이 관리 화면과, `["household-members", householdId]`는 가족 화면과 같은 항목이다. 즉
   * 그 화면들을 한 번이라도 지나온 세션에서는 새 요청이 나가지 않고 캐시가 그대로 그려진다.
   *
   * 값이 아직 없으면 **줄 자체를 그리지 않는다**(아래 householdCaption). c20deeb 원본은
   * `활성 멤버 수 || 1`로 폴백했는데, 그러면 응답 전에는 3인 가구에도 "보호자 1명"이 떴다가
   * 뒤늦게 바뀐다 -- 세지 않은 수를 세었다고 말하는 자리라 그 폴백은 옮기지 않는다.
   */
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const children = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  const activeMemberCount = members.data?.members.filter((member) => member.status === "active").length ?? null;
  const childCount = children.data?.children.length ?? null;
  const householdCaption =
    activeMemberCount !== null && childCount !== null ? `보호자 ${activeMemberCount}명 · 아이 ${childCount}명` : null;
  /**
   * 라운드 49 QA(P2-3) — 홈·준비템·리포트(C-07)와 **같은 규칙**: 미리보기 픽스처에 닿는 유일한
   * 경로는 `!authToken`이다.
   *
   * 종전 기준은 `hasSession = authToken && childId`였고, 그래서 **토큰은 있는데 아이를 아직
   * 모르는 창**에서 이 카드가 "다온이 · 24개월"을 그렸다 -- 자기 아이가 아닌 이름과 개월수를
   * 자기 프로필로 읽게 되는 허위 표시다(마지막 아이 삭제 직후 오프라인 · childScopeRejected
   * 직후 · MOB-116 복구의 유예 3초에 실제로 생긴다).
   *
   * 이 탭은 홈·준비템처럼 화면 전체를 스켈레톤으로 바꾸지 않는다: 세션에서 설정(로그아웃·알림
   * 설정)으로 가는 **유일한 입구**가 여기라(NAV-121), 통째로 막으면 아이가 없는 사용자가 그
   * 자리에서 할 수 있는 일이 사라져 새 막다른 길이 된다. 대신 사실이 아닌 프로필 카드만
   * 스켈레톤 + 아이 선택 안내로 바꾸고, 메뉴는 토큰 기준으로 그대로 세션 메뉴를 쓴다.
   */
  const isChildPending = Boolean(authToken) && !childId;
  const visibleProfile = authToken ? (home.data?.child ?? loadingProfile) : previewProfile;

  // EXP-106 데이터 내보내기(CSV): 기간 선택 카드는 아래 메뉴 행으로 접었다 폈다 한다. 상태·수집·
  // 공유·토스트는 설정 화면과 공유하는 src/export/ExpenseCsvExport.tsx가 전부 담당한다.
  const csvExport = useExpenseCsvExport();

  const handleSearchPress = () => {
    router.push(hasSession ? "/(tabs)/records" : "/settings");
  };

  // 라운드 41 UX-U(A): 행 구성 · 이름 · 목적지는 src/settings/more-menu.ts(buildMoreSessionMenuRows)가
  // 정한다 -- 여기서는 그 스펙을 라우팅과 화면 안 동작(내보내기 카드 토글 · 앱 정보 Alert)에 잇기만
  // 한다. 비로그인 미리보기(previewMenuRowActions)는 SET-001 픽셀 락 캡처 경로라 손대지 않는다.
  //
  // NOTI-102: 알림 센터가 실제 기능이 되어 "알림 설정 · 준비 중" 비활성 행 대신 /notifications로 이동한다
  //   (라운드 41 UX-U: 설정 안의 "알림 설정"과 구분되도록 행 이름은 "알림함"이다).
  // NAV-121: 로그인 상태에서 /settings로 가는 유일한 진입점 -- 이 행이 없으면 알림 설정 · 통계 동의
  //   철회 · 로그아웃에 도달할 방법이 없다. (비로그인 미리보기는 헤더 ⌕ 버튼이 /settings로 간다.)
  // EXP-106: 엑셀 가져오기의 반대 방향(데이터 이동성) -- 지출 기록을 CSV로 공유 시트에 내보낸다.
  const sessionMenuRows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    caption?: string;
    /** DSN-053 P2-D: 세션 메뉴만 구획을 갖는다(비로그인 미리보기 행은 예전처럼 한 덩어리다). */
    section?: MoreMenuSection;
    onPress?: () => void;
  }> =
    buildMoreSessionMenuRows({ exportTitle: EXPORT_MENU_TITLE }).map((row) => {
      const route = row.route;
      return {
        icon: row.icon,
        title: row.title,
        section: row.section,
        onPress: route
          ? () => router.push(route)
          : row.id === "export"
            ? csvExport.toggleCard
            : () => Alert.alert("앱 정보", appInfoText)
      };
    });
  const previewMenuRowActions: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    caption?: string;
    section?: MoreMenuSection;
    onPress?: () => void;
  }> = [
    ...moreMenuRows.map((row) => ({
      icon: row.icon,
      title: row.title,
      onPress: () => router.push(row.route)
    })),
    // EXP-106: 미리보기(로그아웃)에서는 내보낼 세션 데이터가 없으므로 비활성 행 패턴
    // (캡션 + onPress 없음)으로 로그인 준비 안내만 보여준다.
    { icon: "share-outline", title: EXPORT_MENU_TITLE, caption: EXPORT_SIGNED_OUT_CAPTION, onPress: undefined },
    // UX-5B-9: "앱 정보"는 어딘가로 위장 이동하는 대신 실제 버전 정보를 보여준다.
    { icon: "information-circle-outline", title: "앱 정보", onPress: () => Alert.alert("앱 정보", appInfoText) }
  ];
  // 메뉴 행도 같은 기준(토큰)으로 고른다 -- 로그인한 사용자에게 "로그인하면 …" 캡션이 달린
  // 비로그인 미리보기 행을 보여 주면 그 자체가 사실과 다르고, 설정 입구도 사라진다.
  const visibleMenuRows = authToken ? sessionMenuRows : previewMenuRowActions;

  return (
    <AppScreen>
      <View testID={moreReferenceScreenId} style={moreReferenceFrameStyle()}>
        <View style={moreHeaderRowStyle}>
          {/* DSN-053 P2-D: 세션에서는 이 화면이 승인 캡처의 "프로필"(가구 카드 + 4구획)이다.
              비로그인 미리보기는 SET-001 캡처 경로라 종전 제목 그대로 둔다. */}
          <Text style={moreTitleStyle}>{authToken ? "프로필" : "더보기"}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasSession ? "기록 검색" : "설정"}
            hitSlop={4}
            onPress={handleSearchPress}
            style={moreSearchButtonStyle}
          >
            {/* 돋보기 글리프(⌕)도 같은 Ionicons 계열로. 라벨은 바깥 Pressable이 읽어 준다. */}
            <Ionicons
              accessible={false}
              name="search-outline"
              size={moreSearchTextStyle.fontSize}
              color={moreSearchTextStyle.color}
            />
          </Pressable>
        </View>

        {/* 라운드 41 UX-U(A): 이 카드는 **아이** 이름과 개월수를 보여 주므로 목적지도 아이 관리
            (/settings/children)여야 한다 -- 예전에는 가구 화면(/family)으로 보내서, 카드가 말하는
            정보와 도착하는 화면이 어긋났고 바로 아래 행과 목적지가 겹쳤다. 가구 화면 입구는 아래
            "가족 관리" 행 하나뿐이다. SET-001 픽셀 락 캡처는 비로그인 경로라, 라벨·스타일은 한
            글자도 건드리지 않고 목적지만 바꾼다. */}
        {isChildPending ? (
          // P2-3: 아이를 모르는 동안에는 이름·개월수를 지어내지 않는다. 스켈레톤 한 줄과,
          // 사용자가 스스로 풀 수 있는 길(아이 선택)만 둔다 -- 홈 탭의 home-child-pending과
          // 같은 문구·같은 목적지다.
          <View testID="more-child-pending" style={{ gap: theme.spacing.gap }}>
            <SkeletonRow />
            <EmptyStateCard
              title="아이 정보를 불러오고 있어요"
              actionLabel="아이 선택하기"
              onPress={() => router.push("/settings/children")}
            />
          </View>
        ) : authToken ? (
          /* DSN-053 P2-D 가구 카드: 로고 원 56(마크 38) · "{닉네임}네" 18/800 · 보호자·아이 수 ·
             stage pill. 목적지는 라운드 41 UX-U(A)가 정한 그대로다(MORE_PROFILE_CARD_ROUTE). */
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              householdCaption
                ? `${visibleProfile.nickname}네, ${householdCaption}, ${visibleProfile.stageLabel}, 프로필 관리`
                : `${visibleProfile.nickname}네, ${visibleProfile.stageLabel}, 프로필 관리`
            }
            onPress={() => router.push(MORE_PROFILE_CARD_ROUTE)}
            style={moreHouseholdCardStyle}
            testID="more-household-card"
          >
            <View style={moreHouseholdLogoCircleStyle}>
              <Image source={moreHouseholdLogoImage} style={moreHouseholdLogoStyle} resizeMode="contain" />
            </View>
            <View style={moreHouseholdTextGroupStyle}>
              <Text style={moreHouseholdNameStyle}>{visibleProfile.nickname}네</Text>
              {householdCaption ? <Text style={moreHouseholdMetaStyle}>{householdCaption}</Text> : null}
            </View>
            <StageBadge label={visibleProfile.stageLabel} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visibleProfile.nickname} 프로필 관리`}
            onPress={() => router.push(MORE_PROFILE_CARD_ROUTE)}
            style={moreProfileCardStyle}
          >
            <Image source={moreAvatarImage} style={moreAvatarStyle()} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={moreChildNameStyle}>{visibleProfile.nickname}</Text>
              <Text style={moreChildAgeStyle}>{visibleProfile.stageLabel}</Text>
            </View>
          </Pressable>
        )}

        {/* DSN-053 P2-D: 세션 메뉴는 승인 캡처처럼 제목 붙은 그룹 박스 넷으로 나뉜다. 어떤 행이
            어느 구획인지는 정보 구조 단일 소스(src/settings/more-menu.ts)가 정하므로 여기서는
            그 순서대로 그리기만 한다 -- 행 문구·목적지·게이트는 한 글자도 바뀌지 않는다.
            비로그인 미리보기는 예전 그대로 한 덩어리 박스다(SET-001 픽셀 락 캡처 경로). */}
        {authToken ? (
          MORE_MENU_SECTIONS.map((section) => {
            const sectionRows = visibleMenuRows.filter((row) => row.section === section.key);
            if (sectionRows.length === 0) return null;
            return (
              <View key={section.key} style={moreSectionStyle}>
                <Text accessibilityRole="header" style={moreSectionTitleStyle}>
                  {section.title}
                </Text>
                <View style={moreSectionGroupStyle}>
                  {sectionRows.map((row) => (
                    <MoreMenuRow
                      key={row.title}
                      grouped
                      icon={row.icon}
                      title={row.title}
                      caption={row.caption}
                      onPress={row.onPress}
                    />
                  ))}
                </View>
              </View>
            );
          })
        ) : (
          <View style={moreMenuGroupStyle()}>
            {visibleMenuRows.map((row) => (
              <MoreMenuRow key={row.title} icon={row.icon} title={row.title} caption={row.caption} onPress={row.onPress} />
            ))}
          </View>
        )}

        <ExpenseCsvExportCard controller={csvExport} />

        <ExpenseCsvExportToast controller={csvExport} />
      </View>
    </AppScreen>
  );
}

// PIX-133(실기기 피드백): topOffset/horizontalOffset 기본값 30·여백 보정은 SET-001 픽셀
// 캡처 정렬용이다. 종전에는 실기기 릴리즈에서도 화면 전체가 오른쪽·아래로 30dp 밀려
// 오른쪽이 잘려 보였다("꽉 차게 안 보임"). 캡처 빌드에서만 적용한다.
const isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
function moreReferenceFrameStyle() {
  if (!isPixelLockCalibration) {
    return { gap: 18 + MoreSettingsPixelStyles.rowGap, paddingTop: 0 } as const;
  }
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

// ---------------------------------------------------------------------------------------------
// DSN-053 P2-D — 세션("프로필") 전용 문법. 아래 토큰들은 위 미리보기 카드/메뉴 스타일을 대체하지
// 않고 **나란히** 산다: 비로그인 렌더(SET-001 픽셀 락 캡처)는 예전 토큰만 계속 읽는다.

const moreHouseholdCardStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: theme.radii.card,
  borderWidth: 1,
  flexDirection: "row",
  gap: 12,
  minHeight: 88,
  padding: 16,
  ...theme.shadows.card
} as const;

const moreHouseholdLogoCircleStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.coral[50],
  borderRadius: 28,
  height: 56,
  justifyContent: "center",
  width: 56
} as const;

const moreHouseholdLogoStyle = { height: 38, width: 38 } as const;

const moreHouseholdTextGroupStyle = { flex: 1, gap: 3, minWidth: 0 } as const;

const moreHouseholdNameStyle = {
  color: theme.colors.brown,
  fontSize: 18,
  fontWeight: "800",
  lineHeight: 26
} as const;

const moreHouseholdMetaStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18
} as const;

const moreSectionStyle = { gap: 8 } as const;

const moreSectionTitleStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  fontWeight: "700",
  lineHeight: 18
} as const;

const moreSectionGroupStyle = {
  backgroundColor: theme.colors.white,
  borderColor: "rgba(74, 63, 53, 0.08)",
  borderRadius: theme.radii.card,
  borderWidth: 1,
  overflow: "hidden"
} as const;

const moreSectionRowStyle = {
  alignItems: "center",
  borderBottomColor: "rgba(74, 63, 53, 0.08)",
  borderBottomWidth: 1,
  flexDirection: "row",
  gap: 12,
  minHeight: 64,
  paddingHorizontal: 14
} as const;

const moreSectionRowIconCircleStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.coral[50],
  borderRadius: 20,
  height: 40,
  justifyContent: "center",
  width: 40
} as const;

const moreSectionRowTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 15,
  fontWeight: "700",
  lineHeight: 22
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
