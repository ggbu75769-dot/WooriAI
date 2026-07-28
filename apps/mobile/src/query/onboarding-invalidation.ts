type ScopedQueryClient = {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>;
};

export function invalidateOnboardingCompletionQueries(queryClient: ScopedQueryClient, childId: string) {
  const keys: readonly (readonly unknown[])[] = [
    ["children"],
    ["home", childId],
    ["catalog-v2", "preparation-context", `child:${childId}`],
    ["catalog-v2", "timeline", `child:${childId}`],
    ["budget", childId],
    ["reports", childId]
  ];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
