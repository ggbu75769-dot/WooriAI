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
import { buildConflictValueFormatter } from "../offline/conflict-display";

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

  /**
   * 라운드 48 QA(P3-1) — 드리프트 가드의 **세 번째 소비자**.
   *
   * 같은 네 코드의 한국어 라벨이 동기화 충돌 화면에도 쓰인다(src/offline/conflict-display.ts의
   * "두 값 나란히 보기"). 그 파일은 오랫동안 네 줄을 **사본**으로 들고 있었고, 사본은 위
   * 드리프트 가드 밖이라 한쪽만 바뀌어도 아무도 몰랐다 -- 지출 상세에서 "계좌 이체"로 읽은 값이
   * 충돌 화면에서만 다른 단어로 보이는 길이 열려 있었다는 뜻이다.
   *
   * 이제 그 파일은 사본 대신 이 모듈을 import한다. 여기서는 **정말로 import를 쓰는지**(사본이
   * 되살아나지 않았는지)를 소스로 확인한다 -- 값 비교만으로는 우연히 같은 사본도 통과한다.
   */
  it("동기화 충돌 화면도 같은 표를 쓴다 -- 라벨 사본이 되살아나지 않는다", () => {
    const conflictDisplay = source("src/offline/conflict-display.ts");
    expect(conflictDisplay).toContain(
      'import { PAYMENT_METHOD_LABELS_KO } from "../expenses/expense-detail-rows";'
    );
    expect(conflictDisplay).toContain("...PAYMENT_METHOD_LABELS_KO");
    // 네 코드의 문구를 그 파일에 다시 적지 않는다(unknown만 그 화면이 따로 더한다).
    for (const label of Object.values(PAYMENT_METHOD_LABELS_KO)) {
      expect(conflictDisplay, `${label} 사본`).not.toContain(`: "${label}"`);
    }
  });

  it("충돌 화면 포매터가 네 코드를 상세 화면과 한 글자도 다르지 않게 읽는다", () => {
    const format = buildConflictValueFormatter([]);
    for (const [code, label] of Object.entries(PAYMENT_METHOD_LABELS_KO)) {
      expect(format("paymentMethod", code), code).toBe(label);
      expect(paymentMethodLabelKo(code), code).toBe(label);
    }
    // 충돌 화면만 필요한 값: 고른 적 없음. 상세 화면은 이 값을 행으로 그리지 않는다(null).
    expect(format("paymentMethod", "unknown")).toBe("알 수 없음");
    expect(paymentMethodLabelKo("unknown")).toBeNull();
    // 모르는 값은 양쪽 모두 둔갑시키지 않고 원본을 통과시킨다.
    expect(format("paymentMethod", "crypto")).toBe("crypto");
  });
});

describe("라운드 48 T3(C3) 연결된 준비템 링크", () => {
  const CHILD_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
  const CHILD_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
  const ITEM = "11111111-1111-4111-8111-111111111111";
  const sameChild = { expenseChildId: CHILD_A, selectedChildId: CHILD_A };

  it("연결이 있고 아이가 같으면 준비템 상세 경로를 만든다", () => {
    expect(linkedItemTemplateLink(ITEM, sameChild)).toEqual({
      label: LINKED_ITEM_LINK_LABEL,
      href: `/items/${ITEM}`
    });
  });

  it("연결이 없으면 행 자체가 없다", () => {
    for (const empty of ["", "   ", null, undefined, 3 as unknown as string]) {
      expect(linkedItemTemplateLink(empty as string | null | undefined, sameChild), String(empty)).toBeNull();
    }
  });

  /**
   * 라운드 49 C-05 — 목적지(app/items/[itemTemplateId].tsx)는 경로의 id로 아이를 알지 못하고
   * **전역으로 선택된 아이**로 상세를 부른다. 그래서 A의 지출 상세에서 이 링크를 누르면 B의
   * 준비템이 열릴 수 있었다: 화면은 "이 지출에 연결된 준비템"이라고 말하면서 다른 아이의 준비
   * 상태를 보여주는, 사실과 다른 안내다. 어긋나면 링크를 아예 만들지 않는다.
   */
  it("지출의 아이와 지금 선택된 아이가 다르면 링크를 만들지 않는다", () => {
    expect(linkedItemTemplateLink(ITEM, { expenseChildId: CHILD_A, selectedChildId: CHILD_B })).toBeNull();
  });

  /** 이 모듈의 관례: 확실하지 않으면 행을 만들지 않는다(스토어 rehydrate 전·응답 도착 전). */
  it("두 아이 id 중 하나라도 모르면 링크를 만들지 않는다", () => {
    for (const scope of [
      { expenseChildId: CHILD_A, selectedChildId: null },
      { expenseChildId: CHILD_A, selectedChildId: undefined },
      { expenseChildId: CHILD_A, selectedChildId: "   " },
      { expenseChildId: null, selectedChildId: CHILD_A },
      { expenseChildId: undefined, selectedChildId: CHILD_A },
      { expenseChildId: "", selectedChildId: "" }
    ]) {
      expect(linkedItemTemplateLink(ITEM, scope), JSON.stringify(scope)).toBeNull();
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
    // 라운드 49 C-05: 링크 판정에 **두 아이 id가 함께** 들어간다(순수 모듈이 어긋남을 거른다).
    expect(screenSource).toContain("const linkedItem = linkedItemTemplateLink(expense.data?.linkedItemTemplateId, {");
    expect(screenSource).toContain("expenseChildId: expense.data?.childId");
    expect(screenSource).toContain("selectedChildId");
    expect(screenSource).toContain(
      'import { useSelectedChildStore } from "../../src/stores/selected-child.store";'
    );
    expect(screenSource).toContain("{paymentMethodLabel ? (");
    expect(screenSource).toContain("{linkedItem ? (");
    expect(screenSource).toContain("{PAYMENT_METHOD_ROW_LABEL}");
    expect(screenSource).toContain("{MERCHANT_ROW_LABEL}");
    expect(screenSource).toContain("{LINKED_ITEM_ROW_LABEL}");
    expect(screenSource).toContain("router.push(linkedItem.href)");
  });

  it("값이 없을 때 빈 자리표시자를 그리지 않는다(조건부 렌더만 있다)", () => {
    const screenSource = screen();
    // 행 라벨 문구는 화면에 리터럴로 박히지 않는다 -- 전부 모듈 상수를 거치므로, 문구를
    // 고치는 자리가 한 곳뿐이다(판매처 입력칸의 placeholder/접근성 라벨은 별개 문구다).
    expect(screenSource).not.toContain('"결제 수단"');
    expect(screenSource).not.toContain('"연결된 준비템"');
    expect(PAYMENT_METHOD_ROW_LABEL).toBe("결제 수단");
    expect(MERCHANT_ROW_LABEL).toBe("판매처");
  });

  /**
   * 라운드 49 C-03(b) — 판매처가 **읽기 전용 행에서 입력칸으로** 바뀌었다.
   *
   * 라운드 48 T3은 "앱 안에 입력 경로가 없다"는 이유로 값이 있을 때만 그리는 행으로 뒀는데,
   * 그 사이 빠른 기록 시트에 판매처 입력이 생겨 사용자가 직접 적은 값이 이 화면으로 들어온다.
   * 적을 수는 있는데 고칠 수는 없으면, 오타 하나를 CSV 내보내기-가져오기 왕복으로만 고칠 수
   * 있다. 값은 다른 편집 필드와 같은 저장 경로(updateExpenseOffline → PATCH)로 나간다.
   */
  it("판매처는 응답 값으로 seeding되어 편집·저장 경로에 실린다", () => {
    const screenSource = screen();
    expect(screenSource).toContain('setMerchant(expense.data.merchant ?? "");');
    expect(screenSource).toContain("onChangeText={setMerchant}");
    expect(screenSource).toContain("value={merchant}");
    // 빈 문자열을 그대로 보내야 "지웠다"가 서버까지 간다(undefined면 옛 값이 남는다).
    expect(screenSource).toContain("merchant: merchant.trim(),");
    expect(screenSource).toContain('accessibilityLabel="판매처 입력 (선택)"');
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
