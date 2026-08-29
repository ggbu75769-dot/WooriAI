import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_VIEW_ONLY_EMPTY_TITLE } from "../family/record-permissions";
import { buildRecordsEmptyMonthState, RECORDS_EMPTY_MONTH_CURRENT_ACTION_LABEL } from "../expenses/records-list-view";
import { canGoToNextPeriod, periodLabelForOffset, type PeriodUnit } from "../period-navigation";
import { buildCompletedMonthBudgetLine } from "./completed-month-budget";
import { buildMonthlyInsight } from "./monthly-insight";
import {
  buildReportEmptyPeriodCard,
  EMPTY_RECORD_PERIOD_SCREENS,
  REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS,
  REPORT_EMPTY_PERIOD_RECORD_ACTION_LABEL
} from "./empty-period-card";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * GAP-072 트랙 C(#3) — 리포트 탭의 **빈 기간 카드**.
 *
 * 이 결함이 여섯 라운드를 살아남은 이유는 "어떤 단언도 깨지 않았다"는 것이다: 라운드 39·67이
 * 기록 탭에서 고친 것과 **글자 그대로 같은 문장**이 리포트 탭에 남아 있었는데, 두 화면이 같은
 * 상황(기록이 0건인 기간을 보여 준다)을 만난다는 사실이 저장소 어디에도 값으로 없었다.
 * 그래서 이 파일의 계약은 넷 다 **파생·부정** 형태다:
 *
 *  ⓐ 끝난 기간에는 사실 한 줄 · 현재 기간은 종전 문장 그대로("첫 기록"·"이번 달"이 끝난 기간에
 *    등장하지 않는다 — 부정 단언)
 *  ⓑ 세 탭 모두에서 카드의 기간 표현이 **바로 위 `categoryCardTitle`과 같은 기간**을 가리킨다
 *    (파생 단언 — 두 문장을 같은 입력에서 만들어 맞춰 본다)
 *  ⓒ 끝난 기간의 액션이 `/expenses/new`로 가지 않는다(날짜를 지어내지 않는다)
 *  ⓓ "기록 0건 기간을 보여 주는 화면 목록"이 값으로 있고 `app/**`의 현실과 일치한다
 */

/** 화면이 계산하는 기간 라벨과 도넛 제목을 **한 입력에서** 만들어 두는 픽스처. */
const baseDate = new Date(2026, 7, 15); // 2026-08-15 (현재 기간 = 2026년 8월 / 3분기 / 2026년)

function reportDateFor(unit: PeriodUnit, offset: number): Date {
  // 화면과 같은 규칙: 월간만 오프셋으로 달을 옮기고, 분기·연간은 라벨이 기간을 진다.
  return unit === "month" ? new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1) : baseDate;
}

/**
 * `app/(tabs)/reports.tsx`의 `categoryCardTitle` 규칙 — 아래 첫 테스트가 이 표현이 화면에
 * **그대로** 있는지 확인하므로, 화면이 규칙을 바꾸면 이 파일이 함께 빨개진다.
 */
const CATEGORY_CARD_TITLE_EXPRESSION =
  'const categoryCardTitle = period === "월간" ? `${reportDate.getMonth() + 1}월 카테고리 비중` : `${periodLabel} 카테고리 비중`;';

function categoryCardTitleFor(unit: PeriodUnit, offset: number, periodLabel: string): string {
  return unit === "month" ? `${reportDateFor(unit, offset).getMonth() + 1}월 카테고리 비중` : `${periodLabel} 카테고리 비중`;
}

/** 끝난 기간 세 탭(월간 = 9개월 전, 분기 = 4분기 전, 연간 = 작년). */
const ENDED_PERIODS: ReadonlyArray<{ unit: PeriodUnit; offset: number; expectedLabel: string }> = [
  { unit: "month", offset: -9, expectedLabel: "2025년 11월" },
  { unit: "quarter", offset: -4, expectedLabel: "2025년 3분기" },
  { unit: "year", offset: -1, expectedLabel: "2025년" }
];

const PERIOD_UNITS: ReadonlyArray<PeriodUnit> = ["month", "quarter", "year"];

describe("GAP-072 C(#3) ⓐ 끝난 기간에는 사실 한 줄, 현재 기간은 종전 문장 그대로", () => {
  it("끝난 기간의 제목은 '{기간}에는 기록이 없어요.' 한 줄이다 (세 탭 모두)", () => {
    for (const { unit, offset, expectedLabel } of ENDED_PERIODS) {
      const periodLabel = periodLabelForOffset(baseDate, unit, offset);
      // 픽스처가 실제로 그 기간을 가리키는지부터 확인한다(라벨이 어긋나면 아래 단언이 무의미하다).
      expect(periodLabel, unit).toBe(expectedLabel);
      const card = buildReportEmptyPeriodCard({ unit, periodLabel, isCurrentPeriod: canGoToNextPeriod(offset) === false });
      expect(card.title, unit).toBe(`${expectedLabel}에는 기록이 없어요.`);
    }
  });

  it("끝난 기간에는 '첫 기록'도 '이번 달'도 등장하지 않는다 (부정 단언)", () => {
    for (const { unit, offset } of ENDED_PERIODS) {
      const card = buildReportEmptyPeriodCard({
        unit,
        periodLabel: periodLabelForOffset(baseDate, unit, offset),
        isCurrentPeriod: false
      });
      expect(card.title, unit).not.toContain("첫 기록");
      expect(card.title, unit).not.toContain("이번 달");
      // 지킬 수 없게 된 약속의 틀 자체가 사라진다(사실 한 줄이지 조건부 약속이 아니다).
      expect(card.title, unit).not.toContain("보여드릴게요");
      // DNC-018 해요체.
      expect(card.title, unit).toMatch(/어요\.$/);
    }
  });

  it("현재 기간은 제목·라벨·액션이 종전과 바이트 단위로 같다 (세 탭 모두)", () => {
    for (const unit of PERIOD_UNITS) {
      const card = buildReportEmptyPeriodCard({
        unit,
        periodLabel: periodLabelForOffset(baseDate, unit, 0),
        isCurrentPeriod: true
      });
      expect(card, unit).toEqual({
        title: "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.",
        actionLabel: "지출 기록하기",
        action: "record"
      });
    }
    // 종전 화면이 들고 있던 그 두 리터럴 그대로다(상수로 승격했을 뿐 글자는 같다).
    expect(REPORT_EMPTY_PERIOD_RECORD_ACTION_LABEL).toBe("지출 기록하기");
  });

  it("기간 이름을 모르면 기간을 지어내지 않고 종전 문장으로 되돌아간다", () => {
    for (const unit of PERIOD_UNITS) {
      const card = buildReportEmptyPeriodCard({ unit, periodLabel: "   ", isCurrentPeriod: false });
      expect(card.title, unit).toBe("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
      expect(card.action, unit).toBe("record");
    }
  });

  /** 라운드 40 J-5 — 이 갈래는 이번 라운드가 한 글자도 바꾸지 않는다. */
  it("보기 전용 세션은 끝난 기간에서도 종전 그대로다 (제목·라벨·액션 무변경)", () => {
    for (const { unit, offset } of ENDED_PERIODS) {
      const card = buildReportEmptyPeriodCard({
        unit,
        periodLabel: periodLabelForOffset(baseDate, unit, offset),
        isCurrentPeriod: false,
        expenseEntryLocked: true
      });
      expect(card, unit).toEqual({
        title: EXPENSE_VIEW_ONLY_EMPTY_TITLE,
        actionLabel: "지출 기록하기",
        action: "record"
      });
    }
  });

  /**
   * ⓓ 문장을 기록 탭과 두 벌로 만들지 않는다 — 이 모듈은 문장을 **짓지 않고** 형제 모듈을
   * 그대로 부른다. 그래서 세 갈래의 제목이 형제 모듈의 출력과 글자 단위로 같다.
   */
  it("제목은 형제 모듈(buildRecordsEmptyMonthState)에서 그대로 온다 — 문장 리터럴 0건", () => {
    const moduleSource = source("src/reports/empty-period-card.ts");
    expect(moduleSource).toContain('import { buildRecordsEmptyMonthState, RECORDS_EMPTY_MONTH_CURRENT_ACTION_LABEL } from "../expenses/records-list-view";');
    // 제목 문장을 이 모듈이 다시 적지 않는다(머리말이 문장을 **설명**하는 것과, 코드가 문장을
    // **정의**하는 것은 다르다 — 뒤엣것이 문장을 두 벌로 만든다).
    expect(moduleSource).not.toContain("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
    expect(moduleSource).not.toContain("에는 기록이 없어요.");
    // 제목을 조립하는 자리도 없다(문자열 템플릿 0건 — 라벨을 이어 붙이는 순간 틀이 갈라진다).
    expect(moduleSource).not.toContain("${");

    for (const { unit, offset } of ENDED_PERIODS) {
      const periodLabel = periodLabelForOffset(baseDate, unit, offset);
      expect(buildReportEmptyPeriodCard({ unit, periodLabel, isCurrentPeriod: false }).title, unit).toBe(
        buildRecordsEmptyMonthState({ monthLabel: periodLabel, isCurrentMonth: false }).title
      );
    }
    expect(buildReportEmptyPeriodCard({ unit: "month", periodLabel: "2026년 8월", isCurrentPeriod: true }).title).toBe(
      buildRecordsEmptyMonthState({ monthLabel: "2026년 8월", isCurrentMonth: true }).title
    );
  });

  it("형제 모듈(기록 탭의 소유물)은 이번 라운드가 읽기만 한다", () => {
    const recordsModule = source("src/expenses/records-list-view.ts");
    // 읽기 방향이 반대로 서면(형제가 이 모듈을 부르면) 소유 관계가 뒤집힌다.
    expect(recordsModule).not.toContain("empty-period-card");
    expect(recordsModule).not.toContain("buildReportEmptyPeriodCard");
    // 기록 탭 화면도 이번 라운드가 열지 않았다.
    expect(source("app/(tabs)/records.tsx")).not.toContain("buildReportEmptyPeriodCard");
  });
});

describe("GAP-072 C(#3) ⓑ 카드의 기간 표현이 바로 위 categoryCardTitle과 같은 기간이다", () => {
  it("화면의 도넛 제목 규칙이 이 파일이 가정하는 그대로다 (파생의 뿌리)", () => {
    expect(source("app/(tabs)/reports.tsx")).toContain(CATEGORY_CARD_TITLE_EXPRESSION);
  });

  it("월간·분기·연간 모두 두 문장이 같은 기간을 가리킨다", () => {
    for (const { unit, offset } of ENDED_PERIODS) {
      const periodLabel = periodLabelForOffset(baseDate, unit, offset);
      const donutTitle = categoryCardTitleFor(unit, offset, periodLabel);
      const card = buildReportEmptyPeriodCard({ unit, periodLabel, isCurrentPeriod: false });
      // 도넛 제목에서 기간만 떼어 낸다("11월 카테고리 비중" → "11월").
      const periodToken = donutTitle.replace(" 카테고리 비중", "");
      expect(periodToken.length, unit).toBeGreaterThan(0);
      expect(card.title, `${unit}: ${donutTitle} ↔ ${card.title}`).toContain(periodToken);
    }
  });

  it("분기·연간 카드가 달 이름을 말하지 않는다 (종전 결함의 정확한 반대 — 부정 단언)", () => {
    for (const { unit, offset } of ENDED_PERIODS.filter((entry) => entry.unit !== "month")) {
      const card = buildReportEmptyPeriodCard({
        unit,
        periodLabel: periodLabelForOffset(baseDate, unit, offset),
        isCurrentPeriod: false
      });
      expect(card.title, unit).not.toMatch(/\d+월/);
    }
  });

  it("화면이 도넛과 빈 카드에 **같은 값**을 넘긴다 (기간을 두 번 계산하지 않는다)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");
    expect(reportSource).toContain("const emptyPeriodCard = buildReportEmptyPeriodCard({");
    expect(reportSource).toContain("    unit: periodUnit,\n    periodLabel,\n");
    // "끝난 기간인가"를 화면이 새로 판정하지 않는다 — 화살표가 이미 쓰는 그 값을 뒤집어 넘긴다.
    expect(reportSource).toContain("isCurrentPeriod: !canGoNextPeriod,");
    expect(reportSource).toContain("const canGoNextPeriod = canGoToNextPeriod(monthOffset);");
  });
});

describe("GAP-072 C(#3) ⓒ 끝난 기간의 액션은 오늘 날짜 기록으로 가지 않는다", () => {
  it("끝난 기간의 액션 키는 '현재 기간으로'다 (record가 아니다)", () => {
    for (const { unit, offset } of ENDED_PERIODS) {
      const card = buildReportEmptyPeriodCard({
        unit,
        periodLabel: periodLabelForOffset(baseDate, unit, offset),
        isCurrentPeriod: false
      });
      expect(card.action, unit).toBe("go-current-period");
      expect(card.actionLabel, unit).toBe(REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS[unit]);
    }
  });

  it("액션 라벨은 기간 단위를 따르고, 월간은 기록 탭이 이미 쓰는 문구를 읽어 쓴다 (새 문구 둘)", () => {
    expect(REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS.month).toBe(RECORDS_EMPTY_MONTH_CURRENT_ACTION_LABEL);
    expect(REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS.month).toBe("이번 달 보기");
    expect(REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS.quarter).toBe("이번 분기 보기");
    expect(REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS.year).toBe("올해 보기");
    // 셋이 같은 문법이라 나란히 놓아도 서로 다른 말을 하지 않는다.
    for (const label of Object.values(REPORT_EMPTY_PERIOD_CURRENT_ACTION_LABELS)) {
      expect(label).toMatch(/ 보기$/);
    }
  });

  it("화면의 지출 생성 입구는 'record' 갈래 하나뿐이고, 끝난 기간은 기간 이동으로 간다", () => {
    const reportSource = source("app/(tabs)/reports.tsx");
    expect(reportSource).toContain(
      'emptyPeriodCard.action === "go-current-period"\n                      ? goToCurrentPeriod\n                      : expenseGate.guard(() => router.push("/expenses/new"))'
    );
    // 이동은 오프셋 하나를 0으로 되돌리는 일이고, 새 기간 라벨을 소리로도 남긴다(화살표와 같은
    // 문법 · 새 문구 0건). 화면 전환이 없는 자리가 아니라 **화면 전체가 바뀌는** 자리다.
    const handlerAt = reportSource.indexOf("const goToCurrentPeriod = () => {");
    expect(handlerAt).toBeGreaterThan(-1);
    const handler = reportSource.slice(handlerAt, handlerAt + 220);
    expect(handler).toContain("setMonthOffset(0);");
    expect(handler).toContain('announceForA11y(periodLabelForOffset(baseDate, periodUnit, 0));');
    expect(handler.indexOf("setMonthOffset(")).toBeLessThan(handler.indexOf("announceForA11y("));
    // /expenses/new로 가는 자리는 이 화면에 딱 하나다(끝난 기간에서 오늘 날짜 시트가 열리지 않는다).
    expect(reportSource.match(/router\.push\("\/expenses\/new"\)/g) ?? []).toHaveLength(1);
  });

  it("빠른 기록 시트에 새 파라미터를 만들지 않았다 (app/expenses/new.tsx 무접촉)", () => {
    expect(source("app/expenses/new.tsx")).not.toContain("empty-period-card");
    expect(source("app/(tabs)/reports.tsx")).not.toContain('router.push({ pathname: "/expenses/new"');
  });
});

describe("GAP-072 C(#3) ⓓ '기록 0건 기간'을 보여 주는 화면 목록", () => {
  /**
   * 같은 상황을 만나는 화면이 저장소에 몇 개인지가 어디에도 없었기 때문에 형제 화면끼리
   * 정직성 등급이 갈렸다. 목록을 값으로 두고, 현실과 갈라지면 여기가 먼저 빨개진다.
   */
  it("목록은 오늘 셋이다 (홈 · 기록 탭 · 리포트 탭)", () => {
    expect([...EMPTY_RECORD_PERIOD_SCREENS].sort()).toEqual([
      "app/(tabs)/index.tsx",
      "app/(tabs)/records.tsx",
      "app/(tabs)/reports.tsx"
    ]);
  });

  it("app/** 을 훑은 실제 집합과 정확히 일치한다 (새 화면이 생기면 빨개진다)", () => {
    // "기록이 0건인 기간의 빈 카드를 그린다"의 표지 — 두 순수 모듈의 호출부, 그리고 아직
    // 모듈을 지나지 않는 홈의 현재 달 문장.
    const marks = [/\bbuildRecordsEmptyMonthState\s*\(/, /\bbuildReportEmptyPeriodCard\s*\(/, /첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요\./];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const fullPath = join(dir, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        const body = readFileSync(fullPath, "utf8");
        if (!marks.some((mark) => mark.test(body))) continue;
        found.push(relative(mobileRoot, fullPath).split(sep).join("/"));
      }
    };
    walk(join(mobileRoot, "app"));

    // 스캔이 실제로 무언가를 찾았는지부터 확인한다(정규식이 조용히 죽으면 통과해 버린다).
    expect(found).toContain("app/(tabs)/reports.tsx");
    expect(found.sort()).toEqual([...EMPTY_RECORD_PERIOD_SCREENS].sort());
  });

  it("홈은 언제나 현재 달이라 기간 갈래가 없다 (목록에 있지만 판정은 필요 없다)", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
    expect(homeSource).not.toContain("buildReportEmptyPeriodCard");
    expect(homeSource).not.toContain("에는 기록이 없어요.");
  });
});

describe("GAP-072 C(#3) 이 트랙이 건드리지 않은 것들", () => {
  const reportSource = source("app/(tabs)/reports.tsx");

  /**
   * ⓐ REP-001 픽셀락 캡처는 **비세션 분기**다(`{!hasSession ? (` 안의 고정 픽스처 네 장).
   * 빈 기간 카드는 그 분기가 아니라 세션 경로의 `categoryData.length === 0` 가지에만 선다 —
   * 즉 캡처 화면에는 애초에 등장하지 않는다.
   */
  it("REP-001 픽셀락: 빈 기간 카드는 비세션 캡처 분기에 등장하지 않는다", () => {
    const previewAt = reportSource.indexOf("{!hasSession ? (");
    expect(previewAt).toBeGreaterThan(-1);
    const previewBlock = reportSource.slice(previewAt, reportSource.indexOf(") : activeIsLoading ? (", previewAt));
    expect(previewBlock).toContain('<LineChartCard title="총 지출" value={formatKrw(monthlyTotal)} />');
    expect(previewBlock).toContain('<DonutChartCard title="카테고리 비중" />');
    expect(previewBlock).toContain("이번 달 절약 팁");
    // 캡처 분기에는 빈 카드도, 그 액션도 없다.
    expect(previewBlock).not.toContain("emptyPeriodCard");
    expect(previewBlock).not.toContain("EmptyStateCard");
    expect(previewBlock).not.toContain("goToCurrentPeriod");
  });

  it("총 지출 카드 · 도넛 · 추이 캡션 · 누적 · 마일스톤은 한 줄도 바뀌지 않았다", () => {
    expect(reportSource).toContain('<LineChartCard\n                title="총 지출"');
    expect(reportSource).toContain("<DonutChartCard\n                    title={categoryCardTitle}");
    expect(reportSource).toContain('testID="reports-period-trend-caption"');
    expect(reportSource).toContain("{completedMonthBudgetLine ? (");
    // 이 트랙이 만진 것은 `categoryData.length === 0` 가지 하나다.
    expect(reportSource.match(/categoryData\.length === 0/g) ?? []).toHaveLength(1);
  });

  it("미래 기간 처리는 종전 그대로다 (라운드 52의 0원 절벽 제거 · 다음 이동 상한)", () => {
    expect(reportSource).toContain("const canGoNextPeriod = canGoToNextPeriod(monthOffset);");
    expect(reportSource).toContain("buildPeriodTrendPoints({");
    // 카드가 미래 기간을 새로 판정하지 않는다(상한은 화살표가 이미 진다).
    expect(source("src/reports/empty-period-card.ts")).not.toContain("todayIso");
    expect(source("src/reports/empty-period-card.ts")).not.toContain("Date");
  });

  /**
   * ⓕ 인사이트 카드 · 끝난 달 예산 줄과 문장이 겹치지 않는다 — 그 둘은 총액이 0원이면 애초에
   * 서지 않는다(각자의 null 규칙). 빈 기간 카드가 서는 상황이 정확히 그 상황이므로 한 화면에서
   * 두 문장이 같은 기간을 두고 다른 말을 할 자리가 없다. 그 사실을 계약으로 고정한다.
   */
  it("총액이 0원이면 인사이트 카드도 끝난 달 예산 줄도 서지 않는다 (문장 충돌 0건)", () => {
    expect(
      buildMonthlyInsight({
        yearMonth: "2025-11",
        todayIso: "2026-08-15",
        totalExpenseKrw: 0,
        previousMonthTotalKrw: 500000,
        categoryTop: [],
        budgetAmountKrw: 300000,
        categoryLabel: (categoryId) => categoryId
      })
    ).toBeNull();
    expect(
      buildCompletedMonthBudgetLine({
        yearMonth: "2025-11",
        monthStatus: "complete",
        totalExpenseKrw: 0,
        budgetAmountKrw: 300000
      })
    ).toBeNull();
  });

  it("화면에 빈 카드 문구 리터럴이 남지 않았다 (판정은 순수 모듈이 진다)", () => {
    expect(reportSource).not.toContain("첫 기록을 남기면");
    expect(reportSource).not.toContain("에는 기록이 없어요.");
    expect(reportSource).not.toContain("EXPENSE_VIEW_ONLY_EMPTY_TITLE");
    expect(reportSource).not.toContain(`"${EXPENSE_VIEW_ONLY_EMPTY_TITLE}"`);
  });
});
