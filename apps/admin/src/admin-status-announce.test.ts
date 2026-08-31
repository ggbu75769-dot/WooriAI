import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 90 트랙 B — **어드민의 상태 문장이 소리로 나간다, 그리고 그 규율이 모집단을 얻는다.**
 *
 * 어제까지 어드민의 상태 문장 **마흔일곱** 자리 가운데 **소리로 닿는 것은 하나**였다
 * (`src/components/ProductLinkBulkReplace.tsx`의 대량 교체 경고 — `role="status"`). 나머지
 * 마흔여섯은 화면에 **보이기만** 했다: 저장에 실패해도, 계정을 만들어도, 목록을 못 불러와도
 * 스크린리더는 아무 말도 하지 않았고, 운영자는 포커스를 옮겨 문장을 **찾아 읽어야** 알았다.
 * 이 파일은 그 자리를 **모집단으로** 만든다 — 새 배너가 소리 없이 붙는 날 여기가 빨개진다.
 *
 * ⚠️⚠️ **이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다.**
 *
 * 저장소에는 앱 경계를 넘어 도는 그물들이 있다(모바일·어드민·API·`packages`를 함께 걷는
 * **열다섯** 목록 — 슬라이스 가드·사문 대장·주석 관용 앵커 대장 따위). **이 파일은 그 하나가
 * 아니다.** 이 스윕이 걷는 것은 아래 `SWEEP_ROOTS` 둘 — `apps/admin/{app,src}/**` 뿐이다.
 * 그 사실을 주석이 아니라 **값**으로 두는 이유는 라운드 89 트랙 B의 `admin-table-name.test.ts`와
 * 같다: 다음 라운드에 누군가 이 파일을 "어드민 상태 그물"에서 "저장소 상태 그물"로 넓히려 할 때
 * 넓히는 손이 `SWEEP_ROOTS`를 고치며 지나가게 하기 위해서다. 주석은 조용히 거짓이 되지만
 * 값은 빨개진다(`SWEEP_SCOPE_LABEL` · 아래 ⓐ의 경계 단언).
 *
 * ⚠️ 이 스윕이 **모바일의 낭독을 세지 않는다**는 것은 사각이 아니라 범위다: 모바일은
 * `accessibilityLiveRegion`·`announceForA11y`라는 다른 축을 쓰고(React Native), 그 축은
 * `apps/mobile/src/a11y-contract.test.ts`가 자기 모집단으로 진다. 여기서 세는 것은 **HTML의
 * `role`/`aria-live`** 하나뿐이다.
 *
 * ## ⚠️ 전제 재실측 — 정찰의 세 수는 하한이었고, 셋 다 그대로였다
 *
 * 정찰(2026-08-31)이 grep으로 낸 하한은 **마흔일곱 자리 · 소리로 닿는 하나 · 파일 열넷**이다.
 * 이 트랙이 워킹트리에서 다시 세니 **마흔일곱 · 하나 · 열넷** — 셋 다 같았다. 다만 *자리*의
 * 단위를 값으로 못 박아 둔다: 이 파일이 세는 한 자리는 **클래스 참조 하나**(`styles.<클래스>`)이지
 * 여는 태그 하나가 아니다. 둘은 오늘 딱 한 자리에서 갈리는데, `AdminShell.tsx`의 복구 코드
 * 안내가 삼항으로 `styles.recoveryNoticeLow`와 `styles.recoveryNotice`를 **한 태그에서 둘** 부르기
 * 때문이다(그래서 마흔여섯 태그 · 마흔일곱 참조이고, 아래 면제도 **둘**이다 — 정찰이 예상한
 * 그 둘이 정확히 이것이다).
 *
 * ⚠️ 정찰의 넷째 수 *"마크업을 글자로 무는 계약 0건"* 도 다시 쟀다. 이 열넷을 문자열로 읽는
 * 어드민 계약은 오늘 **여는 태그의 바이트를 물지 않는다** — 무는 것은 클래스 이름
 * (`product-link-bulk.test.ts`의 `toContain("calloutWarning")`)과 식별자
 * (`admin-recovery-codes-remaining.test.ts`의 `recoveryNotice.text` 따위)뿐이라 속성 하나가
 * 붙어도 바이트가 그대로다. 실측 **0건** — 정찰의 수가 값이었다.
 *
 * ## 이 트랙이 하지 않은 것 (축은 하나다)
 *
 * ⚠️ **랜드마크와 현재 위치는 이 트랙의 축이 아니다.** 중첩 `<main>`과 `aria-current` 0건은
 * P3의 재개 조건이 지는 자리이고, 이 파일은 그 둘을 **세어 얼려 두기만** 한다(ⓕ).
 * ⚠️ **S-3도 열지 않았다** — `items`·`links` 두 화면은 **상태 낭독 축으로만** 열렸고 역할
 * 게이트·[수정] 토글·폼·저장 경로는 바이트 불변이다. 라운드 89 트랙 B가 같은 두 파일을
 * **표 이름 축**으로 열었으니, 두 라운드 연속 열린 그 두 파일의 **축은 서로 다르다.**
 */

/** 이 스윕이 걷는 뿌리 둘. `apps/admin/` 밖으로는 한 걸음도 나가지 않는다. */
const SWEEP_ROOTS = ["app", "src"] as const;

/** 이 스윕의 앱 경계 — 값으로 든다(저장소 그물 열다섯의 하나가 아니다). */
const SWEEP_SCOPE_LABEL = "apps/admin/{app,src}/**" as const;

const adminRoot = process.cwd();

/**
 * ⓐ 모집단을 짓는 클래스 이름들 — 어드민이 "상태 문장"을 그리는 자리는 전부 이 다섯 중 하나를
 * 입는다(CSS 모듈 둘에 실재하는 클래스이고, 이 트랙은 **새 클래스를 0건** 만들었다).
 * ⚠️ 손 목록이 아니라 이 이름들로 **파일 전수에서 파생**한다.
 */
const STATUS_CLASSES = [
  "errorBanner",
  "successBanner",
  "errorText",
  "calloutWarning",
  "recoveryNoticeLow",
  "recoveryNotice"
] as const;
type StatusClass = (typeof STATUS_CLASSES)[number];

/** ⓐ 오늘의 실측(= 정찰의 하한과 같다). 래칫은 이 수 아래로 내려가지 않는다. */
const MIN_SITES = 47;
/** 그 자리들이 사는 파일 수. */
const MIN_FILES = 14;
/** ⓔ 래칫 — 출구를 가진 자리의 수는 줄지 않는다(마흔일곱에서 면제 둘을 뺀 값). */
const MIN_ANNOUNCED = 45;

/**
 * ⓑ **출구를 무엇으로 가를 것인가 — 트랙이 값으로 고른 판정과 그 근거.**
 *
 * ⚠️ **본보기를 인용하고 발명하지 않는다.** 오늘 이미 소리로 닿는 한 자리는
 * `ProductLinkBulkReplace.tsx`의 `calloutWarning`이고 그것이 `role="status"`다 — 즉 저장소가
 * 이미 고른 관례는 **성공·경고 쪽이 `status`** 라는 것이다. 이 트랙은 그 관례를 그대로 넓히고,
 * **실패 쪽에만** 새 값을 고른다: `role="alert"`.
 *
 * 왜 실패가 `alert`인가 — `alert`은 ARIA에서 `status`의 assertive 짝이고(암묵
 * `aria-live="assertive"` · `aria-atomic="true"`), 저장·삭제·불러오기가 **실패한 창에서는
 * 운영자가 하려던 조작이 이미 무의미**하다. 반대로 성공·경고는 하던 일이 끝났거나 계속해도
 * 되는 창이라 낭독이 입력을 끊으면 안 된다 — 그래서 polite인 `status`다.
 *
 * 왜 `aria-live`가 아니라 `role`인가 — 본보기가 `role`이고(관례 인용), `role`은 공손함만이 아니라
 * **역할**까지 함께 준다(스크린리더가 "경고"/"알림"으로 갈라 읽는다). 맨 `aria-live`는 공손함만
 * 준다. 그래서 이 트랙의 출구는 셋 중 `role` 둘로 갈린다.
 */
const OUTLET_POLICY: readonly { className: StatusClass; outlet: string; side: "실패" | "성공·경고"; why: string }[] = [
  {
    className: "errorBanner",
    outlet: 'role="alert"',
    side: "실패",
    why:
      "불러오기·저장·삭제가 실패한 창의 문장이다. 다음 조작이 무의미하므로 하던 입력을 끊고 " +
      "말해야 한다 — assertive 짝인 alert."
  },
  {
    className: "errorText",
    outlet: 'role="alert"',
    side: "실패",
    why:
      "로그인·비밀번호 변경·MFA 폼의 실패 문장이다. errorBanner와 같은 실패 축이고 " +
      "클래스만 셸의 것으로 갈린다 — 같은 축은 같은 출구를 갖는다."
  },
  {
    className: "successBanner",
    outlet: 'role="status"',
    side: "성공·경고",
    why:
      "저장·검토 요청·내보내기가 끝난 창의 문장이다. 운영자는 계속 일하는 중이라 낭독이 " +
      "입력을 끊으면 안 된다 — polite인 status(본보기가 고른 그 쪽)."
  },
  {
    className: "calloutWarning",
    outlet: 'role="status"',
    side: "성공·경고",
    why:
      "본보기 자신의 클래스다(ProductLinkBulkReplace의 대량 교체 경고 · 라운드 84). " +
      "임시 비밀번호 카드도 같은 클래스를 입으므로 관례를 그대로 인용한다."
  }
];

/**
 * ⓓ **면제 — 출구를 주지 않는 자리와 그 이유.** ⚠️ 빈 문자열 금지.
 *
 * 오늘 면제는 둘이고, 둘 다 `AdminShell` 헤더의 복구 코드 안내다(한 태그의 삼항이 클래스를
 * 둘 부르므로 자리로는 둘이다).
 */
const EXEMPTIONS: readonly { className: StatusClass; reason: string; provenBy: { file: string; needle: string } }[] = [
  {
    className: "recoveryNotice",
    reason:
      "조작의 결과가 아니라 헤더 크롬이다. 세션이 실어 온 한 값에서 첫 페인트에 파생돼 그 자리에 " +
      "서 있을 뿐이라(누른 것에 대한 답이 아니다) 읽기 순서로 이미 닿는다. 라이브 영역으로 만들면 " +
      "AdminShell이 다시 마운트될 때마다 남은 장수를 제목 위에 덮어 읽는다 — 정보가 아니라 소음이다.",
    provenBy: {
      file: "src/components/AdminShell.tsx",
      needle: "const recoveryNotice = recoveryCodesNotice(session.mfaRecoveryCodesRemaining);"
    }
  },
  {
    className: "recoveryNoticeLow",
    reason:
      "같은 한 태그의 삼항 반대편이다(장수가 적을 때의 강조 클래스). 자리는 둘이지만 여는 태그가 " +
      "하나라 판정도 하나여야 한다 — 한쪽만 출구를 주면 같은 문장이 남은 장수에 따라 들리다 말다 한다.",
    provenBy: {
      file: "src/components/AdminShell.tsx",
      needle: "recoveryNotice.low ? styles.recoveryNoticeLow : styles.recoveryNotice"
    }
  }
];

/**
 * ⚠️ **본보기는 바이트 불변이다** — 이 트랙은 이 한 줄을 인용했지 고치지 않았다(라운드 84).
 */
const EXEMPLAR = {
  file: "src/components/ProductLinkBulkReplace.tsx",
  tag: '<div className={styles.calloutWarning} role="status">'
} as const;

/**
 * 라운드 89 트랙 B의 표 이름 스윕(`app/**`) **밖**에 남은 무명 표. 이 트랙의 축이 아니라
 * 손대지 않지만, 값으로 두어야 다음에 표 이름 축을 여는 트랙이 이 자리를 먼저 본다.
 * ⚠️ 이 목록이 **늘면** 새 무명 표가 붙은 것이고, **줄면** 누군가 이름을 준 것이다 — 둘 다
 * 이 줄을 고치며 지나가게 한다.
 */
const UNNAMED_TABLES_OUTSIDE_ROUND89 = ["src/components/ProductLinkBulkReplace.tsx"] as const;

/** 소리로 닿는 출구 셋. ⚠️ 자리마다 **하나**여야 한다(둘은 어느 쪽으로 읽힐지 갈린다). */
const OUTLET_ATTRIBUTE = /\s(?:role="(?:alert|status)"|aria-live="(?:polite|assertive|off)")/g;

const CLASS_REFERENCE = new RegExp(`styles\\.(${STATUS_CLASSES.join("|")})\\b`, "g");

function listSweptFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx") && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(relative(adminRoot, full).split(sep).join("/"));
      }
    }
  };
  for (const root of SWEEP_ROOTS) walk(join(adminRoot, root));
  return out.sort();
}

function read(relativePath: string): string {
  return readFileSync(join(adminRoot, relativePath), "utf8");
}

type OpenTag = { tag: string; start: number; end: number };

/**
 * 클래스 참조를 감싸는 **여는 태그**를 찾는다.
 *
 * ⚠️ 정규식으로 태그를 긁지 않는 이유: 속성 안에 `=>`·`>`가 들어가는 자리가 어드민에 실재해서
 * (`onClick={() => …}`) `[^<>]*`류의 그물은 그 태그를 잘못 자른다. 그래서 참조 앞의 `<`까지
 * 되짚은 뒤, **중괄호 깊이와 따옴표를 세며** 앞으로 걸어 진짜 닫는 `>`를 찾는다.
 * ⚠️ `indexOf`/`slice`로 구간을 짐작하지 않는다 — 못 찾으면 `null`이고, 부르는 쪽이 그 사실을
 * 단언한다(라운드 78 트랙 E의 슬라이스 가드가 이름 붙인 그 사각: 표식이 사라진 구간은 조용히
 * 비고, 빈 구간 위에서는 어떤 부정 단언도 통과한다).
 */
function openTagAround(source: string, referenceIndex: number): OpenTag | null {
  let start = -1;
  for (let i = referenceIndex; i >= 0; i -= 1) {
    if (source[i] === "<" && /[A-Za-z]/.test(source[i + 1] ?? "")) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const name = /^<([A-Za-z][A-Za-z0-9.]*)/.exec(source.substring(start, start + 48));
  if (!name) return null;
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return { tag: name[1], start, end: i };
  }
  return null;
}

/** 여는 태그부터 짝이 맞는 닫는 태그까지 — 같은 이름의 중첩을 세며 걷는다. 못 찾으면 -1. */
function elementEnd(source: string, open: OpenTag): number {
  if (source[open.end - 1] === "/") return open.end;
  const re = new RegExp(`<${open.tag}(?=[\\s/>])|</${open.tag}\\s*>`, "g");
  re.lastIndex = open.end + 1;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (match[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) return match.index + match[0].length - 1;
      continue;
    }
    const inner = openTagAround(source, match.index + 1);
    if (!inner || source[inner.end - 1] !== "/") depth += 1;
  }
  return -1;
}

function sha12(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").substring(0, 12);
}

type Site = {
  file: string;
  className: StatusClass;
  /** 여는 태그의 바이트(출구 속성 포함). */
  tagText: string;
  /** 여는 태그부터 닫는 태그까지의 바이트에서 **출구 속성만 뺀 것** = 이 트랙 이전의 바이트. */
  bareElement: string;
  outlets: string[];
};

/**
 * ⚠️ **못 푼 자리는 조용히 버리지 않는다.** 파서가 태그를 못 찾으면 그 자리는 모집단에서
 * 빠지고, 빠진 자리는 어떤 단언도 무는 것이 없어 **영원히 초록**이다(라운드 78 트랙 E가 빈
 * 구간에서 만난 그 모양). 그래서 못 푼 자리를 값으로 모으고 ⓐ가 그 목록이 비었음을 단언한다.
 */
const PARSE_FAILURES: string[] = [];

function sitesOf(file: string, source: string): Site[] {
  const out: Site[] = [];
  CLASS_REFERENCE.lastIndex = 0;
  for (const match of source.matchAll(CLASS_REFERENCE)) {
    const referenceIndex = match.index as number;
    const open = openTagAround(source, referenceIndex);
    if (open === null) {
      PARSE_FAILURES.push(`${file}@${referenceIndex}: styles.${match[1]}를 감싸는 여는 태그를 찾지 못했어요`);
      continue;
    }
    const end = elementEnd(source, open);
    if (end <= open.start) {
      PARSE_FAILURES.push(`${file}@${referenceIndex}: <${open.tag}>의 닫는 태그를 찾지 못했어요`);
      continue;
    }
    const tagText = source.substring(open.start, open.end + 1);
    out.push({
      file,
      className: match[1] as StatusClass,
      tagText,
      bareElement: source.substring(open.start, end + 1).replace(OUTLET_ATTRIBUTE, ""),
      outlets: tagText.match(OUTLET_ATTRIBUTE)?.map((outlet) => outlet.trim()) ?? []
    });
  }
  return out;
}

const SWEPT_FILES = listSweptFiles();
const SOURCES = new Map(SWEPT_FILES.map((file) => [file, read(file)] as const));
const ALL_SITES = SWEPT_FILES.flatMap((file) => sitesOf(file, SOURCES.get(file) as string));
const EXEMPT_CLASSES = new Set<StatusClass>(EXEMPTIONS.map((entry) => entry.className));
const POLICY_BY_CLASS = new Map(OUTLET_POLICY.map((entry) => [entry.className, entry] as const));

/**
 * ⓒ **문구 대장 — 마흔일곱 자리의 문장이 바이트로 종전과 같다는 부정 단언.**
 *
 * 각 줄은 `<파일> :: <클래스> :: <sha256 앞 12> :: <미리보기>`이고, 해시가 도는 대상은
 * **출구 속성을 뺀 요소 전체 바이트**다. 즉 이 대장이 초록이라는 것은 *"이 트랙이 더한 속성을
 * 도로 빼면 그 자리의 바이트가 종전과 정확히 같다"* 는 뜻이다 — 문구·클래스·조건·순서 가운데
 * 한 글자라도 달라지면 해시가 갈린다.
 *
 * ⚠️ 이 대장의 값은 **손으로 적은 것이 아니라** 이 트랙이 열기 전 바이트(HEAD)에서 떴고,
 * 워킹트리에서 속성을 빼고 다시 뜬 해시가 열넷 파일 전부에서 그것과 같았다(본보기 한 자리는
 * 종전에도 `role="status"`를 갖고 있었으므로 그 자리도 같은 규칙으로 벗겨 비교했다).
 *
 * ⚠️ 미리보기는 **읽으라고** 있다(해시만 있으면 빨개졌을 때 무엇이 바뀐 자리인지 알 수 없다).
 * 단언이 무는 것은 줄 전체이므로 미리보기도 바이트 불변이다.
 */
const SENTENCE_LEDGER: readonly string[] = [
  "app/analytics/page.tsx :: errorBanner :: b718a2283000 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/audit-logs/page.tsx :: errorBanner :: 133f194b4372 :: <p className={styles.errorBanner}>{exportError}</p>",
  "app/audit-logs/page.tsx :: errorBanner :: b6ff708c30c4 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/audit-logs/page.tsx :: errorBanner :: ef3ebe81b412 :: <p className={styles.errorBanner}>{filterError}</p>",
  "app/audit-logs/page.tsx :: successBanner :: f6bea9e0f2f8 :: <p className={styles.successBanner}>{exportNotice}</p>",
  "app/categories/page.tsx :: errorBanner :: c55c3574a059 :: <p className={styles.errorBanner}>{rowError}</p>",
  "app/categories/page.tsx :: errorBanner :: e2eb16a3fd22 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/categories/page.tsx :: successBanner :: 7f0808ed9245 :: <p className={styles.successBanner}>{rowSuccess}</p>",
  "app/clicks/page.tsx :: errorBanner :: fe171367c455 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/disclosures/page.tsx :: errorBanner :: 2c78dc24c04e :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/disclosures/page.tsx :: errorBanner :: 50a4404fc623 :: <p className={styles.errorBanner}>{error}</p>",
  "app/disclosures/page.tsx :: errorBanner :: 97791fd15cc9 :: <p className={styles.errorBanner}>{createError}</p>",
  "app/disclosures/page.tsx :: successBanner :: cc8263dc5967 :: <p className={styles.successBanner}>{isEditor ? \"검토 요청을 보냈어요.\" : \"저장했어요.\"}</p>",
  "app/disclosures/page.tsx :: successBanner :: cc8263dc5967 :: <p className={styles.successBanner}>{isEditor ? \"검토 요청을 보냈어요.\" : \"저장했어요.\"}</p>",
  "app/error.tsx :: errorBanner :: 4197836ab4c8 :: <p className={styles.errorBanner}>문제가 생겨 이 화면을 표시할 수 없어요.</p>",
  "app/items/page.tsx :: errorBanner :: 97791fd15cc9 :: <p className={styles.errorBanner}>{createError}</p>",
  "app/items/page.tsx :: errorBanner :: a5cad40b10c4 :: <p className={styles.errorBanner}>{editError}</p>",
  "app/items/page.tsx :: errorBanner :: b0255dbc95ad :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/items/page.tsx :: successBanner :: cc8263dc5967 :: <p className={styles.successBanner}>{isEditor ? \"검토 요청을 보냈어요.\" : \"저장했어요.\"}</p>",
  "app/links/page.tsx :: errorBanner :: 6c2a950fa457 :: <p className={styles.errorBanner}>{shareCopyError}</p>",
  "app/links/page.tsx :: errorBanner :: 97791fd15cc9 :: <p className={styles.errorBanner}>{createError}</p>",
  "app/links/page.tsx :: errorBanner :: a5cad40b10c4 :: <p className={styles.errorBanner}>{editError}</p>",
  "app/links/page.tsx :: errorBanner :: c38da88fd562 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/links/page.tsx :: successBanner :: cc8263dc5967 :: <p className={styles.successBanner}>{isEditor ? \"검토 요청을 보냈어요.\" : \"저장했어요.\"}</p>",
  "app/page.tsx :: errorBanner :: fe171367c455 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/reviews/page.tsx :: errorBanner :: 410fd5b849fa :: <p className={styles.errorBanner}>{schedulingWorkerNote(worker)}</p>",
  "app/reviews/page.tsx :: errorBanner :: 7f38ce5e2b7e :: <p className={styles.errorBanner}>{actionError}</p>",
  "app/reviews/page.tsx :: errorBanner :: dbaac70d3bd4 :: <p className={styles.errorBanner}>{detailError}</p>",
  "app/reviews/page.tsx :: errorBanner :: ed4e28dfe530 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/reviews/page.tsx :: successBanner :: 23572b5c31b9 :: <p className={styles.successBanner}>{actionSuccess}</p>",
  "app/users-lookup/page.tsx :: errorBanner :: ed4444d4eaad :: <p className={styles.errorBanner}>{searchError}</p>",
  "app/users/page.tsx :: calloutWarning :: 8cbcd21c7305 :: <div className={styles.calloutWarning}> <strong> {notice.email} 계정의 임시 비밀번호예요. 이 비밀번호는 다",
  "app/users/page.tsx :: errorBanner :: 97791fd15cc9 :: <p className={styles.errorBanner}>{createError}</p>",
  "app/users/page.tsx :: errorBanner :: adb6770efeb2 :: <p className={styles.errorBanner}> {loadError.message} {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 ",
  "app/users/page.tsx :: errorBanner :: c55c3574a059 :: <p className={styles.errorBanner}>{rowError}</p>",
  "app/users/page.tsx :: successBanner :: 7f0808ed9245 :: <p className={styles.successBanner}>{rowSuccess}</p>",
  "src/components/AdminShell.tsx :: errorText :: 178e67ac803b :: <p className={styles.errorText}>{verifyError}</p>",
  "src/components/AdminShell.tsx :: errorText :: 3eeaa20b4623 :: <p className={styles.errorText}>{mfaError}</p>",
  "src/components/AdminShell.tsx :: errorText :: 77e3adaa7b7b :: <p className={styles.errorText}>{submitError}</p>",
  "src/components/AdminShell.tsx :: errorText :: 7d9eec7bc754 :: <p className={styles.errorText}> {loadError.message} {loadError.canRetry ? ( <button typ",
  "src/components/AdminShell.tsx :: errorText :: c6157b8e68be :: <p className={styles.errorText}>{formError}</p>",
  "src/components/AdminShell.tsx :: errorText :: c6157b8e68be :: <p className={styles.errorText}>{formError}</p>",
  "src/components/AdminShell.tsx :: recoveryNotice :: 80d6ac2e6369 :: <span className={recoveryNotice.low ? styles.recoveryNoticeLow : styles.recoveryNotice}>",
  "src/components/AdminShell.tsx :: recoveryNoticeLow :: 80d6ac2e6369 :: <span className={recoveryNotice.low ? styles.recoveryNoticeLow : styles.recoveryNotice}>",
  "src/components/ProductLinkBulkReplace.tsx :: calloutWarning :: af7db92cdff7 :: <div className={styles.calloutWarning}> <strong>적용 결과를 확인해 주세요</strong> <span>{timeoutNo",
  "src/components/ProductLinkBulkReplace.tsx :: errorBanner :: 50a4404fc623 :: <p className={styles.errorBanner}>{error}</p>",
  "src/components/ProductLinkBulkReplace.tsx :: successBanner :: 0e5594a355cc :: <p className={styles.successBanner}> 적용 {applyResult.applied}건 · 건너뜀(변경 없음) {applyResult"
];

/** 대장 줄의 모양 — 파생한 자리를 같은 모양으로 찍어 비교한다. */
function ledgerLineOf(site: Site): string {
  return `${site.file} :: ${site.className} :: ${sha12(site.bareElement)} :: ${site.bareElement
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 88)}`;
}

describe("어드민 상태 문장이 소리로 나간다 (라운드 90 트랙 B)", () => {
  describe("ⓐ 모집단 — 손 목록이 아니라 파일 전수에서 파생한다", () => {
    it("스윕은 apps/admin 안에서만 돈다 (저장소 그물 열다섯의 하나가 아니다)", () => {
      expect(SWEEP_SCOPE_LABEL).toBe("apps/admin/{app,src}/**");
      expect(SWEEP_ROOTS.length, "뿌리가 늘었다면 이 스윕의 경계가 바뀐 것이에요").toBe(2);
      for (const file of SWEPT_FILES) {
        expect(
          SWEEP_ROOTS.some((root) => file.startsWith(`${root}/`)),
          `${file}: 스윕이 ${SWEEP_SCOPE_LABEL} 밖으로 나갔어요`
        ).toBe(true);
        expect(file, `${file}: 스윕이 앱 밖의 경로를 걷었어요`).not.toContain("..");
      }
      // 유령 방지 — 모집단이 0건이면 아래 단언들은 영원히 초록이다.
      expect(SWEPT_FILES.length, "스윕이 걷은 비테스트 .tsx").toBeGreaterThan(0);
    });

    it("클래스 참조가 전부 여는 태그로 풀린다 (못 푼 자리 0건)", () => {
      expect(PARSE_FAILURES, "파서가 못 푼 자리는 모집단에서 조용히 빠져요").toEqual([]);
    });

    it("상태 문장의 자리는 마흔일곱이고 열넷 파일에 산다", () => {
      expect(ALL_SITES.length, "상태 문장 자리 수").toBeGreaterThanOrEqual(MIN_SITES);
      const files = new Set(ALL_SITES.map((site) => site.file));
      expect(files.size, "상태 문장이 사는 파일 수").toBeGreaterThanOrEqual(MIN_FILES);
      // 다섯 클래스가 전부 실재한다 — 하나가 사라지면 모집단이 조용히 좁아진다.
      const seen = new Set(ALL_SITES.map((site) => site.className));
      for (const className of STATUS_CLASSES) {
        expect(seen, `styles.${className} 자리가 어드민에서 사라졌어요 — 모집단이 좁아졌습니다`).toContain(className);
      }
    });

    it("모집단의 클래스는 CSS 모듈에 실재한다 (새 클래스 0건)", () => {
      const css = [read("src/components/admin-page.module.css"), read("src/components/admin-shell.module.css")].join(
        "\n"
      );
      for (const className of STATUS_CLASSES) {
        expect(css, `.${className}가 CSS 모듈에 없어요 — 이 트랙은 새 클래스를 만들지 않습니다`).toContain(
          `.${className}`
        );
      }
    });
  });

  describe("ⓑ 출구 — 자리마다 소리로 닿는 출구 하나", () => {
    it("판정표가 실패와 성공·경고를 값으로 가르고 근거를 적는다 (빈 문자열 금지)", () => {
      for (const entry of OUTLET_POLICY) {
        expect(entry.why.trim().length, `${entry.className}: 근거가 비어 있어요`).toBeGreaterThan(0);
        expect(entry.outlet, `${entry.className}: 출구는 role 둘 중 하나예요`).toMatch(/^role="(alert|status)"$/);
      }
      const failure = OUTLET_POLICY.filter((entry) => entry.side === "실패").map((entry) => entry.outlet);
      const success = OUTLET_POLICY.filter((entry) => entry.side === "성공·경고").map((entry) => entry.outlet);
      expect(new Set(failure), "실패 쪽은 한 값으로 모여야 해요").toEqual(new Set(['role="alert"']));
      expect(new Set(success), "성공·경고 쪽은 한 값으로 모여야 해요").toEqual(new Set(['role="status"']));
      // ⚠️ 관례를 인용하지 발명하지 않는다 — 본보기의 클래스가 성공·경고 쪽에 서 있는가.
      const exemplarPolicy = POLICY_BY_CLASS.get("calloutWarning");
      expect(exemplarPolicy?.side, "본보기(calloutWarning)는 성공·경고 쪽이에요").toBe("성공·경고");
      expect(EXEMPLAR.tag, "본보기가 고른 값이 status가 아니게 되었어요").toContain(exemplarPolicy?.outlet as string);
    });

    it("면제가 아닌 자리는 전부 출구를 갖고, 출구는 정확히 하나다", () => {
      const silent: string[] = [];
      for (const site of ALL_SITES) {
        if (EXEMPT_CLASSES.has(site.className)) continue;
        if (site.outlets.length === 0) silent.push(`${site.file} :: ${site.className}`);
        expect(
          site.outlets.length,
          `${site.file} :: ${site.className}: 출구가 둘 이상이면 어느 공손함으로 읽힐지 갈려요 — ${site.tagText}`
        ).toBeLessThanOrEqual(1);
      }
      expect(silent, "소리로 닿지 않는 상태 문장이 남았어요 — 여는 태그에 role 한 속성을 주세요").toEqual([]);
    });

    it("각 자리의 출구가 판정표와 같다 (표식을 손으로 복사하지 않는다)", () => {
      for (const site of ALL_SITES) {
        if (EXEMPT_CLASSES.has(site.className)) continue;
        const policy = POLICY_BY_CLASS.get(site.className);
        expect(policy, `${site.className}: 판정표에 없는 클래스가 모집단에 들어왔어요`).toBeDefined();
        expect(
          site.outlets[0],
          `${site.file} :: ${site.className}: 판정표는 ${policy?.outlet}인데 자리가 다른 출구를 골랐어요`
        ).toBe(policy?.outlet);
      }
    });
  });

  describe("ⓒ 문구 불변 — 속성을 빼면 종전 바이트다", () => {
    it("마흔일곱 자리의 문장이 대장과 바이트로 같다", () => {
      const derived = ALL_SITES.map(ledgerLineOf).sort();
      expect(
        derived,
        "상태 문장의 바이트가 달라졌어요 — 이 트랙이 여는 축은 여는 태그의 속성 하나뿐입니다"
      ).toEqual([...SENTENCE_LEDGER].sort());
      expect(SENTENCE_LEDGER.length).toBe(MIN_SITES);
    });

    it("여는 태그에 붙은 것은 className과 출구뿐이다 (픽셀 0 · 새 상호작용 표면 0건)", () => {
      for (const site of ALL_SITES) {
        const attrs = site.tagText.replace(/^<[A-Za-z][A-Za-z0-9.]*/, "").replace(/\/?>$/, "");
        const names = [...attrs.matchAll(/(?:^|\s)([A-Za-z-]+)=/g)].map((match) => match[1]);
        expect(
          names.filter((name) => name !== "className" && name !== "role" && name !== "aria-live"),
          `${site.file} :: ${site.className}: 상태 문장 태그에 다른 속성이 붙었어요 — ${site.tagText}`
        ).toEqual([]);
        expect(
          site.tagText,
          `${site.file} :: ${site.className}: 상태 문장이 조작 표면이 되었어요`
        ).not.toMatch(/tabIndex|onClick|style=|role="button"/);
      }
    });

    it("출구 속성을 빼면 태그가 className 하나만 남는다", () => {
      for (const site of ALL_SITES) {
        const bareTag = site.tagText.replace(OUTLET_ATTRIBUTE, "");
        expect(bareTag, `${site.file} :: ${site.className}: 벗긴 태그에 출구가 남았어요`).not.toMatch(
          /role=|aria-live=/
        );
        expect(
          (bareTag.match(/className=/g) ?? []).length,
          `${site.file} :: ${site.className}: className이 하나가 아니에요`
        ).toBe(1);
      }
    });
  });

  describe("ⓓ 면제 — 이유를 값으로 든다", () => {
    it("면제는 둘이고 이유가 비어 있지 않다", () => {
      expect(EXEMPTIONS.length, "면제 수").toBe(2);
      for (const entry of EXEMPTIONS) {
        expect(entry.reason.trim().length, `${entry.className}: 면제 이유가 비어 있어요`).toBeGreaterThan(0);
        // 이유는 "왜 조작의 답이 아닌가"를 걸고 말해야 한다.
        expect(entry.reason, `${entry.className}: 이유가 이 자리의 성질을 걸지 않아요`).toMatch(/크롬|삼항|세션|소음/);
      }
    });

    it("면제의 이유가 소스로 증명된다 (유령 면제 금지)", () => {
      for (const entry of EXEMPTIONS) {
        const source = SOURCES.get(entry.provenBy.file);
        expect(source, `${entry.provenBy.file}: 면제가 가리키는 파일이 스윕에 없어요`).toBeDefined();
        expect(source, `${entry.provenBy.file}: 면제의 증거 조각이 사라졌어요 — ${entry.provenBy.needle}`).toContain(
          entry.provenBy.needle
        );
      }
    });

    it("면제된 자리는 실제로 출구가 없고, 면제 목록 밖의 조용한 자리는 없다", () => {
      const silentClasses = new Set(
        ALL_SITES.filter((site) => site.outlets.length === 0).map((site) => site.className)
      );
      expect([...silentClasses].sort(), "조용한 자리의 클래스가 면제 목록과 갈려요").toEqual(
        [...EXEMPT_CLASSES].sort()
      );
      // 면제 줄이 유령이 되지 않게 — 면제 클래스가 오늘 실제로 모집단에 서 있는가.
      for (const className of EXEMPT_CLASSES) {
        expect(
          ALL_SITES.some((site) => site.className === className),
          `${className}: 면제 줄이 가리키는 자리가 사라졌어요 — 그 줄을 지우세요`
        ).toBe(true);
      }
      // 면제 둘은 한 여는 태그를 나눠 쓴다(자리는 둘 · 태그는 하나).
      const exemptTags = new Set(ALL_SITES.filter((site) => EXEMPT_CLASSES.has(site.className)).map((s) => s.tagText));
      expect(exemptTags.size, "면제 둘이 한 태그를 나눠 쓰지 않게 되었어요").toBe(1);
    });
  });

  describe("ⓔ 래칫 — 소리로 닿는 자리의 수는 줄지 않는다", () => {
    it("마흔다섯 자리가 출구를 갖는다", () => {
      const announced = ALL_SITES.filter((site) => site.outlets.length === 1);
      expect(announced.length, "출구를 가진 상태 문장 자리").toBeGreaterThanOrEqual(MIN_ANNOUNCED);
      expect(announced.length + EXEMPTIONS.length).toBe(ALL_SITES.length);
      // 종전(라운드 89까지)에 소리로 닿던 자리는 하나였다 — 그 하나가 오늘도 서 있는가.
      expect(
        SOURCES.get(EXEMPLAR.file),
        "본보기가 사라졌어요 — 이 트랙의 관례는 그 한 줄을 인용한 것입니다"
      ).toContain(EXEMPLAR.tag);
    });
  });

  describe("ⓕ 바이트 불변 — 출구 축 말고는 한 글자도 건드리지 않았다", () => {
    /**
     * ⚠️ **라운드 89 트랙 B의 열일곱은 `app/**` 의 수다.** 이 스윕은 뿌리가 하나 더 넓어서
     * (`src/`도 걷는다) 표를 열여덟 본다 — 열여덟째는 `ProductLinkBulkReplace`의 미리보기 표이고
     * **오늘 이름이 없다.** 그 자리는 라운드 89 스윕의 모집단 **밖**이었고, 이 트랙의 축은
     * 상태 낭독이지 표 이름이 아니라서 **손대지 않는다** — 대신 그 사실을 값으로 적어 둔다
     * (`UNNAMED_TABLES_OUTSIDE_ROUND89`: 다음에 표 이름 축을 여는 트랙이 먼저 집을 자리다).
     */
    it("라운드 89 B의 표 이름 열일곱이 그대로다", () => {
      const appTables = SWEPT_FILES.filter((file) => file.startsWith("app/")).reduce(
        (sum, file) => sum + ((SOURCES.get(file) as string).match(/<table(?=[\s>])/g) ?? []).length,
        0
      );
      expect(appTables, "app/** 의 표 수가 열일곱에서 갈렸어요").toBe(17);

      const unnamed: string[] = [];
      for (const file of SWEPT_FILES) {
        const source = SOURCES.get(file) as string;
        for (const match of source.matchAll(/<table(?=[\s>])/g)) {
          const open = openTagAround(source, (match.index as number) + 1);
          expect(open, `${file}: <table>을 풀지 못했어요`).not.toBeNull();
          const tagText = source.substring((open as OpenTag).start, (open as OpenTag).end + 1);
          if (!/aria-label(?:ledby)?=/.test(tagText)) unnamed.push(file);
        }
      }
      expect(unnamed.sort(), "표가 이름을 잃었거나 새 무명 표가 붙었어요").toEqual(UNNAMED_TABLES_OUTSIDE_ROUND89);
    });

    it("추이 표 둘의 aria-label과 title 속성 넷이 그대로다", () => {
      for (const [file, countNoun] of [
        ["app/analytics/page.tsx", "이벤트 수"],
        ["app/clicks/page.tsx", "클릭 수"]
      ] as const) {
        expect(SOURCES.get(file), `${file}: 추이 표 이름이 바뀌었어요`).toContain(
          "aria-label={`최근 ${summary.days}일 일별 " + countNoun + " 표`}"
        );
      }
      const titles = SWEPT_FILES.reduce(
        (sum, file) => sum + ((SOURCES.get(file) as string).match(/\stitle=\{/g) ?? []).length,
        0
      );
      expect(titles, "title 속성의 수가 넷에서 갈렸어요").toBe(4);
    });

    it("DNC-009 고지와 DNC-010 제휴 고지가 그대로다", () => {
      expect(SOURCES.get("app/clicks/page.tsx"), "DNC-009 고지가 바뀌었어요").toContain(
        "※ 클릭 수가 많은 순서예요. 이 순위는 앱의 추천 순서나 추천 점수에 반영되지 않아요."
      );
      // DNC-010: 제휴 고지는 어드민이 편집하는 값이라 화면은 제목과 설명만 짓는다 — 그 두 줄이 그대로인가.
      const disclosures = SOURCES.get("app/disclosures/page.tsx") as string;
      expect(disclosures, "제휴 고지 화면의 제목이 바뀌었어요").toContain("<h1>제휴 고지 문구</h1>");
      expect(disclosures, "제휴 고지 화면의 설명이 바뀌었어요").toContain(
        "제휴, 스폰서, 영양제 관련 고지 문구를 앱 배포 없이 수정해요."
      );
    });

    it("S-3의 자리(items·links)는 상태 낭독 축으로만 열렸다", () => {
      for (const file of ["app/items/page.tsx", "app/links/page.tsx"] as const) {
        const source = SOURCES.get(file) as string;
        // 역할 게이트·[수정] 토글·저장 경로는 이 트랙이 만지지 않는다(라운드 89 B와 같은 앵커).
        expect(source, `${file}: 역할 게이트 문구가 사라졌어요`).toContain("ADMIN_EDITOR_WRITE_ROLE_NOTICE");
        expect(source, `${file}: 표 이름 축(라운드 89 B)이 흔들렸어요`).toContain("aria-labelledby=");
        // 이 트랙이 두 파일에 더한 것은 출구 속성뿐이다.
        const roles = (source.match(/\srole="(?:alert|status)"/g) ?? []).length;
        const statusSites = ALL_SITES.filter((site) => site.file === file).length;
        expect(roles, `${file}: 상태 문장 자리 밖에 role이 붙었어요`).toBe(statusSites);
      }
    });

    it("랜드마크와 현재 위치는 이 트랙의 축이 아니다 (P3가 지는 자리)", () => {
      const mains = SWEPT_FILES.reduce(
        (sum, file) => sum + ((SOURCES.get(file) as string).match(/<main(?=[\s>])/g) ?? []).length,
        0
      );
      const ariaCurrent = SWEPT_FILES.reduce(
        (sum, file) => sum + ((SOURCES.get(file) as string).match(/aria-current/g) ?? []).length,
        0
      );
      expect(mains, "<main>의 수가 다섯에서 갈렸어요 — 중첩 main은 P3의 축입니다").toBe(5);
      expect(ariaCurrent, "aria-current가 붙었어요 — 현재 위치는 P3의 축입니다").toBe(0);
    });

    it("본보기의 여는 태그가 바이트 불변이다 (관례를 인용하지 발명하지 않는다)", () => {
      expect(SOURCES.get(EXEMPLAR.file)).toContain(EXEMPLAR.tag);
      expect(SOURCES.get(EXEMPLAR.file), "본보기 카드의 문구가 바뀌었어요").toContain(
        "<strong>적용 결과를 확인해 주세요</strong>"
      );
    });
  });
});
