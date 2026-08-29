import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
