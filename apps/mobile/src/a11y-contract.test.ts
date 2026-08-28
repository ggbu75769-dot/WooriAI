import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// GAP-062 #10: 가구 전환 Alert의 **버튼 라벨**은 순수 모듈이 만든다 -- 화면 파일이 아니라 그
// 산출을 붙든다(Alert 버튼에는 accessibilityLabel/State를 걸 수 없어, 낭독되는 것은 버튼 글자뿐이다).
import {
  childScopeDeleteConfirmTitle,
  childScopeDeleteNotice,
  HOUSEHOLD_SCOPE_ADD_CHILD_LABEL,
  HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE,
  HOUSEHOLD_SCOPE_SWITCH_CLOSE_LABEL,
  HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE,
  householdSwitchPrompt,
  type HouseholdSwitchOption
} from "./family/household-scope";
// GAP-063 #10: 달력 칸의 "왜 못 누르는가"도 순수 모듈이 정한다 -- 화면은 그 답을 그리기만 한다.
import {
  buildCalendarMonth,
  calendarCellAccessibilityLabel,
  CALENDAR_FUTURE_HINT,
  CALENDAR_LEGEND_TEXT,
  resolveCalendarCellAction,
  type CalendarCell
} from "./expenses/records-calendar";
// GAP-064 #1: 화면에서 가장 강한 버튼이 **광고를 열지 않는다**는 판정도 순수 모듈의 것이다 --
// 화면은 그 답(채움을 받을 링크)을 그리기만 한다(라운드 64 트랙 A가 값 계약을 link-marker.test.ts에
// 고정했고, 여기서는 그 판정이 **낭독되는 버튼**에 실제로 걸려 있는가를 본다).
import {
  primaryPurchaseLinkIndex,
  productLinkMarker,
  SPONSORED_MARKER_CAPTION,
  SPONSORED_MARKER_LABEL
} from "./items/link-marker";
// GAP-064 #6: 최소 터치 타깃의 단일 소스. 이 숫자를 테스트에 다시 박지 않는다.
import { theme } from "./theme";

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
    // **색 교체에서 opacity로** 옮겼다. 리포트 탭도 같은 방식으로 맞췄다 -- 색을 gray300으로
    // 떨어뜨리는 쪽은 크림 배경 위에서 아이콘이 거의 사라져 "없는 버튼"으로 읽혔다.
    // 계약의 뜻(비활성 화살표는 눈에도 흐리게 보인다)은 그대로다.
    expect(source("app/(tabs)/records.tsx")).toContain("opacity: canGoNextMonth ? 1 : 0.35");
    const reportsSource = source("app/(tabs)/reports.tsx");
    expect(reportsSource).toContain("const reportReferencePeriodArrowDisabledOpacity = 0.35;");
    expect(reportsSource).toContain("{ opacity: isDisabled ? reportReferencePeriodArrowDisabledOpacity : 1 }");
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

/**
 * GAP-061 #8 — 접근성 체크리스트 A-2에서 **스윕 밖**으로 남아 있던 두 줄을 여기로 들인다
 * (docs/qa/accessibility-offline-checklist.md A-2 #4 정기 지출 · #10 달력 날짜 픽커).
 *
 * 왜 옮겼나 — 두 화면은 라벨·역할·상태가 이미 소스에 배선돼 있었는데도 "스윕 밖"이라는 이유로
 * C절(사람이 기기에서 확인)에 한 번 더 적혀 있었다. 그 표기는 두 가지를 동시에 망가뜨린다:
 * ① 릴리즈마다 사람이 코드가 이미 붙들고 있는 것을 다시 보게 만들고, ② 정작 회귀가 나면
 * (라벨을 지우거나 role을 빼면) **아무 테스트도 빨개지지 않는다**. C절의 값은 "코드로는 증명할
 * 수 없는 것만 남아 있다"는 데서 나오므로, 증명할 수 있는 절반은 여기로 내린다.
 *
 * 여기서 고정하는 것은 **존재**다(라벨·role·state). 낭독 **순서**와 제스처 충돌은 여전히 기기
 * 문제라 C-5·C-6에 남는다 — 그 두 줄은 이제 "라벨이 있는가"가 아니라 순서·제스처만 말한다.
 */
describe("GAP-061 #8 정기 지출 · 달력 픽커 접근성 스윕", () => {
  it("정기 지출 입력 4종에 한국어 라벨이 붙어 있다", () => {
    const recurringSource = source("app/expenses/recurring.tsx");
    for (const label of [
      'accessibilityLabel="정기 지출 품목명 입력"',
      'accessibilityLabel="정기 지출 금액 입력"',
      'accessibilityLabel="정기 지출 결제일 입력 (1일부터 31일)"',
      'accessibilityLabel="정기 지출 판매처 입력 (선택)"'
    ]) {
      expect(recurringSource, `정기 지출 입력 라벨 누락: ${label}`).toContain(label);
    }
  });

  it("정기 지출 알림 토글이 switch 역할 + checked 상태로 낭독된다", () => {
    const recurringSource = source("app/expenses/recurring.tsx");
    expect(recurringSource).toContain('accessibilityLabel={`${template.itemName} 정기 지출 알림`}');
    expect(recurringSource).toContain('accessibilityRole="switch"');
    expect(recurringSource).toContain("accessibilityState={{ checked: template.active }}");
  });

  it("정기 지출 행 액션 셋이 모두 품목명을 라벨에 싣는다 (목록에서 어느 행인지 소리로 구분된다)", () => {
    const recurringSource = source("app/expenses/recurring.tsx");
    // 기록: 문구는 순수 모듈이 단일 소스로 만든다(품목명·금액이 들어간다 —
    // src/expenses/recurring-template.ts의 recurringRecordAccessibilityLabel, 결과 문자열은
    // recurring-template.test.ts가 핀한다). 여기서는 화면이 그 헬퍼를 지난다는 사실만 고정한다.
    expect(recurringSource).toContain("accessibilityLabel={recurringRecordAccessibilityLabel(template)}");
    expect(source("src/expenses/recurring-template.ts")).toContain("export function recurringRecordAccessibilityLabel");
    expect(recurringSource).toContain('accessibilityLabel={`${template.itemName} 정기 지출 수정`}');
    expect(recurringSource).toContain('accessibilityLabel={`${template.itemName} 정기 지출 삭제`}');
  });

  it("정기 지출 저장 실패 문구가 live region으로 자동 낭독된다", () => {
    const recurringSource = source("app/expenses/recurring.tsx");
    const errorBlock = recurringSource.slice(recurringSource.indexOf("{saveError ? ("), recurringSource.indexOf("{saveError}"));
    expect(errorBlock).toContain('accessibilityLiveRegion="polite"');
    expect(errorBlock).toContain('accessibilityRole="alert"');
  });

  it("달력 날짜 셀이 button 역할 + selected 상태 + 사람이 읽는 날짜 라벨을 갖는다", () => {
    const pickerSource = source("src/expenses/ExpenseDatePicker.tsx");
    expect(pickerSource).toContain("expenseDatePickerCellAccessibilityLabel(cell, { selectedIso, todayIso })");
    expect(pickerSource).toContain('accessibilityRole="button"');
    expect(pickerSource).toContain("accessibilityState={{ selected }}");
    // 라벨 문구(오늘/선택됨/날짜)는 순수 모듈이 만들고 date-picker-month.test.ts가 핀한다.
    expect(source("src/expenses/date-picker-month.ts")).toContain("export function expenseDatePickerCellAccessibilityLabel");
  });

  it("고를 수 없는 날은 **왜** 못 고르는지를 라벨에 싣는다 (누를 수 없는 요소로 남는다)", () => {
    // 가져오기 검수의 잠긴 행과 같은 관례다 — 비활성 요소를 조용히 지나가게 두지 않고 이유를
    // 낭독한다. 셀 자체는 Pressable이 아니므로 button 역할·disabled 상태를 흉내 내지 않는다.
    const pickerSource = source("src/expenses/ExpenseDatePicker.tsx");
    expect(pickerSource).toContain("<View accessible accessibilityLabel={accessibilityLabel} key={cell.key} style={cellStyle}>");
    const monthSource = source("src/expenses/date-picker-month.ts");
    expect(monthSource).toContain('export const EXPENSE_DATE_PICKER_FUTURE_HINT = "아직 오지 않은 날이라 고를 수 없어요"');
    expect(monthSource).toContain("parts.push(EXPENSE_DATE_PICKER_FUTURE_HINT)");
  });

  it("달력 월 이동 화살표가 라벨 + disabled 상태를 알리고, 요일 머리글은 트리에서 감춘다", () => {
    const pickerSource = source("src/expenses/ExpenseDatePicker.tsx");
    expect(pickerSource).toContain('accessibilityLabel="이전 달"');
    expect(pickerSource).toContain('accessibilityLabel="다음 달"');
    expect(pickerSource).toContain(
      "accessibilityState={{ disabled: !canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso) }}"
    );
    expect(pickerSource).toContain(
      "accessibilityState={{ disabled: !canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso) }}"
    );
    // 요일 머리글(일~토)은 칸 라벨이 이미 완전한 날짜를 읽어 주므로 소음이다.
    expect(pickerSource).toContain("accessibilityElementsHidden");
    expect(pickerSource).toContain('importantForAccessibility="no-hide-descendants"');
  });
});

/**
 * GAP-059 #3 — 잠금 오버레이의 **접근성 투과** 봉합 (docs/5차/round59-scout.md 트랙 C).
 *
 * 오버레이는 `<Stack>`·구매 확인 카드와 형제라 z-order로만 위에 온다. 접근성 트리는 z-order로
 * 잘리지 않으므로, 화면이 덮여 있는 동안에도 TalkBack은 뒤에 남은 금액·품목명을 읽었다 —
 * 눈으로는 막혔는데 귀로는 열려 있는 상태. 여기서 고정하는 계약은 둘이다.
 *
 * ① **잠금 중에는 뒤 트리가 접근성 트리에서 사라진다**(Android `no-hide-descendants` +
 *    iOS `accessibilityElementsHidden`).
 * ② **비잠금에서는 아무것도 달라지지 않는다** — 잠금을 켜지 않은 사용자에게는 방패 노드가
 *    생기지도 않고(수용 기준 2), 픽셀락 빌드에서는 존재할 수 없다(수용 기준 6).
 *
 * (다른 화면들과 같은 source-grep 관례 — vitest에서 react-native를 렌더할 수 없다.)
 * ⚠️ 실기기 TalkBack/VoiceOver 검증은 아직이다. 여기 고정한 것은 코드가 그 두 prop을 잠금
 * 상태에서만 건다는 사실이지, "실제로 읽히지 않더라"는 실측이 아니다.
 */
describe("GAP-059 #3 app lock overlay a11y containment contract", () => {
  it("wraps only the back tree (Stack + 구매 확인 카드) in the shield, leaving the overlay outside it", () => {
    const layout = source("app/_layout.tsx");
    const shieldOpen = layout.indexOf("<AppLockScreenShield>");
    const shieldClose = layout.indexOf("</AppLockScreenShield>");
    const stackIndex = layout.indexOf("<Stack ");
    const followupIndex = layout.indexOf("<PurchaseFollowupLifecycle />");
    const overlayIndex = layout.indexOf("<AppLockOverlay />");

    expect(shieldOpen).toBeGreaterThan(-1);
    expect(shieldClose).toBeGreaterThan(shieldOpen);
    // 감싸는 것은 뒤 트리 둘 뿐이다.
    expect(stackIndex).toBeGreaterThan(shieldOpen);
    expect(stackIndex).toBeLessThan(shieldClose);
    expect(followupIndex).toBeGreaterThan(shieldOpen);
    expect(followupIndex).toBeLessThan(shieldClose);
    // 잠금 화면 자신은 방패 **밖**에 있어야 한다 — 안에 넣으면 자기 자신을 접근성 트리에서 지운다.
    expect(overlayIndex).toBeGreaterThan(shieldClose);
  });

  it("hides the back tree from TalkBack/VoiceOver only while the lock is holding the screen", () => {
    const overlaySource = source("src/security/AppLockOverlay.tsx");
    const shieldBlock = overlaySource.slice(overlaySource.indexOf("export function AppLockScreenShield"));
    // 두 플랫폼 모두 — 한쪽만 걸면 다른 쪽에서 그대로 읽힌다.
    expect(shieldBlock).toContain("accessibilityElementsHidden={blocking}");
    expect(shieldBlock).toContain('importantForAccessibility={blocking ? "no-hide-descendants" : "auto"}');
    // 덮고 있는 동안의 판정은 오버레이와 같은 한 자리에서 온다(판정표가 두 벌이 되지 않게).
    expect(shieldBlock).toContain("useAppLockGate()");
    expect(overlaySource).toContain("function useAppLockGate()");
    // 뷰 평탄화로 네이티브 노드가 사라졌다 생기지 않도록 — prop만 바뀌어야 한다.
    expect(shieldBlock).toContain("collapsable={false}");
  });

  it("adds no node at all for pixel-lock builds and for anyone who has not enabled the lock", () => {
    const overlaySource = source("src/security/AppLockOverlay.tsx");
    const shieldBlock = overlaySource.slice(overlaySource.indexOf("export function AppLockScreenShield"));
    // 방패는 잠금이 켜져 있을 때(또는 recovery)만 서고, 픽셀락 빌드에서는 그 앞에서 끊긴다.
    expect(shieldBlock).toContain('if (!pixelLockMode && (enabled || status === "recovery")) shieldedRef.current = true;');
    // 서지 않았으면 자식을 **그대로** 돌려준다 — 감싸는 노드조차 없다(수용 기준 2·6).
    expect(shieldBlock).toContain("if (!shieldedRef.current) return <>{children}</>;");
    // 픽셀락 판정은 저장소의 단일 소스를 쓴다(자체 env 리터럴을 새로 적지 않는다).
    expect(overlaySource).toContain("isPixelLockBuild()");
  });
});

/**
 * GAP-062 #10 — 라운드 61이 신설한 UI 둘을 접근성 스윕 안으로 들인다
 * (docs/qa/accessibility-offline-checklist.md **A-3** #18·#19 — 번호는 A-2에서 이어 붙지만
 * 표는 라운드 61~62 전용으로 따로 섰다).
 *
 * 두 자리 모두 **소리로만 앱을 쓰는 사람에게 사실이 도달하는가**가 쟁점이라 여기 온다.
 *  - 가구 전환 Alert: RN Alert 버튼에는 `accessibilityLabel`도 `accessibilityState`도 걸 수
 *    없다. 낭독되는 것은 **버튼 글자와 본문뿐**이라, "지금 보고 있는 가구가 어느 것인가"와
 *    "여기서 고를 수 없는 가구가 있다"는 사실은 그 두 문자열에 실려야만 전달된다.
 *  - 동기화 상태 화면의 저장소 상태 줄: 저장소를 열지 못한 상태를 색이나 배지 톤이 아니라
 *    **보이는 문장**으로 말해야 한다(A-1 Numeric alternatives·Error text와 같은 규율).
 *
 * 화면 파일(app/family/index.tsx · app/sync-status.tsx)은 이 트랙의 소유가 아니므로, 판정은
 * 순수 모듈의 **산출**로 붙들고 화면 쪽은 최소 소스 계약만 둔다.
 */
describe("GAP-062 #10 라운드 61 신설 UI 접근성 계약", () => {
  const optionsOf = (count: number, currentIndex = 0): HouseholdSwitchOption[] =>
    Array.from({ length: count }, (_unused, index) => ({
      householdId: `h${index + 1}`,
      label: `가구 ${index + 1}`,
      isCurrent: index === currentIndex
    }));

  it("전환 Alert의 버튼 글자가 후보 전부를 이름으로 말하고, 지금 보는 가구는 그 사실을 달고 나온다", () => {
    const options = optionsOf(2);
    const prompt = householdSwitchPrompt("android", options);
    // 버튼 글자는 라벨 그대로다 -- id·uuid가 아니라 사람이 아는 말이어야 낭독이 성립한다(A11Y-115).
    for (const option of prompt.options) {
      expect(option.label).not.toMatch(/^h\d+$/);
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
    // 화면은 그 라벨에 "(보는 중)"만 덧붙인다 -- Alert 버튼에는 selected 상태를 걸 수 없으므로
    // 현재 가구를 알리는 단서가 이 문자열뿐이고, 그 버튼은 누를 수 있는 척하지 않는다.
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain("(보는 중)");
    expect(familySource).toContain("onPress: option.isCurrent ? undefined :");
  });

  it("버튼 상한에 밀려 못 고르는 후보가 생기면 본문이 그 사실을 말한다 (조용히 잘리지 않는다)", () => {
    const prompt = householdSwitchPrompt("android", optionsOf(4));
    expect(prompt.exceedsButtonLimit).toBe(true);
    // 낭독되는 것은 제목·본문·버튼 글자뿐이다 -- 그래서 사실은 본문에 실린다.
    expect(prompt.message).toContain(HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE);
    // 2가구(=오늘 대부분)에서는 본문이 종전 한 줄 그대로고 닫기 버튼도 그대로 남는다.
    const small = householdSwitchPrompt("android", optionsOf(2));
    expect(small.message).not.toContain(HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE);
    expect(small.showsCloseButton).toBe(true);
    expect(HOUSEHOLD_SCOPE_SWITCH_CLOSE_LABEL.trim().length).toBeGreaterThan(0);
  });

  it("닫기 버튼이 상한에 밀려 사라지면 다이얼로그를 닫을 다른 길이 반드시 열린다", () => {
    // 닫는 길이 없는 다이얼로그는 화면을 되돌릴 수 없게 만든다 -- 스크린리더 사용자에게 특히
    // 그렇다(바깥 탭이 곧 유일한 탈출구가 된다).
    const prompt = householdSwitchPrompt("android", optionsOf(3));
    expect(prompt.showsCloseButton).toBe(false);
    expect(prompt.cancelable).toBe(true);
  });

  it("저장소를 열지 못한 상태를 동기화 상태 화면이 **보이는 문장**으로 말한다", () => {
    const syncSource = source("app/sync-status.tsx");
    // 문구 단일 소스는 src/offline/messages.ts다 -- 화면이 같은 문장을 다시 적으면 두 벌이 된다.
    expect(syncSource).toContain("OFFLINE_STORAGE_UNAVAILABLE_NOTICE");
    expect(syncSource).not.toContain("이 기기의 저장소를 열지 못했어요");
    // 그 문장이 도달하는 자리는 빈 상태 카드의 **제목**이고, 카드 제목은 보이는 Text다
    // (색·배지 톤만으로 상태를 말하지 않는다 — A-1 Error text와 같은 규율).
    const emptyCard = source("src/ui.tsx").slice(source("src/ui.tsx").indexOf("export function EmptyStateCard"));
    expect(emptyCard.slice(0, 600)).toContain(">{title}</Text>");
    expect(emptyCard.slice(0, 600)).toContain("<SecondaryButton label={actionLabel}");
  });
});

/**
 * GAP-062 #6 — 단계 라벨의 표시층 배선(더보기 "프로필" 카드 · 온보딩 이어하기).
 *
 * 라운드 61 #10이 "임신 42주차" 고착을 걷어낸 자리는 셋이었고(홈 헤더·설정 요약·아이 목록),
 * 이 두 화면은 서버 라벨을 그대로 그려 **같은 아이에 대해 앱이 두 문장을 말했다**. 접근성
 * 쪽에서 이 배선이 중요한 이유는 더보기 카드에서 그 라벨이 낭독되는 유일한 단계 표기이기
 * 때문이다(배지는 그림이 아니라 글자지만, 카드의 accessibilityLabel이 따로 조립된다) —
 * **보이는 줄과 낭독되는 줄이 같은 한 값**이어야 한다.
 */
describe("GAP-062 #6 단계 라벨 표시층 배선 (더보기 · 온보딩 이어하기)", () => {
  it("더보기 세션 카드가 보이는 배지와 낭독 문장에 같은 한 값을 쓴다", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain('from "../../src/home/stage-display-label"');
    expect(moreSource).toContain("const sessionStageLabel = resolveStageDisplayLabel({");
    expect(moreSource).toContain("<StageBadge label={sessionStageLabel} />");
    expect(moreSource).toContain(
      "? `${visibleProfile.nickname}네, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`"
    );
    expect(moreSource).toContain(": `${visibleProfile.nickname}네, ${sessionStageLabel}, 프로필 관리`");
  });

  it("판정의 원천은 이미 조회 중인 ['children'] 캐시이고, 화면이 주차를 다시 세지 않는다", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain(
      "const stageSourceChild = home.data ? children.data?.children.find((child) => child.id === childId) : undefined;"
    );
    // 판정은 재사용만 한다 -- 유예 일수·주차 계산이 화면에 복제되면 규칙이 두 벌이 된다.
    expect(moreSource).not.toContain("PREGNANCY_OVERDUE");
    expect(moreSource).not.toContain("isPregnancyWeekLabelStale");
  });

  it("SET-001 비로그인 미리보기 카드는 종전 문자열 그대로다 (픽셀락 기준선 불변)", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain('const previewProfile = { nickname: "다온이", stageLabel: "24개월" };');
    expect(moreSource).toContain("accessibilityLabel={`${visibleProfile.nickname} 프로필 관리`}");
    // 미리보기 카드의 두 줄은 예전 값을 그대로 그린다(세션 렌더에서만 판정을 태운다).
    expect(moreSource).toContain("<Text style={moreChildNameStyle}>{visibleProfile.nickname}</Text>");
    expect(moreSource).toContain("<Text style={moreChildAgeStyle}>{visibleProfile.stageLabel}</Text>");
  });

  it("온보딩 이어하기 카드도 같은 판정을 지나고, 날짜를 모르면 서버 라벨 그대로 둔다", () => {
    const resumeSource = source("app/(onboarding)/resume.tsx");
    expect(resumeSource).toContain('from "../../src/home/stage-display-label"');
    expect(resumeSource).toContain("const resumeStageLabel = resumeChild");
    expect(resumeSource).toContain("? resolveStageDisplayLabel({");
    expect(resumeSource).toContain("{resumeChild.nickname} · {resumeStageLabel}");
    // 진행도 응답에 dueDate가 없어 날짜는 캐시에서 **읽기만** 한다(새 요청 0건).
    expect(resumeSource).toContain('queryClient.getQueryData<{ children: Child[] }>(["children"])');
    expect(resumeSource).not.toContain("useQuery({");
  });
});

/**
 * GAP-063 #10 — 라운드 63이 신설한 UI 넷 + 라운드 62가 스윕 밖에 두고 간 낭독 한 줄
 * (docs/qa/accessibility-offline-checklist.md **A-4** #23~#26 · **A-3** #22).
 *
 * 다섯 자리의 공통점은 **눈으로는 보이지만 귀로는 따로 실어야 도달한다**는 것이다:
 *  - 달력 칸(#23): 이 라운드부터 기록 없는 칸의 대다수가 눌린다. 이유를 적지 않으면
 *    "8월 6일, 지출 없음"(눌린다)과 "8월 30일, 지출 없음"(안 눌린다)이 **똑같이 들린다**.
 *  - 아이 삭제 카드·Alert(#24): RN Alert에서 낭독되는 것은 제목·본문·버튼 글자뿐이라(A-3 #18과
 *    같은 제약) 마지막 확인이 대상을 말하지 않으면 화면을 떠난 뒤에는 알 길이 없다.
 *  - 아이 추가 진입점(#25)·추가 성공 안내(#26): 전자는 **어디로 데려가는지**를 누르기 전에,
 *    후자는 **전역 선택 아이가 바뀌었다**는 사실을 화면 전환 없이 말해야 한다.
 *  - 알림 탭의 아이 전환(#22, 라운드 62 #2): 착지한 화면이 누구의 것인지가 소리로만 갈린다.
 *
 * 화면 파일은 전부 다른 트랙(A·B·C)의 소유였으므로 판정은 **순수 모듈의 산출**로 붙들고 화면
 * 쪽은 최소 소스 계약만 둔다 — GAP-062 #10이 세운 관례 그대로다.
 */
describe("GAP-063 #10 라운드 63 신설 UI 접근성 계약", () => {
  /** 2026-08-27이 오늘인 달: 06일에 기록이 있고, 28일은 아직 오지 않은 날이다. */
  const august = buildCalendarMonth("2026-08", [{ date: "2026-08-06", totalKrw: 12_000, hasSubtotal: true }], "2026-08-27");
  const cellOn = (date: string): CalendarCell => {
    const cell = august?.weeks.flat().find((candidate) => candidate.date === date);
    if (!cell) throw new Error(`${date} 칸이 격자에 없다`);
    return cell;
  };

  it("누를 수 없는 달력 칸만 **왜** 못 누르는지를 말한다 (누를 수 있는 칸의 문장은 종전 그대로)", () => {
    // 미래 = 비대화형 + 이유. 날짜 픽커가 GAP-061 #8에서 고정한 관례를 이 달력에도 적용한다.
    expect(resolveCalendarCellAction(cellOn("2026-08-28"))).toBeNull();
    expect(calendarCellAccessibilityLabel(cellOn("2026-08-28"))).toContain(CALENDAR_FUTURE_HINT);
    // 문장은 "고를 수 없다"가 아니라 "기록할 수 없다"다 — 이 칸은 날짜 선택지가 아니라 기록
    // 입구다(미래를 막는 규칙 자체는 여전히 한 벌 — DNC-013).
    expect(CALENDAR_FUTURE_HINT).toContain("기록할 수 없어요");
    // 누를 수 있는 두 종류(기록 있는 날 · 기록 없는 지난 날)에는 꼬리말이 붙지 않는다.
    for (const [date, action] of [
      ["2026-08-06", "open-records"],
      ["2026-08-05", "record-new"]
    ] as const) {
      expect(resolveCalendarCellAction(cellOn(date)), date).toBe(action);
      expect(calendarCellAccessibilityLabel(cellOn(date)), date).not.toContain(CALENDAR_FUTURE_HINT);
    }
    // 화면은 판정을 다시 하지 않고, 누를 수 없는 칸을 disabled 버튼이 아니라 **라벨만 있는
    // 비대화형 자리**로 그린다("버튼, 비활성"으로 읽히면 '왜 못 누르지'가 남는다).
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain("const action = resolveCalendarCellAction(cell);");
    expect(recordsSource).toContain("const accessibilityLabel = calendarCellAccessibilityLabel(cell, { filterLabel }) ?? undefined;");
    expect(recordsSource).toContain("<View accessible accessibilityLabel={accessibilityLabel} style={cellStyle}>");
    expect(recordsSource).toContain('onPress={() => (action === "record-new" ? onRecordForDate(date) : onSelectDate(date))}');
  });

  it("달력 범례가 새 목적지 둘을 말하고, 화면이 그 문장을 다시 적지 않는다", () => {
    // 음영만으로는 색일 뿐이고, 이제 "누르면 무엇이 되는가"가 칸마다 둘로 갈린다.
    expect(CALENDAR_LEGEND_TEXT).toContain("그날 기록으로 이동");
    expect(CALENDAR_LEGEND_TEXT).toContain("그날로 기록");
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain("<Text style={calendarLegendStyle}>{calendarLegendText(filterLabel)}</Text>");
    expect(recordsSource).not.toContain("색이 진할수록");
  });

  it("아이 삭제는 카드와 확인 Alert **두 자리**에서 어느 아이인지 말하고, 모르면 종전 문구 그대로다", () => {
    expect(childScopeDeleteNotice("솔이")).toBe("솔이 프로필을 삭제해요.");
    expect(childScopeDeleteConfirmTitle("솔이")).toBe("솔이 프로필을 삭제할까요?");
    // 이름을 못 풀면(1아이 계정·캐시 없음) null이고 호출부는 종전 문구로 떨어진다 —
    // **모르면 지어내지 않는다**(SET-004 픽셀락).
    for (const unknown of [null, undefined, "", "   "]) {
      expect(childScopeDeleteNotice(unknown), String(unknown)).toBeNull();
      expect(childScopeDeleteConfirmTitle(unknown), String(unknown)).toBeNull();
    }
    const privacySource = source("app/settings/privacy.tsx");
    expect(privacySource).toContain("const childDeleteNotice = childScopeDeleteNotice(childDeleteLabel);");
    expect(privacySource).toContain("{childDeleteNotice ? <Text style={mutedTextStyle}>{childDeleteNotice}</Text> : null}");
    expect(privacySource).toContain('Alert.alert(childScopeDeleteConfirmTitle(childDeleteLabel) ?? "정말 삭제할까요?"');
    // 문구 단일 소스는 순수 모듈이다 — 화면이 같은 문장을 다시 적으면 두 벌이 된다.
    expect(privacySource).not.toContain("프로필을 삭제해요");
    expect(privacySource).not.toContain("프로필을 삭제할까요");
  });

  it("\"이 가구에 아이 추가하기\"가 라벨 있는 버튼이고, 어느 가구인지를 누르기 전에 힌트로 말한다", () => {
    expect(HOUSEHOLD_SCOPE_ADD_CHILD_LABEL).toBe("이 가구에 아이 추가하기");
    // 버튼 글자에 내부 id가 새지 않는다(A11Y-115와 같은 규율).
    expect(HOUSEHOLD_SCOPE_ADD_CHILD_LABEL).not.toMatch(/[0-9a-f]{8}-/);
    const familySource = source("app/family/index.tsx");
    const entry = familySource.slice(familySource.indexOf("accessibilityLabel={HOUSEHOLD_SCOPE_ADD_CHILD_LABEL}"));
    expect(entry.slice(0, 400)).toContain("accessibilityHint={householdNotice ?? undefined}");
    expect(entry.slice(0, 400)).toContain("onPress={() => router.push(addChildScreenHref(switchedHouseholdId))}");
    // 힌트는 바로 위 관리 표기를 그대로 물어 온다 — 이름을 여기서 한 번 더 짓지 않으므로
    // 보이는 줄과 들리는 힌트가 갈릴 자리가 없다.
    expect(familySource).toContain("householdScopeManageNotice(");
  });

  it("전환해 들어와 아이를 추가하면 **선택 아이가 바뀐다는 사실**까지 낭독된다", () => {
    expect(HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE).toBe("지금부터 이 아이 화면으로 바뀌어요.");
    const childrenSource = source("app/settings/children.tsx");
    // 전환해 들어온 흐름에서만 붙는다 — 파라미터가 없는 계정(1가구 포함)에서는 토스트도
    // 낭독도 종전과 한 글자도 다르지 않다(SET-005).
    expect(childrenSource).toContain('const switchNotice = requestedHouseholdId ? ` ${HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE}` : "";');
    // 보이는 토스트와 낭독이 같은 사실을 말한다(눈과 귀가 다른 말을 듣지 않는다).
    expect(childrenSource).toContain("showToast(`${addedNotice}${switchNotice}`, \"success\");");
    expect(childrenSource).toContain(
      "announceForA11y(`${input.values.nickname.trim()}를 추가하고 선택했어요.${switchNotice}`);"
    );
  });

  it("알림함 탭이 아이를 바꿀 때 전환 한 벌의 announce를 그대로 지난다 (문구를 새로 짓지 않는다)", () => {
    // 라운드 62 #2가 연 입구다: 화면 전환과 동시에 전역 선택 아이가 바뀌므로, 말하지 않으면
    // 착지한 예산·기록 화면이 **누구의 것인지** 소리로는 알 수 없다.
    const notificationsSource = source("app/notifications.tsx");
    const block = notificationsSource.slice(notificationsSource.indexOf("const switchToNotificationChild"));
    expect(block.slice(0, 500)).toContain("applyChildSwitch(selectedChildId, child, {");
    expect(block.slice(0, 500)).toContain("announce: announceForA11y");
    // 같은 아이 탭은 no-op이라 announce도 없다(소음 금지) — 판정은 planChildSwitch 한 곳이다.
    expect(source("src/children/child-switch.ts")).toContain("(으)로 전환했어요.");
    expect(notificationsSource).not.toContain("전환했어요");
  });
});

/* ------------------------------------------------------------ 라운드 64 (GAP-064 #6 · #1) */

type HitSlopBox = { bottom: number; left: number; right: number; top: number };

/** `const NAME = { bottom: B, left: L, right: R, top: T } as const;`에서 네 변을 읽는다. */
function readHitSlopBox(sourceText: string, name: string): HitSlopBox {
  const declaration = new RegExp(`const ${name} = \\{([^}]*)\\} as const;`).exec(sourceText);
  if (!declaration) throw new Error(`${name} 상수를 소스에서 찾지 못했다`);
  const side = (key: keyof HitSlopBox) => {
    const found = new RegExp(`\\b${key}:\\s*(\\d+)`).exec(declaration[1]);
    // 빠진 변은 RN에서 0이다 — 계약도 그렇게 읽는다(적지 않은 쪽은 넓어지지 않는다).
    return found ? Number(found[1]) : 0;
  };
  return { bottom: side("bottom"), left: side("left"), right: side("right"), top: side("top") };
}

/** `const NAME = N;` 숫자 상수. */
function readNumericConstant(sourceText: string, name: string): number {
  const found = new RegExp(`const ${name} = (\\d+);`).exec(sourceText);
  if (!found) throw new Error(`${name} 상수를 소스에서 찾지 못했다`);
  return Number(found[1]);
}

/** `hitSlop={TOKEN}`이 걸린 Pressable 블록들(그 prop부터 닫는 `</Pressable>`까지). */
function pressableBlocksWithHitSlop(sourceText: string, hitSlopProp: string): string[] {
  const blocks: string[] = [];
  for (
    let cursor = sourceText.indexOf(hitSlopProp);
    cursor >= 0;
    cursor = sourceText.indexOf(hitSlopProp, cursor + hitSlopProp.length)
  ) {
    const end = sourceText.indexOf("</Pressable>", cursor);
    if (end < 0) throw new Error(`${hitSlopProp} 뒤에서 </Pressable>을 찾지 못했다`);
    blocks.push(sourceText.slice(cursor, end));
  }
  return blocks;
}

/** 각 `hitSlop={TOKEN}` 자리를 감싸는 가장 가까운 `<ScrollView` 여는 태그(앞 160자). */
function enclosingScrollViewTags(sourceText: string, hitSlopProp: string): string[] {
  const tags: string[] = [];
  for (
    let cursor = sourceText.indexOf(hitSlopProp);
    cursor >= 0;
    cursor = sourceText.indexOf(hitSlopProp, cursor + hitSlopProp.length)
  ) {
    const open = sourceText.lastIndexOf("<ScrollView", cursor);
    if (open < 0) throw new Error(`${hitSlopProp} 앞에서 <ScrollView를 찾지 못했다`);
    tags.push(sourceText.slice(open, open + 160));
  }
  return tags;
}

/** 칩 Pressable의 style에 적힌 minHeight. 없으면 타깃 계산이 성립하지 않으므로 던진다. */
function chipMinHeight(block: string): number {
  const found = /minHeight:\s*(\d+)/.exec(block);
  if (!found) throw new Error("칩 Pressable에서 minHeight를 찾지 못했다");
  return Number(found[1]);
}

/**
 * GAP-064 #6 — **터치 타깃 소스 계약**: (요소 높이 + 2×세로 hitSlop) ≥ `theme.touchTarget`.
 *
 * 왜 여기인가. 라운드 64 정찰이 이 파일의 사각을 그대로 짚었다 — 접근성 계약이 57건인데
 * **터치 타깃을 보는 단언이 0건**이었다. 그래서 매일 누르는 칩 네 자리가 38dp(=48에 10 모자람)로
 * 태어났고, 다음 칩도 같은 값으로 태어날 참이었다. 라벨·역할·상태는 이 파일이 이미 촘촘히
 * 붙들고 있는데 **손가락이 닿는가**만 아무도 묻지 않은 셈이다(A-1 Touch targets 줄이 "코드 계약
 * 없음"이라고 적혀 있던 이유).
 *
 * 계약의 모양은 라운드 64 A가 커머스 크롬에 세운 것과 같다(`items/link-marker.test.ts`의
 * "라운드 64 #6"): 값을 테스트에 다시 박지 않고 **소스의 상수와 소스의 높이**를 읽어 더한다.
 * 그래서 다음 사람이 칩 높이를 32로 줄이거나 hitSlop을 되돌리면 여기서 빨개진다.
 *
 * 세 가지를 함께 붙든다.
 *  ① 세로 합이 최소 타깃을 채운다.
 *  ② **가로는 올리지 않는다** — 칩 사이 간격이 8이라 좌우로 5씩 늘리면 이웃 칩과 겹쳐
 *     "옆 칩이 눌리는" 오탭을 새로 만든다. 종전 3은 줄이지도 않는다(줄이면 히트 영역만 좁아진다).
 *  ③ **렌더는 불변이다** — `hitSlop`은 레이아웃 속성이 아니므로 EXP-001 픽셀락 기준선이
 *     이 변경으로 흔들리지 않아야 한다(ITEM-002에 A가 적은 근거와 같다).
 */
describe("GAP-064 #6 터치 타깃 소스 계약 (높이 + 2×세로 hitSlop ≥ theme.touchTarget)", () => {
  const CHIP_HIT_SLOP_PROP = "hitSlop={SUGGEST_CHIP_HIT_SLOP}";
  /** 입력 보조 칩이 서는 자리. new는 최근 품목·품목 자동완성·판매처 자동완성 셋, 상세는 판매처 하나. */
  const chipScreens = [
    { chips: 3, path: "app/expenses/new.tsx" },
    { chips: 1, path: "app/expenses/[expenseId].tsx" }
  ] as const;

  it("입력 보조 칩 네 자리가 세로 히트 영역으로 최소 터치 타깃을 채운다", () => {
    // 가드: 자리 하나가 통째로 빠지면 아래 루프는 조용히 지나간다.
    expect(chipScreens.reduce((sum, screen) => sum + screen.chips, 0)).toBe(4);

    for (const screen of chipScreens) {
      const screenSource = source(screen.path);
      const box = readHitSlopBox(screenSource, "SUGGEST_CHIP_HIT_SLOP");
      const blocks = pressableBlocksWithHitSlop(screenSource, CHIP_HIT_SLOP_PROP);
      expect(blocks.length, `${screen.path}의 칩 수`).toBe(screen.chips);

      for (const block of blocks) {
        const height = chipMinHeight(block);
        expect(height + box.top + box.bottom, `${screen.path} 칩의 세로 히트 영역`).toBeGreaterThanOrEqual(
          theme.touchTarget
        );
      }

      // 두 화면의 칩은 같은 모듈이 라벨을 만드는 **같은 칩**이다 — 값이 화면마다 갈리지 않는다.
      expect(box, `${screen.path}의 hitSlop`).toEqual({ bottom: 5, left: 3, right: 3, top: 5 });
      // 맨 숫자 hitSlop이 남아 있지 않다(다음 칩이 다시 3으로 태어나지 않게).
      expect(screenSource, `${screen.path}에 남은 맨 숫자 hitSlop`).not.toContain("hitSlop={3}");
    }
  });

  it("넓힌 것은 세로뿐이다 — 가로를 올리면 칩 사이 gap 8을 넘어 옆 칩이 눌린다", () => {
    for (const screen of chipScreens) {
      const screenSource = source(screen.path);
      const box = readHitSlopBox(screenSource, "SUGGEST_CHIP_HIT_SLOP");

      // 세로는 대칭으로 갚는다(한쪽만 늘리면 칩이 위/아래로 치우친 히트 영역을 갖는다).
      expect(box.top, `${screen.path} 세로 대칭`).toBe(box.bottom);
      // 가로는 이웃과 나눠 쓴다: 두 칩이 각자 left/right만큼 gap 안으로 들어오므로 합이 8 미만이어야 한다.
      expect(box.left, `${screen.path} 가로 대칭`).toBe(box.right);
      expect(box.left + box.right, `${screen.path} 가로 합`).toBeLessThan(8);
      // 그렇다고 0으로 지우지도 않는다 — 이 라운드의 목적과 반대로 히트 영역이 좁아진다.
      expect(box.left, `${screen.path} 가로 히트 영역`).toBeGreaterThan(0);

      // 그 8이 실제로 이 칩 줄의 간격이다(숫자를 계약에만 적어 두지 않는다).
      for (const tag of enclosingScrollViewTags(screenSource, CHIP_HIT_SLOP_PROP)) {
        expect(tag, `${screen.path} 칩 줄의 gap`).toContain("gap: 8");
      }
    }
  });

  it("커머스 상세의 플로팅 크롬도 같은 규칙을 지난다 (라운드 64 A가 붙인 자리)", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    const chromeStyle = detailSource.slice(
      detailSource.indexOf("const productDetailChromeButtonStyle = {"),
      detailSource.indexOf("const PRODUCT_DETAIL_CHROME_HIT_SLOP")
    );
    const chromeHeight = Number(/height:\s*(\d+)/.exec(chromeStyle)?.[1]);
    const chromeHitSlop = readNumericConstant(detailSource, "PRODUCT_DETAIL_CHROME_HIT_SLOP");

    expect(chromeHeight).toBe(34);
    expect(chromeHeight + 2 * chromeHitSlop).toBeGreaterThanOrEqual(theme.touchTarget);
    // 뒤로가기·공유하기 둘 다 같은 상수를 쓴다(값을 자리마다 다시 박지 않는다).
    expect(pressableBlocksWithHitSlop(detailSource, "hitSlop={PRODUCT_DETAIL_CHROME_HIT_SLOP}")).toHaveLength(2);
  });

  it("렌더는 한 픽셀도 바뀌지 않는다 — 칩의 레이아웃 속성은 그대로다 (EXP-001 픽셀락)", () => {
    for (const screen of chipScreens) {
      for (const block of pressableBlocksWithHitSlop(source(screen.path), CHIP_HIT_SLOP_PROP)) {
        // 승인 캡처의 pill 38 · 좌우 여백 14가 그대로다(hitSlop은 레이아웃 속성이 아니다).
        expect(block, `${screen.path} 칩 높이`).toContain("minHeight: 38,");
        expect(block, `${screen.path} 칩 여백`).toContain("paddingHorizontal: 14");
        expect(block, `${screen.path} 칩 모양`).toContain("borderRadius: theme.radii.pill,");
        // 세로 여백으로 높이를 벌지 않았다 — 그건 렌더가 바뀌는 길이다.
        expect(block, `${screen.path} 칩 세로 여백`).not.toContain("paddingVertical");
        expect(block, `${screen.path} 칩 고정 높이`).not.toMatch(/[^n]height:\s*\d/);
      }
    }
  });
});

/**
 * GAP-064 #1 — **화면에서 가장 강한 버튼의 낭독 문장과 그 게이트**.
 *
 * 접근성 항목인 이유. 이 버튼에는 `accessibilityLabel`이 없다 — 보이는 라벨이 곧 낭독되는
 * 문장이다(`PrimaryButton`의 role은 A11Y-101이 이미 붙들고 있다). 그래서 "바로 구매하기"라고
 * 읽히는 자리가 **무엇을 여는가**는 라벨 계약의 일부다: 소리로만 앱을 쓰는 사람에게 이 문장은
 * 화면에서 가장 강조된 구매 경로라는 뜻인데, 그 뒤에 광고가 걸려 있으면 **표시와 사실이
 * 갈린다**(DNC-011이 세우려는 구분이 우대로 뒤집힌다).
 *
 * 판정은 순수 모듈의 것이고(`primaryPurchaseLinkIndex` — 값 계약은 `items/link-marker.test.ts`가
 * 촘촘히 고정한다) 화면 파일은 라운드 64 트랙 A의 소유였으므로, 여기서는 GAP-062 #10이 세운
 * 관례대로 **그 판정이 낭독되는 버튼에 실제로 걸려 있는가**만 최소 소스 계약으로 둔다.
 */
describe("GAP-064 #1 전폭 구매 CTA 라벨 계약 (스폰서 판정 게이트 — DNC-011)", () => {
  const detailSource = () => source("app/items/[itemTemplateId].tsx");

  it("가장 강한 버튼의 라벨이 곧 낭독 문장이고, 그 버튼은 판정이 고른 링크를 연다", () => {
    const detail = detailSource();
    expect(detail).toContain('label="바로 구매하기"');
    // 그 문장은 화면에 **한 번만** 있다 — 주석이나 다른 자리에 같은 말이 늘면 어느 것이
    // 낭독되는 라벨인지 소스만 보고는 갈리지 않는다(트랙 A가 주석에서 이 문자열을 뺀 이유).
    expect(detail.match(/바로 구매하기/g)).toHaveLength(1);
    // 게이트와 목적지가 **같은 한 판정**을 지난다(판매처 행의 채움과도 같은 값이다).
    expect(detail).toContain("const filledPurchaseRowIndex = primaryPurchaseLinkIndex(visibleDetail.productLinks);");
    expect(detail).toContain(
      "filledPurchaseRowIndex >= 0 ? visibleDetail.productLinks[filledPurchaseRowIndex] : undefined"
    );
    expect(detail).toContain("onPress={() => handleProductLinkPress(primaryPurchaseLink)}");
  });

  it("스폰서만 남은 품목에서는 그 버튼이 아예 없다 — '구매하기'라고 읽히는 광고를 만들지 않는다", () => {
    // 판정: 전부 스폰서면 강조를 받을 링크가 없다(-1).
    expect(primaryPurchaseLinkIndex([{ isSponsored: true }, { isSponsored: true }])).toBe(-1);
    // 화면: 그때 버튼은 비활성으로 남는 것이 아니라 **렌더되지 않는다**. 비활성 버튼은
    // "버튼, 비활성"으로 읽히고 왜 못 누르는지가 남는다(달력 미래 칸 A-4 #23과 같은 규율).
    expect(detailSource()).toContain("{primaryPurchaseLink ? (");
    expect(detailSource()).not.toContain('disabled={!primaryPurchaseLink}');
  });

  it("사라진 자리의 링크는 판매처 행에 **스폰서라고 말한 채** 남는다 (구매 경로가 닫히지 않는다)", () => {
    const marker = productLinkMarker({ isAffiliate: false, isSponsored: true });
    expect(marker.badgeLabel).toBe(SPONSORED_MARKER_LABEL);
    expect(marker.caption).toBe(SPONSORED_MARKER_CAPTION);
    expect(marker.badgeTone).toBe("warning");
    // 그 행의 버튼은 판매처 이름을 실은 문장으로 낭독된다 — "구매" 두 글자로는 어느 판매처인지
    // 소리로 갈리지 않는다(A11Y-101이 고정한 라벨 배선).
    expect(source("src/ui.tsx")).toContain("accessibilityLabel={`${seller}에서 구매하기`}");
    // 강조(채움)만 판정을 따르고 행 자체는 서버가 준 순서대로 전부 그려진다(DNC-009 무접촉).
    expect(detailSource()).toContain("primaryAction={hasSession && index === filledPurchaseRowIndex}");
  });
});
