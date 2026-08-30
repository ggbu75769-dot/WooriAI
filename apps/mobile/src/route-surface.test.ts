import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 80 트랙 D (GAP-080 #4) — **라우트 표면의 첫 그물**.
 *
 * 80라운드 동안 이 저장소에는 `app/**`의 라우트 파일을 **열거하는** 계약이 0건이었다.
 * `apps/mobile/src`의 계약 파일 서른아홉 중 `readdirSync`를 쓰는 열넷은 문구·토큰·env·슬라이스를
 * 세고, 라우트를 세는 것은 하나도 없었다. DNC-003(하단 탭 넷)을 지키는 단언조차 **간접 셋**뿐이다
 * (`src/settings-flow.test.ts`·`src/import-flow.test.ts`가 `"Tabs.Screen"` 문자열의 존재만 묻고,
 * `src/settings/support-links.test.ts`가 금지 낱말 넷을 묻는다) — **탭이 다섯 번째로 늘어도
 * 빨개지는 자리가 없었다.**
 *
 * ⚠️ 그리고 그물이 없는 동안 **같은 URL에 두 화면이 서 있었다.** expo-router에서 `(...)`로 감싼
 * 세그먼트는 URL에 나타나지 않으므로, `app/(onboarding)/budget.tsx`는 `/budget`으로도 등록되고
 * 그 URL에는 이미 `app/budget.tsx`(예산 수정 화면)가 있다. 정찰이 잰 그 한 자리 말고 **하나가
 * 더 있다**: `app/(tabs)/index.tsx`와 `app/index.tsx`가 둘 다 `/`다(이 그물이 처음 잰 값이다).
 *
 * ## 이 계약이 하는 것 (그리고 하지 않는 것)
 *
 *  ⓐ **전수 열거 + URL 정규화** — `app/**`의 라우트 파일을 전부 세고 그룹 세그먼트를 지운 URL로
 *     정규화한다. 대장은 `파일 → URL`이고, 라우트 파일이 하나 늘거나 줄면 빨개진다.
 *  ⓑ **DNC-003 파생** — `app/(tabs)/_layout.tsx`에서 `href: null`이 아닌 `Tabs.Screen`이 정확히
 *     넷이고 그 이름이 `index`·`records`·`items`·`reports`일 것. 손 목록이 아니라 **레이아웃
 *     소스에서 파생**한다(그래서 다섯째 탭이 서면 빨개진다).
 *  ⓒ **겹치는 URL이 이유가 적힌 목록과 정확히 일치할 것** — 오늘 둘(`/`·`/budget`).
 *     ⚠️ **셋째가 생기는 날 빨개진다.**
 *  ⓓ **참조 0건 URL이 이유가 적힌 제외와 정확히 일치할 것** — 오늘 넷(`(onboarding)` 그림자 중
 *     아무도 부르지 않는 넷).
 *
 * ⚠️ **하지 않는 것 하나가 이 계약의 성패다.** `/budget`을 눌렀을 때 **어느 화면이 이기는지**는
 * 소스가 답할 수 없다(expo-router의 충돌 해소 규칙이 답한다). 그래서 이 파일은 *"오늘 겹친다"* 만
 * 고정하고 *"어느 쪽이 이긴다"* 는 한 줄도 주장하지 않는다 — 착지 화면은 **확인의 표의 실기기
 * 항목**이 답한다(`docs/qa/runtime-verification-required.md` §1-1, 라운드 80 신설분).
 * 모르는 것을 아는 것처럼 적으면, 다음 사람이 그 문장을 근거로 확인을 건너뛴다.
 *
 * 화면은 이 repo의 vitest에서 렌더할 수 없으므로 소스를 읽는 관례를 따른다
 * (`src/screen-header-back.test.ts`·`src/ui-pixel-lock-flow.test.ts` 참고).
 */
const mobileRoot = process.cwd();
const appRoot = join(mobileRoot, "app");
const srcRoot = join(mobileRoot, "src");

function walkFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(path));
    else found.push(path);
  }
  return found;
}

/** `app/` 아래의 상대 경로(POSIX 표기) — 대장의 키다. */
const appRelative = (absolutePath: string) => relative(appRoot, absolutePath).split(sep).join("/");

/**
 * 라우트 모듈 = `app/**`의 `.ts(x)` 중 **테스트가 아닌 것**.
 *
 * ⚠️ 라운드 80 리뷰 P-1: 종전 판정(`/\.tsx?$/`)에는 테스트 제외가 없었다. 이 저장소는 오늘
 * `app/**` 아래에 테스트를 두지 않지만(그래서 값이 같다), 하나라도 생기는 날 그 파일이 **라우트
 * 파일로 세어져** 대장·겹침 스윕이 통째로 어긋난다 — `src/a11y-contract.test.ts`의 라우트 전수가
 * 같은 제외를 이미 진다(같은 모집단은 같은 규칙으로 센다).
 */
const isRouteModule = (file: string) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file);
const isLayout = (file: string) => /(^|\/)_layout\.tsx?$/.test(file);

/** 라우트 파일 전수 — 레이아웃(`_layout`)은 화면이 아니라 껍데기라 뺀다(아래에서 따로 센다). */
const routeFiles = walkFiles(appRoot).map(appRelative).filter(isRouteModule).filter((f) => !isLayout(f)).sort();
const layoutFiles = walkFiles(appRoot).map(appRelative).filter(isRouteModule).filter(isLayout).sort();

/**
 * `<Tabs.Screen … />` 태그 전수.
 *
 * ⚠️ 라운드 80 리뷰 P-1 — **이 파싱은 자기 닫힘 태그를 가정한다.** `[\s\S]*?\/>`는 게으른
 * 매칭이라, 누군가 `<Tabs.Screen …>자식</Tabs.Screen>` 형태로 바꾸면 그 태그는 **다음에 나오는
 * 아무 `/>`까지** 삼켜 이름·`href: null` 판정이 조용히 어긋난다(빨개지지 않는다 — 이 계약이
 * 가장 싫어하는 실패 모양이다). 그래서 **여는 `<Tabs.Screen` 수와 매칭 수가 같은지**를 함께
 * 묻는다: 자기 닫힘이 아닌 태그가 하나라도 생기면 그 자리에서 빨개지고, 그때 이 함수를 고치는
 * 것이 결정이 된다.
 */
function tabScreenTags(layout: string): string[] {
  const tags = [...layout.matchAll(/<Tabs\.Screen\b[\s\S]*?\/>/g)].map((match) => match[0]);
  const opens = layout.match(/<Tabs\.Screen\b/g) ?? [];
  expect(
    tags.length,
    `<Tabs.Screen>이 자기 닫힘 태그가 아니다(여는 태그 ${opens.length} · 자기 닫힘 ${tags.length}) — 이 파싱은 그 가정 위에 있다`
  ).toBe(opens.length);
  // 삼킴 방지: 한 태그 안에 여는 태그가 두 번 나오면 게으른 매칭이 이미 어긋난 것이다.
  for (const tag of tags) {
    expect((tag.match(/<Tabs\.Screen\b/g) ?? []).length, `한 태그가 다른 태그를 삼켰다: ${tag.slice(0, 120)}`).toBe(1);
  }
  return tags;
}

const GROUP_SEGMENT = /^\(.+\)$/;

/**
 * 라우트 파일 → URL. expo-router의 두 규칙만 쓴다.
 *  · `(...)`로 감싼 세그먼트는 **URL에 나타나지 않는다**(그룹).
 *  · 마지막 세그먼트가 `index`면 **접힌다**.
 * 동적 세그먼트(`[token]`)는 그대로 둔다 — 이 계약의 단위는 매칭이 아니라 **자리**다.
 */
function routeUrl(file: string): string {
  const segments = file.replace(/\.tsx?$/, "").split("/").filter((segment) => !GROUP_SEGMENT.test(segment));
  if (segments[segments.length - 1] === "index") segments.pop();
  return "/" + segments.join("/");
}

/** 그룹 세그먼트를 **지우지 않은** 경로 — 앱이 `"/(tabs)/more"`처럼 부를 수 있는 그 형태다. */
function groupQualifiedPath(file: string): string {
  const segments = file.replace(/\.tsx?$/, "").split("/");
  if (segments[segments.length - 1] === "index") segments.pop();
  return "/" + segments.join("/");
}

/**
 * ## 대장 — `파일 → URL` 전수 (라운드 80 실측)
 *
 * ⚠️ 줄 번호가 아니라 **파일**이 단위다. 라우트 파일이 하나 늘거나 줄거나 옮겨지면 이 표가
 * 빨개지고, 그때 겹침 스윕(아래 ⓒ)도 함께 답을 다시 낸다 — *"파일이 하나 늘면 아무도 모른다"* 가
 * 오늘로 끝나는 자리다.
 */
const ROUTE_SURFACE: ReadonlyArray<readonly [file: string, url: string]> = [
  ["(auth)/login.tsx", "/login"],
  ["(onboarding)/budget.tsx", "/budget"],
  ["(onboarding)/child-profile.tsx", "/child-profile"],
  ["(onboarding)/child-status.tsx", "/child-status"],
  ["(onboarding)/prepared-items.tsx", "/prepared-items"],
  ["(onboarding)/resume.tsx", "/resume"],
  ["(tabs)/index.tsx", "/"],
  ["(tabs)/items.tsx", "/items"],
  ["(tabs)/more.tsx", "/more"],
  ["(tabs)/records.tsx", "/records"],
  ["(tabs)/reports.tsx", "/reports"],
  ["budget.tsx", "/budget"],
  ["expenses/[expenseId].tsx", "/expenses/[expenseId]"],
  ["expenses/new.tsx", "/expenses/new"],
  ["expenses/recurring.tsx", "/expenses/recurring"],
  ["family/accept/[token].tsx", "/family/accept/[token]"],
  ["family/index.tsx", "/family"],
  ["family/invite.tsx", "/family/invite"],
  ["import/[importJobId].tsx", "/import/[importJobId]"],
  ["import/index.tsx", "/import"],
  ["index.tsx", "/"],
  ["items/[itemTemplateId].tsx", "/items/[itemTemplateId]"],
  ["launch-animation.tsx", "/launch-animation"],
  ["notifications.tsx", "/notifications"],
  ["onboarding/budget.tsx", "/onboarding/budget"],
  ["onboarding/child-profile.tsx", "/onboarding/child-profile"],
  ["onboarding/child-status.tsx", "/onboarding/child-status"],
  ["onboarding/prepared-items.tsx", "/onboarding/prepared-items"],
  ["onboarding/resume.tsx", "/onboarding/resume"],
  ["pixel-lock.tsx", "/pixel-lock"],
  ["settings/app-lock.tsx", "/settings/app-lock"],
  ["settings/children.tsx", "/settings/children"],
  ["settings/index.tsx", "/settings"],
  ["settings/notifications.tsx", "/settings/notifications"],
  ["settings/privacy.tsx", "/settings/privacy"],
  ["sync-status.tsx", "/sync-status"]
];

/** 레이아웃 둘 — 화면이 아니라서 라우트 대장 밖이지만, 새 레이아웃이 서면 알아야 한다. */
const LAYOUT_FILES = ["(tabs)/_layout.tsx", "_layout.tsx"] as const;

/**
 * ## 겹치는 URL — 오늘 둘
 *
 * ⚠️ **이 표는 "겹친다"만 적는다.** `landingScreen`이 `null`인 것은 게으름이 아니라 판정이다 —
 * 소스는 어느 쪽이 이기는지 모른다. 값을 채우려면 **실기기 확인**이 먼저다(확인의 표 §1-1).
 */
type OverlapEntry = {
  /** 겹치는 URL. */
  readonly url: string;
  /** 그 URL로 등록되는 라우트 파일 전부(정렬). */
  readonly files: readonly string[];
  /** 왜 겹치는가 — 빈 문자열일 수 없다. */
  readonly reason: string;
  /** ⚠️ 어느 화면에 착지하는가. **소스가 답할 수 없어 오늘은 미상**이다. */
  readonly landingScreen: null;
  /** 이 겹침이 오늘 위험한가 — 위험의 크기는 그 URL을 누가 부르는가로 갈린다. */
  readonly addressedByProductCode: boolean;
};

const URL_OVERLAPS: readonly OverlapEntry[] = [
  {
    url: "/",
    files: ["(tabs)/index.tsx", "index.tsx"],
    reason:
      "`(tabs)`가 URL에 나타나지 않는 그룹이라 홈 탭(`app/(tabs)/index.tsx`)이 `/`로도 등록되고, " +
      "그 URL에는 진입 라우팅 화면(`app/index.tsx` — 온보딩 진행도를 읽고 갈 곳을 정한다)이 이미 있다. " +
      "앱은 홈으로 갈 때 `\"/(tabs)\"`라고 **그룹 접두사를 붙여** 부르고 진입으로 갈 때만 `\"/\"`를 " +
      "부르므로, 오늘 이 겹침이 사용자에게 보이는 자리는 관측되지 않았다(딥링크·복원은 미확인).",
    landingScreen: null,
    addressedByProductCode: true
  },
  {
    url: "/budget",
    files: ["(onboarding)/budget.tsx", "budget.tsx"],
    reason:
      "`(onboarding)`이 URL에 나타나지 않는 그룹이라 초기 예산 설정 화면(`app/(onboarding)/budget.tsx` — " +
      "기본값이 채워진 채 저장 후 다음 단계로 간다)이 `/budget`으로도 등록되고, 그 URL에는 예산 수정 " +
      "화면(`app/budget.tsx`)이 이미 있다. ⚠️ 온보딩 화면의 **정본 URL은 `/onboarding/budget`**이고 " +
      "(그 자리에 재수출 한 줄이 서 있다), 제품 코드가 부르는 `\"/budget\"` 넷은 전부 예산 수정을 " +
      "뜻한다 — 더보기 메뉴·설정 화면·홈 예산 진행바·**예산 경계 알림의 착지 지점**. " +
      "어느 쪽이 이기는지는 실기기 확인 항목이다.",
    landingScreen: null,
    addressedByProductCode: true
  }
];

/**
 * ## 참조 0건 URL — 이유가 적힌 제외
 *
 * `(onboarding)` 그룹의 다섯 화면은 URL을 **둘씩** 진다: 그룹이 지워진 그림자(`/resume` 등)와,
 * `app/onboarding/`의 재수출 한 줄이 세우는 정본(`/onboarding/resume` 등). 앱은 언제나 정본을
 * 부르므로 그림자는 아무도 부르지 않는다. ⚠️ **그림자 다섯 중 넷만 여기 있다** — 다섯째
 * (`/budget`)는 조용하지 않았다. 이미 있는 라우트와 겹쳤고, 그래서 위의 겹침 표에 있다.
 */
const UNREFERENCED_URL_REASONS: Readonly<Record<string, string>> = {
  "/child-profile":
    "`app/(onboarding)/child-profile.tsx`의 그룹 그림자. 앱은 정본 `/onboarding/child-profile`만 부른다" +
    "(`src/onboarding/steps.ts` · `app/(onboarding)/child-status.tsx`).",
  "/child-status":
    "`app/(onboarding)/child-status.tsx`의 그룹 그림자. 앱은 정본 `/onboarding/child-status`만 부른다" +
    "(`app/index.tsx` · `app/(auth)/login.tsx` · `app/settings/privacy.tsx` 등 여섯).",
  "/prepared-items":
    "`app/(onboarding)/prepared-items.tsx`의 그룹 그림자. 앱은 정본 `/onboarding/prepared-items`만 부른다.",
  "/resume":
    "`app/(onboarding)/resume.tsx`의 그룹 그림자. 앱은 정본 `/onboarding/resume`만 부른다(`app/index.tsx`)."
};

/**
 * ## 이유가 적힌 특수 라우트 셋
 *
 * 정찰이 *"참조 0건"* 으로 적어 둔 셋인데, 실측하면 셋 다 **부르는 자리가 있다**(아래 단언이 그
 * 값을 잰다). 다만 셋은 보통의 화면과 다른 문으로만 들어오고, **그 이유가 값으로 적힌 자리가
 * 오늘까지 없었다.** 문이 사라지면(예: `href: null`이 지워지면) 빨개진다.
 */
const SPECIAL_ROUTE_DOORS: ReadonlyArray<{
  readonly file: string;
  readonly reason: string;
  /** 그 문이 실재한다는 증거 — `[읽는 파일, 그 파일에 있어야 하는 조각]`. */
  readonly evidence: readonly (readonly [file: string, marker: string])[];
}> = [
  {
    file: "pixel-lock.tsx",
    reason: "캡처 전용 화면. `__DEV__`이거나 `EXPO_PUBLIC_PIXEL_LOCK === \"1\"`일 때만 열린다 — 출시 빌드의 사용자 여정에는 없다.",
    evidence: [
      ["app/pixel-lock.tsx", "__DEV__ || process.env.EXPO_PUBLIC_PIXEL_LOCK === \"1\""],
      ["app/index.tsx", "/pixel-lock?screen=HOME-001"]
    ]
  },
  {
    file: "launch-animation.tsx",
    reason: "스플래시. 세션이 없을 때 탭 레이아웃이 여기로 리다이렉트하는 것이 유일한 일반 경로다.",
    evidence: [["app/(tabs)/_layout.tsx", "<Redirect href=\"/launch-animation\" />"]]
  },
  {
    file: "(tabs)/more.tsx",
    reason:
      "탭 바에서 빠진 다섯째 파일. `href: null`이 **DNC-003(하단 탭 넷)을 지키는 바로 그 장치**이고, " +
      "화면 자체는 홈의 퀵액션이 `\"/(tabs)/more\"`로 민다.",
    evidence: [
      ["app/(tabs)/_layout.tsx", "<Tabs.Screen name=\"more\" options={{ href: null }} />"],
      ["app/(tabs)/index.tsx", "router.push(\"/(tabs)/more\")"]
    ]
  }
];

/** `(onboarding)` 그림자 다섯과 그것을 정본 URL로 올려 주는 재수출 다섯. */
const ONBOARDING_REEXPORTS: ReadonlyArray<readonly [reexport: string, target: string]> = [
  ["onboarding/budget.tsx", "../(onboarding)/budget"],
  ["onboarding/child-profile.tsx", "../(onboarding)/child-profile"],
  ["onboarding/child-status.tsx", "../(onboarding)/child-status"],
  ["onboarding/prepared-items.tsx", "../(onboarding)/prepared-items"],
  ["onboarding/resume.tsx", "../(onboarding)/resume"]
];

/** `/budget`을 부르는 제품 코드 — 이 URL이 한가한 자리가 아니라는 사실의 값. */
const BUDGET_URL_CONSUMERS = [
  "app/settings/index.tsx",
  "src/home/budget-progress.ts",
  "src/notifications/notification-route.ts",
  "src/settings/more-menu.ts"
] as const;

const readSource = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

// ---------------------------------------------------------------------------
// 참조 스윕 — "이 URL을 부르는 자리가 있는가"
// ---------------------------------------------------------------------------

/**
 * 라우트 문자열이 **내비게이션 자리**에 선 것만 센다. 파일 전체에서 문자열을 주우면
 * `src/api/client.ts`의 서버 경로(`/expenses/${id}`)까지 라우트 참조로 세어져, 죽은 라우트가
 * 살아 있는 것처럼 보인다. 그래서 창을 좁힌다.
 */
const NAVIGATION_CONTEXT =
  /(?:router\.(?:push|replace|navigate|dismissTo)\s*\(|href\s*[=:]|pathname\s*:|route\s*:|routes\s*:|<Redirect\b|(?:function|const|type)\s+\w*(?:href|route|path)\w*)/gi;
/** 그 창 안에서 `/`로 시작하는 문자열/템플릿 리터럴을 줍는다. */
const ROUTE_LITERAL = /["'`](\/[^"'`\s]*)/g;
const CONTEXT_WINDOW = 220;

function normalizeTarget(literal: string): string {
  const withoutQuery = literal.split("?")[0].split("#")[0];
  const [beforeInterpolation] = withoutQuery.split("${");
  return beforeInterpolation;
}

/** 목적지 문자열 → 그 문자열을 쓰는 파일들(모바일 워크스페이스 상대 경로). */
function collectNavigationTargets(): Map<string, Set<string>> {
  const sources = [...walkFiles(appRoot), ...walkFiles(srcRoot)].filter(
    (path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)
  );
  const targets = new Map<string, Set<string>>();
  for (const absolutePath of sources) {
    const text = readFileSync(absolutePath, "utf8");
    const owner = relative(mobileRoot, absolutePath).split(sep).join("/");
    NAVIGATION_CONTEXT.lastIndex = 0;
    let context: RegExpExecArray | null;
    while ((context = NAVIGATION_CONTEXT.exec(text))) {
      const window = text.slice(context.index, context.index + CONTEXT_WINDOW);
      ROUTE_LITERAL.lastIndex = 0;
      let literal: RegExpExecArray | null;
      while ((literal = ROUTE_LITERAL.exec(window))) {
        const target = normalizeTarget(literal[1]);
        if (!targets.has(target)) targets.set(target, new Set());
        targets.get(target)!.add(owner);
      }
    }
  }
  return targets;
}

const navigationTargets = collectNavigationTargets();

/** 이 라우트 파일을 부르는 **다른 파일**들. 동적 세그먼트는 `[` 앞까지의 접두사로 만난다. */
function referencesTo(file: string): string[] {
  const url = routeUrl(file);
  const grouped = groupQualifiedPath(file);
  const candidates = new Set([url, grouped, url.split("[")[0], grouped.split("[")[0]]);
  const owners = new Set<string>();
  for (const [target, files] of navigationTargets) {
    if (!candidates.has(target)) continue;
    for (const owner of files) if (owner !== `app/${file}`) owners.add(owner);
  }
  return [...owners].sort();
}

describe("GAP-080 #4 라우트 표면 계약 (트랙 D) — 열거·겹침·유일성", () => {
  it("ⓐ `app/**` 라우트 파일 전수가 대장과 정확히 일치한다(파일이 하나 늘면 빨개진다)", () => {
    expect(routeFiles.length, "라우트 파일이 하나도 안 잡혔다 = 스윕이 끊어졌다").toBeGreaterThan(0);
    expect(routeFiles).toEqual(ROUTE_SURFACE.map(([file]) => file));
    expect(layoutFiles).toEqual([...LAYOUT_FILES]);
  });

  it("ⓐ 대장의 URL이 정규화 함수의 답과 한 자도 다르지 않다", () => {
    expect(ROUTE_SURFACE.map(([file, url]) => `${file} → ${url}`)).toEqual(
      ROUTE_SURFACE.map(([file]) => `${file} → ${routeUrl(file)}`)
    );
  });

  it("ⓐ URL 정규화는 그룹 세그먼트를 지우고 `index`를 접는다(합성 픽스처)", () => {
    expect(routeUrl("(tabs)/index.tsx")).toBe("/");
    expect(routeUrl("index.tsx")).toBe("/");
    expect(routeUrl("(onboarding)/budget.tsx")).toBe("/budget");
    expect(routeUrl("settings/index.tsx")).toBe("/settings");
    expect(routeUrl("family/accept/[token].tsx")).toBe("/family/accept/[token]");
    // 그룹은 여러 겹이어도 전부 지워진다 — 다음에 그룹이 중첩돼도 이 답은 같다.
    expect(routeUrl("(a)/(b)/deep.tsx")).toBe("/deep");
    // 반대로 그룹 접두사를 남긴 형태는 앱이 실제로 부르는 그 문자열이다.
    expect(groupQualifiedPath("(tabs)/more.tsx")).toBe("/(tabs)/more");
    expect(groupQualifiedPath("(tabs)/index.tsx")).toBe("/(tabs)");
  });

  it("ⓑ DNC-003 — 탭 바에 서는 `Tabs.Screen`이 정확히 넷이고 그 이름이 홈·기록·준비템·리포트다", () => {
    const layout = readSource("app/(tabs)/_layout.tsx");
    const screens = tabScreenTags(layout);
    // 실재 확인: 표식이 사라졌는데 조용히 초록인 일이 없게 한다.
    expect(screens.length, "`<Tabs.Screen …/>`을 하나도 못 찾았다 = 파싱이 끊어졌다").toBeGreaterThan(0);

    const parsed = screens.map((screen) => {
      const name = /name="([^"]+)"/.exec(screen);
      expect(name, `이름 없는 Tabs.Screen: ${screen}`).not.toBeNull();
      return { name: name![1], hidden: /href:\s*null/.test(screen) };
    });

    expect(parsed.filter((screen) => !screen.hidden).map((screen) => screen.name)).toEqual([
      "index",
      "records",
      "items",
      "reports"
    ]);
    expect(parsed.filter((screen) => screen.hidden).map((screen) => screen.name)).toEqual(["more"]);
  });

  it("ⓑ 탭 다섯의 이름이 전부 실재하는 라우트 파일이고, 탭 바 넷의 URL이 그 넷이다", () => {
    const layout = readSource("app/(tabs)/_layout.tsx");
    const screens = tabScreenTags(layout);
    expect(screens.length).toBe(5);

    const tabRouteFiles = routeFiles.filter((file) => file.startsWith("(tabs)/"));
    for (const screen of screens) {
      const name = /name="([^"]+)"/.exec(screen)![1];
      expect(tabRouteFiles, `Tabs.Screen name="${name}"에 짝이 되는 파일이 없다`).toContain(`(tabs)/${name}.tsx`);
    }
    // 탭 바에 서는 넷이 실제로 어떤 URL인가 — 이름이 아니라 **URL**로도 한 번 못박는다.
    expect(["index", "records", "items", "reports"].map((name) => routeUrl(`(tabs)/${name}.tsx`))).toEqual([
      "/",
      "/records",
      "/items",
      "/reports"
    ]);
    // 라우트 파일 수(5)와 탭 선언 수(5)가 같아야 한다 — 파일만 늘고 선언이 없으면 빨개진다.
    expect(tabRouteFiles.length).toBe(screens.length);
  });

  it("ⓒ 같은 URL에 파일이 둘 이상인 자리가 이유가 적힌 목록과 정확히 일치한다(셋째가 생기면 빨개진다)", () => {
    const byUrl = new Map<string, string[]>();
    for (const file of routeFiles) {
      const url = routeUrl(file);
      byUrl.set(url, [...(byUrl.get(url) ?? []), file]);
    }
    const measured = [...byUrl.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([url, files]) => ({ url, files: [...files].sort() }))
      .sort((left, right) => left.url.localeCompare(right.url));

    expect(measured).toEqual(URL_OVERLAPS.map(({ url, files }) => ({ url, files: [...files] })));
    // 겹치지 않는 URL은 서른둘이고, 그 합이 파일 수와 맞는다(파생으로 다시 센다).
    expect(byUrl.size + measured.reduce((sum, entry) => sum + entry.files.length - 1, 0)).toBe(routeFiles.length);
  });

  it("ⓒ 겹침의 이유는 빈 문자열일 수 없고, 계약은 어느 쪽이 이기는지 주장하지 않는다", () => {
    for (const overlap of URL_OVERLAPS) {
      expect(overlap.reason.trim().length, `${overlap.url}의 이유가 비어 있다`).toBeGreaterThan(0);
      expect(overlap.files.length, `${overlap.url}이 겹침 목록에 있는데 파일이 하나다`).toBeGreaterThan(1);
      // ⚠️ 이 단언이 트랙 D의 경계다. 착지 화면은 소스가 아니라 **실기기**가 답한다
      //    (확인의 표 §1-1). 값이 채워지는 날은 그 확인이 끝난 날이다.
      expect(overlap.landingScreen, `${overlap.url}의 착지 화면을 소스가 주장하고 있다`).toBeNull();
    }
  });

  it("ⓒ `/budget`은 한가한 라우트가 아니다 — 부르는 자리 넷이 전부 실재한다", () => {
    for (const consumer of BUDGET_URL_CONSUMERS) {
      expect(readSource(consumer), `${consumer}에 "/budget"이 없다`).toContain('"/budget"');
    }
    // 그 넷 중 하나가 **예산 경계 알림의 착지 지점**이라는 사실을 값으로 남긴다 — 겹침이
    // 위험한 이유가 여기에 있다(푸시를 누른 사람이 어디에 서는가).
    const notificationRoute = readSource("src/notifications/notification-route.ts");
    expect(notificationRoute).toContain('if (entry.type === "budget_80" || entry.type === "budget_100") return "/budget";');
    expect(referencesTo("budget.tsx").length, "`/budget`을 부르는 자리가 하나도 안 잡혔다").toBeGreaterThan(0);
  });

  it("ⓒ 재현 — 그룹에 파일이 하나 더 생기면 겹침 스윕이 그것을 잡는다", () => {
    // 오늘의 표면에 `app/(onboarding)/notifications.tsx`가 하나 늘었다고 치면, 그 URL은
    // `/notifications`이고 `app/notifications.tsx`와 겹친다. 그물이 실제로 잡는가.
    const withNewGroupScreen = [...routeFiles, "(onboarding)/notifications.tsx"];
    const byUrl = new Map<string, string[]>();
    for (const file of withNewGroupScreen) {
      const url = routeUrl(file);
      byUrl.set(url, [...(byUrl.get(url) ?? []), file]);
    }
    const duplicated = [...byUrl.entries()].filter(([, files]) => files.length > 1).map(([url]) => url).sort();
    expect(duplicated).toEqual(["/", "/budget", "/notifications"]);
    // 그리고 그 셋째는 이유가 적힌 목록에 없으므로 위의 계약이 빨개진다.
    expect(URL_OVERLAPS.map((overlap) => overlap.url)).not.toContain("/notifications");
  });

  it("ⓓ 참조 0건 URL이 이유가 적힌 제외와 정확히 일치한다", () => {
    const unreferenced = routeFiles
      .filter((file) => referencesTo(file).length === 0)
      .map(routeUrl)
      .sort();
    expect(unreferenced).toEqual(Object.keys(UNREFERENCED_URL_REASONS).sort());
    for (const [url, reason] of Object.entries(UNREFERENCED_URL_REASONS)) {
      expect(reason.trim().length, `${url}의 제외 이유가 비어 있다`).toBeGreaterThan(0);
    }
  });

  it("ⓓ 참조 스윕이 실제로 재고 있다 — 대표 라우트 넷은 부르는 자리를 가진다", () => {
    // 스윕이 조용히 끊어지면 위 단언이 "전부 참조 0건"으로도 초록일 수 있다(모집단이 비면
    // 어떤 부정 단언도 통과한다 — 라운드 78 E가 이름 붙인 그 병). 그래서 하한을 함께 둔다.
    expect(navigationTargets.size, "내비게이션 목적지를 하나도 못 주웠다").toBeGreaterThan(20);
    for (const file of ["settings/privacy.tsx", "import/[importJobId].tsx", "(tabs)/more.tsx", "pixel-lock.tsx"]) {
      expect(referencesTo(file).length, `${file}을 부르는 자리가 0건으로 잡혔다`).toBeGreaterThan(0);
    }
  });

  it("ⓓ `(onboarding)` 그림자 다섯은 재수출 다섯이 정본 URL을 진다", () => {
    for (const [reexport, target] of ONBOARDING_REEXPORTS) {
      const source = readSource(`app/${reexport}`).trim();
      expect(source, `${reexport}이 한 줄 재수출이 아니다`).toBe(`export { default } from "${target}";`);
      // 정본 URL은 부르는 자리가 있다(그림자는 위 제외 목록에 있다).
      expect(referencesTo(reexport).length, `${routeUrl(reexport)}을 부르는 자리가 없다`).toBeGreaterThan(0);
    }
    // ⚠️ 그림자 다섯 중 **넷만** 조용하다. 다섯째(`/budget`)는 이미 있는 라우트와 겹쳤다.
    const shadowUrls = routeFiles.filter((file) => file.startsWith("(onboarding)/")).map(routeUrl).sort();
    expect(shadowUrls.length).toBe(ONBOARDING_REEXPORTS.length);
    expect(shadowUrls.filter((url) => url in UNREFERENCED_URL_REASONS)).toHaveLength(4);
    expect(shadowUrls.filter((url) => URL_OVERLAPS.some((overlap) => overlap.url === url))).toEqual(["/budget"]);
    // 그리고 오늘 **어느 자리도 `(onboarding)` 그룹 경로를 직접 부르지 않는다** — 그래서 그
    // 다섯 화면에 들어가는 문은 재수출이 세운 정본 URL뿐이다.
    for (const file of routeFiles.filter((route) => route.startsWith("(onboarding)/"))) {
      expect(navigationTargets.get(groupQualifiedPath(file)) ?? new Set(), `${groupQualifiedPath(file)}을 부르는 자리`).toHaveLength(0);
    }
  });

  it("ⓓ 이유가 적힌 특수 라우트 셋 — 그 문이 소스에 실재한다", () => {
    for (const door of SPECIAL_ROUTE_DOORS) {
      expect(routeFiles, `${door.file}이 라우트 대장에 없다`).toContain(door.file);
      expect(door.reason.trim().length, `${door.file}의 이유가 비어 있다`).toBeGreaterThan(0);
      for (const [file, marker] of door.evidence) {
        expect(readSource(file), `${file}에 ${door.file}의 문이 없다: ${marker}`).toContain(marker);
      }
    }
  });
});
