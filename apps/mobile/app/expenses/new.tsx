import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildExpenseRecordedPayload } from "../../src/analytics/events";
import { LOCAL_SESSION_TOKEN, type CategoryListItem, type Child } from "../../src/api/client";
import { buildTileCategoryIdResolver, buildTileCategoryResolver, categoryCatalog } from "../../src/categories";
/**
 * GAP-060 #7(트랙 B 몫) — 쓰기 화면의 아이 스코프 라벨. 4탭(홈·기록·준비템·리포트)이 라운드
 * 48~49에 세운 어휘를 **그대로** 재사용한다: 라벨 해석도 문장 조립도 이 순수 모듈 하나뿐이라,
 * 화면마다 "다온이의 지출 기록" 식으로 말이 갈리지 않는다.
 */
import {
  resolveChildScopeLabel,
  withChildScopeLabel,
  withSpokenChildScopeLabel
} from "../../src/children/child-switch";
/**
 * 라운드 60 트랙 B(#2) — 저장된 이 지출이 어느 구매 확인 대기의 답인가. 순수 판정은 전부
 * 그 모듈에 있고 이 화면에는 onSuccess의 호출 두 줄만 있다.
 */
import { resolvePurchaseFollowupForExpense } from "../../src/commerce/purchase-followup-resolution";
import { usePurchaseFollowupStore } from "../../src/commerce/purchase-followup.store";
import {
  addAmountPreset,
  canAddAmountPreset,
  clearAmountText,
  formatPresetChipLabel,
  presetChipAccessibilityLabel,
  QUICK_AMOUNT_PRESETS_KRW
} from "../../src/expenses/amount-presets";
import {
  AUTO_CATEGORY_CAPTION,
  isSameAutoPickedCategory,
  resolveAutoCategorySelection,
  type AutoPickedCategory
} from "../../src/expenses/category-suggestion";
// GAP-054 #7 → 라운드 54 P2-5: 달력 픽커는 지출 상세와 **같은 컴포넌트**를 쓴다(판정은 그
// 안에서 다시 순수 모듈 src/expenses/date-picker-month.ts로 내려간다).
import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";
import {
  clearQuickExpenseDraft,
  clearQuickExpenseDraftForChild,
  isQuickExpenseDraftFromOtherChild,
  readQuickExpenseDraft,
  writeQuickExpenseDraft
} from "../../src/expenses/draft-storage";
import { buildEntryContextLine } from "../../src/expenses/entry-context-line";
import {
  isAmountOverLimitForSave,
  isCategoryMissingForSave,
  resolveInitialCategoryId,
  shouldClearQuickExpenseDraftOnClose,
  shouldTileFillItemName,
  validateExpenseDateInput,
  AMOUNT_OVER_LIMIT_NOTICE,
  CATEGORY_REQUIRED_NOTICE,
  type QuickExpenseInputSnapshot
} from "../../src/expenses/entry-form-guards";
import {
  buildItemAutocompleteSuggestions,
  formatItemAutocompleteChipLabel,
  itemAutocompleteChipAccessibilityLabel,
  type ItemAutocompleteSuggestion
} from "../../src/expenses/item-autocomplete";
/**
 * GAP-056 #2 — 판매처 자동완성. 지출 상세(app/expenses/[expenseId].tsx)와 **같은 순수 모듈**을
 * 쓰고, 원천은 아래 자동완성·자동 분류가 이미 읽고 있는 이번 달 캐시 하나뿐이다(새 요청 0건).
 */
import {
  buildMerchantSuggestions,
  formatMerchantSuggestionChipLabel,
  merchantSuggestionChipAccessibilityLabel
} from "../../src/expenses/merchant-suggest";
import type { MonthExpenses } from "../../src/expenses/month-expenses";
import {
  canContinueRecording,
  CONTINUE_RECORDING_LABEL,
  CONTINUE_RECORDING_SAVED_MESSAGE,
  resolvePostSaveDestination
} from "../../src/expenses/post-save-destination";
import {
  nextQuickExpenseLimit,
  QUICK_EXPENSE_DEFAULT_LIMIT,
  quickExpenseItemsForCategory
} from "../../src/expenses/quick-expense-catalog";
import { parseExpensePrefillParams } from "../../src/expenses/record-row-actions";
import {
  isFailedRowChildMismatch,
  NO_FAILED_ROW_PREFILL_DATE,
  parseFailedRowLocalId,
  parseFailedRowPrefillText,
  resolveFailedRowPrefillDate
} from "../../src/expenses/failed-row-prefill";
import { expenseMutationErrorMessage, INVALID_EXPENSE_INPUT_ERROR } from "../../src/expenses/save-error-messages";
import {
  buildRecentItemChips,
  formatRecentItemChipLabel,
  recentItemChipAccessibilityLabel
} from "../../src/expenses/recent-items";
/**
 * GAP-058 #6 — 입력 보조 세 갈래가 함께 읽는 **제안 원천 한 벌**. 이 화면이 이미 손에 들고 있는
 * 두 배열(오프라인 스냅숏 + 이미 받아 둔 월 캐시)을 합칠 뿐이라 **새 요청은 0건**이다.
 * 규칙(아이 좁히기·삭제 대기 제외·선물/환불 제외·중복 제거·정렬)은 전부 그 순수 모듈에 있다.
 */
import { buildSuggestSourceRows, type SuggestSourceRow } from "../../src/expenses/suggest-source";
// GAP-056 #1: 텍스트 길이 상한도 금액 상한과 **같은 방식**의 단일 소스에서 온다(숫자를 여기
// 적지 않는다 — 서버 @MaxLength와 갈리면 오프라인 flush가 400으로 떨어져 영구 실패 행이 된다).
// 지출 상세(app/expenses/[expenseId].tsx)가 쓰는 그 모듈·그 문구 그대로다.
import {
  hasExpenseTextOverLimit,
  isItemNameOverLimit,
  isMemoOverLimit,
  isMerchantOverLimit,
  itemNameOverLimitMessage,
  ITEM_NAME_MAX_LENGTH,
  memoOverLimitMessage,
  MEMO_MAX_LENGTH,
  merchantOverLimitMessage,
  MERCHANT_MAX_LENGTH
} from "../../src/expenses/text-limits";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
// GAP-058 #6: "지난달"을 세는 규칙은 홈의 지난달 비교 한 줄과 **같은 함수**다 — 달 경계를
// 화면에서 다시 계산하면 12월→1월에서 두 화면이 다른 달을 가리킬 수 있다.
import { previousYearMonth } from "../../src/home/last-month-comparison";
import { amountDigitsOnly, formatAmountDigits, formatKrw } from "../../src/money";
import { isCurrentlyOnline } from "../../src/offline/connectivity";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import {
  FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE,
  FAILED_ROW_PREFILL_DATE_RESET_NOTICE
} from "../../src/offline/messages";
import { createExpenseOffline } from "../../src/offline/sync-controller";
import { useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { discardOfflineMutation } from "../../src/offline/sync-controller";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, BottomSheetFrame, CategoryChip, PrimaryButton, SecondaryButton, Toast } from "../../src/ui";
import {
  AppIcon,
  compactGridColumnCount,
  compactGridItemWidth,
  type AppIconName
} from "../../src/design-system";
import { theme } from "../../src/theme";
import { QuickExpensePixelStyles } from "../../src/pixelLock/styles";

const quickExpenseScreenId = "pixel-screen-EXP-001 EXP-001";
// FMT-127 근거 정정 (DSN-053 P1): 예전 주석은 '₩' 접두 표기가 "EXP-001 픽셀 락 캡처에 실제로
// 찍혀 있는 문자열"이라 예외로 남긴다고 적어 두었다. 그 전제가 사실과 달랐다 -- 승인 캡처의
// 원본(c20deeb `app/expenses/new.tsx`)은 `const quickExpenseAmountPreview = "38,500원";`이고,
// 캡처에 찍혀 있는 것도 '38,500원'이다. 즉 '₩' 표기는 캡처를 지키기 위한 예외가 아니라 캡처와
// **어긋난** 표기였고, src/money.ts의 "콤마+원, ₩ 금지" 규칙을 예외 없이 지키는 쪽이 기준
// 이미지와도 맞는다. 캡처 경로만 리터럴을 쓰는 구조(아래 isPixelLockAmountCapture)는 그대로다.
const quickExpenseAmountPreview = "38,500원";
// Fixed date used only when there's no session (preview / pixel-lock capture mode) so the
// pixel-lock reference screenshot stays deterministic across runs. See src/android-native-ui-quality.test.ts.
const previewExpenseDate = { iso: "2025-05-24", label: "2025. 05. 24 (토)" };
// Single source of truth for the 8 category tiles lives in src/categories.ts -- each entry
// has a distinct, deterministic `id` so tapping different tiles records different categoryIds
// (previously all 8 shared one literal id and broke category aggregation).
const quickExpenseCategories = categoryCatalog;
// UX-5B-3: 결제 수단은 서버에 enum으로 저장된다 (createExpense body.paymentMethod) --
// 실제 저장 값과 무관한 가짜 은행명("카카오뱅크") 대신 저장되는 값 그대로의 라벨을 보여준다.
const quickExpensePaymentMethods = [
  { value: "card", label: "카드" },
  { value: "cash", label: "현금" },
  { value: "transfer", label: "계좌 이체" },
  { value: "mobile_pay", label: "모바일 결제" }
] as const;

// UX-C: 지출 캐시가 아직 없을 때 쓰는 고정 빈 배열. 매 렌더 새 배열을 만들면 아래 자동 추천
// useEffect의 의존성이 매번 바뀌어 무한 재실행이 된다(react-query는 캐시가 갱신되기 전까지
// 같은 배열 참조를 돌려주므로, 캐시가 있을 때는 이미 안정적이다).
const noExpenseHistory: MonthExpenses["expenses"] = [];
// GAP-058 #6: 세션이 없을 때(픽셀 락 캡처) 통합 제안 원천이 돌려주는 고정 빈 배열. 위와 같은
// 이유로 매 렌더 새 배열을 만들지 않는다 — 이 값은 아래 useMemo의 결과로 나가고, 그 결과를
// 다시 의존성으로 받는 계산들이 있다.
const noSuggestRows: SuggestSourceRow[] = [];

/**
 * 라운드 64 #6 — 입력 보조 칩(최근 품목 · 품목 자동완성 · 판매처 자동완성)의 히트 영역.
 *
 * 칩 자신의 높이는 38이라 저장소가 스스로 정한 최소 터치 타깃(`theme.touchTarget` = 48)에
 * 10 모자란다. 그 10을 **세로로만** 갚는다 — 38 + 2×5 = 48.
 *
 * 가로를 올리지 않는 이유는 칩 사이 간격이 8이기 때문이다(`contentContainerStyle={{ gap: 8 }}`).
 * 좌우로 5씩 늘리면 이웃 칩의 히트 영역과 겹쳐(5 + 5 > 8) **옆 칩이 눌리는 오탭**이 새로
 * 생긴다 — 하나를 고치려고 다른 하나를 만드는 셈이다. 종전 값 3은 그대로 둔다: 3 + 3 < 8이라
 * 겹치지 않고, 0으로 줄이면 이 라운드의 목적과 반대로 가로 히트 영역만 좁아진다.
 *
 * `hitSlop`은 레이아웃 속성이 아니다 — 히트 영역만 넓히고 **렌더는 한 픽셀도 바뀌지 않는다**
 * (EXP-001 픽셀락 기준선 불변, 라운드 64 A가 커머스 상세 크롬에 같은 근거를 적었다).
 * 계약은 `src/a11y-contract.test.ts`가 "(높이 + 2×세로 hitSlop) ≥ theme.touchTarget"으로 붙든다.
 */
const SUGGEST_CHIP_HIT_SLOP = { bottom: 5, left: 3, right: 3, top: 5 } as const;

function formatExpenseDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return { iso: `${year}-${month}-${day}`, label: `${year}. ${month}. ${day} (${weekday})` };
}

// 라운드 68 A: 이 자리에 있던 `validateExpenseDateInput`이 `src/expenses/entry-form-guards.ts`로
// 올라갔다. 같은 함수가 이 화면과 지출 상세(`app/expenses/[expenseId].tsx`)에 **통째로 복제**돼
// 있었고, 이번 라운드가 그 판정에 과거 하한을 더하기 때문이다 — 복제를 걷지 않으면 하한이
// 처음부터 두 벌이 된다. 판정 내용·문구·호출부는 그대로다(그 모듈 주석 참고).

function buildRecentDateChips(today: Date) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const formatted = formatExpenseDate(date);
    const shortLabel = index === 0 ? "오늘" : index === 1 ? "어제" : index === 2 ? "그제" : `${date.getMonth() + 1}/${date.getDate()}`;
    return { iso: formatted.iso, shortLabel };
  });
}

// PIX-133: 보정 변환은 EXP-001 캡처 빌드 전용.
const isPixelLockCalibration = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
function quickExpensePixelFrameStyle() {
  if (!isPixelLockCalibration) return undefined;
  return {
    transform: [
      { translateX: QuickExpensePixelStyles.horizontalOffset },
      { translateY: QuickExpensePixelStyles.topOffset },
      { scale: QuickExpensePixelStyles.scale }
    ]
  } as const;
}

// DSN-053 P2-C: 타일 그리드는 승인 원본(c20deeb `app/expenses/new.tsx`:82-129)의 수치 그대로다
// -- 열 수는 화면 폭·글자 배율이 정하고(design-system/responsive), 사이 간격만 8이다.
const quickExpenseCategoryGridStyle = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  }
});

/**
 * DSN-053 P2-C — "바로 기록"·"분류별 빠른 품목"이 공유하는 타일 스타일(승인 원본과 같은 수치).
 *
 * 타일 144h · radius 16 · 선택 시 coral[50] 바탕 + mainCoral 2px 테두리, 아이콘은 44 원형
 * pill(미선택 peach 바탕 / mainCoral 글리프 → 선택 mainCoral 바탕 / 흰 글리프).
 *
 * `iconText`/`iconTextSelected`는 그리는 Text가 없는 **색·크기 토큰**이다: 아이콘 컴포넌트가
 * 이 값을 그대로 읽어 쓰므로(아래) 선택 시 반전 규칙이 한 곳에만 적힌다.
 */
const quickExpenseCategoryTileStyle = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    height: 144,
    justifyContent: "center",
    padding: 8
  },
  buttonSelected: {
    backgroundColor: theme.colors.coral[50],
    borderColor: theme.colors.mainCoral,
    borderWidth: 2
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.peach,
    borderRadius: theme.radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  iconBoxSelected: {
    backgroundColor: theme.colors.mainCoral
  },
  iconText: {
    color: theme.colors.mainCoral,
    fontSize: 22,
    fontWeight: "800"
  },
  iconTextSelected: {
    color: theme.colors.white
  },
  label: {
    color: theme.colors.brown,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    minHeight: 34,
    textAlign: "center",
    textAlignVertical: "center"
  },
  hint: {
    color: theme.colors.gray600,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center"
  }
});

type QuickExpenseCategory = (typeof quickExpenseCategories)[number];

function ExpenseCategoryIconButton({
  category,
  onPress,
  selected
}: {
  category: QuickExpenseCategory;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={category.label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        quickExpenseCategoryTileStyle.button,
        selected ? quickExpenseCategoryTileStyle.buttonSelected : null,
        { opacity: pressed ? 0.76 : 1 }
      ]}
    >
      <View style={[quickExpenseCategoryTileStyle.iconBox, selected ? quickExpenseCategoryTileStyle.iconBoxSelected : null]}>
        {/* D1 후속(실기기 피드백 2): 타일 글리프(▱ ▤ ⌘ …)를 탭바와 같은 Ionicons로 바꿨다.
            크기·색은 예전 Text 스타일 토큰(iconText / iconTextSelected)에서 그대로 읽어 쓰므로
            선택 시 흰색으로 반전되는 동작도 종전과 같다. 라벨은 바로 아래 Text와 Pressable의
            accessibilityLabel이 말하므로 아이콘 자체는 장식이다.

            DSN-053 P2-C: 이름은 계속 `src/categories.ts`의 Ionicons 이름이다 -- 그 필드는 데모
            백엔드 `GET /categories`의 `iconName`으로도 그대로 나가는 계약이라(local-backend.ts)
            화면 사정으로 바꾸지 않는다. 승인 원본의 MaterialCommunityIcons 계열은 이 카탈로그
            **밖**의 아이콘(달력·연필·chevron·빠른 품목)에서 design-system `AppIcon`으로 쓴다. */}
        <Ionicons
          accessible={false}
          name={category.icon}
          size={quickExpenseCategoryTileStyle.iconText.fontSize}
          color={
            selected
              ? quickExpenseCategoryTileStyle.iconTextSelected.color
              : quickExpenseCategoryTileStyle.iconText.color
          }
        />
      </View>
      <Text style={quickExpenseCategoryTileStyle.label}>
        {category.label}
      </Text>
    </Pressable>
  );
}

/**
 * DSN-053 P2-C — "분류별 빠른 품목" 아코디언이 펼쳤을 때 그리는 품목 타일.
 *
 * 분류 타일(위)과 같은 상자를 쓰되 아이콘 이름만 MaterialCommunityIcons(`AppIcon`)다. 품목
 * 카탈로그는 승인 원본에서 옮겨 온 것이라 이름 공간이 그쪽이고, 8타일 카탈로그의 Ionicons
 * 계약과는 서로 독립이다.
 */
function ExpenseQuickItemButton({
  hint,
  icon,
  label,
  onPress,
  selected
}: {
  hint?: string;
  icon: AppIconName;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}${hint ? `. ${hint}` : ""}${selected ? ". 선택됨" : ""}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        quickExpenseCategoryTileStyle.button,
        selected ? quickExpenseCategoryTileStyle.buttonSelected : null,
        { opacity: pressed ? 0.76 : 1 }
      ]}
    >
      <View style={[quickExpenseCategoryTileStyle.iconBox, selected ? quickExpenseCategoryTileStyle.iconBoxSelected : null]}>
        <AppIcon
          color={
            selected
              ? quickExpenseCategoryTileStyle.iconTextSelected.color
              : quickExpenseCategoryTileStyle.iconText.color
          }
          name={icon}
          size={quickExpenseCategoryTileStyle.iconText.fontSize}
        />
      </View>
      <Text style={quickExpenseCategoryTileStyle.label}>{label}</Text>
      {hint ? <Text style={quickExpenseCategoryTileStyle.hint}>{hint}</Text> : null}
    </Pressable>
  );
}

export default function NewExpenseScreen() {
  // DSN-053 P2-C: 타일 그리드의 열 수는 화면 폭과 글자 배율이 정한다(design-system/responsive의
  // 공용 규칙 -- 큰 글자 설정에서는 2열로 내려가 144h 타일의 라벨이 잘리지 않는다).
  const { fontScale, width } = useWindowDimensions();
  const expenseGridColumns = compactGridColumnCount(width, fontScale);
  const expenseGridItemWidth = compactGridItemWidth(expenseGridColumns);
  const params = useLocalSearchParams<{
    itemName?: string;
    itemTemplateId?: string;
    amountKrw?: string;
    categoryId?: string;
    from?: string;
    // 라운드 49 C-06(b): 구매 확인 카드("샀어요")가 **자기가 이미 아는 사실**을 함께 넘긴다.
    merchant?: string;
    linkedProductLinkId?: string;
    // 라운드 55 트랙 A: 정기 지출 카드의 "기록하기"가 템플릿에 저장된 결제 수단을 함께 넘긴다.
    paymentMethod?: string;
    // 라운드 58 #5: 동기화 실패 행의 "고쳐서 다시 보내기"가 그 행의 payload를 그대로 싣고 온다
    // (src/expenses/failed-row-prefill.ts). 메모·날짜는 이 진입점에서만 오는 값이고,
    // failedLocalId가 있으면 저장이 확정된 뒤 그 원본 행을 버린다(아래 onSuccess).
    memo?: string;
    spentOn?: string;
    failedLocalId?: string;
    // 라운드 58 통합리뷰 P1-1: 그 행이 **어느 아이의 기록인가**. 지금 선택된 아이와 어긋나면
    // 저장을 막고 사실을 말한다(아래 failedRowChildMismatch — 이중 방어의 둘째 겹).
    childId?: string;
  }>();
  const linkedItemTemplateId = params.itemTemplateId ? String(params.itemTemplateId) : undefined;
  /**
   * 라운드 49 C-06(b): 눌러서 산 제휴 링크 id. 저장 payload에만 실리고 화면에는 아무것도
   * 그리지 않는다(사용자가 고칠 값이 아니다).
   *
   * ⚠️ DNC-009: **기록·정산용이다.** 이 값이 추천 점수·정렬(src/items/item-ranking.ts)로
   * 흘러가면 안 된다 — 수수료가 추천 순서를 바꾸는 순간 사용자가 보는 순위가 거짓이 된다.
   */
  const linkedProductLinkId = params.linkedProductLinkId ? String(params.linkedProductLinkId) : undefined;
  /**
   * 라운드 49 C-06(b): 판매처 프리필. "샀어요"는 어느 플랫폼의 링크를 눌렀는지를 알고 있으므로
   * (쿠팡/네이버) 그 **사실만** 넘긴다 — 링크가 custom이면 상호를 모르므로 아무것도 넘기지
   * 않는다(모르는 상호를 지어내지 않는다, purchase-followup.store.ts의 라벨 판정 참고).
   * 프리필일 뿐이라 사용자가 지우거나 고쳐 쓸 수 있다.
   */
  const prefilledMerchant = params.merchant ? String(params.merchant) : "";
  // 라운드 48 T4(D1): 저장 뒤 어디로 갈지는 **어디에서 왔는지**가 정한다. 판정과 방어적 파싱은
  // 전부 순수 모듈에 있고(src/expenses/post-save-destination.ts), 모르는 값·미지정은 종전
  // 그대로 기록 탭이라 아직 `from`을 붙이지 않은 진입점의 동작은 한 글자도 바뀌지 않는다.
  const postSaveDestination = resolvePostSaveDestination(params);
  // UX-L(A): 프리필 계약이 itemName·itemTemplateId에서 amountKrw·categoryId까지 넓어졌다
  // (기록 탭 행 액션 "같은 내용으로 또 기록"). 파싱 규칙은 직렬화하는 쪽과 같은 순수 모듈에
  // 있고(src/expenses/record-row-actions.ts), 유효하지 않은 값은 조용히 버려 예전처럼 빈 칸에서
  // 시작한다 -- 링크로 들어온 값 때문에 저장 가드에 걸려 막히는 화면이 생기지 않도록.
  // 날짜는 계약에 없다: 새 기록이므로 아래 initialExpenseDate가 늘 그렇듯 오늘로 시작한다.
  const prefill = parseExpensePrefillParams(params);
  const prefilledItemName = prefill.itemName;
  /**
   * 라운드 58 #5 — "고쳐서 다시 보내기"로 들어왔는가. 값이 있으면 **그 실패 행을 다시 쓰는
   * 중**이라는 뜻이고, 저장이 확정된 뒤에만 원본을 버린다(아래 saveExpense.onSuccess).
   * 저장 전에 버리면 저장이 실패했을 때 원본도 새 기록도 없다 — 서버에 없는 행이라 되돌릴
   * 방법이 없다(이중 손실 금지).
   */
  const failedLocalId = parseFailedRowLocalId(params.failedLocalId);
  // 메모 프리필도 그 진입점에서만 온다. 다른 진입점에는 이 파라미터가 없어 빈 문자열이다
  // (= 예전 그대로 빈 칸에서 시작한다).
  const prefilledMemo = parseFailedRowPrefillText(params.memo);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  /**
   * 라운드 40 J-1 — 진입점 열 곳을 잠가도 **목적지 화면**이 그대로면 소용이 없다.
   * `wooriai:///expenses/new` 딥링크(그리고 아직 잠기지 않은 새 진입점 하나)로 이 시트에
   * 도달한 보기 전용 참여자가 저장을 누르면, 로컬 우선 저장이 "기기에 저장했어요"라고 말한
   * 뒤 flush에서 403을 받아 failed 행으로 굳는다 — UX-R(M)이 없애려던 바로 그 시퀀스다.
   *
   * 시트를 여는 것 자체는 막지 않는다: 무엇이 기록되는지 열람하는 것은 보기 전용 참여자의
   * 몫이고, 이 앱의 관례는 "잠긴 컨트롤을 지우는 대신 눌렀을 때 사실을 말한다"이다
   * (src/family/useExpenseEntryGate.ts 주석). 판정은 그 훅 하나에만 있다.
   */
  const expenseGate = useExpenseEntryGate();
  // 라운드 38 H-6/H-11: 이 화면의 8타일 id는 코드에 박힌 고정 UUID지만, 엑셀 가져오기·지출 수정
  // 화면을 거친 기록은 서버가 시드한 정식 카테고리 UUID(DB마다 다른 값)를 달고 있다. 두 값을
  // 잇는 다리가 `code`이고, 그 대응표는 리포트·수정 화면과 공유하는 ["categories"] 캐시에 이미
  // 들어 있다 -- **새 요청 없이**(useQuery가 아니라 getQueryData) 읽어 매핑만 만든다. 캐시가
  // 아직 없으면(콜드 스타트·오프라인 첫 실행) 매핑도 없고, 그때의 동작은 종전과 정확히 같다
  // (타일 id 완전 일치만 인정 -- 지어낸 분류를 쓰느니 모른다고 말한다).
  //
  // 라운드 39 I-1: 같은 캐시에서 매핑을 **두 모양**으로 만든다. 프리필(아래 H-6)은 어느 쪽이든
  // 타일 하나를 골라야 하므로 id만 주는 쪽을 쓰고, 합계를 말하는 맥락 한 줄은 "이 code는 타일이
  // 둘이라 확정할 수 없다"까지 받는 쪽을 쓴다(feeding_babyfood = 분유/유제품 + 식비).
  const queryClient = useQueryClient();
  const cachedCategories = authToken
    ? queryClient.getQueryData<{ categories: CategoryListItem[] }>(["categories"])?.categories
    : undefined;
  const resolveTileCategoryId = buildTileCategoryIdResolver(cachedCategories);
  const resolveTileCategory = buildTileCategoryResolver(cachedCategories);
  // Preview/pixel-lock capture (no session) keeps the fixed "기저귀"/"38500" seed so the
  // reference screenshot stays deterministic. A real or test session starts blank so opening
  // the sheet never silently records a 38,500원 지출 the user didn't enter (see save-button
  // disabled guard below). A session that arrived from "준비템 -> 지출 기록하고 준비 완료" prefills the
  // item name from the prepared-item template instead (see items/[itemTemplateId].tsx).
  const [itemName, setItemName] = useState(() => (authToken ? prefilledItemName : "기저귀"));
  // UX-L(A): 세션이 있으면 프리필 금액(없으면 빈 칸 -- 예전과 같다). 세션 없는 픽셀 락 캡처는
  // 프리필 자체가 올 수 없어 고정 시드 "38500" 그대로다(EXP-001 기준 이미지 불변).
  const [amountText, setAmountText] = useState(() => (authToken ? prefill.amountText : "38500"));
  /**
   * 라운드 49 C-03(a): 판매처 입력. 저장·표시·CSV·API는 이미 이 값을 전부 왕복시키고
   * 있었는데(엑셀 가져오기로 들어온 행에는 값이 있다) **입력 경로만 없어서** 앱에서 만든
   * 기록의 판매처 열은 언제나 비어 있었다 -- 마트에서 산 것과 온라인에서 산 것을 나중에
   * 구분할 방법이 없다는 뜻이다.
   *
   * EXP-001 픽셀 락: 이 상태는 세션 없이도 존재하지만 값이 늘 ""이고, **입력칸 렌더는
   * authToken 게이트 뒤**에 있다(아래). 비세션 초기 렌더("38,500원" 캡처 경로)는 한 픽셀도
   * 바뀌지 않는다.
   */
  const [merchant, setMerchant] = useState(() => (authToken ? prefilledMerchant : ""));
  /**
   * GAP-056 #2 — 판매처 칸을 **한 번이라도 건드렸는가**. 자동완성 칩 행의 게이트다.
   *
   * 초기값이 false라, 시트를 연 직후의 휴지 상태에는 이 기능이 없던 때와 한 픽셀도 다르지 않다
   * (EXP-001 픽셀 락은 세션 자체가 없어 판매처 블록이 아예 렌더되지 않지만, 세션이 있는 화면도
   * 열자마자 칩 줄이 끼어들지 않아야 한다 — 대부분의 기록은 판매처를 적지 않는다).
   *
   * 포커스가 떠날 때(onBlur) **되돌리지 않는다.** 이 화면의 스크롤러(src/ui.tsx AppScreen)는
   * `keyboardShouldPersistTaps` 기본값("never")이라, 키보드가 올라온 상태의 첫 탭은 자식에게
   * 가지 않고 키보드만 내린다. blur에서 칩을 접으면 그 첫 탭에 칩이 사라져 **두 번째 탭이
   * 맞을 자리가 없다** — 눌러도 아무 일도 일어나지 않는 칩이 된다. 그래서 칩을 눌러 채웠을 때
   * (applyMerchantSuggestion)와 "저장하고 계속 기록"의 폼 초기화에서만 접는다.
   */
  const [merchantFocused, setMerchantFocused] = useState(false);
  // 라운드 58 #5: 실패 행을 다시 쓰는 경우에만 메모가 채워져 있다. 다른 진입점·비세션(픽셀 락
  // 캡처)에서는 파라미터가 없어 종전 그대로 빈 칸이다.
  const [memo, setMemo] = useState(() => (authToken ? prefilledMemo : ""));
  // UX-L(A): 프리필 카테고리가 이 화면의 8타일로 옮겨질 때만 그 타일로 시작한다.
  // 라운드 38 H-6: 종전에는 타일 id와 **완전히 같을 때만** 복사했다. 그래서 엑셀 가져오기나 지출
  // 수정 화면을 거친 기록(= 서버 정식 카테고리 UUID)에서 "또 기록"을 누르면 품목명·금액은 따라
  // 오는데 분류만 조용히 기본 타일로 떨어졌다 -- 사용자가 방금 고른 그 기록의 분류인데도. 이제
  // 위 매핑으로 code를 거쳐 같은 분류의 타일을 찾는다. 매핑이 없으면(대응 타일이 없는 분류,
  // 캐시 없음) 프리필 없이 들어온 것과 똑같이 두고 자동 추천도 평소대로 돈다 -- 라운드 51 C-#5
  // 이후 그 상태는 "기본 타일"이 아니라 **미선택**이다(바로 아래).
  const prefilledCategoryTileId =
    authToken && prefill.categoryId ? resolveTileCategoryId(prefill.categoryId) : null;
  const prefilledCategory = prefilledCategoryTileId
    ? (quickExpenseCategories.find((category) => category.id === prefilledCategoryTileId) ?? null)
    : null;
  /**
   * 라운드 51 C-#5: 초기 선택은 **미선택(null)**이다.
   *
   * 종전에는 `prefilledCategory ?? quickExpenseCategories[0]`이라 프리필도 추천도 없는 품목이
   * 전부 첫 타일("기저귀")로 저장됐고, 그 오분류를 리포트·인사이트·홈 타일이 사실로 그렸다.
   * 이제 앱이 아는 것이 없으면 아무 타일도 누르지 않고, 저장 직전에 한 번만 고르게 한다.
   *
   * 예외 두 가지는 순수 함수(resolveInitialCategoryId)가 갖고 있다: 프리필로 분류가 함께 온
   * 경우(종전 그대로 그 타일)와 **세션 없는 픽셀 락 캡처**(EXP-001 기준 이미지가 첫 타일의
   * 선택 하이라이트를 포함하므로 비세션 초기 렌더만 종전 상태를 유지한다).
   */
  const initialCategoryId = resolveInitialCategoryId({
    hasSession: Boolean(authToken),
    prefilledCategoryId: prefilledCategory?.id ?? null,
    previewCategoryId: quickExpenseCategories[0].id
  });
  const [selectedCategory, setSelectedCategory] = useState<QuickExpenseCategory | null>(
    () => quickExpenseCategories.find((category) => category.id === initialCategoryId) ?? null
  );
  const selectedCategoryId = selectedCategory?.id ?? null;
  // DSN-053 P2-C: "분류별 빠른 품목" 아코디언 상태. 한 번에 한 분류만 펼친다(""=전부 접힘)이고,
  // 펼친 분류가 몇 개까지 보이는지는 분류별로 따로 센다(기본 6개 -> "더 보기").
  const [expandedCategoryId, setExpandedCategoryId] = useState("");
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});
  /**
   * 라운드 55 트랙 A — 결제 수단 프리필.
   *
   * 프리필이 없거나(대부분의 진입점) 모르는 값이면 `prefill.paymentMethod`가 null이고, 그때는
   * `findIndex`가 -1이라 **종전 그대로 0(카드)** 에서 시작한다. 비세션(픽셀 락 캡처 EXP-001)
   * 에서도 프리필을 보지 않으므로 기준 이미지의 선택 상태가 그대로 남는다.
   */
  const prefilledPaymentMethodIndex = authToken
    ? quickExpensePaymentMethods.findIndex((method) => method.value === prefill.paymentMethod)
    : -1;
  const [paymentMethodIndex, setPaymentMethodIndex] = useState(
    prefilledPaymentMethodIndex >= 0 ? prefilledPaymentMethodIndex : 0
  );
  const [isGift, setIsGift] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  // Kept literally as `authToken ? formatExpenseDate(today) : previewExpenseDate` (see
  // src/android-native-ui-quality.test.ts) -- this seeds the initial selected date; past-date
  // selection below can move `expenseDateIso` away from today for a real/test session.
  const initialExpenseDate = authToken ? formatExpenseDate(today) : previewExpenseDate;
  /**
   * 라운드 58 #5 — 실패 행의 지출 날짜 프리필.
   *
   * 이 화면의 프리필 계약은 여태 날짜를 싣지 않았고(record-row-actions.ts의 "날짜 미전달"),
   * "고쳐서 다시 보내기"만 그 명시적 예외다: 새로 사는 물건이 아니라 **이미 적은 그 기록**을
   * 다시 쓰는 동선이라, 오늘로 갈아 끼우면 사용자가 고른 적 없는 날짜가 기록에 남는다.
   *
   * 다만 원본 날짜가 미래면(기기 시계가 앞섰거나 자정 경계 — 그래서 400으로 실패한 바로 그
   * 행이다) 이 시트의 날짜 가드가 거부한다. 그때는 오늘로 물러서되 **말없이 바꾸지 않고**
   * 아래 안내 한 줄로 밝힌다. 판정은 순수 모듈에 있다(failed-row-prefill.ts).
   *
   * 비세션(픽셀 락 캡처)은 프리필을 보지 않는다 — EXP-001 기준 이미지의 고정 날짜 그대로다.
   */
  const prefilledSpentOn = authToken
    ? resolveFailedRowPrefillDate(params.spentOn, initialExpenseDate.iso)
    : NO_FAILED_ROW_PREFILL_DATE;
  const [expenseDateIso, setExpenseDateIso] = useState(() => prefilledSpentOn.spentOn ?? initialExpenseDate.iso);
  /**
   * 라운드 58 통합리뷰 P3-7·P3-8 — 지금 화면의 날짜를 **프리필이 정했는가**(사용자가 아직 손대지
   * 않았는가).
   *
   * 왜 `expenseDateIso === initialExpenseDate.iso`로는 부족했나(P3-7): 폴백 안내는 "오늘로
   * 두었어요"라고 말하는데, 사용자가 어제로 옮겼다가 다시 오늘 칩을 누르면 그 비교가 다시
   * 참이 되어 **이미 스스로 고른 사람에게 안내가 되살아났다**. 날짜 값이 아니라 "누가 정했는가"를
   * 물어야 하는 자리다.
   *
   * 연속 기록에서도 같은 값을 본다(P3-8): 프리필이 물려준 날짜는 다음 항목으로 승계하지 않고
   * 오늘로 되돌리고(resetFormForNextEntry), 사용자가 직접 고른 날짜는 그대로 승계한다.
   *
   * 초기값: 프리필이 날짜를 정했거나(spentOn) 정하려다 오늘로 물러선(fellBackToToday) 경우에만
   * true다. 다른 진입점에서는 언제나 false라 종전과 동작이 같다.
   */
  const [dateFollowsPrefill, setDateFollowsPrefill] = useState(
    () => prefilledSpentOn.spentOn !== null || prefilledSpentOn.fellBackToToday
  );
  const expenseDate = authToken ? formatExpenseDate(new Date(`${expenseDateIso}T00:00:00`)) : previewExpenseDate;
  // GAP-054 #7: 달력 픽커의 "오늘" 기준일. `today`는 이미 getSeoulToday()로 만든 서울 날짜라
  // 여기서 시계를 한 번 더 읽지 않는다(같은 렌더 안에서 두 날짜가 갈리지 않게).
  const todayIso = formatExpenseDate(today).iso;
  /**
   * GAP-054 #7 — 달력 버튼(P2-C가 만든 48dp `calendar-blank-outline`)이 하는 일.
   *
   * 라운드 54 P2-5: 보고 있는 달은 이제 픽커 컴포넌트(src/expenses/ExpenseDatePicker.tsx)가
   * 스스로 들고 있다. 이 화면은 **열려 있을 때만** 그것을 그리므로, 열 때마다 "지금 고른
   * 날짜의 달"에서 다시 시작하는 동작은 그대로다(지난번에 넘겨 본 달에 서 있으면 방금 칩으로
   * 고른 날짜가 화면 밖에 있는 달력이 열린다). 패널을 접는 동작도 종전 그대로다.
   */
  const toggleDatePicker = () => {
    setShowDatePicker((value) => !value);
  };
  const recentDateChips = buildRecentDateChips(today);
  // DSN-053 P2-C: 헤더 바로 아래 3칸 pill 행이 쓰는 목록. 종전 14일 칩에서 앞의 셋(오늘·어제·
  // 그제)만 잘라 **시간 순서대로** 뒤집는다 -- 왼쪽이 과거, 오른쪽이 오늘이다.
  const quickDateChips = recentDateChips.slice(0, 3).reverse();
  // Only meaningful while a real/test session is picking a manually-typed date; null means
  // either preview mode, chip-only selection, or an empty (not-yet-typed) custom field.
  const dateInputError =
    authToken && customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const paymentMethod = quickExpensePaymentMethods[paymentMethodIndex];
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  /**
   * 라운드 63 C(#4) — 이 화면의 **모든** 초안 정리 경로가 지나는 한 자리.
   *
   * 초안은 전역 키 한 벌이므로, 종전의 `clearQuickExpenseDraft()`는 지금 아이와 무관하게
   * 무엇이든 지웠다. 그래서 복원만 아이 스코프로 막으면 결과가 더 나빠진다: 둘째로 전환한 채
   * 시트를 열면 첫째의 값은 (옳게) 복원되지 않는데, 곧이어 이 화면의 정리 경로 셋 중 하나가
   * 그 초안을 지워 버린다 -- 세 곳 모두 "지금 화면에 남길 것이 없다"는 뜻이지 "다른 아이 앞에서
   * 친 것도 버려라"는 뜻이 아니었다.
   *  ① 세 칸이 모두 빈 채 디바운스가 도는 순간(라운드 48 T4 D1),
   *  ② 저장 성공 뒤,
   *  ③ 아무것도 치지 않고 닫을 때(UX-K B-a).
   *
   * 아이를 아직 모르면(선택 전·persist 하이드레이션 전) 종전 그대로 통째로 지운다 -- 그 상태의
   * 초안은 주인을 적어 두지 못했고, 여기서 남겨 봐야 누구의 것인지 끝내 알 수 없다.
   * 규칙(주인이 같거나 주인이 없을 때만 지운다)은 순수 모듈 한 곳에 있다(draft-storage.ts).
   */
  const clearDraftForCurrentChild = () =>
    childId ? clearQuickExpenseDraftForChild(childId) : clearQuickExpenseDraft();
  /**
   * GAP-060 #7 — **이 기록이 누구 앞으로 남는가**.
   *
   * 4탭은 라운드 48~49에 전부 아이 이름을 달았는데 정작 **쓰는 화면**에는 하나도 없었다.
   * 아이 선택은 전역 스토어라 이 시트가 열려 있는 동안에도 바뀌고(알림·딥링크·다른 탭),
   * 둘째를 보다가 FAB를 누른 사용자는 이 시트만 보고는 어느 아이의 지출인지 알 방법이 없다 --
   * 저장한 뒤 합계가 엉뚱한 아이 밑에서 늘어난 것을 보고서야 안다.
   *
   * **새 요청은 0건이다**(useQuery가 아니라 getQueryData): 이 시트의 오랜 계약은 "여는 것만으로
   * 네트워크가 돌지 않는다"이고(위 자동완성·자동 분류가 읽는 캐시들과 같은 규칙,
   * auto-fill-wiring.test.ts), 이름 한 조각을 붙이자고 그 계약을 깨지 않는다. 원천은 홈·기록·
   * 준비템·리포트·설정이 이미 채워 두는 그 캐시 키(["children"])다 -- 앱을 통해 이 시트에
   * 닿았다면 거의 언제나 채워져 있고, 비어 있으면(딥링크·콜드 스타트) 라벨이 null이라 화면이
   * 종전 그대로다. 모르면 말하지 않는다.
   *
   * EXP-001 픽셀 락: 캡처는 세션이 없어(authToken null) 캐시를 읽지도 않고 라벨도 null이라
   * 헤더 문자열이 한 글자도 달라지지 않는다 -- 라벨 판정 자체가 "아이 2명 이상"을 요구하므로
   * (resolveChildScopeLabel) 외동 가구의 화면도 종전과 같다.
   */
  const cachedChildren = authToken
    ? queryClient.getQueryData<{ children: Child[] }>(["children"])?.children
    : undefined;
  const childScopeLabel = resolveChildScopeLabel(childId, cachedChildren);

  // UX-C(1/2): 품목명을 치는 동안 읽는 "과거 기록"의 원천 -- 홈/기록 탭이 이미 채워 둔
  // ["expenses", childId, 이번 달] 캐시다. 여기서 새 요청은 절대 하지 않는다(useQuery가 아니라
  // getQueryData): 시트를 여는 것만으로 네트워크가 도는 일이 없고, 오프라인에서도 마지막으로
  // 받아 둔 목록으로 그대로 동작하며, 캐시가 비어 있으면 추천/자동완성이 없을 뿐 기록 흐름은
  // 아무 영향을 받지 않는다. 세션이 없는 픽셀 락 캡처에서는 애초에 읽지 않는다.
  const currentYearMonth = formatExpenseDate(today).iso.slice(0, 7);
  // UX-K(A): 캐시가 "없음"(undefined)인지 "비어 있음"([])인지를 구분해서 들고 있는다 -- 아래
  // 맥락 한 줄은 그 둘을 다르게 다뤄야 한다(콜드 스타트에 0원이라고 말하면 허위 표시다).
  // 추천/자동완성 쪽은 종전대로 안정된 빈 배열(noExpenseHistory)로 평탄화해서 쓴다.
  const cachedMonthExpenses =
    authToken && childId
      ? queryClient.getQueryData<MonthExpenses>(["expenses", childId, currentYearMonth])?.expenses
      : undefined;
  const expenseHistory = cachedMonthExpenses ?? noExpenseHistory;
  /**
   * GAP-058 #6 — **지난달 캐시**도 함께 읽는다(같은 방식: getQueryData, 새 요청 0건).
   *
   * 이번 달 캐시는 매달 1일 아침에 거의 비어 있다. 어제까지 잘 뜨던 자동완성·판매처 칩이 달이
   * 바뀌는 순간 통째로 사라지는 것이 여태의 동작이었다 — 사용자의 이력이 사라진 것이 아닌데도.
   * 홈/기록 탭이 "지난달 같은 시점 대비" 한 줄을 위해 이미 채워 두는 캐시가 있으면 그것을 읽고,
   * 없으면(콜드 스타트) 그냥 undefined다. 즉 있는 것만 쓰고 없는 것은 부르지 않는다.
   */
  const previousMonth = previousYearMonth(currentYearMonth);
  const cachedPreviousMonthExpenses =
    authToken && childId && previousMonth
      ? queryClient.getQueryData<MonthExpenses>(["expenses", childId, previousMonth])?.expenses
      : undefined;
  // 라운드 41 K-11과 같은 값(외부 스토어 구독 — 새 요청이 아니다). EXP-113 최근 칩과 UX-K(A)
  // 맥락 한 줄이 이미 읽고 있던 스냅숏을, 이제 통합 제안 원천도 함께 읽는다.
  const offlineSnapshot = useOfflineSyncSnapshot();
  /**
   * GAP-058 #6 — 품목 자동완성·판매처 칩이 함께 보는 **모집단 하나**.
   *
   * 원천은 둘뿐이다: 이 기기의 오프라인 스냅숏 행(방금 비행기 모드에서 적은 것 포함)과 이미
   * 받아 둔 서버 월 캐시 두 달치. 합치는 규칙(중복 제거·정렬)은 전부 순수 모듈에 있고 이 화면에는
   * 한 줄도 없다. 세션이 없으면(픽셀 락 캡처 EXP-001) 아예 계산하지 않는다 — 새 계산 전부가
   * authToken 뒤에 있어 비세션 초기 렌더는 한 픽셀도 바뀌지 않는다.
   *
   * useMemo인 이유: 이 화면의 입력은 전부 상태라, 키 한 번마다 두 달치 캐시와 스냅숏 전체를
   * 다시 합치고 정렬할 이유가 없다(지출 상세의 이력 재조정과 같은 판단, 라운드 42 L-5).
   */
  const suggestRows = useMemo(
    () =>
      authToken && childId
        ? buildSuggestSourceRows({
            childId,
            localRows: offlineSnapshot.rows,
            currentMonthRows: cachedMonthExpenses,
            previousMonthRows: cachedPreviousMonthExpenses
          })
        : noSuggestRows,
    [authToken, childId, offlineSnapshot.rows, cachedMonthExpenses, cachedPreviousMonthExpenses]
  );
  // 자동완성 칩 부제("· 기저귀")의 카테고리 이름. 이 화면이 실제로 선택할 수 있는 8타일일 때만
  // 붙인다 -- 엑셀 가져오기/지출 수정을 거쳐 서버 정식 카테고리(DB마다 다른 UUID)를 단 행은
  // 이 화면에서 이름을 확신할 수 없고(categoryNameFor는 그런 id를 "기타"로 떨어뜨린다), 칩에
  // 틀린 분류명을 적느니 품목명·금액만 보여 주는 편이 정직하다.
  const categoryNameForChip = (categoryId: string) =>
    quickExpenseCategories.find((category) => category.id === categoryId)?.label;

  // 사용자가 카테고리를 직접 골랐는지. 한 번이라도 손대면(타일 탭 / 최근 품목 칩 / 자동완성 칩
  // / 임시 저장 복원) 자동 추천은 그 뒤로 절대 덮어쓰지 않는다 -- 저장 직전에 분류가 조용히
  // 바뀌면 그건 사용자가 기록한 것과 다른 사실이 남는 것이다.
  // UX-L(A): "또 기록" 프리필로 8타일 안의 분류가 함께 넘어왔다면 처음부터 확정된 것으로 친다
  // -- 사용자가 방금 그 기록을 골라서 온 것이라, 품목명 기반 자동 추천이 그 분류를 조용히
  // 다른 것으로 바꿔서는 안 된다. 프리필이 없으면(일반 진입) 예전 그대로 false다.
  const categoryTouchedRef = useRef(prefilledCategory !== null);
  // 라운드 33 F3: "자동으로 골라 줬다"를 boolean이 아니라 **무엇을 어떤 이름 기준으로 골랐는지**로
  // 들고 있는다. 근거(추천)가 사라졌을 때 그 선택이 아직 기계가 고른 그대로인지 판단하려면
  // 이 두 가지가 필요하다 -- 아래 추천 effect 참고.
  const [autoPickedCategory, setAutoPickedCategory] = useState<AutoPickedCategory | null>(null);
  // 자동완성 칩으로 한 번에 채운 직후에는 같은 칩이 그대로 남지 않도록 접는다. 다시 타이핑하면
  // (handleItemNameChange) 풀린다.
  const [autocompleteApplied, setAutocompleteApplied] = useState(false);
  // UX-K(B-b): 직전에 **카테고리 타일이** 품목명 칸에 넣어 둔 라벨. 사용자가 직접 친 이름을
  // 타일 탭이 조용히 덮어쓰지 않도록 하는 판단 재료다(shouldTileFillItemName). 타이핑이나
  // 최근/자동완성 칩으로 이름이 바뀌면 그 순간부터 "타일이 넣은 값"이 아니므로 null로 되돌린다.
  const lastTileFilledItemNameRef = useRef<string | null>(null);
  // 라운드 37 G-7: 화면에 처음 들어왔을 때의 입력값(= 프리필로 채워진 값, 일반 진입이면 빈 값).
  // 닫기가 "사용자가 친 것이 있는가"를 판정할 때의 기준선이다 -- useRef라 첫 렌더의 값만 담고
  // 이후 절대 바뀌지 않으며, 비동기로 복원되는 초안은 여기에 들어오지 않는다(복원값은 기준선과
  // 달라 그대로 지켜진다). 판정 자체는 순수 함수 한 곳에만 있다(entry-form-guards.ts).
  const initialInputSnapshotRef = useRef<QuickExpenseInputSnapshot>({ itemName, amountText, memo });
  // DSN-053 P2-C: 하단 고정 요약바의 연필(품목명 수정)과 빠른 품목의 "직접 입력" 타일이 함께
  // 겨누는 입력칸. 품목명은 **한 곳에서만** 편집된다 -- 요약바에 두 번째 입력칸을 만들면 같은
  // 값을 고치는 칸이 둘이 되고, 어느 쪽이 진짜인지 화면이 말해 주지 못한다.
  const itemNameInputRef = useRef<TextInput | null>(null);

  // Restores a saved quick-expense draft on mount, so a user who closes the sheet mid-entry
  // (e.g. interrupted by a call) doesn't lose what they typed. Skipped in pixel-lock capture
  // mode, and skipped whenever the sheet was opened with an explicit prefill (typed item name
  // or a "준비템 -> 지출 기록하고 준비 완료" template link) so a stale draft never clobbers that intent.
  // Runs once on mount only -- guard conditions are read from the initial render's closure.
  useEffect(() => {
    if (!authToken) return;
    if (process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") return;
    if (prefilledItemName) return;
    if (linkedItemTemplateId) return;
    readQuickExpenseDraft().then((draft) => {
      if (!draft) return;
      /**
       * 라운드 63 C(#4) — **다른 아이 앞에서 친 초안은 복원하지 않는다.**
       *
       * 이 초안은 전역 키 한 벌인데 저장 대상은 그때그때의 전역 선택 아이다(아래 childId).
       * 첫째의 시트에서 치다 닫고 그 사이 아이가 둘째로 바뀌면(홈 헤더·아이 관리 화면, 그리고
       * 라운드 62 #2가 새로 연 알림함 전환) 여기서 첫째의 값이 프리필처럼 되살아나고, 그대로
       * 저장하면 **둘째의 지출**이 된다 -- 화면 어디에도 "이건 다른 아이 앞에서 치던 값"이라는
       * 표시가 없다. 지우지는 않는다: 첫째로 돌아오면 그 값은 그대로 살아 있어야 한다.
       *
       * 구 blob(초안에 아이가 없는 경우)과 아이를 아직 모르는 경우는 **종전 그대로 복원**된다
       * -- 판정과 그 근거는 순수 모듈 한 곳에 있다(src/expenses/draft-storage.ts).
       */
      if (isQuickExpenseDraftFromOtherChild(draft, childId)) return;
      setItemName(draft.itemName);
      setAmountText(draft.amountText);
      setMemo(draft.memo);
      const matchedCategory = quickExpenseCategories.find((category) => category.id === draft.categoryId);
      // UX-C: 복원한 분류는 사용자가 이미 보고 있던 값이므로 자동 추천이 덮어쓰지 않는다.
      // 라운드 51 C-#5: 분류가 **없는** 초안(미선택 상태로 시트를 닫은 경우)이 이제 정상적으로
      // 존재한다. 그때까지 touched로 쳐 버리면 사용자가 고른 적 없는데 자동 추천만 영구히 꺼진
      // 화면이 된다(자동완성 칩의 F3 판단과 같은 이유) -- 실제로 바꾼 경우에만 세운다.
      if (matchedCategory) {
        setSelectedCategory(matchedCategory);
        categoryTouchedRef.current = true;
      }
      /**
       * 라운드 63 C(#8): 프리필이 날짜를 정하고 들어온 경우에는 초안의 날짜가 그것을 덮지
       * 않는다. 달력의 빈 칸("8월 6일")을 눌러 온 사용자가 보는 날짜가 초안에 남아 있던 다른
       * 날로 조용히 바뀌면, 그건 사용자가 지목한 날이 아니라 앱이 고른 날이다 -- 이 시트가
       * 날짜를 다루는 규칙(record-row-actions.ts 머리말)이 막으려는 바로 그 형태다.
       * 다른 진입점에는 `spentOn`이 없어 `prefilledSpentOn.spentOn`이 null이므로 종전 그대로다.
       */
      if (draft.spentOnIso && !prefilledSpentOn.spentOn) setExpenseDateIso(draft.spentOnIso);
      setIsGift(draft.isGift);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced draft autosave: persists the in-progress quick-expense entry ~500ms after the
  // last edit, so it can be restored by the effect above if the sheet is closed before saving.
  //
  // 라운드 48 T4(D1): 세 칸이 모두 비면 초안을 **쓰는 대신 지운다**. 종전에는 빈 값이 그대로
  // 저장됐고, 그런 초안이 남으면 위 복원 effect가 다음 진입에서 그것을 읽어 아무것도 채우지
  // 않은 채 `categoryTouchedRef`만 세운다 -- 자동 분류 추천만 조용히 꺼진 화면이 된다.
  // "저장하고 계속 기록"이 폼을 비우는 순간이 정확히 그 상태라 여기서 막는다(사용자가 직접
  // 다 지운 경우에도 "복원할 것 없음"이라는 사실은 똑같으므로 동작이 어긋나지 않는다).
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!authToken) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    const hasTypedInput = Boolean(itemName.trim() || amountText.trim() || memo.trim());
    draftSaveTimerRef.current = setTimeout(() => {
      if (!hasTypedInput) {
        // 라운드 63 C(#4): 지금 아이(또는 주인 없는) 초안만 지운다 -- 위 clearDraftForCurrentChild.
        clearDraftForCurrentChild();
        return;
      }
      writeQuickExpenseDraft({
        itemName,
        amountText,
        memo,
        // 라운드 51 C-#5: 미선택이면 키 자체를 싣지 않는다 -- 빈 문자열을 적어 두면 복원할 때
        // 어느 타일도 못 찾는 값이 "분류가 있었다"는 것처럼 읽힌다.
        ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
        // 라운드 63 C(#4): **이 값을 어느 아이 앞에서 쳤는가**. 아이를 아직 모르면(선택 전·
        // persist 하이드레이션 전) 같은 규율로 키 자체를 싣지 않는다 -- 빈 문자열을 적어 두면
        // "모른다"와 "주인이 없다"가 구분되지 않고, 복원 판정이 그 둘을 다르게 다룰 수 없다.
        ...(childId ? { childId } : {}),
        spentOnIso: expenseDateIso,
        isGift
      });
    }, 500);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [itemName, amountText, memo, selectedCategoryId, expenseDateIso, isGift, authToken, childId]);

  /**
   * GAP-081 #1 — **서버 월 캐시 두 달치 한 벌**. 아래 자동 분류 effect와 최근 품목 칩(EXP-113)이
   * 함께 읽는다.
   *
   * ⚠️ 계산도 값도 라운드 58 E가 최근 칩을 위해 만든 그때 그대로다 — 이 라운드가 옮긴 것은
   * **선언의 자리** 하나뿐이라 새 배열도 새 useMemo도 새 요청도 0건이다(둘 다 getQueryData로
   * 이미 읽어 둔 캐시다).
   *
   * 자동 분류가 이 배열을 읽게 된 이유: 종전 원천은 이번 달 캐시 하나(expenseHistory)였고, 그
   * 배열은 **매달 1일 아침에 정의상 비어 있다**. 그러면 1순위(과거 기록) 갈래는 입력이 없어
   * 반드시 실패하고, 남는 것은 2순위 정적 키워드 사전 하나다. 그것도 안 걸리면 분류는 미선택이라
   * 저장 버튼이 막힌다(isCategoryMissingForSave) — 어제까지 자동으로 눌리던 타일이 오늘은
   * 사용자의 탭을 요구한다. **사용자의 이력은 하나도 사라지지 않았는데도**(형제 둘에 대해 이미
   * 적어 둔 위 GAP-058 #6 주석과 같은 사실이다).
   *
   * ⚠️ **판정 규칙은 한 글자도 바뀌지 않는다.** 넓어진 것은 원천의 **범위**(한 달 → 두 달)뿐이고
   * **성격**은 그대로다 — 둘 다 서버가 확정한 행이다. 같은 품목명의 과거 분류가 여럿일 때 누가
   * 이기는지는 순수 모듈이 이미 답을 갖고 있다(매칭 등급 우선, 동률이면 sortByRecency의 최신 행 —
   * item-name-match.ts). 두 달을 이어 붙여도 그 규칙이 답을 정한다.
   *
   * ⚠️ **오프라인 스냅숏(통합 원천 suggestRows)은 여기 넣지 않는다 — 여전히 별도 결정이다.**
   * 라운드 58 E가 미룬 질문은 둘이었는데(원천을 넓히면 판정이 달라지는가 · 아직 안 올라간 로컬
   * 행이 그 다툼에 끼는가) 이번에 닫는 것은 앞엣것 하나다. 로컬 대기 행은 서버 확정 행과 성격이
   * 다르고(플러시 전이라 취소·수정·영구 실패로 사라질 수 있다), 그런 행이 사용자 대신 타일을
   * **눌러 주는** 판정에 끼어도 되는지는 아직 아무도 재지 않았다. 그래서 자동 분류가 받는 것은
   * **성격이 같은 원천 두 달**이고, 그 사실을 계약이 부정 단언으로 지킨다(auto-fill-wiring.test.ts).
   */
  const recentItemServerRows = useMemo(
    () => [...expenseHistory, ...(cachedPreviousMonthExpenses ?? noExpenseHistory)],
    [expenseHistory, cachedPreviousMonthExpenses]
  );

  // UX-C(2/2): 품목명 -> 카테고리 자동 추천. 순수 계산(src/expenses/category-suggestion.ts)이라
  // 디바운스 없이 타이핑마다 돌려도 가볍고, 규칙은 1순위 과거 기록 / 2순위 정적 키워드 사전이다.
  // 세션이 없을 때(픽셀 락 캡처)는 아예 돌지 않는다.
  //
  // 덮어쓰기 금지: categoryTouchedRef가 true면 -- 사용자가 타일을 직접 눌렀거나, 최근/자동완성
  // 칩으로 카테고리까지 확정했거나, 임시 저장을 복원했다면 -- 추천은 손대지 않는다.
  //
  // 라운드 33 F3: 추천할 근거가 사라지면 캡션만 내리는 것으로는 부족하다. 예전에는 직전 추천으로
  // 눌려 있던 타일이 그대로 남아서, "물티슈"를 지우고 "가습기"를 친 사용자가 아무것도 하지
  // 않았는데도 기저귀/위생 분류로 저장할 수 있었다(캡션이 사라져 있으니 자동으로 골라 준 값이라는
  // 표시조차 없다). 그래서 근거가 사라지면 **기계가 고른 그 값일 때만** 초기 상태로 되돌린다 --
  // 사용자가 한 번이라도 손댔으면(categoryTouchedRef) 위에서 이미 반환했으므로 절대 건드리지 않고,
  // 되돌린 뒤에는 남는 것이 처음 상태(캡션 없음)뿐이라 아무것도 지어내지 않는다.
  //
  // 라운드 51 C-#5: 그 "처음 상태"가 첫 타일에서 **미선택(null)**로 바뀌었다 -- 그래서
  // defaultCategoryId도 null이다. 추천이 붙는 경로(키워드·과거 기록)는 한 줄도 바뀌지 않는다.
  useEffect(() => {
    if (!authToken) return;
    if (categoryTouchedRef.current) return;
    const nextSelection = resolveAutoCategorySelection({
      itemName,
      /**
       * GAP-081 #1 — 원천은 **서버 월 캐시 두 달치**(최근 품목 칩과 같은 배열 하나)다.
       *
       * 라운드 58 E는 이 자리만 이번 달 캐시로 남겨 두고 그 이유를 적었다 — 자동 분류는 후보를
       * 제안하는 것이 아니라 사용자가 손대지 않은 타일을 **대신 누르는** 판정이라 원천을 넓히면
       * 저장 결과가 달라진다는 것이었고, 넓힐 근거가 설 때까지 미룬다고 했다. 그 근거가 달력에
       * 있었다(매달 1일에 1순위 갈래가 정의상 죽는다 — 위 recentItemServerRows 주석). 넓힌 축은
       * **성격이 같은 원천 한 달**이라 판정 규칙은 그대로이고, 성격이 다른 원천(오프라인 스냅숏의
       * 로컬 대기 행)은 **여전히 별도 결정**이라 여기에 오지 않는다.
       */
      history: recentItemServerRows,
      currentCategoryId: selectedCategoryId,
      autoPicked: autoPickedCategory,
      defaultCategoryId: null
    });
    const suggestedCategory =
      quickExpenseCategories.find((category) => category.id === nextSelection.categoryId) ?? null;
    // 8타일 밖의 id가 돌아오는 일은 없지만(추천도 카탈로그에서만 고른다), 혹시 그렇다면 지금
    // 선택을 건드리지 않는다 -- 못 그리는 타일을 고른 척하느니 그대로 두는 편이 정직하다.
    if (nextSelection.categoryId !== null && !suggestedCategory) return;
    setSelectedCategory((current) => (current?.id === suggestedCategory?.id ? current : suggestedCategory));
    // 같은 값이면 새 객체로 갈아끼우지 않는다 -- autoPickedCategory가 이 effect의 의존성이라
    // 매번 새 객체를 쓰면 렌더 루프가 된다.
    if (!isSameAutoPickedCategory(autoPickedCategory, nextSelection.autoPicked)) {
      setAutoPickedCategory(nextSelection.autoPicked);
    }
  }, [authToken, itemName, recentItemServerRows, selectedCategoryId, autoPickedCategory]);

  // 타이핑 연동 자동완성 후보(상위 3개). 칩으로 한 번 채운 뒤에는 다시 타이핑할 때까지 접힌다.
  //
  // GAP-058 #6: 원천이 이번 달 서버 캐시(expenseHistory)에서 **통합 제안 원천**(suggestRows)으로
  // 바뀌었다 — 최근 칩에는 보이는데 두 글자만 치면 후보에서 사라지던 오프라인 행이 이제 여기에도
  // 있고, 매달 1일에도 지난달 이력이 남는다. 새 요청은 여전히 0건이다.
  const itemAutocompleteChips =
    authToken && !autocompleteApplied ? buildItemAutocompleteSuggestions(itemName, suggestRows) : [];

  /**
   * GAP-056 #2 — 판매처 후보(타이핑 중 3개 / 빈 칸이면 최근 5개).
   *
   * GAP-058 #6: 원천은 품목 자동완성과 **같은 통합 목록 하나**(suggestRows)다. 이미 화면이 들고
   * 있는 배열만 합친 것이라 **새 요청은 0건**이고, 두 원천이 모두 비어 있으면(콜드 스타트·판매처를
   * 한 번도 안 적은 사용자) 빈 배열이라 칩 줄 자체가 없다 — 없는 상호를 지어내지 않는다.
   * 규칙(정규화·매칭·정렬·상한)은 전부 순수 모듈에 있고, 이 화면에는 한 줄도 없다.
   *
   * 라운드 58 E: useMemo인 이유는 지출 상세와 같다(P3 비대칭 해소) — 이 화면의 입력은 전부
   * 상태라, 같은 재료로 키 한 번마다 두 달치 목록을 다시 묶고 정렬할 이유가 없다. 게이트를
   * 계산 자리에 두는 것도 그쪽과 같다: 칩 줄이 사라지는 것과 계산이 없어지는 것이 한 조건이다.
   */
  const merchantSuggestions = useMemo(
    () => (authToken && merchantFocused ? buildMerchantSuggestions(merchant, suggestRows) : []),
    [authToken, merchantFocused, merchant, suggestRows]
  );

  /**
   * 칩 1탭 = 판매처 채우기. 품목 자동완성 칩과 달리 **판매처 한 칸만** 바꾼다(금액·분류는
   * 이 후보가 아는 사실이 아니다). 채운 뒤에는 칩 줄을 접는다 — 다시 고르고 싶으면 판매처
   * 칸을 누르면 같은 줄이 돌아온다.
   */
  const applyMerchantSuggestion = (merchantName: string) => {
    setMerchant(merchantName);
    setMerchantFocused(false);
  };

  const handleItemNameChange = (value: string) => {
    setItemName(value);
    setAutocompleteApplied(false);
    // 사용자가 직접 친 순간부터 이 값은 더 이상 "타일이 넣어 둔 라벨"이 아니다.
    lastTileFilledItemNameRef.current = null;
  };

  // 자동완성 칩 1탭 = 이름·금액·카테고리 일괄 채움. 저장은 여전히 저장하기 버튼으로만 일어난다.
  //
  // 라운드 33 F3(2/2): "카테고리를 확정했다"(categoryTouchedRef)는 표시는 칩이 **실제로 카테고리를
  // 바꿨을 때만** 세운다. 칩의 categoryId가 8타일 밖(엑셀 가져오기·지출 수정 화면을 거쳐 서버 정식
  // 카테고리를 단 행)이면 이 화면은 아무 타일도 바꾸지 못하는데, 그때도 touched로 쳐 버리면
  // 사용자가 카테고리를 고른 적이 없는데 자동 추천만 영구히 꺼진 채로 남는다(칩으로 채운 품목명에
  // 맞는 추천조차 못 하게 된다). 카테고리를 안 바꿨으면 추천을 끌 근거도 없다.
  const applyItemAutocompleteChip = (chip: ItemAutocompleteSuggestion) => {
    setItemName(chip.itemName);
    lastTileFilledItemNameRef.current = null;
    setAmountText(String(chip.amountKrw));
    const matchedCategory = quickExpenseCategories.find((category) => category.id === chip.categoryId);
    if (matchedCategory) {
      categoryTouchedRef.current = true;
      setAutoPickedCategory(null);
      setSelectedCategory(matchedCategory);
    }
    setAutocompleteApplied(true);
  };

  // EXP-113: "최근 품목" 재입력 칩 -- 서버 왕복 없이, 이 기기의 오프라인 저장소(local_expenses)
  // 반응형 스냅숏을 읽기 전용으로 사용한다 (createExpenseOffline이 저장할 때마다 스냅숏이
  // 갱신되므로 방금 기록한 항목이 곧바로 칩으로 나타난다). 품목명당 최신 1개 중복 제거와
  // 최대 5개 상한 등 순수 계산은 src/expenses/recent-items.ts에 분리해 단위 테스트한다.
  // 스냅숏이 비어 있으면(첫 기록 전, 콜드 스타트 직후, 저장소 초기화 실패) 칩 영역이 그냥
  // 숨겨질 뿐 -- 어떤 실패도 기록 흐름을 막지 않는다.
  //
  // UX-L(B): 그 스냅숏은 **이 기기의** 이력이라, 재설치·기종 변경·두 번째 기기에서는 서버에
  // 기록이 멀쩡히 있어도 칩이 비었다. 로컬에서 칩이 하나도 안 나올 때만 위 자동완성이 이미
  // 읽고 있는 서버 월 캐시로 폴백한다 -- 새 요청은 없고, 로컬이 있으면 예전 동작 그대로다
  // (우선순위 로컬). 규칙은 전부 src/expenses/recent-items.ts에 있다.
  //
  // GAP-058 #6: 그 폴백 원천이 **이번 달 + 지난달**로 넓어졌다. 폴백이 필요한 사람은 정확히
  // "이 기기에 이력이 없는" 사람이고(방금 기종을 바꿨거나 다시 깔았다), 그 사람이 매달 1일에
  // 앱을 열면 이번 달 캐시도 비어 있어 칩이 또 통째로 사라졌다 -- 서버에는 이력이 멀쩡히 있는데도.
  // 모듈은 넘겨받은 배열이 어느 달인지 묻지 않고 spentOn 최신순으로만 보므로(recent-items.ts의
  // RecentItemChipOptions 주석), 이어 붙이는 것 말고 새 인자도 새 요청도 필요 없다.
  // 스냅숏(offlineSnapshot.rows)을 그대로 넘기는 것은 종전 그대로다 -- 이 칩은 로컬 우선이라
  // 통합 목록(suggestRows)이 아니라 두 원천을 **갈라서** 받아야 한다.
  //
  // GAP-081 #1: 그 서버 두 달치 배열(recentItemServerRows)의 선언이 **자동 분류 effect 위로**
  // 올라갔다 -- 그 effect가 같은 배열을 읽게 됐기 때문이고, 계산도 값도 종전 그대로다.
  const recentItemChips =
    authToken && childId
      ? buildRecentItemChips(offlineSnapshot.rows, childId, { serverRows: recentItemServerRows })
      : [];

  // UX-K(A): 금액 카드 바로 아래에 붙는 "이번 달 지금까지" 한 줄.
  //
  // 숫자는 전부 src/expenses/entry-context-line.ts가 만든다 -- 기록 탭 월 합계와 **같은**
  // reconcileMonthlyExpenses/countsTowardMonthlyTotal(DNC-015 선물·환불 제외, 로컬 대기 행 포함)을
  // 통과시키므로 이 줄과 홈/기록 탭의 숫자가 갈라질 수 없다. 새 요청은 없다: 위 UX-C와 똑같이
  // 이미 받아 둔 월 캐시와 오프라인 스냅숏만 읽는다.
  //
  // 캐시가 없으면(콜드 스타트) 모듈이 null을 돌려주고 줄 자체가 사라진다 -- "0원"이라고 말하는
  // 대신 침묵한다. 세션이 없는 픽셀 락 캡처에서는 cachedMonthExpenses가 애초에 undefined이고,
  // 렌더도 authToken 게이트 뒤에 있어 EXP-001 기준 이미지는 그대로다.
  const entryContextLine = buildEntryContextLine({
    cachedMonthExpenses,
    cacheYearMonth: currentYearMonth,
    entryYearMonth: expenseDate.iso.slice(0, 7),
    offlineRows: offlineSnapshot.rows,
    childId,
    selectedCategory,
    // 라운드 38 H-11: 서버 시드 UUID를 단 행(엑셀 가져오기·수정 화면 경유)도 제 타일에 합산된다.
    // 매핑이 없거나 타일을 확정할 수 없는 행이 남을 때만 카테고리 항을 생략한다(라운드 37 G-4의
    // "모르면 말하지 않는다" + 라운드 39 I-1의 모호한 code).
    resolveTileCategory
  });

  // MOB-102 (round5a-sprint1-plan.md §3.2, §3.3): saves to the local offline store first --
  // this always "succeeds" as soon as the local write lands, well before the server has
  // confirmed anything, so the sheet shows OFFLINE_SAVED_MESSAGE here and never the
  // server-confirmed copy (that one only fires later, from a background flush -- see
  // src/offline/sync-controller.ts's flash-message wiring, surfaced on the records screen).
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // EXP-124: 저장 실패 문구. 지금까지 이 뮤테이션에는 onSuccess만 배선되어 있어서, 입력 가드가
  // 막았을 때도 createExpenseOffline의 SQLite 쓰기가 실패했을 때도 시트가 아무 반응 없이 그대로
  // 있었다(사용자는 저장이 됐는지 알 수 없어 다시 눌러 중복 기록하거나 그냥 포기한다).
  // 문구는 src/expenses/save-error-messages.ts가 단일 소스이고, 입력값은 그대로 남는다 —
  // draft-storage 자동 저장도 계속 돌기 때문에 시트를 닫았다 열어도 내용이 살아 있다.
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  /**
   * 라운드 48 T4(D1) — 이번 저장이 "저장하고 계속 기록"인가.
   *
   * ref인 이유: 값을 읽는 곳이 뮤테이션의 onSuccess라 렌더를 기다릴 수 없다(state로 두면 버튼을
   * 누른 그 렌더에서는 아직 옛 값이다). 저장이 끝나면 두 버튼 모두 이 자리에서 결론이 나므로
   * 성공·실패 어느 쪽이든 다음 저장에 새어 나가지 않도록 onSuccess/onError에서 되돌린다.
   */
  const continueAfterSaveRef = useRef(false);
  /**
   * 라운드 57 QA(P2-3) — "저장했어요"를 보여 준 뒤 떠나는 650ms 타이머를 ref에 들고, 언마운트
   * 때 취소한다. **지출 상세(app/expenses/[expenseId].tsx)의 leaveTimerRef와 같은 관례**이고,
   * 그 화면이 GAP-056 #6에서 이미 고친 것과 같은 결함이 이 화면에는 남아 있었다.
   *
   * 없을 때 무슨 일이 있었나: 저장 성공 직후 사용자가 스스로 시트를 닫거나 탭을 바꾸면 이 화면은
   * 언마운트되는데, 타이머는 살아남아 650ms 뒤에 `router.replace(postSaveDestination)`을 한 번
   * 더 호출한다 — 사용자가 방금 고른 화면이 저장 목적지로 **덮어써진다**(replace라 뒤로 돌아갈
   * 수도 없다). 원인이 화면 밖에서 오는 튐이라 재현하기도 어렵다.
   *
   * 새로 걸기 전에 이미 걸린 타이머를 지우는 것도 상세 화면과 같다 — 예약이 겹쳐 쌓이지 않는다.
   */
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);
  /**
   * 폼을 비우고 같은 화면에 머무는 "다음 항목" 초기화.
   *
   * **비우지 않는 것**: 지출 날짜와 결제 수단. 마트에서 연속으로 적는 상황은 같은 날 같은 카드라,
   * 매번 다시 고르게 만들면 이 버튼이 없애려던 왕복이 그대로 돌아온다. 나머지(품목명·금액·메모·
   * 선물 여부·분류)는 항목마다 달라지므로 남겨 두면 다음 기록에 잘못 섞인다.
   *
   * 자동 추천 관련 표시도 함께 처음 상태로 되돌린다 -- 그러지 않으면 방금 확정된 분류 때문에
   * (categoryTouchedRef) 다음 품목명에 대한 추천이 영영 꺼진 채로 남는다.
   */
  const resetFormForNextEntry = () => {
    setItemName("");
    setAmountText("");
    /**
     * 라운드 58 통합리뷰 P3-8 — 날짜 승계의 **예외 한 가지**.
     *
     * 날짜를 비우지 않는 근거(위 주석)는 "마트에서 같은 날 이어 적는다"이고, 그건 사용자가
     * 스스로 고른 날짜에 대한 이야기다. "고쳐서 다시 보내기"가 물려준 날짜는 다르다: 그건 **그
     * 실패 행 한 건의 날짜**이지 사용자가 지금 이어 적으려는 항목의 날짜가 아니다. 그대로
     * 승계하면 이어 적은 새 항목이 몇 주 전 날짜로 조용히 저장되고, 그 달 합계가 사실과
     * 어긋난다(사용자는 날짜 칸을 다시 보지 않는다 -- 방금 저장이 성공했으니까).
     *
     * 그래서 **프리필이 정한 날짜만** 오늘로 되돌리고, 사용자가 직접 고른 날짜는 그대로 둔다
     * (dateFollowsPrefill이 그 둘을 가른다). 되돌린 뒤에는 프리필이 더는 이 칸을 정하지 않으므로
     * 날짜 폴백 안내도 함께 사라진다 -- 새 항목에 대해서는 참이 아닌 문장이다.
     */
    if (dateFollowsPrefill) {
      setExpenseDateIso(initialExpenseDate.iso);
      setCustomDateMode(false);
      setCustomDateText("");
      setDateFollowsPrefill(false);
    }
    // 라운드 49 C-03(a): 판매처도 함께 비운다. 같은 마트에서 이어 적는 경우가 많다고 해서
    // 값을 남겨 두면, 다른 곳에서 산 다음 항목에 **사용자가 적지 않은 판매처**가 조용히
    // 따라붙는다 -- 이 화면이 "계속 기록"에서 품목·금액을 비우는 것과 같은 판단이다.
    setMerchant("");
    // GAP-056 #2: 판매처 칩 줄도 접는다 — 다음 항목의 휴지 상태는 첫 진입과 같아야 한다.
    setMerchantFocused(false);
    setMemo("");
    setIsGift(false);
    // 라운드 51 C-#5: 연속 기록의 리셋도 **미선택**으로 돌아간다. 첫 타일로 되돌리면 다음
    // 항목이 조용히 기저귀로 저장되는 바로 그 오분류가 연속 기록에서 반복된다.
    setSelectedCategory(null);
    setAutoPickedCategory(null);
    setAutocompleteApplied(false);
    categoryTouchedRef.current = false;
    lastTileFilledItemNameRef.current = null;
  };
  const saveExpense = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountText);
      // 라운드 51 C-#5: 분류는 이제 **필수**다. 버튼 쪽에서 안내로 먼저 막지만(아래
      // handleSavePress), 뮤테이션 자체도 분류 없이는 시작하지 않는다 -- 저장 규칙이 화면
      // 핸들러에만 있으면 다른 경로가 생겼을 때 조용히 빠져나간다.
      // GAP-054 #2: 상한 초과도 여기서 멈춘다 -- 버튼은 이미 비활성이지만(isAmountInvalid),
      // 저장 규칙이 화면 상태에만 있으면 다른 경로가 생겼을 때 조용히 빠져나가고, 그 한 건이
      // 오프라인 아웃박스에 무한 재시도 행으로 남는다(로컬 쓰기 **전에** 차단하는 것이 목적이다).
      // GAP-056 #1: 길이 상한도 **로컬 저장 전에** 막는다. 여기서 통과시키면 오프라인 아웃박스가
      // 로컬 저장을 먼저 성공시키고("기기에 저장했어요") flush에서 400을 만나 되살릴 수 없는
      // 실패 행이 된다(4xx는 재시도하지 않는다 — src/offline/remote-api.ts). 넘기는 값은
      // **실제로 보낼 값 그대로**다: 품목명은 원문(payload의 itemName), 판매처는 trim, 메모는 원문.
      // 라운드 58 통합리뷰 P1-1: 아이 어긋남도 **로컬 저장 전에** 여기서 한 번 더 막는다. 버튼은
      // 이미 비활성이지만(isSaveBlocked), 저장 규칙이 화면 상태에만 있으면 다른 경로가 생겼을 때
      // 조용히 빠져나가고 그 한 건이 다른 아이 밑으로 굳는다(그리고 원본 실패 행이 폐기된다).
      if (!authToken || !childId || isFailedRowChildMismatch(params.childId, childId) || !selectedCategory || !Number.isInteger(amountKrw) || amountKrw <= 0 || isAmountOverLimitForSave({ hasSession: true, amountText }) || hasExpenseTextOverLimit({ itemName, merchant: merchant.trim(), memo }) || !itemName.trim() || Boolean(dateInputError)) {
        throw new Error(INVALID_EXPENSE_INPUT_ERROR);
      }
      return createExpenseOffline(authToken, queryClient, {
        childId,
        categoryId: selectedCategory.id,
        amountKrw,
        spentOn: expenseDate.iso,
        itemName,
        // 라운드 49 C-03(a): 사용자가 적었을 때만 싣는다 -- 빈 칸이면 예전과 똑같이 키가 없다.
        ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
        paymentMethod: paymentMethod.value,
        memo,
        expenseType: isGift ? "gift" : "expense",
        ...(linkedItemTemplateId ? { linkedItemTemplateId } : {}),
        // 라운드 49 C-06(b): "샀어요"에서 왔다면 어느 제휴 링크였는지도 함께 남긴다
        // (⚠️ DNC-009 -- 기록·정산용이며 추천 점수·정렬에 유입 금지).
        ...(linkedProductLinkId ? { linkedProductLinkId } : {})
      });
    },
    // 다음 저장 시도가 시작되면 이전 실패 배너를 먼저 지운다 -- 재시도는 저장 버튼을 다시
    // 누르는 것으로 충분하므로 별도 "다시 시도" 컨트롤을 만들지 않는다.
    //
    // 라운드 48 QA(P2-2): 성공 토스트도 같은 자리에서 함께 지운다. "저장하고 계속 기록"은 화면을
    // 떠나지 않으므로(위 T4/D1) 성공 문구가 그대로 남는데, 이어 적은 두 번째 항목의 저장이
    // 실패하면 "기기에 저장했어요…"(초록)와 실패 배너(빨강)가 한 화면에 함께 서서 방금 누른
    // 저장이 됐다는 건지 안 됐다는 건지 화면이 두 가지로 말한다. 시도를 시작하는 순간
    // **이전 결과 표시는 전부 지난 것**이므로 둘 다 여기서 눕힌다.
    onMutate: () => {
      setSaveErrorMessage(null);
      setSavedMessage(null);
    },
    onError: (error) => {
      // 실패한 저장은 "계속 기록"도 아니다 -- 입력값은 그대로 남고 사용자가 고쳐서 다시 누른다.
      continueAfterSaveRef.current = false;
      setSaveErrorMessage(expenseMutationErrorMessage("create", error));
    },
    onSuccess: async () => {
      // 이번 저장이 어느 버튼이었는지를 먼저 확정해 둔다(아래 await 사이에 값이 바뀔 여지를
      // 남기지 않는다). 다음 저장은 버튼이 다시 세운다.
      const continueRecording = continueAfterSaveRef.current;
      continueAfterSaveRef.current = false;
      /**
       * 라운드 58 #5 — "고쳐서 다시 보내기"의 마지막 절반: 원본 실패 행 폐기.
       *
       * **여기가 유일하게 옳은 자리다.** 이 콜백은 로컬 저장이 확정된 뒤에만 돈다
       * (createExpenseOffline은 SQLite 우선 저장이라 오프라인에서도 여기까지 온다 — 그래서
       * 이 동선은 연결이 없어도 그대로 완결된다). 저장 실패는 onError로 가고, 그쪽은 원본을
       * 건드리지 않는다: 사용자는 고치던 값을 그대로 들고 다시 누르면 되고, 실패 행도 제자리에
       * 남는다(같은 기록이 두 번 사라지는 일이 없다).
       *
       * 폐기가 실패해도 저장을 되돌리지 않는다 -- 그 경우 남는 것은 "새 기록 + 원본 실패 행"
       * 이고, 사용자는 동기화 화면에서 그 행을 직접 버릴 수 있다. 반대 방향(새 기록을 지우는
       * 것)이 진짜 손실이다.
       *
       * 라운드 58 통합리뷰 P3-9 — **await하지 않는다(void)**. "저장 확정 후에만 버린다"는 계약은
       * 그대로다: 이 줄은 여전히 onSuccess 안에만 있고(저장이 확정된 뒤에만 실행된다) onError는
       * 원본을 건드리지 않는다. 바뀌는 것은 순서가 아니라 **대기**다. 폐기는 SQLite 쓰기라
       * 느려질 수 있는데, await하면 그동안 성공 토스트·캐시 무효화·화면 이동이 전부 뒤로 밀려
       * 저장이 끝났는데도 시트가 굳은 것처럼 보인다. 결과를 쓰는 곳이 없고 실패해도 무시하는
       * 작업이라(위 문단) 지연을 이 자리에서 격리한다. catch는 그대로 둔다 -- 처리되지 않은
       * 거절을 남기지 않기 위해서다.
       */
      if (failedLocalId) {
        void discardOfflineMutation(failedLocalId).catch(() => {
          // 무시한다(위 주석). 원본 행은 동기화 상태 화면에 그대로 남는다.
        });
      }
      /**
       * 라운드 60 트랙 B(GAP-060 #2) — **이 기록이 곧 그 물음의 답이다.**
       *
       * 여태 구매 확인 대기를 닫는 곳은 카드의 "샀어요" 하나뿐이라, 사용자가 실제로 지출을
       * 기록해도 그 클릭은 pending으로 남았다: 다음 포그라운드 복귀에 방금 기록한 물건을
       * 두고 "『…』 구매하셨나요?"를 다시 묻고, 같은 pending을 읽는 purchase_pending 알림도
       * 계속 새로 생겼다(src/notifications/generators.ts). 알림 쪽은 손대지 않는다 --
       * pending이 풀리면 후보에서 저절로 빠진다.
       *
       * 판정은 순수 함수가 한다(어느 대기의 답인가 · 아이가 맞는가 · 아직 pending인가).
       * 이름 추측은 없다: linkedItemTemplateId라는 **사실**이 있을 때만 닫는다.
       */
      const answeredFollowupItemTemplateId = resolvePurchaseFollowupForExpense({
        entries: usePurchaseFollowupStore.getState().entries,
        childId,
        linkedItemTemplateId
      });
      if (answeredFollowupItemTemplateId) {
        usePurchaseFollowupStore.getState().completeFollowup(answeredFollowupItemTemplateId);
      }
      // 라운드 63 C(#4): 방금 저장한 것은 지금 아이의 기록이다 -- 다른 아이 앞에서 치던 초안까지
      // 함께 버리지 않는다(위 clearDraftForCurrentChild).
      clearDraftForCurrentChild();
      setSaveErrorMessage(null);
      setSavedMessage(continueRecording ? CONTINUE_RECORDING_SAVED_MESSAGE : OFFLINE_SAVED_MESSAGE);
      // ANA-103: expense_recorded fires once per successful (local-first) create. The payload is
      // PII-safe by construction (src/analytics/events.ts): the raw amount is bucketed and the
      // categoryId mapped to the coarse enum on-device; itemName/memo never enter it. `source`
      // distinguishes the "준비템 -> 지출 기록하고 준비 완료" follow-up flow from a plain manual entry,
      // and `offline` reports the connectivity at record time (the create itself always succeeds
      // locally first -- see createExpenseOffline). A no-op without ANA-102 consent.
      const recordedAmountKrw = Number(amountText);
      // 라운드 51 C-#5: 분류 없이는 뮤테이션이 시작되지 않으므로 성공 시점에는 언제나 값이
      // 있다. 그래도 없는 값을 기본 타일로 메워 보내지는 않는다 -- 그러면 분석 데이터에
      // 사용자가 고른 적 없는 분류가 사실처럼 남는다(DNC: 허위 데이터 금지). 없으면 침묵한다.
      const recordedCategoryId = selectedCategoryId;
      const recordedSource = linkedItemTemplateId ? "followup" : "manual";
      // 리뷰 F6: categoryId는 이 화면의 8타일(categoryCatalog) 중 하나뿐이다 — 지출 수정 화면은
      // expense_recorded를 발화하지 않으므로 서버 카테고리 목록 해석은 필요 없다.
      if (recordedCategoryId) {
        void isCurrentlyOnline().then((online) => {
          trackAndFlushAnalyticsEvent(authToken, {
            eventName: "expense_recorded",
            payload: buildExpenseRecordedPayload({
              categoryId: recordedCategoryId,
              amountKrw: recordedAmountKrw,
              source: recordedSource,
              offline: !online
            }),
            platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
          });
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      /**
       * GAP-062 #1 — **리포트·예산 캐시도 방금의 기록을 모른다.** (지출 쓰기 4경로의 공통 근거)
       *
       * 리포트 탭은 탭 전환으로 언마운트되지 않으므로(react-navigation 기본) 돌아와도
       * `refetchOnMount`가 돌지 않고, `staleTime: 30_000`(app/_layout.tsx)과 포커스 리페치는
       * **앱 포그라운드 복귀**에만 걸린다. 그래서 리포트를 한 번 열어 둔 뒤 FAB로 3건을 적고
       * 돌아오면 월간 합계·카테고리 도넛·6개월 추이가 기록 전 값 그대로다 — 핵심 루프의
       * "총액 확인"이 옛 숫자를 말한다. 더 나쁜 것은 시점이다: 오프라인 대기 동안에는
       * "반영되지 않은 기록 N건" 고지가 사실을 말하지만(app/(tabs)/reports.tsx), flush가
       * 확정되는 순간 그 고지가 사라지고 서버 집계 캐시는 여전히 낡은 채로 남는다.
       *
       * 규칙은 이미 있었다 — 가져오기 확정(app/import/[importJobId].tsx)과 예산 저장
       * (app/budget.tsx)은 둘 다 `["report"]`를 무효화한다. 지출 쓰기 경로 넷만 지나쳤다.
       *
       * **`["budget"]`을 함께 넣는 이유**: 예산 응답의 `usedAmountKrw`도 이 기록만큼 달라진다.
       * 예산 화면은 스택이라 마운트마다 다시 물어(증상이 30초 창에 그쳐) 리포트만큼 눈에
       * 띄지 않았을 뿐, 낡기는 같이 낡는다. 비활성 쿼리의 무효화는 refetch를 일으키지
       * 않으므로(react-query) 그 화면이 떠 있지 않은 대다수 경우 추가 요청은 0건이다.
       *
       * **숫자를 클라이언트에서 다시 더하지 않는다**: 리포트 합계·비중·추이를 앱에서 재집계하면
       * 같은 집계 규칙을 두 벌 유지해야 하고 한쪽만 바뀌는 순간 화면이 조용히 틀린다
       * (src/reports/pending-scope-notice.ts 머리말이 못박은 규칙). 여기서 하는 일은 캐시를
       * 낡았다고 표시하는 것뿐이다.
       */
      await queryClient.invalidateQueries({ queryKey: ["report"] });
      await queryClient.invalidateQueries({ queryKey: ["budget"] });
      // R19-B (DNC-002 핵심 루프 마지막 고리): 준비템에서 넘어온 기록이면 서버가 그
      // 준비템을 자동으로 '준비 완료'로 올린다(store-shared.ts markLinkedItemPrepared).
      // 준비템 목록/상세 캐시를 그대로 두면 방금 기록한 항목이 화면에서는 계속
      // 미준비로 보여 준비율이 정체된 것처럼 읽힌다 -- 그래서 여기서 함께 무효화한다.
      // 연결이 없는 일반 기록은 준비템 상태를 바꾸지 않으므로 무효화도 하지 않는다.
      //
      // FIX-119B/F1 (R19 H-2) 유지 근거: 여기의 무효화는 "로컬 우선 저장 직후"이므로 실서버
      // 세션에서는 아직 서버가 지출을 받기 전이다(createExpenseOffline은 outbox flush를
      // fire-and-forget으로 띄운다). 실제 서버 반영 시점의 무효화는 src/offline/
      // sync-controller.ts attemptFlush 성공 분기가 담당한다. 그래도 이 호출을 남기는 이유는
      // 데모/로컬 백엔드 세션(LOCAL_SESSION_TOKEN) 때문이다 -- 그 경로의 "서버"는 동기적인
      // 인메모리 백엔드라 flush가 즉시 끝나고 준비템 상태가 곧바로 바뀌므로, 화면 전환 전
      // 이 무효화가 그대로 유효하다(그리고 무효화 자체는 멱등이라 실서버에서도 무해하다).
      if (linkedItemTemplateId) {
        await queryClient.invalidateQueries({ queryKey: ["items"] });
        await queryClient.invalidateQueries({ queryKey: ["item-detail"] });
      }
      // 라운드 48 T4(D1): "저장하고 계속 기록"은 **화면을 떠나지 않는다** -- 폼만 비우고 같은
      // 자리에 남아 다음 항목을 바로 받는다(마트 연속 기록). 그 외에는 종전처럼 목적지로
      // 이동하되, 그 목적지가 이제 진입점을 따른다(post-save-destination.ts).
      if (continueRecording) {
        resetFormForNextEntry();
        return;
      }
      // 라운드 57 QA(P2-3): 타이머를 ref에 담아 언마운트 때 취소한다(위 leaveTimerRef 주석).
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => router.replace(postSaveDestination), 650);
    }
  });
  // FMT-127: 금액 표기를 src/money.ts(콤마 + '원', '₩' 금지)로 되돌린다. 예전에는 세션 유무와
  // 무관하게 '₩ ...'를 그렸고, 하필 금액이 정확히 38,500원일 때만 캡처용 리터럴이 나와서 실제
  // 사용자가 38,500을 입력하면 다른 금액과 표기가 갈렸다.
  //
  // 픽셀 락 예외는 **캡처 조건 그대로**로 좁힌다: 캡처는 세션 없이(app/pixel-lock.tsx가
  // clearSession 후 이동) 고정 시드 "38500"으로만 실행되므로, 그 조합에서만 캡처 문자열을
  // 그대로 유지하면 EXP-001 기준 이미지는 한 픽셀도 바뀌지 않는다. 세션이 있는 모든 입력
  // 경로(= 실제 사용자가 보는 화면)는 이제 formatKrw를 탄다.
  //
  // DSN-053 P1 이후: 캡처 문자열이 "38,500원"으로 정정되면서 두 갈래의 결과가 **같은 문자열**이
  // 됐다(formatKrw(38500) === quickExpenseAmountPreview). 갈래를 남겨 두는 이유는 캡처가 무엇을
  // 기준으로 굳어 있는지를 코드에 남기기 위해서다 -- 나중에 표기 규칙이 또 흔들리면 여기가
  // 먼저 갈라지고, 그 사실이 auto-fill-wiring.test.ts의 계약으로 드러난다.
  const isPixelLockAmountCapture = !authToken && amountText === "38500";
  const formattedAmount = isPixelLockAmountCapture ? quickExpenseAmountPreview : formatKrw(Number(amountText || 0));
  // DSN-053 P2-C: 요약바의 금액 박스는 숫자와 '원'을 **다른 크기로** 그린다(승인 원본: 22/800 +
  // 14/800). 그래서 입력칸의 값은 접미사 없는 숫자여야 하고, 그 규칙은 money.ts가 이미 갖고
  // 있다(formatAmountDigits -- "38500" -> "38,500"). 화면에 읽히는 결과는 formattedAmount와
  // 같은 문자열이고(캡처 경로 "38,500원" 포함), 스크린 리더에는 접미사가 붙은 쪽을 그대로
  // 넘긴다(accessibilityValue) -- 숫자만 읽어 주면 단위가 사라진다.
  const amountInputDisplay = formatAmountDigits(amountText);
  // Guards the one-tap quick-expense sheet: with a real/test session, the save button stays
  // disabled until a positive amount has actually been entered (and any manually-typed date is
  // valid), so opening the sheet can never by itself create an expense. Preview mode (authToken
  // null) is unaffected -- amountText is always the fixed "38500" seed there, so isAmountInvalid
  // is always false.
  // 리뷰 F9-d: 상한(QUICK_AMOUNT_MAX_KRW)에 닿으면 프리셋 칩을 눌러도 금액이 더 늘지 않는다.
  // 그대로 두면 "눌러도 아무 일도 일어나지 않는 버튼"이라, 칩을 비활성으로 표시하고
  // accessibilityState로 스크린 리더에도 같은 사실을 알린다("지우기"는 계속 눌러야 하므로 그대로).
  const canTapAmountPreset = canAddAmountPreset(amountText);
  const amountKrwValue = Number(amountText);
  /**
   * GAP-054 #2(트랙 C 몫) — 금액 상한 가드.
   *
   * 서버 amount 컬럼은 int4라 2,147,483,647을 넘는 값은 저장이 아니라 5xx로 끝난다. 그런데 이
   * 화면의 저장은 **로컬 우선**이라(createExpenseOffline) 그 실패는 "기기에 저장했어요"를 말한
   * 뒤 백그라운드 flush에서야 나타나고, 아웃박스에 무한 재시도되는 행 하나가 남는다(P0-2).
   * 그래서 로컬 쓰기 전에 여기서 멈춘다 -- 상한 값도 문구도 src/expenses/amount-limit.ts가
   * 단일 소스이고(서버 @Max와 같은 숫자), 판정은 순수 함수 한 곳에만 있다.
   */
  const isAmountOverLimit = isAmountOverLimitForSave({ hasSession: Boolean(authToken), amountText });
  const isAmountInvalid =
    Boolean(authToken) &&
    (!amountText || !Number.isInteger(amountKrwValue) || amountKrwValue <= 0 || isAmountOverLimit || Boolean(dateInputError));
  /**
   * GAP-056 #1 — 텍스트 길이 상한 가드(품목명 100 · 판매처 100 · 메모 500).
   *
   * 입력 칸의 `maxLength`가 있는데도 이 판정이 필요한 이유는 지출 상세와 같다: 상한은 컬럼
   * 한계(varchar 120)가 아니라 **계약**이라, 엑셀 가져오기로 들어온 101~120자짜리 값이 "또 기록"
   * 프리필이나 복원된 초안을 타고 이 칸에 들어올 수 있고 `maxLength`는 새로 치는 글자만 막는다.
   * 조용히 잘라 버리지 않고 무엇을 줄여야 하는지 말한다.
   *
   * 판정 값은 **서버로 실제로 보낼 문자열**이다(payload와 같게: 품목명 원문 · 판매처 trim ·
   * 메모 원문). 세션이 없는 픽셀 락 캡처는 애초에 고정 시드("기저귀"/빈 메모)라 언제나 빈
   * 목록이고, EXP-001 기준 이미지는 이 판정으로 한 픽셀도 바뀌지 않는다.
   */
  const textOverLimitNotices = authToken
    ? [
        isItemNameOverLimit(itemName) ? itemNameOverLimitMessage() : null,
        isMerchantOverLimit(merchant.trim()) ? merchantOverLimitMessage() : null,
        isMemoOverLimit(memo) ? memoOverLimitMessage() : null
      ].filter((notice): notice is string => notice !== null)
    : [];
  /**
   * 라운드 58 통합리뷰 P1-1 — **아이 어긋남 가드**(이중 방어의 둘째 겹).
   *
   * 첫 겹은 동기화 상태 화면이다: "고쳐서 다시 보내기"는 지금 선택된 아이의 실패 행에만 선다
   * (app/sync-status.tsx). 그런데 이 시트가 열려 있는 동안에도 선택된 아이는 바뀔 수 있고
   * (전역 스토어다), 딥링크·복원된 내비게이션 상태로 이 화면이 직접 열릴 수도 있다.
   *
   * 그 상태로 저장하면 아이 A의 지출이 B의 합계에 들어가고, 저장이 확정되는 순간 A의 원본
   * 실패 행이 폐기된다(아래 onSuccess) — 되돌릴 원본이 없는 **데이터 손실**이다. 그래서 저장을
   * 막고 아래 안내 한 줄로 이유를 말한다. 입력값은 그대로 남으므로 아이를 되돌리면 이어서
   * 저장할 수 있다. 판정은 순수 모듈 한 곳에 있다(failed-row-prefill.ts).
   *
   * 이 파라미터를 싣지 않는 다른 진입점("또 기록"·준비템·정기 지출)에서는 언제나 false다.
   */
  const failedRowChildMismatch = Boolean(authToken) && isFailedRowChildMismatch(params.childId, childId);
  /**
   * 저장 버튼을 잠그는 판정 한 곳. 금액 가드와 길이 가드가 **같은 자리**를 지나야 두 저장
   * 버튼(저장하기 · 저장하고 계속 기록)이 서로 다른 규칙으로 갈리지 않는다. 잠그기만 하고
   * 이유를 말하지 않으면 "왜 저장이 안 되지"만 남으므로, 두 가드 모두 버튼 바로 위에 안내
   * 한 줄을 세운다(아래). 뮤테이션 안에도 같은 판정이 한 번 더 있다 — 지출 상세와 같은 이중 가드.
   */
  const isSaveBlocked = isAmountInvalid || textOverLimitNotices.length > 0 || failedRowChildMismatch;
  /**
   * 라운드 51 C-#5 — 분류 없이 저장을 눌렀을 때.
   *
   * 버튼을 **비활성으로 만들지 않는 이유**: 비활성 버튼은 이유를 말할 자리가 없다(라운드 40
   * J-1의 잠금 가드가 같은 판단을 한다). 금액이 비어 있을 때와 달리 여기서는 "무엇을 하면
   * 되는지"가 한 문장으로 끝나므로, 눌리게 두고 그 한 문장으로 답한다.
   *
   * 안내는 분류를 고르는 순간 저절로 사라진다(렌더 조건이 `분류 없음`을 함께 본다) -- 사용자가
   * 시킨 대로 했는데도 경고가 남아 있는 화면을 만들지 않는다.
   */
  const isCategoryMissing = isCategoryMissingForSave({ hasSession: Boolean(authToken), selectedCategoryId });
  const [categoryNoticeRequested, setCategoryNoticeRequested] = useState(false);
  const showCategoryNotice = categoryNoticeRequested && isCategoryMissing;
  /**
   * 저장 버튼 두 개가 **같은 한 곳**에서 분류 가드를 지나고, 이번 저장이 어느 버튼이었는지도
   * 여기서 한 번만 기록한다(라운드 48 T4의 continueAfterSaveRef). 막혔으면 false를 돌려주고
   * 호출부는 그대로 멈춘다 -- 뮤테이션은 시작되지 않고 안내 한 줄만 뜬다.
   */
  const prepareSave = (continueRecording: boolean) => {
    if (isCategoryMissing) {
      setCategoryNoticeRequested(true);
      return false;
    }
    setCategoryNoticeRequested(false);
    continueAfterSaveRef.current = continueRecording;
    return true;
  };

  /**
   * DSN-053 P2-C — "분류별 빠른 품목"에서 품목 하나를 고른다.
   *
   * 분류 타일 탭(아래 그리드)과 **같은 확정 규칙**을 지난다: 사용자가 직접 고른 것이므로 자동
   * 추천이 뒤에서 분류를 바꾸지 않고(categoryTouchedRef), "자동으로 골라 줬다" 표시도 함께
   * 내린다. 다만 품목명은 사용자가 고른 그 품목이라 **타일이 넣어 둔 라벨이 아니다** --
   * lastTileFilledItemNameRef를 비워 두어야 뒤이어 분류 타일을 눌러도 이 이름이 덮이지 않는다
   * (UX-K(B-b)의 shouldTileFillItemName 판정 재료).
   */
  const selectQuickExpenseItem = (category: QuickExpenseCategory, quickItemLabel: string) => {
    categoryTouchedRef.current = true;
    setAutoPickedCategory(null);
    setSelectedCategory(category);
    setCategoryNoticeRequested(false);
    setItemName(quickItemLabel);
    setAutocompleteApplied(true);
    lastTileFilledItemNameRef.current = null;
  };

  /**
   * 빠른 품목 목록의 마지막 타일("직접 입력"). 목록에 없는 품목이라 이름은 비우고, 분류만
   * 그대로 확정한 뒤 품목명 입력칸으로 커서를 옮긴다 -- 목록에 없다는 이유로 기록을 포기하게
   * 두지 않는다.
   */
  const startCustomItem = (category: QuickExpenseCategory) => {
    categoryTouchedRef.current = true;
    setAutoPickedCategory(null);
    setSelectedCategory(category);
    setCategoryNoticeRequested(false);
    setItemName("");
    setAutocompleteApplied(false);
    lastTileFilledItemNameRef.current = null;
    requestAnimationFrame(() => itemNameInputRef.current?.focus());
  };

  return (
    /* DSN-053 P2-C: 요약바(금액·저장)는 스크롤과 **함께 움직이지 않는다** -- 승인 원본의 지출
       화면처럼 화면 아래에 고정돼, 품목을 고르러 한참 내려가도 저장이 늘 손 닿는 자리에 있다.
       본문은 종전 그대로 AppScreen(픽셀 락 웹 캡처의 스크롤바 숨김 포함)이 굴리고, 키보드가
       올라오면 KeyboardAvoidingView가 요약바를 그 위로 밀어 올린다. */
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ backgroundColor: theme.colors.background, flex: 1 }}
    >
    <AppScreen>
      <View style={quickExpensePixelFrameStyle()}>
        <BottomSheetFrame
          title=""
          showHandle={false}
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            boxShadow: "none",
            elevation: 0,
            gap: 16,
            padding: 0,
            position: "relative"
          }}
        >
        <View testID={quickExpenseScreenId} style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={8}
            onPress={() => {
              // UX-K(B-a): 쓰다 만 값이 있으면 초안을 **지우지 않고** 닫는다. 이 화면은 입력을
              // 500ms 디바운스로 계속 저장해 두고 다음 진입 때 복원하는데(:270-288), 닫기가 그
              // 초안을 스스로 지워 버리면 전화 한 통에 친 내용이 통째로 사라진다. 아무것도 안
              // 쳤으면 남길 것이 없으므로 종전대로 지운다(빈 초안이 다음 진입을 방해하지 않는다).
              // 판정은 순수 함수 한 곳(entry-form-guards.ts)에만 있고, 확인 Alert은 일부러 띄우지
              // 않는다 -- 빠른 기록 흐름에 확인 한 단계를 더 얹는 값이 없다.
              // 저장 성공 경로의 clearQuickExpenseDraft(onSuccess)는 그대로다.
              //
              // 라운드 37 G-7: "친 것"에서 **프리필로 채워진 초기값을 제외**한다. 준비템에서
              // 넘어와 아무것도 안 치고 그대로 닫으면 예전에는 『젖병 소독기』가 초안으로 남아,
              // 다음 FAB 진입에서 준비템과 연결되지 않은 채 되살아났다.
              if (
                shouldClearQuickExpenseDraftOnClose({
                  current: { itemName, amountText, memo },
                  initial: initialInputSnapshotRef.current
                })
              ) {
                // 라운드 63 C(#4): "남길 것이 없다"는 이 화면·이 아이에 대한 판정이다 --
                // 다른 아이 앞에서 치던 초안은 그대로 둔다(위 clearDraftForCurrentChild).
                clearDraftForCurrentChild();
              }
              router.back();
            }}
            style={{ alignItems: "center", justifyContent: "center", minHeight: 48, minWidth: 48 }}
          >
            <Text style={{ color: theme.colors.gray900, fontSize: 24 }}>×</Text>
          </Pressable>
          {/* DSN-053 P2-C: 제목 19/800 + 부제 11 (승인 원본의 헤더). 부제는 이 화면이 무엇을
              요구하는지 한 줄로 말한다 -- 아래 요약바가 품목·금액만 묻는 이유이기도 하다. */}
          {/* GAP-060 #7: 제목이 곧 스코프 라벨의 자리다("다온이 — 지출 기록"). 부제·크기·정렬은
              그대로이고, 라벨이 없으면(외동·세션 없음·캐시 없음) 문자열도 종전 그대로다.
              눈에는 줄표, 스크린리더에는 쉼표 -- 4탭이 쓰는 그 두 함수 그대로다(줄표는
              TalkBack/VoiceOver가 삼키거나 "대시"로 읽어 층위가 소리로 전달되지 않는다). */}
          <View style={{ alignItems: "center", flexShrink: 1, gap: 2 }}>
            {/* 긴 태명이 닫기 버튼을 밀어내지 않도록 제목만 한 줄로 자른다(라벨이 없으면 자를
                것도 없어 종전과 같다). 낭독은 잘리지 않은 accessibilityLabel이 맡는다. */}
            <Text
              accessibilityRole="header"
              accessibilityLabel={withSpokenChildScopeLabel("지출 기록", childScopeLabel)}
              numberOfLines={1}
              style={{ color: theme.colors.gray900, fontSize: 19, fontWeight: "800" }}
            >{withChildScopeLabel("지출 기록", childScopeLabel)}</Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>품목을 고르고 금액만 입력하세요</Text>
          </View>
          <View style={{ width: 48 }} />
        </View>

        {/* EXP-113: 기저귀·분유처럼 반복 구매하는 품목을 다시 타이핑하지 않도록, 최근 입력
            항목을 폼 상단 칩으로 노출한다. 탭하면 품목명/금액/카테고리가 채워질 뿐이며
            (그 뒤 자유롭게 수정 가능) 저장은 여전히 저장하기 버튼으로만 일어난다. 미리보기
            (픽셀 락) 모드와 첫 기록 전에는 렌더되지 않아 기존 레이아웃에 영향이 없다. */}
        {authToken && recentItemChips.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>최근 품목</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentItemChips.map((chip) => (
                <Pressable
                  key={chip.itemName}
                  accessibilityRole="button"
                  accessibilityLabel={recentItemChipAccessibilityLabel(chip)}
                  hitSlop={SUGGEST_CHIP_HIT_SLOP}
                  onPress={() => {
                    setItemName(chip.itemName);
                    lastTileFilledItemNameRef.current = null;
                    setAmountText(String(chip.amountKrw));
                    // 라운드 34 L8: "카테고리를 확정했다"는 표시는 칩이 **실제로 카테고리를 바꿨을
                    // 때만** 세운다 -- 자동완성 칩(applyItemAutocompleteChip, 라운드 33 F3)과 같은
                    // 규칙이다. 칩의 categoryId가 8타일 밖(엑셀 가져오기·지출 수정 화면을 거친 행)
                    // 이면 이 화면은 아무 타일도 바꾸지 못하는데, 그때도 touched로 쳐 버리면 사용자가
                    // 카테고리를 고른 적이 없는데 자동 추천만 영구히 꺼진 채로 남는다.
                    const matchedCategory = quickExpenseCategories.find((category) => category.id === chip.categoryId);
                    if (matchedCategory) {
                      categoryTouchedRef.current = true;
                      setAutoPickedCategory(null);
                      setSelectedCategory(matchedCategory);
                    }
                  }}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.white,
                    borderColor: theme.colors.primary100,
                    borderRadius: theme.radii.pill,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 38,
                    paddingHorizontal: 14
                  }}
                >
                  <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
                    {formatRecentItemChipLabel(chip)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* DSN-053 P2-C — 날짜 pill 행 (승인 원본: 3칸 flex1 + 달력 버튼 48·radius 14).
            원본의 세 칸은 어제/오늘/**내일**이지만, 이 앱은 미래 날짜를 저장하지 않는다
            (validateExpenseDateInput이 미래 날짜를 거부한다). 눌러도 저장이 막히는 칸을
            내놓느니 같은 자리를 **그제/어제/오늘**로 쓴다 -- 칩 목록 자체는 종전 14일 로직
            (buildRecentDateChips)에서 그대로 잘라 오므로 라벨·iso 규칙이 갈라지지 않는다.
            GAP-054 #7: 달력 버튼은 이제 **진짜 월 달력 픽커**를 연다(아래 패널). 14일 칩과
            직접 입력은 같은 패널에 그대로 남는다 -- 어제·그제는 칩이 더 빠르다. */}
        <View accessibilityLabel={`지출 날짜 ${expenseDate.label}`} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
            {quickDateChips.map((chip) => (
              <View key={chip.iso} style={{ flex: 1 }}>
                <CategoryChip
                  label={chip.shortLabel}
                  selected={!customDateMode && chip.iso === expenseDateIso}
                  onPress={() => {
                    setExpenseDateIso(chip.iso);
                    // 라운드 58 통합리뷰 P3-7: 여기서부터 날짜는 **사용자가 정한 값**이다. 같은
                    // 날짜를 다시 고르더라도 프리필로 되돌아가지 않는다(안내가 되살아나지 않게).
                    setDateFollowsPrefill(false);
                    setCustomDateMode(false);
                    setCustomDateText("");
                  }}
                />
              </View>
            ))}
          </View>
          <Pressable
            accessibilityLabel="지출 날짜 변경"
            accessibilityRole="button"
            accessibilityState={{ expanded: showDatePicker }}
            disabled={!authToken}
            onPress={toggleDatePicker}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: theme.colors.white,
              borderColor: "rgba(74, 63, 53, 0.10)",
              borderRadius: 14,
              borderWidth: 1,
              height: 48,
              justifyContent: "center",
              opacity: pressed ? 0.76 : 1,
              width: 48
            })}
          >
            <AppIcon color={theme.colors.mainCoral} name="calendar-blank-outline" size={22} />
          </Pressable>
        </View>
        {/* 고른 날짜는 pill 라벨만으로는 알 수 없다(달력 패널에서 2주 전을 고르면 어느 칩도
            눌려 있지 않다) -- 그래서 실제 저장될 날짜를 한 줄로 그대로 적는다. */}
        <Text style={{ color: theme.colors.gray600, fontSize: 11, fontWeight: "700" }}>{expenseDate.label}</Text>
        {/* 라운드 58 #5: 실패 행의 날짜를 그대로 쓸 수 없어 오늘로 물러선 경우에만 뜬다. 사용자가
            날짜를 한 번이라도 고르면(칩·달력·직접 입력) 사라지고 **다시 나타나지 않는다** -- 이미
            고른 뒤에도 남아 있으면 지금 화면과 어긋나는 말이 된다. 앱이 날짜를 지어내지 않는다는
            사실 자체가 이 줄의 존재 이유다(문구는 src/offline/messages.ts 단일 소스).
            라운드 58 통합리뷰 P3-7: 조건이 날짜 값 비교가 아니라 **누가 정했는가**(dateFollowsPrefill)
            다. 값으로 비교하면 어제로 옮겼다가 오늘 칩을 다시 누른 사용자에게 안내가 되살아났다 --
            스스로 오늘을 고른 사람에게 "오늘로 두었어요"는 사실이 아니다. */}
        {prefilledSpentOn.fellBackToToday && dateFollowsPrefill ? (
          <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>{FAILED_ROW_PREFILL_DATE_RESET_NOTICE}</Text>
        ) : null}

        {authToken && showDatePicker ? (
          <View style={{ gap: 10 }}>
            {/* GAP-054 #7 — 진짜 월 달력 픽커. 종전에는 이 자리에 14일 칩만 있어서 2주보다
                오래된 영수증은 ISO를 손으로 쳐야 했다. 격자는 기록 탭 달력과 같은
                buildCalendarMonth(재사용), 미래 달·미래 날짜 잠금과 라벨은 순수 모듈
                (src/expenses/date-picker-month.ts)이 정한다.
                아래 14일 칩·직접 입력은 그대로 남는다 — 어제·그제를 고르는 데는 칩이 더 빠르고,
                이미 그 손에 익은 경로를 달력이 대체할 이유가 없다. */}
            <ExpenseDatePicker
              onSelectDate={(dateIso) => {
                // 칩 탭과 **같은 상태 갱신**이다 -- 초안 자동 저장(spentOnIso)·요약 줄·
                // 저장 payload가 전부 이 한 값(expenseDateIso)만 본다.
                setExpenseDateIso(dateIso);
                setDateFollowsPrefill(false);
                setCustomDateMode(false);
                setCustomDateText("");
              }}
              selectedIso={expenseDateIso}
              todayIso={todayIso}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentDateChips.map((chip) => (
                <CategoryChip
                  key={chip.iso}
                  label={chip.shortLabel}
                  selected={!customDateMode && chip.iso === expenseDateIso}
                  onPress={() => {
                    setExpenseDateIso(chip.iso);
                    setDateFollowsPrefill(false);
                    setCustomDateMode(false);
                    setCustomDateText("");
                  }}
                />
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" hitSlop={14} onPress={() => setCustomDateMode((value) => !value)}>
              {/* A11Y-117: 12px 토글 텍스트 -- coral[500] 3.16:1(AA 미달) → coral[700] 5.56:1 */}
              <Text style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700" }}>
                {customDateMode ? "최근 날짜에서 선택" : "직접 입력"}
              </Text>
            </Pressable>
            {customDateMode ? (
              <View style={{ gap: 6 }}>
                <TextInput
                  accessibilityLabel="날짜 직접 입력"
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(value) => {
                    const cleaned = value.replace(/[^0-9-]/g, "").slice(0, 10);
                    setCustomDateText(cleaned);
                    if (cleaned.length > 0) {
                      const error = validateExpenseDateInput(cleaned);
                      if (!error) {
                        setExpenseDateIso(cleaned);
                        setDateFollowsPrefill(false);
                      }
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  style={{
                    backgroundColor: theme.colors.white,
                    borderColor: dateInputError ? theme.colors.danger : "rgba(74, 63, 53, 0.10)",
                    borderRadius: 14,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    minHeight: 44,
                    paddingHorizontal: 14
                  }}
                  value={customDateText}
                />
                {dateInputError ? (
                  // a11y: 입력 도중 나타나는 오류라 포커스가 TextInput에 남아 있다 — 스크린리더가
                  // 스스로 읽어 주지 않으면 조용히 막힌다. (auth)/login.tsx:285 관례와 같은 조합.
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    style={{ color: theme.colors.danger, fontSize: 12 }}
                  >
                    {dateInputError}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* DSN-053 P2-C — "바로 기록". 분류 8타일이 승인 원본의 타일 문법(144h·radius 16·원형
            44 아이콘)으로 그려진다. 고르는 대상과 저장되는 값은 종전과 한 글자도 다르지 않다. */}
        <View style={{ gap: 3 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>바로 기록</Text>
          <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>분류를 고르면 품목명도 함께 채워져요</Text>
        </View>
        <View accessibilityLabel="바로 기록 분류" style={quickExpenseCategoryGridStyle.grid}>
          {quickExpenseCategories.map((category) => {
            // 라운드 51 C-#5: 미선택(selectedCategory === null)이면 **어느 타일에도** 하이라이트가
            // 없다 -- 그 부재가 "아직 안 골랐어요"를 말하는 시각 상태다.
            const selected = selectedCategory !== null && category.label === selectedCategory.label;
            return (
              <View key={`${category.id}-${category.label}`} style={{ width: expenseGridItemWidth }}>
              <ExpenseCategoryIconButton
                selected={selected}
                category={category}
                onPress={() => {
                  // UX-C: 직접 고른 순간부터 자동 추천은 이 선택을 덮어쓰지 않는다.
                  categoryTouchedRef.current = true;
                  setAutoPickedCategory(null);
                  setSelectedCategory(category);
                  // 라운드 51 C-#5: 안내를 보고 고른 것이므로 안내 요청도 함께 눕힌다.
                  setCategoryNoticeRequested(false);
                  // UX-K(B-b): 품목명은 **비어 있거나, 직전에 타일이 넣은 라벨 그대로일 때만**
                  // 채운다. 예전에는 무조건 덮어써서, "하기스 밴드형 4단계"를 다 쳐 놓고 분류만
                  // 바꾸려 타일을 누르면 그 이름이 경고 없이 "의류"로 바뀌었다(못 알아채면 실제로
                  // 산 물건과 다른 이름이 기록에 남는다). 판정은 순수 함수 한 곳에만 있다.
                  if (shouldTileFillItemName({ itemName, lastTileFilledItemName: lastTileFilledItemNameRef.current })) {
                    setItemName(category.label);
                    lastTileFilledItemNameRef.current = category.label;
                  }
                }}
              />
              </View>
            );
          })}
        </View>

        {/* UX-C: 자동으로 골라 줬을 때만 뜨는 미세 캡션. 타일 자체는 평소와 똑같은 선택 상태로
            보이고(추천이라고 다르게 칠하지 않는다), 사용자가 타일을 직접 누르거나 칩으로
            카테고리를 확정하면 바로 사라진다. 세션 없는 픽셀 락 캡처에서는 렌더되지 않는다. */}
        {authToken && autoPickedCategory ? (
          <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>{AUTO_CATEGORY_CAPTION}</Text>
        ) : null}

        {/* DSN-053 P2-C — "분류별 빠른 품목" 아코디언 (승인 원본: 카드 radius 16 · 펼침 테두리
            mainCoral · 헤더 minH 68 · 원 42 categoryColors · 기본 6개 + 마지막 "직접 입력").
            분류만 고르면 품목명이 분류 이름("기저귀")으로 남는데, 실제로 산 것은 "기저귀 크림"
            일 수 있다 -- 목록에서 고르면 그 이름이 그대로 기록에 남는다. 목록은 순수 모듈
            (src/expenses/quick-expense-catalog.ts) 하나에만 있고, 저장 규칙은 이 목록을 거치지
            않는다(고른 이름은 아래 품목명 칸에서 그대로 고쳐 쓸 수 있다). */}
        <View style={{ gap: 3 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>분류별 빠른 품목</Text>
          <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>분류를 펼치면 자주 적는 품목을 바로 고를 수 있어요</Text>
        </View>
        {quickExpenseCategories.map((category) => {
          const categoryItems = quickExpenseItemsForCategory(category.id);
          const expanded = expandedCategoryId === category.id;
          const categoryLimit = categoryLimits[category.id] ?? QUICK_EXPENSE_DEFAULT_LIMIT;
          const visibleCategoryItems = categoryItems.slice(0, categoryLimit);
          return (
            <View
              key={`quick-items-${category.id}-${category.label}`}
              style={{
                backgroundColor: theme.colors.white,
                borderColor: expanded ? theme.colors.mainCoral : "rgba(74, 63, 53, 0.10)",
                borderRadius: 16,
                borderWidth: 1,
                overflow: "hidden"
              }}
            >
              <Pressable
                accessibilityLabel={`${category.label}. 빠른 품목 ${categoryItems.length}개`}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setExpandedCategoryId((current) => (current === category.id ? "" : category.id))}
                style={({ pressed }) => ({
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 12,
                  minHeight: 68,
                  opacity: pressed ? 0.76 : 1,
                  paddingHorizontal: 14
                })}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.categoryColors[category.code],
                    borderRadius: theme.radii.pill,
                    height: 42,
                    justifyContent: "center",
                    width: 42
                  }}
                >
                  <AppIcon color={theme.colors.brown} name={categoryItems[0]?.icon ?? "shape-outline"} size={22} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>{category.label}</Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>{categoryItems.length}개 품목</Text>
                </View>
                <AppIcon color={theme.colors.gray600} name={expanded ? "chevron-up" : "chevron-down"} size={22} />
              </Pressable>
              {expanded ? (
                <View style={[quickExpenseCategoryGridStyle.grid, { paddingBottom: 14, paddingHorizontal: 14 }]}>
                  {visibleCategoryItems.map((item) => (
                    <View key={item.id} style={{ width: expenseGridItemWidth }}>
                      <ExpenseQuickItemButton
                        icon={item.icon}
                        label={item.label}
                        onPress={() => selectQuickExpenseItem(category, item.label)}
                        selected={item.label === itemName && category.id === selectedCategoryId}
                      />
                    </View>
                  ))}
                  <View style={{ width: expenseGridItemWidth }}>
                    <ExpenseQuickItemButton
                      icon="plus"
                      label="직접 입력"
                      onPress={() => startCustomItem(category)}
                      selected={false}
                    />
                  </View>
                  {visibleCategoryItems.length < categoryItems.length ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${category.label} 빠른 품목 더 보기`}
                      onPress={() =>
                        setCategoryLimits((current) => ({
                          ...current,
                          [category.id]: nextQuickExpenseLimit(categoryLimit, categoryItems.length)
                        }))
                      }
                      style={({ pressed }) => ({
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 48,
                        opacity: pressed ? 0.76 : 1,
                        width: "100%"
                      })}
                    >
                      {/* A11Y-117: 13px coral 텍스트는 coral[700](5.56:1)으로 -- coral[500]/600은 AA 미달. */}
                      <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "800" }}>더 보기</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* 라운드 49 C-03(a): 판매처 입력칸. **authToken 게이트 뒤**에 두는 것이 EXP-001
            픽셀 락 계약이다 -- 캡처는 세션 없이(app/pixel-lock.tsx가 clearSession 후 이동)
            초기 렌더만 찍으므로, 이 분기는 기준 이미지에 나타나지 않는다.
            자유 텍스트 한 줄이고 선택 사항이다. 값은 저장 payload의 `merchant`로 그대로 나가고
            CSV의 판매처 열·지출 상세의 판매처 칸에서 같은 문자열로 다시 보인다.
            "샀어요"에서 넘어온 경우에는 플랫폼 이름(쿠팡 등)이 미리 채워져 있고, 사용자가
            지우거나 고쳐 쓸 수 있다.

            GAP-056 #2: 라운드 49의 "상호 사전이 없다"는 주석은 **더 이상 사실이 아니라** 지웠다 —
            이 화면이 이미 손에 들고 있는 이번 달 캐시 안에 사용자가 직접 적어 둔 판매처가 있고,
            아래 칩이 그것만 되돌려 준다(외부 사전도, 새 요청도 없다). */}
        {authToken ? (
          <View style={{ gap: 8 }}>
            <TextInput
              accessibilityLabel="판매처 입력 (선택)"
              returnKeyType="done"
              // GAP-056 #1: 서버 @MaxLength와 같은 숫자(단일 소스는 src/expenses/text-limits.ts).
              maxLength={MERCHANT_MAX_LENGTH}
              onChangeText={setMerchant}
              // GAP-056 #2: 칩 줄의 게이트. 열자마자 끼어들지 않고, 이 칸을 누른 뒤에만 나온다.
              onFocus={() => setMerchantFocused(true)}
              placeholder="판매처를 입력해 주세요 (선택)"
              style={{
                backgroundColor: theme.colors.white,
                borderColor: "rgba(74, 63, 53, 0.10)",
                borderRadius: 14,
                borderWidth: 1,
                color: theme.colors.brown,
                minHeight: 48,
                paddingHorizontal: 14
              }}
              value={merchant}
            />
            {/* GAP-056 #2 — 판매처 자동완성 칩. 자리·문법은 품목명 아래 자동완성 줄과 같다
                (같은 pill·같은 높이·같은 한 줄 가로 스크롤). 라벨과 스크린리더 문장은 모듈이
                만든다 — 화면에 문구를 다시 쓰면 지출 상세와 두 문장으로 갈린다. */}
            {merchantSuggestions.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {merchantSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.merchant}
                    accessibilityRole="button"
                    accessibilityLabel={merchantSuggestionChipAccessibilityLabel(suggestion)}
                    hitSlop={SUGGEST_CHIP_HIT_SLOP}
                    onPress={() => applyMerchantSuggestion(suggestion.merchant)}
                    style={{
                      alignItems: "center",
                      backgroundColor: theme.colors.white,
                      borderColor: theme.colors.primary100,
                      borderRadius: theme.radii.pill,
                      borderWidth: 1,
                      justifyContent: "center",
                      minHeight: 38,
                      paddingHorizontal: 14
                    }}
                  >
                    <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
                      {formatMerchantSuggestionChipLabel(suggestion)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        <TextInput
          accessibilityLabel="메모 입력 (선택)"
          returnKeyType="done"
          // GAP-056 #1: 서버 @MaxLength와 같은 숫자(단일 소스는 src/expenses/text-limits.ts).
          maxLength={MEMO_MAX_LENGTH}
          onChangeText={setMemo}
          placeholder="메모를 입력해 주세요 (선택)"
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: 14,
            borderWidth: 1,
            color: theme.colors.brown,
            minHeight: 48,
            paddingHorizontal: 14
          }}
          value={memo}
        />

        <Pressable
          accessibilityLabel="결제 수단 변경"
          accessibilityRole="button"
          onPress={() => setPaymentMethodIndex((value) => (value + 1) % quickExpensePaymentMethods.length)}
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 16
          }}
        >
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>결제 수단</Text>
            <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{paymentMethod.label}</Text>
          </View>
          <Text style={{ color: theme.colors.gray600, fontSize: 18 }}>›</Text>
        </Pressable>

        {authToken ? (
          <View style={{ gap: 8 }}>
            <TextInput
              accessibilityLabel="품목명 입력"
              returnKeyType="done"
              // GAP-056 #1: 서버 @MaxLength와 같은 숫자(단일 소스는 src/expenses/text-limits.ts).
              maxLength={ITEM_NAME_MAX_LENGTH}
              onChangeText={handleItemNameChange}
              placeholder="품목명 (예: 기저귀)"
              // DSN-053 P2-C: 요약바의 연필과 빠른 품목의 "직접 입력"이 겨누는 유일한 입력칸.
              ref={itemNameInputRef}
              style={{
                backgroundColor: theme.colors.white,
                borderColor: "rgba(74, 63, 53, 0.10)",
                borderRadius: 14,
                borderWidth: 1,
                color: theme.colors.brown,
                fontSize: 14,
                fontWeight: "700",
                minHeight: 48,
                paddingHorizontal: 14
              }}
              value={itemName}
            />
            {/* UX-C: 타이핑에 연동된 과거 항목 자동완성. 폼 상단의 "최근 품목" 칩(EXP-113)과는
                자리도 트리거도 다르다 -- 저쪽은 타이핑과 무관한 최근 N건이고, 이 줄은 지금 친
                글자에 걸리는 상위 3개만 입력칸 바로 아래에 붙는다. 탭 한 번에 이름·금액·
                카테고리가 함께 채워지고(저장은 여전히 저장하기 버튼), 세션 없는 픽셀 락
                캡처에서는 이 분기 자체가 렌더되지 않는다. */}
            {itemAutocompleteChips.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {itemAutocompleteChips.map((chip) => (
                  <Pressable
                    key={chip.itemName}
                    accessibilityRole="button"
                    accessibilityLabel={itemAutocompleteChipAccessibilityLabel(chip, categoryNameForChip(chip.categoryId))}
                    hitSlop={SUGGEST_CHIP_HIT_SLOP}
                    onPress={() => applyItemAutocompleteChip(chip)}
                    style={{
                      alignItems: "center",
                      backgroundColor: theme.colors.white,
                      borderColor: theme.colors.primary100,
                      borderRadius: theme.radii.pill,
                      borderWidth: 1,
                      justifyContent: "center",
                      minHeight: 38,
                      paddingHorizontal: 14
                    }}
                  >
                    <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
                      {formatItemAutocompleteChipLabel(chip, categoryNameForChip(chip.categoryId))}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : (
          <View style={{ display: "none" }}>
            <TextInput onChangeText={setItemName} value={itemName} />
          </View>
        )}

        {authToken ? (
          <Pressable
            accessibilityLabel="선물로 받았어요"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isGift }}
            onPress={() => setIsGift((value) => !value)}
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.white,
              borderColor: "rgba(74, 63, 53, 0.10)",
              borderRadius: 14,
              borderWidth: 1,
              flexDirection: "row",
              gap: 10,
              padding: 14
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: isGift ? theme.colors.mainCoral : theme.colors.white,
                borderColor: isGift ? theme.colors.mainCoral : theme.colors.gray300,
                borderRadius: 6,
                borderWidth: 2,
                height: 22,
                justifyContent: "center",
                width: 22
              }}
            >
              {isGift ? <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: "900" }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>선물로 받았어요</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>선물은 지출 합계에 포함되지 않아요</Text>
            </View>
          </Pressable>
        ) : null}

        {/* UX-K(A): 금액을 치는 그 자리에서 "이번 달 지금까지"를 한 줄로 알려 준다 -- 탭을
            옮기지 않고도 총액을 확인할 수 있어야 핵심 루프(기록 -> 총액 확인)가 끊기지 않는다.
            숫자와 문구는 전부 src/expenses/entry-context-line.ts에서 오고, 캐시가 없으면 그
            모듈이 null을 돌려줘 줄 자체가 사라진다(0원이라고 말하지 않는다). 세션 없는 픽셀 락
            캡처에서는 이 분기 자체가 렌더되지 않는다. */}
        {authToken && entryContextLine ? (
          <Text accessibilityLabel={entryContextLine.accessibilityLabel} style={{ color: theme.colors.gray600, fontSize: 12 }}>
            {entryContextLine.text}
          </Text>
        ) : null}

        {/* UX-121: 금액 누적 프리셋 칩 -- 탭할 때마다 현재 금액에 더한다(빈 값이면 그 값으로 시작).
            숫자 키패드를 대체하지 않고 보조하므로 칩을 누른 뒤에도 자유롭게 타이핑할 수 있고,
            칩을 길게 누르거나 "지우기"를 누르면 0으로 리셋된다. 가산·상한 계산은
            src/expenses/amount-presets.ts에 분리(DNC-013 정수·상한 규칙과 정합, 단위 테스트 대상).
            DSN-053 P2-C: 금액 칸이 하단 고정 요약바로 내려가면서 이 행도 함께 본문 맨 아래로
            옮겼다 -- 칩은 자기가 더하는 금액 칸 바로 위에 있어야 무엇을 바꾸는 버튼인지 보인다.
            픽셀 락 캡처는 세션 없이(authToken null) 실행되므로(app/pixel-lock.tsx가 clearSession
            후 이동) 캡처 화면에는 이 행이 아예 렌더되지 않는다. */}
        {authToken ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            {QUICK_AMOUNT_PRESETS_KRW.map((presetKrw) => (
              <Pressable
                key={presetKrw}
                accessibilityRole="button"
                accessibilityLabel={presetChipAccessibilityLabel(presetKrw)}
                accessibilityHint="길게 누르면 금액을 지워요"
                accessibilityState={{ disabled: !canTapAmountPreset }}
                disabled={!canTapAmountPreset}
                hitSlop={8}
                onPress={() => setAmountText((value) => addAmountPreset(value, presetKrw))}
                onLongPress={() => setAmountText(clearAmountText())}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.white,
                  borderColor: theme.colors.primary100,
                  borderRadius: theme.radii.pill,
                  borderWidth: 1,
                  flex: 1,
                  justifyContent: "center",
                  minHeight: 40,
                  opacity: canTapAmountPreset ? 1 : 0.4
                }}
              >
                {/* A11Y-117: 13px coral 텍스트 -- coral[500] 3.16:1(AA 미달) → coral[700] */}
                <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "800" }}>
                  {formatPresetChipLabel(presetKrw)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="금액 지우기"
              hitSlop={8}
              onPress={() => setAmountText(clearAmountText())}
              style={{ alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 4 }}
            >
              <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>지우기</Text>
            </Pressable>
          </View>
        ) : null}

        </BottomSheetFrame>
      </View>
    </AppScreen>

      {/* DSN-053 P2-C — 하단 고정 요약바 (승인 원본의 푸터).
          왼쪽은 "무엇을 기록하는가"(분류 라벨 11/700 -> 품목명 15/800 + 연필), 오른쪽은
          "얼마인가"(beige 금액 박스 · radius 14 · 숫자 22/800 + '원' 14/800, 값이 있으면
          mainCoral 테두리)다. 연필은 본문의 품목명 입력칸으로 커서를 옮길 뿐이고, 저장 버튼
          두 개는 배치·문구·가드 모두 종전 그대로다(같은 뮤테이션·같은 분류 가드). */}
      <View
        style={{
          backgroundColor: theme.colors.white,
          borderColor: "rgba(74, 63, 53, 0.10)",
          borderTopWidth: 1,
          paddingHorizontal: 20,
          paddingVertical: 12
        }}
      >
        <View style={{ alignSelf: "center", gap: 10, maxWidth: 680, width: "100%" }}>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              {/* 분류를 아직 고르지 않았으면 지어내지 않는다 -- 무엇을 하면 되는지만 적는다. */}
              <Text style={{ color: theme.colors.gray600, fontSize: 11, fontWeight: "700" }}>
                {selectedCategory ? selectedCategory.label : "분류 선택"}
              </Text>
              <Pressable
                accessibilityLabel={itemName ? `${itemName} 품목명 수정` : "품목명 입력하기"}
                accessibilityRole="button"
                disabled={!authToken}
                onPress={() => itemNameInputRef.current?.focus()}
                style={({ pressed }) => ({
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 6,
                  minHeight: 44,
                  opacity: !authToken ? 1 : pressed ? 0.76 : 1
                })}
              >
                <Text numberOfLines={1} style={{ color: theme.colors.brown, flex: 1, fontSize: 15, fontWeight: "800" }}>
                  {itemName || "품목을 골라 주세요"}
                </Text>
                {itemName && authToken ? <AppIcon color={theme.colors.gray600} name="pencil-outline" size={18} /> : null}
              </Pressable>
            </View>
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.beige,
                borderColor: amountText ? theme.colors.mainCoral : "transparent",
                borderRadius: 14,
                borderWidth: 1,
                flexDirection: "row",
                minHeight: 52,
                paddingHorizontal: 12,
                width: width >= 600 ? 220 : 148
              }}
            >
              <TextInput
                accessibilityLabel="지출 금액 입력"
                accessibilityValue={{ text: formattedAmount }}
                keyboardType="number-pad"
                onChangeText={(value) => setAmountText(amountDigitsOnly(value))}
                placeholder="0"
                placeholderTextColor={theme.colors.gray600}
                style={{
                  color: theme.colors.gray900,
                  flex: 1,
                  fontSize: 22,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "800",
                  minHeight: 50,
                  paddingVertical: 0,
                  textAlign: "right"
                }}
                value={amountInputDisplay}
              />
              <Text style={{ color: theme.colors.gray600, fontSize: 14, fontWeight: "800" }}>원</Text>
            </View>
          </View>

          {/* EXP-124: 저장 버튼 바로 위 인라인 오류 배너. Toast는 이 앱에서 화면 흐름 안에 그대로
              놓이는 인라인 알림이고(accessibilityRole="alert" + live region으로 TalkBack에도
              읽힌다), 실패해도 입력값은 그대로 남아 사용자가 고쳐서 바로 다시 저장할 수 있다.
              초기값이 null이라 EXP-001 픽셀 락 캡처(세션 없음, 저장 시도 없음)에서는 렌더되지
              않는다. */}
          {saveErrorMessage ? <Toast message={saveErrorMessage} tone="error" /> : null}
          {savedMessage ? <Toast message={savedMessage} tone="success" /> : null}
          {/* 라운드 51 C-#5 + 라운드 51 QA(P2-4): 분류를 고르지 않은 채 저장을 누른 뒤에만 뜨는
              안내 한 줄. 자리는 **저장 버튼 바로 위**다(저장 실패 배너와 같은 자리 관례) --
              타일 아래에 두던 예전 자리는 금액·날짜·판매처·결제수단·선물 체크박스 아래로 밀려
              화면 밖이라, 저장을 눌러도 아무 반응이 없는 것처럼 보였다. 눌린 버튼 옆에서 답하고,
              무엇을 하면 되는지는 문구가 말한다(문구는 src/expenses/entry-form-guards.ts).
              포커스가 저장 버튼에 있는 상태에서 나타나므로 alert 역할 + live region으로
              스크린리더도 함께 읽는다. 초기값이 false라 EXP-001 픽셀 락 캡처(세션 없음, 저장
              시도 없음)에서는 렌더되지 않는다.
              A11Y-117(DSN-053 P2-C): 12px coral 텍스트라 coral[700](5.56:1)로 -- mainCoral은
              3.16:1로 AA 미달이고, 이 줄은 저장이 왜 멈췄는지를 말하는 유일한 자리다. */}
          {showCategoryNotice ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.coral[700], fontSize: 12, fontWeight: "700" }}
            >
              {CATEGORY_REQUIRED_NOTICE}
            </Text>
          ) : null}
          {/* GAP-054 #2 — 금액 상한 안내. 분류 안내와 **같은 자리**(저장 버튼 바로 위)이고,
              저장을 누르기 전에 뜬다: 상한을 넘는 순간 저장 버튼이 비활성이 되므로(위
              isAmountInvalid) 이유를 말해 주지 않으면 "왜 저장이 안 되지"만 남는다. 문구는
              src/expenses/amount-limit.ts 단일 소스(서버 @Max와 같은 숫자)이고, 금액을 줄이면
              저절로 사라진다. 초기값 기준으로 세션 없는 EXP-001 캡처에서는 언제나 false다.

              라운드 57 QA(P2-10) — **색은 theme.colors.danger다.** 조사 결과 이 저장소의 "저장을
              막는 이유" 문구는 어디서나 danger로 그린다(app/budget.tsx·app/(onboarding)/budget.tsx·
              app/expenses/[expenseId].tsx·app/family/**·app/import/** 등 19개 화면). coral[700]은
              A11Y-117이 정한 **작은 브랜드 텍스트**의 색이지(TextButton·eyebrow·가격·증감·배지)
              오류 색이 아니다. 특히 `amountOverLimitMessage()`·`merchantOverLimitMessage()`가 만드는
              것은 지출 상세·예산 화면이 danger로 그리는 **글자 그대로 같은 문장**이라, 같은 말이
              화면마다 다른 색으로 서 있었다. 대비는 오히려 올라간다(coral[700] 6.36:1 → danger
              #B42318 7.0:1). 바로 위 분류 안내는 그대로 coral[700]이다 — 그 문장은 저장 버튼을
              잠그지 않는 **안내**이고, 이 화면에만 있어 어긋날 짝이 없다. */}
          {isAmountOverLimit ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.danger, fontSize: 12, fontWeight: "700" }}
            >
              {AMOUNT_OVER_LIMIT_NOTICE}
            </Text>
          ) : null}
          {/* GAP-056 #1 — 텍스트 길이 상한 안내. 금액 상한 안내와 **같은 자리·같은 문법**이다:
              상한을 넘긴 값이 있으면 저장 버튼이 잠기므로(isSaveBlocked) 이유를 여기서 말하지
              않으면 "왜 저장이 안 되지"만 남는다. 입력 칸 밑이 아니라 버튼 위인 이유는 분류
              안내와 같다 — 이 폼은 길어서 칸 밑 한 줄은 화면 밖으로 밀린다. 문구는
              src/expenses/text-limits.ts 단일 소스(서버 @MaxLength와 같은 숫자)이고, 글자를
              줄이면 저절로 사라진다. 세션 없는 EXP-001 캡처에서는 언제나 빈 목록이다.
              라운드 57 QA(P2-10): 색도 지출 상세와 같은 theme.colors.danger다 -- 같은 문장(같은
              모듈이 만든다)이 화면마다 다른 색으로 서지 않게. 근거는 위 금액 안내 주석 참고. */}
          {textOverLimitNotices.map((notice) => (
            <Text
              key={notice}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.danger, fontSize: 12, fontWeight: "700" }}
            >
              {notice}
            </Text>
          ))}
          {/* 라운드 58 통합리뷰 P1-1 — 아이 어긋남 안내. 금액·길이 안내와 **같은 자리·같은 문법**
              이다(저장 버튼 바로 위, danger, alert + live region): 저장 버튼이 잠기는 이유를
              말하지 않으면 "왜 저장이 안 되지"만 남는다. 문구는 src/offline/messages.ts 단일
              소스이고, 아이를 되돌리면 저절로 사라진다. 세션 없는 EXP-001 캡처에서는 언제나
              false다(파라미터 자체가 올 수 없고 판정도 authToken 뒤에 있다). */}
          {failedRowChildMismatch ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.danger, fontSize: 12, fontWeight: "700" }}
            >
              {FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={saveExpense.isPending || isSaveBlocked}
            label={saveExpense.isPending ? "저장 중" : "저장하기"}
            // 라운드 40 J-1: 잠긴 역할이면 안내만 띄우고 뮤테이션은 시작하지 않는다(guard 관례).
            // 버튼 자체는 그대로 둔다 -- disabled로 바꾸면 이유를 말할 자리가 사라진다.
            onPress={expenseGate.guard(() => {
              if (!prepareSave(false)) return;
              saveExpense.mutate();
            })}
          />
          {/* 라운드 48 T4(D1): 마트 연속 기록용 보조 버튼. 저장은 위 버튼과 **완전히 같은
              뮤테이션**을 타고(저장 규칙이 두 벌이 되지 않는다), 다른 것은 성공 후 화면을
              떠나는지 여부뿐이다. 준비템에서 넘어온 기록에서는 내놓지 않는다 -- 이유는
              canContinueRecording 주석에.

              EXP-001 픽셀락: 캡처는 세션 없이(app/pixel-lock.tsx가 clearSession 후 이동)
              초기 렌더만 찍으므로 authToken 게이트 뒤의 이 버튼은 기준 이미지에 나타나지 않는다
              (금액 프리셋 칩·선물 체크박스와 같은 게이트다). */}
          {authToken && canContinueRecording({ linkedItemTemplateId }) ? (
            <SecondaryButton
              disabled={saveExpense.isPending || isSaveBlocked}
              label={CONTINUE_RECORDING_LABEL}
              onPress={expenseGate.guard(() => {
                if (!prepareSave(true)) return;
                saveExpense.mutate();
              })}
            />
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
