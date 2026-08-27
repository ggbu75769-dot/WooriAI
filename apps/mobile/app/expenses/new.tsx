import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getSeoulToday, isFutureSeoulDate, isValidCalendarDate } from "@wooriai/domain";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import { buildExpenseRecordedPayload } from "../../src/analytics/events";
import { LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { categoryCatalog } from "../../src/categories";
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
import { clearQuickExpenseDraft, readQuickExpenseDraft, writeQuickExpenseDraft } from "../../src/expenses/draft-storage";
import {
  buildItemAutocompleteSuggestions,
  formatItemAutocompleteChipLabel,
  itemAutocompleteChipAccessibilityLabel,
  type ItemAutocompleteSuggestion
} from "../../src/expenses/item-autocomplete";
import type { MonthExpenses } from "../../src/expenses/month-expenses";
import { expenseMutationErrorMessage, INVALID_EXPENSE_INPUT_ERROR } from "../../src/expenses/save-error-messages";
import {
  buildRecentItemChips,
  formatRecentItemChipLabel,
  recentItemChipAccessibilityLabel
} from "../../src/expenses/recent-items";
import { formatKrw } from "../../src/money";
import { isCurrentlyOnline } from "../../src/offline/connectivity";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
import { createExpenseOffline } from "../../src/offline/sync-controller";
import { useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, BottomSheetFrame, CategoryChip, PrimaryButton, Toast } from "../../src/ui";
import { theme } from "../../src/theme";
import { QuickExpensePixelStyles } from "../../src/pixelLock/styles";

const quickExpenseScreenId = "pixel-screen-EXP-001 EXP-001";
// FMT-127 유지 근거: 이 '₩ 38,500'은 EXP-001 픽셀 락 **캡처에 실제로 찍혀 있는 문자열**이고,
// src/ui-pixel-lock-flow.test.ts가 이 파일에 이 리터럴이 남아 있는지를 계약으로 고정한다
// (["app/expenses/new.tsx", "₩ 38,500"]). src/money.ts의 "콤마+원, ₩ 금지" 규칙에는 어긋나지만
// 기준 이미지를 다시 찍을 수 없는 환경이므로 **캡처 경로만** 예외로 남긴다 -- 세션이 있는
// 실제 입력 경로는 아래 formattedAmount에서 formatKrw로 정리했다.
const quickExpenseAmountPreview = "₩ 38,500";
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

function formatExpenseDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return { iso: `${year}-${month}-${day}`, label: `${year}. ${month}. ${day} (${weekday})` };
}

// Validates a manually-typed expense date: format, calendar validity, then future-date rejection
// (reusing the same isValidCalendarDate/isFutureSeoulDate the server/local-backend enforce so the
// two never disagree). MOB-121: the calendar-valid wording intentionally differs from
// src/children/child-form.ts ("실제 존재하는 날짜인지 확인해 주세요.") — unifying copy is out of
// scope here (pixel-lock/test impact), so each screen keeps its existing message.
function validateExpenseDateInput(dateOnly: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return "YYYY-MM-DD 형식으로 입력해 주세요.";
  if (!isValidCalendarDate(dateOnly)) return "존재하지 않는 날짜예요.";
  try {
    if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";
  } catch {
    return "날짜를 다시 확인해 주세요.";
  }
  return null;
}

function buildRecentDateChips(today: Date) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const formatted = formatExpenseDate(date);
    const shortLabel = index === 0 ? "오늘" : index === 1 ? "어제" : index === 2 ? "그제" : `${date.getMonth() + 1}/${date.getDate()}`;
    return { iso: formatted.iso, shortLabel };
  });
}

function quickExpensePixelFrameStyle() {
  return {
    transform: [
      { translateX: QuickExpensePixelStyles.horizontalOffset },
      { translateY: QuickExpensePixelStyles.topOffset },
      { scale: QuickExpensePixelStyles.scale }
    ]
  } as const;
}

const quickExpenseCategoryGridStyle = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 13
  }
});

const quickExpenseCategoryTileStyle = StyleSheet.create({
  button: {
    alignItems: "center",
    flexBasis: "23%",
    gap: 7
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 15,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  iconBoxSelected: {
    backgroundColor: theme.colors.mainCoral,
    borderColor: theme.colors.mainCoral,
    shadowColor: theme.colors.mainCoral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12
  },
  iconText: {
    color: theme.colors.brown,
    fontSize: 20,
    fontWeight: "800"
  },
  iconTextSelected: {
    color: theme.colors.white
  },
  label: {
    color: theme.colors.brown,
    fontSize: 10,
    fontWeight: "800",
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
      style={quickExpenseCategoryTileStyle.button}
    >
      <View style={[quickExpenseCategoryTileStyle.iconBox, selected ? quickExpenseCategoryTileStyle.iconBoxSelected : null]}>
        <Text style={[quickExpenseCategoryTileStyle.iconText, selected ? quickExpenseCategoryTileStyle.iconTextSelected : null]}>{category.icon}</Text>
      </View>
      <Text numberOfLines={1} style={quickExpenseCategoryTileStyle.label}>
        {category.label}
      </Text>
    </Pressable>
  );
}

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<{ itemName?: string; itemTemplateId?: string }>();
  const linkedItemTemplateId = params.itemTemplateId ? String(params.itemTemplateId) : undefined;
  const prefilledItemName = params.itemName ? String(params.itemName) : "";
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  // Preview/pixel-lock capture (no session) keeps the fixed "기저귀"/"38500" seed so the
  // reference screenshot stays deterministic. A real or test session starts blank so opening
  // the sheet never silently records a 38,500원 지출 the user didn't enter (see save-button
  // disabled guard below). A session that arrived from "준비템 -> 지출 기록하고 준비 완료" prefills the
  // item name from the prepared-item template instead (see items/[itemTemplateId].tsx).
  const [itemName, setItemName] = useState(() => (authToken ? prefilledItemName : "기저귀"));
  const [amountText, setAmountText] = useState(() => (authToken ? "" : "38500"));
  const [memo, setMemo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(quickExpenseCategories[0]);
  const [paymentMethodIndex, setPaymentMethodIndex] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  // Kept literally as `authToken ? formatExpenseDate(today) : previewExpenseDate` (see
  // src/android-native-ui-quality.test.ts) -- this seeds the initial selected date; past-date
  // selection below can move `expenseDateIso` away from today for a real/test session.
  const initialExpenseDate = authToken ? formatExpenseDate(today) : previewExpenseDate;
  const [expenseDateIso, setExpenseDateIso] = useState(() => initialExpenseDate.iso);
  const expenseDate = authToken ? formatExpenseDate(new Date(`${expenseDateIso}T00:00:00`)) : previewExpenseDate;
  const recentDateChips = buildRecentDateChips(today);
  // Only meaningful while a real/test session is picking a manually-typed date; null means
  // either preview mode, chip-only selection, or an empty (not-yet-typed) custom field.
  const dateInputError =
    authToken && customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const paymentMethod = quickExpensePaymentMethods[paymentMethodIndex];
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const queryClient = useQueryClient();

  // UX-C(1/2): 품목명을 치는 동안 읽는 "과거 기록"의 원천 -- 홈/기록 탭이 이미 채워 둔
  // ["expenses", childId, 이번 달] 캐시다. 여기서 새 요청은 절대 하지 않는다(useQuery가 아니라
  // getQueryData): 시트를 여는 것만으로 네트워크가 도는 일이 없고, 오프라인에서도 마지막으로
  // 받아 둔 목록으로 그대로 동작하며, 캐시가 비어 있으면 추천/자동완성이 없을 뿐 기록 흐름은
  // 아무 영향을 받지 않는다. 세션이 없는 픽셀 락 캡처에서는 애초에 읽지 않는다.
  const currentYearMonth = formatExpenseDate(today).iso.slice(0, 7);
  const expenseHistory =
    (authToken && childId
      ? queryClient.getQueryData<MonthExpenses>(["expenses", childId, currentYearMonth])?.expenses
      : undefined) ?? noExpenseHistory;
  // 자동완성 칩 부제("· 기저귀")의 카테고리 이름. 이 화면이 실제로 선택할 수 있는 8타일일 때만
  // 붙인다 -- 엑셀 가져오기/지출 수정을 거쳐 서버 정식 카테고리(DB마다 다른 UUID)를 단 행은
  // 이 화면에서 이름을 확신할 수 없고(categoryNameFor는 그런 id를 "기타"로 떨어뜨린다), 칩에
  // 틀린 분류명을 적느니 품목명·금액만 보여 주는 편이 정직하다.
  const categoryNameForChip = (categoryId: string) =>
    quickExpenseCategories.find((category) => category.id === categoryId)?.label;

  // 사용자가 카테고리를 직접 골랐는지. 한 번이라도 손대면(타일 탭 / 최근 품목 칩 / 자동완성 칩
  // / 임시 저장 복원) 자동 추천은 그 뒤로 절대 덮어쓰지 않는다 -- 저장 직전에 분류가 조용히
  // 바뀌면 그건 사용자가 기록한 것과 다른 사실이 남는 것이다.
  const categoryTouchedRef = useRef(false);
  // 라운드 33 F3: "자동으로 골라 줬다"를 boolean이 아니라 **무엇을 어떤 이름 기준으로 골랐는지**로
  // 들고 있는다. 근거(추천)가 사라졌을 때 그 선택이 아직 기계가 고른 그대로인지 판단하려면
  // 이 두 가지가 필요하다 -- 아래 추천 effect 참고.
  const [autoPickedCategory, setAutoPickedCategory] = useState<AutoPickedCategory | null>(null);
  // 자동완성 칩으로 한 번에 채운 직후에는 같은 칩이 그대로 남지 않도록 접는다. 다시 타이핑하면
  // (handleItemNameChange) 풀린다.
  const [autocompleteApplied, setAutocompleteApplied] = useState(false);

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
      setItemName(draft.itemName);
      setAmountText(draft.amountText);
      setMemo(draft.memo);
      const matchedCategory = quickExpenseCategories.find((category) => category.id === draft.categoryId);
      if (matchedCategory) setSelectedCategory(matchedCategory);
      // UX-C: 복원한 분류는 사용자가 이미 보고 있던 값이므로 자동 추천이 덮어쓰지 않는다.
      categoryTouchedRef.current = true;
      if (draft.spentOnIso) setExpenseDateIso(draft.spentOnIso);
      setIsGift(draft.isGift);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced draft autosave: persists the in-progress quick-expense entry ~500ms after the
  // last edit, so it can be restored by the effect above if the sheet is closed before saving.
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!authToken) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      writeQuickExpenseDraft({
        itemName,
        amountText,
        memo,
        categoryId: selectedCategory.id,
        spentOnIso: expenseDateIso,
        isGift
      });
    }, 500);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [itemName, amountText, memo, selectedCategory.id, expenseDateIso, isGift, authToken]);

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
  // 표시조차 없다). 그래서 근거가 사라지면 **기계가 고른 그 값일 때만** 기본 타일로 되돌린다 --
  // 사용자가 한 번이라도 손댔으면(categoryTouchedRef) 위에서 이미 반환했으므로 절대 건드리지 않고,
  // 되돌린 뒤에는 남는 것이 처음 상태(기본 타일 · 캡션 없음)뿐이라 아무것도 지어내지 않는다.
  useEffect(() => {
    if (!authToken) return;
    if (categoryTouchedRef.current) return;
    const nextSelection = resolveAutoCategorySelection({
      itemName,
      history: expenseHistory,
      currentCategoryId: selectedCategory.id,
      autoPicked: autoPickedCategory,
      defaultCategoryId: quickExpenseCategories[0].id
    });
    const suggestedCategory = quickExpenseCategories.find((category) => category.id === nextSelection.categoryId);
    if (!suggestedCategory) return;
    setSelectedCategory((current) => (current.id === suggestedCategory.id ? current : suggestedCategory));
    // 같은 값이면 새 객체로 갈아끼우지 않는다 -- autoPickedCategory가 이 effect의 의존성이라
    // 매번 새 객체를 쓰면 렌더 루프가 된다.
    if (!isSameAutoPickedCategory(autoPickedCategory, nextSelection.autoPicked)) {
      setAutoPickedCategory(nextSelection.autoPicked);
    }
  }, [authToken, itemName, expenseHistory, selectedCategory.id, autoPickedCategory]);

  // 타이핑 연동 자동완성 후보(상위 3개). 칩으로 한 번 채운 뒤에는 다시 타이핑할 때까지 접힌다.
  const itemAutocompleteChips =
    authToken && !autocompleteApplied ? buildItemAutocompleteSuggestions(itemName, expenseHistory) : [];

  const handleItemNameChange = (value: string) => {
    setItemName(value);
    setAutocompleteApplied(false);
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
  const offlineSnapshot = useOfflineSyncSnapshot();
  const recentItemChips = authToken && childId ? buildRecentItemChips(offlineSnapshot.rows, childId) : [];

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
  const saveExpense = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountText);
      if (!authToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim() || Boolean(dateInputError)) {
        throw new Error(INVALID_EXPENSE_INPUT_ERROR);
      }
      return createExpenseOffline(authToken, queryClient, {
        childId,
        categoryId: selectedCategory.id,
        amountKrw,
        spentOn: expenseDate.iso,
        itemName,
        paymentMethod: paymentMethod.value,
        memo,
        expenseType: isGift ? "gift" : "expense",
        ...(linkedItemTemplateId ? { linkedItemTemplateId } : {})
      });
    },
    // 다음 저장 시도가 시작되면 이전 실패 배너를 먼저 지운다 -- 재시도는 저장 버튼을 다시
    // 누르는 것으로 충분하므로 별도 "다시 시도" 컨트롤을 만들지 않는다.
    onMutate: () => {
      setSaveErrorMessage(null);
    },
    onError: (error) => {
      setSaveErrorMessage(expenseMutationErrorMessage("create", error));
    },
    onSuccess: async () => {
      clearQuickExpenseDraft();
      setSaveErrorMessage(null);
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      // ANA-103: expense_recorded fires once per successful (local-first) create. The payload is
      // PII-safe by construction (src/analytics/events.ts): the raw amount is bucketed and the
      // categoryId mapped to the coarse enum on-device; itemName/memo never enter it. `source`
      // distinguishes the "준비템 -> 지출 기록하고 준비 완료" follow-up flow from a plain manual entry,
      // and `offline` reports the connectivity at record time (the create itself always succeeds
      // locally first -- see createExpenseOffline). A no-op without ANA-102 consent.
      const recordedAmountKrw = Number(amountText);
      const recordedCategoryId = selectedCategory.id;
      const recordedSource = linkedItemTemplateId ? "followup" : "manual";
      // 리뷰 F6: categoryId는 이 화면의 8타일(categoryCatalog) 중 하나뿐이다 — 지출 수정 화면은
      // expense_recorded를 발화하지 않으므로 서버 카테고리 목록 해석은 필요 없다.
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
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
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
      setTimeout(() => router.replace("/(tabs)/records"), 650);
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
  const isPixelLockAmountCapture = !authToken && amountText === "38500";
  const formattedAmount = isPixelLockAmountCapture ? quickExpenseAmountPreview : formatKrw(Number(amountText || 0));
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
  const isAmountInvalid =
    Boolean(authToken) && (!amountText || !Number.isInteger(amountKrwValue) || amountKrwValue <= 0 || Boolean(dateInputError));

  return (
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
            gap: 14,
            padding: 0,
            position: "relative"
          }}
        >
        <View testID={quickExpenseScreenId} style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 40 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={8}
            onPress={() => {
              clearQuickExpenseDraft();
              router.back();
            }}
            style={{ minWidth: 36 }}
          >
            <Text style={{ color: theme.colors.gray900, fontSize: 24 }}>×</Text>
          </Pressable>
          <Text style={{ color: theme.colors.gray900, fontSize: 18, fontWeight: "800" }}>지출 기록</Text>
          <View style={{ width: 36 }} />
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
                  hitSlop={3}
                  onPress={() => {
                    setItemName(chip.itemName);
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

        <View
          style={{
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.12)",
            borderRadius: 14,
            borderWidth: 1,
            gap: 12,
            padding: 16
          }}
        >
          {authToken ? (
            <Pressable
              accessibilityLabel="지출 날짜 변경"
              accessibilityRole="button"
              onPress={() => setShowDatePicker((value) => !value)}
              style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>{expenseDate.label}</Text>
              <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>{showDatePicker ? "닫기" : "날짜 변경"}</Text>
            </Pressable>
          ) : (
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "700" }}>{expenseDate.label}</Text>
            </View>
          )}
          <View style={{ backgroundColor: "rgba(74, 63, 53, 0.12)", height: 1 }} />
          <TextInput
            accessibilityLabel="지출 금액 입력"
            keyboardType="number-pad"
            onChangeText={(value) => setAmountText(value.replace(/[^0-9]/g, ""))}
            style={{ color: theme.colors.gray900, fontSize: 30, fontWeight: "800", paddingVertical: 0 }}
            value={formattedAmount}
          />
        </View>

        {/* UX-121: 금액 누적 프리셋 칩 -- 탭할 때마다 현재 금액에 더한다(빈 값이면 그 값으로 시작).
            숫자 키패드를 대체하지 않고 보조하므로 칩을 누른 뒤에도 자유롭게 타이핑할 수 있고,
            칩을 길게 누르거나 "지우기"를 누르면 0으로 리셋된다. 가산·상한 계산은
            src/expenses/amount-presets.ts에 분리(DNC-013 정수·상한 규칙과 정합, 단위 테스트 대상).
            금액 입력 카드 "아래"의 독립 행이라 EXP-001 픽셀 락이 고정한 카드/카테고리 그리드
            레이아웃을 건드리지 않으며, 픽셀 락 캡처는 세션 없이(authToken null) 실행되므로
            (app/pixel-lock.tsx가 clearSession 후 이동) 캡처 화면에는 아예 렌더되지 않는다. */}
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

        {authToken && showDatePicker ? (
          <View style={{ gap: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentDateChips.map((chip) => (
                <CategoryChip
                  key={chip.iso}
                  label={chip.shortLabel}
                  selected={!customDateMode && chip.iso === expenseDateIso}
                  onPress={() => {
                    setExpenseDateIso(chip.iso);
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
                      if (!error) setExpenseDateIso(cleaned);
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
                  <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{dateInputError}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={quickExpenseCategoryGridStyle.grid}>
          {quickExpenseCategories.map((category) => {
            const selected = category.label === selectedCategory.label;
            return (
              <ExpenseCategoryIconButton
                key={`${category.id}-${category.label}`}
                selected={selected}
                category={category}
                onPress={() => {
                  // UX-C: 직접 고른 순간부터 자동 추천은 이 선택을 덮어쓰지 않는다.
                  categoryTouchedRef.current = true;
                  setAutoPickedCategory(null);
                  setSelectedCategory(category);
                  setItemName(category.label);
                }}
              />
            );
          })}
        </View>

        {/* UX-C: 자동으로 골라 줬을 때만 뜨는 미세 캡션. 타일 자체는 평소와 똑같은 선택 상태로
            보이고(추천이라고 다르게 칠하지 않는다), 사용자가 타일을 직접 누르거나 칩으로
            카테고리를 확정하면 바로 사라진다. 세션 없는 픽셀 락 캡처에서는 렌더되지 않는다. */}
        {authToken && autoPickedCategory ? (
          <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>{AUTO_CATEGORY_CAPTION}</Text>
        ) : null}

        <TextInput
          accessibilityLabel="메모 입력 (선택)"
          returnKeyType="done"
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
              onChangeText={handleItemNameChange}
              placeholder="품목명 (예: 기저귀)"
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
                    hitSlop={3}
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

        {/* EXP-124: 저장 버튼 바로 위 인라인 오류 배너. Toast는 이 앱에서 화면 흐름 안에 그대로
            놓이는 인라인 알림이고(accessibilityRole="alert" + live region으로 TalkBack에도
            읽힌다), 실패해도 입력값은 그대로 남아 사용자가 고쳐서 바로 다시 저장할 수 있다.
            초기값이 null이라 EXP-001 픽셀 락 캡처(세션 없음, 저장 시도 없음)에서는 렌더되지
            않는다. */}
        {saveErrorMessage ? <Toast message={saveErrorMessage} tone="error" /> : null}
        {savedMessage ? <Toast message={savedMessage} tone="success" /> : null}
          <PrimaryButton
            disabled={saveExpense.isPending || isAmountInvalid}
            label={saveExpense.isPending ? "저장 중" : "저장하기"}
            onPress={() => saveExpense.mutate()}
          />
        </BottomSheetFrame>
      </View>
    </AppScreen>
  );
}
