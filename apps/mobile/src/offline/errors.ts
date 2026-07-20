import type { ConflictSnapshot } from "./types";

/**
 * Thrown by a `RemoteExpenseApi` implementation (see remote-api.ts) when the server responds
 * 409 VERSION_CONFLICT (design doc §2.2). `flushOutbox` in sync-engine.ts catches this
 * specifically and moves the local row to `sync_state = 'conflict'`.
 */
export class RemoteVersionConflictError extends Error {
  readonly current: ConflictSnapshot;
  constructor(current: ConflictSnapshot) {
    super("VERSION_CONFLICT");
    this.name = "RemoteVersionConflictError";
    this.current = current;
  }
}

/**
 * Thrown by a `RemoteExpenseApi` implementation for a non-retryable 4xx response (validation
 * errors, etc. -- design doc §3.2 point 5). `flushOutbox` moves the local row to
 * `sync_state = 'failed'` and stops auto-retrying it until the user explicitly retries or
 * discards it.
 */
export class RemotePermanentError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "RemotePermanentError";
    this.status = status;
    this.body = body;
  }
}

export class RemoteAuthRequiredError extends RemotePermanentError {
  constructor(body?: unknown) {
    super(401, "AUTH_REQUIRED", body);
    this.name = "RemoteAuthRequiredError";
  }
}

export class RemotePermissionDeniedError extends RemotePermanentError {
  constructor(body?: unknown) {
    super(403, "PERMISSION_DENIED", body);
    this.name = "RemotePermissionDeniedError";
  }
}

/** Anything else (network failure, timeout, 5xx) is treated by flushOutbox as transient: the
 * row stays 'pending' and is retried later with exponential backoff. No dedicated error class
 * is needed for that case -- it's simply "not one of the two types above". */
