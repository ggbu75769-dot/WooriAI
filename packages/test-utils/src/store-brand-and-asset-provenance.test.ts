// 라운드 73 트랙 B (GAP-073 #2) — "스토어에 올릴 자산이 지금의 앱이 아니다"를 잡는 계약.
//
// 이 파일이 묻는 것은 셋이다.
//  ① 브랜드 값이 한 자리에서만 나오는가 — docs/brand/brand-tokens.json ↔ apps/mobile/src/theme.ts ↔
//    docs/dev/do-not-change.md(DNC-017 v0.5) 세 자리가 글자 단위로 같은가(파생 단언).
//  ② 스토어 자산 생성기가 그 단일 소스를 읽는가 — 색 상수를 스스로 정하지 않는가(부정 단언).
//  ③ 각 스크린샷 캡처가 어느 빌드에서 나왔는지를 매니페스트가 지는가.
//    ⚠️ 여기서 묻는 것은 "출처 칸이 있고, 계보가 **선언**돼 있는가"이지 "그 계보가 승인 이후인가"가
//    아니다. 오늘 셋 다 DSN-053 이전 캡처이고 그것은 사실이다 — 사실을 적었다는 이유로 메인 테스트
//    배터리를 빨갛게 두면 이 계약은 곧 지워진다. 대신 "구세대라고 선언했다면 제출 차단 문구가
//    문서에 서 있어야 한다"를 파생으로 묻는다. 미선언·거짓 선언만 빨간불이다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

function read(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const BRAND_TOKENS_PATH = "docs/brand/brand-tokens.json";
const MANIFEST_PATH = "docs/store/assets/screenshot-manifest.json";
const GENERATOR_PATH = "scripts/store/frame_screenshots.py";
const PLAY_LISTING_PATH = "docs/store/play-listing.md";
const SUBMISSION_CHECKLIST_PATH = "docs/store/submission-checklist.md";
const CONTRACT_PATH = "docs/dev/do-not-change.md";
const THEME_PATH = "apps/mobile/src/theme.ts";

const LINEAGE_APPROVED = "DSN-053+";
const LINEAGE_PRE_APPROVAL = "pre-DSN-053";

type BrandTokens = {
  version: string;
  locked: Record<string, string>;
  derived: Record<string, string>;
  retired: { value: string; role: string; replacedBy: string; note: string }[];
  sources: { contract: string; runtime: string };
};

function brandTokens(): BrandTokens {
  return JSON.parse(read(BRAND_TOKENS_PATH)) as BrandTokens;
}

type CaptureProvenance = {
  lineage?: string;
  build?: string;
  commit?: string;
  capturedAt?: string;
  note?: string;
};

type ManifestEntry = {
  name?: string;
  src?: string;
  caption?: string;
  capturedFrom?: CaptureProvenance;
};

function manifest(): ManifestEntry[] {
  return JSON.parse(read(MANIFEST_PATH)) as ManifestEntry[];
}

/** theme.ts의 `const <name> = { ... } as const;` 블록 본문. */
function themeBlock(source: string, name: string): string {
  const match = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\} as const;`).exec(source);
  expect(match, `${THEME_PATH}에 const ${name} 블록이 있어야 해요`).not.toBeNull();
  return match![1];
}

/** 블록 안의 `<key>: "#RRGGBB"` 값. */
function hexEntry(block: string, key: string, where: string): string {
  const match = new RegExp(`(?:^|\\n)\\s*${key}:\\s*"(#[0-9A-Fa-f]{6})"`).exec(block);
  expect(match, `${where}에 ${key} 값이 있어야 해요`).not.toBeNull();
  return match![1];
}

describe("브랜드 값 단일 소스 (DNC-017 v0.5)", () => {
  it("값 파일이 잠근 셋과 파생 값을 apps/mobile/src/theme.ts에서 그대로 옮겨 적는다", () => {
    expect(existsSync(join(repoRoot, BRAND_TOKENS_PATH))).toBe(true);
    const tokens = brandTokens();
    const theme = read(THEME_PATH);

    // 값 파일이 스스로 어디서 왔는지를 적는다 — 출처가 없는 값 파일은 네 번째 팔레트가 된다.
    expect(tokens.version).toBe("DNC-017 v0.5");
    expect(tokens.sources.contract).toBe(CONTRACT_PATH);
    expect(tokens.sources.runtime).toBe(THEME_PATH);

    const coral = themeBlock(theme, "coral");
    const cream = themeBlock(theme, "cream");
    const text = themeBlock(theme, "text");

    // ① 잠근 셋: DNC-017이 이름으로 잠근 값.
    expect(tokens.locked.primary).toBe(hexEntry(coral, "600", "theme.ts coral"));
    expect(tokens.locked.background).toBe(hexEntry(cream, "bg", "theme.ts cream"));
    const secondaryMatch = /secondary500:\s*"(#[0-9A-Fa-f]{6})"/.exec(theme);
    expect(secondaryMatch, "theme.ts에 secondary500 값이 있어야 해요").not.toBeNull();
    expect(tokens.locked.secondary).toBe(secondaryMatch![1]);

    // ② 파생 값: 지어내지 않는다 — 전부 theme.ts에 실제로 있는 값이어야 한다.
    expect(tokens.derived.primaryDark).toBe(hexEntry(coral, "700", "theme.ts coral"));
    expect(tokens.derived.primaryLight).toBe(hexEntry(coral, "100", "theme.ts coral"));
    expect(tokens.derived.surface).toBe(hexEntry(cream, "surface", "theme.ts cream"));
    expect(tokens.derived.surfaceAlt).toBe(hexEntry(cream, "surfaceAlt", "theme.ts cream"));
    expect(tokens.derived.textPrimary).toBe(hexEntry(text, "primary", "theme.ts text"));
    expect(tokens.derived.textSecondary).toBe(hexEntry(text, "secondary", "theme.ts text"));
    expect(tokens.derived.onPrimary).toBe(hexEntry(cream, "surface", "theme.ts cream"));
  });

  it("값 파일이 잠근 셋이 do-not-change.md의 DNC-017 행과 글자 단위로 같다", () => {
    const tokens = brandTokens();
    const contract = read(CONTRACT_PATH);
    const dncRow = contract.split("\n").find((line) => line.startsWith("| DNC-017 "));
    expect(dncRow, "do-not-change.md에 DNC-017 행이 있어야 해요").toBeDefined();

    // 행이 이름과 값을 함께 적고 있는지(값만 스치는 것이 아니라 역할과 함께)를 본다.
    expect(dncRow).toContain(`Primary \`${tokens.locked.primary}\``);
    expect(dncRow).toContain(`Secondary \`${tokens.locked.secondary}\``);
    expect(dncRow).toContain(`Background \`${tokens.locked.background}\``);
    expect(dncRow).toContain("v0.5");

    // 개정 이력의 v0.5 행이 걷어낸 이전 값 셋 — 값 파일의 retired 목록이 그것을 그대로 진다.
    const v05Row = contract.split("\n").find((line) => line.startsWith("| v0.5 "));
    expect(v05Row, "do-not-change.md 개정 이력에 v0.5 행이 있어야 해요").toBeDefined();
    const retiredValues = tokens.retired.map((entry) => entry.value);
    for (const previous of ["#FF8A7A", "#7DDCC7", "#FFF8F1"]) {
      expect(v05Row).toContain(previous);
      expect(retiredValues).toContain(previous);
    }
    for (const entry of tokens.retired) {
      // 폐기값은 반드시 살아 있는 값으로 대체를 가리켜야 한다(어디로 가야 하는지 없는 폐기 목록은
      // 다음 사람이 쓸 수 없다).
      expect(
        [...Object.values(tokens.locked), ...Object.values(tokens.derived)],
        `${entry.value}의 replacedBy`
      ).toContain(entry.replacedBy);
      expect(entry.note.length).toBeGreaterThan(0);
    }
  });

  it("폐기된 팔레트 값이 살아 있는 값 쪽에도 theme.ts에도 남아 있지 않다", () => {
    const tokens = brandTokens();
    const theme = read(THEME_PATH);
    const live = [...Object.values(tokens.locked), ...Object.values(tokens.derived)].map((value) =>
      value.toUpperCase()
    );
    for (const entry of tokens.retired) {
      expect(live, `${entry.value}는 폐기값이에요`).not.toContain(entry.value.toUpperCase());
      expect(theme.toUpperCase(), `${THEME_PATH}에 폐기값 ${entry.value}가 남아 있어요`).not.toContain(
        entry.value.toUpperCase()
      );
    }
  });
});

describe("스토어 자산 생성기가 브랜드 값을 스스로 정하지 않는다", () => {
  it("frame_screenshots.py가 색을 단일 소스에서 읽는다", () => {
    const generator = read(GENERATOR_PATH);
    expect(generator).toContain('"docs", "brand", "brand-tokens.json"');
    expect(generator).toContain("def load_brand_colors():");
    expect(generator).toContain("CORAL, CREAM = load_brand_colors()");
    // 값 파일이 없으면 옛 상수로 조용히 되돌아가지 않고 멈춘다(fail-closed).
    expect(generator).toContain("raise SystemExit");
    expect(generator).toContain('locked.get(key)');
  });

  it("생성기 안에 색 리터럴이 0건이다 (부정 단언)", () => {
    // 묻는 것은 **코드**다. 주석은 "종전에 어떤 값이 박혀 있었고 왜 걷어냈는가"를 적는 자리이고,
    // 그 기록에서 옛 값의 이름을 지우면 다음 사람이 같은 값을 다시 넣는다.
    const generator = read(GENERATOR_PATH)
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    const tokens = brandTokens();

    // 종전 상수: CORAL = (219, 79, 46) · CREAM = (255, 248, 241).
    expect(generator).not.toMatch(/CORAL\s*=\s*\(/);
    expect(generator).not.toMatch(/CREAM\s*=\s*\(/);
    // 어떤 RGB 3튜플도 색 상수로 남아 있으면 안 된다. 단 그림자/투명도의 RGBA 4튜플은 색이 아니라
    // 합성 파라미터이고, `range(1, 6, 2)`처럼 이름 뒤에 붙는 인자 목록도 색이 아니다.
    const rgbTuples = generator.match(/(?<![A-Za-z_])\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/g) ?? [];
    expect(rgbTuples).toEqual([]);
    for (const entry of tokens.retired) {
      expect(generator.toUpperCase()).not.toContain(entry.value.toUpperCase());
    }
  });

  it("생성기가 아는 계보 값이 매니페스트가 쓰는 값과 같다 (파생 단언)", () => {
    const generator = read(GENERATOR_PATH);
    expect(generator).toContain(`LINEAGE_APPROVED = "${LINEAGE_APPROVED}"`);
    expect(generator).toContain(`LINEAGE_PRE_APPROVAL = "${LINEAGE_PRE_APPROVAL}"`);
    // 출처가 없는 캡처로는 자산을 만들지 않는다.
    expect(generator).toContain("def check_capture_lineage(");
    expect(generator).toContain("check_capture_lineage(i, entry, allow_pre_approval)");
    expect(generator).toContain("ALLOW_PRE_APPROVAL_ENV = \"ALLOW_PRE_DSN053_CAPTURES\"");
  });
});

describe("스크린샷 매니페스트가 캡처의 출처를 진다", () => {
  it("모든 행이 이름·원본·캡션과 함께 출처 칸을 갖는다", () => {
    const entries = manifest();
    expect(entries.length).toBeGreaterThan(0);
    for (const [index, entry] of entries.entries()) {
      const where = `매니페스트 ${index + 1}번째 항목`;
      expect(entry.name, `${where}의 name`).toBeTruthy();
      expect(entry.src, `${where}의 src`).toBeTruthy();
      expect(entry.caption, `${where}의 caption`).toBeTruthy();
      expect(existsSync(join(repoRoot, entry.src!)), `${where}의 원본 파일 ${entry.src}`).toBe(true);
      expect(entry.capturedFrom, `${where}의 capturedFrom 칸`).toBeTruthy();
    }
  });

  it("출처의 계보가 선언돼 있고, 승인 계보라고 적었다면 빌드·커밋이 함께 있다", () => {
    for (const [index, entry] of manifest().entries()) {
      const where = `매니페스트 ${index + 1}번째 항목`;
      const provenance = entry.capturedFrom ?? {};
      const lineage = (provenance.lineage ?? "").trim();
      // ⚠️ 빨간불의 조건은 "미선언"이다 — 구세대라고 **선언**한 행은 사실을 적은 것이므로 통과한다.
      expect([LINEAGE_APPROVED, LINEAGE_PRE_APPROVAL], `${where}의 lineage`).toContain(lineage);
      expect((provenance.capturedAt ?? "").trim(), `${where}의 capturedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect((provenance.note ?? "").trim().length, `${where}의 note`).toBeGreaterThan(0);
      if (lineage === LINEAGE_APPROVED) {
        // 승인 계보라고 말하려면 어느 빌드/커밋인지도 말한다(거짓 선언 방지).
        expect((provenance.build ?? "").trim(), `${where}의 build`).not.toBe("");
        expect((provenance.commit ?? "").trim(), `${where}의 commit`).not.toBe("");
      }
    }
  });

  it("승인 계보 이전 캡처가 하나라도 있으면 문서가 제출 차단을 값으로 적는다 (파생 단언)", () => {
    const entries = manifest();
    const preApproval = entries.filter(
      (entry) => (entry.capturedFrom?.lineage ?? "").trim() === LINEAGE_PRE_APPROVAL
    );
    const checklist = read(SUBMISSION_CHECKLIST_PATH);
    const playListing = read(PLAY_LISTING_PATH);

    if (preApproval.length === 0) {
      // 전부 승인 계보가 되면 제출 차단 문구는 남아 있으면 안 된다 — 그때는 그 문구가 거짓이 된다.
      expect(checklist).not.toContain("제출 차단 항목");
      return;
    }

    // 오늘의 상태: 셋 다 DSN-053 이전이고, 그 사실이 제출 차단 신호다.
    expect(checklist).toContain("제출 차단 항목");
    expect(checklist).toContain("재캡처");
    expect(checklist).toContain("DSN-053");
    expect(checklist).toContain("## 0.1");
    expect(checklist).toContain(MANIFEST_PATH);
    expect(checklist).toContain(BRAND_TOKENS_PATH);
    expect(checklist).toContain(LINEAGE_APPROVED);
    expect(checklist).toContain(LINEAGE_PRE_APPROVAL);
    // 재캡처는 손그림이 아니라 기기 캡처 파이프라인의 산출물에서 온다.
    expect(checklist).toContain("pnpm pixel:android");

    expect(playListing).toContain("재캡처 전 제출 불가");
    expect(playListing).toContain("재생성 전 제출 불가");
  });
});

describe("play-listing §6 자산 표가 단일 소스를 가리킨다", () => {
  it("§6이 브랜드 값 파일과 잠근 값을 함께 적는다", () => {
    const playListing = read(PLAY_LISTING_PATH);
    const sectionStart = playListing.indexOf("## 6. 그래픽 자산 스펙 체크리스트");
    expect(sectionStart, "play-listing.md에 §6이 있어야 해요").toBeGreaterThan(-1);
    const section = playListing.slice(sectionStart);
    const tokens = brandTokens();

    expect(section).toContain(BRAND_TOKENS_PATH);
    expect(section).toContain(tokens.locked.primary);
    expect(section).toContain(tokens.locked.background);
    expect(section).toContain("DNC-017 v0.5");
    expect(section).toContain(MANIFEST_PATH);
    expect(section).toContain("capturedFrom");
  });

  it("§1~5(등록 정보 문안·촬영 가이드)은 라운드 73이 손대지 않는다", () => {
    const playListing = read(PLAY_LISTING_PATH);
    const beforeSection6 = playListing.slice(0, playListing.indexOf("## 6. 그래픽 자산 스펙 체크리스트"));
    // 트랙 B의 소유는 §6 자산 표뿐이다. 문안 쪽에 이 라운드의 흔적이 생기면 그것은 범위 이탈이다.
    expect(beforeSection6).not.toContain("brand-tokens.json");
    expect(beforeSection6).not.toContain("capturedFrom");
    expect(beforeSection6).not.toContain("제출 불가");
  });
});
