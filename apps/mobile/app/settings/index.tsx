import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, ListRow, ScreenHeader } from "../../src/ui";

export default function SettingsScreen() {
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const clearSession = useSessionStore((state) => state.clearSession);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const clearSelectedChild = useSelectedChildStore((state) => state.clearSelectedChildId);

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
      <View testID="screen-SET-001" accessibilityLabel="screen-SET-001" style={{ gap: theme.spacing.section }}>
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
        <ListRow
          icon="◐"
          title="아이 · 가구 프로필"
          subtitle="아이 정보와 가구 구성을 확인해요"
          onPress={() => router.push("/family")}
        />
        <ListRow
          icon="₩"
          title="예산 수정"
          subtitle="이번 달 예산을 조정해요"
          onPress={() => router.push("/budget")}
        />
        <ListRow
          icon="§"
          title="약관 및 개인정보"
          subtitle="동의 내역과 삭제 · 탈퇴를 관리해요"
          onPress={() => router.push("/settings/privacy")}
        />
        <ListRow
          icon="♥"
          title="가족 관리"
          subtitle="초대와 멤버를 관리해요"
          onPress={() => router.push("/family")}
        />
        <ListRow
          icon="⇩"
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
