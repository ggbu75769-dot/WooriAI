import { describe, expect, it } from "vitest";
import { computeCategoryShares } from "./category-share";
import { buildMonthlyInsight } from "./monthly-insight";
import { buildPeriodInsight } from "./period-insight";
import { buildMonthlyShareMessage } from "./share-text";

/**
 * `percentLabel` **소비 자리 전수** — 한 라벨이 실제로 도달하는 모든 곳을 한 파일에서 값으로 센다.
 *
 * 왜 새 파일인가: category-share.test.ts는 조립기 자체의 계약을 지키고, 각 소비 모듈의 테스트는
 * 자기 문장을 지킨다. 그런데 이번에 바뀐 것은 **한 문자열이 네 자리로 퍼지는 방식**이라, 그
 * 퍼짐 자체를 한 자리에서 못 박아야 다음 사람이 라벨 규칙을 손댈 때 어디까지 흔들리는지 보인다.
 *
 * 세어 본 자리는 넷이고, 그중 **하나는 앱 밖으로 나간다**:
 *  ① 범례 줄의 퍼센트 텍스트            — src/ui.tsx `DonutChartCard` `{slice.percentLabel}`
 *  ② 범례 줄의 낭독 라벨                 — 같은 파일 `accessibilityLabel={`${slice.label}, ${slice.percentLabel}, …`}`
 *                                          (①②의 문자열 형태는 a11y-contract.test.ts ·
 *                                           design-foundation.test.ts가 소스에서 고정한다)
 *  ③ 인사이트 문장(월간·분기/연간)       — "… 가장 많이 썼어요 (3,000,000원 · 전체의 99%)"
 *  ④ **공유 문구** — ③의 월간 문장이 `MonthlyInsight.shareableHeadline`으로 태그돼
 *     `buildMonthlyShareMessage`를 지나 `app/(tabs)/reports.tsx`의 `Share.share({ message })`로
 *     **OS 공유 시트에 실린다**(카카오톡·문자 등 앱 밖). 아래 ④가 그 최종 바이트를 통째로 고정한다.
 *
 * ⚠️ 두 시점 (라벨 100% 캡).
 * 종전(그때는 참): 조리원 3,000,000 + 편의점 2,000인 달에서 네 자리가 모두 "100%"라고 적었다.
 * 그것은 이 조합을 의도로 단언해 둔 규칙의 결과였고(category-share.test.ts), 모듈의 계약 문장이
 * 0% 쪽만 말했기 때문에 100 쪽은 아무도 보지 않았다.
 * → 이제 네 자리가 모두 "99%"다. `percent`는 여전히 [100, 0]이고 합계도 정확히 100이다 —
 *   바뀐 것은 표기 한 자리이고, 그 한 자리가 네 곳으로 퍼진다는 것이 이 파일의 요지다.
 */

/** 조리원 3,000,000 + 편의점 2,000 — 정찰이 짚은 흔한 한 달. */
const 조리원달 = [
  { label: "출산/산후조리", amountKrw: 3_000_000 },
  { label: "식비/간식", amountKrw: 2_000 }
];
const 조리원달총액 = 3_002_000;

describe("percentLabel 소비 자리 전수 (조리원 3,000,000 + 편의점 2,000)", () => {
  it("①② 범례가 읽는 값 — 두 줄이 100을 넘겨 읽히지 않는다", () => {
    const slices = computeCategoryShares(조리원달);

    // 계산은 종전 그대로다(고칠 대상이 라벨이었다는 근거).
    expect(slices.map((slice) => slice.percent)).toEqual([100, 0]);
    expect(slices[0].percent + slices[1].percent).toBe(100);

    // 범례 텍스트(①)와 낭독 라벨(②)이 쓰는 문자열은 이 하나뿐이다.
    expect(slices.map((slice) => slice.percentLabel)).toEqual(["99%", "<1%"]);

    // ② 낭독 문장을 화면과 같은 모양으로 조립해 본다("출산/산후조리, 99%, 3,000,000원").
    expect(`${slices[0].label}, ${slices[0].percentLabel}`).toBe("출산/산후조리, 99%");
  });

  it("③ 월간 인사이트 문장 — 한 카테고리가 '전부'라고 말하지 않는다", () => {
    const insight = buildMonthlyInsight({
      yearMonth: "2025-08",
      todayIso: "2025-09-01",
      totalExpenseKrw: 조리원달총액,
      budgetAmountKrw: null,
      categoryTop: [
        { categoryId: "birth", amountKrw: 3_000_000 },
        { categoryId: "food", amountKrw: 2_000 }
      ],
      categoryLabel: (categoryId) => (categoryId === "birth" ? "출산/산후조리" : "식비/간식"),
      previousMonthTotalKrw: null
    });

    expect(insight?.headline).toBe("8월은 출산/산후조리에 가장 많이 썼어요 (3,000,000원 · 전체의 99%)");
    expect(insight?.headline).not.toContain("전체의 100%");
  });

  it("③ 분기/연간 인사이트 문장도 같은 라벨 한 벌을 쓴다", () => {
    const insight = buildPeriodInsight({
      unit: "quarter",
      periodLabel: "2026년 3분기",
      totalExpenseKrw: 조리원달총액,
      segments: 조리원달
    });

    expect(insight?.headline).toBe("2026년 3분기에는 출산/산후조리에 가장 많이 썼어요 (3,000,000원 · 전체의 99%)");
    expect(insight?.topCategoryPercentLabel).toBe("99%");
  });

  it("④ 앱 밖으로 나가는 공유 문구 — Share.share가 싣는 바이트 전체", () => {
    const insight = buildMonthlyInsight({
      yearMonth: "2025-08",
      todayIso: "2025-09-01",
      totalExpenseKrw: 조리원달총액,
      budgetAmountKrw: null,
      categoryTop: [
        { categoryId: "birth", amountKrw: 3_000_000 },
        { categoryId: "food", amountKrw: 2_000 }
      ],
      categoryLabel: (categoryId) => (categoryId === "birth" ? "출산/산후조리" : "식비/간식"),
      previousMonthTotalKrw: null
    });

    const message = buildMonthlyShareMessage({
      monthLabel: "2025년 8월",
      childName: "다온이",
      totalExpenseKrw: 조리원달총액,
      insight,
      pending: null
    });

    expect(message).toBe(
      [
        "📊 다온이의 2025년 8월",
        "함께한 지출 3,002,000원",
        "8월은 출산/산후조리에 가장 많이 썼어요 (3,000,000원 · 전체의 99%)",
        "— 우리아이 앱에서"
      ].join("\n")
    );
    // 종전에는 이 줄이 "… · 전체의 100%)"로 나갔다 — 받는 사람은 3,002,000원 중 2,000원이
    // 다른 카테고리에 있다는 사실을 알 길이 없었다.
    expect(message).not.toContain("전체의 100%");
  });

  it("정말로 한 카테고리뿐인 달은 네 자리 모두 종전 그대로 '100%'다", () => {
    const slices = computeCategoryShares([{ label: "출산/산후조리", amountKrw: 3_000_000 }]);
    expect(slices.map((slice) => slice.percentLabel)).toEqual(["100%"]);

    const insight = buildMonthlyInsight({
      yearMonth: "2025-08",
      todayIso: "2025-09-01",
      totalExpenseKrw: 3_000_000,
      budgetAmountKrw: null,
      categoryTop: [{ categoryId: "birth", amountKrw: 3_000_000 }],
      categoryLabel: () => "출산/산후조리",
      previousMonthTotalKrw: null
    });
    expect(insight?.headline).toBe("8월은 출산/산후조리에 가장 많이 썼어요 (3,000,000원 · 전체의 100%)");

    const message = buildMonthlyShareMessage({
      monthLabel: "2025년 8월",
      childName: "다온이",
      totalExpenseKrw: 3_000_000,
      insight,
      pending: null
    });
    expect(message).toContain("전체의 100%)");
  });
});
