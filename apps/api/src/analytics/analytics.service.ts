import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  analyticsEventEnvelopeSchema,
  getAnalyticsEventPayloadSchema
} from "@wooriai/contracts";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { anonymizeId } from "./analytics-anon.util";

/** POST /analytics/events accepts at most this many envelopes per request (round5a-sprint2-plan.md §5). */
export const ANALYTICS_EVENTS_BATCH_MAX = 50;

export type AnalyticsEventRejection = { index: number; reason: string };
export type SubmitAnalyticsEventsResult = {
  accepted: number;
  rejected: AnalyticsEventRejection[];
};

function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async submitEvents(user: AuthenticatedUser, rawEvents: unknown[]): Promise<SubmitAnalyticsEventsResult> {
    const rejected: AnalyticsEventRejection[] = [];
    let accepted = 0;

    // Always server-derived from the authenticated user -- any user_anon_id /
    // household_anon_id a client might try to smuggle in is impossible here
    // anyway because analyticsEventEnvelopeSchema is .strict() and doesn't
    // declare those fields, but deriving them fresh per request (rather than
    // trusting anything from the request body) is the actual guarantee.
    const userAnonId = anonymizeId(user.id);
    // 다중 가구 사용자도 항상 같은 가구가 익명화되도록 id 사전순 최솟값으로 고정한다
    // (user.households의 조회 순서는 정렬 보장이 없다).
    const primaryHouseholdId = user.households.map((h) => h.id).sort()[0];
    const householdAnonId = primaryHouseholdId ? anonymizeId(primaryHouseholdId) : null;

    for (let index = 0; index < rawEvents.length; index += 1) {
      const envelopeParsed = analyticsEventEnvelopeSchema.safeParse(rawEvents[index]);
      if (!envelopeParsed.success) {
        rejected.push({ index, reason: "ENVELOPE_INVALID" });
        continue;
      }
      const envelope = envelopeParsed.data;

      const payloadSchema = getAnalyticsEventPayloadSchema(envelope.eventName, envelope.eventVersion);
      if (!payloadSchema) {
        rejected.push({ index, reason: "EVENT_NOT_REGISTERED" });
        continue;
      }

      // Re-validated against the registry's strict payload schema even though
      // the envelope schema already parsed `payload` as a generic record --
      // this is the actual PII/forbidden-key gate (strict() rejects unknown
      // keys) called out in round5a-sprint2-plan.md §5 ("raw 저장 전 재확인").
      const payloadParsed = payloadSchema.safeParse(envelope.payload);
      if (!payloadParsed.success) {
        rejected.push({ index, reason: "PAYLOAD_INVALID" });
        continue;
      }

      const existing = await this.prisma.analyticsEvent.findUnique({
        where: { eventId: envelope.eventId },
        select: { id: true }
      });
      if (existing) {
        // Duplicate event_id: idempotent re-send, treated as accepted without
        // a second insert.
        accepted += 1;
        continue;
      }

      try {
        await this.prisma.analyticsEvent.create({
          data: {
            eventName: envelope.eventName,
            eventVersion: envelope.eventVersion,
            eventId: envelope.eventId,
            occurredAt: new Date(envelope.occurredAt),
            userAnonId,
            householdAnonId,
            appVersion: envelope.appVersion ?? null,
            platform: envelope.platform ?? null,
            payload: payloadParsed.data as Prisma.InputJsonValue
          }
        });
        accepted += 1;
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          // Lost a race against a concurrent request inserting the same
          // event_id -- still idempotent-accept rather than surfacing an
          // error to the client.
          accepted += 1;
          continue;
        }
        throw error;
      }
    }

    return { accepted, rejected };
  }
}
