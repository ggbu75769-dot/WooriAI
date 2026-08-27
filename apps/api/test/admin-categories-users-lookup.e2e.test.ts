import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "adm127-e2e-password-1";

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

/**
 * ADM-127: 어드민 카테고리 관리(GET/PATCH /admin/categories)와 최종 사용자 조회
 * (GET /admin/users-lookup).
 *
 * 시드 카테고리 21행은 다른 스위트도 함께 읽으므로 **수정 검증은 이 파일이 직접 만든
 * 전용 행**에만 한다(afterEach에서 지운다) — 시드 행의 selectable을 건드리면
 * categories.e2e.test.ts / mobile-category-alias-contract.test.ts의 전제가 흔들린다.
 */
describe("Admin categories & end-user lookup (ADM-127)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  /** 이 테스트가 만든 행들 — afterEach에서 역순으로 정리한다. */
  const createdCategoryIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdHouseholdIds: string[] = [];

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = "test-legacy-admin-token";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdUserIds.length) {
      // 정리 순서 주의: 지출을 참조하는 자식 행(구매확인 연결·임포트 행)을 먼저 지운다.
      // 이 순서가 틀리면 FK 위반으로 afterEach 전체가 중단돼 만든 행이 공유 DB에 남고,
      // 이후 실행의 categories.e2e(정식 12개 검증)가 오염으로 깨진다 — 실제로 겪은 사고.
      const expenseIds = (
        await prisma.expense.findMany({
          where: { createdByUserId: { in: createdUserIds } },
          select: { id: true }
        })
      ).map((row) => row.id);
      if (expenseIds.length) {
        await prisma.childItemStatus.deleteMany({ where: { expenseId: { in: expenseIds } } });
      }
      await prisma.expense.deleteMany({ where: { createdByUserId: { in: createdUserIds } } });
    }
    if (createdCategoryIds.length) {
      await prisma.importRow.deleteMany({ where: { categoryId: { in: createdCategoryIds } } });
      await prisma.expense.deleteMany({ where: { categoryId: { in: createdCategoryIds } } });
    }
    if (createdHouseholdIds.length) {
      await prisma.child.deleteMany({ where: { householdId: { in: createdHouseholdIds } } });
      await prisma.householdMember.deleteMany({ where: { householdId: { in: createdHouseholdIds } } });
      await prisma.household.deleteMany({ where: { id: { in: createdHouseholdIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdCategoryIds.length) {
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    }
    createdCategoryIds.length = 0;
    createdUserIds.length = 0;
    createdHouseholdIds.length = 0;
    await app.close();
  });

  async function createAdmin(email: string, role: "admin" | "editor" | "analyst" = "admin") {
    return prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role, active: true }
    });
  }

  /** admin-audit-logs.e2e.test.ts와 동일한 실제 플로우: 로그인 + TOTP 등록까지 마친 세션. */
  async function loginAndEnroll(email: string) {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(loginResponse.body.mfaRequired).toBe(false);

    const cookies = parseSetCookies(loginResponse);
    const cookie = cookieHeader(cookies);
    const csrfToken = cookies.admin_csrf as string;

    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code: await generateTotp({ secret: setupStart.body.secret as string }) })
      .expect(200);

    return { cookie, csrfToken };
  }

  async function adminSession(role: "admin" | "editor" | "analyst" = "admin") {
    const email = freshEmail(`adm127-${role}`);
    const admin = await createAdmin(email, role);
    return { admin, email, ...(await loginAndEnroll(email)) };
  }

  /** 시드 행을 건드리지 않기 위한 전용 카테고리. 기본값은 정식 행과 같다(active+selectable). */
  async function createTestCategory(overrides: { selectable?: boolean; active?: boolean } = {}) {
    const category = await prisma.category.create({
      data: {
        code: `adm127_test_${randomUUID().slice(0, 8)}`,
        name: "테스트 카테고리",
        iconName: "more",
        // 시드 정식 행(10~999)·별칭(1001~1009)과 안 겹치도록 멀찍이 둔다.
        displayOrder: 50_000,
        active: overrides.active ?? true,
        selectable: overrides.selectable ?? true
      }
    });
    createdCategoryIds.push(category.id);
    return category;
  }

  async function createEndUser(input: { email: string; displayName: string }) {
    const user = await prisma.user.create({
      data: {
        authProvider: "kakao",
        providerUserId: `adm127-${randomUUID()}`,
        email: input.email,
        displayName: input.displayName,
        phone: "010-0000-0000",
        profileImageUrl: "https://example.test/adm127-avatar.png",
        status: "active",
        lastLoginAt: new Date("2026-08-01T00:00:00.000Z")
      }
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function createHouseholdWithChild(ownerUserId: string, nickname: string) {
    const household = await prisma.household.create({
      data: { name: "ADM-127 테스트 가구", ownerUserId, status: "active" }
    });
    createdHouseholdIds.push(household.id);
    await prisma.householdMember.create({
      data: { householdId: household.id, userId: ownerUserId, role: "owner", status: "active", joinedAt: new Date() }
    });
    const child = await prisma.child.create({
      data: {
        householdId: household.id,
        nickname,
        stageMode: "born",
        birthDate: new Date("2026-03-03T00:00:00.000Z"),
        gender: "female"
      }
    });
    return { household, child };
  }

  // ---------------------------------------------------------------- categories

  describe("GET/PATCH /admin/categories", () => {
    it("rejects unauthenticated access (403 without credentials, 401 with an invalid session cookie)", async () => {
      const category = await createTestCategory();

      for (const path of ["/api/v1/admin/categories", "/api/v1/admin/users-lookup?query=adm127"]) {
        await request(app.getHttpServer())
          .get(path)
          .expect(403)
          .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

        await request(app.getHttpServer())
          .get(path)
          .set("Cookie", "admin_session=invalid-session-token")
          .expect(401)
          .expect(({ body }) => expect(body.error.code).toBe("ADMIN_UNAUTHORIZED"));
      }

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .send({ selectable: false })
        .expect(403);
    });

    it("returns every category row — including the CAT-124 non-selectable alias/stub rows", async () => {
      const session = await adminSession("admin");

      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/categories")
        .set("Cookie", session.cookie)
        .expect(200);

      const byCode = new Map<string, { active: boolean; selectable: boolean; isSystem: boolean }>(
        response.body.categories.map((row: { code: string; active: boolean; selectable: boolean; isSystem: boolean }) => [
          row.code,
          row
        ])
      );

      // 시드 21행: 정식 12 + 모바일 별칭 8 + 가져오기 스텁 1.
      expect(byCode.get("diaper_hygiene")).toMatchObject({ active: true, selectable: true });
      for (const aliasCode of ["mobile_diaper_hygiene", "mobile_etc", "import_stub_default"]) {
        expect(byCode.get(aliasCode), `${aliasCode} should be listed`).toMatchObject({
          active: true,
          selectable: false
        });
      }

      // 앱용 GET /categories(기본)와 달리 selectable=false 행이 빠지지 않는다.
      expect(response.body.categories.filter((row: { selectable: boolean }) => !row.selectable).length).toBeGreaterThanOrEqual(9);
    });

    it("lets editor/analyst read the list but 403s their edits (writes are admin-only)", async () => {
      const category = await createTestCategory();

      for (const role of ["editor", "analyst"] as const) {
        const session = await adminSession(role);

        await request(app.getHttpServer()).get("/api/v1/admin/categories").set("Cookie", session.cookie).expect(200);

        await request(app.getHttpServer())
          .patch(`/api/v1/admin/categories/${category.id}`)
          .set("Cookie", session.cookie)
          .set("X-CSRF-Token", session.csrfToken)
          .send({ selectable: false })
          .expect(403)
          .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
      }

      // 편집이 막혔으니 값도 그대로다.
      const unchanged = await prisma.category.findUnique({ where: { id: category.id } });
      expect(unchanged?.selectable).toBe(true);
    });

    it("edits name/displayOrder/active/selectable and records an audit log with before/after", async () => {
      const session = await adminSession("admin");
      const category = await createTestCategory();

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ name: "이름 바꿈", displayOrder: 50_001, selectable: false })
        .expect(200);

      expect(response.body.category).toMatchObject({
        id: category.id,
        code: category.code,
        name: "이름 바꿈",
        displayOrder: 50_001,
        active: true,
        selectable: false
      });

      const auditEntry = await prisma.auditLog.findFirst({
        where: { action: "admin.category.update", targetId: category.id },
        orderBy: { createdAt: "desc" }
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.actorUserId).toBe(session.admin.id);
      expect(auditEntry?.targetType).toBe("categories");
      expect(auditEntry?.beforeJson).toMatchObject({ name: "테스트 카테고리", displayOrder: 50_000, selectable: true });
      expect(auditEntry?.afterJson).toMatchObject({ name: "이름 바꿈", displayOrder: 50_001, selectable: false });
    });

    it("round-trips a selectable toggle and that is exactly what the app's GET /categories reflects (CAT-124)", async () => {
      const session = await adminSession("admin");
      const category = await createTestCategory({ selectable: true });

      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/oauth-login")
        .send({ provider: "kakao", providerToken: `adm127-token-${randomUUID()}` })
        .expect(200);
      const accessToken = login.body.tokens.accessToken as string;

      const appCodes = async (includeAll = false) => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/categories${includeAll ? "?includeAll=1" : ""}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200);
        return (response.body.categories as { code: string }[]).map((row) => row.code);
      };

      expect(await appCodes()).toContain(category.code);

      // 숨김으로 토글 → 기본 목록에서 빠지지만 ?includeAll=1에는 남는다(이름 해석용).
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ selectable: false })
        .expect(200);
      expect(await appCodes()).not.toContain(category.code);
      expect(await appCodes(true)).toContain(category.code);

      // 다시 노출로 토글 → 원상복구.
      const restored = await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ selectable: true })
        .expect(200);
      expect(restored.body.category.selectable).toBe(true);
      expect(await appCodes()).toContain(category.code);
    });

    it("turning active OFF hides the category from the picker list but keeps it in ?includeAll=1 (F3 — 과거 지출 라벨 유지)", async () => {
      const session = await adminSession("admin");
      const category = await createTestCategory({ active: true, selectable: true });

      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/oauth-login")
        .send({ provider: "kakao", providerToken: `adm127-token-${randomUUID()}` })
        .expect(200);
      const accessToken = login.body.tokens.accessToken as string;

      const appRows = async (includeAll = false) => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/categories${includeAll ? "?includeAll=1" : ""}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200);
        return response.body.categories as { code: string; name: string; active: boolean; selectable: boolean }[];
      };

      expect((await appRows()).map((row) => row.code)).toContain(category.code);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ active: false })
        .expect(200);

      // 기본(고를 목록)에서는 빠진다.
      expect((await appRows()).map((row) => row.code)).not.toContain(category.code);

      // 전량 조회에는 남는다 — 이 목록이 이미 기록된 지출의 **이름 해석** 소스다.
      // 예전에는 여기서도 active=true로 걸러 과거 지출 라벨이 일제히 "기타"가 됐다.
      const allRow = (await appRows(true)).find((row) => row.code === category.code);
      expect(allRow).toBeDefined();
      expect(allRow).toMatchObject({ name: "테스트 카테고리", active: false, selectable: true });

      // 되돌리면 다시 고를 수 있다.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ active: true })
        .expect(200);
      expect((await appRows()).map((row) => row.code)).toContain(category.code);
    });

    it("refuses to touch identity columns and rejects empty/invalid payloads (DNC-007)", async () => {
      const session = await adminSession("admin");
      const category = await createTestCategory();

      // code/id는 DTO 화이트리스트 밖이라 전역 forbidNonWhitelisted가 400으로 막는다.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ code: "hijacked_code" })
        .expect(400);

      // 빈 본문 / 잘못된 값도 400.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({})
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ name: "", displayOrder: -1 })
        .expect(400);

      // F2: 공백만 있는 이름도 400이다. 예전에는 @MinLength(1)이 trim 전 값을 봐서 통과했고,
      // 서비스가 trim 후 빈 이름을 저장해 앱의 이름 해석이 그 카테고리 전량을 "기타"로 만들었다.
      for (const blankName of ["   ", "\t", "\n ", " 　 "]) {
        await request(app.getHttpServer())
          .patch(`/api/v1/admin/categories/${category.id}`)
          .set("Cookie", session.cookie)
          .set("X-CSRF-Token", session.csrfToken)
          .send({ name: blankName })
          .expect(400)
          .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
      }

      // 앞뒤 공백이 붙은 정상 이름은 통과하되 trim된 값이 저장된다(같은 @Transform의 결과).
      const trimmed = await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ name: "  공백 정리  " })
        .expect(200);
      expect(trimmed.body.category.name).toBe("공백 정리");
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ name: "테스트 카테고리" })
        .expect(200);

      const unchanged = await prisma.category.findUnique({ where: { id: category.id } });
      expect(unchanged).toMatchObject({ code: category.code, name: "테스트 카테고리", displayOrder: 50_000 });

      // 삭제 라우트 자체가 존재하지 않는다.
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/categories/${category.id}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .expect(404);
      expect(await prisma.category.findUnique({ where: { id: category.id } })).not.toBeNull();
    });

    it("404s an unknown category id", async () => {
      const session = await adminSession("admin");
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/categories/${randomUUID()}`)
        .set("Cookie", session.cookie)
        .set("X-CSRF-Token", session.csrfToken)
        .send({ selectable: false })
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe("CATEGORY_NOT_FOUND"));
    });
  });

  // -------------------------------------------------------------- users-lookup

  describe("GET /admin/users-lookup", () => {
    it("is admin-role-only: editor and analyst sessions get 403", async () => {
      for (const role of ["editor", "analyst"] as const) {
        const session = await adminSession(role);
        await request(app.getHttpServer())
          .get("/api/v1/admin/users-lookup?query=adm127")
          .set("Cookie", session.cookie)
          .expect(403)
          .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
      }
    });

    it("finds an end user by partial email or nickname with household/child summaries", async () => {
      const session = await adminSession("admin");
      const marker = randomUUID().slice(0, 8);
      const user = await createEndUser({ email: `adm127-${marker}@example.test`, displayName: `우리아이맘${marker}` });
      const { household, child } = await createHouseholdWithChild(user.id, `콩이${marker}`);

      for (const term of [`adm127-${marker}`, `우리아이맘${marker}`, `ADM127-${marker}`.toUpperCase()]) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/users-lookup?query=${encodeURIComponent(term)}`)
          .set("Cookie", session.cookie)
          .expect(200);
        const found = response.body.users.find((row: { id: string }) => row.id === user.id);
        expect(found, `term "${term}" should match`).toBeDefined();
        expect(found).toMatchObject({
          email: user.email,
          displayName: user.displayName,
          authProvider: "kakao",
          status: "active",
          deletedAt: null,
          expenseCount: 0
        });
        expect(found.lastLoginAt).not.toBeNull();
        expect(found.households).toHaveLength(1);
        expect(found.households[0]).toMatchObject({
          id: household.id,
          name: household.name,
          role: "owner",
          memberStatus: "active",
          isOwner: true
        });
        expect(found.households[0].children).toEqual([
          { id: child.id, nickname: child.nickname, stageMode: "born" }
        ]);
      }
    });

    it("exposes an expense COUNT only — never amounts, item names, phone numbers or other minimized PII", async () => {
      const session = await adminSession("admin");
      const marker = randomUUID().slice(0, 8);
      const user = await createEndUser({ email: `adm127-pii-${marker}@example.test`, displayName: `피아이${marker}` });
      const { household, child } = await createHouseholdWithChild(user.id, `봄이${marker}`);
      const category = await prisma.category.findFirstOrThrow({ where: { code: "etc" } });

      await prisma.expense.createMany({
        data: [
          {
            householdId: household.id,
            childId: child.id,
            createdByUserId: user.id,
            categoryId: category.id,
            amountKrw: 123_456,
            spentOn: new Date("2026-08-10T00:00:00.000Z"),
            itemName: "비밀 품목 ADM127"
          },
          {
            householdId: household.id,
            childId: child.id,
            createdByUserId: user.id,
            categoryId: category.id,
            amountKrw: 999_999,
            spentOn: new Date("2026-08-11T00:00:00.000Z"),
            itemName: "삭제된 품목 ADM127",
            // soft delete 된 지출은 세지 않는다 (DNC-014).
            deletedAt: new Date()
          }
        ]
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/users-lookup?query=${encodeURIComponent(`adm127-pii-${marker}`)}`)
        .set("Cookie", session.cookie)
        .expect(200);

      const found = response.body.users.find((row: { id: string }) => row.id === user.id);
      expect(found.expenseCount).toBe(1);

      const serialized = JSON.stringify(response.body);
      // 금액·품목은 물론, 최소화 대상 개인정보가 응답 어디에도 없어야 한다.
      for (const forbidden of [
        "123456",
        "999999",
        "비밀 품목 ADM127",
        "삭제된 품목 ADM127",
        "010-0000-0000",
        "adm127-avatar.png",
        user.providerUserId,
        "birthDate",
        "dueDate",
        "gender",
        "amountKrw",
        "phone",
        "providerUserId",
        "profileImageUrl"
      ]) {
        expect(serialized, `response must not leak "${forbidden}"`).not.toContain(forbidden);
      }
    });

    it("never returns staff (admin_users) accounts, only end users", async () => {
      const session = await adminSession("admin");
      const marker = randomUUID().slice(0, 8);
      const staffEmail = `adm127-staff-${marker}@wooriai.local`;
      await createAdmin(staffEmail, "editor");
      const endUser = await createEndUser({
        email: `adm127-staff-${marker}@example.test`,
        displayName: `스태프아님${marker}`
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/users-lookup?query=${encodeURIComponent(`adm127-staff-${marker}`)}`)
        .set("Cookie", session.cookie)
        .expect(200);

      expect(response.body.users.map((row: { id: string }) => row.id)).toEqual([endUser.id]);
      expect(JSON.stringify(response.body)).not.toContain(staffEmail);
    });

    it("requires a real search term — blank, 1-char and wildcard-only queries are rejected", async () => {
      const session = await adminSession("admin");

      for (const term of ["", "a", "%%", "%_%"]) {
        await request(app.getHttpServer())
          .get(`/api/v1/admin/users-lookup?query=${encodeURIComponent(term)}`)
          .set("Cookie", session.cookie)
          .expect(400)
          .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
      }

      // query 자체가 없으면 400.
      await request(app.getHttpServer())
        .get("/api/v1/admin/users-lookup")
        .set("Cookie", session.cookie)
        .expect(400);

      // limit 상한(50) 초과도 400.
      await request(app.getHttpServer())
        .get("/api/v1/admin/users-lookup?query=adm127&limit=51")
        .set("Cookie", session.cookie)
        .expect(400);
    });

    it("audits the lookup with a MASKED search term and result count — never the raw term or the looked-up PII (F1)", async () => {
      const session = await adminSession("admin");
      const marker = randomUUID().slice(0, 8);
      const user = await createEndUser({ email: `adm127-audit-${marker}@example.test`, displayName: `감사${marker}` });

      const term = `adm127-audit-${marker}`;
      await request(app.getHttpServer())
        .get(`/api/v1/admin/users-lookup?query=${encodeURIComponent(term)}`)
        .set("Cookie", session.cookie)
        .expect(200);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { action: "admin.user_lookup.search", actorUserId: session.admin.id },
        orderBy: { createdAt: "desc" }
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.targetType).toBe("users");
      // 앞 2자 + 길이만 남는다 — 원문 복원 불가.
      expect(auditEntry?.afterJson).toMatchObject({
        queryMasked: `ad***(${term.length}자)`,
        resultCount: 1
      });
      const serializedAudit = JSON.stringify(auditEntry?.afterJson);
      expect(serializedAudit).not.toContain(term);
      expect(serializedAudit).not.toContain(marker);
      // 조회된 사용자의 개인정보가 감사 로그의 두 번째 사본이 되면 안 된다.
      expect(serializedAudit).not.toContain(user.displayName as string);
      expect(serializedAudit).not.toContain(user.email as string);
    });

    it("keeps the raw term out of the audit VIEWER too — the CSV export reads that same payload (F1)", async () => {
      const session = await adminSession("admin");
      const marker = randomUUID().slice(0, 8);
      await createEndUser({ email: `adm127-viewer-${marker}@example.test`, displayName: `뷰어${marker}` });

      const term = `adm127-viewer-${marker}@example.test`;
      await request(app.getHttpServer())
        .get(`/api/v1/admin/users-lookup?query=${encodeURIComponent(term)}`)
        .set("Cookie", session.cookie)
        .expect(200);

      // 어드민 감사 뷰어(ADM-113). CSV 내보내기는 이 응답의 before/after를 그대로 직렬화하므로
      // (apps/admin/src/lib/audit-log-csv.ts), 여기서 안 나오면 CSV로도 안 나간다.
      const viewer = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?action=admin.user_lookup.search&actorUserId=${session.admin.id}&limit=5`)
        .set("Cookie", session.cookie)
        .expect(200);

      const serializedViewer = JSON.stringify(viewer.body);
      expect(serializedViewer).toContain(`ad***(${term.length}자)`);
      expect(serializedViewer).not.toContain(term);
      expect(serializedViewer).not.toContain(marker);
    });

    it("is read-only: there is no write route under /admin/users-lookup", async () => {
      const session = await adminSession("admin");
      const marker = randomUUID().slice(0, 8);
      const user = await createEndUser({ email: `adm127-ro-${marker}@example.test`, displayName: `읽기${marker}` });

      for (const method of ["patch", "post", "delete"] as const) {
        await request(app.getHttpServer())
          [method](`/api/v1/admin/users-lookup/${user.id}`)
          .set("Cookie", session.cookie)
          .set("X-CSRF-Token", session.csrfToken)
          .send({ status: "blocked" })
          .expect(404);
      }

      const unchanged = await prisma.user.findUnique({ where: { id: user.id } });
      expect(unchanged?.status).toBe("active");
    });
  });
});
