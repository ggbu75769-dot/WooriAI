/**
 * INF-006-lite: contract every scheduler-run background job implements.
 *
 * `run(now)` takes the tick's timestamp explicitly so jobs are unit-testable
 * without timers (tests construct a Date and call run() directly). The
 * returned record is a small structured summary (row counts, ids) that the
 * scheduler serializes into its per-job log line.
 */
export interface WorkerJob {
  readonly name: string;
  run(now: Date): Promise<Record<string, unknown>>;
}
