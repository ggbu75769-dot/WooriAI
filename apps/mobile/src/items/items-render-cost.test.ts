import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ChildStageCode } from "@wooriai/domain";
import type { ItemSummary } from "../api/client";
import type { ItemStatusOutboxRow } from "../offline/types";
import { buildCategoryNameLookup, buildTileCategoryResolver } from "../categories";
import { expenseCategoryVisual } from "../preparation/item-visuals";
import { resolvePreparationTimelineBucket, toPreparationParityItem } from "../preparation/catalog-contract";
import { buildPendingItemStatusIndex, effectiveItemStatus, pendingItemStatusView } from "./pending-status";
import { applyPreBirthFilter } from "./pre-birth-filter";
import { filterInterestedItems, filterItems, type NecessityFilter } from "./item-filters";
import type { StageBandLabel } from "./stage-bands";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 105 트랙 ITEMS(라운드 104 정찰 C **#4** · 스카우트 A **F6**) — **준비템 탭의 렌더 비용.**
 *
 * ## 무엇이 문제였나 (정찰이 값으로 세어 둔 것)
 * `grep -c useMemo`가 준비템 탭에서 **0**이었다. 그래서
 *  ① 렌더마다 카탈로그(시드 62행 — `apps/api/prisma/seed-data.ts`의 `itemTemplateSeeds`)를
 *    **열네 번** 훑었고,
 *  ② 매 렌더 새로 만든 `parityItems`·`categoryGroups`가 자식(`PreparationListParity`)의
 *    `useMemo` **둘**을 한 번도 적중시키지 못했다. 그 둘의 의존성이 정확히 이 두 배열의
 *    **참조**이기 때문이다(`[categoryGroups, items, minimumGroupSize]` · `[items, minimumGroupSize]`).
 *    그룹이 12개면 `categories` 하나만으로 12 × 62 = 744회 추가 방문이다.
 *  ③ 상태 체크("준비했어요") 한 번이 최소 3렌더라(`setStatusErrorMessage(null)` ·
 *    `setExpenseLinkPrompt(null)` · 스냅숏 알림) 한 번 누를 때마다 위가 3회 돌았다.
 *
 * ## 이 파일이 무는 것 — **값으로**
 * 화면은 vitest에서 렌더할 수 없다(react-native 네이티브 바인딩도, react 테스트 렌더러도 이
 * 트리에 없다 — src/preparation/preparation-restore.test.ts 머리말). 그래서 여기서는 **소스 계약
 * 하나로 끝내지 않고**, React의 `useMemo`와 **같은 비교 규칙**(Object.is · 길이)만 가진 최소 대역
 * 위에서 화면의 파생 사슬을 **실제 순수 모듈로 재생**해 다음을 값으로 확인한다.
 *  ⓐ 입력이 그대로면 파생이 **다시 계산되지 않는다**(실행 횟수 · 산출 배열의 참조 동일성);
 *  ⓑ 입력이 바뀌면 **그 입력을 읽는 파생만** 다시 계산된다;
 *  ⓒ 자식의 두 `useMemo`가 **적중한다**(라운드 104 정찰이 "한 번도 적중하지 않는다"고 센 그 둘);
 *  ⓓ **통제군**: 같은 사슬을 메모 없이 돌리면 같은 렌더 수에서 실행 횟수가 정확히 배수로 늘고
 *    참조도 매번 달라진다 — 그물이 실제로 무언가를 잡는다는 확인이다(라운드 78 관례).
 *
 * ⚠️ **양쪽 끝.** 위 재생이 화면과 어긋나면 이 파일은 자기 자신만 검사하게 된다. 그래서 마지막
 * describe가 화면(`app/(tabs)/items.tsx`)과 자식(`src/preparation/PreparationListParity.tsx`)이
 * 오늘 선언하고 있는 **의존성 배열 전수**를 같은 값으로 문다.
 */

// ---------------------------------------------------------------------------------------------
// 최소 대역: React useMemo의 비교 규칙만 가진 런타임(렌더 순서대로 셀을 읽는다).
// ---------------------------------------------------------------------------------------------

type MemoCell = { deps: readonly unknown[]; value: unknown };

function createMemoRuntime(memoized: boolean) {
  const cells: MemoCell[] = [];
  let cursor = 0;
  return {
    beginRender() {
      cursor = 0;
    },
    useMemo<T>(factory: () => T, deps: readonly unknown[]): T {
      const index = cursor;
      cursor += 1;
      if (!memoized) return factory();
      const cell = cells[index];
      if (cell && cell.deps.length === deps.length && cell.deps.every((dep, i) => Object.is(dep, deps[i]))) {
        return cell.value as T;
      }
      const value = factory();
      cells[index] = { deps, value };
      return value;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// 픽스처: 시드와 같은 크기(62행)의 카탈로그.
// ---------------------------------------------------------------------------------------------

const CATALOG_SIZE = 62;
/** 분류 축은 서버 분류 id다(화면의 groupKeyOf가 그 id로 이름을 만든다). */
const serverCategoryFixture = Array.from({ length: 8 }, (_, index) => ({
  id: `cat-${index}`,
  name: `분류 ${index}`,
  // 타일 해석기(buildTileCategoryResolver)가 읽는 축 -- 이름 조립기와 같은 응답 한 벌이다.
  code: `code_${index}`
}));
const statusCycle: ItemSummary["status"][] = ["not_prepared", "interested", "prepared", "gifted", "not_needed"];
const necessityCycle: ItemSummary["necessityLevel"][] = ["essential", "convenience", "optional"];
const stageCycle: ChildStageCode[][] = [
  ["pregnancy_late"],
  ["newborn_0_3"],
  ["infant_7_12"],
  ["toddler_1_3"],
  ["kid_4_7"]
];

function catalogFixture(): ItemSummary[] {
  return Array.from({ length: CATALOG_SIZE }, (_, index) => ({
    id: `item-${index}`,
    name: `준비물 ${index}`,
    necessityLevel: necessityCycle[index % necessityCycle.length],
    status: statusCycle[index % statusCycle.length],
    categoryId: serverCategoryFixture[index % serverCategoryFixture.length].id,
    timingLabel: "12-24개월",
    stageCodes: stageCycle[index % stageCycle.length]
  }));
}

function outboxRow(itemTemplateId: string): ItemStatusOutboxRow {
  return {
    mutationId: `m-${itemTemplateId}`,
    childId: "child-1",
    itemTemplateId,
    status: "prepared",
    itemName: itemTemplateId,
    syncState: "pending",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z"
  };
}

// ---------------------------------------------------------------------------------------------
// 화면의 파생 사슬 재생 — 순수 모듈은 **진짜 그 모듈**을 부른다.
// ---------------------------------------------------------------------------------------------

type ScreenInput = {
  hasSession: boolean;
  childId: string | null;
  /** react-query 캐시 객체 자리 — 재조회 전에는 참조가 그대로다(그래서 입력으로 들고 다닌다). */
  itemsData: { items: ItemSummary[] } | undefined;
  outboxRows: ItemStatusOutboxRow[];
  serverCategories: Array<{ id: string; name: string; code: string }> | undefined;
  showInterestedOnly: boolean;
  necessityFilter: NecessityFilter;
  searchText: string;
  preBirthFilterActive: boolean;
  stageLabel: StageBandLabel;
};

type Runs = Record<
  | "pendingStatusIndex"
  | "effectiveStatusItems"
  | "sourceItems"
  | "categoryNameOf"
  | "itemFilterInput"
  | "listedItems"
  | "sessionRows"
  | "resolveTileCategory"
  | "categoryGroups"
  | "parityItems"
  | "childCategories"
  | "childTimingBands",
  number
>;

function emptyRuns(): Runs {
  return {
    pendingStatusIndex: 0,
    effectiveStatusItems: 0,
    sourceItems: 0,
    categoryNameOf: 0,
    itemFilterInput: 0,
    listedItems: 0,
    sessionRows: 0,
    resolveTileCategory: 0,
    categoryGroups: 0,
    parityItems: 0,
    childCategories: 0,
    childTimingBands: 0
  };
}

const UNCATEGORIZED_GROUP_ID = "uncategorized";
const UNCATEGORIZED_GROUP_NAME = "분류 없음";
const MINIMUM_GROUP_SIZE = 1;

type RenderResult = {
  listedItems: ItemSummary[];
  categoryGroups: Array<{ id: string; name: string }>;
  parityItems: ReturnType<typeof toPreparationParityItem>[];
  childCategories: unknown;
  childTimingBands: unknown;
  /** 이 렌더에서 항목을 몇 번 들여다봤는가(사슬이 스스로 도는 자리만 센다). */
  itemVisits: number;
};

function renderPreparationTab(
  runtime: ReturnType<typeof createMemoRuntime>,
  input: ScreenInput,
  runs: Runs
): RenderResult {
  runtime.beginRender();
  const memo = runtime.useMemo;
  let itemVisits = 0;

  const pendingStatusIndex = memo(() => {
    runs.pendingStatusIndex += 1;
    return buildPendingItemStatusIndex(input.outboxRows, input.childId);
  }, [input.childId, input.outboxRows]);

  const catalogItems = input.itemsData?.items;
  const effectiveStatusItems = memo(() => {
    runs.effectiveStatusItems += 1;
    if (!input.hasSession || !catalogItems) return [];
    return catalogItems.map((item) => {
      itemVisits += 1;
      const pendingStatusRow = pendingStatusIndex.get(item.id);
      return pendingStatusRow
        ? { ...item, status: effectiveItemStatus(item.status, pendingStatusRow) as ItemSummary["status"] }
        : item;
    });
  }, [input.hasSession, input.itemsData, pendingStatusIndex]);

  const sourceItems = memo(() => {
    runs.sourceItems += 1;
    return input.hasSession && input.showInterestedOnly
      ? filterInterestedItems(effectiveStatusItems)
      : effectiveStatusItems;
  }, [effectiveStatusItems, input.hasSession, input.showInterestedOnly]);

  const categoryNameOf = memo(() => {
    runs.categoryNameOf += 1;
    return buildCategoryNameLookup(input.serverCategories);
  }, [input.serverCategories]);

  // 화면과 같이 **memo가 아니다** — categoryNameOf의 순수 껍데기라 의존성에는 그 값이 선다.
  const groupKeyOf = (item: ItemSummary) =>
    item.categoryId ? categoryNameOf(item.categoryId) : UNCATEGORIZED_GROUP_NAME;

  const itemFilterInput = memo(() => {
    runs.itemFilterInput += 1;
    return { necessity: input.necessityFilter, searchText: input.searchText, categoryNameOf: groupKeyOf };
  }, [categoryNameOf, input.necessityFilter, input.searchText]);

  const listedItems = memo(() => {
    runs.listedItems += 1;
    return input.hasSession
      ? applyPreBirthFilter(filterItems(sourceItems, itemFilterInput), input.preBirthFilterActive)
      : effectiveStatusItems;
  }, [effectiveStatusItems, input.hasSession, itemFilterInput, input.preBirthFilterActive, sourceItems]);

  const sessionRows = memo(() => {
    runs.sessionRows += 1;
    return listedItems.map((item) => {
      itemVisits += 1;
      return { item, rowItem: item, pendingStatus: pendingItemStatusView(pendingStatusIndex.get(item.id)) };
    });
  }, [listedItems, pendingStatusIndex]);

  const resolveTileCategory = memo(() => {
    runs.resolveTileCategory += 1;
    return buildTileCategoryResolver(input.serverCategories);
  }, [input.serverCategories]);

  const categoryGroups = memo(() => {
    runs.categoryGroups += 1;
    const groups: Array<{ id: string; name: string }> = [];
    const seenGroupIds = new Set<string>();
    for (const { item } of sessionRows) {
      itemVisits += 1;
      const groupId = groupKeyOf(item);
      if (seenGroupIds.has(groupId)) continue;
      seenGroupIds.add(groupId);
      const visual = expenseCategoryVisual(
        (item.categoryId ? resolveTileCategory(item.categoryId).tileCategoryId : null) ?? UNCATEGORIZED_GROUP_ID
      );
      groups.push({ id: groupId, name: groupId, ...visual });
    }
    return groups;
  }, [categoryNameOf, resolveTileCategory, sessionRows]);

  const parityItems = memo(() => {
    runs.parityItems += 1;
    return sessionRows.map(({ rowItem }) => {
      itemVisits += 1;
      return {
        ...toPreparationParityItem(rowItem, {
          timelineBucket: resolvePreparationTimelineBucket(rowItem, input.stageLabel)
        }),
        groupId: groupKeyOf(rowItem)
      };
    });
  }, [categoryNameOf, sessionRows, input.stageLabel]);

  // ── 자식(PreparationListParity)의 두 memo — 의존성은 그 파일이 선언한 그대로다. ──────────
  const childCategories = memo(() => {
    runs.childCategories += 1;
    return categoryGroups
      .map((group) => ({
        ...group,
        items: parityItems.filter((item) => {
          itemVisits += 1;
          return item.groupId === group.id;
        })
      }))
      .filter((group) => group.items.length >= MINIMUM_GROUP_SIZE);
  }, [categoryGroups, parityItems, MINIMUM_GROUP_SIZE]);

  const childTimingBands = memo(() => {
    runs.childTimingBands += 1;
    return parityItems.filter((item) => {
      itemVisits += 1;
      return Boolean(item.timelineBucket);
    });
  }, [parityItems, MINIMUM_GROUP_SIZE]);

  return { listedItems, categoryGroups, parityItems, childCategories, childTimingBands, itemVisits };
}

function baseInput(): ScreenInput {
  return {
    hasSession: true,
    childId: "child-1",
    itemsData: { items: catalogFixture() },
    outboxRows: [],
    serverCategories: serverCategoryFixture,
    showInterestedOnly: false,
    necessityFilter: "all",
    searchText: "",
    preBirthFilterActive: false,
    stageLabel: "12-24개월"
  };
}

describe("라운드 105 F6 — 준비템 탭 파생의 재계산 (값)", () => {
  it("전제: 픽스처가 시드와 같은 크기이고, 사슬이 실제로 목록을 훑는다", () => {
    const runtime = createMemoRuntime(true);
    const runs = emptyRuns();
    const first = renderPreparationTab(runtime, baseInput(), runs);
    expect(first.listedItems).toHaveLength(CATALOG_SIZE);
    expect(CATALOG_SIZE).toBe(62);
    // 첫 렌더는 당연히 전부 돈다 — 이 계약이 재는 것은 **그다음** 렌더다.
    expect(Object.values(runs).every((count) => count === 1)).toBe(true);
    // 실측 806 = 사슬이 스스로 도는 다섯 자리(62 × 5 = 310) + 자식의 분류 memo(8그룹 × 62 = 496).
    // 정찰이 센 "그룹 12개면 744"와 같은 축이다 — 이 픽스처는 그룹이 8개다.
    expect(first.itemVisits).toBe(806);
  });

  it("ⓐ 입력이 그대로면 파생이 다시 계산되지 않는다 (실행 0회 · 참조 동일)", () => {
    const runtime = createMemoRuntime(true);
    const runs = emptyRuns();
    const input = baseInput();
    const first = renderPreparationTab(runtime, input, runs);
    const afterFirst = { ...runs };

    // 상태 체크 한 번이 만드는 setState 렌더들(입력은 한 칸도 바뀌지 않는다).
    const second = renderPreparationTab(runtime, input, runs);
    const third = renderPreparationTab(runtime, input, runs);

    expect(runs).toEqual(afterFirst);
    expect(Object.values(runs)).toEqual(Object.values(afterFirst).map(() => 1));
    expect(second.itemVisits).toBe(0);
    expect(third.itemVisits).toBe(0);
    // 참조 동일성 — 자식이 `React.memo`가 아니어도 그 안의 useMemo가 적중하는 근거다.
    expect(second.parityItems).toBe(first.parityItems);
    expect(second.categoryGroups).toBe(first.categoryGroups);
    expect(third.parityItems).toBe(first.parityItems);
    expect(second.childCategories).toBe(first.childCategories);
    expect(second.childTimingBands).toBe(first.childTimingBands);
  });

  it("ⓑ 입력이 바뀌면 그 입력을 읽는 파생만 다시 계산된다", () => {
    const runtime = createMemoRuntime(true);
    const runs = emptyRuns();
    const input = baseInput();
    renderPreparationTab(runtime, input, runs);

    // 검색어 — 필터 입력부터 아래로만 다시 돈다(보정 목록·찜 범위·분류 이름은 그대로).
    const searched = renderPreparationTab(runtime, { ...input, searchText: "준비물 1" }, runs);
    expect(runs.effectiveStatusItems).toBe(1);
    expect(runs.sourceItems).toBe(1);
    expect(runs.categoryNameOf).toBe(1);
    expect(runs.itemFilterInput).toBe(2);
    expect(runs.listedItems).toBe(2);
    expect(runs.parityItems).toBe(2);
    expect(searched.listedItems.length).toBeLessThan(CATALOG_SIZE);

    // 시기 칩 — 목록 자체는 그대로이고(버킷만 다시 붙는다) 타일 조립만 다시 돈다.
    const restored = { ...input, searchText: "" };
    renderPreparationTab(runtime, restored, runs);
    const listedAfterRestore = runs.listedItems;
    const groupsAfterRestore = runs.categoryGroups;
    renderPreparationTab(runtime, { ...restored, stageLabel: "24개월+" }, runs);
    expect(runs.listedItems).toBe(listedAfterRestore);
    expect(runs.listedItems).toBe(3);
    expect(runs.sessionRows).toBe(3);
    expect(runs.categoryGroups).toBe(groupsAfterRestore);
    expect(runs.categoryGroups).toBe(3);
    expect(runs.parityItems).toBe(4);
  });

  it("ⓒ 상태 체크: 큐가 실제로 바뀐 렌더에서만 사슬이 다시 돈다 (setState 렌더는 통과)", () => {
    const runtime = createMemoRuntime(true);
    const runs = emptyRuns();
    const input = baseInput();
    renderPreparationTab(runtime, input, runs);
    // ① setStatusErrorMessage(null) ② setExpenseLinkPrompt(null) — 파생 입력은 그대로다.
    renderPreparationTab(runtime, input, runs);
    renderPreparationTab(runtime, input, runs);
    expect(runs.effectiveStatusItems).toBe(1);
    // ③ 오프라인 스냅숏 알림 — 큐가 실제로 바뀐 렌더다(useSyncExternalStore가 새 배열을 준다).
    const withQueued = renderPreparationTab(
      runtime,
      { ...input, outboxRows: [outboxRow("item-0")] },
      runs
    );
    expect(runs.pendingStatusIndex).toBe(2);
    expect(runs.effectiveStatusItems).toBe(2);
    expect(runs.parityItems).toBe(2);
    // 낙관 반영이 실제로 목록에 실렸는지도 값으로 — 감싸기가 뜻을 바꾸지 않았다는 확인이다.
    expect(withQueued.listedItems.find((item) => item.id === "item-0")?.status).toBe("prepared");
    // 렌더 넷 동안 사슬은 두 번 돌았다(종전 모양이면 네 번이다 — 아래 통제군).
    expect(runs.sessionRows).toBe(2);
  });

  it("ⓓ 통제군: 메모가 없으면 같은 렌더 수에서 실행 횟수가 그대로 배수로 늘고 참조도 매번 다르다", () => {
    const withoutMemo = createMemoRuntime(false);
    const runs = emptyRuns();
    const input = baseInput();
    const first = renderPreparationTab(withoutMemo, input, runs);
    const second = renderPreparationTab(withoutMemo, input, runs);
    const third = renderPreparationTab(withoutMemo, input, runs);

    expect(Object.values(runs).every((count) => count === 3)).toBe(true);
    // 메모가 없으면 **매 렌더** 그 806회가 그대로 다시 돈다(위 ⓐ에서는 2·3번째가 0이었다).
    expect(second.itemVisits).toBe(first.itemVisits);
    expect(second.itemVisits).toBe(806);
    // 자식의 두 memo가 "한 번도 적중하지 않는다"고 정찰이 센 그 모양이 이것이다.
    expect(second.parityItems).not.toBe(first.parityItems);
    expect(second.categoryGroups).not.toBe(first.categoryGroups);
    expect(third.childCategories).not.toBe(second.childCategories);
  });
});

/**
 * ⚠️ **양쪽 끝** — 위 재생이 화면과 같은 의존성을 쓰는가.
 *
 * 화면 파일은 vitest에서 import할 수 없으므로 이 저장소의 확립된 관례대로 소스 문자열로 고정한다.
 * 여기서 무는 것은 **의존성 배열**이다: 파생을 `useMemo`로 감싸도 의존성에 렌더마다 새로 만들어지는
 * 값(객체·배열 리터럴 · 화살표)이 들어가면 그 memo는 한 번도 적중하지 않는다 — 감싸기만 하고 아무것도
 * 고치지 못한 상태와 구별이 안 된다.
 */
describe("라운드 105 F6 — 화면이 선언한 의존성 (소스 계약)", () => {
  const itemsSource = () => source("app/(tabs)/items.tsx");
  const parity = () => source("src/preparation/PreparationListParity.tsx");

  it("훅은 전부 조기 반환 **위**에 선다 (FIX-A · 조건부 훅 금지)", () => {
    const items = itemsSource();
    const firstEarlyReturn = items.indexOf("if (authToken && !childId) {");
    expect(firstEarlyReturn).toBeGreaterThan(-1);
    const afterEarlyReturn = items.slice(firstEarlyReturn);
    // 조기 반환 아래에는 훅 호출이 한 건도 없다(useMemo·useEffect·useState·use*).
    expect(afterEarlyReturn.match(/\buseMemo\(/g) ?? []).toHaveLength(0);
    expect(afterEarlyReturn.match(/\buseEffect\(/g) ?? []).toHaveLength(0);
    expect(afterEarlyReturn.match(/\buseState[(<]/g) ?? []).toHaveLength(0);
    // 그리고 위쪽에는 이 트랙이 세운 memo들이 실제로 있다.
    expect(items.slice(0, firstEarlyReturn).match(/\buseMemo[(<]/g) ?? []).not.toHaveLength(0);
  });

  it("파생마다 의존성이 값으로 적혀 있고, 렌더마다 새로 생기는 값이 그 안에 없다", () => {
    const items = itemsSource();
    const dependencyLists = [
      "[childId, syncSnapshot.itemStatusRows]",
      "[childId, necessityFilter, searchText, stageLabel]",
      "[hasSession, items.data, pendingStatusIndex]",
      "[effectiveStatusItems, hasSession, showInterestedOnly]",
      "[categories.data?.categories]",
      "[categoryNameOf, necessityFilter, searchText]",
      "[effectiveStatusItems, hasSession, itemFilterInput, preBirthFilterActive, sourceItems]",
      "[effectiveStatusItems, hasSession, items.data, stageLabel]",
      "[hasSession, seoulToday, showPrepCelebration, stageLabel, stageSourceChild]",
      "[effectiveStatusItems, nextStagePreview]",
      "[hasSession, listedItems]",
      "[expenseLinkPrompt, expenseLinkPromptScope, hasSession, listedItems]",
      "[listedItems, pendingStatusIndex]",
      "[sessionRows]",
      "[categoryNameOf, resolveTileCategory, sessionRows]",
      "[categoryNameOf, sessionRows, stageLabel]"
    ];
    for (const dependencies of dependencyLists) {
      expect(items, `의존성 ${dependencies}`).toContain(dependencies);
    }
    // 렌더마다 새로 생기는 값이 의존성에 실리지 않았는가 — 그런 memo는 감싸도 적중하지 않는다.
    for (const dependencies of dependencyLists) {
      expect(dependencies).not.toMatch(/[{}]|=>/);
    }
  });

  /**
   * ⚠️ **가상화(F6)를 하지 않은 이유 — 값으로 남긴다.**
   *
   * 스카우트 A F6은 "준비템 탭이 카탈로그 전량을 가상화 없이 그린다"를 지적했지만, **실제로
   * 마운트되는 행 수는 이미 묶여 있다**: 그룹은 펼친 것만 그리고(`{expanded ? (`), 펼친 그룹도
   * 기본 5개까지만 그리며(`INITIAL_GROUP_LIMIT`), 검색 결과는 20개에서 시작해 [더 보기]로만
   * 늘어난다. 즉 스크롤러를 `FlatList`로 바꿔서 얻을 것이 "이미 안 그리고 있는 행을 안 그리는
   * 것"뿐이고, 그 대가로 (ⓐ) 승인 디자인 이식본(`PreparationListParity`)의 렌더 구조와
   * (ⓑ) AppScreen 중첩 금지·스크롤 위치 계약이 함께 움직인다. 그래서 이 라운드는 **행 수가
   * 아니라 재계산**을 걷었고, 가상화는 하지 않았다.
   *
   * 이 계약은 그 판단의 전제(=마운트 상한)가 오늘도 사실인지 묻는다 — 상한이 사라지면 판단의
   * 근거가 사라지므로 다음 라운드가 다시 재야 한다.
   */
  it("가상화를 사지 않은 근거: 마운트되는 행 수가 이미 묶여 있다", () => {
    const parityScreen = parity();
    expect(parityScreen).toContain("const INITIAL_GROUP_LIMIT = 5;");
    // 펼친 그룹만 그린다(접힌 그룹의 타일은 마운트되지 않는다).
    expect(parityScreen).toContain("{expanded ? (");
    // 펼친 그룹도 limit까지만 그리고, 나머지는 [더 보기]가 배수로 연다.
    expect(parityScreen).toContain("groupItems.slice(0, limit)");
    expect(parityScreen).toContain("export function nextPreparationGroupLimit(current: number, total: number)");
    // 검색 결과도 20개에서 시작한다.
    expect(parityScreen).toContain("useState(20)");
    // 그리고 이 화면의 스크롤러는 여전히 AppScreen이다(가상화 목록으로 바꾸지 않았다).
    expect(source("app/(tabs)/items.tsx")).not.toContain("FlatList");
    expect(source("app/(tabs)/items.tsx")).not.toContain("SectionList");
  });

  it("자식의 두 memo는 이 배열들의 **참조**에 걸려 있다 (정찰이 센 그 둘)", () => {
    const parityScreen = parity();
    expect(parityScreen).toContain("[categoryGroups, items, minimumGroupSize]");
    expect(parityScreen).toContain("[items, minimumGroupSize]");
    // 화면이 그 두 프롭에 넘기는 값이 위에서 memo로 만든 그 둘이다.
    expect(itemsSource()).toContain("items={parityItems}");
    expect(itemsSource()).toContain("categoryGroups={categoryGroups}");
  });

  it("중복 계산이 한 자리도 늘지 않았다 (순수 모듈 무접촉 — 감싸기만 했다)", () => {
    const items = itemsSource();
    // 목록을 훑는 순수 모듈 호출은 각각 한 자리씩이다.
    for (const call of [
      "computeEssentialPrepProgress(effectiveStatusItems, stageLabel)",
      "filterInterestedItems(effectiveStatusItems)",
      "buildNextStagePrepGapNote(nextStagePreview, effectiveStatusItems)",
      "buildCategoryNameLookup(",
      "buildTileCategoryResolver("
    ]) {
      expect(items.split(call).length - 1, call).toBe(1);
    }
  });
});
