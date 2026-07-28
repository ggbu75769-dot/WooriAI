"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AdminApiError,
  approveRelease5SafetyAlternative,
  createRelease5EvidenceSource,
  deactivateRelease5SafetyAlternative,
  getRelease5PilotWorklist,
  getRelease5RecallWorklist,
  importRelease5LegalDocument,
  isAuthError,
  previewRelease5LegalDocument,
  previewRelease5MerchantFeed,
  previewRelease5PilotManifest,
  reviewRelease5EvidenceSource,
  upsertRelease5SafetyAlternative,
  type Release5LegalCandidate,
  type Release5MerchantRowInput,
  type Release5PilotWorklist,
  type Release5RecallWorklist
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

const LEGAL_EXAMPLE = JSON.stringify({
  documentType: "terms",
  locale: "ko-KR",
  version: "",
  title: "",
  bodyMarkdown: "",
  required: true,
  effectiveAt: ""
}, null, 2);

function parseLegal(value: string): Release5LegalCandidate {
  if (value.length > 210_000) throw new Error("법률 문서 입력이 허용 크기를 초과했어요.");
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("법률 문서는 JSON 객체여야 해요.");
  return parsed as Release5LegalCandidate;
}

function parseMerchantRows(value: string): Release5MerchantRowInput[] {
  if (value.length > 2_000_000) throw new Error("상품 feed 입력이 허용 크기를 초과했어요.");
  const parsed: unknown = JSON.parse(value);
  const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "rows" in parsed ? (parsed as { rows?: unknown }).rows : null;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1000) throw new Error("상품 feed는 1~1,000개 행 배열이어야 해요.");
  if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("상품 feed 각 행은 객체여야 해요.");
  return rows as Release5MerchantRowInput[];
}

export default function Release5ReadinessPage() {
  const { session, clearSession } = useAdminSession();
  const [pilot, setPilot] = useState<Release5PilotWorklist | null>(null);
  const [recalls, setRecalls] = useState<Release5RecallWorklist | null>(null);
  const [selectedPilotIds, setSelectedPilotIds] = useState<string[]>([]);
  const [legalJson, setLegalJson] = useState(LEGAL_EXAMPLE);
  const [legalPreview, setLegalPreview] = useState<{ input: Release5LegalCandidate; contentHash: string } | null>(null);
  const [evidenceItemId, setEvidenceItemId] = useState("");
  const [evidenceRevision, setEvidenceRevision] = useState("1");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceClaims, setEvidenceClaims] = useState("");
  const [evidenceResult, setEvidenceResult] = useState<{ id: string; contentHash: string; status: string } | null>(null);
  const [reviewEvidenceId, setReviewEvidenceId] = useState("");
  const [reviewEvidenceHash, setReviewEvidenceHash] = useState("");
  const [safetySourceItemId, setSafetySourceItemId] = useState("");
  const [safetyAlternativeItemId, setSafetyAlternativeItemId] = useState("");
  const [safetyReason, setSafetyReason] = useState("");
  const [safetyEvidenceId, setSafetyEvidenceId] = useState("");
  const [merchantSource, setMerchantSource] = useState("");
  const [merchantJson, setMerchantJson] = useState("[]");
  const [merchantSummary, setMerchantSummary] = useState<{ valid: number; invalid: number; duplicate: boolean } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!session || loadingRef.current) return;
    loadingRef.current = true;
    setError(null);
    try {
      const [pilotResult, recallResult] = await Promise.all([getRelease5PilotWorklist(), getRelease5RecallWorklist()]);
      setPilot(pilotResult);
      setRecalls(recallResult);
      setSelectedPilotIds((current) => current.filter((id) => pilotResult.items.some((item) => item.id === id && item.ready)));
    } catch (caught) {
      if (isAuthError(caught)) clearSession();
      else setError("Release 5 준비 상태를 불러오지 못했어요.");
    } finally {
      loadingRef.current = false;
    }
  }, [clearSession, session]);

  useEffect(() => { void load(); }, [load]);
  if (!session) return null;
  const canDraft = session.admin.role === "admin" || session.admin.role === "editor";
  const canApprove = session.admin.role === "admin";

  const run = async (key: string, action: () => Promise<void>) => {
    if (pendingAction) return;
    setPendingAction(key);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (caught) {
      if (isAuthError(caught)) return clearSession();
      setError(caught instanceof AdminApiError ? caught.message : caught instanceof Error ? caught.message : "요청을 처리하지 못했어요.");
    } finally {
      setPendingAction(null);
    }
  };

  const previewLegal = async (event: FormEvent) => {
    event.preventDefault();
    await run("legal-preview", async () => {
      const input = parseLegal(legalJson);
      const result = await previewRelease5LegalDocument(input);
      setLegalPreview({ input, contentHash: result.contentHash });
      setMessage("형식과 공개 URL 경계를 통과했어요. 아직 승인되거나 게시된 문서는 아니에요.");
    });
  };

  const importLegal = async () => {
    if (!legalPreview || !window.confirm("실제 법률 검토자가 전달한 원문과 version이 맞는지 확인했나요? 가져와도 승인·게시되지는 않습니다.")) return;
    await run("legal-import", async () => {
      const result = await importRelease5LegalDocument(legalPreview.input);
      setMessage(`법률 문서 후보를 가져왔어요. revision ${result.revision} · 승인/게시 대기`);
      setLegalPreview(null);
    });
  };

  const createEvidence = async (event: FormEvent) => {
    event.preventDefault();
    await run("evidence", async () => {
      const claims = evidenceClaims.split("\n").map((claim) => claim.trim()).filter(Boolean);
      const result = await createRelease5EvidenceSource(evidenceItemId.trim(), {
        sourceType: "official_guidance",
        title: evidenceTitle.trim(),
        publicUrl: evidenceUrl.trim(),
        revision: Number(evidenceRevision),
        applicableClaims: claims
      });
      setEvidenceResult(result);
      setReviewEvidenceId(result.id);
      setReviewEvidenceHash(result.contentHash);
      setMessage(`근거 초안을 저장했어요. 상태 ${result.status} · 별도 검수자가 확인해야 합니다.`);
      setEvidenceTitle("");
      setEvidenceUrl("");
      setEvidenceClaims("");
      await load();
    });
  };

  const reviewEvidence = async (approved: boolean) => {
    if (!canApprove) return;
    await run(`evidence-review-${approved ? "approve" : "reject"}`, async () => {
      const result = await reviewRelease5EvidenceSource(reviewEvidenceId.trim(), {
        expectedContentHash: reviewEvidenceHash.trim(),
        approved
      });
      setMessage(`근거 검수를 ${approved ? "승인" : "반려"}했어요. 상태 ${result.status}. 캡처 담당자와 다른 계정만 처리할 수 있습니다.`);
    });
  };

  const saveSafetyMapping = async (event: FormEvent) => {
    event.preventDefault();
    await run("safety-mapping", async () => {
      const result = await upsertRelease5SafetyAlternative(safetySourceItemId.trim(), {
        alternativeItemDefinitionId: safetyAlternativeItemId.trim(),
        reason: safetyReason.trim()
      });
      setMessage(`안전 대체 매핑을 저장했어요. ${result.active ? "기존 승인 유지" : "비활성 · 별도 승인 필요"}.`);
    });
  };

  const approveSafetyMapping = async () => {
    if (!canApprove) return;
    await run("safety-approve", async () => {
      const result = await approveRelease5SafetyAlternative(safetySourceItemId.trim(), {
        alternativeItemDefinitionId: safetyAlternativeItemId.trim(),
        evidenceSourceId: safetyEvidenceId.trim()
      });
      setMessage(`안전 대체 품목을 활성화했어요. 근거 ${result.evidenceSourceId}. 캡처·검수·활성화 담당자는 서로 달라야 합니다.`);
    });
  };

  const deactivateSafetyMapping = async () => {
    if (!canApprove || !window.confirm("이 안전 대체 품목을 즉시 비활성화할까요? 가족 화면에서 더 이상 노출되지 않습니다.")) return;
    await run("safety-deactivate", async () => {
      await deactivateRelease5SafetyAlternative(safetySourceItemId.trim(), safetyAlternativeItemId.trim());
      setMessage("안전 대체 품목을 비활성화했어요.");
    });
  };

  const previewPilot = async () => {
    if (selectedPilotIds.length === 0 || !window.confirm(`준비 완료된 저위험 품목 ${selectedPilotIds.length}개의 게시 manifest 미리보기를 만들까요? 실제 게시되지는 않습니다.`)) return;
    await run("pilot-preview", async () => {
      const result = await previewRelease5PilotManifest(selectedPilotIds);
      setMessage(`pilot manifest 미리보기를 만들었어요. ${result.itemIds.length}개 · 게시되지 않음`);
      setSelectedPilotIds([]);
    });
  };

  const previewMerchant = async (event: FormEvent) => {
    event.preventDefault();
    await run("merchant-preview", async () => {
      const result = await previewRelease5MerchantFeed(merchantSource.trim(), parseMerchantRows(merchantJson));
      setMerchantSummary({ valid: result.import.resultJson.valid, invalid: result.import.resultJson.invalid, duplicate: result.duplicate });
      setMessage("상품 feed preview를 저장했어요. 검수·게시 전이며 public offer 수치는 바뀌지 않았어요.");
    });
  };

  const readyItems = pilot?.items.filter((item) => item.ready).slice(0, 50) ?? [];
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Release 5 준비 콘솔</h1>
        <p>법률·카탈로그·리콜·상품 feed를 미리 검증합니다. 외부 승인과 credential이 없으면 게시 기능은 닫혀 있어요.</p>
      </div>
      <p className={styles.errorBanner}>EXTERNAL_BLOCKED · 이 화면의 preview나 draft는 법률 승인, 전문가 검수, live provider 연결을 대신하지 않습니다.</p>
      {error ? <p role="alert" className={styles.errorBanner}>{error}<button className={styles.retryButton} onClick={() => void load()}>다시 시도</button></p> : null}
      {message ? <p role="status" className={styles.successBanner}>{message}</p> : null}
      {!pilot || !recalls ? <p className={styles.emptyState}>준비 상태를 불러오는 중...</p> : <>
        <section className={styles.card}>
          <h2>저위험 catalog pilot</h2>
          <p>후보 {pilot.counts.candidates} · 준비 완료 {pilot.counts.ready} · 승인 상태 전 {pilot.counts.notApproved} · 구조 누락 {pilot.counts.missingStructure} · 근거 누락 {pilot.counts.missingEvidence} · editorial 승인 누락 {pilot.counts.missingEditorialApproval} · domain 승인 누락 {pilot.counts.missingDomainApproval} · 승인자 분리 누락 {pilot.counts.missingApprovalReviewerSeparation}</p>
          {readyItems.length === 0 ? <p className={styles.emptyState}>현재 manifest에 넣을 수 있는 승인 완료 저위험 품목이 없어요.</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>선택</th><th>품목</th><th>revision</th><th>구조</th><th>근거</th><th>editorial 승인</th><th>domain 승인</th><th>승인자 분리</th></tr></thead><tbody>{readyItems.map((item) => <tr key={item.id}><td><input aria-label={`${item.nameKo} pilot 선택`} type="checkbox" checked={selectedPilotIds.includes(item.id)} disabled={!canDraft || pendingAction !== null} onChange={() => setSelectedPilotIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /></td><td>{item.nameKo}<br /><span className={styles.hint}>{item.code}</span></td><td>{item.contentVersion}</td><td>{item.structureReady ? "완료" : "누락"}</td><td>{item.evidenceReady ? "완료" : "누락"}</td><td>{item.editorialApproved ? "완료" : "누락"}</td><td>{item.domainApproved ? "완료" : "누락"}</td><td>{item.approvalReviewersIndependent ? "완료" : "누락"}</td></tr>)}</tbody></table></div>}
          {canDraft ? <button className={styles.secondaryButton} disabled={pendingAction !== null || selectedPilotIds.length === 0} onClick={() => void previewPilot()}>선택 manifest 미리보기</button> : <p className={styles.hint}>읽기 전용 역할입니다.</p>}
        </section>

        <section className={styles.card}>
          <h2>Recall 수동 검수 worklist</h2>
          {recalls.events.length === 0 ? <p className={styles.emptyState}>검수 대기 recall event가 없어요. live credential이 없으면 정상입니다.</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>provider</th><th>상태</th><th>제목</th><th>canonical 연결</th></tr></thead><tbody>{recalls.events.map((event) => <tr key={event.id}><td>{event.providerKey} / {event.providerEventId} v{event.providerVersion}</td><td>{event.eventStatus}</td><td>{event.title}</td><td>{event.itemDefinitionId ?? "수동 연결 필요"} · 신뢰도 {event.matchConfidence}</td></tr>)}</tbody></table></div>}
          <p className={styles.hint}>unknown 상태는 안전으로 승인할 수 없으며, 실제 검수 결정은 독립된 admin 승인 단계에서 수행합니다.</p>
        </section>
      </>}

      <section className={styles.card}>
        <h2>법률 문서 후보</h2>
        <form className={styles.form} onSubmit={(event) => void previewLegal(event)}>
          <div className={styles.field}><label htmlFor="release5-legal-json">승인 원문 후보 JSON</label><textarea id="release5-legal-json" rows={14} value={legalJson} onChange={(event) => { setLegalJson(event.target.value); setLegalPreview(null); }} readOnly={!canDraft} /></div>
          {canDraft ? <div className={styles.actions}><button className={styles.primaryButton} disabled={pendingAction !== null} type="submit">형식·hash 미리보기</button><button className={styles.secondaryButton} disabled={pendingAction !== null || !legalPreview} type="button" onClick={() => void importLegal()}>승인 전 후보로 가져오기</button></div> : null}
          {legalPreview ? <p className={styles.hint}>SHA-256 {legalPreview.contentHash} · placeholder 아님 · 아직 승인/게시되지 않음</p> : null}
        </form>
      </section>

      <section className={styles.card}>
        <h2>Source evidence 초안</h2>
        <form className={styles.form} onSubmit={(event) => void createEvidence(event)}>
          <div className={styles.formGrid}>
            <div className={styles.field}><label htmlFor="evidence-item">canonical item ID</label><input id="evidence-item" type="text" value={evidenceItemId} onChange={(event) => setEvidenceItemId(event.target.value)} readOnly={!canDraft} /></div>
            <div className={styles.field}><label htmlFor="evidence-revision">revision</label><input id="evidence-revision" type="number" min="1" value={evidenceRevision} onChange={(event) => setEvidenceRevision(event.target.value)} readOnly={!canDraft} /></div>
            <div className={styles.field}><label htmlFor="evidence-title">근거 제목</label><input id="evidence-title" type="text" value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} readOnly={!canDraft} /></div>
            <div className={styles.field}><label htmlFor="evidence-url">공개 HTTPS URL</label><input id="evidence-url" type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} readOnly={!canDraft} /></div>
          </div>
          <div className={styles.field}><label htmlFor="evidence-claims">적용 claim (한 줄에 하나)</label><textarea id="evidence-claims" value={evidenceClaims} onChange={(event) => setEvidenceClaims(event.target.value)} readOnly={!canDraft} /></div>
          <p className={styles.hint}>안전 대체 근거는 `safety_alternative:&lt;대체 품목 UUID&gt;` claim을 정확히 포함해야 합니다.</p>
          {canDraft ? <button className={styles.primaryButton} disabled={pendingAction !== null || !evidenceItemId.trim() || !evidenceTitle.trim() || !evidenceUrl.trim()} type="submit">검수 전 근거 초안 저장</button> : null}
          {evidenceResult ? <p className={styles.hint}>evidence ID {evidenceResult.id}<br />SHA-256 {evidenceResult.contentHash} · {evidenceResult.status}</p> : null}
        </form>
        {canApprove ? <div className={styles.form}>
          <h3>독립 근거 검수</h3>
          <p className={styles.hint}>초안을 만든 계정과 다른 admin으로 로그인해 ID와 hash를 대조하세요.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}><label htmlFor="review-evidence-id">evidence ID</label><input id="review-evidence-id" value={reviewEvidenceId} onChange={(event) => setReviewEvidenceId(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor="review-evidence-hash">expected SHA-256</label><input id="review-evidence-hash" value={reviewEvidenceHash} onChange={(event) => setReviewEvidenceHash(event.target.value)} /></div>
          </div>
          <div className={styles.actions}>
            <button className={styles.primaryButton} disabled={pendingAction !== null || !reviewEvidenceId.trim() || !reviewEvidenceHash.trim()} type="button" onClick={() => void reviewEvidence(true)}>근거 승인</button>
            <button className={styles.secondaryButton} disabled={pendingAction !== null || !reviewEvidenceId.trim() || !reviewEvidenceHash.trim()} type="button" onClick={() => void reviewEvidence(false)}>근거 반려</button>
          </div>
        </div> : null}
      </section>

      <section className={styles.card}>
        <h2>검증된 안전 대체 품목</h2>
        <p className={styles.hint}>매핑 저장은 비활성 초안입니다. current revision·공식/전문 근거·정확한 alternative claim을 독립 검수한 뒤 세 번째 admin이 활성화합니다.</p>
        <form className={styles.form} onSubmit={(event) => void saveSafetyMapping(event)}>
          <div className={styles.formGrid}>
            <div className={styles.field}><label htmlFor="safety-source-item">리콜 원본 item ID</label><input id="safety-source-item" value={safetySourceItemId} onChange={(event) => setSafetySourceItemId(event.target.value)} readOnly={!canDraft} /></div>
            <div className={styles.field}><label htmlFor="safety-alternative-item">게시된 대체 item ID</label><input id="safety-alternative-item" value={safetyAlternativeItemId} onChange={(event) => setSafetyAlternativeItemId(event.target.value)} readOnly={!canDraft} /></div>
          </div>
          <div className={styles.field}><label htmlFor="safety-reason">가족에게 표시할 대체 사유</label><input id="safety-reason" maxLength={240} value={safetyReason} onChange={(event) => setSafetyReason(event.target.value)} readOnly={!canDraft} /></div>
          {canDraft ? <button className={styles.primaryButton} disabled={pendingAction !== null || !safetySourceItemId.trim() || !safetyAlternativeItemId.trim() || !safetyReason.trim()} type="submit">비활성 매핑 저장</button> : null}
          {canApprove ? <>
            <div className={styles.field}><label htmlFor="safety-evidence-id">승인된 evidence ID</label><input id="safety-evidence-id" value={safetyEvidenceId} onChange={(event) => setSafetyEvidenceId(event.target.value)} /></div>
            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={pendingAction !== null || !safetySourceItemId.trim() || !safetyAlternativeItemId.trim() || !safetyEvidenceId.trim()} type="button" onClick={() => void approveSafetyMapping()}>세 번째 담당자로 활성화</button>
              <button className={styles.secondaryButton} disabled={pendingAction !== null || !safetySourceItemId.trim() || !safetyAlternativeItemId.trim()} type="button" onClick={() => void deactivateSafetyMapping()}>즉시 비활성화</button>
            </div>
          </> : null}
        </form>
      </section>

      <section className={styles.card}>
        <h2>Merchant feed preview</h2>
        <form className={styles.form} onSubmit={(event) => void previewMerchant(event)}>
          <div className={styles.field}><label htmlFor="merchant-source">source 이름</label><input id="merchant-source" type="text" value={merchantSource} onChange={(event) => setMerchantSource(event.target.value)} readOnly={!canDraft} /></div>
          <div className={styles.field}><label htmlFor="merchant-json">feed JSON 배열 (최대 1,000행)</label><textarea id="merchant-json" rows={12} value={merchantJson} onChange={(event) => setMerchantJson(event.target.value)} readOnly={!canDraft} /></div>
          {canDraft ? <button className={styles.primaryButton} disabled={pendingAction !== null || !merchantSource.trim()} type="submit">검증 preview</button> : null}
          {merchantSummary ? <p>유효 {merchantSummary.valid} · 무효 {merchantSummary.invalid} · {merchantSummary.duplicate ? "중복 feed" : "신규 preview"} · 공개 0</p> : <p className={styles.hint}>live merchant 조건이 없으면 서버가 fail-closed로 거절합니다.</p>}
        </form>
      </section>
    </div>
  );
}
