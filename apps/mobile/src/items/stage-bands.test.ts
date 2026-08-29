import { describe, expect, it } from "vitest";
import type { ChildStageCode } from "@wooriai/domain";
import {
  bandForStage,
  itemMatchesBand,
  resolveDefaultStageLabel,
  STAGE_BAND_UNRESOLVED_NOTICE
} from "./stage-bands";

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
    expect(resolveDefaultStageLabel(base)).toEqual({ label: "24개월+", resolved: true });
  });

  /**
   * 라운드 69 트랙 C — **값과 "폴백을 썼다"를 함께 돌려준다.**
   *
   * 종전 반환값은 라벨 하나뿐이라, 화면은 `"12-24개월"`이 아이의 실제 시기인지 아무것도 몰라서
   * 쓴 값인지 구조적으로 구분할 수 없었다. 폴백 값 자체는 한 글자도 바뀌지 않는다
   * (ITEM-001 캡처 판정이 그 값에 걸려 있다) — 바뀐 것은 그 값이 사실인 척하지 않는다는 것뿐이다.
   */
  it("폴백을 쓴 갈래는 전부 resolved: false로 표시된다 (라벨은 종전 그대로)", () => {
    for (const input of [
      { ...base, isPixelLockMode: true },
      { ...base, hasManualSelection: true },
      { ...base, currentStage: undefined },
      { ...base, currentStage: "not-a-real-stage" }
    ]) {
      const band = resolveDefaultStageLabel(input);
      expect(band.label).toBe("12-24개월");
      expect(band.resolved).toBe(false);
    }
    // 실제 시기에서 나온 라벨만 resolved: true다 -- 그 값이 마침 폴백과 같은 밴드여도 그렇다.
    expect(resolveDefaultStageLabel({ ...base, currentStage: "toddler_1_3" as ChildStageCode })).toEqual({
      label: "12-24개월",
      resolved: true
    });
  });

  it("falls back during pixel-lock capture regardless of the current stage", () => {
    expect(resolveDefaultStageLabel({ ...base, isPixelLockMode: true }).label).toBe("12-24개월");
  });

  /**
   * 라운드 51 #3: 데모(로그인 없는 테스트) 세션 폴백을 없앴다. 그 폴백의 근거였던 "데모 아이는
   * 생후 24개월 고정 픽스처"가 사라졌기 때문이다 — 데모도 온보딩에서 아이를 직접 입력하므로
   * 시기는 사용자가 넣은 값이 정한다. 폴백이 남아 있으면 임신 중인 데모 아이의 기본 칩이
   * "12-24개월"로 굳어 "출산 전" 칩이 구조적으로 도달 불가가 된다(pre-birth-filter.ts).
   */
  it("데모 세션에도 별도 폴백이 없다 -- 아이의 실제 시기를 그대로 따른다", () => {
    expect(resolveDefaultStageLabel({ ...base, currentStage: "pregnancy_mid" as ChildStageCode }).label).toBe("0-6개월");
    // 입력 타입에서 isTestSession 자체가 사라졌다(남은 게이트는 픽셀 락과 수동 선택 둘뿐).
    expect(Object.keys(base)).not.toContain("isTestSession");
  });

  it("falls back once the user has made a manual chip selection", () => {
    expect(resolveDefaultStageLabel({ ...base, hasManualSelection: true }).label).toBe("12-24개월");
  });

  it("falls back when the current stage is unknown, missing, or malformed", () => {
    expect(resolveDefaultStageLabel({ ...base, currentStage: undefined }).label).toBe("12-24개월");
    expect(resolveDefaultStageLabel({ ...base, currentStage: null }).label).toBe("12-24개월");
    expect(resolveDefaultStageLabel({ ...base, currentStage: "not-a-real-stage" }).label).toBe("12-24개월");
  });

  it("resolves a toddler's stage to the 12-24개월 band, matching the fallback used elsewhere", () => {
    expect(resolveDefaultStageLabel({ ...base, currentStage: "toddler_1_3" as ChildStageCode }).label).toBe("12-24개월");
  });

  /**
   * 라운드 69 트랙 C — **ITEM-001 캡처의 이중 게이트를 값으로 증명한다.**
   *
   * 원천이 `/home`에서 `["children"]`으로 옮겼으므로, "캡처가 어느 쪽으로도 흔들리지 않는다"를
   * 주장이 아니라 값으로 남긴다.
   *  1. `isPixelLockMode`가 **최우선**이다 — 아이의 시기를 알아도 폴백이다;
   *  2. 캡처는 비세션 렌더라 `["children"]` 쿼리 자체가 꺼져 있어 `currentStage`가 undefined다
   *     (items.tsx의 `enabled: Boolean(authToken)`).
   * 두 게이트는 **각자 혼자서도** 같은 라벨을 낸다.
   */
  it("픽셀 락 이중 게이트: 어느 한 겹만으로도 폴백이 나온다", () => {
    // 게이트 1만: 시기를 알아도 캡처면 폴백.
    expect(resolveDefaultStageLabel({ ...base, isPixelLockMode: true, currentStage: "pregnancy_early" }).label).toBe(
      "12-24개월"
    );
    // 게이트 2만: 캡처 플래그가 없어도 비세션이라 시기를 모르면 폴백.
    expect(resolveDefaultStageLabel({ ...base, isPixelLockMode: false, currentStage: undefined }).label).toBe(
      "12-24개월"
    );
    // 둘 다: 물론 폴백.
    expect(resolveDefaultStageLabel({ ...base, isPixelLockMode: true, currentStage: undefined }).label).toBe(
      "12-24개월"
    );
  });

  /**
   * 라운드 69 트랙 C 회귀 좌표 **넷**: 임신·출생 각각 × 아이 캐시 있음/실패.
   *
   * `["children"]` 캐시가 살아 있으면 기본 칩이 아이의 실제 시기를 따르고(resolved), 캐시가
   * 없으면(실패·미도착) 폴백이되 그 사실이 `resolved: false`로 드러난다 — 종전에는 이 네 좌표
   * 중 둘("캐시 실패")이 나머지 둘과 **구분 불가능한 같은 값**이었다.
   */
  it("회귀 네 좌표 — 임신·출생 × 캐시 있음/실패", () => {
    const pregnantWithCache = resolveDefaultStageLabel({ ...base, currentStage: "pregnancy_late" });
    const pregnantWithoutCache = resolveDefaultStageLabel({ ...base, currentStage: undefined });
    const bornWithCache = resolveDefaultStageLabel({ ...base, currentStage: "newborn_0_3" });
    const bornWithoutCache = resolveDefaultStageLabel({ ...base, currentStage: undefined });

    expect(pregnantWithCache).toEqual({ label: "0-6개월", resolved: true });
    expect(bornWithCache).toEqual({ label: "0-6개월", resolved: true });
    expect(pregnantWithoutCache).toEqual({ label: "12-24개월", resolved: false });
    expect(bornWithoutCache).toEqual({ label: "12-24개월", resolved: false });
  });
});

describe("STAGE_BAND_UNRESOLVED_NOTICE", () => {
  it("사실 하나와 지금 할 수 있는 일 하나까지다 (해요체 · 이유를 지어내지 않는다)", () => {
    expect(STAGE_BAND_UNRESOLVED_NOTICE).toBe("지금 시기를 확인하지 못했어요. 시기를 직접 골라 주세요.");
    expect(STAGE_BAND_UNRESOLVED_NOTICE.endsWith("요.")).toBe(true);
    // 원인을 모르면서 원인을 말하지 않는다(오프라인·서버·로그인 어느 것도 단정하지 않는다).
    for (const guess of ["오프라인", "인터넷", "서버", "로그인", "네트워크"]) {
      expect(STAGE_BAND_UNRESOLVED_NOTICE).not.toContain(guess);
    }
    // 폴백 밴드 값을 사실인 양 문장에 적지 않는다.
    expect(STAGE_BAND_UNRESOLVED_NOTICE).not.toContain("12-24개월");
  });
});
