import { describe, expect, it } from "vitest";
import { hasQuickExpenseInput, shouldTileFillItemName } from "./entry-form-guards";

describe("hasQuickExpenseInput — 닫기가 초안을 지워도 되는지", () => {
  it("아무것도 안 쳤으면 지워도 된다", () => {
    expect(hasQuickExpenseInput({ itemName: "", amountText: "", memo: "" })).toBe(false);
  });

  it("공백만 친 것은 안 친 것으로 본다", () => {
    expect(hasQuickExpenseInput({ itemName: "   ", amountText: "", memo: "\n" })).toBe(false);
  });

  it("품목명·금액·메모 중 하나라도 있으면 초안을 지키게 한다", () => {
    expect(hasQuickExpenseInput({ itemName: "하기스 밴드형", amountText: "", memo: "" })).toBe(true);
    expect(hasQuickExpenseInput({ itemName: "", amountText: "38500", memo: "" })).toBe(true);
    expect(hasQuickExpenseInput({ itemName: "", amountText: "", memo: "이모가 사 줌" })).toBe(true);
  });
});

describe("shouldTileFillItemName — 타일 탭이 품목명을 덮어써도 되는지", () => {
  it("품목명이 비어 있으면 타일 라벨로 채운다", () => {
    expect(shouldTileFillItemName({ itemName: "", lastTileFilledItemName: null })).toBe(true);
    expect(shouldTileFillItemName({ itemName: "  ", lastTileFilledItemName: null })).toBe(true);
  });

  it("타일 → 타일로 분류를 고르는 중이면 이어서 채운다", () => {
    expect(shouldTileFillItemName({ itemName: "기저귀", lastTileFilledItemName: "기저귀" })).toBe(true);
  });

  it("사용자가 직접 친 품목명은 덮어쓰지 않는다", () => {
    expect(shouldTileFillItemName({ itemName: "하기스 밴드형 4단계", lastTileFilledItemName: null })).toBe(false);
    // 타일로 채운 뒤 뒤에 글자를 더 붙였으면 그것도 사용자의 입력이다.
    expect(shouldTileFillItemName({ itemName: "기저귀 대용량", lastTileFilledItemName: "기저귀" })).toBe(false);
  });

  it("칩·타이핑으로 이름이 바뀐 뒤(직전 타일 라벨 없음)에는 덮어쓰지 않는다", () => {
    expect(shouldTileFillItemName({ itemName: "분유 800g", lastTileFilledItemName: null })).toBe(false);
    // 우연히 라벨과 같은 글자를 직접 쳤더라도, 직전 타일 기록이 없으면 건드리지 않는다.
    expect(shouldTileFillItemName({ itemName: "의류", lastTileFilledItemName: null })).toBe(false);
  });
});
