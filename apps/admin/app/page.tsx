"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../src/components/admin-page.module.css";
import { getAdminDashboardSummary, isAuthError, type AdminDashboardSummary } from "../src/lib/admin-api";
import { useAdminSession } from "../src/lib/admin-token-context";

// ADM-008: 대시보드 요약 카드에 표시할 지표와 한국어 라벨 (렌더링 순서 고정).
const SUMMARY_CARDS: { key: keyof AdminDashboardSummary; label: string }[] = [
  { key: "activeUsers", label: "활성 사용자" },
  { key: "households", label: "가구" },
  { key: "childrenCount", label: "등록된 아이" },
  { key: "expensesTotal", label: "누적 지출 기록" },
  { key: "affiliateClicks7d", label: "최근 7일 제휴 클릭" },
  { key: "analyticsEvents7d", label: "최근 7일 분석 이벤트" },
  { key: "pendingContentRevisions", label: "검수 대기 콘텐츠" },
  { key: "productLinksBrokenCount", label: "깨진 상품 링크" }
];

export default function AdminHomePage() {
  const { session, clearSession } = useAdminSession();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const result = await getAdminDashboardSummary();
      setSummary(result);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError("대시보드 요약을 불러오지 못했어요.");
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const sections = [
    {
      id: "ADM-002",
      title: "Item templates",
      description: "Create and update preparation items, including required skip copy for non-essential items.",
      href: "/items"
    },
    {
      id: "ADM-003",
      title: "Product links",
      description: "Manage product URLs, affiliate flags, sponsored markers, and CTA-adjacent disclosure overrides.",
      href: "/links"
    },
    {
      id: "ADM-004",
      title: "Disclosures",
      description: "Update affiliate, sponsored, and nutrition/supplement policy copy without a mobile app deploy.",
      href: "/disclosures"
    },
    {
      id: "ADM-004",
      title: "Click summary",
      description: "Review affiliate click totals by platform from the admin analytics endpoint.",
      href: "/clicks"
    },
    {
      id: "ADM-005",
      title: "Content review",
      description: "Review editor-submitted drafts, diff against the live copy, and approve, reject, or roll back.",
      href: "/reviews"
    },
    {
      id: "ADM-006",
      title: "Admin accounts",
      description: "Create admin users, change roles, and deactivate accounts (admin role only).",
      href: "/users"
    }
  ];

  if (!session) return null;

  return (
    <main style={{ background: "#FFF8F1", color: "#242424", minHeight: "100vh", padding: 32 }}>
      <p style={{ color: "#7A7A7A" }}>ADM-001</p>
      <h1>WooriAI Admin CMS</h1>

      <section style={{ background: "#FFFFFF", borderRadius: 8, marginBottom: 20, padding: 20 }}>
        <h2>운영 현황 요약</h2>
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
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {SUMMARY_CARDS.map((card) => (
              <article
                key={card.key}
                style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}
              >
                <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>{card.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                  {summary[card.key].toLocaleString("ko-KR")}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section style={{ background: "#FFFFFF", borderRadius: 8, marginBottom: 20, padding: 20 }}>
        <h2>Admin authentication</h2>
        <p>세션 쿠키 + CSRF + TOTP MFA 기반 인증이 적용되어 있습니다. 레거시 x-admin-token 헤더는 개발/테스트 환경 전용이며 프로덕션에서는 차단됩니다.</p>
      </section>
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {sections.map((section) => (
          <article key={`${section.id}-${section.title}`} style={{ background: "#FFFFFF", borderRadius: 8, padding: 20 }}>
            <p style={{ color: "#7A7A7A" }}>{section.id}</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <Link href={section.href}>바로가기</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
