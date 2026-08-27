import { describe, expect, it } from "vitest";
import type { ChildStageCode, ItemStatus, NecessityLevel } from "@wooriai/domain";
import { matchesTab, rankItemsForTab, type ItemTab, type RankableItem } from "../src/onboarding/item-ranking";

/**
 * TEST-124: 준비템 목록의 "어느 탭에 담기고 어떤 순서인가"는 그동안 실 PostgreSQL e2e
 * (items-commerce / items-stage-band)로만 확인됐다. 판단이 순수 모듈로 빠졌으므로 여기서
 * DB 없이 경계를 고정한다 — 밴드 걸침 vs 현재 단계, gifted의 소속 탭, tab=all의 밴드 무시,
 * 동점 정렬의 결정성, now/soon 여집합 관계.
 *
 * e2e는 계속 "서비스가 이 모듈을 그대로 쓴다"는 쪽(응답 불변)을 지킨다.
 */

const CURRENT_STAGE: ChildStageCode = "newborn_0_3";
/** STAGE_BAND_STAGES["24개월+"] = toddler_1_3, kid_4_7, elementary, middle_school. */
const FUTURE_BAND = "24개월+" as const;

function item(
  id: string,
  overrides: {
    stageCodes?: ChildStageCode[];
    necessityLevel?: NecessityLevel;
    status?: ItemStatus;
    displayOrder?: number;
  } = {}
): RankableItem {
  return {
    id,
    stageCodes: overrides.stageCodes ?? [CURRENT_STAGE],
    necessityLevel: overrides.necessityLevel ?? "essential",
    status: overrides.status ?? "not_prepared",
    displayOrder: overrides.displayOrder ?? 10
  };
}

// 한 카탈로그를 여러 케이스가 공유한다: 현재 단계 항목, 다음 시기(밴드) 항목, 어느 쪽도
// 아닌 항목 + 정리된 상태(prepared/gifted/not_needed) 각각.
const NOW_OPEN = item("a-now-open", { displayOrder: 10 });
const BAND_OPEN = item("b-band-open", { stageCodes: ["toddler_1_3"], displayOrder: 20 });
const OTHER_OPEN = item("c-other-open", {
  stageCodes: ["infant_7_12"],
  necessityLevel: "convenience",
  displayOrder: 30
});
const NOW_PREPARED = item("d-now-prepared", { status: "prepared", displayOrder: 40 });
const BAND_GIFTED = item("e-band-gifted", { stageCodes: ["toddler_1_3"], status: "gifted", displayOrder: 50 });
const NOW_NOT_NEEDED = item("f-now-not-needed", { status: "not_needed", displayOrder: 60 });
const NOW_INTERESTED = item("g-now-interested", { status: "interested", displayOrder: 70 });

const CATALOG = [NOW_OPEN, BAND_OPEN, OTHER_OPEN, NOW_PREPARED, BAND_GIFTED, NOW_NOT_NEEDED, NOW_INTERESTED];

function idsFor(tab: ItemTab, stageBand?: typeof FUTURE_BAND) {
  return rankItemsForTab(CATALOG, { tab, stageCode: CURRENT_STAGE, stageBand }).map((entry) => entry.id);
}

describe("탭 술어: 시기 기준 (밴드 미지정 = 현재 단계)", () => {
  it("밴드가 없으면 현재 단계를 포함하는 미정리 항목만 now에 담긴다", () => {
    expect(idsFor("now")).toEqual([NOW_OPEN.id, NOW_INTERESTED.id]);
  });

  it("soon은 now의 여집합이다 — 둘은 서로소이고 합집합이 미정리 항목 전체다", () => {
    const now = idsFor("now");
    const soon = idsFor("soon");

    expect(soon).toEqual([BAND_OPEN.id, OTHER_OPEN.id]);
    expect(now.filter((id) => soon.includes(id))).toEqual([]);
    expect(new Set([...now, ...soon])).toEqual(
      new Set([NOW_OPEN.id, NOW_INTERESTED.id, BAND_OPEN.id, OTHER_OPEN.id])
    );
  });

  it("밴드를 지정하면 기준이 '그 밴드에 걸치는가'로 바뀐다 — 현재 단계 항목이 soon으로 내려간다", () => {
    // ITEM-121: 예비 부모의 "다음 시기 미리 보기". 밴드에 걸치는 항목이 now가 되고,
    // 현재 단계뿐인 항목은 그 여집합인 soon으로 간다.
    expect(idsFor("now", FUTURE_BAND)).toEqual([BAND_OPEN.id]);
    expect(idsFor("soon", FUTURE_BAND)).toEqual([NOW_OPEN.id, NOW_INTERESTED.id, OTHER_OPEN.id]);
  });

  it("밴드를 봐도 점수의 stageMatches는 늘 아이의 현재 단계다", () => {
    // soon(밴드 기준 여집합) 안에서도 지금 당장 필요한 항목(현재 단계)이 위로 온다:
    // NOW_OPEN/NOW_INTERESTED는 stageMatches=true(95점), OTHER_OPEN은 false(50점).
    const soon = idsFor("soon", FUTURE_BAND);
    expect(soon.indexOf(OTHER_OPEN.id)).toBe(soon.length - 1);
  });
});

describe("탭 술어: 상태 기준", () => {
  it("gifted는 prepared 탭에 함께 담기고 not_needed 탭에는 들어가지 않는다", () => {
    // ITEM-123 (B4): "선물로 받아 이미 손에 있다"는 물건을 갖춘 prepared와 같은 계열이고,
    // "필요 없다고 판단했다"인 not_needed와는 정반대다.
    expect(idsFor("prepared")).toEqual([NOW_PREPARED.id, BAND_GIFTED.id]);
    expect(idsFor("not_needed")).toEqual([NOW_NOT_NEEDED.id]);
  });

  it("prepared/not_needed는 밴드가 지정된 경우에만 시기로 좁아진다", () => {
    // 밴드 미지정 = 종전 동작(상태만으로 담는다). 위 케이스가 그 기준선이고,
    // 밴드를 주면 밴드 밖의 정리된 항목은 빠진다.
    expect(idsFor("prepared", FUTURE_BAND)).toEqual([BAND_GIFTED.id]);
    expect(idsFor("not_needed", FUTURE_BAND)).toEqual([]);
  });

  it("정리된 항목(prepared/gifted/not_needed)은 now/soon 어디에도 나오지 않는다", () => {
    const openTabs = [...idsFor("now"), ...idsFor("soon"), ...idsFor("now", FUTURE_BAND), ...idsFor("soon", FUTURE_BAND)];
    for (const settled of [NOW_PREPARED, BAND_GIFTED, NOW_NOT_NEEDED]) {
      expect(openTabs).not.toContain(settled.id);
    }
  });

  it("prepared/not_needed/all은 displayOrder 순서를 그대로 따른다", () => {
    expect(idsFor("all")).toEqual(
      [...CATALOG].sort((left, right) => left.displayOrder - right.displayOrder).map((entry) => entry.id)
    );
  });
});

describe("tab=all: 상태로도 시기로도 거르지 않는 스냅샷 (FIX/F4)", () => {
  it("밴드를 줘도 all의 집합은 그대로다", () => {
    // 회귀 가드: 예전에는 all에도 밴드를 걸어서, 밴드의 여집합인 soon 탭 항목이 스냅샷에서
    // 통째로 빠졌다(준비율 ITEM-114의 분모도 그만큼 줄었다).
    expect(idsFor("all", FUTURE_BAND)).toEqual(idsFor("all"));
    expect(idsFor("all")).toHaveLength(CATALOG.length);
  });

  it("밴드가 붙어도 all은 네 탭 합집합의 상위집합이다", () => {
    const union = new Set(
      (["now", "soon", "prepared", "not_needed"] as const).flatMap((tab) => idsFor(tab, FUTURE_BAND))
    );
    const snapshot = idsFor("all", FUTURE_BAND);
    for (const id of union) {
      expect(snapshot).toContain(id);
    }
    // 밴드로 좁혀진 prepared/not_needed 탭에서 빠진 정리 항목은 스냅샷에는 남는다.
    expect(union.has(NOW_NOT_NEEDED.id)).toBe(false);
    expect(snapshot).toContain(NOW_NOT_NEEDED.id);
  });
});

describe("정렬: 동점 처리와 결정성", () => {
  const tied = [
    item("item-c", { displayOrder: 10 }),
    item("item-a", { displayOrder: 30 }),
    item("item-b", { displayOrder: 20 })
  ];

  it("점수가 같으면 id 오름차순으로 갈리고, 입력 순서가 달라도 결과가 같다", () => {
    const context = { tab: "now" as const, stageCode: CURRENT_STAGE };
    const ranked = rankItemsForTab(tied, context).map((entry) => entry.id);

    expect(ranked).toEqual(["item-a", "item-b", "item-c"]);
    expect(rankItemsForTab([...tied].reverse(), context).map((entry) => entry.id)).toEqual(ranked);
  });

  it("점수가 다르면 displayOrder보다 점수가 우선한다", () => {
    // essential(30) + 관심(15+5) > convenience(20) + 미준비(20)
    const ranked = rankItemsForTab(
      [
        item("z-cheap-convenience", { necessityLevel: "convenience", displayOrder: 1 }),
        item("a-essential-interested", { status: "interested", displayOrder: 999 })
      ],
      { tab: "now", stageCode: CURRENT_STAGE }
    ).map((entry) => entry.id);

    expect(ranked).toEqual(["a-essential-interested", "z-cheap-convenience"]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const input = [...CATALOG];
    rankItemsForTab(input, { tab: "all", stageCode: CURRENT_STAGE });
    expect(input).toEqual(CATALOG);
  });
});

describe("matchesTab 단독 술어", () => {
  it("탭 술어와 정렬 결과가 같은 집합을 가리킨다", () => {
    for (const tab of ["now", "soon", "prepared", "not_needed", "all"] as const) {
      for (const stageBand of [undefined, FUTURE_BAND] as const) {
        const context = { tab, stageCode: CURRENT_STAGE, stageBand };
        const predicate = CATALOG.filter((entry) => matchesTab(entry, context)).map((entry) => entry.id);
        const ranked = rankItemsForTab(CATALOG, context).map((entry) => entry.id);
        expect(new Set(predicate)).toEqual(new Set(ranked));
      }
    }
  });
});
