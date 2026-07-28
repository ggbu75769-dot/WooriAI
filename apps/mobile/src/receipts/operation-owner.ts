import {
  fixtureSessionToken,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_USER_ID
} from "../api/fixture-identifiers";
import { resolveOfflineScopeKey } from "../offline/session-scope";
import { RemoteSyncCancelledError } from "../offline/errors";
import {
  householdIdForSelectedChildScope,
  useSelectedChildStore
} from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";

export type ReceiptOperationOwner = {
  sessionGeneration: number;
  token: string;
  scopeKey: string;
  childId: string;
};

function currentReceiptContext() {
  const session = useSessionStore.getState();
  const selectedChild = useSelectedChildStore.getState();
  const token = session.accessToken ?? (session.isTestSession ? fixtureSessionToken : null);
  const householdId = householdIdForSelectedChildScope(
    selectedChild.selectedChildId,
    selectedChild.selectedChildHouseholdId,
    session.defaultHouseholdId
  );
  const scopeKey = resolveOfflineScopeKey({
    accessToken: session.accessToken,
    userId: session.userId,
    defaultHouseholdId: householdId,
    isTestSession: session.isTestSession,
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
  return {
    sessionGeneration: session.sessionGeneration,
    token,
    scopeKey,
    childId: selectedChild.selectedChildId
  };
}

export function captureReceiptOperationOwner(
  token: string | null,
  scopeKey: string | null,
  childId: string | null
): ReceiptOperationOwner | null {
  const current = currentReceiptContext();
  if (
    !token ||
    !scopeKey ||
    !childId ||
    current.token !== token ||
    current.scopeKey !== scopeKey ||
    current.childId !== childId
  ) {
    return null;
  }
  return {
    sessionGeneration: current.sessionGeneration,
    token,
    scopeKey,
    childId
  };
}

export function receiptOperationOwnerIsActive(owner: ReceiptOperationOwner): boolean {
  const current = currentReceiptContext();
  return (
    current.sessionGeneration === owner.sessionGeneration &&
    current.scopeKey === owner.scopeKey &&
    current.childId === owner.childId
  );
}

type ActiveReceiptOperation = {
  owner: ReceiptOperationOwner;
  controller: AbortController;
};

const activeReceiptOperations = new Set<ActiveReceiptOperation>();

function abortStaleReceiptOperations(): void {
  for (const operation of activeReceiptOperations) {
    if (!receiptOperationOwnerIsActive(operation.owner)) {
      operation.controller.abort();
    }
  }
}

useSessionStore.subscribe(abortStaleReceiptOperations);
useSelectedChildStore.subscribe(abortStaleReceiptOperations);

export function beginReceiptOperation(owner: ReceiptOperationOwner) {
  const controller = new AbortController();
  const operation = { owner, controller };
  activeReceiptOperations.add(operation);
  abortStaleReceiptOperations();
  const assertActive = () => {
    if (controller.signal.aborted || !receiptOperationOwnerIsActive(owner)) {
      throw new RemoteSyncCancelledError();
    }
  };
  return {
    owner,
    signal: controller.signal,
    assertActive,
    release: () => {
      activeReceiptOperations.delete(operation);
    }
  };
}
