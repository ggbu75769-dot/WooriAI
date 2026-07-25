/**
 * A bounded pull schedules continuation before its current scope flight unwinds.
 * Wait until that exact flight leaves the registry, then start a genuinely new
 * run. Without this barrier the timer merely joins the finishing Promise and the
 * persisted incomplete baseline can remain stranded.
 */
export async function resumeAfterActiveScopeFlight(
  activeFlight: () => Promise<void> | undefined,
  resume: () => Promise<void>
): Promise<void> {
  const current = activeFlight();
  if (current) await current;
  await resume();
}
