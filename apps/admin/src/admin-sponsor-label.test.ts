import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * 라운드 107 D2 — **DNC-011의 스폰서 표시를 운영자가 켤 수 있어야 한다.**
 *
 * 종전에는 링크 폼에 "스폰서 상품" 체크박스만 있고 `sponsor_label`을 적을 칸이 없었다.
 * 서버가 그 컬럼을 쓰지 않았으므로 그 체크박스를 켜고 저장하면 CHECK 위반 500이었고,
 * 스폰서 링크는 psql이나 시드로만 만들 수 있었다 — 즉 화면에 있는 토글이 **아무 링크도
 * 만들지 못하는** 상태였다. 이 파일은 그 자리가 다시 죽지 않게 값으로 못 박는다.
 *
 * 서버 쪽 계약(400 코드·저장·앱 노출)은 apps/api의 e2e 둘이 진다
 * (`test/admin-catalog-guards.e2e.test.ts` · `test/items-commerce.e2e.test.ts`).
 * 여기서 묻는 것은 **어드민 화면이 그 계약을 실제로 부르는가**뿐이다(라운드 64 #4·#8이
 * "순수 모듈은 다 있는데 화면이 부르지 않는" 상태를 막으려고 세운 그 질문과 같다).
 */
describe("스폰서 표시 문구 칸 (라운드 107 D2 · DNC-011)", () => {
  it("링크 폼이 스폰서 표시 문구를 상태로 들고 입력 칸을 그린다", () => {
    const page = readSource("app/links/page.tsx");

    expect(page).toContain("sponsorLabel: string;");
    expect(page).toContain("id={`${idPrefix}-sponsor-label`}");
    expect(page).toContain("value={form.sponsorLabel}");
    // 컬럼 상한(varchar(80))과 같은 값 — 서버 DTO의 @MaxLength(80)과 한 뜻이다.
    expect(page).toContain("maxLength={80}");
  });

  it("스폰서를 켠 채 문구가 비면 저장 전에 막고, 서버와 같은 뜻을 말한다", () => {
    const page = readSource("app/links/page.tsx");

    expect(page).toContain("if (form.isSponsored && !form.sponsorLabel.trim())");
    // DNC-018: 다음에 무엇을 하면 되는지 말한다(서버 400의 문구와 같은 문장).
    expect(page).toContain("스폰서 표시 문구를 적어 주세요.");
  });

  it("스폰서를 켠 요청에만 문구를 싣는다", () => {
    const page = readSource("app/links/page.tsx");

    expect(page).toContain("if (form.isSponsored) input.sponsorLabel = form.sponsorLabel.trim();");
  });

  it("수정 폼이 저장된 문구를 프리필하고, 표가 그 문구를 되읽어 준다", () => {
    const page = readSource("app/links/page.tsx");
    const api = readSource("src/lib/admin-api.ts");

    // 프리필이 없으면 수정 폼을 여는 것만으로 저장 시 문구가 지워진다.
    expect(page).toContain('sponsorLabel: link.sponsorLabel ?? ""');
    expect(page).toContain("link.isSponsored ? `예 (${link.sponsorLabel ?? \"문구 없음\"})` : \"아니오\"");
    // 타입에도 실려 있어야 위 두 줄이 컴파일된다(서버 GET /admin/product-links가 내려주는 값).
    expect(api).toContain("sponsorLabel?: string | null;");
    expect(api).toContain("sponsorLabel?: string;");
  });
});
