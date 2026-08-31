// 라운드 91 트랙 C (round91-scout #3) — **하네스가 재료 하나를 얻으려 전량 카탈로그를 받지 않는다.**
//
// ## 이 파일이 무는 것
//
// `GET /api/v1/children/:id/items?tab=now`는 **아이가 지금 볼 준비템 목록 전량**을 돌려준다.
// 그 목록이 **시험 대상**인 자리(탭 술어·정렬·상태 반영·밴드)는 그대로 옳다. 문제는 목록이
// 시험 대상이 아닌데도 **id 하나를 얻으려** 전량을 받는 자리다 — 이 스위트가 쓰는
// `wooriai_test`는 라운드마다 **누적**되고 지우는 걸음이 없어서(ⓔ), 그 응답은 라운드 82의
// 실측 2,651건에서 오늘 **2,818건 · 579,990바이트 · 왕복 ~220ms**까지 자랐다. 자라는 쪽은
// 시드가 아니라 **누적**이므로 이 비용은 앞으로도 는다.
//
// 라운드 91 트랙 C가 그 자리 **둘**(`expense-home-report.e2e.test.ts`)을 SQL 한 문장으로 바꿨다.
// ⚠️ 바꾼 것은 **어떻게 재료를 얻는가**뿐이고 *무엇을 확인하는가*(단언·기대값·나머지 요청)는
// 바이트 그대로다 — 라운드 82가 같은 축에서 세운 그 구별이다.
//
// ## ⚠️⚠️ 이 파일은 **저장소 그물이 아니다**
//
// 저장소 그물 **열다섯**(`packages/test-utils/src/contract-net-ledger.test.ts`가 세는 그 수)에
// 들지 않는다: 걷는 뿌리는 `apps/api/test/**` **하나**이고, `CONTRACT_NETS_BEFORE_THIS_ONE`도
// `CONTRACT_NET_COUNT_WITH_THIS_ONE`도 **export하지 않는다**(그 대장의 모집단 바늘이
// *줄머리의 `export const <이름>`* 이므로, 이 파일은 그 이름을 부르지도 않는다). 그 사실을
// 산문이 아니라 값으로 적는다 — `SCAN_ROOT_COUNT = 1`.
//
// ## 이 파일이 묻는 여섯
//
//  ⓐ **모집단** — `apps/api/test/**`에서 바늘 `tab=now`를 **전수로** 걷고, 그중 **요청 자리**를
//     요청 꼴로 가른다(바늘도 요청 꼴도 **값으로** 적는다).
//  ⓑ **판정 둘** — 자리마다 *목록이 시험 대상이다*(`subject`) / *재료 하나를 얻으려 전량을
//     받는다*(`material`)를 값으로 가른다. 판정표에 없는 자리는 **`material`로 센다**(fail-closed).
//  ⓒ **래칫** — `material`의 수는 **늘지 않는다**(오늘 0 · 새 자리가 붙는 날 빨개진다).
//  ⓓ **유령 방지** — 모집단이 0건이 아님을 값으로 보이고, **걸은 파일 수**를 함께 센다.
//  ⓔ **누적의 값** — 셋업이 정리를 **0건** 한다는 사실을 **부정 단언**으로 못 박는다(지우는
//     걸음이 생기는 날 이 자리가 **먼저** 빨개져 사람이 P3의 결정을 보게 된다).
//     ⚠️⚠️ **두 시점(리뷰 M-3)** — 라운드 91 C는 그 부정 단언을 **두 파일**(`global-setup.ts` ·
//     `helpers/test-db.ts`)에만 걸었다. 그 모양은 *"셋업이 부르는 것이 그 둘뿐인가"* 를 묻지
//     못해 **새 모듈 하나로 우회할 수 있었고**, 실제로 `helpers/shared-db-lock.ts`가 이미 그
//     밖에 있었다. 오늘은 `global-setup.ts`의 **상대 import를 전이적으로 따라간 파일 전수**
//     (`SETUP_CLOSURE`)에 같은 조항을 건다 — 손 목록이 아니라 파생이다.
//  ⓕ **사각** — 이 계약이 못 보는 것을 값과 재개 조건으로 적는다.
//
// ⚠️ **DB를 쓰지 않는다.** 전부 소스 대조라, PostgreSQL 없이도 초록이다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// 뿌리 — `apps/api/test/**` 하나 (셸 0건)
// ---------------------------------------------------------------------------

const TEST_ROOT = __dirname;

/** 걷는 뿌리의 수 — **하나**. 저장소 그물이 아니라는 사실을 값으로 적는 자리다. */
const SCAN_ROOT_COUNT = 1;

/** 이 파일 자신 — 바늘을 **값으로** 여러 번 적으므로 모집단에서 뺀다(자기 배제). */
const SELF_FILE = "harness-catalog-cost.test.ts";

/** 모집단 바늘 — **값으로 적는다.** ⚠️ `?tab=` 밖의 전량 조회는 이 바늘 밖이다(사각 ⓒ). */
const NEEDLE = "tab=now";

/**
 * 요청 꼴 — 바늘이 **실제로 목록 요청을 만드는** 두 자리 모양. 값으로 적는다.
 *  · `url`    — URL 리터럴에 바늘이 붙는다(`.../items?tab=now`).
 *  · `helper` — 스위트 안의 지역 헬퍼 `listItems("tab=now…")`(items-stage-band).
 * 이 둘에 들지 않는 비주석 occurrence는 **문구**(단언 메시지)로 센다 — 오늘 둘이고,
 * 아래 `CODE_MENTION_GUARD`가 그중 하나라도 URL을 짓고 있지 않은지 되묻는다.
 */
const REQUEST_SHAPES = [
  { name: "url", pattern: /items\?tab=now/ },
  { name: "helper", pattern: /listItems\(\s*[`"']tab=now/ }
] as const;

/** 주석 줄인가 — 주석에서 바늘을 부르는 자리는 요청이 아니다. */
function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

type Occurrence = {
  readonly file: string;
  /** 1부터 세는 줄 번호 — **사람이 찾아가는 용도이지 신원이 아니다**(줄은 밀린다). */
  readonly line: number;
  readonly text: string;
  readonly kind: "request" | "mention";
};

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      walk(abs, out);
    } else if (entry.endsWith(".ts") && entry !== SELF_FILE) {
      out.push(abs);
    }
  }
  return out;
}

const scannedFiles = walk(TEST_ROOT, []).sort();

const occurrences: Occurrence[] = [];
for (const abs of scannedFiles) {
  const file = relative(TEST_ROOT, abs);
  readFileSync(abs, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (!line.includes(NEEDLE)) return;
      const trimmed = line.trim();
      const kind =
        !isCommentLine(trimmed) && REQUEST_SHAPES.some((shape) => shape.pattern.test(line))
          ? "request"
          : "mention";
      occurrences.push({ file, line: index + 1, text: trimmed, kind });
    });
}

const requestSites = occurrences.filter((site) => site.kind === "request");
const mentions = occurrences.filter((site) => site.kind === "mention");

// ---------------------------------------------------------------------------
// ⓑ 판정표 — 자리마다 "목록이 시험 대상인가"
// ---------------------------------------------------------------------------

type Verdict = "subject" | "material";

/**
 * 파일 하나의 판정 — `sites`는 **소스 순서**의 배열이고, 항목은 `[판정, 발췌]`다.
 *
 * ⚠️ 발췌는 신원이 아니라 **증거**다(줄 번호는 밀리므로 쓰지 않는다): 그 자리의 줄이 이
 * 문자열을 담고 있어야 한다. 자리가 늘거나 순서가 바뀌면 배열 길이/발췌가 어긋나 빨개지고,
 * **표에 없는 자리는 `material`로 센다** — 그래서 새 전량 조회가 붙는 날 ⓒ 래칫이 운다.
 */
type FileJudgment = { readonly why: string; readonly sites: readonly (readonly [Verdict, string])[] };

const JUDGMENTS: Record<string, FileJudgment> = {
  "core-loop.e2e.test.ts": {
    why:
      "핵심 루프 e2e — 목록에서 시작해 상세·제휴 링크 클릭까지 잇는 **사슬 자체**가 시험 대상이라 " +
      "목록을 실제로 받아 보는 것이 그 자리의 뜻이다.",
    sites: [["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"]]
  },
  "items-commerce.e2e.test.ts": {
    why:
      "목록·탭·정렬·상태 반영이 곧 시험 대상인 스위트다(탭 술어, 추천 순서, 상태 변경 뒤 목록에서 " +
      "빠지는가, 네 탭이 서로소인가). 목록을 받지 않으면 확인할 것이 남지 않는다.",
    sites: [
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", "const nowItems = (await authorized(`/api/v1/children/${childId}/items?tab=now`))"],
      ["subject", "const nowAfter = (await authorized(`/api/v1/children/${childId}/items?tab=now`))"],
      ["subject", "const nowItems = (await authorized(`/api/v1/children/${childId}/items?tab=now`))"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"]
    ]
  },
  "items-stage-band.e2e.test.ts": {
    why:
      "ITEM-121 시기 밴드 스위트 — `tab=now`가 밴드 유무에 따라 **어떤 집합을 담는가**가 축이다. " +
      "밴드 없는 목록과 밴드 있는 목록을 서로 비교하므로 둘 다 전량이어야 뜻이 선다.",
    sites: [
      ["subject", 'const legacy = await listItems("tab=now");'],
      ["subject", 'expect(await listItems("tab=now")).toEqual(legacy);'],
      ["subject", 'const nextBand = await listItems("tab=now&stageBand=6-12개월");'],
      ["subject", 'const legacyIds = new Set((await listItems("tab=now")).map((item) => item.id));'],
      ["subject", 'const ownBand = await listItems("tab=now&stageBand=0-6개월");'],
      ["subject", 'const legacyIds = (await listItems("tab=now")).map((item) => item.id);'],
      ["subject", 'const now = await listItems("tab=now&stageBand=6-12개월");'],
      ["subject", 'const nowItems = await listItems("tab=now");'],
      ["subject", 'const target = (await listItems("tab=now&stageBand=6-12개월"))[0];'],
      ["subject", 'expect((await listItems("tab=now&stageBand=6-12개월")).map((item) => item.id))'],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now&stageBand=36개월`)"],
      ["subject", "const items = await listItems(`tab=now&stageBand=${encodeURIComponent(label)}`);"]
    ]
  },
  "onboarding.e2e.test.ts": {
    why:
      "온보딩 스위트가 목록을 받는 이유를 그 자리의 주석이 스스로 적는다 — *'화면이 실제로 쓰는 " +
      "목록과 같은 소스에서 진짜 id를 얻는다'*. 준비템 확정(prepared-items)이 **그 목록이 주는 " +
      "id**를 받아들이는가가 시험 대상이므로, 목록이 재료가 아니라 계약의 한쪽 끝이다.",
    sites: [
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"],
      ["subject", ".get(`/api/v1/children/${childId}/items?tab=now`)"]
    ]
  }
};

/**
 * ⚠️ **`expense-home-report.e2e.test.ts`는 표에 자리가 없다** — 라운드 91 C가 그 파일의 요청
 * 자리 **둘**을 없앴기 때문이다(전량 목록 → SQL 한 문장). 그래서 이 상수는 0이고, 그 파일에
 * `tab=now` 요청이 되살아나면 표에 없는 자리가 되어 `material`로 세어진다.
 */
const OWNED_FILE = "expense-home-report.e2e.test.ts";

/** 자리마다의 판정 — 표에 없으면 `material`(fail-closed). */
function verdictOf(site: Occurrence, indexInFile: number): Verdict {
  const judged = JUDGMENTS[site.file]?.sites[indexInFile];
  return judged ? judged[0] : "material";
}

const requestSitesByFile = new Map<string, Occurrence[]>();
for (const site of requestSites) {
  const list = requestSitesByFile.get(site.file) ?? [];
  list.push(site);
  requestSitesByFile.set(site.file, list);
}

const verdicts = [...requestSitesByFile.entries()].flatMap(([file, sites]) =>
  sites.map((site, index) => ({ site, file, verdict: verdictOf(site, index) }))
);
const materialSites = verdicts.filter((row) => row.verdict === "material");
const subjectSites = verdicts.filter((row) => row.verdict === "subject");

/**
 * ⓒ 래칫 — *재료 목적의 전량 조회* 수의 **상한**. 라운드 91 C가 둘을 0으로 만들었고, 이 값은
 * **내려갈 수는 있어도 올라갈 수 없다**(올리는 커밋은 그 자체가 리뷰의 대상이다).
 */
const MATERIAL_RATCHET = 0;

/**
 * ⓓ 유령 방지 하한 — 걷기가 통째로 깨지면 **판정을 세기 전에** 빨개진다.
 *
 * ⚠️ 무는 것은 **값이 아니라 하한**이다: 테스트 파일도 목록을 무는 자리도 라운드마다 늘 수 있고,
 * 등호로 물면 그 라운드의 트랙이 이 계약을 맞추게 된다(라운드 90 E가 `SCANNED_FLOOR`에 세운 규율).
 *
 * ⚠️ **오늘(2026-08-31 · 라운드 91 C 커밋 시점)의 실측** — 걸은 파일 **88**(자기 배제 뒤) ·
 * 바늘 `tab=now` occurrence **40** = 요청 자리 **28** + 문구 **12** · 그중 `material` **0**.
 *
 * ⚠️ **정찰의 수와 갈렸다**(전제 재실측 의무 · round91-scout 715~716행): 정찰은 `grep -c tab=now`
 * 한 값으로 **38**을 적고 그것을 *자리*로 세어 **36 / 2**로 갈랐다. 그 38에는 **주석과 단언
 * 메시지**가 함께 들어 있다. 이 계약은 그 둘을 **문구**로 떼어 내므로, 같은 뿌리를 걷고도
 * 트랙 전 요청 자리는 **30**(= 28 + 트랙이 없앤 둘)이고 트랙 뒤는 **28 / 0**이다. 갈린 것은
 * 사실이 아니라 *무엇을 자리로 세는가*이고, 판정 둘(36 vs 2 / 28 vs 0)의 **뜻은 같다**.
 */
const SCANNED_FILES_FLOOR = 60;
const REQUEST_SITES_FLOOR = 20;

// ---------------------------------------------------------------------------
// ⓔ 누적의 값 — 정리하는 걸음이 0건이라는 사실
// ---------------------------------------------------------------------------

/** 지우는 걸음의 낱말 — **값으로 적는다**(대소문자 무시). */
const DESTRUCTIVE_TOKENS = [
  "truncate",
  "deleteMany",
  "delete(",
  "drop table",
  "dropTable",
  "$executeRaw",
  "$executeRawUnsafe",
  "reset --force",
  "migrate reset"
] as const;

/** `helpers/test-db.ts`가 오늘 내보내는 이름 전수 — 정리 도우미가 **하나도 없다**. */
const TEST_DB_EXPORTS_TODAY = ["isDatabaseAvailable", "DB_READY_ENV_FLAG", "deployMigrations", "seedDatabase"] as const;

function readTestFile(...segments: string[]): string {
  return readFileSync(join(TEST_ROOT, ...segments), "utf8");
}

/**
 * 주석을 뗀 소스 — ⓔ의 부정 단언은 **코드**를 물어야 한다.
 *
 * ⚠️ 이 뗌이 없으면 계약이 첫날부터 거짓 빨강이다: `helpers/test-db.ts`의 마지막 문단이
 * *"Intentionally no table-truncate helper here"* 와 *"A blanket TRUNCATE would …"* 라고
 * **정리가 없는 이유를 산문으로** 적고 있고, 그 산문이야말로 이 계약이 지키려는 근거다.
 *
 * ⚠️⚠️ **두 시점(리뷰 L-2) — 종전 이 자는 문자열 안의 `//`도 주석으로 읽고 그 줄을 잘랐다.**
 * `줄.indexOf("//")` 한 걸음이라 **스킴 구분자가 든 접속 URL 리터럴**을 만나면 그 뒤를 통째로
 * 버렸고, 버려진 자리에 지우는 걸음이 숨으면 이 부정 단언이 조용해진다(오늘 실제로 잘리는
 * 자리는 접속 URL 둘이고 그 뒤에 낱말은 없지만, 0인 것은 오늘의 값이지 규율이 아니다).
 * 오늘은 **따옴표 상태를 세며** 걷는다 — 문자열 안은 보존하고 주석만 뗀다.
 */
function withoutComments(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | '"' | "'" | "`" = "code";
  while (index < source.length) {
    const char = source[index];
    const pair = source.slice(index, index + 2);
    if (state === "code") {
      if (pair === "//") {
        state = "line";
        index += 2;
        continue;
      }
      if (pair === "/*") {
        state = "block";
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") state = char;
      out += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      }
      index += 1;
      continue;
    }
    if (state === "block") {
      if (pair === "*/") {
        state = "code";
        index += 2;
      } else {
        if (char === "\n") out += char;
        index += 1;
      }
      continue;
    }
    // 문자열 안 — 내용을 **보존한다**(이 자가 뗄 것은 주석뿐이다).
    if (char === "\\") {
      out += source.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === state) state = "code";
    out += char;
    index += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// ⓔ의 모집단 — ⚠️⚠️ 손 목록이 아니라 **global-setup의 상대 import 폐포**(리뷰 M-3)
// ---------------------------------------------------------------------------

/** ⓔ가 시작하는 자리 — vitest가 실제로 부르는 그 파일이다. */
const SETUP_ENTRY = "global-setup.ts";

/** 폐포의 하한 — 걷기가 깨져 한 파일만 남으면 **부정 단언을 세기 전에** 빨개진다. */
const SETUP_CLOSURE_FLOOR = 3;

/** 상대 명세를 이 뿌리 안의 파일로 푼다(`.ts` · `/index.ts` 둘 다 본다 · 뿌리 밖이면 null). */
function resolveRelativeImport(fromRelative: string, specifier: string): string | null {
  const base = join(TEST_ROOT, fromRelative, "..");
  const target = join(base, specifier);
  for (const candidate of [`${target}.ts`, join(target, "index.ts"), target]) {
    try {
      if (!statSync(candidate).isFile()) continue;
    } catch {
      continue;
    }
    const rel = relative(TEST_ROOT, candidate).split("\\").join("/");
    if (rel.startsWith("..")) return null;
    return rel;
  }
  return null;
}

/**
 * ⚠️⚠️ **`global-setup.ts`에서 시작해 상대 import를 전이적으로 따라간 파일 전수.**
 *
 * 종전 ⓔ는 **두 파일**(`global-setup.ts` · `helpers/test-db.ts`)을 이름으로 적고 그 둘만 봤다.
 * 그 모양은 *"오늘 그 둘에 지우는 걸음이 없는가"* 만 묻고 *"셋업이 부르는 것이 그 둘뿐인가"* 는
 * 묻지 못한다 — **새 모듈 하나를 끼워 넣으면 지우는 걸음이 그 그물 밖으로 나간다**(오늘 이미
 * `helpers/shared-db-lock.ts`가 그 밖에 있었다). 오늘 그 손 목록을 지우고 **뿌리를 건다.**
 */
function setupModuleClosure(): readonly string[] {
  const seen: string[] = [];
  const queue: string[] = [SETUP_ENTRY];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (seen.includes(current)) continue;
    seen.push(current);
    const source = readFileSync(join(TEST_ROOT, current), "utf8");
    const specifiers = [
      ...[...source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)].map((match) => match[1]),
      ...[...source.matchAll(/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g)].map((match) => match[1]),
      ...[...source.matchAll(/\brequire\s*\(\s*["'](\.[^"']+)["']\s*\)/g)].map((match) => match[1])
    ];
    for (const specifier of specifiers) {
      const resolved = resolveRelativeImport(current, specifier);
      if (resolved !== null) queue.push(resolved);
    }
  }
  return seen.sort();
}

const SETUP_CLOSURE = setupModuleClosure();

// ---------------------------------------------------------------------------
// ⓕ 사각 — 이 계약이 **세지 않는** 것들
// ---------------------------------------------------------------------------

/**
 * ⚠️ **이 계약은 DB의 크기를 세지 않는다.** 아래는 이 컨테이너에서 2026-08-31에 `psql`로 읽은
 * **환경의 값**이지 소스의 값이 아니다 — 다른 환경에서는 다르고, 이 파일은 이 수들을 DB에
 * 대조하지 않는다(대조하면 소스 계약이 환경에 매인다).
 *
 * ⚠️ 라운드 91 C 재실측: 정찰(round91-scout)이 적은 **9,302 · 8,680 · 719MB**가 이 컨테이너에서
 * 그대로 재현됐다. 시드 준비템 **62**(`prisma/seed-data.ts`의 `itemTemplateSeeds`)도 그대로다.
 * 갈린 값은 하나다 — 라운드 82 주석의 `tab=now` **2,651건**이 오늘 **2,818건**이다.
 *
 * ⚠️ 재개 조건(사건형): 이 컨테이너 밖의 환경에서 이 수들이 다시 실측되는 날 — 그날 이 블록은
 * 그 환경의 값으로 다시 적힌다(계약은 그대로다 · 이 블록은 기록이지 약속이 아니다).
 * ⚠️ 재개 조건(결정형 · 손은 저장소 안): **공유 테스트 DB를 언제 무엇으로 비울지**를 P3가 정하는
 * 날 — 비우는 순간 *다른 스위트가 누적 위에서 초록인가*가 처음 시험되므로, 그 결정 전에
 * 아래 ⓔ가 먼저 빨개져 사람이 그 결정을 보게 한다.
 */
const MEASURED_ENVIRONMENT_2026_08_31 = {
  itemTemplatesTotal: 9302,
  itemTemplatesActive: 8680,
  databaseSizeMb: 719,
  seededItemTemplates: 62,
  tabNowItemsForInfant46: 2818,
  tabNowResponseBytes: 579990
} as const;

/**
 * ⚠️ **응답 시간을 세지 않는다.** 이 계약은 **소스 대조**다. 트랙 C의 개선(요청 둘의 소요
 * 656.9ms + 460.3ms → 406.9ms + 233.0ms)은 라운드 노트가 지는 실측이고, 여기서 재지 않는다 —
 * 시간을 물면 계약이 기계의 부하에 매여 간헐적으로 빨개진다.
 * ⚠️ 재개 조건(사건형): 하네스 소요가 릴리즈 게이트의 문턱이 되는 날 — 그날 그 문턱은 이
 * 계약이 아니라 **자기 축을 가진 계약**이 진다.
 *
 * ⚠️ **`?tab=` 밖의 전량 조회는 모집단 밖이다.** `tab=all`·`tab=prepared`·`tab=not_needed`·
 * `tab=soon`과 `/api/v1/home`의 추천 카드도 전량을 받지만, 이 계약의 바늘은 `tab=now` 하나다.
 * 그 수는 아래 `it`이 **세기만 하고 묻지 않는다**(래칫도 걸지 않는다).
 * ⚠️ 재개 조건(사건형): 다른 탭에서 *재료 목적의 전량 조회*가 처음 발견되는 날 — 그날 바늘이
 * 넓어진다.
 *
 * ⚠️ **셋째 요청 꼴은 모른다.** 오늘 요청 꼴은 둘(`url`·`helper`)이고, 새 지역 헬퍼가 목록을
 * 부르면 그 자리는 *문구*로 새어 이 계약이 조용할 수 있다. 그래서 `CODE_MENTION_GUARD`가
 * *문구로 샌 자리가 URL을 짓고 있지는 않은지*를 되묻는다(아래 ⓐ의 마지막 단언).
 */
const CODE_MENTION_GUARD = ["/api/v1", ".get("] as const;

// ---------------------------------------------------------------------------

describe("하네스 카탈로그 비용 계약 (라운드 91 트랙 C · round91-scout #3)", () => {
  it("ⓐ 모집단: 바늘과 요청 꼴을 값으로 적고, apps/api/test/** 전수에서 자리를 판다", () => {
    expect(NEEDLE).toBe("tab=now");
    expect(REQUEST_SHAPES.map((shape) => shape.name)).toEqual(["url", "helper"]);
    expect(SCAN_ROOT_COUNT).toBe(1);

    // 자기 배제가 유령이 아니다 — 이 파일이 실재하고, 모집단에서 빠져 있다.
    expect(readdirSync(TEST_ROOT)).toContain(SELF_FILE);
    expect(occurrences.map((site) => site.file)).not.toContain(SELF_FILE);

    // 요청 꼴 둘에 들지 않은 비주석 occurrence가 **URL을 짓고 있지는 않은지** 되묻는다.
    const leaked = mentions.filter(
      (site) => !isCommentLine(site.text) && CODE_MENTION_GUARD.some((token) => site.text.includes(token))
    );
    expect(
      leaked.map((site) => `${site.file}:${site.line}`),
      "요청 꼴 둘에 들지 않는데 URL을 짓는 자리가 생겼어요 — 셋째 요청 꼴이라면 REQUEST_SHAPES에 값으로 더해 주세요"
    ).toEqual([]);
  });

  it("ⓓ 유령 방지: 걸은 파일 수와 모집단이 0건이 아니다", () => {
    expect(scannedFiles.length).toBeGreaterThanOrEqual(SCANNED_FILES_FLOOR);
    expect(occurrences.length).toBeGreaterThan(0);
    expect(requestSites.length).toBeGreaterThanOrEqual(REQUEST_SITES_FLOOR);
    // 모집단은 요청 자리와 문구의 합이고, 셋이 서로 어긋나지 않는다.
    expect(requestSites.length + mentions.length).toBe(occurrences.length);
    // 자리가 한 파일에 몰려 있지 않다(걷기가 한 파일만 읽고 끝나지 않았다는 값).
    expect(new Set(requestSites.map((site) => site.file)).size).toBeGreaterThanOrEqual(3);
  });

  it("ⓑ 판정 둘: 모든 요청 자리가 판정표와 순서·발췌까지 맞는다", () => {
    for (const [file, sites] of requestSitesByFile) {
      const judgment = JUDGMENTS[file];
      expect(judgment, `판정표에 없는 파일에 ${NEEDLE} 요청이 생겼어요: ${file}`).toBeDefined();
      expect(judgment!.why.length, `${file}의 판정 근거가 비어 있어요`).toBeGreaterThan(0);
      expect(judgment!.sites.length, `${file}의 요청 자리 수가 판정표와 달라요`).toBe(sites.length);
      sites.forEach((site, index) => {
        expect(site.text, `${file}:${site.line} — 판정표의 발췌와 어긋나요`).toContain(judgment!.sites[index][1]);
      });
    }

    // 판정표에 실재하지 않는 파일이 남아 있지 않다(유령 항목 금지).
    for (const file of Object.keys(JUDGMENTS)) {
      expect(requestSitesByFile.has(file), `판정표의 ${file}에 오늘 ${NEEDLE} 요청 자리가 없어요`).toBe(true);
    }
  });

  it("ⓒ 래칫: 재료 목적의 전량 조회는 늘지 않는다 (오늘 0건)", () => {
    expect(
      materialSites.map((row) => `${row.site.file}:${row.site.line} ${row.site.text}`),
      "재료 하나를 얻으려 전량 카탈로그를 받는 자리가 생겼어요 — 목록이 시험 대상이라면 판정표에 " +
        "`subject`로 근거와 함께 적고, 아니라면 SQL 한 문장으로 재료만 얻어 주세요"
    ).toEqual([]);
    expect(materialSites.length).toBeLessThanOrEqual(MATERIAL_RATCHET);
    expect(subjectSites.length).toBe(requestSites.length);
  });

  it("ⓑ 트랙 C가 연 파일에는 목록 요청이 0건이다", () => {
    expect(requestSitesByFile.get(OWNED_FILE) ?? []).toEqual([]);
    expect(Object.keys(JUDGMENTS)).not.toContain(OWNED_FILE);
    // 그 파일은 여전히 재료를 얻는다 — SQL 한 문장 둘로(오늘 정확히 둘 · **하한만** 문다:
    // 그 파일에 다른 이유로 질의가 하나 더 서는 날 이 자리가 거짓 빨강이 되면 안 된다).
    const owned = readTestFile(OWNED_FILE);
    expect((owned.match(/\$queryRaw/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // ⚠️ 바꾼 것은 재료뿐이라는 증거 — 판정과 기대값은 그 자리에 그대로 있다.
    expect(owned).toContain('expect(linkedItem, "시드 준비템 중 최소 하나에는 구매 링크가 있어야 한다").toBeDefined();');
    expect(owned).toContain('expect(detail.productLinks?.length, "링크를 가진 항목의 상세가 판매처를 싣지 않았다")');
  });

  it("ⓔ 모집단: 셋업이 부르는 파일 전수를 **상대 import를 따라** 파생한다 (리뷰 M-3)", () => {
    // ⚠️ 유령 방지 — 폐포가 통째로 깨지면 아래 부정 단언이 조용해진다.
    expect(SETUP_CLOSURE.length).toBeGreaterThanOrEqual(SETUP_CLOSURE_FLOOR);
    expect(SETUP_CLOSURE).toContain(SETUP_ENTRY);
    // 손 목록 시절 이 그물이 보던 둘은 오늘도 안에 있고,
    expect(SETUP_CLOSURE).toContain("helpers/test-db.ts");
    // ⚠️⚠️ **그 둘 밖에 있던 셋째가 오늘 들어왔다** — 손 목록이었으면 몰랐을 자리다.
    expect(SETUP_CLOSURE).toContain("helpers/shared-db-lock.ts");
    for (const file of SETUP_CLOSURE) {
      expect(file.endsWith(".ts"), `${file}가 .ts가 아니에요`).toBe(true);
      expect(file.startsWith(".."), `${file}가 뿌리 밖이에요`).toBe(false);
    }
    // 손 목록이 아니다 — 폐포는 셋업의 import에서 나온다(그 사실을 소스가 진다).
    expect(withoutComments(readTestFile(SETUP_ENTRY))).toContain('from "./helpers/shared-db-lock"');
  });

  it("ⓔ 누적의 값: 셋업 폐포 전체가 정리를 0건 한다 (부정 단언)", () => {
    const testDbSource = readTestFile("helpers", "test-db.ts");
    const globalSetup = withoutComments(readTestFile(SETUP_ENTRY));

    for (const file of SETUP_CLOSURE) {
      const code = withoutComments(readTestFile(...file.split("/"))).toLowerCase();
      for (const token of DESTRUCTIVE_TOKENS) {
        expect(
          code.includes(token.toLowerCase()),
          `${file}에 지우는 걸음(${token})이 생겼어요 — 공유 테스트 DB를 언제 비울지는 ` +
            "**결정**이고 P3가 재개 조건과 함께 집니다. 이 자리를 초록으로 되돌리기 전에 그 결정을 " +
            "먼저 문서로 남겨 주세요(⚠️ 이 그물은 `global-setup.ts`의 상대 import를 따라간 파일 " +
            "전수를 봅니다 — 새 모듈로 우회할 자리가 없습니다)"
        ).toBe(false);
      }
    }

    // ⚠️ 문자열 보존을 픽스처로 보인다(리뷰 L-2): 스킴 구분자가 든 리터럴은 잘리지 않고,
    //    같은 줄의 진짜 주석만 떨어진다. ⚠️ 실제 접속 URL을 여기 적지 않는다 — DNC-019의
    //    비밀값 스윕이 그 모양을 문다(그 스윕이 이 자리를 가르쳐 주었다).
    const scheme = ["a", "//b"].join(":");
    expect(withoutComments(`const url = "${scheme}"; // 주석`)).toContain(`"${scheme}"`);
    expect(withoutComments(`const url = "${scheme}"; // 주석`)).not.toContain("주석");
    // 그리고 그 보존이 셋업 폐포에서도 참이다 — 잘린 자리가 없으니 아래 부정 단언이 온전하다.
    for (const file of SETUP_CLOSURE) {
      const raw = readTestFile(...file.split("/"));
      const stripped = withoutComments(raw);
      const rawQuotes = (raw.match(/"/g) ?? []).length;
      const strippedQuotes = (stripped.match(/"/g) ?? []).length;
      expect(strippedQuotes, `${file}: 주석을 떼며 문자열이 잘렸어요`).toBeLessThanOrEqual(rawQuotes);
      expect(strippedQuotes % 2, `${file}: 짝이 맞지 않는 따옴표가 남았어요`).toBe(0);
    }

    // globalSetup이 돌려주는 teardown은 락 디렉터리 정리 하나뿐이다(DB를 건드리지 않는다).
    const teardown = globalSetup.slice(globalSetup.lastIndexOf("return () => {"));
    expect(teardown).toContain("removeLockDir();");
    expect(teardown).not.toMatch(/prisma|\$queryRaw|DELETE|TRUNCATE/i);

    // 정리 도우미가 **export되지 않는다** — 이름 전수가 오늘 넷이고 그중 지우는 것이 없다.
    const testDb = withoutComments(testDbSource);
    const exported = [...testDb.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]);
    expect(exported.sort()).toEqual([...TEST_DB_EXPORTS_TODAY].sort());
    // 그 사실을 적어 둔 관례 문장도 그대로 선다(라운드 91 C는 이 문장을 근거로 인용한다).
    expect(testDbSource).toContain("Intentionally no table-truncate helper here");
  });

  it("ⓕ 사각: 세지 않는 것을 값으로 적는다", () => {
    // ⓐ DB의 크기 — 기록일 뿐, DB에 대조하지 않는다.
    for (const value of Object.values(MEASURED_ENVIRONMENT_2026_08_31)) {
      expect(value).toBeGreaterThan(0);
    }
    expect(MEASURED_ENVIRONMENT_2026_08_31.itemTemplatesActive).toBeLessThan(
      MEASURED_ENVIRONMENT_2026_08_31.itemTemplatesTotal
    );

    // ⓑ 응답 시간 — 이 파일은 요청도 질의도 한 번도 보내지 않는다(소스 대조라는 사실의 값).
    // ⚠️ 낱말을 문자열로 물으면 이 단언 자신이 그 낱말을 담아 거짓 빨강이 된다 — 그래서
    // **import 줄 전수**를 물어 이 파일이 무엇에도 의존하지 않음을 보인다(오늘 셋 — node:fs ·
    // node:path · vitest뿐이고, HTTP 클라이언트도 Prisma도 없다).
    const selfImports = [...readFileSync(join(TEST_ROOT, SELF_FILE), "utf8").matchAll(/^import .*$/gm)].map(
      (match) => match[0]
    );
    expect(selfImports).toHaveLength(3);
    expect(selfImports.every((line) => /from "node:(fs|path)";$|from "vitest";$/.test(line))).toBe(true);

    // ⓒ `?tab=` 밖의 전량 조회 — **세기만 하고 묻지 않는다**(래칫 없음).
    const otherTabs = scannedFiles.flatMap((abs) =>
      [...readFileSync(abs, "utf8").matchAll(/items\?tab=(\w+)/g)]
        .map((match) => match[1])
        .filter((tab) => tab !== "now")
    );
    expect(Array.isArray(otherTabs)).toBe(true);
    expect(NEEDLE).not.toContain("all");
  });
});
