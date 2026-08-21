import { randomUUID } from "node:crypto";
import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { reachedBudgetBoundaries } from "@wooriai/domain";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import type { AuthenticatedUser } from "../src/common/types/authenticated-request";
import { DevicesService } from "../src/devices/devices.service";
import { ExpensesVersionService } from "../src/finance/expenses.service";
import { ImportPipelineService } from "../src/onboarding/import-pipeline.service";
import { PrismaService } from "../src/prisma/prisma.service";
import type { FcmSenderService, FcmSendResult, PushNotificationMessage } from "../src/push/fcm-sender.service";
import type { PushConfigService } from "../src/push/push-config.service";
import { budgetPushCopy, PushDispatchService, resolveReachedBoundaries } from "../src/push/push-dispatch.service";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

// PUSH-113: 지출 생성 → 예산 경계(80%/100%) 푸시 발송 오케스트레이션을 실 Postgres로
// 검증한다. FCM 자체는 스텁 sender로 대체한다(HTTP 계층 검증은 push-fcm.test.ts).
// 리뷰 M-2 재설계: 경계당 1회는 push_boundary_marks (child, month, boundary) unique
// 클레임으로 보장된다 — usedBefore 역산 없음. 동시성(중복/누락 없음)도 여기서 검증.
// 다른 스위트와 DB를 공유하므로 모든 데이터는 테스트별 고유 가구/아이로 스코프한다
// (test-db.ts의 주석 참조).

const BUDGET_KRW = 100_000;
const MONTH_START = new Date("2026-05-01T00:00:00.000Z");
const SPENT_ON = new Date("2026-05-15T00:00:00.000Z");
const YEAR_MONTH = "2026-05";

type SenderStub = {
  calls: Array<{ token: string; notification: PushNotificationMessage }>;
  sendToDevice: (token: string, notification: PushNotificationMessage) => Promise<FcmSendResult>;
};

function okResult(overrides: Partial<FcmSendResult> = {}): FcmSendResult {
  return { ok: true, skipped: false, unregistered: false, httpStatus: 200, errorCode: null, ...overrides };
}

function stubSender(resultForToken?: (token: string) => FcmSendResult): SenderStub {
  const stub: SenderStub = {
    calls: [],
    async sendToDevice(token, notification) {
      stub.calls.push({ token, notification });
      return resultForToken ? resultForToken(token) : okResult();
    }
  };
  return stub;
}

const enabledConfig = { isEnabled: () => true } as unknown as PushConfigService;
const disabledConfig = { isEnabled: () => false } as unknown as PushConfigService;

describe.skipIf(!dbAvailable)("PushDispatchService (PUSH-113, real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let devicesService: DevicesService;
  let categoryId: string;

  beforeAll(async () => {
    deployMigrations();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // push는 반드시 env-gate가 꺼진 상태로 부팅되어야 한다 — 실 발송 경로가
    // 테스트에서 절대 열리지 않게. (활성 케이스는 스텁 config로 구성한다.)
    delete process.env.PUSH_ENABLED;
    delete process.env.FCM_SERVICE_ACCOUNT_PATH;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    devicesService = app.get(DevicesService, { strict: false });

    const category = await prisma.category.findFirst();
    if (!category) {
      throw new Error("시드 카테고리가 없어요 — global-setup의 seedDatabase가 실행됐는지 확인하세요.");
    }
    categoryId = category.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  type Fixture = Awaited<ReturnType<typeof createFixture>>;

  /** 테스트별 고유 가구: owner+viewer(활성) / co_parent(removed), 예산 10만원, 기기 4대. */
  async function createFixture() {
    const tag = randomUUID().slice(0, 8);
    const [owner, viewer, removed] = await Promise.all(
      ["u1", "u2", "u3"].map((suffix) =>
        prisma.user.create({ data: { authProvider: "kakao", providerUserId: `push113-${tag}-${suffix}` } })
      )
    );
    const household = await prisma.household.create({ data: { name: `push113-${tag}`, ownerUserId: owner.id } });
    await prisma.householdMember.createMany({
      data: [
        { householdId: household.id, userId: owner.id, role: "owner", status: "active" },
        { householdId: household.id, userId: viewer.id, role: "viewer", status: "active" },
        { householdId: household.id, userId: removed.id, role: "co_parent", status: "removed" }
      ]
    });
    const child = await prisma.child.create({
      data: { householdId: household.id, nickname: `push113-${tag}`, stageMode: "born", birthDate: new Date("2026-01-10T00:00:00.000Z") }
    });
    await prisma.budget.create({
      data: { childId: child.id, yearMonth: MONTH_START, amountKrw: BUDGET_KRW, createdByUserId: owner.id }
    });

    // 발송 대상 여부가 갈리는 기기 4대: 대상은 ownerDevice/viewerDevice 뿐이어야 한다.
    const ownerDevice = await prisma.userDevice.create({
      data: { userId: owner.id, platform: "ios", pushToken: `tok-owner-${tag}`, notificationEnabled: true }
    });
    await prisma.userDevice.create({
      data: { userId: owner.id, platform: "android", pushToken: `tok-off-${tag}`, notificationEnabled: false }
    });
    const viewerDevice = await prisma.userDevice.create({
      data: { userId: viewer.id, platform: "android", pushToken: `tok-viewer-${tag}`, notificationEnabled: true }
    });
    await prisma.userDevice.create({
      data: { userId: removed.id, platform: "ios", pushToken: `tok-removed-${tag}`, notificationEnabled: true }
    });

    return { tag, owner, viewer, removed, household, child, ownerDevice, viewerDevice };
  }

  function createExpenseRow(fixture: Fixture, amountKrw: number, expenseType: "expense" | "gift" | "refund" = "expense") {
    return prisma.expense.create({
      data: {
        householdId: fixture.household.id,
        childId: fixture.child.id,
        createdByUserId: fixture.owner.id,
        categoryId,
        amountKrw,
        spentOn: SPENT_ON,
        itemName: `push113-${fixture.tag}`,
        expenseType
      }
    });
  }

  function buildDispatch(sender: SenderStub, config: PushConfigService = enabledConfig) {
    return new PushDispatchService(config, prisma, devicesService, sender as unknown as FcmSenderService);
  }

  function boundaryMarks(fixture: Fixture) {
    return prisma.pushBoundaryMark.findMany({
      where: { childId: fixture.child.id, yearMonth: YEAR_MONTH },
      orderBy: { boundary: "asc" }
    });
  }

  it("80% 경계 도달 지출: 활성 구성원의 활성 기기(2대)에만 budget_80 발송 + 80 마크 클레임", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const crossing = await createExpenseRow(fixture, 15_000); // 합계 85k (>= 80%)

    const sender = stubSender();
    const summary = await buildDispatch(sender).onExpenseCreated(crossing.id);

    expect(summary).toEqual({ skipped: false, notificationType: "budget_80", attempted: 2, sent: 2, failed: 0, deactivated: 0 });
    expect(sender.calls.map((call) => call.token).sort()).toEqual(
      [`tok-owner-${fixture.tag}`, `tok-viewer-${fixture.tag}`].sort()
    );
    expect(sender.calls[0].notification.title).toBe("이번 달 예산의 80%를 사용했어요");
    expect(sender.calls[0].notification.data).toEqual({
      type: "budget_80",
      childId: fixture.child.id,
      yearMonth: YEAR_MONTH
    });
    expect((await boundaryMarks(fixture)).map((mark) => mark.boundary)).toEqual([80]);
  });

  it("80 마크가 이미 클레임된 뒤의 추가 지출(여전히 80%대)은 재발송하지 않는다", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const crossing = await createExpenseRow(fixture, 15_000); // 85k
    const sender = stubSender();
    const dispatch = buildDispatch(sender);
    await dispatch.onExpenseCreated(crossing.id);
    expect(sender.calls).toHaveLength(2);

    const after = await createExpenseRow(fixture, 5_000); // 90k — 여전히 80%대
    const summary = await dispatch.onExpenseCreated(after.id);

    expect(summary.skipped).toBe(true);
    expect(sender.calls).toHaveLength(2); // 재발송 없음
  });

  it("80%와 100%를 한 번에 지나는 지출은 budget_100만 발송하고 80 마크도 함께 클레임한다", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const crossing = await createExpenseRow(fixture, 40_000); // 110k

    const sender = stubSender();
    const dispatch = buildDispatch(sender);
    const summary = await dispatch.onExpenseCreated(crossing.id);

    expect(summary.notificationType).toBe("budget_100");
    expect(sender.calls).toHaveLength(2);
    // 초과 카피 — 홈 배너(budget-warning.ts)와 정합: 초과분 N원 명시.
    expect(sender.calls[0].notification.title).toBe("이번 달 예산을 10,000원 초과했어요");
    expect(sender.calls[0].notification.body).toBe("이번 달 지출을 확인해 볼까요?");
    // 80 마크도 무발송으로 클레임돼 있어 이후 80이 재발송될 수 없다.
    expect((await boundaryMarks(fixture)).map((mark) => mark.boundary)).toEqual([80, 100]);

    // 이후 지출은 어느 경계도 다시 클레임하지 못한다.
    const after = await createExpenseRow(fixture, 10_000);
    const afterSummary = await dispatch.onExpenseCreated(after.id);
    expect(afterSummary.skipped).toBe(true);
    expect(sender.calls).toHaveLength(2);
  });

  it("정확히 100% 도달은 '모두 사용했어요' 카피로 발송한다 (0원 초과 아님 — 허위 데이터 금지)", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 60_000);
    const crossing = await createExpenseRow(fixture, 40_000); // 정확히 100k == 예산

    const sender = stubSender();
    const summary = await buildDispatch(sender).onExpenseCreated(crossing.id);

    expect(summary.notificationType).toBe("budget_100");
    expect(sender.calls[0].notification.title).toBe("이번 달 예산을 모두 사용했어요");
    expect(sender.calls[0].notification.body).toBe("이번 달 지출을 확인해 볼까요?");
    expect((await boundaryMarks(fixture)).map((mark) => mark.boundary)).toEqual([80, 100]);
  });

  it("과거에 평가 없이 초과 상태가 됐어도 첫 평가가 누락 없이 발송한다 (usedBefore 역산 제거)", async () => {
    // 옛 역산 방식이라면 usedBefore(120k)가 이미 초과라 '이번 지출이 넘긴 게
    // 아니다'로 판정해 영원히 침묵했을 시나리오 — 클레임 방식은 usedAfter만
    // 보므로 아직 클레임되지 않은 경계를 발송한다.
    const fixture = await createFixture();
    await createExpenseRow(fixture, 120_000); // 평가된 적 없는 초과 상태
    const after = await createExpenseRow(fixture, 10_000);

    const sender = stubSender();
    const summary = await buildDispatch(sender).onExpenseCreated(after.id);

    expect(summary.notificationType).toBe("budget_100");
    expect(sender.calls[0].notification.title).toBe("이번 달 예산을 30,000원 초과했어요");
  });

  it("동시 지출 2건의 경합: 발송은 정확히 1회 (unique 클레임이 중복 제거)", async () => {
    const fixture = await createFixture();
    // 두 건이 모두 커밋된 뒤 두 디스패치가 동시에 평가 — 둘 다 합계 90k(>=80%)를
    // 보지만 80 마크는 한 쪽만 클레임할 수 있다.
    const [first, second] = await Promise.all([createExpenseRow(fixture, 45_000), createExpenseRow(fixture, 45_000)]);

    const sender = stubSender();
    const summaries = await Promise.all([
      buildDispatch(sender).onExpenseCreated(first.id),
      buildDispatch(sender).onExpenseCreated(second.id)
    ]);

    const dispatched = summaries.filter((summary) => !summary.skipped);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].notificationType).toBe("budget_80");
    expect(sender.calls).toHaveLength(2); // 기기 2대 × 발송 1회
    expect((await boundaryMarks(fixture)).map((mark) => mark.boundary)).toEqual([80]);
  });

  it("동시 지출 2건으로 100% 도달: budget_100 1회 발송 + 80/100 마크 모두 클레임", async () => {
    const fixture = await createFixture();
    const [first, second] = await Promise.all([createExpenseRow(fixture, 60_000), createExpenseRow(fixture, 60_000)]);

    const sender = stubSender();
    const summaries = await Promise.all([
      buildDispatch(sender).onExpenseCreated(first.id),
      buildDispatch(sender).onExpenseCreated(second.id)
    ]);

    const dispatched = summaries.filter((summary) => !summary.skipped);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].notificationType).toBe("budget_100");
    expect(sender.calls).toHaveLength(2);
    expect(sender.calls[0].notification.title).toBe("이번 달 예산을 20,000원 초과했어요");
    expect((await boundaryMarks(fixture)).map((mark) => mark.boundary)).toEqual([80, 100]);

    // 80 마크가 함께 클레임됐으므로, 이후 어떤 평가도 80을 재발송할 수 없다.
    const later = await createExpenseRow(fixture, 1_000);
    const laterSummary = await buildDispatch(sender).onExpenseCreated(later.id);
    expect(laterSummary.skipped).toBe(true);
    expect(sender.calls).toHaveLength(2);
  });

  it("UNREGISTERED 결과를 받은 기기는 비활성화되고, 다음 발송 대상에서 빠진다", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const crossing = await createExpenseRow(fixture, 15_000);

    const staleToken = `tok-owner-${fixture.tag}`;
    const sender = stubSender((token) =>
      token === staleToken
        ? okResult({ ok: false, unregistered: true, httpStatus: 404, errorCode: "UNREGISTERED" })
        : okResult()
    );
    const summary = await buildDispatch(sender).onExpenseCreated(crossing.id);

    expect(summary).toEqual({ skipped: false, notificationType: "budget_80", attempted: 2, sent: 1, failed: 1, deactivated: 1 });
    const ownerDevice = await prisma.userDevice.findUnique({ where: { id: fixture.ownerDevice.id } });
    expect(ownerDevice?.notificationEnabled).toBe(false);
    // 토큰 자체는 남는다 — 재등록(NOTI-100 upsert) 시 자연 복구.
    expect(ownerDevice?.pushToken).toBe(staleToken);

    // 비활성화된 기기는 이후 발송 대상 조회에서 제외된다.
    const remaining = await devicesService.findActivePushDevices([fixture.owner.id, fixture.viewer.id]);
    expect(remaining.map((device) => device.pushToken)).toEqual([`tok-viewer-${fixture.tag}`]);
  });

  it("선물(gift) 지출은 예산 합계에 안 들어가므로 발송하지 않는다 (DNC-015)", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const gift = await createExpenseRow(fixture, 50_000, "gift");

    const sender = stubSender();
    const summary = await buildDispatch(sender).onExpenseCreated(gift.id);

    expect(summary.skipped).toBe(true);
    expect(sender.calls).toHaveLength(0);
  });

  it("예산이 없는 아이는 발송하지 않는다", async () => {
    const fixture = await createFixture();
    await prisma.budget.deleteMany({ where: { childId: fixture.child.id } });
    const expense = await createExpenseRow(fixture, 95_000);

    const sender = stubSender();
    const summary = await buildDispatch(sender).onExpenseCreated(expense.id);

    expect(summary.skipped).toBe(true);
    expect(sender.calls).toHaveLength(0);
  });

  it("플래그 off면 즉시 no-op — DB 조회도 발송도 없다", async () => {
    const fixture = await createFixture();
    const expense = await createExpenseRow(fixture, 95_000);

    // Prisma 모델 delegate에 vi.spyOn을 걸면 restore 후 클라이언트가 망가지므로,
    // 접근 자체를 기록하는 프록시 prisma를 주입해 "DB에 안 갔다"를 검증한다.
    let dbTouched = false;
    const trackingPrisma = new Proxy(
      {},
      {
        get() {
          dbTouched = true;
          throw new Error("push off인데 DB에 접근했어요");
        }
      }
    ) as PrismaService;

    const sender = stubSender();
    const dispatch = new PushDispatchService(disabledConfig, trackingPrisma, devicesService, sender as unknown as FcmSenderService);
    const summary = await dispatch.onExpenseCreated(expense.id);

    expect(summary.skipped).toBe(true);
    expect(sender.calls).toHaveLength(0);
    expect(dbTouched).toBe(false);
  });

  it("sender가 예외를 던져도 onExpenseCreated는 던지지 않는다 (인앱 흐름 보호)", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const crossing = await createExpenseRow(fixture, 15_000);

    const throwingSender = {
      calls: [],
      sendToDevice: async () => {
        throw new Error("unexpected sender bug");
      }
    } as unknown as SenderStub;

    const summary = await buildDispatch(throwingSender).onExpenseCreated(crossing.id);
    expect(summary.skipped).toBe(true);
  });

  it("onBudgetRelevantChange: 배치(가져오기) 후 아이+월 단위 평가 — 경계 도달 월만 발송, 월 중복 제거", async () => {
    const fixture = await createFixture();
    // 가져오기 커밋이 끝난 상태를 흉내: 5월 지출 2건 합계 85k (>=80%).
    await createExpenseRow(fixture, 45_000);
    await createExpenseRow(fixture, 40_000);

    const sender = stubSender();
    // 같은 달이 'YYYY-MM'과 'YYYY-MM-DD' 형태로 중복 전달돼도 평가는 1회,
    // 예산 없는 6월은 스킵.
    const summaries = await buildDispatch(sender).onBudgetRelevantChange(fixture.child.id, [
      "2026-05",
      "2026-05-15",
      "2026-06-01"
    ]);

    expect(summaries).toHaveLength(2); // 5월 1회 + 6월 1회 (중복 제거됨)
    const dispatched = summaries.filter((summary) => !summary.skipped);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].notificationType).toBe("budget_80");
    expect(sender.calls).toHaveLength(2); // 기기 2대 × 발송 1회
    expect(sender.calls[0].notification.data).toEqual({
      type: "budget_80",
      childId: fixture.child.id,
      yearMonth: YEAR_MONTH
    });
  });

  it("onBudgetRelevantChange는 삭제된 아이/예외 상황에서도 던지지 않는다", async () => {
    const sender = stubSender();
    const summaries = await buildDispatch(sender).onBudgetRelevantChange(randomUUID(), ["2026-05"]);
    expect(summaries).toEqual([]);
    expect(sender.calls).toHaveLength(0);
  });

  it("훅 배선: ExpensesVersionService.createExpense가 생성 직후 onExpenseCreated를 호출한다", async () => {
    const fixture = await createFixture();
    const expensesService = app.get(ExpensesVersionService, { strict: false });
    const appDispatch = app.get(PushDispatchService, { strict: false });
    const hookSpy = vi.spyOn(appDispatch, "onExpenseCreated");

    const user: AuthenticatedUser = {
      id: fixture.owner.id,
      displayName: "푸시 테스트",
      email: null,
      status: "active",
      households: [{ id: fixture.household.id, role: "owner" }]
    };
    const created = (await expensesService.createExpense(user, fixture.child.id, {
      categoryId,
      amountKrw: 5_000,
      spentOn: "2026-05-16",
      itemName: "훅 배선 확인"
    })) as { id: string };

    expect(hookSpy).toHaveBeenCalledTimes(1);
    expect(hookSpy).toHaveBeenCalledWith(created.id);
    // 앱 기본 환경(push off)에서는 no-op으로 끝난다.
    await expect(hookSpy.mock.results[0].value).resolves.toMatchObject({ skipped: true });
  });

  it("훅 배선: confirmImport(가져오기 커밋)가 완료 후 onBudgetRelevantChange를 아이별 1회 호출한다 (리뷰 m-2)", async () => {
    const fixture = await createFixture();
    const store = app.get(ImportPipelineService, { strict: false });
    const appDispatch = app.get(PushDispatchService, { strict: false });
    const hookSpy = vi.spyOn(appDispatch, "onBudgetRelevantChange");

    const job = await prisma.importJob.create({
      data: {
        userId: fixture.owner.id,
        householdId: fixture.household.id,
        childId: fixture.child.id,
        fileName: `push113-${fixture.tag}.csv`,
        fileType: "csv",
        fileSizeBytes: BigInt(128),
        status: "preview_ready"
      }
    });
    await prisma.importRow.createMany({
      data: [
        {
          importJobId: job.id,
          rowIndex: 0,
          rawJson: {},
          parsedDate: SPENT_ON,
          parsedItemName: "가져오기 지출 1",
          parsedAmountKrw: 45_000,
          categoryId,
          confidence: 0.9,
          selected: true
        },
        {
          importJobId: job.id,
          rowIndex: 1,
          rawJson: {},
          parsedDate: new Date("2026-04-10T00:00:00.000Z"),
          parsedItemName: "가져오기 지출 2",
          parsedAmountKrw: 40_000,
          categoryId,
          confidence: 0.9,
          selected: true
        }
      ]
    });

    const user: AuthenticatedUser = {
      id: fixture.owner.id,
      displayName: "푸시 테스트",
      email: null,
      status: "active",
      households: [{ id: fixture.household.id, role: "owner" }]
    };
    const result = await store.confirmImport(user, job.id);
    expect(result.importedCount).toBe(2);

    // 배치 완료 후 아이별 1회 — 행별이 아니라 월 목록으로 한 번에 평가된다.
    expect(hookSpy).toHaveBeenCalledTimes(1);
    const [childIdArg, yearMonthsArg] = hookSpy.mock.calls[0];
    expect(childIdArg).toBe(fixture.child.id);
    expect([...yearMonthsArg].sort()).toEqual(["2026-04", "2026-05"]);
    // 앱 기본 환경(push off)에서는 no-op으로 끝난다 — 가져오기 흐름 무영향.
    await expect(hookSpy.mock.results[0].value).resolves.toEqual([]);
  });

  it("아이 물리 파기 시 push_boundary_marks는 FK CASCADE로 함께 삭제된다 (purge 코드 무수정)", async () => {
    const fixture = await createFixture();
    await prisma.pushBoundaryMark.create({ data: { childId: fixture.child.id, yearMonth: YEAR_MONTH, boundary: 80 } });

    // data-retention-purge.job.ts purgeChildRows의 마지막 단계와 동일한 삭제 —
    // 마크가 FK로 막지 않고 CASCADE로 사라져야 purge가 그대로 동작한다.
    await prisma.expense.deleteMany({ where: { childId: fixture.child.id } });
    await prisma.budget.deleteMany({ where: { childId: fixture.child.id } });
    await prisma.child.delete({ where: { id: fixture.child.id } });

    expect(await prisma.pushBoundaryMark.count({ where: { childId: fixture.child.id } })).toBe(0);
  });
});

describe("resolveReachedBoundaries (경계 도달 판정 순수 함수 — 정수 연산)", () => {
  it("R19-D: 판정을 자체 구현하지 않고 @wooriai/domain 단일 소스에 위임한다", () => {
    // 세 표면(서버 푸시·홈 배너·인앱 알림)이 같은 함수를 호출한다는 계약.
    // 경계값 전수 케이스는 packages/domain/src/budget-boundary.test.ts에 있다.
    for (const [usedAfter, budgetKrw] of [
      [0, 100_000],
      [79_999, 100_000],
      [80_000, 100_000],
      [99_999, 100_000],
      [100_000, 100_000],
      [100_001, 100_000],
      [50_000, 0]
    ] as Array<[number, number]>) {
      const domain = reachedBudgetBoundaries({ budgetKrw, spentKrw: usedAfter });
      expect(resolveReachedBoundaries(usedAfter, budgetKrw)).toEqual({
        reached80: domain.reached80,
        reached100: domain.reached100
      });
    }
  });

  it.each([
    // [usedAfter, budget, reached80, reached100]
    [0, 100_000, false, false],
    [79_999, 100_000, false, false],
    [80_000, 100_000, true, false], // 정확히 80%
    [99_999, 100_000, true, false],
    [100_000, 100_000, true, true], // 정확히 100% — 경계 도달 (카피만 '모두 사용')
    [100_001, 100_000, true, true],
    [50_000, 0, false, false] // 예산 미설정
  ] as Array<[number, number, boolean, boolean]>)(
    "usedAfter=%d budget=%d -> 80:%s 100:%s",
    (usedAfter, budget, reached80, reached100) => {
      expect(resolveReachedBoundaries(usedAfter, budget)).toEqual({ reached80, reached100 });
    }
  );
});

describe("budgetPushCopy (발송 카피 — 홈 배너 budget-warning.ts와 정합)", () => {
  it("budget_80: 고정 카피", () => {
    expect(budgetPushCopy("budget_80", 85_000, 100_000)).toEqual({
      title: "이번 달 예산의 80%를 사용했어요",
      body: "남은 예산을 확인해보세요."
    });
  });

  it("정확히 100%: '모두 사용했어요' — 0원 초과라고 말하지 않는다", () => {
    expect(budgetPushCopy("budget_100", 100_000, 100_000).title).toBe("이번 달 예산을 모두 사용했어요");
  });

  it("초과: 초과분 N원을 천 단위 구분으로 명시한다", () => {
    expect(budgetPushCopy("budget_100", 1_110_000, 100_000).title).toBe("이번 달 예산을 1,010,000원 초과했어요");
    expect(budgetPushCopy("budget_100", 100_001, 100_000).title).toBe("이번 달 예산을 1원 초과했어요");
  });
});
