import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { errorResponseSchema, versionConflictResponseSchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * MOB-103 (design doc docs/5차/round5a-sprint1-plan.md §2.1-2.2): expense
 * `version` bookkeeping and the `expectedVersion` optimistic-concurrency branch
 * on PATCH/DELETE /v1/expenses/:id, implemented in
 * src/finance/expenses.service.ts (ExpensesVersionService) precisely so this
 * work never has to touch onboarding/onboarding-store.service.ts, which other
 * work this sprint owns concurrently.
 */
describe.skipIf(!dbAvailable)("Expense optimistic concurrency (version, real Postgres)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    deployMigrations();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  async function login(prefix: string) {
    const providerToken = `${prefix}-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken })
      .expect(200);
    return response.body.tokens.accessToken as string;
  }

  async function completeOnboarding(accessToken: string) {
    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
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

    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "버전테스트", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    return { childId, householdId };
  }

  async function createExpense(accessToken: string, childId: string, itemName: string) {
    return (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 10000, spentOn: "2026-07-06", itemName })
        .expect(200)
    ).body as { id: string; version: number };
  }

  it("starts every new expense at version 1, exposed on create/get/list/home", async () => {
    const accessToken = await login("version-create");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전1 기저귀");
    expect(created.version).toBe(1);

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe(1));

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses.find((expense: { id: string }) => expense.id === created.id).version).toBe(1);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.recentExpenses[0].version).toBe(1);
      });
  });

  it("increments version on update, with or without expectedVersion, and rejects a stale expectedVersion with 409 VERSION_CONFLICT + current", async () => {
    const accessToken = await login("version-update");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전2 분유");
    expect(created.version).toBe(1);

    // Legacy path: no expectedVersion -> existing behavior, but version still advances.
    const afterLegacyUpdate = (
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 20000 })
        .expect(200)
    ).body as { version: number };
    expect(afterLegacyUpdate.version).toBe(2);

    // Correct expectedVersion -> succeeds and advances again.
    const afterConditionalUpdate = (
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 30000, expectedVersion: 2 })
        .expect(200)
    ).body as { version: number };
    expect(afterConditionalUpdate.version).toBe(3);

    // Stale expectedVersion (server is now at 3) -> 409 with the current server state.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 99999, expectedVersion: 2 })
      .expect(409)
      .expect(({ body }) => {
        // CON-115: 409 바디 전체가 공유 계약({error:{...}, current})에 맞아야 한다.
        versionConflictResponseSchema.parse(body);
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toMatchObject({ id: created.id, version: 3, amountKrw: 30000 });
      });

    // The rejected conditional update must not have applied its payload.
    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountKrw).toBe(30000);
        expect(body.version).toBe(3);
      });
  });

  /**
   * 라운드 48 QA(P2-6) — 409 `current` 스냅숏이 결제 수단을 싣는다.
   *
   * `toExpenseSnapshot`은 주석에서 "store-shared.ts toExpenseDto의 미러 + version"이라고
   * 선언해 두고도 `paymentMethod`/`linkedItemTemplateId`를 빠뜨리고 있었다(두 필드는 라운드 48
   * T3에서 toExpenseDto에 열렸다). 그 누락이 사용자에게 닿던 자리가 앱의 충돌 화면
   * "두 값 나란히 보기"다: 로컬 대기 행에는 사용자가 고른 결제 수단이 있는데 서버 스냅숏에는
   * 그 키가 아예 없으니, **바꾼 적 없는 결제 수단이 매번 충돌 항목으로** 뜨고 서버 쪽 값은
   * "없음"으로 그려졌다 — 서버가 실제로 들고 있는 값을 두고 없다고 말하는 허위 표시다.
   *
   * 그리고 PATCH가 `paymentMethod`를 받는다: 충돌 화면이 이 필드를 고르게 해 놓고 그 선택을
   * 보낼 자리가 없으면(전역 ValidationPipe가 forbidNonWhitelisted라 실으면 400) 화면이 물어보고
   * 조용히 무시하는 셈이 된다.
   */
  it("409 current가 paymentMethod/linkedItemTemplateId를 싣고, PATCH가 paymentMethod를 받는다", async () => {
    const accessToken = await login("version-payment-method");
    const { childId } = await completeOnboarding(accessToken);

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 10000,
          spentOn: "2026-07-06",
          itemName: "결제수단 스냅숏",
          paymentMethod: "card"
        })
        .expect(200)
    ).body as { id: string; version: number; paymentMethod: string };
    expect(created.paymentMethod).toBe("card");

    // ① PATCH가 결제 수단을 실제로 받아 반영한다(예전에는 400 VALIDATION_ERROR였다).
    const updated = (
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ paymentMethod: "transfer", expectedVersion: created.version })
        .expect(200)
    ).body as { version: number; paymentMethod: string };
    expect(updated.paymentMethod).toBe("transfer");
    expect(updated.version).toBe(created.version + 1);

    // ② 낡은 expectedVersion으로 부딪히면, 409의 current가 **서버가 아는 결제 수단 그대로**를
    //    싣는다. 이 값이 없으면 앱 충돌 화면이 "없음"으로 그린다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 55000, expectedVersion: created.version })
      .expect(409)
      .expect(({ body }) => {
        versionConflictResponseSchema.parse(body);
        expect(body.current).toMatchObject({
          id: created.id,
          paymentMethod: "transfer",
          linkedItemTemplateId: null
        });
      });

    // ③ 모르는 결제 수단은 여전히 거절한다 — 계약을 넓힌 것이지 검증을 푼 것이 아니다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ paymentMethod: "crypto" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
  });

  /**
   * 라운드 108 T24 후속 — **정상 경로의 409 `current`가 무엇을 싣는지 실선으로 적는다.**
   *
   * 위 두 테스트는 `toMatchObject`로 **몇 축만** 집어 봤다(그때는 그것이 목적이었다 —
   * 하나는 version/amountKrw, 하나는 paymentMethod 회귀). 그래서 "이 응답이 실어 보내는 것의
   * 전부"는 이 파일 어디에도 값으로 없었고, 축이 **줄어도 늘어도** 아무 단언이 움직이지 않았다.
   *
   * 그 공백이 실제로 문제인 이유는 두 방향이다:
   *  · **줄어들면** 모바일 충돌 화면이 부서진다. "두 값 나란히 보기"의 비교 항목 여덟 축
   *    (apps/mobile/src/offline/sync-engine.ts `diffExpenseFields`)에 품목명·판매처·메모가
   *    들어 있어서, 서버 스냅숏에서 그 키가 사라지면 화면은 로컬 값과 "없음"을 비교하게 된다 —
   *    라운드 48 QA(P2-6)가 `paymentMethod` 하나 빠졌을 때 실측한 그 허위 표시 그대로다.
   *  · **늘어나면** 이 응답이 조용히 새 표면이 된다. 이 값은 라운드 107이 감사 봉투에서 빼낸
   *    자유 문자열들을 그대로 싣는 몇 안 되는 경로다.
   *
   * 그래서 키 집합은 리터럴 배열로, 값은 리터럴로 잰다. `createdByUserId`만 실행 시점 값이라
   * 키 집합 쪽에서만 확인한다.
   */
  it("주인이 낡은 expectedVersion을 보낸 409의 current가 싣는 축 전량 (실선 기록)", async () => {
    const accessToken = await login("version-current-axes");
    const { childId } = await completeOnboarding(accessToken);

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 10000,
          spentOn: "2026-07-06",
          itemName: "409 원문 기저귀",
          merchant: "409 원문 상점",
          memo: "409 원문 메모",
          paymentMethod: "card"
        })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 55000, expectedVersion: 999 })
      .expect(409)
      .expect(({ body }) => {
        versionConflictResponseSchema.parse(body);
        expect(Object.keys(body.current).sort()).toEqual([
          "amountKrw",
          "categoryId",
          "childId",
          "createdByUserId",
          "expenseType",
          "id",
          "itemName",
          "linkedItemTemplateId",
          "linkedProductLinkId",
          "memo",
          "merchant",
          "paymentMethod",
          "source",
          "spentOn",
          "version"
        ]);
        expect(body.current).toMatchObject({
          id: created.id,
          childId,
          categoryId,
          amountKrw: 10000,
          spentOn: "2026-07-06",
          itemName: "409 원문 기저귀",
          merchant: "409 원문 상점",
          memo: "409 원문 메모",
          paymentMethod: "card",
          linkedItemTemplateId: null,
          linkedProductLinkId: null,
          expenseType: "expense",
          source: "manual",
          version: 1
        });
      });
  });

  it("rolls back the version bump when the conditional update's field validation fails", async () => {
    const accessToken = await login("version-rollback");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전 롤백");

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemName: "", expectedVersion: 1 })
      .expect(400);

    // A rejected (validation-failed) conditional update must not have burned the
    // version number -- the next attempt with the same expectedVersion succeeds.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 15000, expectedVersion: 1 })
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe(2));
  });

  it("conditionally deletes with expectedVersion, and returns a tombstone-shaped current on conflict", async () => {
    const accessToken = await login("version-delete");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전 삭제");

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=99`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409)
      .expect(({ body }) => {
        // CON-115: DELETE 충돌의 409 바디(살아있는 current)도 공유 계약에 맞아야 한다.
        versionConflictResponseSchema.parse(body);
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toMatchObject({ id: created.id, version: 1 });
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ success: true }));

    // Deleted expense: a further conditional update against the now-stale version
    // must 409 with a tombstone `current`, not a bare 404.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 1000, expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => {
        // CON-115: 톰스톤 current를 포함한 409 바디도 공유 계약에 맞아야 한다.
        versionConflictResponseSchema.parse(body);
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toEqual({ id: created.id, deleted: true, version: 2 });
      });
  });

  /**
   * 라운드 106 T9 — **UUID가 아닌 `:expenseId`가 500으로 새지 않는다.**
   *
   * 종전: 세 경로(GET/PATCH/DELETE) 모두 경로 파라미터를 그대로 `expenses.id`(`@db.Uuid`)
   * 술어에 실었고, Prisma가 드라이버 단에서 던진 예외(`Error creating UUID`)는 HttpException이
   * 아니라 `GlobalExceptionFilter`의 **500 "잠시 후 다시 시도해주세요."** 로 나갔다 —
   * 원인은 클라이언트가 보낸 id인데 안내는 "다시 시도"였고, 다시 눌러도 결과가 같다(DNC-018).
   * 모바일 아웃박스가 5xx를 무한 재전송하므로 그 요청 하나가 큐를 막는 poison pill이 됐다.
   *
   * 지금: **형식이 맞지만 없는 UUID와 바이트 단위로 같은 404 `EXPENSE_NOT_FOUND`** 다.
   * 이 테스트가 두 갈래를 나란히 두는 이유가 그것이다 — 새 오류 코드를 만들지 않았다는
   * 사실 자체가 계약이다(`src/finance/expenses.service.ts`의 `expenseNotFound()` 한 곳).
   */
  it("UUID가 아닌 expenseId를 500이 아니라 미존재 UUID와 같은 404 EXPENSE_NOT_FOUND로 돌려준다", async () => {
    const accessToken = await login("version-malformed-id");
    const auth = { Authorization: `Bearer ${accessToken}` };

    // 왼쪽은 UUID가 아예 아닌 id, 오른쪽은 형식은 맞지만 존재하지 않는 id.
    // 둘의 응답이 같아야 한다(상태코드·코드·문구 전부).
    for (const expenseId of ["not-a-uuid", randomUUID()]) {
      await request(app.getHttpServer())
        .get(`/api/v1/expenses/${expenseId}`)
        .set(auth)
        .expect(404)
        .expect(({ body }) => {
          errorResponseSchema.parse(body);
          expect(body.error.code).toBe("EXPENSE_NOT_FOUND");
          expect(body.error.message).toBe("지출 기록을 찾을 수 없어요.");
        });

      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${expenseId}`)
        .set(auth)
        .send({ amountKrw: 12345 })
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_NOT_FOUND"));

      // expectedVersion이 붙은 낙관적 잠금 갈래도 같은 404다(409로 갈리지 않는다 —
      // 충돌이 아니라 "그런 지출이 없다"이기 때문이다).
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${expenseId}`)
        .set(auth)
        .send({ amountKrw: 12345, expectedVersion: 1 })
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_NOT_FOUND"));

      await request(app.getHttpServer())
        .delete(`/api/v1/expenses/${expenseId}`)
        .set(auth)
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_NOT_FOUND"));

      await request(app.getHttpServer())
        .delete(`/api/v1/expenses/${expenseId}?expectedVersion=1`)
        .set(auth)
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_NOT_FOUND"));
    }
  });

  it("does not leak another household's expense version/state through a 409 conflict (IDOR)", async () => {
    const ownerToken = await login("version-idor-owner");
    const { childId } = await completeOnboarding(ownerToken);
    const created = await createExpense(ownerToken, childId, "타가구 접근 차단");

    const strangerToken = await login("version-idor-stranger");

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ amountKrw: 1, expectedVersion: 1 })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("FORBIDDEN");
        expect(body.current).toBeUndefined();
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=1`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(403);

    /**
     * 라운드 108 트랙 C(C-2 역돌연변이 소견) — **낡은 `expectedVersion`으로도 물어야 한다.**
     *
     * 종전: 위 두 호출이 `expectedVersion: 1`(= 지금 값)을 보냈다(그때는 참 — 잡으려던 것은
     * 409 payload였다). 그런데 그 값이면 CAS가 **성공**하고, 그 뒤 스토어의
     * `requireExpenseAccess`가 403을 던져 테스트가 초록이 된다 — 즉 이 파일이 소유한 인가
     * (`ExpensesVersionService.authorizeExpenseRow`)를 통째로 지워도 위 두 단언은 초록이었다.
     * 역돌연변이로 실측한 사실이고, 그 상태에서 실제로 열리는 구멍은 이것이다:
     * **CAS가 실패하는 값**(낡은 version)을 보내면 `versionConflictFor`가 남의 지출을 다시 읽어
     * 409 `current`에 품목명·판매처·메모·금액을 **그대로 실어 보낸다.**
     *
     * 지금: 낡은 값도 함께 보낸다. 이 갈래는 `authorizeExpenseRow`가 죽는 순간 403이 409로
     * 바뀌므로, 두 인가 중 이 파일 쪽 한 벌이 여기서 값으로 고정된다.
     */
    for (const staleVersion of [999]) {
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ amountKrw: 1, expectedVersion: staleVersion })
        .expect(403)
        .expect(({ body }) => {
          expect(body.error.code).toBe("FORBIDDEN");
          // 409로 갈리는 순간 여기에 남의 지출 스냅샷이 실린다 — 상태코드와 함께 값도 본다.
          expect(JSON.stringify(body)).not.toContain("타가구 접근 차단");
        });

      await request(app.getHttpServer())
        .delete(`/api/v1/expenses/${created.id}?expectedVersion=${staleVersion}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403)
        .expect(({ body }) => {
          expect(JSON.stringify(body)).not.toContain("타가구 접근 차단");
        });
    }

    // 그리고 거절당한 네 번의 호출은 그 지출의 version을 한 번도 움직이지 않았다.
    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.version).toBe(1);
        expect(body.amountKrw).toBe(10000);
      });
  });

  /**
   * 라운드 108 트랙 C(C-2) — **읽기 쪽 인가 한 벌에도 교차가구 e2e를 세운다.**
   *
   * 종전: 바로 위 테스트가 PATCH·DELETE만 낯선 토큰으로 불렀다(그때는 참 — 그 파일이 소유한
   * 것은 낙관적 잠금 계층이었다). 그런데 이 표의 인가는 **두 벌**이다:
   *   · PATCH/DELETE → `ExpensesVersionService.authorizeExpenseRow`(위 테스트가 고정)
   *   · GET(상세)    → `ExpensesStoreService.requireExpenseAccess` → `requireChildAccess`
   * 테스트가 없는 쪽이 망가지면 남의 지출 **상세**가 200으로 나간다 — 그 응답에는 라운드 107이
   * 감사 봉투에서 빼내느라 트랙 하나를 쓴 값들(품목명·판매처·메모·금액)이 그대로 들어 있다.
   *
   * 지금: GET도 같은 낯선 토큰으로 부른다. 상태·코드뿐 아니라 **응답 본문 어디에도 그 문자열이
   * 없다**는 것까지 본다 — 403이면서 오류 봉투에 품목명을 실어 보내는 회귀는 상태코드만 보는
   * 단언으로는 잡히지 않기 때문이다.
   *
   * ⚠️ 문구는 두 벌이 갈린다(PATCH/DELETE는 "지출 기록 접근 권한이 없어요.", GET은 아이 인가를
   * 타므로 "아이 프로필 접근 권한이 없어요."). 그래서 여기서 고정하는 것은 **코드**(FORBIDDEN)와
   * "값이 새지 않는다"이지 문장이 아니다 — 문장까지 같아야 한다고 쓰면 두 벌 중 하나를 옮기는
   * 정당한 변경이 이 테스트에 걸린다.
   */
  it("남의 가구 지출은 상세 조회(GET)도 403이고 응답에 품목명·금액이 실리지 않는다 (IDOR)", async () => {
    const ownerToken = await login("version-get-idor-owner");
    const { childId } = await completeOnboarding(ownerToken);
    const itemName = "타가구 상세조회 차단 기저귀";
    const created = await createExpense(ownerToken, childId, itemName);

    const strangerToken = await login("version-get-idor-stranger");

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
        // 기대값은 리터럴이다 — 응답 어디에도 그 지출의 값이 없어야 한다.
        const serialized = JSON.stringify(body);
        expect(serialized).not.toContain(itemName);
        expect(serialized).not.toContain("10000");
      });

    // 주인은 같은 경로로 그대로 읽는다 — 막힌 것은 가구 경계이지 엔드포인트가 아니다.
    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.itemName).toBe(itemName);
        expect(body.amountKrw).toBe(10000);
      });
  });
});
