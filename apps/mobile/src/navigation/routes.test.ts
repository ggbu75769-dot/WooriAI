import { describe, expect, it } from "vitest";
import { expenseDetailRoute } from "./routes";

describe("typed mobile route mappings", () => {
  it("preserves an expense identifier as a route param instead of composing a path", () => {
    expect(expenseDetailRoute("expense/a?b")).toEqual({
      pathname: "/expenses/[expenseId]",
      params: { expenseId: "expense/a?b" }
    });
  });
});
