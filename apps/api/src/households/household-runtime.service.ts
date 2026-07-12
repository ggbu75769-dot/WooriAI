import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { MemberRole } from "@wooriai/domain";
import type { AuthenticatedUser } from "../common/types/authenticated-request";

type MemberStatus = "pending" | "active" | "removed" | "left";
type InviteChannel = "kakao" | "sms" | "link";
type InviteStatus = "pending" | "accepted" | "expired" | "revoked";
type InviteRole = Exclude<MemberRole, "owner">;

type HouseholdRecord = {
  id: string;
  name: string;
  ownerUserId: string;
  status: "active" | "archived";
};

type MemberRecord = {
  id: string;
  householdId: string;
  userId: string;
  displayName: string;
  role: MemberRole;
  status: MemberStatus;
  invitedByUserId?: string | null;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
};

type InviteRecord = {
  id: string;
  householdId: string;
  invitedByUserId: string;
  role: InviteRole;
  channel: InviteChannel;
  status: InviteStatus;
  token: string;
  expiresAt: string;
  acceptedByUserId?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
};

@Injectable()
export class HouseholdRuntimeService {
  private readonly householdsById = new Map<string, HouseholdRecord>();
  private readonly membersByKey = new Map<string, MemberRecord>();
  private readonly invitesByToken = new Map<string, InviteRecord>();
  private readonly withdrawnUserIds = new Set<string>();

  registerUserHouseholds(user: AuthenticatedUser) {
    const now = new Date().toISOString();
    for (const household of user.households) {
      if (!this.householdsById.has(household.id)) {
        this.householdsById.set(household.id, {
          id: household.id,
          name: household.name ?? "우리 가족",
          ownerUserId: household.role === "owner" ? user.id : "",
          status: "active"
        });
      }

      const householdRecord = this.householdsById.get(household.id)!;
      if (!householdRecord.ownerUserId && household.role === "owner") {
        householdRecord.ownerUserId = user.id;
      }

      const key = this.memberKey(household.id, user.id);
      if (!this.membersByKey.has(key)) {
        this.membersByKey.set(key, {
          id: randomUUID(),
          householdId: household.id,
          userId: user.id,
          displayName: user.displayName,
          role: household.role,
          status: "active",
          invitedByUserId: null,
          joinedAt: now,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  }

  enrichUser(user: AuthenticatedUser): AuthenticatedUser {
    if (this.withdrawnUserIds.has(user.id)) {
      return { ...user, status: "withdrawn", households: [] };
    }

    this.registerUserHouseholds(user);
    return {
      ...user,
      households: this.householdsForUser(user.id).map((membership) => ({
        id: membership.id,
        name: membership.name,
        role: membership.role
      }))
    };
  }

  removeMember(user: AuthenticatedUser, householdId: string, memberId: string) {
    this.assertOwner(user, householdId);
    const household = this.requireHousehold(householdId);
    const member = [...this.membersByKey.values()].find(
      (record) => record.householdId === householdId && record.id === memberId
    );

    if (!member || member.status === "removed" || member.status === "left") {
      throw new NotFoundException({ code: "HOUSEHOLD_MEMBER_NOT_FOUND", message: "Household member was not found." });
    }

    if (member.userId === household.ownerUserId) {
      throw new BadRequestException({
        code: "HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN",
        message: "Owners cannot remove themselves. Use the leave or account deletion flow instead."
      });
    }

    const before = this.toMemberDto(member);
    const now = new Date().toISOString();
    const updated: MemberRecord = { ...member, status: "removed", updatedAt: now };
    this.membersByKey.set(this.memberKey(householdId, member.userId), updated);

    return { success: true, before, after: this.toMemberDto(updated), householdId };
  }

  leaveHousehold(user: AuthenticatedUser, householdId: string) {
    this.assertMember(user, householdId);
    const member = this.membersByKey.get(this.memberKey(householdId, user.id));
    if (!member) {
      throw new NotFoundException({ code: "HOUSEHOLD_MEMBER_NOT_FOUND", message: "Household member was not found." });
    }
    const now = new Date().toISOString();
    this.membersByKey.set(this.memberKey(householdId, user.id), {
      ...member,
      status: "left",
      updatedAt: now
    });
    return { success: true, flowId: "household_leave" };
  }

  withdrawUser(user: AuthenticatedUser) {
    const now = new Date().toISOString();
    this.withdrawnUserIds.add(user.id);
    for (const member of [...this.membersByKey.values()].filter((record) => record.userId === user.id)) {
      this.membersByKey.set(this.memberKey(member.householdId, member.userId), {
        ...member,
        status: "left",
        updatedAt: now
      });
    }
    return { success: true, flowId: "account_delete" };
  }

  listMembers(user: AuthenticatedUser, householdId: string) {
    this.assertMember(user, householdId);
    return {
      members: [...this.membersByKey.values()]
        .filter((member) => member.householdId === householdId)
        .filter((member) => member.status === "active" || member.status === "pending")
        .sort((left, right) => roleOrder(left.role) - roleOrder(right.role))
        .map((member) => this.toMemberDto(member))
    };
  }

  createInvite(user: AuthenticatedUser, householdId: string, role: InviteRole, channel: InviteChannel) {
    this.assertOwner(user, householdId);
    const household = this.requireHousehold(householdId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
    const token = randomUUID().replaceAll("-", "");
    const invite: InviteRecord = {
      id: randomUUID(),
      householdId,
      invitedByUserId: user.id,
      role,
      channel,
      status: "pending",
      token,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString()
    };
    this.invitesByToken.set(token, invite);
    return {
      inviteUrl: `https://wooriai.local/invite/${token}`,
      expiresAt: invite.expiresAt,
      householdName: household.name
    };
  }

  getInvite(token: string) {
    const invite = this.requirePendingInvite(token);
    const household = this.requireHousehold(invite.householdId);
    return {
      householdName: household.name,
      role: invite.role,
      expiresAt: invite.expiresAt
    };
  }

  acceptInvite(user: AuthenticatedUser, token: string) {
    this.registerUserHouseholds(user);
    const invite = this.requirePendingInvite(token);
    const household = this.requireHousehold(invite.householdId);

    const existingMember = this.membersByKey.get(this.memberKey(invite.householdId, user.id));
    if (existingMember && existingMember.status === "active") {
      throw new ConflictException({
        code: "HOUSEHOLD_ALREADY_MEMBER",
        message: "이미 가족 구성원이에요. 초대를 다시 수락할 필요가 없어요."
      });
    }

    const now = new Date().toISOString();

    this.membersByKey.set(this.memberKey(invite.householdId, user.id), {
      id: randomUUID(),
      householdId: invite.householdId,
      userId: user.id,
      displayName: user.displayName,
      role: invite.role,
      status: "active",
      invitedByUserId: invite.invitedByUserId,
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    });

    invite.status = "accepted";
    invite.acceptedByUserId = user.id;
    invite.acceptedAt = now;

    return {
      household: {
        id: household.id,
        name: household.name,
        role: invite.role
      }
    };
  }

  private householdsForUser(userId: string) {
    return [...this.membersByKey.values()]
      .filter((member) => member.userId === userId && member.status === "active")
      .map((member) => {
        const household = this.requireHousehold(member.householdId);
        return {
          id: household.id,
          name: household.name,
          role: member.role
        };
      });
  }

  private toMemberDto(member: MemberRecord) {
    return {
      id: member.id,
      householdId: member.householdId,
      userId: member.userId,
      displayName: member.displayName,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt
    };
  }

  private assertMember(user: AuthenticatedUser, householdId: string) {
    const role = user.households.find((household) => household.id === householdId)?.role;
    if (!role) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "가족 접근 권한이 없어요." });
    }
  }

  private assertOwner(user: AuthenticatedUser, householdId: string) {
    const role = user.households.find((household) => household.id === householdId)?.role;
    if (role !== "owner") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요." });
    }
  }

  private requireHousehold(householdId: string) {
    const household = this.householdsById.get(householdId);
    if (!household || household.status !== "active") {
      throw new NotFoundException({ code: "HOUSEHOLD_NOT_FOUND", message: "가족을 찾을 수 없어요." });
    }
    return household;
  }

  private requirePendingInvite(token: string) {
    const invite = this.invitesByToken.get(token);
    if (!invite) {
      throw new NotFoundException({ code: "INVITE_NOT_FOUND", message: "초대 링크를 찾을 수 없어요." });
    }
    if (new Date(invite.expiresAt).getTime() <= Date.now()) {
      invite.status = "expired";
    }
    if (invite.status !== "pending") {
      throw new BadRequestException({ code: "INVITE_NOT_PENDING", message: "사용할 수 없는 초대 링크예요." });
    }
    return invite;
  }

  private memberKey(householdId: string, userId: string) {
    return `${householdId}:${userId}`;
  }
}

function roleOrder(role: MemberRole) {
  if (role === "owner") return 0;
  if (role === "co_parent") return 1;
  if (role === "viewer") return 2;
  return 3;
}
