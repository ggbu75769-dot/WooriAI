import { useState } from "react";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAnalyticsConsentStore } from "../../src/analytics/flag";
import { LOCAL_SESSION_TOKEN, oauthLogin, upsertConsents } from "../../src/api/client";
import {
  isKakaoLoginAvailable,
  KakaoLoginCancelledError,
  KakaoLoginError,
  loginWithKakao
} from "../../src/auth/kakao-login";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen } from "../../src/ui";

const isTestLoginEnabled = process.env.EXPO_PUBLIC_TEST_LOGIN === "1";
const logoMark = require("../../assets/illustrations/logo_mark.png");

function ConsentRow({
  checked,
  label,
  onPress,
  optional = false,
  sublabel
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
  optional?: boolean;
  sublabel?: string;
}) {
  const badge = optional ? "선택" : "필수";
  return (
    <Pressable
      accessibilityLabel={`${label}, ${badge}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.consentRow, pressed ? styles.pressed : null]}
    >
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={optional ? styles.optionalBadge : styles.requiredBadge}>{badge}</Text>
      <View style={styles.consentLabelColumn}>
        <Text style={styles.consentLabel}>{label}</Text>
        {sublabel ? <Text style={styles.consentSublabel}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function LoginScreen() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  // ANA-104: local checkbox state only -- the shared analytics consent store is
  // NOT flipped while merely toggling; it is committed once, right before login
  // proceeds (see continueWithLogin), so abandoning the login screen leaves the
  // stored choice untouched. The checkbox INITIALIZES from the store's current
  // value (never-consented default is OFF): a user who enabled 통계 수집 in
  // settings and later re-logs-in keeps their prior consent unless they actively
  // uncheck it here -- a hardcoded `false` initial would silently revoke it at
  // the single commit below.
  const [analyticsAccepted, setAnalyticsAccepted] = useState(
    () => useAnalyticsConsentStore.getState().enabled
  );
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const setAnalyticsConsent = useAnalyticsConsentStore((state) => state.setEnabled);
  const setSession = useSessionStore((state) => state.setSession);
  const startTestSession = useSessionStore((state) => state.startTestSession);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);
  const requiredAccepted = termsAccepted && privacyAccepted;

  async function login() {
    if (!requiredAccepted || isLoginPending) return;
    setLoginError(null);
    setIsLoginPending(true);
    try {
      // AUTH-102: real Kakao OIDC flow (prepare -> browser -> exchange) when the
      // EXPO_PUBLIC_KAKAO_* env keys are configured; otherwise the existing dev stub,
      // byte-for-byte unchanged. Both resolve the same { user, tokens, onboardingRequired }
      // shape, so the success handling below is shared.
      const result = isKakaoLoginAvailable() ? await loginWithKakao() : await oauthLogin("kakao");
      setSession({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        userId: result.user.id,
        defaultHouseholdId: result.user.households?.[0]?.id ?? null
      });
      await upsertConsents(result.tokens.accessToken);
      router.replace("/onboarding/child-status");
    } catch (error) {
      // Pressing 취소 on Kakao's consent screen is a normal outcome, not an error state.
      if (error instanceof KakaoLoginCancelledError) return;
      // Typed Kakao failures (timeout, browser open failure, state mismatch, provider error,
      // misconfiguration -- see src/auth/kakao-login.ts) each carry their own user-facing
      // Korean message; surface it instead of the misleading dev-stub connection copy.
      if (error instanceof KakaoLoginError) {
        setLoginError(error.message);
        return;
      }
      // Untyped errors: on the real Kakao path these are network/API failures against the
      // production server, so show production-appropriate copy; the "PC와 같은 Wi-Fi" hint
      // stays reserved for the dev-stub path, where the API server really is a local process.
      setLoginError(
        isKakaoLoginAvailable()
          ? "로그인 중 문제가 발생했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요."
          : "서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요."
      );
    } finally {
      setIsLoginPending(false);
    }
  }

  function continueWithLogin() {
    if (!requiredAccepted || isLoginPending) return;
    // ANA-104: commit the optional analytics choice to the shared consent store
    // exactly when login proceeds (test path and Kakao path alike). The checkbox
    // never gates this button -- it stays optional -- and the same store backs the
    // 통계 수집 동의(선택) toggle in settings, so the user can revoke it any time.
    setAnalyticsConsent(analyticsAccepted);
    if (isTestLoginEnabled) {
      startTestSession();
      markHomeReached();
      void upsertConsents(LOCAL_SESSION_TOKEN).catch(() => {});
      router.replace("/(tabs)");
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
          <Text style={styles.consentDescription}>
            서비스 이용에 필요한 필수 항목이에요. 선택 항목은 동의하지 않아도 시작할 수 있어요.
          </Text>
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
            <View style={styles.divider} />
            <ConsentRow
              checked={analyticsAccepted}
              label="익명 사용 통계 수집 동의"
              onPress={() => setAnalyticsAccepted((value) => !value)}
              optional
              sublabel="익명화된 사용 통계만 수집해요. 언제든지 설정에서 끌 수 있어요."
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
    fontSize: 15,
    fontWeight: "700"
  },
  consentLabelColumn: {
    flex: 1,
    gap: 2
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
  consentSublabel: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 17
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
  optionalBadge: {
    backgroundColor: theme.colors.beige,
    borderRadius: theme.radii.pill,
    color: theme.colors.gray600,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4
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
