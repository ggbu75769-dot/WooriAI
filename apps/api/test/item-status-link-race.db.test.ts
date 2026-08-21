import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { markLinkedItemPrepared, type DbClient } from "../src/onboarding/store-shared";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

type StaleRead = { status: "not_prepared" | "prepared" | "gifted" | "not_needed" | "interested"; expenseId: string | null };

/**
 * FIX-119A(M-2): `markLinkedItemPrepared`의 보존 규칙이 **원자적**인지 고정한다.
 *
 * 문제였던 것: 함수는 먼저 `findUnique`로 현재 상태를 읽고, 그 결과가 "아직
 * 아무 판단 없음"이면 upsert로 `prepared`를 썼다. upsert의 update 절은
 * 무조건 `status: "prepared"`였으므로, 읽기와 쓰기 사이에 다른 트랜잭션이 같은
 * (childId, itemTemplateId)를 `gifted`/`not_needed`로 커밋하면 그 사용자 판단이
 * 지출 한 건 때문에 조용히 덮어써졌다(허위 표시: "선물로 받음"이 "준비 완료"로
 * 바뀜). 같은 창이 `prepared` 분기(expenseId 채우기)에도 있었다.
 *
 * 재현 방법: 실제 두 트랜잭션의 인터리빙을 타이밍으로 맞추는 대신, `findUnique`만
 * **낡은 값**을 돌려주는 프록시 클라이언트를 넘긴다 — 이게 정확히 "읽은 뒤
 * 남이 커밋한" 상태다. 쓰기(원자 문)는 진짜 DB로 나가므로, 보존 규칙이
 * 읽기가 아니라 쓰기 시점 조건으로 성립하는지가 그대로 드러난다.
 *
 * 격리: 픽스처(사용자·가구·아이·준비템·지출)를 테스트마다 새로 만들고 모든
 * 단언을 그 id로만 스코프한다(다른 DB 스위트와 병렬 실행 안전).
 */
describe.skipIf(!dbAvailable)("markLinkedItemPrepared 보존 규칙 원자성 (real Postgres)", () => {
  let prisma: PrismaClient;
  let userId: string;
  let householdId: string;
  let childId: string;
  let categoryId: string;

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();

    const user = await prisma.user.create({
      data: { authProvider: "kakao", providerUserId: `item-race-${randomUUID()}`, displayName: "M-2 레이스" }
    });
    userId = user.id;
    const household = await prisma.household.create({ data: { name: "M-2 가구", ownerUserId: userId } });
    householdId = household.id;
    const child = await prisma.child.create({
      data: { householdId, nickname: "레이스", stageMode: "manual", manualStage: "infant_4_6" }
    });
    childId = child.id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { active: true } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function newItemTemplate() {
    const template = await prisma.itemTemplate.create({
      data: {
        code: `m2-race-${randomUUID().slice(0, 8)}`,
        name: "레이스 준비템",
        necessityLevel: "essential",
        reasonText: "테스트 픽스처"
      }
    });
    return template.id;
  }

  async function newExpense(itemTemplateId: string) {
    const expense = await prisma.expense.create({
      data: {
        householdId,
        childId,
        createdByUserId: userId,
        categoryId,
        amountKrw: 12000,
        spentOn: new Date("2026-07-06"),
        itemName: `레이스 지출 ${randomUUID().slice(0, 8)}`,
        linkedItemTemplateId: itemTemplateId
      }
    });
    return expense.id;
  }

  function statusRow(itemTemplateId: string) {
    return prisma.childItemStatus.findUnique({
      where: { childId_itemTemplateId: { childId, itemTemplateId } }
    });
  }

  /**
   * `findUnique`만 낡은 값을 돌려주는 클라이언트. 그 외 모든 호출(원자 쓰기
   * 포함)은 진짜 Prisma 클라이언트로 그대로 나간다.
   */
  function withStaleRead(stale: StaleRead | null): DbClient {
    const delegate = prisma.childItemStatus;
    const staleDelegate = new Proxy(delegate, {
      get(target, prop, receiver) {
        if (prop === "findUnique") {
          return async () => stale;
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
    return new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop === "childItemStatus") {
          return staleDelegate;
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as unknown as DbClient;
  }

  it("(1) 사전 gifted 상태 → 연결 지출이 생겨도 불변 (preserved)", async () => {
    const itemTemplateId = await newItemTemplate();
    const expenseId = await newExpense(itemTemplateId);
    await prisma.childItemStatus.create({
      data: { childId, itemTemplateId, status: "gifted", updatedByUserId: userId }
    });

    await expect(
      markLinkedItemPrepared(prisma as unknown as DbClient, { childId, itemTemplateId, userId, expenseId })
    ).resolves.toBe("preserved");

    const row = await statusRow(itemTemplateId);
    expect(row).toMatchObject({ status: "gifted", expenseId: null });
  });

  it("(2) M-2 레이스: 읽을 땐 행이 없었는데 그 사이 gifted가 커밋됨 → 덮어쓰지 않는다", async () => {
    const itemTemplateId = await newItemTemplate();
    const expenseId = await newExpense(itemTemplateId);
    // 다른 트랜잭션이 방금 커밋한 사용자 판단.
    await prisma.childItemStatus.create({
      data: { childId, itemTemplateId, status: "gifted", updatedByUserId: userId }
    });

    // 이 호출의 findUnique는 커밋 **이전** 스냅샷(행 없음)을 본다.
    await expect(
      markLinkedItemPrepared(withStaleRead(null), { childId, itemTemplateId, userId, expenseId })
    ).resolves.toBe("preserved");

    const row = await statusRow(itemTemplateId);
    expect(row).toMatchObject({ status: "gifted", expenseId: null });
  });

  it("(3) M-2 레이스: 읽을 땐 not_prepared였는데 그 사이 not_needed가 커밋됨 → 덮어쓰지 않는다", async () => {
    const itemTemplateId = await newItemTemplate();
    const expenseId = await newExpense(itemTemplateId);
    await prisma.childItemStatus.create({
      data: { childId, itemTemplateId, status: "not_needed", updatedByUserId: userId }
    });

    await expect(
      markLinkedItemPrepared(withStaleRead({ status: "not_prepared", expenseId: null }), {
        childId,
        itemTemplateId,
        userId,
        expenseId
      })
    ).resolves.toBe("preserved");

    const row = await statusRow(itemTemplateId);
    expect(row).toMatchObject({ status: "not_needed", expenseId: null });
  });

  it("(4) M-2 레이스(prepared 분기): 그 사이 gifted가 되면 expenseId도 붙이지 않는다", async () => {
    const itemTemplateId = await newItemTemplate();
    const expenseId = await newExpense(itemTemplateId);
    await prisma.childItemStatus.create({
      data: { childId, itemTemplateId, status: "gifted", updatedByUserId: userId }
    });

    // 낡은 읽기: "prepared인데 연결된 지출이 없음" → 예전 코드라면 무조건 update.
    await expect(
      markLinkedItemPrepared(withStaleRead({ status: "prepared", expenseId: null }), {
        childId,
        itemTemplateId,
        userId,
        expenseId
      })
    ).resolves.toBe("preserved");

    const row = await statusRow(itemTemplateId);
    expect(row).toMatchObject({ status: "gifted", expenseId: null });
  });

  it("(5) prepared 분기: 그 사이 다른 지출이 먼저 연결되면 최초 연결을 보존한다", async () => {
    const itemTemplateId = await newItemTemplate();
    const firstExpenseId = await newExpense(itemTemplateId);
    const laterExpenseId = await newExpense(itemTemplateId);
    await prisma.childItemStatus.create({
      data: { childId, itemTemplateId, status: "prepared", expenseId: firstExpenseId, updatedByUserId: userId }
    });

    await expect(
      markLinkedItemPrepared(withStaleRead({ status: "prepared", expenseId: null }), {
        childId,
        itemTemplateId,
        userId,
        expenseId: laterExpenseId
      })
    ).resolves.toBe("preserved");

    const row = await statusRow(itemTemplateId);
    expect(row).toMatchObject({ status: "prepared", expenseId: firstExpenseId });
  });

  it("(6) 정상 경로는 그대로: 행 없음 → prepared 생성, not_prepared/interested → prepared 갱신", async () => {
    // 행이 없던 경우(원자 문의 INSERT 경로).
    const freshTemplateId = await newItemTemplate();
    const freshExpenseId = await newExpense(freshTemplateId);
    await expect(
      markLinkedItemPrepared(prisma as unknown as DbClient, {
        childId,
        itemTemplateId: freshTemplateId,
        userId,
        expenseId: freshExpenseId
      })
    ).resolves.toBe("marked");
    expect(await statusRow(freshTemplateId)).toMatchObject({
      status: "prepared",
      expenseId: freshExpenseId,
      updatedByUserId: userId
    });

    // 이미 행이 있던 경우(원자 문의 ON CONFLICT DO UPDATE 경로).
    for (const priorStatus of ["not_prepared", "interested"] as const) {
      const itemTemplateId = await newItemTemplate();
      const expenseId = await newExpense(itemTemplateId);
      const seeded = await prisma.childItemStatus.create({
        data: { childId, itemTemplateId, status: priorStatus, updatedByUserId: userId }
      });

      await expect(
        markLinkedItemPrepared(prisma as unknown as DbClient, { childId, itemTemplateId, userId, expenseId })
      ).resolves.toBe("marked");

      const row = await statusRow(itemTemplateId);
      expect(row).toMatchObject({ status: "prepared", expenseId, updatedByUserId: userId });
      // raw 경로에서도 updated_at을 직접 찍는다(@updatedAt은 Prisma 애플리케이션 레벨).
      expect(row!.updatedAt.getTime()).toBeGreaterThan(seeded.updatedAt.getTime());
    }
  });

  it("(7) prepared인데 연결 지출이 없던 행 → expenseId만 채우고 상태는 그대로 (linked)", async () => {
    const itemTemplateId = await newItemTemplate();
    const expenseId = await newExpense(itemTemplateId);
    await prisma.childItemStatus.create({
      data: { childId, itemTemplateId, status: "prepared", updatedByUserId: userId }
    });

    await expect(
      markLinkedItemPrepared(prisma as unknown as DbClient, { childId, itemTemplateId, userId, expenseId })
    ).resolves.toBe("linked");

    expect(await statusRow(itemTemplateId)).toMatchObject({ status: "prepared", expenseId });
  });
});
