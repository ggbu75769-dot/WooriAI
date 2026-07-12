import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { createDtoValidationPipe } from "../../bootstrap";
import { ExchangeKakaoOAuthDto } from "../dto/exchange-kakao-oauth.dto";
import { PrepareKakaoOAuthDto } from "../dto/prepare-kakao-oauth.dto";
import { KakaoAuthService } from "./kakao-auth.service";

@Controller("auth/kakao")
export class KakaoAuthController {
  constructor(@Inject(KakaoAuthService) private readonly kakaoAuthService: KakaoAuthService) {}

  @Post("prepare")
  @HttpCode(200)
  async prepare(@Body(createDtoValidationPipe(PrepareKakaoOAuthDto)) body: PrepareKakaoOAuthDto) {
    return await this.kakaoAuthService.prepare(body);
  }

  @Post("exchange")
  @HttpCode(200)
  async exchange(@Body(createDtoValidationPipe(ExchangeKakaoOAuthDto)) body: ExchangeKakaoOAuthDto) {
    return await this.kakaoAuthService.exchange(body);
  }
}
