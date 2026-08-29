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
import { logoutConfirmMessage, LOGOUT_CONFIRM_TITLE } from "../../src/offline/messages";
import { APP_LOCK_TITLE } from "../../src/security/app-lock";
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

  const householdSummary = !authToken
    ? summarySignedOutText
    : // 계정에 가구가 없다는 사실은 **세션이 아는 기본 가구**로 판정한다 -- 아이 목록을 아직
      // 기다리는 동안 "연결된 가구가 없어요"를 띄우면 있는 가구를 없다고 말하는 셈이다.
      !fallbackHouseholdId && !householdId
      ? "연결된 가구가 없어요"
      : members.data
        ? `가족 ${members.data.members.length}명`
        : members.isError
          ? summaryUnavailableText
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
          ? summaryUnavailableText
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
   */
  const recurringTemplateCount = useRecurringExpenseStore((state) => state.templates.length);

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
