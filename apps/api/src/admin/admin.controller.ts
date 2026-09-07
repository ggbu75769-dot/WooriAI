import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { isUuid } from "../common/validation/uuid";
import { ItemsCatalogService } from "../onboarding/items-catalog.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminCatalogWriteService } from "./admin-catalog-write.service";
import {
  AffiliateClickBreakdownService,
  CLICK_BREAKDOWN_WINDOWS,
  isClickBreakdownWindow,
  type ClickBreakdownWindow
} from "./affiliate-click-breakdown.service";
import {
  AdminCreateItemTemplateDto,
  AdminCreateProductLinkDto,
  AdminUpdateItemTemplateDto,
  AdminUpdateProductLinkDto,
  UpdateDisclosureDto
} from "./dto/admin.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

function actorId(request: AuthenticatedRequest) {
  return request.adminUser?.id ?? "dev-admin";
}

/**
 * 라운드 109 — **경로 파라미터는 전역 파이프를 지나지 않는다.** 그래서 이 파일이 직접 본다.
 *
 * 종전(이 파일에 아래 세 가드가 없던 시점): `@Param(...)`으로 받은 문자열이 아무 검증 없이
 * 그대로 DB에 실렸다. 그때도 지금도 사실인 이유는 전역 `ValidationPipe`가 **DTO 클래스인 인자만** 검증하기
 * 때문이다(bootstrap.ts `createDtoValidationPipe`) — 경로 파라미터의 메타타입은 `String`이라
 * 파이프가 통과시킨다. 그래서 body로 같은 값을 받는 CMS 초안 경로에는 상한이 서 있는데
 * (`dto/content-revision.dto.ts`의 `AdminContentRevisionDisclosurePayloadDto.key`가
 * `@MaxLength(80)`), 직통 PUT/PATCH만 열려 있었다.
 *
 * 실측(라운드 109 재현): `PUT /admin/disclosures/:key` 81자 → 500, 80자 → 200 ·
 * `PATCH /admin/item-templates/:itemTemplateId` 비-UUID → 500 ·
 * `PATCH /admin/product-links/:productLinkId` 비-UUID → 500. 셋 다
 * `INTERNAL_SERVER_ERROR "잠시 후 다시 시도해주세요."`인데, 다시 눌러도 **절대** 같은 결과다 —
 * DNC-018이 금지하는 틀린 안내이고, 운영자에게 무엇을 고쳐야 하는지 한 글자도 말하지 않는다.
 *
 * 이제 세 자리가 저장소의 기존 두 관례로 갈린다.
 *  · UUID 컬럼을 가리키는 id 두 개 → **라운드 106 T9 관례**(모양이 틀린 id는 그 자원을
 *    가리킬 수 없으므로 미존재와 같은 404). 선례: `items-commerce/commerce.controller.ts`의
 *    `:productLinkId`, `admin/admin-categories.service.ts#findById`의 `UUID_PATTERN.test`.
 *  · varchar 폭을 가리키는 `:key` → **라운드 108 관례**(폭 초과는 `VALIDATION_ERROR` +
 *    `details.fields`, 자르지 않고 400). 선례: `dto/admin.dto.ts`의 `@MaxLength(80|200)`.
 */

/**
 * `disclosures.key varchar(80)`. 리터럴인 이유는 `dto/admin.dto.ts` 머리말과 같다 —
 * 어드민 전용 칸의 폭을 담은 공유 상수가 저장소에 없다(계약 패키지는 앱 계약이 있는 칸만 안다).
 * 이 숫자는 CMS 초안 쪽 `AdminContentRevisionDisclosurePayloadDto.key`의 `@MaxLength(80)`과
 * **같은 값이어야 한다**: 두 경로가 같은 한 칸에 upsert하므로 갈리면 한쪽만 500으로 남는다.
 * 세는 단위도 그쪽과 같은 `String.length`다(class-validator의 `MaxLength`가 쓰는 값).
 */
const DISCLOSURE_KEY_MAX_LENGTH = 80;

/**
 * 폭을 넘는 `:key`의 거절 본문. 저장소의 기존 400 형식 그대로다 — `VALIDATION_ERROR` +
 * `details.fields[].constraints`(bootstrap.ts의 DTO 거절, idempotency.interceptor.ts의
 * 헤더 거절과 같은 봉투). `field`는 본문 필드가 아니라 **고쳐야 하는 자리 이름**을 적는다:
 * 여기서는 경로 조각 `key`이고, 그 이름은 CMS 초안 payload의 같은 칸 이름과도 같다.
 *
 * ⚠️ **자르지 않는다.** 81자 키를 80자로 슬라이스하면 운영자가 의도한 키가 아닌 **다른 키**가
 * 만들어진다 — 앱이 읽는 키(`affiliate_purchase` · `sponsored_product`)에는 문구가 실리지
 * 않고, 운이 나쁘면 다른 고지를 덮는다. 잘린 채 "저장했어요"라고 답하는 것이 500보다 나쁘다
 * (DNC-010 · 라운드 108이 `disclosureText`에 같은 판단을 적어 두었다).
 */
function disclosureKeyTooLongError() {
  return new BadRequestException({
    code: "VALIDATION_ERROR",
    message: "요청 값을 다시 확인해주세요.",
    details: {
      fields: [
        {
          field: "key",
          constraints: {
            maxLength: `고지 키는 ${DISCLOSURE_KEY_MAX_LENGTH}자 이하예요. 넘는 키는 자르지 않고 거절해요 — 잘라 저장하면 앱이 읽는 키와 다른 키가 돼요.`
          }
        }
      ]
    }
  });
}

@Controller("admin")
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(
    @Inject(ItemsCatalogService) private readonly store: ItemsCatalogService,
    // 라운드 107 D2·D7 — 카탈로그 **쓰기**는 저장소를 직접 부르지 않고 이 서비스를 지난다.
    // 그 서비스가 DB CHECK(스폰서 라벨 · 가격 대소)를 먼저 지고, 저장소가 쓰지 않는
    // `sponsor_label`을 쓴다. 읽기는 종전 그대로 `store`다.
    @Inject(AdminCatalogWriteService) private readonly catalogWrite: AdminCatalogWriteService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AffiliateClickBreakdownService)
    private readonly clickBreakdown: AffiliateClickBreakdownService
  ) {}

  @Get("item-templates")
  async listItemTemplates() {
    return await this.store.adminListItemTemplates();
  }

  // COM-103: direct-write item-template/product-link/disclosure endpoints are
  // admin-only now -- editor changes must go through
  // POST/PATCH /admin/content-revisions (draft -> submit -> admin
  // approve-publish). See ContentRevisionsController.
  // R19-F: 생성류는 재시도가 곧 중복 리소스(같은 이름의 템플릿, displayOrder가
  // 뒤엉킨 링크)라서 `Idempotency-Key`를 받으면 첫 응답을 재생한다. 헤더가
  // 없으면 no-op이라 기존 호출부/스크립트는 그대로다. PATCH(수정)는 같은 body를
  // 두 번 써도 결과가 같은 멱등 연산이라 부착 대상이 아니다.
  @Post("item-templates")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  @UseInterceptors(IdempotencyInterceptor)
  async createItemTemplate(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminCreateItemTemplateDto)) body: AdminCreateItemTemplateDto
  ) {
    const result = await this.catalogWrite.createItemTemplate(body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.item_template.create",
      targetType: "item_templates",
      targetId: result.id,
      after: { name: result.name }
    });
    return result;
  }

  @Patch("item-templates/:itemTemplateId")
  @RequireAdminRoles("admin")
  async updateItemTemplate(
    @Req() request: AuthenticatedRequest,
    @Param("itemTemplateId") itemTemplateId: string,
    @Body(createDtoValidationPipe(AdminUpdateItemTemplateDto)) body: AdminUpdateItemTemplateDto
  ) {
    // 라운드 109 — 종전에는 이 값이 그대로 `admin-catalog-write.service.ts`의
    // `itemTemplate.findUnique({ where: { id } })`(@db.Uuid 술어)에 실렸고, UUID가 아니면
    // Prisma가 드라이버 단에서 던져(`Inconsistent column data: Error creating UUID`) 500이
    // 됐다. 이제 어떤 준비템도 가리킬 수 없는 id이므로 **미존재와 같은 404**로 끝낸다.
    // 봉투 두 줄은 `items-catalog.service.ts#requireItemTemplateAnyStatus`가 내는 것과
    // 글자 그대로 같다(그 파일은 이 작업에서 무접촉이라 상수로 뽑을 수 없다 — 대신 아래
    // 테스트가 두 응답 본문이 서로 구분되지 않는지를 고정한다).
    if (!isUuid(itemTemplateId)) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "Item template was not found." });
    }
    const result = await this.catalogWrite.updateItemTemplate(itemTemplateId, body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.item_template.update",
      targetType: "item_templates",
      targetId: itemTemplateId,
      after: { name: result.name }
    });
    return result;
  }

  /**
   * 라운드 107 D2 — 표에 **스폰서 표시 문구**를 함께 싣는다.
   *
   * 저장소의 `toAdminProductLinkDto`는 `sponsorLabel`을 싣지 않는다(그 파일은 무접촉이다).
   * 그런데 이 라운드가 그 칸을 편집 대상으로 열었으므로, 되읽을 수 없으면 운영자는 수정 폼을
   * 열 때마다 이미 저장된 문구를 다시 타이핑해야 한다(빈 칸으로 보내면 그대로 지워진다).
   * 바로 위 `listDisclosures`가 같은 이유로 같은 모양의 덧댐을 한다.
   */
  @Get("product-links")
  async listProductLinks() {
    const result = await this.store.adminListProductLinks();
    const rows = await this.prisma.productLink.findMany({ select: { id: true, sponsorLabel: true } });
    const labelById = new Map(rows.map((row) => [row.id, row.sponsorLabel]));
    return { links: result.links.map((link) => ({ ...link, sponsorLabel: labelById.get(link.id) ?? null })) };
  }

  @Post("product-links")
  @HttpCode(200)
  @RequireAdminRoles("admin")
  @UseInterceptors(IdempotencyInterceptor)
  async createProductLink(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminCreateProductLinkDto)) body: AdminCreateProductLinkDto
  ) {
    const result = await this.catalogWrite.createProductLink(body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.product_link.create",
      targetType: "product_links",
      targetId: result.id,
      after: { title: result.title }
    });
    return result;
  }

  @Patch("product-links/:productLinkId")
  @RequireAdminRoles("admin")
  async updateProductLink(
    @Req() request: AuthenticatedRequest,
    @Param("productLinkId") productLinkId: string,
    @Body(createDtoValidationPipe(AdminUpdateProductLinkDto)) body: AdminUpdateProductLinkDto
  ) {
    // 라운드 109 — 바로 위 `:itemTemplateId`와 같은 자리·같은 근거다(종전: 비-UUID가
    // `productLink.findUnique` 술어에 실려 500). 미존재 링크와 같은 404로 끝내고, 봉투는
    // `items-catalog.service.ts#requireProductLinkAnyStatus`가 내는 것과 같다.
    if (!isUuid(productLinkId)) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "Product link was not found." });
    }
    const result = await this.catalogWrite.updateProductLink(productLinkId, body);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.product_link.update",
      targetType: "product_links",
      targetId: productLinkId,
      after: { title: result.title }
    });
    return result;
  }

  // COM-103: enriches the store's {key, text} rows with each disclosure's
  // internal id (not exposed by ItemsCatalogService#adminListDisclosures,
  // which is off-limits to edit in this task) so the admin web CMS can address
  // an existing disclosure by entityId when drafting a content revision for it
  // -- see content-revisions.service.ts and apps/admin's disclosures page.
  @Get("disclosures")
  async listDisclosures() {
    const result = await this.store.adminListDisclosures();
    const rows = await this.prisma.disclosure.findMany({ select: { id: true, key: true } });
    const idByKey = new Map(rows.map((row) => [row.key, row.id]));
    return { disclosures: result.disclosures.map((entry) => ({ id: idByKey.get(entry.key) ?? null, ...entry })) };
  }

  /**
   * GAP-065 #9: 봉투가 `after`뿐이라 **무엇에서 무엇으로** 바꿨는지 서버가 몰랐다.
   *
   * 이 테이블에 담긴 것은 DNC-010이 잠근 그 문장이다 — 링크의 `disclosure_text`가
   * 비면 앱·어드민·클릭 응답이 전부 이 값을 쓴다(items-catalog.service.ts의
   * `defaultDisclosureFor`). 그리고 `disclosures` 행은 key당 한 칸 upsert라
   * 덮어쓰면 이전 문구가 **사실 자체로 사라진다**(리비전을 타지 않는 직접 쓰기 경로다 —
   * editor는 draft→review를 타지만 admin은 여기로 바로 덮어쓴다, COM-103).
   * 그래서 고지가 약해진 뒤 남는 근거가 "언제 누가 무엇으로"뿐이었고, 되돌릴 값이
   * 서버 어디에도 없었다. before는 upsert **직전** 조회 1회 —
   * `budget.upsert`(GAP-063 #5)·지출 수정 경로와 같은 정밀도이고, 같은 트랜잭션이
   * 아니라는 성질도 그와 같다. before가 null이면 **그 key가 없던 새 문구**라는 뜻이다
   * (`affiliate_purchse` 같은 오타 키로 저장했을 때 로그에 드러나는 표식이기도 하다).
   *
   * ⚠️ 두 시점(라운드 109) — 종전 이 자리에는 "이 경로는 키를 **검증하지 않고** upsert한다"고
   * 적혀 있었고 그때는 참이었다. 이제 폭(80자)만은 저장 전에 본다(아래 가드). 그러나 **어떤
   * 키인지는 여전히 묻지 않는다 — 그것이 이 기능의 의도다**: 서버 배포 없이 새 고지 키를
   * 세우는 것이 upsert의 목적이고(`dto/content-revision.dto.ts`의 초안 payload 머리말이
   * "아직 라이브에 없는 새 키를 초안할 수 있어야 한다"를 그 payload의 존재 이유로 적는다),
   * GAP-065 #9가 "모르는 키를 막으면 나중에 쓸 키를 미리 막는다"며 **막지 않기로 이미
   * 판단했다**(`apps/admin/src/lib/disclosure-keys.ts` — 대신 어드민 목록이 "앱이 읽는 키/
   * 아직 읽지 않는 키" 배지로 사실만 적는다). 오타 키의 방어선은 그 배지와 위 감사 봉투의
   * `before: null`이고, 이 라운드는 그 판단을 바꾸지 않는다.
   *
   * 봉투에 `key`를 함께 싣는 이유: `AuditLoggerService.persist`는 targetId를
   * UUID가 아니면 null로 떨군다(`asUuidOrNull`). 고지의 targetId는 key 문자열이라
   * **영속된 행에는 남지 않으므로**, 어느 문구가 바뀌었는지는 봉투만 답할 수 있다.
   *
   * PII는 없다 — 고지 문구는 운영이 쓴 공개 문구이고(앱 구매 CTA 옆에 그대로 그려진다),
   * 사용자 데이터가 아니다. 그래서 원문을 그대로 싣는다: 되돌릴 값이 봉투에 있어야
   * 이 기록이 쓸모가 있다. 저장되는 값과 맞추려고 after는 요청 body가 아니라 upsert
   * 결과(`result.text` — 서비스가 trim한 값)를 싣는다.
   *
   * 응답은 한 글자도 달라지지 않는다(종전과 같은 `{ key, text }`). 마이그레이션 0건.
   */
  @Put("disclosures/:key")
  @RequireAdminRoles("admin")
  async updateDisclosure(
    @Req() request: AuthenticatedRequest,
    @Param("key") key: string,
    @Body(createDtoValidationPipe(UpdateDisclosureDto)) body: UpdateDisclosureDto
  ) {
    // 라운드 109 — 종전에는 이 `key`가 검증 없이 `disclosures.key varchar(80)`에 upsert(=create)
    // 됐다. 81자는 Prisma P2000이 되고, 저장소 전체에 P2000을 400으로 옮기는 핸들러가 0건이라
    // 그대로 500이었다(라운드 108이 같은 사실을 body 쪽 네 칸에 적어 두었다). 이제 DB를 한 줄도
    // 읽기 전에 폭을 본다 — 조회·upsert 어느 쪽도 실행되지 않으므로 잔여 행이 남지 않는다.
    if (key.length > DISCLOSURE_KEY_MAX_LENGTH) {
      throw disclosureKeyTooLongError();
    }
    const existing = await this.prisma.disclosure.findUnique({ where: { key }, select: { text: true } });
    const result = await this.store.adminUpdateDisclosure(key, body.text);
    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.disclosure.update",
      targetType: "disclosures",
      targetId: key,
      before: existing ? { key, text: existing.text } : null,
      after: { key, text: result.text }
    });
    return result;
  }

  // ADM-123: 기존 응답({ totalClicks, byPlatform } — 둘 다 전체 기간)은 그대로
  // 두고 기간 분해 필드(days/windowTotalClicks/topLinks/dailyTotals)를 덧붙이는
  // 하위호환 확장이다. `days`를 안 보내던 기존 호출부는 필드가 늘어난 것 외에
  // 동작이 같다(기본 7일). 읽기 전용이라 다른 admin GET처럼
  // `@RequireAdminRoles(...)` 없이 admin/editor/analyst 전 역할이 열람한다.
  //
  // DNC-009: 클릭 통계 열람은 추천 점수와 무관하다 — 이 응답은 어드민 콘솔
  // 표시용이고, 여기 담긴 클릭 수는 추천 랭킹/점수 계산으로 되먹임되지 않는다
  // (수수료율은 집계에도 응답에도 포함하지 않는다).
  @Get("affiliate-clicks/summary")
  async affiliateClickSummary(@Query("days") daysRaw?: string) {
    const days: number = daysRaw === undefined ? 7 : Number(daysRaw);
    if (!isClickBreakdownWindow(days)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `days는 ${CLICK_BREAKDOWN_WINDOWS.join(" 또는 ")}만 지원해요.`
      });
    }
    const [summary, breakdown] = await Promise.all([
      this.store.adminAffiliateClickSummary(),
      this.clickBreakdown.getBreakdown(days satisfies ClickBreakdownWindow)
    ]);
    return { ...summary, ...breakdown };
  }
}
