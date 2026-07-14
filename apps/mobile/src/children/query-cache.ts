import type { QueryClient } from "@tanstack/react-query";

export const childScopedQueryRoots = ["home", "expenses", "items", "item-detail", "report", "budget"] as const;

export async function invalidateChildScopedQueries(queryClient: QueryClient) {
  await Promise.all(
    childScopedQueryRoots.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] }))
  );
}
