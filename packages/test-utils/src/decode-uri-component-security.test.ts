import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Resolve through the actual Expo Router -> query-string dependency chain.
const routerRequire = createRequire(new URL("../../../apps/mobile/node_modules/expo-router/package.json", import.meta.url));
const queryStringPath = routerRequire.resolve("query-string");
const queryRequire = createRequire(queryStringPath);
const decoderPath = queryRequire.resolve("decode-uri-component");
const decode = queryRequire("decode-uri-component") as (value: string) => string;

describe("deep-link decoder security backport", () => {
  it("preserves the callable CommonJS API and legacy plus handling", () => {
    expect(typeof decode).toBe("function");
    expect(decode("a+b%2Bc")).toBe("a b+c");
  });

  it.each([
    ["%EC%95%84%EC%9D%B4", "아이"],
    ["%F0%9F%98%80", "😀"],
    ["%C3%A5%80%C3%A5", "å%80å"],
    ["%E0%80%80", "%E0%80%80"],
    ["%C2%41", "\uFFFDA"],
    ["%FE%FF", "\uFFFD\uFFFD"],
    ["%84%D7%25%88%90", "%84%D7%%88%90"],
    ["%2525", "%25"]
  ])("decodes %s without recombining invalid bytes", (input, expected) => {
    expect(decode(input)).toBe(expected);
  });

  it("preserves query-string parsing through the installed consumer", () => {
    const queryString = routerRequire("query-string") as {
      parse(value: string): Record<string, unknown>;
    };
    expect(queryString.parse("name=%EC%95%84%EC%9D%B4&note=a+b%2Bc&invalid=%E0%80%80")).toEqual({
      name: "아이",
      note: "a b+c",
      invalid: "%E0%80%80"
    });
  });

  it("finishes a long malformed run without recursive CPU exhaustion", () => {
    // A subprocess timeout also bounds this test if an install loses the patch.
    // A normal test timeout cannot interrupt a synchronous decoder loop.
    const child = spawnSync(process.execPath, ["-e", [
      "const assert = require('node:assert/strict');",
      "const decode = require(process.argv[1]);",
      "const input = '%C0%AF'.repeat(10000);",
      "assert.equal(decode(input), input);"
    ].join("\n"), decoderPath], {
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true
    });
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
  });
});
