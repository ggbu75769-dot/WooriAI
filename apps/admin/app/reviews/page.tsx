"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  AdminApiError,
  approvePublishContentRevision,
  createIdempotencyKeyHolder,
  getContentRevision,
  getWorkerHealth,
  isAuthError,
  listContentRevisions,
  rejectContentRevision,
  rollbackContentRevision,
  scheduleContentRevision,
  type ContentRevision,
  type ContentRevisionDetail,
  type ContentRevisionEntityType,
  type ContentRevisionStatus,
  type WorkerHealth
} from "../../src/lib/admin-api";
import { loadErrorCopy, loadErrorMessage, type LoadErrorCopy } from "../../src/lib/load-error-copy";
import { writeErrorMessage } from "../../src/lib/write-error-copy";
import {
  REVISION_STATUS_FILTERS,
  overdueScheduleBadge,
  overdueScheduleNote,
  revisionStatusFilterFromSearchParams,
  revisionTargetLabel,
  schedulingWorkerNote,
  type RevisionStatusFilter
} from "../../src/lib/revision-rows";
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

// UX-X C5: 선택지는 revision-rows.ts가 단일 소스 — URL(?status=)이 받아 주는 값과
// select가 고를 수 있는 값이 어긋나지 않게 한다.
const STATUS_FILTERS: readonly RevisionStatusFilter[] = REVISION_STATUS_FILTERS;

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

/**
 * UX-X C5: 대시보드 "검수 대기 콘텐츠" 카드가 /reviews?status=in_review 로 들어온다.
 * useSearchParams는 정적 프리렌더 중 Suspense 경계를 요구하므로(Next App Router)
 * 화면 본체를 감싼다.
 */
export default function ContentReviewsPage() {
  return (
    <Suspense fallback={<p className={styles.emptyState}>불러오는 중...</p>}>
      <ContentReviewsPageContent />
    </Suspense>
  );
}

function ContentReviewsPageContent() {
  const { session, clearSession } = useAdminSession();
  const searchParams = useSearchParams();
  // 초기값만 URL에서 1회 읽고, 그 뒤 상태 필터는 종전대로 클라 상태다.
  const [statusFilter, setStatusFilter] = useState<RevisionStatusFilter>(() =>
    revisionStatusFilterFromSearchParams(searchParams)
  );
  const [revisions, setRevisions] = useState<ContentRevision[] | null>(null);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);

  /**
   * 라운드 73 트랙 D(GAP-073 #4ⓑ): 예약 게시의 조건을 **확인하고 말한다**.
   * 종전에는 폼 아래 정적 문장이 "워커가 켜져 있어야 동작해요"라고 조건만 적어 뒀는데,
   * 그 조건의 답은 이 앱이 이미 부를 수 있었다(대시보드가 유일한 호출부였다).
   * 확인하지 못했으면(요청 실패·로딩) null로 남고, 그때는 아무 말도 하지 않는다.
   */
  const [worker, setWorker] = useState<WorkerHealth | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentRevisionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [history, setHistory] = useState<ContentRevision[] | null>(null);

  const [rejectNote, setRejectNote] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  // R19-F: POST /admin/content-revisions/:id/approve-publish에는 서버 멱등키가
  // 붙어 있다. 지문으로 리비전 id를 넘겨 다른 리비전을 승인하면 자동으로 새 키가
  // 되고, 성공하면 회전한다 — 타임아웃 뒤 다시 눌러도 라이브 콘텐츠를 두 번
  // 갱신하지 않고 첫 응답이 재생된다.
  const approveKey = useRef(createIdempotencyKeyHolder()).current;
  // R20-D: POST /admin/content-revisions/:id/rollback에도 서버 멱등키가 붙었다.
  // 롤백은 호출할 때마다 새 리비전 행을 만들고 라이브 콘텐츠에 다시 쓰므로,
  // 타임아웃 뒤 다시 누르면 이력에 유령 리비전이 쌓인다. 지문으로 롤백 대상
  // 리비전 id를 넘겨 다른 이력을 고르면 새 키가 되고, 성공하면 회전한다.
  const rollbackKey = useRef(createIdempotencyKeyHolder()).current;

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
      setLoadError(loadErrorCopy(error, "검토 목록을 불러오지 못했어요."));
    }
  }, [session, statusFilter, clearSession]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // 워커 상태는 무인증 공개 엔드포인트(GET /health/worker)라 세션과 무관하게 실패해도
  // 로그아웃 처리를 하지 않는다 — 대시보드(app/page.tsx)와 같은 관례다.
  //
  // ⚠️ 실패했을 때 화면에 아무것도 세우지 않는 것이 이 자리의 판정이다(그래서 여기는
  // 조회 실패 한 벌을 부르지 않는 유일한 자리이고, 그 예외와 이유는
  // src/lib/load-error-copy.ts의 LOAD_ERROR_COPY_EXEMPT_SITES에 값으로 적혀 있다):
  // 꺼졌는지 멈췄는지 **모르는** 상태에서 예약 폼 위에 문장을 세우면 그것이 허위 표시다.
  const loadWorker = useCallback(async () => {
    if (!session) return;
    try {
      setWorker(await getWorkerHealth());
    } catch {
      setWorker(null);
    }
  }, [session]);

  useEffect(() => {
    loadWorker();
  }, [loadWorker]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailError(null);
      setActionError(null);
      setActionSuccess(null);
      setRejectNote("");
      setScheduleAt("");
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
        // 상세 배너에는 [다시 시도] 버튼이 없다(목록에서 다시 고르는 것이 재시도다) —
        // 그래서 문장만 받는다.
        setDetailError(loadErrorMessage(error, "검토 상세 정보를 불러오지 못했어요."));
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
      await approvePublishContentRevision(detail.id, approveKey.current(detail.id));
      approveKey.rotate();
      setActionSuccess("게시했어요.");
      await refreshAfterAction();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      // 라운드 76 트랙 B(GAP-076 #2ⓒ): 종전 폴백은 **모든 실패**에 "본인이 작성한 초안은
      // 승인할 수 없어요"라고 원인을 단정했다 — 네트워크 끊김·500·60초 타임아웃에도 그렇게
      // 말했다. 그 문장은 서버가 CONTENT_REVISION_SELF_APPROVAL일 때만 하는 말이고
      // (content-revisions.service.ts), 그때는 서버가 직접 말한다. 화면은 아는 것만 말한다.
      setActionError(writeErrorMessage(error, "승인 게시하지 못했어요."));
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
      setActionError(writeErrorMessage(error, "반려하지 못했어요. 다시 시도해 주세요."));
    } finally {
      setActionSubmitting(false);
    }
  };

  // COM-103b: 예약 게시 설정/해제. scheduledFor는 ISO 시각(설정) 또는 null(해제).
  const handleSchedule = async (scheduledFor: string | null) => {
    if (!detail) return;
    if (scheduledFor !== null) {
      const parsed = new Date(scheduledFor);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setActionError("예약 게시 시각은 미래 시각으로 입력해 주세요.");
        return;
      }
    }
    setActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await scheduleContentRevision(detail.id, scheduledFor ? new Date(scheduledFor).toISOString() : null);
      setActionSuccess(scheduledFor ? "예약 게시를 설정했어요." : "예약 게시를 해제했어요.");
      await refreshAfterAction();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      // API가 이미 한국어 사용자 메시지를 내려줘요(과거 시각·본인 제출 초안 등).
      // 라운드 76 트랙 B: 형제 넷 중 **이 자리만** 그 사실을 알고 있었고, 이번 라운드가
      // 나머지 셋을 같은 한 벌(writeErrorMessage)로 옮겼다. 이 자리의 손 사본이 남는
      // 이유는 admin-write-error-copy.test.ts의 면제 목록에 값으로 적혀 있다.
      setActionError(
        error instanceof AdminApiError && error.message
          ? error.message
          : "예약 게시를 변경하지 못했어요. 다시 시도해 주세요."
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRollback = async (revisionId: string) => {
    setActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await rollbackContentRevision(revisionId, rollbackKey.current(revisionId));
      rollbackKey.rotate();
      setActionSuccess("이전 게시 이력으로 롤백했어요.");
      await refreshAfterAction();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setActionError(writeErrorMessage(error, "롤백하지 못했어요. 다시 시도해 주세요."));
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>콘텐츠 검토</h1>
        <p>
          편집자가 제출한 초안을 검토하고 승인 게시하거나 반려해요. 예약 게시를 설정하면 지정한 시각에 자동으로
          게시돼요. 게시 이력에서 이전 버전으로 롤백할 수도 있어요.
        </p>
      </div>

      <section className={styles.card}>
        <h2>검토 목록</h2>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="status-filter">상태</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as RevisionStatusFilter)}
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
            {loadError.message}
            {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 실패에는 이 버튼을 세우지 않는다. */}
            {loadError.canRetry ? (
              <button type="button" className={styles.retryButton} onClick={loadList}>
                다시 시도
              </button>
            ) : null}
          </p>
        ) : null}
        {revisions && revisions.length === 0 ? <p className={styles.emptyState}>해당 상태의 초안이 없어요.</p> : null}
        {revisions && revisions.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="검토 목록 표">
              <thead>
                <tr>
                  <th>종류</th>
                  {/* UX-X C6: 어떤 준비템·링크를 고치는 초안인지 상세를 열지 않고도 알 수 있게. */}
                  <th>대상</th>
                  <th>버전</th>
                  <th>상태</th>
                  <th>제출일</th>
                  <th>예약</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => {
                  /* 라운드 73 후속(적대적 리뷰 ⑪): 판정을 **행마다 한 번만** 부른다.
                     `overdueScheduleNote()`의 기준 시각은 인자를 주지 않으면 호출 시점의
                     `Date.now()`라, 같은 행에서 두 번 부르면 두 순간을 비교하게 된다 —
                     예약 시각을 막 지나는 경계에서 배지가 없는 판정과 있는 판정이 한 행 안에
                     엇갈릴 수 있다. 값 하나를 만들어 조건과 본문이 같은 순간을 본다.

                     라운드 79 트랙 D(GAP-079 #4): 그 판정에 **이미 손에 든 워커 상태**를 함께
                     넘긴다 — 예약 게시 잡이 연속 실패 중이면 배지가 "아직 시도되지 않았다"가
                     아니라 그 사실을 말한다. 새 요청·새 상태 0건이고, 워커를 모르면(null)
                     종전 문장 그대로다. */
                  const overdueNote = overdueScheduleBadge(overdueScheduleNote(revision), worker);
                  return (
                    <tr key={revision.id}>
                      <td>{ENTITY_TYPE_LABELS[revision.entityType]}</td>
                      <td>{revisionTargetLabel(revision)}</td>
                      <td>#{revision.revisionNo}</td>
                      <td>{STATUS_LABELS[revision.status]}</td>
                      <td>{formatDate(revision.submittedAt)}</td>
                      {/* 라운드 73 트랙 D(GAP-073 #4ⓒ): 예약 시각이 지났는데 아직 검토 대기면
                          그 게시는 일어나지 않은 것이다 — 종전에는 지난 날짜만 얌전히 적혔다.
                          판정은 순수 함수 한 자리(revision-rows.ts overdueScheduleNote). */}
                      <td>
                        {formatDate(revision.scheduledFor)}
                        {overdueNote ? (
                          <>
                            <br />
                            <span className={`${styles.badge} ${styles.badgeInactive}`}>{overdueNote}</span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <button type="button" className={styles.secondaryButton} onClick={() => setSelectedId(revision.id)}>
                          {selectedId === revision.id ? "선택됨" : "상세 보기"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                {detail.status === "in_review"
                  ? ` · 예약 게시: ${detail.scheduledFor ? formatDate(detail.scheduledFor) : "없음"}`
                  : ""}
                {detail.reviewNote ? ` · 메모: ${detail.reviewNote}` : ""}
              </p>

              <div className={styles.tableWrap}>
                <table className={styles.table} aria-label="제출 값과 라이브 값 비교">
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
                  {/* 라운드 73 트랙 D(GAP-073 #4ⓑ): 아래 정적 문장이 적어 둔 그 조건을
                      이제 화면이 **확인해서** 말한다. 문장은 workerHealthStateNote()가 이미
                      가진 것을 그대로 읽는다(새 문구 0건).
                      ⚠️ 예약 자체는 막지 않는다 — 워커는 켜질 수 있고, 켜지면 밀린 예약이
                      실제로 처리된다. 막는 것이 아니라 말하는 것이 이 자리의 판정이다. */}
                  {schedulingWorkerNote(worker) ? (
                    <p className={styles.errorBanner}>{schedulingWorkerNote(worker)}</p>
                  ) : null}
                  <div className={styles.field}>
                    <label htmlFor="schedule-at">예약 게시 시각</label>
                    <input
                      id="schedule-at"
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                    />
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleSchedule(scheduleAt || null)}
                      disabled={actionSubmitting || !scheduleAt}
                    >
                      {actionSubmitting ? "처리 중..." : "예약 게시 설정"}
                    </button>
                    {detail.scheduledFor ? (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => handleSchedule(null)}
                        disabled={actionSubmitting}
                      >
                        예약 해제
                      </button>
                    ) : null}
                  </div>
                  <p className={styles.hint}>
                    예약된 시각이 되면 자동으로 게시돼요. 예약 실행은 백그라운드 워커(WORKER_ENABLED=1)가 켜져 있어야 동작해요.
                  </p>
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
                <table className={styles.table} aria-label="게시 이력 표">
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
