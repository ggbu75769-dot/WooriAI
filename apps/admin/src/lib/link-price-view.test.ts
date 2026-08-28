import { describe, expect, it } from "vitest";
import type { ProductLink } from "./admin-api";
import {
  LINK_PRICE_EMPTY_TEXT,
  isLinkPriceVisibleInApp,
  linkPriceCaption,
  linkPriceCoverageSummary,
  linkPriceState,
  linkPriceText
} from "./link-price-view";

/**
 * GAP-064 #4: 어드민이 CSV로 써 넣은 판매처 가격을 되읽는 열의 표시 계약.
 * 핵심은 "앱에서 보이지 않는 상태"(시각 없음 · 만료)를 어드민이 **이름으로** 본다는 것.
 */
type PriceFields = Pick<ProductLink, "priceSnapshotKrw" | "priceCheckedAt" | "priceExpired">;

const fresh: PriceFields = { priceSnapshotKrw: 159_000, priceCheckedAt: "2026-08-20T03:00:00.000Z", priceExpired: false };
const expired: PriceFields = { priceSnapshotKrw: 89_000, priceCheckedAt: "2025-01-02T03:00:00.000Z", priceExpired: true };
const undated: PriceFields = { priceSnapshotKrw: 42_000, priceCheckedAt: null, priceExpired: false };
const dateOnly: PriceFields = { priceSnapshotKrw: null, priceCheckedAt: "2026-08-20T03:00:00.000Z", priceExpired: false };
const empty: PriceFields = { priceSnapshotKrw: null, priceCheckedAt: null, priceExpired: false };

describe("linkPriceState", () => {
  it("가격 + 확인 시각이 있고 만료가 아니면 앱에 보이는 상태다", () => {
    expect(linkPriceState(fresh)).toBe("fresh");
    expect(isLinkPriceVisibleInApp(fresh)).toBe(true);
  });

  it("확인 시각이 없는 가격은 앱이 아예 내려받지 못한다 — 어드민에는 그 상태가 이름으로 보인다", () => {
    expect(linkPriceState(undated)).toBe("undated");
    expect(isLinkPriceVisibleInApp(undated)).toBe(false);
    expect(linkPriceCaption(undated)).toBe("시각 없음");
    // 값 자체는 감추지 않는다 — 운영은 자기가 쓴 값을 되읽어야 한다.
    expect(linkPriceText(undated)).toBe("42,000원");
  });

  it("만료된 스냅샷은 확인 날짜와 함께 만료를 말한다 (조용한 만료를 보고한다)", () => {
    expect(linkPriceState(expired)).toBe("expired");
    expect(isLinkPriceVisibleInApp(expired)).toBe(false);
    expect(linkPriceCaption(expired)).toBe("2025-01-02 확인 · 만료");
  });

  it("가격이 없으면 확인 시각만 있어도 '없음'이다 (가리킬 값이 없는 시각)", () => {
    expect(linkPriceState(dateOnly)).toBe("none");
    expect(linkPriceState(empty)).toBe("none");
    expect(linkPriceText(empty)).toBe(LINK_PRICE_EMPTY_TEXT);
    expect(linkPriceCaption(empty)).toBe("");
  });

  it("정상 가격의 캡션에는 상태 이름을 붙이지 않는다", () => {
    expect(linkPriceCaption(fresh)).toBe("2026-08-20 확인");
  });

  /**
   * 라운드 63 #9의 교훈: 만료 문턱(180일)은 계약의 LINK_PRICE_MAX_AGE_DAYS 하나이고,
   * 어드민은 서버가 계산한 `priceExpired`만 읽는다. 이 파일에 숫자가 되살아나면 실패한다.
   */
  it("어드민 소스에는 만료 문턱 숫자가 없다 — 서버 판정을 그대로 읽는다", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(new URL("./link-price-view.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/\b180\b/);
    expect(source).toContain("priceExpired");
  });
});

describe("linkPriceCoverageSummary", () => {
  it("가격이 있는 건수와 앱에 실제로 보이는 건수를 함께 말한다", () => {
    // 하나만 말하면 "넣었는데 앱에 안 보이는" 구간이 그대로 가려진다.
    expect(linkPriceCoverageSummary([fresh, expired, undated, dateOnly, empty])).toBe(
      "가격 있는 링크 3건 · 앱에 보이는 가격 1건"
    );
  });

  it("가격이 하나도 없으면 0건 두 개다", () => {
    expect(linkPriceCoverageSummary([empty, dateOnly])).toBe("가격 있는 링크 0건 · 앱에 보이는 가격 0건");
  });
});
