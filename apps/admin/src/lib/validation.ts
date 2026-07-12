// Pure client-side validation helpers shared by admin CMS forms.
// The API also validates these server-side; this is UX-only, fail-fast feedback.

export function isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}
