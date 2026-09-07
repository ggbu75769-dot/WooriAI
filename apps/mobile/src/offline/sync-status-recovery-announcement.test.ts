import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE, syncStatusActionFailedMessage } from "./messages";

/**
 * 라운드 110 — **동기화 상태 화면의 "눌러서 나타난 실패"가 소리로도 나간다.**
 *
 * ## 고치는 것
 *
 * 라운드 104 B-5가 이 화면의 복구 호출 열넷을 거절까지 붙잡게 만들고, 그 거절을 누른 자리 안의
 * 한 줄로 세웠다(`RecoveryActionFailureLine` · `syncStatusActionFailedMessage`). 그 걸음이 물은
 * 것은 *"거절이 **보이는가**"* 였고 답은 거기까지였다 — 그때는 참이었다. **소리로 쓰는 사람에게는
 * 그 한 줄이 도달하지 않았다**: 이 파일 전체에 `announceForA11y`가 0건이었고, 프롭 쌍도 없었다.
 *
 * 도달 경로가 핵심 루프다. 비행기 모드로 지출을 기록하면 앱이 스스로 이 화면으로 데려오고
 * (`src/expenses/post-save-destination.ts`의 `POST_SAVE_SYNC_STATUS_DESTINATION`), 거기서
 * [재시도]/[버리기]/[충돌 해결]을 눌렀는데 `getOfflineStore()`가 거절하면 **포커스는 방금 누른
 * SecondaryButton에 남고** 문장만 그 곁에 맨 줄로 선다 → "눌렀는데 아무 일도 일어나지 않았다"로
 * 읽혀 **같은 버튼을 다시 누른다.** 이 저장소가 그 조건을 이미 명문화해 두었다:
 * `src/a11y-contract.test.ts`의 `LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON` — *"뮤테이션(누름)이 세운
 * 실패는 눌린 컨트롤에 포커스가 남은 채로 문장이 그 바로 곁에 맨 줄로 선다"*.
 *
 * ## 왜 기존 스윕이 이 아홉 자리를 못 잡았는가 (그물이 성겨서가 아니라 모집단이 달라서다)
 *
 * 라운드 79·80의 낭독 스윕은 모집단을 `mutationTriggerSitesOf`로 만든다. 그 함수는 danger 색 글자를
 * 감싼 **최내곽 JSX 갈래**가 `useMutation`/`useQuery` 바인딩에 닿을 때만 자리로 세고, 상태에서
 * 파생한 갈래는 `pressedMessageStates`를 지나야 하는데 그 판정은 **setter가 boolean 리터럴로 도는
 * 상태를 통째로 버린다**(`if (args.some((arg) => arg === "true" || arg === "false")) continue;`).
 * 이 화면의 실패 표시는 전부 `setFailed(true|false)` 꼴이고 복구 호출도 `useMutation`이 아니라
 * `void Promise.resolve().then(action).catch(...)`라, 그 스윕의 *"침묵 0건"* 이라는 초록은 이 아홉
 * 자리에 대해서는 **아무 말도 하지 않는 초록**이었다. 그 사실은 오늘도 값으로 확인된다(아래 ⓔ).
 *
 * ## 고른 한 벌과 그 근거 — 훅 하나, 프롭 쌍 없음
 *
 * 저장소에는 낭독 한 벌이 둘 있다. ⓐ 프롭 쌍 + 화면 안 `useEffect`의 `announceForA11y`
 * (라운드 79·80이 뮤테이션 실패 자리에 세운 모양 — 그 자리들은 위 대장이 프롭 쌍을 값으로 붙든다),
 * ⓑ `useFieldErrorAnnouncement` 한 벌만(라운드 109가 `app/settings/children.tsx`에서 고른 모양).
 * 이 자리는 ⓑ다. 근거는 라운드 109가 그 화면 ⓚ에 적어 둔 그대로다 — *"검증 오류 셋에 프롭을 더하면
 * … 무엇보다 안드로이드에서 라이브 리전과 announce가 겹친다. 훅 하나로 두 플랫폼이 답하므로 프롭은
 * 필요하지 않다"*. 프롭 쌍은 안드로이드의 답이라(RN 문서의 `@platform android`) iOS는 그대로
 * 조용하고, 이 아홉 자리를 프롭 쌍으로 붙드는 대장은 **없다**(위 문단의 모집단 밖이라 없다).
 * 그래서 이 걸음은 프롭을 한 개도 더하지 않는다 — 아래 ⓓ가 그 0을 부정 단언으로 진다.
 *
 * ## 이 계약이 무는 것
 *
 * ⓐ 자리 전수 — `RecoveryActionFailureLine`이 서는 자리가 여덟이고, 그 배선이 **컴포넌트 하나**에 있다.
 * ⓑ 훅이 받는 값 = 화면이 그 줄을 그리는 조건(눈에 없는 문장을 귀에만 들려주지 않는다).
 * ⓒ 대기 행의 blocked 한 줄도 같은 한 벌을 지난다(사유만 다르고 조건은 같다).
 * ⓓ 부정 단언 — 배선 사본 0건 · 새 프롭 0건 · 새 한국어 문장 0건.
 * ⓔ danger 글자 전수 — 누름이 세우는 자리는 예외 없이 출구를 가지고, 나머지는 이유가 값으로 선다.
 *
 * ⚠️ **소스 대조이지 런타임이 아니다.** 이 화면은 `react-native`를 지나므로 vitest가 렌더할 수 없다
 * (이 저장소의 모바일 UI 계약이 전부 소스 대조인 그 사정). TalkBack/VoiceOver가 실제로 읽는지는
 * 실기기만 답한다 — 이 트랙은 새 물음을 만들지 않는다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const SCREEN = "app/sync-status.tsx";
const HOOK_MODULE = "src/a11y/use-field-error-announcement.ts";

/** 주석을 지우되 **자리(인덱스)는 그대로 둔다** — `src/a11y-contract.test.ts`의 그 함수와 같다. */
function maskComments(sourceText: string): string {
  return sourceText
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_all, prefix: string, line: string) => prefix + line.replace(/./g, " "));
}

/** 여는 태그의 끝 `>` — 중괄호·따옴표 안의 `>`는 세지 않는다(같은 파일의 그 규칙). */
function openingTagEnd(masked: string, tagStart: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = tagStart; index < masked.length; index += 1) {
    const char = masked[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return index;
  }
  return -1;
}

/** 이 파일의 **최상위 컴포넌트/함수** 선언 자리 — 자리를 그 이름에 귀속시키는 데 쓴다. */
function topLevelBlocksOf(masked: string): Array<{ readonly name: string; readonly at: number }> {
  const blocks: Array<{ readonly name: string; readonly at: number }> = [];
  const pattern = /^(?:export default )?(?:function ([A-Za-z0-9_$]+)|const ([A-Za-z0-9_$]+) = memo\()/gm;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) blocks.push({ name: found[1] ?? found[2], at: found.index });
  return blocks;
}

const componentAt = (masked: string, at: number): string => {
  const blocks = topLevelBlocksOf(masked).filter((block) => block.at <= at);
  return blocks.length > 0 ? blocks[blocks.length - 1].name : "";
};

/** danger 색 글자 자리 전수(손 목록 금지 — 자리가 하나 늘거나 줄면 빨개진다). */
function dangerTextSitesOf(masked: string): Array<{ readonly component: string; readonly body: string }> {
  const sites: Array<{ readonly component: string; readonly body: string }> = [];
  const pattern = /<Text(?![A-Za-z0-9_])/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const end = openingTagEnd(masked, found.index);
    if (end < 0) continue;
    const openTag = masked.slice(found.index, end + 1);
    if (!openTag.includes("theme.colors.danger")) continue;
    const close = masked.indexOf("</Text>", end);
    sites.push({
      component: componentAt(masked, found.index),
      body: close < 0 ? "" : masked.slice(end + 1, close).trim()
    });
  }
  return sites;
}

/**
 * ⚠️ **누름이 세우지 않는 danger 글자 — 이유가 적힌 값으로 남긴다**(빈 알리바이 금지: 40자 이상).
 *
 * 이 표가 비어 있지 않다는 사실 자체가 값이다. 아래 ⓔ는 danger 자리 전수를 소스에서 파생해,
 * 출구가 있는 자리와 이 표가 **합쳐서 전부**임을 단언한다 — 새 danger 줄이 어느 쪽에도 들지 않으면
 * 그날 빨개진다.
 */
const DANGER_TEXT_WITHOUT_ANNOUNCE: Readonly<Record<string, string>> = {
  "SyncRow {row.lastError}":
    "서버가 돌려준 실패 사유다 — 누름이 세우는 것이 아니라 행이 목록에 그려질 때부터 스냅샷과 함께 서 있다. 목록에 들어서는 순간 이미 화면에 있는 문장이라 포커스가 남는 조건이 성립하지 않는다.",
  "ItemStatusSyncRow {row.lastError}":
    "준비템 행의 같은 자리 — 같은 사유다(스냅샷이 세우는 사실이고, 누른 직후에 새로 나타나는 문장이 아니다). 지출 행과 준비템 행이 이 축에서 다른 답을 갖지 않는다.",
  "SyncStatusScreen {OFFLINE_STORAGE_UNAVAILABLE_NOTICE}":
    "화면 머리말의 저장소 상태 고지다 — 방아쇠가 누름이 아니라 부팅 뒤 저장소 상태이고, 화면에 들어서면 이미 서 있다. 이 줄이 말하는 것은 위 배지 숫자를 믿어도 되는지이지 방금 누른 것의 답이 아니다."
};

describe("라운드 110 ⓐ 복구 실패 한 줄의 낭독 — 여덟 자리가 컴포넌트 하나로 닫힌다", () => {
  it("`RecoveryActionFailureLine`이 서는 자리가 여덟이고, 전부 `visible=`을 지고 선다", () => {
    const masked = maskComments(source(SCREEN));
    const uses = masked.match(/<RecoveryActionFailureLine(?![A-Za-z0-9_])[^>]*\/>/g) ?? [];
    // 유령 방지: 그물이 실제로 이 화면을 훑고 있다(0건 위에서 조용히 초록이 되지 않게).
    expect(uses.length, "이 화면의 복구 실패 줄 자리").toBe(8);
    for (const use of uses) expect(use, "자리마다 조건을 지고 선다").toContain("visible=");
    // 선언은 하나다 — 여덟이 같은 한 벌을 나눠 쓴다는 사실이 이 배선의 전제다.
    expect((masked.match(/function RecoveryActionFailureLine\(/g) ?? []).length, "그 컴포넌트의 선언").toBe(1);
  });

  it("배선은 그 컴포넌트 **안**에 하나 있고, 조기 반환보다 위에서 불린다 (FIX-A)", () => {
    const masked = maskComments(source(SCREEN));
    // ⚠️ 자르기 **전에** 두 끝의 실재를 묻는다 — 표식이 사라지면 `indexOf`가 -1을 돌려주고,
    //    그 위의 부정 단언은 빈 구간에서 영원히 초록이다(라운드 78 트랙 E의 그 계약).
    const start = masked.indexOf("function RecoveryActionFailureLine(");
    const end = masked.indexOf("\nfunction SyncRow(", start);
    expect(start, "그 컴포넌트").toBeGreaterThan(-1);
    expect(end, "그 컴포넌트의 끝").toBeGreaterThan(-1);
    const body = masked.slice(start, end);
    const hookAt = body.indexOf("useFieldErrorAnnouncement(");
    const earlyReturnAt = body.indexOf("if (!visible) return null;");
    expect(hookAt, "낭독 배선").toBeGreaterThan(-1);
    expect(earlyReturnAt, "조기 반환").toBeGreaterThan(-1);
    // ⚠️ 조건부 호출은 훅 순서를 깰 뿐 아니라 **갈래가 닫힌 것을 훅이 못 보게** 만든다
    // (기억을 지우는 걸음이 사라져 같은 문장의 두 번째 실패가 조용해진다 — 훅 모듈 머리말).
    expect(hookAt, "훅은 조기 반환 위에서 부른다").toBeLessThan(earlyReturnAt);
  });

  it("ⓑ 훅이 받는 값 = 화면이 그 줄을 그리는 조건 (눈에 없는 문장을 귀에만 들려주지 않는다)", () => {
    const masked = maskComments(source(SCREEN));
    expect(masked).toContain("useFieldErrorAnnouncement(visible ? syncStatusActionFailedMessage() : null);");
    // ⚠️ 순진한 한 줄 금지 — `null` 갈래가 없으면 갈래가 닫힌 것을 훅이 볼 수 없다.
    expect(masked).not.toContain("useFieldErrorAnnouncement(syncStatusActionFailedMessage())");
    // 읽히는 문장과 그려지는 문장이 **같은 한 벌**에서 온다(두 벌 리터럴 자리를 만들지 않는다).
    expect(masked).toContain("<Text style={{ color: theme.colors.danger, fontSize: 12 }}>{syncStatusActionFailedMessage()}</Text>");
  });

  it("ⓒ 대기 행의 '보내는 중' 거절 한 줄도 같은 한 벌을 지난다 (사유만 다르고 조건은 같다)", () => {
    const masked = maskComments(source(SCREEN));
    const start = masked.indexOf("const PendingRow = memo(");
    const end = masked.indexOf("function ItemStatusSyncRow(", start);
    expect(start, "대기 행 컴포넌트").toBeGreaterThan(-1);
    expect(end, "그 컴포넌트의 끝").toBeGreaterThan(-1);
    const body = masked.slice(start, end);
    expect(body).toContain("useFieldErrorAnnouncement(discardBlocked ? SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE : null);");
    // 그리는 조건과 읽는 조건이 같은 이름이다.
    expect(body).toContain("{discardBlocked ? (");
    expect(body).toContain("{SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE}");
    // 두 줄은 함께 서지 않는다 — 한 번의 확인에서 `.then`은 blocked를, `.catch`는 failed를 세운다.
    expect(body).toContain("if (!discarded) setDiscardBlocked(true);");
    expect(body).toContain(".catch(() => setDiscardFailed(true));");
    // 문구 둘은 서로 다른 사실을 말한다(같은 문장 두 벌이 아니다).
    expect(SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE).not.toBe(syncStatusActionFailedMessage());
  });
});

describe("라운드 110 ⓓ 부정 단언 — 배선 사본 0건 · 새 프롭 0건 · 새 한국어 문장 0건", () => {
  it("이 화면에 낭독 배선의 사본이 없다 (훅 한 벌만 지난다)", () => {
    const masked = maskComments(source(SCREEN));
    // 배선은 훅 호출 둘뿐이고, 화면이 `announceForA11y`를 직접 부르거나 자기 effect를 짓지 않는다.
    expect((masked.match(/useFieldErrorAnnouncement\(/g) ?? []).length, "이 화면의 낭독 배선").toBe(2);
    expect(masked, "화면이 직접 낭독하지 않는다").not.toContain("announceForA11y(");
    // 그 규율(같은 문장 재낭독 금지 · 갈래가 닫히면 기억을 지운다)이 한 벌에 산다.
    const hook = source(HOOK_MODULE);
    expect(hook).toContain("announceForA11y(message);");
    expect(hook).toContain("announced.current = null;");
  });

  it("프롭 쌍은 한 개도 더하지 않았다 — 반쪽 프롭 자리도 0건이다", () => {
    const masked = maskComments(source(SCREEN));
    // ⚠️ 이유는 위 머리말의 그것이다: 프롭 쌍은 안드로이드의 답이고, 훅의 낭독과 겹치면 같은
    // 문장이 두 번 읽힐 수 있다. 이 자리를 프롭 쌍으로 붙드는 대장이 없으므로 더하지 않는다.
    // ⚠️ 주석은 걷고 본다 — 위 컴포넌트에 남긴 근거 문단이 그 프롭 이름을 인용하기 때문이다
    //    (이 저장소의 다른 스윕과 같은 관례). 코드에는 한 짝도 없다.
    expect(masked, "라이브 리전").not.toContain("accessibilityLiveRegion");
    expect(masked, "alert 역할").not.toContain('accessibilityRole="alert"');

    /**
     * ⚠️ **그 판단이 기댄 사실을 값으로 못 박는다**(자기 무효화되는 핀 — 산문으로만 두면 다음
     * 라운드가 이 갈림을 다시 산문으로 발견해야 한다). 프롭 쌍을 더하지 않은 근거는 둘이고, 둘 다
     * 한 벌 모듈이 스스로 지고 있다: ⓐ 그 프롭은 **안드로이드의 답**이라 iOS는 조용하고,
     * ⓑ 크로스플랫폼의 답은 `announceForA11y` 하나다. 그 사실이 바뀌는 날 이 줄이 **먼저** 빨개져서,
     * 프롭을 더하는 것이 사고가 아니라 결정이 되게 한다.
     */
    const hook = source(HOOK_MODULE);
    expect(hook, "프롭 쌍이 안드로이드 한정이라는 사실").toContain("@platform android");
    expect(hook, "크로스플랫폼의 답").toContain("announceForA11y");
  });

  it("새 한국어 문장 0건 — 읽히는 것은 messages.ts가 이미 짓던 그 두 문장이다", () => {
    const masked = maskComments(source(SCREEN));
    const messages = source("src/offline/messages.ts");
    for (const sentence of [syncStatusActionFailedMessage(), SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE]) {
      expect(messages, sentence).toContain(sentence);
      expect(masked, `${sentence} — 화면이 문장을 다시 적지 않는다`).not.toContain(sentence);
    }
  });
});

describe("라운드 110 ⓔ danger 글자 전수 — 누름이 세우는 자리는 예외 없이 출구를 가진다", () => {
  it("자리마다 출구가 있거나, 없는 이유가 값으로 서 있다 (합쳐서 전수다)", () => {
    const masked = maskComments(source(SCREEN));
    const sites = dangerTextSitesOf(masked);
    // 유령 방지: 이 화면에 danger 글자가 실재하고, 그물이 그것을 본다.
    expect(sites.length, "이 화면의 danger 글자 자리").toBeGreaterThanOrEqual(4);

    const announcedComponents = new Set(
      [...masked.matchAll(/function ([A-Za-z0-9_$]+)\(|const ([A-Za-z0-9_$]+) = memo\(/g)]
        .map((found) => ({ name: found[1] ?? found[2], at: found.index }))
        .filter((block) => {
          const next = masked.indexOf("useFieldErrorAnnouncement(", block.at);
          return next > -1 && componentAt(masked, next) === block.name;
        })
        .map((block) => block.name)
    );
    // 배선을 진 컴포넌트가 실제로 둘이다(0건 위에서 아래 분류가 조용히 초록이 되지 않게).
    expect([...announcedComponents].sort(), "낭독 배선을 진 컴포넌트").toEqual([
      "PendingRow",
      "RecoveryActionFailureLine"
    ]);

    const withoutExit = sites
      .filter((site) => !announcedComponents.has(site.component))
      .map((site) => `${site.component} ${site.body}`);
    expect(withoutExit.sort(), "출구 없는 danger 자리").toEqual(Object.keys(DANGER_TEXT_WITHOUT_ANNOUNCE).sort());
    for (const [key, why] of Object.entries(DANGER_TEXT_WITHOUT_ANNOUNCE)) {
      // 한 낱말짜리 알리바이 금지 — 왜 누름이 세우는 자리가 아닌지를 적어야 한다.
      expect(why.length, `${key}의 제외 사유`).toBeGreaterThan(40);
    }
  });

  it("⚠️ 기존 스윕이 이 자리를 못 보는 이유가 오늘도 소스에 그대로 있다 (모집단이 다르다)", () => {
    const masked = maskComments(source(SCREEN));
    // ⓐ 복구 호출은 `useMutation`이 아니라 fire-and-forget 뒤의 `.catch`로 실패를 세운다.
    expect(masked, "이 화면에 useMutation은 없다").not.toContain("useMutation(");
    expect(masked).toContain("void Promise.resolve()");
    expect(masked).toContain(".catch(() => setFailed(true));");
    // ⓑ 실패 표시는 boolean 리터럴로 도는 useState라, `pressedMessageStates`가 통째로 버린다.
    expect(masked).toContain("const [failed, setFailed] = useState(false);");
    expect(masked).toContain("setFailed(false);");
    // ⓒ 그래서 GAP-080의 화면별 표에 이 화면이 없다 — 그 초록은 이 아홉 자리에 대해 아무 말도
    //    하지 않는 초록이고, 이 파일이 그 자리를 따로 진다.
    const ledger = source("src/a11y-contract.test.ts");
    const tableAt = ledger.indexOf("const MUTATION_TRIGGER_SITES_BY_SCREEN");
    const tableEnd = ledger.indexOf("const QUERY_TRIGGER_SITES_BY_SCREEN");
    expect(tableAt, "그 대장의 화면별 표").toBeGreaterThan(-1);
    expect(tableEnd, "그 표의 끝").toBeGreaterThan(-1);
    const table = ledger.slice(tableAt, tableEnd);
    expect(table.length, "그 표의 구간").toBeGreaterThan(0);
    expect(table, "이 화면은 그 모집단 밖이다").not.toContain(SCREEN);
    expect(ledger).toContain('if (args.some((arg) => arg === "true" || arg === "false")) continue;');
  });
});
