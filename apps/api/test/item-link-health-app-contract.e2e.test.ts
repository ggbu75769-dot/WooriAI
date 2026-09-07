import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { itemDetailSchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * COM-105 후속 — **앱에 무엇을 말하고 무엇을 말하지 않는가.**
 *
 * 배경(정찰 실측): 워커는 `product_links.health_status`로 도달 실패를 알고 있는데 그 값이
 * 앱 DTO에 실리지 않아, 우리가 도달 실패를 아는 링크를 사용자는 아무 말도 못 들은 채 눌러
 * 앱 밖에서 404를 만났다. 라운드 68 C(#4)가 `broken`에 붙인 대우는 정렬 강등과 공유 URL
 * 미발급 둘뿐이고 **둘 다 화면에 한 글자도 남기지 않는다**.
 *
 * 갈래별 정상 동작(broken·unstable·ok·미확인 네 가지)은 items-commerce.e2e.test.ts의 두 절이
 * 이미 진다. 이 파일이 따로 무는 것은 **그 경계가 새는 자리** 셋이다:
 *  ① 워커가 쓰지 않는 값이 DB에 들어와도 앱으로 새지 않는가,
 *  ② 같은 링크를 어드민은 여전히 **전부** 볼 수 있는가(운영은 판정을 되읽어야 한다),
 *  ③ `ok`가 정말 한 번도 나가지 않는가 — 나가는 순간 앱이 최대 24시간 묵은 판정을
 *    "확인됨"으로 그릴 수 있게 되고, 그것이 곧 허위 표시다.
 */

const OWN_TEMPLATE_NAME = "COM-105 앱 헬스 계약 테스트템";

async function login(app: INestApplication, providerToken: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string): Promise<string> {
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
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(200)
  ).body.id as string;
}

describe("COM-105 후속: 앱 DTO의 링크 헬스 경계", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  it("워커가 쓰지 않는 값은 앱으로 새지 않고, 어드민은 그 값을 그대로 되읽는다", async () => {
    const accessToken = await login(app, "com105-app-health-unknown");
    const childId = await completeOnboarding(app, accessToken);
    const prisma = moduleRef.get(PrismaService);
    const adminToken = "test-admin-token-com105-app-health";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;

    // 시기(stage) 행 없이 만드는 일회용 준비템 — now/홈 추천의 정확 개수 단언에 끼지 않는다.
    const template = await prisma.itemTemplate.create({
      data: {
        code: `com105_app_health_${randomUUID()}`,
        name: OWN_TEMPLATE_NAME,
        necessityLevel: "essential",
        reasonText: "COM-105 앱 헬스 계약 검증 전용 픽스처.",
        active: true
      }
    });

    // affiliateUrl은 비워 둔다 — link-health 워커의 후보 조건(affiliateUrl != null)에서 빠져
    // 다른 스위트의 배치가 이 행의 판정을 덮어쓰지 않는다.
    const linkFixtures = [
      // 워커의 유니온(ok|broken|unstable) 밖의 값. 컬럼이 varchar(16)이라 DB는 받아 주고,
      // 오래된 배포·수기 수정·다음 버전 워커가 실제로 남길 수 있는 모양이다.
      { displayOrder: 10, title: "미지의 판정 링크", healthStatus: "mystery" },
      // 빈 문자열도 "값이 있다"로 읽히면 안 된다.
      { displayOrder: 20, title: "빈 판정 링크", healthStatus: "" },
      // 대소문자가 다른 값도 워커가 쓰는 문자열이 아니다(느슨한 비교를 막는다).
      { displayOrder: 30, title: "대문자 판정 링크", healthStatus: "BROKEN" },
      // 어드민이 되읽어야 하는 정상 판정.
      { displayOrder: 40, title: "정상 링크", healthStatus: "ok" }
    ];

    try {
      for (const fixture of linkFixtures) {
        await prisma.productLink.create({
          data: {
            itemTemplateId: template.id,
            platform: "coupang",
            title: fixture.title,
            url: `https://example.com/dev/com105/${fixture.displayOrder}`,
            affiliateUrl: null,
            isAffiliate: false,
            isSponsored: false,
            displayOrder: fixture.displayOrder,
            active: true,
            healthStatus: fixture.healthStatus,
            healthCheckedAt: new Date()
          }
        });
      }

      const detail = (
        await request(app.getHttpServer())
          .get(`/api/v1/children/${childId}/items/${template.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body as { productLinks: Array<Record<string, unknown>> };

      // 계약을 실제로 통과한다(모르는 값이 그대로 실리면 여기서 먼저 터진다).
      itemDetailSchema.parse(detail);

      // ① 네 링크 **전부** 앱에서는 키가 없다 — 아는 실패 둘만 말하고 나머지는 침묵이다.
      expect(detail.productLinks).toHaveLength(linkFixtures.length);
      for (const link of detail.productLinks) {
        expect(link, String(link.title)).not.toHaveProperty("healthStatus");
        expect(link, String(link.title)).not.toHaveProperty("healthCheckedAt");
      }
      // ③ 응답 어디에도 "ok"라는 판정이 없다(직렬화된 본문 전체를 훑는다).
      expect(JSON.stringify(detail)).not.toContain('"healthStatus"');

      // 링크를 감추지도 않는다 — 판정이 무엇이든 구매 경로는 네 줄 그대로 열려 있다.
      expect(detail.productLinks.map((link) => link.title)).toEqual([
        "미지의 판정 링크",
        "빈 판정 링크",
        "대문자 판정 링크",
        "정상 링크"
      ]);

      // ② 어드민은 **같은 행**의 값을 그대로 되읽는다: 운영이 판정을 보고 링크를 직접
      //    눌러 볼 수 있어야 하고, 앱에서 무슨 일이 벌어지는지도 그 표에서 읽어야 한다.
      const adminCatalog = (
        await request(app.getHttpServer())
          .get("/api/v1/admin/item-templates")
          .set("x-admin-token", adminToken)
          .expect(200)
      ).body as { items: Array<{ id: string; productLinks: Array<Record<string, unknown>> }> };

      const adminItem = adminCatalog.items.find((item) => item.id === template.id);
      expect(adminItem, "어드민 카탈로그에서 이 준비템을 찾지 못했다").toBeDefined();
      const adminByTitle = new Map(adminItem!.productLinks.map((link) => [String(link.title), link]));
      expect(adminByTitle.get("미지의 판정 링크")).toHaveProperty("healthStatus", "mystery");
      expect(adminByTitle.get("정상 링크")).toHaveProperty("healthStatus", "ok");
      // 확인 시각도 어드민에는 그대로 있다(앱에는 없다 — 위 단언).
      expect(adminByTitle.get("정상 링크")!.healthCheckedAt).not.toBeNull();
    } finally {
      await prisma.productLink.deleteMany({ where: { itemTemplateId: template.id } });
      await prisma.childItemStatus.deleteMany({ where: { itemTemplateId: template.id } });
      await prisma.itemTemplate.deleteMany({ where: { id: template.id } });
    }
  });
});
