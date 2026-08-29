import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getSeoulToday } from "@wooriai/domain";
import { router } from "expo-router";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { useAnalyticsConsentStore } from "../../src/analytics/flag";
import {
  listChildren,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN
} from "../../src/api/client";
// EXP-106 / CLEAN-123(A3): 더보기 탭과 같은 공용 내보내기 모듈 -- 설정에 "가져오기"만 있고
// "내보내기"가 없어 데이터 이동성이 한쪽으로만 열려 있던 비대칭을 메운다(중복 구현 없음).
import {
  EXPORT_MENU_TITLE,
  EXPORT_SIGNED_OUT_CAPTION,
  ExpenseCsvExportCard,
  ExpenseCsvExportToast,
  useExpenseCsvExport
} from "../../src/export/ExpenseCsvExport";
// 라운드 55 트랙 C: 두 진입점의 이름은 화면이 다시 적지 않고 각 기능의 순수 모듈에서 가져온다
// (같은 기능이 화면마다 다른 이름으로 보이던 FIX/F5의 재발 방지).
import { RECURRING_MANAGE_LABEL } from "../../src/expenses/recurring-template";
// 라운드 60 A: 요약 카드의 두 줄이 같은 가구를 말하게 하는 판정(선택 아이 기준).
import { isChildrenSettled, resolveManagedHouseholdId } from "../../src/family/household-scope";
// GAP-061 #10: 예정일이 유예를 넘긴 임신 프로필의 "임신 42주차" 고착을 표시층에서만 걷어낸다.
import { resolveStageDisplayLabel } from "../../src/home/stage-display-label";
// 라운드 68 트랙 B(#2): 로그아웃 확인 문구는 동기화 문구의 단일 소스에서 온다(화면이 다시 적지 않는다).
import { logoutConfirmMessage, LOGOUT_CONFIRM_TITLE, OFFLINE_LOAD_NOTICE } from "../../src/offline/messages";
// 라운드 72 트랙 B(GAP-072 #2): 요약 줄이 받는 것은 **연결 판정 하나**다(문구는 아래 참고).
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
import { APP_LOCK_TITLE } from "../../src/security/app-lock";
// 라운드 71 트랙 D(#4): 도움(지원·FAQ) 행의 목록·라벨은 더보기 탭과 **같은 표**에서 온다
// (buildSupportMenuRows). 주입된 URL이 없으면 빈 배열이라 이 화면은 종전과 한 글자도 다르지 않다.
import { buildSupportMenuRows } from "../../src/settings/more-menu";
// 라운드 71 리뷰 S-2: 앱 밖으로 나가는 링크를 여는 규칙은 화면 셋이 공유하는 한 벌이다.
import { openExternalUrl } from "../../src/settings/open-external-url";
import { SUPPORT_LINK_FAILED_MESSAGE, SUPPORT_LINK_FAILED_TITLE } from "../../src/settings/support-links";
// 라운드 69 트랙 A(#1): 로그아웃이 지우는 세 번째 목록의 크기. 이 스토어는 zustand persist라
// 구독 비용이 렌더 한 번이고 **새 요청이 없다**(아웃박스 스냅숏과 저장소가 다르므로 내보내기
// 컨트롤러가 들고 나올 수 없다 — 그 모듈에는 정기 지출이 들어가지 않는다는 계약도 있다:
// src/expenses/recurring-flow.test.ts "템플릿을 CSV 내보내기에 싣지 않는다").
import { useRecurringExpenseStore } from "../../src/stores/recurring-expense.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, ListRow, ScreenHeader } from "../../src/ui";

const summaryLoadingText = "불러오는 중...";
const summaryUnavailableText = "불러오지 못했어요";
/**
 * 라운드 72 트랙 B(GAP-072 #2) — 요약 줄의 **오프라인 갈래**.
 *
 * ## 이 자리가 목록의 카드 계약 밖인 이유
 *
 * 다른 화면들은 조회 실패를 [다시 시도]가 달린 카드로 말하지만, 여기는 요약 카드 오른쪽의 값
 * 한 줄이다(라벨 "현재 가구" · 값 "가족 3명"). 그래서 `LoadErrorCopy.title`을 그대로 실을 수
 * 없다: 두 문장짜리 공용 문구는 이 폭에서 줄이 접혀 레이아웃을 바꾸고, 뒷문장이 가리키는
 * "다시 시도"라는 행동이 이 자리에는 아예 없다(눌러서 다시 부를 버튼이 없다).
 *
 * 그래서 이 화면이 공용 훅에서 받는 것은 **연결 판정 하나**이고, 문구는 같은 단일 소스 문장의
 * 앞 문장을 잘라 쓴다 — 새 문구가 0건이라는 규율은 그대로 지키면서 길이는 종전 값
 * ("불러오지 못했어요")과 같은 급으로 남는다. 이 사실은 값으로도 적혀 있다
 * (src/offline/offline-aware-screens.ts의 `OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS`) —
 * 다음 라운드가 이 자리를 "아직 배선 안 된 옛 리터럴"로 다시 세지 않게 하기 위해서다.
 *
 * 온라인 갈래는 종전 문자열 그대로다(위 `summaryUnavailableText`, 바이트 불변).
 */
const summaryOfflineText = OFFLINE_LOAD_NOTICE.slice(0, OFFLINE_LOAD_NOTICE.indexOf(".") + 1);
// 리뷰 F7: 로그아웃해도 selectedChildId는 기기에 남는다(clearSelectedChild를 부르지 않는 경로 존재).
// 그 상태에서는 ["children"] 쿼리가 enabled:false라 영원히 로딩도, 실패도 아니므로 요약 줄이
// "불러오는 중..."에 붙박인다 -- 세션이 없다는 사실을 그대로 말한다.
const summarySignedOutText = "로그인이 필요해요";

/**
 * D1 후속(실기기 피드백 2 "아이콘들이 다 예전걸로 돌아간 것 같음"): 설정 행의 왼쪽 글리프
 * (✎ ♥ ₩ ◎ § ⇩ ⇪)를 탭바(app/(tabs)/_layout.tsx)와 같은 Ionicons outlined 계열로 바꾼다.
 * 문자열 글리프는 기기 폰트에 따라 굵기·크기가 제각각이거나 네모(tofu)로 떨어져 "예전 아이콘"으로
 * 보였다.
 *
 * 크기·색은 공용 ListRow가 문자열 글리프를 그릴 때 쓰던 값(coral, 20)을 그대로 쓴다 -- 행 높이와
 * 아이콘 열 폭이 종전과 같다. 행 이름·부제는 ListRow가 읽어 주므로 아이콘은 장식이다
 * (`accessible={false}`).
 */
function SettingsRowIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return <Ionicons accessible={false} name={name} size={20} color={theme.colors.mainCoral} />;
}

/**
 * 라운드 71 트랙 D(GAP-071 #4) — **앱 안에 도움을 구할 길이 0건이었다.**
 *
 * 갈 곳은 이미 저장소에 있는데(infra/site/support.html · faq.html) 앱이 그곳을 가리키지 않았다.
 * 호스팅 URL은 사용자 자산이라 이 라운드가 만들 수 없으므로, 약관 링크와 같은 관례를 쓴다 --
 * 주입된 빌드에만 행이 서고, 없으면 이 목록이 비어 화면이 종전 그대로다(지어낸 이메일도, 죽은
 * 링크도 만들지 않는다). 행 이름·부제·순서는 더보기 탭과 같은 표에서 온다.
 *
 * 라운드 71 리뷰 P-1: **모듈 상수다.** 이 목록의 원천은 빌드에 주입된 env라 앱이 사는 동안
 * 바뀌지 않는데, 렌더마다 다시 만들면 매번 새 배열이 된다(같은 값의 새 참조). 더보기 탭의
 * `moreMenuRows`가 이미 그 자리에 있는 것과 같은 관례다.
 */
const supportRows = buildSupportMenuRows();

export default function SettingsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const clearSession = useSessionStore((state) => state.clearSession);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const clearSelectedChild = useSelectedChildStore((state) => state.clearSelectedChildId);
  // NAV-121: 요약 카드가 연결 여부만 알려주는 무정보 문구 대신 실제 값을 보여주도록, 아이 관리
  // (app/settings/children.tsx)·가족 관리(app/family/index.tsx) 화면과 같은 캐시 키를 재사용한다.
  // 새 엔드포인트를 부르지 않고 이미 채워진 캐시를 그대로 읽는 게 대부분이다.
  const children = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  /**
   * 라운드 60 A — "현재 가구"와 "선택된 아이"가 **같은 가구를 말하게** 한다.
   *
   * 종전의 "가족 N명"은 세션 기본 가구의 인원이었고 바로 아래 줄은 선택된 아이였다. 다른 가구
   * 초대를 수락하면 기본 가구가 영구히 바뀌므로, 두 줄이 서로 다른 가구를 말하는 카드가 됐다.
   * 이제 인원도 보고 있는 아이의 가구를 센다(1가구 계정에서는 같은 값이라 문자열 불변).
   */
  const householdId = resolveManagedHouseholdId({
    children: children.data?.children,
    childId,
    fallbackHouseholdId,
    // 세션이 없으면 기다릴 조회 자체가 없다(쿼리가 disabled라 영원히 pending이다).
    childrenSettled: isChildrenSettled({ authToken, isSuccess: children.isSuccess, isError: children.isError })
  });
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });

  /**
   * 라운드 72 트랙 B — 두 요약 줄이 **한 판정**을 나눠 쓴다.
   *
   * 두 조회(아이 목록 · 구성원)는 오프라인에서 함께 실패하고, 사용자가 읽는 것은 같은 카드의
   * 두 줄이라 판정도 하나면 된다(아이 관리 화면의 저장 실패 셋이 자기 뮤테이션을 각각 묻는 것과
   * 반대 방향인데, 그 자리는 카드가 서로 다른 상태로 **동시에** 뜰 수 있었고 여기는 한 카드다).
   * 훅은 에러로 전환되는 순간에만 폴을 한 번 띄우고, 그 결과를 버릴 줄도 안다 —
   * 이 화면이 `isCurrentlyOnline`을 손으로 다시 적지 않는 이유다.
   */
  const loadErrorCopy = useLoadErrorCopy(children.isError || members.isError);
  // 오프라인으로 **확인된** 경우에만 갈린다(판정 전 첫 프레임·web은 온라인 갈래 = 종전 문자열).
  const summaryErrorText = loadErrorCopy.title === OFFLINE_LOAD_NOTICE ? summaryOfflineText : summaryUnavailableText;

  const householdSummary = !authToken
    ? summarySignedOutText
    : // 계정에 가구가 없다는 사실은 **세션이 아는 기본 가구**로 판정한다 -- 아이 목록을 아직
      // 기다리는 동안 "연결된 가구가 없어요"를 띄우면 있는 가구를 없다고 말하는 셈이다.
      !fallbackHouseholdId && !householdId
      ? "연결된 가구가 없어요"
      : members.data
        ? `가족 ${members.data.members.length}명`
        : members.isError
          ? summaryErrorText
          : summaryLoadingText;
  const selectedChild = children.data?.children.find((child) => child.id === childId);
  const childSummary = !authToken
    ? summarySignedOutText
    : !childId
      ? "선택된 아이가 없어요"
      : selectedChild
        ? `${selectedChild.nickname} · ${resolveStageDisplayLabel({
            stageMode: selectedChild.stageMode,
            dueDate: selectedChild.dueDate,
            todayIso: getSeoulToday(),
            stageLabel: selectedChild.stageLabel
          })}`
        : children.isError
          ? summaryErrorText
          : summaryLoadingText;
  // ANA-102: opt-in analytics consent -- backed by the persisted zustand store that gates the
  // entire analytics client (src/analytics/flag.ts), so flipping this off immediately stops any
  // event from being queued or sent, and the choice survives app restarts.
  const analyticsConsent = useAnalyticsConsentStore((state) => state.enabled);
  const setAnalyticsConsent = useAnalyticsConsentStore((state) => state.setEnabled);
  // 가져오기 행 바로 아래에 붙는 CSV 내보내기 -- 상태·수집·공유·토스트는 공용 모듈이 담당한다.
  const csvExport = useExpenseCsvExport();
  /**
   * 라운드 69 트랙 A(#1) — 로그아웃과 함께 사라지는 **정기 지출 템플릿**의 수.
   *
   * 아이 필터를 지나지 않은 전량이다: teardown의 `resetAll()`은 모든 아이의 템플릿을 지우므로
   * 지금 고른 아이 것만 세면 화면이 실제보다 작은 수를 말한다(아웃박스에 내린 판단과 같다).
   * 셀렉터가 숫자를 돌려주므로 목록이 바뀌지 않는 한 이 화면은 다시 그려지지 않는다.
   *
   * 라운드 69 리뷰 S-3 — 알고 받아들이는 갈래: 이 스토어는 zustand persist라 **하이드레이션
   * 전에는 0으로 읽힌다**. 그 찰나에 로그아웃을 누르면 문구가 정기 지출 줄 없는 종전 갈래로
   * 떨어진다(문구가 틀린 수를 말하는 것이 아니라 한 줄을 덜 말한다). `hasHydrated` 게이트를
   * 더하지 않은 이유는 도달성이다: 설정 탭은 앱을 열고 최소 한 번의 화면 전환을 지나야 닿는
   * 자리라 실기기에서 그 창은 사실상 닫혀 있고, 게이트를 더하면 "아직 모른다" 상태를 이 화면과
   * 문구가 각각 다뤄야 해서 갈래가 둘 늘어난다. 하이드레이션이 느려질 수 있는 변경(스토어에
   * 큰 값을 싣거나 persist 저장소를 바꾸는 일)이 오면 이 판단을 다시 봐야 한다.
   */
  const recurringTemplateCount = useRecurringExpenseStore((state) => state.templates.length);
  /**
   * 열기 실패는 조용히 넘기지 않는다. 인앱 웹뷰를 만들지 않으므로 여는 방법은 OS 링크 열기
   * 하나이고, 그 규칙은 라운드 71 리뷰 S-2에서 화면 셋이 공유하는 한 벌이 됐다
   * (src/settings/open-external-url.ts). 이 화면이 더하는 것은 실패 문구 두 줄뿐이다.
   */
  const openSupportLink = (url: string) =>
    openExternalUrl(url, { failTitle: SUPPORT_LINK_FAILED_TITLE, failMessage: SUPPORT_LINK_FAILED_MESSAGE });

  /**
   * 라운드 68 트랙 B(#2) — 확인 문구가 **미동기화 기록이 사라진다는 사실**을 함께 말한다.
   *
   * 이 앱에서 사람들이 실제로 쓰는 로그아웃은 이 버튼 하나인데(나머지 둘은 PIN을 잊은 사람만
   * 지나는 길이다), 정작 이 자리만 "다시 로그인해야 이용할 수 있어요."가 전부였다. `clearSession()`
   * 은 PRIV-104 teardown을 발화시켜 아웃박스를 통째로 지우므로(src/offline/session-teardown.ts),
   * 오프라인에서 적은 기록은 그때 사라진다.
   *
   * 판정·문구는 순수 모듈 한 곳에 있고(offline/messages.ts) 이 화면은 값을 넘기기만 한다.
   * 건수는 **새 요청 0건**으로 읽는다 — 내보내기 컨트롤러가 이미 구독 중인 오프라인 스냅숏에서
   * 그대로 온다(`devicePendingRecords`: 아이 필터를 지나지 않은 이 기기 전량 · 저장소를 못 연
   * 부팅에서는 건수 대신 "모른다"를 말한다). 대기 0건이면 종전 문장 그대로다.
   *
   * 라운드 69 트랙 A(#1): 같은 teardown이 지우는 **정기 지출 템플릿**도 함께 넘긴다. 그 값은
   * 아웃박스와 저장소가 다르므로(zustand persist ↔ SQLite) 위 스냅숏에 실려 오지 않고, 이 화면이
   * 셀렉터 하나로 읽어 두 모집단을 합쳐 넘긴다 — 합치는 것은 **입력**이고, 문장은 순수 모듈이
   * 여전히 두 줄로 나눠 말한다(성질이 다른 두 손실을 한 문장에 섞지 않는다). 0/0이면 종전 한 줄.
   */
  const handleLogout = () => {
    Alert.alert(LOGOUT_CONFIRM_TITLE, logoutConfirmMessage({ ...csvExport.devicePendingRecords, recurringTemplateCount }), [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          clearSession();
          clearSelectedChild();
          router.replace("/launch-animation");
        }
      }
    ]);
  };

  return (
    <AppScreen>
      <View testID="screen-SET-001" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="설정" title="설정" subtitle="계정과 가족 정보를 관리해요" onBack={() => router.back()} />
        <Card style={{ gap: 6 }}>
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>현재 가구</Text>
            <Text style={summaryValueStyle}>{householdSummary}</Text>
          </View>
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>선택된 아이</Text>
            <Text style={summaryValueStyle}>{childSummary}</Text>
          </View>
        </Card>
      </View>

      <View testID="screen-SET-002" style={{ gap: theme.spacing.gap }}>
        {/* MOB-118: 아이 목록 · 전환 · 편집 · 추가 (SET-005) */}
        <ListRow
          icon={<SettingsRowIcon name="person-circle-outline" />}
          title="아이 관리"
          subtitle="아이를 전환하거나 정보를 수정해요"
          onPress={() => router.push("/settings/children")}
        />
        {/* NAV-121: "아이 · 가구 프로필"과 "가족 관리"가 둘 다 /family로 가던 중복 행을 하나로 합쳤다.
            아이 정보는 위의 아이 관리(SET-005)가, 가구 구성·초대·멤버는 이 행이 담당한다. */}
        <ListRow
          icon={<SettingsRowIcon name="people-outline" />}
          title="가족 관리"
          subtitle="가구 프로필과 초대 · 멤버를 관리해요"
          onPress={() => router.push("/family")}
        />
        <ListRow
          icon={<SettingsRowIcon name="wallet-outline" />}
          title="예산 수정"
          subtitle="이번 달 예산을 조정해요"
          onPress={() => router.push("/budget")}
        />
        {/* 라운드 55 트랙 C — 반복/고정 지출 관리 진입점(설계 §1.5).
            입구는 **둘뿐**이다: 홈 리마인더 카드 하단의 텍스트 버튼과 이 행. 더보기 탭은 7행
            고정이 SET-001 compact 기준의 근거라 건드리지 않는다(src/settings/more-menu.ts).
            부제가 "자동으로 기록해요"라고 말하지 않는 것이 계약이다 -- 이 기능은 리마인더이지
            자동 기록이 아니다(DNC-013). */}
        <ListRow
          icon={<SettingsRowIcon name="repeat-outline" />}
          title={RECURRING_MANAGE_LABEL}
          subtitle="매달 반복되는 지출을 등록해 두고 기록할 때 알려 줘요"
          onPress={() => router.push("/expenses/recurring")}
        />
        {/* PUSH-116: 푸시 알림·기기별 수신 관리 (SET-006) */}
        <ListRow
          icon={<SettingsRowIcon name="notifications-circle-outline" />}
          title="알림 설정"
          subtitle="푸시 알림과 기기별 수신을 관리해요"
          onPress={() => router.push("/settings/notifications")}
        />
        {/* 라운드 55 트랙 B/C — 앱 잠금(PIN) 진입점.
            부제는 APP_LOCK_SCOPE_NOTICE보다 **크게 말하지 않는다**(수용 기준 11): 이 잠금이
            막는 것은 "잠깐 빌려준 폰에서 곁눈질"뿐이고, 기기·계정 보호가 아니다. 범위 고지
            전문과 생체 인증 미지원 사실은 잠금 설정 화면이 말한다. */}
        <ListRow
          icon={<SettingsRowIcon name="lock-closed-outline" />}
          title={APP_LOCK_TITLE}
          subtitle="PIN 4자리로 앱을 열 때 한 번 확인해요"
          onPress={() => router.push("/settings/app-lock")}
        />
        <ListRow
          icon={<SettingsRowIcon name="shield-checkmark-outline" />}
          title="약관 및 개인정보"
          subtitle="동의 내역과 삭제 · 탈퇴를 관리해요"
          onPress={() => router.push("/settings/privacy")}
        />
        <ListRow
          icon={<SettingsRowIcon name="download-outline" />}
          title="데이터 가져오기"
          subtitle="엑셀 파일로 지출을 가져와요"
          onPress={() => router.push("/import")}
        />
        {/* EXP-106 / CLEAN-123(A3): 가져오기의 반대 방향. 세션이 없으면 더보기 탭과 같은
            비활성 행 패턴(안내 문구 + onPress 없음)으로 이유를 밝힌다.
            FIX/F5: 행 제목은 더보기 탭과 같은 EXPORT_MENU_TITLE 한 벌만 쓴다 -- 예전에는 여기만
            "CSV 내보내기"로 인라인돼 있어 같은 기능이 화면마다 다른 이름으로 보였다. */}
        <ListRow
          icon={<SettingsRowIcon name="share-outline" />}
          title={EXPORT_MENU_TITLE}
          subtitle={
            csvExport.canExport
              ? csvExport.cardOpen
                ? "내보낼 기간을 선택해요"
                : "지출 기록을 CSV 파일로 내보내요"
              : EXPORT_SIGNED_OUT_CAPTION
          }
          onPress={csvExport.canExport ? csvExport.toggleCard : undefined}
        />
        <ExpenseCsvExportCard controller={csvExport} />
        <ExpenseCsvExportToast controller={csvExport} />
        {/* 라운드 71 트랙 D(#4): 도움으로 가는 행. URL이 주입된 빌드에서만 선다 -- 목록이 비면
            이 자리에는 노드가 하나도 생기지 않아 화면이 종전과 한 글자도 다르지 않다. */}
        {supportRows.map((row) => (
          <ListRow
            key={row.id}
            icon={<SettingsRowIcon name={row.icon} />}
            title={row.title}
            subtitle={row.subtitle}
            onPress={() => openSupportLink(row.url)}
          />
        ))}
        <Card style={consentRowStyle}>
          <View style={{ flex: 1, gap: 3, paddingRight: 12 }}>
            <Text style={consentTitleStyle}>통계 수집 동의(선택)</Text>
            <Text style={consentSubtitleStyle}>
              익명화된 사용 통계만 수집해요. 이름·이메일 같은 개인정보나 금액 원본은 보내지 않고, 언제든지 끌 수 있어요.
            </Text>
          </View>
          <Switch
            accessibilityLabel="통계 수집 동의(선택)"
            accessibilityRole="switch"
            onValueChange={setAnalyticsConsent}
            thumbColor={theme.colors.white}
            trackColor={{ false: theme.colors.gray300, true: theme.colors.mainCoral }}
            value={analyticsConsent}
          />
        </Card>
        <Pressable accessibilityRole="button" accessibilityLabel="로그아웃" onPress={handleLogout} style={logoutRowStyle}>
          <Text style={logoutTextStyle}>로그아웃</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const summaryRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const summaryLabelStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  fontWeight: "700"
} as const;

const summaryValueStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "700"
} as const;

// ANA-102 consent row: same card-row look as the ListRow entries above, with a Switch in the
// right-hand value slot instead of a chevron target.
const consentRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 12,
  paddingVertical: 12
} as const;

const consentTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "700"
} as const;

const consentSubtitleStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 17
} as const;

const logoutRowStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  height: theme.ctaHeight,
  justifyContent: "center",
  marginTop: 4
} as const;

const logoutTextStyle = {
  color: theme.colors.danger,
  fontSize: 15,
  fontWeight: "700"
} as const;
