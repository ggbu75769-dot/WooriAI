/**
 * AUTH-102: real Kakao OIDC login flow for mobile (prepare -> Kakao authorize -> exchange).
 *
 * ## Required environment variables (set at build time; no code changes needed afterwards)
 *
 * The feature is OFF until ALL of these are present, so demo/dev builds keep using the
 * existing `/auth/oauth-login` dev stub (see app/(auth)/login.tsx):
 *
 * - `EXPO_PUBLIC_KAKAO_ENABLED=1`
 *     Explicit opt-in switch. Anything other than "1" keeps the real flow disabled even if
 *     the other keys are set.
 * - `EXPO_PUBLIC_KAKAO_CLIENT_ID`
 *     The Kakao app key used as OAuth `client_id` (the REST API key -- or native app key --
 *     from the Kakao Developers console for the same Kakao app the API server verifies
 *     ID tokens against; see `KAKAO_*` config in apps/api).
 * - `EXPO_PUBLIC_KAKAO_REDIRECT_URI`
 *     The redirect URI the browser returns to, e.g. `wooriai://oauth/kakao` (the app scheme
 *     is `wooriai`, see app.json). It must be BOTH registered in the Kakao Developers
 *     console AND present in the API server's `OAUTH_KAKAO_REDIRECT_URIS` allowlist --
 *     prepare/exchange reject it otherwise (OAUTH_REDIRECT_URI_NOT_ALLOWED).
 *
 * ## Dependency choice (why no expo-auth-session / expo-web-browser / expo-crypto)
 *
 * None of those packages are installed, and none are present in the workspace's pnpm store,
 * so adding any of them would require a network download -- forbidden for this ticket. The
 * flow is therefore implemented manually on top of what IS already bundled:
 * - `expo-linking` (installed) opens the system browser (`Linking.openURL`) and delivers the
 *   `wooriai://...` redirect back via its `url` event listener. It is lazily imported (same
 *   pattern as src/stores/secure-session-storage.ts) so importing this module under
 *   vitest/node never touches native code.
 * - PKCE S256 is computed locally (./pkce.ts + ./sha256.ts, pinned against node:crypto in
 *   tests).
 * One behavioral difference vs expo-web-browser's auth session: a plain `Linking.openURL`
 * browser tab has no "dismissed" signal, so a user abandoning the browser surfaces as
 * KAKAO_LOGIN_TIMEOUT after LOGIN_TIMEOUT_MS instead of an immediate cancel. Kakao's own
 * "취소" button does redirect back (with `error=access_denied`) and is surfaced immediately
 * as KakaoLoginCancelledError.
 *
 * ## Server contract (verified against apps/api/src/auth/kakao/* and
 * apps/api/test/auth-kakao-oidc.e2e.test.ts)
 *
 * - POST /auth/kakao/prepare  { redirectUri, codeChallenge? }
 *     -> { transactionId, state, nonce }
 *   NOTE: the API's validation pipe uses `forbidNonWhitelisted`, so the request must contain
 *   ONLY those keys -- in particular no `codeChallengeMethod` (S256 is implied server-side).
 * - POST /auth/kakao/exchange { transactionId, state, code, redirectUri, codeVerifier? }
 *     -> { user, tokens: { accessToken, refreshToken, expiresIn }, onboardingRequired }
 *   (same success shape as the dev-stub `/auth/oauth-login`, so login.tsx reuses its
 *   existing success handling unchanged).
 */
import {
  kakaoExchange,
  kakaoPrepare,
  type KakaoExchangeResult,
  type KakaoPrepareResponse
} from "../api/client";
import { createPkcePair, type PkcePair } from "./pkce";

export const KAKAO_AUTHORIZE_ENDPOINT = "https://kauth.kakao.com/oauth/authorize";

/** Upper bound on how long we wait for the browser to redirect back into the app. */
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export type KakaoLoginErrorCode =
  | "KAKAO_NOT_CONFIGURED"
  | "KAKAO_LOGIN_CANCELLED"
  | "KAKAO_LOGIN_TIMEOUT"
  | "KAKAO_BROWSER_OPEN_FAILED"
  | "KAKAO_STATE_MISMATCH"
  | "KAKAO_REDIRECT_INVALID"
  | "KAKAO_PROVIDER_ERROR";

export class KakaoLoginError extends Error {
  readonly code: KakaoLoginErrorCode;
  constructor(code: KakaoLoginErrorCode, message: string) {
    super(message);
    this.name = "KakaoLoginError";
    this.code = code;
  }
}

/** User pressed 취소 on the Kakao consent screen (redirect carried `error=access_denied`). */
export class KakaoLoginCancelledError extends KakaoLoginError {
  constructor() {
    super("KAKAO_LOGIN_CANCELLED", "카카오 로그인이 취소되었어요.");
    this.name = "KakaoLoginCancelledError";
  }
}

export type KakaoEnvConfig = {
  clientId: string;
  redirectUri: string;
};

/**
 * Reads the build-time env configuration. Each `process.env.EXPO_PUBLIC_*` member expression
 * is kept literal (never destructured/dynamically indexed) because babel-preset-expo inlines
 * these at bundle time.
 */
export function getKakaoEnvConfig(): KakaoEnvConfig | null {
  const enabled = process.env.EXPO_PUBLIC_KAKAO_ENABLED === "1";
  const clientId = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID;
  const redirectUri = process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI;
  if (!enabled || !clientId || !redirectUri) return null;
  return { clientId, redirectUri };
}

/** Feature flag consumed by app/(auth)/login.tsx: real Kakao flow vs the existing dev stub. */
export function isKakaoLoginAvailable(): boolean {
  return getKakaoEnvConfig() !== null;
}

export type AuthorizeUrlParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
};

/**
 * Builds the Kakao authorize URL manually (encodeURIComponent + join) instead of via the
 * URL/URLSearchParams globals, whose React Native polyfills are historically incomplete.
 */
export function buildKakaoAuthorizeUrl(params: AuthorizeUrlParams): string {
  const query = [
    ["client_id", params.clientId],
    ["redirect_uri", params.redirectUri],
    ["response_type", "code"],
    ["state", params.state],
    ["nonce", params.nonce],
    ["code_challenge", params.codeChallenge],
    ["code_challenge_method", "S256"]
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${KAKAO_AUTHORIZE_ENDPOINT}?${query}`;
}

/**
 * Fixed Korean copy for the standard OAuth error codes Kakao can send back on the redirect
 * (RFC 6749 §4.1.2.1; access_denied is handled earlier as a cancellation). The redirect's
 * `error` param is attacker-influenceable (it arrives via an app-scheme URL), so it must
 * NEVER be echoed verbatim into UI copy -- only these fixed strings are shown.
 */
const KAKAO_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "카카오 인증 요청이 올바르지 않아요. 다시 시도해주세요.",
  unauthorized_client: "카카오 앱 설정에 문제가 있어요. 잠시 후 다시 시도해주세요.",
  unsupported_response_type: "카카오 앱 설정에 문제가 있어요. 잠시 후 다시 시도해주세요.",
  invalid_scope: "카카오 앱 설정에 문제가 있어요. 잠시 후 다시 시도해주세요.",
  server_error: "카카오 서버에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해주세요.",
  temporarily_unavailable: "카카오 서비스를 지금 이용할 수 없어요. 잠시 후 다시 시도해주세요."
};

/**
 * Reduces an unknown redirect `error` value to something safe to show for debugging context:
 * lowercase [a-z_-] only, max 32 chars. Anything else (HTML, spaces, hangul, digits...) is
 * stripped so arbitrary redirect input can never reach the UI.
 */
export function sanitizeOauthErrorCode(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z_-]/g, "").slice(0, 32);
}

function kakaoProviderErrorMessage(errorCode: string): string {
  const known = KAKAO_OAUTH_ERROR_MESSAGES[errorCode];
  if (known) return known;
  const sanitized = sanitizeOauthErrorCode(errorCode);
  return sanitized ? `카카오 인증에 실패했어요. (${sanitized})` : "카카오 인증에 실패했어요.";
}

/** Tiny query parser (no URLSearchParams -- see buildKakaoAuthorizeUrl's rationale). */
function parseQuery(url: string): Record<string, string> {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return {};
  const query = url.slice(queryStart + 1).split("#")[0];
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? "" : decodeURIComponent(pair.slice(eq + 1));
    params[key] = value;
  }
  return params;
}

/**
 * Validates the redirect URL Kakao sent the browser back with and extracts the authorization
 * code. The state echo must match the prepare-issued state BEFORE the code is trusted.
 */
export function parseKakaoRedirectUrl(url: string, expectedState: string): { code: string } {
  const params = parseQuery(url);

  if (params.error === "access_denied") {
    throw new KakaoLoginCancelledError();
  }
  if (params.error) {
    throw new KakaoLoginError("KAKAO_PROVIDER_ERROR", kakaoProviderErrorMessage(params.error));
  }
  if (!params.code) {
    throw new KakaoLoginError("KAKAO_REDIRECT_INVALID", "카카오 인증 응답을 읽을 수 없어요.");
  }
  if (params.state !== expectedState) {
    throw new KakaoLoginError("KAKAO_STATE_MISMATCH", "인증 절차를 다시 시작해주세요.");
  }
  return { code: params.code };
}

/**
 * Opens the authorize URL in the system browser and resolves with the full redirect URL once
 * the app is re-entered via the registered scheme. expo-linking is imported lazily so this
 * module stays importable under vitest/node (same pattern as secure-session-storage.ts).
 */
async function openAuthSessionWithLinking(
  authorizeUrl: string,
  redirectUri: string,
  timeoutMs: number
): Promise<string> {
  const Linking = await import("expo-linking").catch(() => null);
  if (!Linking) {
    throw new KakaoLoginError("KAKAO_BROWSER_OPEN_FAILED", "브라우저를 열 수 없어요.");
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      subscription.remove();
      clearTimeout(timer);
      action();
    };

    const subscription = Linking.addEventListener("url", (event: { url: string }) => {
      if (event.url.startsWith(redirectUri)) {
        finish(() => resolve(event.url));
      }
    });

    const timer = setTimeout(() => {
      finish(() =>
        reject(new KakaoLoginError("KAKAO_LOGIN_TIMEOUT", "카카오 로그인 응답이 없어요. 다시 시도해주세요."))
      );
    }, timeoutMs);

    Linking.openURL(authorizeUrl).catch(() => {
      finish(() => reject(new KakaoLoginError("KAKAO_BROWSER_OPEN_FAILED", "브라우저를 열 수 없어요.")));
    });
  });
}

export type KakaoLoginDeps = {
  prepare: (body: { redirectUri: string; codeChallenge?: string }) => Promise<KakaoPrepareResponse>;
  exchange: (body: {
    transactionId: string;
    state: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }) => Promise<KakaoExchangeResult>;
  openAuthSession: (authorizeUrl: string, redirectUri: string, timeoutMs: number) => Promise<string>;
  createPkce: () => PkcePair;
};

const defaultDeps: KakaoLoginDeps = {
  prepare: kakaoPrepare,
  exchange: kakaoExchange,
  openAuthSession: openAuthSessionWithLinking,
  createPkce: createPkcePair
};

/**
 * Runs the full real login flow. Resolves with the same `{ user, tokens, onboardingRequired }`
 * shape as the dev-stub `oauthLogin("kakao")`, so callers store the session identically.
 * `overrides` exists for tests only -- production callers pass nothing.
 */
export async function loginWithKakao(
  overrides: Partial<KakaoLoginDeps> = {}
): Promise<KakaoExchangeResult> {
  const config = getKakaoEnvConfig();
  if (!config) {
    throw new KakaoLoginError(
      "KAKAO_NOT_CONFIGURED",
      "카카오 로그인이 설정되지 않았어요. (EXPO_PUBLIC_KAKAO_* 환경변수 확인)"
    );
  }
  const deps: KakaoLoginDeps = { ...defaultDeps, ...overrides };

  const pkce = deps.createPkce();
  // forbidNonWhitelisted on the API: send exactly these keys, nothing else.
  const prepared = await deps.prepare({
    redirectUri: config.redirectUri,
    codeChallenge: pkce.codeChallenge
  });

  const authorizeUrl = buildKakaoAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: prepared.state,
    nonce: prepared.nonce,
    codeChallenge: pkce.codeChallenge
  });

  const redirectUrl = await deps.openAuthSession(authorizeUrl, config.redirectUri, LOGIN_TIMEOUT_MS);
  const { code } = parseKakaoRedirectUrl(redirectUrl, prepared.state);

  return deps.exchange({
    transactionId: prepared.transactionId,
    state: prepared.state,
    code,
    redirectUri: config.redirectUri,
    codeVerifier: pkce.codeVerifier
  });
}
