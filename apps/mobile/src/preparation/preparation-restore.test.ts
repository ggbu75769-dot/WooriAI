import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { preparationDisplayGroupIds, resolvePreparationDisplayGroupId } from "./preparation-grouping";
import { expenseCategoryVisual, htmlPreparationItemVisuals, resolvePreparationItemVisual } from "./item-visuals";
import { toCatalogPlanState, toPreparationParityItem } from "./catalog-contract";
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

  it("hides groups with fewer than five confirmed items and grows 5 → 10 → 20 → 40 → all", () => {
    expect(source).toContain("const INITIAL_GROUP_LIMIT = 5;");
    expect(source).toContain("group.items.length >= INITIAL_GROUP_LIMIT");
    expect(source).toContain("band.items.length >= INITIAL_GROUP_LIMIT");
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

  it("keeps 해요체 copy and the 누락 신고 escape hatch", () => {
    for (const copy of [
      "나의 준비 진행률",
      "아직 준비 상태를 정한 품목이 없어요",
      "품목명·별칭·분류 검색",
      "검색 결과가 없어요.",
      "5개 이상 확인된 준비 품목 그룹이 없어요.",
      "누락 신고하기"
    ]) {
      expect(source).toContain(copy);
    }
  });

  it("reads its catalog vocabulary through the adapter, not from a screen-local literal union", () => {
    expect(source).toContain('import type { CatalogPlanState, CatalogTimelineBucket } from "./catalog-contract";');
  });
});
