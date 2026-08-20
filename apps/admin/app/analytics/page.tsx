"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ANALYTICS_EVENT_LABELS,
  ANALYTICS_EVENT_NAMES,
  getAdminAnalyticsSummary,
  isAuthError,
  type AdminAnalyticsFunnel,
  type AdminAnalyticsSummary,
  type AnalyticsSummaryDays
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

// ADM-009: KPI 퍼널 (docs/5차 설계 문서 §4.3) — 온보딩 완료 → 지출 기록 →
// 준비템 체크 → 제휴 링크 클릭. 각 단계 수와 직전 단계 대비 전환율을 보여준다.
const FUNNEL_STAGES: { key: keyof AdminAnalyticsFunnel; label: string }[] = [
  { key: "onboardingCompleted", label: "온보딩 완료" },
  { key: "expenseRecorded", label: "지출 기록" },
  { key: "itemStatusChanged", label: "준비템 체크" },
  { key: "affiliateLinkClicked", label: "제휴 링크 클릭" }
];

const DAYS_OPTIONS: AnalyticsSummaryDays[] = [7, 30];

function eventLabel(name: string): string {
  return (ANALYTICS_EVENT_LABELS as Record<string, string | undefined>)[name] ?? name;
}

/** 직전 단계 대비 전환율(%). 직전 단계가 0이면 계산 불가("-"). */
function conversionRate(previous: number, current: number): string {
  if (previous <= 0) return "-";
  return `${((current / previous) * 100).toFixed(1)}%`;
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
                    const count = summary.funnel[stage.key];
                    const previous = index === 0 ? null : summary.funnel[FUNNEL_STAGES[index - 1].key];
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
                  {/* 6종 고정: 레지스트리 이름은 0건이어도 항상 표시하고, 그 외 이름이 오면 뒤에 덧붙인다. */}
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
