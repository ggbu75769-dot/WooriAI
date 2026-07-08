import { describe, expect, it } from "vitest";
import { calculateChildStage } from "./stage";

describe("calculateChildStage", () => {
  it("calculates pregnancy weeks from due date with 0-42 week clamp", () => {
    expect(
      calculateChildStage({
        stageMode: "pregnant",
        dueDate: "2026-08-31",
        today: "2026-07-06"
      })
    ).toEqual({
      stageCode: "pregnancy_late",
      stageLabel: "임신 32주차",
      pregnancyWeek: 32
    });

    expect(
      calculateChildStage({
        stageMode: "pregnant",
        dueDate: "2027-12-31",
        today: "2026-07-06"
      })
    ).toMatchObject({ pregnancyWeek: 0 });

    expect(
      calculateChildStage({
        stageMode: "pregnant",
        dueDate: "2026-01-01",
        today: "2026-07-06"
      })
    ).toMatchObject({ pregnancyWeek: 42 });
  });

  it("maps born children by completed months", () => {
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-04-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "newborn_0_3", stageLabel: "생후 3개월", ageMonths: 3 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-02-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "infant_4_6", ageMonths: 5 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2025-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "infant_7_12", ageMonths: 12 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2024-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "toddler_1_3", ageMonths: 24 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2020-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "kid_4_7", ageMonths: 72 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2018-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "elementary", ageMonths: 96 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2012-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "middle_school", ageMonths: 168 });
  });

  it("keeps manual stage with a recommendation accuracy notice", () => {
    expect(
      calculateChildStage({
        stageMode: "manual",
        manualStage: "infant_4_6",
        today: "2026-07-06"
      })
    ).toEqual({
      stageCode: "infant_4_6",
      stageLabel: "수동 선택: 4~6개월",
      manual: true,
      recommendationAccuracyNotice: "수동 단계라 추천 정확도가 조금 낮을 수 있어요."
    });
  });
});
