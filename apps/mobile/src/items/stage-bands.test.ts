import { describe, expect, it } from "vitest";
import type { ChildStageCode } from "@wooriai/domain";
import { bandForStage, itemMatchesBand, resolveDefaultStageLabel } from "./stage-bands";

describe("bandForStage", () => {
  const expected: Record<ChildStageCode, string> = {
    pregnancy_early: "0-6개월",
    pregnancy_mid: "0-6개월",
    pregnancy_late: "0-6개월",
    newborn_0_3: "0-6개월",
    infant_4_6: "0-6개월",
    infant_7_12: "6-12개월",
    toddler_1_3: "12-24개월",
    kid_4_7: "24개월+",
    elementary: "24개월+",
    middle_school: "24개월+"
  };

  for (const [stage, label] of Object.entries(expected) as [ChildStageCode, string][]) {
    it(`maps ${stage} to ${label}`, () => {
      expect(bandForStage(stage)).toBe(label);
    });
  }
});

describe("itemMatchesBand", () => {
  it("matches an item with stageCodes against every band whose stage set intersects", () => {
    const item = { stageCodes: ["toddler_1_3"] as ChildStageCode[] };

    expect(itemMatchesBand(item, "12-24개월")).toBe(true);
    expect(itemMatchesBand(item, "24개월+")).toBe(true);
    expect(itemMatchesBand(item, "0-6개월")).toBe(false);
    expect(itemMatchesBand(item, "6-12개월")).toBe(false);
  });

  it("falls back to exact timingLabel match when stageCodes is missing", () => {
    const item = { timingLabel: "6-12개월" };

    expect(itemMatchesBand(item, "6-12개월")).toBe(true);
    expect(itemMatchesBand(item, "12-24개월")).toBe(false);
    expect(itemMatchesBand(item, "0-6개월")).toBe(false);
    expect(itemMatchesBand(item, "24개월+")).toBe(false);
  });

  it("falls back to exact timingLabel match when stageCodes is an empty array", () => {
    const item = { stageCodes: [] as ChildStageCode[], timingLabel: "0-6개월" };

    expect(itemMatchesBand(item, "0-6개월")).toBe(true);
    expect(itemMatchesBand(item, "6-12개월")).toBe(false);
  });

  it("matches any band when neither stageCodes nor timingLabel is present", () => {
    expect(itemMatchesBand({}, "0-6개월")).toBe(true);
    expect(itemMatchesBand({}, "24개월+")).toBe(true);
  });
});

describe("resolveDefaultStageLabel", () => {
  const base = {
    currentStage: "kid_4_7" as ChildStageCode,
    isPixelLockMode: false,
    hasManualSelection: false,
    fallback: "12-24개월" as const
  };

  it("resolves the band matching the child's current stage when known", () => {
    expect(resolveDefaultStageLabel(base)).toBe("24개월+");
  });

  it("falls back during pixel-lock capture regardless of the current stage", () => {
    expect(resolveDefaultStageLabel({ ...base, isPixelLockMode: true })).toBe("12-24개월");
  });

  /**
   * 라운드 51 #3: 데모(로그인 없는 테스트) 세션 폴백을 없앴다. 그 폴백의 근거였던 "데모 아이는
   * 생후 24개월 고정 픽스처"가 사라졌기 때문이다 — 데모도 온보딩에서 아이를 직접 입력하므로
   * 시기는 사용자가 넣은 값이 정한다. 폴백이 남아 있으면 임신 중인 데모 아이의 기본 칩이
   * "12-24개월"로 굳어 "출산 전" 칩이 구조적으로 도달 불가가 된다(pre-birth-filter.ts).
   */
  it("데모 세션에도 별도 폴백이 없다 -- 아이의 실제 시기를 그대로 따른다", () => {
    expect(resolveDefaultStageLabel({ ...base, currentStage: "pregnancy_mid" as ChildStageCode })).toBe("0-6개월");
    // 입력 타입에서 isTestSession 자체가 사라졌다(남은 게이트는 픽셀 락과 수동 선택 둘뿐).
    expect(Object.keys(base)).not.toContain("isTestSession");
  });

  it("falls back once the user has made a manual chip selection", () => {
    expect(resolveDefaultStageLabel({ ...base, hasManualSelection: true })).toBe("12-24개월");
  });

  it("falls back when the current stage is unknown, missing, or malformed", () => {
    expect(resolveDefaultStageLabel({ ...base, currentStage: undefined })).toBe("12-24개월");
    expect(resolveDefaultStageLabel({ ...base, currentStage: null })).toBe("12-24개월");
    expect(resolveDefaultStageLabel({ ...base, currentStage: "not-a-real-stage" })).toBe("12-24개월");
  });

  it("resolves a toddler's stage to the 12-24개월 band, matching the fallback used elsewhere", () => {
    expect(resolveDefaultStageLabel({ ...base, currentStage: "toddler_1_3" as ChildStageCode })).toBe("12-24개월");
  });
});
