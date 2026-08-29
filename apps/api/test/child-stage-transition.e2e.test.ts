import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { childSchema, updateChildRequestSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * CHILD-127: 임신(pregnant) 중 가입한 사용자의 아이가 태어났을 때 stageMode를 born으로
 * 넘기는 단방향 전환. 예전에는 전환 수단이 아예 없어서 birthDate를 채울 방법이 없었고,
 * 그 결과 100일/첫돌 리포트가 MILESTONE_UNAVAILABLE로 영구히 막히고 단계 계산이
 * 출산예정일에 고정됐다.
 */
async function login(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `child127-${randomUUID()}` })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function acceptConsents(app: INestApplication, accessToken: string) {
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
}

describe("CHILD-127 아이 상태 전환 (임신 → 출생)", () => {
  let app: INestApplication;
  let accessToken: string;
  let householdId: string;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // d100 창 [2026-03-01, 2026-06-09) 가 아직 안 끝난 시점 -- partial 응답을 검증한다.
    process.env.WOORIAI_STAGE_TODAY = "2026-04-10";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    accessToken = await login(app);
    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    householdId = me.body.households[0].id as string;
    await acceptConsents(app, accessToken);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  const createPregnantChild = async (dueDate = "2026-05-20") =>
    (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "튼튼이", stageMode: "pregnant", dueDate })
        .expect(200)
    ).body.id as string;

  it("turns a pregnant child into a born one, keeps the due date, and unblocks the milestone report", async () => {
    const childId = await createPregnantChild();

    // 전환 전: 출산예정일 기준 단계에 고정되어 있고 100일 리포트는 막혀 있다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.stageMode).toBe("pregnant");
        expect(body.birthDate).toBeNull();
        expect(body.currentStage).toMatch(/^pregnancy_/);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone?type=d100`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("MILESTONE_UNAVAILABLE");
      });

    const transitionBody = { stageMode: "born", birthDate: "2026-03-01" };
    // 계약 미러: 클라이언트가 보내는 바디가 공유 스키마를 통과해야 한다.
    expect(updateChildRequestSchema.parse(transitionBody)).toEqual(transitionBody);

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(transitionBody)
      .expect(200)
      .expect(({ body }) => {
        childSchema.parse(body);
        expect(body.stageMode).toBe("born");
        expect(body.birthDate).toBe("2026-03-01");
        // dueDate는 보존된다 (컬럼 유지) -- 단계 계산만 birthDate로 넘어간다.
        expect(body.dueDate).toBe("2026-05-20");
        expect(body.currentStage).toBe("newborn_0_3");
      });

    // 목록/조회에도 그대로 반영된다 (한 번의 PATCH로 영구 전환).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "born", birthDate: "2026-03-01", dueDate: "2026-05-20" });
      });

    // 핵심 결함 해소: 100일 리포트가 (아직 진행 중이므로 partial로) 응답한다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone?type=d100`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          childId,
          type: "d100",
          startDate: "2026-03-01",
          endDate: "2026-06-08",
          partial: true,
          daysCovered: 41
        });
      });
  });

  it("refuses the reverse transition with CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED", async () => {
    const childId = await createPregnantChild();
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "born", birthDate: "2026-03-01" })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "pregnant", dueDate: "2026-05-20" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED");
      });

    // 되돌리기가 거부된 뒤에도 저장된 값은 그대로다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "born", birthDate: "2026-03-01" });
      });
  });

  it("refuses every other stage-mode move (manual in either direction)", async () => {
    const pregnantChildId = await createPregnantChild();
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${pregnantChildId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED");
      });

    const manualChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "직접선택", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${manualChildId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "born", birthDate: "2026-03-01" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED");
      });
  });

  it("requires the birth date in the same request as the transition", async () => {
    const childId = await createPregnantChild();

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "born" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_STAGE_INPUT_REQUIRED");
        expect(body.error.message).toBe("아이 생년월일을 입력해 주세요.");
      });

    // 실패한 전환은 아무것도 바꾸지 않는다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "pregnant", birthDate: null });
      });
  });

  it("rejects a malformed stage mode as a validation error, not a transition error", async () => {
    const childId = await createPregnantChild();
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "hatched", birthDate: "2026-03-01" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("stays backward compatible: PATCH without stageMode still edits in place", async () => {
    const childId = await createPregnantChild();

    // 기존 클라이언트 그대로 (stageMode 미전송) -- 예정일 수정과 개명이 계속 동작한다.
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "반짝이", dueDate: "2026-06-01" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ nickname: "반짝이", stageMode: "pregnant", dueDate: "2026-06-01" });
      });

    // 같은 stageMode를 그대로 되보내는 것은 전환이 아니므로 허용된다.
    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ stageMode: "pregnant", dueDate: "2026-06-02" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ stageMode: "pregnant", dueDate: "2026-06-02" });
      });
  });

  it("keeps the transition behind the same edit permission as every other child write", async () => {
    const childId = await createPregnantChild();
    const strangerToken = await login(app);

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ stageMode: "born", birthDate: "2026-03-01" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("FORBIDDEN");
      });
  });

  /**
   * R27(L-6): birthDate 미래 날짜 서버측 거부. 모바일 UI는 이미
   * (child-form.ts의 isFutureSeoulDate 가드로) 막고 있었지만 API를 직접 호출하면
   * 뚫렸고, 그렇게 들어온 아이는 생후 0개월에 고정되고 100일/첫돌 창이 미래에서
   * 시작했다. 생성·전환·단순 수정 세 경로를 모두 고정한다.
   *
   * 기준일은 이 파일의 WOORIAI_STAGE_TODAY = 2026-04-10 (서울 기준 "오늘").
   */
  describe("R27(L-6) 미래 생년월일 거부", () => {
    const TODAY = "2026-04-10";
    const TOMORROW = "2026-04-11";

    const expectFutureBirthDateError = ({ body }: { body: { error: { code: string; message: string } } }) => {
      expect(body.error.code).toBe("CHILD_BIRTH_DATE_FUTURE");
      expect(body.error.message).toBe("출생일은 오늘보다 미래일 수 없어요.");
    };

    it("refuses to create a born child with a future birth date", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "미래둥이", stageMode: "born", birthDate: TOMORROW })
        .expect(400)
        .expect(expectFutureBirthDateError);

      // 거부된 생성은 아무것도 남기지 않는다.
      await request(app.getHttpServer())
        .get("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.children).toHaveLength(0);
        });
    });

    it("refuses a future birth date even when it rides along with another stage mode", async () => {
      // pregnant/manual로 만들면서 미래 birthDate를 심어두면 나중 전환·마일스톤에서 되살아난다.
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          householdId,
          nickname: "몰래둥이",
          stageMode: "pregnant",
          dueDate: "2026-05-20",
          birthDate: TOMORROW
        })
        .expect(400)
        .expect(expectFutureBirthDateError);
    });

    it("allows today's date as a birth date (Seoul boundary)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "오늘둥이", stageMode: "born", birthDate: TODAY })
        .expect(200)
        .expect(({ body }) => {
          childSchema.parse(body);
          expect(body).toMatchObject({ stageMode: "born", birthDate: TODAY });
        });
    });

    it("refuses the pregnant → born transition when the birth date is in the future", async () => {
      const childId = await createPregnantChild();

      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ stageMode: "born", birthDate: TOMORROW })
        .expect(400)
        .expect(expectFutureBirthDateError);

      // 실패한 전환은 아무것도 바꾸지 않는다 — 임신 상태 그대로.
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ stageMode: "pregnant", birthDate: null });
        });
    });

    it("still allows the transition on the boundary day itself", async () => {
      const childId = await createPregnantChild();

      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ stageMode: "born", birthDate: TODAY })
        .expect(200)
        .expect(({ body }) => {
          childSchema.parse(body);
          expect(body).toMatchObject({ stageMode: "born", birthDate: TODAY });
        });
    });

    it("refuses a plain birth-date edit into the future on an already-born child", async () => {
      const childId = await createPregnantChild();
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ stageMode: "born", birthDate: "2026-03-01" })
        .expect(200);

      // 전환이 아닌 단순 수정(stageMode 미전송)도 같은 규칙을 받는다.
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ birthDate: TOMORROW })
        .expect(400)
        .expect(expectFutureBirthDateError);

      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.birthDate).toBe("2026-03-01");
        });
    });

    it("leaves the due date alone — a future due date is the normal case", async () => {
      // dueDate에는 이 규칙(미래 금지)을 적용하지 않는다 — 출산 예정일은 미래인 것이 정상이다.
      // 라운드 67 B: 그 미래의 **끝**은 만삭이고, 그 경계는 아래 describe가 따로 고정한다.
      const childId = await createPregnantChild("2026-12-25");
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ dueDate: "2027-01-10" })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ stageMode: "pregnant", dueDate: "2027-01-10" });
        });
    });
  });

  /**
   * 라운드 67 B: 출산 예정일의 **위쪽 경계**. 예정일이 미래인 것은 정상이지만 무한히 먼
   * 미래가 정상인 것은 아니다 — 임신에는 만삭이라는 끝이 있고, 앱의 달력 픽커는 라운드 65 D
   * 부터 거기서 잠긴다. 그런데 그 옆의 손타이핑 칸도, 서버도 그 경계를 몰라서
   * `2026-11-14` → `2062-11-14` 오타가 그대로 저장됐다. 그렇게 저장된 아이는 도메인의 주차
   * 계산이 0으로 clamp되면서 임신 0주차로 굳고, 준비템 탭이 임신 초기 밴드에 영영 고정된다.
   * 앱 폼(apps/mobile/src/children/child-form.ts)이 같은 규칙을 갖되, 그 폼을 우회한 API
   * 호출을 막는 것이 서버 가드의 몫이다(R27 L-6이 birthDate에 세운 선례 그대로).
   *
   * 기준일은 이 파일의 WOORIAI_STAGE_TODAY = 2026-04-10 (서울 기준 "오늘").
   * 만삭(40주 = 280일)이 되는 날은 2027-01-15 — 그날까지는 통과하고 그 다음 날부터 거절된다.
   */
  describe("라운드 67 B 만삭보다 먼 출산 예정일 거부", () => {
    const FULL_TERM_DAY = "2027-01-15";
    const ONE_DAY_TOO_FAR = "2027-01-16";
    const TYPO_DUE_DATE = "2062-11-14";

    const expectBeyondTermError = ({ body }: { body: { error: { code: string; message: string } } }) => {
      expect(body.error.code).toBe("CHILD_DUE_DATE_BEYOND_TERM");
      // 앱이 폼에서 내는 문장과 **글자까지 같다**(child-form.ts의 CHILD_DUE_DATE_BEYOND_TERM_ERROR).
      expect(body.error.message).toBe("만삭(40주)보다 먼 날은 고를 수 없어요.");
    };

    it("refuses to create a pregnant child with a due date beyond full term", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "오타둥이", stageMode: "pregnant", dueDate: TYPO_DUE_DATE })
        .expect(400)
        .expect(expectBeyondTermError);

      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "하루초과", stageMode: "pregnant", dueDate: ONE_DAY_TOO_FAR })
        .expect(400)
        .expect(expectBeyondTermError);

      // 거부된 생성은 아무것도 남기지 않는다.
      await request(app.getHttpServer())
        .get("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.children).toHaveLength(0);
        });
    });

    it("accepts the full-term day itself — the calendar picker opens that day too", async () => {
      const childId = await createPregnantChild(FULL_TERM_DAY);
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ stageMode: "pregnant", dueDate: FULL_TERM_DAY });
        });
    });

    it("refuses a beyond-term due date on PATCH and keeps the stored one", async () => {
      const childId = await createPregnantChild("2026-05-20");
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ dueDate: TYPO_DUE_DATE })
        .expect(400)
        .expect(expectBeyondTermError);

      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.dueDate).toBe("2026-05-20");
        });
    });

    it("only checks the due date this request actually sent (별명만 고치는 PATCH는 막지 않는다)", async () => {
      const childId = await createPregnantChild(FULL_TERM_DAY);
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ nickname: "다온이" })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ nickname: "다온이", dueDate: FULL_TERM_DAY });
        });
    });

    /**
     * 라운드 67 적대 리뷰(#4) — **이미 저장돼 있는 범위 밖 예정일.**
     *
     * 위 테스트는 예정일이 **범위 안**인 아이로 "별명만 고치는 PATCH는 막지 않는다"를 봤다.
     * 그런데 이 가드가 실제로 지켜야 할 사람은 그 아이가 아니라 **가드가 생기기 전에
     * `2062-11-14`를 저장해 버린 사람**이다(이 규칙을 만든 이유가 그 오타다). 그 계정에서
     * 별명 하나를 고치려는 PATCH가 저장된 값 때문에 400을 맞으면, 오타를 고칠 화면에 닿기도
     * 전에 계정이 잠긴다 — 그리고 그 조건은 API로는 만들 수 없다(생성·수정이 둘 다 막혀 있다).
     * 그래서 prisma로 직접 심는다: **판정 대상은 이번 요청이 실제로 보낸 값**뿐이라는 계약을
     * 저장된 값이 어긋난 상태에서 고정한다.
     */
    it("이미 저장된 범위 밖 예정일은 별명만 고치는 PATCH를 막지 않는다 (prisma로 직접 심은 계정)", async () => {
      const prisma = app.get(PrismaService);
      const legacy = await prisma.child.create({
        data: { householdId, nickname: "오타로 저장된 아이", stageMode: "pregnant", dueDate: new Date(`${TYPO_DUE_DATE}T00:00:00.000Z`) },
        select: { id: true }
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/children/${legacy.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ nickname: "다온이" })
        .expect(200)
        .expect(({ body }) => {
          childSchema.parse(body);
          // 별명은 바뀌고, 저장돼 있던 값은 그대로다(이 PATCH가 고치겠다고 한 값이 아니다).
          expect(body).toMatchObject({ nickname: "다온이", stageMode: "pregnant", dueDate: TYPO_DUE_DATE });
        });

      // 그 값을 **실제로 고치려 할 때는** 종전대로 막힌다(가드가 느슨해진 것이 아니다).
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${legacy.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ dueDate: TYPO_DUE_DATE })
        .expect(400)
        .expect(expectBeyondTermError);

      // 범위 안의 날로 고치는 길은 열려 있다 — 그것이 이 사람이 가야 할 출구다.
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${legacy.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ dueDate: FULL_TERM_DAY })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ nickname: "다온이", dueDate: FULL_TERM_DAY });
        });
    });

    it("does not touch the past-due-date branch (지난 예정일은 정상 입력이다)", async () => {
      const childId = await createPregnantChild("2026-03-01");
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.dueDate).toBe("2026-03-01");
        });
    });
  });

  /**
   * 라운드 68 A: 출생일의 **아래쪽 경계**(20년). 라운드 67 B가 예정일의 위쪽만 막았고, 출생일의
   * 과거 쪽에는 경계가 없었다 — 그런데 **같은 칸의 달력 픽커는 20년에서 잠긴다**(라운드 65 D).
   * 그래서 `2026` → `2016` 같은 오타나 폼을 우회한 API 호출이 그대로 저장됐고, 그 아이의 홈은
   * "생후 117개월"을, 단계는 elementary를 그렸다(더 먼 값이면 도메인의 마지막 밴드가 열려 있어
   * 전부 middle_school로 받는다). 앱 폼(child-form.ts의 computeDateError)이 같은 규칙을 갖되,
   * 그 폼을 우회한 호출을 막는 것이 서버 가드의 몫이다 — R27 L-6 · 라운드 67 B와 같은 형태다.
   *
   * 기준일은 이 파일의 WOORIAI_STAGE_TODAY = 2026-04-10 (서울 기준 "오늘").
   * 하한은 240개월 전 **달의 1일** = 2006-04-01 — 그날까지는 통과하고 그 전날부터 거절된다
   * (달력 픽커의 과거 바닥이 달 단위라 하한도 그 달의 1일이다 — packages/domain/src/money-date.ts).
   */
  describe("라운드 68 A 20년보다 오래된 출생일 거부", () => {
    const FLOOR_DAY = "2006-04-01";
    const ONE_DAY_TOO_OLD = "2006-03-31";
    const TYPO_BIRTH_DATE = "1926-08-14";

    const expectTooOldError = ({ body }: { body: { error: { code: string; message: string } } }) => {
      expect(body.error.code).toBe("CHILD_BIRTH_DATE_TOO_OLD");
      // 앱이 폼에서 내는 문장과 **글자까지 같다**(child-form.ts의 CHILD_BIRTH_DATE_TOO_OLD_ERROR,
      // 그리고 지출 폼의 EXPENSE_DATE_TOO_OLD_ERROR — 같은 경계를 세 자리가 한 문장으로 부른다).
      expect(body.error.message).toBe("20년보다 오래된 날은 고를 수 없어요.");
    };

    const createBornChild = async (birthDate: string) =>
      (
        await request(app.getHttpServer())
          .post("/api/v1/children")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ householdId, nickname: "튼튼이", stageMode: "born", birthDate })
          .expect(200)
      ).body.id as string;

    it("경계 세 값 — 하한 당일 통과 · 하루 넘김 거부 · 오늘 통과", async () => {
      const floorChildId = await createBornChild(FLOOR_DAY);
      await request(app.getHttpServer())
        .get(`/api/v1/children/${floorChildId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ stageMode: "born", birthDate: FLOOR_DAY });
        });

      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "하루초과", stageMode: "born", birthDate: ONE_DAY_TOO_OLD })
        .expect(400)
        .expect(expectTooOldError);

      const todayChildId = await createBornChild("2026-04-10");
      await request(app.getHttpServer())
        .get(`/api/v1/children/${todayChildId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.birthDate).toBe("2026-04-10");
        });
    });

    it("refuses a too-old birth date on create, on PATCH, and on the born transition", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "오타둥이", stageMode: "born", birthDate: TYPO_BIRTH_DATE })
        .expect(400)
        .expect(expectTooOldError);

      // stageMode와 무관하게 본다 — pregnant로 만들면서 심어둔 값이 나중 전환에서 되살아나면 안 된다.
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "숨은오타", stageMode: "pregnant", dueDate: "2026-05-20", birthDate: TYPO_BIRTH_DATE })
        .expect(400)
        .expect(expectTooOldError);

      const bornChildId = await createBornChild("2025-06-15");
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${bornChildId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ birthDate: TYPO_BIRTH_DATE })
        .expect(400)
        .expect(expectTooOldError);

      // 거절된 수정이 저장된 값을 건드리지 않았는지까지 본다(부분 적용 금지).
      await request(app.getHttpServer())
        .get(`/api/v1/children/${bornChildId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.birthDate).toBe("2025-06-15");
        });

      // 출생 전환 입구도 같은 방어선을 지난다(폼을 우회한 호출을 막는 것이 이 가드의 존재 이유다).
      const pregnantChildId = await createPregnantChild();
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${pregnantChildId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ stageMode: "born", birthDate: TYPO_BIRTH_DATE })
        .expect(400)
        .expect(expectTooOldError);
    });

    it("미래 갈래는 종전 그대로다(두 경계가 서로 다른 코드로 말한다)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "미래둥이", stageMode: "born", birthDate: "2999-01-01" })
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe("CHILD_BIRTH_DATE_FUTURE");
        });
    });

    it("예정일에는 이 하한이 붙지 않는다(과거 예정일 허용 무변경)", async () => {
      const childId = await createPregnantChild(ONE_DAY_TOO_OLD);
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ stageMode: "pregnant", dueDate: ONE_DAY_TOO_OLD });
        });
    });

    /**
     * 라운드 67 적대 리뷰 #4와 같은 자리 — **이미 저장돼 있는 범위 밖 출생일.** 이 가드가 실제로
     * 지켜야 할 사람은 가드가 생기기 전에 그 값을 저장해 버린 사람이고, 그 계정에서 별명 하나를
     * 고치려는 PATCH가 저장된 값 때문에 400을 맞으면 오타를 고칠 화면에 닿기도 전에 잠긴다.
     * 그 조건은 이제 API로 만들 수 없으므로 prisma로 직접 심는다.
     */
    it("이미 저장된 범위 밖 출생일은 별명만 고치는 PATCH를 막지 않는다 (prisma로 직접 심은 계정)", async () => {
      const prisma = app.get(PrismaService);
      const legacy = await prisma.child.create({
        data: {
          householdId,
          nickname: "오타로 저장된 아이",
          stageMode: "born",
          birthDate: new Date(`${TYPO_BIRTH_DATE}T00:00:00.000Z`)
        },
        select: { id: true }
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/children/${legacy.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ nickname: "다온이" })
        .expect(200)
        .expect(({ body }) => {
          childSchema.parse(body);
          expect(body).toMatchObject({ nickname: "다온이", stageMode: "born", birthDate: TYPO_BIRTH_DATE });
        });

      // 범위 안의 날로 고치는 길은 열려 있다 — 그것이 이 사람이 가야 할 출구다.
      await request(app.getHttpServer())
        .patch(`/api/v1/children/${legacy.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ birthDate: FLOOR_DAY })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ nickname: "다온이", birthDate: FLOOR_DAY });
        });
    });
  });
});
