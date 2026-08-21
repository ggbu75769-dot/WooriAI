"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isAuthError,
  isTimeoutError,
  listAuditLogs,
  type AdminAuditLogEntry,
  type AdminAuditLogsPageInfo,
  type AdminAuditLogsQuery
} from "../../src/lib/admin-api";
import {
  auditLogCsvFilename,
  buildAuditLogCsv,
  collectAuditLogsForExport
} from "../../src/lib/audit-log-csv";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

const PAGE_SIZE = 20;

type Filters = {
  action: string;
  /** yyyy-MM-dd (date input). API로는 하루 시작/끝 ISO 타임스탬프로 변환해 보낸다. */
  fromDate: string;
  toDate: string;
};

function emptyFilters(): Filters {
  return { action: "", fromDate: "", toDate: "" };
}

/** 적용된 필터 → 목록/내보내기 공용 쿼리 파라미터 (limit/offset 제외). */
function filtersToQuery(filters: Filters): Omit<AdminAuditLogsQuery, "limit" | "offset"> {
  const action = filters.action.trim();
  return {
    ...(action ? { action } : {}),
    ...(filters.fromDate ? { from: new Date(`${filters.fromDate}T00:00:00`).toISOString() } : {}),
    ...(filters.toDate ? { to: new Date(`${filters.toDate}T23:59:59.999`).toISOString() } : {})
  };
}

/** 클라이언트에서 만든 CSV를 Blob 다운로드로 내려준다 (서버 왕복 없음).
 * UTF-8 BOM은 한국어 셀을 Excel이 바로 읽게 하기 위한 관례적 접두. */
function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ko-KR");
}

/** 대상 표시: target_type + 축약 id (UUID 전체는 title 속성으로만). */
function formatTarget(entry: AdminAuditLogEntry): string {
  if (!entry.targetId) return entry.targetType;
  return `${entry.targetType} · ${entry.targetId.slice(0, 8)}…`;
}

function formatActor(entry: AdminAuditLogEntry): string {
  if (entry.actorEmail) return entry.actorEmail;
  if (entry.actorUserId) return `${entry.actorUserId.slice(0, 8)}…`;
  return "시스템/알 수 없음";
}

function hasSnapshot(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/** before/after 스냅샷 상세. 민감 키는 API가 이미 "[REDACTED]"로 마스킹해 준다. */
function SnapshotDetails({ entry }: { entry: AdminAuditLogEntry }) {
  if (!hasSnapshot(entry.before) && !hasSnapshot(entry.after)) {
    return <span className={styles.hint}>-</span>;
  }
  return (
    <details>
      <summary>변경 내용 보기</summary>
      {hasSnapshot(entry.before) ? (
        <p>
          <span className={styles.hint}>이전</span>
          <code className={styles.calloutCode}>{JSON.stringify(entry.before)}</code>
        </p>
      ) : null}
      {hasSnapshot(entry.after) ? (
        <p>
          <span className={styles.hint}>이후</span>
          <code className={styles.calloutCode}>{JSON.stringify(entry.after)}</code>
        </p>
      ) : null}
    </details>
  );
}

export default function AuditLogsPage() {
  const { session, clearSession } = useAdminSession();

  const [logs, setLogs] = useState<AdminAuditLogEntry[] | null>(null);
  const [pageInfo, setPageInfo] = useState<AdminAuditLogsPageInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 폼 입력값과 실제 적용된 필터를 분리: "적용" 버튼을 눌러야 조회한다.
  const [filterForm, setFilterForm] = useState<Filters>(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters());
  const [offset, setOffset] = useState(0);

  // ADM-117: CSV 내보내기 진행 상태 + 완료/오류 안내.
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const isAdmin = session?.admin.role === "admin";

  const loadLogs = useCallback(async () => {
    if (!session || session.admin.role !== "admin") return;
    setLoadError(null);
    setLoading(true);
    try {
      const result = await listAuditLogs({
        limit: PAGE_SIZE,
        offset,
        ...filtersToQuery(appliedFilters)
      });
      setLogs(result.auditLogs);
      setPageInfo(result.pageInfo);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      // 행 걸린 요청은 10초 후 타임아웃으로 끊기고(admin-api fetchWithTimeout),
      // "불러오는 중..."이 무한히 이어지는 대신 시간 초과 안내 + 재시도가 뜬다.
      setLoadError(
        isTimeoutError(error)
          ? "요청 시간이 초과됐어요(10초). 네트워크 상태를 확인하고 다시 시도해 주세요."
          : "감사 로그를 불러오지 못했어요."
      );
    } finally {
      setLoading(false);
    }
  }, [session, clearSession, appliedFilters, offset]);

  // ADM-117: 현재 적용된 필터 그대로 기존 목록 API를 limit=100으로 페이지 순회해
  // 최대 1,000행을 모은 뒤 클라이언트에서 CSV를 만들어 Blob으로 내려준다.
  const exportCsv = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportNotice(null);
    setExportError(null);
    try {
      const query = filtersToQuery(appliedFilters);
      const { entries, truncated } = await collectAuditLogsForExport((page) =>
        listAuditLogs({ ...query, ...page })
      );
      if (entries.length === 0) {
        setExportNotice("조건에 맞는 기록이 없어 내보낼 내용이 없어요.");
        return;
      }
      downloadCsv(buildAuditLogCsv(entries), auditLogCsvFilename());
      setExportNotice(
        truncated
          ? "상위 1,000건만 내보냈어요. 기간 필터로 범위를 좁히면 나머지도 내보낼 수 있어요."
          : `${entries.length.toLocaleString("ko-KR")}건을 내보냈어요.`
      );
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setExportError(
        isTimeoutError(error)
          ? "요청 시간이 초과됐어요(10초). 네트워크 상태를 확인하고 다시 시도해 주세요."
          : "CSV 내보내기에 실패했어요. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setExporting(false);
    }
  }, [exporting, appliedFilters, clearSession]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  if (!session) return null;

  // ADM-113: API 자체가 admin 전용(403)이라, editor/analyst 세션에는 깨진
  // 화면 대신 안내 문구를 보여준다 (ADM-006 users 페이지와 동일한 패턴).
  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>감사 로그</h1>
        </div>
        <section className={styles.card}>
          <p className={styles.emptyState}>감사 로그는 관리자(admin) 권한에서만 사용할 수 있어요.</p>
        </section>
      </div>
    );
  }

  const applyFilters = () => {
    setOffset(0);
    setAppliedFilters(filterForm);
  };

  const resetFilters = () => {
    setFilterForm(emptyFilters());
    setOffset(0);
    setAppliedFilters(emptyFilters());
  };

  const currentPage = pageInfo ? Math.floor(pageInfo.offset / PAGE_SIZE) + 1 : 1;
  const totalPages = pageInfo ? Math.max(1, Math.ceil(pageInfo.total / PAGE_SIZE)) : 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>감사 로그</h1>
        <p>관리자 행위 기록을 시간순으로 확인해요. 계정 관리·콘텐츠 발행 같은 민감한 작업이 모두 남아요.</p>
      </div>

      <section className={styles.card}>
        <h2>필터</h2>
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="filter-action">액션 타입</label>
              <input
                id="filter-action"
                type="text"
                maxLength={80}
                placeholder="예: admin.admin_user.update"
                value={filterForm.action}
                onChange={(event) => setFilterForm({ ...filterForm, action: event.target.value })}
              />
              <span className={styles.hint}>정확히 일치하는 액션만 조회해요.</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="filter-from">시작일</label>
              <input
                id="filter-from"
                type="date"
                value={filterForm.fromDate}
                onChange={(event) => setFilterForm({ ...filterForm, fromDate: event.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="filter-to">종료일</label>
              <input
                id="filter-to"
                type="date"
                value={filterForm.toDate}
                onChange={(event) => setFilterForm({ ...filterForm, toDate: event.target.value })}
              />
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={applyFilters} disabled={loading}>
            필터 적용
          </button>
          <button type="button" className={styles.secondaryButton} onClick={resetFilters} disabled={loading}>
            초기화
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h2>기록 {pageInfo ? `(총 ${pageInfo.total.toLocaleString("ko-KR")}건)` : ""}</h2>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={exportCsv}
            disabled={exporting}
            aria-busy={exporting}
          >
            {exporting ? "내보내는 중..." : "CSV 내보내기"}
          </button>
          <span className={styles.hint}>현재 필터 조건으로 최대 1,000건까지 CSV 파일로 저장해요.</span>
        </div>
        {exportNotice ? <p className={styles.successBanner}>{exportNotice}</p> : null}
        {exportError ? <p className={styles.errorBanner}>{exportError}</p> : null}
        {logs === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner}>
            {loadError}
            <button type="button" className={styles.retryButton} onClick={loadLogs}>
              다시 시도
            </button>
          </p>
        ) : null}
        {logs && logs.length === 0 ? <p className={styles.emptyState}>조건에 맞는 기록이 없어요.</p> : null}
        {logs && logs.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>시각</th>
                  <th>관리자</th>
                  <th>액션</th>
                  <th>대상</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td title={entry.actorUserId ?? undefined}>{formatActor(entry)}</td>
                    <td>
                      <code>{entry.action}</code>
                    </td>
                    <td title={entry.targetId ?? undefined}>{formatTarget(entry)}</td>
                    <td>
                      <SnapshotDetails entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {pageInfo ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={loading || pageInfo.offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              이전
            </button>
            <span className={styles.hint}>
              {currentPage} / {totalPages} 페이지
            </span>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={loading || !pageInfo.hasMore}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              다음
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
