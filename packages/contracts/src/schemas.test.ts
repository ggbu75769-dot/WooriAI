import { describe, expect, it } from "vitest";
import {
  budgetSchema,
  categoryBudgetEntrySchema,
  categoryListItemSchema,
  CATEGORY_BUDGET_MAX_PER_MONTH,
  childSchema,
  CHILD_NICKNAME_MAX_LENGTH,
  createCustomCategoryRequestSchema,
  createCustomItemRequestSchema,
  createExpenseRequestSchema,
  customItemSummarySchema,
  CUSTOM_ITEM_MAX_PER_CHILD,
  CUSTOM_ITEM_NAME_MAX_LENGTH,
  CUSTOM_ITEM_REASON_TEXT,
  CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD,
  CUSTOM_CATEGORY_NAME_MAX_LENGTH,
  deleteCustomItemResponseSchema,
  deleteExpenseRequestSchema,
  EXPENSE_ITEM_NAME_MAX_LENGTH,
  itemDetailSchema,
  updateChildRequestSchema,
  updateCustomCategoryRequestSchema,
  updateCustomItemRequestSchema,
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

  /**
   * 라운드 107 트랙 F — 태명 상한(60)의 경계. `moneyKrwSchema`(GAP-054 P2-8)·커스텀 분류 이름
   * (라운드 103)이 세운 그 형식: 상한 값 자체는 통과하고 한 칸 위는 거절돼야 한다.
   *
   * 이 상한이 없던 동안 61자는 계약도 DTO도 지나 **DB에서** 터졌다(varchar(60) → Prisma P2000 →
   * 500). 여기서 무는 것은 그 경계가 응답·요청 **양쪽 계약에** 실제로 서 있다는 사실이다.
   */
  it("caps a child nickname at the children.nickname column width (60)", () => {
    expect(CHILD_NICKNAME_MAX_LENGTH).toBe(60);

    const child = {
      id: "11111111-1111-4111-8111-111111111111",
      householdId: "22222222-2222-4222-8222-222222222222",
      nickname: "가".repeat(CHILD_NICKNAME_MAX_LENGTH),
      stageMode: "manual" as const,
      manualStage: "infant_4_6" as const,
      currentStage: "infant_4_6" as const,
      stageLabel: "수동 선택: 4~6개월"
    };
    // 응답 계약: 상한은 컬럼 폭 그 자체라 60자는 정상 데이터이고 61자는 애초에 저장될 수 없다.
    expect(childSchema.parse(child).nickname).toHaveLength(CHILD_NICKNAME_MAX_LENGTH);
    expect(() => childSchema.parse({ ...child, nickname: "가".repeat(CHILD_NICKNAME_MAX_LENGTH + 1) })).toThrow();
    expect(() => childSchema.parse({ ...child, nickname: "" })).toThrow();

    // 요청 계약(PATCH)도 **같은 한 벌**이다 — 한쪽만 고쳐서 갈라지지 않게 한자리에서 함께 문다.
    expect(updateChildRequestSchema.parse({ nickname: child.nickname }).nickname).toHaveLength(
      CHILD_NICKNAME_MAX_LENGTH
    );
    expect(() => updateChildRequestSchema.parse({ nickname: "가".repeat(CHILD_NICKNAME_MAX_LENGTH + 1) })).toThrow();
    expect(() => updateChildRequestSchema.parse({ nickname: "" })).toThrow();
    // 부분 업데이트라 필드 생략은 여전히 통과한다(상한이 생겨도 하위호환이 깨지지 않는다).
    expect(updateChildRequestSchema.parse({}).nickname).toBeUndefined();
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

  /**
   * COM-105 후속 — 링크 헬스는 **실패한 관찰 두 값만** 계약에 실린다.
   *
   * 이 절이 무는 것은 유니온의 **모양 자체**다: `"ok"`가 통과하는 순간 앱은 "확인됨" 배지를
   * 그릴 수 있게 되는데, 그 근거는 최대 24시간 묵은 데이터센터발 HEAD 응답 하나라 그 표시가
   * 곧 허위다. 그래서 거절이 이 계약의 기능이다(누락이 아니다).
   */
  it("링크 헬스는 broken·unstable만 싣고 ok·미확인은 계약이 거절한다 (COM-105 후속)", () => {
    const base = {
      id: "44444444-4444-4444-8444-444444444444",
      platform: "coupang" as const,
      title: "카시트 보기",
      isAffiliate: true,
      isSponsored: false
    };

    // 실패를 관찰한 두 값은 그대로 실린다.
    expect(productLinkSchema.parse({ ...base, healthStatus: "broken" }).healthStatus).toBe("broken");
    expect(productLinkSchema.parse({ ...base, healthStatus: "unstable" }).healthStatus).toBe("unstable");

    // 필드가 없는 응답(구버전 서버 · 미확인 링크 · ok 링크)은 그대로 통과하고, 그때 값은
    // undefined다 — **"확인됨"이 아니라 "아무 말도 하지 않는다"**가 이 계약의 부재값이다.
    expect(productLinkSchema.parse(base).healthStatus).toBeUndefined();

    // "ok"는 거절한다 — 유니온에 넣지 않는 것이 이 계약의 핵심이다.
    expect(() => productLinkSchema.parse({ ...base, healthStatus: "ok" })).toThrow();
    // null도 거절한다: 미확인은 **키를 빼서** 말하지, 값으로 실어 보내지 않는다.
    expect(() => productLinkSchema.parse({ ...base, healthStatus: null })).toThrow();
    // 워커가 쓰지 않는 문자열도 거절한다(오타·새 값이 조용히 흘러들지 않는다).
    expect(() => productLinkSchema.parse({ ...base, healthStatus: "미확인" })).toThrow();
    expect(() => productLinkSchema.parse({ ...base, healthStatus: "broken " })).toThrow();

    // 가격 짝 규칙(위 절)과 서로 **간섭하지 않는다**: 헬스만 있어도 통과한다.
    const both = productLinkSchema.parse({
      ...base,
      healthStatus: "unstable",
      priceSnapshotKrw: 249_000,
      priceCheckedAt: "2026-08-01T03:00:00.000Z"
    });
    expect(both.healthStatus).toBe("unstable");
    expect(both.priceSnapshotKrw).toBe(249_000);
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

/**
 * 라운드 100 T2 — 커스텀 품목 계약(docs/5차/round100-custom-items-design.md §9.1).
 *
 * 커스텀 품목에는 가격 필드가 없다(준비템 가격 표시 잠금 — priceBandText는 카탈로그만의
 * 사실이고 없는 사실을 지어내지 않는다, §5). 수수료·링크 축도 없다(DNC-009 무접촉).
 */
describe("custom item contracts (round 100)", () => {
  const validCreate = {
    name: "아기 욕조",
    stageBand: "0-6개월" as const,
    necessityLevel: "essential" as const
  };

  it("pins the three custom-item constants (name 80 · per-child 200 · reason text)", () => {
    expect(CUSTOM_ITEM_NAME_MAX_LENGTH).toBe(80);
    expect(CUSTOM_ITEM_MAX_PER_CHILD).toBe(200);
    expect(CUSTOM_ITEM_REASON_TEXT).toBe("직접 추가한 준비물이에요.");
  });

  it("validates the create request: name 1..80, stageBand 4-label enum, necessityLevel 3-value enum", () => {
    expect(createCustomItemRequestSchema.parse(validCreate)).toEqual(validCreate);

    // 이름 경계: 정확히 80자는 통과, 81자는 거절(한 칸 위 경계 — moneyKrwSchema 테스트 관례).
    expect(
      createCustomItemRequestSchema.parse({ ...validCreate, name: "가".repeat(CUSTOM_ITEM_NAME_MAX_LENGTH) }).name
    ).toHaveLength(CUSTOM_ITEM_NAME_MAX_LENGTH);
    expect(() =>
      createCustomItemRequestSchema.parse({ ...validCreate, name: "가".repeat(CUSTOM_ITEM_NAME_MAX_LENGTH + 1) })
    ).toThrow();
    expect(() => createCustomItemRequestSchema.parse({ ...validCreate, name: "" })).toThrow();

    // 밴드는 stageBandLabelSchema의 4값 원문만(임의 문자열 금지 — 서버 stagesForBand 전개의 입력).
    for (const stageBand of ["0-6개월", "6-12개월", "12-24개월", "24개월+"]) {
      expect(createCustomItemRequestSchema.parse({ ...validCreate, stageBand }).stageBand).toBe(stageBand);
    }
    expect(() => createCustomItemRequestSchema.parse({ ...validCreate, stageBand: "0~6개월" })).toThrow();
    expect(() => createCustomItemRequestSchema.parse({ ...validCreate, necessityLevel: "must-have" })).toThrow();

    // 세 필드 전부 필수(기본 essential은 UI 몫 — 계약은 지어내지 않는다).
    const { necessityLevel: _level, ...withoutLevel } = validCreate;
    expect(() => createCustomItemRequestSchema.parse(withoutLevel)).toThrow();
  });

  /**
   * 설계 문서 §9.1의 원문은 `createCustomItemRequestSchema.partial()`이다 — 선언 형태는
   * z.object로 폈지만(스키마 파일 주석 참고) **동작은 partial()과 같아야 한다**. 여기서 실제
   * partial() 산출과 맞대 동치를 값으로 못 박는다(선언 형태가 의미를 바꾸는 순간 빨개진다).
   */
  it("keeps the update request semantically identical to createCustomItemRequestSchema.partial()", () => {
    const derivedPartial = createCustomItemRequestSchema.partial();
    const cases: unknown[] = [
      {},
      { name: "물려받은 카시트" },
      { stageBand: "12-24개월" },
      { necessityLevel: "convenience" },
      { name: "가".repeat(80), stageBand: "24개월+", necessityLevel: "optional" },
      { name: "" }, // 무효 — 둘 다 거절해야 한다
      { name: "가".repeat(81) },
      { stageBand: "임신 중" },
      { necessityLevel: "refund" }
    ];
    for (const candidate of cases) {
      const expected = derivedPartial.safeParse(candidate);
      const actual = updateCustomItemRequestSchema.safeParse(candidate);
      expect(actual.success, JSON.stringify(candidate)).toBe(expected.success);
      if (expected.success && actual.success) expect(actual.data).toEqual(expected.data);
    }
    // status는 이 계약에 없다 — 상태는 기존 status 엔드포인트 하나가 쓴다(§2.4).
    expect("status" in updateCustomItemRequestSchema.shape).toBe(false);
  });

  it("keeps isCustom additive-optional on ItemSummary and literal-true on the custom summary", () => {
    const baseSummary = {
      id: "77777777-7777-4777-8777-777777777777",
      name: "아기 욕조",
      necessityLevel: "essential" as const,
      status: "not_prepared" as const
    };

    // 구응답 호환: isCustom이 없던 시절의 페이로드도 그대로 통과한다.
    expect(itemSummarySchema.parse(baseSummary).isCustom).toBeUndefined();
    expect(itemSummarySchema.parse({ ...baseSummary, isCustom: true }).isCustom).toBe(true);
    // itemDetailSchema는 extend라 자동 승계된다.
    expect(
      itemDetailSchema.parse({
        ...baseSummary,
        reasonText: CUSTOM_ITEM_REASON_TEXT,
        usedSecondhandOk: false,
        productLinks: [],
        isCustom: true
      }).isCustom
    ).toBe(true);

    // 커스텀 요약은 isCustom이 리터럴 true다 — false/부재는 커스텀이 아니라는 뜻이라 거절.
    expect(customItemSummarySchema.parse({ ...baseSummary, isCustom: true }).isCustom).toBe(true);
    expect(() => customItemSummarySchema.parse({ ...baseSummary, isCustom: false })).toThrow();
    expect(() => customItemSummarySchema.parse(baseSummary)).toThrow();
  });

  it("requires deleted: true (literal) on the delete response", () => {
    const id = "77777777-7777-4777-8777-777777777777";
    expect(deleteCustomItemResponseSchema.parse({ id, deleted: true })).toEqual({ id, deleted: true });
    expect(() => deleteCustomItemResponseSchema.parse({ id, deleted: false })).toThrow();
    expect(() => deleteCustomItemResponseSchema.parse({ id })).toThrow();
    expect(() => deleteCustomItemResponseSchema.parse({ id: "not-a-uuid", deleted: true })).toThrow();
  });
});

/**
 * 라운드 102 T2 — 카테고리별 예산 계약(docs/5차/round102-category-budget-design.md §9.1).
 *
 * budgets(총액 한 칸, DNC-007)는 무접촉이고 categoryBudgets는 **additive optional** 두 자리
 * (budgetSchema · reportMonthlySchema)에만 실린다 — 이 필드가 없던 시절의 응답(구 서버·구
 * 캐시)이 계속 통과하는 것이 하위호환의 전부다. 홈(homeMonthlyBudgetSchema)은 extend라
 * 타입은 승계하되 서버가 싣지 않는다(§2.4).
 */
describe("category budget contracts (round 102)", () => {
  const entry = { categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", amountKrw: 100_000 };
  const baseBudget = {
    childId: "11111111-1111-4111-8111-111111111111",
    yearMonth: "2026-09-01",
    amountKrw: 300_000,
    usedAmountKrw: 120_000,
    remainingAmountKrw: 180_000
  };
  const baseMonthly = {
    childId: "11111111-1111-4111-8111-111111111111",
    yearMonth: "2026-09-01",
    totalExpenseKrw: 120_000,
    budgetAmountKrw: 300_000,
    categoryTop: []
  };

  it("pins the per-month row cap constant (§1.4)", () => {
    expect(CATEGORY_BUDGET_MAX_PER_MONTH).toBe(30);
  });

  it("validates one entry: uuid categoryId + strict moneyKrw amount (0원 예산 없음 — 부재가 곧 미설정)", () => {
    expect(categoryBudgetEntrySchema.parse(entry)).toEqual(entry);
    // 지출·총액 예산과 같은 단일 상한(MONEY_KRW_MAX)을 문다 — GAP-054 #2 관례.
    expect(categoryBudgetEntrySchema.parse({ ...entry, amountKrw: MONEY_KRW_MAX }).amountKrw).toBe(MONEY_KRW_MAX);
    expect(() => categoryBudgetEntrySchema.parse({ ...entry, amountKrw: MONEY_KRW_MAX + 1 })).toThrow();
    // 0원 예산은 존재하지 않는다(§1.2) — "없음"은 행의 부재이지 0이 아니다.
    expect(() => categoryBudgetEntrySchema.parse({ ...entry, amountKrw: 0 })).toThrow();
    expect(() => categoryBudgetEntrySchema.parse({ ...entry, amountKrw: 1.5 })).toThrow();
    expect(() => categoryBudgetEntrySchema.parse({ ...entry, categoryId: "not-a-uuid" })).toThrow();
  });

  it("keeps categoryBudgets additive-optional on budgetSchema (구 응답·구 캐시 하위호환)", () => {
    // 필드가 없던 시절의 응답 — 그대로 통과한다.
    expect(budgetSchema.parse(baseBudget).categoryBudgets).toBeUndefined();
    // 서버 200은 항상 배열을 싣는다 — 빈 배열(행 없음)과 채운 배열 둘 다 유효하다.
    expect(budgetSchema.parse({ ...baseBudget, categoryBudgets: [] }).categoryBudgets).toEqual([]);
    expect(budgetSchema.parse({ ...baseBudget, categoryBudgets: [entry] }).categoryBudgets).toEqual([entry]);
    // 행 하나라도 계약 위반이면 응답 전체가 계약 밖이다.
    expect(() => budgetSchema.parse({ ...baseBudget, categoryBudgets: [{ ...entry, amountKrw: 0 }] })).toThrow();
    expect(() => budgetSchema.parse({ ...baseBudget, categoryBudgets: "not-an-array" })).toThrow();
  });

  it("inherits the field on homeMonthlyBudgetSchema via extend, without requiring it (§2.4)", () => {
    const homeBudget = { ...baseBudget, amountKrw: 0, remainingAmountKrw: -120_000 };
    // 서버는 홈에 싣지 않는다 — 없는 응답이 정상이다.
    expect(homeMonthlyBudgetSchema.parse(homeBudget).categoryBudgets).toBeUndefined();
    // extend 승계라 실려 와도 계약 위반은 아니다(타입 축은 budgetSchema와 같다).
    expect(homeMonthlyBudgetSchema.parse({ ...homeBudget, categoryBudgets: [entry] }).categoryBudgets).toEqual([
      entry
    ]);
  });

  it("keeps categoryBudgets additive-optional on reportMonthlySchema (리포트 예산 대비 블록의 소스)", () => {
    expect(reportMonthlySchema.parse(baseMonthly).categoryBudgets).toBeUndefined();
    expect(reportMonthlySchema.parse({ ...baseMonthly, categoryBudgets: [] }).categoryBudgets).toEqual([]);
    expect(reportMonthlySchema.parse({ ...baseMonthly, categoryBudgets: [entry] }).categoryBudgets).toEqual([entry]);
    expect(() =>
      reportMonthlySchema.parse({ ...baseMonthly, categoryBudgets: [{ categoryId: "not-a-uuid", amountKrw: 1 }] })
    ).toThrow();
    // 예산 미설정 월(budgetAmountKrw null)에도 필드 모양은 같다 — §1.3(b)의 구조 종속은
    // 요청(PUT 본문) 축이지 응답 스키마가 교차 제약을 들지 않는다.
    expect(
      reportMonthlySchema.parse({ ...baseMonthly, budgetAmountKrw: null, categoryBudgets: [] }).categoryBudgets
    ).toEqual([]);
  });
});

/**
 * 라운드 103 T2 — 커스텀 지출 카테고리 계약(docs/5차/round103-custom-expense-category-design.md §9.1).
 *
 * 별도 표가 아니라 `categories`의 가구 소유 행이므로(설계 §1 — expenses.category_id가
 * NOT NULL FK다), 읽기 경로의 계약 추가는 `categoryListItemSchema.householdId` **하나뿐**이고
 * 커스텀 여부의 표식은 이미 required로 있던 `isSystem: false`다(§2.2 — 새 필드 0건).
 */
describe("custom expense category contracts (round 103)", () => {
  const seedRow = {
    id: "22222222-2222-4222-8222-222222222222",
    code: "diaper_hygiene",
    name: "기저귀/위생",
    iconName: null,
    displayOrder: 40,
    isSystem: true,
    active: true,
    selectable: true
  };

  it("pins the two custom-category constants (name 50 · per-household 15)", () => {
    expect(CUSTOM_CATEGORY_NAME_MAX_LENGTH).toBe(50);
    expect(CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD).toBe(15);
  });

  /**
   * R4 — **라운드 102 §1.4의 정당화 문장이 이 라운드 뒤에도 참인가**를 값으로 묻는다.
   * 그 문서는 상한 30을 *"정식 12종이고 … 커스텀 카테고리는 존재하지 않는 전제"* 로
   * 정당화했다. 이 라운드가 그 전제를 깨므로 12 + 15 = 27 <= 30이라야 그 문장이 계속 참이다.
   * 어느 한쪽 상수를 올리는 라운드는 여기서 먼저 빨개진다(설계 §1.7 · §9.1).
   */
  it("keeps 12(정식) + CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD <= CATEGORY_BUDGET_MAX_PER_MONTH (R4 산술)", () => {
    const SEEDED_CANONICAL_CATEGORY_COUNT = 12; // prisma/seed-data.ts categorySeeds
    expect(SEEDED_CANONICAL_CATEGORY_COUNT + CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD).toBe(27);
    expect(SEEDED_CANONICAL_CATEGORY_COUNT + CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD).toBeLessThanOrEqual(
      CATEGORY_BUDGET_MAX_PER_MONTH
    );
  });

  it("keeps householdId additive-optional on categoryListItemSchema (시드 행에는 키가 없다)", () => {
    // 이 필드가 없던 시절의 응답(구 서버·구 캐시) — 그대로 통과하고 값은 undefined다.
    expect(categoryListItemSchema.parse(seedRow).householdId).toBeUndefined();
    // 커스텀 행: isSystem:false가 표식이고, householdId가 함께 실린다(§2.2).
    const customRow = {
      ...seedRow,
      id: "33333333-3333-4333-8333-333333333333",
      code: "custom_0123456789abcdef0123456789abcdef",
      name: "산후도우미",
      isSystem: false,
      householdId: "44444444-4444-4444-8444-444444444444"
    };
    expect(categoryListItemSchema.parse(customRow)).toEqual(customRow);
    // 소유자 축은 uuid다 — 아무 문자열이나 들어오면 목록 전체가 계약 밖이다.
    expect(() => categoryListItemSchema.parse({ ...customRow, householdId: "local-household-daon" })).toThrow();
    // 목록 응답도 같은 항목 계약을 그대로 쓴다(합류이지 두 번째 목록이 아니다 — §2.1).
    expect(listCategoriesResponseSchema.parse({ categories: [seedRow, customRow] }).categories).toHaveLength(2);
  });

  it("validates the create request: name 1..50 (서버가 trim·공백접기 후 재검증)", () => {
    expect(createCustomCategoryRequestSchema.parse({ name: "산후도우미" })).toEqual({ name: "산후도우미" });
    // 경계 한 칸 위아래(moneyKrwSchema·커스텀 품목 테스트 관례).
    expect(
      createCustomCategoryRequestSchema.parse({ name: "가".repeat(CUSTOM_CATEGORY_NAME_MAX_LENGTH) }).name
    ).toHaveLength(CUSTOM_CATEGORY_NAME_MAX_LENGTH);
    expect(() =>
      createCustomCategoryRequestSchema.parse({ name: "가".repeat(CUSTOM_CATEGORY_NAME_MAX_LENGTH + 1) })
    ).toThrow();
    expect(() => createCustomCategoryRequestSchema.parse({ name: "" })).toThrow();
    expect(() => createCustomCategoryRequestSchema.parse({})).toThrow();
    // code·displayOrder·iconName·selectable·isSystem은 요청이 정할 수 없다(§2.3) — 계약에 자리가 없다.
    for (const forbidden of ["code", "displayOrder", "iconName", "selectable", "isSystem", "active"]) {
      expect(forbidden in createCustomCategoryRequestSchema.shape, forbidden).toBe(false);
    }
  });

  it("validates the update request: name?/active? — 보관은 active:false, 복원은 true (DELETE 없음 §1.6)", () => {
    expect(updateCustomCategoryRequestSchema.parse({ name: "산후도우미(2호)" })).toEqual({ name: "산후도우미(2호)" });
    expect(updateCustomCategoryRequestSchema.parse({ active: false })).toEqual({ active: false });
    expect(updateCustomCategoryRequestSchema.parse({ active: true })).toEqual({ active: true });
    // 이름 상한은 생성과 같은 한 벌이다.
    expect(() =>
      updateCustomCategoryRequestSchema.parse({ name: "가".repeat(CUSTOM_CATEGORY_NAME_MAX_LENGTH + 1) })
    ).toThrow();
    expect(() => updateCustomCategoryRequestSchema.parse({ name: "" })).toThrow();
    expect(() => updateCustomCategoryRequestSchema.parse({ active: "false" })).toThrow();
    /**
     * ⚠️ **빈 바디 `{}`는 이 스키마를 통과한다** — "최소 하나 필요"는 형식이 아니라 도메인
     * 규칙이라 서버 DTO가 지고(설계 §9.2: 둘 다 없으면 VALIDATION_ERROR), 계약은 필드 형식만
     * 고정한다. 그 사실을 값으로 적어 둔다(다음 사람이 여기서 막힌다고 읽지 않게).
     */
    expect(updateCustomCategoryRequestSchema.parse({})).toEqual({});
    // 축은 둘뿐이다 — code·displayOrder를 열면 전역 UNIQUE와 시드 대역 규칙이 곧바로 깨진다.
    expect(Object.keys(updateCustomCategoryRequestSchema.shape).sort()).toEqual(["active", "name"]);
  });
});

/**
 * 라운드 106 T10 — **미리보기 행 계약의 상한은 컬럼 폭(120)이다.**
 *
 * 종전 `importRowSchema.parsedItemName`은 `.max(100)`이었다. 그 숫자는 지출 계약의
 * `EXPENSE_ITEM_NAME_MAX_LENGTH`에서 온 것인데, 이 스키마가 말하는 것은 지출이 아니라
 * **검수 화면이 되읽는 미리보기 행**이고 서버는 101~120자 행을 값 그대로 실어 보낸다
 * (`import_rows.parsed_item_name`은 varchar(120)이고, GAP-058 #8이 "컬럼이 담을 수 있는 값을
 * 굳이 비우지 않는다"로 값 보존을 택했다 — apps/api/src/onboarding/import-pipeline.service.ts
 * `buildImportRowsFromParsed`). 즉 계약이 **서버의 정상 응답보다 좁아서**, 이 스키마를 믿는
 * 소비자(같은 파일을 파싱하는 apps/api/test/import-excel.e2e.test.ts 포함)가 그 구간의 행을
 * 만나는 순간 계약 위반으로 읽었을 것이다. 서버는 건드리지 않고 계약을 사실에 맞춘다.
 *
 * 이 블록이 잠그는 것은 **두 숫자가 다르다는 사실**이다: 되읽기 상한 120 vs 검수 PATCH 입력
 * 상한 100(서버 `UpdateImportRowDto`의 `@MaxLength(100)`).
 */
describe("import preview row length contract (round 106 T10)", () => {
  const baseRow = {
    id: "55555555-5555-4555-8555-555555555555",
    rowIndex: 0,
    parsedDate: "2026-07-05",
    parsedAmountKrw: 49_800,
    confidence: 0.9,
    selected: false,
    validationStatus: "item_name_too_long"
  };

  it("101~120자 품목명을 실은 행은 계약을 통과한다(서버가 실제로 내보내는 모양)", () => {
    // 지출 계약 상한(100) 바로 위 — 이 행은 `item_name_too_long`으로 떨어지되 값은 남는다.
    expect(importRowSchema.parse({ ...baseRow, parsedItemName: "가".repeat(101) }).parsedItemName).toHaveLength(101);
    // 컬럼 폭 그 자체(120)도 저장 가능하므로 응답에 그대로 실린다.
    expect(importRowSchema.parse({ ...baseRow, parsedItemName: "가".repeat(120) }).parsedItemName).toHaveLength(120);
  });

  it("121자 이상은 계약 밖이다 — 그 행은 서버가 값을 비워 보내기 때문이다(컬럼이 담지 못한다)", () => {
    expect(() => importRowSchema.parse({ ...baseRow, parsedItemName: "가".repeat(121) })).toThrow();
    // 값을 비운 행은 키 자체가 없다(toImportRowDto의 `?? undefined`) — optional이라 통과한다.
    expect(importRowSchema.parse(baseRow).parsedItemName).toBeUndefined();
  });

  it("되읽기 상한(120)은 지출 품목명 상한(100)과 다른 숫자다 — 겹쳐 읽지 않는다", () => {
    expect(EXPENSE_ITEM_NAME_MAX_LENGTH).toBe(100);
    // 지출 생성 계약은 종전 그대로 100에서 끊는다(이 라운드가 넓힌 것은 미리보기 되읽기뿐).
    expect(() =>
      createExpenseRequestSchema.parse({
        categoryId: "11111111-1111-4111-8111-111111111111",
        amountKrw: 1000,
        spentOn: "2026-07-05",
        itemName: "가".repeat(EXPENSE_ITEM_NAME_MAX_LENGTH + 1)
      })
    ).toThrow();
  });
});
