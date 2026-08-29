import { randomUUID } from "node:crypto";
import { Controller, Get, Inject, Ip, Logger, NotFoundException, Param, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { isHttpOrHttpsUrl } from "../common/validation/url-scheme";
import { hashClickIp, isAllowedAffiliateUrl, PRODUCT_LINK_NOT_FOUND_ERROR } from "./affiliate-link-guard.util";

/**
 * COM-106 (round5a-sprint2-plan.md §4): the opaque, public, unauthenticated affiliate
 * redirect. No JwtAuthGuard here on purpose -- this is meant to be shared/clicked by
 * anyone, including someone with no WooriAI account. Query params received on this
 * route are never read or reflected into the Location header (open-redirect
 * prevention): the only thing that decides the destination is the stored product
 * link's own url/affiliateUrl, looked up by the opaque redirectCode.
 *
 * ── 라운드 69 #4: 실패 응답의 `Accept` 협상 (왜 `/api/v1` 아래에서 HTML을 내는가) ──
 *
 * 이 라우트의 URL은 **밖으로 나간다**: 앱의 [링크 공유하기]가 내보내는 문자열이
 * `${INVITE_LINK_BASE_URL}/api/v1/r/<코드>`이고(`items-catalog.service.ts`의
 * `publicRedirectShareUrl`), 그것을 카카오톡으로 받은 사람은 **우리아이를 써 본 적이 없다.**
 * 그 사람이 링크가 내려간 뒤에 열면 종전에는 `{"error":{"code":…,"requestId":"…"}}` 한 줄이
 * 흰 화면에 떴다 — 앱 안에서는 `api-error.ts`가 원천 차단하는 값(서버 원문·오류 코드·
 * requestId)이 **앱 밖 공개 표면에서는 그대로 노출되는** 자리였다.
 *
 * 그래서 실패 응답만 사람이 읽는 한국어 페이지로 바꾸되, **JSON 계약을 깨지 않는 방식**을
 * 골랐다. `/api/v1` 아래의 모든 실패는 `GlobalExceptionFilter`의 JSON 봉투라는 것이 계약이므로
 * 선택지는 둘이었다 — (가) `Accept` 협상, (나) 짧은 `/r/:code` 프리픽스 예외를 새로 여는 것.
 * **(가)를 택했다**:
 *  - 새 공개 라우트를 열지 않는다(짧은 `/r/`는 라우트 판단이 아직 안 끝난 별도 항목이다).
 *  - JSON 계약이 기본값으로 남는다 — `Accept`에 `text/html`이 **명시된** 요청만 HTML을 받는다.
 *    `req.accepts("html")`을 쓰지 않은 이유가 이것이다: 그 헬퍼는 **와일드카드 Accept**(curl의
 *    기본값)와 **Accept 헤더 없음**에 대해서도 "예"라고 답해서, curl·스모크 스크립트·supertest·
 *    서버 간 호출까지 전부 HTML로 뒤집는다. 브라우저 내비게이션은 언제나 `text/html`을
 *    명시하므로 판별자로 충분하다.
 *  - 이 라우트의 성공 경로는 애초에 **브라우저만 따라갈 수 있는 302**라, `Accept`가 여기서는
 *    다른 라우트에서보다 신뢰할 만한 판별자다.
 *
 * 바뀌지 않는 것(의도적):
 *  - **상태 코드는 404 그대로다.** 본문만 바뀐다. 초대 랜딩이 200인 이유는 존재 오라클 회피인데
 *    여기에는 감출 비밀이 없고, `scripts/qa/server-smoke.sh`의 "무효 코드 404"가 그 숫자를 본다.
 *  - 성공 302·목적지 계산·허용목록 판정·클릭 행 생성 순서는 한 글자도 바뀌지 않았고, 실패에는
 *    여전히 클릭 행을 남기지 않는다(`affiliateClick.create`는 302 직전에만 돈다).
 *  - `GlobalExceptionFilter` 무변경 — HTML은 이 라우트 안에서 끝난다.
 *  - **존재 오라클 없음**: 미존재·비활성·허용목록 밖 도메인이 전부 **바이트 단위로 같은 페이지**를
 *    받는다(JSON 갈래가 이미 그런 것과 같은 규율 — `PRODUCT_LINK_NOT_FOUND_ERROR` 주석 참고).
 */
@Controller("r")
export class AffiliateRedirectController {
  private readonly logger = new Logger(AffiliateRedirectController.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get(":code")
  async redirect(
    @Param("code") code: string,
    @Ip() ip: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const productLink = await this.prisma.productLink.findFirst({ where: { redirectCode: code, active: true } });
    if (!productLink) {
      return this.respondLinkUnavailable(request, response);
    }

    const targetUrl = productLink.affiliateUrl ?? productLink.url;
    // Same allowlist as POST /product-links/:id/click (affiliate-link-guard.util.ts).
    // A disallowed/unsafe target does NOT deactivate the link -- just a warning log and
    // the same 404 as an unknown code, so a bad domain can be fixed by an admin without
    // losing the link's click history.
    if (!isHttpOrHttpsUrl(targetUrl) || !isAllowedAffiliateUrl(targetUrl)) {
      this.logger.warn(
        `Affiliate redirect blocked for product link ${productLink.id}: target domain is not on AFFILIATE_ALLOWED_DOMAINS`
      );
      return this.respondLinkUnavailable(request, response);
    }

    // Anonymous click: no authenticated user/household/child (migration 000008 made
    // these nullable specifically for this route). subId is a self-generated uuid
    // reused as the row's own id -- never derived from any user/child identifier.
    const clickId = randomUUID();
    const userAgentHeader = request.headers?.["user-agent"];
    await this.prisma.affiliateClick.create({
      data: {
        id: clickId,
        userId: null,
        householdId: null,
        childId: null,
        itemTemplateId: productLink.itemTemplateId,
        productLinkId: productLink.id,
        platform: productLink.platform,
        referrerScreenId: "redirect",
        subId: clickId,
        ipHash: hashClickIp(ip),
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader
      }
    });

    response.redirect(302, targetUrl);
  }

  /**
   * 링크를 열 수 없는 **모든** 이유(미존재·비활성·허용목록 밖 도메인)의 단 하나의 출구.
   * 갈래마다 다른 것은 **호출 전의 로그**뿐이고, 응답은 세 경우 모두 같다.
   *
   * 브라우저(= `Accept`에 `text/html` 명시)에는 404 + 한국어 페이지, 그 밖의 모든 클라이언트에는
   * 종전 그대로 `NotFoundException` -> `GlobalExceptionFilter`의 JSON 봉투다. 헤더는
   * `@Header()` 데코레이터가 아니라 여기서 직접 세운다 — 데코레이터는 **성공 302에도** 붙어
   * 성공 경로의 응답을 바꾸기 때문이다.
   */
  private respondLinkUnavailable(request: AuthenticatedRequest, response: Response): void {
    // 라운드 69 리뷰 P-1: 이 실패 응답의 **본문이 `Accept`에 따라 갈리므로** 캐시에게 그 사실을
    // 말한다. 없으면 중간 캐시(공유 링크라 CDN·회사 프록시를 지날 수 있다)가 한 클라이언트에게
    // 준 표현을 다른 `Accept`의 요청에 그대로 돌려줄 수 있다 — 브라우저에 JSON 봉투가, 앱에
    // HTML 페이지가 가는 모양이다. `Cache-Control: no-store`가 이미 저장을 막지만, 그 값은
    // HTML 갈래에만 이 메서드가 세우고 JSON 갈래는 미들웨어에 딸려 있어서 둘의 근거가 다르다.
    // 그래서 `Vary`는 **두 갈래 모두**에, 갈림이 일어나기 전에 세운다(JSON 갈래는 여기서
    // 던지면 GlobalExceptionFilter가 `response.status().json()`으로 이어 쓰므로 헤더가 남는다).
    response.setHeader("Vary", "Accept");
    if (!prefersHtmlPage(request)) {
      throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);
    }
    response.status(404);
    // 초대 랜딩(households/invite-landing.controller.ts)과 같은 헤더 셋. Cache-Control·
    // X-Frame-Options는 `securityHeadersMiddleware`가 이미 모든 응답에 걸지만, 초대 랜딩이
    // `@Header()`로 그랬듯 여기서도 같은 값을 명시한다 — 공개 페이지의 헤더 계약이 미들웨어
    // 등록 순서에 딸려 있지 않다는 뜻이다(같은 값이라 실제 응답은 바뀌지 않는다).
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Frame-Options", "DENY");
    // ⚠️ 라운드 69 리뷰 P-3: `@Res({ passthrough: true })`라 **Nest도 반환값으로 응답을 쓴다.**
    // 여기서 `response.send(...)`의 결과를 return하면 Nest가 그 값을 한 번 더 직렬화해 보내려
    // 하고(이미 헤더가 나간 뒤라 ERR_HTTP_HEADERS_SENT), 그 이중 전송은 이 페이지처럼 드문
    // 실패 경로에서만 터진다. 지금 무해한 이유는 이 메서드가 `void`를 선언하고 send 뒤에
    // 아무것도 반환하지 않아 호출부의 `return this.respondLinkUnavailable(...)`이 undefined로
    // 끝나기 때문이다 — Nest는 undefined를 "직접 썼다"로 읽는다. 이 마지막 줄을 `return`으로
    // 바꾸지 말 것.
    response.send(renderLinkUnavailablePage());
  }
}

/**
 * `Accept`에 `text/html`이 **명시된** 요청만 HTML 페이지를 받는다. 판별 근거는 컨트롤러 머리말
 * 참고 — 요약하면 `req.accepts("html")`은 와일드카드 Accept와 Accept 헤더 없음에도 "예"라고
 * 답해서 JSON을 기대하는 모든 비브라우저 클라이언트를 뒤집는다. 여기서는 **JSON이 기본값**이다.
 */
function prefersHtmlPage(request: AuthenticatedRequest): boolean {
  const header = request.headers?.accept;
  const accept = Array.isArray(header) ? header.join(",") : header;
  return typeof accept === "string" && accept.toLowerCase().includes("text/html");
}

/**
 * 초대 랜딩 페이지(`households/invite-landing.controller.ts`)와 **같은 형식**의 자족적 한국어
 * 페이지: 같은 셸(인라인 스타일·`noindex`·`lang="ko"`), 같은 헤더 셋, 같은 "오라클 없음".
 * 셸을 공유 모듈로 뽑지 않은 것은 의도다 — 두 페이지는 서로 다른 모듈의 공개 표면이고, 지금
 * 공유하면 한쪽 문구를 고치는 일이 다른 쪽의 계약 변경이 된다(초대 랜딩은 이 라운드에서
 * 한 글자도 건드리지 않는다).
 *
 * 이 페이지에 **보간되는 값은 0건**이다. 요청한 코드조차 되비추지 않는다 — 되비추는 순간
 * 이스케이프 문제가 생기고, 무엇보다 "이 코드는 있었다/없었다"를 말할 여지가 생긴다.
 *
 * 문구는 사실 한 줄과 앱으로 가는 길까지다(DNC-018 해요체). **여기서 다른 판매처를 추천하지
 * 않는다** — 그 순간 이 URL이 커머스 페이지가 되고 DNC-010(고지)·DNC-011(스폰서 구분)이 통째로
 * 딸려 온다. 그래서 이 페이지에는 링크(`<a>`)가 하나도 없다.
 */
function renderLinkUnavailablePage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>우리아이 구매 링크</title>
<style>
  body { margin: 0; background: #FFF8F2; color: #4A3F35; font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  main { max-width: 420px; margin: 0 auto; padding: 48px 24px; text-align: center; }
  .card { background: #FFFFFF; border: 1px solid rgba(74, 63, 53, 0.08); border-radius: 20px; padding: 32px 24px; box-shadow: 0 6px 18px rgba(74, 63, 53, 0.08); }
  .brand { color: #FF7A59; font-size: 22px; font-weight: 800; margin-bottom: 24px; }
  h1 { font-size: 20px; line-height: 1.5; margin: 0 0 8px; }
  p { color: #857567; font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
</style>
</head>
<body>
<main>
  <div class="brand">우리아이</div>
  <div class="card">
    <h1>이 구매 링크는 지금 열 수 없어요.</h1>
    <p>우리아이 앱의 준비템에서 지금 열 수 있는 구매 링크를 확인할 수 있어요.</p>
  </div>
</main>
</body>
</html>
`;
}
