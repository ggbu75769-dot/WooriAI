import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { CreateUserPaymentMethodDto, UpdateUserPaymentMethodDto } from "./dto/payment-method.dto";

@Controller("me/payment-methods")
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return await this.store.listUserPaymentMethods(request.user!);
  }

  @Post()
  @HttpCode(200)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(CreateUserPaymentMethodDto)) body: CreateUserPaymentMethodDto
  ) {
    return await this.store.createUserPaymentMethod(request.user!, body);
  }

  @Patch(":paymentMethodId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("paymentMethodId") paymentMethodId: string,
    @Body(createDtoValidationPipe(UpdateUserPaymentMethodDto)) body: UpdateUserPaymentMethodDto
  ) {
    return await this.store.updateUserPaymentMethod(request.user!, paymentMethodId, body);
  }

  @Delete(":paymentMethodId")
  async deactivate(@Req() request: AuthenticatedRequest, @Param("paymentMethodId") paymentMethodId: string) {
    return await this.store.deactivateUserPaymentMethod(request.user!, paymentMethodId);
  }

  @Put(":paymentMethodId/active")
  async reactivate(@Req() request: AuthenticatedRequest, @Param("paymentMethodId") paymentMethodId: string) {
    return await this.store.reactivateUserPaymentMethod(request.user!, paymentMethodId);
  }

  @Put(":paymentMethodId/default")
  async setDefault(@Req() request: AuthenticatedRequest, @Param("paymentMethodId") paymentMethodId: string) {
    return await this.store.setDefaultUserPaymentMethod(request.user!, paymentMethodId);
  }
}
