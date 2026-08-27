"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CLICK_SUMMARY_DAYS_OPTIONS,
  PRODUCT_PLATFORM_LABELS,
  getAffiliateClickSummary,
  isAuthError,
  type ClickSummary,
  type ClickSummaryDays
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

function platformLabel(platform: string | null): string {
  if (platform === null) return "-";
  return (PRODUCT_PLATFORM_LABELS as Record<string, string | undefined>)[platform] ?? platform;
}

export default function ClickSummaryPage() {
  const { session, clearSession } = useAdminSession();
  const [days, setDays] = useState<ClickSummaryDays>(7);
  const [summary, setSummary] = useState<ClickSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const result = await getAffiliateClickSummary(days);
      setSummary(result);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError("클릭 통계를 불러오지 못했어요.");
    }
  }, [session, clearSession, days]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (!session) return null;

  // 막대 높이 기준값. 전부 0건이어도 0으로 나누지 않도록 최소 1.
  const maxDaily = summary ? Math.max(1, ...summary.dailyTotals.map((entry) => entry.count)) : 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>클릭 통계</h1>
        <p>제휴 상품 링크 클릭 수를 플랫폼·상품 링크·날짜별로 확인해요.</p>
      </div>

      <div className={styles.actions}>
        {CLICK_SUMMARY_DAYS_OPTIONS.map((option) => (
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

      <section className={styles.card}>
        <h2>전체 클릭 수</h2>
        {summary === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
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
            <p>{summary.totalClicks.toLocaleString("ko-KR")}회</p>
            <p className={styles.hint}>
              최근 {summary.days}일: {summary.windowTotalClicks.toLocaleString("ko-KR")}회 (아래 상위 링크·일별
              추이는 이 기간 기준이에요.)
            </p>
          </>
        ) : null}
      </section>

      {summary ? (
        <>
          <section className={styles.card}>
            <h2>플랫폼별 클릭 수</h2>
            {summary.byPlatform.length === 0 ? (
              <p className={styles.emptyState}>아직 집계된 클릭이 없어요.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>플랫폼</th>
                      <th>클릭 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byPlatform.map((entry) => (
                      <tr key={entry.platform}>
                        <td>{platformLabel(entry.platform)}</td>
                        <td>{entry.count.toLocaleString("ko-KR")}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.hint}>※ 전체 클릭 수와 플랫폼별 수치는 전체 기간 누적이에요.</p>
          </section>

          <section className={styles.card}>
            <h2>상위 상품 링크 (최근 {summary.days}일)</h2>
            {summary.topLinks.length === 0 ? (
              <p className={styles.emptyState}>이 기간에 집계된 클릭이 없어요.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>준비템</th>
                      <th>링크 제목</th>
                      <th>리테일러</th>
                      <th>클릭 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topLinks.map((entry, index) => (
                      <tr key={entry.productLinkId}>
                        <td>{index + 1}</td>
                        <td>{entry.itemTemplateName ?? "(삭제된 준비템)"}</td>
                        <td>{entry.productLinkTitle ?? "(삭제된 링크)"}</td>
                        <td>{platformLabel(entry.platform)}</td>
                        <td>{entry.count.toLocaleString("ko-KR")}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* DNC-009: 이 표는 열람용 집계일 뿐 추천 순서·점수와 무관하다. */}
            <p className={styles.hint}>
              ※ 클릭 수가 많은 순서예요. 이 순위는 앱의 추천 순서나 추천 점수에 반영되지 않아요.
            </p>
          </section>

          <section className={styles.card}>
            <h2>일별 추이 (최근 {summary.days}일)</h2>
            <div
              role="img"
              aria-label={`최근 ${summary.days}일 일별 클릭 수 막대 그래프`}
              style={{ alignItems: "flex-end", display: "flex", gap: 2, height: 120 }}
            >
              {summary.dailyTotals.map((entry) => (
                <div
                  key={entry.date}
                  title={`${entry.date}: ${entry.count.toLocaleString("ko-KR")}회`}
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
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>클릭 수</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 최근 날짜가 위로 오게 뒤집어서 보여준다(막대는 시간순 그대로). */}
                  {[...summary.dailyTotals].reverse().map((entry) => (
                    <tr key={entry.date}>
                      <td>{entry.date}</td>
                      <td>{entry.count.toLocaleString("ko-KR")}회</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.hint}>막대에 마우스를 올리면 날짜별 클릭 수를 볼 수 있어요. (서울 기준 날짜)</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
