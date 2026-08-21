import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

// PUSH-113: GET /api/v1/health/push — /health/worker(INF-007)와 같은 무인증
// 관측 엔드포인트. 테스트 환경은 PUSH_ENABLED 미설정이므로 enabled=false의
// no-op 상태가 그대로 노출되어야 하고, 본문은 숫자·불리언만 담아야 한다.
describe("GET /api/v1/health/push (PUSH-113)", () => {
  let app: INestApplication;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    savedEnv.PUSH_ENABLED = process.env.PUSH_ENABLED;
    savedEnv.FCM_SERVICE_ACCOUNT_PATH = process.env.FCM_SERVICE_ACCOUNT_PATH;
    delete process.env.PUSH_ENABLED;
    delete process.env.FCM_SERVICE_ACCOUNT_PATH;
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await app.close();
  });

  it("무인증 200 — push off 기본 상태를 숫자·불리언만으로 노출한다", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health/push").expect(200);

    expect(response.body).toEqual({
      enabled: false,
      tokenCached: false,
      sentOk: 0,
      sendFailed: 0,
      unregisteredTokens: 0
    });
    for (const value of Object.values(response.body as Record<string, unknown>)) {
      expect(["boolean", "number"]).toContain(typeof value);
    }
  });
});
