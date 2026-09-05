import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getSeoulToday } from "@wooriai/domain";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { listChildren, listHouseholdMembers, LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN } from "../../src/api/client";
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
// 라운드 71 리뷰 S-2: 앱 밖으로 나가는 링크를 여는 규칙은 화면 셋이 공유하는 한 벌이다.
import { openExternalUrl } from "../../src/settings/open-external-url";
// 라운드 71 트랙 D(#4): 열기 실패 문구도 그 모듈 한 곳에서 온다 -- 화면이 다시 적지 않는다.
import { SUPPORT_LINK_FAILED_MESSAGE, SUPPORT_LINK_FAILED_TITLE } from "../../src/settings/support-links";
// 라운드 94 트랙 A: 가구 카드의 `-네`는 받침에서 갈린다("지훈이네" · "서아네") -- 규칙은 조사와
// 같은 순수 모듈 한 자리에 있고, 화면은 보이는 줄과 낭독 라벨에서 **같은 함수**를 지난다.
import { nameWithHonorificSuffix } from "../../src/text/korean-particles";
import { isChildrenSettled, resolveManagedHouseholdId } from "../../src/family/household-scope";
// GAP-062 #6: 홈 헤더·설정 요약·아이 목록과 **같은** 표시층 판정을 이 카드도 지난다(재사용만 —
// 판정은 src/home/stage-display-label.ts 한 자리에 그대로 있다).
import { resolveStageDisplayLabel } from "../../src/home/stage-display-label";
// 라운드 68 트랙 B(#6): "지금 잠그기" 행의 게이트(잠금이 켜졌는가)와 동작(lockNow) 둘 다 이미
// 있는 스토어에서 온다 -- 판정·저장소 코드는 한 줄도 바뀌지 않는다.
import { useAppLockStore } from "../../src/stores/app-lock.store";
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
  a11yLabel,
  grouped = false,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption?: string;
  /**
   * 라운드 68 트랙 B(#6): 스크린리더가 읽을 문장이 보이는 제목과 다를 때만 넘어온다("지금 잠그기"
   * → `APP_LOCK_LOCK_NOW_A11Y_LABEL`). 없으면 아래 계산은 종전과 완전히 같다.
   */
  a11yLabel?: string;
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
      accessibilityLabel={a11yLabel ?? (caption ? `${title}, ${caption}` : title)}
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
  /**
   * 라운드 82 트랙 D(#4) — **이 화면은 `/home` 응답을 구독하지 않는다.**
   *
   * 종전에는 여기서 `["home", childId]`를 켜 두고 그 응답의 `child` 네 칸 중 둘(닉네임 ·
   * 단계 라벨)만 읽었다. 그 넷은 아래 `["children"]` 행의 **진부분집합**이다 — 서버는 두 응답의
   * 아이를 **같은 함수**로 만든다(apps/api/src/onboarding/store-shared.ts의 `toChildDto`,
   * 데모 세션도 같은 모양이다). 즉 이 화면은 더 넓은 원천을 이미 켜 둔 채로 좁은 원천을 하나
   * 더 기다리고 있었고, 그 좁은 쪽이 이 앱에서 가장 무거운 읽기다(예산 · 월 합계 · 전 기간
   * 합계 · 최근 3건 + 활성 카탈로그 전량을 훑는 추천 셋).
   *
   * 그래서 눈에 보이던 어긋남 하나가 사라진다: 가구 카드가 `["children"]`으로 "보호자 2명 ·
   * 아이 2명"을 이미 그리고 있는 프레임에서, 바로 위 프로필 카드만 `/home`을 기다리며 "..."로
   * 남던 자리다. 새 요청 · 새 캐시 키는 0건이고(이미 켜 둔 조회를 읽기만 한다), 이 화면의 첫
   * 페인트 요청은 둘에서 하나가 된다.
   *
   * 대장은 `src/query/home-payload-consumers.test.ts`에 있다 — `getHome`을 부르거나
   * `["home", childId]`를 구독하는 `app/**` 화면은 **홈 하나**이고, 그 밖에서 그 키를 만지는
   * 자리(무효화 · 캐시 읽기 · 주석)는 전부 이유와 함께 그 대장에 등재된다.
   */

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
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const children = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  /**
   * 라운드 60 A — 카드 한 줄 안에서 **두 스코프가 섞여 있었다.**
   *
   * "보호자 N명"은 세션 기본 가구의 구성원 수였고, "아이 M명"은 `["children"]`이 내려주는
   * **모든 가구의** 아이 수였다. 다른 가구 초대를 수락하면 앞의 수는 그 가구로 바뀌고 뒤의 수는
   * 두 가구의 합이 되어, 한 줄이 서로 다른 두 집단을 세게 된다("보호자 2명 · 아이 3명"인데 그
   * 가구에는 아이가 하나뿐). 두 수를 **같은 가구**(보고 있는 아이의 가구)로 맞춘다 -- 1가구
   * 계정에서는 두 값이 종전과 같으므로 문자열도 그대로다.
   */
  const householdId = resolveManagedHouseholdId({
    children: children.data?.children,
    childId,
    fallbackHouseholdId,
    childrenSettled: isChildrenSettled({ authToken, isSuccess: children.isSuccess, isError: children.isError })
  });
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  const activeMemberCount = members.data?.members.filter((member) => member.status === "active").length ?? null;
  const childCount = householdId
    ? (children.data?.children.filter((child) => child.householdId === householdId).length ?? null)
    : null;
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
  /**
   * 라운드 82 트랙 D(#4) — **프로필 카드가 말하는 아이의 원천은 `["children"]` 하나다.**
   *
   * 종전에는 이름이 `/home` 응답에서, 단계 판정의 재료(`stageMode`/`dueDate`)가 `["children"]`
   * 에서 왔다 — 한 카드가 같은 아이를 두 원천으로 불렀고, 아래 판정의 게이트도 그래서 둘이었다.
   * `childId`로 목록에서 행을 찾으면 이름 · 단계 · 판정 재료가 **같은 한 행**에서 온다.
   *
   * ⚠️ 라운드 49 QA(P2-3)의 규율은 약해지지 않고 **강해진다**: 목록에서 `childId`로 찾으므로
   * 아이를 모르면 행이 아예 없고, 그때 카드는 종전처럼 `loadingProfile`("...")을 그린다 —
   * 남의 이름이 그려질 자리가 없다. 비로그인 미리보기 경로(`!authToken` → `previewProfile`)는
   * 한 노드도 바뀌지 않는다(SET-001 픽셀락).
   */
  const selectedChild = childId ? children.data?.children.find((child) => child.id === childId) : undefined;
  const visibleProfile = authToken ? (selectedChild ?? loadingProfile) : previewProfile;
  /**
   * GAP-062 #6 — **세션 카드의 단계 라벨.**
   *
   * 라운드 61 #10이 걷어낸 "임신 42주차" 고착(예정일이 유예를 넘겨 지났는데 출생 전환을 하지
   * 않은 프로필에서 도메인 라벨이 42주에 clamp돼 몇 달이고 같은 문장을 되풀이하는 것)은 홈
   * 헤더·설정 요약·아이 목록 셋만 지났고, 이 카드는 서버 라벨을 그대로 그리고 있었다. 그래서
   * 한 앱이 같은 아이를 두고 홈에서는 "예정일이 지났어요", 여기서는 "임신 42주차"라고 말했다.
   * 같은 함수를 지나게 해서 **두 문장을 한 문장으로** 되돌린다(판정·도메인 stageCode·서버 DTO는
   * 한 줄도 바뀌지 않는다 — 여기서 바뀌는 것은 읽어 주는 문장 하나뿐이다).
   *
   * 원천은 `["children"]` **캐시**다: `HomeSummary.child`에는 `stageMode`/`dueDate`가 없어
   * (src/api/client.ts) 홈 응답만으로는 판정할 수 없다. 이 화면은 그 캐시를 가구 카드의
   * "아이 M명" 때문에 **이미 조회하고 있으므로**(위 `children`) 새 요청은 0건이다.
   *
   * 라운드 82 트랙 D(#4): 게이트가 **하나**가 됐다. 종전에는 `/home` 응답이 도착해야 판정을
   * 태웠는데(이름은 `/home`, 재료는 `["children"]`이라 반쯤 로드된 카드를 막으려던 것이다),
   * 이제 이름과 재료가 같은 행에서 오므로 **그 행이 있는가** 하나만 남는다 — 행이 없으면
   * 이름도 라벨도 `loadingProfile`("...")이라 두 줄이 같은 시점을 말한다. 판정 자체
   * (`resolveStageDisplayLabel`)와 도메인·서버 DTO는 한 줄도 바뀌지 않는다. 아이를 못 찾거나
   * (캐시 없음·다른 가구) 날짜를 모르면 판정은 서버 라벨을 **그대로** 돌려준다.
   *
   * SET-001 픽셀락: 이 값은 **세션 렌더에서만** 쓴다. 비로그인 미리보기 카드는 아래에서
   * 예전 그대로 `visibleProfile.stageLabel`을 그린다(한 노드도 달라지지 않는다).
   */
  const sessionStageLabel = resolveStageDisplayLabel({
    stageMode: selectedChild?.stageMode,
    dueDate: selectedChild?.dueDate,
    todayIso: getSeoulToday(),
    stageLabel: visibleProfile.stageLabel
  });

  // EXP-106 데이터 내보내기(CSV): 기간 선택 카드는 아래 메뉴 행으로 접었다 폈다 한다. 상태·수집·
  // 공유·토스트는 설정 화면과 공유하는 src/export/ExpenseCsvExport.tsx가 전부 담당한다.
  const csvExport = useExpenseCsvExport();
  /**
   * GAP-068 #6 — "지금 잠그기" 행의 게이트. **잠금을 켠 계정에서만** 행이 선다(켜지 않은
   * 절대다수 계정의 더보기는 종전 7행 그대로다 — src/settings/more-menu.ts의 조건부 행 주석).
   *
   * 기록은 앱 부팅 때 오버레이가 한 번 읽어 둔 그 값이고(app-lock.store의 `load`), 여기서는
   * 읽기만 한다 — 이 화면은 잠금의 판정에도 저장소에도 손대지 않는다.
   */
  const appLockRecord = useAppLockStore((state) => state.record);
  const appLockEnabled = Boolean(appLockRecord?.enabled);

  // 라운드 98 리뷰 M-2: 검색 버튼이 기록 탭에 focusSearch 회차를 싣는다 — 수신부(records.tsx)가
  // 회차 단위로 검색 입력에 착지시킨다(리포트 드릴다운의 단조 카운터 nonce 관례 그대로).
  // 비세션 갈래는 종전과 같다(설정으로 — 검색할 기록 자체가 없다).
  const [searchFocusNonce, setSearchFocusNonce] = useState(0);
  const handleSearchPress = () => {
    if (!hasSession) {
      router.push("/settings");
      return;
    }
    const nonce = searchFocusNonce + 1;
    setSearchFocusNonce(nonce);
    router.push({ pathname: "/(tabs)/records", params: { focusSearch: String(nonce) } });
  };

  /**
   * 라운드 71 트랙 D(GAP-071 #4) — 지원·FAQ 페이지 열기.
   *
   * URL이 주입된 빌드에서만 이 함수에 닿는 행이 생긴다(src/settings/more-menu.ts의 조건부 행).
   * 인앱 웹뷰를 만들지 않는 이유는 새 의존성이기 때문이고(known-limitations A절), 열지 못하면
   * (브라우저 부재·잘못된 URL) 그 사실을 말한다 -- 아무 일도 일어나지 않는 행을 남기지 않는다
   * (app/settings/privacy.tsx의 openLegalDocument와 같은 관례).
   *
   * 라운드 71 리뷰 S-2: 여는 규칙은 화면 셋이 나눠 갖던 것을 `src/settings/open-external-url.ts`
   * 한 벌로 합쳤다 — 이 화면이 더하는 것은 실패 문구 두 줄뿐이고, 동작은 한 글자도 바뀌지 않는다.
   */
  const openSupportLink = (url: string) =>
    openExternalUrl(url, { failTitle: SUPPORT_LINK_FAILED_TITLE, failMessage: SUPPORT_LINK_FAILED_MESSAGE });

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
    a11yLabel?: string;
    /** DSN-053 P2-D: 세션 메뉴만 구획을 갖는다(비로그인 미리보기 행은 예전처럼 한 덩어리다). */
    section?: MoreMenuSection;
    onPress?: () => void;
  }> =
    buildMoreSessionMenuRows({ exportTitle: EXPORT_MENU_TITLE, appLockEnabled }).map((row) => {
      const route = row.route;
      // 라운드 71 트랙 D(#4): 앱 밖으로 나가는 행은 라우트가 아니라 주소를 갖는다(주입된 빌드에만
      // 존재한다 -- 없으면 이 목록이 종전과 완전히 같다).
      const externalUrl = row.externalUrl;
      return {
        icon: row.icon,
        title: row.title,
        a11yLabel: row.a11yLabel,
        section: row.section,
        onPress: route
          ? () => router.push(route)
          : externalUrl
            ? () => openSupportLink(externalUrl)
            : row.id === "export"
              ? csvExport.toggleCard
              : // GAP-068 #6: 화면을 옮기지 않는다 -- 오버레이가 전역이라 이번 포그라운드의 통과만
                // 무르면 그 자리에서 PIN 화면이 덮는다(설정 화면의 "지금 잠그기"와 같은 액션 하나).
                row.id === "lockNow"
                ? () => useAppLockStore.getState().lockNow()
                : () => Alert.alert("앱 정보", appInfoText)
      };
    });
  const previewMenuRowActions: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    caption?: string;
    /** 라운드 68 B(#6): **타입만** 세션 행과 맞춘다 — 미리보기 행은 이 값을 채우지 않는다(불변). */
    a11yLabel?: string;
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
            hitSlop={MORE_SEARCH_HIT_SLOP}
            onPress={handleSearchPress}
            style={({ pressed }) => [moreSearchButtonStyle, pressed && morePressedStyle]}
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
             stage pill. 목적지는 라운드 41 UX-U(A)가 정한 그대로다(MORE_PROFILE_CARD_ROUTE).
             ⚠️ 두 시점(라운드 94 트랙 A): 위 "{닉네임}네"는 **DSN-053 시점의 표기**이고, 그때
             이 세 자리는 `${visibleProfile.nickname}네`를 리터럴로 적고 있었다 -- 받침 있는
             별명이 들어오면 화면과 낭독이 함께 "지훈네"가 됐다(한국어는 "지훈이네"다). 오늘은
             셋 다 nameWithHonorificSuffix()를 지나고, 치수(18/800)와 그리는 노드는 바이트 불변이다. */
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              householdCaption
                ? `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`
                : `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${sessionStageLabel}, 프로필 관리`
            }
            onPress={() => router.push(MORE_PROFILE_CARD_ROUTE)}
            style={({ pressed }) => [moreHouseholdCardStyle, pressed && morePressedStyle]}
            testID="more-household-card"
          >
            <View style={moreHouseholdLogoCircleStyle}>
              <Image source={moreHouseholdLogoImage} style={moreHouseholdLogoStyle} resizeMode="contain" />
            </View>
            <View style={moreHouseholdTextGroupStyle}>
              <Text style={moreHouseholdNameStyle}>{nameWithHonorificSuffix(visibleProfile.nickname)}</Text>
              {householdCaption ? <Text style={moreHouseholdMetaStyle}>{householdCaption}</Text> : null}
            </View>
            {/* GAP-062 #6: 배지 조리법(coral[50]/coral[700])은 그대로고 **문장만** 표시층 판정을
                지난다 — 보이는 줄과 위 낭독 줄이 갈리지 않게 같은 한 값을 쓴다. */}
            <StageBadge label={sessionStageLabel} />
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
                      a11yLabel={row.a11yLabel}
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

// TOSS-T2: 인라인 Pressable press 피드백(공용 킷의 0.76~0.86 범위). 휴지 상태에는 더해지지 않는다.
const morePressedStyle = { opacity: 0.76 } as const;

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

/**
 * GAP-065 #7: 36dp 정사각 + 6 = 48(theme.touchTarget). 이 버튼은 헤더 줄의 한쪽 끝이고 반대편은
 * 제목 텍스트뿐이라(space-between) 네 변을 같이 넓혀도 이웃 컨트롤의 몸에 닿지 않는다.
 * 레이아웃 속성(36 정사각)은 그대로다 — SET-001 픽셀락 캡처 불변(hitSlop은 렌더가 아니다).
 */
const MORE_SEARCH_HIT_SLOP = 6;

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
