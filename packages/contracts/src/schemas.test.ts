import { describe, expect, it } from "vitest";
import {
  childSchema,
  createExpenseRequestSchema,
  deleteExpenseRequestSchema,
  listCategoriesResponseSchema,
  expenseSchema,
  homeMonthlyBudgetSchema,
  homeSummarySchema,
  importRowSchema,
  itemSummarySchema,
  moneyKrwSchema,
  MONEY_KRW_MAX,
  productLinkSchema,
  reportCategorySchema,
  reportMonthlySchema,
  reportTrendSchema,
  reportYearlySchema,
  TREND_REPORT_DEFAULT_MONTHS,
  TREND_REPORT_MAX_MONTHS,
  listExpensesQuerySchema,
  updateExpenseRequestSchema,
  versionConflictResponseSchema
} from "./schemas";

describe("shared contract schemas", () => {
  it("shares the MoneyKRW positive integer contract", () => {
    expect(moneyKrwSchema.parse(49800)).toBe(49800);
    expect(() => moneyKrwSchema.parse(0)).toThrow();
    expect(() => moneyKrwSchema.parse(1.5)).toThrow();
  });

  /**
   * GAP-054 라운드 54 P2-8 — `.max()` 경계. 상한 값 자체는 통과하고 한 칸 위는 거절돼야 한다.
   * 상수는 이제 `@wooriai/domain`이 단일 소스이고 이 패키지는 그것을 재수출한다(schemas.ts
   * 상단 주석) — 아래 대조는 재수출이 끊기거나 숫자가 갈리는 순간 빨개진다.
   */
  it("caps a single MoneyKRW amount at the int4 column limit", () => {
    expect(MONEY_KRW_MAX).toBe(2_147_483_647);
    expect(moneyKrwSchema.parse(MONEY_KRW_MAX)).toBe(MONEY_KRW_MAX);
    expect(moneyKrwSchema.parse(MONEY_KRW_MAX - 1)).toBe(MONEY_KRW_MAX - 1);
    expect(() => moneyKrwSchema.parse(MONEY_KRW_MAX + 1)).toThrow();
    expect(() => moneyKrwSchema.parse(Number.MAX_SAFE_INTEGER)).toThrow();
    // 요청 계약(생성)도 같은 상한을 문다 -- 스키마 하나만 고쳐서 갈라지지 않게.
    const base = {
      categoryId: "11111111-1111-4111-8111-111111111111",
      spentOn: "2026-07-05",
      itemName: "기저귀"
    };
    expect(createExpenseRequestSchema.parse({ ...base, amountKrw: MONEY_KRW_MAX }).amountKrw).toBe(MONEY_KRW_MAX);
    expect(() => createExpenseRequestSchema.parse({ ...base, amountKrw: MONEY_KRW_MAX + 1 })).toThrow();
  });

  it("validates CreateExpenseRequest shape from OpenAPI", () => {
    expect(
      createExpenseRequestSchema.parse({
        categoryId: "11111111-1111-4111-8111-111111111111",
        amountKrw: 49800,
        spentOn: "2026-07-05",
        itemName: "기저귀",
        paymentMethod: "card"
      })
    ).toMatchObject({ itemName: "기저귀", amountKrw: 49800, expenseType: "expense" });

    expect(() =>
      createExpenseRequestSchema.parse({
        categoryId: "not-a-uuid",
        amountKrw: 0,
        spentOn: "2026-07-05",
        itemName: "기저귀"
      })
    ).toThrow();
  });

  it("accepts an explicit gift expenseType on the create request and rejects unsupported values", () => {
    expect(
      createExpenseRequestSchema.parse({
        categoryId: "11111111-1111-4111-8111-111111111111",
        amountKrw: 49800,
        spentOn: "2026-07-05",
        itemName: "기저귀",
        expenseType: "gift"
      })
    ).toMatchObject({ expenseType: "gift" });

    expect(() =>
      createExpenseRequestSchema.parse({
        categoryId: "11111111-1111-4111-8111-111111111111",
        amountKrw: 49800,
        spentOn: "2026-07-05",
        itemName: "기저귀",
        expenseType: "refund"
      })
    ).toThrow();
  });

  it("keeps createdByUserId optional on the expense response contract", () => {
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      childId: "22222222-2222-4222-8222-222222222222",
      categoryId: "44444444-4444-4444-8444-444444444444",
      amountKrw: 49800,
      spentOn: "2026-07-05",
      itemName: "기저귀",
      version: 1
    };

    expect(expenseSchema.parse(base).createdByUserId).toBeUndefined();
    expect(
      expenseSchema.parse({
        ...base,
        createdByUserId: "33333333-3333-4333-8333-333333333333"
      }).createdByUserId
    ).toBe("33333333-3333-4333-8333-333333333333");
  });

  // CON-115: categoryId(DB not-null)와 version(MOB-103, 생성 시 1)은 required.
  it("requires categoryId and a positive integer version on the expense response contract", () => {
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      childId: "22222222-2222-4222-8222-222222222222",
      categoryId: "44444444-4444-4444-8444-444444444444",
      amountKrw: 49800,
      spentOn: "2026-07-05",
      itemName: "기저귀",
      version: 3
    };

    expect(expenseSchema.parse(base).version).toBe(3);

    const { categoryId: _categoryId, ...withoutCategory } = base;
    expect(() => expenseSchema.parse(withoutCategory)).toThrow();

    const { version: _version, ...withoutVersion } = base;
    expect(() => expenseSchema.parse(withoutVersion)).toThrow();
    expect(() => expenseSchema.parse({ ...base, version: 0 })).toThrow();
    expect(() => expenseSchema.parse({ ...base, version: 1.5 })).toThrow();
  });

  // CON-115: PATCH/DELETE의 expectedVersion 요청 계약.
  it("validates the expectedVersion update/delete request contracts and rejects refund on update", () => {
    expect(
      updateExpenseRequestSchema.parse({ amountKrw: 59800, expectedVersion: 2 })
    ).toEqual({ amountKrw: 59800, expectedVersion: 2 });
    // expectedVersion 없는 레거시 수정도 계속 유효하다.
    expect(updateExpenseRequestSchema.parse({ memo: "수정" })).toEqual({ memo: "수정" });
    expect(() => updateExpenseRequestSchema.parse({ expectedVersion: 0 })).toThrow();
    expect(() => updateExpenseRequestSchema.parse({ expenseType: "refund" })).toThrow();
    expect(updateExpenseRequestSchema.parse({ expenseType: "gift" }).expenseType).toBe("gift");

    expect(deleteExpenseRequestSchema.parse({ expectedVersion: 1 }).expectedVersion).toBe(1);
    expect(deleteExpenseRequestSchema.parse({}).expectedVersion).toBeUndefined();
    expect(() => deleteExpenseRequestSchema.parse({ expectedVersion: -1 })).toThrow();
  });

  // CON-115: 409 VERSION_CONFLICT 바디 계약 — {error:{...}, current}.
  it("validates the 409 VERSION_CONFLICT body with live, tombstone, and null current snapshots", () => {
    const error = {
      code: "VERSION_CONFLICT" as const,
      message: "다른 곳에서 먼저 변경됐어요. 최신 내용을 다시 불러와 주세요.",
      requestId: "req-1"
    };
    const liveCurrent = {
      id: "11111111-1111-4111-8111-111111111111",
      childId: "22222222-2222-4222-8222-222222222222",
      categoryId: "44444444-4444-4444-8444-444444444444",
      amountKrw: 30000,
      spentOn: "2026-07-05",
      itemName: "기저귀",
      merchant: null,
      memo: null,
      expenseType: "expense",
      source: "manual",
      createdByUserId: "33333333-3333-4333-8333-333333333333",
      version: 3
    };

    expect(versionConflictResponseSchema.parse({ error, current: liveCurrent }).current).toMatchObject({
      version: 3
    });
    expect(
      versionConflictResponseSchema.parse({
        error,
        current: { id: liveCurrent.id, deleted: true, version: 2 }
      }).current
    ).toEqual({ id: liveCurrent.id, deleted: true, version: 2 });
    expect(versionConflictResponseSchema.parse({ error, current: null }).current).toBeNull();

    // 다른 에러 코드는 이 계약이 아니다.
    expect(() =>
      versionConflictResponseSchema.parse({
        error: { ...error, code: "IDEMPOTENCY_KEY_CONFLICT" },
        current: null
      })
    ).toThrow();
  });

  it("lets the home summary budget be 0 when no monthly budget is set, unlike the strict budget endpoint contract", () => {
    const child = {
      id: "11111111-1111-4111-8111-111111111111",
      householdId: "22222222-2222-4222-8222-222222222222",
      nickname: "뽀미",
      stageMode: "manual" as const,
      manualStage: "infant_4_6" as const,
      currentStage: "infant_4_6" as const,
      stageLabel: "수동 선택: 4~6개월"
    };

    expect(
      homeMonthlyBudgetSchema.parse({
        childId: child.id,
        yearMonth: "2026-07-01",
        amountKrw: 0,
        usedAmountKrw: 0,
        remainingAmountKrw: 0
      }).amountKrw
    ).toBe(0);

    expect(
      homeSummarySchema.parse({
        child,
        totalExpenseKrw: 0,
        monthly: {
          childId: child.id,
          yearMonth: "2026-07-01",
          amountKrw: 0,
          usedAmountKrw: 0,
          remainingAmountKrw: 0
        },
        recommendedItems: [],
        recentExpenses: []
      }).monthly.amountKrw
    ).toBe(0);
  });

  it("validates child and item enums from the domain package", () => {
    expect(
      childSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        householdId: "22222222-2222-4222-8222-222222222222",
        nickname: "뽀미",
        stageMode: "manual",
        manualStage: "infant_4_6",
        currentStage: "infant_4_6",
        stageLabel: "수동 선택: 4~6개월"
      }).currentStage
    ).toBe("infant_4_6");

    expect(() =>
      itemSummarySchema.parse({
        id: "33333333-3333-4333-8333-333333333333",
        name: "카시트",
        necessityLevel: "paid",
        status: "not_prepared"
      })
    ).toThrow();
  });

  it("keeps affiliate disclosure and import preview contracts explicit", () => {
    expect(
      productLinkSchema.parse({
        id: "44444444-4444-4444-8444-444444444444",
        platform: "coupang",
        title: "카시트 보기",
        isAffiliate: true,
        isSponsored: false,
        disclosureText: "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."
      }).disclosureText
    ).toContain("수수료");

    expect(
      importRowSchema.parse({
        id: "55555555-5555-4555-8555-555555555555",
        rowIndex: 1,
        parsedDate: "2026-07-05",
        parsedItemName: "기저귀",
        parsedAmountKrw: 49800,
        confidence: 0.69,
        selected: false,
        validationStatus: "ready"
      }).selected
    ).toBe(false);
  });

  /**
   * 라운드 51 #9: 판매처별 가격은 **확인 시각과 짝**이다. 기준 시각 없는 스냅샷 가격은
   * 사용자가 현재가로 읽으므로 그 자체가 허위 표시라, 계약이 한쪽만 실린 응답을 거절한다.
   * 서버도 같은 규칙을 강제한다(apps/api items-catalog.service.ts toProductLinkDto).
   */
  it("가격과 가격 확인 시각은 함께 있거나 함께 없다 (라운드 51 #9)", () => {
    const base = {
      id: "44444444-4444-4444-8444-444444444444",
      platform: "coupang" as const,
      title: "카시트 보기",
      isAffiliate: true,
      isSponsored: false
    };

    // 둘 다 없는 응답(이 필드를 모르는 구버전 서버)은 그대로 통과한다 — 가산 optional.
    expect(productLinkSchema.parse(base).id).toBe(base.id);

    const priced = productLinkSchema.parse({
      ...base,
      priceSnapshotKrw: 249_000,
      priceCheckedAt: "2026-08-01T03:00:00.000Z"
    });
    expect(priced.priceSnapshotKrw).toBe(249_000);
    expect(priced.priceCheckedAt).toBe("2026-08-01T03:00:00.000Z");

    // 가격만 / 시각만은 계약 위반이다.
    expect(() => productLinkSchema.parse({ ...base, priceSnapshotKrw: 249_000 })).toThrow();
    expect(() => productLinkSchema.parse({ ...base, priceCheckedAt: "2026-08-01T03:00:00.000Z" })).toThrow();
    // 시각은 ISO 8601이어야 한다(날짜만 있는 문자열은 시점을 말하지 못한다).
    expect(() =>
      productLinkSchema.parse({ ...base, priceSnapshotKrw: 249_000, priceCheckedAt: "2026-08-01" })
    ).toThrow();
  });

  // CAT-101: GET /categories 응답 계약.
  it("validates the categories list contract including nullable iconName and display order", () => {
    const parsed = listCategoriesResponseSchema.parse({
      categories: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          code: "diaper_hygiene",
          name: "기저귀/위생",
          iconName: "diaper",
          displayOrder: 40,
          isSystem: true,
          active: true
        },
        {
          id: "88888888-8888-4888-8888-888888888888",
          code: "etc",
          name: "기타",
          iconName: null,
          displayOrder: 999,
          isSystem: false,
          active: true
        }
      ]
    });
    expect(parsed.categories).toHaveLength(2);
    expect(parsed.categories[1].iconName).toBeNull();

    expect(() =>
      listCategoriesResponseSchema.parse({
        categories: [
          {
            id: "not-a-uuid",
            code: "diaper_hygiene",
            name: "기저귀/위생",
            displayOrder: 40,
            isSystem: true,
            active: true
          }
        ]
      })
    ).toThrow();
  });

  // CAT-124: 노출 범위 플래그(selectable)의 계약.
  it("carries the CAT-124 selectable flag as an optional, backward-compatible field", () => {
    const parsed = listCategoriesResponseSchema.parse({
      categories: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          code: "diaper_hygiene",
          name: "기저귀/위생",
          iconName: "diaper",
          displayOrder: 40,
          isSystem: true,
          active: true,
          selectable: true
        },
        {
          // 노출 제외 행: 살아 있고(active) 시스템 시드지만 선택지로는 내밀지 않는다.
          id: "c0a7e901-0000-4c01-8c01-c47e900ec001",
          code: "mobile_diaper_hygiene",
          name: "기저귀",
          iconName: "diaper",
          displayOrder: 1001,
          isSystem: false,
          active: true,
          selectable: false
        },
        {
          // CAT-124 이전 응답/캐시: 필드가 없어도 계약을 통과해야 한다(하위 호환).
          id: "88888888-8888-4888-8888-888888888888",
          code: "etc",
          name: "기타",
          iconName: null,
          displayOrder: 999,
          isSystem: true,
          active: true
        }
      ]
    });

    expect(parsed.categories.map((category) => category.selectable)).toEqual([true, false, undefined]);
    // active와 다른 축이다 — 노출 제외 행도 active는 true다(행이 삭제되지 않는다, DNC-007).
    expect(parsed.categories.every((category) => category.active)).toBe(true);

    // 불리언이 아닌 값은 거부한다("1" 같은 쿼리 문자열이 응답에 새어 들어오지 않도록).
    expect(() =>
      listCategoriesResponseSchema.parse({
        categories: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            code: "diaper_hygiene",
            name: "기저귀/위생",
            displayOrder: 40,
            isSystem: true,
            active: true,
            selectable: "1"
          }
        ]
      })
    ).toThrow();
  });

  // CON-121(CON-115 권고 잔여분): categoryTop이 z.record(z.unknown())였을 때는
  // 아무 객체나 통과했다. 실응답 형태({categoryId, amountKrw, count})로 조인 뒤의 계약.
  it("pins the monthly report categoryTop rows to the real category breakdown shape", () => {
    const parsed = reportMonthlySchema.parse({
      childId: "66666666-6666-4666-8666-666666666666",
      yearMonth: "2026-07-01",
      totalExpenseKrw: 49800,
      budgetAmountKrw: 100000,
      categoryTop: [
        { categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", amountKrw: 49800, count: 1 }
      ]
    });
    expect(parsed.categoryTop[0].count).toBe(1);

    // 예산 미설정 월은 budgetAmountKrw가 null이다.
    expect(
      reportMonthlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        yearMonth: "2026-07-01",
        totalExpenseKrw: 0,
        budgetAmountKrw: null,
        categoryTop: []
      }).budgetAmountKrw
    ).toBeNull();

    // 임의의 객체는 더 이상 통과하지 않는다 (조이기 전 계약이 놓치던 것).
    expect(() =>
      reportMonthlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        yearMonth: "2026-07-01",
        totalExpenseKrw: 49800,
        categoryTop: [{ 아무거나: "값" }]
      })
    ).toThrow();

    // 카테고리 리포트는 같은 항목 계약을 공유한다.
    expect(
      reportCategorySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        categories: [
          { categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", amountKrw: 20000, count: 2 }
        ]
      }).categories
    ).toHaveLength(1);
    expect(() =>
      reportCategorySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        categories: [{ categoryId: "not-a-uuid", amountKrw: 20000, count: 2 }]
      })
    ).toThrow();
  });

  it("requires all 12 months in the yearly report contract", () => {
    const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({
      yearMonth: `2026-${String(index + 1).padStart(2, "0")}`,
      totalExpenseKrw: 0
    }));

    expect(
      reportYearlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        year: "2026",
        totalExpenseKrw: 0,
        monthlyTotals
      }).monthlyTotals
    ).toHaveLength(12);

    expect(() =>
      reportYearlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        year: "2026",
        totalExpenseKrw: 0,
        monthlyTotals: monthlyTotals.slice(0, 11)
      })
    ).toThrow();
  });

  /**
   * REP-128: 추이 리포트 응답 계약. 차트가 소비하는 값은 달마다 totalExpenseKrw 하나뿐이라
   * 예산·카테고리 분해는 담기지 않는다 — 그게 필요한 화면은 reportMonthlySchema 쪽이다.
   * 길이 상한(12)은 서버 DTO의 months 상한(TREND_REPORT_MAX_MONTHS)과 같은 값이어야 한다.
   */
  it("bounds the trend report to 1-12 months of yearMonth/total pairs (REP-128)", () => {
    const uuid = "66666666-6666-4666-8666-666666666666";
    const months = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        yearMonth: `2026-${String(index + 1).padStart(2, "0")}-01`,
        totalExpenseKrw: 0
      }));

    expect(
      reportTrendSchema.parse({ childId: uuid, months: months(TREND_REPORT_DEFAULT_MONTHS) }).months
    ).toHaveLength(6);
    expect(TREND_REPORT_DEFAULT_MONTHS).toBe(6);
    expect(TREND_REPORT_MAX_MONTHS).toBe(12);

    // 1개월(단일 막대)과 상한 12개월은 유효, 0개월과 13개월은 무효.
    expect(() => reportTrendSchema.parse({ childId: uuid, months: months(1) })).not.toThrow();
    expect(() => reportTrendSchema.parse({ childId: uuid, months: months(TREND_REPORT_MAX_MONTHS) })).not.toThrow();
    expect(() => reportTrendSchema.parse({ childId: uuid, months: [] })).toThrow();
    expect(() => reportTrendSchema.parse({ childId: uuid, months: months(13) })).toThrow();

    // 월간 리포트와 같은 내부 `YYYY-MM-01` 형태만 받는다(연간 리포트의 `YYYY-MM`이 아니다).
    expect(() =>
      reportTrendSchema.parse({ childId: uuid, months: [{ yearMonth: "2026-02", totalExpenseKrw: 0 }] })
    ).toThrow();
    // 기록 없는 달은 0으로 채워지므로 음수는 계약 위반이다.
    expect(() =>
      reportTrendSchema.parse({ childId: uuid, months: [{ yearMonth: "2026-02-01", totalExpenseKrw: -1 }] })
    ).toThrow();
  });

  /**
   * R24-L5: `listExpensesQuerySchema.yearMonth`의 월은 01~12로 묶여 있어야 한다.
   * 종전 `/^\d{4}-\d{2}(-01)?$/`은 서버보다 느슨해 `2026-13`/`2026-00`을 계약상
   * 유효로 판정했지만, 서버는 같은 값을 400 VALIDATION_ERROR로 거절한다
   * (`apps/api/src/common/validation/year-month.ts` YEAR_MONTH_INPUT_PATTERN).
   * 계약이 서버보다 넓으면 이 스키마를 믿는 클라이언트가 미리 잡을 수 있었던 오류를
   * 왕복 뒤에야 알게 된다 — 두 정규식은 문자 그대로 같아야 한다.
   */
  it("bounds the expense list yearMonth month to 01-12, exactly like the server (R24-L5)", () => {
    // REP-105 관용 포맷: `YYYY-MM`과 `YYYY-MM-01` 둘 다 받는다.
    for (const yearMonth of ["2026-01", "2026-07", "2026-12", "2026-07-01", "2026-01-01", "2026-12-01"]) {
      expect(listExpensesQuerySchema.parse({ yearMonth }).yearMonth).toBe(yearMonth);
    }

    // 존재하지 않는 달 — 종전 정규식이 통과시키던 값들.
    for (const yearMonth of ["2026-13", "2026-00", "2026-99", "2026-13-01", "2026-00-01"]) {
      expect(() => listExpensesQuerySchema.parse({ yearMonth }), yearMonth).toThrow();
    }

    // 월 이외의 날짜(REP-105가 의도적으로 거부하는 형태)와 잡값도 그대로 거부한다.
    for (const yearMonth of ["2026-07-15", "2026-7", "26-07", "2026/07", ""]) {
      expect(() => listExpensesQuerySchema.parse({ yearMonth }), yearMonth).toThrow();
    }

    // 셋 다 선택적이라는 하위호환 계약은 그대로다(limit/cursor를 모르는 기존 클라이언트).
    expect(listExpensesQuerySchema.parse({})).toEqual({});
  });
});
