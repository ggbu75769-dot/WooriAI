import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasExpenseTextOverLimit,
  isItemNameOverLimit,
  isMemoOverLimit,
  isMerchantOverLimit,
  isTextOverLimit,
  itemNameOverLimitMessage,
  ITEM_NAME_MAX_LENGTH,
  memoOverLimitMessage,
  MEMO_MAX_LENGTH,
  merchantOverLimitMessage,
  MERCHANT_MAX_LENGTH
} from "./text-limits";

/**
 * GAP-056 #1 — 텍스트 길이 상한의 경계·문구·배선을 고정한다.
 *
 * 관례는 금액 상한(expense-detail-edit-rules.test.ts의 GAP-054 #2 절)과 같다: **판정은 순수
 * 함수로**, **배선은 소스 그렙으로**, 그리고 계약 층(contracts)·서버 DTO와 숫자가 갈리지
 * 않는지 **대조 테스트로** 본다. 화면 자체는 react-native라 vitest에서 렌더할 수 없다.
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const detailScreen = () => source("app/expenses/[expenseId].tsx");
const apiSource = (relative: string) => readFileSync(join(process.cwd(), "..", "api", "src", relative), "utf8");
const packageSource = (...segments: string[]) =>
  readFileSync(join(process.cwd(), "..", "..", "packages", ...segments), "utf8");

const repeat = (length: number) => "가".repeat(length);

describe("GAP-056 #1 — 상한 값과 경계", () => {
  it("세 상한은 서버 DTO가 무는 숫자 그대로다", () => {
    expect(ITEM_NAME_MAX_LENGTH).toBe(100);
    expect(MERCHANT_MAX_LENGTH).toBe(100);
    expect(MEMO_MAX_LENGTH).toBe(500);
  });

  it("경계는 통과하고 한 글자 더는 막힌다(상한 그 자체는 유효한 입력이다)", () => {
    expect(isItemNameOverLimit(repeat(ITEM_NAME_MAX_LENGTH))).toBe(false);
    expect(isItemNameOverLimit(repeat(ITEM_NAME_MAX_LENGTH + 1))).toBe(true);
    expect(isMerchantOverLimit(repeat(MERCHANT_MAX_LENGTH))).toBe(false);
    expect(isMerchantOverLimit(repeat(MERCHANT_MAX_LENGTH + 1))).toBe(true);
    expect(isMemoOverLimit(repeat(MEMO_MAX_LENGTH))).toBe(false);
    expect(isMemoOverLimit(repeat(MEMO_MAX_LENGTH + 1))).toBe(true);
  });

  it("빈 값·필수 여부는 여기서 판단하지 않는다(기존 가드의 몫)", () => {
    expect(isItemNameOverLimit("")).toBe(false);
    expect(isMerchantOverLimit("")).toBe(false);
    expect(isMemoOverLimit("")).toBe(false);
  });

  it("일반 판정은 넘긴 문자열의 길이만 본다(trim·정규화를 몰래 하지 않는다)", () => {
    // 서버 class-validator의 @MaxLength도 받은 문자열의 .length를 그대로 본다 -- 여기서
    // 몰래 다듬으면 클라이언트가 통과시킨 입력이 서버에서 400이 되는 어긋남이 생긴다.
    expect(isTextOverLimit("가".repeat(4) + " ", 4)).toBe(true);
    expect(isTextOverLimit("가".repeat(4), 4)).toBe(false);
    expect(isTextOverLimit("", 0)).toBe(false);
  });

  it("저장 직전 한 방 판정은 셋 중 하나만 넘어도 true이고, 없는 값은 통과다", () => {
    expect(hasExpenseTextOverLimit({})).toBe(false);
    expect(hasExpenseTextOverLimit({ itemName: repeat(ITEM_NAME_MAX_LENGTH), memo: repeat(MEMO_MAX_LENGTH) })).toBe(false);
    expect(hasExpenseTextOverLimit({ itemName: repeat(ITEM_NAME_MAX_LENGTH + 1) })).toBe(true);
    expect(hasExpenseTextOverLimit({ merchant: repeat(MERCHANT_MAX_LENGTH + 1) })).toBe(true);
    expect(hasExpenseTextOverLimit({ memo: repeat(MEMO_MAX_LENGTH + 1) })).toBe(true);
  });
});

describe("GAP-056 #1 — 안내 문구", () => {
  it("몇 자까지 쓸 수 있는지만 말한다(해요체, 죄책감·기술 용어 없음)", () => {
    expect(itemNameOverLimitMessage()).toBe("품목명은 100자까지 입력할 수 있어요.");
    expect(merchantOverLimitMessage()).toBe("판매처는 100자까지 입력할 수 있어요.");
    expect(memoOverLimitMessage()).toBe("메모는 500자까지 입력할 수 있어요.");
    for (const message of [itemNameOverLimitMessage(), merchantOverLimitMessage(), memoOverLimitMessage()]) {
      expect(message.endsWith("어요.")).toBe(true);
      // varchar·DTO·400 같은 말은 사용자 문구에 등장하지 않는다.
      expect(message).not.toMatch(/varchar|DTO|400|서버/);
    }
  });

  it("정기 지출 템플릿의 같은 안내와 한 문장이다(같은 사실을 화면마다 다르게 말하지 않는다)", () => {
    const recurring = source("src/expenses/recurring-template.ts");
    expect(recurring).toContain("자까지 입력할 수 있어요.");
  });
});

describe("GAP-056 #1 — 단일 소스는 contracts다 (드리프트 대조)", () => {
  /**
   * 값의 단일 소스는 `@wooriai/contracts`다. 모바일은 그 패키지를 의존하지 않아
   * (apps/mobile/package.json에 contracts가 없다) 값을 자기 모듈에 두므로, 두 선언이 갈리는
   * 순간을 여기서 빨갛게 만든다 — amount-limit.ts ↔ @wooriai/domain의 관계와 같은 관례다.
   */
  it("contracts 선언과 모바일 상수가 같은 숫자다", () => {
    const contracts = packageSource("contracts", "src", "schemas.ts");
    const declared = (name: string) => {
      const match = contracts.match(new RegExp(`export const ${name} = ([0-9_]+);`));
      expect(match, `${name} 선언을 찾지 못했다`).not.toBeNull();
      return Number(match![1].replace(/_/g, ""));
    };
    expect(declared("EXPENSE_ITEM_NAME_MAX_LENGTH")).toBe(ITEM_NAME_MAX_LENGTH);
    expect(declared("EXPENSE_MERCHANT_MAX_LENGTH")).toBe(MERCHANT_MAX_LENGTH);
    expect(declared("EXPENSE_MEMO_MAX_LENGTH")).toBe(MEMO_MAX_LENGTH);
  });

  it("contracts의 요청 스키마가 숫자 리터럴이 아니라 그 상수를 쓴다", () => {
    const contracts = packageSource("contracts", "src", "schemas.ts");
    const expenseBlock = contracts.slice(
      contracts.indexOf("export const createExpenseRequestSchema"),
      contracts.indexOf("export const deleteExpenseRequestSchema")
    );
    expect(expenseBlock).toContain("max(EXPENSE_ITEM_NAME_MAX_LENGTH)");
    expect(expenseBlock).toContain("max(EXPENSE_MERCHANT_MAX_LENGTH)");
    expect(expenseBlock).toContain("max(EXPENSE_MEMO_MAX_LENGTH)");
    // 리터럴이 되살아나면 계약이 두 벌이 된다.
    expect(expenseBlock).not.toContain(".max(100)");
    expect(expenseBlock).not.toContain(".max(500)");
  });

  it("서버 DTO가 같은 상수를 @MaxLength로 문다(생성·수정 모두)", () => {
    const dto = apiSource("finance/dto/expense.dto.ts");
    expect(dto).toContain("EXPENSE_ITEM_NAME_MAX_LENGTH");
    expect(dto).toContain("EXPENSE_MERCHANT_MAX_LENGTH");
    expect(dto).toContain("EXPENSE_MEMO_MAX_LENGTH");
    expect(dto).toContain('} from "@wooriai/contracts";');
    // 숫자를 손으로 적어 두면 계약과 갈리는 순간을 아무도 모른다.
    expect(dto).not.toContain("@MaxLength(100)");
    expect(dto).not.toContain("@MaxLength(500)");

    for (const className of ["export class CreateExpenseDto", "export class UpdateExpenseDto"]) {
      const start = dto.indexOf(className);
      expect(start, className).toBeGreaterThan(-1);
      const block = dto.slice(start, dto.indexOf("export class", start + 1) === -1 ? undefined : dto.indexOf("export class", start + 1));
      expect(block, className).toContain("@MaxLength(EXPENSE_ITEM_NAME_MAX_LENGTH)");
      expect(block, className).toContain("@MaxLength(EXPENSE_MERCHANT_MAX_LENGTH)");
      expect(block, className).toContain("@MaxLength(EXPENSE_MEMO_MAX_LENGTH)");
    }
  });

  it("모듈이 특정 화면에 묶여 있지 않다(빠른 기록 시트도 그대로 import할 수 있다)", () => {
    // 순수 모듈이다: import이 하나도 없으므로 어느 화면·런타임에서도 그대로 부를 수 있다.
    const module = source("src/expenses/text-limits.ts");
    expect(module).not.toMatch(/^import /m);
    expect(module).not.toMatch(/\brequire\(/);
  });
});

describe("GAP-056 #1/#6 — 지출 상세 화면 배선", () => {
  it("세 입력 칸이 상한 값을 로컬에 다시 적지 않고 단일 소스를 import한다", () => {
    const screen = detailScreen();
    expect(screen).toContain('} from "../../src/expenses/text-limits";');
    expect(screen).toContain("maxLength={ITEM_NAME_MAX_LENGTH}");
    expect(screen).toContain("maxLength={MERCHANT_MAX_LENGTH}");
    expect(screen).toContain("maxLength={MEMO_MAX_LENGTH}");
    expect(screen).not.toContain("maxLength={100}");
    expect(screen).not.toContain("maxLength={500}");
  });

  it("안내 한 줄이 세 칸 모두에 있고, 문구는 이 모듈에서 온다", () => {
    const screen = detailScreen();
    expect(screen).toContain("itemNameOverLimitMessage()");
    expect(screen).toContain("merchantOverLimitMessage()");
    expect(screen).toContain("memoOverLimitMessage()");
    expect(screen).toContain("{merchantError}");
    expect(screen).toContain("{memoError}");
    // 문구 사본이 화면에 눌어붙지 않았다.
    expect(screen).not.toContain("자까지 입력할 수 있어요");
  });

  it("저장 버튼 활성 판정과 저장 직전 가드가 **둘 다** 길이를 본다", () => {
    const screen = detailScreen();
    const canSaveBlock = screen.slice(screen.indexOf("const canSave ="), screen.indexOf("const canTapAmountPreset"));
    expect(canSaveBlock).toContain("!merchantError");
    expect(canSaveBlock).toContain("!memoError");
    expect(canSaveBlock).toContain("!itemNameError");

    // 버튼 비활성만으로는 상태가 앞서가는 경로를 다 막지 못한다 -- 로컬 저장 **전에** 한 번 더 본다.
    const mutationBlock = screen.slice(screen.indexOf("const save = useMutation({"), screen.indexOf("const remove = useMutation({"));
    expect(mutationBlock).toContain("isItemNameOverLimit(trimmedItemName)");
    expect(mutationBlock).toContain("isMerchantOverLimit(trimmedMerchant)");
    expect(mutationBlock).toContain("isMemoOverLimit(memo)");
    expect(mutationBlock).toContain("throw new Error(INVALID_EXPENSE_INPUT_ERROR)");
  });

  /**
   * GAP-056 #6 — 650ms 뒤 화면을 떠나는 타이머가 언마운트 후에도 살아 있으면, 사용자가 스스로
   * 이동한 화면에서 한 칸 더 뒤로 밀리거나 기록 탭으로 덮어써진다.
   */
  it("저장·삭제의 이탈 타이머가 ref에 담기고 언마운트에서 취소된다", () => {
    const screen = detailScreen();
    expect(screen).toContain("const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);");
    // 예약은 두 곳(저장·삭제) 모두 ref에 담는다 -- 담기지 않은 타이머는 취소할 수 없다.
    expect(screen.match(/leaveTimerRef\.current = setTimeout\(leaveAfterMutation, 650\);/g) ?? []).toHaveLength(2);
    expect(screen.match(/if \(leaveTimerRef\.current\) clearTimeout\(leaveTimerRef\.current\);/g) ?? []).toHaveLength(3);
    // 언마운트 cleanup(빈 의존성 배열의 useEffect가 돌려주는 함수) — CSV 내보내기와 같은 관례.
    expect(screen).toContain("return () => {\n      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);\n    };");
    expect(source("src/export/ExpenseCsvExport.tsx")).toContain("if (toastTimerRef.current) clearTimeout(toastTimerRef.current);");
  });
});
