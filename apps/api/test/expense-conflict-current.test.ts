import { HttpException } from "@nestjs/common";
import type { Expense as PrismaExpense } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ExpensesVersionService } from "../src/finance/expenses.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-request";
import type { ExpensesStoreService } from "../src/onboarding/expenses-store.service";
import type { PrismaService } from "../src/prisma/prisma.service";

/**
 * 라운드 108 T24 후속 — **409 `current`가 무엇을 싣고, 무엇이 그것을 지키나.**
 *
 * ## 왜 이 파일이 DB를 쓰지 않나 (그리고 왜 e2e만으로는 부족했나)
 *
 * 이 표의 인가는 **두 벌**이다:
 *   · `ExpensesVersionService.authorizeExpenseRow` — PATCH/DELETE가 CAS 앞에서 지나는 관문
 *   · `ExpensesStoreService.requireExpenseAccess` → `requireChildAccess` — 스토어가 실제 필드를
 *     건드리기 직전에 지나는 관문
 * T24가 역돌연변이로 재어 낸 사실이 이것이다: **앞의 한 벌만 지워도 e2e가 전부 초록이었다** —
 * 성공 갈래에서는 뒤의 한 벌이 대신 403을 던지기 때문이다. 두 벌이 서로를 가려 주는 바람에,
 * 앞의 관문이 죽었다는 것을 아무 테스트도 말하지 못했다. 그리고 그 상태에서 실제로 열리는
 * 갈래가 하나 있었다: **CAS가 실패하는 요청**(낡은 `expectedVersion`)은 스토어에 닿기 전에
 * 409로 갈리므로, 뒤의 관문이 볼 기회가 없다.
 *
 * 그래서 이 파일은 **스토어를 인가하지 않는 대역으로 바꾼 세계**에서 잰다(대역은 언제나
 * 성공한다). 그 세계에서 남는 방어는 앞의 한 벌과 `versionConflictFor`의 읽기 술어뿐이므로,
 * 둘 중 하나가 죽으면 여기서 **혼자** 빨개진다 — 가림을 없애는 것이 이 파일의 존재 이유다.
 * (교차가구 e2e는 `expenses-version.db.test.ts`가 계속 들고 있다. 이 파일은 그것을 대체하지
 * 않고, 그 e2e가 구조적으로 볼 수 없는 것을 본다.)
 *
 * ## 이 파일이 값으로 들고 있는 세 가지
 *  ① 주인이 낡은 버전을 보냈을 때 409 `current`가 싣는 **축 전량**(리터럴). 축소가 일어나면
 *     빨개진다 — 모바일 충돌 화면의 "두 값 나란히 보기"가 쓰는 여덟 축이 여기 들어 있다
 *     (apps/mobile/src/offline/sync-engine.ts `diffExpenseFields`).
 *  ② 그 값을 읽는 쿼리의 **술어**(리터럴) — 호출자의 가구 집합으로 좁는다.
 *  ③ 가구 밖 사용자는 CAS에도 스토어에도 닿지 못하고, 응답 어디에도 그 지출의 자유 문자열이
 *     한 글자도 없다.
 */

const EXPENSE_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const STRANGER_HOUSEHOLD = "99999999-9999-4999-8999-999999999999";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const CATEGORY_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_BY = "55555555-5555-4555-8555-555555555555";

/** 셋 다 사용자가 손으로 적은 자유 문자열이다 — 라운드 107이 감사 봉투에서 빼낸 바로 그 축들. */
const ITEM_NAME = "충돌원문 유기농 기저귀";
const MERCHANT = "충돌원문 상점";
const MEMO = "충돌원문 메모 — 둘째 대비";

function makeRow(overrides: Partial<PrismaExpense> = {}): PrismaExpense {
  return {
    id: EXPENSE_ID,
    householdId: OWNER_HOUSEHOLD,
    childId: CHILD_ID,
    createdByUserId: CREATED_BY,
    categoryId: CATEGORY_ID,
    amountKrw: 49800,
    spentOn: new Date("2026-07-06T00:00:00.000Z"),
    itemName: ITEM_NAME,
    merchant: MERCHANT,
    paymentMethod: "card",
    expenseType: "expense",
    source: "manual",
    memo: MEMO,
    linkedItemTemplateId: null,
    linkedProductLinkId: null,
    importJobId: null,
    version: 7,
    deletedAt: null,
    createdAt: new Date("2026-07-06T00:00:00.000Z"),
    updatedAt: new Date("2026-07-06T00:00:00.000Z"),
    ...overrides
  } as PrismaExpense;
}

function memberOf(householdId: string): AuthenticatedUser {
  return {
    id: CREATED_BY,
    displayName: "테스트",
    email: null,
    status: "active",
    households: [{ id: householdId, role: "owner" }]
  };
}

type Harness = {
  service: ExpensesVersionService;
  calls: {
    findUnique: Array<Record<string, unknown>>;
    findFirst: Array<Record<string, unknown>>;
    updateMany: Array<Record<string, unknown>>;
    store: string[];
  };
};

/**
 * `updateMany`(CAS)가 **언제나 0건**을 돌려준다 — 이 파일이 재는 것이 충돌 갈래 하나이기
 * 때문이다. 스토어 대역은 **언제나 성공**한다: 인가를 대신 해 주는 스토어를 지우는 것이
 * 이 harness의 목적이므로, 대역이 403을 던지면 가림이 그대로 남는다.
 */
function makeHarness(row: PrismaExpense): Harness {
  const calls: Harness["calls"] = { findUnique: [], findFirst: [], updateMany: [], store: [] };

  const prisma = {
    expense: {
      findUnique: async (args: { where: { id: string } }) => {
        calls.findUnique.push(args);
        return args.where.id === row.id ? row : null;
      },
      findFirst: async (args: { where: { id: string; householdId?: { in: string[] } } }) => {
        calls.findFirst.push(args);
        if (args.where.id !== row.id) return null;
        // 술어를 **실제로 적용**한다. 인자만 받아 두고 무시하면 "좁혔다"가 값으로 확인되지 않는다.
        const allowed = args.where.householdId?.in;
        if (allowed !== undefined && !allowed.includes(row.householdId)) return null;
        return row;
      },
      updateMany: async (args: Record<string, unknown>) => {
        calls.updateMany.push(args);
        return { count: 0 };
      },
      update: async () => row
    }
  };

  const store = {
    updateExpense: async () => {
      calls.store.push("updateExpense");
      return { id: row.id };
    },
    deleteExpense: async () => {
      calls.store.push("deleteExpense");
      return { success: true };
    }
  };

  return {
    service: new ExpensesVersionService(
      prisma as unknown as PrismaService,
      store as unknown as ExpensesStoreService
    ),
    calls
  };
}

async function captureHttp(run: () => Promise<unknown>): Promise<HttpException> {
  try {
    await run();
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error("이 갈래는 반드시 던진다 — 던지지 않았어요");
}

function bodyOf(error: HttpException): Record<string, unknown> {
  return error.getResponse() as Record<string, unknown>;
}

describe("409 VERSION_CONFLICT의 current — 무엇을 싣고 무엇이 지키나", () => {
  /**
   * ① **재현 실측(정상 경로).** 인가를 한 겹도 떼지 않은 세계에서, 주인이 자기 지출에 낡은
   * `expectedVersion`을 보냈을 때 409 `current`가 싣는 값 전량이다. 기대값은 리터럴이고
   * `toEqual`이라 **더해도 빼도** 빨개진다.
   *
   * 이 열다섯 축 중 여덟(categoryId·amountKrw·spentOn·itemName·merchant·memo·paymentMethod·
   * expenseType)이 모바일 충돌 화면의 비교 항목이다(sync-engine.ts `diffExpenseFields`). 자유
   * 문자열 셋이 거기 들어 있는 것이 **의도**다 — 이 값은 감사 기록이 아니라 사용자가 "다른 기기
   * 값 유지 / 내 변경 다시 적용 / 두 값 나란히 보기" 중 하나를 고르라고 주는 값이고, 서버 쪽
   * 품목명·판매처·메모를 지우면 화면은 고르라고 하면서 무엇을 고르는지는 안 보여 주게 된다
   * (라운드 48 QA(P2-6)가 `paymentMethod` 하나 빠졌을 때 실측한 그 허위 표시와 같은 종류다).
   */
  it("주인이 낡은 버전을 보내면 409의 current가 지출의 축 전량을 그대로 싣는다", async () => {
    const { service } = makeHarness(makeRow());

    const error = await captureHttp(() =>
      service.updateExpense(memberOf(OWNER_HOUSEHOLD), EXPENSE_ID, { amountKrw: 1, expectedVersion: 2 })
    );

    expect(error.getStatus()).toBe(409);
    expect(bodyOf(error)).toEqual({
      code: "VERSION_CONFLICT",
      message: "다른 곳에서 먼저 변경됐어요. 최신 내용을 다시 불러와 주세요.",
      current: {
        id: EXPENSE_ID,
        childId: CHILD_ID,
        categoryId: CATEGORY_ID,
        amountKrw: 49800,
        spentOn: "2026-07-06",
        itemName: ITEM_NAME,
        merchant: MERCHANT,
        paymentMethod: "card",
        memo: MEMO,
        linkedItemTemplateId: null,
        linkedProductLinkId: null,
        expenseType: "expense",
        source: "manual",
        createdByUserId: CREATED_BY,
        version: 7
      }
    });
  });

  /**
   * ② 그 값을 읽는 **술어**를 값으로 고정한다.
   *
   * 종전(라운드 108까지, 그때도 참): 이 읽기는 `findUnique({ where: { id } })`였고, "남의 지출이
   * 실리지 않는다"는 보장이 전적으로 **다른 줄**(호출자가 먼저 지나는 `authorizeExpenseRow`)에
   * 있었다. 지금: 읽기 자체가 `user.households`에서 파생한 가구 집합으로 좁는다 — 보장이 값을
   * 내보내는 그 줄에 함께 선다. `expense-owner-scope.test.ts`의 등재(#7)가 같은 술어를 대장에
   * 적어 두었고, 여기서는 **실행 시점의 인자**로 다시 잰다(대장은 소스 텍스트만 본다).
   */
  it("409 current를 읽는 쿼리가 호출자의 가구 집합으로 좁는다", async () => {
    const { service, calls } = makeHarness(makeRow());

    await captureHttp(() =>
      service.updateExpense(memberOf(OWNER_HOUSEHOLD), EXPENSE_ID, { amountKrw: 1, expectedVersion: 2 })
    );

    expect(calls.findFirst).toEqual([
      { where: { id: EXPENSE_ID, householdId: { in: [OWNER_HOUSEHOLD] } } }
    ]);
  });

  /**
   * ③ **가림 제거 — 스토어가 인가를 대신 해 주지 않는 세계에서도 막힌다.**
   *
   * 이 harness의 스토어 대역은 무엇을 시켜도 성공한다. 그러므로 아래 403을 만들 수 있는 것은
   * `ExpensesVersionService`가 소유한 한 벌(`authorizeExpenseRow`)뿐이고, 그 한 벌이 죽으면
   * 이 단언이 **혼자** 빨개진다 — T24가 관측한 "한 벌을 지워도 전부 초록"이 여기서는 성립하지
   * 않는다. 상태코드만이 아니라 **응답에 자유 문자열이 없다**는 것까지 값으로 본다: 이 갈래가
   * 409로 갈리는 순간 새는 것이 바로 그 세 문자열이기 때문이다.
   */
  it("가구 밖 사용자는 낡은 버전으로도 403이고, CAS·스토어에 닿지 않으며, 원문이 새지 않는다", async () => {
    for (const stale of [2, 999]) {
      const { service, calls } = makeHarness(makeRow());

      const error = await captureHttp(() =>
        service.updateExpense(memberOf(STRANGER_HOUSEHOLD), EXPENSE_ID, {
          amountKrw: 1,
          expectedVersion: stale
        })
      );

      expect(error.getStatus()).toBe(403);
      expect(bodyOf(error)).toEqual({ code: "FORBIDDEN", message: "지출 기록 접근 권한이 없어요." });

      const serialized = JSON.stringify(bodyOf(error));
      for (const secret of [ITEM_NAME, MERCHANT, MEMO, "49800"]) {
        expect(serialized).not.toContain(secret);
      }

      // 관문이 CAS **앞에** 선다는 사실도 값이다 — 뒤로 밀리면 남의 지출 version이 움직인다.
      expect(calls.updateMany).toEqual([]);
      expect(calls.store).toEqual([]);
    }
  });

  /**
   * ④ 삭제 쪽도 같은 두 갈래를 갖는다. PATCH만 재고 DELETE를 비워 두면, 관문이 한쪽에서만
   * 죽는 변이가 초록으로 남는다(`deleteExpense`도 자기 `authorizeExpenseRow` 호출을 따로 들고
   * 있다 — 한 줄이 아니라 두 줄이다).
   */
  it("DELETE도 같다 — 주인은 409 current를 받고, 가구 밖 사용자는 403이며 원문이 없다", async () => {
    const owner = makeHarness(makeRow());
    const ownerError = await captureHttp(() =>
      owner.service.deleteExpense(memberOf(OWNER_HOUSEHOLD), EXPENSE_ID, 2)
    );
    expect(ownerError.getStatus()).toBe(409);
    expect((bodyOf(ownerError).current as Record<string, unknown>).itemName).toBe(ITEM_NAME);
    expect(owner.calls.findFirst).toEqual([
      { where: { id: EXPENSE_ID, householdId: { in: [OWNER_HOUSEHOLD] } } }
    ]);

    const stranger = makeHarness(makeRow());
    const strangerError = await captureHttp(() =>
      stranger.service.deleteExpense(memberOf(STRANGER_HOUSEHOLD), EXPENSE_ID, 2)
    );
    expect(strangerError.getStatus()).toBe(403);
    expect(JSON.stringify(bodyOf(strangerError))).not.toContain(ITEM_NAME);
    expect(stranger.calls.updateMany).toEqual([]);
    expect(stranger.calls.store).toEqual([]);
  });

  /**
   * ⑤ 이미 지워진 지출의 충돌은 **묘비**다 — 자유 문자열을 한 축도 싣지 않는다. `toEqual`이라
   * 여기에 품목명이 더해지는 날 빨개진다(모바일은 이 갈래에서 `deleted`만 보고 화면을 고른다:
   * apps/mobile/src/offline/sync-engine.ts의 `conflictCurrent?.deleted` 판정).
   */
  it("소프트 삭제된 지출의 409 current는 묘비 세 축뿐이다", async () => {
    const { service } = makeHarness(makeRow({ deletedAt: new Date("2026-07-07T00:00:00.000Z") }));

    const error = await captureHttp(() =>
      service.updateExpense(memberOf(OWNER_HOUSEHOLD), EXPENSE_ID, { amountKrw: 1, expectedVersion: 2 })
    );

    expect(error.getStatus()).toBe(409);
    expect(bodyOf(error).current).toEqual({ id: EXPENSE_ID, deleted: true, version: 7 });
  });
});
