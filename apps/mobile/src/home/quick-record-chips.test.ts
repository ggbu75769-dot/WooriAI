import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildHomeQuickRecordChips,
  HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES,
  HOME_QUICK_RECORD_ITEM_SLOTS,
  HOME_QUICK_RECORD_MANUAL_LABEL,
  HOME_QUICK_RECORD_SECTION_TITLE
} from "./quick-record-chips";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

describe("DSN-053 P2-A 빠른 기록 칩", () => {
  it("칩은 언제나 4개다 -- 품목 3칸 + 직접 입력", () => {
    const chips = buildHomeQuickRecordChips([]);
    expect(chips).toHaveLength(HOME_QUICK_RECORD_ITEM_SLOTS + 1);
    expect(chips.at(-1)).toEqual({
      label: HOME_QUICK_RECORD_MANUAL_LABEL,
      itemName: null,
      testID: "home-quick-record-chip-manual"
    });
  });

  it("이력이 없으면 캡처의 고정 3종으로 채운다", () => {
    const chips = buildHomeQuickRecordChips(null);
    expect(chips.slice(0, 3).map((chip) => chip.label)).toEqual([...HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES]);
  });

  it("이 기기의 최근 품목이 있으면 그것이 먼저 온다(고정값은 남은 칸만 채운다)", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "젖병 세정제" }]);
    expect(chips.map((chip) => chip.label)).toEqual([
      "젖병 세정제",
      "기저귀",
      "병원비",
      HOME_QUICK_RECORD_MANUAL_LABEL
    ]);
  });

  it("최근 품목이 3개 이상이면 고정값이 들어오지 않는다", () => {
    const chips = buildHomeQuickRecordChips([
      { itemName: "젖병 세정제" },
      { itemName: "손수건" },
      { itemName: "체온계" },
      { itemName: "쪽쪽이" }
    ]);
    expect(chips.map((chip) => chip.label)).toEqual([
      "젖병 세정제",
      "손수건",
      "체온계",
      HOME_QUICK_RECORD_MANUAL_LABEL
    ]);
  });

  it("이미 최근 품목으로 올라온 이름을 고정값이 다시 채우지 않는다", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "기저귀" }, { itemName: "분유" }]);
    expect(chips.map((chip) => chip.label)).toEqual(["기저귀", "분유", "병원비", HOME_QUICK_RECORD_MANUAL_LABEL]);
  });

  it("빈 이름·공백 이름은 칸을 먹지 않는다", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "   " }, { itemName: "" }, { itemName: "체온계" }]);
    expect(chips.map((chip) => chip.label)).toEqual(["체온계", "기저귀", "병원비", HOME_QUICK_RECORD_MANUAL_LABEL]);
  });

  it("품목 칩은 프리필할 이름만 들고 간다 -- 보이지 않는 금액·분류를 몰래 채우지 않는다", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "체온계" }]);
    expect(Object.keys(chips[0]).sort()).toEqual(["itemName", "label", "testID"]);
    expect(chips[0].itemName).toBe("체온계");
  });
});

describe("빠른 기록 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  it("칩 목록은 지출 기록 화면과 같은 최근 품목 계산을 재사용한다(새 요청 0)", () => {
    expect(homeSource).toContain('import { buildRecentItemChips } from "../../src/expenses/recent-items";');
    expect(homeSource).toContain("buildHomeQuickRecordChips(");
    expect(homeSource).toContain(
      "buildRecentItemChips(offlineSyncSnapshot.rows, childId, { serverRows: thisMonthExpenses.data?.expenses })"
    );
  });

  it("칩 문구·제목은 순수 모듈이 단일 소스다", () => {
    expect(homeSource).toContain("HOME_QUICK_RECORD_SECTION_TITLE");
    // 이력이 0건이면 이 목록은 고정 3종으로 채워진다 -- 그 화면에 "자주 기록해요"라고 적으면
    // 사용자가 한 적 없는 습관을 단언하는 문구가 된다.
    expect(HOME_QUICK_RECORD_SECTION_TITLE).toBe("빠른 기록");
    expect(HOME_QUICK_RECORD_SECTION_TITLE).not.toBe("자주 기록해요");
    // 화면이 "기저귀"·"분유" 같은 고정 문자열을 다시 적지 않는다.
    expect(homeSource).not.toContain('label="기저귀"');
  });

  it("탭하면 품목명만 프리필한 지출 기록 화면이 열린다(저장은 그 화면에서만)", () => {
    expect(homeSource).toContain('router.push({ pathname: "/expenses/new", params: { itemName: chip.itemName } });');
    expect(homeSource).toContain('router.push("/expenses/new");');
  });

  it("캡처 수치: white · gray300 테두리 · pill · 최소 48 터치 타깃 · 11/700", () => {
    const chipStyle = homeSource.slice(
      homeSource.indexOf("const homeQuickRecordStyle = StyleSheet.create({"),
      homeSource.indexOf("const homePrepCardStyle")
    );
    expect(chipStyle).toContain("backgroundColor: theme.colors.white");
    expect(chipStyle).toContain("borderColor: theme.colors.gray300");
    expect(chipStyle).toContain("borderRadius: theme.radii.pill");
    expect(chipStyle).toContain("minHeight: theme.touchTarget");
    expect(chipStyle).toContain("fontSize: 11");
    expect(chipStyle).toContain('fontWeight: "700"');
  });
});
