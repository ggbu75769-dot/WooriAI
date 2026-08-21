import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { canEdit, memberRoleFor, type ChildRow } from "./store-shared";

/**
 * REF-118: child-scoped access verification split out of the former
 * onboarding-store.service.ts god service. Every decomposed store service in
 * this directory funnels its child view/edit authorization through here so the
 * NOT_FOUND/FORBIDDEN semantics stay identical everywhere.
 */
@Injectable()
export class ChildAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async requireChildAccess(user: AuthenticatedUser, childId: string, edit = false): Promise<ChildRow> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.deletedAt) {
      throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "아이 프로필을 찾을 수 없어요." });
    }

    const role = memberRoleFor(user, child.householdId);
    if (!role || (edit && !canEdit(role))) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "아이 프로필 접근 권한이 없어요." });
    }

    return child;
  }

  async childrenForUser(user: AuthenticatedUser): Promise<ChildRow[]> {
    const householdIds = user.households.map((household) => household.id);
    if (householdIds.length === 0) return [];
    return this.prisma.child.findMany({
      where: { householdId: { in: householdIds }, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
  }
}
