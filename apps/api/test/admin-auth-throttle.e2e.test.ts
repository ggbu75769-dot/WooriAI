import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 어드민 비밀번호 추측의 **총량 상한**을 고정하는 스위트.
 *
 * 왜 새 파일인가: 종전까지 `LoginAttemptLimiter`(admin-auth.service.ts)를 무는 테스트가
 * 저장소에 **0건**이었다 — `ADMIN_LOGIN_RATE_LIMITED`를 기대하는 단언이 test/ 전체에 없었다.
 * 그래서 (1) 로그인 잠금이 계정 단위가 아니라 `(이메일, IP)` 쌍 단위라는 사실도,
 * (2) `changePassword`의 재확인에 시도 제한이 아예 없다는 사실도 회귀로 잡히지 않았다.
 * 이 파일이 두 성질을 각각 리터럴 값으로 못 박는다.
 *
 * 값은 admin-auth.service.ts의 상수(MAX_ATTEMPTS=5, EMAIL_MAX_ATTEMPTS=25)와 **일부러**
 * 중복해 리터럴로 적는다. import 하면 상수가 바뀔 때 테스트가 함께 움직여 아무것도
 * 고정하지 못한다 — 값을 바꾸는 판단은 여기도 함께 고쳐야 하는 판단이다.
 */
const EMAIL_BUCKET_MAX = 25;
const PAIR_BUCKET_MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;

const PASSWORD = "throttle-e2e-password-1";
const WRONG_PASSWORD = "throttle-e2e-wrong-password";

function freshEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@wooriai.local`;
}

function parseSetCookies(response: request.Response): Record<string, string> {
  const raw = response.headers["set-cookie"];
  const setCookieHeaders: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";");
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    cookies[pair.slice(0, separatorIndex).trim()] = pair.slice(separatorIndex + 1).trim();
  }
  return cookies;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

describe("Admin 로그인·비밀번호 재확인 시도 상한 (R-1 · R-2)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // 이 스위트의 전제 자체가 "IP를 바꿔 가며 시도한다"이므로 X-Forwarded-For가 req.ip로
    // 반영돼야 한다(bootstrap.ts configureApiApp). 켜지지 않으면 25번의 시도가 한 쌍 버킷에
    // 몰려 6번째부터 429가 되고, 아래 단언이 그 자리에서 빨갛게 실패한다 — 조용히 통과하지 않는다.
    process.env.TRUST_PROXY = "1";
    // 로그인·재확인은 전부 `/api/v1/admin/auth/*`라 미들웨어의 auth 버킷(기본 30회/분/IP)도 함께
    // 문다. 이 스위트가 재는 것은 그 버킷이 아니라 AdminAuthService의 계정 단위 상한이므로,
    // content-revisions.e2e.test.ts와 같은 관례로 그 천장만 걷어 둔다(미들웨어는 요청마다 env를
    // 다시 읽는다). 아래 afterAll이 지운다.
    process.env.RATE_LIMIT_AUTH_MAX = "5000";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    delete process.env.TRUST_PROXY;
    delete process.env.RATE_LIMIT_AUTH_MAX;
    await app.close();
  });

  // 자기 접두 행만 만든다. admin_users는 지우지 않는다 — 이 저장소의 형제 스위트
  // (admin-change-password.e2e.test.ts · admin-mfa-session.e2e.test.ts)가 모두 UUID 이메일로
  // 만들고 남겨 두는 관례이고, 이 행들이 남긴 audit_logs(admin.login_failed 등)의 actor를
  // 끊지 않기 위해서다. 다른 스위트가 보는 공유 시드 행은 하나도 건드리지 않는다.
  async function createAdmin(email: string) {
    return prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role: "admin", active: true }
    });
  }

  /** 매번 다른 IP에서 오는 로그인 시도. `n`번째 호출은 늘 새 주소를 쓴다(TEST-NET-2/3). */
  function loginFrom(ip: string, email: string, password: string) {
    return request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ email, password });
  }

  it("R-1: IP를 바꿔도 한 계정을 향한 실패는 25회에서 멈춘다 (쌍 버킷은 한 번도 차지 않는다)", async () => {
    const email = freshEmail("throttle-rotate");
    await createAdmin(email);

    // 25개의 서로 다른 IP에서 한 번씩 틀린다 — 어떤 (이메일, IP) 쌍도 1회뿐이라 종전
    // `email:ip` 단일 키 구현에서는 이 25번이 전부 401이고 26번째도 401이었다(=상한 없음).
    for (let index = 0; index < EMAIL_BUCKET_MAX; index += 1) {
      await loginFrom(`198.51.100.${index + 1}`, email, WRONG_PASSWORD)
        .expect(401)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_FAILED"));
    }

    // 26번째: 아직 한 번도 쓰지 않은 IP인데도 막힌다. 이것이 R-1의 수정 지점이다.
    await loginFrom("203.0.113.26", email, WRONG_PASSWORD)
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_RATE_LIMITED"));

    // ⚠️ 대가를 그대로 고정한다: 잠긴 동안에는 **올바른 비밀번호도** 들어가지 못한다.
    // 이것이 이메일 단독 버킷이 만드는 서비스 거부이고, EMAIL_MAX_ATTEMPTS 주석이 값을 25로
    // 고른 이유(요청 25개를 써야 최대 15분)를 여기서 사실로 붙잡아 둔다.
    await loginFrom("203.0.113.27", email, PASSWORD)
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_RATE_LIMITED"));

    // 상한은 **계정 단위**이지 전역이 아니다: 같은 IP에서 다른 어드민으로는 그대로 통과한다.
    const otherEmail = freshEmail("throttle-rotate-other");
    await createAdmin(otherEmail);
    await loginFrom("203.0.113.26", otherEmail, PASSWORD).expect(200);

    // 거부는 15분을 넘지 않는다 — 창이 지나면 스스로 풀린다. 실시간으로 기다리지 않고
    // 리미터가 보는 시계(Date.now)만 앞으로 민다. `new Date()`(세션 만료 계산)는 이 스파이의
    // 영향을 받지 않으므로 로그인 응답 자체는 평소와 같다.
    const realNow = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(realNow + WINDOW_MS + 1_000);
    try {
      await loginFrom("203.0.113.28", email, PASSWORD).expect(200);
    } finally {
      clock.mockRestore();
    }
  });

  it("R-1: 성공 로그인이 계정 버킷을 비운다 (공격자가 쌓은 누적을 정상 사용자가 지운다)", async () => {
    const email = freshEmail("throttle-reset");
    await createAdmin(email);

    // 상한 바로 아래(24회)까지 채운다.
    for (let index = 0; index < EMAIL_BUCKET_MAX - 1; index += 1) {
      await loginFrom(`198.51.100.${index + 1}`, email, WRONG_PASSWORD).expect(401);
    }

    // 정상 로그인 1회 — 여기서 계정 버킷이 0으로 돌아간다.
    await loginFrom("203.0.113.40", email, PASSWORD).expect(200);

    // 비우지 않았다면 이 두 번 중 첫 번째가 25번째 실패로 기록되고 두 번째가 429였다.
    // 둘 다 401이라는 사실이 reset을 고정한다.
    await loginFrom("203.0.113.41", email, WRONG_PASSWORD).expect(401);
    await loginFrom("203.0.113.42", email, WRONG_PASSWORD).expect(401);
  });

  it("R-1: 429가 계정 존재 여부를 알려주지 않는다 — 없는 이메일도 같은 25회에서 같은 코드", async () => {
    // 이 이메일로는 admin_users 행을 만들지 않는다.
    const unknownEmail = freshEmail("throttle-unknown");

    for (let index = 0; index < EMAIL_BUCKET_MAX; index += 1) {
      await loginFrom(`192.0.2.${index + 1}`, unknownEmail, WRONG_PASSWORD)
        .expect(401)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_FAILED"));
    }

    // 실재하는 계정과 글자 그대로 같은 응답이다. 계정 키를 admin 행 조회 **전에**,
    // 존재 여부와 무관하게 세기 때문이다(loginEmailKey 주석) — 여기가 갈리면
    // 429/401의 차이가 곧 이메일 열거 오라클이 된다.
    await loginFrom("192.0.2.26", unknownEmail, WRONG_PASSWORD)
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_RATE_LIMITED"));
  });

  it("R-1: 같은 IP에서 몰아치면 종전 그대로 5회에서 막힌다 (쌍 버킷의 응답은 한 글자도 바뀌지 않았다)", async () => {
    const email = freshEmail("throttle-pair");
    await createAdmin(email);

    for (let index = 0; index < PAIR_BUCKET_MAX; index += 1) {
      await loginFrom("198.51.100.200", email, WRONG_PASSWORD)
        .expect(401)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_FAILED"));
    }
    await loginFrom("198.51.100.200", email, WRONG_PASSWORD)
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_LOGIN_RATE_LIMITED"));

    // 계정 버킷은 아직 5/25라 다른 IP는 통과한다 — 두 버킷이 AND로 독립임을 보인다.
    await loginFrom("198.51.100.201", email, PASSWORD).expect(200);
  });

  it("R-2: 세션 안의 비밀번호 재확인이 5회/15분으로 묶인다 (종전에는 상한이 없었다)", async () => {
    const email = freshEmail("throttle-pwchange");
    await createAdmin(email);

    const login = await loginFrom("198.51.100.210", email, PASSWORD).expect(200);
    const cookies = parseSetCookies(login);
    const cookie = cookieHeader(cookies);
    const csrfToken = cookies.admin_csrf;

    const attempt = (currentPassword: string) =>
      request(app.getHttpServer())
        .post("/api/v1/admin/auth/change-password")
        .set("X-Forwarded-For", "198.51.100.210")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrfToken)
        .send({ currentPassword, newPassword: "throttle-e2e-new-password-9" });

    for (let index = 0; index < PAIR_BUCKET_MAX; index += 1) {
      await attempt(`${WRONG_PASSWORD}-${index}`)
        .expect(401)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_PASSWORD_INVALID"));
    }

    // 6번째부터는 scrypt 검증에 닿기도 전에 막힌다. 종전에는 여기가 그냥 401이었고,
    // 분당 30회(auth 버킷)로 영원히 이어졌다.
    await attempt(`${WRONG_PASSWORD}-5`)
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_PASSWORD_RATE_LIMITED"));

    // 잠긴 동안에는 올바른 현재 비밀번호도 통하지 않는다(거절이 실제 상한이라는 뜻).
    await attempt(PASSWORD)
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_PASSWORD_RATE_LIMITED"));

    // 이름공간이 갈려 있어 재확인 잠금이 **로그인을 막지 않는다**: 비밀번호는 아직 그대로다.
    await loginFrom("198.51.100.211", email, PASSWORD).expect(200);
  });

  it("R-2: 현재 비밀번호를 맞히면 카운터가 비고, 새 비밀번호 정책 400은 카운터를 태우지 않는다", async () => {
    const email = freshEmail("throttle-pwreset");
    await createAdmin(email);

    const login = await loginFrom("198.51.100.220", email, PASSWORD).expect(200);
    const cookies = parseSetCookies(login);
    const cookie = cookieHeader(cookies);
    const csrfToken = cookies.admin_csrf;

    const attempt = (currentPassword: string, newPassword: string) =>
      request(app.getHttpServer())
        .post("/api/v1/admin/auth/change-password")
        .set("X-Forwarded-For", "198.51.100.220")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrfToken)
        .send({ currentPassword, newPassword });

    // 상한 바로 아래(4회)까지 틀린다.
    for (let index = 0; index < PAIR_BUCKET_MAX - 1; index += 1) {
      await attempt(`${WRONG_PASSWORD}-${index}`, "throttle-e2e-new-password-9").expect(401);
    }

    // 현재 비밀번호는 맞았지만 새 비밀번호가 기존과 같아 400으로 돌아온다. 이것은 추측
    // 실패가 아니므로 카운터를 태우지 않아야 한다(오히려 여기서 비워진다).
    await attempt(PASSWORD, PASSWORD)
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_PASSWORD_UNCHANGED"));

    // 비우지 않았다면 이 둘 중 두 번째가 429였다.
    await attempt(`${WRONG_PASSWORD}-a`, "throttle-e2e-new-password-9").expect(401);
    await attempt(`${WRONG_PASSWORD}-b`, "throttle-e2e-new-password-9").expect(401);

    // 실제 변경도 그대로 동작한다(상한이 정상 경로를 막지 않는다).
    await attempt(PASSWORD, "throttle-e2e-new-password-9")
      .expect(200)
      .expect(({ body }) => expect(body.success).toBe(true));
  });
});
