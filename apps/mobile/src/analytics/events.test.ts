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
  buildItemDetailViewedPayload,
  buildItemStatusChangedPayload,
  buildPurchaseFollowupAnsweredPayload
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

  // ANA-127: 상세 열람.
  it("builds an item_detail_viewed v1 payload with exactly the registry's three fields", () => {
    const payload = buildItemDetailViewedPayload({ itemName: "네이처러브 기저귀 팬티형", productLinkCount: 3 });
    expect(Object.keys(payload).sort()).toEqual(["hasProductLink", "itemCategoryCode", "linkCount"]);
    expect(payload).toEqual({ itemCategoryCode: "diaper_hygiene", hasProductLink: true, linkCount: 3 });
  });

  it("reports hasProductLink=false for a detail with no purchase link (it can never convert)", () => {
    expect(buildItemDetailViewedPayload({ itemName: "정체불명의 무언가", productLinkCount: 0 })).toEqual({
      itemCategoryCode: "etc",
      hasProductLink: false,
      linkCount: 0
    });
  });

  it("normalizes a malformed link count to a non-negative integer instead of losing the view", () => {
    // 계약 스키마가 z.number().int().min(0)이라, 정규화하지 않으면 서버가 PAYLOAD_INVALID로
    // 되돌려 열람 자체가 사라진다.
    expect(buildItemDetailViewedPayload({ itemName: "x", productLinkCount: -2 }).linkCount).toBe(0);
    expect(buildItemDetailViewedPayload({ itemName: "x", productLinkCount: 2.7 }).linkCount).toBe(2);
    expect(buildItemDetailViewedPayload({ itemName: "x", productLinkCount: Number.NaN }).linkCount).toBe(0);
  });

  // ANA-127: 구매 확인 응답.
  it("builds a purchase_followup_answered v1 payload for each of the prompt's three answers", () => {
    for (const answer of ["purchased", "not_purchased", "dismissed"] as const) {
      const payload = buildPurchaseFollowupAnsweredPayload({ answer, platform: "naver" });
      expect(Object.keys(payload).sort()).toEqual(["answer", "platform"]);
      expect(payload).toEqual({ answer, platform: "naver" });
    }
  });

  it("omits platform (never guesses one) when the persisted click predates ANA-127", () => {
    const payload = buildPurchaseFollowupAnsweredPayload({ answer: "purchased" });
    expect(Object.keys(payload)).toEqual(["answer"]);
    expect(payload).toEqual({ answer: "purchased" });
  });
});

/**
 * ANA-127: 새 이벤트 2종의 payload가 계약(packages/contracts/src/analytics.ts)의 strict 스키마와
 * 실제로 맞물리는지 -- 모바일은 contracts를 의존하지 않고 리터럴을 수기로 미러링하므로
 * (events.ts 헤더 주석) 드리프트는 소스 대조로만 잡힌다.
 */
describe("ANA-127 payload literals stay in lockstep with the contracts registry", () => {
  const contractsSource = readFileSync(join(mobileRoot, "../../packages/contracts/src/analytics.ts"), "utf8");

  function literals(exportName: string): string[] {
    const block = contractsSource.split(`export const ${exportName} = [`)[1]?.split("] as const;")[0] ?? "";
    return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
  }

  it("mirrors PURCHASE_FOLLOWUP_ANSWERS exactly", () => {
    expect(literals("PURCHASE_FOLLOWUP_ANSWERS")).toEqual(["purchased", "not_purchased", "dismissed"]);
  });

  it("mirrors the narrowed AFFILIATE_CLICK_SCREENS (item_detail only)", () => {
    expect(literals("AFFILIATE_CLICK_SCREENS")).toEqual(["item_detail"]);
  });

  it("registers both new events at version 1", () => {
    expect(contractsSource).toContain('eventName: "item_detail_viewed", eventVersion: 1');
    expect(contractsSource).toContain('eventName: "purchase_followup_answered", eventVersion: 1');
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

  // ANA-127: 새 이벤트도 같은 동의(ANA-102) 게이트 뒤에서만 발사된다.
  it("drops item_detail_viewed / purchase_followup_answered while consent is OFF", () => {
    trackAnalyticsEvent({
      eventName: "item_detail_viewed",
      payload: buildItemDetailViewedPayload({ itemName: "네이처러브 기저귀 팬티형", productLinkCount: 2 })
    });
    trackAnalyticsEvent({
      eventName: "purchase_followup_answered",
      payload: buildPurchaseFollowupAnsweredPayload({ answer: "purchased", platform: "coupang" })
    });

    expect(getQueuedAnalyticsEventCount()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queues item_detail_viewed / purchase_followup_answered once consent is ON", () => {
    useAnalyticsConsentStore.getState().setEnabled(true);

    trackAnalyticsEvent({
      eventName: "item_detail_viewed",
      payload: buildItemDetailViewedPayload({ itemName: "네이처러브 기저귀 팬티형", productLinkCount: 2 })
    });
    trackAnalyticsEvent({
      eventName: "purchase_followup_answered",
      payload: buildPurchaseFollowupAnsweredPayload({ answer: "not_purchased", platform: "coupang" })
    });

    expect(getQueuedAnalyticsEventCount()).toBe(2);
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
