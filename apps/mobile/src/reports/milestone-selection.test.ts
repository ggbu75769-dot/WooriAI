import { describe, expect, it } from "vitest";
import { firstBirthdayOf, hasReachedFirstBirthday, selectMilestoneReportType } from "./milestone-selection";
import { milestoneReportTitle, milestoneWindowPhrase } from "./milestone-share";

describe("REP-127 첫돌 도달 판정 (milestone-selection)", () => {
  it("첫돌은 생일 + 1년이다", () => {
    expect(firstBirthdayOf("2025-03-01")).toBe("2026-03-01");
    expect(firstBirthdayOf("2025-12-31")).toBe("2026-12-31");
  });

  it("2월 29일생은 서버 addYears와 같이 3월 1일로 넘어간다", () => {
    // apps/api/src/finance/milestone-report.service.ts의 addYears(setUTCFullYear)와 동일.
    expect(firstBirthdayOf("2024-02-29")).toBe("2025-03-01");
  });

  it("생년월일이 없거나 형식이 아니면 판정 불가 -- 첫돌 도달로 보지 않는다", () => {
    for (const birthDate of [null, undefined, "", "2025-3-1", "어제"]) {
      expect(firstBirthdayOf(birthDate)).toBeNull();
      expect(hasReachedFirstBirthday({ birthDate, todayIso: "2030-01-01" })).toBe(false);
    }
  });

  it("첫돌 당일부터 도달로 본다 (서버 창 [birth, birth+1년)이 그날 다 지난다)", () => {
    const birthDate = "2025-03-01";
    expect(hasReachedFirstBirthday({ birthDate, todayIso: "2026-02-27" })).toBe(false);
    // 첫돌 전날 = 서버 창의 마지막 날(endDate). 아직 창 안이라 "만 1년 경과"는 아니다.
    expect(hasReachedFirstBirthday({ birthDate, todayIso: "2026-02-28" })).toBe(false);
    expect(hasReachedFirstBirthday({ birthDate, todayIso: "2026-03-01" })).toBe(true);
    expect(hasReachedFirstBirthday({ birthDate, todayIso: "2027-08-27" })).toBe(true);
  });

  it("첫돌 전에는 100일 리포트를, 첫돌 후에는 첫돌 리포트를 고른다", () => {
    expect(selectMilestoneReportType({ birthDate: "2026-06-01", todayIso: "2026-08-27" })).toBe("d100");
    expect(selectMilestoneReportType({ birthDate: "2025-06-01", todayIso: "2026-08-27" })).toBe("first-birthday");
  });

  it("생년월일 없는(임신 중) 아이는 종전대로 d100 -- 서버가 400으로 카드를 숨긴다", () => {
    expect(selectMilestoneReportType({ birthDate: null, todayIso: "2026-08-27" })).toBe("d100");
    expect(selectMilestoneReportType({ birthDate: undefined, todayIso: "2026-08-27" })).toBe("d100");
  });

  it("오늘 값이 이상하면 안전하게 d100으로 남는다", () => {
    expect(selectMilestoneReportType({ birthDate: "2020-01-01", todayIso: "" })).toBe("d100");
  });
});

describe("REP-127 마일스톤 라벨은 응답 type에서만 나온다", () => {
  it("카드 제목", () => {
    expect(milestoneReportTitle("d100")).toBe("100일 리포트");
    expect(milestoneReportTitle("first-birthday")).toBe("첫돌 리포트");
  });

  it("완결 리포트 본문의 창 문구", () => {
    expect(milestoneWindowPhrase("d100")).toBe("100일 동안");
    expect(milestoneWindowPhrase("first-birthday")).toBe("첫돌까지");
  });
});
