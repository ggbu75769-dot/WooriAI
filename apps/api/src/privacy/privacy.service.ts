import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { canTransitionPrivacyRequest, type PrivacyState } from "./privacy-state";

const OPEN_STATES: PrivacyState[] = [
  "requested",
  "access_revoked",
  "processor_delete_queued",
  "purging",
  "retained_exception",
  "failed"
];

function statusSecret(): string {
  return process.env.PRIVACY_STATUS_TOKEN_SECRET ?? "wooriai-dev-privacy-status-token-secret";
}

function statusToken(requestId: string): string {
  return createHmac("sha256", statusSecret()).update(requestId).digest("base64url");
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function statusDto(request: {
  id: string;
  requestType: string;
  state: string;
  requestedAt: Date;
  dueAt: Date | null;
  completedAt: Date | null;
  failureCode: string | null;
  exportExpiresAt: Date | null;
}) {
  return {
    id: request.id,
    requestType: request.requestType,
    state: request.state,
    requestedAt: request.requestedAt.toISOString(),
    dueAt: request.dueAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    failureCode: request.failureCode,
    exportExpiresAt: request.exportExpiresAt?.toISOString() ?? null
  };
}

@Injectable()
export class PrivacyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async requestDeletion(user: AuthenticatedUser) {
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id})::bigint)`;
      const existing = await tx.privacyRequest.findFirst({
        where: { userId: user.id, requestType: "deletion", state: { in: OPEN_STATES } },
        orderBy: { requestedAt: "desc" }
      });
      if (existing) return existing;

      const ownedMemberships = await tx.householdMember.findMany({
        where: { userId: user.id, role: "owner", status: "active" }
      });
      for (const membership of ownedMemberships) {
        const activeMembers = await tx.householdMember.count({
          where: { householdId: membership.householdId, status: "active" }
        });
        if (activeMembers > 1) {
          throw new ConflictException({
            code: "OWNER_TRANSFER_REQUIRED",
            message: "계정 삭제 전에 공동 양육자에게 가족 소유권을 이전해 주세요.",
            householdId: membership.householdId
          });
        }
      }

      const rawRequest = await tx.privacyRequest.create({
        data: { userId: user.id, requestType: "deletion" }
      });
      const hashedStatusToken = tokenHash(statusToken(rawRequest.id));
      const created = await tx.privacyRequest.update({
        where: { id: rawRequest.id },
        data: { state: "access_revoked", accessRevokedAt: new Date(), statusTokenHash: hashedStatusToken }
      });

      const now = new Date();
      await tx.privacyRequestEvent.createMany({
        data: [
          {
            privacyRequestId: created.id,
            previousState: null,
            nextState: "requested",
            actorType: "user",
            eventCode: "DELETION_REQUESTED"
          },
          {
            privacyRequestId: created.id,
            previousState: "requested",
            nextState: "access_revoked",
            actorType: "system",
            eventCode: "ACCESS_REVOKED"
          }
        ]
      });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.userDevice.updateMany({
        where: { userId: user.id, disabledAt: null },
        data: { disabledAt: now, pushToken: null, notificationEnabled: false }
      });
      await tx.householdMember.updateMany({
        where: { userId: user.id, status: { in: ["active", "pending"] } },
        data: { status: "left" }
      });
      for (const membership of ownedMemberships) {
        await tx.household.update({
          where: { id: membership.householdId },
          data: { status: "archived", deletedAt: now }
        });
      }
      await tx.user.update({ where: { id: user.id }, data: { status: "withdrawn", deletedAt: now } });
      await tx.jobOutbox.create({
        data: {
          topic: "privacy.delete",
          aggregateType: "privacy_request",
          aggregateId: created.id,
          dedupeKey: created.id,
          payloadJson: { privacyRequestId: created.id, userId: user.id }
        }
      });
      return created;
    });

    return { ...statusDto(request), statusToken: statusToken(request.id) };
  }

  async requestExport(user: AuthenticatedUser) {
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`export:${user.id}`})::bigint)`;
      const existing = await tx.privacyRequest.findFirst({
        where: { userId: user.id, requestType: "export", state: { in: OPEN_STATES } },
        orderBy: { requestedAt: "desc" }
      });
      if (existing) return existing;
      const created = await tx.privacyRequest.create({ data: { userId: user.id, requestType: "export" } });
      await tx.privacyRequestEvent.create({
        data: {
          privacyRequestId: created.id,
          previousState: null,
          nextState: "requested",
          actorType: "user",
          eventCode: "EXPORT_REQUESTED"
        }
      });
      await tx.jobOutbox.create({
        data: {
          topic: "privacy.export",
          aggregateType: "privacy_request",
          aggregateId: created.id,
          dedupeKey: created.id,
          payloadJson: { privacyRequestId: created.id, userId: user.id }
        }
      });
      return created;
    });
    return statusDto(request);
  }

  async statusForUser(user: AuthenticatedUser, requestId: string) {
    const request = await this.prisma.privacyRequest.findFirst({ where: { id: requestId, userId: user.id } });
    if (!request) throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "요청을 찾을 수 없어요." });
    return statusDto(request);
  }

  async publicDeletionStatus(requestId: string, token: string) {
    const request = await this.prisma.privacyRequest.findUnique({ where: { id: requestId } });
    if (!request?.statusTokenHash || request.requestType !== "deletion") {
      throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "요청을 찾을 수 없어요." });
    }
    const presented = Buffer.from(tokenHash(token));
    const expected = Buffer.from(request.statusTokenHash);
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      throw new ForbiddenException({ code: "PRIVACY_STATUS_TOKEN_INVALID", message: "상태 조회 토큰이 올바르지 않아요." });
    }
    return statusDto(request);
  }

  async transition(
    requestId: string,
    nextState: PrivacyState,
    eventCode: string,
    options: { actorType?: string; failureCode?: string; metadata?: Prisma.InputJsonValue } = {}
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const request = await tx.privacyRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException({ code: "PRIVACY_REQUEST_NOT_FOUND", message: "요청을 찾을 수 없어요." });
      if (!canTransitionPrivacyRequest(request.state, nextState)) {
        throw new BadRequestException({ code: "PRIVACY_STATE_TRANSITION_INVALID", message: "허용되지 않은 상태 변경이에요." });
      }
      const changed = await tx.privacyRequest.updateMany({
        where: { id: requestId, state: request.state },
        data: {
          state: nextState,
          failureCode: options.failureCode,
          completedAt: nextState === "completed" ? new Date() : undefined
        }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "PRIVACY_STATE_RACE", message: "요청 상태가 변경됐어요." });
      await tx.privacyRequestEvent.create({
        data: {
          privacyRequestId: requestId,
          previousState: request.state,
          nextState,
          actorType: options.actorType ?? "worker",
          eventCode,
          metadataJson: options.metadata
        }
      });
      return await tx.privacyRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
  }
}
