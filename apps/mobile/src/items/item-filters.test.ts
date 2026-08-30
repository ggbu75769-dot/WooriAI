import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCategoryNameLookup } from "../categories";
import {
  filterInterestedItems,
  filterItems,
  hasActiveItemFilter,
  INTERESTED_FILTER_EMPTY_TEXT,
  INTERESTED_FILTER_LABEL,
  INTERESTED_FILTER_SCOPE_NOTE,
  itemIsInterested,
  itemMatchesNecessity,
  itemMatchesSearch,
  NECESSITY_FILTER_OPTIONS,
  normalizeItemSearchText
} from "./item-filters";

const items = [
  { name: "카시트", necessityLevel: "essential" as const },
  { name: "젖병/소독 세트", necessityLevel: "essential" as const },
  { name: "모빌/백색소음기", necessityLevel: "convenience" as const },
  { name: "태교 일기장", necessityLevel: "optional" as const }
];

describe("NECESSITY_FILTER_OPTIONS", () => {
  it("offers 전체 first, then exactly the three necessity levels in essential -> optional order", () => {
    expect(NECESSITY_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      "all",
      "essential",
      "convenience",
      "optional"
    ]);
    expect(NECESSITY_FILTER_OPTIONS.map((option) => option.label)).toEqual(["전체", "필수", "편의", "선택"]);
  });
});

describe("itemMatchesNecessity", () => {
  it("keeps everything under 전체", () => {
    for (const item of items) {
      expect(itemMatchesNecessity(item, "all")).toBe(true);
    }
  });

  it("keeps only the selected level", () => {
    expect(itemMatchesNecessity(items[0], "essential")).toBe(true);
    expect(itemMatchesNecessity(items[0], "convenience")).toBe(false);
    expect(itemMatchesNecessity(items[2], "convenience")).toBe(true);
    expect(itemMatchesNecessity(items[3], "optional")).toBe(true);
  });
});

describe("itemMatchesSearch", () => {
  it("passes every item when the query is empty", () => {
    expect(itemMatchesSearch(items[0], "")).toBe(true);
  });

  it("matches on a partial name, ignoring case", () => {
    expect(itemMatchesSearch({ name: "Baby 카시트", necessityLevel: "essential" }, "baby")).toBe(true);
    expect(itemMatchesSearch(items[0], "시트")).toBe(true);
    expect(itemMatchesSearch(items[0], "유모차")).toBe(false);
  });
});

describe("normalizeItemSearchText", () => {
  it("trims and lowercases, mirroring the records tab search convention", () => {
    expect(normalizeItemSearchText("  KaSiTeu  ")).toBe("kasiteu");
    expect(normalizeItemSearchText("   ")).toBe("");
  });
});

describe("filterItems", () => {
  it("returns the list untouched (same order, same objects) with no filter applied", () => {
    expect(filterItems(items, { necessity: "all", searchText: "" })).toEqual(items);
  });

  it("applies necessity and search together (AND)", () => {
    expect(filterItems(items, { necessity: "essential", searchText: "세트" }).map((item) => item.name)).toEqual([
      "젖병/소독 세트"
    ]);
    expect(filterItems(items, { necessity: "convenience", searchText: "세트" })).toEqual([]);
  });

  it("preserves the server's recommendation order rather than re-sorting", () => {
    const reversed = [...items].reverse();
    expect(filterItems(reversed, { necessity: "all", searchText: "" }).map((item) => item.name)).toEqual(
      reversed.map((item) => item.name)
    );
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterItems(items, { necessity: "all", searchText: "  카시트 " }).map((item) => item.name)).toEqual(["카시트"]);
  });
});

describe("hasActiveItemFilter", () => {
  it("is false only when nothing narrows the list", () => {
    expect(hasActiveItemFilter({ necessity: "all", searchText: "" })).toBe(false);
    expect(hasActiveItemFilter({ necessity: "all", searchText: "   " })).toBe(false);
    expect(hasActiveItemFilter({ necessity: "essential", searchText: "" })).toBe(true);
    expect(hasActiveItemFilter({ necessity: "all", searchText: "카시트" })).toBe(true);
  });
});

/**
 * 라운드 49 C-01: 찜(♡) 필터. 상세의 찜하기가 서버에 `interested`를 남기는데도 그것만 모아
 * 보는 경로가 없어, 찜은 눌러도 다시 찾을 수 없는 기능이었다.
 */
describe("interested (찜) filter", () => {
  const snapshot = [
    { id: "car-seat", name: "카시트", status: "not_prepared" as const },
    { id: "bottle", name: "젖병/소독 세트", status: "interested" as const },
    { id: "mobile", name: "모빌/백색소음기", status: "prepared" as const },
    { id: "diary", name: "태교 일기장", status: "interested" as const },
    { id: "gift", name: "손수건 세트", status: "gifted" as const },
    { id: "skip", name: "젖병 소독기", status: "not_needed" as const }
  ];

  it("판정은 상세의 찜하기가 저장하는 status 하나로 끝난다", () => {
    expect(itemIsInterested({ status: "interested" })).toBe(true);
    for (const status of ["not_prepared", "prepared", "gifted", "not_needed"] as const) {
      expect(itemIsInterested({ status })).toBe(false);
    }
  });

  it("찜한 항목만 남기고, 나머지 상태는 전부 걸러 낸다", () => {
    expect(filterInterestedItems(snapshot).map((item) => item.id)).toEqual(["bottle", "diary"]);
  });

  it("받은 순서를 바꾸지 않는다 (추천 순서 계약 무접촉)", () => {
    const reversed = [...snapshot].reverse();
    expect(filterInterestedItems(reversed).map((item) => item.id)).toEqual(["diary", "bottle"]);
  });

  it("찜한 것이 하나도 없으면 빈 배열 — 없는 항목을 지어내지 않는다", () => {
    expect(filterInterestedItems(snapshot.filter((item) => item.status !== "interested"))).toEqual([]);
    expect(filterInterestedItems([])).toEqual([]);
  });

  /**
   * 문구는 화면과 테스트가 같은 상수를 본다. 시기 칩을 따르지 않는다는 사실을 화면이 실제로
   * 밝히는지는 아래 wiring 테스트(item-expense-roundtrip-wiring.test.ts)가 확인한다.
   */
  it("칩 라벨과 안내 문구는 해요체이고 찜을 재촉하지 않는다", () => {
    expect(INTERESTED_FILTER_LABEL).toBe("찜한 것만");
    expect(INTERESTED_FILTER_SCOPE_NOTE).toBe("찜한 준비템은 시기와 상관없이 모두 보여요.");
    expect(INTERESTED_FILTER_EMPTY_TEXT).toBe("아직 찜한 준비템이 없어요.");
    for (const text of [INTERESTED_FILTER_SCOPE_NOTE, INTERESTED_FILTER_EMPTY_TEXT]) {
      expect(text.endsWith("요.")).toBe(true);
    }
  });
});

/**
 * 라운드 81 D: **화면이 그린 분류 이름을 검색이 찾는다.**
 *
 * 준비템 화면의 그룹 헤더는 각 항목 위에 분류 이름을 크게 그리는데(PreparationListParity의
 * `{group.name}`), 검색 술어는 `item.name`만 봤다. 그래서 사용자가 방금 읽은 "위생·목욕"을
 * 검색칸에 치면 0건이 나오고, 검색을 지우면 바로 그 이름의 그룹이 서 있었다.
 *
 * 아래 계약의 축은 하나다 -- **검색이 보는 이름과 헤더가 그리는 이름이 같은 값일 것.**
 */
describe("분류 이름 검색 (라운드 81 D)", () => {
  const mobileRoot = process.cwd();
  const itemsSource = () => readFileSync(join(mobileRoot, "app/(tabs)/items.tsx"), "utf8");
  const parityScreenSource = () =>
    readFileSync(join(mobileRoot, "src/preparation/PreparationListParity.tsx"), "utf8");

  /** 화면(app/(tabs)/items.tsx)의 상수와 같은 값 -- 아래 배선 계약이 그 사실을 고정한다. */
  const UNCATEGORIZED_GROUP_NAME = "분류 없음";

  /** 화면의 `groupKeyOf`와 같은 조립기: 분류 id가 있으면 그 이름, 없으면 "분류 없음". */
  const groupKeyOfWith = (categories?: Array<{ id: string; name: string }>) => {
    const categoryNameOf = buildCategoryNameLookup(categories);
    return (item: { categoryId?: string | null }) =>
      item.categoryId ? categoryNameOf(item.categoryId) : UNCATEGORIZED_GROUP_NAME;
  };

  const serverCategories = [
    { id: "cat-hygiene", name: "위생·목욕" },
    { id: "cat-feeding", name: "수유·이유식" },
    { id: "cat-baby-care", name: "Baby 케어" }
  ];

  /** 서버가 준 순서 그대로의 목록(재정렬 없음). */
  const catalog = [
    { id: "tub", name: "아기 욕조", necessityLevel: "essential" as const, categoryId: "cat-hygiene" },
    { id: "towel", name: "가제 손수건", necessityLevel: "convenience" as const, categoryId: "cat-hygiene" },
    { id: "bottle", name: "젖병/소독 세트", necessityLevel: "essential" as const, categoryId: "cat-feeding" },
    { id: "lotion", name: "보습 로션", necessityLevel: "optional" as const, categoryId: "cat-baby-care" },
    { id: "diary", name: "태교 일기장", necessityLevel: "optional" as const }
  ];

  const categoryNameOf = groupKeyOfWith(serverCategories);
  const search = (searchText: string, resolver = categoryNameOf) =>
    filterItems(catalog, { necessity: "all", searchText, categoryNameOf: resolver }).map((item) => item.id);

  /** 그룹 헤더가 "n/m 보유"로 세는 바로 그 집합. */
  const groupMembers = (groupName: string, resolver = categoryNameOf) =>
    catalog.filter((item) => resolver(item) === groupName).map((item) => item.id);

  it("ⓐ 분류 이름으로 찾은 집합이 그 그룹 헤더가 세는 집합과 같다", () => {
    expect(search("위생")).toEqual(["tub", "towel"]);
    expect(search("위생")).toEqual(groupMembers("위생·목욕"));
    expect(search("위생·목욕")).toEqual(groupMembers("위생·목욕"));
    expect(search("수유")).toEqual(groupMembers("수유·이유식"));
    // 품목명 갈래는 그대로 살아 있다 -- 두 갈래는 OR다.
    expect(search("젖병")).toEqual(["bottle"]);
  });

  it("ⓑ 분류 이름을 주지 않으면 술어의 답이 종전과 바이트 불변이다", () => {
    // 비세션 미리보기·로컬 백엔드 픽스처 경로: resolver 없이 부르면 오늘과 똑같이 이름만 본다.
    expect(filterItems(catalog, { necessity: "all", searchText: "위생" })).toEqual([]);
    expect(itemMatchesSearch(catalog[0], "위생")).toBe(false);
    expect(itemMatchesSearch(catalog[0], "욕조")).toBe(true);
    // 좁히기가 없으면 받은 객체를 그대로(같은 참조로) 돌려준다.
    const passthrough = filterItems(catalog, { necessity: "all", searchText: "" });
    expect(passthrough).toHaveLength(catalog.length);
    passthrough.forEach((item, index) => expect(item).toBe(catalog[index]));
  });

  it("ⓒ 정규화 규칙이 이름 갈래와 같다 (trim + 대소문자 무시)", () => {
    expect(search("  위생  ")).toEqual(groupMembers("위생·목욕"));
    expect(search("baby")).toEqual(groupMembers("Baby 케어"));
    expect(search("BABY")).toEqual(groupMembers("Baby 케어"));
    expect(search("  BaBy 케어 ")).toEqual(groupMembers("Baby 케어"));
    // 정규화의 단일 소스는 normalizeItemSearchText 하나다.
    expect(normalizeItemSearchText("  위생  ")).toBe("위생");
    // 공백만 친 검색어는 여전히 아무것도 좁히지 않는다.
    expect(search("   ")).toEqual(catalog.map((item) => item.id));
    // 분류 이름은 "좁히기 조건"이 아니다 -- 빈 화면 문구를 고르는 판정은 종전 둘 그대로다.
    const blankInput = { necessity: "all" as const, searchText: "   ", categoryNameOf };
    expect(hasActiveItemFilter(blankInput)).toBe(false);
  });

  it("ⓓ 분류가 없는 품목은 헤더와 같은 이름('분류 없음')으로만 걸린다", () => {
    expect(categoryNameOf(catalog[4])).toBe(UNCATEGORIZED_GROUP_NAME);
    expect(search("분류 없음")).toEqual(groupMembers(UNCATEGORIZED_GROUP_NAME));
    expect(search("분류 없음")).toEqual(["diary"]);
    // 이름 갈래는 그 품목에도 그대로 통한다.
    expect(search("태교")).toEqual(["diary"]);
    // 다른 그룹의 이름으로는 걸리지 않는다.
    expect(search("위생")).not.toContain("diary");
  });

  it("ⓔ 분류 캐시가 비어 있으면 검색과 그룹 헤더가 똑같이 '기타'를 쓴다", () => {
    // 콜드 스타트·오프라인 첫 실행: ["categories"] 캐시가 아직 비어 서버 UUID는 이름을 모른다.
    const coldResolver = groupKeyOfWith(undefined);
    expect(catalog.slice(0, 4).map(coldResolver)).toEqual(["기타", "기타", "기타", "기타"]);
    expect(coldResolver(catalog[4])).toBe(UNCATEGORIZED_GROUP_NAME);
    // 그때 "기타" 검색이 그 넷을 전부 통과시키는 것이 **정직한 답**이다 -- 화면도 그 순간
    // 같은 넷을 "기타" 그룹 하나에 그린다. 화면과 검색이 어긋나지 않는다.
    expect(search("기타", coldResolver)).toEqual(groupMembers("기타", coldResolver));
    expect(search("기타", coldResolver)).toEqual(["tub", "towel", "bottle", "lotion"]);
    // 캐시가 비었다고 해서 실제 이름이 미리 걸리지는 않는다(없는 이름을 찾지 않는다).
    expect(search("위생", coldResolver)).toEqual([]);
  });

  it("ⓕ 서버가 준 순서가 한 칸도 바뀌지 않는다", () => {
    const reversed = [...catalog].reverse();
    expect(
      filterItems(reversed, { necessity: "all", searchText: "", categoryNameOf }).map((item) => item.id)
    ).toEqual(reversed.map((item) => item.id));
    expect(
      filterItems(reversed, { necessity: "all", searchText: "위생", categoryNameOf }).map((item) => item.id)
    ).toEqual(["towel", "tub"]);
  });

  it("ⓖ 필수도 칩과는 여전히 AND로 겹친다", () => {
    expect(
      filterItems(catalog, { necessity: "essential", searchText: "위생", categoryNameOf }).map((item) => item.id)
    ).toEqual(["tub"]);
    expect(
      filterItems(catalog, { necessity: "optional", searchText: "위생", categoryNameOf }).map((item) => item.id)
    ).toEqual([]);
  });

  /**
   * 배선 계약(source-grep) -- 화면 파일은 vitest에서 import할 수 없으므로(react-native 네이티브
   * 바인딩 없음) 이 저장소의 기존 관례대로 소스 문자열로 고정한다.
   */
  describe("화면 배선", () => {
    it("검색이 보는 분류 이름은 groupKeyOf 하나에서만 나온다 (두 번째 조립기 금지)", () => {
      const text = itemsSource();
      expect(text).toContain("const itemFilterInput = { necessity: necessityFilter, searchText, categoryNameOf: groupKeyOf };");
      // 조립기는 딱 하나 선언되고, 그 값이 그룹 헤더의 제목(name)이자 검색의 분류 이름이다.
      expect(text.match(/const groupKeyOf = /g)).toHaveLength(1);
      expect(text.match(/const categoryNameOf = buildCategoryNameLookup\(/g)).toHaveLength(1);
      expect(text).toContain("const groupId = groupKeyOf(item);");
      expect(text).toContain("name: groupId,");
      // 그룹 헤더는 그 name을 그대로 그린다(단일 소스의 다른 쪽 끝).
      expect(parityScreenSource()).toContain("{group.name}");
    });

    it("분류 이름 선언이 목록 조립보다 위에 있다 (순서 이동 하나)", () => {
      const text = itemsSource();
      const lookupAt = text.indexOf("const categoryNameOf = buildCategoryNameLookup(");
      const groupKeyAt = text.indexOf("const groupKeyOf = ");
      const filterInputAt = text.indexOf("const itemFilterInput = {");
      const listedAt = text.indexOf("const listedItems:");
      for (const index of [lookupAt, groupKeyAt, filterInputAt, listedAt]) expect(index).toBeGreaterThan(-1);
      expect(lookupAt).toBeLessThan(groupKeyAt);
      expect(groupKeyAt).toBeLessThan(filterInputAt);
      expect(filterInputAt).toBeLessThan(listedAt);
    });

    it("'분류 없음'은 화면과 테스트가 같은 문자열을 본다", () => {
      expect(itemsSource()).toContain(`const UNCATEGORIZED_GROUP_NAME = "${UNCATEGORIZED_GROUP_NAME}";`);
    });

    it("새 요청·새 쿼리 키를 만들지 않는다 (이미 받아 둔 캐시 하나로 닫는다)", () => {
      const text = itemsSource();
      expect(text.match(/queryKey: \[/g)).toHaveLength(6);
      expect(text).toContain('queryKey: ["categories"]');
    });

    /**
     * ⚠️ **별칭은 이번 라운드의 대상이 아니다.** placeholder는 셋("품목명·별칭·분류")을
     * 말하지만 별칭은 저장소에 원천이 0건이라(ItemSummary·계약·시드 어디에도 없다) 지킬 수
     * 없는 약속이다. 문구 정정은 승인 디자인 카피를 고치는 일이라 디자인 승인이 선행이고,
     * 이번 트랙은 **지킬 수 있는 약속 하나(분류)를 실제로 지키는 것**까지만 한다.
     * 그래서 문구는 한 글자도 건드리지 않았다는 사실을 여기서 고정한다.
     */
    it("placeholder·접근성 문구는 한 글자도 바뀌지 않았다 (별칭 정정은 디자인 승인 선행)", () => {
      const text = parityScreenSource();
      expect(text).toContain('placeholder="품목명·별칭·분류 검색"');
      expect(text).toContain('accessibilityLabel="준비물 통합 검색"');
    });
  });
});
