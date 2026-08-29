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
    // GAP-072 트랙 D: 찜한 NOW_INTERESTED가 앞이다(찜 25 > 미준비 20). 이 줄이 예전에는
    // `[NOW_OPEN, NOW_INTERESTED]`였다 — 두 항목이 정확히 동점이라 id가 순서를 정했다.
    expect(idsFor("now")).toEqual([NOW_INTERESTED.id, NOW_OPEN.id]);
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
    expect(idsFor("soon", FUTURE_BAND)).toEqual([NOW_INTERESTED.id, NOW_OPEN.id, OTHER_OPEN.id]);
  });

  it("밴드를 봐도 점수의 stageMatches는 늘 아이의 현재 단계다", () => {
    // soon(밴드 기준 여집합) 안에서도 지금 당장 필요한 항목(현재 단계)이 위로 온다:
    // NOW_OPEN 85점 · NOW_INTERESTED 90점(stageMatches=true), OTHER_OPEN 40점(false).
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
    // essential(30) + 찜(25) > convenience(20) + 미준비(20)
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

/**
 * GAP-072 트랙 D — **찜이 순서에 도달한다. 그리고 그것만 바뀐다.**
 *
 * 정찰 판정: `userInterest`가 상태 점수와 정확히 상쇄되도록 값이 정해져 있어(20 = 15 + 5)
 * 사용자가 "관심 있어요"를 눌러도 목록이 한 칸도 움직이지 않았다. 이제 찜은 미준비보다
 * 5점 위다. 이 트랙이 바꾸는 것은 **순서뿐**이므로, 여기서 두 가지를 함께 못박는다:
 * ⓐ 순서가 실제로 움직인다, ⓑ **어느 탭에 담기는가는 한 항목도 바뀌지 않는다**(부정 단언 —
 * `matchesTab`·`TAB_STATUSES`·`isInSelectedPeriod`는 한 줄도 손대지 않았다).
 */
describe("GAP-072 트랙 D: 찜은 순서만 바꾼다", () => {
  const context = { tab: "now" as const, stageCode: CURRENT_STAGE };

  it("찜한 항목이 같은 필수도의 미준비 항목 위로 온다 — displayOrder를 이긴다", () => {
    // z는 카탈로그 편집 순서상 맨 뒤(displayOrder 900)이고 id도 뒤다. 그럼에도 찜 하나로
    // 맨 앞에 온다 — 예전에는 동점이라 a, z 순이었다.
    const untouched = item("a-untouched", { displayOrder: 1 });
    const marked = item("z-marked", { status: "interested", displayOrder: 900 });

    expect(rankItemsForTab([untouched, marked], context).map((entry) => entry.id)).toEqual([
      "z-marked",
      "a-untouched"
    ]);
  });

  it("찜을 눌러도(=취소해도) 다섯 탭 어디에서도 담기는 집합이 바뀌지 않는다", () => {
    // 같은 카탈로그에서 한 항목의 상태만 미준비↔찜으로 뒤집는다. 두 상태 모두
    // OPEN_STATUSES라 탭 술어에는 아무 차이도 없어야 한다.
    const asNotPrepared = CATALOG.map((entry) =>
      entry.id === NOW_INTERESTED.id ? { ...entry, status: "not_prepared" as const } : entry
    );

    for (const tab of ["now", "soon", "prepared", "not_needed", "all"] as const) {
      for (const stageBand of [undefined, FUTURE_BAND] as const) {
        const tabContext = { tab, stageCode: CURRENT_STAGE, stageBand };
        expect(
          new Set(rankItemsForTab(asNotPrepared, tabContext).map((entry) => entry.id)),
          `${tab}/${stageBand ?? "밴드 없음"} 탭의 집합`
        ).toEqual(new Set(rankItemsForTab(CATALOG, tabContext).map((entry) => entry.id)));
      }
    }

    // 그런데 now 탭의 **순서**는 갈린다 — 그것이 이 트랙이 고친 결함이다.
    expect(rankItemsForTab(CATALOG, context).map((entry) => entry.id)).not.toEqual(
      rankItemsForTab(asNotPrepared, context).map((entry) => entry.id)
    );
  });

  it("찜은 필수도를 뒤집지 못한다 (부정 단언)", () => {
    const essentialUntouched = item("a-essential", { displayOrder: 500 });
    const convenienceMarked = item("b-convenience", {
      necessityLevel: "convenience",
      status: "interested",
      displayOrder: 1
    });

    expect(
      rankItemsForTab([essentialUntouched, convenienceMarked], context).map((entry) => entry.id)
    ).toEqual(["a-essential", "b-convenience"]);
  });

  /**
   * GAP-072 트랙 D ⓒ — **`priorityWeight`가 오늘 정하는 것**을 값으로 고정한다.
   *
   * `item_template_stages.priority_weight`는 이름과 인덱스
   * (`idx_item_template_stages_stage(stage_code, priority_weight DESC)`)가 "이 시기에 더 급한
   * 준비물"을 약속하지만, 오늘 그 값이 정하는 것은 한 준비템의 `stageCodes` **배열 안 순서**
   * 하나뿐이다(쓰는 쪽이 전부 `stageCodes.length - index`, 읽는 쪽은
   * `items-catalog.service.ts`의 두 `orderBy`뿐 — 선언은 schema.prisma의 주석에 있다).
   * 그 배열 순서가 **항목 간 순위에 닿지 않는다**는 것이 아래 두 단언이다.
   * 마이그레이션 0건 · 값도 인덱스도 무변경.
   */
  it("stageCodes 배열의 순서를 뒤집어도 어느 탭의 집합도 순서도 바뀌지 않는다", () => {
    // priorityWeight가 정하는 유일한 것이 이 배열 순서다 — 순위 경로는 .includes()만 쓴다.
    const reversedStages = CATALOG.map((entry) => ({
      ...entry,
      stageCodes: [...entry.stageCodes].reverse()
    }));

    for (const tab of ["now", "soon", "prepared", "not_needed", "all"] as const) {
      for (const stageBand of [undefined, FUTURE_BAND] as const) {
        const tabContext = { tab, stageCode: CURRENT_STAGE, stageBand };
        expect(
          rankItemsForTab(reversedStages, tabContext).map((entry) => entry.id),
          `${tab}/${stageBand ?? "밴드 없음"}`
        ).toEqual(rankItemsForTab(CATALOG, tabContext).map((entry) => entry.id));
      }
    }
  });

  it("순위 경로(item-ranking · 도메인)는 priorityWeight를 읽지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    for (const path of [
      join(__dirname, "..", "src", "onboarding", "item-ranking.ts"),
      join(__dirname, "..", "..", "..", "packages", "domain", "src", "recommendation.ts")
    ]) {
      const code = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, `${path}가 priorityWeight를 읽어요`).not.toMatch(/priorityWeight/i);
    }
  });

  it("죽은 점수 입력 둘이 이 모듈에서 사라졌다 (되살아나면 빨개진다)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(__dirname, "..", "src", "onboarding", "item-ranking.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    // budgetFits는 여기서 `true` 고정이었다(전 항목 동일 상수 → 순서 기여 0), userInterest는
    // `item.status === "interested"`라 status의 파생 사본이었다(상태 점수와 상쇄).
    expect(code).not.toContain("budgetFits");
    expect(code).not.toContain("userInterest");
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

/**
 * 라운드 51 #9 (DNC-009) — 가격은 추천·정렬에 유입되지 않는다.
 *
 * 이번 라운드에 `product_links.price_snapshot_krw`/`price_checked_at`이 앱 응답에
 * 실리기 시작했다(items-catalog.service.ts toProductLinkDto). 표시용 값이 순위 판단에
 * 스며드는 것은 추천 신뢰를 무너뜨리는 가장 흔한 경로이므로, 여기서 두 방향으로 막는다:
 * (1) 순위 입력에 가격 비슷한 값을 실어도 결과가 한 글자도 달라지지 않는다,
 * (2) 순위 모듈의 소스에 가격이라는 단어가 등장하지 않는다.
 *
 * 서버 e2e 짝: test/product-link-price-honesty.e2e.test.ts(실제 응답의 순서 불변).
 */
describe("DNC-009: 가격은 순위에 유입되지 않는다", () => {
  it("가격처럼 보이는 값을 입력에 실어도 탭·순서 결과가 동일하다", () => {
    // 가장 싼 것을 우대하든 비싼 것을 우대하든 달라지도록, 카탈로그 순서와 반대로 매긴다.
    const priced = CATALOG.map((entry, index) => ({
      ...entry,
      priceSnapshotKrw: (CATALOG.length - index) * 100_000,
      priceCheckedAt: new Date().toISOString(),
      priceMinKrw: index * 1_000,
      priceMaxKrw: index * 2_000
    })) as RankableItem[];

    for (const tab of ["now", "soon", "prepared", "not_needed", "all"] as const) {
      for (const stageBand of [undefined, FUTURE_BAND] as const) {
        const context = { tab, stageCode: CURRENT_STAGE, stageBand };
        expect(rankItemsForTab(priced, context).map((entry) => entry.id)).toEqual(
          rankItemsForTab(CATALOG, context).map((entry) => entry.id)
        );
      }
    }
  });

  it("순위 모듈과 도메인 정렬 함수의 소스에 가격이 등장하지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sources = [
      join(__dirname, "..", "src", "onboarding", "item-ranking.ts"),
      join(__dirname, "..", "..", "..", "packages", "domain", "src", "recommendation.ts")
    ];
    for (const path of sources) {
      const source = readFileSync(path, "utf8");
      // 주석의 "가격·문구 등 표시용 필드는 순서에 영향을 주지 않는다" 같은 서술은 허용하고,
      // 실제 식별자(price…)만 본다.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, `${path}에 가격 식별자가 있어요`).not.toMatch(/price/i);
    }
  });
});
