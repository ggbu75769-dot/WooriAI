import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AuthService } from "./auth.service";
import { LogoutDto } from "./dto/logout.dto";
import { OAuthLoginDto } from "./dto/oauth-login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller()
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("auth/oauth-login")
  @HttpCode(200)
  oauthLogin(@Body(createDtoValidationPipe(OAuthLoginDto)) body: OAuthLoginDto) {
    return this.authService.oauthLogin(body);
  }

  @Post("auth/refresh")
  @HttpCode(200)
  refresh(@Body(createDtoValidationPipe(RefreshTokenDto)) body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post("auth/logout")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(LogoutDto)) body: LogoutDto
  ) {
    return this.authService.logout(request.user!, body.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
      households: request.user?.households ?? []
    };
  }
}
