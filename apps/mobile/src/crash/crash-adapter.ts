export type CrashContext = {
  errorName: string;
  messageCode: string;
  appVersion: string;
  environment: string;
  fatal: boolean;
};

export interface CrashAdapter {
  capture(context: CrashContext): void | Promise<void>;
}

let adapter: CrashAdapter = { capture: () => undefined };
let handlersInstalled = false;

function safeCode(error: unknown): { errorName: string; messageCode: string } {
  if (!(error instanceof Error)) return { errorName: "UnknownError", messageCode: "UNHANDLED_ERROR" };
  const code = error.message.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80).toUpperCase();
  return { errorName: error.name.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40), messageCode: code || "UNHANDLED_ERROR" };
}

export function configureCrashAdapter(next: CrashAdapter | null) {
  adapter = next ?? { capture: () => undefined };
}

export function reportCrash(error: unknown, fatal: boolean) {
  const safe = safeCode(error);
  void adapter.capture({
    ...safe,
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? "unknown",
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? "unknown",
    fatal
  });
}

type GlobalErrorUtils = {
  getGlobalHandler?: () => (error: unknown, fatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: unknown, fatal?: boolean) => void) => void;
};

type RejectionEvent = { reason?: unknown };

export function installGlobalCrashHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  const target = globalThis as typeof globalThis & {
    ErrorUtils?: GlobalErrorUtils;
    onunhandledrejection?: ((event: RejectionEvent) => void) | null;
  };
  const previousErrorHandler = target.ErrorUtils?.getGlobalHandler?.();
  target.ErrorUtils?.setGlobalHandler?.((error, fatal) => {
    reportCrash(error, fatal ?? true);
    previousErrorHandler?.(error, fatal);
  });
  const previousRejectionHandler = target.onunhandledrejection;
  target.onunhandledrejection = (event) => {
    reportCrash(event.reason ?? new Error("UNHANDLED_REJECTION"), false);
    previousRejectionHandler?.(event);
  };
}
