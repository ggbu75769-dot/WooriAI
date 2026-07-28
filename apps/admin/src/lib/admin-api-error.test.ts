import { describe, expect, it } from "vitest";
import { AdminApiError, isAdminApiErrorStatus } from "./admin-api";

describe("isAdminApiErrorStatus", () => {
  it("recognizes local and bundle-boundary API errors by status", () => {
    expect(isAdminApiErrorStatus(new AdminApiError(409, "conflict"), 409)).toBe(true);

    const boundaryError = Object.assign(new Error("conflict"), {
      name: "AdminApiError",
      status: 409
    });
    expect(isAdminApiErrorStatus(boundaryError, 409)).toBe(true);
    expect(isAdminApiErrorStatus(boundaryError, 401)).toBe(false);
  });

  it("rejects untrusted values that only resemble an API error", () => {
    expect(isAdminApiErrorStatus({ name: "AdminApiError", status: 409 }, 409)).toBe(false);
    expect(isAdminApiErrorStatus(new Error("conflict"), 409)).toBe(false);
  });
});
