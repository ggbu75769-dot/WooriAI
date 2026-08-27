import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryCatalog } from "../categories";
import { __resetAnalyticsClientForTests, getQueuedAnalyticsEventCount, trackAnalyticsEvent } from "./client";
import {
  ANALYTICS_CATEGORY_CODES,
  analyticsCategoryCodeForCategoryId,
  analyticsCategoryCodeForItemName,
  analyticsCategoryCodeForServerCode,
  bucketExpenseAmountKrw,
  buildAffiliateLinkClickedPayload,
  buildExpenseRecordedPayload,
  buildItemStatusChangedPayload
} from "./events";
import { useAnalyticsConsentStore } from "./flag";

const mobileRoot = process.cwd();

describe("bucketExpenseAmountKrw", () => {
  it("buckets amounts into the same enum literals as the expense_recorded contract", () => {
    expect(bucketExpenseAmountKrw(0)).toBe("lt10k");
    expect(bucketExpenseAmountKrw(9_999)).toBe("lt10k");
    expect(bucketExpenseAmountKrw(10_000)).toBe("10k_50k");
    expect(bucketExpenseAmountKrw(49_999)).toBe("10k_50k");
    expect(bucketExpenseAmountKrw(50_000)).toBe("50k_100k");
    expect(bucketExpenseAmountKrw(99_999)).toBe("50k_100k");
    expect(bucketExpenseAmountKrw(100_000)).toBe("100k_500k");
    expect(bucketExpenseAmountKrw(499_999)).toBe("100k_500k");
    expect(bucketExpenseAmountKrw(500_000)).toBe("gte500k");
    expect(bucketExpenseAmountKrw(9_999_999)).toBe("gte500k");
  });
});

describe("analyticsCategoryCodeForCategoryId", () => {
  it("maps every quick-expense catalog entry to its own coarse category code", () => {
    for (const entry of categoryCatalog) {
      expect(analyticsCategoryCodeForCategoryId(entry.id)).toBe(entry.code);
    }
  });

  it("falls back to etc for unknown/legacy category ids instead of leaking the raw id", () => {
    expect(analyticsCategoryCodeForCategoryId("local-category-diaper")).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("")).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("not-a-real-id")).toBe("etc");
  });

  // C2/REC-121: 정식 12개 시드 카테고리는 DB마다 랜덤 UUID라 정적 8타일 매핑으로는 전부 "etc"로
  // 뭉개졌다 -- 공용 ["categories"] 목록을 넘기면 서버 code로 해석한다.
  it("resolves ids outside the 8 tiles through the server category list's code", () => {
    const serverCategories = [
      { id: "srv-sleep", code: "sleep_furniture" },
      { id: "srv-care", code: "care_education" },
      { id: "local-category-diaper", code: "diaper_hygiene" }
    ];

    expect(analyticsCategoryCodeForCategoryId("srv-sleep", serverCategories)).toBe("sleep_furniture");
    expect(analyticsCategoryCodeForCategoryId("srv-care", serverCategories)).toBe("care_education");
    expect(analyticsCategoryCodeForCategoryId("local-category-diaper", serverCategories)).toBe("diaper_hygiene");
  });

  it("keeps the static catalog authoritative and still falls back to etc for anything unresolvable", () => {
    const serverCategories = [
      // 별칭 행은 8타일과 같은 id를 쓰므로 카탈로그가 먼저 답한다.
      { id: categoryCatalog[0].id, code: "mobile_diaper_hygiene" },
      { id: "srv-stub", code: "import_stub_default" },
      { id: "srv-future", code: "brand_new_code" },
      { id: "srv-empty", code: "" }
    ];

    expect(analyticsCategoryCodeForCategoryId(categoryCatalog[0].id, serverCategories)).toBe(categoryCatalog[0].code);
    expect(analyticsCategoryCodeForCategoryId("srv-stub", serverCategories)).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("srv-future", serverCategories)).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("srv-empty", serverCategories)).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("srv-missing", serverCategories)).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("", serverCategories)).toBe("etc");
  });
});

describe("analyticsCategoryCodeForServerCode", () => {
  it("passes the registry's 12 codes through unchanged", () => {
    for (const code of ANALYTICS_CATEGORY_CODES) {
      expect(analyticsCategoryCodeForServerCode(code)).toBe(code);
    }
  });

  it("maps every mobile_ alias seed onto a registry code", () => {
    // apps/api/prisma/seed-data.ts mobileCategoryAliasSeeds -- 접미사가 정식 코드가 아닌 둘
    // (mobile_feeding_dairy / mobile_feeding_meal)은 categoryCatalog와 같은 판단으로 묶는다.
    const aliasCodes = [
      "mobile_diaper_hygiene",
      "mobile_feeding_dairy",
      "mobile_feeding_meal",
      "mobile_clothes_laundry",
      "mobile_outing_mobility",
      "mobile_hospital_checkup",
      "mobile_toys_books",
      "mobile_etc"
    ];
    for (const code of aliasCodes) {
      const resolved = analyticsCategoryCodeForServerCode(code);
      expect(resolved, code).not.toBeNull();
      expect(ANALYTICS_CATEGORY_CODES).toContain(resolved!);
    }
    expect(analyticsCategoryCodeForServerCode("mobile_feeding_dairy")).toBe("feeding_babyfood");
    expect(analyticsCategoryCodeForServerCode("mobile_feeding_meal")).toBe("feeding_babyfood");
    expect(analyticsCategoryCodeForServerCode("mobile_etc")).toBe("etc");
  });

  it("returns null (never an off-contract literal) for codes the registry does not know", () => {
    expect(analyticsCategoryCodeForServerCode("import_stub_default")).toBeNull();
    expect(analyticsCategoryCodeForServerCode("mobile_unknown_family")).toBeNull();
    expect(analyticsCategoryCodeForServerCode("")).toBeNull();
    expect(analyticsCategoryCodeForServerCode(null)).toBeNull();
    expect(analyticsCategoryCodeForServerCode(undefined)).toBeNull();
  });

  it("stays in lockstep with the contracts analytics registry enum", () => {
    // 계약(packages/contracts/src/analytics.ts ANALYTICS_CATEGORY_CODES)이 늘어나면 여기서 깨진다.
    const contractsSource = readFileSync(
      join(mobileRoot, "../../packages/contracts/src/analytics.ts"),
      "utf8"
    );
    const block = contractsSource.split("export const ANALYTICS_CATEGORY_CODES = [")[1]?.split("] as const;")[0] ?? "";
    const contractCodes = [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);

    expect(contractCodes).toEqual([...ANALYTICS_CATEGORY_CODES]);
    for (const code of contractCodes) {
      expect(analyticsCategoryCodeForServerCode(code), code).toBe(code);
    }
  });
});

describe("analyticsCategoryCodeForItemName", () => {
  it("derives the coarse category for the known item-template fixture names", () => {
    expect(analyticsCategoryCodeForItemName("네이처러브 기저귀 팬티형")).toBe("diaper_hygiene");
    expect(analyticsCategoryCodeForItemName("베이비 아기띠 힙시트")).toBe("outing_mobility");
    expect(analyticsCategoryCodeForItemName("도담도담 원목 블록 세트")).toBe("toys_books");
  });

  it("falls back to etc for unrecognized names instead of leaking the name", () => {
    expect(analyticsCategoryCodeForItemName("정체불명의 무언가")).toBe("etc");
    expect(analyticsCategoryCodeForItemName("")).toBe("etc");
  });
});

describe("payload builders (registry-shaped, PII-safe by construction)", () => {
  it("builds an expense_recorded v1 payload with exactly the registry's four fields", () => {
    const diaperEntry = categoryCatalog.find((entry) => entry.code === "diaper_hygiene")!;
    const payload = buildExpenseRecordedPayload({
      categoryId: diaperEntry.id,
      amountKrw: 38_500,
      source: "manual",
      offline: false
    });

    // Exact key set: the contract schema is .strict(), so an extra key (or a raw amount /
    // free-form string sneaking in) must fail here before it ever reaches the server.
    expect(Object.keys(payload).sort()).toEqual(["amountBucket", "categoryCode", "offline", "source"]);
    expect(payload).toEqual({
      categoryCode: "diaper_hygiene",
      amountBucket: "10k_50k",
      source: "manual",
      offline: false
    });
  });

  it("marks the 준비템 follow-up flow as source=followup", () => {
    const payload = buildExpenseRecordedPayload({
      categoryId: categoryCatalog[0].id,
      amountKrw: 5_000,
      source: "followup",
      offline: true
    });
    expect(payload.source).toBe("followup");
    expect(payload.offline).toBe(true);
    expect(payload.amountBucket).toBe("lt10k");
  });

  it("resolves the categoryCode through the server list without widening the payload (C2)", () => {
    const payload = buildExpenseRecordedPayload({
      categoryId: "srv-sleep",
      amountKrw: 620_000,
      source: "manual",
      offline: false,
      serverCategories: [{ id: "srv-sleep", code: "sleep_furniture" }]
    });

    // 목록 자체는 절대 payload에 실리지 않는다 -- 코드 enum만 나간다(.strict() 계약).
    expect(Object.keys(payload).sort()).toEqual(["amountBucket", "categoryCode", "offline", "source"]);
    expect(payload.categoryCode).toBe("sleep_furniture");
    expect(payload.amountBucket).toBe("gte500k");
  });

  it("builds an item_status_changed v1 payload with exactly the registry's two fields", () => {
    const payload = buildItemStatusChangedPayload({ itemName: "네이처러브 기저귀 팬티형", status: "interested" });
    expect(Object.keys(payload).sort()).toEqual(["itemCategoryCode", "status"]);
    expect(payload).toEqual({ itemCategoryCode: "diaper_hygiene", status: "interested" });
  });

  it("builds an affiliate_link_clicked v1 payload with exactly the registry's two fields", () => {
    const payload = buildAffiliateLinkClickedPayload({ platform: "coupang", screenId: "item_detail" });
    expect(Object.keys(payload).sort()).toEqual(["platform", "screenId"]);
    expect(payload).toEqual({ platform: "coupang", screenId: "item_detail" });
  });
});

/**
 * ANA-102 consent gate for the newly wired events: same guarantee client.test.ts
 * pins for app_opened, re-asserted through the real payload builders so the
 * screen-level firing path (build payload -> trackAnalyticsEvent) provably
 * drops everything while the settings toggle is OFF.
 */
describe("newly wired events respect the consent gate", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAnalyticsConsentStore.setState({ enabled: false });
    __resetAnalyticsClientForTests();
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ accepted: 1, rejected: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops expense_recorded / item_status_changed / affiliate_link_clicked while consent is OFF", () => {
    trackAnalyticsEvent({
      eventName: "expense_recorded",
      payload: buildExpenseRecordedPayload({ categoryId: categoryCatalog[0].id, amountKrw: 12_000, source: "manual", offline: false })
    });
    trackAnalyticsEvent({
      eventName: "item_status_changed",
      payload: buildItemStatusChangedPayload({ itemName: "네이처러브 기저귀 팬티형", status: "prepared" })
    });
    trackAnalyticsEvent({
      eventName: "affiliate_link_clicked",
      payload: buildAffiliateLinkClickedPayload({ platform: "naver", screenId: "item_detail" })
    });

    expect(getQueuedAnalyticsEventCount()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queues the same events once the settings toggle turns consent ON", () => {
    useAnalyticsConsentStore.getState().setEnabled(true);

    trackAnalyticsEvent({
      eventName: "expense_recorded",
      payload: buildExpenseRecordedPayload({ categoryId: categoryCatalog[0].id, amountKrw: 12_000, source: "manual", offline: false })
    });
    trackAnalyticsEvent({
      eventName: "item_status_changed",
      payload: buildItemStatusChangedPayload({ itemName: "베이비 아기띠 힙시트", status: "not_needed" })
    });

    expect(getQueuedAnalyticsEventCount()).toBe(2);
  });
});
