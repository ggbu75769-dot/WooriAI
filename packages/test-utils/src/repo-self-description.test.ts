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
