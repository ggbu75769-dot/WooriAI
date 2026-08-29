import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPreBirthFilter,
  bandOffersPreBirthItems,
  isPreBirthFilterActive,
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
  it("세션 렌더의 보조 칩 줄에서 필수도 칩과 같은 줄에 붙는다 (ITEM-001 캡처 불변)", () => {
    const items = itemsSource();
    const necessityRowIndex = items.indexOf("NECESSITY_FILTER_OPTIONS.map");
    const chipIndex = items.indexOf("{offersPreBirthFilter ? (");

    expect(necessityRowIndex).toBeGreaterThan(-1);
    expect(chipIndex).toBeGreaterThan(necessityRowIndex);
    // DSN-053 P2-B: 게이트가 삼항에서 **이른 반환**으로 바뀌었다 -- 비세션(픽셀 락 ITEM-001
    // 캡처)은 그 위에서 먼저 반환되므로, 두 칩이 있는 세션 렌더에는 도달하지 않는다.
    const previewReturnIndex = items.indexOf("if (!hasSession) {");
    expect(previewReturnIndex).toBeGreaterThan(-1);
    expect(necessityRowIndex).toBeGreaterThan(previewReturnIndex);
    expect(items).toContain("label={PRE_BIRTH_FILTER_LABEL}");
    expect(PRE_BIRTH_FILTER_LABEL).toBe("출산 전");
  });

  it("기존 필수도·검색 필터와 AND로 겹친다", () => {
    const items = itemsSource();

    expect(items).toContain("applyPreBirthFilter(");
    // 라운드 49 C-01: 모집단 이름이 `visibleItems` -> `sourceItems`로 바뀌었다(찜 칩이 켜지면
    // 상태 탭 응답 대신 전 상태 스냅샷의 찜한 항목이 들어온다). 겹치는 방식은 그대로 AND다.
    expect(items).toContain("filterItems<ItemSummary | RecommendationPreviewItem>(sourceItems, itemFilterInput),");
    expect(items).toContain("hasActiveItemFilter(itemFilterInput) || preBirthFilterActive");
    // 필터 초기화는 세 조건을 함께 푼다.
    expect(items).toContain("setPreBirthOnly(false);");
  });

  it("노출 판정과 적용 판정을 묶어 둔다 (출생 전환 뒤 유령 필터 방지)", () => {
    const items = itemsSource();

    expect(items).toContain("const offersPreBirthFilter = shouldOfferPreBirthFilter({");
    // 라운드 69 트랙 C: 판정은 그대로, **입력 출처만** `/home` → `["children"]` 캐시로 옮겼다.
    expect(items).toContain("currentStage: stageSourceChild?.currentStage,");
    expect(items).not.toContain("home.data?.child.currentStage");
    // 리뷰 M-7: 선택된 시기 밴드도 판정에 들어간다.
    expect(items).toContain("selectedBand: stageLabel");
    expect(items).toContain("const preBirthFilterActive = isPreBirthFilterActive({");
  });

  /**
   * 라운드 49 QA(P3-3): 찜 칩과 "출산 전" 칩이 서로를 부정하던 모순.
   *
   * 찜 목록은 시기 밴드를 무시하는 전 상태 스냅샷이고, 화면은 그 자리에서 "찜한 준비템은
   * 시기와 상관없이 모두 보여요."라고 말한다. 그런데 시기 필터인 "출산 전"이 그대로 함께
   * 적용돼, 안내와 목록이 정면으로 어긋났다.
   */
  describe("찜 필터와 겹칠 때 (P3-3)", () => {
    it("찜이 켜져 있으면 시기 좁히기를 적용하지 않는다", () => {
      expect(isPreBirthFilterActive({ offered: true, preBirthOnly: true, interestedOnly: true })).toBe(false);
      // 찜을 끄면 켜 두었던 선택이 그대로 다시 적용된다(상태를 지우지 않는다).
      expect(isPreBirthFilterActive({ offered: true, preBirthOnly: true, interestedOnly: false })).toBe(true);
    });

    it("칩이 나오지 않는 상황(출생 뒤·다른 밴드)에서는 여전히 꺼져 있다", () => {
      expect(isPreBirthFilterActive({ offered: false, preBirthOnly: true, interestedOnly: false })).toBe(false);
      expect(isPreBirthFilterActive({ offered: true, preBirthOnly: false, interestedOnly: false })).toBe(false);
    });

    it("화면은 그동안 칩을 비활성으로 그리고, 선택 표시도 실제 적용 여부를 따른다", () => {
      const items = itemsSource();
      expect(items).toContain("interestedOnly: showInterestedOnly");
      expect(items).toContain("disabled={showInterestedOnly}");
      // 켜 둔 채 찜을 누르면 칩이 "선택됨"으로 남아 적용되는 척하면 안 된다.
      expect(items).toContain("selected={preBirthFilterActive}");
    });
  });

  it("리뷰 M-8 → 라운드 51 #3 → 라운드 69 C: 데모 세션도 **실제 아이 시기**로 판정한다", () => {
    const items = itemsSource();

    // 예전에는 `!isTestSession`이 걸려 데모에서는 시기 원천이 영영 undefined였고, 그 값에
    // 기대는 칩이 구조적으로 절대 뜨지 않았다. 픽셀 락 캡처는 여전히 별도로 막는다.
    //
    // 라운드 69 트랙 C: 원천이 `/home`에서 `["children"]` 캐시로 옮기면서 그 쿼리 전용 게이트
    // (`shouldResolveChildStage`)도 함께 사라졌다 — 남은 게이트는 (1) 아이 쿼리의
    // `enabled: Boolean(authToken)`과 (2) resolveDefaultStageLabel의 `isPixelLockMode` 둘이다.
    expect(items).not.toContain("shouldResolveChildStage");
    expect(items).not.toContain("&& !isPixelLockMode && !isTestSession");
    expect(items).toContain("const stageSourceChild = childrenQuery.data?.children.find((child) => child.id === childId);");
    expect(items).toContain('enabled: Boolean(authToken),');

    // 라운드 51 #3: M-8이 쿼리를 켠 뒤에도 **기본 칩**은 데모에서 "12-24개월"로 굳어 있었다
    // (resolveDefaultStageLabel의 isTestSession 폴백). 그 밴드에는 임신 시기가 없어서
    // shouldOfferPreBirthFilter가 데모에서 언제나 false였다 -- 칩이 도달 불가였다는 뜻이다.
    // 폴백의 근거였던 "데모 아이 = 생후 24개월 고정 픽스처"가 사라졌으므로 폴백도 없앴고,
    // 이제 데모에서 임신 중인 아이를 만들면 기본 칩이 "0-6개월"이 되어 칩이 실제로 나온다.
    //
    // 라운드 44 리뷰 N-7: 서식(개행·들여쓰기)이 아니라 **어떤 인자가 넘어가는가**를 못박는다.
    const defaultBandCallIndex = items.indexOf("hasManualSelection: false,");
    expect(defaultBandCallIndex).toBeGreaterThan(-1);
    const callArgs = items.slice(items.lastIndexOf("(", defaultBandCallIndex), defaultBandCallIndex);
    expect(callArgs).toContain("isPixelLockMode");
    expect(callArgs).not.toContain("isTestSession");
  });

  it("좁히기 조건은 목록 쿼리 키에 끼지 않는다 (칩을 눌러도 요청이 나가지 않는다)", () => {
    const items = itemsSource();

    // DSN-053 P2-B: 목록은 상태로도 시기로도 거르지 않는 스냅샷 한 건이다. 출산 전·필수도·
    // 검색·찜은 전부 그 위의 클라이언트 좁히기라 쿼리 키에 아무것도 더하지 않는다.
    expect(items).toContain('queryKey: ["items", childId, "catalog"]');
    expect(items).not.toContain("preBirthOnly, requestedStageBand");
    expect(items).not.toContain("necessityFilter]");
  });
});
