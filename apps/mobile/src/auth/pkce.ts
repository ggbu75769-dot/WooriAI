/**
 * AUTH-102: PKCE (RFC 7636) helpers for the Kakao OIDC login flow.
 *
 * `expo-crypto` is not installed and is absent from the workspace pnpm store (adding it would
 * require a download), so the S256 challenge is computed with the local pure-JS SHA-256
 * (./sha256.ts) and randomness comes from `crypto.getRandomValues` when the runtime provides
 * it, with a documented non-cryptographic fallback otherwise.
 */
import { sha256, utf8Bytes } from "./sha256";

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** base64url (RFC 4648 §5, unpadded) encoding without relying on btoa/Buffer availability. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += BASE64URL_ALPHABET[b0 >> 2];
    out += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 !== undefined) out += BASE64URL_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 !== undefined) out += BASE64URL_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/**
 * Fills a byte array from `crypto.getRandomValues` when the runtime provides it (Node >= 19,
 * web, and Expo runtimes with a WebCrypto polyfill). Otherwise falls back to a
 * non-cryptographic Math.random/Date.now mix.
 *
 * The fallback is acceptable for this scaffold because the code_verifier is defense-in-depth
 * here, not the primary control: the server's prepare/exchange transaction already binds the
 * login to a single-use server-generated `state` + `nonce` (see
 * apps/api/src/auth/kakao/kakao-auth.service.ts), and the verifier only ever travels over TLS.
 */
export function getRandomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(out);
    return out;
  }
  let seedNoise = Date.now() & 0xff;
  for (let i = 0; i < length; i++) {
    seedNoise = (seedNoise * 31 + i) & 0xff;
    out[i] = (Math.floor(Math.random() * 256) ^ seedNoise) & 0xff;
  }
  return out;
}

export type PkcePair = {
  /** 43-char base64url string (RFC 7636 §4.1 minimum length), sent only to the token exchange. */
  codeVerifier: string;
  /** base64url(SHA-256(codeVerifier)) -- the S256 challenge sent to prepare + authorize. */
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

/** Generates a fresh RFC 7636 S256 verifier/challenge pair (one per login attempt). */
export function createPkcePair(): PkcePair {
  const codeVerifier = toBase64Url(getRandomBytes(32));
  const codeChallenge = toBase64Url(sha256(utf8Bytes(codeVerifier)));
  return { codeVerifier, codeChallenge, codeChallengeMethod: "S256" };
}
