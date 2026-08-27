import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ItemStatus } from "@wooriai/domain";
import {
  buildPrepMilestoneView,
  nextPrepFocusHintText,
  nextPrepFocusIds,
  nextStageBandLabel,
  nextStageBandPreviewLabel,
  prepMilestoneTier,
  selectNextPrepFocusItems,
  NEXT_PREP_FOCUS_BADGE_LABEL,
  NEXT_PREP_FOCUS_LIMIT,
  PREP_CELEBRATION_BODY,
  PREP_CELEBRATION_DISMISS_LABEL,
  PREP_CELEBRATION_TITLE,
  PREP_MILESTONE_THRESHOLDS,
  PREP_MILESTONE_TIER_TEXT,
  type PrepFocusCandidate
} from "./prep-milestones";
import { computeEssentialPrepProgress, type PrepProgressItem } from "./prep-progress";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function progress(totalCount: number, resolvedCount: number) {
  return {
    totalCount,
    resolvedCount,
    percent: totalCount === 0 ? 0 : Math.round((resolvedCount / totalCount) * 100),
    summaryText: `이번 시기 필수 준비물 ${totalCount}개 중 ${resolvedCount}개 준비됨`
  };
}

/**
 * UX-E 구간 판정. 경계값(25/50/75/100)은 **다음 구간에 속한다** -- "절반까지 왔어요"를
 * 49%에서 말하지 않기 위해서다.
 */
describe("prepMilestoneTier (UX-E)", () => {
  it("maps the 0 / 25 / 50 / 75 / 100 boundaries to the tier that starts there", () => {
    expect(prepMilestoneTier(0)).toBe("start");
    expect(prepMilestoneTier(24)).toBe("start");
    expect(prepMilestoneTier(25)).toBe("quarter");
    expect(prepMilestoneTier(49)).toBe("quarter");
    expect(prepMilestoneTier(50)).toBe("half");
    expect(prepMilestoneTier(74)).toBe("half");
    expect(prepMilestoneTier(75)).toBe("almost");
    expect(prepMilestoneTier(99)).toBe("almost");
    expect(prepMilestoneTier(100)).toBe("complete");
  });

  it("keeps the documented thresholds in one place", () => {
    expect(PREP_MILESTONE_THRESHOLDS).toEqual({ quarter: 25, half: 50, almost: 75, complete: 100 });
  });

  it("clamps out-of-range or non-finite percents instead of leaving the copy blank", () => {
    expect(prepMilestoneTier(-10)).toBe("start");
    expect(prepMilestoneTier(140)).toBe("complete");
    expect(prepMilestoneTier(Number.NaN)).toBe("start");
  });
});

describe("buildPrepMilestoneView (UX-E)", () => {
  it("reads the headline off the existing ITEM-114 snapshot without recomputing anything", () => {
    const view = buildPrepMilestoneView(progress(8, 6));

    expect(view).toMatchObject({
      tier: "almost",
      percent: 75,
      totalCount: 8,
      resolvedCount: 6,
      headline: "지금 시기 필수템 8개 중 6개 준비했어요",
      isComplete: false
    });
  });

  it("hides the whole header when the band has no essential items (분모 0)", () => {
    expect(buildPrepMilestoneView(null)).toBeNull();
    expect(buildPrepMilestoneView(undefined)).toBeNull();
    // 방어: 분모 0짜리 값이 흘러들어와도 "0개 중 0개 / 0%" 바를 그리지 않는다.
    expect(buildPrepMilestoneView(progress(0, 0))).toBeNull();
    // computeEssentialPrepProgress 자체가 필수템 0개 밴드에서 null을 준다(두 규칙이 같은 결론).
    expect(buildPrepMilestoneView(computeEssentialPrepProgress([], "12-24개월"))).toBeNull();
  });

  it("varies the tier copy across the 25/50/75/100 bands", () => {
    expect(buildPrepMilestoneView(progress(4, 0))?.tierText).toBe(PREP_MILESTONE_TIER_TEXT.start);
    expect(buildPrepMilestoneView(progress(4, 1))?.tierText).toBe(PREP_MILESTONE_TIER_TEXT.quarter);
    expect(buildPrepMilestoneView(progress(4, 2))?.tierText).toBe("절반까지 왔어요!");
    expect(buildPrepMilestoneView(progress(4, 3))?.tierText).toBe(PREP_MILESTONE_TIER_TEXT.almost);
    expect(buildPrepMilestoneView(progress(4, 4))?.tierText).toBe("지금 시기 준비 완료! 다음 시기를 미리 볼까요?");
  });

  /**
   * 라운드 34 L3: 구간은 *범위*인데 문구가 분수를 못 박으면 같은 화면의 개수와 어긋난다.
   * 여기서 고정하는 것은 "어떤 분수에서 떠도 참인가"다.
   */
  it("L3: 구간 문구는 수 중립이다 -- 4분의 1이 아닌 quarter, 정확히 절반인 half에서도 참이다", () => {
    // 3/8 = 38% → quarter 구간이지만 "4분의 1"은 아니다.
    expect(buildPrepMilestoneView(progress(8, 3))?.tier).toBe("quarter");
    expect(buildPrepMilestoneView(progress(8, 3))?.tierText).toBe("좋은 출발이에요!");
    expect(PREP_MILESTONE_TIER_TEXT.quarter).not.toMatch(/4분의 1|사분|25%/);

    // 정확히 50%(2/4)는 half 구간에 속한다 -- 그런데 예전 문구는 "절반을 넘었어요"였다(거짓).
    expect(buildPrepMilestoneView(progress(4, 2))?.tier).toBe("half");
    expect(PREP_MILESTONE_TIER_TEXT.half).toBe("절반까지 왔어요!");
    expect(PREP_MILESTONE_TIER_TEXT.half).not.toContain("넘었");
  });

  /**
   * 라운드 34 L2: percent는 표시용 반올림이라 "다 했다"의 근거가 될 수 없다.
   */
  it("L2: 199/200은 반올림 100%여도 완료가 아니다 (판정은 개수로만 한다)", () => {
    const almostDone = buildPrepMilestoneView(progress(200, 199));

    // 화면에 그려지는 퍼센트는 그대로 100(진행 바 폭·라벨은 반올림 값을 쓴다).
    expect(almostDone?.percent).toBe(100);
    // 그러나 축하 배너의 조건은 서지 않는다.
    expect(almostDone?.isComplete).toBe(false);
    // 구간 문구도 "준비 완료"라고 말하지 않는다 -- 헤드라인이 "200개 중 199개"라고 적혀 있다.
    expect(almostDone?.tier).toBe("almost");
    expect(almostDone?.tierText).toBe(PREP_MILESTONE_TIER_TEXT.almost);
    expect(almostDone?.headline).toBe("지금 시기 필수템 200개 중 199개 준비했어요");

    // 마지막 하나를 채우면 그때 완료가 된다.
    const done = buildPrepMilestoneView(progress(200, 200));
    expect(done).toMatchObject({ isComplete: true, tier: "complete", percent: 100 });
  });

  it("flags 100% as complete and 0% as the starting tier", () => {
    const zero = buildPrepMilestoneView(progress(3, 0));
    expect(zero).toMatchObject({ tier: "start", percent: 0, isComplete: false });
    expect(zero?.headline).toBe("지금 시기 필수템 3개 중 0개 준비했어요");

    const done = buildPrepMilestoneView(progress(3, 3));
    expect(done).toMatchObject({ tier: "complete", percent: 100, isComplete: true });
  });

  it("gives the progress bar one TalkBack sentence carrying counts, percent, and tier copy", () => {
    const view = buildPrepMilestoneView(progress(2, 1));
    expect(view?.accessibilityLabel).toBe("지금 시기 필수템 2개 중 1개 준비했어요, 50%. 절반까지 왔어요!");
  });

  it("keeps every tier copy in 해요체 with no purchase pressure and no developmental/medical claims (DNC-018/020)", () => {
    for (const text of Object.values(PREP_MILESTONE_TIER_TEXT)) {
      expect(text).not.toMatch(/구매|사세요|주문|할인|쿠폰/);
      expect(text).not.toMatch(/발달|성장|건강|의사|영양|면역/);
    }
    for (const text of [PREP_CELEBRATION_TITLE, PREP_CELEBRATION_BODY]) {
      expect(text).not.toMatch(/구매|사세요|주문|할인|쿠폰/);
      expect(text).not.toMatch(/발달|성장|건강|의사|영양|면역/);
    }
    expect(PREP_CELEBRATION_DISMISS_LABEL).toBe("닫기");
  });
});

describe("nextStageBandLabel (UX-E: 100% → 다음 시기 미리보기)", () => {
  it("walks the existing chip order", () => {
    expect(nextStageBandLabel("0-6개월")).toBe("6-12개월");
    expect(nextStageBandLabel("6-12개월")).toBe("12-24개월");
    expect(nextStageBandLabel("12-24개월")).toBe("24개월+");
  });

  it("returns null on the last band so the celebration shows no dead-end button", () => {
    expect(nextStageBandLabel("24개월+")).toBeNull();
  });

  it("labels the preview button with the band it opens", () => {
    expect(nextStageBandPreviewLabel("24개월+")).toBe("24개월+ 미리보기");
  });
});

/**
 * "다음에 챙길 것" 선정은 **서버 순서에서 골라내기만** 한다(클라이언트 재정렬 금지) --
 * 목록 순서는 서버 추천 랭킹의 계약이다.
 */
describe("selectNextPrepFocusItems (UX-E)", () => {
  function candidate(overrides: Partial<PrepFocusCandidate> & { id: string }): PrepFocusCandidate {
    return { name: `item-${overrides.id}`, necessityLevel: "essential", status: "not_prepared", ...overrides };
  }

  it("takes the first unresolved essentials in the order the server gave them", () => {
    const picked = selectNextPrepFocusItems([
      candidate({ id: "a", status: "prepared" }),
      candidate({ id: "b", necessityLevel: "convenience" }),
      candidate({ id: "c" }),
      candidate({ id: "d", status: "interested" }),
      candidate({ id: "e" })
    ]);

    expect(picked.map((item) => item.id)).toEqual(["c", "d"]);
  });

  it("never reorders — the picked items keep their relative server order", () => {
    const picked = selectNextPrepFocusItems(
      [candidate({ id: "z" }), candidate({ id: "a" }), candidate({ id: "m" })],
      3
    );
    expect(picked.map((item) => item.id)).toEqual(["z", "a", "m"]);
  });

  it("caps the highlight at two items by default", () => {
    expect(NEXT_PREP_FOCUS_LIMIT).toBe(2);
    const picked = selectNextPrepFocusItems([
      candidate({ id: "a" }),
      candidate({ id: "b" }),
      candidate({ id: "c" })
    ]);
    expect(picked).toHaveLength(2);
    expect(selectNextPrepFocusItems([candidate({ id: "a" })], 0)).toEqual([]);
  });

  it("treats prepared/gifted/not_needed as done, matching the prep-progress numerator", () => {
    const resolvedStatuses: ItemStatus[] = ["prepared", "gifted", "not_needed"];
    for (const status of resolvedStatuses) {
      expect(selectNextPrepFocusItems([candidate({ id: "a", status })])).toEqual([]);
    }
    expect(selectNextPrepFocusItems([candidate({ id: "a", status: "interested" })]).map((item) => item.id)).toEqual(["a"]);
  });

  it("only ever highlights catalog essentials (DNC-020: 발달·의료 근거 없음)", () => {
    expect(
      selectNextPrepFocusItems([
        candidate({ id: "a", necessityLevel: "convenience" }),
        candidate({ id: "b", necessityLevel: "optional" })
      ])
    ).toEqual([]);
  });

  it("dedupes by id so a repeated row cannot fill both slots", () => {
    const picked = selectNextPrepFocusItems([candidate({ id: "a" }), candidate({ id: "a" }), candidate({ id: "b" })]);
    expect(picked.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("returns an empty set/hint when the whole band is already handled", () => {
    const done = [candidate({ id: "a", status: "prepared" }), candidate({ id: "b", status: "gifted" })];
    expect(nextPrepFocusIds(done).size).toBe(0);
    expect(nextPrepFocusHintText(done)).toBeNull();
    expect(nextPrepFocusIds([]).size).toBe(0);
    expect(nextPrepFocusHintText([])).toBeNull();
  });

  it("names the picked items in one hint line instead of duplicating their cards", () => {
    const hint = nextPrepFocusHintText([
      candidate({ id: "a", name: "아기 침대", status: "prepared" }),
      candidate({ id: "b", name: "젖병" }),
      candidate({ id: "c", name: "속싸개" }),
      candidate({ id: "d", name: "손수건" })
    ]);
    expect(hint).toBe("먼저 챙기면 좋아요 · 젖병, 속싸개");
    expect(NEXT_PREP_FOCUS_BADGE_LABEL).toBe("먼저 챙기면 좋아요");
  });

  it("agrees with computeEssentialPrepProgress: every highlighted item is outside the resolved count", () => {
    const items: PrepProgressItem[] = [
      { id: "a", necessityLevel: "essential", status: "prepared", timingLabel: "12-24개월" },
      { id: "b", necessityLevel: "essential", status: "not_prepared", timingLabel: "12-24개월" },
      { id: "c", necessityLevel: "essential", status: "not_prepared", timingLabel: "12-24개월" }
    ];
    const snapshot = computeEssentialPrepProgress(items, "12-24개월");
    expect(snapshot).toMatchObject({ totalCount: 3, resolvedCount: 1 });

    const focus = selectNextPrepFocusItems(items.map((item) => ({ ...item, name: item.id })));
    expect(focus.map((item) => item.id)).toEqual(["b", "c"]);
    // 100%면 강조할 것이 남지 않는다 -- 축하 배너와 "먼저 챙기면 좋아요"가 동시에 뜨지 않는다.
    const allDone = items.map((item) => ({ ...item, name: item.id, status: "prepared" as const }));
    expect(buildPrepMilestoneView(computeEssentialPrepProgress(allDone, "12-24개월"))?.isComplete).toBe(true);
    expect(selectNextPrepFocusItems(allDone)).toEqual([]);
  });
});

/**
 * 배선 계약(source-grep) -- 화면 파일은 vitest에서 import할 수 없으므로(react-native 네이티브
 * 바인딩 없음) 이 저장소의 기존 관례대로 소스 문자열로 고정한다.
 */
describe("items tab journey wiring (UX-E)", () => {
  const itemsSource = () => source("app/(tabs)/items.tsx");

  it("derives the header from the pure module instead of recomputing progress in the screen", () => {
    const text = itemsSource();
    expect(text).toContain('from "../../src/items/prep-milestones"');
    expect(text).toContain("const prepMilestone = buildPrepMilestoneView(prepProgress);");
    // 수치는 여전히 ITEM-114 스냅샷 하나에서 나온다.
    expect(text).toContain("computeEssentialPrepProgress(allStatusItems.data, stageLabel)");
  });

  it("renders the progress bar with the module's headline, tier copy, and a progressbar role", () => {
    const text = itemsSource();
    expect(text).toContain('accessibilityRole="progressbar"');
    expect(text).toContain("accessibilityLabel={prepMilestone.accessibilityLabel}");
    expect(text).toContain("accessibilityValue={{ min: 0, max: 100, now: prepMilestone.percent }}");
    expect(text).toContain("{prepMilestone.headline}");
    expect(text).toContain("{prepMilestone.tierText}");
    expect(text).toContain("width: `${prepMilestone.percent}%`");
  });

  it("keeps every UX-E surface behind the session gate so the ITEM-001 pixel-lock preview is untouched", () => {
    const text = itemsSource();
    // prepProgress(=prepMilestone의 입력)는 hasSession + !isPixelLockMode 게이트를 통과한 값이다.
    expect(text).toContain("hasSession && !isPixelLockMode && allStatusItems.data");
    expect(text).toContain("const prepFocusIds = hasSession && !isPixelLockMode ? nextPrepFocusIds(listedItems) : null;");
    expect(text).toContain(
      "const prepFocusHint = hasSession && !isPixelLockMode ? nextPrepFocusHintText(listedItems) : null;"
    );
    // 비세션 미리보기 목록(previewItems)은 그대로 렌더된다.
    expect(text).toContain("const visibleItems = hasSession ? items.data!.items : previewItems;");
  });

  it("shows the 100% celebration once per band and lets it be dismissed", () => {
    const text = itemsSource();
    expect(text).toContain(
      "const showPrepCelebration = Boolean(prepMilestone?.isComplete) && !dismissedCelebrationBands.has(stageLabel);"
    );
    expect(text).toContain("{PREP_CELEBRATION_TITLE}");
    expect(text).toContain("{PREP_CELEBRATION_BODY}");
    expect(text).toContain("label={PREP_CELEBRATION_DISMISS_LABEL}");
    expect(text).toContain('accessibilityLabel="준비 완료 축하 안내 닫기"');
    expect(text).toContain("onPress={dismissPrepCelebration}");
  });

  it("connects the celebration to the existing stage-band chip instead of a new screen", () => {
    const text = itemsSource();
    expect(text).toContain("const nextStageBand = nextStageBandLabel(stageLabel);");
    expect(text).toContain("label={nextStageBandPreviewLabel(nextStageBand)}");
    expect(text).toContain("setHasManualStageSelection(true);");
    expect(text).toContain("setStageLabel(nextStageBand);");
  });

  it("marks the next-to-prepare rows in place — a badge, never a duplicate card", () => {
    const text = itemsSource();
    expect(text).toContain("const isPrepFocusItem = Boolean(prepFocusIds?.has(item.id));");
    expect(text).toContain("{NEXT_PREP_FOCUS_BADGE_LABEL}");
    // 강조 대상을 별도 목록으로 한 번 더 map 하지 않는다(같은 항목이 두 번 보이면 안 된다).
    expect(text).not.toMatch(/prepFocus\w*\.map\(/);
    expect(text).toContain("{listedItems.map((item, index) => {");
  });

  it("does not reorder the server list anywhere on the screen", () => {
    const text = itemsSource();
    expect(text).not.toContain(".sort(");
    expect(text).not.toContain("localeCompare");
    // 클라이언트 좁히기는 여전히 순서를 보존하는 filterItems 하나뿐이다.
    expect(text).toContain("filterItems<ItemSummary | RecommendationPreviewItem>(visibleItems, itemFilterInput)");
  });

  it("adds no analytics events (UX-E는 이벤트 레지스트리 무접촉)", () => {
    const text = itemsSource();
    const eventNames = text.match(/eventName: "[a-z_]+"/g) ?? [];
    expect(eventNames).toEqual(['eventName: "item_status_changed"']);
  });
});
