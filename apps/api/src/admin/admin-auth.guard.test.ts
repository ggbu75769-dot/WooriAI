import "reflect-metadata";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AdminRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "./admin-auth.guard";
import { ADMIN_MFA_EXEMPT_KEY } from "./admin-mfa-exempt.decorator";
import { ADMIN_ROLES_KEY, RequireAdminRoles } from "./require-admin-roles.decorator";
import { AdminJobsController } from "./admin-jobs.controller";

type FakeAdmin = {
  id: string;
  email: string;
  role: AdminRole;
  mfaEnabledAt: Date | null;
};

function contextFor(
  handler: Function,
  controller: Function,
  request: Record<string, unknown>
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined
    })
  } as unknown as ExecutionContext;
}

function guardFor(admin: FakeAdmin) {
  const sessions = {
    validateSession: vi.fn(async () => ({ admin, sessionId: "session-1" }))
  };
  const legacy = { canActivate: vi.fn(() => false) };
  return new AdminAuthGuard(
    new Reflector(),
    sessions as never,
    legacy as never
  );
}

function cookieRequest(method = "GET") {
  return {
    method,
    headers: { cookie: "admin_session=session-token" }
  };
}

describe("AdminAuthGuard metadata inheritance", () => {
  it("keeps the real dead-letter list/retry/cancel controller admin-only at class scope", () => {
    expect(Reflect.getMetadata(ADMIN_ROLES_KEY, AdminJobsController)).toEqual(["admin"]);
  });

  it("enforces a controller-level admin role on an undecorated handler", async () => {
    class AdminOnlyController {}
    function listDeadLetters() {}
    Reflect.defineMetadata(ADMIN_ROLES_KEY, ["admin"], AdminOnlyController);

    const guard = guardFor({
      id: "editor-1",
      email: "editor@example.com",
      role: "editor",
      mfaEnabledAt: new Date()
    });

    await expect(
      guard.canActivate(contextFor(listDeadLetters, AdminOnlyController, cookieRequest()))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets handler role metadata override a controller default", async () => {
    class AdminDefaultController {}
    function editorAction() {}
    Reflect.defineMetadata(ADMIN_ROLES_KEY, ["admin"], AdminDefaultController);
    Reflect.defineMetadata(ADMIN_ROLES_KEY, ["admin", "editor"], editorAction);
    const request = cookieRequest();
    const guard = guardFor({
      id: "editor-1",
      email: "editor@example.com",
      role: "editor",
      mfaEnabledAt: new Date()
    });

    await expect(
      guard.canActivate(contextFor(editorAction, AdminDefaultController, request))
    ).resolves.toBe(true);
    expect(request).toMatchObject({
      adminUser: { id: "editor-1", role: "editor" },
      adminSessionId: "session-1"
    });
  });

  it("does not inherit an MFA exemption from the controller", async () => {
    class IncorrectlyExemptController {}
    function protectedAction() {}
    Reflect.defineMetadata(ADMIN_MFA_EXEMPT_KEY, true, IncorrectlyExemptController);

    const guard = guardFor({
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
      mfaEnabledAt: null
    });

    await expect(
      guard.canActivate(contextFor(protectedAction, IncorrectlyExemptController, cookieRequest()))
    ).rejects.toMatchObject({
      response: { code: "ADMIN_MFA_SETUP_REQUIRED" }
    });
  });

  it("rejects an empty role decorator at runtime", () => {
    expect(() => (RequireAdminRoles as unknown as () => unknown)()).toThrow(
      "RequireAdminRoles requires at least one role"
    );
  });
});
