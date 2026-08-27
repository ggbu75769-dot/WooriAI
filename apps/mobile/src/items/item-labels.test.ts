import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ITEM_STATUSES, NECESSITY_LEVELS } from "@wooriai/domain";
import { NECESSITY_FILTER_OPTIONS } from "./item-filters";
import {
  itemListBadgeLabel,
  itemStatusBadgeLabel,
  itemStatusLabel,
  ITEM_PRICE_BAND_FALLBACK_TEXT,
  necessityBadgeLabel
} from "./item-labels";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("라운드 48 T1: 준비 상태 라벨", () => {
  it("모든 상태에 문구가 있고 예전 목록 문구를 그대로 쓴다", () => {
    expect(itemStatusLabel("prepared")).toBe("이미 준비");
    expect(itemStatusLabel("not_needed")).toBe("필요 없음");
    expect(itemStatusLabel("interested")).toBe("관심");
    expect(itemStatusLabel("gifted")).toBe("선물 받음");
    expect(itemStatusLabel("not_prepared")).toBe("준비 전");
    for (const status of ITEM_STATUSES) {
      expect(itemStatusLabel(status).length).toBeGreaterThan(0);
    }
  });

  it("배지로는 준비 전(기본값)을 알리지 않는다", () => {
    expect(itemStatusBadgeLabel("not_prepared")).toBeUndefined();
    for (const status of ITEM_STATUSES.filter((entry) => entry !== "not_prepared")) {
      expect(itemStatusBadgeLabel(status)).toBe(itemStatusLabel(status));
    }
  });
});

describe("라운드 48 T1: 필수도 배지", () => {
  it("문구는 목록 필수도 칩과 같은 단어를 쓴다(두 UI가 갈라지지 않게)", () => {
    for (const level of NECESSITY_LEVELS) {
      const chipLabel = NECESSITY_FILTER_OPTIONS.find((option) => option.value === level)?.label;
      expect(chipLabel).toBeTruthy();
      if (level === "optional") continue;
      expect(necessityBadgeLabel(level)).toBe(chipLabel);
    }
    expect(necessityBadgeLabel("essential")).toBe("필수");
  });

  it("선택(optional)에는 배지를 달지 않는다", () => {
    expect(necessityBadgeLabel("optional")).toBeUndefined();
  });
});

describe("라운드 48 T1: 목록 카드 배지 판정", () => {
  it("준비 상태가 있으면 상태 라벨이 우선한다", () => {
    expect(itemListBadgeLabel({ status: "gifted", necessityLevel: "essential" })).toBe("선물 받음");
    expect(itemListBadgeLabel({ status: "prepared", necessityLevel: "optional" })).toBe("이미 준비");
    expect(itemListBadgeLabel({ status: "interested", necessityLevel: "convenience" })).toBe("관심");
  });

  it("준비 전이면 필수도 배지로 떨어진다", () => {
    expect(itemListBadgeLabel({ status: "not_prepared", necessityLevel: "essential" })).toBe("필수");
    expect(itemListBadgeLabel({ status: "not_prepared", necessityLevel: "convenience" })).toBe("편의");
    expect(itemListBadgeLabel({ status: "not_prepared", necessityLevel: "optional" })).toBeUndefined();
  });

  it("어떤 입력으로도 근거 없는 평가 문구를 만들지 않는다", () => {
    for (const status of ITEM_STATUSES) {
      for (const necessityLevel of NECESSITY_LEVELS) {
        expect(itemListBadgeLabel({ status, necessityLevel })).not.toBe("BEST");
        expect(itemListBadgeLabel({ status, necessityLevel })).not.toBe("NEW");
      }
    }
  });
});

describe("라운드 48 T1: 목록 화면 배선", () => {
  const itemsSource = () => source("app/(tabs)/items.tsx");

  it('실서버 항목에서 "BEST" 배지와 순환 사진이 사라졌다', () => {
    const items = itemsSource();
    // 순서(index)로 배지를 정하던 판정도, 그 판정이 쓰던 이미지 순환 배열도 남지 않는다.
    expect(items).not.toContain('index === 0 && item.status !== "gifted" ? "BEST"');
    expect(items).not.toContain("recommendationPreviewImages[index % recommendationPreviewImages.length]");
    expect(items).not.toContain("const recommendationPreviewImages");
    // 배지 판정은 순수 모듈 하나다.
    expect(items).toContain("badge: itemListBadgeLabel(item)");
    expect(items).toContain('from "../../src/items/item-labels"');
    // 사진은 넘기지 않는다 -- ProductCard가 자리 박스를 그린다(ui.tsx의 image optional).
    expect(items).toContain("image: undefined");
  });

  it("비세션 미리보기(ITEM-001 픽셀 락)의 배지·사진·캡션은 그대로다", () => {
    const items = itemsSource();
    // 프리뷰 분기와 픽스처 값은 손대지 않는다(캡처 픽셀 불변).
    expect(items).toContain('if ("image" in item) {');
    expect(items).toContain("return { badge: item.badgeText, caption: item.caption, image: item.image };");
    expect(items).toContain('badgeText: "BEST"');
    expect(items).toContain('badgeText: "NEW"');
    expect(items).toContain("image: recommendationBabyCarrierImage");
    expect(items).toContain("image: recommendationDiaperImage");
    expect(items).toContain("image: recommendationBlocksImage");
  });

  it("가격대가 없을 때의 문구는 눌리는 행동처럼 읽히지 않는다", () => {
    expect(ITEM_PRICE_BAND_FALLBACK_TEXT).toBe("가격 정보 준비 중이에요");
    const items = itemsSource();
    expect(items).toContain("price={item.priceBandText ?? ITEM_PRICE_BAND_FALLBACK_TEXT}");
    expect(items).not.toContain("가격 정보 확인");
  });

  it("상태 문구는 화면에 인라인하지 않는다(목록·상세 단일 소스)", () => {
    const items = itemsSource();
    expect(items).not.toContain('if (status === "gifted") return "선물 받음";');
    expect(items).not.toContain("function statusLabel(");
  });
});

describe("라운드 48 T1: 상세 화면 상태 줄", () => {
  it("목록과 같은 라벨 모듈을 쓰고 세션에서만 그린다", () => {
    const detail = source("app/items/[itemTemplateId].tsx");
    expect(detail).toContain('import { itemStatusBadgeLabel } from "../../src/items/item-labels";');
    expect(detail).toContain("const statusBadgeLabel = itemStatusBadgeLabel(visibleDetail.status);");
    expect(detail).toContain("{hasSession && statusBadgeLabel ? <StatusBadge label={statusBadgeLabel} /> : null}");
    // 문구를 화면에서 다시 적지 않는다.
    expect(detail).not.toContain('label="이미 준비"');
    expect(detail).not.toContain('label="선물 받음"');
  });
});
