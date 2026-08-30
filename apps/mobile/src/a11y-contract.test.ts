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
// GAP-069 #1·#3: 이번 라운드가 만든 새 문장 둘. **값을 여기서 다시 단언하지 않는다** — 비교에
// 쓰는 문자열까지 전부 이 두 모듈에서 오므로, 트랙 A·C가 문구를 다듬어도 이 파일은 그대로다.
import { STAGE_BAND_UNRESOLVED_NOTICE } from "./items/stage-bands";
import { logoutConfirmMessage } from "./offline/messages";
// GAP-079 트랙 A(#1): 저장 실패 낭독 스윕의 모집단은 **대장에서 파생**한다 — 손 목록이 아니라
// `src/offline/offline-aware-screens.ts`의 그 배열이라, 대장에 화면이 하나 늘면 그 화면도
// 자동으로 "그 문장이 소리로 오는가"를 받는다(읽기만 — 이 트랙은 대장을 한 줄도 고치지 않는다).
import { OFFLINE_AWARE_LOAD_ERROR_SCREENS, OFFLINE_AWARE_SAVE_ERROR_SCREENS } from "./offline/offline-aware-screens";
// GAP-070 트랙 E(A·B·C가 만든 새 문구): 값·문구 계약은 각 트랙의 모듈 테스트가 진다. 여기서는
// **그 문장이 낭독되는 자리에 걸려 있는가**만 보므로, 비교에 쓰는 문자열까지 전부 모듈에서
// 읽어 온다 — 트랙이 문구를 다듬어도 이 파일은 그대로다(라운드 66~69의 형식).
import {
  INVITE_UNAVAILABLE_DETAIL,
  INVITE_UNAVAILABLE_ESCAPE_LABEL,
  INVITE_UNAVAILABLE_NEXT_STEP,
  INVITE_UNAVAILABLE_TITLE
} from "./family/invite-accept-messages";
import { INVITE_ROLE_CHOICES, INVITE_SCOPE_NOTICE } from "./family/invite-flow";
import { BUDGET_VIEW_ONLY_MESSAGE } from "./family/record-permissions";
// GAP-071 트랙 E(A·B·C·D가 만든 새 UI): 값·문구 계약은 각 트랙의 모듈 테스트가 진다. 여기서는
// **그 문장이 낭독되는 자리에 걸려 있는가**만 보므로, 비교에 쓰는 문자열까지 전부 모듈에서
// 읽어 온다 — 트랙이 문구를 다듬어도 이 파일은 그대로다(라운드 66~70의 형식).
import {
  IMPORT_CONFIRM_FAILED_MESSAGE,
  IMPORT_FORBIDDEN_MESSAGE,
  IMPORT_ROW_EDIT_FAILED_MESSAGE,
  IMPORT_UPLOAD_FAILED_MESSAGE
} from "./import/import-failure-messages";
import { CONSENT_UPDATE_FAILED_MESSAGE, DESTRUCTIVE_ACTION_FAILED_MESSAGE } from "./settings/destructive-flow-messages";
import {
  SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE,
  SELECTED_CHILD_RECOVERY_ERROR_NOTICE
} from "./onboarding/selected-child-recovery";
import { SUPPORT_LINK_FAILED_MESSAGE, SUPPORT_LINK_LABELS } from "./settings/support-links";
// GAP-070 트랙 E: ONB-001 세 카드의 **문구·순서**는 이 순수 모듈이 이미 거울로 들고 있다
// ("mirroring the onboarding ONB-001 option titles"). 그래서 이 파일은 카드 문구를 다시 적지
// 않고 그 거울과 대조한다 — 문구가 바뀌면 두 자리 중 하나가 아니라 **둘 다** 움직여야 한다.
import { CHILD_STAGE_MODE_OPTIONS } from "./children/child-form";
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
    // 라운드 68 B(#6): 그 계산 앞에 낭독 전용 문장 슬롯이 하나 붙었다(`a11yLabel`) -- 채우지
    // 않는 행(기존 일곱 · 비로그인 미리보기)의 낭독은 종전과 한 글자도 같다.
    expect(moreSource).toContain("accessibilityLabel={a11yLabel ?? (caption ? `${title}, ${caption}` : title)}");
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
    /**
     * ⚠️ 라운드 71 트랙 E — **버튼 단언을 새 계약으로 교체한다.**
     *
     * 종전 단언(`"<SecondaryButton label={actionLabel}"`)은 "액션 라벨이 버튼에 실린다"까지만
     * 물었고, 그래서 **`onPress`가 없어도 버튼이 그려진다**는 사실을 통과시켰다. 소리로만 앱을
     * 쓰는 사람에게 `accessibilityRole="button"` 낭독은 그 자체가 약속이고, 눌러도 아무 일도
     * 일어나지 않으면 그 약속이 깨진다. 이제 묻는 것은 **짝**이다 — 값이 도달하는가가 아니라,
     * 도달할 수 없는 상태가 애초에 만들어지지 않는가.
     */
    expect(emptyCard.slice(0, 900), "onPress가 없으면 버튼을 그리지 않는다").toContain(
      "{onPress && actionLabel ? <SecondaryButton label={actionLabel} onPress={onPress} /> : null}"
    );
  });
});

/**
 * GAP-071 #5(트랙 E) — **낭독되는 버튼은 반드시 눌리는 버튼이다** (`EmptyStateCard`).
 *
 * 이 저장소는 라운드마다 "눌러도 아무 일도 없는 버튼"을 한두 자리씩 손으로 걷어내 왔고
 * (MOB-119 · UX-Q(B) — 그 주석은 자기가 마지막이라고 적었는데 넷이 더 살아 있었다), 그때마다
 * 같은 자리가 다시 생겼다. 원인이 호출부가 아니라 **컴포넌트가 그것을 허용한다는 사실**이기
 * 때문이다. 그래서 이번 계약은 호출부를 세지 않고 **타입과 렌더**를 붙든다 —
 * `AffiliateDisclosure`의 `text`를 필수로 만든 라운드 43 리뷰 M-1이 같은 판단이었다.
 *
 * 접근성 쪽에서 이것이 값 계약이 아니라 낭독 계약인 이유: TalkBack은 이 노드를 "…, 버튼"으로
 * 읽는다. 눈으로 보는 사람은 눌러 보고 아무 일도 없다는 것을 곧 알지만, 소리로만 쓰는 사람에게는
 * **그 낭독이 유일한 정보**라 화면이 멈춘 것인지 자기가 잘못 누른 것인지 끝내 알 수 없다.
 */
describe("GAP-071 #5 EmptyStateCard의 actionLabel↔onPress 짝 (가짜 버튼 재발 금지)", () => {
  const uiSource = () => source("src/ui.tsx");
  const emptyCardBlock = () => {
    const src = uiSource();
    const at = src.indexOf("export type EmptyStateCardProps");
    expect(at, "EmptyStateCard의 타입 선언").toBeGreaterThan(-1);
    return src.slice(at, src.indexOf("export function Toast(", at));
  };

  it("타입이 짝을 강제한다 — 라벨만 넘기는 호출부는 컴파일되지 않는다", () => {
    const block = emptyCardBlock();
    // 판별 합집합: 액션은 둘 다 있거나 둘 다 없다. `onPress?: () => void`(선택 인자)로
    // 되돌아가면 이 단언이 깨진다.
    expect(block, "액션이 있는 갈래").toContain("{ actionLabel: string; onPress: () => void }");
    expect(block, "액션이 없는 갈래").toContain("{ actionLabel?: undefined; onPress?: undefined }");
    expect(block, "라벨만 있는 옛 시그니처").not.toContain("actionLabel: string; onPress?: () => void");
  });

  it("렌더도 같은 짝을 지킨다 — 타입을 우회해도 낭독되는 가짜 버튼이 서지 않는다", () => {
    const block = emptyCardBlock();
    // 라운드 71 리뷰 S-9: 위 한 줄이 렌더 형태를 통째로 고정하므로 "무조건 그리던 옛 렌더"를
    // 다시 부정하던 줄은 지웠다 — 그 줄은 같은 사실을 두 번 말하면서 판정이 **줄바꿈 한 글자**에
    // 걸려 있었다(같은 코드를 포매터가 한 줄 접기만 해도 통과하거나 빨개진다).
    expect(block, "onPress가 없으면 버튼 노드 자체가 없다").toContain(
      "{onPress && actionLabel ? <SecondaryButton label={actionLabel} onPress={onPress} /> : null}"
    );
  });

  /**
   * 정찰이 센 **살아 있는 가짜 버튼 넷**. 전부 `!hasSession` 카드였고, "로그인 후 이용할 수
   * 있어요"라고 말하면서 로그인으로 가는 길을 주지 않았다. 카드 문구는 종전 그대로이고
   * 더해진 것은 **목적지 하나**다.
   */
  it("정찰이 센 네 자리는 이제 실제로 갈 곳을 준다 (문구는 종전 그대로)", () => {
    const withDestination = [
      "app/settings/app-lock.tsx",
      "app/settings/children.tsx",
      "app/settings/notifications.tsx",
      "app/expenses/recurring.tsx"
    ];
    for (const path of withDestination) {
      const src = source(path);
      expect(src, `${path}의 비세션 카드`).toContain('actionLabel="확인"');
      expect(src, `${path}의 목적지`).toMatch(/onPress=\{\(\) => router\.push\([^)]*"\/login"\)\}/);
    }
    // 카드 문구는 한 글자도 바뀌지 않았다.
    for (const path of ["app/settings/app-lock.tsx", "app/settings/children.tsx", "app/settings/notifications.tsx"]) {
      expect(source(path), `${path}의 카드 제목`).toContain('title="로그인 후 이용할 수 있어요."');
    }
    expect(source("app/expenses/recurring.tsx"), "정기 지출 카드 제목").toContain(
      'title="로그인하고 아이를 선택하면 정기 지출을 적어 둘 수 있어요."'
    );
  });

  /**
   * 파생 단언 — **호출부 전량**을 훑어 라벨만 넘기는 자리가 하나도 없는지 본다. 타입이 이미
   * 막지만, 이 단언은 "그 타입이 실제로 이 컴포넌트에 걸려 있는가"까지 함께 지킨다(다른
   * `EmptyStateCard`를 import한 화면이 섞이면 타입 검사만으로는 조용히 통과한다).
   */
  it("src/ui.tsx의 EmptyStateCard를 쓰는 호출부에 라벨만 있는 자리가 없다", () => {
    const callers = listComponentSources().filter((path) => {
      const src = source(path);
      return /from "(\.\.\/)*(src\/)?ui"/.test(src) && src.includes("EmptyStateCard");
    });
    expect(callers.length, "호출부 스캔이 실제로 무언가를 찾았다").toBeGreaterThanOrEqual(10);

    const fakeButtons: string[] = [];
    for (const path of callers) {
      const src = source(path);
      // `<EmptyStateCard …/>` 한 덩어리씩 읽어 actionLabel과 onPress가 함께 있는지 본다.
      for (const match of src.matchAll(/<EmptyStateCard\b[\s\S]*?\/>/g)) {
        const tag = match[0];
        if (tag.includes("actionLabel") && !tag.includes("onPress")) fakeButtons.push(`${path}: ${tag.slice(0, 80)}`);
      }
    }
    expect(fakeButtons, `라벨만 있고 목적지가 없는 카드: ${fakeButtons.join(" | ")}`).toEqual([]);
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
    // 라운드 68 E(#9): 달력 칸을 그리는 뷰가 app/(tabs)/records.tsx에서
    // src/expenses/RecordsCalendar.tsx로 **그대로 옮겨졌다**(순수 이동). 단언의 뜻은 그대로이고
    // 읽는 자리만 그 뷰로 따라간다.
    const calendarViewSource = source("src/expenses/RecordsCalendar.tsx");
    expect(calendarViewSource).toContain("const action = resolveCalendarCellAction(cell);");
    expect(calendarViewSource).toContain(
      "const accessibilityLabel = calendarCellAccessibilityLabel(cell, { filterLabel }) ?? undefined;"
    );
    expect(calendarViewSource).toContain("<View accessible accessibilityLabel={accessibilityLabel} style={cellStyle}>");
    expect(calendarViewSource).toContain(
      'onPress={() => (action === "record-new" ? onRecordForDate(date) : onSelectDate(date))}'
    );
  });

  it("달력 범례가 새 목적지 둘을 말하고, 화면이 그 문장을 다시 적지 않는다", () => {
    // 음영만으로는 색일 뿐이고, 이제 "누르면 무엇이 되는가"가 칸마다 둘로 갈린다.
    expect(CALENDAR_LEGEND_TEXT).toContain("그날 기록으로 이동");
    expect(CALENDAR_LEGEND_TEXT).toContain("그날로 기록");
    // 라운드 68 E(#9): 범례를 그리는 자리도 뷰 모듈로 옮겨졌다(순수 이동). "화면이 그 문장을
    // 다시 적지 않는다"는 부정 단언은 화면·뷰 **양쪽**에 건다 — 옮기면서 문구가 새로 생기지
    // 않았는지가 그 단언의 뜻이다.
    const recordsSource = source("app/(tabs)/records.tsx");
    const calendarViewSource = source("src/expenses/RecordsCalendar.tsx");
    expect(calendarViewSource).toContain("<Text style={calendarLegendStyle}>{calendarLegendText(filterLabel)}</Text>");
    expect(recordsSource).not.toContain("색이 진할수록");
    expect(calendarViewSource).not.toContain("색이 진할수록");
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

/**
 * GAP-067 #2 — **끝난 빈 달**의 액션이 소리로도 일어나는가.
 *
 * 트랙 A는 문구·판정(`buildRecordsEmptyMonthState`)과 화면의 키 배선을
 * `src/expenses/records-list-view.test.ts`에 고정했다. 여기서 보는 것은 그 배선이 만드는
 * **낭독**이다. 이 카드의 첫 갈래([달력에서 날짜 고르기])는 눌러도 **화면이 바뀌지 않는다** —
 * 같은 자리에 같은 카드가 서 있고 액션 라벨만 "이번 달 보기"로 바뀐다. 눈으로는 리스트가
 * 달력으로 바뀐 것이 보이지만, 소리로만 쓰는 사람에게는 **아무 일도 일어나지 않은 것과 같다**
 * (구매 확인 프롬프트 A-2 #14 · 아이 추가 성공 안내 A-4 #26이 announce를 붙인 그 근거).
 *
 * 그리고 그 announce가 **새 문구를 짓지 않는다**는 것이 두 번째 계약이다: 읽어 주는 문장은
 * 세그먼트 컨트롤이 이미 쓰는 옵션 이름 그대로다(화면에 새 문자열이 늘면 세그먼트가 말하는
 * 것과 announce가 말하는 것이 갈릴 자리가 생긴다).
 */
describe("GAP-067 #2 끝난 빈 달 카드의 낭독 계약", () => {
  const recordsScreen = source("app/(tabs)/records.tsx");

  it("달력으로 바뀌는 갈래는 announce를 남긴다 (화면 전환이 없는 자리라 침묵하면 안 된다)", () => {
    const branchAt = recordsScreen.indexOf('if (emptyMonthState.action === "open-calendar") {');
    expect(branchAt).toBeGreaterThan(-1);
    const branchBlock = recordsScreen.slice(branchAt, branchAt + 400);
    expect(branchBlock).toContain("setViewMode(RECORDS_VIEW_CALENDAR);");
    expect(branchBlock).toContain("announceForA11y(RECORDS_VIEW_CALENDAR);");
    // 순서도 계약이다 — 보기 모드를 바꾼 **뒤에** 그 사실을 말한다.
    expect(branchBlock.indexOf("setViewMode(")).toBeLessThan(branchBlock.indexOf("announceForA11y("));
  });

  it("announce가 새 문구를 짓지 않는다 (세그먼트가 쓰는 옵션 이름 그대로다)", () => {
    // 옵션 이름은 이 화면의 상수 한 자리에서 온다(리터럴을 다시 적지 않는다).
    expect(recordsScreen).toContain('const RECORDS_VIEW_CALENDAR = "달력"');
    expect(recordsScreen).not.toContain('announceForA11y("달력');
    expect(recordsScreen).not.toContain("달력 보기로 바꿨어요");
  });

  it("빈 달·검색 0건 카드의 두 보조 액션이 같은 문법으로 낭독된다", () => {
    // 두 버튼 모두 라벨은 보이는 글자, 낭독 문장은 순수 모듈의 조립이다(한쪽만 다른 문법이면
    // 나란히 선 두 버튼이 서로 다른 말을 한다).
    expect(recordsScreen).toContain("accessibilityLabel={previousMonthSearchAction.accessibilityLabel}");
    expect(recordsScreen).toContain("accessibilityLabel={monthJumpSearchAction.accessibilityLabel}");
    // 카드 제목·액션 라벨도 화면이 짓지 않는다(문구 리터럴 0건 — 판정은 순수 모듈이 진다).
    expect(recordsScreen).not.toContain("에는 기록이 없어요.");
    expect(recordsScreen).not.toContain("달력에서 날짜 고르기");
    expect(recordsScreen).not.toContain("다른 달에서 찾기");
  });
});

/**
 * GAP-067 #3 — **되돌리기 결과 카드**가 소리로 도달하는가.
 *
 * 트랙 E는 문구·건수·무효화 목록을 `src/import/import-resume.test.ts`에 고정했다. 여기서 보는
 * 것은 그 문구가 **낭독되는 자리에 실제로 걸려 있는가**다(GAP-062 #10이 세운 관례).
 *
 * 이 카드는 한 줄에 **누르는 자리가 둘**이다 — 카드 본문(그 잡의 결과로 이동)과 [되돌리기]
 * (파괴적 일괄 동작). 소리로만 쓰는 사람에게 그 둘이 갈리지 않으면 "결과를 보러" 누른 손이
 * 200건을 지우는 버튼에 닿는다. 그래서 ⓐ 두 자리가 각각 라벨을 지고, ⓑ 되돌리기 라벨은
 * **무엇을** 되돌리는지(파일명)까지 말하며, ⓒ 진행 중에는 `accessibilityState.disabled`가
 * 실제 `disabled`와 함께 걸린다(투명도만으로는 소리에 아무것도 남지 않는다 — 달 점프 시트의
 * 연도 스테퍼 A-7 #35와 같은 판정).
 *
 * Alert 쪽은 이 파일이 붙들 것이 없다: RN Alert에는 라벨도 상태도 걸리지 않아 낭독되는 것은
 * **버튼 글자와 본문뿐**이고(A-3 #18 · A-7 #37), 그 문자열은 트랙 E의 모듈 테스트가 진다.
 */
describe("GAP-067 #3 가져오기 되돌리기 카드의 낭독 계약", () => {
  const uploadScreen = source("app/import/index.tsx");
  // 라운드 67 적대 리뷰 #1: 저장본이 검토 칸·확정 칸으로 나뉘면서 두 카드가 **함께** 설 수
  // 있게 됐다(이어서 보기 카드의 조건에서 `&& !undoCard`가 빠졌다). 잘라 내는 경계만 그
  // 사실을 따라간다 — 보는 대상은 종전과 같은 결과 카드 블록이다.
  const undoCardBlock = uploadScreen.slice(
    uploadScreen.indexOf("{undoCard ? ("),
    uploadScreen.indexOf("{resumeCard ? (")
  );

  it("한 줄의 누르는 자리 둘이 각각 라벨을 진다 (결과 보기 ↔ 되돌리기)", () => {
    expect(undoCardBlock.length).toBeGreaterThan(0);
    expect(undoCardBlock).toContain("accessibilityLabel={importUndoCardAccessibilityLabel(undoCard, now)}");
    expect(undoCardBlock).toContain("accessibilityLabel={importUndoActionAccessibilityLabel(undoCard)}");
    // 둘 다 button 역할이다(카드 본문은 Pressable로 감싼 두 줄짜리 텍스트다).
    expect((undoCardBlock.match(/accessibilityRole="button"/g) ?? []).length).toBe(2);
    // 라벨 문자열을 화면이 조립하지 않는다 — 단일 소스는 순수 모듈이다.
    expect(undoCardBlock).not.toContain("방금 가져온 결과.");
    expect(undoCardBlock).not.toContain("건 ·");
  });

  it("되돌리는 동안은 disabled 상태가 소리로도 갈린다 (투명도만으로는 남지 않는다)", () => {
    expect(undoCardBlock).toContain("accessibilityState={{ disabled: undo.isPending }}");
    // 상태 낭독이 참이 되려면 실제로 눌리지 않아야 한다.
    expect(undoCardBlock).toContain("disabled={undo.isPending}");
  });

  it("카드의 종류 아이콘은 접근성 트리에서 빠진다 (사실을 나르는 것은 글자다)", () => {
    // 알림 행(A-7 #38)과 같은 판정 — 아이콘은 종류를 눈으로만 구분하고, 낭독되는 문장은
    // 제목·부제를 조립한 라벨 한 벌이다.
    expect(undoCardBlock).toContain('<View accessible={false} style={styles.fileIcon}>');
    const iconAt = undoCardBlock.indexOf("<Ionicons");
    expect(iconAt).toBeGreaterThan(-1);
    // 아이콘 자신도 트리에서 빠진다(감싼 View만 빼면 하위 노드가 남는 플랫폼이 있다).
    expect(undoCardBlock.slice(iconAt, iconAt + 200)).toContain("accessible={false}");
  });
});

/* ------------------------------------------------------------------ 라운드 69 (GAP-069 #5) */

/**
 * GAP-069 #5 — **엑셀 업로드 화면의 뒤로가기**가 마지막 남은 44dp였다.
 *
 * `styles.backButton`이 32×32인데 `hitSlop`이 6이라 32 + 2×6 = 44 — 이 저장소가 스스로 못박은
 * 최소 타깃(`theme.touchTarget` = 48, DSN-053 토큰 표)에 미달이었다. 같은 역할의 다른 버튼들은
 * 이미 48이다(커머스 상세 34 + `PRODUCT_DETAIL_CHROME_HIT_SLOP` 7 · 가족 화면 12 · 리포트
 * 화살표는 `theme.touchTarget`을 통째로 쓴다). 라운드 65·66·67·68 P3에서 **네 번 이월**됐고,
 * 값을 8로 바꾸는 것보다 중요한 것이 **그 산수를 이 표에 한 줄로 세우는 것**이라 여기 들어온다
 * (다섯 번째 이월이 없으려면 되돌리는 손이 여기서 빨개져야 한다).
 *
 * 계산 방식은 라운드 64·65가 세운 그대로다: 숫자를 테스트에 다시 박지 않고 **소스의 hitSlop과
 * 소스의 크기**를 읽어 더한다(`theme.touchTarget`도 옮겨 적지 않는다).
 *
 * 넓히는 축: 이 버튼은 `navigationBar`의 왼쪽 끝에 혼자 서 있고 가운데 제목은 누르는 자리가
 * 아니므로(오른쪽은 같은 크기의 **빈 스페이서**다) 네 변을 함께 넓혀도 이웃 컨트롤의 몸에
 * 닿지 않는다 — 알림 벨·더보기 검색(GAP-065 #7)과 같은 판정이다.
 */
describe("GAP-069 #5 가져오기 첫 화면 뒤로가기 터치 타깃 (32 + 2×8 = 48)", () => {
  const uploadScreen = () => source("app/import/index.tsx");

  /** `StyleSheet.create({ ... name: { ... } })`의 한 칸에서 숫자 하나. */
  function readStyleSheetNumber(sourceText: string, styleName: string, key: string): number {
    const declaration = new RegExp(`\\b${styleName}: \\{([^}]*)\\}`).exec(sourceText);
    if (!declaration) throw new Error(`${styleName} 스타일을 소스에서 찾지 못했다`);
    const found = new RegExp(`\\b${key}:\\s*(\\d+)`).exec(declaration[1]);
    if (!found) throw new Error(`${styleName}에서 ${key}를 찾지 못했다`);
    return Number(found[1]);
  }

  /** 내비게이션 바의 첫 Pressable = 뒤로가기(오른쪽 자리는 Pressable이 아닌 스페이서다). */
  const backButtonTag = () => openingTagAfter(uploadScreen(), "<View style={styles.navigationBar}>", "<Pressable");

  it("32dp 정사각 + hitSlop 8 = 48 (값을 계약에 다시 박지 않고 소스에서 더한다)", () => {
    const tag = backButtonTag();
    const slop = Number(/hitSlop=\{(\d+)\}/.exec(tag)?.[1]);
    expect(Number.isFinite(slop), "뒤로가기의 hitSlop을 소스에서 찾지 못했다").toBe(true);

    const src = uploadScreen();
    const height = readStyleSheetNumber(src, "backButton", "height");
    const width = readStyleSheetNumber(src, "backButton", "width");
    expect(height, "뒤로가기는 정사각이다").toBe(width);
    expect(height + 2 * slop, "뒤로가기의 히트 영역").toBeGreaterThanOrEqual(theme.touchTarget);

    // 이 버튼이 그 hitSlop을 실제로 지고 있는지(태그가 바뀌면 위 계산이 다른 버튼을 잰다).
    expect(tag, "뒤로가기 버튼").toContain("style={styles.backButton}");
    expect(tag, "역할").toContain('accessibilityRole="button"');
    expect(tag, "라벨").toContain('accessibilityLabel="뒤로가기"');
    // 44dp로 되돌리는 손은 여기서 빨개진다(라운드 64·65가 맨 숫자에 쓴 그 못).
    expect(src, "44dp로 되돌린 hitSlop").not.toContain("hitSlop={6}");
  });

  it("렌더는 한 픽셀도 바뀌지 않는다 — IMP-003 픽셀락 캡처가 그대로다", () => {
    const src = uploadScreen();
    // 32는 승인 캡처(IMP-003)의 값이다. 높이로 벌지 않았다는 사실을 값으로 못박는다.
    expect(readStyleSheetNumber(src, "backButton", "height"), "버튼 높이").toBe(32);
    expect(readStyleSheetNumber(src, "backButton", "width"), "버튼 너비").toBe(32);
    // 바 높이도 그대로다(바를 키우는 것은 제목 줄이 내려앉는 길이다).
    expect(readStyleSheetNumber(src, "navigationBar", "height"), "내비게이션 바 높이").toBe(46);
    // 여백으로 히트 영역을 벌지 않았다 — 그건 렌더가 바뀌는 길이다.
    const backButtonStyle = /\bbackButton: \{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(backButtonStyle, "버튼 여백").not.toContain("padding");
    expect(backButtonStyle, "버튼 여백").not.toContain("margin");
  });
});

/* ------------------------------------------ 라운드 69 (GAP-069 #1 · #3 — 새 UI의 낭독 계약) */

/**
 * 주석을 걷어 낸 소스. 이 파일의 오랜 관례 하나("화면이 문구를 다시 적지 않는다")를 이 라운드에
 * 그대로 쓰려면 필요하다 — 두 화면 모두 **왜 이 문장을 넣었는지**를 주석에서 원문 그대로
 * 인용하고 있어(설계 근거를 값으로 남기는 이 저장소의 관례), 소스 전체를 그냥 훑으면 그 인용이
 * "화면이 문장을 조립했다"로 잘못 잡힌다. 낭독되는 것은 주석이 아니라 렌더되는 값이다.
 */
function withoutComments(sourceText: string): string {
  return sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * GAP-069 #1 · #3 — **이번 라운드가 만든 새 문장 둘이 소리로도 도달하는가.**
 *
 * 값 계약(무엇을 세는가 · 언제 뜨는가 · 문장이 무엇인가)은 각 트랙이 자기 모듈 테스트에 지고
 * 있다(트랙 A: 로그아웃이 세는 두 모집단 · 트랙 C: 폴백을 썼다는 사실). 여기가 붙드는 것은
 * 라운드 66·67·68이 쓴 그 형식 하나뿐이다 — **그 문구가 낭독되는 자리에 실제로 걸려 있는가.**
 *
 * 그래서 이 두 블록은 **문구를 다시 단언하지 않는다.** 비교에 쓰는 문자열까지 전부 순수 모듈에서
 * 읽어 오므로, 트랙이 문구를 한 번 더 다듬어도 여기서는 고칠 것이 없다 — 여기가 빨개진다면
 * 그것은 문구가 바뀐 것이 아니라 **배선이 끊어진 것**이다.
 */
describe("GAP-069 #1 로그아웃 확인 문구의 낭독 계약", () => {
  const settingsScreen = () => source("app/settings/index.tsx");

  it("새 줄은 Alert **본문**에 실린다 (RN Alert에서 낭독되는 것은 본문과 버튼 글자뿐이다)", () => {
    const src = settingsScreen();
    // A-3 #18 · A-7 #37 · GAP-067 #3이 같은 판정을 남겼다: Alert에는 라벨도 상태도 걸리지
    // 않으므로, 사실이 소리에 남을 길은 **본문 인자 하나**다. 제목 자리(첫 인자)로 밀면
    // 긴 문장이 제목으로 낭독되고, Toast로 빼면 확인 전에 사라진다.
    expect(src, "본문 자리에 순수 모듈의 산출").toContain("Alert.alert(LOGOUT_CONFIRM_TITLE, logoutConfirmMessage(");
    // 파괴적 갈래는 버튼 글자로만 갈린다(취소가 앞, 로그아웃이 destructive) — 그 순서가 곧 낭독 순서다.
    const alertCall = src.slice(src.indexOf("Alert.alert(LOGOUT_CONFIRM_TITLE"), src.indexOf("router.replace"));
    expect(alertCall.indexOf('style: "cancel"'), "취소가 먼저 읽힌다").toBeLessThan(
      alertCall.indexOf('style: "destructive"')
    );
  });

  it("화면이 문장을 조립하지 않는다 (단일 소스는 순수 모듈이다 — 문구는 여기서 다시 단언하지 않는다)", () => {
    const rendered = withoutComments(settingsScreen());
    // 모듈이 만드는 **모든 줄**이 화면에 리터럴로 없어야 한다. 비교 문자열을 이 파일에 적지
    // 않으므로(모듈 호출의 산출을 그대로 쓴다) 이 단언은 문구를 고정하지 않는다.
    const sample = logoutConfirmMessage({
      counts: { pending: 1, syncing: 0, failed: 0, conflict: 0 },
      itemStatusRowCount: 1,
      recurringTemplateCount: 2
    });
    expect(sample.split("\n").length, "네 좌표 중 '둘 다' 갈래는 세 줄이다").toBeGreaterThan(1);
    for (const line of sample.split("\n")) {
      expect(rendered, "화면이 다시 적은 문장").not.toContain(line);
    }
    // 건수도 화면이 만들지 않는다 — 셀렉터가 준 수를 그대로 넘긴다(새 요청 0건의 그 배선).
    expect(rendered, "정기 지출 건수 배선").toContain("recurringTemplateCount");
  });
});

/**
 * GAP-069 #3 — **시기를 모른다는 사실**이 준비템 탭에서 소리로도 도달하는가.
 *
 * 이 안내는 "지금 이 칩은 아이의 시기가 아니라 폴백"이라는 사실을 말하고, 문장 끝에서 **할 일**을
 * 준다. 소리로만 쓰는 사람에게 그 두 가지가 성립하려면 ⓐ 안내가 접근성 트리에 남아 있어야 하고
 * ⓑ 그 다음에 읽히는 것이 **고를 대상(칩 줄)**이어야 한다 — 안내가 칩 줄 아래로 내려가면
 * "직접 골라 주세요"를 들었을 때 고를 것이 이미 지나간 뒤다.
 *
 * ⓒ 그리고 **모르는 동안에는 아무 말도 하지 않는다**(라운드 61 S-4·68 #2가 세운 "0건과 모름은
 * 다르다"의 같은 형식): 로딩 중에 이 줄이 떴다가 사라지면, 화면을 눈으로 보지 않는 사람에게는
 * 없던 문제가 생겼다 사라진 것으로 남는다.
 */
describe("GAP-069 #3 준비템 탭 시기 밴드 안내의 낭독 계약", () => {
  const itemsScreen = () => source("app/(tabs)/items.tsx");
  const NOTICE_SLOT = "{STAGE_BAND_UNRESOLVED_NOTICE}";

  /** 안내를 감싸는 조건식의 이름(`{이름 ? (` 중 안내 바로 앞의 것). 이름이 바뀌어도 따라간다. */
  function noticeGuardName(src: string): string {
    const at = src.indexOf(NOTICE_SLOT);
    expect(at, "안내가 화면에 걸려 있다").toBeGreaterThan(-1);
    let name: string | undefined;
    for (const match of src.slice(Math.max(0, at - 800), at).matchAll(/\{(\w+) \? \(/g)) name = match[1];
    if (!name) throw new Error("안내를 감싸는 조건식을 소스에서 찾지 못했다");
    return name;
  }

  it("안내 다음에 읽히는 것이 **고를 대상**이다 (칩 줄 바로 위에 선다)", () => {
    const src = itemsScreen();
    const noticeAt = src.indexOf(NOTICE_SLOT);
    expect(noticeAt, "안내가 화면에 걸려 있다").toBeGreaterThan(-1);
    // 시기 밴드 칩은 공유 프리미티브다(GAP-065 #7이 그 낭독·선택 상태를 이미 진다).
    const chipAt = src.indexOf("<CategoryChip", noticeAt);
    expect(chipAt, "안내 뒤에 고를 대상이 온다").toBeGreaterThan(noticeAt);
    // 그 사이에 다른 필터 줄이 끼어들지 않는다 — 안내와 칩 줄은 같은 컨테이너의 이웃이다.
    const between = src.slice(noticeAt, chipAt);
    expect(between, "안내와 칩 사이에 다른 안내가 없다").not.toContain("<Text");
  });

  it("안내가 접근성 트리에서 빠지지 않는다 (보이는데 들리지 않는 자리를 만들지 않는다)", () => {
    const src = itemsScreen();
    const noticeAt = src.indexOf(NOTICE_SLOT);
    const noticeTag = src.slice(src.lastIndexOf("<Text", noticeAt), noticeAt);
    expect(noticeTag, "안내는 글자로 읽힌다").toContain('accessibilityRole="text"');
    // 아이콘·장식과 달리 이 줄은 사실을 나르므로 트리에서 빼지 않는다(A-7 #38의 반대쪽).
    expect(noticeTag, "트리에서 빼지 않는다").not.toContain("accessible={false}");
    expect(noticeTag, "트리에서 빼지 않는다").not.toContain("importantForAccessibility");
  });

  it("모르는 동안에는 말하지 않는다 (정착 판정을 지난 뒤에만 뜬다)", () => {
    const src = itemsScreen();
    const guard = noticeGuardName(src);
    const declarationAt = src.indexOf(`const ${guard} =`);
    expect(declarationAt, `${guard} 선언`).toBeGreaterThan(-1);
    const declaration = src.slice(declarationAt, src.indexOf(";", declarationAt));
    // 정착 판정은 이 화면이 이미 쓰던 그것이다(새 판정을 만들지 않는다).
    expect(declaration, "로딩 중에는 그리지 않는다").toContain("isChildrenSettled(");
    // "폴백을 썼다"는 사실에서만 나온다 — 라벨 값이 아니라 그 옆의 판정을 읽는다.
    expect(declaration, "폴백을 썼다는 사실에서 나온다").toContain("resolved");
    // 픽셀락 캡처(ITEM-001)는 비세션 렌더라 이 줄이 설 수 없다 — 이중 게이트의 바깥쪽.
    expect(declaration, "캡처에서는 뜨지 않는다").toContain("isPixelLockMode");
  });

  it("화면이 문장을 다시 적지 않는다 (단일 소스는 순수 모듈이다)", () => {
    // 문구를 이 파일에 옮겨 적지 않고 모듈에서 읽어 비교한다 — 트랙 C가 문장을 다듬어도
    // 이 단언은 그대로 서고, 화면이 리터럴을 복사한 순간에만 빨개진다.
    expect(withoutComments(itemsScreen()), "화면이 다시 적은 문장").not.toContain(STAGE_BAND_UNRESOLVED_NOTICE);
  });
});

/* ------------------------------------------- 라운드 70 트랙 E (GAP-070 #5 · 선행 확인 6) */

/**
 * GAP-070 트랙 E — **온보딩 첫 화면(ONB-001)의 타일 셋**.
 *
 * 두 가지가 한 자리에서 만난다.
 *
 * ⓐ **아이콘 관례.** 라운드 49 실기기 피드백 ②는 텍스트 글리프·이모지를 세 자리에서 Ionicons
 *    outline 한 벌로 옮겼고(탭바 `app/(tabs)/_layout.tsx` · 알림함 `app/notifications.tsx` ·
 *    가져오기 `app/import/index.tsx` — 세 파일 모두 그 근거를 주석으로 적어 뒀다), 그때 남은
 *    마지막 세 자리가 이 화면이었다. 승인 캡처 아홉에 온보딩이 없다는 것이 선행 확인 6의 값
 *    확인이라 여기만 고칠 수 있었다(알림 벨 `\u{1F514}` · `"무료배송"`은 캡처 본문에 실재해 무접촉).
 *
 * ⓑ **낭독 라벨.** 카드는 `Pressable`이라 접근성 트리에서 **한 덩어리**로 읽히는데 라벨이 없어
 *    자식 노드가 순서대로 낭독됐다 — 타일이 첫 자식이므로 TalkBack이 **이모지 이름을 제목보다
 *    먼저** 읽었다("임신부, 임신 중이에요, …"). 아이콘으로 바꾸는 것만으로는 그 순서가 낫지
 *    않는다(글리프 이름이 이모지 이름으로 바뀔 뿐이다). 그래서 아이콘은 장식으로 내리고
 *    (`accessible={false}` — A-7 #38 · GAP-067 #3이 알림 행·되돌리기 카드에 쓴 그 판정) 카드가
 *    **눈이 읽는 두 값**(제목 · 설명)을 그대로 이어 라벨로 진다.
 *
 * 이 블록은 **문구를 다시 단언하지 않는다**(라운드 66~69의 형식): 비교에 쓰는 문자열은 전부
 * 소스와 순수 모듈(`CHILD_STAGE_MODE_OPTIONS`)에서 읽어 오므로, 문구를 다듬어도 여기서 고칠
 * 것이 없다 — 여기가 빨개진다면 **배선이 끊어졌거나 관례가 깨진 것**이다.
 */
describe("GAP-070 #5 온보딩 첫 화면(ONB-001) 세 카드의 아이콘·낭독 계약", () => {
  const childStatusPath = "app/(onboarding)/child-status.tsx";
  const childStatus = () => source(childStatusPath);

  /** 라운드 49가 아이콘을 옮긴 세 화면. 관례를 사람이 옮겨 적지 않고 여기서 다시 읽는다. */
  const conventionScreens = ["app/(tabs)/_layout.tsx", "app/notifications.tsx", "app/import/index.tsx"] as const;
  /** outline 이름의 모양. 세 화면의 실제 값에서 다시 확인한 뒤에만 이 화면에 적용한다. */
  const outlineName = /^[a-z][a-z0-9-]*-outline$/;

  /** 카드 정의 셋을 소스에서 그대로 읽는다(값을 이 파일에 옮겨 적지 않는다). */
  function stageOptions(): { mode: string; icon: string; title: string; description: string; tint: string }[] {
    const src = childStatus();
    const block = src.slice(src.indexOf("const stageOptions"), src.indexOf("export default function"));
    const found = [
      ...block.matchAll(
        /\{\s*mode: "(\w+)",\s*icon: "([^"]+)",\s*title: "([^"]+)",\s*description: "([^"]+)",\s*tint: ([^\s,}]+)\s*\}/g
      )
    ].map((match) => ({ mode: match[1], icon: match[2], title: match[3], description: match[4], tint: match[5] }));
    if (found.length === 0) throw new Error("ONB-001의 카드 정의를 소스에서 찾지 못했다");
    return found;
  }

  /** 48×48 tint 타일 한 칸(그 안의 노드 하나가 이번에 바뀐 전부다). */
  function tileBlock(): string {
    const src = childStatus();
    const tintAt = src.indexOf("backgroundColor: option.tint");
    if (tintAt < 0) throw new Error("tint 타일을 소스에서 찾지 못했다");
    const start = src.lastIndexOf("<View", tintAt);
    return src.slice(start, src.indexOf("</View>", tintAt));
  }

  /** 카드를 감싼 `Pressable`의 여는 태그(라벨·역할·상태가 사는 자리). */
  function cardPressableTag(): string {
    const src = childStatus();
    const start = src.indexOf("<Pressable");
    if (start < 0) throw new Error("카드가 Pressable이 아니다");
    return src.slice(start, src.indexOf(">", src.indexOf("onPress=", start)));
  }

  it("타일 안이 이모지 텍스트가 아니라 Ionicons다 (세 화면과 같은 한 벌을 import 한다)", () => {
    const src = childStatus();
    // 같은 컴포넌트를 같은 자리에서 가져온다 — 아이콘 가족이 화면마다 갈리지 않는다.
    const importLine = 'import { Ionicons } from "@expo/vector-icons";';
    for (const screen of conventionScreens) {
      expect(source(screen), `${screen}의 아이콘 import`).toContain(importLine);
    }
    expect(src, "온보딩도 같은 한 벌을 쓴다").toContain(importLine);

    // 타일 안의 노드는 이제 아이콘 하나다(글리프를 Text로 그리던 자리가 남아 있지 않다).
    const tile = tileBlock();
    expect(tile, "타일 안의 노드").toContain("<Ionicons");
    expect(tile, "글리프를 글자로 그리던 자리").not.toContain("{option.icon}</Text>");

    // 렌더되는 값에는 이모지가 한 자도 남지 않는다(문장 속 이모지가 있는 다른 화면과 달리,
    // 여기의 이모지는 전부 아이콘 슬롯이었다 — 선행 확인 6). 주석은 걷어 내고 본다: 이 화면은
    // **무엇을 무엇으로 바꿨는지**를 주석에서 원문 그대로 인용하고 있고(설계 근거를 값으로
    // 남기는 이 저장소의 관례), 낭독되는 것은 주석이 아니라 렌더되는 값이다.
    expect(withoutComments(src), "남은 이모지").not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("아이콘 이름이 세 화면과 같은 outline 관례를 따르고, 값은 타입으로 잠긴다", () => {
    // 관례를 소스에서 다시 읽는다: 라운드 49가 옮긴 세 화면이 실제로 쓰는 이름들.
    const conventionNames = conventionScreens.flatMap((screen) =>
      [...source(screen).matchAll(/"([a-z][a-z0-9-]*-outline)"/g)].map((match) => match[1])
    );
    // 가드의 가드 — 정규식이 빗나가면 아래 관례 확인이 조용히 공허해진다.
    expect(conventionNames.length, "세 화면이 쓰는 outline 아이콘 수").toBeGreaterThanOrEqual(10);
    for (const name of conventionNames) expect(name, "관례의 이름 모양").toMatch(outlineName);

    const icons = stageOptions().map((option) => option.icon);
    expect(icons, "세 카드의 아이콘").toHaveLength(CHILD_STAGE_MODE_OPTIONS.length);
    for (const icon of icons) expect(icon, "온보딩 아이콘 이름").toMatch(outlineName);
    // 셋이 서로 다르다(같은 글리프 셋이면 눈으로 카드를 가릴 수 없다).
    expect(new Set(icons).size, "서로 다른 아이콘").toBe(icons.length);

    // 없는 글리프 이름은 여기가 아니라 typecheck에서 걸린다 — 그 잠금이 소스에 서 있는지만 본다.
    expect(childStatus(), "아이콘 이름의 타입 잠금").toContain("icon: keyof typeof Ionicons.glyphMap;");
  });

  it("문구·순서·타일 기하는 그대로다 — 바뀐 것은 타일 안의 노드 하나다", () => {
    const options = stageOptions();
    // 문구·순서를 이 파일에 옮겨 적지 않고 거울(순수 모듈)과 대조한다.
    expect(options.map((option) => option.mode), "세 단계의 순서").toEqual(
      CHILD_STAGE_MODE_OPTIONS.map((option) => option.mode)
    );
    expect(options.map((option) => option.title), "세 카드의 제목").toEqual(
      CHILD_STAGE_MODE_OPTIONS.map((option) => option.label)
    );

    // tint는 테마 토큰 셋 그대로다(색을 새로 짓지 않았다 · 카드마다 다르다).
    for (const option of options) expect(option.tint, `${option.mode}의 tint`).toMatch(/^theme\.colors\./);
    expect(new Set(options.map((option) => option.tint)).size, "서로 다른 tint").toBe(options.length);

    // 타일은 여전히 정사각 48 = 최소 터치 타깃이고(숫자를 다시 박지 않는다), 아이콘은 그 안에 든다.
    const tile = tileBlock();
    const height = Number(/height:\s*(\d+)/.exec(tile)?.[1]);
    const width = Number(/width:\s*(\d+)/.exec(tile)?.[1]);
    const iconSize = Number(/size=\{(\d+)\}/.exec(tile)?.[1]);
    expect(height, "타일은 정사각이다").toBe(width);
    expect(height, "타일 한 변").toBe(theme.touchTarget);
    expect(Number.isFinite(iconSize), "아이콘 크기를 소스에서 찾지 못했다").toBe(true);
    expect(iconSize, "아이콘은 타일 안에 든다").toBeLessThan(height);
    // 타일 자체의 여백으로 카드를 키우지 않았다(그건 렌더가 바뀌는 길이다).
    expect(tile, "타일 여백").not.toContain("padding");
    expect(tile, "타일 여백").not.toContain("margin");
  });

  it("각 카드가 낭독 라벨을 진다 — 이모지 이름이 제목보다 먼저 읽히던 자리다", () => {
    const tag = cardPressableTag();
    // 라벨은 **화면이 그리는 두 값**을 그대로 잇는다(문장을 새로 짓지 않는다).
    expect(tag, "낭독 라벨").toContain("accessibilityLabel={`${option.title}. ${option.description}`}");
    // 종전 계약은 그대로 남는다(역할 · 선택 상태).
    expect(tag, "역할").toContain('accessibilityRole="button"');
    expect(tag, "선택 상태").toContain("accessibilityState={{ selected }}");
    // 선택 여부를 문구로 다시 말하지 않는다 — 그건 상태가 진다(같은 사실을 두 번 읽지 않는다).
    expect(tag, "상태를 말로 다시 적지 않는다").not.toContain("선택됨");

    // 아이콘은 장식이라 트리에서 빠진다 — 이 한 줄이 없으면 라벨을 붙여도 플랫폼에 따라
    // 글리프 이름이 먼저 남는다(A-7 #38 · GAP-067 #3과 같은 판정).
    expect(tileBlock(), "장식 아이콘").toContain("accessible={false}");
  });

  it("그래서 카드는 제목부터 낭독된다 (라벨 = 제목 + 설명, 아이콘 이름은 들어오지 않는다)", () => {
    const src = childStatus();
    for (const option of stageOptions()) {
      // 소스의 라벨 틀에 이 카드의 값을 넣어 실제로 낭독될 문장을 만든다 — 문구를 여기에 적지
      // 않으므로 이 단언은 문장을 고정하지 않는다.
      const spoken = `${option.title}. ${option.description}`;
      expect(spoken.startsWith(option.title), `${option.mode}: 제목이 먼저다`).toBe(true);
      expect(spoken, `${option.mode}: 설명이 이어진다`).toContain(option.description);
      expect(spoken, `${option.mode}: 아이콘 이름은 낭독되지 않는다`).not.toContain(option.icon);

      // 눈이 읽는 것과 귀가 듣는 것이 같은 값이다(라벨을 리터럴로 따로 적지 않았다).
      expect(src, `${option.mode}: 라벨을 리터럴로 적지 않는다`).not.toContain(`accessibilityLabel="${option.title}`);
    }
    // 제목·설명은 카드가 값으로 그린다(두 자리가 갈릴 틈이 없다).
    expect(src, "보이는 제목").toContain("{option.title}");
    expect(src, "보이는 설명").toContain("{option.description}");
  });
});

/* ------------------------ 라운드 70 트랙 E (GAP-070 — A·B·C·D가 만든 새 문구의 낭독 계약) */

/**
 * 트랙 E의 두 번째 몫은 **다른 트랙이 이번 라운드에 만든 UI가 소리로도 도달하는가**다
 * (트랙 구성 E의 마지막 줄 — "같은 파일에서 세울 것").
 *
 * 형식은 라운드 66~69 그대로다: 값·문구 계약은 각 트랙이 자기 모듈 테스트에 이미 지고 있고
 * (`src/family/invite-accept-messages.test.ts` · `src/family/record-permissions.test.ts` ·
 * `src/offline/messages.test.ts` · `src/family/invite-flow.test.ts`), 여기가 붙드는 것은 하나뿐이다 —
 * **그 문구가 낭독되는 자리에 실제로 걸려 있는가.**
 *
 * 그래서 아래 블록들은 **문구를 다시 단언하지 않는다.** 비교에 쓰는 문자열까지 전부 순수
 * 모듈에서 읽어 오므로, 트랙이 문장을 한 번 더 다듬어도 여기서는 고칠 것이 없다 — 여기가
 * 빨개진다면 그것은 문구가 바뀐 것이 아니라 **배선이 끊어진 것**이다.
 */

/**
 * GAP-070 #1(트랙 A) — **끝난 초대**가 소리로 도달하는가 (FAM-003).
 *
 * 이 카드는 화면 전환 없이 같은 자리에 뜬다(딥링크로 들어오면 첫 프레임에 선다). 소리로만 쓰는
 * 사람에게 그 사실이 남으려면 ⓐ 세 갈래(조회 404 · 조회 400 · 수락 400)가 보는 카드가
 * **alert로** 떠야 하고, ⓑ 그 카드에서 누를 수 있는 것이 **탈출구 하나**여야 한다(재시도로
 * 풀리지 않는 실패에 [다시 시도]가 함께 낭독되면 그 손은 영원히 같은 400을 다시 받는다),
 * ⓒ 지킬 수 없는 약속("로그인하면 이 초대로 바로 돌아와서…")이 그 갈래에서 낭독되지 않아야 한다.
 */
describe("GAP-070 #1 끝난 초대 카드의 낭독 계약 (FAM-003)", () => {
  const acceptScreen = () => source("app/family/accept/[token].tsx");

  /** 세 갈래가 함께 보는 그 카드 한 장(다음 카드가 시작되기 전까지). */
  function unavailableCardBlock(): string {
    const src = acceptScreen();
    const at = src.indexOf("{inviteUnavailable ? (");
    expect(at, "끝난 초대 카드가 화면에 걸려 있다").toBeGreaterThan(-1);
    const end = src.indexOf("{invite.data && !inviteUnavailable ? (", at);
    expect(end, "카드의 끝을 소스에서 찾지 못했다").toBeGreaterThan(at);
    return src.slice(at, end);
  }

  it("세 갈래가 보는 카드가 alert로 뜬다 (같은 화면 안에서 나타나는 자리다)", () => {
    const block = unavailableCardBlock();
    // 라운드 79 트랙 A: 프롭 한 칸이 늘 수 있으므로(live region) 여는 태그를 바이트로 붙들지
    // 않는다 — 이 자리가 묻는 것은 **alert로 뜨는가**이지 태그의 바이트가 아니다.
    expect(block, "끝난 초대 카드").toMatch(/<View[^>]*accessibilityRole="alert"/);
    // 판정이 하나이므로 카드도 하나다 — 세 갈래가 같은 문자열이 아니라 **같은 노드**를 본다.
    expect((block.match(/accessibilityRole="alert"/g) ?? []).length, "카드 수").toBe(1);
  });

  it("세 문장과 탈출 버튼 라벨이 전부 순수 모듈에서 온다 (화면이 다시 적지 않는다)", () => {
    const block = unavailableCardBlock();
    for (const constantName of [
      "INVITE_UNAVAILABLE_TITLE",
      "INVITE_UNAVAILABLE_DETAIL",
      "INVITE_UNAVAILABLE_NEXT_STEP",
      "INVITE_UNAVAILABLE_ESCAPE_LABEL"
    ]) {
      expect(block, constantName).toContain(constantName);
    }
    // 모듈이 만드는 문장이 화면에 리터럴로 없다. 비교 문자열을 이 파일에 적지 않으므로(모듈에서
    // 읽어 온다) 이 단언은 문구를 고정하지 않는다.
    const rendered = withoutComments(acceptScreen());
    for (const line of [INVITE_UNAVAILABLE_TITLE, INVITE_UNAVAILABLE_DETAIL, INVITE_UNAVAILABLE_NEXT_STEP]) {
      expect(rendered, "화면이 다시 적은 문장").not.toContain(line);
    }
    // 탈출 버튼 라벨은 이 목록에 넣지 않는다: 라운드 60 #3의 **다른 카드**(수락은 이미
    // 성공했고 뒤처리만 실패한 자리 — 이 라운드가 무접촉으로 둔 곳)가 자기 낭독 라벨
    // "나중에 하고 앱 둘러보기"를 갖고 있어, 부분 문자열로는 두 자리가 갈리지 않는다.
    // 이 카드가 모듈의 라벨을 쓴다는 사실은 위 상수 확인이 이미 진다.
    expect(INVITE_UNAVAILABLE_ESCAPE_LABEL.length, "탈출 버튼 라벨").toBeGreaterThan(0);
  });

  it("그 카드에서 낭독되는 버튼은 탈출구 하나뿐이다 (다시 눌러 풀리는 것이 없는 갈래다)", () => {
    const block = unavailableCardBlock();
    expect((block.match(/<SecondaryButton/g) ?? []).length, "카드 안의 버튼 수").toBe(1);
    expect(block, "이 갈래에는 재시도가 없다").not.toContain("refetch()");
    // 재시도로 풀리는 실패(네트워크·5xx)의 카드는 종전 그대로 남는다 — 그쪽에만 재시도가 산다.
    expect(acceptScreen(), "네트워크 실패 카드는 종전 그대로다").toContain(
      "{invite.isError && !inviteUnavailable ? ("
    );
  });

  it("지킬 수 없는 약속은 그 갈래에서 낭독되지 않는다 (로그인 CTA가 접힌다)", () => {
    // 종전에는 이 두 갈래가 실패와 **무관하게** 그려져, 계정이 없는 사람이 로그인·약관 동의·
    // 계정 생성을 마치고 돌아와 똑같은 실패를 다시 들었다.
    expect(acceptScreen(), "로그인 안내의 바깥 게이트").toContain("{inviteUnavailable ? null : !authToken ? (");
  });
});

/**
 * GAP-070 #2(트랙 B) — **예산 저장이 잠겼다는 사실**이 소리로 도달하는가 (BUD-001).
 *
 * 이 화면의 새 사실은 둘이고 낭독되는 길이 서로 다르다.
 *  1. **보기 전용이라 저장할 수 없다**: 눌렀을 때 뜨는 RN Alert. Alert에는 라벨도 상태도 걸리지
 *     않으므로 사실이 소리에 남을 길은 **본문 인자 하나**다(A-3 #18 · A-7 #37 · GAP-069 #1이
 *     같은 판정을 남겼다). 그리고 잠긴 컨트롤을 `disabled`로 침묵시키지 않는 것이 이 저장소의
 *     관례다 — 비활성 버튼은 "버튼, 비활성"으로만 읽혀 **왜** 못 누르는지가 남지 않는다
 *     (GAP-066 #2의 못 고르는 칸과 같은 규율).
 *  2. **서버가 말해 준 실패 사유**: 공용 `Toast`를 지나므로 뜨는 순간 announce 된다(A11Y-115).
 */
describe("GAP-070 #2 예산 저장 잠금·실패 사유의 낭독 계약 (BUD-001)", () => {
  const budgetScreen = () => source("app/budget.tsx");

  /**
   * 라운드 71 트랙 E(라운드 70 리뷰 P-B) — Alert를 띄우는 자리가 **게이트 한 벌로 합쳐졌다.**
   * 화면이 갖고 있던 재구현(제목·본문·재검증 세 줄)은 사라지고 넘기는 것은 본문 하나다.
   * 그래서 이 계약도 자리를 옮긴다: **본문이 인자로 도달하는가**(제목 자리로 밀지 않는가)를
   * 게이트에서 보고, 화면에서는 그 본문이 순수 모듈의 문장인지를 본다.
   */
  it("보기 전용이라는 사실은 Alert **본문**에 실린다 (제목 자리로 밀지 않는다)", () => {
    // 라운드 71 리뷰 S-1: 본문이 문자열이 아니면 기본 문장으로 떨어진다(제목 자리로 미는 것이
    // 아니라, 본문 자리에 `[object Object]`가 서지 않게 하는 방어다).
    expect(source("src/family/useExpenseEntryGate.ts"), "본문 자리에 화면이 넘긴 문장").toContain(
      'Alert.alert(EXPENSE_VIEW_ONLY_ALERT_TITLE, typeof message === "string" ? message : EXPENSE_VIEW_ONLY_MESSAGE);'
    );
    expect(budgetScreen(), "화면은 본문만 넘긴다").toContain("expenseGate.explain(VIEW_ONLY_HEADLINES.budget)");
    // 문장은 화면이 짓지 않는다(단일 소스는 record-permissions.ts다).
    expect(withoutComments(budgetScreen()), "화면이 다시 적은 문장").not.toContain(BUDGET_VIEW_ONLY_MESSAGE);
  });

  it("잠긴 저장은 사라지지도, disabled로 침묵하지도 않는다 — 눌리면 사실을 말한다", () => {
    const src = budgetScreen();
    expect(src, "게이트를 지나는 저장").toContain("guardExpenseAction(");
    expect(src, "게이트를 지나는 저장").toContain("expenseGate.locked,");
    // 게이트가 버튼을 비활성으로 만들면 이유가 소리에 남지 않는다(그리고 눌러서 재검증을
    // 태우는 라운드 40 J-3의 경로도 함께 사라진다).
    expect(src, "게이트로 버튼을 비활성화하지 않는다").not.toContain("disabled={expenseGate.locked");
  });

  it("저장 실패 사유는 공용 Toast를 지나 뜨는 순간 낭독된다 (A11Y-115)", () => {
    const src = budgetScreen();
    expect(src, "실패 문구가 Toast에 실린다").toContain('<Toast message={saveErrorText} tone="error" />');
    // 그 문구가 **서버 코드를 보고** 갈리게 된 것이 이번 라운드의 변화다(실패 값을 함께 넘긴다).
    expect(src, "실패 값을 문구 훅에 넘긴다").toContain("useSaveErrorCopy(save.isError, save.error)");
    // 뜨는 순간 읽어 주는 것은 공용 프리미티브의 몫이다 — 화면이 announce를 다시 적지 않는다.
    expect(source("src/ui.tsx"), "Toast의 announce").toContain("announceForA11y(message);");
    expect(src, "화면이 announce를 다시 적지 않는다").not.toContain("announceForA11y(saveErrorText)");
  });

  /**
   * 이 훅을 쓰는 화면은 저장소에 **둘뿐**이고(그 사실은 `src/offline/messages.test.ts`가 값으로
   * 못박아 뒀다), 이번 라운드는 그 둘 **모두**에 실패 값을 함께 넘겼다(아이 관리 쪽은 라운드
   * 69가 `api-error.ts`에 남긴 배선 빚이다). 낭독되는 문장이 "잠시 후 다시 시도해 주세요"에서
   * **서버가 말해 준 사유**로 갈릴 수 있는지는 그 인자 하나에 달려 있다 — 한쪽만 넘기면 같은
   * 실패가 화면마다 다른 말로 읽힌다.
   */
  it("두 화면 모두 실패 값을 넘긴다 — 낭독될 문장이 사유를 담을 수 있다", () => {
    for (const path of ["app/budget.tsx", "app/settings/children.tsx"]) {
      expect(source(path), `${path}의 저장 실패 문구`).toMatch(/useSaveErrorCopy\([\s\S]{0,200}?\.error/);
    }
  });
});

/**
 * GAP-070 #3(트랙 C) — **초대가 여는 범위**가 소리로 도달하는가 (초대 화면).
 *
 * 프라이버시 결정이 내려지는 자리다. 그 결정의 내용이 소리로 성립하려면 ⓐ 공통 고지가 **고르는
 * 대상보다 먼저** 읽혀야 하고(고지가 카드 아래로 내려가면 이미 고른 뒤에 듣는다 — GAP-069 #3이
 * 시기 밴드 안내에 세운 그 순서), ⓑ 각 카드의 **설명 한 줄이 라벨에 실려야** 한다(카드는
 * `Pressable`이라 한 덩어리로 읽히는데, 라벨이 제목만 나르면 범위 문장은 눈에만 남는다).
 */
describe("GAP-070 #3 초대 역할 범위 고지의 낭독 계약", () => {
  const inviteScreen = () => source("app/family/invite.tsx");

  it("공통 고지 다음에 읽히는 것이 **고르는 대상**이다 (역할 카드 바로 위에 선다)", () => {
    const src = inviteScreen();
    const noticeAt = src.indexOf("{INVITE_SCOPE_NOTICE}");
    expect(noticeAt, "고지가 화면에 걸려 있다").toBeGreaterThan(-1);
    const choicesAt = src.indexOf("INVITE_ROLE_CHOICES.map(", noticeAt);
    expect(choicesAt, "고지 뒤에 고를 대상이 온다").toBeGreaterThan(noticeAt);
    // 그 사이에 다른 안내가 끼어들지 않는다(고지와 카드 줄은 같은 컨테이너의 이웃이다).
    expect(src.slice(noticeAt + "{INVITE_SCOPE_NOTICE}".length, choicesAt), "고지와 카드 사이").not.toContain("<Text");
  });

  it("각 카드가 역할 이름과 **범위 문장을 함께** 낭독한다 (설명이 눈에만 남지 않는다)", () => {
    const src = inviteScreen();
    expect(src, "카드 라벨").toContain("accessibilityLabel={`${option.label}, ${option.description}`}");
    expect(src, "역할").toContain('accessibilityRole="button"');
    // 눈이 읽는 것과 귀가 듣는 것이 같은 두 값이다(라벨을 따로 짓지 않았다).
    expect(src, "보이는 설명").toContain("{option.description}");
  });

  it("문장을 화면이 짓지 않는다 (고지·세 설명 전부 순수 모듈의 산출이다)", () => {
    const rendered = withoutComments(inviteScreen());
    expect(rendered, "화면이 다시 적은 고지").not.toContain(INVITE_SCOPE_NOTICE);
    for (const choice of INVITE_ROLE_CHOICES) {
      expect(rendered, `${choice.role} 설명`).not.toContain(choice.description);
    }
  });
});

/**
 * GAP-070 #4(트랙 D) — **"진행하면 이렇게 돼요" 상자에 늘어나는 한 줄.**
 *
 * 이 트랙이 만드는 문장은 **서버(그리고 데모 백엔드 거울)의 impact 배열**에 있고, 화면은 그
 * 배열을 그대로 그린다(`PreviewSummary`) — 새 컨트롤도, 새 라벨도, 앱이 짓는 문자열도 없다.
 * 그래서 여기서 세울 낭독 계약은 **하나뿐이다**: 배열이 한 줄 늘었을 때 그 줄이 실제로 낭독
 * 되는가. 화면이 배열을 자르거나(slice) 줄 수를 제한하거나(numberOfLines) 그 자리를 접근성
 * 트리에서 빼면, 서버가 말한 사실이 소리에는 남지 않는다.
 *
 * 문구 자체와 "요청자의 역할에서 파생되는가"는 트랙 D의 서버·거울 테스트가 진다 —
 * 이 파일은 그 문장을 알지 못한다(그래서 여기에 적지 않는다).
 */
describe("GAP-070 #4 되돌릴 수 없는 흐름의 impact 줄 낭독 계약 (SET-004)", () => {
  it("impact 배열 전량이 보이는 글자로 그려진다 (자르지도, 트리에서 빼지도 않는다)", () => {
    const src = source("app/settings/privacy.tsx");
    const at = src.indexOf("preview.impact.map((line) => (");
    expect(at, "impact 배열을 그리는 자리").toBeGreaterThan(-1);
    const block = src.slice(at, src.indexOf("{preview.requiresSecondStep", at));
    expect(block, "배열을 자르지 않는다").not.toContain("slice(");
    expect(block, "줄 수를 제한하지 않는다").not.toContain("numberOfLines");
    expect(block, "트리에서 빼지 않는다").not.toContain("accessible={false}");
    expect(block, "트리에서 빼지 않는다").not.toContain("importantForAccessibility");
  });
});

/* ============================================================================================ */
/* GAP-071 트랙 E — A·B·C·D가 만든 새 UI의 **낭독 계약**                                          */
/*                                                                                              */
/* 라운드 66~70과 같은 형식이다: **문구를 다시 단언하지 않는다.** 비교에 쓰는 문자열까지 전부 각   */
/* 트랙의 모듈에서 읽어 오므로, 그쪽이 문장을 다듬어도 이 파일은 그대로다. 여기서 묻는 것은 하나   */
/* 뿐이다 — **그 문장이 소리로 도달하는 자리에 걸려 있는가.**                                     */
/* ============================================================================================ */

/**
 * GAP-071 #1(트랙 A) — 가져오기 여정의 실패가 **소리로** 도달하는가.
 *
 * 이 여정의 실패는 네 자리에서 서고 낭독되는 길이 둘로 갈린다.
 *  - 업로드 · 행 편집 · 확정: 화면 안의 **보이는 Text**. 색(danger)만으로 상태를 말하지 않는다는
 *    A-1 Error text의 그 규율이고, 스크린리더는 그 문장을 순서대로 읽는다.
 *  - 되돌리기: RN **Alert**. Alert 버튼에는 accessibilityLabel도 state도 걸 수 없으므로 사실이
 *    소리에 남을 길은 **본문 인자 하나**다(A-3 #18 · GAP-069 #1 · GAP-070 #2가 같은 판정이다).
 */
describe("GAP-071 #1 가져오기 실패 문구의 낭독 계약 (IMP-002·IMP-003)", () => {
  const uploadScreen = () => source("app/import/index.tsx");
  const reviewScreen = () => source("app/import/[importJobId].tsx");

  it("업로드 실패는 보이는 Text로 읽힌다 (색·배지 톤만으로 말하지 않는다)", () => {
    const src = uploadScreen();
    const at = src.indexOf('importFailureMessage("upload"');
    expect(at, "업로드 실패 문구가 화면에 걸려 있다").toBeGreaterThan(-1);
    // 그 문장이 서는 노드는 Text다 — 바로 앞 여는 태그를 확인한다.
    expect(src.slice(0, at).lastIndexOf("<Text")).toBeGreaterThan(src.slice(0, at).lastIndexOf("</Text>"));
  });

  it("행 편집·확정 실패도 각각 보이는 Text로 읽힌다 (두 자리가 한 문장을 돌려 쓰지 않는다)", () => {
    const src = reviewScreen();
    for (const kind of ["row_edit", "confirm"]) {
      const at = src.indexOf(`importFailureMessage("${kind}"`);
      expect(at, `${kind} 실패 문구가 화면에 걸려 있다`).toBeGreaterThan(-1);
      expect(src.slice(0, at).lastIndexOf("<Text"), `${kind}의 Text 노드`).toBeGreaterThan(
        src.slice(0, at).lastIndexOf("</Text>")
      );
    }
    // 두 자리가 서로 다른 종류를 넘긴다(같은 값을 넘기면 같은 문장이 두 번 서는 종전 상태다).
    expect(src.indexOf('importFailureMessage("row_edit"')).not.toBe(src.indexOf('importFailureMessage("confirm"'));
  });

  it("되돌리기 실패는 Alert **본문**에 실린다 (제목 자리로 밀지 않는다)", () => {
    expect(uploadScreen(), "본문 인자에 모듈의 산출").toContain(
      'Alert.alert(IMPORT_UNDO_CARD_TITLE, importFailureMessage("undo", error, { isOnline }))'
    );
  });

  it("문장을 화면이 짓지 않는다 (전부 순수 모듈의 산출이다)", () => {
    const moduleSentences = [
      IMPORT_UPLOAD_FAILED_MESSAGE,
      IMPORT_ROW_EDIT_FAILED_MESSAGE,
      IMPORT_CONFIRM_FAILED_MESSAGE,
      IMPORT_FORBIDDEN_MESSAGE
    ];
    for (const path of ["app/import/index.tsx", "app/import/[importJobId].tsx"]) {
      const rendered = withoutComments(source(path));
      for (const sentence of moduleSentences) {
        expect(rendered, `${path}가 다시 적은 문장`).not.toContain(sentence);
      }
    }
  });
});

/**
 * GAP-071 #2(트랙 B) — 되돌릴 수 없는 세 흐름의 실패가 **소리로** 도달하는가 (SET-004).
 *
 * 이 화면에서 그 문장이 뜨는 순간은 사용자가 **결과를 가장 알고 싶은 순간**이다("내 계정이
 * 지워졌나?"). 그래서 묻는 것은 셋이다: ⓐ 세 흐름이 **각자의** 문장을 갖는가(한 자리에 한 문장을
 * 돌려 쓰면 소리로는 구분이 없다), ⓑ 그 문장이 보이는 Text로 서는가, ⓒ 화면이 그 문장을 다시
 * 적지 않는가.
 *
 * ⚠ 라운드 70 D가 세운 **impact 상자**의 낭독 계약은 위 GAP-070 #4가 이미 지고 있고, 이 트랙은
 * 그 **아래**만 만졌다 — 여기서 그 상자를 다시 단언하지 않는다.
 */
describe("GAP-071 #2 되돌릴 수 없는 흐름의 실패 문구 낭독 계약 (SET-004)", () => {
  const privacyScreen = () => source("app/settings/privacy.tsx");

  it("세 흐름 + 동의가 각자의 문장을 갖는다 (한 문장을 네 자리가 돌려 쓰지 않는다)", () => {
    const src = privacyScreen();
    const texts = ["childDeleteFailureText", "householdLeaveFailureText", "accountDeleteFailureText", "consentUpdateFailureText"];
    for (const name of texts) {
      expect(src, `${name}의 자리`).toContain(`{${name}}`);
    }
    expect(new Set(texts).size, "네 이름이 서로 다르다").toBe(4);
    // 종전의 단일 리터럴(actionFailedText)이 되돌아오면 여기서 걸린다.
    expect(src, "종전의 한 문장 돌려쓰기").not.toContain("const actionFailedText =");
  });

  it("네 문장 모두 보이는 Text로 읽힌다 (Alert 뒤로 숨기지 않는다)", () => {
    const src = privacyScreen();
    for (const name of [
      "childDeleteFailureText",
      "householdLeaveFailureText",
      "accountDeleteFailureText",
      "consentUpdateFailureText"
    ]) {
      const at = src.indexOf(`{${name}}`);
      expect(src.slice(0, at).lastIndexOf("<Text"), `${name}의 Text 노드`).toBeGreaterThan(
        src.slice(0, at).lastIndexOf("</Text>")
      );
    }
  });

  it("문장을 화면이 짓지 않는다 (판정도 문구도 순수 모듈의 것이다)", () => {
    const rendered = withoutComments(privacyScreen());
    for (const sentence of [DESTRUCTIVE_ACTION_FAILED_MESSAGE, CONSENT_UPDATE_FAILED_MESSAGE]) {
      expect(rendered, "화면이 다시 적은 문장").not.toContain(sentence);
    }
    // 라운드 71 리뷰 S-4: 데모(로컬 토큰) 세션은 오프라인 갈래를 건너뛴다 — 그 요청은 서버로
    // 가지 않으므로 "닿지 못했어요"가 참일 수 없다. 문구를 고르는 곳은 여전히 순수 모듈이다.
    expect(privacyScreen(), "문구는 모듈이 고른다").toContain(
      "destructiveFlowErrorMessage(kind, error, { isOnline: isDemoSession || isOnline })"
    );
  });
});

/**
 * GAP-071 #3(트랙 C) — 앱의 **현관**에서 막힌 사람에게 도달하는 두 줄.
 *
 * 이 카드는 탭 셸 **앞**에 서므로 스크린리더 사용자가 앱에서 듣는 것이 이것뿐인 상태다. 그래서
 * 묻는 것은 셋이다: ⓐ 갈린 첫 줄과 **새로 생긴 둘째 줄**이 둘 다 보이는 Text인가(둘째 줄이
 * 캡션 스타일이라 시각적으로 작아도 낭독 순서에는 그대로 들어간다), ⓑ 탈출구 버튼이 그대로
 * 남는가(연결 판정은 폴 한 번이라 틀릴 수 있고, 틀렸을 때 되돌릴 유일한 수단이다),
 * ⓒ 화면이 그 두 문장을 다시 적지 않는가.
 */
describe("GAP-071 #3 현관 복구 실패 카드의 낭독 계약", () => {
  const entranceScreen = () => source("app/index.tsx");
  const cardBlock = () => {
    const src = entranceScreen();
    const at = src.indexOf('testID="screen-child-recovery-error"');
    expect(at, "현관 실패 카드").toBeGreaterThan(-1);
    return src.slice(at, src.indexOf("</AppScreen>", at));
  };

  it("두 줄이 모두 보이는 글자로 서고, 순서는 사실 → 잃지 않은 것이다", () => {
    const block = cardBlock();
    const titleAt = block.indexOf("{childRecovery.copy.title}");
    const bodyAt = block.indexOf("{childRecovery.copy.body}");
    expect(titleAt, "첫 줄").toBeGreaterThan(-1);
    expect(bodyAt, "둘째 줄").toBeGreaterThan(titleAt);
    // 둘 다 Text다 — 색·아이콘만으로 말하지 않는다(A-1 Error text).
    expect(block.slice(0, titleAt).lastIndexOf("<Text")).toBeGreaterThan(block.slice(0, titleAt).lastIndexOf("</Text>"));
    expect(block.slice(0, bodyAt).lastIndexOf("<Text")).toBeGreaterThan(block.slice(0, bodyAt).lastIndexOf("</Text>"));
    // 트리에서 빼거나 줄 수를 자르지 않는다.
    expect(block, "줄 수를 제한하지 않는다").not.toContain("numberOfLines");
    expect(block, "트리에서 빼지 않는다").not.toContain("accessible={false}");
  });

  it("탈출구는 그대로 남는다 — 오프라인 갈래에서도 [다시 시도]가 사라지지 않는다", () => {
    const block = cardBlock();
    expect(block, "재시도 버튼").toContain('<SecondaryButton label="다시 시도" onPress={childRecovery.retry} />');
    // 자동 재시도가 생겼다고 수동 탈출구를 접지 않는다(조건부로 감싸지 않는다).
    expect(block, "버튼을 조건부로 접지 않는다").not.toContain("? <SecondaryButton");
  });

  it("문장을 화면이 짓지 않는다 (두 줄 다 순수 모듈의 산출이다)", () => {
    const rendered = withoutComments(entranceScreen());
    for (const sentence of [SELECTED_CHILD_RECOVERY_ERROR_NOTICE, SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE]) {
      expect(rendered, "화면이 다시 적은 문장").not.toContain(sentence);
    }
  });
});

/**
 * GAP-071 #4(트랙 D) — **도움으로 가는 행**이 소리로 성립하는가.
 *
 * 새 UI는 메뉴 행 둘이고, 낭독에서 중요한 것은 셋이다: ⓐ 눈이 읽는 제목·부제와 귀가 듣는 것이
 * **같은 한 표**에서 오는가(두 화면이 각자 라벨을 적으면 같은 행이 화면마다 다르게 읽힌다),
 * ⓑ **주입되지 않은 빌드에서는 행 자체가 없는가**(낭독되는 행이 열리지 않는 것이 이 저장소가
 * 가장 오래 싸운 결함이다 — 죽은 링크는 가짜 버튼과 같은 것이다), ⓒ 열기 실패가 조용히
 * 넘어가지 않고 **Alert 본문**으로 말하는가.
 */
describe("GAP-071 #4 지원·FAQ 메뉴 행의 낭독 계약 (SET-001·SET-002)", () => {
  it("보이는 제목·부제가 두 화면 모두 같은 한 표에서 온다", () => {
    const menuSource = source("src/settings/more-menu.ts");
    expect(menuSource, "라벨의 단일 소스").toContain("SUPPORT_LINK_LABELS[kind].title");
    expect(menuSource, "라벨의 단일 소스").toContain("SUPPORT_LINK_LABELS[kind].subtitle");
    // 두 화면 모두 그 표를 읽는다(각자 문자열을 적지 않는다).
    for (const path of ["app/(tabs)/more.tsx", "app/settings/index.tsx"]) {
      const rendered = withoutComments(source(path));
      for (const kind of ["support", "faq"] as const) {
        expect(rendered, `${path}가 다시 적은 제목`).not.toContain(SUPPORT_LINK_LABELS[kind].title);
        expect(rendered, `${path}가 다시 적은 부제`).not.toContain(SUPPORT_LINK_LABELS[kind].subtitle);
      }
    }
  });

  it("주입되지 않은 빌드에서는 낭독될 행이 아예 만들어지지 않는다", () => {
    // 값 계약(env → 행 수)은 트랙 D의 모듈 테스트가 진다. 여기서 보는 것은 **화면이 그 목록을
    // 그대로 그리는가**뿐이다 — 목록이 비면 노드가 0개라 낭독 표면이 종전과 완전히 같다.
    expect(source("app/settings/index.tsx"), "설정 화면의 행 렌더").toContain("supportRows.map((row) => (");
    expect(source("src/settings/more-menu.ts"), "더보기 목록의 행 조립").toContain("...buildSupportMenuRows().map((row) => ({");
    // 화면이 목록을 걸러 내거나 잘라 내지 않는다(자르면 서버가 아니라 화면이 사실을 감춘다).
    const settingsSrc = source("app/settings/index.tsx");
    const at = settingsSrc.indexOf("supportRows.map((row) => (");
    expect(settingsSrc.slice(at, at + 400), "목록을 자르지 않는다").not.toContain("slice(");
  });

  it("⚠ SET-001 비로그인 미리보기 행 목록은 종전 그대로다 (픽셀락 기준선 불변)", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    const at = moreSource.indexOf("const previewMenuRowActions");
    expect(at, "미리보기 행 목록").toBeGreaterThan(-1);
    const block = moreSource.slice(at, moreSource.indexOf("];", at));
    expect(block, "미리보기 목록에는 새 행이 없다").not.toContain("openSupportLink");
    expect(block, "미리보기 목록에는 새 행이 없다").not.toContain("buildSupportMenuRows");
  });

  it("열기 실패는 조용히 넘어가지 않고 Alert **본문**으로 말한다", () => {
    // 라운드 71 리뷰 S-2: Alert를 띄우는 자리는 화면 셋이 공유하는 한 벌이 됐고
    // (src/settings/open-external-url.ts), 화면은 **본문 문구를 넘긴다**. 자리(제목/본문)는 그대로다.
    expect(source("src/settings/open-external-url.ts"), "본문 자리에 화면이 넘긴 문장").toContain(
      "Alert.alert(failTitle, failMessage);"
    );
    for (const path of ["app/(tabs)/more.tsx", "app/settings/index.tsx"]) {
      expect(source(path), `${path}의 실패 안내`).toContain(
        "openExternalUrl(url, { failTitle: SUPPORT_LINK_FAILED_TITLE, failMessage: SUPPORT_LINK_FAILED_MESSAGE });"
      );
      // 문장은 화면이 짓지 않는다.
      expect(withoutComments(source(path)), `${path}가 다시 적은 문장`).not.toContain(SUPPORT_LINK_FAILED_MESSAGE);
    }
  });
});

/* ============================================================================================ */
/* GAP-072 트랙 E — 라운드 72가 만든 새 UI의 **낭독 계약** (접근성 체크표 A-13)                    */
/*                                                                                              */
/* 라운드 66~71과 같은 형식이다: **문구를 다시 단언하지 않는다.** 비교에 쓰는 문자열까지 전부 각   */
/* 트랙의 모듈에서 읽어 오므로, 그쪽이 문장을 다듬어도 이 파일은 그대로다. 여기서 묻는 것은 하나   */
/* 뿐이다 — **그 문장·그 컨트롤이 소리로 도달하는 자리에 걸려 있는가.**                            */
/*                                                                                              */
/* ⚠️ 라운드 72 리뷰 M-3이 세우는 블록이다. 라운드 72는 다섯 트랙 중 넷이 낭독 표면을 만들었는데   */
/* 이 파일에 블록이 **0건**이었다 — 체크표 A-13의 근거 칸이 "각 트랙의 모듈 계약 + 종전 컴포넌트   */
/* 계약" 둘로만 채워져 있었고, 그래서 **낭독 자리 자체**를 붙드는 자리가 이 라운드에는 없었다.     */
/* 넷 중 낭독 노드가 새로 생긴 자리(ⓐ ONB-003 탈출구 · ⓑ 빈 기간 카드 · ⓒ 그 카드의 액션 ·        */
/* ⓓ 로그인 링크 실패)를 여기서 값으로 묶는다.                                                    */
/* ============================================================================================ */

/**
 * GAP-072 ⓐ(트랙 A / A-13 #63) — **ONB-003의 로컬 탈출구가 소리로 도달하는가.**
 *
 * 이 라운드가 새로 만든 낭독 노드다. 오프라인에서 온보딩이 멈춘 사람에게 이 버튼은 **앞으로
 * 나아가는 유일한 길**이므로, 묻는 것은 셋이다: ⓐ 라벨이 순수 모듈의 한 값에서 오는가(화면이
 * 다시 적으면 눈과 귀가 다른 말을 한다 — A-3 #20), ⓑ 그 노드가 **조건이 성립할 때만** 서는가
 * (열리지 않아야 할 때 낭독되는 버튼은 가짜 버튼이다 — GAP-071 #5의 그 자물쇠), ⓒ 누를 수 있는
 * 자리에 실제로 배선이 붙어 있는가(라벨↔onPress 짝).
 *
 * ⚠️ 문구는 여기서 다시 단언하지 않는다 — `PREPARED_ITEMS_LOCAL_PASS_LABEL`을 **모듈에서 읽어**
 * 대조하므로 트랙 A가 문장을 다듬어도 이 블록은 그대로다(값 계약은 local-progress.test.ts).
 */
describe("GAP-072 ⓐ ONB-003 로컬 탈출구의 낭독 계약", () => {
  const screen = () => source("app/(onboarding)/prepared-items.tsx");

  it("라벨은 순수 모듈의 한 값이고, 화면이 그 글자를 다시 적지 않는다", async () => {
    const { PREPARED_ITEMS_LOCAL_PASS_LABEL } = await import("./onboarding/local-progress");
    const src = screen();
    expect(src, "라벨을 모듈에서 받는다").toContain("label={PREPARED_ITEMS_LOCAL_PASS_LABEL}");
    // 눈이 읽는 글자와 귀가 듣는 글자가 같은 한 값이다(화면에 리터럴이 남으면 두 벌이 된다).
    expect(withoutComments(src), "화면이 다시 적은 라벨").not.toContain(PREPARED_ITEMS_LOCAL_PASS_LABEL);
  });

  it("조건이 성립할 때만 노드가 선다 (열리지 않아야 할 때 낭독되는 버튼이 없다)", () => {
    const src = screen();
    // 판정은 순수 모듈이 하고(체크 0건 + 저장 실패), 화면은 그 답으로 노드를 만들거나 만들지 않는다.
    expect(src).toContain(
      "canPassPreparedItemsLocally({ checkedCount: checkedIds.length, saveFailed: save.isError })"
    );
    expect(src, "조건부 렌더").toContain("{canPassLocally ? (");
    // 조건이 거짓이면 노드 자체가 없다 — 비활성 버튼으로 남기지 않는다(그러면 "버튼, 비활성"이
    // 낭독되면서 왜 못 누르는지가 남지 않는다 — 달력 미래 칸 A-4 #23의 그 판정).
    const block = src.slice(src.indexOf("{canPassLocally ? ("), src.indexOf(") : null}", src.indexOf("{canPassLocally ? (")));
    expect(block, "조건 거짓이면 노드 0개").not.toContain("disabled={!canPassLocally}");
  });

  it("라벨↔onPress 짝이 붙어 있다 (라벨만 낭독되는 가짜 버튼이 아니다)", () => {
    const src = screen();
    const at = src.indexOf("label={PREPARED_ITEMS_LOCAL_PASS_LABEL}");
    expect(at, "탈출구 버튼").toBeGreaterThan(-1);
    const tag = src.slice(src.lastIndexOf("<TextButton", at), src.indexOf("/>", at));
    expect(tag, "목적지가 붙어 있다").toContain("onPress={passLocally}");
    // 그 핸들러가 실제로 앞으로 보낸다(단계 표시 + 다음 화면). 라벨이 말한 일과 같다.
    expect(src).toContain('completeStep("ONB-003");');
    expect(src).toContain('router.push("/onboarding/budget");');
  });
});

/**
 * GAP-072 ⓑ·ⓒ(트랙 C / A-13 #65) — **리포트 빈 기간 카드**가 소리로 성립하는가.
 *
 * 이 카드는 액션 키가 둘로 갈리는 자리다. 그래서 GAP-071 #5가 `EmptyStateCard`에 세운
 * **actionLabel↔onPress 짝**의 형식을 그대로 쓴다 — 라벨은 순수 모듈이 고르고 목적지는 화면이
 * 배선하므로, 그 둘이 갈리면 **낭독되는 가짜 안내**가 된다("이번 달 보기"라고 읽어 주고 오늘
 * 날짜 기록 시트를 여는 것이 정확히 그 사고다).
 *
 * ⓒ는 그 액션의 **소리 쪽 절반**이다: 끝난 기간에서 현재 기간으로 돌아가면 눈으로는 화면 전체가
 * 바뀌지만 스크린리더에는 아무 일도 없다. 화살표 이동 둘이 이미 `announceForA11y`를 남기므로
 * (A11Y-115의 그 배선), 같은 문법의 셋째 이동에도 같은 자리가 있어야 한다.
 */
describe("GAP-072 ⓑ 리포트 빈 기간 카드의 액션 라벨↔onPress 짝", () => {
  const screen = () => source("app/(tabs)/reports.tsx");
  const cardTag = () => {
    const src = screen();
    const at = src.indexOf("title={emptyPeriodCard.title}");
    expect(at, "빈 기간 카드").toBeGreaterThan(-1);
    return src.slice(src.lastIndexOf("<EmptyStateCard", at), src.indexOf("/>", at));
  };

  it("제목·라벨·목적지가 한 카드 안에서 같은 판정을 읽는다", () => {
    const tag = cardTag();
    // 제목과 라벨이 같은 산출의 두 필드다(둘이 다른 소스에서 오면 기간이 어긋날 수 있다).
    expect(tag, "제목").toContain("title={emptyPeriodCard.title}");
    expect(tag, "라벨").toContain("actionLabel={emptyPeriodCard.actionLabel}");
    // 목적지도 **같은 산출의 action 키**로 갈린다 — 화면이 제 나름의 조건을 다시 세우지 않는다.
    expect(tag, "목적지 갈래").toContain('emptyPeriodCard.action === "go-current-period"');
    expect(tag, "끝난 기간의 목적지").toContain("? goToCurrentPeriod");
    expect(tag, "현재 기간의 목적지").toContain('expenseGate.guard(() => router.push("/expenses/new"))');
  });

  it("라벨만 있고 목적지가 없는 자리가 아니다 (GAP-071 #5의 짝 계약을 이 카드가 지킨다)", () => {
    const tag = cardTag();
    expect(tag).toContain("actionLabel");
    expect(tag, "라벨만 있는 카드").toContain("onPress");
  });

  it("문구를 화면이 짓지 않는다 (제목·라벨 전부 순수 모듈의 산출이다)", async () => {
    const { REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS, REPORT_EMPTY_PERIOD_RECORD_ACTION_LABEL } = await import(
      "./reports/empty-period-card"
    );
    const rendered = withoutComments(screen());
    for (const label of [
      REPORT_EMPTY_PERIOD_RECORD_ACTION_LABEL,
      ...Object.values(REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS)
    ]) {
      expect(rendered, `화면이 다시 적은 라벨: ${label}`).not.toContain(label);
    }
  });
});

describe("GAP-072 ⓒ 현재 기간으로 되돌아가기의 announce 자리", () => {
  const screen = () => source("app/(tabs)/reports.tsx");
  const handlerBody = (name: string) => {
    const src = screen();
    const at = src.indexOf(`const ${name} = () => {`);
    expect(at, `${name} 핸들러`).toBeGreaterThan(-1);
    return src.slice(at, src.indexOf("\n  };", at));
  };

  it("세 이동이 모두 새 기간 라벨을 낭독한다 (화살표 둘과 같은 문법이다)", () => {
    for (const name of ["goToPreviousPeriod", "goToNextPeriod", "goToCurrentPeriod"]) {
      expect(handlerBody(name), `${name}의 announce`).toContain("announceForA11y(periodLabelForOffset(");
    }
    // 새 문구 0건 — 읽히는 문장은 화살표 이동이 이미 쓰는 그 라벨 함수의 산출이다.
    expect(handlerBody("goToCurrentPeriod")).toContain("announceForA11y(periodLabelForOffset(baseDate, periodUnit, 0));");
  });

  it("상태 변경과 낭독이 한 핸들러 안에 함께 있다 (한쪽만 도는 자리가 없다)", () => {
    const body = handlerBody("goToCurrentPeriod");
    const moveAt = body.indexOf("setMonthOffset(0);");
    const speakAt = body.indexOf("announceForA11y(");
    expect(moveAt, "오프셋 이동").toBeGreaterThan(-1);
    expect(speakAt, "낭독").toBeGreaterThan(moveAt);
  });
});

/**
 * GAP-072 ⓓ(트랙 E / A-13 #66) — **로그인 화면의 링크 실패가 어디에서 소리가 되는가.**
 *
 * 종전에는 이 실패가 화면 안 `loginError` 카드에 섰다 — 소리로만 듣는 사람에게는 방금 누른
 * **로그인**이 실패한 것처럼 들렸다. 이제 다른 세 화면과 같은 자리(Alert)에 서고, Alert에서
 * 계약이 붙들 수 있는 것은 **문자열뿐**이므로(A-3 #18 · GAP-069 #1 · GAP-070 #2 · GAP-071 #1이
 * 같은 판정을 남겼다) 사실이 소리에 남을 길은 제목·본문 두 인자다.
 *
 * ⚠️ 문구 자체(재시도 없음 · 원인 단정 없음)는 값 계약이 진다 — `src/consent/legal-links.test.ts`와
 * 네 자리 스윕 `src/shared-decision-wiring.test.ts` ⓐ-2. 여기서 보는 것은 **자리**다.
 */
describe("GAP-072 ⓓ 로그인 링크 실패의 낭독 자리 (Alert 본문)", () => {
  const loginScreen = () => source("app/(auth)/login.tsx");

  it("실패는 Alert **본문**에 실린다 (제목 자리로 밀지 않는다)", () => {
    expect(loginScreen(), "화면이 자기 문구를 규칙 한 벌에 넘긴다").toContain(
      "openExternalUrl(url, { failTitle: LEGAL_DOCUMENT_OPEN_FAILED_TITLE, failMessage: LEGAL_DOCUMENT_OPEN_FAILED_MESSAGE });"
    );
    // 규칙 모듈이 그 두 인자를 Alert의 제목·본문에 그대로 놓는다(문장을 만들지 않는다).
    expect(source("src/settings/open-external-url.ts")).toContain("Alert.alert(failTitle, failMessage);");
  });

  it("로그인 실패 카드와 자리가 섞이지 않는다 (두 사실이 소리에서 겹치지 않는다)", () => {
    const src = loginScreen();
    const at = src.indexOf("function openLegalDocument(url: string) {");
    expect(at, "링크 열기 핸들러").toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf("\n  }", at));
    // 링크 실패는 `loginError` 카드에 쓰지 않는다 — 그 카드는 이제 로그인 실패 전용이다.
    expect(body, "카드 자리로 새지 않는다").not.toContain("setLoginError");
    // Alert은 시스템이 스스로 낭독하므로 A11Y-115의 announce 배선이 따로 필요 없다.
    expect(body, "이중 낭독").not.toContain("announceForA11y");
  });

  it("URL이 주입되지 않은 빌드에서는 낭독될 컨트롤이 아예 없다 (라운드 65 B(#5) 그대로)", () => {
    const src = loginScreen();
    expect(src, "URL이 없으면 링크도 감싸는 View도 없다").toContain("if (!documentUrl) return row;");
    expect(src, "링크의 낭독 라벨").toContain('accessibilityLabel={`${label} 전문 보기`}');
  });
});

/* ============================================================================================ */
/* GAP-079 트랙 A(#1) — **정확해진 저장 실패 문장이 소리로도 오는가**                                */
/* ============================================================================================ */

/**
 * ## 다섯 라운드가 올린 것은 정확도였고, 도달은 한 번도 세어지지 않았다
 *
 * 라운드 70 B가 저장 실패 문구에 표를 물렸고(`resolveSaveErrorCopy`), 73 E가 초대 참여·기기
 * 알림을, 76 A가 초대 생성을, 77 E가 훅의 문장을 버리지 않게, 78 A가 온보딩 갈래를 다섯으로
 * 만들었다. **문장의 정확도만 다섯 번 올랐다.** 그런데 그 문장이 서는 자리가 **소리로 오는지**를
 * 세는 계약은 오늘까지 없었다.
 *
 * 이 저장소는 그 관례를 이미 자기 소스에 문장으로 적어 두고 있다 —
 * `app/expenses/new.tsx`의 날짜 입력 오류 자리: *"입력 도중 나타나는 오류라 포커스가 TextInput에
 * 남아 있다 — 스크린리더가 스스로 읽어 주지 않으면 조용히 막힌다."* 그 조합은
 * `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` **둘 다**이고,
 * `src/ui.tsx`의 Toast는 거기에 `announceForA11y(message)`까지 얹는다(위 A11Y-115 스윕).
 * **이 블록은 새 관례를 만들지 않는다 — 있는 것을 대장에 연결한다.**
 *
 * ## 왜 **저장** 실패 대장만인가(조회 실패 대장 열넷은 이번에 열지 않는다)
 *
 * 가르는 근거는 **포커스가 어디 남는가** 하나다. 저장 실패는 눌린 [저장]·[초대 링크 만들기]
 * 버튼에 포커스가 남은 채로 문장이 그 버튼 **바로 위**에 서므로, 스크린리더가 스스로 읽지
 * 않으면 사용자는 실패했다는 사실 자체를 모른 채 같은 버튼을 다시 누른다. 조회 실패는 화면
 * 영역이 통째로 바뀌어 사용자가 다시 훑는다 — 자동 낭독이 실제로 필요한지가 다르다.
 * 그 답은 **실기기 확인 항목**이고(A-19/A-20), "필요하다"로 나오면 다음 라운드가 같은 형식으로
 * 조회 대장을 연다. ⚠️ **이 문단이 값으로 남는 이유**: 적지 않으면 다음 라운드가 같은 스윕을
 * 산문으로 다시 센다.
 */
const LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON =
  "조회 실패는 화면 영역이 통째로 바뀌어 사용자가 다시 훑는다 — 저장 실패는 눌린 버튼에 포커스가 " +
  "남은 채로 문장이 그 버튼 바로 위에 선다. 자동 낭독이 실제로 필요한지는 실기기 확인 항목(A-20)이고, " +
  "답이 '필요하다'면 다음 라운드가 같은 형식으로 조회 대장을 연다.";

/** 저장소의 낭독 관례 — 이 둘을 **함께** 걸어야 포커스가 남은 자리에서 문장이 소리가 된다. */
const ANNOUNCED_ALERT_PROPS = ['accessibilityRole="alert"', 'accessibilityLiveRegion="polite"'] as const;

/** 주석을 지우되 **자리(인덱스)는 그대로 둔다** — 구간 계산이 원본과 같은 좌표 위에서 이뤄져야 한다. */
function maskComments(sourceText: string): string {
  return sourceText
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_all, prefix: string, line: string) => prefix + line.replace(/./g, " "));
}

/** 여는 태그의 끝 `>` — 중괄호·따옴표 안의 `>`(화살표 함수·비교)는 세지 않는다. */
function openingTagEnd(masked: string, tagStart: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = tagStart; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return i;
  }
  return -1;
}

type JsxElement = {
  readonly openTag: string;
  /** 여는 태그의 시작 자리(태그 안의 자리를 묻는 데 쓴다). */
  readonly tagStart: number;
  /** 본문 구간 — 자기 닫힘 태그는 빈 구간이다. */
  readonly bodyStart: number;
  readonly bodyEnd: number;
};

/** 한 이름의 JSX 요소를 전부 모은다(같은 이름의 중첩을 센다 — 안쪽이 바깥쪽을 덮지 않게). */
function jsxElementsOf(masked: string, tagName: string): JsxElement[] {
  const found: JsxElement[] = [];
  const openPattern = new RegExp(`<${tagName}(?![A-Za-z0-9_])`, "g");
  const closeTag = `</${tagName}>`;
  let opened: RegExpExecArray | null;
  while ((opened = openPattern.exec(masked))) {
    const tagEnd = openingTagEnd(masked, opened.index);
    if (tagEnd < 0) continue;
    const openTag = masked.slice(opened.index, tagEnd + 1);
    if (openTag.endsWith("/>")) {
      found.push({ openTag, tagStart: opened.index, bodyStart: tagEnd + 1, bodyEnd: tagEnd + 1 });
      continue;
    }
    let level = 1;
    let cursor = tagEnd + 1;
    let bodyEnd = masked.length;
    while (level > 0) {
      const nextClose = masked.indexOf(closeTag, cursor);
      if (nextClose < 0) break;
      const nestedPattern = new RegExp(`<${tagName}(?![A-Za-z0-9_])`, "g");
      nestedPattern.lastIndex = cursor;
      const nested = nestedPattern.exec(masked);
      if (nested && nested.index < nextClose) {
        level += 1;
        cursor = nested.index + 1;
        continue;
      }
      level -= 1;
      cursor = nextClose + closeTag.length;
      if (level === 0) bodyEnd = nextClose;
    }
    found.push({ openTag, tagStart: opened.index, bodyStart: tagEnd + 1, bodyEnd });
  }
  return found;
}

/** 그 자리를 감싸는 **여는 태그** 하나(없으면 빈 문자열 — 태그 밖이라는 뜻이다). */
function enclosingOpenTag(masked: string, at: number): string {
  for (let i = at; i >= 0; i -= 1) {
    if (masked[i] !== "<") continue;
    if (!/[A-Za-z]/.test(masked[i + 1] ?? "")) continue;
    const end = openingTagEnd(masked, i);
    return end >= at ? masked.slice(i, end + 1) : "";
  }
  return "";
}

/**
 * 화면이 저장 실패 문장을 담는 이름들 — 훅의 답과 **그 답에서 파생한 이름**까지 따라간다.
 *
 * 손으로 적지 않는 이유가 이 트랙의 본체다: `useSaveErrorCopy(`의 답을 그대로 그리는 화면도 있고
 * (`app/settings/children.tsx` 셋), 주어 한 조각을 앞에 붙여 파생하는 화면도 있으며
 * (`app/settings/notifications.tsx`), 그 답을 모듈에 넘겨 받은 문장을 그리는 화면도 있다
 * (`app/family/invite.tsx`). 셋을 손 목록으로 적으면 넷째 모양이 생기는 날 조용히 새어 나간다.
 */
function saveErrorCopyNames(masked: string): string[] {
  const names = new Set<string>();
  const hookBinding = /const\s+([A-Za-z0-9_$]+)\s*=\s*useSaveErrorCopy\(/g;
  let bound: RegExpExecArray | null;
  while ((bound = hookBinding.exec(masked))) names.add(bound[1]);

  const declaration = /const\s+([A-Za-z0-9_$]+)\s*=\s*([^;]*?);/g;
  for (let pass = 0; pass < 2; pass += 1) {
    declaration.lastIndex = 0;
    let declared: RegExpExecArray | null;
    while ((declared = declaration.exec(masked))) {
      const [, declaredName, rightHandSide] = declared;
      if (names.has(declaredName)) continue;
      if ([...names].some((name) => new RegExp(`\\b${name}\\b`).test(rightHandSide))) names.add(declaredName);
    }
  }
  return [...names].sort();
}

/** 저장 실패 문장이 **그려지는** 한 자리와, 그 자리가 소리로 나가는 출구. */
type SaveErrorAnnounceSite = {
  readonly name: string;
  /** `live-region` = 관례 조합 · `toast` = 두 번째 출구(Toast가 스스로 announce한다) · `silent` = 낭독 밖. */
  readonly exit: "live-region" | "toast" | "silent";
};

/**
 * 한 화면 소스에서 "저장 실패 문장이 그려지는 자리"를 전부 찾아 출구를 매긴다.
 *
 * 자리로 세는 조건은 하나다: 위 이름 가운데 하나가 **`<Text>`의 본문 안**이거나
 * **`<Toast …/>`의 여는 태그 안**에 있는 것. 선언 자리(그 이름을 만드는 줄)는 어느 요소 안에도
 * 없으므로 저절로 빠진다. ⚠️ 한 요소가 같은 이름을 두 번 실어도 **자리는 하나**다
 * (`app/family/accept/[token].tsx`의 오프라인 갈래가 그 모양이다).
 */
function saveErrorAnnounceSitesOf(sourceText: string): SaveErrorAnnounceSite[] {
  const masked = maskComments(sourceText);
  const names = saveErrorCopyNames(masked);
  const texts = jsxElementsOf(masked, "Text");
  const toasts = jsxElementsOf(masked, "Toast");
  const seen = new Set<string>();
  const sites: SaveErrorAnnounceSite[] = [];

  for (const name of names) {
    const usage = new RegExp(`\\b${name}\\b`, "g");
    let used: RegExpExecArray | null;
    while ((used = usage.exec(masked))) {
      const at = used.index;
      const inText = texts
        .filter((element) => at >= element.bodyStart && at < element.bodyEnd)
        .sort((left, right) => right.bodyStart - left.bodyStart)[0];
      const inToast = toasts.find((element) => at >= element.tagStart && at < element.bodyStart);
      const host = inText ?? inToast;
      if (!host) continue;
      const key = `${name}@${host.tagStart}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (inText) {
        sites.push({
          name,
          exit: ANNOUNCED_ALERT_PROPS.every((prop) => inText.openTag.includes(prop)) ? "live-region" : "silent"
        });
        continue;
      }
      sites.push({ name, exit: "toast" });
    }
  }
  return sites;
}

const saveErrorAnnounceSites = (screen: string) => saveErrorAnnounceSitesOf(source(screen));

/**
 * ⚠️ **오늘 프롭을 걸 수 없는 자리와 그 이유 — 값으로 적는다. (오늘 그런 자리는 0건이다.)**
 *
 * 라운드 79 트랙 A의 소유는 화면 다섯과 계약 하나였다. 그때 네 자리
 * (`app/settings/children.tsx`의 편집·출생 전환·추가 셋 · `app/settings/notifications.tsx`의
 * 기기 토글 하나)의 `<Text>` 여는 태그는 **소유 밖 테스트 파일이 바이트 단위로 핀해 두어서**
 * 프롭을 한 칸도 더할 수 없었다 — 더하면 그 핀이 먼저 빨개진다. 그래서 그 넷은 이유를 값으로
 * 단 채 이 목록에 남았고, 목록이 다음 라운드에 넘긴 답은 한 줄이었다:
 * **핀을 모양으로 적으면 낭독 프롭이 설 수 있다**(트랙 C가 가족 여정의 두 자리에서 먼저 보인
 * 그 답 — 아래 `ROUND79_RELAXED_PIN_DEPENDENCY`).
 *
 * 라운드 79 통합이 그 답을 그대로 실행했다: 세 바이트 핀을 모양 핀으로 풀고
 * (`src/offline/messages.test.ts` 둘 · `src/children/child-born-transition.test.ts` 하나)
 * **같은 걸음에** 네 자리에 프롭 둘을 걸었다. 화면과 핀이 함께 움직였으므로 이 목록은 비었다.
 *
 * ⚠️ **비었어도 이 값과 그 형식이 남는 이유**: 다음에 같은 일이 생기면 제외가 산문이 아니라
 * **자기 무효화되는 값**으로 적혀야 한다. 각 줄은 ⓐ 화면에 그 구간이 실재하고 ⓑ 그 구간을
 * 붙드는 핀이 named 파일에 실재한다는 것을 함께 단언한다 — **핀이 사라지는 순간 그 줄이
 * 빨개져** 다음 사람이 프롭 둘을 거는 것을 잊을 수 없게 된다. 라운드 74 D가 조회 쪽 제외를
 * 산문에서 값으로 옮긴 그 규율 그대로이고, 이유는 빈 문자열일 수 없다.
 */
const SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN: Readonly<
  Record<
    string,
    {
      /** 화면 소스에 실재하는 그 구간 — 프롭을 한 칸 더하면 이 바이트가 사라진다. */
      readonly screenPin: string;
      /** 그 바이트를 붙들고 있는 **소유 밖** 소스 계약들. */
      readonly pinnedBy: ReadonlyArray<{ readonly file: string; readonly needle: string }>;
      readonly reason: string;
    }
  >
> = {};

/**
 * ⚠️ 빈 목록은 조용하다 — **비었다는 사실과 그 경위**를 값으로 남긴다(빈 목록이 "아무도 세지
 * 않았다"로 읽히지 않게). 라운드 79 트랙 A가 넷을 남겼고, 같은 라운드의 통합이 핀과 화면을
 * 함께 움직여 그 넷을 완결했다.
 */
const SAVE_ERROR_ANNOUNCE_NO_BLOCKED_SITES_REASON =
  "라운드 79 트랙 A가 소유 밖 바이트 핀 때문에 넷을 남겼고(children 셋 · notifications 하나), 같은 라운드의 통합이 " +
  "세 핀(src/offline/messages.test.ts 둘 · src/children/child-born-transition.test.ts 하나)을 모양 핀으로 풀면서 " +
  "같은 걸음에 그 네 자리에 낭독 프롭 둘을 걸었다. 그래서 대장 다섯 화면의 저장 실패 자리 일곱은 전부 낭독 출구를 가진다.";

/**
 * ⚠️ **다른 트랙이 바이트 핀을 모양 핀으로 풀어 준 자리 — 그 의존을 값으로 적는다.**
 *
 * 가족 여정의 두 자리(`app/family/invite.tsx`의 실패 줄 · `app/family/accept/[token].tsx`의 끝난
 * 초대 카드)는 종전에 **여는 태그까지 포함한 바이트**로 핀돼 있었다. 라운드 79 트랙 C가 그 둘을
 * *"태그의 바이트가 아니라 모양을 묻는다"* 로 바꾸면서(`<Text[^>]*style=…` · `<View[^>]*
 * accessibilityRole="alert"`) 이 트랙이 프롭을 걸 수 있게 됐다.
 *
 * 라운드 79 통합이 **같은 형식으로 세 자리를 더 풀었다** — 아이 관리 셋을 함께 붙들던 루프 핀,
 * 그 가운데 출생 전환 한 자리를 따로 붙들던 핀, 그리고 기기 토글 한 자리의 핀. 그 셋이 풀린
 * 덕에 위 `SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN`이 비었다.
 *
 * ⚠️ 그 완화가 사라지면 이 화면들은 다시 침묵으로 되돌아가야 한다 — 그래서 **의존을 단언으로**
 * 세운다. 되돌아가는 날 여기가 먼저 빨개져서, 그것이 사고가 아니라 결정이 되게 한다.
 */
const ROUND79_RELAXED_PIN_DEPENDENCY: ReadonlyArray<{ readonly file: string; readonly needle: string; readonly why: string }> = [
  {
    file: "src/family/invite-permissions.test.ts",
    needle: "expect(inviteSource).toMatch(/<Text[^>]*style=\\{\\{ color: theme\\.colors\\.danger \\}\\}>\\{inviteCreateErrorText\\}<\\/Text>/);",
    why: "초대 생성 실패 줄에 낭독 프롭 둘이 설 수 있는 근거"
  },
  {
    file: "src/family/invite-accept-messages.test.ts",
    needle: 'expect(card).toMatch(/<View[^>]*accessibilityRole="alert"/);',
    why: "끝난 초대 카드에 live region 한 칸이 설 수 있는 근거"
  },
  {
    file: "src/offline/messages.test.ts",
    // 라운드 70 리뷰 M-2의 루프 핀 — 세 뮤테이션 자리를 한 번에 붙들던 그 한 줄이다.
    // ⚠️ 그 핀은 템플릿 리터럴로 정규식을 만든다(백슬래시가 소스에 둘씩 적힌다) — 그래서 이
    // needle도 소스 바이트 그대로다: `String.raw`가 아니면 이 값이 소스와 어긋난다.
    needle: String.raw`<Text[^>]*style=\\{\\{ color: theme\\.colors\\.danger \\}\\}>`,
    why: "아이 관리 셋(편집·출생 전환·추가)의 실패 줄에 낭독 프롭 둘이 설 수 있는 근거"
  },
  {
    file: "src/children/child-born-transition.test.ts",
    needle:
      "/\\{markChildBorn\\.isError \\? <Text[^>]*style=\\{\\{ color: theme\\.colors\\.danger \\}\\}>\\{bornFailedText\\}<\\/Text> : null\\}/",
    why: "출생 전환 실패 줄을 따로 붙들던 두 번째 핀 — 셋 가운데 이 자리만 핀이 둘이었다"
  },
  {
    file: "src/offline/messages.test.ts",
    needle: "expect(src).toMatch(/<Text[^>]*style=\\{errorTextStyle\\}>\\{deviceToggleSaveErrorText\\}<\\/Text>/);",
    why: "기기 알림 토글 저장 실패 줄에 낭독 프롭 둘이 설 수 있는 근거"
  }
];

/**
 * ⚠️ **`accessibilityRole="alert"`가 홀로 선 자리와 그 이유** — 부정 단언의 제외 목록.
 *
 * 2026-08-30 실측으로 role 단독인 자리는 넷이었다(`src/onboarding/step-ui.tsx` ·
 * `app/family/accept/[token].tsx` 둘 · `app/(tabs)/items.tsx`). 이 라운드가 앞의 셋에 live
 * region을 걸었고 — **하필 그 셋이 라운드 70·78이 문장을 정확하게 만든 바로 그 카드들이다** —
 * 남는 하나는 실패가 아니라서 남는다. **이유가 값으로 있을 때만 제외다.**
 *
 * ⚠️ 라운드 79 통합이 더한 네 자리(`app/settings/children.tsx` 셋 ·
 * `app/settings/notifications.tsx` 하나)는 이 대장을 **한 줄도 바꾸지 않는다** — 관례는 언제나
 * **둘 다**이고, 넷 다 role과 live region을 한 걸음에 함께 걸었기 때문이다. 반쪽만 거는 날
 * 이 대장이 먼저 빨개지는 것이 이 부정 단언의 값이다.
 */
const ALERT_ROLE_WITHOUT_LIVE_REGION: Readonly<Record<string, { readonly places: number; readonly reason: string }>> = {
  "app/(tabs)/items.tsx": {
    places: 1,
    reason:
      "준비템 100% 축하 배너다 — 실패 문장이 아니다. 눌린 버튼에 포커스가 남은 자리도 아니고, 자동으로 끼어들어 읽어야 할 사실도 아니다(DNC-018: 구매를 재촉하지 않는다)."
  }
};

/**
 * ⚠️ **이 라운드가 실제로 더한 것 — 프롭뿐이다.**
 *
 * 여는 태그의 "이전 바이트"를 값으로 들고, 더한 프롭을 빼면 그것과 **정확히 같아진다**는 것을
 * 본다. 문장·스타일·조건은 한 글자도 손대지 않았다는 사실이 이 단언 하나로 선다
 * (`accessibilityRole`·`accessibilityLiveRegion`은 레이아웃 속성이 아니다 — 보이는 화면은
 * 한 픽셀도 바뀌지 않는다. 라운드 65가 hitSlop에서 쓴 그 판단과 같은 근거다).
 */
const ROUND79_ANNOUNCE_PROPS_ADDED: ReadonlyArray<{
  readonly file: string;
  readonly before: string;
  readonly after: string;
  readonly added: ReadonlyArray<string>;
  readonly what: string;
}> = [
  {
    file: "app/family/accept/[token].tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "초대 수락(POST) 저장 실패 줄 — 대장 다섯 화면 중 하나"
  },
  {
    file: "app/family/accept/[token].tsx",
    before: '<View accessibilityRole="alert">',
    after: '<View accessibilityLiveRegion="polite" accessibilityRole="alert">',
    added: ['accessibilityLiveRegion="polite"'],
    what: "끝난 초대 카드(라운드 70 A)와 수락 성공 후 뒤처리 실패 카드(라운드 60 #3) — role만 있고 live region이 없던 자리 둘"
  },
  {
    file: "app/family/invite.tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "초대 링크 만들기(POST) 저장 실패 줄 — 대장 다섯 화면 중 하나"
  },
  {
    file: "app/settings/children.tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "아이 관리 뮤테이션 실패 셋(편집·출생 전환·추가) — 대장 다섯 화면 중 하나. 라운드 79 통합이 루프 핀을 모양으로 풀며 함께 걸었다"
  },
  {
    file: "app/settings/notifications.tsx",
    before: "<Text style={errorTextStyle}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "같은 모양의 실패 줄 둘 — 손으로 적은 푸시 설정 저장 실패 한 줄(대장 밖)과, 라운드 79 통합이 핀을 푼 뒤 걸린 기기 토글 저장 실패 한 줄(대장 안)"
  },
  {
    file: "src/onboarding/step-ui.tsx",
    before: '<View accessibilityRole="alert">',
    after: '<View accessibilityLiveRegion="polite" accessibilityRole="alert">',
    added: ['accessibilityLiveRegion="polite"'],
    what: "OnboardingSaveErrorCard — 라운드 78 A가 갈래를 다섯으로 만든 그 카드(모듈 층의 한 자리)"
  }
];

describe("GAP-079 #1 저장 실패 문장의 낭독 계약 (대장에서 파생)", () => {
  it("ⓐ 대장 화면 전수 — 저장 실패 문장은 낭독되는 노드 안에 선다 (출구 둘: live region · Toast)", () => {
    // 모집단이 손 목록이 아니라 대장이라, 화면이 하나 늘면 그 화면도 이 질문을 자동으로 받는다.
    expect(OFFLINE_AWARE_SAVE_ERROR_SCREENS.length, "대장이 비면 이 스윕이 조용히 죽는다").toBeGreaterThan(0);

    const silent: string[] = [];
    let total = 0;
    for (const screen of OFFLINE_AWARE_SAVE_ERROR_SCREENS) {
      const sites = saveErrorAnnounceSites(screen);
      // 유령 방지: 대장의 화면은 저장 실패 문장을 **실제로 그린다**. 0건이면 스캔이 끊긴 것이고,
      // 끊긴 스캔 위에서는 아래 부정 단언이 영원히 초록이다(라운드 78 E가 이름 붙인 그 모양).
      expect(sites.length, `${screen}이 그리는 저장 실패 자리`).toBeGreaterThan(0);
      total += sites.length;
      for (const site of sites) {
        if (site.exit === "silent") silent.push(`${screen} ${site.name}`);
      }
    }

    // 오늘의 실측: 일곱 자리(맨 Text 여섯 + Toast 하나) — 자리 수는 라운드 79 트랙 A 때와 같다.
    // 더한 것이 프롭뿐이라 **자리는 하나도 늘거나 줄지 않았다**(아래 ⓓ가 그 사실을 따로 진다).
    expect(total, "대장 다섯 화면이 그리는 저장 실패 자리 합계").toBe(7);
    // 오늘의 값: 낭독 밖은 **0건**이다(트랙 A 뒤 넷 → 통합이 핀과 화면을 함께 움직여 0).
    expect(silent.sort(), "낭독 밖에 남은 저장 실패 자리").toEqual([]);
    // 그 0은 손으로 적은 값이 아니라 위 제외 목록에서 파생한다 — 제외가 다시 생기면 그 목록에
    // 이유가 값으로 적혀야 하고, 적히지 않은 침묵은 여기서 빨개진다.
    expect(silent.sort(), "낭독 밖에 남은 저장 실패 자리").toEqual(
      Object.keys(SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN).sort()
    );
  });

  it("ⓐ-2 제외는 자기 무효화된다 — 오늘 제외는 0건이고, 생기면 화면의 그 구간과 핀이 **둘 다** 실재해야 한다", () => {
    // 오늘의 값: 목록은 비었다(라운드 79 통합이 네 자리를 완결했다). 비었다는 **사실**도 값으로
    // 선다 — 형식만 남고 아무도 세지 않는 목록이 되지 않게.
    expect(Object.keys(SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN), "낭독 밖으로 남겨 둔 자리").toEqual([]);
    expect(SAVE_ERROR_ANNOUNCE_NO_BLOCKED_SITES_REASON.length, "비어 있는 경위").toBeGreaterThan(0);
    expect(SAVE_ERROR_ANNOUNCE_NO_BLOCKED_SITES_REASON).toContain("모양 핀");

    // 아래 규율은 제외가 다시 생기는 날을 위해 그대로 선다(줄이 생기면 곧바로 그 줄을 검사한다).
    for (const [key, entry] of Object.entries(SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN)) {
      const screen = key.slice(0, key.lastIndexOf(" "));
      expect(entry.reason.length, `${key}의 제외 사유`).toBeGreaterThan(0);
      expect(source(screen), `${key}: 화면의 그 구간`).toContain(entry.screenPin);
      expect(entry.pinnedBy.length, `${key}를 붙드는 핀`).toBeGreaterThan(0);
      for (const pin of entry.pinnedBy) {
        // ⚠️ 핀이 사라지면 이 줄이 빨개진다 — 그때가 프롭 둘을 거는 라운드다.
        expect(source(pin.file), `${key}를 붙드는 핀이 ${pin.file}에 실재한다`).toContain(pin.needle);
      }
    }
  });

  it("ⓐ-3 프롭이 설 수 있었던 근거도 값이다 — 모양으로 풀린 핀 다섯이 실재한다", () => {
    // 트랙 C가 푼 둘 + 라운드 79 통합이 푼 셋. 하나라도 바이트 핀으로 되돌아가면 여기가 빨개진다.
    expect(ROUND79_RELAXED_PIN_DEPENDENCY, "모양으로 풀린 핀").toHaveLength(5);
    for (const dependency of ROUND79_RELAXED_PIN_DEPENDENCY) {
      expect(dependency.why.length, `${dependency.file}의 의존 사유`).toBeGreaterThan(0);
      // ⚠️ 바이트 핀으로 되돌아가는 날 여기가 먼저 빨개진다 — 그것이 사고가 아니라 결정이 되게.
      expect(source(dependency.file), `${dependency.file}: 모양으로 적힌 핀`).toContain(dependency.needle);
    }
  });

  it("ⓑ 부정 단언 — 실패 문장 위에 role=\"alert\" **단독**인 자리가 0건이다 (남는 하나는 실패가 아니다)", () => {
    const roleOnly: Record<string, number> = {};
    const files = listComponentSources();
    expect(files.length, "컴포넌트 소스 스윕").toBeGreaterThan(20);
    for (const relativePath of files) {
      const masked = maskComments(source(relativePath));
      const pattern = /accessibilityRole="alert"/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(masked))) {
        const tag = enclosingOpenTag(masked, match.index);
        // 유령 방지: role은 언제나 여는 태그 안에 있다. 빈 문자열이면 스캐너가 끊긴 것이다.
        expect(tag.length, `${relativePath}: role을 감싸는 여는 태그`).toBeGreaterThan(0);
        if (tag.includes('accessibilityLiveRegion="polite"')) continue;
        roleOnly[relativePath] = (roleOnly[relativePath] ?? 0) + 1;
      }
    }

    const expected = Object.fromEntries(
      Object.entries(ALERT_ROLE_WITHOUT_LIVE_REGION).map(([file, entry]) => [file, entry.places])
    );
    expect(roleOnly, "role만 걸린 자리").toEqual(expected);
    for (const [file, entry] of Object.entries(ALERT_ROLE_WITHOUT_LIVE_REGION)) {
      expect(entry.reason.length, `${file}의 제외 사유`).toBeGreaterThan(0);
    }
  });

  it("ⓒ 재현 — 프롭을 뺀 소스가 실제로 빨개진다 (강화가 침묵으로 되돌아가지 않게)", () => {
    const screen = (tag: string) => `
      const failText = useSaveErrorCopy(save.isError, save.error);
      export default function Screen() {
        return (
          <View style={{ gap: 12 }}>
            {save.isError ? ${tag}{failText}</Text> : null}
          </View>
        );
      }
    `;
    // 프롭이 없으면 침묵이고, 관례 조합이 서면 낭독이다 — 그물이 실제로 두 답을 가른다.
    expect(saveErrorAnnounceSitesOf(screen("<Text style={{ color: theme.colors.danger }}>"))).toEqual([
      { name: "failText", exit: "silent" }
    ]);
    expect(
      saveErrorAnnounceSitesOf(
        screen('<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>')
      )
    ).toEqual([{ name: "failText", exit: "live-region" }]);
    // ⚠️ 한 짝만 걸면 여전히 침묵이다(관례는 **둘 다**이고, 반쪽은 라운드 78까지의 그 자리다).
    expect(saveErrorAnnounceSitesOf(screen('<Text accessibilityRole="alert" style={{}}>'))).toEqual([
      { name: "failText", exit: "silent" }
    ]);
    expect(saveErrorAnnounceSitesOf(screen('<Text accessibilityLiveRegion="polite" style={{}}>'))).toEqual([
      { name: "failText", exit: "silent" }
    ]);

    // 두 번째 출구도 같은 그물이 센다 — Toast는 프롭이 아니라 자기가 announce해서 통과한다.
    const toastScreen = `
      const saveErrorText = useSaveErrorCopy(save.isError, save.error);
      export default function Screen() {
        return <View>{save.isError ? <Toast message={saveErrorText} tone="error" /> : null}</View>;
      }
    `;
    expect(saveErrorAnnounceSitesOf(toastScreen)).toEqual([{ name: "saveErrorText", exit: "toast" }]);
    // 그 출구가 실제로 소리를 내는가 — 값으로 확인한다(위 A11Y-115 스윕과 같은 사실).
    const uiSource = source("src/ui.tsx");
    const toastAt = uiSource.indexOf("export function Toast");
    expect(toastAt, "Toast 컴포넌트").toBeGreaterThan(-1);
    const toastBlock = uiSource.slice(toastAt);
    expect(toastBlock).toContain("announceForA11y(message)");
    expect(toastBlock).toContain('accessibilityLiveRegion="polite"');
  });

  it("ⓓ 바이트 불변 — 더한 것은 프롭뿐이다 (문장·스타일·조건 무접촉)", () => {
    for (const entry of ROUND79_ANNOUNCE_PROPS_ADDED) {
      expect(source(entry.file), `${entry.file}: ${entry.what}`).toContain(entry.after);
      const stripped = entry.added.reduce((tag, prop) => tag.replace(` ${prop}`, ""), entry.after);
      expect(stripped, `${entry.file}: 프롭을 빼면 종전 바이트다`).toBe(entry.before);
      // 레이아웃 속성은 한 칸도 늘지 않았다(픽셀락과 무관한 변경이라는 근거).
      for (const prop of entry.added) {
        expect(prop, "레이아웃 속성 금지").toMatch(/^accessibility(Role|LiveRegion)="/);
      }
    }

    // 조건과 문장은 그대로다 — 네 자리의 갈래·문구가 한 글자도 바뀌지 않았다.
    const acceptScreen = source("app/family/accept/[token].tsx");
    expect(acceptScreen).toContain("{accept.isError && !inviteUnavailable ? (");
    expect(acceptScreen).toContain(
      "{acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error)}"
    );
    expect(acceptScreen).toContain("{joinRetryNotice && joinedResult ? (");
    expect(acceptScreen).toContain("<Text style={{ color: theme.colors.danger }}>{joinRetryNotice}</Text>");

    const inviteScreenSource = source("app/family/invite.tsx");
    expect(inviteScreenSource).toContain("{invite.isError ? (");
    expect(inviteScreenSource.match(/\{inviteCreateErrorText\}/g) ?? [], "실패 줄은 여전히 하나다").toHaveLength(1);

    const notificationsScreen = source("app/settings/notifications.tsx");
    expect(notificationsScreen).toContain("{toggleCurrentDevice.isError ? (");
    expect(notificationsScreen).toContain("푸시 설정을 바꾸지 못했어요. 알림 권한을 확인한 뒤 다시 시도해 주세요.");
    // 라운드 79 통합이 연 자리의 조건도 그대로다(문장 이름·갈래 한 글자도 바뀌지 않았다).
    expect(notificationsScreen).toContain("{toggleDevice.isError ? (");
    // 프롭 쌍은 이 화면에 **둘**이다 — 푸시 설정 한 줄과 기기 토글 한 줄. 같은 화면의 **조회**
    // 실패 줄(devicesLoadErrorText)은 이 트랙의 범위가 아니라 그대로 두었다는 사실이 수로 선다.
    expect(
      notificationsScreen.match(/accessibilityLiveRegion="polite" accessibilityRole="alert"/g) ?? [],
      "알림 화면의 프롭 쌍"
    ).toHaveLength(2);

    // 아이 관리 화면: 세 자리의 조건·문장·스타일이 그대로이고, 더한 것은 프롭 쌍뿐이다.
    const childrenScreen = source("app/settings/children.tsx");
    for (const [mutation, variable] of [
      ["markChildBorn", "bornFailedText"],
      ["saveEdit", "editFailedText"],
      ["addChild", "addFailedText"]
    ] as const) {
      expect(childrenScreen, `${variable} 자리의 조건·문장`).toContain(
        `{${mutation}.isError ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>{${variable}}</Text> : null}`
      );
    }
    // 프롭 쌍은 **셋**이다 — 같은 화면의 조회 실패 줄(loadErrorCopy.title)은 열지 않았다.
    expect(
      childrenScreen.match(/accessibilityLiveRegion="polite" accessibilityRole="alert"/g) ?? [],
      "아이 관리 화면의 프롭 쌍"
    ).toHaveLength(3);

    const stepUiSource = source("src/onboarding/step-ui.tsx");
    expect(stepUiSource).toContain(
      "<Card style={{ borderColor: theme.colors.danger, borderWidth: 1, gap: theme.spacing.gap }}>"
    );
    // 그 카드의 갈래·문장은 순수 모듈이 만든다 — 이 트랙은 그 자리를 열지 않았다.
    expect(stepUiSource).toContain("const text = message ?? onboardingSaveErrorMessage(error, { isOnline });");
    // 그 파일에 role 단독인 자리는 더 이상 없다(위 부정 단언의 화면 단위 확인).
    expect(maskComments(stepUiSource), "step-ui의 role 단독 자리").not.toContain('<View accessibilityRole="alert">');
  });

  it("ⓔ 조회 실패 대장을 이번에 열지 않는 이유가 값으로 적혀 있다 (포커스가 어디 남는가)", () => {
    // 두 대장은 겹치지 않는다 — 이 스윕의 모집단이 **저장** 쪽이라는 사실이 파생으로 선다.
    const loadOnly = OFFLINE_AWARE_LOAD_ERROR_SCREENS.filter(
      (screen) => !OFFLINE_AWARE_SAVE_ERROR_SCREENS.includes(screen)
    );
    expect(loadOnly.length, "조회 전용 화면").toBeGreaterThan(0);
    expect(LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON).toContain("포커스");
    expect(LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON).toContain("실기기");
    // 이 트랙은 조회 대장을 한 화면도 열지 않았다(범위 밖이라는 사실이 단언으로도 선다).
    for (const entry of ROUND79_ANNOUNCE_PROPS_ADDED) {
      expect(loadOnly, `${entry.file}은 조회 대장의 화면이 아니다`).not.toContain(entry.file);
    }
  });
});
