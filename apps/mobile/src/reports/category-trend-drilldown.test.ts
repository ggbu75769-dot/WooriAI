import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RECORDS_MONTH_PARAM } from "../expenses/import-landing-month";
import { theme } from "../theme";
import {
  RECORDS_DRILLDOWN_NONCE_PARAM,
  RECORDS_TAB_PATHNAME
} from "./category-drilldown";
import {
  buildCategoryTrendMonthDrilldownTarget,
  categoryTrendBarDrilldownLabel
} from "./category-trend-drilldown";

/**
 * 라운드 100 트랙 T5 — 카테고리 추이 막대 → 기록 드릴다운.
 *
 * 기능 라운드 1 트랙 C가 이월한 후속("C 후속 — 기존 드릴다운 파라미터 규약 확장 필요")의 계약.
 * 확장은 **보내는 쪽뿐**이다: 기록 탭이 받는 삼요소 한 묶음(month·categoryId·drilldown 회차 —
 * 라운드 52 QA P1-1/P2-1)은 한 글자도 바뀌지 않고, 수신 규칙은 category-drilldown.test.ts의
 * 기존 계약이 계속 진다. (readFileSync 소스 계약 관례는 report-trust-drilldown-flow.test.ts와
 * 같다 — 리포트 탭은 vitest에서 렌더되지 않는다.)
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const TODAY = "2026-09-06";

describe("buildCategoryTrendMonthDrilldownTarget — 막대의 달로 착지하는 기존 규약 링크", () => {
  it("과거 달 막대는 정확히 그 달로 착지한다 (기존 삼요소 규약 그대로)", () => {
    const target = buildCategoryTrendMonthDrilldownTarget({
      yearMonth: "2026-03",
      categoryId: "cat-diaper",
      nonce: 7,
      todayIso: TODAY
    });
    expect(target).toEqual({
      pathname: RECORDS_TAB_PATHNAME,
      params: {
        [RECORDS_MONTH_PARAM]: "2026-03",
        categoryId: "cat-diaper",
        [RECORDS_DRILLDOWN_NONCE_PARAM]: "7"
      }
    });
    // 파라미터는 기록 탭이 이미 받는 세 키뿐이다 — 규약 확장이 아니라 재사용이다.
    expect(Object.keys(target!.params).sort()).toEqual(
      [RECORDS_MONTH_PARAM, "categoryId", RECORDS_DRILLDOWN_NONCE_PARAM].sort()
    );
  });

  it("보고 있는 달(창의 마지막 막대)도 그 달 자신이다", () => {
    const target = buildCategoryTrendMonthDrilldownTarget({
      yearMonth: "2026-09",
      categoryId: "cat-diaper",
      nonce: 1,
      todayIso: TODAY
    });
    expect(target?.params[RECORDS_MONTH_PARAM]).toBe("2026-09");
  });

  it("해를 넘는 창의 앞해 막대도 어림짐작 없이 그 달이다 (클램프가 기간 안을 지킨다)", () => {
    const target = buildCategoryTrendMonthDrilldownTarget({
      yearMonth: "2025-11",
      categoryId: "cat-diaper",
      nonce: 2,
      todayIso: TODAY
    });
    expect(target?.params[RECORDS_MONTH_PARAM]).toBe("2025-11");
  });

  it("같은 막대를 다시 눌러도 회차가 다르면 링크가 달라진다 (재적용의 유일한 근거 — 도넛과 동일)", () => {
    const base = { yearMonth: "2026-05", categoryId: "cat-diaper", todayIso: TODAY };
    const first = buildCategoryTrendMonthDrilldownTarget({ ...base, nonce: 1 })!;
    const second = buildCategoryTrendMonthDrilldownTarget({ ...base, nonce: 2 })!;
    expect(second.params[RECORDS_MONTH_PARAM]).toBe(first.params[RECORDS_MONTH_PARAM]);
    expect(second.params.categoryId).toBe(first.params.categoryId);
    expect(second.params[RECORDS_DRILLDOWN_NONCE_PARAM]).not.toBe(first.params[RECORDS_DRILLDOWN_NONCE_PARAM]);
  });

  it("말이 되지 않는 값이면 링크를 만들지 않는다 (기존 빌더의 방어를 그대로 지난다)", () => {
    const good = { yearMonth: "2026-05", categoryId: "cat-diaper", nonce: 1, todayIso: TODAY };
    expect(buildCategoryTrendMonthDrilldownTarget({ ...good, categoryId: null })).toBeNull();
    expect(buildCategoryTrendMonthDrilldownTarget({ ...good, categoryId: "잘못된 id!" })).toBeNull();
    expect(buildCategoryTrendMonthDrilldownTarget({ ...good, nonce: -1 })).toBeNull();
    expect(buildCategoryTrendMonthDrilldownTarget({ ...good, nonce: 1.5 })).toBeNull();
    expect(buildCategoryTrendMonthDrilldownTarget({ ...good, yearMonth: "2026-5" })).toBeNull();
    expect(buildCategoryTrendMonthDrilldownTarget({ ...good, todayIso: "오늘" })).toBeNull();
  });

  it("링크 규약은 두 벌이 아니다 — 이 모듈은 기존 빌더를 부를 뿐, 파라미터 키를 다시 적지 않는다", () => {
    const moduleSource = source("src/reports/category-trend-drilldown.ts");
    expect(moduleSource).toContain("buildCategoryDrilldownTarget({");
    expect(moduleSource).toContain("monthCount: 1,");
    // 키 이름 리터럴이 이 파일에 다시 태어나지 않는다(P3-6의 이중 소스 금지 그대로).
    expect(moduleSource).not.toContain('"month"');
    expect(moduleSource).not.toContain('"drilldown"');
  });
});

describe("categoryTrendBarDrilldownLabel — 막대 버튼의 낭독 라벨", () => {
  it('기록 있는 달: "N월 {카테고리} X원, 기록 보기" (금액 표기는 낭독 계열과 같은 formatKrw)', () => {
    expect(
      categoryTrendBarDrilldownLabel({ monthLabel: "8월", amountKrw: 12_000, hasRecords: true }, "기저귀/위생")
    ).toBe("8월 기저귀/위생 12,000원, 기록 보기");
  });

  it("기록 있는 0원 달은 0원이라 말한다 (그 달의 정직한 사실)", () => {
    expect(
      categoryTrendBarDrilldownLabel({ monthLabel: "4월", amountKrw: 0, hasRecords: true }, "기저귀/위생")
    ).toBe("4월 기저귀/위생 0원, 기록 보기");
  });

  it('기록 자체가 없는 달은 0원 대신 "기록 없음" — 차트 낭독 계열·구분 문구와 같은 말', () => {
    expect(
      categoryTrendBarDrilldownLabel({ monthLabel: "3월", amountKrw: 0, hasRecords: false }, "기저귀/위생")
    ).toBe("3월 기저귀/위생 기록 없음, 기록 보기");
  });

  it("카테고리 라벨 뒤에 조사가 붙지 않는다 — 조사 유틸이 필요 없는 형태다", () => {
    // 받침 유무가 다른 두 라벨이 같은 틀에 그대로 들어간다("기록 보기" 앞은 공백 나열).
    for (const label of ["세제", "분유/유제품"]) {
      const spoken = categoryTrendBarDrilldownLabel({ monthLabel: "5월", amountKrw: 1_000, hasRecords: true }, label);
      expect(spoken).toBe(`5월 ${label} 1,000원, 기록 보기`);
    }
  });
});

describe("배선 계약 — 리포트 화면 (source contract)", () => {
  const reportSource = source("app/(tabs)/reports.tsx");
  /** 미니 차트 지역 컴포넌트 블록(정의부터 화면 컴포넌트 시작까지). */
  const chartBlock = () => {
    const start = reportSource.indexOf("function CategoryTrendMiniChart");
    const end = reportSource.indexOf("export default function ReportsScreen");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return reportSource.slice(start, end);
  };
  /** 발신 핸들러의 코드 줄만(주석 제외 — category-drilldown.test.ts의 관례 그대로). */
  const trendHandler = () => {
    const start = reportSource.indexOf("const openCategoryTrendMonthDrilldown");
    expect(start).toBeGreaterThan(-1);
    const end = reportSource.indexOf("\n  };", start);
    expect(end).toBeGreaterThan(start);
    return reportSource
      .slice(start, end)
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  };

  it("막대 기둥이 진짜 버튼이다 — 라벨은 순수 모듈, 힌트는 도넛과 같은 착지 월 문장", () => {
    const block = chartBlock();
    expect(block).toContain('accessibilityRole="button"');
    expect(block).toContain("accessibilityLabel={categoryTrendBarDrilldownLabel(bar, categoryLabel)}");
    // 착지 월의 연도는 힌트가 누르기 전에 말한다(창이 해를 넘으면 "11월"만으로는 모호하다).
    expect(block).toContain("accessibilityHint={categoryDrilldownHint(bar.yearMonth) ?? undefined}");
    expect(block).toContain("onPress={() => onSelectMonth(bar)}");
    // press 피드백은 이 화면의 기존 한 벌을 그대로 소비한다(토스급 T4).
    expect(block).toContain("pressed ? reportPressedFeedbackStyle : null");
    // 종전의 한 덩어리 accessible 차트는 버튼을 삼키므로 남아 있지 않다(UX-H의 그룹 규칙).
    expect(block).not.toMatch(/\n\s+accessible\n/);
  });

  it("발신은 도넛과 같은 카운터를 공유한다 — 별도 카운터 금지", () => {
    // 카운터 선언은 화면에 하나뿐이고, 그 카운터를 올리는 자리는 두 발신뿐이다.
    expect(reportSource.match(/const \[drilldownNonce, setDrilldownNonce\] = useState\(0\);/g) ?? []).toHaveLength(1);
    expect(reportSource.match(/setDrilldownNonce\(nonce\);/g) ?? []).toHaveLength(2);
    const handler = trendHandler();
    expect(handler).toContain("const nonce = drilldownNonce + 1;");
    expect(handler).toContain("buildCategoryTrendMonthDrilldownTarget({");
    expect(handler).toContain("todayIso: seoulToday");
    // 시계 금지 — 도넛 발신과 같은 이유(같은 밀리초의 두 번째 탭·테스트 고정값).
    expect(handler).not.toContain("Date.now()");
  });

  it("링크를 만들지 못한 탭은 회차를 올리지 않는다 (이동하지 않았으므로 — 도넛과 같은 순서)", () => {
    const handler = trendHandler();
    expect(handler.indexOf("if (!target) return;")).toBeGreaterThan(-1);
    expect(handler.indexOf("if (!target) return;")).toBeLessThan(handler.indexOf("setDrilldownNonce(nonce);"));
  });

  it("ready 뷰에서만, 고른 칩의 라벨로 배선된다", () => {
    expect(reportSource).toContain('from "../../src/reports/category-trend-drilldown"');
    expect(reportSource).toContain('categoryTrend.view?.kind === "ready" && selectedTrendChip ? (');
    expect(reportSource).toContain("categoryLabel={selectedTrendChip.label}");
    expect(reportSource).toContain("onSelectMonth={openCategoryTrendMonthDrilldown}");
  });

  it("터치 타깃: 기둥 몸이 행 높이 전체(≥ theme.touchTarget)를 받고, 맞붙은 이웃에 hitSlop을 겹치지 않는다", () => {
    // 세그먼트 탭과 같은 판정 — flex 등분으로 맞붙는 버튼은 가로 hitSlop이 이웃의 히트
    // 영역을 뺏을 뿐이라 0이고, 세로는 stretch가 행 높이를 기둥 전체에 준다.
    const block = chartBlock();
    expect(block).not.toContain("hitSlop");
    expect(reportSource).toContain('alignItems: "stretch"');
    const columnStyle = reportSource.slice(
      reportSource.indexOf("const reportCategoryTrendColumnStyle"),
      reportSource.indexOf("} as const;", reportSource.indexOf("const reportCategoryTrendColumnStyle"))
    );
    expect(columnStyle).toContain("flex: 1");
    // 행 높이 = 최대 막대(비율 1은 ready 뷰에 항상 있다) + 기둥 gap + 축 라벨 한 줄.
    const barArea = Number(/const CATEGORY_TREND_BAR_AREA_HEIGHT = (\d+);/.exec(reportSource)?.[1]);
    const columnGap = Number(/gap:\s*(\d+)/.exec(columnStyle)?.[1]);
    const axisStyle = reportSource.slice(reportSource.indexOf("const reportCategoryTrendAxisLabelStyle"));
    const axisLineHeight = Number(/lineHeight:\s*(\d+)/.exec(axisStyle)?.[1]);
    expect(barArea).toBe(64);
    expect(barArea + columnGap + axisLineHeight).toBeGreaterThanOrEqual(theme.touchTarget);
  });

  it("0원·기록 없음 달도 탭 가능하다 — 도넛에는 베낄 0건 처분이 없고, 착지가 정직한 빈 목록이다", () => {
    // 도넛은 computeCategoryShares가 0원 조각을 줄이 태어나기 전에 떨어뜨려 "눌리는 0원
    // 줄" 자체가 없다(같은 필터를 칩 모집단도 쓴다). 기둥은 이미 그려져 있으므로 여섯 중
    // 몇 개만 죽은 버튼이면 그게 곧 P2-1의 병이고, 착지는 기록 탭의 빈 목록 + "필터 해제"
    // 탈출구라 막대가 말한 사실과 같은 사실이다 — 그래서 disabled 갈래가 없다.
    expect(chartBlock()).not.toContain("disabled");
  });

  it("REP-001 픽셀락: 비세션 미리보기 분기는 무접촉이다 (추이 카드는 세션 데이터 렌더)", () => {
    const previewStart = reportSource.indexOf("{!hasSession ? (");
    const previewEnd = reportSource.indexOf(") : activeIsLoading ? (");
    expect(previewStart).toBeGreaterThan(0);
    expect(previewEnd).toBeGreaterThan(previewStart);
    const previewBranch = reportSource.slice(previewStart, previewEnd);
    expect(previewBranch).not.toContain("CategoryTrendMiniChart");
    expect(previewBranch).not.toContain("onSelectMonth");
    expect(previewBranch).not.toContain("openCategoryTrendMonthDrilldown");
  });
});

describe("비접촉 계약 — 이 후속이 움직이지 않은 파일들", () => {
  it("category-trend.ts는 무수정이다 — 드릴다운을 모르고, 낭독·판정 소유만 그대로 진다", () => {
    const trendSource = source("src/reports/category-trend.ts");
    // 판정 모듈이 링크 규약을 끌어안지 않는다(드릴다운은 이 라운드의 별도 모듈 몫).
    expect(trendSource).not.toContain('from "./category-drilldown"');
    expect(trendSource).not.toContain("RECORDS_");
    expect(trendSource).not.toContain("category-trend-drilldown");
    // 이월을 명시했던 머리말이 그대로다 — 후속이 모듈 밖(발신 전용)에서 이뤄졌다는 근거.
    expect(trendSource).toContain("추이 점 → 기록 드릴다운(기존 드릴다운은 기간 카드 소유 — 후속)");
  });

  it("수신부(records.tsx)는 이 후속을 모른다 — 삼요소 규약이 이미 다 받는다", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).not.toContain("category-trend");
    // 회차 단위의 한 묶음 적용(라운드 52)은 기존 계약(category-drilldown.test.ts)이 계속 문다.
    expect(recordsSource).toContain("resolveDrilldownNonceParam(monthParams[RECORDS_DRILLDOWN_NONCE_PARAM])");
  });
});
