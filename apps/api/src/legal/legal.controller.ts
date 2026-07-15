import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { LegalService } from "./legal.service";

@Controller("legal/documents")
export class LegalController {
  constructor(@Inject(LegalService) private readonly legal: LegalService) {}

  @Get("current")
  async current(@Query("locale") locale?: string) {
    return await this.legal.current(locale ?? "ko-KR");
  }

  @Get(":documentType/:version")
  async byVersion(
    @Param("documentType") documentType: string,
    @Param("version") version: string,
    @Query("locale") locale?: string
  ) {
    return await this.legal.byTypeAndVersion(documentType, version, locale ?? "ko-KR");
  }
}
