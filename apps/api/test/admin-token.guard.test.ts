import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTokenGuard, LEGACY_DEV_ADMIN_ID } from "../src/admin/admin-token.guard";
import type { AuthenticatedRequest } from "../src/common/types/authenticated-request";

function createContext(headerToken?: string) {
  const request: AuthenticatedRequest = {
    headers: headerToken === undefined ? {} : { "x-admin-token": headerToken }
  };
  return {
    switchToHttp: () => ({
      getRequest: (): AuthenticatedRequest => request
    })
  };
}

describe("AdminTokenGuard production fail-fast secrets", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.WOORIAI_ADMIN_TOKEN;
  });

  function guard() {
    return new AdminTokenGuard({
      adminUser: {
        upsert: vi.fn().mockResolvedValue({
          id: LEGACY_DEV_ADMIN_ID,
          email: "dev-admin@wooriai.local",
          role: "admin"
        })
      }
    } as never);
  }

  it("fails closed with a 403 in production when the admin token is not set (not a 500 config error)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.WOORIAI_ADMIN_TOKEN;

    await expect(guard().canActivate(createContext("dev-admin-token") as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("fails closed with a 403 in production even when the admin token IS configured and matches (legacy guard is fully disabled outside dev/test)", async () => {
    process.env.NODE_ENV = "production";
    process.env.WOORIAI_ADMIN_TOKEN = "some-real-admin-token";

    await expect(guard().canActivate(createContext("some-real-admin-token") as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("fails closed with a 403 when NODE_ENV is unset, without ever evaluating the admin token secret", async () => {
    delete process.env.NODE_ENV;
    delete process.env.WOORIAI_ADMIN_TOKEN;

    await expect(guard().canActivate(createContext("dev-admin-token") as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("falls back to the dev admin token outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const tokenGuard = guard();

    const context = createContext("dev-admin-token");
    await expect(tokenGuard.canActivate(context as never)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().adminUser?.id).toBe(LEGACY_DEV_ADMIN_ID);
    expect(LEGACY_DEV_ADMIN_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await expect(tokenGuard.canActivate(createContext("wrong-token") as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("uses a timing-safe comparison and rejects tokens of different lengths without throwing", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.WOORIAI_ADMIN_TOKEN;

    const tokenGuard = guard();
    await expect(tokenGuard.canActivate(createContext("short") as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(tokenGuard.canActivate(createContext(undefined) as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
