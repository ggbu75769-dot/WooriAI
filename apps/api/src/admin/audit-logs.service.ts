import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AUDIT_LOGS_DEFAULT_LIMIT, type AdminAuditLogsQueryDto } from "./dto/audit-logs.dto";

/**
 * 자격증명/토큰류로 의심되는 JSON 키. before/after 스냅샷을 남기는 쪽
 * (admin-users.controller.ts 등)이 이미 비밀번호를 절대 기록하지 않지만,
 * 뷰어 응답은 방어적으로 한 번 더 마스킹한다 — 원문이 실수로 기록됐더라도
 * 조회 API로는 절대 나가지 않게 (ADM-113 민감정보 미포함 요구).
 */
const SENSITIVE_KEY_PATTERN = /password|passwd|secret|token|authorization|cookie|credential|recovery|otp|totp|apikey|api_key/i;
const REDACTED = "[REDACTED]";
const MAX_REDACTION_DEPTH = 8;

function redactSensitiveValues(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object" || depth >= MAX_REDACTION_DEPTH) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValues(entry, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactSensitiveValues(entry, depth + 1);
  }
  return result;
}

export type AdminAuditLogView = {
  id: string;
  createdAt: Date;
  actorUserId: string | null;
  /** actorUserId가 admin_users의 계정이면 그 이메일, 아니면 null (일반 사용자/시스템). */
  actorEmail: string | null;
  householdId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ipHash: string | null;
};

/**
 * ADM-113: 감사 로그 조회. AuditLoggerService가 audit_logs 테이블에 이미
 * 영속화하고 있는 기록을 읽기 전용으로 페이지네이션/필터해 돌려준다
 * (기록 경로는 건드리지 않는다).
 */
@Injectable()
export class AuditLogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: AdminAuditLogsQueryDto) {
    const limit = query.limit ?? AUDIT_LOGS_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;

    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      actorUserId: query.actorUserId,
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {})
            }
          }
        : {})
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit
      })
    ]);

    // 행위자 표시용 이메일 배치 조회: actor_user_id는 admin_users의 id일 수도
    // (어드민 행위), users의 id일 수도(도메인 행위) 있다 — 어드민 계정만 매칭해
    // 이메일을 붙이고 나머지는 null로 둔다.
    const actorIds = [...new Set(rows.map((row) => row.actorUserId).filter((id): id is string => Boolean(id)))];
    const admins = actorIds.length
      ? await this.prisma.adminUser.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })
      : [];
    const emailByActorId = new Map(admins.map((admin) => [admin.id, admin.email]));

    const auditLogs: AdminAuditLogView[] = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      actorUserId: row.actorUserId,
      actorEmail: row.actorUserId ? (emailByActorId.get(row.actorUserId) ?? null) : null,
      householdId: row.householdId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      before: redactSensitiveValues(row.beforeJson ?? null),
      after: redactSensitiveValues(row.afterJson ?? null),
      ipHash: row.ipHash
    }));

    return {
      auditLogs,
      pageInfo: { total, limit, offset, hasMore: offset + rows.length < total }
    };
  }
}
