import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

describe("Batch 10 admin CMS shell", () => {
  // CLEAN-121(J1): 카드 라벨은 AdminShell 내비와 같은 한국어 문구를 쓴다(종전에는 전부 영문).
  it("exposes admin CMS sections for auth placeholder, item templates, product links, disclosures, and click summary", () => {
    const expectations = [
      ["app/page.tsx", "ADM-001"],
      ["app/page.tsx", "ADM-002"],
      ["app/page.tsx", "ADM-003"],
      ["app/page.tsx", "ADM-004"],
      ["app/page.tsx", "x-admin-token"],
      ["app/page.tsx", "준비템 관리"],
      ["app/page.tsx", "상품 링크 관리"],
      ["app/page.tsx", "제휴 고지 문구"],
      ["app/page.tsx", "클릭 통계"]
    ];

    for (const [relativePath, expectedText] of expectations) {
      const filePath = join(adminRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });

  // CLEAN-121(J1): 종전에는 Disclosures와 Click summary가 둘 다 ADM-004를 달고 있었다.
  // DNC-004가 잠근 표에서 ADM-004 = 고지/정책 문구 관리이므로 클릭 통계는 별도 ID를 쓴다.
  it("gives every dashboard card a distinct screen id", () => {
    const source = readFileSync(join(adminRoot, "app/page.tsx"), "utf8");
    const cardIds = [...source.matchAll(/^\s{4}id: "(ADM-\d{3})",$/gm)].map((match) => match[1]);
    expect(cardIds.length).toBeGreaterThanOrEqual(8);
    expect(new Set(cardIds).size).toBe(cardIds.length);
    expect(cardIds).toContain("ADM-009");
    expect(cardIds).toContain("ADM-113");
  });

  // CLEAN-121(J1): AdminShell(NAV_ITEMS)의 역할 필터 관례를 카드에도 적용 — admin 전용
  // API를 쓰는 화면(관리자 계정·감사 로그)은 analyst/editor 세션에서 카드도 숨긴다.
  it("hides admin-only cards from non-admin roles the way AdminShell hides the nav links", () => {
    const source = readFileSync(join(adminRoot, "app/page.tsx"), "utf8");
    expect(source).toContain('roles: ["admin"]');
    expect(source).toContain("section.roles.includes(session.admin.role)");
    // 관리자 계정·감사 로그 카드에만 roles 게이트가 붙어 있다.
    expect([...source.matchAll(/roles: \["admin"\]/g)]).toHaveLength(2);
  });
});
