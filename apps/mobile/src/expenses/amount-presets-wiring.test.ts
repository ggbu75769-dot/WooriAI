import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UX-121 화면 배선 계약 (source verification — react-native 화면은 vitest에서 렌더할 수 없어
 * 이 저장소의 관례대로 소스 grep으로 확인한다: src/a11y-contract.test.ts 참고).
 *
 * 여기서 지키려는 것은 두 가지다.
 * 1) 금액 프리셋 칩이 순수 로직 모듈(amount-presets.ts)을 통해서만 금액을 바꾼다 —
 *    화면에 가산/상한 계산이 다시 손으로 쓰이면(예: Number(x) + 1000) 단위 테스트가
 *    보호하지 못하는 두 번째 규칙 구현이 생긴다.
 * 2) 칩이 authToken 세션에서만 렌더된다 — EXP-001 픽셀 락 캡처는 세션 없이 실행되므로
 *    (app/pixel-lock.tsx가 clearSession 후 /expenses/new로 이동) 이 조건이 캡처 화면의
 *    레이아웃 불변을 보장한다.
 */
const mobileRoot = process.cwd();
const newExpenseSource = readFileSync(join(mobileRoot, "app/expenses/new.tsx"), "utf8");

describe("UX-121 quick-expense amount preset wiring", () => {
  it("drives the chips from the shared pure module instead of inline arithmetic", () => {
    expect(newExpenseSource).toContain('from "../../src/expenses/amount-presets"');
    expect(newExpenseSource).toContain("QUICK_AMOUNT_PRESETS_KRW.map");
    expect(newExpenseSource).toContain("setAmountText((value) => addAmountPreset(value, presetKrw))");
    expect(newExpenseSource).toContain("setAmountText(clearAmountText())");
    expect(newExpenseSource).toContain("formatPresetChipLabel(presetKrw)");
  });

  it("resets the amount by long press and by an explicit 지우기 control", () => {
    expect(newExpenseSource).toContain("onLongPress={() => setAmountText(clearAmountText())}");
    expect(newExpenseSource).toContain('accessibilityLabel="금액 지우기"');
  });

  it("labels the chips for screen readers and keeps the A11Y-101/117 conventions", () => {
    expect(newExpenseSource).toContain("accessibilityLabel={presetChipAccessibilityLabel(presetKrw)}");
    expect(newExpenseSource).toContain('accessibilityHint="길게 누르면 금액을 지워요"');
    // 칩 텍스트는 13px coral -- coral[500](3.16:1)이 아니라 coral[700]이어야 AA를 넘는다.
    expect(newExpenseSource).toContain('color: theme.colors.coral[700], fontSize: 13');
    expect(newExpenseSource).not.toContain("color: theme.colors.mainCoral, fontSize: 13");
  });

  // 리뷰 F9-d: canAddAmountPreset은 모듈에만 있고 화면에는 배선되지 않아, 상한에 닿은 뒤에도
  // 칩이 활성으로 보였다(눌러도 금액이 변하지 않는 죽은 버튼).
  it("disables the chips once the cap is reached, announcing it to screen readers too", () => {
    expect(newExpenseSource).toContain("const canTapAmountPreset = canAddAmountPreset(amountText);");
    expect(newExpenseSource).toContain("disabled={!canTapAmountPreset}");
    expect(newExpenseSource).toContain("accessibilityState={{ disabled: !canTapAmountPreset }}");
    expect(newExpenseSource).toContain("opacity: canTapAmountPreset ? 1 : 0.4");
  });

  it("renders the preset row only for a real session, keeping the EXP-001 capture unchanged", () => {
    const presetRowStart = newExpenseSource.indexOf("QUICK_AMOUNT_PRESETS_KRW.map");
    expect(presetRowStart).toBeGreaterThan(0);
    // 칩 블록을 감싸는 가장 가까운 조건부 블록이 열려 있는 authToken 게이트여야 한다
    // (픽셀 락 캡처는 authToken null이므로 그 화면에서는 이 행 자체가 렌더되지 않는다).
    const before = newExpenseSource.slice(0, presetRowStart);
    expect(before.lastIndexOf("{authToken ? (")).toBeGreaterThan(before.lastIndexOf(") : null}"));
    // DSN-053 P2-C: 금액 입력칸이 **하단 고정 요약바**로 내려가면서 칩의 자리도 함께 옮겼다.
    // 예전 계약은 "금액 카드와 카테고리 그리드 사이"였는데 그 카드가 더 이상 본문에 없다.
    // 지금 지켜야 할 사실은 그대로다: 칩은 자기가 더하는 금액 칸 **바로 옆**에 있어야 한다 --
    // 본문의 마지막 줄(카테고리 그리드보다 아래)이고, 그 아래가 곧 요약바의 금액 박스다.
    expect(presetRowStart).toBeGreaterThan(newExpenseSource.indexOf("quickExpenseCategoryGridStyle.grid"));
    expect(presetRowStart).toBeLessThan(newExpenseSource.indexOf('accessibilityLabel="지출 금액 입력"'));
  });
});
