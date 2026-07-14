import { useState } from "react";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LOCAL_SESSION_TOKEN, oauthLogin, upsertConsents } from "../../src/api/client";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen } from "../../src/ui";

const isTestLoginEnabled = process.env.EXPO_PUBLIC_TEST_LOGIN === "1";
const logoMark = require("../../assets/illustrations/logo_mark.png");

function ConsentRow({
  checked,
  label,
  onPress
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, 필수`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.consentRow, pressed ? styles.pressed : null]}
    >
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.requiredBadge}>필수</Text>
      <Text style={styles.consentLabel}>{label}</Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const setSession = useSessionStore((state) => state.setSession);
  const startTestSession = useSessionStore((state) => state.startTestSession);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);
  const requiredAccepted = termsAccepted && privacyAccepted;

  async function login() {
    if (!requiredAccepted || isLoginPending) return;
    setLoginError(null);
    setIsLoginPending(true);
    try {
      const result = await oauthLogin("kakao");
      resetOnboarding();
      setSession({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        userId: result.user.id,
        defaultHouseholdId: result.user.households?.[0]?.id ?? null
      });
      await upsertConsents(result.tokens.accessToken);
      router.replace("/");
    } catch {
      setLoginError("서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요.");
    } finally {
      setIsLoginPending(false);
    }
  }

  function continueWithLogin() {
    if (!requiredAccepted || isLoginPending) return;
    if (isTestLoginEnabled) {
      resetOnboarding();
      startTestSession();
      void upsertConsents(LOCAL_SESSION_TOKEN).catch(() => {});
      router.replace("/onboarding/child-status");
      return;
    }
    void login();
  }

  return (
    <AppScreen>
      <View accessibilityLabel="우리아이 테스트 로그인" testID="screen-AUTH-001" style={styles.screen}>
        <View style={styles.brandRow}>
          <Image source={logoMark} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandName}>우리아이</Text>
        </View>

        <View style={styles.hero}>
          {isTestLoginEnabled ? (
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>테스트용 APK</Text>
            </View>
          ) : null}
          <Text style={styles.title}>우리 아이의 기록을 시작해요</Text>
          <Text style={styles.subtitle}>
            준비된 테스트 계정으로 로그인하고{`\n`}우리아이의 주요 화면을 편하게 둘러보세요.
          </Text>
        </View>

        <View style={styles.consentCard}>
          <Text style={styles.consentTitle}>시작 전 동의해 주세요</Text>
          <Text style={styles.consentDescription}>서비스 이용에 필요한 필수 항목이에요.</Text>
          <View style={styles.consentList}>
            <ConsentRow
              checked={termsAccepted}
              label="이용약관 동의"
              onPress={() => setTermsAccepted((value) => !value)}
            />
            <View style={styles.divider} />
            <ConsentRow
              checked={privacyAccepted}
              label="개인정보 수집·이용 동의"
              onPress={() => setPrivacyAccepted((value) => !value)}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !requiredAccepted || isLoginPending }}
            disabled={!requiredAccepted || isLoginPending}
            onPress={continueWithLogin}
            style={({ pressed }) => [
              styles.loginButton,
              !requiredAccepted || isLoginPending ? styles.loginButtonDisabled : null,
              pressed ? styles.pressed : null
            ]}
            testID="test-login-button"
          >
            <Text
              style={[
                styles.loginButtonText,
                !requiredAccepted || isLoginPending ? styles.loginButtonTextDisabled : null
              ]}
            >
              {isLoginPending
                ? "로그인 중..."
                : isTestLoginEnabled
                  ? "테스트 계정으로 시작하기"
                  : "카카오로 시작하기"}
            </Text>
          </Pressable>
          <Text style={styles.testNotice}>
            {isTestLoginEnabled
              ? "테스트 데이터는 이 기기에만 저장되며 실제 카카오 로그인이 아니에요."
              : "로그인하면 필수 약관 동의가 계정에 저장돼요."}
          </Text>
          {loginError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{loginError}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brandName: {
    color: theme.colors.mainCoral,
    fontSize: 24,
    fontWeight: "800"
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  checkbox: {
    alignItems: "center",
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    borderWidth: 1.5,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  checkboxChecked: {
    backgroundColor: theme.colors.mainCoral,
    borderColor: theme.colors.mainCoral
  },
  checkmark: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 19
  },
  consentCard: {
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.08)",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: 5,
    padding: 18,
    ...theme.shadows.card
  },
  consentDescription: {
    color: theme.colors.gray600,
    fontSize: 13,
    lineHeight: 19
  },
  consentLabel: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: 15,
    fontWeight: "700"
  },
  consentList: {
    marginTop: 8
  },
  consentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 58
  },
  consentTitle: {
    color: theme.colors.brown,
    fontSize: 18,
    fontWeight: "800"
  },
  divider: {
    backgroundColor: theme.colors.gray300,
    height: StyleSheet.hairlineWidth
  },
  errorCard: {
    backgroundColor: "#FFF0ED",
    borderRadius: 14,
    padding: 12
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  footer: {
    gap: 10,
    marginTop: "auto"
  },
  hero: {
    gap: 10,
    paddingTop: 14
  },
  loginButton: {
    alignItems: "center",
    backgroundColor: theme.colors.mainCoral,
    borderRadius: theme.radii.button,
    height: theme.ctaHeight,
    justifyContent: "center"
  },
  loginButtonDisabled: {
    backgroundColor: theme.colors.primary100
  },
  loginButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "800"
  },
  loginButtonTextDisabled: {
    color: theme.colors.gray600
  },
  logo: {
    height: 48,
    width: 48
  },
  pressed: {
    opacity: 0.82
  },
  requiredBadge: {
    backgroundColor: theme.colors.peach,
    borderRadius: theme.radii.pill,
    color: theme.colors.mainCoral,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  screen: {
    flex: 1,
    gap: 24,
    minHeight: 700
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 15,
    lineHeight: 23
  },
  testBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.mint,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  testBadgeText: {
    color: theme.colors.brown,
    fontSize: 12,
    fontWeight: "800"
  },
  testNotice: {
    color: theme.colors.gray600,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 10,
    textAlign: "center"
  },
  title: {
    color: theme.colors.brown,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 37
  }
});
