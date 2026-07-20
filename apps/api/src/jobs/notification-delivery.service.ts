import { createHash } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { Inject, Injectable } from "@nestjs/common";
import type { NotificationDelivery, NotificationDeliveryAttempt } from "@prisma/client";
import {
  NOTIFICATION_PROVIDER_ADAPTER,
  type NotificationProviderAdapter,
  type NotificationProviderResult
} from "../notifications/notification-provider.adapter";
import { PrismaService } from "../prisma/prisma.service";
import {
  NOTIFICATION_ACK_FAILPOINT_FILE,
  notificationAckFailpointEnabled
} from "../common/operations/notification-ack-failpoint";
import { JobExecutionError } from "./job-errors";

type DeliveryWithAttempt = NotificationDelivery & { attempts: NotificationDeliveryAttempt[] };

function providerKey(dedupeKey: string, attemptNumber: number) {
  const digest = createHash("sha256").update(dedupeKey).digest("hex");
  return `notification:${digest}:${attemptNumber}`;
}

@Injectable()
export class NotificationDeliveryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER_ADAPTER) private readonly provider: NotificationProviderAdapter
  ) {}

  async deliver(deliveryId: string): Promise<{ code: string }> {
    const delivery = await this.load(deliveryId);
    if (!delivery || ["sent", "cancelled"].includes(delivery.state)) return { code: "NOTIFICATION_ALREADY_FINAL" };

    const unresolved = delivery.attempts.find((attempt) => ["sending", "unknown"].includes(attempt.state));
    if (unresolved) return await this.reconcileAttempt(delivery, unresolved);

    const attemptNumber = delivery.attempts.length + 1;
    const idempotencyKey = providerKey(delivery.dedupeKey, attemptNumber);
    const attempt = await this.prisma.$transaction(async (tx) => {
      await tx.notificationDelivery.update({
        where: { id: delivery.id },
        data: { state: "sending", failureCode: null }
      });
      return await tx.notificationDeliveryAttempt.create({
        data: {
          notificationDeliveryId: delivery.id,
          attemptNumber,
          providerMode: this.provider.mode,
          providerIdempotencyKey: idempotencyKey,
          state: "sending"
        }
      });
    });

    const result = await this.provider.send({
      idempotencyKey,
      deliveryId: delivery.id,
      eventType: delivery.eventType,
      userId: delivery.userId
    });
    if (notificationAckFailpointEnabled() && existsSync(NOTIFICATION_ACK_FAILPOINT_FILE)) {
      unlinkSync(NOTIFICATION_ACK_FAILPOINT_FILE);
      console.error("[worker] release4i local-staging notification acknowledgement-loss failpoint triggered");
      process.exit(87);
    }
    return await this.applyResult(delivery, attempt, result, false);
  }

  async reconcile(deliveryId: string): Promise<{ code: string }> {
    const delivery = await this.load(deliveryId);
    if (!delivery) throw new JobExecutionError("NOTIFICATION_DELIVERY_NOT_FOUND", false);
    if (delivery.state === "sent") return { code: "NOTIFICATION_ALREADY_FINAL" };
    const attempt = delivery.attempts.find((candidate) => ["sending", "unknown"].includes(candidate.state));
    if (!attempt) throw new JobExecutionError("NOTIFICATION_RECONCILIATION_NOT_REQUIRED", false);
    return await this.reconcileAttempt(delivery, attempt);
  }

  private async load(deliveryId: string): Promise<DeliveryWithAttempt | null> {
    return await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: { attempts: { orderBy: { attemptNumber: "desc" } } }
    });
  }

  private async reconcileAttempt(delivery: DeliveryWithAttempt, attempt: NotificationDeliveryAttempt) {
    const result = await this.provider.lookup({
      idempotencyKey: attempt.providerIdempotencyKey,
      deliveryId: delivery.id,
      providerDeliveryId: attempt.providerDeliveryId
    });
    return await this.applyResult(delivery, attempt, result, true);
  }

  private async applyResult(
    delivery: DeliveryWithAttempt,
    attempt: NotificationDeliveryAttempt,
    result: NotificationProviderResult,
    reconciled: boolean
  ): Promise<{ code: string }> {
    const now = new Date();
    if (result.state === "sent") {
      await this.prisma.$transaction([
        this.prisma.notificationDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            state: "sent",
            providerDeliveryId: result.providerDeliveryId,
            failureCode: null,
            completedAt: now,
            reconciledAt: reconciled ? now : null
          }
        }),
        this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { state: "sent", sentAt: now, failureCode: null }
        })
      ]);
      return { code: this.provider.mode === "mock" ? "NOTIFICATION_SENT_MOCK_PROVIDER" : "NOTIFICATION_SENT" };
    }

    if (result.state === "unknown") {
      await this.prisma.$transaction([
        this.prisma.notificationDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            state: "unknown",
            providerDeliveryId: result.providerDeliveryId,
            failureCode: result.failureCode ?? "PROVIDER_RESULT_UNKNOWN",
            reconciledAt: reconciled ? now : null
          }
        }),
        this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { state: "unknown", failureCode: result.failureCode ?? "PROVIDER_RESULT_UNKNOWN" }
        })
      ]);
      throw new JobExecutionError("NOTIFICATION_DELIVERY_UNKNOWN", true);
    }

    await this.prisma.$transaction([
      this.prisma.notificationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          state: "failed",
          providerDeliveryId: result.providerDeliveryId,
          failureCode: result.failureCode ?? "NOTIFICATION_PROVIDER_FAILED",
          completedAt: now,
          reconciledAt: reconciled ? now : null
        }
      }),
      this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          state: "failed",
          retryCount: { increment: 1 },
          failureCode: result.failureCode ?? "NOTIFICATION_PROVIDER_FAILED"
        }
      })
    ]);
    throw new JobExecutionError(result.failureCode ?? "NOTIFICATION_PROVIDER_FAILED", result.retryable);
  }
}
