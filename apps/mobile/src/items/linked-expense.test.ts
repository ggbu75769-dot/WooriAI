import { describe, expect, it } from "vitest";
import { linkedExpenseRow, LINKED_EXPENSE_ROW_PREFIX } from "./linked-expense";

/**
 * 라운드 49 C-04: 준비템 상세의 역링크("이 준비템으로 기록한 지출").
 *
 * 이 모듈이 지는 계약은 셋이다: (1) 세션이 없으면 아무 줄도 만들지 않는다(ITEM-002 픽셀 락),
 * (2) 값이 없으면 지어내지 않는다, (3) 금액·날짜 표기는 기록 탭/홈과 같은 포맷터를 쓴다.
 */
describe("linkedExpenseRow", () => {
  const linkedExpense = { id: "expense-1", amountKrw: 38500, spentOn: "2026-08-27" };

  it("연결된 지출이 있으면 금액·날짜와 지출 상세 경로를 함께 돌려준다", () => {
    const row = linkedExpenseRow({ hasSession: true, linkedExpense });

    expect(row).not.toBeNull();
    expect(row!.href).toBe("/expenses/expense-1");
    expect(row!.text).toBe(`${LINKED_EXPENSE_ROW_PREFIX}: 38,500원 · 8월 27일`);
  });

  it("스크린 리더 문장에도 금액·날짜와 목적지가 함께 들어간다", () => {
    const row = linkedExpenseRow({ hasSession: true, linkedExpense });

    expect(row!.accessibilityLabel).toContain("38,500원");
    expect(row!.accessibilityLabel).toContain("8월 27일");
    expect(row!.accessibilityLabel).toContain("지출 상세 보기");
  });

  /**
   * 비세션 프리뷰는 ITEM-002 픽셀 락 캡처다(app/pixel-lock.tsx가 세션을 지우고 찍는다).
   * 줄이 한 줄만 더 들어가도 기준 이미지와 어긋나므로, 픽스처에 값이 있어도 만들지 않는다.
   */
  it("세션이 없으면 값이 있어도 줄을 만들지 않는다 (ITEM-002 픽셀 락)", () => {
    expect(linkedExpenseRow({ hasSession: false, linkedExpense })).toBeNull();
  });

  /**
   * 서버는 삭제된 지출(expenses.deleted_at)을 애초에 싣지 않는다 — 그래서 이 쪽에는 null이
   * 온다. 구버전 서버 응답이나 로컬 픽스처에는 필드 자체가 없다(undefined). 어느 쪽이든
   * "기록이 없다"로 읽어야 하고, 없는 금액을 가격대 등에서 추정해 지어내면 허위 표시다.
   */
  it("연결이 없거나(null) 필드 자체가 없으면(undefined) 줄이 없다", () => {
    expect(linkedExpenseRow({ hasSession: true, linkedExpense: null })).toBeNull();
    expect(linkedExpenseRow({ hasSession: true, linkedExpense: undefined })).toBeNull();
  });

  it("id가 빈 값이면 링크를 만들 수 없으므로 줄도 만들지 않는다", () => {
    expect(linkedExpenseRow({ hasSession: true, linkedExpense: { ...linkedExpense, id: "" } })).toBeNull();
  });

  /** 날짜 형식이 예상과 다르면 원본을 그대로 보여준다(records-list-view.ts formatSpentOn 규칙). */
  it("해석할 수 없는 날짜는 지어내지 않고 원본을 그대로 쓴다", () => {
    const row = linkedExpenseRow({
      hasSession: true,
      linkedExpense: { ...linkedExpense, spentOn: "2026-ab-cd" }
    });

    expect(row!.text).toContain("2026-ab-cd");
    expect(row!.text).not.toContain("NaN");
  });

  /** 금액 표기는 앱 전체 규칙(D0: 쉼표 + '원', '₩' 없음)을 따른다 — src/money.ts 단일 소스. */
  it("금액은 앱의 원화 표기 규칙을 그대로 쓴다", () => {
    const row = linkedExpenseRow({ hasSession: true, linkedExpense: { ...linkedExpense, amountKrw: 1234567 } });

    expect(row!.text).toContain("1,234,567원");
    expect(row!.text).not.toContain("₩");
  });
});
