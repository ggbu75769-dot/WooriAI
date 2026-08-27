import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";
import { buildRecordsCategoryChips, formatSpentOn, homeRecentExpenseSubtitle, recordsRowSubtitle } from "./records-list-view";

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

/**
 * CAT-124: 서버가 별칭·스텁 행을 `selectable: false`로 내려보내면 그 칩들이 사라진다.
 * 여기서 고정하는 것은 **사라진 칩의 지출이 어디로 가는가** — 정식 칩이 taxonomy code로
 * 흡수해야 한다. 흡수하지 않으면 8타일 빠른 입력으로 기록한 지출이 전부 "전체"에서만
 * 보이게 되어, 서버가 목록을 좁힌 대가로 필터가 망가진다.
 */
describe("buildRecordsCategoryChips + CAT-124 selectable", () => {
  // 실 시드(apps/api/prisma/seed-data.ts)와 같은 모양: 정식 12 + 별칭 8 + 스텁 1 = 21행.
  const canonicalRows = [
    { id: "srv-01", code: "pregnancy_mother", name: "임신/산모" },
    { id: "srv-02", code: "hospital_checkup", name: "병원/검사" },
    { id: "srv-03", code: "birth_postpartum", name: "출산/조리원" },
    { id: "srv-04", code: "diaper_hygiene", name: "기저귀/위생" },
    { id: "srv-05", code: "feeding_babyfood", name: "수유/이유식" },
    { id: "srv-06", code: "clothes_laundry", name: "의류/세탁" },
    { id: "srv-07", code: "sleep_furniture", name: "수면/가구" },
    { id: "srv-08", code: "outing_mobility", name: "외출/이동" },
    { id: "srv-09", code: "toys_books", name: "장난감/책" },
    { id: "srv-10", code: "care_education", name: "돌봄/교육" },
    { id: "srv-11", code: "insurance_savings", name: "보험/저축" },
    { id: "srv-12", code: "etc", name: "기타" }
  ].map((row) => ({ ...row, selectable: true }));
  // 퀵타일 별칭 id는 categoryCatalog와 바이트 단위로 같다(seed-data.ts mobileCategoryAliasSeeds).
  const catalogId = (label: string) => categoryCatalog.find((entry) => entry.label === label)!.id;
  const hiddenRows = [
    { id: catalogId("기저귀"), code: "mobile_diaper_hygiene", name: "기저귀" },
    { id: catalogId("분유/유제품"), code: "mobile_feeding_dairy", name: "분유/유제품" },
    { id: catalogId("식비"), code: "mobile_feeding_meal", name: "식비" },
    { id: catalogId("의류"), code: "mobile_clothes_laundry", name: "의류" },
    { id: catalogId("약품/교통"), code: "mobile_outing_mobility", name: "약품/교통" },
    { id: catalogId("병원/약"), code: "mobile_hospital_checkup", name: "병원/약" },
    { id: catalogId("교육/도서"), code: "mobile_toys_books", name: "교육/도서" },
    { id: catalogId("기타"), code: "mobile_etc", name: "기타" },
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "import_stub_default", name: "가져오기 기본" }
  ].map((row) => ({ ...row, selectable: false }));
  const rows = [...canonicalRows, ...hiddenRows];

  it("칩은 정식 카테고리만 남는다 — 별칭 칩이 사라진다", () => {
    const chips = buildRecordsCategoryChips(rows, null);
    expect(chips.map((chip) => chip.label)).toEqual(canonicalRows.map((row) => row.name));
    expect(chips).toHaveLength(12);
  });

  it("사라진 별칭 id는 같은 taxonomy code의 정식 칩이 matchIds로 흡수한다", () => {
    const chips = buildRecordsCategoryChips(rows, null);
    const byLabel = new Map(chips.map((chip) => [chip.label, chip]));

    expect(byLabel.get("기저귀/위생")!.matchIds).toContain(catalogId("기저귀"));
    expect(byLabel.get("장난감/책")!.matchIds).toContain(catalogId("교육/도서"));
    // 한 정식 카테고리가 별칭 2개를 흡수하는 경우("분유/유제품"·"식비" 둘 다 feeding_babyfood).
    expect(byLabel.get("수유/이유식")!.matchIds).toEqual(
      expect.arrayContaining([catalogId("분유/유제품"), catalogId("식비")])
    );
    // 동명 흡수(REC-121)와 code 흡수가 겹쳐도 중복 없이 한 번씩만 들어간다.
    expect(byLabel.get("기타")!.matchIds).toEqual(["srv-12", catalogId("기타")]);

    // 8타일이 쓰는 id가 전부 어떤 칩엔가 잡힌다 = 빠른 기록 지출이 필터에서 사라지지 않는다.
    for (const entry of categoryCatalog) {
      expect(chips.some((chip) => chip.matchIds.includes(entry.id)), `${entry.label} 타일 id`).toBe(true);
    }
  });

  it("한 지출이 두 칩에 동시에 잡히지 않는다 (matchIds는 서로 겹치지 않는다)", () => {
    const chips = buildRecordsCategoryChips(rows, null);
    const seen = new Set<string>();
    for (const chip of chips) {
      for (const id of chip.matchIds) {
        expect(seen.has(id), `${id}가 두 칩에 들어갔어요`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("가져오기 스텁은 흡수되지 않는다 — 대응하는 taxonomy code가 없어 '전체'에서만 보인다 (기존 한계 유지)", () => {
    const chips = buildRecordsCategoryChips(rows, null);
    expect(chips.some((chip) => chip.matchIds.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))).toBe(false);
  });

  it("선택 중인 별칭 id는 여전히 자기 칩을 갖는다 (그때는 정식 칩이 흡수하지 않는다)", () => {
    const chips = buildRecordsCategoryChips(rows, catalogId("기저귀"));
    const alias = chips.find((chip) => chip.id === catalogId("기저귀"));

    expect(alias?.label).toBe("기저귀");
    expect(chips.find((chip) => chip.label === "기저귀/위생")!.matchIds).toEqual(["srv-04"]);
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

describe("HOME-124 formatSpentOn", () => {
  it("ISO date-only를 사람이 읽는 날짜로 바꾼다 (앞의 0 제거)", () => {
    expect(formatSpentOn("2026-08-27")).toBe("8월 27일");
    expect(formatSpentOn("2026-01-05")).toBe("1월 5일");
    expect(formatSpentOn("2026-12-31")).toBe("12월 31일");
  });

  it("날짜가 아닌 값은 그대로 통과시킨다 -- 비세션 픽셀락 미리보기 픽스처가 안 바뀌도록", () => {
    // app/(tabs)/index.tsx의 previewHome.recentExpenses가 쓰는 고정 문자열.
    expect(formatSpentOn("오늘")).toBe("오늘");
    expect(formatSpentOn("05.20")).toBe("05.20");
    expect(formatSpentOn("2026-08")).toBe("2026-08");
  });

  it("숫자로 못 읽는 조각은 'NaN월 NaN일' 대신 원본을 보여준다", () => {
    expect(formatSpentOn("2026-ab-cd")).toBe("2026-ab-cd");
    expect(formatSpentOn("")).toBe("");
  });
});

describe("HOME-124 homeRecentExpenseSubtitle", () => {
  it("홈 행 부제도 기록 탭과 같은 날짜 포맷을 쓴다 (ISO 원본 노출 금지)", () => {
    expect(homeRecentExpenseSubtitle({ expenseType: "expense", spentOn: "2026-08-27" })).toBe("8월 27일");
    // 회귀 방지: 예전 홈은 subtitle={expense.spentOn}이라 이 값이 그대로 보였다.
    expect(homeRecentExpenseSubtitle({ expenseType: "expense", spentOn: "2026-08-27" })).not.toContain("2026-08-27");
  });

  it("DNC-015: 구분 접두사는 recordsRowSubtitle 규칙을 그대로 재사용한다 ('선물 ·' / '환불 ·')", () => {
    expect(homeRecentExpenseSubtitle({ expenseType: "gift", spentOn: "2026-08-04" })).toBe("선물 · 8월 4일");
    expect(homeRecentExpenseSubtitle({ expenseType: "refund", spentOn: "2026-08-04" })).toBe("환불 · 8월 4일");
    // 카테고리만 빠졌을 뿐 기록 탭 행과 같은 문자열 규칙이다.
    expect(homeRecentExpenseSubtitle({ expenseType: "gift", spentOn: "2026-08-04" })).toBe(
      recordsRowSubtitle({ expenseType: "gift", categoryLabel: null, dateLabel: "8월 4일" })
    );
  });

  it("expenseType이 없거나 모르는 값이면 접두사 없이 날짜만 (없는 구분을 지어내지 않는다)", () => {
    expect(homeRecentExpenseSubtitle({ spentOn: "2026-08-04" })).toBe("8월 4일");
    expect(homeRecentExpenseSubtitle({ expenseType: null, spentOn: "2026-08-04" })).toBe("8월 4일");
    expect(homeRecentExpenseSubtitle({ expenseType: "future_type", spentOn: "2026-08-04" })).toBe("8월 4일");
  });

  it("픽셀락: 미리보기 픽스처 3건은 예전 출력(= spentOn 원본)과 완전히 동일하다", () => {
    for (const spentOn of ["오늘", "05.20", "05.19"]) {
      expect(homeRecentExpenseSubtitle({ expenseType: "expense", spentOn })).toBe(spentOn);
    }
  });
});

describe("HOME-124 홈 화면 배선 (app/(tabs)/index.tsx)", () => {
  const homeSource = readFileSync(join(mobileRoot, "app/(tabs)/index.tsx"), "utf8");

  it("최근 지출 행 부제를 공용 헬퍼로 만든다 -- ISO 원본을 직접 그리지 않는다", () => {
    expect(homeSource).toContain('import { homeRecentExpenseSubtitle } from "../../src/expenses/records-list-view";');
    expect(homeSource).toContain("subtitle={homeRecentExpenseSubtitle(expense)}");
    expect(homeSource).not.toContain("subtitle={expense.spentOn}");
  });

  it("미리보기 픽스처 분기는 건드리지 않는다 (HOME-001 캡처 경로)", () => {
    expect(homeSource).toContain('spentOn: "오늘"');
    expect(homeSource).toContain('spentOn: "05.20"');
    expect(homeSource).toContain("const visibleHome = hasSession ? home.data! : previewHome;");
  });
});

describe("기록 화면 배선 (app/(tabs)/records.tsx)", () => {
  const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");

  it("HOME-124: formatSpentOn을 지역 정의가 아니라 공용 모듈에서 가져온다", () => {
    expect(recordsSource).toContain('formatSpentOn, recordsRowSubtitle } from "../../src/expenses/records-list-view"');
    expect(recordsSource).not.toContain("function formatSpentOn(");
  });

  it("C1: 칩과 이름 해석을 같은 ['categories'] 응답에서 가져온다", () => {
    expect(recordsSource).toContain('queryKey: ["categories"]');
    expect(recordsSource).toContain("buildRecordsCategoryChips(serverCategories, selectedCategoryId)");
    expect(recordsSource).toContain("buildCategoryNameLookup(serverCategories)");
  });

  it("CAT-124: 그 하나의 응답은 전량(includeAll=1)이어야 한다 — 칩은 좁히고 이름은 전부 푼다", () => {
    expect(recordsSource).toContain("listCategories(authToken!, { includeAll: true })");
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
