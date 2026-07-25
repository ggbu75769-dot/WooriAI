import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fixtureSessionToken,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID
} from "../api/fixture-identifiers";
import { shouldClearSessionCache } from "../stores/session-cache-boundary";
import { useSessionStore } from "../stores/session.store";
import {
  householdIdForSelectedChildScope,
  useSelectedChildStore
} from "../stores/selected-child.store";
import { resolveOfflineScopeKey } from "./session-scope";
import { useOfflineSyncLifecycle } from "./sync-controller";

/**
 * Mounted after the first React render so SQLite migration and background reconciliation cannot
 * hold the native splash. Session/cache scope semantics remain identical to the root lifecycle.
 */
export default function OfflineSyncLifecycle() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const sessionGeneration = useSessionStore((state) => state.sessionGeneration);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const userId = useSessionStore((state) => state.userId);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const selectedChildHouseholdId = useSelectedChildStore((state) => state.selectedChildHouseholdId);
  const scopedHouseholdId = householdIdForSelectedChildScope(
    selectedChildId,
    selectedChildHouseholdId,
    defaultHouseholdId
  );
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const scopeKey = resolveOfflineScopeKey({
    accessToken,
    userId,
    defaultHouseholdId: scopedHouseholdId,
    isTestSession,
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
  const client = useQueryClient();
  const previousScopeKey = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (shouldClearSessionCache(previousScopeKey.current, scopeKey)) {
      client.clear();
    }
    previousScopeKey.current = scopeKey;
  }, [client, scopeKey]);

  useOfflineSyncLifecycle(token, scopeKey, sessionGeneration, client);
  return null;
}
