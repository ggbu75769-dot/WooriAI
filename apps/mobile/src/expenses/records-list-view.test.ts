import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";
import { buildRecordsCategoryChips, recordsRowSubtitle } from "./records-list-view";

const mobileRoot = process.cwd();

/**
 * REC-121: the 기록 탭 카테고리 필터가 서버 카테고리 기반으로 바뀌면서(C1) 생긴 순수 계산과,
 * 행 부제의 카테고리 라벨(D2)·환불 구분(K1)을 고정한다.
 *
 * 서버 시드는 세 묶음이 겹쳐 있다: 정식 12개(랜덤 UUID) + mobile_ 별칭 8개(빠른 기록 8타일이
 * 실제로 쓰는 고정 UUID) + 가져오기 스텁 1개. 아래 픽스처는 그 구조를 그대로 흉내 낸다.
 */
const canonical = [
  { id: "srv-diaper", code: "diaper_hygiene", name: "기저귀/위생" },
  { id: "srv-feeding", code: "feeding_babyfood", name: "수유/이유식" },
  { id: "srv-etc", code: "etc", name: "기타" }
];
const aliases = [
  { id: "c0a7e901-0000-4c01-8c01-c47e900ec001", code: "mobile_diaper_hygiene", name: "기저귀" },
  { id: "c0a7e901-0000-4c08-8c08-c47e900ec008", code: "mobile_etc", name: "기타" }
];
const importStub = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "import_stub_default", name: "가져오기 기본" };
const serverCategories = [...canonical, ...aliases, importStub];

describe("buildRecordsCategoryChips", () => {
  it("서버 목록을 칩으로 쓴다 -- 정식 12개 UUID로 기록된 지출이 필터에 잡히도록", () => {
    const chips = buildRecordsCategoryChips(serverCategories, null);

    expect(chips.map((chip) => chip.label)).toContain("기저귀/위생");
    expect(chips.map((chip) => chip.label)).toContain("수유/이유식");
    expect(chips.some((chip) => chip.matchIds.includes("srv-diaper"))).toBe(true);
  });

  it("R20-B selectableCategories를 그대로 재사용한다 -- 스텁 제외 + 동명 중복 1개로", () => {
    const chips = buildRecordsCategoryChips(serverCategories, null);

    expect(chips.some((chip) => chip.label === "가져오기 기본")).toBe(false);
    expect(chips.filter((chip) => chip.label === "기타")).toHaveLength(1);
  });

  it("합쳐진 동명 그룹은 흡수한 id까지 전부 매칭한다 (정식 '기타' + mobile_etc 별칭 '기타')", () => {
    const chips = buildRecordsCategoryChips(serverCategories, null);
    const etc = chips.find((chip) => chip.label === "기타");

    expect(etc).toBeDefined();
    // 빠른 기록 '기타' 타일은 별칭 id로 저장한다 -- 살아남은 칩 id 하나로만 걸렀다면
    // 그 지출들이 통째로 사라졌을 것이다.
    expect(new Set(etc!.matchIds)).toEqual(new Set(["srv-etc", aliases[1].id]));
  });

  it("이름이 다르면 합치지 않는다 ('기저귀/위생' vs 별칭 '기저귀')", () => {
    const chips = buildRecordsCategoryChips(serverCategories, null);

    expect(chips.find((chip) => chip.label === "기저귀")?.matchIds).toEqual([aliases[0].id]);
    expect(chips.find((chip) => chip.label === "기저귀/위생")?.matchIds).toEqual(["srv-diaper"]);
  });

  it("현재 선택은 동명 정리에서 살아남는다 (선택된 별칭 id가 칩으로 남음)", () => {
    const chips = buildRecordsCategoryChips(serverCategories, aliases[1].id);
    const etc = chips.filter((chip) => chip.label === "기타");

    expect(etc).toHaveLength(1);
    expect(etc[0].id).toBe(aliases[1].id);
    expect(new Set(etc[0].matchIds)).toEqual(new Set(["srv-etc", aliases[1].id]));
  });

  it("서버 목록에 아예 없는 선택 id는 칩을 앞에 붙여 필터 해제 경로를 남긴다", () => {
    const chips = buildRecordsCategoryChips(serverCategories, "legacy-id");

    expect(chips[0].id).toBe("legacy-id");
    expect(chips[0].matchIds).toEqual(["legacy-id"]);
    expect(chips[0].label).toBe("기타"); // categoryNameFor 폴백 -- 원시 id를 노출하지 않는다
  });

  it("목록이 비었거나(로딩·오프라인·실패) 쓸 수 없으면 기존 8타일로 폴백한다", () => {
    for (const empty of [undefined, null, []]) {
      const chips = buildRecordsCategoryChips(empty, null);
      expect(chips).toHaveLength(categoryCatalog.length);
      expect(chips[0].id).toBe(categoryCatalog[0].id);
      expect(chips[0].label).toBe(`${categoryCatalog[0].icon} ${categoryCatalog[0].label}`);
      expect(chips[0].matchIds).toEqual([categoryCatalog[0].id]);
    }
  });

  it("칩 순서는 서버 목록 순서(displayOrder)를 유지한다", () => {
    const chips = buildRecordsCategoryChips(serverCategories, null);
    expect(chips.map((chip) => chip.label)).toEqual(["기저귀/위생", "수유/이유식", "기타", "기저귀"]);
  });
});

describe("recordsRowSubtitle", () => {
  it("D2: 일반 지출 행에 카테고리 라벨을 넣는다", () => {
    expect(recordsRowSubtitle({ expenseType: "expense", categoryLabel: "기저귀", dateLabel: "8월 4일" })).toBe("기저귀 · 8월 4일");
  });

  it("선물은 기존 '선물 ·' 접두를 유지한다", () => {
    expect(recordsRowSubtitle({ expenseType: "gift", categoryLabel: "기저귀", dateLabel: "8월 4일" })).toBe("선물 · 기저귀 · 8월 4일");
  });

  it("K1: 환불도 구분된다 -- 예전에는 일반 지출과 완전히 동일하게 보였다", () => {
    expect(recordsRowSubtitle({ expenseType: "refund", categoryLabel: "기저귀", dateLabel: "8월 4일" })).toBe("환불 · 기저귀 · 8월 4일");
  });

  it("카테고리 라벨이 없으면 예전 부제 그대로다 (행 레이아웃 관례 유지)", () => {
    expect(recordsRowSubtitle({ expenseType: "expense", categoryLabel: "", dateLabel: "8월 4일" })).toBe("8월 4일");
    expect(recordsRowSubtitle({ expenseType: "gift", categoryLabel: null, dateLabel: "8월 4일" })).toBe("선물 · 8월 4일");
  });
});

describe("기록 화면 배선 (app/(tabs)/records.tsx)", () => {
  const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");

  it("C1: 칩과 이름 해석을 같은 ['categories'] 응답에서 가져온다", () => {
    expect(recordsSource).toContain('queryKey: ["categories"]');
    expect(recordsSource).toContain("buildRecordsCategoryChips(serverCategories, selectedCategoryId)");
    expect(recordsSource).toContain("buildCategoryNameLookup(serverCategories)");
  });

  it("C1: 필터는 선택 칩의 matchIds 집합으로 건다 (id 1개 비교가 아니라)", () => {
    expect(recordsSource).toContain("selectedCategoryIds");
    expect(recordsSource).toContain("!selectedCategoryIds.has(expense.categoryId)");
    expect(recordsSource).toContain("!selectedCategoryIds.has(row.payload.categoryId)");
  });

  it("D2/K1: 행 부제는 recordsRowSubtitle 한 곳에서 만든다", () => {
    expect(recordsSource).toContain("recordsRowSubtitle({");
    expect(recordsSource).toContain("categoryLabel: categoryName(expense.categoryId)");
    // 예전의 gift 전용 인라인 삼항은 남아 있지 않아야 한다.
    expect(recordsSource).not.toContain('`선물 · ${formatSpentOn(expense.spentOn)}`');
  });

  it("K1: 금액은 부호 없이 그대로 둔다 (formatKrw 계약 + 월 합계가 환불을 빼지 않으므로)", () => {
    expect(recordsSource).toContain("value={formatKrw(expense.amountKrw)}");
    expect(recordsSource).not.toContain("`-${formatKrw(");
  });
});
