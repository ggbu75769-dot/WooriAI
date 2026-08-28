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

describe("D0 theme tokens", () => {
  it("defines the coral scale", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.coral).toEqual({
      50: "#FFF3F0",
      100: "#FFE4DD",
      200: "#FFC9BB",
      300: "#FFA88E",
      400: "#F97B5C",
      500: "#EF6644",
      600: "#DB4F2E",
      700: "#B93E23"
    });
  });

  it("defines cream, text, and semantic token groups", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.cream).toEqual({ bg: "#FFF8F1", surface: "#FFFFFF", surfaceAlt: "#FFF9F3" });
    expect(theme.colors.text).toEqual({ primary: "#3D3733", secondary: "#6E645C", tertiary: "#9C918A" });
    expect(theme.colors.semantic).toEqual({
      success: "#2E9E6B",
      warning: "#E8A13A",
      danger: "#D3382F",
      info: "#5B7FA6"
    });
  });

  it("redirects legacy flat color keys onto the new D0 tokens instead of deleting them", async () => {
    const { theme } = await import("./theme");
    expect(theme.colors.mainCoral).toBe(theme.colors.coral[500]);
    expect(theme.colors.subCoral).toBe(theme.colors.coral[400]);
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

// MOB-121: the D0 MoneyText contract block was removed along with src/ui/MoneyText.tsx —
// a dead component no screen adopted; money rendering goes through src/money.ts's formatKrw.

// CLN-130: the D0 ListRow contract block was removed along with src/ui/ListRow.tsx — the
// "additive, alongside src/ui.tsx" component that no screen ever adopted. Rows go through
// src/ui.tsx's ListRow (settings, records, notifications), whose touch-target and button-role
// contracts live in src/a11y-contract.test.ts.

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
    "app/expenses/new.tsx"
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
      "✎", "◎", "⇩", "⇪", "♙", "⌁", "ⓘ", "⌕", "♧", "◐", "♡", "↻", "⏱", "▱", "▭", "⌘", "⌂", "⊕"
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

    const source = readSource("app/expenses/new.tsx");
    expect(source).toContain("name={category.icon}");
    // 장식이므로 접근성 트리에서 감춘다 -- 라벨은 타일의 Text와 accessibilityLabel이 말한다.
    expect(source).toContain("accessible={false}");
    // 크기·색은 예전 Text 스타일 토큰을 그대로 읽어 쓴다(선택 시 흰색 반전 포함).
    expect(source).toContain("size={quickExpenseCategoryTileStyle.iconText.fontSize}");
    expect(source).toContain("quickExpenseCategoryTileStyle.iconTextSelected.color");
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
  });

  it("알림 종류별 아이콘이 Ionicons 이름 테이블이다", () => {
    const source = readSource("app/notifications.tsx");
    expect(source).toContain('Record<AppNotification["type"], keyof typeof Ionicons.glyphMap>');
    for (const name of [
      "wallet-outline",
      "alert-circle-outline",
      "sparkles-outline",
      "bag-check-outline",
      "stats-chart-outline"
    ]) {
      expect(source).toContain(`"${name}"`);
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
    expect(uiSource).toContain('{typeof icon === "string" ? <Text');
  });
});
