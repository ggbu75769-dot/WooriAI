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
// GAP-066 #8: 알림 한 줄이 **소리로** 어떻게 도달하는가. 후보(문구)와 라벨 조립은 각각 순수
// 모듈의 것이고, 여기서는 그 둘이 만나 만들어지는 낭독 문장을 본다(값 계약은 트랙 E 소유).
import { monthlyWrapupNotification } from "./notifications/generators";
import { SEOUL_UTC_OFFSET_MS } from "./notifications/iso-week";
import { formatNotificationRowTitle } from "./notifications/notification-child-label";
import { notificationRowAccessibilityLabel } from "./notifications/notification-row-actions";
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
    // 라운드 65 D: 같은 픽커를 아이 생년월일·예정일도 쓴다. 라벨 입력에 방향 한 칸이 늘었을 뿐
    // 계약은 그대로다 — 라벨은 여전히 순수 모듈이 만들고 화면은 그리기만 한다.
    expect(pickerSource).toContain("expenseDatePickerCellAccessibilityLabel(cell, { selectedIso, todayIso, direction })");
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
    /**
     * 라운드 65 D — 계약 갱신: 이유가 **한 문장에서 두 문장으로** 늘었다.
     *
     * 같은 픽커를 출산 예정일이 쓰기 시작했는데, 그 달력에서 못 고르는 칸의 이유는 "아직 오지
     * 않은 날"이 아니라 "만삭보다 먼 날"이다. 라운드 61 E가 고정한 계약("왜 못 누르는지까지
     * 말한다")은 그대로이고, 화면이 문구를 고르지 않는다는 규율도 그대로다 — 방향에서 문장을
     * 고르는 일까지 순수 모듈이 한다. 그래서 여기서 고정하는 것은 "화면이 그 헬퍼를 지난다"이고,
     * 결과 문자열은 date-picker-month.test.ts가 핀한다.
     */
    expect(monthSource).toContain("parts.push(expenseDatePickerUnselectableHint(direction))");
    expect(monthSource).toContain("export function expenseDatePickerUnselectableHint");
    expect(monthSource).toContain("export const EXPENSE_DATE_PICKER_BEYOND_TERM_HINT");
  });

  it("달력 월 이동 화살표가 라벨 + disabled 상태를 알리고, 요일 머리글은 트리에서 감춘다", () => {
    const pickerSource = source("src/expenses/ExpenseDatePicker.tsx");
    expect(pickerSource).toContain('accessibilityLabel="이전 달"');
    expect(pickerSource).toContain('accessibilityLabel="다음 달"');
    expect(pickerSource).toContain(
      "accessibilityState={{ disabled: !canGoToPreviousExpenseDatePickerMonth(pickerYearMonth, todayIso) }}"
    );
    expect(pickerSource).toContain(
      "accessibilityState={{ disabled: !canGoToNextExpenseDatePickerMonth(pickerYearMonth, todayIso, direction) }}"
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
    // **모르면 지어내지 않는다**(SET-004의 1아이 문자열 불변 계약 — 캡처 아님. 라운드 66 F 정정:
    // 픽셀락 캡처 라우트에 설정 계열은 SET-001뿐이다 — app/pixel-lock.tsx).
    for (const unknown of [null, undefined, "", "   "]) {
      expect(childScopeDeleteNotice(unknown), String(unknown)).toBeNull();
      expect(childScopeDeleteConfirmTitle(unknown), String(unknown)).toBeNull();
    }
    const privacySource = source("app/settings/privacy.tsx");
    expect(privacySource).toContain("const childDeleteNotice = childScopeDeleteNotice(childDeleteLabel);");
    expect(privacySource).toContain("{childDeleteNotice ? <Text style={mutedTextStyle}>{childDeleteNotice}</Text> : null}");
    // 라운드 66 트랙 B(#6)에서 Alert 인자가 여러 줄로 나뉘었다 — 제목 규칙은 그대로다.
    expect(privacySource).toContain('childScopeDeleteConfirmTitle(childDeleteLabel) ?? "정말 삭제할까요?"');
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

  /**
   * 라운드 66 적대 리뷰(M-2) — **글자를 감싸기만 한 트리거 두 자리**.
   *
   * GAP-066 #2가 두 탭의 달 라벨을 Pressable로 감쌌는데, 그 버튼의 몸은 글자 줄 하나(16px면
   * 약 20dp)다 — `hitSlop={8}`을 더해도 36dp라 최소 타깃에 못 미쳤다. 이 계약이 칩만 읽고
   * 있어 그 자리가 조용히 통과했다(라운드 64가 막으려던 재발 경로 그대로다).
   *
   * 고침은 같은 파일의 **아이 전환 트리거 선례**와 한 글자도 다르지 않다: 세로 가운데 정렬 +
   * `minHeight: theme.touchTarget`. 두 자리 모두 줄 높이를 48dp 화살표(기록 탭)·
   * `minHeight: theme.touchTarget`인 줄(리포트 탭)이 이미 잡고 있어 **렌더는 불변**이다.
   */
  it("두 탭의 달 라벨 트리거도 최소 타깃을 채운다 (감싸기만 한 버튼의 몸은 글자 줄 하나다)", () => {
    const triggers = [
      { path: "app/(tabs)/records.tsx", testId: "records-month-jump-trigger" },
      { path: "app/(tabs)/reports.tsx", testId: "reports-month-jump-trigger" }
    ] as const;

    for (const trigger of triggers) {
      const screenSource = source(trigger.path);
      const at = screenSource.indexOf(`testID="${trigger.testId}"`);
      if (at < 0) throw new Error(`${trigger.path}에 ${trigger.testId}가 없다`);
      const start = screenSource.lastIndexOf("<Pressable", at);
      const end = screenSource.indexOf("</Pressable>", at);
      const block = screenSource.slice(start, end);

      // 높이를 hitSlop으로 벌지 않는다 — 글자 줄 하나 + 8+8은 48에 못 미친다.
      expect(block, `${trigger.path} 트리거의 최소 높이`).toContain("minHeight: theme.touchTarget");
      // 채운 높이 안에서 글자가 가운데 선다(늘어난 것은 히트 영역뿐, 라벨의 위치는 그대로다).
      expect(block, `${trigger.path} 트리거의 세로 정렬`).toContain('justifyContent: "center"');
      // 세로 여백으로 벌지 않았다 — 그건 줄 높이가 달라지는 길이다(픽셀락 REP-001).
      expect(block, `${trigger.path} 트리거의 세로 여백`).not.toContain("paddingVertical");
    }

    // 이 한 줄이 새로 지은 값이 아니라는 근거: 같은 파일의 아이 전환 트리거가 쓰던 그 줄이다.
    expect(source("app/(tabs)/records.tsx")).toContain(
      'style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}'
    );
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

/* ------------------------------------------------------------ 라운드 65 (GAP-065 #6 · #7) */

/** `<Tag ...>` 여는 태그 하나. 중괄호 안의 `>`(중첩 JSX·화살표)는 태그 끝으로 세지 않는다. */
function openingTagAfter(sourceText: string, afterMarker: string, tagStart: string): string {
  const from = sourceText.indexOf(afterMarker);
  if (from < 0) throw new Error(`${afterMarker}를 소스에서 찾지 못했다`);
  // `useRef<ScrollView>(null)` 같은 **타입 인자**는 여는 태그가 아니다 — 태그 이름 뒤에 공백이
  // 오는 자리만 센다.
  let start = sourceText.indexOf(tagStart, from);
  while (start >= 0 && !/\s/.test(sourceText[start + tagStart.length] ?? "")) {
    start = sourceText.indexOf(tagStart, start + tagStart.length);
  }
  if (start < 0) throw new Error(`${afterMarker} 뒤에서 ${tagStart}를 찾지 못했다`);
  let depth = 0;
  for (let cursor = start; cursor < sourceText.length; cursor += 1) {
    const char = sourceText[cursor];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return sourceText.slice(start, cursor + 1);
  }
  throw new Error(`${tagStart}의 여는 태그가 닫히지 않았다`);
}

/** `const NAME = { ... } as const;` 스타일 객체에서 숫자 한 칸. */
function readStyleNumber(sourceText: string, styleName: string, key: string): number {
  const declaration = new RegExp(`const ${styleName} = \\{([^}]*)\\} as const;`).exec(sourceText);
  if (!declaration) throw new Error(`${styleName} 스타일을 소스에서 찾지 못했다`);
  const found = new RegExp(`\\b${key}:\\s*(\\d+)`).exec(declaration[1]);
  if (!found) throw new Error(`${styleName}에서 ${key}를 찾지 못했다`);
  return Number(found[1]);
}

/**
 * GAP-065 #6 — **스크롤 스캐폴드의 키보드 계약**.
 *
 * RN의 `keyboardShouldPersistTaps` 기본값은 `"never"`다: 키보드가 떠 있는 동안의 **첫 탭은
 * 자식에게 가지 않고 키보드만 내린다.** 이 앱에서 가장 자주 반복되는 동작이 정확히 그 모양이라
 * (금액을 치고 → 카테고리 타일/칩/체크박스를 누른다) 사용자에게는 "눌렀는데 반응이 없다"로
 * 나타난다. 저장소가 그 비용을 이미 자기 주석으로 적어 두었고(app/expenses/new.tsx의
 * `merchantFocused` — "첫 탭에 칩이 사라져 두 번째 탭이 맞을 자리가 없다"), 이식된 스캐폴드는
 * 이미 `"handled"`였다. 계약이 붙들 것은 **세 스캐폴드가 같은 답을 명시한다**는 사실이다.
 *
 * `"always"`가 아니라 `"handled"`인 이유도 함께 못박는다: `"always"`면 빈 자리를 눌러도 키보드가
 * 내려가지 않아 "닫는 법을 모르겠다"가 새로 생긴다. `"handled"`는 자식이 처리한 탭만 통과시킨다.
 */
describe("GAP-065 #6 스크롤 스캐폴드 키보드 계약 (keyboardShouldPersistTaps=\"handled\")", () => {
  /** 앱의 화면 스크롤러 셋. 첫 둘이 이번 라운드가 채운 자리, 셋째는 이미 그랬던 이식본이다. */
  const scaffolds = [
    { after: "export function AppScreen", path: "src/ui.tsx", tag: "<ScrollView" },
    { after: "const listHeader =", path: "app/(tabs)/records.tsx", tag: "<SectionList" },
    { after: "export function ScreenScaffold", path: "src/design-system/components/ScreenScaffold.tsx", tag: "<ScrollView" }
  ] as const;

  it("세 스캐폴드가 모두 'handled'를 명시한다 (기본값 never에 기대지 않는다)", () => {
    for (const scaffold of scaffolds) {
      const tag = openingTagAfter(source(scaffold.path), scaffold.after, scaffold.tag);
      expect(tag, `${scaffold.path}의 스크롤러`).toContain('keyboardShouldPersistTaps="handled"');
    }
  });

  it("'always'는 쓰지 않는다 — 빈 자리를 누르면 키보드가 내려가야 한다", () => {
    for (const scaffold of scaffolds) {
      expect(source(scaffold.path), `${scaffold.path}`).not.toContain('keyboardShouldPersistTaps="always"');
    }
  });

  it("렌더는 한 픽셀도 바뀌지 않는다 — 스캐폴드의 레이아웃 속성은 그대로다 (픽셀락 6종)", () => {
    // AppScreen은 전 화면이 지나는 컴포넌트다. 이번 변경은 터치 전달 규칙 한 줄뿐이고,
    // 배경·여백·간격은 종전 그대로여야 한다(EXP-001·HOME-001·REP-001·ITEM-001·IMP-003·SET-001).
    const appScreenTag = openingTagAfter(source("src/ui.tsx"), "export function AppScreen", "<ScrollView");
    expect(appScreenTag).toContain("gap: theme.spacing.section");
    expect(appScreenTag).toContain("padding: theme.spacing.screen");
    expect(appScreenTag).toContain("flexGrow: 1");
  });
});

/**
 * GAP-065 #7 — **공유 프리미티브의 터치 타깃 소스 계약**.
 *
 * 라운드 64 #6이 세운 계약(위 GAP-064 블록)이 읽는 파일은 화면 셋뿐이라, 같은 값(44)으로 서
 * 있던 **공유 컴포넌트**는 그대로 통과했다 — 그래서 새 화면이 하나 생길 때마다 44dp 컨트롤이
 * 자동으로 따라 태어난다. 라운드 64가 소스 계약으로 막으려던 재발 경로가 정확히 거기 열려 있었다.
 * 그래서 이 블록은 **화면이 아니라 컴포넌트**를 읽는다.
 *
 * 계산 방식은 라운드 64와 같다: 값을 테스트에 다시 박지 않고 **소스의 상수와 소스의 크기**를
 * 읽어 더한다(`theme.touchTarget`도 숫자로 옮겨 적지 않는다).
 *
 * 넓히는 축을 고르는 규율도 같다 — **늘린 히트 영역이 이웃 컨트롤의 몸(보이는 픽셀)에 닿으면
 * 안 된다.** 그래서 축마다 실측한 간격이 천장이고, 그 실측 자체를 아래 첫 테스트가 소스에서
 * 다시 계산한다(칩 줄의 gap을 사람이 옮겨 적지 않는다).
 */
describe("GAP-065 #7 공유 프리미티브 터치 타깃 계약 (크기 + 2×hitSlop ≥ theme.touchTarget)", () => {
  const uiSource = () => source("src/ui.tsx");

  /**
   * `<CategoryChip`이 서는 자리와 그 줄의 gap. 인라인 style이면 그 자리에서, 이름 붙은 style이면
   * 선언에서 읽는다.
   *
   * 라운드 65 후속(#4): 화면 목록을 **사람이 적어 두지 않는다.** 종전에는 여덟 경로가 여기
   * 하드코딩돼 있었고, 같은 라운드가 새로 만든 칩 줄(`app/import/[importJobId].tsx`의 검수
   * 화면 분류 칩)이 목록에 없어 **이 계약이 그 줄을 한 번도 읽지 않았다** — "더 좁은 줄이 새로
   * 태어나면 여기서 빨개진다"는 이 테스트의 목적이 조용히 무력화돼 있었다. 이제 컴포넌트 전량
   * 스캔(`listComponentSources`)에서 칩을 쓰는 파일을 직접 찾으므로, 새 줄이 태어나면 아무도
   * 목록을 갱신하지 않아도 자동으로 이 판정에 들어온다.
   */
  function categoryChipRowGaps(): { gap: number; path: string }[] {
    const screens = listComponentSources().filter((path) => source(path).includes("<CategoryChip"));
    const found: { gap: number; path: string }[] = [];
    for (const path of screens) {
      const screenSource = source(path);
      const lines = screenSource.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].includes("<CategoryChip")) continue;
        let gap: number | undefined;
        // 칩 자리에서 위로 거슬러 올라가며 가장 가까운 줄 컨테이너를 찾는다(최대 40줄).
        for (let cursor = index; cursor >= 0 && cursor > index - 40 && gap === undefined; cursor -= 1) {
          const inline = /gap:\s*(\d+)/.exec(lines[cursor]);
          if (inline) {
            gap = Number(inline[1]);
            break;
          }
          const named = /style=\{([A-Za-z][A-Za-z0-9]*)\}/.exec(lines[cursor]);
          if (named) {
            const declaration = new RegExp(`const ${named[1]} = \\{([^}]*)\\}`).exec(screenSource);
            const namedGap = declaration ? /gap:\s*(\d+)/.exec(declaration[1]) : null;
            if (namedGap) gap = Number(namedGap[1]);
          }
        }
        if (gap === undefined) throw new Error(`${path}:${index + 1} 칩 줄의 gap을 소스에서 찾지 못했다`);
        found.push({ gap, path });
      }
    }
    return found;
  }

  it("카테고리 칩: 38 + 세로 5+5 = 48. 가로는 **실측한 칩 사이 간격**이 천장이라 3 그대로다", () => {
    const box = readHitSlopBox(uiSource(), "CATEGORY_CHIP_HIT_SLOP");
    const blocks = pressableBlocksWithHitSlop(uiSource(), "hitSlop={CATEGORY_CHIP_HIT_SLOP}");
    expect(blocks, "CategoryChip은 프리미티브 하나다").toHaveLength(1);
    expect(chipMinHeight(blocks[0]) + box.top + box.bottom, "칩의 세로 히트 영역").toBeGreaterThanOrEqual(
      theme.touchTarget
    );

    // 가로: 라운드 64가 가정한 8이 아니라 **6인 줄이 있다**(준비템 탭). 그 실측을 사람이 옮겨
    // 적지 않고 소스에서 다시 센다 — 더 좁은 줄이 새로 태어나면 여기서 빨개진다.
    const rows = categoryChipRowGaps();
    expect(rows.length, "칩이 서는 자리 수").toBe(18);
    // 라운드 65 후속(#4): 목록을 손으로 적던 시절 빠져 있던 줄. 스캔이 실제로 그 줄을 읽는지
    // 한 번 못 박아 둔다 -- 스캐너가 조용히 빈 목록을 돌려주면 위 개수 단언만으로는 안 잡힌다.
    expect(rows.map((row) => row.path), "가져오기 검수 화면의 분류 칩 줄도 읽는다").toContain(
      join("app", "import/[importJobId].tsx")
    );
    const tightest = Math.min(...rows.map((row) => row.gap));
    expect(tightest, "가장 좁은 칩 줄 간격").toBe(6);
    // 두 이웃이 각자 left/right만큼 그 간격으로 들어온다 — 합이 간격을 넘으면 히트 영역이 겹친다.
    expect(box.left + box.right, "가로 합").toBeLessThanOrEqual(tightest);
    expect(box.left, "가로 대칭").toBe(box.right);
    // 0으로 지우지도 않는다(라운드 64의 판단 — 줄이면 히트 영역만 좁아진다).
    expect(box.left).toBeGreaterThan(0);
    // 세로 5는 그 6보다 **작다** — 겹치는 것은 아무도 갖고 있지 않던 빈 띠뿐이고, 이웃 칩의
    // 몸(보이는 픽셀)에는 닿지 않는다. 종전에 그 자리를 누르면 아무 일도 일어나지 않았다.
    expect(box.top, "세로 대칭").toBe(box.bottom);
    expect(box.top, "세로 확장이 이웃 칩의 몸에 닿지 않는다").toBeLessThan(tightest);
    // 라운드 64가 입력 보조 칩에 쓴 상자와 **같은 값**이다(같은 모양의 칩이 자리마다 갈리지 않는다).
    expect(box).toEqual(readHitSlopBox(source("app/expenses/new.tsx"), "SUGGEST_CHIP_HIT_SLOP"));
  });

  it("세그먼트 탭: 세로로 갚고 **가로는 0** — 탭 셋이 맞붙어 있어 4는 옆 탭의 몸을 덮고 있었다", () => {
    const box = readHitSlopBox(uiSource(), "SEGMENTED_TAB_HIT_SLOP");
    const blocks = pressableBlocksWithHitSlop(uiSource(), "hitSlop={SEGMENTED_TAB_HIT_SLOP}");
    expect(blocks, "SegmentedControl의 탭은 한 곳에서 태어난다").toHaveLength(1);

    // 탭 높이는 세로 패딩 + 13px 텍스트의 줄 상자다. 줄 상자 높이는 런타임 폰트 메트릭이라
    // 소스에서 읽을 수 없으므로, 계약은 **소스가 보증하는 최소 높이**(줄 상자 ≥ fontSize)로
    // 계산한다 — 실제 높이는 이보다 크다(실측은 a11y 체크리스트 C-1의 손가락 몫).
    const paddingVertical = Number(/paddingVertical:\s*(\d+)/.exec(blocks[0])?.[1]);
    const fontSize = Number(/fontSize:\s*(\d+)/.exec(blocks[0])?.[1]);
    expect(paddingVertical, "탭 세로 패딩").toBe(9);
    expect(fontSize, "탭 글자 크기").toBe(13);
    expect(2 * paddingVertical + fontSize + box.top + box.bottom, "탭의 세로 히트 영역").toBeGreaterThanOrEqual(
      theme.touchTarget
    );
    expect(box.top, "세로 대칭").toBe(box.bottom);

    // 가로가 0인 이유는 소스에 그대로 있다: 탭은 `flex: 1`이고 트랙에는 간격이 없다.
    expect(blocks[0], "탭은 서로 맞붙는다").toContain("flex: 1");
    const trackTag = openingTagAfter(uiSource(), "export function SegmentedControl", "<View");
    expect(trackTag, "트랙 자체엔 탭 사이 간격이 없다").not.toContain("gap:");
    expect(box.left, "맞붙은 이웃에게 가로를 넓히지 않는다").toBe(0);
    expect(box.right).toBe(0);
  });

  it("알림 벨·더보기 검색: 36dp 정사각 + 6 = 48 (이웃 컨트롤이 없어 네 변을 함께 넓힌다)", () => {
    const squares = [
      { constant: "NOTIFICATION_BELL_HIT_SLOP", path: "src/notifications/NotificationBell.tsx", style: "bellButtonStyle" },
      { constant: "MORE_SEARCH_HIT_SLOP", path: "app/(tabs)/more.tsx", style: "moreSearchButtonStyle" }
    ] as const;

    for (const square of squares) {
      const squareSource = source(square.path);
      const slop = readNumericConstant(squareSource, square.constant);
      const height = readStyleNumber(squareSource, square.style, "height");
      const width = readStyleNumber(squareSource, square.style, "width");
      expect(height, `${square.path} 정사각`).toBe(width);
      expect(height + 2 * slop, `${square.path}의 히트 영역`).toBeGreaterThanOrEqual(theme.touchTarget);
      expect(squareSource, `${square.path}에 남은 맨 숫자 hitSlop`).not.toContain("hitSlop={4}");
    }
  });

  it("렌더는 한 픽셀도 바뀌지 않는다 — 프리미티브의 레이아웃 속성은 그대로다 (픽셀락 6종)", () => {
    const chipBlock = pressableBlocksWithHitSlop(uiSource(), "hitSlop={CATEGORY_CHIP_HIT_SLOP}")[0];
    // 승인 캡처의 pill 38 · 좌우 여백 14가 그대로다(hitSlop은 레이아웃 속성이 아니다).
    expect(chipBlock, "칩 높이").toContain("minHeight: 38,");
    expect(chipBlock, "칩 여백").toContain("paddingHorizontal: 14");
    // 세로 여백으로 높이를 벌지 않았다 — 그건 렌더가 바뀌는 길이다.
    expect(chipBlock, "칩 세로 여백").not.toContain("paddingVertical");

    const tabBlock = pressableBlocksWithHitSlop(uiSource(), "hitSlop={SEGMENTED_TAB_HIT_SLOP}")[0];
    expect(tabBlock, "탭 높이를 새로 박지 않았다").not.toMatch(/[^n]height:\s*\d/);
    expect(uiSource(), "트랙 패딩").toContain("borderRadius: theme.radii.pill, flexDirection: \"row\", padding: 4");

    expect(readStyleNumber(source("src/notifications/NotificationBell.tsx"), "bellButtonStyle", "height")).toBe(36);
    expect(readStyleNumber(source("app/(tabs)/more.tsx"), "moreSearchButtonStyle", "height")).toBe(36);
  });
});

/* ------------------------------------- 라운드 65 트랙 F (GAP-065 #10 — 남은 낭독 계약) */

/**
 * 트랙 F의 몫은 **A~D가 이미 붙든 계약 위에 남은 공백만** 채우는 것이다. 이번 라운드의 값·문구
 * 계약은 각 트랙이 자기 모듈 테스트에 넣었고(preview-rows.test.ts · consent-summary.test.ts ·
 * legal-links.test.ts · date-picker-month.test.ts · 위 GAP-065 #6·#7 블록), 여기 남은 것은 세
 * 자리뿐이다 — **새로 생긴 컨트롤이 소리로도 같은 것을 말하는가**.
 *
 * 세 자리 모두 이 파일의 오랜 관례를 따른다: 화면은 vitest에서 렌더되지 않으므로 소스 문자열로
 * 고정하고(react-native 네이티브 바인딩 부재), 문구 자체는 순수 모듈의 테스트가 핀한다.
 */

/**
 * GAP-065 #2 — **가져오기 검수 행의 분류가 소리로도 도달하는가.**
 *
 * 이 라운드 전까지 검수 카드는 분류를 그리지도 않았다(승인 대상의 절반이 미리보기에 없었다).
 * 줄이 생겼으니 두 가지가 따라와야 한다: ⓐ 잠금 카드는 `accessible` **한 덩어리**라 자식
 * 텍스트가 따로 읽히지 않으므로 분류를 라벨 문자열에 실어야 들리고, ⓑ 분류를 고르는 컨트롤은
 * 펼침 상태를 알려야 한다(누르기 전에 "지금 열려 있는가"가 갈린다 — A-4 #23이 "누를 수 있는
 * 칸과 없는 칸이 소리로 갈리는가"를 물은 것과 같은 규율).
 */
describe("GAP-065 #2 가져오기 검수 행의 분류 낭독 계약", () => {
  const importSource = () => source("app/import/[importJobId].tsx");

  it("분류 고르기 버튼이 라벨 + button 역할 + expanded 상태를 갖는다", () => {
    const src = importSource();
    // 문구는 순수 모듈이 고른다(펼침/닫힘 두 문구가 화면에서 갈리지 않는다 —
    // 값은 preview-rows.test.ts가 핀한다).
    expect(src).toContain("accessibilityLabel={importRowCategoryEditLabel(expanded)}");
    expect(src).toContain("accessibilityState={{ expanded }}");
    // 보이는 글자와 낭독 문장이 같은 한 값이다(눈과 귀가 다른 말을 하지 않는다 — A-3 #20).
    expect(src).toContain("<Text style={rowCategoryEditStyle}>{importRowCategoryEditLabel(expanded)}</Text>");
  });

  it("잠금 카드는 한 덩어리로 읽히므로 분류를 라벨 문자열에 싣는다", () => {
    const src = importSource();
    const lockedLabel = /accessibilityLabel=\{`\$\{IMPORT_ROW_LOCKED_A11Y_PREFIX\}[^`]*`\}/.exec(src)?.[0] ?? "";
    expect(lockedLabel, "잠금 카드 라벨").toContain("${importRowCategoryA11ySuffix(category)}");
    // 잠긴 이유는 여전히 라벨의 마지막에 온다(라운드 41 K-1의 그 문장 — 분류가 끼어들어
    // "왜 못 고르는지"를 밀어내지 않는다).
    expect(lockedLabel.endsWith("${IMPORT_ROW_LOCKED_MESSAGE}`}"), "잠금 사유가 마지막이다").toBe(true);
  });

  it("칩은 공유 CategoryChip이라 selected 상태가 그대로 낭독된다 (새 픽커를 만들지 않는다)", () => {
    const chipTag = openingTagAfter(importSource(), "{options.map((option) => (", "<CategoryChip");
    expect(chipTag).toContain("selected={option.id === row.categoryId}");
    // 선택 상태의 낭독은 프리미티브가 진다(src/ui.tsx의 accessibilityState) — 화면이 다시 적지 않는다.
    expect(chipTag).not.toContain("accessibilityState");
  });
});

/**
 * GAP-065 #4·#5 — **SET-003 동의 카드에 처음으로 생긴 컨트롤 셋.**
 *
 * 종전 이 카드는 읽기 전용 상태 줄뿐이었다. 이제 셋이 선다: 필수 재동의 버튼(미동의일 때만) ·
 * 선택 동의 스위치 · 약관 [보기] 링크. 셋 다 **화면 전환 없이** 상태가 바뀌거나 앱 밖으로
 * 나가는 자리라, 소리로만 쓰는 사람에게 사실이 도달할 길을 따로 실어야 한다.
 *
 * 값·게이트 계약(언제 뜨는가·무엇을 보내는가)은 consent-summary.test.ts · legal-links.test.ts가
 * 이미 진다. 여기가 붙드는 것은 **라벨과 낭독**이다.
 */
describe("GAP-065 #4·#5 SET-003 동의 카드의 낭독 계약", () => {
  const privacySource = () => source("app/settings/privacy.tsx");

  it("선택 동의 스위치의 라벨이 **보이는 제목과 같은 한 값**이다", () => {
    const src = privacySource();
    const switchTag = openingTagAfter(src, "{consentToggles.map((definition) => (", "<Switch");
    expect(switchTag).toContain("accessibilityLabel={definition.title}");
    expect(switchTag).toContain('accessibilityRole="switch"');
    // 켜짐/꺼짐은 value가 진다 — 문구로 다시 말하지 않는다(같은 사실을 두 번 읽지 않는다).
    expect(switchTag).toContain("value={consentToggleValue(definition)}");
    // 바로 위 줄이 눈으로 읽는 같은 제목이다(라벨을 여기서 새로 짓지 않는다).
    expect(src).toContain("<Text style={consentTitleStyle}>{definition.title}</Text>");
  });

  it("재동의 성공이 낭독된다 — 카드가 조용히 사라지는 자리다", () => {
    const src = privacySource();
    expect(src).toContain("announceForA11y(CONSENT_REQUIRED_DONE_NOTICE);");
    // 성공하면 미동의 항목이 없어져 버튼·안내가 통째로 사라진다. 화면 전환이 없으므로
    // announce가 없으면 소리로만 쓰는 사람에게는 아무 일도 일어나지 않은 것과 같다
    // (구매 확인 프롬프트 A-2 #14와 같은 근거).
    expect(src).toContain("{pendingRequired.length > 0 ? (");
  });

  it("[보기] 링크가 **어느 문서인지**를 말한다 (글자는 \"보기\" 두 자뿐이다)", () => {
    const src = privacySource();
    expect(src).toContain("accessibilityLabel={`${line.title} 전문 보기`}");
    expect(src).toContain('accessibilityRole="link"');
    // 로그인 화면의 같은 링크와 한 벌이다 — 두 자리가 다른 말을 하지 않는다.
    expect(source("app/(auth)/login.tsx")).toContain("accessibilityLabel={`${label} 전문 보기`}");
  });
});

/**
 * GAP-065 #8 — **아이 날짜 칸에 새로 선 달력 버튼.**
 *
 * 아이콘 하나뿐인 버튼이라 라벨이 없으면 낭독할 것이 없고(A-1 `Screen-reader labels`),
 * 눌러서 펼치는 컨트롤이라 상태가 없으면 "지금 열려 있는가"를 소리로 알 길이 없다.
 * 두 화면(ONB-002 · SET-005)이 **같은 문법**을 쓰는지도 함께 본다 — 같은 일을 하는 버튼이
 * 자리마다 다른 말을 하면 학습되지 않는다.
 *
 * 칸 라벨의 "왜 못 고르는지"가 방향별 두 문장으로 갈린 것은 위 GAP-061 #8 블록이 이미 붙들었다
 * (라운드 65 D가 그 계약을 갱신했다). 여기서는 되풀이하지 않는다.
 */
describe("GAP-065 #8 아이 생년월일·예정일 달력 버튼의 낭독 계약", () => {
  const dateScreens = ["app/(onboarding)/child-profile.tsx", "app/settings/children.tsx"] as const;

  /** 달력 버튼의 여는 태그. 라벨 문구에서 위로 거슬러 그 `<Pressable`을 찾는다. */
  function calendarButtonBlock(path: string): string {
    const screenSource = source(path);
    const labelAt = screenSource.indexOf("달력에서 고르기");
    if (labelAt < 0) throw new Error(`${path}에 달력 버튼이 없다`);
    const start = screenSource.lastIndexOf("<Pressable", labelAt);
    if (start < 0) throw new Error(`${path}의 달력 버튼이 Pressable이 아니다`);
    return screenSource.slice(start, labelAt + 400);
  }

  it("두 화면 모두 라벨 + button 역할 + expanded 상태를 단다", () => {
    for (const path of dateScreens) {
      const buttonBlock = calendarButtonBlock(path);
      expect(buttonBlock, path).toContain('accessibilityRole="button"');
      expect(buttonBlock, path).toMatch(/accessibilityState=\{\{ expanded: \w+ \}\}/);
    }
  });

  it("라벨이 **어느 날짜 칸인지**를 말한다 — 두 화면이 같은 문법을 쓴다", () => {
    for (const path of dateScreens) {
      // `${dateLabel} 달력에서 고르기` — 이름(출산 예정일/출생일)은 requiredDateFieldLabel이
      // 한 곳에서 정한다(화면이 "예정일"·"생년월일"을 새로 짓지 않는다).
      expect(source(path), path).toMatch(/accessibilityLabel=\{`\$\{\w+\} 달력에서 고르기`\}/);
    }
  });

  it("손타이핑 칸은 그대로 남는다 — 달력이 대체가 아니라 대안이다", () => {
    for (const path of dateScreens) {
      const src = source(path);
      expect(src, path).toContain('placeholder="YYYY-MM-DD"');
      expect(src, path).toMatch(/accessibilityLabel=\{`\$\{\w+\} 입력`\}/);
    }
  });
});

/**
 * GAP-066 #2 — **월 선택 시트**(달 라벨 → 시트)의 낭독 계약.
 *
 * 트랙 A는 판정 쪽을 이미 고정했다: 어느 달을 고를 수 있는가·칸 라벨 문자열은
 * `src/month-jump.test.ts`가, 두 탭이 트리거와 시트를 한 벌씩 붙였는가는
 * `src/reports/month-end-review-flow.test.ts`가 진다. 여기서 보는 것은 그 산출이 **낭독되는
 * 자리에 실제로 걸려 있는가** 하나다(GAP-062 #10이 세운 관례) — 값을 다시 단언하지 않는다.
 *
 * 이 시트에서만 새로 생기는 두 자리를 붙든다.
 *  1. **연도 스테퍼**: 글자가 없는 아이콘 버튼 둘이라, 라벨이 없으면 "버튼"으로만 읽힌다.
 *     잠긴 방향은 `accessibilityState`로 갈려야 한다(비활성을 투명도로만 말하면 소리로는
 *     아무 차이가 없다).
 *  2. **못 고르는 칸**: `Pressable disabled`가 아니라 `View`다. disabled 버튼은 "버튼, 비활성"
 *     으로만 읽혀 **왜** 못 누르는지가 남는데, 이 시트는 이유를 라벨로 말한다(달력 픽커
 *     A-2 #10 · A-4 #23이 세운 그 규율). 이유 문장은 화면이 짓지 않는다 — 순수 모듈이 준다.
 */
describe("GAP-066 #2 달 점프 시트의 낭독 계약", () => {
  const sheetSource = source("src/MonthJumpSheet.tsx");

  it("연도 스테퍼 두 버튼은 라벨 + button 역할 + disabled 상태를 단다 (아이콘만 있는 버튼이다)", () => {
    for (const label of ["이전 연도", "다음 연도"]) {
      expect(sheetSource, label).toContain(`accessibilityLabel="${label}"`);
    }
    expect(sheetSource.match(/accessibilityRole="button"/g) ?? []).not.toHaveLength(0);
    expect(sheetSource).toContain("accessibilityState={{ disabled: !view.canGoPreviousYear }}");
    expect(sheetSource).toContain("accessibilityState={{ disabled: !view.canGoNextYear }}");
    // 잠금이 투명도로만 표현되지 않는다: 실제로 눌리지 않는 버튼이어야 상태 낭독이 참이다.
    expect(sheetSource).toContain("disabled={!view.canGoPreviousYear}");
    expect(sheetSource).toContain("disabled={!view.canGoNextYear}");
  });

  it("못 고르는 칸은 disabled 버튼이 아니라 라벨을 가진 View다 (왜 못 누르는지가 남지 않게)", () => {
    // 비선택 칸: accessible한 View 하나 + 순수 모듈이 준 라벨(이유 포함).
    expect(sheetSource).toContain("if (!cell.isSelectable) {");
    expect(sheetSource).toContain("<View accessible accessibilityLabel={cell.accessibilityLabel}");
    // 칸에는 disabled가 붙지 않는다 — 이 파일의 disabled는 연도 스테퍼 두 자리뿐이다.
    expect(sheetSource.match(/disabled=\{/g) ?? []).toHaveLength(2);
    // 고를 수 있는 칸은 button 역할 + selected 상태를 진다(칩·타일의 기존 문법 그대로).
    expect(sheetSource).toContain("accessibilityState={{ selected: cell.isSelected }}");
    expect(sheetSource).toContain("accessibilityLabel={cell.accessibilityLabel}");
  });

  it("문구를 화면이 짓지 않는다 — 이유·제목·안내는 전부 순수 모듈 상수다", () => {
    for (const constantName of [
      "MONTH_JUMP_SHEET_TITLE",
      "MONTH_JUMP_HINT",
      "MONTH_JUMP_CLOSE_LABEL"
    ]) {
      expect(sheetSource, constantName).toContain(constantName);
    }
    // "왜 못 고르는지"의 문장이 이 파일에 리터럴로 없다(있으면 두 곳이 갈린다 — 라운드 65 D가
    // 달력 픽커에서 세운 규율: 화면이 방향에 따라 문장을 고르지 않는다).
    expect(sheetSource).not.toContain("고를 수 없어요");
    expect(sheetSource).not.toContain("달 선택");
  });

  it("두 탭의 달 라벨 트리거가 button 역할을 단다 (감싸기만 해도 역할은 새로 생긴다)", () => {
    for (const path of ["app/(tabs)/records.tsx", "app/(tabs)/reports.tsx"]) {
      const screenSource = source(path);
      const triggerAt = screenSource.indexOf("month-jump-trigger");
      if (triggerAt < 0) throw new Error(`${path}에 달 점프 트리거가 없다`);
      const start = screenSource.lastIndexOf("<Pressable", triggerAt);
      if (start < 0) throw new Error(`${path}의 달 라벨이 Pressable로 감싸이지 않았다`);
      const triggerBlock = screenSource.slice(start, triggerAt);
      expect(triggerBlock, path).toContain('accessibilityRole="button"');
      expect(triggerBlock, path).toContain("monthJumpTriggerAccessibilityLabel(");
    }
  });

  /**
   * 라운드 67 트랙 C(#5) — 세 번째 트리거는 **화면이 아니라 공용 카드**에 선다
   * (src/export/ExpenseCsvExport.tsx를 더보기 탭·설정 두 화면이 함께 쓴다). 문법은 두 탭과 같아야
   * 하고, 이 자리에서만 생기는 사실 하나를 더 붙든다: **어느 쪽 달인지**가 라벨에 남는가
   * ("2026년 8월, 달 선택"만 들으면 시작인지 끝인지 알 수 없다 — 스테퍼가 이미 지고 있던 사실이다).
   */
  it("라운드 67 트랙 C(#5): 내보내기의 두 달 라벨도 같은 트리거 문법을 단다", () => {
    const cardSource = source("src/export/ExpenseCsvExport.tsx");
    const triggerAt = cardSource.indexOf("month-jump-trigger");
    if (triggerAt < 0) throw new Error("내보내기 카드에 달 점프 트리거가 없다");
    const start = cardSource.lastIndexOf("<Pressable", triggerAt);
    if (start < 0) throw new Error("내보내기 카드의 달 라벨이 Pressable로 감싸이지 않았다");
    const triggerBlock = cardSource.slice(start, triggerAt);
    expect(triggerBlock).toContain('accessibilityRole="button"');
    expect(triggerBlock).toContain("MONTH_JUMP_TRIGGER_HINT");
    // 시작/끝 라벨이 트리거 문장 앞에 남는다(단일 소스는 순수 모듈의 조립 함수다).
    expect(triggerBlock).toContain("monthJumpTriggerAccessibilityLabel(`${label} ${monthLabel}`)");
    // 시트 아래 한 줄도 화면이 짓지 않는다 — 이 화면은 달로 "이동"하지 않으므로 자기 문장을
    // 순수 모듈(src/export/export-range.ts)에서 받아 넘긴다.
    expect(cardSource).toContain("hint={EXPORT_MONTH_JUMP_HINT}");
  });
});

/**
 * GAP-066 #8 — **지난달 정리** 알림 한 줄의 낭독 계약.
 *
 * 트랙 E는 발화 규칙·목적지·설정 스위치를 `src/notifications/monthly-wrapup.test.ts`에 고정했다.
 * 여기서 보는 것은 그 행이 **소리로 어떻게 도달하는가**다. 알림함의 행은 종류를 아이콘 하나로
 * 구분하는데(달력 계열), 그 아이콘은 공용 `ListRow`째 접근성 트리에서 감춰진 하위 트리 안에
 * 있다 — 즉 **종류는 소리로 전달되지 않는다.** 그래서 이 알림이 말하는 사실(어느 달·얼마)은
 * 아이콘이 아니라 **제목과 본문 글자**가 져야 하고, 그 조립은 여섯 종과 같은 한 벌이다.
 */
describe("GAP-066 #8 지난달 정리 알림 행의 낭독 계약", () => {
  const notificationsScreen = source("app/notifications.tsx");
  /** 2026-08-03(월) KST — 7월이 막 끝난 시점. 서울 오프셋은 도메인 상수에서 온다. */
  const nowMs = Date.UTC(2026, 7, 3, 12) - SEOUL_UTC_OFFSET_MS;
  const wrapup = monthlyWrapupNotification({
    childId: "child-1",
    now: nowMs,
    lastMonthRecords: [
      { amountKrw: 84_200, spentOn: "2026-07-02", expenseType: "expense" },
      { amountKrw: 1_161_500, spentOn: "2026-07-28", expenseType: "expense" }
    ]
  });

  it("종류 아이콘은 감춰진 하위 트리 안에 있다 — 소리로 종류를 나르는 것은 글자뿐이다", () => {
    const hiddenAt = notificationsScreen.indexOf(
      '<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"'
    );
    const iconAt = notificationsScreen.indexOf("<Ionicons name={iconName}");
    expect(hiddenAt).toBeGreaterThan(-1);
    expect(iconAt).toBeGreaterThan(hiddenAt);
  });

  it("행 라벨 조립에 종류가 끼어들지 않는다 — 일곱 종이 같은 한 벌을 지난다", () => {
    const labelAt = notificationsScreen.indexOf("accessibilityLabel={notificationRowAccessibilityLabel({");
    expect(labelAt).toBeGreaterThan(-1);
    const labelBlock = notificationsScreen.slice(labelAt, labelAt + 200);
    // 종류별 분기가 라벨에 들어오는 순간 "이 종류만 다르게 읽히는" 자리가 생긴다.
    expect(labelBlock).not.toContain("entry.type");
    expect(labelBlock).toContain("title: rowTitle");
    expect(labelBlock).toContain("body: entry.body");
    expect(labelBlock).toContain("timeLabel");
  });

  it("그래서 그 행은 라벨만으로 어느 달·얼마인지 들린다 (다자녀 태명 접두도 같은 한 벌)", () => {
    if (!wrapup) throw new Error("지난달 정리 후보가 만들어지지 않았다");
    const spoken = notificationRowAccessibilityLabel({
      title: formatNotificationRowTitle(wrapup.title, "다온"),
      body: wrapup.body,
      timeLabel: "방금"
    });
    expect(spoken).toContain("다온");
    expect(spoken).toContain("7월");
    expect(spoken).toContain("1,245,700원");
    expect(spoken).toContain("방금");
    // 1아이 계정에서는 접두가 없고 제목이 종전 그대로 낭독된다(태명 판정은 재사용만 한다).
    expect(notificationRowAccessibilityLabel({ title: formatNotificationRowTitle(wrapup.title, null), body: wrapup.body, timeLabel: "방금" })).toBe(
      `${wrapup.title}, ${wrapup.body}, 방금`
    );
  });
});
