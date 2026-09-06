import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stagePreviewD7DedupeKey } from "../notifications/stage-preview-d7";
import { cumulativeTotalPendingNoticeText } from "./cumulative-total";
import {
  evaluateStageRetrospective,
  findRecentStageTransition,
  stageRetrospectiveDismissKey,
  type StageRetrospectiveExpenseRow,
  type StageRetrospectiveInput
} from "./stage-retrospective";

/**
 * 라운드 101 트랙 F5 — 시기 전환 회고 카드.
 *
 * 화면(app/(tabs)/index.tsx)은 react-native 바인딩 때문에 vitest에서 렌더할 수 없으므로,
 * 판정은 순수 모듈로 전부 고정하고 화면 쪽은 소스 계약(grep)으로 잡는다 — prep-nudge.test.ts /
 * home-section-priority.test.ts와 같은 관례다.
 *
 * 밴드 전환 픽스처의 달력 근거: 생일 2026-02-03이면 도메인 판정(calculateChildStage의
 * completedMonthsBetween)이 2026-09-02까지 생후 6개월(infant_4_6 → "0-6개월"),
 * 2026-09-03부터 생후 7개월(infant_7_12 → "6-12개월")을 낸다 — 전환일은 2026-09-03이다.
 */

const BAND_TRANSITION_BIRTH = "2026-02-03";
const BAND_TRANSITION_ISO = "2026-09-03";

const bandRecords: StageRetrospectiveExpenseRow[] = [
  // 창의 두 끝(포함 경계): 커버리지 첫날과 전환 전날.
  { amountKrw: 30_000, spentOn: "2026-08-01", expenseType: "expense" },
  // 레거시 행(expenseType 없음)은 지출로 센다 — countsTowardMonthlyTotal의 규칙 그대로.
  { amountKrw: 15_000, spentOn: "2026-09-02" },
  // 창 밖 두 끝: 커버리지 전날과 전환 당일(새 시기의 1일째).
  { amountKrw: 99_999, spentOn: "2026-07-31", expenseType: "expense" },
  { amountKrw: 88_888, spentOn: BAND_TRANSITION_ISO, expenseType: "expense" },
  // 합계 술어: 선물·환불은 다른 표면과 같은 한 벌로 빠진다(DNC-015).
  { amountKrw: 50_000, spentOn: "2026-08-10", expenseType: "gift" },
  { amountKrw: 20_000, spentOn: "2026-08-20", expenseType: "refund" }
];

function bandInput(overrides: Partial<StageRetrospectiveInput> = {}): StageRetrospectiveInput {
  return {
    childId: "child-1",
    stageMode: "born",
    birthDate: BAND_TRANSITION_BIRTH,
    todayIso: "2026-09-05",
    guideVariant: null,
    dismissedKeys: [],
    records: bandRecords,
    coverageStartIso: "2026-08-01",
    ...overrides
  };
}

describe("findRecentStageTransition — 도메인 판정 소비", () => {
  it("밴드가 갈라진 날을 찾는다 (0-6개월 → 6-12개월, 전환일 = 새 밴드 첫날)", () => {
    const transition = findRecentStageTransition({
      stageMode: "born",
      birthDate: BAND_TRANSITION_BIRTH,
      todayIso: "2026-09-05"
    });
    expect(transition).toEqual({
      kind: "band",
      previousLabel: "0-6개월",
      previousBand: "0-6개월",
      transitionIso: BAND_TRANSITION_ISO,
      daysSinceTransition: 2
    });
  });

  it("출생은 전환이다 — 지난 시기의 이름은 밴드 라벨이 아니라 임신(달력 사실)이다", () => {
    const transition = findRecentStageTransition({
      stageMode: "born",
      birthDate: "2026-09-03",
      todayIso: "2026-09-04"
    });
    expect(transition).toEqual({
      kind: "birth",
      previousLabel: "임신",
      previousBand: null,
      transitionIso: "2026-09-03",
      daysSinceTransition: 1
    });
  });

  it("임신 중에는 회고가 없다 — 내부 전환(early→mid→late)은 정리할 지난 시기가 아니다", () => {
    expect(
      findRecentStageTransition({ stageMode: "pregnant", birthDate: undefined, todayIso: "2026-09-05" })
    ).toBeNull();
  });

  it("수동 단계·날짜 없음·형식 오류·미래 생일은 전부 null이다 (지어내지 않는다)", () => {
    expect(findRecentStageTransition({ stageMode: "manual", birthDate: "2026-01-01", todayIso: "2026-09-05" })).toBeNull();
    expect(findRecentStageTransition({ stageMode: "born", birthDate: undefined, todayIso: "2026-09-05" })).toBeNull();
    expect(findRecentStageTransition({ stageMode: "born", birthDate: "2026-13-40", todayIso: "2026-09-05" })).toBeNull();
    expect(findRecentStageTransition({ stageMode: "born", birthDate: "2026-09-10", todayIso: "2026-09-05" })).toBeNull();
  });
});

describe("evaluateStageRetrospective — 7일 창", () => {
  it("전환 당일(1일째)부터 선다", () => {
    const card = evaluateStageRetrospective(
      bandInput({ stageMode: "born", birthDate: "2026-09-01", todayIso: "2026-09-01" })
    );
    expect(card?.kind).toBe("birth");
    expect(card?.title).toBe("지난 임신 시기 정리");
  });

  it("7일째(전환 + 6일)까지 서고, 8일째부터 소멸한다 — 경계 두 끝", () => {
    const seventhDay = evaluateStageRetrospective(
      bandInput({ stageMode: "born", birthDate: "2026-09-01", todayIso: "2026-09-07" })
    );
    expect(seventhDay).not.toBeNull();

    const eighthDay = evaluateStageRetrospective(
      bandInput({ stageMode: "born", birthDate: "2026-09-01", todayIso: "2026-09-08" })
    );
    expect(eighthDay).toBeNull();
  });

  it("밴드 전환도 같은 창이다 — 전환 + 7일이 지나면 스캔 창 밖이라 null", () => {
    // 전환일 2026-09-03 기준 7일째는 2026-09-09, 8일째는 2026-09-10이다.
    expect(evaluateStageRetrospective(bandInput({ todayIso: "2026-09-09" }))).not.toBeNull();
    expect(evaluateStageRetrospective(bandInput({ todayIso: "2026-09-10" }))).toBeNull();
  });
});

describe("evaluateStageRetrospective — 합계 술어와 창의 두 끝", () => {
  it("문장이 구간을 스스로 밝히고, 선물·환불·창 밖 행은 세지 않는다", () => {
    const card = evaluateStageRetrospective(bandInput());
    expect(card).not.toBeNull();
    expect(card?.title).toBe("지난 0-6개월 시기 정리");
    // 30,000(8/1 시작 경계) + 15,000(9/2 끝 경계 · 레거시 행) = 45,000. 선물 50,000 ·
    // 환불 20,000 · 창 앞 99,999 · 전환 당일 88,888은 전부 밖이다.
    expect(card?.summaryText).toBe("8월 1일부터 9월 2일까지 지출 45,000원 · 2건을 기록했어요.");
    expect(card?.pendingNoticeText).toBeNull();
    expect(card?.accessibilityLabel).toBe(`${card?.title}. ${card?.summaryText}`);
  });

  it("대기 행은 합계에서 빼고 누적 카드와 같은 문장으로 밝힌다 (영구 실패 어휘 분리 포함)", () => {
    const card = evaluateStageRetrospective(
      bandInput({
        records: [
          ...bandRecords,
          { amountKrw: 5_000, spentOn: "2026-08-15", expenseType: "expense", pendingSync: true, syncState: "pending" },
          {
            amountKrw: 7_000,
            spentOn: "2026-08-16",
            expenseType: "expense",
            pendingSync: true,
            syncState: "failed",
            lastErrorStatus: 400
          }
        ]
      })
    );
    // 합계는 서버 확정 행만: 대기 5,000·실패 7,000이 45,000에 섞이지 않는다.
    expect(card?.summaryText).toBe("8월 1일부터 9월 2일까지 지출 45,000원 · 2건을 기록했어요.");
    expect(card?.pendingNoticeText).toBe(cumulativeTotalPendingNoticeText(2, 1));
    expect(card?.accessibilityLabel).toContain(cumulativeTotalPendingNoticeText(2, 1));
  });

  it("창 밖의 대기 행은 고지에도 세지 않는다 (같은 두 끝 가드)", () => {
    const card = evaluateStageRetrospective(
      bandInput({
        records: [
          ...bandRecords,
          { amountKrw: 5_000, spentOn: "2026-07-31", expenseType: "expense", pendingSync: true, syncState: "pending" },
          { amountKrw: 5_000, spentOn: BAND_TRANSITION_ISO, expenseType: "expense", pendingSync: true, syncState: "pending" }
        ]
      })
    );
    expect(card?.pendingNoticeText).toBeNull();
  });

  it("창 안에 확정 기록이 0건이면 카드를 세우지 않는다 (0건을 말하려고 자리를 세우지 않는다)", () => {
    const card = evaluateStageRetrospective(
      bandInput({ records: [{ amountKrw: 88_888, spentOn: BAND_TRANSITION_ISO, expenseType: "expense" }] })
    );
    expect(card).toBeNull();
  });

  it("지난달 캐시가 없는 월초 전환은 셀 수 있는 날이 없다 — 창의 두 끝이 뒤집히면 null", () => {
    // 전환일 2026-09-01(출생), 커버리지가 이번 달 1일뿐이면 지난 시기(8월 31일까지)는 창 밖이다.
    const card = evaluateStageRetrospective(
      bandInput({
        stageMode: "born",
        birthDate: "2026-09-01",
        todayIso: "2026-09-02",
        coverageStartIso: "2026-09-01"
      })
    );
    expect(card).toBeNull();
  });
});

describe("evaluateStageRetrospective — 빈 홈 게이트 (DNC-002 단일 CTA)", () => {
  it("빈 홈의 안내(first-expense/view-only)가 서 있으면 회고도 접는다 — 판정은 homeGuideSpeaksForEmptyHome 하나다", () => {
    for (const variant of ["first-expense", "view-only"] as const) {
      expect(evaluateStageRetrospective(bandInput({ guideVariant: variant })), variant).toBeNull();
    }
  });

  it("준비템 첫 안내(first-items)는 빈 홈 갈래가 아니라 회고가 그대로 선다", () => {
    expect(evaluateStageRetrospective(bandInput({ guideVariant: "first-items" }))).not.toBeNull();
  });
});

describe("evaluateStageRetrospective — 닫음 멱등", () => {
  it("닫은 전환 키가 목록에 있으면 다시 서지 않는다", () => {
    const key = stageRetrospectiveDismissKey("child-1", BAND_TRANSITION_ISO);
    expect(evaluateStageRetrospective(bandInput({ dismissedKeys: [key] }))).toBeNull();
    // 다른 전환의 키는 이 전환을 막지 않는다 — 키는 전환 식별자(시작일)로만 갈린다.
    expect(
      evaluateStageRetrospective(bandInput({ dismissedKeys: [stageRetrospectiveDismissKey("child-1", "2026-02-03")] }))
    ).not.toBeNull();
  });

  it("카드의 dismissKey가 규약(stage_retrospective:{childId}:{전환일})대로다", () => {
    const card = evaluateStageRetrospective(bandInput());
    expect(card?.dismissKey).toBe("stage_retrospective:child-1:2026-09-03");
  });

  it("멱등 키는 D-7 예고(알림함)와 별도다 — 표면이 달라 서로를 막지 않는다", () => {
    const card = evaluateStageRetrospective(bandInput());
    expect(card?.dismissKey).not.toBe(stagePreviewD7DedupeKey("child-1", BAND_TRANSITION_ISO));
    expect(card?.dismissKey?.startsWith("stage_retrospective:")).toBe(true);
  });
});

describe("evaluateStageRetrospective — null 갈래 (모르면 만들지 않는다)", () => {
  it("아이를 모르면 null", () => {
    expect(evaluateStageRetrospective(bandInput({ childId: null }))).toBeNull();
  });

  it("지출 캐시가 아직 없으면 null — '아직 모른다'와 '0건'을 뭉개지 않는다", () => {
    expect(evaluateStageRetrospective(bandInput({ records: null }))).toBeNull();
    expect(evaluateStageRetrospective(bandInput({ records: undefined }))).toBeNull();
  });

  it("커버리지를 모르면 null", () => {
    expect(evaluateStageRetrospective(bandInput({ coverageStartIso: null }))).toBeNull();
  });

  it("오늘 형식이 깨졌으면 null", () => {
    expect(evaluateStageRetrospective(bandInput({ todayIso: "2026-9-5" }))).toBeNull();
  });

  it("전환이 없는 평일 홈에는 카드가 없다", () => {
    // 생후 5개월 한가운데 — 지난 7일 안에 밴드 경계가 없다.
    expect(evaluateStageRetrospective(bandInput({ todayIso: "2026-07-15" }))).toBeNull();
  });
});

describe("라운드 101 F5 홈 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("판정은 순수 모듈이 하고, 화면은 이미 있는 캐시만 넘긴다 (새 요청 0건)", () => {
    expect(homeSource).toContain('from "../../src/home/stage-retrospective"');
    expect(homeSource).toContain("evaluateStageRetrospective({");
    // 행은 주간 카드가 이미 만든 두 달치 재조정 결과 그대로다.
    expect(homeSource).toContain("records: retrospectiveRecords");
    expect(homeSource).toContain("dismissedKeys: dismissedStageRetrospectiveKeys");
    // 회고 카드도 예외 없이 같은 순위표를 지난다.
    expect(homeSource).toContain('activeSections.push("stage-retrospective")');
  });

  it("닫기는 모듈이 만든 전환 식별자 키로 persist된다 (닫음 멱등)", () => {
    expect(homeSource).toContain("dismissStageRetrospective(stageRetrospective.dismissKey)");
    expect(homeSource).toContain('testID="home-stage-retrospective-dismiss"');
  });

  it("닫음 목록 구독(훅)은 조기 반환들보다 위에 선다 (FIX-A 규율)", () => {
    const hookAt = homeSource.indexOf("state.dismissedStageRetrospectiveKeys");
    const firstEarlyReturnAt = homeSource.indexOf('if (hasSession && homePhase === "error") {');
    expect(hookAt).toBeGreaterThan(-1);
    expect(hookAt).toBeLessThan(firstEarlyReturnAt);
  });

  it("비세션 프리뷰(HOME-001 캡처 경로)에는 회고 카드가 없다", () => {
    const previewStart = homeSource.indexOf("// 비세션 프리뷰 렌더(HOME-001 캡처 경로)");
    const previewEnd = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)", previewStart);
    expect(previewStart, "비세션 프리뷰 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    expect(previewEnd, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(previewStart);
    const preview = homeSource.slice(previewStart, previewEnd);
    expect(preview).not.toContain("stageRetrospective");
    expect(preview).not.toContain("stage-retrospective");
  });

  it("회고 카드는 alert가 아니다 (7일간 서 있는 사실 — alert + liveRegion은 예산 경고 전용)", () => {
    const cardBlock = homeSource.slice(
      homeSource.indexOf('case "stage-retrospective":'),
      homeSource.indexOf('case "milestone":')
    );
    const cardCode = cardBlock
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(cardCode).not.toContain('accessibilityRole="alert"');
    expect(cardCode).not.toContain("accessibilityLiveRegion");
    // 문구는 한 글자도 화면이 만들지 않는다.
    expect(cardBlock).toContain("{stageRetrospective.title}");
    expect(cardBlock).toContain("{stageRetrospective.summaryText}");
    expect(cardBlock).toContain("{stageRetrospective.pendingNoticeText}");
    expect(cardBlock).toContain("accessibilityLabel={stageRetrospective.dismissAccessibilityLabel}");
  });
});
