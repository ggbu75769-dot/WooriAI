import { Body, Controller, HttpCode, Inject, Ip, Post } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto } from "./dto/admin-login.dto";

@Controller("admin/auth")
export class AdminAuthController {
  constructor(@Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService) {}

  @Post("login")
  @HttpCode(200)
  login(@Body(createDtoValidationPipe(AdminLoginDto)) body: AdminLoginDto, @Ip() ip: string) {
    return this.adminAuthService.login(body.email, body.password, ip);
  }
}
