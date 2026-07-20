export function shouldClearSessionCache(
  previousScopeKey: string | null | undefined,
  nextScopeKey: string | null
): boolean {
  return previousScopeKey !== undefined && previousScopeKey !== nextScopeKey;
}
