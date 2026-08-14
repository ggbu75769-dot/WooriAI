import { Body, Controller, Get, HttpCode, Inject, Ip, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { AdminUser } from "@prisma/client";
import type { Response } from "express";
import { createDtoValidationPipe } from "../bootstrap";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  cookieSecureFlag,
  generateCsrfToken,
  parseCookieHeader
} from "./admin-cookies";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminMfaExempt } from "./admin-mfa-exempt.decorator";
import { AdminChangePasswordDto } from "./dto/admin-change-password.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { AdminMfaDisableDto, AdminMfaSetupVerifyDto, AdminMfaVerifyLoginDto } from "./dto/admin-mfa.dto";

function userAgentOf(request: AuthenticatedRequest): string | null {
  const value = request.headers?.["user-agent"];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function cookieHeaderOf(request: AuthenticatedRequest): string | undefined {
  const value = request.headers?.cookie;
  return Array.isArray(value) ? value[0] : value;
}

/** Requires that the caller already has a valid `adminUser` (set by AdminAuthGuard). */
function currentAdminId(request: AuthenticatedRequest): string {
  const id = request.adminUser?.id;
  if (!id) {
    throw new UnauthorizedException({ code: "ADMIN_UNAUTHORIZED", message: "Admin access is required." });
  }
  return id;
}

@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body(createDtoValidationPipe(AdminLoginDto)) body: AdminLoginDto,
    @Ip() ip: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.adminAuthService.login(body.email, body.password, ip, userAgentOf(request));
    if (result.status === "mfa_required") {
      return { mfaRequired: true, mfaToken: result.mfaToken, expiresIn: result.expiresIn };
    }

    this.setSessionCookies(res, result.session);
    return { mfaRequired: false, admin: result.admin, mfaEnabled: result.mfaEnabled };
  }

  @Post("mfa/verify-login")
  @HttpCode(200)
  async verifyLoginMfa(
    @Body(createDtoValidationPipe(AdminMfaVerifyLoginDto)) body: AdminMfaVerifyLoginDto,
    @Ip() ip: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.adminAuthService.verifyLoginMfa(body.mfaToken, body.code, ip, userAgentOf(request));
    this.setSessionCookies(res, result.session);
    return { mfaRequired: false, admin: result.admin, mfaEnabled: result.mfaEnabled };
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  @AdminMfaExempt()
  async me(@Req() request: AuthenticatedRequest) {
    const admin = await this.requireAdmin(request);
    return this.adminAuthService.me(admin);
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @AdminMfaExempt()
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const admin = await this.requireAdmin(request);
    const cookies = parseCookieHeader(cookieHeaderOf(request));
    const token = cookies[ADMIN_SESSION_COOKIE];
    if (token) {
      await this.adminAuthService.logout(token, admin);
    }
    this.clearSessionCookies(res);
    return { success: true };
  }

  /**
   * ADM-007: change the logged-in admin's own password. @AdminMfaExempt mirrors
   * the mfa/setup endpoints' precedent: a freshly created admin (holding only
   * the one-time temp password from POST /admin/users) must be able to rotate
   * it possibly before finishing MFA enrollment — the AdminAuthGuard would
   * otherwise 403 the route behind the enrollment gate. A real session cookie
   * (+ CSRF) and the current password are still both required.
   */
  @Post("change-password")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @AdminMfaExempt()
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminChangePasswordDto)) body: AdminChangePasswordDto
  ) {
    const admin = await this.requireAdmin(request);
    const sessionId = request.adminSessionId ?? "";
    await this.adminAuthService.changePassword(admin, sessionId, body.currentPassword, body.newPassword);
    return { success: true };
  }

  @Post("mfa/setup/start")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @AdminMfaExempt()
  async startMfaSetup(@Req() request: AuthenticatedRequest) {
    const admin = await this.requireAdmin(request);
    return this.adminAuthService.startMfaSetup(admin);
  }

  @Post("mfa/setup/verify")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @AdminMfaExempt()
  async verifyMfaSetup(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminMfaSetupVerifyDto)) body: AdminMfaSetupVerifyDto
  ) {
    const admin = await this.requireAdmin(request);
    return this.adminAuthService.verifyMfaSetup(admin, body.code);
  }

  @Post("mfa/disable")
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  async disableMfa(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminMfaDisableDto)) body: AdminMfaDisableDto
  ) {
    const admin = await this.requireAdmin(request);
    const sessionId = request.adminSessionId ?? "";
    await this.adminAuthService.disableMfa(admin, sessionId, body.code);
    return { success: true };
  }

  private async requireAdmin(request: AuthenticatedRequest): Promise<AdminUser> {
    const id = currentAdminId(request);
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      throw new UnauthorizedException({ code: "ADMIN_UNAUTHORIZED", message: "Admin access is required." });
    }
    return admin;
  }

  private setSessionCookies(res: Response, session: { token: string; expiresAt: Date }) {
    const secure = cookieSecureFlag();
    res.cookie(ADMIN_SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      expires: session.expiresAt
    });
    res.cookie(ADMIN_CSRF_COOKIE, generateCsrfToken(), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      secure,
      expires: session.expiresAt
    });
  }

  private clearSessionCookies(res: Response) {
    const secure = cookieSecureFlag();
    res.clearCookie(ADMIN_SESSION_COOKIE, { path: "/", httpOnly: true, sameSite: "lax", secure });
    res.clearCookie(ADMIN_CSRF_COOKIE, { path: "/", httpOnly: false, sameSite: "lax", secure });
  }
}
