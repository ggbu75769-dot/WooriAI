import { createHash } from "node:crypto";
import { Body, Controller, Get, Headers, Inject, Ip, Put, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { UpsertConsentsDto } from "./dto/upsert-consents.dto";
import { OnboardingStoreService } from "./onboarding-store.service";

@Controller("consents")
@UseGuards(JwtAuthGuard)
export class ConsentsController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return await this.store.listConsents(request.user!);
  }

  @Get("current")
  async current(@Req() request: AuthenticatedRequest) {
    return await this.store.listConsents(request.user!);
  }

  @Get("history")
  async history(@Req() request: AuthenticatedRequest) {
    return await this.store.consentHistory(request.user!);
  }

  @Put()
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(UpsertConsentsDto)) body: UpsertConsentsDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string
  ) {
    const salt = process.env.PRIVACY_HASH_SALT ?? "wooriai-dev-privacy-hash-salt";
    const hash = (value?: string) => value ? createHash("sha256").update(`${salt}:${value}`).digest("hex") : undefined;
    return await this.store.upsertConsents(request.user!, body.consents, {
      source: body.source ?? "mobile",
      appVersion: body.appVersion,
      ipHash: hash(ip),
      userAgentHash: hash(userAgent)
    });
  }
}
