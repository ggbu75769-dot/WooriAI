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

  it("fails closed with a 403 in production when the admin token is not set (not a 500 config error)", () => {
    process.env.NODE_ENV = "production";
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(createContext("dev-admin-token") as never)).toThrow(ForbiddenException);
  });

  it("fails closed with a 403 in production even when the admin token IS configured and matches (legacy guard is fully disabled outside dev/test)", () => {
    process.env.NODE_ENV = "production";
    process.env.WOORIAI_ADMIN_TOKEN = "some-real-admin-token";

    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(createContext("some-real-admin-token") as never)).toThrow(ForbiddenException);
  });

  it("fails closed with a 403 when NODE_ENV is unset, without ever evaluating the admin token secret", () => {
    delete process.env.NODE_ENV;
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const guard = new AdminTokenGuard();

    expect(() => guard.canActivate(createContext("dev-admin-token") as never)).toThrow(ForbiddenException);
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
