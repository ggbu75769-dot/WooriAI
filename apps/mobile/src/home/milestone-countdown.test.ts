import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { firstBirthdayOf, selectMilestoneReportType } from "../reports/milestone-selection";
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
    // F5: "함께한 지출"은 어느 구간인지 말하지 않아 리포트 창 합계와 같아야 할 것처럼 읽혔다.
    expect(card?.subtitle).toBe("지금까지 총 지출 1,245,700원");
    expect(card?.ctaLabel).toBe("100일 리포트 보기");
    expect(card?.accessibilityLabel).toBe(
      "100일까지 13일 남았어요. 지금까지 총 지출 1,245,700원. 100일 리포트 보기"
    );
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

  it("F1: 카운트다운이 '첫돌까지'여도 첫돌 전이면 CTA는 열리는 리포트(100일)를 예고한다", () => {
    // 100일 다음 날 ~ 첫돌 전날의 약 9개월 -- 리포트 탭은 아직 100일 리포트를 연다.
    for (const todayIso of ["2026-09-10", "2027-01-15", "2027-06-01"]) {
      const card = evaluateMilestoneCountdown({ ...base, todayIso });
      expect(card?.milestone, todayIso).toBe("first-birthday");
      expect(card?.reportMilestone, todayIso).toBe("d100");
      expect(card?.ctaLabel, todayIso).toBe("100일 리포트 보기");
      expect(card?.accessibilityLabel.endsWith("100일 리포트 보기"), todayIso).toBe(true);
    }
  });

  it("F1: 첫돌 당일부터는 CTA가 '첫돌 리포트 보기'로 바뀐다", () => {
    const card = evaluateMilestoneCountdown({ ...base, todayIso: "2027-06-02" });
    expect(card?.reportMilestone).toBe("first-birthday");
    expect(card?.ctaLabel).toBe("첫돌 리포트 보기");
  });

  it("F1: CTA 판정은 리포트 탭의 selectMilestoneReportType과 언제나 같다 (임계값 드리프트 차단)", () => {
    // 100일 전후·첫돌 전후를 모두 지나는 날짜들을 훑어, 두 소스가 갈리는 날이 하루도 없어야 한다.
    for (let offset = 0; offset <= 366; offset += 1) {
      const today = new Date("2026-06-02T00:00:00.000Z");
      today.setUTCDate(today.getUTCDate() + offset);
      const todayIso = today.toISOString().slice(0, 10);
      const card = evaluateMilestoneCountdown({ ...base, todayIso });
      if (!card) continue;
      const expected = selectMilestoneReportType({ birthDate: BIRTH_DATE, todayIso });
      expect(card.reportMilestone, todayIso).toBe(expected);
      expect(card.ctaLabel, todayIso).toBe(expected === "d100" ? "100일 리포트 보기" : "첫돌 리포트 보기");
    }
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

  it("첫돌 계산과 CTA 판정은 기존 모듈을 import해서 쓴다 (규칙이 두 벌로 갈리지 않는다)", () => {
    expect(moduleSource).toContain(
      'import { firstBirthdayOf, selectMilestoneReportType } from "../reports/milestone-selection"'
    );
    // 홈이 자체 임계값으로 리포트 종류를 다시 판정하지 않는다.
    expect(moduleSource).not.toContain("todayIso >= firstBirthday");
  });

  it("F1: 카드가 CTA 라벨을 실제로 그린다 (소리로만 정확하면 눈으로 보는 사람은 여전히 오해한다)", () => {
    expect(homeSource).toContain("{milestoneCountdown.ctaLabel}");
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
