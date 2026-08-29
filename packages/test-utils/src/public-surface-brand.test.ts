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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
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

type SweepScope = {
  commentRule: { default: string; exceptions: Record<string, string> };
  include: string[];
  includeOwners: Record<string, string[]>;
  exempt: { paths: string[]; reason: string }[];
};

type BrandTokens = {
  version: string;
  locked: Record<string, string>;
  derived: Record<string, string>;
  retired: { value: string; role: string; replacedBy: string; note: string }[];
  retiredSweepScope: SweepScope;
};

function brandTokens(): BrandTokens {
  return JSON.parse(read(BRAND_TOKENS_PATH)) as BrandTokens;
}

/** 이 파일이 여는 계약 파일 경로(값 파일의 includeOwners 키와 같아야 한다). */
const THIS_CONTRACT_PATH = "packages/test-utils/src/public-surface-brand.test.ts";
/** 스토어 생성기를 여는 쪽(트랙 B의 계약). */
const GENERATOR_CONTRACT_PATH = "packages/test-utils/src/store-brand-and-asset-provenance.test.ts";

/**
 * 값 파일이 적은 include 항목 하나를 **실제 파일 경로들**로 편다.
 *
 * `infra/legal/*.html`처럼 한 항목이 여러 파일을 가리키므로, 목록을 "읽었다"고 말하려면
 * 여기서 실제로 펴서 열어야 한다 — 그러지 않으면 include는 장식이 된다.
 */
function expandScopeEntry(entry: string): string[] {
  if (!entry.includes("*")) return [entry];
  const dir = posix.dirname(entry);
  const pattern = posix.basename(entry);
  const suffix = pattern.startsWith("*") ? pattern.slice(1) : "";
  expect(suffix.length, `${entry}: '<디렉터리>/*.<확장자>' 형태만 폅니다`).toBeGreaterThan(0);
  const files = readdirSync(join(repoRoot, dir))
    .filter((name) => name.endsWith(suffix))
    .map((name) => posix.join(dir, name))
    .sort();
  expect(files.length, `${entry}에 해당하는 파일이 없어요`).toBeGreaterThan(0);
  return files;
}

/** 이 계약이 여는 스윕 대상 — **목록의 주인은 값 파일**이고, 여기서는 그것을 펴서 쓴다. */
function sweptPathsFromScope(): string[] {
  const scope = brandTokens().retiredSweepScope;
  const owned = scope.includeOwners[THIS_CONTRACT_PATH];
  expect(owned, `값 파일의 includeOwners에 ${THIS_CONTRACT_PATH}가 있어야 해요`).toBeTruthy();
  return owned.flatMap(expandScopeEntry);
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
  /**
   * 라운드 73 후속(적대적 리뷰 ④) — **include가 스윕 목록의 주인이다.**
   *
   * 종전 이 자리는 값 파일의 include가 네 경로를 "담고 있는지"만 물었다. 그래서 include는
   * 실제로 아무것도 정하지 않았다 — 스윕이 도는 목록은 이 파일 위쪽의 `PUBLIC_SURFACES`
   * 상수였고, 둘이 갈려도(예: include에서 한 줄이 빠져도) 아무 단언도 빨개지지 않았다.
   * 이제 스윕은 **값 파일의 include를 펴서** 돌고, 이 상수는 그 결과와의 **역방향 대조**로만
   * 남는다(사람이 읽을 이름이 사라지지 않게).
   */
  it("스윕 대상이 값 파일의 include에서 나오고, 두 계약이 include 전수를 나눠 진다 (파생 단언 · 역방향)", () => {
    const scope = brandTokens().retiredSweepScope;

    // ① 이 계약이 여는 목록 = 값 파일이 이 계약에 맡긴 항목들. 위 상수와 **같은 집합**이어야 한다
    //    (순서는 값 파일의 나열 순서와 glob 정렬이라 뜻이 없다 — 무엇이 들었는가만 계약이다).
    expect(sweptPathsFromScope().sort()).toEqual([...PUBLIC_SURFACES].sort());

    // ② 역방향: 두 계약이 맡은 것을 합치면 include 전수다(주인 없는 항목도, 없는 항목의 주인도 없다).
    const owners = Object.keys(scope.includeOwners);
    expect(owners.sort()).toEqual([GENERATOR_CONTRACT_PATH, THIS_CONTRACT_PATH].sort());
    const claimed = owners.flatMap((owner) => scope.includeOwners[owner]);
    expect([...claimed].sort()).toEqual([...scope.include].sort());

    // ③ 목록의 항목은 전부 **실제로 여는** 파일이다(장식이 아니다).
    for (const path of scope.include.flatMap(expandScopeEntry)) {
      expect(existsSync(join(repoRoot, path)), `include의 ${path}가 저장소에 없어요`).toBe(true);
    }
  });

  it("exempt가 실제로 스윕 대상 밖이고, 이유와 함께 값으로 서 있다 (파생 단언)", () => {
    const scope = brandTokens().retiredSweepScope;
    const swept = scope.include.flatMap(expandScopeEntry);
    expect(scope.exempt.length).toBeGreaterThan(0);

    for (const entry of scope.exempt) {
      expect(entry.reason.trim().length, `${entry.paths.join(" · ")}의 면제 이유`).toBeGreaterThan(20);
      expect(entry.paths.length, "면제 항목에 경로가 있어야 해요").toBeGreaterThan(0);
      for (const exemptPath of entry.paths) {
        // 면제와 스윕이 겹치면 둘 중 하나가 거짓이다 — 겹침 0건을 파생으로 확인한다.
        for (const sweptPath of swept) {
          expect(
            sweptPath.startsWith(exemptPath),
            `${sweptPath}는 스윕 대상인데 ${exemptPath}로 면제돼 있어요`
          ).toBe(false);
        }
        // 디렉터리 면제는 그 디렉터리가 실제로 있고, 파일 면제는 **그 면제가 필요한 이유**
        // (폐기값이 실제로 그 안에 적혀 있음)까지 확인한다.
        const isDirectory = exemptPath.endsWith("/");
        expect(existsSync(join(repoRoot, exemptPath)), `면제 경로 ${exemptPath}가 없어요`).toBe(true);
        if (isDirectory) continue;
        const source = read(exemptPath).toUpperCase();
        const retiredHere = brandTokens().retired.filter((retired) =>
          source.includes(retired.value.toUpperCase())
        );
        expect(
          retiredHere.length,
          `${exemptPath}에는 폐기값이 하나도 없어요 — 면제할 것이 없는 면제입니다`
        ).toBeGreaterThan(0);
      }
    }
  });

  it("주석 취급 규칙이 값이고, 이 계약의 네 표면은 기본 규칙(주석도 대상)이다", () => {
    const { commentRule } = brandTokens().retiredSweepScope;
    expect(commentRule.default).toContain("주석도 대상이다");
    // 예외는 파이썬 생성기 하나뿐이고, 그 파일은 트랙 B가 연다(아래 스윕의 대상이 아니다).
    expect(Object.keys(commentRule.exceptions)).toEqual(["scripts/store/frame_screenshots.py"]);
    for (const path of PUBLIC_SURFACES) {
      expect(
        Object.keys(commentRule.exceptions),
        `${path}는 기본 규칙(주석 포함)으로 스윕돼야 해요`
      ).not.toContain(path);
    }
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
    // 도는 목록의 주인은 값 파일이다 — 여기서 다시 적지 않고 include를 펴서 **실제로 연다**.
    for (const path of sweptPathsFromScope()) {
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
