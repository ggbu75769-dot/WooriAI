"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelDeadLetterJob,
  getNotificationOperations,
  getOperationsRuntime,
  getRemoteAppConfig,
  isAuthError,
  listDeadLetterJobs,
  listIntegrityOperations,
  listLinkHealthOperations,
  listPrivacyOperations,
  listScheduledOperations,
  retryDeadLetterJob,
  retryPrivacyOperation,
  updateRemoteAppConfig,
  type DeadLetterJobSummary,
  type OperationsRuntime
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

type Snapshot = {
  runtime: OperationsRuntime;
  dlq: DeadLetterJobSummary[];
  privacy: Awaited<ReturnType<typeof listPrivacyOperations>>["requests"];
  links: Awaited<ReturnType<typeof listLinkHealthOperations>>["links"];
  scheduled: Awaited<ReturnType<typeof listScheduledOperations>>["revisions"];
  notifications: Awaited<ReturnType<typeof getNotificationOperations>>["states"];
  mismatches: Awaited<ReturnType<typeof listIntegrityOperations>>["checks"];
  remoteConfig: Record<string, unknown>;
};

export default function OperationsPage() {
  const { session, clearSession } = useAdminSession();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [runtime, dlq, privacy, links, scheduled, notifications, mismatches, remoteConfig] = await Promise.all([
        getOperationsRuntime(), listDeadLetterJobs(), listPrivacyOperations(), listLinkHealthOperations(),
        listScheduledOperations(), getNotificationOperations(), listIntegrityOperations(), getRemoteAppConfig()
      ]);
      setSnapshot({ runtime, dlq: dlq.jobs, privacy: privacy.requests, links: links.links, scheduled: scheduled.revisions, notifications: notifications.states, mismatches: mismatches.checks, remoteConfig });
      setConfigDraft(JSON.stringify(remoteConfig, null, 2));
    } catch (caught) {
      if (isAuthError(caught)) clearSession();
      else setError("운영 상태를 불러오지 못했어요.");
    }
  }, [session, clearSession]);

  useEffect(() => { void load(); }, [load]);
  if (!session) return null;
  const canMutate = session.admin.role === "admin";
  const saveConfig = async () => {
    if (!window.confirm("원격 설정을 변경할까요? 잘못된 설정은 앱 기능을 즉시 제한할 수 있습니다.")) return;
    try {
      const parsed = JSON.parse(configDraft) as Record<string, unknown>;
      await updateRemoteAppConfig(parsed);
      await load();
    } catch {
      setError("원격 설정 JSON 또는 서버 검증을 통과하지 못했어요.");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}><h1>운영 콘솔</h1><p>민감한 payload 없이 요청·작업·링크·알림·무결성 상태를 확인해요.</p></div>
      {error ? <p className={styles.errorBanner}>{error}<button className={styles.retryButton} onClick={() => void load()}>다시 시도</button></p> : null}
      {!snapshot && !error ? <p className={styles.emptyState}>불러오는 중...</p> : null}
      {snapshot ? <>
        <section className={styles.card}><h2>런타임</h2><p>환경: {snapshot.runtime.nodeEnv}</p><p>미발행 outbox {snapshot.runtime.queues.pendingOutbox} · 열린 DLQ {snapshot.runtime.queues.openDlq} · 실패 privacy {snapshot.runtime.queues.failedPrivacy}</p></section>
        <section className={styles.card}><h2>개인정보 요청</h2><p>최근 요청 {snapshot.privacy.length}건 · 실패 {snapshot.privacy.filter((item) => item.state === "failed").length}건</p>{snapshot.privacy.filter((item) => item.state === "failed" || item.state === "retained_exception").map((item) => <p key={item.id}>{item.requestType} · {item.state} · {item.failureCode ?? "원인 미분류"} {canMutate ? <button onClick={() => void retryPrivacyOperation(item.id).then(load)}>재시도</button> : null}</p>)}</section>
        <section className={styles.card}><h2>Dead letter</h2>{snapshot.dlq.length === 0 ? <p className={styles.emptyState}>열린 DLQ가 없어요.</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>topic</th><th>실패 코드</th><th>시도</th><th>작업</th></tr></thead><tbody>{snapshot.dlq.map((job) => <tr key={job.id}><td>{job.topic}</td><td>{job.failureCode}</td><td>{job.attempts}</td><td>{canMutate ? <><button onClick={() => void retryDeadLetterJob(job.id).then(load)}>재시도</button> <button onClick={() => void cancelDeadLetterJob(job.id).then(load)}>취소</button></> : "읽기 전용"}</td></tr>)}</tbody></table></div>}</section>
        <section className={styles.card}><h2>상품 링크 health</h2><p>점검 대상 {snapshot.links.length}개 · 실패 {snapshot.links.filter((item) => item.health?.state === "failed").length}개</p></section>
        <section className={styles.card}><h2>예약 콘텐츠</h2><p>{snapshot.scheduled.length}건</p></section>
        <section className={styles.card}><h2>알림 전달</h2><p>{snapshot.notifications.map((row) => `${row.state} ${row._count._all}`).join(" · ") || "전달 이력 없음"}</p></section>
        <section className={styles.card}><h2>리포트 무결성</h2><p>불일치 {snapshot.mismatches.length}건</p></section>
        <section className={styles.card}><h2>원격 설정</h2><textarea aria-label="원격 설정 JSON" rows={16} value={configDraft} onChange={(event) => setConfigDraft(event.target.value)} style={{ width: "100%" }} readOnly={!canMutate} />{canMutate ? <button onClick={() => void saveConfig()}>검증 후 저장</button> : <p>읽기 전용</p>}</section>
      </> : null}
    </div>
  );
}
