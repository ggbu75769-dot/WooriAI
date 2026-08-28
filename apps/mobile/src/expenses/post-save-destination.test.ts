import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canContinueRecording,
  CONTINUE_RECORDING_LABEL,
  CONTINUE_RECORDING_SAVED_MESSAGE,
  EXPENSE_ENTRY_SOURCE_PARAM,
  parseExpenseEntrySource,
  POST_SAVE_DEFAULT_DESTINATION,
  POST_SAVE_ITEMS_DESTINATION,
  resolvePostSaveDestination
} from "./post-save-destination";
import { OFFLINE_SAVED_MESSAGE, SERVER_CONFIRMED_MESSAGE } from "../offline/messages";
import { expenseLinkParams } from "../items/expense-link-prompt";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("라운드 48 T4(D1) 저장 후 목적지 판정", () => {
  it("준비템 목록에서 온 기록은 준비템 탭으로 돌아간다(방금 오른 준비율을 볼 수 있게)", () => {
    expect(resolvePostSaveDestination({ from: "items" })).toBe(POST_SAVE_ITEMS_DESTINATION);
    expect(POST_SAVE_ITEMS_DESTINATION).toBe("/(tabs)/items");
  });

  it("준비템 상세에서 온 기록도 준비템 탭이다(다음 라운드 배선 대비 계약 고정)", () => {
    expect(resolvePostSaveDestination({ from: "item-detail" })).toBe(POST_SAVE_ITEMS_DESTINATION);
  });

  it("구매 확인 카드('샀어요')는 종전 그대로 기록 탭이다 -- 전역 오버레이라 준비템 탭에서 왔다는 보장이 없다", () => {
    expect(resolvePostSaveDestination({ from: "purchase-followup" })).toBe(POST_SAVE_DEFAULT_DESTINATION);
    expect(POST_SAVE_DEFAULT_DESTINATION).toBe("/(tabs)/records");
  });

  it("출처를 밝히지 않은 진입(홈·기록 탭 FAB, 딥링크)은 종전 동작 그대로다", () => {
    expect(resolvePostSaveDestination({})).toBe(POST_SAVE_DEFAULT_DESTINATION);
    expect(resolvePostSaveDestination(undefined)).toBe(POST_SAVE_DEFAULT_DESTINATION);
    expect(resolvePostSaveDestination(null)).toBe(POST_SAVE_DEFAULT_DESTINATION);
    expect(resolvePostSaveDestination({ from: undefined })).toBe(POST_SAVE_DEFAULT_DESTINATION);
  });

  it("모르는·오염된 값은 조용히 기본값으로 떨어진다(링크 하나로 엉뚱한 탭에 던져지지 않는다)", () => {
    for (const value of ["", "   ", "ITEMS", "home", "/(tabs)/items", 42, true, {}, [], [7]]) {
      expect(resolvePostSaveDestination({ from: value }), `from=${JSON.stringify(value)}`).toBe(
        POST_SAVE_DEFAULT_DESTINATION
      );
    }
    // 앞뒤 공백만 붙은 값은 같은 진입점으로 읽는다(대소문자는 다른 값으로 본다 -- 지어내지 않는다).
    expect(resolvePostSaveDestination({ from: " items " })).toBe(POST_SAVE_ITEMS_DESTINATION);
  });

  it("expo-router가 배열로 넘겨도 첫 문자열만 읽는다(기존 프리필 파싱과 같은 규율)", () => {
    expect(resolvePostSaveDestination({ from: ["items", "records"] })).toBe(POST_SAVE_ITEMS_DESTINATION);
    expect(parseExpenseEntrySource(["item-detail"])).toBe("item-detail");
    expect(parseExpenseEntrySource([])).toBeNull();
  });

  it("아는 진입점만 값으로 남고 나머지는 null이다", () => {
    expect(parseExpenseEntrySource("items")).toBe("items");
    expect(parseExpenseEntrySource("purchase-followup")).toBe("purchase-followup");
    expect(parseExpenseEntrySource("whatever")).toBeNull();
  });
});

describe("라운드 48 T4(D1) 저장하고 계속 기록", () => {
  it("일반 기록에서는 내놓고, 준비템에서 넘어온 기록에서는 내놓지 않는다", () => {
    expect(canContinueRecording({})).toBe(true);
    expect(canContinueRecording({ linkedItemTemplateId: null })).toBe(true);
    expect(canContinueRecording({ linkedItemTemplateId: "   " })).toBe(true);
    // 연결이 살아 있으면 두 번째 기록도 같은 준비템에 붙어 사용자가 연결한 적 없는 기록이 된다.
    expect(canContinueRecording({ linkedItemTemplateId: "tpl-1" })).toBe(false);
  });

  it("계속 기록 문구는 일반 저장 문구와 다르다 -- 칸이 비워진 이유를 같은 줄에서 말한다", () => {
    expect(CONTINUE_RECORDING_LABEL).toBe("저장하고 계속 기록");
    expect(CONTINUE_RECORDING_SAVED_MESSAGE).toContain("이어서");
    expect(CONTINUE_RECORDING_SAVED_MESSAGE).not.toContain("연결되면 자동으로 반영할게요");
  });

  /**
   * 라운드 48 QA(P2-1) — 이 경로의 저장도 로컬 우선(createExpenseOffline)이라, 문구가 뜨는
   * 순간 서버는 아직 이 기록을 모른다. "저장했어요"라고만 하면 로컬 저장을 서버 저장처럼
   * 말하는 셈이라, 앞머리를 일반 저장과 같은 관례로 맞춘다.
   */
  it("어디에 저장했는지 사실대로 말한다 -- 일반 저장(OFFLINE_SAVED_MESSAGE)과 같은 앞머리", () => {
    expect(CONTINUE_RECORDING_SAVED_MESSAGE).toBe("기기에 저장했어요. 이어서 다음 항목을 기록해 보세요.");
    const prefix = "기기에 저장했어요.";
    expect(OFFLINE_SAVED_MESSAGE.startsWith(prefix)).toBe(true);
    expect(CONTINUE_RECORDING_SAVED_MESSAGE.startsWith(prefix)).toBe(true);
    // 서버가 받았다고 말하는 문구(SERVER_CONFIRMED_MESSAGE)를 흉내 내지 않는다.
    expect(CONTINUE_RECORDING_SAVED_MESSAGE).not.toBe(SERVER_CONFIRMED_MESSAGE);
    expect(CONTINUE_RECORDING_SAVED_MESSAGE).not.toContain("기록했어요");
  });
});

describe("라운드 48 T4(D1) 화면 배선 (app/expenses/new.tsx)", () => {
  const newExpenseSource = source("app/expenses/new.tsx");

  it("저장 성공 후의 이동이 고정 경로가 아니라 판정 모듈의 목적지를 쓴다", () => {
    expect(newExpenseSource).toContain("const postSaveDestination = resolvePostSaveDestination(params);");
    expect(newExpenseSource).toContain("setTimeout(() => router.replace(postSaveDestination), 650);");
    // 종전의 고정 목적지는 남아 있지 않다.
    expect(newExpenseSource).not.toContain('setTimeout(() => router.replace("/(tabs)/records"), 650)');
  });

  it("`from` 파라미터를 실제로 받는다(받지 않으면 판정할 값 자체가 없다)", () => {
    const paramsBlock = newExpenseSource.slice(
      newExpenseSource.indexOf("const params = useLocalSearchParams<{"),
      newExpenseSource.indexOf("const linkedItemTemplateId")
    );
    expect(paramsBlock).toContain("from?: string;");
  });

  it("보조 버튼은 같은 뮤테이션을 타고 성공 후 화면을 떠나지 않는다", () => {
    expect(newExpenseSource).toContain("label={CONTINUE_RECORDING_LABEL}");
    expect(newExpenseSource).toContain("continueAfterSaveRef.current = true;");
    expect(newExpenseSource).toContain("continueAfterSaveRef.current = false;");
    // 두 버튼 모두 saveExpense.mutate()를 부른다 -- 저장 규칙이 두 벌이 되지 않는다.
    expect(newExpenseSource.match(/saveExpense\.mutate\(\)/g) ?? []).toHaveLength(2);
    const successBranch = newExpenseSource.slice(
      newExpenseSource.indexOf("onSuccess: async () => {"),
      newExpenseSource.indexOf("const formattedAmount =")
    );
    expect(successBranch).toContain("resetFormForNextEntry();");

    /**
     * 라운드 48 QA(P3-10) — 예전에는 성공 분기 **전체**에서 "return;"을 찾았다. 그 자리에는
     * 이동 코드도 함께 있으므로, 그 단언은 "어딘가에 return이 있다"만 말할 뿐 계속 기록일 때
     * 이동을 실제로 건너뛰는지는 증명하지 못했다(분기 밖 아무 곳의 return이라도 통과한다).
     * 분기 블록만 잘라 그 안에 이동 호출이 **없다**는 것까지 본다.
     */
    const continueBranchStart = successBranch.indexOf("if (continueRecording) {");
    expect(continueBranchStart, "계속 기록 분기를 찾지 못했다").toBeGreaterThan(-1);
    const continueBranchEnd = successBranch.indexOf("\n      }", continueBranchStart);
    expect(continueBranchEnd, "계속 기록 분기의 끝을 찾지 못했다").toBeGreaterThan(continueBranchStart);
    const continueBranch = successBranch.slice(continueBranchStart, continueBranchEnd);

    expect(continueBranch).toContain("resetFormForNextEntry();");
    expect(continueBranch).toContain("return;");
    // 이 블록 안에서는 화면을 떠나는 어떤 호출도 하지 않는다(라우터도, 지연 이동도).
    expect(continueBranch).not.toContain("router.");
    expect(continueBranch).not.toContain("setTimeout(");
    // 그리고 이동은 이 블록 **뒤에** 있다 -- 즉 위 return이 실제로 그것을 건너뛴다.
    expect(successBranch.indexOf("router.replace(postSaveDestination)")).toBeGreaterThan(continueBranchEnd);
  });

  /**
   * 라운드 48 QA(P2-2) — "저장하고 계속 기록"은 화면을 떠나지 않으므로 성공 토스트가 그대로
   * 남는다. 이어 적은 두 번째 항목의 저장이 실패하면 초록(성공)과 빨강(실패)이 한 화면에 함께
   * 서서, 방금 누른 저장이 됐다는 건지 안 됐다는 건지 화면이 두 가지로 말한다.
   */
  it("새 저장 시도는 이전 실패 배너와 성공 토스트를 **함께** 지운다", () => {
    const onMutateStart = newExpenseSource.indexOf("onMutate: () => {");
    expect(onMutateStart, "onMutate 블록을 찾지 못했다").toBeGreaterThan(-1);
    const onMutateBlock = newExpenseSource.slice(onMutateStart, newExpenseSource.indexOf("\n    }", onMutateStart));
    expect(onMutateBlock).toContain("setSaveErrorMessage(null);");
    expect(onMutateBlock).toContain("setSavedMessage(null);");
  });

  it("보조 버튼은 세션이 있을 때만·준비템 연결이 없을 때만 그려진다(EXP-001 초기 렌더 불변)", () => {
    expect(newExpenseSource).toContain("{authToken && canContinueRecording({ linkedItemTemplateId }) ? (");
    // 픽셀락 캡처가 찍는 초기 렌더 문자열은 그대로다.
    expect(newExpenseSource).toContain("₩ 38,500");
  });

  it("저장 중·금액 미입력에는 두 버튼이 함께 잠긴다(보조 버튼만 열려 있는 우회로가 없다)", () => {
    expect(newExpenseSource.match(/disabled=\{saveExpense\.isPending \|\| isAmountInvalid\}/g) ?? []).toHaveLength(2);
  });

  it("두 버튼 모두 보기 전용 게이트를 통과한다(라운드 40 J-1)", () => {
    expect(newExpenseSource.match(/expenseGate\.guard\(/g) ?? []).toHaveLength(2);
  });

  it("빈 폼은 초안을 쓰지 않고 지운다 -- 계속 기록이 자동 분류 추천을 조용히 끄지 않도록", () => {
    expect(newExpenseSource).toContain(
      "const hasTypedInput = Boolean(itemName.trim() || amountText.trim() || memo.trim());"
    );
    expect(newExpenseSource).toContain("if (!hasTypedInput) {");
  });
});

describe("라운드 48 T4(D1) 진입점 배선", () => {
  it("구매 확인 카드의 '샀어요'가 출처를 함께 넘긴다", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain('import { EXPENSE_ENTRY_SOURCE_PARAM } from "../expenses/post-save-destination";');
    expect(promptSource).toContain('[EXPENSE_ENTRY_SOURCE_PARAM]: "purchase-followup"');
    expect(EXPENSE_ENTRY_SOURCE_PARAM).toBe("from");
  });

  it("기록 탭의 '또 기록'은 종전 그대로 출처를 붙이지 않는다(목적지도 종전 기록 탭)", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain('router.push({ pathname: "/expenses/new", params });');
    expect(recordsSource).not.toContain(`${EXPENSE_ENTRY_SOURCE_PARAM}: "items"`);
  });
});

/**
 * 라운드 48 QA(P2-5) — 판정(resolvePostSaveDestination)은 T4(D1)에 이미 있었지만, **준비템 쪽
 * 진입점 중 어느 것도 `from`을 붙이지 않아** 저장 후 준비템 탭 복귀가 실제로는 한 경로에서도
 * 동작하지 않았다. 준비템에서 기록해도 늘 기록 탭으로 튕겨 나가, 방금 오른 준비율과 100%
 * 축하 배너를 아무도 보지 못했다(핵심 루프의 마지막 고리).
 *
 * 화면은 vitest에서 렌더되지 않으므로(react-native 네이티브 바인딩 없음) 배선은 소스로 잠근다.
 */
describe("라운드 48 QA(P2-5) 준비템 → 지출 기록 진입점 배선", () => {
  it("파라미터 조립기가 출처를 실을 수 있고, 넘기지 않으면 종전 모양 그대로다", () => {
    const base = { itemName: "젖병", itemTemplateId: "tpl-1" };
    // 기본값 = 종전 동작. `from` 키 자체를 만들지 않는다.
    expect(expenseLinkParams(base)).toEqual(base);
    expect(EXPENSE_ENTRY_SOURCE_PARAM in expenseLinkParams(base)).toBe(false);
    expect(resolvePostSaveDestination(expenseLinkParams(base))).toBe(POST_SAVE_DEFAULT_DESTINATION);

    // 출처를 넘기면 프리필 두 개는 그대로 두고 라우팅 힌트만 더한다.
    expect(expenseLinkParams(base, "items")).toEqual({ ...base, [EXPENSE_ENTRY_SOURCE_PARAM]: "items" });
    expect(expenseLinkParams(base, "item-detail")).toEqual({ ...base, [EXPENSE_ENTRY_SOURCE_PARAM]: "item-detail" });
  });

  it("조립한 파라미터를 그대로 판정에 넣으면 준비템 탭이 나온다(양 끝이 맞물린다)", () => {
    for (const entrySource of ["items", "item-detail"] as const) {
      const params = expenseLinkParams({ itemName: "젖병", itemTemplateId: "tpl-1" }, entrySource);
      expect(resolvePostSaveDestination(params), entrySource).toBe(POST_SAVE_ITEMS_DESTINATION);
    }
  });

  it("준비템 목록 탭의 '지출도 기록할까요?'가 출처를 함께 넘긴다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    // 라운드 49 C-02에서 같은 호출에 분류(categoryId)가 하나 더 실렸다 — 이 테스트가 지키는
    // 사실은 그대로다: 출처("items")가 **이 조립기를 통해** 함께 넘어간다.
    const promptStart = itemsSource.indexOf("const openExpenseLinkPrompt");
    expect(promptStart).toBeGreaterThan(-1);
    const promptBlock = itemsSource.slice(promptStart, itemsSource.indexOf("return (", promptStart));
    expect(promptBlock).toContain("expenseLinkParams(");
    expect(promptBlock).toContain("itemName: prompt.itemName, itemTemplateId: prompt.itemTemplateId");
    expect(promptBlock).toContain('"items"');
  });

  it("준비템 상세의 두 버튼이 **같은 조립기로** 출처를 넘긴다(버튼마다 목적지가 갈리지 않게)", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    // 라운드 49 C-02: 같은 조립기 호출에 분류(categoryId)가 더해졌다. 지키는 사실은 그대로다 --
    // 두 버튼이 **같은 파라미터 조립기**를 타야 목적지가 버튼마다 갈리지 않는다.
    const calls =
      detailSource.match(
        /expenseLinkParams\(\s*\{ itemName: visibleDetail\.name, itemTemplateId, categoryId: visibleDetail\.categoryId \},\s*"item-detail"\s*\)/g
      ) ?? [];
    // ① 상시 진입점("이미 샀어요 · 지출로 기록") ② 링크 클릭 후 카드의 "지출 기록하고 준비 완료".
    expect(calls).toHaveLength(2);
    // 조립기를 거치지 않고 파라미터를 손으로 적던 옛 호출은 남아 있지 않다.
    expect(detailSource).not.toContain('params: { itemName: visibleDetail.name, itemTemplateId }');
  });

  it("저장 성공 후 준비템 캐시를 무효화한다 -- 돌아간 화면의 준비율이 예전 값이면 복귀가 무의미하다", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    const successBranch = newExpenseSource.slice(
      newExpenseSource.indexOf("onSuccess: async () => {"),
      newExpenseSource.indexOf("const formattedAmount =")
    );
    expect(successBranch).toContain('queryClient.invalidateQueries({ queryKey: ["items"] })');
    expect(successBranch).toContain('queryClient.invalidateQueries({ queryKey: ["item-detail"] })');
  });
});
