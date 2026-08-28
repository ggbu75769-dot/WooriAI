import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cumulativeTotalPendingNoticeText } from "../home/cumulative-total";
import { buildMonthlyInsight, partialMonthRangeLine, type MonthlyInsight, type MonthlyInsightCategory } from "./monthly-insight";
import { reportPendingScopeNoticeText } from "./pending-scope-notice";
import {
  buildMonthlyShareMessage,
  joinShareLines,
  monthlySharePendingLine,
  SHARE_APP_LINE,
  shareTopCategoryLine,
  shareTotalLine
} from "./share-text";

const categoryLabel = (categoryId: string) =>
  ({ "cat-diaper": "기저귀/위생", "cat-feed": "수유/이유식", "cat-cloth": "의류" })[categoryId] ?? "기타";

const DEFAULT_CATEGORY_TOP: MonthlyInsightCategory[] = [
  { categoryId: "cat-diaper", amountKrw: 400_000 },
  { categoryId: "cat-feed", amountKrw: 300_000 },
  { categoryId: "cat-cloth", amountKrw: 300_000 }
];

/**
 * 월간 요약 공유는 화면이 그린 인사이트를 그대로 싣는다. 그래서 테스트도 문장을 손으로
 * 짓지 않고 `buildMonthlyInsight`를 그대로 돌려(화면과 같은 경로) 그 결과를 넘긴다 --
 * 인사이트 문구가 바뀌면 공유 문구도 자동으로 따라간다(DNC-013/015).
 */
function insightFor(overrides: {
  yearMonth: string;
  todayIso: string;
  totalExpenseKrw: number;
  budgetAmountKrw?: number | null;
  previousMonthTotalKrw?: number | null;
  /** 리포트 탭 콜드 진입에서 categories 쿼리가 늦거나 실패하면 화면이 넘기는 값(undefined). */
  categoryTop?: readonly MonthlyInsightCategory[] | null;
}) {
  return buildMonthlyInsight({
    yearMonth: overrides.yearMonth,
    todayIso: overrides.todayIso,
    totalExpenseKrw: overrides.totalExpenseKrw,
    budgetAmountKrw: overrides.budgetAmountKrw ?? null,
    categoryTop: "categoryTop" in overrides ? overrides.categoryTop : DEFAULT_CATEGORY_TOP,
    categoryLabel,
    previousMonthTotalKrw: overrides.previousMonthTotalKrw ?? null
  });
}

describe("UX-H 공유 문구 조각", () => {
  it("금액 줄은 앱 전역 포맷(formatKrw)을 그대로 쓴다", () => {
    expect(shareTotalLine(1_245_700)).toBe("함께한 지출 1,245,700원");
    expect(shareTotalLine(0)).toBe("함께한 지출 0원");
    expect(shareTotalLine(1_245_700)).not.toContain("₩");
  });

  it("카테고리 줄은 '·'로 잇고, 이름이 없으면 줄 자체를 만들지 않는다", () => {
    expect(shareTopCategoryLine(["기저귀/위생"])).toBe("가장 많이 준비한 것: 기저귀/위생");
    expect(shareTopCategoryLine(["기저귀/위생", "수유/이유식"])).toBe("가장 많이 준비한 것: 기저귀/위생·수유/이유식");
    expect(shareTopCategoryLine([])).toBeNull();
    expect(shareTopCategoryLine(["", "  "])).toBeNull();
  });

  // 라운드 36 F-5로 구간 줄 조립기는 monthly-insight.ts로 옮겼다(인사이트가 유일한 소스).
  // 공유 카드의 줄이므로 계약은 계속 여기서 지킨다.
  it("진행 중인 달의 구간 줄은 오늘까지를 명시한다", () => {
    expect(partialMonthRangeLine("2026-08", "2026-08-27")).toBe("8월 1일~27일 기준");
    // 달의 첫날이면 하루치라는 사실이 그대로 드러난다.
    expect(partialMonthRangeLine("2026-08", "2026-08-01")).toBe("8월 1일~1일 기준");
    // 보고 있는 달이 오늘의 달이 아니면 구간 줄이 없다(머리글의 달 이름이 곧 구간).
    expect(partialMonthRangeLine("2026-07", "2026-08-27")).toBeNull();
    expect(partialMonthRangeLine("2026-8", "2026-08-27")).toBeNull();
    expect(partialMonthRangeLine("2026-08", "2026-08")).toBeNull();
  });

  it("빈 줄은 걸러 내고 개행으로 잇는다", () => {
    expect(joinShareLines(["a", null, "b", undefined, "   ", "c"])).toBe("a\nb\nc");
    expect(joinShareLines([null, undefined])).toBe("");
  });
});

describe("UX-H 월간 요약 공유 문구", () => {
  it("진행 중인 달은 '8월 1일~27일 기준'을 금액 바로 아래에 밝힌다", () => {
    const insight = insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 });
    const message = buildMonthlyShareMessage({
      monthLabel: "2026년 8월",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight,
      pending: null
    });

    expect(message).not.toBeNull();
    expect(message!.split("\n")).toEqual([
      "📊 다온이의 2026년 8월",
      "함께한 지출 1,000,000원",
      "8월 1일~27일 기준",
      insight!.headline,
      SHARE_APP_LINE
    ]);
  });

  it("이미 끝난 달에는 구간 줄을 붙이지 않는다 (머리글의 달 이름이 곧 구간)", () => {
    const insight = insightFor({
      yearMonth: "2026-07",
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_000_000,
      previousMonthTotalKrw: 1_200_000
    });
    const message = buildMonthlyShareMessage({
      monthLabel: "2026년 7월",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight,
      pending: null
    });

    expect(message).not.toBeNull();
    expect(message).not.toContain("기준");
    expect(message!.split("\n")).toEqual([
      "📊 다온이의 2026년 7월",
      "함께한 지출 1,000,000원",
      insight!.headline,
      SHARE_APP_LINE
    ]);
  });

  it("금액은 화면이 그린 총액을 그대로 쓰고 formatKrw 포맷을 지킨다", () => {
    const message = buildMonthlyShareMessage({
      monthLabel: "2026년 8월",
      childName: "다온이",
      totalExpenseKrw: 1_245_700,
      insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_245_700 }),
      pending: null
    });

    expect(message).toContain("함께한 지출 1,245,700원");
    expect(message).not.toContain("₩");
    expect(message).not.toContain("1245700");
  });

  it("화면 카드의 카테고리 1위 문장만 싣는다 -- 예산·하루 평균은 가족에게 보내는 카드에 얹지 않는다", () => {
    const insight = insightFor({
      yearMonth: "2026-08",
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_000_000,
      budgetAmountKrw: 1_500_000
    });
    // 화면 카드는 두 문장이다(카테고리 1위 + 예산·하루 평균).
    expect(insight!.detail).not.toBeNull();

    const message = buildMonthlyShareMessage({
      monthLabel: "2026년 8월",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight,
      pending: null
    });

    expect(message).toContain(insight!.shareableHeadline!);
    expect(message).not.toContain(insight!.detail!);
    expect(message).not.toContain("예산");
    expect(message!.split("\n")).toHaveLength(5);
  });

  /**
   * 라운드 36 F-1: 리포트 탭 콜드 진입에서 categories 쿼리가 늦거나 실패하면 화면은
   * `categoryTop: undefined`로 인사이트를 만든다. 그러면 카테고리 1위 문장이 사라지고
   * **예산·하루 평균 문장이 headline 자리로 올라온다** -- 예전 조립기는 headline을 맹목적으로
   * 실어 "예산의 67%를 썼고, 하루 평균 37,037원이에요"를 가족 단톡방으로 내보냈다.
   * 공유 문구에는 예산 달성률도 하루 평균도 **어떤 경로로도** 실리지 않는다.
   */
  it("F-1: 카테고리 분해가 없으면 예산·하루 평균이 headline 자리로 올라와도 공유되지 않는다", () => {
    for (const categoryTop of [undefined, []] as const) {
      const insight = insightFor({
        yearMonth: "2026-08",
        todayIso: "2026-08-27",
        totalExpenseKrw: 1_000_000,
        budgetAmountKrw: 1_500_000,
        categoryTop
      });

      // 화면 카드는 여전히 그려진다 -- 다만 첫 문장이 예산 문장이다(공유하면 안 되는 문장).
      expect(insight, String(categoryTop)).not.toBeNull();
      expect(insight!.headline).toContain("예산");
      expect(insight!.shareableHeadline).toBeNull();

      const message = buildMonthlyShareMessage({
        monthLabel: "2026년 8월",
        childName: "다온이",
        totalExpenseKrw: 1_000_000,
        insight,
        pending: null
      })!;

      expect(message, String(categoryTop)).not.toContain("예산");
      expect(message, String(categoryTop)).not.toContain("하루 평균");
      expect(message).not.toContain(insight!.headline);
      // 근거 없는 문장 줄을 지어내지도 않는다 -- 그 줄만 빠진 네 줄 카드.
      expect(message.split("\n")).toEqual([
        "📊 다온이의 2026년 8월",
        "함께한 지출 1,000,000원",
        "8월 1일~27일 기준",
        SHARE_APP_LINE
      ]);
    }
  });

  /**
   * 라운드 36 F-5: 구간 줄과 monthStatus가 어긋난 인사이트(두 소스 시절의 사고 형태)를 만나면
   * 줄 하나를 조용히 빼는 대신 공유 자체를 접는다 -- 27일치 부분 합계가 한 달치처럼 나가는
   * 것보다 공유 버튼이 안 붙는 편이 안전하다.
   */
  it("F-5: 진행 중인 달인데 구간 줄이 없는 인사이트는 아예 공유하지 않는다", () => {
    const sound = insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 })!;
    expect(sound.partialRangeLine).toBe("8월 1일~27일 기준");

    const mismatched: MonthlyInsight = { ...sound, partialRangeLine: null };
    expect(
      buildMonthlyShareMessage({
        monthLabel: "2026년 8월",
        childName: "다온이",
        totalExpenseKrw: 1_000_000,
        insight: mismatched,
        pending: null
      })
    ).toBeNull();

    // 끝난 달은 구간 줄이 없는 것이 정상이라 그대로 공유된다.
    const complete = insightFor({
      yearMonth: "2026-07",
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_000_000,
      previousMonthTotalKrw: 1_200_000
    })!;
    expect(complete.partialRangeLine).toBeNull();
    expect(
      buildMonthlyShareMessage({
        monthLabel: "2026년 7월",
        childName: "다온이",
        totalExpenseKrw: 1_000_000,
        insight: complete,
        pending: null
      })
    ).not.toBeNull();
  });

  it("말할 근거가 없으면(인사이트 없음·총액 0원) null이라 공유 버튼도 붙지 않는다", () => {
    const base = { monthLabel: "2026년 8월", childName: "다온이" };

    expect(buildMonthlyShareMessage({ ...base, totalExpenseKrw: 1_000_000, insight: null, pending: null })).toBeNull();
    expect(
      buildMonthlyShareMessage({
        ...base,
        totalExpenseKrw: 0,
        insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 }),
        pending: null
      })
    ).toBeNull();
  });

  it("앱 홍보는 마지막 한 줄뿐이고, 식별 정보는 넘긴 아이 이름 하나뿐이다", () => {
    const message = buildMonthlyShareMessage({
      monthLabel: "2026년 8월",
      childName: "콩콩이",
      totalExpenseKrw: 1_000_000,
      insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 }),
      pending: null
    });

    expect(message!.endsWith(SHARE_APP_LINE)).toBe(true);
    expect(message!.split("\n").filter((line) => line.includes("우리아이 앱"))).toHaveLength(1);
    expect(message).toContain("콩콩이");
    expect(message).not.toContain("@");
    expect(message).not.toContain("cat-diaper");
    expect(message).not.toMatch(/https?:\/\//);
  });

  /** DNC-018: 사실 서술만. 평가·조언·죄책감 문구가 공유 문구로 새 나가지 않는다. */
  it("keeps the tone factual -- no 칭찬/조언/죄책감 문구", () => {
    const message = buildMonthlyShareMessage({
      monthLabel: "2026년 8월",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 }),
      pending: null
    })!;

    for (const banned of ["잘하고 있어요", "줄여보세요", "아껴", "최고예요", "절약"]) {
      expect(message, banned).not.toContain(banned);
    }
  });
});

/**
 * GAP-064 #3 — **공유 문구의 대기 고지.**
 *
 * 라운드 63이 대기 고지를 화면 세 자리(홈 누적·홈 마일스톤 부제·리포트 누적)로 넓혔지만, 그
 * 숫자를 앱 밖으로 내보내는 이 경로만 지나치지 않았다. 보낸 사람은 화면에서 "3건은 아직 반영되지
 * 않았어요"를 봤는데 받는 사람이 받는 것은 그 3건이 빠진 금액뿐이었다 — 이 모듈이 구간 줄
 * ("8월 1일~27일 기준")로 이미 없앤 결함과 같은 모양이다.
 *
 * 여기서 고정하는 것은 셋이다: (1) 줄이 서는 **자리**, (2) 문구가 **한 벌**이라는 사실
 * (화면 고지·누적 카드와 지시어 하나만 다르다), (3) **대기 0건이면 종전과 바이트가 같다**.
 */
describe("GAP-064 #3 월간 공유 문구의 대기 고지", () => {
  const base = { monthLabel: "2026년 8월", childName: "다온이", totalExpenseKrw: 1_000_000 } as const;
  const inProgress = () => insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 });

  it("금액을 한정하는 자리에 선다 — 구간 줄 다음, 인사이트 문장 앞", () => {
    const insight = inProgress();
    const message = buildMonthlyShareMessage({ ...base, insight, pending: { count: 3, unsendableCount: 0 } });

    expect(message!.split("\n")).toEqual([
      "📊 다온이의 2026년 8월",
      "함께한 지출 1,000,000원",
      "8월 1일~27일 기준",
      "동기화 대기 중인 기록 3건은 이 금액에 아직 반영되지 않았어요.",
      insight!.headline,
      SHARE_APP_LINE
    ]);
  });

  it("구간 줄이 없는(이미 끝난) 달에는 금액 바로 아래에 선다", () => {
    const insight = insightFor({
      yearMonth: "2026-07",
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_000_000,
      previousMonthTotalKrw: 1_200_000
    });
    const message = buildMonthlyShareMessage({
      ...base,
      monthLabel: "2026년 7월",
      insight,
      pending: { count: 1, unsendableCount: 0 }
    });

    expect(message!.split("\n")).toEqual([
      "📊 다온이의 2026년 7월",
      "함께한 지출 1,000,000원",
      "동기화 대기 중인 기록 1건은 이 금액에 아직 반영되지 않았어요.",
      insight!.headline,
      SHARE_APP_LINE
    ]);
  });

  /**
   * 문구를 두 벌로 만들지 않는다. 화면 고지(`reportPendingScopeNoticeText` — "아래 숫자에")와
   * 이 줄은 **지시어 하나만** 다르고, 그 갈래를 이미 들고 있는 함수를 그대로 부른다
   * (src/home/cumulative-total.ts의 같은 계약과 같은 모양의 검산이다).
   */
  it("문구는 화면 고지와 한 벌이다 — 지시어만 '아래 숫자에' → '이 금액에'", () => {
    for (const [count, unsendableCount] of [
      [1, 0],
      [3, 0],
      [5, 2],
      [2, 2]
    ] as const) {
      const line = monthlySharePendingLine({ count, unsendableCount });

      expect(line, `${count}/${unsendableCount}`).toBe(cumulativeTotalPendingNoticeText(count, unsendableCount));
      expect(line).toBe(reportPendingScopeNoticeText(count, unsendableCount).replace("아래 숫자에", "이 금액에"));
      // 세게 말하지 않는다: 이 모집단에는 삭제 대기 행(금액에 아직 들어 있다)이 섞인다.
      expect(line).toContain("아직 반영되지 않았어요");
      expect(line).not.toContain("빠져 있어요");
    }
  });

  it("영구 실패가 섞이면 주어의 '동기화 대기' 수식이 떨어지고 뒷문장이 붙는다", () => {
    const message = buildMonthlyShareMessage({ ...base, insight: inProgress(), pending: { count: 5, unsendableCount: 2 } })!;

    expect(message).toContain("기록 5건은 이 금액에 아직 반영되지 않았어요. 그중 2건은 보낼 수 없는 기록이에요.");
    expect(message).not.toContain("동기화 대기 중인 기록 5건");
  });

  /**
   * **대다수 경로의 계약**: 대기가 없으면 공유 문구는 라운드 63까지와 **바이트가 같다**.
   * (`null` = 셀 수 없음/비세션, `count: 0` = 세어 봤더니 0건 — 둘 다 줄이 없다.)
   */
  it("대기 0건이면 종전 문자열과 바이트가 같다", () => {
    const insight = inProgress();
    const previous = [
      "📊 다온이의 2026년 8월",
      "함께한 지출 1,000,000원",
      "8월 1일~27일 기준",
      insight!.headline,
      SHARE_APP_LINE
    ].join("\n");

    for (const pending of [null, { count: 0, unsendableCount: 0 }] as const) {
      expect(buildMonthlyShareMessage({ ...base, insight, pending }), String(pending)).toBe(previous);
    }
    expect(monthlySharePendingLine(null)).toBeNull();
    expect(monthlySharePendingLine({ count: 0, unsendableCount: 0 })).toBeNull();
  });

  /**
   * 공유를 접는 조건은 늘지 않는다. 구간 줄은 **말할 수 없는** 사실이라 빠지면 공유 자체를
   * 접었지만(F-5), 대기 건수는 **말할 수 있는** 사실이다 — 말할 수 있는 것을 이유로 공유를
   * 막는 것은 과하다. 반대로 F-5의 fail-safe는 대기가 있어도 그대로 작동한다.
   */
  it("대기가 있다고 공유를 접지 않는다 (F-5 fail-safe는 그대로)", () => {
    expect(buildMonthlyShareMessage({ ...base, insight: inProgress(), pending: { count: 9, unsendableCount: 9 } })).not.toBeNull();

    const mismatched: MonthlyInsight = { ...inProgress()!, partialRangeLine: null };
    expect(buildMonthlyShareMessage({ ...base, insight: mismatched, pending: { count: 3, unsendableCount: 0 } })).toBeNull();
  });

  /** 카드에 실리는 것은 **건수 두 개**뿐이다 — 대기 행의 품목·금액·날짜·id는 입력에 없다. */
  it("대기 고지가 새로 싣는 식별 정보는 없다", () => {
    const message = buildMonthlyShareMessage({
      ...base,
      childName: "콩콩이",
      insight: inProgress(),
      pending: { count: 3, unsendableCount: 1 }
    })!;

    expect(message).not.toMatch(/https?:\/\//);
    expect(message).not.toContain("@");
    expect(message).not.toContain("cat-diaper");
    // 건수 말고 다른 숫자가 대기 줄에 실리지 않는다.
    const pendingLine = message.split("\n").find((line) => line.includes("반영되지 않았어요"))!;
    expect(pendingLine.match(/\d+/g)).toEqual(["3", "1"]);
  });

  /** 이 모듈은 세지 않는다 — 건수는 화면 고지가 이미 센 값 하나다(집계 규칙이 두 벌이 되지 않게). */
  it("건수를 다시 세지 않는다 — 오프라인 행을 입력으로 받지 않는다", () => {
    const shareTextSource = readFileSync(join(process.cwd(), "src/reports/share-text.ts"), "utf8");

    expect(shareTextSource).toContain('import type { PendingScopeBreakdown } from "./pending-scope-notice"');
    expect(shareTextSource).not.toContain("evaluateReportPendingScopeNotice");
    expect(shareTextSource).not.toContain("syncState");
    // 문구도 조각에서 다시 조립하지 않는다(offline/messages.ts를 직접 읽는 순간 세 번째 벌이 된다).
    expect(shareTextSource).toContain('import { cumulativeTotalPendingNoticeText } from "../home/cumulative-total"');
    expect(shareTextSource).not.toContain("SYNC_ROW_PENDING_LABEL");
    expect(shareTextSource).not.toContain("recordsCountPhrase");
  });
});
