import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BORN_TRANSITION_ACTION_LABEL } from "../children/child-form";
import {
  evaluateBabyCounter,
  evaluateBirthTransitionPrompt,
  hasFinalConsonant,
  objectParticle,
  withParticle,
  BIRTH_TRANSITION_PROMPT_LABEL,
  BIRTH_TRANSITION_PROMPT_ROUTE,
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

/**
 * 라운드 41 UX-T(A) — 홈의 출생 전환 입구.
 *
 * 전환하지 않으면 준비템 밴드·마일스톤·100일 리포트가 조용히 비활성인데, 그 입구가 설정 → 아이
 * 관리 한 곳뿐이었다(홈에서 네 단계 깊이). 예정일에 닿은 순간부터 홈에 링크 한 줄을 둔다.
 */
describe("UX-T 출생 전환 입구 (evaluateBirthTransitionPrompt)", () => {
  const pregnant = (dueDate: string, todayIso = TODAY) =>
    evaluateBirthTransitionPrompt({ stageMode: "pregnant", dueDate, todayIso });

  it("예정일 전에는 권하지 않는다 -- D-1에 '태어났어요'를 묻는 것 자체가 재촉이다 (DNC-018)", () => {
    expect(pregnant("2026-09-28")).toBeNull(); // D-32
    expect(pregnant("2026-08-28")).toBeNull(); // D-1
  });

  it("예정일 당일과 유예 기간 안에는 카운터 아래 한 줄로 나온다", () => {
    expect(pregnant(TODAY)).toMatchObject({ variant: "pregnancy-due-today" });
    expect(pregnant("2026-08-25")).toMatchObject({ variant: "pregnancy-due-passed" });
    // 카운터가 아직 살아 있는 구간이다(화면은 두 줄을 함께 그린다).
    expect(evaluateBabyCounter({ stageMode: "pregnant", nickname: "다온이", dueDate: TODAY, todayIso: TODAY })).not
      .toBeNull();
  });

  it("유예 기간을 넘겨 카운터가 접힌 뒤에는 이 줄만 남는다 (조용히 사라지지 않는다)", () => {
    const overdue = { stageMode: "pregnant", nickname: "다온이", dueDate: "2026-08-12", todayIso: TODAY };
    // 15일 전 -- 카운터는 접히지만(종전 동작 그대로) 전환 입구는 남는다.
    expect(evaluateBabyCounter(overdue)).toBeNull();
    expect(evaluateBirthTransitionPrompt(overdue)).toMatchObject({ variant: "pregnancy-overdue-prompt" });
    // 경계는 카운터와 **같은 상수**에서 나온다.
    expect(pregnant("2026-08-13")?.variant).toBe("pregnancy-due-passed"); // 정확히 14일 전
    expect(PREGNANCY_OVERDUE_GRACE_DAYS).toBe(14);
  });

  it("경과 일수를 세지 않고 의료적 해석도 하지 않는다 (DNC-020) -- 세 변형의 문구가 같다", () => {
    const prompts = [pregnant(TODAY), pregnant("2026-08-25"), pregnant("2026-06-01")];
    for (const prompt of prompts) {
      expect(prompt?.label).toBe("아이가 태어났어요");
      expect(prompt?.label).not.toMatch(/\d/);
      expect(prompt?.accessibilityLabel).not.toMatch(/\d/);
      // 재촉·질책 톤 금지(DNC-018).
      expect(prompt?.accessibilityLabel).not.toContain("아직");
      expect(prompt?.accessibilityLabel).not.toContain("지났");
    }
    // 변형만 다르고 사용자가 보는 문구는 셋 다 같다 -- 숫자가 끼어들 자리가 없다.
    expect(new Set(prompts.map((prompt) => prompt?.label)).size).toBe(1);
  });

  it("라벨은 아이 관리 화면의 전환 버튼과 같은 문자열이고, 그 화면으로 보낸다", () => {
    expect(BIRTH_TRANSITION_PROMPT_LABEL).toBe(BORN_TRANSITION_ACTION_LABEL);
    expect(BIRTH_TRANSITION_PROMPT_ROUTE).toBe("/settings/children");
    expect(pregnant(TODAY)?.route).toBe("/settings/children");
    // 소리로 들을 때는 목적지가 문장 안에 있어야 한다.
    expect(pregnant(TODAY)?.accessibilityLabel).toBe("아이가 태어났어요, 출생일 입력하러 가기");
  });

  it("이미 출생으로 바꿨거나 수동 단계면 권할 것이 없다", () => {
    expect(
      evaluateBirthTransitionPrompt({ stageMode: "born", dueDate: "2026-06-01", todayIso: TODAY })
    ).toBeNull();
    expect(
      evaluateBirthTransitionPrompt({ stageMode: "manual", dueDate: "2026-06-01", todayIso: TODAY })
    ).toBeNull();
    expect(evaluateBirthTransitionPrompt({ stageMode: null, dueDate: "2026-06-01", todayIso: TODAY })).toBeNull();
  });

  it("날짜를 모르면 아무 말도 하지 않는다 (카운터와 같은 방어)", () => {
    expect(evaluateBirthTransitionPrompt({ stageMode: "pregnant", dueDate: null, todayIso: TODAY })).toBeNull();
    expect(evaluateBirthTransitionPrompt({ stageMode: "pregnant", dueDate: "2026-02-30", todayIso: TODAY })).toBeNull();
    expect(
      evaluateBirthTransitionPrompt({ stageMode: "pregnant", dueDate: "2026-08-01", todayIso: "오늘" })
    ).toBeNull();
  });

  it("카운터가 있는 구간에서는 두 판정의 변형 이름이 정확히 같다", () => {
    for (const dueDate of [TODAY, "2026-08-25", "2026-08-13"]) {
      const input = { stageMode: "pregnant", nickname: "다온이", dueDate, todayIso: TODAY };
      expect(evaluateBirthTransitionPrompt(input)?.variant, dueDate).toBe(evaluateBabyCounter(input)?.variant);
    }
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
    // DSN-053 P2-A: 단계 라벨은 아이브로우가 아니라 캡처 문법의 헤더 두 번째 줄(11/700)에 산다 --
    // 자리는 바뀌었지만 "카운터가 떠도 단계를 잃지 않는다"는 계약은 그대로다.
    expect(homeSource).toContain("<KoreanText style={homeHeaderStyle.stage}>{visibleHome.child.stageLabel}</KoreanText>");
    expect(homeSource).toContain("accessibilityLabel={babyCounter.accessibilityLabel}");
    expect(homeSource).toContain('testID="home-baby-counter"');
  });

  it("UX-T(A): 전환 입구도 같은 hasSession 게이트를 쓴다 (HOME-001 픽셀락)", () => {
    expect(homeSource).toContain("const birthTransitionPrompt = hasSession");
    expect(homeSource).toContain("evaluateBirthTransitionPrompt({");
    // 화면은 판정도 문구도 만들지 않는다 -- 순수 모듈의 값을 그대로 꽂는다.
    expect(homeSource).toContain("label={birthTransitionPrompt.label}");
    expect(homeSource).toContain("accessibilityLabel={birthTransitionPrompt.accessibilityLabel}");
    expect(homeSource).toContain("router.push(birthTransitionPrompt.route)");
    // 홈에 전환 폼(생년월일 입력·PATCH)을 복제하지 않는다 -- 입구만 낸다.
    expect(homeSource).not.toContain("markChildBorn");
    expect(homeSource).not.toContain("BORN_TRANSITION_CONFIRM_TITLE");
    // 문구를 화면에 하드코딩하지 않는다(설정 화면 버튼과 갈릴 수 있는 두 번째 소스 금지).
    expect(homeSource).not.toContain('"아이가 태어났어요"');
  });

  it("라운드 41 K-8: 보기 전용 홈에는 전환 입구를 내지 않는다 (PATCH도 편집 권한을 요구한다)", () => {
    // 게이트는 hasSession **그리고** 지출 기록과 같은 잠금 판정이다 -- 서버에서 두 동작의
    // 권한 조건이 같은 requireChildAccess(..., true)이므로 판정을 두 벌로 만들지 않는다.
    expect(homeSource).toContain("const birthTransitionPrompt = hasSession && !expenseGate.locked");
    // 그 판정은 홈이 이미 한 번 받아 둔 값이다(새 훅·새 요청을 더하지 않는다).
    expect(homeSource.match(/const expenseGate = useExpenseEntryGate\(\);/g) ?? []).toHaveLength(1);
    // 잠금 판정 자체가 비세션에서 절대 참이 아니므로 HOME-001 픽셀락 렌더는 그대로다.
    expect(homeSource).toContain("src/family/record-permissions.ts");
  });
});
