import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 92 트랙 C — **어드민의 라우트 표면을 세는 자가 선다.**
 *
 * 어드민에는 라우트 진입(`app/**\/page.tsx`)이 **열하나** 있고, 셸(`AdminShell.tsx`)의 내비 표
 * (`NAV_ITEMS`)에는 href가 **열하나** 있다. 두 수가 같다는 사실도, 두 집합이 같다는 사실도
 * 오늘까지 **어느 계약도 지지 않았다** — 옆 계약들이 그 표를 이미 물고 있었지만 무는 것은
 * 표 안쪽이었다(`admin-canonical-mirrors.test.ts`는 표가 정본과 갈리지 않는가를,
 * `admin-write-role-gate.test.ts`는 `roles` 셋이 그대로인가를 묻는다). *"그 href가 가리키는
 * 화면이 실재하는가"* 와 *"실재하는 화면이 내비에 서 있는가"* 는 아무도 묻지 않았다.
 *
 * 그래서 어드민에서 라우트를 하나 지우면 내비에는 죽은 링크가 남고(운영자는 404를 만난다),
 * 라우트를 하나 더하면 내비에 서지 않은 화면이 생긴다(주소를 아는 사람만 쓸 수 있다). 둘 다
 * 오늘 **0건**이고 — 그래서 **이 트랙은 어드민 소스를 한 바이트도 고치지 않는다** — 이 파일이
 * 하는 일은 그 0을 계약으로 만드는 것뿐이다. 고칠 것이 있어서 서는 계약이 아니라, *고칠 것이
 * 없다는 사실*이 다음 라운드에도 참인지를 묻는 계약이다.
 *
 * ## ⚠️⚠️ 이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다
 *
 * 저장소에는 앱 경계를 넘어 도는 그물이 **열다섯** 있다(`contract-net-ledger.test.ts`가 그 수를
 * 센다). **이 파일은 그 하나가 아니다.** 이 스윕이 걷는 것은 `apps/admin/**` 하나뿐이고, 그
 * 사실을 주석이 아니라 **값**으로 둔다(`SWEEP_SCOPE_LABEL` · `IS_REPO_WIDE_NET` · `SWEPT_APPS` ·
 * `READ_FILES`) — 라운드 89 B·90 B·91 B가 어드민 스윕마다 같은 자리에 같은 값을 둔 그 규율이다.
 * 다음 라운드에 누군가 이 계약을 "저장소 라우트 표면 그물"로 넓히려 하면 넓히는 손이 그 값들을
 * 고치며 지나가게 된다. 주석은 조용히 거짓이 되지만 값은 빨개진다.
 *
 * ⚠️ **형제 앱의 라우트 표면 그물(모바일)을 넓히지 않는다.** 그것은 저장소 그물이고, 어드민을
 * 그 그물에 넣으면 그물 하나가 두 앱을 걷게 되어 열다섯의 뜻이 바뀐다 — 그래서 이 축은 앱 안에
 * 새로 선다. 이 파일은 그 파일을 읽지도 부르지도 않는다(아래 ⓐ가 **코드에서** 확인한다).
 *
 * ## ⚠️⚠️ 이 계약이 처음 지는 것 — 리뷰 L-7의 사각이 기대고 있던 평면 전제
 *
 * 라운드 91 리뷰 L-7이 `admin-landmark-current.test.ts`에 연 사각
 * (`aria-current-exact-match`)은 *"오늘 그 한계가 보이지 않는 이유는 설계가 아니라 실측이다 —
 * 라우트 진입 열하나가 전부 평면이고 동적 세그먼트가 0건이다"* 라고 적었다. 그 전제는 그날
 * 사각의 `measure` 안에서만 살았다. **오늘 그 전제 자체가 계약이 된다**(아래 ⓒ): 라우트 진입
 * 열하나가 `/` 하나 + 한 세그먼트 열이고, 동적 세그먼트(`[param]`) · 라우트 그룹(`(group)`) ·
 * 병렬 라우트(`@slot`)가 전부 0건이다. 하위 경로가 서는 날 이 계약이 먼저 빨개지고, 그날
 * `isActive`의 정확 일치를 손보라는 그 사각의 재개 조건이 함께 열린다.
 *
 * ## ⚠️⚠️ 옆 파일에서 사각 한 칸을 옮겨 왔다 — 다섯 라운드 만에 결정형에서 집는 첫 트랙
 *
 * `admin-landmark-current.test.ts`의 사각 `route-surface`는 재개 조건을 **결정형**으로 적었다:
 * *"라우트 표면과 내비 표의 짝을 어느 계약이 지는지를 P3가 정하는 날."* 오늘 그 결정이 섰고,
 * 짝을 지는 계약이 이 파일이다. 그 칸을 지우지 않고 **두 시점으로** 고쳐 적는다(옛 문장은
 * 그대로 남고, 그 아래에 오늘의 결정이 붙는다) — 라운드 91 트랙 B가 `admin-status-announce.test.ts`의
 * 동결 둘을 옮긴 규율 그대로다. ⚠️ 그 칸의 `measure`(라우트 진입 전수 · 오늘 11)와 다른 사각
 * 넷은 **바이트 불변**이다.
 *
 * ## 오늘의 값 (전제 재실측 — 정찰의 수를 그대로 옮겨 적지 않고 다시 쟀다)
 *
 *  · 라우트 진입(`page.tsx`) **11** · 내비 href **11** · 두 집합이 **같다**(어긋남 0 · 면제 0) ·
 *    동적 세그먼트 **0** · 라우트 그룹 **0** · 병렬 라우트 **0** · 라우트 핸들러(`route.ts`) **0** ·
 *    레이아웃 **1** · page가 아닌 진입(`error`·`global-error`·`not-found`) **3** ·
 *    `roles`가 붙은 href **3**(그 셋의 정확한 목록은 `admin-write-role-gate.test.ts`의 축이라 이
 *    계약은 수를 등호로 물지 않는다).
 *
 * 이 파일이 묻는 것은 여섯이다.
 *  ⓐ **모집단** — 걸어서 전수로 찾는다(손 목록 0건 · 유령 방지 하한).
 *  ⓑ **양방향 대조** — 없는 페이지를 가리키는 href 0건 · 내비에 없는 페이지 0건(면제는 이유를 진다).
 *  ⓒ **평면 전제** — 전부 평면이고 동적 세그먼트가 0건이다.
 *  ⓓ **역할 게이트와 갈리지 않는다** — 숨김은 라우트의 부재가 아니다.
 *  ⓔ **래칫** — 수는 줄지 않고 어긋남은 0을 넘지 않는다.
 *  ⓕ **사각** — 못 보는 것을 값·이유·재개 조건으로 적는다.
 */

// ── 이 스윕의 경계 ────────────────────────────────────────────────────────────

/** 이 스윕의 앱 경계 — 값으로 든다(저장소 그물 열다섯의 하나가 아니다). */
const SWEEP_SCOPE_LABEL = "apps/admin/**" as const;

/** ⚠️ 이 파일이 저장소 그물이 **아니라는** 사실 자체를 값으로 든다. */
const IS_REPO_WIDE_NET = false;

/** 이 계약이 걷는 앱 — 하나뿐이다. 둘이 되는 날 이 값을 고치는 손이 경계를 다시 정한다. */
const SWEPT_APPS = ["admin"] as const;

/** 이 계약이 읽는 자리 전수 — `app/**`을 뺀 낱개 파일들(전부 어드민 안이다). */
const READ_FILES = [
  "src/components/AdminShell.tsx",
  "next.config.js",
  "src/admin-route-surface.test.ts"
] as const;

/** 이 파일 자신 — 사각 `source-not-runtime`의 자가 읽는다. */
const SELF_FILE = "src/admin-route-surface.test.ts";

const ADMIN_ROOT = process.cwd();
const APP_DIR = join(ADMIN_ROOT, "app");

// ── 래칫 ──────────────────────────────────────────────────────────────────────

/** 라우트 진입 수 — **줄지 않는다**(오늘 11). */
const ROUTE_FLOOR = 11;
/** 내비 href 수 — **줄지 않는다**(오늘 11). */
const NAV_FLOOR = 11;
/** 양방향 어긋남 — **0을 넘지 않는다**(오늘 0 · 상한). */
const MISMATCH_CEILING = 0;
/** 면제 — **늘지 않는다**(오늘 0 · 상한). 늘어난 만큼이 아래 사각의 크기다. */
const EXEMPTION_CEILING = 0;
/** 유령 방지 — 걷기가 통째로 깨지면 모집단이 0이 되고 아래 부정 단언이 전부 조용해진다. */
const WALKED_FILE_FLOOR = 12;

// ── 면제 ──────────────────────────────────────────────────────────────────────

/**
 * **내비에 서지 않는 것이 옳은 라우트** — 오늘 **0건**이다.
 *
 * ⚠️ 오늘 0건인 이유를 값으로 적어 둔다(다음 사람이 "면제 칸이 비었으니 아직 안 쓴 것"으로 읽지
 * 않도록): 어드민에서 내비에 서지 않는 화면 셋 — 로그인 · 오류 · 404 — 은 **라우트 진입이
 * 아니다.** 로그인은 셸(`AdminShell`)이 세션이 없을 때 그리는 화면이라 주소가 없고, 오류와 404는
 * `error.tsx`·`global-error.tsx`·`not-found.tsx`라 이 바늘(`page.tsx`) 밖이다. 그래서 오늘
 * *"라우트인데 내비에 없는 것"* 이 정말로 0건이다.
 *
 * ⚠️ 면제가 서는 날 `reason`은 **빈 문자열일 수 없다**(아래 ⓑ가 길이를 잰다).
 */
type RouteExemption = { readonly route: string; readonly reason: string };

const EXEMPTIONS: readonly RouteExemption[] = [];

// ── 걷기 ──────────────────────────────────────────────────────────────────────

/** `app/**`을 한 번 걸어 나오는 것 전부. ⚠️ 뿌리를 인자로 받는다 — 아래 픽스처가 그 자를 잰다. */
type AppTreeScan = {
  /** `page.tsx`가 만드는 라우트 경로(정렬). */
  readonly routes: string[];
  /** 그 `page.tsx`들의 상대 경로(정렬) — 경로 파생이 유령이 아님을 보이는 짝이다. */
  readonly pageFiles: string[];
  readonly dynamicDirectories: string[];
  readonly routeGroups: string[];
  readonly parallelRoutes: string[];
  readonly layouts: string[];
  readonly routeHandlers: string[];
  /** `page.tsx`가 아닌 라우트 진입(오류·404 따위) — 이 바늘 밖이라는 사실이 값이다. */
  readonly nonPageEntries: string[];
  readonly walkedFiles: number;
};

/** `page.tsx`가 아니면서 셸 안에 그려지는 진입 파일 이름 — 이 바늘 밖이다. */
const NON_PAGE_ENTRY_NAMES = ["error.tsx", "global-error.tsx", "not-found.tsx", "loading.tsx", "default.tsx"] as const;

/** `<디렉터리>/page.tsx` → `/<디렉터리>` · `page.tsx` → `/`. 손 목록이 아니라 파일 이름에서 나온다. */
function routePathOf(pageFile: string): string {
  const directory = pageFile.replace(/(^|\/)page\.tsx?$/, "");
  return directory === "" ? "/" : `/${directory}`;
}

function scanAppTree(appDir: string): AppTreeScan {
  const routes: string[] = [];
  const pageFiles: string[] = [];
  const dynamicDirectories: string[] = [];
  const routeGroups: string[] = [];
  const parallelRoutes: string[] = [];
  const layouts: string[] = [];
  const routeHandlers: string[] = [];
  const nonPageEntries: string[] = [];
  let walkedFiles = 0;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      const rel = relative(appDir, full).split(sep).join("/");
      if (entry.isDirectory()) {
        if (entry.name.startsWith("[")) dynamicDirectories.push(rel);
        if (entry.name.startsWith("(")) routeGroups.push(rel);
        if (entry.name.startsWith("@")) parallelRoutes.push(rel);
        walk(full);
        continue;
      }
      walkedFiles += 1;
      if (/(^|\/)page\.tsx?$/.test(rel)) {
        pageFiles.push(rel);
        routes.push(routePathOf(rel));
      } else if (entry.name === "layout.tsx" || entry.name === "template.tsx") {
        layouts.push(rel);
      } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
        routeHandlers.push(rel);
      } else if ((NON_PAGE_ENTRY_NAMES as readonly string[]).includes(entry.name)) {
        nonPageEntries.push(rel);
      }
    }
  };
  walk(appDir);

  return {
    routes: routes.sort(),
    pageFiles: pageFiles.sort(),
    dynamicDirectories: dynamicDirectories.sort(),
    routeGroups: routeGroups.sort(),
    parallelRoutes: parallelRoutes.sort(),
    layouts: layouts.sort(),
    routeHandlers: routeHandlers.sort(),
    nonPageEntries: nonPageEntries.sort(),
    walkedFiles
  };
}

const APP_TREE = scanAppTree(APP_DIR);

// ── 소스 읽기 ─────────────────────────────────────────────────────────────────

function read(relativePath: string): string {
  return readFileSync(join(ADMIN_ROOT, relativePath), "utf8");
}

/**
 * ⚠️ **파싱하기 전에 주석을 지운다.** 이 파일의 머리말도, 셸의 주석도 `href:`·`NAV_ITEMS`를
 * 여러 번 인용한다 — 주석을 남긴 채 세면 인용이 자리로 둔갑한다. 길이는 보존한다.
 * (`admin-landmark-current.test.ts`가 같은 자리에서 쓰는 자를 그대로 옮겨 왔다.)
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

/**
 * ⚠️ 모집단을 짓다 못 푼 자리는 **조용히 버리지 않는다** — 빈 값 위에서는 어떤 부정 단언도
 * 통과한다(라운드 78 트랙 E의 슬라이스 가드가 이름 붙인 사각). 모듈 로드 시점의 파생은
 * `expect`가 아니라 이 함수로 막는다(단언은 테스트 안에서만 선다).
 */
function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

/**
 * 셸의 자리도 손으로 적지 않는다 — 하나뿐인 `layout.tsx`가 `{children}`을 감싸는 컴포넌트가
 * 곧 셸이고, 그 import 경로에서 파일이 나온다(`admin-landmark-current.test.ts`와 같은 자).
 */
function resolveShellFile(): { component: string; file: string } {
  const layoutFile = must(APP_TREE.layouts[0], "app/** 아래에서 layout.tsx를 찾지 못했어요");
  const layout = read(join("app", layoutFile).split(sep).join("/"));
  const wrapper = must(
    /<([A-Z][A-Za-z0-9]*)>\{children\}<\/\1>/.exec(maskComments(layout)),
    "layout.tsx에서 {children}을 감싸는 컴포넌트를 찾지 못했어요"
  );
  const component = wrapper[1];
  const importLine = must(
    new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "([^"]+)"`).exec(layout),
    `${component}의 import 경로를 찾지 못했어요`
  );
  const file = relative(ADMIN_ROOT, join(APP_DIR, `${importLine[1]}.tsx`)).split(sep).join("/");
  return { component, file };
}

const SHELL = resolveShellFile();
const SHELL_CODE = maskComments(read(SHELL.file));

/** 이 파일 자신의 코드(주석 뺀 것) — 아래 ⓐ의 경계 단언과 사각의 자가 읽는다. */
const SELF_CODE = maskComments(read(SELF_FILE));

// ── 내비 표 ───────────────────────────────────────────────────────────────────

type NavItem = { readonly href: string; readonly label: string; readonly roles: string[] };

/**
 * `NAV_ITEMS`를 셸 소스에서 판다 — **표는 읽기만 한다**(그 안쪽을 무는 것은
 * `admin-canonical-mirrors.test.ts`와 `admin-write-role-gate.test.ts`의 축이다).
 */
function navItems(): NavItem[] {
  const block = must(
    /const NAV_ITEMS: Array<\{[^}]*\}> = \[([\s\S]*?)\n\];/.exec(SHELL_CODE),
    "AdminShell.tsx에서 NAV_ITEMS를 찾지 못했어요"
  );
  return [...block[1].matchAll(/\{\s*href: "([^"]+)",\s*label: "([^"]+)"(?:,\s*roles: \[([^\]]*)\])?\s*\}/g)].map(
    (match) => ({
      href: match[1],
      label: match[2],
      // ⚠️ 따옴표를 **홀수 개** 담은 정규식 리터럴을 쓰지 않는다 — 위 `maskComments`는 정규식
      //    리터럴을 모르는 자라 그런 리터럴 하나가 그 뒤의 코드를 통째로 주석으로 만든다
      //    (아래 ⓐ가 그 desync를 자기 소스에서 다시 잰다).
      roles:
        match[3] === undefined
          ? []
          : match[3]
              .split(",")
              .map((role) => role.trim().replace(/^"|"$/g, ""))
              .filter((role) => role.length > 0)
    })
  );
}

const NAV_ITEMS_TODAY = navItems();
const NAV_HREFS = NAV_ITEMS_TODAY.map((item) => item.href);

// ── 대조 (순수 함수 — 아래 픽스처가 이 자들을 잰다) ───────────────────────────

type CrossCheck = {
  /** 내비가 가리키는데 라우트가 없는 href — 죽은 링크다. */
  readonly danglingHrefs: string[];
  /** 라우트인데 내비에 없는 것(면제 뺀 것) — 주소를 아는 사람만 쓰는 화면이다. */
  readonly unlistedRoutes: string[];
};

function crossCheck(
  routes: readonly string[],
  hrefs: readonly string[],
  exemptions: readonly RouteExemption[]
): CrossCheck {
  const routeSet = new Set(routes);
  const hrefSet = new Set(hrefs);
  const exempt = new Set(exemptions.map((entry) => entry.route));
  return {
    danglingHrefs: hrefs.filter((href) => !routeSet.has(href)).sort(),
    unlistedRoutes: routes.filter((route) => !hrefSet.has(route) && !exempt.has(route)).sort()
  };
}

type Flatness = {
  /** 한 세그먼트를 넘는 경로 — 오늘 0건. */
  readonly nested: string[];
  /** 동적 세그먼트를 담은 경로 — 오늘 0건. */
  readonly dynamic: string[];
};

function segmentsOf(route: string): string[] {
  return route.split("/").filter((segment) => segment.length > 0);
}

function flatnessOf(routes: readonly string[]): Flatness {
  return {
    nested: routes.filter((route) => segmentsOf(route).length > 1).sort(),
    dynamic: routes.filter((route) => route.includes("[") || route.includes("]")).sort()
  };
}

const TODAY = crossCheck(APP_TREE.routes, NAV_HREFS, EXEMPTIONS);
const FLATNESS = flatnessOf(APP_TREE.routes);

// ── 사각 ──────────────────────────────────────────────────────────────────────

type BlindSpot = {
  readonly key: string;
  /** 왜 이 자리가 이 바늘 밖인가 — **빈 문자열일 수 없다**. */
  readonly reason: string;
  /**
   * 오늘 다시 잰 값.
   *
   * ⚠️⚠️ **진짜 자여야 한다**(라운드 91 리뷰 L-6이 옆 파일에서 이름 붙인 규율): `() => 0`처럼
   * 상수를 돌려주는 자는 *"오늘 다시 잰 값이 갈렸어요"* 단언에서 `0 === 0`만 묻는다 — 저장소가
   * 통째로 바뀌어도 조용한 사각이 된다. 아래 ⓕ가 그 형태를 막는다.
   */
  readonly measure: () => number;
  readonly today: number;
  /** 이 사각을 배워야 하는 날의 조건 — **빈 문자열일 수 없다**(AD-5 · 형을 밝힌다). */
  readonly resumeCondition: string;
};

const BLIND_SPOTS: readonly BlindSpot[] = [
  {
    key: "page-only-needle",
    reason:
      "바늘은 `page.tsx` 하나다 — `layout.tsx`(오늘 하나) · 라우트 핸들러 `route.ts`(오늘 0건) · " +
      "병렬 라우트(`@slot` · 오늘 0건) · 라우트 그룹(`(group)` · 오늘 0건)은 이 자가 세지 않는다. " +
      "그리고 `error.tsx`·`global-error.tsx`·`not-found.tsx` 셋(오늘 3)도 라우트 진입이지만 주소를 " +
      "만들지 않아 이 바늘 밖이고, 그 셋이 밖이라는 사실이 오늘 면제가 0건인 이유이기도 하다",
    measure: () =>
      APP_TREE.routeHandlers.length + APP_TREE.parallelRoutes.length + APP_TREE.routeGroups.length,
    today: 0,
    resumeCondition:
      "재개 조건(사건형): 어드민에 `route.ts`나 병렬 라우트·라우트 그룹이 처음 서는 날 — 그날 이 수가 " +
      "0을 벗어나고, 이 계약의 모집단은 `page.tsx` 전수에서 *주소를 만드는 진입* 전수로 넓어져야 한다"
  },
  {
    key: "intentional-absence",
    reason:
      "**내비에 없는 것이 옳은 라우트와 실수로 빠진 라우트를 이 자는 가르지 못한다.** 소스가 아는 " +
      "것은 *짝이 없다*까지이고, *없어도 되는가*는 사람이 판단한다. 그 판단이 서는 자리가 면제이고 " +
      "(오늘 0건), **면제가 늘면 늘어난 만큼이 이 사각의 크기다** — 그래서 이 자는 면제의 수를 잰다",
    measure: () => EXEMPTIONS.length,
    today: 0,
    resumeCondition:
      "재개 조건(사건형): 첫 면제가 서는 날 — 그날 이 수가 1이 되고, 그 줄의 이유가 *왜 내비에 서지 " +
      "않는 것이 옳은가*를 값으로 져야 한다(빈 이유 금지). 면제가 셋을 넘으면 이 자가 아니라 사람이 " +
      "내비 표를 다시 봐야 한다는 신호다"
  },
  {
    key: "url-surface-beyond-routes",
    reason:
      "**URL 표면은 라우트 파일만이 아니다.** `next.config.js`의 리라이트가 `/api/v1/*`를 라우트 파일 " +
      "없이 사는 주소로 만든다(SEC-102의 동일 출처 프록시) — 그 주소는 화면이 아니라서 내비에 서지 " +
      "않는 것이 옳지만, 이 자는 그 사실을 짝으로 확인하지 못한다. 이 자가 재는 것은 그 짝이 아니라 " +
      "**설정이 여는 자리의 수**다: `next.config.js`의 `source:` 둘(보안 헤더 규칙 하나 · 리라이트 하나)",
    measure: () => ((maskComments(read("next.config.js")).match(/source:/g) ?? []).length),
    today: 2,
    resumeCondition:
      "재개 조건(사건형): `next.config.js`에 리다이렉트나 리라이트가 더 서는 날 — 그날 이 수가 갈리고, " +
      "사람이 볼 것은 *새로 열린 주소가 화면인가*다(화면이면 이 계약의 모집단이 그 자리를 놓친다)"
  },
  {
    key: "source-not-runtime",
    reason:
      "**소스 대조이지 런타임이 아니다** — 그 링크를 실제로 눌렀을 때 화면이 열리는지, 권한이 없는 " +
      "역할에게 서버가 무엇을 돌려주는지는 **브라우저 확인**의 몫이다. 이 파일은 Next를 띄우지도, " +
      "컴포넌트를 렌더하지도 않는다. ⚠️ 렌더 여부는 소스로 잴 수 없으므로 이 자가 재는 것은 그 사실이 " +
      "아니라 **경계**다: 이 파일의 import 줄 가운데 `node:*`·`vitest`가 아닌 것의 수(오늘 0). 렌더 " +
      "도구가 하나라도 들어오는 날 이 수가 오르고, 그날 이 사각의 문장은 더 이상 참이 아니다",
    measure: () =>
      [...SELF_CODE.matchAll(/^import .*$/gm)]
        .map((match) => match[0])
        .filter((line) => !/from "(?:node:[a-z]+|vitest)";$/.test(line)).length,
    today: 0,
    resumeCondition:
      "재개 조건(사건형): 이 파일이 실제로 앱을 띄우거나 컴포넌트를 렌더하기 시작하는 날 — 그날 이 " +
      "사각은 닫히는 것이 아니라 **다른 계약으로 옮겨 간다**(소스 대조와 런타임 대조를 한 파일이 " +
      "함께 지지 않는다)"
  }
];

// ── 계약 ──────────────────────────────────────────────────────────────────────

describe("어드민 라우트 표면 (라운드 92 트랙 C)", () => {
  describe("ⓐ 모집단 — 손 목록이 아니라 전수에서 파생한다", () => {
    it("이 스윕은 앱 하나만 걷는다 (저장소 그물 열다섯의 하나가 아니다)", () => {
      expect(IS_REPO_WIDE_NET).toBe(false);
      expect(SWEEP_SCOPE_LABEL).toBe("apps/admin/**");
      expect(SWEPT_APPS).toEqual(["admin"]);
      // 읽는 낱개 파일 전부가 어드민 안이고, 실제로 읽힌다(대장이 유령이 아니다).
      for (const file of READ_FILES) {
        expect(file.startsWith("/"), `${file}이 절대 경로예요 — 어드민 밖을 가리킬 수 있어요`).toBe(false);
        expect(file.includes(".."), `${file}이 어드민 밖으로 나가요`).toBe(false);
        expect(read(file).length, `${file}을 읽지 못했어요`).toBeGreaterThan(0);
      }
      expect(READ_FILES).toContain(SHELL.file);
      // ⚠️ 형제 앱의 이름을 조각에서 지어 문다 — 낱말을 그대로 적으면 이 단언 자신이 그 낱말을
      //    담아 거짓 빨강이 된다(옆 파일이 같은 자리에서 고른 그 형식).
      for (const other of ["mobile", "api"]) {
        expect(SELF_CODE, `이 계약이 ${other} 앱을 걷고 있어요`).not.toContain(["apps", other].join("/"));
      }
      expect(SELF_CODE, "이 계약이 packages를 걷고 있어요").not.toContain(["packages", ""].join("/"));
    });

    it("걷기가 유령이 아니다 (걸은 파일 수가 하한을 넘고, 두 모집단이 0이 아니다)", () => {
      expect(APP_TREE.walkedFiles, "app/**을 걷지 못했어요").toBeGreaterThanOrEqual(WALKED_FILE_FLOOR);
      expect(APP_TREE.routes.length, "라우트 진입이 0건이에요").toBeGreaterThan(0);
      expect(NAV_ITEMS_TODAY.length, "내비 표가 0건이에요").toBeGreaterThan(0);
      // 주석 마스킹이 실제로 돈다(지운 바이트가 0이 아니다) — 인용이 자리로 둔갑하지 않는다.
      const shellRaw = read(SHELL.file);
      let stripped = 0;
      for (let i = 0; i < shellRaw.length; i += 1) if (shellRaw[i] !== SHELL_CODE[i]) stripped += 1;
      expect(stripped, "마스킹이 아무것도 지우지 않았어요").toBeGreaterThan(0);
      // ⚠️ 그리고 마스킹이 **코드를 먹지도** 않았다. 이 자는 정규식 리터럴을 모르므로 따옴표를
      //    홀수 개 담은 리터럴 하나가 그 뒤를 통째로 주석으로 만들 수 있다 — 자기 소스에서 그
      //    desync를 다시 잰다(블록 구조가 살아남았는가).
      const selfRaw = read(SELF_FILE);
      for (const token of [["describe", "("].join(""), ["it", "("].join("")]) {
        const inRaw = selfRaw.split(token).length - 1;
        const inCode = SELF_CODE.split(token).length - 1;
        expect(inCode, `마스킹이 ${token} 자리를 먹었어요 — 마스킹이 어긋났어요`).toBe(inRaw);
        expect(inCode, `${token} 자리가 0건이에요`).toBeGreaterThan(0);
      }
    });

    it("라우트 진입 열하나를 걷기에서 파생한다 (경로도 파일 이름에서 나온다)", () => {
      expect(APP_TREE.routes).toHaveLength(11);
      expect(APP_TREE.pageFiles).toHaveLength(APP_TREE.routes.length);
      expect(new Set(APP_TREE.routes).size, "같은 경로가 두 번 서요").toBe(APP_TREE.routes.length);
      expect(APP_TREE.routes).toContain("/");
      // 경로 파생이 유령이 아니다 — 파일마다 그 경로가 다시 나온다.
      expect(APP_TREE.pageFiles.map(routePathOf).sort()).toEqual(APP_TREE.routes);
    });

    it("내비 href 열하나를 NAV_ITEMS 소스에서 파생한다 (표는 읽기만 한다)", () => {
      expect(NAV_ITEMS_TODAY).toHaveLength(11);
      expect(new Set(NAV_HREFS).size, "같은 href가 두 번 서요").toBe(NAV_HREFS.length);
      for (const item of NAV_ITEMS_TODAY) {
        expect(item.href.startsWith("/"), `${item.href}가 내부 경로가 아니에요`).toBe(true);
        expect(item.label.length, `${item.href}의 라벨이 비어 있어요`).toBeGreaterThan(0);
      }
      // 내비가 그 표를 실제로 돈다(표만 있고 그리지 않으면 이 대조가 뜻을 잃는다).
      expect(SHELL_CODE, "내비가 NAV_ITEMS를 돌지 않아요").toContain("NAV_ITEMS.filter(");
    });
  });

  describe("ⓑ 양방향 대조 — 죽은 링크 0건 · 내비에 없는 화면 0건", () => {
    it("내비의 href는 전부 라우트로 실재한다 (죽은 링크 0건)", () => {
      expect(TODAY.danglingHrefs, "내비가 없는 화면을 가리켜요").toEqual([]);
    });

    it("라우트는 전부 내비에 서 있다 (숨은 화면 0건)", () => {
      expect(TODAY.unlistedRoutes, "내비에 서지 않는 화면이 있어요 — 면제로 이유를 적어 주세요").toEqual([]);
    });

    it("두 집합이 오늘 정확히 같다", () => {
      expect([...APP_TREE.routes].sort()).toEqual([...NAV_HREFS].sort());
    });

    it("면제는 이유를 지고, 유령이 아니다 (오늘 0건)", () => {
      expect(EXEMPTIONS).toHaveLength(EXEMPTION_CEILING);
      for (const exemption of EXEMPTIONS) {
        expect(exemption.reason.trim().length, `${exemption.route}: 면제의 이유가 비어 있어요`).toBeGreaterThan(20);
        expect(APP_TREE.routes, `${exemption.route}: 없는 라우트를 면제하고 있어요`).toContain(exemption.route);
        expect(NAV_HREFS, `${exemption.route}: 내비에 있는 라우트를 면제하고 있어요`).not.toContain(exemption.route);
      }
    });

    it("⚠️ 이 대조가 유령이 아니다 — 픽스처가 두 방향을 실제로 빨갛게 만든다", () => {
      const routes = ["/", "/items"];
      // ① 내비에만 있는 유령 href.
      expect(crossCheck(routes, ["/", "/items", "/ghost"], []).danglingHrefs).toEqual(["/ghost"]);
      // ② 내비에 없는 라우트.
      expect(crossCheck(routes, ["/"], []).unlistedRoutes).toEqual(["/items"]);
      // ③ 면제는 뒤쪽만 덮는다 — 죽은 링크를 면제로 덮을 수는 없다.
      const exempt = [{ route: "/items", reason: "픽스처 — 내비에 서지 않는 것이 옳은 라우트의 자리" }];
      expect(crossCheck(routes, ["/"], exempt).unlistedRoutes).toEqual([]);
      expect(crossCheck(routes, ["/", "/ghost"], exempt).danglingHrefs).toEqual(["/ghost"]);
      // ④ 오늘의 실물에서는 두 방향 다 0이다.
      expect(TODAY.danglingHrefs.length + TODAY.unlistedRoutes.length).toBe(MISMATCH_CEILING);
    });
  });

  describe("ⓒ 평면 전제 — 리뷰 L-7의 사각이 기대던 그 전제를 오늘 처음 계약이 진다", () => {
    it("라우트 열하나가 전부 평면이다 (`/` 하나 + 한 세그먼트 열)", () => {
      expect(FLATNESS.nested, "한 세그먼트를 넘는 라우트가 생겼어요").toEqual([]);
      const root = APP_TREE.routes.filter((route) => segmentsOf(route).length === 0);
      const single = APP_TREE.routes.filter((route) => segmentsOf(route).length === 1);
      expect(root).toEqual(["/"]);
      expect(single).toHaveLength(10);
      expect(root.length + single.length).toBe(APP_TREE.routes.length);
    });

    it("동적 세그먼트·라우트 그룹·병렬 라우트가 0건이다", () => {
      expect(APP_TREE.dynamicDirectories, "동적 세그먼트 디렉터리가 생겼어요").toEqual([]);
      expect(FLATNESS.dynamic, "동적 세그먼트가 경로에 들어왔어요").toEqual([]);
      expect(APP_TREE.routeGroups, "라우트 그룹이 생겼어요").toEqual([]);
      expect(APP_TREE.parallelRoutes, "병렬 라우트가 생겼어요").toEqual([]);
      expect(APP_TREE.routeHandlers, "라우트 핸들러(route.ts)가 생겼어요").toEqual([]);
      expect(APP_TREE.layouts, "app/** 아래 레이아웃이 하나가 아니에요").toEqual(["layout.tsx"]);
      // page가 아닌 진입 셋은 이 바늘 밖이고, 그 사실이 면제가 0건인 이유다.
      expect(APP_TREE.nonPageEntries).toEqual(["error.tsx", "global-error.tsx", "not-found.tsx"]);
    });

    it("⚠️ 평면 전제가 유령이 아니다 — 픽스처의 동적 세그먼트를 이 자가 잡는다", () => {
      // 순수 판정.
      const fixture = flatnessOf(["/", "/items", "/items/[id]", "/a/b"]);
      expect(fixture.dynamic).toEqual(["/items/[id]"]);
      expect(fixture.nested).toEqual(["/a/b", "/items/[id]"]);
      // 그리고 걷는 자 자신 — 가짜 `app/` 트리를 하나 지어 실제로 걸어 본다.
      const base = mkdtempSync(join(tmpdir(), "wooriai-route-surface-"));
      try {
        mkdirSync(join(base, "items", "[id]"), { recursive: true });
        writeFileSync(join(base, "page.tsx"), "export default function Page() { return null; }\n");
        writeFileSync(join(base, "items", "page.tsx"), "export default function Page() { return null; }\n");
        writeFileSync(join(base, "items", "[id]", "page.tsx"), "export default function Page() { return null; }\n");
        const scanned = scanAppTree(base);
        expect(scanned.routes).toEqual(["/", "/items", "/items/[id]"]);
        expect(scanned.dynamicDirectories).toEqual(["items/[id]"]);
        expect(flatnessOf(scanned.routes).nested).toEqual(["/items/[id]"]);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });
  });

  describe("ⓓ 역할 게이트와 갈리지 않는다 — 숨김은 라우트의 부재가 아니다", () => {
    it("roles가 붙은 href도 라우트로 실재한다", () => {
      const gated = NAV_ITEMS_TODAY.filter((item) => item.roles.length > 0);
      // ⚠️ 그 셋의 **정확한 목록**은 admin-write-role-gate.test.ts의 축이라 여기서는 등호로 묻지
      //    않는다. 이 계약이 지는 것은 *숨긴 화면도 실재하는가* 하나다(유령 방지 하한만 둔다).
      expect(gated.length, "역할 게이트가 붙은 href가 0건이에요 — 파싱이 roles를 놓쳤어요").toBeGreaterThan(0);
      for (const item of gated) {
        expect(APP_TREE.routes, `${item.href}는 숨겨졌을 뿐 실재해야 해요`).toContain(item.href);
        expect(item.roles.every((role) => role.length > 0), `${item.href}의 roles가 비어 있어요`).toBe(true);
      }
      // 그리고 숨김은 대조에서 빠지지 않는다 — 게이트된 href도 위 ⓑ의 모집단 안이다.
      for (const item of gated) expect(NAV_HREFS).toContain(item.href);
    });
  });

  describe("ⓔ 래칫 — 수는 줄지 않고 어긋남은 0을 넘지 않는다", () => {
    it("라우트 수와 내비 수는 줄지 않는다", () => {
      expect(APP_TREE.routes.length).toBeGreaterThanOrEqual(ROUTE_FLOOR);
      expect(NAV_HREFS.length).toBeGreaterThanOrEqual(NAV_FLOOR);
    });

    it("⚠️ 두 하한은 **손으로 적은 수가 아니라 걷기·파싱이 받치는 하한**이다 (등호가 아니다 · 리뷰 M-5)", () => {
      // ⚠️⚠️ **두 시점 — 라운드 92 리뷰 M-5가 이 두 줄을 등호에서 하한으로 옮기고 자기 자리로 냈다.**
      //  · **트랙 C 커밋 시점**: 이 두 줄은 `ROUTE_FLOOR === 오늘의 라우트 수` 꼴의 **등호**였고,
      //    게다가 *"이 트랙은 어드민 소스를 0바이트 고쳤다"* 라는 **다른 축의 `it` 안**에 얹혀
      //    있었다. 그래서 ⓐ 정당한 라우트 추가가 이 계약을 빨갛게 만들었고(래칫이 하한인 이유가
      //    그 자리에서 뒤집혔다) ⓑ 빨개졌을 때 사람이 읽는 실패 이름이 *바이트 불변*이라 무엇이
      //    깨졌는지 말해 주지 못했다.
      //  · **오늘**: 하한(`≥`)으로 물고, 래칫 절 안 자기 자리에 선다. 유령 방지는 그대로다 —
      //    두 수가 상수가 아니라 **걷기와 파싱에서** 나온다는 사실을 아래 두 줄이 함께 문다.
      expect(APP_TREE.routes.length, "라우트 수가 하한 아래로 내려갔어요").toBeGreaterThanOrEqual(ROUTE_FLOOR);
      expect(NAV_HREFS.length, "내비 href 수가 하한 아래로 내려갔어요").toBeGreaterThanOrEqual(NAV_FLOOR);
      // ⚠️ 그 두 수가 **저장소를 읽어서** 나온다(0이면 위 하한이 유령이 된다).
      expect(APP_TREE.pageFiles.length, "라우트가 파일에서 파생되지 않았어요").toBe(APP_TREE.routes.length);
      expect(APP_TREE.walkedFiles, "app/**을 걷지 못했어요").toBeGreaterThanOrEqual(WALKED_FILE_FLOOR);
      expect(NAV_ITEMS_TODAY.length, "내비 표를 파싱하지 못했어요").toBe(NAV_HREFS.length);
    });

    it("어긋남은 0을 넘지 않고, 면제도 늘지 않는다", () => {
      expect(TODAY.danglingHrefs.length).toBeLessThanOrEqual(MISMATCH_CEILING);
      expect(TODAY.unlistedRoutes.length).toBeLessThanOrEqual(MISMATCH_CEILING);
      expect(EXEMPTIONS.length).toBeLessThanOrEqual(EXEMPTION_CEILING);
    });
  });

  describe("ⓕ 사각 — 값으로 적혀 있고, 오늘 다시 잰다", () => {
    it("사각마다 이유와 재개 조건이 있다 (빈 이유 금지 · 최소 셋)", () => {
      expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(3);
      expect(new Set(BLIND_SPOTS.map((spot) => spot.key)).size).toBe(BLIND_SPOTS.length);
      for (const spot of BLIND_SPOTS) {
        expect(spot.reason.length, `${spot.key}: 이유가 비어 있어요`).toBeGreaterThan(40);
        expect(spot.resumeCondition.length, `${spot.key}: 재개 조건이 비어 있어요`).toBeGreaterThan(20);
        expect(spot.resumeCondition, `${spot.key}: 재개 조건이 형을 밝히지 않았어요`).toMatch(
          /재개 조건\((사건형|결정형)/
        );
      }
    });

    it("사각의 값이 오늘도 그대로다 (유령 사각 금지)", () => {
      for (const spot of BLIND_SPOTS) {
        expect(spot.measure(), `${spot.key}: 오늘 다시 잰 값이 갈렸어요`).toBe(spot.today);
      }
    });

    it("⚠️ 자가 **진짜 자**다 — 상수를 돌려주는 자가 0건이다 (라운드 91 리뷰 L-6)", () => {
      for (const spot of BLIND_SPOTS) {
        const body = String(spot.measure).replace(/\s+/g, " ");
        expect(body, `${spot.key}: 자가 상수를 돌려줘요 — 저장소를 읽는 자로 바꿔 주세요`).not.toMatch(
          /^\( *\) *=> *-?\d+$/
        );
      }
      // 그리고 자들이 실제로 저장소를 읽는지 — 걷기와 읽기가 둘 다 0이 아니다.
      expect(APP_TREE.walkedFiles).toBeGreaterThan(0);
      expect(SELF_CODE.length).toBeGreaterThan(0);
    });

    it("⚠️ 이 트랙은 어드민 소스를 0바이트 고쳤다 (부정 단언 — 계약이 소스를 지킨다)", () => {
      // 오늘 어긋남이 0이라 **고칠 것이 없었다**(고쳤다면 *계약이 소스를 지킨다*가 *소스가 계약을
      // 맞춘다*로 뒤집힌다). 그 사실을 값으로 남긴다: 이 파일이 부르는 쓰기는 전부 OS 임시
      // 디렉터리 뿌리(`base`)에서 시작하고, 그 뿌리는 `mkdtempSync`가 만든다 — 어드민 뿌리를
      // 가리키는 쓰기는 0건이다.
      // ⚠️ 바늘을 낱말로 적되 **자기 자신에 걸리지 않는 모양**으로 적는다(옆 파일이 같은 자리에서
      //    고른 그 형식): 아래 정규식은 `쓰기이름(` 을 찾는데, 이 파일에서 그 이름들이 문자열로
      //    서는 자리는 전부 `|` 나 `)` 가 뒤따라 걸리지 않는다.
      const writes = [...SELF_CODE.matchAll(/\b(?:writeFileSync|mkdirSync|rmSync)\(\s*([^,)]*)/g)].map(
        (match) => match[1]
      );
      expect(writes.length, "픽스처의 쓰기 자리를 찾지 못했어요 — 이 단언이 유령이에요").toBeGreaterThan(0);
      for (const target of writes) {
        expect(target, `쓰기 대상 ${target}가 임시 뿌리에서 시작하지 않아요`).toContain("base");
      }
      expect(SELF_CODE, "임시 뿌리가 mkdtemp에서 나오지 않아요").toMatch(
        /const base = mkdtempSync\(join\(tmpdir\(\)/
      );
    });
  });
});
