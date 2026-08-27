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
    // 계속 기록이면 이동 자체를 건너뛴다(같은 자리에 머문다).
    expect(successBranch.indexOf("resetFormForNextEntry();")).toBeLessThan(
      successBranch.indexOf("router.replace(postSaveDestination)")
    );
    expect(successBranch).toContain("return;");
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
