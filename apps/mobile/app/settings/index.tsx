import { useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { resetLocalBackend } from "../../src/api/fixture-runtime";
import { isPixelLockBuild } from "../../src/pixelLock/build-profile";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon, AppScreen, Card, ListRow, SampleDataBanner, ScreenHeader } from "../../src/design-system";
import { theme } from "../../src/theme";

export default function SettingsScreen() {
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const clearSession = useSessionStore((state) => state.clearSession);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const clearSelectedChild = useSelectedChildStore((state) => state.clearSelectedChildId);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);
  const queryClient = useQueryClient();

  const handleLogout = () => {
    Alert.alert("로그아웃 할까요?", "다시 로그인해야 이용할 수 있어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          if (isTestSession) resetLocalBackend();
          queryClient.clear();
          clearSession();
          clearSelectedChild();
          resetOnboarding();
          router.replace("/launch-animation");
        }
      }
    ]);
  };

  return (
    <AppScreen>
      <View testID="screen-SET-001" accessibilityLabel="screen-SET-001" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <ScreenHeader eyebrow="설정" title="설정" subtitle="계정과 가족 정보를 관리해요" />
        <Card style={{ gap: 6 }}>
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>현재 가구</Text>
            <Text style={summaryValueStyle}>{householdId ? "연결됨" : "연결된 가구가 없어요"}</Text>
          </View>
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>선택된 아이</Text>
            <Text style={summaryValueStyle}>{childId ? "선택됨" : "선택된 아이가 없어요"}</Text>
          </View>
        </Card>
      </View>

      <View testID="screen-SET-002" accessibilityLabel="screen-SET-002" style={{ gap: theme.spacing.gap }}>
        {!isPixelLockBuild() ? <>
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="calendar-month-outline" size={22} />}
            title="준비 캘린더"
            subtitle="예정일, 교체일, 반복구매일을 확인해요"
            onPress={() => router.push("/preparation-calendar" as Href)}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="package-variant" size={22} />}
            title="사용자 정의 묶음"
            subtitle="반복되는 준비를 묶어서 저장해요"
            onPress={() => router.push("/custom-bundles" as Href)}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="calendar-week" size={22} />}
            title="가족 주간 브리핑"
            subtitle="한 주의 준비와 비용을 짧게 확인해요"
            onPress={() => router.push("/weekly-briefing" as Href)}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="receipt" size={22} />}
            title="영수증 빠른 입력"
            subtitle="영수증을 선택하고 확인 후 지출로 저장해요"
            onPress={() => router.push("/receipts/new" as Href)}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="bell-outline" size={22} />}
            title="알림 설정"
            subtitle="유형별 알림과 주간 브리핑을 조정해요"
            onPress={() => router.push("/notification-preferences" as Href)}
          />
        </> : null}
        <ListRow
          icon={<AppIcon color={theme.colors.coral[600]} name="account-child-outline" size={22} />}
          title="아이 · 가구 프로필"
          subtitle="아이 정보와 가구 구성을 확인해요"
          onPress={() => router.push("/children" as Href)}
        />
        <ListRow
          icon={<AppIcon color={theme.colors.coral[600]} name="wallet-outline" size={22} />}
          title="예산 수정"
          subtitle="이번 달 예산을 조정해요"
          onPress={() => router.push("/budget")}
        />
        <ListRow
          icon={<AppIcon color={theme.colors.coral[600]} name="credit-card-outline" size={22} />}
          title="결제수단"
          subtitle="생활비 카드, 현금 등 내 결제수단을 관리해요"
          onPress={() => router.push("/payment-methods" as Href)}
        />
        <ListRow
          icon={<AppIcon color={theme.colors.coral[600]} name="shield-lock-outline" size={22} />}
          title="약관 및 개인정보"
          subtitle="동의 내역과 삭제 · 탈퇴를 관리해요"
          onPress={() => router.push("/settings/privacy")}
        />
        <ListRow
          icon={<AppIcon color={theme.colors.coral[600]} name="account-group-outline" size={22} />}
          title="가족 관리"
          subtitle="초대와 멤버를 관리해요"
          onPress={() => router.push("/family")}
        />
        <ListRow
          icon={<AppIcon color={theme.colors.coral[600]} name="file-excel-outline" size={22} />}
          title="데이터 가져오기"
          subtitle="엑셀 파일로 지출을 가져와요"
          onPress={() => router.push("/import")}
        />
        <Pressable onPress={handleLogout} style={logoutRowStyle}>
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
