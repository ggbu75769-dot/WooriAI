import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPreBirthFilter,
  bandOffersPreBirthItems,
  isPreBirthItem,
  isPreBirthStage,
  PRE_BIRTH_FILTER_LABEL,
  PRE_BIRTH_STAGE_CODES,
  shouldOfferPreBirthFilter
} from "./pre-birth-filter";
import { bandStages } from "./stage-bands";

const mobileRoot = process.cwd();
const itemsSource = () => readFileSync(join(mobileRoot, "app/(tabs)/items.tsx"), "utf8");

describe("라운드 43 UX-V: 출산 전 필터 판정", () => {
  it("임신 시기 코드만 출산 전으로 본다", () => {
    expect(PRE_BIRTH_STAGE_CODES).toEqual(["pregnancy_early", "pregnancy_mid", "pregnancy_late"]);
    for (const code of PRE_BIRTH_STAGE_CODES) {
      expect(isPreBirthStage(code)).toBe(true);
    }
    for (const code of ["newborn_0_3", "infant_4_6", "infant_7_12", "toddler_1_3"]) {
      expect(isPreBirthStage(code)).toBe(false);
    }
    expect(isPreBirthStage(undefined)).toBe(false);
    expect(isPreBirthStage("pregnancy")).toBe(false);
  });

  it("밴드 계약을 건드리지 않는다 — 0-6개월 밴드 정의는 그대로다", () => {
    // 이 필터가 존재하는 이유가 곧 이 사실이다: "0-6개월" 칩 하나가 임신기와 출생 후를 함께 담는다.
    const band = bandStages("0-6개월");
    for (const code of PRE_BIRTH_STAGE_CODES) {
      expect(band).toContain(code);
    }
    expect(band).toContain("newborn_0_3");
  });

  it("임신 시기 전용 항목만 남긴다", () => {
    expect(isPreBirthItem({ stageCodes: ["pregnancy_early", "pregnancy_late"] })).toBe(true);
  });

  it("출생 후 시기와 겹치는 항목은 제외한다 (출산 뒤에도 쓰는 물건)", () => {
    expect(isPreBirthItem({ stageCodes: ["pregnancy_late", "newborn_0_3"] })).toBe(false);
    expect(isPreBirthItem({ stageCodes: ["newborn_0_3"] })).toBe(false);
  });

  it("근거(stageCodes)가 없으면 출산 전이라고 단정하지 않는다", () => {
    expect(isPreBirthItem({})).toBe(false);
    expect(isPreBirthItem({ stageCodes: [] })).toBe(false);
  });

  it("임신 중인 아이의 세션에서만 칩을 제안한다", () => {
    expect(shouldOfferPreBirthFilter({ hasSession: true, currentStage: "pregnancy_mid", selectedBand: "0-6개월" })).toBe(
      true
    );
    // 출생 후에는 무의미하다 -- 좁혀도 지나간 준비물만 남는다.
    expect(shouldOfferPreBirthFilter({ hasSession: true, currentStage: "newborn_0_3", selectedBand: "0-6개월" })).toBe(
      false
    );
    expect(shouldOfferPreBirthFilter({ hasSession: true, currentStage: "toddler_1_3", selectedBand: "0-6개월" })).toBe(
      false
    );
    // 비세션(ITEM-001 픽셀 락 캡처)에는 아예 없다.
    expect(shouldOfferPreBirthFilter({ hasSession: false, currentStage: "pregnancy_mid", selectedBand: "0-6개월" })).toBe(
      false
    );
    expect(shouldOfferPreBirthFilter({ hasSession: true, currentStage: undefined, selectedBand: "0-6개월" })).toBe(false);
  });

  it("리뷰 M-7: 임신 중이어도 출생 후 밴드를 보고 있으면 칩을 내주지 않는다", () => {
    // 그 밴드 목록에는 임신 전용 항목이 있을 수 없어 결과가 확정적으로 0건이다.
    for (const band of ["6-12개월", "12-24개월", "24개월+"] as const) {
      expect(bandOffersPreBirthItems(band)).toBe(false);
      expect(shouldOfferPreBirthFilter({ hasSession: true, currentStage: "pregnancy_late", selectedBand: band })).toBe(
        false
      );
    }
    // 임신 시기를 담는 밴드는 "0-6개월" 하나뿐이다(밴드 계약은 그대로 — 위 테스트 참고).
    expect(bandOffersPreBirthItems("0-6개월")).toBe(true);
  });

  it("리뷰 M-7: 밴드로 돌아오면 칩 판정이 그대로 되살아난다 (유령 방지 관례 유지)", () => {
    const pregnant = { hasSession: true, currentStage: "pregnancy_early" } as const;

    expect(shouldOfferPreBirthFilter({ ...pregnant, selectedBand: "0-6개월" })).toBe(true);
    expect(shouldOfferPreBirthFilter({ ...pregnant, selectedBand: "12-24개월" })).toBe(false);
    // 노출 판정이 되돌아오면 화면의 적용 판정(offersPreBirthFilter && preBirthOnly)도 함께
    // 되돌아온다 -- 칩이 없는 동안에는 필터도 꺼져 목록이 이유 없이 비지 않는다.
    expect(shouldOfferPreBirthFilter({ ...pregnant, selectedBand: "0-6개월" })).toBe(true);
  });

  it("꺼져 있으면 목록을 통째로 그대로 돌려준다 (서버 순서 유지 — DNC-009)", () => {
    const items = [
      { id: "a", stageCodes: ["newborn_0_3"] as const },
      { id: "b", stageCodes: ["pregnancy_early"] as const }
    ].map((item) => ({ ...item, stageCodes: [...item.stageCodes] }));

    expect(applyPreBirthFilter(items, false)).toBe(items);
    expect(applyPreBirthFilter(items, true).map((item) => item.id)).toEqual(["b"]);
  });

  it("걸러도 서버가 준 순서를 다시 정렬하지 않는다 (DNC-009)", () => {
    const items = [
      { id: "1", stageCodes: ["pregnancy_late"] as const },
      { id: "2", stageCodes: ["toddler_1_3"] as const },
      { id: "3", stageCodes: ["pregnancy_early"] as const }
    ].map((item) => ({ ...item, stageCodes: [...item.stageCodes] }));

    expect(applyPreBirthFilter(items, true).map((item) => item.id)).toEqual(["1", "3"]);
  });
});

describe("라운드 43 UX-V: 출산 전 칩 배선", () => {
  it("세션 게이트 안, 필수도 칩과 같은 줄에 붙는다 (ITEM-001 캡처 불변)", () => {
    const items = itemsSource();
    const necessityRowIndex = items.indexOf("NECESSITY_FILTER_OPTIONS.map");
    const chipIndex = items.indexOf("{offersPreBirthFilter ? (");

    expect(necessityRowIndex).toBeGreaterThan(-1);
    expect(chipIndex).toBeGreaterThan(necessityRowIndex);
    // 그 줄 전체가 `{hasSession ? (` 게이트 안이다 = 비세션 픽셀 락 캡처에는 없다.
    expect(items.lastIndexOf("{hasSession ? (", necessityRowIndex)).toBeGreaterThan(-1);
    expect(items).toContain("label={PRE_BIRTH_FILTER_LABEL}");
    expect(PRE_BIRTH_FILTER_LABEL).toBe("출산 전");
  });

  it("기존 필수도·검색 필터와 AND로 겹친다", () => {
    const items = itemsSource();

    expect(items).toContain("applyPreBirthFilter(");
    expect(items).toContain("filterItems<ItemSummary | RecommendationPreviewItem>(visibleItems, itemFilterInput),");
    expect(items).toContain("hasActiveItemFilter(itemFilterInput) || preBirthFilterActive");
    // 필터 초기화는 세 조건을 함께 푼다.
    expect(items).toContain("setPreBirthOnly(false);");
  });

  it("노출 판정과 적용 판정을 묶어 둔다 (출생 전환 뒤 유령 필터 방지)", () => {
    const items = itemsSource();

    expect(items).toContain("const offersPreBirthFilter = shouldOfferPreBirthFilter({");
    expect(items).toContain("currentStage: home.data?.child.currentStage,");
    // 리뷰 M-7: 선택된 시기 밴드도 판정에 들어간다.
    expect(items).toContain("selectedBand: stageLabel");
    expect(items).toContain("const preBirthFilterActive = offersPreBirthFilter && preBirthOnly;");
  });

  it("리뷰 M-8: 데모 세션도 홈 요약을 조회해 실제 아이 시기로 판정한다", () => {
    const items = itemsSource();

    // 예전에는 `!isTestSession`이 걸려 데모에서는 home.data가 영영 undefined였고, 그 값에
    // 기대는 칩이 구조적으로 절대 뜨지 않았다. 픽셀 락 캡처는 여전히 별도로 막는다.
    expect(items).toContain("const shouldResolveChildStage = Boolean(authToken && childId) && !isPixelLockMode;");
    expect(items).not.toContain("&& !isPixelLockMode && !isTestSession");
    // 기본 칩의 결정성은 그대로다 -- 데모/픽셀 락에서는 고정 밴드를 쓴다.
    expect(items).toContain("isPixelLockMode,\n    isTestSession,\n    hasManualSelection: false,");
  });

  it("서버로 보내는 stageBand 계약은 건드리지 않는다", () => {
    const items = itemsSource();

    // 시기 칩 → stageBand 왕복은 그대로. 새 필터는 클라이언트 전용이라 쿼리 키에 끼지 않는다.
    expect(items).toContain("listItems(authToken!, childId!, statusTab, requestedStageBand)");
    expect(items).toContain('queryKey: ["items", childId, statusTab, requestedStageBand ?? "current-stage"]');
    expect(items).not.toContain("preBirthOnly, requestedStageBand");
  });
});
