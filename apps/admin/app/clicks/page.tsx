"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLICK_SUMMARY_DAYS_OPTIONS,
  PRODUCT_PLATFORM_LABELS,
  getAffiliateClickSummary,
  isAuthError,
  type ClickSummary,
  type ClickSummaryDays
} from "../../src/lib/admin-api";
import { loadErrorCopy, type LoadErrorCopy } from "../../src/lib/load-error-copy";
import { analyticsTrendView } from "../../src/lib/analytics-trend-view";
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
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);
  // FIX/F6: 기간 토글을 빠르게 누르면 먼저 보낸 요청이 나중에 도착할 수 있다. 마지막 요청만
  // 화면에 반영해 버튼(aria-pressed)과 표 제목("최근 N일")이 어긋나지 않게 한다.
  const requestSeq = useRef(0);

  const loadSummary = useCallback(async () => {
    if (!session) return;
    const seq = ++requestSeq.current;
    setLoadError(null);
    setLoading(true);
    // FIX/F6: 이전 기간의 집계를 남겨두면 로딩 동안 "최근 30일" 버튼이 눌린 채 표에는
    // 최근 7일 데이터가 보인다 -- 새 창을 받을 때까지 이전 데이터를 감춘다.
    setSummary(null);
    try {
      const result = await getAffiliateClickSummary(days);
      if (requestSeq.current !== seq) return;
      setSummary(result);
    } catch (error) {
      if (requestSeq.current !== seq) return;
      setSummary(null);
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError(loadErrorCopy(error, "클릭 통계를 불러오지 못했어요."));
    } finally {
      if (requestSeq.current === seq) setLoading(false);
    }
  }, [session, clearSession, days]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (!session) return null;

  // 막대 높이 기준값. 전부 0건이어도 0으로 나누지 않도록 최소 1.
  const maxDaily = summary ? Math.max(1, ...summary.dailyTotals.map((entry) => entry.count)) : 1;
  // 라운드 86 트랙 D: 막대 라벨·표 행을 형제 화면(분석)과 **같은 모듈**에서 만든다.
  // 그려지는 글자는 종전과 바이트 단위로 같다 — 바뀐 것은 어디서 값을 만드는가뿐이다.
  const trend = analyticsTrendView(summary?.dailyTotals ?? [], "회");

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
        {loading ? <p className={styles.emptyState}>불러오는 중...</p> : null}
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
            {/* 최근 날짜가 위로 오게 뒤집는 것도, 그릴 수 없는 점을 표에서 빼고 그 사실을 아래
                고지 한 줄로 말하는 것도 analytics-trend-view.ts의 판정이다(막대는 시간순 그대로). */}
            {trend.showTable ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>클릭 수</th>
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
            {/* 라운드 86 리뷰 M-2: 이 화면의 글자는 **정상 응답에서** 종전과 바이트 단위로 같다 —
                이 한 줄은 표에서 뺀 점이 있는 응답에서만 선다(그때 표만 짧아지고 아무 말도 없으면
                운영자가 없는 날을 있다고 읽는다). */}
            {trend.omissionNotice ? <p className={styles.hint}>{trend.omissionNotice}</p> : null}
            <p className={styles.hint}>막대에 마우스를 올리면 날짜별 클릭 수를 볼 수 있어요. (서울 기준 날짜)</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
