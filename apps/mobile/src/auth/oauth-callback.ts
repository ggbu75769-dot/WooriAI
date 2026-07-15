export type OAuthCallback =
  | { ok: true; code: string; state: string }
  | { ok: false; code: "OAUTH_CANCELLED" | "OAUTH_PROVIDER_ERROR" | "OAUTH_CALLBACK_INVALID"; message: string };

/** Pure parser kept separate from native modules so callback validation is unit-testable. */
export function parseOAuthCallback(url: string): OAuthCallback {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, code: "OAUTH_CALLBACK_INVALID", message: "로그인 응답 주소가 올바르지 않아요." };
  }

  const providerError = parsed.searchParams.get("error");
  if (providerError) {
    if (providerError === "access_denied") {
      return { ok: false, code: "OAUTH_CANCELLED", message: "카카오 로그인이 취소됐어요." };
    }
    return {
      ok: false,
      code: "OAUTH_PROVIDER_ERROR",
      message: parsed.searchParams.get("error_description") ?? "카카오 인증을 완료하지 못했어요."
    };
  }

  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");
  if (!code || !state) {
    return { ok: false, code: "OAUTH_CALLBACK_INVALID", message: "로그인 응답이 완전하지 않아요." };
  }
  return { ok: true, code, state };
}
