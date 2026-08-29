import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";
import { EXPENSE_VIEW_ONLY_EMPTY_TITLE } from "../family/record-permissions";
import { groupExpensesByDate } from "./records-date-groups";
import {
  matchRecordSearch,
  normalizeRecordSearchText,
  RECORD_SEARCH_SPANNING_LABEL,
  MEMO_SEARCH_SNIPPET_MAX_LENGTH,
  MERCHANT_SEARCH_SNIPPET_LABEL,
  RECORDS_SEARCH_FIELDS_LABEL,
  RECORDS_SEARCH_PLACEHOLDER,
  buildRecordsCategoryChips,
  buildRecordsEmptyMonthState,
  buildRecordsFilteredEmptyState,
  buildRecordsFilterScopeSummary,
  buildRecordsMonthSummary,
  buildRecordsSearchMonthJumpAction,
  buildRecordsSearchPreviousMonthAction,
  buildRecordsSearchScopeNotice,
  RECORDS_EMPTY_MONTH_CALENDAR_ACTION_LABEL,
  RECORDS_EMPTY_MONTH_CURRENT_ACTION_LABEL,
  RECORDS_SEARCH_PREVIOUS_MONTH_ACTION_LABEL,
  expenseCreatedByUserId,
  expenseTypeLabelKo,
  expenseTypeSubtitlePrefix,
  formatSpentOn,
  homeRecentExpenseSubtitle,
  recordsRowSubtitle,
  resolveExpenseAuthorLabel,
  resolveExpenseHouseholdId
} from "./records-list-view";

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
      expect(chips[0].label).toBe(categoryCatalog[0].label);
      expect(chips[0].matchIds).toEqual([categoryCatalog[0].id]);
    }
  });

  /**
   * 라운드 34 L7이 지키려던 요지: **문장으로 흘러가는 이름**(plainLabel)에는 아이콘이 섞이지
   * 않는다 -- 스코프 줄/달력 라벨 한가운데 아이콘이 끼면 스크린리더가 아이콘을 카테고리 이름처럼
   * 읽는다.
   *
   * D1 후속(실기기 피드백 2): 카탈로그의 `icon`이 텍스트 글리프에서 Ionicons **이름**
   * ("water-outline" …)으로 바뀌면서, 폴백 칩이 그것을 라벨 앞에 붙이면 칩에 "water-outline
   * 기저귀"가 적힌다. 그래서 폴백도 서버 목록 경로와 같이 이름만 쓴다 -- L7의 요지(문장에
   * 아이콘 금지)는 오히려 더 강해졌다: 이제 **표시 라벨에도** 아이콘 문자열이 없다.
   */
  it("L7: 폴백 칩의 표시 라벨과 문장용 plainLabel 어디에도 아이콘 문자열이 없다", () => {
    const fallback = buildRecordsCategoryChips([], null);
    for (const [index, chip] of fallback.entries()) {
      const entry = categoryCatalog[index];
      expect(chip.label).toBe(entry.label);
      expect(chip.plainLabel).toBe(entry.label);
      expect(chip.label).not.toContain(entry.icon);
      expect(chip.plainLabel).not.toContain(entry.icon);
    }

    // 서버 목록에서 온 칩은 두 값이 같다(이름에 아이콘이 없다).
    for (const chip of buildRecordsCategoryChips(serverCategories, null)) {
      expect(chip.plainLabel).toBe(chip.label);
    }
  });

  it("L7: 폴백 칩 이름으로 만든 스코프 줄에 이모지가 흘러들지 않는다", () => {
    const chip = buildRecordsCategoryChips([], null)[0];
    const summary = buildRecordsFilterScopeSummary({
      categoryLabel: chip.plainLabel,
      categoryFiltered: true,
      recordCount: 3,
      totalKrw: 45_000
    })!;

    expect(summary.text).toBe(`${categoryCatalog[0].label} 필터: 3건 · 45,000원`);
    expect(summary.accessibilityLabel).not.toContain(categoryCatalog[0].icon);
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

describe("FAM-127 expenseCreatedByUserId", () => {
  it("서버 DTO의 createdByUserId를 꺼낸다", () => {
    expect(expenseCreatedByUserId({ id: "e-1", createdByUserId: "user-b" })).toBe("user-b");
  });

  it("없거나 문자열이 아니면 undefined -- 구버전 서버·로컬 목업·오프라인 대기 행에서 조용히 생략된다", () => {
    expect(expenseCreatedByUserId({ id: "e-1" })).toBeUndefined();
    expect(expenseCreatedByUserId({ id: "e-1", createdByUserId: null })).toBeUndefined();
    expect(expenseCreatedByUserId({ id: "e-1", createdByUserId: "" })).toBeUndefined();
    expect(expenseCreatedByUserId({ id: "e-1", createdByUserId: 42 })).toBeUndefined();
    expect(expenseCreatedByUserId(undefined)).toBeUndefined();
    expect(expenseCreatedByUserId(null)).toBeUndefined();
    expect(expenseCreatedByUserId("not-an-object")).toBeUndefined();
  });
});

describe("FAM-127 resolveExpenseAuthorLabel", () => {
  const members = [
    { userId: "user-a", displayName: "다온맘" },
    { userId: "user-b", displayName: "다온빠" }
  ];

  it("구성원이 2명 이상이면 작성자 이름을 돌려준다", () => {
    expect(resolveExpenseAuthorLabel("user-a", members)).toBe("다온맘");
    expect(resolveExpenseAuthorLabel("user-b", members)).toBe("다온빠");
  });

  it("1인 가구에서는 절대 표시하지 않는다 -- 모든 행에 같은 이름이 붙을 뿐이라 소음이다", () => {
    expect(resolveExpenseAuthorLabel("user-a", [members[0]])).toBeNull();
    expect(resolveExpenseAuthorLabel("user-a", [])).toBeNull();
  });

  it("목록을 아직 모르면(로딩·실패·로그아웃) 표시하지 않는다", () => {
    expect(resolveExpenseAuthorLabel("user-a", undefined)).toBeNull();
  });

  it("작성자 id가 없거나 목록에 없으면 표시하지 않는다 (내보내진 구성원의 옛 기록 등)", () => {
    expect(resolveExpenseAuthorLabel(undefined, members)).toBeNull();
    expect(resolveExpenseAuthorLabel("user-zzz", members)).toBeNull();
  });

  it("빈 이름은 '· ' 빈 접두 대신 미표시 -- 허위/빈 표시 금지", () => {
    expect(resolveExpenseAuthorLabel("user-a", [{ userId: "user-a", displayName: "   " }, members[1]])).toBeNull();
  });

  it("내가 적은 행도 똑같이 이름을 붙인다 (미표시가 '나'와 '해석 실패' 둘을 뜻하면 안 된다)", () => {
    // 'user-a'가 나 자신이어도 규칙은 동일하다 -- 모듈은 '나'가 누구인지 알 필요가 없다.
    expect(resolveExpenseAuthorLabel("user-a", members)).toBe("다온맘");
  });

  it("초대 수락 전(pending) 구성원은 2명 판정에 넣지 않는다 -- 혼자인데 이름이 붙으면 안 된다", () => {
    // GET /households/:id/members는 active와 pending을 함께 내려준다(서버 listMembers).
    // 초대만 보내 둔 1인 가구에서 라벨이 켜지면 모든 행에 내 이름만 반복된다.
    const soloWithPendingInvite = [
      { userId: "user-a", displayName: "다온맘", status: "active" },
      { userId: "user-b", displayName: "다온빠", status: "pending" }
    ];
    expect(resolveExpenseAuthorLabel("user-a", soloWithPendingInvite)).toBeNull();

    // 상대가 수락하면(active) 그때부터 표시된다.
    const bothJoined = [
      { userId: "user-a", displayName: "다온맘", status: "active" },
      { userId: "user-b", displayName: "다온빠", status: "active" }
    ];
    expect(resolveExpenseAuthorLabel("user-a", bothJoined)).toBe("다온맘");
  });

  it("status가 없는 목록(로컬 목업·구버전)은 active로 본다", () => {
    expect(resolveExpenseAuthorLabel("user-a", members)).toBe("다온맘");
    expect(resolveExpenseAuthorLabel("user-a", [{ userId: "user-a", displayName: "다온맘", status: null }, members[1]])).toBe(
      "다온맘"
    );
  });
});

/**
 * 라운드 27 L-4: 작성자 라벨을 물어볼 가구는 세션의 기본 가구가 아니라 **보고 있는 아이의
 * 가구**다. 1가구 계정에서는 두 값이 같아 동작이 한 글자도 바뀌지 않아야 하고, 다가구 계정에서만
 * 결과가 달라져야 한다.
 */
describe("라운드 27 L-4 resolveExpenseHouseholdId", () => {
  // 1가구 계정: 아이의 가구 == 세션 기본 가구.
  const singleHousehold = [{ id: "child-daon", householdId: "household-1" }];
  // 다가구 계정: 기본 가구(2인)와, 배우자 쪽 1인 가구의 아이가 함께 있다.
  const multiHousehold = [
    { id: "child-daon", householdId: "household-1" },
    { id: "child-sol", householdId: "household-2" }
  ];

  it("1가구 계정: 예전과 같은 가구를 고른다 (동작 불변)", () => {
    expect(
      resolveExpenseHouseholdId({
        children: singleHousehold,
        childId: "child-daon",
        fallbackHouseholdId: "household-1"
      })
    ).toBe("household-1");
  });

  it("다가구 계정: 기본 가구가 아니라 선택한 아이의 가구를 고른다", () => {
    // 기본 가구는 household-1이지만, 보고 있는 아이는 household-2 소속이다.
    expect(
      resolveExpenseHouseholdId({
        children: multiHousehold,
        childId: "child-sol",
        fallbackHouseholdId: "household-1"
      })
    ).toBe("household-2");
    // 반대 방향도 같다 -- 아이를 바꾸면 물어보는 가구도 함께 바뀐다.
    expect(
      resolveExpenseHouseholdId({
        children: multiHousehold,
        childId: "child-daon",
        fallbackHouseholdId: "household-2"
      })
    ).toBe("household-1");
  });

  it("모르면 추측하지 않는다: 아이 미선택 · 목록 미도착 · 목록에 없는 아이는 null", () => {
    // 아직 아이를 고르지 않았다.
    expect(resolveExpenseHouseholdId({ children: multiHousehold, childId: null, fallbackHouseholdId: "household-1" })).toBeNull();
    // ["children"] 캐시가 아직 없다(로딩·실패) -- 여기서 기본 가구로 폴백하면 다가구 계정에서
    // 잠깐 틀린 가구의 라벨이 그려진다.
    expect(resolveExpenseHouseholdId({ children: undefined, childId: "child-sol", fallbackHouseholdId: "household-1" })).toBeNull();
    expect(resolveExpenseHouseholdId({ children: null, childId: "child-sol", fallbackHouseholdId: "household-1" })).toBeNull();
    // 목록에 없는 아이(삭제됨·다른 계정의 잔여 선택값).
    expect(resolveExpenseHouseholdId({ children: [], childId: "child-sol", fallbackHouseholdId: "household-1" })).toBeNull();
    expect(
      resolveExpenseHouseholdId({ children: singleHousehold, childId: "child-sol", fallbackHouseholdId: "household-1" })
    ).toBeNull();
  });

  it("아이를 찾았는데 householdId가 비어 있으면 그때만 폴백을 쓴다 (구버전 캐시·목업)", () => {
    expect(
      resolveExpenseHouseholdId({
        children: [{ id: "child-daon" }],
        childId: "child-daon",
        fallbackHouseholdId: "local-household-daon"
      })
    ).toBe("local-household-daon");
    expect(
      resolveExpenseHouseholdId({
        children: [{ id: "child-daon", householdId: "  " }],
        childId: "child-daon",
        fallbackHouseholdId: "local-household-daon"
      })
    ).toBe("local-household-daon");
    // 폴백조차 없으면 라벨을 생략한다 (FAM-127: 자리표시자를 만들지 않는다).
    expect(resolveExpenseHouseholdId({ children: [{ id: "child-daon", householdId: null }], childId: "child-daon" })).toBeNull();
  });
});

describe("FAM-127 recordsRowSubtitle 작성자 표기", () => {
  it("작성자가 있으면 카테고리 앞에 붙는다 -- '다온맘 · 기저귀 · 8월 4일'", () => {
    expect(
      recordsRowSubtitle({ expenseType: "expense", authorLabel: "다온맘", categoryLabel: "기저귀", dateLabel: "8월 4일" })
    ).toBe("다온맘 · 기저귀 · 8월 4일");
  });

  it("구분 접두사는 계속 맨 앞이다 -- '선물 · 다온맘 · 기저귀 · 8월 4일'", () => {
    expect(
      recordsRowSubtitle({ expenseType: "gift", authorLabel: "다온맘", categoryLabel: "기저귀", dateLabel: "8월 4일" })
    ).toBe("선물 · 다온맘 · 기저귀 · 8월 4일");
    expect(
      recordsRowSubtitle({ expenseType: "refund", authorLabel: "다온빠", categoryLabel: "기저귀", dateLabel: "8월 4일" })
    ).toBe("환불 · 다온빠 · 기저귀 · 8월 4일");
  });

  it("하위 호환: authorLabel을 넘기지 않으면 이 기능 이전과 완전히 같은 문자열이다", () => {
    // 홈(homeRecentExpenseSubtitle -> app/(tabs)/index.tsx)이 그대로 쓰는 경로.
    expect(recordsRowSubtitle({ expenseType: "expense", categoryLabel: "기저귀", dateLabel: "8월 4일" })).toBe("기저귀 · 8월 4일");
    expect(recordsRowSubtitle({ expenseType: "gift", categoryLabel: "기저귀", dateLabel: "8월 4일" })).toBe("선물 · 기저귀 · 8월 4일");
  });

  it("1인 가구(=null)·빈 문자열은 접두를 만들지 않는다", () => {
    for (const authorLabel of [null, undefined, "", "   "]) {
      expect(recordsRowSubtitle({ expenseType: "expense", authorLabel, categoryLabel: "기저귀", dateLabel: "8월 4일" })).toBe(
        "기저귀 · 8월 4일"
      );
    }
  });
});

describe("CSV-127 expenseTypeLabelKo / expenseTypeSubtitlePrefix", () => {
  it("CSV 열은 일반 지출도 '지출'로 명시한다 (열이 비면 안 된다)", () => {
    expect(expenseTypeLabelKo("expense")).toBe("지출");
    expect(expenseTypeLabelKo("gift")).toBe("선물");
    expect(expenseTypeLabelKo("refund")).toBe("환불");
  });

  it("목록 행 접두사는 기본값 '지출'을 붙이지 않는다 (거의 모든 행에 같은 단어 = 소음)", () => {
    expect(expenseTypeSubtitlePrefix("expense")).toBeNull();
    expect(expenseTypeSubtitlePrefix("gift")).toBe("선물");
    expect(expenseTypeSubtitlePrefix("refund")).toBe("환불");
  });

  it("모르는 값: CSV는 원본 통과, 행 접두사는 미표시 (없는 구분을 지어내지 않는다)", () => {
    expect(expenseTypeLabelKo("future_type")).toBe("future_type");
    expect(expenseTypeLabelKo(null)).toBe("");
    expect(expenseTypeLabelKo(undefined)).toBe("");
    expect(expenseTypeSubtitlePrefix("future_type")).toBeNull();
    expect(expenseTypeSubtitlePrefix(null)).toBeNull();
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
    // 라운드 49 C-07: 픽스처로 떨어지는 조건이 `hasSession`(= 토큰 AND 아이)에서 **비세션**
    // 하나로 좁혀졌다. 토큰이 있는데 아이가 아직 없는 창에서 이 3건이 실사용자 홈에 뜨던 것을
    // 막는다 -- 계약 본체는 src/real-session-data-integrity.test.ts.
    expect(homeSource).toContain("const visibleHome = authToken ? home.data! : previewHome;");
  });
});

/**
 * F8: 필터가 걸렸을 때 상단 요약이 **무엇의 합인지** 밝히는 스코프 줄.
 *
 * 고정하려는 것:
 *  1. 무필터(전체)에서는 null -- 기존 화면이 한 글자도 바뀌지 않는다;
 *  2. 라벨이 스코프를 정확히 말한다(카테고리 이름 / 검색 / 둘 다), 이름을 모르면 지어내지 않는다;
 *  3. 수치가 **일별 소계의 합**과 정확히 일치한다(groupExpensesByDate와 맞대어 검산).
 */
describe("F8 buildRecordsFilterScopeSummary", () => {
  it("필터가 하나도 없으면 null (전체 = 기존 표시 그대로)", () => {
    expect(buildRecordsFilterScopeSummary({ recordCount: 42, totalKrw: 1_200_000 })).toBeNull();
    expect(
      buildRecordsFilterScopeSummary({ categoryLabel: null, searchText: "   ", recordCount: 42, totalKrw: 1_200_000 })
    ).toBeNull();
  });

  it("카테고리 칩만 켜졌을 때 -- 칩 이름 · 건수 · 필터된 합계", () => {
    const summary = buildRecordsFilterScopeSummary({
      categoryLabel: "기저귀/위생",
      categoryFiltered: true,
      recordCount: 12,
      totalKrw: 180_000
    });

    expect(summary).not.toBeNull();
    expect(summary!.scopeLabel).toBe("기저귀/위생 필터");
    expect(summary!.text).toBe("기저귀/위생 필터: 12건 · 180,000원");
    expect(summary!.accessibilityLabel).toBe("기저귀/위생 필터, 12건, 합계 180,000원");
    expect(summary!.recordCount).toBe(12);
    expect(summary!.totalKrw).toBe(180_000);
  });

  it("검색만 켜졌을 때 / 둘 다 켜졌을 때 스코프를 둘 다 밝힌다", () => {
    expect(buildRecordsFilterScopeSummary({ searchText: "기저귀", recordCount: 3, totalKrw: 45_000 })!.text).toBe(
      "검색 결과: 3건 · 45,000원"
    );
    expect(
      buildRecordsFilterScopeSummary({
        categoryLabel: "수유/이유식",
        categoryFiltered: true,
        searchText: " 분유 ",
        recordCount: 2,
        totalKrw: 30_000
      })!.scopeLabel
    ).toBe("수유/이유식 필터 · 검색 결과");
  });

  it("칩 라벨을 못 찾아도 카테고리 이름을 지어내지 않는다 (허위 표시 금지)", () => {
    const summary = buildRecordsFilterScopeSummary({
      categoryLabel: null,
      categoryFiltered: true,
      recordCount: 0,
      totalKrw: 0
    });

    expect(summary!.scopeLabel).toBe("카테고리 필터");
    expect(summary!.text).toBe("카테고리 필터: 0건 · 0원");
  });

  it("음수/비유한 입력은 0으로 떨어뜨린다 (NaN원 표시 금지)", () => {
    const summary = buildRecordsFilterScopeSummary({
      categoryLabel: "기타",
      categoryFiltered: true,
      recordCount: Number.NaN,
      totalKrw: -1
    });

    expect(summary!.text).toBe("기타 필터: 0건 · 0원");
  });

  it("수치가 화면의 일별 소계 합과 정확히 일치한다 (선물·환불은 소계에서 빠지고 건수에는 남는다)", () => {
    // 카테고리 칩이 "기저귀/위생"으로 걸린 뒤 화면에 남는 행(= listData)을 그대로 흉내 낸다.
    const filteredRows = [
      { spentOn: "2026-08-27", amountKrw: 12_000, expenseType: "expense" },
      { spentOn: "2026-08-27", amountKrw: 8_000, expenseType: "expense" },
      { spentOn: "2026-08-26", amountKrw: 30_000 }, // 레거시(구분 없음) = 지출로 센다
      { spentOn: "2026-08-25", amountKrw: 50_000, expenseType: "gift" }, // 소계 제외, 목록에는 보인다
      { spentOn: "2026-08-24", amountKrw: 5_000, expenseType: "refund" } // 소계 제외
    ];

    // 화면이 하는 것과 같은 계산: 날짜 그룹의 소계를 그대로 더한다.
    const dateGroups = groupExpensesByDate(filteredRows, "2026-08-27");
    const dailySubtotalSum = dateGroups.reduce((sum, group) => sum + group.subtotalKrw, 0);

    const summary = buildRecordsFilterScopeSummary({
      categoryLabel: "기저귀/위생",
      categoryFiltered: true,
      recordCount: filteredRows.length,
      totalKrw: dailySubtotalSum
    });

    expect(dailySubtotalSum).toBe(50_000); // 12,000 + 8,000 + 30,000
    expect(summary!.totalKrw).toBe(dailySubtotalSum);
    expect(summary!.text).toBe("기저귀/위생 필터: 5건 · 50,000원");
    // 소계가 감춰지는 날(선물·환불만 있는 날)의 subtotalKrw는 0이라 더해도 합이 흔들리지 않는다.
    expect(dateGroups.filter((group) => !group.hasSubtotal).map((group) => group.subtotalKrw)).toEqual([0, 0]);
  });
});

/**
 * 라운드 39 UX-P: 기록 탭이 "이번 달"이라고 하드코딩해 두던 두 문장(헤더 부제 · 월 요약 줄)이
 * 과거 달을 볼 때 사실과 어긋났다. 요약 줄을 만드는 순수 함수가 그 사실을 진다.
 */
describe("UX-P buildRecordsMonthSummary", () => {
  it("보고 있는 달의 라벨로 말한다 -- 과거 달에서도 '이번 달'이라고 하지 않는다", () => {
    const summary = buildRecordsMonthSummary({ monthLabel: "2026년 6월", recordCount: 42, totalKrw: 1_200_000 });

    expect(summary.text).toBe("2026년 6월 42건 · 합계 1,200,000원");
    expect(summary.text).not.toContain("이번 달");
  });

  it("이번 달을 보고 있을 때도 같은 규칙이다 (달 이름이 곧 라벨)", () => {
    expect(buildRecordsMonthSummary({ monthLabel: "2026년 8월", recordCount: 3, totalKrw: 45_000 }).text).toBe(
      "2026년 8월 3건 · 합계 45,000원"
    );
  });

  it("접근성 라벨은 F8 스코프 줄·섹션 헤더와 같은 관례다 ('·' → 쉼표, 금액 앞 '합계')", () => {
    const summary = buildRecordsMonthSummary({ monthLabel: "2026년 6월", recordCount: 42, totalKrw: 1_200_000 });

    expect(summary.accessibilityLabel).toBe("2026년 6월 42건, 합계 1,200,000원");
  });

  it("기록이 없는 달도 0건 · 0원으로 정직하게 말한다", () => {
    expect(buildRecordsMonthSummary({ monthLabel: "2026년 5월", recordCount: 0, totalKrw: 0 }).text).toBe(
      "2026년 5월 0건 · 합계 0원"
    );
  });

  it("음수·NaN 같은 망가진 값은 0으로 떨어뜨린다 (F8 스코프 줄과 같은 정규화)", () => {
    expect(buildRecordsMonthSummary({ monthLabel: "2026년 5월", recordCount: -3, totalKrw: Number.NaN }).text).toBe(
      "2026년 5월 0건 · 합계 0원"
    );
  });

  it("달 라벨을 모르면 없는 달 이름을 지어내지 않고 건수·합계만 말한다", () => {
    const summary = buildRecordsMonthSummary({ monthLabel: "  ", recordCount: 2, totalKrw: 10_000 });

    expect(summary.text).toBe("2건 · 합계 10,000원");
    expect(summary.accessibilityLabel).toBe("2건, 합계 10,000원");
  });
});

/**
 * 라운드 39 UX-P: 기록 탭 검색은 보고 있는 한 달치 응답에만 걸리는데 화면 어디에도 그 사실이
 * 없었다 -- 0건 화면이 "이 앱에 그런 기록이 없다"로 읽혔다.
 */
describe("UX-P buildRecordsSearchScopeNotice", () => {
  it("검색어가 있을 때만 범위를 밝힌다", () => {
    expect(buildRecordsSearchScopeNotice({ searchText: "유모차", monthLabel: "2026년 8월" })).toBe(
      "'유모차' 검색은 2026년 8월의 품목명, 판매처, 메모에서만 찾아요"
    );
  });

  it("검색어가 없으면(빈 값·공백·null·undefined) null -- 화면이 한 글자도 바뀌지 않는다", () => {
    for (const searchText of ["", "   ", null, undefined]) {
      expect(buildRecordsSearchScopeNotice({ searchText, monthLabel: "2026년 8월" })).toBeNull();
    }
  });

  it("달이 바뀌면 문장의 달도 함께 바뀐다 (화면의 월 라벨을 그대로 받는다)", () => {
    expect(buildRecordsSearchScopeNotice({ searchText: "유모차", monthLabel: "2026년 6월" })).toBe(
      "'유모차' 검색은 2026년 6월의 품목명, 판매처, 메모에서만 찾아요"
    );
  });

  it("검색어 앞뒤 공백은 화면의 필터링과 같은 기준으로 다듬는다", () => {
    expect(buildRecordsSearchScopeNotice({ searchText: "  유모차  ", monthLabel: "2026년 8월" })).toBe(
      "'유모차' 검색은 2026년 8월의 품목명, 판매처, 메모에서만 찾아요"
    );
  });

  it("달 라벨을 모르면 범위를 반만 말하지 않는다 (아예 생략)", () => {
    expect(buildRecordsSearchScopeNotice({ searchText: "유모차", monthLabel: "" })).toBeNull();
  });
});

/**
 * 라운드 39 UX-P: 0건 카드가 제안하던 유일한 다음 행동이 "검색어 지우기"(= 찾기 포기)였다.
 */
describe("UX-P buildRecordsSearchPreviousMonthAction", () => {
  it("검색 중일 때만 보조 액션이 생긴다", () => {
    const action = buildRecordsSearchPreviousMonthAction({ searchText: "유모차", previousMonthLabel: "2026년 7월" });

    expect(action).not.toBeNull();
    expect(action!.label).toBe(RECORDS_SEARCH_PREVIOUS_MONTH_ACTION_LABEL);
    expect(action!.label).toBe("지난달에서 찾기");
  });

  it("검색어가 없으면 null -- 카테고리 필터만 걸린 0건 카드는 예전 그대로다", () => {
    for (const searchText of ["", "   ", null, undefined]) {
      expect(buildRecordsSearchPreviousMonthAction({ searchText, previousMonthLabel: "2026년 7월" })).toBeNull();
    }
  });

  it("스크린리더에는 '지난달' 대신 실제 달 이름과 검색어를 말한다 (어디로 가는지가 문장 안에)", () => {
    const action = buildRecordsSearchPreviousMonthAction({ searchText: " 유모차 ", previousMonthLabel: "2026년 7월" });

    expect(action!.accessibilityLabel).toBe("2026년 7월에서 '유모차' 계속 찾기");
  });

  it("달 이름을 모르면 지어내지 않고 보이는 라벨을 그대로 읽어준다", () => {
    const action = buildRecordsSearchPreviousMonthAction({ searchText: "유모차", previousMonthLabel: "  " });

    expect(action!.accessibilityLabel).toBe("지난달에서 찾기");
  });
});

/**
 * 라운드 39 I-4 — 카테고리 칩과 검색이 함께 걸린 0건 카드가 한 가지 이야기만 하던 문제.
 */
describe("I-4 buildRecordsSearchPreviousMonthAction — 필터 동반 고지", () => {
  it("카테고리 필터가 켜져 있으면 그 필터를 들고 간다는 사실을 스크린리더에 말한다", () => {
    const action = buildRecordsSearchPreviousMonthAction({
      searchText: "유모차",
      previousMonthLabel: "2026년 7월",
      categoryFiltered: true,
      categoryLabel: "기저귀/위생"
    });

    expect(action!.accessibilityLabel).toBe("2026년 7월에서 '유모차' 계속 찾기(기저귀/위생 필터 유지)");
    // 보이는 라벨은 자리가 좁아 그대로다.
    expect(action!.label).toBe(RECORDS_SEARCH_PREVIOUS_MONTH_ACTION_LABEL);
  });

  it("필터 이름을 모르면 지어내지 않고 '카테고리 필터'라고만 말한다", () => {
    const action = buildRecordsSearchPreviousMonthAction({
      searchText: "유모차",
      previousMonthLabel: "2026년 7월",
      categoryFiltered: true,
      categoryLabel: null
    });

    expect(action!.accessibilityLabel).toBe("2026년 7월에서 '유모차' 계속 찾기(카테고리 필터 유지)");
  });

  it("필터가 없으면 문장이 예전과 한 글자도 다르지 않다", () => {
    const action = buildRecordsSearchPreviousMonthAction({
      searchText: "유모차",
      previousMonthLabel: "2026년 7월",
      categoryFiltered: false,
      categoryLabel: "기저귀/위생"
    });

    expect(action!.accessibilityLabel).toBe("2026년 7월에서 '유모차' 계속 찾기");
  });
});

describe("I-4 buildRecordsFilteredEmptyState", () => {
  it("검색 + 카테고리 필터: 검색 프레이밍이 제목이고, 기본 액션은 그 필터 해제다", () => {
    expect(
      buildRecordsFilteredEmptyState({
        searchText: " 유모차 ",
        categoryFiltered: true,
        categoryLabel: "기저귀/위생"
      })
    ).toEqual({
      title: "'유모차' 검색 결과가 없어요.",
      actionLabel: "기저귀/위생 필터 해제",
      action: "clear-category"
    });
  });

  it("카테고리 필터만: 종전 제목 그대로이고 액션 라벨에 필터 이름이 들어간다", () => {
    expect(buildRecordsFilteredEmptyState({ categoryFiltered: true, categoryLabel: "기저귀/위생" })).toEqual({
      title: "이 카테고리의 기록이 없어요.",
      actionLabel: "기저귀/위생 필터 해제",
      action: "clear-category"
    });
    // 이름을 모르면 지어내지 않는다.
    expect(buildRecordsFilteredEmptyState({ categoryFiltered: true, categoryLabel: "  " })?.actionLabel).toBe(
      "카테고리 필터 해제"
    );
  });

  it("검색만: 무엇을 찾았는지 제목에 싣고 검색어 지우기를 제안한다", () => {
    expect(buildRecordsFilteredEmptyState({ searchText: "유모차" })).toEqual({
      title: "'유모차' 검색 결과가 없어요.",
      actionLabel: "검색어 지우기",
      action: "clear-search"
    });
  });

  it("아무 필터도 없으면 null -- 그 달에 기록이 없다는 뜻이라 다른 카드를 그린다", () => {
    expect(buildRecordsFilteredEmptyState({})).toBeNull();
    expect(buildRecordsFilteredEmptyState({ searchText: "   ", categoryFiltered: false })).toBeNull();
  });
});

/**
 * 라운드 39 I-5 — 달을 옮겨도 "이번 달"이라고 말하던 마지막 한 곳.
 * GAP-067 트랙 A(#2) — 끝난 달에서는 문장의 **틀 자체**가 거짓이 됐다("첫 기록"·오늘로 저장).
 */
describe("I-5 / GAP-067 buildRecordsEmptyMonthState", () => {
  it("현재 달에서는 홈 화면과 같은 문구·같은 액션이다", () => {
    expect(buildRecordsEmptyMonthState({ monthLabel: "2026년 8월", isCurrentMonth: true })).toEqual({
      title: "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.",
      actionLabel: "기록하기",
      action: "record"
    });
  });

  it("이번 달 갈래는 달력 보기에서도 한 글자도 바뀌지 않는다", () => {
    expect(
      buildRecordsEmptyMonthState({ monthLabel: "2026년 8월", isCurrentMonth: true, isCalendarView: true })
    ).toEqual({
      title: "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.",
      actionLabel: "기록하기",
      action: "record"
    });
  });

  /**
   * GAP-067 #2의 본체 — 800건을 적어 온 사람에게 "첫 기록"이라고 말하지 않는다. 그리고 그 달의
   * 액션은 **오늘로 저장하는 [기록하기]**가 아니라 그 달에서 실제로 할 수 있는 일이다.
   */
  it("끝난 달에서는 약속 대신 사실을 말하고, 달력 보기로 보낸다", () => {
    expect(buildRecordsEmptyMonthState({ monthLabel: "2025년 11월", isCurrentMonth: false })).toEqual({
      title: "2025년 11월에는 기록이 없어요.",
      actionLabel: RECORDS_EMPTY_MONTH_CALENDAR_ACTION_LABEL,
      action: "open-calendar"
    });
    // 종전 문장의 틀("첫 기록을 남기면 …")은 끝난 달에서 사라졌다.
    expect(buildRecordsEmptyMonthState({ monthLabel: "2025년 11월", isCurrentMonth: false }).title).not.toContain(
      "첫 기록"
    );
  });

  it("이미 달력을 보고 있으면 보낼 곳이 없다 -- 이번 달로 되돌리는 쪽을 제안한다", () => {
    expect(
      buildRecordsEmptyMonthState({ monthLabel: "2025년 11월", isCurrentMonth: false, isCalendarView: true })
    ).toEqual({
      title: "2025년 11월에는 기록이 없어요.",
      actionLabel: RECORDS_EMPTY_MONTH_CURRENT_ACTION_LABEL,
      action: "go-current-month"
    });
  });

  it("달 라벨을 모르면 지어내지 않고 종전 문구를 쓴다 (이름 없이는 끝난 달도 말할 수 없다)", () => {
    expect(buildRecordsEmptyMonthState({ monthLabel: "   ", isCurrentMonth: false })).toEqual({
      title: "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.",
      actionLabel: "기록하기",
      action: "record"
    });
  });

  /**
   * 라운드 40 J-5 — "첫 기록을 남기면 …"은 보기 전용 참여자가 만족시킬 수 없는 조건이다.
   * 홈의 빈 카드와 **같은 문장**으로 바꾼다(단일 소스: src/family/record-permissions.ts).
   * GAP-067: 이 갈래는 **한 칸도 바뀌지 않는다** — 액션도 종전 [기록하기] 그대로다(누르면
   * 화면이 잠금을 설명한다).
   */
  it("J-5: 보기 전용 세션에서는 약속 대신 사실을 말한다 (어느 달·어느 보기에서도 불변)", () => {
    for (const isCurrentMonth of [true, false]) {
      for (const isCalendarView of [true, false]) {
        expect(
          buildRecordsEmptyMonthState({
            monthLabel: "2026년 6월",
            isCurrentMonth,
            isCalendarView,
            expenseEntryLocked: true
          })
        ).toEqual({ title: EXPENSE_VIEW_ONLY_EMPTY_TITLE, actionLabel: "기록하기", action: "record" });
      }
    }
  });

  it("J-5: 잠기지 않은 세션(기본값)에서는 한 글자도 바뀌지 않는다", () => {
    expect(
      buildRecordsEmptyMonthState({ monthLabel: "2026년 8월", isCurrentMonth: true, expenseEntryLocked: false }).title
    ).toBe("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
    expect(buildRecordsEmptyMonthState({ monthLabel: "2026년 8월", isCurrentMonth: true }).title).toBe(
      "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
    );
  });
});

/**
 * GAP-067 트랙 A(#2) 곁가지 — 검색 0건 카드의 **두 번째 탈출구**(달을 골라 계속 찾기).
 */
describe("GAP-067 buildRecordsSearchMonthJumpAction", () => {
  it("검색 중일 때만 서고, 무엇을 계속 찾는지 라벨이 말한다", () => {
    expect(buildRecordsSearchMonthJumpAction({ searchText: "유모차" })).toEqual({
      label: "다른 달에서 찾기",
      accessibilityLabel: "달을 골라 '유모차' 계속 찾기"
    });
    expect(buildRecordsSearchMonthJumpAction({})).toBeNull();
    expect(buildRecordsSearchMonthJumpAction({ searchText: "   " })).toBeNull();
  });

  it("카테고리 칩이 함께 걸려 있으면 그 사실도 말한다 (지난달 액션과 같은 조립)", () => {
    expect(
      buildRecordsSearchMonthJumpAction({
        searchText: "유모차",
        categoryFiltered: true,
        categoryLabel: "기저귀/위생"
      })?.accessibilityLabel
    ).toBe("달을 골라 '유모차' 계속 찾기(기저귀/위생 필터 유지)");
    // 이름을 모르면 지어내지 않는다 -- 스코프 줄·지난달 액션과 같은 관례다.
    expect(
      buildRecordsSearchMonthJumpAction({ searchText: "유모차", categoryFiltered: true, categoryLabel: "  " })
        ?.accessibilityLabel
    ).toBe("달을 골라 '유모차' 계속 찾기(카테고리 필터 유지)");
  });

  it("목적지 달 이름을 지어내지 않는다 (아직 사용자가 고르지 않은 값이다)", () => {
    const action = buildRecordsSearchMonthJumpAction({ searchText: "유모차" });
    expect(action?.label).not.toContain("월");
    expect(action?.accessibilityLabel).not.toContain("년");
  });
});

/**
 * 라운드 41 UX-T(C) — 메모 매치 검색 결과의 근거.
 *
 * 검색은 품목명과 메모를 함께 훑는데(placeholder도 "품목명, 메모로 검색") 행에는 메모가 없어서,
 * "조리원"으로 검색해 나온 3건 어디에도 조리원이 보이지 않았다.
 */
/** 부제 조각만 보는 자리를 위한 얇은 어댑터 — 판정은 matchRecordSearch 하나다(K-12). */
const recordSearchSnippet = (input: Parameters<typeof matchRecordSearch>[0]) => matchRecordSearch(input).snippet;

describe("UX-T 메모 매치 근거 조각", () => {
  it("메모에서만 맞은 행에 검색어가 보이는 조각을 만든다", () => {
    expect(
      recordSearchSnippet({ itemName: "산후조리", memo: "조리원 2주 이용료", searchText: "조리원" })
    ).toBe("메모 조리원 2주 이용료");
  });

  it("품목명이 이미 검색어를 품고 있으면 붙이지 않는다 (행 제목이 곧 근거다)", () => {
    expect(
      recordSearchSnippet({ itemName: "조리원 잔금", memo: "조리원 2주 이용료", searchText: "조리원" })
    ).toBeNull();
    // 대소문자는 검색 필터와 같은 기준으로 본다.
    expect(recordSearchSnippet({ itemName: "Pampers", memo: "pampers 대형", searchText: "pampers" })).toBeNull();
    expect(recordSearchSnippet({ itemName: "기저귀", memo: "PAMPERS 대형", searchText: "pampers" })).toBe(
      "메모 PAMPERS 대형"
    );
  });

  it("검색어가 없으면 항상 null -- 검색하지 않는 화면은 한 글자도 바뀌지 않는다", () => {
    for (const searchText of ["", "   ", null, undefined]) {
      expect(recordSearchSnippet({ itemName: "산후조리", memo: "조리원 2주 이용료", searchText })).toBeNull();
    }
  });

  it("메모가 없거나 검색어가 메모에 없으면 null", () => {
    expect(recordSearchSnippet({ itemName: "산후조리", memo: null, searchText: "조리원" })).toBeNull();
    expect(recordSearchSnippet({ itemName: "산후조리", memo: "   ", searchText: "조리원" })).toBeNull();
    expect(recordSearchSnippet({ itemName: "산후조리", memo: "2주 이용료", searchText: "조리원" })).toBeNull();
  });

  it("긴 메모는 검색어 주변만 잘라 말줄임표를 붙인다 (행 높이·검색어 잘림 방지)", () => {
    const memo = "1월에 미리 계약금을 넣어 둔 조리원 2주 이용료 잔금까지 전부 카드로 결제했어요";
    const snippet = recordSearchSnippet({ itemName: "산후조리", memo, searchText: "조리원" });

    expect(snippet).toContain("조리원");
    expect(snippet?.startsWith("메모 …")).toBe(true);
    expect(snippet?.endsWith("…")).toBe(true);
    // 라벨·말줄임표를 뺀 본문은 최대 길이를 넘지 않는다.
    expect(snippet!.replace("메모 ", "").replaceAll("…", "").length).toBe(MEMO_SEARCH_SNIPPET_MAX_LENGTH);
    // 원문에 없는 말을 지어내지 않는다 -- 잘라낸 조각은 메모의 부분 문자열이다.
    expect(memo).toContain(snippet!.replace("메모 ", "").replaceAll("…", ""));
  });

  it("검색어가 메모 앞/뒤 끝에 있어도 필요한 쪽에만 말줄임표가 붙는다", () => {
    const memo = "조리원 2주 이용료 잔금까지 전부 카드로 한 번에 결제했어요 다음 달 청구";
    const head = recordSearchSnippet({ itemName: "산후조리", memo, searchText: "조리원" });
    expect(head?.startsWith("메모 조리원")).toBe(true);
    expect(head?.endsWith("…")).toBe(true);

    const tail = recordSearchSnippet({ itemName: "산후조리", memo, searchText: "청구" });
    expect(tail?.startsWith("메모 …")).toBe(true);
    expect(tail?.endsWith("청구")).toBe(true);
  });

  it("여러 줄 메모는 한 줄로 눌러 담는다 (부제는 한 줄이다)", () => {
    expect(recordSearchSnippet({ itemName: "산후조리", memo: "조리원\n  2주 이용료", searchText: "조리원" })).toBe(
      "메모 조리원 2주 이용료"
    );
  });
});

/**
 * 라운드 41 K-12 — 필터와 스니펫이 **같은 한 규칙**을 본다.
 *
 * 예전 화면 필터는 `${itemName} ${memo}` 연결 문자열을 훑었고 스니펫은 둘을 따로 봤다. 그 차이가
 * 드러나는 자리가 경계에 걸친 검색어다: 품목명 "기저귀" + 메모 "조리원"인 행은 "귀 조"로
 * 검색하면 필터를 통과하는데 스니펫은 null이라, 화면 어디에도 근거가 없는 결과가 되살아났다.
 */
describe("K-12 검색 판정 단일 소스 (matchRecordSearch)", () => {
  it("검색어가 없으면 모든 행이 남고 조각은 없다 (검색하지 않는 화면은 그대로다)", () => {
    for (const searchText of ["", "   ", null, undefined]) {
      expect(matchRecordSearch({ itemName: "기저귀", memo: "조리원", searchText })).toEqual({
        matches: true,
        kind: "none",
        snippet: null
      });
    }
  });

  it("품목명 매치는 결과에 남기되 조각을 붙이지 않는다 (행 제목이 곧 근거다)", () => {
    expect(matchRecordSearch({ itemName: "조리원 잔금", memo: "2주 이용료", searchText: "조리원" })).toEqual({
      matches: true,
      kind: "item",
      snippet: null
    });
  });

  it("메모 매치는 결과에 남기고 메모 조각을 근거로 준다", () => {
    expect(matchRecordSearch({ itemName: "산후조리", memo: "조리원 2주 이용료", searchText: "조리원" })).toEqual({
      matches: true,
      kind: "memo",
      snippet: "메모 조리원 2주 이용료"
    });
  });

  it("경계 걸침 검색어는 필터를 통과하던 그대로 남고, 이제 근거도 함께 나온다", () => {
    // "기저귀" + " " + "조리원 결제" 를 이어야만 맞는 검색어 -- 품목명에도 메모에도 없다.
    const spanning = matchRecordSearch({ itemName: "기저귀", memo: "조리원 결제", searchText: "귀 조" });
    expect(spanning.matches).toBe(true);
    expect(spanning.kind).toBe("spanning");
    // 검색어가 든 척하는 조각을 만들지 않는다 -- 왜 걸렸는지를 사실로 말하고, 사용자가 볼 수
    // 없던 나머지 절반(메모 앞부분)을 함께 준다.
    expect(spanning.snippet).toBe(`${RECORD_SEARCH_SPANNING_LABEL} · 메모 조리원 결제`);
    expect(spanning.snippet).not.toContain("귀 조");

    // 예전에는 이 조합에서 필터만 통과하고 조각이 null이었다 -- 그 상태가 다시 생기지 않는다.
    expect(spanning.snippet).not.toBeNull();
  });

  it("어느 갈래에도 걸리지 않으면 결과에서 빠진다", () => {
    expect(matchRecordSearch({ itemName: "기저귀", memo: "조리원 결제", searchText: "분유" })).toEqual({
      matches: false,
      kind: "none",
      snippet: null
    });
    // 메모가 없으면 이을 것도 없다(경계 걸침이 성립하지 않는다).
    expect(matchRecordSearch({ itemName: "기저귀", memo: null, searchText: "귀 조" }).matches).toBe(false);
  });

  it("공백 접기는 검색어·품목명·메모에 **같은 규칙**으로 걸린다", () => {
    expect(normalizeRecordSearchText("  조리원\n  2주  이용료 ")).toBe("조리원 2주 이용료");
    // 여러 줄 메모도, 두 칸 띄운 검색어도 접은 뒤에 비교하므로 두 판정이 갈리지 않는다.
    expect(matchRecordSearch({ itemName: "기저귀", memo: "조리원\n결제", searchText: "귀  조" }).kind).toBe("spanning");
    expect(matchRecordSearch({ itemName: "물 티슈", memo: null, searchText: "물 티슈" }).kind).toBe("item");
  });

  it("경계 걸침 행도 부제 맨 끝에 근거가 붙는다 (조립 규칙은 하나다)", () => {
    expect(
      recordsRowSubtitle({
        expenseType: "expense",
        categoryLabel: "기저귀/위생",
        dateLabel: "8월 4일",
        searchSnippet: matchRecordSearch({ itemName: "기저귀", memo: "조리원 결제", searchText: "귀 조" }).snippet
      })
    ).toBe(`기저귀/위생 · 8월 4일 · ${RECORD_SEARCH_SPANNING_LABEL} · 메모 조리원 결제`);
  });
});

/**
 * GAP-054 D#8 — 판매처 갈래.
 *
 * 라운드 49 C-03이 판매처 입력칸을 붙인 뒤로 이 값은 사용자가 직접 적는 필드인데, 검색은
 * 여전히 품목명·메모만 훑어 "쿠팡"이 0건을 냈다. 갈래를 더하되 **메모 갈래의 규칙을 그대로**
 * 쓴다(같은 정규화·같은 대소문자 기준·같은 창 자르기·같은 "라벨 + 원문" 모양).
 */
describe("GAP-054 D#8 판매처 검색 갈래", () => {
  it("판매처에서만 맞은 행은 결과에 남고 판매처 조각을 근거로 준다", () => {
    expect(matchRecordSearch({ itemName: "기저귀", merchant: "쿠팡", memo: null, searchText: "쿠팡" })).toEqual({
      matches: true,
      kind: "merchant",
      snippet: "판매처 쿠팡"
    });
    expect(MERCHANT_SEARCH_SNIPPET_LABEL).toBe("판매처");
  });

  it("판매처를 넘기지 않으면 D#8 이전과 한 글자도 다르지 않다", () => {
    expect(matchRecordSearch({ itemName: "기저귀", memo: "조리원 결제", searchText: "쿠팡" })).toEqual({
      matches: false,
      kind: "none",
      snippet: null
    });
    expect(matchRecordSearch({ itemName: "산후조리", memo: "조리원 2주 이용료", searchText: "조리원" })).toEqual({
      matches: true,
      kind: "memo",
      snippet: "메모 조리원 2주 이용료"
    });
  });

  it("품목명이 이미 맞았으면 판매처가 맞아도 조각을 붙이지 않는다 (행 제목이 곧 근거다)", () => {
    expect(matchRecordSearch({ itemName: "쿠팡 배송비", merchant: "쿠팡", searchText: "쿠팡" })).toEqual({
      matches: true,
      kind: "item",
      snippet: null
    });
  });

  it("판매처와 메모가 둘 다 맞으면 더 또렷한 쪽(판매처)을 근거로 준다", () => {
    expect(
      matchRecordSearch({ itemName: "기저귀", merchant: "쿠팡", memo: "쿠팡 로켓배송", searchText: "쿠팡" })
    ).toEqual({ matches: true, kind: "merchant", snippet: "판매처 쿠팡" });
  });

  it("대소문자·공백 정규화는 메모 갈래와 같은 규칙이다", () => {
    expect(matchRecordSearch({ itemName: "기저귀", merchant: "Coupang", searchText: "coupang" })).toEqual({
      matches: true,
      kind: "merchant",
      snippet: "판매처 Coupang"
    });
    // 여러 줄·연속 공백은 한 칸으로 접은 뒤 비교하고, 조각도 접힌 원문으로 나간다.
    expect(matchRecordSearch({ itemName: "기저귀", merchant: " 쿠팡\n 로켓설치 ", searchText: "쿠팡  로켓" })).toEqual({
      matches: true,
      kind: "merchant",
      snippet: "판매처 쿠팡 로켓설치"
    });
    // 빈 값·공백뿐인 값은 갈래 자체가 성립하지 않는다.
    for (const merchant of [null, undefined, "   "]) {
      expect(matchRecordSearch({ itemName: "기저귀", merchant, searchText: "쿠팡" }).matches).toBe(false);
    }
  });

  it("긴 판매처도 메모와 같은 창 규칙으로 잘린다 (행 높이가 흔들리지 않는다)", () => {
    const merchant = "서울 강남 베이비페어 특별 부스 라운지 프리미엄 유아용품 전문관 3층";
    const snippet = matchRecordSearch({ itemName: "기저귀", merchant, searchText: "프리미엄" }).snippet!;
    expect(snippet.startsWith("판매처 …")).toBe(true);
    expect(snippet).toContain("프리미엄");
    expect(snippet.replace("판매처 ", "").replaceAll("…", "").length).toBe(MEMO_SEARCH_SNIPPET_MAX_LENGTH);
    // 원문에 없는 말을 지어내지 않는다.
    expect(merchant).toContain(snippet.replace("판매처 ", "").replaceAll("…", ""));
  });

  it("경계 걸침은 품목명+메모 그대로다 -- 판매처를 끼워 넣어 새 매치를 만들지 않는다", () => {
    // "기저귀" + " " + "조리원 결제"에서만 성립하던 갈래는 그대로 성립한다.
    expect(matchRecordSearch({ itemName: "기저귀", merchant: "쿠팡", memo: "조리원 결제", searchText: "귀 조" }).kind).toBe(
      "spanning"
    );
    // 품목명 끝 + 판매처 앞을 이어야만 맞는 검색어는 **맞지 않는다**(없던 연결을 만들지 않는다).
    expect(matchRecordSearch({ itemName: "기저귀", merchant: "쿠팡", memo: null, searchText: "귀 쿠" }).matches).toBe(
      false
    );
  });

  it("행 부제에는 판매처 조각도 맨 끝에 붙는다 (조립 규칙은 하나다)", () => {
    expect(
      recordsRowSubtitle({
        expenseType: "expense",
        categoryLabel: "기저귀/위생",
        dateLabel: "8월 4일",
        searchSnippet: matchRecordSearch({ itemName: "기저귀", merchant: "쿠팡", searchText: "쿠팡" }).snippet
      })
    ).toBe("기저귀/위생 · 8월 4일 · 판매처 쿠팡");
  });

  it("범위 고지와 placeholder가 실제로 훑는 필드를 같은 순서로 말한다", () => {
    expect(RECORDS_SEARCH_FIELDS_LABEL).toBe("품목명, 판매처, 메모");
    expect(buildRecordsSearchScopeNotice({ searchText: "쿠팡", monthLabel: "2026년 8월" })).toBe(
      "'쿠팡' 검색은 2026년 8월의 품목명, 판매처, 메모에서만 찾아요"
    );
    const recordsScreen = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");
    // 라운드 54 P2-10: placeholder·접근성 라벨도 같은 상수에서 만들어진다 -- 목록을 화면에
    // 다시 적어 두면 구분자가 또 갈린다(고지는 가운뎃점, 화면은 쉼표였다).
    expect(RECORDS_SEARCH_PLACEHOLDER).toBe(`${RECORDS_SEARCH_FIELDS_LABEL}로 검색`);
    expect(recordsScreen).toContain("placeholder={RECORDS_SEARCH_PLACEHOLDER}");
    expect(recordsScreen).toContain("accessibilityLabel={RECORDS_SEARCH_PLACEHOLDER}");
    // 판매처가 빠진 옛 약속은 화면에 남아 있지 않다.
    expect(recordsScreen).not.toContain("품목명, 메모로 검색");
  });
});

describe("UX-T recordsRowSubtitle + 메모 스니펫", () => {
  it("스니펫이 있으면 부제 맨 끝에 붙는다 (앞쪽 토큰의 자리는 그대로)", () => {
    expect(
      recordsRowSubtitle({
        expenseType: "expense",
        categoryLabel: "기저귀/위생",
        dateLabel: "8월 4일",
        searchSnippet: "메모 조리원 2주 이용료"
      })
    ).toBe("기저귀/위생 · 8월 4일 · 메모 조리원 2주 이용료");

    expect(
      recordsRowSubtitle({
        expenseType: "gift",
        authorLabel: "다온맘",
        categoryLabel: "기저귀/위생",
        dateLabel: "8월 4일",
        searchSnippet: "메모 조리원"
      })
    ).toBe("선물 · 다온맘 · 기저귀/위생 · 8월 4일 · 메모 조리원");
  });

  it("스니펫이 없으면 이 기능이 없던 때와 한 글자도 다르지 않다", () => {
    const before = recordsRowSubtitle({ expenseType: "expense", categoryLabel: "기저귀/위생", dateLabel: "8월 4일" });
    for (const searchSnippet of [null, undefined, "   "]) {
      expect(
        recordsRowSubtitle({
          expenseType: "expense",
          categoryLabel: "기저귀/위생",
          dateLabel: "8월 4일",
          searchSnippet
        })
      ).toBe(before);
    }
    // 홈의 "최근 지출" 행도 이 필드를 넘기지 않으므로 종전 그대로다.
    expect(homeRecentExpenseSubtitle({ expenseType: "expense", spentOn: "2026-08-04" })).toBe("8월 4일");
  });

  it("검색 중이라도 품목명이 맞은 행에는 스니펫이 없다 (판정과 조립이 한 규칙이다)", () => {
    const rowSubtitle = (itemName: string, memo: string) =>
      recordsRowSubtitle({
        expenseType: "expense",
        categoryLabel: "기저귀/위생",
        dateLabel: "8월 4일",
        searchSnippet: recordSearchSnippet({ itemName, memo, searchText: "조리원" })
      });

    expect(rowSubtitle("조리원 잔금", "2주 이용료")).toBe("기저귀/위생 · 8월 4일");
    expect(rowSubtitle("산후조리", "조리원 2주 이용료")).toBe("기저귀/위생 · 8월 4일 · 메모 조리원 2주 이용료");
  });
});

describe("기록 화면 배선 (app/(tabs)/records.tsx)", () => {
  const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");

  it("HOME-124: formatSpentOn을 지역 정의가 아니라 공용 모듈에서 가져온다", () => {
    // FAM-127로 import가 여러 줄이 되면서 한 줄 통짜 비교를 그만뒀다 -- 고정하려는 것은
    // "이 화면이 공용 모듈에서 가져다 쓴다"이지 import 문의 줄바꿈 모양이 아니다.
    expect(recordsSource).toContain('from "../../src/expenses/records-list-view"');
    expect(recordsSource).toContain("formatSpentOn");
    expect(recordsSource).toContain("recordsRowSubtitle");
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

  it("UX-T(C): 메모 스니펫은 목록을 만들 때 문자열로 해석해 행에 내려준다 (PERF-102 memo 유지)", () => {
    // 판정·자르기는 순수 모듈 한 곳에만 있다 -- 화면이 메모를 직접 자르지 않는다.
    expect(recordsSource).toContain("matchRecordSearch({");
    expect(recordsSource).toContain("memo: expense.memo");
    expect(recordsSource).toContain("searchText: searchText");
    expect(recordsSource).toContain("searchSnippet: string | null");
    expect(recordsSource).toContain("searchSnippet={item.searchSnippet}");
    // 행에는 해석된 문자열만 간다 -- 검색어를 행 prop으로 넘겨 행마다 판정하게 하지 않는다.
    expect(recordsSource).not.toContain("searchText={");
    // 검색어가 바뀌면 목록이 다시 만들어져야 스니펫이 따라간다.
    expect(recordsSource).toContain("householdMemberRefs, searchText]");
  });

  it("K-12: 필터도 같은 순수 함수를 쓴다 -- 화면에 연결 문자열 판정이 남아 있지 않다", () => {
    // 서버 행과 오프라인 대기 행 둘 다 같은 판정을 지난다.
    // GAP-054 D#8로 인자가 한 줄에 담기지 않게 됐다 -- 고정하려는 것은 "두 목록이 같은 순수
    // 함수에 같은 필드를 넘긴다"이지 인자의 줄바꿈 모양이 아니다.
    expect(recordsSource).toContain(
      ["          itemName: expense.itemName,", "          merchant: expense.merchant,", "          memo: expense.memo,", "          searchText"].join("\n")
    );
    expect(recordsSource).toContain(
      [
        "          itemName: row.payload.itemName,",
        "          merchant: row.payload.merchant,",
        "          memo: row.payload.memo,",
        "          searchText"
      ].join("\n")
    );
    expect(recordsSource.match(/matchRecordSearch\(\{/g) ?? []).toHaveLength(3);
    // 스니펫과 갈리던 옛 판정(`${itemName} ${memo}` 연결 문자열 훑기)은 화면에서 사라졌다.
    expect(recordsSource).not.toContain('`${expense.itemName} ${expense.memo ?? ""}`.toLowerCase()');
    expect(recordsSource).not.toContain("const haystack =");
  });

  it("K1: 금액은 부호 없이 그대로 둔다 (formatKrw 계약 + 월 합계가 환불을 빼지 않으므로)", () => {
    expect(recordsSource).toContain("value={formatKrw(expense.amountKrw)}");
    expect(recordsSource).not.toContain("`-${formatKrw(");
  });

  it("FAM-127: 작성자 이름은 기존 household-members 캐시를 재사용한다 (새 엔드포인트 금지)", () => {
    expect(recordsSource).toContain('queryKey: ["household-members", householdId]');
    expect(recordsSource).toContain("listHouseholdMembers(authToken!, householdId!)");
    // 가족/설정 화면과 같은 테스트 세션 폴백.
    expect(recordsSource).toContain("sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null)");
  });

  it("라운드 27 L-4: 구성원은 기본 가구가 아니라 선택한 아이의 가구에서 조회한다", () => {
    // 아이의 householdId도 새 엔드포인트 없이 아이 관리·설정·리포트와 같은 캐시에서 읽는다.
    expect(recordsSource).toContain('queryKey: ["children"]');
    expect(recordsSource).toContain("listChildren(authToken!)");
    expect(recordsSource).toContain("resolveExpenseHouseholdId({");
    expect(recordsSource).toContain("children: childrenQuery.data?.children");
    expect(recordsSource).toContain("childId,");
    // 캐시 키는 가구별로 계속 분리된다 (["household-members", householdId] 유지).
    expect(recordsSource).toContain('queryKey: ["household-members", householdId]');
    // 예전처럼 세션 기본 가구를 그대로 쓰지 않는다.
    expect(recordsSource).not.toContain("const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);");
  });

  it("FAM-127: 행 부제에 해석된 작성자 라벨을 넘긴다", () => {
    expect(recordsSource).toContain("resolveExpenseAuthorLabel(expenseCreatedByUserId(expense), householdMemberRefs)");
    expect(recordsSource).toContain("authorLabel,");
  });

  it("FAM-127: 라벨은 목록을 만들 때 문자열로 해석해 둔다 (PERF-102 행 memo 유지)", () => {
    // 행에 구성원 배열이나 해석 함수를 내려주면 매 렌더 새 참조라 memo가 무의미해진다.
    expect(recordsSource).toContain("authorLabel: string | null");
    // 목록 useMemo의 의존성으로 남아 있어야 구성원 목록이 바뀔 때 라벨이 따라간다.
    // (UX-T(C)에서 검색어가 뒤에 하나 더 붙었다 -- 고정하려는 것은 "의존성에 있다"이지 순서가 아니다.)
    expect(recordsSource).toContain("householdMemberRefs, searchText]");
  });

  it("F8: 스코프 줄의 금액은 화면의 일별 소계를 그대로 더한 값이다 (새 집계 규칙 없음)", () => {
    expect(recordsSource).toContain("dateGroups.reduce((sum, group) => sum + group.subtotalKrw, 0)");
    expect(recordsSource).toContain("buildRecordsFilterScopeSummary({");
    expect(recordsSource).toContain("totalKrw: filteredSubtotalKrw");
    // 건수는 필터가 걸린 목록 그대로 -- 월 요약 줄의 monthlyRecordCount를 재사용하지 않는다.
    expect(recordsSource).toContain("recordCount: listData.length");
    // 카테고리 이름은 칩에서만 온다(칩과 다른 이름이 나오면 그 자체가 불일치다).
    // 라운드 34 L7: 문장에 들어가는 것은 이모지 없는 plainLabel이다.
    expect(recordsSource).toContain("categoryChips.find((chip) => chip.id === selectedCategoryId)?.plainLabel");
    expect(recordsSource).toContain("categoryFiltered: selectedCategoryId !== null");
  });

  it("F8: 스코프 줄은 필터가 켜졌고 목록이 실제로 나온 때에만 그린다 -- 월 합계는 그대로 월 전체", () => {
    expect(recordsSource).toContain("{showList && filterScopeSummary ? (");
    expect(recordsSource).toContain('testID="records-filter-scope"');
    expect(recordsSource).toContain("accessibilityLabel={filterScopeSummary.accessibilityLabel}");
    expect(recordsSource).toContain("{filterScopeSummary.text}");
    // 무필터 화면은 예전 그대로: 월 요약 줄과 하단 합계 카드가 계속 월 전체(monthlyTotalKrw)다.
    expect(recordsSource).toContain("recordCount: monthlyRecordCount,");
    expect(recordsSource).toContain("totalKrw: monthlyTotalKrw");
    expect(recordsSource).not.toContain("formatKrw(filteredSubtotalKrw)");
  });

  it("UX-P: '이번 달' 하드코딩이 화면에서 사라졌다 -- 헤더 부제·월 요약 줄이 보고 있는 달을 말한다", () => {
    expect(recordsSource).toContain("subtitle={`${recordsMonthLabel} 지출 내역을 한눈에 확인해 보세요.`}");
    expect(recordsSource).toContain("const monthSummary = buildRecordsMonthSummary({");
    expect(recordsSource).toContain("monthLabel: recordsMonthLabel,");
    // 라운드 48 T4(D3) → 49 C-08: 보이는 문구는 순수 모듈의 문장 그대로다(아이 이름은 위 줄로
    // 올라갔다). 스크린리더 라벨만 이름을 **쉼표로** 앞세운다 -- 줄 사이 층위는 소리로 전달되지
    // 않으므로, 이 한 줄만 따로 들으면 누구의 숫자인지 알 수 없기 때문이다.
    expect(recordsSource).toContain("{monthSummary.text}");
    expect(recordsSource).toContain(
      "accessibilityLabel={withSpokenChildScopeLabel(monthSummary.accessibilityLabel, childScopeLabel)}"
    );
    // 요약 문장 자체에 이름을 이어 붙이던 형태로 되돌아가지 않는다(구분자가 셋이 되어 이름이
    // "8월"·"합계"와 동급 항목처럼 읽혔다).
    expect(recordsSource).not.toContain("withChildScopeLabel(monthSummary.text");
    // 종전 하드코딩 문장은 두 자리 모두에서 사라졌다.
    expect(recordsSource).not.toContain("이번 달 지출 내역을 한눈에 확인해 보세요.");
    expect(recordsSource).not.toContain("이번 달 ${monthlyRecordCount}건");
    // 하단 합계 카드는 원래부터 달 라벨을 쓰고 있었다 -- 이제 세 자리가 같은 문자열이다.
    expect(recordsSource).toContain("{recordsMonthLabel} 합계");
  });

  it("UX-P: 검색 범위 고지는 요약 줄 바로 아래에, 검색 중일 때만 그린다", () => {
    expect(recordsSource).toContain(
      "const searchScopeNotice = buildRecordsSearchScopeNotice({ searchText, monthLabel: recordsMonthLabel });"
    );
    expect(recordsSource).toContain('testID="records-search-scope"');
    expect(recordsSource).toContain("{searchScopeNotice ? (");
    // 위치: 월 요약 줄 다음, F8 스코프 줄 앞.
    const summaryIndex = recordsSource.indexOf('testID="records-month-summary"');
    const noticeIndex = recordsSource.indexOf('testID="records-search-scope"');
    const filterScopeIndex = recordsSource.indexOf('testID="records-filter-scope"');
    expect(summaryIndex).toBeGreaterThan(-1);
    expect(noticeIndex).toBeGreaterThan(summaryIndex);
    expect(filterScopeIndex).toBeGreaterThan(noticeIndex);
  });

  it("UX-P: 0건 카드의 '지난달에서 찾기'는 기존 ‹ 이동을 재사용하고 검색어를 지우지 않는다", () => {
    expect(recordsSource).toContain("const previousMonthSearchAction = buildRecordsSearchPreviousMonthAction({");
    // 라운드 39 I-4: 이동이 함께 들고 가는 카테고리 필터도 같은 호출부에서 넘어간다.
    expect(recordsSource).toContain("categoryFiltered: selectedCategoryId !== null,");
    expect(recordsSource).toContain("categoryLabel: selectedCategoryLabel");
    expect(recordsSource).toContain('const previousMonthLabel = periodLabelForOffset(baseDate, "month", monthOffset - 1);');
    expect(recordsSource).toContain("label={previousMonthSearchAction.label}");
    expect(recordsSource).toContain("accessibilityLabel={previousMonthSearchAction.accessibilityLabel}");
    // 이동은 기존 ‹ 핸들러 그대로다 -- 검색어 state(setSearchText)는 건드리지 않으므로 유지된다.
    expect(recordsSource).toContain("onPress={goToPreviousMonth}");
    // 두 개의 0건 분기(달에 기록이 있는데 필터로 가려진 경우 / 달 자체가 빈 경우) 모두에 붙는다.
    expect((recordsSource.match(/\{previousMonthSearchActionButton\}/g) ?? []).length).toBe(2);
    // 기존 액션("검색어 지우기")도 그대로 남는다 -- 대체가 아니라 추가다(문구는 순수 모듈에).
    expect(recordsSource).toContain("filteredEmptyState.actionLabel");
  });

  /**
   * 라운드 39 I-4 / I-5 — 0건 카드 두 장의 문구가 화면 안에서 만들어지지 않는다.
   */
  it("I-4/I-5: 0건 카드의 제목·액션은 순수 모듈이 만든다 (하드코딩 문구가 화면에 없다)", () => {
    expect(recordsSource).toContain("const filteredEmptyState = buildRecordsFilteredEmptyState({");
    expect(recordsSource).toContain('if (filteredEmptyState.action === "clear-category") setSelectedCategoryId(null);');
    expect(recordsSource).toContain("const emptyMonthState = buildRecordsEmptyMonthState({");
    expect(recordsSource).toContain("isCurrentMonth: monthOffset === 0");
    // 종전 하드코딩 문구는 화면에서 사라졌다.
    expect(recordsSource).not.toContain('"이 카테고리의 기록이 없어요."');
    expect(recordsSource).not.toContain('"카테고리 필터 해제"');
    expect(recordsSource).not.toContain("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
  });

  /**
   * GAP-067 트랙 A(#2) — 끝난 빈 달의 액션 배선.
   *
   * 화면에 남는 것은 **키에 따른 배선**뿐이다(문구·판정 0줄). 그리고 그 두 갈래는 화면 이동이라
   * 잠금 게이트를 지나지 않는다 — 게이트를 지나는 것은 지출 생성 입구인 "record" 하나다.
   */
  it("GAP-067: 빈 달 카드의 제목·액션 라벨이 모두 순수 모듈에서 오고, 화면은 키로 배선만 한다", () => {
    expect(recordsSource).toContain("title={filteredEmptyState ? filteredEmptyState.title : emptyMonthState.title}");
    expect(recordsSource).toContain(
      "actionLabel={filteredEmptyState ? filteredEmptyState.actionLabel : emptyMonthState.actionLabel}"
    );
    expect(recordsSource).toContain('if (emptyMonthState.action === "open-calendar") {');
    expect(recordsSource).toContain("setViewMode(RECORDS_VIEW_CALENDAR);");
    expect(recordsSource).toContain('if (emptyMonthState.action === "go-current-month") {');
    expect(recordsSource).toContain("goToCurrentMonth();");
    // 종전 하드코딩 액션 라벨은 사라졌다(문구는 전부 순수 모듈이 단일 소스다).
    expect(recordsSource).not.toContain('actionLabel={filteredEmptyState ? filteredEmptyState.actionLabel : "기록하기"}');
    // 보고 있는 달이 무엇인지 앱은 알아도 **그 달의 어느 날인지는 모른다** -- 그래서 이 카드는
    // 날짜를 프리필하지 않는다(DNC-013). 시트에 날짜를 싣는 자리는 달력 칸 하나뿐이다.
    expect((recordsSource.match(/params: \{ spentOn: date \}/g) ?? []).length).toBe(1);
  });

  /**
   * GAP-067 트랙 A(#2) 곁가지 — 검색 0건 카드에서 월 선택 시트를 여는 자리.
   * 시트 자체(src/MonthJumpSheet.tsx · src/month-jump.ts)는 한 글자도 손대지 않는다.
   */
  it("GAP-067: 검색 0건 카드가 같은 월 선택 시트를 연다 (여는 자리만 늘어난다)", () => {
    expect(recordsSource).toContain("const monthJumpSearchAction = buildRecordsSearchMonthJumpAction({");
    expect(recordsSource).toContain("label={monthJumpSearchAction.label}");
    expect(recordsSource).toContain("accessibilityLabel={monthJumpSearchAction.accessibilityLabel}");
    expect(recordsSource).toContain("onPress={() => setMonthJumpOpen(true)}");
    // 두 개의 0건 분기 모두에 붙는다(지난달 액션과 같은 자리).
    expect((recordsSource.match(/\{monthJumpSearchActionButton\}/g) ?? []).length).toBe(2);
    // 시트는 여전히 한 벌이다 -- 새 시트를 그리지 않는다.
    expect((recordsSource.match(/<MonthJumpSheet/g) ?? []).length).toBe(1);
  });
});

/**
 * FAM-127: 지출 상세(app/expenses/[expenseId].tsx)도 같은 규칙으로 작성자를 보여준다.
 */
describe("FAM-127 지출 상세 배선 (app/expenses/[expenseId].tsx)", () => {
  const detailSource = readFileSync(join(mobileRoot, "app/expenses/[expenseId].tsx"), "utf8");

  it("같은 household-members 캐시에서 이름을 해석한다", () => {
    expect(detailSource).toContain('queryKey: ["household-members", householdId]');
    expect(detailSource).toContain("listHouseholdMembers(authToken!, householdId!)");
    expect(detailSource).toContain("resolveExpenseAuthorLabel(");
    expect(detailSource).toContain("expenseCreatedByUserId(expense.data)");
  });

  it("라벨이 없으면(1인 가구·해석 실패) 아예 렌더하지 않는다 -- 기존 화면 무변경", () => {
    expect(detailSource).toContain("{authorLabel ? (");
    expect(detailSource).toContain("기록한 사람");
  });

  it("라운드 27 L-4: 가구는 이 지출이 속한 아이의 가구로 정한다", () => {
    expect(detailSource).toContain('queryKey: ["children"]');
    expect(detailSource).toContain("listChildren(authToken!)");
    expect(detailSource).toContain("resolveExpenseHouseholdId({");
    // 기록 탭이 선택된 아이를 쓰는 자리에서, 상세는 화면에 떠 있는 지출의 아이를 쓴다.
    expect(detailSource).toContain("childId: expense.data?.childId");
    expect(detailSource).not.toContain("const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);");
  });
});
