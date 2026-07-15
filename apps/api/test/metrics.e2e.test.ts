import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

describe("internal metrics", () => {
  let app: INestApplication;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    delete process.env.INTERNAL_METRICS_TOKEN;
    await app.close();
  });

  it("renders vendor-neutral operational metrics without request PII", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/internal/metrics").expect(200);
    expect(response.text).toContain("wooriai_http_requests_total");
    expect(response.text).toContain("wooriai_outbox_pending");
    expect(response.text).not.toContain("authorization");
  });

  it("fails closed without the production internal token", async () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_METRICS_TOKEN = "metrics-test-token";
    await request(app.getHttpServer()).get("/api/v1/internal/metrics").expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/internal/metrics")
      .set("x-internal-token", "metrics-test-token")
      .expect(200);
  });
});
