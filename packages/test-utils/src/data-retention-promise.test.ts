// 라운드 75 트랙 B (GAP-075 #2) — "30일이면 지운다"는 약속의 숫자를 코드에 묶는 계약.
//
// 파기 잡(`data-retention-purge.job.ts`)의 `DEFAULT_*_RETENTION_DAYS` **여섯**이 우리가 남의
// 이름으로 한 약속의 단일 소스다. 그 여섯이 사람이 읽는 문서 셋(개인정보처리방침 · 계정 삭제
// 안내 · Play 데이터 안전 답안지)에 **손으로** 적혀 있는데, 오늘까지 그중 무엇도 계약이 읽지
// 않았다. `infra/legal/**`를 여는 테스트 셋은 전부 **색과 링크**만 본다. 무접촉이 무단언과
// 같은 말이 되어 버린 자리다.
//
// 이 파일이 묻는 것은 다섯이다.
//  ⓐ **상수 → 문서 방향** — 여섯을 파싱해, 각 값이 담당 문서의 **그 문장**에 그 숫자로 적혀
//     있는가(문서에서 값을 읽어 상수와 맞추는 반대 방향이 아니다. 상수가 단일 소스라는 사실이
//     방향으로 드러나야 한다).
//  ⓑ 방침이 다섯 창을 한 줄로 요약한 자리("기본값은 각각 …")가 상수 다섯과 **값도 순서도**
//     같은가(하나가 밀리면 전부 밀리는 문장이다).
//  ⓒ **전수 스윕** — 세 문서의 모든 기간 표현(N일·N년·N개월·N주·N시간)이 ① 상수 값의
//     되풀이이거나 ② 단위만 바꾼 재진술(2년 = 730일)이거나 ③ **이유와 함께 적은 면제**
//     셋 중 하나인가. 분류되지 않은 숫자는 빨갛다.
//  ⓓ `data-safety-answers.md`와 `privacy-policy.html`의 **보존 기간 숫자**가 같은가
//     (⚠️ 항목 이름 전수 대조는 하지 않는다 — 그건 법무 판단이다).
//  ⓔ 문서에만 있고 상수에 없어야 하는 자리(법령 보존 기간의 `[대괄호]` 자리표시자)가
//     숫자 없이 남아 있는가.
//
// ⚠️ **이 계약은 문서를 고치지 않는다.** 오늘 여섯은 전부 맞다(2026-08-30 실측). 그러니 이
// 파일은 `infra/legal/**`·`docs/store/**`를 **열어서 읽기만** 한다. 언젠가 빨개지면 그때
// 사람이 **법률 검토와 함께** 문서를 고친다 — 그것이 이 계약이 존재하는 이유다. 파기 잡 쪽도
// 마찬가지로 **읽기만** 한다(상수·로직·phase 순서·배치 상한 무접촉).
//
// 축 분리: `public-surface-brand.test.ts`가 같은 HTML을 **색** 축으로 읽는다. 이 파일은
// **숫자**를 진다. 한 파일에 두 축을 넣지 않는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const PURGE_JOB_PATH = "apps/api/src/worker/jobs/data-retention-purge.job.ts";
const PRIVACY_POLICY_PATH = "infra/legal/privacy-policy.html";
const ACCOUNT_DELETION_PATH = "infra/legal/account-deletion.html";
const DATA_SAFETY_PATH = "docs/store/data-safety-answers.md";

/** 사람이 읽는 문서 셋 — 이 계약이 여는 전부(읽기 전용). */
const PROMISE_DOCS = [PRIVACY_POLICY_PATH, ACCOUNT_DELETION_PATH, DATA_SAFETY_PATH] as const;
type PromiseDoc = (typeof PROMISE_DOCS)[number];

// ---------------------------------------------------------------------------
// 상수 여섯 (단일 소스)
// ---------------------------------------------------------------------------

/**
 * 잡 파일이 export한 `DEFAULT_*_RETENTION_DAYS`를 전부 파싱한다.
 *
 * 값을 여기에 손으로 적지 않는다 — 적는 순간 이 파일이 일곱 번째 사본이 된다.
 */
function parseRetentionConstants(): Map<string, number> {
  const source = read(PURGE_JOB_PATH);
  const found = new Map<string, number>();
  for (const match of source.matchAll(/^export const DEFAULT_([A-Z0-9_]+)_RETENTION_DAYS = (\d+);/gm)) {
    found.set(match[1], Number(match[2]));
  }
  return found;
}

const constants = parseRetentionConstants();

/** 오늘 존재하는 파기 창 여섯. 일곱 번째가 생기면 이 목록과 아래 주장 표가 함께 빨개진다. */
const EXPECTED_CONSTANT_NAMES = [
  "PURGE",
  "ANALYTICS_EVENTS",
  "AFFILIATE_CLICKS",
  "AUDIT_LOGS",
  "IMPORT_ROWS",
  "HOUSEHOLD_INVITES"
] as const;
type ConstantName = (typeof EXPECTED_CONSTANT_NAMES)[number];

function daysOf(name: ConstantName): number {
  const value = constants.get(name);
  if (value === undefined) throw new Error(`DEFAULT_${name}_RETENTION_DAYS를 ${PURGE_JOB_PATH}에서 찾지 못했다.`);
  return value;
}

// ---------------------------------------------------------------------------
// 문서 읽기 도우미
// ---------------------------------------------------------------------------

/** HTML 주석은 지우지 않고(그 안의 숫자도 스윕 대상이다) 태그만 지운다. `<style>`은 통째로 뺀다. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--/g, " ")
    .replace(/-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 문서 한 벌의 "사람이 읽는 본문" — 공백까지 눌러 한 줄로 만든 것(줄바꿈이 문장을 끊지 않도록). */
function plainText(path: PromiseDoc): string {
  const raw = read(path);
  return normalize(path.endsWith(".html") ? stripHtml(raw) : raw);
}

/**
 * 블록 종류.
 *
 * `cell`은 마크다운 표의 **답 칸**(둘째 셀)이다. 답안지의 한 행은 "문항 | 답 | 근거"인데,
 * 약속은 **답 칸**에만 있고 근거 칸은 코드 쪽 설명이다. 행 전체를 블록으로 삼으면 근거 칸의
 * 문장("감사 로그가 더 긴 이유는 …")까지 약속으로 세게 된다.
 */
type BlockKind = "li" | "td" | "p" | "line" | "cell";

/**
 * 문서에서 **한 창을 말하는 자리** 하나를 고른다.
 *
 * 파일 전체에서 숫자를 찾으면 "어딘가에 90이 있다"밖에 못 묻는다. 이 계약이 물어야 하는 것은
 * **그 문장이 그 숫자를 말하는가**이므로, 항상 블록을 먼저 고르고 그 안에서 본다.
 */
function blockContaining(path: PromiseDoc, kind: BlockKind, anchor: string): { text: string; offset: number } {
  const raw = read(path);
  const blocks: { text: string; offset: number }[] = [];
  if (kind === "line" || kind === "cell") {
    let offset = 0;
    for (const line of raw.split("\n")) {
      const text = normalize(line);
      if (kind === "line") {
        blocks.push({ text, offset });
      } else if (text.startsWith("|")) {
        const cells = text.split("|").map((cell) => cell.trim());
        // cells[0]은 첫 파이프 앞의 빈 문자열, cells[1]이 문항, cells[2]가 답이다.
        if (cells.length > 2) blocks.push({ text: `${cells[1]} | ${cells[2]}`, offset });
      }
      offset += line.length + 1;
    }
  } else {
    const pattern = new RegExp(`<${kind}\\b[^>]*>([\\s\\S]*?)</${kind}>`, "g");
    for (const match of raw.matchAll(pattern)) {
      blocks.push({ text: normalize(stripHtml(match[1])), offset: match.index ?? 0 });
    }
  }
  const hits = blocks.filter((block) => block.text.includes(anchor));
  if (hits.length !== 1) {
    throw new Error(
      `${path}의 <${kind}> 중 "${anchor}"를 담은 블록이 ${hits.length}개다(1개여야 한다). ` +
        "문서가 바뀌었다면 문서를 고치는 대신 이 계약의 표식을 사람이 다시 고른다."
    );
  }
  return hits[0];
}

// ---------------------------------------------------------------------------
// ⓐ 상수 → 문서 주장 표
// ---------------------------------------------------------------------------

type DocClaim = {
  /** 이 주장이 지는 상수. */
  constant: ConstantName;
  path: PromiseDoc;
  /** 블록 종류와, 그 문서에서 블록 하나를 유일하게 고르는 표식. */
  kind: BlockKind;
  blockAnchor: string;
  /** 숫자 **바로 앞**에 오는 문장 조각. 이 조각의 **모든** 출현 뒤에서 숫자를 찾는다. */
  cue: string;
  /** cue 끝에서 숫자까지 허용하는 거리(글자). 문장 하나를 넘지 않을 만큼만 준다. */
  within: number;
};

/**
 * 상수 여섯이 어느 문장에서 약속이 되는지. **주장 하나 = 테스트 하나**다.
 *
 * ⚠️ 값(30·730·400·400·90·90)은 여기 없다. 값은 잡 파일에서 온다.
 */
const DOC_CLAIMS: DocClaim[] = [
  // PURGE — 삭제 처리 후 유예 창. 셋이 같은 숫자를 약속한다.
  {
    constant: "PURGE",
    path: PRIVACY_POLICY_PATH,
    kind: "li",
    blockAnchor: "삭제 처리된 데이터(탈퇴한 계정",
    cue: "삭제 처리 후",
    within: 8
  },
  {
    constant: "PURGE",
    path: ACCOUNT_DELETION_PATH,
    kind: "p",
    blockAnchor: "삭제 처리된 데이터는",
    cue: "삭제 처리 후",
    within: 8
  },
  {
    constant: "PURGE",
    path: DATA_SAFETY_PATH,
    kind: "cell",
    blockAnchor: "삭제 요청 시 데이터 처리",
    cue: "삭제 처리 후",
    within: 12
  },
  // AUDIT_LOGS — 감사 기록.
  {
    constant: "AUDIT_LOGS",
    path: PRIVACY_POLICY_PATH,
    kind: "li",
    blockAnchor: "보안·책임 추적 기록(감사 기록)",
    cue: "생성일로부터",
    within: 16
  },
  {
    constant: "AUDIT_LOGS",
    path: DATA_SAFETY_PATH,
    kind: "cell",
    blockAnchor: "보관 기간이 따로 정해진 기록",
    cue: "감사 로그",
    within: 12
  },
  // ANALYTICS_EVENTS / AFFILIATE_CLICKS — 방침은 둘을 한 문장으로 묶어 약속한다.
  // 두 상수가 갈라지는 날 이 두 주장이 함께 빨개지고, ⓑ의 나열이 어느 쪽이 밀렸는지 말한다.
  {
    constant: "ANALYTICS_EVENTS",
    path: PRIVACY_POLICY_PATH,
    kind: "li",
    blockAnchor: "익명 통계(이용 통계) 및 제휴 링크 클릭 기록",
    cue: "각각 생성일로부터",
    within: 16
  },
  {
    constant: "AFFILIATE_CLICKS",
    path: PRIVACY_POLICY_PATH,
    kind: "li",
    blockAnchor: "익명 통계(이용 통계) 및 제휴 링크 클릭 기록",
    cue: "각각 생성일로부터",
    within: 16
  },
  {
    constant: "ANALYTICS_EVENTS",
    path: DATA_SAFETY_PATH,
    kind: "cell",
    blockAnchor: "보관 기간이 따로 정해진 기록",
    cue: "분석 이벤트·제휴 클릭",
    within: 12
  },
  {
    constant: "AFFILIATE_CLICKS",
    path: DATA_SAFETY_PATH,
    kind: "cell",
    blockAnchor: "보관 기간이 따로 정해진 기록",
    cue: "분석 이벤트·제휴 클릭",
    within: 12
  },
  // IMPORT_ROWS — 검수용 행. 방침은 §1 표와 §3 두 자리에서 같은 숫자를 약속한다.
  {
    constant: "IMPORT_ROWS",
    path: PRIVACY_POLICY_PATH,
    kind: "li",
    blockAnchor: "검수용 내역",
    cue: "확정한 시점",
    within: 14
  },
  {
    constant: "IMPORT_ROWS",
    path: PRIVACY_POLICY_PATH,
    kind: "td",
    blockAnchor: "가져오기를 확정한 뒤",
    cue: "확정한 뒤",
    within: 8
  },
  {
    constant: "IMPORT_ROWS",
    path: DATA_SAFETY_PATH,
    kind: "cell",
    blockAnchor: "보관 기간이 따로 정해진 기록",
    cue: "검수용 행",
    within: 8
  },
  // HOUSEHOLD_INVITES — 상태가 정해진 초대.
  {
    constant: "HOUSEHOLD_INVITES",
    path: PRIVACY_POLICY_PATH,
    kind: "li",
    blockAnchor: "가족 초대 내역",
    cue: "끝난 시점으로부터",
    within: 10
  },
  {
    constant: "HOUSEHOLD_INVITES",
    path: DATA_SAFETY_PATH,
    kind: "cell",
    blockAnchor: "보관 기간이 따로 정해진 기록",
    cue: "가족 초대 내역",
    within: 10
  }
];

/** cue의 **모든** 출현 뒤 `within` 글자 안에서 "N일"을 찾는다. 하나라도 비면 실패. */
function statedDaysAfterCue(blockText: string, cue: string, within: number): number[][] {
  const windows: number[][] = [];
  let from = 0;
  for (;;) {
    const at = blockText.indexOf(cue, from);
    if (at < 0) break;
    const start = at + cue.length;
    const slice = blockText.slice(start, start + within);
    windows.push([...slice.matchAll(/(?<![0-9])(\d+)\s*일/g)].map((m) => Number(m[1])));
    from = start;
  }
  return windows;
}

// ---------------------------------------------------------------------------
// ⓑ 방침이 다섯 창을 한 줄로 요약한 자리
// ---------------------------------------------------------------------------

/** "…기본값은 각각 730일·400일·400일·90일·90일입니다" — 이 순서가 상수 다섯의 순서다. */
const SUMMARY_ANCHOR = "기본값은 각각";
const SUMMARY_ORDER: ConstantName[] = [
  "AUDIT_LOGS",
  "ANALYTICS_EVENTS",
  "AFFILIATE_CLICKS",
  "IMPORT_ROWS",
  "HOUSEHOLD_INVITES"
];

/** 요약 문장이 가리키는 다섯 창이 방침 본문에서 나타나는 순서(같아야 한다). */
const SUMMARY_BLOCK_ANCHORS: Record<ConstantName, string | null> = {
  PURGE: null,
  AUDIT_LOGS: "보안·책임 추적 기록(감사 기록)",
  ANALYTICS_EVENTS: "익명 통계(이용 통계) 및 제휴 링크 클릭 기록",
  AFFILIATE_CLICKS: "익명 통계(이용 통계) 및 제휴 링크 클릭 기록",
  IMPORT_ROWS: "검수용 내역",
  HOUSEHOLD_INVITES: "가족 초대 내역"
};

// ---------------------------------------------------------------------------
// ⓒ 전수 스윕 — 기간 표현의 분류
// ---------------------------------------------------------------------------

/** 사람이 읽는 문서에서 "기간"으로 읽히는 모양 전부. 새 단위가 나타나면 분류되지 않아 빨개진다. */
const DURATION_PATTERN = /(\d+)\s*(일|년|개월|주|시간)/g;

type DurationHit = { path: PromiseDoc; value: number; unit: string; text: string; context: string };

/** 네 자리 이상의 "N년"은 기간이 아니라 **연도**다(예: 2024년부터 시행). 따로 세어 확인한다. */
function isCalendarYear(hit: { value: number; unit: string }): boolean {
  return hit.unit === "년" && hit.value >= 1000;
}

function sweepDurations(path: PromiseDoc): DurationHit[] {
  const text = plainText(path);
  const hits: DurationHit[] = [];
  for (const match of text.matchAll(DURATION_PATTERN)) {
    const at = match.index ?? 0;
    hits.push({
      path,
      value: Number(match[1]),
      unit: match[2],
      text: match[0],
      context: text.slice(Math.max(0, at - 90), at + 90)
    });
  }
  return hits;
}

/**
 * **단위만 바꾼 재진술** — 같은 창을 사람이 읽는 단위로 되풀이한 자리.
 *
 * 면제가 아니라 **환산해서 확인한다**: 상수가 움직이면 "2년"도 함께 빨개져야 한다. 그러지
 * 않으면 730 → 1000이 된 날 방침에 "2년(1000일)"이 남는다.
 */
type UnitRestatement = {
  path: PromiseDoc;
  unit: "년" | "개월";
  /** 이 재진술이 되풀이하는 상수. */
  constant: ConstantName;
  /** 그 자리를 고르는 문맥 표식(±90글자 안에 있어야 한다). */
  contextCue: string;
  /** 문서에서 이 재진술이 나타나는 횟수(정확히). */
  count: number;
  reason: string;
};

const UNIT_RESTATEMENTS: UnitRestatement[] = [
  {
    path: PRIVACY_POLICY_PATH,
    unit: "년",
    constant: "AUDIT_LOGS",
    contextCue: "변경 이력",
    count: 1,
    reason: "감사 기록 창을 사람이 읽는 단위로 되풀이한 값 — 같은 문장의 일 수와 함께 움직여야 한다."
  },
  {
    path: PRIVACY_POLICY_PATH,
    unit: "개월",
    constant: "ANALYTICS_EVENTS",
    contextCue: "제휴 링크 클릭 기록",
    count: 1,
    reason: "통계·제휴 클릭 창의 근사 표현(약 13개월) — 일 수와 한 달 안쪽에서 맞아야 한다."
  },
  {
    path: DATA_SAFETY_PATH,
    unit: "년",
    constant: "AUDIT_LOGS",
    contextCue: "감사 로그",
    count: 1,
    reason: "데이터 안전 답안지가 감사 기록 창을 연 단위로 되풀이한 값."
  },
  {
    path: DATA_SAFETY_PATH,
    unit: "개월",
    constant: "ANALYTICS_EVENTS",
    contextCue: "분석 이벤트",
    count: 1,
    reason: "데이터 안전 답안지의 근사 표현(≈13개월)."
  }
];

/** 근사 표현임을 사람에게 알리는 표식 — 개월 재진술에는 반드시 하나가 붙어 있어야 한다. */
const APPROXIMATION_MARKERS = ["약", "≈", "약칭"] as const;

/**
 * **면제** — 문서에 있으나 파기 창이 아닌 숫자. 이유 없이 비워 둘 수 없다.
 *
 * ⚠️ 값이 상수와 우연히 같아도(예: 고지 기간 30일) 여기 적힌 자리는 파기 창으로 세지 않는다.
 * 면제는 값이 아니라 **자리**에 붙는다.
 */
type Exemption = {
  path: PromiseDoc;
  contextCue: string;
  count: number;
  reason: string;
};

const EXEMPTIONS: Exemption[] = [
  {
    path: PRIVACY_POLICY_PATH,
    contextCue: "방침이 변경되는 경우 시행 최소",
    // 한 문장에 두 값(사전 고지 기한 · 중요한 변경의 고지 기한)이 들어 있다.
    count: 2,
    reason:
      "방침 개정의 사전 고지 기한 둘 — 보존 창이 아니라 공지 기한이다(코드에 대응 상수가 없다). " +
      "⚠️ 둘째 값은 삭제 유예 창과 숫자가 우연히 같을 뿐이므로, PURGE가 움직여도 이 숫자는 " +
      "따라 움직이면 안 된다. 그래서 면제는 값이 아니라 이 자리에 붙는다."
  }
];

/** 숫자가 **없어야** 하는 자리 — 법률 검토 전까지 자리표시자로 비워 둔 곳. */
type PlaceholderSite = { path: PromiseDoc; kind: BlockKind; blockAnchor: string; reason: string };

const PLACEHOLDER_SITES: PlaceholderSite[] = [
  {
    path: PRIVACY_POLICY_PATH,
    kind: "li",
    blockAnchor: "관계 법령이 보존을 요구하는 기록",
    reason: "적용 법령·기간은 법률 검토 시 확정 — 오늘 코드에 대응 상수가 없으므로 숫자를 적으면 안 된다."
  }
];

type Classification =
  | { kind: "constant-restatement" }
  | { kind: "unit-restatement"; entry: UnitRestatement }
  | { kind: "exempt"; entry: Exemption }
  | { kind: "calendar-year" }
  | { kind: "unclassified" };

const constantValues = new Set(EXPECTED_CONSTANT_NAMES.map((name) => constants.get(name)).filter((v): v is number => typeof v === "number"));

function classify(hit: DurationHit): Classification {
  if (isCalendarYear(hit)) return { kind: "calendar-year" };
  const unitEntry = UNIT_RESTATEMENTS.find(
    (entry) => entry.path === hit.path && entry.unit === hit.unit && hit.context.includes(entry.contextCue)
  );
  if (unitEntry) return { kind: "unit-restatement", entry: unitEntry };
  const exempt = EXEMPTIONS.find((entry) => entry.path === hit.path && hit.context.includes(entry.contextCue));
  if (exempt) return { kind: "exempt", entry: exempt };
  if (hit.unit === "일" && constantValues.has(hit.value)) return { kind: "constant-restatement" };
  return { kind: "unclassified" };
}

const allHits = PROMISE_DOCS.flatMap((path) => sweepDurations(path));

/** 문서 한 벌이 실제로 약속하는 보존 일수의 집합(면제·연도·단위 재진술을 뺀 것). */
function promisedDays(path: PromiseDoc): number[] {
  const days = allHits
    .filter((hit) => hit.path === path && classify(hit).kind === "constant-restatement")
    .map((hit) => hit.value);
  return [...new Set(days)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------

describe("파기 창 상수 여섯 (단일 소스)", () => {
  it(`${PURGE_JOB_PATH}가 export한 DEFAULT_*_RETENTION_DAYS가 정확히 여섯이다`, () => {
    // 일곱 번째가 생기는 날, 그 창의 약속이 어느 문서에 적히는지 사람이 여기서 정해야 한다.
    expect([...constants.keys()].sort()).toEqual([...EXPECTED_CONSTANT_NAMES].sort());
  });

  it("여섯 값이 모두 양의 정수다", () => {
    for (const name of EXPECTED_CONSTANT_NAMES) {
      const value = daysOf(name);
      expect(Number.isInteger(value), `${name}: ${value}`).toBe(true);
      expect(value, `${name}`).toBeGreaterThan(0);
    }
  });

  it("여섯 모두 담당 문서 주장을 하나 이상 가진다", () => {
    const covered = new Set(DOC_CLAIMS.map((claim) => claim.constant));
    expect([...covered].sort()).toEqual([...EXPECTED_CONSTANT_NAMES].sort());
  });
});

describe("ⓐ 상수 → 문서: 여섯이 담당 문장에 그 숫자로 적혀 있다", () => {
  for (const claim of DOC_CLAIMS) {
    it(`${claim.constant} → ${claim.path} (<${claim.kind}> "${claim.blockAnchor}")`, () => {
      const expected = daysOf(claim.constant);
      const block = blockContaining(claim.path, claim.kind, claim.blockAnchor);
      const windows = statedDaysAfterCue(block.text, claim.cue, claim.within);
      expect(windows.length, `"${claim.cue}"가 그 블록에 없다`).toBeGreaterThan(0);
      for (const stated of windows) {
        expect(
          stated,
          `${claim.path}의 "${claim.cue}" 뒤 ${claim.within}글자가 ${expected}일을 말하지 않는다. ` +
            "⚠️ 문서를 고치기 전에 법률 검토가 필요하다 — 상수를 바꾼 쪽이 원인일 수 있다."
        ).toContain(expected);
      }
    });
  }
});

describe("ⓑ 방침의 다섯 창 나열", () => {
  const summaryBlock = () => blockContaining(PRIVACY_POLICY_PATH, "li", SUMMARY_ANCHOR).text;

  it("나열된 다섯이 상수 다섯과 값도 순서도 같다", () => {
    const text = summaryBlock();
    const tail = text.slice(text.indexOf(SUMMARY_ANCHOR) + SUMMARY_ANCHOR.length);
    const listed = [...tail.matchAll(/(?<![0-9])(\d+)\s*일/g)].map((m) => Number(m[1]));
    expect(listed).toEqual(SUMMARY_ORDER.map((name) => daysOf(name)));
  });

  it("그 문장이 세는 창의 수와 나열의 길이가 같다", () => {
    const text = summaryBlock();
    expect(text).toContain("다섯");
    expect(SUMMARY_ORDER).toHaveLength(5);
  });

  it("나열 순서가 방침 본문에서 그 창들이 나오는 순서와 같다", () => {
    // 요약이 다섯을 한 줄로 접는 자리라, 본문 순서와 어긋나면 어느 하나가 밀린 것이다.
    const offsets = SUMMARY_ORDER.map((name) => {
      const anchor = SUMMARY_BLOCK_ANCHORS[name];
      if (anchor === null) throw new Error(`${name}은 요약 나열의 대상이 아니다.`);
      return blockContaining(PRIVACY_POLICY_PATH, "li", anchor).offset;
    });
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });
});

describe("ⓒ 전수 스윕: 세 문서의 모든 기간 표현이 분류된다", () => {
  it("분류되지 않은 기간 표현이 0건이다", () => {
    const unclassified = allHits
      .filter((hit) => classify(hit).kind === "unclassified")
      .map((hit) => `${hit.path}: "${hit.text}" — …${hit.context.trim()}…`);
    expect(unclassified).toEqual([]);
  });

  it("스윕이 실제로 세 문서를 열었다(빈 스윕 금지)", () => {
    for (const path of PROMISE_DOCS) {
      expect(allHits.filter((hit) => hit.path === path).length, path).toBeGreaterThan(0);
    }
  });

  it("단위만 바꾼 재진술이 상수 값으로 환산된다", () => {
    for (const entry of UNIT_RESTATEMENTS) {
      const hits = allHits.filter((hit) => {
        const result = classify(hit);
        return result.kind === "unit-restatement" && result.entry === entry;
      });
      expect(hits.length, `${entry.path} / ${entry.contextCue} / ${entry.unit}`).toBe(entry.count);
      const days = daysOf(entry.constant);
      for (const hit of hits) {
        if (entry.unit === "년") {
          // 연 단위는 정확히 맞아야 한다(730 = 2 × 365).
          expect(hit.value * 365, `${entry.path}: "${hit.text}" vs ${days}일`).toBe(days);
        } else {
          // 개월은 근사다 — "약/≈" 표식이 붙어 있고, 한 달 안쪽에서 맞아야 한다.
          expect(
            APPROXIMATION_MARKERS.some((marker) => hit.context.includes(marker)),
            `${entry.path}: "${hit.text}"에 근사 표식이 없다`
          ).toBe(true);
          expect(Math.abs(hit.value * (365 / 12) - days), `${entry.path}: "${hit.text}" vs ${days}일`).toBeLessThan(31);
        }
      }
    }
  });

  it("면제는 살아 있고, 이유가 비어 있지 않다", () => {
    for (const entry of EXEMPTIONS) {
      expect(entry.reason.trim().length, `${entry.path} / ${entry.contextCue}`).toBeGreaterThan(0);
      const hits = allHits.filter((hit) => {
        const result = classify(hit);
        return result.kind === "exempt" && result.entry === entry;
      });
      // 문서에서 사라진 면제는 다음 사람을 속인다 — 죽은 면제도 빨갛다.
      expect(hits.length, `${entry.path} / ${entry.contextCue}`).toBe(entry.count);
    }
    for (const entry of UNIT_RESTATEMENTS) {
      expect(entry.reason.trim().length, `${entry.path} / ${entry.contextCue}`).toBeGreaterThan(0);
    }
  });

  it("네 자리 연도는 기간으로 세지 않고, 실제로 연도다", () => {
    const years = allHits.filter((hit) => classify(hit).kind === "calendar-year");
    for (const hit of years) {
      expect(hit.value, `${hit.path}: "${hit.text}"`).toBeGreaterThanOrEqual(1900);
      expect(hit.value, `${hit.path}: "${hit.text}"`).toBeLessThanOrEqual(2999);
    }
  });

  it("ⓔ 법령 보존 기간 자리는 숫자 없이 자리표시자로 남아 있다", () => {
    for (const site of PLACEHOLDER_SITES) {
      expect(site.reason.trim().length).toBeGreaterThan(0);
      const block = blockContaining(site.path, site.kind, site.blockAnchor);
      expect([...block.text.matchAll(DURATION_PATTERN)].map((m) => m[0]), site.reason).toEqual([]);
      expect(block.text, site.reason).toMatch(/\[[^\]]+\]/);
    }
  });
});

describe("ⓓ 방침 ↔ 데이터 안전 답안지: 보존 기간 숫자가 같다", () => {
  it("두 문서가 약속하는 일수 집합이 서로, 그리고 상수와 같다", () => {
    // ⚠️ 항목 이름 전수 대조는 하지 않는다(법무 판단). 여기서 거는 것은 숫자 하나다.
    const fromConstants = [...constantValues].sort((a, b) => a - b);
    expect(promisedDays(PRIVACY_POLICY_PATH)).toEqual(fromConstants);
    expect(promisedDays(DATA_SAFETY_PATH)).toEqual(fromConstants);
  });

  it("계정 삭제 안내가 말하는 일수는 상수 값의 부분집합이다", () => {
    const stated = promisedDays(ACCOUNT_DELETION_PATH);
    expect(stated.length).toBeGreaterThan(0);
    for (const value of stated) expect(constantValues.has(value), `${value}일`).toBe(true);
  });

  it("두 문서가 서로를 짝으로 지목한 사실이 남아 있다", () => {
    // 한쪽만 고치는 것을 막는 유일한 장치가 오늘은 이 두 줄뿐이다(1:1 주장 자체는 법무 판단).
    expect(read(PRIVACY_POLICY_PATH)).toContain(DATA_SAFETY_PATH);
    expect(read(DATA_SAFETY_PATH)).toContain(PRIVACY_POLICY_PATH);
  });
});

/**
 * 라운드 75 적대적 리뷰 S-5 — **일곱 번째 사본**.
 *
 * P-2가 "여섯이 사람이 읽는 문서 **셋**에 손으로 적혀 있다"고 셌는데, 재어 보니 저장소 안에
 * 한 벌이 더 있었다: `scripts/check-env.ts`의 선택 카탈로그가 같은 여섯을 **note 문장**으로
 * 되풀이한다("기본 30(PRIV-105)" · "기본 400(SEC-130)" …). 그 문장은 `pnpm check:env`가
 * 운영자에게 그대로 출력하는 값이라, 상수가 바뀌고 note가 안 바뀌면 **배포 담당자가 틀린
 * 기본값을 읽는다.**
 *
 * 방향은 위와 같다 — **상수 → note**다. 숫자를 여기 손으로 적지 않는다.
 * ⚠️ `check-env.ts`는 **읽기만** 한다(카탈로그·문구 무접촉 — P-2의 그 판정 그대로).
 */
const CHECK_ENV_PATH = "scripts/check-env.ts";

describe("ⓕ 상수 → check:env note: 일곱 번째 사본도 같은 숫자를 말한다", () => {
  /** `{ key: "X", scope: "api", note: "…" }` 꼴에서 키별 note를 뽑는다(여러 줄 선언 허용). */
  const noteByKey = (): Map<string, string> => {
    const source = read(CHECK_ENV_PATH);
    const found = new Map<string, string>();
    for (const match of source.matchAll(/key:\s*"([A-Z0-9_]+)",[\s\S]{0,400}?note:\s*"((?:[^"\\]|\\.)*)"/g)) {
      if (!found.has(match[1])) found.set(match[1], match[2]);
    }
    return found;
  };

  it("여섯 override 키가 모두 카탈로그에 있고 note를 갖는다", () => {
    const notes = noteByKey();
    expect(notes.size, "check-env.ts에서 note를 하나도 읽지 못했다(파서가 낡았다)").toBeGreaterThan(10);
    for (const name of EXPECTED_CONSTANT_NAMES) {
      const key = `${name}_RETENTION_DAYS`;
      expect(notes.has(key), `${key}가 check:env 카탈로그에 없다`).toBe(true);
      expect(notes.get(key)!.trim().length, `${key}의 note가 비어 있다`).toBeGreaterThan(0);
    }
  });

  it("각 note가 그 상수의 기본값을 그 숫자로 말한다", () => {
    const notes = noteByKey();
    for (const name of EXPECTED_CONSTANT_NAMES) {
      const key = `${name}_RETENTION_DAYS`;
      const note = notes.get(key) as string;
      const stated = /기본\s*(\d+)/.exec(note)?.[1];
      expect(stated, `${key}의 note가 "기본 N" 꼴로 기본값을 말하지 않는다: ${note}`).toBeTruthy();
      expect(
        Number(stated),
        `${key}의 note가 말하는 기본값(${stated})이 상수 DEFAULT_${name}_RETENTION_DAYS(${daysOf(name)})와 다르다`
      ).toBe(daysOf(name));
    }
  });

  it("note가 말하는 다른 숫자를 상수 값으로 착각하지 않는다 (바늘 검증)", () => {
    // "기본 90(GAP-062 #8, …)"처럼 note에는 티켓 번호도 들어 있다 — 바늘은 "기본" 뒤의 수 하나다.
    expect(/기본\s*(\d+)/.exec("기본 90(GAP-062 #8, 만료·수락·취소된 가족 초대 행)")?.[1]).toBe("90");
    expect(/기본\s*(\d+)/.exec("기본 730(GAP-058 #10)")?.[1]).toBe("730");
  });
});
