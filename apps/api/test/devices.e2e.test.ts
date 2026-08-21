import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { DevicesService } from "../src/devices/devices.service";
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

  it("rejects an oversized pushToken with 400 VALIDATION_ERROR before it can hit the btree index size limit (no 500)", async () => {
    const accessToken = await login(app);

    // The (user_id, push_token) btree unique index fails with a non-P2002
    // "index row size exceeds maximum" error for tokens ~>2700 bytes, which the
    // P2002-retry path can't handle -> unhandled 500. The DTO's MaxLength(2000)
    // must reject such tokens as a clean validation error instead.
    await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "ios", pushToken: "x".repeat(2500) })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
        const fields = body.error.details.fields as Array<{ field: string }>;
        expect(fields.some((field) => field.field === "pushToken")).toBe(true);
      });

    // Boundary: a 2000-char token is still accepted (real Expo/FCM tokens are far shorter).
    await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "ios", pushToken: "y".repeat(2000) })
      .expect(200);
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

  it("regression: concurrent same-token registrations end up as ONE row (DB unique constraint + P2002-retry), the loser updating instead of duplicating", async () => {
    const accessToken = await login(app);
    const pushToken = `expo-push-${randomUUID()}`;

    // Both requests race through the findFirst -> create path at once. Without
    // the (user_id, push_token) unique index (migration 000010) this produced
    // two device rows; now the create-race loser catches P2002 and updates the
    // winner's row instead.
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/me/devices")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform: "ios", pushToken, appVersion: "1.0.0" }),
      request(app.getHttpServer())
        .post("/api/v1/me/devices")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform: "ios", pushToken, appVersion: "1.0.1" })
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.id).toBe(second.body.id);

    const rows = await prisma.userDevice.findMany({ where: { pushToken } });
    expect(rows).toHaveLength(1);

    // A second (sequential) registration with the same token updates that row.
    const reRegistered = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "ios", pushToken, appVersion: "2.0.0" })
      .expect(200);
    expect(reRegistered.body.id).toBe(rows[0].id);
    expect(reRegistered.body.appVersion).toBe("2.0.0");
    expect(await prisma.userDevice.count({ where: { pushToken } })).toBe(1);

    // The DB constraint itself is the last line of defense: a raw duplicate
    // insert for the same (user_id, push_token) pair is rejected outright.
    await expect(
      prisma.userDevice.create({
        data: { userId: rows[0].userId, platform: "ios", pushToken, notificationEnabled: true }
      })
    ).rejects.toMatchObject({ code: "P2002" });
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

    // 원래 소유자의 행은 남아 있되(삭제 아님), FIX-118B(F1)에 따라 알림은 꺼진다.
    const owned = await request(app.getHttpServer())
      .get("/api/v1/me/devices")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    const ownerRow = owned.body.devices.find((device: { id: string }) => device.id === deviceId);
    expect(ownerRow).toBeTruthy();
    expect(ownerRow.notificationEnabled).toBe(false);
  });

  // FIX-118B(F1): 공유 기기 계정 전환 — 같은 푸시 토큰을 새 사용자가 등록하면
  // 이전 사용자의 행은 notificationEnabled=false로 내려가야 한다. 그렇지 않으면
  // 이전 계정의 푸시가 지금 기기를 쓰는 사람에게 배달된다(크로스계정 누수).
  it("deactivates the same pushToken registered by ANOTHER user (shared-device account switch), and excludes it from push dispatch", async () => {
    const devicesService = moduleRef.get(DevicesService, { strict: false });
    const tokenA = await login(app);
    const tokenB = await login(app);
    const pushToken = `expo-push-shared-${randomUUID()}`;

    // A가 기기를 등록한다(알림 on).
    const deviceA = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ platform: "android", pushToken, appVersion: "1.0.0" })
      .expect(200);
    const deviceAId = deviceA.body.id as string;
    expect(deviceA.body.notificationEnabled).toBe(true);

    const rowA = await prisma.userDevice.findUniqueOrThrow({ where: { id: deviceAId } });
    expect((await devicesService.findActivePushDevices([rowA.userId])).map((device) => device.id)).toContain(deviceAId);

    // 같은 기기에서 B로 로그인 → 같은 푸시 토큰으로 등록.
    const deviceB = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ platform: "android", pushToken })
      .expect(200);
    const deviceBId = deviceB.body.id as string;
    expect(deviceBId).not.toBe(deviceAId);
    expect(deviceB.body.notificationEnabled).toBe(true);

    // A의 행은 지워지지 않고 알림만 꺼진다.
    const deactivatedA = await prisma.userDevice.findUniqueOrThrow({ where: { id: deviceAId } });
    expect(deactivatedA.notificationEnabled).toBe(false);
    expect(deactivatedA.pushToken).toBe(pushToken);

    // 발송 대상 조회(PUSH-113)에서 A는 빠지고 B만 남는다.
    const rowB = await prisma.userDevice.findUniqueOrThrow({ where: { id: deviceBId } });
    const dispatchTargets = await devicesService.findActivePushDevices([rowA.userId, rowB.userId]);
    const targetIds = dispatchTargets.map((device) => device.id);
    expect(targetIds).not.toContain(deviceAId);
    expect(targetIds).toContain(deviceBId);

    // A의 다른 기기(다른 토큰)는 영향을 받지 않는다.
    const otherToken = `expo-push-other-${randomUUID()}`;
    const otherDevice = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ platform: "ios", pushToken: otherToken })
      .expect(200);
    const stillTargets = (await devicesService.findActivePushDevices([rowA.userId])).map((device) => device.id);
    expect(stillTargets).toEqual([otherDevice.body.id]);

    // A가 다시 이 기기를 잡으면(재등록) 알림이 되살아나고 B가 꺼진다 — 대칭 동작.
    const reclaimed = await request(app.getHttpServer())
      .post("/api/v1/me/devices")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ platform: "android", pushToken, notificationEnabled: true })
      .expect(200);
    expect(reclaimed.body.id).toBe(deviceAId);
    expect(reclaimed.body.notificationEnabled).toBe(true);
    expect((await prisma.userDevice.findUniqueOrThrow({ where: { id: deviceBId } })).notificationEnabled).toBe(false);
  });
});
