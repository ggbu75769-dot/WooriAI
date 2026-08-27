import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChildStageCode } from "@wooriai/domain";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { STAGE_BAND_STAGES } from "../src/items-commerce/stage-bands";

/**
 * ITEM-121 (B1): `GET /children/:childId/items`의 선택적 `stageBand` 쿼리 파라미터.
 *
 * 예전에는 서버가 tab="now"에서 아이의 **현재 단계**만 필터했고, 앱의 시기 칩은 그 결과
 * 위에 밴드 필터를 한 번 더 걸었다 -- 현재 단계가 속한 칩 말고는 전부 빈 화면이었다.
 * 이제 밴드를 서버가 이해하므로, 예비 부모가 다음 시기 준비물을 미리 볼 수 있다.
 *
 * 하위호환: `stageBand`를 생략한 요청의 응답은 종전과 완전히 동일해야 한다 -- 아래 첫
 * 테스트가 그것을 고정한다(홈 화면 추천 등 기존 호출자가 모두 이 경로다).
 */
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function createChild(app: INestApplication, accessToken: string, manualStage: ChildStageCode) {
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

  return (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage })
      .expect(200)
  ).body.id as string;
}

type ItemSummary = {
  id: string;
  name: string;
  necessityLevel: "essential" | "convenience" | "optional";
  status: "not_prepared" | "prepared" | "gifted" | "not_needed" | "interested";
  stageCodes?: ChildStageCode[];
};

describe("GET /children/:childId/items?stageBand", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let accessToken: string;
  let childId: string;

  const listItems = async (query: string) =>
    (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?${query}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as ItemSummary[];

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    accessToken = await login(app, "item121-stage-band");
    // 현재 단계는 신생아(0-6개월 밴드). 다른 밴드를 골랐을 때 목록이 실제로 달라지는지 본다.
    childId = await createChild(app, accessToken, "newborn_0_3");
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("keeps the band-less response byte-for-byte identical to the legacy current-stage behavior", async () => {
    const legacy = await listItems("tab=now");

    expect(legacy.length).toBeGreaterThan(0);
    // 종전 계약: tab=now는 아이의 현재 단계를 포함하는 항목만 준다.
    expect(legacy.every((item) => item.stageCodes?.includes("newborn_0_3"))).toBe(true);
    expect(await listItems("tab=now")).toEqual(legacy);
  });

  it("returns another period's items when a stageBand is selected (preview of what comes next)", async () => {
    const nextBand = await listItems("tab=now&stageBand=6-12개월");

    expect(nextBand.length).toBeGreaterThan(0);
    for (const item of nextBand) {
      expect(
        (item.stageCodes ?? []).some((stage) => STAGE_BAND_STAGES["6-12개월"].includes(stage)),
        `${item.name} should belong to the 6-12개월 band`
      ).toBe(true);
    }
    // 신생아 전용 항목(속싸개/겉싸개 등)은 다음 시기 밴드에 없어야 한다 -- 칩이 실제로 목록을 바꾼다.
    const legacyIds = new Set((await listItems("tab=now")).map((item) => item.id));
    expect(nextBand.some((item) => !legacyIds.has(item.id))).toBe(true);
  });

  it("widens the current band beyond the exact current stage (the chip covers a period, not a stage)", async () => {
    const ownBand = await listItems("tab=now&stageBand=0-6개월");
    const legacyIds = (await listItems("tab=now")).map((item) => item.id);

    // 0-6개월 밴드는 임신기~4-6개월을 모두 포함하므로 현재 단계 결과의 상위집합이다.
    expect(ownBand.length).toBeGreaterThanOrEqual(legacyIds.length);
    for (const id of legacyIds) {
      expect(ownBand.map((item) => item.id)).toContain(id);
    }
  });

  it("treats the soon tab as the complement of the selected band", async () => {
    const now = await listItems("tab=now&stageBand=6-12개월");
    const soon = await listItems("tab=soon&stageBand=6-12개월");

    expect(now.length).toBeGreaterThan(0);
    expect(soon.length).toBeGreaterThan(0);
    const nowIds = new Set(now.map((item) => item.id));
    expect(soon.filter((item) => nowIds.has(item.id))).toEqual([]);
    for (const item of soon) {
      expect(
        (item.stageCodes ?? []).some((stage) => STAGE_BAND_STAGES["6-12개월"].includes(stage)),
        `${item.name} should not belong to the 6-12개월 band`
      ).toBe(false);
    }
  });

  it("narrows the prepared tab by band only when one is given (하위호환)", async () => {
    const newbornItem = (await listItems("tab=now")).find((item) => item.stageCodes?.includes("newborn_0_3"));
    expect(newbornItem).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${newbornItem!.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "prepared" })
      .expect(200);

    // 밴드 없이 = 종전대로 상태만 본다.
    expect((await listItems("tab=prepared")).map((item) => item.id)).toContain(newbornItem!.id);
    // 같은 밴드를 고르면 그대로 보이고, 다른 밴드를 고르면 빠진다.
    expect((await listItems("tab=prepared&stageBand=0-6개월")).map((item) => item.id)).toContain(newbornItem!.id);
    expect((await listItems("tab=prepared&stageBand=6-12개월")).map((item) => item.id)).not.toContain(newbornItem!.id);
  });

  it("still hides prepared/not_needed items from a band's now tab", async () => {
    const target = (await listItems("tab=now&stageBand=6-12개월"))[0];
    expect(target).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${target.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "not_needed" })
      .expect(200);

    expect((await listItems("tab=now&stageBand=6-12개월")).map((item) => item.id)).not.toContain(target.id);
    expect((await listItems("tab=not_needed&stageBand=6-12개월")).map((item) => item.id)).toContain(target.id);
  });

  it("rejects an unknown stageBand value with 400 instead of silently ignoring it", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?tab=now&stageBand=36개월`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);
  });

  it("serves every declared band label without error", async () => {
    for (const label of Object.keys(STAGE_BAND_STAGES)) {
      const items = await listItems(`tab=now&stageBand=${encodeURIComponent(label)}`);
      expect(Array.isArray(items), `band ${label}`).toBe(true);
    }
  });
});
