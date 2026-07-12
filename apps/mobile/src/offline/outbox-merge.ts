import type { ExpensePayload, MutationOutboxRow } from "./types";

/**
 * Applies MOB-102 §3.2 point 6's outbox merge rule for a single local_id's queued (unsynced)
 * mutations, given the mutation(s) already queued for that local_id and a new mutation about to
 * be appended. Only mutations for the SAME local_id are ever merged -- mutations for different
 * local_ids are independent and never interact.
 *
 * Explicitly specified by the design doc:
 *   - create + update (create not yet synced) -> single 'create' mutation, payload updated.
 *   - create + delete (create not yet synced) -> both mutations dropped (server never saw it).
 *
 * Extended here for internal consistency (not contradicting the above, just generalizing "merge
 * to minimize server round trips" to the case where two edits land before the first has synced):
 *   - update + update (first update not yet synced) -> collapsed into one 'update' mutation,
 *     keeping the earliest queued expectedVersion (the version the server still has) and the
 *     newest field values.
 *   - delete always wins and clears anything else queued for the local_id, since once a delete
 *     is queued nothing else should still be sent for it.
 *
 * Returns the full replacement mutation list for this local_id (may be empty).
 *
 * H-3 fix (diff review): a mutation currently `inFlight` (flushOutbox has already sent its
 * payload to the server and is awaiting the response -- see sync-engine.ts) is never a valid
 * merge target. Folding a new edit into an in-flight row's payload would silently diverge that
 * row's payload from what was actually sent, and then delete the merged-in edit along with the
 * row once the in-flight request's (unrelated, older) response comes back successful -- a silent
 * data loss. In-flight rows are therefore always passed straight through untouched, and merging
 * only ever considers the remaining (`!inFlight`) rows -- which keeps every already-tested
 * non-in-flight merge rule below byte-for-byte unchanged.
 */
export function mergeOutboxMutation(
  existing: MutationOutboxRow[],
  incoming: MutationOutboxRow
): MutationOutboxRow[] {
  const inFlightRows = existing.filter((mutation) => mutation.inFlight);
  const mergeableRows = existing.filter((mutation) => !mutation.inFlight);
  return [...inFlightRows, ...mergeIntoMergeableRows(mergeableRows, incoming)];
}

function mergeIntoMergeableRows(existing: MutationOutboxRow[], incoming: MutationOutboxRow): MutationOutboxRow[] {
  if (existing.length === 0) {
    return [incoming];
  }

  const pendingCreate = existing.find((mutation) => mutation.operation === "create");
  const pendingDelete = existing.find((mutation) => mutation.operation === "delete");

  if (pendingDelete) {
    // A delete already queued for this local_id is terminal: the item is going away, so
    // nothing queued after it (or the delete itself, replayed) changes the outcome.
    return [pendingDelete];
  }

  if (incoming.operation === "delete") {
    if (pendingCreate) {
      // create+delete before the create ever reached the server -- the server has never
      // heard of this local_id, so both mutations are simply dropped.
      return [];
    }
    // Any queued update(s) are moot once a delete is queued -- drop them, keep only the delete.
    return [incoming];
  }

  if (incoming.operation === "update") {
    if (pendingCreate) {
      // Fold the update's fields into the still-pending create payload instead of sending two
      // requests -- the server receives one create call with the final, up-to-date fields.
      const merged: MutationOutboxRow = {
        ...pendingCreate,
        payload: { ...(pendingCreate.payload as ExpensePayload), ...(incoming.payload as ExpensePayload) }
      };
      return [merged];
    }

    const pendingUpdate = existing.find((mutation) => mutation.operation === "update");
    if (pendingUpdate) {
      const merged: MutationOutboxRow = {
        ...pendingUpdate,
        payload: { ...(pendingUpdate.payload as ExpensePayload), ...(incoming.payload as ExpensePayload) }
      };
      return existing.map((mutation) => (mutation.mutationId === pendingUpdate.mutationId ? merged : mutation));
    }

    return [...existing, incoming];
  }

  // incoming.operation === "create" while something else is already queued for this local_id
  // shouldn't happen in practice (a local_id is only ever created once), but stay additive and
  // defensive rather than throwing.
  return [...existing, incoming];
}
