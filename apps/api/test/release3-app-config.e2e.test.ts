import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

describe("Release 3 app config", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.WOORIAI_ADMIN_TOKEN = "release3-config-admin";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_ADMIN_TOKEN;
    await app?.close();
  });

  it("returns a safe config with ETag and honors If-None-Match", async () => {
    const first = await request(app.getHttpServer()).get("/api/v1/app-config").expect(200);
    expect(first.body).toMatchObject({
      maintenanceMode: false,
      featureFlags: expect.any(Object),
      configVersion: expect.any(Number)
    });
    expect(first.headers["x-config-source"]).toBe("database");
    expect(first.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    await request(app.getHttpServer())
      .get("/api/v1/app-config")
      .set("If-None-Match", first.headers.etag)
      .expect(304);
  });

  it("lets an admin update known flags and rejects unknown fields", async () => {
    const current = (await request(app.getHttpServer()).get("/api/v1/app-config").expect(200)).body;
    const { updatedAt: _updatedAt, configVersion, ...body } = current;
    await request(app.getHttpServer())
      .patch("/api/v1/admin/app-config")
      .set("x-admin-token", "release3-config-admin")
      .send({ expectedVersion: configVersion, reason: "점검 안내 표시", config: { ...body, emergencyMessage: "점검 안내" } })
      .expect(200)
      .expect(({ body: updated }) => expect(updated.config.emergencyMessage).toBe("점검 안내"));
    await request(app.getHttpServer())
      .patch("/api/v1/admin/app-config")
      .set("x-admin-token", "release3-config-admin")
      .send({ expectedVersion: configVersion + 1, reason: "잘못된 설정 검증", config: { ...body, unknownDangerousFlag: true } })
      .expect(400);
    await request(app.getHttpServer())
      .patch("/api/v1/admin/app-config")
      .set("x-admin-token", "release3-config-admin")
      .send({ expectedVersion: configVersion, reason: "오래된 작성자 충돌", config: body })
      .expect(409);

    const rolledBack = await request(app.getHttpServer())
      .post("/api/v1/admin/app-config/rollback")
      .set("x-admin-token", "release3-config-admin")
      .send({ expectedVersion: configVersion + 1, targetVersion: configVersion, reason: "점검 안내 설정 복원" })
      .expect(200);
    expect(rolledBack.body.revision).toMatchObject({ version: configVersion + 2, action: "rollback" });
    expect(rolledBack.body.config.emergencyMessage).toBe(body.emergencyMessage);

    const operations = await request(app.getHttpServer())
      .get("/api/v1/admin/app-config/operations")
      .set("x-admin-token", "release3-config-admin")
      .expect(200);
    expect(operations.body.active.config.configVersion).toBe(configVersion + 2);
    expect(operations.body.revisions.map((revision: { version: number }) => revision.version)).toEqual(
      expect.arrayContaining([configVersion, configVersion + 1, configVersion + 2])
    );
  });
});
