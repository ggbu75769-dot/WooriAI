import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
// GAP-090 트랙 A(#1): 준비템 검색 결과 줄이 **소리로** 나갈 때의 그 한 문장. 값 계약은 그 모듈의
// 테스트가 지고, 여기서는 **화면이 그리는 줄과 글자가 같은가**(눈과 귀)를 실행해서 맞춰 본다.
import { searchResultCountAnnouncement } from "./preparation/search-draft";
// GAP-095 트랙 A(#1): *선택됐는데 못 고르는* 갈래가 소리를 잃지 않음을 **순수 함수의 값으로** 문다.
// 문구 계약은 src/month-jump.test.ts가 지고, 여기서는 그 값이 라벨과 상태로 **나뉘어** 있는가만 본다.
import { buildMonthJumpYear, MONTH_JUMP_FUTURE_HINT } from "./month-jump";
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
    // 라운드 85 트랙 C: 합계에서 멈추던 문장이 **각 점의 달과 값**까지 읽는다 — 접근성
    // 체크리스트 13행("추세를 문장으로 듣는다")이 그전에는 과장이었다(계열 0건).
    expect(chartBlock).toContain(
      "`${title} 추이 차트, 합계 ${value}${hasRealDelta ? `, 지난 달 대비 ${deltaText}` : \"\"}${seriesText ? `, ${seriesText}` : \"\"}`"
    );
    // 계열 문구는 이 파일이 짓지 않는다 — 순수 모듈이 yearMonth와 formatKrw로 만든다.
    expect(chartBlock).toContain("const seriesText = axisLabels ? pointLabels?.accessibilitySeries ?? null : null;");
    expect(source("src/reports/trend-point-labels.ts")).toContain("export function buildTrendPointLabels");
    // 실데이터 갈래에만 붙는다: 장식 폴백(점 2개 미만)·빈 상태·비세션은 seriesText가 null이라
    // 낭독 문자열이 종전과 한 글자도 다르지 않다.
    expect(chartBlock).toContain("!noticeText && hasRealData && pointLabels && pointLabels.labels");
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
    // ⚠️ **두 시점(라운드 95 리뷰 M-6) · 핀 이관.** 옛 바이트(보존):
    // `expenseDatePickerCellAccessibilityLabel(cell, { selectedIso, todayIso, direction })`.
    // 트랙 A가 라벨에서 "선택됨"을 걷은 뒤 selectedIso는 라벨 함수가 읽지 않는 유령 인자였고,
    // 리뷰 M-6이 타입을 옵셔널로 내리며 호출부에서 걷었다 — 선택 여부는 아래 상태 프롭이 진다.
    expect(pickerSource).toContain("expenseDatePickerCellAccessibilityLabel(cell, { todayIso, direction })");
    expect(pickerSource).toContain('accessibilityRole="button"');
    expect(pickerSource).toContain("accessibilityState={{ selected }}");
    // 라벨 문구(오늘/날짜)는 순수 모듈이 만들고 date-picker-month.test.ts가 핀한다.
    // ⚠️ **두 시점(라운드 95 트랙 A)**: 이 줄은 `라벨 문구(오늘/선택됨/날짜)`라고 적고 있었다 —
    // 선택 여부는 이제 라벨이 아니라 바로 윗줄의 상태 프롭 하나가 진다.
    expect(source("src/expenses/date-picker-month.ts")).toContain("export function expenseDatePickerCellAccessibilityLabel");
  });

  it("고를 수 없는 날은 **왜** 못 고르는지를 라벨에 싣는다 (누를 수 없는 요소로 남는다)", () => {
    // 가져오기 검수의 잠긴 행과 같은 관례다 — 비활성 요소를 조용히 지나가게 두지 않고 이유를
    // 낭독한다. 셀 자체는 Pressable이 아니므로 button 역할·disabled 상태를 흉내 내지 않는다.
    const pickerSource = source("src/expenses/ExpenseDatePicker.tsx");
    // ⚠️ **두 시점(라운드 95 트랙 A) · 핀 이동.** 이 줄은 여는 태그를 한 줄 바이트로 물고 있었다:
    // `"<View accessible accessibilityLabel={accessibilityLabel} key={cell.key} style={cellStyle}>"`.
    // 그 가지가 상태 프롭 하나(`accessibilityState={{ selected }}`)를 지면서 여러 줄이 됐다 —
    // 순수 모듈이 라벨에서 "선택됨"을 걷었으므로, 선택됐는데 못 고르는 칸이 그 사실을 잃지 않게
    // 하려는 것이다. 그래서 바이트 하나 대신 **그 가지를 잘라** 든 것과 안 든 것을 함께 문다.
    // ⚠️ 주석을 걷은 뒤에 자른다 — 두 시점 규율이 옛 바이트와 *걸지 않은 프롭*의 이유를 주석에
    // 남기라고 하므로, 걷지 않으면 정직하게 적은 손이 아래 부정 단언에서 빨강을 맞는다.
    const maskedPicker = maskComments(pickerSource);
    const branchStart = maskedPicker.indexOf("if (!selectable) {");
    expect(branchStart, "못 고르는 가지를 소스에서 찾지 못했다").toBeGreaterThan(-1);
    const branchEnd = maskedPicker.indexOf("{dayText}", branchStart);
    expect(branchEnd, "그 가지의 끝을 찾지 못했다").toBeGreaterThan(branchStart);
    const unselectableBranch = maskedPicker.slice(branchStart, branchEnd);
    expect(unselectableBranch, "여는 태그").toContain("<View");
    expect(unselectableBranch, "그 자체로 하나의 낭독 노드다").toContain("accessible");
    expect(unselectableBranch, "라벨은 순수 모듈이 준다").toContain("accessibilityLabel={accessibilityLabel}");
    expect(unselectableBranch, "선택 여부는 상태가 진다").toContain("accessibilityState={{ selected }}");
    // 종전 규율은 그대로다 — 누를 수 없는 요소이지 **비활성 버튼**이 아니다(이유는 라벨이 말한다).
    expect(unselectableBranch, "button 역할을 흉내 내지 않는다").not.toContain('accessibilityRole="button"');
    expect(unselectableBranch, "disabled를 흉내 내지 않는다").not.toContain("disabled");
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
      expect(src, `${path}의 목적지`).toMatch(/onPress=\{\(\) => router\.push\([^)]*"\/login"\)\}/);
    }
    /**
     * 라운드 96 T6 — **앵커 교체**: 버튼 글자가 목적지를 말한다. 종전 앵커는 네 자리 모두
     * `actionLabel="확인"`이었는데, "확인"은 눌러서 무엇이 되는지 말하지 않는 라벨이었다
     * (낭독으로는 "확인, 버튼"뿐이라 로그인 화면으로 이동한다는 사실이 소리에 없다).
     * 잠금 카드 셋은 "로그인하기", 정기 지출 카드는 지금 막고 있는 조건 쪽 목적지를 그대로
     * 말한다(토큰 없음 → 로그인하기 · 아이 미선택 → 아이 선택하러 가기).
     */
    for (const path of ["app/settings/app-lock.tsx", "app/settings/children.tsx", "app/settings/notifications.tsx"]) {
      expect(source(path), `${path}의 비세션 카드`).toContain('actionLabel="로그인하기"');
    }
    expect(source("app/expenses/recurring.tsx"), "정기 지출 비세션 카드").toContain(
      'actionLabel={authToken ? "아이 선택하러 가기" : "로그인하기"}'
    );
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
    // ⚠️ 두 시점(라운드 94 트랙 A) — 이 두 핀이 물던 낭독 바이트는
    //   ? `${visibleProfile.nickname}네, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`
    //   : `${visibleProfile.nickname}네, ${sessionStageLabel}, 프로필 관리`
    // 였다. 받침 있는 별명이
    // 들어오면 낭독이 "지훈네"가 되어 화면과 함께 틀렸다("지훈이네"). 트랙 A가 그 `네`를
    // nameWithHonorificSuffix()로 옮겼고 **이 핀은 그 자리를 따라간다** — 이 계약이 무는 것은
    // 접미사 바이트가 아니라 *보이는 줄과 낭독이 같은 한 값을 지난다*는 사실이고, 그 사실은 불변이다.
    expect(moreSource).toContain(
      "? `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`"
    );
    expect(moreSource).toContain(
      ": `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${sessionStageLabel}, 프로필 관리`"
    );
  });

  it("판정의 원천은 이미 조회 중인 ['children'] 캐시이고, 화면이 주차를 다시 세지 않는다", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    // 라운드 82 D(#4): 판정의 원천은 종전과 같은 `["children"]` 캐시이고, **게이트만** 하나가
    // 됐다 — 이름도 같은 행에서 오므로 `/home` 응답이 도착할 때까지 기다릴 이유가 사라졌다.
    expect(moreSource).toContain(
      "const selectedChild = childId ? children.data?.children.find((child) => child.id === childId) : undefined;"
    );
    expect(moreSource).toContain("stageMode: selectedChild?.stageMode,");
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
    // 종전(라운드 63 GAP-063~라운드 92): `${input.values.nickname.trim()}를 추가하고…` — 조사 `를`이
    // 이름과 무관하게 고정이었다("지훈를"). 라운드 93 트랙 B가 이름을 addedName 한 자리로 모으고
    // objectParticle(받침 판정)로 조사를 값에서 고르면서 이 핀도 오늘의 줄로 옮긴다(두 시점).
    expect(childrenSource).toContain(
      "announceForA11y(`${addedName}${objectParticle(addedName)} 추가하고 선택했어요.${switchNotice}`);"
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
    // ⚠️ 두 시점(라운드 96 T5): 종전 핀은 두 형태 표기 `.toContain("(으)로 전환했어요.")` 였다 —
    // 그 자리가 조사를 값에서 고르는 꼴(directionParticle)로 이관되며 핀도 오늘의 바이트를 따라간다.
    expect(source("src/children/child-switch.ts")).toContain("${directionParticle(child.nickname)} 전환했어요.");
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
    // 라운드 98 리뷰 M-1(핀 동반 이관): 그 트리거가 press 피드백을 얻어 style이 함수꼴이 됐다 —
    // 인용 원본의 기준 객체는 그 함수 안에 바이트 그대로 남아 있으므로, 여기서는 객체를 문다
    // (종전에는 `style={{ … }}` 정적 꼴 전체를 물었다).
    expect(source("app/(tabs)/records.tsx")).toContain(
      '{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }'
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
 * ⚠️⚠️ **두 시점 — 위 괄호의 인용은 라운드 65의 문장이지 오늘의 근거가 아니다**
 * (라운드 92 리뷰 M-3 · 이 계약이 무는 값은 한 글자도 바뀌지 않는다).
 *  · **라운드 65 시점**: 그 주석의 이유가 곧 이 계약의 근거였다 — 바깥 스크롤러가 기본값이라
 *    첫 탭이 통째로 먹혔다.
 *  · **오늘(라운드 92 A + 리뷰 H-2)**: 그 화면의 **안쪽** 칩 줄 여덟이 저마다 `"handled"`를
 *    명시해 첫 탭이 칩에 닿고(`src/keyboard-tap-guard.test.ts`), 그때 사라진 자동 blur는
 *    `applyMerchantSuggestion`이 손으로 되돌린다. 그래서 그 주석의 **결론**만 살아 있고
 *    **이유**는 그 파일의 ①②③ 세 시점에 있다 — 이 계약이 무는 *세 스캐폴드*는 그 갈림과
 *    무관하게 오늘도 옳다.
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
    // ⚠️ **두 시점(라운드 95 트랙 A) · 핀 이동.** 이 줄은 여는 태그를 한 줄 바이트로 물고 있었다:
    // `"<View accessible accessibilityLabel={cell.accessibilityLabel}"`. 그 가지가 상태 프롭 하나
    // (`accessibilityState={{ selected: cell.isSelected }}`)를 지면서 여러 줄이 됐다 — 순수 모듈이
    // 라벨에서 "선택됨"을 걷었으므로, 선택됐는데 못 고르는 칸이 그 사실을 잃지 않게 하려는 것이다.
    // ⚠️ 주석을 걷은 뒤에 자른다(두 시점 주석이 아래 부정 단언에 걸리지 않게).
    const maskedSheet = maskComments(sheetSource);
    const cellBranchStart = maskedSheet.indexOf("if (!cell.isSelectable) {");
    expect(cellBranchStart, "못 고르는 가지를 소스에서 찾지 못했다").toBeGreaterThan(-1);
    const cellBranchEnd = maskedSheet.indexOf("<Text style={labelStyle}>", cellBranchStart);
    expect(cellBranchEnd, "그 가지의 끝을 찾지 못했다").toBeGreaterThan(cellBranchStart);
    const unselectableBranch = maskedSheet.slice(cellBranchStart, cellBranchEnd);
    expect(unselectableBranch, "여는 태그").toContain("<View");
    expect(unselectableBranch, "그 자체로 하나의 낭독 노드다").toContain("accessible");
    expect(unselectableBranch, "라벨은 순수 모듈이 준다").toContain("accessibilityLabel={cell.accessibilityLabel}");
    expect(unselectableBranch, "선택 여부는 상태가 진다").toContain("accessibilityState={{ selected: cell.isSelected }}");
    expect(unselectableBranch, "button 역할을 흉내 내지 않는다").not.toContain('accessibilityRole="button"');
    // 칸에는 disabled가 붙지 않는다 — 이 파일의 disabled는 연도 스테퍼 두 자리뿐이다.
    expect(maskedSheet.match(/disabled=\{/g) ?? []).toHaveLength(2);
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

  /*
   * ⚠️ 라운드 80 트랙 A — 바늘이 **렌더 자리**를 가리키게 한 칸 좁혔다(단언은 그대로다).
   *
   * 이 라운드가 세 자리에 `announceForA11y(importFailureMessage(…))` 배선을 얹으면서 같은 호출이
   * 파일 안에 **두 번** 서게 됐다(그리는 자리 하나 · 읽는 자리 하나). 종전 바늘
   * (`importFailureMessage("upload"`)은 그중 앞의 것(=effect)을 집으므로, 아래 질문("그 문장이
   * 서는 노드가 Text인가")이 렌더가 아닌 자리를 묻게 된다. 바늘 앞에 `{` 한 칸을 더하면 JSX
   * 표현식 컨테이너 안의 **그리는 자리**만 남는다 — 묻는 것은 종전과 같고, 자리만 정확해진다.
   */
  it("업로드 실패는 보이는 Text로 읽힌다 (색·배지 톤만으로 말하지 않는다)", () => {
    const src = uploadScreen();
    const at = src.indexOf('{importFailureMessage("upload"');
    expect(at, "업로드 실패 문구가 화면에 걸려 있다").toBeGreaterThan(-1);
    // 그 문장이 서는 노드는 Text다 — 바로 앞 여는 태그를 확인한다.
    expect(src.slice(0, at).lastIndexOf("<Text")).toBeGreaterThan(src.slice(0, at).lastIndexOf("</Text>"));
  });

  it("행 편집·확정 실패도 각각 보이는 Text로 읽힌다 (두 자리가 한 문장을 돌려 쓰지 않는다)", () => {
    const src = reviewScreen();
    for (const kind of ["row_edit", "confirm"]) {
      const at = src.indexOf(`{importFailureMessage("${kind}"`);
      expect(at, `${kind} 실패 문구가 화면에 걸려 있다`).toBeGreaterThan(-1);
      expect(src.slice(0, at).lastIndexOf("<Text"), `${kind}의 Text 노드`).toBeGreaterThan(
        src.slice(0, at).lastIndexOf("</Text>")
      );
    }
    // 두 자리가 서로 다른 종류를 넘긴다(같은 값을 넘기면 같은 문장이 두 번 서는 종전 상태다).
    expect(src.indexOf('{importFailureMessage("row_edit"')).not.toBe(src.indexOf('{importFailureMessage("confirm"'));
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

  /**
   * ⚠️ **라운드 80 트랙 A — 이 describe의 제목이 아홉 라운드 만에 사실이 된다.**
   *
   * 위 셋은 ⓐ 각자 다른 문장인가 · ⓑ **보이는** Text로 서는가 · ⓒ 화면이 다시 짓지 않는가를
   * 묻는다. 제목은 *낭독 계약*인데 묻는 것은 **가시성**이었고, 그 사이 이 화면은 성공만 소리로
   * 말해 주고 있었다(`announceForA11y` 두 자리가 **둘 다 성공**이다). 종전 셋은 **바이트 불변**
   * 으로 두고, 넷째가 제목이 원래 말하던 것을 잇는다 — **그 문장이 소리로 오는가.**
   *
   * 판정은 이 파일이 아래에서 방아쇠로 파생하는 그 스윕이 낸다(손 목록이 아니다).
   */
  it("네 문장이 실제로 낭독된다 (제목이 말하던 그것을 넷째가 묻는다)", () => {
    const sites = mutationTriggerSitesOf(privacyScreen(), "app/settings/privacy.tsx").filter(
      (site) => site.trigger === "mutation"
    );
    // 이 화면의 뮤테이션 방아쇠 자리는 일곱이다 — 확정 셋 · 동의 갱신 하나 · 파기 미리보기 셋.
    expect(sites.length, "이 화면의 뮤테이션 방아쇠 자리").toBe(7);
    expect(
      sites.filter((site) => site.exit !== "announce"),
      "낭독 밖에 남은 자리"
    ).toEqual([]);
    // 되돌릴 수 없는 흐름 넷의 문장이 그 안에 있다(위 셋이 묻는 그 네 자리와 같은 자리다).
    const guards = sites.map((site) => site.guard);
    for (const guard of [
      "childDelete.isError",
      "householdLeave.isError",
      "accountDelete.isError",
      "reconsent.isError || consentToggle.isError"
    ]) {
      expect(guards, `${guard}의 낭독 자리`).toContain(guard);
    }
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
 * GAP-086 #2(라운드 86 트랙 B) — **ONB-003의 조회 실패 탈출구가 소리로 도달하는가.**
 *
 * 위 블록(GAP-072 ⓐ)이 무는 것은 **저장이 실패했을 때**의 로컬 탈출구다. 그 옆에 같은 화면의
 * 다른 실패가 하나 더 있다 — **목록 조회가 실패한 자리**. 그 자리의 유일한 길이 오래 [건너뛰기]
 * 하나로 읽혀 왔는데(3초짜리 네트워크 실패가 "준비물 0개"로 굳는 그 길), 실제로는 다시 해 볼
 * 버튼이 이미 서 있었다. 이 라운드가 한 일은 **그 사실을 문장이 말하게 한 것**이고, 그러면
 * 문장과 버튼이 한 짝이 되므로 낭독 계약도 한 짝으로 선다.
 *
 * 묻는 것은 위 블록과 같은 셋이다: ⓐ 노드가 **조건이 성립할 때만** 서는가(0건 갈래에서 낭독되는
 * 버튼은 가짜 버튼이다), ⓑ 역할과 라벨이 **소리로 도달**하는가(공유 프리미티브가 역할을 지고
 * 라벨이 그 자식 Text다 — 맨 Pressable로 바뀌면 역할이 사라진다), ⓒ 라벨↔onPress 짝이 붙어
 * 있고 그 목적지가 **라벨이 말한 일**(같은 조회를 다시 부르기)인가.
 *
 * ⚠️ 문구는 여기서 다시 단언하지 않는다 — 이 화면의 실패 문장은 공용 단일 소스에서 오고
 * (`src/offline/messages.test.ts`가 그 값을 진다), 이 블록이 붙드는 것은 **소리 나는 자리**다.
 */
describe("GAP-086 ⓔ ONB-003 조회 실패 탈출구의 낭독 계약", () => {
  const screen = () => source("app/(onboarding)/prepared-items.tsx");
  const RETRY_LABEL = 'label="목록 다시 불러오기"';

  it("조건이 성립할 때만 노드가 선다 (0건 갈래에서 낭독되는 버튼이 없다)", () => {
    const src = screen();
    const at = src.indexOf(RETRY_LABEL);
    expect(at, "탈출구 버튼").toBeGreaterThan(-1);
    const guardAt = src.lastIndexOf("{itemsQuery.isError ? (", at);
    expect(guardAt, "그 버튼의 조건").toBeGreaterThan(-1);
    // 조건은 **조회 실패 하나**다 — 준비물이 0건이라 뜬 갈래는 실패가 아니므로 이 버튼이 서지
    // 않는다(두 갈래를 더 벌린 이 라운드의 판정이 소리 쪽에서도 같다).
    const block = src.slice(guardAt, at);
    expect(block, "0건 갈래가 조건에 섞이지 않는다").not.toContain("hasOptions");
    // 조건이 거짓이면 노드 자체가 없다 — 비활성 버튼으로 남기지 않는다(달력 미래 칸 A-4 #23).
    expect(block, "조건 거짓이면 노드 0개").not.toContain("disabled={!itemsQuery.isError}");
  });

  it("역할과 라벨이 소리로 도달한다 (공유 프리미티브가 역할을 진다)", () => {
    const src = screen();
    const at = src.indexOf(RETRY_LABEL);
    expect(at, "탈출구 버튼").toBeGreaterThan(-1);
    const tagAt = src.lastIndexOf("<", at);
    expect(tagAt, "그 라벨이 붙은 태그").toBeGreaterThan(-1);
    // 맨 Pressable이 아니라 TextButton이다 — 역할·라벨이 그 한 벌에서 온다.
    expect(src.slice(tagAt, at), "공유 프리미티브").toContain("<TextButton");
    const primitive = source("src/ui.tsx");
    const primitiveAt = primitive.indexOf("export function TextButton(");
    expect(primitiveAt, "공유 프리미티브 선언").toBeGreaterThan(-1);
    const body = primitive.slice(primitiveAt, primitiveAt + 900);
    expect(body, "역할").toContain('accessibilityRole="button"');
    // 라벨은 자식 Text로 그려진다 — 눈이 읽는 글자와 귀가 듣는 글자가 같은 한 값이다.
    expect(body, "라벨이 소리로 도달한다").toContain("{label}");
  });

  it("라벨↔onPress 짝이 붙어 있고, 목적지가 라벨이 말한 일이다 (같은 조회를 다시 부른다)", () => {
    const src = screen();
    const at = src.indexOf(RETRY_LABEL);
    expect(at, "탈출구 버튼").toBeGreaterThan(-1);
    const tagEnd = src.indexOf("/>", at);
    expect(tagEnd, "그 태그의 끝").toBeGreaterThan(at);
    const tag = src.slice(src.lastIndexOf("<TextButton", at), tagEnd);
    // 목적지가 붙어 있다(라벨만 낭독되는 가짜 버튼이 아니다).
    expect(tag, "목적지").toContain("onPress={() => void itemsQuery.refetch()}");
    // 다시 부르는 동안에는 눌리지 않는다 — 같은 조회가 겹쳐 나가지 않는다.
    expect(tag, "조회 중 비활성").toContain("disabled={itemsQuery.isFetching}");
    // 그리고 그 refetch는 **있는 조회**의 것이다(이 화면의 쿼리는 하나뿐 · 새 선언 0건).
    expect(src.match(/useQuery\(/g) ?? [], "쿼리 선언").toHaveLength(1);
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
/*
 * ⚠️ **라운드 80 트랙 A가 이 사유를 정정한다 — 가르는 것은 대장이 아니라 방아쇠였다.**
 *
 * 위 문단은 이 축을 "저장 대장 / 조회 대장"으로 적었는데, 실측은 그 두 대장이 이 질문의 단위가
 * 아니라고 답했다: 조회 대장 안에 **뮤테이션이 세우는 문장이 셋** 있었고(`app/settings/privacy.tsx`의
 * 파기 미리보기 — `useLoadErrorCopy`의 문장을 쓰지만 방아쇠는 `.mutate()`다), 대장 **밖**에 같은
 * 모양이 열이 더 있었다. 그래서 정정된 사유는 대장이 아니라 **무엇이 그 문장을 세웠는가**를 말한다.
 * 정정 뒤에도 이 트랙(라운드 79)의 범위는 한 글자도 넓어지지 않는다 — 넓힌 것은 GAP-080의
 * 별도 스윕이고, 그 모집단이 방아쇠다(아래 `ANNOUNCE_UNIT_IS_THE_TRIGGER_REASON`).
 */
const LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON =
  "가르는 것은 대장이 아니라 방아쇠다 — 쿼리가 세운 실패는 화면 영역이 통째로 바뀌어 사용자가 다시 훑고, " +
  "뮤테이션(누름)이 세운 실패는 눌린 컨트롤에 포커스가 남은 채로 문장이 그 바로 곁에 맨 줄로 선다. " +
  "자동 낭독이 쿼리 자리에도 실제로 필요한지는 실기기 확인 항목(A-20 #85)이고, 답이 '필요하다'면 다음 " +
  "라운드가 같은 형식으로 그 모집단을 연다.";

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
        // 라운드 79 리뷰(P-1): **자기 닫힘 중첩은 중첩이 아니다.** `<Text …/>`는 닫는 태그를
        // 소비하지 않으므로 level을 올리면 바깥 요소의 본문 끝이 한 칸 밀리고, 그 뒤의 자리가
        // 통째로 바깥 본문에 삼켜진다(위 여는 태그 판정과 **같은 기준**을 여기에도 적용한다).
        const nestedEnd = openingTagEnd(masked, nested.index);
        if (nestedEnd >= 0 && masked.slice(nested.index, nestedEnd + 1).endsWith("/>")) {
          cursor = nestedEnd + 1;
          continue;
        }
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

/**
 * ⚠️ **라운드 79 리뷰(M-1) — 프롭 둘은 한 플랫폼의 답이다.**
 *
 * `accessibilityLiveRegion`은 React Native 문서가 **`@platform android`** 로 표시한 프롭이고,
 * `accessibilityRole="alert"`에는 iOS/VoiceOver에서 대응하는 트레이트가 없다. 그래서 프롭
 * 조합만 걸린 자리의 "낭독 밖 0건"은 **안드로이드 한정**이었다 — iOS에서는 화면에 문장이 서도
 * 아무 소리가 나지 않는다.
 *
 * 이 저장소의 크로스플랫폼 답은 이미 있었다: `announceForA11y`(`src/ui.tsx` — `AccessibilityInfo.
 * announceForAccessibility`를 best-effort로 감싼다)이고, `app/(auth)/login.tsx`가 **같은 이유**로
 * (포커스가 눌린 버튼에 남는다) 실패 문장에 그것을 건다. Toast는 프롭과 announce를 **둘 다** 진다.
 */
const ANDROID_ONLY_LIVE_REGION_REASON =
  "accessibilityLiveRegion은 @platform android 프롭이고 accessibilityRole=\"alert\"에 대응하는 VoiceOver 트레이트가 " +
  "없다 — 프롭 조합만으로는 iOS에서 아무 소리도 나지 않는다. 크로스플랫폼 출구는 announceForA11y이고, " +
  "app/(auth)/login.tsx가 같은 이유(포커스가 눌린 버튼에 남는다)로 이미 그 관례를 쓴다.";

/** 저장 실패 문장이 **그려지는** 한 자리와, 그 자리가 소리로 나가는 출구. */
type SaveErrorAnnounceSite = {
  readonly name: string;
  /**
   * `announce` = 관례 조합 + `announceForA11y` 배선(**두 플랫폼 다**) ·
   * `live-region` = 프롭 조합만(**안드로이드 한정** — 위 `ANDROID_ONLY_LIVE_REGION_REASON`) ·
   * `toast` = 두 번째 출구(Toast가 프롭과 announce를 스스로 진다) · `silent` = 낭독 밖.
   */
  readonly exit: "announce" | "live-region" | "toast" | "silent";
};

/**
 * `이름(` 호출 하나의 **괄호 구간**(문자열 안의 괄호는 세지 않는다). 낭독 배선이 실제로
 * `useEffect` 안에 있는지를 묻는 데 쓴다 — 렌더 도중 부르면 같은 문장을 매 렌더 다시 읽는다.
 */
function callBlocksOf(masked: string, calleeName: string): string[] {
  const blocks: string[] = [];
  const pattern = new RegExp(`\\b${calleeName}\\(`, "g");
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const open = found.index + found[0].length - 1;
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < masked.length; i += 1) {
      const char = masked[i];
      if (quote) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(masked.slice(open, i + 1));
          break;
        }
      }
    }
  }
  return blocks;
}

/** `useEffect` 안에서 `announceForA11y(...)`로 실제로 읽히는 이름들. */
function announcedSaveErrorNames(masked: string, names: readonly string[]): Set<string> {
  const announced = new Set<string>();
  for (const block of callBlocksOf(masked, "useEffect")) {
    if (!block.includes("announceForA11y(")) continue;
    for (const name of names) {
      if (new RegExp(`announceForA11y\\([^;]*\\b${name}\\b`).test(block)) announced.add(name);
    }
  }
  return announced;
}

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
  const announced = announcedSaveErrorNames(masked, names);
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
        const hasProps = ANNOUNCED_ALERT_PROPS.every((prop) => inText.openTag.includes(prop));
        // 라운드 79 리뷰(M-1): 출구는 **세 칸**이다 — 프롭만이면 안드로이드 한정(`live-region`),
        // announce까지 서 있어야 두 플랫폼 다(`announce`)다.
        sites.push({ name, exit: hasProps ? (announced.has(name) ? "announce" : "live-region") : "silent" });
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

/* -------------------------------------------------------------------------------------------- */
/* 라운드 88 트랙 E(#5) — **프롭 대장 둘의 파생 판정**                                             */
/* -------------------------------------------------------------------------------------------- */

/**
 * ## 대장은 *무엇을 했는가*만 적었다 — 라운드 87의 결함이 태어난 그 자리다
 *
 * 아래 두 대장(`ROUND79_ANNOUNCE_PROPS_ADDED` 여섯 · `ROUND80_ANNOUNCE_PROPS_ADDED` 셋)은
 * *"그 자리에 프롭을 걸었고, 빼면 종전 바이트다"* 를 정확하게 진다. 그런데 그 기록만으로는
 * **그것이 충분한가**를 알 수 없다. 라운드 87 리뷰(AB-4)가 이름 붙인 모양이 바로 그것이다:
 * `src/onboarding/step-ui.tsx`는 *"모듈 층의 한 자리"* 라고 정확히 적힌 채 대장에 서 있었고
 * 프롭 둘도 실재했지만, **그 조합이 안드로이드 한정이라는 판정은 어디에도 없어서** 대장에
 * 이름이 있다는 사실이 *"세어졌다"* 로 읽혔다. 라운드 87 C가 그 **한 자리**를 닫았지만 대장의
 * **모양**은 그대로였다 — 열째 항목이 붙는 날 같은 착시가 다시 난다.
 *
 * ⚠️ 그래서 이 트랙이 더하는 것은 자리가 아니라 **칸 하나**다: 항목마다 그 자리의 낭독 출구를
 * **소스에서 분류**하고(`announce`/`live-region`/`toast`), 판정이 `live-region`을 부르면
 * 그 항목의 `crossPlatform`이 **빈 문자열일 수 없게** 한다. 판정은 손으로 적지 않는다 —
 * 대장의 `after` 바이트가 모집단이고, 출구는 그 자리에서 파생한다.
 *
 * ⚠️ **기록 자체는 한 바이트도 고치지 않는다**(`file`·`before`·`after`·`added`·`places`).
 * 더하는 것은 칸 하나이지, 라운드 79·80이 적어 둔 사실을 다시 쓰는 것이 아니다.
 */
type AnnounceLedgerExit = "announce" | "live-region" | "toast";

/** 대장 항목 하나가 덮는 **한 자리** — 소스의 그 바이트 자리와, 거기서 파생한 출구. */
type AnnounceLedgerPlace = {
  /** 마스킹된 소스에서 그 여는 태그가 시작하는 자리(유령 방지의 좌표다). */
  readonly at: number;
  /** 그 자리를 세우는 **가장 안쪽 JSX 조건** — 없으면 빈 문자열(컴포넌트가 곧 조건인 자리). */
  readonly guard: string;
  readonly exit: AnnounceLedgerExit;
};

/** `(`/`{`/`[` 하나의 짝(문자열 안의 괄호는 세지 않는다). */
function matchingCloserOf(masked: string, openAt: number): number {
  const open = masked[openAt];
  const close = open === "(" ? ")" : open === "{" ? "}" : "]";
  let depth = 0;
  let quote: string | null = null;
  for (let i = openAt; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 깊이 0의 `;`까지 — 중괄호 없는 한 문장 `if`가 덮는 구간의 끝이다. */
function statementEndAt(masked: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") depth -= 1;
    else if (char === ";" && depth === 0) return i;
  }
  return masked.length - 1;
}

/**
 * 그 자리를 덮는 **가장 안쪽** `if (…)`의 조건(덮는 것이 없으면 빈 문자열).
 *
 * 낭독 배선이 *어느 갈래에 묶여 있는가*를 묻는 데 쓴다 — 같은 파일에 `announceForA11y`가
 * 있다는 사실만으로는 **그 자리**가 소리를 내는지 알 수 없다(AB-4가 이름 붙인 그 착시다).
 */
function enclosingIfCondition(masked: string, at: number): string {
  let condition = "";
  const pattern = /\bif\s*\(/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    if (found.index >= at) break;
    const open = found.index + found[0].length - 1;
    const close = matchingCloserOf(masked, open);
    if (close < 0 || close > at) continue;
    let cursor = close + 1;
    while (cursor < masked.length && /\s/.test(masked[cursor])) cursor += 1;
    const end = masked[cursor] === "{" ? matchingCloserOf(masked, cursor) : statementEndAt(masked, cursor);
    if (end < 0 || at > end) continue;
    condition = masked.slice(open + 1, close).replace(/\s+/g, " ").trim();
  }
  return condition;
}

/**
 * `useEffect` 안에서 실제로 도는 `announceForA11y` 배선 — 그 자리와 **그것이 묶인 조건**.
 *
 * effect 층만 세는 이유는 이 파일이 이미 쓰는 그 이유다(`announcedSaveErrorNames` 머리말):
 * 렌더 도중 부르면 같은 문장을 매 렌더 다시 읽는다. ⚠️ 그래서 **핸들러 안의 낭독은 이 그물이
 * `announce`로 세지 않는다** — 오늘 그런 자리가 하나 있고, 그 사실은 사각과 그 항목의
 * `crossPlatform` 값에 함께 적혀 있다.
 */
function announceEffectWirings(masked: string): Array<{ readonly at: number; readonly condition: string }> {
  const effects = callRangesOf(masked, "useEffect");
  return callRangesOf(masked, "announceForA11y")
    .filter(([open]) => effects.some(([from, to]) => open > from && open < to))
    .map(([open]) => ({ at: open, condition: enclosingIfCondition(masked, open) }));
}

/**
 * 대장 항목 하나가 덮는 **자리 전수와 각 자리의 출구** — 모집단은 손 목록이 아니라 그 항목이
 * 적어 둔 `after` 바이트다(그래서 `places` 수와 판정이 **같은 모집단**에서 나온다).
 *
 * 판정 세 칸:
 * - `toast` — 그 자리가 `<Toast …>`다(공용 Toast가 프롭과 announce를 스스로 진다 · A11Y-115).
 * - `announce` — 그 자리를 세우는 **JSX 조건과 같은 조건**에 묶인 낭독 배선이 effect 층에 있다
 *   (조건이 없는 자리 — 컴포넌트가 곧 조건인 모듈 카드 — 는 **같은 최상위 컴포넌트 안의**
 *   조건 없는 배선이 답한다).
 * - `live-region` — 프롭 조합뿐이다. `accessibilityLiveRegion`은 `@platform android`이고
 *   `accessibilityRole="alert"`에 대응하는 VoiceOver 트레이트가 없다(위
 *   `ANDROID_ONLY_LIVE_REGION_REASON`) — iOS에서는 화면에 문장이 서도 아무 소리가 나지 않는다.
 */
function announceLedgerPlacesOf(sourceText: string, after: string): AnnounceLedgerPlace[] {
  const masked = maskComments(sourceText);
  const tagName = /^<([A-Za-z][A-Za-z0-9_.]*)/.exec(after)?.[1] ?? "";
  const wirings = announceEffectWirings(masked);
  const blocks = topLevelFunctionBlocksOf(masked);
  const places: AnnounceLedgerPlace[] = [];
  for (let at = masked.indexOf(after); at >= 0; at = masked.indexOf(after, at + 1)) {
    const guard = enclosingJsxGuards(masked, at)[0]?.guard ?? "";
    const block = blocks.find((candidate) => at >= candidate.start && at < candidate.end);
    const wired = guard
      ? wirings.some((wiring) => wiring.condition === guard)
      : Boolean(block) &&
        wirings.some(
          (wiring) => wiring.condition === "" && wiring.at >= block!.start && wiring.at < block!.end
        );
    places.push({ at, guard, exit: tagName === "Toast" ? "toast" : wired ? "announce" : "live-region" });
  }
  return places;
}

/**
 * ⚠️ **이 판정이 못 보는 것 — 태어날 때부터 값으로 적는다(AB-4·AA-4의 규율).**
 *
 * 판정 칸이 붙었다는 사실이 *"이제 이 축은 전부 세어졌다"* 로 읽히면, 이 트랙은 자기가 고친
 * 그 착시를 한 겹 위에서 다시 만드는 것이다. 무엇을 보고 무엇을 못 보는지를 함께 든다.
 */
const ANNOUNCE_LEDGER_VERDICT_BLIND_SPOTS: ReadonlyArray<string> = [
  "모집단은 **대장이 적어 둔 여는 태그**다 — 프롭 없이 실패 문장을 그리는 컴포넌트는 이 그물에 아예 들어오지 않는다. 그 축은 화면 층(GAP-079의 대장 · GAP-080의 방아쇠)과 모듈 층(GAP-087의 뿌리)이 각자의 모집단으로 세고, 이 판정은 그 셋을 대신하지 않는다.",
  "프롭이 **한 짝만** 걸린 자리는 대장에 없다 — 대장의 `after`는 짝이 완성된 바이트라 반쪽 자리는 `indexOf`에 걸리지 않는다. ⚠️ **두 시점** — *당시(라운드 88 E가 이 문장을 세울 때)*: 그 자리를 세는 것은 role 단독의 `ALERT_ROLE_WITHOUT_LIVE_REGION`(손으로 적은 파일 하나)과 모듈 층의 `halfAnnouncedTagCount`(수만 세고 자리를 내밀지 않는다)뿐이었고, live region 단독은 **어느 모집단에도 들지 않았다**. *오늘(라운드 90 트랙 A)*: **반쪽 프롭 스윕**(`halfAnnouncedSitesOf`·`halfAnnouncedSites`)이 그 자리를 전수로 파생해 자리마다 판정 하나를 소스에서 낸다 — 오늘 일곱(live region 단독 여섯 · role 단독 하나)이고 `silent`는 0건이다. ⚠️ **그래도 이 판정 자신은 여전히 그 자리를 세지 않는다**: 이 사각이 말하는 것은 *대장의 모집단*이고, 반쪽 자리를 지는 것은 같은 파일의 **다른 모집단**이다(한 그물에 축 둘을 얹지 않는 규율 — 대장의 `after` 바이트는 오늘도 짝이 완성된 자리뿐이다).",
  "`.tsx` 밖의 자리는 이 그물 밖이다 — 대장 아홉은 전부 `.tsx`이고, 낭독 문장이 `.ts` 모듈에서 서는 자리(문구 단일 소스가 사는 층)는 여기서 세지 않는다.",
  "낭독으로 세는 것은 **effect 층의 배선**이다 — 이벤트 핸들러가 상태를 세우며 같은 걸음에 부르는 announceForA11y는 이 그물이 `announce`로 세지 않는다(오늘 그런 자리가 하나 있고, 그 사실이 그 항목의 crossPlatform 값에 적혀 있다).",
  "소스 대조이지 런타임이 아니다 — VoiceOver·TalkBack이 실제로 그 문장을 읽는지는 실기기 확인의 몫이다(react-native는 vitest에서 네이티브 바인딩이 없다).",
  "⚠️ 라운드 88 리뷰 L-1 — **갈래를 하나만, 글자로만 본다.** `announce`로 세려면 ⓐ 자리를 감싸는 갈래 중 **최내곽 하나**(`enclosingJsxGuards(...)[0]`)가 ⓑ effect 층 배선의 `if` 조건과 **문자열이 완전히 같아야** 한다. 그래서 자리를 갈래 둘이 겹쳐 감싸는 모양(바깥 갈래가 진짜 조건인 경우)이나, 같은 뜻을 다르게 적은 조건(`save.isError` ↔ `saveMutation.isError`, 부정 순서 바뀜, 괄호·공백 밖의 표기 차이)은 배선이 실재해도 `live-region`으로 떨어진다. ⚠️ 오차의 방향은 **거짓 빨강(안전)**이다 — 침묵을 announce로 세지 않고, 그 항목에 이유를 요구해 사람이 다시 보게 만든다. 오늘 실측(2026-08-31 워킹트리)으로 이 한계가 실제로 낸 피해는 **0건**이다: 대장 아홉이 덮는 자리 **스물둘** 중 감싸는 갈래가 하나인 자리 **열넷** · 둘인 자리 **일곱** · 없는 자리 하나이고, **중첩 일곱은 전부 최내곽 갈래가 배선 조건과 글자로 맞아 `announce`로 떨어졌다**(오늘 `live-region` 하나는 갈래가 하나인 자리이고, 그 이유가 값으로 서 있다 — ⚠️ 라운드 89 트랙 A가 끝난 초대 카드에 배선을 걸어 종전 둘 중 하나를 닫았고, **그 배선의 `if` 조건을 카드의 최내곽 갈래와 글자로 맞춘 것**이 이 사각의 첫 소비자다). 판정 로직을 넓히는 것은 이 한계가 실제로 자리를 잘못 세우는 날의 일이다. ⚠️ **두 시점 — 이 분포의 수는 라운드 89 리뷰(M-1)가 고친 값이다.** 라운드 88이 이 문장을 세울 때 적은 *\"하나 열셋 · 둘 여덟 · 중첩 여덟\"* 은 **그 시점(cedaba4)의 실측과도 이미 달랐다**(라운드 89 트랙 A가 만든 어긋남이 아니다 — 트랙 A는 그 문장을 재확인하며 날짜만 새로 적었고, 손 숫자였기 때문에 어긋남이 드러나지 않았다). 오늘 재실측은 **깊이 1: 14 · 2: 7 · 0: 1**이고, 이제 이 분포는 문장이 아니라 `ⓔ`의 파생 단언이 못 박는다 — 손으로 적은 수가 다시 조용히 낡을 자리를 없앤다."
];

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
  /**
   * ⚠️ 라운드 88 트랙 E — **판정 칸.** *무엇을 했는가*(`what`) 옆에 *그것이 충분한가*가 선다.
   *
   * 값을 손으로 적어 못 박지 않는다: 출구는 `announceLedgerPlacesOf`가 이 항목의 `after`
   * 바이트에서 파생하고, 이 칸은 그 판정이 **부를 때만** 값이 된다 — 한 자리라도
   * `live-region`이면(= 안드로이드 한정이면) 빈 문자열일 수 없고, 전부 크로스플랫폼이면
   * 반드시 빈 문자열이다(고쳐진 뒤에도 남는 이유는 낡은 판정이라 그때 빨개진다).
   */
  readonly crossPlatform: string;
}> = [
  {
    file: "app/family/accept/[token].tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "초대 수락(POST) 저장 실패 줄 — 대장 다섯 화면 중 하나",
    crossPlatform: ""
  },
  {
    file: "app/family/accept/[token].tsx",
    before: '<View accessibilityRole="alert">',
    after: '<View accessibilityLiveRegion="polite" accessibilityRole="alert">',
    added: ['accessibilityLiveRegion="polite"'],
    what: "끝난 초대 카드(라운드 70 A)와 수락 성공 후 뒤처리 실패 카드(라운드 60 #3) — role만 있고 live region이 없던 자리 둘",
    crossPlatform:
      "이 항목이 덮는 자리 둘 가운데 오늘 조용한 것은 **하나**다 — 뒤처리 실패 카드(joinRetryNotice && joinedResult). 그 자리는 사실 두 플랫폼 다 소리가 난다: 낭독이 effect가 아니라 뒤처리 핸들러 안에 있어(setJoinRetryNotice(plan.notice) 바로 다음 줄의 announceForA11y(plan.notice)) effect 층만 세는 이 그물이 announce로 세지 못할 뿐이다(사각 넷째 — 그물의 한계이지 화면의 결함이 아니다. 그래서 프롭을 빼거나 더하라는 제안이 아니다). 형제 자리였던 끝난 초대 카드(inviteUnavailable)는 라운드 88 트랙 E가 이 칸으로 그 침묵을 값으로 만든 뒤 라운드 89 트랙 A가 닫았다 — 카드의 최내곽 갈래와 글자가 같은 조건의 effect 배선이 화면에 서서 오늘 announce다."
  },
  {
    file: "app/family/invite.tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "초대 링크 만들기(POST) 저장 실패 줄 — 대장 다섯 화면 중 하나",
    crossPlatform: ""
  },
  {
    file: "app/settings/children.tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "아이 관리 뮤테이션 실패 셋(편집·출생 전환·추가) — 대장 다섯 화면 중 하나. 라운드 79 통합이 루프 핀을 모양으로 풀며 함께 걸었다",
    crossPlatform: ""
  },
  {
    file: "app/settings/notifications.tsx",
    before: "<Text style={errorTextStyle}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    what: "같은 모양의 실패 줄 둘 — 손으로 적은 푸시 설정 저장 실패 한 줄(대장 밖)과, 라운드 79 통합이 핀을 푼 뒤 걸린 기기 토글 저장 실패 한 줄(대장 안)",
    crossPlatform: ""
  },
  {
    file: "src/onboarding/step-ui.tsx",
    before: '<View accessibilityRole="alert">',
    after: '<View accessibilityLiveRegion="polite" accessibilityRole="alert">',
    added: ['accessibilityLiveRegion="polite"'],
    what: "OnboardingSaveErrorCard — 라운드 78 A가 갈래를 다섯으로 만든 그 카드(모듈 층의 한 자리)",
    crossPlatform: ""
  }
];

describe("GAP-079 #1 저장 실패 문장의 낭독 계약 (대장에서 파생)", () => {
  it("ⓐ 대장 화면 전수 — 저장 실패 문장은 낭독되는 노드 안에 선다 (출구 둘: live region · Toast)", () => {
    // 모집단이 손 목록이 아니라 대장이라, 화면이 하나 늘면 그 화면도 이 질문을 자동으로 받는다.
    expect(OFFLINE_AWARE_SAVE_ERROR_SCREENS.length, "대장이 비면 이 스윕이 조용히 죽는다").toBeGreaterThan(0);

    const silent: string[] = [];
    const androidOnly: string[] = [];
    const exits: Record<string, number> = {};
    let total = 0;
    for (const screen of OFFLINE_AWARE_SAVE_ERROR_SCREENS) {
      const sites = saveErrorAnnounceSites(screen);
      // 유령 방지: 대장의 화면은 저장 실패 문장을 **실제로 그린다**. 0건이면 스캔이 끊긴 것이고,
      // 끊긴 스캔 위에서는 아래 부정 단언이 영원히 초록이다(라운드 78 E가 이름 붙인 그 모양).
      expect(sites.length, `${screen}이 그리는 저장 실패 자리`).toBeGreaterThan(0);
      total += sites.length;
      for (const site of sites) {
        exits[site.exit] = (exits[site.exit] ?? 0) + 1;
        if (site.exit === "silent") silent.push(`${screen} ${site.name}`);
        if (site.exit === "live-region") androidOnly.push(`${screen} ${site.name}`);
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

    // ⚠️ 라운드 79 리뷰(M-1) — **한 플랫폼만 답하는 자리도 0건이다.** 프롭 조합은 안드로이드의
    // 답이고, iOS는 `announceForA11y`가 답한다. 일곱 자리 전부가 두 플랫폼 다 도달하는 출구를
    // 가진다: 맨 Text 여섯은 `announce`(프롭 + useEffect 배선), Toast 하나는 자기가 진다.
    expect(androidOnly.sort(), "프롭만 걸려 안드로이드에서만 읽히는 자리").toEqual([]);
    expect(ANDROID_ONLY_LIVE_REGION_REASON, "한 플랫폼만 답하는 자리를 세는 이유").toContain("@platform android");
    expect(exits, "출구별 자리 수").toEqual({ announce: 6, toast: 1 });
  });

  it("ⓐ-4 일곱 자리 전부 announce 배선이 소스에 실재한다 (맨 Text 여섯 = useEffect · Toast 하나 = 컴포넌트)", () => {
    // 파생 스윕이 답을 내는 근거가 실제 소스 바이트라는 것을 자리별로 한 번 더 못박는다 —
    // 스캐너가 끊겨도(위 유령 방지가 놓쳐도) 여기가 빨개진다.
    const wiredByEffect: ReadonlyArray<{ readonly file: string; readonly guard: string; readonly announced: string }> = [
      { file: "app/settings/children.tsx", guard: "markChildBorn.isError", announced: "bornFailedText" },
      { file: "app/settings/children.tsx", guard: "saveEdit.isError", announced: "editFailedText" },
      { file: "app/settings/children.tsx", guard: "addChild.isError", announced: "addFailedText" },
      {
        file: "app/settings/notifications.tsx",
        guard: "toggleDevice.isError",
        announced: "deviceToggleSaveErrorText"
      },
      {
        file: "app/family/accept/[token].tsx",
        guard: "accept.isError && !inviteUnavailable",
        announced: "acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error)"
      },
      { file: "app/family/invite.tsx", guard: "invite.isError", announced: "inviteCreateErrorText" }
    ];
    expect(wiredByEffect, "맨 Text 자리").toHaveLength(6);
    for (const entry of wiredByEffect) {
      const masked = maskComments(source(entry.file));
      const effects = callBlocksOf(masked, "useEffect").filter((block) => block.includes("announceForA11y("));
      const wired = effects.find(
        (block) => block.includes(`if (${entry.guard})`) && block.includes(`announceForA11y(${entry.announced})`)
      );
      // ⚠️ 배선이 사라지면(또는 조건이 화면의 갈래와 갈리면) 여기가 먼저 빨개진다.
      expect(wired, `${entry.file}: ${entry.announced} 낭독 배선`).toBeTruthy();
      // 렌더 도중이 아니라 **effect 안**이고, 문장이 바뀌면 다시 읽도록 의존 배열이 그 값을 든다
      // (들지 않으면 두 번째 실패가 조용해진다 — 같은 화면에서 사유만 갈리는 자리들이다).
      const deps = wired!.slice(wired!.lastIndexOf(", ["));
      expect(deps, `${entry.file}: ${entry.announced}의 의존 배열`).toContain(entry.announced.split(" ")[0]);
    }

    // 눈과 귀가 같은 말을 한다: 초대 수락 자리는 화면이 그리는 **그 식 그대로**를 읽는다
    // (이 화면만 파생 변수 없이 갈래를 인라인으로 그리므로, 두 자리의 식이 갈리는 날 빨개진다).
    const acceptScreenSource = source("app/family/accept/[token].tsx");
    const acceptExpression =
      "acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error)";
    expect(acceptScreenSource, "화면이 그리는 식").toContain(`{${acceptExpression}}`);
    expect(acceptScreenSource, "낭독하는 식").toContain(`announceForA11y(${acceptExpression})`);

    // Toast는 프롭이 아니라 자기가 announce해서 통과한다(두 번째 출구의 실재 확인).
    const uiSource = source("src/ui.tsx");
    expect(uiSource).toContain("export function announceForA11y");
    const toastAt = uiSource.indexOf("export function Toast");
    expect(toastAt, "Toast 컴포넌트").toBeGreaterThan(-1);
    expect(uiSource.slice(toastAt)).toContain("announceForA11y(message)");
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
    /** 라운드 79 리뷰(M-1): 같은 화면에 낭독 배선(useEffect)까지 선 모양. */
    const announcedScreen = (tag: string) => `
      const failText = useSaveErrorCopy(save.isError, save.error);
      useEffect(() => {
        if (save.isError) announceForA11y(failText);
      }, [save.isError, failText]);
      export default function Screen() {
        return (
          <View style={{ gap: 12 }}>
            {save.isError ? ${tag}{failText}</Text> : null}
          </View>
        );
      }
    `;
    // 프롭이 없으면 침묵이고, 관례 조합이 서면 **안드로이드까지**이며, announce까지 서야 두
    // 플랫폼 다다 — 그물이 실제로 세 답을 가른다.
    expect(saveErrorAnnounceSitesOf(screen("<Text style={{ color: theme.colors.danger }}>"))).toEqual([
      { name: "failText", exit: "silent" }
    ]);
    expect(
      saveErrorAnnounceSitesOf(
        screen('<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>')
      )
    ).toEqual([{ name: "failText", exit: "live-region" }]);
    expect(
      saveErrorAnnounceSitesOf(
        announcedScreen(
          '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>'
        )
      )
    ).toEqual([{ name: "failText", exit: "announce" }]);
    // ⚠️ announce만 있고 프롭이 없으면 여전히 `silent`가 아니라 침묵으로 센다 — 관례는 **둘 다**이고
    // (안드로이드에서 live region이 하는 일을 announce가 대신하지 않는다) 반쪽은 통과가 아니다.
    expect(saveErrorAnnounceSitesOf(announcedScreen("<Text style={{}}>"))).toEqual([
      { name: "failText", exit: "silent" }
    ]);
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

    /*
     * 라운드 79 리뷰(P-1) — **자기 닫힘 중첩을 중첩으로 세면 그 뒤가 통째로 삼켜진다.**
     *
     * `<Text …/>`는 닫는 태그를 소비하지 않는다. 그것을 중첩으로 세던 스캐너는 바깥 요소의
     * 닫는 태그를 그 중첩의 것으로 써 버려 본문 끝을 **파일 끝까지** 밀었고, 그 뒤에 오는 자리는
     * 전부 그 요소 안으로 들어갔다. 아래 화면에서 실패 문장이 실제로 서는 곳은 Toast인데,
     * 종전 스캐너는 그 자리를 앞선 `<Text>`의 본문으로 읽어 **출구를 잘못 매겼다**.
     */
    const selfClosingNesting = `
      const failText = useSaveErrorCopy(save.isError, save.error);
      export default function Screen() {
        return (
          <View>
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert">
              <Text style={{ fontWeight: "700" }} />
            </Text>
            {save.isError ? <Toast message={failText} tone="error" /> : null}
          </View>
        );
      }
    `;
    expect(saveErrorAnnounceSitesOf(selfClosingNesting)).toEqual([{ name: "failText", exit: "toast" }]);
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

/* ============================================================================================ */
/* GAP-080 트랙 A(#1) — **눌러서 나타난 실패가 소리로 오는가 (방아쇠에서 파생)**                    */
/* ============================================================================================ */

/**
 * ## 라운드 79의 그물은 옳았고, 모집단이 틀린 단위였다
 *
 * 위 GAP-079 스윕은 낭독을 **대장**(`OFFLINE_AWARE_SAVE_ERROR_SCREENS`)으로 셌다. 대장은 문구의
 * 단일 소스를 세는 단위이고 그 축에서는 정확하다. 그런데 낭독이 실제로 기대는 축은 다르다 —
 * **포커스가 어디 남는가**이고, 그것을 정하는 것은 대장이 아니라 **방아쇠**다.
 *
 * 실측이 그 차이를 값으로 보여 준다. 조회 대장 안에 뮤테이션이 세우는 문장이 셋 있었고
 * (`app/settings/privacy.tsx`의 파기 미리보기 셋 — `useLoadErrorCopy`의 문장을 쓰지만 방아쇠는
 * `.mutate()`이고 재시도 수단은 바로 위 [확인] 버튼이다), 대장 **밖**에 같은 모양이 열이 더
 * 있었다(개인정보 넷 · 가져오기 다섯 · 알림 하나). 같은 화면이 성공은 소리로 말해 주면서
 * (`privacy.tsx`의 `announceForA11y` 두 자리는 **둘 다 성공**이다) 실패에는 침묵하고 있었다.
 *
 * 그래서 이 스윕의 모집단은 화면 목록이 아니라 **방아쇠**다: `app/**`에서 danger 색 글자(또는
 * 오류 Toast)를 세우는 JSX 조건을 읽고, 그 조건이 무엇에 닿는지를 소스에서 되짚는다
 * (`useMutation` 바인딩 · `useQuery` 바인딩 · 그 둘에서 파생한 이름 · 눌러서 세워지는 문장 state).
 *
 * ⚠️ **이 블록은 GAP-079를 고치지 않는다 — 그 옆에 한 겹 넓은 모집단을 세운다.** 대장 스윕은
 * 오늘도 참이고(`ROUND79_ANNOUNCE_PROPS_ADDED`·`SAVE_ERROR_ANNOUNCE_*` 값 그대로), 이 스윕은
 * 그 일곱 자리를 **포함하는** 스물다섯 자리를 센다(라운드 80 리뷰 M-1 재실측 — 종전 값은 스물이었고
 * 그 차이는 화면이 아니라 스캐너의 구멍 셋에서 나왔다. 아래 `MUTATION_TRIGGER_SITES_BY_SCREEN` 머리말).
 */
const ANNOUNCE_UNIT_IS_THE_TRIGGER_REASON =
  "낭독이 필요한지를 정하는 것은 그 문장이 어느 대장에 있는가가 아니라 무엇이 그 문장을 세웠는가다 — " +
  "뮤테이션(누름)이 세우면 포커스가 눌린 컨트롤에 남은 채 문장이 그 아래 맨 줄로 서고, 쿼리가 세우면 " +
  "화면 영역이 통째로 카드로 바뀌어 사용자가 다시 훑는다. 단위는 대장이 아니라 방아쇠다.";

/** 이 스윕이 세는 실패 문장의 두 모양 — 맨 줄(조건의 바로 아래) · 영역 안(카드·목록·갈래 안). */
type TriggerSiteShape = "bare" | "contained";

/** 그 자리를 세운 방아쇠. `other`(입력 검증·스토어 상태 등 요청이 없는 자리)는 세지 않는다. */
type TriggerKind = "mutation" | "query";

type MutationTriggerSite = {
  readonly screen: string;
  /** 그 자리를 세우는 **가장 안쪽** JSX 조건(공백만 정규화한 소스 그대로). */
  readonly guard: string;
  readonly trigger: TriggerKind;
  readonly shape: TriggerSiteShape;
  /** GAP-079와 **같은 세 칸**이다(반쪽은 통과가 아니다) + 낭독 밖 `silent`. */
  readonly exit: "announce" | "live-region" | "toast" | "silent";
};

/** `app/**`의 라우트 소스 전수(.tsx). 손 목록이 아니라 디렉터리가 모집단을 정한다. */
function listRouteSources(): string[] {
  return readdirSync(join(mobileRoot, "app"), { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
    .map((entry) => join("app", entry));
}

/** `이름(` 호출의 괄호 구간 **범위**. `callBlocksOf`와 같은 규칙이고 자리까지 돌려준다. */
function callRangesOf(masked: string, calleeName: string): Array<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];
  const pattern = new RegExp(`\\b${calleeName}\\(`, "g");
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const open = found.index + found[0].length - 1;
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < masked.length; i += 1) {
      const char = masked[i];
      if (quote) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          ranges.push([open, i] as const);
          break;
        }
      }
    }
  }
  return ranges;
}

/** `= ` 뒤부터 **깊이 0의 `;`** 까지 — 선언의 진짜 오른쪽이다(중첩 블록 안의 `;`에 잘리지 않는다). */
function statementRhsAt(masked: string, at: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = at; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") depth -= 1;
    else if (char === ";" && depth === 0) return masked.slice(at, i);
  }
  return masked.slice(at, at + 400);
}

/** `const 이름 = …;` 선언의 표. 방아쇠를 이름에서 이름으로 되짚는 데 쓴다. */
function constDeclarations(masked: string): Map<string, string> {
  const declared = new Map<string, string>();
  const pattern = /const\s+([A-Za-z0-9_$]+)\s*=/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    if (declared.has(found[1])) continue;
    declared.set(found[1], statementRhsAt(masked, found.index + found[0].length));
  }
  return declared;
}

/** `const [값, set값] = useState…`의 표. */
function useStateBindings(masked: string): Map<string, string> {
  const bindings = new Map<string, string>();
  const pattern = /const\s+\[\s*([A-Za-z0-9_$]+)\s*,\s*(set[A-Za-z0-9_$]+)\s*\]\s*=\s*useState/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) bindings.set(found[1], found[2]);
  return bindings;
}

/**
 * **함수 몸통**인 `{ … }` 구간 전부(여는 `{` 앞이 `=>` 또는 `)`인 것 — 화살표·함수·if·try).
 *
 * ⚠️ JSX 표현식 컨테이너(`{cond ? … : null}`)와 객체 리터럴은 여기서 빠진다. 그 둘을 함께 세면
 * 화면 전체의 JSX 한 덩어리가 "핸들러"로 읽혀 **그 안의 모든 setState가 뮤테이션 방아쇠가 된다**
 * (입력 검증 문장까지 이 스윕에 끌려 들어온다 — 실측으로 확인한 함정이다).
 */
function functionBodyRanges(masked: string): Array<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];
  const stack: number[] = [];
  let quote: string | null = null;
  for (let i = 0; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") stack.push(i);
    else if (char === "}") {
      const start = stack.pop();
      if (start === undefined) continue;
      // ⚠️ 앞 조각을 잘라서 보지 않는다 — 여는 괄호마다 파일 앞부분을 복사하면 O(n²)가 된다.
      let cursor = start - 1;
      while (cursor >= 0 && /\s/.test(masked[cursor])) cursor -= 1;
      const isBody = masked[cursor] === ")" || (masked[cursor] === ">" && masked[cursor - 1] === "=");
      if (isBody) ranges.push([start, i] as const);
    }
  }
  return ranges;
}

/** `이름(…)` 호출의 첫 인자(문자열 안의 괄호는 세지 않는다). */
function firstArgumentOf(masked: string, at: number): string {
  const open = masked.indexOf("(", at);
  if (open < 0) return "";
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return masked.slice(open + 1, i).trim();
    }
  }
  return "";
}

function identifiersIn(text: string): string[] {
  return [...new Set(text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [])];
}

/**
 * 여는 태그의 `style={…}` **안쪽**(중괄호 균형을 맞춰 자른다).
 *
 * ⚠️ 인라인 객체(`style={{ color: theme.colors.danger }}`)만 보던 종전 판정은 저장소의 다른
 * 관례 둘을 놓쳤다 — `style={styles.errorText}`(StyleSheet 이름)와 배열 스타일
 * (`style={[styles.a, styles.errorText]}`). 셋 다 같은 danger 색을 입는다.
 */
function styleExpressionOf(openTag: string): string {
  const at = openTag.indexOf("style={");
  if (at < 0) return "";
  const from = at + "style=".length;
  let depth = 0;
  for (let i = from; i < openTag.length; i += 1) {
    const char = openTag[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return openTag.slice(from + 1, i);
    }
  }
  return "";
}

/**
 * 조건과 그 자리 **사이의 가장 안쪽 여는 태그**. 저장소 관례에서 낭독 프롭 쌍은 문장 자신이
 * 아니라 **alert 컨테이너**에 서기도 한다(`app/(auth)/login.tsx`의 `<View accessibilityRole=
 * "alert" …><Text style={styles.errorText}>`). 그 자리를 프롭 없음으로 세면 이미 소리가 나는
 * 자리가 침묵으로 집계된다.
 */
function innermostOpenTagBetween(masked: string, from: number, to: number): string {
  if (to <= from) return "";
  const between = masked.slice(from, to);
  const opens = [...between.matchAll(/<[A-Za-z][A-Za-z0-9_.]*(?![A-Za-z0-9_])/g)];
  if (opens.length === 0) return "";
  const last = opens[opens.length - 1];
  const end = openingTagEnd(between, last.index);
  return end < 0 ? "" : between.slice(last.index, end + 1);
}

/**
 * **눌러서 세워지는 문장 state** — 방아쇠가 뮤테이션인데 화면이 그 답을 state로 들고 있는 자리.
 *
 * 두 성질을 **함께** 요구한다:
 *  ⓐ 그 state는 **값을 담는다** — `set…(true)`/`set…(false)`만 쓰는 보이기 스위치는 문장이 아니다
 *    (`showErrors` 같은 자리가 그렇고, 그 자리가 그리는 것은 입력 검증이지 요청 실패가 아니다).
 *  ⓑ 그 setter가 **누름 핸들러 안**에서 불린다 — 그 함수 몸통이 뮤테이션의 `.mutate(`를 부르거나
 *    (파일 검증 → 업로드), 요청 모듈에서 들여온 쓰기 함수를 직접 부른다(일괄 PATCH 루프 ·
 *    오프라인 큐 `updateItemStatusOffline` · 로그인의 `oauthLogin`).
 *    ⚠️ `useMutation({ … })` 옵션 객체 안의 제외는 **`onSuccess`·`onSettled`로 좁힌다** — 거기서
 *    세워지는 state가 성공 뒤처리(참여 결과 · 착지 월)이고, `onError`는 제외가 아니라 **방아쇠
 *    자신**이다. 종전에는 옵션 객체 전부를 제외해 `onError`가 세우는 저장 실패 문장이
 *    (`app/expenses/new.tsx`·`[expenseId].tsx`의 `saveErrorMessage`) 모집단 밖으로 빠졌다.
 */
function pressedMessageStates(
  masked: string,
  states: Map<string, string>,
  mutationNames: ReadonlySet<string>,
  serverWrites: ReadonlySet<string>
): Set<string> {
  const mutationOptionRanges = callRangesOf(masked, "useMutation");
  const bodies = functionBodyRanges(masked);
  const writeRegexes = [...serverWrites].map((write) => new RegExp(`\\b${write}\\(`));
  /** 그 몸통이 어느 옵션의 값인가 — 여는 `{` 바로 앞의 `onXxx:` 하나(없으면 빈 문자열). */
  const optionKeyBefore = (lead: string): string => {
    const keys = [...lead.matchAll(/\b(on[A-Z][A-Za-z0-9_$]*)\s*:/g)];
    return keys.length > 0 ? keys[keys.length - 1][1] : "";
  };
  // 판정은 **구간마다 한 번**이다(setter 호출마다 다시 자르면 같은 몸통을 수십 번 훑는다).
  const verdicts = new Map<number, boolean>();
  const isPressBody = (start: number, end: number): boolean => {
    const cached = verdicts.get(start);
    if (cached !== undefined) return cached;
    const body = masked.slice(start, end + 1);
    const lead = masked.slice(Math.max(0, start - 160), start);
    let verdict: boolean;
    if (/\buse(State|Mutation|Query|Effect|Memo|Ref|Callback)\(/.test(body)) verdict = false;
    // ⚠️ **실패 갈래**는 그 자체가 방아쇠다 — `try/catch`의 catch 블록과 `.catch(…)` 콜백은
    // 정의상 **앞선 요청이 있었다**는 뜻이라 그 안에서 세워지는 문장은 눌러서 나타난 실패다.
    // 이 한 줄이 종전에 통째로 빠져 있던 두 모양을 모집단에 넣는다: 오프라인 큐를 직접 부르는
    // 화면(`updateItemStatusOffline(...).catch(() => set…)`)과 훅 없이 요청하는 로그인 화면.
    else if (/\bcatch\s*(\([^)]*\))?\s*$/.test(lead) || /\.catch\(\s*(\([^)]*\)|[A-Za-z0-9_$]+)\s*=>\s*$/.test(lead))
      verdict = true;
    else if ([...mutationNames].some((mutation) => body.includes(`${mutation}.mutate(`))) verdict = true;
    else if (mutationOptionRanges.some(([from, to]) => start >= from && start <= to)) {
      const key = optionKeyBefore(lead);
      // ⚠️ 제외는 **성공 뒤처리**뿐이다. `onError`는 눌린 요청이 실패한 바로 그 갈래다.
      if (key === "onError") verdict = true;
      else if (key === "onSuccess" || key === "onSettled") verdict = false;
      else verdict = writeRegexes.some((write) => write.test(body));
    } else verdict = writeRegexes.some((write) => write.test(body));
    verdicts.set(start, verdict);
    return verdict;
  };

  const qualified = new Set<string>();
  for (const [name, setter] of states) {
    const calls = [...masked.matchAll(new RegExp(`\\b${setter}\\(`, "g"))];
    if (calls.length === 0) continue;
    const args = calls.map((call) => firstArgumentOf(masked, call.index));
    if (args.some((arg) => arg === "true" || arg === "false")) continue;
    if (!args.some((arg) => arg.length > 0 && arg !== "null")) continue;
    const pressed = calls.some((call) =>
      bodies.some(([start, end]) => call.index >= start && call.index <= end && isPressBody(start, end))
    );
    if (pressed) qualified.add(name);
  }
  return qualified;
}

/**
 * 그 자리를 감싸는 JSX 조건들(안쪽부터). 각 항목은 조건 문자열과 `?` **바로 뒤 자리**를 든다.
 *
 * ⚠️ **`?` 뒤의 깊이 0 `:` 를 함께 잰다 — 그 콜론보다 뒤에 선 자리는 조건의 then이 아니라 else다.**
 * 종전에는 else 가지가 then 조건에 귀속됐고, 그래서 화면 하단이 통째로 상단 로딩/오류 삼항의
 * else인 화면(`app/expenses/[expenseId].tsx`의 `canLoadExpense && expensePhase === "error" ? … :
 * … : (…)`)에서 **입력 검증·버튼 라벨·뮤테이션 Toast가 전부 "쿼리 조건"에 매달렸다.**
 * else 가지면 그 조건을 채택하지 않고 한 겹 밖으로 나간다 — 모르는 것을 지어내지 않는다.
 */
function enclosingJsxGuards(masked: string, at: number): Array<{ readonly guard: string; readonly after: number }> {
  const guards: Array<{ readonly guard: string; readonly after: number }> = [];
  let cursor = at;
  for (let round = 0; round < 8; round += 1) {
    let depth = 0;
    let open = -1;
    for (let i = cursor - 1; i >= 0; i -= 1) {
      const char = masked[i];
      if (char === "}") depth += 1;
      else if (char === "{") {
        if (depth === 0) {
          open = i;
          break;
        }
        depth -= 1;
      }
    }
    if (open < 0) break;
    const segment = masked.slice(open + 1, at);
    let nested = 0;
    let question = -1;
    for (let i = 0; i < segment.length; i += 1) {
      const char = segment[i];
      if (char === "(" || char === "{" || char === "[") nested += 1;
      else if (char === ")" || char === "}" || char === "]") nested -= 1;
      else if (char === "?" && nested === 0 && segment[i + 1] !== "." && segment[i + 1] !== "?" && segment[i - 1] !== "?") {
        question = i;
        break;
      }
    }
    if (question > 0) {
      // 그 `?`에 대응하는 깊이 0의 `:`(중첩 삼항은 함께 센다). 그 콜론이 자리보다 앞에 있으면
      // 이 자리는 **else 가지**이고, 앞 조건은 이 자리의 조건이 아니다.
      let pending = 1;
      let branchDepth = 0;
      let elseAt = -1;
      for (let i = question + 1; i < segment.length; i += 1) {
        const char = segment[i];
        if (char === "(" || char === "{" || char === "[") branchDepth += 1;
        else if (char === ")" || char === "}" || char === "]") branchDepth -= 1;
        else if (branchDepth !== 0) continue;
        else if (char === "?" && segment[i + 1] !== "." && segment[i + 1] !== "?" && segment[i - 1] !== "?") pending += 1;
        else if (char === ":") {
          pending -= 1;
          if (pending === 0) {
            elseAt = i;
            break;
          }
        }
      }
      const guard = segment.slice(0, question).replace(/\s+/g, " ").trim();
      // 조건은 짧고 문장이 아니다 — `;`나 `return`이 섞이면 그것은 컴포넌트 몸통이지 조건이 아니다.
      if (elseAt < 0 && guard.length > 0 && guard.length <= 160 && !guard.includes(";") && !guard.includes("return ")) {
        guards.push({ guard, after: open + 1 + question + 1 });
      }
    }
    cursor = open;
  }
  return guards;
}

/**
 * 한 화면 소스에서 **방아쇠가 요청에 닿는 실패 문장 자리**를 전부 찾아 방아쇠·모양·출구를 매긴다.
 *
 * 자리로 세는 조건: danger 색 글자(`theme.colors.danger`를 직접 실었거나 그 색으로 정의된 이
 * 파일의 스타일 이름을 실은 `<Text>`)이거나 `tone="error"`인 `<Toast>`이고, **가장 안쪽 JSX
 * 조건**이 `useMutation`/`useQuery` 바인딩에 닿는 것. 닿지 않으면(입력 검증·스토어 상태) 이
 * 스윕의 모집단이 아니다 — 그 자리들은 요청이 없어 "실패했는데 조용하다"는 질문 자체가 다르다.
 */
function mutationTriggerSitesOf(sourceText: string, screen: string): MutationTriggerSite[] {
  const masked = maskComments(sourceText);
  const mutationNames = new Set<string>();
  const queryNames = new Set<string>();
  for (const [hook, into] of [
    ["useMutation", mutationNames],
    ["useQuery", queryNames]
  ] as const) {
    const pattern = new RegExp(`const\\s+([A-Za-z0-9_$]+)\\s*=\\s*${hook}\\(`, "g");
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(masked))) into.add(found[1]);
  }
  const declarations = constDeclarations(masked);
  const states = useStateBindings(masked);
  // 서버 쓰기 = api/client에서 들여온 이름 중 **뮤테이션이 실제로 부르는 것**(손 목록이 아니다).
  const imported = new Set<string>();
  for (const block of sourceText.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*api\/client"/g)) {
    for (const piece of block[1].split(",")) {
      const name = piece.replace(/\btype\b/, "").trim();
      if (/^[A-Za-z0-9_$]+$/.test(name)) imported.add(name);
    }
  }
  const insideMutations = callBlocksOf(masked, "useMutation").join("\n");
  const serverWrites = new Set([...imported].filter((name) => new RegExp(`\\b${name}\\(`).test(insideMutations)));
  const pressed = pressedMessageStates(masked, states, mutationNames, serverWrites);

  const resolving = new Set<string>();
  // 같은 이름을 여러 자리가 되짚는다 — 판정은 이름·깊이당 한 번이면 충분하다.
  const kindCache = new Map<string, Set<string>>();
  const kindOf = (name: string, depth: number): Set<string> => {
    if (mutationNames.has(name)) return new Set(["mutation"]);
    if (queryNames.has(name)) return new Set(["query"]);
    if (states.has(name)) return new Set([pressed.has(name) ? "mutation" : "other"]);
    if (depth >= 3 || resolving.has(name) || !declarations.has(name)) return new Set(["other"]);
    const key = `${name}@${depth}`;
    const cached = kindCache.get(key);
    if (cached) return cached;
    resolving.add(name);
    const kinds = new Set<string>();
    for (const identifier of identifiersIn(declarations.get(name)!)) {
      for (const kind of kindOf(identifier, depth + 1)) kinds.add(kind);
    }
    resolving.delete(name);
    kindCache.set(key, kinds);
    return kinds;
  };

  const dangerStyleNames = new Set<string>();
  const stylePattern = /(?:const\s+([A-Za-z0-9_$]+)\s*=|\b([A-Za-z0-9_$]+)\s*:)\s*\{([^{}]|\{[^{}]*\})*\}/g;
  let styleFound: RegExpExecArray | null;
  while ((styleFound = stylePattern.exec(masked))) {
    if (styleFound[0].includes("theme.colors.danger")) dangerStyleNames.add(styleFound[1] ?? styleFound[2]);
  }
  const announceEffects = callBlocksOf(masked, "useEffect").filter((block) => block.includes("announceForA11y("));

  const sites: MutationTriggerSite[] = [];
  const scan = (tagName: string, isFailureTag: (openTag: string) => boolean) => {
    const pattern = new RegExp(`<${tagName}(?![A-Za-z0-9_])`, "g");
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(masked))) {
      const end = openingTagEnd(masked, found.index);
      if (end < 0) continue;
      const openTag = masked.slice(found.index, end + 1);
      if (!isFailureTag(openTag)) continue;
      let matched: { readonly guard: string; readonly after: number } | null = null;
      let kinds: Set<string> | null = null;
      for (const candidate of enclosingJsxGuards(masked, found.index)) {
        const candidateKinds = new Set<string>();
        for (const identifier of identifiersIn(candidate.guard)) {
          for (const kind of kindOf(identifier, 0)) candidateKinds.add(kind);
        }
        if (candidateKinds.has("mutation") || candidateKinds.has("query")) {
          matched = candidate;
          kinds = candidateKinds;
          break;
        }
      }
      if (!matched || !kinds) continue;
      // 조건이 **직접** 든 바인딩이 먼저다(파생 이름은 둘 다에 닿을 수 있다 — 그때는 쿼리가 이긴다:
      // 화면 영역이 바뀌는 쪽을 맨 줄로 오인하지 않는 방향으로 판정을 기울인다).
      const names = identifiersIn(matched.guard);
      const trigger: TriggerKind = names.some((name) => mutationNames.has(name))
        ? "mutation"
        : names.some((name) => queryNames.has(name))
          ? "query"
          : kinds.has("query")
            ? "query"
            : "mutation";
      const shape: TriggerSiteShape = /^\s*\(?\s*$/.test(masked.slice(matched.after, found.index)) ? "bare" : "contained";
      let exit: MutationTriggerSite["exit"];
      if (tagName === "Toast") exit = "toast";
      else {
        // 프롭 쌍은 문장 자신이나 그 자리를 감싼 alert 컨테이너, **둘 중 한 요소에 함께** 서야 한다.
        const wrapper = innermostOpenTagBetween(masked, matched.after, found.index);
        const hasProps =
          ANNOUNCED_ALERT_PROPS.every((prop) => openTag.includes(prop)) ||
          ANNOUNCED_ALERT_PROPS.every((prop) => wrapper.includes(prop));
        const announced = announceEffects.some((block) => block.includes(`if (${matched!.guard})`));
        exit = hasProps ? (announced ? "announce" : "live-region") : "silent";
      }
      sites.push({ screen, guard: matched.guard, trigger, shape, exit });
    }
  };
  scan("Text", (openTag) => {
    if (openTag.includes("theme.colors.danger")) return true;
    const styleExpression = styleExpressionOf(openTag);
    if (styleExpression.length === 0) return false;
    // 이름·`styles.이름`·배열 원소 — 셋 다 같은 식별자로 읽힌다.
    return [...dangerStyleNames].some((name) => new RegExp(`\\b${name}\\b`).test(styleExpression));
  });
  scan("Toast", (openTag) => openTag.includes('tone="error"'));
  return sites;
}

/** 전수 스윕이 세 단언에서 세 번 돈다 — 화면당 한 번만 읽고 판정한다(값은 같다). */
const mutationTriggerSiteCache = new Map<string, MutationTriggerSite[]>();
const mutationTriggerSites = (screen: string) => {
  const cached = mutationTriggerSiteCache.get(screen);
  if (cached) return cached;
  const sites = mutationTriggerSitesOf(source(screen), screen);
  mutationTriggerSiteCache.set(screen, sites);
  return sites;
};

/**
 * ⚠️ **오늘 프롭을 걸 수 없는 자리와 그 이유 — 값으로 적는다.**
 *
 * 라운드 79 트랙 A가 남긴 그 형식 그대로다(`SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN`의 머리말:
 * *"다음에 같은 일이 생기면 제외가 산문이 아니라 **자기 무효화되는 값**으로 적혀야 한다"*).
 * 트랙 A 때 그 일이 한 자리에서 생겼다 — 일괄 선택의 중간 실패 줄은 **소유 밖 계약**이 여는
 * 태그를 바이트로 붙들고 있어(K-10을 지키는 그 핀), 프롭을 한 칸 더하면 그 핀이 먼저 빨개졌다.
 *
 * 반쪽(announce만)으로 닫지 않은 이유: 관례는 **프롭 둘 + announce 한 벌**이고, 반쪽만 세우면
 * 같은 자리가 두 그물에서 서로 다른 답을 낸다. **라운드 80 통합이 그 라운드가 됐다** — 라운드
 * 79의 선례대로 핀을 모양으로 풀고 같은 걸음에 프롭 둘 + announce 한 벌을 걸어, 이 목록이
 * 비었다(그 완화에 대한 의존은 아래 `ROUND80_RELAXED_PIN_DEPENDENCY`가 값으로 진다).
 *
 * ⚠️ **비었어도 이 값과 그 형식이 남는 이유**는 라운드 79의 그것과 같다: 다음에 같은 일이
 * 생기면 제외가 산문이 아니라 자기 무효화되는 값으로 적혀야 한다 — 각 줄은 ⓐ 화면에 그 구간이
 * 실재하고 ⓑ 그 구간을 붙드는 핀이 named 파일에 실재한다는 것을 함께 단언한다.
 */
const MUTATION_ANNOUNCE_BLOCKED_BY_SOURCE_PIN: Readonly<
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
 * 않았다"로 읽히지 않게). 라운드 79 트랙 A가 남긴 `SAVE_ERROR_ANNOUNCE_NO_BLOCKED_SITES_REASON`과
 * 같은 형식이고, 이 줄이 말하는 것은 **트랙 A가 남긴 하나를 같은 라운드의 통합이 닫았다**는 것이다.
 */
const MUTATION_ANNOUNCE_NO_BLOCKED_SITES_REASON =
  "라운드 80 트랙 A가 소유 밖 바이트 핀 때문에 한 자리를 남겼고(app/import/[importJobId].tsx의 일괄 중간 실패 — K-10을 " +
  "지키는 src/offline/messages.test.ts의 핀), 같은 라운드의 통합이 그 핀을 모양 핀으로 풀면서 같은 걸음에 그 자리에 " +
  "낭독 프롭 둘 + announce 한 벌을 걸었다. 그래서 뮤테이션 방아쇠 자리는 전부 낭독 출구를 가진다(오늘 스물다섯 — " +
  "리뷰 M-1 재실측 뒤에도 이 목록은 비어 있다: 넓어진 모집단이 새로 들인 다섯은 전부 이미 출구가 있었다).";

/**
 * ⚠️ **바이트 핀이 모양 핀으로 풀려 준 자리 — 그 의존을 값으로 적는다.**
 *
 * 라운드 79 트랙 A의 `ROUND79_RELAXED_PIN_DEPENDENCY`와 같은 형식이다. 일괄 중간 실패 줄은
 * 종전에 **여는 태그까지 포함한 바이트**로 핀돼 있었다. 이 라운드의 통합이 그 핀을
 * *"태그의 바이트가 아니라 모양을 묻는다"* 로 바꾸면서(`<Text[^>]*style=…>{그 문장}</Text>`)
 * 프롭 둘이 설 수 있게 됐다 — 완화된 것은 여는 태그의 프롭 한 칸뿐이고, 그 핀이 실제로 지키는
 * 것(K-10의 자기 문장 이름 · danger 색 · 태그 구조)은 그대로 엄격하다.
 *
 * ⚠️ 그 완화가 바이트로 되돌아가면 이 화면은 다시 침묵으로 돌아가야 한다 — 그래서 **의존을
 * 단언으로** 세운다. 되돌아가는 날 여기가 먼저 빨개져서, 그것이 사고가 아니라 결정이 되게 한다.
 */
const ROUND80_RELAXED_PIN_DEPENDENCY: ReadonlyArray<{
  readonly file: string;
  readonly needle: string;
  readonly why: string;
}> = [
  {
    file: "src/offline/messages.test.ts",
    needle:
      "/<Text[^>]*style=\\{\\{ color: theme\\.colors\\.danger \\}\\}>\\s*\\{IMPORT_BULK_PARTIAL_FAILURE_TEXT\\}\\s*<\\/Text>/",
    why: "일괄 중간 실패 줄에 낭독 프롭 둘이 설 수 있는 근거 — 트랙 A가 남긴 그 한 자리"
  }
];

/**
 * ⚠️ **이 라운드가 실제로 더한 것 — 프롭뿐이다**(announce 배선은 아래 ⓒ가 따로 진다).
 *
 * GAP-079 ⓓ와 같은 형식이다: 여는 태그의 "이전 바이트"를 값으로 들고, 더한 프롭을 빼면 그것과
 * **정확히 같아진다**는 것을 본다. 문장·스타일·조건은 한 글자도 손대지 않았다는 사실이 이 단언
 * 하나로 선다(`accessibilityRole`·`accessibilityLiveRegion`은 레이아웃 속성이 아니다 — 보이는
 * 화면은 한 픽셀도 바뀌지 않는다).
 */
const ROUND80_ANNOUNCE_PROPS_ADDED: ReadonlyArray<{
  readonly file: string;
  readonly before: string;
  readonly after: string;
  readonly added: ReadonlyArray<string>;
  readonly places: number;
  readonly what: string;
  /**
   * ⚠️ 라운드 88 트랙 E — **판정 칸**(위 `ROUND79_ANNOUNCE_PROPS_ADDED`와 같은 계약).
   *
   * 출구는 이 항목의 `after` 바이트에서 파생하고(`announceLedgerPlacesOf`), 이 칸은 그 판정이
   * `live-region`을 부를 때만 값이 된다 — 여기 `places`와 판정이 **같은 모집단**에서 나오므로
   * 0건 위에서 조용히 초록이 되는 자리가 없다.
   */
  readonly crossPlatform: string;
}> = [
  {
    file: "app/settings/privacy.tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    places: 7,
    what: "되돌릴 수 없는 흐름 넷의 확정 실패 셋 + 동의 갱신 하나 + 파기 미리보기 셋 — 같은 화면이 성공만 읽어 주던 그 일곱 자리",
    crossPlatform: ""
  },
  {
    file: "app/import/index.tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    places: 2,
    what: "파일 검증 실패 한 줄과 업로드 실패 한 줄 — 둘 다 눌린 CTA 바로 아래다",
    crossPlatform: ""
  },
  {
    file: "app/import/[importJobId].tsx",
    before: "<Text style={{ color: theme.colors.danger }}>",
    after: '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>',
    added: ['accessibilityLiveRegion="polite"', 'accessibilityRole="alert"'],
    places: 3,
    what:
      "행 편집 실패 · 확정 실패 · 일괄 중간 실패 — 셋째 자리는 트랙 A가 소유 밖 바이트 핀 때문에 남긴 것이고, 같은 라운드의 통합이 그 핀을 모양으로 풀며 함께 걸었다",
    crossPlatform: ""
  }
];

/**
 * ⚠️ **낭독 배선의 실재 확인** — 파생 스윕이 답을 내는 근거가 실제 소스 바이트라는 것을 자리별로
 * 한 번 더 못박는다. 스캐너가 끊겨도(유령 방지가 놓쳐도) 여기가 빨개진다.
 *
 * 조건은 **그 자리의 조건 그대로**여야 한다(갈리면 화면이 그리는 순간과 읽는 순간이 어긋난다).
 */
const ROUND80_ANNOUNCE_WIRING: ReadonlyArray<{
  readonly file: string;
  readonly guard: string;
  readonly announced: string;
}> = [
  {
    file: "app/settings/privacy.tsx",
    guard: "reconsent.isError || consentToggle.isError",
    announced: "consentUpdateFailureText"
  },
  { file: "app/settings/privacy.tsx", guard: "childPreview.isError", announced: "childPreviewLoadErrorCopy.title" },
  { file: "app/settings/privacy.tsx", guard: "childDelete.isError", announced: "childDeleteFailureText" },
  {
    file: "app/settings/privacy.tsx",
    guard: "householdPreview.isError",
    announced: "householdPreviewLoadErrorCopy.title"
  },
  { file: "app/settings/privacy.tsx", guard: "householdLeave.isError", announced: "householdLeaveFailureText" },
  {
    file: "app/settings/privacy.tsx",
    guard: "accountPreview.isError",
    announced: "accountPreviewLoadErrorCopy.title"
  },
  { file: "app/settings/privacy.tsx", guard: "accountDelete.isError", announced: "accountDeleteFailureText" },
  {
    file: "app/settings/notifications.tsx",
    guard: "toggleCurrentDevice.isError",
    announced: '"푸시 설정을 바꾸지 못했어요. 알림 권한을 확인한 뒤 다시 시도해 주세요."'
  },
  { file: "app/import/index.tsx", guard: "validationMessage", announced: "validationMessage" },
  {
    file: "app/import/index.tsx",
    guard: "upload.error",
    announced: 'importFailureMessage("upload", upload.error, { isOnline: uploadFailureOnline })'
  },
  {
    file: "app/import/[importJobId].tsx",
    guard: "rowEditFailure",
    announced: 'importFailureMessage("row_edit", rowEditFailure.error, { isOnline: rowEditFailure.isOnline })'
  },
  {
    file: "app/import/[importJobId].tsx",
    guard: "confirm.isError",
    announced: 'importFailureMessage("confirm", confirm.error, { isOnline: confirmFailureOnline })'
  },
  // 라운드 80 통합이 더한 열셋째 — K-10의 자기 문장을 그대로 읽는다(조회 문구를 돌려 쓰지 않는다).
  {
    file: "app/import/[importJobId].tsx",
    guard: 'bulkOutcome === "failed"',
    announced: "IMPORT_BULK_PARTIAL_FAILURE_TEXT"
  }
];

/**
 * ⚠️ **제외는 이유가 적힌 값으로** — 쿼리 방아쇠 자리는 이번에도 열지 않는다.
 *
 * 라운드 79 T-1의 판정 문장 그대로이고, 이 라운드가 바꾼 것은 그 문장이 **대장**이 아니라
 * **방아쇠**를 말한다는 것 하나다. 그리고 그 판정이 오늘 소스에서 파생으로 확인된다 —
 * 쿼리에 닿는 자리는 **하나도 맨 줄로 서지 않는다**(전부 카드·목록·갈래 안이다).
 */
const QUERY_TRIGGER_OUT_OF_SCOPE_REASON =
  "쿼리가 세우는 실패 문장은 화면 영역이 통째로 바뀌어(카드·빈 상태·목록 갈래) 사용자가 다시 훑는다 — " +
  "포커스가 눌린 컨트롤에 남은 채 맨 줄이 서는 뮤테이션 자리와 조건이 다르다. 자동 낭독이 실제로 필요한지는 " +
  "실기기 확인 항목(A-20 #85)이고, 답이 '필요하다'면 다음 라운드가 같은 형식으로 그 모집단을 연다.";

/**
 * 오늘의 실측(2026-08-30 · 라운드 80 리뷰 M-1 재실측). 화면별 자리 수가 값으로 서 있어야
 * 하나가 늘거나 줄 때 빨개진다.
 *
 * ⚠️ **종전 값 여덟 화면 스무 자리는 스캐너의 답이지 소스의 답이 아니었다.** 세 구멍이 있었다:
 *  ⓐ 삼항의 **else 가지**가 then 조건에 귀속돼(`enclosingJsxGuards`), 화면 하단이 통째로 상단
 *    로딩/오류 삼항의 else인 화면에서 입력 검증·버튼 라벨·저장 실패 Toast가 "쿼리 조건"에 매달렸다.
 *  ⓑ `useMutation` 옵션 객체를 통째로 제외해 **`onError`가 세우는 저장 실패 문장**이 빠졌다.
 *  ⓒ **실패 갈래**(`try/catch` · `.catch(…)`)와 `style={styles.…}`·배열 스타일을 세지 않아
 *    로그인·준비템 상태 변경의 실패 문장이 통째로 모집단 밖이었다.
 * 정정 뒤 자리는 여덟 화면 스무 개에서 **열세 화면 스물다섯 개**가 됐고, 늘어난 다섯은 전부
 * 이미 출구를 가진 자리였다(Toast 넷 + 로그인의 announce 하나 — 새로 뚫은 침묵은 0건이다).
 */
const MUTATION_TRIGGER_SITES_BY_SCREEN: Readonly<Record<string, number>> = {
  "app/(auth)/login.tsx": 1,
  "app/(tabs)/items.tsx": 1,
  "app/budget.tsx": 1,
  "app/expenses/[expenseId].tsx": 1,
  "app/expenses/new.tsx": 1,
  "app/family/accept/[token].tsx": 1,
  "app/family/invite.tsx": 1,
  "app/import/[importJobId].tsx": 3,
  "app/import/index.tsx": 2,
  "app/items/[itemTemplateId].tsx": 1,
  "app/settings/children.tsx": 3,
  "app/settings/notifications.tsx": 2,
  "app/settings/privacy.tsx": 7
};

/**
 * 같은 스윕이 세는 쿼리 방아쇠 자리(제외 쪽). 값이 있어야 "0건"이 스캔이 끊긴 결과가 아니다.
 *
 * ⚠️ **이 칸은 "실패 문장"이 아니라 *이 스캐너가 쿼리 조건 아래 danger 색 글자로 분류한 자리*다.**
 * `app/family/index.tsx`의 넷 중 셋은 실패 문장이 아니라 **파괴적 동작의 버튼 라벨**
 * (`삭제`·가구 추가·탈퇴)이고, 그 자리들이 여기 서 있는 이유는 danger 색을 입기 때문이다.
 * 그래도 판정은 같다 — 이 칸은 통째로 범위 밖이고(아래 `QUERY_TRIGGER_OUT_OF_SCOPE_REASON`),
 * 값이 서 있는 목적은 "0건"이 스캔이 끊긴 결과가 아님을 보이는 것 하나다.
 */
/**
 * ⚠️ **두 시점(라운드 96 T6)** — 종전에는 설정 3화면(children·notifications·privacy)이 한 자리씩
 * 더 있었다(조회 실패를 Card + danger 색 `<Text>`로 직접 그리던 자리). T6가 그 세 자리를 T1의
 * `LoadErrorCard` 한 벌로 옮기면서 이 스캐너의 "danger 색 글자" 바늘 밖으로 나갔다 — 문구·재시도
 * 라벨은 같은 단일 소스(useLoadErrorCopy) 그대로이고, 상태는 여전히 카드 영역 전체가 말한다
 * (제외 사유 `QUERY_TRIGGER_OUT_OF_SCOPE_REASON`의 그 조건이 더 또렷해진 것이지 침묵이 는 것이
 * 아니다).
 */
const QUERY_TRIGGER_SITES_BY_SCREEN: Readonly<Record<string, number>> = {
  "app/family/accept/[token].tsx": 2,
  "app/family/index.tsx": 4,
  "app/import/[importJobId].tsx": 2
};

/**
 * ⚠️ **영역 안에 선 뮤테이션 자리 — 오늘 하나이고 그 하나는 침묵이 아니다.**
 *
 * 라운드 80 트랙 A는 *"뮤테이션 자리는 전부 맨 줄"* 을 부정 단언으로 세웠는데, 그 값은 모집단이
 * 다섯 자리 좁던 때의 값이었다. 재실측에서 하나가 영역 안에 선다: `app/(auth)/login.tsx`는
 * 문장을 **alert 컨테이너 `<View>` 안**에 두고 프롭 쌍을 그 컨테이너에 건다(관례의 본보기 —
 * `ANDROID_ONLY_LIVE_REGION_REASON`이 인용하는 그 화면이다). 모양은 `contained`지만 포커스
 * 조건은 같고(눌린 [로그인] 버튼 아래), 출구는 `announce`다.
 */
const CONTAINED_MUTATION_SITES: Readonly<Record<string, string>> = {
  "app/(auth)/login.tsx loginError":
    "문장이 alert 컨테이너 <View accessibilityRole=\"alert\" accessibilityLiveRegion=\"polite\"> 안에 선다 — 프롭 쌍은 그 컨테이너의 것이고 announceForA11y 배선도 이미 있다"
};

describe("GAP-080 #1 눌러서 나타난 실패의 낭독 계약 (방아쇠에서 파생)", () => {
  const allSites = () => listRouteSources().flatMap((screen) => mutationTriggerSites(screen));

  it("ⓐ app/** 전수 — 뮤테이션이 세우는 실패 문장은 낭독 출구를 가진다 (모집단은 방아쇠다)", () => {
    const routes = listRouteSources();
    // 유령 방지: 모집단이 디렉터리 전수라, 스캔이 끊기면 아래 부정 단언이 영원히 초록이다.
    expect(routes.length, "라우트 소스 전수").toBeGreaterThan(20);

    const sites = allSites();
    const mutationSites = sites.filter((site) => site.trigger === "mutation");
    const byScreen: Record<string, number> = {};
    for (const site of mutationSites) byScreen[site.screen] = (byScreen[site.screen] ?? 0) + 1;
    expect(byScreen, "화면별 뮤테이션 방아쇠 자리").toEqual(MUTATION_TRIGGER_SITES_BY_SCREEN);
    // 라운드 79의 대장 다섯 화면 일곱 자리는 이 모집단 **안**에 있다(한 겹 넓힌 것이지 옮긴 것이 아니다).
    for (const screen of OFFLINE_AWARE_SAVE_ERROR_SCREENS) {
      expect(byScreen[screen], `${screen}은 방아쇠 모집단 안에 있다`).toBeGreaterThan(0);
    }
    // 오늘의 실측(리뷰 M-1 재실측): **스물다섯 자리**(Text 스물 + Toast 다섯).
    // 종전 값은 스물이었고 늘어난 다섯은 스캐너가 놓치던 자리다 — 지출 저장 실패 Toast 둘
    // (`new.tsx`·`[expenseId].tsx`) · 준비템 상태 변경 실패 Toast 둘(`(tabs)/items.tsx`·
    // `items/[itemTemplateId].tsx`) · 로그인 실패 카드 하나(`(auth)/login.tsx`).
    expect(mutationSites.length, "뮤테이션 방아쇠 자리 합계").toBe(25);

    const exits: Record<string, number> = {};
    for (const site of mutationSites) exits[site.exit] = (exits[site.exit] ?? 0) + 1;
    // 오늘의 값: 낭독 밖은 **0건**이다. 스물은 프롭 + useEffect로, 다섯(Toast)은 자기가
    // announce해서 출구를 가진다. ⚠️ 재실측이 더한 다섯 자리는 **전부 이미 출구가 있었다** —
    // 넓어진 모집단이 새로 뚫은 침묵은 0건이다.
    expect(exits, "출구별 자리 수").toEqual({ announce: 20, toast: 5 });
  });

  it("ⓑ 부정 단언 — 프롭만 걸린 자리 0건(iOS 침묵 0건) · 낭독 밖 0건이고 그 0이 값에서 파생한다", () => {
    const mutationSites = allSites().filter((site) => site.trigger === "mutation");
    const androidOnly = mutationSites.filter((site) => site.exit === "live-region").map((site) => `${site.screen} ${site.guard}`);
    // 프롭 조합은 안드로이드의 답이고 iOS는 announce가 답한다 — 반쪽으로 닫힌 자리가 0건이다.
    expect(androidOnly.sort(), "프롭만 걸려 안드로이드에서만 읽히는 자리").toEqual([]);
    expect(ANDROID_ONLY_LIVE_REGION_REASON, "한 플랫폼만 답하는 자리를 세는 이유").toContain("@platform android");

    const silent = mutationSites.filter((site) => site.exit === "silent").map((site) => `${site.screen} ${site.guard}`);
    // 오늘의 값: 낭독 밖은 0건이다. 그 0은 손으로 적은 값이 아니라 **자기 무효화되는 제외
    // 목록**에서 파생한다 — 제외가 다시 생기면 그 목록에 이유가 값으로 적혀야 하고, 적히지
    // 않은 침묵은 여기서 빨개진다.
    expect(silent.sort(), "낭독 밖에 남은 자리").toEqual([]);
    expect(silent.sort(), "낭독 밖에 남은 자리").toEqual(Object.keys(MUTATION_ANNOUNCE_BLOCKED_BY_SOURCE_PIN).sort());
    // ⚠️ 비었다는 **사실과 그 경위**도 값으로 선다(형식만 남고 아무도 세지 않는 목록이 되지 않게).
    expect(Object.keys(MUTATION_ANNOUNCE_BLOCKED_BY_SOURCE_PIN), "낭독 밖으로 남겨 둔 자리").toEqual([]);
    expect(MUTATION_ANNOUNCE_NO_BLOCKED_SITES_REASON.length, "비어 있는 경위").toBeGreaterThan(0);
    expect(MUTATION_ANNOUNCE_NO_BLOCKED_SITES_REASON).toContain("모양 핀");

    // ⚠️ 그 0을 떠받치는 근거 — 바이트 핀을 모양으로 푼 그 완화가 **소유 밖 파일에 실재한다**.
    // 바이트로 되돌아가는 날 여기가 먼저 빨개진다(그러면 이 자리는 다시 침묵이어야 한다).
    expect(ROUND80_RELAXED_PIN_DEPENDENCY.length, "모양으로 풀린 핀").toBe(1);
    for (const pin of ROUND80_RELAXED_PIN_DEPENDENCY) {
      expect(source(pin.file), `${pin.file}: ${pin.why}`).toContain(pin.needle);
      expect(pin.why.length, `${pin.file} 완화의 근거`).toBeGreaterThan(0);
    }

    // 아래 규율은 제외가 다시 생기는 날을 위해 그대로 선다(줄이 생기면 곧바로 그 줄을 검사한다).
    for (const [key, entry] of Object.entries(MUTATION_ANNOUNCE_BLOCKED_BY_SOURCE_PIN)) {
      const screen = key.slice(0, key.indexOf(" "));
      expect(entry.reason.length, `${key}의 제외 사유`).toBeGreaterThan(0);
      expect(source(screen), `${key}: 화면의 그 구간`).toContain(entry.screenPin);
      expect(entry.pinnedBy.length, `${key}를 붙드는 핀`).toBeGreaterThan(0);
      for (const pin of entry.pinnedBy) {
        // ⚠️ 핀이 모양으로 풀리는 날 이 줄이 빨개진다 — 그때가 프롭 둘을 거는 라운드다.
        expect(source(pin.file), `${key}를 붙드는 핀이 ${pin.file}에 실재한다`).toContain(pin.needle);
      }
    }
  });

  it("ⓒ 낭독 배선이 소스에 실재한다 (조건은 그 자리의 조건 그대로다)", () => {
    expect(ROUND80_ANNOUNCE_WIRING, "이 라운드가 세운 낭독 자리").toHaveLength(13);
    for (const entry of ROUND80_ANNOUNCE_WIRING) {
      const masked = maskComments(source(entry.file));
      const effects = callBlocksOf(masked, "useEffect").filter((block) => block.includes("announceForA11y("));
      const wired = effects.find(
        (block) => block.includes(`if (${entry.guard})`) && block.includes(`announceForA11y(${entry.announced})`)
      );
      expect(wired, `${entry.file}: ${entry.guard}의 낭독 배선`).toBeTruthy();
      // 렌더 도중이 아니라 effect 안이고, 의존 배열이 그 조건을 든다(두 번째 실패가 조용해지지 않게).
      const deps = wired!.slice(wired!.lastIndexOf(", ["));
      expect(deps, `${entry.file}: ${entry.guard}의 의존 배열`).toContain(entry.guard.split(" ")[0]);
    }

    // ⚠️ **리뷰 S-5 — 문장이 두 벌 리터럴로 사는 자리는 그 둘이 같아야 한다.**
    // `app/settings/notifications.tsx`의 푸시 실패 줄은 문구를 상수로 빼지 않았다(빼면 그 자리의
    // 바이트가 바뀐다 — 그 판단은 그대로다). 대가는 **같은 문장이 JSX와 announce에 각각** 있다는
    // 것이고, 둘이 갈리면 **화면과 소리가 다른 말을 한다.** 그 대가를 여기서 단언이 진다.
    const twoCopySites = ROUND80_ANNOUNCE_WIRING.filter((entry) => entry.announced.startsWith('"'));
    expect(twoCopySites, "문장을 두 벌 리터럴로 두는 자리").toHaveLength(1);
    for (const entry of twoCopySites) {
      const sentence = JSON.parse(entry.announced) as string;
      const masked = maskComments(source(entry.file));
      const guardAt = masked.indexOf(`{${entry.guard} ? (`);
      expect(guardAt, `${entry.file}: ${entry.guard} 갈래`).toBeGreaterThan(-1);
      const branch = masked.slice(guardAt, masked.indexOf(") : null}", guardAt));
      expect(branch, `${entry.file}: JSX 문장과 announce 문장이 같다`).toContain(sentence);
    }
  });

  it("ⓓ 제외는 이유가 적힌 값이고, 그 이유가 소스에서 파생으로 확인된다 (쿼리 자리는 맨 줄로 서지 않는다)", () => {
    const sites = allSites();
    const querySites = sites.filter((site) => site.trigger === "query");
    const byScreen: Record<string, number> = {};
    for (const site of querySites) byScreen[site.screen] = (byScreen[site.screen] ?? 0) + 1;
    expect(byScreen, "화면별 쿼리 방아쇠 자리").toEqual(QUERY_TRIGGER_SITES_BY_SCREEN);
    // ⚠️ 이 라운드의 판정이 값이 되는 자리다: **쿼리 자리는 하나도 맨 줄로 서지 않는다.**
    expect(
      querySites.filter((site) => site.shape === "bare").map((site) => `${site.screen} ${site.guard}`),
      "맨 줄로 서는 쿼리 자리"
    ).toEqual([]);
    // 반대 방향도 값이다 — 뮤테이션 자리는 **하나만 빼고** 맨 줄이고(그래서 포커스가 눌린
    // 컨트롤에 남는다), 그 하나는 이유가 적힌 값으로 서 있다(alert 컨테이너 관례 · 침묵 아님).
    // ⚠️ 종전 이 단언은 `[]`였다 — 모집단이 다섯 자리 좁던 때의 값이라 재실측이 정정한다.
    expect(
      sites
        .filter((site) => site.trigger === "mutation" && site.shape === "contained")
        .map((site) => `${site.screen} ${site.guard}`)
        .sort(),
      "영역 안에 선 뮤테이션 자리"
    ).toEqual(Object.keys(CONTAINED_MUTATION_SITES).sort());
    for (const [key, why] of Object.entries(CONTAINED_MUTATION_SITES)) {
      expect(why.length, `${key}가 영역 안에 서는 이유`).toBeGreaterThan(0);
      const site = sites.find((candidate) => `${candidate.screen} ${candidate.guard}` === key);
      // 영역 안이어도 **침묵은 아니다** — 프롭 쌍이 컨테이너에 서 있고 announce도 있다.
      expect(site?.exit, `${key}의 출구`).toBe("announce");
    }
    expect(QUERY_TRIGGER_OUT_OF_SCOPE_REASON, "제외 사유").toContain("포커스");
    expect(QUERY_TRIGGER_OUT_OF_SCOPE_REASON, "제외 사유").toContain("실기기");
    expect(QUERY_TRIGGER_OUT_OF_SCOPE_REASON.length, "이유는 빈 문자열일 수 없다").toBeGreaterThan(0);
  });

  it("ⓔ 재현 — 프롭·배선을 뺀 소스가 실제로 빨개지고, 방아쇠 판정이 네 모양을 가른다", () => {
    const screen = (tag: string, effect: string) => `
      const save = useMutation({ mutationFn: (input) => updateThing(input) });
      ${effect}
      export default function Screen() {
        return (
          <View style={{ gap: 12 }}>
            {save.isError ? ${tag}{failText}</Text> : null}
          </View>
        );
      }
    `;
    const props = '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>';
    const announce = "useEffect(() => { if (save.isError) announceForA11y(failText); }, [save.isError, failText]);";
    expect(mutationTriggerSitesOf(screen("<Text style={{ color: theme.colors.danger }}>", ""), "fixture")).toEqual([
      { screen: "fixture", guard: "save.isError", trigger: "mutation", shape: "bare", exit: "silent" }
    ]);
    expect(mutationTriggerSitesOf(screen(props, ""), "fixture")).toEqual([
      { screen: "fixture", guard: "save.isError", trigger: "mutation", shape: "bare", exit: "live-region" }
    ]);
    expect(mutationTriggerSitesOf(screen(props, announce), "fixture")).toEqual([
      { screen: "fixture", guard: "save.isError", trigger: "mutation", shape: "bare", exit: "announce" }
    ]);
    // 관례는 **둘 다**다 — announce만 있고 프롭이 없으면 여전히 낭독 밖으로 센다.
    expect(mutationTriggerSitesOf(screen("<Text style={{ color: theme.colors.danger }}>", announce), "fixture")).toEqual([
      { screen: "fixture", guard: "save.isError", trigger: "mutation", shape: "bare", exit: "silent" }
    ]);

    // 쿼리 방아쇠는 같은 그물이 **다른 칸**으로 센다(영역 교체 — 이번 라운드의 범위 밖).
    const queryScreen = `
      const thing = useQuery({ queryKey: ["thing"] });
      const save = useMutation({ mutationFn: (input) => updateThing(input) });
      export default function Screen() {
        return (
          <View>
            {thing.isError ? (
              <Card>
                <Text style={{ color: theme.colors.danger }}>{loadErrorCopy.title}</Text>
              </Card>
            ) : null}
          </View>
        );
      }
    `;
    expect(mutationTriggerSitesOf(queryScreen, "fixture")).toEqual([
      { screen: "fixture", guard: "thing.isError", trigger: "query", shape: "contained", exit: "silent" }
    ]);

    // 눌러서 세워지는 **문장 state**는 뮤테이션 자리다(파일 검증 → 업로드가 그 모양이다).
    const pressedScreen = `
      const [validationMessage, setValidationMessage] = useState(null);
      const save = useMutation({ mutationFn: (input) => updateThing(input) });
      const pick = async () => {
        const chosen = await choose();
        if (!chosen.ok) {
          setValidationMessage(chosen.message);
          return;
        }
        save.mutate(chosen);
      };
      export default function Screen() {
        return <View>{validationMessage ? <Text style={{ color: theme.colors.danger }}>{validationMessage}</Text> : null}</View>;
      }
    `;
    expect(mutationTriggerSitesOf(pressedScreen, "fixture")).toEqual([
      { screen: "fixture", guard: "validationMessage", trigger: "mutation", shape: "bare", exit: "silent" }
    ]);

    // ⚠️ **보이기 스위치는 문장이 아니다** — 같은 핸들러에서 세워져도 입력 검증 자리는 세지 않는다.
    const toggleScreen = `
      const [showErrors, setShowErrors] = useState(false);
      const save = useMutation({ mutationFn: (input) => updateThing(input) });
      const submit = () => {
        setShowErrors(true);
        save.mutate(form);
      };
      export default function Screen() {
        return <View>{showErrors && nicknameError ? <Text style={{ color: theme.colors.danger }}>{nicknameError}</Text> : null}</View>;
      }
    `;
    expect(mutationTriggerSitesOf(toggleScreen, "fixture")).toEqual([]);

    // ⚠️ **리뷰 M-1 ⓐ의 재현 — 삼항의 else 가지는 그 조건의 자리가 아니다.**
    // 종전 스캐너는 아래 Toast를 `load.isError`(쿼리)에 매달아 "쿼리 자리"로 셌다.
    const elseBranchScreen = `
      const load = useQuery({ queryKey: ["thing"] });
      const save = useMutation({ mutationFn: (input) => updateThing(input) });
      export default function Screen() {
        return (
          <View>
            {load.isError ? (
              <Card><Text style={{ color: theme.colors.danger }}>{loadErrorCopy.title}</Text></Card>
            ) : (
              <View>
                {save.isError ? <Toast message={saveErrorText} tone="error" /> : null}
              </View>
            )}
          </View>
        );
      }
    `;
    expect(mutationTriggerSitesOf(elseBranchScreen, "fixture")).toEqual([
      { screen: "fixture", guard: "load.isError", trigger: "query", shape: "contained", exit: "silent" },
      { screen: "fixture", guard: "save.isError", trigger: "mutation", shape: "bare", exit: "toast" }
    ]);

    // ⚠️ **리뷰 M-1 ⓑ의 재현 ① — `onError`는 제외가 아니라 방아쇠다**(성공 뒤처리만 제외한다).
    const mutationCallbackScreen = (option: string) => `
      const [saveErrorMessage, setSaveErrorMessage] = useState(null);
      const save = useMutation({
        mutationFn: (input) => updateThing(input),
        ${option}: (error) => {
          setSaveErrorMessage(mutationErrorMessage(error));
        }
      });
      export default function Screen() {
        return <View>{saveErrorMessage ? <Toast message={saveErrorMessage} tone="error" /> : null}</View>;
      }
    `;
    expect(mutationTriggerSitesOf(mutationCallbackScreen("onError"), "fixture")).toEqual([
      { screen: "fixture", guard: "saveErrorMessage", trigger: "mutation", shape: "bare", exit: "toast" }
    ]);
    expect(mutationTriggerSitesOf(mutationCallbackScreen("onSuccess"), "fixture")).toEqual([]);

    // ⚠️ **리뷰 M-1 ⓑ의 재현 ② — 실패 갈래(`.catch`)는 그 자체가 방아쇠다.**
    // 바깥 핸들러가 api/client가 아닌 오프라인 큐를 부르는 모양이고, 종전에는 통째로 빠졌다.
    const offlineQueueScreen = `
      const [statusErrorMessage, setStatusErrorMessage] = useState(null);
      const applyStatusChange = (variables) => {
        setStatusErrorMessage(null);
        void updateItemStatusOffline(authToken, queryClient, variables)
          .then(() => trackAndFlushAnalyticsEvent(authToken, {}))
          .catch(() => {
            setStatusErrorMessage(ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE);
          });
      };
      export default function Screen() {
        return <View>{statusErrorMessage ? <Toast message={statusErrorMessage} tone="error" /> : null}</View>;
      }
    `;
    expect(mutationTriggerSitesOf(offlineQueueScreen, "fixture")).toEqual([
      { screen: "fixture", guard: "statusErrorMessage", trigger: "mutation", shape: "bare", exit: "toast" }
    ]);

    // ⚠️ **리뷰 M-1 ⓑ의 재현 ③ — `style={styles.…}`·배열 스타일도 danger 글자다**, 그리고
    // 프롭 쌍이 **alert 컨테이너**에 서 있으면 그 자리는 침묵이 아니다(로그인 화면의 관례).
    const styleSheetScreen = (style: string) => `
      const [loginError, setLoginError] = useState(null);
      useEffect(() => {
        if (loginError) announceForA11y(loginError);
      }, [loginError]);
      async function login() {
        try {
          await oauthLogin("kakao");
        } catch (error) {
          setLoginError(loginFailureMessage(error));
        }
      }
      export default function Screen() {
        return (
          <View>
            {loginError ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorCard}>
                <Text style=${style}>{loginError}</Text>
              </View>
            ) : null}
          </View>
        );
      }
      const styles = StyleSheet.create({
        errorText: { color: theme.colors.danger, fontSize: 12 }
      });
    `;
    for (const style of ["{styles.errorText}", "{[styles.errorText, styles.centered]}"]) {
      expect(mutationTriggerSitesOf(styleSheetScreen(style), "fixture"), style).toEqual([
        { screen: "fixture", guard: "loginError", trigger: "mutation", shape: "contained", exit: "announce" }
      ]);
    }

    // 두 번째 출구도 같은 그물이 센다 — Toast는 프롭이 아니라 자기가 announce해서 통과한다.
    const toastScreen = `
      const save = useMutation({ mutationFn: (input) => updateThing(input) });
      export default function Screen() {
        return <View>{save.isError ? <Toast message={saveErrorText} tone="error" /> : null}</View>;
      }
    `;
    expect(mutationTriggerSitesOf(toastScreen, "fixture")).toEqual([
      { screen: "fixture", guard: "save.isError", trigger: "mutation", shape: "bare", exit: "toast" }
    ]);
  });

  it("ⓕ 바이트 불변 — 더한 것은 프롭뿐이다 (문장·스타일·조건 무접촉)", () => {
    for (const entry of ROUND80_ANNOUNCE_PROPS_ADDED) {
      const src = source(entry.file);
      expect(src.match(new RegExp(entry.after.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? [], `${entry.file}: ${entry.what}`).toHaveLength(
        entry.places
      );
      const stripped = entry.added.reduce((tag, prop) => tag.replace(` ${prop}`, ""), entry.after);
      expect(stripped, `${entry.file}: 프롭을 빼면 종전 바이트다`).toBe(entry.before);
      for (const prop of entry.added) {
        expect(prop, "레이아웃 속성 금지").toMatch(/^accessibility(Role|LiveRegion)="/);
      }
    }

    // 조건과 문장은 그대로다 — 열두 자리의 갈래·문구가 한 글자도 바뀌지 않았다.
    const privacyScreen = source("app/settings/privacy.tsx");
    for (const guard of [
      "{reconsent.isError || consentToggle.isError ? (",
      "{childPreview.isError ? (",
      "{childDelete.isError ? (",
      "{householdPreview.isError ? (",
      "{householdLeave.isError ? (",
      "{accountPreview.isError ? (",
      "{accountDelete.isError ? ("
    ]) {
      expect(privacyScreen, `개인정보 화면의 갈래 ${guard}`).toContain(guard);
    }
    // 문장은 여전히 순수 모듈·공용 훅의 것이다(화면이 다시 적지 않는다 — 위 GAP-071 #2가 지는 사실).
    expect(privacyScreen).toContain("const childPreviewLoadErrorCopy = useLoadErrorCopy(childPreview.isError);");

    const uploadScreen = source("app/import/index.tsx");
    expect(uploadScreen).toContain("{validationMessage ? (");
    expect(uploadScreen).toContain("{upload.error ? (");
    expect(uploadScreen).toContain('{importFailureMessage("upload", upload.error, { isOnline: uploadFailureOnline })}');

    const reviewScreen = source("app/import/[importJobId].tsx");
    expect(reviewScreen).toContain("{rowEditFailure ? (");
    expect(reviewScreen).toContain("{confirm.isError ? (");
    expect(reviewScreen).toContain(
      '{importFailureMessage("row_edit", rowEditFailure.error, { isOnline: rowEditFailure.isOnline })}'
    );
    expect(reviewScreen).toContain('{importFailureMessage("confirm", confirm.error, { isOnline: confirmFailureOnline })}');
    // 일괄 중간 실패도 조건·문장이 그대로다 — K-10의 자기 문장이지 조회 문구가 아니다.
    expect(reviewScreen).toContain('{bulkOutcome === "failed" ? (');
    expect(reviewScreen).toContain("{IMPORT_BULK_PARTIAL_FAILURE_TEXT}");

    // 알림 화면은 announce 한 칸만 늘었다 — 프롭 쌍은 라운드 79가 세운 **둘** 그대로다.
    const notificationsScreen = source("app/settings/notifications.tsx");
    expect(
      notificationsScreen.match(/accessibilityLiveRegion="polite" accessibilityRole="alert"/g) ?? [],
      "알림 화면의 프롭 쌍"
    ).toHaveLength(2);
    expect(notificationsScreen).toContain("{toggleCurrentDevice.isError ? (");
  });

  it("ⓖ 판정이 값으로 적혀 있다 (다음 라운드가 같은 스윕을 대장으로 다시 돌리지 않도록)", () => {
    expect(ANNOUNCE_UNIT_IS_THE_TRIGGER_REASON, "이 라운드의 판정").toContain("단위는 대장이 아니라 방아쇠다");
    // 그 판정은 위 GAP-079의 사유를 **정정한** 것이다 — 오늘 그 문장도 방아쇠를 말한다.
    expect(LOAD_ERROR_ANNOUNCE_OUT_OF_SCOPE_REASON, "정정된 사유").toContain("방아쇠");
    // 대장 스윕의 기록은 한 글자도 바뀌지 않았다(그 일곱 자리는 오늘도 그대로 낭독된다).
    expect(ROUND79_ANNOUNCE_PROPS_ADDED.length, "라운드 79의 기록").toBe(6);
    expect(Object.keys(SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN), "대장 스윕의 제외").toEqual([]);
  });
});

/* ============================================================================================ */
/* GAP-087 트랙 C(#3) — **모듈 층의 낭독** (뿌리를 하나 더한다)                                    */
/* ============================================================================================ */

/**
 * ## 위 두 스윕이 구조적으로 보지 못하던 층
 *
 * GAP-079는 대장(`OFFLINE_AWARE_SAVE_ERROR_SCREENS`)을, GAP-080은 `listRouteSources()`를 걷는다.
 * **둘 다 `app/**` 한 뿌리다.** 그런데 이 저장소에서 실패 문장이 실제로 사는 곳은 화면이 아니라
 * 모듈이고(`src/offline/offline-aware-screens.ts`의 `OFFLINE_AWARE_FAILURE_COPY_MODULES` 머리말이
 * 같은 사실을 저장 리터럴 축에서 이미 적어 두었다), 온보딩 세 화면은 그 문장을 **컴포넌트 태그
 * 하나**(`<OnboardingSaveErrorCard …/>`)로 그린다. 그래서 방아쇠 스윕의 화면별 표에
 * `app/(onboarding)/**`가 0건이다 — 스캐너가 문장을 볼 자리가 없다.
 *
 * ⚠️ **그 사각에 값이 앉아 있었다.** `src/onboarding/step-ui.tsx`의 `OnboardingSaveErrorCard`는
 * 라운드 79가 프롭 둘을 걸어 둔 채(`ROUND79_ANNOUNCE_PROPS_ADDED`의 여섯째 — 설명이 *"모듈 층의
 * 한 자리"* 라고 적는다) `announceForA11y`가 **0건**이었다. 이 저장소 자신의 분류로 그것은
 * `live-region` = **안드로이드 한정**이고(`ANDROID_ONLY_LIVE_REGION_REASON`), 앱의 첫 여정인
 * ONB-002·003·004의 저장 실패가 iOS에서 소리 없이 서고 있었다. **대장에 이름이 있다는 사실이
 * 오히려 "이 자리는 세어졌다"로 읽힌 자리다.**
 *
 * ⚠️ **이 블록은 위 두 스윕을 고치지 않는다 — 그 옆에 뿌리를 하나 더 세운다.** 모집단을 옮기면
 * U절 이월과 라운드 80의 값이 함께 흔들리므로, 두 스윕의 값(`MUTATION_TRIGGER_SITES_BY_SCREEN` ·
 * `SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN` · `ALERT_ROLE_WITHOUT_LIVE_REGION`)은 **바이트 불변**이다.
 *
 * 형식은 어드민이 라운드 75에 같은 사각을 닫으며 세운 그것이다
 * (`apps/admin/src/admin-load-error-copy.test.ts`의 `SCREEN_SOURCE_ROOTS` +
 * `NON_SCREEN_SOURCE_ROOTS` — **걷는 뿌리와 걷지 않는 뿌리와 그 이유가 둘 다 값**).
 */
const MODULE_ANNOUNCE_SOURCE_ROOTS = ["src"] as const;

/**
 * 그리고 **걷지 않는 뿌리와 그 이유**. 이유는 빈 문자열일 수 없다 — 다음 라운드가
 * "왜 여기는 안 보나"를 다시 재지 않게(어드민 라운드 75의 그 규율 그대로).
 */
const NON_MODULE_ANNOUNCE_SOURCE_ROOTS: Readonly<Record<string, string>> = {
  app: "라우트 뿌리다. 이 뿌리는 위 두 스윕이 이미 전수로 걷는다 — GAP-079가 대장(OFFLINE_AWARE_SAVE_ERROR_SCREENS)으로, GAP-080이 listRouteSources()로 걷고, 두 스윕 모두 낭독 출구를 같은 세 칸(announce · live-region · toast)으로 매긴다. 이 뿌리를 여기서 한 번 더 걷으면 같은 자리가 두 모집단에서 서로 다른 답을 낼 수 있고, 무엇보다 그 두 값(자리 수·출구 수)은 U절 이월이 붙들고 있는 바이트다."
};

/** 모듈 층에서 낭독 프롭 쌍이 걸린 한 자리와, 그 자리가 소리로 나가는 출구. */
type ModuleAnnounceSite = {
  readonly file: string;
  /** 그 자리를 그리는 **최상위 함수 컴포넌트**의 이름. */
  readonly component: string;
  /** `announce` = 프롭 쌍 + 그 컴포넌트의 `announceForA11y`(두 플랫폼 다) · `live-region` = 프롭만. */
  readonly exit: "announce" | "live-region";
};

/** 파일의 **최상위 `function` 선언** 블록들(이름 · 구간). 자리를 컴포넌트에 귀속시키는 데 쓴다. */
function topLevelFunctionBlocksOf(masked: string): Array<{ readonly name: string; readonly start: number; readonly end: number }> {
  const found = [...masked.matchAll(/^(?:export\s+)?(?:default\s+)?function\s+([A-Za-z0-9_$]+)/gm)];
  return found.map((match, index) => ({
    name: match[1],
    start: match.index ?? 0,
    end: index + 1 < found.length ? (found[index + 1].index ?? masked.length) : masked.length
  }));
}

/**
 * 한 모듈 소스에서 **낭독 프롭 쌍이 걸린 여는 태그**를 전부 찾아 출구를 매긴다.
 *
 * 판정은 두 칸이다: 그 자리를 그리는 컴포넌트가 `announceForA11y`를 부르면 `announce`(두 플랫폼
 * 다), 프롭만 걸려 있으면 `live-region`(안드로이드 한정 — iOS 무음). 화면 층 스윕들이 쓰는
 * 그 세 칸에서 `toast`·`silent`가 빠진 이유는 모집단이 다르기 때문이다: 여기 모집단은 **프롭
 * 쌍이 이미 걸린 자리**이고(그래서 `silent`가 있을 수 없다), Toast는 자기 컴포넌트가 이 뿌리
 * 안에 있어 같은 그물이 직접 센다(`src/ui.tsx`의 `Toast` — 아래 값에 자리로 서 있다).
 */
function moduleAnnounceSitesOf(sourceText: string, file: string): ModuleAnnounceSite[] {
  const masked = maskComments(sourceText);
  const blocks = topLevelFunctionBlocksOf(masked);
  const sites: ModuleAnnounceSite[] = [];
  const pattern = /<[A-Z][A-Za-z0-9_.]*/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const end = openingTagEnd(masked, found.index);
    if (end < 0) continue;
    const openTag = masked.slice(found.index, end + 1);
    // 제네릭(`Record<string, …>`)이 뒤따르는 JSX를 삼키는 것을 막는다 — 여는 태그 안에 `<`는 없다.
    if (openTag.slice(1).includes("<")) continue;
    if (!ANNOUNCED_ALERT_PROPS.every((prop) => openTag.includes(prop))) continue;
    const at = found.index;
    const block = blocks.find((candidate) => at >= candidate.start && at < candidate.end);
    sites.push({
      file,
      component: block?.name ?? "",
      exit: block && masked.slice(block.start, block.end).includes("announceForA11y(") ? "announce" : "live-region"
    });
  }
  return sites;
}

/** 같은 그물의 반쪽 세기 — 프롭이 **한 짝만** 걸린 자리(이 스윕의 사각 하나를 값으로 만든다). */
function halfAnnouncedTagCount(sourceText: string): number {
  const masked = maskComments(sourceText);
  let count = 0;
  const pattern = /<[A-Z][A-Za-z0-9_.]*/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const end = openingTagEnd(masked, found.index);
    if (end < 0) continue;
    const openTag = masked.slice(found.index, end + 1);
    if (openTag.slice(1).includes("<")) continue;
    const present = ANNOUNCED_ALERT_PROPS.filter((prop) => openTag.includes(prop)).length;
    if (present === 1) count += 1;
  }
  return count;
}

/** 걷는 뿌리(`src/**`)의 컴포넌트 소스 전수 — 손 목록이 아니라 디렉터리가 모집단을 정한다. */
function listModuleComponentSources(): string[] {
  return listComponentSources().filter((path) =>
    MODULE_ANNOUNCE_SOURCE_ROOTS.some((root) => path.startsWith(`${root}/`))
  );
}

const moduleAnnounceSites = () =>
  listModuleComponentSources().flatMap((file) => moduleAnnounceSitesOf(source(file), file));

/**
 * ⚠️ **오늘의 실측 — 모듈 층에서 낭독 프롭 쌍이 걸린 자리 셋과 그 자리가 무엇인가.**
 *
 * 유령 방지의 본체다: 이 값이 비면 아래 부정 단언(*"프롭만 걸린 자리 0건"*)은 **빈 모집단 위에서
 * 영원히 초록**이다 — 라운드 78 E가 이름 붙인 그 모양이고, 이 트랙이 연 사각이 정확히 그것이다.
 * 각 줄의 이유는 빈 문자열일 수 없다.
 */
const MODULE_ANNOUNCE_SITES: Readonly<Record<string, string>> = {
  "src/onboarding/step-ui.tsx OnboardingSaveErrorCard":
    "온보딩 저장 실패 카드(ONB-002·003·004의 저장이 세운다). 라운드 79가 프롭 둘을 걸었고 라운드 87 트랙 C가 낭독을 더해 두 플랫폼이 됐다 — 이 트랙이 연 그 자리다.",
  "src/security/AppLockOverlay.tsx AppLockOverlay":
    "앱 잠금 오버레이의 안내 줄(PIN 오류·대기 안내·대기 해제). 문장을 세우는 자리마다 같은 걸음에 announceForA11y를 부르므로 종전부터 두 플랫폼이다 — 모듈 층에도 관례가 이미 서 있었다는 증거.",
  "src/ui.tsx Toast":
    "공용 Toast(A11Y-115). 화면 층 스윕 둘이 `toast` 출구로 세던 그 컴포넌트의 **본체**가 이 뿌리에 있다 — 프롭 쌍과 announce를 스스로 진다."
};

/**
 * ⚠️ **이 스윕이 못 보는 것 — 태어날 때부터 값으로 적는다(AA-4의 규율).**
 *
 * 라운드 87 정찰이 센 값: 디렉터리를 걷는 스윕 스물아홉 중 뿌리·제외·사각을 **값으로** 적은 것은
 * 다섯이었고, 적지 않은 사각 하나에 이 트랙의 자리가 앉아 있었다. 같은 일이 이 스윕에서 반복되지
 * 않도록, 무엇을 보고 무엇을 못 보는지를 처음부터 값으로 남긴다.
 */
const MODULE_ANNOUNCE_SWEEP_BLIND_SPOTS: ReadonlyArray<string> = [
  "모집단은 **낭독 프롭 쌍이 이미 걸린 자리**다 — 프롭 없이 실패 문장을 그리는 모듈 컴포넌트는 이 그물에 아예 들어오지 않는다(화면 층에서 danger 색 글자를 세는 GAP-079·080의 축이 모듈 층에는 아직 없다).",
  "출구 판정은 **그 자리를 그리는 컴포넌트 안에 announceForA11y 호출이 있는가**까지다 — 어떤 문장을 어느 조건에서 읽는지는 자리별 소스 단언(ⓐ-2)이 따로 진다.",
  "자리를 컴포넌트에 귀속시키는 단위가 **최상위 `function` 선언**이라, 화살표 상수로 선언한 컴포넌트(`const X = () => …`)는 블록이 갈리지 않는다 — 오늘 이 뿌리의 자리 셋은 전부 `function` 선언이지만, 그 모양이 생기는 날 귀속이 바깥 함수로 밀린다.",
  "프롭이 **한 짝만** 걸린 자리는 이 모집단 밖이고 그 사실은 오늘도 그대로다 — 다만 **밖을 세는 자리는 더 이상 없지 않다**: role 단독은 GAP-079 ⓑ가 app·src 전수로 세고(오늘 하나 · 이유가 값으로 있다), live region 단독은 GAP-090 트랙 A의 반쪽 프롭 스윕이 같은 전수로 세며 자리마다 판정 하나를 파생한다(오늘 여섯 — 배선 둘 · 이미 크로스플랫폼 하나 · 도달 0건 셋). 이 스윕(GAP-087)의 모집단은 프롭 **쌍**이라 그 여섯은 여기 들어오지 않고, 아래 ⓕ는 그 반쪽 자리가 이 뿌리에 실재한다는 사실을 계속 든다.",
  "소스 대조이지 런타임이 아니다 — VoiceOver가 실제로 그 문장을 읽는지는 실기기 확인의 몫이다(react-native는 vitest에서 네이티브 바인딩이 없다)."
];

describe("GAP-087 #3 모듈 층의 낭독 계약 (뿌리를 하나 더한다)", () => {
  it("ⓐ 모듈 뿌리 전수 — 낭독 프롭 쌍이 걸린 자리는 두 플랫폼 다 도달한다", () => {
    const files = listModuleComponentSources();
    // 유령 방지 ①: 뿌리가 실제로 걸린다(스캔이 끊기면 아래 부정 단언이 영원히 초록이다).
    expect(files.length, "모듈 층 컴포넌트 소스 전수").toBeGreaterThan(10);

    const sites = moduleAnnounceSites();
    // 유령 방지 ②: **모집단이 0건이 아니다.** 이 줄이 이 스윕의 값 절반이다.
    expect(sites.length, "모듈 층의 낭독 프롭 자리").toBeGreaterThan(0);

    const byKey = sites.map((site) => `${site.file} ${site.component}`).sort();
    expect(byKey, "모듈 층의 낭독 자리").toEqual(Object.keys(MODULE_ANNOUNCE_SITES).sort());
    for (const [key, why] of Object.entries(MODULE_ANNOUNCE_SITES)) {
      expect(why.length, `${key}가 서 있는 이유`).toBeGreaterThan(40);
    }

    const exits: Record<string, number> = {};
    for (const site of sites) exits[site.exit] = (exits[site.exit] ?? 0) + 1;
    // 오늘의 값: 셋 다 `announce`다(트랙 C 전에는 step-ui 하나가 `live-region`이었다).
    expect(exits, "출구별 자리 수").toEqual({ announce: 3 });
  });

  it("ⓑ 부정 단언 — 모듈 층에 프롭만 걸린 자리 0건이고, 그 0이 모집단에서 파생한다", () => {
    const sites = moduleAnnounceSites();
    const androidOnly = sites
      .filter((site) => site.exit === "live-region")
      .map((site) => `${site.file} ${site.component}`);
    // 프롭 조합은 안드로이드의 답이고 iOS는 announce가 답한다 — 반쪽으로 닫힌 자리가 0건이다.
    expect(androidOnly.sort(), "프롭만 걸려 안드로이드에서만 읽히는 자리").toEqual([]);
    expect(ANDROID_ONLY_LIVE_REGION_REASON, "한 플랫폼만 답하는 자리를 세는 이유").toContain("@platform android");
    // ⚠️ 그 0은 손으로 적은 값이 아니다 — 위 모집단에서 곧바로 파생한다(모집단이 비면 ⓐ가 먼저 빨개진다).
    expect(sites.length, "그 0이 서 있는 모집단").toBe(Object.keys(MODULE_ANNOUNCE_SITES).length);
  });

  it("ⓐ-2 온보딩 저장 실패 카드의 낭독 배선이 소스에 실재한다 (effect 안 · 화면이 그리는 그 문장)", () => {
    const stepUiSource = source("src/onboarding/step-ui.tsx");
    const masked = maskComments(stepUiSource);
    const effects = callBlocksOf(masked, "useEffect").filter((block) => block.includes("announceForA11y("));
    // ⚠️ 마스커의 함정 하나를 여기서 함께 막는다 — `//` 줄 주석 안에 블록 주석의 여는 기호가
    // 들어가면 그 뒤 파일이 통째로 공백이 되고, 이 스윕의 모집단이 **조용히** 비어 버린다.
    expect(masked, "마스킹 뒤에도 카드의 여는 태그가 남아 있다").toContain(
      '<View accessibilityLiveRegion="polite" accessibilityRole="alert">'
    );
    const wired = effects.find((block) => block.includes("announceForA11y(text)"));
    // ⚠️ 배선이 사라지면 여기가 먼저 빨개진다(그러면 이 카드는 다시 iOS에서 무음이다).
    expect(wired, "OnboardingSaveErrorCard의 낭독 배선").toBeTruthy();
    // 렌더 도중이 아니라 **effect 안**이고, 의존 배열이 그 문장을 든다 — 매 렌더 재낭독 0건이고
    // 사유가 갈린 두 번째 실패(네트워크 → 403)는 문장이 바뀌므로 조용해지지 않는다.
    const deps = wired!.slice(wired!.lastIndexOf(", ["));
    expect(deps, "낭독의 의존 배열").toContain("text");

    // 눈과 귀가 같은 말을 한다: 읽는 것은 **화면에 이미 그려진 그 문자열**이다(두 벌 리터럴 0건).
    expect(stepUiSource, "카드가 그리는 문장").toContain("{text}</Text>");
    expect(stepUiSource, "문장의 단일 소스").toContain(
      "const text = message ?? onboardingSaveErrorMessage(error, { isOnline });"
    );
    // 관례는 언제나 **둘 다**다 — 프롭 쌍(라운드 79)과 낭독(라운드 87)이 함께 서 있다.
    expect(stepUiSource, "프롭 쌍").toContain('<View accessibilityLiveRegion="polite" accessibilityRole="alert">');
    expect(stepUiSource, "낭독 함수의 단일 소스에서 온다").toContain('import { announceForA11y, Card, SecondaryButton } from "../ui";');
    expect(source("src/ui.tsx"), "그 함수의 단일 소스").toContain("export function announceForA11y");
  });

  it("ⓒ 걷는 뿌리와 걷지 않는 뿌리가 둘 다 값이고, 모바일의 `.tsx` 전수가 그 둘 중 하나에 속한다", () => {
    expect([...MODULE_ANNOUNCE_SOURCE_ROOTS], "이 스윕이 걷는 뿌리").toEqual(["src"]);

    const swept = new Set(listModuleComponentSources());
    const everyComponent = listComponentSources();
    expect(everyComponent.length, "모바일의 컴포넌트 소스 전수").toBeGreaterThan(20);
    for (const path of everyComponent) {
      if (swept.has(path)) continue;
      const root = Object.keys(NON_MODULE_ANNOUNCE_SOURCE_ROOTS).find((entry) => path.startsWith(`${entry}/`));
      // ⚠️ 뿌리가 하나 더 생기는 날(예: `components/`) 여기가 먼저 빨개진다 — 사각이 조용히 열리지 않게.
      expect(root, `${path}: 스윕 밖인데 이유가 없다`).toBeTruthy();
    }
    for (const [root, reason] of Object.entries(NON_MODULE_ANNOUNCE_SOURCE_ROOTS)) {
      expect(reason.length, `${root}의 제외 이유는 빈 문자열일 수 없다`).toBeGreaterThan(40);
      expect([...MODULE_ANNOUNCE_SOURCE_ROOTS], `${root}는 걷는 뿌리가 아니다`).not.toContain(root);
      // 걷지 않는 이유가 참인지도 값으로 확인한다 — 그 뿌리는 위 두 스윕이 실제로 걷는다.
      expect(everyComponent.some((path) => path.startsWith(`${root}/`)), `${root}에 소스가 실재한다`).toBe(true);
    }
    expect(listRouteSources().length, "app 뿌리를 걷는 스윕이 실재한다").toBeGreaterThan(20);
    expect(OFFLINE_AWARE_SAVE_ERROR_SCREENS.length, "대장을 걷는 스윕이 실재한다").toBeGreaterThan(0);
  });

  it("ⓓ 재현 — 낭독을 뺀 소스가 실제로 빨개진다 (강화가 침묵으로 되돌아가지 않게)", () => {
    // ⚠️ 픽스처의 `function`은 **열 0**에 선다 — 귀속 단위가 최상위 선언이기 때문이다(위 사각 ③).
    const card = (effect: string) => `
export function SaveErrorCard({ error, onRetry }) {
  const text = saveErrorMessage(error);
  ${effect}
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text>{text}</Text>
    </View>
  );
}
`;
    // 프롭만이면 안드로이드 한정이고, announce까지 서야 두 플랫폼 다다.
    expect(moduleAnnounceSitesOf(card(""), "fixture")).toEqual([
      { file: "fixture", component: "SaveErrorCard", exit: "live-region" }
    ]);
    expect(
      moduleAnnounceSitesOf(card("useEffect(() => { announceForA11y(text); }, [text]);"), "fixture")
    ).toEqual([{ file: "fixture", component: "SaveErrorCard", exit: "announce" }]);
    // ⚠️ 낭독이 **다른 컴포넌트**에 있으면 이 자리는 여전히 안드로이드 한정이다(파일 단위로 세지 않는다).
    const otherComponent = `
export function Elsewhere({ notice }) {
  useEffect(() => { announceForA11y(notice); }, [notice]);
  return <Text accessibilityLiveRegion="polite" accessibilityRole="alert">{notice}</Text>;
}
${card("")}
`;
    expect(moduleAnnounceSitesOf(otherComponent, "fixture")).toEqual([
      { file: "fixture", component: "Elsewhere", exit: "announce" },
      { file: "fixture", component: "SaveErrorCard", exit: "live-region" }
    ]);
    // 한 짝만 걸린 자리는 이 모집단 밖이다(관례는 둘 다이고, 반쪽은 여기서 세지 않는다 — 사각 ④).
    expect(moduleAnnounceSitesOf('<View accessibilityLiveRegion="polite">x</View>', "fixture")).toEqual([]);
    // 제네릭이 뒤따르는 JSX를 삼키지 않는다(스캐너가 끊기면 모집단이 조용히 비어 버린다).
    const withGeneric = `
const table: Record<string, { readonly a: string }> = {};
${card("useEffect(() => { announceForA11y(text); }, [text]);")}
`;
    expect(moduleAnnounceSitesOf(withGeneric, "fixture")).toEqual([
      { file: "fixture", component: "SaveErrorCard", exit: "announce" }
    ]);
  });

  it("ⓔ 위 두 스윕의 모집단 이동은 두 시점 기록과 함께만 있다 (오늘의 값이 여기 선다)", () => {
    // ⚠️ 두 시점(토스 리뷰 L): 종전 제목은 "모집단은 한 줄도 옮기지 않았다"였다 — 라운드 96
    // T6이 아래 6 → 3 개정을 두 시점 주석과 함께 넣으면서도 제목을 그대로 두어, 가드가 지키던
    // 문장이 거짓이 된 채 초록이었다. 모집단 이동은 금지가 아니라 **두 시점 기록 동반**이 규율이다.
    // 모집단을 옮기면 U절 이월과 라운드 80의 값이 함께 흔들린다 — 그래서 그 값들이 여기 선다.
    // ⚠️ 두 시점(라운드 96 T6): 쿼리 방아쇠 화면 6 → 3 — 설정 3화면의 조회 실패 자리가
    // LoadErrorCard로 옮겨 가 danger 색 바늘 밖으로 나갔다(QUERY_TRIGGER_SITES_BY_SCREEN 머리말).
    expect(Object.keys(QUERY_TRIGGER_SITES_BY_SCREEN).length, "쿼리 방아쇠 화면").toBe(3);
    expect(MUTATION_TRIGGER_SITES_BY_SCREEN["app/settings/privacy.tsx"], "개인정보 화면의 자리 수").toBe(7);
    expect(Object.keys(MUTATION_TRIGGER_SITES_BY_SCREEN)).not.toContain("app/(onboarding)/child-profile.tsx");
    expect(Object.keys(SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN), "대장 스윕의 제외").toEqual([]);
    expect(Object.keys(ALERT_ROLE_WITHOUT_LIVE_REGION), "role 단독의 제외").toEqual(["app/(tabs)/items.tsx"]);
    // 라운드 79의 기록도 그대로다 — 이 트랙이 더한 것은 프롭이 아니라 **낭독**이라, 그 값은 무접촉이다.
    expect(ROUND79_ANNOUNCE_PROPS_ADDED.length, "라운드 79의 기록").toBe(6);
    expect(
      ROUND79_ANNOUNCE_PROPS_ADDED.some((entry) => entry.file === "src/onboarding/step-ui.tsx"),
      "모듈 층의 그 한 자리는 라운드 79의 기록에 이미 있었다"
    ).toBe(true);
  });

  it("ⓕ 이 스윕의 사각이 값으로 적혀 있고, 그 가운데 하나는 실재가 값으로 확인된다 (AA-4)", () => {
    expect(MODULE_ANNOUNCE_SWEEP_BLIND_SPOTS.length, "적어 둔 사각").toBeGreaterThan(3);
    for (const blindSpot of MODULE_ANNOUNCE_SWEEP_BLIND_SPOTS) {
      expect(blindSpot.length, "사각은 빈 문자열일 수 없다").toBeGreaterThan(40);
    }
    // ⚠️ 사각 ④의 실재 — 프롭이 **한 짝만** 걸린 자리가 이 뿌리에 오늘도 있다(모집단 밖이다).
    const halfAnnounced = listModuleComponentSources()
      .map((file) => [file, halfAnnouncedTagCount(source(file))] as const)
      .filter(([, count]) => count > 0);
    expect(halfAnnounced.length, "한 짝만 걸린 자리가 실재한다").toBeGreaterThan(0);
    for (const [file, count] of halfAnnounced) {
      expect(
        moduleAnnounceSites().some((site) => site.file === file && site.exit === "live-region"),
        `${file}: 반쪽 자리는 이 모집단이 세지 않는다`
      ).toBe(false);
      expect(count, `${file}의 반쪽 자리`).toBeGreaterThan(0);
    }
  });
});

/* ============================================================================================ */
/* GAP-088 트랙 E(#5) — **프롭 대장 둘이 *한 일*과 *그것이 충분한가*를 함께 든다**                  */
/* ============================================================================================ */

/**
 * 두 대장을 **한 모집단**으로 든다 — 판정은 대장별이 아니라 **항목별**로 서고, 항목이 하나
 * 늘면(열째가 붙는 날) 그 항목도 이 질문을 **자동으로** 받는다. 이 트랙의 값이 정확히 그것이다.
 */
const ANNOUNCE_PROP_LEDGERS: ReadonlyArray<{
  readonly round: string;
  readonly entries: ReadonlyArray<{
    readonly file: string;
    readonly after: string;
    readonly what: string;
    readonly crossPlatform: string;
    /** 라운드 80의 기록에만 있는 칸 — 있으면 파생 자리 수가 **그 수와 같아야** 한다. */
    readonly places?: number;
  }>;
}> = [
  { round: "라운드 79", entries: ROUND79_ANNOUNCE_PROPS_ADDED },
  { round: "라운드 80", entries: ROUND80_ANNOUNCE_PROPS_ADDED }
];

/** 대장 항목마다 그 자리의 출구를 소스에서 파생한 결과 — 손 목록이 아니라 대장이 모집단이다. */
const announceLedgerVerdicts = () =>
  ANNOUNCE_PROP_LEDGERS.flatMap(({ round, entries }) =>
    entries.map((entry) => ({
      round,
      entry,
      /** 항목의 이름 — 라운드·파일·여는 태그(같은 파일의 두 항목이 갈린다). */
      key: `${round} ${entry.file} ${entry.after.split(" ")[0]}`,
      places: announceLedgerPlacesOf(source(entry.file), entry.after)
    }))
  );

/**
 * ⓑ의 규칙 한 줄 — **판정이 `live-region`을 부르면 이유가 값이어야 하고, 부르지 않으면 그
 * 칸은 비어 있어야 한다.** 뒤쪽 절반이 없으면 낡은 판정이 값으로 남아 다음 사람을 속인다.
 *
 * ⚠️ 묻는 것은 *"출구가 live-region 하나뿐인가"* 가 아니라 *"live-region이 **하나라도** 있는가"* 다.
 * 한 항목이 여러 자리를 덮을 때(대장 아홉 중 넷이 그렇다) 한 자리의 침묵이 형제 자리의 announce에
 * 가려지는 것 — 그것이 AB-4가 이름 붙인 그 착시이고, 이 트랙이 그 모양을 되풀이할 이유가 없다.
 */
const ledgerVerdictHolds = (places: ReadonlyArray<AnnounceLedgerPlace>, crossPlatform: string) =>
  places.some((place) => place.exit === "live-region") ? crossPlatform.trim().length > 0 : crossPlatform === "";

describe("GAP-088 #5 프롭 대장 둘의 파생 판정 (무엇이 되었는가 + 그것이 충분한가)", () => {
  it("ⓐ 대장 아홉 항목 전수 — 그 자리의 낭독 출구가 소스에서 파생한다", () => {
    // 전제 재실측(정찰의 아홉은 손으로 잰 하한이다): 오늘 대장 둘의 항목은 여섯 + 셋 = 아홉이다.
    expect(ROUND79_ANNOUNCE_PROPS_ADDED.length, "라운드 79의 기록").toBe(6);
    expect(ROUND80_ANNOUNCE_PROPS_ADDED.length, "라운드 80의 기록").toBe(3);
    const verdicts = announceLedgerVerdicts();
    expect(verdicts.length, "두 대장의 항목 합계").toBe(9);

    const exits: Record<string, number> = {};
    for (const verdict of verdicts) {
      // 유령 방지: 항목이 적은 그 바이트가 **소스에 실재한다**. 0건이면 아래 모든 판정이
      // 빈 모집단 위에서 영원히 초록이다(라운드 78 E가 이름 붙인 그 모양).
      expect(verdict.places.length, `${verdict.key}: 대장이 적은 자리`).toBeGreaterThan(0);
      for (const place of verdict.places) exits[place.exit] = (exits[place.exit] ?? 0) + 1;
    }
    // 오늘의 실측 — 아홉 항목이 덮는 자리는 스물둘이고, 그 가운데 **하나**가 프롭 조합뿐이다.
    // ⚠️ 라운드 88 트랙 E가 이 판정을 세울 때의 값은 `announce: 20 · live-region: 2`였다(정찰의
    // *"아홉이 전부 초록"* 은 그때도 거짓이었다). 라운드 89 트랙 A가 그 둘 중 하나 — 끝난 초대
    // 카드(`inviteUnavailable`) — 에 effect 층 낭독을 걸어 두 플랫폼으로 만들면서 이 수가
    // 하나씩 옮겨 갔다. **판정이 값을 만들고, 그 값이 다음 라운드의 고침이 됐다는 사실이
    // 여기 수로 남는다.** 남은 하나는 뒤처리 실패 카드이고, 그 자리가 조용한 이유는 프롭이
    // 반쪽이어서가 아니라 **이 그물이 effect 층만 세기 때문**이다(사각 넷째 · 그 항목의 이유 칸).
    expect(exits, "대장 아홉이 덮는 자리의 출구별 수").toEqual({ announce: 21, "live-region": 1 });
  });

  it("ⓑ 크로스플랫폼 — live-region이 하나라도 있으면 이유가 값이고, 없으면 그 칸은 비어 있다", () => {
    const verdicts = announceLedgerVerdicts();
    const androidOnly: string[] = [];
    for (const verdict of verdicts) {
      // 래칫 — 항목이 하나 늘면 판정 칸도 함께 요구된다(타입이 먼저 막지만, 값으로도 묻는다).
      expect(typeof verdict.entry.crossPlatform, `${verdict.key}: 판정 칸이 없다`).toBe("string");
      const silentPlaces = verdict.places.filter((place) => place.exit === "live-region");
      // 판정과 이유가 갈리면 여기가 빨개진다 — 양쪽 방향 다(빠진 이유 · 낡은 이유).
      expect(
        ledgerVerdictHolds(verdict.places, verdict.entry.crossPlatform),
        `${verdict.key}: 판정이 live-region ${silentPlaces.length}건인데 이유가 ${verdict.entry.crossPlatform === "" ? "비어 있다" : "낡았다"}`
      ).toBe(true);
      if (silentPlaces.length === 0) continue;
      androidOnly.push(verdict.key);
      // 이유는 산문이 아니라 **그 자리를 세우는 조건**을 이름으로 든다(빈 문자열 금지).
      expect(verdict.entry.crossPlatform.length, `${verdict.key}: 이유는 빈 문자열일 수 없다`).toBeGreaterThan(40);
      for (const place of silentPlaces) {
        if (!place.guard) continue;
        expect(verdict.entry.crossPlatform, `${verdict.key}: 조용한 자리의 조건이 이유에 없다`).toContain(place.guard);
      }
    }
    // 오늘의 실측 — 그런 항목은 하나다(정찰은 0을 약속하지 않았고, 실제로 0이 아니었다).
    expect(androidOnly, "판정이 live-region을 부르는 항목").toEqual([
      "라운드 79 app/family/accept/[token].tsx <View"
    ]);
    // 그 판정이 무엇을 뜻하는지는 이 파일이 이미 값으로 들고 있다(같은 근거를 두 벌 적지 않는다).
    expect(ANDROID_ONLY_LIVE_REGION_REASON, "프롭 조합만인 자리의 뜻").toContain("@platform android");
  });

  it("ⓒ 유령 방지 — `places` 수와 판정이 같은 모집단에서 나온다", () => {
    const verdicts = announceLedgerVerdicts();
    let total = 0;
    for (const verdict of verdicts) {
      total += verdict.places.length;
      // 라운드 80의 기록은 자리 수를 값으로 든다 — 파생이 그 수와 갈리면 둘 중 하나가 거짓이다.
      if (verdict.entry.places !== undefined) {
        expect(verdict.places.length, `${verdict.key}: 기록된 자리 수`).toBe(verdict.entry.places);
      }
      // 주석에만 있는 바이트는 자리가 아니다 — 마스킹 전후의 수가 같아야 한다(적어 둔 자리가
      // 실제로 그려지는 자리라는 사실이 여기서 선다).
      const raw = source(verdict.entry.file).split(verdict.entry.after).length - 1;
      expect(verdict.places.length, `${verdict.key}: 주석 밖의 자리 수`).toBe(raw);
      // 자리마다 좌표가 다르다(같은 자리를 두 번 세지 않는다).
      expect(new Set(verdict.places.map((place) => place.at)).size, `${verdict.key}: 자리의 좌표`).toBe(
        verdict.places.length
      );
    }
    expect(total, "대장 아홉이 덮는 자리 합계").toBe(22);
    expect(
      ROUND80_ANNOUNCE_PROPS_ADDED.reduce((sum, entry) => sum + entry.places, 0),
      "라운드 80이 기록한 자리 합계"
    ).toBe(12);
  });

  it("ⓓ 래칫 — 항목이 하나 늘면 판정 칸이 함께 요구된다 (픽스처로 재현)", () => {
    const screen = (guard: string, effect: string) => `
export default function Screen() {
  ${effect}
  return (
    <View>
      {${guard} ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {failText}
        </Text>
      ) : null}
    </View>
  );
}
`;
    const after = '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>';
    const wired = "useEffect(() => { if (save.isError) announceForA11y(failText); }, [save.isError, failText]);";

    // 프롭만이면 안드로이드 한정이다 — 그리고 그 항목은 이유 없이는 통과하지 못한다.
    const bare = announceLedgerPlacesOf(screen("save.isError", ""), after);
    expect(bare.map((place) => place.exit), "프롭만 걸린 자리").toEqual(["live-region"]);
    expect(ledgerVerdictHolds(bare, ""), "이유 없는 열째 항목").toBe(false);
    expect(ledgerVerdictHolds(bare, "실기기에서 확인한 사실과 그 자리가 남은 이유가 여기 값으로 선다."), "이유가 값인 열째 항목").toBe(true);

    // 같은 조건에 묶인 낭독이 서면 두 플랫폼 다이고, 그때는 이유 칸이 비어 있어야 한다.
    const both = announceLedgerPlacesOf(screen("save.isError", wired), after);
    expect(both.map((place) => place.exit), "프롭 + 같은 조건의 낭독").toEqual(["announce"]);
    expect(ledgerVerdictHolds(both, ""), "판정이 부르지 않는 이유 칸").toBe(true);
    expect(ledgerVerdictHolds(both, "낡은 이유"), "고쳐진 뒤에도 남은 이유").toBe(false);

    // ⚠️ AB-4의 착시 그 자체 — 낭독이 **다른 조건**에 묶여 있으면 이 자리는 여전히 침묵이다
    // (파일에 announceForA11y가 있다는 사실만으로 세면 여기가 초록이 된다).
    const otherGuard = announceLedgerPlacesOf(
      screen("save.isError", "useEffect(() => { if (other.isError) announceForA11y(otherText); }, [other.isError]);"),
      after
    );
    expect(otherGuard.map((place) => place.exit), "다른 조건에 묶인 낭독").toEqual(["live-region"]);

    // 조건이 없는 자리(컴포넌트가 곧 조건인 모듈 카드)는 **같은 컴포넌트 안의** 조건 없는 배선이 답한다.
    const card = (effect: string) => `
export function SaveErrorCard({ error }) {
  const text = saveErrorMessage(error);
  ${effect}
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text>{text}</Text>
    </View>
  );
}
`;
    const viewAfter = '<View accessibilityLiveRegion="polite" accessibilityRole="alert">';
    expect(announceLedgerPlacesOf(card(""), viewAfter).map((place) => place.exit)).toEqual(["live-region"]);
    expect(
      announceLedgerPlacesOf(card("useEffect(() => { announceForA11y(text); }, [text]);"), viewAfter).map(
        (place) => place.exit
      )
    ).toEqual(["announce"]);
    // 낭독이 **다른 컴포넌트**에 있으면 이 자리는 여전히 안드로이드 한정이다(파일 단위로 세지 않는다).
    const elsewhere = `
export function Elsewhere({ notice }) {
  useEffect(() => { announceForA11y(notice); }, [notice]);
  return <Text>{notice}</Text>;
}
${card("")}
`;
    expect(announceLedgerPlacesOf(elsewhere, viewAfter).map((place) => place.exit)).toEqual(["live-region"]);

    // Toast는 자기 컴포넌트가 프롭과 announce를 함께 진다 — 세 번째 칸이 그 자리를 위해 있다.
    expect(
      announceLedgerPlacesOf('<View>{save.isError ? <Toast message={failText} tone="error" /> : null}</View>', "<Toast ")
        .map((place) => place.exit)
    ).toEqual(["toast"]);
  });

  it("ⓔ 이 판정의 사각이 값으로 적혀 있고, 그 가운데 둘은 실재가 값으로 확인된다 (AB-4·AA-4)", () => {
    expect(ANNOUNCE_LEDGER_VERDICT_BLIND_SPOTS.length, "적어 둔 사각").toBeGreaterThan(3);
    for (const blindSpot of ANNOUNCE_LEDGER_VERDICT_BLIND_SPOTS) {
      expect(blindSpot.length, "사각은 빈 문자열일 수 없다").toBeGreaterThan(40);
    }

    // 사각 ② — 프롭이 **한 짝만** 걸린 자리는 대장의 `after` 바이트에 걸리지 않는다.
    const half = '<Text accessibilityLiveRegion="polite" style={{ color: theme.colors.danger }}>{failText}</Text>';
    expect(
      announceLedgerPlacesOf(
        half,
        '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>'
      ),
      "반쪽 자리는 이 모집단 밖이다"
    ).toEqual([]);

    // 사각 ③ — 대장 아홉은 전부 `.tsx`다(그 밖의 자리는 이 그물이 볼 수 없다).
    for (const { entries } of ANNOUNCE_PROP_LEDGERS) {
      for (const entry of entries) expect(entry.file.endsWith(".tsx"), `${entry.file}: 대장의 자리`).toBe(true);
    }

    // 사각 ④의 실재 — 핸들러가 상태를 세우며 같은 걸음에 부르는 낭독이 **오늘 하나** 있다.
    // 그 자리는 두 플랫폼 다 소리가 나지만 이 그물은 `live-region`으로 센다(그래서 그 사실이
    // 그 항목의 이유에 값으로 적혀 있다 — 판정이 조용히 과대평가되지 않게).
    const acceptMasked = maskComments(source("app/family/accept/[token].tsx"));
    expect(acceptMasked, "핸들러의 상태 세우기").toContain("setJoinRetryNotice(plan.notice);");
    expect(acceptMasked, "그 바로 다음 줄의 낭독").toContain("announceForA11y(plan.notice);");
    expect(
      announceEffectWirings(acceptMasked).map((wiring) => wiring.condition),
      "effect 층의 낭독 조건"
    ).not.toContain("joinRetryNotice && joinedResult");

    // 사각 ⑥(라운드 88 리뷰 L-1)의 실재 — 조건을 **글자로만** 본다. 뜻이 같아도 표기가 갈리면
    // 배선이 실재해도 `live-region`으로 떨어진다(⚠️ **거짓 빨강** — 침묵을 announce로 세는
    // 반대 방향의 오차가 아니다. 그래서 판정 로직은 오늘 그대로 두고 사각으로만 든다).
    const spelledDifferently = `
export default function Screen() {
  useEffect(() => { if (save.isError === true) announceForA11y(failText); }, [save.isError, failText]);
  return (
    <View>
      {save.isError ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {failText}
        </Text>
      ) : null}
    </View>
  );
}
`;
    expect(
      announceLedgerPlacesOf(
        spelledDifferently,
        '<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>'
      ).map((place) => place.exit),
      "표기가 갈리면 배선이 있어도 live-region이다 — 이유를 요구하는 쪽으로 틀린다"
    ).toEqual(["live-region"]);
    // 그리고 오늘 저장소에서 이 한계가 낸 피해는 0건이다: 감싸는 갈래가 둘인 자리 여덟은
    // 전부 최내곽 갈래가 배선 조건과 맞아 announce로 떨어졌다(사각 문장이 적은 그 수).
    const guardDepths = ANNOUNCE_PROP_LEDGERS.flatMap(({ entries }) =>
      entries.flatMap((entry) => {
        const masked = maskComments(source(entry.file));
        const depths: number[] = [];
        for (let at = masked.indexOf(entry.after); at >= 0; at = masked.indexOf(entry.after, at + 1)) {
          depths.push(enclosingJsxGuards(masked, at).length);
        }
        return depths;
      })
    );
    const verdicts = announceLedgerVerdicts().flatMap(({ places }) => places.map((place) => place.exit));
    expect(guardDepths.length, "대장이 덮는 자리").toBe(verdicts.length);
    // ⚠️ 라운드 89 리뷰(M-1) — **사각 문장의 갈래 분포를 손 숫자로 두지 않는다.** 라운드 88이
    // 적어 둔 *"하나 열셋 · 둘 여덟"* 은 그 시점(cedaba4)에도 실측과 달랐고, 사람이 그 문장을
    // 다시 읽으며 날짜만 새로 적는 것으로는 그 어긋남이 드러나지 않았다. 그래서 분포 자체를
    // **파생값으로 못 박는다** — 다음에 자리가 늘거나 갈래가 겹치면 문장을 고치기 전에 여기가
    // 먼저 빨개진다(위 live-region 교차 검사와는 묻는 것이 다르다: 저쪽은 *"중첩이 피해를
    // 냈는가"*, 이쪽은 *"분포가 문장과 같은가"*).
    expect(
      guardDepths.reduce<Record<number, number>>(
        (acc, depth) => ({ ...acc, [depth]: (acc[depth] ?? 0) + 1 }),
        {}
      ),
      "감싸는 갈래 깊이별 자리 수 — 사각 문장이 적는 그 분포"
    ).toEqual({ 0: 1, 1: 14, 2: 7 });
    expect(
      guardDepths.filter((depth, index) => depth > 1 && verdicts[index] === "live-region"),
      "중첩 갈래 때문에 live-region으로 떨어진 자리는 오늘 0건이다"
    ).toEqual([]);

    // 사각 ① — 이 판정은 화면 층·모듈 층 스윕 셋을 대신하지 않는다(모집단이 다르다는 사실이 수로 선다).
    const ledgerFiles = new Set(ANNOUNCE_PROP_LEDGERS.flatMap(({ entries }) => entries.map((entry) => entry.file)));
    expect(ledgerFiles.size, "대장이 여는 파일").toBe(8);
    expect(listRouteSources().length, "방아쇠 스윕이 걷는 화면").toBeGreaterThan(ledgerFiles.size);
    expect(listModuleComponentSources().length, "모듈 스윕이 걷는 모듈").toBeGreaterThan(ledgerFiles.size);
    expect(OFFLINE_AWARE_SAVE_ERROR_SCREENS.length, "대장 스윕이 걷는 화면").toBeGreaterThan(0);
  });

  it("ⓕ 바이트 불변 — 라운드 79·80의 기록과 앞선 스윕들의 모집단은 한 바이트도 움직이지 않았다", () => {
    // 더한 것은 칸 하나다 — 기록(파일·before·after·added·places)은 그대로다.
    expect(
      ROUND79_ANNOUNCE_PROPS_ADDED.map((entry) => entry.file),
      "라운드 79가 연 자리"
    ).toEqual([
      "app/family/accept/[token].tsx",
      "app/family/accept/[token].tsx",
      "app/family/invite.tsx",
      "app/settings/children.tsx",
      "app/settings/notifications.tsx",
      "src/onboarding/step-ui.tsx"
    ]);
    expect(ROUND80_ANNOUNCE_PROPS_ADDED.map((entry) => entry.places), "라운드 80이 기록한 자리 수").toEqual([7, 2, 3]);
    for (const { entries } of ANNOUNCE_PROP_LEDGERS) {
      for (const entry of entries) {
        // 기록의 `after`는 오늘도 그 파일의 바이트다(위 두 스윕의 ⓓ·ⓕ와 같은 사실 — 여기서는
        // **판정이 그 바이트 위에서 돈다**는 사실이 함께 선다).
        expect(source(entry.file), `${entry.file}: ${entry.what}`).toContain(entry.after);
      }
    }

    // 모집단 이동은 두 시점 기록과 함께만 있다(토스 리뷰 L: 종전 문장 "한 줄도 옮기지
    // 않았다"는 아래 6 → 3 개정으로 이미 거짓이었다) — 옮기면 U절 이월과 라운드 80·87의
    // 값이 함께 흔들리므로 오늘의 값이 여기 선다.
    // ⚠️ 두 시점(라운드 96 T6): 쿼리 방아쇠 화면 6 → 3(설정 3화면의 조회 실패 자리가
    // LoadErrorCard로 옮겨 갔다 — QUERY_TRIGGER_SITES_BY_SCREEN 머리말).
    expect(Object.keys(QUERY_TRIGGER_SITES_BY_SCREEN).length, "쿼리 방아쇠 화면").toBe(3);
    expect(Object.keys(MUTATION_TRIGGER_SITES_BY_SCREEN).length, "뮤테이션 방아쇠 화면").toBe(13);
    expect(MUTATION_TRIGGER_SITES_BY_SCREEN["app/settings/privacy.tsx"], "개인정보 화면의 자리 수").toBe(7);
    expect(Object.keys(SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN), "대장 스윕의 제외").toEqual([]);
    expect(Object.keys(ALERT_ROLE_WITHOUT_LIVE_REGION), "role 단독의 제외").toEqual(["app/(tabs)/items.tsx"]);
    expect([...MODULE_ANNOUNCE_SOURCE_ROOTS], "모듈 스윕이 걷는 뿌리").toEqual(["src"]);
    expect(Object.keys(NON_MODULE_ANNOUNCE_SOURCE_ROOTS), "걷지 않는 뿌리").toEqual(["app"]);
    expect(Object.keys(MODULE_ANNOUNCE_SITES).length, "모듈 층의 낭독 자리").toBe(3);
  });
});

/* ============================================================================================ */
/* GAP-090 트랙 A(#1) — **낭독 프롭이 반쪽만 걸린 자리 전수와, 자리마다의 판정 하나**              */
/* ============================================================================================ */

/**
 * ## 사각이 이름으로 지목한 자리를 그 그물이 스스로 모집단으로 삼는다
 *
 * 라운드 87 트랙 C가 모듈 층 스윕을 세우면서 사각 넷째를 이렇게 적었다: *"프롭이 한 짝만 걸린
 * 자리는 이 모집단 밖이다 — role 단독은 GAP-079 ⓑ가 app·src 전수로 세지만, **live region
 * 단독은 어느 스윕도 세지 않는다**."* 그 문장은 정확했고, 라운드 90 정찰이 그 이름을 따라가
 * 자리를 세어 보니 **여섯**이었으며 그중 **둘이 오늘 사람이 겪는 침묵**이었다.
 *
 * ⚠️ `accessibilityLiveRegion`은 RN 문서가 `@platform android`로 표시한 프롭이고, 그 짝인
 * `accessibilityRole="alert"`에도 iOS/VoiceOver에 대응하는 트레이트가 없다(위
 * `ANDROID_ONLY_LIVE_REGION_REASON`). 그래서 **live region만** 걸린 자리는 안드로이드에서만
 * 소리가 나고, iOS에서는 화면에 문장이 서도 *아무 일도 일어나지 않은 것*처럼 들린다.
 *
 * ⚠️⚠️ **그런데 여섯 전부가 결함인 것은 아니다 — 그리고 그 사실이 이 스윕의 값 절반이다.**
 * 반쪽이라는 **모양**만 보면 여섯이 전부 결함으로 세어지지만, 실제로 답이 갈리는 것은
 * *effect 배선*과 *제품 화면 도달*까지 봤을 때다. 그래서 이 스윕은 자리를 세는 데서 멈추지 않고
 * **자리마다 셋 중 하나**를 소스에서 파생한다.
 *
 *  · `wired` — **배선을 건다.** 그 자리를 세우는 최내곽 JSX 갈래와 **글자로 같은 조건**의
 *    `announceForA11y` 배선이 effect 층에 있다(갈래가 없는 자리는 *같은 최상위 컴포넌트 안의
 *    조건 없는 배선*이 답한다 — `announceLedgerPlacesOf`가 쓰는 그 규칙 그대로다).
 *  · `already-cross-platform` — **이미 두 플랫폼이다.** 그 자리를 세우는 갈래가 상태 하나이고,
 *    그 상태를 세우는 **모든 걸음**이 같은 블록에서 같은 값을 `announceForA11y`로 읽는다
 *    (핸들러 층의 낭독이라 effect만 세는 그물에는 잡히지 않는다 — 그물의 한계이지 결함이 아니다).
 *  · `unreachable` — **제품 화면 도달 0건이다.** design-system 안에 살고, 그 컴포넌트를 이름으로
 *    들여오거나 다시 내보내는 제품 소스가 0건이며, 배럴을 거친 **간접 경로**도 열려 있지 않다.
 *
 * ⚠️ 넷째 칸 `silent`는 **비어 있어야 한다** — 셋 중 어디에도 들지 않는 자리는 오늘 처음 생긴
 * 침묵이고, 그 자리가 조용히 서지 않게 하는 것이 이 스윕이 존재하는 이유다.
 */
type HalfAnnouncedSite = {
  readonly file: string;
  /** 걸려 있는 **그 한 짝**. */
  readonly prop: (typeof ANNOUNCED_ALERT_PROPS)[number];
  /** 그 자리를 그리는 **최상위 함수 컴포넌트**의 이름. */
  readonly component: string;
  /** 그 자리를 감싸는 **최내곽 JSX 갈래**(없으면 빈 문자열 — 컴포넌트가 곧 조건이다). */
  readonly guard: string;
  readonly at: number;
};

type HalfAnnouncedVerdict = "wired" | "already-cross-platform" | "unreachable" | "silent";

/** 한 소스에서 낭독 프롭이 **한 짝만** 걸린 여는 태그를 전부 찾는다(모집단은 손 목록이 아니다). */
function halfAnnouncedSitesOf(sourceText: string, file: string): HalfAnnouncedSite[] {
  const masked = maskComments(sourceText);
  const blocks = topLevelFunctionBlocksOf(masked);
  const sites: HalfAnnouncedSite[] = [];
  const pattern = /<[A-Z][A-Za-z0-9_.]*/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const end = openingTagEnd(masked, found.index);
    if (end < 0) continue;
    const openTag = masked.slice(found.index, end + 1);
    // 제네릭(`Record<string, …>`)이 뒤따르는 JSX를 삼키지 않는다 — 여는 태그 안에 `<`는 없다.
    if (openTag.slice(1).includes("<")) continue;
    const present = ANNOUNCED_ALERT_PROPS.filter((prop) => openTag.includes(prop));
    if (present.length !== 1) continue;
    const at = found.index;
    const block = blocks.find((candidate) => at >= candidate.start && at < candidate.end);
    sites.push({
      file,
      prop: present[0],
      component: block?.name ?? "",
      guard: enclosingJsxGuards(masked, at)[0]?.guard ?? "",
      at
    });
  }
  return sites;
}

const halfAnnouncedSites = () => listComponentSources().flatMap((file) => halfAnnouncedSitesOf(source(file), file));

const halfAnnouncedKey = (site: HalfAnnouncedSite) => `${site.file} ${site.component}`;

/** 그 자리를 둘러싼 **중괄호 블록** 한 겹(핸들러 층의 낭독을 그 걸음 안에서 찾는 데 쓴다). */
function enclosingBraceBlockOf(masked: string, at: number): { readonly start: number; readonly end: number } | null {
  let depth = 0;
  for (let i = at; i >= 0; i -= 1) {
    const char = masked[i];
    if (char === "}") depth += 1;
    else if (char === "{") {
      if (depth === 0) {
        const end = matchingCloserOf(masked, i);
        return end < 0 ? null : { start: i, end: end + 1 };
      }
      depth -= 1;
    }
  }
  return null;
}

/**
 * 자리를 세우는 갈래가 상태 하나일 때, **그 상태를 세우는 걸음이 곧 낭독인가.**
 *
 * `setX(v)`가 도는 **모든** 자리에서 같은 블록이 `announceForA11y(v)`를 함께 부르면, 그 자리는
 * effect 층에 배선이 없어도 두 플랫폼 다 소리가 난다. 비우는 걸음(`null`/`undefined`)은 읽을
 * 문장이 없으므로 모집단이 아니다. ⚠️ **하나라도 낭독 없이 세우면 거짓**이다 — 판정이
 * *"대체로 읽는다"* 가 되면 그 자리는 세어진 척한 자리가 된다.
 */
function stateSetterAnnouncesIn(masked: string, stateName: string): boolean {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(stateName)) return false;
  const setter = `set${stateName[0].toUpperCase()}${stateName.slice(1)}`;
  const settings = callRangesOf(masked, setter)
    .map(([open, close]) => ({ open, argument: masked.slice(open + 1, close).trim() }))
    .filter(({ argument }) => argument.length > 0 && argument !== "null" && argument !== "undefined");
  if (settings.length === 0) return false;
  return settings.every(({ open, argument }) => {
    const block = enclosingBraceBlockOf(masked, open);
    return block !== null && masked.slice(block.start, block.end).includes(`announceForA11y(${argument})`);
  });
}

/* -------------------------------------------------------------------------------------------- */
/* 도달 판정 — ⚠️ **별칭 경로 하나로 뒤집히는 판정이라 import 그래프를 실제로 걷는다**             */
/* -------------------------------------------------------------------------------------------- */

const DESIGN_SYSTEM_ROOT = "src/design-system/";

/**
 * design-system **밖**의 비테스트 소스 전수 — `.tsx`뿐 아니라 `.ts`도 함께 건다.
 *
 * ⚠️ 배럴은 `.ts`에 산다. `.tsx`만 걸으면 *"제품이 이 이름을 다시 내보낸다"* 는 길이 통째로
 * 보이지 않고, 도달 0건이 **보지 않아서 0**이 된다.
 */
let nonDesignSystemSourceCache: string[] | null = null;
function listNonDesignSystemSources(): string[] {
  if (nonDesignSystemSourceCache) return nonDesignSystemSourceCache;
  nonDesignSystemSourceCache = ["app", "src"]
    .flatMap((root) =>
      readdirSync(join(mobileRoot, root), { recursive: true, encoding: "utf8" })
        .filter((entry) => /(?<!\.d)\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
        .map((entry) => join(root, entry))
    )
    .filter((path) => !path.startsWith(DESIGN_SYSTEM_ROOT));
  return nonDesignSystemSourceCache;
}

/** 한 소스가 design-system에서 **이름으로 들여오거나 다시 내보내는** 것들. */
function designSystemNamesTakenBy(sourceText: string): string[] {
  const masked = maskComments(sourceText);
  return [...masked.matchAll(/(?:import|export)\s*(?:type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)]
    .filter((match) => match[2].includes("design-system"))
    .flatMap((match) =>
      match[1]
        .split(",")
        .map((name) => name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim())
        .filter((name) => name.length > 0)
    );
}

/** 그 컴포넌트를 제품 소스가 **직접** 부르는 파일 전수. */
function designSystemDirectConsumers(component: string): string[] {
  return listNonDesignSystemSources().filter((file) => designSystemNamesTakenBy(source(file)).includes(component));
}

/** design-system **안에서** 그 컴포넌트를 그리는 형제 컴포넌트들 — 간접 경로의 첫 칸. */
function designSystemRenderersOf(component: string): Array<{ readonly renderer: string; readonly body: string }> {
  const edges: Array<{ readonly renderer: string; readonly body: string }> = [];
  for (const file of listComponentSources().filter((path) => path.startsWith(DESIGN_SYSTEM_ROOT))) {
    const masked = maskComments(source(file));
    for (const block of topLevelFunctionBlocksOf(masked)) {
      if (block.name === component) continue;
      const body = masked.slice(block.start, block.end);
      if (new RegExp(`<${component}(?![A-Za-z0-9_])`).test(body)) edges.push({ renderer: block.name, body });
    }
  }
  return edges;
}

/** 한 여는 태그가 실은 그 프롭의 **문자열 리터럴**(리터럴이 아니면 `null` — 모르는 것은 열린 것이다). */
function jsxPropLiteralsOf(sourceText: string, tagName: string, prop: string): Array<string | null> {
  const masked = maskComments(sourceText);
  const literals: Array<string | null> = [];
  const pattern = new RegExp(`<${tagName}(?![A-Za-z0-9_])`, "g");
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const end = openingTagEnd(masked, found.index);
    if (end < 0) continue;
    const openTag = sourceText.slice(found.index, end + 1);
    const literal = new RegExp(`(?<![A-Za-z0-9_])${prop}="([^"]*)"`).exec(openTag);
    literals.push(literal ? literal[1] : null);
  }
  return literals;
}

/**
 * 간접 경로 하나가 **열려 있는가.**
 *
 * 형제가 그 자리를 그리는 갈래에 정규식 문지기(`if (/…/.test(prop)) return <C …>`)가 서 있으면,
 * 그 형제를 부르는 제품 자리가 넘기는 리터럴 가운데 **문을 여는 것이 있는지**를 본다. 문지기가
 * 없거나, 넘기는 값이 리터럴이 아니거나, 볼 자리가 없으면 **열린 것으로 센다** — 오차의 방향은
 * 거짓 빨강(안전)이다: 모르는 것을 *도달 0건*이라고 말하지 않는다.
 */
function indirectEdgeOpen(component: string, edge: { readonly renderer: string; readonly body: string }): boolean {
  const gate = new RegExp(
    `if\\s*\\((/[^\\n/]+/)\\.test\\(([A-Za-z0-9_$]+)\\)\\)\\s*return\\s*<${component}(?![A-Za-z0-9_])`
  ).exec(edge.body);
  if (!gate) return true;
  const matcher = new RegExp(gate[1].slice(1, -1));
  const consumers = designSystemDirectConsumers(edge.renderer);
  if (consumers.length === 0) return true;
  return consumers.some((consumer) =>
    jsxPropLiteralsOf(source(consumer), edge.renderer, gate[2]).some(
      (literal) => literal === null || matcher.test(literal)
    )
  );
}

/** 그 design-system 컴포넌트가 제품 화면에 **닿는가** — 직접이든, 열린 간접 경로를 거쳐서든. */
function designSystemComponentReached(component: string, seen: Set<string> = new Set()): boolean {
  if (component.length === 0 || seen.has(component)) return false;
  seen.add(component);
  if (designSystemDirectConsumers(component).length > 0) return true;
  return designSystemRenderersOf(component).some(
    (edge) => indirectEdgeOpen(component, edge) && designSystemComponentReached(edge.renderer, seen)
  );
}

/** 자리 하나의 판정 — **손으로 적지 않고 소스에서 파생한다**(표식만 복사하는 것은 막힌다). */
function halfAnnouncedVerdictOf(site: HalfAnnouncedSite): HalfAnnouncedVerdict {
  const masked = maskComments(source(site.file));
  const block = topLevelFunctionBlocksOf(masked).find(
    (candidate) => site.at >= candidate.start && site.at < candidate.end
  );
  const wirings = announceEffectWirings(masked);
  const wired = site.guard
    ? wirings.some((wiring) => wiring.condition === site.guard)
    : Boolean(block) &&
      wirings.some((wiring) => wiring.condition === "" && wiring.at >= block!.start && wiring.at < block!.end);
  if (wired) return "wired";
  if (site.guard && stateSetterAnnouncesIn(masked, site.guard)) return "already-cross-platform";
  if (site.file.startsWith(DESIGN_SYSTEM_ROOT) && !designSystemComponentReached(site.component)) return "unreachable";
  return "silent";
}

/**
 * ⚠️ **오늘의 실측 — 반쪽 자리 전수와 그 자리가 무엇인가.**
 *
 * 유령 방지의 본체다: 이 표가 비면 아래 부정 단언(*"silent 0건"*)은 **빈 모집단 위에서 영원히
 * 초록**이다. 각 줄의 이유는 빈 문자열일 수 없고, **판정은 여기 적지 않는다** — 판정은 위
 * 파생이 내고, 이 표가 드는 것은 *그 자리가 무엇인가*뿐이다(표식만 복사하면 파생이 막힌다).
 */
const HALF_ANNOUNCED_SITES: Readonly<Record<string, string>> = {
  "app/index.tsx ColdStartHoldView":
    "콜드 스타트 홀딩 카드의 두 줄(C-09). 저장소조차 아직 못 읽은 시점이라 소리로 남는 것이 이 두 줄뿐이고(스켈레톤은 접근성 트리에서 감춘다), 최악 6초 동안 iOS에서는 아무 일도 일어나지 않은 것처럼 들렸다 — 라운드 90 트랙 A가 여는 두 자리 중 하나.",
  "app/settings/app-lock.tsx AppLockSettingsScreen":
    "앱 잠금 설정의 완료 문장(`done`). 모양만 보면 반쪽이지만 그 문장을 세우는 `succeed()`가 같은 걸음에 announceForA11y를 부르므로 종전부터 두 플랫폼이다 — 결함이 아니라 **판정의 근거**이고, 프롭도 배선도 건드리지 않는다.",
  "app/(tabs)/items.tsx ItemsScreen":
    "준비템 100% 축하 배너 — 이 여섯과 성질이 다른 **role 단독**의 유일한 자리다. 실패 문장이 아니고 자동으로 끼어들어 읽어야 할 사실도 아니라서(DNC-018) 이유가 ALERT_ROLE_WITHOUT_LIVE_REGION에 값으로 서 있다.",
  "src/design-system/components/ApplicationPrimitives.tsx Toast":
    "이식된 design-system의 Toast. 화면들이 쓰는 Toast는 src/ui.tsx의 것이고(그쪽은 프롭 쌍과 announce를 스스로 진다), 이 이름을 들여오거나 다시 내보내는 제품 소스는 0건이다.",
  "src/design-system/components/ModV1Primitives.tsx MoneyField":
    "이식된 금액 입력의 오류 줄. 배럴이 이름을 내보내지만 그 이름을 받는 제품 소스가 0건이라 이 오류 줄은 오늘 어느 화면에도 서지 않는다.",
  "src/design-system/patterns/AsyncState.tsx LoadingState":
    "이식된 로딩 상태 카드. 직접 소비자는 0건이고, 배럴을 거친 간접 경로 하나(EmptyStateCard)가 실재하지만 그 갈래는 제목 정규식이 닫는다 — 아래 ⓖ가 그 경로와 문지기를 값으로 든다.",
  "src/preparation/PreparationListParity.tsx PreparationListParity":
    "준비템 탭의 검색 결과 개수 줄(`‘…’ 검색 결과 N개`). 핵심 루프 안이고, 검색을 제출한 사람이 iOS에서는 몇 개가 남았는지 듣지 못했다 — 라운드 90 트랙 A가 여는 두 자리 중 하나."
};

/**
 * ⚠️ **이 스윕이 못 보는 것 — 태어날 때부터 값으로 적는다(AA-4의 규율).**
 *
 * 사각 칸이 이름으로 지목한 자리를 고치러 온 트랙이 자기 사각을 적지 않으면, 그 트랙은 자기가
 * 고친 모양을 한 겹 위에서 다시 만드는 것이다.
 */
const HALF_ANNOUNCED_SWEEP_BLIND_SPOTS: ReadonlyArray<string> = [
  "모집단은 **낭독 프롭이 이미 반쪽으로 걸린 자리**다 — 프롭 없이 문장을 그리는 자리는 이 그물에 아예 들어오지 않는다(그 축은 화면 층의 GAP-079·080과 모듈 층의 GAP-087이 각자의 모집단으로 센다).",
  "판정 `wired`는 **effect 층의 배선**만 센다 — 갈래와 글자가 같은 조건이어야 하고, 같은 뜻을 다르게 적은 조건은 배선이 실재해도 세어지지 않는다(라운드 88 리뷰 L-1의 그 사각을 그대로 물려받는다 · 오차의 방향은 거짓 빨강이다).",
  "판정 `already-cross-platform`은 **갈래가 상태 하나인 모양**까지만 본다 — 갈래가 식이거나 낭독이 다른 이름을 거쳐 나가면 이 칸이 답하지 못하고 그 자리는 `silent`로 떨어진다(그때 답하는 것은 사람이다).",
  "판정 `unreachable`은 **이름으로 들여오는 길**을 걷는다 — `import *` 네임스페이스 접근이나 문자열로 만든 동적 import는 보지 않는다(오늘 이 저장소에 그 모양은 없지만, 생기는 날 이 그물은 그것을 도달로 세지 못한다).",
  "소스 대조이지 런타임이 아니다 — VoiceOver가 실제로 그 문장을 읽는지, 안드로이드에서 라이브 리전과 새 배선이 겹쳐 두 번 들리는지는 실기기 확인의 몫이다(라운드 89 리뷰 L-3의 그 물음이 이 두 자리에서 다시 선다)."
];

describe("GAP-090 #1 반쪽 프롭 스윕 (사각이 이름으로 지목한 자리를 모집단으로)", () => {
  it("ⓐ 모집단 — app·src 전수에서 반쪽 자리를 파생하고, 손 목록이 아니라 전수가 그 수를 정한다", () => {
    const files = listComponentSources();
    // 유령 방지 ①: 스캔이 실제로 걸린다(끊기면 아래 부정 단언이 영원히 초록이다).
    expect(files.length, "app·src의 컴포넌트 소스 전수").toBeGreaterThan(20);

    const sites = halfAnnouncedSites();
    // 유령 방지 ②: **모집단이 0건이 아니다.** 이 줄이 이 스윕의 값 절반이다.
    expect(sites.length, "반쪽 프롭 자리").toBeGreaterThan(0);
    expect(sites.map(halfAnnouncedKey).sort(), "반쪽 자리 전수").toEqual(Object.keys(HALF_ANNOUNCED_SITES).sort());
    for (const [key, why] of Object.entries(HALF_ANNOUNCED_SITES)) {
      expect(why.length, `${key}가 서 있는 이유`).toBeGreaterThan(40);
    }

    // 짝 프롭이 걸린 자리(37)는 이 모집단이 아니다 — 반쪽만 센다.
    const byProp: Record<string, number> = {};
    for (const site of sites) byProp[site.prop] = (byProp[site.prop] ?? 0) + 1;
    expect(byProp, "짝별 반쪽 자리 수").toEqual({
      'accessibilityLiveRegion="polite"': 6,
      'accessibilityRole="alert"': 1
    });
    // role 단독 하나는 종전 대장이 이유를 지고 있다 — 이 스윕은 그 대장을 대신하지 않는다.
    const roleOnly = sites.filter((site) => site.prop === ANNOUNCED_ALERT_PROPS[0]);
    expect(roleOnly.map((site) => site.file), "role 단독의 자리").toEqual(Object.keys(ALERT_ROLE_WITHOUT_LIVE_REGION));
    expect(roleOnly.length, "role 단독의 자리 수").toBe(
      ALERT_ROLE_WITHOUT_LIVE_REGION["app/(tabs)/items.tsx"].places
    );
  });

  it("ⓑ 판정 셋 — 자리마다 하나가 소스에서 나오고, `silent`는 0건이다", () => {
    const sites = halfAnnouncedSites().filter((site) => site.prop === ANNOUNCED_ALERT_PROPS[1]);
    expect(sites.length, "live region 단독의 자리").toBe(6);

    const verdicts = sites.map((site) => ({ key: halfAnnouncedKey(site), verdict: halfAnnouncedVerdictOf(site) }));
    // ⚠️ 셋 중 어디에도 들지 않는 자리는 오늘 처음 생긴 침묵이다 — 그 자리를 이름으로 보여 준다.
    expect(
      verdicts.filter((entry) => entry.verdict === "silent").map((entry) => entry.key),
      "판정 셋 어디에도 들지 않는 자리"
    ).toEqual([]);

    const counts: Record<string, number> = {};
    for (const { verdict } of verdicts) counts[verdict] = (counts[verdict] ?? 0) + 1;
    expect(counts, "판정별 자리 수").toEqual({ wired: 2, "already-cross-platform": 1, unreachable: 3 });
    expect(
      verdicts.filter((entry) => entry.verdict === "wired").map((entry) => entry.key).sort(),
      "배선을 건 두 자리"
    ).toEqual(["app/index.tsx ColdStartHoldView", "src/preparation/PreparationListParity.tsx PreparationListParity"]);
    expect(
      verdicts.filter((entry) => entry.verdict === "already-cross-platform").map((entry) => entry.key),
      "이미 크로스플랫폼인 자리"
    ).toEqual(["app/settings/app-lock.tsx AppLockSettingsScreen"]);
    expect(
      verdicts.filter((entry) => entry.verdict === "unreachable").map((entry) => entry.key).sort(),
      "제품 화면 도달 0건인 자리"
    ).toEqual([
      "src/design-system/components/ApplicationPrimitives.tsx Toast",
      "src/design-system/components/ModV1Primitives.tsx MoneyField",
      "src/design-system/patterns/AsyncState.tsx LoadingState"
    ]);
  });

  it("ⓒ 낭독 — 배선 둘의 `if` 조건이 그 문장을 세우는 최내곽 JSX 갈래와 글자로 같다", () => {
    for (const [file, expectedGuard] of [
      ["src/preparation/PreparationListParity.tsx", "activeSearchQuery"],
      ["app/index.tsx", ""]
    ] as const) {
      const masked = maskComments(source(file));
      const site = halfAnnouncedSitesOf(source(file), file).find((entry) => entry.prop === ANNOUNCED_ALERT_PROPS[1]);
      expect(site, `${file}의 반쪽 자리`).toBeTruthy();
      // 갈래는 소스에서 파생한 값이고, 배선의 조건도 소스에서 파생한 값이다 — 둘을 맞춰 본다.
      expect(site!.guard, `${file}: 자리를 세우는 최내곽 갈래`).toBe(expectedGuard);
      const conditions = announceEffectWirings(masked).map((wiring) => wiring.condition);
      expect(conditions, `${file}: effect 층 배선의 조건`).toContain(expectedGuard);
      // 배선은 **effect 안**이다 — 렌더 도중 부르면 같은 문장을 매 렌더 다시 읽는다.
      expect(conditions.length, `${file}: effect 층 배선의 수`).toBe(1);
    }
    // 낭독 함수의 단일 소스는 종전 그대로다(이 트랙은 그 파일을 읽기만 한다).
    expect(source("src/ui.tsx"), "낭독 함수의 단일 소스").toContain("export function announceForA11y");
    expect(source("src/preparation/PreparationListParity.tsx"), "준비템 목록이 그 함수를 들여온다").toContain(
      'import { announceForA11y } from "../ui";'
    );
    expect(source("app/index.tsx"), "콜드 스타트가 그 함수를 들여온다").toContain(
      'import { announceForA11y, AppScreen, Card, SecondaryButton, Toast } from "../src/ui";'
    );
  });

  it("ⓓ 문구 — 낭독 문장이 화면이 그리는 값·상수에서 나오고, 두 화면에 새 한국어 0글자다", () => {
    // ① 검색 결과 줄: 모듈이 짓는 문장이 **화면이 그리는 그 줄과 글자로 같다**(눈과 귀).
    const renderedLine = "‘{activeSearchQuery}’ 검색 결과 {displayedItems.length}개";
    expect(source("src/preparation/PreparationListParity.tsx"), "검색 결과 줄의 렌더").toContain(renderedLine);
    expect(searchResultCountAnnouncement("젖병", 12), "그 줄을 소리로 옮긴 문장").toBe(
      renderedLine.replace("{activeSearchQuery}", "젖병").replace("{displayedItems.length}", "12")
    );
    expect(source("src/preparation/PreparationListParity.tsx"), "낭독 문장의 재료").toContain(
      "searchResultCountAnnouncement(activeSearchQuery, displayedItems.length)"
    );

    // ② 콜드 스타트: 카드가 그리는 두 줄 그대로다(문구 단일 소스는 cold-start-hold.ts).
    expect(source("app/index.tsx"), "카드가 그리는 두 줄").toContain("{copy.title}");
    expect(source("app/index.tsx"), "카드가 그리는 두 줄").toContain("{copy.body}");
    expect(source("app/index.tsx"), "그 두 줄을 소리로 옮긴 문장").toContain(
      "announceForA11y(`${copy.title} ${copy.body}`)"
    );
    expect(source("src/onboarding/cold-start-hold.ts"), "문구의 단일 소스").toContain("COLD_START_HOLD_COPY");

    // ③ **새 한국어 0글자** — 두 배선 블록 안에 한글 리터럴이 하나도 없다(주석은 마스킹된다).
    for (const file of ["src/preparation/PreparationListParity.tsx", "app/index.tsx"]) {
      const masked = maskComments(source(file));
      // ⚠️ 자르기 전에 **구간이 실재하는지** 먼저 묻는다(라운드 78 트랙 E의 규율) — 이 구간은
      // 괄호 짝맞추기가 낸 자리라 -1이 될 수 없지만, 스캔이 끊기면 빈 모집단 위에서 아래
      // 부정 단언이 영원히 초록이다.
      const effectRanges = callRangesOf(masked, "useEffect");
      expect(effectRanges.length, `${file}: effect 구간 전수`).toBeGreaterThan(0);
      const wiredEffects = effectRanges
        .map(([effectStart, effectEnd]) => masked.slice(effectStart, effectEnd))
        .filter((effectBody) => effectBody.includes("announceForA11y("));
      expect(wiredEffects.length, `${file}: 낭독 배선을 지닌 effect`).toBe(1);
      expect(wiredEffects[0], `${file}: 배선 안의 한국어 리터럴`).not.toMatch(/[가-힣]/);
    }
  });

  it("ⓔ 소음 금지 · 재낭독 금지 — 조건이 거짓인 창은 조용하고, 같은 값은 두 번 읽히지 않는다", () => {
    const parity = maskComments(source("src/preparation/PreparationListParity.tsx"));
    // 조건이 거짓인 창(검색이 걸리지 않은 목록)에서는 낭독이 0건이다 — 배선이 갈래 안에 있다.
    const wiring = announceEffectWirings(parity).find((entry) => entry.condition === "activeSearchQuery");
    expect(wiring, "검색 결과 낭독의 조건").toBeTruthy();
    // 이전 값을 기억하고, 같으면 소리를 내지 않는다(라운드 89 리뷰 L-4가 이름 붙인 그 축).
    expect(parity, "직전에 읽은 문장을 담는 자리").toContain("const announcedSearchResult = useRef<string | null>(null);");
    expect(parity, "같은 문장이면 그대로 돌아간다").toContain("if (announcedSearchResult.current === announcement) return;");
    expect(parity, "읽은 뒤에 기억한다").toContain("announcedSearchResult.current = announcement;");
    // ⚠️⚠️ **갈래가 닫히면 기억도 지운다**(라운드 90 리뷰 H-1) — 검색을 닫았다가 **같은 검색을
    // 다시** 걸면 문장이 글자로 같아 위 `return`에 걸린다. 그 한 줄이 없으면 iOS만 조용하고
    // 안드로이드는 라이브 리전이 리마운트로 다시 읽어 **두 플랫폼이 그 창에서 갈린다** — 이
    // 배선이 애초에 없애려던 그 갈림이다. 그래서 `else` 갈래를 바이트로 문다(한 줄만 물면
    // 지우기가 다른 갈래로 옮겨 가도 초록이다).
    const closedBranchBytes = "    } else {\n      announcedSearchResult.current = null;\n    }";
    expect(parity, "갈래가 닫히면 기억을 지운다").toContain(closedBranchBytes);
    // ⚠️ 그러면서도 닫힌 창은 여전히 조용하다 — 그 갈래에 낭독은 0건이다.
    // ⚠️ 자르기 전에 **구간이 실재하는지** 먼저 묻는다(라운드 78 트랙 E의 규율) — 표식이
    // 사라지면 -1이 빈 구간을 만들고, 빈 구간 위에서는 아래 부정 단언이 영원히 초록이다.
    const closedBranchAt = parity.indexOf(closedBranchBytes);
    const closedBranchEnd = parity.indexOf("}, [activeSearchQuery, displayedItems.length]);", closedBranchAt);
    expect(closedBranchAt, "닫힌 갈래의 시작").toBeGreaterThan(-1);
    expect(closedBranchEnd, "그 effect의 끝").toBeGreaterThan(closedBranchAt);
    expect(parity.slice(closedBranchAt, closedBranchEnd), "닫힌 갈래에서의 낭독").not.toContain(
      "announceForA11y"
    );
    // 의존 배열은 그 갈래가 읽는 두 값뿐이다 — 목록이 같은 값으로 다시 서면 effect 자체가 돌지 않는다.
    expect(parity, "검색 낭독의 의존 배열").toContain("}, [activeSearchQuery, displayedItems.length]);");

    // 콜드 스타트는 상수 객체 하나가 의존이다 — 같은 이유로 다시 렌더돼도 참조가 같아 다시 읽지 않는다.
    const index = maskComments(source("app/index.tsx"));
    expect(index, "콜드 스타트 낭독의 의존 배열").toContain("}, [copy]);");
    expect(index, "그 의존이 가리키는 상수").toContain("const copy = COLD_START_HOLD_COPY[reason];");
  });

  it("ⓕ 바이트 불변 — 반쪽 프롭 일곱과 두 화면의 렌더는 한 글자도 움직이지 않았다", () => {
    // 프롭은 안드로이드의 답이고, 이 트랙의 목적은 iOS를 여는 것이지 안드로이드를 끄는 것이 아니다.
    for (const [file, openTag] of [
      ["app/index.tsx", '<View accessible accessibilityLiveRegion="polite" style={{ gap: 6 }}>'],
      ["app/settings/app-lock.tsx", '<Text accessibilityLiveRegion="polite" style={doneTextStyle}>'],
      ["src/design-system/patterns/AsyncState.tsx", 'accessibilityLiveRegion="polite"'],
      ["src/design-system/components/ApplicationPrimitives.tsx", '<View accessibilityLiveRegion="polite"'],
      ["src/design-system/components/ModV1Primitives.tsx", '<Text accessibilityLiveRegion="polite"'],
      ["app/(tabs)/items.tsx", '<View\n                accessibilityRole="alert"'],
      [
        "src/preparation/PreparationListParity.tsx",
        '<Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textPrimary, flex: 1, fontSize: 14, fontWeight: "800" }}>'
      ]
    ] as const) {
      expect(source(file), `${file}: 프롭 바이트`).toContain(openTag);
    }
    // 렌더도 그대로다 — 검색 결과 한 줄과 콜드 스타트 카드의 두 줄.
    expect(source("src/preparation/PreparationListParity.tsx"), "검색 결과 줄의 렌더").toContain(
      "‘{activeSearchQuery}’ 검색 결과 {displayedItems.length}개"
    );
    expect(source("app/index.tsx"), "콜드 스타트 카드의 첫 줄").toContain(
      '<Text style={{ color: theme.colors.brown, fontSize: 20, fontWeight: "800" }}>{copy.title}</Text>'
    );
    expect(source("app/index.tsx"), "콜드 스타트 카드의 둘째 줄").toContain(
      '<Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 19 }}>{copy.body}</Text>'
    );
    // 결함이 아닌 넷은 배선도 건드리지 않는다 — 판정만 값으로 적는다.
    expect(maskComments(source("src/design-system/patterns/AsyncState.tsx")), "도달 0건 자리의 배선").not.toContain(
      "announceForA11y"
    );
    expect(
      maskComments(source("src/design-system/components/ApplicationPrimitives.tsx")),
      "도달 0건 자리의 배선"
    ).not.toContain("announceForA11y");
    expect(
      maskComments(source("src/design-system/components/ModV1Primitives.tsx")),
      "도달 0건 자리의 배선"
    ).not.toContain("announceForA11y");
  });

  it("ⓖ 전제 재실측 — *도달 0건* 셋의 근거를 import 그래프에서 다시 걷는다(별칭 경로 포함)", () => {
    // 유령 방지: 걷는 모집단이 실제로 걸린다(배럴이 사는 `.ts`까지).
    const outside = listNonDesignSystemSources();
    expect(outside.length, "design-system 밖의 소스 전수").toBeGreaterThan(60);
    expect(outside.some((path) => path.endsWith(".ts")), "배럴이 사는 `.ts`도 걷는다").toBe(true);
    // 그 걸음이 실제로 이름을 읽는다 — 도달 0건이 "보지 않아서 0"이 아니라는 증거.
    expect(designSystemDirectConsumers("EmptyStateCard"), "배럴에서 이름을 받는 제품 소스").toEqual([
      "src/preparation/PreparationListParity.tsx"
    ]);

    for (const component of ["Toast", "MoneyField", "LoadingState"]) {
      expect(designSystemDirectConsumers(component), `${component}: 직접 소비자`).toEqual([]);
      expect(designSystemComponentReached(component), `${component}: 제품 화면 도달`).toBe(false);
    }
    // ⚠️ 간접 경로는 **하나 실재한다** — 배럴의 EmptyStateCard가 로딩 카드를 그린다. 그 경로를
    // 닫는 것은 도달 0건이라는 주장이 아니라 **제목 정규식**이고, 그 문지기를 여는 리터럴이 오늘 0건이다.
    expect(designSystemRenderersOf("Toast").map((edge) => edge.renderer), "Toast의 간접 경로").toEqual([]);
    expect(designSystemRenderersOf("MoneyField").map((edge) => edge.renderer), "MoneyField의 간접 경로").toEqual([]);
    const loadingEdges = designSystemRenderersOf("LoadingState");
    expect(loadingEdges.map((edge) => edge.renderer), "LoadingState의 간접 경로").toEqual(["EmptyStateCard"]);
    expect(indirectEdgeOpen("LoadingState", loadingEdges[0]), "그 간접 경로가 열려 있는가").toBe(false);
    expect(
      source("src/design-system/components/ApplicationPrimitives.tsx"),
      "그 경로의 문지기"
    ).toContain("if (/불러오고|분석 중|저장하는 중/.test(title)) return <LoadingState title={title} />;");
    // 문지기를 지나는 제품 자리의 제목은 오늘 둘이고, 둘 다 문을 열지 않는다.
    expect(
      jsxPropLiteralsOf(source("src/preparation/PreparationListParity.tsx"), "EmptyStateCard", "title"),
      "그 자리들이 넘기는 제목"
    ).toEqual(["검색 결과가 없어요.", "5개 이상 확인된 준비 품목 그룹이 없어요."]);
  });

  it("ⓗ 재현 — 배선을 빼면 그 자리가 실제로 빨개진다 (강화가 침묵으로 되돌아가지 않게)", () => {
    const screen = (effect: string) => `
export function SearchResultLine({ activeSearchQuery, displayedItems }) {
  ${effect}
  return (
    <View>
      {activeSearchQuery ? (
        <Text accessibilityLiveRegion="polite">{displayedItems.length}</Text>
      ) : null}
    </View>
  );
}
`;
    const siteOf = (sourceText: string) => halfAnnouncedSitesOf(sourceText, "fixture")[0];
    // 반쪽 자리로 세어지고, 감싸는 갈래는 소스에서 나온다.
    expect(siteOf(screen("")), "반쪽 자리와 그 갈래").toEqual({
      file: "fixture",
      prop: 'accessibilityLiveRegion="polite"',
      component: "SearchResultLine",
      guard: "activeSearchQuery",
      at: expect.any(Number)
    });
    // ⚠️ 짝이 완성된 자리는 이 모집단이 아니다(그 자리는 GAP-079·080·087이 센다).
    expect(
      halfAnnouncedSitesOf('<Text accessibilityLiveRegion="polite" accessibilityRole="alert">x</Text>', "fixture"),
      "짝이 완성된 자리"
    ).toEqual([]);
    // ⚠️ 조건이 **글자로** 갈리면 배선이 실재해도 세어지지 않는다(라운드 88 리뷰 L-1의 그 사각).
    const conditions = (effect: string) =>
      announceEffectWirings(maskComments(screen(effect))).map((wiring) => wiring.condition);
    expect(conditions(""), "배선이 없는 화면").toEqual([]);
    expect(
      conditions('useEffect(() => { if (activeSearchQuery) { announceForA11y(line); } }, [activeSearchQuery]);'),
      "갈래와 글자가 같은 배선"
    ).toEqual(["activeSearchQuery"]);
    expect(
      conditions('useEffect(() => { if (Boolean(activeSearchQuery)) { announceForA11y(line); } }, [activeSearchQuery]);'),
      "같은 뜻을 다르게 적은 배선"
    ).toEqual(["Boolean(activeSearchQuery)"]);
    // 핸들러 층의 낭독 판정도 픽스처로 보인다 — 세우는 걸음마다 읽어야 참이다.
    const handler = (extra: string) => `
const succeed = (message) => { setDone(message); announceForA11y(message); };
const reset = () => { setDone(null); };
${extra}
`;
    expect(stateSetterAnnouncesIn(maskComments(handler("")), "done"), "세우는 걸음이 곧 낭독").toBe(true);
    expect(
      stateSetterAnnouncesIn(maskComments(handler("const quiet = (m) => { setDone(m); };")), "done"),
      "하나라도 조용히 세우면 거짓"
    ).toBe(false);
  });

  it("ⓘ 이 스윕의 사각이 값으로 적혀 있고, 모듈 층 스윕의 사각 문장이 오늘의 사실로 다시 쓰였다", () => {
    expect(HALF_ANNOUNCED_SWEEP_BLIND_SPOTS.length, "적어 둔 사각").toBeGreaterThan(3);
    for (const blindSpot of HALF_ANNOUNCED_SWEEP_BLIND_SPOTS) {
      expect(blindSpot.length, "사각은 빈 문자열일 수 없다").toBeGreaterThan(40);
    }
    // ⚠️ GAP-087의 사각 넷째가 지목한 자리를 이 스윕이 모집단으로 삼았다 — 그 문장이 그 사실을 말한다.
    const closed = MODULE_ANNOUNCE_SWEEP_BLIND_SPOTS[3];
    expect(closed, "닫힌 사각의 새 문장").toContain("GAP-090");
    expect(closed, "그 문장이 인용한 수").toContain("여섯");
    expect(closed, "그 문장이 인용한 판정").toContain("도달 0건");
    // 그리고 그 수는 문장이 아니라 파생이 못 박는다(손 숫자가 다시 조용히 낡을 자리를 없앤다).
    expect(
      halfAnnouncedSites().filter((site) => site.prop === ANNOUNCED_ALERT_PROPS[1]).length,
      "그 문장이 말하는 여섯"
    ).toBe(6);
    // 모듈 층 스윕의 모집단은 옮기지 않았다 — 이 스윕이 세는 것은 그 밖이다.
    expect(Object.keys(MODULE_ANNOUNCE_SITES).length, "모듈 층의 낭독 자리").toBe(3);
    expect([...MODULE_ANNOUNCE_SOURCE_ROOTS], "모듈 스윕이 걷는 뿌리").toEqual(["src"]);
  });
});

/* ============================================================================================ */
/* GAP-092 트랙 B(#2) — **행마다 갈리는 낭독 라벨의 모집단이 전수 스윕이 된다**                     */
/* ============================================================================================ */

/**
 * ## 세 라운드를 미룬 조건이 오늘 자기 축으로 선다
 *
 * 라운드 88이 *행마다 갈리는 낭독 라벨의 모집단*을 기각하며 재개 조건을 적었고, 라운드 89 AD-5가
 * 그 조건이 **자기 모순**임을 값으로 만들며 *"그 스윕 자체가 한 트랙의 축이 되는 라운드가 서는 날"*
 * 로 좁혀 다시 적었다. ⚠️⚠️ **그런데 그 좁힘 뒤에도 라운드 89·90·91이 같은 자리를 지나쳤고**
 * (라운드 91 AF-2가 *"세 라운드 연속"* 이라고 이름을 붙였다), **막은 것은 매번 규율이 아니라
 * 배정이었다** — a11y 그물을 여는 트랙이 축을 다른 것(반쪽 프롭 · 프롭 대장 · 모듈 층)으로 골랐을
 * 뿐이다. **오늘 이 파일에서 이 트랙이 여는 축은 이 모집단 하나이고, 그것으로 그 조건이 닫힌다.**
 *
 * ⚠️⚠️ **그리고 *막던 것이 규율이 아니라 배정이었다*는 사실이 오늘 실측으로 드러난다.** 이 축은
 * **화면을 한 바이트도 고치지 않고** 오늘 값 그대로 통과한다(아래 ⓑ의 *갈리지 않는 자리 0건*).
 * 세 라운드를 미룬 이유가 *고칠 것이 많아서*가 아니었다는 증거가 이 스윕의 초록 그 자체다.
 *
 * ## 이 스윕이 묻는 것과 묻지 않는 것 — 손 핀과 서로를 대신하지 않는다
 *
 * ⚠️ 모바일 테스트가 `toContain(… accessibilityLabel …)` 꼴로 라벨을 **손으로 무는** 자리는 오늘
 * 일곱 파일 **70**이고(정찰의 값), 그중 대부분이 이 파일에 산다. **그 핀들은 *문구*를 문다** —
 * "이 자리에 이 글자가 있는가". ⚠️⚠️ **이 스윕은 문구를 묻지 않는다. 묻는 것은 *행마다 갈리는가*
 * 하나다.** 두 축은 서로를 대신하지 않으므로 **손 핀은 한 줄도 지우지 않았고**, 아래 ⓖ가 그 사실을
 * 값(이 파일 안의 핀 수 하한)으로 못 박는다.
 *
 * ⚠️ 그리고 `accessibilityLabel="문자열"` 꼴의 **상수 라벨**(오늘 마스킹 뒤 **73** · 마스킹 전
 * 원문 grep으로는 **74**이고 그 차이 하나는 주석 안에 산다)은 **이 모집단이 아니다** — 식이 아니라
 * 상수이고, 애초에 목록 밖이다. ⚠️⚠️ **그래서 이 두 수를 한 낱말로 적지 않는다**: 이 스윕의 모집단은
 * *식으로 만드는 라벨* **162**이고, 상수 라벨의 수는 그 옆에 따로 선다.
 */

/** 이 스윕의 바늘 — 라벨을 **식**으로 만드는 자리(상수 문자열 라벨은 이 낱말에 걸리지 않는다). */
const ROW_LABEL_NEEDLE = "accessibilityLabel={";

/** 상수 라벨의 낱말 — **모집단 밖**이고, 위 낱말과 **합산하지 않는다**(두 수를 한 낱말로 적지 않는다). */
const CONSTANT_LABEL_NEEDLE = 'accessibilityLabel="';

/** `(`·`{`의 짝. 따옴표 안의 괄호는 세지 않는다(`openingTagEnd`와 같은 규칙, 대상만 다르다). */
function matchingBracketAt(masked: string, at: number): number {
  const open = masked[at];
  const close = open === "(" ? ")" : "}";
  let depth = 0;
  let quote: string | null = null;
  for (let i = at; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `이름`이 **식별자로** 등장하는가(부분 문자열이 아니라 낱말 — `$`를 쓰는 이름도 옳게 문다). */
function mentionsIdentifier(text: string, name: string): boolean {
  return new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text);
}

type RowCallbackKind = "map" | "renderItem" | "render-fn" | "row-component" | "map-component";

/** 목록 콜백 하나 — 구간과 **행 파라미터 목록**을 함께 들고 다닌다. */
type RowCallback = { kind: RowCallbackKind; start: number; end: number; params: string };

/**
 * ⚠️⚠️ **라운드 92 리뷰 H-3 — 셋째 바늘이 선 이유.**
 *
 * 트랙 B의 바늘 둘은 **인라인 콜백**만 봤다(`.map((행 …` · `renderItem={({ item …`). 그런데 이
 * 저장소의 **가상화 목록**은 정확히 그 반대 모양으로 서 있다 — `renderItem`/`renderSectionHeader`에
 * **모듈 스코프 함수 이름**을 넘기고(리렌더마다 prop 참조가 흔들리지 않게 한 PERF 관례다), 그
 * 함수가 다시 **memo로 감싼 행 컴포넌트**를 그린다. 그래서 *행마다 갈리는 낭독 라벨*의 가장
 * 대표적인 자리인 **기록 탭의 지출 행 라벨**(`app/(tabs)/records.tsx`)이 모집단 **밖**이었다.
 * ⚠️ 사각 ⓐ는 그 사실을 모른 채 *"목록 밖 127에는 행이라는 단위가 없다"* 라고 값으로 적었고,
 * 그 문장이 거짓이었다(오늘 그 문장을 참으로 다시 적는다).
 *
 * 셋째 바늘은 **이름을 따라 한 걸음** 간다: `renderItem={이름}`·`renderSectionHeader={이름}`으로
 * 넘겨진 **모듈 스코프 렌더 함수**와, 그 함수가 그리는 **행 컴포넌트의 본문**을 모집단에 넣는다.
 * 두 걸음(행 컴포넌트가 다시 부르는 하위 컴포넌트)은 따라가지 않는다 — 사각 ⓒ가 그 경계를 진다.
 */
const RENDER_PROP_NEEDLE = /\b(?:renderItem|renderSectionHeader)=\{\s*([A-Za-z_$][\w$]*)\s*\}/g;

/** JSX로 그려지는 **대문자 이름** — 렌더 함수가 어느 행 컴포넌트를 그리는지 읽는 낱말. */
const RENDERED_COMPONENT_NEEDLE = /<([A-Z][A-Za-z0-9_$]*)[\s/>]/g;

/** 파라미터에서 **타입 표기를 걷는다** — `{ item }: ListRenderItemInfo<Row>` → `{ item }`. */
function stripParamTypes(params: string): string {
  let out = "";
  let depth = 0;
  let skipping = false;
  for (const char of params) {
    if (skipping) {
      if (char === "{" || char === "(" || char === "[" || char === "<") depth += 1;
      else if (char === "}" || char === ")" || char === "]" || char === ">") depth -= 1;
      else if (char === "," && depth <= 0) {
        skipping = false;
        depth = 0;
        out += char;
      }
      continue;
    }
    if (char === ":" && depth === 0) {
      skipping = true;
      depth = 0;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") depth += 1;
    else if (char === "}" || char === ")" || char === "]") depth -= 1;
    out += char;
  }
  return out;
}

/** 함수 하나의 **파라미터 구간과 몸통 구간** — 여는 `(`의 자리에서 파생한다. */
function functionSpanAt(masked: string, parenOpen: number): { params: string; start: number; end: number } | null {
  const parenEnd = matchingBracketAt(masked, parenOpen);
  if (parenEnd < 0) return null;
  const bodyStart = masked.indexOf("{", parenEnd);
  if (bodyStart < 0) return null;
  const bodyEnd = matchingBracketAt(masked, bodyStart);
  if (bodyEnd < 0) return null;
  return { params: masked.slice(parenOpen + 1, parenEnd), start: bodyStart, end: bodyEnd };
}

/**
 * 이름 하나를 **선언 자리로** 따라간다 — 이 저장소가 실제로 쓰는 세 꼴만 읽는다.
 *
 *  · `function 이름(…) { … }` — 모듈 스코프 렌더 함수와 평범한 컴포넌트.
 *  · `const 이름 = memo(function …(…) { … })` — memo로 감싼 행 컴포넌트.
 *  · `const 이름 = memo(다른이름);` — **별칭 한 걸음**(그 다음은 따라가지 않는다).
 *
 * ⚠️ 그 밖의 꼴(`useCallback`으로 만든 렌더 함수 등)은 **읽지 않는다** — 사각 ⓒ가 그 경계를 진다.
 */
function declarationSpanOf(
  masked: string,
  name: string,
  aliasHopsLeft = 1
): { params: string; start: number; end: number } | null {
  const escaped = name.replace(/\$/g, "\\$");
  const fnDeclaration = new RegExp(`(?<![\\w$])function\\s+${escaped}\\s*\\(`).exec(masked);
  if (fnDeclaration !== null) return functionSpanAt(masked, fnDeclaration.index + fnDeclaration[0].length - 1);
  const memoFn = new RegExp(
    `(?<![\\w$])const\\s+${escaped}\\s*(?::[^=\\n]*)?=\\s*memo\\(\\s*function\\s*[A-Za-z0-9_$]*\\s*\\(`
  ).exec(masked);
  if (memoFn !== null) return functionSpanAt(masked, memoFn.index + memoFn[0].length - 1);
  const memoAlias = new RegExp(
    `(?<![\\w$])const\\s+${escaped}\\s*(?::[^=\\n]*)?=\\s*memo\\(\\s*([A-Za-z_$][\\w$]*)\\s*\\)`
  ).exec(masked);
  if (memoAlias !== null && aliasHopsLeft > 0) return declarationSpanOf(masked, memoAlias[1], aliasHopsLeft - 1);
  return null;
}

/**
 * 첫째 바늘 하나 — `.map((행 …`. ⚠️ **판정은 한 글자도 바뀌지 않았다**: 라운드 93 트랙 C가 넷째
 * 바늘에서 *같은 `.map` 구간*을 다시 읽어야 해서(재귀를 만들지 않으려고) 이 조각만 이름을 얻었다.
 */
function mapCallbacksOf(masked: string): RowCallback[] {
  const callbacks: RowCallback[] = [];
  // ⚠️ 라운드 92 리뷰 H-3: `.map(` 뒤의 **줄바꿈 꼴**도 같은 자리다(종전 바늘은 `\.map\(\(` 였다).
  const mapNeedle = /\.map\(\s*\(/g;
  let found: RegExpExecArray | null;
  while ((found = mapNeedle.exec(masked))) {
    const callOpen = found.index + ".map".length;
    const callEnd = matchingBracketAt(masked, callOpen);
    const paramsOpen = found.index + found[0].length - 1;
    const paramsEnd = matchingBracketAt(masked, paramsOpen);
    if (callEnd < 0 || paramsEnd < 0) continue;
    callbacks.push({ kind: "map", start: callOpen, end: callEnd, params: masked.slice(paramsOpen + 1, paramsEnd) });
  }
  return callbacks;
}

/* -------------------------------------------------------------------------------------------- */
/* GAP-093 트랙 C — **넷째 바늘**: `.map(` 안에서 그려지는 행꼴 컴포넌트의 *본문*                    */
/* -------------------------------------------------------------------------------------------- */

/**
 * ## 왜 넷째가 서는가 — 셋째와 방향이 반대다
 *
 * 셋째 바늘(리뷰 H-3)은 **렌더 프롭에 넘긴 이름**에서 출발해 선언으로 갔다. 그런데 이 저장소에서
 * *행*을 그리는 가장 흔한 꼴은 그것이 아니라 **`.map(` 안에서 컴포넌트를 바로 그리는 것**이다 —
 * `{rows.map((row) => <PreparationItemCard title={row.title} … />)}`. 그 컴포넌트의 **본문**은
 * 목록 콜백 밖(대개 **다른 파일**)에 살아서, 라벨 식이 행에서 나오는지 아무도 묻지 않았다.
 * ⚠️⚠️ 라운드 92 B가 사각 ⓐ에 *"행이면서도 이 바늘 밖인 자리가 남아 있다"* 라고 적은 갈래 ⓑ가
 * 정확히 이 층이고, 라운드 93 정찰이 표본으로 그 실재를 확인했다(컴포넌트 15 · 식 라벨 37 · 하한).
 *
 * ## 잇는 방법 — **JSX 사용처 → 컴포넌트 정의**, 그리고 프롭 이름 → 파라미터는 *한 걸음*
 *
 *  ① `.map(` 콜백 안에서 **행꼴 이름**의 여는 태그를 찾는다(*행꼴*의 판정은 아래 두 값이다:
 *     이름이 `ROW_SHAPED_NAME_WORDS` 하나를 품고 · 호출부가 `.map(` 콜백 안이다).
 *  ② 그 태그의 프롭 가운데 **행 변수를 읽는 것**만 고른다(`title={row.title}`은 고르고
 *     `columns={columns}`는 고르지 않는다). 하나도 없으면 그 자리는 **모집단 밖**이다 —
 *     행이 컴포넌트 안으로 들어가는 길이 이 바늘에 보이지 않기 때문이다.
 *  ③ 이름을 선언으로 잇는다: **같은 파일** → 없으면 **import 한 줄**(별칭 `as`를 원래 이름으로
 *     되돌린다) → 배럴이면 **재수출 한 줄**까지. 그 밖은 밖이다(사각).
 *  ④ 그 선언의 **파라미터 이름 가운데 ②에서 고른 프롭 이름과 같은 것**을 그 컴포넌트의 *행*으로
 *     삼는다. ⚠️ **프롭 이름 → 파라미터 연결은 여기까지가 한 걸음이다** — 컴포넌트가 그 프롭을
 *     다시 하위 컴포넌트에 넘기는 두 걸음은 따라가지 않는다(사각).
 *
 * 그 뒤의 판정 셋(*행 직접* · *한 걸음 파생* · *갈리지 않음*)은 **셋째까지와 같은 함수**가 낸다 —
 * 넷째 바늘은 **모집단을 넓히는 것**이지 판정을 바꾸는 것이 아니다.
 */
const ROW_SHAPED_NAME_WORDS = ["Row", "Card", "Cell", "Tile", "Chip", "Item"] as const;

/** *행꼴*의 절반 — 이름. 나머지 절반(호출부가 `.map(` 안)은 아래 스캔이 구간으로 판정한다. */
function isRowShapedName(name: string): boolean {
  return ROW_SHAPED_NAME_WORDS.some((word) => name.includes(word));
}

/** 모듈 지정자를 **실재하는 파일**로 — 확장자 넷을 순서대로 보고, 없으면 밖이다(존재 가드). */
const MODULE_FILE_SUFFIXES = [".tsx", ".ts", "/index.tsx", "/index.ts"] as const;

function moduleFileOf(fromFile: string, specifier: string): string | null {
  // 패키지 지정자(`react-native` 등)는 이 저장소 밖이다 — 상대 경로만 따라간다.
  if (!specifier.startsWith(".")) return null;
  const base = join(dirname(fromFile), specifier);
  for (const suffix of MODULE_FILE_SUFFIXES) {
    if (existsSync(join(mobileRoot, base + suffix))) return base + suffix;
  }
  return null;
}

/** 이름 하나가 어느 파일의 어느 이름으로 들어왔는가(별칭은 **원래 이름**으로 되돌린다). */
type NamedImport = { name: string; file: string };

function importOriginOf(masked: string, local: string, fromFile: string): NamedImport | null {
  const needle = /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let found: RegExpExecArray | null;
  while ((found = needle.exec(masked))) {
    for (const piece of found[1].split(",")) {
      const parts = piece.trim().split(/\s+as\s+/);
      if ((parts[1] ?? parts[0]).trim() !== local) continue;
      const file = moduleFileOf(fromFile, found[2]);
      return file === null ? null : { name: parts[0].trim().replace(/^type\s+/, ""), file };
    }
  }
  return null;
}

/** 배럴의 재수출 한 줄 — `export { A } from "./x"`. `export *`는 따라가지 않는다(사각). */
function reexportOriginOf(masked: string, name: string, fromFile: string): NamedImport | null {
  const needle = /export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let found: RegExpExecArray | null;
  while ((found = needle.exec(masked))) {
    for (const piece of found[1].split(",")) {
      const parts = piece.trim().split(/\s+as\s+/);
      if ((parts[1] ?? parts[0]).trim() !== name) continue;
      const file = moduleFileOf(fromFile, found[2]);
      return file === null ? null : { name: parts[0].trim().replace(/^type\s+/, ""), file };
    }
  }
  return null;
}

/** 마스킹한 소스를 한 번만 읽는다(넷째 바늘은 파일을 여러 번 되짚는다 — 셋째까지의 경로는 그대로다). */
const maskedSourceCache = new Map<string, string>();
function maskedSource(file: string): string {
  const cached = maskedSourceCache.get(file);
  if (cached !== undefined) return cached;
  const masked = maskComments(source(file));
  maskedSourceCache.set(file, masked);
  return masked;
}

/** JSX 사용처 → 컴포넌트 정의. **같은 파일 → import 한 줄 → 재수출 한 줄**까지가 이 바늘의 걸음이다. */
const ROW_COMPONENT_MODULE_HOPS = 2;

type RowComponentDeclaration = { file: string; name: string; params: string; start: number; end: number };

function rowComponentDeclarationOf(
  callerFile: string,
  callerMasked: string,
  local: string
): RowComponentDeclaration | null {
  const here = declarationSpanOf(callerMasked, local);
  if (here !== null) return { file: callerFile, name: local, ...here };
  let cursor = importOriginOf(callerMasked, local, callerFile);
  for (let hop = 0; hop < ROW_COMPONENT_MODULE_HOPS && cursor !== null; hop += 1) {
    const masked = maskedSource(cursor.file);
    if (cursor.file.endsWith(".tsx")) {
      const span = declarationSpanOf(masked, cursor.name);
      if (span !== null) return { file: cursor.file, name: cursor.name, ...span };
    }
    cursor = reexportOriginOf(masked, cursor.name, cursor.file);
  }
  return null;
}

/** 여는 태그의 프롭 가운데 **행 변수를 읽는 것**들의 이름(②). 하나도 없으면 이 바늘 밖이다. */
function rowCarryingPropsOf(masked: string, tagStart: number, tagEnd: number, rowNames: string[]): string[] {
  const tag = masked.slice(tagStart, tagEnd);
  const needle = /([A-Za-z_$][\w$]*)=\{/g;
  const carried: string[] = [];
  let found: RegExpExecArray | null;
  while ((found = needle.exec(tag))) {
    const braceOpen = tagStart + found.index + found[0].length - 1;
    const braceEnd = matchingBracketAt(masked, braceOpen);
    if (braceEnd < 0) continue;
    const value = masked.slice(braceOpen + 1, braceEnd);
    if (rowNames.some((row) => mentionsIdentifier(value, row)) && !carried.includes(found[1])) carried.push(found[1]);
  }
  return carried;
}

/** 한 파일이 `.map(` 안에서 그리는 **행꼴 컴포넌트**들 — 선언 자리와 *행을 받은 프롭 이름*을 함께 든다. */
type RowComponentUsage = RowComponentDeclaration & { local: string; props: string[] };

/**
 * ⚠️ `widen`은 **바늘이 아니라 자**다 — 사각 ⓑ의 크기를 재실측할 때만 켠다(이름 판정과 프롭 연결을
 * 둘 다 끄고 *`.map(`이 그리는 컴포넌트 전수*를 센다). 스윕의 모집단은 언제나 기본값 쪽이다.
 */
function mapDrawnRowComponentsOf(
  masked: string,
  file: string,
  widen: { anyName?: boolean; anyProps?: boolean } = {}
): RowComponentUsage[] {
  const usages = new Map<string, RowComponentUsage>();
  for (const callback of mapCallbacksOf(masked)) {
    const rowNames = rowParamNamesOf(stripParamTypes(callback.params));
    if (rowNames.length === 0) continue;
    const body = masked.slice(callback.start, callback.end);
    const tags = new RegExp(RENDERED_COMPONENT_NEEDLE.source, "g");
    let tag: RegExpExecArray | null;
    while ((tag = tags.exec(body))) {
      const local = tag[1];
      if (!isRowShapedName(local) && widen.anyName !== true) continue;
      const tagStart = callback.start + tag.index;
      const tagEnd = openingTagEnd(masked, tagStart);
      if (tagEnd < 0) continue;
      const carried = rowCarryingPropsOf(masked, tagStart, tagEnd, rowNames);
      if (carried.length === 0 && widen.anyProps !== true) continue;
      const declaration = rowComponentDeclarationOf(file, masked, local);
      if (declaration === null) continue;
      const key = `${declaration.file}|${declaration.name}`;
      const seen = usages.get(key);
      if (seen === undefined) usages.set(key, { ...declaration, local, props: [...carried] });
      else for (const prop of carried) if (!seen.props.includes(prop)) seen.props.push(prop);
    }
  }
  return [...usages.values()];
}

/** 사용처가 문 컴포넌트 하나를 **목록 콜백 하나**로 — 행 이름은 ④의 *한 걸음* 교집합이다. */
function rowComponentCallbackOf(usage: RowComponentUsage): RowCallback | null {
  const params = rowParamNamesOf(stripParamTypes(usage.params)).filter((name) => usage.props.includes(name));
  if (params.length === 0) return null;
  return { kind: "map-component", start: usage.start, end: usage.end, params: params.join(", ") };
}

/**
 * 목록 콜백 전수. 바늘은 **넷**이다 — `.map((행 …` · `renderItem={({ item …` ·
 * `renderItem={이름}`으로 넘겨진 **모듈 스코프 렌더 함수와 그 함수가 그리는 행 컴포넌트**(H-3) ·
 * 그리고 `.map(` 안에서 **바로 그려지는 행꼴 컴포넌트의 본문**(라운드 93 트랙 C).
 *
 * ⚠️ 인라인 `renderItem` 쪽은 **오늘 이 저장소에 0건**이다(인라인 목록은 전부 `.map`으로 서고,
 * 가상화 목록은 전부 셋째 바늘 쪽이다). 0건인 바늘은 *유령*이 될 수 있으므로 아래 ⓒ의 픽스처가
 * **그 바늘이 실제로 문다**는 것을 따로 증명한다.
 *
 * ⚠️⚠️ 넷째 바늘의 자리는 **두 갈래로 들어온다**: 사용처와 선언이 같은 파일이면 여기서 바로 서고,
 * 다른 파일이면 `extraCallbacks`(스윕이 전수에서 모아 준 *남의 화면이 그리는 내 컴포넌트*)로 온다.
 */
function rowCallbacksOf(masked: string, file: string, extraCallbacks: readonly RowCallback[] = []): RowCallback[] {
  const callbacks: RowCallback[] = mapCallbacksOf(masked);
  let found: RegExpExecArray | null;
  const renderItemNeedle = /renderItem=\{\s*\(/g;
  while ((found = renderItemNeedle.exec(masked))) {
    const propOpen = found.index + "renderItem=".length;
    const propEnd = matchingBracketAt(masked, propOpen);
    const paramsOpen = found.index + found[0].length - 1;
    const paramsEnd = matchingBracketAt(masked, paramsOpen);
    if (propEnd < 0 || paramsEnd < 0) continue;
    callbacks.push({
      kind: "renderItem",
      start: propOpen,
      end: propEnd,
      params: masked.slice(paramsOpen + 1, paramsEnd)
    });
  }
  // ── 셋째 바늘(H-3) — 이름을 따라 한 걸음 ────────────────────────────────────
  const seen = new Set<string>();
  const renderPropNeedle = new RegExp(RENDER_PROP_NEEDLE.source, "g");
  while ((found = renderPropNeedle.exec(masked))) {
    const name = found[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const renderFn = declarationSpanOf(masked, name);
    if (renderFn === null) continue;
    callbacks.push({ kind: "render-fn", start: renderFn.start, end: renderFn.end, params: stripParamTypes(renderFn.params) });
    // 그 함수가 그리는 행 컴포넌트 **본문**까지 한 걸음(두 걸음은 따라가지 않는다 — 사각 ⓒ).
    const rendered = new RegExp(RENDERED_COMPONENT_NEEDLE.source, "g");
    const body = masked.slice(renderFn.start, renderFn.end);
    let component: RegExpExecArray | null;
    while ((component = rendered.exec(body))) {
      const componentName = component[1];
      if (seen.has(componentName)) continue;
      seen.add(componentName);
      const span = declarationSpanOf(masked, componentName);
      if (span === null) continue;
      callbacks.push({
        kind: "row-component",
        start: span.start,
        end: span.end,
        params: stripParamTypes(span.params)
      });
    }
  }
  // ── 넷째 바늘(트랙 C) — 같은 파일에서 `.map(`이 그리는 행꼴 컴포넌트 ────────────
  const fourth: RowCallback[] = [];
  for (const usage of mapDrawnRowComponentsOf(masked, file)) {
    if (usage.file !== file) continue; // 남의 파일에 사는 본문은 그 파일을 걸을 때 `extraCallbacks`로 온다.
    const callback = rowComponentCallbackOf(usage);
    if (callback !== null) fourth.push(callback);
  }
  for (const callback of extraCallbacks) {
    if (fourth.some((seen) => seen.start === callback.start)) continue; // 같은 본문을 두 번 세지 않는다.
    fourth.push(callback);
  }
  callbacks.push(...fourth);
  return callbacks;
}

/** 콜백의 파라미터에서 **행 이름들**을 뽑는다(`(row, index)` · `({ item, index })` 둘 다). */
function rowParamNamesOf(params: string): string[] {
  const flattened = params.replace(/\{([^}]*)\}/g, (_all, inner: string) => inner);
  return flattened
    .split(",")
    .map((piece) => piece.split(":").pop()!.split("=")[0].trim().replace(/\?$/, ""))
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

/** 목록 안의 낭독 라벨 자리 하나 — 자리·라벨 식·**가장 안쪽** 콜백의 행 이름과 몸통. */
type RowLabelSite = {
  file: string;
  at: number;
  expr: string;
  kind: RowCallbackKind;
  rows: string[];
  body: string;
};

/**
 * 한 파일의 낭독 라벨 자리 — **식으로 만드는 전수**와 그중 **목록 콜백 안**의 자리.
 *
 * ⚠️ 감싸는 콜백이 여럿이면 **가장 안쪽** 것을 고른다(중첩 목록에서 *행*이라는 단위는 안쪽의 것이다).
 */
function rowLabelSitesOf(
  sourceText: string,
  file: string,
  extraCallbacks: readonly RowCallback[] = []
): { labels: number; rows: RowLabelSite[] } {
  const masked = maskComments(sourceText);
  const callbacks = rowCallbacksOf(masked, file, extraCallbacks);
  const needle = new RegExp(ROW_LABEL_NEEDLE.replace(/[{]/g, "\\{"), "g");
  const rows: RowLabelSite[] = [];
  let labels = 0;
  let found: RegExpExecArray | null;
  while ((found = needle.exec(masked))) {
    labels += 1;
    const exprOpen = found.index + ROW_LABEL_NEEDLE.length - 1;
    const exprEnd = matchingBracketAt(masked, exprOpen);
    if (exprEnd < 0) continue;
    const enclosing = callbacks
      .filter((callback) => callback.start < found!.index && found!.index < callback.end)
      .sort((left, right) => right.start - left.start);
    if (enclosing.length === 0) continue;
    const innermost = enclosing[0];
    rows.push({
      file,
      at: found.index,
      expr: masked.slice(exprOpen + 1, exprEnd).replace(/\s+/g, " ").trim(),
      kind: innermost.kind,
      rows: rowParamNamesOf(innermost.params),
      body: masked.slice(innermost.start, innermost.end)
    });
  }
  return { labels, rows };
}

/**
 * 넷째 바늘의 **파일 밖 갈래** — *남의 화면이 `.map(`으로 그리는, 이 파일에 사는 행꼴 컴포넌트*.
 *
 * ⚠️ 한 컴포넌트를 여러 화면이 그리면(오늘 `CategoryChip`을 아홉 화면이 그린다) **행을 받은 프롭
 * 이름을 합집합으로 모은다** — 한 화면만 보고 *갈리지 않는다*로 떨어뜨리지 않기 위해서다.
 *
 * ⚠️⚠️ **그 합집합의 반대 방향도 값으로 적는다(라운드 93 리뷰 L-6) — 이쪽은 *거짓 초록*이다.**
 * 합집합은 *어느 한 화면이라도 행을 실어 준 프롭*을 전부 행 이름으로 들이므로, **다른 화면에서는
 * 그 프롭이 행과 무관한 상수인 경우에도** 그 컴포넌트의 라벨 식이 그 이름을 읽기만 하면 `row-direct`로
 * 떨어진다. 즉 **판정이 조용히 초록 쪽으로 기운다** — 실제로는 그 화면에서 갈리지 않는데 갈린다고
 * 읽는 것이고, 그 오차는 래칫을 빨갛게 하지 않아 사람이 보지 못한다.
 * ⚠️ **그래도 합집합을 고른 이유는 두 오차의 무게가 다르기 때문이다**: 교집합을 고르면 *정말 갈리는
 * 자리를 갈리지 않는다고 읽는*(거짓 초록이면서 **사람이 겪는**) 쪽으로 기울고, 합집합의 거짓 초록은
 * **모집단을 넓히는 쪽**이라 자리가 사라지지 않는다. **어느 쪽도 빨개지지 않는다는 사실은 같고,
 * 이 주석이 그 사실을 값으로 든다**(오늘 이 갈래로 잘못 초록이 된 자리 수는 세지 않았다).
 */
function foreignRowComponentCallbacks(files: string[]): Map<string, RowCallback[]> {
  const byFile = new Map<string, RowCallback[]>();
  for (const file of files) {
    for (const usage of mapDrawnRowComponentsOf(maskedSource(file), file)) {
      if (usage.file === file) continue;
      const callback = rowComponentCallbackOf(usage);
      if (callback === null) continue;
      const list = byFile.get(usage.file) ?? [];
      const seen = list.find((entry) => entry.start === callback.start);
      if (seen === undefined) list.push(callback);
      else {
        const union = new Set([...seen.params.split(", "), ...callback.params.split(", ")]);
        list[list.indexOf(seen)] = { ...seen, params: [...union].join(", ") };
      }
      byFile.set(usage.file, list);
    }
  }
  return byFile;
}

/** 전수 스윕 — 손 목록이 아니라 `listComponentSources()`가 모집단을 정한다. */
function rowLabelSweep(): { files: string[]; labels: number; constants: number; rows: RowLabelSite[] } {
  const files = listComponentSources();
  const foreign = foreignRowComponentCallbacks(files);
  let labels = 0;
  let constants = 0;
  const rows: RowLabelSite[] = [];
  for (const file of files) {
    const text = source(file);
    const found = rowLabelSitesOf(text, file, foreign.get(file) ?? []);
    labels += found.labels;
    rows.push(...found.rows);
    constants += (maskComments(text).match(new RegExp(CONSTANT_LABEL_NEEDLE, "g")) ?? []).length;
  }
  return { files, labels, constants, rows };
}

/** 한 자리의 판정 셋. ⚠️ 손으로 적지 않고 **소스에서 파생한다**. */
type RowLabelVerdict = "row-direct" | "row-derived" | "row-invariant";

/** 라벨 식이 **한 걸음 거쳐** 행에서 나오는가 — 그 중간 이름들(콜백 몸통의 선언에서 파생). */
function rowDerivedNamesOf(site: RowLabelSite): string[] {
  const declaration = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=\s*([^;\n]*)/g;
  const names: string[] = [];
  let found: RegExpExecArray | null;
  while ((found = declaration.exec(site.body))) {
    if (site.rows.some((row) => mentionsIdentifier(found![2], row))) names.push(found[1]);
  }
  return names.filter((name) => mentionsIdentifier(site.expr, name));
}

function rowLabelVerdictOf(site: RowLabelSite): RowLabelVerdict {
  if (site.rows.some((row) => mentionsIdentifier(site.expr, row))) return "row-direct";
  if (rowDerivedNamesOf(site).length > 0) return "row-derived";
  return "row-invariant";
}

/** 자리 이름 — 파일과 라벨 식으로 사람이 읽는 열쇠를 만든다(자리 번호는 바이트가 움직이면 흔들린다). */
const rowLabelKey = (site: RowLabelSite) => `${site.file} ${site.expr}`;

/**
 * ⚠️ **빈 이유 금지.** *행마다 갈리지 않는* 자리가 서는 날, 그 자리는 **왜 갈리지 않아도 되는지**를
 * 여기에 이름과 이유로 적어야 한다(오늘 **0건**이라 표는 비어 있고, 아래 ⓑ가 그 비어 있음을
 * **부정 단언**으로 못 박는다). 이유는 40자 이상이어야 한다 — 한 낱말짜리 알리바이를 막는다.
 */
const ROW_INVARIANT_REASONS: Record<string, string> = {};

/**
 * 래칫 — 오늘의 값이 내일의 바닥이다.
 *
 * ⚠️ `invariant`만 **상한**(0에서 늘지 않는다)이고, 나머지는 **하한**(줄지 않는다). 화면이 늘거나
 * 목록이 늘면 이 수들은 자연히 커지고, 커지는 방향으로는 이 계약이 막지 않는다.
 */
const ROW_LABEL_RATCHET = {
  files: 58,
  labels: 162,
  // ⚠️⚠️ **세 시점 — 바늘이 하나씩 늘 때마다 이 세 수가 움직였고, 옛 값을 지우지 않는다.**
  //  · **라운드 92 트랙 B 커밋 시점**: `listSites 35 · direct 34 · derived 1`(인라인 콜백만 보던 모집단).
  //  · **라운드 92 리뷰 H-3 뒤**: 가상화 목록의 **모듈 스코프 렌더 함수와 행 컴포넌트 셋**이 들어와
  //    `38 · 36 · 2`가 됐다 — 기록 탭 지출 행 라벨·기록 탭 섹션 헤더 라벨(둘 다 direct)과
  //    가져오기 검수의 잠긴 행 라벨(파생)이다. 목록 **밖**은 그만큼 127 → 124로 줄었다.
  //  · **오늘(라운드 93 트랙 C · 넷째 바늘 뒤)**: `.map(` 안에서 바로 그려지는 **행꼴 컴포넌트의
  //    본문** 여덟(자리 **열**)이 들어와 `48 · 44 · 4`가 됐다 — 빠른 품목 타일·준비템 카드·
  //    구매 링크 행(둘)·분류 칩·더보기 행·초대 행·**설정 목록 행**(여기까지 여덟이 direct)과
  //    달력 날짜 칸 둘(파생)이다.
  //    ⚠️⚠️ **두 시점(라운드 93 리뷰 M-9): *열*의 열거가 아홉뿐이었다** — `설정 목록 행`
  //    (`src/design-system/components/ApplicationPrimitives.tsx`의 `ListRow` · 자리 `at 8279` ·
  //    `app/settings/index.tsx:342`의 `supportRows.map(`이 그린다)이 빠져 있었다. **수(열·여덟·
  //    direct 여덟)는 그때도 옳았고 이름만 아홉이었다** — 그래서 이 정정은 값이 아니라 열거를
  //    고친다. ⚠️ 이 병은 사각 ⓐ가 이름 붙인 것과 같은 얼굴이다: **크기는 적고 갈래는 덜 적는다.**
  //    목록 **밖**은 그만큼 124 → **114**로 줄었다(사각 ⓐ의 세 번째 시점).
  listSites: 48,
  direct: 44,
  derived: 4,
  invariant: 0,
  constants: 73,
  /** 넷째 바늘이 데려온 자리(하한) — 오늘 **열**이고, 그 열은 오늘의 38과 **겹치지 않는다**. */
  mapComponentSites: 10,
  /** 그 열이 사는 **행꼴 컴포넌트**(하한) — 이름·호출부로 판정한 열셋 가운데 식 라벨을 지닌 여덟. */
  mapComponents: 8
} as const;

/** *한 걸음 파생* 자리 둘 — 라운드 91 A가 25→27을 겪은 그 모양이다(인라인 하나 · 행 컴포넌트 하나). */
const ROW_DERIVED_SITE_FILE = "app/family/index.tsx";
/** ⚠️ 리뷰 H-3이 데려온 파생 자리 — 행 컴포넌트가 `row`에서 만든 이름을 라벨 식이 읽는다. */
const ROW_DERIVED_COMPONENT_FILE = "app/import/[importJobId].tsx";

/** 넷째 바늘이 데려온 자리 가운데 **핵심 루프**에 걸리는 셋 — 파일과 컴포넌트 이름으로 서 있다. */
const MAP_COMPONENT_LOOP_SITES = [
  ["app/expenses/new.tsx", "ExpenseQuickItemButton"],
  ["src/design-system/components/ModV1Primitives.tsx", "PreparationItemCard"],
  ["src/ui.tsx", "ProductComparisonRow"]
] as const;

/** ⓔ 바이트 불변 — 이 트랙이 **읽기만** 했음을 자리의 원문 바이트로 못 박는다. */
const ROW_LABEL_UNTOUCHED_BYTES = [
  [ROW_DERIVED_SITE_FILE, "accessibilityLabel={`${pendingInviteTarget(roleLabel, createdAtLabel)} 취소`}"],
  ["src/ui.tsx", "accessibilityLabel={`${slice.label}, ${slice.percentLabel}, ${formatKrw(slice.amountKrw)}`}"],
  ["src/ui.tsx", "accessibilityLabel={option}"],
  // ⚠️ 라운드 93 트랙 C가 **넷째 바늘로 데려온** 자리 둘 — 데려오기만 했고 한 글자도 고치지 않았다.
  ["src/design-system/components/ModV1Primitives.tsx", "accessibilityLabel={`${title}. 상태 ${label}${hint ? `. ${hint}` : \"\"}`}"],
  ["src/expenses/RecordsCalendar.tsx", "const accessibilityLabel = calendarCellAccessibilityLabel(cell, { filterLabel }) ?? undefined;"]
] as const;

/** ⓕ 사각 — **이 스윕이 못 보는 것**을 값과 하한으로 적는다(넷 이상). */
const ROW_LABEL_SWEEP_BLIND_SPOTS = [
  "목록 **밖**의 낭독 라벨 **114**(오늘 식 전수 162 − 목록 안 48)는 이 축이 묻지 않는다. " +
    "⚠️⚠️ **세 번째 시점(라운드 93 트랙 C) — 이 문장이 두 번 고쳐졌고 옛 값을 지우지 않는다.** " +
    "라운드 92 B가 127로, 리뷰 H-3이 124로 적었고 오늘은 **114**다. H-3이 *'남는 124의 성격은 둘'* " +
    "이라며 이름 붙인 갈래 ⓑ(**행이면서도 이 바늘 밖인 자리**)를 오늘 넷째 바늘이 **값으로** 풀었다: " +
    "`.map(` 안에서 바로 그려지는 **행꼴 컴포넌트**가 열셋이고 그 본문의 식 라벨 **열**이 들어왔다 " +
    "(빠른 품목 타일·준비템 카드·구매 링크 행 둘·분류 칩·더보기 행·초대 행·**설정 목록 행**· " +
    "달력 날짜 칸 둘). ⚠️⚠️ **두 시점(라운드 93 리뷰 M-9)**: 이 열거는 **아홉뿐이었다** — " +
    "`설정 목록 행`(`src/design-system/components/ApplicationPrimitives.tsx`의 `ListRow`)이 " +
    "빠져 있었고, **수는 옳았는데 이름이 하나 모자랐다.** " +
    "⚠️ **그래서 남는 114의 성격도 여전히 하나가 아니다**: 대부분(오늘 재실측으로 **107**)은 정말 " +
    "행이 아닌 자리(화면 머리말·요약 카드·시트·탭바처럼 한 화면에 한 번 서는 컨트롤)이고, **일곱**은 " +
    "여전히 *행이면서 밖*이다 — 그 일곱이 무엇인지는 아래 사각이 이름과 꼴로 적는다. " +
    "**114는 여전히 *묻지 않은 수*이지만, 그중 묻지 못한 부분은 이제 37이 아니라 일곱이다.**",
  "⚠️⚠️ **넷째 바늘이 따라가지 못하는 꼴 — 오늘 일곱 자리이고, 그 일곱을 꼴로 적는다**(라운드 93 " +
    "트랙 C의 재실측: `.map(` 안에서 그려지고 선언까지 이어지는 컴포넌트 **24**, 그중 식 라벨을 지닌 " +
    "것 **14** · 자리 **17** — 바늘이 **열**을 데려오고 **일곱**이 남는다). ⓐ **여섯은 이름이 " +
    "*행꼴*이 아니다** — `ExpenseCategoryIconButton`(분류 아이콘 버튼) · `PrimaryButton` · " +
    "`SecondaryButton` · `TextButton`(공용 버튼 셋의 `accessibilityLabel` 프롭 자리) · " +
    "`ChildDateField`의 둘. **이름 판정(`ROW_SHAPED_NAME_WORDS`)이 문턱이고, 그 문턱을 넓히는 일은 " +
    "이 라운드의 축이 아니다**(넓히면 버튼 한 벌이 통째로 들어오고 *행마다 갈리는가*라는 질문이 " +
    "버튼에게는 뜻이 달라진다). ⓑ **하나는 행꼴 이름인데 프롭 연결이 0이다** — " +
    "`src/preparation/PreparationListParity.tsx`의 `ItemGrid`는 `.map(` 안에서 그려지지만 라벨이 " +
    "`${columns}열 준비 품목`이라 행이 아니라 **격자 자체**를 읽는다(그 자리는 실제로 갈리지 않는 " +
    "것이 옳다). ⚠️ 이 사각의 오차 방향은 **조용한 쪽**이다 — 모집단 밖이라 빨개지지 않는다.",
  "⚠️ **옛 시점의 기록 — 지우지 않는다(AE-3의 관례).** 라운드 92 리뷰 H-3이 남긴 사각 ⓐ의 " +
    "두 번째 시점은 이렇게 적혀 있었다: *목록 **밖**의 낭독 라벨 124(그때 식 전수 162 − 목록 안 38)는 " +
    "이 축이 묻지 않는다.* ⚠️⚠️ **두 시점 — " +
    "라운드 92 리뷰 H-3이 이 문장을 고쳤다.** 종전에는 *'그 자리들에는 행이라는 단위가 없어 질문 자체가 " +
    "성립하지 않는다'* 라고 값으로 적었는데 **그것이 거짓이었다** — 가상화 목록의 행 라벨 셋(기록 탭 지출 " +
    "행·기록 탭 섹션 헤더·가져오기 검수의 잠긴 행)이 정확히 *행*이면서 그 127 안에 앉아 있었고, 오늘 " +
    "셋째 바늘이 그 셋을 데려왔다. **남는 124의 성격은 하나가 아니라 둘이다**: ⓐ 대부분은 정말 행이 아닌 " +
    "자리다(화면 머리말·요약 카드·버튼·시트·탭바처럼 한 화면에 한 번 서는 컨트롤). ⓑ 그러나 **행이면서도 " +
    "이 바늘 밖인 자리가 남아 있다** — 목록 콜백도 `renderItem={이름}`도 아닌 경로로 행을 그리는 자리 " +
    "(예: `useCallback`으로 만든 렌더 함수, 행 컴포넌트가 다시 부르는 하위 컴포넌트의 라벨). 그 둘을 가르는 " +
    "일은 이 축이 아직 하지 않았고, 그래서 124는 *묻지 않은 수*이지 *물을 것이 없는 수*가 아니다.",
  "`accessibilityLabel` 없이 **자식 텍스트로** 읽히는 목록 행은 모집단 밖이다 — 오늘 모집단 전수의 " +
    "`<Pressable` 145 가운데 여는 태그에 라벨이 없는 것이 23이고, 그 층은 이 바늘에 걸리지 않는다.",
  "**행 변수 이름으로 판정하고 파생은 한 걸음까지만** 따라간다 — 두 걸음 이상 거치는 자리와 " +
    "바깥 목록의 행 변수를 쓰는 안쪽 자리는 *갈리지 않는다*로 떨어질 수 있다. ⚠️ 그 한계의 오차 방향은 " +
    "**거짓 빨강(안전)**이다: 실제로 갈리는 자리를 갈리지 않는다고 세면 래칫이 빨개지고 사람이 본다. " +
    "⚠️⚠️ **두 시점 — 라운드 92 리뷰 H-3이 이 문장에서 한 가지를 덜어 냈다.** 종전에는 이 *거짓 빨강* " +
    "하나로 이 축의 오차를 다 적은 셈이었는데, **모집단에 들어오지도 못하는 자리는 빨개지지 않고 조용했다** " +
    "— `.map(` 뒤에 줄이 바뀌는 꼴(오늘 이 모집단에 콜백 둘 · 라벨 자리는 0건)과 `renderItem={이름}` 꼴이 " +
    "그랬다. 오늘 바늘이 둘 다 잡으므로 **그 조용한 갈래는 닫혔고**, 남는 한계는 ⓐ 파생 두 걸음(거짓 빨강) " +
    "과 ⓑ **이름을 따라가지 못하는 선언 꼴**(`useCallback`으로 만든 렌더 함수 · 별칭 두 걸음)이다. " +
    "⚠️ ⓑ는 여전히 **조용한 쪽**이고, 오늘 그 실피해는 0건이다(그 꼴로 선 렌더 함수 하나가 있지만 그 " +
    "화면의 식 라벨이 0건이라 잃는 자리가 없다). " +
    "⚠️⚠️ **세 번째 시점(라운드 93 트랙 C) — H-3의 *'그 조용한 갈래는 닫혔고'* 는 절반만 참이었다.** " +
    "그때 닫힌 것은 **렌더 프롭 쪽의 조용한 갈래**였고, `.map(` 안에서 **바로 그려지는 행꼴 컴포넌트** " +
    "쪽은 그대로 조용했다(그 실피해가 0건이 아니라 **열 자리**였음을 오늘 넷째 바늘이 값으로 보였다). " +
    "오늘 남는 조용한 쪽은 위의 **일곱**이고, 이번에는 *0건*이 아니라 **이름과 꼴로** 적혀 있다.",
  "⚠️ **넷째 바늘이 *구조적으로* 못 보는 것 넷**(오늘의 일곱과 다른 층이다 — 저것은 실측이고 이것은 " +
    "설계다). ⓐ **`.map(` 밖에서 그려지는 행꼴 컴포넌트** — 부모가 배열을 펼치지 않고 한 번만 그리면 " +
    "이 바늘에 걸리지 않는다(*행*이라는 단위가 호출부에 없으므로 오늘은 그것이 옳다). " +
    "ⓑ **프롭을 다시 넘기는 두 걸음** — 행꼴 컴포넌트가 받은 프롭을 하위 컴포넌트에 넘기고 라벨이 " +
    "거기서 서면 밖이다. ⚠️ 이 한계의 오차 방향은 **거짓 빨강(안전)**이다: 컴포넌트 본문 안에서 " +
    "두 걸음을 거치면 *갈리지 않는다*로 떨어져 래칫이 빨개지고 사람이 본다. " +
    "ⓒ **모듈 걸음이 둘까지다**(같은 파일 → import 한 줄 → 재수출 한 줄). `export *` 배럴과 " +
    "재수출 두 겹, 그리고 상대 경로가 아닌 지정자는 **해석되지 않고 조용히 밖**이다(오늘 그 꼴로 " +
    "잃은 행꼴 컴포넌트는 0건이다). ⓓ **프롭이 펼침(`{...row}`)으로만 들어오는 자리** — 프롭 이름이 " +
    "태그에 없으므로 *행을 받은 프롭*이 0이 되고 그 컴포넌트는 모집단 밖이다.",
  "**소스 대조이지 런타임이 아니다** — TalkBack이 실제로 행마다 다르게 읽는지, 같은 문장이 두 행에서 " +
    "겹치지 않는지는 실기기 확인 항목의 몫이다. 이 스윕이 보는 것은 라벨 식이 행을 읽는가 하나다.",
  "**재개 조건(사건형 · 자기 축을 적는다): *행마다 갈리지 않는* 자리가 처음 1건이 되는 날** — 그날의 " +
    "일은 새 관측이 아니라 `ROW_INVARIANT_REASONS`에 그 자리의 이유를 적거나 라벨을 고치는 것이고, " +
    "**그 일을 집는 트랙은 이 스윕을 소유한 트랙(a11y 그물의 그 라운드 축)이다.**"
] as const;

describe("GAP-092 #2 행마다 갈리는 낭독 라벨 전수 스윕 (세 라운드 미배정을 끊는 축)", () => {
  it("ⓐ 모집단 — 손 목록이 아니라 app·src 전수가 라벨 식과 목록 안의 자리를 정한다", () => {
    const sweep = rowLabelSweep();
    // 유령 방지 ①: 걷는 파일이 실제로 있다(스캔이 끊기면 아래 부정 단언이 영원히 초록이다).
    expect(sweep.files.length, "app·src의 컴포넌트 소스 전수").toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.files);
    expect(sweep.files.length, "유령 방지 — 모집단이 한 줌이 아니다").toBeGreaterThan(20);
    // 유령 방지 ②: **모집단이 0건이 아니다.** 이 두 줄이 이 스윕의 값 절반이다.
    expect(sweep.labels, "식으로 만드는 낭독 라벨 전수").toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.labels);
    expect(sweep.rows.length, "그중 목록 콜백 안의 자리").toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.listSites);
    expect(sweep.rows.length, "유령 방지 — 목록 안이 0건이 아니다").toBeGreaterThan(0);
    // 목록 **밖**은 이 축이 묻지 않는다 — 그 수를 값으로 적어 둔다(사각 ⓐ).
    expect(sweep.labels - sweep.rows.length, "목록 밖의 낭독 라벨").toBeGreaterThanOrEqual(
      ROW_LABEL_RATCHET.labels - ROW_LABEL_RATCHET.listSites
    );
    // ⚠️ 상수 라벨은 **다른 수**다 — 합산하지 않는다(머리말의 그 규율을 값으로 지킨다).
    expect(sweep.constants, "상수 문자열 라벨(모집단 밖)").toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.constants);
    expect(sweep.constants, "그리고 그 수는 식 라벨의 수가 아니다").not.toBe(sweep.labels);
    // 걷는 파일 수를 함께 센다 — 목록 안 자리가 한 파일에 몰려 있지 않다는 사실도 값이다.
    // ⚠️⚠️ **두 시점** — H-3 뒤에는 **18**이었고, 넷째 바늘이 공용 키트 파일 셋(디자인 시스템 둘 ·
    // 달력 하나)을 데려와 오늘 **21**이다. 하한이므로 옛 값이 아니라 오늘 값이 바닥이 된다.
    const filesWithRows = new Set(sweep.rows.map((site) => site.file));
    expect(filesWithRows.size, "목록 안 자리를 지닌 파일 수").toBeGreaterThanOrEqual(21);
  });

  it("ⓑ 판정 셋 — 자리마다 하나가 소스에서 나오고, *갈리지 않는다*는 0건이다", () => {
    const sites = rowLabelSweep().rows;
    const verdicts = sites.map((site) => ({ key: rowLabelKey(site), verdict: rowLabelVerdictOf(site), site }));

    // ⚠️⚠️ **부정 단언** — 행마다 갈리지 않는 자리는 오늘 0건이다. 서는 날 이름으로 보여 준다.
    const invariant = verdicts.filter((entry) => entry.verdict === "row-invariant");
    expect(invariant.map((entry) => entry.key), "행마다 갈리지 않는 자리").toEqual([]);
    // ⚠️ 빈 이유 금지 — 그 자리가 서는 날, 이유를 소스가 증명해야 한다.
    expect(Object.keys(ROW_INVARIANT_REASONS), "갈리지 않는 자리의 이유 표").toEqual([]);
    for (const entry of invariant) {
      expect(ROW_INVARIANT_REASONS[entry.key], `${entry.key}가 갈리지 않아도 되는 이유`).toBeTruthy();
      expect((ROW_INVARIANT_REASONS[entry.key] ?? "").length, `${entry.key}의 이유 길이`).toBeGreaterThan(40);
    }

    const counts: Record<RowLabelVerdict, number> = { "row-direct": 0, "row-derived": 0, "row-invariant": 0 };
    for (const { verdict } of verdicts) counts[verdict] += 1;
    // 판정 셋은 **전수를 남김없이 가른다** — 넷째 갈래가 조용히 생기지 않는다.
    expect(counts["row-direct"] + counts["row-derived"] + counts["row-invariant"], "판정이 붙은 자리").toBe(
      sites.length
    );
    expect(counts["row-direct"], "행 변수를 직접 쓰는 자리").toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.direct);
    expect(counts["row-derived"], "행에서 파생한 이름을 거치는 자리").toBeGreaterThanOrEqual(
      ROW_LABEL_RATCHET.derived
    );

    // 파생 자리는 오늘 둘이고, 그 파일 이름을 값으로 적는다(사람이 다시 찾아갈 수 있게).
    const derived = verdicts.filter((entry) => entry.verdict === "row-derived");
    expect(derived.map((entry) => entry.site.file), "파생 판정이 선 파일").toContain(ROW_DERIVED_SITE_FILE);
    // ⚠️ 리뷰 H-3이 데려온 둘째 파생 — **행 컴포넌트**가 prop `row`에서 만든 이름을 라벨 식이 읽는다.
    const componentDerived = derived.find((entry) => entry.site.file === ROW_DERIVED_COMPONENT_FILE);
    expect(componentDerived, `${ROW_DERIVED_COMPONENT_FILE}의 파생 자리`).toBeTruthy();
    expect(componentDerived!.site.kind, "그 자리를 문 바늘").toBe("row-component");
    expect(componentDerived!.site.rows, "그 행 컴포넌트의 prop 이름들").toContain("row");
    expect(rowDerivedNamesOf(componentDerived!.site).sort(), "그 자리가 거치는 중간 이름").toEqual([
      "category",
      "display"
    ]);
    const familyDerived = derived.find((entry) => entry.site.file === ROW_DERIVED_SITE_FILE);
    expect(familyDerived, `${ROW_DERIVED_SITE_FILE}의 파생 자리`).toBeTruthy();
    // 중간 이름도 손이 아니라 소스에서 나온다 — 행 `invite`가 낳은 두 이름이다.
    expect(rowDerivedNamesOf(familyDerived!.site).sort(), "그 자리가 거치는 중간 이름").toEqual([
      "createdAtLabel",
      "roleLabel"
    ]);
    expect(familyDerived!.site.rows, "그 목록의 행 변수").toEqual(["invite"]);
    // ⚠️ 그리고 그 행 변수는 라벨 식에 **없다** — 직접 판정으로 세어졌다면 이 줄이 빨개진다.
    expect(mentionsIdentifier(familyDerived!.site.expr, "invite"), "행 변수가 라벨 식에 직접 있는가").toBe(false);
  });

  it("ⓒ 파생의 증명 — 한 걸음 거쳐 갈리는 자리를 *갈리지 않는다*로 세면 거짓 초록이 된다", () => {
    const verdictOfFixture = (body: string) => {
      const found = rowLabelSitesOf(`export function Fixture({ rows }) {\n  return (\n    <View>\n${body}\n    </View>\n  );\n}\n`, "fixture");
      expect(found.rows.length, "픽스처가 목록 안 자리를 하나 낸다").toBe(1);
      return { verdict: rowLabelVerdictOf(found.rows[0]), site: found.rows[0], labels: found.labels };
    };

    // ① 직접 — 행 변수가 라벨 식에 그대로 있다.
    const direct = verdictOfFixture("      {rows.map((row) => (<Pressable accessibilityLabel={`${row.name} 삭제`} />))}");
    expect(direct.verdict, "행 변수를 직접 쓰는 자리").toBe("row-direct");
    expect(direct.site.rows, "행 이름").toEqual(["row"]);

    // ②⚠️⚠️ **한 걸음 파생** — 라운드 91 A가 25→27을 겪은 그 자리다. 행 변수가 라벨 식에 **없지만**
    // 그 이름이 행에서 나온다. 이 갈래가 없으면 이 자리는 *갈리지 않는다*로 세어져 **거짓 초록**이 된다.
    const derived = verdictOfFixture(
      "      {rows.map((row) => {\n        const label = buildLabel(row.name);\n        return <Pressable accessibilityLabel={label} />;\n      })}"
    );
    expect(derived.verdict, "한 걸음 거쳐 갈리는 자리").toBe("row-derived");
    expect(rowDerivedNamesOf(derived.site), "그 한 걸음의 이름").toEqual(["label"]);

    // ③ 갈리지 않음 — 라벨 식이 행을 한 번도 읽지 않는다. **이 갈래가 실제로 문다**(0건이 유령이 아니다).
    const invariant = verdictOfFixture(
      "      {rows.map((row) => (<Pressable accessibilityLabel={DELETE_LABEL} />))}"
    );
    expect(invariant.verdict, "행마다 갈리지 않는 자리").toBe("row-invariant");

    // ④ `renderItem` 바늘 — 오늘 저장소에 0건이라 픽스처가 그 바늘이 문다는 것을 대신 증명한다.
    const viaRenderItem = rowLabelSitesOf(
      "<FlatList data={rows} renderItem={({ item }) => <Pressable accessibilityLabel={item.name} />} />",
      "fixture"
    );
    expect(viaRenderItem.rows.length, "renderItem 안의 자리").toBe(1);
    expect(viaRenderItem.rows[0].kind, "그 자리를 문 바늘").toBe("renderItem");
    expect(rowLabelVerdictOf(viaRenderItem.rows[0]), "그 자리의 판정").toBe("row-direct");
    // ⚠️⚠️ **세 시점 — 오늘 이 저장소의 목록 자리를 문 바늘은 하나가 아니다**(H-3 · 트랙 C).
    //  · 라운드 92 트랙 B 커밋 시점: 전부 `.map`이었다(그때는 그것이 참이었다).
    //  · 라운드 92 리뷰 H-3 뒤: 인라인 `.map`과 **가상화 목록의 행 컴포넌트**(`row-component`) 둘.
    //  · 오늘(라운드 93 트랙 C): 거기에 **`.map(`이 바로 그리는 행꼴 컴포넌트**(`map-component`)가
    //    더해져 셋이다.
    expect(new Set(rowLabelSweep().rows.map((site) => site.kind)), "오늘 목록 자리를 문 바늘").toEqual(
      new Set(["map", "row-component", "map-component"])
    );

    // ⑤ 가장 안쪽이 이긴다 — 중첩 목록에서 *행*은 안쪽의 것이다.
    const nested = rowLabelSitesOf(
      "{groups.map((group) => group.rows.map((row) => <Pressable accessibilityLabel={row.name} />))}",
      "fixture"
    );
    expect(nested.rows.length, "중첩 목록의 자리").toBe(1);
    expect(nested.rows[0].rows, "가장 안쪽 콜백의 행 이름").toEqual(["row"]);

    // ⑥ 목록 **밖**은 이 모집단이 아니다(사각 ⓐ가 값으로 적은 그 층).
    const outside = rowLabelSitesOf("<Pressable accessibilityLabel={screenTitle} />", "fixture");
    expect(outside.labels, "식 라벨로는 세어진다").toBe(1);
    expect(outside.rows, "그러나 목록 안은 아니다").toEqual([]);

    // ⑦ 상수 라벨은 바늘에 걸리지 않는다 — 두 수가 섞이지 않는다는 증명.
    const constant = rowLabelSitesOf('{rows.map((row) => <Pressable accessibilityLabel="삭제" />)}', "fixture");
    expect(constant.labels, "상수 라벨은 식 라벨로 세어지지 않는다").toBe(0);
    expect(constant.rows, "그러므로 목록 안 자리도 아니다").toEqual([]);

    // ⑧ 두 걸음은 따라가지 않는다 — 오차 방향이 **거짓 빨강(안전)**임을 값으로 남긴다(사각 ⓒ).
    const twoSteps = verdictOfFixture(
      "      {rows.map((row) => {\n        const middle = pick(row);\n        const label = build(middle);\n        return <Pressable accessibilityLabel={label} />;\n      })}"
    );
    expect(twoSteps.verdict, "두 걸음 거쳐 갈리는 자리(한계)").toBe("row-invariant");

    // ⑨⚠️⚠️ **셋째 바늘(리뷰 H-3)** — `renderItem={이름}`으로 넘긴 **모듈 스코프 렌더 함수**와
    //   그 함수가 그리는 **행 컴포넌트 본문**이 모집단이다. 이 바늘이 없으면 아래 라벨은 *목록 밖*으로
    //   세어져 **질문조차 받지 못한다**(거짓 초록이 아니라 통째로 조용한 자리가 된다).
    const viaRenderFn = rowLabelSitesOf(
      [
        "const Row = memo(function Row({ expense }: { expense: Expense }) {",
        "  return <Pressable accessibilityLabel={rowLabel(expense.itemName)} />;",
        "});",
        "function renderRow({ item }: ListRenderItemInfo<Item>) {",
        "  return <Row expense={item.expense} />;",
        "}",
        "export function Screen() {",
        "  return <FlatList data={rows} renderItem={renderRow} />;",
        "}"
      ].join("\n"),
      "fixture"
    );
    expect(viaRenderFn.rows.length, "행 컴포넌트 안의 자리").toBe(1);
    expect(viaRenderFn.rows[0].kind, "그 자리를 문 바늘").toBe("row-component");
    expect(viaRenderFn.rows[0].rows, "행 컴포넌트의 prop 이름(타입 표기를 걷었다)").toEqual(["expense"]);
    expect(rowLabelVerdictOf(viaRenderFn.rows[0]), "그 자리의 판정").toBe("row-direct");

    // ⑩ 그리고 **그 갈래가 실제로 문다** — 같은 모양에서 라벨을 고정 문자열 식으로 바꾸면
    //    *갈리지 않는다*로 떨어진다(교란 재현의 모양 그대로다).
    const frozen = rowLabelSitesOf(
      [
        "const Row = memo(function Row({ expense }: { expense: Expense }) {",
        "  return <Pressable accessibilityLabel={ROW_LABEL} />;",
        "});",
        "function renderRow({ item }: ListRenderItemInfo<Item>) {",
        "  return <Row expense={item.expense} />;",
        "}",
        "export function Screen() {",
        "  return <FlatList data={rows} renderItem={renderRow} />;",
        "}"
      ].join("\n"),
      "fixture"
    );
    expect(frozen.rows.length, "고정 라벨도 모집단 안이다").toBe(1);
    expect(rowLabelVerdictOf(frozen.rows[0]), "고정 문자열 식으로 바꾼 행 라벨").toBe("row-invariant");

    // ⑪ `renderSectionHeader={이름}`도 같은 바늘이다(기록 탭의 날짜 헤더가 그 꼴이다).
    const viaSectionHeader = rowLabelSitesOf(
      [
        "const Header = memo(function Header({ section }: { section: Section }) {",
        "  return <View accessibilityLabel={section.headerLabel} />;",
        "});",
        "function renderHeader({ section }: { section: SectionListData<Item, Section> }) {",
        "  return <Header section={section} />;",
        "}",
        "export function Screen() {",
        "  return <SectionList sections={s} renderSectionHeader={renderHeader} />;",
        "}"
      ].join("\n"),
      "fixture"
    );
    expect(viaSectionHeader.rows.length, "섹션 헤더 안의 자리").toBe(1);
    expect(rowLabelVerdictOf(viaSectionHeader.rows[0]), "그 자리의 판정").toBe("row-direct");

    // ⑫ `.map(` 뒤의 **줄바꿈 꼴**도 같은 자리다(종전 바늘은 `.map((` 붙은 꼴만 봤다).
    const mapAcrossLines = rowLabelSitesOf(
      "{rows.map(\n  (row) => <Pressable accessibilityLabel={row.name} />\n)}",
      "fixture"
    );
    expect(mapAcrossLines.rows.length, "줄바꿈 꼴의 목록 자리").toBe(1);
    expect(rowLabelVerdictOf(mapAcrossLines.rows[0]), "그 자리의 판정").toBe("row-direct");
  });

  it("ⓒ' 셋째 바늘이 실제 소스에서 무는 자리 셋 — 이름과 판정으로 서 있다 (리뷰 H-3)", () => {
    const componentSites = rowLabelSweep().rows.filter((site) => site.kind === "row-component");
    // 오늘 셋이고, 그 셋이 어느 화면의 무엇인지 파일 이름으로 서 있다.
    expect(componentSites, "행 컴포넌트 바늘이 문 자리").toHaveLength(3);
    expect(componentSites.map((site) => site.file).sort(), "그 셋이 선 파일").toEqual([
      "app/(tabs)/records.tsx",
      "app/(tabs)/records.tsx",
      ROW_DERIVED_COMPONENT_FILE
    ]);
    // ⚠️ 그 셋은 **가상화 목록의 행**이다 — 그 화면들이 `renderItem={이름}` 꼴을 쓴다는 사실도 값이다.
    for (const file of ["app/(tabs)/records.tsx", ROW_DERIVED_COMPONENT_FILE]) {
      expect(maskComments(source(file)), `${file}가 모듈 스코프 렌더 함수를 넘긴다`).toMatch(
        /renderItem=\{\s*[A-Za-z_$][\w$]*\s*\}/
      );
    }
    expect(maskComments(source("app/(tabs)/records.tsx")), "기록 탭이 섹션 헤더 렌더 함수를 넘긴다").toMatch(
      /renderSectionHeader=\{\s*[A-Za-z_$][\w$]*\s*\}/
    );
    // 그리고 그 셋의 판정이 전부 *행마다 갈린다* 쪽이다(둘은 직접, 하나는 한 걸음 파생).
    const verdicts = componentSites.map((site) => rowLabelVerdictOf(site)).sort();
    expect(verdicts, "그 셋의 판정").toEqual(["row-derived", "row-direct", "row-direct"]);
  });

  it("ⓒ'' 넷째 바늘 — `.map(`이 그리는 행꼴 컴포넌트의 본문을 물고, 그 조건 넷이 값으로 선다 (트랙 C)", () => {
    const fixture = (lines: string[]) => rowLabelSitesOf(lines.join("\n"), "fixture");

    // ① 문다 — 행꼴 이름 + 호출부가 `.map(` 안 + 행을 받은 프롭. 셋이 맞으면 **본문**이 모집단이다.
    const bites = fixture([
      "function ItemCard({ title, onPress }) {",
      "  return <Pressable accessibilityLabel={`${title} 열기`} onPress={onPress} />;",
      "}",
      "export function Screen({ rows }) {",
      "  return <View>{rows.map((row) => <ItemCard key={row.id} title={row.title} onPress={() => open(row)} />)}</View>;",
      "}"
    ]);
    expect(bites.rows.length, "행꼴 컴포넌트 본문의 자리").toBe(1);
    expect(bites.rows[0].kind, "그 자리를 문 바늘").toBe("map-component");
    // ⚠️ **프롭 이름 → 파라미터가 한 걸음**이다: 호출부가 행을 실어 준 프롭 이름만 *행*이 된다.
    expect(bites.rows[0].rows.sort(), "행으로 세어진 파라미터").toEqual(["onPress", "title"]);
    expect(rowLabelVerdictOf(bites.rows[0]), "그 자리의 판정").toBe("row-direct");

    // ② **이름이 행꼴이 아니면 밖이다** — 같은 모양인데 이름만 바꾸면 질문을 받지 못한다(사각).
    const notRowShaped = fixture([
      "function Widget({ title, onPress }) {",
      "  return <Pressable accessibilityLabel={`${title} 열기`} onPress={onPress} />;",
      "}",
      "export function Screen({ rows }) {",
      "  return <View>{rows.map((row) => <Widget key={row.id} title={row.title} onPress={() => open(row)} />)}</View>;",
      "}"
    ]);
    expect(notRowShaped.labels, "식 라벨로는 세어진다").toBe(1);
    expect(notRowShaped.rows, "그러나 목록 안은 아니다").toEqual([]);

    // ③ **행을 받은 프롭이 하나도 없으면 밖이다** — 행이 컴포넌트 안으로 들어가는 길이 안 보인다.
    const noRowProp = fixture([
      "function ItemCard({ title }) {",
      "  return <Pressable accessibilityLabel={`${title} 열기`} />;",
      "}",
      "export function Screen({ rows, heading }) {",
      "  return <View>{rows.map((row) => <ItemCard key={row.id} title={heading} />)}</View>;",
      "}"
    ]);
    expect(noRowProp.rows, "행을 실어 주지 않는 호출부").toEqual([]);

    // ④ **프롭 이름과 파라미터 이름이 어긋나면 밖이다** — 한 걸음의 연결이 끊긴 자리다.
    const nameMismatch = fixture([
      "function ItemCard({ heading }) {",
      "  return <Pressable accessibilityLabel={`${heading} 열기`} />;",
      "}",
      "export function Screen({ rows }) {",
      "  return <View>{rows.map((row) => <ItemCard key={row.id} title={row.title} />)}</View>;",
      "}"
    ]);
    expect(nameMismatch.rows, "이름이 이어지지 않는 자리").toEqual([]);

    // ⑤ **고정 라벨이면 *갈리지 않는다*로 떨어진다** — 아래 교란(실소스 한 자리)이 재현하는 모양이다.
    const frozen = fixture([
      "function ItemCard({ title, onPress }) {",
      "  return <Pressable accessibilityLabel={CARD_LABEL} onPress={onPress} />;",
      "}",
      "export function Screen({ rows }) {",
      "  return <View>{rows.map((row) => <ItemCard key={row.id} title={row.title} onPress={() => open(row)} />)}</View>;",
      "}"
    ]);
    expect(frozen.rows.length, "고정 라벨도 모집단 안이다").toBe(1);
    expect(rowLabelVerdictOf(frozen.rows[0]), "고정 문자열 식으로 바꾼 행 라벨").toBe("row-invariant");

    // ⑥ **두 걸음(하위 컴포넌트로 다시 넘김)은 밖이다** — 사각이 값으로 적은 그 경계다.
    const twoHops = fixture([
      "function CardInner({ title }) {",
      "  return <Pressable accessibilityLabel={`${title} 열기`} />;",
      "}",
      "function ItemCard({ title }) {",
      "  return <CardInner title={title} />;",
      "}",
      "export function Screen({ rows }) {",
      "  return <View>{rows.map((row) => <ItemCard key={row.id} title={row.title} />)}</View>;",
      "}"
    ]);
    expect(twoHops.rows, "두 걸음 건너 선 라벨").toEqual([]);

    // ⑦ 그리고 **행꼴 판정의 절반은 이름이다** — 그 낱말 목록이 손 목록이 아니라 값으로 서 있다.
    expect([...ROW_SHAPED_NAME_WORDS], "행꼴 이름의 낱말").toEqual(["Row", "Card", "Cell", "Tile", "Chip", "Item"]);
    expect(ROW_SHAPED_NAME_WORDS.every((word) => /^[A-Z][a-z]+$/.test(word)), "낱말은 ASCII다").toBe(true);
  });

  it("ⓒ''' 넷째 바늘이 실제 소스에서 무는 열 — 핵심 루프 셋이 그 안에 있고, 겹침은 0이다 (트랙 C)", () => {
    const sweep = rowLabelSweep();
    const mapComponent = sweep.rows.filter((site) => site.kind === "map-component");
    expect(mapComponent.length, "넷째 바늘이 문 자리").toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.mapComponentSites);
    expect(new Set(mapComponent.map((site) => site.file)).size, "그 자리가 선 파일").toBeGreaterThanOrEqual(7);

    // ⓒ **유령 방지 — 겹치지 않는다.** 넷째 바늘을 뺀 자리 수가 H-3 뒤의 38 아래로 내려가지 않는다:
    // 새 바늘이 옛 자리를 *가로챈* 것이 아니라 **더한** 것임을 값이 보인다(두 수를 한 낱말로 적지 않는다).
    expect(sweep.rows.length - mapComponent.length, "넷째 바늘 밖의 목록 안 자리(H-3 뒤의 38)").toBeGreaterThanOrEqual(
      38
    );
    // ⚠️⚠️ **여기 서 있던 `sweep.rows.length === sweep.rows.length - m + m`은 항진명제였다**
    // (라운드 93 리뷰 M-7) — 어떤 값을 넣어도 참이라 *유령 방지*를 한 글자도 하지 못했다.
    // 그 자리에 **정말 겹침을 보는 자**를 세운다: 자리의 신원은 `파일 + 오프셋`이고,
    // 같은 자리가 두 번 실리면(바늘 둘이 한 자리를 함께 물면) 이 줄이 빨개진다.
    const mapComponentKeys = mapComponent.map((site) => `${site.file}@${site.at}`);
    expect(new Set(mapComponentKeys).size, "넷째 바늘 안의 중복 자리 0").toBe(mapComponentKeys.length);
    const allKeys = sweep.rows.map((site) => `${site.file}@${site.at}`);
    expect(new Set(allKeys).size, "목록 안 자리 전체의 중복 0").toBe(allKeys.length);

    // ⚠️⚠️ **그리고 `mapComponents` 8이 오늘까지 선언만 되고 아무것도 물지 않았다**(리뷰 M-8 ·
    // 문서 #110이 그 수를 인용한다). 자리 열이 사는 **행꼴 컴포넌트의 고유 수**를 여기서 문다 —
    // ⚠️ 열 자리가 한 컴포넌트에 몰려 있어도 자리 수 하한(10)은 초록이므로, **두 수는 다른 것을
    // 지킨다**(자리가 몇인가 · 그 자리가 몇 개의 컴포넌트에 퍼져 있는가).
    // ⚠️ 컴포넌트의 신원은 **그 본문**이다 — `site.body`가 선언 자리의 몸통 전체라, 같은 파일에서
    // 본문이 같으면 같은 컴포넌트이고 다르면 다른 컴포넌트다(이름은 이 자리에 실려 오지 않는다).
    const mapComponentBodies = new Set(mapComponent.map((site) => `${site.file} ${site.body}`));
    expect(mapComponentBodies.size, "그 자리가 사는 행꼴 컴포넌트(고유 본문)").toBeGreaterThanOrEqual(
      ROW_LABEL_RATCHET.mapComponents
    );
    // 유령 방지 — 컴포넌트 수는 자리 수를 넘을 수 없다(둘이 같은 자를 재고 있지 않다).
    expect(mapComponentBodies.size).toBeLessThanOrEqual(mapComponent.length);

    // 핵심 루프 셋이 이름으로 서 있다 — 빠른 품목 타일 · 준비템 카드 · 구매 링크 행.
    for (const [file, component] of MAP_COMPONENT_LOOP_SITES) {
      expect(mapComponent.map((site) => site.file), `${component}의 본문이 모집단 안이다`).toContain(file);
      expect(maskComments(source(file)), `${component}의 선언`).toMatch(
        new RegExp(`(?:function|const)\\s+${component}\\b`)
      );
    }
    // 그리고 그 열의 판정은 전부 *행마다 갈린다* 쪽이다(여덟은 직접, 둘은 한 걸음 파생).
    const verdicts = mapComponent.map((site) => rowLabelVerdictOf(site));
    expect(verdicts.filter((verdict) => verdict === "row-direct").length, "직접").toBeGreaterThanOrEqual(8);
    expect(verdicts.filter((verdict) => verdict === "row-derived").length, "한 걸음 파생").toBeGreaterThanOrEqual(2);
    expect(verdicts.filter((verdict) => verdict === "row-invariant"), "갈리지 않는 자리").toEqual([]);

    // ⚠️⚠️ **파일 밖 갈래가 실재한다** — 준비템 카드는 `src/preparation/PreparationListParity.tsx`가
    // 그리고 본문은 디자인 시스템에 산다. 배럴(재수출 한 줄)을 건너야 이어지는 그 길을 값으로 문다.
    const parity = maskComments(source("src/preparation/PreparationListParity.tsx"));
    expect(parity, "준비템 카드를 그리는 화면").toMatch(/<PreparationItemCard/);
    expect(parity, "그 화면은 본문을 지니지 않는다").not.toMatch(/function\s+PreparationItemCard/);
    expect(mapComponent.map((site) => site.file), "본문이 사는 파일").toContain(
      "src/design-system/components/ModV1Primitives.tsx"
    );
  });

  it("ⓗ 갈래 ⓑ 재실측 — 정찰의 37이 오늘 일곱으로 줄었고, 남는 일곱은 이름으로 적혀 있다 (트랙 C)", () => {
    const sweep = rowLabelSweep();
    const inSweep = new Set(sweep.rows.map((site) => `${site.file}@${site.at}`));
    // ⚠️ **자로 잰다** — 이름 판정도 프롭 연결도 끄고 `.map(`이 그리는 컴포넌트 전수를 센다.
    const wide = new Map<string, RowComponentUsage>();
    for (const file of sweep.files) {
      for (const usage of mapDrawnRowComponentsOf(maskedSource(file), file, { anyName: true, anyProps: true })) {
        wide.set(`${usage.file}|${usage.name}`, usage);
      }
    }
    let withLabels = 0;
    let sites = 0;
    const outside: string[] = [];
    for (const usage of wide.values()) {
      const masked = maskedSource(usage.file);
      const body = masked.slice(usage.start, usage.end);
      const found = [...body.matchAll(/accessibilityLabel=\{/g)];
      if (found.length === 0) continue;
      withLabels += 1;
      sites += found.length;
      for (const match of found) {
        const at = usage.start + match.index;
        if (!inSweep.has(`${usage.file}@${at}`)) outside.push(`${usage.file} ${usage.name}`);
      }
    }
    // ⚠️⚠️ **두 시점 — 정찰의 수와 오늘의 수를 한 낱말로 적지 않는다.**
    //  · **라운드 93 정찰 표본**: 컴포넌트 **15** · 식 라벨 자리 **37**(손이 낸 **하한**이다).
    //  · **오늘 재실측**(선언까지 이어지는 것만): 컴포넌트 **24** · 라벨 지닌 것 **14** · 자리 **17**.
    //    그중 넷째 바늘이 **열**을 데려오고 **일곱**이 남는다.
    expect(wide.size, "`.map(`이 그리고 선언까지 이어지는 컴포넌트").toBeGreaterThanOrEqual(24);
    expect(withLabels, "그중 식 라벨을 지닌 것").toBeGreaterThanOrEqual(14);
    expect(sites, "그 본문들의 식 라벨 자리").toBeGreaterThanOrEqual(17);
    // 갈래 ⓑ의 **잔여**는 상한이다 — 늘면 빨개지고, 그날 사각의 일곱을 다시 적어야 한다.
    expect(outside.length, "넷째 바늘 밖에 남는 갈래 ⓑ (상한)").toBeLessThanOrEqual(7);
    expect(sites - outside.length, "넷째 바늘이 데려온 자리").toBeGreaterThanOrEqual(
      ROW_LABEL_RATCHET.mapComponentSites
    );
    // 남는 일곱은 **조용하지 않다** — 사각이 그 이름들을 글자로 적고 있다.
    const blindSpots = ROW_LABEL_SWEEP_BLIND_SPOTS.join("\n");
    for (const name of ["ExpenseCategoryIconButton", "PrimaryButton", "ChildDateField", "ItemGrid"]) {
      expect(blindSpots, `${name}이 사각에 이름으로 적혀 있다`).toContain(name);
      expect(outside.some((entry) => entry.endsWith(name)), `${name}이 실제로 그 잔여다`).toBe(true);
    }
  });

  it("ⓓ 래칫 — 갈리지 않는 자리는 0을 넘지 않고, 목록 안 자리는 줄지 않는다", () => {
    const sites = rowLabelSweep().rows;
    const invariant = sites.filter((site) => rowLabelVerdictOf(site) === "row-invariant");
    // 상한: 0에서 **늘지 않는다**(오늘의 초록이 내일 조용히 낡지 않는다).
    expect(invariant.length, "행마다 갈리지 않는 자리 (상한)").toBeLessThanOrEqual(ROW_LABEL_RATCHET.invariant);
    // 하한: 목록 안 자리는 **줄지 않는다**(목록을 지우고 초록을 얻는 길을 막는다).
    expect(sites.length, "목록 안 자리 (하한)").toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.listSites);
    expect(
      sites.filter((site) => rowLabelVerdictOf(site) !== "row-invariant").length,
      "행마다 갈리는 자리 (하한)"
    ).toBeGreaterThanOrEqual(ROW_LABEL_RATCHET.direct + ROW_LABEL_RATCHET.derived);
  });

  it("ⓔ 바이트 불변 — 이 트랙은 화면을 **0바이트** 고쳤다 (부정 단언)", () => {
    // 갈리지 않는 자리가 0건이므로 **고칠 라벨이 애초에 없다** — 그 사실이 이 줄의 근거다.
    expect(
      rowLabelSweep().rows.filter((site) => rowLabelVerdictOf(site) === "row-invariant").length,
      "고쳐야 했을 라벨"
    ).toBe(0);
    // 그리고 스윕이 세는 자리의 원문 바이트가 그대로다 — 한 글자라도 다듬었으면 여기가 빨개진다.
    for (const [file, bytes] of ROW_LABEL_UNTOUCHED_BYTES) {
      expect(source(file), `${file}: 읽기만 한 자리의 바이트`).toContain(bytes);
    }
    // ⚠️ 새 한국어 리터럴도 새 낭독도 이 트랙에서 0건이다 — 판정 이름은 전부 ASCII 열쇠다.
    expect(["row-direct", "row-derived", "row-invariant"].join(""), "판정 이름").not.toMatch(/[가-힣]/);
  });

  it("ⓕ 사각 — 이 스윕이 못 보는 것이 값과 하한으로 적혀 있다", () => {
    expect(ROW_LABEL_SWEEP_BLIND_SPOTS.length, "적어 둔 사각").toBeGreaterThanOrEqual(4);
    for (const blindSpot of ROW_LABEL_SWEEP_BLIND_SPOTS) {
      expect(blindSpot.length, "사각은 빈 문자열일 수 없다").toBeGreaterThan(40);
    }
    // 사각 ⓐ의 수는 문장이 아니라 파생이 못 박는다(손 숫자가 조용히 낡을 자리를 없앤다).
    // ⚠️⚠️ **세 시점** — 127(트랙 B) → 124(리뷰 H-3) → **114**(오늘 · 넷째 바늘). 옛 수는
    // 사각 문장 안에 두 벌 그대로 남아 있고, 여기서 무는 것은 **오늘의 하한**이다.
    const sweep = rowLabelSweep();
    expect(sweep.labels - sweep.rows.length, "사각 ⓐ가 말하는 목록 밖 114").toBeGreaterThanOrEqual(114);
    for (const past of ["127", "124"]) {
      expect(ROW_LABEL_SWEEP_BLIND_SPOTS.join("\n"), `옛 시점 ${past}이 지워지지 않았다`).toContain(past);
    }

    // 사각 ⓑ의 수도 파생이다 — 라벨 없이 자식 텍스트로 읽히는 누름 자리의 층.
    let pressables = 0;
    let withoutLabel = 0;
    for (const file of sweep.files) {
      const masked = maskComments(source(file));
      const needle = /<Pressable\b/g;
      let found: RegExpExecArray | null;
      while ((found = needle.exec(masked))) {
        pressables += 1;
        const tagEnd = openingTagEnd(masked, found.index);
        if (tagEnd < 0) continue;
        if (!masked.slice(found.index, tagEnd).includes("accessibilityLabel")) withoutLabel += 1;
      }
    }
    expect(pressables, "모집단 전수의 <Pressable").toBeGreaterThanOrEqual(145);
    expect(withoutLabel, "그중 여는 태그에 라벨이 없는 자리").toBeGreaterThanOrEqual(23);
    expect(withoutLabel, "그 층은 이 모집단보다 작다(그러나 0이 아니다)").toBeGreaterThan(0);

    // 재개 조건은 **자기 축을 적는다**(AD-5의 처방) — 그 문장이 실재하는지 값으로 묻는다.
    const reopen = ROW_LABEL_SWEEP_BLIND_SPOTS[ROW_LABEL_SWEEP_BLIND_SPOTS.length - 1];
    expect(reopen, "재개 조건").toContain("재개 조건");
    expect(reopen, "그 조건이 적은 자기 축").toContain("그 일을 집는 트랙은");
  });

  it("ⓖ 머리말의 값 — 손 핀은 한 줄도 지우지 않았고, 막던 것은 규율이 아니라 배정이었다", () => {
    // ① 손 핀(문구 축)은 그대로다. 이 파일 안의 핀 수를 **자기 소스에서** 세어 하한으로 문다.
    const own = maskComments(source("src/a11y-contract.test.ts"));
    const handPins = (own.match(/toContain\(\s*["'`][^"'`]*accessibilityLabel/g) ?? []).length;
    expect(handPins, "이 파일 안의 손 핀(문구를 무는 다른 축)").toBeGreaterThanOrEqual(56);
    // ⚠️ 그리고 두 축은 서로를 대신하지 않는다 — 손 핀은 **문구**를, 이 스윕은 **행마다 갈리는가**를
    // 묻는다. 손 핀이 무는 자리 수는 이 스윕의 모집단 수와 같지 않다.
    const sweep = rowLabelSweep();
    expect(handPins, "두 축의 수는 같지 않다").not.toBe(sweep.rows.length);

    // ② **막던 것이 배정이었다**는 증거: 이 축은 화면을 한 바이트도 고치지 않고 오늘 값으로 통과한다.
    expect(
      sweep.rows.filter((site) => rowLabelVerdictOf(site) === "row-invariant").length,
      "오늘 고쳐야 했던 자리"
    ).toBe(0);
    // ③ 이 트랙이 이 파일에서 연 축은 **하나**다 — 다른 그물의 모집단은 한 글자도 옮기지 않았다.
    expect(Object.keys(MODULE_ANNOUNCE_SITES).length, "모듈 층 스윕의 모집단(무접촉)").toBe(3);
    expect([...MODULE_ANNOUNCE_SOURCE_ROOTS], "모듈 스윕이 걷는 뿌리(무접촉)").toEqual(["src"]);
    expect(Object.keys(HALF_ANNOUNCED_SITES).length, "반쪽 프롭 스윕의 모집단(무접촉)").toBe(7);
  });
});


/* ------------------------ 라운드 95 트랙 A (#1 — 상태를 라벨과 프롭으로 두 번 말하던 자리 셋) */

/**
 * GAP-095 트랙 A(#1) — **선택 여부를 문구로 다시 말하지 않는다**를 한 자리에서 전수로.
 *
 * ## 규율은 이미 저장소 안에 있었고, 그 규율을 세운 자의 모집단이 한 자리였다
 *
 * 이 파일은 오래전부터 이렇게 적고 있었다 — *"선택 여부를 문구로 다시 말하지 않는다 — 그건
 * 상태가 진다(같은 사실을 두 번 읽지 않는다)"*(위 ONB-001 카드 절의
 * `expect(tag, "상태를 말로 다시 적지 않는다").not.toContain("선택됨")`). ⚠️⚠️ **그 자의 모집단은
 * `cardPressableTag()` 한 자리였고**(온보딩 `child-status.tsx`의 단계 카드), 저장소에는 같은 규율을
 * 어기는 자리가 **셋** 살아 있었다:
 *
 *  ① `app/expenses/new.tsx`의 빠른 품목 타일 — 라벨이 `${selected ? ". 선택됨" : ""}`을 이어 붙였다.
 *  ② `src/month-jump.ts` → `src/MonthJumpSheet.tsx` — 순수 함수가 `parts.push("선택됨")`을 했다.
 *  ③ `src/expenses/date-picker-month.ts` → `src/expenses/ExpenseDatePicker.tsx` — 같은 갈래.
 *
 * 셋 다 같은 태그에 `accessibilityState={{ selected … }}`를 함께 걸고 있었고, RN의 그 프롭은
 * 안드로이드에서 `setSelected(true)`로, iOS에서 `UIAccessibilityTraitSelected`로 내려가 **OS가
 * 스스로 "선택됨"을 읽는다**. 그 사실은 이 저장소가 이미 적어 둔 것이다 —
 * `app/(tabs)/records.tsx`의 *"TalkBack은 '리스트, 탭, 선택됨'처럼 읽는다"*(인용하되 고치지 않는다).
 * 그래서 오늘 이전의 그 셋은 **"…, 선택됨, 선택됨"** 으로 들렸다. 셋 다 핵심 루프 위에 있다
 * (①③은 1단계 지출 기록 · ②는 2단계 기록·리포트의 달 이동).
 *
 * ## 이 스윕이 하는 일 — 자를 한 자리에서 **`accessibilityState` 자리 전수**로
 *
 * 모집단은 손 목록이 아니라 **디렉터리에서 파생**한다(`apps/mobile/{app,src}`의 비테스트
 * `.ts`/`.tsx` 전수 → `accessibilityState={{`가 선 자리). 자리마다 **판정 하나**가 소스에서
 * 나오고, *어느 판정에도 안 떨어지는 자리가 0건*임을 부정 단언이 못 박는다.
 *
 * ⚠️ 라벨을 **한 걸음 파생**까지 따라간다: ②③처럼 화면이 그리는 라벨이 리터럴이 아니라 순수
 * 함수가 만든 문자열이면, 그 함수 본문까지가 이 자리의 *낭독 라벨 표면*이다. 따라가지 않으면
 * 이 스윕은 ①만 보고 ②③을 놓친다 — 즉 **자가 규율보다 좁다**는 그 병을 그대로 되풀이한다.
 *
 * ## 정찰과 갈린 수 셋 — 갈렸다는 사실 자체를 값으로 적는다 (AI-1의 일반형)
 *
 *  · ⚠️⚠️ **모집단 57 → 56 → 58.** 정찰은 `accessibilityState={{ … }}` 자리를 **57**로 적었는데,
 *    그 57에는 **주석 안의 한 자리**가 들어 있다(`app/(tabs)/reports.tsx`의 JSDoc이
 *    `accessibilityState={{ disabled: …`를 인용한다). 낭독되는 것은 주석이 아니므로 이 스윕은
 *    주석을 걷고 세고, 트랙 전 값은 **56**이었다. 오늘은 **58**이다 — 아래 ⓓ가 세우는 상태 프롭
 *    둘이 더해졌다. **정찰의 갈래별 수(disabled 18)도 같은 이유로 오늘 17이다.**
 *  · ⚠️⚠️ **"다른 넷 갈래는 0건"이 아니다.** 정찰은 비활성·체크·펼침·로딩 낱말이 낭독 라벨에 든
 *    자리를 **0건**으로 적었는데, 오늘 전수로 세니 **로딩 갈래가 둘**이다 —
 *    `src/ui/Skeleton.tsx`의 `SkeletonRow`·`SkeletonCard`가 `accessibilityLabel="불러오는 중"`을
 *    지닌다. ⚠️ **다만 그 둘은 이 축의 병이 아니다**: 상태 프롭이 아예 없어 **한 번만** 읽히고,
 *    그 라벨을 걷으면 실루엣은 이름 없는 자리가 된다. 정찰의 사각 ⓑ가 미리 물은 *"라벨로만 상태를
 *    말하는 자리의 크기"* 가 바로 이것이고, 답은 **0이 아니라 2**다(아래 ⓕ가 값으로 진다).
 *  · ⚠️⚠️ **계약 셋·핀 셋이 아니라 계약 넷·핀 여섯이었다.** 정찰은 이 트랙에 계약 **셋**을
 *    배정했는데, 소스를 다시 걸으니 그 셋 안에서 옮겨야 할 **핀**이 다섯이었고 배정표에 없던
 *    **넷째 계약**이 하나 더 있었다 — `src/keyboard-tap-guard.test.ts`의 한국어 리터럴 대장이
 *    `app/expenses/new.tsx`의 문구 수를 **등호로** 물고 있었고(54), ①이 낱말 하나를 걷으며 53이
 *    된다. ⚠️ 그 대장은 자기 주석에 *"다른 라운드가 이 화면의 문구를 정당하게 고쳤다면 그
 *    라운드가 이 대장을 함께 갱신해야 한다"* 를 미리 적어 두었고, 이 트랙이 그대로 이행했다.
 *    아래 `STATE_ECHO_PIN_MIGRATIONS`가 자리·옛 바이트·오늘의 바이트로 그 **여섯**을 진다.
 *    **손으로 센 배정은 늘 하한이다**(라운드 94 트랙 A의 그 값과 같은 얼굴).
 *  · ⚠️ **그리고 바이트를 고치지 않고 만족시킨 계약이 하나 더 있다** —
 *    `src/korean-particle-guard.test.ts`(라운드 94 트랙 A의 것)는 `app/expenses/new.tsx`의 AG-4
 *    정정 문단이 **인용한 줄 번호**가 오늘도 참인지를 소스에서 파생해 문다. ①의 두 시점 주석이
 *    그 아래 자리를 밀어 좌표가 `:1582`·`:2311`에서 `:1589`·`:2318`로 갔고, 고친 것은 **계약이
 *    아니라 제품 주석의 좌표**다(그 계약 파일은 **0바이트**). *인용은 인용당한 자리를 따라간다*.
 *
 * ⚠️⚠️ **그리고 이 걸음은 *통합이 아니라 트랙의 커밋*에 실린다** — 제품 문구를 고치는 트랙이 그
 * 문구를 바이트로 무는 계약 파일 전부를 함께 소유한다는 AI-4의 처방을 배정 단계에서 받았다.
 */

/** 이 스윕이 걷는 앱 경계. `apps/mobile/` 밖으로는 한 걸음도 나가지 않는다. */
const STATE_ECHO_SCOPE_LABEL = "apps/mobile/{app,src}/**" as const;

/** 뿌리 둘 — 화면(`app`)과 그 화면이 쓰는 순수 모듈(`src`). design-system도 빼지 않는다. */
const STATE_ECHO_ROOTS = ["app", "src"] as const;

/**
 * ⓒ **상태 낱말의 모집단 — 다섯 갈래**(선택 하나가 아니다).
 *
 * ⚠️ 0을 적지 않으면 다음 라운드가 이 축을 *선택 전용*으로 읽는다. 그래서 넷이 0건인 오늘도
 * 다섯 갈래를 전부 값으로 지고, 갈래별 수를 아래 ⓒ 절이 따로 적는다.
 * ⚠️ 이 목록은 **관례이지 문법이 아니다**(사각 ⓒ) — 다른 말로 상태를 적은 자리는 못 본다.
 */
const STATE_ECHO_WORDS: Readonly<Record<string, readonly string[]>> = {
  selected: ["선택됨"],
  disabled: ["비활성", "사용 안 함", "사용할 수 없음"],
  checked: ["체크됨", "체크 안 함", "선택 해제됨"],
  expanded: ["펼침", "펼쳐짐", "접힘", "접혀 있음"],
  busy: ["로딩 중", "불러오는 중"]
};

/** 모집단의 뿌리 — 비테스트 `.ts`/`.tsx` **전수**. ⚠️ 손 목록 금지(디렉터리가 모집단을 정한다). */
let stateEchoSourceCache: string[] | null = null;
function listStateEchoSources(): string[] {
  if (stateEchoSourceCache) return stateEchoSourceCache;
  stateEchoSourceCache = STATE_ECHO_ROOTS.flatMap((root) =>
    readdirSync(join(mobileRoot, root), { recursive: true, encoding: "utf8" })
      .filter((entry) => /(?<!\.d)\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      .map((entry) => join(root, entry))
  );
  return stateEchoSourceCache;
}

/** 한 텍스트에 든 상태 낱말들 — 갈래와 낱말을 함께 낸다(어느 갈래가 몇인지를 값으로 적으려고). */
function stateEchoWordsIn(text: string): Array<{ readonly kind: string; readonly word: string }> {
  const found: Array<{ readonly kind: string; readonly word: string }> = [];
  for (const [kind, words] of Object.entries(STATE_ECHO_WORDS)) {
    for (const word of words) if (text.includes(word)) found.push({ kind, word });
  }
  return found;
}

/** 여는 태그 안의 `accessibilityLabel` **값**. 프롭이 없으면 null — 자식 텍스트가 라벨이 되는 자리다. */
function labelValueInTag(openTag: string): string | null {
  const at = openTag.indexOf("accessibilityLabel");
  if (at < 0) return null;
  const equals = openTag.indexOf("=", at);
  if (equals < 0) return null;
  const start = equals + 1;
  const opener = openTag[start];
  if (opener === '"' || opener === "'") {
    const end = openTag.indexOf(opener, start + 1);
    return end < 0 ? null : openTag.slice(start, end + 1);
  }
  if (opener !== "{") return null;
  const end = matchingBracketAt(openTag, start);
  return end < 0 ? null : openTag.slice(start, end + 1);
}

/**
 * 함수 몸통의 여는 `{` — 인자 목록과 **객체 꼴 반환 타입**을 건너뛴다.
 *
 * ⚠️ 이 가드가 없으면 `function f(input: { … }): string { … }`에서 *인자 타입*을 몸통으로 읽는다.
 * 그 경우 ②③의 `parts.push("선택됨")`은 창 **밖**이라 스윕이 조용히 0을 낸다 — 교란 확인이 이
 * 갈래를 실제로 잡는지 아래 ⓖ가 값으로 묻는다.
 */
function functionBodyBraceAfter(masked: string, parenClose: number): number {
  let cursor = parenClose + 1;
  for (;;) {
    const brace = masked.indexOf("{", cursor);
    if (brace < 0) return -1;
    const end = matchingBracketAt(masked, brace);
    if (end < 0) return -1;
    if (!/^\s*\{/.test(masked.slice(end + 1))) return brace;
    cursor = end + 1;
  }
}

/** 한 파일이 지닌 **라벨을 만드는 함수**들 — 이름에 `accessibilityLabel`이 든 선언 전수. */
function labelBuilderBodiesOf(file: string): Map<string, string> {
  const masked = maskedSource(file);
  const bodies = new Map<string, string>();
  const declaration = /function\s+([A-Za-z0-9_$]*[Aa]ccessibility[Ll]abel[A-Za-z0-9_$]*)\s*\(/g;
  let found: RegExpExecArray | null;
  while ((found = declaration.exec(masked))) {
    const parenOpen = masked.indexOf("(", found.index);
    if (parenOpen < 0) continue;
    const parenClose = matchingBracketAt(masked, parenOpen);
    if (parenClose < 0) continue;
    const brace = functionBodyBraceAfter(masked, parenClose);
    if (brace < 0) continue;
    const end = matchingBracketAt(masked, brace);
    if (end < 0) continue;
    bodies.set(found[1], masked.slice(brace, end + 1));
  }
  return bodies;
}

/** 상대 경로 import **한 걸음**. 패키지 지정자는 이 저장소 밖이다(사각). */
function relativeModulesOf(file: string): string[] {
  const found = new Set<string>();
  for (const match of maskedSource(file).matchAll(/from\s*["'](\.[^"']*)["']/g)) {
    const resolved = moduleFileOf(file, match[1]);
    if (resolved !== null) found.add(resolved);
  }
  return [...found];
}

type StateEchoSurface = { readonly file: string; readonly name: string; readonly body: string };

/**
 * 한 자리의 **파생 라벨 표면** — 라벨이 리터럴이 아니면 그 문자열을 만든 순수 함수까지 한 걸음.
 *
 * 두 모양을 따라간다(오늘 저장소에 실재하는 둘이다):
 *  · 이름으로 든 자리 — `accessibilityLabel={accessibilityLabel}`이고 그 지역 상수가
 *    `expenseDatePickerCellAccessibilityLabel(...)`의 답이다(③). import 한 줄까지 간다.
 *  · 값이 실어 온 자리 — `accessibilityLabel={cell.accessibilityLabel}`처럼 **데이터가 문자열을
 *    이미 들고 온** 자리다(②). 만든 자리를 이름으로 짚을 수 없으므로 **한 걸음 import 전부**의
 *    라벨 함수를 표면으로 본다. ⚠️ 오차 방향은 **시끄러운 쪽**이다(사각 ⓔ).
 */
function derivedLabelSurfacesOf(file: string, labelExpression: string): StateEchoSurface[] {
  const masked = maskedSource(file);
  const names = new Set([...labelExpression.matchAll(/[A-Za-z0-9_$]+/g)].map((match) => match[0]));
  for (const name of [...names]) {
    const declared = new RegExp(`(?:const|let)\\s+${name.replace(/\$/g, "\\$")}\\s*=([^;]*);`).exec(masked);
    if (declared === null) continue;
    for (const piece of declared[1].matchAll(/[A-Za-z0-9_$]+/g)) names.add(piece[0]);
  }
  const carried = /\.\s*accessibilityLabel\b/.test(labelExpression);
  const surfaces: StateEchoSurface[] = [];
  for (const [name, body] of labelBuilderBodiesOf(file)) {
    if (carried || names.has(name)) surfaces.push({ file, name, body });
  }
  for (const module of carried ? relativeModulesOf(file) : []) {
    for (const [name, body] of labelBuilderBodiesOf(module)) surfaces.push({ file: module, name, body });
  }
  if (!carried) {
    for (const name of names) {
      if (!/[Aa]ccessibility[Ll]abel/.test(name)) continue;
      const origin = importOriginOf(masked, name, file);
      if (origin === null) continue;
      const body = labelBuilderBodiesOf(origin.file).get(origin.name);
      if (body !== undefined) surfaces.push({ file: origin.file, name: origin.name, body });
    }
  }
  return surfaces;
}

type StateEchoSite = {
  readonly file: string;
  readonly at: number;
  /** `accessibilityState={{ … }}`의 **첫 열쇠** — 갈래별 수를 이 값에서 낸다. */
  readonly key: string;
  /** 같은 태그의 낭독 라벨 식. 프롭이 없으면 null. */
  readonly labelExpression: string | null;
};

/** ⓐ **모집단** — 걷기로 파생한 `accessibilityState={{` 자리 전수(주석 안은 낭독되지 않는다). */
let stateEchoSiteCache: StateEchoSite[] | null = null;
function stateEchoSites(): StateEchoSite[] {
  if (stateEchoSiteCache) return stateEchoSiteCache;
  const sites: StateEchoSite[] = [];
  for (const file of listStateEchoSources()) {
    const masked = maskedSource(file);
    const needle = /accessibilityState=\{\{\s*([A-Za-z0-9_$]+)/g;
    let found: RegExpExecArray | null;
    while ((found = needle.exec(masked))) {
      const openTag = enclosingOpenTag(masked, found.index);
      sites.push({
        file,
        at: found.index,
        key: found[1],
        labelExpression: openTag === "" ? null : labelValueInTag(openTag)
      });
    }
  }
  stateEchoSiteCache = sites;
  return sites;
}

/** ⓑ **판정 셋** — 자리마다 정확히 하나. 넷째 칸은 없다(아래 ⓑ 절이 부정 단언으로 문다). */
type StateEchoVerdict = "state-only" | "also-in-label" | "no-label";

function stateEchoEchoedWordsOf(site: StateEchoSite): string[] {
  if (site.labelExpression === null) return [];
  const direct = stateEchoWordsIn(site.labelExpression).map((hit) => `직접:${hit.kind}:${hit.word}`);
  const derived = derivedLabelSurfacesOf(site.file, site.labelExpression).flatMap((surface) =>
    stateEchoWordsIn(surface.body).map((hit) => `파생:${surface.file}:${surface.name}:${hit.kind}:${hit.word}`)
  );
  return [...direct, ...derived];
}

function stateEchoVerdictOf(site: StateEchoSite): StateEchoVerdict {
  if (site.labelExpression === null) return "no-label";
  return stateEchoEchoedWordsOf(site).length > 0 ? "also-in-label" : "state-only";
}

/** ⓕ **바늘 밖** — 상태 프롭 없이 **라벨로만** 상태를 말하는 자리(정찰의 사각 ⓑ가 물은 크기). */
function stateEchoLabelOnlySites(): string[] {
  const sites: string[] = [];
  for (const file of listStateEchoSources()) {
    const masked = maskedSource(file);
    const needle = /accessibilityLabel\s*=/g;
    let found: RegExpExecArray | null;
    while ((found = needle.exec(masked))) {
      const openTag = enclosingOpenTag(masked, found.index);
      if (openTag === "") continue;
      const value = labelValueInTag(openTag);
      if (value === null) continue;
      const words = stateEchoWordsIn(value);
      if (words.length > 0 && !openTag.includes("accessibilityState")) {
        sites.push(`${file} ${value} ${words.map((hit) => hit.kind).join("·")}`);
      }
    }
  }
  return sites;
}

/** 낭독 라벨 **표면**의 크기 둘 — 직접(JSX 프롭 값)과 파생(라벨을 만드는 함수). */
function stateEchoLabelSurfaceSizes(): { readonly direct: number; readonly builders: number } {
  let direct = 0;
  let builders = 0;
  for (const file of listStateEchoSources()) {
    const masked = maskedSource(file);
    const needle = /accessibilityLabel\s*=/g;
    let found: RegExpExecArray | null;
    while ((found = needle.exec(masked))) {
      const openTag = enclosingOpenTag(masked, found.index);
      if (openTag !== "" && labelValueInTag(openTag) !== null) direct += 1;
    }
    builders += labelBuilderBodiesOf(file).size;
  }
  return { direct, builders };
}

/**
 * ⓗ **래칫** — 등호가 아니라 하한·상한이다.
 *
 * ⚠️ *상태를 라벨에도 적었다*만 **상한 0**이고(오늘의 초록이 내일 조용히 낡지 않는다), 나머지는
 * **하한**이다(자리를 지워서 초록을 얻는 길을 막는다). 상한 0을 올리는 손은 그날 이 줄에
 * **누가 왜 올리는지**를 함께 적어야 한다.
 */
const STATE_ECHO_RATCHET = {
  /** 오늘의 자리 전수(하한). ⚠️ 정찰 57 → 마스킹 뒤 트랙 전 56 → 트랙 뒤 **58**. */
  sites: 58,
  /** 갈래별 하한 — 첫 열쇠 기준. ⚠️ 정찰의 disabled 18에는 주석 한 자리가 들어 있었다. */
  byKey: { selected: 19, disabled: 17, expanded: 10, checked: 9, busy: 3 },
  /** *상태를 상태로만 말한다*(하한). */
  stateOnly: 49,
  /** *상태를 라벨에도 적었다* — **상한**. 트랙 전 셋 → 오늘 0. */
  alsoInLabel: 0,
  /** *여는 태그에 낭독 라벨이 없다*(자식 텍스트가 라벨이 되는 자리 · 하한). */
  noLabel: 9,
  /** 낭독 라벨 표면 둘(하한) — 이 스윕이 실제로 읽는 넓이다. */
  labelSurfaces: { direct: 235, builders: 20 },
  /** 상태 프롭 없이 라벨로만 상태를 말하는 자리 — **상한 2**(정찰은 0으로 적었다). */
  labelOnly: 2
} as const;

/**
 * ⓖ **핀 이동 대장(AI-4의 이행)** — *제품 문구를 고친 손이 그 문구를 바이트로 무는 계약을 함께
 * 옮겼다*는 사실을 **자리 · 옛 바이트 · 오늘의 바이트 셋으로** 진다(라운드 94 트랙 A의
 * `korean-particle-guard.test.ts` 대장과 같은 얼굴이고, 그 관례를 그대로 인용한다).
 *
 * ⚠️ 부정 단언은 **주석을 걷은 뒤**에 선다 — 두 시점 규율이 옛 바이트를 주석에 남기라고 하므로,
 * 걷지 않으면 정직하게 적은 손이 빨강을 맞는다.
 *
 * ⚠️⚠️ **정찰의 배정은 파일 수로도 핀 수로도 하한이었다**: 계약 **셋 → 넷** · 핀 **셋 → 여섯**.
 * 그리고 ①(`app/expenses/new.tsx`의 라벨 한 조각)의 **바이트**를 문 계약은 **0건**이다 — 그
 * 조각을 문 것은 바이트가 아니라 **수**였다(리터럴 대장의 등호 54). 그 사실도 값이고, 아래 ⓖ
 * 절이 부정 단언과 대장으로 함께 확인한다.
 */
/** 이 대장이 사는 파일 — **자기 파일의 핀**을 지는 자리가 둘이라, 위 순환을 값으로 끊는다. */
const STATE_ECHO_LEDGER_FILE = "src/a11y-contract.test.ts" as const;

const STATE_ECHO_PIN_MIGRATIONS: readonly {
  /** 옛 바이트를 물고 있던 계약 파일(`apps/mobile/` 기준 상대 경로). */
  readonly contract: string;
  /** 그 계약이 인용하던 제품 파일. */
  readonly product: string;
  readonly previousPin: string;
  readonly todayPin: string;
  readonly previousProductByte: string;
  readonly todayProductByte: string;
}[] = [
  {
    contract: "src/month-jump.test.ts",
    product: "src/month-jump.ts",
    previousPin: '.toBe("2026년 7월, 선택됨")',
    todayPin: '.toBe("2026년 7월")',
    previousProductByte: 'parts.push("선택됨");',
    todayProductByte: "if (!input.isSelectable) {"
  },
  {
    contract: "src/expenses/date-picker-month.test.ts",
    product: "src/expenses/date-picker-month.ts",
    previousPin: '.toBe("8월 12일, 선택됨")',
    todayPin: '.toBe("8월 12일")',
    previousProductByte: 'parts.push("선택됨");',
    todayProductByte: "if (!isExpenseDatePickerCellSelectable(cell, todayIso, direction)) {"
  },
  {
    // ⚠️ 문구가 아니라 **it의 이름**을 문 자리다 — 이름도 소스의 바이트이고, 이름만 옛 사실에
    // 남으면 다음 손이 그 이름을 근거로 라벨을 되돌린다.
    contract: "src/expenses/date-picker-month.test.ts",
    product: "src/expenses/date-picker-month.ts",
    previousPin: 'it("칸 라벨이 날짜·오늘·선택됨·못 누르는 이유를 말한다"',
    todayPin: 'it("칸 라벨이 날짜·오늘·못 누르는 이유를 말한다"',
    previousProductByte: 'parts.push("선택됨");',
    todayProductByte: "if (!isExpenseDatePickerCellSelectable(cell, todayIso, direction)) {"
  },
  {
    // ⚠️⚠️ 정찰의 배정표가 **핀으로는 적지 않은** 자리 둘 가운데 하나다(파일은 배정 안에 있었다).
    contract: "src/a11y-contract.test.ts",
    product: "src/expenses/ExpenseDatePicker.tsx",
    previousPin: '"<View accessible accessibilityLabel={accessibilityLabel} key={cell.key} style={cellStyle}>"',
    todayPin: 'expect(unselectableBranch, "선택 여부는 상태가 진다").toContain("accessibilityState={{ selected }}")',
    previousProductByte: "<View accessible accessibilityLabel={accessibilityLabel} key={cell.key} style={cellStyle}>",
    todayProductByte: "accessibilityState={{ selected }}"
  },
  {
    contract: "src/a11y-contract.test.ts",
    product: "src/MonthJumpSheet.tsx",
    previousPin: '"<View accessible accessibilityLabel={cell.accessibilityLabel}"',
    todayPin:
      'expect(unselectableBranch, "선택 여부는 상태가 진다").toContain("accessibilityState={{ selected: cell.isSelected }}")',
    previousProductByte: "<View accessible accessibilityLabel={cell.accessibilityLabel}",
    todayProductByte: "accessibilityState={{ selected: cell.isSelected }}"
  },
  {
    // ⚠️⚠️ **정찰의 배정표에 없던 넷째 계약이다** — 그리고 이 자리는 문구를 **바이트로** 물지
    // 않고 **수로** 물었다(한국어 리터럴 54). 바늘이 달라도 부채는 같으므로 대장이 함께 진다.
    contract: "src/keyboard-tap-guard.test.ts",
    product: "app/expenses/new.tsx",
    previousPin: '{ file: "app/expenses/new.tsx", count: 54 }',
    todayPin: '{ file: "app/expenses/new.tsx", count: 53 }',
    previousProductByte: '${selected ? ". 선택됨" : ""}',
    todayProductByte: 'accessibilityLabel={`${label}${hint ? `. ${hint}` : ""}`}'
  }
];

/** ⓔ **바이트 불변** — 이 트랙이 **읽기만** 한 자리를 원문 바이트로 못 박는다. */
const STATE_ECHO_UNTOUCHED_BYTES = [
  // 규율이 이미 옳게 선 본보기(온보딩 단계 카드) — 인용하되 한 글자도 고치지 않았다.
  ["app/(onboarding)/child-status.tsx", "accessibilityLabel={`${option.title}. ${option.description}`}"],
  // 같은 화면의 형제 — 라벨을 값에서 파생하고 상태는 프롭에만 맡긴다(오늘 옳다).
  ["app/expenses/new.tsx", "accessibilityLabel={category.label}"],
  // *OS가 상태를 읽는다*는 전제의 근거가 적힌 자리 — 인용하되 고치지 않는다(사각 ⓓ).
  ["app/(tabs)/records.tsx", '// -- TalkBack은 "리스트, 탭, 선택됨"처럼 읽는다.'],
  // 보이는 텍스트는 무변 — 가져오기 검수 요약의 "선택됨"은 **낭독 라벨이 아니라 화면 글자**다.
  ["app/import/[importJobId].tsx", "<Text style={summaryLabelStyle}>선택됨</Text>"],
  // 걷지 않은 것 둘 — hint와 *못 누르는 이유*는 상태가 지지 못하는 사실이라 라벨에 남는다.
  ["src/expenses/date-picker-month.ts", "parts.push(expenseDatePickerUnselectableHint(direction));"],
  ["app/expenses/new.tsx", '${hint ? `. ${hint}` : ""}']
] as const;

/** ⓘ **사각** — 이 스윕이 **못 보는 것**을 값과 하한으로 적는다(넷 이상). */
const STATE_ECHO_BLIND_SPOTS = [
  "ⓐ **소스 대조이지 런타임이 아니다.** TalkBack이 실제로 무엇을 읽는지는 이 파일이 답할 수 " +
    "없다 — `accessibilityState.selected`가 안드로이드 `setSelected(true)` · iOS " +
    "`UIAccessibilityTraitSelected`로 내려가 OS가 스스로 상태를 읽는다는 것은 **RN·OS의 계약**이고, " +
    "이 저장소 안의 근거는 `app/(tabs)/records.tsx`의 주석 한 줄뿐이다(*\"TalkBack은 '리스트, 탭, " +
    "선택됨'처럼 읽는다\"* — 위 바이트 불변 목록에 자리로 서 있다). ⚠️ **실기기 확인 항목이고, 그 " +
    "항목을 세우는 손은 이 트랙 밖이다.** 재개 조건(사건형): 실기기에서 셋 중 한 자리라도 상태가 " +
    "낭독되지 않으면 그날 **라벨을 되돌리는 것이 아니라** 이 사각을 값으로 고쳐 적고 다시 판정한다.",
  "ⓑ **`accessibilityState`를 아예 쓰지 않고 라벨로만 상태를 말하는 자리는 이 바늘 밖이다.** " +
    "⚠️⚠️ 정찰은 그 크기를 **0**으로 적었고 오늘 전수로 세니 **2**다 — `src/ui/Skeleton.tsx`의 " +
    "`SkeletonRow`·`SkeletonCard`(`accessibilityLabel=\"불러오는 중\"`). **두 번 읽히지 않으므로 이 " +
    "축의 병은 아니고**(프롭이 없다), 라벨을 걷으면 실루엣이 이름을 잃으므로 걷을 수도 없다. " +
    "그 자리에 `accessibilityState={{ busy: true }}`를 세워 라벨을 걷을지는 **다른 축**이다. " +
    "재개 조건(결정형 · 손은 저장소 안): 그 둘을 집는 트랙은 `src/ui/Skeleton.tsx`와 그 바이트를 " +
    "무는 계약을 함께 소유해야 하고, 이 트랙은 그 파일을 **0바이트** 고쳤다.",
  "ⓒ **상태 낱말의 목록이 관례이지 문법이 아니다.** 다섯 갈래 열두 낱말은 손이 적은 것이라, 다른 " +
    "말로 상태를 적은 자리(\"고른 항목\" · \"켜짐\" 따위)는 못 본다. ⚠️ **오차 방향은 조용한 쪽**이다 " +
    "— 못 본 자리는 위반으로 세어지지 않는다. 재개 조건(사건형): 낱말 하나가 새로 발견되면 그날 " +
    "`STATE_ECHO_WORDS`에 갈래와 함께 넣고, 상한 0이 그대로인지를 그 자리에서 다시 잰다.",
  "ⓓ **파생은 한 걸음이다.** 라벨을 만든 순수 함수까지는 따라가지만(②③), 그 함수가 또 다른 " +
    "모듈의 문자열을 이어 붙이면 두 걸음째는 못 본다. ⚠️ 그리고 *값이 실어 온 자리* " +
    "(`cell.accessibilityLabel`)에서는 만든 자리를 이름으로 짚을 수 없어 **한 걸음 import 전부**의 " +
    "라벨 함수를 표면으로 본다 — **오차 방향이 시끄러운 쪽**이라 상한 0을 넘기지 않는다(조용히 " +
    "새지 않는다). 재개 조건(결정형 · 손은 저장소 안): 두 걸음째가 필요해지는 날 이 스윕의 걸음 " +
    "수를 값으로 올리고, 올린 손이 그 자리에 누구인지를 적는다.",
  "ⓔ **이 스윕은 *문구*를 묻지 않는다.** 묻는 것은 *같은 사실을 두 번 말하는가* 하나이고, 라벨이 " +
    "무엇을 말해야 하는가는 각 모듈의 계약(`src/month-jump.test.ts` · " +
    "`src/expenses/date-picker-month.test.ts`)이 문다. 두 축은 서로를 대신하지 않으므로 이 트랙은 " +
    "그 두 파일의 핀을 **지운 것이 아니라 옮겼다**(위 `STATE_ECHO_PIN_MIGRATIONS`). " +
    "재개 조건(사건형): 그 핀들이 사라지면 이 스윕은 여전히 초록인데 문구는 아무도 안 무는 날이 온다."
] as const;

describe("GAP-095 #1 선택 상태를 두 번 말하지 않는다 (규율의 모집단을 한 자리에서 전수로)", () => {
  it("ⓐ 모집단 — `accessibilityState` 자리를 **걷기로** 파생한다 (손 목록 0건 · 갈래 다섯을 값으로)", () => {
    const sites = stateEchoSites();
    expect(listStateEchoSources().length, "걷은 소스 파일").toBeGreaterThanOrEqual(250);
    expect(STATE_ECHO_SCOPE_LABEL, "이 스윕의 경계").toContain("apps/mobile/");
    // 하한이다 — 자리가 줄면 빨개진다(자리를 지워 초록을 얻는 길을 막는다).
    expect(sites.length, "`accessibilityState={{` 자리 전수").toBeGreaterThanOrEqual(STATE_ECHO_RATCHET.sites);
    for (const [key, floor] of Object.entries(STATE_ECHO_RATCHET.byKey)) {
      const counted = sites.filter((site) => site.key === key).length;
      expect(counted, `${key} 갈래의 자리`).toBeGreaterThanOrEqual(floor);
    }
    // 갈래 다섯을 **전부** 값으로 진다 — 열쇠가 그 다섯 밖으로 나가면 여기가 빨개진다.
    expect([...new Set(sites.map((site) => site.key))].sort()).toEqual(
      Object.keys(STATE_ECHO_RATCHET.byKey).sort()
    );
    // ⚠️ 주석 안의 인용은 낭독되지 않는다 — 정찰의 57과 갈린 이유가 이 한 줄이다.
    const quoted = source("app/(tabs)/reports.tsx");
    expect(quoted, "정찰이 세었던 주석 속 한 자리").toContain("`accessibilityState={{ disabled: …");
    expect(maskComments(quoted), "그 자리는 코드가 아니다").not.toContain("`accessibilityState={{ disabled: …");
  });

  it("ⓑ 판정 셋 — 자리마다 하나가 소스에서 나오고, **넷째 칸은 0건이다**", () => {
    const sites = stateEchoSites();
    const verdicts = sites.map((site) => stateEchoVerdictOf(site));
    const counted = (verdict: StateEchoVerdict) => verdicts.filter((value) => value === verdict).length;
    // ⚠️⚠️ 어느 판정에도 안 떨어지는 자리가 0건이다(부정 단언 — 셋의 합이 모집단 전수다).
    expect(counted("state-only") + counted("also-in-label") + counted("no-label"), "판정의 합").toBe(sites.length);
    expect(verdicts.filter((value) => !["state-only", "also-in-label", "no-label"].includes(value)), "넷째 칸").toEqual([]);
    // ⚠️⚠️ **상한 0** — 트랙 전 셋이었다(①`app/expenses/new.tsx` ②`src/month-jump.ts` ③`src/expenses/date-picker-month.ts`).
    const echoed = sites.filter((site) => stateEchoVerdictOf(site) === "also-in-label");
    expect(echoed.map((site) => `${site.file}@${site.at}`), "상태를 라벨에도 적은 자리").toEqual([]);
    expect(echoed.length, "상태를 라벨에도 적은 자리 (상한)").toBeLessThanOrEqual(STATE_ECHO_RATCHET.alsoInLabel);
    // 나머지 둘은 하한이다.
    expect(counted("state-only"), "상태를 상태로만 말한다 (하한)").toBeGreaterThanOrEqual(STATE_ECHO_RATCHET.stateOnly);
    expect(counted("no-label"), "여는 태그에 낭독 라벨이 없다 (하한)").toBeGreaterThanOrEqual(STATE_ECHO_RATCHET.noLabel);
  });

  it("ⓒ 상태 낱말의 모집단은 **다섯 갈래**이고, 오늘 낭독 라벨에 든 것은 그중 하나뿐이다", () => {
    expect(Object.keys(STATE_ECHO_WORDS).sort(), "갈래 다섯").toEqual(
      ["busy", "checked", "disabled", "expanded", "selected"]
    );
    for (const [kind, words] of Object.entries(STATE_ECHO_WORDS)) {
      expect(words.length, `${kind} 갈래의 낱말`).toBeGreaterThanOrEqual(1);
    }
    // 낭독 라벨 표면 전수에서 갈래별로 센다 — 오늘 넷이 0건이고 그 0을 **값으로 적는다**.
    const perKind = new Map<string, number>(Object.keys(STATE_ECHO_WORDS).map((kind) => [kind, 0]));
    for (const file of listStateEchoSources()) {
      const masked = maskedSource(file);
      const needle = /accessibilityLabel\s*=/g;
      let found: RegExpExecArray | null;
      while ((found = needle.exec(masked))) {
        const openTag = enclosingOpenTag(masked, found.index);
        const value = openTag === "" ? null : labelValueInTag(openTag);
        if (value === null) continue;
        for (const hit of stateEchoWordsIn(value)) perKind.set(hit.kind, (perKind.get(hit.kind) ?? 0) + 1);
      }
      for (const body of labelBuilderBodiesOf(file).values()) {
        for (const hit of stateEchoWordsIn(body)) perKind.set(hit.kind, (perKind.get(hit.kind) ?? 0) + 1);
      }
    }
    // ⚠️ 선택·비활성·체크·펼침 넷은 **0**이다. 0을 적지 않으면 다음 라운드가 이 축을 선택 전용으로 읽는다.
    for (const kind of ["selected", "disabled", "checked", "expanded"]) {
      expect(perKind.get(kind), `${kind} 낱말이 낭독 라벨에 든 자리`).toBe(0);
    }
    // ⚠️⚠️ **로딩 갈래만 0이 아니다(둘)** — 정찰의 "넷 다 0건"과 갈린 자리이고, 그 둘은 프롭이 없다.
    expect(perKind.get("busy"), "로딩 낱말이 낭독 라벨에 든 자리").toBe(STATE_ECHO_RATCHET.labelOnly);
  });

  it("ⓓ 비선택 가지 — *선택됐는데 못 고르는* 갈래가 소리를 잃지 않는다 (순수 함수의 값으로)", () => {
    // 순수 함수 쪽: 선택 여부가 라벨을 **한 글자도** 바꾸지 않고, 못 고르는 이유가 대신 들어온다.
    const bounds = { todayIso: "2026-08-27", earliestYearMonth: "2025-01" };
    const chosen = buildMonthJumpYear({ year: 2026, selectedYearMonth: "2026-12", bounds });
    const beyond = chosen.cells[11];
    expect(beyond.isSelected, "고른 달이다").toBe(true);
    expect(beyond.isSelectable, "그런데 못 고른다").toBe(false);
    expect(beyond.accessibilityLabel, "라벨은 **이유**를 말한다").toContain(MONTH_JUMP_FUTURE_HINT);
    expect(beyond.accessibilityLabel, "라벨은 상태를 말하지 않는다").not.toContain("선택됨");
    // 화면 쪽: 그 가지가 상태 프롭을 진다 — 두 표면이 같은 사실을 **한 번씩** 말한다.
    const sheet = maskComments(source("src/MonthJumpSheet.tsx"));
    const branch = sheet.slice(sheet.indexOf("if (!cell.isSelectable) {"), sheet.indexOf("<Text style={labelStyle}>"));
    expect(branch.length, "가지를 소스에서 찾지 못했다").toBeGreaterThan(0);
    expect(branch, "비선택 가지의 상태 프롭").toContain("accessibilityState={{ selected: cell.isSelected }}");
    const picker = maskComments(source("src/expenses/ExpenseDatePicker.tsx"));
    const pickerBranch = picker.slice(picker.indexOf("if (!selectable) {"), picker.indexOf("{dayText}", picker.indexOf("if (!selectable) {")));
    expect(pickerBranch.length, "가지를 소스에서 찾지 못했다").toBeGreaterThan(0);
    expect(pickerBranch, "비선택 가지의 상태 프롭").toContain("accessibilityState={{ selected }}");
  });

  it("ⓔ 두 표면 — 보이는 줄과 낭독이 같은 사실을 **한 번씩** 말하고, 나머지는 바이트 불변이다", () => {
    // 보이는 줄은 값 그대로다(달 격자의 "8월" · 날짜 칸의 숫자) — 이 트랙이 픽셀을 고치지 않았다.
    expect(maskComments(source("src/MonthJumpSheet.tsx")), "보이는 줄").toContain("<Text style={labelStyle}>{cell.label}</Text>");
    expect(maskComments(source("src/expenses/ExpenseDatePicker.tsx")), "보이는 줄").toContain("{cell.day}");
    for (const [file, bytes] of STATE_ECHO_UNTOUCHED_BYTES) {
      expect(source(file), `${file}: 읽기만 한 자리의 바이트`).toContain(bytes);
    }
    // ⚠️ 새 한국어 낱말 0건 — 이 트랙이 걷은 것은 **상태 낱말 하나와 그 앞의 구분자**뿐이다.
    // ⚠️ 두 시점(라운드 95 리뷰 L-1) — 옛 단언(보존):
    // `expect(["state-only", "also-in-label", "no-label"].join(""), "판정 이름").not.toMatch(/[가-힣]/)`.
    // 여기 다시 적은 리터럴을 검사하는 항진이었다 — 오늘은 **자기 소스의 타입 선언을 읽어** 문다
    // (판정 이름을 한국어로 바꾸는 손이 실제로 빨개진다).
    const verdictDeclaration = /type StateEchoVerdict =[^\n]+/.exec(source("src/a11y-contract.test.ts"))?.[0];
    expect(verdictDeclaration, "판정 타입 선언을 찾지 못했다").toBeTruthy();
    expect(verdictDeclaration, "판정 이름").not.toMatch(/[가-힣]/);
    // 그리고 역할·프롭의 다른 칸은 그대로다(세 자리 모두 button 역할을 잃지 않았다).
    expect(source("app/expenses/new.tsx"), "①의 역할").toContain('accessibilityRole="button"');
    expect(source("app/expenses/new.tsx"), "①의 상태 프롭").toContain("accessibilityState={{ selected }}");
  });

  it("ⓕ 바늘 밖 — 라벨로만 상태를 말하는 자리의 크기를 값으로 적는다 (정찰의 0이 아니라 2다)", () => {
    const labelOnly = stateEchoLabelOnlySites();
    // 상한이다 — 늘면 빨개지고, 그날 사각 ⓑ를 다시 적어야 한다.
    expect(labelOnly.length, "라벨로만 상태를 말하는 자리 (상한)").toBeLessThanOrEqual(STATE_ECHO_RATCHET.labelOnly);
    expect(labelOnly.length, "그 자리는 0이 아니다").toBeGreaterThan(0);
    for (const site of labelOnly) expect(site, "그 자리는 실루엣이다").toContain("src/ui/Skeleton.tsx");
    // 그 파일은 이 트랙의 것이 아니다 — **0바이트** 고쳤다는 사실을 원문 바이트로 못 박는다.
    expect(source("src/ui/Skeleton.tsx"), "읽기만 했다").toContain('accessibilityLabel="불러오는 중"');
    expect(maskComments(source("src/ui/Skeleton.tsx")), "상태 프롭은 없다").not.toContain("accessibilityState");
    // 스윕이 실제로 읽는 넓이도 하한으로 적는다(표면이 좁아지면 상한 0이 공허해진다).
    const surfaces = stateEchoLabelSurfaceSizes();
    expect(surfaces.direct, "직접 라벨 표면 (하한)").toBeGreaterThanOrEqual(STATE_ECHO_RATCHET.labelSurfaces.direct);
    expect(surfaces.builders, "라벨을 만드는 함수 (하한)").toBeGreaterThanOrEqual(STATE_ECHO_RATCHET.labelSurfaces.builders);
  });

  it("ⓖ 핀 이동 — 자리·옛 바이트·오늘의 바이트 셋이 서 있고, 옛 바이트가 코드에 없다", () => {
    // ⚠️ 하한이다 — 정찰이 핀으로 적은 것은 셋이었고 소스가 낸 수는 그보다 컸다.
    expect(STATE_ECHO_PIN_MIGRATIONS.length, "대장이 지는 핀").toBeGreaterThanOrEqual(6);
    for (const pin of STATE_ECHO_PIN_MIGRATIONS) {
      expect(pin.previousPin, `${pin.contract}: 옛 바이트와 오늘의 바이트가 같다`).not.toBe(pin.todayPin);
      const contract = source(pin.contract);
      expect(contract, `${pin.contract}: 오늘의 바이트를 들고 있지 않다`).toContain(pin.todayPin);
      // ⚠️ 주석을 걷은 뒤에 문다 — 두 시점 주석 속의 옛 바이트는 *지우지 않은 것*이지 부채가 아니다.
      // ⚠️⚠️ **그리고 이 대장은 자기 파일의 핀을 둘 진다.** 그 파일에서는 옛 바이트가 대장의 *값*
      // 으로 한 번 남으므로 참인 문장은 "코드에 0건"이 아니라 **"대장의 값 하나뿐"** 이다 — 라운드
      // 94의 대장은 아홉째 핀을 대장 **밖**에 두어 같은 순환을 피했고, 여기서는 자리를 옮길 수
      // 없으므로(핀도 자도 같은 축이다) 허용치를 **값으로 적어** 끊는다.
      const maskedContract = maskComments(contract);
      if (pin.contract === STATE_ECHO_LEDGER_FILE) {
        // 남은 자리는 **전부 대장의 칸**이어야 한다 — 수를 손으로 적지 않고 줄의 꼴로 문다.
        for (const line of maskedContract.split("\n")) {
          if (!line.includes(pin.previousPin)) continue;
          expect(line.trim(), `${pin.contract}: 옛 바이트가 대장 밖에 남았다`).toMatch(
            /^(previousPin|previousProductByte):/
          );
        }
      } else {
        expect(maskedContract.split(pin.previousPin).length - 1, `${pin.contract}: 옛 바이트가 코드에`).toBe(0);
      }
      // 그리고 어느 경우든 **더는 단언되지 않는다** — 옛 바이트를 무는 `toContain(…)`이 0건이다.
      expect(maskComments(contract), `${pin.contract}: 옛 바이트를 아직 문다`).not.toContain(
        `toContain(${pin.previousPin})`
      );
      expect(contract, `${pin.contract}: 옛 바이트를 두 시점으로 남기지 않았다`).toContain(pin.previousPin);
      expect(contract, `${pin.contract}: 두 시점 표기`).toContain("두 시점");
      // 제품 쪽 — 모집단 안의 자리이고, 옛 바이트는 코드에서 사라졌다.
      expect(listStateEchoSources(), `${pin.product}: 모집단 밖이다`).toContain(pin.product);
      const product = maskedSource(pin.product);
      expect(product, `${pin.product}: 오늘의 바이트`).toContain(pin.todayProductByte);
      expect(product, `${pin.product}: 옛 바이트가 코드에 남아 있다`).not.toContain(pin.previousProductByte);
    }
    // ⚠️⚠️ **계약 파일 수도 하한이었다** — 정찰의 배정은 셋이었고 소스가 낸 것은 **넷**이다.
    const contracts = [...new Set(STATE_ECHO_PIN_MIGRATIONS.map((pin) => pin.contract))].sort();
    expect(contracts).toEqual([
      "src/a11y-contract.test.ts",
      "src/expenses/date-picker-month.test.ts",
      "src/keyboard-tap-guard.test.ts",
      "src/month-jump.test.ts"
    ]);
    // ⚠️⚠️ ①의 라벨 조각을 **바이트로** 무는 계약은 0건이었다 — 그 조각을 문 것은 **수**였다
    // (`src/keyboard-tap-guard.test.ts`의 리터럴 대장 54 → 53 · 위 여섯째 핀). 그 사실도 값이다.
    const oldQuickItemByte = '${selected ? ". 선택됨" : ""}';
    for (const file of listStateEchoSources()) {
      expect(maskedSource(file), `${file}: ①의 옛 바이트`).not.toContain(oldQuickItemByte);
    }
    expect(source("app/expenses/new.tsx"), "①의 옛 바이트는 두 시점으로 남는다").toContain(oldQuickItemByte);
    const bitesTheByte = listStateEchoSources()
      .concat(contracts)
      .filter((file) => file !== "app/expenses/new.tsx" && maskComments(source(file)).includes(`"${oldQuickItemByte}"`));
    expect(bitesTheByte, "①의 옛 바이트를 문자열로 물던 계약").toEqual([]);
    // ⚠️ 바이트를 고치지 않고 **제품 주석의 좌표**로 만족시킨 계약이 하나 더 있다(0바이트).
    const followsQuotes = source("src/korean-particle-guard.test.ts");
    expect(followsQuotes, "그 계약은 좌표를 소스에서 파생한다").toContain("인용이 인용당한 자리를 따라간다");
    expect(source("app/expenses/new.tsx"), "옮겨 적은 오늘의 좌표").toContain("`:1589`·`:2318`");
    expect(source("app/expenses/new.tsx"), "옛 좌표는 지우지 않는다").toContain("`:1561`·`:2290`");
    // ⚠️⚠️ 이 걸음이 **통합이 아니라 트랙의 커밋**에 실린다는 사실이 머리말에 값으로 있다.
    const self = source("src/a11y-contract.test.ts");
    expect(self, "머리말의 그 값").toContain("통합이 아니라 트랙의 커밋");
    expect(self, "배정 단계에서 받았다는 사실").toContain("배정 단계에서");
  });

  it("ⓗ 래칫 · ⓘ 사각 — 상한 0과 하한들이 서 있고, 못 보는 것이 이름과 재개 조건으로 적혀 있다", () => {
    expect(STATE_ECHO_RATCHET.alsoInLabel, "상한은 0이다").toBe(0);
    expect(STATE_ECHO_RATCHET.sites, "모집단 하한").toBeGreaterThanOrEqual(58);
    expect(STATE_ECHO_BLIND_SPOTS.length, "적어 둔 사각").toBeGreaterThanOrEqual(4);
    for (const blindSpot of STATE_ECHO_BLIND_SPOTS) {
      expect(blindSpot.length, "사각은 빈 문자열일 수 없다").toBeGreaterThan(80);
      // ⚠️ 재개 조건을 **자기 축과 함께** 적는다(AD-5) · 형을 괄호로 밝힌다.
      expect(blindSpot, "재개 조건").toContain("재개 조건");
    }
    const written = STATE_ECHO_BLIND_SPOTS.join("\n");
    expect(written, "형을 괄호로 밝힌 자리").toContain("재개 조건(사건형)");
    expect(written, "형을 괄호로 밝힌 자리").toContain("재개 조건(결정형 · 손은 저장소 안)");
    // 정찰과 갈린 수 셋이 **머리말에 값으로** 남아 있다(옛 값을 지우지 않는다 — 두 시점).
    const self = source("src/a11y-contract.test.ts");
    for (const past of ["모집단 57 → 56 → 58", "계약 셋·핀 셋이 아니라 계약 넷·핀 여섯이었다", "0이 아니라 2"]) {
      expect(self, `갈린 값 ${past}`).toContain(past);
    }
  });
});
