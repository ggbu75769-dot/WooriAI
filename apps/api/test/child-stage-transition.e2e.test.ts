import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { childSchema, updateChildRequestSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

/**
 * CHILD-127: 임신(pregnant) 중 가입한 사용자의 아이가 태어났을 때 stageMode를 born으로
 * 넘기는 단방향 전환. 예전에는 전환 수단이 아예 없어서 birthDate를 채울 방법이 없었고,
 * 그 결과 100일/첫돌 리포트가 MILESTONE_UNAVAILABLE로 영구히 막히고 단계 계산이
 * 출산예정일에 고정됐다.
 */
async function login(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `child127-${randomUUID()}` })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function acceptConsents(app: INestApplication, accessToken: string) {
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
}

describe("CHILD-127 아이 상태 전환 (임신 → 출생)", () => {
  let app: INestApplication;
  let accessToken: string;
  let householdId: string;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // d100 창 [2026-03-01, 2026-06-09) 가 아직 안 끝난 시점 -- partial 응답을 검증한다.
    process.env.WOORIAI_STAGE_TODAY = "2026-04-10";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    accessToken = await login(app);
    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    householdId = me.body.households[0].id as string;
    await acceptConsents(app, accessToken);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  const createPregnantChild = async (dueDate = "2026-05-20") =>
    (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "튼튼이", stageMode: "pregnant", dueDate })
        .expect(200)
    ).body.id as string;

  it("turns a pregnant child into a born one, keeps the due date, and unblocks the milestone report", async () => {
    const childId = await createPregnantChild();

    // 전환 전: 출산예정일 기준 단계에 고정되어 있고 100일 리포트는 막혀 있다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.stageMode).toBe("pregnant");
        expect(body.birthDate).toBeNull();
        expect(body.currentStage).toMatch(/^pregnancy_/);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone?type=d100`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("MILESTONE_UNAVAILABLE");
      });

    const transitionBody = { stageMode: "born", birthDate: "2026-03-01" };
    // 계약 미러: 클라이언트가 보내는 바디가 공유 스키마를 통과해야 한다.
    expect(updateChildRequestSchema.parse(transitionBody)).toEqual(transitionBody);

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(transitionBody)
      .expect(200)
      .expect(({ body }) => {
        childSchema.parse(body);
        expect(body.stageMode).toBe("born");
        expect(body.birthDate).toBe("2026-03-01");
        // dueDate는 보존된다 (컬럼 유지) -- 단계 계산만 birthDate로 넘어간다.
        expect(body.dueDate).toBe("2026-05-20");
        expect(body.currentStage).toBe("newborn_0_3");
      });

    // 목록/조회에도 그대로 반영된다 (한 번의 PATCH로 영구 전환).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "born", birthDate: "2026-03-01", dueDate: "2026-05-20" });
      });

    // 핵심 결함 해소: 100일 리포트가 (아직 진행 중이므로 partial로) 응답한다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone?type=d100`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          childId,
          type: "d100",
          startDate: "2026-03-01",
          endDate: "2026-06-08",
          partial: true,
          daysCovered: 41
        });
      });
  });

  it("refuses the reverse transition with CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED", async () => {
    const childId = await createPregnantChild();
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "born", birthDate: "2026-03-01" })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "pregnant", dueDate: "2026-05-20" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED");
      });

    // 되돌리기가 거부된 뒤에도 저장된 값은 그대로다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "born", birthDate: "2026-03-01" });
      });
  });

  it("refuses every other stage-mode move (manual in either direction)", async () => {
    const pregnantChildId = await createPregnantChild();
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${pregnantChildId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED");
      });

    const manualChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "직접선택", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${manualChildId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "born", birthDate: "2026-03-01" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED");
      });
  });

  it("requires the birth date in the same request as the transition", async () => {
    const childId = await createPregnantChild();

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "born" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_INPUT_REQUIRED");
        expect(body.error.message).toBe("아이 생년월일을 입력해 주세요.");
      });

    // 실패한 전환은 아무것도 바꾸지 않는다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "pregnant", birthDate: null });
      });
  });

  it("rejects a malformed stage mode as a validation error, not a transition error", async () => {
    const childId = await createPregnantChild();
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "hatched", birthDate: "2026-03-01" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("stays backward compatible: PATCH without stageMode still edits in place", async () => {
    const childId = await createPregnantChild();

    // 기존 클라이언트 그대로 (stageMode 미전송) -- 예정일 수정과 개명이 계속 동작한다.
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "반짝이", dueDate: "2026-06-01" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ nickname: "반짝이", stageMode: "pregnant", dueDate: "2026-06-01" });
      });

    // 같은 stageMode를 그대로 되보내는 것은 전환이 아니므로 허용된다.
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "pregnant", dueDate: "2026-06-02" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "pregnant", dueDate: "2026-06-02" });
      });
  });

  it("keeps the transition behind the same edit permission as every other child write", async () => {
    const childId = await createPregnantChild();
    const strangerToken = await login(app);

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ stageMode: "born", birthDate: "2026-03-01" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("FORBIDDEN");
      });
  });
});
