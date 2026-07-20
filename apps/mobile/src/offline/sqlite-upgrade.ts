import { LEGACY_UNSCOPED_SCOPE_KEY } from "./session-scope";
import type { LegacyQuarantineEntry } from "./types";

export const OFFLINE_SQLITE_SCHEMA_VERSION = 2;

export type LegacyLocalExpenseSqlRow = {
  scope_key?: string | null;
  local_id: string;
  canonical_id: string | null;
  child_id: string;
  payload: string;
  version: number | null;
  sync_state: string;
  pending_delete?: number | null;
  conflict_current?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
};

export type LegacyMutationSqlRow = {
  scope_key?: string | null;
  mutation_id: string;
  idempotency_key: string;
  operation: string;
  target_local_id: string;
  payload: string | null;
  expected_version: number | null;
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  in_flight?: number | null;
};

function validJson(value: string | null): boolean {
  if (value === null) return true;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Legacy rows did not persist an authenticated user/household identity. Classification only
 * decides whether a row may be reconciled against server idempotency evidence; it never assigns
 * a row to the currently signed-in account by itself.
 */
export function classifyLegacyOfflineRows(
  localRows: LegacyLocalExpenseSqlRow[],
  outboxRows: LegacyMutationSqlRow[]
): LegacyQuarantineEntry[] {
  const unscopedLocalRows = localRows.filter(
    (row) => !row.scope_key || row.scope_key === LEGACY_UNSCOPED_SCOPE_KEY
  );
  const unscopedOutboxRows = outboxRows.filter(
    (row) => !row.scope_key || row.scope_key === LEGACY_UNSCOPED_SCOPE_KEY
  );
  const idempotencyWinner = new Map<string, string>();
  for (const row of [...unscopedOutboxRows].sort((left, right) =>
    left.created_at.localeCompare(right.created_at) || left.mutation_id.localeCompare(right.mutation_id)
  )) {
    if (!idempotencyWinner.has(row.idempotency_key)) {
      idempotencyWinner.set(row.idempotency_key, row.mutation_id);
    }
  }

  return unscopedLocalRows.map((localRow) => {
    const mutations = unscopedOutboxRows
      .filter((row) => row.target_local_id === localRow.local_id)
      .sort((left, right) =>
        left.created_at.localeCompare(right.created_at) || left.mutation_id.localeCompare(right.mutation_id)
      );
    const hasInvalidJson =
      !validJson(localRow.payload) ||
      !validJson(localRow.conflict_current ?? null) ||
      mutations.some((row) => !validJson(row.payload));
    const duplicate = mutations.some(
      (row) => idempotencyWinner.get(row.idempotency_key) !== row.mutation_id
    );

    let classification: LegacyQuarantineEntry["classification"];
    let reasonCode: string;
    if (hasInvalidJson) {
      classification = "corrupt";
      reasonCode = "LEGACY_PAYLOAD_INVALID";
    } else if (duplicate) {
      classification = "duplicate";
      reasonCode = "LEGACY_IDEMPOTENCY_DUPLICATE";
    } else if (localRow.sync_state === "synced" && mutations.length === 0) {
      classification = "already_synced";
      reasonCode = "LEGACY_ALREADY_SYNCED";
    } else if (mutations.length > 0) {
      classification = "awaiting_reconciliation";
      reasonCode = "LEGACY_SERVER_PROOF_REQUIRED";
    } else {
      classification = "ambiguous";
      reasonCode = "LEGACY_OWNER_UNKNOWN";
    }

    return {
      id: `legacy:${localRow.local_id}`,
      sourceLocalId: localRow.local_id,
      classification,
      reasonCode,
      localExpenseJson: JSON.stringify(localRow),
      outboxJson: JSON.stringify(mutations),
      createdAt: localRow.created_at
    };
  });
}
