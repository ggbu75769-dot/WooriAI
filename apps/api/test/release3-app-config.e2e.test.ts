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
    expect(first.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    await request(app.getHttpServer())
      .get("/api/v1/app-config")
      .set("If-None-Match", first.headers.etag)
      .expect(304);
  });

  it("lets an admin update known flags and rejects unknown fields", async () => {
    const current = (await request(app.getHttpServer()).get("/api/v1/app-config").expect(200)).body;
    const { updatedAt: _updatedAt, configVersion: _configVersion, ...body } = current;
    await request(app.getHttpServer())
      .patch("/api/v1/admin/app-config")
      .set("x-admin-token", "release3-config-admin")
      .send({ ...body, emergencyMessage: "점검 안내" })
      .expect(200)
      .expect(({ body: updated }) => expect(updated.emergencyMessage).toBe("점검 안내"));
    await request(app.getHttpServer())
      .patch("/api/v1/admin/app-config")
      .set("x-admin-token", "release3-config-admin")
      .send({ ...body, unknownDangerousFlag: true })
      .expect(400);
    await request(app.getHttpServer())
      .patch("/api/v1/admin/app-config")
      .set("x-admin-token", "release3-config-admin")
      .send(body)
      .expect(200);
  });
});
