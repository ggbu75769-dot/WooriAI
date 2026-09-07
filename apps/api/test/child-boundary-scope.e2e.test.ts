import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { errorResponseSchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 라운드 108 트랙 C(C-6) — **미고정 경계 셋.**
 *
 * 권한 경계 정찰이 "코드는 안전한데 그 안전을 재는 테스트가 없다"고 이름으로 적은 세 자리다.
 * 셋 다 오늘 통과하며, 이 파일의 값어치는 통과가 아니라 **떼면 빨개진다**는 데 있다.
 *
 *   ① `POST /children/:childId/prepared-items`
 *      온보딩의 마지막 단계(준비물 초기 선택). `requireChildAccess(user, childId, true)`를 타는데
 *      교차가구 e2e가 0건이었다. 이 경로는 그 아이의 `preparedItemsSetAt`과
 *      `child_item_statuses`를 **쓰므로**, 뚫리면 남의 아이 준비템 상태가 통째로 덮인다.
 *
 *   ② `GET /home?childId=`
 *      앱이 가장 자주 부르는 경로이고 응답에 **최근 지출 3건이 그대로 실린다**(품목명·금액).
 *      `getHome`의 첫 줄이 `requireChildAccess`이고 그 순서가 계약이지만
 *      ("no data reads happen for a child the caller is not allowed to see"),
 *      낯선 토큰으로 부른 테스트가 없었다.
 *
 *   ③ `HouseholdRoleGuard`의 **본문 분기**
 *      가드는 `params.householdId → body.householdId → query.householdId` 순으로 가구를 찾는다.
 *      그런데 유닛 테스트 픽스처(`household-role.guard.test.ts`)는 `params.householdId`만 세워서,
 *      **실제로 그 가드를 쓰는 유일한 쓰기 경로인 `POST /children`이 타는 본문 분기**의 부정
 *      케이스가 어느 테스트에도 없었다. 그 분기가 죽으면 남의 가구에 아이를 만들 수 있다.
 *      (`params` 분기는 `custom-categories` 경로가 URL로 쓰므로 그쪽 e2e가 이미 덮는다.)
 *
 * 기대값은 전부 리터럴이고, 거절마다 **부정 단언**(그 요청이 아무것도 쓰지 않았다)을 함께 둔다.
 */
describe("라운드 108 C-6 — 아이·가구 경계 셋", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  async function login(prefix: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `${prefix}-${randomUUID()}` })
      .expect(200);
    return response.body.tokens.accessToken as string;
  }

  async function completeOnboarding(accessToken: string) {
    const householdId = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
    ).body.households[0].id as string;

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
        .send({ householdId, nickname: "경계아이", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    return { householdId, childId };
  }

  async function inviteViewer(ownerToken: string, householdId: string, prefix: string) {
    const inviteUrl = (
      await request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "viewer", channel: "link" })
        .expect(200)
    ).body.inviteUrl as string;

    const viewerToken = await login(prefix);
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteUrl.split("/invite/")[1]}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);
    return viewerToken;
  }

  it("① 준비템 초기 선택은 남의 가구 아이에게 쓸 수 없고, 뷰어도 쓸 수 없다", async () => {
    const ownerToken = await login("c6-prepared-owner");
    const { householdId, childId } = await completeOnboarding(ownerToken);

    // 주인이 먼저 한 번 세워 둔다 — 뒤의 부정 단언이 "덮이지 않았다"를 잴 기준선이다.
    const templateIds = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=all`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.items.slice(0, 2).map((item: { id: string }) => item.id) as string[];
    expect(templateIds).toHaveLength(2);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ itemTemplateIds: templateIds })
      .expect(200);

    const prisma = app.get(PrismaService);
    const preparedCount = () => prisma.childItemStatus.count({ where: { childId, status: "prepared" } });
    expect(await preparedCount()).toBe(2);
    const setAtBefore = (await prisma.child.findUnique({ where: { id: childId } }))?.preparedItemsSetAt;
    expect(setAtBefore).not.toBeNull();

    // 남의 가구 사람이 빈 목록으로 덮으려 한다(= 준비 표시를 지우는 요청).
    const strangerToken = await login("c6-prepared-stranger");
    await completeOnboarding(strangerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ itemTemplateIds: [] })
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });

    // 같은 가구의 뷰어도 막힌다 — 이 경로는 편집 권한(edit=true)을 요구한다.
    const viewerToken = await inviteViewer(ownerToken, householdId, "c6-prepared-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ itemTemplateIds: [] })
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });

    // 부정 단언: 거절당한 두 요청은 준비템 상태도 `preparedItemsSetAt`도 건드리지 않았다.
    expect(await preparedCount()).toBe(2);
    expect((await prisma.child.findUnique({ where: { id: childId } }))?.preparedItemsSetAt).toEqual(setAtBefore);
  });

  it("② 홈은 남의 가구 아이로 부를 수 없고, 거절 응답에 그 아이의 지출이 실리지 않는다", async () => {
    const ownerToken = await login("c6-home-owner");
    const { childId } = await completeOnboarding(ownerToken);

    const itemName = "홈경계 유모차";
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        amountKrw: 390000,
        spentOn: "2026-07-06",
        itemName
      })
      .expect(200);

    const strangerToken = await login("c6-home-stranger");
    await completeOnboarding(strangerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
        // 홈 응답은 최근 지출 3건을 그대로 싣는다 — 거절 봉투에 그 값이 새면 403이 무의미하다.
        const serialized = JSON.stringify(body);
        expect(serialized).not.toContain(itemName);
        expect(serialized).not.toContain("390000");
      });

    // 없는 아이는 404, 토큰이 없으면 401, `childId`가 UUID가 아니면 400 — 거절의 이웃 갈래들.
    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${randomUUID()}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_NOT_FOUND");
      });
    await request(app.getHttpServer()).get(`/api/v1/home?childId=${childId}`).expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/home?childId=not-a-uuid")
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(400);

    // 주인은 같은 경로로 그대로 본다 — 막힌 것은 가구 경계이지 엔드포인트가 아니다.
    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.recentExpenses[0].itemName).toBe(itemName);
      });
  });

  /**
   * ⚠️ 역돌연변이로 실측한 사실(라운드 108 트랙 C) — **이 경로는 방어가 두 겹이다.**
   * 가드의 본문 분기를 지워도(가드가 소속·역할을 보지 않게 해도) 이 테스트는 초록이었다.
   * `OnboardingCoreService.createChild`가 `memberRoleFor(user, input.householdId)` +
   * `canEdit`으로 **같은 판정을 한 번 더** 하기 때문이다. 반대로 서비스 쪽 검사만 지우면
   * 가드가 홀로 막아 역시 초록이었고, **둘을 다 지웠을 때** 200이 되어 빨개졌다.
   *
   * 그래서 이 테스트가 고정하는 것은 "어느 한 겹"이 아니라 **HTTP 경계에서의 결과**다 —
   * 남의 가구 id를 본문에 실은 요청은 403이고 그 가구에 아이가 늘지 않는다. 한 겹만 재는
   * 테스트를 쓰면 나머지 한 겹을 지우는 변경이 조용히 통과하므로, 여기서는 두 겹의 합을 잰다.
   * (가드 자신의 분기 선택 로직은 `household-role.guard.test.ts`의 유닛 테스트가 본다 —
   *  그 픽스처가 `params.householdId`만 세운다는 것이 C-6이 지목한 빈자리이고, 이 e2e가
   *  실제 본문 분기를 지나는 요청으로 그 빈자리를 메운다.)
   */
  it("③ HouseholdRoleGuard의 본문 분기: 남의 가구 id로도 뷰어 역할로도 아이를 만들 수 없다", async () => {
    const ownerToken = await login("c6-guard-owner");
    const { householdId } = await completeOnboarding(ownerToken);

    const prisma = app.get(PrismaService);
    const childrenIn = () => prisma.child.count({ where: { householdId } });
    expect(await childrenIn()).toBe(1);

    const body = { nickname: "침입아이", stageMode: "manual", manualStage: "infant_4_6" };

    // ⓐ 남의 가구 id를 **본문에** 실은 요청. 이 경로에는 `:householdId` 경로 파라미터가 없으므로
    //    가드가 실제로 보는 것은 `request.body.householdId`뿐이다 — 그 분기가 여기서 재진다.
    const strangerToken = await login("c6-guard-stranger");
    await completeOnboarding(strangerToken);
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ ...body, householdId })
      .expect(403)
      .expect(({ body }) => {
        // ⚠️ 이 가드는 다른 거절들과 달리 코드 봉투 없이 문장만 던진다
        // (`new ForbiddenException("가구 접근 권한이 없어요.")`). 그래서 여기서 고정하는 것은
        // 상태(403)와 **본문이 남의 가구를 말하지 않는다**는 사실이다 — 오류 코드를 지어내
        // 단언하면 그 코드를 이 테스트가 발명한 것이 된다.
        expect(JSON.stringify(body)).not.toContain(householdId);
      });

    // ⓑ 같은 가구지만 역할이 뷰어인 사람 — 가드가 요구하는 역할은 owner/co_parent 둘뿐이다.
    const viewerToken = await inviteViewer(ownerToken, householdId, "c6-guard-viewer");
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ ...body, householdId })
      .expect(403);

    // ⓒ 존재하지 않는 가구 id도 같은 거절이다(가드가 소속을 못 찾는다 — 존재 여부를 말하지 않는다).
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ ...body, householdId: randomUUID() })
      .expect(403);

    // 부정 단언: 거절당한 세 요청은 그 가구에 아이를 한 명도 만들지 않았다.
    expect(await childrenIn()).toBe(1);

    // 막힌 것은 역할·가구이지 경로가 아니다 — 관리자는 같은 본문으로 통과한다.
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...body, householdId })
      .expect(200);
    expect(await childrenIn()).toBe(2);
  });
});
