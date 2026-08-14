import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminSessionService } from "./admin-session.service";
import { hashAdminPassword } from "./admin-password";
import { AdminCreateAdminUserDto, AdminUpdateAdminUserDto } from "./dto/admin-users.dto";
import { RequireAdminRoles } from "./require-admin-roles.decorator";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 비밀번호/TOTP 관련 컬럼(passwordHash, totpSecret, mfaRecoveryCodes)은 어떤 응답에도
// 절대 포함하지 않는다 — select 화이트리스트로 강제.
const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true
} as const;

/**
 * ADM-006: 임시 비밀번호 발급. base64url 24자(144bit 엔트로피) — 생성 응답에서
 * 딱 한 번 노출되고, 저장은 scrypt 해시(admin-password.ts)로만 한다.
 */
function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}

function actorId(request: AuthenticatedRequest) {
  return request.adminUser?.id ?? "dev-admin";
}

/**
 * ADM-006: 관리자 계정 관리. 모든 라우트가 admin 역할 전용이며, 다른 admin 라우트와
 * 동일하게 쿠키 세션 + CSRF + MFA 등록 게이트(AdminAuthGuard)를 그대로 거친다.
 */
@Controller("admin/users")
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService
  ) {}

  @Get()
  @RequireAdminRoles("admin")
  async list() {
    const adminUsers = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: ADMIN_USER_SELECT
    });
    return { adminUsers };
  }

  @Post()
  @HttpCode(200)
  @RequireAdminRoles("admin")
  async create(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(AdminCreateAdminUserDto)) body: AdminCreateAdminUserDto
  ) {
    // 로그인(admin-auth.service.ts)과 동일한 정규화 — 대소문자만 다른 중복 계정 방지.
    const email = body.email.trim().toLowerCase();
    const existing = await this.prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException({ code: "ADMIN_EMAIL_EXISTS", message: "이미 등록된 관리자 이메일이에요." });
    }

    const tempPassword = generateTempPassword();
    const created = await this.prisma.adminUser.create({
      data: {
        email,
        passwordHash: hashAdminPassword(tempPassword),
        displayName: body.displayName ?? email,
        role: body.role,
        active: true
      },
      select: ADMIN_USER_SELECT
    });

    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.admin_user.create",
      targetType: "admin_users",
      targetId: created.id,
      // 임시 비밀번호는 절대 감사 로그에 남기지 않는다.
      after: { email: created.email, role: created.role }
    });

    // tempPassword는 이 응답에서 딱 한 번만 노출된다(재조회 불가).
    return { admin: created, tempPassword };
  }

  @Patch(":adminUserId")
  @RequireAdminRoles("admin")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("adminUserId") adminUserId: string,
    @Body(createDtoValidationPipe(AdminUpdateAdminUserDto)) body: AdminUpdateAdminUserDto
  ) {
    if (body.role === undefined && body.active === undefined) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "요청 값을 다시 확인해주세요.",
        details: { fields: [{ field: "role", constraints: { required: "role 또는 active 중 하나는 필요해요." } }] }
      });
    }

    const target = UUID_PATTERN.test(adminUserId)
      ? await this.prisma.adminUser.findUnique({ where: { id: adminUserId } })
      : null;
    if (!target) {
      throw new NotFoundException({ code: "ADMIN_USER_NOT_FOUND", message: "관리자 계정을 찾을 수 없어요." });
    }

    // 마지막 admin이 스스로를 잠그는 사고 방지: 자기 자신의 강등/비활성화는 금지.
    const isSelf = request.adminUser?.id === target.id;
    const demotesSelf = isSelf && body.role !== undefined && body.role !== "admin";
    const deactivatesSelf = isSelf && body.active === false;
    if (demotesSelf || deactivatesSelf) {
      throw new ForbiddenException({
        code: "ADMIN_SELF_UPDATE_FORBIDDEN",
        message: "자기 자신의 권한 강등이나 비활성화는 할 수 없어요."
      });
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: target.id },
      data: { role: body.role, active: body.active },
      select: ADMIN_USER_SELECT
    });

    // 비활성화는 세션 검증(admin-session.service.ts)에서도 걸러지지만, 이미 발급된
    // 세션을 기다리지 않고 즉시 전부 폐기한다(선제 revoke).
    if (target.active && body.active === false) {
      await this.sessions.revokeAllForAdmin(target.id);
    }

    await this.auditLogger.record({
      actorUserId: actorId(request),
      action: "admin.admin_user.update",
      targetType: "admin_users",
      targetId: target.id,
      before: { role: target.role, active: target.active },
      after: { role: updated.role, active: updated.active }
    });

    return { admin: updated };
  }
}
