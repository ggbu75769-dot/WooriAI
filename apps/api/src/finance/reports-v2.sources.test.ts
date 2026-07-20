import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { ReportsV2Service } from "./reports-v2.service";

const user: AuthenticatedUser = {
  id: "user-owner",
  displayName: "보호자",
  email: null,
  status: "active",
  households: [{ id: "household-a", role: "owner" }]
};

function prismaFixture(expenses: unknown[] = []) {
  return {
    child: {
      findUnique: vi.fn(async () => ({
        id: "child-a",
        householdId: "household-a",
        deletedAt: null
      }))
    },
    expense: {
      findMany: vi.fn(async () => expenses)
    },
    userItemPlan: {
      findMany: vi.fn(async () => [
        {
          id: "plan-a",
          itemDefinitionId: "item-a",
          state: "planned",
          budgetKrw: 120_000,
          recurringIntervalDays: null,
          dueDate: new Date("2026-07-20T00:00:00.000Z"),
          updatedAt: new Date("2026-07-17T00:00:00.000Z")
        }
      ])
    },
    itemDefinition: {
      findMany: vi.fn(async () => [{ id: "item-a", nameKo: "기저귀" }])
    },
    user: {
      findMany: vi.fn(async () => [])
    }
  };
}

describe("Report V3 source query plan", () => {
  it("does not read the expense ledger for a planned-cost drill-down", async () => {
    const prisma = prismaFixture();
    const service = new ReportsV2Service(prisma as never);

    await expect(service.sources(user, {
      childId: "child-a",
      period: "month",
      anchor: "2026-07-17",
      kind: "planned",
      limit: 20
    })).resolves.toMatchObject({
      totals: { amountKrw: 120_000, signedAmountKrw: 120_000, recordCount: 1 }
    });

    expect(prisma.child.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.userItemPlan.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });

  it("reads the expense ledger once for an actual-cost drill-down", async () => {
    const prisma = prismaFixture();
    const service = new ReportsV2Service(prisma as never);

    await service.sources(user, {
      childId: "child-a",
      period: "month",
      anchor: "2026-07-17",
      kind: "household_net",
      limit: 20
    });

    expect(prisma.child.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.expense.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.userItemPlan.findMany).not.toHaveBeenCalled();
  });

  it("keeps a 2,000-row expense source response paginated and internally consistent", async () => {
    const expenses = Array.from({ length: 2_000 }, (_, index) => ({
      id: `expense-${String(index).padStart(4, "0")}`,
      childId: "child-a",
      householdId: "household-a",
      createdByUserId: "user-owner",
      payerUserId: "user-owner",
      categoryId: "category-a",
      expenseCategoryV2Id: null,
      linkedItemDefinitionId: index % 2 === 0 ? "item-a" : null,
      amountKrw: index + 1,
      spentOn: new Date("2026-07-17T00:00:00.000Z"),
      itemName: `지출 ${index + 1}`,
      merchant: null,
      expenseType: index % 10 === 0 ? "refund" : "expense"
    }));
    const prisma = prismaFixture(expenses);
    const service = new ReportsV2Service(prisma as never);

    const response = await service.sources(user, {
      childId: "child-a",
      period: "month",
      anchor: "2026-07-17",
      kind: "household_net",
      limit: 50
    });

    expect(response.items).toHaveLength(50);
    expect(response.nextCursor).not.toBeNull();
    expect(response.totals.recordCount).toBe(2_000);
    expect(response.totals.amountKrw).toBe(2_001_000);
    expect(response.totals.signedAmountKrw).toBe(
      expenses.reduce(
        (sum, row) => sum + (row.expenseType === "refund" ? -row.amountKrw : row.amountKrw),
        0
      )
    );
    expect(prisma.expense.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns the same aggregate/list totals across 30 deterministic reads", async () => {
    const expenses = [
      {
        id: "expense-a",
        childId: "child-a",
        householdId: "household-a",
        createdByUserId: "user-owner",
        payerUserId: "user-owner",
        categoryId: "category-a",
        expenseCategoryV2Id: null,
        linkedItemDefinitionId: "item-a",
        amountKrw: 80_000,
        spentOn: new Date("2026-07-17T00:00:00.000Z"),
        itemName: "실제 준비비",
        merchant: null,
        expenseType: "expense"
      },
      {
        id: "refund-a",
        childId: "child-a",
        householdId: "household-a",
        createdByUserId: "user-owner",
        payerUserId: "user-owner",
        categoryId: "category-a",
        expenseCategoryV2Id: null,
        linkedItemDefinitionId: "item-a",
        amountKrw: 10_000,
        spentOn: new Date("2026-07-17T00:00:00.000Z"),
        itemName: "환불",
        merchant: null,
        expenseType: "refund"
      }
    ];
    const prisma = prismaFixture(expenses);
    const service = new ReportsV2Service(prisma as never);

    for (let repeat = 0; repeat < 30; repeat += 1) {
      const response = await service.sources(user, {
        childId: "child-a",
        period: "month",
        anchor: "2026-07-17",
        kind: "household_net",
        limit: 50
      });
      expect(response.totals).toEqual({
        amountKrw: 90_000,
        signedAmountKrw: 70_000,
        recordCount: 2
      });
      expect(response.items.reduce((sum, row) => sum + row.signedAmountKrw, 0))
        .toBe(response.totals.signedAmountKrw);
    }
  });
});
