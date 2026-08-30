import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateChildStage, type ChildStageCode } from "@wooriai/domain";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { ContentRevisionsService } from "../src/admin/content-revisions.service";
import {
  formatMonthRange,
  judgeTimingLabelAgainstStages,
  parseBandLabelMonths,
  parseTimingLabelMonths,
  stageNotationRanges
} from "../src/onboarding/timing-label-range";
import { STAGE_BAND_LABELS, STAGE_BAND_STAGES } from "../src/items-commerce/stage-bands";
import { isDatabaseAvailable } from "./helpers/test-db";

/**
 * 라운드 76 트랙 E — **어드민이 넣은 "준비 시기"를 서버가 판정한다 (O-2 종결).**
 *
 * 라운드 74 트랙 B가 세운 `timingLabel` ↔ `stageCodes` 계약은 `seed-data.test.ts` 안에만
 * 살아서 **시드만** 물었다. 어드민 CMS의 자유 입력은 공백 정리(`cleanOptionalText`)만 지나
 * 그대로 저장됐고, 그 값은 상세 화면의 "준비 시기" **사실 줄**로 간다 — 운영자가
 * 걸음마 보조 장난감의 준비 시기를 `"12~24개월"`로 고치면 생후 8개월 부모가 `6-12개월`
 * 칩에서 연 상세가 "준비 시기: 12~24개월"이라고 말하는 자리가 그대로 남아 있었다.
 *
 * 이 파일이 무는 것 넷:
 *  ⓐ 판정 모듈이 개월 경계를 `packages/domain`에서 **파생**시킬 것(숫자를 손으로 적지 않는다),
 *  ⓑ 저장 경로가 **명백한 모순만** 400으로 거절하고 그 메시지가 어긋난 구간을 그대로 말할 것,
 *  ⓒ **파싱되지 않는 라벨·빈 라벨은 오늘과 똑같이 저장될 것**(CMS의 자유도는 줄지 않는다),
 *  ⓓ 검토(초안) 경로도 같은 판정을 지날 것(우회 0건).
 */

const adminToken = "dev-admin-token";
const dbAvailable = await isDatabaseAvailable();
const moduleSourcePath = fileURLToPath(new URL("../src/onboarding/timing-label-range.ts", import.meta.url));

// ---------------------------------------------------------------------------
// ⓐ 판정 모듈 (DB 불필요)
// ---------------------------------------------------------------------------

describe("준비 시기 판정 모듈 (라운드 76 트랙 E)", () => {
  it("개월 경계를 packages/domain에서 파생시킨다 (모듈이 숫자를 손으로 적지 않는다는 증거)", () => {
    const notation = stageNotationRanges();

    // 모듈이 돌려준 구간의 **끝**이 실제로 도메인의 경계인지 독립적으로 확인한다:
    // 그 달의 아이는 그 스테이지이고, 한 달 뒤의 아이는 더는 그 스테이지가 아니다.
    const probeToday = "2100-01-15";
    const stageAt = (ageMonths: number): ChildStageCode => {
      const totalMonths = 2100 * 12 + 0 - ageMonths;
      const birthDate = [
        String(Math.floor(totalMonths / 12)).padStart(4, "0"),
        String((totalMonths % 12) + 1).padStart(2, "0"),
        "15"
      ].join("-");
      return calculateChildStage({ stageMode: "born", birthDate, today: probeToday }).stageCode;
    };

    let checked = 0;
    for (const [stage, range] of notation) {
      if (!Number.isFinite(range.to)) continue;
      expect(stageAt(range.to), `${stage}의 끝(${range.to}개월)이 도메인 판정과 어긋난다`).toBe(stage);
      expect(stageAt(range.to + 1), `${stage} 다음 달(${range.to + 1}개월)이 아직 같은 스테이지다`).not.toBe(stage);
      checked += 1;
    }
    // 훑기가 조용히 0건이 되지 않게(마지막 열린 스테이지를 뺀 여섯).
    expect(checked).toBeGreaterThanOrEqual(6);

    // 그리고 모듈 자신이 그 경계를 **도메인에서** 가져온다는 것을 소스로 못 박는다 — 값 사본이
    // 생기면 도메인이 경계를 옮길 때 이 판정만 옛 숫자에 남는다(라운드 75 P-4가 기각한 그 길).
    const source = readFileSync(moduleSourcePath, "utf8");
    expect(source).toContain('from "@wooriai/domain"');
    expect(source).toContain("calculateChildStage");
    // 도메인의 경계 숫자(4·7·13·48·96·156개월의 표기값)를 모듈이 **코드에서** 적고 있지 않을 것.
    // ⚠️ 재는 자리는 주석을 걷어낸 코드이고(주석은 근거를 적는 자리라 숫자가 서도 된다), 바늘은
    // 부분문자열이 아니라 **숫자 리터럴 경계**다(라운드 76 리뷰 S-6) — 종전 `toContain("47")`은
    // `1470`·`x47y` 같은 무관한 자리에도 걸려, 이 계약이 무는 축이 아닌 이유로 빨개질 수 있었다.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    for (const boundary of ["47", "95", "155"]) {
      expect(codeOnly, `모듈이 도메인 경계 ${boundary}을 손으로 적고 있다`).not.toMatch(
        new RegExp(`\\b${boundary}\\b`)
      );
    }
  });

  it("라벨이 개월을 말할 때만 판정 대상이 된다 (서술·임신·세 표기는 null)", () => {
    expect(parseTimingLabelMonths("12~24개월")).toEqual({ from: 12, to: 24 });
    expect(parseTimingLabelMonths("4~6개월 전후")).toEqual({ from: 4, to: 6 });
    expect(parseTimingLabelMonths("12개월 이후")).toEqual({ from: 12, to: Number.POSITIVE_INFINITY });
    for (const descriptive of ["출산 전후", "돌 무렵", "임신 초기~중기", "4~7세", "외출이 늘어날 때", ""]) {
      expect(parseTimingLabelMonths(descriptive), `${descriptive}은 판정 대상이 아니다`).toBeNull();
    }
  });

  it("판정 대상이 아닌 라벨은 어떤 시기 조합에서도 통과한다 (CMS의 자유도를 줄이지 않는다)", () => {
    // 여기 적힌 조합은 개월로 읽으면 전부 어긋난다 — 그런데도 통과해야 한다는 것이 판정이다.
    expect(judgeTimingLabelAgainstStages("출산 전후", ["kid_4_7"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("돌 무렵", ["newborn_0_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("4~7세", ["newborn_0_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("임신 초기", ["middle_school"])).toBeNull();
    // 빈 값·미지정 갈래도 그대로다(상세 화면은 빈 값이면 사실 줄을 아예 그리지 않는다).
    expect(judgeTimingLabelAgainstStages("", ["newborn_0_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("   ", ["newborn_0_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages(null, ["newborn_0_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages(undefined, ["newborn_0_3"])).toBeNull();
  });

  it("정찰 노트의 실패 시나리오를 잡는다 (걸음마 보조 장난감 · 12~24개월 ↔ 6-12개월 칩)", () => {
    const mismatch = judgeTimingLabelAgainstStages("12~24개월", ["infant_7_12"]);
    expect(mismatch).not.toBeNull();
    // 메시지는 **어긋난 구간을 그대로 말한다** — 운영자가 고칠 값이 문장 안에 있어야 한다.
    expect(mismatch?.message).toContain("12~24개월");
    expect(mismatch?.message).toContain("6~12개월");
    // 운영자가 고쳐야만 통과하는 유일한 실패라 재시도를 권하지 않는다(R19-F와 같은 판단).
    expect(mismatch?.message).not.toContain("다시 시도");
  });

  it("판정 셋(구간 밖 · 대칭 겹침 · 더 이른 칩)이 저마다 다른 사유로 걸린다", () => {
    // ① 라벨이 시기가 덮는 구간 밖.
    expect(judgeTimingLabelAgainstStages("0~3개월", ["kid_4_7"])?.reason).toBe("outside_stage_months");
    // ② 뒤 방향: 품목이 지는 시기 하나가 라벨과 한 달도 겹치지 않는다(라운드 74 리뷰 B-2).
    expect(judgeTimingLabelAgainstStages("12~24개월", ["toddler_1_3", "kid_4_7"])?.reason).toBe(
      "stage_not_overlapped"
    );
    // ③ 라벨이 칩 이름(`"6-12개월"`)을 그대로 말하는데 더 이른 `0-6개월` 칩에도 선다.
    //    앞 둘은 통과하는 조합이라(구간 안 · 시기 둘 다 겹침) 이 사유가 아니면 초록이 된다.
    expect(judgeTimingLabelAgainstStages("6~12개월", ["infant_4_6", "infant_7_12"])?.reason).toBe(
      "earlier_band_than_label"
    );
    // 개월을 말하는데 출생 이후 시기가 하나도 없는 조합.
    expect(judgeTimingLabelAgainstStages("0~6개월", ["pregnancy_late"])?.reason).toBe("no_born_stage");
  });

  it("어긋나지 않는 조합은 통과한다 (판정이 무조건 빨간 no-op이 아니다)", () => {
    expect(judgeTimingLabelAgainstStages("0~3개월", ["newborn_0_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("12개월 이후", ["toddler_1_3", "kid_4_7"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("4~6개월 전후", ["infant_4_6"])).toBeNull();
    // 임신 스테이지가 섞여 있어도 개월 판정은 출생 이후 시기만 본다 — ⚠️ **①②에 한한다**
    // (라운드 76 리뷰 S-7). 규칙 ③은 원본 `stageCodes`를 그대로 보는데, 밴드 표의 `"0-6개월"`
    // 칩에 임신 스테이지 셋이 들어 있어서다: 칩 이름 라벨에서는 임신 스테이지도 "더 이른 칩에
    // 선다"의 증거가 된다(아래 케이스가 그 사실을 값으로 고정한다).
    expect(judgeTimingLabelAgainstStages("0~3개월", ["pregnancy_late", "newborn_0_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("6~12개월", ["pregnancy_late", "infant_7_12"])?.reason).toBe(
      "earlier_band_than_label"
    );
  });

  /**
   * 라운드 76 적대적 리뷰 M-2 — **칩 이름을 그대로 적은 라벨에는 통과 조합이 있어야 한다.**
   *
   * 종전 규칙 ③은 `"24개월 이후"`를 **어떤 `stageCodes` 조합으로도** 통과시키지 못했다:
   * ①을 지나려면 24개월을 덮는 `toddler_1_3`이 있어야 하는데, `toddler_1_3`이 있으면 ③이
   * `"12-24개월"` 칩을 "더 이른 칩"으로 세어 거절했다(밴드 표의 **의도된 중복** —
   * `items-commerce/stage-bands.ts`). 운영자가 고칠 방법이 없는 거절은 판정이 아니라 봉쇄다.
   *
   * 그래서 규칙 ③은 **이름을 말한 칩에 함께 서 있는 스테이지**를 이른 칩의 증거로 세지 않는다.
   * 이 단언은 그 사실을 밴드 이름 하나가 아니라 **전 밴드 × 조합 전수 프로빙**으로 문다 —
   * 밴드 표가 자라거나 도메인이 경계를 옮겨도 "통과할 방법이 없는 칩 이름"이 다시 생기면 빨개진다.
   */
  it("모든 밴드 칩 이름 라벨에 통과 조합이 최소 하나 있다 (전 밴드 × 대표 조합 프로빙)", () => {
    // 밴드가 덮는 출생 이후 스테이지 전수 — 조합의 재료도 손으로 적지 않고 표에서 파생시킨다.
    const bornStages = [...stageNotationRanges().keys()];
    expect(bornStages.length).toBeGreaterThanOrEqual(7);

    for (const band of STAGE_BAND_LABELS) {
      // 칩 이름을 **카탈로그 표기**로 옮긴다(`"24개월+"` → `"24개월 이후"`) — 사용자가 상세에서
      // 읽는 그 문자열이고, 두 표기를 잇는 것은 모듈 자신의 파서·포매터다.
      const label = formatMonthRange(parseBandLabelMonths(band));
      expect(parseTimingLabelMonths(label), `${band}의 카탈로그 표기 ${label}`).not.toBeNull();

      const passing: string[][] = [];
      for (let mask = 1; mask < 1 << bornStages.length; mask += 1) {
        const combo = bornStages.filter((_, index) => (mask & (1 << index)) !== 0);
        if (judgeTimingLabelAgainstStages(label, combo) === null) passing.push(combo);
      }
      expect(
        passing.length,
        `준비 시기 "${label}"(${band} 칩의 이름)은 어떤 시기 조합으로도 저장할 수 없어요 — ` +
          "운영자가 고칠 방법이 없는 거절은 판정이 아니라 봉쇄예요"
      ).toBeGreaterThan(0);
    }

    // 그리고 이 라운드가 연 그 자리를 값으로 못 박는다: `"24개월+"` 칩의 스테이지는 `toddler_1_3`을
    // `"12-24개월"` 칩과 **공유**하고(의도된 중복), 그래서 그 중복은 이른 칩의 증거가 아니다.
    expect(STAGE_BAND_STAGES["24개월+"]).toContain("toddler_1_3");
    expect(STAGE_BAND_STAGES["12-24개월"]).toContain("toddler_1_3");
    expect(judgeTimingLabelAgainstStages("24개월 이후", ["toddler_1_3"])).toBeNull();
    expect(judgeTimingLabelAgainstStages("24개월 이후", ["toddler_1_3", "kid_4_7"])).toBeNull();
    // ⚠️ 그 완화가 규칙 ③을 통째로 끄지 않는다 — 이른 칩**에만** 있는 스테이지는 그대로 걸린다.
    expect(judgeTimingLabelAgainstStages("6~12개월", ["infant_4_6", "infant_7_12"])?.reason).toBe(
      "earlier_band_than_label"
    );
    // 그리고 ②는 ③보다 먼저다 — 24개월과 한 달도 겹치지 않는 시기가 섞이면 그 사유로 걸린다.
    expect(judgeTimingLabelAgainstStages("24개월 이후", ["infant_7_12", "toddler_1_3"])?.reason).toBe(
      "stage_not_overlapped"
    );
  });

  it("오늘의 시드 62건이 이 판정을 전부 지난다 (저장 경로가 기존 카탈로그를 막지 않는다)", async () => {
    const seedDataPath = join(fileURLToPath(new URL("..", import.meta.url)), "prisma", "seed-data.ts");
    const { itemTemplateSeeds } = (await import(pathToFileURL(seedDataPath).href)) as {
      itemTemplateSeeds: Array<{ code: string; timingLabel: string; stageCodes: string[] }>;
    };

    let judged = 0;
    for (const item of itemTemplateSeeds) {
      const mismatch = judgeTimingLabelAgainstStages(item.timingLabel, item.stageCodes);
      expect(mismatch?.message ?? null, `${item.code}: 시드가 새 판정에 걸린다`).toBeNull();
      if (parseTimingLabelMonths(item.timingLabel)) judged += 1;
    }
    // 시드 전부가 "판정 대상 아님"이라 초록인 것이 아니라는 것을 값으로 남긴다(오늘 실측 27건).
    expect(judged).toBeGreaterThanOrEqual(20);
    expect(itemTemplateSeeds.length).toBeGreaterThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------
// ⓑⓒⓓ 저장 경로 · 검토(초안) 경로 (실 PostgreSQL)
// ---------------------------------------------------------------------------

describe.skipIf(!dbAvailable)("준비 시기 판정이 저장·검토 경로를 지난다 (라운드 76 트랙 E)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaClient;
  let revisions: ContentRevisionsService;
  let adminId: string;

  const essential = {
    necessityLevel: "essential" as const,
    reasonText: "라운드 76 트랙 E 저장 경로 테스트."
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;

    prisma = new PrismaClient();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    revisions = moduleRef.get(ContentRevisionsService, { strict: false });

    // 검토 경로는 서비스에서 직접 부른다(레거시 x-admin-token은 UUID가 아닌 actor를 세워
    // 초안 행의 author_admin_id(uuid)를 채우지 못한다 — 판정을 보려는 것이지 로그인 흐름을
    // 다시 보려는 것이 아니라서, MFA 쿠키 흐름 대신 실제 admin 행 하나를 만들어 쓴다).
    const admin = await prisma.adminUser.create({
      data: {
        email: `r76-timing-${randomUUID()}@wooriai.local`,
        passwordHash: "not-used-by-this-suite",
        displayName: "R76 timing label",
        role: "editor",
        active: true
      }
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    delete process.env.WOORIAI_ADMIN_TOKEN;
    await app.close();
    await prisma.$disconnect();
  });

  /** 서비스를 직접 부르는 갈래의 거절 사유. 던지지 않으면 빈 문자열이라 단언이 빨개진다. */
  async function rejectionCode(run: () => Promise<unknown>): Promise<string> {
    try {
      await run();
    } catch (error) {
      const body = (error as { getResponse?: () => unknown }).getResponse?.();
      return (body as { code?: string } | undefined)?.code ?? "";
    }
    return "";
  }

  function createItem(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("x-admin-token", adminToken)
      .send(body);
  }

  it("저장 경로가 명백히 어긋난 준비 시기를 400으로 거절하고 어긋난 구간을 그대로 말한다", async () => {
    const name = `R76 걸음마 보조 ${randomUUID().slice(0, 8)}`;
    await createItem({
      name,
      ...essential,
      // 6-12개월 칩(=infant_7_12)에 서면서 상세는 "12~24개월"이라고 말하는 그 모양.
      timingLabel: "12~24개월",
      stageCodes: ["infant_7_12"]
    })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ITEM_TIMING_LABEL_MISMATCH");
        expect(body.error.message).toContain("12~24개월");
        expect(body.error.message).toContain("6~12개월");
        expect(body.error.message).not.toContain("다시 시도");
      });

    // 거절은 **저장 전**이다 — 행이 남지 않는다.
    expect(await prisma.itemTemplate.count({ where: { name } })).toBe(0);
  });

  it("수정 경로도 지난다 — 시기를 안 보내도 기존 시기와 대조한다", async () => {
    const created = (
      await createItem({
        name: `R76 수정 대상 ${randomUUID().slice(0, 8)}`,
        ...essential,
        timingLabel: "7~12개월",
        stageCodes: ["infant_7_12"]
      }).expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/item-templates/${created.id}`)
      .set("x-admin-token", adminToken)
      .send({ timingLabel: "12~24개월" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ITEM_TIMING_LABEL_MISMATCH");
      });

    // 거절된 수정은 한 글자도 쓰이지 않는다.
    const row = await prisma.itemTemplate.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.timingLabel).toBe("7~12개월");
  });

  it("파싱되지 않는 라벨·빈 라벨·맞는 라벨은 오늘과 똑같이 저장된다", async () => {
    const descriptive = (
      await createItem({
        name: `R76 서술 표기 ${randomUUID().slice(0, 8)}`,
        ...essential,
        // 개월로 읽으면 네 살짜리 시기와 어긋나 보이지만, 이 표기는 판정 대상이 아니다.
        timingLabel: "출산 전후",
        stageCodes: ["kid_4_7"]
      }).expect(200)
    ).body as { timingLabel: string };
    expect(descriptive.timingLabel).toBe("출산 전후");

    const blank = (
      await createItem({
        name: `R76 빈 준비시기 ${randomUUID().slice(0, 8)}`,
        ...essential,
        stageCodes: ["toddler_1_3"]
      }).expect(200)
    ).body as { timingLabel: string };
    expect(blank.timingLabel).toBe("");

    const matching = (
      await createItem({
        name: `R76 맞는 표기 ${randomUUID().slice(0, 8)}`,
        ...essential,
        timingLabel: "12개월 이후",
        stageCodes: ["toddler_1_3", "kid_4_7"]
      }).expect(200)
    ).body as { timingLabel: string };
    expect(matching.timingLabel).toBe("12개월 이후");
  });

  it("검토(초안) 경로가 같은 판정을 지난다 — 우회로가 아니다", async () => {
    const author = { id: adminId, email: "r76@wooriai.local", role: "editor" as const };

    expect(
      await rejectionCode(() =>
        revisions.create(author, {
          entityType: "item_template",
          payload: {
            name: "R76 초안 걸음마 보조",
            ...essential,
            timingLabel: "12~24개월",
            stageCodes: ["infant_7_12"]
          }
        })
      )
    ).toBe("ITEM_TIMING_LABEL_MISMATCH");

    const before = await prisma.contentRevision.count({ where: { authorAdminId: adminId } });

    // 맞는 조합은 그대로 초안이 된다.
    const draft = await revisions.create(author, {
      entityType: "item_template",
      payload: {
        name: "R76 초안 통과분",
        ...essential,
        timingLabel: "12개월 이후",
        stageCodes: ["toddler_1_3", "kid_4_7"]
      }
    });
    expect(draft.status).toBe("draft");
    expect(await prisma.contentRevision.count({ where: { authorAdminId: adminId } })).toBe(before + 1);

    // 초안 수정도 같은 판정을 지난다.
    expect(
      await rejectionCode(() =>
        revisions.update(author, draft.id, {
          payload: {
            name: "R76 초안 통과분",
            ...essential,
            timingLabel: "0~3개월",
            stageCodes: ["toddler_1_3", "kid_4_7"]
          }
        })
      )
    ).toBe("ITEM_TIMING_LABEL_MISMATCH");
  });

  it("초안이 시기를 안 보내면 라이브 행의 시기와 대조한다 (발행 시점과 같은 값을 본다)", async () => {
    const live = (
      await createItem({
        name: `R76 라이브 대조 ${randomUUID().slice(0, 8)}`,
        ...essential,
        timingLabel: "7~12개월",
        stageCodes: ["infant_7_12"]
      }).expect(200)
    ).body as { id: string };

    expect(
      await rejectionCode(() =>
        revisions.create(
          { id: adminId, email: "r76@wooriai.local", role: "editor" },
          {
            entityType: "item_template",
            entityId: live.id,
            // stageCodes를 보내지 않는다 — 발행하면 라이브의 infant_7_12가 그대로 남는다.
            payload: { name: "R76 라이브 대조", ...essential, timingLabel: "12~24개월" }
          }
        )
      )
    ).toBe("ITEM_TIMING_LABEL_MISMATCH");
  });

  /**
   * 라운드 76 적대적 리뷰 M-4 — 폴백이 **한쪽에만** 있으면 "초안 통과 → 발행 400"이 실재한다.
   *
   * 시기(`stageCodes`)에는 라이브 행 폴백이 있었는데 라벨(`timingLabel`)에는 없었다. 그래서
   * 라벨을 안 보내는 수정 초안은 검토에서 "라벨 없음 = 판정 대상 아님"으로 통과하고, 발행이
   * 라이브 라벨을 살려 내 400을 냈다 — 운영자가 **고칠 수 없는 자리**에서 사유를 처음 듣는다.
   */
  it("초안이 라벨을 안 보내면 라이브 행의 라벨과 대조한다 (발행 시점과 같은 값을 본다)", async () => {
    const live = (
      await createItem({
        name: `R76 라벨 폴백 ${randomUUID().slice(0, 8)}`,
        ...essential,
        timingLabel: "12~24개월",
        stageCodes: ["toddler_1_3"]
      }).expect(200)
    ).body as { id: string };

    const author = { id: adminId, email: "r76@wooriai.local", role: "editor" as const };

    // 라벨을 보내지 않고 시기만 바꾼다 — 발행하면 라이브의 "12~24개월"이 그대로 남아 어긋난다.
    expect(
      await rejectionCode(() =>
        revisions.create(author, {
          entityType: "item_template",
          entityId: live.id,
          payload: { name: "R76 라벨 폴백", ...essential, stageCodes: ["infant_7_12"] }
        })
      )
    ).toBe("ITEM_TIMING_LABEL_MISMATCH");

    // 그리고 그 갈림이 실재했다는 증거: 같은 값이 발행 경로(라이브 수정)에서도 400이다.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/item-templates/${live.id}`)
      .set("x-admin-token", adminToken)
      .send({ stageCodes: ["infant_7_12"] })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ITEM_TIMING_LABEL_MISMATCH");
      });

    // 라벨을 함께 맞춰 보내면 초안이 그대로 선다(폴백이 통과를 좁히기만 하지 않는다).
    const draft = await revisions.create(author, {
      entityType: "item_template",
      entityId: live.id,
      payload: { name: "R76 라벨 폴백", ...essential, timingLabel: "7~12개월", stageCodes: ["infant_7_12"] }
    });
    expect(draft.status).toBe("draft");
  });

  it("판정 모듈의 구간이 실제 저장된 행에서도 같은 답을 낸다 (시드 카탈로그 전수)", async () => {
    // 시드 코드로 좁힌다: 이 스위트는 배타가 아니라 다른 스위트가 만든 임시 준비템과 같은
    // DB를 본다(그 행들은 자기 스위트의 판정 대상이지 이 계약의 대상이 아니다).
    const seedDataPath = join(fileURLToPath(new URL("..", import.meta.url)), "prisma", "seed-data.ts");
    const { itemTemplateSeeds } = (await import(pathToFileURL(seedDataPath).href)) as {
      itemTemplateSeeds: Array<{ code: string }>;
    };
    const items = await prisma.itemTemplate.findMany({
      where: { code: { in: itemTemplateSeeds.map((seed) => seed.code) } },
      select: { code: true, timingLabel: true, id: true }
    });
    const stages = await prisma.itemTemplateStage.findMany({
      where: { itemTemplateId: { in: items.map((item) => item.id) } },
      select: { itemTemplateId: true, stageCode: true }
    });
    const byItem = new Map<string, string[]>();
    for (const stage of stages) {
      byItem.set(stage.itemTemplateId, [...(byItem.get(stage.itemTemplateId) ?? []), stage.stageCode]);
    }

    let judged = 0;
    for (const item of items) {
      const stageCodes = byItem.get(item.id) ?? [];
      if (stageCodes.length === 0) continue;
      const mismatch = judgeTimingLabelAgainstStages(item.timingLabel, stageCodes);
      expect(mismatch?.message ?? null, `${item.code}: 저장된 행이 새 판정에 걸린다`).toBeNull();
      judged += 1;
    }
    // 기존 행 일괄 검증·정정은 하지 않는다(마이그레이션 0건) — 오늘 그 값이 전부 초록이라는
    // 사실만 값으로 남긴다. 이 수가 0이 되면 위 단언이 아무것도 세지 않은 것이다.
    expect(judged).toBeGreaterThanOrEqual(60);
  });
});
