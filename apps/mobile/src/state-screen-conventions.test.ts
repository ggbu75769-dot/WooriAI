import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { theme } from "./theme";
import { typography as designSystemTypography } from "./design-system/tokens/typography";
import { motion } from "./design-system/tokens/motion";
import { transientNoticeDurationMs } from "./ui/use-transient-notice";

/**
 * T1(디자인 시스템) — **상태 화면·공용 프리미티브 관례 계약.**
 *
 * 이 파일이 붙드는 것은 넷이다.
 *  ① 타이포 재지향 — 값이 같은 키(headline1·body1)의 단일 소스가 유지되고, caption은
 *     픽셀락 수치(11/16)로 남는다(12/18 단일화는 캡처 재대조를 동반한 2단계 몫 — 토스 리뷰).
 *     금액 3단 스케일의 단일 소스는 design-system amount 티어로 남는다.
 *  ② 상태 화면의 얼굴 — 같은 조회 실패가 두 가지 얼굴로 그려지지 않도록 LoadErrorCard가
 *     한 벌로 서 있고, EmptyStateCard의 설명 슬롯·가짜 버튼 금지 규율이 지켜진다.
 *  ③ 모션 규율 — 신설 애니메이션 전부가 motion 토큰(120/180/240)과 공용 reduce-motion 훅을
 *     쓰고, 그 훅의 원본 조회(AccessibilityInfo.isReduceMotionEnabled) 복사가 늘지 않는다.
 *  ④ 죽은 export 표류 대장 — AsyncState의 상태 화면 export 중 소비자가 없는 것을 이름으로
 *     적어 두어, 새 죽은 export가 태어나거나 채택이 생기면 이 대장이 빨개진다.
 *
 * 컴포넌트는 react-native를 import하므로 이 repo의 vitest에서 렌더할 수 없다(ui-pixel-lock-flow
 * 와 같은 사정) — 나머지 스위트의 관례대로 **소스 문자열 계약**으로 고정하고, 순수 모듈(theme·
 * 토큰·훅 상수)만 런타임으로 단언한다.
 */
const mobileRoot = process.cwd();

function source(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/** a11y-contract.test.ts와 같은 전량 스캔 — 목록을 사람이 적어 두지 않는다. */
function listSourceFiles(): string[] {
  return ["app", "src"].flatMap((root) =>
    readdirSync(join(mobileRoot, root), { encoding: "utf8", recursive: true })
      .filter((entry) => (entry.endsWith(".tsx") || entry.endsWith(".ts")) && !entry.includes(".test."))
      .map((entry) => join(root, entry).split("\\").join("/"))
  );
}

function componentBlock(sourceText: string, startMarker: string, endMarker: string): string {
  const start = sourceText.indexOf(startMarker);
  expect(start, `${startMarker}를 소스에서 찾지 못했다`).toBeGreaterThan(-1);
  const end = sourceText.indexOf(endMarker, start);
  expect(end, `${startMarker} 뒤에서 ${endMarker}를 찾지 못했다`).toBeGreaterThan(start);
  return sourceText.slice(start, end);
}

describe("① 타이포 재지향 — caption은 픽셀락 11/16 · 금액 3단 스케일", () => {
  it("theme.typography.caption은 픽셀락 수치(11/16) 리터럴로 남는다 — 12/18 단일화는 캡처 재대조를 동반한 2단계 몫", () => {
    // ⚠️ 두 시점(토스 리뷰 H) — T1은 이 자리를 `toBe(designSystemTypography.caption)` +
    // fontSize 12로 고정했었다. 그 재지향은 textStyles.caption을 소비하는 픽셀락 비세션
    // 캡처 3종(HOME-001·REP-001·ITEM-001)의 렌더를 승인 재대조 없이 움직였고(T1 자신의
    // "값이 서로 다른 키는 theme에 남는다" 규칙과도 모순), 승인 캡처 원복을 위해 11/16으로
    // 되돌렸다. design-system 쪽 caption(12/18)은 그대로다 — ModV1/Application 프리미티브의
    // 소비(typography.caption 직접 참조)는 이 값과 무관하게 종전과 같다.
    expect(theme.typography.caption).not.toBe(designSystemTypography.caption);
    expect(theme.typography.caption.fontSize).toBe(11);
    expect(theme.typography.caption.lineHeight).toBe(16);
    expect(designSystemTypography.caption.fontSize).toBe(12);
    expect(designSystemTypography.caption.lineHeight).toBe(18);
  });

  it("값이 이미 같던 키(headline1·body1)도 재지향됐다 — 두 체계가 같은 수를 두 벌로 들지 않는다", () => {
    expect(theme.typography.headline1).toBe(designSystemTypography.heading1);
    expect(theme.typography.body1).toBe(designSystemTypography.body);
  });

  it("금액 3단 스케일의 단일 소스는 design-system amount 티어다 (전부 tabular-nums)", () => {
    expect(theme.typography.amountLarge).toBe(designSystemTypography.amountLarge);
    expect(theme.typography.amountMedium).toBe(designSystemTypography.amountMedium);
    expect(theme.typography.amountRegular).toBe(designSystemTypography.amountRegular);
    for (const tier of [theme.typography.amountLarge, theme.typography.amountMedium, theme.typography.amountRegular]) {
      expect(tier.fontVariant).toEqual(["tabular-nums"]);
    }
  });

  it("히어로의 amountKrw 옵트인은 amountLarge로 서고, 레거시 문자열 경로(28/800)는 그대로다", () => {
    const heroBlock = componentBlock(source("src/ui.tsx"), "export function HeroSummaryCard", "export function QuickActionIconButton");
    expect(heroBlock).toContain("amountKrw?: number | null;");
    expect(heroBlock).toContain('typeof amountKrw === "number"');
    expect(heroBlock).toContain("textStyles.amountLarge");
    // 픽셀락(HOME-001 비세션): amountKrw 없는 호출부는 종전 렌더 그대로여야 한다.
    expect(heroBlock).toContain('<Text style={{ color: theme.colors.white, fontSize: 28, fontWeight: "800" }}>{amount}</Text>');
  });

  it("공용 ListRow 2종의 amountKrw 옵트인은 amountRegular로 선다 (금액 < 품목명 문제의 공용 몫)", () => {
    const uiListRow = componentBlock(source("src/ui.tsx"), "export function ListRow", "export function ProductCard");
    expect(uiListRow).toContain("amountKrw?: number | null;");
    expect(uiListRow).toContain("textStyles.amountRegular");
    // 레거시 value 경로는 종전 body2 렌더 그대로다(픽셀락).
    expect(uiListRow).toContain("textStyles.body2, { color: theme.colors.brown, fontWeight: \"700\" }]}>{value}</Text>");

    const surfaceListRow = componentBlock(
      source("src/design-system/components/ApplicationPrimitives.tsx"),
      "export function ListRow",
      "export function EmptyStateCard"
    );
    expect(surfaceListRow).toContain("amountKrw?: number | null;");
    expect(surfaceListRow).toContain("typography.amountRegular");
    // 금액은 낭독에도 실린다(값 문자열이 없을 때 formatKrw가 그 자리를 진다).
    expect(surfaceListRow).toContain("amountText ?? value");
  });

  /**
   * ⚠️ 토스 리뷰 M — **미배선 옵트인 금액 슬롯 대장.** T1이 "공용 API 신설"로 세운 슬롯 넷
   * (HeroSummaryCard.amountKrw · ListRow.amountKrw 두 벌 · LineChartCard.valueKrw)은 화면
   * 소비자 0으로 태어났고, ④의 AsyncState 대장 스코프 밖이라 어느 대장에도 잡히지 않았다.
   * 여기 값으로 적는다 — 배선이 생기거나 슬롯이 걷히면 이 수가 어긋나 빨개지고, 손이 이
   * 대장을 함께 옮긴다. (살아 있는 카운트업 배선은 공용 AmountCountUpText를 직접 소비하는
   * 세션 홈 히어로 하나다 — 종전의 사적 사본 HomeHeroAmount는 토스 리뷰에서 걷혔다.)
   */
  it("⚠️ 옵트인 금액 슬롯의 화면 소비자는 아직 0이다 — 공용 카운트업 직접 소비(홈 히어로)만 산다", () => {
    const uses = listSourceFiles()
      .filter((path) => path !== "src/ui.tsx" && path !== "src/design-system/components/ApplicationPrimitives.tsx")
      .filter((path) => /(?:amountKrw|valueKrw)=\{/.test(source(path)));
    expect(uses).toEqual(["app/(tabs)/index.tsx"]);
    // 그 한 자리는 슬롯이 아니라 공용 AmountCountUpText 배선이다(핀은 home-section-priority가 진다).
    expect(source("app/(tabs)/index.tsx")).toContain("<AmountCountUpText amountKrw={monthlyUsed}");
  });
});

describe("② 상태 화면의 얼굴 — LoadErrorCard · EmptyStateCard description", () => {
  const loadErrorBlock = () => componentBlock(source("src/ui.tsx"), "export function LoadErrorCard", "export function Toast(");

  it("LoadErrorCard: 실패는 문장이 말하고, onRetry 없이는 버튼 노드가 서지 않는다 (가짜 버튼 금지)", () => {
    const block = loadErrorBlock();
    expect(block).toContain(">{message}</Text>");
    expect(block).toContain("{onRetry ? <SecondaryButton label={retryLabel} onPress={onRetry} /> : null}");
    expect(block).toContain('retryLabel = "다시 시도"');
  });

  it("LoadErrorCard: 색은 기존 토큰뿐이다 — 새 색 리터럴 0건(DNC-017 축)", () => {
    const block = loadErrorBlock();
    expect(block).toContain("theme.colors.presentation.dangerSurface");
    expect(block).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
    expect(block).not.toMatch(/rgba?\(/);
  });

  it("EmptyStateCard: description은 옵트인 슬롯이다 — 없으면 종전 트리 그대로(픽셀락)", () => {
    const block = componentBlock(source("src/ui.tsx"), "export type EmptyStateCardProps", "export function LoadErrorCard");
    expect(block).toContain("description?: string");
    expect(block).toContain("{description ? (");
    // 액션 짝 규율(라운드 71 트랙 E)은 그대로 살아 있다.
    expect(block).toContain("{ actionLabel: string; onPress: () => void }");
    expect(block).toContain("{onPress && actionLabel ? <SecondaryButton label={actionLabel} onPress={onPress} /> : null}");
  });
});

describe("③ 모션 규율 — motion 토큰 · 공용 reduce-motion 훅 · 눌림 피드백", () => {
  it("신설 애니메이션이 있는 네 파일의 duration은 전부 motion 토큰이다 — 맨 숫자 duration 0건", () => {
    for (const path of [
      "src/ui.tsx",
      "src/design-system/components/ModV1Primitives.tsx",
      "src/children/ChildSwitchSheet.tsx",
      "src/MonthJumpSheet.tsx"
    ]) {
      expect(source(path), `${path}의 duration 리터럴`).not.toMatch(/duration:\s*\d/);
    }
    // 토큰 자체는 죽은 export가 아니라 실제로 읽힌다.
    expect(source("src/ui.tsx")).toContain('import { motion } from "./design-system/tokens/motion"');
    expect(motion).toEqual({ instantMs: 0, fastMs: 120, standardMs: 180, slowMs: 240 });
  });

  it("공용 훅이 단일 소스다 — isReduceMotionEnabled 직접 조회 파일은 기존 자리 넷 + 훅뿐이다", () => {
    const directReaders = listSourceFiles()
      .filter((path) => source(path).includes("isReduceMotionEnabled"))
      .sort();
    // 기존 넷은 저마다 픽셀락·라운드 계약이 소스 문자열을 물고 있어 이번 라운드 무접촉이다.
    // 다섯째부터는 복붙이 아니라 src/ui/useReducedMotion을 쓴다 — 늘면 여기서 빨개진다.
    expect(directReaders).toEqual([
      "app/_layout.tsx",
      "app/expenses/new.tsx",
      "app/launch-animation.tsx",
      "src/ui/Skeleton.tsx",
      "src/ui/useReducedMotion.ts"
    ]);
  });

  it("신설 애니메이션 전부가 reduce-motion을 존중한다 (토스트 페이드·시트 전이·프로그레스·카운트업)", () => {
    const ui = source("src/ui.tsx");
    for (const marker of [
      "export function Toast",
      "export function SheetMountTransition",
      "export function BudgetProgressBar",
      "function AmountCountUpText"
    ]) {
      const start = ui.indexOf(marker);
      expect(start, marker).toBeGreaterThan(-1);
      expect(ui.slice(start, start + 2200), `${marker}의 reduce-motion 분기`).toContain("reduceMotionEnabled");
    }
    expect(ui).toContain('import { useReducedMotion } from "./ui/useReducedMotion"');
    const budgetSummary = componentBlock(
      source("src/design-system/components/ModV1Primitives.tsx"),
      "export function BudgetSummary",
      "export function TopAppBar"
    );
    expect(budgetSummary).toContain("reduceMotionEnabled");
    expect(budgetSummary).toContain("fill.interpolate");
  });

  it("두 시트는 같은 마운트 전이 한 벌을 쓴다 (컴포넌트 내부 — 호출부 배선 불필요)", () => {
    for (const path of ["src/children/ChildSwitchSheet.tsx", "src/MonthJumpSheet.tsx"]) {
      expect(source(path), path).toContain("<SheetMountTransition>");
    }
    const transition = componentBlock(source("src/ui.tsx"), "export function SheetMountTransition", "export function ListRow");
    expect(transition).toContain("motion.standardMs");
    expect(transition).toContain("translateY");
  });

  it("공유 프리미티브의 눌리는 자리 전부에 눌림 피드백이 있다 (휴지 렌더는 opacity 1로 불변)", () => {
    const ui = source("src/ui.tsx");
    const pressables = [
      ["export function ScreenHeader", "export function Card"],
      ["export function TextButton", "export function SegmentedControl"],
      ["export function SegmentedControl", "export function CategoryChip"],
      ["export function CategoryChip", "export function StatusBadge"],
      ["export function QuickActionIconButton", "export function FloatingActionButton"],
      ["export function FloatingActionButton", "export function BottomSheetFrame"],
      ["export function ListRow", "export function ProductCard"],
      ["export function ProductCard", "export function ProductComparisonRow"]
    ] as const;
    for (const [start, end] of pressables) {
      expect(componentBlock(ui, start, end), `${start}의 눌림 피드백`).toContain("pressed ?");
    }
    // 범례 드릴다운(DonutChartCard)·알림 벨·아이 전환 행도 같은 축(opacity)을 쓴다.
    expect(componentBlock(ui, "export function DonutChartCard", "export type EmptyStateCardProps")).toContain("pressed ?");
    expect(source("src/notifications/NotificationBell.tsx")).toContain("pressed ?");
    expect(source("src/children/ChildSwitchSheet.tsx")).toContain("pressed ?");
  });
});

describe("④ 상태 export 표류 대장 — AsyncState", () => {
  const stateExports = ["LoadingState", "EmptyState", "ErrorState", "OfflineState", "SyncStatusBar"] as const;

  function consumers(name: (typeof stateExports)[number]): string[] {
    // EmptyState는 EmptyStateCard(별개 컴포넌트)와 접두가 겹친다 — 단어 경계 + Card 제외로 센다.
    const needle = new RegExp(`\\b${name}\\b(?!Card)`);
    return listSourceFiles().filter(
      (path) =>
        path !== "src/design-system/patterns/AsyncState.tsx" &&
        path !== "src/design-system/index.ts" &&
        needle.test(source(path))
    );
  }

  it("살아 있는 소비처가 실제로 있다 — SyncStatusBar는 화면이, 상태 3종은 EmptyStateCard 분류기가 쓴다", () => {
    expect(consumers("SyncStatusBar").some((path) => path.startsWith("app/"))).toBe(true);
    for (const name of ["LoadingState", "EmptyState", "ErrorState"] as const) {
      expect(consumers(name), name).toContain("src/design-system/components/ApplicationPrimitives.tsx");
    }
  });

  it("소비자 없는 export는 이름으로 적힌 이것뿐이다 — 새 표류가 태어나면 여기서 빨개진다", () => {
    const dead = stateExports.filter((name) => consumers(name).length === 0);
    // OfflineState: 오프라인 전용 상태 화면을 채택한 화면이 아직 없다(홈은 SyncStatusBar의
    // offline 톤으로 말한다). 채택이 생기면 이 목록에서 빼고, 반대로 새 이름이 늘면 그
    // export가 죽은 채 태어난 것이다 — 어느 쪽이든 손이 이 대장을 함께 옮긴다.
    expect(dead).toEqual(["OfflineState"]);
  });
});

describe("⑤ 잠깐 안내의 수명 한 벌 — useTransientNotice", () => {
  it("기본 수명은 이미 살아 있던 관례(설정 → 아이 관리 토스트)의 그 값이다 — 새 수명을 짓지 않는다", () => {
    expect(transientNoticeDurationMs()).toBe(3200);
    // 관례의 원본이 실제로 그 값으로 서 있는지 소스에서 다시 읽는다(수를 두 벌로 들지 않는다).
    expect(source("app/settings/children.tsx")).toContain("}, 3200);");
  });

  it("타이머 규율: ref 보관 · 겹침 시 앞 타이머 철거 · 언마운트 정리 · 시계 직접 읽기 없음", () => {
    const hook = source("src/ui/use-transient-notice.ts");
    expect(hook).toContain("timerRef");
    expect(hook).toContain("clearTimeout(timerRef.current)");
    expect(hook).toContain("export function useTransientNotice");
    expect(hook).not.toContain("Date.now");
    expect(hook).not.toContain("new Date(");
  });
});
