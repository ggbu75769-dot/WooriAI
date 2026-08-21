import { randomUUID } from "node:crypto";
import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import type { AuthenticatedUser } from "../src/common/types/authenticated-request";
import { DevicesService } from "../src/devices/devices.service";
import { ExpensesVersionService } from "../src/finance/expenses.service";
import { PrismaService } from "../src/prisma/prisma.service";
import type { FcmSenderService, FcmSendResult, PushNotificationMessage } from "../src/push/fcm-sender.service";
import type { PushConfigService } from "../src/push/push-config.service";
import { PushDispatchService, resolveCrossedBoundary } from "../src/push/push-dispatch.service";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

// PUSH-113: 지출 생성 → 예산 경계(80%/100%) 푸시 발송 오케스트레이션을 실 Postgres로
// 검증한다. FCM 자체는 스텁 sender로 대체한다(HTTP 계층 검증은 push-fcm.test.ts).
// 다른 스위트와 DB를 공유하므로 모든 데이터는 테스트별 고유 가구/아이로 스코프한다
// (test-db.ts의 주석 참조).

const BUDGET_KRW = 100_000;
const MONTH_START = new Date("2026-05-01T00:00:00.000Z");
const SPENT_ON = new Date("2026-05-15T00:00:00.000Z");

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

  it("80% 경계를 넘는 지출: 활성 구성원의 활성 기기(2대)에만 budget_80 발송", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const crossing = await createExpenseRow(fixture, 15_000); // 70k -> 85k (>= 80%)

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
      yearMonth: "2026-05"
    });
  });

  it("80%와 100%를 한 번에 지나는 지출은 budget_100만 발송 (초과는 strict >)", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 70_000);
    const crossing = await createExpenseRow(fixture, 40_000); // 70k -> 110k

    const sender = stubSender();
    const summary = await buildDispatch(sender).onExpenseCreated(crossing.id);

    expect(summary.notificationType).toBe("budget_100");
    expect(sender.calls).toHaveLength(2);
    expect(sender.calls[0].notification.title).toBe("이번 달 예산을 초과했어요");
  });

  it("이미 초과한 뒤의 추가 지출은 다시 알리지 않는다 (경계 통과 시 1회 = dedupe)", async () => {
    const fixture = await createFixture();
    await createExpenseRow(fixture, 120_000); // 이미 초과 상태
    const after = await createExpenseRow(fixture, 10_000);

    const sender = stubSender();
    const summary = await buildDispatch(sender).onExpenseCreated(after.id);

    expect(summary.skipped).toBe(true);
    expect(sender.calls).toHaveLength(0);
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
});

describe("resolveCrossedBoundary (경계 판정 순수 함수)", () => {
  it.each([
    // [before, after, budget, expected]
    [0, 79_999, 100_000, null],
    [0, 80_000, 100_000, "budget_80"],
    [79_999, 80_000, 100_000, "budget_80"],
    [80_000, 90_000, 100_000, null], // 이미 80% 이상이었음
    [90_000, 100_000, 100_000, null], // 정확히 예산 == 초과 아님 (strict >)
    [100_000, 100_001, 100_000, "budget_100"],
    [70_000, 110_000, 100_000, "budget_100"], // 두 경계 동시 통과 -> 100만
    [110_000, 120_000, 100_000, null], // 이미 초과 상태
    [0, 50_000, 0, null] // 예산 미설정
  ] as Array<[number, number, number, "budget_80" | "budget_100" | null]>)(
    "before=%d after=%d budget=%d -> %s",
    (before, after, budget, expected) => {
      expect(resolveCrossedBoundary(before, after, budget)).toBe(expected);
    }
  );
});
