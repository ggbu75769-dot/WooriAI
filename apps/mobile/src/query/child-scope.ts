export function childScopedRequestEnabled(
  authToken: string | null | undefined,
  childId: string | null | undefined
): boolean {
  return Boolean(authToken && childId);
}
