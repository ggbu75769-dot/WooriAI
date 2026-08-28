import { useEffect, useMemo, useRef, useState } from "react";
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
// GAP-060 #7(트랙 E): 다자녀 스코프 라벨의 해석·조립은 4탭·빠른 기록 시트와 **같은 순수 모듈**
// 한 벌에서만 온다(새 어휘를 만들지 않는다 — src/expenses/entry-child-scope.test.ts).
import { resolveChildScopeLabel, withChildScopeLabel } from "../../src/children/child-switch";
// 라운드 41 UX-U(B-ⓒ): 금액 프리셋 칩은 빠른 기록 시트(app/expenses/new.tsx)와 **같은 모듈**을 쓴다.
import {
  addAmountPreset,
  canAddAmountPreset,
  clearAmountText,
  formatPresetChipLabel,
  presetChipAccessibilityLabel,
  QUICK_AMOUNT_PRESETS_KRW
} from "../../src/expenses/amount-presets";
// 라운드 48 T3: 결제 수단 · 판매처 · 연결된 준비템 행의 문구/판정 단일 소스.
// GAP-054 #1/#10: 환불 보존 규칙과 결제 수단 편집 규칙도 같은 모듈이 갖는다.
import {
  expenseTypeBadgeLabel,
  expenseTypeForPatch,
  isRefundExpenseType,
  linkedItemTemplateLink,
  LINKED_ITEM_ROW_LABEL,
  MERCHANT_ROW_LABEL,
  nextPaymentMethod,
  paymentMethodControlLabel,
  paymentMethodForPatch,
  PAYMENT_METHOD_CHANGE_LABEL,
  PAYMENT_METHOD_ROW_LABEL,
  REFUND_BADGE_NOTICE,
  REFUND_GIFT_DISABLED_REASON
} from "../../src/expenses/expense-detail-rows";
// GAP-054 #2: 금액 상한은 지출 입력 시트·예산 화면과 **같은 모듈**에서 온다(값을 여기 적지 않는다).
import { amountOverLimitMessage, isAmountOverLimit } from "../../src/expenses/amount-limit";
// GAP-056 #1: 텍스트 길이 상한도 금액 상한과 **같은 방식**의 단일 소스에서 온다(숫자를 여기
// 적지 않는다). 서버 @MaxLength와 갈리면 오프라인 flush가 400으로 떨어져 영구 실패 행이 된다.
import {
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
// 라운드 41 UX-U(B-ⓐ/ⓓ): source 한 줄과 "이 품목 이력"의 판정은 순수 모듈이 단일 소스다.
// GAP-054 라운드 54 P2-5: 빠른 기록 시트와 **같은** 달력 픽커(판정은 그 안에서 다시 순수
// 모듈 src/expenses/date-picker-month.ts로 내려간다 — 이 화면이 달력을 새로 계산하지 않는다).
import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";
import { expenseSourceLine } from "../../src/expenses/expense-source-line";
import { buildItemHistory } from "../../src/expenses/item-history";
// 라운드 42 L-5: 이력 재조정을 **정규화된 품목명이 실제로 바뀔 때만** 돌리기 위한 같은 단일 소스
// (UX-C의 src/expenses/item-name-match.ts) -- buildItemHistory가 안에서 쓰는 정규화와 같은 함수다.
import { normalizeItemName } from "../../src/expenses/item-name-match";
/**
 * GAP-056 #2 — 판매처 자동완성. 빠른 기록 시트(app/expenses/new.tsx)와 **같은 순수 모듈**을
 * 쓰고, 원천은 "이 품목 이력"이 이미 읽고 있는 이번 달 캐시 하나뿐이다(새 요청 0건).
 */
import {
  buildMerchantSuggestions,
  formatMerchantSuggestionChipLabel,
  merchantSuggestionChipAccessibilityLabel
} from "../../src/expenses/merchant-suggest";
import type { MonthExpenses } from "../../src/expenses/month-expenses";
import {
  expenseCreatedByUserId,
  resolveExpenseAuthorLabel,
  resolveExpenseHouseholdId
} from "../../src/expenses/records-list-view";
/**
 * 라운드 58 #1 — "정기 지출로 등록"의 판정·문구·파라미터 조립은 전부 순수 모듈이 한다
 * (src/expenses/recurring-template.ts). 이 화면은 결과가 null이면 버튼을 그리지 않고, null이
 * 아니면 그 값을 그대로 관리 화면에 실어 보낸다 — 규칙이 화면에 두 벌로 적히지 않게.
 */
import {
  formatRecurringTemplateLine,
  recurringTemplatePrefillParams,
  RECURRING_REGISTER_ACTION_LABEL,
  RECURRING_REGISTER_ACTION_NOTICE
} from "../../src/expenses/recurring-template";
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
/**
 * GAP-058 #6 — 판매처 후보가 읽는 **제안 원천 한 벌**. 빠른 기록 시트와 같은 모듈·같은 규칙이고,
 * 재료는 이 화면이 이미 손에 들고 있는 것뿐이다(오프라인 스냅숏 + 이미 받아 둔 월 캐시 두 달치)
 * — 새 요청은 0건이다.
 */
import { buildSuggestSourceRows, type SuggestSourceRow } from "../../src/expenses/suggest-source";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
// GAP-058 #6: "지난달"은 홈의 지난달 비교 한 줄과 **같은 함수**로 센다(달 경계를 화면에서 다시
// 계산하면 12월→1월에 두 화면이 다른 달을 가리킬 수 있다).
import { previousYearMonth } from "../../src/home/last-month-comparison";
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
// 라운드 49 C-05: "연결된 준비템 보기"의 목적지는 경로가 아니라 **전역으로 선택된 아이**로
// 상세를 부른다 — 그래서 이 화면이 그 값을 알아야 아이가 어긋난 링크를 그리지 않을 수 있다.
/**
 * 라운드 59 트랙 B 후속 배선 — "정기 지출로 등록"이 **이미 등록된 지출**인지 알기 위한 판정.
 *
 * 저장 거절(recurringDuplicateMessage)이 쓰는 바로 그 순수 함수라, 이 화면이 이름 비교 규칙을
 * 다시 적지 않는다(관리 화면의 같은 표기와도 한 함수를 지난다 — app/expenses/recurring.tsx).
 */
import {
  findRecurringTemplateByItemName,
  useRecurringExpenseStore,
  RECURRING_ALREADY_REGISTERED_LABEL
} from "../../src/stores/recurring-expense.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { resolveScreenPhase } from "../../src/screen-phase";
import {
  AppScreen,
  Card,
  CategoryChip,
  EmptyStateCard,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  Toast
} from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";

// FMT-127: 금액 표기(콤마)·입력 정규화는 src/money.ts가 단일 소스다 -- 이 화면에 있던
// toDigits/formatAmount 사본은 (예산 수정·온보딩 예산 화면의 같은 사본들과 함께) 제거했다.

// GAP-058 #6: 세션이나 아이를 아직 모를 때 통합 제안 원천이 돌려주는 고정 빈 배열. 매 렌더 새
// 배열을 만들면 그것을 의존성으로 받는 useMemo가 매번 다시 돈다.
const noSuggestRows: SuggestSourceRow[] = [];

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
  /**
   * GAP-060 #7(트랙 E) — 이 화면의 제목이 **누구의 지출인지** 말한다.
   *
   * 4탭은 라운드 48~49에 전부 스코프 라벨을 달았고 빠른 기록 시트는 트랙 B가 달았는데, 정작
   * 이미 적힌 지출을 **고치는** 자리에는 없었다. 알림함·홈 최근 기록·기록 탭 어디서 들어와도
   * 화면은 똑같이 "지출 수정"이라, 다자녀 가구에서는 지금 고치는 금액이 누구 밑에서 줄어드는지
   * 저장한 뒤에야 알 수 있었다.
   *
   * 여기서 라벨의 기준은 **선택된 아이가 아니라 이 지출이 속한 아이**(`expense.data.childId`)다.
   * 두 값은 실제로 갈린다 — 알림/딥링크로 다른 아이의 지출을 열 수 있고, 이 화면은 그 어긋남을
   * 이미 알고 있다(라운드 49 C-05의 `linkedItemTemplateLink`가 같은 이유로 링크를 접는다).
   * 화면이 보여 주는 숫자의 주인을 말해야 하므로 지출 쪽 childId가 맞고, 덕분에 어긋난 상태가
   * 제목에서 바로 드러난다.
   *
   * **새 요청 0건**: 목록은 위 `childrenQuery`(가구 판정이 이미 쓰는 ["children"] 캐시)를 그대로
   * 재사용한다 — 이 화면의 데이터 원천 규칙(라운드 27 L-4 주석)을 벗어나지 않는다. 응답이 아직
   * 없거나(로딩·실패) 외동 가구면 `resolveChildScopeLabel`이 null을 주고, 그러면 제목 문자열이
   * 종전과 한 글자도 달라지지 않는다. EXP-003 픽셀 캡처는 비세션이라 두 쿼리 모두 enabled:false —
   * 라벨은 항상 null이다.
   *
   * 낭독은 별도 문자열을 만들지 않는다: 공용 `ScreenHeader`(src/ui.tsx)의 제목 Text는 잘리지
   * 않으므로 **보이는 문구가 곧 접근성 이름**이고, 거기에는 덮어쓸 accessibilityLabel 슬롯 자체가
   * 없다(그 파일은 트랙 E 소유 밖이다). 시트 제목처럼 numberOfLines로 잘리는 자리에서만
   * `withSpokenChildScopeLabel`이 필요했다(app/expenses/new.tsx의 같은 주석).
   */
  const childScopeLabel = resolveChildScopeLabel(expense.data?.childId, childrenQuery.data?.children);
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
  // 라운드 48 T3: 쓰기 전용이던 필드들의 왕복. **연결된 준비템** 행은 여전히 응답에 값이
  // 있을 때만 생긴다(순수 모듈이 null을 돌려주면 렌더 자체가 없다). 결제 수단은 GAP-054 #10에서
  // 편집 컨트롤이 되면서 값이 없어도 남는다 -- 값이 없다는 것을 말하려는 것이 아니라, 거기서
  // 고를 수 있어야 하기 때문이다(아래 주석).
  /**
   * GAP-054 #10: 결제 수단은 **읽기 전용 행에서 편집 컨트롤로** 바뀌었다. 서버
   * `UpdateExpenseDto`는 라운드 48 QA(P2-6)부터 이 필드를 받고 있었는데(그래서
   * forbidNonWhitelisted 400 걱정 없이 그대로 실을 수 있다) 앱 안에는 고칠 자리가 없어,
   * 빠른 기록 시트에서 잘못 고른 값을 CSV 왕복으로만 되돌릴 수 있었다.
   *
   * 상태의 초기값은 응답 값이고(아래 useEffect), 화면 문구·순환 규칙은 전부 순수 모듈이
   * 정한다 — 빠른 기록 시트와 같은 네 가지, 같은 문구다.
   */
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const paymentMethodLabel = paymentMethodControlLabel(paymentMethod);
  /**
   * GAP-054 #1: **원본**이 환불인가. 화면 상태가 아니라 서버가 말해 준 값으로만 판정한다 —
   * 이 화면에는 환불을 켜고 끄는 입력이 없고, 있어서도 안 된다(서버가 refund를 받지 않는다).
   */
  const isRefund = isRefundExpenseType(expense.data?.expenseType);
  const expenseTypeBadge = expenseTypeBadgeLabel(expense.data?.expenseType);
  /**
   * 라운드 49 C-05: 이 링크는 **지출이 속한 아이와 지금 선택된 아이가 같을 때만** 생긴다.
   * 목적지(app/items/[itemTemplateId].tsx)가 경로의 childId가 아니라 선택된 아이로 상세를
   * 부르기 때문에, 어긋난 상태에서 링크를 그리면 "이 지출에 연결된 준비템"이라고 말하고
   * 다른 아이의 준비 상태를 여는 셈이 된다. 판정과 그 근거는 순수 모듈에 있다
   * (src/expenses/expense-detail-rows.ts `linkedItemTemplateLink`).
   */
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const linkedItem = linkedItemTemplateLink(expense.data?.linkedItemTemplateId, {
    expenseChildId: expense.data?.childId,
    selectedChildId
  });
  const [itemName, setItemName] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  /**
   * 라운드 49 C-03: 판매처가 **읽기 전용 행에서 입력칸으로** 바뀐 자리. 값은 저장·CSV·API가
   * 이미 전부 왕복시키고 있었는데(엑셀 가져오기로 들어온 행에는 실제로 값이 있다) 앱 안에는
   * 고쳐 쓸 자리가 없어서, 오타 하나를 고치려면 CSV를 내보내 다시 가져오는 수밖에 없었다.
   * 빈 칸으로 저장하면 "지웠다"는 뜻이고 서버가 null로 정리한다(메모와 같은 취급).
   */
  const [merchant, setMerchant] = useState("");
  /**
   * 라운드 57 QA(P2-9) — 판매처 칩 줄의 **포커스 게이트**. 빠른 기록 시트(app/expenses/new.tsx의
   * `merchantFocused`)와 같은 규칙이고, 지금까지 이 화면에만 없었다.
   *
   * 없을 때 무슨 일이 있었나: 이 화면은 **기존 기록을 열어 보는** 자리라 대개 판매처를 고칠 생각
   * 없이 들어온다. 그런데 후보 칩 줄이 열자마자 무조건 그려져(빈 칸이면 최근 5개) 그 아래 메모·
   * 연결 준비템·날짜가 매번 한 줄만큼 밀렸다 — 아무도 요청하지 않은 컨트롤이 레이아웃을 상시로
   * 밀고 있었다. 칸을 누른 뒤에만 나오면 "고치러 온 사람"에게만 보인다.
   */
  const [merchantFocused, setMerchantFocused] = useState(false);
  const [memo, setMemo] = useState("");
  const [spentOnIso, setSpentOnIso] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customDateText, setCustomDateText] = useState("");
  const [today] = useState(() => new Date(`${getSeoulToday()}T00:00:00`));
  // GAP-054 라운드 54 P2-5: 달력 픽커의 "오늘" 기준일. `today`는 이미 getSeoulToday()로 만든
  // 서울 날짜라 여기서 시계를 한 번 더 읽지 않는다(같은 렌더 안에서 두 날짜가 갈리지 않게 —
  // 빠른 기록 시트와 같은 방식).
  const todayIso = formatExpenseDate(today).iso;
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
    setMerchant(expense.data.merchant ?? "");
    setMemo(expense.data.memo ?? "");
    setSpentOnIso(expense.data.spentOn);
    setCategoryId(expense.data.categoryId);
    setIsGift(expense.data.expenseType === "gift");
    // GAP-054 #10: 응답 값이 곧 초기값이다. 고른 적 없는 기록은 null로 두어 컨트롤이
    // "고르지 않았어요"를 말하고, 저장 payload에도 키가 실리지 않는다(paymentMethodForPatch).
    setPaymentMethod(expense.data.paymentMethod ?? null);
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
      // D1 후속(실기기 피드백 2): `category.icon`은 이제 Ionicons **이름**이라 라벨 앞에 붙이면
      // 칩에 "water-outline 의류"가 적힌다. 위 정상 경로(서버 목록)와 같이 이름만 쓴다.
      : categoryCatalog.map((category) => ({ id: category.id, label: category.label }));
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
   * GAP-058 #6 — 지난달 캐시도 **같은 방식으로 읽기만** 한다(getQueryData, 새 요청 0건).
   *
   * 이번 달 캐시는 매달 1일 아침에 거의 비어 있다. 그때 판매처 칩이 통째로 사라지는 것이 여태의
   * 동작이었다 — 사용자의 이력이 사라진 것이 아닌데도. 홈/기록 탭이 이미 채워 두는 캐시가 있으면
   * 읽고, 없으면(콜드 스타트) undefined다: 있는 것만 쓰고 없는 것을 부르지 않는다.
   */
  const previousMonth = previousYearMonth(currentYearMonth);
  const cachedPreviousMonthExpenses =
    authToken && historyChildId && previousMonth
      ? queryClient.getQueryData<MonthExpenses>(["expenses", historyChildId, previousMonth])?.expenses
      : undefined;
  /**
   * GAP-058 #6 — 빠른 기록 시트와 **같은 모집단**(오프라인 스냅숏 + 월 캐시 두 달치).
   *
   * 이 기기에서 방금 오프라인으로 적은 판매처가 이 화면의 후보에도 있어야 한다(같은 사실을 두
   * 화면이 다르게 아는 상태를 없앤다). 합치는 규칙은 전부 순수 모듈에 있고 화면에는 한 줄도 없다.
   */
  const suggestRows = useMemo(
    () =>
      authToken && historyChildId
        ? buildSuggestSourceRows({
            childId: historyChildId,
            localRows: offlineSyncSnapshot.rows,
            currentMonthRows: cachedMonthExpenses,
            previousMonthRows: cachedPreviousMonthExpenses
          })
        : noSuggestRows,
    [authToken, historyChildId, offlineSyncSnapshot.rows, cachedMonthExpenses, cachedPreviousMonthExpenses]
  );
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

  /**
   * GAP-056 #2 — 판매처 자동완성 후보(타이핑 중 3개 / 빈 칸이면 최근 5개).
   *
   * GAP-058 #6: 원천이 이번 달 캐시 하나에서 **통합 제안 원천**(suggestRows)으로 넓어졌다 —
   * 재료는 이 화면이 이미 들고 있는 것뿐이라 새 요청은 여전히 0건이고, 두 원천이 다 비면 빈
   * 배열이라 이 화면은 이 기능이 없던 때와 한 픽셀도 다르지 않다.
   *
   * **자기 행은 뺀다**: 지금 열려 있는 그 기록이 후보에 섞이면, 판매처를 고치려고 칸을 비운
   * 사람에게 방금 지운 그 값을 되돌려 주는 칩이 첫 번째로 선다(순수 모듈은 "다 친 값과 같은
   * 후보"만 거르므로 빈 칸에서는 걸러지지 않는다). 통합 목록에서도 **같은 한 줄**이 그대로
   * 통한다 — 동기화가 끝난 로컬 행이 서버 id(canonicalId)를 들고 오기 때문이다(suggest-source.ts
   * 의 `id` 주석). 아직 안 올라간 행에는 id가 없지만, 그런 행은 지금 열려 있는 이 서버 기록일
   * 수 없다.
   *
   * useMemo인 이유는 이력 재조정과 같다 — 이 화면의 입력은 전부 상태라, 키 한 번마다 이번 달
   * 전체를 다시 묶고 정렬할 이유가 없다.
   *
   * 라운드 57 QA(P2-9): **판매처 칸을 누른 뒤에만** 후보를 만든다(빠른 기록 시트와 같은 게이트).
   * 판정을 여기 두면 칩 줄이 사라지는 것과 계산이 없어지는 것이 한 조건에서 나온다 — 렌더 쪽에서만
   * 감추면 화면에 없는 목록을 매 키 입력마다 계속 만든다.
   */
  const merchantSuggestions = useMemo(
    () =>
      merchantFocused
        ? buildMerchantSuggestions(merchant, suggestRows.filter((row) => row.id !== expenseId))
        : [],
    [merchantFocused, merchant, suggestRows, expenseId]
  );

  const amountKrw = Number(amountDigits || "0");
  /**
   * GAP-056 #1 — 비어 있음과 **길이 초과**를 같은 자리에서 말한다.
   *
   * 판정은 화면이 실제로 보낼 값으로 한다(품목명·판매처는 `trim()`한 값, 메모는 원문) —
   * 서버 `@MaxLength`도 받은 문자열의 길이를 그대로 보므로, 두 판정이 같은 값을 봐야
   * 클라이언트가 통과시킨 입력이 서버에서 400이 되는 어긋남이 없다.
   *
   * 입력 칸의 `maxLength`가 있는데도 이 판정이 필요한 이유: 상한(100)은 컬럼 한계(varchar 120)가
   * 아니라 계약이라, 엑셀 가져오기로 들어온 101~120자짜리 기록이 이미 DB에 있을 수 있다.
   * 그런 기록을 열면 값은 이미 상한을 넘은 상태이고 `maxLength`는 새로 치는 글자만 막는다 —
   * 안내 없이 저장을 누르게 두면 로컬 저장만 성공하고 flush에서 400을 만나 영구 실패 행이 된다
   * (docs/5차/round56-scout.md #1). 조용히 잘라 버리지 않고 무엇을 줄여야 하는지 말한다.
   */
  const trimmedItemName = itemName.trim();
  const trimmedMerchant = merchant.trim();
  const itemNameError =
    trimmedItemName.length === 0
      ? "품목을 입력해 주세요."
      : isItemNameOverLimit(trimmedItemName)
        ? itemNameOverLimitMessage()
        : null;
  const merchantError = isMerchantOverLimit(trimmedMerchant) ? merchantOverLimitMessage() : null;
  const memoError = isMemoOverLimit(memo) ? memoOverLimitMessage() : null;
  /**
   * GAP-054 #2 — 0 이하와 **상한 초과**를 같은 자리에서 말한다.
   *
   * 상한을 넘긴 금액은 서버 컬럼(int4)에 애초에 들어갈 수 없다. 지금까지는 그 사실을 아무도
   * 말해 주지 않아 로컬 저장만 성공하고, 아웃박스 flush에서 5xx를 만나 무한 재시도 poison이
   * 됐다(docs/5차/budget-app-gap-analysis.md P0-2). 입력 칸이 먼저 막으면 그 행이 큐에 들어갈
   * 일 자체가 없다. 값·문구는 지출 입력 시트·예산 화면과 같은 모듈에서 온다.
   */
  const amountError =
    amountDigits.length > 0 && amountKrw <= 0
      ? "0보다 큰 금액을 입력해 주세요."
      : isAmountOverLimit(amountKrw)
        ? amountOverLimitMessage()
        : null;
  const dateInputError = customDateMode && customDateText.length > 0 ? validateExpenseDateInput(customDateText) : null;
  const spentOnLabel = spentOnIso ? formatExpenseDate(new Date(`${spentOnIso}T00:00:00`)).label : "";
  /**
   * GAP-054 라운드 54 P2-7 — `Number.isInteger`가 이 줄에도 합류한다.
   *
   * 저장 직전 가드(save.mutationFn)는 이미 그것을 보고 있는데 버튼 활성 판정만 빠져 있었다.
   * 그 한 칸이 벌린 틈: 숫자만 남기는 정규화(`amountDigitsOnly`)를 통과한 아주 긴 자릿수를
   * 붙여 넣으면 `Number(...)`가 `Infinity`가 되고, `isAmountOverLimit`은 `Number.isFinite`로
   * 먼저 걸러 **false**를 돌려준다(상한 초과가 아니라고 답한다). 그래서 `amountError`는 null,
   * `amountKrw > 0`은 true — 저장 버튼이 멀쩡히 활성화되고, 눌러야만 저장 직전 가드가
   * "입력값을 확인해 주세요"로 막는다. 누를 수 있는데 아무 일도 일어나지 않는 버튼이다.
   *
   * 빠른 기록 시트(app/expenses/new.tsx)·예산 화면은 이미 같은 가드 집합을 쓴다 — 세 화면의
   * 판정을 한 벌로 맞춘다.
   */
  const canSave =
    !itemNameError &&
    // GAP-056 #1: 판매처·메모의 길이 초과도 같은 자리에서 버튼을 잠근다.
    !merchantError &&
    !memoError &&
    !amountError &&
    !dateInputError &&
    Number.isInteger(amountKrw) &&
    amountKrw > 0 &&
    Boolean(authToken && expenseId && localExpenseId);
  const canTapAmountPreset = canAddAmountPreset(amountDigits);

  // 라운드 41 UX-U(B-ⓑ): 저장·삭제가 끝나면 **왔던 자리로** 돌아간다. 예전에는 무조건
  // router.replace("/(tabs)/records")라, 홈의 최근 기록·검색 결과·리포트에서 이 화면에 들어온
  // 사람도 전부 기록 탭에 떨궈져 진입 스택(그리고 그 화면의 스크롤·검색어·필터)이 사라졌다.
  // 스택이 없을 때(딥링크·알림에서 바로 열린 경우)만 종전처럼 기록 탭으로 보낸다.
  function leaveAfterMutation() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/records");
  }

  /**
   * GAP-056 #6 — "저장했어요" 토스트를 보여 준 뒤 떠나는 650ms 타이머를 ref에 들고, 언마운트
   * 때 취소한다(src/export/ExpenseCsvExport.tsx의 toastTimerRef와 같은 관례).
   *
   * 없을 때 무슨 일이 있었나: 저장/삭제 성공 직후 사용자가 스스로 뒤로 가거나 탭을 바꾸면 이
   * 화면은 언마운트되는데, 타이머는 살아남아 650ms 뒤에 `router.back()`을 한 번 더 호출한다 —
   * 사용자가 방금 고른 화면에서 **또 한 칸 뒤로** 밀리거나(스택이 없으면) 기록 탭으로
   * 덮어써진다. 원인이 화면 밖에서 오는 튐이라 재현하기도 어렵다.
   *
   * 예약하는 자리(두 뮤테이션의 onSuccess)에서는 새로 걸기 전에 이미 걸린 타이머를 지운다:
   * 저장 성공 직후 삭제까지 이어지는 경로에서 내비게이션이 두 번 예약되지 않게 한다. 목적지는
   * 종전과 같이 `leaveAfterMutation` 한 곳뿐이다(저장과 삭제가 서로 다른 곳으로 가지 않는다).
   */
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const save = useMutation({
    mutationFn: () => {
      if (
        !authToken ||
        !localExpenseId ||
        !Number.isInteger(amountKrw) ||
        amountKrw <= 0 ||
        // GAP-054 #2: 저장 직전에도 같은 판정을 한 번 더 본다 — 버튼 비활성만으로는 프리셋
        // 칩 연타처럼 상태가 앞서가는 경로를 다 막지 못한다.
        isAmountOverLimit(amountKrw) ||
        !trimmedItemName ||
        // GAP-056 #1: 길이 상한도 **로컬 저장 전에** 막는다. 여기서 통과시키면 오프라인
        // 아웃박스가 로컬 저장을 먼저 성공시키고 flush에서 400을 만나 되살릴 수 없는 실패
        // 행이 된다(4xx는 재시도하지 않는다) — 금액 상한을 여기서 다시 보는 것과 같은 목적이다.
        isItemNameOverLimit(trimmedItemName) ||
        isMerchantOverLimit(trimmedMerchant) ||
        isMemoOverLimit(memo) ||
        Boolean(dateInputError)
      ) {
        throw new Error(INVALID_EXPENSE_INPUT_ERROR);
      }
      return updateExpenseOffline(authToken, queryClient, localExpenseId, {
        amountKrw,
        itemName: itemName.trim(),
        // 라운드 49 C-03: memo와 같은 자리·같은 규칙. 빈 문자열을 그대로 보내야 "지웠다"가
        // 서버까지 전달된다(undefined로 접으면 서버가 옛 값을 그대로 들고 있는다).
        merchant: merchant.trim(),
        memo,
        spentOn: spentOnIso || undefined,
        categoryId: categoryId || undefined,
        // GAP-054 #10: 서버 UpdateExpenseDto가 이미 받는 필드(라운드 48 QA P2-6). 고른 적
        // 없는 기록에서는 순수 모듈이 undefined를 돌려줘 키가 실리지 않는다.
        paymentMethod: paymentMethodForPatch(paymentMethod),
        /**
         * GAP-054 #1: 원본이 환불이면 **키 자체를 싣지 않는다**(undefined → recordLocalUpdate의
         * omitUndefinedValues와 toExpensePatch의 JSON 직렬화가 함께 지워 준다) — 서버 PATCH는
         * 부분 갱신이라 보내지 않은 필드를 건드리지 않으므로 환불이 그대로 남는다. 예전의
         * `isGift ? "gift" : "expense"` 삼항은 환불 기록을 열어 메모 한 글자만 고쳐도 "지출"로
         * 덮어써서, 월 합계를 오염시키고 앱 안에서는 되돌릴 수도 없었다.
         */
        expenseType: expenseTypeForPatch(expense.data?.expenseType, isGift)
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
      // GAP-056 #6: 타이머를 ref에 담아 언마운트 때 취소한다(위 leaveTimerRef 주석).
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(leaveAfterMutation, 650);
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
      // GAP-056 #6: 타이머를 ref에 담아 언마운트 때 취소한다(위 leaveTimerRef 주석).
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(leaveAfterMutation, 650);
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

  /**
   * 라운드 58 #1 — "이건 매달 나가는 돈이네"를 깨닫는 자리에서 정기 지출로 올리는 길.
   *
   * 지금까지 템플릿을 만드는 입구는 관리 화면의 **빈 폼** 하나뿐이라, 방금 이 기록을 보고
   * 깨달은 사람도 품목·금액·분류·결제 수단·결제일을 손으로 다시 옮겨 적어야 했다(옮겨 적는
   * 동안 숫자가 어긋나도 앱은 알 수 없다).
   *
   * **액션시트에는 넣지 않는다**: 기록 행의 액션시트는 이미 수정·또 기록·삭제 세 개이고,
   * 안드로이드 Alert의 버튼 상한이 3이라(record-row-actions.ts `ANDROID_ALERT_BUTTON_LIMIT`)
   * 하나를 더하면 취소가 말없이 잘려 나간다. 이 화면에는 자리가 있다.
   *
   * 값은 **서버가 말해 준 지금 저장된 기록**에서 읽는다(화면의 편집 상태가 아니라). 저장하지
   * 않은 입력을 옮기면 아직 어디에도 없는 금액이 매월 반복되는 약속으로 굳고, 타이핑 중에
   * 버튼이 나타났다 사라지기도 한다 — 이 버튼이 복사하는 것은 "저장된 이 기록"이다.
   *
   * 선물·환불 행에서는 순수 모듈이 null을 돌려줘 버튼 자체가 없다(DNC-015: 월 합계에서 빠지는
   * 기록은 "매월 이만큼 쓴다"의 근거가 될 수 없다).
   */
  const recurringPrefill = recurringTemplatePrefillParams({
    itemName: expense.data?.itemName,
    amountKrw: expense.data?.amountKrw,
    categoryId: expense.data?.categoryId,
    paymentMethod: expense.data?.paymentMethod,
    spentOn: expense.data?.spentOn,
    expenseType: expense.data?.expenseType
  });
  /**
   * 세션 게이트 + **아이 게이트**.
   *
   * 관리 화면은 언제나 **지금 선택된 아이**의 템플릿을 만든다(app/expenses/recurring.tsx의
   * `selectedChildId`). 그래서 다른 아이의 지출을 보다가 이 버튼을 누르면, 사용자가 고른 적
   * 없는 아이 밑으로 정기 지출이 조용히 들어간다 — "연결된 준비템 보기" 링크를 같은 이유로
   * 같은 조건에서만 그리는 것과 한 규칙이다(라운드 49 C-05).
   *
   * 세션이 없으면 그리지 않는다(EXP-003 비세션 캡처 경로 불변).
   */
  const canRegisterRecurring = Boolean(
    authToken && selectedChildId && expense.data?.childId === selectedChildId && recurringPrefill
  );
  /**
   * 라운드 59 트랙 B 후속 배선 — 이 품목의 정기 지출이 **이미 이 아이에게 있는가**.
   *
   * 있으면 버튼을 세우지 않는다: 눌러도 관리 화면의 저장에서 `recurringDuplicateMessage`로
   * 거절당하므로, 그 왕복(누르기 → 채워진 폼 → 저장 → 거절 → 뒤로)이 통째로 헛걸음이다. 대신
   * 그 자리에 사실을 적는다(`RECURRING_ALREADY_REGISTERED_LABEL` · 품목 · 금액 · 결제일) --
   * 사용자는 그 항목이 이미 있다는 것과 어떤 약속인지를 한 줄로 안다.
   *
   * 판정은 저장 거절과 **같은 함수** 하나뿐이라(스토어의 순수 함수) 화면이 이름 정규화·아이
   * 스코프 규칙을 다시 적지 않는다. 저장된 기록의 품목명으로 판정하는 것도 버튼과 같은 근거다
   * (편집 중인 입력이 아니라 "저장된 이 기록"을 복사하는 진입점이다 -- 위 프리필 주석).
   */
  const recurringTemplates = useRecurringExpenseStore((state) => state.templates);
  const alreadyRegisteredRecurring = findRecurringTemplateByItemName(
    recurringTemplates,
    selectedChildId,
    expense.data?.itemName ?? ""
  );

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
          title={withChildScopeLabel("지출 수정", childScopeLabel)}
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
              {/* GAP-054 #1: 환불 기록에만 붙는 구분 배지. 이 화면에는 지금까지 "이건 환불이다"를
                  말하는 자리가 하나도 없었다 — 선물은 아래 체크박스가 말하고 지출은 기본값이라
                  말할 필요가 없는데, 환불만 보이지 않은 채로 지출 편집 화면처럼 보였다. 배지는
                  값이 refund일 때만 만들어지므로(순수 모듈이 null을 돌려주면 렌더 자체가 없다)
                  나머지 기록에서는 이 화면이 한 픽셀도 바뀌지 않는다. */}
              {expenseTypeBadge ? (
                <View testID="expense-type-badge" style={{ gap: 6 }}>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: theme.colors.beige,
                      borderRadius: theme.radii.pill,
                      paddingHorizontal: 12,
                      paddingVertical: 6
                    }}
                  >
                    <Text style={{ color: theme.colors.brown, fontSize: 12, fontWeight: "800" }}>{expenseTypeBadge}</Text>
                  </View>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                    {REFUND_BADGE_NOTICE}
                  </Text>
                </View>
              ) : null}

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

              {/* 라운드 48 T3(C1)은 빠른 기록 시트에서 고른 결제 수단을 **다시 볼 수 있게** 했다.
                  GAP-054 #10에서 그 행이 **고칠 수 있는 컨트롤**이 된다: 서버 PATCH는 이 필드를
                  이미 받고 있었는데(라운드 48 QA P2-6) 앱에는 고칠 자리가 없어, 잘못 고른 값을
                  CSV 내보내기-가져오기 왕복으로만 되돌릴 수 있었다(판매처가 라운드 49 C-03에서
                  같은 이유로 입력칸이 된 것과 같은 구멍이다).

                  컨트롤 모양은 빠른 기록 시트의 결제 수단 줄(누르면 다음 값으로 순환)을 그대로
                  따르고, 문구·순환 규칙은 전부 순수 모듈에 있다 — 같은 값이 두 화면에서 다른
                  이름이나 다른 순서를 갖지 않도록. 아직 고른 적 없는 기록도 행이 사라지지 않고
                  "고르지 않았어요"로 남는다(그래야 거기서 고를 수 있다). 그 상태에서 저장하면
                  키가 실리지 않아 서버 값은 그대로다. */}
              <Pressable
                accessibilityLabel={PAYMENT_METHOD_CHANGE_LABEL}
                accessibilityRole="button"
                onPress={() => setPaymentMethod((value) => nextPaymentMethod(value))}
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
                <View style={{ gap: 2 }}>
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    {PAYMENT_METHOD_ROW_LABEL}
                  </Text>
                  <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                    {paymentMethodLabel}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.gray600, fontSize: 18 }}>›</Text>
              </Pressable>

              {/* 라운드 49 C-03: 판매처가 읽기 전용 행에서 **입력칸**이 됐다. 라운드 48 T3은
                  "앱 안에 입력 경로가 없다"는 이유로 값이 있을 때만 그리는 행이었는데, 그
                  사이 빠른 기록 시트에 판매처 입력이 생겨(app/expenses/new.tsx) 사용자가 직접
                  적은 값이 여기로 들어온다 -- 적을 수는 있는데 고칠 수는 없는 화면이 되면
                  오타 하나를 CSV 왕복으로만 고칠 수 있다. 라벨 문구는 종전과 같은 모듈 상수를
                  쓴다(CSV의 열 이름과도 한 단어). 비어 있으면 자리표시자 문구 없이 빈
                  입력칸이고, 비운 채로 저장하면 판매처를 지운 것으로 처리된다. */}
              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                  {MERCHANT_ROW_LABEL}
                </Text>
                <TextInput
                  accessibilityLabel="판매처 입력 (선택)"
                  returnKeyType="done"
                  // GAP-056 #1: 서버 @MaxLength와 같은 숫자(단일 소스는 src/expenses/text-limits.ts).
                  maxLength={MERCHANT_MAX_LENGTH}
                  onChangeText={setMerchant}
                  // 라운드 57 QA(P2-9): 칩 줄의 게이트. 열자마자 끼어들지 않고, 이 칸을 누른
                  // 뒤에만 나온다(빠른 기록 시트와 같은 문법).
                  onFocus={() => setMerchantFocused(true)}
                  placeholder="판매처를 입력해 주세요 (선택)"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderColor: merchantError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={merchant}
                />
                {merchantError ? (
                  <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{merchantError}</Text>
                ) : null}
                {/* GAP-056 #2 — 판매처 자동완성 칩. 빠른 기록 시트와 **같은 칩 행**(같은 pill·
                    같은 높이·같은 한 줄 가로 스크롤)이고, 라벨과 스크린리더 문장도 같은 모듈이
                    만든다. 탭하면 판매처 한 칸만 채운다 — 저장은 여전히 "수정 저장"으로만 일어난다.
                    후보가 없으면(캐시 없음·판매처를 적은 적 없음) 줄 자체가 없다.
                    라운드 57 QA(P2-9): 위 칸을 **누른 뒤에만** 후보가 만들어지므로(merchantFocused),
                    기록을 열어 보기만 하는 사람의 화면은 이 줄만큼 밀리지 않는다. */}
                {merchantSuggestions.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {merchantSuggestions.map((suggestion) => (
                      <Pressable
                        key={suggestion.merchant}
                        accessibilityRole="button"
                        accessibilityLabel={merchantSuggestionChipAccessibilityLabel(suggestion)}
                        hitSlop={3}
                        onPress={() => setMerchant(suggestion.merchant)}
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
                  // GAP-056 #1: 서버 @MaxLength와 같은 숫자(단일 소스는 src/expenses/text-limits.ts).
                  maxLength={ITEM_NAME_MAX_LENGTH}
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
                    {/* GAP-054 라운드 54 P2-5 — 빠른 기록 시트와 **같은 달력 픽커**
                        (src/expenses/ExpenseDatePicker.tsx). 이 화면의 날짜 입력은 14일 칩과
                        ISO 손타이핑뿐이라, 두 주보다 오래된 영수증의 날짜를 고쳐 적으려면
                        "2026-07-18"을 직접 쳐야 했고 한 글자만 틀려도 저장이 막혔다 — 입력
                        시트가 트랙 C에서 고친 바로 그 구멍이 수정 화면에 그대로 남아 있었다.

                        새로 만드는 문법은 없다: 48dp 달 이동·미래 날짜 잠금·칸 라벨이 전부
                        그 컴포넌트(그리고 그 아래 순수 모듈)에서 온다. 아래 14일 칩과 직접
                        입력은 그대로 남는다 — 어제·그제는 칩이 더 빠르다.

                        세션 게이트: 이 블록 전체가 `expensePhase` 정상 경로 안에 있고,
                        `authToken`이 없으면 지출 조회 자체가 비활성이라 여기까지 오지 않는다.
                        그래도 `authToken`을 명시해, 세션 없이 그려지는 경로를 만들지 않는다. */}
                    {authToken ? (
                      <ExpenseDatePicker
                        onSelectDate={(dateIso) => {
                          // 칩 탭과 **같은 상태 갱신**이다 -- 저장 payload가 이 한 값만 본다.
                          setSpentOnIso(dateIso);
                          setCustomDateMode(false);
                          setCustomDateText("");
                        }}
                        selectedIso={spentOnIso || null}
                        todayIso={todayIso}
                      />
                    ) : null}
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
                  // GAP-056 #1: 서버 @MaxLength와 같은 숫자(단일 소스는 src/expenses/text-limits.ts).
                  maxLength={MEMO_MAX_LENGTH}
                  onChangeText={setMemo}
                  placeholder="메모를 입력해 주세요"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderColor: memoError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={memo}
                />
                {memoError ? (
                  <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{memoError}</Text>
                ) : null}
              </View>

              {/* GAP-054 #1: 환불 기록에서는 이 체크박스를 **누를 수 없다.** 환불이면서 선물인
                  기록은 서버에도 존재할 수 없고(expense_type은 셋 중 하나), 저장 규칙상 환불에서는
                  expenseType 자체를 보내지 않으므로 켜 봐야 아무 일도 일어나지 않는다 — 그 조용한
                  무시가 이 티켓이 고치려는 바로 그 종류의 거짓말이라, 누를 수 없게 만들고 이유를
                  한 줄로 밝힌다. 환불이 아닌 기존 기록에서는 한 픽셀도 바뀌지 않는다. */}
              <View style={{ gap: 6 }}>
                <Pressable
                  accessibilityLabel="선물로 받았어요"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isGift }}
                  accessibilityHint={isRefund ? REFUND_GIFT_DISABLED_REASON : undefined}
                  // react-native의 Pressable이 `disabled`를 accessibilityState.disabled로 합쳐
                  // 내려보내므로(Pressable.js), 위 상태 객체에 손대지 않아도 스크린 리더는 이
                  // 체크박스를 "비활성"으로 읽는다 -- A11Y-101 계약 문자열이 그대로 유지된다.
                  disabled={isRefund}
                  onPress={() => setIsGift((value) => !value)}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.white,
                    borderColor: "rgba(74, 63, 53, 0.10)",
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 10,
                    opacity: isRefund ? 0.4 : 1,
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
                    {/* 환불 기록에서는 이 자리가 비고, 이유 한 줄이 상자 **밖**에서 또렷하게
                        말한다(아래 주석). 선물 설명은 켤 수 있는 기록에서만 뜻이 있다. */}
                    {isRefund ? null : (
                      <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>
                        선물은 지출 합계에 포함되지 않아요
                      </Text>
                    )}
                  </View>
                </Pressable>
                {/* GAP-054 라운드 54 P2-2 — **이유 한 줄은 흐림 밖에 둔다.**

                    비활성 상자에 걸린 opacity 0.4는 체크박스만이 아니라 그 안의 글자까지 함께
                    흐리게 만든다. gray600 11px가 0.4로 흐려지면 흰 배경에서 약 1.9:1이라, 왜
                    누를 수 없는지를 설명하는 **바로 그 문장**이 가장 읽기 어려운 글자가 됐다 —
                    비활성 표시(상자)와 그 이유(문장)는 같은 흐림을 공유할 이유가 없다.

                    상자는 종전 그대로 흐리고(누를 수 없다는 사실은 그대로 보인다), 이유만 밖으로
                    빼서 gray600 원래 대비(약 6.9:1)로 읽히게 한다. 스크린리더 쪽은 바뀌지 않는다:
                    같은 문장이 이미 체크박스의 accessibilityHint로도 붙어 있다. */}
                {isRefund ? (
                  <Text
                    testID="refund-gift-disabled-reason"
                    style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}
                  >
                    {REFUND_GIFT_DISABLED_REASON}
                  </Text>
                ) : null}
              </View>
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

            {/* 라운드 58 #1 — 역방향 진입(판정·문구는 위 recurringPrefill 주석 참고).

                보기 전용 게이트(expenseGate)를 지나지 않는다: 여기서 저장되는 것은 지출이
                아니라 **이 기기의 메모**이고, 관리 화면도 같은 이유로 템플릿 CRUD를 게이트
                뒤에 두지 않는다(app/expenses/recurring.tsx). 이 버튼이 여는 것은 폼일 뿐이라
                누른 것만으로는 아무것도 저장되지 않는다.

                상한(20개)에 닿아 있으면 그 화면의 저장에서 RECURRING_LIMIT_MESSAGE가 그대로
                뜬다 — 이 진입점은 상한을 우회하는 두 번째 저장 경로를 만들지 않는다(저장은
                여전히 스토어 한 곳을 지난다).

                왜 상한(20개)은 버튼을 지우지 않는데 품목명 100자 초과는 지우는가(라운드 58
                통합리뷰 P2-3): 상한은 **사용자가 그 화면에서 지금 풀 수 있는 상태**라(쓰지 않는
                항목 하나를 지우면 곧바로 저장된다) 안내와 함께 열어 두는 편이 낫고, 100자 초과는
                이 프리필로는 풀 수 없는 상태다(칸의 maxLength가 새 글자만 막아 다 지우기 전에는
                저장이 열리지 않는다). 후자는 순수 모듈이 null을 돌려줘 버튼 자체가 서지 않는다. */}
            {canRegisterRecurring && recurringPrefill ? (
              <View testID="expense-to-recurring" style={{ gap: 6 }}>
                {/* 라운드 59 트랙 B 후속 배선 — 이미 등록된 지출에서는 **버튼 대신 사실**을 적는다
                    (판정 근거는 위 alreadyRegisteredRecurring 주석). 안내 한 줄도 함께 내린다:
                    "적어 둘 수 있어요"는 이미 적어 둔 사람에게 참이 아니고, 그 자리에는 지금 있는
                    약속(품목 · 금액 · 결제일)을 그대로 보여주는 편이 다음 행동에 쓸모 있다. */}
                {alreadyRegisteredRecurring ? (
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                    {`${RECURRING_ALREADY_REGISTERED_LABEL} · ${formatRecurringTemplateLine(alreadyRegisteredRecurring)}`}
                  </Text>
                ) : (
                  <>
                    <SecondaryButton
                      label={RECURRING_REGISTER_ACTION_LABEL}
                      onPress={() => router.push({ pathname: "/expenses/recurring", params: recurringPrefill })}
                    />
                    <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                      {RECURRING_REGISTER_ACTION_NOTICE}
                    </Text>
                  </>
                )}
              </View>
            ) : null}

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
