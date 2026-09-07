import { Body, Controller, HttpCode, Inject, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { isUuid } from "../common/validation/uuid";
import { ItemsCatalogService } from "../onboarding/items-catalog.service";
import { PRODUCT_LINK_NOT_FOUND_ERROR } from "./affiliate-link-guard.util";
import { ProductLinkClickDto } from "./dto/items.dto";

@Controller("product-links")
@UseGuards(JwtAuthGuard)
export class CommerceController {
  constructor(@Inject(ItemsCatalogService) private readonly store: ItemsCatalogService) {}

  /**
   * 라운드 106 T9 — `:productLinkId`가 **UUID 형식일 때만** 아래 조회로 내려간다.
   *
   * 종전(이 검사가 없던 시점): 경로 파라미터가 그대로
   * `productLink.findFirst({ where: { id: productLinkId, active: true } })`
   * (`items-catalog.service.ts` `clickProductLink`)의 `@db.Uuid` 술어에 실렸고, UUID가 아닌
   * 값은 Prisma가 드라이버 단에서 거절해(`Inconsistent column data: Error creating UUID` —
   * 판정 근거는 `common/validation/uuid.ts` 머리말) `GlobalExceptionFilter`가 **500
   * "잠시 후 다시 시도해주세요."** 로 내보냈다. 이 경로는 핵심 루프의 마지막 마디(구매 링크
   * 클릭)이고 모바일은 5xx를 일시 실패로 보고 재전송하는데, 그 재전송은 **절대** 성공하지
   * 않는다 — DNC-018이 금지하는 틀린 안내다.
   *
   * 지금: 어떤 상품 링크도 가리킬 수 없는 id이므로 미존재·비활성·허용목록 밖 도메인과
   * **같은 404**로 끝낸다. 봉투는 이 모듈이 이미 단일 소스로 들고 있는
   * `PRODUCT_LINK_NOT_FOUND_ERROR`를 그대로 쓰므로(공개 리다이렉트
   * `redirect.controller.ts`가 던지는 것과 같은 값) 문구 사본이 늘지 않고, 갈래마다 응답이
   * 갈리지 않는다는 그 상수의 "존재 오라클 없음" 규율도 그대로 유지된다.
   *
   * 컨트롤러에 두는 이유: DB를 한 줄도 읽지 않는 **모양 검사**라 스토어의 판정(가구 권한 →
   * 링크 존재 → 허용목록)과 겹치지 않고, 전역 ValidationPipe가 본문의 `childId`를 먼저
   * 거르는 순서와 같은 자리다. UUID가 아닌 값은 `productLinks.id`에 존재할 수 없으므로 이
   * 검사가 스토어보다 앞선다고 해서 스토어 계약과 어긋날 수 있는 값은 없다.
   */
  @Post(":productLinkId/click")
  @HttpCode(200)
  async click(
    @Req() request: AuthenticatedRequest,
    @Param("productLinkId") productLinkId: string,
    @Body(createDtoValidationPipe(ProductLinkClickDto)) body: ProductLinkClickDto
  ) {
    if (!isUuid(productLinkId)) {
      throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);
    }
    const userAgentHeader = request.headers?.["user-agent"];
    return await this.store.clickProductLink(request.user!, productLinkId, body, {
      ip: request.ip,
      userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader
    });
  }
}
