import { describe, expect, it } from "vitest";
import type { ChildStageCode, ItemStatus } from "@wooriai/domain";
import { computeEssentialPrepProgress, isResolvedItemStatus, type PrepProgressItem } from "./prep-progress";

function item(overrides: Partial<PrepProgressItem> & { id: string }): PrepProgressItem {
  return {
    necessityLevel: "essential",
    status: "not_prepared",
    stageCodes: ["toddler_1_3"] as ChildStageCode[],
    ...overrides
  };
}

describe("isResolvedItemStatus (ITEM-114)", () => {
  // 근거: packages/domain/src/recommendation.ts EXCLUDED_NOW_NEEDED_STATUSES --
  // prepared/gifted/not_needed는 "지금 필요" 추천에서 제외되는, 행동이 끝난 상태다.
  const expectations: Record<ItemStatus, boolean> = {
    prepared: true,
    gifted: true,
    not_needed: true,
    not_prepared: false,
    interested: false
  };

  for (const [status, resolved] of Object.entries(expectations) as [ItemStatus, boolean][]) {
    it(`treats ${status} as ${resolved ? "resolved" : "unresolved"}`, () => {
      expect(isResolvedItemStatus(status)).toBe(resolved);
    });
  }
});

describe("computeEssentialPrepProgress (ITEM-114)", () => {
  it("counts resolved essentials over all essentials in the selected band", () => {
    const progress = computeEssentialPrepProgress(
      [
        item({ id: "a", status: "prepared" }),
        item({ id: "b", status: "gifted" }),
        item({ id: "c", status: "not_needed" }),
        item({ id: "d", status: "not_prepared" }),
        item({ id: "e", status: "interested" })
      ],
      "12-24개월"
    );

    expect(progress).toEqual({
      totalCount: 5,
      resolvedCount: 3,
      percent: 60,
      summaryText: "이번 시기 필수 준비물 5개 중 3개 준비됨"
    });
  });

  it("returns null when the band has zero essential items, so the section is hidden", () => {
    expect(computeEssentialPrepProgress([], "12-24개월")).toBeNull();
    // Non-essential items alone must not create a section either.
    expect(
      computeEssentialPrepProgress(
        [item({ id: "a", necessityLevel: "convenience" }), item({ id: "b", necessityLevel: "optional" })],
        "12-24개월"
      )
    ).toBeNull();
    // Essentials that belong to a different band do not count for this band.
    expect(
      computeEssentialPrepProgress([item({ id: "a", stageCodes: ["infant_7_12"] as ChildStageCode[] })], "12-24개월")
    ).toBeNull();
  });

  it("reports 0 resolved (0%) when nothing is handled yet", () => {
    const progress = computeEssentialPrepProgress(
      [item({ id: "a" }), item({ id: "b", status: "interested" })],
      "12-24개월"
    );

    expect(progress).toEqual({
      totalCount: 2,
      resolvedCount: 0,
      percent: 0,
      summaryText: "이번 시기 필수 준비물 2개 중 0개 준비됨"
    });
  });

  it("reports 100% when every essential in the band is resolved", () => {
    const progress = computeEssentialPrepProgress(
      [item({ id: "a", status: "prepared" }), item({ id: "b", status: "not_needed" })],
      "12-24개월"
    );

    expect(progress).toEqual({
      totalCount: 2,
      resolvedCount: 2,
      percent: 100,
      summaryText: "이번 시기 필수 준비물 2개 중 2개 준비됨"
    });
  });

  it("ignores convenience/optional items when counting", () => {
    const progress = computeEssentialPrepProgress(
      [
        item({ id: "a", status: "not_prepared" }),
        item({ id: "b", necessityLevel: "convenience", status: "prepared" }),
        item({ id: "c", necessityLevel: "optional", status: "prepared" })
      ],
      "12-24개월"
    );

    expect(progress?.totalCount).toBe(1);
    expect(progress?.resolvedCount).toBe(0);
  });

  it("only counts essentials matching the selected band (stageCodes or timingLabel fallback)", () => {
    const progress = computeEssentialPrepProgress(
      [
        item({ id: "a", status: "prepared" }), // toddler_1_3 -> matches 12-24개월
        item({ id: "b", stageCodes: ["infant_7_12"] as ChildStageCode[] }), // other band
        item({ id: "c", stageCodes: undefined, timingLabel: "12-24개월" }), // label fallback
        item({ id: "d", stageCodes: undefined, timingLabel: "0-6개월" }) // other band via label
      ],
      "12-24개월"
    );

    expect(progress?.totalCount).toBe(2);
    expect(progress?.resolvedCount).toBe(1);
    expect(progress?.percent).toBe(50);
  });

  it("dedupes by id so overlapping tab slices cannot double-count (first occurrence wins)", () => {
    const progress = computeEssentialPrepProgress(
      [item({ id: "a", status: "prepared" }), item({ id: "a", status: "not_prepared" }), item({ id: "b" })],
      "12-24개월"
    );

    expect(progress?.totalCount).toBe(2);
    expect(progress?.resolvedCount).toBe(1);
  });

  it("rounds percent to an integer", () => {
    const progress = computeEssentialPrepProgress(
      [item({ id: "a", status: "prepared" }), item({ id: "b" }), item({ id: "c" })],
      "12-24개월"
    );

    expect(progress?.percent).toBe(33);
  });
});
