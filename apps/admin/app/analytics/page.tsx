"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ANALYTICS_EVENT_LABELS,
  ANALYTICS_EVENT_NAMES,
  getAdminAnalyticsSummary,
  isAuthError,
  type AdminAnalyticsSummary,
  type AdminPurchaseFollowupBreakdown,
  type AnalyticsSummaryDays
} from "../../src/lib/admin-api";
import { loadErrorCopy, type LoadErrorCopy } from "../../src/lib/load-error-copy";
import { analyticsTrendView } from "../../src/lib/analytics-trend-view";
import { classifiedOnboardingStepTotal, onboardingStepCount } from "../../src/lib/onboarding-steps-view";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

/**
 * ANA-127: registry 이벤트 이름 중 admin-api.ts의 6종 미러가 작성된 뒤 추가된 것들.
 * API 응답의 `byName`은 계약 레지스트리(packages/contracts/src/analytics.ts)에서 생성되므로
 * 이 이름들도 0건 포함해 이미 내려온다 — 여기서는 한국어 라벨만 보탠다.
 *
 * 라운드 39 UX-P가 `report_share_tapped`를 같은 규칙으로 뒤에 붙이면서 세 종이 됐다
 * (근거: packages/contracts/src/analytics.ts:195-198). 라벨이 없으면 표에 원문 이벤트
 * 이름이 그대로 노출되므로 레지스트리에 이름이 늘 때마다 여기도 같이 채운다.
 */
const ANA127_EVENT_LABELS: Record<string, string> = {
  item_detail_viewed: "준비템 상세 열람",
  purchase_followup_answered: "구매 확인 응답",
  report_share_tapped: "리포트 공유",
  // 라운드 60 #9: 온보딩 단계 진입. 같은 append-only 규칙으로 레지스트리 맨 뒤에 붙었다.
  onboarding_step_viewed: "온보딩 단계 진입"
};

/**
 * 온보딩 단계(ONB-001..ONB-004)의 **손 미러** — 계약(packages/contracts/src/analytics.ts의
 * `ONBOARDING_STEPS`)이 정한 리터럴과 순서를 그대로 옮겨 적고, 한국어 라벨만 보탠다.
 * 라벨 문구는 앱의 온보딩 화면 제목(apps/mobile/src/onboarding/steps.ts)과 같은 말이라,
 * 어드민 표의 단계 이름과 사용자가 본 화면이 어긋나지 않는다.
 *
 * 라운드 60 리뷰(P2-8): 왜 import가 아니라 **손 미러 + 대조 테스트**인가. 이 워크스페이스
 * (apps/admin)는 `@wooriai/contracts`를 의존성으로 들지 않는다 — 어드민은 REST 응답만 읽는 Next
 * 앱이고, 계약 패키지를 끌어오면 그 트랜지티브 의존성(zod 등)이 어드민 번들로 따라 들어온다.
 * 그렇다고 목록을 그냥 두면 레지스트리에 단계가 늘거나 순서가 바뀐 날 이 화면이 조용히 거짓말을
 * 한다(퍼널 앞 4단의 순서·라벨과 "사람당 최대 4건"이 전부 틀린 말이 된다).
 *
 * 그래서 `admin-analytics.test.ts`가 계약 파일의 `ONBOARDING_STEPS`를 직접 읽어 이 목록의
 * **리터럴과 순서**를 대조한다. 갈리는 순간 테스트가 깨지고, 고칠 곳은 이 배열 하나다.
 *
 * API도 같은 계약 배열에서 `onboardingSteps`를 만들므로(analytics-summary.service.ts) 응답의
 * 순서와 이 미러의 순서는 같다 — 그래도 화면은 응답의 `step` 값으로 찾아 읽지(onboardingStepCount)
 * 배열 위치를 믿지 않는다.
 */
const ONBOARDING_STEPS: { step: string; label: string }[] = [
  { step: "child_status", label: "아이 상태 선택" },
  { step: "child_profile", label: "아이 프로필 입력" },
  { step: "prepared_items", label: "이미 준비한 물건 체크" },
  { step: "budget", label: "월 예산 설정" }
];

const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

type FunnelStage = {
  /** 단계 식별자(React key). 이벤트 이름이 아니라 단계 이름 — 앞 4단은 한 이벤트의 단계별
   * 분해이고, 마지막 단은 이벤트 전체가 아니라 그 이벤트의 한 답변만 센다. */
  key: string;
  label: string;
  /** 기간 내 이 단계의 건수. */
  count: (summary: AdminAnalyticsSummary) => number;
};

/**
 * ADM-009 + ANA-127 + ANA-128: KPI 퍼널 (docs/5차 설계 문서 §4.3). 원래 4단
 * (온보딩 완료 → 지출 기록 → 준비템 체크 → 제휴 링크 클릭)이었지만 준비템 체크와 링크 클릭
 * 사이가 통째로 비어 있어 전환율이 읽히지 않았다. ANA-127이 상세 열람과 구매 확인 응답을
 * 계측하면서 구매 루프가 6단으로 이어진다.
 *
 * ANA-128: 마지막 단은 "샀어요"(purchased)만 센다. 예전에는 요약 API가 이벤트 이름 단위로만
 * 집계해 3갈래(샀어요·아직이요·괜찮아요) 합계밖에 없었고, 그 합계로 낸 전환율은 답변률보다도
 * 넓은 수였다. 이제 API가 `purchaseFollowup`으로 답변별 분해를 내려주므로 마지막 단계는
 * "샀어요"라는 **답** 하나만 센다.
 *
 * 라운드 60 리뷰(P2-5) — 그 단을 "실구매"라고 부르던 라벨·각주를 정정한다. 라운드 60 트랙 B가
 * "샀어요" 버튼에서 done 확정을 떼어 내 **저장이 확정된 자리**로 옮겼다
 * (apps/mobile/src/commerce/PurchaseFollowupPrompt.tsx). 그 버튼이 실제로 하는 일은 기록 시트를
 * 여는 것뿐이라, 사용자가 시트를 닫으면 답은 남고 지출은 없다. 즉 이 이벤트는 **답의 기록**이지
 * 구매의 기록이 아니다 — 그 답과 뒤따르는 expense_recorded 사이의 간격이 곧 이탈률이고, 그
 * 간격을 "실구매"라고 부르면 앱이 이미 고친 부풀림을 어드민이 다시 만든다.
 *
 * 이벤트 이름 단위 단계는 `funnel` 별칭이 아니라 `byName`에서 읽는다 — 별칭 맵은 API가
 * 레거시 6종으로 동결했고(apps/api/src/admin/analytics-summary.service.ts의
 * FUNNEL_KEY_BY_EVENT_NAME) `byName`은 레지스트리에서 생성되어 항상 전 이벤트를 담는다.
 *
 * 라운드 61 #5: 그 앞에 **온보딩 4단**을 접두로 붙였다. 라운드 60 #9가 단계 진입을 계측했지만
 * 요약 API가 이벤트 이름 단위 집계뿐이라 네 단계의 합계밖에 없었고, 합계는 사람당 최대 4건이라
 * 퍼널의 단으로 넣으면 "완료 대비 25%" 같은 구조적으로 틀린 전환율이 됐다(그래서 라운드 60은
 * 퍼널 밖 카드에 배수로만 적었다). 이제 API가 `onboardingSteps`로 단계별 분해를 내려주므로
 * **한 단계는 한 실행에서 최대 1건**이 되어(모바일 step-ui.tsx의 실행당 1회 억제) 뒤의 단들과
 * 같은 단위가 된다 — 그래서 이제야 퍼널의 단이 될 수 있다. 접두 순서는 계약 순서 그대로다.
 */
const FUNNEL_STAGES: FunnelStage[] = [
  // 라운드 61 #5: 온보딩 4단 접두 — 퍼널의 1단이 "완료"라 그 앞의 이탈이 보이지 않던 사각지대.
  // 표가 이미 "1. / 2. …"로 번호를 붙이고 접두가 맨 앞이라, 라벨에 단계 번호를 또 적지 않는다
  // (그 두 번호는 계약 순서상 항상 같은 수다).
  ...ONBOARDING_STEPS.map((step) => ({
    key: `onboarding_step_${step.step}`,
    label: `온보딩 · ${step.label}`,
    count: (summary: AdminAnalyticsSummary) => onboardingStepCount(summary, step.step)
  })),
  { key: "onboarding_completed", label: "온보딩 완료", count: (summary) => eventCount(summary, "onboarding_completed") },
  { key: "expense_recorded", label: "지출 기록", count: (summary) => eventCount(summary, "expense_recorded") },
  { key: "item_status_changed", label: "준비템 체크", count: (summary) => eventCount(summary, "item_status_changed") },
  { key: "item_detail_viewed", label: "준비템 상세 열람", count: (summary) => eventCount(summary, "item_detail_viewed") },
  { key: "affiliate_link_clicked", label: "제휴 링크 클릭", count: (summary) => eventCount(summary, "affiliate_link_clicked") },
  { key: "purchase_followup_purchased", label: "구매 확인 응답 (샀어요)", count: (summary) => summary.purchaseFollowup.purchased }
];

/** ANA-128: 구매 확인 프롬프트의 3갈래. 라벨은 COM-108 프롬프트에 실제로 뜨는 문구 그대로. */
const PURCHASE_FOLLOWUP_ROWS: { key: keyof AdminPurchaseFollowupBreakdown; label: string; answer: string }[] = [
  { key: "purchased", label: "샀어요", answer: "purchased" },
  { key: "notPurchased", label: "아직이요", answer: "not_purchased" },
  { key: "dismissed", label: "괜찮아요", answer: "dismissed" }
];

const DAYS_OPTIONS: AnalyticsSummaryDays[] = [7, 30];

function eventLabel(name: string): string {
  return (ANALYTICS_EVENT_LABELS as Record<string, string | undefined>)[name] ?? ANA127_EVENT_LABELS[name] ?? name;
}

/** 기간 내 해당 이벤트 수. `byName`은 레지스트리 전 이름을 0건 포함해 담고 있으므로,
 * 목록에 없는 이름은 실제로 0건이다. */
function eventCount(summary: AdminAnalyticsSummary, eventName: string): number {
  return summary.byName.find((entry) => entry.name === eventName)?.count ?? 0;
}

/**
 * 라운드 61 S-2/S-5: 두 온보딩 단계 헬퍼(`onboardingStepCount` ·
 * `classifiedOnboardingStepTotal`)는 `src/lib/onboarding-steps-view.ts`로 옮겼다. 여기 지역
 * 함수로 있는 동안에는 소스 문자열 대조 테스트만이 그 동작을 지켰고(글자는 지키지만 동작은
 * 지키지 못한다), `onboardingSteps`가 없는 구버전 API 응답에서 페이지 전체가 오류 경계로
 * 떨어지는 무방비 읽기가 남아 있었다. 그 모듈이 두 문제를 함께 닫는다(근거는 그 파일 머리말).
 */

/**
 * 라운드 60 #9: 온보딩 **완료 1건당 단계 진입 수**.
 *
 * `onboarding_step_viewed`는 화면당 1건씩 쌓이므로(한 사람이 끝까지 가면 4건) 이 값은
 * 이탈이 없을 때 4.0에 가깝고, 중간에서 멈춘 사람이 많을수록 커진다. 퍼센트 전환율로 적으면
 * "진입 대비 완료 25%"처럼 **구조적으로 틀린 숫자**가 되므로 비율이 아니라 배수로 적는다.
 * 완료가 0이면 계산 불가("-") -- 0으로 나눠 무한대를 쓰거나 100%로 반올림하지 않는다.
 */
function stepsPerCompletion(stepViews: number, completions: number): string {
  if (completions <= 0) return "-";
  return `${(stepViews / completions).toFixed(1)}배`;
}

/** 직전 단계 대비 전환율(%). 직전 단계가 0이면 계산 불가("-"). */
function conversionRate(previous: number, current: number): string {
  if (previous <= 0) return "-";
  return `${((current / previous) * 100).toFixed(1)}%`;
}

/** ANA-128: 분류된 3갈래의 합 (미분류 제외 — API가 answer 없는 행은 어느 갈래에도 넣지 않는다). */
function classifiedFollowupTotal(followup: AdminPurchaseFollowupBreakdown): number {
  return followup.purchased + followup.notPurchased + followup.dismissed;
}

export default function AnalyticsSummaryPage() {
  const { session, clearSession } = useAdminSession();
  const [days, setDays] = useState<AnalyticsSummaryDays>(7);
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);

  const loadSummary = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    setLoading(true);
    try {
      const result = await getAdminAnalyticsSummary(days);
      setSummary(result);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError(loadErrorCopy(error, "분석 요약을 불러오지 못했어요."));
    } finally {
      setLoading(false);
    }
  }, [session, clearSession, days]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (!session) return null;

  const showLoading = loading && !loadError;
  const maxDaily = summary ? Math.max(1, ...summary.dailyTotals.map((entry) => entry.count)) : 1;
  // 라운드 86 트랙 D: 막대 라벨·표 행·최대치 문장을 형제 화면(클릭 통계)과 **같은 모듈**에서
  // 만든다. 종전 이 카드는 값을 `title`(마우스 호버)에만 줬고, 그래서 키보드·스크린리더에는
  // 어떤 경로로도 닿지 않았다 — 클릭 화면이 이미 갖고 있던 날짜·건수 표를 같은 형식으로 세운다.
  const trend = analyticsTrendView(summary?.dailyTotals ?? [], "건");

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>분석</h1>
        <p>앱에서 수집한 익명 분석 이벤트로 KPI 퍼널과 추이를 확인해요.</p>
      </div>

      <div className={styles.actions}>
        {DAYS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={days === option ? styles.primaryButton : styles.secondaryButton}
            aria-pressed={days === option}
            onClick={() => setDays(option)}
          >
            최근 {option}일
          </button>
        ))}
      </div>

      {showLoading ? <p className={styles.emptyState}>불러오는 중...</p> : null}
      {loadError ? (
        <p className={styles.errorBanner}>
          {loadError.message}
          {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 실패에는 이 버튼을 세우지 않는다. */}
          {loadError.canRetry ? (
            <button type="button" className={styles.retryButton} onClick={loadSummary}>
              다시 시도
            </button>
          ) : null}
        </p>
      ) : null}

      {summary ? (
        <>
          <section className={styles.card}>
            <h2>요약 (최근 {summary.days}일)</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <article style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>총 이벤트</p>
                <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                  {summary.totalEvents.toLocaleString("ko-KR")}건
                </p>
              </article>
              <article style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>순 사용자 (익명 ID 기준)</p>
                <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                  {summary.uniqueAnonUsers.toLocaleString("ko-KR")}명
                </p>
              </article>
            </div>
          </section>

          {/* 라운드 60 #9: KPI 퍼널 **바로 위**에 온보딩 단계 이탈을 둔다 -- 퍼널의 1단이
              "온보딩 완료"라, 그 앞에서 일어난 이탈은 퍼널 안에서는 영영 보이지 않는다.
              라운드 61 #5: 이 카드가 다루는 **합계**는 여전히 퍼널의 단이 아니다 -- 사람당
              최대 4건이라 "완료 대비 25%"처럼 구조적으로 틀린 전환율이 나온다(stepsPerCompletion
              주석). 퍼널로 옮겨간 것은 합계가 아니라 단계별 분해(onboardingSteps)이며, 그쪽은
              한 단계당 한 실행 1건이라 다른 단들과 단위가 같다. */}
          <section className={styles.card}>
            <h2>온보딩 단계 이탈 (퍼널 진입 전)</h2>
            {(() => {
              const stepViews = eventCount(summary, "onboarding_step_viewed");
              const completions = eventCount(summary, "onboarding_completed");
              // 라운드 61 #5: 4단계로 분류된 합과, 어느 단계에도 들어가지 못한 나머지.
              // byName 총계는 step이 없거나 알 수 없는 행까지 포함하므로 분류 합계보다 클 수 있다.
              const classifiedSteps = classifiedOnboardingStepTotal(summary);
              const unclassifiedSteps = Math.max(0, stepViews - classifiedSteps);
              return (
                <>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                    <article style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                      <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>단계 진입 (이벤트 수)</p>
                      <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                        {stepViews.toLocaleString("ko-KR")}건
                      </p>
                      <p style={{ color: "#7A7A7A", fontSize: 12, margin: "4px 0 0" }}>
                        온보딩 {ONBOARDING_STEP_COUNT}개 화면 진입의 합계예요
                      </p>
                    </article>
                    <article style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                      <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>온보딩 완료</p>
                      <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                        {completions.toLocaleString("ko-KR")}건
                      </p>
                      <p style={{ color: "#7A7A7A", fontSize: 12, margin: "4px 0 0" }}>
                        아래 퍼널의 {ONBOARDING_STEP_COUNT + 1}단과 같은 수예요
                      </p>
                    </article>
                    <article style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                      <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>완료 1건당 단계 진입</p>
                      <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                        {stepsPerCompletion(stepViews, completions)}
                      </p>
                      <p style={{ color: "#7A7A7A", fontSize: 12, margin: "4px 0 0" }}>
                        {ONBOARDING_STEP_COUNT}.0배에 가까울수록 이탈이 적어요
                      </p>
                    </article>
                  </div>
                  <p className={styles.hint}>
                    ※ 단계 진입은 화면마다 1건씩(사람당 최대 {ONBOARDING_STEP_COUNT}건) 쌓이는 이벤트 수라{" "}
                    <strong>사용자 수가 아니에요</strong>. 그래서 완료 대비 비율을 퍼센트 전환율로 적지 않고 배수로만
                    적어요 — 끝까지 간 사람만 있으면 {ONBOARDING_STEP_COUNT}.0배, 중간에서 멈춘 사람이 많을수록 커져요.
                  </p>
                  {/* 라운드 61 #5: 단계별 분해가 생겼으니 "아직 없어요"라던 옛 각주를 사실로 갱신한다. */}
                  <p className={styles.hint}>
                    ※ <strong>어느 단계에서</strong> 멈췄는지는 아래 KPI 퍼널의 앞 {ONBOARDING_STEP_COUNT}단에서 볼 수
                    있어요 — 요약 API가 이벤트 payload의 단계 값(<code>step</code>)별로 분해해 내려줘요. 단계 하나는 한 앱
                    실행에서 최대 1건이라 단계끼리는 같은 단위로 비교할 수 있어요(대신 앱을 다시 켜고 이어서 하면 다시
                    세므로 전환율이 100%를 넘을 수 있어요).
                  </p>
                  <p className={styles.hint}>
                    ※ 단계 값이 없거나 알 수 없는 이벤트({unclassifiedSteps.toLocaleString("ko-KR")}건)는 어느 단계에도
                    넣지 않아요 — 그래서 {ONBOARDING_STEP_COUNT}단계 합계({classifiedSteps.toLocaleString("ko-KR")}건)가
                    위 단계 진입 수({stepViews.toLocaleString("ko-KR")}건)보다 작을 수 있어요.
                  </p>
                  <p className={styles.hint}>
                    ※ 단계 진입은 <strong>통계 수집 동의(선택)를 켠 사용자만</strong> 계측돼요. 동의는 기본값이 꺼짐이고
                    로그인 화면에서 켜므로, 이 수는 실제 온보딩 진입의 <strong>하한</strong>이에요 — 단계 사이 비교에는
                    쓸 수 있지만 절대 수를 신규 사용자 수처럼 읽으면 안 돼요.
                  </p>
                </>
              );
            })()}
          </section>

          <section className={styles.card}>
            <h2>KPI 퍼널</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-label="KPI 퍼널 표">
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>이벤트 수</th>
                    <th>전 단계 대비 전환율</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNNEL_STAGES.map((stage, index) => {
                    const count = stage.count(summary);
                    const previous = index === 0 ? null : FUNNEL_STAGES[index - 1].count(summary);
                    return (
                      <tr key={stage.key}>
                        <td>
                          {index + 1}. {stage.label}
                        </td>
                        <td>{count.toLocaleString("ko-KR")}건</td>
                        <td>{previous === null ? "-" : conversionRate(previous, count)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className={styles.hint}>
              ※ 전환율은 사용자 단위 추적이 아니라 기간 내 이벤트 수 기반의 근사치예요. 참고: 같은 기간 앱 실행{" "}
              {summary.funnel.appOpened.toLocaleString("ko-KR")}건.
            </p>
            {/* 라운드 61 #5: 접두된 앞 4단은 뒤의 단들과 계측 조건이 다르다 — 그 차이를 표 옆에서 밝힌다. */}
            <p className={styles.hint}>
              ※ 앞 {ONBOARDING_STEP_COUNT}단(온보딩 단계)은 <strong>통계 수집 동의를 켠 사용자만</strong> 계측되고, 한
              단계당 앱 실행 1회에 최대 1건이에요 — 자세한 한계는 위 &quot;온보딩 단계 이탈&quot; 카드의 각주를 봐 주세요.
            </p>
            {/* ANA-128: 마지막 단계는 구매 확인 프롬프트에 "샀어요"로 답한 건수만 센다.
                (ANA-127 시점에는 요약 API가 이벤트 이름 단위 집계뿐이라 3갈래 합계를 보여주고
                각주로 그 사실을 밝혀야 했다.) 아래 "구매 확인 응답" 카드가 나머지 두 답변까지
                포함한 전체 분해를 보여준다. */}
            <p className={styles.hint}>
              ※ 마지막 단계는 구매 확인 프롬프트에 <strong>&quot;샀어요&quot;로 답한 건수만</strong> 세요 (아직이요·괜찮아요는
              제외). <strong>답이지 기록이 아니에요</strong> — &quot;샀어요&quot;는 기록 화면을 열 뿐이라, 그 화면을 닫으면
              답만 남고 지출은 없어요. 실제 구매 수는 지출 기록(2단)과 함께 봐 주세요.
            </p>
          </section>

          {/* ANA-128: 3갈래 분해. 응답률(클릭 대비 응답)과 구매율(클릭 대비 "샀어요")을 각각
              분리해서, 어느 쪽이 새는지 — 답을 안 하는 건지, 답은 하는데 안 사는 건지 — 보이게 한다. */}
          <section className={styles.card}>
            <h2 id="admin-analytics-purchase-followup-heading">구매 확인 응답 (링크 클릭 → 샀어요 응답)</h2>
            {(() => {
              const followup = summary.purchaseFollowup;
              const clicks = eventCount(summary, "affiliate_link_clicked");
              const classified = classifiedFollowupTotal(followup);
              // byName 총계는 answer가 없거나 알 수 없는 행까지 포함한 이벤트 수라, 분류 합계보다
              // 클 수 있다. 그 차이를 감추지 않고 "분류 불가"로 드러낸다.
              const answeredEvents = eventCount(summary, "purchase_followup_answered");
              const unclassified = Math.max(0, answeredEvents - classified);
              return (
                <>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                    <article style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                      <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>응답률 (클릭 대비 응답)</p>
                      <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>{conversionRate(clicks, classified)}</p>
                      <p style={{ color: "#7A7A7A", fontSize: 12, margin: "4px 0 0" }}>
                        응답 {classified.toLocaleString("ko-KR")}건 / 클릭 {clicks.toLocaleString("ko-KR")}건
                      </p>
                    </article>
                    <article style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                      <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>구매율 (클릭 대비 샀어요)</p>
                      <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                        {conversionRate(clicks, followup.purchased)}
                      </p>
                      <p style={{ color: "#7A7A7A", fontSize: 12, margin: "4px 0 0" }}>
                        샀어요 {followup.purchased.toLocaleString("ko-KR")}건 / 클릭 {clicks.toLocaleString("ko-KR")}건
                      </p>
                    </article>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table} aria-labelledby="admin-analytics-purchase-followup-heading">
                      <thead>
                        <tr>
                          <th>답변</th>
                          <th>이름</th>
                          <th>건수</th>
                          <th>응답 중 비중</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PURCHASE_FOLLOWUP_ROWS.map((row) => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td>
                              <code>{row.answer}</code>
                            </td>
                            <td>{followup[row.key].toLocaleString("ko-KR")}건</td>
                            <td>{conversionRate(classified, followup[row.key])}</td>
                          </tr>
                        ))}
                        {unclassified > 0 ? (
                          <tr key="unclassified">
                            <td>분류 불가</td>
                            <td>
                              <code>-</code>
                            </td>
                            <td>{unclassified.toLocaleString("ko-KR")}건</td>
                            <td>-</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <p className={styles.hint}>
                    ※ 답변별 분해는 이벤트 payload의 <code>answer</code> 값을 그대로 센 값이에요. 답변이 없거나 알 수 없는
                    값인 이벤트({unclassified.toLocaleString("ko-KR")}건)는 어느 갈래에도 넣지 않고 &quot;분류 불가&quot;로만
                    표시해요 — 그래서 3갈래 합계({classified.toLocaleString("ko-KR")}건)가 이벤트별 카운트의{" "}
                    <code>purchase_followup_answered</code>({answeredEvents.toLocaleString("ko-KR")}건)보다 작을 수 있어요.
                  </p>
                  <p className={styles.hint}>
                    ※ 응답률·구매율도 사용자 단위 추적이 아니라 같은 기간 안의 이벤트 수 비율이라 근사치예요. 클릭한 뒤
                    프롬프트가 다음 앱 실행에 뜨는 구조라 기간 경계를 넘는 응답은 다른 기간에 잡힐 수 있어요.
                  </p>
                </>
              );
            })()}
          </section>

          <section className={styles.card}>
            <h2 id="admin-analytics-event-count-heading">이벤트별 카운트</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-labelledby="admin-analytics-event-count-heading">
                <thead>
                  <tr>
                    <th>이벤트</th>
                    <th>이름</th>
                    <th>수</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 레지스트리 이름(admin-api.ts의 미러)은 0건이어도 항상 표시하고, 그 외 이름이
                      오면 뒤에 덧붙인다 — 그 미러 **뒤에 append된 레지스트리 이름 전부**가 이 경로로
                      들어오고 라벨은 ANA127_EVENT_LABELS가 채운다(둘의 합집합이 레지스트리 전부와
                      같은지는 src/admin-canonical-mirrors.test.ts가 센다 — 숫자를 여기 적지 않는다). */}
                  {[
                    ...ANALYTICS_EVENT_NAMES.map(
                      (name) => summary.byName.find((entry) => entry.name === name) ?? { name, count: 0 }
                    ),
                    ...summary.byName.filter((entry) => !(ANALYTICS_EVENT_NAMES as string[]).includes(entry.name))
                  ].map((entry) => (
                    <tr key={entry.name}>
                      <td>{eventLabel(entry.name)}</td>
                      <td>
                        <code>{entry.name}</code>
                      </td>
                      <td>{entry.count.toLocaleString("ko-KR")}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <h2>일별 추이</h2>
            <div
              role="img"
              aria-label={`최근 ${summary.days}일 일별 이벤트 수 막대 그래프`}
              style={{ alignItems: "flex-end", display: "flex", gap: 2, height: 120 }}
            >
              {trend.bars.map((entry) => (
                <div
                  key={entry.date}
                  title={entry.label}
                  style={{
                    background: entry.count > 0 ? "#F29B76" : "#EFE5DB",
                    borderRadius: 2,
                    flex: 1,
                    height: `${Math.max(entry.count > 0 ? 4 : 2, Math.round((entry.count / maxDaily) * 100))}%`
                  }}
                />
              ))}
            </div>
            <div style={{ color: "#7A7A7A", display: "flex", fontSize: 12, justifyContent: "space-between", marginTop: 4 }}>
              <span>{summary.dailyTotals[0]?.date}</span>
              <span>{summary.dailyTotals[summary.dailyTotals.length - 1]?.date}</span>
            </div>
            {/* 라운드 86 트랙 D: 막대의 `title`은 마우스에만 열리는 경로였다 — 형제 화면(클릭
                통계)이 이미 쓰던 날짜·건수 표를 같은 모듈에서 세워 값을 텍스트로 남긴다.
                뒤집는 순서도, 그릴 수 없는 점을 표에서 빼고 그 사실을 아래 고지 한 줄로 말하는
                것도 그 모듈의 판정이다(라운드 86 리뷰 M-2 — 표를 말없이 지우지 않는다). */}
            {trend.showTable ? (
              <div className={styles.tableWrap}>
                <table className={styles.table} aria-label={`최근 ${summary.days}일 일별 이벤트 수 표`}>
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>이벤트 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.rows.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{row.countText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {/* 라운드 86 리뷰 M-2: 표에서 뺀 점이 있으면 표를 지우는 대신 그 사실을 한 줄로 말한다
                (정상 응답에서는 `null`이라 이 줄이 서지 않는다). */}
            {trend.omissionNotice ? <p className={styles.hint}>{trend.omissionNotice}</p> : null}
            {/* 전부 0건인 기간에는 이 문장이 서지 않는다(아무 일도 없던 날을 봉우리로 만들지 않는다). */}
            {trend.peakSentence ? <p className={styles.hint}>{trend.peakSentence}</p> : null}
            {/* 라운드 86 리뷰 L-11: 표가 선 뒤에도 "마우스를 올리면"만 적어 두면, 그 경로가 없는
                운영자(키보드·스크린리더)에게 이 카드는 여전히 마우스 전용으로 읽힌다. 표가 있을
                때는 표를 가리키고, 표가 서지 못한 응답에서만 종전 문장이 남는다. */}
            <p className={styles.hint}>
              {trend.showTable
                ? "날짜별 이벤트 수는 위 표에서 볼 수 있어요. (막대에 마우스를 올려도 같은 값이 떠요 · 서울 기준 날짜)"
                : "막대에 마우스를 올리면 날짜별 이벤트 수를 볼 수 있어요. (서울 기준 날짜)"}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
