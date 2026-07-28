import { persistStorage } from "../stores/persist-storage";

export const RECEIPT_DRAFT_STORAGE_KEY = "wooriai-receipt-drafts-v1";
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

export type ReceiptDraftForm = {
  itemName: string;
  amount: string;
  spentOn: string;
  merchant: string;
  categoryId: string;
};

export type ReceiptOfflineDraft = {
  schemaVersion: 1;
  scopeKey: string;
  localId: string;
  childId: string;
  assetUri: string;
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  fileSizeBytes: number;
  contentHash: string;
  uploadState: "pending" | "uploading" | "review_ready" | "failed";
  serverDraft: { id: string; version: number } | null;
  confirmationIdempotencyKey: string;
  form: ReceiptDraftForm;
  updatedAt: string;
};

type ReceiptDraftEnvelope = {
  schemaVersion: 1;
  drafts: Record<string, ReceiptOfflineDraft>;
};

export type ReceiptDraftStorageControl = {
  assertActive?: () => void;
};

let receiptStorageQueue: Promise<void> = Promise.resolve();

function withReceiptStorageLock<T>(work: () => Promise<T>): Promise<T> {
  const operation = receiptStorageQueue.then(work, work);
  receiptStorageQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function assertStorageOwner(control?: ReceiptDraftStorageControl): void {
  control?.assertActive?.();
}

function emptyEnvelope(): ReceiptDraftEnvelope {
  return { schemaVersion: 1, drafts: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isReceiptDraft(value: unknown): value is ReceiptOfflineDraft {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.form)) return false;
  const serverDraft = value.serverDraft;
  const validServerDraft =
    serverDraft === null ||
    (isRecord(serverDraft) && isNonEmptyString(serverDraft.id) && Number.isInteger(serverDraft.version) && Number(serverDraft.version) > 0);
  return (
    isNonEmptyString(value.scopeKey) &&
    isNonEmptyString(value.localId) &&
    isNonEmptyString(value.childId) &&
    isNonEmptyString(value.assetUri) &&
    isNonEmptyString(value.fileName) &&
    ["image/jpeg", "image/png", "application/pdf"].includes(String(value.mimeType)) &&
    Number.isInteger(value.fileSizeBytes) &&
    Number(value.fileSizeBytes) > 0 &&
    Number(value.fileSizeBytes) <= MAX_RECEIPT_BYTES &&
    typeof value.contentHash === "string" &&
    /^[a-f0-9]{64}$/.test(value.contentHash) &&
    ["pending", "uploading", "review_ready", "failed"].includes(String(value.uploadState)) &&
    validServerDraft &&
    isNonEmptyString(value.confirmationIdempotencyKey) &&
    typeof value.form.itemName === "string" &&
    typeof value.form.amount === "string" &&
    typeof value.form.spentOn === "string" &&
    typeof value.form.merchant === "string" &&
    isNonEmptyString(value.form.categoryId) &&
    isNonEmptyString(value.updatedAt)
  );
}

function parseEnvelope(raw: string): ReceiptDraftEnvelope | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.drafts)) return null;
    const drafts = Object.entries(value.drafts);
    const normalized: Record<string, ReceiptOfflineDraft> = {};
    for (const [scopeKey, draft] of drafts) {
      if (!isReceiptDraft(draft) || draft.scopeKey !== scopeKey) return null;
      normalized[scopeKey] = draft;
    }
    return { schemaVersion: 1, drafts: normalized };
  } catch {
    return null;
  }
}

async function readEnvelope(quarantineId: string): Promise<ReceiptDraftEnvelope> {
  const raw = await persistStorage.getItem(RECEIPT_DRAFT_STORAGE_KEY);
  if (raw === null) return emptyEnvelope();
  const parsed = parseEnvelope(raw);
  if (parsed) return parsed;
  await persistStorage.setItem(`${RECEIPT_DRAFT_STORAGE_KEY}:quarantine:${quarantineId}`, raw);
  await persistStorage.removeItem(RECEIPT_DRAFT_STORAGE_KEY);
  return emptyEnvelope();
}

export function createReceiptOfflineDraft(input: Omit<ReceiptOfflineDraft, "schemaVersion" | "uploadState" | "serverDraft">): ReceiptOfflineDraft {
  return { ...input, schemaVersion: 1, uploadState: "pending", serverDraft: null };
}

export async function readReceiptOfflineDraft(scopeKey: string, quarantineId = String(Date.now())): Promise<ReceiptOfflineDraft | null> {
  return withReceiptStorageLock(async () => {
    const envelope = await readEnvelope(quarantineId);
    return envelope.drafts[scopeKey] ?? null;
  });
}

export async function writeReceiptOfflineDraft(
  draft: ReceiptOfflineDraft,
  quarantineId = String(Date.now()),
  control?: ReceiptDraftStorageControl
): Promise<void> {
  if (!isReceiptDraft(draft)) throw new Error("Invalid receipt draft");
  await withReceiptStorageLock(async () => {
    assertStorageOwner(control);
    const envelope = await readEnvelope(quarantineId);
    assertStorageOwner(control);
    envelope.drafts[draft.scopeKey] = draft;
    await persistStorage.setItem(RECEIPT_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
    assertStorageOwner(control);
  });
}

export async function clearReceiptOfflineDraft(scopeKey: string, quarantineId = String(Date.now())): Promise<void> {
  await withReceiptStorageLock(async () => {
    const envelope = await readEnvelope(quarantineId);
    delete envelope.drafts[scopeKey];
    if (Object.keys(envelope.drafts).length === 0) {
      await persistStorage.removeItem(RECEIPT_DRAFT_STORAGE_KEY);
      return;
    }
    await persistStorage.setItem(RECEIPT_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
  });
}

export async function clearAllReceiptOfflineDrafts(): Promise<void> {
  await withReceiptStorageLock(async () => {
    await persistStorage.removeItem(RECEIPT_DRAFT_STORAGE_KEY);
  });
}

export async function clearReceiptOfflineDraftsExceptScope(
  scopeKey: string | null,
  quarantineId = String(Date.now())
): Promise<void> {
  await withReceiptStorageLock(async () => {
    if (!scopeKey) {
      await persistStorage.removeItem(RECEIPT_DRAFT_STORAGE_KEY);
      return;
    }
    const envelope = await readEnvelope(quarantineId);
    const retained = envelope.drafts[scopeKey];
    if (!retained) {
      await persistStorage.removeItem(RECEIPT_DRAFT_STORAGE_KEY);
      return;
    }
    await persistStorage.setItem(
      RECEIPT_DRAFT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, drafts: { [scopeKey]: retained } } satisfies ReceiptDraftEnvelope)
    );
  });
}

export function updateReceiptOfflineDraft(
  draft: ReceiptOfflineDraft,
  update: Partial<Pick<ReceiptOfflineDraft, "uploadState" | "serverDraft" | "form" | "updatedAt">>
): ReceiptOfflineDraft {
  return { ...draft, ...update };
}

export function toReceiptConfirmationInput(draft: ReceiptOfflineDraft) {
  if (!draft.serverDraft) throw new Error("Receipt draft has not been uploaded");
  return {
    confirmed: true as const,
    idempotencyKey: draft.confirmationIdempotencyKey,
    expectedVersion: draft.serverDraft.version,
    categoryId: draft.form.categoryId,
    amountKrw: Number(draft.form.amount),
    spentOn: draft.form.spentOn,
    itemName: draft.form.itemName.trim(),
    merchant: draft.form.merchant.trim() || undefined
  };
}
