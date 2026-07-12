import { router } from "expo-router";
import { View } from "react-native";
import { theme } from "../src/theme";
import { AppScreen, EmptyStateCard, ScreenHeader } from "../src/ui";

export default function NotificationsScreen() {
  return (
    <AppScreen>
      <View testID="screen-notifications" accessibilityLabel="screen-notifications" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="알림" title="알림" subtitle="가족과 예산 소식을 모아볼 수 있어요" />
        <EmptyStateCard
          title="아직 알림이 없어요. 가족 초대와 예산 소식이 여기에 표시될 거예요."
          actionLabel="뒤로가기"
          onPress={() => router.back()}
        />
      </View>
    </AppScreen>
  );
}
