// 라운드 88 트랙 C (GAP-088 #3) — 주석 관용 앵커 대장의 계약.
//
// 여섯을 묻는다:
//  ⓐ **결정** — 무엇을 앵커로 볼 것인가 · 대상 파일을 어떻게 푸는가가 **값으로** 적혀 있다.
//  ⓑ **유령 방지** — 모집단이 0건이 아니고, 뿌리마다 테스트 파일 수·풀린 단언 수가 하한을 넘는다.
//  ⓒ **판정 셋** — 앵커마다 *코드에만* · *코드에도 주석에도* · *주석에만* 으로 갈린다.
//  ⓓ **면제** — *주석에만*은 **의도된 인용 단언**임을 이유와 증명으로 보인다(오늘 여덟, 여덟 다 의도적).
//  ⓔ **래칫** — *주석 관용* 항목 수가 오늘의 실측보다 늘지 않는다(상한도 조용히 오르지 않는다).
//  ⓕ **사각** — 밖에 남은 자리가 사각마다 **오늘 잰 하한과 함께** 적혀 있고, 그 수는 상한이 아니다.
//
// ⚠️ 이 계약은 저장소 전체를 **읽기만** 한다. 제품 소스 0건 수정이 이 트랙의 금지 조항이다.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ANCHOR_ROOTS,
  APP_ROOT_READ_SOURCE,
  COMMENT_ONLY_RATCHET,
  COMMENT_STRIPPING_CHAIN,
  COMMENT_TOLERANT_BEFORE_THIS_TRACK,
  COMMENT_TOLERANT_RATCHET,
  CONTRACT_NETS_BEFORE_THIS_ONE,
  CONTRACT_NET_COUNT_WITH_THIS_ONE,
  LEDGER_BLIND_SPOTS,
  LEDGER_SELF_FILES,
  NAMED_SOURCE_READER,
  QUOTATION_EXEMPTIONS,
  SCOUT_LOWER_BOUNDS,
  TARGET_ROOTS,
  ZERO_YIELD_ROOTS,
  appRootDeclaration,
  collectCommentToleranceAnchors,
  countVerdicts,
  repoRoot,
  splitCodeAndComments,
  type CommentToleranceAnchor
} from "./comment-tolerant-anchor-ledger";

const sweep = collectCommentToleranceAnchors();
const counts = countVerdicts(sweep.anchors);

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function anchorId(anchor: CommentToleranceAnchor): string {
  return `${anchor.testFile}:${anchor.line} → ${anchor.targetFile} :: ${JSON.stringify(anchor.literal)}`;
}

function exemptionKey(testFile: string, targetFile: string, literal: string): string {
  return `${testFile}|${targetFile}|${literal}`;
}

// ---------------------------------------------------------------------------
// ⓐ 결정 — 모집단과 대상 파일 해석이 값으로 적혀 있다
// ---------------------------------------------------------------------------

describe("ⓐ 결정 — 무엇이 앵커이고 대상 파일을 어떻게 푸는가", () => {
  it("뿌리마다 이유가 빈 문자열이 아니고 실재한다", () => {
    expect(ANCHOR_ROOTS.length).toBeGreaterThan(0);
    for (const root of ANCHOR_ROOTS) {
      expect(root.reason.trim().length, `${root.dir}의 이유`).toBeGreaterThan(40);
      expect(existsSync(join(repoRoot, root.dir)), `${root.dir}가 실재한다`).toBe(true);
      expect(existsSync(join(repoRoot, root.appRoot)), `${root.appRoot}가 실재한다`).toBe(true);
    }
  });

  it("대상 파일 해석 규칙이 본보기 파일에서 실제로 통한다 (가정이 아니라 확인이다)", () => {
    // 이 후보를 연 자리와 옳은 형식의 본보기 둘 — 셋 다 같은 관례를 쓴다.
    for (const path of [
      "apps/admin/src/admin-audit-logs.test.ts",
      "apps/admin/src/admin-load-error-copy.test.ts",
      "apps/admin/src/admin-write-role-gate.test.ts"
    ]) {
      const source = readRepo(path);
      const helper = APP_ROOT_READ_SOURCE.exec(source);
      expect(helper, `${path}에 앱 루트 관례의 readSource가 있다`).not.toBeNull();
      expect(appRootDeclaration(helper![1]).test(source), `${path}의 루트가 process.cwd()다`).toBe(true);
    }
  });

  it("주어가 풀리는 길 둘(직접 묶인 변수 · 인라인 호출)이 모집단에 실제로 다 있다", () => {
    const forms = new Set(sweep.anchors.map((anchor) => anchor.subjectForm));
    expect([...forms].sort()).toEqual(["binding", "inline"]);
  });

  it("주석을 걷는 형식이 값으로 적혀 있고 본보기 둘이 그 형식이다", () => {
    // ⚠️ 이 트랙이 고친 자리와 라운드 87 리뷰 M-3이 세운 본보기 — 둘 다 같은 파일을 본다.
    const stripped = sweep.anchors.filter((anchor) => anchor.commentStripped);
    expect(stripped.length, "주석을 걷는 앵커가 0건이면 이 트랙이 아무것도 고치지 않은 것이에요").toBeGreaterThanOrEqual(3);
    expect(new Set(stripped.map((anchor) => anchor.testFile))).toEqual(
      new Set(["apps/admin/src/admin-audit-logs.test.ts", "apps/admin/src/admin-load-error-copy.test.ts"])
    );
    for (const anchor of stripped) {
      expect(anchor.targetFile, "본보기 둘은 같은 정본 파일을 본다").toBe("apps/admin/src/lib/audit-log-rows.ts");
      expect(anchor.verdict, `${anchorId(anchor)}는 주석을 보지 않는다`).toBe("code-only");
    }
    // 형식 자체도 값이다 — 체인이 바뀌면 이 대장이 그 앵커를 다시 '주석 관용'으로 센다.
    expect(COMMENT_STRIPPING_CHAIN.test('\n      .replace(/\\/\\*[\\s\\S]*?\\*\\//g, " ")')).toBe(true);
    expect(COMMENT_STRIPPING_CHAIN.test('\n      .replace(/foo/g, " ")')).toBe(false);
  });

  it("이 트랙이 연 자리의 두 앵커가 이제 주석을 걷은 소스를 본다 (:301·:303)", () => {
    const opened = sweep.anchors.filter(
      (anchor) =>
        anchor.testFile === "apps/admin/src/admin-audit-logs.test.ts" &&
        anchor.targetFile === "apps/admin/src/lib/audit-log-rows.ts" &&
        (anchor.literal === "조건에 맞는 기록이 없어요." || anchor.literal === "아직 기록이 없어요.")
    );
    expect(opened.map((anchor) => anchor.literal).sort()).toEqual(["아직 기록이 없어요.", "조건에 맞는 기록이 없어요."]);
    for (const anchor of opened) {
      expect(anchor.commentStripped, `${anchorId(anchor)}가 주석을 걷는다`).toBe(true);
    }
    // 그리고 인용은 그대로 남아 있다 — 이 트랙은 주석을 지우지 않았다(제품 소스 0건 수정).
    const target = splitCodeAndComments(readRepo("apps/admin/src/lib/audit-log-rows.ts"));
    expect(target.comments, "머리말의 인용은 근거이므로 지우지 않는다").toContain("조건에 맞는 기록이 없어요.");
    expect(target.code, "정본은 코드에 그대로 있다").toContain('"조건에 맞는 기록이 없어요."');
  });
});

// ---------------------------------------------------------------------------
// ⓑ 유령 방지 — 모집단이 0건이 아니고, 뿌리마다 하한을 넘는다
// ---------------------------------------------------------------------------

describe("ⓑ 유령 방지 — 모집단이 살아 있다", () => {
  it("뿌리마다 테스트 파일 수와 풀린 단언 수가 둘 다 하한을 넘는다", () => {
    for (const root of ANCHOR_ROOTS) {
      const prefix = `${root.dir}/`;
      const files = sweep.populationFiles.filter((file) => file.startsWith(prefix));
      const anchors = sweep.anchors.filter((anchor) => anchor.testFile.startsWith(prefix));
      expect(files.length, `${root.dir}의 모집단 테스트 파일`).toBeGreaterThanOrEqual(root.minTestFiles);
      expect(anchors.length, `${root.dir}에서 풀린 단언`).toBeGreaterThanOrEqual(root.minAnchors);
    }
  });

  it("모집단 전체가 0건이 아니고, 걷은 파일이 푼 파일보다 훨씬 많다 (사각이 실재한다는 뜻)", () => {
    expect(sweep.anchors.length).toBeGreaterThan(500);
    expect(sweep.populationFiles.length).toBeGreaterThanOrEqual(20);
    expect(sweep.sweptTestFiles.length).toBeGreaterThan(sweep.populationFiles.length * 5);
  });

  it("대상 뿌리 넷 아래에 테스트 파일이 사는 자리는 둘뿐이다 (app/** 는 대상 뿌리다)", () => {
    for (const root of TARGET_ROOTS) {
      expect(existsSync(join(repoRoot, root)), `${root}가 실재한다`).toBe(true);
    }
    const appRoots = TARGET_ROOTS.filter((root) => root.endsWith("/app"));
    expect(appRoots.length).toBe(2);
    for (const root of appRoots) {
      expect(listRepoTestFiles(root), `${root} 아래에는 오늘 계약 파일이 0건이다`).toEqual([]);
    }
    // 그리고 앵커는 실제로 그 대상 뿌리들을 가리킨다(대상 뿌리가 장식이 아니다).
    for (const root of TARGET_ROOTS) {
      const hits = sweep.anchors.filter((anchor) => anchor.targetFile.startsWith(`${root}/`));
      expect(hits.length, `${root}를 가리키는 앵커`).toBeGreaterThan(0);
    }
  });

  it("0건 뿌리는 이유와 재개 조건을 지고, 그 이유가 오늘 참이다", () => {
    expect(ZERO_YIELD_ROOTS.length).toBeGreaterThan(0);
    for (const root of ZERO_YIELD_ROOTS) {
      expect(root.reason.trim().length, `${root.dir}의 이유`).toBeGreaterThan(40);
      expect(root.reopenCondition.trim().length, `${root.dir}의 재개 조건`).toBeGreaterThan(20);
      expect(existsSync(join(repoRoot, root.dir)), `${root.dir}가 실재한다`).toBe(true);
      // 이유가 참인가: 그 뿌리 아래에 앱 루트 관례의 readSource가 정말 0건인가.
      // ⚠️ 이 대장 자신의 두 파일은 뺀다 — 이 계약 파일은 픽스처로 그 관례의 **글자**를 짓기
      // 때문에(세 판정을 세우는 자리) 자기를 세면 첫날부터 빨간 채로 산다. 자기 배제의 규율이
      // 여기서도 그대로다.
      const conforming = listRepoTestFiles(root.dir).filter((file) => {
        if ((LEDGER_SELF_FILES as readonly string[]).includes(file)) return false;
        const source = readRepo(file);
        const helper = APP_ROOT_READ_SOURCE.exec(source);
        return helper !== null && appRootDeclaration(helper[1]).test(source);
      });
      expect(conforming, `${root.dir}에 앱 루트 관례의 readSource가 생기면 뿌리를 옮기세요`).toEqual([]);
    }
  });
});

/** 저장소 상대 경로 아래의 `*.test.ts(x)` 전수(계약 안에서만 쓰는 작은 손). */
function listRepoTestFiles(relativeDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".next") continue;
      const next = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), `${next}/`);
      else if (/\.test\.tsx?$/.test(entry.name)) out.push(next);
    }
  };
  walk(relativeDir, `${relativeDir}/`);
  return out;
}

// ---------------------------------------------------------------------------
// ⓒ 판정 셋
// ---------------------------------------------------------------------------

describe("ⓒ 판정 셋 — 코드에만 · 코드에도 주석에도 · 주석에만", () => {
  it("앵커마다 판정이 하나 있고, 넷째 값(빨간 앵커)은 0건이다", () => {
    const unanchored = sweep.anchors.filter((anchor) => anchor.verdict === "unanchored");
    expect(
      unanchored.map(anchorId),
      "코드에도 주석에도 없는 앵커는 이미 빨간 자리이거나 이 대장의 파서가 문장을 잘못 푼 자리예요"
    ).toEqual([]);
    expect(counts["code-only"] + counts["comment-tolerant"] + counts["comment-only"]).toBe(sweep.anchors.length);
  });

  it("셋 다 오늘 실제로 걸린다 (하나라도 0이면 판정이 장식이다)", () => {
    expect(counts["code-only"]).toBeGreaterThan(400);
    expect(counts["comment-tolerant"]).toBeGreaterThan(0);
    expect(counts["comment-only"]).toBeGreaterThan(0);
  });

  it("판정이 코드/주석 소재와 어긋나지 않는다", () => {
    for (const anchor of sweep.anchors) {
      if (anchor.commentStripped) {
        expect(anchor.verdict, anchorId(anchor)).toBe("code-only");
        continue;
      }
      if (anchor.verdict === "comment-tolerant") {
        expect(anchor.inCode && anchor.inComments, anchorId(anchor)).toBe(true);
      } else if (anchor.verdict === "comment-only") {
        expect(anchor.inCode, anchorId(anchor)).toBe(false);
        expect(anchor.inComments, anchorId(anchor)).toBe(true);
      } else {
        expect(anchor.inCode, anchorId(anchor)).toBe(true);
        expect(anchor.inComments, anchorId(anchor)).toBe(false);
      }
    }
  });
});

describe("ⓒ 판정 셋 — 픽스처로 세 갈래를 세운다 (저장소는 읽기만 한다)", () => {
  let fixtureRoot = "";

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), "comment-tolerant-anchor-"));
    mkdirSync(join(fixtureRoot, "apps", "admin", "src", "lib"), { recursive: true });
    writeFileSync(
      join(fixtureRoot, "apps", "admin", "src", "lib", "target.ts"),
      [
        "// 머리말이 인용한다: 오직-주석",
        "// 그리고 이것도 인용한다: 둘-다",
        'export const both = "둘-다";',
        'export const codeSide = "오직-코드";',
        ""
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(fixtureRoot, "apps", "admin", "src", "fixture.test.ts"),
      [
        'import { join } from "node:path";',
        'import { readFileSync } from "node:fs";',
        "",
        "const adminRoot = process.cwd();",
        "",
        "function readSource(relativePath: string): string {",
        '  return readFileSync(join(adminRoot, relativePath), "utf8");',
        "}",
        "",
        'const target = readSource("src/lib/target.ts");',
        'expect(target).toContain("오직-코드");',
        'expect(target).toContain("둘-다");',
        'expect(target).toContain("오직-주석");',
        'expect(readSource("src/lib/target.ts")).toContain("오직-코드");',
        ""
      ].join("\n"),
      "utf8"
    );
  });

  afterAll(() => {
    if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("세 판정이 픽스처에서 그대로 갈린다", () => {
    const fixture = collectCommentToleranceAnchors(fixtureRoot);
    const byLiteral = new Map(fixture.anchors.map((anchor) => [`${anchor.literal}|${anchor.subjectForm}`, anchor.verdict]));
    expect(byLiteral.get("오직-코드|binding")).toBe("code-only");
    expect(byLiteral.get("둘-다|binding")).toBe("comment-tolerant");
    expect(byLiteral.get("오직-주석|binding")).toBe("comment-only");
    expect(byLiteral.get("오직-코드|inline")).toBe("code-only");
  });

  it("⚠️ 교란: 주석 관용 앵커가 하나 늘면 래칫이 그것을 잡는다", () => {
    const fixture = collectCommentToleranceAnchors(fixtureRoot);
    const before = countVerdicts(fixture.anchors)["comment-tolerant"];
    writeFileSync(
      join(fixtureRoot, "apps", "admin", "src", "extra.test.ts"),
      [
        'import { join } from "node:path";',
        'import { readFileSync } from "node:fs";',
        "const adminRoot = process.cwd();",
        "function readSource(relativePath: string): string {",
        '  return readFileSync(join(adminRoot, relativePath), "utf8");',
        "}",
        'const again = readSource("src/lib/target.ts");',
        'expect(again).toContain("둘-다");',
        ""
      ].join("\n"),
      "utf8"
    );
    try {
      const after = countVerdicts(collectCommentToleranceAnchors(fixtureRoot).anchors)["comment-tolerant"];
      expect(after, "주석 관용 앵커를 새로 만들면 그 수가 오른다 — 래칫이 그 순간 빨개진다").toBe(before + 1);
    } finally {
      rmSync(join(fixtureRoot, "apps", "admin", "src", "extra.test.ts"), { force: true });
    }
  });

  it("⚠️ 교란: 코드가 사라져도 주석이 남으면 원문 앵커는 초록이다 (이 그물이 세는 이유)", () => {
    const targetPath = join(fixtureRoot, "apps", "admin", "src", "lib", "target.ts");
    const original = readFileSync(targetPath, "utf8");
    writeFileSync(targetPath, original.replace('export const both = "둘-다";', "export const both = null;"), "utf8");
    try {
      const fixture = collectCommentToleranceAnchors(fixtureRoot);
      const moved = fixture.anchors.find((anchor) => anchor.literal === "둘-다" && anchor.subjectForm === "binding");
      // 코드가 사라졌는데도 앵커는 여전히 문장을 찾는다 — 판정만 '주석에만'으로 바뀐다.
      expect(moved?.verdict).toBe("comment-only");
      expect(moved?.inComments).toBe(true);
      expect(moved?.inCode).toBe(false);
    } finally {
      writeFileSync(targetPath, original, "utf8");
    }
  });
});

// ---------------------------------------------------------------------------
// ⚠️ 라운드 88 리뷰 H-1 — 정규식 리터럴 안의 따옴표가 판정을 뒤집던 자리
// ---------------------------------------------------------------------------

/**
 * ⚠️ **고침 전의 `splitCodeAndComments` 그 자체**(라운드 88 트랙 C 판)를 픽스처로 박제해 둔다.
 *
 * 이 사본이 있어야 *"고치기 전에는 code-only, 고친 뒤에는 comment-tolerant"* 라는 갈림을 **상시**
 * 물을 수 있다 — 갈림이 없으면 이 교란 재현은 다음 라운드에 조용히 장식이 된다. 이 사본을
 * 고치지 말 것: 이것은 오늘의 구현이 아니라 **당시의 구현**이고, 그 사실이 이 테스트의 값이다.
 */
function splitAsRound88TrackC(source: string): { code: string; comments: string } {
  let code = "";
  let comments = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    if (c === "/" && source[i + 1] === "/" && source[i - 1] !== ":") {
      let j = i + 2;
      while (j < n && source[j] !== "\n") j += 1;
      comments += `${source.slice(i + 2, j)}\n`;
      code += " ";
      i = j;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(source[j] === "*" && source[j + 1] === "/")) j += 1;
      comments += `${source.slice(i + 2, j)}\n`;
      code += " ";
      i = Math.min(j + 2, n);
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === c) break;
        j += 1;
      }
      code += source.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }
    code += c;
    i += 1;
  }
  return { code, comments };
}

describe("⚠️ 리뷰 H-1 — 정규식 리터럴 안의 따옴표에서 문자열 모드로 들어가면 뒤의 주석을 코드로 삼킨다", () => {
  let fixtureRoot = "";

  // 결함을 여는 최소 모양: `/[",\n\r]/` 뒤에 그 앵커의 문장을 인용한 주석이 서고, 같은 문장이
  // 코드에도 있다 → 참값은 comment-tolerant다.
  const targetLines = [
    "export function quoteIfNeeded(text: string): string {",
    "  if (/[\",\\n\\r]/.test(text)) {",
    "    return `\"${text.replace(/\"/g, '\"\"')}\"`;",
    "  }",
    "  return text;",
    "}",
    "",
    "// 위 자르기는 collectFixtureForExport가 이미 하지만, 이 함수 단독 호출도 안전해야 한다.",
    "export const collectFixtureForExport = () => quoteIfNeeded(\"x\");",
    ""
  ];

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), "comment-tolerant-regex-"));
    mkdirSync(join(fixtureRoot, "apps", "admin", "src", "lib"), { recursive: true });
    writeFileSync(join(fixtureRoot, "apps", "admin", "src", "lib", "csv.ts"), targetLines.join("\n"), "utf8");
    writeFileSync(
      join(fixtureRoot, "apps", "admin", "src", "regex.test.ts"),
      [
        'import { join } from "node:path";',
        'import { readFileSync } from "node:fs";',
        "const adminRoot = process.cwd();",
        "function readSource(relativePath: string): string {",
        '  return readFileSync(join(adminRoot, relativePath), "utf8");',
        "}",
        'const csv = readSource("src/lib/csv.ts");',
        'expect(csv).toContain("collectFixtureForExport");',
        ""
      ].join("\n"),
      "utf8"
    );
  });

  afterAll(() => {
    if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("고침 전 스캐너는 정규식 뒤의 주석을 코드로 흡수한다 (그래서 판정이 code-only로 떨어졌다)", () => {
    const before = splitAsRound88TrackC(targetLines.join("\n"));
    expect(before.comments, "당시 스캐너는 이 주석을 주석으로 보지 못했다").not.toContain("collectFixtureForExport");
    expect(before.code, "주석이 통째로 코드 쪽에 실렸다").toContain("이미 하지만");
  });

  it("고친 스캐너는 같은 소스에서 주석을 주석으로 가른다 (참값 comment-tolerant)", () => {
    const after = splitCodeAndComments(targetLines.join("\n"));
    expect(after.comments).toContain("collectFixtureForExport");
    expect(after.code, "정본은 코드에도 그대로 있다").toContain("export const collectFixtureForExport");
    expect(after.code, "주석 본문이 코드 쪽으로 새지 않는다").not.toContain("이미 하지만");
  });

  it("⚠️ 교란 재현: 같은 픽스처의 판정이 고침 전 code-only · 고침 후 comment-tolerant로 갈린다", () => {
    const anchors = collectCommentToleranceAnchors(fixtureRoot).anchors.filter(
      (anchor) => anchor.literal === "collectFixtureForExport"
    );
    expect(anchors.length, "픽스처가 앵커 하나를 내놓는다").toBe(1);
    expect(anchors[0].verdict, "오늘의 스캐너가 참값을 낸다").toBe("comment-tolerant");

    // 그리고 같은 앵커를 **당시 스캐너**로 판정하면 code-only다 — 이 갈림이 H-1이 잡은 것이다.
    const before = splitAsRound88TrackC(readFileSync(join(fixtureRoot, "apps", "admin", "src", "lib", "csv.ts"), "utf8"));
    const beforeVerdict =
      before.code.includes("collectFixtureForExport") && before.comments.includes("collectFixtureForExport")
        ? "comment-tolerant"
        : "code-only";
    expect(beforeVerdict, "고침 전에는 주석 관용 앵커가 code-only로 숨었다").toBe("code-only");
  });

  it("⚠️ 그리고 그 오분류는 unanchored 0건으로 잡히지 않는다 (머리말이 정정한 사실)", () => {
    // 당시 머리말은 "unanchored 0건이 그 사실을 함께 확인한다"고 적었지만, 이 부류의 오분류는
    // 문장을 **코드 쪽에서** 찾아내므로 앵커는 초록이고 unanchored는 0 그대로다.
    const before = splitAsRound88TrackC(targetLines.join("\n"));
    expect(before.code.includes("collectFixtureForExport"), "코드 쪽에서 찾으므로 빨개지지 않는다").toBe(true);
    // 머리말이 그 무효를 값으로 적고 있다.
    const ledger = readRepo("packages/test-utils/src/comment-tolerant-anchor-ledger.ts");
    expect(ledger).toContain("0건은 이 부류에 대해 **아무것도 증명하지 않았다**");
  });

  it("⚠️ 이식 사실이 주석으로 남아 있고, 본보기(dead-export-ledger.ts)는 이번 리뷰에서 바이트 불변이다", () => {
    const ledger = readRepo("packages/test-utils/src/comment-tolerant-anchor-ledger.ts");
    expect(ledger, "복사한 사실과 이유가 값으로 적혀 있다").toContain(
      "packages/test-utils/src/dead-export-ledger.ts"
    );
    expect(ledger).toContain("이식한 사본");
    // 본보기 쪽은 그대로 서 있다 — 이 리뷰는 그 파일을 열지 않았다.
    const model = readRepo("packages/test-utils/src/dead-export-ledger.ts");
    expect(model).toContain("function startsRegexLiteral(source: string, slashIndex: number): boolean {");
    expect(model).toContain("function skipRegexLiteral(source: string, slashIndex: number): number | null {");
  });
});

// ---------------------------------------------------------------------------
// ⓓ 면제 — 의도된 인용 단언
// ---------------------------------------------------------------------------

describe("ⓓ 면제 — *주석에만* 은 이유와 증명을 진다", () => {
  const commentOnly = sweep.anchors.filter((anchor) => anchor.verdict === "comment-only");

  it("면제 대장과 오늘의 *주석에만* 이 정확히 같은 집합이다 (유령 면제 0건)", () => {
    const measured = new Set(commentOnly.map((anchor) => exemptionKey(anchor.testFile, anchor.targetFile, anchor.literal)));
    const ledger = new Set(
      QUOTATION_EXEMPTIONS.map((row) => exemptionKey(row.testFile, row.targetFile, row.literal))
    );
    const missing = [...measured].filter((key) => !ledger.has(key));
    const ghosts = [...ledger].filter((key) => !measured.has(key));
    expect(missing, "주석에만 있는 앵커가 새로 생겼어요 — 이유와 증명을 적거나 앵커를 고치세요").toEqual([]);
    expect(ghosts, "면제 줄이 오늘 걸리지 않아요 — 그 줄을 지우세요").toEqual([]);
  });

  it("⚠️ 여덟이고 여덟 다 의도된 인용 단언이다 (이 대장의 첫 값)", () => {
    expect(QUOTATION_EXEMPTIONS.length).toBe(8);
    expect(commentOnly.length).toBe(8);
  });

  it("이유가 빈 문자열이 아니다", () => {
    for (const row of QUOTATION_EXEMPTIONS) {
      expect(row.reason.trim().length, `${row.testFile}의 ${row.literal} 면제 이유`).toBeGreaterThan(40);
    }
  });

  it("증명이 소스에 실재하고, 앵커가 무는 문장 자신이 아니다 (자기 증명 금지)", () => {
    for (const row of QUOTATION_EXEMPTIONS) {
      const proof = readRepo(row.provenBy.path);
      expect(row.provenBy.path, `${row.literal}의 증명은 대상 파일에서 나온다`).toBe(row.targetFile);
      expect(proof, `${row.provenBy.path}에 증명 조각이 없어요`).toContain(row.provenBy.needle);
      expect(row.provenBy.needle, "증명이 앵커의 문장 자신이면 아무것도 증명하지 않아요").not.toBe(row.literal);
      // 증명은 인용과 같은 편에 산다 — 주석이다.
      expect(
        splitCodeAndComments(proof).comments,
        `${row.provenBy.path}의 증명 조각이 주석에 있어야 해요`
      ).toContain(row.provenBy.needle);
    }
  });

  it("코드 부재 단언의 짝이 값으로 적혀 있고 실재한다", () => {
    const kinds = new Set(QUOTATION_EXEMPTIONS.map((row) => row.pairedCodeAbsence.kind));
    // 짝의 종류가 하나가 아니라는 사실 자체가 값이다(같은 블록 · 다른 파일 · 코드 쪽 수 세기 · 없음).
    expect(kinds.size).toBeGreaterThan(1);
    for (const row of QUOTATION_EXEMPTIONS) {
      const pair = row.pairedCodeAbsence;
      if (pair.kind === "none") {
        expect(pair.path, "짝이 없으면 자리도 비어 있어야 해요").toBe("");
        expect(pair.needle).toBe("");
        continue;
      }
      expect(pair.path.length, `${row.literal}의 짝 위치`).toBeGreaterThan(0);
      expect(readRepo(pair.path), `${pair.path}에 짝 단언이 없어요`).toContain(pair.needle);
      if (pair.kind === "same-block-negative") {
        expect(pair.path, "같은 블록의 짝은 그 계약 파일 안에 있다").toBe(row.testFile);
      }
      if (pair.kind === "cross-file-negative") {
        expect(pair.path, "다른 파일의 짝은 그 계약 파일 밖에 있다").not.toBe(row.testFile);
      }
    }
  });

  it("⚠️ 짝이 없는 줄은 하나이고 그 사실이 값으로 남는다", () => {
    const orphans = QUOTATION_EXEMPTIONS.filter((row) => row.pairedCodeAbsence.kind === "none");
    expect(orphans.map((row) => `${row.testFile} :: ${row.literal}`)).toEqual([
      "apps/admin/src/admin-audit-logs.test.ts :: IdempotencyInterceptor"
    ]);
  });

  it("의도된 인용 단언의 옳은 형식이 저장소에 그대로 서 있다 (본보기 · 바이트 불변)", () => {
    const gate = readRepo("apps/admin/src/admin-write-role-gate.test.ts");
    expect(gate).toContain("카테고리 화면의 주석 인용이 상수와 한 글자도 다르지 않다");
    expect(gate).toContain("expect(codeOnly(page)).not.toContain(ADMIN_WRITE_ROLE_NOTICE);");
    const copy = readRepo("apps/admin/src/admin-load-error-copy.test.ts");
    expect(copy).toContain("파일만 바꾸고 주석을 함께 걷지 않으면 앵커가 자리만 옮긴 채 같은 이유로 초록이 된다");
  });
});

// ---------------------------------------------------------------------------
// ⓔ 래칫
// ---------------------------------------------------------------------------

describe("ⓔ 래칫 — 주석 관용 앵커 수는 늘지 않는다", () => {
  it("주석 관용 수가 래칫을 넘지 않는다", () => {
    const tolerant = sweep.anchors.filter((anchor) => anchor.verdict === "comment-tolerant");
    expect(
      tolerant.length,
      `주석 관용 앵커가 늘었어요(래칫 ${COMMENT_TOLERANT_RATCHET}):\n` +
        tolerant
          .slice(0, 80)
          .map((anchor) => `  · ${anchorId(anchor)}`)
          .join("\n") +
        "\n⚠️ 새로 생긴 앵커가 주석을 걷게 하세요 — 주석을 지우는 것은 답이 아니에요."
    ).toBeLessThanOrEqual(COMMENT_TOLERANT_RATCHET);
  });

  it("상한 자체가 조용히 올라가지 않는다 (오늘 실측값 하나)", () => {
    // 두 자리를 함께 고쳐야 상한이 오른다 — 한 자리만 고쳐서 지나가는 길을 남기지 않는다.
    // ⚠️ 두 시점: 라운드 88 트랙 C 당시 이 줄은 `70 → 69`였다. 그 두 수는 정규식 리터럴을 못 다루던
    //    splitCodeAndComments가 잰 값이고, 라운드 88 리뷰 H-1이 그 처리를 이식한 뒤 같은 워킹트리를
    //    다시 재니 `71 → 70`이다(저장소는 그 사이 한 글자도 달라지지 않았다).
    expect(COMMENT_TOLERANT_RATCHET).toBeLessThanOrEqual(70);
    expect(COMMENT_TOLERANT_BEFORE_THIS_TRACK).toBe(COMMENT_TOLERANT_RATCHET + 1);
  });

  it("상한이 오늘 실측값과 **정확히** 같다 (앵커를 고치면 이 줄도 함께 내려간다)", () => {
    expect(
      COMMENT_TOLERANT_RATCHET,
      `주석 관용 앵커는 오늘 ${counts["comment-tolerant"]}개예요 — COMMENT_TOLERANT_RATCHET을 그 수로 맞추세요`
    ).toBe(counts["comment-tolerant"]);
  });

  it("*주석에만* 의 상한은 면제 대장의 크기이고, 그것도 넘지 않는다", () => {
    expect(COMMENT_ONLY_RATCHET).toBe(QUOTATION_EXEMPTIONS.length);
    expect(counts["comment-only"]).toBeLessThanOrEqual(COMMENT_ONLY_RATCHET);
  });
});

// ---------------------------------------------------------------------------
// ⓕ 사각
// ---------------------------------------------------------------------------

describe("ⓕ 사각 — 이 수는 상한이 아니라 하한이다", () => {
  it("사각마다 무엇·왜·재개 조건이 빈 문자열이 아니다", () => {
    expect(LEDGER_BLIND_SPOTS.length).toBeGreaterThanOrEqual(5);
    for (const spot of LEDGER_BLIND_SPOTS) {
      expect(spot.what.trim().length, `${spot.id}의 무엇`).toBeGreaterThan(20);
      expect(spot.why.trim().length, `${spot.id}의 왜`).toBeGreaterThan(40);
      expect(spot.reopenCondition.trim().length, `${spot.id}의 재개 조건`).toBeGreaterThan(20);
      expect(spot.measuredLowerBound, `${spot.id}의 하한`).toBeGreaterThanOrEqual(0);
    }
  });

  it("사각의 하한이 스윕이 실제로 세는 수와 맞는다 (손으로 적은 수가 아니다)", () => {
    for (const spot of LEDGER_BLIND_SPOTS) {
      if (spot.id === "swept-roots") continue;
      const measured = sweep.outside.filter((entry) => entry.reason === spot.id).length;
      expect(measured, `${spot.id}의 실측이 하한 아래로 떨어졌어요`).toBeGreaterThanOrEqual(spot.measuredLowerBound);
    }
  });

  it("⚠️ analytics-trend-view.test.ts가 사각 안에 있다 (이름이 다른 헬퍼 — 오늘 트랙 A가 고친 파일)", () => {
    const blind = sweep.outside.filter(
      (entry) => entry.reason === "helper-named-reader" && entry.testFile === "apps/admin/src/lib/analytics-trend-view.test.ts"
    );
    expect(blind.length, "그 파일이 모집단에 들어왔으면 사각 설명을 함께 고치세요").toBe(1);
    const source = readRepo("apps/admin/src/lib/analytics-trend-view.test.ts");
    expect(source, "그 파일은 readAdminSource로 읽는다").toContain("function readAdminSource");
    expect(APP_ROOT_READ_SOURCE.exec(source), "앱 루트 관례의 readSource는 없다").toBeNull();
    // 사각 설명이 그 파일을 실제로 이름으로 지목한다.
    const spot = LEDGER_BLIND_SPOTS.find((entry) => entry.id === "helper-named-reader");
    expect(spot?.what).toContain("analytics-trend-view.test.ts");
  });

  it("사각이 장식이 아니다 — 모집단 밖으로 나간 자리가 모집단보다 많다", () => {
    expect(sweep.outside.length).toBeGreaterThan(0);
    const namedReaders = sweep.outside.filter((entry) => entry.reason === "helper-named-reader").length;
    expect(namedReaders, "이름이 다른 리더로 읽는 계약 파일이 이 그물 밖에 있다").toBeGreaterThan(
      sweep.populationFiles.length
    );
    // 바늘도 값이다: 그 하한을 세는 정규식이 오늘도 이름을 실제로 잡는다.
    NAMED_SOURCE_READER.lastIndex = 0;
    expect(NAMED_SOURCE_READER.test("function readAdminSource(relativePath: string) {")).toBe(true);
    NAMED_SOURCE_READER.lastIndex = 0;
  });
});

// ---------------------------------------------------------------------------
// 머리말과 전제 재실측
// ---------------------------------------------------------------------------

describe("머리말 — 이 그물은 신설이라 기존 열셋 밖이다", () => {
  it("열셋에 하나가 붙어 열넷이 된다", () => {
    expect(CONTRACT_NETS_BEFORE_THIS_ONE.length).toBe(13);
    expect(CONTRACT_NET_COUNT_WITH_THIS_ONE).toBe(14);
    expect(new Set(CONTRACT_NETS_BEFORE_THIS_ONE).size, "열셋에 같은 이름이 두 번 서지 않는다").toBe(13);
  });

  it("이 대장은 자기를 모집단에 넣지 않는다", () => {
    for (const self of LEDGER_SELF_FILES) {
      expect(existsSync(join(repoRoot, self)), `${self}가 실재한다`).toBe(true);
      expect(sweep.populationFiles, `${self}가 모집단에 들어왔어요`).not.toContain(self);
      expect(sweep.sweptTestFiles, `${self}가 스윕 대상에 들어왔어요`).not.toContain(self);
    }
  });
});

describe("전제 재실측 — 정찰의 쉰아홉과 일곱은 하한이었다", () => {
  it("두 전제 다 다시 재고, 갈린 이유가 값으로 적혀 있다", () => {
    expect(SCOUT_LOWER_BOUNDS.length).toBe(2);
    for (const bound of SCOUT_LOWER_BOUNDS) {
      expect(bound.divergence.trim().length, `${bound.what}의 갈린 이유`).toBeGreaterThan(60);
      expect(bound.remeasured, `${bound.what}: 정찰의 수는 하한이다`).toBeGreaterThanOrEqual(bound.scout);
    }
  });

  it("재실측값이 오늘의 스윕과 맞물린다", () => {
    const tolerant = SCOUT_LOWER_BOUNDS.find((bound) => bound.scout === 59);
    const commentOnly = SCOUT_LOWER_BOUNDS.find((bound) => bound.scout === 7);
    expect(tolerant?.remeasured, "고치기 전의 수").toBe(COMMENT_TOLERANT_BEFORE_THIS_TRACK);
    expect(commentOnly?.remeasured).toBe(counts["comment-only"]);
  });
});

// ---------------------------------------------------------------------------
// 무접촉 — 이 트랙이 열지 않은 자리
// ---------------------------------------------------------------------------

describe("무접촉 — 이 트랙이 여는 것은 계약 파일 하나와 신설 대장 하나뿐이다", () => {
  it("본보기와 기존 가드·대장 파일이 그대로 서 있다", () => {
    for (const path of [
      "packages/test-utils/src/dead-export-ledger.ts",
      "packages/test-utils/src/dnc-guard-ledger.ts",
      "packages/test-utils/src/dnc-scope-guard.ts",
      "packages/test-utils/src/dnc-secret-scan.ts",
      "packages/test-utils/src/source-contract-slice-guard.test.ts",
      "apps/admin/src/lib/audit-log-rows.ts",
      "apps/admin/src/admin-write-role-gate.test.ts",
      "apps/admin/src/admin-load-error-copy.test.ts"
    ]) {
      expect(existsSync(join(repoRoot, path)), `${path}가 실재한다`).toBe(true);
    }
    // ⚠️ 이것은 DNC 조항이 아니다 — DNC 대장에 이 그물의 행을 만들지 않는다.
    expect(readRepo("packages/test-utils/src/dnc-guard-ledger.ts")).not.toContain("comment-tolerant-anchor-ledger");
  });

  it("다른 트랙의 계약 파일은 이 대장이 읽기만 한다 (오늘 쉰아홉을 다 고치지 않는다)", () => {
    // 주석 관용으로 남은 앵커는 여전히 많고, 그것이 이 트랙의 판단이다 — 세되 고치지 않는다.
    expect(counts["comment-tolerant"]).toBeGreaterThan(50);
    const touchedByThisTrack = new Set(
      sweep.anchors.filter((anchor) => anchor.commentStripped).map((anchor) => anchor.testFile)
    );
    expect(touchedByThisTrack.has("apps/admin/src/lib/analytics-trend-view.test.ts")).toBe(false);
    expect(touchedByThisTrack.has("apps/mobile/src/a11y-contract.test.ts")).toBe(false);
  });
});
