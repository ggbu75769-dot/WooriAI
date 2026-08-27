import { HttpException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";
import { PrismaService } from "../src/prisma/prisma.service";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// See admin-settings.e2e.test.ts's login() comment: a random suffix keeps dev-login
// isolated per test run against the persistent Postgres database.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function householdIdFor(app: INestApplication, accessToken: string) {
  return (
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
  ).body.households[0].id as string;
}

async function userIdFor(app: INestApplication, accessToken: string) {
  return (
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
  ).body.user.id as string;
}

/**
 * FIX-121A(F5) 경합 재현 도구. Prisma 모델 delegate에 vi.spyOn을 걸면 restore 후
 * 클라이언트가 망가지므로(push-dispatch.db.test.ts의 같은 주석 참고), 서비스가
 * 실제로 쓰는 delegate 메서드만 옮겨 담은 얄팍한 대역 prisma를 만든다. 지정한
 * "읽기" 메서드가 값을 돌려주기 **직전**에 `onRead`를 실행해, 서비스가 이미 읽어
 * 둔 스냅샷이 낡은 상태가 되는 실제 인터리빙을 결정적으로 만든다.
 *
 * 대역은 통과(pass-through)일 뿐이라 실제 DB에 그대로 쓰고, 수정 전/후 코드가
 * 각각 쓰는 `update`와 `updateMany`가 모두 살아 있다 — 그래서 "무슨 메서드를
 * 불렀나"가 아니라 "행이 어떤 상태로 남았나"로 회귀를 판정할 수 있다.
 */
function prismaRacingOnInviteRead(
  prisma: PrismaService,
  readMethod: "findFirst" | "findUnique",
  onRead: () => Promise<void>
): PrismaService {
  const invites = prisma.householdInvite;
  const raced: Record<string, (args: never) => Promise<unknown>> = {
    findFirst: (args) => invites.findFirst(args),
    findUnique: (args) => invites.findUnique(args),
    update: (args) => invites.update(args),
    updateMany: (args) => invites.updateMany(args)
  };

  const passthrough = raced[readMethod];
  let alreadyRaced = false;
  raced[readMethod] = async (args) => {
    const result = await passthrough(args);
    if (!alreadyRaced) {
      alreadyRaced = true;
      await onRead();
    }
    return result;
  };

  return { household: prisma.household, householdInvite: raced } as unknown as PrismaService;
}

/**
 * E4 계측용 대역. 위 `prismaRacingOnInviteRead`와 같은 이유로 vi.spyOn 대신 서비스가
 * 실제로 쓰는 delegate만 옮겨 담은 통과(pass-through) 대역을 만들고, `users` 읽기 횟수만
 * 센다 — "몇 번 조회하나"가 곧 N+1 회귀 판정 기준이다.
 */
function prismaCountingUserReads(prisma: PrismaService, counts: { findUnique: number; findMany: number }): PrismaService {
  return {
    householdMember: prisma.householdMember,
    user: {
      findUnique: (args: never) => {
        counts.findUnique += 1;
        return prisma.user.findUnique(args);
      },
      findMany: (args: never) => {
        counts.findMany += 1;
        return prisma.user.findMany(args);
      }
    }
  } as unknown as PrismaService;
}

/** listMembers가 쓰는 정렬 순서(서비스의 roleOrder와 같은 규칙)의 테스트측 복제본. */
function roleOrder(role: string) {
  if (role === "owner") return 0;
  if (role === "co_parent") return 1;
  if (role === "viewer") return 2;
  return 3;
}

/** 초대 토큰은 sha256 해시로만 저장된다(createInvite) — 생성 응답의 토큰으로 행을 되찾는다. */
function inviteRowFor(prisma: PrismaService, inviteToken: string) {
  return prisma.householdInvite.findUniqueOrThrow({
    where: { inviteTokenHash: createHash("sha256").update(inviteToken).digest("hex") }
  });
}

/** 서비스를 직접 부를 때의 에러 판정 (import-parser-inference.test.ts와 같은 관례). */
async function expectRejectedWithCode(promise: Promise<unknown>, code: string) {
  const caught = await promise.then(
    () => null,
    (error: unknown) => error
  );
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getResponse()).toMatchObject({ code });
}

async function completeOwnerOnboarding(app: INestApplication, accessToken: string) {
  const householdId = await householdIdFor(app, accessToken);

  await request(app.getHttpServer())
    .put("/api/v1/consents")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      consents: [
        { type: "terms", version: "2026-07-06", accepted: true },
        { type: "privacy", version: "2026-07-06", accepted: true }
      ]
    })
    .expect(200);

  const childId = (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        householdId,
        nickname: "튼튼이",
        stageMode: "manual",
        manualStage: "infant_4_6"
      })
      .expect(200)
  ).body.id as string;

  await request(app.getHttpServer())
    .post(`/api/v1/children/${childId}/prepared-items`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ itemTemplateIds: [] })
    .expect(200);

  await request(app.getHttpServer())
    .put(`/api/v1/children/${childId}/budget`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ yearMonth: "2026-07-01", amountKrw: 300000 })
    .expect(200);

  return { householdId, childId };
}

function tokenFromInviteUrl(inviteUrl: string) {
  const token = inviteUrl.split("/invite/")[1];
  expect(token).toBeTruthy();
  return token;
}

describe("Family invites and household RBAC", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("lets an owner invite a co-parent whose expense is reflected in the same child report", async () => {
    const ownerToken = await login(app, "batch08-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members).toEqual([
          expect.objectContaining({
            householdId,
            role: "owner",
            status: "active"
          })
        ]);
      });

    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);

    expect(inviteResponse.body).toMatchObject({
      inviteUrl: expect.stringContaining("/invite/"),
      expiresAt: expect.any(String)
    });
    const inviteToken = tokenFromInviteUrl(inviteResponse.body.inviteUrl);

    await request(app.getHttpServer())
      .get(`/api/v1/invites/${inviteToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          householdName: "우리 가족",
          role: "co_parent",
          expiresAt: inviteResponse.body.expiresAt
        });
      });

    const coParentToken = await login(app, "batch08-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household).toMatchObject({
          id: householdId,
          name: "우리 가족",
          role: "co_parent"
        });
      });

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.children).toEqual([expect.objectContaining({ id: childId })]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({
        categoryId,
        amountKrw: 42000,
        spentOn: "2026-07-06",
        itemName: "공동부모 기저귀",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(42000);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(403);
  });

  it("rejects an existing active member re-accepting an invite instead of overwriting their role (owner lockout regression)", async () => {
    const ownerToken = await login(app, "batch08-self-invite-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("HOUSEHOLD_ALREADY_MEMBER");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members).toEqual([
          expect.objectContaining({ householdId, role: "owner", status: "active" })
        ]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
  });

  it("allows viewer report access but blocks viewer expense writes and invite creation", async () => {
    const ownerToken = await login(app, "batch08-viewer-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);
    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    const viewerToken = await login(app, "batch08-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household.role).toBe("viewer");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        categoryId,
        amountKrw: 12000,
        spentOn: "2026-07-06",
        itemName: "viewer blocked",
        paymentMethod: "card"
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(403);
  });

  it("lists only still-usable pending invites for the owner and never re-exposes the invite token", async () => {
    const ownerToken = await login(app, "fam121b-list-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites).toEqual([]);
      });

    const coParentInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    const listed = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites as Array<Record<string, unknown>>;

    expect(listed).toHaveLength(2);
    expect(listed.map((invite) => invite.role).sort()).toEqual(["co_parent", "viewer"]);
    for (const invite of listed) {
      expect(invite).toMatchObject({
        householdId,
        status: "pending",
        channel: "link",
        canReshareLink: false,
        expiresAt: expect.any(String),
        createdAt: expect.any(String)
      });
      // The plaintext token only ever exists in the create response; the row keeps a
      // sha256 hash, so the listing must not leak a token, a hash, or a usable link.
      const serialized = JSON.stringify(invite);
      expect(serialized).not.toContain("/invite/");
      expect(serialized.toLowerCase()).not.toContain("token");
      expect(serialized).not.toContain(tokenFromInviteUrl(coParentInvite.body.inviteUrl));
      expect(serialized).not.toContain(tokenFromInviteUrl(viewerInvite.body.inviteUrl));
    }

    // An accepted invite drops out of the pending listing.
    const coParentToken = await login(app, "fam121b-list-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(coParentInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites.map((invite: { role: string }) => invite.role)).toEqual(["viewer"]);
      });

    // Non-owner members cannot see the household's pending invites.
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    const outsiderToken = await login(app, "fam121b-list-outsider");
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it("lets an owner cancel a pending invite, which then stops working and disappears from the listing", async () => {
    const ownerToken = await login(app, "fam121b-cancel-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    const invite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const inviteToken = tokenFromInviteUrl(invite.body.inviteUrl);

    const inviteId = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites[0].id as string;

    const otherOwnerToken = await login(app, "fam121b-cancel-other-owner");
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_FOUND");
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites).toEqual([]);
      });

    // The cancelled link is dead for both preview and acceptance.
    await request(app.getHttpServer())
      .get(`/api/v1/invites/${inviteToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });

    const inviteeToken = await login(app, "fam121b-cancel-invitee");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });

    // Cancelling twice is rejected rather than silently succeeding.
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });
  });

  /**
   * FIX-121A(F5) 회귀. cancelInvite의 lazy-expiry는 원래 무조건 `update({ where: { id } })`
   * 였다 — 초대를 pending으로 읽은 직후 acceptInvite의 CAS가 커밋되면, 이미
   * `accepted`가 된(= 멤버십까지 생긴) 행을 `expired`로 덮어썼다. "TTL이 막 지난
   * 초대를 취소한다"가 정확히 이 분기를 타는 시점이라 가설상의 창이 아니다.
   *
   * 아래는 그 인터리빙을 결정적으로 재현한다: cancelInvite의 읽기가 값을 돌려주기
   * 직전에 acceptInvite와 동일한 CAS(pending -> accepted)를 커밋시킨 뒤, 실제 DB
   * 행이 어떤 상태로 남는지로 판정한다. 수정 전에는 `expired`로 덮였고, 수정 후에는
   * 같은 `updateMany({ where: { id, status: "pending" } })` CAS라 0건이 되어
   * `accepted`가 살아남는다(호출자는 그대로 INVITE_NOT_PENDING).
   */
  it("FIX-121A(F5): 만료 표시가 동시에 수락된 초대를 덮어쓰지 않는다 (cancelInvite)", async () => {
    const ownerToken = await login(app, "fix121a-race-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);
    const ownerUserId = await userIdFor(app, ownerToken);
    const inviteeUserId = await userIdFor(app, await login(app, "fix121a-race-invitee"));

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);

    const prisma = app.get(PrismaService);
    const runtime = app.get(HouseholdRuntimeService);
    const invite = await prisma.householdInvite.findFirstOrThrow({ where: { householdId, status: "pending" } });

    // TTL이 막 지난 상태 — cancelInvite가 lazy-expiry 분기를 타게 만든다.
    // `chk_household_invites_expiry (expires_at > created_at)` 때문에 생성 시각도 함께 과거로.
    await prisma.householdInvite.update({
      where: { id: invite.id },
      data: { createdAt: new Date(Date.now() - 2_000), expiresAt: new Date(Date.now() - 1_000) }
    });

    const racingRuntime = new HouseholdRuntimeService(
      prismaRacingOnInviteRead(prisma, "findFirst", async () => {
        // acceptInvite가 트랜잭션 첫 문장으로 수행하는 CAS 그대로.
        const claimed = await prisma.householdInvite.updateMany({
          where: { id: invite.id, status: "pending" },
          data: { status: "accepted", acceptedByUserId: inviteeUserId, acceptedAt: new Date() }
        });
        expect(claimed.count).toBe(1);
      })
    );

    const owner = await runtime.enrichUser({
      id: ownerUserId,
      displayName: "owner",
      email: null,
      status: "active",
      households: []
    });

    await expectRejectedWithCode(racingRuntime.cancelInvite(owner, householdId, invite.id), "INVITE_NOT_PENDING");

    // 핵심 단언: 수락 결과가 살아 있어야 한다. 덮어썼다면 "멤버십은 생겼는데
    // 초대는 만료"라는 모순 상태가 남는다.
    const after = await prisma.householdInvite.findFirstOrThrow({ where: { id: invite.id } });
    expect(after.status).toBe("accepted");
    expect(after.acceptedByUserId).toBe(inviteeUserId);
  });

  /**
   * 같은 lazy-expiry 패턴을 쓰는 나머지 경로를 통일했는지 고정한다.
   * `requirePendingInvite`(getInvite/acceptInvite의 사전 조회)도 무조건 update였다.
   * listInvites는 처음부터 `updateMany({ status: "pending" })` CAS라 기준 형태다.
   */
  it("FIX-121A(F5): 초대 조회의 lazy-expiry도 같은 CAS라 accepted를 덮지 않는다", async () => {
    const ownerToken = await login(app, "fix121a-race2-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);
    const inviteeUserId = await userIdFor(app, await login(app, "fix121a-race2-invitee"));

    const created = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const inviteToken = tokenFromInviteUrl(created.body.inviteUrl);

    const prisma = app.get(PrismaService);
    const invite = await prisma.householdInvite.findFirstOrThrow({ where: { householdId, status: "pending" } });
    await prisma.householdInvite.update({
      where: { id: invite.id },
      data: { createdAt: new Date(Date.now() - 2_000), expiresAt: new Date(Date.now() - 1_000) }
    });

    const racingRuntime = new HouseholdRuntimeService(
      prismaRacingOnInviteRead(prisma, "findUnique", async () => {
        await prisma.householdInvite.updateMany({
          where: { id: invite.id, status: "pending" },
          data: { status: "accepted", acceptedByUserId: inviteeUserId, acceptedAt: new Date() }
        });
      })
    );

    await expectRejectedWithCode(racingRuntime.getInvite(inviteToken), "INVITE_NOT_PENDING");

    const after = await prisma.householdInvite.findFirstOrThrow({ where: { id: invite.id } });
    expect(after.status).toBe("accepted");
  });

  it("lets an owner force-remove a member; blocks non-owners and self-removal, and revokes access", async () => {
    const ownerToken = await login(app, "batch08-remove-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);

    const coParentInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const coParentToken = await login(app, "batch08-remove-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(coParentInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200);

    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const viewerToken = await login(app, "batch08-remove-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    const membersBefore = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.members as Array<{ id: string; role: string }>;

    const ownerMemberId = membersBefore.find((member) => member.role === "owner")!.id;
    const coParentMemberId = membersBefore.find((member) => member.role === "co_parent")!.id;
    const viewerMemberId = membersBefore.find((member) => member.role === "viewer")!.id;

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${viewerMemberId}`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${coParentMemberId}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${ownerMemberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN");
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${coParentMemberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members.map((member: { id: string }) => member.id)).not.toContain(coParentMemberId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({
        categoryId,
        amountKrw: 10000,
        spentOn: "2026-07-06",
        itemName: "removed member blocked",
        paymentMethod: "card"
      })
      .expect(403);
  });

  /**
   * E4 회귀. listMembers는 멤버마다 `user.findUnique`를 돌리는 N+1이었다(6인 가구 = 7 쿼리).
   * 이제 `id IN (...)` 한 번으로 이름을 모아 오는데, 성능만 바꾸고 응답은 한 글자도 달라지면
   * 안 되므로 (a) 사용자 조회 횟수와 (b) 예전 방식(멤버별 findUnique)으로 만든 DTO와의 동치,
   * (c) HTTP 응답 본문과의 동치를 함께 고정한다.
   */
  it("E4: listMembers가 멤버 수와 무관하게 사용자 조회를 1회로 배치한다 (응답 동치)", async () => {
    const ownerToken = await login(app, "e4-batch-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);
    const ownerUserId = await userIdFor(app, ownerToken);

    for (const [role, providerToken] of [
      ["co_parent", "e4-batch-co-parent"],
      ["viewer", "e4-batch-viewer"]
    ] as const) {
      const invite = await request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role, channel: "link" })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/invites/${tokenFromInviteUrl(invite.body.inviteUrl)}/accept`)
        .set("Authorization", `Bearer ${await login(app, providerToken)}`)
        .expect(200);
    }

    const prisma = app.get(PrismaService);
    const runtime = app.get(HouseholdRuntimeService);
    const owner = await runtime.enrichUser({
      id: ownerUserId,
      displayName: "owner",
      email: null,
      status: "active",
      households: []
    });

    const counts = { findUnique: 0, findMany: 0 };
    const batched = await new HouseholdRuntimeService(prismaCountingUserReads(prisma, counts)).listMembers(owner, householdId);

    expect(batched.members).toHaveLength(3);
    // 멤버가 3명이어도 사용자 조회는 정확히 한 번(배치)이어야 한다 — 예전에는 3번이었다.
    expect(counts).toEqual({ findUnique: 0, findMany: 1 });
    // 배치가 실제로 이름을 채웠는지(전부 빈 문자열로 퇴화하지 않았는지) 확인.
    expect(batched.members.every((member) => member.displayName.length > 0)).toBe(true);

    // 동치 1: 예전 구현(멤버 행마다 user.findUnique)이 만들던 DTO와 완전히 같아야 한다.
    const rows = await prisma.householdMember.findMany({
      where: { householdId, status: { in: ["active", "pending"] } }
    });
    const perMember = await Promise.all(
      rows.map(async (member) => {
        const memberUser = await prisma.user.findUnique({ where: { id: member.userId } });
        return {
          id: member.id,
          householdId: member.householdId,
          userId: member.userId,
          displayName: memberUser?.displayName ?? "",
          role: member.role,
          status: member.status,
          joinedAt: member.joinedAt?.toISOString() ?? null
        };
      })
    );
    perMember.sort((left, right) => roleOrder(left.role) - roleOrder(right.role));
    expect(batched.members).toEqual(perMember);
    expect(batched.members.map((member) => member.role)).toEqual(["owner", "co_parent", "viewer"]);

    // 동치 2: 실제 엔드포인트 응답 본문도 그대로다(직렬화 포함).
    const httpMembers = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.members;
    expect(httpMembers).toEqual(batched.members);
  });

  /**
   * G2: 초대 TTL 경계. 지금까지 e2e는 "갓 만든 초대"와 "취소된 초대"만 다뤘고, 실제 사용자가
   * 가장 흔하게 부딪히는 만료 경계(`expiresAt <= now`)는 FIX-121A의 경합 테스트가 부수적으로
   * 스쳐 갈 뿐 수락/목록/취소 세 경로 모두를 직접 확인한 적이 없었다.
   *
   * 만료 직전(아직 pending)과 직후를 같은 가구에서 나란히 세우고, 직후의 세 경로가 모두
   * INVITE_NOT_PENDING으로 닫히는지 + lazy expiry가 행을 `expired`로 남기는지(취소 경로는
   * `revoked`로 바꾸지 않는지)까지 본다.
   */
  it("G2: 만료 경계 — 직전 초대는 수락되고, 직후 초대는 수락·목록·취소 모두에서 닫힌다", async () => {
    const ownerToken = await login(app, "g2-expiry-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);
    const prisma = app.get(PrismaService);

    const createInvite = async (role: "co_parent" | "viewer" | "gift_participant") => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role, channel: "link" })
        .expect(200);
      const inviteToken = tokenFromInviteUrl(created.body.inviteUrl);
      return { inviteToken, row: await inviteRowFor(prisma, inviteToken) };
    };

    /**
     * `chk_household_invites_expiry (expires_at > created_at)` 때문에 만료 시각을 과거로
     * 옮길 때는 생성 시각도 함께 옮긴다(기존 FIX-121A 테스트와 같은 방식).
     */
    const shiftExpiry = (id: string, expiresInMs: number) =>
      prisma.householdInvite.update({
        where: { id },
        data: {
          createdAt: new Date(Date.now() + Math.min(expiresInMs, 0) - 2_000),
          expiresAt: new Date(Date.now() + expiresInMs)
        }
      });

    // --- 만료 직전: 아직 유효하므로 목록에도 남고 수락도 된다. -------------------
    // 30초는 이 테스트가 도는 동안 경계를 넘지 않게 두는 여유일 뿐, 판정 대상은
    // `expiresAt > now` 술어의 "아직 살아 있는 쪽"이다.
    const almost = await createInvite("co_parent");
    await shiftExpiry(almost.row.id, 30_000);

    const pendingList = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites as Array<{ id: string }>;
    expect(pendingList.map((invite) => invite.id)).toContain(almost.row.id);
    // 목록 조회의 lazy expiry가 아직 살아 있는 초대를 건드리지 않았다.
    expect((await prisma.householdInvite.findUniqueOrThrow({ where: { id: almost.row.id } })).status).toBe("pending");

    await request(app.getHttpServer()).get(`/api/v1/invites/${almost.inviteToken}`).expect(200);
    const inviteeToken = await login(app, "g2-expiry-invitee");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${almost.inviteToken}/accept`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household).toMatchObject({ id: householdId, role: "co_parent" });
      });

    // --- 만료 직후(1) 수락 경로: 미리보기도 수락도 닫히고 행은 expired가 된다. ----
    const lapsedAccept = await createInvite("viewer");
    await shiftExpiry(lapsedAccept.row.id, -1_000);

    await request(app.getHttpServer())
      .get(`/api/v1/invites/${lapsedAccept.inviteToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });
    expect((await prisma.householdInvite.findUniqueOrThrow({ where: { id: lapsedAccept.row.id } })).status).toBe("expired");

    const lateToken = await login(app, "g2-expiry-late-invitee");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${lapsedAccept.inviteToken}/accept`)
      .set("Authorization", `Bearer ${lateToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });
    // 수락이 실패했으므로 멤버십도 생기면 안 된다(만료 초대로 조용히 가족에 들어오는 일 금지).
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${lateToken}`)
      .expect(403);

    // --- 만료 직후(2) 목록 경로: 감춰지고, 조회 자체가 행을 expired로 정리한다. ---
    const lapsedList = await createInvite("gift_participant");
    await shiftExpiry(lapsedList.row.id, -1_000);

    const listedAfterExpiry = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites as Array<{ id: string }>;
    expect(listedAfterExpiry.map((invite) => invite.id)).not.toContain(lapsedList.row.id);
    // 이미 수락된 만료-직전 초대까지 합쳐, 이 시점에 남는 pending 초대는 하나도 없다.
    expect(listedAfterExpiry).toEqual([]);
    expect((await prisma.householdInvite.findUniqueOrThrow({ where: { id: lapsedList.row.id } })).status).toBe("expired");

    // --- 만료 직후(3) 취소 경로: 400이고, 행은 revoked가 아니라 expired로 남는다. --
    const lapsedCancel = await createInvite("viewer");
    await shiftExpiry(lapsedCancel.row.id, -1_000);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${lapsedCancel.row.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });
    const afterCancelAttempt = await prisma.householdInvite.findUniqueOrThrow({ where: { id: lapsedCancel.row.id } });
    expect(afterCancelAttempt.status).toBe("expired");
    expect(afterCancelAttempt.acceptedByUserId).toBeNull();
  });
});
