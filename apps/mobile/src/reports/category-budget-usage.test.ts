import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { categoryCatalog } from "../categories";
import { buildRecordsCategoryChips } from "../expenses/records-list-view";
import { evaluateHomeBudgetProgress } from "../home/budget-progress";
import { buildCategoryBudgetUsageRows } from "./category-budget-usage";

/**
 * 라운드 102 T3 — 리포트 월간 탭 "카테고리 예산" 블록 조립 계약
 * (docs/5차/round102-category-budget-design.md §4.3·§5.1·§9.6).
 *
 * 무는 것: matchIds 가족 합류 = 기록 탭 칩 필터 동치(리스크 R2) · 퍼센트/초과 판정
 * `evaluateHomeBudgetProgress` 재사용(판정 두 벌 금지) · 관측 톤 문장(DNC-018) · 예산 없는
 * 카테고리 행 없음 · 목록 부재 시 행 0건(모르면 지어내지 않는다) · 숨긴 카테고리 이름 유지.
 */

const mobileRoot = process.cwd();
const moduleSource = () => readFileSync(join(mobileRoot, "src/reports/category-budget-usage.ts"), "utf8");

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
const FIXTURE_CATEGORIES = [CANONICAL_DIAPER, CANONICAL_FEEDING, HIDDEN_INSURANCE];

// 카탈로그의 퀵타일 id — 별칭 지출은 이 id로 저장된다(코드 다리: diaper_hygiene 하나,
// feeding_babyfood 둘("분유/유제품"·"식비") — §5.1이 그대로 받아들인 그 귀결).
const DIAPER_TILE_ID = categoryCatalog.find((entry) => entry.code === "diaper_hygiene")!.id;
const FEEDING_TILE_IDS = categoryCatalog.filter((entry) => entry.code === "feeding_babyfood").map((entry) => entry.id);

const BREAKDOWN = [
  { categoryId: CANONICAL_DIAPER.id, amountKrw: 30_000 },
  { categoryId: DIAPER_TILE_ID, amountKrw: 20_000 },
  { categoryId: FEEDING_TILE_IDS[0], amountKrw: 10_000 },
  { categoryId: FEEDING_TILE_IDS[1], amountKrw: 5_000 },
  // 예산 없는 카테고리의 지출 — 어느 행에도 흡수되면 안 된다.
  { categoryId: "cat-unrelated", amountKrw: 99_999 }
];

describe("사용액 = matchIds 가족 합 — 기록 탭 칩 필터와 같은 집합 (§5.1 · 리스크 R2)", () => {
  it("퀵타일 별칭 id 지출이 정식 예산 행의 사용액에 합류한다", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: BREAKDOWN,
      categories: FIXTURE_CATEGORIES
    });
    expect(rows).toHaveLength(1);
    // 30,000(정식) + 20,000(기저귀 타일) — 정식 id 완전 일치만 보면 20,000이 통째로 빠진다.
    expect(rows[0].primaryText).toBe("기저귀/위생 50,000원 / 예산 100,000원");
    expect(rows[0].secondaryText).toBe("예산의 50%를 썼어요");
  });

  it("합류 규칙의 원천이 칩 대장 하나다 — 같은 픽스처에서 칩 matchIds 합과 값이 같다 (드리프트 차단)", () => {
    const chip = buildRecordsCategoryChips(FIXTURE_CATEGORIES).find((entry) => entry.id === CANONICAL_DIAPER.id)!;
    const chipFilterSum = BREAKDOWN.filter((row) => chip.matchIds.includes(row.categoryId)).reduce(
      (total, row) => total + row.amountKrw,
      0
    );
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: BREAKDOWN,
      categories: FIXTURE_CATEGORIES
    });
    expect(rows[0].primaryText).toContain(`${chipFilterSum.toLocaleString("ko-KR")}원 /`);
    // 원천이 실제로 한 모듈이다 — 새 매핑 코드를 만들지 않았다(§5.1 "새 매핑 코드 0건").
    expect(moduleSource()).toContain('from "../expenses/records-list-view"');
  });

  it('"수유/이유식" 예산은 "분유/유제품"·"식비" 타일 지출을 함께 센다 — 기록 탭 칩과 같은 귀결(§5.1)', () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_FEEDING.id, amountKrw: 10_000 }],
      breakdown: BREAKDOWN,
      categories: FIXTURE_CATEGORIES
    });
    // 10,000 + 5,000 = 15,000 — 예산 10,000을 넘었다.
    expect(rows[0].primaryText).toBe("수유/이유식 15,000원 / 예산 10,000원");
    expect(rows[0].secondaryText).toBe("예산보다 5,000원 더 썼어요");
  });
});

describe("퍼센트·초과 판정 — evaluateHomeBudgetProgress 하나다 (판정 두 벌 금지 · §4.3)", () => {
  it("반올림이 홈 히어로와 같다 (77.86% → 78%)", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 1_600_000 }],
      breakdown: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 1_245_700 }],
      categories: FIXTURE_CATEGORIES
    });
    const expected = evaluateHomeBudgetProgress({ budgetKrw: 1_600_000, spentKrw: 1_245_700 }).percent;
    expect(expected).toBe(78);
    expect(rows[0].secondaryText).toBe("예산의 78%를 썼어요");
  });

  it('"미소진 100% 금지" 캡도 그대로 탄다 (99.7% → 99%)', () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 99_700 }],
      categories: FIXTURE_CATEGORIES
    });
    expect(rows[0].secondaryText).toBe("예산의 99%를 썼어요");
    expect(moduleSource()).toContain('from "../home/budget-progress"');
  });

  it("초과 행은 퍼센트 대신 초과 금액을 관측 톤으로 말한다 — 억제 권고·죄책감 어휘 없음 (DNC-018)", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 30_000 }],
      breakdown: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 50_000 }],
      categories: FIXTURE_CATEGORIES
    });
    expect(rows[0].secondaryText).toBe("예산보다 20,000원 더 썼어요");
    for (const banned of ["아껴", "줄여", "너무", "경고"]) {
      expect(rows[0].primaryText).not.toContain(banned);
      expect(rows[0].secondaryText).not.toContain(banned);
      expect(rows[0].accessibilityLabel).not.toContain(banned);
    }
  });

  it("경계는 `isBudgetUsedUp`(>=) 하나다 — 정확히 100%인 행은 '모두 썼어요', 퍼센트 문장은 미소진에만 선다 (리뷰 L-1)", () => {
    // ⚠️ 두 시점: 종전 갈래는 `used > budget`이라, 정확히 다 쓴 행에서 퍼센트(모듈의 `>=`
    // 경계로 100%)와 문장(`>` 경계)이 서로 다른 경계를 들었다 — 라운드 38 H-2가 히어로·넛지에서
    // 없앤 그 모양이다. 이제 세 갈래를 한 술어가 가른다.
    const exact = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      categories: FIXTURE_CATEGORIES
    });
    expect(exact[0].secondaryText).toBe("예산을 모두 썼어요");
    // 1원만 넘어도 초과 금액을 말한다(같은 술어의 다른 갈래 — "0원 더 썼어요"는 없는 사실이다).
    const over = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_001 }],
      categories: FIXTURE_CATEGORIES
    });
    expect(over[0].secondaryText).toBe("예산보다 1원 더 썼어요");
    // 그 경계는 홈 히어로·넛지와 **같은 모듈의 같은 함수**다(부등호를 새로 적는 자리 0건).
    expect(moduleSource()).toContain("isBudgetUsedUp");
    // 미소진 구간의 퍼센트 문장은 100을 말할 수 없다(캡 + 이 경계의 합작).
    const almost = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 99_999 }],
      categories: FIXTURE_CATEGORIES
    });
    expect(almost[0].secondaryText).toBe("예산의 99%를 썼어요");
  });

  it("사용액 0원인 예산 행도 사실 그대로 선다 (0%)", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: [],
      categories: FIXTURE_CATEGORIES
    });
    expect(rows[0].primaryText).toBe("기저귀/위생 0원 / 예산 100,000원");
    expect(rows[0].secondaryText).toBe("예산의 0%를 썼어요");
  });
});

describe("모집단 — 예산이 있는 행만, 모르면 만들지 않는다 (§5.2)", () => {
  it("예산 없는 카테고리는 행이 없다 — 지출이 있어도 기준선을 지어내지 않는다", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: BREAKDOWN,
      categories: FIXTURE_CATEGORIES
    });
    expect(rows.map((row) => row.categoryId)).toEqual([CANONICAL_DIAPER.id]);
  });

  it("예산이 0건이거나(구 캐시의 필드 부재 포함) 카테고리 목록이 없으면 행 0건이다", () => {
    expect(
      buildCategoryBudgetUsageRows({ budgets: [], breakdown: BREAKDOWN, categories: FIXTURE_CATEGORIES })
    ).toEqual([]);
    expect(
      buildCategoryBudgetUsageRows({ budgets: undefined, breakdown: BREAKDOWN, categories: FIXTURE_CATEGORIES })
    ).toEqual([]);
    expect(
      buildCategoryBudgetUsageRows({
        budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
        breakdown: BREAKDOWN,
        categories: null
      })
    ).toEqual([]);
    expect(
      buildCategoryBudgetUsageRows({
        budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
        breakdown: BREAKDOWN,
        categories: []
      })
    ).toEqual([]);
    // 저장될 수 없는 예산 값(0 이하)은 행의 근거가 아니다.
    expect(
      buildCategoryBudgetUsageRows({
        budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 0 }],
        breakdown: BREAKDOWN,
        categories: FIXTURE_CATEGORIES
      })
    ).toEqual([]);
  });

  it("숨긴 카테고리의 예산 행은 이름 해석과 함께 앞에 남는다 (§6.5)", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [
        { categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 },
        { categoryId: HIDDEN_INSURANCE.id, amountKrw: 40_000 }
      ],
      breakdown: [...BREAKDOWN, { categoryId: HIDDEN_INSURANCE.id, amountKrw: 10_000 }],
      categories: FIXTURE_CATEGORIES
    });
    expect(rows.map((row) => row.categoryId)).toEqual([HIDDEN_INSURANCE.id, CANONICAL_DIAPER.id]);
    expect(rows[0].name).toBe("보험/저축");
    // 이 분류에는 퀵타일 코드 다리가 없어(카탈로그에 insurance_savings 없음) 가족이 자기 id
    // 하나뿐이다 — 아래 계약과 같은 규칙이 낸 다른 답이다(규칙이 다른 것이 아니다).
    expect(rows[0].primaryText).toBe("보험/저축 10,000원 / 예산 40,000원");
  });

  it("숨긴 뒤에도 퀵타일 가족은 그대로 합류한다 — 숨김 전후로 같은 사용액이다 (리뷰 L-7)", () => {
    // ⚠️ 두 시점: 종전 kept 행의 가족은 **자기 id 하나**로 못 박혀 있었다("모르는 합류를
    // 지어내지 않는다"). 그런데 코드 다리가 있는 분류에서는 그 한 개가 **아는 합류를 잃는
    // 것**이었다 — 운영자가 "기저귀/위생"을 숨기는 순간 같은 달·같은 지출인데 사용액만
    // 20,000원 급감한다(퀵타일 id 지출이 통째로 빠진다). 오늘은 같은 `buildRecordsCategoryChips`를
    // 그 id로 한 번 더 세워(규칙 (d)) 그 칩의 matchIds를 쓴다.
    const hiddenDiaper = { ...CANONICAL_DIAPER, active: false };
    const visible = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: BREAKDOWN,
      categories: FIXTURE_CATEGORIES
    });
    const hidden = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: BREAKDOWN,
      categories: [hiddenDiaper, CANONICAL_FEEDING, HIDDEN_INSURANCE]
    });
    // 30,000(정식) + 20,000(기저귀 타일) — 숨김은 **선택지**에서만 빼고 사실을 바꾸지 않는다.
    expect(visible[0].primaryText).toBe("기저귀/위생 50,000원 / 예산 100,000원");
    expect(hidden[0].primaryText).toBe(visible[0].primaryText);
    expect(hidden[0].secondaryText).toBe(visible[0].secondaryText);
  });

  it("행 순서는 칩 대장 순서다 (§9.6 — 화면 정렬은 칩 대장이 진다)", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [
        { categoryId: CANONICAL_FEEDING.id, amountKrw: 50_000 },
        { categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }
      ],
      breakdown: BREAKDOWN,
      categories: FIXTURE_CATEGORIES
    });
    expect(rows.map((row) => row.categoryId)).toEqual([CANONICAL_DIAPER.id, CANONICAL_FEEDING.id]);
  });
});

describe("낭독 — 눈과 귀가 같은 사실을 말한다 (쉼표 구분자 관례)", () => {
  it("행 하나의 낭독 문장이 이름·사용액·예산·보조 문장을 전부 담는다", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }],
      breakdown: BREAKDOWN,
      categories: FIXTURE_CATEGORIES
    });
    expect(rows[0].accessibilityLabel).toBe("기저귀/위생, 50,000원 사용, 예산 100,000원, 예산의 50%를 썼어요");
  });
});
