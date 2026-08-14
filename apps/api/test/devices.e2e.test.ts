import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

async function login(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `devices-token-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

// NOTI-100: /me/devices — 푸시 기기 등록(upsert)과 알림 토글.
describe("Me devices API (NOTI-100)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .send({ platform: "ios", pushToken: "unauthenticated-token" })
      .expect(401);
  });

  it("rejects an unknown platform and non-whitelisted fields", async () => {
    const accessToken = await login(app);

    await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "windows", pushToken: "some-token" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));

    await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "ios", pushToken: "some-token", userId: "spoofed" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
  });

  it("registers a device, upserts on the same token instead of duplicating, and toggles notifications", async () => {
    const accessToken = await login(app);
    const pushToken = `expo-push-${randomUUID()}`;

    // 1) 신규 등록: 푸시 토큰이 있다는 것은 OS 권한 허용을 뜻하므로 기본 on.
    const registered = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "ios", pushToken, appVersion: "1.2.0", osVersion: "iOS 19.1" })
      .expect(200);
    expect(registered.body).toMatchObject({
      platform: "ios",
      notificationEnabled: true,
      appVersion: "1.2.0",
      osVersion: "iOS 19.1"
    });
    const deviceId = registered.body.id as string;
    expect(deviceId).toBeTruthy();
    // 푸시 토큰 원문은 응답에 다시 노출하지 않는다.
    expect(registered.body.pushToken).toBeUndefined();

    // 2) 같은 사용자 + 같은 토큰 재등록(앱 재시작 등) → 새 행 없이 기존 행 갱신.
    const refreshed = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "ios", pushToken, appVersion: "1.3.0" })
      .expect(200);
    expect(refreshed.body.id).toBe(deviceId);
    expect(refreshed.body.appVersion).toBe("1.3.0");
    // 갱신 요청이 notificationEnabled를 보내지 않으면 기존 토글 상태 유지.
    expect(refreshed.body.notificationEnabled).toBe(true);

    const rows = await prisma.userDevice.findMany({ where: { pushToken } });
    expect(rows).toHaveLength(1);

    // 3) 알림 토글 off → on.
    const disabled = await request(app.getHttpServer())
      .patch(`/api/v1/me/devices/${deviceId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ notificationEnabled: false })
      .expect(200);
    expect(disabled.body.notificationEnabled).toBe(false);

    // 토글 off 상태는 같은 토큰 재등록(값 미지정)에도 유지된다.
    const reRegistered = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "ios", pushToken })
      .expect(200);
    expect(reRegistered.body.notificationEnabled).toBe(false);

    const enabled = await request(app.getHttpServer())
      .patch(`/api/v1/me/devices/${deviceId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ notificationEnabled: true })
      .expect(200);
    expect(enabled.body.notificationEnabled).toBe(true);

    // 4) 목록 조회에도 반영.
    const listed = await request(app.getHttpServer())
      .get("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(listed.body.devices.some((device: { id: string }) => device.id === deviceId)).toBe(true);
  });

  it("keeps devices per-user: another user cannot toggle someone else's device (404, no existence leak)", async () => {
    const ownerToken = await login(app);
    const strangerToken = await login(app);
    const pushToken = `expo-push-${randomUUID()}`;

    const registered = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "android", pushToken })
      .expect(200);
    const deviceId = registered.body.id as string;

    // 남의 기기 id: 존재 여부를 흘리지 않도록 403이 아닌 404.
    await request(app.getHttpServer())
      .patch(`/api/v1/me/devices/${deviceId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ notificationEnabled: false })
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe("DEVICE_NOT_FOUND"));

    // 존재하지 않는 id / uuid 형식이 아닌 id도 동일하게 404.
    await request(app.getHttpServer())
      .patch(`/api/v1/me/devices/${randomUUID()}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ notificationEnabled: false })
      .expect(404);
    await request(app.getHttpServer())
      .patch("/api/v1/me/devices/not-a-uuid")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ notificationEnabled: false })
      .expect(404);

    // 같은 푸시 토큰이라도 사용자가 다르면 별도의 기기 행으로 등록된다.
    const strangerDevice = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ platform: "android", pushToken })
      .expect(200);
    expect(strangerDevice.body.id).not.toBe(deviceId);

    // 원래 소유자의 토글 상태는 그대로.
    const owned = await request(app.getHttpServer())
      .get("/api/v1/me/devices")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    const ownerRow = owned.body.devices.find((device: { id: string }) => device.id === deviceId);
    expect(ownerRow.notificationEnabled).toBe(true);
  });
});
