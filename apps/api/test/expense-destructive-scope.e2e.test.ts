import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { errorResponseSchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * 라운드 108 트랙 C(C-4) — **되돌릴 수 없는 쓰기 둘의 교차가구 경계.**
 *
 * ## 왜 이 둘만 따로 세우나
 * 권한 경계 정찰이 센 자리들 중 대부분은 회귀의 결과가 **유출**이다(남의 지출이 보인다). 이 둘은
 * 다르다 — 회귀의 결과가 **파괴**이고 복구 경로가 없다:
 *
 *   · `POST /settings/children/:childId/delete-confirm`
 *     아이를 soft delete 하면서 **그 아이의 살아 있는 지출 전량**을 같은 트랜잭션에서 함께
 *     soft delete 한다(`OnboardingCoreService.confirmChildProfileDeletion`). 그 뒤 파기 잡
 *     (`data-retention-purge` phase 1·2)이 보존 기한이 지난 tombstone을 **하드 삭제**한다 —
 *     사용자에게도 운영자에게도 되돌리는 입구가 없다.
 *   · `POST /settings/households/:householdId/leave-confirm`
 *     구성원 행을 `left`로 바꾼다. 그 순간 그 가구에 공유된 아이 기록 전부가 그 사용자에게서
 *     사라지고, 다시 들어오려면 관리자의 새 초대가 필요하다.
 *
 * 코드는 오늘 안전하다(정찰이 확인했다). 이 파일은 그 안전을 **유지하는 장치**다.
 *
 * ## 형식
 * `import-excel.e2e.test.ts`의 되돌리기 RBAC 테스트가 이미 쓰는 형식을 따른다: 403을 단언한 뒤
 * **부정 단언**으로 "거절당한 호출이 아무것도 지우지 않았다"를 DB에서 직접 센다. 403만 보면
 * '거절 응답을 돌려주면서 쓰기는 이미 저지른' 회귀를 놓친다 — 이 둘에서는 그 회귀가 곧
 * 복구 불가능한 데이터 손실이다.
 *
 * 그리고 마지막에 **주인은 통과한다**를 함께 단언한다. 그것이 없으면 부정 단언이 공허해진다
 * (엔드포인트가 통째로 죽어도 초록이다 — 그 상태에서는 "아무것도 안 지워졌다"가 늘 참이다).
 */
describe("라운드 108 C-4 — 되돌릴 수 없는 쓰기의 교차가구 경계", () => {
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

  /** 이 파일이 만드는 행은 전부 자기 접두를 단 계정 아래에 생긴다(공유 시드 행은 건드리지 않는다). */
  async function login(prefix: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `${prefix}-${randomUUID()}` })
      .expect(200);
    return response.body.tokens.accessToken as string;
  }

  async function meOf(accessToken: string) {
    const body = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
    ).body as { user: { id: string }; households: Array<{ id: string }> };
    return { userId: body.user.id, householdId: body.households[0]!.id };
  }

  async function completeOnboarding(accessToken: string) {
    const { userId, householdId } = await meOf(accessToken);

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
        .send({ householdId, nickname: "파괴경계", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    return { userId, householdId, childId };
  }

  async function createExpense(accessToken: string, childId: string, itemName: string) {
    return (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 12000, spentOn: "2026-07-06", itemName })
        .expect(200)
    ).body as { id: string };
  }

  /** 같은 가구의 **뷰어**를 만든다 — 삭제는 편집 권한(owner/co_parent)을 요구한다. */
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
      .expect(200)
      .expect(({ body }) => {
        expect(body.household.role).toBe("viewer");
      });
    return viewerToken;
  }

  it("아이 프로필 삭제 확정: 남의 가구·뷰어는 403이고 지출이 한 건도 지워지지 않는다", async () => {
    const ownerToken = await login("c4-child-delete-owner");
    const { householdId, childId } = await completeOnboarding(ownerToken);
    await createExpense(ownerToken, childId, "삭제경계 기저귀");
    await createExpense(ownerToken, childId, "삭제경계 분유");

    const prisma = app.get(PrismaService);
    // 기대값은 리터럴이다 — 검사 대상 코드로 만들지 않는다.
    expect(await prisma.expense.count({ where: { childId, deletedAt: null } })).toBe(2);

    const confirm = { confirmationText: "DELETE CHILD" };

    // ⓐ 남의 가구 사람. 확인 문구는 **맞게** 보낸다 — 그래야 400(문구 불일치)이 아니라
    //    인가 판정 자체를 지나게 되고, 이 테스트가 재려는 것이 그 판정이다.
    const strangerToken = await login("c4-child-delete-stranger");
    await completeOnboarding(strangerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send(confirm)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });

    // ⓑ 같은 가구의 뷰어 — 가구는 맞지만 편집 권한이 없다(requireChildAccess(…, edit=true)).
    const viewerToken = await inviteViewer(ownerToken, householdId, "c4-child-delete-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send(confirm)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });

    // ⓒ 토큰 없이(JwtAuthGuard) · 없는 아이(404) — 거절의 두 이웃 갈래.
    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .send(confirm)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${randomUUID()}/delete-confirm`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send(confirm)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_NOT_FOUND");
      });

    // 부정 단언: 거절당한 세 번의 호출은 **아무것도** 지우지 않았다.
    expect(await prisma.expense.count({ where: { childId, deletedAt: null } })).toBe(2);
    expect((await prisma.child.findUnique({ where: { id: childId } }))?.deletedAt).toBeNull();

    // 막힌 것은 역할·가구이지 경로가 아니다 — 주인은 통과하고, 그때 실제로 파괴가 일어난다.
    // (이 두 줄이 없으면 위 부정 단언이 공허해진다: 엔드포인트가 죽어도 초록이기 때문이다.)
    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(confirm)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, flowId: "child_profile_delete" });
      });
    expect(await prisma.expense.count({ where: { childId, deletedAt: null } })).toBe(0);
    expect((await prisma.child.findUnique({ where: { id: childId } }))?.deletedAt).not.toBeNull();
  });

  it("가구 탈퇴 확정: 남의 가구는 403이고 구성원 행도 지출도 그대로다", async () => {
    const ownerToken = await login("c4-leave-owner");
    const { userId: ownerUserId, householdId, childId } = await completeOnboarding(ownerToken);
    await createExpense(ownerToken, childId, "탈퇴경계 젖병");

    const prisma = app.get(PrismaService);
    const activeMembers = () =>
      prisma.householdMember.count({ where: { householdId, userId: ownerUserId, status: "active" } });

    expect(await activeMembers()).toBe(1);
    expect(await prisma.expense.count({ where: { childId, deletedAt: null } })).toBe(1);

    const confirm = { confirmationText: "LEAVE HOUSEHOLD" };

    // 남의 가구 id로 탈퇴를 시도한다 — 이 요청이 통하면 **남을 가구에서 쫓아낼 수 있다**는 뜻이다.
    const strangerToken = await login("c4-leave-stranger");
    await completeOnboarding(strangerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/settings/households/${householdId}/leave-confirm`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send(confirm)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/settings/households/${householdId}/leave-confirm`)
      .send(confirm)
      .expect(401);

    // 부정 단언: 관리자의 구성원 행은 그대로 `active`이고, 그 가구의 지출도 그대로다.
    expect(await activeMembers()).toBe(1);
    expect(await prisma.expense.count({ where: { childId, deletedAt: null } })).toBe(1);

    // 자기 가구에서는 통과한다 — 그리고 그때 구성원 행이 실제로 `left`가 된다.
    await request(app.getHttpServer())
      .post(`/api/v1/settings/households/${householdId}/leave-confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(confirm)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, flowId: "household_leave" });
      });
    expect(await activeMembers()).toBe(0);
    expect(
      await prisma.householdMember.count({ where: { householdId, userId: ownerUserId, status: "left" } })
    ).toBe(1);
    // 탈퇴는 지출을 지우지 않는다(아이 삭제와 갈리는 지점) — 그 사실도 값으로 남긴다.
    expect(await prisma.expense.count({ where: { childId, deletedAt: null } })).toBe(1);
  });
});
