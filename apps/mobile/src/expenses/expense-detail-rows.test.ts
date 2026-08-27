import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  linkedItemTemplateLink,
  LINKED_ITEM_LINK_LABEL,
  LINKED_ITEM_ROW_LABEL,
  MERCHANT_ROW_LABEL,
  PAYMENT_METHOD_LABELS_KO,
  paymentMethodLabelKo,
  PAYMENT_METHOD_ROW_LABEL
} from "./expense-detail-rows";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("라운드 48 T3(C1) 결제 수단 라벨", () => {
  it("입력 화면에서 고른 네 가지를 그대로 되돌려준다", () => {
    expect(paymentMethodLabelKo("card")).toBe("카드");
    expect(paymentMethodLabelKo("cash")).toBe("현금");
    expect(paymentMethodLabelKo("transfer")).toBe("계좌 이체");
    expect(paymentMethodLabelKo("mobile_pay")).toBe("모바일 결제");
  });

  it("고르지 않았거나(unknown) 값이 없으면 아무 말도 하지 않는다", () => {
    for (const empty of ["unknown", "", "   ", null, undefined, 3 as unknown as string]) {
      expect(paymentMethodLabelKo(empty as string | null | undefined), String(empty)).toBeNull();
    }
  });

  it("모르는 값은 '카드'로 둔갑시키지 않고 원본을 통과시킨다(sourceLabelKo와 같은 관례)", () => {
    expect(paymentMethodLabelKo("crypto")).toBe("crypto");
    expect(paymentMethodLabelKo("CARD")).toBe("CARD");
  });

  /**
   * 드리프트 가드: 라벨 문구의 단일 소스는 이 모듈이지만, 사용자가 그 값을 **고르는** 곳은
   * 빠른 기록 시트다(app/expenses/new.tsx의 `quickExpensePaymentMethods`). 그 화면은 EXP-001
   * 픽셀 락 캡처 경로라 이번 라운드에서 손대지 않았으므로, 두 목록이 갈리지 않는지 소스를
   * 직접 대조한다 -- 어느 쪽을 고쳐도 이 테스트가 먼저 빨개진다.
   */
  it("빠른 기록 시트(app/expenses/new.tsx)의 선택지와 코드·문구가 한 글자도 다르지 않다", () => {
    const screen = source("app/expenses/new.tsx");
    const blockStart = screen.indexOf("const quickExpensePaymentMethods = [");
    expect(blockStart, "quickExpensePaymentMethods 선언을 찾지 못했다").toBeGreaterThan(-1);
    const block = screen.slice(blockStart, screen.indexOf("] as const;", blockStart));

    const entries = [...block.matchAll(/\{ value: "([a-z_]+)", label: "([^"]+)" \}/g)].map(
      ([, value, label]) => [value, label] as const
    );
    expect(entries.length).toBe(Object.keys(PAYMENT_METHOD_LABELS_KO).length);
    expect(Object.fromEntries(entries)).toEqual({ ...PAYMENT_METHOD_LABELS_KO });
    for (const [value, label] of entries) {
      expect(paymentMethodLabelKo(value), `${value} 라벨`).toBe(label);
    }
  });
});

describe("라운드 48 T3(C3) 연결된 준비템 링크", () => {
  it("연결이 있으면 준비템 상세 경로를 만든다", () => {
    expect(linkedItemTemplateLink("11111111-1111-4111-8111-111111111111")).toEqual({
      label: LINKED_ITEM_LINK_LABEL,
      href: "/items/11111111-1111-4111-8111-111111111111"
    });
  });

  it("연결이 없으면 행 자체가 없다", () => {
    for (const empty of ["", "   ", null, undefined, 3 as unknown as string]) {
      expect(linkedItemTemplateLink(empty as string | null | undefined), String(empty)).toBeNull();
    }
  });

  it("링크 문구에 준비템 이름을 지어내지 않는다 -- 지출 응답에는 이름이 없다", () => {
    expect(LINKED_ITEM_LINK_LABEL).toBe("연결된 준비템 보기");
    expect(LINKED_ITEM_ROW_LABEL).toBe("연결된 준비템");
  });
});

/**
 * 화면 배선은 소스 그렙으로 확인한다(react-native 화면은 vitest에서 렌더할 수 없다 --
 * expense-source-line.test.ts와 같은 관례).
 */
describe("라운드 48 T3 지출 상세 배선", () => {
  const screen = () => source("app/expenses/[expenseId].tsx");

  it("세 값 모두 순수 모듈을 거쳐 읽기 전용 행으로 그려진다", () => {
    const screenSource = screen();
    expect(screenSource).toContain('} from "../../src/expenses/expense-detail-rows";');
    expect(screenSource).toContain("const paymentMethodLabel = paymentMethodLabelKo(expense.data?.paymentMethod);");
    expect(screenSource).toContain("const linkedItem = linkedItemTemplateLink(expense.data?.linkedItemTemplateId);");
    expect(screenSource).toContain("{paymentMethodLabel ? (");
    expect(screenSource).toContain("{merchantValue.length > 0 ? (");
    expect(screenSource).toContain("{linkedItem ? (");
    expect(screenSource).toContain("{PAYMENT_METHOD_ROW_LABEL}");
    expect(screenSource).toContain("{MERCHANT_ROW_LABEL}");
    expect(screenSource).toContain("{LINKED_ITEM_ROW_LABEL}");
    expect(screenSource).toContain("router.push(linkedItem.href)");
  });

  it("값이 없을 때 빈 자리표시자를 그리지 않는다(조건부 렌더만 있다)", () => {
    const screenSource = screen();
    // "결제 수단"·"판매처"·"연결된 준비템" 문구는 화면에 리터럴로 박히지 않는다 -- 전부
    // 모듈 상수를 거치므로, 문구를 고치는 자리가 한 곳뿐이다.
    expect(screenSource).not.toContain('"결제 수단"');
    expect(screenSource).not.toContain('"판매처"');
    expect(screenSource).not.toContain('"연결된 준비템"');
    expect(PAYMENT_METHOD_ROW_LABEL).toBe("결제 수단");
    expect(MERCHANT_ROW_LABEL).toBe("판매처");
  });

  it("연결 링크는 접근성 라벨을 갖고, 새 hex 색을 만들지 않는다(A11Y-117 coral[700])", () => {
    const screenSource = screen();
    const blockStart = screenSource.indexOf("{linkedItem ? (");
    const block = screenSource.slice(blockStart, screenSource.indexOf("품목", blockStart));
    expect(block).toContain("accessibilityLabel={linkedItem.label}");
    expect(block).toContain("theme.colors.coral[700]");
    expect(block).toContain("minHeight: theme.touchTarget");
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
