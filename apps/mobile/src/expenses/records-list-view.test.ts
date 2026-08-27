import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";
import { groupExpensesByDate } from "./records-date-groups";
import {
  buildRecordsCategoryChips,
  buildRecordsEmptyMonthTitle,
  buildRecordsFilteredEmptyState,
  buildRecordsFilterScopeSummary,
  buildRecordsMonthSummary,
  buildRecordsSearchPreviousMonthAction,
  buildRecordsSearchScopeNotice,
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
      expect(chips[0].label).toBe(`${categoryCatalog[0].icon} ${categoryCatalog[0].label}`);
      expect(chips[0].matchIds).toEqual([categoryCatalog[0].id]);
    }
  });

  /**
   * 라운드 34 L7: 폴백 칩의 라벨에는 아이콘 이모지가 붙는다. 칩에는 그대로 두되, **문장으로
   * 흘러가는 이름**은 이모지 없는 값이어야 한다 -- 스코프 줄/달력 라벨 한가운데 이모지가 끼면
   * 스크린리더가 아이콘 이름을 카테고리 이름처럼 읽는다.
   */
  it("L7: 폴백 칩은 표시 라벨(이모지 포함)과 문장용 plainLabel을 따로 준다", () => {
    const fallback = buildRecordsCategoryChips([], null);
    for (const [index, chip] of fallback.entries()) {
      const entry = categoryCatalog[index];
      expect(chip.label).toBe(`${entry.icon} ${entry.label}`);
      expect(chip.plainLabel).toBe(entry.label);
      // 이모지는 표시 라벨에만 남는다.
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
    expect(homeSource).toContain("const visibleHome = hasSession ? home.data! : previewHome;");
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
      "'유모차' 검색은 2026년 8월 안에서만 찾아요"
    );
  });

  it("검색어가 없으면(빈 값·공백·null·undefined) null -- 화면이 한 글자도 바뀌지 않는다", () => {
    for (const searchText of ["", "   ", null, undefined]) {
      expect(buildRecordsSearchScopeNotice({ searchText, monthLabel: "2026년 8월" })).toBeNull();
    }
  });

  it("달이 바뀌면 문장의 달도 함께 바뀐다 (화면의 월 라벨을 그대로 받는다)", () => {
    expect(buildRecordsSearchScopeNotice({ searchText: "유모차", monthLabel: "2026년 6월" })).toBe(
      "'유모차' 검색은 2026년 6월 안에서만 찾아요"
    );
  });

  it("검색어 앞뒤 공백은 화면의 필터링과 같은 기준으로 다듬는다", () => {
    expect(buildRecordsSearchScopeNotice({ searchText: "  유모차  ", monthLabel: "2026년 8월" })).toBe(
      "'유모차' 검색은 2026년 8월 안에서만 찾아요"
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
 */
describe("I-5 buildRecordsEmptyMonthTitle", () => {
  it("현재 달에서는 홈 화면과 같은 문구다", () => {
    expect(buildRecordsEmptyMonthTitle({ monthLabel: "2026년 8월", isCurrentMonth: true })).toBe(
      "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
    );
  });

  it("과거 달을 보고 있으면 그 달의 이름을 말한다", () => {
    expect(buildRecordsEmptyMonthTitle({ monthLabel: "2026년 6월", isCurrentMonth: false })).toBe(
      "첫 기록을 남기면 2026년 6월 비용을 바로 보여드릴게요."
    );
  });

  it("달 라벨을 모르면 지어내지 않고 종전 문구를 쓴다", () => {
    expect(buildRecordsEmptyMonthTitle({ monthLabel: "   ", isCurrentMonth: false })).toBe(
      "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요."
    );
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
    expect(recordsSource).toContain("householdMemberRefs]");
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
    expect(recordsSource).toContain("{monthSummary.text}");
    expect(recordsSource).toContain("accessibilityLabel={monthSummary.accessibilityLabel}");
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
    expect(recordsSource).toContain("const emptyMonthTitle = buildRecordsEmptyMonthTitle({");
    expect(recordsSource).toContain("isCurrentMonth: monthOffset === 0");
    // 종전 하드코딩 문구는 화면에서 사라졌다.
    expect(recordsSource).not.toContain('"이 카테고리의 기록이 없어요."');
    expect(recordsSource).not.toContain('"카테고리 필터 해제"');
    expect(recordsSource).not.toContain("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
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
