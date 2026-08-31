// 라운드 88 트랙 C (GAP-088 #3) — **주석 관용 앵커 대장.**
//
// 앵커가 코드가 아니라 **주석 덕에 초록인 자리**가 저장소에 남아 있고, 그 규율에는 오늘까지
// **모집단이 0건**이었다. 이 파일이 그 모집단을 값으로 짓는다.
//
// ## ⚠️ 이 그물은 신설이다 — 열셋 밖이고, 서는 날 그 수는 열넷이 된다
//
// 라운드 88 정찰이 센 계약 그물은 **열셋**이다(라우트 표면 · 슬라이스 가드 · 오프라인 대장 ·
// 여정 스윕 · 체크표 자기집계 · 구독 대장 · `$transaction` 상한 대장 · 정책/무효화 대장 ·
// 미러 스윕 · DNC 가드 대장 · DNC 범위 대장 · DNC 비밀값 스윕 · 문장 수 계측). **이 대장은 그
// 열셋 중 하나가 아니라 열넷째다** — 트랙 C가 여는 것은 기존 그물이 아니라 **새 그물**이고,
// 그래서 "계약 그물을 둘 이상 함께 여는 트랙은 0건" 이라는 이 라운드의 교차 확인이 이 트랙에도
// 그대로 참이다(`CONTRACT_NETS_BEFORE_THIS_ONE` · `CONTRACT_NET_COUNT_WITH_THIS_ONE`).
//
// ## 자리는 완료 보고가 지목했다
//
// `apps/admin/src/admin-audit-logs.test.ts`의 `expect(rows).toContain("조건에 맞는 기록이 없어요.")`는
// `apps/admin/src/lib/audit-log-rows.ts`를 **원문 그대로** 읽었는데, 그 파일의 머리말이 같은 문장을
// 인용한다 — 그래서 **코드가 사라져도 초록**이었다. 옆 파일(`admin-load-error-copy.test.ts`)이
// 이미 옳은 형식을 갖고 있었다: **주석을 걷고 나서** 같은 문장을 찾고, 그 이유를 값으로 적는다 —
// *"파일만 바꾸고 주석을 함께 걷지 않으면 앵커가 자리만 옮긴 채 같은 이유로 초록이 된다."*
//
// ⚠️ **고칠 것은 주석이 아니라 앵커가 무엇을 보는가다.** 인용은 근거이고, 이 트랙은 제품 소스를
// **0건** 고쳤다.
//
// ## ⚠️ 먼저 모집단, 그다음 바늘 — 순서가 규율이다
//
// 라운드 85 E·86 E·87 E가 같은 자리에서 받은 경고 그대로다: *"그 둘을 정하지 않은 스윕은 첫날부터
// 면제 목록으로 산다."* 그래서 이 파일은 **무엇을 앵커로 볼 것인가**와 **대상 파일을 어떻게
// 푸는가**를 먼저 값으로 적는다.
//
//  · **뿌리**(`ANCHOR_ROOTS`) — 테스트 파일을 걷는 두 자리(`apps/admin/src` · `apps/mobile/src`).
//    뿌리마다 **왜 이 뿌리인가**가 빈 문자열일 수 없고, **테스트 파일 수와 풀린 단언 수 둘 다**
//    하한을 넘는지 계약이 확인한다(유령 방지 — 모집단이 0건이 아님을 값으로 보인다).
//    ⚠️ `apps/admin/app`·`apps/mobile/app`은 **대상 뿌리**이지 테스트 뿌리가 아니다
//    (오늘 그 아래에 `*.test.ts(x)`가 0건이다 — `TARGET_ROOTS`).
//  · **바늘**(`collectCommentToleranceAnchors`) — 소스 텍스트를 읽어
//    `expect(<주어>).toContain(<문자열 리터럴>)` 로 무는 단언만 센다. 주어가 대상 파일로 풀리는
//    길은 **둘뿐**이다: (a) `const x = readSource("…")` 로 **직접 묶인 변수**, (b) 그 자리에서
//    바로 부른 `expect(readSource("…")).toContain(…)`. ⚠️ **그 밖의 주어는 모집단이 아니다**
//    (사각 `helper-named-reader`).
//  · **대상 파일 해석**(`APP_ROOT_READ_SOURCE`) — `readSource(rel)`은 `join(<앱 루트>, rel)`이고
//    앱 루트는 `process.cwd()`다. ⚠️ 이 관례를 **가정하지 않고 파일마다 확인한다** — 헬퍼 몸통이
//    `join(<루트 상수>, relativePath)`이고 그 루트 상수가 `process.cwd()`로 선언돼 있을 때만
//    그 파일이 모집단에 들어온다. 오늘 그 확인에서 떨어진 파일이 하나 있고
//    (`design-system-restore.test.ts` — 루트가 `process.cwd()`가 아니다) 그 사실이 사각에 적혀 있다.
//
// ## 판정 셋
//
// 앵커마다 대상 파일을 **코드**와 **주석**으로 가른 뒤 셋으로 갈린다.
//
//  · `code-only` — 문장이 코드에만 있다(또는 앵커가 **주석을 걷고** 본다). **옳은 자리다.**
//  · `comment-tolerant` — 코드에도 주석에도 있고 앵커는 원문을 본다. **코드가 사라져도 초록이다.**
//    오늘 결함은 아니지만 **언제든 결함이 될 수 있는 자리**이고, 이 대장이 세는 것이 이 수다.
//  · `comment-only` — 주석에만 있다. **오늘 초록인 이유가 주석 하나뿐이다.**
//
// 넷째 값(`unanchored` — 코드에도 주석에도 없다)은 앵커가 이미 빨간 자리라 정상 저장소에서는
// 0건이어야 한다. 계약이 그 0을 확인한다(파서가 문장을 잘못 풀었다면 여기서 먼저 소리가 난다).
//
// ## ⚠️ 면제는 *주석에만*뿐이고, 이유와 증명을 진다
//
// `comment-only` 여덟은 **전부 의도된 인용 단언**이다 — 옆 계약이 무는 문장을 잃지 않으려고
// 소스에 남긴 인용이거나(`수정은 관리자(admin) 권한이 필요해요`), 이유·경계·후속 과제를 적어 둔
// 머리말이다. 그 사실이 **이 대장의 첫 값**이다(`QUOTATION_EXEMPTIONS`).
//
// 면제 줄은 셋을 진다:
//  ① `reason` — **빈 문자열일 수 없다**(계약이 길이를 잰다).
//  ② `provenBy` — 그 이유가 참임을 **소스로 확인한다**(라운드 84 트랙 D의 `provenBy` 관례).
//     ⚠️ **증명은 앵커가 무는 문장 자신일 수 없다** — 그러면 "주석에 있으니 주석에 있다"가 되고
//     아무것도 증명하지 않는다. 그래서 `provenBy.needle`은 그 인용을 **왜 남겼는지**를 적은 옆
//     문장이고, 계약이 그 조각이 대상 파일에 실재하는지와 앵커의 문장과 다른지를 함께 확인한다.
//  ③ `pairedCodeAbsence` — ⚠️ **"코드 부재 단언이 짝으로 있는가"**(`admin-write-role-gate.test.ts`가
//     세운 옳은 형식: *"주석에 인용이 남아 있다"* 와 *"코드에는 그 사본이 없다"* 를 한 짝으로).
//     여덟이 다 같은 모양은 아니라서 **짝의 종류를 값으로** 적고(같은 블록의 부정 단언 ·
//     다른 파일의 부정 단언 · 코드 쪽 수를 세는 단언), 그 짝이 실재하는지 계약이 확인한다.
//     ⚠️ 짝을 **없다**고 적는 것도 값이다 — 그런 줄은 다음 라운드가 먼저 집는다.
//
// 그리고 **유령 면제**를 막는다: 면제 줄은 오늘 실제로 `comment-only`로 걸리는 자리여야 한다.
// 걸리지 않게 되면(인용이 사라지거나 코드가 그 문장을 갖게 되면) 그 줄을 지우라고 계약이 빨개진다.
//
// ## ⚠️ 래칫 — 이 수는 늘지 않는다
//
// `comment-tolerant` 항목 수가 오늘의 실측(`COMMENT_TOLERANT_RATCHET`)보다 **늘지 않는다.**
// ⚠️ **다른 트랙이 계약을 고칠 때 이 수가 늘면 그 트랙이 아니라 이 대장이 먼저 빨개진다** —
// 그것이 이 그물의 값이다. 줄이는 것은 언제나 환영이고(고치면 이 상수를 함께 내린다), 늘리려면
// 이 파일을 열어 이유를 적어야 한다.
//
// ## ⚠️ 사각 — 이 수는 상한이 아니라 하한이다
//
// AB-5의 규율을 **태어날 때부터** 진다(`LEDGER_BLIND_SPOTS`). 이 대장이 세는 일흔은
// *"저장소에 주석 관용 앵커가 일흔 개 있다"* 가 아니라 *"이 모집단 안에서 일흔이
// 풀렸다"* 는 뜻이다. 밖에 남은 자리는 사각마다 **오늘 잰 하한과 함께** 적혀 있다 —
// 그중 가장 큰 것이 **이름이 다른 헬퍼로 읽는 테스트 파일 164개**이고,
// ⚠️ **`apps/admin/src/lib/analytics-trend-view.test.ts`(`readAdminSource`)가 그 안에 있다.**
//
// ## ⚠️ 전제 재실측 — 정찰의 쉰아홉과 일곱은 하한이었다
//
// 정찰(2026-08-31)이 손으로 잰 수는 **주석 관용 쉰아홉 · 주석에만 일곱**이었다. 이 트랙이 오늘
// 워킹트리에서 다시 세니 **일흔하나(고치기 전) · 여덟**이다. 갈린 이유는 `SCOUT_LOWER_BOUNDS`에
// 값으로 적었다 — **정찰의 수가 틀린 것이 아니라 하한이었고, 이 대장의 모집단이 그보다 넓다.**
// (라운드 87 트랙 E가 정찰의 열일곱을 열여섯으로 정정하며 세운 형식 그대로.)
//
// ⚠️ **두 시점**: 트랙 C 당시 이 줄은 *"일흔(고치기 전) · 여덟"* 이었다. 그 일흔은 정규식 리터럴을
// 다루지 못하던 `splitCodeAndComments`가 잰 수이고, **라운드 88 리뷰 H-1**이 그 처리를 이식한 뒤
// 같은 워킹트리에서 다시 재니 일흔하나다(저장소는 그 사이 한 글자도 달라지지 않았다 — 자가 고쳐졌다).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/**
 * 이 대장 자신의 두 파일.
 *
 * ⚠️ **대장은 자기를 모집단에 넣지 않는다.** 이 파일들에는 앵커의 모양(`expect(...).toContain(...)`)과
 * 면제된 문장들이 값과 설명으로 실려 있어서, 모집단에 들어오는 순간 이 계약은 자기 자신을
 * 세게 된다 — 그러면 다음 사람이 고치는 방법은 자기를 면제에 적는 것뿐이고, 그 순간 면제
 * 목록이 문을 연다(라운드 84 B·85 E가 같은 자리에 적은 규율).
 *
 * 오늘 이 배제는 **뿌리에서 이미 참이다**(두 파일 다 `packages/` 아래이고, 앵커 뿌리는
 * `apps/<앱>/src` 둘뿐이다). 그래도 값으로 적어 둔다 — 뿌리가 넓어지는 날 이 줄이 먼저 읽힌다.
 */
export const LEDGER_SELF_FILES = [
  "packages/test-utils/src/comment-tolerant-anchor-ledger.ts",
  "packages/test-utils/src/comment-tolerant-anchor-ledger.test.ts"
] as const;

/**
 * 이 대장이 서기 전의 계약 그물 열셋(라운드 88 정찰의 교차 확인 목록 그대로).
 *
 * ⚠️ 이 대장은 그 열셋 중 하나가 아니라 **열넷째**다.
 */
export const CONTRACT_NETS_BEFORE_THIS_ONE = [
  "라우트 표면",
  "슬라이스 가드",
  "오프라인 대장",
  "여정 스윕",
  "체크표 자기집계",
  "구독 대장",
  "$transaction 상한 대장",
  "정책/무효화 대장",
  "미러 스윕",
  "DNC 가드 대장",
  "DNC 범위 대장",
  "DNC 비밀값 스윕",
  "문장 수 계측"
] as const;

/** 이 대장이 서는 날의 수. */
export const CONTRACT_NET_COUNT_WITH_THIS_ONE = CONTRACT_NETS_BEFORE_THIS_ONE.length + 1;

// ── 뿌리 ──────────────────────────────────────────────────────────────────────

export type AnchorRoot = {
  /** 저장소 상대 경로 — 이 아래의 `*.test.ts(x)`를 걷는다. */
  readonly dir: string;
  /** 그 테스트 파일의 `readSource`가 상대 경로를 푸는 앱 루트. */
  readonly appRoot: string;
  /** 왜 이 뿌리인가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
  /** 오늘 실측한 모집단 테스트 파일 수의 하한(유령 방지). */
  readonly minTestFiles: number;
  /** 오늘 실측한 풀린 단언 수의 하한(유령 방지). */
  readonly minAnchors: number;
};

/**
 * 테스트 파일을 걷는 뿌리 둘.
 *
 * ⚠️ 하한은 **오늘의 실측보다 낮게** 잡는다 — 이 두 수는 *"모집단이 살아 있는가"* 를 묻지
 * *"오늘과 한 글자도 같은가"* 를 묻지 않는다(계약 파일이 하나 줄어도 이 그물이 먼저 빨개지면
 * 다음 라운드가 이 대장부터 고치게 되고, 그것은 그물이 아니라 족쇄다). **늘지 않을 것**을
 * 묻는 자리는 래칫 하나뿐이다.
 */
export const ANCHOR_ROOTS: readonly AnchorRoot[] = [
  {
    dir: "apps/admin/src",
    appRoot: "apps/admin",
    reason:
      "어드민의 계약 파일이 사는 유일한 자리이고, 이 후보를 연 자리(admin-audit-logs.test.ts)와 " +
      "옳은 형식의 본보기 둘(admin-load-error-copy.test.ts · admin-write-role-gate.test.ts)이 다 여기 있다.",
    minTestFiles: 15,
    minAnchors: 500
  },
  {
    dir: "apps/mobile/src",
    appRoot: "apps/mobile",
    reason:
      "모바일의 계약 파일이 사는 자리. 같은 관례(readSource + process.cwd())를 쓰므로 같은 그물에 " +
      "들어오고, 이 규율이 어드민만의 것이 아님을 값으로 보인다.",
    minTestFiles: 5,
    minAnchors: 80
  }
];

/**
 * 앵커가 **가리키는** 뿌리들 — 대상 파일이 사는 자리다(테스트 파일이 사는 자리가 아니다).
 *
 * ⚠️ `apps/admin/app`·`apps/mobile/app` 아래에는 오늘 `*.test.ts(x)`가 0건이다. 그래서 그 둘은
 * 앵커 뿌리가 아니라 대상 뿌리로만 산다 — 그 사실을 계약이 확인한다(스윕 뿌리를 넓힐지 말지의
 * 판단이 다음 라운드에 값으로 남는다).
 */
export const TARGET_ROOTS = ["apps/admin/src", "apps/admin/app", "apps/mobile/src", "apps/mobile/app"] as const;

export type ZeroYieldRoot = {
  readonly dir: string;
  readonly reason: string;
  /** 이 뿌리가 모집단에 들어와야 하는 날의 조건(사건형). */
  readonly reopenCondition: string;
};

/**
 * 정찰이 스윕 대상으로 적었지만 **오늘 앵커를 하나도 내놓지 않는** 뿌리.
 *
 * 유령 뿌리를 값 없이 목록에 두면 하한이 0인 뿌리가 생기고, 그 순간 ⓑ(유령 방지)가 뜻을 잃는다.
 * 그래서 그런 뿌리는 `ANCHOR_ROOTS`가 아니라 여기 선다 — 그리고 **왜 0건인지**를 계약이 확인한다.
 */
export const ZERO_YIELD_ROOTS: readonly ZeroYieldRoot[] = [
  {
    dir: "packages",
    reason:
      "packages/** 아래의 테스트 파일은 어느 것도 앱 루트에 묶인 readSource 헬퍼를 두지 않는다 " +
      "(저장소 뿌리 기준의 readRepoFile/readCallsiteSources 관례를 쓴다). 그래서 이 그물의 " +
      "대상 파일 해석 규칙이 적용될 자리가 0건이다 — 넓혀서 0을 세는 대신 이유를 적는다.",
    reopenCondition:
      "packages/** 의 테스트 파일이 `readSource(rel) = join(<앱 루트>, rel)` 관례를 쓰기 시작하는 날 — " +
      "그날 이 뿌리는 ANCHOR_ROOTS로 옮겨 가고 하한을 얻는다."
  }
];

// ── 소스 가르기 ────────────────────────────────────────────────────────────────

export type SplitSource = {
  /** 주석을 걷어낸 텍스트(문자열 리터럴·JSX 본문은 그대로 남는다). */
  readonly code: string;
  /** 주석 본문만 모은 텍스트. */
  readonly comments: string;
};

// ⚠️ 아래 셋(`REGEX_PREFIX_CHARACTERS` · `startsRegexLiteral` · `skipRegexLiteral`)은 트랙 D의
// `packages/test-utils/src/dead-export-ledger.ts`(`maskComments`가 쓰는 스캐너)에서 **그대로
// 이식한 사본**이다. 공유 헬퍼로 빼지 않은 이유는 하나다: **그 파일은 이번 리뷰(라운드 88 리뷰
// 픽스)의 범위 밖이고 바이트 불변이어야 한다** — 두 대장의 규율이 서로를 고치지 못하게 막으므로,
// 여기서는 복사가 답이다. ⚠️ 한쪽을 고치는 날 나머지 한쪽도 함께 본다(둘은 같은 판정을 진다).

/** 이 문자 뒤의 `/`는 나눗셈이 아니라 정규식 리터럴의 시작이다. (dead-export-ledger.ts 이식) */
const REGEX_PREFIX_CHARACTERS = new Set("(,=:[!&|?{};*%+-~^<>".split(""));
const REGEX_PREFIX_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await"
]);

/**
 * `/`가 정규식 리터럴을 여는가. (dead-export-ledger.ts 이식)
 *
 * 여는 자리를 놓치면 정규식 **안의** `"`·`'`·`//`가 문자열/주석으로 읽히고, 그 순간 이 스캐너가
 * 뒤따르는 진짜 주석을 코드로 흡수한다 — 라운드 88 리뷰 H-1이 잡은 결함이 정확히 그것이다.
 */
function startsRegexLiteral(source: string, slashIndex: number): boolean {
  let index = slashIndex - 1;
  while (index >= 0 && /\s/.test(source[index])) index -= 1;
  if (index < 0) return true;
  const previous = source[index];
  if (REGEX_PREFIX_CHARACTERS.has(previous)) return true;
  if (!/[\w$]/.test(previous)) return false;
  const wordEnd = index + 1;
  let wordStart = index;
  while (wordStart >= 0 && /[\w$]/.test(source[wordStart])) wordStart -= 1;
  return REGEX_PREFIX_KEYWORDS.has(source.slice(wordStart + 1, wordEnd));
}

/**
 * 정규식 리터럴의 끝(닫는 `/` 다음 자리). 줄을 넘으면 정규식이 아니다 — 나눗셈으로 읽는다.
 * (dead-export-ledger.ts 이식 — 문자 클래스 `[...]` 안의 맨몸 `/`도 여기서 지나간다.)
 */
function skipRegexLiteral(source: string, slashIndex: number): number | null {
  let index = slashIndex + 1;
  let inCharacterClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "\n") return null;
    if (character === "[") inCharacterClass = true;
    else if (character === "]") inCharacterClass = false;
    else if (character === "/" && !inCharacterClass) return index + 1;
    index += 1;
  }
  return null;
}

/**
 * `"`·`'` 문자열의 끝. **줄을 넘으면 문자열이 아니다**(JS 문법) — 그때는 `null`을 돌려 한 글자만
 * 넘어간다. (dead-export-ledger.ts 이식) ⚠️ 이 한 줄 가두기가 안전장치다: 오해가 나도 손상이
 * **그 줄**에 갇힌다(JSX 본문의 `don't` 같은 맨몸 아포스트로피가 뒤의 주석을 삼키지 못한다).
 */
function skipQuotedString(source: string, quoteIndex: number): number | null {
  const quote = source[quoteIndex];
  let index = quoteIndex + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "\n") return null;
    if (character === quote) return index + 1;
    index += 1;
  }
  return null;
}

type SplitState = { readonly source: string; code: string; comments: string };

/** 템플릿 리터럴 — `${…}` 안은 **코드로 되돌아가서** 훑는다(그 안의 주석은 주석이다). */
function scanTemplateLiteral(state: SplitState, backtickIndex: number): number {
  const { source } = state;
  let index = backtickIndex + 1;
  let segmentStart = backtickIndex;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") {
      state.code += source.slice(segmentStart, index + 1);
      return index + 1;
    }
    if (character === "$" && source[index + 1] === "{") {
      state.code += source.slice(segmentStart, index + 2);
      index = scanCodeRegion(state, index + 2, true);
      segmentStart = index;
      continue;
    }
    index += 1;
  }
  state.code += source.slice(segmentStart);
  return source.length;
}

/**
 * 코드 구간을 훑으며 주석을 걷어 낸다.
 *
 * `stopAtBrace`면 짝이 맞는 `}`를 지난 자리를 돌려준다 — 템플릿의 `${…}`가 이 모드로 들어온다.
 */
function scanCodeRegion(state: SplitState, start: number, stopAtBrace: boolean): number {
  const { source } = state;
  const n = source.length;
  let index = start;
  let braceDepth = 0;
  while (index < n) {
    const character = source[index];
    const next = source[index + 1];
    // ⚠️ `://`는 주석이 아니다 — JSX 본문에 맨몸으로 서는 URL(`https://…`)이 여기 걸리면
    // 이 스캐너가 진짜 화면 문구를 주석으로 옮긴다.
    if (character === "/" && next === "/" && source[index - 1] === ":") {
      state.code += "//";
      index += 2;
      continue;
    }
    if (character === "/" && next === "/") {
      let end = index + 2;
      while (end < n && source[end] !== "\n") end += 1;
      state.comments += `${source.slice(index + 2, end)}\n`;
      state.code += " ";
      index = end;
      continue;
    }
    if (character === "/" && next === "*") {
      const blockEnd = source.indexOf("*/", index + 2);
      const end = blockEnd === -1 ? n : blockEnd;
      state.comments += `${source.slice(index + 2, end)}\n`;
      state.code += " ";
      index = Math.min(end + 2, n);
      continue;
    }
    if (character === '"' || character === "'") {
      const end = skipQuotedString(source, index);
      if (end === null) {
        state.code += character;
        index += 1;
        continue;
      }
      state.code += source.slice(index, end);
      index = end;
      continue;
    }
    if (character === "`") {
      index = scanTemplateLiteral(state, index);
      continue;
    }
    if (character === "/" && startsRegexLiteral(source, index)) {
      const end = skipRegexLiteral(source, index);
      if (end === null) {
        state.code += character;
        index += 1;
        continue;
      }
      state.code += source.slice(index, end);
      index = end;
      continue;
    }
    if (stopAtBrace) {
      if (character === "{") braceDepth += 1;
      else if (character === "}") {
        if (braceDepth === 0) {
          state.code += "}";
          return index + 1;
        }
        braceDepth -= 1;
      }
    }
    state.code += character;
    index += 1;
  }
  return n;
}

/**
 * 소스를 **코드**와 **주석**으로 가른다.
 *
 * 본보기(`admin-load-error-copy.test.ts:730-733`)는 정규식 두 번으로 주석을 걷는다. 이 대장은
 * 같은 일을 **스캐너**로 한다 — 정규식은 문자열 안의 `/*`·`//`를 구별하지 못해서, 저장소 전체를
 * 훑는 자리에서는 판정을 조용히 뒤집을 수 있다. 스캐너가 지키는 것 다섯:
 *  ① 따옴표 셋(`"` `'` `` ` ``) 안은 코드로 남는다(이스케이프를 따라간다),
 *  ② `://` 는 주석의 시작이 아니다(JSX 본문에 맨몸으로 서는 URL — `https://…`),
 *  ③ 주석은 코드 쪽에 **공백 한 칸**으로 남아 앞뒤 토큰이 붙어 버리지 않는다,
 *  ④ **정규식 리터럴은 문자열도 주석도 아니다** — 문자 클래스 안의 `"`·`'`·`/`를 그대로 지나간다,
 *  ⑤ `"`·`'` 문자열은 **한 줄에 가둔다**(JS 문법) — 줄을 넘으면 문자열이 아니었던 것으로 읽는다.
 *
 * ## ⚠️ 두 시점 — ④·⑤가 없던 동안 이 스캐너는 판정을 조용히 뒤집고 있었다 (리뷰 H-1)
 *
 * **라운드 88 트랙 C 당시** 이 자리에는 *"⚠️ 한계: 정규식 리터럴 안의 문자 클래스에 맨몸 `/`가
 * 들어 있으면(`[/]`) 그 뒤가 잘못 잘릴 수 있다. 오늘 대상 파일 전수에 그런 자리는 없고(계약이
 * `unanchored` 0건으로 그 사실을 함께 확인한다)…"* 라고 적혀 있었다. **라운드 88 리뷰 H-1 이후**
 * 그 서술은 둘 다 거짓이다:
 *
 *  · 위험한 것은 맨몸 `/`만이 아니라 **문자 클래스 안의 따옴표**였다 —
 *    `apps/admin/src/lib/audit-log-csv.ts:43`의 `/[",\n\r]/`에서 이 스캐너가 **문자열 모드로
 *    들어가** 그 뒤의 주석을 코드로 흡수했고, 그래서 `:78`의 주석이 무는 `collectAuditLogsForExport`
 *    가 코드 쪽에서 발견돼 앵커가 `comment-tolerant`인데 `code-only`로 떨어졌다.
 *    ⚠️ **재실측이 리뷰의 전제 하나를 좁혔다**: 리뷰는 이 부류의 대상 파일을 **넷**
 *    (`audit-log-csv.ts` · `admin-api.ts` · `audit-log-rows.ts` · `worker-health-view.ts` —
 *    그 계약 파일이 무는 대상 전수)으로 적었지만, 고침 전후로 가르기 결과가 실제로 **달라진
 *    대상 파일은 `audit-log-csv.ts` 하나**이고(나머지 셋에는 문자 클래스 안 따옴표를 가진
 *    정규식이 0건이다) **뒤집힌 앵커도 하나**다. 리뷰의 넷은 *같이 봐야 할 자리*의 목록이었고
 *    실제 피해 자리는 그 안의 하나다 — 수를 그대로 옮겨 적지 않고 다시 세어 이 줄에 적는다.
 *  · ⚠️ **그리고 `unanchored` 0건은 그 사실을 확인하지 못한다.** 이 부류의 오분류는 문장을
 *    *코드 쪽에서* 찾아내므로 앵커는 여전히 초록이고 `unanchored`는 늘지 않는다 —
 *    0건은 이 부류에 대해 **아무것도 증명하지 않았다**. (`unanchored`가 잡는 것은 *문장을 아예
 *    못 찾는* 오해뿐이다.)
 *
 * 오늘 남은 한계는 좁다: 정규식으로 읽히는 나눗셈(`startsRegexLiteral`의 오판)과 줄을 넘는
 * 따옴표다. 둘 다 **한 줄에 갇힌다**(⑤) — 손상이 그 줄 밖으로 새지 않는다.
 */
export function splitCodeAndComments(source: string): SplitSource {
  const state: SplitState = { source, code: "", comments: "" };
  scanCodeRegion(state, 0, false);
  return { code: state.code, comments: state.comments };
}

// ── 리터럴 읽기 ────────────────────────────────────────────────────────────────

export type ParsedLiteral = { readonly value: string; readonly end: number };

/**
 * `start` 자리에서 시작하는 문자열 리터럴 하나를 읽는다.
 *
 * ⚠️ **보간이 있는 템플릿(`${…}`)은 리터럴이 아니다** — 앵커가 무는 문장이 소스에 있는지를
 * 정적으로 물을 수 없으므로 모집단 밖이다(사각 `non-literal-needle`).
 */
export function parseStringLiteral(source: string, start: number): ParsedLiteral | null {
  const quote = source[start];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  let j = start + 1;
  let raw = "";
  while (j < source.length) {
    const ch = source[j];
    if (ch === "\\") {
      raw += source.slice(j, j + 2);
      j += 2;
      continue;
    }
    if (ch === quote) break;
    if (quote === "`" && ch === "$" && source[j + 1] === "{") return null;
    if (ch === "\n" && quote !== "`") return null;
    raw += ch;
    j += 1;
  }
  if (j >= source.length) return null;
  try {
    const json = `"${raw.replace(/"/g, '\\"').replace(/\\'/g, "'").replace(/\r?\n/g, "\\n")}"`;
    return { value: JSON.parse(json) as string, end: j + 1 };
  } catch {
    return null;
  }
}

// ── 대상 파일 해석 ─────────────────────────────────────────────────────────────

/**
 * 모집단에 들어오는 `readSource` 헬퍼의 모양.
 *
 * `function readSource(rel) { … join(<루트 상수>, rel) … }` 또는
 * `const readSource = (rel) => … join(<루트 상수>, rel) …`. 잡은 루트 상수 이름이 그 파일에서
 * `process.cwd()`로 선언돼 있어야 한다(`APP_ROOT_DECLARATION`).
 */
export const APP_ROOT_READ_SOURCE =
  /(?:function\s+readSource\s*\([^)]*\)[^{]*\{|const\s+readSource\s*=\s*\([^)]*\)[^=]*=>)[\s\S]{0,240}?join\(\s*([A-Za-z_$][\w$]*)\s*,\s*relativePath\s*\)/;

/**
 * 이름이 다른 소스 리더의 정의(`readAdminSource` · `homeSource` · `parserSource` …).
 *
 * 사각 `helper-named-reader`의 하한을 이 바늘로 센다 — **파일 하나가 한 자리다**(그 안의 앵커를
 * 세지 않는다: 세려면 먼저 그 헬퍼의 루트를 풀 줄 알아야 하고, 그것이 이 사각의 정의다).
 */
export const NAMED_SOURCE_READER = /\b(?:function|const)\s+(read[A-Za-z]*Source|[a-z][A-Za-z]*Source)\s*[=(]/g;

/** 루트 상수가 `process.cwd()`인지. */
export function appRootDeclaration(rootConst: string): RegExp {
  return new RegExp(`\\bconst\\s+${rootConst}\\s*=\\s*process\\.cwd\\(\\)`);
}

/**
 * `readSource("…")` 뒤에 붙어 **주석을 걷는** 체인인지.
 *
 * 본보기가 세운 유일한 형식이다 — 두 번의 `.replace`로 블록 주석과 줄 주석을 각각 공백으로 바꾼다.
 * 이 체인이 붙은 앵커는 주석을 보지 않으므로 판정이 언제나 `code-only`다.
 */
export const COMMENT_STRIPPING_CHAIN = /^\s*(?:\r?\n\s*)*\.replace\(\s*\/\\\/\\[*/]/;

// ── 모집단 ────────────────────────────────────────────────────────────────────

export type AnchorVerdict = "code-only" | "comment-tolerant" | "comment-only" | "unanchored";

export type SubjectForm = "binding" | "inline";

export type CommentToleranceAnchor = {
  /** 저장소 상대 경로의 계약 파일. */
  readonly testFile: string;
  /** `expect(`가 시작하는 줄 번호(1부터). */
  readonly line: number;
  /** 주어가 풀린 길. */
  readonly subjectForm: SubjectForm;
  /** 앵커가 **주석을 걷은** 소스를 보는가. */
  readonly commentStripped: boolean;
  /** 저장소 상대 경로의 대상 파일. */
  readonly targetFile: string;
  /** 앵커가 무는 문자열. */
  readonly literal: string;
  readonly inCode: boolean;
  readonly inComments: boolean;
  readonly verdict: AnchorVerdict;
};

export type AnchorSweep = {
  readonly anchors: readonly CommentToleranceAnchor[];
  /** 모집단에 든 계약 파일(저장소 상대 경로). */
  readonly populationFiles: readonly string[];
  /** 뿌리 아래에서 본 `*.test.ts(x)` 전수. */
  readonly sweptTestFiles: readonly string[];
  /** 모집단 밖으로 갈린 자리 — 사각의 하한을 여기서 센다. */
  readonly outside: readonly OutsideAnchor[];
};

export type OutsideReason =
  | "helper-named-reader"
  | "derived-subject"
  | "app-root-convention"
  | "non-literal-needle"
  | "regex-anchor"
  | "unresolved-target";

export type OutsideAnchor = {
  readonly testFile: string;
  readonly line: number | null;
  readonly reason: OutsideReason;
  readonly detail: string;
};

function listTestFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name === "build") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listTestFiles(full, out);
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function toRepoPath(absolute: string, baseDir: string): string {
  return relative(baseDir, absolute).split(sep).join("/");
}

type Declaration = {
  readonly name: string;
  readonly index: number;
  readonly path: string | null;
  readonly stripsComments: boolean;
};

function collectDeclarations(text: string): Declaration[] {
  const declarations: Declaration[] = [];
  const declRe = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*/g;
  let match: RegExpExecArray | null;
  while ((match = declRe.exec(text)) !== null) {
    const name = match[1];
    const index = match.index;
    const after = text.slice(index + match[0].length);
    const call = /^readSource\(\s*(["'`])/.exec(after);
    if (!call) {
      declarations.push({ name, index, path: null, stripsComments: false });
      continue;
    }
    const literal = parseStringLiteral(after, call[0].length - 1);
    if (!literal || !after.slice(literal.end).startsWith(")")) {
      declarations.push({ name, index, path: null, stripsComments: false });
      continue;
    }
    declarations.push({
      name,
      index,
      path: literal.value,
      stripsComments: COMMENT_STRIPPING_CHAIN.test(after.slice(literal.end + 1))
    });
  }
  return declarations;
}

/** `expect(` 의 균형 잡힌 닫는 괄호 위치(못 찾으면 -1). */
function matchingClose(text: string, openEnd: number): number {
  let depth = 1;
  let k = openEnd;
  while (k < text.length && depth > 0) {
    const ch = text[k];
    if (ch === '"' || ch === "'" || ch === "`") {
      const literal = parseStringLiteral(text, k);
      if (literal) {
        k = literal.end;
        continue;
      }
      k += 1;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    k += 1;
  }
  return depth === 0 ? k - 1 : -1;
}

/** `expect(<주어>, <메시지>)` 에서 주어만 남긴다(최상위 콤마에서 자른다). */
function firstArgument(inner: string): string {
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if (ch === '"' || ch === "'" || ch === "`") {
      const literal = parseStringLiteral(inner, i);
      if (literal) i = literal.end - 1;
    } else if (ch === "," && depth === 0) return inner.slice(0, i).trim();
  }
  return inner.trim();
}

/**
 * 모집단 전수 스윕.
 *
 * ⚠️ 이 함수가 **모집단의 결정 그 자체**다 — 여기서 걸러진 자리는 전부 `outside`로 나가고,
 * 사각의 하한은 그 목록에서 센다(손으로 적은 수가 아니다).
 */
export function collectCommentToleranceAnchors(baseDir: string = repoRoot): AnchorSweep {
  const anchors: CommentToleranceAnchor[] = [];
  const outside: OutsideAnchor[] = [];
  const populationFiles: string[] = [];
  const sweptTestFiles: string[] = [];
  const targetCache = new Map<string, SplitSource | null>();

  const selfFiles = new Set<string>(LEDGER_SELF_FILES);

  for (const root of ANCHOR_ROOTS) {
    for (const absolute of listTestFiles(join(baseDir, root.dir))) {
      const testFile = toRepoPath(absolute, baseDir);
      if (selfFiles.has(testFile)) continue;
      sweptTestFiles.push(testFile);
      const text = readFileSync(absolute, "utf8");

      const helper = APP_ROOT_READ_SOURCE.exec(text);
      if (!helper) {
        const named = [...text.matchAll(NAMED_SOURCE_READER)].map((hit) => hit[1]).filter((name) => name !== "readSource");
        if (named.length > 0) {
          outside.push({
            testFile,
            line: null,
            reason: "helper-named-reader",
            detail: `readSource(<앱 루트>, rel) 관례가 아닌 리더로 읽는다: ${[...new Set(named)].slice(0, 4).join(", ")}`
          });
        }
        continue;
      }
      if (!appRootDeclaration(helper[1]).test(text)) {
        outside.push({
          testFile,
          line: null,
          reason: "app-root-convention",
          detail: `루트 상수 ${helper[1]}가 process.cwd()로 선언돼 있지 않다`
        });
        continue;
      }

      populationFiles.push(testFile);
      const declarations = collectDeclarations(text);
      const expectRe = /\bexpect\(/g;
      let match: RegExpExecArray | null;
      while ((match = expectRe.exec(text)) !== null) {
        const openEnd = match.index + match[0].length;
        const close = matchingClose(text, openEnd);
        if (close < 0) continue;
        const line = text.slice(0, match.index).split("\n").length;
        const rest = text.slice(close + 1);
        const toContain = /^\s*\.toContain\(\s*/.exec(rest);
        if (!toContain) {
          if (/^\s*\.toMatch\(/.test(rest)) {
            outside.push({ testFile, line, reason: "regex-anchor", detail: "toMatch 정규식 앵커" });
          }
          continue;
        }
        const needle = parseStringLiteral(text, close + 1 + toContain[0].length);
        if (!needle) {
          outside.push({
            testFile,
            line,
            reason: "non-literal-needle",
            detail: "toContain 인자가 변수·상수·보간 템플릿이다"
          });
          continue;
        }

        const subject = firstArgument(text.slice(openEnd, close));
        let targetPath: string | null = null;
        let stripsComments = false;
        let subjectForm: SubjectForm = "binding";
        if (/^[A-Za-z_$][\w$]*$/.test(subject)) {
          const candidates = declarations.filter((d) => d.name === subject && d.index < match!.index);
          const declaration = candidates.length > 0 ? candidates[candidates.length - 1] : null;
          if (!declaration || declaration.path === null) {
            outside.push({
              testFile,
              line,
              reason: "derived-subject",
              detail: `주어 ${subject}가 readSource("…")에 직접 묶인 변수가 아니다`
            });
            continue;
          }
          targetPath = declaration.path;
          stripsComments = declaration.stripsComments;
        } else {
          const inline = /^readSource\(\s*(["'`])/.exec(subject);
          const literal = inline ? parseStringLiteral(subject, inline[0].length - 1) : null;
          if (!literal) {
            outside.push({
              testFile,
              line,
              reason: "derived-subject",
              detail: "주어가 다른 헬퍼이거나 파생 조각이다"
            });
            continue;
          }
          targetPath = literal.value;
          stripsComments = COMMENT_STRIPPING_CHAIN.test(subject.slice(literal.end + 1));
          subjectForm = "inline";
        }

        const targetFile = `${root.appRoot}/${targetPath}`;
        let split = targetCache.get(targetFile);
        if (split === undefined) {
          const targetAbsolute = join(baseDir, root.appRoot, targetPath);
          split =
            existsSync(targetAbsolute) && statSync(targetAbsolute).isFile()
              ? splitCodeAndComments(readFileSync(targetAbsolute, "utf8"))
              : null;
          targetCache.set(targetFile, split);
        }
        if (split === null) {
          outside.push({
            testFile,
            line,
            reason: "unresolved-target",
            detail: `${targetPath}가 앱 루트에서 파일로 풀리지 않는다`
          });
          continue;
        }

        const inCode = split.code.includes(needle.value);
        const inComments = split.comments.includes(needle.value);
        const verdict: AnchorVerdict = stripsComments
          ? inCode
            ? "code-only"
            : "unanchored"
          : inCode && inComments
            ? "comment-tolerant"
            : inCode
              ? "code-only"
              : inComments
                ? "comment-only"
                : "unanchored";

        anchors.push({
          testFile,
          line,
          subjectForm,
          commentStripped: stripsComments,
          targetFile,
          literal: needle.value,
          inCode,
          inComments,
          verdict
        });
      }
    }
  }

  return { anchors, populationFiles, sweptTestFiles, outside };
}

/** 판정별 수. */
export function countVerdicts(anchors: readonly CommentToleranceAnchor[]): Record<AnchorVerdict, number> {
  const counts: Record<AnchorVerdict, number> = {
    "code-only": 0,
    "comment-tolerant": 0,
    "comment-only": 0,
    unanchored: 0
  };
  for (const anchor of anchors) counts[anchor.verdict] += 1;
  return counts;
}

// ── 면제 ──────────────────────────────────────────────────────────────────────

/**
 * "코드 부재 단언이 짝으로 있는가" 의 답 — **여덟이 다 같은 모양은 아니다.**
 *
 *  · `same-block-negative` — 같은 `it` 안에서 그 파일의 **코드에 그 사본이 없음**을 부정 단언으로 세운다.
 *  · `cross-file-negative` — 그 짝이 **다른 계약 파일**에 있다(인용을 남긴 트랙이 그쪽이라서).
 *  · `code-side-count` — 부정 단언 대신 **코드 쪽의 수**를 세어 인용이 사본이 아님을 보인다.
 *  · `none` — ⚠️ 짝이 없다. 그것도 값이고, 다음 라운드가 먼저 집는 자리다.
 */
export type PairedCodeAbsenceKind = "same-block-negative" | "cross-file-negative" | "code-side-count" | "none";

export type QuotationExemption = {
  /** 인용 단언이 사는 계약 파일. */
  readonly testFile: string;
  /** 인용이 서 있는 대상 파일. */
  readonly targetFile: string;
  /** 앵커가 무는 문장. */
  readonly literal: string;
  /** 왜 이 인용이 의도된 것인가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
  /**
   * 그 이유의 증명 — 대상 파일에 실재해야 하는 조각.
   *
   * ⚠️ **앵커가 무는 문장과 같을 수 없다**(자기 증명 금지). 인용을 왜 남겼는지를 적은 옆 문장을
   * 가리킨다 — 그 문장이 사라지면 이 면제의 이유도 사라진 것이므로 계약이 빨개진다.
   */
  readonly provenBy: { readonly path: string; readonly needle: string };
  /** 코드 부재 단언의 짝. */
  readonly pairedCodeAbsence: {
    readonly kind: PairedCodeAbsenceKind;
    /** 짝이 사는 파일(`none`이면 빈 문자열). */
    readonly path: string;
    /** 그 파일에 실제로 있는 조각 — 계약이 소스로 확인한다(`none`이면 빈 문자열). */
    readonly needle: string;
  };
};

/**
 * *주석에만* 여덟 — **여덟 다 의도된 인용 단언이다.** 그 사실이 이 대장의 첫 값이다.
 *
 * ⚠️ 늘리려면 이 배열을 열고 이유와 증명을 적어야 한다. 줄이 오늘 실제로 `comment-only`로
 * 걸리지 않으면(유령 면제) 계약이 그 줄을 지우라고 빨개진다.
 */
export const QUOTATION_EXEMPTIONS: readonly QuotationExemption[] = [
  {
    testFile: "apps/admin/src/admin-audit-logs.test.ts",
    targetFile: "apps/admin/src/lib/admin-api.ts",
    literal: "IdempotencyInterceptor",
    reason:
      "FIX-118C의 후속 과제 표시다. 어드민 클라이언트는 서버 멱등키를 아직 붙이지 않으므로 그 이름이 " +
      "코드에 설 자리가 없고, 세 군데 주석이 '서버 쪽 장치가 이것이다'를 적어 둔다 — 앵커는 그 " +
      "후속 과제가 소스에서 사라지지 않았는지를 묻는다(코드로 옮겨 오는 날 판정이 code-only로 바뀐다).",
    provenBy: { path: "apps/admin/src/lib/admin-api.ts", needle: "서버 IdempotencyInterceptor가 읽는 헤더 이름" },
    pairedCodeAbsence: { kind: "none", path: "", needle: "" }
  },
  {
    testFile: "apps/admin/src/admin-categories-users-lookup.test.ts",
    targetFile: "apps/admin/app/categories/page.tsx",
    literal: "수정은 관리자(admin) 권한이 필요해요",
    reason:
      "ADM-127의 계약이 무는 캡션 문장이 상수(admin-role-copy.ts)로 올라가면서 화면에는 인용만 남았다. " +
      "그 인용은 화면에 서는 사본이 아니라 이 앵커가 문장을 잃지 않게 하려고 일부러 남긴 근거다.",
    provenBy: { path: "apps/admin/app/categories/page.tsx", needle: "위 인용은 ADM-127의 계약" },
    pairedCodeAbsence: {
      kind: "cross-file-negative",
      path: "apps/admin/src/admin-write-role-gate.test.ts",
      needle: "expect(codeOnly(page)).not.toContain(ADMIN_WRITE_ROLE_NOTICE);"
    }
  },
  {
    testFile: "apps/admin/src/admin-link-price-share-wiring.test.ts",
    targetFile: "apps/admin/src/lib/link-price-view.ts",
    literal: "링크 정렬은 서버가 정하고",
    reason:
      "DNC-009(가격은 표시 전용)의 근거를 그 모듈 머리말이 진다. 정렬 판정이 이 모듈에 없다는 것이 " +
      "요점이므로 그 문장은 코드에 설 수 없고, 앵커는 그 경계 선언이 지워지지 않았는지를 묻는다.",
    provenBy: { path: "apps/admin/src/lib/link-price-view.ts", needle: "DNC-009: 이 값들은 표시 전용이다." },
    pairedCodeAbsence: {
      kind: "same-block-negative",
      path: "apps/admin/src/admin-link-price-share-wiring.test.ts",
      needle: 'expect(source).not.toContain("sort(");'
    }
  },
  {
    testFile: "apps/admin/src/admin-load-error-copy.test.ts",
    targetFile: "apps/admin/app/reviews/page.tsx",
    literal: "LOAD_ERROR_COPY_EXEMPT_SITES",
    reason:
      "한 벌을 부르지 않는 catch 자리가 '왜 문장을 세우지 않는가'를 대장으로 가리킨다. 화면은 그 " +
      "상수를 import하지 않으므로(부르면 면제가 아니게 된다) 이름이 주석에만 산다.",
    provenBy: {
      path: "apps/admin/app/reviews/page.tsx",
      needle: "src/lib/load-error-copy.ts의 LOAD_ERROR_COPY_EXEMPT_SITES에 값으로 적혀 있다"
    },
    pairedCodeAbsence: {
      kind: "code-side-count",
      path: "apps/admin/src/admin-load-error-copy.test.ts",
      needle: 'expect(reviews).toContain("setWorker(null);");'
    }
  },
  {
    testFile: "apps/admin/src/admin-load-error-copy.test.ts",
    targetFile: "apps/admin/app/page.tsx",
    literal: "scripts/qa/admin-e2e.mjs가 요약 카드를 article로 세고 있어서다.",
    reason:
      "요약 카드가 <article>로 남아야 하는 이유(하네스가 그것으로 센다)를 화면 주석이 진다. 그 이유는 " +
      "코드로 적을 수 없고, 같은 블록이 코드 쪽 사실(article 하나·카드 아홉·하네스의 기대 수)을 함께 센다.",
    provenBy: {
      path: "apps/admin/app/page.tsx",
      needle: "카드 껍데기는 링크 여부와 상관없이 <article>로 유지한다"
    },
    pairedCodeAbsence: {
      kind: "code-side-count",
      path: "apps/admin/src/admin-load-error-copy.test.ts",
      needle: "expect((home.match(/<article key=\\{card\\.key\\}/g) ?? []).length).toBe(1);"
    }
  },
  {
    testFile: "apps/admin/src/admin-write-error-copy.test.ts",
    targetFile: "apps/admin/src/lib/load-error-copy.ts",
    literal: "쓰기 실패는 이 모듈이 다루지 않는다",
    reason:
      "조회 문구 한 벌의 **경계 선언**이다. 쓰기를 다루지 않는다는 사실은 코드에 쓸 수 없고(없음을 " +
      "코드로 쓸 자리가 없다), 앵커는 그 경계가 오늘도 선언돼 있는지를 묻는다.",
    provenBy: {
      path: "apps/admin/src/lib/load-error-copy.ts",
      needle: "판정은 R19-F가 근거와 함께 세워 뒀다"
    },
    pairedCodeAbsence: {
      kind: "same-block-negative",
      path: "apps/admin/src/admin-write-error-copy.test.ts",
      needle: 'expect(load).not.toContain("write-error-copy");'
    }
  },
  {
    testFile: "apps/admin/src/admin-write-role-gate.test.ts",
    targetFile: "apps/admin/src/lib/admin-role-copy.ts",
    literal: "scrapeConstantTables",
    reason:
      "이 모듈이 미러 스윕의 스크레이프 단위가 **아닌** 이유를 머리말이 진다. 그 이유는 코드가 아니라 " +
      "설명이고, 같은 블록이 코드 쪽 사실(export 둘·배열/Record 없음)을 함께 센다.",
    provenBy: { path: "apps/admin/src/lib/admin-role-copy.ts", needle: "상수 표 전수 스크레이프" },
    pairedCodeAbsence: {
      kind: "same-block-negative",
      path: "apps/admin/src/admin-write-role-gate.test.ts",
      needle: "expect(codeOnly(module)).not.toMatch(/=\\s*[[{]/);"
    }
  },
  {
    testFile: "apps/admin/src/admin-write-role-gate.test.ts",
    targetFile: "apps/admin/app/categories/page.tsx",
    literal: "수정은 관리자(admin) 권한이 필요해요",
    reason:
      "⚠️ **의도된 인용 단언의 옳은 형식 그 자체다**: 같은 it이 '주석에 인용이 남아 있다'와 '코드에는 " +
      "그 사본이 없다'를 한 짝으로 세운 뒤, ADM-127이 찾는 조각이 그 인용 안에 있음을 묻는다.",
    provenBy: { path: "apps/admin/app/categories/page.tsx", needle: "위 인용은 ADM-127의 계약" },
    pairedCodeAbsence: {
      kind: "same-block-negative",
      path: "apps/admin/src/admin-write-role-gate.test.ts",
      needle: "expect(codeOnly(page)).not.toContain(ADMIN_WRITE_ROLE_NOTICE);"
    }
  }
];

// ── 래칫 ──────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **주석 관용 앵커 수의 상한.** 2026-08-31 워킹트리 실측 — 트랙 C가 `admin-audit-logs.test.ts`의
 * 두 앵커를 주석 걷은 소스로 옮기기 **전** 일흔하나였고, 옮긴 **뒤** 일흔이다.
 *
 * ## ⚠️ 두 시점 — 이 수는 라운드 88 리뷰 H-1이 정정한 값이다
 *
 * **트랙 C 당시**에는 *"전 일흔 · 뒤 예순아홉"* 이라고 적혀 있었다. 그 두 수는 **스캐너가
 * 틀린 채로 잰 값**이다 — `splitCodeAndComments`가 정규식 리터럴을 다루지 못해
 * `apps/admin/src/lib/audit-log-csv.ts`의 `/[",\n\r]/` 뒤 주석을 코드로 흡수했고, 그래서
 * `collectAuditLogsForExport` 앵커 하나가 `comment-tolerant`인데 `code-only`로 셌다.
 * **리뷰 H-1이 정규식 처리를 이식한 뒤** 같은 워킹트리를 다시 재니 **전 일흔하나 · 뒤 일흔**이다
 * (`code-only`도 621 → 620으로 함께 정정됐다). ⚠️ 참값이 바뀐 것이 아니라 **자가 고쳐졌다** —
 * 저장소는 그동안 한 글자도 달라지지 않았다.
 *
 * ⚠️ **늘리지 말 것.** 다른 트랙이 계약을 고치다 이 수를 늘리면 그 트랙이 아니라 이 대장이 먼저
 * 빨개진다 — 그것이 이 그물의 값이다. 고쳐서 줄었으면 이 상수를 **함께 내린다**(래칫은 한 방향으로만
 * 움직인다).
 */
export const COMMENT_TOLERANT_RATCHET = 70;

/**
 * 트랙 C가 손대기 전의 수 — 이 대장이 첫날 무엇을 하나 고쳤는지가 값으로 남는다.
 * (라운드 88 리뷰 H-1의 재실측값 — 당시 표기는 70이었다.)
 */
export const COMMENT_TOLERANT_BEFORE_THIS_TRACK = 71;

/** ⚠️ *주석에만*의 상한 = 면제 대장의 크기. 면제 없이 늘 수 없다. */
export const COMMENT_ONLY_RATCHET = QUOTATION_EXEMPTIONS.length;

// ── 사각 ──────────────────────────────────────────────────────────────────────

export type LedgerBlindSpot = {
  readonly id: OutsideReason | "swept-roots";
  /** 무엇이 모집단 밖인가. */
  readonly what: string;
  /** 왜 밖인가 — **빈 문자열일 수 없다.** */
  readonly why: string;
  /**
   * ⚠️ **오늘 잰 하한**(상한이 아니다). 스윕이 실제로 세는 수와 맞춰 확인한다 —
   * 손으로 적은 수는 다음 라운드에 조용히 낡는다.
   */
  readonly measuredLowerBound: number;
  /** 이 사각을 배워야 하는 날의 조건. */
  readonly reopenCondition: string;
};

/**
 * ⚠️⚠️ **이 대장의 수는 상한이 아니라 하한이다** (AB-5의 규율을 태어날 때부터).
 *
 * 일흔은 *"저장소에 주석 관용 앵커가 일흔 개뿐이다"* 가 아니라 *"이 모집단 안에서
 * 일흔이 풀렸다"* 는 뜻이다. 밖은 아래 다섯으로 갈리고, 하나하나가 오늘의 하한을 진다.
 */
export const LEDGER_BLIND_SPOTS: readonly LedgerBlindSpot[] = [
  {
    id: "helper-named-reader",
    what:
      "이름이 다른 헬퍼(readAdminSource · readRepoSource · readApiSource · <무엇>Source)로 소스를 " +
      "읽는 **계약 파일 전수**. ⚠️ apps/admin/src/lib/analytics-trend-view.test.ts(readAdminSource)가 " +
      "그 안에 있다 — 오늘 트랙 A가 고친 파일이다.",
    why:
      "그 헬퍼들의 루트가 앱 루트가 아닐 수 있다(readRepoSource는 저장소 뿌리다). 대상 파일 해석을 " +
      "가정하면 같은 상대 경로가 다른 파일을 가리키고 판정이 조용히 뒤집힌다 — 모집단을 정하기 " +
      "전에 바늘을 쓰지 않는다.",
    measuredLowerBound: 164,
    reopenCondition:
      "저장소가 소스 리더 이름을 한 벌로 모으는 날(또는 이 대장이 헬퍼 정의를 따라가 루트를 " +
      "푸는 법을 배우는 날) — 그날 이 하한이 모집단으로 들어온다."
  },
  {
    id: "derived-subject",
    what:
      "모집단 파일 **안에서** 주어가 파생 조각인 앵커(pageSource() · codeOnly(...) · 블록 잘라내기 · " +
      "다른 파일에서 import한 상수).",
    why:
      "주어가 하나의 대상 파일로 풀리지 않으면 코드/주석을 가를 소스가 없다. ⚠️ 이 자리들은 " +
      "**모집단 밖이지 안전한 것이 아니다** — pageSource()로 읽는 앵커도 주석 덕에 초록일 수 있다.",
    measuredLowerBound: 129,
    reopenCondition:
      "파일 안의 한 줄짜리 래퍼(const pageSource = () => readSource(\"…\"))를 따라가는 해석이 붙는 날 — " +
      "가장 큰 덩어리가 그 모양이라 하한이 크게 움직인다."
  },
  {
    id: "app-root-convention",
    what: "readSource라는 이름은 쓰되 루트가 process.cwd()가 아닌 계약 파일(design-system-restore.test.ts).",
    why:
      "대상 파일 해석 규칙이 다르면 같은 상대 경로가 다른 파일을 가리킨다. 관례를 **가정하지 않고 " +
      "확인하는** 쪽을 골랐고, 확인에 떨어진 파일은 세지 않는다(잘못 푼 판정보다 빈 자리가 낫다).",
    measuredLowerBound: 1,
    reopenCondition: "그 파일이 앱 루트 관례로 돌아오거나, 이 대장이 루트 상수의 식을 평가하는 법을 배우는 날."
  },
  {
    id: "non-literal-needle",
    what: "toContain 인자가 변수·상수·보간 템플릿인 앵커(모집단 파일 안에서만 잰 수).",
    why:
      "무는 문장이 소스에 있는지를 정적으로 물으려면 문장이 그 자리에 글자로 있어야 한다. " +
      "상수를 따라가는 것은 이 그물의 일이 아니다(미러 스윕이 그 축을 이미 갖고 있다).",
    measuredLowerBound: 90,
    reopenCondition: "같은 파일 안의 상수 정의를 따라가는 해석기가 이 대장에 붙는 날."
  },
  {
    id: "regex-anchor",
    what: "expect(<주어>).toMatch(<정규식>) 으로 무는 앵커.",
    why:
      "정규식은 '무슨 문장을 무는가'가 하나로 정해지지 않아 코드/주석 판정이 갈리지 않는다. " +
      "⚠️ 이 수는 expect() 바로 뒤의 toMatch만 센 것이라, 부정형(not.toMatch)까지 넣으면 더 크다.",
    measuredLowerBound: 13,
    reopenCondition: "정규식 앵커의 대상을 코드/주석 각각에 돌려 비교하는 판정이 이 대장에 붙는 날."
  },
  {
    id: "unresolved-target",
    what: "경로가 앱 루트에서 파일로 풀리지 않는 앵커(디렉터리 밖으로 나가는 join 등).",
    why: "대상이 없으면 판정할 것이 없다. 오늘 0건이고, 0도 값이다 — 늘어나는 순간 이 줄이 먼저 읽힌다.",
    measuredLowerBound: 0,
    reopenCondition: "이 수가 0을 넘는 날 — 그날 이 대장은 앱 루트 밖의 대상(scripts/** 등)을 배워야 한다."
  },
  {
    id: "swept-roots",
    what: "apps/api/** · packages/** · docs/** 의 계약 파일 전수.",
    why:
      "api는 소스 텍스트가 아니라 실 DB로 계약을 묻고, packages/**는 저장소 뿌리 기준의 리더를 쓴다 " +
      "(ZERO_YIELD_ROOTS). 뿌리를 넓히는 판단은 이 대장이 한 라운드를 살아남은 뒤의 일이다.",
    measuredLowerBound: 0,
    reopenCondition: "packages/** 의 테스트 파일이 앱 루트 관례의 readSource를 쓰기 시작하는 날."
  }
];

// ── 전제 재실측 ────────────────────────────────────────────────────────────────

export type ScoutLowerBound = {
  readonly what: string;
  /** 정찰(round88-scout.md)이 손으로 잰 수. */
  readonly scout: number;
  /** 트랙 C가 2026-08-31 워킹트리에서 다시 잰 수. */
  readonly remeasured: number;
  /** 갈린 이유 — **빈 문자열일 수 없다.** */
  readonly divergence: string;
};

/**
 * ⚠️ **정찰의 수는 하한이었다.** 트랙이 다시 세어 다른 수가 나왔으므로 그 수가 값이고, 갈린
 * 이유를 함께 적는다(라운드 87 트랙 E가 세운 형식 그대로).
 */
export const SCOUT_LOWER_BOUNDS: readonly ScoutLowerBound[] = [
  {
    what: "주석 관용 앵커(코드에도 주석에도 있어 코드가 바뀌어도 초록인 단언)",
    scout: 59,
    remeasured: 71,
    divergence:
      "정찰은 손으로 훑어 한국어 문장급을 중심으로 셌고(그 안의 열셋을 따로 적었다), 이 대장은 " +
      "같은 모집단 규칙을 기계로 돌려 식별자·경로·JSX 조각까지 함께 센다(AbortController · " +
      "/admin/users · x-nonce 같은 앵커가 그렇게 들어왔다). ⚠️ 정찰의 쉰아홉이 틀린 것이 아니라 " +
      "하한이었고, 오늘 A·B·D·E가 계약 파일을 고친 뒤에도 그 하한은 그대로 참이다. " +
      "트랙 C가 admin-audit-logs의 앵커 하나를 고쳐 오늘의 값은 일흔으로 내려간다. " +
      "⚠️ 두 시점: 트랙 C 당시 이 재실측값은 70(고친 뒤 69)이라고 적혀 있었지만 그것은 " +
      "정규식 리터럴을 못 다루던 스캐너가 잰 수였고, 라운드 88 리뷰 H-1이 그 처리를 이식해 " +
      "다시 재니 71(고친 뒤 70)이다 — 정찰의 쉰아홉이 하한이라는 판정은 두 시점 다 그대로 참이다."
  },
  {
    what: "주석에만 있어 오늘 초록인 단언(전부 의도된 인용 단언)",
    scout: 7,
    remeasured: 8,
    divergence:
      "정찰의 일곱과 이 대장의 여덟은 **판정이 갈린 것이 아니라 세는 자리가 하나 더 잡힌 것**이다 — " +
      "여덟째는 admin-write-role-gate.test.ts가 자기 인용 단언을 세우며 함께 무는 " +
      "'수정은 관리자(admin) 권한이 필요해요'로, 같은 문장을 admin-categories-users-lookup.test.ts도 " +
      "물어서 문장은 하나인데 앵커가 둘이다(정찰은 문장으로, 대장은 앵커로 센다). " +
      "⚠️ **여덟 다 의도적이라는 정찰의 판정은 재실측에서도 그대로 참이다.**"
  }
];
