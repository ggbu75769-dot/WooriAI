import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getEntryDateFloor, getSeoulToday, ENTRY_DATE_MAX_PAST_MONTHS, ENTRY_DATE_MAX_PAST_YEARS } from "@wooriai/domain";
import { categoryCatalog } from "../categories";
import { CHILD_BIRTH_DATE_TOO_OLD_ERROR } from "../children/child-form";
import { amountOverLimitMessage, EXPENSE_AMOUNT_MAX_KRW } from "./amount-limit";
import {
  canGoToPreviousExpenseDatePickerMonth,
  EXPENSE_DATE_PICKER_MAX_PAST_MONTHS,
  isExpenseDatePickerDateSelectable
} from "./date-picker-month";
import { MAX_PAST_MONTH_OFFSET } from "./import-landing-month";
import {
  hasQuickExpenseInput,
  isAmountOverLimitForSave,
  isCategoryMissingForSave,
  resolveInitialCategoryId,
  shouldClearQuickExpenseDraftOnClose,
  shouldTileFillItemName,
  validateExpenseDateInput,
  AMOUNT_OVER_LIMIT_NOTICE,
  CATEGORY_REQUIRED_NOTICE,
  EXPENSE_DATE_TOO_OLD_ERROR
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

/**
 * 라운드 51 C-#5 — 기본 카테고리 "기저귀" 고정 제거.
 *
 * 고치는 사실: 추천도 프리필도 없는 품목은 사용자가 타일을 누르지 않는 한 전부 첫 타일로
 * 저장됐고, 리포트·인사이트·홈 타일이 그 오분류를 사실로 그렸다.
 */
describe("resolveInitialCategoryId — 라운드 51 C-#5: 미선택으로 시작한다", () => {
  const previewCategoryId = categoryCatalog[0].id;

  it("세션이 있고 프리필이 없으면 아무것도 선택하지 않는다", () => {
    expect(resolveInitialCategoryId({ hasSession: true, prefilledCategoryId: null, previewCategoryId })).toBeNull();
  });

  it("프리필로 분류가 함께 오면 그 타일로 시작한다(종전 그대로)", () => {
    const prefilled = categoryCatalog[3].id;
    expect(resolveInitialCategoryId({ hasSession: true, prefilledCategoryId: prefilled, previewCategoryId })).toBe(
      prefilled
    );
    // 세션이 없더라도 프리필이 이긴다 -- 판정 순서가 뒤집히지 않았다는 것까지 고정한다.
    expect(resolveInitialCategoryId({ hasSession: false, prefilledCategoryId: prefilled, previewCategoryId })).toBe(
      prefilled
    );
  });

  it("EXP-001: 세션 없는 픽셀 락 캡처만 종전대로 첫 타일이 선택돼 있다", () => {
    expect(resolveInitialCategoryId({ hasSession: false, prefilledCategoryId: null, previewCategoryId })).toBe(
      previewCategoryId
    );
    expect(categoryCatalog[0].label).toBe("기저귀");
  });
});

describe("isCategoryMissingForSave — 분류 없이 저장할 수 없다", () => {
  it("세션이 있는데 미선택이면 막는다", () => {
    expect(isCategoryMissingForSave({ hasSession: true, selectedCategoryId: null })).toBe(true);
  });

  it("타일이 하나라도 눌려 있으면 막지 않는다", () => {
    expect(isCategoryMissingForSave({ hasSession: true, selectedCategoryId: categoryCatalog[2].id })).toBe(false);
  });

  it("세션 없는 프리뷰/캡처 경로는 언제나 통과한다(그 경로에는 저장 자체가 없다)", () => {
    expect(isCategoryMissingForSave({ hasSession: false, selectedCategoryId: null })).toBe(false);
  });

  it("안내 문구는 해요체이고 사용자를 탓하지 않는다(DNC-018)", () => {
    expect(CATEGORY_REQUIRED_NOTICE).toBe("분류를 골라 주시면 바로 저장할게요");
    expect(CATEGORY_REQUIRED_NOTICE.endsWith("요")).toBe(true);
    for (const blaming of ["안 골랐", "선택하지", "누락", "필수", "오류"]) {
      expect(CATEGORY_REQUIRED_NOTICE).not.toContain(blaming);
    }
  });
});

/**
 * GAP-054 #2(트랙 C 몫) — 금액 상한.
 *
 * 고치는 사실: int4를 넘는 금액은 로컬 저장에 **성공**한 뒤 flush에서 5xx로 떨어져 아웃박스에
 * 무한 재시도 행으로 남았다(P0-2 poison). 그래서 판정은 "저장을 시작해도 되는가"이고, 막는
 * 자리는 로컬 쓰기 **전**이다.
 */
describe("isAmountOverLimitForSave — 상한 초과는 저장을 시작하지 않는다", () => {
  it("상한과 같은 값까지는 통과하고, 1원만 넘어도 막는다", () => {
    expect(isAmountOverLimitForSave({ hasSession: true, amountText: String(EXPENSE_AMOUNT_MAX_KRW) })).toBe(false);
    expect(isAmountOverLimitForSave({ hasSession: true, amountText: String(EXPENSE_AMOUNT_MAX_KRW + 1) })).toBe(true);
    // 자릿수를 계속 친 경우(안전 정수 범위 밖)도 초과다.
    expect(isAmountOverLimitForSave({ hasSession: true, amountText: "99999999999999999999" })).toBe(true);
  });

  it("한도 값을 하드코딩하지 않고 amount-limit 단일 소스에서 읽는다", () => {
    expect(EXPENSE_AMOUNT_MAX_KRW).toBe(2_147_483_647);
    expect(AMOUNT_OVER_LIMIT_NOTICE).toBe(amountOverLimitMessage());
    expect(AMOUNT_OVER_LIMIT_NOTICE).toContain(EXPENSE_AMOUNT_MAX_KRW.toLocaleString("ko-KR"));
  });

  it("평범한 금액은 건드리지 않는다", () => {
    for (const amountText of ["38500", "1", "100000000"]) {
      expect(isAmountOverLimitForSave({ hasSession: true, amountText })).toBe(false);
    }
  });

  it("빈 값·숫자가 아닌 값은 여기서 말하지 않는다(종전 금액 가드의 몫)", () => {
    for (const amountText of ["", "   ", "abc"]) {
      expect(isAmountOverLimitForSave({ hasSession: true, amountText })).toBe(false);
    }
  });

  it("세션 없는 프리뷰/EXP-001 캡처 경로는 언제나 통과한다", () => {
    expect(isAmountOverLimitForSave({ hasSession: false, amountText: "38500" })).toBe(false);
    expect(isAmountOverLimitForSave({ hasSession: false, amountText: String(EXPENSE_AMOUNT_MAX_KRW + 1) })).toBe(false);
  });

  it("안내 문구는 해요체이고 사용자를 탓하지 않는다(DNC-018)", () => {
    expect(AMOUNT_OVER_LIMIT_NOTICE.endsWith("요.")).toBe(true);
    for (const blaming of ["잘못", "오류", "실패", "너무"]) {
      expect(AMOUNT_OVER_LIMIT_NOTICE).not.toContain(blaming);
    }
    // int4·서버 사정을 사용자에게 말하지 않는다 -- 한도라는 사실과 그 값만 말한다.
    expect(AMOUNT_OVER_LIMIT_NOTICE).not.toContain("int");
    expect(AMOUNT_OVER_LIMIT_NOTICE).not.toContain("서버");
  });
});

describe("GAP-054 #2 화면 배선 (지출 입력)", () => {
  const source = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");

  it("상한 숫자·문구를 화면에 다시 적지 않는다", () => {
    expect(source).not.toContain("2147483647");
    expect(source).not.toContain("2_147_483_647");
    expect(source).toContain("AMOUNT_OVER_LIMIT_NOTICE");
    expect(source).toContain("isAmountOverLimitForSave");
  });

  it("저장 버튼 두 개가 같은 가드로 막힌다", () => {
    expect(source).toContain(
      "const isAmountOverLimit = isAmountOverLimitForSave({ hasSession: Boolean(authToken), amountText });"
    );
    // 종전 금액 가드와 같은 한 곳(isAmountInvalid)에 합류한다.
    const guardBlock = source.slice(source.indexOf("const isAmountInvalid ="), source.indexOf("라운드 51 C-#5 — 분류 없이"));
    expect(guardBlock).toContain("isAmountOverLimit");
    // GAP-056 #1: 버튼 식의 이름이 isAmountInvalid -> isSaveBlocked로 넓어졌다(텍스트 길이 상한이
    // 같은 자리에 합류했다). 금액 가드는 그 안에 그대로 있고, 두 버튼은 여전히 같은 한 줄을 지난다.
    // 라운드 58 통합리뷰 P1-1: 아이 어긋남 가드가 같은 줄에 합류했다(두 버튼은 여전히 한 줄로 잠긴다).
    expect(source).toContain(
      "const isSaveBlocked = isAmountInvalid || textOverLimitNotices.length > 0 || failedRowChildMismatch;"
    );
    expect(source.match(/disabled=\{saveExpense\.isPending \|\| isSaveBlocked\}/g) ?? []).toHaveLength(2);
  });

  it("오프라인 로컬 저장 **전에** 막는다 (뮤테이션 자체가 시작되지 않는다)", () => {
    const mutationStart = source.indexOf("mutationFn: () => {");
    const localWrite = source.indexOf("return createExpenseOffline(");
    expect(mutationStart).toBeGreaterThan(-1);
    const guard = source.slice(mutationStart, localWrite);
    expect(guard).toContain("isAmountOverLimitForSave({ hasSession: true, amountText })");
    expect(guard).toContain("throw new Error(INVALID_EXPENSE_INPUT_ERROR);");
  });

  it("안내 한 줄은 저장 버튼 바로 위, 분류 안내와 같은 자리다", () => {
    const notice = source.indexOf("{AMOUNT_OVER_LIMIT_NOTICE}");
    const categoryNotice = source.indexOf("{CATEGORY_REQUIRED_NOTICE}");
    const saveButton = source.indexOf('label={saveExpense.isPending ? "저장 중" : "저장하기"}');
    expect(notice).toBeGreaterThan(categoryNotice);
    expect(notice).toBeLessThan(saveButton);
    // 한 곳에서만 말한다(스크린리더가 두 번 읽지 않게).
    expect(source.match(/\{AMOUNT_OVER_LIMIT_NOTICE\}/g) ?? []).toHaveLength(1);
    const noticeBlock = source.slice(source.lastIndexOf("{isAmountOverLimit ? (", notice), notice);
    expect(noticeBlock).toContain('accessibilityRole="alert"');
    expect(noticeBlock).toContain('accessibilityLiveRegion="polite"');
  });
});

describe("라운드 51 C-#5 화면 배선", () => {
  const source = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");

  it("초기 선택 상태를 순수 판정에서 받아 온다 (화면에 규칙을 다시 적지 않는다)", () => {
    expect(source).toContain("const initialCategoryId = resolveInitialCategoryId({");
    expect(source).toContain("hasSession: Boolean(authToken),");
    expect(source).toContain("prefilledCategoryId: prefilledCategory?.id ?? null,");
    expect(source).toContain("previewCategoryId: quickExpenseCategories[0].id");
    expect(source).toContain("useState<QuickExpenseCategory | null>(");
    // 종전의 "무조건 첫 타일" 초기값은 남아 있지 않다.
    expect(source).not.toContain("useState(prefilledCategory ?? quickExpenseCategories[0])");
  });

  it("미선택은 어느 타일에도 하이라이트가 없는 상태로 그려진다", () => {
    expect(source).toContain("const selected = selectedCategory !== null && category.label === selectedCategory.label;");
  });

  it("저장 두 버튼 모두 같은 가드를 지난다", () => {
    expect(source).toContain(
      "const isCategoryMissing = isCategoryMissingForSave({ hasSession: Boolean(authToken), selectedCategoryId });"
    );
    expect(source).toContain("const prepareSave = (continueRecording: boolean) => {");
    expect(source).toContain("if (!prepareSave(false)) return;");
    expect(source).toContain("if (!prepareSave(true)) return;");
    // 뮤테이션 자체도 분류 없이는 시작하지 않는다(가드가 화면 핸들러에만 있지 않다).
    // 라운드 58 통합리뷰 P1-1: 뮤테이션 가드에 아이 어긋남 판정이 childId 바로 뒤에 합류했다.
    expect(source).toContain("!childId || isFailedRowChildMismatch(params.childId, childId) || !selectedCategory ||");
    expect(source).toContain("{CATEGORY_REQUIRED_NOTICE}");
  });

  /**
   * 라운드 51 QA(P2-4): 안내가 카테고리 타일 바로 아래에 있으면, 그 아래로 금액·날짜·판매처·
   * 결제수단·선물 체크박스가 이어지는 이 화면에서는 저장을 누른 사람의 시야 밖이다 -- 눌러도
   * 아무 일도 일어나지 않는 것처럼 보인다. 저장 실패 배너와 **같은 자리**(저장 버튼 바로 위)로
   * 옮겨, 누른 곳에서 답하게 한다.
   */
  it("분류 안내는 저장 버튼 바로 위에 뜬다 (저장 실패 배너와 같은 자리)", () => {
    const notice = source.indexOf("{CATEGORY_REQUIRED_NOTICE}");
    const saveErrorToast = source.indexOf("{saveErrorMessage ? <Toast");
    const saveButton = source.indexOf('label={saveExpense.isPending ? "저장 중" : "저장하기"}');
    expect(saveErrorToast).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(saveErrorToast);
    expect(notice).toBeLessThan(saveButton);
    // 두 곳에서 같은 문장을 동시에 말하지 않는다(스크린리더가 두 번 읽는다).
    expect(source.match(/\{CATEGORY_REQUIRED_NOTICE\}/g) ?? []).toHaveLength(1);
    // 눌린 순간 나타나므로 스크린리더도 함께 읽는다.
    const noticeBlock = source.slice(source.lastIndexOf("{showCategoryNotice ? (", notice), notice);
    expect(noticeBlock).toContain('accessibilityRole="alert"');
    expect(noticeBlock).toContain('accessibilityLiveRegion="polite"');
  });

  it("연속 기록 리셋도 미선택으로 돌아간다", () => {
    const resetStart = source.indexOf("const resetFormForNextEntry = () => {");
    expect(resetStart).toBeGreaterThan(0);
    const resetBlock = source.slice(resetStart, source.indexOf("\n  };", resetStart));
    expect(resetBlock).toContain("setSelectedCategory(null);");
    expect(resetBlock).not.toContain("setSelectedCategory(quickExpenseCategories[0])");
  });
});

/**
 * 라운드 68 A — 손타이핑 지출 날짜 가드. **먼저 복제를 걷었고**, 그다음 하한을 더했다.
 *
 * 종전에는 이 판정이 `app/expenses/new.tsx`와 `app/expenses/[expenseId].tsx`에 각각 통째로
 * 복제돼 있었다(본문 동일). 그 상태로 하한을 더하면 하한이 처음부터 두 벌이 되므로, 이 스위트가
 * 고정하는 것은 값 하나가 아니라 **판정이 한 벌인가 · 그 한 벌이 읽는 쪽과 같은 경계를 쓰는가**다.
 */
describe("라운드 68 A 지출 날짜 하한(20년)", () => {
  const TODAY = getSeoulToday();
  const FLOOR = getEntryDateFloor();

  function shiftDays(iso: string, days: number): string {
    const shifted = new Date(`${iso}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  }

  /** `YYYY-MM`의 다음 달(테스트 전용 — 제품 코드는 픽커의 달 이동을 그대로 쓴다). */
  function monthAfter(yearMonth: string): string {
    const year = Number(yearMonth.slice(0, 4));
    const month = Number(yearMonth.slice(5, 7));
    return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  }

  it("경계 세 값 — 하한 당일 통과 · 하루 넘김 거부 · 오늘 통과", () => {
    expect(validateExpenseDateInput(FLOOR)).toBeNull();
    expect(validateExpenseDateInput(shiftDays(FLOOR, -1))).toBe(EXPENSE_DATE_TOO_OLD_ERROR);
    expect(validateExpenseDateInput(TODAY)).toBeNull();
  });

  it("실패 시나리오: 도달할 수 없는 달의 오타를 거절한다", () => {
    // 정찰이 적은 그 오타(1926-08-14 · 1970-01-01)는 읽는 쪽 넷 어디에서도 열 수 없는 달이다.
    expect(validateExpenseDateInput("1926-08-14")).toBe(EXPENSE_DATE_TOO_OLD_ERROR);
    expect(validateExpenseDateInput("1970-01-01")).toBe(EXPENSE_DATE_TOO_OLD_ERROR);
  });

  it("정상 과거 날짜는 종전과 한 글자도 다르지 않다", () => {
    for (const days of [0, -1, -14, -365, -3650]) {
      expect(validateExpenseDateInput(shiftDays(TODAY, days)), String(days)).toBeNull();
    }
    // 나머지 세 갈래도 그대로다(문구까지).
    expect(validateExpenseDateInput(shiftDays(TODAY, 1))).toBe("미래 날짜는 선택할 수 없어요.");
    expect(validateExpenseDateInput("2026-02-30")).toBe("존재하지 않는 날짜예요.");
    expect(validateExpenseDateInput("2026/08/14")).toBe("YYYY-MM-DD 형식으로 입력해 주세요.");
  });

  it("하한은 **달력 픽커가 마지막으로 열어 주는 달의 1일**과 정확히 같다", () => {
    // 픽커의 과거 바닥은 날이 아니라 달이다(‹ 버튼이 240개월에서 멈춘다). 그래서 쓰기 하한도
    // 그 달의 1일이어야 한다: 더 좁으면 픽커에서 고른 날이 저장 직전에 막히고, 더 넓으면
    // 기록 탭이 열 수 없는 달의 지출이 다시 생긴다.
    const floorMonth = FLOOR.slice(0, 7);
    expect(FLOOR.slice(8)).toBe("01");
    // 하한이 든 달까지는 내려갈 수 있고, 거기서 더는 못 내려간다.
    expect(canGoToPreviousExpenseDatePickerMonth(monthAfter(floorMonth), TODAY)).toBe(true);
    expect(canGoToPreviousExpenseDatePickerMonth(floorMonth, TODAY)).toBe(false);
    // 그 달 안의 날은 픽커가 고를 수 있게 열어 두고, 폼도 그 날을 받는다.
    expect(isExpenseDatePickerDateSelectable(FLOOR, TODAY)).toBe(true);
    expect(validateExpenseDateInput(FLOOR)).toBeNull();
    // 값도 한 벌이다: 읽는 쪽의 240과 쓰는 쪽의 240이 같은 상수에서 온다.
    expect(MAX_PAST_MONTH_OFFSET).toBe(ENTRY_DATE_MAX_PAST_MONTHS);
    expect(EXPENSE_DATE_PICKER_MAX_PAST_MONTHS).toBe(ENTRY_DATE_MAX_PAST_MONTHS);
  });

  it("문구는 숫자를 짓지 않고 도메인에서 읽는다", () => {
    expect(EXPENSE_DATE_TOO_OLD_ERROR).toBe(`${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 날은 고를 수 없어요.`);
    // 아이 출생일 폼도 **글자까지 같은 문장**을 쓴다(같은 경계를 두 이름으로 부르지 않는다).
    expect(EXPENSE_DATE_TOO_OLD_ERROR).toBe(CHILD_BIRTH_DATE_TOO_OLD_ERROR);
  });
});

describe("라운드 68 A 복제 걷기 — 판정은 한 벌만 존재한다", () => {
  const guardsSource = readFileSync(join(process.cwd(), "src/expenses/entry-form-guards.ts"), "utf8");
  const screens = ["app/expenses/new.tsx", "app/expenses/[expenseId].tsx"] as const;

  it("두 화면 모두 판정을 스스로 정의하지 않고 이 모듈에서 가져온다", () => {
    expect(guardsSource).toContain("export function validateExpenseDateInput(");
    for (const path of screens) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source, path).not.toContain("function validateExpenseDateInput(");
      expect(source, path).toContain("validateExpenseDateInput");
      expect(source, path).toContain("expenses/entry-form-guards");
    }
  });

  it("두 화면 중 어느 쪽도 하한 숫자나 날짜 술어를 자기 자리에 다시 적지 않는다", () => {
    for (const path of screens) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source, path).not.toContain("isBeforeEntryDateFloor");
      expect(source, path).not.toContain("ENTRY_DATE_MAX_PAST");
      // 미래·실존 판정도 이제 이 모듈 안에만 있다(화면은 도메인 술어를 직접 부르지 않는다).
      expect(source, path).not.toContain("isFutureSeoulDate(");
      expect(source, path).not.toContain("isValidCalendarDate(");
    }
  });

  it("하한 숫자는 이 모듈에도 적히지 않는다(도메인이 단일 소스)", () => {
    expect(guardsSource).toContain('from "@wooriai/domain"');
    expect(guardsSource).not.toMatch(/\b240\b/);
    expect(guardsSource).toContain("ENTRY_DATE_MAX_PAST_YEARS");
  });
});
