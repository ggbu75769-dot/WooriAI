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

/** Every non-test .tsx screen under app/settings/ (the SET-00x surface). */
function listSettingsScreenSources(): string[] {
  return readdirSync(join(mobileRoot, "app/settings"), { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
    .map((entry) => join("app/settings", entry));
}

/**
 * FIX-118B(F4): coral text tokens that fail WCAG AA at the sizes these screens actually use.
 *
 * 값 재검산 (DSN-053 P1, 팔레트가 c20deeb 값으로 롤백됨): 크림 배경(cream.bg #FFFDFC) 위에서
 * coral[500] "#E85F3B"는 3.38:1, coral[600] "#C94627"는 4.72:1, coral[700] "#A93720"는 6.36:1이다.
 * coral[600]은 흰 배경 하나만 놓고 보면 AA를 넘지만, 이 화면들이 실제로 쓰는 **연한 코랄 서피스**
 * (coral[50] "#FFF4EF") 위에서는 4.43:1로 다시 미달한다 -- 그래서 목록에 남겨 둔다. 통과가
 * 보장되는 것은 coral[700]뿐이다. Matches the lowercase `color:` prop only, so brand fills
 * (backgroundColor/borderColor/tintColor/trackColor) are deliberately untouched, which is the
 * same line A11Y-117 drew for the shared kit (ui.tsx smallCoralText vs PrimaryButton's fill).
 */
const lowContrastCoralTextPattern =
  /(?<![A-Za-z])color:\s*theme\.colors\.(?:mainCoral|subCoral|peach|coral\[(?:50|100|200|300|400|500|600)\])/g;

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
    // 라운드 49 QA(P3-3): 선택 상태에 더해 **비활성**도 알린다 — 지금은 적용되지 않는 칩
    // (찜 목록에서의 "출산 전")을 눈으로만 흐리게 두면 스크린 리더 사용자는 그대로 누른다.
    expect(chipBlock).toContain(
      "selected === undefined ? (disabled ? { disabled: true } : undefined) : { selected, disabled: Boolean(disabled) }"
    );
    expect(chipBlock).toContain("disabled={disabled}");

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
    // FIX-118A(m-11): 배지/라벨 모두 현재 아이 기준 counts를 쓴다(전역 counts는 다른 아이 대기
    // 건수까지 합산해 목록과 어긋났다).
    // REC-123(H4): 문구 자체는 src/offline/messages.ts가 단일 소스이고(동기화 상태 화면과 공유),
    // "대기 N건"/"실패 N건"/"충돌 N건"이라는 결과 문자열은 src/offline/messages.test.ts가 핀한다.
    // 여기서는 이 화면이 그 헬퍼로 세 카운트를 모두 읽어준다는 사실만 계약으로 고정한다.
    expect(recordsSource).toContain("accessibilityLabel={syncStatusChipAccessibilityLabel(childSyncCounts)}");
    expect(recordsSource).toContain("function syncStatusChipAccessibilityLabel");
    expect(recordsSource).toContain('syncStatusCountLabel("pending", waiting)');
    expect(recordsSource).toContain('syncStatusCountLabel("failed", counts.failed)');
    expect(recordsSource).toContain('syncStatusCountLabel("conflict", counts.conflict)');
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

    // MOB-121: src/ui/EmptyState.tsx was removed (dead D0 component) — its CTA-role assertion
    // went with it; screens use src/ui.tsx's EmptyStateCard, covered above via uiSource.
    // CLN-130: src/ui/ListRow.tsx followed for the same reason — the pressable-row button role
    // that mattered is src/ui.tsx's ListRow, asserted above via uiSource.
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

  it("announces the expense date input error (포커스가 입력란에 남아 있어 자동 낭독이 필요하다)", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    const errorBlock = newExpenseSource.slice(
      newExpenseSource.indexOf("{dateInputError ? ("),
      newExpenseSource.indexOf("{dateInputError}")
    );
    expect(errorBlock).toContain('accessibilityRole="alert"');
    expect(errorBlock).toContain('accessibilityLiveRegion="polite"');
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

  it("hides decorative glyphs (♡, ›, ▣) from the accessibility tree", () => {
    // D1 후속(실기기 피드백 2): 추천 헤더의 찜 하트(♡)도 Ionicons로 바뀌었지만 "장식이라
    // 접근성 트리에서 감춘다"는 계약은 그대로다(색·크기도 같은 값을 그대로 쓴다).
    expect(source("app/(tabs)/items.tsx")).toContain(
      '<Ionicons accessible={false} name="heart-outline" size={18} color={theme.colors.brown} />'
    );
    expect(source("app/(tabs)/more.tsx")).toContain("<Text accessible={false} style={moreMenuChevronStyle}>›</Text>");
    expect(source("app/family/index.tsx")).toContain("<Text accessible={false} style={familyInviteChevronStyle}>›</Text>");
    // D1 후속(실기기 피드백 2): 파일 카드의 ▣도 Ionicons로 바뀌었지만 "장식이라 접근성
    // 트리에서 감춘다"는 계약은 그대로다(색·크기는 같은 스타일 토큰에서 읽어 쓴다).
    expect(source("app/import/index.tsx")).toContain('accessible={false}\n              name="document-text-outline"');
    expect(source("app/import/index.tsx")).toContain("size={styles.fileIconText.fontSize}");
    // CLN-130: the ⌁ mark belonged to src/ui.tsx's BrandLogo, a dead export removed along with
    // its assertion — no screen rendered it.
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
    // CLN-130: 슬라이스 끝 경계였던 InputField/BrandLogo가 죽은 export라 제거됐다 --
    // 각각 바로 뒤에 오는 SegmentedControl/Card로 경계를 옮긴다(구간 내용은 그대로).
    const textButtonBlock = uiSource.slice(uiSource.indexOf("export function TextButton"), uiSource.indexOf("export function SegmentedControl"));
    expect(textButtonBlock).toContain("smallCoralText");
    const eyebrowBlock = uiSource.slice(uiSource.indexOf("export function ScreenHeader"), uiSource.indexOf("export function Card"));
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

  // FIX-118B(F4): the 아이 관리 편집 링크 shipped as mainCoral 13px (3.16:1) -- A11Y-117's own
  // rule, broken on a screen the original sweep never looked at. The sweep now covers the whole
  // app/settings/** surface so the next settings screen cannot regress the same way.
  it("keeps every app/settings/** screen's coral TEXT on coral[700] (small-coral-text sweep)", () => {
    const settingsScreens = listSettingsScreenSources();
    // Guard the guard: a wrong path/glob would make this test vacuously green.
    expect(settingsScreens).toContain("app/settings/children.tsx");
    expect(settingsScreens.length).toBeGreaterThanOrEqual(4);

    const offenders = settingsScreens.flatMap((screen) =>
      (source(screen).match(lowContrastCoralTextPattern) ?? []).map((match) => `${screen}: ${match}`)
    );
    expect(offenders, "small coral text must use theme.colors.coral[700] (A11Y-117)").toEqual([]);

    // The two screens the sweep actually moved (편집 링크 / 삭제 예고 안내).
    expect(source("app/settings/children.tsx")).toContain("color: theme.colors.coral[700]");
    expect(source("app/settings/privacy.tsx")).toContain("color: theme.colors.coral[700]");
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
    // DSN-053 P2-C: 기록 탭의 화살표가 텍스트 글리프(‹ ›)에서 chevron 아이콘으로 바뀌면서 흐림도
    // **색 교체에서 opacity로** 옮겼다 -- 리포트 탭(reportReferencePeriodArrowDisabledStyle)과
    // 승인 원본이 이미 쓰던 방식이고, 색을 gray300으로 떨어뜨리는 쪽은 아이콘이 거의 사라진다.
    // 계약의 뜻(비활성 화살표는 눈에도 흐리게 보인다)은 그대로다.
    expect(source("app/(tabs)/records.tsx")).toContain("opacity: canGoNextMonth ? 1 : 0.35");
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
    expect(chartBlock).toContain("`${title} 추이 차트, 합계 ${value}${hasRealDelta ? `, 지난 달 대비 ${deltaText}` : \"\"}`");
    expect(chartBlock).toContain('typeof deltaLabel === "string"');
    // 라운드 52 QA P2-3: 선을 그리지 않는 빈 상태에서는 "추이 차트"라고 읽히지 않는다 --
    // 그 자리에 실제로 쓰인 문장을 그대로 읽어, 보이는 것과 읽히는 것이 갈리지 않게 한다.
    expect(chartBlock).toContain("`${title} 합계 ${value}, ${noticeText}`");
    // Fake "+12.5%" preview delta stays visible but hidden from the a11y tree.
    expect(chartBlock).toContain("accessibilityElementsHidden={hasRealDelta ? undefined : true}");
    // R20-A: the share bar (real data) and the preview donut arc are both decorative -- the
    // legend rows carry name/amount/percent as text, and each row is announced as one element.
    const donutBlock = uiSource.slice(uiSource.indexOf("export function DonutChartCard"));
    expect(donutBlock).toContain("accessibilityElementsHidden");
    expect(donutBlock).toContain("accessibilityLabel={`${slice.label}, ${slice.percentLabel}, ${formatKrw(slice.amountKrw)}`}");
  });

  it("confirms 알림 모두 지우기 with an Alert before clearing (destructive-action convention)", () => {
    const notificationsSource = source("app/notifications.tsx");
    expect(notificationsSource).toContain("Alert.alert(\"알림을 모두 지울까요?\"");
    expect(notificationsSource).toContain('{ text: "취소", style: "cancel" }');
    expect(notificationsSource).toContain('style: "destructive"');
    expect(notificationsSource).toContain("onPress={confirmClearAll}");
  });
});
