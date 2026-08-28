import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { getBudget, getHome, listChildren, listExpenses, LOCAL_SESSION_TOKEN, type Expense } from "../../src/api/client";
import {
  childSwitchTriggerAccessibilityLabel,
  CHILD_SWITCH_HEADER_ACCESSIBILITY_ACTIONS,
  CHILD_SWITCH_HEADER_TRIGGER_HINT,
  CHILD_SWITCH_SHEET_TITLE,
  CHILD_SWITCH_TRIGGER_HINT
} from "../../src/children/child-switch";
import { ChildSwitchSheet, useChildSwitchSheet } from "../../src/children/ChildSwitchSheet";
import { fetchMonthExpenses } from "../../src/expenses/month-expenses";
import { homeRecentExpenseSubtitle } from "../../src/expenses/records-list-view";
import { evaluateBabyCounter, evaluateBirthTransitionPrompt } from "../../src/home/baby-counter";
import { buildHomeBudgetNudge, evaluateHomeBudgetProgress } from "../../src/home/budget-progress";
import { evaluateBudgetWarning } from "../../src/home/budget-warning";
import {
  FIRST_RECORD_CELEBRATION_BODY,
  FIRST_RECORD_CELEBRATION_DISMISS_LABEL,
  FIRST_RECORD_CELEBRATION_MESSAGE,
  FIRST_RECORD_CELEBRATION_TEST_ID,
  FIRST_RECORD_CELEBRATION_TITLE,
  useFirstRecordCelebrationStore
} from "../../src/home/first-record-celebration";
import {
  countPendingOfflineCreates,
  countUnpreparedRecommendedItems,
  evaluateHomeFirstRunGuide,
  hasPendingOfflineCreate,
  holdHasAnyExpenseRecordDuringRefetch,
  homeGuideSpeaksForEmptyHome,
  homePendingSyncNoticeText,
  latchHasAnyExpenseRecord,
  shouldShowHomeRecentExpensesSection,
  FIRST_ITEMS_GUIDE_DISMISS_LABEL,
  HOME_PENDING_SYNC_NOTICE_TEST_ID
} from "../../src/home/first-run-guide";
import { useHomeFirstRunGuideStore } from "../../src/home/first-run-guide.store";
import {
  evaluateLastMonthComparison,
  previousYearMonth,
  type ComparableExpenseRecord
} from "../../src/home/last-month-comparison";
import { evaluateHomeCumulativeTotal } from "../../src/home/cumulative-total";
import { evaluateMilestoneCountdown } from "../../src/home/milestone-countdown";
import { evaluateWeeklySummary } from "../../src/home/weekly-summary";
import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";
import { useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import {
  OFFLINE_RECORDING_ENTRY_LABEL,
  OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE,
  useLoadErrorCopy
} from "../../src/offline/use-load-error-copy";
import type { LocalExpenseRow } from "../../src/offline/types";
import { formatKrw } from "../../src/money";
import { resolveWeeklySpendForNotification } from "../../src/notifications/generators";
import { NotificationBell } from "../../src/notifications/NotificationBell";
import { useHomeNotificationEvaluation } from "../../src/notifications/useHomeNotificationEvaluation";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  AppScreen,
  Card,
  EmptyStateCard,
  FloatingActionButton,
  HeroSummaryCard,
  ListRow,
  PrimaryButton,
  QuickActionIconButton,
  ScreenHeader,
  TextButton
} from "../../src/ui";
import { SkeletonCard, SkeletonRow } from "../../src/ui/Skeleton";
import { resolveScreenPhase } from "../../src/screen-phase";
import { theme } from "../../src/theme";
import { HomePixelStyles } from "../../src/pixelLock/styles/HomePixelStyles";

/**
 * 라운드 33 F6: 주간 카드에 넘길 한 달치 지출 행을 **기록 탭과 같은 방식으로** 재조정한다.
 *
 * 서버 목록(listExpenses)만 그대로 더하면 오프라인에서 기록해 아직 올라가지 않은 행이 "이번 주
 * 합계"와 "이번 주 N일 기록했어요"에서 통째로 빠진다 — 방금 기록한 사용자에게 홈이 "이번 주 첫
 * 기록을 남겨보세요"라고 말하는 상황이다. 반대로 서버 행을 로컬에서 수정/삭제 대기시켜 두면
 * 낡은 값이 그대로 더해진다. `reconcileMonthlyExpenses`가 기록 탭에서 이미 그 둘을 한 벌로
 * 처리하므로(중복 제거 + 대기 행 포함) 여기서도 **같은 함수**를 쓴다.
 *
 * 합계(monthlyTotalKrw)가 아니라 **행 목록**을 돌려주는 이유는 주간 요약이 "이번 주 월요일부터
 * 오늘까지"를 스스로 잘라야 하기 때문이다(records.tsx의 지난달 비교와 같은 이유).
 *
 * 범위 주석: REP-121 "지난달 같은 시점 대비" 한 줄은 종전 데이터 경로(서버 목록 원본)를 그대로
 * 둔다 — 이번 라운드의 지적은 신규 주간 카드에 한정되고, 그 줄의 이번 달 항은 /home 서버 집계라
 * 재조정된 지난달 항과 짝을 맞추려면 별도 판단이 필요하다(별건으로 남긴다).
 */
function reconciledMonthRecords(
  serverExpenses: Expense[] | undefined,
  childOfflineRows: LocalExpenseRow[],
  yearMonth: string
): ComparableExpenseRecord[] | null {
  if (!serverExpenses) return null;
  const reconciled = reconcileMonthlyExpenses(serverExpenses, childOfflineRows, yearMonth);
  return [
    ...reconciled.visibleServerExpenses,
    ...reconciled.offlinePendingRows.map((row) => ({
      amountKrw: row.payload.amountKrw,
      spentOn: row.payload.spentOn,
      expenseType: row.payload.expenseType
    }))
  ];
}

function homePixelScaleFrameStyle() {
  return {
    transform: [
      { translateX: HomePixelStyles.scaleHorizontalOffset },
      { translateY: HomePixelStyles.scaleVerticalOffset },
      { scale: HomePixelStyles.scale },
      { scaleX: HomePixelStyles.scaleX }
    ]
  } as const;
}

function homePixelFrameStyle() {
  return {
    gap: theme.spacing.section,
    transform: [{ translateX: HomePixelStyles.horizontalOffset }, { translateY: HomePixelStyles.topOffset }]
  };
}

/**
 * D1 후속(실기기 피드백 2): 퀵액션 4칸의 아이콘. 탭바(app/(tabs)/_layout.tsx)와 같은 Ionicons
 * outlined 계열·같은 색 규칙을 쓰되, 퀵액션은 흰 원형 배지 위라 본문색(brown)을 쓴다 --
 * 예전 QuickActionIconButton이 글리프에 주던 색·크기(brown / 18)를 그대로 옮긴 값이다.
 */
function QuickActionIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return <Ionicons name={name} size={20} color={theme.colors.brown} />;
}

const homeBudgetNudgeStyle = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  copy: {
    flex: 1,
    gap: 4
  },
  icon: {
    color: theme.colors.mainCoral,
    fontSize: 22,
    fontWeight: "800"
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.peach,
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  title: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "800"
  }
});

// HOME-BUDGET-113: warning banner shown from 80% budget usage. Tone colors come from the
// brand semantic tokens (theme.colors.warning / theme.colors.danger); the meaning itself is
// always carried by the banner text, never by color alone.
const homeBudgetWarningStyle = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderLeftWidth: 4,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  bannerApproaching: {
    borderLeftColor: theme.colors.warning
  },
  bannerExceeded: {
    borderLeftColor: theme.colors.danger
  },
  body: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  copy: {
    flex: 1,
    gap: 2
  },
  title: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "800"
  }
});

// REP-121: "지난달 같은 시점 대비" 한 줄. 의미는 전부 문장이 지고(색상 단독 전달 금지) 앞의
// 글리프는 장식이라 accessible={false}로 TalkBack에서 감춘다. 텍스트는 본문 색(brown)이라
// 크림 배경에서 대비가 충분하다(coral 계열 소형 텍스트 금지 규칙, A11Y-117).
const homeLastMonthInsightStyle = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  glyph: {
    color: theme.colors.gray600,
    fontSize: 14,
    fontWeight: "800"
  },
  text: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
});

const homeBudgetNudgeArrowStyle = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.10)",
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  glyph: {
    color: theme.colors.brown,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24
  }
});

// UX-A 아기 카운터 헤더: 홈 최상단의 인사말을 "아이 자신"으로 바꾼다. 기존 ScreenHeader와 같은
// 골격(왼쪽 카피 + 오른쪽 알림 벨)이지만 제목이 카운터 문장이라 한 줄이 길어질 수 있어 자체
// 스타일을 쓴다. 단계 라벨("24개월")은 아이브로우로 살아남는다 -- 기존 헤더가 주던 정보를
// 잃지 않기 위해서다. 아이브로우 색은 A11Y-117 규칙대로 coral[700](소형 coral 텍스트).
const homeBabyCounterStyle = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 4
  },
  eyebrow: {
    color: theme.colors.coral[700],
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  header: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 13,
    lineHeight: 20
  },
  title: {
    color: theme.colors.brown,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30
  }
});

/**
 * HOME-138(라운드 38 UX-M) 아이 전환 1탭.
 *
 * 다자녀 사용자가 아이를 바꾸려면 설정 → 아이 관리(탭 4번)까지 들어가야 했다. 홈 헤더의 아이
 * 이름 자리를 **아이가 2명 이상일 때만** 눌러서 전환 시트를 여는 버튼으로 만든다.
 *
 * 1명이면 아무것도 바뀌지 않는다(Pressable로 감싸지도 않는다) -- HOME-001 픽셀락 캡처는
 * 비세션·아이 1명 미리보기라 헤더가 종전 그대로 남아야 한다. 헤더의 위치·크기·문구는 두 경우
 * 모두 동일하고, 달라지는 것은 "누를 수 있는가"뿐이다.
 *
 * 아래 스타일은 공용 ScreenHeader와 **같은 토큰**을 쓴다. 카운터가 없는 헤더(수동 단계 등)에서
 * 제목만 Pressable로 감싸야 하는데 ScreenHeader는 title을 문자열로만 받기 때문에, 전환이
 * 가능한 경우에만 같은 골격을 이 화면에서 직접 그린다(불가능한 경우는 종전대로 ScreenHeader).
 *
 * 라운드 49 C-09: 시트 **행**의 스타일(row/rowName)은 여기 없다 — 기록·리포트 탭이 같은 시트를
 * 쓰게 되면서 공용 모듈로 옮겼다(src/children/ChildSwitchSheet.tsx의 childSwitchSheetStyle).
 * 아래 남은 것은 홈 **헤더**만의 골격이다.
 */
const homeChildSwitchStyle = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 4
  },
  header: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight
  },
  title: {
    color: theme.colors.brown,
    fontSize: theme.typography.headline2.fontSize,
    fontWeight: theme.typography.headline2.fontWeight,
    lineHeight: theme.typography.headline2.lineHeight
  }
});

// UX-A 이번 주 요약 · 기록 스트릭: 한 달보다 짧은 호흡의 숫자 + 습관 한 줄. 의미는 전부 문장이
// 지고(색상 단독 전달 금지) 앞의 글리프는 장식이라 accessible={false}로 감춘다.
const homeWeeklySummaryStyle = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  glyph: {
    color: theme.colors.gray600,
    fontSize: 14,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  streak: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 24
  },
  text: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
});

/**
 * 라운드 48 B2 누적 총액 카드.
 *
 * 주간 요약 줄과 **같은 골격**(흰 카드 · 글리프 + 본문)을 쓴다. 마일스톤 카드처럼 화살표와
 * CTA를 달지 않는 이유는 이 카드가 데려갈 곳을 약속하지 않기 때문이다 — 누적 총액을 그대로
 * 펼쳐 보여 주는 화면이 따로 없는데 화살표만 붙이면, 문구가 약속하지 않은 이동을 시사하게
 * 된다(라운드 41 UX-T(B)가 넛지에서 고친 "문구와 목적지의 어긋남"과 같은 종류의 문제다).
 */
const homeCumulativeTotalStyle = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  glyph: {
    color: theme.colors.coral[700],
    fontSize: 14,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 24
  },
  title: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20
  }
});

// UX-A 100일 · 첫돌 카운트다운: 눌러서 리포트 탭으로 가는 카드라 넛지 카드와 같은 골격
// (아이콘 박스 + 카피 + › 화살표)을 따른다.
const homeMilestoneStyle = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  copy: {
    flex: 1,
    gap: 4
  },
  cta: {
    color: theme.colors.coral[700],
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16
  },
  icon: {
    color: theme.colors.coral[700],
    fontSize: 20,
    fontWeight: "800"
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: theme.colors.peach,
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  title: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "800"
  }
});

// UX-G 첫 실행 안내 카드(첫 지출 유도 / 준비템 첫 안내). 빈 홈에서 이 카드가 "다음 한 걸음"
// 이므로 다른 카드보다 눈에 띄어야 한다 -- peach 배경 + 큰 CTA 버튼. 의미는 전부 문장이 지고
// (색상 단독 전달 금지) 제목·부제는 brown 본문색이라 peach 위에서 대비가 충분하다(A11Y-117).
const homeFirstRunGuideStyle = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.peach,
    borderRadius: 18,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  copy: {
    gap: 4
  },
  subtitle: {
    color: theme.colors.gray600,
    fontSize: 13,
    lineHeight: 20
  },
  title: {
    color: theme.colors.brown,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 24
  }
});

// UX-G 첫 기록 축하 배너. 히어로 카드 바로 아래에서 "총액이 여기 쌓인다"를 가리킨다.
// 예산 경고 배너(HOME-BUDGET-113)와 같은 골격이되 색만 success 계열이고, 뜻은 언제나 문장이
// 진다. ✓ 글리프는 장식이라 accessible={false}로 TalkBack에서 감춘다.
const homeFirstRecordCelebrationStyle = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderLeftColor: theme.colors.success,
    borderLeftWidth: 4,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  body: {
    color: theme.colors.gray600,
    fontSize: 12,
    lineHeight: 18
  },
  copy: {
    flex: 1,
    gap: 2
  },
  dismiss: {
    color: theme.colors.gray600,
    fontSize: 12,
    fontWeight: "700"
  },
  icon: {
    color: theme.colors.success,
    fontSize: 16,
    fontWeight: "800"
  },
  title: {
    color: theme.colors.brown,
    fontSize: 14,
    fontWeight: "800"
  }
});

// 라운드 35 F1: 홈 "최근 지출" 자리의 동기화 대기 한 줄. 기록 탭처럼 대기 행 목록을 그리지
// 않고(홈의 역할은 요약이다) 상태 한 줄만 둔다 -- 같은 자리에 CTA를 하나 더 세우지 않기 위해
// 버튼도 링크도 붙이지 않는다(F2와 같은 이유). 앞 글리프는 장식이라 접근성 트리에서 감춘다.
const homePendingSyncNoticeStyle = StyleSheet.create({
  glyph: {
    color: theme.colors.gray600,
    fontSize: 14,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  text: {
    color: theme.colors.gray600,
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
});

const previewHome = {
  child: { id: "preview-child-daon", nickname: "다온이", currentStage: "toddler", stageLabel: "24개월" },
  monthly: {
    childId: "preview-child-daon",
    yearMonth: "2025-05",
    amountKrw: 1_600_000,
    usedAmountKrw: 1_245_700,
    remainingAmountKrw: 354_300
  },
  recommendedItems: [
    { id: "preview-diaper-party-pack", name: "네이처러브 기저귀 팬티형", status: "not_prepared" },
    { id: "preview-baby-carrier", name: "베이비 아기띠 힙시트", status: "interested" }
  ],
  recentExpenses: [
    {
      id: "preview-expense-diaper",
      childId: "preview-child-daon",
      categoryId: "preview-category-diaper",
      amountKrw: 45_900,
      spentOn: "오늘",
      itemName: "기저귀",
      expenseType: "expense",
      source: "manual"
    },
    {
      id: "preview-expense-formula",
      childId: "preview-child-daon",
      categoryId: "preview-category-formula",
      amountKrw: 32_400,
      spentOn: "05.20",
      itemName: "분유/유제품",
      expenseType: "expense",
      source: "manual"
    },
    {
      id: "preview-expense-cleanser",
      childId: "preview-child-daon",
      categoryId: "preview-category-cleanser",
      amountKrw: 18_900,
      spentOn: "05.19",
      itemName: "유아용 세제",
      expenseType: "expense",
      source: "manual"
    }
  ]
} as const;

export default function HomeScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const home = useQuery({
    queryKey: ["home", childId],
    enabled: Boolean(authToken && childId),
    queryFn: () => getHome(authToken!, childId!)
  });
  const hasSession = Boolean(authToken && childId);
  // REP-121: 홈 한 줄 인사이트는 "지난달 같은 일자까지"의 부분 합계를 필요로 한다. /home 응답에는
  // 지난달 값이 없고, 월간 리포트 API(reports/monthly)는 yearMonth 단위 **월 전체** 합계만 주므로
  // (endDate 파라미터 없음 -- apps/api/src/onboarding/reporting-store.service.ts) 그 값으로 비교하면
  // 월초마다 "적게 썼어요"가 뜨는 허위 비교가 된다. 그래서 지난달 지출 행을 한 번 조회해 클라이언트
  // 에서 같은 일자까지 잘라 더한다(src/home/last-month-comparison.ts). 캐시 키는 기록 탭과 같은
  // ["expenses", childId, yearMonth]라 두 화면이 응답을 공유하고, 지출 생성/수정/가져오기 경로가
  // 이미 invalidate하는 ["expenses"] 프리픽스에 그대로 걸려 최신 상태가 유지된다.
  const seoulToday = getSeoulToday();
  const lastYearMonth = previousYearMonth(seoulToday);
  // UX-A 주간 요약: 이번 달 지출 행. 기록 탭이 이번 달을 볼 때와 **같은 캐시 키**라
  // (["expenses", childId, 이번 달]) 대개 이미 채워진 캐시를 그대로 읽고, 지출 생성/수정/
  // 가져오기가 invalidate하는 ["expenses"] 프리픽스에 그대로 걸린다. 지난달 캐시(아래)와 함께
  // 넘겨야 달을 걸친 주("9월 1일 화요일"의 이번 주 월요일 = 8월 31일)도 정확히 더해진다 --
  // 근거는 src/home/weekly-summary.ts.
  const thisYearMonth = seoulToday.slice(0, 7);
  const thisMonthExpenses = useQuery({
    queryKey: ["expenses", childId, thisYearMonth],
    enabled: Boolean(authToken && childId),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, thisYearMonth, page))
  });
  //
  // REC-124(H1): API-124 이후 한 요청은 한 페이지(기본 200 · 상한 500건)이고 정렬이 spentOn desc라,
  // 첫 페이지만 읽으면 200건을 넘는 달의 **앞날짜가 통째로 빠진다**. 그러면 "같은 일자까지"의 부분
  // 합계가 0이 되어 이 한 줄이 "지난달 같은 시점까지는 지출 기록이 없었어요"라는 없는 사실을
  // 말한다. fetchMonthExpenses가 CSV 내보내기와 같은 커서 루프로 전량을 모은다
  // (src/expenses/month-expenses.ts). 기록 탭도 같은 페처를 쓰므로 공유 캐시의 내용이 어긋나지 않는다.
  //
  // UX-W(C8) — 이 쿼리는 **첫 페인트 이후로 미룬다**(`thisMonthExpenses.isFetched`). 콜드 스타트에
  // 홈은 두 달치를 동시에 커서 루프로 전량 조회했는데, 그 두 번째 달을 지금 당장 필요로 하는 화면은
  // 홈뿐이고(지난달 캐시의 소비자는 홈과 기록 탭이며 기록 탭은 자기 화면에서 따로 켠다) 홈에서도
  // 쓰임새가 아래 두 곳뿐이다:
  //   1) 지난달 대비 한 줄 인사이트 — 지난달 행이 없으면 순수 모듈이 null을 내서 줄 자체가 안 뜬다
  //      (src/home/last-month-comparison.ts의 `if (!records) return null`).
  //   2) 주간 카드 — 이번 주가 달을 걸치는 주(예: 9월 1일 화요일)에만 지난달이 필요하고, 안 덮이면
  //      카드를 통째로 접는다(weekly-summary.ts의 `covers(weekStartIso, todayIso)`). 지난주 비교
  //      구간만 지난달로 넘어가는 주는 비교 **문장만** 빠진다.
  // 두 소비자 모두 "완전한 데이터일 때만 렌더"라, 미루는 동안 부분 합계나 틀린 숫자가 보이는 경로가
  // 없다 -- 늦게 나타날 뿐이다(달을 걸친 주에만 카드 등장이 수백 ms 늦는다).
  // 이미 채워진 공유 캐시가 있으면(기록 탭에서 넘어온 경우) enabled:false여도 그 값을 그대로 읽으므로
  // 미루는 비용이 0이다.
  //
  // 라운드 37 G-1 상호작용: `isError`는 비활성 쿼리에서 false이므로, 미루는 동안 아래
  // `expensesFailed`는 **참이 될 수 없다**. 즉 defer는 주간 알림을 "판정 불가(undefined)" 상태로
  // 조금 더 오래 둘 뿐, 월 페이스 폴백을 오발화시켜 그 주의 dedupeKey를 태우지 않는다. 이번 달
  // 쿼리가 확정 실패해도 `isFetched`는 true가 되므로(에러도 fetch 완료다) 지난달 쿼리가 영영
  // 잠기지 않는다 -- 종전처럼 두 쿼리가 모두 실패하면 그때 폴백이 열린다.
  const lastMonthExpenses = useQuery({
    queryKey: ["expenses", childId, lastYearMonth],
    enabled: Boolean(authToken && childId && lastYearMonth && thisMonthExpenses.isFetched),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))
  });
  // 라운드 48 B1(c) — 매달 1일에 예산이 사라진 홈이 **이유를 말하게** 한다.
  //
  // 월 예산은 (childId, yearMonth) 유니크이고 이월 규칙이 없다. 9월 1일 아침의 홈은 진행바도
  // 경고도 없이 "월 예산 설정하기"만 남는데, 어제까지 있던 숫자가 왜 사라졌는지는 어디에도
  // 적혀 있지 않았다. 지난달 값을 알면 넛지 부제가 그 사실을 한 줄로 덧붙인다(문구는 순수
  // 모듈 src/home/budget-progress.ts). 앱이 예산을 대신 만들어 주는 것은 아니다 — 사용자가
  // 정한 적 없는 값을 지어내지 않고, 지난달이 얼마였는지만 말한 뒤 /budget으로 보낸다.
  //
  // 콜드 스타트 defer 관례(UX-W(C8))를 그대로 따른다: /home 응답이 도착해 **이번 달 예산이
  // 실제로 없다고 확인된 뒤에만** 켠다. 예산이 있는 달(대다수 사용자)에는 이 왕복이 아예
  // 생기지 않고, 첫 페인트도 이 요청을 기다리지 않는다. 실패하거나 지난달에도 예산이 없으면
  // data가 null/undefined라 넛지 문구는 종전과 한 글자도 다르지 않다.
  const homeHasNoBudgetThisMonth = Boolean(home.data) && !(home.data!.monthly.amountKrw > 0);
  const lastMonthBudget = useQuery({
    queryKey: ["budget", childId, lastYearMonth],
    enabled: Boolean(authToken && childId && lastYearMonth) && homeHasNoBudgetThisMonth,
    queryFn: () => getBudget(authToken!, childId!, lastYearMonth!)
  });
  // UX-A 아기 카운터·마일스톤 카드가 쓰는 dueDate/birthDate/stageMode는 /home 응답에 없다
  // (HomeSummary.child는 nickname/currentStage/stageLabel만 준다). 새 엔드포인트를 만들지 않고
  // 아이 관리·설정·리포트 화면과 **같은 캐시 키**(["children"])를 재사용해 읽는다.
  // 라운드 33 F6: 주간 카드가 읽는 두 달치 지출을 이 기기의 오프라인 대기 행과 재조정한다
  // (기록 탭과 같은 reconcileMonthlyExpenses — 위 reconciledMonthRecords 주석 참고).
  const offlineSyncSnapshot = useOfflineSyncSnapshot();
  const childOfflineRows = useMemo(
    () => (childId ? offlineSyncSnapshot.rows.filter((row) => row.childId === childId) : []),
    [offlineSyncSnapshot.rows, childId]
  );
  const weeklyThisMonthRecords = useMemo(
    () => reconciledMonthRecords(thisMonthExpenses.data?.expenses, childOfflineRows, thisYearMonth),
    [thisMonthExpenses.data, childOfflineRows, thisYearMonth]
  );
  const weeklyLastMonthRecords = useMemo(
    () =>
      lastYearMonth ? reconciledMonthRecords(lastMonthExpenses.data?.expenses, childOfflineRows, lastYearMonth) : null,
    [lastMonthExpenses.data, childOfflineRows, lastYearMonth]
  );
  // UX-R(M): 보기 전용(viewer·gift_participant)으로 참여한 사람에게는 서버가 지출 쓰기를 막는다.
  // 홈은 그 입구를 세 개(퀵액션·빈 상태·FAB) 들고 있는 화면이라, 잠금 판정 하나를 여기서 받아
  // 전부 같은 안내로 답한다. 비세션 미리보기·역할 미상에서는 항상 열려 있다(픽셀락 HOME-001은
  // 세션을 지운 렌더라 판정이 발동하지 않는다) -- src/family/record-permissions.ts.
  //
  // 라운드 41 K-5/K-8: 이 판정이 주간 카드 문구와 출생 전환 프롬프트에도 쓰이므로 선언이 그
  // 두 계산보다 **위**에 있어야 한다(훅 호출 순서는 렌더마다 같아야 하니 자리는 여기로 고정).
  const expenseGate = useExpenseEntryGate();
  // UX-J: 주간 계산을 조기 반환(에러/로딩)보다 위로 올린다 -- 아래 알림 평가 훅과 화면의 주간
  // 카드가 **같은 한 값**을 쓰게 하기 위해서다(훅은 조건부로 호출할 수 없으므로 자리는 여기).
  // 비세션 미리보기는 종전처럼 계산하지 않는다.
  const weeklySpend = useMemo(
    () =>
      hasSession
        ? evaluateWeeklySummary({
            todayIso: seoulToday,
            // F6: 서버 목록 원본이 아니라 오프라인 대기·수정 행까지 반영한 재조정 결과다.
            thisMonthRecords: weeklyThisMonthRecords,
            lastMonthRecords: weeklyLastMonthRecords,
            // 라운드 41 K-5: 가족이 기록한 보기 전용 홈에서도 카드는 그대로 뜬다(합계·비교는
            // 이 사람에게도 참이다). 다만 기록 0일일 때의 스트릭 줄만 권유 → 중립 서술로
            // 바뀐다 -- 판정과 문구는 전부 순수 모듈에 있다(src/home/weekly-summary.ts).
            expenseEntryLocked: expenseGate.locked
          })
        : null,
    [hasSession, seoulToday, weeklyThisMonthRecords, weeklyLastMonthRecords, expenseGate.locked]
  );
  // 라운드 37 G-1: 알림 평가에 넘길 주간 값은 "없음"을 **두 가지로** 나눠서 말해야 한다. 콜드
  // 스타트에서는 /home 응답이 지출 캐시보다 먼저 오는 것이 정상이라, 그 첫 평가에 weekly=null을
  // 넘기면 주간 알림이 월 페이스 폴백으로 발화하고 그 주의 dedupeKey가 소진된다 -- 곧이어 지출
  // 캐시가 도착해도 dedupe에 막혀, 홈 카드와 알림함이 그 주 내내 다른 숫자를 말한다.
  // 그래서 지출 쿼리가 아직 결과를 내지 않았으면 undefined(판정 불가)를 넘겨 주간 후보 자체를
  // 미루고, 월 페이스 폴백은 지출 쿼리가 **확정 실패**했을 때만 허용한다(규칙은 순수 모듈에).
  // 지난달 쿼리까지 보는 이유: 달을 걸친 주(예: 9월 1일 화요일)는 지난달 캐시가 있어야 이번 주
  // 합계를 낼 수 있어서, 그쪽이 로딩 중이면 주간 값은 여전히 "아직 모른다"이다.
  const weeklySpendForNotification = useMemo(
    () =>
      resolveWeeklySpendForNotification({
        weekly: weeklySpend,
        expensesFailed: thisMonthExpenses.isError || lastMonthExpenses.isError
      }),
    [weeklySpend, thisMonthExpenses.isError, lastMonthExpenses.isError]
  );
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const selectedChild = childrenQuery.data?.children.find((child) => child.id === childId) ?? null;
  // UX-G 첫 10분: "이 아이에게 지출 기록이 하나라도 있는가" -- 첫 실행 안내 카드와 첫 기록
  // 축하 배너가 **같은 한 값**을 본다(두 판정이 어긋나면 축하와 유도가 동시에 뜬다).
  //  - 서버 항: /home의 recentExpenses는 선물 포함 · spentOn desc LIMIT 3이므로
  //    (apps/api/src/onboarding/reporting-store.service.ts), 비어 있다 = 서버에 기록이 없다.
  //  - 오프라인 항: 아직 올라가지 않은 로컬 신규 행을 더한다. 빠뜨리면 방금 오프라인으로 첫
  //    기록을 남긴 사용자에게 홈이 "첫 지출을 기록해 보세요"라고 말한다(주간 카드가 같은
  //    이유로 대기 행을 합산한다 -- 라운드 33 F6).
  // 홈 응답이 아직 없으면 null = "모른다"이고, 그때는 어떤 카드도 만들지 않는다.
  const observedHasAnyExpenseRecord =
    hasSession && home.data
      ? home.data.recentExpenses.length > 0 || hasPendingOfflineCreate(childOfflineRows)
      : null;
  // 축하 배너는 persist하지 않는 세션 스토어가 0 -> 1 전이에서만 켠다
  // (src/home/first-record-celebration.ts). 지출 저장 화면이 ["home"]을 invalidate하므로
  // 홈으로 돌아오는 순간 그 전이가 실제로 관찰된다.
  const observeFirstRecord = useFirstRecordCelebrationStore((state) => state.observe);
  const celebrationChildId = useFirstRecordCelebrationStore((state) => state.activeChildId);
  const dismissFirstRecordCelebration = useFirstRecordCelebrationStore((state) => state.dismiss);
  // 라운드 35 F3 → 36 F2: 세션 이력 래치는 이제 **축하 배너 재발화 방지 전용**이다. 이 값을
  // 화면 표시(안내 카드 · 최근 지출 섹션)까지 쓰면 래치가 거짓으로 돌아가지 않는 성질 때문에
  // "기록 1건 → 그 한 건 삭제" 뒤에 홈이 앱 재시작 전까지 기록이 있다고 믿고, 섹션은 접힌 채
  // 유도 카드도 뜨지 않아 지출로 가는 큰 입구가 사라진다(F2). 래치가 여기 남는 이유는 하나뿐:
  // 배너는 false -> true 전이로 켜지므로, 관찰값을 그대로 흘리면 "전부 삭제 후 다시 기록"이
  // 새 전이로 읽혀 축하가 두 번 뜬다.
  const everHadExpenseRecord = useFirstRecordCelebrationStore((state) =>
    childId ? Boolean(state.everHadRecordChildIds[childId]) : false
  );
  const latchedHasAnyExpenseRecord = latchHasAnyExpenseRecord(observedHasAnyExpenseRecord, everHadExpenseRecord);
  useEffect(() => {
    if (!childId || latchedHasAnyExpenseRecord === null) return;
    observeFirstRecord(childId, latchedHasAnyExpenseRecord);
  }, [childId, latchedHasAnyExpenseRecord, observeFirstRecord]);
  // F2: 화면이 쓰는 값은 관찰값 + **refetch 창 한정** 프레임 가드다. 라운드 35 F3가 막으려던
  // 깜빡임(동기화 확정 프레임에 대기 행이 먼저 사라지고 서버 반영이 늦는 한 프레임)은 정확히
  // ["home"]이 다시 도는 동안에만 생기므로, 그 구간에서만 직전 확정값을 붙든다. refetch가
  // 끝나면 손을 떼므로 "마지막 기록 삭제"는 그 refetch가 끝나는 순간 정확히 반영된다.
  // 직전 확정값은 아이별로 기억한다 -- 아이를 바꾸면 다른 아이의 사실을 붙들면 안 된다.
  const settledHasAnyExpenseRecord = useRef<{ childId: string | null; value: boolean | null }>({
    childId: null,
    value: null
  });
  const lastSettled =
    settledHasAnyExpenseRecord.current.childId === (childId ?? null)
      ? settledHasAnyExpenseRecord.current.value
      : null;
  const hasAnyExpenseRecord = holdHasAnyExpenseRecordDuringRefetch({
    observed: observedHasAnyExpenseRecord,
    isFetching: home.isFetching,
    lastSettled
  });
  useEffect(() => {
    if (home.isFetching || observedHasAnyExpenseRecord === null) return;
    settledHasAnyExpenseRecord.current = { childId: childId ?? null, value: observedHasAnyExpenseRecord };
  }, [childId, home.isFetching, observedHasAnyExpenseRecord]);
  // 준비템 첫 안내는 1회성이라 "닫았다"가 기기에 남는다(persist). 스토어의
  // isItemsGuideDismissed()가 아니라 목록 자체를 구독한다 -- 렌더 중에 함수를 호출하면 그 값이
  // 바뀌어도 리렌더가 걸리지 않아 닫기 버튼이 즉시 반응하지 않는다.
  const dismissedItemsGuideChildIds = useHomeFirstRunGuideStore((state) => state.dismissedItemsGuideChildIds);
  const dismissItemsGuide = useHomeFirstRunGuideStore((state) => state.dismissItemsGuide);
  // NOTI-102: evaluate client-side notifications (budget/stage/purchase) once the home query has
  // resolved -- session-gated by passing undefined otherwise, so preview/logged-out stays inert.
  // UX-J: 주간 요약 알림이 홈 주간 카드와 같은 숫자를 말하도록 이미 계산된 값을 함께 넘긴다
  // (새 요청 없음). 라운드 37 G-1: 아직 판정할 수 없으면(지출 캐시 로딩 중) 주간 알림을 미루고,
  // 확정 실패했을 때만 월 페이스 문구로 폴백한다 -- 위 weeklySpendForNotification 참고.
  useHomeNotificationEvaluation(hasSession ? home.data : undefined, weeklySpendForNotification);
  // MOB-117 당겨서 새로고침: 홈 요약·최근 지출은 모두 ["home"] 쿼리에서 나온다. invalidate는
  // 활성 쿼리 refetch 완료까지 resolve되므로 스피너가 실제 완료에 맞춰 닫힌다.
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => queryClient.invalidateQueries({ queryKey: ["home"] }));
  // HOME-138: 아이 전환은 아이 관리 화면과 **같은 경로**(applyChildSwitch)로만 일어난다.
  // 여기서 스토어 쓰기·캐시 무효화를 손으로 다시 적으면 한쪽이 무효화를 빠뜨렸을 때 아이 A의
  // 홈/기록/리포트 캐시가 아이 B 화면에 그대로 남는다(라운드 28의 A→B 캐시 오염).
  //
  // 라운드 49 C-09: 그 배선(열림 상태 + 탭 처리 + 시트 JSX)이 이제 기록·리포트 탭과 **한 벌**이다
  // (src/children/ChildSwitchSheet.tsx). 홈의 동작·문구·픽셀은 그대로고, 달라진 것은 같은 코드를
  // 세 화면이 나눠 쓴다는 사실뿐이다. 목록은 여전히 이미 읽고 있는 ["children"] 캐시다(새 요청 0).
  const switchableChildren = childrenQuery.data?.children ?? [];
  const childSwitch = useChildSwitchSheet({ hasSession, childId, children: switchableChildren });
  const canSwitchChild = childSwitch.canSwitch;
  // 라운드 38 H-9: 전환 시트와 그 입구는 **정상 홈과 에러 홈이 함께 쓴다**. 아래 에러 조기
  // 반환이 헤더보다 위에 있어서, 아이 B로 전환한 직후 네트워크가 끊기면 화면에 남는 것이 실패
  // 카드뿐이었다 -- 아이 A로 되돌아갈 입구가 홈에서 사라져 설정 → 아이 관리로 우회해야 했다
  // (전환 자체는 이미 성공했으므로 [다시 시도]는 계속 B를 다시 받으려 한다). 시트 JSX를 한 번만
  // 만들어 두 상태에서 같은 것을 그린다 -- 두 벌로 적으면 한쪽만 고쳐지는 종류의 버그가 된다.
  const childSwitchHeaderText = selectedChild?.nickname ?? CHILD_SWITCH_SHEET_TITLE;
  const childSwitchSheet =
    canSwitchChild && childSwitch.isOpen ? (
      // 목록은 ["children"] 캐시(설정 · 리포트와 같은 키)를 그대로 읽는다 -- 새 요청 0.
      <ChildSwitchSheet
        testID="home-child-switch-sheet"
        options={childSwitch.options}
        currentChildId={childId}
        onSelect={childSwitch.switchTo}
        onClose={childSwitch.close}
      />
    ) : null;

  // 세션 없는 미리보기에는 새로고침할 서버 데이터가 없으므로 RefreshControl을 붙이지 않는다.
  const refreshControl = hasSession ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.mainCoral}
      colors={[theme.colors.mainCoral]}
    />
  ) : undefined;

  // MOB-130: 에러 → 로딩 → 정상 순서는 resolveScreenPhase가 정한다(src/screen-phase.ts).
  const homePhase = resolveScreenPhase({ isPending: home.isPending, isError: home.isError, hasData: Boolean(home.data) });
  // UX-N: 오프라인이면 "잠시 후 다시" 대신 오프라인이라는 사실을 말한다. 카드 구조와 [다시 시도]
  // 버튼은 그대로 -- 문구만 바뀐다(src/offline/messages.ts).
  //
  // 홈에만 보조문("기록은 지금도 남길 수 있어요")을 덧붙인다: 이 앱에서 지출 기록은 SQLite
  // 우선 저장이라 조회가 실패한 순간에도 **실제로** 남길 수 있고(src/offline/sync-controller.ts),
  // 홈은 그 입구(빠른 기록·FAB)를 늘 들고 있는 화면이다. 지킬 수 있는 약속만 한다.
  const loadErrorCopy = useLoadErrorCopy(home.isError);

  if (hasSession && homePhase === "error") {
    return (
      <AppScreen>
        {/* 라운드 38 H-9: 실패 카드 **위에** 전환 입구를 남긴다. 아이 이름은 이미 받아 둔
            ["children"] 캐시에서 오므로(실패한 것은 ["home"]이다) 새 요청도, 확인한 적 없는
            사실도 없다. 카운터·부제는 홈 데이터가 있어야 만들 수 있어 여기서는 그리지 않는다. */}
        {canSwitchChild ? (
          <View style={homeChildSwitchStyle.header}>
            <View style={homeChildSwitchStyle.copy}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={childSwitchTriggerAccessibilityLabel(childSwitchHeaderText)}
                accessibilityHint={CHILD_SWITCH_TRIGGER_HINT}
                hitSlop={8}
                onPress={childSwitch.toggle}
                testID="home-child-switch-trigger"
              >
                <Text style={homeChildSwitchStyle.title}>{childSwitchHeaderText}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {childSwitchSheet}
        <EmptyStateCard
          title={loadErrorCopy.title}
          actionLabel={loadErrorCopy.actionLabel}
          onPress={() => home.refetch()}
        />
        {/* 실패 카드가 화면 전체를 대체하므로 FAB도 빠른 기록 버튼도 함께 사라진다. 보조문이
            약속하는 행동을 그 자리에서 할 수 있도록 입구를 같이 내준다.

            UX-R(M): 보기 전용 참여자에게는 이 한 쌍을 통째로 접는다. 여기서 버튼만 잠그면
            바로 위 "기록은 지금도 남길 수 있어요"라는 **약속 문장이 남는다** -- 지킬 수 없는
            약속을 한 줄 남기느니 하지 않는 편이 정직하다(다른 진입점들은 문장 없이 서 있으므로
            눌렀을 때 안내하는 것으로 충분하다). */}
        {expenseGate.locked ? null : (
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, textAlign: "center" }}>
              {OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE}
            </Text>
            <TextButton label={OFFLINE_RECORDING_ENTRY_LABEL} onPress={() => router.push("/expenses/new")} />
          </View>
        )}
      </AppScreen>
    );
  }

  if (hasSession && homePhase === "loading") {
    // UX-5B-5 (D6): 가짜 버튼이 달린 EmptyStateCard 대신 스켈레톤 로딩.
    return (
      <AppScreen>
        <View style={{ gap: theme.spacing.section }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </AppScreen>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // 라운드 49 C-07 — 실세션에는 **절대** 미리보기 픽스처를 그리지 않는다.
  //
  // 종전 게이트는 `hasSession = authToken && childId`였고, 그 아래 한 줄이 `hasSession ? 서버
  // 데이터 : previewHome`이었다. 즉 **토큰은 있는데 childId가 null인 상태**가 전부 미리보기로
  // 떨어졌다 -- 실사용자가 자기 홈에서 "다온이"의 가짜 지출 3건(45,900원 기저귀 …)을 자기 기록
  // 으로 읽는다. 그 상태는 드물지 않다:
  //   1. 설정에서 마지막 아이를 지운 뒤 오프라인(다음 화면 전환이 서버를 못 부른다),
  //   2. onboarding-progress-scope가 childScopeRejected로 selectedChildId를 막 지운 직후,
  //   3. MOB-116 복구가 GET /children을 기다리는 최대 3초의 유예 창.
  // 셋 다 "아직 아이를 모른다"이지 "로그아웃 상태"가 아니다.
  //
  // 그래서 미리보기 폴백을 **비세션(!authToken)** 한 경우로 좁히고, 토큰이 있는 동안에는 모르는
  // 것을 모른다고 말한다. 비세션 분기는 한 글자도 바뀌지 않는다(HOME-001 픽셀락 캡처는
  // authToken === null 렌더다).
  if (authToken && !childId) {
    return (
      <AppScreen>
        <View testID="home-child-pending" style={{ gap: theme.spacing.section }}>
          <SkeletonCard />
          <SkeletonRow />
          {/* 스켈레톤만 두면 3초 유예가 지나도 화면이 말을 하지 않는다. 사실 한 줄과, 스스로
              풀 수 있는 길(아이 선택)을 함께 둔다 -- 죄책감 없는 해요체(DNC-018). */}
          <EmptyStateCard
            title="아이 정보를 불러오고 있어요"
            actionLabel="아이 선택하기"
            onPress={() => router.push("/settings/children")}
          />
        </View>
      </AppScreen>
    );
  }

  // 여기부터 authToken이 있으면 childId도 있고(위 분기), 그러면 hasSession이 참이라 위 로딩·에러
  // 분기를 지나 home.data가 있다. 남은 갈림길은 "세션인가 아닌가" 하나뿐이다.
  const visibleHome = authToken ? home.data! : previewHome;
  const monthlyUsed = visibleHome.monthly.usedAmountKrw;
  const budget = visibleHome.monthly.amountKrw;
  // HOME-127: 퍼센트 판정은 src/home/budget-progress.ts가 한다. 종전에는 여기서
  // `(monthlyUsed / Math.max(1, budget)) * 100`으로 냈는데, /home은 예산 미설정 달에
  // amountKrw: 0을 주므로 분모가 1이 되어 지출 한 건에 "예산 0원 · 100% 사용 중"이라는
  // 허위 표시가 됐다. 예산이 없으면 퍼센트 자체를 만들지 않는다(hasBudget: false).
  // UX-J: 세션이 있는 홈에서만 "남은 예산 N원 · 예산 M원"을 보여준다(예산이 있고 초과 전일 때).
  // 비세션 미리보기(previewHome)는 HOME-001 픽셀락 캡처의 원본이라 종전 문자열 그대로 둔다.
  const budgetProgress = evaluateHomeBudgetProgress({
    budgetKrw: budget,
    spentKrw: monthlyUsed,
    showRemaining: hasSession
  });
  const progress = budgetProgress.percent ?? 0;
  // HOME-BUDGET-113: session-gated like NOTI-102 so the logged-out preview stays inert.
  // usedAmountKrw is the gift-excluded month total (DNC-015), see budget-warning.ts.
  const budgetWarning = hasSession ? evaluateBudgetWarning({ budgetKrw: budget, spentKrw: monthlyUsed }) : null;
  // REP-121: 세션이 있을 때만 계산한다 -- 비세션 픽셀락 미리보기(previewHome)에는 지난달 데이터가
  // 없으므로 한 줄이 아예 렌더되지 않고, 미리보기 스크린샷은 기존과 동일하게 유지된다. 지난달에
  // 기록이 없는 첫 달 사용자도 순수 모듈이 null을 돌려줘 렌더되지 않는다.
  const lastMonthInsight = hasSession
    ? evaluateLastMonthComparison({
        todayIso: seoulToday,
        thisMonthToDateKrw: monthlyUsed,
        lastMonthRecords: lastMonthExpenses.data?.expenses ?? null
      })
    : null;
  // HOME-127: 넛지 카드의 문구·경로도 같은 순수 모듈이 고른다.
  //  - 예산이 없으면 "월 예산 설정하기" CTA가 되어 /budget으로 보낸다. 홈에는 예산을 정할
  //    진입점이 아예 없어서(설정 탭·알림에서만 닿았다) 허위 퍼센트를 지우기만 하면 사용자가
  //    할 수 있는 일이 사라지기 때문이다.
  //  - 예산이 있으면 문구·경로 모두 종전과 동일하다. 라운드 13 m-7: 초과 금액은
  //    HOME-BUDGET-113 배너가 상위 정보로 이미 알리므로, 배너가 보이는 동안에는 넛지가
  //    "예산을 N원 초과했어요"를 중복 렌더하지 않는다(hasWarningBanner).
  //  - 라운드 48 B1(c): 이번 달 예산이 없을 때만, 그리고 세션이 있을 때만 지난달 값을 넘긴다.
  //    비세션 미리보기(previewHome)는 예산이 있는 픽스처라 이 분기에 닿지도 않지만, 게이트를
  //    명시해 HOME-001 픽셀락 문자열이 데이터에 따라 흔들릴 여지 자체를 없앤다.
  const budgetNudge = buildHomeBudgetNudge({
    budgetKrw: budget,
    spentKrw: monthlyUsed,
    hasWarningBanner: Boolean(budgetWarning),
    lastMonthBudgetKrw: hasSession ? (lastMonthBudget.data?.amountKrw ?? null) : null
  });
  // UX-G: 빈 홈에 놓을 "다음 한 걸음" 카드 하나(첫 지출 유도 / 준비템 첫 안내 중 **하나만**).
  // 판정과 문구는 순수 모듈이 정한다(src/home/first-run-guide.ts) -- 비세션 미리보기는 항상
  // null이라 HOME-001 픽셀락 캡처는 종전 그대로다(UX-A 카드들과 같은 관례).
  // 준비물 개수는 /home이 이미 준 recommendedItems에서 세므로 요청이 늘지 않고 숫자가 참이다.
  // 라운드 35 F6: 그중 **아직 준비되지 않은** 항목만 센다(준비템 탭의 "모두 마쳤어요" 축하와
  // 어긋나지 않게), 그리고 "이번 달 기록 수"로 첫 사용자만 좁혀 5년 사용자에게는 뜨지 않게 한다.
  // 기록 수는 주간 카드가 이미 쓰는 재조정 결과(서버 캐시 + 오프라인 대기 행)를 그대로 재사용해
  // 요청을 늘리지 않고, 아직 모르면(null) 카드를 만들지 않는다.
  // 라운드 36 F3: "이번 달"만 보면 1년째 사용자도 매달 1~2일에 0건이 되어 첫 실행 안내가
  // 되돌아왔다. 전체 기간 신호(/home recentExpenses 길이, 서버 LIMIT 3)를 함께 넘겨 "이번 달도
  // 적고 전체도 적은" 진짜 초기 사용자에게만 뜨게 한다. 이 값도 홈이 이미 들고 있어 요청이
  // 늘지 않는다.
  const firstRunGuide = evaluateHomeFirstRunGuide({
    hasSession,
    hasAnyExpenseRecord,
    recommendedItemCount: countUnpreparedRecommendedItems(home.data?.recommendedItems ?? []),
    recentRecordCount: weeklyThisMonthRecords?.length ?? null,
    serverRecentExpenseCount: home.data ? home.data.recentExpenses.length : null,
    itemsGuideDismissed: childId ? dismissedItemsGuideChildIds.includes(childId) : false,
    // 라운드 40 J-5: 보기 전용 세션에서는 첫 지출 유도(약속 + 닫을 수 없는 CTA) 대신 사실을
    // 말하는 카드가 나간다. 판정은 게이트 하나가 갖고 있고(비세션에서는 절대 잠기지 않으므로
    // HOME-001 픽셀락 불변), 카드 문구는 순수 모듈이 고른다.
    expenseEntryLocked: expenseGate.locked
  });
  // 카드에 버튼이 붙는 갈래인지. `view-only`는 지금 할 수 있는 행동이 없어 ctaLabel·route가
  // 둘 다 null이고, 그때는 버튼 자체를 그리지 않는다(약속 문장과 CTA가 한 덩어리인 카드라
  // 버튼만 남기면 약속을 지운 의미가 없다 -- src/home/first-run-guide.ts 헤더 J-5).
  const firstRunGuideCta =
    firstRunGuide && firstRunGuide.ctaLabel !== null && firstRunGuide.route !== null
      ? { label: firstRunGuide.ctaLabel, route: firstRunGuide.route }
      : null;
  // F1: "최근 지출" 자리의 빈 상태 판정도 유도 카드·축하 배너와 **같은 소스**를 본다. 서버
  // recentExpenses만 보면, 오프라인으로 첫 기록을 남긴 순간 위에서는 "첫 기록이에요!"가, 아래
  // 에서는 "첫 기록을 남기면 …"이 한 화면에 동시에 뜬다(라운드 35 F1).
  const pendingOfflineCreateCount = countPendingOfflineCreates(childOfflineRows);
  // F2: 이 섹션이 할 말이 하나도 없으면 제목("최근 지출 / 전체 보기")까지 함께 접는다 --
  // 본문 없는 제목만 남기면 접은 자리가 고장난 것처럼 보인다. 판정은 순수 모듈이 한다(라운드
  // 36 F2: 유도 카드와 **같은 관찰값**을 보게 해서, 섹션도 유도 카드도 없는 상태가 아예
  // 만들어지지 않게 했다 -- 예전에는 래치 때문에 "마지막 기록 삭제" 후 그 구멍이 남았다).
  const showRecentExpensesSection = shouldShowHomeRecentExpensesSection({
    serverRecentExpenseCount: visibleHome.recentExpenses.length,
    pendingOfflineCreateCount,
    hasAnyExpenseRecord,
    guideVariant: firstRunGuide?.variant ?? null
  });
  const showFirstRecordCelebration = hasSession && Boolean(childId) && celebrationChildId === childId;
  // UX-A: 아래 세 가지는 전부 세션이 있을 때만 계산한다 -- 비세션 픽셀락 미리보기(previewHome)에는
  // 아이의 실제 날짜도 지출 행도 없으므로 아무것도 렌더되지 않고, HOME-001 캡처는 종전 그대로다
  // (REP-121 한 줄과 같은 관례). 셋 다 순수 모듈이 null을 돌려주면 그 자리는 비어 있는다.
  const babyCounter = hasSession
    ? evaluateBabyCounter({
        stageMode: selectedChild?.stageMode,
        nickname: selectedChild?.nickname ?? visibleHome.child.nickname,
        dueDate: selectedChild?.dueDate,
        birthDate: selectedChild?.birthDate,
        todayIso: seoulToday
      })
    : null;
  // 라운드 41 UX-T(A): 임신 → 출생 전환 입구. 예정일에 닿은 뒤부터 홈에 한 줄로 나오고, 유예
  // 기간이 지나 카운터가 접힌 뒤에도(babyCounter === null) 이 줄만 남는다 -- 전환하지 않으면
  // 준비템·마일스톤·100일 리포트가 조용히 비활성인 채로 남기 때문이다. 판정·문구는 전부 순수
  // 모듈에 있고(경과 일수를 세지 않고 재촉하지 않는다 -- DNC-020/DNC-018), 화면은 링크만 그린다.
  // 카운터와 같은 hasSession 게이트라 비세션 HOME-001 미리보기에는 아무것도 늘지 않는다.
  //
  // 라운드 41 K-8: 잠긴 세션에는 이 줄을 만들지 않는다. 프롬프트가 데려가는 곳은 아이 설정
  // (PATCH /children/:id)이고, 서버는 **아이 수정에도 편집 권한**을 요구한다 —
  // apps/api/src/onboarding/onboarding-core.service.ts의 updateChild가 지출 생성과 똑같이
  // `requireChildAccess(user, childId, true)`를 지난다(아니면 403). 그래서 보기 전용
  // 참여자에게 이 프롬프트는 눌러도 403으로 끝나는 입구였다(문구는 순수 모듈에만 있다).
  // 새 판정을 만들지 않고 expenseGate.locked를 그대로 쓰는 근거가 바로 그 공통 관문이다 —
  // 두 동작의 권한 조건이 서버에서 같으므로 판정을 두 벌로 갈라 두면 어긋날 자리만 생긴다.
  const birthTransitionPrompt = hasSession && !expenseGate.locked
    ? evaluateBirthTransitionPrompt({
        stageMode: selectedChild?.stageMode,
        dueDate: selectedChild?.dueDate,
        todayIso: seoulToday
      })
    : null;
  // UX-G: 기록이 한 건도 없는 홈에서 주간 카드는 "이번 주 지출은 아직 없어요 / 이번 주 첫
  // 기록을 남겨보세요"만 말한다 -- 바로 위 유도 카드가 같은 말을 CTA와 함께 하고 있으므로,
  // 첫 지출 유도가 떠 있는 동안에는 그 자리를 유도 카드에 내준다(같은 말을 두 번 하지 않는다).
  // UX-J: 계산은 위 weeklySpend가 이미 했다(알림 평가와 같은 값). 여기서는 카드를 그릴지만 고른다.
  // 라운드 40 J-5: 잠긴 세션의 `view-only` 카드도 같은 자리를 말하므로 함께 접는다 -- 그러지
  // 않으면 "이번 주 첫 기록을 남겨보세요"라는 권유가 보기 전용 참여자에게 되돌아온다.
  const weeklySummary = hasSession && !homeGuideSpeaksForEmptyHome(firstRunGuide?.variant) ? weeklySpend : null;
  const milestoneCountdown = hasSession
    ? evaluateMilestoneCountdown({
        stageMode: selectedChild?.stageMode,
        birthDate: selectedChild?.birthDate,
        nickname: selectedChild?.nickname ?? visibleHome.child.nickname,
        todayIso: seoulToday,
        // 누적 총액은 홈 캐시가 이미 들고 있는 서버 집계다(선물 제외, DNC-015). 비세션
        // 미리보기 픽스처에는 없는 필드라 home.data에서 직접 읽는다.
        totalExpenseKrw: home.data?.totalExpenseKrw ?? null
      })
    : null;
  // 라운드 48 B2 — 임신~첫돌 **누적 총액**을 홈이 말하게 한다.
  //
  // 홈은 이미 서버 누적 집계를 받고 있는데(위 마일스톤 카드가 쓰는 그 값), 화면에 나오는 곳이
  // 그 카드 부제 하나뿐이라 `stageMode !== "born"`(임신기·manual)과 첫돌 이후에는 이 앱이 세는
  // 가장 큰 숫자가 홈 어디에도 없었다. 마일스톤 카드가 이미 같은 금액을 말하고 있으면 접는다
  // (중복 금지 — 판정은 전부 src/home/cumulative-total.ts, 추가 요청 0: 같은 home.data를 읽는다).
  const cumulativeTotal = evaluateHomeCumulativeTotal({
    hasSession,
    totalExpenseKrw: home.data?.totalExpenseKrw ?? null,
    hasMilestoneCard: milestoneCountdown !== null
  });
  // NOTI-102: 알림 센터가 실제 기능이 되어 UX-5B-8에서 숨겼던 홈 알림 벨을 미확인 배지와 함께 복원.
  return (
    <AppScreen refreshControl={refreshControl}>
      <View testID="pixel-screen-HOME-001" style={homePixelScaleFrameStyle()}>
        <View style={homePixelFrameStyle()}>
          {babyCounter ? (
            // UX-A: 홈을 여는 사람이 가장 먼저 보는 줄. 단계 라벨은 아이브로우로 남고, 화면에
            // 그리는 "D-32"는 TalkBack이 "디 마이너스 삼십이"로 읽으므로 소리용 문장을 따로 준다.
            <View style={homeBabyCounterStyle.header}>
              <View style={homeBabyCounterStyle.copy}>
                <Text style={homeBabyCounterStyle.eyebrow}>{visibleHome.child.stageLabel}</Text>
                {canSwitchChild ? (
                  // HOME-138: 아이가 2명 이상일 때만 이름 줄이 버튼이 된다. 감싸는 Pressable이
                  // 접근성 노드를 대신 들고(라벨 = 들리는 카운터 문장 + "아이 전환"), 문구·크기·
                  // 위치는 아래 비전환 분기와 한 글자도 다르지 않다.
                  //
                  // 라운드 38 H-8: role은 header다(button이 아니다). 이 줄은 아래 비전환 분기와
                  // **같은 줄**이고 거기서는 accessibilityRole="header"라, 여기서 button으로
                  // 바꾸면 아이가 2명 이상인 사용자만 홈의 제목 랜드마크를 잃는다. react-native는
                  // role을 하나만 주므로 랜드마크를 지키고, "누를 수 있다"는 사실은 힌트 문장 +
                  // 접근성 액션으로 전한다(src/children/child-switch.ts에 근거 주석).
                  <Pressable
                    accessible
                    accessibilityRole="header"
                    accessibilityLabel={childSwitchTriggerAccessibilityLabel(babyCounter.accessibilityLabel)}
                    accessibilityHint={CHILD_SWITCH_HEADER_TRIGGER_HINT}
                    accessibilityActions={CHILD_SWITCH_HEADER_ACCESSIBILITY_ACTIONS}
                    onAccessibilityAction={(event) => {
                      if (event.nativeEvent.actionName === "activate") childSwitch.toggle();
                    }}
                    hitSlop={8}
                    onPress={childSwitch.toggle}
                    testID="home-child-switch-trigger"
                  >
                    <Text testID="home-baby-counter" style={homeBabyCounterStyle.title}>
                      {babyCounter.title}
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    accessible
                    accessibilityRole="header"
                    accessibilityLabel={babyCounter.accessibilityLabel}
                    testID="home-baby-counter"
                    style={homeBabyCounterStyle.title}
                  >
                    {babyCounter.title}
                  </Text>
                )}
                <Text style={homeBabyCounterStyle.subtitle}>우리 아이에게 해준 것을 따뜻하게 기록해요.</Text>
              </View>
              <NotificationBell />
            </View>
          ) : canSwitchChild ? (
            // HOME-138: 카운터가 없는 헤더(수동 단계 등)에서도 전환 입구는 있어야 한다.
            // ScreenHeader는 title을 문자열로만 받아 그 줄만 감쌀 수 없으므로, 전환이 가능한
            // 경우에 한해 같은 토큰·같은 골격을 여기서 그린다(비전환 홈은 아래 ScreenHeader 그대로).
            <View style={homeChildSwitchStyle.header}>
              <View style={homeChildSwitchStyle.copy}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={childSwitchTriggerAccessibilityLabel(
                    `${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`
                  )}
                  accessibilityHint={CHILD_SWITCH_TRIGGER_HINT}
                  hitSlop={8}
                  onPress={childSwitch.toggle}
                  testID="home-child-switch-trigger"
                >
                  <Text style={homeChildSwitchStyle.title}>
                    {`${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`}
                  </Text>
                </Pressable>
                <Text style={homeChildSwitchStyle.subtitle}>우리 아이에게 해준 것을 따뜻하게 기록해요.</Text>
              </View>
              <NotificationBell />
            </View>
          ) : (
            <ScreenHeader
              title={`${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`}
              subtitle="우리 아이에게 해준 것을 따뜻하게 기록해요."
              action={<NotificationBell />}
            />
          )}

          {/* UX-T(A): 출생 전환 입구. 카운터가 있으면 그 아래 한 줄, 카운터가 접힌 뒤에는 이
              줄만 남는다. 링크 하나뿐이라 홈의 정보 밀도를 늘리지 않고, 목적지(아이 관리)는
              종전과 같은 화면이다 -- 전환 폼을 홈으로 옮기지 않는다. */}
          {birthTransitionPrompt ? (
            <TextButton
              accessibilityLabel={birthTransitionPrompt.accessibilityLabel}
              label={birthTransitionPrompt.label}
              onPress={() => router.push(birthTransitionPrompt.route)}
              style={{ alignSelf: "flex-start" }}
            />
          ) : null}

          {/* 시트 본체는 위에서 한 번만 만든다(H-9) -- 에러 상태의 홈도 같은 것을 그린다. */}
          {childSwitchSheet}

          <HeroSummaryCard
            label="이번 달 지출"
            amount={formatKrw(monthlyUsed)}
            subtext={budgetProgress.subtext}
            progress={progress}
            showProgress={budgetProgress.hasBudget}
          />

          {showFirstRecordCelebration ? (
            // UX-G: 첫 기록이 막 쌓인 순간. 히어로 카드 **바로 아래**에 붙어 "여기"가 어디인지
            // 가리킨다. 이번 세션에 한 번만 뜨고(스토어가 축하 여부를 들고 있다) 닫으면 끝난다.
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={FIRST_RECORD_CELEBRATION_MESSAGE}
              testID={FIRST_RECORD_CELEBRATION_TEST_ID}
              style={[homeFirstRecordCelebrationStyle.banner, theme.shadows.card]}
            >
              <Text accessible={false} style={homeFirstRecordCelebrationStyle.icon}>
                ✓
              </Text>
              <View style={homeFirstRecordCelebrationStyle.copy}>
                <Text style={homeFirstRecordCelebrationStyle.title}>{FIRST_RECORD_CELEBRATION_TITLE}</Text>
                <Text style={homeFirstRecordCelebrationStyle.body}>{FIRST_RECORD_CELEBRATION_BODY}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={FIRST_RECORD_CELEBRATION_DISMISS_LABEL}
                hitSlop={12}
                onPress={dismissFirstRecordCelebration}
              >
                <Text style={homeFirstRecordCelebrationStyle.dismiss}>{FIRST_RECORD_CELEBRATION_DISMISS_LABEL}</Text>
              </Pressable>
            </View>
          ) : null}

          {budgetWarning ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${budgetWarning.title}. ${budgetWarning.body}`}
              testID="home-budget-warning-banner"
              style={[
                homeBudgetWarningStyle.banner,
                budgetWarning.level === "exceeded"
                  ? homeBudgetWarningStyle.bannerExceeded
                  : homeBudgetWarningStyle.bannerApproaching,
                theme.shadows.card
              ]}
            >
              <Ionicons
                accessible={false}
                name={budgetWarning.level === "exceeded" ? "warning" : "warning-outline"}
                size={16}
                color={budgetWarning.level === "exceeded" ? theme.colors.danger : theme.colors.warning}
              />
              <View style={homeBudgetWarningStyle.copy}>
                <Text style={homeBudgetWarningStyle.title}>{budgetWarning.title}</Text>
                <Text style={homeBudgetWarningStyle.body}>{budgetWarning.body}</Text>
              </View>
            </View>
          ) : null}

          {firstRunGuide ? (
            // UX-G: 온보딩 직후의 빈 홈이 "0원"만 보여주고 끝나지 않도록, 루프의 첫 단계(지출
            // 기록) 또는 셋째 단계(준비템 확인) 중 **하나로만** 보낸다(DNC-002).
            <View testID={firstRunGuide.testID} style={[homeFirstRunGuideStyle.card, theme.shadows.card]}>
              <View accessible accessibilityLabel={firstRunGuide.accessibilityLabel} style={homeFirstRunGuideStyle.copy}>
                <Text style={homeFirstRunGuideStyle.title}>{firstRunGuide.title}</Text>
                <Text style={homeFirstRunGuideStyle.subtitle}>{firstRunGuide.subtitle}</Text>
              </View>
              {/* 라운드 40 J-5: `view-only` 카드는 버튼 없이 사실만 말한다(firstRunGuideCta가
                  null). 나머지 두 갈래의 버튼·경로·문구는 종전 그대로다. */}
              {firstRunGuideCta ? (
                <PrimaryButton
                  accessibilityLabel={firstRunGuideCta.label}
                  label={firstRunGuideCta.label}
                  onPress={() => {
                    // UX-R(M): 이 카드는 여러 갈래다. 지출 기록으로 보내는 갈래만 잠그고, 준비템
                    // 갈래는 그대로 둔다 -- 보기 전용 참여자도 준비템은 볼 수 있다(잠글 이유가
                    // 없고, 잠그면 볼 수 있는 것까지 막는다). 잠긴 세션에서는 애초에 이 갈래가
                    // `view-only`로 대체되지만, 판정과 렌더 사이의 어긋남까지 여기서 받아 낸다.
                    if (firstRunGuide.variant === "first-expense" && expenseGate.locked) {
                      expenseGate.explain();
                      return;
                    }
                    // 준비템 안내는 눌러서 확인한 순간 역할이 끝난다 -- 닫기와 같은 처리를 한다.
                    if (firstRunGuide.variant === "first-items") dismissItemsGuide(childId);
                    router.push(firstRunGuideCta.route);
                  }}
                />
              ) : null}
              {firstRunGuide.dismissible ? (
                <TextButton
                  label={FIRST_ITEMS_GUIDE_DISMISS_LABEL}
                  onPress={() => dismissItemsGuide(childId)}
                  style={{ alignSelf: "center" }}
                />
              ) : null}
            </View>
          ) : null}

          {weeklySummary ? (
            <View
              accessible
              accessibilityLabel={weeklySummary.accessibilityLabel}
              testID="home-weekly-summary"
              style={[homeWeeklySummaryStyle.card, theme.shadows.card]}
            >
              <View style={homeWeeklySummaryStyle.row}>
                <Ionicons
                  accessible={false}
                  name="calendar-outline"
                  size={homeWeeklySummaryStyle.glyph.fontSize}
                  color={homeWeeklySummaryStyle.glyph.color}
                />
                <Text style={homeWeeklySummaryStyle.text}>{weeklySummary.text}</Text>
              </View>
              <Text style={homeWeeklySummaryStyle.streak}>{weeklySummary.streakText}</Text>
            </View>
          ) : null}

          {milestoneCountdown ? (
            // 탭하면 리포트 탭 -- 그 탭이 100일/첫돌 마일스톤 리포트를 이미 연다(REP-127).
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={milestoneCountdown.accessibilityLabel}
              testID="home-milestone-countdown"
              onPress={() => router.push("/(tabs)/reports")}
            >
              <Card style={homeMilestoneStyle.card}>
                <View style={homeMilestoneStyle.iconBox}>
                  <Ionicons
                    accessible={false}
                    name="trophy-outline"
                    size={homeMilestoneStyle.icon.fontSize}
                    color={homeMilestoneStyle.icon.color}
                  />
                </View>
                <View style={homeMilestoneStyle.copy}>
                  <Text style={homeMilestoneStyle.title}>{milestoneCountdown.title}</Text>
                  <Text style={homeMilestoneStyle.subtitle}>{milestoneCountdown.subtitle}</Text>
                  {/* 라운드 33 F1: 눌렀을 때 실제로 열리는 리포트를 그대로 예고한다. 카운트다운이
                      "첫돌까지 D-N"이어도 첫돌 전이면 리포트 탭은 100일 리포트를 열기 때문에
                      (src/home/milestone-countdown.ts의 CTA 규칙), 라벨은 순수 모듈이 정한다. */}
                  <Text style={homeMilestoneStyle.cta}>{milestoneCountdown.ctaLabel}</Text>
                </View>
                <View accessible={false} style={homeBudgetNudgeArrowStyle.button}>
                  <Text accessible={false} style={homeBudgetNudgeArrowStyle.glyph}>
                    ›
                  </Text>
                </View>
              </Card>
            </Pressable>
          ) : null}

          {cumulativeTotal ? (
            // 라운드 48 B2: 마일스톤 카드가 누적 총액을 말하지 않는 시기(임신 단계·manual·첫돌
            // 이후)에만 나온다. 세션 게이트는 순수 모듈 안에 있어(hasSession), 비세션 HOME-001
            // 미리보기에는 이 자리가 통째로 없다.
            <View
              accessible
              accessibilityLabel={cumulativeTotal.accessibilityLabel}
              testID="home-cumulative-total"
              style={[homeCumulativeTotalStyle.card, theme.shadows.card]}
            >
              <View style={homeCumulativeTotalStyle.row}>
                <Ionicons
                  accessible={false}
                  name="wallet-outline"
                  size={homeCumulativeTotalStyle.glyph.fontSize}
                  color={homeCumulativeTotalStyle.glyph.color}
                />
                <Text accessible={false} style={homeCumulativeTotalStyle.title}>
                  {cumulativeTotal.title}
                </Text>
              </View>
              <Text accessible={false} style={homeCumulativeTotalStyle.subtitle}>
                {cumulativeTotal.subtitle}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* D1 후속(실기기 피드백 2): 퀵액션 4개도 탭바와 같은 Ionicons outlined 계열로.
                아이콘만 바뀌고 라벨·순서·목적지는 그대로다. HOME-001 기준 캡처는 재촬영 대상. */}
            <QuickActionIconButton icon={<QuickActionIcon name="create-outline" />} label="지출 기록" onPress={expenseGate.guard(() => router.push("/expenses/new"))} />
            <QuickActionIconButton icon={<QuickActionIcon name="cube-outline" />} label="추천템" onPress={() => router.push("/(tabs)/items")} />
            <QuickActionIconButton icon={<QuickActionIcon name="bar-chart-outline" />} label="성장 리포트" onPress={() => router.push("/(tabs)/reports")} />
            <QuickActionIconButton icon={<QuickActionIcon name="menu-outline" />} label="더보기" onPress={() => router.push("/(tabs)/more")} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${budgetNudge.title} ${budgetNudge.subtitle}`}
            testID={budgetNudge.variant === "set-budget" ? "home-set-budget-cta" : "home-budget-nudge"}
            onPress={() => router.push(budgetNudge.route)}
          >
            <Card style={homeBudgetNudgeStyle.card}>
              <View style={homeBudgetNudgeStyle.iconBox}>
                <Ionicons
                  name="wallet-outline"
                  size={homeBudgetNudgeStyle.icon.fontSize}
                  color={homeBudgetNudgeStyle.icon.color}
                />
              </View>
              <View style={homeBudgetNudgeStyle.copy}>
                <Text style={homeBudgetNudgeStyle.title}>{budgetNudge.title}</Text>
                <Text style={homeBudgetNudgeStyle.subtitle}>{budgetNudge.subtitle}</Text>
              </View>
              <View accessible={false} style={homeBudgetNudgeArrowStyle.button}>
                <Text accessible={false} style={homeBudgetNudgeArrowStyle.glyph}>›</Text>
              </View>
            </Card>
          </Pressable>

          {lastMonthInsight ? (
            <View
              accessible
              accessibilityLabel={lastMonthInsight.text}
              testID="home-last-month-insight"
              style={[homeLastMonthInsightStyle.card, theme.shadows.card]}
            >
              <Ionicons
                accessible={false}
                name="stats-chart-outline"
                size={homeLastMonthInsightStyle.glyph.fontSize}
                color={homeLastMonthInsightStyle.glyph.color}
              />
              <Text style={homeLastMonthInsightStyle.text}>{lastMonthInsight.text}</Text>
            </View>
          ) : null}

          {showRecentExpensesSection ? (
            <ScreenHeader
              title="최근 지출"
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="최근 지출 전체 보기"
                  hitSlop={12}
                  onPress={() => router.push("/(tabs)/records")}
                >
                  <Text style={{ color: theme.colors.brown, fontSize: 12, fontWeight: "700" }}>전체 보기</Text>
                </Pressable>
              }
            />
          ) : null}
          {!showRecentExpensesSection ? null : visibleHome.recentExpenses.length === 0 ? (
            pendingOfflineCreateCount > 0 ? (
              // 라운드 35 F1: 서버 목록은 비었지만 이 기기에는 아직 올라가지 않은 기록이 있다.
              // 여기서 MOB-117 빈 상태를 그대로 그리면 바로 위 "첫 기록이에요!" 축하와 한 화면
              // 에서 서로를 부정한다. 기록 탭과 같은 단어("동기화 대기")로 사실만 한 줄 알린다.
              <View
                accessible
                accessibilityLabel={homePendingSyncNoticeText(pendingOfflineCreateCount)}
                testID={HOME_PENDING_SYNC_NOTICE_TEST_ID}
                style={[homePendingSyncNoticeStyle.row, theme.shadows.card]}
              >
                <Ionicons
                  accessible={false}
                  name="sync-outline"
                  size={homePendingSyncNoticeStyle.glyph.fontSize}
                  color={homePendingSyncNoticeStyle.glyph.color}
                />
                <Text style={homePendingSyncNoticeStyle.text}>
                  {homePendingSyncNoticeText(pendingOfflineCreateCount)}
                </Text>
              </View>
            ) : (
              // MOB-117 홈 최근 지출 빈 상태: 기록 탭(records.tsx)의 첫-기록 빈 상태 문구와 톤
              // 일치. 비세션 미리보기(previewHome)는 항상 3건이라 이 분기에 도달하지 않는다.
              // 여기까지 왔다면 showRecentExpensesSection이 이미 "이 문구가 참인 상황"만 통과
              // 시킨 뒤다(위 정의 — 유도 카드가 떠 있는 동안과 동기화 refetch 창은 섹션째 접힌다).
              <EmptyStateCard
                title="첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
                actionLabel="기록하기"
                onPress={expenseGate.guard(() => router.push("/expenses/new"))}
              />
            )
          ) : (
            // HOME-124: 부제는 기록 탭과 **같은 함수**가 만든다. 예전에는 서버가 준 ISO 원본을
            // 그대로 그려("2026-08-27") 같은 지출이 기록 탭에서는 "8월 27일"로 보였고, 선물/환불
            // 행은 홈에서 일반 지출과 전혀 구분되지 않았다(기록 탭은 "선물 ·"/"환불 ·" 접두).
            // 비세션 미리보기 픽스처("오늘"/"05.20")는 formatSpentOn의 통과 규칙 + expenseType
            // "expense"라 출력이 한 글자도 바뀌지 않는다 -- HOME-001 픽셀락 캡처 유지.
            visibleHome.recentExpenses.slice(0, 3).map((expense) => (
              <ListRow
                key={expense.id}
                icon={<Ionicons name="receipt-outline" size={20} color={theme.colors.mainCoral} />}
                title={expense.itemName}
                subtitle={homeRecentExpenseSubtitle(expense)}
                value={formatKrw(expense.amountKrw)}
                onPress={() => router.push(`/expenses/${expense.id}`)}
              />
            ))
          )}

          {/* 라운드 35 F2: FAB는 유지한다. 이건 빈 홈 전용 CTA가 아니라 **전역 관례**로,
              기록이 쌓인 뒤에도 같은 자리에서 같은 일을 하는 유일한 상수다. 없애면 목록이 찬
              홈에서 지출 기록 진입점이 퀵액션 하나로 줄어든다. 중복으로 읽히던 것은 같은 자리에
              세 번 서 있던 /expenses/new 큰 버튼들이었고, 그중 접은 것은 최근 지출 섹션의
              빈 상태 버튼이다(위 분기) -- 남는 큰 CTA는 유도 카드 1개 + FAB. */}
          <FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />
        </View>
      </View>
    </AppScreen>
  );
}
