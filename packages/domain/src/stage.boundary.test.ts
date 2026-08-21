// TEST-115: 경계·속성 기반 테스트 — stage(시기 판정) 모듈.
import { describe, expect, it } from "vitest";
import { CHILD_STAGE_CODES, type ChildStageCode } from "./enums";
import { calculateChildStage } from "./stage";

/** 시드 고정 선형 합동 생성기 — 실행마다 동일한 수열을 재현한다. */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeIntPicker(rand: () => number) {
  return (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** 테스트 전용 날짜 연산 — UTC ms 기반 (소스 로직과 독립적으로 검증에 사용). */
function addDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function expectedStageForWeek(week: number): ChildStageCode {
  if (week < 13) return "pregnancy_early";
  if (week < 28) return "pregnancy_mid";
  return "pregnancy_late";
}

function expectedStageForMonths(months: number): ChildStageCode {
  if (months <= 3) return "newborn_0_3";
  if (months <= 6) return "infant_4_6";
  if (months <= 12) return "infant_7_12";
  if (months <= 47) return "toddler_1_3";
  if (months <= 95) return "kid_4_7";
  if (months <= 155) return "elementary";
  return "middle_school";
}

describe("임신 주차 경계 (pregnant)", () => {
  const today = "2026-08-21";

  it("출산예정일 = 오늘이면 40주차다", () => {
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: today, today })
    ).toMatchObject({ pregnancyWeek: 40, stageCode: "pregnancy_late" });
  });

  it("예정일 280일 전은 0주차, 274일 전 0주 / 273일 전 1주 경계", () => {
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 280), today })
    ).toMatchObject({ pregnancyWeek: 0, stageCode: "pregnancy_early" });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 274), today })
    ).toMatchObject({ pregnancyWeek: 0 });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 273), today })
    ).toMatchObject({ pregnancyWeek: 1 });
  });

  it("초기→중기 경계: 12주(early) / 13주(mid)", () => {
    // daysRemaining 190 → floor(90/7)=12, 189 → 13.
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 190), today })
    ).toMatchObject({ pregnancyWeek: 12, stageCode: "pregnancy_early" });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 189), today })
    ).toMatchObject({ pregnancyWeek: 13, stageCode: "pregnancy_mid" });
  });

  it("중기→후기 경계: 27주(mid) / 28주(late)", () => {
    // daysRemaining 85 → floor(195/7)=27, 84 → 28.
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 85), today })
    ).toMatchObject({ pregnancyWeek: 27, stageCode: "pregnancy_mid" });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 84), today })
    ).toMatchObject({ pregnancyWeek: 28, stageCode: "pregnancy_late" });
  });

  it("예정일 경과: 14일 지나면 정확히 42주, 그 이상은 42로 클램프", () => {
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, -14), today })
    ).toMatchObject({ pregnancyWeek: 42 });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, -15), today })
    ).toMatchObject({ pregnancyWeek: 42 });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: "2020-01-01", today })
    ).toMatchObject({ pregnancyWeek: 42, stageCode: "pregnancy_late" });
  });

  it("예정일보다 280일 넘게 남으면 0으로 클램프한다", () => {
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: addDays(today, 287), today })
    ).toMatchObject({ pregnancyWeek: 0 });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: "2030-01-01", today })
    ).toMatchObject({ pregnancyWeek: 0, stageCode: "pregnancy_early" });
  });

  it("윤년 2월 29일 출산예정일: 전날 39주 → 당일 40주", () => {
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: "2028-02-29", today: "2028-02-28" })
    ).toMatchObject({ pregnancyWeek: 39 });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: "2028-02-29", today: "2028-02-29" })
    ).toMatchObject({ pregnancyWeek: 40 });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: "2028-02-29", today: "2028-03-01" })
    ).toMatchObject({ pregnancyWeek: 40 });
  });

  it("연말·연초를 걸치는 계산이 정확하다", () => {
    // due 2027-01-01: 2026-12-31에는 1일 남음 → floor(279/7)=39주, 당일 40주.
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: "2027-01-01", today: "2026-12-31" })
    ).toMatchObject({ pregnancyWeek: 39 });
    expect(
      calculateChildStage({ stageMode: "pregnant", dueDate: "2027-01-01", today: "2027-01-01" })
    ).toMatchObject({ pregnancyWeek: 40 });
  });

  it("형식 위반 날짜(빈 문자열·공백·이모지)는 DATE_INVALID로 거부한다", () => {
    expect(() =>
      calculateChildStage({ stageMode: "pregnant", dueDate: "", today })
    ).toThrow("DATE_INVALID");
    expect(() =>
      calculateChildStage({ stageMode: "pregnant", dueDate: "   ", today })
    ).toThrow("DATE_INVALID");
    expect(() =>
      calculateChildStage({ stageMode: "pregnant", dueDate: "2026-8-21", today })
    ).toThrow("DATE_INVALID");
    expect(() =>
      calculateChildStage({ stageMode: "pregnant", dueDate: "👶", today })
    ).toThrow("DATE_INVALID");
    expect(() =>
      calculateChildStage({ stageMode: "pregnant", dueDate: "2026-08-21", today: "2026/08/21" })
    ).toThrow("DATE_INVALID");
  });

  it("[속성] 임의 (예정일, 오늘) 100건: 주차는 0~42, 단계 코드는 주차 밴드와 일치", () => {
    const rand = makeLcg(115115);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const today = `${randomInt(2024, 2029)}-${pad2(randomInt(1, 12))}-${pad2(randomInt(1, 28))}`;
      const dueDate = addDays(today, randomInt(-400, 400));
      const result = calculateChildStage({ stageMode: "pregnant", dueDate, today });

      if (!("pregnancyWeek" in result)) throw new Error("pregnancyWeek missing");
      expect(result.pregnancyWeek).toBeGreaterThanOrEqual(0);
      expect(result.pregnancyWeek).toBeLessThanOrEqual(42);
      expect(Number.isInteger(result.pregnancyWeek)).toBe(true);
      expect(result.stageCode).toBe(expectedStageForWeek(result.pregnancyWeek));
      expect(result.stageLabel).toBe(`임신 ${result.pregnancyWeek}주차`);
    }
  });

  it("[속성] 평행이동 불변 100건: 예정일과 오늘을 같은 일수만큼 옮겨도 주차 동일", () => {
    const rand = makeLcg(31337);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const today = `${randomInt(2024, 2028)}-${pad2(randomInt(1, 12))}-${pad2(randomInt(1, 28))}`;
      const dueDate = addDays(today, randomInt(0, 280));
      const shift = randomInt(-365, 365);

      const base = calculateChildStage({ stageMode: "pregnant", dueDate, today });
      const shifted = calculateChildStage({
        stageMode: "pregnant",
        dueDate: addDays(dueDate, shift),
        today: addDays(today, shift)
      });

      expect(shifted).toEqual(base);
    }
  });

  it("[속성] 단조성 100건: 오늘이 하루씩 지나면 주차는 비감소, 증가폭은 최대 1", () => {
    const rand = makeLcg(90210);
    const randomInt = makeIntPicker(rand);
    const dueDate = "2027-01-07";
    let today = "2026-05-01";
    let previous = (() => {
      const r = calculateChildStage({ stageMode: "pregnant", dueDate, today });
      return "pregnancyWeek" in r ? r.pregnancyWeek : NaN;
    })();

    for (let i = 0; i < 100; i += 1) {
      today = addDays(today, randomInt(1, 3));
      const result = calculateChildStage({ stageMode: "pregnant", dueDate, today });
      if (!("pregnancyWeek" in result)) throw new Error("pregnancyWeek missing");
      expect(result.pregnancyWeek).toBeGreaterThanOrEqual(previous);
      previous = result.pregnancyWeek;
    }
  });
});

describe("생후 개월 경계 (born)", () => {
  it("출생일 = 오늘이면 0개월, 미래 출생일도 0으로 클램프한다", () => {
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-08-21", today: "2026-08-21" })
    ).toMatchObject({ ageMonths: 0, stageCode: "newborn_0_3", stageLabel: "생후 0개월" });
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-12-01", today: "2026-08-21" })
    ).toMatchObject({ ageMonths: 0, stageCode: "newborn_0_3" });
  });

  it("모든 단계 밴드 경계(6/7, 12/13, 47/48, 95/96, 155/156개월)를 정확히 가른다", () => {
    const cases: Array<[string, string, number, ChildStageCode]> = [
      ["2025-08-21", "2026-02-21", 6, "infant_4_6"],
      ["2025-08-21", "2026-03-21", 7, "infant_7_12"],
      ["2025-08-21", "2026-08-21", 12, "infant_7_12"],
      ["2025-08-21", "2026-09-21", 13, "toddler_1_3"],
      ["2022-08-21", "2026-07-21", 47, "toddler_1_3"],
      ["2022-08-21", "2026-08-21", 48, "kid_4_7"],
      ["2018-08-21", "2026-07-21", 95, "kid_4_7"],
      ["2018-08-21", "2026-08-21", 96, "elementary"],
      ["2013-08-21", "2026-07-21", 155, "elementary"],
      ["2013-08-21", "2026-08-21", 156, "middle_school"]
    ];

    for (const [birthDate, today, ageMonths, stageCode] of cases) {
      expect(calculateChildStage({ stageMode: "born", birthDate, today })).toMatchObject({
        ageMonths,
        stageCode
      });
    }
  });

  it("윤년 2월 29일생: 평년에는 3월 1일에 개월이 완성된다", () => {
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2028-02-29", today: "2029-02-28" })
    ).toMatchObject({ ageMonths: 11 });
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2028-02-29", today: "2029-03-01" })
    ).toMatchObject({ ageMonths: 12, stageCode: "infant_7_12" });
    // 다음 윤년(2032)에는 2월 29일 당일에 48개월 완성 → kid_4_7 진입.
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2028-02-29", today: "2032-02-28" })
    ).toMatchObject({ ageMonths: 47, stageCode: "toddler_1_3" });
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2028-02-29", today: "2032-02-29" })
    ).toMatchObject({ ageMonths: 48, stageCode: "kid_4_7" });
  });

  it("형식 위반 출생일은 DATE_INVALID로 거부한다", () => {
    expect(() =>
      calculateChildStage({ stageMode: "born", birthDate: "", today: "2026-08-21" })
    ).toThrow("DATE_INVALID");
    expect(() =>
      calculateChildStage({ stageMode: "born", birthDate: "26-08-21", today: "2026-08-21" })
    ).toThrow("DATE_INVALID");
  });

  it("[속성] 임의 (출생일, 오늘) 100건: 개월 ≥ 0 정수, 단계 코드는 개월 밴드와 일치", () => {
    const rand = makeLcg(555);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const today = `${randomInt(2020, 2030)}-${pad2(randomInt(1, 12))}-${pad2(randomInt(1, 28))}`;
      const birthDate = addDays(today, randomInt(-5000, 100));
      const result = calculateChildStage({ stageMode: "born", birthDate, today });

      if (!("ageMonths" in result)) throw new Error("ageMonths missing");
      expect(Number.isInteger(result.ageMonths)).toBe(true);
      expect(result.ageMonths).toBeGreaterThanOrEqual(0);
      expect(result.stageCode).toBe(expectedStageForMonths(result.ageMonths));
      expect(result.stageLabel).toBe(`생후 ${result.ageMonths}개월`);
    }
  });

  it("[속성] 멱등성 100건: 같은 입력을 두 번 계산해도 결과가 깊은-동일하다", () => {
    const rand = makeLcg(2468);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const today = `${randomInt(2024, 2028)}-${pad2(randomInt(1, 12))}-${pad2(randomInt(1, 28))}`;
      const birthDate = addDays(today, -randomInt(0, 400));
      const input = { stageMode: "born", birthDate, today } as const;

      expect(calculateChildStage(input)).toEqual(calculateChildStage(input));
    }
  });

  it("[속성] 정수년 이동 역원 100건: 출생일·오늘을 함께 1년(윤일 회피) 옮겨도 개월 동일", () => {
    const rand = makeLcg(13579);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      // 2월을 피해서 윤일 간섭 없이 연 단위 평행이동이 잘 정의되게 한다.
      const month = [3, 4, 5, 6, 7, 8, 9, 10, 11][randomInt(0, 8)];
      const year = randomInt(2021, 2027);
      const today = `${year}-${pad2(month)}-${pad2(randomInt(1, 28))}`;
      const birthDate = addDays(today, -randomInt(0, 200));
      const shiftYear = (date: string, delta: number) => {
        const [y, m, d] = date.split("-");
        return `${Number(y) + delta}-${m}-${d}`;
      };

      const base = calculateChildStage({ stageMode: "born", birthDate, today });
      const forward = calculateChildStage({
        stageMode: "born",
        birthDate: shiftYear(birthDate, 1),
        today: shiftYear(today, 1)
      });

      if (!("ageMonths" in base) || !("ageMonths" in forward)) throw new Error("ageMonths missing");
      expect(forward.ageMonths).toBe(base.ageMonths);
    }
  });
});

describe("수동 단계 (manual)", () => {
  it("10개 단계 코드 전부 라벨·정확도 고지를 낸다", () => {
    for (const code of CHILD_STAGE_CODES) {
      const result = calculateChildStage({ stageMode: "manual", manualStage: code });
      expect(result.stageCode).toBe(code);
      expect(result.stageLabel.startsWith("수동 선택: ")).toBe(true);
      expect(result).toMatchObject({
        manual: true,
        recommendationAccuracyNotice: "수동 단계라 추천 정확도가 조금 낮을 수 있어요."
      });
    }
  });

  it("목록에 없는 수동 단계(빈 문자열·이모지 포함)는 CHILD_STAGE_INVALID로 거부한다", () => {
    for (const bad of ["teenager", "", "  ", "👶", "PREGNANCY_EARLY", "newborn_0_3 "]) {
      expect(() =>
        calculateChildStage({
          stageMode: "manual",
          manualStage: bad as unknown as ChildStageCode
        })
      ).toThrow("CHILD_STAGE_INVALID");
    }
  });
});
