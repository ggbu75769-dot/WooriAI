type CompletionError = {
  status?: number;
  code?: string;
};

export function completionErrorMessage(error: unknown): string {
  const typed = error && typeof error === "object" ? error as CompletionError : null;
  const code = typed?.code;
  const status = typed?.status;

  if (code === "VALIDATION_ERROR" || code === "ONBOARDING_DRAFT_INCOMPLETE" || status === 400) {
    return "입력한 내용을 다시 확인해 주세요. 저장된 입력은 그대로 유지돼요.";
  }
  if (code === "STARTER_ITEMS_STALE" || code === "ONBOARDING_DRAFT_CONFLICT" || code === "IDEMPOTENCY_KEY_CONFLICT" || status === 409) {
    return "준비 정보가 변경됐어요. 최신 내용을 확인한 뒤 다시 시도해 주세요.";
  }
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || status === 401 || status === 403) {
    return "로그인 또는 가족 권한을 다시 확인해 주세요. 입력은 보존했어요.";
  }
  if (error instanceof TypeError || code === "NETWORK_ERROR" || code === "FETCH_TIMEOUT" || (error instanceof Error && error.name === "AbortError")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요. 입력은 보존했어요.";
  }
  if (typeof status === "number" && status >= 500) {
    return "서버가 응답하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  return "완료하지 못했어요. 입력은 보존되었으니 다시 시도해 주세요.";
}

export type OnboardingCompletionEffects = {
  selectChild: (childId: string) => void;
  refreshCache: (childId: string) => Promise<void>;
  completeProgress: () => void;
  navigateHome: () => Promise<void> | void;
  clearDraft: () => Promise<void>;
};

export async function finalizeOnboardingSuccess(
  childId: string,
  effects: OnboardingCompletionEffects
): Promise<void> {
  effects.selectChild(childId);
  await effects.refreshCache(childId);
  effects.completeProgress();
  await effects.navigateHome();
  await effects.clearDraft();
}
