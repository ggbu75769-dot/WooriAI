import { describe, expect, it } from "vitest";
import { canonicalIdempotencyTarget, idempotencyRequestHash } from "./idempotency-request";

describe("idempotency request identity", () => {
  it("includes query values so one key cannot replay a mutation for a different version", () => {
    const body = {};
    expect(
      idempotencyRequestHash("/api/v1/expenses/expense-1?expectedVersion=1", body)
    ).not.toBe(
      idempotencyRequestHash("/api/v1/expenses/expense-1?expectedVersion=2", body)
    );
  });

  it("canonicalizes query ordering while preserving repeated values", () => {
    expect(canonicalIdempotencyTarget("/path?b=2&a=3&a=1")).toBe("/path?a=1&a=3&b=2");
    expect(
      idempotencyRequestHash("/path?b=2&a=3&a=1", { value: 1 })
    ).toBe(
      idempotencyRequestHash("/path?a=1&b=2&a=3", { value: 1 })
    );
  });

  it("still distinguishes actual resource paths and request bodies", () => {
    expect(idempotencyRequestHash("/children/child-1/expenses", { amount: 1 })).not.toBe(
      idempotencyRequestHash("/children/child-2/expenses", { amount: 1 })
    );
    expect(idempotencyRequestHash("/children/child-1/expenses", { amount: 1 })).not.toBe(
      idempotencyRequestHash("/children/child-1/expenses", { amount: 2 })
    );
  });
});
