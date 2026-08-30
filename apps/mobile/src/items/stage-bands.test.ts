import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHILD_STAGE_CODES, calculateChildStage, getSeoulToday, type ChildStageCode } from "@wooriai/domain";
import { localItemTemplateFixtures } from "../api/local-fixtures";
import {
  bandDefinitions,
  bandForStage,
  bandsForStage,
  childAgeMonths,
  itemMatchesBand,
  resolveDefaultStageLabel,
  STAGE_BAND_UNRESOLVED_NOTICE
} from "./stage-bands";

/**
 * 오늘 기준으로 "생후 N개월"인 아이의 생년월일. 개월 수를 날짜로 바꾸는 규칙은 도메인
 * (`calculateChildStage`)이 갖고 있으므로, 테스트는 그 규칙이 정확히 N을 돌려주는 날짜만 만든다
 * (일자는 28로 눌러 둔다 -- 말일 차이로 한 달이 깎이지 않게).
 */
function birthDateAtAgeMonths(ageMonths: number): string {
  const [year, month, day] = getSeoulToday().split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) - ageMonths;
  return [
    String(Math.floor(totalMonths / 12)).padStart(4, "0"),
    String((totalMonths % 12) + 1).padStart(2, "0"),
    String(Math.min(day, 28)).padStart(2, "0")
  ].join("-");
}

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
    // 라운드 74 트랙 B: `toddler_1_3`은 밴드 둘이 나눠 갖는 스테이지라, "실제 시기에서 나왔다"고
    // 말하려면 **나이까지** 있어야 한다(없으면 아래 "겹치는 밴드" 절이 무는 resolved: false다).
    expect(
      resolveDefaultStageLabel({
        ...base,
        currentStage: "toddler_1_3" as ChildStageCode,
        birthDate: birthDateAtAgeMonths(18)
      })
    ).toEqual({
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
   * 라운드 69 트랙 C 회귀 좌표 **넷**: 시기 있음(임신·출생) × 시기 없음(미도착·비정상 값).
   *
   * `["children"]` 캐시가 살아 있으면 기본 칩이 아이의 실제 시기를 따르고(resolved), 캐시가
   * 없으면 폴백이되 그 사실이 `resolved: false`로 드러난다 — 종전에는 이 네 좌표 중 둘("캐시
   * 실패")이 나머지 둘과 **구분 불가능한 같은 값**이었다.
   *
   * 라운드 69 리뷰 S-4 — 네 좌표를 **실질화**한다. 종전 코드는 두 축이 모두 무너져 있었다:
   *  - 실패 쪽 두 좌표가 `currentStage: undefined`로 **글자 그대로 같은 입력**이었다(임신·출생을
   *    적어 놨을 뿐 두 번 같은 것을 물었다). 이제 실패의 두 갈래를 나눠 잡는다 — 캐시 **미도착**
   *    (`undefined`)과 캐시에 **비정상 값**이 들어온 경우(`isChildStageCode`를 통과 못 하는 문자열).
   *  - 성공 쪽 두 좌표가 `pregnancy_late`·`newborn_0_3`이라 **같은 밴드("0-6개월")**였다. 출생
   *    좌표를 `toddler_1_3`으로 잡아 라벨 축이 실제로 갈리게 한다. 그러면 "라벨이 폴백과 같아도
   *    resolved가 다르다"(bornWithCache ↔ 실패 둘)까지 이 한 테스트가 함께 못 박는다.
   */
  it("회귀 네 좌표 — 시기 있음(임신·출생) × 시기 없음(미도착·비정상 값)", () => {
    const pregnantWithCache = resolveDefaultStageLabel({ ...base, currentStage: "pregnancy_late" });
    // 라운드 74 트랙 B: 출생 좌표는 나이까지 있는 캐시다(생후 18개월) -- `toddler_1_3`은 밴드
    // 둘이 나눠 갖는 스테이지라, 나이가 없으면 "캐시가 있다"는 이 좌표의 뜻이 성립하지 않는다.
    const bornWithCache = resolveDefaultStageLabel({
      ...base,
      currentStage: "toddler_1_3",
      birthDate: birthDateAtAgeMonths(18)
    });
    const cacheNotArrived = resolveDefaultStageLabel({ ...base, currentStage: undefined });
    const cacheMalformed = resolveDefaultStageLabel({ ...base, currentStage: "not-a-real-stage" });

    // 시기를 알면 라벨이 실제로 갈린다(같은 밴드 두 개를 두 번 묻던 자리다).
    expect(pregnantWithCache).toEqual({ label: "0-6개월", resolved: true });
    expect(bornWithCache).toEqual({ label: "12-24개월", resolved: true });
    expect(pregnantWithCache.label).not.toBe(bornWithCache.label);

    // 시기를 모르는 두 갈래는 서로 다른 입력이고, 같은 폴백으로 수렴하되 resolved가 그 사실을 말한다.
    expect(cacheNotArrived).toEqual({ label: "12-24개월", resolved: false });
    expect(cacheMalformed).toEqual({ label: "12-24개월", resolved: false });

    // 출생 좌표의 라벨은 폴백과 같은 값이다 — 그래서 `resolved`가 유일한 구분점이 된다.
    // (라벨만 보는 소비자가 생기면 이 두 상태를 다시 뭉갠다는 뜻이고, 그 자리가 화면의 안내 한 줄이다.)
    expect(bornWithCache.label).toBe(cacheNotArrived.label);
    expect(bornWithCache.resolved).not.toBe(cacheNotArrived.resolved);
  });
});

/**
 * 라운드 74 트랙 B — **겹치는 밴드는 나이가 고른다.**
 *
 * 고치는 문제: `bandForStage`가 스테이지 코드 하나만 받았고, `toddler_1_3`(도메인상 13~47개월)은
 * 밴드 둘이 나눠 갖는데도 늘 "12-24개월"로 떨어졌다. 생후 30개월 아이의 부모가 받던 기본 칩이
 * 그 값이고, 라운드 69 C가 세운 정직성 장치는 거기에 `resolved: true`까지 붙이고 있었다.
 * 바뀌는 것은 **겹칠 때 무엇을 보고 고르는가**뿐이다 — 밴드 표(`bandDefinitions`)도, 네 칩
 * 라벨도, 픽셀락 게이트 순서도 그대로다.
 */
describe("라운드 74 B: 겹치는 밴드에서 기본 칩이 나이로 갈린다", () => {
  it("밴드 둘이 나눠 갖는 스테이지는 toddler_1_3 하나다 (의도된 중복 — 서버 표의 주석이 이유다)", () => {
    const sharedStages = CHILD_STAGE_CODES.filter((stage) => bandsForStage(stage).length > 1);

    expect(sharedStages).toEqual(["toddler_1_3"]);
    expect(bandsForStage("toddler_1_3")).toEqual(["12-24개월", "24개월+"]);
    // 나머지 아홉은 겹치지 않으므로 나이를 알든 모르든 판정이 한 글자도 바뀌지 않는다.
    for (const stage of CHILD_STAGE_CODES.filter((code) => !sharedStages.includes(code))) {
      expect(bandForStage(stage, 30), stage).toBe(bandForStage(stage));
      expect(bandsForStage(stage), stage).toEqual([bandForStage(stage)]);
    }
  });

  it("걸음마기 아이의 칩이 나이로 갈린다 (13개월 → 12-24개월 · 30개월 → 24개월+)", () => {
    expect(bandForStage("toddler_1_3", 13)).toBe("12-24개월");
    expect(bandForStage("toddler_1_3", 23)).toBe("12-24개월");
    // 밴드 라벨이 스스로 말하는 시작 개월(24)부터는 뒤 칩이다 -- 개월 수는 라벨에서 읽는다.
    expect(bandForStage("toddler_1_3", 24)).toBe("24개월+");
    expect(bandForStage("toddler_1_3", 30)).toBe("24개월+");
    expect(bandForStage("toddler_1_3", 47)).toBe("24개월+");
    // 나이를 모르면 종전 표 그대로다.
    expect(bandForStage("toddler_1_3")).toBe("12-24개월");
    expect(bandForStage("toddler_1_3", null)).toBe("12-24개월");
  });

  it("나이는 birthDate에서, 판정은 도메인 함수 한 벌이 한다 (모름을 지어내지 않는다)", () => {
    expect(childAgeMonths(birthDateAtAgeMonths(0))).toBe(0);
    expect(childAgeMonths(birthDateAtAgeMonths(8))).toBe(8);
    expect(childAgeMonths(birthDateAtAgeMonths(30))).toBe(30);
    // 임신 중·수동 단계·조회 실패·형식 오류는 전부 모름이다.
    for (const unknown of [null, undefined, "", "어제", "2026/01/01", 20260101, {}]) {
      expect(childAgeMonths(unknown), String(unknown)).toBeNull();
    }
  });

  it("생후 30개월 아이의 기본 칩이 24개월+이고, 그 값은 아이의 시기에서 나왔다", () => {
    const base = {
      currentStage: "toddler_1_3" as ChildStageCode,
      isPixelLockMode: false,
      hasManualSelection: false,
      fallback: "12-24개월" as const
    };

    expect(resolveDefaultStageLabel({ ...base, birthDate: birthDateAtAgeMonths(30) })).toEqual({
      label: "24개월+",
      resolved: true
    });
    expect(resolveDefaultStageLabel({ ...base, birthDate: birthDateAtAgeMonths(18) })).toEqual({
      label: "12-24개월",
      resolved: true
    });
  });

  it("나이를 모르면 종전 값 그대로 + resolved: false (라운드 69 C의 갈래를 넓힐 뿐이다)", () => {
    const base = {
      currentStage: "toddler_1_3" as ChildStageCode,
      isPixelLockMode: false,
      hasManualSelection: false,
      fallback: "12-24개월" as const
    };

    // 라벨은 종전 판정과 **바이트 단위로 같다** -- 바뀌는 것은 그 값이 사실인 척하지 않는다는 것뿐.
    for (const birthDate of [undefined, null, ""]) {
      expect(resolveDefaultStageLabel({ ...base, birthDate }), String(birthDate)).toEqual({
        label: "12-24개월",
        resolved: false
      });
    }
    // 겹치지 않는 스테이지는 나이가 없어도 종전처럼 resolved: true다(모름이 번지지 않는다).
    expect(resolveDefaultStageLabel({ ...base, currentStage: "infant_7_12" as ChildStageCode })).toEqual({
      label: "6-12개월",
      resolved: true
    });
  });

  it("픽셀락 최우선 게이트와 수동 선택이 나이보다 먼저다 (게이트 순서 불변)", () => {
    const born30Months = {
      currentStage: "toddler_1_3" as ChildStageCode,
      birthDate: birthDateAtAgeMonths(30),
      isPixelLockMode: false,
      hasManualSelection: false,
      fallback: "12-24개월" as const
    };

    // ITEM-001 캡처는 나이를 알아도 폴백이다 -- 한 픽셀도 흔들리지 않는다.
    expect(resolveDefaultStageLabel({ ...born30Months, isPixelLockMode: true })).toEqual({
      label: "12-24개월",
      resolved: false
    });
    // 사용자가 칩을 고른 뒤에도 그 선택이 이긴다.
    expect(resolveDefaultStageLabel({ ...born30Months, hasManualSelection: true })).toEqual({
      label: "12-24개월",
      resolved: false
    });
  });

  /**
   * 라운드 74 적대적 리뷰 B-1 — **수동으로 고른 시기는 "확인하지 못한 시기"가 아니다.**
   *
   * 위 절이 세운 "겹치는 밴드 + 나이 모름 → resolved: false"는 한 갈래에서 거짓이었다.
   * `stageMode: "manual"`인 아이에게는 **설계상 생년월일이 없다**
   * (src/children/child-form.ts의 `buildCreateChildBody` — `birthDate`는 `"born"`일 때만 실린다).
   * 그래서 수동으로 `toddler_1_3`을 고른 사용자는 화면에서 곧바로 "지금 시기를 확인하지
   * 못했어요. 시기를 직접 골라 주세요."를 받았다 — **방금 직접 고른 사람에게** 하는 말이다.
   *
   * 아래는 그 축을 전수로 판정한다: `stageMode`(manual/born/pregnant/모름) × `birthDate`(있음/없음).
   */
  describe("라운드 74 리뷰 B-1: stageMode 축 (수동 입력 아이의 정직성)", () => {
    const base = {
      currentStage: "toddler_1_3" as ChildStageCode,
      isPixelLockMode: false,
      hasManualSelection: false,
      fallback: "12-24개월" as const
    };

    it("수동 입력 아이는 나이가 없어도 resolved: true다 (그 갈래에 birthDate가 없는 것이 정상이다)", () => {
      for (const birthDate of [undefined, null, ""]) {
        expect(
          resolveDefaultStageLabel({ ...base, stageMode: "manual", birthDate }),
          String(birthDate)
        ).toEqual({ label: "12-24개월", resolved: true });
      }
    });

    it("자동 갈래(born·pregnant·모름)는 종전 판정 그대로다 (모름이 번지지 않는다)", () => {
      for (const stageMode of ["born", "pregnant", undefined, null, "manual_typo"]) {
        expect(resolveDefaultStageLabel({ ...base, stageMode }), String(stageMode)).toEqual({
          label: "12-24개월",
          resolved: false
        });
      }
    });

    it("나이를 알면 stageMode와 무관하게 나이가 칩을 고른다 (수동이 나이를 덮지 않는다)", () => {
      for (const stageMode of ["manual", "born", undefined]) {
        expect(
          resolveDefaultStageLabel({ ...base, stageMode, birthDate: birthDateAtAgeMonths(30) }),
          String(stageMode)
        ).toEqual({ label: "24개월+", resolved: true });
      }
    });

    it("겹치지 않는 스테이지는 stageMode가 한 글자도 바꾸지 않는다", () => {
      for (const stage of CHILD_STAGE_CODES.filter((code) => bandsForStage(code).length === 1)) {
        const auto = resolveDefaultStageLabel({ ...base, currentStage: stage });
        const manual = resolveDefaultStageLabel({ ...base, currentStage: stage, stageMode: "manual" });
        expect(manual, stage).toEqual(auto);
        expect(manual.resolved, stage).toBe(true);
      }
    });

    it("픽셀락·수동 칩 선택은 여전히 stageMode보다 앞선다 (게이트 순서 불변)", () => {
      expect(resolveDefaultStageLabel({ ...base, stageMode: "manual", isPixelLockMode: true })).toEqual({
        label: "12-24개월",
        resolved: false
      });
      expect(resolveDefaultStageLabel({ ...base, stageMode: "manual", hasManualSelection: true })).toEqual({
        label: "12-24개월",
        resolved: false
      });
      // 시기 자체를 모르면 stageMode가 있어도 폴백이다(수동이 없는 값을 만들어 내지 않는다).
      expect(resolveDefaultStageLabel({ ...base, stageMode: "manual", currentStage: undefined })).toEqual({
        label: "12-24개월",
        resolved: false
      });
    });

    it("화면이 그 값을 실제로 넘긴다 (배선 — items.tsx)", () => {
      const screen = readFileSync(join(process.cwd(), "app/(tabs)/items.tsx"), "utf8");
      expect(screen).toContain("stageMode: stageSourceChild?.stageMode");
    });
  });

  it("밴드 라벨 네 문자열은 이 트랙에 한 바이트도 끌려가지 않는다", () => {
    // ITEM-001 픽셀락 캡처의 칩 라벨 · packages/contracts의 STAGE_BAND_LABELS · 서버 쿼리
    // 파라미터가 같은 네 문자열이다(대조는 apps/api/test/mobile-stage-band-contract.test.ts).
    expect(bandDefinitions.map((band) => band.label)).toEqual(["0-6개월", "6-12개월", "12-24개월", "24개월+"]);
  });
});

/**
 * 라운드 74 적대적 리뷰 B-2(제안 채택) — **데모 카탈로그의 `timingLabel`도 같은 계약을 진다.**
 *
 * 시드 쪽에는 "라벨이 말하는 개월 구간과 `stageCodes`가 덮는 구간이 서로 겹친다"는 대칭 계약이
 * 섰는데(apps/api/test/seed-data.test.ts), 로그인 없이 앱을 여는 사람이 실제로 읽는 데모
 * 카탈로그(src/api/local-fixtures.ts)에는 그 단언이 하나도 없었다. 데모도 상세에서 같은
 * "준비 시기" 줄을 읽어 주므로, 같은 어긋남이 같은 방식으로 생길 수 있는 자리다.
 *
 * 개월 경계는 여기서도 손으로 적지 않는다 — `calculateChildStage`를 나이로 훑어 파생시킨다.
 */
describe("라운드 74 리뷰 B-2: 데모 카탈로그의 timingLabel ↔ stageCodes 대칭 겹침", () => {
  const PROBE_TODAY = "2100-01-15";
  const PROBE_MAX_AGE_MONTHS = 600;

  type MonthRange = { from: number; to: number };

  const probeBirthDate = (ageMonths: number): string => {
    const [year, month, day] = PROBE_TODAY.split("-").map(Number);
    const totalMonths = year * 12 + (month - 1) - ageMonths;
    return [
      String(Math.floor(totalMonths / 12)).padStart(4, "0"),
      String((totalMonths % 12) + 1).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  };

  /** 출생 이후 스테이지의 표기 구간(개월). 시드 계약과 같은 관례로 파생한다. */
  const stageNotationRanges = (): Map<ChildStageCode, MonthRange> => {
    const completed = new Map<ChildStageCode, MonthRange>();
    for (let ageMonths = 0; ageMonths <= PROBE_MAX_AGE_MONTHS; ageMonths += 1) {
      const stage = calculateChildStage({
        stageMode: "born",
        birthDate: probeBirthDate(ageMonths),
        today: PROBE_TODAY
      }).stageCode;
      const seen = completed.get(stage);
      completed.set(stage, { from: seen?.from ?? ageMonths, to: ageMonths });
    }
    const openEnded = [...completed.keys()].at(-1) as ChildStageCode;
    const notation = new Map<ChildStageCode, MonthRange>();
    for (const [stage, range] of completed) {
      notation.set(stage, {
        from: range.from === 0 ? 0 : range.from - 1,
        to: stage === openEnded ? Number.POSITIVE_INFINITY : range.to
      });
    }
    return notation;
  };

  /**
   * 데모 라벨은 시드와 표기가 조금 다르다(물결표 대신 하이픈을 쓰고, 칩 이름을 그대로 쓰기도
   * 한다 — `"12-24개월"` · `"24개월+"`). 세 표기를 같은 구간으로 읽는다. 임신·서술 표기는 null.
   */
  const parseLabelMonths = (label: string): MonthRange | null => {
    const span = /^(\d+)[~-](\d+)개월(?: 전후)?$/.exec(label);
    if (span) return { from: Number(span[1]), to: Number(span[2]) };
    const openEnded = /^(\d+)개월(?: 이후|\+)$/.exec(label);
    if (openEnded) return { from: Number(openEnded[1]), to: Number.POSITIVE_INFINITY };
    return null;
  };

  const overlaps = (a: MonthRange, b: MonthRange) => a.from <= b.to && b.from <= a.to;

  it("개월을 말하는 데모 라벨은 자기 stageCodes의 스테이지 **전부**와 겹친다 (뒤 방향)", () => {
    const notation = stageNotationRanges();
    let judged = 0;

    for (const item of localItemTemplateFixtures) {
      const labelRange = parseLabelMonths(item.timingLabel);
      if (!labelRange) continue;
      const bornStages = item.stageCodes.filter((code): code is ChildStageCode =>
        notation.has(code as ChildStageCode)
      );
      expect(
        bornStages.length,
        `${item.name}: "${item.timingLabel}"이 개월을 말하는데 출생 이후 스테이지가 없다`
      ).toBeGreaterThan(0);

      for (const stage of bornStages) {
        const stageRange = notation.get(stage) as MonthRange;
        judged += 1;
        expect(
          overlaps(labelRange, stageRange),
          `${item.name}: "${item.timingLabel}" = [${labelRange.from}, ${labelRange.to}]이 ` +
            `${stage} = [${stageRange.from}, ${stageRange.to}]와 한 달도 겹치지 않는다`
        ).toBe(true);
      }
    }

    // 정규식이 조용히 아무것도 못 잡는 no-op이 되지 않게(오늘 실측 다섯 쌍).
    expect(judged).toBeGreaterThanOrEqual(5);
  });

  it("데모 라벨은 자기가 서는 칩 밴드와도 겹친다 (앞 방향 — 목록과 상세가 같은 나이를 말한다)", () => {
    let judged = 0;
    for (const item of localItemTemplateFixtures) {
      const labelRange = parseLabelMonths(item.timingLabel);
      if (!labelRange) continue;
      for (const stage of item.stageCodes as ChildStageCode[]) {
        for (const band of bandsForStage(stage)) {
          const bandRange = parseLabelMonths(band) as MonthRange;
          judged += 1;
          expect(
            overlaps(labelRange, bandRange),
            `${item.name}: "${item.timingLabel}"이 ${band} 칩에 서는데 그 칩의 개월과 겹치지 않는다`
          ).toBe(true);
        }
      }
    }
    expect(judged).toBeGreaterThanOrEqual(5);
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
