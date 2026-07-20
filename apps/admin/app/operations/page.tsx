"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelDeadLetterJob,
  cleanupCatalogImportOrphan,
  getNotificationOperations,
  getOperationsRuntime,
  getRemoteAppConfig,
  isAuthError,
  listDeadLetterJobs,
  listIntegrityOperations,
  listLinkHealthOperations,
  listNotificationReconciliation,
  listPrivacyOperations,
  listScheduledOperations,
  previewCatalogImportReconciliation,
  reconcileNotificationDelivery,
  repairCatalogImport,
  retryDeadLetterJob,
  retryPrivacyOperation,
  rollbackRemoteAppConfig,
  updateRemoteAppConfig,
  type CatalogImportReconciliation,
  type DeadLetterJobSummary,
  type OperationsRuntime,
  type RemoteConfigOperations
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
  notificationReconciliation: Awaited<ReturnType<typeof listNotificationReconciliation>>["deliveries"];
  mismatches: Awaited<ReturnType<typeof listIntegrityOperations>>["checks"];
  remoteConfig: RemoteConfigOperations;
};

export default function OperationsPage() {
  const { session, clearSession } = useAdminSession();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState("");
  const [configReason, setConfigReason] = useState("");
  const [importReconciliation, setImportReconciliation] = useState<CatalogImportReconciliation | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!session || loadingRef.current) return;
    loadingRef.current = true;
    setError(null);
    try {
      const [runtime, dlq, privacy, links, scheduled, notifications, notificationReconciliation, mismatches, remoteConfig] = await Promise.all([
        getOperationsRuntime(), listDeadLetterJobs(), listPrivacyOperations(), listLinkHealthOperations(),
        listScheduledOperations(), getNotificationOperations(), listNotificationReconciliation(), listIntegrityOperations(), getRemoteAppConfig()
      ]);
      setSnapshot({ runtime, dlq: dlq.jobs, privacy: privacy.requests, links: links.links, scheduled: scheduled.revisions, notifications: notifications.states, notificationReconciliation: notificationReconciliation.deliveries, mismatches: mismatches.checks, remoteConfig });
      setConfigDraft(JSON.stringify(remoteConfig.active.config, null, 2));
    } catch (caught) {
      if (isAuthError(caught)) clearSession();
      else setError("운영 상태를 불러오지 못했어요.");
    } finally {
      loadingRef.current = false;
    }
  }, [session, clearSession]);

  const refreshImportOperations = useCallback(async () => {
    const [runtime, reconciliation] = await Promise.all([
      getOperationsRuntime(),
      previewCatalogImportReconciliation()
    ]);
    setSnapshot((current) => current ? { ...current, runtime } : current);
    setImportReconciliation(reconciliation);
  }, []);

  const refreshNotificationOperations = useCallback(async () => {
    const [notifications, reconciliation] = await Promise.all([
      getNotificationOperations(),
      listNotificationReconciliation()
    ]);
    setSnapshot((current) => current ? {
      ...current,
      notifications: notifications.states,
      notificationReconciliation: reconciliation.deliveries
    } : current);
  }, []);

  const refreshRemoteConfig = useCallback(async () => {
    const remoteConfig = await getRemoteAppConfig();
    setSnapshot((current) => current ? { ...current, remoteConfig } : current);
    setConfigDraft(JSON.stringify(remoteConfig.active.config, null, 2));
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (!session) return null;
  const canMutate = session.admin.role === "admin";
  const runAction = async (key: string, action: () => Promise<unknown>, refresh: boolean | (() => Promise<void>) = true) => {
    if (pendingAction) return;
    setPendingAction(key);
    setError(null);
    try {
      await action();
      if (refresh) await (typeof refresh === "function" ? refresh() : load());
    } catch {
      setError("복구 작업을 완료하지 못했어요. 상태를 새로 확인해 주세요.");
    } finally {
      setPendingAction(null);
    }
  };
  const saveConfig = async () => {
    if (!snapshot || configReason.trim().length < 3) { setError("원격 설정 변경 이유를 3자 이상 입력해 주세요."); return; }
    if (!window.confirm("원격 설정을 변경할까요? 잘못된 설정은 앱 기능을 즉시 제한할 수 있습니다.")) return;
    await runAction("config-save", async () => {
      const parsed = JSON.parse(configDraft) as Record<string, unknown>;
      const { configVersion: _configVersion, updatedAt: _updatedAt, ...config } = parsed;
      await updateRemoteAppConfig({ expectedVersion: snapshot.remoteConfig.active.config.configVersion, reason: configReason.trim(), config });
      setConfigReason("");
    }, refreshRemoteConfig);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}><h1>운영 콘솔</h1><p>민감한 payload 없이 요청·작업·링크·알림·무결성 상태를 확인해요.</p></div>
      {error ? <p className={styles.errorBanner}>{error}<button className={styles.retryButton} onClick={() => void load()}>다시 시도</button></p> : null}
      {!snapshot && !error ? <p className={styles.emptyState}>불러오는 중...</p> : null}
      {snapshot ? <>
        <section className={styles.card}><h2>런타임</h2><p>환경: {snapshot.runtime.nodeEnv} · 저장소 {snapshot.runtime.storage.adapter}/{snapshot.runtime.storage.state}</p><p>미발행 outbox {snapshot.runtime.queues.pendingOutbox} · lease {snapshot.runtime.queues.leasedOutbox} · 실패 {snapshot.runtime.queues.failedOutbox} · 열린 DLQ {snapshot.runtime.queues.openDlq}</p><p>가장 오래된 대기 {snapshot.runtime.queues.oldestPendingAgeSeconds === null ? "없음" : `${snapshot.runtime.queues.oldestPendingAgeSeconds}초`} · 결과 미확정 알림 {snapshot.runtime.queues.unknownDeliveries}</p>{snapshot.runtime.services.length === 0 ? <p className={styles.emptyState}>등록된 service heartbeat가 없어요.</p> : snapshot.runtime.services.map((service) => <p key={`${service.serviceType}-${service.instanceId}`}>{service.serviceType} · {service.instanceId} · {service.stale ? "응답 지연" : service.state} · 재시작 {service.restartCount}회{service.activeConfigVersion ? ` · config v${service.activeConfigVersion}/${service.configSource}` : ""}</p>)}</section>
        <section className={styles.card}><h2>개인정보 요청</h2><p>최근 요청 {snapshot.privacy.length}건 · 실패 {snapshot.privacy.filter((item) => item.state === "failed").length}건</p>{snapshot.privacy.filter((item) => item.state === "failed" || item.state === "retained_exception").map((item) => <p key={item.id}>{item.requestType} · {item.state} · {item.failureCode ?? "원인 미분류"} {canMutate ? <button disabled={pendingAction !== null} onClick={() => void runAction(`privacy-${item.id}`, () => retryPrivacyOperation(item.id))}>재시도</button> : null}</p>)}</section>
        <section className={styles.card}><h2>Dead letter</h2>{snapshot.dlq.length === 0 ? <p className={styles.emptyState}>열린 DLQ가 없어요.</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>topic</th><th>실패 코드</th><th>시도</th><th>작업</th></tr></thead><tbody>{snapshot.dlq.map((job) => <tr key={job.id}><td>{job.topic}</td><td>{job.failureCode}</td><td>{job.attempts}</td><td>{canMutate ? <><button disabled={pendingAction !== null} onClick={() => void runAction(`dlq-retry-${job.id}`, () => retryDeadLetterJob(job.id))}>재시도</button> <button disabled={pendingAction !== null} onClick={() => { if (window.confirm("이 dead-letter 작업을 취소할까요?")) void runAction(`dlq-cancel-${job.id}`, () => cancelDeadLetterJob(job.id)); }}>취소</button></> : "읽기 전용"}</td></tr>)}</tbody></table></div>}</section>
        <section className={styles.card}><h2>상품 링크 health</h2><p>점검 대상 {snapshot.links.length}개 · 실패 {snapshot.links.filter((item) => item.health?.state === "failed").length}개</p></section>
        <section className={styles.card}><h2>예약 콘텐츠</h2><p>{snapshot.scheduled.length}건</p></section>
        <section className={styles.card}><h2>알림 전달</h2><p>{snapshot.notifications.map((row) => `${row.state} ${row._count._all}`).join(" · ") || "전달 이력 없음"}</p></section>
        <section className={styles.card}><h2>알림 결과 확인</h2>{snapshot.notificationReconciliation.length === 0 ? <p className={styles.emptyState}>확인이 필요한 알림이 없어요.</p> : snapshot.notificationReconciliation.map((delivery) => <p key={delivery.id}>{delivery.eventType} · {delivery.state} · {delivery.failureCode ?? "provider 응답 확인 중"} {canMutate ? <button disabled={pendingAction !== null} onClick={() => void runAction(`delivery-${delivery.id}`, () => reconcileNotificationDelivery(delivery.id, delivery.state), refreshNotificationOperations)}>결과 다시 확인</button> : null}</p>)}</section>
        <section className={styles.card}><h2>리포트 무결성</h2><p>불일치 {snapshot.mismatches.length}건</p></section>
        <section className={styles.card}><h2>가져오기 복구</h2><p>상태별 작업: {snapshot.runtime.queues.imports.map((row) => `${row.state} ${row._count._all}`).join(" · ") || "없음"}</p><button disabled={pendingAction !== null} onClick={() => void runAction("import-dry-run", async () => setImportReconciliation(await previewCatalogImportReconciliation()), false)}>불일치 미리 확인</button>{importReconciliation ? <><p>객체 {importReconciliation.scanned.objects} · 작업 {importReconciliation.scanned.jobs} · 고아 {importReconciliation.orphanObjects.length} · 원본 없음 {importReconciliation.missingObjectJobs.length}</p>{importReconciliation.missingObjectJobs.map((job) => <p key={job.id}>{job.state} · {job.id} {session.admin.role !== "analyst" ? <button disabled={pendingAction !== null} onClick={() => void runAction(`import-${job.id}`, () => repairCatalogImport(job.id, job.version), refreshImportOperations)}>상태 다시 확인</button> : null}</p>)}{canMutate ? importReconciliation.orphanObjects.map((object) => <p key={object.objectKey}>확정된 고아 객체 · {object.size} bytes <button disabled={pendingAction !== null} onClick={() => { if (window.confirm("활성 작업과 연결되지 않은 객체를 삭제할까요?")) void runAction(`orphan-${object.objectKey}`, () => cleanupCatalogImportOrphan(object.objectKey), refreshImportOperations); }}>삭제</button></p>) : null}</> : null}</section>
        <section className={styles.card}><h2>원격 설정</h2><p>활성 v{snapshot.remoteConfig.active.config.configVersion} · {snapshot.remoteConfig.active.source}</p><textarea aria-label="원격 설정 JSON" rows={16} value={configDraft} onChange={(event) => setConfigDraft(event.target.value)} style={{ width: "100%" }} readOnly={!canMutate} />{canMutate ? <><label>변경 이유<input aria-label="원격 설정 변경 이유" value={configReason} onChange={(event) => setConfigReason(event.target.value)} /></label><button disabled={pendingAction !== null} onClick={() => void saveConfig()}>검증 후 저장</button>{snapshot.remoteConfig.revisions.filter((revision) => revision.version < snapshot.remoteConfig.active.config.configVersion).slice(0, 5).map((revision) => <p key={revision.version}>v{revision.version} · {revision.action} · {revision.reason} <button aria-label={`v${revision.version} 새 버전으로 복원`} disabled={pendingAction !== null} onClick={() => { if (window.confirm(`v${revision.version} 내용을 새 버전으로 복원할까요?`)) void runAction(`rollback-${revision.version}`, () => rollbackRemoteAppConfig({ expectedVersion: snapshot.remoteConfig.active.config.configVersion, targetVersion: revision.version, reason: configReason.trim() || `v${revision.version} 운영 복원` }), refreshRemoteConfig); }}>새 버전으로 복원</button></p>)}</> : <p>읽기 전용</p>}</section>
      </> : null}
    </div>
  );
}
