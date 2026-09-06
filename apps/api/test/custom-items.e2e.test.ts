import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { errorResponseSchema, itemDetailSchema, itemSummarySchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { ItemsCatalogService } from "../src/onboarding/items-catalog.service";
import {
  CUSTOM_ITEM_MAX_PER_CHILD,
  CUSTOM_ITEM_REASON_TEXT
} from "../src/onboarding/custom-items.service";

/**
 * 라운드 100 T1 — 커스텀 품목(사용자 직접 추가 준비물) e2e.
 * 설계: docs/5차/round100-custom-items-design.md (§2 계약 · §9 확정 · §6.7 리스크).
 *
 * 데이터 격리: 이 스위트는 자기 oauth-login으로 만든 사용자/가구/아이와 그 아이의
 * custom_items 행만 만들고 읽는다(test-db.ts 하단 관례). 커스텀 행은 child_id FK
 * ON DELETE CASCADE(000022)라 afterAll의 child 삭제로 함께 사라진다 — 카탈로그
 * (item_templates)와 시드는 0바이트 무접촉이다(§1.1: 별도 테이블의 요점).
 *
 * 파기(purge) 상호작용(리스크 R2)은 이 파일이 아니라 배타 스위트
 * data-retention-purge.db.test.ts의 라운드 100 블록이 증명한다 — 파기 잡은 DB 전역을
 * 지우므로 병렬 스위트에서 돌릴 수 없다.
 */

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function whoAmI(app: INestApplication, accessToken: string) {
  const body = (
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
  ).body;
  return { userId: body.user.id as string, householdId: body.households[0].id as string };
}

/** items-commerce e2e의 completeOnboarding 관례 축약판(예산·prepared-items 생략 — 이 스위트는 안 쓴다). */
async function createChildWithConsents(app: INestApplication, accessToken: string, householdId: string) {
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
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(200)
  ).body.id as string;
}

type SummaryBody = {
  id: string;
  name: string;
  necessityLevel: string;
  status: string;
  timingLabel?: string;
  stageCodes?: string[];
  isCustom?: boolean;
  categoryId?: string;
  priceBandText?: string;
};

describe("Custom items API (라운드 100 T1)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaClient;

  let ownerToken: string;
  let ownerUserId: string;
  let householdId: string;
  let childId: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    prisma = new PrismaClient();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    ownerToken = await login(app, "r100-custom-items-owner");
    const me = await whoAmI(app, ownerToken);
    ownerUserId = me.userId;
    householdId = me.householdId;
    childId = await createChildWithConsents(app, ownerToken, householdId);
  });

  afterAll(async () => {
    // 000001의 실제 SQL FK 순서대로 안쪽부터(비-캐스케이드 참조 먼저): 이 스위트가 만든
    // 상태 행·지출을 걷어낸 뒤 아이를 지운다. custom_items는 child_id ON DELETE
    // CASCADE(000022)라 아이 삭제로 함께 사라진다 — 그 정리 경로 자체가 검증 대상이라
    // 여기서 custom_items를 직접 지우지 않는다(잔존 단언은 "아이 물리 삭제" 테스트).
    const childIds = (await prisma.child.findMany({ where: { householdId }, select: { id: true } })).map(
      (child) => child.id
    );
    await prisma.childItemStatus.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.expense.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  function createBody(overrides: Partial<{ name: string; stageBand: string; necessityLevel: string }> = {}) {
    return {
      name: "친정에서 받은 아기 욕조",
      stageBand: "0-6개월",
      necessityLevel: "essential",
      ...overrides
    };
  }

  async function createCustomItem(
    token: string,
    body: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<SummaryBody> {
    let req = request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/custom-items`)
      .set("Authorization", `Bearer ${token}`);
    if (idempotencyKey) {
      req = req.set("Idempotency-Key", idempotencyKey);
    }
    const response = await req.send(body).expect(200);
    return response.body as SummaryBody;
  }

  async function listItems(token: string, query = "tab=all"): Promise<SummaryBody[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items?${query}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    return response.body.items as SummaryBody[];
  }

  it("생성 → 목록 합류(탭 술어·카탈로그 뒤 created ASC·isCustom 마커) → 상세 갈래가 §9.2 모양 그대로 왕복한다", async () => {
    const created = await createCustomItem(ownerToken, createBody());
    // §9.2: 생성 응답 = CustomItemSummaryDto.
    itemSummarySchema.parse(created);
    expect(created.isCustom).toBe(true);
    expect(created.status).toBe("not_prepared");
    expect(created.necessityLevel).toBe("essential");
    expect(created.timingLabel).toBe("0-6개월");
    // stagesForBand("0-6개월") 전개(§1.3 — 서버 stage-bands.ts의 현행 정의).
    expect(created.stageCodes).toEqual(["pregnancy_early", "pregnancy_mid", "pregnancy_late", "newborn_0_3", "infant_4_6"]);
    // 없는 사실은 싣지 않는다(§5): 분류·가격대 키 자체가 없다.
    expect(created.categoryId).toBeUndefined();
    expect(created.priceBandText).toBeUndefined();

    const later = await createCustomItem(
      ownerToken,
      createBody({ name: "걸음마 보조기", stageBand: "12-24개월", necessityLevel: "convenience" })
    );

    // tab=all: 병합 + 순서 — 모든 카탈로그 행 뒤에, 커스텀은 created ASC(§2.2).
    const all = await listItems(ownerToken, "tab=all");
    const customIndexes = [created.id, later.id].map((id) => all.findIndex((item) => item.id === id));
    expect(customIndexes.every((index) => index > -1)).toBe(true);
    const lastCatalogIndex = all.reduce((max, item, index) => (item.isCustom ? max : Math.max(max, index)), -1);
    expect(Math.min(...customIndexes)).toBeGreaterThan(lastCatalogIndex);
    expect(customIndexes[0]).toBeLessThan(customIndexes[1]); // created ASC
    for (const item of all.filter((entry) => entry.isCustom)) {
      itemSummarySchema.parse(item);
    }

    // 탭 술어는 카탈로그와 동일(§2.2 — 아이 현재 단계 newborn_0_3 기준):
    // "0-6개월" 행은 now, "12-24개월" 행은 soon.
    const now = await listItems(ownerToken, "tab=now");
    expect(now.some((item) => item.id === created.id)).toBe(true);
    expect(now.some((item) => item.id === later.id)).toBe(false);
    const soon = await listItems(ownerToken, "tab=soon");
    expect(soon.some((item) => item.id === later.id)).toBe(true);
    expect(soon.some((item) => item.id === created.id)).toBe(false);
    // stageBand 칩을 고르면 그 밴드 기준(ITEM-121과 동일 술어).
    const bandNow = await listItems(ownerToken, `tab=now&stageBand=${encodeURIComponent("12-24개월")}`);
    expect(bandNow.some((item) => item.id === later.id)).toBe(true);

    // 상세 갈래(§2.5): 링크 0건·고정 reasonText·주장 없음(false/null)·isCustom.
    const detail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${created.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body;
    itemDetailSchema.parse(detail);
    expect(detail.isCustom).toBe(true);
    expect(detail.productLinks).toEqual([]);
    expect(detail.reasonText).toBe(CUSTOM_ITEM_REASON_TEXT);
    expect(detail.skipReasonText).toBeNull();
    expect(detail.safetyNote).toBeNull();
    expect(detail.usedSecondhandOk).toBe(false);
    expect(detail.medicalDisclaimerRequired).toBe(false);
    expect(detail.linkedExpense).toBeNull();
  });

  it("PATCH가 속성(이름 트림·시기·필수도)만 부분 갱신하고, status는 기존 다형 엔드포인트가 갱신한다(§2.4)", async () => {
    const created = await createCustomItem(ownerToken, createBody({ name: "역류 방지 쿠션" }));

    const patched = (
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}/custom-items/${created.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "  역류 방지 쿠션 대형  ", necessityLevel: "optional" })
        .expect(200)
    ).body as SummaryBody;
    expect(patched.id).toBe(created.id);
    expect(patched.name).toBe("역류 방지 쿠션 대형"); // 검증 전 trim(§9.1)
    expect(patched.necessityLevel).toBe("optional");
    expect(patched.timingLabel).toBe("0-6개월"); // 미전송 필드는 유지
    expect(patched.isCustom).toBe(true);

    // PATCH 본문의 status는 화이트리스트 밖 — 400(§9.1: status는 기존 status 엔드포인트 몫).
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/custom-items/${created.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "prepared" })
      .expect(400);

    // 공백만 있는 이름은 400 VALIDATION_ERROR(트림 후 재검증), 81자도 400.
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/custom-items/${created.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "   " })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/custom-items`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(createBody({ name: "가".repeat(81) }))
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));

    // 기존 status 엔드포인트의 커스텀 갈래(§2.4): 오프라인 아웃박스가 타는 바로 그 경로.
    const statusChanged = (
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}/items/${created.id}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "prepared" })
        .expect(200)
    ).body as SummaryBody;
    expect(statusChanged.id).toBe(created.id);
    expect(statusChanged.status).toBe("prepared");
    expect(statusChanged.isCustom).toBe(true);
    itemSummarySchema.parse(statusChanged);

    // 준비완료 탭 술어에 합류(§2.2 — TAB_STATUSES 그대로).
    const prepared = await listItems(ownerToken, "tab=prepared");
    expect(prepared.some((item) => item.id === created.id)).toBe(true);
    // child_item_statuses는 0바이트 무접촉(§1.1 대안 B 기각) — 상태는 행에 내장이다.
    expect(await prisma.childItemStatus.findFirst({ where: { childId, itemTemplateId: created.id } })).toBeNull();
  });

  it("커스텀 id + expenseId 상태 변경은 400 CUSTOM_ITEM_EXPENSE_LINK_UNSUPPORTED — 조용히 버리지 않는다(§2.4)", async () => {
    const created = await createCustomItem(ownerToken, createBody({ name: "지출 연결 경계용" }));
    const categories = (
      await request(app.getHttpServer())
        .get("/api/v1/categories")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.categories as Array<{ id: string; code: string }>;
    const expenseId = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          categoryId: categories[0].id,
          amountKrw: 12000,
          spentOn: "2026-07-06",
          itemName: "연결 경계 테스트",
          paymentMethod: "card"
        })
        .expect(200)
    ).body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${created.id}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "prepared", expenseId })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("CUSTOM_ITEM_EXPENSE_LINK_UNSUPPORTED");
      });
    // 거절된 요청은 상태도 바꾸지 않는다.
    const detail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${created.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body;
    expect(detail.status).toBe("not_prepared");
  });

  it("권한(§2.6): viewer는 생성/수정/삭제/상태 전부 403 FORBIDDEN, 읽기(목록 합류·상세)는 가능하다", async () => {
    const target = await createCustomItem(ownerToken, createBody({ name: "권한 경계용" }));

    const viewerToken = await login(app, "r100-custom-items-viewer");
    const viewer = await whoAmI(app, viewerToken);
    await prisma.householdMember.create({
      data: { householdId, userId: viewer.userId, role: "viewer", status: "active", joinedAt: new Date() }
    });

    // 읽기: 구성원 전원(목록 합류·상세 — §2.6).
    const seen = await listItems(viewerToken, "tab=all");
    expect(seen.some((item) => item.id === target.id)).toBe(true);
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${target.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    const expect403 = ({ body }: { body: unknown }) => {
      errorResponseSchema.parse(body);
      expect((body as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    };
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/custom-items`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send(createBody())
      .expect(403)
      .expect(expect403);
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/custom-items/${target.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ name: "바꿔치기" })
      .expect(403)
      .expect(expect403);
    await request(app.getHttpServer())
      .delete(`/api/v1/children/${childId}/custom-items/${target.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403)
      .expect(expect403);
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${target.id}/status`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ status: "prepared" })
      .expect(403)
      .expect(expect403);

    // 거절된 쓰기는 아무것도 바꾸지 않았다.
    const row = await prisma.customItem.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.name).toBe("권한 경계용");
    expect(row.status).toBe("not_prepared");
    expect(row.deletedAt).toBeNull();
  });

  it("멱등(§2.3): 같은 키+같은 본문은 첫 응답 재생(행 1개), 같은 키+다른 본문은 409 IDEMPOTENCY_KEY_CONFLICT", async () => {
    const key = `r100-${randomUUID()}`;
    const body = createBody({ name: "멱등 재시도용" });

    const first = await createCustomItem(ownerToken, body, key);
    const replayed = await createCustomItem(ownerToken, body, key);
    expect(replayed.id).toBe(first.id);
    expect(await prisma.customItem.count({ where: { childId, name: "멱등 재시도용", deletedAt: null } })).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/custom-items`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", key)
      .send(createBody({ name: "다른 본문" }))
      .expect(409)
      .expect(({ body: errorBody }) => expect(errorBody.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT"));
  });

  it(`한도(§1.4): 활성 ${CUSTOM_ITEM_MAX_PER_CHILD}건에서 생성은 400이고, 소프트 삭제로 자리가 나면 다시 생성된다`, async () => {
    // 한도 경계 전용 아이 — 다른 테스트의 행 수와 얽히지 않게 분리한다.
    const limitChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ householdId, nickname: "한도둥이", stageMode: "manual", manualStage: "newborn_0_3" })
        .expect(200)
    ).body.id as string;

    const viaApi = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${limitChildId}/custom-items`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(createBody({ name: "한도 채움 0" }))
        .expect(200)
    ).body as SummaryBody;
    await prisma.customItem.createMany({
      data: Array.from({ length: CUSTOM_ITEM_MAX_PER_CHILD - 1 }, (_, index) => ({
        childId: limitChildId,
        name: `한도 채움 ${index + 1}`,
        stageBand: "0-6개월",
        necessityLevel: "essential" as const,
        createdByUserId: ownerUserId,
        updatedByUserId: ownerUserId
      }))
    });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${limitChildId}/custom-items`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(createBody({ name: "201번째" }))
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("CUSTOM_ITEM_LIMIT_EXCEEDED");
      });

    // 소프트 삭제된 행은 한도의 분모가 아니다(§1.4 — 활성만 센다).
    await request(app.getHttpServer())
      .delete(`/api/v1/children/${limitChildId}/custom-items/${viaApi.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/children/${limitChildId}/custom-items`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(createBody({ name: "빈자리 재사용" }))
      .expect(200);

    await prisma.customItem.deleteMany({ where: { childId: limitChildId } });
    await prisma.child.deleteMany({ where: { id: limitChildId } });
  });

  it("다형화 경계(R1): 어느 표에도 없는 id는 종전 ITEM_NOT_FOUND 그대로, 타 가구 커스텀 id는 어느 표면으로도 새지 않는다", async () => {
    const unknownId = randomUUID();
    const expectItemNotFound = ({ body }: { body: unknown }) => {
      errorResponseSchema.parse(body);
      expect((body as { error: { code: string } }).error.code).toBe("ITEM_NOT_FOUND");
    };
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${unknownId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(expectItemNotFound);
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${unknownId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "prepared" })
      .expect(404)
      .expect(expectItemNotFound);
    // CRUD 쪽 404는 전용 코드(§9.3).
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/custom-items/${unknownId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "없는 행" })
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("CUSTOM_ITEM_NOT_FOUND"));
    await request(app.getHttpServer())
      .delete(`/api/v1/children/${childId}/custom-items/${unknownId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("CUSTOM_ITEM_NOT_FOUND"));

    // 카탈로그 템플릿 경로는 종전 그대로다(다형화는 "템플릿 미존재"일 때만 열린다 — R1).
    const catalogItem = (await listItems(ownerToken, "tab=all")).find((item) => !item.isCustom);
    expect(catalogItem).toBeTruthy();
    const catalogStatus = (
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}/items/${catalogItem!.id}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "interested" })
        .expect(200)
    ).body as SummaryBody;
    expect(catalogStatus.isCustom).toBeUndefined();

    // 타 가구의 커스텀 id: childId 스코프 조회라 구조적으로 404(§2.6).
    const strangerToken = await login(app, "r100-custom-items-stranger");
    const stranger = await whoAmI(app, strangerToken);
    const strangerChildId = await createChildWithConsents(app, strangerToken, stranger.householdId);
    const strangerItem = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${strangerChildId}/custom-items`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send(createBody({ name: "남의 가구 물건" }))
        .expect(200)
    ).body as SummaryBody;

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${strangerItem.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(expectItemNotFound);
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${strangerItem.id}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "prepared" })
      .expect(404)
      .expect(expectItemNotFound);
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/custom-items/${strangerItem.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "탈취 시도" })
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("CUSTOM_ITEM_NOT_FOUND"));
    expect((await listItems(ownerToken, "tab=all")).some((item) => item.id === strangerItem.id)).toBe(false);
    // 남의 행은 그대로다.
    const untouched = await prisma.customItem.findUniqueOrThrow({ where: { id: strangerItem.id } });
    expect(untouched.name).toBe("남의 가구 물건");
    expect(untouched.status).toBe("not_prepared");

    await prisma.child.deleteMany({ where: { id: strangerChildId } });
  });

  it("소프트 삭제(§1.2) 후 목록/상세/status/CRUD 각 표면에서 사라지고, 감사 로그는 id·childId만 남긴다(이름 미기록)", async () => {
    const name = "삭제 표면 검증용 유모차 정리함";
    const created = await createCustomItem(ownerToken, createBody({ name }));

    const deleted = (
      await request(app.getHttpServer())
        .delete(`/api/v1/children/${childId}/custom-items/${created.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body;
    expect(deleted).toEqual({ id: created.id, deleted: true });

    // 행은 소프트 삭제로 남는다(이력 보존 — audit에 이름을 싣지 않는 근거이기도 하다).
    const row = await prisma.customItem.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedByUserId).toBe(ownerUserId);

    // 각 표면: 목록 부재 · 상세 404 · status 404 · CRUD 404.
    expect((await listItems(ownerToken, "tab=all")).some((item) => item.id === created.id)).toBe(false);
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${created.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("ITEM_NOT_FOUND"));
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}/items/${created.id}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "prepared" })
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("ITEM_NOT_FOUND"));
    await request(app.getHttpServer())
      .delete(`/api/v1/children/${childId}/custom-items/${created.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("CUSTOM_ITEM_NOT_FOUND"));

    // 감사 로그(§1.2): custom_item.delete — id·childId만, 이름은 어디에도 없다.
    const audit = await prisma.auditLog.findFirst({ where: { action: "custom_item.delete", targetId: created.id } });
    expect(audit).not.toBeNull();
    expect(audit!.targetType).toBe("custom_item");
    expect(audit!.actorUserId).toBe(ownerUserId);
    expect(audit!.afterJson).toEqual({ childId });
    expect(JSON.stringify(audit!.afterJson) + JSON.stringify(audit!.beforeJson)).not.toContain(name);
  });

  it("어드민 카탈로그·홈 맞춤 추천 무오염(§2.2 ⚠️): 커스텀 행은 adminListItemTemplates와 recommendedItems 어디에도 새지 않는다", async () => {
    const created = await createCustomItem(ownerToken, createBody({ name: "무오염 검증용" }));

    // 어드민 카탈로그(운영 시드 소유)는 커스텀 행의 존재조차 모른다(§1.1 — 별도 테이블의 요점).
    const catalog = moduleRef.get(ItemsCatalogService, { strict: false });
    const adminItems = await catalog.adminListItemTemplates();
    expect(adminItems.items.some((item: { id: string }) => item.id === created.id)).toBe(false);

    // 홈 "맞춤 추천"은 커머스 표면 — 합류 지점은 listItems 하나뿐이다(§2.2).
    const home = (
      await request(app.getHttpServer())
        .get(`/api/v1/home?childId=${childId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body;
    expect(
      (home.recommendedItems as Array<{ id: string }>).some((item) => item.id === created.id)
    ).toBe(false);
  });

  it("아이 물리 삭제 시 custom_items가 FK CASCADE로 함께 사라진다(고아 0 — §1.5)", async () => {
    const cascadeChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ householdId, nickname: "고아검증둥이", stageMode: "manual", manualStage: "newborn_0_3" })
        .expect(200)
    ).body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/children/${cascadeChildId}/custom-items`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(createBody({ name: "고아가 되면 안 되는 행" }))
      .expect(200);
    expect(await prisma.customItem.count({ where: { childId: cascadeChildId } })).toBe(1);

    // 파기 잡의 purgeChildRows와 같은 물리 삭제 경로(child.deleteMany) — 000022의
    // ON DELETE CASCADE가 커스텀 행을 함께 지우므로 잡 코드 수정 없이 FK 위반이 없다.
    await prisma.child.deleteMany({ where: { id: cascadeChildId } });
    expect(await prisma.customItem.count({ where: { childId: cascadeChildId } })).toBe(0);
  });
});
