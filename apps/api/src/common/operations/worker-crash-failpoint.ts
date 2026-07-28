export const WORKER_CRASH_FAILPOINT_FILE = "/tmp/wooriai-release4i-worker-crash";

export function workerCrashFailpointEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.NODE_ENV !== "production"
    && environment.APP_ENV === "local_staging"
    && environment.RELEASE4I_WORKER_CRASH_FAILPOINT === "1";
}
