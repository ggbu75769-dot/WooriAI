"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  isAuthError,
  listAuditLogs,
  type AdminAuditLogEntry,
  type AdminAuditLogsPageInfo
} from "../../src/lib/admin-api";
import { loadErrorCopy, loadErrorMessage, type LoadErrorCopy } from "../../src/lib/load-error-copy";
import {
  auditLogCsvFilename,
  buildAuditLogCsv,
  collectAuditLogsForExport
} from "../../src/lib/audit-log-csv";
import {
  AUDIT_LOG_ACTION_MAX_LENGTH,
  AUDIT_LOG_ACTION_PRESETS,
  auditLogFilterError,
  auditLogFiltersFromSearchParams,
  auditLogFiltersToQuery,
  emptyAuditLogFilters
} from "../../src/lib/audit-log-filters";
import {
  AUDIT_LOG_FULL_ID_SUMMARY,
  AUDIT_LOG_SNAPSHOT_SUMMARY,
  auditLogActorCell,
  auditLogEmptyStateMessage,
  auditLogExpandSummaryLabel,
  auditLogTargetCell
} from "../../src/lib/audit-log-rows";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

const PAGE_SIZE = 20;

/** 액션 프리셋 datalist의 id (입력칸의 list 속성이 가리킨다). */
const ACTION_PRESET_LIST_ID = "audit-log-action-presets";

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

/**
 * GAP-087 트랙 A: 행위자·대상 두 칸의 **전체 식별자**를 글자로 펼치는 자리.
 * 축약 표기(`사용자(3f2a91c4)` · `expense · 3f2a91c4…`)는 종전 그대로 칸에 서고,
 * 전체 UUID는 같은 행의 `상세` 칸이 이미 쓰는 `<details>` 관례로 펼쳐진다 —
 * 종전에는 `<td title=…>`(마우스 호버)이 **유일한** 경로였다. 그 속성은 지우지 않는다:
 * 이 트랙은 도달 경로를 더하는 것이지 빼는 것이 아니다.
 * 표기·주소·링크 조건은 순수 모듈(src/lib/audit-log-rows.ts)이 판정한다.
 *
 * ⚠️ 라운드 87 리뷰 M-5: 펼침의 이름은 **그 칸이 이미 보여 주고 있는 축약 표기**를 앞에 세워
 * 짓는다(`auditLogExpandSummaryLabel`) — 그러지 않으면 한 화면에 `전체 ID 보기`가 마흔 개 서서
 * 낭독으로는 어느 행의 무엇을 펼치는지 알 수 없다. 새 문자열 0건이다.
 */
function FullIdDetails({ cellLabel, fullId, children }: { cellLabel: string; fullId: string; children?: ReactNode }) {
  return (
    <details>
      <summary>{auditLogExpandSummaryLabel(cellLabel, AUDIT_LOG_FULL_ID_SUMMARY)}</summary>
      <p>
        <code className={styles.calloutCode}>{fullId}</code>
      </p>
      {children}
    </details>
  );
}

function hasSnapshot(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * before/after 스냅샷 상세. 민감 키는 API가 이미 "[REDACTED]"로 마스킹해 준다.
 *
 * ⚠️ 라운드 87 리뷰 M-5: 이 펼침도 위 둘과 **같은 결함·같은 함수**다 — `변경 내용 보기` 스무 개가
 * 한 화면에 같은 소리로 서던 자리라, 같은 행의 대상 칸 표기를 앞에 세운다(새 문자열 0건).
 */
function SnapshotDetails({ entry, rowLabel }: { entry: AdminAuditLogEntry; rowLabel: string }) {
  if (!hasSnapshot(entry.before) && !hasSnapshot(entry.after)) {
    return <span className={styles.hint}>-</span>;
  }
  return (
    <details>
      <summary>{auditLogExpandSummaryLabel(rowLabel, AUDIT_LOG_SNAPSHOT_SUMMARY)}</summary>
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

/**
 * CS-101: 사용자 조회 화면의 "이 사용자 감사 로그 보기"가
 * /audit-logs?actorUserId=... 로 들어온다. useSearchParams는 정적 프리렌더 중
 * Suspense 경계를 요구하므로(Next App Router, /links·/reviews와 같은 관례)
 * 화면 본체를 감싼다.
 */
export default function AuditLogsPage() {
  return (
    <Suspense fallback={<p className={styles.emptyState}>불러오는 중...</p>}>
      <AuditLogsPageContent />
    </Suspense>
  );
}

function AuditLogsPageContent() {
  const { session, clearSession } = useAdminSession();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AdminAuditLogEntry[] | null>(null);
  const [pageInfo, setPageInfo] = useState<AdminAuditLogsPageInfo | null>(null);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);
  const [loading, setLoading] = useState(false);

  // 폼 입력값과 실제 적용된 필터를 분리: "적용" 버튼을 눌러야 조회한다.
  // CS-101: 초기값만 URL(?actorUserId=...)에서 1회 읽는다 — 사용자 조회에서
  // 넘어오면 그 사용자로 이미 좁혀진 목록이 뜬다. 그 뒤 조작은 클라 상태이고
  // URL은 다시 쓰지 않는다(/links의 UX-X C5 관례와 동일).
  const [filterForm, setFilterForm] = useState(() => auditLogFiltersFromSearchParams(searchParams));
  const [appliedFilters, setAppliedFilters] = useState(() => auditLogFiltersFromSearchParams(searchParams));
  const [filterError, setFilterError] = useState<string | null>(null);
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
        ...auditLogFiltersToQuery(appliedFilters)
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
      // 라운드 73 트랙 D: 그 문장을 여기서 옮겨 적지 않고 한 벌이 admin-api.ts에서 읽어 온다.
      setLoadError(loadErrorCopy(error, "감사 로그를 불러오지 못했어요."));
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
      const query = auditLogFiltersToQuery(appliedFilters);
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
      // 내보내기도 같은 목록 API의 조회다 — 같은 한 벌을 부른다(전용 [다시 시도] 버튼이
      // 없는 자리라 문장만 받는다: 내보내기 버튼 자체가 재시도다).
      setExportError(loadErrorMessage(error, "CSV 내보내기에 실패했어요. 잠시 후 다시 시도해 주세요."));
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

  // CS-101: 서버가 400으로 되돌려보낼 값(UUID 아닌 행위자 ID 등)은 보내기 전에
  // 막고 이유를 보여준다 — 그러지 않으면 화면에는 원인을 알 수 없는
  // "불러오지 못했어요"만 뜬다.
  const applyFilters = () => {
    const message = auditLogFilterError(filterForm);
    setFilterError(message);
    if (message) return;
    setOffset(0);
    setAppliedFilters(filterForm);
  };

  const resetFilters = () => {
    setFilterForm(emptyAuditLogFilters());
    setFilterError(null);
    setOffset(0);
    setAppliedFilters(emptyAuditLogFilters());
  };

  const currentPage = pageInfo ? Math.floor(pageInfo.offset / PAGE_SIZE) + 1 : 1;
  const totalPages = pageInfo ? Math.max(1, Math.ceil(pageInfo.total / PAGE_SIZE)) : 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>감사 로그</h1>
        {/* CS-101: 종전 문구는 "관리자 행위"만 말했지만, 이 표에는 앱 사용자의 행위도
            함께 남는다(지출 수정·삭제, 아이 프로필 삭제, 로그인 등) — CS 문의를 이 화면에서
            확인하려면 그 사실이 먼저 보여야 한다. */}
        <p>
          관리자 행위와 앱 사용자 행위를 함께 시간순으로 확인해요. 계정 관리·콘텐츠 발행 같은 민감한 작업과
          지출 수정·삭제, 아이 프로필 삭제, 로그인 기록이 남아요.
        </p>
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
                maxLength={AUDIT_LOG_ACTION_MAX_LENGTH}
                list={ACTION_PRESET_LIST_ID}
                placeholder="예: expense.update"
                value={filterForm.action}
                onChange={(event) => setFilterForm({ ...filterForm, action: event.target.value })}
              />
              {/* CS-101: 자주 쓰는 액션 프리셋. 직접 입력도 그대로 되고(정확 일치),
                  목록에 없는 액션도 손으로 적으면 조회된다. */}
              <datalist id={ACTION_PRESET_LIST_ID}>
                {AUDIT_LOG_ACTION_PRESETS.map((preset) => (
                  <option key={preset.action} value={preset.action}>
                    {preset.label}
                  </option>
                ))}
              </datalist>
              <span className={styles.hint}>
                정확히 일치하는 액션만 조회해요. 입력칸을 누르면 자주 쓰는 액션이 뜨고, 직접 입력해도 돼요.
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="filter-actor">행위자 ID</label>
              <input
                id="filter-actor"
                type="text"
                maxLength={64}
                placeholder="사용자/어드민 UUID"
                value={filterForm.actorUserId}
                onChange={(event) => setFilterForm({ ...filterForm, actorUserId: event.target.value })}
              />
              <span className={styles.hint}>
                한 사람의 행위만 모아 봐요. 사용자 조회 화면의 &ldquo;이 사용자 감사 로그 보기&rdquo;로 들어오면
                자동으로 채워져요.
              </span>
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
        {filterError ? <p className={styles.errorBanner} role="alert">{filterError}</p> : null}
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
        <h2 id="admin-audit-log-list-heading">기록 {pageInfo ? `(총 ${pageInfo.total.toLocaleString("ko-KR")}건)` : ""}</h2>
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
        {exportNotice ? <p className={styles.successBanner} role="status">{exportNotice}</p> : null}
        {exportError ? <p className={styles.errorBanner} role="alert">{exportError}</p> : null}
        {logs === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner} role="alert">
            {loadError.message}
            {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 실패에는 이 버튼을 세우지 않는다. */}
            {loadError.canRetry ? (
              <button type="button" className={styles.retryButton} onClick={loadLogs}>
                다시 시도
              </button>
            ) : null}
          </p>
        ) : null}
        {/* GAP-087 트랙 A: 0건 문장은 두 갈래다(src/lib/audit-log-rows.ts). 종전에는 필터를
            하나도 걸지 않은 운영자에게도 "조건에 맞는 기록이 없어요."라고 말해, 없는 조건을
            다시 지우러 가게 했다 — 그 둘을 가르는 판정(hasAnyAuditLogFilter)은 이미 있었고
            호출부가 0건이었다. ⚠️ 필터가 걸린 갈래의 문장 "조건에 맞는 기록이 없어요."는
            바이트 불변이다: admin-e2e 스텝 9·11이 그 문장을 기다리고
            admin-load-error-copy.test.ts의 18스텝 앵커가 그 문장을 찾는다. */}
        {logs && logs.length === 0 ? (
          <p className={styles.emptyState}>{auditLogEmptyStateMessage(appliedFilters)}</p>
        ) : null}
        {logs && logs.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-labelledby="admin-audit-log-list-heading">
              <thead>
                <tr>
                  <th>시각</th>
                  {/* CS-101: 어드민만 남는 표가 아니다 — 열 이름도 "행위자"로 바로잡는다. */}
                  <th>행위자</th>
                  <th>액션</th>
                  <th>대상</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => {
                  const actor = auditLogActorCell(entry);
                  const target = auditLogTargetCell(entry);
                  return (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td title={entry.actorUserId ?? undefined}>
                        {actor.label}
                        {actor.fullActorId ? (
                          <FullIdDetails cellLabel={actor.label} fullId={actor.fullActorId}>
                            {actor.traceHref ? (
                              // 되짚기: 새 주소를 만들지 않고 사용자 조회 화면이 이미 쓰는
                              // auditLogsHrefForActor 한 함수에서 온다. next/link가 아니라
                              // 평범한 <a>인 것은 같은 라우트로의 클라 이동이라 화면이
                              // 다시 마운트되지 않기 때문이다 — 이 화면은 ?actorUserId를
                              // **마운트 때 한 번** 읽어 필터 초기값으로 삼는다(위 useState).
                              <p>
                                <a href={actor.traceHref}>이 행위자의 기록만 보기</a>
                              </p>
                            ) : null}
                          </FullIdDetails>
                        ) : null}
                      </td>
                      <td>
                        <code>{entry.action}</code>
                      </td>
                      <td title={entry.targetId ?? undefined}>
                        {target.label}
                        {target.fullTargetId ? (
                          <FullIdDetails cellLabel={target.label} fullId={target.fullTargetId} />
                        ) : null}
                      </td>
                      <td>
                        <SnapshotDetails entry={entry} rowLabel={target.label} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {/* GAP-087 트랙 A: 종전 이 줄은 전체 ID가 호버로만 뜬다고 적어, 마우스가 없는
            운영자에게는 그 값에 닿는 길이 없다는 사실을 스스로 자백하고 있었다. 이제 그 값은
            칸 안에서 글자로 펼쳐지므로 각주도 그 자리를 가리킨다
            (라운드 86 리뷰 L-11이 분석 화면의 각주에 세운 그 규율). */}
        {logs && logs.length > 0 ? (
          <p className={styles.hint}>
            행위자가 &ldquo;사용자(...)&rdquo;로 보이는 행은 어드민 계정이 아닌 행위자예요(앱 사용자, 또는 이미
            삭제된 어드민 계정). 개인정보 없이 ID 앞 8자만 보여주고, 행위자·대상 칸의 &ldquo;
            {AUDIT_LOG_FULL_ID_SUMMARY}&rdquo;를 펼치면 전체 ID가 글자로 나와요. 그 값을 위 행위자 ID 칸에 넣으면
            한 사람의 기록만 모아 볼 수 있고, 어드민 계정이 아닌 행위자는 펼침 안의 링크로 바로 갈 수 있어요.
          </p>
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
