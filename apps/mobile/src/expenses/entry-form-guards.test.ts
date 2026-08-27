import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasQuickExpenseInput,
  shouldClearQuickExpenseDraftOnClose,
  shouldTileFillItemName
} from "./entry-form-guards";

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

describe("shouldClearQuickExpenseDraftOnClose — 라운드 37 G-7: 프리필은 '친 것'이 아니다", () => {
  const empty = { itemName: "", amountText: "", memo: "" };
  // 준비템 "지출 기록하고 준비 완료"로 들어온 시트의 진입 스냅숏.
  const prefill = { itemName: "젖병 소독기", amountText: "", memo: "" };

  it("프리필 그대로 닫으면 초안을 지운다 -- 다음 진입에서 되살아나지 않게", () => {
    expect(shouldClearQuickExpenseDraftOnClose({ current: prefill, initial: prefill })).toBe(true);
  });

  it("프리필 뒤 금액을 친 채로 닫으면 초안을 지킨다", () => {
    expect(
      shouldClearQuickExpenseDraftOnClose({
        current: { ...prefill, amountText: "38500" },
        initial: prefill
      })
    ).toBe(false);
  });

  it("금액·카테고리까지 프리필된 '같은 내용으로 또 기록'도 그대로 닫으면 지운다", () => {
    const repeat = { itemName: "하기스 밴드형", amountText: "45900", memo: "" };
    expect(shouldClearQuickExpenseDraftOnClose({ current: repeat, initial: repeat })).toBe(true);
    // 금액만 고쳐 놓고 닫았으면 그건 사용자가 친 것이다.
    expect(
      shouldClearQuickExpenseDraftOnClose({ current: { ...repeat, amountText: "45000" }, initial: repeat })
    ).toBe(false);
  });

  it("일반 진입(초기값이 빈 값)은 종전 동작 그대로다", () => {
    // 아무것도 안 치고 닫기 -> 지운다.
    expect(shouldClearQuickExpenseDraftOnClose({ current: empty, initial: empty })).toBe(true);
    // 하나라도 쳤으면 지킨다.
    expect(
      shouldClearQuickExpenseDraftOnClose({ current: { ...empty, memo: "이모가 사 줌" }, initial: empty })
    ).toBe(false);
    // 공백만 친 것은 안 친 것으로 본다(hasQuickExpenseInput의 trim 관례).
    expect(shouldClearQuickExpenseDraftOnClose({ current: { itemName: "  ", amountText: "", memo: "\n" }, initial: empty })).toBe(
      true
    );
  });

  it("프리필을 지우고 닫으면(남길 것이 없다) 지운다", () => {
    expect(shouldClearQuickExpenseDraftOnClose({ current: empty, initial: prefill })).toBe(true);
  });

  it("비동기로 복원된 초안은 기준선(빈 값)과 달라 지켜진다", () => {
    // 초안 복원은 첫 렌더 이후에 일어나므로 initial은 빈 값 그대로다.
    expect(
      shouldClearQuickExpenseDraftOnClose({
        current: { itemName: "분유 800g", amountText: "32400", memo: "" },
        initial: empty
      })
    ).toBe(false);
  });
});

describe("기록 시트 닫기 배선", () => {
  it("닫기가 순수 판정을 그대로 쓴다 (화면에 규칙을 다시 적지 않는다)", () => {
    const source = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");
    expect(source).toContain("shouldClearQuickExpenseDraftOnClose({");
    expect(source).toContain("initial: initialInputSnapshotRef.current");
    // 프리필 값이 기준선이 되도록 첫 렌더의 스냅숏을 ref로 붙든다.
    expect(source).toContain("useRef<QuickExpenseInputSnapshot>({ itemName, amountText, memo })");
  });
});
