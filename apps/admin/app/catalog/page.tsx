"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AdminApiError,
  applyCatalogTaxonomyReorder,
  applyCatalogV2Import,
  archiveCatalogTaxonomyNode,
  catalogV2ImportErrorsUrl,
  createCatalogTaxonomyNode,
  getCatalogTaxonomyTree,
  getCatalogItemRevisions,
  getCatalogV2Coverage,
  getCatalogV2Queues,
  isAuthError,
  listCatalogV2Items,
  previewCatalogV2Import,
  previewCatalogV2FileImport,
  previewCatalogItemRollback,
  previewCatalogTaxonomyArchive,
  previewCatalogTaxonomyReorder,
  publishCatalogV2Item,
  requestCatalogV2ItemReview,
  resolveCatalogReports,
  retryCatalogOfferHealth,
  rollbackCatalogItem,
  reviewCatalogV2Item,
  updateCatalogTaxonomyNode,
  type CatalogTaxonomyArchiveImpact,
  type CatalogTaxonomyNode,
  type CatalogTaxonomyReorderInput,
  type CatalogTaxonomyReorderPreview,
  type CatalogDraftImportPreviewResponse,
  type CatalogDraftImportRowInput,
  type CatalogItemRevisionHistory,
  type CatalogRollbackPreview,
  type CatalogV2AdminItem,
  type CatalogV2Coverage,
  type CatalogV2QueueKey,
  type CatalogV2Queues,
  type CatalogQueueTarget
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseImportRows(value: string): CatalogDraftImportRowInput[] {
  const parsed: unknown = JSON.parse(value);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "rows" in parsed
      ? (parsed as { rows?: unknown }).rows
      : null;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1000) {
    throw new Error("JSON은 1~1,000개의 행 배열 또는 { rows: [...] } 형식이어야 해요.");
  }
  if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("각 행은 품목 code와 편집 필드를 가진 객체여야 해요.");
  }
  return rows as CatalogDraftImportRowInput[];
}

const QUEUE_LABELS: Record<CatalogV2QueueKey, string> = {
  missingMetadata: "필수 메타데이터 누락",
  reviewRequired: "검수 대기",
  expiredReviews: "검수 기한 경과",
  duplicateCandidates: "중복 후보",
  brokenOffers: "링크 차단·리콜",
  staleOffers: "가격 확인 필요",
  openReports: "사용자 신고"
};
const QUEUE_KEYS = Object.keys(QUEUE_LABELS) as CatalogV2QueueKey[];
const QUEUE_PAGE_SIZE = 20;
const emptyQueueTextState = () => Object.fromEntries(QUEUE_KEYS.map((key) => [key, ""])) as Record<CatalogV2QueueKey, string>;
const emptyQueuePageState = () => Object.fromEntries(QUEUE_KEYS.map((key) => [key, 0])) as Record<CatalogV2QueueKey, number>;
const MISSING_FIELD_LABELS = {
  shortDescription: "짧은 설명",
  reasonText: "추천 이유",
  timingSummary: "준비 시기",
  sourceSummary: "출처 요약"
} as const;
const QUEUE_BLOCKED_REASON_LABELS: Record<string, string> = {
  RECALLED_OFFER_REQUIRES_MANUAL_REVIEW: "리콜 상품은 수동 검토가 필요해요.",
  BLOCKED_OFFER_REQUIRES_MANUAL_REVIEW: "차단 상품은 수동 검토가 필요해요.",
  NATIVE_OFFER_HEALTH_PROCESSOR_NOT_CONNECTED: "R4 네이티브 링크 검사기가 아직 연결되지 않았어요.",
  HEALTH_RETRY_NOT_APPLICABLE: "이 상태에는 자동 재검사를 적용할 수 없어요.",
  HEALTH_RETRY_QUEUED: "링크 재검사 작업이 발행 대기 중이에요.",
  HEALTH_RETRY_PROCESSING: "링크 재검사 작업이 처리 중이에요.",
  HEALTH_RETRY_DEAD_LETTER: "재검사가 실패했어요. 운영 콘솔의 DLQ에서 확인하세요.",
  PRICE_PROVIDER_NOT_CONNECTED: "가격 제공자가 연결되지 않아 자동 갱신할 수 없어요."
};

type QueueDisplayRow = {
  id: string;
  title: string;
  detail: string;
  targets: CatalogQueueTarget[];
  facts?: string;
  reportId?: string;
  retryOfferId?: string;
  actionNote?: string;
};

function queueDisplayRows(queues: CatalogV2Queues, key: CatalogV2QueueKey): QueueDisplayRow[] {
  if (key === "missingMetadata") return queues.missingMetadata.map((row) => ({
    id: row.itemId, title: row.itemName, targets: [row],
    detail: `누락: ${row.missingFields.map((field) => MISSING_FIELD_LABELS[field]).join(", ")}`
  }));
  if (key === "reviewRequired") return queues.reviewRequired.map((row) => ({
    id: row.itemId, title: row.itemName, targets: [row], detail: row.professionalReviewRequired ? "전문가 근거와 별도 검수자가 필요해요." : "검수 후 게시할 수 있어요.",
    facts: `${row.status} · ${row.safetyTier}`
  }));
  if (key === "expiredReviews") return queues.expiredReviews.map((row) => ({
    id: row.safetyRuleId, title: row.itemName, targets: [row], detail: `안전 검수 만료: ${new Date(row.expiresAt).toLocaleDateString("ko-KR")}`,
    facts: row.severity
  }));
  if (key === "duplicateCandidates") return queues.duplicateCandidates.map((row) => ({
    id: row.normalizedName, title: `정규화 명칭: ${row.normalizedName}`, targets: row.targets,
    detail: `${row.targets.length}개 품목이 같은 검색 명칭을 사용해요.`
  }));
  if (key === "brokenOffers") return queues.brokenOffers.map((row) => ({
    id: row.offerId, title: `${row.seller} · ${row.productName}`, targets: [row],
    detail: `링크 ${row.healthState} · 리콜 ${row.recallState}`,
    facts: `최근 변경 ${new Date(row.updatedAt).toLocaleDateString("ko-KR")}`,
    ...(row.retryEligible ? { retryOfferId: row.offerId } : { actionNote: QUEUE_BLOCKED_REASON_LABELS[row.retryBlockedReason ?? "HEALTH_RETRY_NOT_APPLICABLE"] })
  }));
  if (key === "staleOffers") return queues.staleOffers.map((row) => ({
    id: row.offerId, title: `${row.seller} · ${row.productName}`, targets: [row],
    detail: row.priceCheckedAt ? `마지막 가격 확인 ${new Date(row.priceCheckedAt).toLocaleDateString("ko-KR")}` : "가격 확인 이력이 없어요.",
    facts: row.priceSnapshotKrw === null ? "가격 미등록" : `${row.priceSnapshotKrw.toLocaleString("ko-KR")}원`,
    actionNote: QUEUE_BLOCKED_REASON_LABELS[row.refreshBlockedReason]
  }));
  return queues.openReports.map((row) => ({
    id: row.reportId, title: row.itemName, targets: row.itemId && row.itemCode ? [{ itemId: row.itemId, itemCode: row.itemCode, itemName: row.itemName }] : [], reportId: row.reportId,
    detail: `${row.reasonCode}${row.detail ? ` · ${row.detail}` : ""}`,
    facts: new Date(row.createdAt).toLocaleString("ko-KR")
  }));
}

export default function CatalogOperationsPage() {
  const { session, clearSession } = useAdminSession();
  const [items, setItems] = useState<CatalogV2AdminItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [coverage, setCoverage] = useState<CatalogV2Coverage | null>(null);
  const [queues, setQueues] = useState<CatalogV2Queues | null>(null);
  const [activeQueue, setActiveQueue] = useState<CatalogV2QueueKey>("reviewRequired");
  const [queueFilters, setQueueFilters] = useState<Record<CatalogV2QueueKey, string>>(emptyQueueTextState);
  const [queuePages, setQueuePages] = useState<Record<CatalogV2QueueKey, number>>(emptyQueuePageState);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [queueWorkingId, setQueueWorkingId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [taxonomyNodes, setTaxonomyNodes] = useState<CatalogTaxonomyNode[] | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [taxonomyMessage, setTaxonomyMessage] = useState<string | null>(null);
  const [taxonomyWorking, setTaxonomyWorking] = useState(false);
  const [createLevel, setCreateLevel] = useState<CatalogTaxonomyNode["level"]>("subcategory");
  const [createParentId, setCreateParentId] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [selectedTaxonomyId, setSelectedTaxonomyId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [archiveImpact, setArchiveImpact] = useState<CatalogTaxonomyArchiveImpact | null>(null);
  const [reorderInput, setReorderInput] = useState<CatalogTaxonomyReorderInput | null>(null);
  const [reorderPreview, setReorderPreview] = useState<CatalogTaxonomyReorderPreview | null>(null);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CatalogV2AdminItem["status"] | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [safetyEvidence, setSafetyEvidence] = useState<Record<string, { url: string; title: string }>>({});
  const [importPreview, setImportPreview] = useState<CatalogDraftImportPreviewResponse | null>(null);
  const [selectedImportRows, setSelectedImportRows] = useState<number[]>([]);
  const [importWorking, setImportWorking] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [revisionItem, setRevisionItem] = useState<CatalogV2AdminItem | null>(null);
  const [revisionHistory, setRevisionHistory] = useState<CatalogItemRevisionHistory | null>(null);
  const [rollbackPreview, setRollbackPreview] = useState<CatalogRollbackPreview | null>(null);
  const [revisionWorking, setRevisionWorking] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionMessage, setRevisionMessage] = useState<string | null>(null);
  const queueRequestRef = useRef<Promise<CatalogV2Queues> | null>(null);

  const getQueuesSingleFlight = useCallback(() => {
    if (queueRequestRef.current) return queueRequestRef.current;
    const request = getCatalogV2Queues().finally(() => {
      if (queueRequestRef.current === request) queueRequestRef.current = null;
    });
    queueRequestRef.current = request;
    return request;
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [itemResult, coverageResult, queueResult, taxonomyResult] = await Promise.all([
        listCatalogV2Items({ query: query || undefined, status: status === "all" ? undefined : status }),
        getCatalogV2Coverage(),
        getQueuesSingleFlight(),
        getCatalogTaxonomyTree()
      ]);
      setItems(itemResult.items);
      setTotal(itemResult.total);
      setCoverage(coverageResult);
      setQueues(queueResult);
      setTaxonomyNodes(taxonomyResult.nodes);
    } catch (loadError) {
      if (isAuthError(loadError)) return clearSession();
      setError("Release 4 카탈로그 운영 정보를 불러오지 못했어요.");
    }
  }, [clearSession, getQueuesSingleFlight, query, session, status]);

  const reloadQueues = useCallback(async () => {
    if (!session) return;
    setQueues(await getQueuesSingleFlight());
  }, [getQueuesSingleFlight, session]);

  useEffect(() => { void load(); }, [load]);
  if (!session) return null;
  const isAdmin = session.admin.role === "admin";
  const canEdit = isAdmin || session.admin.role === "editor";

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(queryDraft.trim());
  };

  const selectImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportWorking(true);
    setImportError(null);
    setImportMessage(null);
    setImportPreview(null);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("가져오기 파일은 2MB 이하여야 해요.");
      const extension = file.name.split(".").at(-1)?.toLocaleLowerCase();
      const preview = extension === "json"
        ? await file.text().then(async (raw) => previewCatalogV2Import({ sourceName: file.name, sourceHash: await sha256Hex(raw), rows: parseImportRows(raw) }))
        : extension === "csv" || extension === "xlsx"
          ? await previewCatalogV2FileImport(file)
          : (() => { throw new Error("JSON, CSV 또는 XLSX 파일만 선택할 수 있어요."); })();
      setImportPreview(preview);
      setSelectedImportRows(preview.preview.rows.filter((row) => row.valid).map((row) => row.rowNumber));
    } catch (previewError) {
      if (isAuthError(previewError)) return clearSession();
      setImportError(previewError instanceof Error ? previewError.message : "가져오기 preview를 만들지 못했어요.");
    } finally {
      setImportWorking(false);
    }
  };

  const toggleImportRow = (rowNumber: number) => {
    setSelectedImportRows((current) =>
      current.includes(rowNumber) ? current.filter((value) => value !== rowNumber) : [...current, rowNumber]
    );
  };

  const applyImport = async () => {
    if (!importPreview || selectedImportRows.length === 0) return;
    if (!window.confirm(`선택한 유효 행 ${selectedImportRows.length}개를 draft로 적용할까요? 적용 후 다시 검수해야 해요.`)) {
      return;
    }
    setImportWorking(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const result = await applyCatalogV2Import(importPreview.import.id, importPreview.import.version, selectedImportRows);
      setImportMessage(`${result.appliedCount}개 행을 draft로 적용했어요. 재검수 후 게시하세요.`);
      setSelectedImportRows([]);
      await load();
    } catch (applyError) {
      if (isAuthError(applyError)) return clearSession();
      setImportError("선택한 행을 적용하지 못했어요. preview 상태와 권한을 확인하세요.");
    } finally {
      setImportWorking(false);
    }
  };

  const runAction = async (item: CatalogV2AdminItem, action: "request" | "editorial" | "domain" | "safety" | "publish") => {
    setWorkingId(item.id);
    setError(null);
    try {
      if (action === "request") {
        if (!item.contentHash) throw new Error("missing content hash");
        await requestCatalogV2ItemReview(item.id, item.contentVersion, item.contentHash);
      }
      else if (action === "publish") {
        if (!item.contentHash) throw new Error("missing content hash");
        await publishCatalogV2Item(item.id, item.contentVersion, item.contentHash);
      } else {
        if (!item.contentHash) throw new Error("missing content hash");
        const evidence = safetyEvidence[item.id];
        if (action === "safety" && (!evidence?.url.trim() || !evidence.title.trim())) {
          setError("안전 검수에는 승인된 외부 전문가 근거 URL과 제목이 필요해요.");
          return;
        }
        await reviewCatalogV2Item(item.id, {
          reviewType: action,
          expectedVersion: item.contentVersion,
          contentHash: item.contentHash,
          professionalReviewConfirmed: action === "safety",
          ...(action === "safety" ? {
            evidenceUrl: evidence!.url.trim(),
            evidenceTitle: evidence!.title.trim()
          } : {})
        });
      }
      await load();
    } catch (actionError) {
      if (isAuthError(actionError)) return clearSession();
      setError(
        actionError instanceof AdminApiError && actionError.status === 409
          ? "다른 운영자가 먼저 변경했어요. 입력 내용은 유지했으니 최신 revision을 불러온 뒤 다시 확인해 주세요."
          : action === "publish"
            ? "게시 gate를 통과하지 못했어요."
            : "요청 또는 검수를 완료하지 못했어요. 역할 분리와 최신 revision을 확인하세요."
      );
    } finally {
      setWorkingId(null);
    }
  };

  const selectTaxonomyNode = (node: CatalogTaxonomyNode) => {
    setSelectedTaxonomyId(node.id);
    setEditName(node.nameKo);
    setEditDescription(node.description ?? "");
    setArchiveImpact(null);
    setTaxonomyError(null);
    setTaxonomyMessage(null);
  };

  const createTaxonomyNode = async () => {
    if (!createCode.trim() || !createName.trim() || (createLevel !== "domain" && !createParentId)) return;
    setTaxonomyWorking(true);
    setTaxonomyError(null);
    setTaxonomyMessage(null);
    try {
      await createCatalogTaxonomyNode({
        code: createCode.trim(),
        level: createLevel,
        ...(createLevel === "domain" ? {} : { parentId: createParentId }),
        nameKo: createName.trim(),
        ...(createDescription.trim() ? { description: createDescription.trim() } : {})
      });
      setCreateCode("");
      setCreateName("");
      setCreateDescription("");
      setTaxonomyMessage("분류를 생성했어요.");
      await load();
    } catch (taxonomyActionError) {
      if (isAuthError(taxonomyActionError)) return clearSession();
      setTaxonomyError("분류를 생성하지 못했어요. 코드 계층과 중복 여부를 확인하세요.");
    } finally {
      setTaxonomyWorking(false);
    }
  };

  const updateTaxonomyNode = async () => {
    const node = taxonomyNodes?.find((candidate) => candidate.id === selectedTaxonomyId);
    if (!node || !editName.trim()) return;
    setTaxonomyWorking(true);
    setTaxonomyError(null);
    setTaxonomyMessage(null);
    try {
      await updateCatalogTaxonomyNode(node.id, {
        expectedVersion: node.version,
        nameKo: editName.trim(),
        description: editDescription.trim()
      });
      setTaxonomyMessage("분류 정보를 저장했어요.");
      setArchiveImpact(null);
      await load();
    } catch (taxonomyActionError) {
      if (isAuthError(taxonomyActionError)) return clearSession();
      setTaxonomyError(
        taxonomyActionError instanceof AdminApiError && taxonomyActionError.status === 409
          ? "다른 운영자가 이 분류를 먼저 변경했어요. 입력 내용은 유지했으니 최신 버전을 다시 불러오세요."
          : "분류를 저장하지 못했어요. 다른 운영자의 변경 여부를 확인하세요."
      );
    } finally {
      setTaxonomyWorking(false);
    }
  };

  const previewTaxonomyArchive = async () => {
    const node = taxonomyNodes?.find((candidate) => candidate.id === selectedTaxonomyId);
    if (!node) return;
    setTaxonomyWorking(true);
    setTaxonomyError(null);
    setTaxonomyMessage(null);
    try {
      setArchiveImpact(await previewCatalogTaxonomyArchive(node.id));
    } catch (taxonomyActionError) {
      if (isAuthError(taxonomyActionError)) return clearSession();
      setTaxonomyError("보관 영향도를 계산하지 못했어요.");
    } finally {
      setTaxonomyWorking(false);
    }
  };

  const applyTaxonomyArchive = async () => {
    if (!archiveImpact?.canArchive || !isAdmin) return;
    setTaxonomyWorking(true);
    setTaxonomyError(null);
    setTaxonomyMessage(null);
    try {
      await archiveCatalogTaxonomyNode(archiveImpact.node.id, archiveImpact.node.version);
      setSelectedTaxonomyId("");
      setArchiveImpact(null);
      setTaxonomyMessage("분류를 보관했어요. 데이터는 삭제되지 않아요.");
      await load();
    } catch (taxonomyActionError) {
      if (isAuthError(taxonomyActionError)) return clearSession();
      setTaxonomyError("분류를 보관하지 못했어요. 영향도를 다시 확인하세요.");
    } finally {
      setTaxonomyWorking(false);
    }
  };

  const moveTaxonomyNode = async (node: CatalogTaxonomyNode, direction: -1 | 1) => {
    if (!taxonomyNodes) return;
    const siblings = taxonomyNodes.filter((candidate) => candidate.parentId === node.parentId);
    const index = siblings.findIndex((candidate) => candidate.id === node.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return;
    const ordered = [...siblings];
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex]!, ordered[index]!];
    const input: CatalogTaxonomyReorderInput = {
      ...(node.parentId ? { parentId: node.parentId } : {}),
      nodes: ordered.map((candidate) => ({ id: candidate.id, expectedVersion: candidate.version }))
    };
    setTaxonomyWorking(true);
    setTaxonomyError(null);
    setTaxonomyMessage(null);
    try {
      setReorderInput(input);
      setReorderPreview(await previewCatalogTaxonomyReorder(input));
    } catch (taxonomyActionError) {
      if (isAuthError(taxonomyActionError)) return clearSession();
      setReorderInput(null);
      setReorderPreview(null);
      setTaxonomyError("순서 변경 미리보기를 만들지 못했어요. 활성 형제 전체를 다시 불러오세요.");
    } finally {
      setTaxonomyWorking(false);
    }
  };

  const applyTaxonomyReorder = async () => {
    if (!reorderInput || !reorderPreview?.canApply) return;
    setTaxonomyWorking(true);
    setTaxonomyError(null);
    setTaxonomyMessage(null);
    try {
      const result = await applyCatalogTaxonomyReorder(reorderInput);
      setTaxonomyMessage(`${result.appliedCount ?? result.changes.length}개 분류의 순서를 반영했어요.`);
      setReorderInput(null);
      setReorderPreview(null);
      setArchiveImpact(null);
      await load();
    } catch (taxonomyActionError) {
      if (isAuthError(taxonomyActionError)) return clearSession();
      setTaxonomyError("순서를 반영하지 못했어요. 분류 버전을 다시 확인하세요.");
    } finally {
      setTaxonomyWorking(false);
    }
  };

  const focusQueueTarget = (target: CatalogQueueTarget) => {
    setQueryDraft(target.itemCode);
    setQuery(target.itemCode);
    setStatus("all");
    window.requestAnimationFrame(() => document.getElementById("catalog-items")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const toggleReport = (reportId: string) => {
    setSelectedReportIds((current) => current.includes(reportId) ? current.filter((id) => id !== reportId) : [...current, reportId]);
  };

  const resolveSelectedReports = async () => {
    if (!canEdit || selectedReportIds.length === 0 || !window.confirm(`선택한 신고 ${selectedReportIds.length}건을 해결 상태로 바꿀까요?`)) return;
    setQueueWorkingId("reports");
    setQueueError(null);
    setQueueMessage(null);
    try {
      const result = await resolveCatalogReports(selectedReportIds, "Admin 운영 큐에서 선택 해결");
      setSelectedReportIds([]);
      setQueueMessage(`사용자 신고 ${result.resolvedCount}건을 해결했어요.`);
      await reloadQueues();
    } catch (queueActionError) {
      if (isAuthError(queueActionError)) return clearSession();
      setQueueError("신고 상태가 달라졌거나 권한이 없어요. 큐를 다시 불러오세요.");
    } finally {
      setQueueWorkingId(null);
    }
  };

  const retryOfferHealth = async (offerId: string) => {
    if (!isAdmin) return;
    setQueueWorkingId(offerId);
    setQueueError(null);
    setQueueMessage(null);
    try {
      const result = await retryCatalogOfferHealth(offerId);
      setQueueMessage(result.alreadyQueued ? `이미 ${result.state === "processing" ? "처리 중인" : "대기 중인"} 링크 재검사 작업이 있어요.` : "링크 health 재검사 작업을 등록했어요.");
      await reloadQueues();
    } catch (queueActionError) {
      if (isAuthError(queueActionError)) return clearSession();
      setQueueError("이 상품 링크는 자동 재검사할 수 없어요. 상태와 처리기 연결을 확인하세요.");
    } finally {
      setQueueWorkingId(null);
    }
  };

  const showRevisionHistory = async (item: CatalogV2AdminItem) => {
    setRevisionItem(item);
    setRevisionHistory(null);
    setRollbackPreview(null);
    setRevisionError(null);
    setRevisionMessage(null);
    setRevisionWorking(true);
    try {
      setRevisionHistory(await getCatalogItemRevisions(item.id));
    } catch (historyError) {
      if (isAuthError(historyError)) return clearSession();
      setRevisionError("revision 이력을 불러오지 못했어요.");
    } finally {
      setRevisionWorking(false);
    }
  };

  const previewRollback = async (targetRevision: number) => {
    if (!revisionItem?.contentHash) return;
    setRevisionWorking(true);
    setRevisionError(null);
    setRevisionMessage(null);
    try {
      setRollbackPreview(await previewCatalogItemRollback(revisionItem.id, targetRevision, revisionItem.contentVersion, revisionItem.contentHash));
    } catch (previewError) {
      if (isAuthError(previewError)) return clearSession();
      setRevisionError("rollback preview를 만들지 못했어요. 현재 revision을 다시 확인하세요.");
    } finally {
      setRevisionWorking(false);
    }
  };

  const applyRollback = async () => {
    if (!revisionItem?.contentHash || !rollbackPreview || !window.confirm(`v${rollbackPreview.targetRevision} 내용을 새 draft v${rollbackPreview.resultRevision}로 복원할까요?`)) return;
    setRevisionWorking(true);
    setRevisionError(null);
    try {
      const result = await rollbackCatalogItem(revisionItem.id, rollbackPreview.targetRevision, revisionItem.contentVersion, revisionItem.contentHash);
      setRevisionMessage(`v${result.rollbackSourceRevision} 내용을 새 draft v${result.item.contentVersion}로 복원했어요. 기존 승인은 적용되지 않아요.`);
      setRevisionItem(result.item);
      setRollbackPreview(null);
      setRevisionHistory(await getCatalogItemRevisions(result.item.id));
      await load();
    } catch (rollbackError) {
      if (isAuthError(rollbackError)) return clearSession();
      setRevisionError("rollback을 적용하지 못했어요. taxonomy와 최신 revision을 확인하세요.");
    } finally {
      setRevisionWorking(false);
    }
  };

  const activeQueueRows = queues ? queueDisplayRows(queues, activeQueue) : [];
  const activeQueueFilter = queueFilters[activeQueue].trim().toLocaleLowerCase("ko-KR");
  const filteredQueueRows = activeQueueFilter
    ? activeQueueRows.filter((row) => `${row.title} ${row.detail} ${row.facts ?? ""}`.toLocaleLowerCase("ko-KR").includes(activeQueueFilter))
    : activeQueueRows;
  const queuePageCount = Math.max(1, Math.ceil(filteredQueueRows.length / QUEUE_PAGE_SIZE));
  const activeQueuePage = Math.min(queuePages[activeQueue], queuePageCount - 1);
  const visibleQueueRows = filteredQueueRows.slice(activeQueuePage * QUEUE_PAGE_SIZE, (activeQueuePage + 1) * QUEUE_PAGE_SIZE);
  const selectedTaxonomyNode = taxonomyNodes?.find((node) => node.id === selectedTaxonomyId) ?? null;
  const parentCandidates = (taxonomyNodes ?? []).filter((node) =>
    createLevel === "category" ? node.level === "domain" : createLevel === "subcategory" ? node.level === "category" : false
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Release 4 카탈로그 운영</h1>
        <p>일반 품목, 검수 gate, 생애주기 coverage, 상품 제안과 사용자 신고를 한곳에서 확인해요.</p>
      </div>

      {error ? <p className={styles.errorBanner}>{error}<button className={styles.retryButton} type="button" onClick={() => void load()}>다시 시도</button></p> : null}

      <section className={styles.card} data-evidence-id="CATALOG-V2-COVERAGE">
        <h2>구조와 게시 상태</h2>
        {!coverage ? <p className={styles.emptyState}>계산 중...</p> : (
          <>
            <p className={coverage.summary.publishBlocked ? styles.errorBanner : styles.successBanner}>
              운영 게시 gate {coverage.summary.publishBlocked ? "차단" : "통과"}
            </p>
            <p>영역 {coverage.summary.domains} · 일반 품목 {coverage.summary.canonicalItems} · alias {coverage.summary.aliases} · 고위험 검수 대기 {coverage.summary.highRiskAwaitingProfessionalReview}</p>
            <p className={styles.hint}>Coverage: {Object.entries(coverage.summary.matrix).map(([key, value]) => `${key} ${value}`).join(" · ")}</p>
          </>
        )}
      </section>

      <section className={styles.card} data-evidence-id="CATALOG-V2-OPERATIONS-QUEUES">
        <h2>운영 큐</h2>
        <p className={styles.hint}>큐를 선택해 원인과 대상 품목을 확인하세요. 자동 처리기가 없는 가격·리콜 상태는 수동 검토로 명확히 표시해요.</p>
        {queueError ? <p className={styles.errorBanner}>{queueError}</p> : null}
        {queueMessage ? <p className={styles.successBanner}>{queueMessage}</p> : null}
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {queues ? QUEUE_KEYS.map((key) => (
            <button className={activeQueue === key ? styles.primaryButton : styles.secondaryButton} key={key} type="button" onClick={() => { setActiveQueue(key); setSelectedReportIds([]); setQueueError(null); setQueueMessage(null); }}>
              {QUEUE_LABELS[key]}<br />{queues.summary[key]}건
            </button>
          )) : <p className={styles.emptyState}>운영 큐를 불러오는 중...</p>}
        </div>
        {queues ? (
          <div style={{ marginTop: 16 }}>
            <h3>{QUEUE_LABELS[activeQueue]} 상세</h3>
            <div className={styles.actions}>
              <label>
                {QUEUE_LABELS[activeQueue]} 필터
                <input
                  aria-label={`${QUEUE_LABELS[activeQueue]} 필터`}
                  value={queueFilters[activeQueue]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setQueueFilters((current) => ({ ...current, [activeQueue]: value }));
                    setQueuePages((current) => ({ ...current, [activeQueue]: 0 }));
                  }}
                />
              </label>
              <span role="status">{filteredQueueRows.length}건 · {activeQueuePage + 1}/{queuePageCount} 페이지</span>
              <button className={styles.secondaryButton} disabled={activeQueuePage === 0} type="button" onClick={() => setQueuePages((current) => ({ ...current, [activeQueue]: activeQueuePage - 1 }))}>이전 페이지</button>
              <button className={styles.secondaryButton} disabled={activeQueuePage + 1 >= queuePageCount} type="button" onClick={() => setQueuePages((current) => ({ ...current, [activeQueue]: activeQueuePage + 1 }))}>다음 페이지</button>
            </div>
            {activeQueue === "openReports" && canEdit && filteredQueueRows.length > 0 ? (
              <div className={styles.actions}>
                <button className={styles.primaryButton} disabled={queueWorkingId !== null || selectedReportIds.length === 0} type="button" onClick={() => void resolveSelectedReports()}>선택 신고 해결 ({selectedReportIds.length})</button>
              </div>
            ) : null}
            {filteredQueueRows.length === 0 ? <p className={styles.emptyState}>{activeQueueFilter ? "필터와 일치하는 항목이 없어요." : "현재 이 큐에는 항목이 없어요."}</p> : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>선택</th><th>대상</th><th>원인</th><th>상태·작업</th></tr></thead>
                  <tbody>{visibleQueueRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.reportId && canEdit ? <input aria-label={`${row.title} 신고 선택`} checked={selectedReportIds.includes(row.reportId)} disabled={queueWorkingId !== null} type="checkbox" onChange={() => toggleReport(row.reportId!)} /> : "-"}</td>
                      <td><strong>{row.title}</strong><div className={styles.actions}>{row.targets.map((target) => <button className={styles.secondaryButton} key={target.itemId} type="button" onClick={() => focusQueueTarget(target)}>{target.itemCode} 품목 보기</button>)}</div></td>
                      <td>{row.detail}</td>
                      <td>{row.facts ? <p>{row.facts}</p> : null}{row.retryOfferId ? (isAdmin ? <button className={styles.primaryButton} disabled={queueWorkingId !== null} type="button" onClick={() => void retryOfferHealth(row.retryOfferId!)}>{queueWorkingId === row.retryOfferId ? "등록 중..." : "링크 재검사"}</button> : <span className={styles.hint}>재검사는 관리자만 가능해요.</span>) : null}{row.actionNote ? <span className={styles.hint}>{row.actionNote}</span> : null}{row.reportId ? <span className={styles.hint}>선택 후 일괄 해결</span> : null}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className={styles.card} data-evidence-id="CATALOG-V2-TAXONOMY">
        <h2>분류체계 운영</h2>
        <p className={styles.hint}>
          삭제 대신 보관하며, 품목·coverage 연결이나 활성 하위 분류가 있으면 보관을 차단해요.
          순서 변경은 활성 형제 전체와 현재 버전을 미리 검증한 뒤 한 번에 반영해요.
        </p>
        {taxonomyError ? <p className={styles.errorBanner}>{taxonomyError}</p> : null}
        {taxonomyMessage ? <p className={styles.successBanner}>{taxonomyMessage}</p> : null}
        {taxonomyNodes === null ? <p className={styles.emptyState}>분류를 불러오는 중...</p> : (
          <>
            <p>활성 분류 {taxonomyNodes.length}개 · 영역 {taxonomyNodes.filter((node) => node.level === "domain").length}개</p>
            {canEdit ? (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 16 }}>
                <select aria-label="새 분류 단계" value={createLevel} onChange={(event) => { setCreateLevel(event.target.value as CatalogTaxonomyNode["level"]); setCreateParentId(""); }}>
                  <option value="domain">영역</option><option value="category">대분류</option><option value="subcategory">소분류</option>
                </select>
                {createLevel !== "domain" ? (
                  <select aria-label="새 분류 상위 분류" value={createParentId} onChange={(event) => setCreateParentId(event.target.value)}>
                    <option value="">상위 분류 선택</option>
                    {parentCandidates.map((node) => <option key={node.id} value={node.id}>{node.code} {node.nameKo}</option>)}
                  </select>
                ) : null}
                <input aria-label="새 분류 코드" placeholder={createLevel === "domain" ? "C25" : createLevel === "category" ? "C25-01" : "C25-01-01"} value={createCode} onChange={(event) => setCreateCode(event.target.value)} />
                <input aria-label="새 분류 이름" placeholder="분류 이름" value={createName} onChange={(event) => setCreateName(event.target.value)} />
                <input aria-label="새 분류 설명" placeholder="설명 (선택)" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} />
                <button className={styles.primaryButton} disabled={taxonomyWorking || !createCode.trim() || !createName.trim() || (createLevel !== "domain" && !createParentId)} type="button" onClick={() => void createTaxonomyNode()}>분류 생성</button>
              </div>
            ) : null}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>분류</th><th>단계</th><th>연결</th><th>버전</th><th>작업</th></tr></thead>
                <tbody>{taxonomyNodes.map((node) => {
                  const siblings = taxonomyNodes.filter((candidate) => candidate.parentId === node.parentId);
                  const siblingIndex = siblings.findIndex((candidate) => candidate.id === node.id);
                  return (
                    <tr key={node.id}>
                      <td><div style={{ paddingLeft: node.depth * 20 }}><strong>{node.nameKo}</strong><br /><span className={styles.hint}>{node.code}</span></div></td>
                      <td>{node.level}</td>
                      <td>직접 품목 {node.directItemCount} · 하위 포함 {node.descendantItemCount} · 하위 분류 {node.directChildCount}</td>
                      <td>v{node.version}</td>
                      <td><div className={styles.actions}>
                        <button className={styles.secondaryButton} type="button" onClick={() => selectTaxonomyNode(node)}>편집</button>
                        {canEdit ? <button aria-label={`${node.nameKo} 위로`} className={styles.secondaryButton} disabled={taxonomyWorking || siblingIndex === 0} type="button" onClick={() => void moveTaxonomyNode(node, -1)}>↑</button> : null}
                        {canEdit ? <button aria-label={`${node.nameKo} 아래로`} className={styles.secondaryButton} disabled={taxonomyWorking || siblingIndex === siblings.length - 1} type="button" onClick={() => void moveTaxonomyNode(node, 1)}>↓</button> : null}
                      </div></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>
        )}
        {reorderPreview ? (
          <div className={styles.hint} style={{ marginTop: 12 }}>
            <strong>순서 변경 미리보기</strong><br />
            {reorderPreview.changes.map((change) => `${change.nameKo}: ${change.currentOrder} → ${change.nextOrder}`).join(" · ")}
            {canEdit ? <div className={styles.actions}><button className={styles.primaryButton} disabled={taxonomyWorking || !reorderPreview.canApply} type="button" onClick={() => void applyTaxonomyReorder()}>순서 반영</button><button className={styles.secondaryButton} type="button" onClick={() => { setReorderInput(null); setReorderPreview(null); }}>취소</button></div> : null}
          </div>
        ) : null}
        {selectedTaxonomyNode ? (
          <div className={styles.hint} style={{ marginTop: 16 }}>
            <strong>{selectedTaxonomyNode.code} 편집</strong>
            {canEdit ? <div className={styles.actions}><input aria-label="분류 이름 편집" value={editName} onChange={(event) => setEditName(event.target.value)} /><input aria-label="분류 설명 편집" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /><button className={styles.primaryButton} disabled={taxonomyWorking || !editName.trim()} type="button" onClick={() => void updateTaxonomyNode()}>저장</button></div> : null}
            <p>이 분류와 하위 분류에 연결된 품목 {selectedTaxonomyNode.descendantItemCount}개</p>
            {canEdit ? <button className={styles.secondaryButton} disabled={taxonomyWorking} type="button" onClick={() => void previewTaxonomyArchive()}>보관 영향 미리보기</button> : null}
            {archiveImpact ? (
              <div>
                <p className={archiveImpact.canArchive ? styles.successBanner : styles.errorBanner}>
                  {archiveImpact.canArchive ? "보관 가능" : `보관 차단: ${archiveImpact.blockers.map((blocker) => `${blocker.code} ${blocker.count}`).join(" · ")}`}
                </p>
                <p>활성 하위 {archiveImpact.activeChildCount} · 직접 품목 {archiveImpact.directItemCount} · coverage 결정 {archiveImpact.coverageDecisionCount}</p>
                {isAdmin && archiveImpact.canArchive ? <button className={styles.primaryButton} disabled={taxonomyWorking} type="button" onClick={() => void applyTaxonomyArchive()}>분류 보관</button> : null}
                {!isAdmin && archiveImpact.canArchive ? <p>실제 보관은 관리자만 할 수 있어요.</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={styles.card} data-evidence-id="CATALOG-V2-IMPORT">
        <h2>품목 편집 JSON·CSV·XLSX 가져오기</h2>
        <p className={styles.hint}>
          기존 R4 품목의 code와 nameKo, shortDescription, reasonText, timingSummary, sourceSummary만 갱신해요.
          CSV/XLSX는 첫 행에 필드명을 사용하고 XLSX는 단일 시트만 허용해요. formula, 과도한 압축·행·열·셀은 차단하며 적용된 품목은 반드시 다시 검수해야 해요.
        </p>
        {canEdit ? (
          <div className={styles.actions}>
            <label className={styles.secondaryButton}>
              {importWorking ? "처리 중..." : "JSON·CSV·XLSX 파일 선택"}
              <input accept=".json,.csv,.xlsx,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importWorking} hidden type="file" onChange={(event) => void selectImportFile(event)} />
            </label>
          </div>
        ) : <p className={styles.hint}>가져오기 preview와 적용은 관리자 또는 편집자만 할 수 있어요.</p>}
        {importError ? <p role="alert" className={styles.errorBanner}>{importError}</p> : null}
        {importMessage ? <p role="status" className={styles.successBanner}>{importMessage}</p> : null}
        {importPreview ? (
          <>
            <p className={importPreview.preview.summary.invalid ? styles.errorBanner : styles.successBanner}>
              전체 {importPreview.preview.summary.total} · 유효 {importPreview.preview.summary.valid} · 오류 {importPreview.preview.summary.invalid}
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>선택</th><th>행</th><th>품목 code</th><th>변경 필드</th><th>검증</th></tr></thead>
                <tbody>{importPreview.preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td><input aria-label={`${row.rowNumber}행 선택`} checked={selectedImportRows.includes(row.rowNumber)} disabled={!row.valid || importWorking} type="checkbox" onChange={() => toggleImportRow(row.rowNumber)} /></td>
                    <td>{row.rowNumber}</td>
                    <td>{row.code || "(없음)"}</td>
                    <td>{Object.keys(row.changes).join(", ") || "-"}</td>
                    <td>{row.valid ? "적용 가능" : row.errors.join(", ")}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className={styles.actions}>
              {importPreview.preview.summary.invalid > 0 ? (
                <a className={styles.secondaryButton} href={catalogV2ImportErrorsUrl(importPreview.import.id)}>오류 CSV 내려받기</a>
              ) : null}
              {canEdit ? (
                <button className={styles.primaryButton} disabled={importWorking || selectedImportRows.length === 0 || importPreview.import.state !== "ready"} type="button" onClick={() => void applyImport()}>
                  선택한 유효 행 적용 ({selectedImportRows.length})
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.card} id="catalog-items">
        <h2>일반 품목 ({total})</h2>
        <form className={styles.actions} onSubmit={submitSearch}>
          <input aria-label="카탈로그 품목 검색" value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="품목명 또는 코드" />
          <select aria-label="게시 상태" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">전체 상태</option><option value="draft">draft</option><option value="review_requested">review_requested</option><option value="editorial_review">editorial_review</option><option value="domain_review">domain_review</option><option value="safety_review">safety_review</option><option value="changes_requested">changes_requested</option><option value="approved">approved</option><option value="scheduled">scheduled</option><option value="published">published</option><option value="suspended">suspended</option><option value="recalled">recalled</option><option value="archived">archived</option>
          </select>
          <button className={styles.primaryButton} type="submit">검색</button>
        </form>
        {revisionItem ? (
          <div className={styles.hint} data-evidence-id="CATALOG-V2-REVISION-ROLLBACK" style={{ marginBottom: 16 }}>
            <div className={styles.actions}>
              <strong>{revisionItem.code} revision 이력</strong>
              <button className={styles.secondaryButton} type="button" onClick={() => { setRevisionItem(null); setRevisionHistory(null); setRollbackPreview(null); }}>닫기</button>
            </div>
            {revisionError ? <p className={styles.errorBanner}>{revisionError}</p> : null}
            {revisionMessage ? <p className={styles.successBanner}>{revisionMessage}</p> : null}
            {revisionWorking && !revisionHistory ? <p>이력을 불러오는 중...</p> : null}
            {revisionHistory ? (
              <>
                <p>현재 v{revisionHistory.current.contentVersion} · 승인 이력 {revisionHistory.approvals.length} · 상태 변경 {revisionHistory.events.length}</p>
                <div className={styles.actions}>
                  {revisionHistory.revisions.filter((revision) => revision.revision < revisionHistory.current.contentVersion).map((revision) => (
                    <button className={styles.secondaryButton} disabled={!canEdit || revisionWorking} key={revision.revision} type="button" onClick={() => void previewRollback(revision.revision)}>
                      v{revision.revision} 복원 미리보기
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {rollbackPreview ? (
              <div>
                <p className={styles.errorBanner}>v{rollbackPreview.targetRevision} → 새 draft v{rollbackPreview.resultRevision} · 현재 승인은 무효 · 직접 게시 안 함</p>
                <ul>{rollbackPreview.changes.map((change) => <li key={change.field}>{change.field}</li>)}</ul>
                <button className={styles.primaryButton} disabled={!canEdit || revisionWorking || rollbackPreview.changes.length === 0} type="button" onClick={() => void applyRollback()}>새 revision으로 rollback</button>
              </div>
            ) : null}
          </div>
        ) : null}
        {items === null ? <p className={styles.emptyState}>불러오는 중...</p> : items.length === 0 ? <p className={styles.emptyState}>조건에 맞는 품목이 없어요.</p> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>품목</th><th>대상</th><th>안전</th><th>상태</th><th>운영 정보</th><th>작업</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.nameKo}</strong><br /><span className={styles.hint}>{item.code}</span></td>
                  <td>{item.targetSubject}</td><td>{item.safetyTier}</td><td>{item.status}</td>
                  <td>alias {item.aliasCount} · offer {item.offerCount} · 신고 {item.openReportCount}</td>
                  <td>
                    {canEdit && (item.status === "draft" || item.status === "changes_requested") ? <button className={styles.secondaryButton} disabled={workingId === item.id} type="button" onClick={() => void runAction(item, "request")}>검수 요청</button> : null}
                    {isAdmin && (item.status === "review_requested" || item.status === "editorial_review" || item.status === "in_review") ? <button className={styles.secondaryButton} disabled={workingId === item.id} type="button" onClick={() => void runAction(item, "editorial")}>편집 검수</button> : null}
                    {isAdmin && item.status === "domain_review" ? <button className={styles.secondaryButton} disabled={workingId === item.id} type="button" onClick={() => void runAction(item, "domain")}>도메인 검수</button> : null}
                    {isAdmin && item.status === "approved" ? <button className={styles.primaryButton} disabled={workingId === item.id} type="button" onClick={() => void runAction(item, "publish")}>게시</button> : null}
                    {item.status === "safety_review" ? (
                      isAdmin ? (
                        <div className={styles.actions}>
                          <input
                            aria-label={`${item.nameKo} 안전 근거 URL`}
                            placeholder="https:// 승인 근거 URL"
                            value={safetyEvidence[item.id]?.url ?? ""}
                            onChange={(event) => setSafetyEvidence((current) => ({
                              ...current,
                              [item.id]: { url: event.target.value, title: current[item.id]?.title ?? "" }
                            }))}
                          />
                          <input
                            aria-label={`${item.nameKo} 안전 근거 제목`}
                            placeholder="전문가 검수 근거 제목"
                            value={safetyEvidence[item.id]?.title ?? ""}
                            onChange={(event) => setSafetyEvidence((current) => ({
                              ...current,
                              [item.id]: { url: current[item.id]?.url ?? "", title: event.target.value }
                            }))}
                          />
                          <button className={styles.secondaryButton} disabled={workingId === item.id} type="button" onClick={() => void runAction(item, "safety")}>안전 검수</button>
                        </div>
                      ) : <span className={styles.hint}>승인된 외부 전문가 근거와 safety 권한 필요</span>
                    ) : item.safetyTier === "high" ? <span className={styles.hint}>안전 검수 필요</span> : null}
                    <button className={styles.secondaryButton} disabled={revisionWorking && revisionItem?.id === item.id} type="button" onClick={() => void showRevisionHistory(item)}>revision 이력</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
