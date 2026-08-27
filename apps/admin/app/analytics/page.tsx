"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ANALYTICS_EVENT_LABELS,
  ANALYTICS_EVENT_NAMES,
  getAdminAnalyticsSummary,
  isAuthError,
  type AdminAnalyticsSummary,
  type AnalyticsSummaryDays
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

/**
 * ANA-127: registry 이벤트 이름 중 admin-api.ts의 6종 미러가 작성된 뒤 추가된 것들.
 * API 응답의 `byName`은 계약 레지스트리(packages/contracts/src/analytics.ts)에서 생성되므로
 * 이 두 이름도 0건 포함해 이미 내려온다 — 여기서는 한국어 라벨만 보탠다.
 */
const ANA127_EVENT_LABELS: Record<string, string> = {
  item_detail_viewed: "준비템 상세 열람",
  purchase_followup_answered: "구매 확인 응답"
};

/**
 * ADM-009 + ANA-127: KPI 퍼널 (docs/5차 설계 문서 §4.3). 원래 4단
 * (온보딩 완료 → 지출 기록 → 준비템 체크 → 제휴 링크 클릭)이었지만 준비템 체크와 링크 클릭
 * 사이가 통째로 비어 있어 전환율이 읽히지 않았다. ANA-127이 상세 열람과 구매 확인 응답을
 * 계측하면서 구매 루프가 6단으로 이어진다.
 *
 * 단계 수는 `funnel` 별칭이 아니라 `byName`에서 읽는다 — 별칭 맵은 API가 하드코딩하고 있어
 * (apps/api/src/admin/analytics-summary.service.ts의 FUNNEL_KEY_BY_EVENT_NAME) 새 이벤트에
 * 대한 키가 아직 없는 반면, `byName`은 레지스트리에서 생성되어 항상 전 이벤트를 담는다.
 */
const FUNNEL_STAGES: { eventName: string; label: string }[] = [
  { eventName: "onboarding_completed", label: "온보딩 완료" },
  { eventName: "expense_recorded", label: "지출 기록" },
  { eventName: "item_status_changed", label: "준비템 체크" },
  { eventName: "item_detail_viewed", label: "준비템 상세 열람" },
  { eventName: "affiliate_link_clicked", label: "제휴 링크 클릭" },
  { eventName: "purchase_followup_answered", label: "구매 확인 응답" }
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
                    const count = eventCount(summary, stage.eventName);
                    const previous = index === 0 ? null : eventCount(summary, FUNNEL_STAGES[index - 1].eventName);
                    return (
                      <tr key={stage.eventName}>
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
            {/* ANA-127: 마지막 단계는 "샀어요"만이 아니라 프롬프트에 답한 3갈래
                (샀어요/아직이요/괜찮아요)를 모두 센다. 요약 API가 이벤트 이름 단위로만 집계해
                payload의 answer를 나눠 보지 못하기 때문인데, 이걸 "구매"라고 부르면 구매
                전환율을 부풀리게 된다 — 그래서 이름과 각주로 있는 그대로 밝힌다. */}
            <p className={styles.hint}>
              ※ 마지막 단계는 구매 확인 프롬프트에 답한 건수(샀어요·아직이요·괜찮아요 합계)예요. 답변별 분해는 아직
              집계하지 않으니 이 수를 구매 건수로 읽지 마세요.
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
