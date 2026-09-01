// 라운드 74 트랙 C (GAP-074 #3) — "저장소에 들어온 사람이 가장 먼저 읽는 문서가 다른 저장소를
// 설명한다"를 잡는 계약.
//
// 라운드 47이 세운 좋은 관습이 하나 있다 — 문서가 수치를 적을 때 **`근거: <명령>`** 을 함께 적는
// 것이다. 그런데 오늘 재어 보니 그 형식을 쓰는 여섯 자리 중 다섯이 **틀린 숫자를 근거와 함께**
// 적고 있었다(스모크 31 ← 37이 문서 넷, 게이트의 근거 명령, `check:env` 카탈로그 34 ← 41).
// 근거를 적는 습관이 근거를 다시 재는 습관을 대신해 버린 것이다. 그래서 이 파일은 **인용을
// 실제로 돌린다** — 형식이 신뢰를 만들면 그 형식은 기계가 지켜야 한다.
//
// 이 파일이 묻는 것은 넷이다.
//  ① 소유 문서가 `근거: `<명령>` → <수치>` 형식으로 적은 수치가 **그 명령의 실제 답**과 같은가
//     (파생 단언 · 명령을 진짜로 실행한다).
//  ② DNC 계약의 사본이 둘 이상 있지 않은가(부정 단언 — 진입 문서는 규칙 목록이 아니라
//     `docs/dev/do-not-change.md`를 **가리킨다**).
//  ③ 에이전트 진입 문서 셋이 같은 사실을 말하는가(패키지명·패키지 매니저·DNC 단일 소스 —
//     소스에서 파생: `apps/mobile/app.json` · 루트 `package.json`).
//  ④ 폐기 팔레트가 **규칙으로** 되돌아오지 않는가(부정 단언 · `docs/4차/**` 보존본은 면제이고
//     **그 면제 이유가 값으로** 남는다).
//
// ⚠️ 이 계약이 **값을 묻지 않는** 자리가 하나 있다: `docs/5차/launch-readiness-status.md`는
// 트랙 F 소유라 이 트랙이 열지 않는다. 그 파일에는 **표식이 있는지**만 묻는다(아래 마지막 절).
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

// ── 소유 목록 ─────────────────────────────────────────────────────────────────
/** 에이전트·사람이 저장소를 처음 읽을 때 여는 셋. */
const ENTRY_DOCS = ["README.md", "AGENTS.md", "CODEX_START_HERE.md"] as const;

/** 트랙 C가 소유하는 문서 일곱 — 이 계약이 수치·사실을 묻는 전부. */
const OWNED_DOCS = [
  ...ENTRY_DOCS,
  "docs/operations/release-runbook.md",
  "docs/5차/oracle-free-deploy-runbook.md",
  "docs/5차/day1-deploy-runbook.md",
  "docs/operations/incident-response.md"
] as const;

/** DNC 계약의 현행 단일 소스(v0.5). 이 파일만 규칙 목록을 갖는다. */
const DNC_SOURCE = "docs/dev/do-not-change.md";

/** 브랜드 값의 단일 소스(라운드 73 트랙 B) — 폐기 팔레트 목록을 여기서 읽는다. */
const BRAND_TOKENS_PATH = "docs/brand/brand-tokens.json";

/** 트랙 F 소유 — 값이 아니라 **표식만** 묻는 자리. */
const LAUNCH_STATUS_DOC = "docs/5차/launch-readiness-status.md";

/**
 * 폐기 팔레트 스윕의 면제 — **이유와 함께 값으로** 적는다(라운드 73 E의 그 형식).
 *
 * 이 둘은 승인 계보의 **원본 보존본**이라 한 글자도 고치지 않는다. 그래서 그 안의 DNC-017은
 * v0.4 시절 값을 그대로 잠그고 있고, 그 사실 자체가 이번 라운드의 결함이었다 —
 * `CODEX_START_HERE.md`가 **충돌 우선순위 1위**로 이 둘을 지목하고 있었기 때문이다.
 * 그래서 고친 것은 **가리키는 문장**이고(아래 우선순위 단언), 가리켜진 파일은 면제로 남는다.
 */
const RETIRED_SWEEP_EXEMPT = [
  {
    paths: [
      "docs/4차/prompts/04_do_not_change_v0_4.md",
      "docs/4차/contracts/do_not_change_contract_v0_4.yaml"
    ],
    reason:
      "승인 계보의 원본 보존본이라 한 글자도 고치지 않는다 — v0.4 시절의 팔레트 값이 남아 있는 것이 " +
      "정상이고, 현행 값은 docs/dev/do-not-change.md(v0.5)가 진다. 대신 진입 문서가 이 둘을 " +
      "'현행 규칙'으로 가리키지 못하게 막는 것이 이 계약의 몫이다."
  }
] as const;

// ── `근거: <명령> → <수치>` 인용 ──────────────────────────────────────────────
type Citation = { doc: string; command: string; claimed: number };

/** 문서가 적은 인용 하나. 숫자는 굵게(`**37**`) 적혀도 같은 값으로 읽는다. */
const CITATION_PATTERN = /근거:\s*`([^`\n]+)`\s*→\s*\*{0,2}(\d+)/g;
/** 인용의 앞머리만 있는 자리(형식을 벗어난 인용)를 세기 위한 패턴. */
const CITATION_HEAD_PATTERN = /근거:\s*`/g;

function citationsIn(doc: string): Citation[] {
  const text = read(doc);
  return [...text.matchAll(CITATION_PATTERN)].map((match) => ({
    doc,
    command: match[1],
    claimed: Number(match[2])
  }));
}

function allCitations(): Citation[] {
  return OWNED_DOCS.flatMap(citationsIn);
}

/** 이 계약이 돌려도 되는 명령: 읽기만 하는 파이프라인. */
const READ_ONLY_TOOLS = ["grep", "awk", "sed", "wc", "sort", "uniq", "cat", "head", "tail"];

/**
 * **도구 이름만으로는 부족하다.**
 *
 * 위 목록의 이름 중 둘은 스스로 셸을 부르거나 파일을 고칠 수 있다: `awk 'BEGIN{system("…")}'`는
 * 셸을 열고, `sed -i`는 파일을 제자리에서 덮어쓴다. 둘 다 **따옴표 안**에 있어서 종전 검사
 * (따옴표를 걷어낸 뒤 첫 낱말만 보는)를 그대로 지나갔다. 그래서 이 표는 **원문 그대로**를 본다 —
 * 위험한 모양은 인용 안에 있어도 위험하다.
 *
 * 문서가 이 저장소의 파일이라는 사실은 이 검사를 무르게 하는 이유가 아니다: 이 계약은 문서가
 * 적은 문자열을 실행하므로, 문서를 고칠 수 있는 사람은 곧 이 계약이 무엇을 실행할지 고를 수 있다.
 */
const FORBIDDEN_COMMAND_PATTERNS: readonly { readonly pattern: RegExp; readonly reason: string }[] = [
  { pattern: /\bsystem\s*\(/, reason: "awk의 system()은 셸을 연다" },
  { pattern: /\bENVIRON\b|\bgetline\b|\bclose\s*\(|\|\s*&/, reason: "awk가 외부 입력·명령과 이야기한다" },
  // awk의 `print > "파일"`은 **인용 안**에 있어도 awk가 실제로 파일을 연다(셸 리다이렉트가 아니다).
  { pattern: /(^|\s)awk\b[^|]*>/, reason: "awk의 리다이렉트는 파일을 쓴다" },
  {
    pattern: /(^|\s)sed\b[^|]*(\s-[a-zA-Z]*i\b|\s--in-place\b)/,
    reason: "sed의 제자리 편집(-i / --in-place)은 읽기가 아니다"
  },
  { pattern: /(^|\s)(sed|awk)\b[^|]*\s-{1,2}f(ile)?\b/, reason: "스크립트 파일을 읽어 실행한다" },
  // `sed`의 `w` 명령/플래그는 파일을 쓴다(`sed 's/a/b/w out'` · `sed 'w out'`).
  { pattern: /(^|\s)sed\b[^|]*'[^']*\bw[ \t]+[^']+'/, reason: "sed의 w는 파일을 쓴다" },
  { pattern: /\bexec\b|\bxargs\b|\beval\b/, reason: "다른 명령을 실행시키는 낱말" }
];

/** 왜 거절했는지(초록일 때는 null). 문장은 실패 메시지에 그대로 실린다. */
function readOnlyPipelineRejection(command: string): string | null {
  if (typeof command !== "string" || command.trim().length === 0) return "빈 명령이에요";
  // 작은따옴표의 짝이 맞지 않으면 아래 걷어내기가 명령의 꼬리를 통째로 놓친다(우회로였다).
  if ((command.match(/'/g) ?? []).length % 2 !== 0) return "작은따옴표의 짝이 맞지 않아요";

  for (const rule of FORBIDDEN_COMMAND_PATTERNS) {
    if (rule.pattern.test(command)) return rule.reason;
  }

  // 인용된 인자(정규식·패턴)에는 `;` 같은 글자가 자연스럽게 들어간다 — 그 글자들은
  // **따옴표 밖**에서만 셸 메타문자다. 그래서 작은따옴표 구간을 걷어내고 본다.
  const outsideQuotes = command.replace(/'[^']*'/g, "''");
  if (/["`;&$<>]|\|\|/.test(outsideQuotes)) return "따옴표 밖에 셸 메타문자가 있어요";

  const segments = outsideQuotes.split("|").map((segment) => segment.trim());
  if (segments.some((segment) => segment.length === 0)) return "빈 파이프 구간이 있어요";
  const tools = segments.map((segment) => segment.split(/\s+/)[0]);
  const unknown = tools.filter((tool) => !READ_ONLY_TOOLS.includes(tool));
  return unknown.length === 0 ? null : `읽기 전용 도구가 아니에요: ${unknown.join("·")}`;
}

function isReadOnlyPipeline(command: string): boolean {
  return readOnlyPipelineRejection(command) === null;
}

function runCitedCommand(command: string): number {
  // ⚠️ **가드가 먼저다.** 종전에는 이 검사가 별도의 `it` 하나에만 있었고, vitest의 `it` 순서에
  // 실행 순서를 기대는 형태라 "돌린 뒤에 검사하는" 창이 실제로 열려 있었다. 이제 실행 자체가
  // 가드를 통과하지 못하면 일어나지 않는다(아래 `spawnSync`는 이 줄 다음에만 도달한다).
  const rejection = readOnlyPipelineRejection(command);
  if (rejection !== null) {
    throw new Error(`읽기 전용이 아닌 명령은 돌리지 않아요 (${rejection}): \`${command}\``);
  }

  const result = spawnSync("/bin/sh", ["-c", command], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30_000
  });
  // `grep -c`는 0건일 때 종료 코드 1을 준다 — 그것도 "답이 0"이라는 답이다.
  expect([0, 1], `\`${command}\` 실행이 실패했어요: ${result.stderr}`).toContain(result.status);
  const answer = result.stdout.trim();
  expect(answer, `\`${command}\`의 답이 숫자 한 줄이어야 해요 (받은 값: ${JSON.stringify(answer)})`)
    .toMatch(/^\d+$/);
  return Number(answer);
}

describe("문서가 인용한 근거를 계약이 실제로 돌린다 (라운드 47의 관습을 기계가 지킨다)", () => {
  it("소유 문서의 인용이 전수로 파싱되고, 오늘의 세 축이 전부 인용으로 서 있다", () => {
    const citations = allCitations();

    // ① 형식을 벗어난 인용이 없다 — 파서가 못 보는 인용은 다시 장식이 된다.
    const heads = OWNED_DOCS.reduce(
      (total, doc) => total + [...read(doc).matchAll(CITATION_HEAD_PATTERN)].length,
      0
    );
    expect(heads, "`근거: `로 시작한 인용은 전부 `→ <수치>`까지 적어야 해요").toBe(citations.length);

    // ② 오늘의 세 축(스모크 체크 수 · 게이트 단계 수 · check:env 카탈로그)이 전부 인용된다.
    const targets = ["scripts/qa/server-smoke.sh", "scripts/release-gate.ts", "scripts/check-env.ts"];
    for (const target of targets) {
      expect(
        citations.filter((citation) => citation.command.includes(target)).length,
        `${target}를 근거로 드는 인용이 있어야 해요`
      ).toBeGreaterThan(0);
    }

    // ③ 스모크 수치는 문서 셋이 나눠 갖는다(라운드 59가 하나만 고쳐 셋이 어긋났던 자리).
    const smoke = citations.filter((citation) => citation.command.includes("server-smoke.sh"));
    expect(new Set(smoke.map((citation) => citation.doc)).size).toBeGreaterThanOrEqual(3);
  });

  it("각 인용의 수치가 그 명령의 실제 답과 같다 (파생 단언 · 명령을 실제로 돌린다)", () => {
    const citations = allCitations();
    expect(citations.length, "돌릴 인용이 있어야 해요").toBeGreaterThanOrEqual(4);

    for (const citation of citations) {
      expect(
        runCitedCommand(citation.command),
        `${citation.doc}가 적은 ${citation.claimed}이 \`${citation.command}\`의 답과 달라요`
      ).toBe(citation.claimed);
    }
  });

  it("계약이 돌리는 명령은 읽기 전용 파이프라인이다 (부정 단언 · 문서가 명령을 지시하지 못한다)", () => {
    for (const citation of allCitations()) {
      expect(
        isReadOnlyPipeline(citation.command),
        `${citation.doc}의 \`${citation.command}\`는 읽기 전용 명령이 아니에요`
      ).toBe(true);
    }
  });

  /**
   * 라운드 74 적대적 리뷰 C-1 — **가드가 실행보다 먼저 선다.**
   *
   * 종전에는 위 부정 단언이 별도의 `it` 하나에만 있었다. 그런데 명령을 **실제로 돌리는** 것은
   * 다른 `it`이라, 둘의 순서에 안전이 걸려 있었다(vitest는 `it` 순서를 계약으로 주지 않는다).
   * 게다가 그 판정은 도구 이름만 봤기 때문에 `awk 'BEGIN{system("…")}'`·`sed -i`처럼 **허용
   * 목록 안의 이름이 스스로 셸을 열거나 파일을 고치는** 모양을 그대로 통과시켰다.
   *
   * 이제 `runCitedCommand`의 첫 줄이 가드다 — 아래 두 단언은 그 사실을 **거절이 실행을 대신한다**는
   * 형태로 못 박는다(던지는 것이 판정이고, 던지지 않으면 그 명령은 이미 돌아간 것이다).
   */
  it("우회 시도는 판정에서 걸리고, 실행 자체가 거부된다 (부정 단언 · C-1)", () => {
    const bypasses = [
      // ① awk의 system(): 목록 안의 이름이고 위험한 부분이 전부 작은따옴표 안에 있다.
      `awk 'BEGIN{system("touch /tmp/wooriai-guard-breach")}' scripts/check-env.ts`,
      // ② sed의 제자리 편집: 셸 메타문자가 하나도 없다.
      "sed -i 's/37/1/' scripts/qa/server-smoke.sh",
      "sed --in-place 's/37/1/' scripts/qa/server-smoke.sh",
      // ③ sed/awk가 파일을 쓰는 다른 입구들.
      "sed -n 's/a/b/w /tmp/wooriai-guard-breach' README.md",
      `awk '{print > "/tmp/wooriai-guard-breach"}' README.md`,
      "awk -f /tmp/evil.awk README.md",
      // ④ 작은따옴표 짝을 깨서 걷어내기를 지나가려는 모양.
      "grep -c 'chk README.md; touch /tmp/wooriai-guard-breach",
      // ⑤ 종전 판정이 이미 막던 것들(좁아지지 않았다는 확인).
      "grep -c chk README.md; rm -rf .",
      "cat README.md && rm -rf .",
      "grep -c chk README.md > /tmp/wooriai-guard-breach",
      "echo hi",
      "grep -c chk README.md | node -e 'process.exit(0)'"
    ];

    for (const command of bypasses) {
      expect(isReadOnlyPipeline(command), `\`${command}\`가 읽기 전용으로 판정됐어요`).toBe(false);
      // 판정만 있고 실행이 그것을 읽지 않으면 판정은 장식이다 — 실행 경로 자체가 거절한다.
      expect(() => runCitedCommand(command), `\`${command}\`가 실행 경로에서 거부되지 않았어요`).toThrow(
        /읽기 전용이 아닌 명령은 돌리지 않아요/
      );
    }

    // 그리고 오늘의 인용 넷은 여전히 통과한다(가드가 계약 자신을 잠그지 않는다).
    for (const citation of allCitations()) {
      expect(isReadOnlyPipeline(citation.command), citation.command).toBe(true);
    }
  });

  it("게이트 단계 이름 열하나가 실제 label과 전수 대응한다 (파생 단언)", () => {
    // 수치만 맞추면 "11인데 이름이 다른 11"을 놓친다 — 이름 쪽도 소스에서 파생시킨다.
    const labels = [...read("scripts/release-gate.ts").matchAll(/^ {4}label: "([^"]+)"/gm)].map(
      (match) => match[1]
    );
    const runbook = read("docs/operations/release-runbook.md");
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(runbook, `릴리즈 런북이 게이트 단계 "${label}"을 적어야 해요`).toContain(label);
    }
  });

  it("라운드 59가 남긴 옛 수치가 소유 문서에 0건이다 (부정 단언)", () => {
    // 인용 형식 밖에 남은 옛 숫자는 파서가 보지 못한다 — 그 자리를 따로 쓸어 둔다.
    const stale = ["31검사", "31/31", "11/11", "선택 34"];
    for (const doc of OWNED_DOCS) {
      const text = read(doc);
      for (const value of stale) {
        expect(text, `${doc}에 옛 수치 "${value}"가 남아 있어요`).not.toContain(value);
      }
    }
  });
});

describe("DNC 계약의 사본이 둘 이상 있지 않다 (부정 단언)", () => {
  it("단일 소스가 규칙 전수를 갖고, 진입 문서 셋은 그것을 가리킨다", () => {
    const source = read(DNC_SOURCE);
    const rules = [...source.matchAll(/^\| (DNC-\d{3}) \|/gm)].map((match) => match[1]);
    expect(new Set(rules).size, "단일 소스가 규칙 목록을 갖고 있어야 해요").toBeGreaterThanOrEqual(20);
    expect(source, "단일 소스가 판(version)을 적어야 해요").toContain("Version: v0.5");

    for (const doc of ENTRY_DOCS) {
      expect(read(doc), `${doc}가 ${DNC_SOURCE}를 가리켜야 해요`).toContain(DNC_SOURCE);
    }
  });

  it("소유 문서 어디에도 규칙 목록의 사본이 없다 (조항 ID 나열 0건)", () => {
    for (const doc of OWNED_DOCS) {
      const ids = new Set([...read(doc).matchAll(/DNC-\d{3}/g)].map((match) => match[0]));
      // 개별 조항을 근거로 한둘 인용하는 것은 좋은 일이다. 목록이 되는 순간이 사본이다.
      expect(
        ids.size,
        `${doc}가 조항 ${[...ids].join("·")}를 나열해요 — 규칙 목록의 주인은 ${DNC_SOURCE}예요`
      ).toBeLessThanOrEqual(3);
    }
  });

  it("AGENTS.md의 'Forbidden Changes' 절이 규칙 사본이 아니라 단일 소스를 가리킨다", () => {
    const agents = read("AGENTS.md");
    const section = agents.slice(agents.indexOf("## Forbidden Changes"));
    const body = section.slice(0, section.indexOf("\n## ", 3) === -1 ? undefined : section.indexOf("\n## ", 3));

    expect(body, "그 절이 단일 소스를 가리켜야 해요").toContain(DNC_SOURCE);
    // 종전의 아홉 줄은 전부 `- Do not …` / `- Keep …` 모양이었다. 그 모양이 0건이어야 사본이 없다.
    const copiedRules = body.split("\n").filter((line) => /^-\s+(Do not|Keep)\b/.test(line));
    expect(copiedRules, "규칙 사본 줄이 남아 있어요").toEqual([]);
  });

  it("CODEX_START_HERE의 '절대 변경 금지' 요약이 계약을 가리킨다 (출처 없는 사본 0건)", () => {
    const codex = read("CODEX_START_HERE.md");
    const start = codex.indexOf("## 4. 절대 변경 금지");
    expect(start, "그 절이 있어야 해요").toBeGreaterThan(-1);
    const section = codex.slice(start, codex.indexOf("## 5. "));
    expect(section, "요약이 단일 소스를 출처로 적어야 해요").toContain(DNC_SOURCE);
  });
});

describe("에이전트 진입 문서 셋이 같은 저장소를 설명한다 (소스에서 파생)", () => {
  it("안드로이드 패키지명이 app.json에서 오고, 옛 패키지명이 0건이다", () => {
    const appJson = JSON.parse(read("apps/mobile/app.json")) as {
      expo: { android: { package: string } };
    };
    const packageId = appJson.expo.android.package;
    expect(packageId).toMatch(/^[a-z][a-z0-9_.]+$/);

    expect(read("AGENTS.md"), `AGENTS.md의 패키지명이 app.json의 ${packageId}여야 해요`).toContain(
      packageId
    );
    for (const doc of OWNED_DOCS) {
      expect(read(doc), `${doc}에 옛 패키지명이 남아 있어요`).not.toMatch(/com\.anonymous\.\w+/);
    }
  });

  it("패키지 매니저가 루트 package.json에서 오고, `npm run`이 0건이다", () => {
    const rootPackage = JSON.parse(read("package.json")) as { packageManager: string };
    expect(rootPackage.packageManager).toMatch(/^pnpm@/);

    expect(read("AGENTS.md"), "AGENTS.md가 고정된 패키지 매니저를 적어야 해요").toContain(
      rootPackage.packageManager
    );
    for (const doc of OWNED_DOCS) {
      expect(read(doc), `${doc}가 아직 npm 명령을 적어요 — 이 저장소는 pnpm workspace예요`).not.toContain(
        "npm run "
      );
    }
  });

  it("머신 절대 경로가 0건이다 (이 저장소는 체크아웃 위치를 가정하지 않는다)", () => {
    for (const doc of OWNED_DOCS) {
      const text = read(doc);
      expect(text, `${doc}에 Windows 사용자 홈 경로가 남아 있어요`).not.toContain("C:\\Users");
      expect(text, `${doc}에 하드코딩된 프로젝트 드라이브 경로가 남아 있어요`).not.toContain("F:\\WooriAI");
    }
  });
});

describe("폐기 팔레트가 규칙으로 되돌아오지 않는다 (부정 단언 · 보존본은 면제)", () => {
  const retired = () =>
    (JSON.parse(read(BRAND_TOKENS_PATH)) as { retired: { value: string; role: string }[] }).retired;

  it("진입 문서 셋에 폐기값이 0건이다", () => {
    const values = retired();
    expect(values.length, "폐기 목록이 값으로 있어야 해요").toBeGreaterThan(0);

    for (const doc of ENTRY_DOCS) {
      const text = read(doc).toUpperCase();
      for (const entry of values) {
        expect(
          text,
          `${doc}에 폐기값 ${entry.value}(${entry.role})가 규칙처럼 적혀 있어요`
        ).not.toContain(entry.value.toUpperCase());
      }
    }
  });

  it("보존본 면제가 이유와 함께 값으로 있고, 실제로 면제할 것이 있다 (파생 단언)", () => {
    const values = retired();
    for (const entry of RETIRED_SWEEP_EXEMPT) {
      expect(entry.reason.trim().length, "면제 이유가 비어 있으면 면제가 아니에요").toBeGreaterThan(20);
      expect(entry.paths.length).toBeGreaterThan(0);

      for (const path of entry.paths) {
        expect(existsSync(join(repoRoot, path)), `면제 경로 ${path}가 없어요`).toBe(true);
        // 면제할 것이 없는 면제는 장식이다 — 그 파일에 폐기값이 실제로 있어야 한다.
        const source = read(path).toUpperCase();
        const found = values.filter((value) => source.includes(value.value.toUpperCase()));
        expect(found.length, `${path}에는 폐기값이 하나도 없어요 — 면제할 것이 없는 면제예요`).toBeGreaterThan(0);
        // 면제는 **스윕 대상 밖**일 때만 면제다(진입 문서 셋과 겹치지 않는다).
        expect(ENTRY_DOCS as readonly string[]).not.toContain(path);
      }
    }
  });

  it("충돌 우선순위 1위가 저장소 사본이고, 보존본은 그 아래에서 보존본이라고 적힌다", () => {
    const codex = read("CODEX_START_HERE.md");
    const start = codex.indexOf("## 2. 충돌 시 우선순위");
    expect(start, "충돌 우선순위 절이 있어야 해요").toBeGreaterThan(-1);
    const section = codex.slice(start, codex.indexOf("## 3. "));

    // 번호 목록의 항목을 순서대로 읽는다(문장이 아니라 순서가 계약이다).
    // 한 항목이 여러 줄일 수 있으므로 이어지는 줄은 그 항목에 붙인다.
    const items: string[] = [];
    for (const line of section.split("\n")) {
      if (/^\d+\.\s/.test(line)) items.push(line.replace(/^\d+\.\s/, ""));
      else if (items.length > 0 && line.trim().length > 0) items[items.length - 1] += ` ${line.trim()}`;
    }
    expect(items.length, "우선순위 항목이 있어야 해요").toBeGreaterThanOrEqual(2);
    expect(items[0], `1순위가 ${DNC_SOURCE}여야 해요`).toContain(DNC_SOURCE);

    for (const path of RETIRED_SWEEP_EXEMPT.flatMap((entry) => entry.paths)) {
      const fileName = path.split("/").pop() as string;
      const index = items.findIndex((item) => item.includes(fileName));
      if (index === -1) continue;
      expect(index, `${fileName}가 저장소 사본보다 위에 있으면 안 돼요`).toBeGreaterThan(0);
      expect(items[index], `${fileName}가 보존본이라고 적혀 있어야 해요`).toContain("보존본");
    }
  });
});

describe("트랙 F 소유 문서는 표식만 묻는다 (값은 F가 초록으로 만든다)", () => {
  /**
   * ⚠️ 여기서 **수치를 묻지 않는 것이 설계**다.
   *
   * `launch-readiness-status.md`의 스모크 수치와 `check:env` 카탈로그 수치는 오늘 낡아 있고,
   * 그 파일은 트랙 F 소유라 이 트랙이 열지 않는다. 계약이 그 값을 물면 **오늘 빨간불**이 되고,
   * 빨간 계약은 아무것도 지키지 못한다. 그래서 이 자리는 **두 근거 자리가 그 문서에 남아 있는지**
   * (= F가 고칠 자리가 사라지지 않았는지)만 본다. 값의 판정은 F가 세운다.
   */
  it("출시 현황 문서가 두 근거 자리를 그대로 갖고 있다", () => {
    const status = read(LAUNCH_STATUS_DOC);
    expect(status, "스모크 근거 자리가 있어야 해요").toContain("scripts/qa/server-smoke.sh");
    expect(status, "인용 형식 표식이 있어야 해요").toContain("근거:");
    expect(status, "check:env 카탈로그 자리가 있어야 해요").toContain("check:env");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 라운드 93 트랙 E (GAP-093E · AG-5 발동) — **축 다섯: 문서가 소스의 좌표를 무는 자리**
//
// 위 넷은 전부 **소스 → 문서** 방향이다: 소스에서 값을 파생시켜 놓고 문서가 그것을 옳게 적었는지
// 묻는다. 이 절이 새로 여는 축은 **반대 방향**이다 — 문서가 `<소스경로>:<줄>` 꼴로 소스의 한
// 자리를 무는 인용을 **전수로 걷어** 그 자리가 오늘 실재하는지까지 센다. AG-5가 사각 ⓑ에
// *"그 방향은 이 바늘 밖이고 수는 훨씬 크며 **옮기는 손도 반대다**"* 라고 적어 둔 바로 그 축이다.
//
// ⚠️⚠️ **이 트랙이 이 파일에서 여는 축은 이것 하나다.** 위 넷(`근거:` 파생 · DNC 사본 · 진입 문서
// 셋 · 폐기 팔레트)은 한 바이트도 건드리지 않았고, 이 절이 읽는 문서 넷도 **읽기만** 한다.
//
// ── 실측(**두 시점** · 전부 **하한**이다) ────────────────────────────────────────
//
// ⚠️⚠️ **시점 ①(2026-08-31 · 이 트랙 E 커밋 시점)** — 아래 수는 **그때 참이었고 지금은 낡았다**.
// 지우지 않고 남기는 이유는 AE-3의 규율이다(*언제 참이었다가 언제 거짓이 됐는가*를 함께 적는다).
//  · 살아 있는 문서 **넷**에서 걷은 경로 꼴 좌표 **26**
//    (known-limitations **16** · runtime-verification **5** · a11y 체크표 **3** · round4 감사 **2**)
//  · 그중 **파일이 실재하는 것 26 · 줄이 파일 길이 안인 것 26 · 이동 의무가 곁에 적힌 것 1**
//  · 문서→문서 좌표 **1**(`kl:6821` → `runtime-verification-required.md:367`) — 갈라내어 밖에 둔다
//  · **경로가 없는 이름만의 좌표 17**(`link-marker.ts:97` 꼴) — 이 바늘 밖이다(아래 사각 ⓓ)
//  · 모집단 밖(라운드 노트 등) **943** · 그중 **파일 길이를 넘는 죽은 좌표 3**(아래 사각 ⓑ)
//
// ⚠️⚠️ **시점 ②(같은 라운드 F 커밋 `68e6e1d` 뒤 · HEAD 재실측)** — **이 계약이 서자마자 F가 좌표
// 여섯을 두 시점으로 정정했고, 그 걸음이 자리와 의무를 둘 다 늘렸다.** 같은 파서로 다시 재면:
//  · 경로 꼴 좌표 **26 → 35**
//    (known-limitations **16 → 25** · runtime-verification **5**(그대로) · a11y 체크표 **3**(그대로)
//     · round4 감사 **2**(그대로) — ⚠️ **움직인 것은 known-limitations 하나다**)
//  · 그중 **파일이 실재하는 것 35 · 줄이 파일 길이 안인 것 35 · 이동 의무가 곁에 적힌 것 1 → 6**
//  · 문서→문서 좌표 **1 → 4**(`kl:6868`·`kl:8922` → runtime-verification · `kl:8927` → 정찰 노트 둘)
//  · **경로가 없는 이름만의 좌표 17 → 24**
//  · 모집단 밖 **943**(그대로) · 그중 **죽은 좌표 3**(그대로)
//
// ⚠️⚠️ **시점 ③(라운드 93 리뷰 뒤)** — **리뷰 자신이 이 축의 수를 또 올렸다**: 판정 문서를
// 정정하며 자기 근거로 소스 좌표를 인용했기 때문이다(M-2의 `comment-tolerant-anchor-ledger.ts:532`,
// M-3의 `resume-condition-ledger.ts:702-704`, M-9의 `app/settings/index.tsx:342` 등).
//  · 경로 꼴 좌표 **35 → 40**(known-limitations **25 → 30** · 나머지 셋은 그대로)
//  · 실재 **40** · 범위 안 **40** · 이동 의무 **6**(그대로) · 문서→문서 **4**(그대로)
//  · 이름만의 좌표 **24 → 28** · 모집단 밖 **943**(그대로 · 죽은 좌표 **3**)
// ⚠️⚠️ **이것이 이 축의 성질을 값으로 보인다 — *좌표를 고치는 걸음이 곧 좌표를 늘리는 걸음*이다.**
// 세 시점 다 늘기만 했고, 늘린 손은 전부 *문서를 정직하게 고친 손*이다.
//
// ⚠️⚠️ **그래도 아래 상수는 한 자리도 올리지 않았다** — 전부 **하한**이고, 하한은 *오늘의 값*이
// 아니라 *넘어서는 안 되는 바닥*이다(래칫). 값을 HEAD로 올리면 F가 좌표를 정정할 때마다 이 계약이
// 빨개지고, **빨간 계약은 아무것도 지키지 못한다.** 하한을 언제 올릴지는 재개 조건이 정한다.
//
// ⚠️ **정찰(round93-scout.md)과 갈린 자리를 값으로 적는다.** 정찰은 살아 있는 문서에서 **27**을,
// 그중 runtime-verification에서 **6**을 셌다. 오늘 같은 문서에서 나오는 경로 꼴 좌표는 **5**이고,
// 여섯째 자리는 `runtime-verification-required.md:1012`의 `admin-api.ts:524` — **경로가 없는
// 이름만의 좌표**다. 이 계약의 바늘은 `/`를 요구한다(이름만으로는 어느 파일인지 문서가 말하지
// 않는다). **두 수를 한 낱말로 적지 않는다** — 27은 정찰의 바늘, 26은 이 계약의 바늘이다.
// 정찰이 전수로 센 **929/38** 역시 오늘 이 파서로는 **969/39**다(정찰의 수는 하한이었다).
//
// ⚠️⚠️ **하한을 고른 비용**(AG-5의 일반형): 자리 수도 의무 수도 **하한**이라, 문서가 좌표를
// **지우면 이 계약은 그것을 보지 못한다.** 등호를 고르면 F가 절을 늘릴 때마다 빨개지고 빨간
// 계약은 아무것도 지키지 못하므로, 이 라운드는 **사라지는 좌표를 못 보는 쪽**을 값으로 택했다.
//
// ⚠️ **이 자는 앞쪽(의무의 실재)만 센다.** 뒤쪽 — *그 의무가 지켜졌는가* — 는 라운드마다 F의
// 걸음이 답한다. **시점 ①(트랙 E 커밋)의 답은 *지켜지지 않았다*였고**(하나뿐인 이동 의무
// `kl:2584`의 좌표 둘이 그때 거짓이었다), 그것이 이 축이 서는 이유였다.
//
// ⚠️⚠️ **시점 ②(F 커밋 `68e6e1d` 뒤)의 답은 *이행됐다*이다** — 라운드 79부터 열네 라운드 서 있던
// 그 의무를 F가 처음 이행했고(`monthlyUsed`가 서는 자리를 **1482 → 1519**로 옮겨 적으며 **옛
// 좌표를 지우지 않고 두 시점으로** 남겼다), 같은 걸음에 의무가 적힌 자리를 **하나에서 여섯으로**
// 늘렸다. ⚠️ **그래서 이 축이 서는 이유가 바뀌지 않는다** — 한 번 이행됐다는 것은 *다음 라운드에도
// 이행된다*가 아니고, 세는 자가 없으면 그 답은 다시 조용해진다.
import { readdirSync } from "node:fs";

/**
 * **살아 있는 문서 넷** — 라운드 노트는 여기 들어오지 않는다.
 *
 * ⚠️ 라운드 노트(`docs/5차/round*-*.md` 등)는 **작업 기록**이라 재개 조건 대장이 `round-notes`를
 * 밖에 두는 것과 같은 이유로 모집단 밖이다(넣으면 이 계약의 수가 라운드마다 통째로 흔들린다).
 * 밖에 둔 수는 아래 마지막 `it`이 **값으로** 적는다.
 *
 * ⚠️ 이 손 목록을 전수로 바꾸는 것은 **또 다른 축**이다 — 오늘 `docs/**`에는 라운드 노트가 아닌데
 * 좌표를 무는 문서가 하나 더 있다(`docs/5차/design-restore-spec.md` **3건**). 그 문서까지 넣을지는
 * 소유가 갈리는 결정이라 **재개 조건**으로 남긴다(아래 절 끝 주석).
 */
const COORDINATE_LIVE_DOCS = [
  "docs/operations/known-limitations.md",
  "docs/qa/runtime-verification-required.md",
  "docs/qa/accessibility-offline-checklist.md",
  "docs/operations/round4-production-readiness-audit.md"
] as const;

/**
 * 문서는 좌표를 **앱 루트 기준**으로도 적는다(`app/settings/privacy.tsx:150`). 그래서 해석은
 * 저장소 루트부터 앱·패키지 루트까지 차례로 시도한다 — 첫 실재가 답이다.
 */
const COORDINATE_SEARCH_ROOTS = [
  "",
  "apps/mobile/",
  "apps/api/",
  "apps/admin/",
  "packages/test-utils/",
  "packages/contracts/",
  "packages/config/"
] as const;

/**
 * `<경로>:<줄>` 꼴 한 자리. 앞에 오는 글자를 함께 물어 **경로의 마지막 조각만** 따로 잡히는 일을
 * 막는다(`/`는 앞 글자 목록에 없다). 디렉터리 조각은 없어도 잡고(이름만의 좌표를 **세기 위해서**다),
 * 모집단에 넣을지는 `isPathShapedCoordinate`가 가른다.
 *
 * ⚠️ **선행 문자 집합에 `*`를 더했다(라운드 93 리뷰 L-7)** — 이 문서들은 마크다운 굵게(`**`)를
 * 흔히 쓰고, 굵게가 좌표 **바로 앞에** 붙으면(``**path/to.ts:10``) 옛 집합으로는 그 자리가
 * 조용히 안 보였다. ⚠️⚠️ **오늘 이 한 글자가 데려오는 자리는 0건이다** — 살아 있는 문서 넷에서
 * 더하기 전후가 **63 · 63**, `docs/**` 전수에서도 **1,861 · 1,861**로 한 자리도 다르지 않다.
 * **실피해가 아니라 바늘의 구멍을 미리 닫은 것이고, 그 사실을 값으로 적는다**(0을 적어 두지
 * 않으면 다음 라운드가 이 한 글자를 *무언가를 고쳤다*로 읽는다).
 */
const COORDINATE_PATTERN =
  /(?:^|[\s`(\[「"'·→,*])((?:[A-Za-z0-9_.@()\[\]-]+\/)*[A-Za-z0-9_.@()\[\]-]+\.(?:tsx?|jsx?|mjs|cjs|json|sh|ya?ml|prisma|sql|md)):(\d+)\b/g;

/** 좌표 곁에 *"누가 언제 옮기는지"* 가 적혔는지 보는 낱말들. */
const MOVE_OBLIGATION_PATTERNS = [/옮겨야/, /옮길 것/, /자리를 옮/, /이동해야/, /옮기는 손/] as const;

/** 이동 의무를 찾는 창(위아래 몇 줄). AG-5가 손으로 푼 창과 같은 ±2다. */
const MOVE_OBLIGATION_WINDOW = 2;

type SourceCoordinate = { doc: string; docLine: number; path: string; line: number };
type ResolvedCoordinate = SourceCoordinate & { sourcePath: string };

function coordinatesInText(text: string, doc: string): SourceCoordinate[] {
  const lines = text.split("\n");
  const found: SourceCoordinate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const match of lines[index].matchAll(COORDINATE_PATTERN)) {
      found.push({ doc, docLine: index + 1, path: match[1], line: Number(match[2]) });
    }
  }
  return found;
}

/** 문서→문서 좌표는 이 축의 바늘 밖이다 — 갈라내어 값으로만 센다. */
function isDocToDocCoordinate(coordinate: SourceCoordinate): boolean {
  return coordinate.path.endsWith(".md");
}

/** 이름만 적힌 좌표(`link-marker.ts:97`)는 어느 파일인지 문서가 말하지 않았다 — 바늘 밖이다. */
function isPathShapedCoordinate(coordinate: SourceCoordinate): boolean {
  return coordinate.path.includes("/");
}

function resolveCoordinatePath(path: string): string | null {
  for (const root of COORDINATE_SEARCH_ROOTS) {
    const candidate = `${root}${path}`;
    if (existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

type CoordinateSplit = {
  all: SourceCoordinate[];
  docToDoc: SourceCoordinate[];
  bareName: SourceCoordinate[];
  resolved: ResolvedCoordinate[];
  unresolved: SourceCoordinate[];
};

function splitCoordinates(text: string, doc: string): CoordinateSplit {
  const all = coordinatesInText(text, doc);
  const docToDoc = all.filter(isDocToDocCoordinate);
  const sourceish = all.filter((coordinate) => !isDocToDocCoordinate(coordinate));
  const bareName = sourceish.filter((coordinate) => !isPathShapedCoordinate(coordinate));
  const resolved: ResolvedCoordinate[] = [];
  const unresolved: SourceCoordinate[] = [];
  for (const coordinate of sourceish.filter(isPathShapedCoordinate)) {
    const sourcePath = resolveCoordinatePath(coordinate.path);
    if (sourcePath === null) unresolved.push(coordinate);
    else resolved.push({ ...coordinate, sourcePath });
  }
  return { all, docToDoc, bareName, resolved, unresolved };
}

function liveDocSplits(): { doc: string; text: string; split: CoordinateSplit }[] {
  return COORDINATE_LIVE_DOCS.map((doc) => {
    const text = read(doc);
    return { doc, text, split: splitCoordinates(text, doc) };
  });
}

function sourceLinesOf(sourcePath: string): string[] {
  return read(sourcePath).split("\n");
}

/** 좌표가 가리키는 줄이 파일 길이 안인가. **줄의 내용은 묻지 않는다**(이번 라운드 범위 밖). */
function isLineWithinFile(coordinate: ResolvedCoordinate): boolean {
  const count = sourceLinesOf(coordinate.sourcePath).length;
  return coordinate.line >= 1 && coordinate.line <= count;
}

function hasMoveObligation(lines: string[], docLine: number): boolean {
  // 존재 가드 — 창을 뜨기 전에 그 줄이 있는지부터 본다.
  if (docLine < 1 || docLine > lines.length) return false;
  const start = Math.max(0, docLine - 1 - MOVE_OBLIGATION_WINDOW);
  const end = Math.min(lines.length, docLine + MOVE_OBLIGATION_WINDOW);
  const window = lines.slice(start, end).join("\n");
  return MOVE_OBLIGATION_PATTERNS.some((pattern) => pattern.test(window));
}

/**
 * 분포 — **문서마다 하한**. 문서는 자라므로 줄지 않는다.
 *
 * ⚠️ **두 시점**: 아래 바닥은 **트랙 E 커밋 시점(16 · 5 · 3 · 2 = 26)**의 값이고, 같은 라운드
 * F 커밋(`68e6e1d`) 뒤 HEAD는 **25 · 5 · 3 · 2 = 35**다(움직인 것은 known-limitations 하나).
 * **바닥은 올리지 않는다** — 하한은 *오늘의 값*이 아니라 *넘어서는 안 되는 바닥*이다.
 */
const COORDINATE_FLOOR_BY_DOC: readonly { readonly doc: string; readonly floor: number }[] = [
  { doc: "docs/operations/known-limitations.md", floor: 16 },
  { doc: "docs/qa/runtime-verification-required.md", floor: 5 },
  { doc: "docs/qa/accessibility-offline-checklist.md", floor: 3 },
  { doc: "docs/operations/round4-production-readiness-audit.md", floor: 2 }
];

/**
 * 살아 있는 문서 넷의 좌표 전수 **하한**.
 *
 * ⚠️ **두 시점**: 트랙 E 커밋 시점 **26** → F 커밋(`68e6e1d`) 뒤 HEAD **35**. 값은 26에 둔다
 * (하한이라 HEAD가 더 커도 초록이고, 올리면 F의 정정마다 빨개진다).
 */
const LIVE_COORDINATE_FLOOR = 26;

/**
 * 이동 의무가 곁에 적힌 자리의 **하한**.
 *
 * ⚠️ **두 시점**: 트랙 E 커밋 시점 **1**(`known-limitations.md:2584` 하나뿐이었다) → F 커밋
 * 뒤 HEAD **6**(F가 좌표 여섯을 두 시점으로 정정하며 의무 문장을 함께 늘렸다). 값은 1에 둔다.
 */
const MOVE_OBLIGATION_FLOOR = 1;

/**
 * ⚠️⚠️ **오늘 거짓인 좌표를 값으로 든다** — 계약을 빨갛게 하지 않는다.
 *
 * 좌표가 **실재한다**는 것(위 판정 셋이 보는 것)과 **그 줄이 그 사실을 말한다**는 것은 다르다.
 * 뒤쪽은 오늘 손으로 풀었고, 여섯 자리가 거짓이었다. 그 여섯을 **자리 이름으로** 여기 적어 두고
 * 아래 `it`이 **상한**으로 문다 — F가 문서를 고치면 이 목록은 **줄어드는 방향**으로만 움직이고,
 * **목록이 비어도 초록**이다(상한 꼴). 정정은 이 트랙의 걸음이 아니다: `docs/operations/**`와
 * `docs/qa/**`는 F가 소유하고, **옮기는 손이 반대라는 사실이 정확히 AG-5의 판정**이다.
 *
 * ⚠️ F는 정정할 때 옛 좌표를 지우지 않고 **두 시점으로** 적는다(AE-3). 그러면 `literal`은 문서에
 * 남을 수 있고 목록은 줄지 않는다 — **그래도 초록이다**(상한이지 등호가 아니다). 다음 라운드가
 * 세는 것은 "몇이 남았는가"가 아니라 "상한을 넘지 않는가"다.
 */
type StaleCoordinate = {
  /** 이 좌표가 적힌 문서와 그 줄. */
  readonly doc: string;
  readonly docLine: number;
  /** 문서가 적은 경로. 줄 번호만 적힌 자리는 `null`이다(그런 자리는 모집단 밖이다). */
  readonly path: string | null;
  readonly line: number;
  /** 그 좌표가 실제로 겨누는 소스 — 증거를 대는 데만 쓴다(정정은 F의 몫). */
  readonly sourcePath: string;
  /** 오늘 문서에 그 자리가 남아 있는지 보는 원문 조각. */
  readonly literal: string;
  /** 증거 ① — 이 문자열이 소스에 실재하지만 **인용된 줄에는 없다**. */
  readonly anchor?: string;
  /** 증거 ② — 이 심볼이 소스 전체에서 **0건**이다. */
  readonly absentSymbol?: string;
  /** 증거 ③ — 인용된 줄이 이 꼴이 **아니다**. */
  readonly citedLineIsNot?: RegExp;
  readonly reason: string;
  readonly foundInRound: number;
};

const KNOWN_STALE_COORDINATES: readonly StaleCoordinate[] = [
  {
    doc: "docs/operations/known-limitations.md",
    docLine: 245,
    path: "apps/mobile/app/items/[itemTemplateId].tsx",
    line: 997,
    sourcePath: "apps/mobile/app/items/[itemTemplateId].tsx",
    literal: "apps/mobile/app/items/[itemTemplateId].tsx:997",
    anchor: "caption={hasSession",
    reason:
      "`caption={hasSession ? … : undefined}`가 서는 자리는 오늘 997이 아니라 1069다 — " +
      "좌표가 밀렸고, 그 절의 근거 ⓐ는 그 자리를 가리켜 세워져 있다.",
    foundInRound: 93
  },
  {
    doc: "docs/operations/known-limitations.md",
    docLine: 254,
    path: "apps/mobile/app/(tabs)/index.tsx",
    line: 2105,
    sourcePath: "apps/mobile/app/(tabs)/index.tsx",
    literal: "apps/mobile/app/(tabs)/index.tsx:2105",
    anchor: "action={<NotificationBell",
    reason: "`action={<NotificationBell />}`는 오늘 2105가 아니라 2142에 있다 — 좌표가 밀렸다.",
    foundInRound: 93
  },
  {
    doc: "docs/operations/known-limitations.md",
    docLine: 413,
    path: "app/settings/privacy.tsx",
    line: 150,
    sourcePath: "apps/mobile/app/settings/privacy.tsx",
    literal: "app/settings/privacy.tsx:150",
    absentSymbol: "loadFailedText",
    reason:
      "그 자리를 이름으로 무는 `loadFailedText` 심볼이 이 파일에 오늘 0건이다 — 줄이 밀린 것이 " +
      "아니라 무는 대상 자체가 사라졌다(공용 조회 실패 문구로 옮겨 갔다).",
    foundInRound: 93
  },
  {
    doc: "docs/operations/known-limitations.md",
    docLine: 414,
    path: "app/import/[importJobId].tsx",
    line: 131,
    sourcePath: "apps/mobile/app/import/[importJobId].tsx",
    literal: "app/import/[importJobId].tsx:131",
    absentSymbol: "loadFailedText",
    reason: "같은 이유 — `loadFailedText`가 이 파일에 오늘 0건이다.",
    foundInRound: 93
  },
  {
    doc: "docs/operations/known-limitations.md",
    docLine: 2584,
    path: "app/(tabs)/index.tsx",
    line: 1482,
    sourcePath: "apps/mobile/app/(tabs)/index.tsx",
    literal: "app/(tabs)/index.tsx:1482",
    anchor: "const monthlyUsed",
    reason:
      "⚠️⚠️ **이동 의무가 적힌 유일한 자리**인데 그 의무가 무는 좌표가 오늘 거짓이다 — " +
      "`monthlyUsed`가 만들어지는 자리는 1482가 아니라 1519다.",
    foundInRound: 93
  },
  {
    doc: "docs/operations/known-limitations.md",
    docLine: 2584,
    path: null,
    line: 1260,
    sourcePath: "apps/mobile/app/(tabs)/index.tsx",
    literal: "`:1260`",
    citedLineIsNot: /use[A-Z][A-Za-z0-9_]*\(/,
    reason:
      "같은 문장이 *\"훅 호출은 `:1260`\"* 이라고 적는데 오늘 1260은 훅 호출이 아니라 대기 행 " +
      "주석이다. ⚠️ 경로가 없는 좌표라 이 계약의 모집단 밖이고, 그래서 값으로만 든다.",
    foundInRound: 93
  }
];

/** 상한 — 이 라운드가 손으로 푼 여섯. F가 고치면 줄어들고, 비어도 초록이다. */
const KNOWN_STALE_CAP = 6;

function staleStillPresent(entry: StaleCoordinate, docText: string): boolean {
  return docText.includes(entry.literal);
}

/** 오늘도 그 증거가 서는가. 빈 배열이면 선다(= 여전히 거짓인 좌표다). */
function staleEvidenceProblems(entry: StaleCoordinate): string[] {
  const problems: string[] = [];
  if (!existsSync(join(repoRoot, entry.sourcePath))) {
    return [`증거를 댈 소스 ${entry.sourcePath}가 없어요`];
  }
  const text = read(entry.sourcePath);
  const lines = text.split("\n");
  // 존재 가드 — 인용된 줄이 파일 안에 있을 때만 그 줄을 본다.
  const citedLine = entry.line >= 1 && entry.line <= lines.length ? lines[entry.line - 1] : null;

  if (entry.anchor !== undefined) {
    if (!text.includes(entry.anchor)) {
      problems.push(`앵커 \`${entry.anchor}\`가 ${entry.sourcePath}에 0건이에요 — 증거가 낡았어요`);
    }
    if (citedLine !== null && citedLine.includes(entry.anchor)) {
      problems.push(
        `${entry.sourcePath}:${entry.line}이 오늘 앵커를 그대로 갖고 있어요 — 더 이상 거짓이 아니에요`
      );
    }
  }
  if (entry.absentSymbol !== undefined) {
    const hits = text.split(entry.absentSymbol).length - 1;
    if (hits !== 0) {
      problems.push(`${entry.sourcePath}에 \`${entry.absentSymbol}\`가 ${hits}건 돌아왔어요`);
    }
  }
  if (entry.citedLineIsNot !== undefined && citedLine !== null && entry.citedLineIsNot.test(citedLine)) {
    problems.push(`${entry.sourcePath}:${entry.line}이 오늘 ${entry.citedLineIsNot}에 맞아요`);
  }
  return problems;
}

/**
 * 파서 픽스처 — 좌표 꼴을 **실제로 읽는지**와 **교란 둘을 잡는지**를 여기서 본다.
 * 1: 실재 좌표 · 2: 없는 파일(교란 ①) · 3: 범위 밖 줄(교란 ②) · 4: 이동 의무 문장 ·
 * 5: 문서→문서 · 6: 이름만 · 7: 줄이 없어 좌표가 아닌 자리.
 */
const COORDINATE_PARSER_FIXTURE = [
  "- 실재 좌표: `apps/mobile/src/ui.tsx:104`가 그 노드를 그린다.",
  "- 교란 ①(없는 파일): `apps/mobile/src/definitely-not-here-r93e.tsx:12`",
  "- 교란 ②(범위 밖): `apps/mobile/src/ui.tsx:999999`",
  "  ⚠️ 그래서 둘 중 하나를 옮겨야 한다.",
  "- 문서→문서: `docs/qa/runtime-verification-required.md:367`",
  "- 이름만: `link-marker.ts:97`",
  "- 줄이 없는 인용: `apps/mobile/src/ui.tsx` · 버전 v1.2:3"
].join("\n");

/** 이 파일 자신 — 아래 부정 단언(문서 0바이트)이 읽는다. */
const COORDINATE_SELF_PATH = "packages/test-utils/src/repo-self-description.test.ts";

/** 이 모듈이 `node:fs`에서 가져와도 되는 이름 — 전부 **읽기**다. */
const FS_READ_ONLY_IMPORTS = ["readFileSync", "existsSync", "readdirSync"];

function markdownFilesUnderDocs(): string[] {
  const found: string[] = [];
  const walk = (relativeDir: string): void => {
    for (const entry of readdirSync(join(repoRoot, relativeDir), { withFileTypes: true })) {
      const relative = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (entry.name.endsWith(".md")) found.push(relative);
    }
  };
  walk("docs");
  return found;
}

describe("문서가 소스의 좌표를 무는 자리를 센다 (라운드 93 트랙 E · 반대 방향 · 전부 하한)", () => {
  it("살아 있는 문서 넷을 실제로 읽고 좌표를 전수로 파생시킨다 (유령 방지 · 손 목록 금지)", () => {
    const splits = liveDocSplits();
    expect(splits.length, "문서 넷이 다 있어야 해요").toBe(COORDINATE_LIVE_DOCS.length);

    for (const entry of splits) {
      expect(entry.text.length, `${entry.doc}를 실제로 읽지 못했어요`).toBeGreaterThan(0);
      expect(
        entry.split.resolved.length,
        `${entry.doc}가 좌표를 하나도 내놓지 않았어요 — 파서가 그 문서를 못 읽고 있어요`
      ).toBeGreaterThan(0);
    }

    // 분포도 문서마다 하한이다(문서는 자란다).
    for (const { doc, floor } of COORDINATE_FLOOR_BY_DOC) {
      const found = splits.find((entry) => entry.doc === doc);
      expect(found, `${doc}가 모집단에 있어야 해요`).toBeDefined();
      expect(
        found?.split.resolved.length ?? 0,
        `${doc}의 좌표가 오늘의 바닥 ${floor}보다 적어요`
      ).toBeGreaterThanOrEqual(floor);
    }

    const total = splits.reduce((sum, entry) => sum + entry.split.resolved.length, 0);
    expect(total, `살아 있는 문서의 좌표 전수가 바닥 ${LIVE_COORDINATE_FLOOR}보다 적어요`)
      .toBeGreaterThanOrEqual(LIVE_COORDINATE_FLOOR);

    // 갈라낸 두 갈래가 실제로 갈라졌다는 것도 값으로 본다(0이면 파서가 안 가르고 있는 것이다).
    const docToDoc = splits.reduce((sum, entry) => sum + entry.split.docToDoc.length, 0);
    const bareName = splits.reduce((sum, entry) => sum + entry.split.bareName.length, 0);
    // ⚠️ 라벨은 **두 시점**이다 — 앞은 트랙 E 커밋 시점, 뒤는 F 커밋(`68e6e1d`) 뒤 HEAD.
    expect(
      docToDoc,
      "문서→문서 좌표를 갈라내고 있어야 해요 (트랙 E 커밋 시점 1 → HEAD 4)"
    ).toBeGreaterThanOrEqual(1);
    expect(
      bareName,
      "이름만의 좌표를 갈라내고 있어야 해요 (트랙 E 커밋 시점 17 → HEAD 24 · 사각 ⓓ)"
    ).toBeGreaterThanOrEqual(10);
  });

  it("판정 ⓐ — 좌표가 무는 파일이 오늘 실재한다 (하한 래칫)", () => {
    const splits = liveDocSplits();
    const existing = splits.flatMap((entry) => entry.split.resolved);
    expect(existing.length, `실재하는 좌표가 바닥 ${LIVE_COORDINATE_FLOOR}보다 적어요`)
      .toBeGreaterThanOrEqual(LIVE_COORDINATE_FLOOR);

    // ⚠️ 해석되지 않은 경로 꼴 좌표는 오늘 0이다 — 값으로만 남기고 하한으로 묻지 않는다
    // (F가 새 좌표를 적다가 오타를 내면 그것은 **다음 라운드의 후보**이지 이 계약의 빨간불이 아니다).
    const unresolved = splits.flatMap((entry) => entry.split.unresolved);
    expect(unresolved.length, "오늘 해석되지 않은 경로 꼴 좌표 (오늘 0)").toBeLessThanOrEqual(4);
  });

  it("판정 ⓑ — 좌표의 줄 번호가 파일 길이 안이다 (하한 래칫 · 줄의 내용은 묻지 않는다)", () => {
    const coordinates = liveDocSplits().flatMap((entry) => entry.split.resolved);
    const inRange = coordinates.filter(isLineWithinFile);
    expect(inRange.length, `줄 범위가 유효한 좌표가 바닥 ${LIVE_COORDINATE_FLOOR}보다 적어요`)
      .toBeGreaterThanOrEqual(LIVE_COORDINATE_FLOOR);
  });

  it("판정 ⓒ — 이동 의무가 곁에 적힌 자리가 하나 이상이다 (하한 · 앞쪽만 센다)", () => {
    const withObligation: ResolvedCoordinate[] = [];
    for (const entry of liveDocSplits()) {
      const lines = entry.text.split("\n");
      for (const coordinate of entry.split.resolved) {
        if (hasMoveObligation(lines, coordinate.docLine)) withObligation.push(coordinate);
      }
    }
    expect(
      withObligation.length,
      `좌표 곁에 *누가 언제 옮기는지*가 적힌 자리가 바닥 ${MOVE_OBLIGATION_FLOOR}보다 적어요`
    ).toBeGreaterThanOrEqual(MOVE_OBLIGATION_FLOOR);

    // ⚠️ **두 시점**. 시점 ①(트랙 E 커밋): 그 하나는 `known-limitations.md:2584`였고, 그 의무가
    // 무는 좌표가 그때 거짓이라는 사실을 아래 KNOWN_STALE이 값으로 받았다(뒤쪽 물음의 답은
    // **지켜지지 않았다**였다). 시점 ②(F 커밋 `68e6e1d` 뒤 · HEAD): 자리가 **여섯**이고 F가 그
    // 의무를 **이행했다**(`kl:2615`가 오늘의 `:1519`를, `kl:2618`이 옛 `:1482`를 든다 — 두 시점).
    // ⚠️ 아래 단언은 시점과 무관하게 **known-limitations에 그 자리가 있다**만 문다(하한 규율).
    expect(
      withObligation.some((coordinate) => coordinate.doc.endsWith("known-limitations.md")),
      "이동 의무가 적힌 자리가 known-limitations.md에 있어야 해요"
    ).toBe(true);
  });

  it("오늘 거짓인 좌표를 값으로 든다 — 목록은 상한이고, 비어도 초록이다 (F가 고치면 줄어든다)", () => {
    expect(
      KNOWN_STALE_COORDINATES.length,
      `거짓 좌표 목록이 상한 ${KNOWN_STALE_CAP}을 넘었어요 — 넘었다면 그것은 새 판정이지 이 목록이 아니에요`
    ).toBeLessThanOrEqual(KNOWN_STALE_CAP);

    for (const stale of KNOWN_STALE_COORDINATES) {
      // ① 장식이 아닌 목록: 이유·발견 라운드·증거가 실제로 있다.
      expect(stale.reason.trim().length, "이유가 비어 있으면 값이 아니에요").toBeGreaterThan(20);
      expect(stale.foundInRound, "발견 라운드를 적어야 해요").toBeGreaterThan(0);
      const hasEvidence =
        stale.anchor !== undefined || stale.absentSymbol !== undefined || stale.citedLineIsNot !== undefined;
      expect(hasEvidence, `${stale.doc}:${stale.docLine}에 증거가 하나도 없어요`).toBe(true);
      expect(
        (COORDINATE_LIVE_DOCS as readonly string[]).includes(stale.doc),
        `${stale.doc}는 이 축이 읽는 문서가 아니에요`
      ).toBe(true);
    }

    // ② 오늘 문서에 아직 남아 있는 자리만 증거를 다시 잰다(F가 지우면 이 검사도 함께 사라진다).
    const present = KNOWN_STALE_COORDINATES.filter((stale) => staleStillPresent(stale, read(stale.doc)));
    expect(present.length, "남아 있는 거짓 좌표 수가 상한을 넘었어요").toBeLessThanOrEqual(KNOWN_STALE_CAP);

    for (const stale of present) {
      expect(
        staleEvidenceProblems(stale),
        `${stale.doc}:${stale.docLine}의 거짓 판정이 오늘 서지 않아요 — 목록을 갱신해야 해요`
      ).toEqual([]);
    }

    // ③ 경로가 있는 자리는 이 계약의 모집단 안에 실제로 있다(유령 목록 방지).
    const population = liveDocSplits().flatMap((entry) => entry.split.resolved);
    for (const stale of present.filter((entry) => entry.path !== null)) {
      expect(
        population.some(
          (coordinate) =>
            coordinate.doc === stale.doc && coordinate.path === stale.path && coordinate.line === stale.line
        ),
        `${stale.path}:${stale.line}이 모집단에 없어요 — 목록과 파서가 다른 것을 보고 있어요`
      ).toBe(true);
    }
  });

  it("픽스처 — 파서가 좌표 꼴을 실제로 읽고, 없는 파일·범위 밖 좌표를 잡는다 (교란)", () => {
    const split = splitCoordinates(COORDINATE_PARSER_FIXTURE, "fixture.md");

    // ① 좌표 꼴을 읽는다: 실재 · 없는 파일 · 범위 밖 · 문서→문서 · 이름만 = 다섯.
    expect(split.all.length, "픽스처의 좌표 다섯을 읽어야 해요").toBe(5);
    expect(split.docToDoc.map((coordinate) => coordinate.path)).toEqual([
      "docs/qa/runtime-verification-required.md"
    ]);
    expect(split.bareName.map((coordinate) => coordinate.path)).toEqual(["link-marker.ts"]);
    // 줄이 없는 인용(`…/ui.tsx` 단독)과 `v1.2:3`은 좌표가 아니다.
    expect(split.all.some((coordinate) => coordinate.path === "v1.2")).toBe(false);

    // ② 교란 ① — 존재하지 않는 파일 좌표는 해석되지 않는다.
    expect(existsSync(join(repoRoot, "apps/mobile/src/definitely-not-here-r93e.tsx")), "교란용 경로가 실재하면 교란이 아니에요").toBe(false);
    expect(split.unresolved.map((coordinate) => `${coordinate.path}:${coordinate.line}`)).toEqual([
      "apps/mobile/src/definitely-not-here-r93e.tsx:12"
    ]);

    // ③ 교란 ② — 파일은 실재하지만 줄이 범위 밖인 좌표는 판정 ⓑ가 잡는다.
    const outOfRange = split.resolved.filter((coordinate) => !isLineWithinFile(coordinate));
    expect(outOfRange.map((coordinate) => coordinate.line), "범위 밖 좌표를 잡아야 해요").toEqual([999999]);
    expect(split.resolved.filter(isLineWithinFile).length, "실재 좌표 하나는 통과해야 해요").toBe(1);

    // ④ 이동 의무 창(±2)이 실제로 좁다: 4번째 줄의 의무는 3번째 줄 좌표에는 닿고 1번째에는 닿지 않는다.
    const lines = COORDINATE_PARSER_FIXTURE.split("\n");
    expect(hasMoveObligation(lines, 3), "±2 안의 이동 의무를 봐야 해요").toBe(true);
    expect(hasMoveObligation(lines, 1), "±2 밖의 문장까지 보면 창이 아니에요").toBe(false);
    // 존재 가드: 파일 밖 줄 번호는 던지지 않고 false다.
    expect(hasMoveObligation(lines, 0)).toBe(false);
    expect(hasMoveObligation(lines, lines.length + 50)).toBe(false);
  });

  it("이 모듈의 `node:fs` 표면이 읽기뿐이다 (부정 단언 · 문서 0바이트)", () => {
    expect(existsSync(join(repoRoot, COORDINATE_SELF_PATH)), "자기 자신을 못 찾았어요").toBe(true);
    const self = read(COORDINATE_SELF_PATH);

    // ⚠️⚠️ **이 자가 무는 것은 딱 하나 — `node:fs`에서 가져오는 이름이 전부 읽기인가**이다.
    // ⚠️ **"이 모듈이 문서를 고칠 수단이 없다"는 뜻이 아니다**: 이 파일은 맨 위에서
    // `node:child_process`의 `spawnSync`를 가져오고(:23), 그 표면으로는 무엇이든 쓸 수 있다.
    // 오늘 그 호출은 가드 뒤 한 자리뿐이지만(:155-161), **그 사실은 이 단언이 보는 것이 아니다** —
    // 그래서 라운드 93 리뷰(L-1)가 이 `it`의 이름과 문장을 *fs 표면*으로 좁혔다.
    // ⚠️ **다음 라운드 후보(사건형 재개 조건): `node:child_process` 표면까지 무는 날** — 그날 먼저
    // 물을 것은 *가져오기를 금지할 것인가 호출 자리를 세어 상한으로 물 것인가*이고(앞쪽이면 위
    // 하네스가 죽고 뒤쪽이면 자리 수가 값이 된다), 첫 모집단은 이 파일의 `spawnSync` 호출 전수다.
    // ⚠️ 모듈 이름도 **캡처해서** 본다 — 금지할 문자열을 이 파일에 그대로 적으면 그 문자열 자신이
    // 검사에 걸린다(자기 참조). 그래서 "적힌 이름이 무엇인가"를 묻는 꼴로 세운다.
    const clauses = [...self.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(node:fs[^"]*)"/g)];
    expect(clauses.length, "node:fs 가져오기가 있어야 해요").toBeGreaterThan(0);
    for (const clause of clauses) {
      expect(clause[2], `이 모듈이 ${clause[2]}를 가져와요 — 쓰기 가능한 fs 표면이에요`).toBe("node:fs");
      const names = clause[1]
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(
          FS_READ_ONLY_IMPORTS.includes(name),
          `이 모듈이 \`${name}\`을 가져와요 — 이 트랙은 읽기만 해야 해요`
        ).toBe(true);
      }
    }

    // 문서 넷은 이 트랙이 열지 않는다 — 소유가 F에게 있다는 사실을 값으로 못 박는다.
    // ⚠️ 이것도 **실재만** 본다(고치지 않았다는 증거가 아니다 — 그것은 커밋이 말한다).
    for (const doc of COORDINATE_LIVE_DOCS) {
      expect(existsSync(join(repoRoot, doc)), `${doc}가 있어야 해요`).toBe(true);
    }
  });

  it("모집단 밖(라운드 노트)을 값으로 적는다 — 죽은 좌표까지 (사각 ⓑ)", () => {
    const owned = new Set<string>(COORDINATE_LIVE_DOCS);
    const outside: ResolvedCoordinate[] = [];
    const docsWithHits = new Set<string>();
    for (const doc of markdownFilesUnderDocs()) {
      if (owned.has(doc)) continue;
      const resolved = splitCoordinates(read(doc), doc).resolved;
      if (resolved.length > 0) docsWithHits.add(doc);
      outside.push(...resolved);
    }

    // ⚠️ 이 수는 **모집단이 아니다** — 라운드 노트는 작업 기록이라 밖에 둔다. 밖에 두었다는 사실과
    // 그 크기를 값으로 적어 두는 것이 이 `it`의 전부다(오늘 943 · 문서 35).
    expect(outside.length, "모집단 밖 좌표 (오늘 943 — 라운드 노트가 대부분이다)").toBeGreaterThanOrEqual(900);
    expect(docsWithHits.size, "모집단 밖에서 좌표를 무는 문서 (오늘 35)").toBeGreaterThanOrEqual(25);

    // 그중 **파일 길이를 넘는 죽은 좌표**가 오늘 셋이다(`app/(tabs)/records.tsx`는 1,774줄인데
    // round65·round67 정찰이 :1831·:1884를 물고, round93 정찰이 그 사실을 인용하며 하나를 더 늘렸다).
    // ⚠️ **정찰을 쓰는 걸음이 곧 이 사각을 키우는 걸음이다.**
    const dead = outside.filter((coordinate) => !isLineWithinFile(coordinate));
    expect(dead.length, "모집단 밖의 죽은 좌표 (오늘 3)").toBeGreaterThanOrEqual(2);
  });

  // ── 재개 조건(AD-5) — **이 축의 것만** 적는다 ────────────────────────────────
  //  ① `KNOWN_STALE_COORDINATES` 여섯 중 F가 정정한 자리를 지우고 **얼마로 줄었는지**를 다시 잰다
  //     (사각 ⓐ가 다음 라운드에 얼마가 되는지가 이 축의 첫 물음이다).
  //  ② `COORDINATE_LIVE_DOCS` 손 목록을 전수로 바꿀지 결정한다 — 오늘 밖에 있는 산 문서는
  //     `docs/5차/design-restore-spec.md`(3건) 하나다. **그것은 또 다른 축**이라 이 라운드는 열지 않았다.
  //  ③ **좌표가 가리키는 줄의 내용**까지 무는 축(오늘은 존재·범위까지만 봤다) — 여섯을 손으로 푼
  //     그 일을 기계가 하게 만드는 걸음이고, 앵커 문자열을 값으로 드는 위 KNOWN_STALE이 그 본보기다.
  //  ④ 이름만의 좌표 **17**(사각 ⓓ)과 절 이름·`#N` 꼴 인용(사각 ⓒ · 수는 훨씬 크다)은 아직 밖이다.
});

// ═════════════════════════════════════════════════════════════════════════════
// 라운드 94 트랙 E (GAP-094E · AH-5 이행) — **축 여섯: 판정 문서의 재실측 표가 *수 곁에 바늘*을
// 적는가**
//
// AH-5가 *"문서가 무는 것에는 두 층이 있다 — **좌표**와 **수**"* 를 세우고, 좌표에는 라운드 93
// 트랙 E가 세는 자를 세웠지만 **수에는 아직 아무도 서지 않았다**로 닫았다. 그 절이 남긴 문장이
// *"수는 바늘이 적혀 있지 않으면 아무도 풀 수 없다"* 이고, 같은 절의 트립와이어 표에서 **두 칸이
// 실제로 *다시 잴 수 없었다*** 로 비었다. 이 축은 그 질문을 그대로 자로 만든다 — 재실측 표의
// **행을 전수로 파생**하고 자리마다 셋을 판정한다:
//  ⓐ **수가 있는가**(값 칸 둘 · 아라비아 숫자든 한글 수사든)
//  ⓑ **그 수를 낸 바늘이 곁에 적혔는가**(좌표꼴 · 백틱에 싸인 소스 파일 이름 · *모집단*·*바늘*
//     이라는 낱말 · *걷는다*·*파생한다* 가운데 하나)
//  ⓒ **그 바늘이 `<경로>:<줄>` 꼴이어서 기계가 따라갈 수 있는가**
//
// ⚠️⚠️ **다섯째 판정 — *명시적 무바늘*(라운드 94 리뷰 M-4).** ⓑ의 낱말 바늘 둘(*모집단·바늘* ·
// *걷는다·파생한다*)은 **부정문을 긍정으로 셌다**: 행이 스스로 *"**바늘**: 없다"* 라고 적으면 그
// 문장 안의 *바늘*이라는 낱말에 걸려 **바늘이 있는 행**으로 세어졌다. 그래서 오늘 이 자가 내던
// *바늘 전면* 수는 한 자리가 부풀어 있었다. 오늘부터 그런 행은 넷 중 어느 꼴도 아니라
// **다섯째**로 갈라 따로 센다 — ⚠️ **사각 ⓐ와 같은 병이다**(*바늘이 적혔다*와 *그 바늘로 재면
// 같은 수가 나온다*가 다르듯, *바늘이라는 낱말이 있다*와 *바늘이 적혔다*도 다르다).
//
// ⚠️⚠️ **이 트랙이 이 파일에서 여는 축은 이것 하나다.** 위 다섯(`근거:` 파생 · DNC 사본 · 진입
// 문서 셋 · 폐기 팔레트 · 라운드 93 E의 좌표 축)은 **한 바이트도 건드리지 않았고**, 좌표 축의
// 판정 로직은 **복사하지 않고 불러 쓴다**(`splitCoordinates` · `isLineWithinFile`).
//
// ── 실측(**두 시점** · 전부 **하한**이다 · 하한은 앞 시점에 둔 그대로다) ──────────
//  · ① **트랙 E 커밋 시점(2026-08-31 · AH절 표)**: 행 **37** · 수가 있는 행 **37** ·
//    바늘이 곁에 적힌 행 **13** · 좌표꼴 **2** · 바늘 없이 수만 있는 행 **24**
//  · ② **HEAD(2026-09-01 · A~F 머지 뒤 · F가 세운 AI절 표)**: 행 **40** · 수가 있는 행 **40** ·
//    바늘이 곁에 적힌 행 **39** · **명시적 무바늘 1**(다섯째 판정) · 좌표꼴 **9** ·
//    바늘 없이 수만 있는 행 **0**
//  ⚠️ **자가 따라가는 표가 갈렸다** — 절 이름이 아니라 *꼴*을 따라가므로, F가 AI절을 세운 순간
//  이 자의 모집단은 AH절 표에서 **AI절 표**로 옮겨 갔다. **두 시점을 한 낱말로 적지 않는다.**
//  ⚠️ 바늘 없이 수만 있는 행은 값으로만 적는다(줄어야 좋은 수라 하한이 아니다) — F가 숙제 스물넷을
//  0으로 내렸다는 사실이 그 값이다.
//
// ⚠️ **정찰(round94-scout.md §답5)과 갈린 자리를 값으로 적는다.** 정찰은 좌표꼴을 **1**로 셌고
// (`comment-tolerant-anchor-ledger.ts:532` 하나) 이 계약의 바늘로는 **2**다 — 둘째는 같은 표의
// 재개 조건 대장 행이 무는 `packages/test-utils/src/resume-condition-ledger.ts:702-704`이고,
// **줄 범위꼴**이라 정찰의 손 판정이 세지 않았다. **두 수를 한 낱말로 적지 않는다**(AH-5) —
// 1은 정찰의 바늘, 2는 라운드 93 E의 파서를 그대로 부른 이 계약의 바늘이다. 하한은 **1**에 둔다.
//
// ⚠️⚠️ **셋 다 하한인 이유**(AG-5·AH-5가 값으로 적은 그 비용): 이 라운드의 F가 **수만 있는
// 스물넷에 바늘을 붙이기 시작한다.** 등호로 물면 F가 바늘을 붙이는 정직한 걸음마다, 그리고
// 다음 라운드가 표에 행을 더할 때마다 이 계약이 빨개진다. **빨간 계약은 아무것도 지키지 못한다.**
// ⚠️⚠️ **하한을 고른 비용도 같은 자리에 적는다 — *행이 사라지거나 바늘이 지워지는 것을 이 자는
// 보지 못한다.*** 오르는 쪽으로만 래칫이 걸리고, 내려가는 걸음은 다음 라운드의 정찰이 답한다.
//
// ── 사각 넷(값으로 적는다) ─────────────────────────────────────────────────────
//  ⓐ ⚠️⚠️ **바늘이 *적혀 있다*와 *그 바늘로 재면 같은 수가 나온다*는 다르다.**
//     `helper-named-reader` 행은 바늘이 적힌 쪽인데도 넓은 바늘로 재면 **189**가 나오고
//     그 칸이 적은 수는 **167**이다(리뷰 M-2의 자). **이 자는 앞쪽만 센다** — 뒤쪽(재현되는가)은
//     라운드마다 정찰의 걸음이 답한다. ⚠️ **두 시점**: 트랙 E 커밋 시점에는 그 *바늘이 적힌 쪽*이
//     **열셋**이었고, HEAD(AI절 표)에서는 **39**다(명시적 무바늘 하나를 가른 뒤의 수다).
//  ⓑ **K~AG절의 옛 표는 모집단 밖이고 그 수는 훨씬 크다** — ⚠️ **두 시점**: 트랙 E 커밋 시점
//     **표 넷 · 행 92**였고, HEAD에서는 **표 다섯 · 행 129**다(F가 AI절을 세우며 AH절 표가 옛 표로
//     내려갔다 — *자가 따라가는 표가 옮겨 가면 그 뒤의 표는 전부 밖이 된다*). 넣으면 이 계약의
//     수가 라운드마다 통째로 흔들리므로 **값으로 적고 밖에 둔다**(라운드 93 E가 라운드 노트를 밖에
//     둔 것과 같은 이유다). ⚠️ **하한은 80 그대로다** — 값이 아니라 바닥이다.
//  ⓒ **한 행에 수가 여럿이면 그 행은 한 칸으로 센다** — *사문 대장의 사각 여덟*과 *재개 조건
//     대장의 사각 여덟*이 각각 **한 행**이고, 그 행 하나가 재현되지 않으면 여덟 수가 함께
//     재현되지 않는다.
//  ⓓ **재현 불가로 남은 칸이 오늘도 하나다** — *문턱·래칫 상수* **38**(하네스 4 · 제품 8 · 소스
//     텍스트 26)의 갈래 셋에 모집단이 어디에도 없어서 넓은 바늘의 **53**과 대조할 방법이 없다
//     (결정형 21). **이름으로 집어 아래 상수에 적는다.**
//
// ⚠️⚠️ **문서는 읽기만 한다 — 0바이트.** 스물넷에 바늘을 붙이는 손은 **F**이고(옮기는 손이
// 반대라는 사실이 AG-5의 판정이다), 이 트랙이 문서를 고치면 그 판정이 무너진다.

/** 이 축이 읽는 판정 문서 하나 — 라운드 93 E가 이미 **읽기 전용**으로 선언한 넷 중 하나다. */
const RETEST_DOC = "docs/operations/known-limitations.md";

/**
 * **절 이름을 손으로 적지 않는다.** 절은 라운드마다 새로 서므로(AG → AH → AI) 이름을 등호로
 * 물면 이 계약이 다음 라운드에 통째로 낡는다. 대신 **판정 절의 꼴**을 물고 그 가운데 **마지막**을
 * 따라간다 — 문서가 자라면 자가 함께 옮겨 간다.
 */
const JUDGMENT_SECTION_PATTERN = /^##\s+[A-Z]{1,3}\.\s+라운드\s+\d+에서 확정한 판정/;

/** 재실측 표(트립와이어 대조표)의 머리 — 이 앵커 문자열이 표를 식별한다. */
const RETEST_TABLE_HEADER_PATTERN = /^\|\s*자리\s*\|/;

/** 마크다운 표의 구분 줄(`| --- | --- |`). 머리 다음 줄이 이 꼴이어야 표다. */
const RETEST_TABLE_DIVIDER_PATTERN = /^\|[\s:|-]+\|$/;

/** 값 칸이 한글 수사로만 적힌 자리(`셋` · `열다섯` · `열하나`)도 **수가 있는 행**이다. */
const HANGUL_NUMERAL_PATTERN =
  /영|공|하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열|스물|서른|마흔|쉰|예순|일흔|여든|아흔|백|천/;

/**
 * 바늘의 꼴 넷(좌표꼴은 아래에서 따로 센다 — 라운드 93 E의 파서를 부른다).
 *
 * ⚠️ **이것은 *낱말 검색*이라 같은 뜻을 다른 말로 쓴 자리를 못 본다**(정찰 §답5의 사각 ⓒ와 같은
 * 병이다). 그래서 바늘 수는 **하한**이고, 이 자가 세는 수는 *적어도 그만큼*이라는 뜻이다
 * (트랙 E 커밋 시점 **열셋** → HEAD **39**).
 *
 * ⚠️⚠️ **낱말 바늘 둘은 부정문을 읽지 못한다(라운드 94 리뷰 M-4).** *모집단·바늘* 과
 * *걷는다·파생한다* 는 낱말이 **있는가**만 보므로 *"**바늘**: 없다"* 처럼 **없음을 적은 행**도
 * 긍정으로 셌다. 바늘의 뜻(정규식 바이트)은 **한 글자도 넓히거나 좁히지 않고**, 그런 행을
 * `RETEST_NO_NEEDLE_DECLARATION`이 **먼저** 갈라 낸다 — 넷 중 하나가 아니라 **다섯째**다.
 */
const RETEST_NEEDLE_PATTERNS: readonly { readonly kind: string; readonly pattern: RegExp }[] = [
  { kind: "백틱에 싸인 소스 파일 이름", pattern: /`[^`\n]*\.(?:tsx?|jsx?|mjs|cjs|json|sh|ya?ml|prisma|sql)\b[^`\n]*`/ },
  { kind: "모집단·바늘이라는 낱말", pattern: /모집단|바늘/ },
  { kind: "걷는다·파생한다", pattern: /걷는|걷어|걷기|파생/ },
  // ⚠️ 파일 이름 없이 **줄만** 무는 조각(`:22` · `[22, 1343, 1404]`)도 바늘이다 — 어느 파일인지는
  // 그 행의 문장이 말하고, 기계가 따라가지 못할 뿐 사람은 따라갈 수 있다(그래서 ⓒ에서는 떨어진다).
  { kind: "백틱에 싸인 줄 조각", pattern: /`[^`\n]*(?::\d|\[\s*\d+\s*,)[^`\n]*`/ }
];

/**
 * **다섯째 판정 — 행이 스스로 *바늘이 없다*고 적은 꼴**(라운드 94 리뷰 M-4).
 *
 * 이 표의 관례는 마지막 칸에 `**바늘**: …` 을 적는 것이고, 잴 자가 없는 행은 거기에 **없다**를
 * 적는다. 그 행은 *바늘이 곁에 적힌 행*도 *바늘 없이 수만 있는 행*도 아니다 — **없음을 값으로
 * 적은 행**이라 따로 센다(오늘 하나: *문턱·래칫 상수* · 사각 ⓓ가 이름으로 집는 그 자리다).
 */
const RETEST_NO_NEEDLE_DECLARATION = /\*\*바늘\*\*\s*[::]\s*(?:없다|없음|0건)/;

/** 행 전수의 **하한**. F가 표를 늘리면 오르고, 이 자는 오르는 쪽만 문다. */
const RETEST_ROW_FLOOR = 37;
/** 그중 **수가 있는 행**의 하한(트랙 E 시점 37 → HEAD 40 · 값 칸이 빈 행은 오늘도 0건이다). */
const RETEST_NUMBERED_ROW_FLOOR = 37;
/** **바늘이 곁에 적힌 행**의 하한. ⚠️⚠️ F가 스물넷에 바늘을 붙여 오늘 39다 — 오르는 쪽 래칫이다. */
const RETEST_NEEDLE_ROW_FLOOR = 13;
/** **좌표꼴 바늘**로 가리킨 행의 하한(트랙 E 시점 이 계약의 바늘로 2 · 정찰의 바늘로 1 · HEAD 9). */
const RETEST_COORDINATE_ROW_FLOOR = 1;
/** 사각 ⓑ — 모집단 밖(앞선 절들)의 재실측 표 행 하한(트랙 E 시점 표 넷 · 행 92 → HEAD 표 다섯 · 행 129). */
const RETEST_OLDER_TABLE_ROW_FLOOR = 80;
/** 사각 ⓒ — 한 칸에 수가 여덟 든 행. 트랙 E 시점 둘 → HEAD 18이고, 각각 **한 행**으로 센다. */
const RETEST_CROWDED_CELL_FLOOR = 2;
/** 사각 ⓒ의 *여럿*을 가르는 문턱 — 값 칸 하나에 수가 이만큼 들면 붐비는 칸이다. */
const RETEST_CROWDED_CELL_NUMBERS = 8;

/**
 * 사각 ⓓ — **재현 불가로 남은 칸을 이름으로 집는다.**
 *
 * ⚠️ 이 자는 *그 칸이 오늘도 비었는가*를 묻지 않는다(그것은 정찰의 걸음이 답한다). 묻는 것은
 * **그 자리가 표에 아직 있는가** 하나다 — 이름이 사라지면 이 사각이 조용히 없어진다.
 */
const RETEST_UNREPRODUCIBLE_CELL = {
  rowName: "문턱·래칫 상수",
  value: 38,
  wideNeedleValue: 53,
  reason:
    "라운드 92 F가 낸 38의 갈래 셋(하네스 4 · 제품 8 · 소스 텍스트 26)에 모집단이 어디에도 " +
    "적혀 있지 않아, 넓은 바늘의 53과 대조할 방법이 오늘도 없다(결정형 21 · AH-5)."
} as const;

/**
 * 사각 ⓐ — **바늘이 적혔다고 그 수가 재현되는 것은 아니다.**
 *
 * 이 행은 바늘이 적힌 쪽에 있는데도, 그 바늘을 넓게 대면 다른 수가 나온다. 이 자는
 * **앞쪽(바늘의 실재)만** 세고, 뒤쪽(재현)은 라운드마다 정찰의 걸음이 답한다.
 * ⚠️ **두 시점**: 그 *바늘이 적힌 쪽*은 트랙 E 커밋 시점 **열셋**이었고 HEAD에서는 **39**다.
 */
const RETEST_NEEDLE_WITHOUT_REPRODUCTION = {
  rowName: "helper-named-reader",
  citedValue: 167,
  wideNeedleValue: 189
} as const;

type RetestRow = { index: number; raw: string; cells: string[] };
type RetestTable = { sectionTitle: string; sectionLine: number; headerLine: number; rows: RetestRow[] };

function markdownRowCells(raw: string): string[] {
  return raw.split("|").slice(1, -1).map((cell) => cell.trim());
}

/** 마지막 판정 절 뒤에 서는 재실측 표. **못 찾으면 `null`** — 부르는 쪽이 빨개진다(유령 방지). */
function retestTableIn(text: string): RetestTable | null {
  const lines = text.split("\n");
  let sectionLine = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (JUDGMENT_SECTION_PATTERN.test(lines[index])) sectionLine = index;
  }
  if (sectionLine === -1) return null;

  let headerLine = -1;
  for (let index = sectionLine + 1; index < lines.length; index += 1) {
    if (RETEST_TABLE_HEADER_PATTERN.test(lines[index])) headerLine = index;
  }
  // 표는 **머리 + 구분 줄**로 서야 표다 — 구분 줄이 없으면 그것은 표가 아니라 한 줄이다.
  if (headerLine === -1 || !RETEST_TABLE_DIVIDER_PATTERN.test(lines[headerLine + 1] ?? "")) return null;

  const rows: RetestRow[] = [];
  for (let index = headerLine + 2; index < lines.length; index += 1) {
    if (!lines[index].startsWith("|")) break;
    rows.push({ index: rows.length + 1, raw: lines[index], cells: markdownRowCells(lines[index]) });
  }
  return {
    sectionTitle: lines[sectionLine].trim(),
    sectionLine: sectionLine + 1,
    headerLine: headerLine + 1,
    rows
  };
}

/** 모집단 밖 — 마지막 판정 절 **앞**에 있는 옛 재실측 표들(사각 ⓑ). */
function olderRetestTableRows(text: string): { tables: number; rows: number } {
  const lines = text.split("\n");
  let lastSection = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (JUDGMENT_SECTION_PATTERN.test(lines[index])) lastSection = index;
  }
  let tables = 0;
  let rows = 0;
  for (let index = 0; index < lastSection; index += 1) {
    if (!RETEST_TABLE_HEADER_PATTERN.test(lines[index])) continue;
    if (!RETEST_TABLE_DIVIDER_PATTERN.test(lines[index + 1] ?? "")) continue;
    tables += 1;
    for (let row = index + 2; row < lines.length; row += 1) {
      if (!lines[row].startsWith("|")) break;
      rows += 1;
    }
  }
  return { tables, rows };
}

/** 값 칸 둘(라운드 N이 남긴 값 · HEAD 재실측)만 본다 — 설명 칸의 수는 *그 행의 값*이 아니다. */
function retestValueCells(row: RetestRow): string {
  return row.cells.slice(1, 3).join(" ");
}

/** 판정 ⓐ — 이 행이 수를 냈는가. */
function retestRowHasNumber(row: RetestRow): boolean {
  const values = retestValueCells(row);
  return /\d/.test(values) || HANGUL_NUMERAL_PATTERN.test(values);
}

/** 판정 ⓒ의 재료 — 이 행이 무는 `<경로>:<줄>` 꼴 좌표. **라운드 93 E의 파서를 부른다.** */
function retestRowCoordinates(row: RetestRow): CoordinateSplit {
  return splitCoordinates(row.raw, RETEST_DOC);
}

/**
 * 다섯째 판정 — 이 행이 **바늘이 없다고 스스로 적었는가**(라운드 94 리뷰 M-4).
 *
 * ⚠️ 이 판정이 **먼저** 선다: 그 문장 안에 *바늘*이라는 낱말이 들어 있어서 낱말 바늘 둘이
 * 긍정으로 세던 자리이고, 세는 쪽을 고치지 않으면 *바늘 전면*이 한 자리 부푼 채로 남는다.
 */
function retestRowDeclaresNoNeedle(row: RetestRow): boolean {
  return RETEST_NO_NEEDLE_DECLARATION.test(row.raw);
}

/**
 * 판정 ⓑ — 이 행 곁에 적힌 바늘의 꼴들(빈 배열이면 *바늘이 적히지 않은 행*이다).
 *
 * ⚠️ **명시적 무바늘 행은 빈 배열이다** — 그 행이 *수만 있는 행*(F의 숙제)인지는 아래에서
 * 다섯째 판정으로 다시 가른다. **두 수를 한 낱말로 적지 않는다.**
 */
function retestRowNeedleKinds(row: RetestRow): string[] {
  if (retestRowDeclaresNoNeedle(row)) return [];
  const kinds = RETEST_NEEDLE_PATTERNS.filter((needle) => needle.pattern.test(row.raw)).map(
    (needle) => needle.kind
  );
  const coordinates = retestRowCoordinates(row);
  if (coordinates.resolved.length + coordinates.unresolved.length > 0) kinds.unshift("좌표꼴");
  return kinds;
}

function retestTableOrThrow(): RetestTable {
  const table = retestTableIn(read(RETEST_DOC));
  // ⚠️ **못 찾으면 0이 아니라 빨개진다** — 0을 내놓는 자는 표가 사라진 날 조용히 초록이 된다.
  if (table === null) {
    throw new Error(
      `${RETEST_DOC}의 마지막 판정 절에서 재실측 표(\`| 자리 | … |\`)를 찾지 못했어요 — ` +
        "절 이름이 아니라 **표의 꼴**을 따라가는 자라, 표가 사라졌거나 머리가 바뀐 거예요"
    );
  }
  return table;
}

/**
 * 픽스처 — 표 꼴에서 **판정 셋을 실제로 가르는지**를 여기서 본다.
 * 1: 수 + 좌표꼴 바늘 · 2: 수 + 백틱 파일 이름(좌표 아님) · 3: 수 + 낱말로 적은 자 ·
 * 4: 한글 수사만 있고 바늘 없음 · 5: 값 칸에 수가 없는 행 · 6: 한 칸에 수 여덟(사각 ⓒ).
 */
const RETEST_TABLE_FIXTURE = [
  "## ZZ. 라운드 99에서 확정한 판정 (픽스처 · GAP-099 트랙 F)",
  "",
  "| 자리 | 라운드 98이 남긴 값 | HEAD 재실측 | 움직였는가 |",
  "| --- | --- | --- | --- |",
  "| 좌표로 가리킨 자리 | 12 | **13** | `packages/test-utils/src/repo-self-description.test.ts:1`이 그 자다 |",
  "| 파일 이름만 | 7 | **7** | 그대로다 — `dead-export-ledger.ts`가 센다 |",
  "| 낱말로 적은 자 | 5 | **6** | 모집단은 앱 전수다 |",
  "| 적힌 자가 없다 | 셋 | **넷** | 늘었다 |",
  "| 값이 비었다 | 다시 재지 못했다 | **다시 재지 못했다** | 잴 자가 없다 |",
  "| 붐비는 칸 | 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 | **1 · 2 · 3 · 4 · 5 · 6 · 7 · 9** | 한 칸이 여덟을 진다 |",
  // ⚠️ 다섯째 판정의 픽스처(라운드 94 리뷰 M-4) — 낱말 바늘 둘이 다 걸릴 문장을 일부러 쓰되,
  // 그 문장이 **없음의 선언**이라 바늘로 세어지지 않는다.
  "| 잴 자가 없다 | 38 | **다시 재지 못했다** | 갈래 셋의 모집단이 없다. **바늘**: 없다(모집단이 적히면 그것은 새 판정이다) |",
  "",
  "본문은 표가 아니다."
].join("\n");

/** 교란 — 위 픽스처에서 **좌표꼴 바늘 한 행의 바늘을 지운다**(수는 그대로 둔다). */
const RETEST_TABLE_FIXTURE_NEEDLE_REMOVED = RETEST_TABLE_FIXTURE.replace(
  "`packages/test-utils/src/repo-self-description.test.ts:1`이 그 자다",
  "그 자가 어디 있는지는 적혀 있지 않다"
);

describe("판정 문서의 재실측 표가 수 곁에 바늘을 적는가를 센다 (라운드 94 트랙 E · 전부 하한)", () => {
  it("최신 판정 절의 재실측 표를 전수로 파생시킨다 (절 이름 등호 금지 · 유령 방지)", () => {
    const text = read(RETEST_DOC);
    const table = retestTableOrThrow();

    // ① 절을 **꼴로** 따라간다 — 오늘 이 문서의 판정 절은 여럿이고, 자는 그 마지막을 본다.
    const sections = text.split("\n").filter((line) => JUDGMENT_SECTION_PATTERN.test(line));
    expect(sections.length, "판정 절을 꼴로 찾지 못했어요").toBeGreaterThanOrEqual(5);
    expect(
      table.sectionTitle,
      `자가 따라간 절: ${table.sectionTitle} (${RETEST_DOC}:${table.sectionLine})`
    ).toBe(sections[sections.length - 1].trim());

    // ② 행 전수는 **하한**이다(F가 표를 늘리면 오른다).
    expect(
      table.rows.length,
      `재실측 표 행이 바닥 ${RETEST_ROW_FLOOR}보다 적어요 (표 머리 ${RETEST_DOC}:${table.headerLine})`
    ).toBeGreaterThanOrEqual(RETEST_ROW_FLOOR);

    // ③ 행 꼴이 실제로 표다 — 칸 넷이 아니면 파서가 다른 것을 읽고 있는 것이다.
    for (const row of table.rows) {
      expect(row.cells.length, `${table.headerLine + 1 + row.index}행의 칸이 넷이 아니에요`).toBe(4);
      expect(row.cells[0].length, "자리 이름이 빈 행이 있어요").toBeGreaterThan(0);
    }
  });

  it("판정 셋 + 다섯째 — 행마다 수·바늘·좌표꼴을 세고 명시적 무바늘을 가른다 (하한 래칫 · 두 시점)", () => {
    const rows = retestTableOrThrow().rows;
    const numbered = rows.filter(retestRowHasNumber);
    const withNeedle = rows.filter((row) => retestRowNeedleKinds(row).length > 0);
    const withCoordinate = rows.filter(
      (row) => retestRowCoordinates(row).resolved.length + retestRowCoordinates(row).unresolved.length > 0
    );

    expect(numbered.length, `수가 있는 행이 바닥 ${RETEST_NUMBERED_ROW_FLOOR}보다 적어요`)
      .toBeGreaterThanOrEqual(RETEST_NUMBERED_ROW_FLOOR);
    expect(
      withNeedle.length,
      `바늘이 곁에 적힌 행이 바닥 ${RETEST_NEEDLE_ROW_FLOOR}보다 적어요 — ` +
        "바늘을 붙이는 손은 F이고 이 자는 **오르는 쪽만** 물어요"
    ).toBeGreaterThanOrEqual(RETEST_NEEDLE_ROW_FLOOR);
    expect(
      withCoordinate.length,
      `좌표꼴 바늘로 가리킨 행이 바닥 ${RETEST_COORDINATE_ROW_FLOOR}보다 적어요`
    ).toBeGreaterThanOrEqual(RETEST_COORDINATE_ROW_FLOOR);

    // ⚠️ **수만 있는 행**은 값으로만 적는다 — *줄어야 좋은 수*라 하한으로 물면 F의 걸음이 빨강을
    // 맞는다. ⚠️ **두 시점**: 트랙 E 커밋 시점 **24** → HEAD **0**(F가 숙제를 다 붙였다).
    // ⚠️⚠️ **명시적 무바늘 행은 그 숙제가 아니다** — *아직 안 붙인 것*과 *붙일 자가 없다고 적은 것*을
    // 한 낱말로 적지 않는다(라운드 94 리뷰 M-4).
    const declaredNoNeedle = rows.filter(retestRowDeclaresNoNeedle);
    const numberOnly = rows.filter(
      (row) =>
        retestRowHasNumber(row) && retestRowNeedleKinds(row).length === 0 && !retestRowDeclaresNoNeedle(row)
    );
    // ⓐ 다섯째 판정이 실제로 갈린다 — 오늘 하나이고, **그 하나가 사각 ⓓ의 그 자리**다.
    expect(
      declaredNoNeedle.length,
      "*바늘: 없다*를 값으로 적은 행 (오늘 하나 · 문턱·래칫 상수)"
    ).toBeGreaterThanOrEqual(1);
    expect(
      declaredNoNeedle.some((row) => row.cells[0].includes(RETEST_UNREPRODUCIBLE_CELL.rowName)),
      "명시적 무바늘 행이 사각 ⓓ가 이름으로 집는 그 자리가 아니에요"
    ).toBe(true);
    // ⓑ **넷 · 다섯이 겹치지 않는다** — 갈래의 합이 전수이고 어느 행도 두 갈래에 들지 않는다.
    expect(
      withNeedle.length + declaredNoNeedle.length + numberOnly.length,
      `갈래의 합이 전수와 달라요 (바늘 ${withNeedle.length} · 무바늘 선언 ${declaredNoNeedle.length} · 수만 ${numberOnly.length})`
    ).toBe(rows.length);
    // ⓒ 교란 — 그 선언을 지우면 낱말 바늘 둘이 그 행을 **다시 긍정으로** 센다(이 자가 고친 그 병).
    const declaredRaw = declaredNoNeedle[0].raw;
    const withoutDeclaration = {
      ...declaredNoNeedle[0],
      raw: declaredRaw.replace(RETEST_NO_NEEDLE_DECLARATION, "**바늘**: 같은 파일의 모집단")
    };
    expect(retestRowNeedleKinds(declaredNoNeedle[0]), "선언이 있으면 빈 배열이에요").toEqual([]);
    expect(
      retestRowNeedleKinds(withoutDeclaration).length,
      "선언을 지우면 낱말 바늘이 다시 센다는 사실이 이 자의 근거예요"
    ).toBeGreaterThan(0);

    // 대신 여기서 무는 것은 **꼴**이다: 바늘만 있고 수가 없는 행은 이 표의 행이 아니다(오늘 0건).
    const needleWithoutNumber = withNeedle.filter((row) => !retestRowHasNumber(row));
    expect(
      needleWithoutNumber.map((row) => row.cells[0]),
      `수 없이 바늘만 있는 행이에요 (오늘 0건 · 수만 있는 행은 ${numberOnly.length})`
    ).toEqual([]);
  });

  it("좌표꼴 바늘은 그 파일이 실재하고 줄이 범위 안이다 (라운드 93 E의 함수를 부른다 · 복사 아님)", () => {
    const rows = retestTableOrThrow().rows;
    const resolved: ResolvedCoordinate[] = [];
    const unresolved: SourceCoordinate[] = [];
    for (const row of rows) {
      const split = retestRowCoordinates(row);
      resolved.push(...split.resolved);
      unresolved.push(...split.unresolved);
    }

    expect(resolved.length, `실재하는 좌표꼴 바늘이 바닥 ${RETEST_COORDINATE_ROW_FLOOR}보다 적어요`)
      .toBeGreaterThanOrEqual(RETEST_COORDINATE_ROW_FLOOR);
    // ⚠️ 해석되지 않은 경로 꼴 좌표는 오늘 0이다 — 값으로만 남긴다(F의 오타는 다음 라운드의
    // 후보이지 이 계약의 빨간불이 아니다 · 라운드 93 E가 같은 자리에서 같은 판단을 했다).
    expect(unresolved.length, "표 안에서 해석되지 않은 경로 꼴 좌표 (오늘 0)").toBeLessThanOrEqual(4);

    for (const coordinate of resolved) {
      expect(
        isLineWithinFile(coordinate),
        `표가 무는 ${coordinate.path}:${coordinate.line}이 파일 길이를 넘어요`
      ).toBe(true);
    }
  });

  it("픽스처 — 표 꼴에서 판정 셋을 가르고, 바늘을 지운 행을 감지한다 (교란)", () => {
    const table = retestTableIn(RETEST_TABLE_FIXTURE);
    expect(table, "픽스처의 표를 찾아야 해요").not.toBeNull();
    const rows = (table as RetestTable).rows;
    expect(rows.length, "픽스처의 행 일곱을 읽어야 해요").toBe(7);
    expect((table as RetestTable).sectionTitle).toContain("라운드 99에서 확정한 판정");

    // ① 판정 ⓐ — 값 칸에 수가 없는 다섯째 행만 떨어진다(한글 수사 `셋`은 수다).
    expect(rows.filter(retestRowHasNumber).map((row) => row.cells[0])).toEqual([
      "좌표로 가리킨 자리",
      "파일 이름만",
      "낱말로 적은 자",
      "적힌 자가 없다",
      "붐비는 칸",
      "잴 자가 없다"
    ]);

    // ② 판정 ⓑ — 바늘의 꼴이 실제로 갈린다.
    expect(retestRowNeedleKinds(rows[0])[0]).toBe("좌표꼴");
    expect(retestRowNeedleKinds(rows[1])).toEqual(["백틱에 싸인 소스 파일 이름"]);
    expect(retestRowNeedleKinds(rows[2])).toEqual(["모집단·바늘이라는 낱말"]);
    expect(retestRowNeedleKinds(rows[3]), "바늘 없는 행은 빈 배열이어야 해요").toEqual([]);

    // ②-2 **다섯째 판정**(라운드 94 리뷰 M-4) — *바늘: 없다*를 적은 행은 낱말 바늘 둘이 다 걸릴
    // 문장을 지녔는데도 **바늘로 세어지지 않는다.** 교란: 그 선언만 지우면 다시 긍정으로 센다.
    const declared = rows[6];
    expect(retestRowDeclaresNoNeedle(declared), "명시적 무바늘 행을 가려내야 해요").toBe(true);
    expect(retestRowNeedleKinds(declared), "없음의 선언은 바늘이 아니에요").toEqual([]);
    expect(retestRowHasNumber(declared), "그래도 수는 있는 행이에요").toBe(true);
    expect(
      retestRowNeedleKinds({
        ...declared,
        raw: declared.raw.replace(RETEST_NO_NEEDLE_DECLARATION, "**바늘**: 같은 파일의 모집단")
      }),
      "선언을 지우면 낱말 바늘이 다시 세야 이 판정이 값을 낸 것이에요"
    ).toEqual(["모집단·바늘이라는 낱말"]);
    // 그리고 그 앞의 행들은 이 판정에 걸리지 않는다(다섯째가 넷을 삼키지 않는다).
    expect(rows.slice(0, 6).filter(retestRowDeclaresNoNeedle)).toEqual([]);

    // ③ 판정 ⓒ — 좌표꼴은 첫 행 하나뿐이고, 백틱 파일 이름만 있는 행은 떨어진다.
    const coordinateRows = rows.filter(
      (row) => retestRowCoordinates(row).resolved.length + retestRowCoordinates(row).unresolved.length > 0
    );
    expect(coordinateRows.map((row) => row.cells[0])).toEqual(["좌표로 가리킨 자리"]);

    // ④ 사각 ⓒ — 한 칸에 여덟이 든 행도 **한 행**이다.
    const crowded = rows.filter(
      (row) => (retestValueCells(row).match(/\d+/g) ?? []).length >= RETEST_CROWDED_CELL_NUMBERS
    );
    expect(crowded.map((row) => row.cells[0])).toEqual(["붐비는 칸"]);

    // ⑤ **교란** — 바늘 하나를 지우면 바늘 수도 좌표 수도 하나씩 준다(수는 그대로다).
    const disturbed = retestTableIn(RETEST_TABLE_FIXTURE_NEEDLE_REMOVED);
    expect(disturbed, "교란 픽스처도 표는 그대로 있어야 해요").not.toBeNull();
    const disturbedRows = (disturbed as RetestTable).rows;
    expect(disturbedRows.length, "교란은 행을 지우지 않아요").toBe(rows.length);
    expect(
      disturbedRows.filter((row) => retestRowNeedleKinds(row).length > 0).length,
      "바늘을 지운 행을 감지하지 못했어요"
    ).toBe(rows.filter((row) => retestRowNeedleKinds(row).length > 0).length - 1);
    expect(
      disturbedRows.filter((row) => retestRowCoordinates(row).resolved.length > 0).length,
      "좌표꼴 바늘이 사라진 것을 감지하지 못했어요"
    ).toBe(0);
    expect(
      disturbedRows.filter(retestRowHasNumber).length,
      "교란은 수를 건드리지 않아요"
    ).toBe(rows.filter(retestRowHasNumber).length);

    // ⑥ 유령 방지 — 표가 없는 글에서는 `null`이지 0이 아니다.
    expect(retestTableIn("## ZZ. 라운드 99에서 확정한 판정\n\n표가 없다.\n")).toBeNull();
    expect(retestTableIn("| 자리 | 값 |\n| --- | --- |\n| 하나 | 1 |\n"), "판정 절이 없으면 표도 없어요")
      .toBeNull();
  });

  it("사각 넷을 값으로 적는다 — 옛 표는 밖 · 붐비는 칸 · 재현 불가 칸 · 앞쪽만 센다", () => {
    const table = retestTableOrThrow();
    const rows = table.rows;

    // 사각 ⓑ — 앞선 절의 옛 표는 모집단 밖이고 그 수는 훨씬 크다.
    // ⚠️ **두 시점**: 트랙 E 커밋 시점 **표 넷 · 행 92**(K~AG절) → HEAD **표 다섯 · 행 129**
    // (F가 AI절을 세우자 AH절 표가 함께 옛 표로 내려갔다). **하한은 앞 시점 그대로 80이다.**
    const older = olderRetestTableRows(read(RETEST_DOC));
    expect(older.tables, "앞선 절의 재실측 표 (트랙 E 시점 넷 → HEAD 다섯)").toBeGreaterThanOrEqual(3);
    expect(
      older.rows,
      `모집단 밖(앞선 절)의 재실측 표 행 — 오늘 ${older.rows}이고 이 축의 모집단 ${rows.length}보다 크다`
    ).toBeGreaterThanOrEqual(RETEST_OLDER_TABLE_ROW_FLOOR);
    expect(older.rows, "옛 표가 모집단보다 작으면 이 사각은 사각이 아니에요").toBeGreaterThan(rows.length);

    // 사각 ⓒ — 한 칸에 수가 여럿인 행도 **한 행**이다(사문 대장의 사각 여덟 · 재개 조건의 사각 여덟).
    // ⚠️ **두 시점**: 트랙 E 커밋 시점 **둘**(그 사각 둘) → HEAD **18** — F가 행마다 바늘을 적으며
    // 값 칸이 붐비는 행이 늘었다. **하한은 앞 시점 그대로 2다**(오르는 쪽만 문다).
    const crowded = rows.filter(
      (row) => (retestValueCells(row).match(/\d+/g) ?? []).length >= RETEST_CROWDED_CELL_NUMBERS
    );
    expect(
      crowded.length,
      `한 칸에 수가 ${RETEST_CROWDED_CELL_NUMBERS} 이상 든 행 (트랙 E 시점 둘 → HEAD 18 · 각각 한 행으로 센다)`
    ).toBeGreaterThanOrEqual(RETEST_CROWDED_CELL_FLOOR);
    expect(crowded.length, "붐비는 칸도 표의 행이라 전수를 넘을 수 없어요").toBeLessThanOrEqual(rows.length);

    // 사각 ⓓ — 재현 불가로 남은 칸을 **이름으로** 집는다(그 자리가 사라지면 사각이 조용히 없어진다).
    expect(RETEST_UNREPRODUCIBLE_CELL.reason.trim().length, "이유가 비면 값이 아니에요").toBeGreaterThan(20);
    expect(
      rows.some((row) => row.cells[0].includes(RETEST_UNREPRODUCIBLE_CELL.rowName)),
      `재현 불가로 남은 칸 "${RETEST_UNREPRODUCIBLE_CELL.rowName}"이 표에서 사라졌어요 — ` +
        `${RETEST_UNREPRODUCIBLE_CELL.value}(넓은 바늘 ${RETEST_UNREPRODUCIBLE_CELL.wideNeedleValue})의 ` +
        "모집단이 적혔다면 그것은 새 판정이고, 이름만 바뀐 것이라면 이 상수를 함께 옮겨야 해요"
    ).toBe(true);

    // 사각 ⓐ — **바늘이 적혀 있다 ≠ 그 바늘로 재면 같은 수가 나온다.** 이 자는 앞쪽만 센다.
    const needleWithoutReproduction = rows.filter((row) =>
      row.raw.includes(RETEST_NEEDLE_WITHOUT_REPRODUCTION.rowName)
    );
    expect(
      needleWithoutReproduction.length,
      `사각 ⓐ의 본보기 "${RETEST_NEEDLE_WITHOUT_REPRODUCTION.rowName}" 행이 표에 있어야 해요`
    ).toBeGreaterThanOrEqual(1);
    for (const row of needleWithoutReproduction) {
      expect(
        retestRowNeedleKinds(row).length,
        `그 행은 바늘이 적힌 쪽인데도 넓은 바늘로 재면 ${RETEST_NEEDLE_WITHOUT_REPRODUCTION.wideNeedleValue}가 ` +
          `나오고 칸이 적은 수는 ${RETEST_NEEDLE_WITHOUT_REPRODUCTION.citedValue}예요 — 이 자는 앞쪽만 세요`
      ).toBeGreaterThan(0);
    }
  });

  it("이 축이 도는 동안 판정 문서가 0바이트다 (부정 단언 · 바늘을 붙이는 손은 F다)", () => {
    // ⚠️ 이 단언이 무는 것은 **이 `it`이 도는 동안**이다 — *이 트랙이 커밋에서 문서를 고치지
    // 않았다*는 증거가 아니다(그것은 커밋이 말한다). 라운드 93 E가 같은 자리에서 같은 구별을 했다.
    const before = read(RETEST_DOC);
    const table = retestTableIn(before);
    expect(table, "표가 있어야 해요").not.toBeNull();
    for (const row of (table as RetestTable).rows) {
      retestRowHasNumber(row);
      retestRowNeedleKinds(row);
    }
    expect(read(RETEST_DOC).length, `${RETEST_DOC}가 이 자가 도는 동안 움직였어요`).toBe(before.length);
    expect(read(RETEST_DOC), `${RETEST_DOC}의 바이트가 달라졌어요`).toBe(before);

    // 이 축이 여는 문서는 **하나**이고, 그 하나는 라운드 93 E가 이미 읽기 전용으로 선언한 넷 안이다.
    expect(
      (COORDINATE_LIVE_DOCS as readonly string[]).includes(RETEST_DOC),
      `${RETEST_DOC}는 이 파일이 읽기 전용으로 선언한 문서가 아니에요`
    ).toBe(true);
  });

  // ── 재개 조건(AD-5) — **이 축의 것만** 적는다 ────────────────────────────────
  //  ① **수만 있는 스물넷이 다음 라운드에 얼마로 줄었는가** — F가 이번 라운드에 바늘을 붙이기
  //     시작하므로, 그 수가 이 축의 첫 물음이다. 줄면 `RETEST_NEEDLE_ROW_FLOOR`를 올릴지 정한다
  //     (⚠️ 올리는 순간 *바늘이 지워지는 것*도 처음으로 보이게 된다 — 하한을 올리는 비용이다).
  //     ⚠️⚠️ **답이 났다(HEAD 실측 · 라운드 94 리뷰)**: 스물넷이 **0**이 됐고 바늘이 적힌 행은
  //     **39**, 그 곁에 **명시적 무바늘이 1**이다. 하한은 이 라운드가 올리지 않는다 — 올리는 것은
  //     *바늘이 지워지는 것을 보겠다*는 별도의 결정이고, 그 판단은 다음 라운드의 것이다.
  //  ② **좌표꼴이 1인지 2인지** — 정찰의 손 판정(1)과 이 계약의 파서(2)가 줄 범위꼴
  //     (`…ledger.ts:702-704`)에서 갈렸다. **바늘을 맞출지 두 수로 남길지**가 결정형이다.
  //  ③ **바늘이 재현되는가**(사각 ⓐ) — 이 자는 앞쪽만 센다. 뒤쪽까지 무는 축은 *바늘을 실제로
  //     대어 보는* 자이고, 그 본보기는 위 `근거:` 인용 축(명령을 진짜로 돌린다)이다.
  //  ④ **앞선 절의 옛 표**(사각 ⓑ)는 오늘도 밖이다 — 넣을지는 소유가 아니라 *수의 안정성*이
  //     정한다(넣으면 라운드마다 통째로 흔들린다). ⚠️ **두 시점**: 트랙 E 시점 표 넷 · **92행** →
  //     HEAD 표 다섯 · **129행**이고, 라운드마다 한 표씩 그리로 내려간다는 사실이 그 답의 근거다.
});
