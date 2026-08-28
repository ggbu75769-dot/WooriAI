import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getSeoulToday, isFutureSeoulDate, isValidCalendarDate } from "@wooriai/domain";
import {
  getExpense,
  listCategories,
  listChildren,
  listHouseholdMembers,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN
} from "../../src/api/client";
import { categoryCatalog, categoryNameFor, selectableCategories } from "../../src/categories";
// 라운드 41 UX-U(B-ⓒ): 금액 프리셋 칩은 빠른 기록 시트(app/expenses/new.tsx)와 **같은 모듈**을 쓴다.
import {
  addAmountPreset,
  canAddAmountPreset,
  clearAmountText,
  formatPresetChipLabel,
  presetChipAccessibilityLabel,
  QUICK_AMOUNT_PRESETS_KRW
} from "../../src/expenses/amount-presets";
// 라운드 48 T3: 결제 수단 · 판매처 · 연결된 준비템 읽기 전용 행의 문구/판정 단일 소스.
import {
  linkedItemTemplateLink,
  LINKED_ITEM_ROW_LABEL,
  MERCHANT_ROW_LABEL,
  paymentMethodLabelKo,
  PAYMENT_METHOD_ROW_LABEL
} from "../../src/expenses/expense-detail-rows";
// 라운드 41 UX-U(B-ⓐ/ⓓ): source 한 줄과 "이 품목 이력"의 판정은 순수 모듈이 단일 소스다.
import { expenseSourceLine } from "../../src/expenses/expense-source-line";
import { buildItemHistory } from "../../src/expenses/item-history";
// 라운드 42 L-5: 이력 재조정을 **정규화된 품목명이 실제로 바뀔 때만** 돌리기 위한 같은 단일 소스
// (UX-C의 src/expenses/item-name-match.ts) -- buildItemHistory가 안에서 쓰는 정규화와 같은 함수다.
import { normalizeItemName } from "../../src/expenses/item-name-match";
import type { MonthExpenses } from "../../src/expenses/month-expenses";
import {
  expenseCreatedByUserId,
  resolveExpenseAuthorLabel,
  resolveExpenseHouseholdId
} from "../../src/expenses/records-list-view";
import {
  EXPENSE_DELETE_CONFIRM_ACTION_LABEL,
  EXPENSE_DELETE_CONFIRM_CANCEL_LABEL,
  EXPENSE_DELETE_CONFIRM_MESSAGE,
  EXPENSE_DELETE_CONFIRM_TITLE,
  EXPENSE_DELETE_FAILED_ALERT_TITLE,
  EXPENSE_NOT_READY_ERROR,
  expenseMutationErrorMessage,
  INVALID_EXPENSE_INPUT_ERROR
} from "../../src/expenses/save-error-messages";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { amountDigitsOnly, formatAmountDigits } from "../../src/money";
import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";
// 라운드 41 K-11의 useOfflineSyncSnapshot("이 품목 이력"의 모집단에 이 기기의 오프라인 대기·
// 실패·충돌 행을 합류시킨다)도 같은 모듈이라 한 줄로 합쳤다(라운드 42 L-5).
import {
  adoptServerExpense,
  deleteExpenseOffline,
  updateExpenseOffline,
  useOfflineSyncSnapshot
} from "../../src/offline/sync-controller";
import { useSessionStore } from "../../src/stores/session.store";
import { resolveScreenPhase } from "../../src/screen-phase";
import { AppScreen, Card, CategoryChip, EmptyStateCard, PrimaryButton, ScreenHeader, Toast } from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";

// FMT-127: 금액 표기(콤마)·입력 정규화는 src/money.ts가 단일 소스다 -- 이 화면에 있던
// toDigits/formatAmount 사본은 (예산 수정·온보딩 예산 화면의 같은 사본들과 함께) 제거했다.

function formatExpenseDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return { iso: `${year}-${month}-${day}`, label: `${year}. ${month}. ${day} (${weekday})` };
}

// MOB-121: calendar validity comes from @wooriai/domain's isValidCalendarDate (same check the
// server/local-backend enforce). The wording intentionally differs from src/children/child-form.ts
// ("실제 존재하는 날짜인지 확인해 주세요.") — copy unification is out of scope (pixel-lock/test
// impact), so this screen keeps its existing message.
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

export default function ExpenseDetailScreen() {
  const params = useLocalSearchParams<{ expenseId?: string }>();
  const expenseId = String(params.expenseId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  // UX-R(M): 보기 전용(viewer·gift_participant) 참여자는 지출을 **볼 수는 있지만** 고치거나
  // 지울 수 없다(서버 child-access.service.ts가 edit 경로만 403으로 막는다). 그래서 이 화면은
  // 그대로 열리고, 아래 "수정 저장"·"이 지출 삭제하기"만 같은 판정으로 안내한다 --
  // src/family/record-permissions.ts. 역할 미상·비세션에서는 예전 동작 그대로다.
  const expenseGate = useExpenseEntryGate();
  const queryClient = useQueryClient();
  const canLoadExpense = Boolean(authToken && expenseId);
  const expense = useQuery({
    queryKey: ["expense", expenseId],
    enabled: canLoadExpense,
    queryFn: () => getExpense(authToken!, expenseId)
  });
  // CAT-101/UX-5B-EXP: server-backed category list for the chip row (demo fixture categories in
  // a local test session -- see client.ts's listCategories). Categories are seed data that
  // changes rarely, so a generous staleTime avoids refetching on every edit-screen visit.
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken),
    staleTime: 5 * 60 * 1000,
    // CAT-124: includeAll=1 — 이 캐시 하나가 칩 목록과 이름 해석을 동시에 먹인다. 노출
    // 제외 행(퀵타일 별칭·가져오기 스텁)까지 받아야 이미 그 id로 저장된 지출의 현재
    // 카테고리를 칩으로 되살릴 수 있고(selectableCategories 규칙 d), 화면에 내미는 목록은
    // selectableCategories가 정식 12개로 좁힌다.
    queryFn: () => listCategories(authToken!, { includeAll: true })
  });
  // FAM-127: 작성자 표기용 구성원 목록 -- 기록 탭·가족 관리·설정과 같은 ["household-members",
  // householdId] 캐시를 그대로 재사용한다(대개 이미 채워져 있어 추가 요청이 없다). 실패하거나
  // 1인 가구면 아래 authorLabel이 null이 되어 이 화면은 예전과 똑같이 그려진다.
  //
  // 라운드 27 L-4: 구성원을 물어볼 가구는 세션의 기본 가구가 아니라 **이 지출이 속한 아이의
  // 가구**다(다가구 계정에서 두 값이 갈린다 -- resolveExpenseHouseholdId 주석 참고). 아이의
  // householdId는 새 엔드포인트 없이 같은 ["children"] 캐시에서 읽는다.
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const householdId = resolveExpenseHouseholdId({
    children: childrenQuery.data?.children,
    childId: expense.data?.childId,
    fallbackHouseholdId: sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null)
  });
  const householdMembers = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  const authorLabel = resolveExpenseAuthorLabel(
    expenseCreatedByUserId(expense.data),
    householdMembers.data?.members
  );
  // 라운드 41 UX-U(B-ⓐ): 응답으로 이미 받고 있던 `source`를 읽기 전용 한 줄로 쓴다. 손으로 적은
  // 기록("manual")과 모르는 값에는 아무 말도 하지 않으므로(src/expenses/expense-source-line.ts),
  // 지금까지의 대부분의 화면은 한 픽셀도 바뀌지 않는다.
  const sourceLine = expenseSourceLine(expense.data?.source);
  // 라운드 48 T3: 쓰기 전용이던 필드들의 왕복. 세 값 모두 **응답에 값이 있을 때만** 행이
  // 생긴다(순수 모듈이 null을 돌려주면 렌더 자체가 없다) -- 값이 없던 지출·구 서버 응답·
  // 로컬 목업에서는 이 화면이 한 픽셀도 바뀌지 않는다.
  const paymentMethodLabel = paymentMethodLabelKo(expense.data?.paymentMethod);
  // 판매처는 아직 앱 안에 입력 경로가 없다(엑셀 가져오기/서버 데이터로만 채워진다) --
  // 그래서 "있으면 보여주는" 행이고, 없다고 빈 칸을 그리지 않는다.
  const merchantValue = expense.data?.merchant?.trim() ?? "";
  const linkedItem = linkedItemTemplateLink(expense.data?.linkedItemTemplateId);
  const [itemName, setItemName] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  const [memo, setMemo] = useState("");
  const [spentOnIso, setSpentOnIso] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  const recentDateChips = buildRecentDateChips(today);
  // MOB-102 (round5a-sprint1-plan.md §3.2, §3.4): an expense loaded here came from the normal
  // server/local-session getExpense call, so it has no offline local_expenses row yet. Editing
  // or deleting it needs to route through the same outbox/expectedVersion pipeline as an
  // offline-authored expense, so it's "adopted" into the local table (as an already-synced row)
  // the first time it loads -- see sync-controller.ts's adoptServerExpense.
  const [localExpenseId, setLocalExpenseId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // EXP-124: 수정 저장 실패 문구(문구 단일 소스는 src/expenses/save-error-messages.ts). 두
  // 뮤테이션 모두 onSuccess만 배선되어 있어 실패가 무음이었다 -- 수정 저장은 화면이 그대로
  // 남아 있으므로 저장 버튼 위 인라인 배너로, 삭제는 확인 Alert에서 이어지는 흐름이라 같은
  // 자리의 Alert로 알린다(아래 remove.onError).
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!expense.data) return;
    setItemName(expense.data.itemName);
    setAmountDigits(String(expense.data.amountKrw));
    setMemo(expense.data.memo ?? "");
    setSpentOnIso(expense.data.spentOn);
    setCategoryId(expense.data.categoryId);
    setIsGift(expense.data.expenseType === "gift");
    setLocalExpenseId(null);
    void adoptServerExpense(expense.data).then((row) => setLocalExpenseId(row.localId));
  }, [expense.data]);

  // Chip row source: the fetched category list when available; otherwise (query still loading,
  // or failing -- e.g. an offline real session) the static quick-expense catalog, so the row
  // never disappears and offline/preview editing keeps working. If the expense's current
  // categoryId isn't in whichever list is showing (legacy/inactive/demo-seed id), a chip for it
  // is prepended so preselection always has something to highlight and re-selecting it stays
  // possible.
  //
  // R20-B: the fetched list is passed through selectableCategories first -- `GET /categories`
  // returns all 21 active seed rows (12 canonical + 8 mobile aliases + 1 import stub), which put
  // "기타" on the row twice and offered the internal "가져오기 기본". The filter is display-only
  // (server response and every other screen are untouched) and always keeps this expense's
  // current categoryId, so the preselection above never loses its chip.
  const fetchedCategories = selectableCategories(categories.data?.categories ?? [], categoryId);
  const baseCategoryChips =
    fetchedCategories.length > 0
      ? fetchedCategories.map((category) => ({ id: category.id, label: category.name }))
      : categoryCatalog.map((category) => ({ id: category.id, label: `${category.icon} ${category.label}` }));
  const categoryChips =
    categoryId && !baseCategoryChips.some((chip) => chip.id === categoryId)
      ? [{ id: categoryId, label: categoryNameFor(categoryId) }, ...baseCategoryChips]
      : baseCategoryChips;

  // 라운드 41 UX-U(B-ⓓ): "이 품목 이력"의 원천은 홈/기록 탭이 이미 채워 둔
  // ["expenses", childId, 이번 달] 캐시를 **읽기만** 한 값이다(useQuery가 아니라 getQueryData —
  // 상세 화면을 여는 것만으로 새 요청이 도는 일이 없다, known-limitations H). 캐시가 없으면
  // buildItemHistory가 null을 돌려줘 섹션 자체가 사라진다(0건이라고 말하지 않는다).
  const currentYearMonth = formatExpenseDate(today).iso.slice(0, 7);
  const historyChildId = expense.data?.childId ?? null;
  // 라운드 41 K-11: 이 기기의 오프라인 스냅숏(외부 스토어 구독 — 새 요청이 아니다).
  const offlineSyncSnapshot = useOfflineSyncSnapshot();
  const cachedMonthExpenses =
    authToken && historyChildId
      ? queryClient.getQueryData<MonthExpenses>(["expenses", historyChildId, currentYearMonth])?.expenses
      : undefined;
  /**
   * 라운드 42 L-5 — 이력 재조정은 **입력을 칠 때마다**가 아니라 재료가 바뀔 때만 돌린다.
   *
   * 예전에는 `buildItemHistory`를 렌더 본문에서 그냥 불렀다. 그런데 이 화면은 품목·금액·메모
   * 입력이 전부 상태라, 키 한 번마다 이번 달 전체(서버 캐시 + 오프라인 스냅숏)를 다시 합치고
   * 정렬하고 걸렀다 -- 캐시가 수백 행이면 그 비용이 그대로 타이핑 지연이 된다.
   *
   * 의존성은 결과를 실제로 바꾸는 값들뿐이다. 품목명은 **정규화한 값**으로 잡는다: 이력 매칭이
   * 정규화 후 이름으로만 이뤄지므로(item-history.ts의 K-11 ②), "물티슈 "처럼 정규화가 같은
   * 입력에서는 다시 계산할 이유가 없다. 캐시·스냅숏은 참조가 바뀔 때만(= 내용이 바뀔 때만)
   * 다시 도는 값이다.
   */
  const normalizedHistoryItemName = normalizeItemName(itemName);
  const itemHistory = useMemo(
    () =>
      buildItemHistory({
        cachedMonthExpenses,
        cacheYearMonth: currentYearMonth,
        itemName,
        currentExpenseId: expenseId,
        // 라운드 41 K-11: "이번 달 기록 기준"이라고 말하려면 이 기기가 아는 이번 달 기록이 전부
        // 들어와야 한다. 서버 캐시 원본만 보면 아직 올라가지 않은 대기·실패·충돌 행이 빠지고,
        // 로컬에서 고친 서버 행은 바뀌기 전 금액으로 보인다. 기록 탭·홈 주간 카드·예산 화면과
        // 같은 재조정을 지나게 스냅숏을 그대로 넘긴다(순수 모듈이 childId·달로 좁힌다).
        offline: { rows: offlineSyncSnapshot.rows, childId: historyChildId }
      }),
    // itemName 자체가 아니라 정규화 값이 의존성이다(위 근거) -- 두 값은 같은 함수로 이어져 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cachedMonthExpenses, currentYearMonth, normalizedHistoryItemName, expenseId, offlineSyncSnapshot.rows, historyChildId]
  );

  const amountKrw = Number(amountDigits || "0");
  const itemNameError = itemName.trim().length === 0 ? "품목을 입력해 주세요." : null;
  const amountError = amountDigits.length > 0 && amountKrw <= 0 ? "0보다 큰 금액을 입력해 주세요." : null;
  const dateInputError = customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const spentOnLabel = spentOnIso ? formatExpenseDate(new Date(`${spentOnIso}T00:00:00`)).label : "";
  const canSave = !itemNameError && !amountError && !dateInputError && amountKrw > 0 && Boolean(authToken && expenseId && localExpenseId);
  const canTapAmountPreset = canAddAmountPreset(amountDigits);

  // 라운드 41 UX-U(B-ⓑ): 저장·삭제가 끝나면 **왔던 자리로** 돌아간다. 예전에는 무조건
  // router.replace("/(tabs)/records")라, 홈의 최근 기록·검색 결과·리포트에서 이 화면에 들어온
  // 사람도 전부 기록 탭에 떨궈져 진입 스택(그리고 그 화면의 스크롤·검색어·필터)이 사라졌다.
  // 스택이 없을 때(딥링크·알림에서 바로 열린 경우)만 종전처럼 기록 탭으로 보낸다.
  function leaveAfterMutation() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/records");
  }

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !localExpenseId || !Number.isInteger(amountKrw) || amountKrw <= 0 || !itemName.trim() || Boolean(dateInputError)) {
        throw new Error(INVALID_EXPENSE_INPUT_ERROR);
      }
      return updateExpenseOffline(authToken, queryClient, localExpenseId, {
        amountKrw,
        itemName: itemName.trim(),
        memo,
        spentOn: spentOnIso || undefined,
        categoryId: categoryId || undefined,
        expenseType: isGift ? "gift" : "expense"
      });
    },
    // 재시도는 "수정 저장"을 다시 누르는 것으로 충분하므로, 다음 시도가 시작될 때 이전 배너만
    // 지운다(입력값은 그대로 남는다).
    onMutate: () => {
      setSaveErrorMessage(null);
    },
    onError: (error) => {
      setSaveErrorMessage(expenseMutationErrorMessage("update", error));
    },
    onSuccess: async () => {
      setSaveErrorMessage(null);
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["expense", expenseId] });
      setTimeout(leaveAfterMutation, 650);
    }
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!authToken || !localExpenseId) throw new Error(EXPENSE_NOT_READY_ERROR);
      return deleteExpenseOffline(authToken, queryClient, localExpenseId);
    },
    // 삭제는 확인 Alert에서 이어지는 흐름이라, 실패도 같은 자리(Alert)에서 알려야 사용자가
    // 방금 누른 "삭제"가 어떻게 됐는지 놓치지 않는다. 화면은 그대로 남으므로 다시 시도할 수 있다.
    onError: (error) => {
      Alert.alert(EXPENSE_DELETE_FAILED_ALERT_TITLE, expenseMutationErrorMessage("delete", error));
    },
    onSuccess: async () => {
      setSavedMessage(OFFLINE_SAVED_MESSAGE);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setTimeout(leaveAfterMutation, 650);
    }
  });

  // UX-L(A): 확인 문구는 src/expenses/save-error-messages.ts가 단일 소스다 — 기록 목록의 행
  // 액션시트(app/(tabs)/records.tsx)가 같은 삭제를 실행하면서 같은 상수를 읽는다. 문구를 양쪽에
  // 적어 두면 같은 파괴적 동작이 화면마다 다르게 물어보게 된다.
  function confirmDelete() {
    // 잠긴 세션에서는 파괴적 확인 Alert 자체를 띄우지 않는다 -- 지울 수 없는 사람에게
    // "정말 삭제할까요?"를 먼저 묻는 것은 두 번째 거짓말이다.
    if (expenseGate.locked) {
      expenseGate.explain();
      return;
    }
    Alert.alert(EXPENSE_DELETE_CONFIRM_TITLE, EXPENSE_DELETE_CONFIRM_MESSAGE, [
      { text: EXPENSE_DELETE_CONFIRM_CANCEL_LABEL, style: "cancel" },
      { text: EXPENSE_DELETE_CONFIRM_ACTION_LABEL, style: "destructive", onPress: () => remove.mutate() }
    ]);
  }

  // MOB-130: 에러 → 로딩 → 정상 순서는 resolveScreenPhase가 정한다(src/screen-phase.ts).
  // 쿼리가 꺼져 있을 때(토큰/expenseId 없음)는 isPending이 영영 true로 남으므로, 가족 화면과
  // 같은 관례로 `canLoadExpense &&`를 앞에 두어 판정 자체를 적용하지 않는다.
  const expensePhase = resolveScreenPhase({
    isPending: expense.isPending,
    isError: expense.isError,
    hasData: Boolean(expense.data)
  });

  return (
    <AppScreen>
      <View testID="screen-EXP-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="지출 상세"
          title="지출 수정"
          subtitle="품목과 금액을 확인하고 수정할 수 있어요."
          onBack={() => router.back()}
        />

        {canLoadExpense && expensePhase === "error" ? (
          <EmptyStateCard
            title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            actionLabel="다시 시도"
            onPress={() => expense.refetch()}
          />
        ) : canLoadExpense && expensePhase === "loading" ? (
          // UX-Q(B): 저장소에 마지막까지 남아 있던 가짜 버튼 로딩 카드(EmptyStateCard의 액션
          // 라벨만 있고 onPress는 없어, 누를 수 있게 생겼는데 아무 일도 일어나지 않았다)를
          // 걷어낸다 -- MOB-119가 나머지 화면에서 걷어낸 것과 같은 패턴이다. 본 화면의 형태
          // (입력 카드 + 저장/삭제 줄)를 따라가는 스켈레톤으로 바꾼다.
          <View style={{ gap: theme.spacing.section }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonRow />
          </View>
        ) : (
          <>
            <Card style={{ gap: theme.spacing.gap }}>
              {/* FAM-127: 공동 기록 가구(구성원 2명 이상)에서만 나타나는 읽기 전용 줄. 나머지
                  필드와 같은 라벨/값 구조를 그대로 써서 새 표기 관례를 만들지 않는다. 1인
                  가구·이름 해석 실패 시에는 authorLabel이 null이라 아예 렌더되지 않으므로
                  기존 화면이 한 픽셀도 바뀌지 않는다. */}
              {authorLabel ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    기록한 사람
                  </Text>
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {authorLabel}
                  </Text>
                </View>
              ) : null}

              {/* 라운드 41 UX-U(B-ⓐ): 손으로 적지 않은 기록(엑셀 가져오기 · 구매 확인)에만 붙는
                  읽기 전용 줄. 위 "기록한 사람" 줄과 **같은 라벨/값 구조**를 그대로 써서 새 표기
                  관례를 만들지 않는다. "manual"이나 모르는 값이면 sourceLine이 null이라 아예
                  렌더되지 않으므로 기존 화면이 한 픽셀도 바뀌지 않는다. */}
              {sourceLine ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    {sourceLine.label}
                  </Text>
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {sourceLine.value}
                  </Text>
                </View>
              ) : null}

              {/* 라운드 48 T3(C1): 빠른 기록 시트에서 고른 결제 수단을 **처음으로 다시 볼 수
                  있는 자리**. 문구는 입력 화면과 같은 모듈에서 온다(src/expenses/
                  expense-detail-rows.ts) -- 같은 값이 두 화면에서 다른 이름을 갖지 않도록.
                  고르지 않은 기록("unknown")·구 응답에는 라벨이 null이라 행이 없다. */}
              {paymentMethodLabel ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    {PAYMENT_METHOD_ROW_LABEL}
                  </Text>
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {paymentMethodLabel}
                  </Text>
                </View>
              ) : null}

              {/* 라운드 48 T3(C2): 판매처는 CSV 열로만 존재하던 값이다(앱 안에 입력 경로가
                  없어 대부분 비어 있다). 값이 실제로 있는 기록 -- 엑셀 가져오기로 들어온
                  행 -- 에서만 보여준다. 입력 UI 신설은 이번 라운드 범위 밖이다. */}
              {merchantValue.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    {MERCHANT_ROW_LABEL}
                  </Text>
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {merchantValue}
                  </Text>
                </View>
              ) : null}

              {/* 라운드 48 T3(C3): 핵심 루프("준비템 확인 → 구매 → 기록")의 되돌아가는 길.
                  준비템에서 남긴 지출은 `linkedItemTemplateId`를 들고 있는데 지금까지는 그
                  연결이 응답에 없어, 이 화면에서 "무엇 때문에 산 것인지"로 돌아갈 방법이
                  없었다. 지출 응답에는 준비템 **이름이 없으므로** 이름을 물어보는 요청을
                  새로 만들지도, 그럴듯한 이름을 지어내지도 않는다 -- 링크 문구는 무엇을 볼 수
                  있는지만 말하고(LINKED_ITEM_LINK_LABEL), 이름은 준비템 상세가 보여준다. */}
              {linkedItem ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    {LINKED_ITEM_ROW_LABEL}
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={linkedItem.label}
                    hitSlop={8}
                    onPress={() => router.push(linkedItem.href)}
                    style={{ justifyContent: "center", minHeight: theme.touchTarget }}
                  >
                    {/* A11Y-117: 작은 coral 텍스트는 coral[700](5.56:1)만 쓴다. */}
                    <Text style={{ color: theme.colors.coral[700], fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                      {linkedItem.label}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  품목
                </Text>
                <TextInput
                  accessibilityLabel="품목 입력"
                  returnKeyType="done"
                  onChangeText={setItemName}
                  placeholder="품목"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderColor: itemNameError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={itemName}
                />
                {itemNameError ? (
                  <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{itemNameError}</Text>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  금액
                </Text>
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.beige,
                    borderColor: amountError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 4,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                >
                  <TextInput
                    accessibilityLabel="지출 금액 입력"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onChangeText={(value) => setAmountDigits(amountDigitsOnly(value))}
                    placeholder="금액"
                    style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize }}
                    value={formatAmountDigits(amountDigits)}
                  />
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    원
                  </Text>
                </View>
                {amountError ? (
                  <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{amountError}</Text>
                ) : null}
                {/* 라운드 41 UX-U(B-ⓒ): 빠른 기록 시트와 **같은 프리셋 칩**(src/expenses/amount-presets.ts).
                    금액을 고치러 들어온 화면에서 "5,000원만 더"를 숫자 키패드로 다시 치게 하지
                    않는다. 칩은 입력을 대체하지 않고 현재 금액에 더할 뿐이라 누른 뒤에도 자유롭게
                    타이핑할 수 있고, 길게 누르거나 "지우기"를 누르면 0으로 리셋된다(상한 도달 시
                    비활성). 가산·상한 규칙은 그 모듈 한 곳에만 있다(DNC-013 정수 규칙과 정합). */}
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
                      onPress={() => setAmountDigits((value) => addAmountPreset(value, presetKrw))}
                      onLongPress={() => setAmountDigits(clearAmountText())}
                      style={{
                        alignItems: "center",
                        backgroundColor: theme.colors.white,
                        borderColor: theme.colors.primary100,
                        borderRadius: theme.radii.pill,
                        borderWidth: 1,
                        flex: 1,
                        justifyContent: "center",
                        minHeight: theme.touchTarget,
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
                    onPress={() => setAmountDigits(clearAmountText())}
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: theme.touchTarget,
                      paddingHorizontal: 4
                    }}
                  >
                    <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>지우기</Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  날짜
                </Text>
                <Pressable
                  accessibilityLabel="지출 날짜 변경"
                  accessibilityRole="button"
                  onPress={() => setShowDatePicker((value) => !value)}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.beige,
                    borderRadius: theme.radii.small,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                >
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {spentOnLabel}
                  </Text>
                  <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>
                    {showDatePicker ? "닫기" : "날짜 변경"}
                  </Text>
                </Pressable>
                {showDatePicker ? (
                  <View style={{ gap: 8 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {recentDateChips.map((chip) => (
                        <CategoryChip
                          key={chip.iso}
                          label={chip.shortLabel}
                          selected={!customDateMode && chip.iso === spentOnIso}
                          onPress={() => {
                            setSpentOnIso(chip.iso);
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
                              if (!error) setSpentOnIso(cleaned);
                            }
                          }}
                          placeholder="YYYY-MM-DD"
                          style={{
                            backgroundColor: theme.colors.beige,
                            borderColor: dateInputError ? theme.colors.danger : "transparent",
                            borderRadius: theme.radii.small,
                            borderWidth: 1,
                            color: theme.colors.brown,
                            minHeight: theme.touchTarget,
                            paddingHorizontal: 14
                          }}
                          value={customDateText}
                        />
                        {dateInputError ? (
                          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>
                            {dateInputError}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  카테고리
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {categoryChips.map((chip) => (
                    <CategoryChip
                      key={chip.id}
                      label={chip.label}
                      selected={chip.id === categoryId}
                      onPress={() => setCategoryId(chip.id)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  메모 (선택)
                </Text>
                <TextInput
                  accessibilityLabel="메모 입력 (선택)"
                  returnKeyType="done"
                  onChangeText={setMemo}
                  placeholder="메모를 입력해 주세요"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderRadius: theme.radii.small,
                    color: theme.colors.brown,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={memo}
                />
              </View>

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
            </Card>

            {/* 라운드 41 UX-U(B-ⓓ): "이 품목 이력" -- 같은 품목을 이번 달에 언제 · 얼마에 적었는지
                최근 3건. 원천은 홈/기록 탭이 이미 채워 둔 캐시를 getQueryData로 읽기만 한 값이라
                **새 요청이 0건**이고, 캐시가 없으면 itemHistory가 null이라 섹션 자체가 사라진다
                (0건이라고 말하지 않는다). 이 목록이 무엇을 보고 만든 것인지는 아래 범위 고지 한
                줄이 밝힌다(라운드 39 UX-P 검색 범위 고지와 같은 관례) -- 지난달 기록은 여기에
                없다는 사실을 말하지 않으면 그것이 조용한 허위 표시가 된다. */}
            {itemHistory ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{itemHistory.title}</Text>
                {itemHistory.rows.map((row) => (
                  <View
                    key={row.id}
                    accessibilityLabel={row.accessibilityLabel}
                    style={{ alignItems: "center", flexDirection: "row", gap: 10 }}
                  >
                    <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                      {row.dateLabel}
                    </Text>
                    <Text numberOfLines={1} style={{ color: theme.colors.brown, flex: 1, fontSize: 13, fontWeight: "700" }}>
                      {row.itemName}
                    </Text>
                    <Text style={{ color: theme.colors.brown, fontSize: 13, fontWeight: "800" }}>{row.amountLabel}</Text>
                  </View>
                ))}
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                  {itemHistory.scopeNotice}
                </Text>
              </Card>
            ) : null}

            {/* EXP-124: 수정 저장 실패 배너 -- 저장 버튼 바로 위, 입력값을 유지한 채 원인별 문구를
                보여준다(삭제 실패는 위 remove.onError의 Alert로 알린다). */}
            {saveErrorMessage ? <Toast message={saveErrorMessage} tone="error" /> : null}
            {savedMessage ? <Toast message={savedMessage} tone="success" /> : null}

            <PrimaryButton
              disabled={!canSave || save.isPending}
              label={save.isPending ? "저장하는 중" : "수정 저장"}
              onPress={expenseGate.guard(() => save.mutate())}
            />
            <Pressable
              accessibilityRole="button"
              disabled={remove.isPending}
              onPress={confirmDelete}
              style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}
            >
              <Text style={{ color: remove.isPending ? theme.colors.gray300 : theme.colors.danger, fontWeight: "700" }}>
                {remove.isPending ? "삭제하는 중" : "이 지출 삭제하기"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </AppScreen>
  );
}
