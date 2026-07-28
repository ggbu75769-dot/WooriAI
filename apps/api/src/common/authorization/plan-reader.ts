import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../types/authenticated-request";

export function requirePlanReader(user: AuthenticatedUser, householdId: string) {
  const membership = user.households.find((household) => household.id === householdId);
  if (!membership) {
    throw new ForbiddenException({ code: "HOUSEHOLD_FORBIDDEN", message: "Household access is required." });
  }
  if (membership.role === "gift_participant") {
    throw new ForbiddenException({ code: "ITEM_PLAN_PRIVATE", message: "Preparation details are not available to gift participants." });
  }
  return membership;
}
