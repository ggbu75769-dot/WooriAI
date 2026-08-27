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
  clearAmountText,
  formatPresetChipLabel,
  presetChipAccessibilityLabel,
  QUICK_AMOUNT_PRESETS_KRW
} from "../../src/expenses/amount-presets";
import { clearQuickExpenseDraft, readQuickExpenseDraft, writeQuickExpenseDraft } from "../../src/expenses/draft-storage";
import {
  buildRecentItemChips,
  formatRecentItemChipLabel,
  recentItemChipAccessibilityLabel
} from "../../src/expenses/recent-items";
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
  const saveExpense = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountText);
      if (!authToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim() || Boolean(dateInputError)) {
        throw new Error("invalid expense");
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
    onSuccess: async () => {
      clearQuickExpenseDraft();
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
      // C2/REC-121: 공용 ["categories"] 캐시(기록·리포트·더보기·지출 수정 화면이 채운다)를 그대로
      // 읽어 categoryId를 분석 코드로 해석한다. 정적 8타일 밖의 id(정식 12개 시드 UUID, 데모
      // 픽스처, 오래된 초안)가 전부 "etc"로 뭉개지지 않게 하려는 것 — 캐시가 비어 있으면 기존
      // 8타일 매핑으로 폴백하고, 목록 자체는 payload에 들어가지 않는다(코드 enum만 나간다).
      const cachedCategories = queryClient.getQueryData<{ categories: Array<{ id: string; code: string }> }>(["categories"]);
      void isCurrentlyOnline().then((online) => {
        trackAndFlushAnalyticsEvent(authToken, {
          eventName: "expense_recorded",
          payload: buildExpenseRecordedPayload({
            categoryId: recordedCategoryId,
            amountKrw: recordedAmountKrw,
            source: recordedSource,
            offline: !online,
            serverCategories: cachedCategories?.categories
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
  const formattedAmount = amountText === "38500" ? quickExpenseAmountPreview : `₩ ${Number(amountText || 0).toLocaleString("ko-KR")}`;
  // Guards the one-tap quick-expense sheet: with a real/test session, the save button stays
  // disabled until a positive amount has actually been entered (and any manually-typed date is
  // valid), so opening the sheet can never by itself create an expense. Preview mode (authToken
  // null) is unaffected -- amountText is always the fixed "38500" seed there, so isAmountInvalid
  // is always false.
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
                    const matchedCategory = quickExpenseCategories.find((category) => category.id === chip.categoryId);
                    if (matchedCategory) setSelectedCategory(matchedCategory);
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
                  minHeight: 40
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
                  setSelectedCategory(category);
                  setItemName(category.label);
                }}
              />
            );
          })}
        </View>

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
          <TextInput
            accessibilityLabel="품목명 입력"
            returnKeyType="done"
            onChangeText={setItemName}
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

        {saveExpense.isError ? <Toast message="금액과 항목을 확인해 주세요." tone="error" /> : null}
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
