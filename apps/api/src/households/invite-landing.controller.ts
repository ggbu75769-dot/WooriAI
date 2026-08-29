import { Controller, Get, Header, HttpException, Inject, Param } from "@nestjs/common";
import { HouseholdRuntimeService } from "./household-runtime.service";

/**
 * L8: public HTML landing page for family invite links.
 *
 * Production invite links point to `${INVITE_LINK_BASE_URL}/invite/${token}`
 * (see HouseholdRuntimeService.createInvite), but until now no route existed
 * there -- family members tapping the link got a 404. This controller serves a
 * minimal, self-contained Korean HTML page at GET /invite/:token.
 *
 * - PUBLIC and unauthenticated on purpose (like the affiliate redirect
 *   controller): the person tapping the link usually has no session yet.
 * - OUTSIDE the api/v1 global prefix: bootstrap.ts excludes "invite/:token"
 *   from setGlobalPrefix so the path matches the link exactly. The JSON API
 *   route GET /api/v1/invites/:token (plural) is unrelated and unaffected.
 * - No existence oracle: a valid+pending token renders the household name and
 *   an app deep link; anything else (unknown, expired, already used) renders
 *   the SAME generic 200 page -- the response never distinguishes "never
 *   existed" from "expired/used" beyond that single generic state.
 * - Token lookup reuses the households service (hashed comparison via
 *   HouseholdRuntimeService.getInvite -> requirePendingInvite).
 * - Untrusted strings (household name, token) are always HTML-escaped and the
 *   token additionally URI-encoded before entering the deep-link href.
 * - Rate limiting: the global per-IP limiter (rateLimitMiddleware) is mounted
 *   at the raw Express level before routing in configureApiApp, so it covers
 *   this path like every other request. NOTE: "per-IP" is only meaningful
 *   behind a reverse proxy (Caddy/Fly) when TRUST_PROXY=1 is set — see
 *   configureApiApp — otherwise every request shares the proxy's IP.
 */
@Controller("invite")
export class InviteLandingController {
  constructor(@Inject(HouseholdRuntimeService) private readonly households: HouseholdRuntimeService) {}

  @Get(":token")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  @Header("X-Frame-Options", "DENY")
  async landing(@Param("token") token: string): Promise<string> {
    try {
      const invite = await this.households.getInvite(token);
      return renderPendingInvitePage(invite.householdName, token);
    } catch (error) {
      // NOT_FOUND / NOT_PENDING (expired, used) all collapse into one generic
      // 200 page -- no token-validity oracle. Non-HTTP errors (e.g. DB down)
      // still propagate as real 500s.
      if (error instanceof HttpException) {
        return renderUnavailableInvitePage();
      }
      throw error;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 색은 DNC-017 v0.5의 승인 팔레트다(Primary `#C94627` · Background `#FFFDFC` ·
 * onPrimary `#FFFFFF`). 값의 단일 소스는 `docs/brand/brand-tokens.json`이고, 표면 쪽 일치와
 * `.cta` 대비는 `packages/test-utils/src/public-surface-brand.test.ts`가 진다.
 *
 * 라운드 73 트랙 C 이전에는 이 페이지가 **어느 시점의 토큰도 아닌 자체 팔레트**를 썼고(그 값의
 * 이름과 내력은 단일 소스의 `retired` 목록이 진다 — 여기서 다시 적으면 폐기값이 이 파일에
 * 되살아난다), `.cta`의 흰 텍스트는 그 배경에서 **2.57:1 — AA 미달**이었다. 승인 Primary
 * 위에서는 같은 흰 텍스트가 **4.78:1**로 AA를 넘는다. 바뀐 것은 이 `<style>` 블록의 색
 * 리터럴뿐이다 — 200 응답·오라클 없음·헤더 셋(`@Header` 셋)·문구는 그대로다.
 */
function pageShell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>우리아이 가족 초대</title>
<style>
  body { margin: 0; background: #FFFDFC; color: #4A3F35; font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  main { max-width: 420px; margin: 0 auto; padding: 48px 24px; text-align: center; }
  .card { background: #FFFFFF; border: 1px solid rgba(74, 63, 53, 0.08); border-radius: 20px; padding: 32px 24px; box-shadow: 0 6px 18px rgba(74, 63, 53, 0.08); }
  .brand { color: #C94627; font-size: 22px; font-weight: 800; margin-bottom: 24px; }
  h1 { font-size: 20px; line-height: 1.5; margin: 0 0 8px; }
  p { color: #857567; font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
  .household { color: #4A3F35; font-size: 18px; font-weight: 800; margin: 0 0 16px; }
  .cta { display: inline-block; background: #C94627; color: #FFFFFF; border-radius: 14px; padding: 14px 28px; font-size: 16px; font-weight: 800; text-decoration: none; margin: 16px 0 20px; }
  .hint { font-size: 12px; color: #A8988A; }
</style>
</head>
<body>
<main>
  <div class="brand">우리아이</div>
  <div class="card">
${bodyHtml}
  </div>
</main>
</body>
</html>
`;
}

function renderPendingInvitePage(householdName: string, token: string): string {
  // The deep-link path mirrors the mobile expo-router route
  // apps/mobile/app/family/accept/[token].tsx -> wooriai://family/accept/<token>.
  const deepLink = `wooriai://family/accept/${encodeURIComponent(token)}`;
  return pageShell(`    <h1>가족 초대장이 도착했어요</h1>
    <p class="household">${escapeHtml(householdName)}</p>
    <p>우리아이 앱에서 초대를 수락하세요.</p>
    <a class="cta" href="${escapeHtml(deepLink)}">앱에서 초대 수락하기</a>
    <p class="hint">버튼이 동작하지 않는다면 우리아이 앱이 설치되어 있는지 확인해주세요. 앱 설치 후 이 링크를 다시 열면 초대를 수락할 수 있어요.</p>`);
}

function renderUnavailableInvitePage(): string {
  return pageShell(`    <h1>초대가 만료되었거나 유효하지 않아요</h1>
    <p>이미 사용되었거나 기간이 지난 초대 링크일 수 있어요.</p>
    <p class="hint">가족에게 새 초대 링크를 요청해주세요.</p>`);
}
