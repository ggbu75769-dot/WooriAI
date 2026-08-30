// 라운드 78 트랙 E (GAP-078 #5) — "잘라 낸 구간이 실재하는지 먼저 묻는다"를 세우는 계약.
//
// 저장소의 소스 계약(테스트가 제품 소스를 문자열로 읽어 무엇이 있는지/없는지를 묻는 자리)은
// 거의 언제나 이 모양을 쓴다:
//
//   const 구간 = 소스.slice(소스.indexOf("<시작 표식>"), 소스.indexOf("<끝 표식>"));
//   expect(구간).not.toContain("<있으면 안 되는 것>");
//
// 표식이 사라지면 `indexOf`는 -1을 돌려주는데, `slice`는 -1을 **실패가 아니라 위치로** 읽는다.
// 실패 방향이 둘이고, 둘은 서로 다르게 위험하다.
//  · **끝점이 -1**이면 구간이 파일 끝까지 넓어진다 — 그물이 넓어지므로 언젠가 빨개질 수 있다
//    (라운드 77 리뷰 M-3이 만난 경우다. 답이 우연히 맞아 초록이었다).
//  · **시작점이 -1**이면 구간이 **빈 문자열**이 되고, 빈 문자열 위에서는 어떤 부정 단언도
//    통과한다 — 계약이 아무것도 검사하지 않은 채 **영원히 초록**이다. ⚠️ 뒤엣것이 더 조용하다.
//
// M-3은 그 자리 하나를 고쳤다(`src/commerce/purchase-followup-flow.test.ts`). 라운드 78 정찰이
// 같은 모양을 저장소 전체에서 세어 보니 일반형이었고, 트랙 E는 **가장 먼저 끊어질 자리 열둘**에
// 실재 확인을 세운 뒤(가드는 판정을 바꾸지 않는다 — 잘라 낸 구간은 바이트 그대로다) 나머지를
// 이 대장에 얼렸다. 이 파일이 묻는 것은 여섯이다(⑤·⑥은 라운드 78 리뷰가 더했다).
//  ① **전수 스윕 + 래칫**: 파일별 미가드 자리 수가 대장의 값보다 **늘지 않는다**.
//  ② **새 자리 금지**: 대장에 없는 파일에서 이 모양이 새로 나면 빨개진다.
//  ③ **가드 하한**: 라운드 77 M-3과 라운드 78 트랙 E가 세운 실재 확인이 조용히 사라지지 않는다.
//  ④ **두 실패 방향의 재현**: -1이 만드는 빈 구간·넓어진 구간을 픽스처로 실제로 보여 준다
//     (⚠️ 값이 주석에만 적히면 다음 사람이 그 사실을 다시 발견해야 한다).
//  ⑤ **유령 방지**(리뷰 P-1): 대장·하한의 키가 전부 실재하는 파일인가. 없는 파일을 가리키는
//     줄은 아무것도 막지 않으면서 "이미 얼려 둔 자리"로 읽힌다. 합계도 대장에서 **파생**한다.
//  ⑥ **인라인 자리 하한**(리뷰 M-4): `expect(…)` 안에서 곧바로 자른 자리를 그물이 잡는가.
//     그 그물이 없던 동안 `recommendation-order-mirror.test.ts`의 **DNC-009 부정 단언**이
//     스윕 밖에 있었다.
//
// ⚠️ 이 계약은 **수치를 줄 번호로 적지 않는다**. 단위는 `파일 → 개수`다 — 줄 번호로 적으면 그
// 파일을 여는 모든 트랙이 이 대장을 함께 고쳐야 하고, 그러면 대장이 병목이 된다.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

/**
 * 스윕 범위 — 정찰이 잰 그 범위 그대로다(모바일·어드민의 `src` + 워크스페이스 패키지 전부).
 * `apps/api`는 범위 밖이다: 서버 테스트는 소스를 문자열로 읽는 대신 실 PostgreSQL 위에서 돌고,
 * 오늘 그 워크스페이스에는 이 모양이 서지 않는다(범위를 넓히는 것은 다음 라운드의 결정이다).
 */
const SCAN_ROOTS = ["apps/mobile/src", "apps/admin/src", "packages"] as const;

type SliceGuardSite = {
  /** 잘라 낸 구간을 담는 상수 이름(인라인 자리는 `expect(<식>)` 안의 그 식이다). */
  readonly name: string;
  /** 시작·끝 두 자리 모두 이름 붙은 인덱스이고, 자르기 **전에** 실재를 물었는가. */
  readonly guarded: boolean;
  /** `const` 선언으로 담긴 자리인가, `expect(…)` 안에서 곧바로 자른 자리인가. */
  readonly inline: boolean;
};

function listTestFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.test\.tsx?$/.test(entry.name)) found.push(path);
    }
  };
  walk(join(repoRoot, root));
  return found.sort();
}

/** `(`에서 시작해 짝이 맞는 `)`까지를 읽는다 — 문자열 리터럴 안의 괄호는 세지 않는다. */
function readCallArguments(source: string, openIndex: number): { text: string; end: number } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return { text: source.slice(openIndex + 1, i), end: i };
    }
  }
  return null;
}

/** 최상위 쉼표로만 인자를 가른다(중첩 호출·객체·문자열 안의 쉼표는 가르지 않는다). */
function splitTopLevelArguments(argumentText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (let i = 0; i < argumentText.length; i += 1) {
    const char = argumentText[i];
    if (quote) {
      current += char;
      if (char === "\\") {
        current += argumentText[i + 1] ?? "";
        i += 1;
      } else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    if (char === ")" || char === "]" || char === "}") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts.map((part) => part.trim());
}

/** `indexOf`와 `lastIndexOf`는 같은 위험이다 — 둘 다 못 찾으면 -1을 돌려준다. */
const INDEX_CALL = /\b(?:lastIndexOf|indexOf)\s*\(/;
/** `const <이름> = <소스>.slice(` — `=`와 `.slice(` 사이에 `{`·`}`·`;`가 없는 것만 한 문장으로 본다. */
const SLICE_DECLARATION = /const\s+([A-Za-z0-9_$]+)\s*=\s*([^;{}]*?)\.slice\(/g;
/** 한 테스트의 경계 — 가드는 **같은 테스트 안**에서만 유효하다. */
const TEST_BOUNDARY = /\n\s{0,8}(?:it|test)(?:\.\w+)?\s*\(/g;
/** `expect(` 호출 자리 — 인라인 자르기는 이 인자 안에서 찾는다(라운드 78 리뷰 M-4). */
const EXPECT_CALL = /\bexpect\s*\(/g;
/** 인자 안의 `.slice(` 호출 자리. */
const SLICE_CALL = /\.slice\s*\(/g;
/** 정찰이 쓴 근접 창과 같은 값 — 자르는 자리에서 이만큼 앞까지가 "먼저 물었다"로 인정된다. */
const GUARD_WINDOW = 1500;

type SliceEndpoint = { readonly expression: string; readonly named: boolean };

/** `slice(` 인자 둘 가운데 **-1이 될 수 있는 자리**만 남긴다. */
function riskyEndpointsOf(argumentText: string, indexNames: ReadonlySet<string>): SliceEndpoint[] {
  return splitTopLevelArguments(argumentText)
    .slice(0, 2)
    .map((expression) => {
      if (INDEX_CALL.test(expression)) return { expression, named: false };
      if (/^[A-Za-z0-9_$]+$/.test(expression) && indexNames.has(expression)) {
        return { expression, named: true };
      }
      return null;
    })
    .filter((endpoint): endpoint is SliceEndpoint => endpoint !== null);
}

/** 자르기 **전에** 그 인덱스들의 실재를 물었는가(이름이 없으면 물을 것도 없다). */
function endpointsGuarded(endpoints: readonly SliceEndpoint[], before: string): boolean {
  return endpoints.every(
    (endpoint) =>
      endpoint.named &&
      new RegExp(`expect\\(\\s*${endpoint.expression}\\s*[,)][\\s\\S]{0,200}?\\.toBeGreaterThan\\(`).test(before)
  );
}

/**
 * 한 테스트 파일에서 "잘라 낸 구간 위의 부정 단언" 자리를 전부 찾는다.
 *
 * 자리로 세는 조건은 셋이다.
 *  ⓐ `const <이름> = <소스>.slice(…)`이거나, **`expect(…)` 인자 안에서 곧바로 자른 자리**이고,
 *  ⓑ 시작·끝 가운데 하나 이상이 **-1이 될 수 있는 자리**(그 자리에서 부른 `indexOf`거나,
 *     `indexOf`로 만든 이름 붙은 인덱스)이며,
 *  ⓒ 그 위에 `.not.toContain`/`.not.toMatch`가 **같은 테스트 안에** 선다.
 *
 * 그중 **가드가 선 자리**는, -1이 될 수 있는 자리가 전부 이름 붙은 인덱스이고 그 이름들이
 * 자르기 전에 `expect(<인덱스>).toBeGreaterThan(…)`으로 실재를 확인받은 경우다.
 * ⚠️ `slice(` 안에서 곧바로 부른 `indexOf`는 **가드가 설 수 없다** — 확인할 이름이 없다.
 *
 * ## ⚠️ 라운드 78 리뷰 M-4 — 그물이 두 번 넓어졌다
 *
 * 처음 이 스윕은 **`const` 선언 + 맨이름 단언**(`expect(<이름>).not.…`)만 봤다. 그래서
 * `apps/mobile/src/api/recommendation-order-mirror.test.ts`의 **DNC-009 부정 단언**이 그물 밖에
 * 있었다 — 그 자리는 잘라 낸 구간을 `call.slice(0, call.indexOf(…))`라는 **파생식 위에서**
 * 물었고(그 식을 그대로 단언 인자에 넣었다), 두 인덱스가 전부 인라인이라 이름조차 없었다.
 * ⚠️ 이 머리말이 그 모양을 **글자 그대로 적지 않는 이유**가 그것이다 — 스윕은 주석도 읽으므로
 * 예시를 그대로 적으면 이 파일이 제 대장에 오른다. **금액이 점수 입력에
 * 실리지 않는다는 계약이 빈 구간 위에서 영원히 초록일 수 있던 자리**다(DNC-009).
 *
 * 그래서 둘을 넓혔다.
 *  ① **파생식 단언**도 단언으로 센다(`expect(<이름>.…).not.…`).
 *  ② **`expect(…)` 인자 안의 `.slice(` 호출 자리**도 자리로 센다(담는 상수가 없어도 위험은 같다).
 *
 * 두 넓힘은 세는 대상만 늘린다 — 판정 로직(무엇이 위험한 끝점인가 · 무엇이 가드인가)은
 * 바이트 그대로다.
 */
function sliceGuardSites(source: string): SliceGuardSite[] {
  const indexNames = new Set<string>();
  const indexDeclaration = /const\s+([A-Za-z0-9_$]+)\s*=\s*[^;{}]*?(?:lastIndexOf|indexOf)\(/g;
  let declared: RegExpExecArray | null;
  while ((declared = indexDeclaration.exec(source))) indexNames.add(declared[1]);

  const sites: SliceGuardSite[] = [];
  SLICE_DECLARATION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SLICE_DECLARATION.exec(source))) {
    const name = match[1];
    const call = readCallArguments(source, match.index + match[0].length - 1);
    if (!call) continue;
    const endpoints = riskyEndpointsOf(call.text, indexNames);
    if (endpoints.length === 0) continue;

    // 이 상수의 유효 범위: 같은 이름을 다시 선언하는 자리 전까지, 그리고 다음 테스트 전까지.
    // (모듈 최상위에 선 상수는 파일 전체가 범위다 — vitest는 테스트 밖의 `expect`를 허락하지
    // 않으므로, 그런 자리에는 애초에 가드를 세울 수 없다. 그래서 대장에 남는다.)
    const moduleScope = match.index === 0 || source[match.index - 1] === "\n";
    TEST_BOUNDARY.lastIndex = call.end;
    const nextTest = moduleScope ? null : TEST_BOUNDARY.exec(source);
    const redeclaration = new RegExp(`const\\s+${name}\\s*=`, "g");
    redeclaration.lastIndex = call.end;
    const nextRedeclaration = redeclaration.exec(source);
    const scopeEnd = Math.min(
      nextTest ? nextTest.index : source.length,
      nextRedeclaration ? nextRedeclaration.index : source.length
    );
    // ① 파생식 단언도 단언이다 — `expect(<이름>.slice(…)).not.…`처럼 이름 뒤에 무엇이 붙어도
    //    잘라 낸 그 구간 위에 선 부정 단언이라는 사실은 같다(리뷰 M-4).
    const negativeAssertion = new RegExp(`expect\\(\\s*${name}\\b[\\s\\S]{0,200}?\\.not\\.to(?:Contain|Match)\\(`);
    if (!negativeAssertion.test(source.slice(call.end, scopeEnd))) continue;

    sites.push({ name, guarded: endpointsGuarded(endpoints, guardWindowBefore(source, match.index)), inline: false });
  }

  // ② `expect(…)` 인자 안에서 곧바로 자른 자리 — 담는 상수가 없어 위 스윕이 보지 못하던 모양이다.
  EXPECT_CALL.lastIndex = 0;
  let expectMatch: RegExpExecArray | null;
  while ((expectMatch = EXPECT_CALL.exec(source))) {
    const argumentsOpen = expectMatch.index + expectMatch[0].length - 1;
    const expectCall = readCallArguments(source, argumentsOpen);
    if (!expectCall) continue;
    // 그 `expect(…)`에 부정 단언이 붙어 있는가(`,` 뒤의 설명 문자열은 건너뛴다).
    if (!/^\)\s*\.not\.to(?:Contain|Match)\(/.test(source.slice(expectCall.end, expectCall.end + 40))) continue;
    SLICE_CALL.lastIndex = 0;
    let sliceMatch: RegExpExecArray | null;
    while ((sliceMatch = SLICE_CALL.exec(expectCall.text))) {
      const sliceOpen = argumentsOpen + 1 + sliceMatch.index + sliceMatch[0].length - 1;
      const sliceCall = readCallArguments(source, sliceOpen);
      if (!sliceCall) continue;
      const endpoints = riskyEndpointsOf(sliceCall.text, indexNames);
      if (endpoints.length === 0) continue;
      sites.push({
        name: `expect#${expectMatch.index}`,
        guarded: endpointsGuarded(endpoints, guardWindowBefore(source, sliceOpen)),
        inline: true
      });
    }
  }
  return sites;
}

/** 가드로 인정되는 앞 구간 — 같은 테스트 안, 자르는 자리에서 `GUARD_WINDOW`만큼 앞까지다. */
function guardWindowBefore(source: string, siteIndex: number): string {
  TEST_BOUNDARY.lastIndex = 0;
  let enclosingTestStart = 0;
  let boundary: RegExpExecArray | null;
  while ((boundary = TEST_BOUNDARY.exec(source)) && boundary.index < siteIndex) {
    enclosingTestStart = boundary.index;
  }
  const moduleScope = siteIndex === 0 || source[siteIndex - 1] === "\n";
  const windowStart = moduleScope
    ? Math.max(0, siteIndex - GUARD_WINDOW)
    : Math.max(0, siteIndex - GUARD_WINDOW, enclosingTestStart);
  return source.slice(windowStart, siteIndex);
}

type SweepRow = {
  readonly file: string;
  readonly unguarded: number;
  readonly guarded: number;
  /** 그중 `expect(…)` 안에서 곧바로 자른 자리 수(라운드 78 리뷰 M-4가 더한 그물). */
  readonly inline: number;
};

function sweep(): SweepRow[] {
  const rows: SweepRow[] = [];
  for (const root of SCAN_ROOTS) {
    for (const absolutePath of listTestFiles(root)) {
      const sites = sliceGuardSites(readFileSync(absolutePath, "utf8"));
      if (sites.length === 0) continue;
      rows.push({
        file: relative(repoRoot, absolutePath).split(sep).join("/"),
        guarded: sites.filter((site) => site.guarded).length,
        inline: sites.filter((site) => site.inline).length,
        unguarded: sites.filter((site) => !site.guarded).length
      });
    }
  }
  return rows;
}

/**
 * 파일별 **미가드 자리 수** 대장 (2026-08-30 · 라운드 78 트랙 E 머지 시점 · 트랙 A 머지 뒤 ·
 * **라운드 78 리뷰 M-4 재계산**).
 *
 * ⚠️ 값은 **이 스윕 자신이 센 것**이다. 정찰의 어림 스윕은 74자리 / 41파일(트랙 E 뒤 63 / 38)로
 * 적었는데, 이 스윕은 같은 시점에 **자리 121 · 가드 35 · 미가드 86 / 미가드 파일 56**을 센다.
 * 차이의 이유는 다섯이고, 다섯 다 이 스윕이 **더 넓게** 잡기 때문이다.
 *  ① `lastIndexOf`도 센다 — 못 찾으면 똑같이 -1이다.
 *  ② 끝점을 `slice(` 안에서 곧바로 부르지 않고 **이름 붙은 인덱스**로 빼 둔 자리도 센다
 *     (이름이 있어도 실재를 묻지 않으면 위험은 같다).
 *  ③ 가드를 **자리별**로 본다 — 근처에 `toBeGreaterThan`이 하나 있는 것으로는 모자라고,
 *     -1이 될 수 있는 **두 끝 모두**가 이름으로 확인돼야 가드로 친다.
 *  ④ **리뷰 M-4**: 단언이 **파생식** 위에 서도 센다(맨이름만 보던 그물이 DNC-009 자리를 놓쳤다).
 *  ⑤ **리뷰 M-4**: **`expect(…)` 안에서 곧바로 자른 자리**도 센다(오늘 **열둘**).
 *
 * ⚠️ **④·⑤가 더한 것은 다섯 자리**(81 → 86)이고, 그중 둘은 새 파일이다
 * (`entry-screen-visual-restore` · `session-teardown`). 반대로 M-4가 가드를 세운
 * `recommendation-order-mirror.test.ts`는 **대장에 오르지 않는다** — 두 인덱스의 실재를 먼저 묻는다.
 *
 * 대장은 **비증가**다. 자리를 없앤 뒤에는 값을 줄여도 되고(권장), 그대로 둬도 초록이다.
 * ⚠️ **합계를 손으로 적지 않는다**(리뷰 P-1) — `LEDGER_TOTAL`은 이 표에서 파생한다.
 */
const UNGUARDED_SITE_LEDGER: Readonly<Record<string, number>> = {
  "apps/admin/src/admin-recovery-codes-remaining.test.ts": 1,
  "apps/mobile/src/a11y-contract.test.ts": 7,
  "apps/mobile/src/analytics/screen-events.test.ts": 1,
  "apps/mobile/src/android-release-aab.test.ts": 1,
  "apps/mobile/src/children/child-born-transition.test.ts": 1,
  "apps/mobile/src/children/child-switch.test.ts": 1,
  "apps/mobile/src/consent/legal-links.test.ts": 1,
  "apps/mobile/src/design-restore-p2d.test.ts": 1,
  "apps/mobile/src/expenses/auto-fill-wiring.test.ts": 2,
  "apps/mobile/src/expenses/date-picker-month.test.ts": 2,
  "apps/mobile/src/expenses/entry-form-guards.test.ts": 1,
  "apps/mobile/src/expenses/entry-screen-visual-restore.test.ts": 1,
  "apps/mobile/src/expenses/expense-detail-rows.test.ts": 1,
  "apps/mobile/src/expenses/expense-source-line.test.ts": 1,
  "apps/mobile/src/expenses/failed-row-prefill.test.ts": 2,
  "apps/mobile/src/expenses/item-history.test.ts": 2,
  "apps/mobile/src/expenses/records-calendar.test.ts": 7,
  "apps/mobile/src/expenses/save-error-wiring.test.ts": 2,
  "apps/mobile/src/expenses/text-limits.test.ts": 1,
  "apps/mobile/src/export-flow.test.ts": 1,
  "apps/mobile/src/family/invite-accept-messages.test.ts": 2,
  "apps/mobile/src/family/invite-flow.test.ts": 1,
  "apps/mobile/src/family/record-permissions.test.ts": 1,
  "apps/mobile/src/home/budget-edit.test.ts": 1,
  "apps/mobile/src/home/cumulative-total.test.ts": 2,
  "apps/mobile/src/home/home-cold-start-defer.test.ts": 1,
  "apps/mobile/src/home/home-section-priority.test.ts": 1,
  "apps/mobile/src/home/home-sync-status.test.ts": 1,
  "apps/mobile/src/home/prep-nudge.test.ts": 1,
  "apps/mobile/src/import/import-resume.test.ts": 1,
  "apps/mobile/src/import/preview-rows.test.ts": 1,
  "apps/mobile/src/items/gifted-status-flow.test.ts": 2,
  "apps/mobile/src/items/item-labels.test.ts": 1,
  "apps/mobile/src/items/link-marker.test.ts": 2,
  "apps/mobile/src/items/link-price.test.ts": 2,
  "apps/mobile/src/items/pre-birth-filter.test.ts": 1,
  "apps/mobile/src/items/status-mutation-messages.test.ts": 2,
  "apps/mobile/src/notifications/generators.test.ts": 1,
  "apps/mobile/src/notifications/new-notification-marks.test.ts": 1,
  "apps/mobile/src/notifications/notification-row-actions.test.ts": 2,
  "apps/mobile/src/offline/delete-conflict-recovery.test.ts": 1,
  "apps/mobile/src/offline/item-status-outbox.test.ts": 1,
  "apps/mobile/src/offline/permission-denied.test.ts": 2,
  "apps/mobile/src/offline/session-teardown.test.ts": 1,
  "apps/mobile/src/offline/sync-engine.test.ts": 1,
  "apps/mobile/src/offline/sync-status-bulk-actions.test.ts": 2,
  "apps/mobile/src/onboarding/local-progress.test.ts": 2,
  "apps/mobile/src/onboarding/selected-child-recovery.test.ts": 1,
  "apps/mobile/src/preparation/preparation-restore.test.ts": 1,
  "apps/mobile/src/reports/empty-period-card.test.ts": 1,
  "apps/mobile/src/reports/report-trust-drilldown-flow.test.ts": 3,
  "apps/mobile/src/reports/share-flow.test.ts": 1,
  "apps/mobile/src/screen-header-back.test.ts": 1,
  "apps/mobile/src/settings/more-menu.test.ts": 2,
  "packages/test-utils/src/public-surface-brand.test.ts": 1,
  "packages/test-utils/src/store-brand-and-asset-provenance.test.ts": 1
};

const LEDGER_TOTAL = Object.values(UNGUARDED_SITE_LEDGER).reduce((sum, count) => sum + count, 0);

/**
 * **가드 하한** — 라운드 77 M-3(본보기 한 파일)과 라운드 78 트랙 E(열두 자리)가 세운 실재 확인이
 * 조용히 사라지지 않게 한다. 값은 "이 파일에 가드가 선 자리가 최소 몇이어야 하는가"다.
 * ⚠️ `reports/share-flow.test.ts`의 둘 중 하나는 라운드 64 S-3이 먼저 세운 자리다(트랙 E는 그
 * 쌍둥이 자리를 같은 형식으로 맞췄다) — 형식이 한 벌뿐이라는 사실이 이 표의 값이다.
 */
const EXISTENCE_GUARD_FLOOR: Readonly<Record<string, number>> = {
  // 라운드 78 리뷰 M-4가 세운 자리 — `const` 하나(구간)와 **인라인 하나**(DNC-009 부정 단언).
  "apps/mobile/src/api/recommendation-order-mirror.test.ts": 2,
  "apps/mobile/src/commerce/purchase-followup-flow.test.ts": 2,
  "apps/mobile/src/expenses/failed-row-prefill.test.ts": 4,
  "apps/mobile/src/family/household-scope.test.ts": 1,
  "apps/mobile/src/family/record-permissions.test.ts": 1,
  "apps/mobile/src/home/home-section-priority.test.ts": 2,
  "apps/mobile/src/import/import-resume.test.ts": 1,
  "apps/mobile/src/items/item-expense-roundtrip-wiring.test.ts": 1,
  "apps/mobile/src/items/item-trust-notes.test.ts": 1,
  "apps/mobile/src/reports/share-flow.test.ts": 2
};

describe("소스 계약의 잘라 낸 구간 — 실재를 먼저 묻는가 (라운드 78 트랙 E)", () => {
  const rows = sweep();
  const unguardedByFile = new Map(rows.filter((row) => row.unguarded > 0).map((row) => [row.file, row.unguarded]));
  const guardedByFile = new Map(rows.map((row) => [row.file, row.guarded]));
  const inlineByFile = new Map(rows.map((row) => [row.file, row.inline]));
  /** 스윕이 실제로 읽은 파일 전부 — 대장·하한의 키가 유령이 아닌지 여기서 확인한다. */
  const scannedFiles = new Set(
    SCAN_ROOTS.flatMap((root) => listTestFiles(root)).map((absolutePath) =>
      relative(repoRoot, absolutePath).split(sep).join("/")
    )
  );

  /**
   * ⚠️ **라운드 78 리뷰 P-1 — 유령 방지.** 대장과 하한의 키는 **실재하는 테스트 파일**이어야
   * 한다. 파일이 사라지거나 이름이 바뀌면 그 줄은 아무것도 막지 않는 채 남고(래칫은 `?? 0`으로
   * 조용히 통과한다), 다음 사람은 그 줄을 "이미 얼려 둔 자리"로 읽는다.
   */
  it("대장·하한의 키가 전부 실재하는 파일이다 (유령 줄 금지)", () => {
    const ghosts = [...Object.keys(UNGUARDED_SITE_LEDGER), ...Object.keys(EXISTENCE_GUARD_FLOOR)]
      .filter((file) => !scannedFiles.has(file))
      .sort();
    expect(ghosts, "대장·하한이 없는 파일을 들고 있어요. 파일을 옮겼다면 키도 함께 옮겨 주세요").toEqual([]);
    // 스윕 자체가 조용히 0건이 되지 않았는지도 함께 본다.
    expect(scannedFiles.size).toBeGreaterThan(100);
  });

  it("파일별 미가드 자리 수가 대장의 값보다 늘지 않는다 (래칫)", () => {
    const grown: string[] = [];
    for (const [file, recorded] of Object.entries(UNGUARDED_SITE_LEDGER)) {
      const actual = unguardedByFile.get(file) ?? 0;
      if (actual > recorded) grown.push(`${file}: 대장 ${recorded} → 실측 ${actual}`);
    }
    expect(grown, "가드 없는 구간이 늘었어요. 자리를 늘리는 대신 실재 확인을 세워 주세요").toEqual([]);
  });

  it("대장에 없는 파일에는 이 모양이 새로 서지 않는다", () => {
    const newcomers = [...unguardedByFile.keys()].filter((file) => !(file in UNGUARDED_SITE_LEDGER)).sort();
    expect(
      newcomers,
      "새 파일이 가드 없는 구간을 들고 왔어요. 두 인덱스에 toBeGreaterThan을 세우면 목록에서 빠집니다"
    ).toEqual([]);
  });

  /**
   * ⚠️ **라운드 78 리뷰 P-1** — 종전에는 여기에 `expect(LEDGER_TOTAL).toBe(81)`이 서 있었다.
   * 대장에서 파생한 값을 **손으로 적은 숫자와** 다시 비교한 셈이라, 대장을 고치는 사람은 같은
   * 사실을 두 곳에 적어야 했고 그 둘이 갈리는 날 실패 메시지는 저장소의 상태가 아니라 **자기
   * 자신**을 가리켰다. 이제 총계는 대장 합에서만 나오고, 이 케이스가 묻는 것은 **저장소가 그
   * 합을 넘지 않는가** 하나다.
   */
  it("총계도 비증가다 — 대장의 합계가 저장소의 답이다", () => {
    const total = [...unguardedByFile.values()].reduce((sum, count) => sum + count, 0);
    expect(LEDGER_TOTAL).toBe(Object.values(UNGUARDED_SITE_LEDGER).reduce((sum, count) => sum + count, 0));
    expect(total).toBeLessThanOrEqual(LEDGER_TOTAL);
    // 대장이 통째로 비면 위 단언은 0 ≤ 0으로 조용히 통과한다 — 그 자리를 막는다.
    expect(LEDGER_TOTAL).toBeGreaterThan(50);
  });

  /**
   * ⚠️ **라운드 78 리뷰 M-4 — 넓힌 그물이 실제로 무언가를 잡는가.**
   * `expect(…)` 안에서 곧바로 자른 자리는 오늘 **열둘**이고, 그 그물이 조용히 0건이 되면
   * DNC-009 자리 같은 모양이 다시 스윕 밖으로 나간다. 하한으로 적는다(자리는 늘 수 있다).
   */
  it("인라인 자르기 자리를 그물이 잡는다 (리뷰 M-4가 넓힌 그물의 하한)", () => {
    const inlineTotal = [...inlineByFile.values()].reduce((sum, count) => sum + count, 0);
    expect(inlineTotal).toBeGreaterThanOrEqual(12);
    // M-3이 고친 본보기와 M-4가 고친 자리가 둘 다 인라인 자리를 하나씩 들고 있다.
    expect(inlineByFile.get("apps/mobile/src/api/recommendation-order-mirror.test.ts")).toBeGreaterThanOrEqual(1);
    expect(inlineByFile.get("apps/mobile/src/commerce/purchase-followup-flow.test.ts")).toBeGreaterThanOrEqual(1);
  });

  it("라운드 77 M-3과 라운드 78 트랙 E가 세운 실재 확인이 사라지지 않는다", () => {
    const lost: string[] = [];
    for (const [file, floor] of Object.entries(EXISTENCE_GUARD_FLOOR)) {
      const actual = guardedByFile.get(file) ?? 0;
      if (actual < floor) lost.push(`${file}: 하한 ${floor} → 실측 ${actual}`);
    }
    expect(lost, "자르기 전에 실재를 묻던 자리가 사라졌어요").toEqual([]);
    // 스윕이 세어야 할 것을 세고 있다는 확인 — 본보기 파일이 실제로 잡힌다.
    expect(guardedByFile.has("apps/mobile/src/commerce/purchase-followup-flow.test.ts")).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  /**
   * ⓓ 두 실패 방향을 **재현**한다. 이 테스트는 저장소를 읽지 않는다 — 픽스처 위에서 `slice`가
   * -1을 어떻게 읽는지를 보여 주는 것이 값이다.
   *
   * ⚠️ 아래 두 구간은 일부러 이 계약이 세는 모양(`const 구간 = 소스.slice(…)` + 부정 단언)을
   * 피해 객체 속성으로 담는다. 픽스처는 "가드가 없어야" 이야기가 되는데, 스윕이 그것을 진짜
   * 계약 자리로 세면 대장이 제 꼬리를 물기 때문이다.
   */
  it("시작점 -1은 빈 구간을 만들고, 그 위에서는 부정 단언이 언제나 통과한다", () => {
    const fixture = ["const gate = () => {", "  forbiddenCall();", "};", "const next = () => {};"].join("\n");
    const start = fixture.indexOf("const gate = (");
    const end = fixture.indexOf("const next = (");
    const missing = fixture.indexOf("const gate = (payload) => {"); // 인자가 하나 붙는 순간 이렇게 된다.
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(missing).toBe(-1);

    const nets = {
      // 살아 있는 그물: 금지된 호출이 그 안에 있어 부정 단언이 **빨개진다**.
      alive: fixture.slice(start, end),
      // 시작점이 -1이면 slice는 그것을 "끝에서 한 글자 앞"으로 읽고, 끝점이 그보다 앞이라
      // 구간은 **빈 문자열**이 된다 — 조용한 쪽이다.
      empty: fixture.slice(missing, end),
      // 끝점이 -1이면 구간은 **파일 끝(마지막 한 글자 앞)까지** 넓어진다 — 시끄러운 쪽이다.
      widened: fixture.slice(start, missing)
    };

    expect(nets.alive).toContain("forbiddenCall();");
    expect(nets.empty).toBe("");
    // ⚠️ 이 한 줄이 이 트랙의 이유다: 아무것도 검사하지 않은 채 초록이다.
    expect(nets.empty).not.toContain("forbiddenCall();");
    expect(nets.widened.length).toBeGreaterThan(nets.alive.length);
    expect(nets.widened).toContain("const next = (");
  });
});
