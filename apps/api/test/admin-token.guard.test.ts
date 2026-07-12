import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { AdminTokenGuard } from "../src/admin/admin-token.guard";
import type { AuthenticatedRequest } from "../src/common/types/authenticated-request";

function createContext(headerToken?: string) {
  return {
    switchToHttp: () => ({
      getRequest: (): AuthenticatedRequest => ({
        headers: headerToken === undefined ? {} : { "x-admin-token": headerToken }
      })
    })
  };
}

describe("AdminTokenGuard production fail-fast secrets", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.WOORIAI_ADMIN_TOKEN;
  });

  it("throws a configuration error in production when the admin token is not set", () => {
    process.env.NODE_ENV = "production";
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(createContext("dev-admin-token") as never)).toThrow(
      /WOORIAI_ADMIN_TOKEN must be set unless NODE_ENV is "development" or "test"/
    );
  });

  it("throws a configuration error when NODE_ENV is unset and the admin token is not set", () => {
    delete process.env.NODE_ENV;
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(createContext("dev-admin-token") as never)).toThrow(
      /WOORIAI_ADMIN_TOKEN must be set unless NODE_ENV is "development" or "test"/
    );
  });

  it("falls back to the dev admin token outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const guard = new AdminTokenGuard();

    expect(guard.canActivate(createContext("dev-admin-token") as never)).toBe(true);
    expect(() => guard.canActivate(createContext("wrong-token") as never)).toThrow(ForbiddenException);
  });

  it("uses a timing-safe comparison and rejects tokens of different lengths without throwing", () => {
    process.env.NODE_ENV = "test";
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(createContext("short") as never)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(createContext(undefined) as never)).toThrow(ForbiddenException);
  });
});
