import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
// 라운드 66 트랙 B(P3 1번): 정기 지출 **문구**는 전부 이 순수 모듈에서 온다(스토어에는
// 판정·상태만 남는다) — 그래서 문구 세 개의 수입처가 여기로 옮겨 왔다.
import {
  recurringDuplicateMessage,
  RECURRING_ALREADY_REGISTERED_LABEL,
  RECURRING_LIMIT_MESSAGE,
  RECURRING_TEMPLATE_LIMIT,
  RECURRING_TEMPLATE_MISSING_MESSAGE,
  RECURRING_AMOUNT_REQUIRED_MESSAGE,
  type RecurringTemplateDraft
} from "../expenses/recurring-template";
import {
  clearRecurringTemplatesForChild,
  findRecurringTemplateByItemName,
  useRecurringExpenseStore
} from "./recurring-expense.store";

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

  it("수정은 이름을 그대로 둬도 통과한다 (중복 판정이 자기 자신에 걸리지 않는다)", () => {
    useRecurringExpenseStore.getState().addTemplate(draft());
    const id = useRecurringExpenseStore.getState().templates[0].id;

    expect(useRecurringExpenseStore.getState().updateTemplate(id, draft({ amountKrw: 41_000 })).ok).toBe(true);
    expect(useRecurringExpenseStore.getState().templates[0].amountKrw).toBe(41_000);
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

/**
 * 라운드 59 #4 — 상한 20은 **아이 한 명당**이다.
 *
 * 종전에는 판정이 전역(`templates.length`)인데 화면 표기는 아이별(`childTemplates.length`)이라,
 * 첫째로 20개를 채운 사람은 둘째 화면에서 "저장한 정기 지출 0개 · 최대 20개"를 보면서도 한 건도
 * 저장할 수 없었다 — 화면이 앱의 규칙과 다른 말을 하는, 다자녀의 막다른 길이었다.
 */
describe("라운드 59 #4 정기 지출 상한은 아이별이다", () => {
  beforeEach(() => {
    useRecurringExpenseStore.getState().resetAll();
  });

  const OTHER_CHILD = "child-2";

  function fillChild(childId: string, count: number) {
    const { addTemplate } = useRecurringExpenseStore.getState();
    for (let index = 0; index < count; index += 1) {
      expect(addTemplate(draft({ childId, itemName: `품목 ${index}` })).ok, `${childId} ${index}`).toBe(true);
    }
  }

  it("한 아이가 상한을 채워도 다른 아이는 그대로 저장할 수 있다 (경계: 20 → 21번째)", () => {
    fillChild(CHILD, RECURRING_TEMPLATE_LIMIT);

    // 그 아이의 21번째는 종전과 똑같이 막힌다(상한 자체는 그대로다).
    expect(useRecurringExpenseStore.getState().addTemplate(draft({ itemName: "하나 더" }))).toEqual({
      ok: false,
      message: RECURRING_LIMIT_MESSAGE
    });
    // 둘째의 첫 건은 막히지 않는다 — 여기가 종전의 막다른 길이었다.
    expect(useRecurringExpenseStore.getState().addTemplate(draft({ childId: OTHER_CHILD, itemName: "기저귀" })).ok).toBe(
      true
    );
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(RECURRING_TEMPLATE_LIMIT + 1);
  });

  it("둘째도 자기 상한에서 막힌다 (아이별로 같은 20이다)", () => {
    fillChild(OTHER_CHILD, RECURRING_TEMPLATE_LIMIT);

    expect(useRecurringExpenseStore.getState().addTemplate(draft({ childId: OTHER_CHILD, itemName: "하나 더" }))).toEqual(
      { ok: false, message: RECURRING_LIMIT_MESSAGE }
    );
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(RECURRING_TEMPLATE_LIMIT);
  });

  /**
   * 라운드 59 통합리뷰 P2-11 — **수정으로 아이를 옮기는 길**에도 같은 상한이 선다.
   *
   * 상한 판정이 addTemplate에만 있어서, 첫째의 템플릿 하나를 이미 20개가 찬 둘째로 옮기면 둘째가
   * 21개가 됐다. 저장은 성공하고, 앱을 다시 켜면 아이별 절단이 그중 하나를 조용히 버린다 —
   * 사용자가 손쓸 수 없는 소실이라 저장 시점에 막는다(조용히 버리지 않는 이 저장소의 규율).
   */
  it("이미 상한이 찬 아이로 옮기는 수정은 저장 대신 안내한다", () => {
    fillChild(OTHER_CHILD, RECURRING_TEMPLATE_LIMIT);
    expect(useRecurringExpenseStore.getState().addTemplate(draft({ childId: CHILD, itemName: "유일한 항목" })).ok).toBe(
      true
    );
    const moving = useRecurringExpenseStore
      .getState()
      .templates.find((template) => template.childId === CHILD)!;

    const result = useRecurringExpenseStore
      .getState()
      .updateTemplate(moving.id, draft({ childId: OTHER_CHILD, itemName: "유일한 항목" }));

    expect(result).toEqual({ ok: false, message: RECURRING_LIMIT_MESSAGE });
    // 아무것도 옮겨 가지 않았다 — 두 아이의 개수가 그대로다.
    const templates = useRecurringExpenseStore.getState().templates;
    expect(templates.filter((template) => template.childId === OTHER_CHILD)).toHaveLength(RECURRING_TEMPLATE_LIMIT);
    expect(templates.filter((template) => template.childId === CHILD)).toHaveLength(1);
  });

  it("자리가 남은 아이로 옮기는 수정과 같은 아이 안의 수정은 종전 그대로다", () => {
    fillChild(OTHER_CHILD, RECURRING_TEMPLATE_LIMIT - 1);
    expect(useRecurringExpenseStore.getState().addTemplate(draft({ childId: CHILD, itemName: "유일한 항목" })).ok).toBe(
      true
    );
    const moving = useRecurringExpenseStore
      .getState()
      .templates.find((template) => template.childId === CHILD)!;

    // 한 자리가 남아 있으므로 옮겨 간다.
    expect(
      useRecurringExpenseStore.getState().updateTemplate(moving.id, draft({ childId: OTHER_CHILD, itemName: "유일한 항목" }))
        .ok
    ).toBe(true);
    expect(
      useRecurringExpenseStore.getState().templates.filter((template) => template.childId === OTHER_CHILD)
    ).toHaveLength(RECURRING_TEMPLATE_LIMIT);

    // 그리고 그 아이가 꽉 찬 지금도, **같은 아이 안의** 평범한 수정(금액)은 막히지 않는다.
    const stays = useRecurringExpenseStore.getState().templates.find((template) => template.id === moving.id)!;
    expect(
      useRecurringExpenseStore
        .getState()
        .updateTemplate(stays.id, draft({ childId: OTHER_CHILD, itemName: "유일한 항목", amountKrw: 41_000 })).ok
    ).toBe(true);
    expect(useRecurringExpenseStore.getState().templates.find((template) => template.id === moving.id)?.amountKrw).toBe(
      41_000
    );
  });

  /**
   * 절단도 아이별이어야 한다. 순수 모듈의 `sanitizeRecurringTemplates`는 상한을 목록 **앞에서부터
   * 전역으로** 세어 끊으므로, 스토어가 아이별로 나눠 지나게 하지 않으면 첫째의 20개 뒤에 저장된
   * 둘째의 템플릿이 앱을 다시 켤 때 통째로 사라진다(저장은 됐는데 재시작 후 없어지는 소실).
   */
  it("재수화에서 뒤에 저장된 다른 아이의 템플릿이 잘려 나가지 않는다", () => {
    fillChild(CHILD, RECURRING_TEMPLATE_LIMIT);
    expect(useRecurringExpenseStore.getState().addTemplate(draft({ childId: OTHER_CHILD, itemName: "분유" })).ok).toBe(
      true
    );
    const saved = useRecurringExpenseStore.getState().templates;

    const merge = useRecurringExpenseStore.persist.getOptions().merge!;
    const restored = merge({ templates: saved }, useRecurringExpenseStore.getState()) as { templates: typeof saved };

    // 순서까지 그대로다(목록 순서는 사용자가 저장한 순서다).
    expect(restored.templates).toEqual(saved);
    expect(restored.templates.filter((template) => template.childId === OTHER_CHILD)).toHaveLength(1);
  });

  it("아이별 절단은 여전히 20에서 끊는다 (손상된 blob이 목록을 무한히 늘리지 못한다)", () => {
    const merge = useRecurringExpenseStore.persist.getOptions().merge!;
    const overflow = Array.from({ length: RECURRING_TEMPLATE_LIMIT + 5 }, (_, index) => ({
      id: `local-recurring-${index}`,
      childId: CHILD,
      itemName: `품목 ${index}`,
      amountKrw: 1_000,
      categoryId: CATEGORY,
      paymentMethod: "card",
      dayOfMonth: 5,
      active: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      skippedYearMonths: []
    }));

    const restored = merge({ templates: overflow }, useRecurringExpenseStore.getState()) as {
      templates: { id: string }[];
    };
    expect(restored.templates).toHaveLength(RECURRING_TEMPLATE_LIMIT);
    // 앞에서부터 남는다(옛 동작 그대로).
    expect(restored.templates[0].id).toBe("local-recurring-0");
  });

  it("기존 blob(전역 20 이하)은 그대로 유효하다 — 마이그레이션이 필요 없다", () => {
    const merge = useRecurringExpenseStore.persist.getOptions().merge!;
    const legacy = [
      { childId: CHILD, itemName: "기저귀" },
      { childId: OTHER_CHILD, itemName: "분유" }
    ].map((row, index) => ({
      id: `local-recurring-legacy-${index}`,
      amountKrw: 38_500,
      categoryId: CATEGORY,
      paymentMethod: "card",
      dayOfMonth: 5,
      active: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      skippedYearMonths: [],
      ...row
    }));

    const restored = merge({ templates: legacy }, useRecurringExpenseStore.getState()) as {
      templates: { id: string; childId: string }[];
    };
    expect(restored.templates.map((template) => template.id)).toEqual([
      "local-recurring-legacy-0",
      "local-recurring-legacy-1"
    ]);
  });
});

/**
 * 라운드 59 P3 — 같은 아이 밑의 **같은 품목명 템플릿은 하나뿐**이다.
 *
 * 리마인더 판정이 품목명 하나로 돌기 때문에(이번 달 기록에 그 이름이 있는가), 같은 이름의
 * 템플릿이 둘이면 한 번 기록해도 두 줄이 함께 사라지고 두 줄이 함께 재촉한다 — 사용자에게는
 * "같은 걸 두 번 사라"는 카드로 읽힌다.
 */
describe("라운드 59 P3 중복 가드", () => {
  beforeEach(() => {
    useRecurringExpenseStore.getState().resetAll();
  });

  it("같은 아이·같은 품목명은 저장 대신 기존 항목을 안내한다 (덮어쓰지 않는다)", () => {
    expect(useRecurringExpenseStore.getState().addTemplate(draft()).ok).toBe(true);

    const duplicate = useRecurringExpenseStore.getState().addTemplate(draft({ amountKrw: 41_000 }));

    expect(duplicate).toEqual({ ok: false, message: recurringDuplicateMessage("기저귀") });
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(1);
    // 조용히 덮어쓰지 않는다 — 사용자가 지운 적 없는 금액이 그대로 남아 있다.
    expect(useRecurringExpenseStore.getState().templates[0].amountKrw).toBe(38_500);
  });

  it("띄어쓰기·대소문자만 다른 이름도 같은 항목이다 (이름 비교는 앱 전체가 한 벌)", () => {
    useRecurringExpenseStore.getState().addTemplate(draft({ itemName: "물티슈" }));

    for (const itemName of ["물 티슈", " 물티슈 ", "물   티슈"]) {
      expect(useRecurringExpenseStore.getState().addTemplate(draft({ itemName })).ok, itemName).toBe(false);
    }
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(1);
  });

  it("다른 아이의 같은 품목명은 막지 않는다 (첫째와 둘째가 각자 기저귀를 적어 둘 수 있다)", () => {
    useRecurringExpenseStore.getState().addTemplate(draft());

    expect(useRecurringExpenseStore.getState().addTemplate(draft({ childId: "child-2" })).ok).toBe(true);
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(2);
  });

  it("수정으로도 다른 항목과 같은 이름이 될 수 없다 (자기 자신은 제외)", () => {
    useRecurringExpenseStore.getState().addTemplate(draft({ itemName: "기저귀" }));
    useRecurringExpenseStore.getState().addTemplate(draft({ itemName: "분유" }));
    const [diaper, formula] = useRecurringExpenseStore.getState().templates;

    // 분유 → 기저귀로 고치면 거절된다.
    expect(useRecurringExpenseStore.getState().updateTemplate(formula.id, draft({ itemName: "기저귀" }))).toEqual({
      ok: false,
      message: recurringDuplicateMessage("기저귀")
    });
    // 자기 이름을 그대로 두고 금액만 고치는 것은 통과한다.
    expect(useRecurringExpenseStore.getState().updateTemplate(diaper.id, draft({ amountKrw: 41_000 })).ok).toBe(true);
  });

  /** 역방향 등록 버튼("이미 등록됨")과 저장 거절이 **같은 함수**를 지난다. */
  it("판정 함수는 아이 스코프이고, 이름 정규화와 자기 제외를 함께 다룬다", () => {
    useRecurringExpenseStore.getState().addTemplate(draft({ itemName: "기저귀" }));
    const templates = useRecurringExpenseStore.getState().templates;
    const saved = templates[0];

    expect(findRecurringTemplateByItemName(templates, CHILD, "기저귀")).toBe(saved);
    expect(findRecurringTemplateByItemName(templates, CHILD, " 기 저 귀 ")).toBe(saved);
    expect(findRecurringTemplateByItemName(templates, "child-2", "기저귀")).toBeNull();
    expect(findRecurringTemplateByItemName(templates, CHILD, "분유")).toBeNull();
    // 아이·이름이 비면 판정하지 않는다(빈 폼에서 "이미 등록됨"이 뜨지 않는다).
    expect(findRecurringTemplateByItemName(templates, null, "기저귀")).toBeNull();
    expect(findRecurringTemplateByItemName(templates, CHILD, "   ")).toBeNull();
    // 수정 중인 자기 자신은 중복이 아니다.
    expect(findRecurringTemplateByItemName(templates, CHILD, "기저귀", { excludeId: saved.id })).toBeNull();
  });

  it("관리 화면이 그 판정을 재사용해 저장 전에 말한다 (규칙 두 벌 금지)", () => {
    const screen = source("app/expenses/recurring.tsx");
    expect(screen).toContain("findRecurringTemplateByItemName(templates, selectedChildId, form.itemName, {");
    expect(screen).toContain("{RECURRING_ALREADY_REGISTERED_LABEL}");
    expect(RECURRING_ALREADY_REGISTERED_LABEL).toBe("이미 등록됨");
    // 화면이 이름 비교를 다시 적지 않는다.
    expect(screen).not.toContain("normalizeItemName");
    // 상한 표기도 아이별이라고 말한다(판정과 같은 기준 — 라운드 59 #4).
    expect(screen).toContain("아이 한 명당 최대 ${RECURRING_TEMPLATE_LIMIT}개");
  });

  /**
   * 후속 배선 — 역방향 진입("정기 지출로 등록")도 **같은 판정**을 지난다.
   *
   * 예전에는 이미 등록된 지출에서도 버튼이 그대로 서 있어, 누르면 채워진 폼이 열리고 저장에서
   * `recurringDuplicateMessage`로 거절당했다(누르기 → 폼 → 저장 → 거절 → 뒤로 = 헛걸음).
   * 이제 그 자리에는 버튼 대신 이미 있는 약속 한 줄이 선다.
   */
  it("지출 상세의 역방향 진입도 같은 판정으로 '이미 등록됨'을 단다 (헛걸음 왕복 제거)", () => {
    const detail = source("app/expenses/[expenseId].tsx");
    expect(detail).toContain('from "../../src/stores/recurring-expense.store"');
    expect(detail).toContain("const recurringTemplates = useRecurringExpenseStore((state) => state.templates);");
    expect(detail).toContain("findRecurringTemplateByItemName(");
    // 판정 인자는 목록 · 선택된 아이 · **저장된 기록의 품목명**이다(편집 중인 입력이 아니다).
    expect(detail).toContain("recurringTemplates,\n    selectedChildId,\n    expense.data?.itemName ?? \"\"");
    // 있으면 버튼 대신 표기, 없으면 종전 버튼 그대로.
    expect(detail).toContain("{alreadyRegisteredRecurring ? (");
    expect(detail).toContain("{RECURRING_ALREADY_REGISTERED_LABEL} · ${formatRecurringTemplateLine(");
    expect(detail).toContain("label={RECURRING_REGISTER_ACTION_LABEL}");
    // 문구·규칙을 화면이 다시 적지 않는다.
    expect(detail).not.toContain("이미 등록됨");
    expect(detail).not.toContain("normalizeItemName(template");
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

/**
 * 라운드 62 트랙 B(#5) — 삭제한 아이의 **기기 잔재** 정리.
 *
 * 정기 지출은 눈에 안 보이는 잔재가 아니다: 상한 20개가 아이별이라(라운드 59 #4), 삭제된 아이의
 * 템플릿이 그 아이 몫의 칸을 계속 차지한 채 남는다. 관리 화면은 선택된 아이의 목록만 그리므로
 * 사용자가 그것을 찾아 지울 방법도 없다. 배선(finishChildRemoval에서의 호출)은 이 트랙 밖이다.
 */
describe("라운드 62 B(#5) 아이 단위 정리 clearForChild", () => {
  const OTHER_CHILD = "child-2";

  beforeEach(() => {
    useRecurringExpenseStore.getState().resetAll();
  });

  it("그 아이의 템플릿만 지우고 다른 아이의 것은 순서 그대로 남는다", () => {
    const store = useRecurringExpenseStore.getState();
    store.addTemplate(draft({ itemName: "기저귀" }));
    store.addTemplate(draft({ childId: OTHER_CHILD, itemName: "분유" }));
    store.addTemplate(draft({ itemName: "물티슈" }));
    useRecurringExpenseStore.getState().clearForChild(CHILD);
    expect(
      useRecurringExpenseStore.getState().templates.map((template) => [template.childId, template.itemName])
    ).toEqual([[OTHER_CHILD, "분유"]]);
  });

  it("지운 아이의 칸이 실제로 돌아온다 (상한 20은 아이별이다)", () => {
    const store = useRecurringExpenseStore.getState();
    for (let index = 0; index < RECURRING_TEMPLATE_LIMIT; index += 1) {
      expect(store.addTemplate(draft({ itemName: `품목${index}` })).ok).toBe(true);
    }
    expect(useRecurringExpenseStore.getState().addTemplate(draft({ itemName: "하나 더" }))).toEqual({
      ok: false,
      message: RECURRING_LIMIT_MESSAGE
    });
    useRecurringExpenseStore.getState().clearForChild(CHILD);
    expect(useRecurringExpenseStore.getState().addTemplate(draft({ itemName: "하나 더" })).ok).toBe(true);
  });

  it("빈 childId로는 아무것도 지우지 않고, 지울 것이 없으면 같은 배열을 돌려준다", () => {
    const store = useRecurringExpenseStore.getState();
    store.addTemplate(draft());
    const templates = useRecurringExpenseStore.getState().templates;
    for (const noop of ["", "   ", "child-gone"]) {
      expect(clearRecurringTemplatesForChild(templates, noop)).toBe(templates);
    }
    useRecurringExpenseStore.getState().clearForChild("");
    expect(useRecurringExpenseStore.getState().templates).toBe(templates);
  });

  it("저장 경로와 같은 모양으로 비교한다 (앞뒤 공백은 같은 아이다)", () => {
    const store = useRecurringExpenseStore.getState();
    store.addTemplate(draft());
    useRecurringExpenseStore.getState().clearForChild(`  ${CHILD}  `);
    expect(useRecurringExpenseStore.getState().templates).toEqual([]);
  });

  /**
   * 라운드 62 #8 — "같은 모양으로 trim한 값끼리"라는 주석이 **인자 쪽만** 참이었다. 저장된
   * `childId`는 그대로 비교돼, 저장 시 trim 규약이 붙기 전에 만들어진 persist 행(앞뒤 공백)이
   * 삭제에서 조용히 빠졌다. 그 행은 아이별 20칸을 계속 차지하면서 관리 화면에는 뜨지 않는다.
   */
  it("저장된 쪽에 공백이 섞인 옛 persist 행도 같은 아이로 보고 지운다 (라운드 62 #8)", () => {
    const store = useRecurringExpenseStore.getState();
    store.addTemplate(draft());
    const [saved] = useRecurringExpenseStore.getState().templates;
    const legacyRows = [{ ...saved, childId: `  ${CHILD}  ` }];

    expect(clearRecurringTemplatesForChild(legacyRows, CHILD)).toEqual([]);
    // 양쪽 모두 다듬으므로 인자에 공백이 섞여도 같은 답이다.
    expect(clearRecurringTemplatesForChild(legacyRows, ` ${CHILD} `)).toEqual([]);
    // 다른 아이는 여전히 남는다(공백을 지웠다고 아무나 걸리지 않는다).
    expect(clearRecurringTemplatesForChild(legacyRows, OTHER_CHILD)).toBe(legacyRows);
  });
});
