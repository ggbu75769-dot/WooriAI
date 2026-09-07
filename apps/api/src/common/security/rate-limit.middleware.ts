import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { safeCompare } from "../../auth/token.service";
import { requireSecret } from "../config/require-secret";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_GLOBAL_MAX = 300;
const DEFAULT_AUTH_MAX = 30;
const DEFAULT_REDIRECT_MAX = 60;
// SEC-132: raised from 30 to 60. See the ANALYTICS_PATH_PATTERN comment below —
// once every *successful* analytics write also has to pass the per-account
// bucket, the per-IP bucket no longer has to be the primary abuse control for
// authenticated traffic, and its old 30/min ceiling was mostly a false-block
// generator behind carrier NAT.
const DEFAULT_ANALYTICS_MAX = 60;
const DEFAULT_ANALYTICS_USER_MAX = 60;
// SEC-133: 인증 클릭 경로(POST /product-links/:id/click)의 전용 상한 둘.
// 값을 이렇게 고른 근거는 아래 PRODUCT_LINK_CLICK_PATH_PATTERN 머리말의 "실사용 상한" 문단이다.
const DEFAULT_PRODUCT_LINK_CLICK_MAX = 60;
const DEFAULT_PRODUCT_LINK_CLICK_USER_MAX = 30;

// api/v1 is the global prefix set in bootstrap.ts's configureApiApp; this
// middleware runs at the raw Express level (registered before Nest's router
// is mounted), so it sees the request path exactly as sent by the client,
// including that prefix.
const AUTH_PATH_PATTERN = /^\/api\/v1\/(admin\/)?auth\//;

// SEC-115 F3: the public affiliate redirect (GET /api/v1/r/:code) performs an
// affiliate_clicks INSERT per request, so under the global-only ceiling one IP
// could write 300 rows/min. 60 req/min is still far beyond any human
// click-through pace (1/sec sustained) but caps the write amplification.
const REDIRECT_PATH_PATTERN = /^\/api\/v1\/r\//;

// SEC-130: analytics collection is the only endpoint where ONE request writes
// MANY rows — POST /api/v1/analytics/events accepts a batch of up to
// ANALYTICS_EVENTS_BATCH_MAX (= 50, analytics.service.ts) envelopes and inserts
// one analytics_events row per accepted event. Under the global-only ceiling
// (300 req/min) a single IP could therefore drive 300 × 50 = 15,000 inserts per
// minute — two orders of magnitude above any other endpoint's per-request write
// amplification, and the cheapest way to bloat the analytics table (which the
// admin KPI aggregates then have to scan). A dedicated 30 req/min bucket caps
// that at 30 × 50 = 1,500 rows/min per IP while leaving the mobile client
// enormous headroom: it flushes its queue in batches every few minutes, i.e.
// well under 1 req/min per device. Being authenticated (JwtAuthGuard) does not
// make the endpoint safe on its own — one valid token plus a loop is all an
// abuser needs, and the auth/* bucket does not cover this path.
//
// SEC-132: the IP bucket alone was both too coarse and too narrow.
//   - Too coarse: behind carrier-grade NAT (the normal case for Korean mobile
//     networks) hundreds of devices egress from one address, so they all share
//     one bucket and a busy cell can 429 users who did nothing wrong.
//   - Too narrow: it keys on something the abuser controls. One token replayed
//     from rotating IPs (proxy pool, tethering, a handful of VPN exits) never
//     fills any single IP bucket, which was the acknowledged residual of the
//     Round 30 P3 review.
// The fix is a SECOND bucket keyed on the authenticated user id, ANDed with the
// IP bucket: a request is admitted only if it fits under both. The account
// bucket is what actually bounds sustained writes now (60 req/min × 50 rows =
// 3,000 rows/min per account, no matter how many IPs the caller rotates
// through), which is why the IP ceiling could be relaxed to 60 — its remaining
// job is only to blunt unauthenticated/invalid-token floods (those never reach
// a user bucket), and those are already covered by the global 300/min ceiling.
// Sizing: the mobile client flushes its queue every few minutes, i.e. well
// under 1 req/min per device, so 60/min leaves roughly two orders of magnitude
// of headroom even for a user running several devices on one account.
const ANALYTICS_PATH_PATTERN = /^\/api\/v1\/analytics\/events\/?$/;

// SEC-133: 인증 클릭 경로 — POST /api/v1/product-links/:productLinkId/click.
//
// ⚠️ **두 시점.** 종전(그때는 참): 이 경로에는 전용 버킷이 없었고 전역 300/분 IP 상한만
// 걸렸다. 그때의 암묵적 근거는 *"인증된 경로다"* 였는데, 바로 위 SEC-130 문단(`:41-42`)이
// 같은 근거를 이미 부정해 두었다 — 유효 토큰 하나와 반복문이면 끝난다.
//
// → 이제: 구조적 쌍둥이인 공개 리다이렉트(REDIRECT_PATH_PATTERN)와 **같은 모양**의 전용
// 버킷을 세운다. 근거도 그 쌍둥이와 글자 그대로 같다 — **요청 1건 = affiliate_clicks 행
// 1건**이다(onboarding/items-catalog.service.ts의 `clickProductLink`가 요청마다
// `affiliateClick.create`를 한 번 돈다). 그 1:1을 끊어 줄 것이 아무것도 없다: 스키마의
// AffiliateClick에는 인덱스만 있고 유니크 제약이 없으며(prisma/schema.prisma),
// items-commerce/commerce.controller.ts에는 `@UseInterceptors`가 0건이라 멱등 키도 없다
// (같은 모듈의 custom-items.controller.ts는 IdempotencyInterceptor를 달고 있다 — 즉
// 관례가 없어서가 아니라 이 경로에만 없다).
//
// 그리고 그 표는 **운영이 보는 수치를 그대로 먹인다**: admin/dashboard-summary.service.ts의
// `affiliateClicks7d`와 admin/affiliate-click-breakdown.service.ts의 플랫폼별·일별 분해가
// 전부 affiliate_clicks의 행 수다. 부풀린 클릭은 어드민 화면에 **허위 수치**로 선다.
//
// **상한 값의 근거 — 정찰이 제시한 60을 그대로 베끼지 않고 실사용 상한을 재서 정했다.**
//  · 클릭이 성공하면 앱은 곧바로 `Linking.openURL`로 **앱 밖으로 나간다**
//    (apps/mobile/app/items/[itemTemplateId].tsx의 `clickLink.onSuccess`). 다음 클릭은
//    사람이 앱을 도로 전환하고 나서야 가능하다.
//  · 열기 실패 뒤의 재시도(`retryOpenFallbackLink`)는 저장해 둔 `redirectUrl`을 다시 열 뿐
//    **서버 클릭을 다시 만들지 않는다** — 재시도가 행을 늘리지 않는다.
//  · 왕복이 끝나기 전 **같은 링크**의 두 번째 탭은 앱이 조용히 떨어뜨린다(라운드 91 리뷰의
//    `handleProductLinkPress`). 다른 링크는 정당한 별개 클릭으로 통과한다.
//  · 한 준비템이 들고 있는 판매처 링크 수는 **실측 최대 2**다(로컬 dev DB의 product_links
//    67행을 item_template_id로 묶은 최댓값 = 2, 실측 2026-09-07).
//  ⇒ 상세 한 화면이 낳을 수 있는 정직한 클릭은 최대 2건이고, 다음 상세로 가려면 목록→상세
//    왕복(`getItemDetail`)이 한 번 더 붙는다. 가장 서두른 비교 구매(상세 하나를 6초에
//    소진)라도 **분당 12건 언저리**가 사람이 낼 수 있는 상한이다.
//
// 그래서 **계정 30/분**을 실사용 상한으로 둔다 — 위 추정의 2.5배이고, 한 계정을 두 기기에서
// 쓰는 가구까지 덮는다. 동시에 한 계정이 만들 수 있는 행을 300 → 30으로 열 배 좁힌다.
// **IP는 60/분**으로 쌍둥이와 같은 값을 쓴다. IP 쪽을 계정 쪽까지 조이지 **않는** 이유는
// SEC-132가 분석 IP 상한을 30에서 60으로 되돌린 그 이유 그대로다: 한국 이동통신의 CGNAT
// 뒤에서는 한 주소에 수백 기기가 실려, 사람 한 명의 속도에 맞춘 IP 상한은 잘못 없는
// 사용자를 막는 **새 결함**이 된다. 사람 단위 상한을 지는 것은 계정 버킷 쪽이다.
//
// 경로 모양: `^` 고정이라 어드민 카탈로그 경로(`/api/v1/admin/product-links/...`)는 걸리지
// 않는다 — 그쪽은 클릭 행을 만들지 않는다. 끝의 `/click`까지 요구하므로 앞으로 이 접두 아래
// 읽기 전용 라우트가 생겨도 쓰기 예산에 청구되지 않는다(ANALYTICS_PATH_PATTERN이 메서드까지
// 좁힌 것과 같은 규율).
const PRODUCT_LINK_CLICK_PATH_PATTERN = /^\/api\/v1\/product-links\/[^/]+\/click\/?$/;

/**
 * SEC-132: the authenticated user id for the account-scoped analytics bucket.
 *
 * This middleware runs at the raw Express level, *before* Nest's router and
 * therefore before JwtAuthGuard — `req.user` does not exist yet. Reading the
 * `sub` claim out of the JWT without checking the signature would be worse than
 * useless: the payload is unencrypted base64url, so an abuser could mint a
 * fresh forged `sub` per request and get an unlimited supply of buckets. So we
 * verify the HMAC here, exactly the way TokenService.verifyToken does (same
 * secret, same HS256 signing input, same type/exp checks, same legacy
 * `id`-instead-of-`sub` tolerance from SEC-131). That is cheap and stateless —
 * no DB round-trip, no DI — and it is what lets the check stay in the
 * middleware instead of moving to a guard or interceptor: the limiter has to
 * keep rejecting *before* body parsing, which is exactly the cost this endpoint
 * is being protected from.
 *
 * Anything we cannot verify returns null and is charged to no user bucket; such
 * a request is heading for a 401 at the guard anyway, and the IP bucket still
 * applies. The e2e tests drive this with tokens minted by the real login flow,
 * so a change to the token format breaks them loudly instead of silently
 * degrading this back to IP-only.
 */
function accessTokenSubject(req: Request): string | null {
  const header = req.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith("Bearer ")) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = value.slice("Bearer ".length).trim().split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  try {
    const secret = requireSecret("JWT_ACCESS_SECRET", "wooriai-dev-access-secret");
    const expected = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
    if (!safeCompare(signature, expected)) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      sub?: unknown;
      id?: unknown;
      type?: unknown;
      exp?: unknown;
    };
    if (parsed.type !== "access") {
      return null;
    }
    if (typeof parsed.exp !== "number" || parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return typeof parsed.sub === "string" ? parsed.sub : typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    // Malformed base64/JSON, or a missing secret in a misconfigured deploy:
    // bucket bookkeeping must never turn a request into a 500.
    return null;
  }
}

type Bucket = { count: number; windowStart: number };

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function requestIdOf(req: Request): string | undefined {
  const header = req.headers["x-request-id"];
  return Array.isArray(header) ? header[0] : header;
}

/**
 * In-memory, per-IP rate limiter. Keys on req.ip — behind a reverse proxy
 * (Caddy/Fly) this is only the real client IP when TRUST_PROXY=1 is set so
 * bootstrap.ts's configureApiApp enables Express `trust proxy` (1 hop);
 * without it every request would share the proxy's IP and collapse into one
 * global bucket. A global ceiling (default 300 req/min)
 * applies to every request; `auth/*` and `admin/auth/*` additionally obey a
 * much tighter ceiling (default 30 req/min) since those are the
 * brute-force-sensitive endpoints (on top of admin login's existing
 * email+IP attempt limiter in AdminAuthService, which is unrelated and
 * unaffected by this), and the public affiliate redirect `r/*` obeys its own
 * ceiling (default 60 req/min) since each request inserts an
 * affiliate_clicks row (SEC-115 F3). `POST analytics/events` likewise obeys
 * its own ceiling (default 60 req/min) since each request inserts up to 50
 * analytics_events rows (SEC-130), and — because an IP is neither a stable nor
 * an attacker-proof identity — additionally obeys a per-account ceiling
 * (default 60 req/min) keyed on the verified JWT subject, ANDed with the IP
 * bucket (SEC-132).
 *
 * ⚠️ 두 시점(SEC-133). 종전(그때는 참): 위 목록은 **공개** 리다이렉트만 클릭 쓰기 경로로
 * 셌다. 이제: 인증된 `POST product-links/:id/click`도 같은 이유(요청 1건 = affiliate_clicks
 * 행 1건)로 자기 IP 상한(기본 60 req/min)과 자기 계정 상한(기본 30 req/min)을 함께 지킨다 —
 * 근거와 값의 산출은 PRODUCT_LINK_CLICK_PATH_PATTERN 머리말에 있다.
 *
 * Test isolation: limits are read from RATE_LIMIT_GLOBAL_MAX /
 * RATE_LIMIT_AUTH_MAX / RATE_LIMIT_REDIRECT_MAX / RATE_LIMIT_ANALYTICS_MAX /
 * RATE_LIMIT_ANALYTICS_USER_MAX / RATE_LIMIT_PRODUCT_LINK_CLICK_MAX /
 * RATE_LIMIT_PRODUCT_LINK_CLICK_USER_MAX / RATE_LIMIT_WINDOW_MS env
 * vars on every request (not
 * captured once at startup), and each call to this factory creates a fresh,
 * closure-scoped bucket Map -- so a dedicated test can set very low limits
 * for its own app instance without affecting any other test file's app.
 */
export function rateLimitMiddleware() {
  const buckets = new Map<string, Bucket>();
  // 오래된 버킷을 주기적으로 청소해 유니크 IP가 많아도 맵이 무한히 자라지 않게 한다.
  const PRUNE_THRESHOLD = 10_000;

  function pruneExpired(now: number, windowMs: number) {
    if (buckets.size < PRUNE_THRESHOLD) {
      return;
    }
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs) {
        buckets.delete(key);
      }
    }
  }

  function checkAndIncrement(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    pruneExpired(now, windowMs);
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (bucket.count >= max) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const windowMs = envInt("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
    const globalMax = envInt("RATE_LIMIT_GLOBAL_MAX", DEFAULT_GLOBAL_MAX);
    const authMax = envInt("RATE_LIMIT_AUTH_MAX", DEFAULT_AUTH_MAX);
    const redirectMax = envInt("RATE_LIMIT_REDIRECT_MAX", DEFAULT_REDIRECT_MAX);
    const analyticsMax = envInt("RATE_LIMIT_ANALYTICS_MAX", DEFAULT_ANALYTICS_MAX);
    const analyticsUserMax = envInt("RATE_LIMIT_ANALYTICS_USER_MAX", DEFAULT_ANALYTICS_USER_MAX);
    const productLinkClickMax = envInt("RATE_LIMIT_PRODUCT_LINK_CLICK_MAX", DEFAULT_PRODUCT_LINK_CLICK_MAX);
    const productLinkClickUserMax = envInt(
      "RATE_LIMIT_PRODUCT_LINK_CLICK_USER_MAX",
      DEFAULT_PRODUCT_LINK_CLICK_USER_MAX
    );
    const ip = clientIp(req);
    const path = req.path ?? req.url ?? "";

    const withinGlobal = checkAndIncrement(`global:${ip}`, globalMax, windowMs);
    const withinAuth = !AUTH_PATH_PATTERN.test(path) || checkAndIncrement(`auth:${ip}`, authMax, windowMs);
    const withinRedirect =
      !REDIRECT_PATH_PATTERN.test(path) || checkAndIncrement(`redirect:${ip}`, redirectMax, windowMs);
    // Method-scoped (unlike the other buckets): only the POST collection call
    // writes rows, so a future read-only analytics endpoint would not be
    // throttled by the write budget.
    const isAnalyticsWrite = req.method === "POST" && ANALYTICS_PATH_PATTERN.test(path);
    const withinAnalytics = !isAnalyticsWrite || checkAndIncrement(`analytics:${ip}`, analyticsMax, windowMs);
    // SEC-132: the account-scoped companion bucket. Charged independently of
    // the IP bucket above (both are always incremented for an analytics write)
    // so the two ceilings stay genuinely independent — an IP that is already
    // over its limit does not thereby spare, or consume, anyone's account
    // budget. The key prefix differs from the IP bucket's, and subjects are
    // UUIDs, so the two key spaces cannot collide.
    const withinAnalyticsUser = ((): boolean => {
      if (!isAnalyticsWrite) {
        return true;
      }
      const subject = accessTokenSubject(req);
      return subject === null || checkAndIncrement(`analytics-user:${subject}`, analyticsUserMax, windowMs);
    })();
    // SEC-133: 인증 클릭 쓰기. 분석 쓰기와 **같은 모양**이다 — 새 관례를 만들지 않는다.
    //  · 메서드까지 좁힌다: 행을 만드는 것은 POST뿐이다.
    //  · IP 버킷과 계정 버킷을 AND로 묶고, 둘 다 항상 청구한다(두 상한이 서로의 예산을
    //    아끼거나 대신 쓰지 않는다 — 위 SEC-132 문단의 그 이유 그대로).
    //  · 계정 버킷을 **함께** 세우는 이유: IP는 호출자가 고르는 값이라, IP만 두면 토큰 하나를
    //    IP 여럿에 돌리는 순간 상한이 사라진다(SEC-132가 "Round 30 P3의 잔여"로 적어 둔 그
    //    구멍이고, 이 경로는 그때의 분석 경로보다 결과가 더 직접적이다 — 어드민 KPI가 바로
    //    이 표다). 검증할 수 없는 토큰은 어느 계정에도 청구되지 않고, 그런 요청은 어차피
    //    가드에서 401로 끝난다.
    const isProductLinkClick = req.method === "POST" && PRODUCT_LINK_CLICK_PATH_PATTERN.test(path);
    const withinProductLinkClick =
      !isProductLinkClick || checkAndIncrement(`product-link-click:${ip}`, productLinkClickMax, windowMs);
    const withinProductLinkClickUser = ((): boolean => {
      if (!isProductLinkClick) {
        return true;
      }
      const subject = accessTokenSubject(req);
      return (
        subject === null ||
        checkAndIncrement(`product-link-click-user:${subject}`, productLinkClickUserMax, windowMs)
      );
    })();

    if (
      !withinGlobal ||
      !withinAuth ||
      !withinRedirect ||
      !withinAnalytics ||
      !withinAnalyticsUser ||
      !withinProductLinkClick ||
      !withinProductLinkClickUser
    ) {
      res.setHeader("Retry-After", Math.ceil(windowMs / 1000).toString());
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
          requestId: requestIdOf(req)
        }
      });
      return;
    }

    next();
  };
}
