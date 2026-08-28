import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EDITABLE_PAYMENT_METHODS,
  expenseTypeBadgeLabel,
  expenseTypeForPatch,
  isRefundExpenseType,
  nextPaymentMethod,
  paymentMethodControlLabel,
  paymentMethodForPatch,
  PAYMENT_METHOD_CHANGE_LABEL,
  PAYMENT_METHOD_LABELS_KO,
  PAYMENT_METHOD_UNSET_LABEL,
  REFUND_BADGE_NOTICE,
  REFUND_GIFT_DISABLED_REASON
} from "./expense-detail-rows";
import { EXPENSE_AMOUNT_MAX_KRW } from "./amount-limit";
import { createMemoryOfflineStore } from "../offline/memory-offline-store";
import { recordLocalCreate, recordLocalUpdate } from "../offline/sync-engine";
import type { ExpensePayload } from "../offline/types";

/**
 * GAP-054 트랙 A — 지출 상세 수정의 정합 규칙을 고정한다.
 *
 * #1 환불 보존, #10 결제 수단 편집, #2 금액 상한(이 화면 몫). 화면 자체는 react-native라
 * vitest에서 렌더할 수 없으므로 이 파일과 같은 관례를 쓴다: **판정은 순수 함수로**,
 * **배선은 소스 그렙으로**, 그리고 오프라인 경로는 실제 메모리 스토어로 한 번 돌려 본다
 * (expense-detail-rows.test.ts · save-error-wiring.test.ts와 같은 방식).
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const detailScreen = () => source("app/expenses/[expenseId].tsx");

describe("GAP-054 #1 — 환불 기록은 수정해도 환불로 남는다", () => {
  it("원본이 refund면 payload에서 expenseType 키를 뺀다(undefined)", () => {
    expect(expenseTypeForPatch("refund", false)).toBeUndefined();
    // 체크박스를 억지로 켠 상태에서도 마찬가지다 -- 환불∧선물 조합은 만들 수 없다.
    expect(expenseTypeForPatch("refund", true)).toBeUndefined();
  });

  it("gift/expense 기록의 기존 토글 동작은 한 글자도 바뀌지 않는다", () => {
    expect(expenseTypeForPatch("expense", false)).toBe("expense");
    expect(expenseTypeForPatch("expense", true)).toBe("gift");
    expect(expenseTypeForPatch("gift", true)).toBe("gift");
    expect(expenseTypeForPatch("gift", false)).toBe("expense");
    // 구 응답·로컬 목업처럼 구분을 모를 때도 예전과 같다(체크박스 상태 그대로).
    expect(expenseTypeForPatch(undefined, false)).toBe("expense");
    expect(expenseTypeForPatch(null, true)).toBe("gift");
  });

  it("환불 판정은 정확히 'refund' 하나다(대소문자·공백을 관대하게 봐주지 않는다)", () => {
    expect(isRefundExpenseType("refund")).toBe(true);
    for (const other of ["expense", "gift", "REFUND", " refund", "", null, undefined]) {
      expect(isRefundExpenseType(other), String(other)).toBe(false);
    }
  });

  it("배지는 환불에만 붙고, 문구는 기록 탭·CSV와 같은 단일 소스에서 온다", () => {
    expect(expenseTypeBadgeLabel("refund")).toBe("환불");
    expect(expenseTypeBadgeLabel("gift")).toBeNull();
    expect(expenseTypeBadgeLabel("expense")).toBeNull();
    expect(expenseTypeBadgeLabel(undefined)).toBeNull();
    // 라벨 사본이 이 모듈에 되살아나지 않는다(records-list-view의 표를 import해서 쓴다).
    const moduleSource = source("src/expenses/expense-detail-rows.ts");
    expect(moduleSource).toContain('import { expenseTypeLabelKo } from "./records-list-view";');
    expect(moduleSource).not.toContain('refund: "환불"');
  });

  /**
   * 오프라인 편집 경로도 같은 규칙을 따르는지 **실제로 돌려서** 확인한다.
   *
   * refund 기록의 로컬 payload에는 애초에 expenseType이 없다(sync-controller의
   * `adoptServerExpense`가 refund를 undefined로 접는다 — 아래에서 그 사실도 함께 고정한다).
   * 그 위에 화면이 만든 patch를 얹었을 때 병합 payload에 expenseType이 끼어들지 않아야,
   * 아웃박스가 나중에 보내는 PATCH에서도 키가 사라진다.
   */
  it("아웃박스 patch에도 expenseType이 실리지 않는다", async () => {
    const store = createMemoryOfflineStore();
    // adoptServerExpense가 refund 기록으로 만들어 두는 모양: expenseType 키가 없다.
    const adopted: ExpensePayload = {
      childId: "child-1",
      categoryId: "cat-1",
      amountKrw: 12_000,
      spentOn: "2026-08-01",
      itemName: "유모차 환불"
    };
    const row = await recordLocalCreate(store, adopted);

    const updated = await recordLocalUpdate(store, row.localId, {
      memo: "영수증 확인",
      expenseType: expenseTypeForPatch("refund", false)
    });

    expect(updated.payload.memo).toBe("영수증 확인");
    expect(updated.payload.expenseType).toBeUndefined();
    // 실제로 나가는 것은 JSON이다 -- 키 자체가 사라지는지까지 본다.
    expect(JSON.parse(JSON.stringify({ expenseType: updated.payload.expenseType }))).toEqual({});

    const outbox = await store.listOutboxMutationsForLocalId(row.localId);
    for (const mutation of outbox) {
      expect(mutation.payload?.expenseType).toBeUndefined();
    }
  });

  it("adoptServerExpense가 refund를 로컬 payload에 싣지 않는 규칙이 그대로다", () => {
    // 이 규칙이 사라지면 위 보존이 조용히 깨진다(로컬 payload에 refund가 들어가고, 서버
    // UpdateExpenseDto는 refund를 받지 않아 수정 전체가 400이 된다).
    expect(source("src/offline/sync-controller.ts")).toContain(
      'expenseType: expense.expenseType === "refund" ? undefined : expense.expenseType'
    );
  });

  it("화면이 삼항 재구성 대신 순수 함수를 쓰고, 환불 배지·비활성 이유를 그린다", () => {
    const screen = detailScreen();
    // 문제의 원본 코드가 되살아나면 여기서 먼저 빨개진다.
    expect(screen).not.toContain('expenseType: isGift ? "gift" : "expense"');
    expect(screen).toContain("expenseType: expenseTypeForPatch(expense.data?.expenseType, isGift)");
    expect(screen).toContain("const isRefund = isRefundExpenseType(expense.data?.expenseType);");
    expect(screen).toContain("const expenseTypeBadge = expenseTypeBadgeLabel(expense.data?.expenseType);");
    expect(screen).toContain("{expenseTypeBadge ? (");
    expect(screen).toContain("{REFUND_BADGE_NOTICE}");
    // 선물 체크박스: 비활성 + 이유 한 줄. `disabled`는 react-native Pressable이
    // accessibilityState.disabled로 합쳐 주므로 A11Y-101의 `checked: isGift` 계약 문자열은
    // 그대로 둔다(src/a11y-contract.test.ts가 두 지출 화면에서 같은 문자열을 대조한다).
    expect(screen).toContain("disabled={isRefund}");
    expect(screen).toContain("accessibilityState={{ checked: isGift }}");
    expect(screen).toContain("accessibilityHint={isRefund ? REFUND_GIFT_DISABLED_REASON : undefined}");
    expect(screen).toContain("{isRefund ? REFUND_GIFT_DISABLED_REASON : \"선물은 지출 합계에 포함되지 않아요\"}");
  });

  it("환불 문구는 해요체이고 사용자를 탓하지 않는다(DNC-018)", () => {
    for (const copy of [REFUND_BADGE_NOTICE, REFUND_GIFT_DISABLED_REASON]) {
      expect(copy.endsWith("요.") || copy.endsWith("요")).toBe(true);
      expect(copy).not.toMatch(/잘못|실수|하셨/);
    }
  });
});

describe("GAP-054 #10 — 결제 수단을 상세 화면에서 고칠 수 있다", () => {
  it("고를 수 있는 값은 빠른 기록 시트의 네 가지뿐이다(unknown은 선택지가 아니다)", () => {
    expect(EDITABLE_PAYMENT_METHODS).toEqual(Object.keys(PAYMENT_METHOD_LABELS_KO));
    expect(EDITABLE_PAYMENT_METHODS).not.toContain("unknown");
  });

  it("순환은 목록 순서대로 돌고, 고른 적 없는 기록은 첫 값으로 들어간다", () => {
    expect(nextPaymentMethod("card")).toBe("cash");
    expect(nextPaymentMethod("mobile_pay")).toBe("card");
    for (const unset of ["unknown", "", null, undefined, "crypto"]) {
      expect(nextPaymentMethod(unset), String(unset)).toBe(EDITABLE_PAYMENT_METHODS[0]);
    }
  });

  it("컨트롤 문구는 없는 값을 지어내지 않는다", () => {
    expect(paymentMethodControlLabel("transfer")).toBe("계좌 이체");
    expect(paymentMethodControlLabel("unknown")).toBe(PAYMENT_METHOD_UNSET_LABEL);
    expect(paymentMethodControlLabel(null)).toBe(PAYMENT_METHOD_UNSET_LABEL);
  });

  it("payload에는 실제로 고른 값만 싣는다 — 미선택·모르는 코드는 키 자체가 없다", () => {
    expect(paymentMethodForPatch("card")).toBe("card");
    for (const skipped of ["unknown", "", "   ", null, undefined, "crypto"]) {
      expect(paymentMethodForPatch(skipped), String(skipped)).toBeUndefined();
    }
  });

  it("화면이 상태·컨트롤·payload를 모두 배선한다", () => {
    const screen = detailScreen();
    expect(screen).toContain("const [paymentMethod, setPaymentMethod] = useState<string | null>(null);");
    expect(screen).toContain("setPaymentMethod(expense.data.paymentMethod ?? null);");
    expect(screen).toContain("onPress={() => setPaymentMethod((value) => nextPaymentMethod(value))}");
    expect(screen).toContain("accessibilityLabel={PAYMENT_METHOD_CHANGE_LABEL}");
    expect(screen).toContain("paymentMethod: paymentMethodForPatch(paymentMethod),");
    // 44dp 터치 타깃(A11Y 관례) -- 순환 컨트롤은 누를 수 있는 자리다.
    const blockStart = screen.indexOf("accessibilityLabel={PAYMENT_METHOD_CHANGE_LABEL}");
    expect(screen.slice(blockStart, blockStart + 700)).toContain("minHeight: theme.touchTarget");
  });

  it("서버 UpdateExpenseDto가 이 필드를 이미 허용한다(forbidNonWhitelisted 400 이력)", () => {
    // PATCH가 400으로 떨어지면 결제 수단과 무관한 수정까지 함께 실패한다. 계약이 사라지면
    // 배선보다 이 단언이 먼저 빨개진다.
    const dto = readFileSync(join(process.cwd(), "..", "api", "src", "finance", "dto", "expense.dto.ts"), "utf8");
    const updateBlock = dto.slice(dto.indexOf("export class UpdateExpenseDto"));
    expect(updateBlock).toContain("paymentMethod?: PaymentMethod;");
    // 아웃박스가 실제로 이 키를 실어 보내는 자리(remote-api의 toExpensePatch).
    expect(source("src/offline/remote-api.ts")).toContain("paymentMethod: payload.paymentMethod,");
  });

  it("컨트롤 문구가 빠른 기록 시트의 라벨과 한 글자도 다르지 않다", () => {
    expect(PAYMENT_METHOD_CHANGE_LABEL).toBe("결제 수단 변경");
    expect(source("app/expenses/new.tsx")).toContain(`accessibilityLabel="${PAYMENT_METHOD_CHANGE_LABEL}"`);
  });
});

describe("GAP-054 #2 — 금액 상한(지출 상세·예산 두 화면)", () => {
  const overLimitDigits = String(EXPENSE_AMOUNT_MAX_KRW + 1);

  it("세 화면 모두 상한 값을 로컬에 다시 적지 않고 단일 소스를 import한다", () => {
    for (const screenPath of ["app/expenses/[expenseId].tsx", "app/budget.tsx", "app/(onboarding)/budget.tsx"]) {
      const screen = source(screenPath);
      expect(screen, screenPath).toContain("amount-limit");
      expect(screen, screenPath).toContain("isAmountOverLimit(");
      expect(screen, screenPath).toContain("amountOverLimitMessage()");
      // 숫자를 손으로 적어 두면 서버 @Max와 갈라지는 순간을 아무도 모른다.
      expect(screen, screenPath).not.toContain(String(EXPENSE_AMOUNT_MAX_KRW));
      expect(screen, screenPath).not.toContain(overLimitDigits);
    }
  });

  it("저장 직전 가드에도 같은 판정이 들어 있다(버튼 비활성만으로 끝내지 않는다)", () => {
    expect(detailScreen()).toContain("isAmountOverLimit(amountKrw) ||");
    expect(source("app/budget.tsx")).toContain("|| isAmountOverLimit(amountKrw)");
    expect(source("app/(onboarding)/budget.tsx")).toContain("isAmountOverLimit(amountKrw)");
  });

  it("서버 DTO 두 곳이 contracts의 같은 상수를 @Max로 물고 있다", () => {
    const apiSource = (relative: string) =>
      readFileSync(join(process.cwd(), "..", "api", "src", relative), "utf8");
    for (const dtoPath of ["finance/dto/expense.dto.ts", "onboarding/dto/upsert-budget.dto.ts"]) {
      const dto = apiSource(dtoPath);
      expect(dto, dtoPath).toContain('import { MONEY_KRW_MAX } from "@wooriai/contracts";');
      expect(dto, dtoPath).toContain("@Max(MONEY_KRW_MAX)");
    }
  });

  it("모바일 상한과 contracts 상한이 같은 숫자다", () => {
    const contracts = readFileSync(
      join(process.cwd(), "..", "..", "packages", "contracts", "src", "schemas.ts"),
      "utf8"
    );
    const match = contracts.match(/export const MONEY_KRW_MAX = ([0-9_]+);/);
    expect(match, "MONEY_KRW_MAX 선언을 찾지 못했다").not.toBeNull();
    expect(Number(match![1].replace(/_/g, ""))).toBe(EXPENSE_AMOUNT_MAX_KRW);
  });
});
