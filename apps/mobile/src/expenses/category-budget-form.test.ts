import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { API_ERROR_MESSAGES } from "../api/api-error";
import { categoryCatalog } from "../categories";
import { amountOverLimitMessage } from "./amount-limit";
import {
  buildCategoryBudgetForm,
  buildCategoryCarryOverChip,
  categoryBudgetInitialDigits,
  isCategoryBudgetDirty,
  mergeCategoryBudgetDraft
} from "./category-budget-form";

/**
 * 라운드 102 T3 — 예산 화면 "카테고리별 예산" 카드의 순수 로직 계약
 * (docs/5차/round102-category-budget-design.md §4.1·§4.2·§9.6).
 *
 * 무는 것: 행 모집단(칩 대장·8타일 폴백 차단·끼워 유지) · 빈 행 = 해제 · dirty 값 비교 ·
 * 금액 가드 단일 소스 · 상한 30 선제(api-error 표 문구 + 계약 상수 두 방향 대조) ·
 * 합>총액 관측 한 줄(해요체·저장 비차단) · 이월 칩 defer 조건(채워 넣기 전용).
 */

const mobileRoot = process.cwd();
const moduleSource = () => readFileSync(join(mobileRoot, "src/expenses/category-budget-form.ts"), "utf8");
const contractsSource = () =>
  readFileSync(join(mobileRoot, "..", "..", "packages/contracts/src/schemas.ts"), "utf8");

/** 정식 선택 가능 행 둘 + 운영자가 숨긴 행 하나 + 퀵타일 별칭 하나 + 가져오기 스텁 하나. */
const CANONICAL_DIAPER = { id: "cat-diaper", code: "diaper_hygiene", name: "기저귀/위생", selectable: true, active: true };
const CANONICAL_FEEDING = {
  id: "cat-feeding",
  code: "feeding_babyfood",
  name: "수유/이유식",
  selectable: true,
  active: true
};
const HIDDEN_INSURANCE = {
  id: "cat-hidden",
  code: "insurance_savings",
  name: "보험/저축",
  selectable: true,
  active: false
};
const ALIAS_TILE = {
  // 서버 별칭 행의 id는 카탈로그 타일 id와 바이트 동일하다(mobileCategoryAliasSeeds).
  id: categoryCatalog[0].id,
  code: `mobile_${categoryCatalog[0].code}`,
  name: categoryCatalog[0].label,
  selectable: false,
  active: true
};
const IMPORT_STUB = { id: "cat-stub", code: "import_stub_default", name: "가져오기 기본", selectable: false, active: true };

const FIXTURE_CATEGORIES = [CANONICAL_DIAPER, CANONICAL_FEEDING, HIDDEN_INSURANCE, ALIAS_TILE, IMPORT_STUB];

describe("행 모집단 — 칩 대장(정식 선택 가능 행)이고, 목록이 없으면 폼이 없다 (§4.1)", () => {
  it("목록 부재(null/undefined/빈 배열)면 null — 카드 자체를 그리지 않는다", () => {
    expect(buildCategoryBudgetForm({ categories: null, draft: {}, totalBudgetKrw: null })).toBeNull();
    expect(buildCategoryBudgetForm({ categories: undefined, draft: {}, totalBudgetKrw: null })).toBeNull();
    expect(buildCategoryBudgetForm({ categories: [], draft: {}, totalBudgetKrw: null })).toBeNull();
  });

  it("8타일 폴백 갈래를 구조적으로 차단한다 — 선택 가능 행이 0건이면 폼이 없다 (별칭 id 예산 경로 없음)", () => {
    // 별칭·스텁만 남은 목록: 칩 모듈은 8타일 폴백을 돌려주지만 그 id들은 서버 목록 밖이라
    // 전부 떨어져야 한다. 여기가 뚫리면 퀵타일 별칭 id로 예산이 저장되는 경로가 생긴다(§1.1 D).
    const form = buildCategoryBudgetForm({ categories: [IMPORT_STUB], draft: {}, totalBudgetKrw: null });
    expect(form).toBeNull();
  });

  it("행은 정식 선택 가능 행뿐이다 — 별칭·스텁·숨긴 행은 행이 아니다", () => {
    const form = buildCategoryBudgetForm({ categories: FIXTURE_CATEGORIES, draft: {}, totalBudgetKrw: null });
    expect(form).not.toBeNull();
    expect(form!.rows.map((row) => row.categoryId)).toEqual([CANONICAL_DIAPER.id, CANONICAL_FEEDING.id]);
    expect(form!.rows.map((row) => row.name)).toEqual(["기저귀/위생", "수유/이유식"]);
    // a11y 라벨은 "{이름} 예산 입력" — 이름 뒤 조사 없음(§6.3).
    expect(form!.rows[0].inputAccessibilityLabel).toBe("기저귀/위생 예산 입력");
  });

  it("끼워 유지 — 이미 값이 서 있는 숨긴 카테고리는 이름 해석과 함께 앞에 남는다 (§6.5)", () => {
    const form = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [HIDDEN_INSURANCE.id]: "50000" },
      totalBudgetKrw: null
    });
    expect(form!.rows.map((row) => row.categoryId)).toEqual([
      HIDDEN_INSURANCE.id,
      CANONICAL_DIAPER.id,
      CANONICAL_FEEDING.id
    ]);
    // 이름은 includeAll 전량 목록이 해석한다 — "기타"로 무너지지 않는다(R28-F3).
    expect(form!.rows[0].name).toBe("보험/저축");
    expect(form!.entries).toEqual([{ categoryId: HIDDEN_INSURANCE.id, amountKrw: 50_000 }]);
  });
});

describe("빈 행 = 해제 · dirty는 값 비교 (§2.2 부재 무접촉의 근거)", () => {
  it("초기값 맵은 서버 행에서만 나온다 — 0 이하·비정수 행은 만들지 않는다", () => {
    expect(
      categoryBudgetInitialDigits([
        { categoryId: "a", amountKrw: 100_000 },
        { categoryId: "b", amountKrw: 0 },
        { categoryId: "c", amountKrw: -5 },
        { categoryId: "d", amountKrw: 1.5 }
      ])
    ).toEqual({ a: "100000" });
    expect(categoryBudgetInitialDigits(null)).toEqual({});
    expect(categoryBudgetInitialDigits(undefined)).toEqual({});
  });

  it("draft = 초기값 위에 편집을 얹은 것 — 편집 없는 행은 초기값 그대로다", () => {
    expect(mergeCategoryBudgetDraft({ a: "1000" }, { b: "2000" })).toEqual({ a: "1000", b: "2000" });
    expect(mergeCategoryBudgetDraft({ a: "1000" }, { a: "" })).toEqual({ a: "" });
  });

  it("안 고친 저장·고쳤다 되돌린 저장은 dirty가 아니다 — 필드가 실리지 않는다 (§6.7 R1)", () => {
    const initial = { a: "100000" };
    expect(isCategoryBudgetDirty(initial, { ...initial })).toBe(false);
    // 되돌림(같은 값 재입력)도 값 비교라 dirty가 아니다.
    expect(isCategoryBudgetDirty(initial, mergeCategoryBudgetDraft(initial, { a: "100000" }))).toBe(false);
    // 값 변경·해제(비우기)·새 행은 dirty다.
    expect(isCategoryBudgetDirty(initial, { a: "200000" })).toBe(true);
    expect(isCategoryBudgetDirty(initial, { a: "" })).toBe(true);
    expect(isCategoryBudgetDirty(initial, { a: "100000", b: "3000" })).toBe(true);
    // "0"은 빈 행과 같은 해제다(§1.2 — 0원 예산 없음): 처음부터 없던 행에 0을 쳐도 dirty가 아니다.
    expect(isCategoryBudgetDirty({}, { a: "0" })).toBe(false);
    expect(isCategoryBudgetDirty(initial, { a: "0" })).toBe(true);
  });

  it("entries는 채워진 행(양수)만, categoryId 오름차순이다 — 빈 행·0은 집합에 없다(= 해제)", () => {
    const form = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_FEEDING.id]: "30000", [CANONICAL_DIAPER.id]: "0" },
      totalBudgetKrw: null
    });
    expect(form!.entries).toEqual([{ categoryId: CANONICAL_FEEDING.id, amountKrw: 30_000 }]);
    const both = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_FEEDING.id]: "30000", [CANONICAL_DIAPER.id]: "20000" },
      totalBudgetKrw: null
    });
    // "cat-diaper" < "cat-feeding" — 오름차순(§2.6 감사 봉투와 같은 정렬).
    expect(both!.entries.map((entry) => entry.categoryId)).toEqual([CANONICAL_DIAPER.id, CANONICAL_FEEDING.id]);
  });

  it("중복은 구조적으로 만들 수 없다 — draft가 categoryId 키 맵이라 행도 집합도 id당 하나다", () => {
    const form = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_DIAPER.id]: "10000" },
      totalBudgetKrw: null
    });
    const ids = form!.rows.map((row) => row.categoryId);
    expect(new Set(ids).size).toBe(ids.length);
    const entryIds = form!.entries.map((entry) => entry.categoryId);
    expect(new Set(entryIds).size).toBe(entryIds.length);
  });
});

describe("금액 가드 — 값·문구는 지출·총액 예산과 같은 단일 소스 (GAP-054 #2)", () => {
  it("상한 초과 행은 같은 문구의 행 오류를 얻고, 폼이 저장 불가가 된다", () => {
    const form = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_DIAPER.id]: "2147483648" },
      totalBudgetKrw: null
    });
    const row = form!.rows.find((entry) => entry.categoryId === CANONICAL_DIAPER.id)!;
    expect(row.errorText).toBe(amountOverLimitMessage());
    expect(form!.isValid).toBe(false);
    // 서버가 받아 줄 수 없는 값은 집합에도 싣지 않는다.
    expect(form!.entries).toEqual([]);
  });

  it("상한 이내 행은 오류가 없고 폼이 저장 가능하다", () => {
    const form = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_DIAPER.id]: "2147483647" },
      totalBudgetKrw: null
    });
    expect(form!.rows.every((row) => row.errorText === null)).toBe(true);
    expect(form!.isValid).toBe(true);
  });
});

describe("상한 30 선제 — 문구는 api-error 표 경유, 값은 계약 상수와 두 방향 대조 (§1.4·§9.3)", () => {
  const manyDraft = (count: number): Record<string, string> => {
    const draft: Record<string, string> = {};
    for (let index = 0; index < count; index += 1) draft[`extra-${String(index).padStart(2, "0")}`] = "1000";
    return draft;
  };

  it("30건은 통과, 31건은 서버 코드와 같은 문구로 선제한다 (경계 30/31)", () => {
    const at30 = buildCategoryBudgetForm({ categories: FIXTURE_CATEGORIES, draft: manyDraft(30), totalBudgetKrw: null });
    expect(at30!.formError).toBeNull();
    expect(at30!.isValid).toBe(true);
    const at31 = buildCategoryBudgetForm({ categories: FIXTURE_CATEGORIES, draft: manyDraft(31), totalBudgetKrw: null });
    expect(at31!.formError).toBe(API_ERROR_MESSAGES.CATEGORY_BUDGET_LIMIT_EXCEEDED);
    expect(at31!.isValid).toBe(false);
  });

  it("모듈의 비export 리터럴 사본이 계약 상수와 값으로 같다 (라운드 100 T3 형식의 두 방향 대조)", () => {
    const mirror = moduleSource().match(/const CATEGORY_BUDGET_FORM_ROW_LIMIT = (\d+);/);
    expect(mirror, "모듈에서 상한 사본을 찾지 못했다").not.toBeNull();
    const contract = contractsSource().match(/export const CATEGORY_BUDGET_MAX_PER_MONTH = (\d+);/);
    expect(contract, "계약에서 CATEGORY_BUDGET_MAX_PER_MONTH를 찾지 못했다").not.toBeNull();
    expect(Number(mirror![1])).toBe(Number(contract![1]));
    // 문구 속 숫자(api-error 표)와도 갈리지 않는다 — 표 문구는 서버 원문 그대로다.
    expect(API_ERROR_MESSAGES.CATEGORY_BUDGET_LIMIT_EXCEEDED).toBe(
      `카테고리 예산은 한 달에 ${contract![1]}개까지 정할 수 있어요.`
    );
  });
});

describe("합>총액 관측 한 줄 — 사실만 말하고 저장은 막지 않는다 (§1.3(a) · DNC-018)", () => {
  it("합이 총액을 넘으면 초과분을 관측 톤으로 말한다 (해요체 · 평가·권고 없음)", () => {
    const form = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_DIAPER.id]: "200000", [CANONICAL_FEEDING.id]: "150000" },
      totalBudgetKrw: 300_000
    });
    expect(form!.sumNoticeText).toBe("카테고리 예산을 더한 값이 월 예산보다 50,000원 커요");
    // 저장은 막지 않는다 — 관측일 뿐이다.
    expect(form!.isValid).toBe(true);
    // 지출 억제 권고·죄책감 어휘 금지(DNC-018 — budget-pace의 그 경계).
    expect(form!.sumNoticeText).not.toContain("아껴");
    expect(form!.sumNoticeText).not.toContain("줄여");
  });

  it("합이 총액 이내이거나 총액을 모르면 줄이 없다", () => {
    const within = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_DIAPER.id]: "100000" },
      totalBudgetKrw: 300_000
    });
    expect(within!.sumNoticeText).toBeNull();
    const unknownTotal = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_DIAPER.id]: "100000" },
      totalBudgetKrw: null
    });
    expect(unknownTotal!.sumNoticeText).toBeNull();
    const zeroTotal = buildCategoryBudgetForm({
      categories: FIXTURE_CATEGORIES,
      draft: { [CANONICAL_DIAPER.id]: "100000" },
      totalBudgetKrw: 0
    });
    expect(zeroTotal!.sumNoticeText).toBeNull();
  });
});

describe("이월 칩 — 서는 조건 셋 · 채워 넣기 전용 (§4.2 · B1(b) 자동 저장 금지)", () => {
  const lastMonth = [
    { categoryId: "cat-diaper", amountKrw: 100_000 },
    { categoryId: "cat-feeding", amountKrw: 50_000 }
  ];

  it("이번 달 총액 없음 + 지난달 행 존재 + 이번 달 행 전부 빈 상태에서만 선다", () => {
    const chip = buildCategoryCarryOverChip({ thisMonthBudgetMissing: true, lastMonthEntries: lastMonth, draft: {} });
    expect(chip).not.toBeNull();
    expect(chip!.label).toBe("지난달 카테고리 예산 그대로");
    expect(chip!.accessibilityLabel).toBe("지난달 카테고리 예산 그대로 채우기");
    // 채워 넣을 값 — 지난달 집합 그대로다(저장은 사람이 [저장]을 누를 때만).
    expect(chip!.prefillDigits).toEqual({ "cat-diaper": "100000", "cat-feeding": "50000" });
  });

  it("조건 하나라도 빠지면 서지 않는다", () => {
    // 이번 달 예산이 있는(또는 아직 모르는) 화면 — 기존 이월 칩과 같은 defer 갈래.
    expect(buildCategoryCarryOverChip({ thisMonthBudgetMissing: false, lastMonthEntries: lastMonth, draft: {} })).toBeNull();
    // 지난달 행 없음(구 서버 응답의 필드 부재 포함).
    expect(buildCategoryCarryOverChip({ thisMonthBudgetMissing: true, lastMonthEntries: [], draft: {} })).toBeNull();
    expect(buildCategoryCarryOverChip({ thisMonthBudgetMissing: true, lastMonthEntries: undefined, draft: {} })).toBeNull();
    // 이번 달 행이 하나라도 채워져 있으면 덮어쓸 제안을 하지 않는다.
    expect(
      buildCategoryCarryOverChip({
        thisMonthBudgetMissing: true,
        lastMonthEntries: lastMonth,
        draft: { "cat-diaper": "70000" }
      })
    ).toBeNull();
    // 지난달 행이 전부 저장 불가 값(0 이하)이면 채울 것이 없다.
    expect(
      buildCategoryCarryOverChip({
        thisMonthBudgetMissing: true,
        lastMonthEntries: [{ categoryId: "cat-diaper", amountKrw: 0 }],
        draft: {}
      })
    ).toBeNull();
  });
});
