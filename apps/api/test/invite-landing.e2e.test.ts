import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

// L8: public HTML landing page for invite links -- GET /invite/:token, OUTSIDE the
// api/v1 prefix, matching the URL createInvite hands out
// (`${INVITE_LINK_BASE_URL}/invite/${token}`).
describe("Public invite landing page (GET /invite/:token)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function login() {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `invite-landing-${randomUUID()}` })
      .expect(200);
    return {
      accessToken: response.body.tokens.accessToken as string,
      householdId: response.body.user.households[0].id as string
    };
  }

  async function createInviteToken(accessToken: string, householdId: string) {
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const token = invite.body.inviteUrl.split("/invite/")[1] as string;
    expect(token).toBeTruthy();
    return token;
  }

  it("renders the household name and the app deep link for a valid pending invite (HTML, 200, no auth)", async () => {
    const { accessToken, householdId } = await login();
    const token = await createInviteToken(accessToken, householdId);

    const response = await request(app.getHttpServer()).get(`/invite/${token}`).expect(200);

    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.text).toContain("우리 가족");
    expect(response.text).toContain("우리아이 앱에서 초대를 수락하세요");
    // Deep link must mirror the mobile expo-router route app/family/accept/[token].tsx.
    expect(response.text).toContain(`href="wooriai://family/accept/${token}"`);
    // 앱 미설치 안내 문구.
    expect(response.text).toContain("앱 설치 후 이 링크를 다시 열면 초대를 수락할 수 있어요");
  });

  it("HTML-escapes the household name (no raw markup from user-controlled names)", async () => {
    const { accessToken, householdId } = await login();
    await prisma.household.update({
      where: { id: householdId },
      data: { name: '<img src=x onerror="alert(1)">&가족' }
    });
    const token = await createInviteToken(accessToken, householdId);

    const response = await request(app.getHttpServer()).get(`/invite/${token}`).expect(200);
    expect(response.text).not.toContain("<img src=x");
    expect(response.text).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;가족");
  });

  it("renders the same generic 200 page for a bogus token (no existence oracle, no deep link)", async () => {
    const response = await request(app.getHttpServer()).get(`/invite/${randomUUID()}`).expect(200);

    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.text).toContain("초대가 만료되었거나 유효하지 않아요");
    expect(response.text).not.toContain("wooriai://family/accept/");
    expect(response.text).not.toContain("우리 가족");
  });

  it("renders that same generic page for an expired invite (indistinguishable from a bogus token)", async () => {
    const { accessToken, householdId } = await login();
    const token = await createInviteToken(accessToken, householdId);
    // chk_household_invites_expiry requires expiresAt after createdAt, so age both.
    await prisma.householdInvite.updateMany({
      where: { householdId },
      data: {
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8),
        expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
      }
    });

    const expired = await request(app.getHttpServer()).get(`/invite/${token}`).expect(200);
    const bogus = await request(app.getHttpServer()).get(`/invite/${randomUUID()}`).expect(200);
    expect(expired.text).toBe(bogus.text);
    expect(expired.text).toContain("초대가 만료되었거나 유효하지 않아요");
  });

  it("leaves the api/v1 routes unaffected: JSON invite lookup still works and the landing page is not under the prefix", async () => {
    const { accessToken, householdId } = await login();
    const token = await createInviteToken(accessToken, householdId);

    // The JSON API (plural /invites) keeps its prefix and behavior.
    await request(app.getHttpServer())
      .get(`/api/v1/invites/${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.householdName).toBe("우리 가족"));

    // The HTML landing page is NOT additionally mounted under api/v1.
    await request(app.getHttpServer()).get(`/api/v1/invite/${token}`).expect(404);
  });
});
