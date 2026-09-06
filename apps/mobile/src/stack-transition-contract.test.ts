import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 101 W2 F8 — **스택 전환 문법 계약**.
 *
 * 라운드 96 T3까지 전환이 명시된 스택 화면은 지출 기록 시트(`expenses/new` · slide_from_bottom)
 * 하나였고, 나머지는 플랫폼 기본값(Android는 fade 계열)이었다. 이번 라운드가 화면군별 문법을
 * `app/_layout.tsx`에 명시했다: 시트는 아래에서, 상세/전진은 오른쪽에서, 진입 흐름은 플랫폼
 * 기본 그대로. 이 파일은 그 세 묶음이 **판정으로서** 소스에 남아 있는지를 잰다.
 *
 *  ⓐ 상세/전진 목록(FORWARD_STACK_SCREENS)의 이름 전부가 실재하는 라우트 파일이다.
 *  ⓑ 세 묶음의 합(시트 1 + 전진 목록 + 이유가 적힌 플랫폼 기본)이 루트 스택 화면 전수와
 *     정확히 일치한다 — **새 라우트 파일이 서면 여기서 빨개져 전환 결정을 요구한다**
 *     (route-surface.test.ts ⓐ가 파일 증감을 잡는 것과 짝이 되는, "전환은 정했는가" 그물).
 *  ⓒ reduce-motion 분기 — 시트·전진 둘 다 `reduceMotionEnabled ? "none" : …` 꼴이다.
 *
 * ⚠️ 이 계약은 "명시했다"까지만 잰다. 실제로 오른쪽에서 미는지·reduce-motion에서 즉시
 * 전환인지는 실기기 확인 항목이다(_layout.tsx의 FORWARD_STACK_SCREENS 주석). 화면은 이 repo의
 * vitest에서 렌더할 수 없어 소스를 읽는 관례를 따른다(src/route-surface.test.ts 참고).
 */
const mobileRoot = process.cwd();
const appRoot = join(mobileRoot, "app");

const layoutSource = readFileSync(join(appRoot, "_layout.tsx"), "utf8");

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

/** 라우트 모듈 판정 — route-surface.test.ts와 같은 모집단은 같은 규칙으로 센다. */
const isRouteModule = (file: string) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file);
const isLayout = (file: string) => /(^|\/)_layout\.tsx?$/.test(file);

const routeFiles = walkFiles(appRoot)
  .map((absolutePath) => relative(appRoot, absolutePath).split(sep).join("/"))
  .filter(isRouteModule)
  .filter((file) => !isLayout(file))
  .sort();

/**
 * 루트 `<Stack>`의 화면 이름. expo-router에서 자기 `_layout`을 가진 그룹(`(tabs)`)은 루트
 * 스택에 **한 화면**으로 서고, 나머지 라우트 파일은 확장자를 뗀 경로가 그대로 이름이다
 * (`(auth)/login`처럼 레이아웃 없는 그룹 세그먼트는 이름에 남는다).
 */
const rootStackScreenNames = [
  ...new Set(
    routeFiles.map((file) => (file.startsWith("(tabs)/") ? "(tabs)" : file.replace(/\.tsx?$/, "")))
  )
].sort();

/** `_layout.tsx`의 FORWARD_STACK_SCREENS 배열을 소스에서 파싱한다. */
function parseForwardScreens(): string[] {
  const block = /const FORWARD_STACK_SCREENS = \[([\s\S]*?)\] as const;/.exec(layoutSource);
  expect(block, "FORWARD_STACK_SCREENS 배열을 _layout.tsx에서 찾지 못했다").not.toBeNull();
  return [...block![1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

const forwardScreens = parseForwardScreens();

/** 시트 문법 — 라운드 96 T3 종전 그대로. */
const SHEET_SCREENS = ["expenses/new"] as const;

/**
 * 플랫폼 기본으로 **남겨 둔** 화면들 — 이유 없는 누락이 아니라 판정이다.
 * 여기 없는 이름이 명시 없이 생기면 아래 ⓑ가 빨개진다.
 */
const PLATFORM_DEFAULT_SCREENS: ReadonlyArray<{
  readonly screens: readonly string[];
  readonly reason: string;
}> = [
  {
    screens: ["index", "launch-animation", "(tabs)", "(auth)/login"],
    reason:
      "진입 흐름 — 진입 라우팅·스플래시·탭 세계·로그인은 replace/redirect로 갈아타는 자리라 " +
      "'옆에서 파고드는' 전진 문법이 아니다. 탭끼리의 전환은 루트 스택이 아니라 Tabs 안의 일이다."
  },
  {
    screens: [
      "(onboarding)/budget",
      "(onboarding)/child-profile",
      "(onboarding)/child-status",
      "(onboarding)/prepared-items",
      "(onboarding)/resume",
      "onboarding/budget",
      "onboarding/child-profile",
      "onboarding/child-status",
      "onboarding/prepared-items",
      "onboarding/resume"
    ],
    reason:
      "온보딩 단계 — 단계 사이를 replace로 갈아타는 자기 문법을 이미 진다. 그림자 다섯과 " +
      "재수출 정본 다섯이 짝이다(route-surface.test.ts ⓓ)."
  },
  {
    screens: ["pixel-lock"],
    reason: "캡처 전용 화면(__DEV__/EXPO_PUBLIC_PIXEL_LOCK) — 출시 빌드의 사용자 여정에 없다."
  }
];

describe("라운드 101 W2 F8 — 스택 전환 문법 계약", () => {
  it("ⓐ 상세/전진 목록의 이름 전부가 실재하는 라우트 파일이다(이름이 틀어지면 조용한 no-op이 된다)", () => {
    expect(forwardScreens.length, "전진 목록이 비었다 = 파싱이 끊어졌다").toBeGreaterThan(0);
    for (const name of forwardScreens) {
      expect(routeFiles, `FORWARD_STACK_SCREENS의 "${name}"에 짝이 되는 라우트 파일이 없다`).toContain(
        `${name}.tsx`
      );
    }
    // 중복 명시는 어느 쪽이 이기는지 모호해진다 — 한 이름은 한 번만.
    expect(new Set(forwardScreens).size).toBe(forwardScreens.length);
  });

  it("ⓑ 세 묶음(시트·전진·플랫폼 기본)의 합이 루트 스택 화면 전수와 정확히 일치한다 — 새 라우트는 전환 결정을 요구받는다", () => {
    const platformDefault = PLATFORM_DEFAULT_SCREENS.flatMap((group) => [...group.screens]);
    const declared = [...SHEET_SCREENS, ...forwardScreens, ...platformDefault].sort();
    // 세 묶음은 서로 겹치지 않는다 — 한 화면의 전환 판정은 한 자리에만 있다.
    expect(new Set(declared).size).toBe(declared.length);
    expect(declared).toEqual(rootStackScreenNames);
    // 플랫폼 기본의 이유는 빈 문자열일 수 없다.
    for (const group of PLATFORM_DEFAULT_SCREENS) {
      expect(group.reason.trim().length, `${group.screens[0]} 묶음의 이유가 비어 있다`).toBeGreaterThan(0);
      expect(group.screens.length).toBeGreaterThan(0);
    }
  });

  it("ⓒ 전진 문법은 slide_from_right, reduce-motion이면 none — 시트의 slide_from_bottom 분기도 종전 그대로다", () => {
    // 전진 목록은 map 한 자리에서 같은 옵션으로 그려진다(화면마다 값이 갈리면 문법이 아니다).
    expect(layoutSource).toContain("{FORWARD_STACK_SCREENS.map((name) => (");
    expect(layoutSource).toContain('options={{ animation: reduceMotionEnabled ? "none" : "slide_from_right" }}');
    expect(
      layoutSource.match(/animation: reduceMotionEnabled \? "none" : "slide_from_right"/g) ?? [],
      "slide_from_right 옵션은 map 안의 한 자리에만 있어야 한다(주석의 언급은 세지 않는다)"
    ).toHaveLength(1);
    // 시트 분기(라운드 96 T3)는 entry-screen-visual-restore.test.ts가 무는 그 바이트 그대로다.
    expect(layoutSource).toContain('animation: reduceMotionEnabled ? "none" : "slide_from_bottom"');
    // 분기의 원천 — 앱 루트에서 한 번 읽는 reduce-motion 판정(관례: 기존 직접 조회 자리).
    expect(layoutSource).toContain("AccessibilityInfo.isReduceMotionEnabled?.()");
  });
});
