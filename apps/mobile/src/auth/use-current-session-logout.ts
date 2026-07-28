import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { resetLocalBackend } from "../api/fixture-runtime";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { logoutCurrentSession } from "./logout-current-session";

export function useCurrentSessionLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();

  const confirmLogout = useCallback(() => {
    if (isLoggingOut) return;
    Alert.alert("로그아웃할까요?", "이 기기의 로그인 정보가 안전하게 삭제돼요.", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          if (isLoggingOut) return;
          const wasTestSession = useSessionStore.getState().isTestSession;
          setIsLoggingOut(true);
          void logoutCurrentSession({
            onLocalCleared: () => {
              if (wasTestSession) resetLocalBackend();
              queryClient.clear();
              useSelectedChildStore.getState().clearSelectedChildId();
              useOnboardingProgressStore.getState().resetOnboarding();
              router.replace("/launch-animation");
            }
          })
            .then((result) => {
              if (!result.localCleared) {
                Alert.alert(
                  "로그아웃을 완료하지 못했어요",
                  "기기의 로그인 정보를 안전하게 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
                );
                return;
              }
            })
            .finally(() => setIsLoggingOut(false));
        }
      }
    ]);
  }, [isLoggingOut, queryClient]);

  return { confirmLogout, isLoggingOut };
}
