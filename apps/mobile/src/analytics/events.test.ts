import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryCatalog } from "../categories";
import { __resetAnalyticsClientForTests, getQueuedAnalyticsEventCount, trackAnalyticsEvent } from "./client";
import {
  ANALYTICS_CATEGORY_CODES,
  analyticsCategoryCodeForCategoryId,
  analyticsCategoryCodeForItemName,
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

  // 리뷰 F6: expense_recorded는 8타일 화면에서만 발화하므로 8타일 밖의 id는 실제로 도달하지
  // 않지만, 오래된 초안 등 방어적으로 들어오더라도 원본 id를 흘리지 않고 "etc"가 된다.
  it("falls back to etc for unknown/legacy category ids instead of leaking the raw id", () => {
    expect(analyticsCategoryCodeForCategoryId("local-category-diaper")).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("")).toBe("etc");
    expect(analyticsCategoryCodeForCategoryId("not-a-real-id")).toBe("etc");
  });
});

describe("ANALYTICS_CATEGORY_CODES", () => {
  it("stays in lockstep with the contracts analytics registry enum", () => {
    // 계약(packages/contracts/src/analytics.ts ANALYTICS_CATEGORY_CODES)이 늘어나면 여기서 깨진다.
    const contractsSource = readFileSync(
      join(mobileRoot, "../../packages/contracts/src/analytics.ts"),
      "utf8"
    );
    const block = contractsSource.split("export const ANALYTICS_CATEGORY_CODES = [")[1]?.split("] as const;")[0] ?? "";
    const contractCodes = [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);

    expect(contractCodes).toEqual([...ANALYTICS_CATEGORY_CODES]);
  });

  it("covers every quick-expense catalog code (payload literals stay contract-valid)", () => {
    for (const entry of categoryCatalog) {
      expect(ANALYTICS_CATEGORY_CODES, entry.id).toContain(entry.code);
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
