import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPkcePair, getRandomBytes, toBase64Url } from "./pkce";
import { sha256, utf8Bytes } from "./sha256";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function nodeSha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

describe("AUTH-102 pure-JS SHA-256 (pinned against node:crypto)", () => {
  it("matches the FIPS 180-4 reference vectors", () => {
    expect(toHex(sha256(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(toHex(sha256("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(toHex(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
  });

  it("matches node:crypto for multi-block (>64 byte) and empty-to-long range of inputs", () => {
    for (const length of [0, 1, 55, 56, 63, 64, 65, 127, 128, 1000]) {
      const input = Buffer.alloc(length, 0xa7);
      expect(toHex(sha256(new Uint8Array(input)))).toBe(nodeSha256Hex(input));
    }
  });

  it("UTF-8 encodes multibyte strings (Korean + surrogate pairs) the same way node does", () => {
    for (const text of ["카카오 로그인", "우리아이 \u{1F476} test", "über-ключ"]) {
      expect(Buffer.from(utf8Bytes(text))).toEqual(Buffer.from(text, "utf8"));
      expect(toHex(sha256(text))).toBe(nodeSha256Hex(Buffer.from(text, "utf8")));
    }
  });
});

describe("AUTH-102 PKCE helpers", () => {
  it("base64url-encodes without padding, matching node's base64url", () => {
    for (const length of [1, 2, 3, 31, 32, 33]) {
      const bytes = getRandomBytes(length);
      expect(toBase64Url(bytes)).toBe(Buffer.from(bytes).toString("base64url"));
    }
  });

  it("produces a 43-char base64url code_verifier (RFC 7636 minimum) that varies per call", () => {
    const first = createPkcePair();
    const second = createPkcePair();
    expect(first.codeVerifier).toHaveLength(43);
    expect(first.codeVerifier).toMatch(BASE64URL_PATTERN);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });

  it("derives the S256 challenge as base64url(sha256(verifier)), verified against node:crypto", () => {
    const pair = createPkcePair();
    const expected = createHash("sha256").update(pair.codeVerifier, "ascii").digest("base64url");
    expect(pair.codeChallenge).toBe(expected);
    expect(pair.codeChallenge).toHaveLength(43);
    expect(pair.codeChallengeMethod).toBe("S256");
  });

  it("code_challenge fits the API DTO's 128-char MaxLength", () => {
    expect(createPkcePair().codeChallenge.length).toBeLessThanOrEqual(128);
  });
});
