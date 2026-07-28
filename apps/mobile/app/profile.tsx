import { Redirect, router, type Href } from "expo-router";
import { Alert, Linking, View } from "react-native";
import { useCurrentSessionLogout } from "../src/auth/use-current-session-logout";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";
import { AppIcon, AppScreen, InputField, ListRow, SampleDataBanner, ScreenHeader, SecondaryButton } from "../src/ui";
import appManifest from "../app.json";

const providerLabels = {
  kakao: "카카오",
  apple: "Apple",
  google: "Google",
  test: "기기 사용자"
} as const;
const appVersion = appManifest.expo.version;
const appPackage = appManifest.expo.android.package;

export default function ProfileScreen() {
  const displayName = useSessionStore((state) => state.displayName);
  const email = useSessionStore((state) => state.email);
  const authProvider = useSessionStore((state) => state.authProvider);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const hasSession = useSessionStore((state) => Boolean(state.accessToken || state.isTestSession));
  const { confirmLogout, isLoggingOut } = useCurrentSessionLogout();

  if (!hasSession) {
    return <Redirect href="/launch-animation" />;
  }

  return (
    <AppScreen>
      <View accessibilityLabel="내 프로필" testID="screen-PROFILE-001" style={{ gap: theme.spacing.section }}>
        {isTestSession ? <SampleDataBanner /> : null}
        <ScreenHeader eyebrow="PROFILE-001" title="내 프로필" subtitle="로그인 계정과 개인정보 설정을 확인해요." />

        <View style={{ gap: theme.spacing.gap }}>
          <InputField label="이름" value={displayName ?? "이름 미등록"} />
          <InputField label="이메일" value={email ?? "이메일 미제공"} />
          <InputField label="로그인 방식" value={authProvider ? providerLabels[authProvider] : "확인할 수 없음"} />
        </View>

        <View style={{ gap: theme.spacing.gap }}>
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="account-child-outline" size={22} />}
            title="아이 프로필"
            subtitle="아이 추가, 전환, 수정"
            onPress={() => router.push("/children" as Href)}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="account-group-outline" size={22} />}
            title="가족"
            subtitle="멤버, 역할, 초대와 소유자 이전"
            onPress={() => router.push("/family" as Href)}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="bell-outline" size={22} />}
            title="알림 설정"
            subtitle="준비와 가족 알림을 관리해요"
            onPress={() => router.push("/notification-preferences" as Href)}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="shield-lock-outline" size={22} />}
            title="개인정보"
            subtitle="동의, 탈퇴, 삭제 범위 확인"
            onPress={() => router.push("/settings/privacy")}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="lifebuoy" size={22} />}
            title="고객센터"
            subtitle="support@wooriai.app"
            onPress={() => void Linking.openURL("mailto:support@wooriai.app")}
          />
          <ListRow
            icon={<AppIcon color={theme.colors.coral[600]} name="information-outline" size={22} />}
            title="앱 정보"
            subtitle={`버전 ${appVersion}`}
            onPress={() => Alert.alert("앱 정보", `우리아이 ${appVersion}\n${appPackage}`)}
          />
        </View>

        <SecondaryButton
          disabled={isLoggingOut}
          label={isLoggingOut ? "로그아웃 중" : "로그아웃"}
          onPress={confirmLogout}
        />
      </View>
    </AppScreen>
  );
}
