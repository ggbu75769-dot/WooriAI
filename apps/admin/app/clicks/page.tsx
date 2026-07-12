"use client";

import { useCallback, useEffect, useState } from "react";
import { PRODUCT_PLATFORM_LABELS, getAffiliateClickSummary, isAuthError, type ClickSummary } from "../../src/lib/admin-api";
import { useAdminToken } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

function platformLabel(platform: string): string {
  return (PRODUCT_PLATFORM_LABELS as Record<string, string | undefined>)[platform] ?? platform;
}

export default function ClickSummaryPage() {
  const { token, clearToken } = useAdminToken();
  const [summary, setSummary] = useState<ClickSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const result = await getAffiliateClickSummary(token);
      setSummary(result);
    } catch (error) {
      if (isAuthError(error)) {
        clearToken();
        return;
      }
      setLoadError("클릭 통계를 불러오지 못했어요.");
    }
  }, [token, clearToken]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (!token) return null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>클릭 통계</h1>
        <p>제휴 상품 링크 클릭 수를 플랫폼별로 확인해요.</p>
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
        {summary ? <p>{summary.totalClicks.toLocaleString("ko-KR")}회</p> : null}
      </section>

      {summary ? (
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
        </section>
      ) : null}
    </div>
  );
}
