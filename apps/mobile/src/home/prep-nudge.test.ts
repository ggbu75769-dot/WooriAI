import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { itemStatusBadgeLabel } from "../items/item-labels";
import { isResolvedItemStatus } from "../items/prep-progress";
import {
  evaluateHomePrepNudge,
  selectPrepNudgeItems,
  HOME_PREP_NUDGE_CTA_LABEL,
  HOME_PREP_NUDGE_INTERESTED_TITLE,
  HOME_PREP_NUDGE_MAX_ITEMS,
  HOME_PREP_NUDGE_RECOMMENDED_TITLE,
  HOME_PREP_NUDGE_ROUTE,
  HOME_PREP_NUDGE_TEST_ID,
  type HomePrepNudgeInput,
  type PrepNudgeRecommendedItem
} from "./prep-nudge";

/**
 * 라운드 51 #6 — 홈 준비템 카드의 판정·문구 계약.
 *
 * 화면(app/(tabs)/index.tsx)은 react-native 네이티브 바인딩 때문에 vitest에서 렌더할 수 없으므로,
 * 판정은 순수 모듈로 전부 고정하고 화면 쪽은 소스 계약(grep)으로 잡는다 --
 * home-cold-start-defer.test.ts / budget-warning.test.ts와 같은 관례다.
 */

const item = (
  id: string,
  name: string,
  status: PrepNudgeRecommendedItem["status"] = "not_prepared"
): PrepNudgeRecommendedItem => ({ id, name, status });

function input(overrides: Partial<HomePrepNudgeInput> = {}): HomePrepNudgeInput {
  return {
    hasSession: true,
    recommendedItems: [item("i1", "네이처러브 기저귀 팬티형"), item("i2", "베이비 아기띠 힙시트")],
    guideVariant: null,
    ...overrides
  };
}

describe("라운드 51 #6 evaluateHomePrepNudge -- 만들지 않는 경우", () => {
  it("비세션 미리보기에서는 절대 만들지 않는다(HOME-001 픽셀락 불변)", () => {
    expect(evaluateHomePrepNudge(input({ hasSession: false }))).toBeNull();
  });

  it("추천 배열을 아직 모르면 만들지 않는다(응답 전 · 필드 없음)", () => {
    expect(evaluateHomePrepNudge(input({ recommendedItems: null }))).toBeNull();
    expect(evaluateHomePrepNudge(input({ recommendedItems: undefined }))).toBeNull();
    expect(evaluateHomePrepNudge(input({ recommendedItems: [] }))).toBeNull();
  });

  it("첫 실행 안내 카드가 준비템을 말하고 있으면 접는다(같은 말 반복 금지)", () => {
    expect(evaluateHomePrepNudge(input({ guideVariant: "first-items" }))).toBeNull();
  });

  it("빈 홈의 안내 카드가 떠 있어도 접는다 -- 다음 한 걸음은 하나만(DNC-002)", () => {
    // first-expense / view-only는 준비템을 말하지는 않지만, 그 자리는 "빈 홈의 유일한 CTA"라는
    // 규율이 걸린 자리다(src/home/first-run-guide.ts 헤더). 두 번째 큰 CTA를 세우지 않는다.
    expect(evaluateHomePrepNudge(input({ guideVariant: "first-expense" }))).toBeNull();
    expect(evaluateHomePrepNudge(input({ guideVariant: "view-only" }))).toBeNull();
  });

  it("이미 해결된 준비템만 남으면 만들지 않는다(준비템 탭의 '모두 마쳤어요'와 어긋나지 않게)", () => {
    const resolved = [
      item("i1", "젖병 소독기", "prepared"),
      item("i2", "아기 욕조", "gifted"),
      item("i3", "분유 포트", "not_needed")
    ];
    expect(resolved.every((entry) => isResolvedItemStatus(entry.status as never))).toBe(true);
    expect(evaluateHomePrepNudge(input({ recommendedItems: resolved }))).toBeNull();
  });

  it("이름이 없는 항목만 오면 만들지 않는다(이름 없는 줄을 그리지 않는다)", () => {
    expect(
      evaluateHomePrepNudge(
        input({ recommendedItems: [item("i1", "   "), { id: "i2", name: undefined as never, status: "not_prepared" }] })
      )
    ).toBeNull();
  });
});

describe("라운드 51 #6 evaluateHomePrepNudge -- recommended 갈래", () => {
  it("아직 준비 전인 추천 이름을 서버 순서 그대로 말한다", () => {
    const nudge = evaluateHomePrepNudge(input());
    expect(nudge).not.toBeNull();
    expect(nudge!.variant).toBe("recommended");
    expect(nudge!.title).toBe(HOME_PREP_NUDGE_RECOMMENDED_TITLE);
    expect(nudge!.subtitle).toBe("네이처러브 기저귀 팬티형 · 베이비 아기띠 힙시트");
    expect(nudge!.items.map((entry) => entry.id)).toEqual(["i1", "i2"]);
    expect(nudge!.ctaLabel).toBe(HOME_PREP_NUDGE_CTA_LABEL);
    expect(nudge!.route).toBe(HOME_PREP_NUDGE_ROUTE);
    expect(nudge!.testID).toBe(HOME_PREP_NUDGE_TEST_ID);
  });

  it("제목에 개수를 넣지 않는다 -- 서버가 3건으로 자른 일부라 총량으로 읽히면 허위다", () => {
    const one = evaluateHomePrepNudge(input({ recommendedItems: [item("i1", "기저귀")] }));
    const two = evaluateHomePrepNudge(input());
    expect(one!.title).toBe(two!.title);
    expect(one!.title).not.toMatch(/\d/);
  });

  it("준비 전(not_prepared)에는 상태 배지를 붙이지 않는다(item-labels의 판단 그대로)", () => {
    const nudge = evaluateHomePrepNudge(input());
    expect(nudge!.items.every((entry) => entry.statusLabel === undefined)).toBe(true);
    expect(itemStatusBadgeLabel("not_prepared")).toBeUndefined();
  });

  it("서버 랭킹을 재정렬하지 않는다(DNC-009 무접촉 -- 점수를 읽지도 만들지도 않는다)", () => {
    const ordered = [item("i3", "C"), item("i1", "A"), item("i2", "B")];
    expect(evaluateHomePrepNudge(input({ recommendedItems: ordered }))!.items.map((entry) => entry.name)).toEqual([
      "C",
      "A",
      "B"
    ]);
  });
});

describe("라운드 51 #6 evaluateHomePrepNudge -- interested(찜) 재발견 갈래", () => {
  const withInterested = [
    item("i1", "베이비 아기띠 힙시트", "interested"),
    item("i2", "네이처러브 기저귀 팬티형")
  ];

  it("관심 표시한 항목이 하나라도 있으면 그 사실을 제목이 말한다", () => {
    const nudge = evaluateHomePrepNudge(input({ recommendedItems: withInterested }));
    expect(nudge!.variant).toBe("interested");
    expect(nudge!.title).toBe(HOME_PREP_NUDGE_INTERESTED_TITLE);
  });

  it("상태 라벨은 준비템 목록·상세와 같은 단일 소스에서 온다(item-labels)", () => {
    const nudge = evaluateHomePrepNudge(input({ recommendedItems: withInterested }));
    expect(nudge!.items[0].statusLabel).toBe(itemStatusBadgeLabel("interested"));
    expect(nudge!.items[0].statusLabel).toBe("관심");
    expect(nudge!.subtitle).toBe("베이비 아기띠 힙시트(관심)");
  });

  /**
   * 라운드 51 QA(P3-12): 제목이 "관심 표시해 둔 준비템"을 말하면 줄에 서는 것도 관심 항목뿐이어야
   * 한다. 예전에는 관심이 하나만 있어도 제목이 바뀌고 목록에는 관심이 아닌 추천까지 함께 서서,
   * 표시한 적 없는 항목까지 찜한 것처럼 읽혔다.
   */
  it("찜 갈래의 목록에는 관심 항목만 선다(제목이 말하지 않은 항목을 끼우지 않는다)", () => {
    const nudge = evaluateHomePrepNudge(input({ recommendedItems: withInterested }));
    expect(nudge!.items.map((entry) => entry.id)).toEqual(["i1"]);
    expect(nudge!.items.every((entry) => entry.statusLabel === itemStatusBadgeLabel("interested"))).toBe(true);
    expect(nudge!.subtitle).not.toContain("네이처러브 기저귀 팬티형");
  });

  it("관심 항목이 여럿이면 서버 순서 그대로 함께 말한다", () => {
    const twoInterested = [
      item("i1", "베이비 아기띠 힙시트", "interested"),
      item("i2", "네이처러브 기저귀 팬티형"),
      item("i3", "젖병 소독기", "interested")
    ];
    const nudge = evaluateHomePrepNudge(input({ recommendedItems: twoInterested }));
    expect(nudge!.items.map((entry) => entry.id)).toEqual(["i1", "i3"]);
    expect(nudge!.subtitle).toBe("베이비 아기띠 힙시트(관심) · 젖병 소독기(관심)");
  });

  it("소리용 문장은 쉼표로 잇는다(가운뎃점은 스크린리더에서 경계로 읽히지 않는다)", () => {
    const nudge = evaluateHomePrepNudge(input({ recommendedItems: withInterested }));
    expect(nudge!.accessibilityLabel).toBe(
      `${HOME_PREP_NUDGE_INTERESTED_TITLE}. 베이비 아기띠 힙시트 관심. ${HOME_PREP_NUDGE_CTA_LABEL}`
    );
  });
});

describe("라운드 51 #6 selectPrepNudgeItems -- 목록 정리 규칙", () => {
  it("최대 3건까지만 고른다", () => {
    const many = [item("i1", "A"), item("i2", "B"), item("i3", "C"), item("i4", "D")];
    expect(selectPrepNudgeItems(many)).toHaveLength(HOME_PREP_NUDGE_MAX_ITEMS);
    expect(selectPrepNudgeItems(many).map((entry) => entry.name)).toEqual(["A", "B", "C"]);
  });

  it("해결된 항목은 건너뛰고 그 자리를 미해결 항목이 채운다", () => {
    const mixed = [
      item("i1", "이미 준비", "prepared"),
      item("i2", "A"),
      item("i3", "선물 받음", "gifted"),
      item("i4", "B")
    ];
    expect(selectPrepNudgeItems(mixed).map((entry) => entry.name)).toEqual(["A", "B"]);
  });

  it("같은 id가 두 번 오면 첫 번째만 남긴다(같은 이름을 두 번 부르지 않는다)", () => {
    expect(selectPrepNudgeItems([item("i1", "A"), item("i1", "A 다시"), item("i2", "B")])).toEqual([
      { id: "i1", name: "A" },
      { id: "i2", name: "B" }
    ]);
  });

  it("이름 앞뒤 공백은 다듬고, id가 없는 행은 버린다", () => {
    expect(selectPrepNudgeItems([item("i1", "  기저귀  "), { id: "", name: "A", status: "not_prepared" }])).toEqual([
      { id: "i1", name: "기저귀" }
    ]);
  });

  it("낯선 상태 문자열은 '아직 준비 안 됨'으로 통과시키되 배지를 지어내지 않는다", () => {
    // 로컬 백엔드(데모/테스트 세션)가 좁혀지지 않은 문자열을 넣을 수 있다. isResolvedItemStatus는
    // 낯선 값을 미해결로 떨어뜨리므로 항목은 살아 있고, 라벨은 붙이지 않는다 -- itemStatusLabel의
    // 기본값("준비 전")을 그대로 쓰면 홈이 확인한 적 없는 상태를 배지로 단언하게 된다.
    const selected = selectPrepNudgeItems([item("i1", "기저귀", "browsing")]);
    expect(selected).toEqual([{ id: "i1", name: "기저귀" }]);
  });
});

describe("라운드 51 #6 홈 화면 배선 계약", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("판정은 순수 모듈이 하고, 화면은 이미 받은 /home 응답만 읽는다(추가 요청 0)", () => {
    expect(homeSource).toContain("const prepNudge = evaluateHomePrepNudge({");
    // 라운드 51 QA(P2-2): 넘기는 배열은 /home 응답에 **대기 중인 상태 변경**을 얹은 것이다.
    // 요청은 여전히 0건 늘어난다 -- 값의 출처는 홈이 이미 구독 중인 오프라인 스냅샷이다.
    expect(homeSource).toContain("recommendedItems: recommendedItemsWithPendingStatus");
    expect(homeSource).toContain("const items = home.data?.recommendedItems ?? null;");
    expect(homeSource).toContain("buildPendingItemStatusIndex(offlineSyncSnapshot.itemStatusRows, childId)");
    expect(homeSource).toContain("effectiveItemStatus(item.status, pending)");
    // 준비템 탭의 캐시를 새로 켜지 않는다 -- 홈의 쿼리 수는 종전 그대로 5개다
    // (home / 이번 달 지출 / 지난달 지출 / 지난달 예산 / children).
    expect(homeSource).not.toContain('queryKey: ["items"');
    expect(homeSource.match(/useQuery\(\{/g) ?? []).toHaveLength(5);
  });

  it("첫 실행 안내 카드와 상호 배타 -- 화면이 게이트를 다시 짐작하지 않는다", () => {
    expect(homeSource).toContain("guideVariant: firstRunGuide?.variant ?? null");
  });

  /**
   * DSN-053 P2-A — 이 넛지는 이제 **자기 카드**를 갖지 않는다. 승인 캡처의 홈에는 준비템
   * 이야기를 할 자리가 ④ "이번 주 준비 현황" 카드 **하나**뿐이라, 첫 실행 안내(first-items)·
   * 이 넛지·캡처 기본 문구 중 무엇을 말할지 순수 모듈 하나가 고르고(resolveHomePrepCard) 화면은
   * 고른 값만 그린다. 판정 입력(위 계약)은 그대로이고, 달라진 것은 출력이 서는 자리다.
   */
  it("넛지 문구는 준비 현황 카드 한 자리에서만 나온다(같은 말을 두 카드가 반복하지 않는다)", () => {
    expect(homeSource).toContain("const prepCard = resolveHomePrepCard({");
    expect(homeSource).toContain("prepNudge,");
    expect(homeSource).toContain("testID={prepCard.testID}");
    expect(homeSource).toContain("accessibilityLabel={prepCard.accessibilityLabel}");
    expect(homeSource).toContain("router.push(prepCard.route)");
    expect(homeSource).toContain("{prepCard.title}");
    expect(homeSource).toContain("{prepCard.subtitle}");
    expect(homeSource).toContain("{prepCard.ctaLabel}");
    // 예전처럼 넛지 전용 카드를 따로 세우지 않는다.
    expect(homeSource).not.toContain("testID={prepNudge.testID}");
  });

  it("자리는 자주 기록해요 칩과 최근 기록 사이다(루프 순서: 총액 확인 다음이 준비템)", () => {
    const sessionRender = homeSource.slice(homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)"));
    const hero = sessionRender.indexOf('testID="home-hero-summary"');
    const chips = sessionRender.indexOf("HOME_QUICK_RECORD_SECTION_TITLE}");
    const prep = sessionRender.indexOf("testID={prepCard.testID}");
    const recent = sessionRender.indexOf("최근 기록\n");
    expect(hero).toBeGreaterThan(-1);
    expect(chips).toBeGreaterThan(hero);
    expect(prep).toBeGreaterThan(chips);
    expect(recent).toBeGreaterThan(prep);
  });

  it("커머스 표면이 아니다 -- 카드에 가격도 구매 링크도 없다(DNC-010/011은 준비템 탭 몫)", () => {
    const start = homeSource.indexOf("{prepCard ? (");
    const card = homeSource.slice(start, homeSource.indexOf("{showRecentExpensesSection ? (", start));
    expect(start).toBeGreaterThan(-1);
    expect(card).not.toContain("formatKrw");
    expect(card).not.toContain("productLink");
    expect(card).not.toContain("Linking");
  });
});
