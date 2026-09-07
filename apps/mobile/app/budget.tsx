import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import {
  getBudget,
  getTrendReport,
  listCategories,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  upsertBudget,
  type Child,
  type Expense,
  type HomeSummary
} from "../src/api/client";
// GAP-060 #7(트랙 E): 다자녀 스코프 라벨의 해석·조립은 4탭·빠른 기록 시트와 **같은 순수 모듈**
// 한 벌에서만 온다(새 어휘를 만들지 않는다 — src/expenses/entry-child-scope.test.ts).
import { resolveChildScopeLabel, withChildScopeLabel } from "../src/children/child-switch";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { amountDigitsOnly, formatAmountDigits, formatKrw } from "../src/money";
// GAP-054 #2: 금액 상한의 값·문구는 지출 입력 화면들과 **같은 모듈**에서 온다. 여기에 숫자를
// 다시 적으면 서버 @Max와 갈라지는 순간을 아무도 모른다(src/expenses/amount-limit.ts).
import { amountOverLimitMessage, isAmountOverLimit } from "../src/expenses/amount-limit";
// 라운드 103 리뷰 M-2: 카테고리 행 모집단의 가구 판정은 기록 탭·지출 수정·검수와 **같은 규칙**
// 한 벌에서 온다(라운드 27 L-4의 그 함수 — 규칙을 두 벌로 만들지 않는다).
import { resolveExpenseHouseholdId } from "../src/expenses/records-list-view";
// 라운드 102 T3: 카테고리별 예산 카드 — 행 조립·검증·문구·이월 칩 판정·합 관측은 전부 이 순수
// 모듈이 소유하고 화면은 그린다(docs/5차/round102-category-budget-design.md §4.1·§4.2).
import {
  buildCategoryBudgetForm,
  buildCategoryCarryOverChip,
  categoryBudgetInitialDigits,
  isCategoryBudgetDirty,
  mergeCategoryBudgetDraft
} from "../src/expenses/category-budget-form";
import {
  buildBudgetAdjustChips,
  buildBudgetUsageLine,
  resolveThisMonthUsedKrw,
  sumLastMonthActualKrw
} from "../src/home/budget-edit";
// 기능 라운드 1 트랙 E: 최근 3개월 실지출 평균 제안 칩 — 평균·문구·a11y는 전부 이 순수 모듈이
// 만들고(허위 표시 방지 규칙 포함), 화면은 추이 응답을 넘겨 받은 칩을 목록 조립에 주입만 한다.
import { buildRecentAverageChip } from "../src/home/budget-suggestion";
import { previousYearMonth } from "../src/home/last-month-comparison";
// 라운드 70 B: 예산 저장의 서버 술어는 지출 쓰기와 **같은 canEdit**이라 판정을 새로 만들지 않고
// 기존 게이트를 **읽는다**(훅은 이 트랙이 소유하지 않는다 — 한 글자도 바꾸지 않는다).
import { useExpenseEntryGate } from "../src/family/useExpenseEntryGate";
import { guardExpenseAction, VIEW_ONLY_HEADLINES } from "../src/family/record-permissions";
import { useLoadErrorCopy, useSaveErrorCopy } from "../src/offline/use-load-error-copy";
import { useOfflineSyncSnapshot } from "../src/offline/sync-controller";
import { AppScreen, Card, EmptyStateCard, PrimaryButton, ScreenHeader, Toast } from "../src/ui";
import { SkeletonCard } from "../src/ui/Skeleton";
import { theme } from "../src/theme";

// FMT-127: 금액 표기(콤마)·입력 정규화는 src/money.ts가 단일 소스다 -- 이 화면에 있던
// toDigits/formatAmount 사본은 (온보딩 예산·지출 수정 화면의 같은 사본들과 함께) 제거했다.

/**
 * BUD-001(라운드 38 UX-M): 예산을 얼마로 할지 정하려면 "지금까지 얼마 썼는지 · 얼마 남았는지 ·
 * 지난달엔 실제로 얼마 썼는지"가 필요한데 이 화면에는 하나도 없었다. 세 값을 **새 요청 없이**
 * 이 화면이 이미 받는 응답과 이미 채워진 react-query 캐시에서 읽는다:
 *  - 사용액: 이 화면의 budget 쿼리 응답 `usedAmountKrw`(선물·환불 제외 서버 집계, DNC-015)가
 *    1순위. 예산 미설정(budget.data === null)이라 응답이 없을 때만 `["home", childId]` 캐시의
 *    `monthly.usedAmountKrw`로 폴백한다. 예외는 하나 — 이번 달에 아직 서버가 모르는 로컬 변경
 *    (오프라인 대기·삭제 대기)이 있을 때만 이번 달 캐시 재조정 값이 앞선다(라운드 40 J-4).
 *  - 지난달 실지출: `["expenses", childId, 지난달]`(홈의 "지난달 같은 시점 대비" 한 줄과 기록
 *    탭이 공유하는 바로 그 캐시) + 이 기기의 오프라인 대기 행.
 * `getQueryData`는 구독이 아니라 **읽기**라 쿼리를 활성화하지 않는다 -- 캐시가 없으면
 * undefined가 오고, 그때는 줄과 칩을 만들지 않는다(0원으로 떨어뜨리면 확인한 적 없는 사실을
 * 말하게 된다. 판정과 문구는 전부 src/home/budget-edit.ts).
 *
 * 라운드 38 H-4: 사용액을 홈 캐시에서만 읽던 때는 알림 → `/budget` 직행처럼 홈이 한 번도
 * 마운트되지 않은 경로에서 판단 줄이 통째로 사라졌고, 카드 위쪽 "현재 예산"(방금 받은 응답)과
 * 아래 한 줄(예전 홈 캐시)이 서로 다른 시점을 섞어 말할 수도 있었다. 같은 응답에서 두 값을
 * 함께 읽으면 둘 다 사라진다.
 */

/**
 * 기능 라운드 1 트랙 E — 최근 실지출 평균 제안이 근거로 삼는 창(개월).
 *
 * 리포트 화면의 `MONTHLY_TREND_MONTHS`·`QUARTER_TREND_MONTHS`와 같은 관례(화면 지역 상수)다.
 * src/home/budget-suggestion.ts의 창(`RECENT_AVERAGE_WINDOW_MONTHS`)과 같은 값이어야 하고,
 * 그 정합은 budget-suggestion.test.ts가 두 소스를 함께 읽어 문다.
 */
const RECENT_AVERAGE_TREND_MONTHS = 3;

const budgetContextLineStyle = {
  color: theme.colors.gray600,
  fontSize: theme.typography.caption.fontSize,
  lineHeight: 18
} as const;

/**
 * 라운드 102 리뷰 L-a11y — 카테고리 카드에서 **저장을 잠그는** 오류 줄(행 상한·30개 상한).
 * 관측 줄(budgetContextLineStyle)과 같은 자·같은 줄높이지만 색이 다르다: 이 줄이 서 있는 동안
 * [저장]이 눌리지 않으므로(categoryForm.isValid === false) 사실 서술이 아니라 오류다.
 * 색은 이 화면의 총액 상한 오류와 같은 `theme.colors.danger` 한 벌이다(신규 리터럴 0 — DNC-017).
 */
const budgetCategoryLockedErrorStyle = {
  color: theme.colors.danger,
  fontSize: theme.typography.caption.fontSize,
  lineHeight: 18
} as const;

const budgetChipRowStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8
} as const;

/**
 * T10(토스급) — 예산 저장 성공의 확인 문장.
 *
 * 지금까지 저장 성공은 완전 무음이었다: onSuccess가 곧바로 router.replace를 불러, 화면이
 * "저장됐다"는 말을 한 번도 하지 않은 채 홈으로 바뀌었다(스크린리더 사용자에게는 더 심하다 —
 * 버튼을 눌렀는데 아무 소리 없이 화면이 통째로 바뀐다). 공용 Toast는 마운트 시 자기 문장을
 * announceForA11y로 낭독하므로(src/ui.tsx A11Y-115), 이 문장을 토스트로 세우는 것이 곧
 * 시각 확인 + 낭독 둘 다가 된다. 650ms 지연 이동은 지출 상세의 저장 성공(leaveTimerRef,
 * GAP-056 #6)과 같은 관례·같은 값이다.
 */
const BUDGET_SAVED_MESSAGE = "예산을 저장했어요";

const budgetChipStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.primary100,
  borderRadius: theme.radii.pill,
  borderWidth: 1,
  justifyContent: "center",
  minHeight: theme.touchTarget,
  paddingHorizontal: 14
} as const;

export default function BudgetEditScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  // 라운드 103 M-2의 가구 판정 폴백 — 아이 목록에 그 아이가 있는데 householdId만 비어 있는
  // 구버전 캐시에서만 쓰인다(resolveExpenseHouseholdId의 마지막 갈래).
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [amountDigits, setAmountDigits] = useState("");
  /**
   * 라운드 102 §4.1 — 카테고리 행에서 **사용자가 실제로 고친 값**만 담는 맵(categoryId → 숫자
   * 문자열). 화면이 그리는 값은 서버 초기값 위에 이 편집을 얹은 것(mergeCategoryBudgetDraft)
   * 이라, 저장 시 dirty 판정(값 비교)이 "안 고친 저장"과 "고쳤다가 되돌린 저장"을 둘 다
   * 무접촉(필드 미탑재)으로 접는다 — 두 기기 동시 편집 레이스를 좁히는 §6.7 R1의 배선이다.
   */
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  // T10: 저장 성공 토스트(위 BUDGET_SAVED_MESSAGE 주석). 값이 서면 아래에서 Toast가 그려지고,
  // Toast 자신이 문장을 낭독한다 -- 화면이 announce를 따로 부르지 않는다(문장 이중 낭독 방지).
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  /**
   * T10 — "저장했어요"를 보여 준 뒤 떠나는 650ms 타이머. 지출 상세의 leaveTimerRef
   * (GAP-056 #6)와 같은 관례다: ref에 들고 언마운트 때 취소한다. 없으면 성공 직후 사용자가
   * 스스로 뒤로 갔을 때 타이머가 살아남아 사라진 화면의 replace가 한 번 더 실행된다.
   */
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);
  /**
   * 라운드 102 리뷰 L-11 — **예방 방어 한 줄**: 아이가 바뀌면 화면의 초안을 버린다.
   *
   * 오늘 이 화면에는 아이 전환 입구가 없다(설정·홈에서만 바꾼다). 그런데 `childId`는 전역
   * persist 스토어에서 오므로, 이 화면이 떠 있는 동안 다른 경로로 값이 바뀌면 쿼리 키
   * (`["budget", childId]`)만 갈아타고 **입력 초안은 그대로 남는다** — A의 아이에게 치던
   * 총액·카테고리 숫자가 그대로 B의 아이의 [저장]에 실린다. 전환 입구가 이 화면에 생기는 날
   * 조용히 열릴 구멍이라, 그 전에 닫아 둔다(비용은 이 훅 하나다). 훅이므로 아래 조기 반환들
   * 보다 위에 선다(홈 화면 FIX-A와 같은 규율).
   */
  useEffect(() => {
    setAmountDigits("");
    setCategoryEdits({});
  }, [childId]);
  const queryClient = useQueryClient();
  const budget = useQuery({
    queryKey: ["budget", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getBudget(authToken!, childId!)
  });

  /**
   * 라운드 102 §4.1 — 카테고리별 예산 카드의 행 모집단. 이 화면이 `["categories"]` 캐시를
   * 직접 채운다 — includeAll 전량 규약(categories-cache-contract 스윕)·staleTime은 리포트
   * 화면과 같은 형식이다. 목록이 아직 없으면(로딩·실패·오프라인 첫 실행) 아래 categoryForm이
   * null이라 카드 자체가 서지 않는다(모르면 제안하지 않는다 — 8타일 폴백으로 별칭 id 예산이
   * 저장되는 경로를 구조적으로 차단).
   */
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken),
    staleTime: 5 * 60 * 1000,
    queryFn: () => listCategories(authToken!, { includeAll: true })
  });

  const typedAmountKrw = amountDigits ? Number(amountDigits) : null;
  /**
   * GAP-054 #2 — 0 이하와 함께 **상한 초과**도 여기서 막는다.
   *
   * `budgets.amount_krw`는 int4라 2,147,483,647을 넘는 값은 저장이 아니라 서버 오류로 끝난다.
   * 지금까지 이 화면은 그 사실을 말하지 않고 저장을 시도하게 뒀고, 사용자는 "저장하지
   * 못했어요. 잠시 후 다시 시도해 주세요."라는 **틀린 안내**(다시 눌러도 절대 성공하지 않는다)
   * 앞에서 멈췄다. 상한 값·문구는 지출 입력 화면들과 같은 단일 소스에서 가져온다.
   */
  const amountError =
    typedAmountKrw !== null && typedAmountKrw <= 0
      ? "0보다 큰 금액을 입력해 주세요."
      : isAmountOverLimit(typedAmountKrw ?? 0)
        ? amountOverLimitMessage()
        : null;

  /**
   * GAP-060 #7(트랙 E) — 이 화면이 고치는 예산은 **(아이, 월) 한 칸**이다.
   *
   * 월은 이미 제목이 말하고 있었지만("월 예산 수정") 아이는 어디에도 없었다. 예산 행은
   * `(childId, yearMonth)` 유니크이고 이월 규칙이 없는데(위 B1(b) 주석), 다자녀 가구에서 이
   * 화면은 첫째든 둘째든 완전히 같은 그림이라 방금 세운 20만 원이 누구의 8월에 들어갔는지
   * 확인할 방법이 화면 안에 없었다 — 홈 히어로로 돌아가서야 알게 된다. 라벨이 붙으면 제목
   * 한 줄이 "다온이 — 월 예산 수정"이 되어 (아이, 월) 두 축이 모두 화면에 선다.
   *
   * 이 **읽기 자체**는 이 화면의 다른 맥락 값들과 같은 규칙이다(이 파일 머리 주석): `useQuery`가
   * 아니라 `getQueryData`라 쿼리를 활성화하지 않는다. ["children"]은 홈·기록·리포트·설정이 이미
   * 채워 두는 캐시라 앱을 통해 들어왔다면 거의 언제나 있고, 비어 있으면 라벨이 null이라 제목이
   * 종전 그대로다. 지난달 **예산**만 조회를 켰던 것(B1(b))은 그 값이 어떤 화면도 받아 두지 않는
   * 데이터여서였고, 아이 목록은 그 예외에 해당하지 않는다 — 모르면 말하지 않는다.
   *
   * ⚠️ 라운드 70 리뷰(S-2) — **"이 화면은 ["children"]에 새 요청을 내지 않는다"는 이 좌표에서
   * 더는 참이 아니다.** 라운드 70 B가 저장 게이트로 부르기 시작한 `useExpenseEntryGate`가
   * 다가구·부분 표 계정에서 같은 키(["children"])의 쿼리를 **켤 수 있다**
   * (needsChildHouseholdResolution — src/family/useExpenseEntryGate.ts). 그 계정에서는
   * ⓐ 요청이 0건이 아니고, ⓑ 알림 → /budget 직행 콜드 스타트라도 그 조회가 끝나면 캐시가
   * 채워져 라벨이 **뒤늦게** 붙을 수 있다(빈 캐시로 시작하니 첫 프레임의 제목은 여전히 종전
   * 그대로다). 표가 비었거나 서버가 "가구가 하나뿐"이라고 말한 계정 · 데모 · 비세션에서는 그
   * 쿼리가 켜지지 않으므로 이 자리의 종전 서술이 그대로 맞다.
   *
   * 그래도 이 줄이 `getQueryData`인 것은 그대로다: 게이트가 켜 준 캐시를 **읽기만** 하고,
   * 라벨을 위해 조회를 켜지는 않는다(그것이 "모르면 말하지 않는다"의 배선이다).
   *
   * ⚠️ 라운드 71 트랙 E — **표기 정정.** 이 자리(와 아래 저장 게이트 주석 · record-permissions.test.ts)는
   * 종전에 "BUD-001 픽셀락 캡처"라고 적었지만, 픽셀락 캡처는 아홉이고 그 목록에 BUD-001은 없다
   * (app/pixel-lock.tsx의 `pixelLockRoutes` — splash · home · quick-expense · recommendation ·
   * product-detail · family · excel-preview · report · more). 이 화면의 `screen-BUD-001`은 QA
   * 화면 id일 뿐 캡처 대상이 아니다. 라운드 70 F가 "제품 소스 0건" 계약 때문에 고치지 못하고
   * 이 파일을 여는 다음 트랙에 넘긴 자리다(docs/qa/runtime-verification-required.md).
   * **지키려는 사실은 그대로다**: 비세션 렌더에서는 `authToken`이 null이라 캐시를 읽지도 않고,
   * 잠금 판정도 비세션에서는 절대 발동하지 않는다(판정·값은 한 글자도 바뀌지 않았다). 외동 가구도
   * `resolveChildScopeLabel`이 null을 주므로 종전 화면 그대로다. (낭독 전용 변형은 쓰지 않는다 —
   * 공용 `ScreenHeader`의 제목 Text는 잘리지 않아 보이는 문구가 곧 접근성 이름이고, 덮어쓸
   * accessibilityLabel 슬롯이 없다.)
   */
  const cachedChildren = authToken
    ? queryClient.getQueryData<{ children: Child[] }>(["children"])?.children
    : undefined;
  const childScopeLabel = resolveChildScopeLabel(childId, cachedChildren);

  // 새 요청 0: 캐시에 있으면 읽고, 없으면 undefined -> 줄/칩을 만들지 않는다.
  const offlineSnapshot = useOfflineSyncSnapshot();
  const cachedHome = childId ? queryClient.getQueryData<HomeSummary>(["home", childId]) : undefined;
  const lastYearMonth = previousYearMonth(getSeoulToday());
  const cachedLastMonth =
    childId && lastYearMonth
      ? queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", childId, lastYearMonth])
      : undefined;
  /**
   * 라운드 48 B1(b) — 매달 1일에 예산이 통째로 사라지는 자리.
   *
   * 월 예산은 (childId, yearMonth) 유니크이고 **이월 규칙이 없다**. 9월 1일이 되면 이 화면은
   * "아직 예산이 없어요"만 남고, 8월에 스스로 정해 둔 값을 다시 세우려면 앱 밖의 기억에
   * 의존해야 했다. 지난달 예산을 **1건** 조회해 "지난달과 같은 N원으로 시작" 칩의 근거로만
   * 쓴다(칩 판정·문구는 전부 src/home/budget-edit.ts의 순수 함수에 있다).
   *
   * 이 화면의 다른 맥락 값들과 달리 캐시 읽기로는 안 된다 — 지난달 **예산**은 이 앱의 어떤
   * 화면도 받아 두지 않는 데이터라(캐시에 있을 수가 없다) 조회가 유일한 근거다. 대신 요청은
   * 이번 달 예산이 **없다고 확인된 뒤에만** 켠다(`budget.data === null`): 예산이 있는 달에는
   * 이월 제안이 성립하지 않으므로, 대다수 사용자에게는 이 왕복이 아예 생기지 않는다(홈의
   * 콜드 스타트 defer와 같은 판단 — 지금 필요하지 않은 요청은 켜지 않는다).
   *
   * 앱이 이 값을 새 달의 예산으로 **자동 저장하지 않는다**. 사용자가 정한 적 없는 예산을 앱이
   * 지어내는 것이기 때문이다 — 제안만 하고, 저장은 사람이 칩을 눌러 [저장]할 때만 일어난다.
   */
  const lastMonthBudget = useQuery({
    queryKey: ["budget", childId, lastYearMonth],
    enabled: Boolean(authToken && childId && lastYearMonth) && budget.data === null,
    queryFn: () => getBudget(authToken!, childId!, lastYearMonth!)
  });

  /**
   * 기능 라운드 1 트랙 E — 최근 3개월 실지출 평균 제안 칩의 근거(지난달까지 3개월의 월별 합계).
   *
   * 지난달 예산과 달리 실지출은 캐시에 조각으로 있지만(지난달 ["expenses"] 캐시 한 달치),
   * 3개월 평균에는 그 앞 두 달이 더 필요하고 그 달들은 어떤 화면도 받아 두지 않는다. 기존
   * `getTrendReport`(REP-128 — 서버 0바이트, 로컬 백엔드 기지원)가 한 번의 범위 질의로 세 달을
   * 접어 주므로 그것을 그대로 재조합한다. 요청은 위 이월 칩과 **같은 defer 판단**으로 좁힌다 —
   * 이번 달 예산이 없다고 확인된 뒤에만 켠다(예산이 있는 달에는 "…으로 시작" 제안이 성립하지
   * 않아 왕복이 아예 생기지 않는다). 조회 전·실패면 data가 없어 칩도 없다(모르면 제안하지 않는다).
   *
   * 키 머리를 ["report"]가 아니라 **["budget"]**으로 두는 이유: 이 응답은 리포트 화면이 아니라
   * 예산 제안의 근거라, 예산 캐시와 같은 수명이 맞다 — 지출 쓰기·예산 저장이 이미 무효화하는
   * ["budget"] 프리픽스와 아이 전환 teardown(CHILD_SCOPED_QUERY_KEY_PREFIXES의 ["budget"])에
   * 그대로 걸리고, ["report"] 키의 선언 파일을 이 화면으로 넓혀 공유 키 대장(shared-cache-policy)의
   * 모집단을 움직이지도 않는다. 둘째 칸이 childId인 것은 ["budget"] 선언 전수의 계약이고
   * (shared-cache-policy.test.ts의 childId 스코프 스윕), 그 뒤 꼬리가 용도·달·개월 수를 가른다.
   */
  const recentTrend = useQuery({
    queryKey: ["budget", childId, "recent-trend", lastYearMonth, RECENT_AVERAGE_TREND_MONTHS],
    enabled: Boolean(authToken && childId && lastYearMonth) && budget.data === null,
    queryFn: () => getTrendReport(authToken!, childId!, lastYearMonth!, RECENT_AVERAGE_TREND_MONTHS)
  });

  const currentBudgetKrw = budget.data?.amountKrw ?? null;
  /**
   * 라운드 39 I-6 + 라운드 40 J-4: 이번 달 사용액을 무엇으로 말할지.
   *
   * I-6은 지난달 칩과 **같은 모집단**으로 말하려고 캐시 재조정 값을 1순위에 놓았다(아직
   * 올라가지 않은 오프라인 대기 지출이 이번 달에서만 빠지면 같은 화면의 두 숫자가 갈린다).
   * 그런데 그 우선순위가 무조건이라, 이번 달 캐시가 비었거나 낡았을 때는 방금 받은 서버 집계를
   * 이기고 "0원 사용"이라는 허위 표시를 만들었다(다른 기기에서 기록한 지출이 있는 경우).
   *
   * 이제 우선순위 판정은 순수 모듈 한 곳에 있다 — 그 달에 오프라인 대기·삭제 대기 행이 **실제로
   * 있을 때만** 캐시 재조정 값을 쓰고, 아니면 서버 집계(H-4의 직행 경로 폴백까지)를 쓴다.
   */
  const thisYearMonth = getSeoulToday().slice(0, 7);
  const cachedThisMonth = childId
    ? queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", childId, thisYearMonth])
    : undefined;
  const usedKrw = resolveThisMonthUsedKrw({
    cachedExpenses: cachedThisMonth?.expenses ?? null,
    offline: { rows: offlineSnapshot.rows, childId, yearMonth: thisYearMonth },
    serverUsedKrw: budget.data?.usedAmountKrw,
    homeUsedKrw: cachedHome?.monthly.usedAmountKrw
  });
  const usageLine = buildBudgetUsageLine({
    budgetKrw: currentBudgetKrw,
    usedKrw
  });
  // 합산 술어는 기록 탭·홈 월 합계와 같은 countsTowardMonthlyTotal 한 곳에서만 온다(DNC-015).
  //
  // 라운드 38 H-1: 서버 캐시만 더하면 기록 탭이 같은 달에 보여 주는 합계와 갈라진다 -- 아직
  // 올라가지 않은 오프라인 대기 행이 빠지고 삭제 대기 행은 남는다. 기록 탭·지출 입력 맥락 줄과
  // 똑같이 이 기기의 오프라인 스냅숏을 childId로 걸러 함께 넘겨 재조정한다(새 요청 0).
  const lastMonthActualKrw = sumLastMonthActualKrw(
    cachedLastMonth?.expenses ?? null,
    lastYearMonth ? { rows: offlineSnapshot.rows, childId, yearMonth: lastYearMonth } : undefined
  );
  // B1(b): 지난달 예산은 이번 달 예산이 없을 때만 조회되고(위), 없으면 undefined -> 칩도 없다.
  // 트랙 E: 평균 칩도 같은 규율 — 추이 응답이 없으면 null이라 칩이 없고, 이월 칩과 값이 같으면
  // 하나만 남는 판정까지 전부 순수 모듈(budget-suggestion.ts + buildBudgetAdjustChips)이 한다.
  const adjustChips = buildBudgetAdjustChips({
    amountDigits,
    currentBudgetKrw,
    lastMonthActualKrw,
    lastMonthBudgetKrw: lastMonthBudget.data?.amountKrw ?? null,
    recentAverageChip: buildRecentAverageChip(recentTrend.data?.months ?? null)
  });

  /**
   * 라운드 102 §4.1 — 카테고리별 예산 카드의 산출 전부(행·검증·문구·이월 칩). 판정은 전부
   * 순수 모듈에 있고 화면은 그린다.
   *
   * - 세션 갈래(authToken) 아래에서만 조립한다(§6.6 — 비세션은 캐시를 읽지도 않는 기존 구조
   *   그대로). 목록이 없으면 categoryForm이 null → 카드 미렌더.
   * - 합 관측의 분모는 **입력 중 값 우선, 없으면 현재 예산**(§4.1 확정값).
   * - dirty가 아니면 저장 요청에 categoryBudgets 필드 자체가 실리지 않는다(§2.2 부재 = 서버
   *   무접촉 — 온보딩 예산 화면 등 기존 호출부와 같은 하위호환 갈래).
   */
  const categoryInitialDigits = categoryBudgetInitialDigits(budget.data?.categoryBudgets);
  const categoryDraft = mergeCategoryBudgetDraft(categoryInitialDigits, categoryEdits);
  /**
   * 라운드 103 리뷰 M-2 — 행 모집단의 **가구**. 이 예산은 이 아이의 것이고, 서버의 카테고리
   * 예산 검증도 그 가구 하나로 좁힌다. 두 가구에 속한 계정에서 그 값을 넘기지 않으면 다른 가구의
   * 커스텀 분류가 행으로 서고, 거기에 숫자를 넣고 [저장]을 누르면 서버가 요청을 통째로 거절해
   * **그 달의 총액 예산까지 함께** 막혔다(replace-set은 한 요청이다). 위 `cachedChildren`을 그대로
   * 읽으므로 새 요청은 0건이고, 캐시가 없으면 null이라 종전과 한 행도 다르지 않다.
   */
  const categoryHouseholdId = resolveExpenseHouseholdId({
    children: cachedChildren,
    childId,
    fallbackHouseholdId: sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null)
  });
  const categoryForm =
    authToken && categories.isSuccess
      ? buildCategoryBudgetForm({
          categories: categories.data?.categories,
          draft: categoryDraft,
          totalBudgetKrw: typedAmountKrw ?? currentBudgetKrw,
          householdId: categoryHouseholdId
        })
      : null;
  const categoryDirty = isCategoryBudgetDirty(categoryInitialDigits, categoryDraft);
  // §4.2 — "지난달 카테고리 예산 그대로" 칩. 기존 이월 칩과 같은 defer 갈래(budget.data ===
  // null일 때만 lastMonthBudget 조회가 켜져 있다)라 추가 요청은 0건이고, 누르면 행에 채워
  // 넣기만 한다(자동 저장 금지 — B1(b) 규율 그대로).
  const categoryCarryOverChip = categoryForm
    ? buildCategoryCarryOverChip({
        thisMonthBudgetMissing: budget.data === null,
        lastMonthEntries: lastMonthBudget.data?.categoryBudgets,
        draft: categoryDraft
      })
    : null;

  // 라운드 52 C-07: 예산 저장은 아웃박스를 거치지 않는 서버 직행 쓰기라, 오프라인에서는 그냥
  // 실패한다. 그때 "잠시 후 다시 시도해 주세요"는 기다릴 대상이 있다는 뜻이라 사실과 어긋난다 --
  // 실패한 그 순간에 연결을 한 번 확인해 문구를 고른다(src/offline/messages.ts).
  //
  // 라운드 52 QA P3-1: 그 확인은 조회 실패 카드와 **같은 공용 훅**이 한다(useSaveErrorCopy).
  // 예전에는 이 화면이 onError에서 직접 폴을 띄워, 저장 실패 직후 뒤로 가면 사라진 화면에
  // setState가 걸리고(언마운트 미가드), 연달아 실패하면 늦게 도착한 옛 판정이 최신 판정을
  // 덮어쓸 수 있었다. 훅은 cancelled 패턴으로 둘 다 막고, 에러가 풀리면 문구도 복원한다.
  const save = useMutation({
    mutationFn: () => {
      const amountKrw = Number(amountDigits || budget.data?.amountKrw);
      // GAP-054 #2: 저장 버튼이 이미 비활성이지만, 서버가 받아 줄 수 없는 값이 요청으로
      // 나가는 경로를 여기서도 한 번 더 닫는다(서버 @Max와 같은 숫자를 본다).
      if (!authToken || !childId || !Number.isInteger(amountKrw) || amountKrw <= 0 || isAmountOverLimit(amountKrw)) {
        throw new Error("invalid budget");
      }
      // 라운드 102 §2.2/§4.1: 카테고리 구획은 카드가 렌더됐고(categoryForm) 사용자가 행을
      // 고쳤을 때만(dirty) 화면 전체 집합으로 싣는다 — 아니면 undefined(필드 미탑재 = 그 달의
      // 카테고리 행을 읽지도 쓰지도 않는 서버 무접촉). 서버가 받아 줄 수 없는 집합(상한·행
      // 오류)은 버튼 비활성에 더해 여기서도 한 번 더 닫는다(총액의 GAP-054 #2와 같은 이중 가드).
      if (categoryForm && categoryDirty && !categoryForm.isValid) {
        throw new Error("invalid budget");
      }
      const categoryBudgets = categoryForm && categoryDirty ? categoryForm.entries : undefined;
      return upsertBudget(authToken, childId, amountKrw, undefined, categoryBudgets);
    },
    onSuccess: async () => {
      // BUD-001: 예전에는 인자 없이 무효화를 불러 **앱 전체 캐시**를 날렸다 -- 준비템
      // 목록·카테고리·가족 구성원처럼 예산과 무관한 화면까지 전부 다시 받아, 저장 한 번에
      // 불필요한 요청이 줄줄이 붙었다. 예산 변경이 실제로 바꾸는 화면만 좁혀 무효화한다:
      //  - ["budget"]: 이 화면 자신.
      //  - ["home"]:   히어로 카드의 남은 예산·퍼센트·예산 넛지(budget-progress.ts).
      //  - ["report"]: 월간 리포트의 budgetAmountKrw.
      // 지출 목록(["expenses"])은 예산을 바꿔도 한 건도 달라지지 않으므로 건드리지 않는다.
      await Promise.all(
        [["budget"], ["home"], ["report"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      );
      // T10: 무음 즉시 이동 → 확인 토스트(+낭독) 후 650ms 지연 이동. 목적지는 종전 그대로
      // 홈이고, 타이머는 ref에 담아 언마운트 때 취소한다(위 leaveTimerRef 주석).
      setSavedMessage(BUDGET_SAVED_MESSAGE);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => router.replace("/(tabs)"), 650);
    }
  });

  // 라운드 102: 카테고리 구획을 고친 상태(dirty)에서 그 집합이 서버가 거절할 값(행 상한 초과 ·
  // 상한 30 초과)이면 저장을 잠근다 — 실패가 예정된 요청을 내보내지 않는다(GAP-054 #2와 같은
  // 판단). 고치지 않은 화면(dirty 아님)은 필드가 실리지 않으므로 잠글 이유도 없다.
  const canSave = !amountError &&
    !(categoryForm && categoryDirty && !categoryForm.isValid) &&
    Boolean(authToken && childId) &&
    (amountDigits.length > 0 || Boolean(budget.data));

  /**
   * 라운드 70 B — **앱에서 마지막까지 역할 게이트를 지나지 않던 쓰기**가 이 화면의 저장이었다.
   *
   * 서버는 예산 저장을 편집 역할(owner·co_parent)에게만 허용한다(upsertBudget →
   * requireChildAccess(edit) → canEdit). 그런데 이 화면에는 판정이 아예 없어서, 보기 전용으로
   * 참여한 사람도 금액을 적고 [저장]을 눌렀고, 돌아오는 것은 "저장하지 못했어요. 잠시 후 다시
   * 시도해 주세요."였다 — **기다릴 대상이 있다는 뜻**인데 실제로는 다시 눌러도 영원히 같은
   * 403이다. 라운드 40 UX-R(M)이 지출 입력에서 없앤 시퀀스가 이 한 화면에 남아 있었다.
   *
   * 판정은 **새로 만들지 않는다**: 서버 술어가 지출 쓰기와 같으므로 `useExpenseEntryGate`의
   * 그 판정을 그대로 읽는다(모르면 잠그지 않는다 · 비세션은 절대 잠기지 않는다 —
   * 라운드 71 트랙 E 표기 정정: 이 화면은 픽셀락 캡처 아홉에 **없다**. 비세션에서 잠기지
   * 않는다는 사실 자체는 판정이 지고 있다). 문장만 예산의 것이다(record-permissions.ts).
   *
   * **화면은 잠그지 않는다 — 저장만 잠근다.** 서버는 읽기를 구성원 전원에게 허용하므로 보기
   * 전용 참여자도 이번 달 예산이 얼마인지 볼 수 있어야 하고, 잠긴 컨트롤은 사라지는 대신
   * 눌렀을 때 사실을 말한다(useExpenseEntryGate 머리말의 그 관례).
   */
  const expenseGate = useExpenseEntryGate();
  /**
   * 라운드 70 리뷰 P-B / 라운드 71 트랙 E — **안내를 다시 구현하지 않는다.**
   *
   * 이 화면은 게이트가 이미 하는 세 줄(Alert 제목·본문 + 역할 재검증)을 지역 함수로 한 벌 더
   * 갖고 있었고, 다른 점은 본문 한 줄뿐이었다. 이제 그 한 줄만 넘긴다 — 안내가 곧 역할 재검증
   * 트리거라는 라운드 40 J-3의 경로도 게이트 안에 그대로 있다(조회는 백그라운드·스로틀이라
   * 안내 자체는 지금 그대로 뜬다).
   */
  const saveBudget = guardExpenseAction(
    expenseGate.locked,
    () => expenseGate.explain(VIEW_ONLY_HEADLINES.budget),
    () => save.mutate()
  );

  // C-07 문구(온라인이면 종전 그대로, 오프라인이면 기다릴 대상이 없다는 사실).
  //
  // 라운드 70 B: 실패 값을 함께 넘겨 **서버가 말해 준 사유**를 먼저 보게 한다(아는 코드면 표의
  // 문구, 모르면 위 두 문장 그대로 — src/offline/messages.ts의 resolveSaveErrorCopy).
  const saveErrorText = useSaveErrorCopy(save.isError, save.error);

  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와 [다시 시도]
  // 버튼은 그대로 -- 문구만 바뀐다(src/offline/messages.ts).
  const loadErrorCopy = useLoadErrorCopy(budget.isError);

  return (
    <AppScreen>
      <View testID="screen-BUD-001" style={{ gap: theme.spacing.section }}>
        {/* 라운드 39 I-8: 스택으로만 도달하는 화면이라 OS 헤더가 없다(전역 headerShown:false).
            알림함 → /budget 직행이 가장 갇히기 쉬운 경로였다 -- UX-Q(C)가 낸 ScreenHeader의
            onBack 슬롯을 그대로 쓴다(‹ 표기·"뒤로가기" 라벨·44dp 타깃이 한 곳에 있다). */}
        {/* 라운드 71 트랙 E — **머리말이 게이트를 읽는다.**
            잠긴 계정에게 이 자리는 종전에 "필요할 때 언제든 예산을 조정할 수 있어요."라고 말했고,
            바로 아래 저장 버튼은 "보기 전용으로 참여하고 있어요"라고 답했다 — 화면이 자기 자신과
            모순됐다. 문장은 순수 모듈에서 오고(화면이 짓지 않는다), 판정은 저장 버튼과 **같은
            하나**다. 역할 미상·비세션·데모는 종전 문장 그대로다(모르면 잠그지 않는다). */}
        <ScreenHeader
          eyebrow="예산 관리"
          title={withChildScopeLabel("월 예산 수정", childScopeLabel)}
          subtitle={expenseGate.locked ? VIEW_ONLY_HEADLINES.budget : "필요할 때 언제든 예산을 조정할 수 있어요."}
          onBack={() => router.back()}
        />

        {budget.isLoading ? (
          // MOB-119 (UX-5B-5 후속, D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
          // 현재 예산/새 예산 카드 2장 실루엣으로 본 화면 형태를 따라간다.
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : budget.isError ? (
          <EmptyStateCard
            title={loadErrorCopy.title}
            actionLabel={loadErrorCopy.actionLabel}
            onPress={() => budget.refetch()}
          />
        ) : (
          <>
            <Card style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                현재 예산
              </Text>
              <Text style={{ color: theme.colors.brown, fontSize: 24, fontWeight: "800" }}>
                {budget.data === null
                  ? "아직 예산이 없어요"
                  : budget.data?.amountKrw !== undefined
                    ? formatKrw(budget.data.amountKrw)
                    : "-"}
              </Text>
              {/* 사용액을 모르면(홈 캐시 없음) 이 줄은 아예 없다 -- 0원으로 떨어뜨리지 않는다. */}
              {usageLine ? (
                <Text testID="budget-usage-line" style={budgetContextLineStyle}>
                  {usageLine}
                </Text>
              ) : null}
            </Card>

            <Card style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                새 예산
              </Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <TextInput
                  accessibilityLabel="새 예산 입력"
                  keyboardType="number-pad"
                  onChangeText={(value) => setAmountDigits(amountDigitsOnly(value))}
                  placeholder="새 예산을 입력해 주세요"
                  style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize, paddingVertical: 6 }}
                  value={formatAmountDigits(amountDigits)}
                />
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>원</Text>
              </View>
              {/* 조정 칩: 값을 손으로 다 치지 않고 한 탭으로 후보를 만든다. 칩은 입력을 대체하지
                  않고 채워 넣기만 하므로 탭한 뒤에도 키패드로 자유롭게 고칠 수 있다. */}
              <View testID="budget-adjust-chips" style={budgetChipRowStyle}>
                {adjustChips.map((chip) => (
                  <Pressable
                    key={chip.id}
                    accessibilityRole="button"
                    accessibilityLabel={chip.accessibilityLabel}
                    hitSlop={4}
                    onPress={() => setAmountDigits(chip.nextDigits)}
                    style={budgetChipStyle}
                  >
                    {/* A11Y-117: 13px coral 텍스트는 coral[700]이어야 대비가 선다. */}
                    <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "800" }}>{chip.label}</Text>
                  </Pressable>
                ))}
              </View>
              {amountError ? (
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{amountError}</Text>
              ) : (
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                  비워두면 현재 예산이 그대로 유지돼요.
                </Text>
              )}
            </Card>

            {/* 라운드 102 §4.1 — "카테고리별 예산" 카드(선택 입력). 목록이 아직 없으면
                categoryForm이 null이라 카드 자체가 서지 않는다(모르면 제안하지 않는다).
                저장 버튼은 아래 기존 [저장] 하나 그대로다 — 이 카드는 값만 만든다.

                ⚠️ 두 시점 (라운드 102 리뷰 L-a11y): 종전 이 자리는 "카드 안 안내 줄(행 상한·
                30개 상한·합 관측)은 **전부** 캡션 회색"이었다. 그 한 벌은 성격이 다른 두 종류를
                한 색으로 접었다 — **합 관측**은 저장을 막지 않는 사실 서술이고(§1.3(a)), **행
                상한·30개 상한**은 `isValid`를 false로 만들어 [저장]을 잠그는 오류다. 잠긴 이유를
                회색 캡션 한 줄로만 말하면, 버튼이 왜 안 눌리는지 화면이 끝내 답하지 않는 것과
                같다(DNC-018의 그 경계). 그래서 갈래를 나눈다:
                  · 관측 줄(합) — 종전 그대로 캡션 회색, 라이브 리전 없음.
                  · 저장 잠금 오류(행 상한·30개 상한) — danger + `accessibilityLiveRegion`.
                포커스는 사용자가 치고 있는 입력칸에 남으므로 새 문장이 자동으로 낭독되지 않는다 —
                지출 날짜 오류(app/expenses/new.tsx)가 같은 이유로 같은 속성을 갖는다.
                ⚠️ 리뷰 문면은 "행 상한 오류"만 지목했지만, 30개 상한 줄도 같은 `isValid`를
                내리는 **같은 성격**이라 함께 옮겼다 — 갈래를 "저장을 잠그는가" 하나로 가르지
                않으면 새 계약 문장("관측 줄만 회색")이 자기 파일에서 거짓이 된다. */}
            {categoryForm ? (
              <Card style={{ gap: 10 }}>
                <Text
                  testID="budget-category-card"
                  style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}
                >
                  카테고리별 예산
                </Text>
                {/* 선택 입력임을 문장이 직접 말한다(§4.1 확정 캡션). */}
                <Text style={budgetContextLineStyle}>원하는 카테고리에만 정해도 돼요.</Text>
                {categoryCarryOverChip ? (
                  <View testID="budget-category-carry-over" style={budgetChipRowStyle}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={categoryCarryOverChip.accessibilityLabel}
                      hitSlop={4}
                      // §4.2: 채워 넣기만 한다 — 저장은 사람이 [저장]을 누를 때만 일어난다.
                      onPress={() => setCategoryEdits(categoryCarryOverChip.prefillDigits)}
                      style={budgetChipStyle}
                    >
                      <Text style={{ color: theme.colors.coral[700], fontSize: 13, fontWeight: "800" }}>
                        {categoryCarryOverChip.label}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {categoryForm.rows.map((row) => (
                  <View key={row.categoryId} style={{ gap: 2 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, minHeight: theme.touchTarget }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: theme.colors.brown, flexShrink: 1, fontSize: 13, fontWeight: "700" }}
                      >
                        {row.name}
                      </Text>
                      {/* 금액 입력은 총액 입력과 같은 money 모듈 한 벌이다(FMT-127). 값 비우기 =
                          그 카테고리 예산 해제(§2.2 — 빈 행이 곧 삭제라 행별 삭제 버튼이 없다). */}
                      <TextInput
                        accessibilityLabel={row.inputAccessibilityLabel}
                        keyboardType="number-pad"
                        onChangeText={(value) =>
                          setCategoryEdits((edits) => ({ ...edits, [row.categoryId]: amountDigitsOnly(value) }))
                        }
                        placeholder="예산 없음"
                        style={{
                          color: theme.colors.brown,
                          flex: 1,
                          fontSize: theme.typography.body1.fontSize,
                          paddingVertical: 6,
                          textAlign: "right"
                        }}
                        value={formatAmountDigits(categoryDraft[row.categoryId] ?? "")}
                      />
                      <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                        원
                      </Text>
                    </View>
                    {/* 행 상한 초과 오류 — 문구는 총액·지출 입력과 같은 단일 소스(모듈이 실었다).
                        저장을 잠그는 갈래라 danger + 라이브 리전이다(위 카드 머리 주석): 포커스가
                        방금 친 입력칸에 남아 있어 스크린리더가 스스로 읽지 않는다
                        (app/expenses/new.tsx의 날짜 오류와 같은 조합). */}
                    {row.errorText ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        accessibilityRole="alert"
                        style={budgetCategoryLockedErrorStyle}
                      >
                        {row.errorText}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {/* 상한 30 선제 오류 — 서버 코드 문구와 같은 api-error 표 경유(§9.3). 이 줄도
                    `isValid`를 내려 저장을 잠그므로 행 오류와 같은 갈래다(위 카드 머리 주석). */}
                {categoryForm.formError ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    testID="budget-category-form-error"
                    style={budgetCategoryLockedErrorStyle}
                  >
                    {categoryForm.formError}
                  </Text>
                ) : null}
                {/* §1.3(a): 합>총액은 관측 한 줄 — 저장은 막지 않는다. */}
                {categoryForm.sumNoticeText ? (
                  <Text testID="budget-category-sum-notice" style={budgetContextLineStyle}>
                    {categoryForm.sumNoticeText}
                  </Text>
                ) : null}
                <Text style={budgetContextLineStyle}>값을 비우면 그 카테고리 예산이 해제돼요.</Text>
              </Card>
            ) : null}

            {save.isError ? <Toast message={saveErrorText} tone="error" /> : null}
            {/* T10: 저장 성공 확인. Toast가 마운트되며 같은 문장을 낭독한다(A11Y-115). */}
            {savedMessage ? <Toast message={savedMessage} /> : null}

            {/* 잠금은 disabled에 넣지 않는다 — 눌렀을 때 사실을 말하는 것이 이 앱의 관례이고,
                비활성 버튼은 "왜 안 되는지"를 끝내 말하지 않는다(DNC-018). */}
            <PrimaryButton
              disabled={!canSave || save.isPending}
              label={save.isPending ? "저장하는 중" : "저장"}
              onPress={saveBudget}
            />
          </>
        )}
      </View>
    </AppScreen>
  );
}
