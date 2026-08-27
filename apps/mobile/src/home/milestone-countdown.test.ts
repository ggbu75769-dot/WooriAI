import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { firstBirthdayOf } from "../reports/milestone-selection";
import { evaluateMilestoneCountdown, hundredthDayOf } from "./milestone-countdown";

const BIRTH_DATE = "2026-06-02";
const base = { stageMode: "born", nickname: "다온이", birthDate: BIRTH_DATE, totalExpenseKrw: 1_245_700 } as const;

describe("UX-A 100일 카운트다운", () => {
  it("100일은 태어난 날을 1일로 센 100번째 날(생일 + 99일)이다", () => {
    // 서버의 100일 리포트 창 [birthDate, birthDate + 100일)의 마지막 날과 같아야 한다.
    expect(hundredthDayOf(BIRTH_DATE)).toBe("2026-09-09");
    expect(hundredthDayOf(null)).toBeNull();
  });

  it("남은 날과 누적 지출을 한 줄로 말한다", () => {
    const card = evaluateMilestoneCountdown({ ...base, todayIso: "2026-08-27" });

    expect(card).toMatchObject({ milestone: "d100", targetDateIso: "2026-09-09", daysRemaining: 13 });
    expect(card?.title).toBe("100일까지 D-13");
    expect(card?.subtitle).toBe("지금까지 함께한 지출 1,245,700원");
    expect(card?.accessibilityLabel).toBe("100일까지 13일 남았어요. 지금까지 함께한 지출 1,245,700원. 리포트 보기");
  });

  it("100일 당일은 D-0 대신 축하 한 줄로 바뀐다", () => {
    const card = evaluateMilestoneCountdown({ ...base, todayIso: "2026-09-09" });
    expect(card).toMatchObject({ milestone: "d100", daysRemaining: 0 });
    expect(card?.title).toBe("오늘은 다온이의 100일이에요");
  });

  it("기록된 지출이 없으면 0원을 앞세우지 않고 다음 한 걸음을 권한다", () => {
    const card = evaluateMilestoneCountdown({ ...base, totalExpenseKrw: 0, todayIso: "2026-08-27" });
    expect(card?.subtitle).toBe("기록을 남기면 그날까지의 지출을 함께 모아드릴게요.");
  });
});

describe("UX-A 첫돌 카운트다운 전환", () => {
  it("100일 다음 날부터 첫돌 카운트다운으로 자동 전환된다", () => {
    const card = evaluateMilestoneCountdown({ ...base, todayIso: "2026-09-10" });
    expect(card?.milestone).toBe("first-birthday");
    // 목표일은 리포트 탭이 쓰는 firstBirthdayOf와 **같은 값**이어야 한다(수정 없이 재사용).
    expect(card?.targetDateIso).toBe(firstBirthdayOf(BIRTH_DATE));
    expect(card?.title).toBe(`첫돌까지 D-${card?.daysRemaining}`);
  });

  it("첫돌 당일에는 축하 한 줄, 그 다음 날부터는 카드를 숨긴다", () => {
    const onTheDay = evaluateMilestoneCountdown({ ...base, todayIso: "2027-06-02" });
    expect(onTheDay).toMatchObject({ milestone: "first-birthday", daysRemaining: 0 });
    expect(onTheDay?.title).toBe("오늘은 다온이의 첫돌이에요");

    expect(evaluateMilestoneCountdown({ ...base, todayIso: "2027-06-03" })).toBeNull();
    expect(evaluateMilestoneCountdown({ ...base, todayIso: "2030-01-01" })).toBeNull();
  });

  it("2월 29일생의 첫돌도 리포트 선택과 같은 날짜를 쓴다(윤년 처리 일치)", () => {
    const leap = { ...base, birthDate: "2024-02-29" };
    const card = evaluateMilestoneCountdown({ ...leap, todayIso: "2025-02-27" });
    expect(card?.milestone).toBe("first-birthday");
    expect(card?.targetDateIso).toBe(firstBirthdayOf("2024-02-29"));
  });
});

describe("UX-A 마일스톤 카드를 만들지 않는 경우", () => {
  it("출생 전(임신 중·수동 단계)에는 없다", () => {
    expect(evaluateMilestoneCountdown({ ...base, stageMode: "pregnant", todayIso: "2026-08-27" })).toBeNull();
    expect(evaluateMilestoneCountdown({ ...base, stageMode: "manual", todayIso: "2026-08-27" })).toBeNull();
  });

  it("생년월일이 없거나 미래이거나 형식이 깨졌으면 없다", () => {
    expect(evaluateMilestoneCountdown({ ...base, birthDate: null, todayIso: "2026-08-27" })).toBeNull();
    expect(evaluateMilestoneCountdown({ ...base, birthDate: "2026-08-28", todayIso: "2026-08-27" })).toBeNull();
    expect(evaluateMilestoneCountdown({ ...base, birthDate: "2026-02-30", todayIso: "2026-08-27" })).toBeNull();
    expect(evaluateMilestoneCountdown({ ...base, todayIso: "오늘" })).toBeNull();
  });
});

describe("UX-A 마일스톤 카드 배선 계약", () => {
  const moduleSource = readFileSync(join(process.cwd(), "src/home/milestone-countdown.ts"), "utf8");
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("첫돌 계산은 기존 모듈을 import해서 쓴다 (규칙이 두 벌로 갈리지 않는다)", () => {
    expect(moduleSource).toContain('import { firstBirthdayOf } from "../reports/milestone-selection"');
  });

  it("총액은 홈 캐시의 totalExpenseKrw를 그대로 쓴다 (새 API·재집계 없음)", () => {
    expect(homeSource).toContain("totalExpenseKrw: home.data?.totalExpenseKrw ?? null");
    expect(moduleSource).not.toContain("amountKrw");
  });

  it("세션이 있을 때만 계산하고, 탭하면 리포트 탭으로 간다", () => {
    expect(homeSource).toContain("const milestoneCountdown = hasSession");
    expect(homeSource).toContain('testID="home-milestone-countdown"');
    expect(homeSource).toContain("accessibilityLabel={milestoneCountdown.accessibilityLabel}");
    const cardStart = homeSource.indexOf("{milestoneCountdown ? (");
    expect(cardStart).toBeGreaterThan(0);
    const cardBlock = homeSource.slice(cardStart, cardStart + 800);
    expect(cardBlock).toContain('router.push("/(tabs)/reports")');
    expect(cardBlock).toContain('accessibilityRole="button"');
  });
});
