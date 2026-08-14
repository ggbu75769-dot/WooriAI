import { Inject, Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkerJob } from "../worker-job";

export const DEFAULT_LINK_HEALTH_INTERVAL_HOURS = 24;
export const DEFAULT_LINK_HEALTH_BATCH = 10;
export const LINK_HEALTH_TIMEOUT_MS = 5_000;
export const LINK_HEALTH_MAX_REDIRECT_HOPS = 5;
const HOUR_MS = 60 * 60 * 1000;

/**
 * COM-105 health verdict persisted to product_links.health_status
 * (NULL in the column = never checked yet, shown as 미확인 in the admin UI).
 */
export type LinkHealthStatus = "ok" | "broken" | "unstable";

/**
 * Minimal fetch-shaped contract the health check needs. Kept as its own type
 * (rather than `typeof fetch`) so unit tests inject a tiny mock that returns
 * canned statuses without touching the network — same reasoning as
 * KakaoOidcClient in src/auth/kakao/kakao-oidc-client.ts.
 */
export type LinkHealthFetch = (
  url: string,
  init: { method: "HEAD" | "GET"; redirect: "manual"; signal: AbortSignal }
) => Promise<Response>;

/** DI token for LinkHealthFetch — a function type has no runtime value to key providers off of. */
export const LINK_HEALTH_FETCH = Symbol("LINK_HEALTH_FETCH");

/** Default implementation: Node 22 built-in (undici) fetch. */
export const defaultLinkHealthFetch: LinkHealthFetch = (url, init) => fetch(url, init);

/**
 * COM-105: affiliate-link health check. Dead or redirect-broken product links
 * silently kill conversion; this job probes each link's affiliateUrl and
 * stores a verdict + timestamp on product_links so the admin links page can
 * surface it (정상/깨짐/불안정/미확인).
 *
 * Probe: HEAD with a 5s timeout, retried as GET when the origin answers 405
 * (many shop CDNs reject HEAD). Redirects are followed manually, at most
 * LINK_HEALTH_MAX_REDIRECT_HOPS hops. Verdict mapping:
 *   - final 2xx/3xx                          -> "ok"
 *   - 4xx, or a redirect chain/loop > 5 hops -> "broken"
 *   - 5xx / timeout / network error          -> "unstable" (retried next round)
 *
 * Scheduling: runs on the existing INF-006-lite scheduler tick but is
 * internally rate-limited — per tick it checks at most LINK_HEALTH_BATCH
 * (default 10) links (bounds tick duration), and only links that were never
 * checked, whose last check is older than LINK_HEALTH_INTERVAL_HOURS
 * (default 24h), or whose last verdict was "unstable" (transient by
 * definition, so it gets the next-round retry). Never-checked links are
 * served first.
 *
 * The whole job is additionally gated behind LINK_HEALTH_ENABLED=1: outbound
 * network traffic from the worker is opt-in (default off), unlike the purely
 * DB-local cleanup jobs.
 *
 * run() never throws for an individual link: probe failures become an
 * "unstable" verdict, and even a per-link DB write failure is caught and
 * counted so one bad row can't abort the batch (the scheduler additionally
 * isolates job-level failures, but we don't rely on that here).
 */
@Injectable()
export class LinkHealthJob implements WorkerJob {
  readonly name = "link_health";

  private readonly fetchFn: LinkHealthFetch;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(LINK_HEALTH_FETCH) fetchFn?: LinkHealthFetch
  ) {
    this.fetchFn = fetchFn ?? defaultLinkHealthFetch;
  }

  static isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.LINK_HEALTH_ENABLED === "1";
  }

  static intervalHours(env: NodeJS.ProcessEnv = process.env): number {
    const raw = Number(env.LINK_HEALTH_INTERVAL_HOURS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LINK_HEALTH_INTERVAL_HOURS;
  }

  static batchSize(env: NodeJS.ProcessEnv = process.env): number {
    const raw = Number(env.LINK_HEALTH_BATCH);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_LINK_HEALTH_BATCH;
  }

  async run(now: Date): Promise<Record<string, unknown>> {
    if (!LinkHealthJob.isEnabled()) {
      return { enabled: false, checked: 0 };
    }

    const intervalHours = LinkHealthJob.intervalHours();
    const batch = LinkHealthJob.batchSize();
    const cutoff = new Date(now.getTime() - intervalHours * HOUR_MS);

    // Only active links that actually have an affiliate URL are health-relevant.
    const candidates = await this.prisma.productLink.findMany({
      where: {
        active: true,
        affiliateUrl: { not: null },
        OR: [
          { healthCheckedAt: null },
          { healthCheckedAt: { lt: cutoff } },
          // Transient failures are retried on the next round instead of
          // waiting out the full interval.
          { healthStatus: "unstable" }
        ]
      },
      orderBy: { healthCheckedAt: { sort: "asc", nulls: "first" } },
      take: batch,
      select: { id: true, affiliateUrl: true }
    });

    const counts: Record<LinkHealthStatus, number> = { ok: 0, broken: 0, unstable: 0 };
    let errors = 0;
    for (const link of candidates) {
      try {
        // affiliateUrl is non-null by the where clause; the fallback only
        // guards the type.
        const status = await this.checkUrl(link.affiliateUrl ?? "");
        await this.prisma.productLink.update({
          where: { id: link.id },
          data: { healthStatus: status, healthCheckedAt: now }
        });
        counts[status] += 1;
      } catch {
        // Individual-link failure isolation: even an unexpected error (e.g.
        // the row was deleted mid-batch) never aborts the remaining links.
        errors += 1;
      }
    }

    return { enabled: true, checked: candidates.length, ...counts, errors, intervalHours, batch };
  }

  /**
   * Probes one URL and maps the outcome to a LinkHealthStatus. Never throws:
   * timeout/abort/network errors are an "unstable" verdict by definition.
   */
  private async checkUrl(url: string): Promise<LinkHealthStatus> {
    try {
      let currentUrl = url;
      for (let hop = 0; hop <= LINK_HEALTH_MAX_REDIRECT_HOPS; hop += 1) {
        let response = await this.requestOnce(currentUrl, "HEAD");
        if (response.status === 405) {
          // Origin rejects HEAD specifically — retry the same URL as GET.
          response = await this.requestOnce(currentUrl, "GET");
        }
        const { status } = response;
        if (status >= 300 && status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            // A 3xx that points nowhere is still a served response — 2xx/3xx -> ok.
            return "ok";
          }
          if (hop === LINK_HEALTH_MAX_REDIRECT_HOPS) {
            // Redirect chain longer than 5 hops (or a loop) — exactly the
            // "redirect-broken" case this ticket exists for.
            return "broken";
          }
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        if (status >= 200 && status < 300) return "ok";
        if (status >= 400 && status < 500) return "broken";
        // 5xx and anything exotic (1xx leaking through, etc.): transient.
        return "unstable";
      }
      return "broken";
    } catch {
      // Timeout (AbortSignal), DNS failure, refused connection, malformed
      // redirect Location — all transient/unreachable -> retry next round.
      return "unstable";
    }
  }

  private requestOnce(url: string, method: "HEAD" | "GET"): Promise<Response> {
    return this.fetchFn(url, {
      method,
      // Redirects are followed manually in checkUrl so the hop count is
      // bounded at 5 (undici's default follow limit is 20 and it hides the
      // intermediate statuses).
      redirect: "manual",
      signal: AbortSignal.timeout(LINK_HEALTH_TIMEOUT_MS)
    });
  }
}
