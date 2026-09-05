import { describe, expect, it } from "vitest";
import { databaseDiagnostic } from "../../../apps/api/test/helpers/database-diagnostic";

describe("database connection failure diagnostics", () => {
  it("retains the host and Prisma code while hiding credentials and query parameters", () => {
    const output = databaseDiagnostic("postgresql://test-user:test-p%40ss@localhost:5432/test-db?token=test-secret", {
      code: "P1000",
      message: "authentication failed for private-user with secret"
    });
    expect(output).toBe("localhost:5432 (P1000)");
  });
  it.each([undefined, "invalid test-password", "https://localhost/test-db"])("does not echo an invalid database URL %j", (url) => {
    expect(databaseDiagnostic(url, new Error("secret password"))).toBe("configured database (connection failed)");
  });
  it("does not echo an arbitrary provider code", () => {
    expect(databaseDiagnostic("postgresql://localhost/test-db", { code: "password=secret" })).toBe(
      "localhost (connection failed)"
    );
  });
});
