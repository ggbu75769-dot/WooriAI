import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateBabyCounter,
  hasFinalConsonant,
  objectParticle,
  withParticle,
  FALLBACK_NICKNAME,
  PREGNANCY_OVERDUE_GRACE_DAYS
} from "./baby-counter";

const TODAY = "2026-08-27"; // 목요일

describe("UX-A 아기 카운터 (임신 중)", () => {
  it("출산 예정일까지 남은 날을 D-day로 말한다", () => {
    const counter = evaluateBabyCounter({
      stageMode: "pregnant",
      nickname: "다온이",
      dueDate: "2026-09-28",
      birthDate: null,
      todayIso: TODAY
    });

    expect(counter).toMatchObject({ variant: "pregnancy-countdown", days: 32 });
    expect(counter?.title).toBe("다온이를 만나기까지 D-32");
    // 화면의 "D-32"는 스크린리더가 뜻을 흐리게 읽으므로 소리용 문장이 따로 있다.
    expect(counter?.accessibilityLabel).toBe("다온이를 만나기까지 32일 남았어요");
  });

  it("D-1 다음 날(예정일 당일)은 D-0 대신 날짜 사실만 말한다", () => {
    const dayBefore = evaluateBabyCounter({
      stageMode: "pregnant",
      nickname: "다온이",
      dueDate: "2026-08-28",
      todayIso: TODAY
    });
    expect(dayBefore?.title).toBe("다온이를 만나기까지 D-1");

    const dueToday = evaluateBabyCounter({
      stageMode: "pregnant",
      nickname: "다온이",
      dueDate: TODAY,
      todayIso: TODAY
    });
    expect(dueToday).toMatchObject({ variant: "pregnancy-due-today", days: 0 });
    expect(dueToday?.title).toBe("오늘은 다온이의 출산 예정일이에요");
    // 의료적 단정("오늘 태어나요")도, 며칠 늦었다는 압박도 없다(DNC-020 / DNC-018).
    expect(dueToday?.title).not.toContain("D-0");
  });

  it("예정일이 지나면 지난 날수를 세지 않고 기다림의 톤만 남긴다", () => {
    const passed = evaluateBabyCounter({
      stageMode: "pregnant",
      nickname: "다온이",
      dueDate: "2026-08-25",
      todayIso: TODAY
    });
    expect(passed).toMatchObject({ variant: "pregnancy-due-passed", days: -2 });
    expect(passed?.title).toBe("다온이를 곧 만나요");
    expect(passed?.title).not.toMatch(/\d/);
  });

  it("유예 기간(14일)이 지나도록 출생 전환이 없으면 카운터를 접는다", () => {
    const lastGraceDay = evaluateBabyCounter({
      stageMode: "pregnant",
      nickname: "다온이",
      dueDate: "2026-08-13", // 정확히 14일 전
      todayIso: TODAY
    });
    expect(PREGNANCY_OVERDUE_GRACE_DAYS).toBe(14);
    expect(lastGraceDay?.variant).toBe("pregnancy-due-passed");

    expect(
      evaluateBabyCounter({
        stageMode: "pregnant",
        nickname: "다온이",
        dueDate: "2026-08-12", // 15일 전
        todayIso: TODAY
      })
    ).toBeNull();
  });

  it("예정일이 없거나 형식이 깨졌으면 만들지 않는다", () => {
    expect(evaluateBabyCounter({ stageMode: "pregnant", nickname: "다온이", dueDate: null, todayIso: TODAY })).toBeNull();
    expect(
      evaluateBabyCounter({ stageMode: "pregnant", nickname: "다온이", dueDate: "2026-02-30", todayIso: TODAY })
    ).toBeNull();
    expect(
      evaluateBabyCounter({ stageMode: "pregnant", nickname: "다온이", dueDate: "2026-09-28", todayIso: "오늘" })
    ).toBeNull();
  });
});

describe("UX-A 아기 카운터 (출생 후)", () => {
  it("태어난 날을 1일로 세어 함께한 날을 말한다", () => {
    const counter = evaluateBabyCounter({
      stageMode: "born",
      nickname: "다온이",
      birthDate: "2026-06-02",
      todayIso: TODAY
    });

    expect(counter).toMatchObject({ variant: "days-together", days: 87 });
    expect(counter?.title).toBe("다온이와 함께한 지 87일");
    expect(counter?.accessibilityLabel).toBe("다온이와 함께한 지 87일째예요");
  });

  it("태어난 당일은 0일이 아니라 1일이다 (한국 관례 -- 서버 100일 창과 같은 세는 법)", () => {
    expect(evaluateBabyCounter({ stageMode: "born", nickname: "다온이", birthDate: TODAY, todayIso: TODAY })?.days).toBe(1);
    expect(
      evaluateBabyCounter({ stageMode: "born", nickname: "다온이", birthDate: "2026-08-26", todayIso: TODAY })?.days
    ).toBe(2);
  });

  it("연을 걸쳐도 정확히 센다", () => {
    const counter = evaluateBabyCounter({
      stageMode: "born",
      nickname: "다온이",
      birthDate: "2025-12-25",
      todayIso: "2026-01-03"
    });
    expect(counter?.days).toBe(10); // 12/25=1일차 … 1/3=10일차
  });

  it("생년월일이 미래면(데이터 오류) 0일·음수일 같은 숫자를 만들지 않는다", () => {
    expect(
      evaluateBabyCounter({ stageMode: "born", nickname: "다온이", birthDate: "2026-08-28", todayIso: TODAY })
    ).toBeNull();
  });

  it("생년월일이 없으면 만들지 않는다", () => {
    expect(evaluateBabyCounter({ stageMode: "born", nickname: "다온이", birthDate: null, todayIso: TODAY })).toBeNull();
  });
});

describe("UX-A 아기 카운터 (단계 모드·호칭)", () => {
  it("수동 단계와 알 수 없는 stageMode에는 문구를 만들지 않는다 (기존 단계 라벨 헤더 유지)", () => {
    expect(
      evaluateBabyCounter({
        stageMode: "manual",
        nickname: "다온이",
        birthDate: "2026-06-02",
        dueDate: "2026-09-28",
        todayIso: TODAY
      })
    ).toBeNull();
    expect(evaluateBabyCounter({ stageMode: null, nickname: "다온이", todayIso: TODAY })).toBeNull();
  });

  it("받침에 맞는 조사를 붙이고, 한글이 아닌 태명은 안전한 형태로 떨어진다", () => {
    expect(hasFinalConsonant("다온이")).toBe(false);
    expect(hasFinalConsonant("사랑")).toBe(true);
    expect(hasFinalConsonant("Ben")).toBeNull();
    expect(objectParticle("사랑")).toBe("을");
    expect(objectParticle("다온이")).toBe("를");
    expect(withParticle("사랑")).toBe("과");
    expect(withParticle("다온이")).toBe("와");

    expect(
      evaluateBabyCounter({ stageMode: "born", nickname: "사랑", birthDate: "2026-06-02", todayIso: TODAY })?.title
    ).toBe("사랑과 함께한 지 87일");
    expect(
      evaluateBabyCounter({ stageMode: "pregnant", nickname: "사랑", dueDate: "2026-09-28", todayIso: TODAY })?.title
    ).toBe("사랑을 만나기까지 D-32");
    expect(
      evaluateBabyCounter({ stageMode: "pregnant", nickname: "Ben", dueDate: "2026-09-28", todayIso: TODAY })?.title
    ).toBe("Ben를 만나기까지 D-32");
  });

  it("태명이 비어 있으면 문장이 조사로 시작하지 않게 대체 호칭을 쓴다", () => {
    const counter = evaluateBabyCounter({
      stageMode: "born",
      nickname: "   ",
      birthDate: "2026-06-02",
      todayIso: TODAY
    });
    expect(counter?.title).toBe(`${FALLBACK_NICKNAME}와 함께한 지 87일`);
  });
});

describe("UX-A 아기 카운터 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("세션이 있을 때만 계산한다 (비세션 HOME-001 미리보기는 종전 헤더 그대로)", () => {
    expect(homeSource).toContain("const babyCounter = hasSession");
    expect(homeSource).toContain("evaluateBabyCounter({");
    // 미리보기 분기는 여전히 기존 ScreenHeader를 그린다.
    expect(homeSource).toContain("title={`${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`}");
  });

  it("생년월일·출산예정일·단계는 새 API 없이 ['children'] 캐시에서 읽는다", () => {
    expect(homeSource).toContain('queryKey: ["children"]');
    expect(homeSource).toContain("childrenQuery.data?.children.find((child) => child.id === childId)");
    expect(homeSource).toContain("stageMode: selectedChild?.stageMode");
    expect(homeSource).toContain("dueDate: selectedChild?.dueDate");
    expect(homeSource).toContain("birthDate: selectedChild?.birthDate");
  });

  it("단계 라벨을 잃지 않고, 카운터 줄에 소리용 라벨을 붙인다", () => {
    expect(homeSource).toContain("<Text style={homeBabyCounterStyle.eyebrow}>{visibleHome.child.stageLabel}</Text>");
    expect(homeSource).toContain("accessibilityLabel={babyCounter.accessibilityLabel}");
    expect(homeSource).toContain('testID="home-baby-counter"');
  });
});
