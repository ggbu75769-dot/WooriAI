import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_ROLES_KEY,
  HouseholdRoleGuard,
  RequireHouseholdRoles
} from "../src/common/guards/household-role.guard";

function createContext(role: string, householdId = "household-1") {
  const handler = () => undefined;
  Reflect.defineMetadata(HOUSEHOLD_ROLES_KEY, ["owner", "co_parent"], handler);

  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        params: { householdId },
        user: {
          households: [{ id: "household-1", role }]
        }
      })
    })
  };
}

describe("HouseholdRoleGuard", () => {
  it("allows explicitly permitted household roles", () => {
    const guard = new HouseholdRoleGuard(new Reflector());

    expect(guard.canActivate(createContext("owner") as never)).toBe(true);
    expect(guard.canActivate(createContext("co_parent") as never)).toBe(true);
  });

  it("rejects authenticated users without a permitted household role", () => {
    const guard = new HouseholdRoleGuard(new Reflector());

    expect(() => guard.canActivate(createContext("viewer") as never)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(createContext("owner", "other-household") as never)).toThrow(
      ForbiddenException
    );
  });

  it("stores required role metadata with the decorator", () => {
    class TestController {
      @RequireHouseholdRoles("viewer")
      handler() {
        return true;
      }
    }

    expect(Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, TestController.prototype.handler)).toEqual([
      "viewer"
    ]);
  });
});
