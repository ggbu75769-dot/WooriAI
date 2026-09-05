/** Connection failures must not put DATABASE_URL credentials or provider errors in CI logs. */
export function databaseDiagnostic(databaseUrl: string | undefined, error: unknown): string {
  let target = "configured database";
  try {
    const url = new URL(databaseUrl ?? "");
    if (/^postgres(?:ql)?:$/.test(url.protocol) && /^[a-z0-9.[\]:-]+$/i.test(url.host)) target = url.host;
  } catch {
    // A malformed URL can itself contain credentials; do not echo it.
  }
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return `${target} (${typeof code === "string" && /^P\d{4}$/.test(code) ? code : "connection failed"})`;
}
