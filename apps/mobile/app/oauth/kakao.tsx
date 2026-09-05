import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { KoreanText as Text } from "../../src/design-system/components/KoreanText";
import { completeOAuthLogin } from "../../src/auth/complete-oauth-login";
import { resumeKakaoLoginFromUrl } from "../../src/auth/kakao-login";
import { AppScreen } from "../../src/ui";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function KakaoOAuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string | string[]; state?: string | string[]; error?: string | string[] }>();
  const [message, setMessage] = useState("카카오 로그인을 마무리하고 있어요.");

  useEffect(() => {
    const callbackUrl = new URL("wooriai://oauth/kakao");
    for (const key of ["code", "state", "error"] as const) {
      const value = first(params[key]);
      if (value) callbackUrl.searchParams.set(key, value);
    }
    void resumeKakaoLoginFromUrl(callbackUrl.toString())
      .then(completeOAuthLogin)
      .catch(() => {
        setMessage("로그인을 완료하지 못했어요. 다시 시도해 주세요.");
        setTimeout(() => router.replace("/login"), 1200);
      });
  }, [params.code, params.error, params.state]);

  return (
    <AppScreen>
      <View accessibilityLabel="카카오 로그인 처리" style={{ flex: 1, justifyContent: "center" }}>
        <Text style={{ textAlign: "center" }}>{message}</Text>
      </View>
    </AppScreen>
  );
}
