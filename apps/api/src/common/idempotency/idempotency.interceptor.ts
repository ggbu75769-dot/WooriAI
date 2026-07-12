import { createHash } from "node:crypto";
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { from, lastValueFrom, type Observable } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequest } from "../types/authenticated-request";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 50;
const RETRY_ATTEMPTS = 60; // ~3s of total wait for a concurrent in-flight request to finish

type IdempotencyKeyRow = {
  requestHash: string;
  responseJson: Prisma.JsonValue | null;
  statusCode: number | null;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

function conflictError(message: string) {
  return new HttpException({ code: "IDEMPOTENCY_KEY_CONFLICT", message }, HttpStatus.CONFLICT);
}

/**
 * Opt-in per-route interceptor: when the caller sends an `Idempotency-Key`
 * header, this makes the decorated mutation endpoint safe to retry. The same
 * key + same request body replays the first response instead of re-running
 * the handler; the same key with a *different* body 409s
 * (IDEMPOTENCY_KEY_CONFLICT); no header at all is a no-op passthrough.
 *
 * Concurrency: the `idempotency_keys` table's
 * `@@unique([userId, endpoint, idemKey])` constraint is the actual
 * concurrency guard. Two racing requests with the same key both try to
 * INSERT a reservation row before running the handler; only one wins the
 * unique constraint and actually executes the handler, the other short-polls
 * until the winner's response is persisted and replays it. This is what
 * keeps a double-fire of e.g. "create expense" from creating two expenses.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headerValue = request.headers?.["idempotency-key"];
    const idemKey = (Array.isArray(headerValue) ? headerValue[0] : headerValue)?.trim();

    if (!idemKey) {
      return next.handle();
    }

    const userId = request.user?.id ?? request.adminUser?.id;
    if (!userId) {
      return next.handle();
    }

    const rawRequest = context.switchToHttp().getRequest<{ route?: { path?: string }; url?: string; method?: string }>();
    const routePath = rawRequest.route?.path ?? rawRequest.url ?? "unknown";
    const endpoint = `${rawRequest.method ?? "POST"}:${routePath}`.slice(0, 120);
    const requestHash = createHash("sha256").update(JSON.stringify(request.body ?? {})).digest("hex");

    return from(this.handle(userId, endpoint, idemKey, requestHash, next));
  }

  private async handle(userId: string, endpoint: string, idemKey: string, requestHash: string, next: CallHandler) {
    const reservation = await this.reserve(userId, endpoint, idemKey, requestHash);

    if (reservation.outcome === "conflict") {
      throw conflictError("이미 다른 요청 본문으로 사용된 Idempotency-Key예요.");
    }

    if (reservation.outcome === "replay") {
      const completed = await this.waitForCompletion(userId, endpoint, idemKey);
      return completed.responseJson;
    }

    try {
      const result = await lastValueFrom(next.handle());
      await this.prisma.idempotencyKey.update({
        where: { userId_endpoint_idemKey: { userId, endpoint, idemKey } },
        data: { responseJson: (result ?? null) as Prisma.InputJsonValue, statusCode: 200 }
      });
      return result;
    } catch (error) {
      // Free the key on failure so a genuine retry (not a duplicate side-effect
      // attempt) can succeed later instead of being stuck replaying a failure
      // forever.
      await this.prisma.idempotencyKey.deleteMany({ where: { userId, endpoint, idemKey } }).catch(() => undefined);
      throw error;
    }
  }

  private async reserve(
    userId: string,
    endpoint: string,
    idemKey: string,
    requestHash: string
  ): Promise<{ outcome: "owner" } | { outcome: "replay" } | { outcome: "conflict" }> {
    try {
      await this.prisma.idempotencyKey.create({
        data: { userId, endpoint, idemKey, requestHash, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) }
      });
      return { outcome: "owner" };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { userId_endpoint_idemKey: { userId, endpoint, idemKey } },
        select: { requestHash: true, responseJson: true, statusCode: true }
      });
      if (!existing) {
        // The reservation that won the race failed and was deleted between our
        // failed insert and this lookup; treat as a fresh attempt.
        return this.reserve(userId, endpoint, idemKey, requestHash);
      }
      if (existing.requestHash !== requestHash) {
        return { outcome: "conflict" };
      }
      return { outcome: "replay" };
    }
  }

  private async waitForCompletion(userId: string, endpoint: string, idemKey: string): Promise<IdempotencyKeyRow> {
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      const row = await this.prisma.idempotencyKey.findUnique({
        where: { userId_endpoint_idemKey: { userId, endpoint, idemKey } },
        select: { requestHash: true, responseJson: true, statusCode: true }
      });
      if (!row) {
        throw conflictError("이전 요청 처리에 실패했어요. 다시 시도해 주세요.");
      }
      if (row.statusCode != null) {
        return row;
      }
      await sleep(RETRY_INTERVAL_MS);
    }
    throw conflictError("이전 요청이 아직 처리 중이에요. 잠시 후 다시 시도해 주세요.");
  }
}
