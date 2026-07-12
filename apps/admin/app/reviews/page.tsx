"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approvePublishContentRevision,
  getContentRevision,
  isAuthError,
  listContentRevisions,
  rejectContentRevision,
  rollbackContentRevision,
  type ContentRevision,
  type ContentRevisionDetail,
  type ContentRevisionEntityType,
  type ContentRevisionStatus
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

const ENTITY_TYPE_LABELS: Record<ContentRevisionEntityType, string> = {
  item_template: "준비템",
  product_link: "상품 링크",
  disclosure: "고지 문구"
};

const STATUS_LABELS: Record<ContentRevisionStatus, string> = {
  draft: "초안",
  in_review: "검토 대기",
  publishing: "게시 처리 중",
  published: "게시됨",
  rejected: "반려됨",
  archived: "보관됨"
};

const STATUS_FILTERS: Array<ContentRevisionStatus | "all"> = ["in_review", "published", "rejected", "all"];

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

/** Union of keys from both sides so a field only on one side still shows up. */
function diffFields(
  payload: Record<string, unknown>,
  live: Record<string, unknown> | null
): Array<{ field: string; before: string; after: string; changed: boolean }> {
  const keys = new Set<string>([...Object.keys(payload), ...(live ? Object.keys(live) : [])]);
  return [...keys].sort().map((field) => {
    const beforeValue = live ? live[field] : undefined;
    const afterValue = payload[field];
    const before = beforeValue === undefined ? "(없음)" : JSON.stringify(beforeValue);
    const after = afterValue === undefined ? "(없음)" : JSON.stringify(afterValue);
    return { field, before, after, changed: before !== after };
  });
}

export default function ContentReviewsPage() {
  const { session, clearSession } = useAdminSession();
  const [statusFilter, setStatusFilter] = useState<ContentRevisionStatus | "all">("in_review");
  const [revisions, setRevisions] = useState<ContentRevision[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentRevisionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [history, setHistory] = useState<ContentRevision[] | null>(null);

  const [rejectNote, setRejectNote] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const result = await listContentRevisions(statusFilter === "all" ? {} : { status: statusFilter });
      setRevisions(result.revisions);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError("검토 목록을 불러오지 못했어요.");
    }
  }, [session, statusFilter, clearSession]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailError(null);
      setActionError(null);
      setActionSuccess(null);
      setRejectNote("");
      try {
        const result = await getContentRevision(id);
        setDetail(result);
        if (result.entityId) {
          const historyResult = await listContentRevisions({ entityType: result.entityType, entityId: result.entityId });
          setHistory(historyResult.revisions);
        } else {
          setHistory([result]);
        }
      } catch (error) {
        if (isAuthError(error)) {
          clearSession();
          return;
        }
        setDetailError("검토 상세 정보를 불러오지 못했어요.");
      }
    },
    [clearSession]
  );

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setDetail(null);
      setHistory(null);
    }
  }, [selectedId, loadDetail]);

  if (!session) return null;

  const isAdmin = session.admin.role === "admin";

  const refreshAfterAction = async () => {
    await loadList();
    if (selectedId) {
      await loadDetail(selectedId);
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    setActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await approvePublishContentRevision(detail.id);
      setActionSuccess("게시했어요.");
      await refreshAfterAction();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setActionError("승인 게시하지 못했어요. 본인이 작성한 초안은 승인할 수 없어요.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    if (!rejectNote.trim()) {
      setActionError("반려 사유를 입력해 주세요.");
      return;
    }
    setActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await rejectContentRevision(detail.id, rejectNote.trim());
      setActionSuccess("반려했어요.");
      await refreshAfterAction();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setActionError("반려하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRollback = async (revisionId: string) => {
    setActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await rollbackContentRevision(revisionId);
      setActionSuccess("이전 게시 이력으로 롤백했어요.");
      await refreshAfterAction();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setActionError("롤백하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>콘텐츠 검토</h1>
        <p>편집자가 제출한 초안을 검토하고 승인 게시하거나 반려해요. 게시 이력에서 이전 버전으로 롤백할 수도 있어요.</p>
      </div>

      <section className={styles.card}>
        <h2>검토 목록</h2>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="status-filter">상태</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ContentRevisionStatus | "all")}
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "전체" : STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {revisions === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner}>
            {loadError}
            <button type="button" className={styles.retryButton} onClick={loadList}>
              다시 시도
            </button>
          </p>
        ) : null}
        {revisions && revisions.length === 0 ? <p className={styles.emptyState}>해당 상태의 초안이 없어요.</p> : null}
        {revisions && revisions.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>종류</th>
                  <th>버전</th>
                  <th>상태</th>
                  <th>제출일</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={revision.id}>
                    <td>{ENTITY_TYPE_LABELS[revision.entityType]}</td>
                    <td>#{revision.revisionNo}</td>
                    <td>{STATUS_LABELS[revision.status]}</td>
                    <td>{formatDate(revision.submittedAt)}</td>
                    <td>
                      <button type="button" className={styles.secondaryButton} onClick={() => setSelectedId(revision.id)}>
                        {selectedId === revision.id ? "선택됨" : "상세 보기"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {selectedId ? (
        <section className={styles.card}>
          <h2>
            상세 보기 {detail ? `- ${ENTITY_TYPE_LABELS[detail.entityType]} #${detail.revisionNo}` : ""}
          </h2>
          {detailError ? <p className={styles.errorBanner}>{detailError}</p> : null}
          {detail ? (
            <>
              <p className={styles.hint}>
                상태: {STATUS_LABELS[detail.status]} · 제출일: {formatDate(detail.submittedAt)}
                {detail.reviewNote ? ` · 메모: ${detail.reviewNote}` : ""}
              </p>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>필드</th>
                      <th>현재 라이브 값</th>
                      <th>제출된 값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffFields(detail.payload, detail.live).map((row) => (
                      <tr key={row.field} style={row.changed ? { background: "#fff4e5" } : undefined}>
                        <td>{row.field}</td>
                        <td>{row.before}</td>
                        <td>{row.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {actionError ? <p className={styles.errorBanner}>{actionError}</p> : null}
              {actionSuccess ? <p className={styles.successBanner}>{actionSuccess}</p> : null}

              {isAdmin && detail.status === "in_review" ? (
                <div className={styles.form}>
                  <div className={styles.actions}>
                    <button type="button" className={styles.primaryButton} onClick={handleApprove} disabled={actionSubmitting}>
                      {actionSubmitting ? "처리 중..." : "승인 게시"}
                    </button>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="reject-note">반려 사유</label>
                    <textarea id="reject-note" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} />
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondaryButton} onClick={handleReject} disabled={actionSubmitting}>
                      {actionSubmitting ? "처리 중..." : "반려"}
                    </button>
                  </div>
                </div>
              ) : null}
              {!isAdmin && detail.status === "in_review" ? (
                <p className={styles.hint}>승인 게시·반려는 관리자만 할 수 있어요.</p>
              ) : null}
            </>
          ) : (
            <p className={styles.emptyState}>불러오는 중...</p>
          )}

          {history && history.length > 0 ? (
            <>
              <h2>이력</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>버전</th>
                      <th>상태</th>
                      <th>게시일</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((revision) => (
                      <tr key={revision.id}>
                        <td>#{revision.revisionNo}</td>
                        <td>{STATUS_LABELS[revision.status]}</td>
                        <td>{formatDate(revision.publishedAt)}</td>
                        <td>
                          {isAdmin && revision.status === "published" ? (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => handleRollback(revision.id)}
                              disabled={actionSubmitting}
                            >
                              이 버전으로 롤백
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
