import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 라운드 110 — **가져오기 파일명의 길이 경계**(`import_jobs.file_name varchar(255)`).
 *
 * 배경(두 시점): 종전에 이 상한은 `CreateExcelImportDto`의 `@MaxLength(255)` 한 자리였고,
 * 그때는 그것으로 충분했다 — 앱이 언제나 `fileName` 폼 필드를 함께 보내기 때문이다
 * (apps/mobile/src/api/client.ts의 `createExcelImport`). → 그런데 컨트롤러가 고르는 값은
 * `stringField(body.fileName) ?? file?.originalname`이라(imports.controller.ts),
 * **그 필드를 보내지 않은 멀티파트 요청**은 DTO를 지나지 않고 파일 파트의 이름이 그대로
 * 컬럼으로 갔다. 256자 파일명(실측)은 `tx.importJob.create`에서 Prisma **P2000**을 냈고,
 * 저장소 전체에 그 코드를 400으로 옮기는 핸들러가 0건이라 그대로 **500**이 됐다
 * (본문: `{"error":{"code":"INTERNAL_SERVER_ERROR","message":"잠시 후 다시 시도해주세요."}}`).
 * 그 500은 미리보기 트랜잭션 안이라 **파일 전체가 거절**되는데 사용자에게는 이유가 한 글자도
 * 가지 않는다. 즉 이 자리는 **앱이 아니라 제3자·구버전 클라이언트가 지나는 유입 지점**이다.
 *
 * 이 스위트가 무는 것:
 *  1. 경계 자체 — 255자는 통과하고 **값이 온전히 저장**되며(자르는 경로가 없다), 256자는
 *     **400**(500이 아니다)이다. 두 유입 지점(멀티파트 파일명 · `fileName` 폼 필드) 모두.
 *  2. 두 유입 지점이 **같은 봉투**를 낸다 — `VALIDATION_ERROR` + `details.fields[].field === "fileName"`.
 *     새 오류 코드를 만들지 않은 이유는 `fileNameTooLongError` 주석 참고.
 *  3. 거절된 요청은 **부수효과를 남기지 않는다**(그 아이에게 잡이 만들어지지 않는다).
 *  4. 가드가 재는 값이 **저장될 문자열 그대로**여야 한다는 사실 — multer/busboy는 파일 파트의
 *     이름을 latin1로 디코딩하므로 한글 파일명은 UTF-8 바이트 수만큼 길어진다. 여기서는 그
 *     디코딩 방식을 단언하지 않는다(그 mojibake는 이 라운드가 건드리지 않은 별건이고, 고쳐지면
 *     길이도 함께 바뀐다): **어느 쪽이든 500이 아니고, 저장됐다면 컬럼 폭을 넘지 않는다**만 문다.
 *
 * 숫자(255)는 리터럴로 적는다 — 검사 대상 코드의 상수를 import해 기대값을 만들면 상한이 어느
 * 쪽으로 움직여도 테스트가 따라 움직여 아무것도 붙잡지 못한다(idempotency-key-limit.e2e의 관례).
 *
 * 자기 행만 만들고 지운다(로그인 토큰 접두로 식별) — 공유 DB 락을 배타로 잡지 않는다.
 */
const MAX = 255;
const PROVIDER_PREFIX = "r110-import-filename";
const CHILD_NICKNAME_PREFIX = "r110파일명";

/** 파서가 한 행을 실제로 읽어 내는 최소 CSV — 잡이 `preview_ready`까지 가야 경계를 잰다. */
const CSV = "날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n";

type ValidationBody = {
  error: { code: string; details?: { fields?: { field: string; constraints: Record<string, string> }[] } };
};

function expectFileNameRejected(response: request.Response) {
  expect(response.status, `500이면 P2000이 그대로 새어 나온 것이다: ${JSON.stringify(response.body)}`).toBe(400);
  const body = response.body as ValidationBody;
  expect(body.error.code).toBe("VALIDATION_ERROR");
  const fields = body.error.details?.fields ?? [];
  const hit = fields.find((entry) => entry.field === "fileName");
  expect(hit, `fileName이 거절 사유에 없다: ${JSON.stringify(fields)}`).toBeDefined();
  expect(Object.keys(hit!.constraints)).toContain("maxLength");
}

describe("가져오기 파일명 길이 경계 (라운드 110)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `${PROVIDER_PREFIX}-${randomUUID()}` })
      .expect(200);
    return response.body.tokens.accessToken as string;
  }

  /** 가져오기는 아이 하나만 있으면 된다(준비템·예산 단계는 이 경계와 무관하다). */
  async function createChild(accessToken: string): Promise<string> {
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
        .send({
          householdId,
          nickname: `${CHILD_NICKNAME_PREFIX}${randomUUID().slice(0, 8)}`,
          stageMode: "manual",
          manualStage: "infant_4_6"
        })
        .expect(200)
    ).body.id as string;
  }

  /** `fileName` 폼 필드를 **보내지 않는** 업로드 — 파일 파트의 이름만 서버에 도착한다. */
  function uploadWithoutFileNameField(accessToken: string, childId: string, partName: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/imports/excel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from(CSV, "utf8"), partName);
  }

  /** 앱이 실제로 보내는 모양 — 폼 필드가 파일 파트 이름을 이긴다(컨트롤러의 `??`). */
  function uploadWithFileNameField(accessToken: string, childId: string, fileName: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/imports/excel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .field("fileName", fileName)
      .attach("file", Buffer.from(CSV, "utf8"), "wooriai-import.csv");
  }

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // 이 스위트가 만든 계정 subtree만 지운다. 순서는 FK 방향 그대로다:
    // import_rows -> import_jobs -> children -> household_members -> households -> 나머지 -> users.
    const users = await prisma.user.findMany({
      where: { providerUserId: { startsWith: PROVIDER_PREFIX } },
      select: { id: true }
    });
    const userIds = users.map((row) => row.id);
    if (userIds.length > 0) {
      const jobs = await prisma.importJob.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
      const jobIds = jobs.map((row) => row.id);
      if (jobIds.length > 0) {
        await prisma.importRow.deleteMany({ where: { importJobId: { in: jobIds } } });
        await prisma.importJob.deleteMany({ where: { id: { in: jobIds } } });
      }
      const households = await prisma.household.findMany({
        where: { ownerUserId: { in: userIds } },
        select: { id: true }
      });
      const householdIds = households.map((row) => row.id);
      if (householdIds.length > 0) {
        await prisma.child.deleteMany({ where: { householdId: { in: householdIds } } });
        await prisma.householdMember.deleteMany({ where: { householdId: { in: householdIds } } });
        await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
      }
      await prisma.consent.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  });

  it(`멀티파트 파일명이 ${MAX}자면 통과하고 값이 온전히 저장된다`, async () => {
    const accessToken = await login();
    const childId = await createChild(accessToken);
    const partName = `${"n".repeat(MAX - 4)}.csv`;
    expect(partName).toHaveLength(MAX);

    const response = await uploadWithoutFileNameField(accessToken, childId, partName);
    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const job = await prisma.importJob.findUnique({ where: { id: response.body.id as string } });
    // 자르지 않는다 — 잘라 저장하면 가져오기 이력이 사용자가 고른 것과 다른 이름을 말한다.
    expect(job?.fileName).toBe(partName);
  });

  it(`멀티파트 파일명이 ${MAX + 1}자면 500이 아니라 400이고, 잡이 만들어지지 않는다`, async () => {
    const accessToken = await login();
    const childId = await createChild(accessToken);
    const partName = `${"n".repeat(MAX - 3)}.csv`;
    expect(partName).toHaveLength(MAX + 1);

    expectFileNameRejected(await uploadWithoutFileNameField(accessToken, childId, partName));
    expect(await prisma.importJob.count({ where: { childId } })).toBe(0);
  });

  it(`\`fileName\` 폼 필드도 같은 경계를 지고(${MAX} 통과 / ${MAX + 1} 400) 같은 봉투를 낸다`, async () => {
    const accessToken = await login();
    const childId = await createChild(accessToken);

    const okName = `${"f".repeat(MAX - 4)}.csv`;
    const okResponse = await uploadWithFileNameField(accessToken, childId, okName);
    expect(okResponse.status, JSON.stringify(okResponse.body)).toBe(200);
    const job = await prisma.importJob.findUnique({ where: { id: okResponse.body.id as string } });
    expect(job?.fileName).toBe(okName);

    expectFileNameRejected(await uploadWithFileNameField(accessToken, childId, `${"f".repeat(MAX - 3)}.csv`));
    // 거절된 요청은 앞서 만들어진 잡 하나 말고는 아무것도 더하지 않는다.
    expect(await prisma.importJob.count({ where: { childId } })).toBe(1);
  });

  it("한글 파일명도 컬럼 폭을 넘길 수 없다 — 500이 나지 않고, 저장됐다면 폭 안이다", async () => {
    const accessToken = await login();
    const childId = await createChild(accessToken);
    // 86자면 UTF-8로 258바이트다. multer/busboy가 파일 파트 이름을 latin1로 디코딩하는 한
    // 서버가 보는 문자열은 258자이고, 그 디코딩이 언젠가 고쳐지면 86자다. 이 테스트는 둘 중
    // 어느 쪽인지 단언하지 않는다 — 어느 쪽이든 P2000이 500으로 새면 안 된다는 것만 문다.
    const partName = `${"가".repeat(86)}.csv`;

    const response = await uploadWithoutFileNameField(accessToken, childId, partName);
    expect([200, 400], `500이면 P2000이 그대로 새어 나온 것이다: ${JSON.stringify(response.body)}`).toContain(
      response.status
    );
    if (response.status === 200) {
      const job = await prisma.importJob.findUnique({ where: { id: response.body.id as string } });
      expect(job!.fileName.length).toBeLessThanOrEqual(MAX);
    } else {
      expectFileNameRejected(response);
    }
  });
});
