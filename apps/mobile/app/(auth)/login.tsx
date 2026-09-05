import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import {
  fixtureSessionToken,
  getCurrentLegalDocuments,
  upsertConsents,
  type LegalDocument
} from "../../src/api/client";
import { completeOAuthLogin } from "../../src/auth/complete-oauth-login";
import { startKakaoLogin } from "../../src/auth/kakao-login";
import { fetchAppConfig } from "../../src/config/app-config";
import { buildConsentSelections, resolveRequiredLegalDocuments } from "../../src/legal/consent";
import { isTestLoginBuild } from "../../src/pixelLock/build-profile";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppIcon, AppScreen } from "../../src/design-system";

const isTestLoginEnabled = isTestLoginBuild();
const logoLockup = require("../../assets/illustrations/logo_lockup.png");

function ConsentRow({
  checked,
  disabled,
  label,
  opened,
  onOpen,
  onPress
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  opened: boolean;
  onOpen: () => void;
  onPress: () => void;
}) {
  return (
    <View style={styles.consentRow}>
      <Pressable
        accessibilityLabel={`${label}, 필수 동의`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [styles.consentToggle, pressed ? styles.pressed : null]}
      >
        <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
          {checked ? <AppIcon color={theme.colors.white} name="check" size={17} /> : null}
        </View>
        <Text style={styles.requiredBadge}>필수</Text>
        <Text style={styles.consentLabel}>{label}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`${label} 문서 ${opened ? "닫기" : "보기"}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: opened }}
        disabled={disabled}
        hitSlop={8}
        onPress={onOpen}
        style={({ pressed }) => [styles.documentButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.documentButtonText}>{opened ? "닫기" : "보기"}</Text>
      </Pressable>
    </View>
  );
}

export default function LoginScreen() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [openedDocument, setOpenedDocument] = useState<LegalDocument | null>(null);
  const accessToken = useSessionStore((state) => state.accessToken);
  const startTestSession = useSessionStore((state) => state.startTestSession);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);
  const legalToken = isTestLoginEnabled ? fixtureSessionToken : accessToken;
  const legalDocumentsQuery = useQuery({
    queryKey: ["legal-documents", legalToken ?? "public"],
    queryFn: () => getCurrentLegalDocuments(legalToken),
    retry: false
  });
  const appConfigQuery = useQuery({
    queryKey: ["app-config"],
    enabled: !isTestLoginEnabled && !accessToken,
    queryFn: () => fetchAppConfig(),
    retry: false
  });
  const requiredDocuments = resolveRequiredLegalDocuments(legalDocumentsQuery.data);
  const legalAvailable = Boolean(requiredDocuments);
  const requiredAccepted = legalAvailable && termsAccepted && privacyAccepted;
  const kakaoAvailable = isTestLoginEnabled || Boolean(accessToken) || Boolean(appConfigQuery.data?.config.authProviders.includes("kakao"));
  const appleAdvertised = Boolean(appConfigQuery.data?.config.authProviders.includes("apple"));
  const loginDisabled = !requiredAccepted || isLoginPending || !kakaoAvailable;

  async function openDocument(document: LegalDocument) {
    if (!document.publicUrl && openedDocument?.documentType === document.documentType) {
      setOpenedDocument(null);
      return;
    }
    setOpenedDocument(document);
    if (document.publicUrl) {
      await WebBrowser.openBrowserAsync(document.publicUrl);
    }
  }

  async function login() {
    if (!requiredAccepted || isLoginPending) return;
    setLoginError(null);
    setIsLoginPending(true);
    try {
      const consents = buildConsentSelections(requiredDocuments!);
      if (accessToken) {
        await upsertConsents(accessToken, consents);
        router.replace("/");
        return;
      }
      const result = await startKakaoLogin();
      await completeOAuthLogin(result, consents);
    } catch (error) {
      setLoginError(
        String(error).includes("OAUTH_CANCELLED")
          ? "카카오 로그인이 취소됐어요."
          : "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setIsLoginPending(false);
    }
  }

  async function continueWithLogin() {
    if (!requiredAccepted || isLoginPending) return;
    if (isTestLoginEnabled) {
      setLoginError(null);
      setIsLoginPending(true);
      try {
        resetOnboarding();
        await startTestSession();
        await upsertConsents(fixtureSessionToken, buildConsentSelections(requiredDocuments!));
        router.replace("/onboarding/child-status");
      } catch {
        setLoginError("약관 동의를 저장하지 못했어요. 다시 시도해 주세요.");
      } finally {
        setIsLoginPending(false);
      }
      return;
    }
    await login();
  }

  return (
    <AppScreen>
      <View accessibilityLabel="우리아이 로그인" testID="screen-AUTH-001" style={styles.screen}>
        <View style={styles.brandRow}>
          <Image
            accessibilityLabel="우리아이"
            resizeMode="contain"
            source={logoLockup}
            style={styles.logoLockup}
          />
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>우리 아이의 기록을 시작해요</Text>
          <Text style={styles.subtitle}>
            {isTestLoginEnabled
              ? <>필수 항목에 동의하고{`\n`}우리 가족의 기록을 시작해요.</>
              : <>카카오 계정으로 안전하게 시작하고{`\n`}가족의 기록을 함께 관리해요.</>}
          </Text>
        </View>

        <View style={styles.consentCard}>
          <Text style={styles.consentTitle}>시작 전 동의해 주세요</Text>
          <Text style={styles.consentDescription}>서비스 이용에 필요한 필수 항목이에요.</Text>
          {legalDocumentsQuery.isLoading ? (
            <View accessibilityLiveRegion="polite" style={styles.legalStatus}>
              <ActivityIndicator color={theme.colors.mainCoral} />
              <Text style={styles.consentDescription}>현재 약관을 불러오고 있어요.</Text>
            </View>
          ) : legalAvailable ? (
            <View style={styles.consentList}>
              <ConsentRow
                checked={termsAccepted}
                disabled={isLoginPending}
                label={requiredDocuments!.terms.title}
                opened={openedDocument?.documentType === requiredDocuments!.terms.documentType && !requiredDocuments!.terms.publicUrl}
                onOpen={() => void openDocument(requiredDocuments!.terms)}
                onPress={() => setTermsAccepted((value) => !value)}
              />
              <View style={styles.divider} />
              <ConsentRow
                checked={privacyAccepted}
                disabled={isLoginPending}
                label={requiredDocuments!.privacy.title}
                opened={openedDocument?.documentType === requiredDocuments!.privacy.documentType && !requiredDocuments!.privacy.publicUrl}
                onOpen={() => void openDocument(requiredDocuments!.privacy)}
                onPress={() => setPrivacyAccepted((value) => !value)}
              />
            </View>
          ) : (
            <View accessibilityLiveRegion="assertive" style={styles.legalUnavailable}>
              <Text style={styles.errorText}>
                현재 이용약관을 불러올 수 없어요. 문서를 확인할 수 있을 때 다시 시도해 주세요.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void legalDocumentsQuery.refetch()}
                style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </Pressable>
            </View>
          )}
          {openedDocument && !openedDocument.publicUrl ? (
            <View accessibilityLabel={`${openedDocument.title} 문서 내용`} style={styles.documentPreview}>
              <Text style={styles.documentPreviewTitle}>{openedDocument.title}</Text>
              <Text style={styles.documentPreviewBody}>{openedDocument.bodyMarkdown}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loginDisabled }}
            disabled={loginDisabled}
            onPress={continueWithLogin}
            style={({ pressed }) => [
              styles.loginButton,
              loginDisabled ? styles.loginButtonDisabled : null,
              pressed ? styles.pressed : null
            ]}
            testID="test-login-button"
          >
            <Text
              style={[
                styles.loginButtonText,
                loginDisabled ? styles.loginButtonTextDisabled : null
              ]}
            >
              {isLoginPending
                ? "로그인 중..."
                : isTestLoginEnabled
                  ? "동의하고 시작하기"
                  : accessToken
                    ? "동의하고 계속하기"
                    : "카카오로 시작하기"}
            </Text>
          </Pressable>
          {!isTestLoginEnabled && !accessToken ? (
            <Pressable
              accessibilityLabel="Apple로 시작하기. 현재 사용할 수 없어요."
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              style={[styles.loginButton, styles.appleButton, styles.providerUnavailable]}
            >
              <AppIcon color={theme.colors.textSecondary} name="apple" size={20} />
              <Text style={[styles.loginButtonText, styles.appleButtonText]}>Apple로 시작하기</Text>
            </Pressable>
          ) : null}
          <Text style={styles.testNotice}>
            {isTestLoginEnabled
              ? "입력한 정보는 이 기기에 안전하게 저장돼요."
              : !kakaoAvailable
                ? "현재 로그인 제공자를 확인할 수 없어요. 연결이 복구되면 다시 시도해 주세요."
                : appleAdvertised
                  ? "Apple 로그인은 현재 빌드에서 연결되지 않아 사용할 수 없어요. 카카오 로그인은 사용할 수 있어요."
                  : "Apple 로그인은 현재 제공되지 않아요. 로그인하면 필수 약관 동의가 계정에 저장돼요."}
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
  appleButton: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.gray300,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8
  },
  appleButtonText: {
    color: theme.colors.textSecondary
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row"
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
    gap: 8,
    minHeight: 58
  },
  consentToggle: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 48
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
  documentButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 6
  },
  documentButtonText: {
    color: theme.colors.mainCoral,
    fontSize: 13,
    fontWeight: "800"
  },
  documentPreview: {
    backgroundColor: theme.colors.beige,
    borderRadius: 12,
    gap: 6,
    marginTop: 8,
    maxHeight: 180,
    padding: 12
  },
  documentPreviewBody: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  documentPreviewTitle: {
    color: theme.colors.brown,
    fontSize: 13,
    fontWeight: "800"
  },
  errorCard: {
    backgroundColor: theme.colors.presentation.dangerSurface,
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
  legalStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 58
  },
  legalUnavailable: {
    gap: 8,
    marginTop: 8
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
  logoLockup: {
    height: 52,
    width: 195
  },
  pressed: {
    opacity: 0.82
  },
  providerUnavailable: {
    opacity: 0.58
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
  retryButton: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  retryButtonText: {
    color: theme.colors.mainCoral,
    fontSize: 14,
    fontWeight: "800"
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
