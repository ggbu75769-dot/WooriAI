import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_AMOUNT_MAX_KRW } from "./amount-limit";
import { merchantOverLimitMessage } from "./text-limits";
import { parseExpensePrefillParams } from "./record-row-actions";
import {
  applyRecurringSkip,
  buildRecurringReminder,
  buildRecurringTemplate,
  formatRecurringTemplateLine,
  isRecurringYearMonth,
  recurringDueDateForMonth,
  recurringPrefillParams,
  recurringRecordAccessibilityLabel,
  recurringReminderCopy,
  recurringReminderTitle,
  recurringSkipAccessibilityLabel,
  recurringTemplateValidationError,
  recurringYearMonthOf,
  sanitizeRecurringTemplates,
  RECURRING_AMOUNT_OVER_LIMIT_MESSAGE,
  RECURRING_AMOUNT_REQUIRED_MESSAGE,
  RECURRING_CATEGORY_REQUIRED_MESSAGE,
  RECURRING_CHILD_REQUIRED_MESSAGE,
  RECURRING_DAY_OF_MONTH_MESSAGE,
  RECURRING_ENTRY_SOURCE,
  RECURRING_ITEM_NAME_MAX_LENGTH,
  RECURRING_ITEM_NAME_REQUIRED_MESSAGE,
  RECURRING_MERCHANT_MAX_LENGTH,
  RECURRING_MERCHANT_TOO_LONG_MESSAGE,
  RECURRING_ITEM_NAME_TOO_LONG_MESSAGE,
  RECURRING_PAYMENT_METHOD_MESSAGE,
  RECURRING_SKIP_HISTORY_LIMIT,
  RECURRING_TEMPLATE_LIMIT,
  type RecurringExpenseTemplate,
  type RecurringTemplateDraft
} from "./recurring-template";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const CHILD = "child-1";
const CATEGORY = "c0a7e901-0000-4c01-8c01-c47e900ec001";

function draft(overrides: Partial<RecurringTemplateDraft> = {}): RecurringTemplateDraft {
  return {
    childId: CHILD,
    itemName: "기저귀",
    amountKrw: 38_500,
    categoryId: CATEGORY,
    paymentMethod: "card",
    dayOfMonth: 5,
    ...overrides
  };
}

function template(overrides: Partial<RecurringExpenseTemplate> = {}): RecurringExpenseTemplate {
  const built = buildRecurringTemplate(draft(), { id: "local-recurring-1", createdAt: "2026-01-01T00:00:00.000Z" });
  if (!built) throw new Error("fixture draft must be valid");
  return { ...built, ...overrides };
}

describe("라운드 55 #4 월말 클램프 (수용 기준 10)", () => {
  it("그 달에 있는 날짜는 그대로 둔다", () => {
    expect(recurringDueDateForMonth("2026-08", 5)).toBe("2026-08-05");
    expect(recurringDueDateForMonth("2026-08", 31)).toBe("2026-08-31");
    expect(recurringDueDateForMonth("2026-01", 1)).toBe("2026-01-01");
  });

  it("31일 템플릿이 2·4·6·9·11월에는 그 달의 마지막 날로 내려온다 (윤년 포함)", () => {
    expect(recurringDueDateForMonth("2026-02", 31)).toBe("2026-02-28");
    // 2028은 윤년이다 -- 29일이 있어야 한다.
    expect(recurringDueDateForMonth("2028-02", 31)).toBe("2028-02-29");
    expect(recurringDueDateForMonth("2026-04", 31)).toBe("2026-04-30");
    expect(recurringDueDateForMonth("2026-06", 31)).toBe("2026-06-30");
    expect(recurringDueDateForMonth("2026-09", 31)).toBe("2026-09-30");
    expect(recurringDueDateForMonth("2026-11", 31)).toBe("2026-11-30");
  });

  it("100·400년 규칙까지 플랫폼 달력에 맡긴다 (손으로 적은 윤년 판정이 없다)", () => {
    expect(recurringDueDateForMonth("2000-02", 30)).toBe("2000-02-29");
    expect(recurringDueDateForMonth("2100-02", 30)).toBe("2100-02-28");
  });

  it("30일 템플릿은 2월에만 클램프되고 다른 달은 그대로다", () => {
    expect(recurringDueDateForMonth("2026-02", 30)).toBe("2026-02-28");
    expect(recurringDueDateForMonth("2026-03", 30)).toBe("2026-03-30");
  });

  it("형식이 아닌 달·범위 밖의 날짜는 날짜를 지어내지 않고 null이다", () => {
    expect(recurringDueDateForMonth("2026-13", 5)).toBeNull();
    expect(recurringDueDateForMonth("2026-00", 5)).toBeNull();
    expect(recurringDueDateForMonth("202608", 5)).toBeNull();
    expect(recurringDueDateForMonth("2026-08-05", 5)).toBeNull();
    expect(recurringDueDateForMonth("2026-08", 0)).toBeNull();
    expect(recurringDueDateForMonth("2026-08", 32)).toBeNull();
    expect(recurringDueDateForMonth("2026-08", 5.5)).toBeNull();
  });

  it("isRecurringYearMonth / recurringYearMonthOf", () => {
    expect(isRecurringYearMonth("2026-08")).toBe(true);
    expect(isRecurringYearMonth("2026-8")).toBe(false);
    expect(isRecurringYearMonth(202608)).toBe(false);
    expect(recurringYearMonthOf("2026-08-05")).toBe("2026-08");
    expect(recurringYearMonthOf("2026-13-05")).toBeNull();
    expect(recurringYearMonthOf(null)).toBeNull();
    expect(recurringYearMonthOf(undefined)).toBeNull();
  });
});

describe("라운드 55 #4 입력 검증 (금액 상한은 amount-limit 단일 소스)", () => {
  it("정상 입력은 통과한다", () => {
    expect(recurringTemplateValidationError(draft())).toBeNull();
  });

  it("아이·품목명·금액·분류·결제 수단·결제일이 각각 자기 문장으로 막힌다", () => {
    expect(recurringTemplateValidationError(draft({ childId: "  " }))).toBe(RECURRING_CHILD_REQUIRED_MESSAGE);
    expect(recurringTemplateValidationError(draft({ itemName: "   " }))).toBe(RECURRING_ITEM_NAME_REQUIRED_MESSAGE);
    expect(recurringTemplateValidationError(draft({ itemName: "가".repeat(RECURRING_ITEM_NAME_MAX_LENGTH + 1) }))).toBe(
      RECURRING_ITEM_NAME_TOO_LONG_MESSAGE
    );
    expect(recurringTemplateValidationError(draft({ amountKrw: 0 }))).toBe(RECURRING_AMOUNT_REQUIRED_MESSAGE);
    expect(recurringTemplateValidationError(draft({ amountKrw: -1 }))).toBe(RECURRING_AMOUNT_REQUIRED_MESSAGE);
    expect(recurringTemplateValidationError(draft({ amountKrw: 1.5 }))).toBe(RECURRING_AMOUNT_REQUIRED_MESSAGE);
    expect(recurringTemplateValidationError(draft({ amountKrw: Number.NaN }))).toBe(RECURRING_AMOUNT_REQUIRED_MESSAGE);
    expect(recurringTemplateValidationError(draft({ categoryId: "" }))).toBe(RECURRING_CATEGORY_REQUIRED_MESSAGE);
    expect(
      recurringTemplateValidationError(draft({ paymentMethod: "unknown" as never }))
    ).toBe(RECURRING_PAYMENT_METHOD_MESSAGE);
    expect(recurringTemplateValidationError(draft({ dayOfMonth: 0 }))).toBe(RECURRING_DAY_OF_MONTH_MESSAGE);
    expect(recurringTemplateValidationError(draft({ dayOfMonth: 32 }))).toBe(RECURRING_DAY_OF_MONTH_MESSAGE);
  });

  it("길이 상한은 서버 쓰기 계약(@MaxLength(100))과 같다 — 100자는 통과, 101자는 막힌다", () => {
    // 근거는 DB varchar가 아니라 CreateExpenseDto다. 101자를 통과시키면 로컬 저장 성공 뒤
    // flush에서 400을 받아 영구 실패 행이 된다(recurring-flow.test.ts의 드리프트 가드 참고).
    expect(RECURRING_ITEM_NAME_MAX_LENGTH).toBe(100);
    expect(recurringTemplateValidationError(draft({ itemName: "가".repeat(100) }))).toBeNull();
    expect(recurringTemplateValidationError(draft({ itemName: "가".repeat(101) }))).toBe(
      RECURRING_ITEM_NAME_TOO_LONG_MESSAGE
    );
    expect(RECURRING_ITEM_NAME_TOO_LONG_MESSAGE).toContain("100자");
  });

  /**
   * 라운드 57 QA(P2-11) — 판매처는 **자르지 않고 막는다**(품목명과 같은 방식).
   *
   * 예전에는 `buildRecurringTemplate`이 조용히 `slice(0, 100)`했다. text-limits.ts 머리말이 못
   * 박은 계약("조용히 잘라 버리지 않는다")과 정면으로 어긋나고, 한 폼 안에서 품목명은 막고
   * 판매처는 자르는 두 규율이 공존했다 — 사용자는 자기가 적은 판매처가 왜 짧아졌는지 알 수 없다.
   */
  it("판매처가 상한을 넘으면 조용히 자르지 않고 저장을 막는다", () => {
    expect(RECURRING_MERCHANT_MAX_LENGTH).toBe(100);
    const tooLong = "쿠".repeat(RECURRING_MERCHANT_MAX_LENGTH + 1);
    expect(recurringTemplateValidationError(draft({ merchant: tooLong }))).toBe(RECURRING_MERCHANT_TOO_LONG_MESSAGE);
    // 검증에서 막히므로 템플릿 자체가 만들어지지 않는다(잘린 값이 저장되지 않는다).
    expect(
      buildRecurringTemplate(draft({ merchant: tooLong }), {
        id: "local-recurring-merchant",
        createdAt: "2026-08-01T00:00:00.000Z"
      })
    ).toBeNull();
    // 경계값(정확히 상한)은 통과하고 **원문 그대로** 담긴다.
    const exact = "쿠".repeat(RECURRING_MERCHANT_MAX_LENGTH);
    expect(recurringTemplateValidationError(draft({ merchant: exact }))).toBeNull();
    const built = buildRecurringTemplate(draft({ merchant: exact }), {
      id: "local-recurring-merchant",
      createdAt: "2026-08-01T00:00:00.000Z"
    });
    expect(built!.merchant).toBe(exact);
    // 문구는 지출 입력 칸과 같은 문장이다(같은 한도를 두 가지로 말하지 않는다).
    expect(RECURRING_MERCHANT_TOO_LONG_MESSAGE).toBe(merchantOverLimitMessage(RECURRING_MERCHANT_MAX_LENGTH));
    expect(RECURRING_MERCHANT_TOO_LONG_MESSAGE).toContain("100자");
    // 선택 입력이라 비어 있는 것은 여전히 통과다.
    expect(recurringTemplateValidationError(draft({ merchant: undefined }))).toBeNull();
    expect(recurringTemplateValidationError(draft({ merchant: "   " }))).toBeNull();
  });

  it("잘라 담는 코드가 남아 있지 않다 (text-limits 계약: 조용한 절단 금지)", () => {
    expect(source("src/expenses/recurring-template.ts")).not.toContain("slice(0, RECURRING_MERCHANT_MAX_LENGTH)");
  });

  it("금액 상한은 지출 입력 칸과 같은 숫자·같은 문장이다 (서버 int4 한계)", () => {
    expect(recurringTemplateValidationError(draft({ amountKrw: EXPENSE_AMOUNT_MAX_KRW }))).toBeNull();
    expect(recurringTemplateValidationError(draft({ amountKrw: EXPENSE_AMOUNT_MAX_KRW + 1 }))).toBe(
      RECURRING_AMOUNT_OVER_LIMIT_MESSAGE
    );
    expect(RECURRING_AMOUNT_OVER_LIMIT_MESSAGE).toContain("2,147,483,647원");
  });

  it("buildRecurringTemplate은 trim하고, 빈 판매처는 키 자체를 만들지 않는다", () => {
    const built = buildRecurringTemplate(draft({ itemName: "  기저귀 ", merchant: "   " }), {
      id: "local-recurring-9",
      createdAt: "2026-08-01T00:00:00.000Z"
    });
    expect(built).not.toBeNull();
    expect(built!.itemName).toBe("기저귀");
    expect(built).not.toHaveProperty("merchant");
    expect(built!.active).toBe(true);
    expect(built!.skippedYearMonths).toEqual([]);
  });

  it("검증에 걸리는 입력으로는 템플릿이 만들어지지 않는다", () => {
    expect(buildRecurringTemplate(draft({ amountKrw: 0 }), { id: "x", createdAt: "2026-08-01T00:00:00.000Z" })).toBeNull();
  });
});

describe("라운드 55 #4 저장 blob 방어 (sanitize)", () => {
  it("배열이 아니거나 비어 있으면 빈 목록이다", () => {
    expect(sanitizeRecurringTemplates(undefined)).toEqual([]);
    expect(sanitizeRecurringTemplates(null)).toEqual([]);
    expect(sanitizeRecurringTemplates({ templates: "기저귀" })).toEqual([]);
    expect(sanitizeRecurringTemplates({})).toEqual([]);
  });

  it("저장할 수 없었을 값은 읽을 때도 살아나지 않는다 (0원 유령 항목 금지)", () => {
    const persisted = {
      templates: [
        { ...template(), id: "keep", amountKrw: 38_500 },
        { ...template(), id: "zero", amountKrw: 0 },
        { ...template(), id: "no-name", itemName: "  " },
        { ...template(), id: "bad-day", dayOfMonth: 99 },
        { ...template(), id: "bad-method", paymentMethod: "bitcoin" },
        { id: "no-createdAt", childId: CHILD, itemName: "물티슈", amountKrw: 1, categoryId: CATEGORY, paymentMethod: "card", dayOfMonth: 1 },
        "문자열",
        null
      ]
    };
    expect(sanitizeRecurringTemplates(persisted).map((row) => row.id)).toEqual(["keep"]);
  });

  it("같은 id가 두 번 들어오면 첫 번째만 남는다", () => {
    const persisted = { templates: [template({ itemName: "기저귀" }), template({ itemName: "물티슈" })] };
    const restored = sanitizeRecurringTemplates(persisted);
    expect(restored).toHaveLength(1);
    expect(restored[0].itemName).toBe("기저귀");
  });

  it("상한을 넘긴 blob은 상한까지만 살린다", () => {
    const templates = Array.from({ length: RECURRING_TEMPLATE_LIMIT + 5 }, (_, index) =>
      template({ id: `local-recurring-${index}` })
    );
    expect(sanitizeRecurringTemplates({ templates })).toHaveLength(RECURRING_TEMPLATE_LIMIT);
  });

  it("skip 이력은 형식이 맞는 달만, 중복 없이, 최근 12개만 남는다", () => {
    const months = Array.from({ length: 20 }, (_, index) => `20${25 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
    const restored = sanitizeRecurringTemplates({
      templates: [template({ skippedYearMonths: [...months, "2026-13", "쓰레기", "2026-01"] as string[] })]
    });
    expect(restored[0].skippedYearMonths).toHaveLength(RECURRING_SKIP_HISTORY_LIMIT);
    expect(restored[0].skippedYearMonths.every((month) => isRecurringYearMonth(month))).toBe(true);
  });

  it("active가 없는 옛 blob은 켜진 것으로 되살아난다", () => {
    const { active: _dropped, ...withoutActive } = template();
    const restored = sanitizeRecurringTemplates({ templates: [withoutActive] });
    expect(restored[0].active).toBe(true);
  });
});

describe("라운드 55 #4 이번 달 넘기기 (수용 기준 6)", () => {
  it("넘긴 달이 이력에 남고, 같은 달을 또 넘기면 같은 객체를 돌려준다", () => {
    const base = template();
    const skipped = applyRecurringSkip(base, "2026-08");
    expect(skipped.skippedYearMonths).toEqual(["2026-08"]);
    expect(applyRecurringSkip(skipped, "2026-08")).toBe(skipped);
  });

  it("형식이 아닌 달은 이력을 더럽히지 않는다", () => {
    const base = template();
    expect(applyRecurringSkip(base, "2026-13")).toBe(base);
  });

  it("이력은 12개를 넘지 않는다", () => {
    let current = template();
    for (let index = 0; index < 15; index += 1) {
      const month = `${2025 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
      current = applyRecurringSkip(current, month);
    }
    expect(current.skippedYearMonths).toHaveLength(RECURRING_SKIP_HISTORY_LIMIT);
  });
});

describe("라운드 55 #4 리마인더 판정", () => {
  const base = {
    templates: [template()],
    childId: CHILD,
    yearMonth: "2026-08",
    todayIso: "2026-08-10"
  } as const;

  it("이번 달 캐시가 아직 없으면 카드를 세우지 않는다 (수용 기준 3 — 틀린 N 금지)", () => {
    expect(buildRecurringReminder({ ...base })).toBeNull();
    expect(buildRecurringReminder({ ...base, monthExpenses: undefined })).toBeNull();
    // 빈 배열은 "0건"이라는 사실이므로 판정한다 -- undefined와 뭉개지 않는다.
    expect(buildRecurringReminder({ ...base, monthExpenses: [] })).not.toBeNull();
  });

  it("아이가 없거나 달 형식이 아니면 판정하지 않는다", () => {
    expect(buildRecurringReminder({ ...base, childId: null, monthExpenses: [] })).toBeNull();
    expect(buildRecurringReminder({ ...base, childId: "   ", monthExpenses: [] })).toBeNull();
    expect(buildRecurringReminder({ ...base, yearMonth: "2026-13", monthExpenses: [] })).toBeNull();
  });

  it("다른 아이의 템플릿과 꺼 둔 템플릿은 세지 않는다", () => {
    expect(
      buildRecurringReminder({ ...base, templates: [template({ childId: "child-2" })], monthExpenses: [] })
    ).toBeNull();
    expect(
      buildRecurringReminder({ ...base, templates: [template({ active: false })], monthExpenses: [] })
    ).toBeNull();
  });

  it("아직 오지 않은 예정일은 조르지 않는다 (당일부터 센다)", () => {
    expect(buildRecurringReminder({ ...base, todayIso: "2026-08-04", monthExpenses: [] })).toBeNull();
    expect(buildRecurringReminder({ ...base, todayIso: "2026-08-05", monthExpenses: [] })).not.toBeNull();
  });

  it("31일 템플릿은 2월에도 그 달 말일부터 뜬다 (클램프가 판정으로 이어진다)", () => {
    const monthly31 = [template({ dayOfMonth: 31 })];
    const february = { templates: monthly31, childId: CHILD, yearMonth: "2026-02", monthExpenses: [] };
    expect(buildRecurringReminder({ ...february, todayIso: "2026-02-27" })).toBeNull();
    const due = buildRecurringReminder({ ...february, todayIso: "2026-02-28" });
    expect(due?.rows[0].dueDate).toBe("2026-02-28");
  });

  it("이번 달을 넘겼으면 목록에서 빠지고, 다음 달에는 다시 나타난다 (수용 기준 6)", () => {
    const skipped = [applyRecurringSkip(template(), "2026-08")];
    expect(buildRecurringReminder({ ...base, templates: skipped, monthExpenses: [] })).toBeNull();
    expect(
      buildRecurringReminder({ templates: skipped, childId: CHILD, yearMonth: "2026-09", todayIso: "2026-09-06", monthExpenses: [] })
    ).not.toBeNull();
  });

  it("이름이 같은 이번 달 지출이 있으면 기록된 것으로 본다 (띄어쓰기·대소문자 무시)", () => {
    expect(
      buildRecurringReminder({
        ...base,
        templates: [template({ itemName: "물티슈" })],
        monthExpenses: [{ itemName: " 물 티슈 " }]
      })
    ).toBeNull();
    expect(
      buildRecurringReminder({
        ...base,
        templates: [template({ itemName: "Pampers" })],
        monthExpenses: [{ itemName: "pampers" }]
      })
    ).toBeNull();
  });

  it("이름이 다르면(‘기저귀 대형’) 미기록으로 남는다 — 그래서 수동 넘기기가 필요하다", () => {
    const reminder = buildRecurringReminder({ ...base, monthExpenses: [{ itemName: "기저귀 대형" }] });
    expect(reminder?.rows).toHaveLength(1);
  });

  it("선물·환불 행은 기록으로 세지 않는다 (DNC-015 — 월 합계에 들어가지 않는 행)", () => {
    expect(
      buildRecurringReminder({ ...base, monthExpenses: [{ itemName: "기저귀", expenseType: "gift" }] })?.rows
    ).toHaveLength(1);
    expect(
      buildRecurringReminder({ ...base, monthExpenses: [{ itemName: "기저귀", expenseType: "refund" }] })?.rows
    ).toHaveLength(1);
    // expenseType이 없는 레거시 행은 일반 지출로 본다(recent-items.ts와 같은 규칙).
    expect(buildRecurringReminder({ ...base, monthExpenses: [{ itemName: "기저귀" }] })).toBeNull();
  });

  it("오프라인 대기 행도 기록됨으로 센다 (수용 기준 4 — 정직성 규칙 2)", () => {
    const pendingRows = [
      {
        childId: CHILD,
        pendingDelete: false,
        payload: { itemName: "기저귀", spentOn: "2026-08-09", expenseType: "expense" }
      }
    ];
    expect(buildRecurringReminder({ ...base, monthExpenses: [], pendingRows })).toBeNull();
  });

  it("대기 행 중 다른 아이·지난달·삭제 대기·선물 행은 세지 않는다", () => {
    const rows = [
      { childId: "child-2", payload: { itemName: "기저귀", spentOn: "2026-08-09" } },
      { childId: CHILD, payload: { itemName: "기저귀", spentOn: "2026-07-09" } },
      { childId: CHILD, pendingDelete: true, payload: { itemName: "기저귀", spentOn: "2026-08-09" } },
      { childId: CHILD, payload: { itemName: "기저귀", spentOn: "2026-08-09", expenseType: "gift" } },
      { childId: CHILD, payload: null }
    ];
    expect(buildRecurringReminder({ ...base, monthExpenses: [], pendingRows: rows })?.rows).toHaveLength(1);
  });

  it("남은 것이 0건이면 카드를 세우지 않는다 (0을 0이라고 말하지 않는다)", () => {
    expect(buildRecurringReminder({ ...base, templates: [], monthExpenses: [] })).toBeNull();
  });

  it("여러 건은 예정일이 이른 것부터 줄 세운다", () => {
    const reminder = buildRecurringReminder({
      ...base,
      templates: [
        template({ id: "b", itemName: "분유", dayOfMonth: 9 }),
        template({ id: "a", itemName: "기저귀", dayOfMonth: 3 })
      ],
      todayIso: "2026-08-20",
      monthExpenses: []
    });
    expect(reminder?.rows.map((row) => row.template.itemName)).toEqual(["기저귀", "분유"]);
    expect(reminder?.title).toBe("이번 달 정기 지출 2건이 아직 기록에 없어요");
    expect(reminder?.yearMonth).toBe("2026-08");
  });
});

describe("라운드 55 #4 문구 (DNC-018 해요체 · 자동 기록 문구 금지)", () => {
  it("제목은 관측('기록에 없어요')이지 단언('기록하지 않았어요')이 아니다", () => {
    expect(recurringReminderTitle(1)).toBe("이번 달 정기 지출 1건이 아직 기록에 없어요");
    expect(recurringReminderTitle(3)).not.toContain("기록하지 않");
  });

  it("어떤 문구도 자동으로 기록했다고 말하지 않는다", () => {
    const rows = recurringReminderCopy([{ template: template(), dueDate: "2026-08-05" }]);
    const everyString = [rows.title, ...rows.rows.flatMap((row) => [row.label, row.recordAccessibilityLabel, row.skipAccessibilityLabel])];
    for (const text of everyString) {
      expect(text).not.toMatch(/자동으로 기록|자동 기록|대신 기록/);
    }
  });

  it("행 문구는 '품목 · 금액 · 매월 n일'이고 금액 표기는 formatKrw 하나뿐이다 (₩ 금지)", () => {
    expect(formatRecurringTemplateLine(template())).toBe("기저귀 · 38,500원 · 매월 5일");
    expect(formatRecurringTemplateLine(template())).not.toContain("₩");
  });

  it("접근성 라벨은 가운뎃점 없이 한 문장으로 읽힌다", () => {
    expect(recurringRecordAccessibilityLabel(template())).toBe("정기 지출 기저귀 38,500원 기록하기");
    expect(recurringSkipAccessibilityLabel(template())).toBe("정기 지출 기저귀 이미 기록했어요");
  });
});

describe("라운드 55 #4 원탭 프리필 (수용 기준 5)", () => {
  it("템플릿이 실어 보내는 값이 빠른 기록 시트의 파싱과 왕복한다", () => {
    const params = recurringPrefillParams(template({ merchant: "쿠팡" }));
    expect(params).toEqual({
      itemName: "기저귀",
      amountKrw: "38500",
      categoryId: CATEGORY,
      paymentMethod: "card",
      merchant: "쿠팡",
      from: RECURRING_ENTRY_SOURCE
    });

    const parsed = parseExpensePrefillParams(params!);
    expect(parsed).toEqual({
      itemName: "기저귀",
      amountText: "38500",
      categoryId: CATEGORY,
      paymentMethod: "card"
    });
  });

  it("날짜는 넘기지 않는다 — 새 기록은 오늘이다", () => {
    const params = recurringPrefillParams(template());
    expect(params).not.toHaveProperty("spentOn");
    expect(params).not.toHaveProperty("date");
  });

  it("판매처가 없으면 키 자체를 싣지 않는다", () => {
    expect(recurringPrefillParams(template())).not.toHaveProperty("merchant");
  });

  it("손상된 템플릿으로는 프리필을 만들지 않는다 (저장 가드에 걸리는 링크를 만들지 않는다)", () => {
    expect(recurringPrefillParams(template({ itemName: "  " }))).toBeNull();
    expect(recurringPrefillParams(template({ amountKrw: 0 }))).toBeNull();
    expect(recurringPrefillParams(template({ amountKrw: EXPENSE_AMOUNT_MAX_KRW + 1 }))).toBeNull();
    expect(recurringPrefillParams(template({ categoryId: "" }))).toBeNull();
    expect(recurringPrefillParams(template({ paymentMethod: "unknown" as never }))).toBeNull();
  });

  it("from 값은 post-save-destination이 모르는 값이라 저장 후 목적지가 종전 그대로다", async () => {
    const { resolvePostSaveDestination, POST_SAVE_DEFAULT_DESTINATION } = await import("./post-save-destination");
    expect(resolvePostSaveDestination({ from: RECURRING_ENTRY_SOURCE })).toBe(POST_SAVE_DEFAULT_DESTINATION);
  });
});
