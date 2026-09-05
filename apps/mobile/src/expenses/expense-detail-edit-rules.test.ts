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
   * 라운드 54 P1-2로 로컬 payload는 `refund`를 **사실대로** 들고 있다(그래야 기록 탭 합계·행
   * 표시가 정확하다 — DNC-015). 화면이 만든 patch는 여전히 expenseType을 말하지 않으므로
   * (`expenseTypeForPatch("refund", …)` = undefined → `omitUndefinedValues`가 키를 지운다)
   * 병합 payload의 환불이 지출로 덮이지 않는다. 아웃박스 행도 환불을 그대로 들고 있고,
   * 서버로 나가는 순간에만 remote-api가 그 키를 뺀다(remote-api.test.ts가 고정한다).
   */
  it("환불 대기 행: 아웃박스 payload는 환불을 그대로 들고, 화면 patch가 그것을 덮지 않는다", async () => {
    const store = createMemoryOfflineStore();
    // adoptServerExpense가 refund 기록으로 만들어 두는 모양: 서버가 말한 값 그대로다.
    const adopted: ExpensePayload = {
      childId: "child-1",
      categoryId: "cat-1",
      amountKrw: 12_000,
      spentOn: "2026-08-01",
      itemName: "유모차 환불",
      expenseType: "refund"
    };
    const row = await recordLocalCreate(store, adopted);

    const updated = await recordLocalUpdate(store, row.localId, {
      memo: "영수증 확인",
      expenseType: expenseTypeForPatch("refund", false)
    });

    expect(updated.payload.memo).toBe("영수증 확인");
    // 화면이 "지출"로 덮어쓰지 않는다 — 원래 값이 그대로 남는다.
    expect(updated.payload.expenseType).toBe("refund");

    const outbox = await store.listOutboxMutationsForLocalId(row.localId);
    expect(outbox.length).toBeGreaterThan(0);
    for (const mutation of outbox) {
      expect(mutation.payload?.expenseType).toBe("refund");
    }
  });

  /**
   * GAP-054 라운드 54 P1-2로 **규칙의 자리가 옮겨졌다.**
   *
   * 예전에는 `adoptServerExpense`가 refund를 접어서 서버 PATCH 계약을 지켰다. 그 접기가
   * 대기 행을 기록 탭에서 일반 지출로 만들어(합계 오염 + "환불 ·" 소실, DNC-015) 로컬은
   * 사실대로 들고 **전송 직전에만** 접는 방식으로 바꿨다. 위 보존(환불이 지출로 덮이지 않는
   * 것)은 그대로 유지되며, 지키는 자리가 sync-controller에서 remote-api로 내려갔을 뿐이다.
   */
  it("환불 보존은 이제 전송 직전(remote-api)에서 지켜진다 — adopt는 사실대로 싣는다", () => {
    const controller = source("src/offline/sync-controller.ts");
    expect(controller).toContain("expenseType: expense.expenseType");
    expect(controller).not.toContain('expense.expenseType === "refund" ? undefined');

    const remoteApi = source("src/offline/remote-api.ts");
    // 접는 함수는 하나뿐이고, 생성·수정 두 경로가 그것을 쓴다.
    expect(remoteApi).toContain('return expenseType === "refund" ? undefined : expenseType;');
    expect(remoteApi).toContain("expenseType: expenseTypeForWire(payload.expenseType)");
    expect(remoteApi.match(/expenseTypeForWire\(payload\.expenseType\)/g)).toHaveLength(2);
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
  });

  /**
   * GAP-054 라운드 54 P2-2 — 비활성 이유 한 줄이 **흐림 밖**에 있다.
   *
   * 상자에 걸린 `opacity: 0.4`는 안의 글자까지 함께 흐리게 만든다. gray600 11px가 0.4로
   * 흐려지면 흰 배경에서 약 1.9:1이라, 왜 누를 수 없는지를 설명하는 바로 그 문장이 화면에서
   * 가장 읽기 어려운 글자가 됐다. 상자는 그대로 흐리되(누를 수 없다는 사실은 그대로 보인다)
   * 이유만 밖으로 빼서 gray600 원래 대비(약 6.9:1)로 읽히게 한다.
   */
  it("비활성 이유는 opacity 0.4 상자 밖에서 그려진다(대비 확보)", () => {
    const screen = detailScreen();
    // 상자의 흐림은 그대로다 -- 비활성 표시 자체를 없애는 것이 아니다.
    expect(screen).toContain("opacity: isRefund ? 0.4 : 1");
    // 이유 한 줄은 Pressable 뒤에, 즉 흐림이 걸리지 않는 자리에 있다.
    const reasonIndex = screen.indexOf('testID="refund-gift-disabled-reason"');
    expect(reasonIndex).toBeGreaterThan(screen.indexOf("opacity: isRefund ? 0.4 : 1"));
    expect(reasonIndex).toBeGreaterThan(screen.indexOf("</Pressable>"));
    expect(screen.slice(reasonIndex, reasonIndex + 400)).toContain("{REFUND_GIFT_DISABLED_REASON}");
    // 상자 안에는 더 이상 그 문장이 없다(같은 말을 두 번 그리지 않는다).
    expect(screen).not.toContain('{isRefund ? REFUND_GIFT_DISABLED_REASON : "선물은 지출 합계에 포함되지 않아요"}');
    // 스크린리더 경로는 그대로다 -- 같은 문장이 체크박스 hint로도 붙어 있다.
    expect(screen).toContain("accessibilityHint={isRefund ? REFUND_GIFT_DISABLED_REASON : undefined}");
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
    // ⚠️ 라운드 99 F3 M-1(두 시점 · 핀 이관): 종전 앵커는 `setPaymentMethod(expense.data.paymentMethod ?? null);`
    // — 응답을 직접 읽는 초기화 줄이었다. 초기화가 "지출 id당 1회 + 미접촉 채택" 게이트를 얻으며
    // 그 사상은 expenseEditBaselineOf 한 벌로 옮겨졌고(같은 `?? null` 규칙 유지), setter는 그
    // 스냅숏을 읽는다. 지키려는 사실(고른 적 없는 기록은 null로 시작한다)은 그대로다.
    expect(screen).toContain("paymentMethod: expense.paymentMethod ?? null");
    expect(screen).toContain("setPaymentMethod(serverBaseline.paymentMethod);");
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
    // 슬라이스 가드(라운드 78 트랙 E): 시작의 실재를 먼저 묻는다.
    const updateAt = dto.indexOf("export class UpdateExpenseDto");
    expect(updateAt).toBeGreaterThan(-1);
    const updateBlock = dto.slice(updateAt);
    expect(updateBlock).toContain("paymentMethod?: PaymentMethod;");
    // 아웃박스가 실제로 이 키를 실어 보내는 자리(remote-api의 toExpensePatch).
    expect(source("src/offline/remote-api.ts")).toContain("paymentMethod: payload.paymentMethod,");
  });

  it("컨트롤 문구가 빠른 기록 시트의 라벨과 한 글자도 다르지 않다", () => {
    expect(PAYMENT_METHOD_CHANGE_LABEL).toBe("결제 수단 변경");
    expect(source("app/expenses/new.tsx")).toContain(`accessibilityLabel="${PAYMENT_METHOD_CHANGE_LABEL}"`);
  });
});

/**
 * 라운드 99 F3 M-1 — **편집 중 백그라운드 refetch가 여덟 입력을 소리 없이 리셋하던 자리.**
 *
 * 종전 초기화 effect는 `expense.data` 참조가 바뀔 때마다 무조건 setter 여덟을 다시 불렀다.
 * 전역 staleTime 30초 + focusManager 배선이라 30초 넘게 이탈했다 돌아오면 refetch가 돌고,
 * 그 사이 값이 달라져 있으면(가구 공동 수정 · flush 확정) 타이핑이 통째로 유실됐다. 화면은
 * vitest에서 렌더할 수 없으므로 이 파일의 관례(소스 계약)로 세 사실을 문다:
 * ① 참조 교체 재발화가 값을 덮지 않는다(id당 1회 게이트), ② 미접촉이면 새 서버 값을 채택한다,
 * ③ 손댄 상태에서 서버가 달라지면 리셋 대신 고지 한 줄이다.
 */
describe("라운드 99 F3 M-1 — 상세 편집 보호(1회 초기화 · 미접촉 채택 · dirty 고지)", () => {
  const screen = detailScreen();
  const effectStart = screen.indexOf("useEffect(() => {\n    if (!expense.data) return;");
  const effectEnd = screen.indexOf("}, [expense.data]);", effectStart);
  // 슬라이스 가드(라운드 78 트랙 E): 두 끝의 실재를 먼저 묻는다 — describe 수집 시점에 던진다.
  expect(effectStart).toBeGreaterThan(-1);
  expect(effectEnd).toBeGreaterThan(effectStart);
  const initEffect = screen.slice(effectStart, effectEnd);

  it("① 초기화는 지출 id당 1회다 — setter 여덟이 게이트(첫 로드 ∥ 미접촉) 안에만 있다", () => {
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(effectStart);
    expect(initEffect).toContain("if (initializedExpenseIdRef.current !== expenseId || untouched) {");
    // setter 여덟은 전부 스냅숏을 읽고, 게이트 앞(무조건 실행 자리)에는 하나도 없다.
    const gateAt = initEffect.indexOf("if (initializedExpenseIdRef.current !== expenseId || untouched) {");
    expect(gateAt).toBeGreaterThan(-1);
    const beforeGate = initEffect.slice(0, gateAt);
    for (const setter of [
      "setItemName(",
      "setAmountDigits(",
      "setMerchant(",
      "setMemo(",
      "setSpentOnIso(",
      "setCategoryId(",
      "setIsGift(",
      "setPaymentMethod("
    ]) {
      expect(beforeGate, `${setter} 는 게이트 안이어야 한다`).not.toContain(setter);
      expect(initEffect).toContain(`${setter}serverBaseline.`);
    }
    // 응답을 setter가 직접 읽던 종전 모양은 남아 있지 않다(사상은 expenseEditBaselineOf 한 벌).
    expect(screen).not.toContain("setItemName(expense.data.itemName);");
    expect(screen).not.toContain("setPaymentMethod(expense.data.paymentMethod ?? null);");
  });

  it("② 미접촉 판정은 기준선 값 비교다 — entry-form-guards의 G-7 스냅숏 규율과 같은 모양", () => {
    expect(initEffect).toContain("serverBaselineRef.current !== null &&");
    expect(initEffect).toContain("sameExpenseEditBaseline(");
    expect(initEffect).toContain(
      "{ itemName, amountDigits, merchant, memo, spentOnIso, categoryId, isGift, paymentMethod }"
    );
    // 채택한 순간 기준선·id 표시가 함께 갱신된다(다음 refetch의 비교가 오늘의 값을 본다).
    expect(initEffect).toContain("initializedExpenseIdRef.current = expenseId;");
    expect(initEffect).toContain("serverBaselineRef.current = serverBaseline;");
    // 기준선 사상은 여덟 필드 전부를 견준다(하나라도 빠지면 그 칸의 타이핑이 보호 밖이다).
    const sameFnAt = screen.indexOf("function sameExpenseEditBaseline(");
    expect(sameFnAt).toBeGreaterThan(-1);
    const sameFnEnd = screen.indexOf("\n}", sameFnAt);
    expect(sameFnEnd).toBeGreaterThan(sameFnAt);
    const sameFn = screen.slice(sameFnAt, sameFnEnd);
    for (const field of ["itemName", "amountDigits", "merchant", "memo", "spentOnIso", "categoryId", "isGift", "paymentMethod"]) {
      expect(sameFn).toContain(`left.${field} === right.${field}`);
    }
  });

  it("③ dirty + 서버 변화는 리셋 대신 고지다 — 캡션 한 줄, 저장 성공에 눕는다", () => {
    // 서버 값이 기준선에서 실제로 달라진 경우에만 선다(참조만 새 refetch는 침묵).
    expect(initEffect).toContain("else if (!sameExpenseEditBaseline(serverBaseline, serverBaselineRef.current!)) {");
    expect(initEffect).toContain("setRemoteChangeNotice(true);");
    // 수렴 예외: 서버가 이 화면의 값 그대로를 들고 온 경우(방금 저장 확정 뒤의 refetch)는
    // 어긋남이 아니다 — 고지 없이 기준선만 오늘로 옮긴다(거짓 고지 금지).
    expect(initEffect).toContain("if (sameExpenseEditBaseline(serverBaseline, currentForm)) {");
    // 채택 분기는 고지를 함께 눕힌다(채택된 화면과 어긋나는 문장을 남기지 않는다).
    expect(initEffect).toContain("setRemoteChangeNotice(false);");
    // 렌더: gray600 caption 한 줄(기존 고지 관례) · 해요체 · 과한 UI 없음(Alert/모달 아님).
    const noticeAt = screen.indexOf('testID="expense-remote-change-notice"');
    expect(noticeAt).toBeGreaterThan(-1);
    const noticeStart = screen.lastIndexOf("{remoteChangeNotice ? (", noticeAt);
    expect(noticeStart).toBeGreaterThan(-1);
    const noticeBlock = screen.slice(noticeStart, noticeAt + 400);
    expect(noticeBlock).toContain("theme.typography.caption.fontSize");
    expect(noticeBlock).toContain("다른 기기에서 이 기록이 바뀌었어요. 저장하면 이 화면의 값으로 덮어써요.");
    // 저장이 확정되면 고지의 전제가 소진된다.
    const onSuccessAt = screen.indexOf("onSuccess: async () => {");
    expect(onSuccessAt).toBeGreaterThan(-1);
    expect(screen.slice(onSuccessAt, onSuccessAt + 400)).toContain("setRemoteChangeNotice(false);");
    // 문구는 해요체이고 사용자를 탓하지 않는다(DNC-018).
    expect(noticeBlock).not.toMatch(/잘못|실수|하셨/);
  });

  it("adopt(expectedVersion 갱신)는 편집 보호와 무관하게 매 응답을 지난다", () => {
    // 게이트 밖(무조건 자리)에서 adopt가 돈다 — 버전 반영은 별개 계약이다(M-1 fix 주석).
    const gateCloseAt = initEffect.indexOf("setRemoteChangeNotice(true);");
    expect(gateCloseAt).toBeGreaterThan(-1);
    const afterBranches = initEffect.slice(gateCloseAt);
    expect(afterBranches).toContain("void adoptServerExpense(expense.data).then((row) => setLocalExpenseId(row.localId));");
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

  /**
   * GAP-054 라운드 54 P2-7 — 버튼 활성 판정의 가드 집합을 세 화면이 공유한다.
   *
   * 상세 화면의 `canSave`에만 `Number.isInteger`가 빠져 있었다. 숫자만 남기는 정규화를 통과한
   * 아주 긴 자릿수를 붙여 넣으면 `Number(...)`가 Infinity가 되고, `isAmountOverLimit`은
   * `Number.isFinite`로 먼저 걸러 "상한 초과 아님"을 돌려준다 — 오류 문구도 없고 버튼도 활성인데
   * 누르면 저장 직전 가드가 막는, 아무 일도 일어나지 않는 버튼이 된다.
   */
  it("저장 버튼 활성 판정에도 정수 가드가 있다(Infinity 붙여넣기 봉합)", () => {
    const screen = detailScreen();
    // 슬라이스 가드(라운드 78 트랙 E): 두 끝의 실재를 먼저 묻는다.
    const canSaveAt = screen.indexOf("const canSave =");
    const canSaveEnd = screen.indexOf("const canTapAmountPreset");
    expect(canSaveAt).toBeGreaterThan(-1);
    expect(canSaveEnd).toBeGreaterThan(canSaveAt);
    const canSaveBlock = screen.slice(canSaveAt, canSaveEnd);
    expect(canSaveBlock).toContain("Number.isInteger(amountKrw)");
    expect(canSaveBlock).toContain("amountKrw > 0");
    expect(canSaveBlock).toContain("!amountError");
    // 빠른 기록 시트·예산 화면과 같은 가드 집합이다(세 화면이 갈리지 않는다).
    expect(source("app/expenses/new.tsx")).toContain("!Number.isInteger(amountKrwValue)");
    expect(source("app/budget.tsx")).toContain("!Number.isInteger(amountKrw)");
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
      // 라운드 56 트랙 A(GAP-056 #1): expense.dto.ts는 길이 상한까지 contracts에서 가져오면서
      // import 문이 여러 줄로 바뀌었다. 고정할 사실은 문장의 모양이 아니라 **어디서 오는가**다
      // — `MONEY_KRW_MAX`가 @wooriai/contracts에서 오고, @Max가 그 이름을 문다.
      const importEnd = dto.indexOf('from "@wooriai/contracts";');
      expect(importEnd, dtoPath).toBeGreaterThan(-1);
      const importBlock = dto.slice(0, importEnd);
      expect(importBlock, dtoPath).toContain("MONEY_KRW_MAX");
      expect(dto, dtoPath).toContain('from "@wooriai/contracts";');
      expect(dto, dtoPath).toContain("@Max(MONEY_KRW_MAX)");
      // 숫자를 손으로 다시 적어 두면 계약과 갈리는 순간을 아무도 모른다.
      expect(dto, dtoPath).not.toMatch(/@Max\(\d/);
    }
  });

  /**
   * 라운드 54 P1-1: 상한의 단일 소스가 contracts에서 **domain**으로 내려갔다(가져오기 검증이
   * 도메인 술어만 지나기 때문 — packages/domain/src/money-date.ts 참고). 그래서 대조 대상도
   * 그 선언이고, contracts는 그 값을 재수출하기만 한다는 사실을 함께 고정한다.
   */
  it("모바일 상한과 도메인 상한이 같은 숫자이고, contracts는 그것을 재수출한다", () => {
    const packageSource = (...segments: string[]) =>
      readFileSync(join(process.cwd(), "..", "..", "packages", ...segments), "utf8");
    const domain = packageSource("domain", "src", "money-date.ts");
    const match = domain.match(/export const MONEY_KRW_MAX = ([0-9_]+);/);
    expect(match, "MONEY_KRW_MAX 선언을 찾지 못했다").not.toBeNull();
    expect(Number(match![1].replace(/_/g, ""))).toBe(EXPENSE_AMOUNT_MAX_KRW);
    // 도메인 술어가 상한을 실제로 물고 있어야 가져오기 검증이 초과 행을 떨군다.
    expect(domain).toContain("value <= MONEY_KRW_MAX");

    const contracts = packageSource("contracts", "src", "schemas.ts");
    expect(contracts).toContain("export { MONEY_KRW_MAX };");
    // 숫자를 다시 적어 두면 두 층이 갈리는 순간을 아무도 모른다.
    expect(contracts).not.toMatch(/export const MONEY_KRW_MAX = /);
  });
});
