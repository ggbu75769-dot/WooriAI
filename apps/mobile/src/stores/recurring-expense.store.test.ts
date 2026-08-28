import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  RECURRING_LIMIT_MESSAGE,
  RECURRING_TEMPLATE_LIMIT,
  RECURRING_AMOUNT_REQUIRED_MESSAGE,
  type RecurringTemplateDraft
} from "../expenses/recurring-template";
import { RECURRING_TEMPLATE_MISSING_MESSAGE, useRecurringExpenseStore } from "./recurring-expense.store";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

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

describe("라운드 55 #4 useRecurringExpenseStore CRUD (수용 기준 2)", () => {
  beforeEach(() => {
    useRecurringExpenseStore.getState().resetAll();
  });

  it("추가하면 로컬 id 관례(local-recurring-...)가 붙는다", () => {
    const result = useRecurringExpenseStore.getState().addTemplate(draft());

    expect(result.ok).toBe(true);
    const templates = useRecurringExpenseStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0].id).toMatch(/^local-recurring-/);
    expect(templates[0].itemName).toBe("기저귀");
    expect(templates[0].active).toBe(true);
  });

  it("같은 밀리초에 두 건을 추가해도 id가 갈린다", () => {
    const { addTemplate } = useRecurringExpenseStore.getState();
    addTemplate(draft({ itemName: "기저귀" }));
    addTemplate(draft({ itemName: "분유" }));

    const [first, second] = useRecurringExpenseStore.getState().templates;
    expect(first.id).not.toBe(second.id);
  });

  it("검증에 걸리는 입력은 저장하지 않고 이유를 그대로 돌려준다", () => {
    const result = useRecurringExpenseStore.getState().addTemplate(draft({ amountKrw: 0 }));

    expect(result).toEqual({ ok: false, message: RECURRING_AMOUNT_REQUIRED_MESSAGE });
    expect(useRecurringExpenseStore.getState().templates).toEqual([]);
  });

  it("상한 20건을 넘기면 저장 대신 안내한다 (조용히 버리지 않는다)", () => {
    const { addTemplate } = useRecurringExpenseStore.getState();
    for (let index = 0; index < RECURRING_TEMPLATE_LIMIT; index += 1) {
      expect(addTemplate(draft({ itemName: `품목 ${index}` })).ok).toBe(true);
    }

    const overflow = addTemplate(draft({ itemName: "하나 더" }));
    expect(overflow).toEqual({ ok: false, message: RECURRING_LIMIT_MESSAGE });
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(RECURRING_TEMPLATE_LIMIT);
  });

  it("수정은 내용만 바꾸고 id·만든 시각·on/off·넘긴 달 이력은 유지한다", () => {
    const added = useRecurringExpenseStore.getState().addTemplate(draft());
    expect(added.ok).toBe(true);
    const id = useRecurringExpenseStore.getState().templates[0].id;
    const createdAt = useRecurringExpenseStore.getState().templates[0].createdAt;
    useRecurringExpenseStore.getState().skipThisMonth(id, "2026-08");
    useRecurringExpenseStore.getState().setTemplateActive(id, false);

    const updated = useRecurringExpenseStore.getState().updateTemplate(id, draft({ amountKrw: 41_000 }));

    expect(updated.ok).toBe(true);
    const template = useRecurringExpenseStore.getState().templates[0];
    expect(template.id).toBe(id);
    expect(template.createdAt).toBe(createdAt);
    expect(template.amountKrw).toBe(41_000);
    expect(template.active).toBe(false);
    expect(template.skippedYearMonths).toEqual(["2026-08"]);
  });

  it("없는 항목을 수정하면 사실대로 말한다", () => {
    expect(useRecurringExpenseStore.getState().updateTemplate("없는-id", draft())).toEqual({
      ok: false,
      message: RECURRING_TEMPLATE_MISSING_MESSAGE
    });
  });

  it("삭제·활성 토글이 동작하고, 값이 바뀌지 않으면 같은 배열을 유지한다", () => {
    useRecurringExpenseStore.getState().addTemplate(draft());
    const id = useRecurringExpenseStore.getState().templates[0].id;
    const before = useRecurringExpenseStore.getState().templates;

    useRecurringExpenseStore.getState().setTemplateActive(id, true); // 이미 true
    expect(useRecurringExpenseStore.getState().templates).toBe(before);

    useRecurringExpenseStore.getState().setTemplateActive(id, false);
    expect(useRecurringExpenseStore.getState().templates[0].active).toBe(false);

    useRecurringExpenseStore.getState().removeTemplate("없는-id");
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(1);

    useRecurringExpenseStore.getState().removeTemplate(id);
    expect(useRecurringExpenseStore.getState().templates).toEqual([]);
  });

  it("'이미 기록했어요'는 지출을 만들지 않고 그 달만 이력에 적는다", () => {
    useRecurringExpenseStore.getState().addTemplate(draft());
    const id = useRecurringExpenseStore.getState().templates[0].id;

    useRecurringExpenseStore.getState().skipThisMonth(id, "2026-08");
    expect(useRecurringExpenseStore.getState().templates[0].skippedYearMonths).toEqual(["2026-08"]);

    const after = useRecurringExpenseStore.getState().templates;
    useRecurringExpenseStore.getState().skipThisMonth(id, "2026-08");
    expect(useRecurringExpenseStore.getState().templates).toBe(after);
    useRecurringExpenseStore.getState().skipThisMonth("없는-id", "2026-08");
    expect(useRecurringExpenseStore.getState().templates).toBe(after);
  });

  it("resetAll이 전부 지운다 (PRIV-104 합류 지점 — 배선은 트랙 C)", () => {
    useRecurringExpenseStore.getState().addTemplate(draft());
    useRecurringExpenseStore.getState().resetAll();
    expect(useRecurringExpenseStore.getState().templates).toEqual([]);
  });
});

describe("라운드 55 #4 persist 관례 (저장소의 다른 스토어와 같다)", () => {
  it("저장 키·storage·version이 소스에 그대로 있다", () => {
    const storeSource = source("src/stores/recurring-expense.store.ts");
    expect(storeSource).toContain('name: "wooriai-recurring-expenses"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("version: 1");
    expect(storeSource).toContain("migrate: (persisted) => sanitizedState(persisted)");
    expect(storeSource).toContain("merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })");
  });

  it("persist 미들웨어가 실제로 붙어 있다 (앱을 다시 켜도 템플릿이 남는다)", () => {
    expect(useRecurringExpenseStore.persist).toBeDefined();
    expect(useRecurringExpenseStore.persist.getOptions().name).toBe("wooriai-recurring-expenses");
    expect(useRecurringExpenseStore.persist.getOptions().version).toBe(1);
  });

  it("재수화(merge)가 손상된 blob을 걸러 낸다", () => {
    const merge = useRecurringExpenseStore.persist.getOptions().merge!;
    const current = useRecurringExpenseStore.getState();

    expect(merge(undefined, current)).toMatchObject({ templates: [] });
    expect(merge({ templates: "기저귀" }, current)).toMatchObject({ templates: [] });
    expect(
      merge(
        {
          templates: [
            {
              id: "local-recurring-1",
              childId: CHILD,
              itemName: "기저귀",
              amountKrw: 38_500,
              categoryId: CATEGORY,
              paymentMethod: "card",
              dayOfMonth: 5,
              active: true,
              createdAt: "2026-08-01T00:00:00.000Z",
              skippedYearMonths: ["2026-08"]
            },
            { id: "local-recurring-2", amountKrw: 0 }
          ]
        },
        current
      )
    ).toMatchObject({ templates: [{ id: "local-recurring-1", itemName: "기저귀" }] });
  });

  it("재수화 왕복: 저장된 값이 그대로 살아 돌아온다", () => {
    useRecurringExpenseStore.getState().resetAll();
    useRecurringExpenseStore.getState().addTemplate(draft({ merchant: "쿠팡" }));
    const saved = useRecurringExpenseStore.getState().templates;

    const merge = useRecurringExpenseStore.persist.getOptions().merge!;
    const restored = merge({ templates: saved }, useRecurringExpenseStore.getState()) as {
      templates: typeof saved;
    };
    expect(restored.templates).toEqual(saved);
  });
});
