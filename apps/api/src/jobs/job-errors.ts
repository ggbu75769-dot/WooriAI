export class JobExecutionError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean
  ) {
    super(code);
    this.name = "JobExecutionError";
  }
}

export function jobFailureCode(error: unknown): string {
  if (error instanceof JobExecutionError) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80).toUpperCase();
  }
  return "JOB_HANDLER_FAILED";
}
