import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RECORDS_MONTH_PARAM } from "../expenses/import-landing-month";
import {
  buildCategoryDrilldownTarget,
  categoryDrilldownHint,
  categoryDrilldownNote,
  drilldownMonthLabel,
  isDrilldownCategoryId,
  RECORDS_DRILLDOWN_NONCE_PARAM,
  RECORDS_TAB_PATHNAME,
  resolveDrilldownCategoryIdParam,
  resolveDrilldownMonth,
  resolveDrilldownNonceParam
} from "./category-drilldown";

const TODAY = "2026-08-27";

describe("C-03 착지 월 규칙", () => {
  it("lands on the month being viewed for the 월간 tab", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2026-06", monthCount: 1, todayIso: TODAY })).toBe("2026-06");
    expect(resolveDrilldownMonth({ startYearMonth: "2026-08", monthCount: 1, todayIso: TODAY })).toBe("2026-08");
  });

  it("lands on the current month while the quarter/year is still running", () => {
    // 2026년 3분기(7~9월)를 8월에 보는 중.
    expect(resolveDrilldownMonth({ startYearMonth: "2026-07", monthCount: 3, todayIso: TODAY })).toBe("2026-08");
    // 2026년 연간을 8월에 보는 중.
    expect(resolveDrilldownMonth({ startYearMonth: "2026-01", monthCount: 12, todayIso: TODAY })).toBe("2026-08");
  });

  it("lands on the period's last month once the period is over", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2026-04", monthCount: 3, todayIso: TODAY })).toBe("2026-06");
    expect(resolveDrilldownMonth({ startYearMonth: "2025-01", monthCount: 12, todayIso: TODAY })).toBe("2025-12");
  });

  it("never leaves the period, even for a wholly-future one (navigation blocks it anyway)", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2027-01", monthCount: 12, todayIso: TODAY })).toBe("2027-01");
  });

  it("refuses to guess a month from an unparseable period", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2026-13", monthCount: 12, todayIso: TODAY })).toBeNull();
    expect(resolveDrilldownMonth({ startYearMonth: "2026-01", monthCount: 0, todayIso: TODAY })).toBeNull();
    expect(resolveDrilldownMonth({ startYearMonth: "2026-01", monthCount: 12, todayIso: "2026-08" })).toBeNull();
  });
});

describe("C-03 드릴다운 링크", () => {
  it("builds the records-tab link the month param convention already understands", () => {
    expect(
      buildCategoryDrilldownTarget({
        startYearMonth: "2026-01",
        monthCount: 12,
        todayIso: TODAY,
        categoryId: "cat-diaper",
        nonce: 1
      })
    ).toEqual({
      pathname: RECORDS_TAB_PATHNAME,
      params: { month: "2026-08", categoryId: "cat-diaper", drilldown: "1" }
    });
    expect(RECORDS_TAB_PATHNAME).toBe("/(tabs)/records");
    // QA P3-6: 월 파라미터 이름은 가져오기 착지와 **같은 상수 한 벌**에서 온다.
    expect(RECORDS_MONTH_PARAM).toBe("month");
    expect(RECORDS_DRILLDOWN_NONCE_PARAM).toBe("drilldown");
    // 모듈 안에 "month" 리터럴이 다시 생기면(타입이든 빌더든) 이중 소스가 되살아난다.
    const moduleSource = readFileSync(join(process.cwd(), "src/reports/category-drilldown.ts"), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n");
    expect(moduleSource).toContain('import { RECORDS_MONTH_PARAM } from "../expenses/import-landing-month";');
    expect(moduleSource).not.toContain('"month"');
  });

  it("returns null rather than navigating somewhere arbitrary", () => {
    const period = { startYearMonth: "2026-01", monthCount: 12, todayIso: TODAY, nonce: 1 };
    expect(buildCategoryDrilldownTarget({ ...period, categoryId: undefined })).toBeNull();
    expect(buildCategoryDrilldownTarget({ ...period, categoryId: "" })).toBeNull();
    expect(buildCategoryDrilldownTarget({ ...period, categoryId: "../../settings" })).toBeNull();
    expect(buildCategoryDrilldownTarget({ ...period, todayIso: "nope", categoryId: "cat-diaper" })).toBeNull();
  });

  it("refuses to build a link whose nonce the records tab would ignore", () => {
    // 읽는 쪽이 무시할 값을 실어 보내면 착지가 조용히 종전 가드로 되돌아간다(= P1-1/P2-1 재발).
    const period = { startYearMonth: "2026-01", monthCount: 12, todayIso: TODAY, categoryId: "cat-diaper" };
    for (const nonce of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1e13]) {
      expect(buildCategoryDrilldownTarget({ ...period, nonce }), String(nonce)).toBeNull();
    }
    // 0(첫 렌더의 카운터 값)은 정상이다 -- 화면은 1부터 올리지만 값 자체를 막을 이유가 없다.
    expect(buildCategoryDrilldownTarget({ ...period, nonce: 0 })!.params.drilldown).toBe("0");
  });

  it("accepts both server UUIDs and the mobile quick-tile alias ids", () => {
    expect(isDrilldownCategoryId("2f1c1b2e-4a5f-4c11-9d2b-1a2b3c4d5e6f")).toBe(true);
    expect(isDrilldownCategoryId("mobile_etc")).toBe(true);
    expect(isDrilldownCategoryId("기저귀")).toBe(false);
    expect(isDrilldownCategoryId("a b")).toBe(false);
    expect(isDrilldownCategoryId("x".repeat(65))).toBe(false);
    expect(isDrilldownCategoryId(42)).toBe(false);
  });
});

describe("C-03 착지 월을 누르기 전에 말한다", () => {
  it("labels the landing month for the hint", () => {
    expect(drilldownMonthLabel("2026-08")).toBe("2026년 8월");
    expect(drilldownMonthLabel("2026-8")).toBeNull();
    expect(categoryDrilldownHint("2026-08")).toBe("두 번 누르면 2026년 8월 기록에서 이 카테고리만 볼 수 있어요");
    expect(categoryDrilldownHint("nope")).toBeNull();
  });

  it("only adds the visible note when the period is more than one month", () => {
    expect(categoryDrilldownNote("2026-08", 12)).toBe("카테고리를 누르면 2026년 8월 기록을 보여드려요");
    expect(categoryDrilldownNote("2026-08", 3)).toBe("카테고리를 누르면 2026년 8월 기록을 보여드려요");
    // 월간 탭: 착지 월이 보고 있는 달 그대로라 말할 것이 없다.
    expect(categoryDrilldownNote("2026-08", 1)).toBeNull();
  });
});

describe("C-03 기록 탭이 읽는 categoryId 파라미터", () => {
  it("takes the first value and ignores anything malformed", () => {
    expect(resolveDrilldownCategoryIdParam("cat-diaper")).toBe("cat-diaper");
    expect(resolveDrilldownCategoryIdParam(["cat-diaper", "cat-other"])).toBe("cat-diaper");
    expect(resolveDrilldownCategoryIdParam(undefined)).toBeNull();
    expect(resolveDrilldownCategoryIdParam(null)).toBeNull();
    expect(resolveDrilldownCategoryIdParam("")).toBeNull();
    expect(resolveDrilldownCategoryIdParam("<script>")).toBeNull();
    expect(resolveDrilldownCategoryIdParam([])).toBeNull();
  });

  it("round-trips what the report side puts on the link", () => {
    const target = buildCategoryDrilldownTarget({
      startYearMonth: "2026-07",
      monthCount: 3,
      todayIso: TODAY,
      categoryId: "mobile_etc",
      nonce: 7
    });
    expect(resolveDrilldownCategoryIdParam(target!.params.categoryId)).toBe("mobile_etc");
    expect(resolveDrilldownNonceParam(target!.params.drilldown)).toBe("7");
  });
});

/**
 * 라운드 52 QA P1-1/P2-1 — 착지 재적용.
 *
 * 기록 탭은 파라미터를 값별로 한 번만 적용하므로(가져오기 착지의 규칙), 회차가 없으면
 * "착지 월이 같은 다른 카테고리"는 월을 재적용하지 못하고(P1-1) "같은 카테고리 다시 누르기"는
 * 아무 일도 하지 않는다(P2-1). 화면은 vitest에서 렌더되지 않으므로, 여기서는 **링크가 실제로
 * 달라진다**는 사실을 고정하고 적용 규칙은 아래 소스 계약이 맡는다.
 */
describe("QA P1-1/P2-1 회차(nonce)", () => {
  const period = { startYearMonth: "2026-01", monthCount: 12, todayIso: TODAY };

  it("같은 카테고리를 다시 눌러도 링크가 달라진다 -- 재적용의 유일한 근거", () => {
    const first = buildCategoryDrilldownTarget({ ...period, categoryId: "cat-diaper", nonce: 1 })!;
    const second = buildCategoryDrilldownTarget({ ...period, categoryId: "cat-diaper", nonce: 2 })!;

    expect(second.params.month).toBe(first.params.month);
    expect(second.params.categoryId).toBe(first.params.categoryId);
    expect(second.params.drilldown).not.toBe(first.params.drilldown);
  });

  it("착지 월이 같은 다른 카테고리도 새 회차를 받는다(월이 함께 재적용되는 근거)", () => {
    const first = buildCategoryDrilldownTarget({ ...period, categoryId: "cat-diaper", nonce: 1 })!;
    const second = buildCategoryDrilldownTarget({ ...period, categoryId: "cat-food", nonce: 2 })!;

    expect(first.params.month).toBe("2026-08");
    expect(second.params.month).toBe("2026-08");
    expect(second.params.drilldown).not.toBe(first.params.drilldown);
  });

  it("회차 파라미터는 숫자 문자열만 통과하고, 아니면 종전 가드로 떨어진다", () => {
    expect(resolveDrilldownNonceParam("3")).toBe("3");
    expect(resolveDrilldownNonceParam(["3", "4"])).toBe("3");
    // 형식이 어긋나면 null = nonce가 없던 때와 같은 동작(가져오기 착지 경로가 그대로 남는다).
    for (const raw of [undefined, null, "", "abc", "-1", "1.5", " 3", "1".repeat(13), []]) {
      expect(resolveDrilldownNonceParam(raw as string | string[] | undefined), JSON.stringify(raw)).toBeNull();
    }
  });
});

/**
 * 라우터가 파라미터를 어떻게 병합하는지는 이 환경에서 확증할 수 없다(기록 탭은 vitest에서
 * 렌더되지 않는다). 대신 **두 화면의 배선**을 소스에서 고정한다 — 만드는 쪽이 회차를 싣고,
 * 읽는 쪽이 그 회차 단위로 월과 카테고리를 한 묶음으로 적용한다는 사실.
 */
describe("QA P1-1/P2-1 배선 계약 (source contract)", () => {
  const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
  const reportSource = source("app/(tabs)/reports.tsx");
  const recordsSource = source("app/(tabs)/records.tsx");
  /**
   * `openCategoryDrilldown` 핸들러의 **코드 줄만** 잘라 본다 — 주석 줄은 뺀다(주석이 "Date.now()를
   * 쓰지 않는다"고 설명하는 것과 실제로 쓰는 것은 다르다).
   */
  const drilldownHandler = () => {
    const start = reportSource.indexOf("const openCategoryDrilldown");
    expect(start).toBeGreaterThan(-1);
    const end = reportSource.indexOf("\n  };", start);
    expect(end).toBeGreaterThan(start);
    return reportSource
      .slice(start, end)
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  };

  it("리포트는 Date.now가 아니라 화면의 단조 증가 카운터를 싣는다", () => {
    expect(reportSource).toContain("const [drilldownNonce, setDrilldownNonce] = useState(0);");
    expect(reportSource).toContain("const nonce = drilldownNonce + 1;");
    expect(reportSource).toContain("buildCategoryDrilldownTarget({ ...drilldownPeriod, categoryId, nonce })");
    expect(reportSource).toContain("setDrilldownNonce(nonce);");
    // 시계에 기대면 같은 밀리초의 두 번째 탭이 조용히 무시되고 테스트에서 값이 고정되지 않는다.
    expect(drilldownHandler()).not.toContain("Date.now()");
  });

  it("링크를 만들지 못한 탭은 회차를 올리지 않는다(이동하지 않았으므로)", () => {
    const handler = drilldownHandler();
    expect(handler.indexOf("if (!target) return;")).toBeLessThan(handler.indexOf("setDrilldownNonce(nonce);"));
  });

  it("기록 탭은 회차 단위로 month와 categoryId를 한 묶음으로 적용한다", () => {
    expect(recordsSource).toContain("resolveDrilldownNonceParam(monthParams[RECORDS_DRILLDOWN_NONCE_PARAM])");
    expect(recordsSource).toContain("const appliedDrilldownNonceRef = useRef<string | null>(drilldownNonceParam);");
    expect(recordsSource).toContain("if (appliedDrilldownNonceRef.current === drilldownNonceParam) return;");
    // 한 묶음: 두 값의 appliedRef를 함께 갱신하고 두 상태를 함께 세운다.
    expect(recordsSource).toContain("appliedMonthParamRef.current = monthParam;");
    expect(recordsSource).toContain("appliedCategoryParamRef.current = categoryIdParam;");
    expect(recordsSource).toContain(
      "if (monthParam) setMonthOffset(resolveInitialMonthOffset({ monthParam, todayIso: getSeoulToday() }));"
    );
    expect(recordsSource).toContain("}, [drilldownNonceParam, monthParam, categoryIdParam]);");
  });

  it("가져오기 착지(month만)는 종전 가드 그대로다 -- 회귀 금지", () => {
    // nonce가 없으면 위 effect가 곧바로 빠져나간다.
    expect(recordsSource).toContain("if (!drilldownNonceParam) return;");
    // 값별 가드 두 개는 그대로 남아 있다(가져오기 착지가 쓰는 경로).
    expect(recordsSource).toContain("const appliedMonthParamRef = useRef<string | undefined>(monthParam);");
    expect(recordsSource).toContain("if (appliedMonthParamRef.current === monthParam) return;");
    expect(recordsSource).toContain("}, [monthParam]);");
    expect(recordsSource).toContain("const appliedCategoryParamRef = useRef<string | undefined>(categoryIdParam);");
    expect(recordsSource).toContain("}, [categoryIdParam]);");
    // 가져오기 확정 화면은 회차를 싣지 않는다(그 착지 규칙은 이 라운드에서 바뀌지 않는다).
    const importSource = source("app/import/[importJobId].tsx");
    expect(importSource).toContain(
      'router.replace({ pathname: "/(tabs)/records", params: { [RECORDS_MONTH_PARAM]: landingMonth } });'
    );
    expect(importSource).not.toContain("RECORDS_DRILLDOWN_NONCE_PARAM");
  });
});
