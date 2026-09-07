import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as localBackend from "../api/local-backend";
import { LOCAL_CHILD_ID } from "../api/local-fixtures";
import { buildTrendPointLabels } from "./trend-point-labels";

/**
 * 추이 차트의 달 라벨이 **월간·분기 탭에서 통째로 사라졌던** 자리의 회귀 계약.
 *
 * ## 무엇이 조용했나
 * 라운드 85 트랙 C는 "차트가 어느 달의 얼마인지 말한다"를 세 탭 모두에 넣었다고 적었지만,
 * 실제로 고쳐진 것은 **연간 탭 하나**였다. `trend-point-labels.ts`가 달 키를 `/^\d{4}-\d{2}$/`
 * 하나로만 읽었고, 그 모양은 **연간 응답에서만** 참이기 때문이다:
 *
 * | 탭 | 응답 | 달 키 | 종전 결과 |
 * |---|---|---|---|
 * | 월간(6점) | `GET /reports/trend` | `2026-04-01` | 축·낭독 0건 |
 * | 분기(3점) | `GET /reports/trend` | `2026-07-01` | 축·낭독 0건 |
 * | 연간(≤12점) | `GET /reports/yearly` | `2026-01` | 정상 |
 *
 * 틀린 달을 적지는 않았다 — 모듈의 "읽을 수 없으면 포기" 규칙이 그것만은 막았다. 그래서
 * **아무 신호 없이** 두 탭에서 기능이 없었다(거짓 표시가 아니라 기능 부재).
 *
 * ## 왜 아무 테스트도 못 봤나
 * `trend-point-labels.test.ts`의 픽스처가 세 탭 모두 `"2026-03"`(연간 모양)을 썼다. 즉 **테스트가
 * 서버가 내지 않는 값을 넣고** 초록이었다. 이 파일은 그 구멍을 메운다: 픽스처를 손으로 적지 않고
 * **데모 백엔드를 실제로 돌려** 나온 달 키를 그대로 모듈에 넣는다(데모 백엔드는 서버 응답의
 * 미러다 — src/local-backend.test.ts REP-128 동치 참고).
 */

const repoRoot = join(process.cwd(), "..", "..");
const source = (...segments: string[]) => readFileSync(join(repoRoot, ...segments), "utf8");

/** 화면(app/(tabs)/reports.tsx)이 응답에서 달 목록을 뽑는 그 한 줄과 같은 모양. */
const yearMonthsOf = (months: ReadonlyArray<{ yearMonth: string }>) => months.map((month) => month.yearMonth);
/** 금액은 이 파일의 관심이 아니다(달 키가 load-bearing) — 점 수만 맞춘 리터럴 계열을 쓴다. */
const pointsFor = (count: number) => Array.from({ length: count }, (_, index) => (index + 1) * 10_000);

describe("추이 응답과 연간 응답의 달 키 형식", () => {
  it("추이 응답(월간·분기 탭)의 달은 YYYY-MM-01이다", () => {
    const trend = localBackend.getTrendReport(LOCAL_CHILD_ID, "2026-05", 6);

    expect(yearMonthsOf(trend.months)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01"
    ]);
  });

  it("연간 응답(연간 탭)의 달은 YYYY-MM이다", () => {
    const yearly = localBackend.getYearlyReport(LOCAL_CHILD_ID, 2025);

    expect(yearMonthsOf(yearly.monthlyTotals)).toEqual([
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12"
    ]);
  });

  /**
   * 위 두 사실의 출처는 데모가 아니라 **서버와 계약**이다. 데모만 고쳐 놓고 서버가 다른 값을
   * 내면 이 파일 전체가 거짓이 되므로, 두 형식을 못박은 자리를 함께 읽는다.
   *
   * ⚠️ 두 응답의 형식이 갈린 것 자체가 이 결함의 근본 원인이다. 계약을 한 형식으로 모으는
   * 이월 작업이 오면 **이 단언이 가장 먼저 빨개진다** — 그때 함께 고쳐야 할 곳이
   * `trend-point-labels.ts`의 `MONTH_KEY_PATTERN` 머리말이라는 뜻이다.
   */
  it("서버·계약이 그 두 형식을 각각 못박고 있다", () => {
    const schemas = source("packages", "contracts", "src", "schemas.ts");
    const reportingStore = source("apps", "api", "src", "onboarding", "reporting-store.service.ts");

    // 추이: 계약은 date-only, 서버는 달마다 `-01`을 붙여 만든다.
    expect(schemas).toContain("const dateOnlySchema = z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/);");
    expect(schemas).toContain("export const reportTrendSchema = z.object({");
    expect(schemas.slice(schemas.indexOf("export const reportTrendSchema"))).toContain("yearMonth: dateOnlySchema,");
    expect(reportingStore).toContain('return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;');

    // 연간: 같은 파일에서 **다른** 형식이다.
    expect(schemas.slice(schemas.indexOf("export const reportYearlySchema"))).toContain(
      "yearMonth: z.string().regex(/^\\d{4}-\\d{2}$/),"
    );
  });
});

describe("세 탭 모두 축과 낭독 계열을 받는다", () => {
  it("월간 탭(추이 6개월): 여섯 달이 그대로 여섯 라벨이 된다", () => {
    const trend = localBackend.getTrendReport(LOCAL_CHILD_ID, "2026-05", 6);
    const points = pointsFor(trend.months.length);

    const result = buildTrendPointLabels({ yearMonths: yearMonthsOf(trend.months), points });

    expect(result.labels).toEqual(["12월", "1월", "2월", "3월", "4월", "5월"]);
    expect(result.accessibilitySeries).toBe(
      "12월 10,000원, 1월 20,000원, 2월 30,000원, 3월 40,000원, 4월 50,000원, 5월 60,000원"
    );
  });

  it("분기 탭(추이 3개월): 세 달이 그대로 세 라벨이 된다", () => {
    const trend = localBackend.getTrendReport(LOCAL_CHILD_ID, "2026-09", 3);
    const points = pointsFor(trend.months.length);

    const result = buildTrendPointLabels({ yearMonths: yearMonthsOf(trend.months), points });

    expect(result.labels).toEqual(["7월", "8월", "9월"]);
    expect(result.accessibilitySeries).toBe("7월 10,000원, 8월 20,000원, 9월 30,000원");
  });

  it("연간 탭(연간 12개월): 종전에 유일하게 정상이던 갈래가 그대로다", () => {
    const yearly = localBackend.getYearlyReport(LOCAL_CHILD_ID, 2025);
    const points = pointsFor(yearly.monthlyTotals.length);

    const result = buildTrendPointLabels({ yearMonths: yearMonthsOf(yearly.monthlyTotals), points });

    expect(result.labels).toEqual([
      "1월",
      "2월",
      "3월",
      "4월",
      "5월",
      "6월",
      "7월",
      "8월",
      "9월",
      "10월",
      "11월",
      "12월"
    ]);
    expect(result.accessibilitySeries).toContain("12월 120,000원");
  });

  /**
   * 세 탭 어느 쪽도 **비어 있지 않다**는 것을 한 자리에서 다시 센다 — 이 단언 하나가
   * 종전 코드에서 빨갛다(월간·분기가 null이었다). 회귀가 나면 어느 탭인지 이름으로 말한다.
   */
  it("어느 탭에서도 축이 조용히 사라지지 않는다", () => {
    const tabs = [
      { name: "월간", yearMonths: yearMonthsOf(localBackend.getTrendReport(LOCAL_CHILD_ID, "2026-09", 6).months) },
      { name: "분기", yearMonths: yearMonthsOf(localBackend.getTrendReport(LOCAL_CHILD_ID, "2026-09", 3).months) },
      { name: "연간", yearMonths: yearMonthsOf(localBackend.getYearlyReport(LOCAL_CHILD_ID, 2026).monthlyTotals) }
    ];

    for (const tab of tabs) {
      const result = buildTrendPointLabels({ yearMonths: tab.yearMonths, points: pointsFor(tab.yearMonths.length) });

      expect(result.labels, `${tab.name} 탭의 축이 비었다`).toHaveLength(tab.yearMonths.length);
      expect(result.accessibilitySeries, `${tab.name} 탭의 낭독 계열이 비었다`).not.toBeNull();
    }
  });
});
