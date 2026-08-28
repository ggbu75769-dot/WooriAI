import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_READ_DISCLOSURE_KEYS, disclosureKeyBadge, isAppReadDisclosureKey } from "./disclosure-keys";

describe("APP_READ_DISCLOSURE_KEYS (GAP-065 #9)", () => {
  it("holds exactly the two keys the app falls back to", () => {
    expect([...APP_READ_DISCLOSURE_KEYS]).toEqual(["affiliate_purchase", "sponsored_product"]);
  });

  /**
   * 사본이 갈리는 것을 막는 대조: 서버의 `defaultDisclosureFor`가 고르는 키가
   * 이 목록과 같아야 한다. 서버가 그 목록을 API로 내보내지 않아 소스를 읽어 맞춘다
   * (link-share.test.ts가 서버 규칙 모듈을 직접 불러 대조하는 것과 같은 계열).
   */
  it("matches the server fallback in items-catalog.service.ts", () => {
    const source = readFileSync(
      join(process.cwd(), "..", "..", "apps", "api", "src", "onboarding", "items-catalog.service.ts"),
      "utf8"
    );
    const start = source.indexOf("private defaultDisclosureFor");
    expect(start, "defaultDisclosureFor를 찾지 못했다 — 서버 폴백이 옮겨졌다").toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\n  }", start));
    // 서버가 키를 하나 더 읽기 시작하면 개수가 달라진다 — 그때 이 모듈도 함께 늘어야 한다.
    const reads = (body.match(/disclosures\.get\("([a-z_]+)"\)/g) ?? []).map((match) =>
      match.slice('disclosures.get("'.length, -2)
    );
    expect(reads.sort()).toEqual([...APP_READ_DISCLOSURE_KEYS].sort());
  });
});

describe("disclosureKeyBadge (GAP-065 #9)", () => {
  it("marks the app-read keys, whitespace and all", () => {
    for (const key of APP_READ_DISCLOSURE_KEYS) {
      expect(isAppReadDisclosureKey(key)).toBe(true);
      expect(isAppReadDisclosureKey(`  ${key}  `)).toBe(true);
      const badge = disclosureKeyBadge(key);
      expect(badge.appRead).toBe(true);
      expect(badge.label).toBe("앱이 이 키를 읽어요");
      expect(badge.hint.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * 오타 키(`affiliate_purchse`)가 이 경로의 사각이다 — 저장은 성공하는데 앱이 읽는 값은
   * 그대로다. 저장을 막지 않고, 읽히지 않는다는 사실만 배지로 적는다.
   */
  it("marks an unread key without blocking it, and does not accuse it of being a typo", () => {
    const badge = disclosureKeyBadge("affiliate_purchse");
    expect(badge.appRead).toBe(false);
    expect(badge.label).toBe("앱이 아직 읽지 않는 키예요");
    expect(badge.hint).toContain("앱 화면은 그대로");
    expect(badge.label).not.toContain("오타");
  });

  it("treats a seeded-but-unread key the same as any other unread key", () => {
    // nutrition_supplement는 시드에 있지만 아직 어느 화면도 읽지 않는다.
    expect(disclosureKeyBadge("nutrition_supplement").appRead).toBe(false);
    expect(disclosureKeyBadge("")).toEqual(disclosureKeyBadge("nutrition_supplement"));
  });
});
