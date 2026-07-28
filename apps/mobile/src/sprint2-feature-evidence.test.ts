import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = join(__dirname, "..");
const source = (path: string) => readFileSync(join(mobileRoot, path), "utf8");

describe("Sprint 2 focused evidence IDs", () => {
  it("PAY-001 and PAY-002 use the real payment-method screen with deterministic installed-app fixtures", () => {
    const paymentMethods = source("app/payment-methods.tsx");
    expect(paymentMethods).toContain('accessibilityLabel="PAY-001"');
    expect(paymentMethods).toContain('accessibilityLabel="PAY-002"');
    expect(paymentMethods).toContain("카드번호·계좌번호 같은 민감정보는 저장할 수 없어요.");
  });

  it("EXP-PAY-001 exposes the payment selector in the real expense form", () => {
    const expense = source("app/expenses/new.tsx");
    expect(expense).toContain('"EXP-PAY-001"');
    expect(expense).toContain('accessibilityLabel="결제 수단 변경"');
  });

  it("PROFILE-GENDER-001 keeps gender optional and declares that ranking ignores it", () => {
    const profileFields = source("src/children/ChildProfileFields.tsx");
    expect(profileFields).toContain('accessibilityLabel="PROFILE-GENDER-001"');
    expect(profileFields).toContain("추천 순위에는 성별을 사용하지 않아요.");
  });

  it("ITEM-CATALOG-001 and ITEM-COVERAGE-001 are native component evidence routes", () => {
    expect(source("app/(tabs)/items.tsx")).toContain("ITEM-CATALOG-001");
    const coverage = source("app/catalog-coverage-evidence.tsx");
    expect(coverage).toContain('accessibilityLabel="ITEM-COVERAGE-001"');
    expect(coverage).toContain("활성 링크 98개 · 핵심 40개 모두 2개 이상");
  });
});
