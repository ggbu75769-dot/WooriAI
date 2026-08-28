import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateChildStage } from "@wooriai/domain";
import { describe, expect, it } from "vitest";

import { PREGNANCY_OVERDUE_GRACE_DAYS } from "./baby-counter";
import { addDays } from "./day-math";
import {
  PREGNANCY_OVERDUE_STAGE_LABEL,
  isPregnancyWeekLabelStale,
  resolveStageDisplayLabel
} from "./stage-display-label";

const DUE = "2026-03-01";
const dayOffsetFromDue = (days: number) => addDays(DUE, days) as string;

/** 도메인이 그날 실제로 만드는 라벨(표시층이 무엇을 덮는지 확인하려면 실물이 필요하다). */
const domainStageLabel = (todayIso: string) =>
  calculateChildStage({ stageMode: "pregnant", dueDate: DUE, today: todayIso }).stageLabel;

describe("GAP-061 #10 임신 주차 고착 — 표시층 라벨", () => {
  it("도메인 주차는 예정일 +14일에 42에서 멈춘다(이 모듈이 존재하는 이유)", () => {
    // 경계 자체를 계약으로 박아 둔다: 유예 상수와 clamp가 갈리면 이 테스트가 먼저 깨진다.
    expect(domainStageLabel(dayOffsetFromDue(PREGNANCY_OVERDUE_GRACE_DAYS))).toBe("임신 42주차");
    expect(domainStageLabel(dayOffsetFromDue(PREGNANCY_OVERDUE_GRACE_DAYS + 1))).toBe("임신 42주차");
    expect(domainStageLabel(dayOffsetFromDue(200))).toBe("임신 42주차");
  });

  it("예정일 전·당일·유예 안에서는 서버 라벨을 한 글자도 바꾸지 않는다", () => {
    for (const offset of [-70, -1, 0, 1, PREGNANCY_OVERDUE_GRACE_DAYS]) {
      const todayIso = dayOffsetFromDue(offset);
      const stageLabel = domainStageLabel(todayIso);
      expect(
        resolveStageDisplayLabel({ stageMode: "pregnant", dueDate: DUE, todayIso, stageLabel }),
        `D${offset >= 0 ? "+" : ""}${offset}`
      ).toBe(stageLabel);
      expect(isPregnancyWeekLabelStale({ stageMode: "pregnant", dueDate: DUE, todayIso })).toBe(false);
    }
  });

  it("유예를 넘기면 주차를 되풀이하지 않고 사실 한 줄로 바꾼다", () => {
    for (const offset of [PREGNANCY_OVERDUE_GRACE_DAYS + 1, 30, 400]) {
      const todayIso = dayOffsetFromDue(offset);
      expect(
        resolveStageDisplayLabel({ stageMode: "pregnant", dueDate: DUE, todayIso, stageLabel: domainStageLabel(todayIso) })
      ).toBe(PREGNANCY_OVERDUE_STAGE_LABEL);
      expect(isPregnancyWeekLabelStale({ stageMode: "pregnant", dueDate: DUE, todayIso })).toBe(true);
    }
  });

  it("대체 문구에 주차·경과 일수·의료 해석이 들어가지 않는다 (DNC-020/DNC-018)", () => {
    expect(PREGNANCY_OVERDUE_STAGE_LABEL).toBe("예정일이 지났어요");
    expect(PREGNANCY_OVERDUE_STAGE_LABEL).not.toMatch(/주차|\d/);
    // 해요체 · 재촉/질책 금지.
    expect(PREGNANCY_OVERDUE_STAGE_LABEL.endsWith("요")).toBe(true);
    expect(PREGNANCY_OVERDUE_STAGE_LABEL).not.toMatch(/아직|빨리|해주세요|하세요|늦/);
  });

  it("출생·수동 단계는 건드리지 않는다 (임신 표시층 전용)", () => {
    const todayIso = dayOffsetFromDue(400);
    expect(
      resolveStageDisplayLabel({ stageMode: "born", dueDate: DUE, todayIso, stageLabel: "생후 3개월" })
    ).toBe("생후 3개월");
    expect(
      resolveStageDisplayLabel({ stageMode: "manual", dueDate: DUE, todayIso, stageLabel: "수동 선택: 임신 후기" })
    ).toBe("수동 선택: 임신 후기");
    expect(isPregnancyWeekLabelStale({ stageMode: "born", dueDate: DUE, todayIso })).toBe(false);
  });

  it("날짜를 모르면 아무것도 바꾸지 않는다", () => {
    for (const dueDate of [null, undefined, "", "2026-13-01", "그저께"]) {
      expect(
        resolveStageDisplayLabel({ stageMode: "pregnant", dueDate, todayIso: "2027-01-01", stageLabel: "임신 42주차" })
      ).toBe("임신 42주차");
    }
    expect(
      resolveStageDisplayLabel({ stageMode: "pregnant", dueDate: DUE, todayIso: "오늘", stageLabel: "임신 42주차" })
    ).toBe("임신 42주차");
  });

  it("라벨이 비어 있으면 빈 문자열 — 화면이 null을 찍지 않는다", () => {
    expect(resolveStageDisplayLabel({ stageMode: "born", todayIso: "2026-03-01", stageLabel: null })).toBe("");
    expect(resolveStageDisplayLabel({ stageMode: "born", todayIso: "2026-03-01", stageLabel: "  " })).toBe("");
  });
});

/**
 * 화면 배선 계약(다른 화면 계약과 같은 source-grep 관례 — vitest에서 react-native를 렌더할 수
 * 없다). 순수 모듈만 그린이면 "고쳐 놓고 화면은 옛 라벨을 그대로 그리는" 상태가 통과하므로,
 * 단계 라벨을 사람에게 보여 주는 **세 자리**가 모두 이 모듈을 지나는지 여기서 붙든다.
 */
describe("GAP-061 #10 표시층 배선", () => {
  const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

  it("홈 헤더가 도메인 라벨을 직접 그리지 않고 표시층 라벨을 쓴다", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain('from "../../src/home/stage-display-label"');
    expect(homeSource).toContain("const headerStageLabel = resolveStageDisplayLabel({");
    // 보이는 줄과 낭독되는 줄이 갈리지 않게 — 헤더 두 갈래(아이 전환 가능/불가)와 소리용 문장이
    // 모두 같은 한 값을 쓴다.
    expect(homeSource).toContain("const headerSpokenLabel = `${visibleHome.child.nickname} ${headerStageLabel}`;");
    const stageTextCount = homeSource.split("<KoreanText style={homeHeaderStyle.stage}>{headerStageLabel}</KoreanText>").length - 1;
    expect(stageTextCount).toBe(2);
  });

  it("비세션 HOME-001 미리보기 렌더는 종전 문자열 그대로다 (픽셀락 기준선 불변)", () => {
    // 캡처 경로에는 세션도 아이도 없어 예정일 자체가 없다 — 노드 하나도 달라지면 안 되는 자리라
    // 이 라운드에서 손대지 않았다는 사실을 계약으로 남긴다.
    expect(source("app/(tabs)/index.tsx")).toContain(
      "title={`${visibleHome.child.nickname} ${visibleHome.child.stageLabel}`}"
    );
  });

  it("설정 요약·아이 목록도 같은 판정을 지난다", () => {
    for (const screen of ["app/settings/index.tsx", "app/settings/children.tsx"]) {
      const screenSource = source(screen);
      expect(screenSource, `${screen} should import the display-layer resolver`).toContain(
        'from "../../src/home/stage-display-label"'
      );
      expect(screenSource, `${screen} should call resolveStageDisplayLabel`).toContain("resolveStageDisplayLabel({");
      expect(screenSource, `${screen} must not render the raw stageLabel`).not.toContain("{child.stageLabel}");
      expect(screenSource, `${screen} must not render the raw stageLabel`).not.toContain("${selectedChild.stageLabel}");
    }
  });
});
