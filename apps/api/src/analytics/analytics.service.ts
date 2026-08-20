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

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async submitEvents(user: AuthenticatedUser, rawEvents: unknown[]): Promise<SubmitAnalyticsEventsResult> {
    const rejected: AnalyticsEventRejection[] = [];

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

    // ANA-105: validation stays strictly per-row and BEFORE any insert -- a bad
    // row is rejected with its index while the rest of the batch proceeds --
    // but the surviving rows are persisted in a single createMany statement
    // instead of the old N-queries-per-batch loop.
    const rows: Prisma.AnalyticsEventCreateManyInput[] = [];
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

      rows.push({
        eventName: envelope.eventName,
        eventVersion: envelope.eventVersion,
        eventId: envelope.eventId,
        occurredAt: new Date(envelope.occurredAt),
        userAnonId,
        householdAnonId,
        appVersion: envelope.appVersion ?? null,
        platform: envelope.platform ?? null,
        payload: payloadParsed.data as Prisma.InputJsonValue
      });
    }

    if (rows.length > 0) {
      // skipDuplicates (INSERT ... ON CONFLICT DO NOTHING on the unique
      // event_id) is the whole idempotency story now: a re-sent event_id --
      // whether it already exists from an earlier batch, is repeated within
      // this batch, or races a concurrent request -- silently inserts nothing.
      // Duplicates still count as accepted (idempotent re-send, same contract
      // as the old findUnique/P2002 handling), so `accepted` is the number of
      // rows that passed validation, not createMany's inserted-row count.
      await this.prisma.analyticsEvent.createMany({
        data: rows,
        skipDuplicates: true
      });
    }

    return { accepted: rows.length, rejected };
  }
}
