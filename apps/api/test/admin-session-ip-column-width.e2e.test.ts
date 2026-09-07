import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminSessionService } from "../src/admin/admin-session.service";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * `admin_sessions.ip`(schema.prisma: `String? @db.VarChar(64)`)에 들어오는 값이
 * **사용자 입력이 아니라 프록시가 붙인 헤더**라는 사실을 고정하는 스위트.
 *
 * 왜 새 파일인가: 저장소에 `X-Forwarded-For`를 쓰는 어드민 스위트는
 * `admin-auth-throttle.e2e.test.ts` 하나뿐인데(그 파일이 TRUST_PROXY=1을 켜는 관례를
 * 세웠다) 그것이 재는 것은 레이트리밋 버킷 키이고, 그 값이 **DB 컬럼에 그대로 저장된다는
 * 사실**을 보는 단언은 test/ 전체에 0건이었다. 그래서 아래 결함이 회귀로 잡히지 않았다:
 *
 *   TRUST_PROXY=1(운영 기본) + 로그인 성공 + `X-Forwarded-For`의 마지막 항목이 64자 초과
 *   → Prisma P2000(Postgres 22001) → **비밀번호가 맞았는데도 500 INTERNAL_SERVER_ERROR**
 *   (실측 본문: {"error":{"code":"INTERNAL_SERVER_ERROR", ...}}), 세션 행 0개.
 *
 * Express는 `trust proxy` 아래에서 XFF의 마지막 항목을 `req.ip`로 삼을 뿐 그 값이 IP인지
 * 검사하지 않으므로, 이 입력은 아무 클라이언트나 만들 수 있다.
 *
 * 경계값 64는 admin-session.service.ts의 상수를 import 하지 않고 **일부러** 리터럴로 적는다
 * (admin-auth-throttle.e2e.test.ts가 MAX_ATTEMPTS에 대해 세운 관례와 같은 이유): import 하면
 * 상수가 바뀔 때 테스트가 함께 움직여 아무것도 고정하지 못한다.
 */
const IP_COLUMN_WIDTH = 64;

const PASSWORD = "session-ip-width-password-1";
/** 이 스위트가 만든 행만 지우기 위한 자기 접두. afterAll이 이 접두로만 정리한다. */
const EMAIL_PREFIX = "session-ip-width";

describe("admin_sessions.ip 컬럼 폭 — 프록시가 붙인 X-Forwarded-For가 로그인을 깨지 않는다", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  const createdAdminUserIds: string[] = [];

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // 이 스위트의 전제 자체가 "X-Forwarded-For가 req.ip가 된다"이다(bootstrap.ts
    // configureApiApp의 `set("trust proxy", 1)`). 켜지 않으면 req.ip는 소켓 주소뿐이라
    // 아래 케이스가 성립조차 하지 않는다 — admin-auth-throttle.e2e.test.ts와 같은 관례.
    process.env.TRUST_PROXY = "1";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // 자기 접두 행만 지운다: 이 스위트가 만든 admin_users와 그것이 낳은 admin_sessions,
    // 그리고 그 로그인이 남긴 audit_logs까지 — 실행 후 잔여 0을 목표로 한다.
    if (createdAdminUserIds.length > 0) {
      await prisma.adminSession.deleteMany({ where: { adminUserId: { in: createdAdminUserIds } } });
      await prisma.auditLog.deleteMany({ where: { targetId: { in: createdAdminUserIds } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminUserIds } } });
    }
    delete process.env.TRUST_PROXY;
    await app.close();
  });

  async function createAdmin(): Promise<{ id: string; email: string }> {
    const email = `${EMAIL_PREFIX}-${randomUUID()}@wooriai.local`;
    const admin = await prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role: "admin", active: true }
    });
    createdAdminUserIds.push(admin.id);
    return { id: admin.id, email };
  }

  /** `forwardedFor`를 그대로 헤더에 싣는다 — 프록시가 이미 한 홉을 붙인 모양을 흉내낸다. */
  function loginWithForwardedFor(email: string, forwardedFor: string) {
    return request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .set("X-Forwarded-For", forwardedFor)
      .send({ email, password: PASSWORD });
  }

  async function sessionRowsOf(adminUserId: string) {
    return prisma.adminSession.findMany({ where: { adminUserId }, select: { ip: true } });
  }

  it("평범한 IPv4는 종전 그대로 원문이 저장된다 (이 수정이 정상 경로를 바꾸지 않는다)", async () => {
    const admin = await createAdmin();
    await loginWithForwardedFor(admin.email, "203.0.113.9").expect(200);

    const rows = await sessionRowsOf(admin.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].ip).toBe("203.0.113.9");
  });

  it(`경계 통과: XFF 마지막 항목이 정확히 ${IP_COLUMN_WIDTH}자면 200이고 원문 그대로 남는다`, async () => {
    const admin = await createAdmin();
    // 실제 IP는 아니지만 컬럼에는 정확히 들어가는 길이다. 컬럼 폭이 좁아지면(예: 45자)
    // 이 단언이 그 자리에서 빨개진다 — 그것이 이 케이스의 목적이다.
    const exactlyAtLimit = "b".repeat(IP_COLUMN_WIDTH);
    await loginWithForwardedFor(admin.email, `10.0.0.1, ${exactlyAtLimit}`).expect(200);

    const rows = await sessionRowsOf(admin.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].ip).toBe(exactlyAtLimit);
  });

  it(`경계 초과: XFF 마지막 항목이 ${IP_COLUMN_WIDTH}자를 넘어도 500이 아니다 — 세션은 발급되고 ip만 null이 된다`, async () => {
    const admin = await createAdmin();
    const overflow = "c".repeat(200);

    const response = await loginWithForwardedFor(admin.email, `10.0.0.1, ${overflow}`);

    // 종전에는 여기가 정확히 500 INTERNAL_SERVER_ERROR였다(Prisma P2000이
    // admin-session.service.ts의 adminSession.create에서 터졌다). 상태 코드만이 아니라
    // **에러 코드까지** 못 박는다: 400으로 바꾸는 것도 이 단언을 깬다 — 프록시가 붙인
    // 헤더 때문에 자격증명이 맞은 로그인을 거절하지 않겠다는 판단이 여기 들어 있다.
    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
    expect(response.body.mfaRequired).toBe(false);

    // 세션 쿠키가 실제로 나갔는가 — 200이지만 로그인이 되지 않는 상태를 배제한다.
    const rawSetCookie = response.headers["set-cookie"];
    const setCookies: string[] = Array.isArray(rawSetCookie) ? rawSetCookie : rawSetCookie ? [rawSetCookie] : [];
    expect(setCookies.some((header) => header.startsWith("admin_session="))).toBe(true);

    // ip는 잘리지 않고 null이다: 64자를 넘는 값은 정의상 IP가 아니므로, 앞토막을 남기면
    // 감사 칸이 "이 주소에서 로그인했다"는 거짓을 말하게 된다(근거는 서비스 쪽 주석).
    const rows = await sessionRowsOf(admin.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].ip).toBeNull();
  });

  it("컬럼 폭 방어는 컨트롤러가 아니라 세션 쓰기 지점에 있다 — mfa/verify-login 등 다른 호출자도 함께 덮인다", async () => {
    // `@Ip()`는 admin-auth.controller.ts의 두 자리(login · mfa/verify-login)에서 들어오고
    // 둘 다 이 서비스의 createSession 하나로 모인다. 그 지점을 직접 불러 계약을 고정하면
    // TOTP를 세우지 않고도 나머지 호출자까지 한 번에 덮인다.
    const admin = await createAdmin();
    const sessions = moduleRef.get(AdminSessionService);

    await sessions.createSession({ adminUserId: admin.id, ip: "d".repeat(IP_COLUMN_WIDTH + 1), userAgent: null });

    const rows = await sessionRowsOf(admin.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].ip).toBeNull();
  });

  it("ip가 null인 호출은 종전 그대로 null로 남는다", async () => {
    const admin = await createAdmin();
    const sessions = moduleRef.get(AdminSessionService);

    await sessions.createSession({ adminUserId: admin.id, ip: null, userAgent: null });

    const rows = await sessionRowsOf(admin.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].ip).toBeNull();
  });
});
