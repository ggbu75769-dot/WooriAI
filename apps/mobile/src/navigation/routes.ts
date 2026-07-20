import type { Href } from "expo-router";

export function expenseDetailRoute(expenseId: string): Href {
  return {
    pathname: "/expenses/[expenseId]",
    params: { expenseId }
  };
}
