"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../src/components/admin-page.module.css";
import {
  getAdminDashboardSummary,
  getWorkerHealth,
  isAuthError,
  type AdminDashboardSummary,
  type AdminRole,
  type WorkerHealth
} from "../src/lib/admin-api";
import { catalogSizeCaption } from "../src/lib/catalog-size-view";
import { loadErrorCopy, type LoadErrorCopy } from "../src/lib/load-error-copy";
import {
  WORKER_HEALTH_STATE_LABELS,
  brokenLinkCountCaption,
  formatWorkerLastTick,
  linkHealthCheckLine,
  workerHealthState,
  workerHealthStateNote
} from "../src/lib/worker-health-view";
import { useAdminSession } from "../src/lib/admin-token-context";

/**
 * ADM-008: 대시보드 요약 카드에 표시할 지표와 한국어 라벨 (렌더링 순서 고정).
 *
 * UX-X C5: `href`가 있는 카드는 그 숫자를 만든 목록으로 바로 넘어간다 — 종전에는
 * "깨진 상품 링크 3"을 보고도 어느 링크인지 찾으려면 링크 화면에서 다시 필터를
 * 걸어야 했다. 링크 대상 화면은 쿼리 파라미터로 초기 필터를 받는다
 * (link-filters.ts / revision-rows.ts의 *FromSearchParams).
 */
const SUMMARY_CARDS: { key: keyof AdminDashboardSummary; label: string; href?: string }[] = [
  { key: "activeUsers", label: "활성 사용자" },
  { key: "households", label: "가구" },
  { key: "childrenCount", label: "등록된 아이" },
  { key: "expensesTotal", label: "누적 지출 기록" },
  { key: "affiliateClicks7d", label: "최근 7일 제휴 클릭" },
  { key: "analyticsEvents7d", label: "최근 7일 분석 이벤트" },
  { key: "pendingContentRevisions", label: "검수 대기 콘텐츠", href: "/reviews?status=in_review" },
  // 라운드 44 리뷰 N-5: `active=1`을 함께 넘긴다. 이 카드의 숫자는 서버가 활성 링크
  // 안에서만 센 값인데(dashboard-summary.service.ts) 목록은 비활성까지 보여 줘서,
  // 카드의 수와 넘어간 목록의 줄 수가 어긋났다. 목록도 같은 모집단으로 열린다.
  { key: "productLinksBrokenCount", label: "깨진 상품 링크", href: "/links?health=broken&active=1" },
  // 라운드 83 트랙 C: 카탈로그의 크기. ⚠️ **`href`가 없는 것이 판정이다** — 이 수의 모집단은
  // `active=true` 전수인데 준비템 목록 화면의 모집단이 그것과 같다고 말할 수 없어, 넘어간
  // 목록의 줄 수가 카드의 수와 어긋난다(라운드 44 N-5가 깨진 링크 카드에서 겪은 그 어긋남).
  { key: "itemTemplatesActiveCount", label: "활성 준비템" }
];

/**
 * 대시보드 바로가기 카드. 라벨은 AdminShell의 상단 내비게이션과 같은 한국어 문구를
 * 쓴다 — 같은 화면을 두 곳에서 다른 이름으로 부르지 않기 위해서다.
 *
 * `roles` 생략 = 로그인한 모든 역할에 노출. AdminShell(NAV_ITEMS)과 같은 관례로,
 * API가 admin 전용인 화면은 editor/analyst 세션에서 카드도 숨긴다 — 내비에는 없는
 * 링크가 대시보드 카드로만 남아 403으로 이어지던 불일치를 없앤다.
 *
 * 화면 ID: DNC-004가 잠근 표(docs/dev/source-lock.md §7)에는 ADM-001~004만 있다. 그 이후
 * 화면의 채번 규칙은 두 갈래다 — ⓐ 그 화면을 만든 티켓 ID가 있으면 그대로 재사용하고
 * (ADM-005 콘텐츠 검토, ADM-006 관리자 계정, ADM-009 분석, ADM-113 감사 로그),
 * ⓑ 전용 티켓 ID가 없는 화면만 다음 번호를 채번한다. 클릭 통계가 ⓑ에 해당해 종전에
 * ADM-004(= 고지/정책 문구 관리)를 잘못 달고 있었고, 비어 있던 다음 번호 ADM-010을 부여했다
 * — 잠긴 ID를 바꾸는 것이 아니라 비어 있던 ID를 채우는 것이다. 현황표는 source-lock.md §7-1.
 */
const SECTION_CARDS: Array<{
  id: string;
  title: string;
  description: string;
  href: string;
  roles?: AdminRole[];
}> = [
  {
    id: "ADM-002",
    title: "준비템 관리",
    description: "시기별 준비템을 추가·수정해요. 필수가 아닌 항목은 '안 사도 되는 이유' 안내 문구가 반드시 필요해요.",
    href: "/items"
  },
  {
    id: "ADM-003",
    title: "상품 링크 관리",
    description: "상품 URL, 제휴·스폰서 표시, 링크별 고지 문구 예외를 관리해요.",
    href: "/links"
  },
  {
    id: "ADM-004",
    title: "제휴 고지 문구",
    description: "제휴·스폰서·영양제 고지 문구를 앱 배포 없이 바로 수정해요.",
    href: "/disclosures"
  },
  {
    id: "ADM-005",
    title: "콘텐츠 검토",
    description: "에디터가 올린 초안을 현재 라이브 문구와 비교해 승인·반려하거나 되돌려요.",
    href: "/reviews"
  },
  {
    id: "ADM-010",
    title: "클릭 통계",
    description: "플랫폼별 제휴 클릭 수를 확인해요.",
    href: "/clicks"
  },
  {
    id: "ADM-009",
    title: "분석",
    description: "핵심 루프 이벤트와 KPI 퍼널을 기간별로 확인해요.",
    href: "/analytics"
  },
  {
    id: "ADM-006",
    title: "관리자 계정",
    description: "관리자 계정을 만들고 역할을 바꾸거나 비활성화해요. (admin 전용)",
    href: "/users",
    roles: ["admin"]
  },
  {
    id: "ADM-113",
    title: "감사 로그",
    description: "관리자 작업 이력을 조건별로 조회하고 CSV로 내려받아요. (admin 전용)",
    href: "/audit-logs",
    roles: ["admin"]
  }
];

export default function AdminHomePage() {
  const { session, clearSession } = useAdminSession();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);
  const [worker, setWorker] = useState<WorkerHealth | null>(null);
  const [workerError, setWorkerError] = useState<LoadErrorCopy | null>(null);

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
      // 라운드 73 트랙 D: 왜 못 불러왔는지는 admin-api.ts가 이미 알고 있다 —
      // 그 문장을 받고, 못 받았을 때만 종전 기본문장으로 물러선다.
      setLoadError(loadErrorCopy(error, "대시보드 요약을 불러오지 못했어요."));
    }
  }, [session, clearSession]);

  // UX-X C5: 워커 상태는 무인증 공개 엔드포인트라 세션과 무관하게 실패해도 로그아웃
  // 처리를 하지 않는다 — 요약 카드와 독립적으로 실패/재시도한다.
  const loadWorker = useCallback(async () => {
    if (!session) return;
    setWorkerError(null);
    try {
      setWorker(await getWorkerHealth());
    } catch (error) {
      // 라운드 73 트랙 D: 종전에는 `catch {}`로 값 자체를 받지 않아 "상태를 확인하지
      // 못했어요." 한 문장만 남았다 — 이유는 여기서 이미 손에 있었다.
      setWorker(null);
      setWorkerError(loadErrorCopy(error, "상태를 확인하지 못했어요."));
    }
  }, [session]);

  useEffect(() => {
    loadSummary();
    loadWorker();
  }, [loadSummary, loadWorker]);

  if (!session) return null;

  const visibleSections = SECTION_CARDS.filter(
    (section) => !section.roles || section.roles.includes(session.admin.role)
  );

  return (
    <main style={{ background: "#FFF8F1", color: "#242424", minHeight: "100vh", padding: 32 }}>
      <p style={{ color: "#7A7A7A" }}>ADM-001</p>
      <h1>WooriAI Admin CMS</h1>

      <section style={{ background: "#FFFFFF", borderRadius: 8, marginBottom: 20, padding: 20 }}>
        <h2>운영 현황 요약</h2>
        {summary === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner} role="alert">
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
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {SUMMARY_CARDS.map((card) => {
              const caption =
                card.key === "productLinksBrokenCount"
                  ? brokenLinkCountCaption(worker, {
                      active: summary.productLinksActiveCount,
                      unchecked: summary.productLinksUncheckedCount,
                      broken: summary.productLinksBrokenCount
                    })
                  : card.key === "itemTemplatesActiveCount"
                    ? catalogSizeCaption(summary.itemTemplatesActiveCount)
                    : null;
              const body = (
                <>
                  <p style={{ color: "#7A7A7A", fontSize: 13, margin: 0 }}>{card.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>
                    {summary[card.key].toLocaleString("ko-KR")}
                  </p>
                  {caption ? (
                    <p style={{ color: "#7A7A7A", fontSize: 12, margin: "4px 0 0" }}>{caption}</p>
                  ) : null}
                  {card.href ? (
                    <p style={{ color: "#7A7A7A", fontSize: 12, margin: "4px 0 0" }}>목록 보기 →</p>
                  ) : null}
                </>
              );
              // 카드 껍데기는 링크 여부와 상관없이 <article>로 유지한다 —
              // scripts/qa/admin-e2e.mjs가 요약 카드를 article로 세고 있어서다.
              return (
                <article key={card.key} style={{ background: "#FFF8F1", borderRadius: 8, padding: 16 }}>
                  {card.href ? (
                    <Link href={card.href} style={{ color: "inherit", display: "block", textDecoration: "none" }}>
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </article>
              );
            })}
          </div>
        ) : null}

        {/* UX-X C5: 워커가 죽어 있으면 위 숫자 중 일부(깨진 링크·예약 게시)는 아무도
            갱신하지 않는 값이다. 생사와 마지막 실행 시각을 한 줄로 붙여 둔다. */}
        <p style={{ margin: "16px 0 0" }}>
          <strong>백그라운드 작업</strong>{" "}
          {worker ? (
            <span>
              {WORKER_HEALTH_STATE_LABELS[workerHealthState(worker)]} · {formatWorkerLastTick(worker)} ·{" "}
              {linkHealthCheckLine(worker)}
            </span>
          ) : workerError ? (
            <span>
              {workerError.message}
              {workerError.canRetry ? (
                <button type="button" className={styles.retryButton} onClick={loadWorker}>
                  다시 시도
                </button>
              ) : null}
            </span>
          ) : (
            <span>불러오는 중...</span>
          )}
        </p>
        {worker && workerHealthStateNote(worker) ? (
          <p className={styles.hint}>{workerHealthStateNote(worker)}</p>
        ) : null}
      </section>

      <section style={{ background: "#FFFFFF", borderRadius: 8, marginBottom: 20, padding: 20 }}>
        <h2>관리자 인증</h2>
        <p>세션 쿠키 + CSRF + TOTP MFA 기반 인증이 적용되어 있습니다. 레거시 x-admin-token 헤더는 개발/테스트 환경 전용이며 프로덕션에서는 차단됩니다.</p>
      </section>
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {visibleSections.map((section) => (
          <article key={section.href} style={{ background: "#FFFFFF", borderRadius: 8, padding: 20 }}>
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
