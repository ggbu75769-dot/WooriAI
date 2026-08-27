import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { getHome, listChildren, listExpenses, LOCAL_SESSION_TOKEN, type Expense } from "../../src/api/client";
import {
  applyChildSwitch,
  canSwitchChildFromHome,
  childSwitchOptionAccessibilityLabel,
  childSwitchTriggerAccessibilityLabel,
  CHILD_SWITCH_SHEET_TITLE,
  CHILD_SWITCH_TRIGGER_HINT
} from "../../src/children/child-switch";
import { fetchMonthExpenses } from "../../src/expenses/month-expenses";
import { homeRecentExpenseSubtitle } from "../../src/expenses/records-list-view";
import { evaluateBabyCounter } from "../../src/home/baby-counter";
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
import { evaluateMilestoneCountdown } from "../../src/home/milestone-countdown";
import { evaluateWeeklySummary } from "../../src/home/weekly-summary";
import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";
import { useOfflineSyncSnapshot } from "../../src/offline/sync-controller";
import type { LocalExpenseRow } from "../../src/offline/types";
import { formatKrw } from "../../src/money";
import { NotificationBell } from "../../src/notifications/NotificationBell";
import { useHomeNotificationEvaluation } from "../../src/notifications/useHomeNotificationEvaluation";
import { usePullToRefresh } from "../../src/query/use-pull-to-refresh";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import {
  announceForA11y,
  AppScreen,
  BottomSheetFrame,
  Card,
  EmptyStateCard,
  FloatingActionButton,
  HeroSummaryCard,
  ListRow,
  PrimaryButton,
  QuickActionIconButton,
  ScreenHeader,
  StatusBadge,
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
  icon: {
    fontSize: 16,
    fontWeight: "800"
  },
  iconApproaching: {
    color: theme.colors.warning
  },
  iconExceeded: {
    color: theme.colors.danger
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
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: theme.touchTarget
  },
  rowName: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: theme.typography.body1.fontSize,
    fontWeight: "700"
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
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  // HOME-138: 헤더 탭으로 여는 아이 전환 시트의 열림 상태. 조기 반환(에러/로딩)보다 위에 둔다.
  const [childSwitchOpen, setChildSwitchOpen] = useState(false);
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
  //
  // REC-124(H1): API-124 이후 한 요청은 한 페이지(기본 200 · 상한 500건)이고 정렬이 spentOn desc라,
  // 첫 페이지만 읽으면 200건을 넘는 달의 **앞날짜가 통째로 빠진다**. 그러면 "같은 일자까지"의 부분
  // 합계가 0이 되어 이 한 줄이 "지난달 같은 시점까지는 지출 기록이 없었어요"라는 없는 사실을
  // 말한다. fetchMonthExpenses가 CSV 내보내기와 같은 커서 루프로 전량을 모은다
  // (src/expenses/month-expenses.ts). 기록 탭도 같은 페처를 쓰므로 공유 캐시의 내용이 어긋나지 않는다.
  const lastMonthExpenses = useQuery({
    queryKey: ["expenses", childId, lastYearMonth],
    enabled: Boolean(authToken && childId && lastYearMonth),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))
  });
  // UX-A 주간 요약: 이번 달 지출 행. 기록 탭이 이번 달을 볼 때와 **같은 캐시 키**라
  // (["expenses", childId, 이번 달]) 대개 이미 채워진 캐시를 그대로 읽고, 지출 생성/수정/
  // 가져오기가 invalidate하는 ["expenses"] 프리픽스에 그대로 걸린다. 지난달 캐시(위)와 함께
  // 넘겨야 달을 걸친 주("9월 1일 화요일"의 이번 주 월요일 = 8월 31일)도 정확히 더해진다 --
  // 근거는 src/home/weekly-summary.ts.
  const thisYearMonth = seoulToday.slice(0, 7);
  const thisMonthExpenses = useQuery({
    queryKey: ["expenses", childId, thisYearMonth],
    enabled: Boolean(authToken && childId),
    queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, thisYearMonth, page))
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
            lastMonthRecords: weeklyLastMonthRecords
          })
        : null,
    [hasSession, seoulToday, weeklyThisMonthRecords, weeklyLastMonthRecords]
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
  // (새 요청 없음). 아직 없으면 알림은 종전 월 페이스 문구로 폴백한다.
  useHomeNotificationEvaluation(hasSession ? home.data : undefined, weeklySpend);
  // MOB-117 당겨서 새로고침: 홈 요약·최근 지출은 모두 ["home"] 쿼리에서 나온다. invalidate는
  // 활성 쿼리 refetch 완료까지 resolve되므로 스피너가 실제 완료에 맞춰 닫힌다.
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => queryClient.invalidateQueries({ queryKey: ["home"] }));
  // HOME-138: 아이 전환은 아이 관리 화면과 **같은 경로**(applyChildSwitch)로만 일어난다.
  // 여기서 스토어 쓰기·캐시 무효화를 손으로 다시 적으면 한쪽이 무효화를 빠뜨렸을 때 아이 A의
  // 홈/기록/리포트 캐시가 아이 B 화면에 그대로 남는다(라운드 28의 A→B 캐시 오염).
  const switchableChildren = childrenQuery.data?.children ?? [];
  const canSwitchChild = hasSession && canSwitchChildFromHome(switchableChildren);
  const handleChildSwitch = (child: { id: string; nickname: string }) => {
    setChildSwitchOpen(false);
    applyChildSwitch(childId, child, {
      setSelectedChildId,
      invalidateQueries: (input) => queryClient.invalidateQueries(input),
      announce: announceForA11y
    });
  };
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

  if (hasSession && homePhase === "error") {
    return (
      <AppScreen>
        <EmptyStateCard
          title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          actionLabel="다시 시도"
          onPress={() => home.refetch()}
        />
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

  const visibleHome = hasSession ? home.data! : previewHome;
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
  const budgetNudge = buildHomeBudgetNudge({
    budgetKrw: budget,
    spentKrw: monthlyUsed,
    hasWarningBanner: Boolean(budgetWarning)
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
    itemsGuideDismissed: childId ? dismissedItemsGuideChildIds.includes(childId) : false
  });
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
  // UX-G: 기록이 한 건도 없는 홈에서 주간 카드는 "이번 주 지출은 아직 없어요 / 이번 주 첫
  // 기록을 남겨보세요"만 말한다 -- 바로 위 유도 카드가 같은 말을 CTA와 함께 하고 있으므로,
  // 첫 지출 유도가 떠 있는 동안에는 그 자리를 유도 카드에 내준다(같은 말을 두 번 하지 않는다).
  // UX-J: 계산은 위 weeklySpend가 이미 했다(알림 평가와 같은 값). 여기서는 카드를 그릴지만 고른다.
  const weeklySummary = hasSession && firstRunGuide?.variant !== "first-expense" ? weeklySpend : null;
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={childSwitchTriggerAccessibilityLabel(babyCounter.accessibilityLabel)}
                    accessibilityHint={CHILD_SWITCH_TRIGGER_HINT}
                    hitSlop={8}
                    onPress={() => setChildSwitchOpen((open) => !open)}
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
                  onPress={() => setChildSwitchOpen((open) => !open)}
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

          {canSwitchChild && childSwitchOpen ? (
            // 목록은 ["children"] 캐시(설정 · 리포트와 같은 키)를 그대로 읽는다 -- 새 요청 0.
            <View testID="home-child-switch-sheet">
              <BottomSheetFrame title={CHILD_SWITCH_SHEET_TITLE} showHandle={false}>
                {switchableChildren.map((child) => {
                  const isCurrent = child.id === childId;
                  return (
                    <Pressable
                      key={child.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isCurrent }}
                      accessibilityLabel={childSwitchOptionAccessibilityLabel(child.nickname, isCurrent)}
                      onPress={() => handleChildSwitch(child)}
                      style={homeChildSwitchStyle.row}
                    >
                      <Text style={homeChildSwitchStyle.rowName}>{child.nickname}</Text>
                      {isCurrent ? <StatusBadge label="현재 선택" tone="success" /> : null}
                    </Pressable>
                  );
                })}
                <TextButton label="닫기" onPress={() => setChildSwitchOpen(false)} />
              </BottomSheetFrame>
            </View>
          ) : null}

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
              <Text
                style={[
                  homeBudgetWarningStyle.icon,
                  budgetWarning.level === "exceeded"
                    ? homeBudgetWarningStyle.iconExceeded
                    : homeBudgetWarningStyle.iconApproaching
                ]}
              >
                ⚠
              </Text>
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
              <PrimaryButton
                accessibilityLabel={firstRunGuide.ctaLabel}
                label={firstRunGuide.ctaLabel}
                onPress={() => {
                  // 준비템 안내는 눌러서 확인한 순간 역할이 끝난다 -- 닫기와 같은 처리를 한다.
                  if (firstRunGuide.variant === "first-items") dismissItemsGuide(childId);
                  router.push(firstRunGuide.route);
                }}
              />
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
                <Text accessible={false} style={homeWeeklySummaryStyle.glyph}>
                  ▦
                </Text>
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
                  <Text accessible={false} style={homeMilestoneStyle.icon}>
                    ★
                  </Text>
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

          <View style={{ flexDirection: "row", gap: 8 }}>
            <QuickActionIconButton icon="▣" label="지출 기록" onPress={() => router.push("/expenses/new")} />
            <QuickActionIconButton icon="☆" label="추천템" onPress={() => router.push("/(tabs)/items")} />
            <QuickActionIconButton icon="▥" label="성장 리포트" onPress={() => router.push("/(tabs)/reports")} />
            <QuickActionIconButton icon="☰" label="더보기" onPress={() => router.push("/(tabs)/more")} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${budgetNudge.title} ${budgetNudge.subtitle}`}
            testID={budgetNudge.variant === "set-budget" ? "home-set-budget-cta" : "home-budget-nudge"}
            onPress={() => router.push(budgetNudge.route)}
          >
            <Card style={homeBudgetNudgeStyle.card}>
              <View style={homeBudgetNudgeStyle.iconBox}>
                <Text style={homeBudgetNudgeStyle.icon}>▮</Text>
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
              <Text accessible={false} style={homeLastMonthInsightStyle.glyph}>
                ▤
              </Text>
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
                <Text accessible={false} style={homePendingSyncNoticeStyle.glyph}>
                  ⟳
                </Text>
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
                onPress={() => router.push("/expenses/new")}
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
                icon="▣"
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
          <FloatingActionButton onPress={() => router.push("/expenses/new")} />
        </View>
      </View>
    </AppScreen>
  );
}
