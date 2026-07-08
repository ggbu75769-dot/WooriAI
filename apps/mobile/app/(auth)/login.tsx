import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { oauthLogin, upsertConsents } from "../../src/api/client";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

export default function LoginScreen() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const setSession = useSessionStore((state) => state.setSession);
  const requiredAccepted = termsAccepted && privacyAccepted;

  async function login() {
    if (!requiredAccepted || isLoginPending) return;
    setLoginError(null);
    setIsLoginPending(true);
    try {
      const result = await oauthLogin("kakao");
      setSession({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        userId: result.user.id,
        defaultHouseholdId: result.user.households?.[0]?.id ?? null
      });
      await upsertConsents(result.tokens.accessToken);
      router.replace("/onboarding/child-status");
    } catch {
      setLoginError("서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요.");
    } finally {
      setIsLoginPending(false);
    }
  }

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, gap: 16, padding: 24 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700" }}>
        우리아이
      </Text>
      <Text>AUTH-001</Text>
      <Pressable onPress={() => setTermsAccepted((value) => !value)}>
        <Text>{termsAccepted ? "[x]" : "[ ]"} 필수 이용약관 동의</Text>
      </Pressable>
      <Pressable onPress={() => setPrivacyAccepted((value) => !value)}>
        <Text>{privacyAccepted ? "[x]" : "[ ]"} 필수 개인정보 동의</Text>
      </Pressable>
      <Pressable
        disabled={!requiredAccepted || isLoginPending}
        onPress={login}
        style={{
          alignItems: "center",
          backgroundColor:
            requiredAccepted && !isLoginPending ? theme.colors.primary500 : theme.colors.primary100,
          borderRadius: 8,
          height: theme.ctaHeight,
          justifyContent: "center"
        }}
      >
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>
          {isLoginPending ? "로그인 중..." : "카카오로 시작하기"}
        </Text>
      </Pressable>
      {loginError ? <Text style={{ color: "#B3261E" }}>{loginError}</Text> : null}
    </View>
  );
}
