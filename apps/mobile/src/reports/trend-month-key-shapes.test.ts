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
 * 하나로만 읽었고, 그 모양은 **연간 응답에서만** 참이었기 때문이다:
 *
 * | 탭 | 응답 | 종전 달 키 | 종전 결과 | 이제 |
 * |---|---|---|---|---|
 * | 월간(6점) | `GET /reports/trend` | `2026-04-01` | 축·낭독 0건 | `2026-04` |
 * | 분기(3점) | `GET /reports/trend` | `2026-07-01` | 축·낭독 0건 | `2026-07` |
 * | 연간(≤12점) | `GET /reports/yearly` | `2026-01` | 정상 | `2026-01`(불변) |
 *
 * 틀린 달을 적지는 않았다 — 모듈의 "읽을 수 없으면 포기" 규칙이 그것만은 막았다. 그래서
 * **아무 신호 없이** 두 탭에서 기능이 없었다(거짓 표시가 아니라 기능 부재).
 *
 * ## ⚠️ 두 시점 — 이 파일이 예고한 이월 작업이 왔다
 * 종전 이 파일은 *"두 형식이 갈려 있다"* 를 사실로 못박고, 아래 세 번째 테스트에 *"계약을 한
 * 형식으로 모으는 이월 작업이 오면 이 단언이 가장 먼저 빨개진다"* 고 적어 두었다. **그날이
 * 왔다**: 계약이 추이·연간의 달을 `yearMonthSchema`(`YYYY-MM`) 하나로 모았고
 * (packages/contracts/src/schemas.ts), 서버(`reporting-store.service.ts`의 `trailingYearMonths`)와
 * 데모 미러(`src/api/local-backend.ts`)가 그 모양을 낸다. 그래서 이 파일이 세는 것은 이제
 * *"두 형식이 갈려 있다"* 가 아니라 **"한 형식으로 모였다 · 그래도 세 탭 다 축을 받는다"** 이다.
 *
 * ⚠️ `trend-point-labels.ts`의 **두 모양 수용은 그대로 둔다**(아래 마지막 테스트가 그 사실을
 * 못박는다). 근거는 **배포 스큐**다: 앱은 설치된 바이너리라 서버 배포와 따로 나간다 — 새 앱이
 * 아직 `YYYY-MM-01`을 내는 구버전 서버를 만나는 창이 있고(그 반대 창도 있다), 그 창에서 축이
 * 다시 사라지면 안 된다. 그리고 달을 두 모양으로 읽는 것 자체는 아무 거짓도 만들지 않는다
 * (라벨에 필요한 것은 달뿐이고, 두 모양 다 그 달을 정확히 말한다).
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
  it("추이 응답(월간·분기 탭)의 달은 YYYY-MM이다 — 종전 YYYY-MM-01", () => {
    const trend = localBackend.getTrendReport(LOCAL_CHILD_ID, "2026-05", 6);

    expect(yearMonthsOf(trend.months)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05"
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
   * 내면 이 파일 전체가 거짓이 되므로, 형식을 못박은 자리를 함께 읽는다.
   *
   * ⚠️ **두 시점** — 종전 이 테스트의 이름은 *"서버·계약이 그 **두** 형식을 각각 못박고 있다"*
   * 였고, 추이 쪽 단언은 `yearMonth: dateOnlySchema`와 서버의 `-01` 템플릿을 요구했다(그때는
   * 그것이 사실이었다) → 이제 **한 형식**이다: 계약의 `yearMonthSchema` 하나를 추이·연간이
   * 함께 쓰고, 서버 템플릿에는 `-01`이 없다.
   */
  it("서버·계약이 이제 그 **한** 형식을 못박고 있다", () => {
    const schemas = source("packages", "contracts", "src", "schemas.ts");
    const reportingStore = source("apps", "api", "src", "onboarding", "reporting-store.service.ts");

    // 계약: 달 한 칸의 표기는 이제 공유 스키마 하나다.
    expect(schemas).toContain("export const yearMonthSchema = z.string().regex(/^\\d{4}-\\d{2}$/);");
    // 인라인 사본이 다시 생기면 여기서 빨개진다(같은 정규식은 선언 한 줄에만 있어야 한다).
    expect(schemas.match(/regex\(\/\^\\d\{4\}-\\d\{2\}\$\//g)).toHaveLength(1);

    // 추이·연간 둘 다 그 스키마를 쓴다(한쪽만 옮겨 놓은 절반 통일이 아니다).
    //
    // ⚠️ 선언 하나의 **몸통까지만** 자른다(다음 `export const` 앞에서 끊는다). 파일 끝까지
    // 자르면 추이 쪽 단언이 **아래 연간 선언의 같은 줄**로 초록이 되어, 추이만 되돌려 놓아도
    // 이 테스트가 조용히 통과한다 — 역돌연변이로 실제로 확인한 거짓 초록이다.
    const declarationBody = (name: string) => {
      const start = schemas.indexOf(`export const ${name} = z.object({`);
      expect(start, `${name} 선언을 찾지 못했다`).toBeGreaterThan(-1);
      const next = schemas.indexOf("\nexport const ", start + 1);
      return schemas.slice(start, next === -1 ? schemas.length : next);
    };
    for (const schemaName of ["reportTrendSchema", "reportYearlySchema"]) {
      expect(declarationBody(schemaName), `${schemaName}의 달 형식`).toContain("yearMonth: yearMonthSchema,");
    }

    // 서버: 달 키를 만드는 그 한 줄에 `-01`이 없다.
    expect(reportingStore).toContain('return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;');
    expect(reportingStore).not.toContain(
      'return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;'
    );

    // 월간·예산 응답은 이번 통일의 **대상이 아니다** — 그 달은 알림 dedupeKey의 재료라
    // (src/notifications/generators.ts) 형식을 바꾸면 영속된 키가 갈린다. 그 사실도 못박는다.
    for (const schemaName of ["budgetSchema", "reportMonthlySchema"]) {
      expect(declarationBody(schemaName), `${schemaName}의 달 형식`).toContain("yearMonth: dateOnlySchema,");
    }
  });

  /**
   * ⚠️ `trend-point-labels.ts`의 **두 모양 수용은 지우지 않는다.** 형식이 통일됐다고 해서
   * `YYYY-MM-01`을 읽는 능력이 거짓이 되는 것은 아니다 — 배포 스큐의 창에서 구버전 서버가
   * 아직 그 모양을 내고, 달을 두 모양으로 읽는 것은 지어내기가 아니다.
   * (그 파일의 머리말은 아직 "형식이 갈려 있다"를 현재형으로 적고 있다 — 이월.)
   *
   * ⚠️ 이 화면 응답은 **어디에도 영속되지 않는다**(react-query 퍼시스터 0건 · 오프라인
   * SQLite 저장소는 지출·아웃박스만 든다) — 그래서 근거는 "묵은 캐시"가 아니라 배포 스큐다.
   */
  it("구버전 서버가 내는 YYYY-MM-01도 여전히 읽힌다", () => {
    const legacy = ["2026-03-01", "2026-04-01", "2026-05-01"];

    const result = buildTrendPointLabels({ yearMonths: legacy, points: pointsFor(legacy.length) });

    expect(result.labels).toEqual(["3월", "4월", "5월"]);
    expect(result.accessibilitySeries).toBe("3월 10,000원, 4월 20,000원, 5월 30,000원");
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
