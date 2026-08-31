import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 91 트랙 B — **어드민이 자기 자리를 말한다: 랜드마크가 하나로 정리되고 현재 위치가 선다.**
 *
 * 어제까지 어드민은 한 화면에 `<main>`을 **둘** 세웠다. 셸(`AdminShell.tsx`)이 하나를 세우고,
 * 그 안에 들어오는 라우트 화면(`app/page.tsx` · `app/error.tsx` · `app/not-found.tsx`)이 각자
 * 하나를 더 세웠다 — 스크린리더의 랜드마크 목록에는 "main"이 두 줄 서고, 어느 쪽이 본문인지는
 * 아무도 말해 주지 않았다. 그리고 내비게이션의 활성 링크는 **색으로만** 활성이었다
 * (`navLinkActive`는 클래스이지 표기가 아니다) — 운영자는 열한 링크 가운데 지금 어디에 서
 * 있는지 들을 수 없었다.
 *
 * 이 트랙이 한 것은 둘뿐이다: 중첩 `<main>` 셋을 `<div>`로 내리고(태그 이름만 · `style`·
 * `className`·자식 바이트 불변), 활성 내비 링크에 `aria-current` 한 속성을 세운다(값은 손이
 * 아니라 `isActive`에서 파생한다). **보이는 화면은 한 픽셀도 바뀌지 않는다** — 둘 다 블록
 * 요소이고, 더한 속성은 레이아웃 속성이 아니다. 이 파일이 그 둘을 모집단으로 만든다.
 *
 * ## ⚠️⚠️ 이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다
 *
 * 저장소에는 앱 경계를 넘어 도는 그물들이 있다(모바일·어드민·API·`packages`를 함께 걷는
 * **열다섯** 목록 — 슬라이스 가드·사문 대장·주석 관용 앵커 대장 따위). **이 파일은 그 하나가
 * 아니다.** 이 스윕이 걷는 것은 아래 `SWEEP_ROOTS` 둘 — `apps/admin/{app,src}/**` 뿐이다.
 * 그 사실을 주석이 아니라 **값**으로 두는 이유는 라운드 89 트랙 B의 `admin-table-name.test.ts` ·
 * 라운드 90 트랙 B의 `admin-status-announce.test.ts`와 같다: 다음 라운드에 누군가 이 파일을
 * "저장소 랜드마크 그물"로 넓히려 할 때 넓히는 손이 `SWEEP_ROOTS`를 고치며 지나가게 하기
 * 위해서다. 주석은 조용히 거짓이 되지만 값은 빨개진다(`SWEEP_SCOPE_LABEL` · `IS_REPO_WIDE_NET`).
 *
 * ## ⚠️⚠️ 전제 재실측 — 중첩 판정은 App Router의 렌더 트리라 다시 쟀다
 *
 * *"셸의 `<main>` 안에서 또 `<main>`이 선다"* 는 파일 이름이 아니라 **렌더 트리**의 사실이다.
 * 라우트 그룹(`(group)`)이나 병렬 라우트(`@slot`)가 끼면 중간에 다른 `layout.tsx`가 서서 판정이
 * 뒤집힐 수 있다. 그래서 이 파일은 그 전제를 **주석이 아니라 단언으로** 다시 잰다(아래 ⓑ):
 * 오늘 `app/**`의 `layout.tsx`는 **하나**이고, 라우트 그룹 **0건** · 병렬 라우트 **0건**이며,
 * 그 하나뿐인 레이아웃이 `{children}`을 감싸는 컴포넌트가 곧 셸이다(그 이름과 경로도 손으로
 * 적지 않고 `layout.tsx`에서 파생한다).
 *
 * ⚠️ `app/global-error.tsx`는 **모집단 밖**이고, 그 이유도 값이다(`OWN_DOCUMENT_REASON`):
 * Next의 관례상 이 파일은 루트 레이아웃을 **대체**하며 자기 `<html>`·`<body>`를 세운다 —
 * 셸이 아예 마운트되지 않은 자리라 그 안의 `<main>`은 중첩이 아니라 **그 문서의 유일한 본문**이다.
 * 같은 규칙이 `app/layout.tsx`도 걸러 낸다(그 파일이 `<html>`을 세우는 자리다).
 *
 * ## 오늘의 값
 *
 *  · 걸은 비테스트 `.tsx` **18** · 여는 `<main>` 전수 **2**(셸 하나 + `global-error` 하나) ·
 *    셸 안에서 다시 서는 `<main>` **0**(어제 셋) · `aria-current` **1**(어제 0) · 내비 링크 **11**.
 *
 * ⚠️ 이 파일과 짝인 `admin-status-announce.test.ts`(라운드 90 B)는 같은 두 수를 **얼려 두기만**
 * 한다 — 축을 지는 것은 여기다. 그 트랙이 상태 낭독 축을 열 때 이 축을 모르는 채 지나가지
 * 않도록 두 자리가 서로를 부른다(*한 트랙이 한 그물에 축 둘을 얹지 않는다*).
 */

/** 이 스윕이 걷는 뿌리 둘. `apps/admin/` 밖으로는 한 걸음도 나가지 않는다. */
const SWEEP_ROOTS = ["app", "src"] as const;

/** 이 스윕의 앱 경계 — 값으로 든다(저장소 그물 열다섯의 하나가 아니다). */
const SWEEP_SCOPE_LABEL = "apps/admin/{app,src}/**" as const;

/** ⚠️ 이 파일이 저장소 그물이 **아니라는** 사실 자체를 값으로 든다. */
const IS_REPO_WIDE_NET = false;

/** 유령 방지 — 걷기가 통째로 깨지면 모집단이 0이 되고 아래 부정 단언이 전부 조용해진다. */
const SWEPT_FILE_FLOOR = 12;

/** `app/global-error.tsx`가 모집단 밖인 이유 — 비어 있을 수 없다(아래 ⓑ가 길이를 잰다). */
const OWN_DOCUMENT_REASON =
  "Next 관례상 루트 레이아웃을 대체하며 자기 <html>/<body>를 세운다 — 셸이 마운트되지 않은 문서라 " +
  "그 <main>은 중첩이 아니라 그 문서의 유일한 본문이다";

const adminRoot = process.cwd();

// ── 모집단 ────────────────────────────────────────────────────────────────────

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

function sha12(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").substring(0, 12);
}

/**
 * ⚠️ **세기 전에 주석을 지운다.** 이 파일의 머리말이 `<main>`·`aria-current`를 여러 번 인용하고,
 * 제품 소스의 주석도 같은 낱말을 부른다 — 주석을 남긴 채 세면 인용이 자리로 둔갑한다.
 * 길이는 보존한다(자리 번호를 쓰는 다른 계산과 어긋나지 않게).
 *
 * ⚠️ 이 마스킹이 **진짜로 도는지**는 아래 ⓐ가 판정한다: 오늘 마스킹 전후의 `<main>` 수가 같고
 * (인용이 자리를 만들지도, 마스킹이 자리를 먹지도 않았다), 마스킹이 지운 바이트는 0이 아니다.
 */
function maskComments(source: string): string {
  const out = source.split("");
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '"' || char === "'" || char === "`") {
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === char) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") {
        out[i] = " ";
        i += 1;
      }
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const stop = source.indexOf("*/", i + 2);
      const end = stop < 0 ? source.length : stop + 2;
      while (i < end) {
        if (source[i] !== "\n") out[i] = " ";
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return out.join("");
}

const SWEPT_FILES = listSweptFiles();
const SOURCES = new Map(SWEPT_FILES.map((file) => [file, read(file)] as const));
const CODE = new Map(SWEPT_FILES.map((file) => [file, maskComments(SOURCES.get(file) as string)] as const));

const OPEN_MAIN = /<main(?=[\s/>])/g;
const ARIA_CURRENT = /aria-current/g;

function countIn(map: ReadonlyMap<string, string>, file: string, needle: RegExp): number {
  return ((map.get(file) as string).match(needle) ?? []).length;
}

function totalOf(map: ReadonlyMap<string, string>, needle: RegExp): number {
  return SWEPT_FILES.reduce((sum, file) => sum + countIn(map, file, needle), 0);
}

/** 자기 `<html>`을 세우는 파일 — 손 목록이 아니라 소스에서 파생한다(오늘 둘). */
const OWN_DOCUMENT_FILES = SWEPT_FILES.filter((file) => (CODE.get(file) as string).includes("<html"));

// ── App Router 렌더 트리 재실측 ───────────────────────────────────────────────

function listAppEntries(): { layouts: string[]; routeGroups: string[]; parallelRoutes: string[] } {
  const layouts: string[] = [];
  const routeGroups: string[] = [];
  const parallelRoutes: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      const rel = relative(adminRoot, full).split(sep).join("/");
      if (entry.isDirectory()) {
        if (entry.name.startsWith("(")) routeGroups.push(rel);
        if (entry.name.startsWith("@")) parallelRoutes.push(rel);
        walk(full);
      } else if (entry.name === "layout.tsx" || entry.name === "template.tsx") {
        layouts.push(rel);
      }
    }
  };
  walk(join(adminRoot, "app"));
  return { layouts: layouts.sort(), routeGroups: routeGroups.sort(), parallelRoutes: parallelRoutes.sort() };
}

const APP_TREE = listAppEntries();

/**
 * ⚠️ 모집단을 짓다 못 푼 자리는 **조용히 버리지 않는다** — 빈 값 위에서는 어떤 부정 단언도
 * 통과한다(라운드 78 트랙 E의 슬라이스 가드가 이름 붙인 그 사각). 모듈 로드 시점의 파생은
 * `expect`가 아니라 이 함수로 막는다(단언은 테스트 안에서만 선다).
 */
function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

/** 하나뿐인 레이아웃이 `{children}`을 감싸는 컴포넌트 = 셸. 이름도 경로도 파생한다. */
function resolveShellFile(): { component: string; file: string } {
  const layout = read(must(APP_TREE.layouts[0], "app/** 아래에서 layout.tsx를 찾지 못했어요"));
  const wrapper = must(
    /<([A-Z][A-Za-z0-9]*)>\{children\}<\/\1>/.exec(maskComments(layout)),
    "layout.tsx에서 {children}을 감싸는 컴포넌트를 찾지 못했어요"
  );
  const component = wrapper[1];
  const importLine = must(
    new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "([^"]+)"`).exec(layout),
    `${component}의 import 경로를 찾지 못했어요`
  );
  const file = relative(adminRoot, join(adminRoot, "app", `${importLine[1]}.tsx`)).split(sep).join("/");
  return { component, file };
}

const SHELL = resolveShellFile();

/** 라우트 진입 파일 — 셸 **안**에 그려지는 자리(page/error/not-found/loading/default). */
const ROUTE_ENTRY_NAMES = ["page.tsx", "error.tsx", "not-found.tsx", "loading.tsx", "default.tsx"] as const;

const INSIDE_SHELL_FILES = SWEPT_FILES.filter(
  (file) =>
    file.startsWith("app/") &&
    ROUTE_ENTRY_NAMES.some((name) => file.endsWith(`/${name}`) || file === `app/${name}`) &&
    !OWN_DOCUMENT_FILES.includes(file)
);

// ── 내비게이션 ────────────────────────────────────────────────────────────────

const SHELL_CODE = CODE.get(SHELL.file) as string;
const SHELL_SOURCE = SOURCES.get(SHELL.file) as string;

/** `NAV_ITEMS` 표를 소스에서 판다 — 표 자체는 **읽기만** 한다(미러 스윕·역할 게이트가 문다). */
function navItems(): { href: string; label: string }[] {
  const block = must(
    /const NAV_ITEMS: Array<\{[^}]*\}> = \[([\s\S]*?)\n\];/.exec(SHELL_SOURCE),
    "AdminShell.tsx에서 NAV_ITEMS를 찾지 못했어요"
  );
  return [...block[1].matchAll(/\{ href: "([^"]+)", label: "([^"]+)"/g)].map((match) => ({
    href: match[1],
    label: match[2]
  }));
}

const NAV_ITEMS_TODAY = navItems();

// ── 요소 바이트 ───────────────────────────────────────────────────────────────

/** 여는 태그를 닫는 `>`의 자리(중괄호 깊이·따옴표를 세며 걷는다 · 못 찾으면 -1). */
function openTagEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return i;
  }
  return -1;
}

/**
 * 여는 태그부터 짝이 맞는 닫는 태그까지의 **바이트**.
 *
 * ⚠️ `indexOf`로 닫는 태그를 짐작하지 않는다 — 같은 이름의 자식이 안에 서면 첫 닫는 태그가
 * 그 자식의 것이다. 못 풀면 `null`이고, 부르는 쪽이 그 사실을 단언한다(라운드 78 트랙 E의
 * 슬라이스 가드가 이름 붙인 사각: 빈 구간 위에서는 어떤 부정 단언도 통과한다).
 */
function elementBytes(source: string, start: number, tag: string): string | null {
  const end = openTagEnd(source, start);
  if (end < 0) return null;
  if (source[end - 1] === "/") return source.substring(start, end + 1);
  const re = new RegExp(`<${tag}(?=[\\s/>])|</${tag}\\s*>`, "g");
  re.lastIndex = end + 1;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (match[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) return source.substring(start, match.index + match[0].length);
      continue;
    }
    const innerEnd = openTagEnd(source, match.index);
    if (innerEnd < 0) return null;
    if (source[innerEnd - 1] !== "/") depth += 1;
  }
  return null;
}

/** 기본 내보내기가 돌려주는 JSX의 **뿌리 요소** — 자리를 손으로 적지 않고 소스에서 판다. */
function defaultExportRoot(file: string, tag: string): string | null {
  const source = SOURCES.get(file) as string;
  const declaration = source.indexOf("export default function");
  if (declaration < 0) return null;
  const returned = source.indexOf("return (", declaration);
  if (returned < 0) return null;
  const open = source.indexOf(`<${tag}`, returned);
  if (open < 0) return null;
  return elementBytes(source, open, tag);
}

/** 셸의 내비가 그리는 `<Link>` 요소 — `NAV_ITEMS.filter(` 뒤의 첫 자리다. */
function navLinkElement(): string | null {
  const map = SHELL_SOURCE.indexOf("NAV_ITEMS.filter(");
  if (map < 0) return null;
  const open = SHELL_SOURCE.indexOf("<Link", map);
  if (open < 0) return null;
  return elementBytes(SHELL_SOURCE, open, "Link");
}

function preview(text: string): string {
  return text.replace(/\s+/g, " ").substring(0, 96);
}

/** 이 트랙이 랜드마크에서 내린 태그 이름 — 되돌리기의 값이다. */
const RESTORED_TAG = "main";

/** 랜드마크였던 뿌리를 **종전 태그로 되돌린** 바이트(속성·자식은 손대지 않는다). */
function restoreLandmark(element: string): string {
  return element.replace(/^<div/, `<${RESTORED_TAG}`).replace(/<\/div>$/, `</${RESTORED_TAG}>`);
}

/** 내비 링크에서 **이 트랙이 더한 속성 한 줄만** 도로 뺀 바이트. */
function restoreNavLink(element: string): string {
  return element.replace(/\n[ \t]*aria-current=\{[^}]*\}/, "");
}

/**
 * ⓓ **문구·픽셀 불변의 부정 단언** — 라운드 90 트랙 B의 sha256 형식을 그대로 인용한다.
 * 각 줄은 `<파일> :: <키> :: <sha256 앞 12> :: <미리보기>`이고, 해시가 도는 대상은 **이 트랙이
 * 더한 것을 도로 뺀 요소 전체 바이트**다. 즉 이 대장이 초록이라는 것은 *"태그 이름을 되돌리고
 * 속성 한 줄을 빼면 그 자리의 바이트가 종전과 정확히 같다"* 는 뜻이다 — 문구·클래스·`style`·
 * 조건·순서 가운데 한 글자라도 달라지면 해시가 갈린다(= 픽셀이 바뀌면 빨개진다).
 *
 * ⚠️ 값은 손으로 적은 것이 아니라 **이 트랙이 열기 전 바이트(HEAD)** 에서 떴고, 워킹트리에서
 * 되돌려 다시 뜬 해시가 네 자리 전부에서 그것과 같았다.
 * ⚠️ 미리보기는 **읽으라고** 있다(해시만 있으면 빨개졌을 때 무엇이 바뀐 자리인지 알 수 없다).
 * 단언이 무는 것은 줄 전체이므로 미리보기도 바이트 불변이다.
 */
const ELEMENT_LEDGER: readonly string[] = [
  'app/page.tsx :: 랜드마크였던 뿌리 :: 9cdfe879d09b :: <main style={{ background: "#FFF8F1", color: "#242424", minHeight: "100vh", padding: 32 }}> <p s',
  "app/error.tsx :: 랜드마크였던 뿌리 :: c81a19b8e0fd :: <main className={styles.page}> <div className={styles.pageHeader}> <h1>화면을 불러오지 못했어요</h1> <p>일시적",
  "app/not-found.tsx :: 랜드마크였던 뿌리 :: f29634022935 :: <main className={styles.page}> <div className={styles.pageHeader}> <h1>찾을 수 없는 화면이에요</h1> <p>주소가",
  "src/components/AdminShell.tsx :: 내비 링크 :: c5db45d42c6c :: <Link key={item.href} href={item.href} className={isActive ? `${styles.navLink} ${styles.navLink"
];

/** ⓓ **내비 라벨 열하나** — `<파일> :: <href> :: <sha256 앞 12> :: <라벨>`. 한 글자도 안 바뀐다. */
const NAV_LABEL_LEDGER: readonly string[] = [
  "src/components/AdminShell.tsx :: / :: 034999faab05 :: 홈",
  "src/components/AdminShell.tsx :: /items :: c89d7f420af4 :: 준비템 관리",
  "src/components/AdminShell.tsx :: /links :: a9fa3c46f98a :: 상품 링크 관리",
  "src/components/AdminShell.tsx :: /disclosures :: f6f0f8fd5bb4 :: 제휴 고지 문구",
  "src/components/AdminShell.tsx :: /reviews :: d6dc032fd4f9 :: 콘텐츠 검토",
  "src/components/AdminShell.tsx :: /clicks :: c015080dc99a :: 클릭 통계",
  "src/components/AdminShell.tsx :: /analytics :: 45ec3425c8b0 :: 분석",
  "src/components/AdminShell.tsx :: /categories :: b6a28a5ac1a2 :: 카테고리 관리",
  "src/components/AdminShell.tsx :: /users-lookup :: ac13381f0c50 :: 사용자 조회",
  "src/components/AdminShell.tsx :: /users :: e326fc06c4d7 :: 관리자 계정",
  "src/components/AdminShell.tsx :: /audit-logs :: d44f2c86796e :: 감사 로그"
];

// ── 래칫 ──────────────────────────────────────────────────────────────────────

/** 셸 안에서 다시 서는 `<main>` — **늘지 않는다**(어제 셋 · 오늘 0). */
const NESTED_MAIN_RATCHET = 0;
/** `aria-current`를 지닌 자리 — **줄지 않는다**(어제 0 · 오늘 1). */
const ARIA_CURRENT_FLOOR = 1;
/** 여는 `<main>` 전수 — 셸 하나 + 자기 문서 하나. 늘지 않는다. */
const OPEN_MAIN_RATCHET = 2;

// ── 사각 ──────────────────────────────────────────────────────────────────────

type BlindSpot = {
  readonly key: string;
  readonly reason: string;
  /** 오늘 다시 잰 값. */
  readonly measure: () => number;
  /** 그 값이 오늘도 이래야 한다는 하한/상한 판정. */
  readonly today: number;
};

/**
 * ⓕ **이 스윕이 못 보는 것** — AB-5의 규율대로 **값과 함께** 적는다. 세 자리 전부 오늘 다시
 * 재고(유령 사각 금지), 이유는 빈 문자열일 수 없다.
 */
const BLIND_SPOTS: readonly BlindSpot[] = [
  {
    key: "explicit-role-form",
    reason:
      "`role=\"main\"`·`role=\"navigation\"` 같은 **명시 역할** 꼴은 이 바늘(여는 태그 <main>) 밖이다 — " +
      "오늘 어드민에 0건이라 사각이 비어 있지만, 누가 랜드마크를 role로 세우는 날 이 스윕은 아무 말도 못 한다",
    measure: () =>
      SWEPT_FILES.reduce(
        (sum, file) =>
          sum +
          (((CODE.get(file) as string).match(/role="(?:main|navigation|banner|contentinfo|complementary)"/g) ?? [])
            .length),
        0
      ),
    today: 0
  },
  {
    key: "landmark-names",
    reason:
      "`<nav>`·`<form>`의 **이름**(aria-label/aria-labelledby)은 이 트랙의 축이 아니다 — AD-2의 답이고 P3가 " +
      "진다. 오늘 어드민의 <nav>는 하나·<form>은 여섯이고 이름이 붙은 자리는 0건인데, 이 스윕은 그 0을 세지 않는다",
    measure: () =>
      SWEPT_FILES.reduce(
        (sum, file) => sum + (((CODE.get(file) as string).match(/<(?:nav|form)[^>]*aria-label/g) ?? []).length),
        0
      ),
    today: 0
  },
  {
    key: "source-not-runtime",
    reason:
      "소스 대조이지 런타임이 아니다 — 스크린리더의 로터에 실제로 몇 개의 랜드마크가 서고 활성 링크가 " +
      "'현재 페이지'로 읽히는지는 **브라우저 확인**의 몫이다. 이 파일은 컴포넌트를 한 번도 렌더하지 않는다",
    measure: () => 0,
    today: 0
  },
  {
    key: "route-surface",
    reason:
      "라우트 표면(어느 라우트가 내비에 있고 없는가)의 대조는 **P3의 축**이라 이 스윕이 세지 않는다 — " +
      "여기서 파생하는 것은 내비 표의 링크 수 하나뿐이고, 라우트 파일과의 짝은 묻지 않는다",
    measure: () => 0,
    today: 0
  }
];

// ── 계약 ──────────────────────────────────────────────────────────────────────

describe("어드민 랜드마크와 현재 위치 (라운드 91 트랙 B)", () => {
  describe("ⓐ 모집단 — 손 목록이 아니라 전수에서 파생한다", () => {
    it("이 스윕은 앱 하나만 걷는다 (저장소 그물 열다섯의 하나가 아니다)", () => {
      expect(SWEEP_ROOTS).toEqual(["app", "src"]);
      expect(SWEEP_SCOPE_LABEL).toBe("apps/admin/{app,src}/**");
      expect(IS_REPO_WIDE_NET).toBe(false);
      for (const file of SWEPT_FILES) {
        expect(
          SWEEP_ROOTS.some((root) => file.startsWith(`${root}/`)),
          `${file}이 스윕 경계 밖이에요`
        ).toBe(true);
      }
    });

    it("모집단이 유령이 아니다 (걸은 비테스트 .tsx가 하한을 넘는다)", () => {
      expect(SWEPT_FILES.length).toBeGreaterThanOrEqual(SWEPT_FILE_FLOOR);
      expect(SWEPT_FILES).toContain(SHELL.file);
      expect(SWEPT_FILES.every((file) => file.endsWith(".tsx"))).toBe(true);
    });

    it("여는 <main>을 전수에서 파생한다 (오늘 둘 · 마스킹 전후가 같다)", () => {
      const masked = totalOf(CODE, OPEN_MAIN);
      const raw = totalOf(SOURCES, OPEN_MAIN);
      expect(masked, "여는 <main>의 수").toBe(OPEN_MAIN_RATCHET);
      // 인용이 자리를 만들지도, 마스킹이 자리를 먹지도 않았다.
      expect(raw, "주석을 남긴 채 센 수가 갈렸어요 — 인용이 자리로 둔갑했거나 마스킹이 자리를 먹었어요").toBe(masked);
      // 마스킹이 실제로 돈다(지운 바이트가 0이 아니다).
      const strippedBytes = SWEPT_FILES.reduce((sum, file) => {
        const source = SOURCES.get(file) as string;
        const code = CODE.get(file) as string;
        let changed = 0;
        for (let i = 0; i < source.length; i += 1) if (source[i] !== code[i]) changed += 1;
        return sum + changed;
      }, 0);
      expect(strippedBytes, "마스킹이 아무것도 지우지 않았어요").toBeGreaterThan(0);
    });

    it("내비 링크를 NAV_ITEMS 전수에서 파생한다 (오늘 열하나)", () => {
      expect(NAV_ITEMS_TODAY).toHaveLength(11);
      expect(new Set(NAV_ITEMS_TODAY.map((item) => item.href)).size).toBe(NAV_ITEMS_TODAY.length);
      // 내비가 그리는 링크 요소는 하나이고, 열하나는 그 하나가 표를 돌아 나온 수다.
      expect((SHELL_CODE.match(/<Link(?=[\s/>])/g) ?? []).length, "셸의 <Link> 자리").toBe(1);
      expect(SHELL_CODE, "내비가 NAV_ITEMS를 돌지 않아요").toContain("NAV_ITEMS.filter(");
    });
  });

  describe("ⓑ 랜드마크 하나 — 셸의 <main> 안에서 다시 서는 <main>이 0건이다", () => {
    it("렌더 트리의 전제를 다시 잰다 (라우트 그룹·병렬 라우트가 끼면 판정이 뒤집힌다)", () => {
      expect(APP_TREE.routeGroups, "라우트 그룹이 생겼어요 — 중첩 판정을 다시 재야 해요").toEqual([]);
      expect(APP_TREE.parallelRoutes, "병렬 라우트가 생겼어요 — 중첩 판정을 다시 재야 해요").toEqual([]);
      expect(APP_TREE.layouts, "app/** 아래 레이아웃이 하나가 아니에요").toEqual(["app/layout.tsx"]);
      expect(SHELL.component).toBe("AdminShell");
      expect(SHELL.file).toBe("src/components/AdminShell.tsx");
    });

    it("셸은 <main>을 정확히 하나 세운다", () => {
      expect(countIn(CODE, SHELL.file, OPEN_MAIN), "셸의 <main>").toBe(1);
    });

    it("셸 안에 그려지는 라우트 진입 파일에 <main>이 0건이다", () => {
      expect(INSIDE_SHELL_FILES.length, "셸 안에 그려지는 파일이 유령이에요").toBeGreaterThanOrEqual(11);
      const nested = INSIDE_SHELL_FILES.reduce((sum, file) => sum + countIn(CODE, file, OPEN_MAIN), 0);
      for (const file of INSIDE_SHELL_FILES) {
        expect(countIn(CODE, file, OPEN_MAIN), `${file}: 셸의 <main> 안에서 <main>이 다시 서요`).toBe(0);
      }
      expect(nested, "중첩 <main>").toBe(NESTED_MAIN_RATCHET);
    });

    it("자기 <html>을 세우는 파일은 모집단 밖이고, 그 이유가 값이다", () => {
      expect(OWN_DOCUMENT_FILES).toContain("app/global-error.tsx");
      expect(OWN_DOCUMENT_FILES).toContain("app/layout.tsx");
      expect(OWN_DOCUMENT_REASON.length, "면제의 이유가 비어 있어요").toBeGreaterThan(40);
      for (const file of OWN_DOCUMENT_FILES) {
        expect(INSIDE_SHELL_FILES, `${file}은 셸 안에 그려지는 자리가 아니에요`).not.toContain(file);
        // 이유가 참인지를 소스로 확인한다(주석이 아니라 코드에서 <html>을 세운다).
        expect(CODE.get(file), `${file}이 <html>을 세우지 않아요`).toContain("<html");
      }
      // global-error가 자기 문서의 본문 하나를 세우는 것은 중첩이 아니다.
      expect(countIn(CODE, "app/global-error.tsx", OPEN_MAIN), "global-error의 <main>").toBe(1);
    });
  });

  describe("ⓒ 현재 위치 — 표기는 정확히 하나이고 isActive에서 파생한다", () => {
    it("aria-current를 지닌 자리가 정확히 하나다", () => {
      expect(totalOf(CODE, ARIA_CURRENT), "aria-current 자리").toBe(ARIA_CURRENT_FLOOR);
      expect(countIn(CODE, SHELL.file, ARIA_CURRENT), "셸의 aria-current 자리").toBe(1);
    });

    it("그 자리는 내비 링크 안이고, 값이 손이 아니라 isActive에서 나온다", () => {
      const link = navLinkElement();
      expect(link, "내비 <Link> 요소를 풀지 못했어요").toBeTruthy();
      const attribute = /aria-current=\{([^}]*)\}/.exec(maskComments(link as string));
      expect(attribute, "내비 링크에 aria-current가 없어요").toBeTruthy();
      const expression = (attribute as RegExpExecArray)[1];
      expect(expression, "표기가 isActive에서 파생하지 않아요").toContain("isActive");
      expect(expression, "활성일 때의 값은 page여야 해요").toContain('"page"');
      // 활성이 아닌 자리에는 표기가 서지 않는다(모든 링크가 '현재 페이지'가 되면 표기가 아니다).
      expect(expression, "비활성 자리에서 표기가 사라지지 않아요").toContain("undefined");
    });

    it("경로가 바뀌면 표기도 따라간다 (isActive가 pathname에서 파생한다)", () => {
      expect(SHELL_CODE, "셸이 usePathname을 읽지 않아요").toContain("const pathname = usePathname();");
      expect(SHELL_CODE, "isActive가 경로 비교에서 나오지 않아요").toContain(
        "const isActive = pathname === item.href;"
      );
    });

    it("손으로 박은 aria-current 리터럴이 0건이다", () => {
      for (const file of SWEPT_FILES) {
        expect(CODE.get(file), `${file}: aria-current가 손으로 박혀 있어요`).not.toContain('aria-current="page"');
      }
    });
  });

  describe("ⓓ 문구·픽셀 불변 — 더한 것을 도로 빼면 종전 바이트와 같다 (부정 단언)", () => {
    it("랜드마크였던 뿌리 셋과 내비 링크 하나의 바이트가 종전과 같다", () => {
      const rebuilt: string[] = [];
      for (const [file, key] of [
        ["app/page.tsx", "랜드마크였던 뿌리"],
        ["app/error.tsx", "랜드마크였던 뿌리"],
        ["app/not-found.tsx", "랜드마크였던 뿌리"]
      ] as const) {
        const element = defaultExportRoot(file, "div");
        expect(element, `${file}: 기본 내보내기의 뿌리 요소를 풀지 못했어요`).toBeTruthy();
        const restored = restoreLandmark(element as string);
        expect(restored, `${file}: 되돌리기가 아무것도 바꾸지 않았어요`).not.toBe(element);
        rebuilt.push(`${file} :: ${key} :: ${sha12(restored)} :: ${preview(restored)}`);
      }
      const link = navLinkElement();
      expect(link, "내비 <Link> 요소를 풀지 못했어요").toBeTruthy();
      const restoredLink = restoreNavLink(link as string);
      expect(restoredLink, "내비 링크의 되돌리기가 아무것도 바꾸지 않았어요").not.toBe(link);
      rebuilt.push(`${SHELL.file} :: 내비 링크 :: ${sha12(restoredLink)} :: ${preview(restoredLink)}`);

      expect(rebuilt).toEqual([...ELEMENT_LEDGER]);
    });

    it("내비 라벨 열하나가 한 글자도 바뀌지 않았다", () => {
      const rebuilt = NAV_ITEMS_TODAY.map(
        (item) => `${SHELL.file} :: ${item.href} :: ${sha12(item.label)} :: ${item.label}`
      );
      expect(rebuilt).toEqual([...NAV_LABEL_LEDGER]);
    });

    it("이 트랙이 더한 것은 태그 이름 셋과 속성 하나뿐이다 (새 클래스·새 문구 0건)", () => {
      for (const file of ["app/page.tsx", "app/error.tsx", "app/not-found.tsx"] as const) {
        expect(countIn(CODE, file, OPEN_MAIN), `${file}: <main>이 되살아났어요`).toBe(0);
      }
      // 새 컴포넌트·새 상호작용 표면 0건: 셸의 누르는 자리 수가 그대로다.
      expect((SHELL_CODE.match(/<button(?=[\s/>])/g) ?? []).length, "셸의 <button> 자리").toBe(15);
      expect((SHELL_CODE.match(/<nav(?=[\s/>])/g) ?? []).length, "셸의 <nav> 자리").toBe(1);
    });
  });

  describe("ⓔ 래칫 — 중첩은 늘지 않고 표기는 줄지 않는다", () => {
    it("중첩 <main>은 늘지 않는다", () => {
      const nested = INSIDE_SHELL_FILES.reduce((sum, file) => sum + countIn(CODE, file, OPEN_MAIN), 0);
      expect(nested).toBeLessThanOrEqual(NESTED_MAIN_RATCHET);
      expect(totalOf(CODE, OPEN_MAIN)).toBeLessThanOrEqual(OPEN_MAIN_RATCHET);
    });

    it("aria-current를 지닌 자리는 줄지 않는다", () => {
      expect(totalOf(CODE, ARIA_CURRENT)).toBeGreaterThanOrEqual(ARIA_CURRENT_FLOOR);
    });
  });

  describe("ⓕ 사각 — 값으로 적혀 있고, 오늘 다시 잰다", () => {
    it("사각마다 이유가 있다 (빈 이유 금지)", () => {
      expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(3);
      expect(new Set(BLIND_SPOTS.map((spot) => spot.key)).size).toBe(BLIND_SPOTS.length);
      for (const spot of BLIND_SPOTS) {
        expect(spot.reason.length, `${spot.key}: 이유가 비어 있어요`).toBeGreaterThan(40);
      }
    });

    it("사각의 값이 오늘도 그대로다 (유령 사각 금지)", () => {
      for (const spot of BLIND_SPOTS) {
        expect(spot.measure(), `${spot.key}: 오늘 다시 잰 값이 갈렸어요`).toBe(spot.today);
      }
    });

    it("명시 역할 꼴이 실재하게 되는 날 이 스윕은 그것을 세지 않는다는 사실이 값이다", () => {
      // 바늘은 여는 태그 하나다 — role= 꼴은 이 정규식에 걸리지 않는다.
      expect(OPEN_MAIN.source).toBe("<main(?=[\\s/>])");
      expect(OPEN_MAIN.source).not.toContain("role");
    });
  });
});
