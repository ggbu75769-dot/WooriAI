import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { AdminTokenGuard } from "./admin-token.guard";
import {
  AdminCreateItemTemplateDto,
  AdminCreateProductLinkDto,
  AdminUpdateItemTemplateDto,
  AdminUpdateProductLinkDto,
  UpdateDisclosureDto
} from "./dto/admin.dto";

@Controller("admin")
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get("item-templates")
  listItemTemplates() {
    return this.store.adminListItemTemplates();
  }

  @Post("item-templates")
  @HttpCode(200)
  createItemTemplate(@Body(createDtoValidationPipe(AdminCreateItemTemplateDto)) body: AdminCreateItemTemplateDto) {
    return this.store.adminCreateItemTemplate(body);
  }

  @Patch("item-templates/:itemTemplateId")
  updateItemTemplate(
    @Param("itemTemplateId") itemTemplateId: string,
    @Body(createDtoValidationPipe(AdminUpdateItemTemplateDto)) body: AdminUpdateItemTemplateDto
  ) {
    return this.store.adminUpdateItemTemplate(itemTemplateId, body);
  }

  @Get("product-links")
  listProductLinks() {
    return this.store.adminListProductLinks();
  }

  @Post("product-links")
  @HttpCode(200)
  createProductLink(@Body(createDtoValidationPipe(AdminCreateProductLinkDto)) body: AdminCreateProductLinkDto) {
    return this.store.adminCreateProductLink(body);
  }

  @Patch("product-links/:productLinkId")
  updateProductLink(
    @Param("productLinkId") productLinkId: string,
    @Body(createDtoValidationPipe(AdminUpdateProductLinkDto)) body: AdminUpdateProductLinkDto
  ) {
    return this.store.adminUpdateProductLink(productLinkId, body);
  }

  @Get("disclosures")
  listDisclosures() {
    return this.store.adminListDisclosures();
  }

  @Put("disclosures/:key")
  updateDisclosure(
    @Param("key") key: string,
    @Body(createDtoValidationPipe(UpdateDisclosureDto)) body: UpdateDisclosureDto
  ) {
    return this.store.adminUpdateDisclosure(key, body.text);
  }

  @Get("affiliate-clicks/summary")
  affiliateClickSummary() {
    return this.store.adminAffiliateClickSummary();
  }
}
