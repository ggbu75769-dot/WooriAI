import { logoutSession } from "../api/client";
import {
  durablyInvalidateSecureSession,
  waitForSecureSessionStorageIdle
} from "../stores/secure-session-storage";
import { useSessionStore } from "../stores/session.store";

type LogoutOwner = Readonly<{
  sessionGeneration: number;
  userId: string | null;
  defaultHouseholdId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isTestSession: boolean;
}>;

export type LogoutCurrentSessionResult = {
  serverRevoked: boolean | null;
  localCleared: boolean;
};

export type LogoutCurrentSessionOptions = {
  revoke?: typeof logoutSession;
  persistLocalLogout?: typeof durablyInvalidateSecureSession;
  /** Runs immediately after the durable local boundary closes, before the
   * bounded remote revocation finishes. UI can clear caches and navigate now. */
  onLocalCleared?: () => void;
};

const logoutFlights = new Map<string, Promise<LogoutCurrentSessionResult>>();

function captureOwner(): LogoutOwner {
  const session = useSessionStore.getState();
  return {
    sessionGeneration: session.sessionGeneration,
    userId: session.userId,
    defaultHouseholdId: session.defaultHouseholdId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    isTestSession: session.isTestSession
  };
}

function isSameOwner(owner: LogoutOwner): boolean {
  const current = useSessionStore.getState();
  return (
    current.sessionGeneration === owner.sessionGeneration &&
    current.userId === owner.userId &&
    current.defaultHouseholdId === owner.defaultHouseholdId &&
    current.isTestSession === owner.isTestSession
  );
}

function isLoggedOut(): boolean {
  const current = useSessionStore.getState();
  return (
    !current.accessToken &&
    !current.refreshToken &&
    !current.userId &&
    !current.isTestSession
  );
}

async function clearOwnedSession(
  owner: LogoutOwner,
  persistLocalLogout: typeof durablyInvalidateSecureSession
): Promise<boolean> {
  if (!isSameOwner(owner)) {
    // A failed refresh can itself clear the captured session. Treat that as a
    // completed local logout, but never mistake a newly logged-in owner for it.
    if (isLoggedOut()) {
      try {
        await persistLocalLogout();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  try {
    // Commit the durable tombstone while the captured session is still present.
    // If this fails, keep the session active so a retry is possible and honest.
    await persistLocalLogout();
  } catch {
    return false;
  }
  if (!isSameOwner(owner)) {
    return isLoggedOut();
  }
  useSessionStore.getState().clearSession();
  await waitForSecureSessionStorageIdle();
  return true;
}

async function performLogout(
  owner: LogoutOwner,
  revoke: typeof logoutSession,
  persistLocalLogout: typeof durablyInvalidateSecureSession,
  onLocalCleared?: () => void
): Promise<LogoutCurrentSessionResult> {
  const localCleared = await clearOwnedSession(owner, persistLocalLogout);
  if (!localCleared) {
    return {
      serverRevoked: null,
      localCleared: false
    };
  }
  onLocalCleared?.();
  if (owner.isTestSession) {
    return { serverRevoked: null, localCleared: true };
  }
  if (owner.accessToken && owner.refreshToken) {
    try {
      const response = await revoke(owner.accessToken, owner.refreshToken);
      return {
        serverRevoked: response.success === true,
        localCleared: true
      };
    } catch {
      return { serverRevoked: false, localCleared: true };
    }
  }
  return { serverRevoked: null, localCleared: true };
}

/**
 * One bounded logout operation per captured credential epoch. Token rotation
 * may update credentials without changing the generation; account/scope
 * transitions do change the owner and protect the new session from late work.
 */
export function logoutCurrentSession(
  options: LogoutCurrentSessionOptions = {}
): Promise<LogoutCurrentSessionResult> {
  const owner = captureOwner();
  const flightKey = [
    owner.sessionGeneration,
    owner.userId ?? "",
    owner.defaultHouseholdId ?? "",
    owner.refreshToken ?? "",
    owner.isTestSession ? "test" : "real"
  ].join(":");
  const existing = logoutFlights.get(flightKey);
  if (existing) return existing;

  const flight = performLogout(
    owner,
    options.revoke ?? logoutSession,
    options.persistLocalLogout ?? durablyInvalidateSecureSession,
    options.onLocalCleared
  ).finally(() => {
    if (logoutFlights.get(flightKey) === flight) {
      logoutFlights.delete(flightKey);
    }
  });
  logoutFlights.set(flightKey, flight);
  return flight;
}
