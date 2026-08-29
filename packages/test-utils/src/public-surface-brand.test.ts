// 라운드 73 트랙 C (GAP-073 #3) — "앱 밖 공개 페이지의 브랜드가 앱과 다르다"를 잡는 계약.
//
// 트랙 B가 세운 값의 단일 소스(docs/brand/brand-tokens.json)를 **읽기만** 하고, 앱 밖 공개 표면
// 네 벌이 그 값과 일치하는지를 묻는다. B의 계약(store-brand-and-asset-provenance.test.ts)이
// "값 파일 ↔ theme.ts ↔ do-not-change.md" 세 자리의 일치를 이미 지므로, 여기서는 그 위에
// **표면 쪽**만 얹는다 — 같은 것을 두 번 묻지 않는다.
//
// 이 파일이 묻는 것은 넷이다.
//  ① 네 표면의 브랜드·배경 값이 단일 소스의 잠근 셋과 같은가.
//  ② 전수 스윕: 네 표면에 폐기 팔레트 리터럴이 **0건**인가(부정 단언).
//     ⚠️ 주석도 예외가 아니다. 폐기값의 이름을 적어도 되는 자리는 단일 소스의 `retired` 목록과
//     do-not-change.md의 개정 이력뿐이고(값 파일의 retiredSweepScope.exempt가 그것을 적는다),
//     표면 파일 안에 남은 옛 값은 주석이든 코드든 다음 사람이 되살릴 씨앗이다.
//  ③ site.css의 팔레트 주석이 v0.5 값과 개정 근거를 적는가(오늘의 거짓 인용 제거).
//  ④ 초대 랜딩 `.cta`의 흰 텍스트 대비가 AA(4.5:1)를 넘는가 — 값으로 고정.
//     여기서 대비는 **계산**한다. 숫자를 손으로 적어 두면 색이 바뀔 때 그 숫자만 남는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

function read(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const BRAND_TOKENS_PATH = "docs/brand/brand-tokens.json";

const SITE_CSS_PATH = "infra/site/site.css";
const LEGAL_PATHS = [
  "infra/legal/terms-of-service.html",
  "infra/legal/privacy-policy.html",
  "infra/legal/account-deletion.html"
] as const;
const REDIRECT_CONTROLLER_PATH = "apps/api/src/items-commerce/redirect.controller.ts";
const INVITE_LANDING_CONTROLLER_PATH = "apps/api/src/households/invite-landing.controller.ts";

/** 앱 밖 공개 표면 네 벌 — 앱을 깔기 전/없이 우리를 만나는 사람이 보는 전부. */
const PUBLIC_SURFACES = [
  SITE_CSS_PATH,
  ...LEGAL_PATHS,
  REDIRECT_CONTROLLER_PATH,
  INVITE_LANDING_CONTROLLER_PATH
] as const;

type BrandTokens = {
  version: string;
  locked: Record<string, string>;
  derived: Record<string, string>;
  retired: { value: string; role: string; replacedBy: string; note: string }[];
  retiredSweepScope: { include: string[]; exempt: string[] };
};

function brandTokens(): BrandTokens {
  return JSON.parse(read(BRAND_TOKENS_PATH)) as BrandTokens;
}

// ── WCAG 상대 휘도·대비 ────────────────────────────────────────────────────────
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  expect(match, `${hex}는 #RRGGBB 형식이어야 해요`).not.toBeNull();
  const value = match![1];
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** `<style>` 안의 `<selector> { … }` 한 블록 본문. */
function ruleBody(source: string, selector: string, where: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  expect(match, `${where}에 ${selector} 규칙이 있어야 해요`).not.toBeNull();
  return match![1];
}

/** 규칙 본문 안의 `<property>: #RRGGBB`. */
function declaredHex(body: string, property: string, where: string): string {
  const match = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*(#[0-9A-Fa-f]{6})`).exec(body);
  expect(match, `${where}의 ${property} 값이 #RRGGBB로 적혀 있어야 해요`).not.toBeNull();
  return match![1].toUpperCase();
}

describe("앱 밖 공개 표면이 브랜드 값의 단일 소스를 따른다 (DNC-017 v0.5)", () => {
  it("표면 목록이 단일 소스가 적어 둔 스윕 대상 안에 있다 (파생 단언)", () => {
    // 트랙 C가 표면 목록을 스스로 정하면 그것이 또 하나의 단일 소스가 된다. 값 파일이 적은
    // retiredSweepScope.include가 대상 목록의 주인이고, 여기서는 그 목록을 **읽어** 대조한다.
    const { include } = brandTokens().retiredSweepScope;
    expect(include).toContain(SITE_CSS_PATH);
    expect(include).toContain("infra/legal/*.html");
    expect(include).toContain(REDIRECT_CONTROLLER_PATH);
    expect(include).toContain(INVITE_LANDING_CONTROLLER_PATH);
    // 스윕 대상 중 이 트랙이 지지 않는 자리(스토어 생성기)는 트랙 B의 계약이 진다.
    expect(include).toContain("scripts/store/frame_screenshots.py");
  });

  it("site.css의 --brand/--bg가 잠근 셋과 같고, --brand-deep이 파생 값에서 온다", () => {
    const tokens = brandTokens();
    const css = read(SITE_CSS_PATH);
    const root = ruleBody(css, ":root", SITE_CSS_PATH);

    expect(declaredHex(root, "--brand", SITE_CSS_PATH)).toBe(tokens.locked.primary.toUpperCase());
    expect(declaredHex(root, "--bg", SITE_CSS_PATH)).toBe(tokens.locked.background.toUpperCase());
    // 링크·강조 텍스트도 지어낸 코랄이 아니라 단일 소스의 파생 값이어야 한다 — 그러지 않으면
    // 이 파일이 다시 자기 팔레트를 갖는다.
    expect(declaredHex(root, "--brand-deep", SITE_CSS_PATH)).toBe(tokens.derived.primaryDark.toUpperCase());
  });

  it("site.css의 팔레트 주석이 v0.5 값과 개정 근거를 적는다 (거짓 인용 제거)", () => {
    const tokens = brandTokens();
    const header = read(SITE_CSS_PATH).slice(0, read(SITE_CSS_PATH).indexOf(":root"));

    expect(header).toContain(tokens.locked.primary);
    expect(header).toContain(tokens.locked.background);
    // 종전 주석은 값과 함께 "DNC-017"만 인용했고, 그 인용이 거짓이 된 이유가 v0.5 개정이다.
    // 그래서 판(version)까지 적어야 같은 거짓이 되풀이되지 않는다.
    expect(header).toContain(tokens.version);
    // 값의 주인이 어디인지도 적는다 — 다음 사람이 이 주석을 고치는 대신 단일 소스로 가게.
    expect(header).toContain(BRAND_TOKENS_PATH);
  });

  it("법적 문서 셋의 배경·강조 값이 잠근 셋과 같다 (본문·placeholder는 대상이 아니다)", () => {
    const tokens = brandTokens();
    for (const path of LEGAL_PATHS) {
      const source = read(path);
      const styleBlock = source.slice(source.indexOf("<style>"), source.indexOf("</style>"));
      expect(styleBlock.length, `${path}에 <style> 블록이 있어야 해요`).toBeGreaterThan(0);

      expect(declaredHex(ruleBody(styleBlock, "body", path), "background", path)).toBe(
        tokens.locked.background.toUpperCase()
      );
      // h1 밑줄이 이 문서들의 유일한 브랜드 강조다.
      expect(ruleBody(styleBlock, "h1", path).toUpperCase()).toContain(tokens.locked.primary.toUpperCase());

      // 법률 검토 대상인 본문은 이 트랙의 손이 닿지 않는 자리다 — placeholder가 그대로인지로
      // 그 사실을 붙잡아 둔다(색을 고치다 본문을 건드리면 여기서 빨개진다).
      expect(source, `${path}의 [대괄호] placeholder`).toContain("[");
    }
  });

  it("API 공개 HTML 둘의 배경·브랜드 값이 잠근 셋과 같다", () => {
    const tokens = brandTokens();
    for (const path of [REDIRECT_CONTROLLER_PATH, INVITE_LANDING_CONTROLLER_PATH]) {
      const source = read(path);
      const styleBlock = source.slice(source.indexOf("<style>"), source.indexOf("</style>"));
      expect(styleBlock.length, `${path}에 <style> 블록이 있어야 해요`).toBeGreaterThan(0);

      expect(declaredHex(ruleBody(styleBlock, "body", path), "background", path)).toBe(
        tokens.locked.background.toUpperCase()
      );
      expect(declaredHex(ruleBody(styleBlock, ".brand", path), "color", path)).toBe(
        tokens.locked.primary.toUpperCase()
      );
    }
  });

  it("네 표면에 폐기 팔레트 리터럴이 0건이다 (부정 단언 · 주석도 예외 아님)", () => {
    const tokens = brandTokens();
    for (const path of PUBLIC_SURFACES) {
      const source = read(path).toUpperCase();
      for (const entry of tokens.retired) {
        expect(
          source,
          `${path}에 폐기값 ${entry.value}(${entry.role})가 남아 있어요 — ${entry.replacedBy}로 가야 해요`
        ).not.toContain(entry.value.toUpperCase());
      }
    }
  });
});

describe("초대 랜딩 CTA의 대비 (라운드 53이 앱에서 겪은 항목을 반복하지 않는다)", () => {
  it(".cta가 잠근 Primary 위의 onPrimary 흰 텍스트이고, 그 대비가 AA를 넘는다", () => {
    const tokens = brandTokens();
    const source = read(INVITE_LANDING_CONTROLLER_PATH);
    const styleBlock = source.slice(source.indexOf("<style>"), source.indexOf("</style>"));
    const cta = ruleBody(styleBlock, ".cta", INVITE_LANDING_CONTROLLER_PATH);

    const background = declaredHex(cta, "background", ".cta");
    const foreground = declaredHex(cta, "color", ".cta");
    expect(background).toBe(tokens.locked.primary.toUpperCase());
    expect(foreground).toBe(tokens.derived.onPrimary.toUpperCase());

    // 숫자는 손으로 적지 않고 잰다 — 색이 바뀌면 이 단언이 먼저 답한다.
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("페이지 배경 위의 브랜드 텍스트도 AA를 넘는다 (두 공개 페이지 공통)", () => {
    const tokens = brandTokens();
    expect(contrastRatio(tokens.locked.primary, tokens.locked.background)).toBeGreaterThanOrEqual(4.5);
    // 지원 사이트의 링크·강조 텍스트도 같은 배경 위에 선다.
    expect(contrastRatio(tokens.derived.primaryDark, tokens.locked.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("지원 사이트의 기본 버튼이 브랜드 배경 위에서 AA를 넘는다", () => {
    const tokens = brandTokens();
    const css = read(SITE_CSS_PATH);
    const button = ruleBody(css, ".btn-primary", SITE_CSS_PATH);

    // 배경은 var(--brand)이므로 잠근 Primary가 실제 값이다.
    expect(button).toContain("var(--brand)");
    const foreground = declaredHex(button, "color", ".btn-primary");
    expect(contrastRatio(foreground, tokens.locked.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("색만 바뀌었다 — 공개 페이지 둘의 응답 계약은 그대로다", () => {
  it("리다이렉트 실패 페이지가 404·헤더 셋·링크 0건·보간 0건을 유지한다", () => {
    const source = read(REDIRECT_CONTROLLER_PATH);

    expect(source).toContain("response.status(404)");
    expect(source).toContain('response.setHeader("Cache-Control", "no-store")');
    expect(source).toContain('response.setHeader("X-Frame-Options", "DENY")');
    // ⚠️ 라운드 69 리뷰 P-3: 이 마지막 줄을 `return`으로 바꾸면 이중 전송이 된다.
    expect(source).toContain("response.send(renderLinkUnavailablePage());");
    expect(source).not.toContain("return response.send(");

    // 페이지 자체: 링크도 보간값도 없다(DNC-010/011이 딸려 오지 않는 이유).
    const page = source.slice(source.indexOf("function renderLinkUnavailablePage"));
    expect(page).not.toContain("<a ");
    expect(page).not.toContain("href=");
    expect(page).not.toMatch(/\$\{/);
  });

  it("초대 랜딩이 200·오라클 없음·헤더 셋을 유지한다", () => {
    const source = read(INVITE_LANDING_CONTROLLER_PATH);

    expect(source).toContain('@Header("Content-Type", "text/html; charset=utf-8")');
    expect(source).toContain('@Header("Cache-Control", "no-store")');
    expect(source).toContain('@Header("X-Frame-Options", "DENY")');
    // 실패 갈래가 같은 200 페이지로 모인다 — 상태 코드로 토큰의 존재를 말하지 않는다.
    expect(source).toContain("return renderUnavailableInvitePage();");
    expect(source).not.toMatch(/NotFoundException|status\(404\)/);
  });

  it("두 페이지가 셸을 공유 모듈로 뽑지 않는다 (의도된 중복)", () => {
    // redirect.controller.ts가 그러지 않기로 한 근거를 파일 안에 적어 뒀다. 각자 자기 셸을
    // 가지는 것이 계약이므로, 한쪽이 다른 쪽을 import하면 그것이 회귀다. 서로를 **주석으로**
    // 가리키는 것은 오히려 그 판단의 근거라서 여기서 묻는 것은 import뿐이다.
    const imports = (source: string) =>
      source.split("\n").filter((line) => /^\s*import\b|\bfrom\s+"|require\(/.test(line)).join("\n");
    expect(imports(read(REDIRECT_CONTROLLER_PATH))).not.toContain("invite-landing");
    expect(imports(read(INVITE_LANDING_CONTROLLER_PATH))).not.toContain("redirect.controller");
    // 셸 렌더러는 여전히 각 파일 안의 지역 함수다(공유 모듈로 나가지 않았다).
    expect(read(REDIRECT_CONTROLLER_PATH)).toContain("function renderLinkUnavailablePage(): string {");
    expect(read(INVITE_LANDING_CONTROLLER_PATH)).toContain("function pageShell(bodyHtml: string): string {");
  });
});
