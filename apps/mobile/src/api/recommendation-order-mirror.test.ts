import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * GAP-072 트랙 D — **서버 랭킹과 데모 거울이 같은 순서를 낸다.**
 *
 * 라운드 72 정찰의 판정: 추천 점수의 다섯 입력 중 둘이 화면의 순서에 도달한 적이 없었다.
 *  - `budgetFits`는 **두 호출부 모두 `true` 고정**이라 전 항목에 같은 10점이 붙었다(기여 0).
 *  - `userInterest`는 두 호출부 모두 `status === "interested"`로 만든 **파생 사본**이었고,
 *    값이 `interested 15 + 5 = not_prepared 20`으로 정확히 상쇄되게 정해져 있었다.
 *    그래서 사용자가 찜을 눌러도 "지금 필요" 목록이 한 칸도 움직이지 않았다.
 *
 * 둘 다 도메인 입력에서 사라졌고 찜 신호는 `status` 한 곳으로 모였다(찜 25 > 미준비 20).
 *
 * **이 파일이 지키는 것은 두 소스가 갈리지 않는다는 사실이다.** 순서를 정하는 코드는 저장소에
 * 두 벌 있다 — 실서버 `apps/api/src/onboarding/item-ranking.ts`와 데모/테스트 세션의
 * `src/api/local-backend.ts`. 한쪽만 입력을 늘리거나 줄이면 **데모에서 본 목록과 실계정에서
 * 본 목록의 순서가 달라진다**(그러면 데모는 앱을 설명하지 못한다). 정찰이 지적한 그 위험이
 * 여기서 값으로 고정된다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 주석을 걷어낸 코드만 본다 — 머리말이 옛 필드 이름을 설명으로 적어 두기 때문이다. */
function codeOf(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** `sortRecommendedItems(` 호출에 실려 가는 객체 리터럴의 키를 순서 없이 모은다. */
function scoreInputKeys(text: string): Set<string> {
  const code = codeOf(text);
  const start = code.indexOf("sortRecommendedItems(");
  expect(start, "sortRecommendedItems 호출을 찾지 못했어요").toBeGreaterThan(-1);
  const end = code.indexOf("\n  );", start);
  expect(end, "sortRecommendedItems 호출의 끝을 찾지 못했어요").toBeGreaterThan(start);

  const call = code.slice(start, end);
  const keys = new Set<string>();
  for (const match of call.matchAll(/^\s*([A-Za-z_]\w*):/gm)) {
    keys.add(match[1]);
  }
  return keys;
}

describe("추천 순서: 서버 ↔ 데모 거울의 점수 입력", () => {
  const serverRanking = () => source("../../apps/api/src/onboarding/item-ranking.ts");
  const demoBackend = () => source("src/api/local-backend.ts");

  it("두 소스가 도메인에 넘기는 점수 입력이 정확히 같다", () => {
    // id는 동점 정렬의 식별자, displayOrder는 서버 쪽 2차 정렬을 위한 운반 값이라
    // 점수 입력이 아니다(도메인은 그 둘로 점수를 계산하지 않는다).
    const carriers = new Set(["id", "displayOrder"]);
    const scoreKeys = (text: string) =>
      [...scoreInputKeys(text)].filter((key) => !carriers.has(key)).sort();

    expect(scoreKeys(demoBackend())).toEqual(scoreKeys(serverRanking()));
    expect(scoreKeys(serverRanking())).toEqual(["necessityLevel", "stageMatches", "status"]);
  });

  it("죽은 입력 둘이 양쪽에서 함께 사라졌다 (한쪽만 되살아나도 빨개진다)", () => {
    for (const [label, text] of [
      ["서버 랭킹", serverRanking()],
      ["데모 거울", demoBackend()]
    ] as const) {
      const code = codeOf(text);
      expect(code, `${label}에 budgetFits가 남아 있어요`).not.toContain("budgetFits");
      expect(code, `${label}에 userInterest가 남아 있어요`).not.toContain("userInterest");
    }
  });

  /**
   * 라운드 72 리뷰 P-1 — **같은 입력 → 같은 id 배열**(파생 단언).
   *
   * 위 셋은 두 소스의 **키 집합**만 맞대 본다(소스 그렙). 그런데 서버 랭킹에는 데모 거울에 없는
   * 꼬리가 하나 더 있다 — `rankItemsForTab`의 마지막 비교자가
   * `leftIndex - rightIndex || left.displayOrder - right.displayOrder`다. 오랫동안 그 자리의
   * 주석은 "동점이면 displayOrder"라고 설명했지만, `rankById`가 항목마다 **유일한 인덱스**를
   * 주므로 앞 항이 0이 되는 경우가 없어 뒤 항은 **영영 실행되지 않는다.** 실제 동점 파괴자는
   * 도메인의 `id.localeCompare`다.
   *
   * 그래서 여기서 값으로 못박는 것은 그 사실이다: **displayOrder를 어떻게 흔들어도** 서버 랭킹의
   * 결과 id 배열이 도메인 정렬(= 데모 거울이 하는 일 전부)의 그것과 같다. 이 단언이 빨개지는
   * 경우는 둘뿐이고 둘 다 알아야 할 일이다 — ⓐ displayOrder가 정말로 순서에 닿기 시작했거나
   * (그러면 데모 거울과 실세션의 목록이 갈린다), ⓑ 도메인의 동점 규칙이 바뀌었거나.
   */
  it("displayOrder를 뒤집어도 서버 랭킹의 id 배열이 도메인 정렬과 같다", async () => {
    const { rankItemsForTab } = await import("../../../../apps/api/src/onboarding/item-ranking");
    const { sortRecommendedItems } = await import("@wooriai/domain");

    // 점수가 정확히 같은 짝을 일부러 만든다(동점이 실제로 생겨야 이 단언이 무언가를 지킨다).
    const items = [
      { id: "c-tie", stageCodes: ["newborn_0_3" as const], necessityLevel: "essential" as const, status: "not_prepared" as const, displayOrder: 1 },
      { id: "a-tie", stageCodes: ["newborn_0_3" as const], necessityLevel: "essential" as const, status: "not_prepared" as const, displayOrder: 2 },
      { id: "b-tie", stageCodes: ["newborn_0_3" as const], necessityLevel: "essential" as const, status: "not_prepared" as const, displayOrder: 3 },
      { id: "d-marked", stageCodes: ["newborn_0_3" as const], necessityLevel: "essential" as const, status: "interested" as const, displayOrder: 9 },
      { id: "e-optional", stageCodes: ["newborn_0_3" as const], necessityLevel: "optional" as const, status: "not_prepared" as const, displayOrder: 0 }
    ];
    // 데모 거울이 하는 일 전부: 도메인 정렬의 결과 순서를 그대로 쓴다(displayOrder 꼬리가 없다).
    const domainOrder = sortRecommendedItems(
      items.map((item) => ({
        id: item.id,
        stageMatches: item.stageCodes.includes("newborn_0_3"),
        necessityLevel: item.necessityLevel,
        status: item.status
      }))
    ).map((entry) => entry.id);

    for (const displayOrders of [
      items.map((item) => item.displayOrder),
      items.map((item) => -item.displayOrder), // 뒤집어도
      items.map(() => 0) // 전부 같아도
    ]) {
      const shuffled = items.map((item, index) => ({ ...item, displayOrder: displayOrders[index] }));
      const serverOrder = rankItemsForTab(shuffled, { tab: "now", stageCode: "newborn_0_3" }).map((item) => item.id);
      expect(serverOrder, `displayOrder=${displayOrders.join(",")}`).toEqual(domainOrder);
    }
    // 찜한 항목이 맨 위고, 그 뒤 동점 셋의 순서를 가른 것은 id다(displayOrder였다면 c → a → b다).
    expect(domainOrder[0]).toBe("d-marked");
    expect(domainOrder.slice(1, 4)).toEqual(["a-tie", "b-tie", "c-tie"]);
  });

  it("DNC-009: 데모 거울도 점수 입력에 금액을 싣지 않는다 (부정 단언)", () => {
    // 순서를 만지는 트랙이라 함께 못박는다 — 가격·수수료는 순위에 유입되지 않는다.
    // (짝: src/items/link-price.test.ts, apps/api/test/item-ranking.test.ts)
    //
    // ⚠️ 라운드 78 리뷰 M-4: 이 자리는 **잘라 낸 구간 위의 부정 단언**인데 두 인덱스가 전부
    // 인라인이라(`const` 이름이 없어) 트랙 E의 스윕 밖에 있었다 — 표식이 사라지면 시작점 -1이
    // 빈 구간을 만들고, **DNC-009 부정 단언이 아무것도 검사하지 않은 채 영원히 초록**이 된다.
    // 형식은 이 파일 위쪽 `scoreInputKeys`가 이미 쓰는 그것과 같다(자르기 전에 실재를 묻는다).
    for (const text of [serverRanking(), demoBackend()]) {
      const code = codeOf(text);
      const callStart = code.indexOf("sortRecommendedItems(");
      expect(callStart, "sortRecommendedItems 호출을 찾지 못했어요").toBeGreaterThan(-1);
      const call = code.slice(callStart);
      const callEnd = call.indexOf("\n  );");
      expect(callEnd, "sortRecommendedItems 호출의 끝을 찾지 못했어요").toBeGreaterThan(0);
      expect(call.slice(0, callEnd)).not.toMatch(/price|krw|commission|budget/i);
    }
  });
});

/**
 * GAP-072 트랙 D — **ITEM-001 픽셀락 캡처 불변의 근거를 값으로 남긴다.**
 *
 * 이 트랙은 순서를 바꾸므로 "캡처 항목의 순서가 바뀌지 않는가"를 먼저 확인해야 했다.
 * ⚠️ 확인 결과: **캡처 대상 데이터에는 찜(`interested`) 항목이 실제로 하나 있다**
 * (`previewItems`의 "네이처러브 기저귀 팬티형"). 그럼에도 캡처는 불변인데, 이유는 상태가
 * 아니라 **경로**다 — 비세션 렌더(`authToken === null`)는 서버 목록을 부르지 않고 화면 안의
 * 리터럴 배열을 **적힌 순서 그대로** 그린다. 즉 그 배열은 `sortRecommendedItems`를 지나지
 * 않으므로 점수가 어떻게 바뀌든 캡처의 세 줄은 같은 순서다. 정찰의 "비세션 픽스처라 캡처
 * 불변" 판정과 일치한다.
 *
 * 이 사실이 깨지는 경우는 하나뿐이다: 비세션 분기가 서버/로컬 목록을 쓰기 시작하는 것.
 * 그래서 그 배선을 여기서 부정 단언으로 묶어 둔다(화면 파일은 **읽기만** 한다).
 */
describe("ITEM-001 캡처: 찜 항목이 있어도 순서 변경에 닿지 않는다", () => {
  const itemsScreen = () => source("app/(tabs)/items.tsx");

  it("캡처 데이터에 찜 항목이 있지만, 비세션 목록은 리터럴 배열을 그대로 그린다", () => {
    const screen = itemsScreen();
    const previewBlock = screen.slice(
      screen.indexOf("const previewItems"),
      screen.indexOf("const previewItems") + screen.slice(screen.indexOf("const previewItems")).indexOf("\n];")
    );

    // 캡처 대상 데이터에 찜이 **있다** — 그래서 이 확인이 필요했다.
    expect(previewBlock).toContain('status: "interested"');

    // 그러나 세션이 없으면 목록은 그 리터럴이고, 정렬을 지나지 않는다.
    expect(screen).toContain("const visibleItems = hasSession ? items.data!.items : previewItems;");
    expect(screen).not.toContain("sortRecommendedItems");
  });
});

describe("추천 순서: 데모 세션에서 찜이 실제로 목록을 움직인다", () => {
  beforeEach(async () => {
    const localBackend = await import("./local-backend");
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("찜한 항목이 같은 필수도의 미준비 항목보다 위로 온다", async () => {
    const { listItems, updateItemStatus } = await import("./local-backend");
    const { LOCAL_CHILD_ID } = await import("./local-fixtures");

    const before = listItems(LOCAL_CHILD_ID, "now").items;
    expect(before.length).toBeGreaterThanOrEqual(2);
    // 데모 카탈로그의 "지금 필요" 앞 두 줄은 필수도가 같아 동점이고, 그래서 순서를 가르는
    // 것은 id뿐이다 — 찜 하나가 그 순서를 이길 수 있어야 한다.
    expect(before[1].necessityLevel).toBe(before[0].necessityLevel);
    const target = before[1];

    updateItemStatus(LOCAL_CHILD_ID, target.id, "interested");
    const after = listItems(LOCAL_CHILD_ID, "now").items;

    // ⚠️ 라운드 72 이전에는 이 줄이 통과하지 못했다(점수가 정확히 동점이었다).
    expect(after[0].id).toBe(target.id);
    expect(after[0].status).toBe("interested");
  });

  it("담기는 집합은 다섯 탭 어디에서도 바뀌지 않는다 (순서만 바뀐다)", async () => {
    const { listItems, updateItemStatus } = await import("./local-backend");
    const { LOCAL_CHILD_ID } = await import("./local-fixtures");

    const tabs = ["now", "soon", "prepared", "not_needed", "all"] as const;
    const snapshot = () =>
      Object.fromEntries(
        tabs.map((tab) => [tab, new Set(listItems(LOCAL_CHILD_ID, tab).items.map((item) => item.id))])
      );

    const before = snapshot();
    const target = listItems(LOCAL_CHILD_ID, "now").items[1];
    updateItemStatus(LOCAL_CHILD_ID, target.id, "interested");

    expect(snapshot()).toEqual(before);
  });

  it("찜을 취소하면 순서가 그대로 되돌아온다", async () => {
    const { listItems, updateItemStatus } = await import("./local-backend");
    const { LOCAL_CHILD_ID } = await import("./local-fixtures");

    const before = listItems(LOCAL_CHILD_ID, "now").items.map((item) => item.id);
    const target = before[1];

    updateItemStatus(LOCAL_CHILD_ID, target, "interested");
    expect(listItems(LOCAL_CHILD_ID, "now").items.map((item) => item.id)).not.toEqual(before);

    updateItemStatus(LOCAL_CHILD_ID, target, "not_prepared");
    expect(listItems(LOCAL_CHILD_ID, "now").items.map((item) => item.id)).toEqual(before);
  });
});
