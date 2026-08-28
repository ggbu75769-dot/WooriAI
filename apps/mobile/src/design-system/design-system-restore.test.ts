import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { chartColors, semanticColors } from "./tokens/color";
import { elevation } from "./tokens/elevation";
import { iconSize } from "./tokens/icon";
import { radius } from "./tokens/radius";
import { spacing } from "./tokens/spacing";
import { typography } from "./tokens/typography";
import { breakpoints, horizontalPaddingForWidth } from "./tokens/breakpoint";
import {
  catalogItemStatusLabel,
  CATALOG_ONLY_ITEM_STATUS_LABELS,
  MOD_V1_ITEM_STATUS_LABELS,
  UNKNOWN_ITEM_STATUS_LABEL
} from "./item-status-vocabulary";

/**
 * DSN-053 P1 — 이식한 design-system의 계약.
 *
 * 토큰은 순수 데이터라 값 그대로 단언한다. 컴포넌트는 react-native를 import하므로 이 repo의
 * vitest에서는 실행할 수 없고(ui-pixel-lock-flow.test.ts와 같은 사정), 나머지 스위트의 관례대로
 * **소스 문자열 계약**으로 고정한다.
 *
 * 여기서 지키려는 것은 "이식본이 c20deeb 원본대로다"이다 -- 값이 흔들리면 화면(P2)이 승인
 * 캡처와 다시 어긋난다.
 */
const designSystemRoot = join(process.cwd(), "src/design-system");

function readSource(relativePath: string): string {
  const filePath = join(designSystemRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

describe("design-system tokens (c20deeb)", () => {
  it("keeps the semantic surface/text/action palette", () => {
    expect(semanticColors.surface).toBe("#FFFFFF");
    expect(semanticColors.surfaceMuted).toBe("#F8F6F4");
    expect(semanticColors.border).toBe("#E5DFDB");
    expect(semanticColors.textPrimary).toBe("#211E1C");
    expect(semanticColors.brandPrimary).toBe("#C94627");
    expect(semanticColors.actionPrimary).toBe("#C94627");
    expect(semanticColors.brandSecondary).toBe("#267A68");
    expect(semanticColors.actionSecondary).toBe("#FFF4EF");
    expect(semanticColors.overlay).toBe("rgba(33, 30, 28, 0.48)");
  });

  it("keeps the five status surfaces paired with their text colors", () => {
    expect(semanticColors.successSurface).toBe("#ECF8F1");
    expect(semanticColors.success).toBe("#16794B");
    expect(semanticColors.warningSurface).toBe("#FFF7E8");
    expect(semanticColors.warning).toBe("#B45309");
    expect(semanticColors.dangerSurface).toBe("#FFF0EE");
    expect(semanticColors.danger).toBe("#B42318");
    expect(semanticColors.infoSurface).toBe("#EFF5FF");
    expect(semanticColors.info).toBe("#1D4ED8");
    expect(semanticColors.reviewSurface).toBe("#F5F0FF");
    expect(semanticColors.review).toBe("#7C3AED");
  });

  it("keeps six chart colors that are all distinct", () => {
    expect(chartColors).toEqual(["#C94627", "#267A68", "#2F6FED", "#B45309", "#7C3AED", "#7A716B"]);
    expect(new Set(chartColors).size).toBe(chartColors.length);
  });

  it("keeps the spacing/radius/icon scales", () => {
    expect(spacing).toEqual({ none: 0, xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40, huge: 48, section: 64 });
    expect(radius).toEqual({ none: 0, small: 8, medium: 12, large: 16, card: 20, sheet: 28, pill: 999 });
    expect(iconSize).toEqual({ small: 16, medium: 22, large: 28, hero: 40 });
  });

  it("keeps every amount typography tier tabular so digits stay aligned", () => {
    expect(typography.display).toMatchObject({ fontSize: 32, lineHeight: 40 });
    expect(typography.body).toMatchObject({ fontSize: 15, lineHeight: 22, fontWeight: "400" });
    expect(typography.bodyStrong).toMatchObject({ fontSize: 15, lineHeight: 22, fontWeight: "700" });
    for (const tier of [typography.amountLarge, typography.amountMedium, typography.amountRegular]) {
      expect(tier.fontVariant).toEqual(["tabular-nums"]);
    }
    expect(typography.amountLarge).toMatchObject({ fontSize: 32, lineHeight: 38 });
    expect(typography.amountMedium).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(typography.amountRegular).toMatchObject({ fontSize: 18, lineHeight: 24 });
  });

  it("keeps card/overlay elevation and the width-driven page padding", () => {
    expect(elevation.card).toMatchObject({ elevation: 1, shadowOpacity: 0.08, shadowRadius: 3 });
    expect(elevation.overlay).toMatchObject({ elevation: 8, shadowOpacity: 0.16, shadowRadius: 32 });
    expect(breakpoints).toEqual({ compactMax: 479, mediumMax: 839, contentMax: 720 });
    expect(horizontalPaddingForWidth(360)).toBe(spacing.lg);
    expect(horizontalPaddingForWidth(600)).toBe(spacing.xl);
    expect(horizontalPaddingForWidth(1000)).toBe(spacing.xxl);
  });

  /**
   * 이 스케일은 `theme.radii`(card 22 · small 12 …)와 **다른 두 번째 스케일**이다. 스펙이
   * "공존 유지"라고 못박은 부분이라, 어느 한쪽이 다른 쪽으로 조용히 합쳐지지 않게 둘이 다르다는
   * 사실 자체를 고정한다.
   */
  it("coexists with theme.radii instead of quietly merging into it", async () => {
    const { theme } = await import("../theme");
    expect(theme.radii.card).toBe(22);
    expect(radius.card).toBe(20);
  });
});

describe("design-system components (c20deeb 이식본)", () => {
  const componentFiles = readdirSync(join(designSystemRoot, "components"))
    .filter((entry) => entry.endsWith(".tsx"));

  it("ports exactly the four primitives the spec named, plus the scaffold they need", () => {
    expect(componentFiles.sort()).toEqual([
      "ApplicationPrimitives.tsx",
      "CorePrimitives.tsx",
      "KoreanText.tsx",
      "ModV1Primitives.tsx",
      "ScreenScaffold.tsx"
    ]);
  });

  /**
   * 스펙 "아이콘 계열": 이식본은 `@expo/vector-icons`의 **MaterialCommunityIcons**를 쓴다
   * (같은 패키지 -- 신규 의존성 0). item-visuals의 매핑 테이블이 MCI 이름 기준이라 여기서
   * Ionicons로 갈아타면 이름이 통째로 어긋난다.
   */
  it("draws icons with MaterialCommunityIcons, never Ionicons", () => {
    for (const file of [...componentFiles.map((entry) => `components/${entry}`), "patterns/AsyncState.tsx"]) {
      const source = readSource(file);
      expect(source, file).not.toContain("Ionicons");
    }
    expect(readSource("components/ApplicationPrimitives.tsx")).toContain(
      'import { MaterialCommunityIcons } from "@expo/vector-icons"'
    );
    expect(readSource("components/ApplicationPrimitives.tsx")).toContain(
      'export type AppIconName = ComponentProps<typeof MaterialCommunityIcons>["name"]'
    );
  });

  /**
   * 라벨 문자열 자체는 `item-status-vocabulary.ts`(순수 모듈)로 올라갔다 -- 상세/동기화 화면의
   * `src/items/item-labels.ts`가 같은 값을 읽어야 두 화면이 같은 단어를 쓴다. 그래서 값은
   * **런타임으로** 단언하고(그렙보다 강하다), 컴포넌트 쪽은 그 모듈을 실제로 참조하는지만 본다.
   */
  it("keeps the eight ModV1 준비 상태 labels and their icons", () => {
    const source = readSource("components/ModV1Primitives.tsx");
    for (const [value, label] of [
      ["researching", "알아보기"],
      ["planned", "예정"],
      ["ordered", "주문"],
      ["owned", "보유"],
      ["rented", "대여"],
      ["gifted", "선물"],
      ["replacement_needed", "교체"],
      ["retired", "종료"]
    ] as const) {
      expect(MOD_V1_ITEM_STATUS_LABELS[value]).toBe(label);
      expect(source).toContain(`{ value: "${value}", label: MOD_V1_ITEM_STATUS_LABELS.${value}`);
    }
    // 카탈로그 어휘에만 있는 상태도 한국어 라벨을 갖는다 -- 라벨이 없으면 "미정"으로 뭉개진다.
    for (const [value, label] of [
      ["borrowed", "대여"],
      ["gift_expected", "선물 예정"],
      ["replacement_due", "교체 시기"],
      ["replaced", "교체 완료"],
      ["not_needed", "필요 없음"],
      ["need", "필요"],
      ["ended", "사용 종료"]
    ] as const) {
      expect(CATALOG_ONLY_ITEM_STATUS_LABELS[value]).toBe(label);
      expect(catalogItemStatusLabel(value)).toBe(label);
    }
    expect(catalogItemStatusLabel("아무거나")).toBe(UNKNOWN_ITEM_STATUS_LABEL);
    expect(catalogItemStatusLabel(null)).toBe(UNKNOWN_ITEM_STATUS_LABEL);
    // 컴포넌트는 어휘를 손으로 다시 적지 않고 모듈에 위임한다.
    expect(source).toContain("return catalogItemStatusLabel(value);");
    expect(source).not.toContain('if (value === "borrowed") return "대여";');
  });

  it("does not re-export itemStatusLabel from the barrel (같은 이름이 items 쪽에도 있다)", () => {
    const barrel = readFileSync(join(designSystemRoot, "index.ts"), "utf8");
    expect(barrel).toContain("modV1ItemStatuses");
    expect(barrel).not.toContain("itemStatusLabel,");
    // 어휘가 필요하면 순수 모듈을 쓴다.
    expect(barrel).toContain('from "./item-status-vocabulary"');
  });

  it("keeps the status pill geometry (pill radius · 24 minHeight · 10/700 label)", () => {
    const source = readSource("components/ModV1Primitives.tsx");
    expect(source).toContain(
      "backgroundColor: statusVisual.backgroundColor, borderRadius: radius.pill, minHeight: 24"
    );
    expect(source).toContain('fontSize: 10, fontWeight: "700"');
    // 준비템 타일: 148 높이 · 44 원형 아이콘 · 2줄 균형 라벨.
    expect(source).toContain("height: 148");
    expect(source).toContain("borderRadius: radius.pill, height: 44");
    expect(source).toContain("balanceCompactKoreanLabel(title)");
  });

  it("keeps every visible string in 해요체", () => {
    const source = readSource("patterns/AsyncState.tsx");
    for (const copy of [
      "불러오고 있어요.",
      "모든 기록이 동기화됐어요.",
      "변경 내용을 동기화하고 있어요.",
      "오프라인 · 연결되면 자동으로 동기화해요.",
      "서버 반영을 기다리는 변경이 있어요.",
      "확인이 필요한 동기화 충돌이 있어요."
    ]) {
      expect(source).toContain(copy);
    }
    expect(readSource("components/ApplicationPrimitives.tsx")).toContain(
      "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."
    );
  });

  /**
   * 배럴이 아직 옮기지 않은 컴포넌트를 내보내면 컴파일이 깨진다. 반대로 옮긴 것을 빼먹으면
   * P2가 파일 경로를 직접 import하게 되어 배럴이 있으나 마나가 된다.
   */
  it("exports only what was actually ported", () => {
    // 주석에는 아직 옮기지 않은 이름들이 왜 빠졌는지 적혀 있으므로 export 줄만 본다.
    const exportLines = readSource("index.ts")
      .split("\n")
      .filter((line) => line.startsWith("export "))
      .join("\n");
    for (const ported of ["ApplicationPrimitives", "CorePrimitives", "ModV1Primitives", "KoreanText", "ScreenScaffold", "AsyncState"]) {
      expect(exportLines, ported).toContain(ported);
    }
    for (const notPorted of ["NoticeCard", "PageHeader", "ResponsiveGrid", "SectionCard", "StatusChip", "OnboardingScaffold", "OnboardingControls"]) {
      expect(exportLines, notPorted).not.toContain(notPorted);
    }
  });
});
