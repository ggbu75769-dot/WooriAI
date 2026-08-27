import { useQuery } from "@tanstack/react-query";
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
  EXPORT_SIGNED_OUT_CAPTION,
  ExpenseCsvExportCard,
  ExpenseCsvExportToast,
  useExpenseCsvExport
} from "../../src/export/ExpenseCsvExport";
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

export default function SettingsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
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
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });

  const householdSummary = !authToken
    ? summarySignedOutText
    : !householdId
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
        ? `${selectedChild.nickname} · ${selectedChild.stageLabel}`
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

  const handleLogout = () => {
    Alert.alert("로그아웃 할까요?", "다시 로그인해야 이용할 수 있어요.", [
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
        <ScreenHeader eyebrow="설정" title="설정" subtitle="계정과 가족 정보를 관리해요" />
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
          icon="✎"
          title="아이 관리"
          subtitle="아이를 전환하거나 정보를 수정해요"
          onPress={() => router.push("/settings/children")}
        />
        {/* NAV-121: "아이 · 가구 프로필"과 "가족 관리"가 둘 다 /family로 가던 중복 행을 하나로 합쳤다.
            아이 정보는 위의 아이 관리(SET-005)가, 가구 구성·초대·멤버는 이 행이 담당한다. */}
        <ListRow
          icon="♥"
          title="가족 관리"
          subtitle="가구 프로필과 초대 · 멤버를 관리해요"
          onPress={() => router.push("/family")}
        />
        <ListRow
          icon="₩"
          title="예산 수정"
          subtitle="이번 달 예산을 조정해요"
          onPress={() => router.push("/budget")}
        />
        {/* PUSH-116: 푸시 알림·기기별 수신 관리 (SET-006) */}
        <ListRow
          icon="◎"
          title="알림 설정"
          subtitle="푸시 알림과 기기별 수신을 관리해요"
          onPress={() => router.push("/settings/notifications")}
        />
        <ListRow
          icon="§"
          title="약관 및 개인정보"
          subtitle="동의 내역과 삭제 · 탈퇴를 관리해요"
          onPress={() => router.push("/settings/privacy")}
        />
        <ListRow
          icon="⇩"
          title="데이터 가져오기"
          subtitle="엑셀 파일로 지출을 가져와요"
          onPress={() => router.push("/import")}
        />
        {/* EXP-106 / CLEAN-123(A3): 가져오기의 반대 방향. 세션이 없으면 더보기 탭과 같은
            비활성 행 패턴(안내 문구 + onPress 없음)으로 이유를 밝힌다. */}
        <ListRow
          icon="⇪"
          title="CSV 내보내기"
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
