import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * 라운드 81 트랙 C — 첫 펼침 판정을 **실행해서** 확인하기 위한 최소 대역(stub).
 *
 * `PreparationListParity.tsx`는 react-native와 디자인 시스템 배럴을 값으로 import하는데, 이
 * 스위트는 plain-node라 그 둘을 실행하지 못한다(파일 상단 주석 참고). 판정 자체는 순수
 * 함수이므로, **모듈이 로드되기만 하면** 되도록 화면 쪽 값만 세워 둔다 — 렌더는 이 스위트에서
 * 한 번도 호출되지 않으므로 여기 적힌 값이 화면에 나가는 일은 없다. 모듈 최상위에서 실제로
 * 읽히는 것은 `semanticColors`의 시기 밴드 색뿐이다(timingBands).
 */
vi.mock("react-native", () => ({
  Keyboard: { dismiss: () => undefined },
  Pressable: () => null,
  TextInput: () => null,
  View: () => null,
  useWindowDimensions: () => ({ fontScale: 1, width: 390 })
}));
vi.mock("../design-system/components/KoreanText", () => ({ KoreanText: () => null }));
vi.mock("../design-system", () => ({
  AppIcon: () => null,
  EmptyStateCard: () => null,
  PreparationItemCard: () => null,
  TopAppBar: () => null,
  semanticColors: {
    actionPrimary: "#000000",
    brandSecondary: "#000000",
    success: "#000000",
    successSurface: "#000000",
    warning: "#000000"
  },
  spacing: { xs: 8, xxs: 4 }
}));

import { preparationAutoExpandKey, resolvePreparationAutoExpand } from "./PreparationListParity";
import { preparationDisplayGroupIds, resolvePreparationDisplayGroupId } from "./preparation-grouping";
import { expenseCategoryVisual, htmlPreparationItemVisuals, resolvePreparationItemVisual } from "./item-visuals";
import { resolvePreparationTimelineBucket, toCatalogPlanState, toPreparationParityItem } from "./catalog-contract";
import { categoryCatalog } from "../categories";
import { theme } from "../theme";

/**
 * DSN-053 P1 ⑤ — 이식한 src/preparation의 계약.
 *
 * 원본(c20deeb)에는 `preparation-list-parity-render.test.tsx`가 있었지만 그 테스트는
 * `react-test-renderer`로 실제 렌더를 돌린다. 이 트리에는 그 패키지가 없고, 이 repo의 vitest는
 * react-native 컴포넌트를 실행하지 못한다(loading-skeleton-contract.test.ts 주석 참고). 새 런타임
 * 의존성을 들이는 것은 이 트랙의 범위가 아니므로, **순수 로직은 실행해서** 확인하고 화면 조립은
 * 나머지 스위트와 같은 소스 계약으로 고정한다.
 */
const mobileRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

describe("preparation display grouping", () => {
  it("keeps the ten display groups", () => {
    expect(preparationDisplayGroupIds).toHaveLength(10);
    expect(new Set(preparationDisplayGroupIds).size).toBe(10);
  });

  it("routes each domain code to its group", () => {
    expect(resolvePreparationDisplayGroupId({ code: "R4-C10-001", nameKo: "신생아 기저귀" })).toBe("diaper_daily");
    expect(resolvePreparationDisplayGroupId({ code: "R4-C08-003", nameKo: "젖병" })).toBe("feeding");
    expect(resolvePreparationDisplayGroupId({ code: "R4-C17-002", nameKo: "유모차" })).toBe("outing_growth");
    expect(resolvePreparationDisplayGroupId({ code: "R4-C11-001", nameKo: "아기 욕조" })).toBe("hygiene_bath");
  });

  it("sends record-shaped items to 가족·기록 regardless of their domain code", () => {
    expect(resolvePreparationDisplayGroupId({ code: "R4-C10-001", nameKo: "기저귀 갈이 체크리스트" })).toBe("family_records");
    expect(resolvePreparationDisplayGroupId({ code: "R4-C08-001", nameKo: "수유 기록지" })).toBe("family_records");
  });

  it("keeps 아기 손톱 파일 out of the record bucket -- it is a 손톱 다듬는 '파일'", () => {
    expect(resolvePreparationDisplayGroupId({ code: "R4-C04-009", nameKo: "아기 손톱 파일" })).toBe("hygiene_bath");
  });

  it("falls back to 가족·기록 for an unrecognised code instead of inventing a group", () => {
    expect(resolvePreparationDisplayGroupId({ code: "unknown-id", nameKo: "무언가" })).toBe("family_records");
  });
});

describe("preparation item visuals", () => {
  it("keeps the nine approved HTML-card icons", () => {
    expect(htmlPreparationItemVisuals).toHaveLength(9);
    for (const [nameKo, icon] of htmlPreparationItemVisuals) {
      const visual = resolvePreparationItemVisual({ code: "R4-C99-001", nameKo, primaryCategory: null });
      expect(visual.icon, nameKo).toBe(icon);
      // 승인 카드는 코랄 틴트로 그린다(분류 팔레트가 아니다).
      expect(visual.iconBackgroundColor, nameKo).toBe(theme.colors.coral[50]);
      expect(visual.iconColor, nameKo).toBe(theme.colors.coral[700]);
    }
  });

  it("matches on a keyword when the exact card name is not in the approved list", () => {
    expect(resolvePreparationItemVisual({ code: "R4-C08-007", nameKo: "휴대용 분유 케이스", primaryCategory: null }).icon)
      .toBe("baby-bottle-outline");
    expect(resolvePreparationItemVisual({ code: "R4-C14-002", nameKo: "아기 세탁 세제", primaryCategory: null }).icon)
      .toBe("washing-machine");
  });

  it("falls back to the domain icon, then to a neutral baby glyph -- never to nothing", () => {
    // C15(수면·가구)는 이름에 걸리는 키워드가 없다 -> 도메인 아이콘.
    const domain = resolvePreparationItemVisual({ code: "R4-C15-004", nameKo: "코너 보호대", primaryCategory: null });
    expect(domain.icon).toBe("sofa-outline");
    expect(theme.colors.categoryPalette as readonly string[]).toContain(domain.iconBackgroundColor);

    const unknown = resolvePreparationItemVisual({ code: "no-domain", nameKo: "알 수 없는 물건", primaryCategory: null });
    expect(unknown.icon).toBe("baby-face-outline");
  });

  it("only trusts a category's own iconKey when it is on the approved list", () => {
    const approved = resolvePreparationItemVisual({
      code: "R4-C99-001",
      nameKo: "이름만 있는 품목",
      primaryCategory: { code: "C99", iconKey: "hanger", nameKo: "분류" }
    });
    expect(approved.icon).toBe("hanger");

    const bogus = resolvePreparationItemVisual({
      code: "R4-C99-001",
      nameKo: "이름만 있는 품목",
      primaryCategory: { code: "C99", iconKey: "not-a-real-glyph", nameKo: "분류" }
    });
    expect(bogus.icon).toBe("baby-face-outline");
  });

  /**
   * 어댑터 지점: 현재 `categories.ts`의 `icon`은 Ionicons 이름이라 그대로 넘기면 MCI에서
   * 아무것도 그려지지 않는다. item-visuals는 **분류 코드**로 MCI 이름을 되짚는다.
   */
  it("resolves an expense category to an MCI glyph, not to the catalog's Ionicons name", () => {
    for (const entry of categoryCatalog) {
      const visual = expenseCategoryVisual(entry.id);
      expect(visual.icon, entry.code).not.toBe(entry.icon);
      expect(visual.icon, entry.code).toBeTruthy();
      expect(visual.iconBackgroundColor, entry.code).toBe(theme.colors.categoryColors[entry.code]);
    }
  });

  it("falls back to a receipt glyph for an unknown categoryId", () => {
    expect(expenseCategoryVisual("no-such-category").icon).toBe("receipt");
  });
});

describe("catalog adapter (현재 ItemSummary → c20deeb 카탈로그 어휘)", () => {
  it("maps every current item status onto a catalog plan state", () => {
    expect(toCatalogPlanState("not_prepared")).toBe("need");
    expect(toCatalogPlanState("prepared")).toBe("owned");
    expect(toCatalogPlanState("gifted")).toBe("gifted");
    expect(toCatalogPlanState("not_needed")).toBe("not_needed");
    expect(toCatalogPlanState("interested")).toBe("researching");
  });

  it("never invents a timeline bucket the current contract does not carry", () => {
    const item = toPreparationParityItem({
      id: "item-1",
      name: "젖병",
      necessityLevel: "essential",
      status: "prepared",
      timingLabel: "이번 주"
    });
    expect(item).toEqual({
      id: "item-1",
      code: "item-1",
      nameKo: "젖병",
      timelineBucket: undefined,
      dueWindowLabel: "이번 주",
      plan: { state: "owned" }
    });
  });

  it("uses the caller's catalog code when it has one", () => {
    const item = toPreparationParityItem(
      { id: "item-2", name: "신생아 기저귀", necessityLevel: "essential", status: "not_prepared" },
      { code: "R4-C10-001", timelineBucket: "this_week" }
    );
    expect(item.code).toBe("R4-C10-001");
    expect(item.timelineBucket).toBe("this_week");
    expect(resolvePreparationDisplayGroupId(item)).toBe("diaper_daily");
  });
});

describe("PreparationListParity source contract", () => {
  const source = readSource("src/preparation/PreparationListParity.tsx");

  it("hides groups smaller than the caller's minimum (default 5) and grows 5 → 10 → 20 → 40 → all", () => {
    expect(source).toContain("const INITIAL_GROUP_LIMIT = 5;");
    // DSN-053 P2-B: 최소 그룹 크기가 호출부 인자가 됐다. 기본값은 원본과 같은 5라 픽셀 락
    // 렌더는 그대로이고, 준비템 탭은 1을 넘겨 실제로 있는 품목이 숨지 않게 한다.
    expect(source).toContain("minimumGroupSize = INITIAL_GROUP_LIMIT");
    expect(source).toContain("group.items.length > 0 && group.items.length >= minimumGroupSize");
    expect(source).toContain("band.items.length > 0 && band.items.length >= minimumGroupSize");
    const limitFn = source.slice(
      source.indexOf("export function nextPreparationGroupLimit"),
      source.indexOf("const displayGroups")
    );
    for (const step of ["Math.min(10, total)", "Math.min(20, total)", "Math.min(40, total)"]) {
      expect(limitFn).toContain(step);
    }
  });

  it("keeps ten category groups and four timing bands", () => {
    const groupBlock = source.slice(source.indexOf("const displayGroups"), source.indexOf("const timingBands"));
    expect(groupBlock.match(/\bid: "/g) ?? []).toHaveLength(10);
    const bandBlock = source.slice(source.indexOf("const timingBands"), source.indexOf("function SegmentedControl"));
    expect(bandBlock.match(/\bid: "/g) ?? []).toHaveLength(4);
    for (const band of ["지금 준비해요", "곧 필요해요", "여유 있게 준비해요", "정리된 품목"]) {
      expect(bandBlock).toContain(band);
    }
  });

  it("counts a completed item once and leaves not_needed/retired/ended out of the total", () => {
    expect(source).toContain('const completedStates = new Set<CatalogPlanState>(["owned", "borrowed", "rented", "gifted", "replaced"]);');
    expect(source).toContain('const excludedStates = new Set<CatalogPlanState>(["not_needed", "retired", "ended"]);');
    expect(source).toContain("items.filter((item) => item.plan && !excludedStates.has(item.plan.state))");
  });

  it("keeps the approved geometry: 48dp segmented control, 68/72 group headers, 40dp tint circle", () => {
    expect(source).toContain("borderRadius: 14, flexDirection: \"row\", padding: 4");
    expect(source).toContain("borderRadius: 11");
    expect(source).toContain("minHeight: 68");
    expect(source).toContain("minHeight: 72");
    expect(source).toContain("borderRadius: 999, height: 40, justifyContent: \"center\", width: 40");
    expect(source).toContain("height: 9");
    expect(source).toContain("height: 5");
  });

  it("keeps 해요체 copy on every branch the caller can actually reach", () => {
    for (const copy of [
      "나의 준비 진행률",
      "아직 준비 상태를 정한 품목이 없어요",
      "품목명·별칭·분류 검색",
      "검색 결과가 없어요.",
      "5개 이상 확인된 준비 품목 그룹이 없어요."
    ]) {
      expect(source).toContain(copy);
    }
  });

  it("reads its catalog vocabulary through the adapter, not from a screen-local literal union", () => {
    expect(source).toContain('import type { CatalogPlanState, CatalogTimelineBucket } from "./catalog-contract";');
  });

  /**
   * DSN-053 P2-B: 준비템 탭이 이 화면을 그대로 쓰기 위해 열어 둔 슬롯들. 전부 **선택적**이라
   * 넘기지 않으면 원본 렌더(픽셀 락 경로)가 한 줄도 바뀌지 않는다.
   */
  it("keeps every P2-B slot optional so the original render is the default", () => {
    for (const slot of [
      "categoryGroups?: readonly PreparationCategoryGroup[];",
      "minimumGroupSize?: number;",
      "progress?: PreparationProgressSummary | null;",
      "topBarTrailing?: ReactNode;",
      "beforeSegment?: ReactNode;",
      "auxiliaryFilters?: ReactNode;",
      "notices?: ReactNode;",
      "emptyState?: ReactNode;",
      "renderItemFooter?: (item: PreparationParityItem) => ReactNode;"
    ]) {
      expect(source, slot).toContain(slot);
    }
    // 히어로 수치를 넘기면 그 값만 그린다 -- 컴포넌트가 다시 세지 않는다.
    expect(source).toContain("const totalCount = progress ? progress.totalCount : trackedItems.length;");
    expect(source).toContain("const completedCount = progress ? progress.completedCount : completedItems.length;");
  });

  /**
   * 라운드 72 트랙 E(#5ⓒ) — **죽은 프롭 셋을 걷었다.**
   *
   * 이식본이 들고 있던 `loading` · `error`(그리고 그 가지만 쓰던 `onRetry`) · `onMissingReport`는
   * 이 저장소의 **유일한 호출부**(`app/(tabs)/items.tsx`)가 하나도 넘기지 않았다 — 즉 그 프롭들이
   * 여는 네 가지(로딩 카드 · 조회 실패 카드 · 검색 0건의 신고 갈래 · "누락 신고하기" 줄)는 한 번도
   * 렌더된 적이 없다. 걷어도 **화면은 한 픽셀도 바뀌지 않는다**는 것이 이 조각의 안전 근거이고,
   * 아래 두 단언이 그 사실을 양쪽에서 고정한다(선언에 없다 ∧ 호출부가 넘기지 않는다).
   */
  it("죽은 프롭 넷은 선언에도 호출부에도 없다", () => {
    const items = readSource("app/(tabs)/items.tsx");
    const parityTag = items.slice(items.indexOf("<PreparationListParity"), items.indexOf("\n      />", items.indexOf("<PreparationListParity")));
    expect(parityTag.length, "호출부 태그를 찾지 못했다").toBeGreaterThan(0);
    for (const prop of ["loading", "error", "onRetry", "onMissingReport"]) {
      expect(source, `선언에 남은 죽은 프롭: ${prop}`).not.toMatch(new RegExp(`\\n  ${prop}[?:,]`));
      expect(parityTag, `호출부가 다시 넘기는 프롭: ${prop}`).not.toContain(`${prop}=`);
    }
    // 그 프롭들이 열던 문장은 함께 사라졌다(도달 불가였으므로 렌더는 그대로다).
    for (const deadCopy of [
      "준비 품목을 불러오고 있어요.",
      "준비 품목을 불러오지 못했어요.",
      "없는 품목 신고",
      "누락 신고하기"
    ]) {
      expect(source, `죽은 가지의 문장: ${deadCopy}`).not.toContain(deadCopy);
    }
  });

  /**
   * ⚠️ DSN-053 이식본의 **살아 있는 가지는 승인 디자인**이다 — 렌더가 바뀌면 그것은 디자인 변경
   * 승인이 먼저인 일이다. 그래서 죽은 가지를 걷은 뒤에도 실제로 서는 조각들이 **글자 그대로**
   * 남아 있는지 본다(조건 사슬의 첫 갈래가 검색으로 당겨진 것만이 이번 변화다).
   */
  it("살아 있는 가지의 렌더는 글자 그대로다", () => {
    expect(source).toContain("{activeSearchQuery ? (");
    expect(source).toContain('<EmptyStateCard actionLabel="검색 지우기" onPress={onClearSearch} title="검색 결과가 없어요." />');
    expect(source).toContain('emptyState ?? <EmptyStateCard actionLabel="준비 홈" onPress={onBack} title="5개 이상 확인된 준비 품목 그룹이 없어요." />');
    expect(source).toContain("<ItemGrid columns={columns} items={displayedItems.slice(0, searchLimit)} onItemPress={onItemPress} renderItemFooter={renderItemFooter} />");
    expect(source).toContain("<ItemGrid columns={columns} items={visibleGroupItems} onItemPress={onItemPress} renderItemFooter={renderItemFooter} />");
    expect(source).toContain("<ItemGrid columns={columns} items={visibleBandItems} onItemPress={onItemPress} renderItemFooter={renderItemFooter} />");
    expect(source).toContain('<TopAppBar eyebrow="준비 홈" onBack={onBack} title="내 준비 목록" trailing={topBarTrailing} />');
    // 남은 EmptyStateCard는 검색 0건과 그룹 0건 폴백 **둘뿐**이다(죽은 둘이 사라졌다).
    expect(source.match(/<EmptyStateCard\b/g) ?? []).toHaveLength(2);
  });

  /**
   * 라운드 81 트랙 C — 첫 펼침 effect는 **판정을 스스로 적지 않는다.** 순수 함수 하나를 통해서만
   * ref 키를 적고, 그 키는 더 이상 아이 id 하나가 아니다(선택 컨텍스트 + 그룹 목록 서명).
   * 렌더 트리는 한 줄도 바뀌지 않았다 — 위 두 단언이 그 사실을 이미 물고 있다.
   */
  it("첫 펼침은 아이 id 하나가 아니라 그룹 목록 서명까지 보고 다시 계산한다", () => {
    expect(source).toContain("const decision = resolvePreparationAutoExpand({");
    expect(source).toContain("autoExpandedKey.current = decision.nextKey;");
    expect(source).toContain("setExpandedGroups(new Set([decision.expandGroupId]));");
    // 예전 판정(아이 id 하나로 잠그는 ref)은 남아 있지 않다.
    expect(source).not.toContain("autoExpandedContext");
    // 목록이 갈리는 것을 실제로 보려면 `categories`와 지금 펼침 상태가 의존성에 있어야 한다.
    expect(source).toContain("}, [categories, expandedGroups, selectedContextKey]);");
  });
});

/**
 * 라운드 81 트랙 C(#3) — **첫 펼침을 언제 다시 계산하는가.**
 *
 * 예전 키는 `selectedContextKey`(아이 id) 하나였고, 콜드 스타트에는 분류 캐시가 늦게 와서
 * 그 한 번을 "기타" 한 그룹에 써 버린 뒤 잠겼다. 분류가 도착해 그룹이 갈리면 펼쳐 둔 "기타"는
 * 사라지고 화면은 접힌 헤더의 벽이 된다. 아래 셋이 그 재현과 그 반대 방향(사용자가 접은 것을
 * 되펼치지 않는다)을 함께 고정한다.
 */
describe("준비템 첫 펼침 재계산 (라운드 81 트랙 C)", () => {
  const coldStartGroups = ["기타"];
  const settledGroups = ["건강·진료", "수유·이유식", "기저귀·생활"];

  it("① 콜드 스타트의 '기타' 한 그룹은 분류가 도착해 그룹이 갈리면 다시 계산된다", () => {
    const coldStart = resolvePreparationAutoExpand({
      contextKey: "child-1",
      expandedGroupIds: [],
      groupIds: coldStartGroups,
      previousKey: undefined
    });
    expect(coldStart).toEqual({
      expandGroupId: "기타",
      nextKey: preparationAutoExpandKey("child-1", coldStartGroups)
    });

    // 분류 캐시 도착: 그룹이 실제 이름들로 갈리고 "기타"는 목록에 없다.
    const afterCategories = resolvePreparationAutoExpand({
      contextKey: "child-1",
      expandedGroupIds: ["기타"],
      groupIds: settledGroups,
      previousKey: coldStart?.nextKey
    });
    expect(afterCategories).toEqual({
      expandGroupId: "건강·진료",
      nextKey: preparationAutoExpandKey("child-1", settledGroups)
    });
  });

  it("② 같은 그룹 구성에서는 리렌더가 몇 번 와도 다시 계산하지 않는다", () => {
    const settledKey = preparationAutoExpandKey("child-1", settledGroups);
    for (const expandedGroupIds of [["건강·진료"], ["기저귀·생활", "수유·이유식"], []]) {
      expect(
        resolvePreparationAutoExpand({
          contextKey: "child-1",
          expandedGroupIds,
          groupIds: settledGroups,
          previousKey: settledKey
        }),
        `펼침 상태 ${JSON.stringify(expandedGroupIds)}`
      ).toBeNull();
    }
  });

  it("② 사용자가 접은 것을 되펼치지 않는다 — 살아 있는 그룹이 하나라도 있으면 키만 갱신한다", () => {
    // 필수도 칩 하나로 목록이 좁아졌지만 펼쳐 둔 "수유·이유식"은 그대로 있다.
    const narrowedGroups = ["수유·이유식", "외출·놀이·교육"];
    expect(
      resolvePreparationAutoExpand({
        contextKey: "child-1",
        expandedGroupIds: ["수유·이유식"],
        groupIds: narrowedGroups,
        previousKey: preparationAutoExpandKey("child-1", settledGroups)
      })
    ).toEqual({ expandGroupId: null, nextKey: preparationAutoExpandKey("child-1", narrowedGroups) });
  });

  it("③ 아이를 바꾸면 예전처럼 첫 그룹이 펼쳐진다 — 그 그룹이 새 목록에도 있어도 마찬가지다", () => {
    expect(
      resolvePreparationAutoExpand({
        contextKey: "child-2",
        expandedGroupIds: ["기저귀·생활"],
        groupIds: settledGroups,
        previousKey: preparationAutoExpandKey("child-1", settledGroups)
      })
    ).toEqual({ expandGroupId: "건강·진료", nextKey: preparationAutoExpandKey("child-2", settledGroups) });
  });

  it("그릴 그룹이 없는 프레임은 키를 잠그지 않는다(예전 가드 그대로)", () => {
    expect(
      resolvePreparationAutoExpand({
        contextKey: "child-1",
        expandedGroupIds: [],
        groupIds: [],
        previousKey: undefined
      })
    ).toBeNull();
  });

  /**
   * ⚠️ 그룹 id는 호출부가 정하는 값이고 그 폭은 넓어질 수 있다(준비템 탭은 분류 *이름*을 쓴다).
   * 서명은 그 값의 모양에 아무 가정도 두지 않는다 — 다른 목록은 언제나 다른 서명이다.
   */
  it("서명은 그룹 값의 폭에 가정을 두지 않는다", () => {
    const cases: ReadonlyArray<[string | null, readonly string[]]> = [
      ["child-1", ["가", "나"]],
      ["child-1", ["가,나"]],
      ["child-1", ["나", "가"]],
      ["child-1", ["가"]],
      ["child-1", ['따옴표" 든 이름', "줄바꿈\n든 이름"]],
      ["child-1", []],
      [null, ["가", "나"]],
      ["null", ["가", "나"]]
    ];
    const signatures = cases.map(([contextKey, groupIds]) => preparationAutoExpandKey(contextKey, groupIds));
    expect(new Set(signatures).size).toBe(cases.length);
    // 같은 입력은 언제나 같은 서명이다(재렌더가 서명을 흔들지 않는다).
    expect(preparationAutoExpandKey("child-1", ["가", "나"])).toBe(preparationAutoExpandKey("child-1", ["가", "나"]));
  });
});

describe("timeline bucket 판정 (현재 계약 → 시기별 밴드)", () => {
  const openItem = { status: "not_prepared" as const };

  it("정리된 상태는 밴드와 무관하게 정리된 품목으로 간다", () => {
    expect(resolvePreparationTimelineBucket({ status: "prepared" }, "12-24개월")).toBe("completed");
    expect(resolvePreparationTimelineBucket({ status: "gifted" }, "12-24개월")).toBe("completed");
    expect(resolvePreparationTimelineBucket({ status: "not_needed" }, "12-24개월")).toBe("not_needed");
  });

  it("보고 있는 밴드에 걸치면 지금, 지나간 밴드면 밀린 항목이다", () => {
    expect(resolvePreparationTimelineBucket({ ...openItem, stageCodes: ["toddler_1_3"] }, "12-24개월")).toBe("this_week");
    expect(resolvePreparationTimelineBucket({ ...openItem, stageCodes: ["newborn_0_3"] }, "12-24개월")).toBe("overdue");
  });

  it("다음 밴드는 곧, 그보다 뒤는 여유 있게로 간다", () => {
    expect(resolvePreparationTimelineBucket({ ...openItem, stageCodes: ["infant_7_12"] }, "0-6개월")).toBe("this_month");
    expect(resolvePreparationTimelineBucket({ ...openItem, stageCodes: ["toddler_1_3"] }, "0-6개월")).toBe("next_stage");
  });

  it("밴드를 특정할 수 없으면 급하다고 주장하지 않는다", () => {
    expect(resolvePreparationTimelineBucket({ ...openItem, timingLabel: "출산 직후" }, "12-24개월")).toBe("this_month");
  });
});
