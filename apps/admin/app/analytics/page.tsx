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
  report_share_tapped: "리포트 공유"
};

type FunnelStage = {
  /** 단계 식별자(React key). 이벤트 이름이 아니라 단계 이름 — 마지막 단은 이벤트 전체가
   * 아니라 그 이벤트의 한 답변만 센다. */
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
 * 집계해 3갈래(샀어요·아직이요·괜찮아요) 합계밖에 없었고, 그 합계로 낸 전환율은 실제 구매
 * 전환율보다 부풀려졌다. 이제 API가 `purchaseFollowup`으로 답변별 분해를 내려주므로 마지막
 * 단계 전환율 = 링크 클릭 → 실구매다.
 *
 * 이벤트 이름 단위 단계는 `funnel` 별칭이 아니라 `byName`에서 읽는다 — 별칭 맵은 API가
 * 레거시 6종으로 동결했고(apps/api/src/admin/analytics-summary.service.ts의
 * FUNNEL_KEY_BY_EVENT_NAME) `byName`은 레지스트리에서 생성되어 항상 전 이벤트를 담는다.
 */
const FUNNEL_STAGES: FunnelStage[] = [
  { key: "onboarding_completed", label: "온보딩 완료", count: (summary) => eventCount(summary, "onboarding_completed") },
  { key: "expense_recorded", label: "지출 기록", count: (summary) => eventCount(summary, "expense_recorded") },
  { key: "item_status_changed", label: "준비템 체크", count: (summary) => eventCount(summary, "item_status_changed") },
  { key: "item_detail_viewed", label: "준비템 상세 열람", count: (summary) => eventCount(summary, "item_detail_viewed") },
  { key: "affiliate_link_clicked", label: "제휴 링크 클릭", count: (summary) => eventCount(summary, "affiliate_link_clicked") },
  { key: "purchase_followup_purchased", label: "구매 확인 (구매했어요)", count: (summary) => summary.purchaseFollowup.purchased }
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
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError("분석 요약을 불러오지 못했어요.");
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
          {loadError}
          <button type="button" className={styles.retryButton} onClick={loadSummary}>
            다시 시도
          </button>
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

          <section className={styles.card}>
            <h2>KPI 퍼널</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
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
            {/* ANA-128: 마지막 단계는 구매 확인 프롬프트에 "샀어요"로 답한 건수만 센다.
                (ANA-127 시점에는 요약 API가 이벤트 이름 단위 집계뿐이라 3갈래 합계를 보여주고
                각주로 그 사실을 밝혀야 했다.) 아래 "구매 확인 응답" 카드가 나머지 두 답변까지
                포함한 전체 분해를 보여준다. */}
            <p className={styles.hint}>
              ※ 마지막 단계는 구매 확인 프롬프트에 <strong>&quot;샀어요&quot;로 답한 건수만</strong> 세요 (아직이요·괜찮아요는
              제외). 그래서 마지막 전환율이 곧 링크 클릭 → 실구매 비율이에요.
            </p>
          </section>

          {/* ANA-128: 3갈래 분해. 응답률(클릭 대비 응답)과 구매율(클릭 대비 "샀어요")을 각각
              분리해서, 어느 쪽이 새는지 — 답을 안 하는 건지, 답은 하는데 안 사는 건지 — 보이게 한다. */}
          <section className={styles.card}>
            <h2>구매 확인 응답 (링크 클릭 → 실구매)</h2>
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
                    <table className={styles.table}>
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
            <h2>이벤트별 카운트</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>이벤트</th>
                    <th>이름</th>
                    <th>수</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 레지스트리 이름(admin-api.ts의 6종 미러)은 0건이어도 항상 표시하고, 그 외 이름이
                      오면 뒤에 덧붙인다 — ANA-127이 더한 두 이벤트가 이 경로로 들어오고, 라벨은
                      ANA127_EVENT_LABELS가 채운다. */}
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
              {summary.dailyTotals.map((entry) => (
                <div
                  key={entry.date}
                  title={`${entry.date}: ${entry.count.toLocaleString("ko-KR")}건`}
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
            <p className={styles.hint}>막대에 마우스를 올리면 날짜별 이벤트 수를 볼 수 있어요. (서울 기준 날짜)</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
