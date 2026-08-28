import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { categoryCatalog, type CategoryCode } from "./categories";
import { buildMoreSessionMenuRows } from "./settings/more-menu";

/**
 * D1 후속(실기기 피드백 2): 아이콘 **이름**이 실제 Ionicons 글리프인지 확인하려면 글리프 목록이
 * 필요하다. `@expo/vector-icons`를 import하면 react-native가 딸려 와 이 plain-node 스위트에서
 * 실행할 수 없으므로, 패키지가 함께 배포하는 글리프맵 JSON만 읽는다(런타임이 실제로 참조하는
 * 같은 파일이라, 오타는 여기서 그대로 잡힌다).
 */
const ioniconsGlyphMap: Record<string, number> = createRequire(import.meta.url)(
  "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"
);

// Round 5A design foundation contract (docs/5차/round5a-design-spec.md §D0/§D1/§D6).
//
// theme.ts has no react-native import, so its token values are asserted directly. The new
// src/ui/*.tsx components (and app/(tabs)/_layout.tsx) import "react-native", which this repo's
// plain-node vitest setup cannot execute (no RN test renderer/mock is configured here -- see the
// existing source-contract tests such as ui-pixel-lock-flow.test.ts), so those are asserted as
// source-string contracts instead, matching the rest of this suite's convention.
const mobileRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// DSN-053 P1: 아래 스케일 값들은 **승인 캡처(c20deeb)의 값**으로 갱신했다
// (docs/5차/design-restore-spec.md "토큰 롤백 표"). 이 블록이 지키는 요지는 바뀌지 않는다 --
// "화면이 색 리터럴을 직접 쓰지 않도록 토큰이 한 곳에 있고, 레거시 평면 키는 지워지지 않고
// 그 토큰으로 재지향된다". 갱신한 것은 그 토큰이 가리키는 **값**뿐이다.
describe("D0 theme tokens", () => {
  it("defines the coral scale", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.coral).toEqual({
      50: "#FFF4EF",
      100: "#FFE4D8",
      200: "#FFC8B5",
      300: "#FFA58A",
      400: "#F98060",
      500: "#E85F3B",
      600: "#C94627",
      700: "#A93720",
      800: "#862D1D",
      900: "#67251B"
    });
  });

  it("defines cream, text, and semantic token groups", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.cream).toEqual({ bg: "#FFFDFC", surface: "#FFFFFF", surfaceAlt: "#F8F6F4" });
    expect(theme.colors.text).toEqual({ primary: "#211E1C", secondary: "#5F5854", tertiary: "#7A716B" });
    expect(theme.colors.semantic).toEqual({
      success: "#16794B",
      warning: "#B45309",
      danger: "#B42318",
      info: "#1D4ED8"
    });
  });

  it("defines the brand identity and named presentation surfaces", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.brandIdentity).toEqual({
      canvas: "#FFF9F3",
      navy: "#17324D",
      persimmon: "#FF6B4A",
      butter: "#FFD76A"
    });
    // 화면이 raw 리터럴 대신 이름으로 부르는 10개 서피스. 값이 아니라 **이름이 존재한다**는
    // 것이 요지다 -- 이름이 빠지면 그 자리는 다시 리터럴로 돌아간다.
    expect(theme.colors.presentation).toEqual({
      dangerSurface: "#FFF0ED",
      segmentedTrack: "#F5F0EA",
      chartPlot: "#FFF4EE",
      splashStageSurface: "#FFF9F4",
      importCanvas: "#FFFCFA",
      previewCoral: "#FFF0EA",
      previewYellow: "#FFF5D7",
      previewGreen: "#EAF7F2",
      previewPeach: "#FFECE6",
      previewNeutral: "#ECECEC"
    });
  });

  it("redirects legacy flat color keys onto the new D0 tokens instead of deleting them", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.mainCoral).toBe(theme.colors.coral[600]);
    expect(theme.colors.subCoral).toBe(theme.colors.coral[500]);
    expect(theme.colors.peach).toBe(theme.colors.coral[100]);
    expect(theme.colors.beige).toBe(theme.colors.cream.surfaceAlt);
    expect(theme.colors.brown).toBe(theme.colors.text.primary);
    expect(theme.colors.gray600).toBe(theme.colors.text.secondary);
    expect(theme.colors.background).toBe(theme.colors.cream.bg);
    expect(theme.colors.success).toBe(theme.colors.semantic.success);
    expect(theme.colors.warning).toBe(theme.colors.semantic.warning);
    expect(theme.colors.danger).toBe(theme.colors.semantic.danger);
  });

  it("defines a fixed 8-10 color warm-pastel category palette mapped onto every category code", async () => {
    const { theme } = await import("./theme");
    const { categoryCatalog } = await import("./categories");

    expect(theme.colors.categoryPalette.length).toBeGreaterThanOrEqual(8);
    expect(theme.colors.categoryPalette.length).toBeLessThanOrEqual(10);

    const allCodes = new Set<CategoryCode>(categoryCatalog.map((entry) => entry.code));
    for (const code of allCodes) {
      const color = theme.colors.categoryColors[code];
      expect(color, `categoryColors should map ${code}`).toBeDefined();
      expect(theme.colors.categoryPalette as readonly string[]).toContain(color);
    }
  });

  it("defines a 3-tier tabular-nums money typography scale (hero 30/800, section 17/700, row 15/600)", async () => {
    const { theme } = await import("./theme");
    expect(theme.money.hero).toMatchObject({ fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] });
    expect(theme.money.section).toMatchObject({ fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] });
    expect(theme.money.row).toMatchObject({ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] });
  });
});

// DSN-053 P1: MOB-121(MoneyText)·CLN-130(ListRow)이 "아무 화면도 채택하지 않은 죽은 컴포넌트"
// 라며 지웠던 두 블록을 c20deeb에서 되돌린다. 승인 캡처의 시각 문법(금액 위계, 왼쪽 원형 아이콘
// 슬롯 행)이 이 둘을 전제로 하고, P2 화면 트랙이 채택한다.

describe("D0 MoneyText component contract", () => {
  const source = readSource("src/ui/MoneyText.tsx");

  it("exposes hero|section|row size tiers backed by theme.money", () => {
    expect(source).toContain('export type MoneyTextSize = "hero" | "section" | "row"');
    expect(source).toContain("theme.money[size]");
  });

  it("renders the 원 suffix a step smaller than the number and applies tabular-nums", () => {
    expect(source).toContain("formatKrwParts");
    expect(source).toContain("suffixFontSize");
    expect(source).toContain("tier.fontSize * 0.6");
    expect(source).toContain('fontVariant: ["tabular-nums"]');
  });

  it("prefixes income/refund amounts with + and colors them with semantic.success", () => {
    expect(source).toContain('sign?: "income" | "refund"');
    expect(source).toContain("theme.colors.semantic.success");
    expect(source).toContain('sign ? "+" : ""');
  });

  it("is backed by a live formatKrwParts export, not a re-inlined formatter", async () => {
    const { formatKrwParts } = await import("./money");
    expect(formatKrwParts(38500)).toEqual({ number: "38,500", suffix: "원" });
    // 부호는 컴포넌트가 붙인다 -- 포맷터는 언제나 절댓값이다.
    expect(formatKrwParts(-38500)).toEqual({ number: "38,500", suffix: "원" });
    expect(formatKrwParts(Number.NaN)).toEqual({ number: "0", suffix: "원" });
  });
});

describe("D0 ListRow component contract", () => {
  const source = readSource("src/ui/ListRow.tsx");

  it("is additive -- does not replace the pre-existing ListRow in src/ui.tsx", () => {
    const legacyUiSource = readSource("src/ui.tsx");
    expect(legacyUiSource).toContain("export function ListRow(");
  });

  it("exposes a left circular color icon slot, title+subtitle, and a right value/badge slot", () => {
    expect(source).toContain("iconBackgroundColor");
    expect(source).toContain("borderRadius: 20");
    expect(source).toContain("title: string");
    expect(source).toContain("subtitle?: string");
    expect(source).toContain("value?: string");
    expect(source).toContain("badge?: React.ReactNode");
  });

  it("keeps the row's touch target at theme.touchTarget regardless of onPress", () => {
    expect(source).toContain("minHeight: theme.touchTarget");
  });
});

describe("D6 EmptyState component contract", () => {
  const source = readSource("src/ui/EmptyState.tsx");

  it("exposes icon/title/description/cta props", () => {
    expect(source).toContain("icon?: string");
    expect(source).toContain("title: string");
    expect(source).toContain("description?: string");
    expect(source).toContain("ctaLabel?: string");
    expect(source).toContain("onPressCta?: () => void");
  });
});

describe("D0 StageBadge component contract", () => {
  const source = readSource("src/ui/StageBadge.tsx");

  it("uses coral-50 background with coral-700 text", () => {
    expect(source).toContain("theme.colors.coral[50]");
    expect(source).toContain("theme.colors.coral[700]");
  });
});

describe("D0/D6 Skeleton component contract", () => {
  const source = readSource("src/ui/Skeleton.tsx");

  it("exposes Skeleton plus SkeletonCard/SkeletonRow presets", () => {
    expect(source).toContain("export function Skeleton(");
    expect(source).toContain("export function SkeletonRow(");
    expect(source).toContain("export function SkeletonCard(");
  });

  it("pulses opacity via Animated and respects reduce-motion", () => {
    expect(source).toContain("Animated.loop(");
    expect(source).toContain("Animated.sequence(");
    expect(source).toContain("useNativeDriver: true");
    expect(source).toContain("AccessibilityInfo.isReduceMotionEnabled");
    expect(source).toContain("reduceMotionEnabled");
  });
});

// MOB-121: the D6 EmptyState contract block was removed along with src/ui/EmptyState.tsx —
// a dead component no screen adopted; screens use src/ui.tsx's EmptyStateCard instead.

// CLN-130: the D0 StageBadge contract block was removed along with src/ui/StageBadge.tsx —
// another unadopted D0 component. The coral[50]/coral[700] badge recipe it defined survives in
// src/ui.tsx's StatusBadge (warning tone), pinned by src/a11y-contract.test.ts (A11Y-117).

// R20-A: the report tab's 카테고리 비중 chart. The old donut arc was drawn with the
// border-quadrant trick (four border colors on a rounded View), which can only express four fixed
// 90° wedges -- the angles carried no data. It is replaced, for real data, by a stacked share bar
// whose slice widths are the actual proportions. The logged-out preview keeps the decorative donut
// so the pixel-lock capture stays unchanged.
describe("R20-A 카테고리 비중 proportional share bar", () => {
  const source = readSource("src/ui.tsx");
  const chartBlock = source.slice(source.indexOf("export function DonutChartCard"), source.indexOf("export function EmptyStateCard"));

  it("drives real segments through the pure share math instead of fixed wedges", () => {
    expect(source).toContain('import { computeCategoryShares } from "./reports/category-share"');
    expect(chartBlock).toContain("computeCategoryShares(segments)");
    // Widths are the proportions themselves -- no rounded-off percentage strings, no 90° wedges.
    expect(chartBlock).toContain("flexGrow: slice.widthPercent");
    expect(chartBlock).toContain("flexBasis: 0");
    // Real data must never reach the four-wedge arc again.
    expect(chartBlock).not.toContain("arcColors = segments");
  });

  it("keeps the legend readable: swatch color, category name, amount and corrected percent", () => {
    expect(chartBlock).toContain("donutSegmentPalette[index % donutSegmentPalette.length]");
    expect(chartBlock).toContain("{slice.label}");
    expect(chartBlock).toContain("{formatKrw(slice.amountKrw)}");
    expect(chartBlock).toContain("{slice.percentLabel}");
    // A11Y-117: the bar is decorative, each legend row is one announced element.
    expect(chartBlock).toContain("accessibilityElementsHidden");
    expect(chartBlock).toContain("accessibilityLabel={`${slice.label}, ${slice.percentLabel}, ${formatKrw(slice.amountKrw)}`}");
  });

  it("never falls back to the decorative preview legend when real amounts add up to nothing", () => {
    expect(chartBlock).toContain("shares.length === 0");
    expect(chartBlock).toContain("아직 비중을 보여줄 지출이 없어요.");
  });

  it("leaves the logged-out preview donut in place for the pixel-lock capture", () => {
    expect(chartBlock).toContain("reportCategoryLegend.map(([label, percent])");
    expect(chartBlock).toContain('transform: [{ rotate: "-22deg" }]');
  });

  it("computes shares that fill the bar exactly and keep tiny categories visible", async () => {
    const { computeCategoryShares, MIN_SLICE_WIDTH_PERCENT } = await import("./reports/category-share");
    const slices = computeCategoryShares([
      { label: "기저귀/위생", amountKrw: 700_000 },
      { label: "식비/간식", amountKrw: 299_000 },
      { label: "기타", amountKrw: 1_000 },
      { label: "빈 카테고리", amountKrw: 0 }
    ]);

    expect(slices.map((slice) => slice.label)).toEqual(["기저귀/위생", "식비/간식", "기타"]);
    expect(slices.reduce((sum, slice) => sum + slice.percent, 0)).toBe(100);
    expect(slices.reduce((sum, slice) => sum + slice.widthPercent, 0)).toBeCloseTo(100, 9);
    expect(slices[2].widthPercent).toBe(MIN_SLICE_WIDTH_PERCENT);
    expect(slices[0].widthPercent).toBeGreaterThan(slices[1].widthPercent);
  });
});

describe("D1 tab bar outlined/filled wiring", () => {
  const source = readSource("app/(tabs)/_layout.tsx");

  it("keeps the 4 always-visible tab labels and the hidden more route", () => {
    for (const label of ["홈", "기록", "준비템", "리포트", "더보기"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain('name="more"');
    expect(source).toContain("href: null");
  });

  it("defines an outlined (inactive) and filled (active) icon glyph pair per tab", () => {
    expect(source).toContain("outline");
    expect(source).toContain("filled");
    expect(source).toContain("focused ? tabs[name].filled : tabs[name].outline");
  });

  it("tints the active tab with coral-500", () => {
    expect(source).toContain("theme.colors.coral[500]");
    expect(source).toContain("tabBarActiveTintColor: theme.colors.coral[500]");
  });
});

/**
 * D1 후속 (실기기 APK 피드백 2 "아이콘들이 다 예전걸로 돌아간 것 같음").
 *
 * D1은 탭바만 Ionicons로 옮겼고 나머지 화면에는 텍스트 글리프(○●□■☆★◇◆ ▦▣▥▮▤ ⟳ ↗)가
 * 그대로 남아 있었다. 글리프는 기기 폰트에 따라 굵기·크기가 제각각이거나 네모(tofu)로
 * 떨어져 "예전 아이콘"으로 보인다. 아래는 그 화면들이 탭바와 **같은 아이콘 계열**을 쓴다는
 * 계약이다 -- 문구·순서·목적지는 어느 화면에서도 바뀌지 않았다.
 */
describe("D1 후속: 화면 아이콘이 탭바와 같은 Ionicons 계열", () => {
  // 2차(같은 피드백의 "남은 화면"): 설정 · 더보기 · 기록 · 추천 · 빠른 지출 입력까지 넓혔다.
  const screens = [
    "app/(tabs)/index.tsx",
    "app/notifications.tsx",
    "app/family/index.tsx",
    "app/import/index.tsx",
    "app/settings/index.tsx",
    "app/(tabs)/more.tsx",
    "app/(tabs)/records.tsx",
    "app/(tabs)/items.tsx",
    "app/expenses/new.tsx",
    // 라운드 49 QA(P3-4): 온보딩 저장 실패 카드(⚠)가 마지막 텍스트 글리프였다. 화면이 아니라
    // 네 온보딩 단계가 공유하는 컴포넌트라 여기 목록에 이름으로 들어온다.
    "src/onboarding/step-ui.tsx"
  ] as const;

  it("아이콘을 쓰는 화면이 모두 Ionicons를 가져온다", () => {
    for (const screen of screens) {
      expect(readSource(screen), `${screen} should import Ionicons`).toContain(
        'import { Ionicons } from "@expo/vector-icons";'
      );
    }
  });

  it("아이콘 자리에 남아 있던 텍스트 글리프가 없다", () => {
    // 아이콘으로 쓰이던 글리프만 본다. 본문 부호(› 화살표, ✓ 체크)는 대상이 아니고,
    // 주석/문서 문자열은 아래 검사 대상이 아니도록 '아이콘 자리' 패턴으로만 확인한다.
    const iconGlyphs = [
      "▦", "▣", "▥", "▮", "▤", "⟳", "☆", "★", "◈", "□", "◆", "●", "↗", "♥", "✿", "🍴",
      // 2차에서 없앤 나머지 글리프(설정 · 더보기 · 기록 · 추천 · 카테고리 타일).
      "✎", "◎", "⇩", "⇪", "♙", "⌁", "ⓘ", "⌕", "♧", "◐", "♡", "↻", "⏱", "▱", "▭", "⌘", "⌂", "⊕",
      // 라운드 49 QA(P3-4): 온보딩 저장 실패 카드에 남아 있던 경고 글리프.
      "⚠"
    ];
    for (const screen of screens) {
      const source = readSource(screen);
      for (const glyph of iconGlyphs) {
        expect(source, `${screen} should not render ${glyph} as an icon`).not.toContain(`icon="${glyph}"`);
        expect(source, `${screen} should not render ${glyph} as an icon`).not.toContain(`>${glyph}<`);
        expect(source, `${screen} should not render ${glyph} as an icon`).not.toContain(`icon: "${glyph}"`);
      }
    }
  });

  /**
   * 2차: 8타일 카탈로그(src/categories.ts)는 순수 데이터라 React 노드를 담을 수 없다. 그래서
   * `icon`을 **Ionicons 이름**으로 바꾸고, 빠른 지출 입력 화면(app/expenses/new.tsx)이 그 이름을
   * 그린다. 이름이 실제 Ionicons 글리프인지까지 확인한다(오타는 런타임에 물음표로 떨어진다).
   */
  it("카테고리 8타일이 Ionicons 이름을 들고, 입력 화면이 그것을 그린다", () => {
    for (const entry of categoryCatalog) {
      expect(entry.icon in ioniconsGlyphMap, `${entry.label}: ${entry.icon} should be an Ionicons name`).toBe(true);
      expect(entry.icon.endsWith("-outline"), `${entry.label}: ${entry.icon} should be outlined`).toBe(true);
    }
    // 같은 code를 공유하는 두 타일("분유/유제품"·"식비")도 서로 다른 아이콘이라 눈으로 구별된다.
    expect(new Set(categoryCatalog.map((entry) => entry.icon)).size).toBe(categoryCatalog.length);

    // 라운드 49 QA(P3-11b): 아래 단언들은 **타일이 그리는 그 Ionicons 블록**에 대해서만
    // 성립해야 한다. 예전에는 파일 전체에서 `accessible={false}`를 찾아, 화면 어딘가 다른
    // 아이콘이 그 속성을 들고 있으면 타일이 접근성 트리에 그대로 노출돼도 통과했다.
    const source = readSource("app/expenses/new.tsx");
    const tileComponentStart = source.indexOf("function ExpenseCategoryIconButton");
    const tileComponentEnd = source.indexOf("export default function NewExpenseScreen");
    expect(tileComponentStart).toBeGreaterThan(-1);
    expect(tileComponentEnd).toBeGreaterThan(tileComponentStart);
    const tileIconBlock = source.slice(tileComponentStart, tileComponentEnd);
    expect(tileIconBlock).toContain("<Ionicons");
    expect(tileIconBlock).toContain("name={category.icon}");
    // 장식이므로 접근성 트리에서 감춘다 -- 라벨은 타일의 Text와 accessibilityLabel이 말한다.
    expect(tileIconBlock).toContain("accessible={false}");
    // 크기·색은 예전 Text 스타일 토큰을 그대로 읽어 쓴다(선택 시 흰색 반전 포함).
    expect(tileIconBlock).toContain("size={quickExpenseCategoryTileStyle.iconText.fontSize}");
    expect(tileIconBlock).toContain("quickExpenseCategoryTileStyle.iconTextSelected.color");
  });

  it("오프라인 상태 아이콘이 의미를 유지한 채 Ionicons 이름 테이블이다", () => {
    const source = readSource("app/(tabs)/records.tsx");
    expect(source).toContain("function offlineStatusIconName(syncState: string): keyof typeof Ionicons.glyphMap");
    for (const [state, name] of [
      ["conflict", "warning-outline"],
      ["failed", "alert-circle-outline"],
      ["syncing", "refresh-outline"]
    ] as const) {
      expect(source).toContain(`if (syncState === "${state}") return "${name}";`);
    }
    // 나머지(대기)는 시계.
    expect(source).toContain('return "time-outline";');
  });

  it("설정·더보기의 같은 항목이 같은 아이콘을 쓴다", () => {
    const settingsSource = readSource("app/settings/index.tsx");
    const menuRows = buildMoreSessionMenuRows({ exportTitle: "데이터 내보내기" });
    const iconOf = (id: string) => menuRows.find((row) => row.id === id)!.icon;
    for (const [id, title] of [
      ["children", "아이 관리"],
      ["family", "가족 관리"],
      ["budget", "예산 수정"]
    ] as const) {
      expect(settingsSource, `설정의 "${title}" 행`).toContain(`icon={<SettingsRowIcon name="${iconOf(id)}" />}`);
    }
    // 내보내기는 설정·더보기 양쪽에 있고 같은 공유 시트를 연다 -- 아이콘도 한 벌이다.
    expect(settingsSource).toContain(`icon={<SettingsRowIcon name="${iconOf("export")}" />}`);
    // 모든 세션 메뉴 아이콘이 실제 Ionicons 이름이다.
    for (const row of menuRows) {
      expect(row.icon in ioniconsGlyphMap, `${row.title}: ${row.icon}`).toBe(true);
    }

    /**
     * 라운드 49 QA(P3-5): 같은 규칙이 **비로그인 미리보기 행**에도 적용된다. 예전에는 더보기
     * 미리보기의 첫 행만 person-circle-outline(아이 프로필 계열)을 쓰면서 목적지는 가구
     * 화면(/family)이라, 같은 목적지가 화면마다 다른 그림으로 보였다. 라벨·순서·목적지는
     * 픽셀 락 때문에 그대로 두고 아이콘만 맞춘다.
     */
    const moreSource = readSource("app/(tabs)/more.tsx");
    const previewRowsStart = moreSource.indexOf("const moreMenuRows = [");
    const previewRows = moreSource.slice(previewRowsStart, moreSource.indexOf("] as const satisfies", previewRowsStart));
    expect(previewRowsStart).toBeGreaterThan(-1);
    expect(previewRows).toContain(`{ icon: "${iconOf("family")}", title: "프로필 관리", route: "/family" }`);
    // 미리보기 행의 아이콘도 전부 실제 Ionicons 이름이다.
    for (const match of previewRows.matchAll(/icon: "([^"]+)"/g)) {
      expect(match[1] in ioniconsGlyphMap, `미리보기 행 아이콘: ${match[1]}`).toBe(true);
    }
  });

  /**
   * 라운드 49 QA(P3-11c): 이름이 **어느 종류에 붙는지**까지 고정한다.
   *
   * 예전 단언은 다섯 이름이 파일 어딘가에 있기만 하면 통과였다 -- 예산 80%와 100% 아이콘이
   * 서로 바뀌어도, 주석에만 남고 표에서 사라져도 그대로 초록이었다. 기록 탭의 오프라인 상태
   * 아이콘(바로 위 테스트)이 이미 쓰는 방식대로 **표의 한 줄씩**을 확인한다.
   */
  it("알림 종류별 아이콘이 Ionicons 이름 테이블이다", () => {
    const source = readSource("app/notifications.tsx");
    expect(source).toContain('Record<AppNotification["type"], keyof typeof Ionicons.glyphMap>');

    const tableStart = source.indexOf("const notificationIconByType");
    expect(tableStart).toBeGreaterThan(-1);
    const table = source.slice(tableStart, source.indexOf("};", tableStart));
    for (const [type, name] of [
      ["budget_80", "wallet-outline"],
      ["budget_100", "alert-circle-outline"],
      ["stage_transition", "sparkles-outline"],
      ["purchase_pending", "bag-check-outline"],
      ["weekly_summary", "stats-chart-outline"]
    ] as const) {
      expect(table, `${type} 행`).toContain(`${type}: "${name}"`);
      expect(name in ioniconsGlyphMap, `${type}: ${name}`).toBe(true);
    }
    // 알 수 없는 종류는 여전히 아이콘 자리만 비운다(ListRow의 icon은 선택 항목).
    expect(source).toContain("icon={iconName ? <Ionicons");
  });

  it("홈 퀵액션 4칸이 Ionicons 노드를 넘긴다", () => {
    const source = readSource("app/(tabs)/index.tsx");
    for (const name of ["create-outline", "cube-outline", "bar-chart-outline", "menu-outline"]) {
      expect(source).toContain(`<QuickActionIcon name="${name}" />`);
    }
  });

  it("공용 ListRow·QuickActionIconButton이 노드 아이콘을 받는다(문자열 호환 유지)", () => {
    const uiSource = readSource("src/ui.tsx");
    expect(uiSource).toContain("icon: React.ReactNode; label: string");
    expect(uiSource).toContain("icon?: React.ReactNode;");
    // 문자열이면 예전과 똑같이 Text로 그린다 -- 남아 있는 문자열 호출부(설정·기록 탭)는 그대로.
    // 라운드 49 QA(P3-8): 단, **빈 문자열은 아이콘 없음**이라 자리를 만들지 않는다.
    const listRowBlock = uiSource.slice(
      uiSource.indexOf("export function ListRow"),
      uiSource.indexOf("export function ProductCard")
    );
    expect(listRowBlock).toContain('typeof icon === "string" ? (');
    expect(listRowBlock).toContain("icon ? (");
    expect(listRowBlock).toContain("<Text style={{ color: theme.colors.mainCoral, fontSize: 20 }}>{icon}</Text>");
    expect(listRowBlock).toContain(") : null");
  });
});
