import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  exchangeKakaoLogin,
  prepareKakaoLogin,
  type OAuthLoginResult
} from "../api/client";
import { parseOAuthCallback } from "./oauth-callback";

const PENDING_LOGIN_KEY = "wooriai.oauth.kakao.pending";
const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;

type PendingKakaoLogin = {
  transactionId: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
};

let exchangePromise: Promise<OAuthLoginResult> | null = null;

function base64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, "");
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64
  });
  return { verifier, challenge: base64Url(digest) };
}

async function readPendingLogin(): Promise<PendingKakaoLogin> {
  const raw = await SecureStore.getItemAsync(PENDING_LOGIN_KEY);
  if (!raw) throw new Error("OAUTH_TRANSACTION_MISSING");
  let pending: PendingKakaoLogin;
  try {
    pending = JSON.parse(raw) as PendingKakaoLogin;
  } catch {
    await SecureStore.deleteItemAsync(PENDING_LOGIN_KEY);
    throw new Error("OAUTH_TRANSACTION_INVALID");
  }
  if (Date.now() - pending.createdAt > PENDING_LOGIN_TTL_MS) {
    await SecureStore.deleteItemAsync(PENDING_LOGIN_KEY);
    throw new Error("OAUTH_TRANSACTION_EXPIRED");
  }
  return pending;
}

export async function resumeKakaoLoginFromUrl(url: string): Promise<OAuthLoginResult> {
  if (exchangePromise) return exchangePromise;
  exchangePromise = (async () => {
    const callback = parseOAuthCallback(url);
    if (!callback.ok) throw new Error(callback.code);
    const pending = await readPendingLogin();
    if (callback.state !== pending.state) throw new Error("OAUTH_STATE_MISMATCH");
    try {
      return await exchangeKakaoLogin({
        transactionId: pending.transactionId,
        state: callback.state,
        code: callback.code,
        redirectUri: pending.redirectUri,
        codeVerifier: pending.codeVerifier
      });
    } finally {
      await SecureStore.deleteItemAsync(PENDING_LOGIN_KEY);
    }
  })();
  try {
    return await exchangePromise;
  } finally {
    exchangePromise = null;
  }
}

export async function startKakaoLogin(): Promise<OAuthLoginResult> {
  const redirectUri = Linking.createURL("oauth/kakao");
  const pkce = await createPkcePair();
  const prepared = await prepareKakaoLogin({ redirectUri, codeChallenge: pkce.challenge });
  await SecureStore.setItemAsync(
    PENDING_LOGIN_KEY,
    JSON.stringify({
      transactionId: prepared.transactionId,
      state: prepared.state,
      codeVerifier: pkce.verifier,
      redirectUri,
      createdAt: Date.now()
    } satisfies PendingKakaoLogin)
  );

  const result = await WebBrowser.openAuthSessionAsync(prepared.authorizationUrl, redirectUri);
  if (result.type !== "success") {
    await SecureStore.deleteItemAsync(PENDING_LOGIN_KEY);
    throw new Error("OAUTH_CANCELLED");
  }
  return await resumeKakaoLoginFromUrl(result.url);
}
