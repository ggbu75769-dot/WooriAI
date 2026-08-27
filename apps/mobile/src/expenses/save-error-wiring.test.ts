import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EXP-124 화면 배선 계약 (source verification — react-native 화면은 vitest에서 렌더할 수 없어
 * 이 저장소의 관례대로 소스 grep으로 확인한다: src/expenses/amount-presets-wiring.test.ts,
 * src/offline/ui-wiring.test.ts 참고).
 *
 * 이 티켓 이전의 상태는 "세 뮤테이션 모두 onSuccess만 있고 onError가 없다"였다. 그래서
 * 입력 가드가 던지든 SQLite 쓰기가 실패하든 화면은 아무 말도 하지 않았다. 여기서 핀으로
 * 박아 두는 것은 다음과 같다.
 *
 * 1) 세 뮤테이션(create/update/delete)에 실패 경로가 실제로 배선되어 있다.
 * 2) 문구는 화면에 인라인되지 않고 순수 모듈(save-error-messages.ts)에서만 온다 —
 *    그래야 단위 테스트가 톤/매핑을 계속 지킬 수 있다.
 * 3) 실패해도 입력값을 지우는 코드가 없다(사용자가 고쳐서 바로 다시 저장할 수 있어야 한다).
 * 4) 저장 버튼은 isPending 동안 비활성이라 중복 제출이 생기지 않는다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const newExpenseSource = source("app/expenses/new.tsx");
const detailSource = source("app/expenses/[expenseId].tsx");

describe("EXP-124 quick-expense create failure wiring", () => {
  it("handles mutation failure instead of only the success path", () => {
    expect(newExpenseSource).toContain("onError: (error) => {");
    expect(newExpenseSource).toContain('setSaveErrorMessage(expenseMutationErrorMessage("create", error));');
  });

  it("takes the copy from the shared pure module, not an inline literal", () => {
    expect(newExpenseSource).toContain('from "../../src/expenses/save-error-messages"');
    expect(newExpenseSource).toContain("INVALID_EXPENSE_INPUT_ERROR");
    // 가드가 던지는 값도 같은 모듈의 상수를 쓴다 -- 매핑이 매직 문자열로 갈라지지 않도록.
    expect(newExpenseSource).toContain("throw new Error(INVALID_EXPENSE_INPUT_ERROR);");
    expect(newExpenseSource).not.toContain('throw new Error("invalid expense")');
    expect(newExpenseSource).not.toContain('<Toast message="금액과 항목을 확인해 주세요." tone="error" />');
  });

  it("renders the error banner next to the save button and clears it when the next attempt starts", () => {
    expect(newExpenseSource).toContain("{saveErrorMessage ? <Toast message={saveErrorMessage} tone=\"error\" /> : null}");
    expect(newExpenseSource).toContain("onMutate: () => {");
    expect(newExpenseSource).toContain("setSaveErrorMessage(null);");
    // 배너는 저장 버튼 바로 위에 있어야 한다 -- 시트 어딘가에 묻히면 못 본 채로 다시 누른다.
    const bannerIndex = newExpenseSource.indexOf("{saveErrorMessage ?");
    const saveButtonIndex = newExpenseSource.indexOf("label={saveExpense.isPending ?");
    expect(bannerIndex).toBeGreaterThan(0);
    expect(saveButtonIndex).toBeGreaterThan(bannerIndex);
  });

  it("keeps the typed values (and the autosaved draft) untouched on failure", () => {
    const mutationBlock = newExpenseSource.slice(
      newExpenseSource.indexOf("const saveExpense = useMutation({"),
      newExpenseSource.indexOf("const formattedAmount =")
    );
    const errorBranch = mutationBlock.slice(mutationBlock.indexOf("onError:"), mutationBlock.indexOf("onSuccess:"));
    expect(errorBranch.length).toBeGreaterThan(0);
    for (const reset of ["setAmountText(", "setItemName(", "setMemo(", "clearQuickExpenseDraft(", "router."]) {
      expect(errorBranch, `onError must not run ${reset}`).not.toContain(reset);
    }
  });

  it("blocks double submits while the save is in flight", () => {
    expect(newExpenseSource).toContain("disabled={saveExpense.isPending || isAmountInvalid}");
  });
});

describe("EXP-124 expense edit/delete failure wiring", () => {
  it("shows an inline banner when the edit save fails", () => {
    expect(detailSource).toContain('from "../../src/expenses/save-error-messages"');
    expect(detailSource).toContain('setSaveErrorMessage(expenseMutationErrorMessage("update", error));');
    expect(detailSource).toContain("{saveErrorMessage ? <Toast message={saveErrorMessage} tone=\"error\" /> : null}");
    expect(detailSource).toContain("onMutate: () => {");
    // 이전의 "save/remove 중 아무거나 실패하면 같은 문구" 배선은 사라져야 한다.
    expect(detailSource).not.toContain("save.isError || remove.isError");
    expect(detailSource).not.toContain('<Toast message="저장하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" />');
  });

  it("announces a failed delete through an Alert, since the confirm flow started in one", () => {
    expect(detailSource).toContain(
      'Alert.alert(EXPENSE_DELETE_FAILED_ALERT_TITLE, expenseMutationErrorMessage("delete", error));'
    );
    expect(detailSource).toContain("throw new Error(EXPENSE_NOT_READY_ERROR);");
    expect(detailSource).not.toContain('throw new Error("missing expense")');
    expect(detailSource).not.toContain('throw new Error("invalid expense")');
  });

  it("keeps both controls disabled while their mutation is in flight", () => {
    expect(detailSource).toContain("disabled={!canSave || save.isPending}");
    expect(detailSource).toContain("disabled={remove.isPending}");
  });

  it("leaves the edited fields in place when a save fails", () => {
    const saveBlock = detailSource.slice(
      detailSource.indexOf("const save = useMutation({"),
      detailSource.indexOf("const remove = useMutation({")
    );
    const errorBranch = saveBlock.slice(saveBlock.indexOf("onError:"), saveBlock.indexOf("onSuccess:"));
    expect(errorBranch.length).toBeGreaterThan(0);
    for (const reset of ["setItemName(", "setAmountDigits(", "setMemo(", "router."]) {
      expect(errorBranch, `onError must not run ${reset}`).not.toContain(reset);
    }
  });
});
