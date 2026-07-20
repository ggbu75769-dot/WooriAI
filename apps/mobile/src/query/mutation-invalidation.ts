type QueryInvalidationClient = {
  invalidateQueries(filters: {
    predicate: (query: { queryKey: readonly unknown[] }) => boolean;
  }): Promise<unknown>;
};

export const financialMutationQueryRoots = [
  "expenses",
  "expense",
  "home",
  "budget",
  "report",
  "report-v3",
  "report-v3-sources",
  "expense-shortcuts"
] as const;

export const preparationMutationQueryRoots = [
  "catalog-v2",
  "items",
  "home",
  "report",
  "report-v3",
  "report-v3-sources"
] as const;

async function invalidateRoots(
  queryClient: QueryInvalidationClient,
  roots: readonly string[],
  scopeIds: readonly string[]
): Promise<void> {
  const uniqueScopeIds = [...new Set(scopeIds.filter(Boolean))];
  if (uniqueScopeIds.length === 0) return;
  await Promise.all(
    roots.map((root) => queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === root &&
        uniqueScopeIds.some((scopeId) => query.queryKey.includes(scopeId))
    }))
  );
}

export function invalidateFinancialMutationQueries(
  queryClient: QueryInvalidationClient,
  scopeIds: string | readonly string[]
): Promise<void> {
  return invalidateRoots(
    queryClient,
    financialMutationQueryRoots,
    typeof scopeIds === "string" ? [scopeIds] : scopeIds
  );
}

export function invalidatePreparationMutationQueries(
  queryClient: QueryInvalidationClient,
  scopeIds: string | readonly string[]
): Promise<void> {
  return invalidateRoots(
    queryClient,
    preparationMutationQueryRoots,
    typeof scopeIds === "string" ? [scopeIds] : scopeIds
  );
}
