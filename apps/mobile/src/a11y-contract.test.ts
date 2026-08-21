import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** Every non-test .tsx source under app/ and src/ (the TalkBack-reachable component surface). */
function listComponentSources(): string[] {
  return ["app", "src"].flatMap((root) =>
    readdirSync(join(mobileRoot, root), { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
      .map((entry) => join(root, entry))
  );
}

/**
 * A11Y-101 접근성 소스 계약 (source verification -- follows the export-flow.test.ts /
 * notification-flow.test.ts source-grep convention; screens aren't runtime-rendered because
 * react-native has no native binding under vitest).
 *
 * Every TalkBack-reachable interactive element must carry a meaningful Korean
 * accessibilityLabel (when the visible text is absent or insufficient -- icon-only buttons
 * especially) and a correct accessibilityRole; chips/toggles additionally expose their
 * state via accessibilityState.
 *
 * The bottom tab bar is intentionally NOT asserted here: expo-router's
 * @react-navigation/bottom-tabs already renders each tab with role "tab" (Android),
 * aria-selected, and the Korean title text as the announced label -- see
 * BottomTabBar.js/BottomTabItem.js in @react-navigation/bottom-tabs@7.x.
 */
describe("A11Y-101 accessibility source contract", () => {
  it("labels the home notification bell with role button and an unread-count label", () => {
    const bellSource = source("src/notifications/NotificationBell.tsx");
    expect(bellSource).toContain('accessibilityRole="button"');
    expect(bellSource).toContain('accessibilityLabel={unreadCount > 0 ? `알림, 새 알림 ${unreadCount}개` : "알림"}');
  });

  it("gives the floating action button a button role and the 지출 기록하기 label", () => {
    const uiSource = source("src/ui.tsx");
    const fabBlock = uiSource.slice(uiSource.indexOf("export function FloatingActionButton"));
    expect(fabBlock).toContain('accessibilityLabel = "지출 기록하기"');
    expect(fabBlock).toContain('accessibilityRole="button"');
  });

  it("exposes button roles on every shared pressable primitive (Primary/Secondary/TextButton)", () => {
    const uiSource = source("src/ui.tsx");
    for (const component of ["export function PrimaryButton", "export function SecondaryButton", "export function TextButton"]) {
      const componentBlock = uiSource.slice(uiSource.indexOf(component), uiSource.indexOf(component) + 600);
      expect(componentBlock, `${component} should carry accessibilityRole="button"`).toContain('accessibilityRole="button"');
    }
    // Label threading for callers whose visible text alone is not descriptive (e.g. 구매).
    expect(uiSource).toContain("accessibilityLabel?: string");
    expect(uiSource).toContain("accessibilityLabel={`${seller}에서 구매하기`}");
  });

  it("announces selection state on chips and segmented controls", () => {
    const uiSource = source("src/ui.tsx");
    const chipBlock = uiSource.slice(uiSource.indexOf("export function CategoryChip"));
    expect(chipBlock).toContain('accessibilityRole="button"');
    expect(chipBlock).toContain("accessibilityState={selected === undefined ? undefined : { selected }}");

    const segmentedBlock = uiSource.slice(
      uiSource.indexOf("export function SegmentedControl"),
      uiSource.indexOf("export function CategoryChip")
    );
    expect(segmentedBlock).toContain('accessibilityRole="tab"');
    expect(segmentedBlock).toContain("accessibilityState={{ selected: option === value }}");
  });

  it("keeps the 찜 and 공유 buttons on the item detail screen labeled", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    // 공유: icon-only chrome button -- explicit Korean label + role.
    expect(detailSource).toContain('accessibilityLabel="공유하기"');
    expect(detailSource).toContain('accessibilityLabel="뒤로가기"');
    // 찜하기/찜해제: rendered through SecondaryButton, whose visible Korean label is the
    // announced text and which carries accessibilityRole="button" (asserted above).
    expect(detailSource).toContain('label={isInterested ? "찜해제" : "찜하기"}');
    expect(detailSource).toContain("<SecondaryButton");
  });

  it("marks the login consent rows as checkboxes with checked state and badge-qualified labels", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain('accessibilityRole="checkbox"');
    expect(loginSource).toContain("accessibilityState={{ checked }}");
    expect(loginSource).toContain("accessibilityLabel={`${label}, ${badge}`}");
  });

  it("marks the 선물로 받았어요 toggles as checkboxes with checked state on both expense screens", () => {
    for (const screen of ["app/expenses/new.tsx", "app/expenses/[expenseId].tsx"]) {
      const screenSource = source(screen);
      expect(screenSource, `${screen} gift toggle`).toContain('accessibilityLabel="선물로 받았어요"');
      expect(screenSource, `${screen} gift toggle`).toContain('accessibilityRole="checkbox"');
      expect(screenSource, `${screen} gift toggle`).toContain("accessibilityState={{ checked: isGift }}");
    }
  });

  it("labels the quick-expense category tiles and close control", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    expect(newExpenseSource).toContain("accessibilityLabel={category.label}");
    expect(newExpenseSource).toContain("accessibilityState={{ selected }}");
    expect(newExpenseSource).toContain('accessibilityLabel="닫기"');
    expect(newExpenseSource).toContain('accessibilityLabel="지출 금액 입력"');
  });

  it("announces sync status chips as a labeled button on the records screen", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    // A11Y-115: the chip row's label carries the actual counts (대기/실패/충돌 N건), matching
    // what the visible StatusBadge chips show -- not just a bare "동기화 상태 보기".
    expect(recordsSource).toContain("accessibilityLabel={syncStatusChipAccessibilityLabel(syncSnapshot.counts)}");
    expect(recordsSource).toContain("function syncStatusChipAccessibilityLabel");
    expect(recordsSource).toContain("`대기 ${waiting}건`");
    expect(recordsSource).toContain("`실패 ${counts.failed}건`");
    expect(recordsSource).toContain("`충돌 ${counts.conflict}건`");
    expect(recordsSource).toContain('accessibilityLabel="이전 달"');
    expect(recordsSource).toContain('accessibilityLabel="다음 달"');
  });

  it("labels the icon-only family controls (초대 +, invite rows) and menu rows on 더보기", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain('accessibilityLabel="가족 초대하기"');
    expect(familySource).toContain("accessibilityLabel={value ? `${title}, ${value}` : title}");

    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("accessibilityLabel={caption ? `${title}, ${caption}` : title}");
    expect(moreSource).toContain("accessibilityLabel={`${visibleProfile.nickname} 프로필 관리`}");
  });

  it("keeps the excel import rows announced as checkboxes with checked/disabled state", () => {
    const importPreviewSource = source("app/import/[importJobId].tsx");
    expect(importPreviewSource).toContain('accessibilityRole="checkbox"');
    expect(importPreviewSource).toContain("accessibilityState={{ checked: row.selected, disabled }}");
  });

  it("gives pressable list rows, product cards and quick actions button roles in the shared kit", () => {
    const uiSource = source("src/ui.tsx");
    expect(uiSource).toContain('accessibilityRole={onPress ? "button" : undefined}');
    const quickActionBlock = uiSource.slice(uiSource.indexOf("export function QuickActionIconButton"));
    expect(quickActionBlock).toContain("accessibilityLabel={label}");

    const d0ListRowSource = source("src/ui/ListRow.tsx");
    expect(d0ListRowSource).toContain('accessibilityRole="button"');
    // MOB-121: src/ui/EmptyState.tsx was removed (dead D0 component) — its CTA-role assertion
    // went with it; screens use src/ui.tsx's EmptyStateCard, covered above via uiSource.
  });
});

/**
 * A11Y-115 low-risk sweep contract: internal screen IDs never reach TalkBack, dynamic
 * feedback announces itself, and form fields carry Korean labels.
 */
describe("A11Y-115 accessibility sweep contract", () => {
  it("never exposes internal screen IDs through accessibilityLabel anywhere in the app", () => {
    // Screen/pixel-lock IDs belong on testID (tooling-only); putting them in accessibilityLabel
    // makes TalkBack read strings like "pixel-screen-HOME-001" out loud to users.
    const literalScreenIdLabel = /accessibilityLabel=\{?\s*["'`](?:pixel-)?screen-/;
    const screenIdVariableLabel = /accessibilityLabel=\{[A-Za-z0-9_]*[Ss]creenId\}/;

    const files = listComponentSources();
    expect(files.length).toBeGreaterThan(20);
    for (const relativePath of files) {
      const componentSource = source(relativePath);
      expect(componentSource, `${relativePath} must not announce a literal screen ID`).not.toMatch(literalScreenIdLabel);
      expect(componentSource, `${relativePath} must not announce a *ScreenId variable`).not.toMatch(screenIdVariableLabel);
    }
  });

  it("announces every Toast via a polite live region and announceForA11y", () => {
    const uiSource = source("src/ui.tsx");
    expect(uiSource).toContain("export function announceForA11y");
    expect(uiSource).toContain("AccessibilityInfo.announceForAccessibility?.(message)");
    const toastBlock = uiSource.slice(uiSource.indexOf("export function Toast"));
    expect(toastBlock).toContain('accessibilityLiveRegion="polite"');
    expect(toastBlock).toContain("announceForA11y(message)");
  });

  it("keeps the home budget warning banner a polite live region", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain('accessibilityRole="alert"');
    expect(homeSource).toContain('accessibilityLiveRegion="polite"');
  });

  it("announces the login error card", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain("announceForA11y(loginError)");
    expect(loginSource).toContain('accessibilityRole="alert"');
    expect(loginSource).toContain('accessibilityLiveRegion="polite"');
  });

  it("labels skeleton loading containers for screen readers", () => {
    const skeletonSource = source("src/ui/Skeleton.tsx");
    const labelCount = skeletonSource.split('accessibilityLabel="불러오는 중"').length - 1;
    expect(labelCount).toBeGreaterThanOrEqual(2); // SkeletonRow + SkeletonCard
  });

  it("announces the purchase follow-up prompt when it appears", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain("announceForA11y(`『${activeFollowup.itemName}』 구매하셨나요?`)");
  });

  it("includes the item name in the 준비했어요/괜찮아요 button labels on the items tab", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain("accessibilityLabel={`${item.name} 준비했어요`}");
    expect(itemsSource).toContain("accessibilityLabel={`${item.name} 괜찮아요`}");
  });

  it("labels the free-text expense form fields with Korean labels and a done return key", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    expect(newExpenseSource).toContain('accessibilityLabel="메모 입력 (선택)"');
    expect(newExpenseSource).toContain('accessibilityLabel="품목명 입력"');

    const editExpenseSource = source("app/expenses/[expenseId].tsx");
    expect(editExpenseSource).toContain('accessibilityLabel="품목 입력"');
    expect(editExpenseSource).toContain('accessibilityLabel="지출 금액 입력"');
    expect(editExpenseSource).toContain('accessibilityLabel="메모 입력 (선택)"');

    const childProfileSource = source("app/(onboarding)/child-profile.tsx");
    expect(childProfileSource).toContain('accessibilityLabel="태명 또는 별명 입력"');
    expect(childProfileSource).toContain("accessibilityLabel={`${dateLabel} 입력`}");

    const onboardingBudgetSource = source("app/(onboarding)/budget.tsx");
    expect(onboardingBudgetSource).toContain('accessibilityLabel="월 예산 입력"');

    for (const [path, sourceText] of [
      ["app/expenses/new.tsx", newExpenseSource],
      ["app/expenses/[expenseId].tsx", editExpenseSource],
      ["app/(onboarding)/child-profile.tsx", childProfileSource],
      ["app/(onboarding)/budget.tsx", onboardingBudgetSource]
    ] as const) {
      expect(sourceText, `${path} should set returnKeyType="done"`).toContain('returnKeyType="done"');
    }
  });

  it("uses a search return key on the records search field", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain('returnKeyType="search"');
  });

  it("hides decorative glyphs (♡, ›, ▣, ⌁) from the accessibility tree", () => {
    expect(source("app/(tabs)/items.tsx")).toContain(
      '<Text accessible={false} style={{ color: theme.colors.brown, fontSize: 18 }}>♡</Text>'
    );
    expect(source("app/(tabs)/more.tsx")).toContain("<Text accessible={false} style={moreMenuChevronStyle}>›</Text>");
    expect(source("app/family/index.tsx")).toContain("<Text accessible={false} style={familyInviteChevronStyle}>›</Text>");
    expect(source("app/import/index.tsx")).toContain("<Text accessible={false} style={styles.fileIconText}>▣</Text>");
    const brandLogoBlock = source("src/ui.tsx").slice(source("src/ui.tsx").indexOf("export function BrandLogo"));
    expect(brandLogoBlock.slice(0, 600)).toContain("accessible={false}");
  });
});

/**
 * A11Y-117 접근성 2차 + 소소 UX 계약: 소형 coral 텍스트 대비(coral[700]), 기간 이동
 * announce + 미래 상한, 장식 프리뷰/차트 지오메트리 은닉, launch reduce-motion, 알림 모두
 * 지우기 확인. (동일한 source-grep 관례.)
 */
describe("A11Y-117 accessibility round-2 contract", () => {
  it("uses coral[700] for small coral text in the shared kit (TextButton/eyebrow/price/delta) and keeps brand fills untouched", () => {
    const uiSource = source("src/ui.tsx");
    // Shared contrast token + the documented hold on white-on-coral brand surfaces.
    expect(uiSource).toContain("const smallCoralText = theme.colors.coral[700]");
    const textButtonBlock = uiSource.slice(uiSource.indexOf("export function TextButton"), uiSource.indexOf("export function InputField"));
    expect(textButtonBlock).toContain("smallCoralText");
    const eyebrowBlock = uiSource.slice(uiSource.indexOf("export function ScreenHeader"), uiSource.indexOf("export function BrandLogo"));
    expect(eyebrowBlock).toContain("smallCoralText");
    const productCardBlock = uiSource.slice(uiSource.indexOf("export function ProductCard"), uiSource.indexOf("export function ProductComparisonRow"));
    expect(productCardBlock).toContain("smallCoralText");
    // PrimaryButton/HeroSummaryCard keep the coral[500] brand fill (design decision on hold).
    const primaryButtonBlock = uiSource.slice(uiSource.indexOf("export function PrimaryButton"), uiSource.indexOf("export function SecondaryButton"));
    expect(primaryButtonBlock).toContain("theme.colors.mainCoral");
    const heroBlock = uiSource.slice(uiSource.indexOf("export function HeroSummaryCard"), uiSource.indexOf("export function QuickActionIconButton"));
    expect(heroBlock).toContain("theme.colors.mainCoral");
  });

  it("renders the StatusBadge warning tone with the StageBadge recipe (coral[700] on coral[50]) for DNC-011 disclosures", () => {
    const uiSource = source("src/ui.tsx");
    const badgeBlock = uiSource.slice(uiSource.indexOf("export function StatusBadge"), uiSource.indexOf("export function BudgetProgressBar"));
    expect(badgeBlock).toContain("theme.colors.coral[50]");
    expect(badgeBlock).toContain("theme.colors.coral[700]");
  });

  it("moves small coral screen text (충돌 배너, 직접 입력 toggles) onto coral[700]", () => {
    const syncSource = source("app/sync-status.tsx");
    expect(syncSource).toContain("theme.colors.coral[700]");
    expect(syncSource).not.toContain("color: theme.colors.mainCoral, fontSize: 12");
    for (const screen of ["app/expenses/new.tsx", "app/expenses/[expenseId].tsx"]) {
      const screenSource = source(screen);
      expect(screenSource, `${screen} 직접 입력 toggle`).toContain('color: theme.colors.coral[700], fontSize: 12');
    }
  });

  it("announces the new period label and caps forward navigation at the current period on records/reports", () => {
    for (const screen of ["app/(tabs)/records.tsx", "app/(tabs)/reports.tsx"]) {
      const screenSource = source(screen);
      expect(screenSource, `${screen} should reuse the pure period module`).toContain('from "../../src/period-navigation"');
      expect(screenSource, `${screen} should announce the new period`).toContain("announceForA11y(periodLabelForOffset(");
      expect(screenSource, `${screen} should expose the disabled state`).toContain("accessibilityState={{ disabled:");
      expect(screenSource, `${screen} should disable the next arrow`).toContain("canGoToNextPeriod(monthOffset)");
    }
    // Visual dim on the disabled next arrow.
    expect(source("app/(tabs)/records.tsx")).toContain("canGoNextMonth ? theme.colors.gray900 : theme.colors.gray300");
    expect(source("app/(tabs)/reports.tsx")).toContain("reportReferencePeriodArrowDisabledStyle");
  });

  it("hides the decorative import preview from TalkBack and shows the 검수 안내 as visible text", () => {
    const importSource = source("app/import/index.tsx");
    expect(importSource).toContain('importantForAccessibility="no-hide-descendants"');
    expect(importSource).toContain("accessibilityElementsHidden");
    // The notice is a visible Text now, not an accessibilityLabel-only string.
    expect(importSource).toContain(">검수 후 승인하기 전까지는 지출로 저장되지 않아요.</Text>");
    expect(importSource).not.toContain('accessibilityLabel="검수 후 승인하기 전까지는 지출로 저장되지 않아요."');
  });

  it("skips the launch growth animation under reduce-motion and always offers 건너뛰기", () => {
    const launchSource = source("app/launch-animation.tsx");
    expect(launchSource).toContain("AccessibilityInfo.isReduceMotionEnabled");
    expect(launchSource).toContain("setStageIndex(animationStages.length - 1)");
    expect(launchSource).toContain("isPixelLockMode || reduceMotionEnabled");
    // 건너뛰기 is no longer gated behind stageIndex >= 0 (visible during the intro hold too).
    expect(launchSource).toContain('{!isFinalStage ? <TextButton label="건너뛰기"');
  });

  it("summarizes the line chart geometry with one label and keeps the preview-only delta out of it", () => {
    const uiSource = source("src/ui.tsx");
    const chartBlock = uiSource.slice(uiSource.indexOf("export function LineChartCard"), uiSource.indexOf("export function DonutChartCard"));
    expect(chartBlock).toContain("accessibilityLabel={`${title} 추이 차트, 합계 ${value}${hasRealDelta ? `, 지난 달 대비 ${deltaText}` : \"\"}`}");
    expect(chartBlock).toContain('typeof deltaLabel === "string"');
    // Fake "+12.5%" preview delta stays visible but hidden from the a11y tree.
    expect(chartBlock).toContain("accessibilityElementsHidden={hasRealDelta ? undefined : true}");
    // Donut arc is decorative (legend carries the data as text).
    const donutBlock = uiSource.slice(uiSource.indexOf("export function DonutChartCard"));
    expect(donutBlock).toContain("accessibilityElementsHidden");
  });

  it("confirms 알림 모두 지우기 with an Alert before clearing (destructive-action convention)", () => {
    const notificationsSource = source("app/notifications.tsx");
    expect(notificationsSource).toContain("Alert.alert(\"알림을 모두 지울까요?\"");
    expect(notificationsSource).toContain('{ text: "취소", style: "cancel" }');
    expect(notificationsSource).toContain('style: "destructive"');
    expect(notificationsSource).toContain("onPress={confirmClearAll}");
  });
});
