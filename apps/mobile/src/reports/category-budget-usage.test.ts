import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { categoryCatalog } from "../categories";
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

/**
 * 라운드 106 T4 — **독립 오라클용 자릿값 픽스처**.
 *
 * 각 id에 서로 다른 2의 거듭제곱을 주면 행의 사용액 한 수가 "어떤 id들이 합쳐졌는가"를 유일하게
 * 지목한다. 그래서 아래 `observedFamilyIds`는 모듈이 **화면에 그린 문장**에서 가족을 되짚을 수
 * 있고, 합류 규칙을 만드는 함수(`buildRecordsCategoryChips`)를 한 번도 부르지 않는다 — 검증
 * 대상과 오라클이 갈라져 있다는 것이 이 픽스처의 값이다.
 */
const FAMILY_PROBE_FLAGS: ReadonlyArray<readonly [string, number]> = [
  [CANONICAL_DIAPER.id, 1],
  [DIAPER_TILE_ID, 2],
  [CANONICAL_FEEDING.id, 4],
  [FEEDING_TILE_IDS[0], 8],
  [FEEDING_TILE_IDS[1], 16],
  [HIDDEN_INSURANCE.id, 32],
  ["cat-unrelated", 64]
];

/** 모듈 산출물(primaryText)에서 되짚은 **관측 가족** — 정렬해 돌려준다. */
function observedFamilyIds(categoryId: string, categories: typeof FIXTURE_CATEGORIES = FIXTURE_CATEGORIES): string[] {
  const rows = buildCategoryBudgetUsageRows({
    // 예산은 자릿값 합보다 훨씬 크게 둔다 — 이 검사는 가족만 본다(문장 갈래는 아래 묶음이 문다).
    budgets: [{ categoryId, amountKrw: 1_000_000 }],
    breakdown: FAMILY_PROBE_FLAGS.map(([id, amountKrw]) => ({ categoryId: id, amountKrw })),
    categories
  });
  expect(rows).toHaveLength(1);
  const digits = rows[0].primaryText.match(/ ([\d,]+)원 \/ /)?.[1];
  expect(digits).toBeTruthy();
  const usedKrw = Number((digits ?? "").replace(/,/g, ""));
  return FAMILY_PROBE_FLAGS.filter(([, flag]) => (usedKrw & flag) === flag)
    .map(([id]) => id)
    .sort();
}

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

  it("가족의 원소가 값으로 못 박힌다 — 자릿값 픽스처로 복원한 집합이 손으로 적은 계약과 같다 (독립 오라클)", () => {
    // ⚠️ 두 시점 (라운드 106 T4 — 라운드 102 이월 R2): 이 자리의 종전 단언은 기대값을
    // `buildRecordsCategoryChips(...).matchIds`로 만들어 **검증 대상과 같은 함수**를 오라클로
    // 썼다. 그러면 합류 규칙이 어느 방향으로 드리프트해도 양변이 함께 움직여 언제나 초록이다
    // (예: "식비" 타일이 수유 가족에서 빠져도 통과한다). 오라클을 바깥에 세운다 — 기대 가족은
    // 분류 체계에서 **손으로** 적고(정식 행 + 같은 taxonomy code를 쓰는 카탈로그 퀵타일 id),
    // 관측 가족은 모듈이 그린 문장에서 되짚는다(아래 observedFamilyIds — 칩 모듈을 부르지 않는다).
    expect(observedFamilyIds(CANONICAL_DIAPER.id)).toEqual([CANONICAL_DIAPER.id, DIAPER_TILE_ID].sort());
    expect(observedFamilyIds(CANONICAL_FEEDING.id)).toEqual([CANONICAL_FEEDING.id, ...FEEDING_TILE_IDS].sort());
    // 코드 다리가 없는 분류(카탈로그에 insurance_savings 없음)는 자기 id 하나다 — 같은 규칙이
    // 낸 다른 답이다. 예산 없는 카테고리("cat-unrelated")는 어느 가족에도 없다(위 셋 전부).
    expect(observedFamilyIds(HIDDEN_INSURANCE.id)).toEqual([HIDDEN_INSURANCE.id]);
  });

  it("합류 규칙의 원천이 칩 대장 하나다 — 새 매핑 코드 0건 (§5.1, 구조 계약)", () => {
    // 이 단언은 **구조**만 본다(위 오라클과 역할이 다르다): 사용액을 접는 규칙이 이 모듈에
    // 두 번째로 적히지 않았다는 것.
    expect(moduleSource()).toContain('from "../expenses/records-list-view"');
    expect(moduleSource()).toContain("buildRecordsCategoryChips");
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

/**
 * 라운드 106 T4 — 라운드 103 리뷰 M-2의 **가구 스코프 판단**을 값으로 고정한다.
 *
 * 예산 화면(src/expenses/category-budget-form.ts)은 소유자 축 인자를 넘겨 다른 가구의 커스텀
 * 분류를 행에서 뺀다. 이 모듈은 넘기지 않는다 — "일관성"이 아니라 **모집단이 다르기 때문**이다:
 * 폼의 행은 칩 대장이 낳고(남의 가구 칩 = 저장하면 400이 나는 빈 제안), 이 모듈의 행은
 * `budgets`(서버가 이미 그 아이의 가구로 좁혀 내려준 그 달의 예산 행)가 낳는다.
 *
 * 아래 셋은 그 판단이 **관측 가능한 사실**로 무엇인지를 적는다: 행은 소유 가구와 무관하게 서고,
 * 이름과 사용액은 합집합 전량에서 나오며, 두 호출부는 좁히는 인자를 받지 않는다.
 */
describe("가구 스코프 — 행은 budgets가 낳는다 (라운드 103 M-2 · 라운드 106 T4 재확인)", () => {
  const OWN_CUSTOM = {
    id: "cat-custom-own",
    code: "custom_own",
    name: "산후도우미",
    selectable: true,
    active: true,
    householdId: "hh-a"
  };
  // 설계 §6.6 R9(수용·기록): 두 가구가 **같은 이름**의 커스텀을 각각 가지면 동명 접기가 하나로
  // 접는다. 입력에서 남의 가구 행을 앞에 두어 그 접기가 실제로 일어나게 한다.
  const OTHER_CUSTOM_SAME_NAME = {
    id: "cat-custom-other",
    code: "custom_other",
    name: "산후도우미",
    selectable: true,
    active: true,
    householdId: "hh-b"
  };
  const OTHER_CUSTOM = {
    id: "cat-custom-other-2",
    code: "custom_other_2",
    name: "베이비시터",
    selectable: true,
    active: true,
    householdId: "hh-b"
  };
  const MULTI_HOUSEHOLD_CATEGORIES = [
    CANONICAL_DIAPER,
    CANONICAL_FEEDING,
    OTHER_CUSTOM_SAME_NAME,
    OWN_CUSTOM,
    OTHER_CUSTOM
  ];

  it("두 가구에 같은 이름의 커스텀이 있어도 자기 가구 예산 행의 이름·사용액이 온전하다 (§6.6 R9)", () => {
    const rows = buildCategoryBudgetUsageRows({
      budgets: [
        { categoryId: OWN_CUSTOM.id, amountKrw: 50_000 },
        { categoryId: CANONICAL_DIAPER.id, amountKrw: 100_000 }
      ],
      breakdown: [
        { categoryId: OWN_CUSTOM.id, amountKrw: 7_000 },
        { categoryId: CANONICAL_DIAPER.id, amountKrw: 30_000 }
      ],
      categories: MULTI_HOUSEHOLD_CATEGORIES
    });
    // 이름은 합집합 전량의 해석에서 온다 — 남의 가구 동명 행에 접혀도 "산후도우미"를 잃지 않는다.
    const own = rows.find((row) => row.categoryId === OWN_CUSTOM.id);
    expect(own?.primaryText).toBe("산후도우미 7,000원 / 예산 50,000원");
    expect(own?.secondaryText).toBe("예산의 14%를 썼어요");
    // 같은 달의 다른 행도 그대로다(한 행의 소유 축이 옆 행을 흔들지 않는다).
    expect(rows.find((row) => row.categoryId === CANONICAL_DIAPER.id)?.primaryText).toBe(
      "기저귀/위생 30,000원 / 예산 100,000원"
    );
  });

  it("남의 가구가 소유한 분류에 예산 행이 남아 있어도 행은 그려진다 — 사용자가 정한 사실을 감추지 않는다", () => {
    // 서버 검증이 예산을 그 가구로 좁히므로 실사용에서는 드문 조합이지만(설계 §5의 그 표),
    // **행을 만드는 자가 budgets 하나**라는 것이 이 단언의 내용이다. 여기서 예산을 소유 축으로
    // 거르는 순간 사용자가 실제로 정해 둔 기준선이 화면에서 사라진다(라운드 28 F3의 그 자리).
    const rows = buildCategoryBudgetUsageRows({
      budgets: [{ categoryId: OTHER_CUSTOM.id, amountKrw: 40_000 }],
      breakdown: [{ categoryId: OTHER_CUSTOM.id, amountKrw: 9_000 }],
      categories: MULTI_HOUSEHOLD_CATEGORIES
    });
    expect(rows.map((row) => row.categoryId)).toEqual([OTHER_CUSTOM.id]);
    expect(rows[0].primaryText).toBe("베이비시터 9,000원 / 예산 40,000원");
  });

  it("두 호출부가 좁히는 인자를 받지 않는다 — 예산 화면과 다른 판단이고 근거가 소스에 있다 (호출 모양 계약)", () => {
    // ⚠️ 이 단언을 빨갛게 만드는 변경("일관성"으로 소유자 축 인자를 넘기기)은 **버그 수정이
    // 아니다**. 라운드 106 T4가 다가구 픽스처로 잰 값: 좁힌 판과 오늘 판의 행 집합·이름·사용액이
    // 같았고, 달라진 것은 위 R9 상황의 행 **순서** 하나뿐이었다. 그래도 넘기려면 (1) 이름 해석과
    // 동명 흡수는 합집합 전량이 전제라는 것(records-list-view의 그 주석), (2) 예산 행 자체를
    // 거르지 않는다는 것을 함께 증명하고 이 테스트를 의도적으로 고쳐라.
    const src = moduleSource();
    expect(src).toContain("selectableCategories(categories)");
    expect(src).toContain("buildRecordsCategoryChips(categories).filter(");
    expect(src).toContain("buildRecordsCategoryChips(categories, categoryId)");
    expect(src).not.toContain("householdScopeId");
    // 무인자 호출은 주석 없이는 다음 사람에게 "빠뜨린 자리"로 읽힌다 — 근거가 같은 파일에 있다.
    expect(src).toContain("라운드 103 리뷰 M-2");
  });
});
