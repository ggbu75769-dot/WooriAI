import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyticsTrendView,
  formatTrendCount,
  trendBarLabel,
  trendBars,
  trendPeak,
  trendPeakSentence,
  trendTableRows,
  type TrendCountUnit,
  type TrendPoint
} from "./analytics-trend-view";

const adminRoot = process.cwd();

function readAdminSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `apps/admin/${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/** 두 화면의 요약 API가 실제로 내려주는 모양(7일 창, 0건 포함). */
const SAMPLE: TrendPoint[] = [
  { date: "2026-08-14", count: 0 },
  { date: "2026-08-15", count: 10 },
  { date: "2026-08-16", count: 0 },
  { date: "2026-08-17", count: 1234 },
  { date: "2026-08-18", count: 0 },
  { date: "2026-08-19", count: 8 },
  { date: "2026-08-20", count: 12 }
];

const ALL_ZERO: TrendPoint[] = SAMPLE.map((point) => ({ ...point, count: 0 }));

/**
 * 라운드 86 트랙 D — 운영자 화면 둘의 "일별 추이"가 값을 남긴다.
 *
 * 분석 화면은 값을 `title`(마우스 호버)에만 줬고, 형제 화면(클릭 통계)은 처음부터 날짜·건수
 * 표를 갖고 있었다. 이 모듈은 옳은 형식을 **발명하지 않고** 두 화면이 같은 자리에서 만들게
 * 모은다 — 그래서 계약의 절반이 *"클릭 화면의 글자가 종전과 바이트 단위로 같다"* 이다.
 */
describe("analytics-trend-view (라운드 86 트랙 D)", () => {
  describe("ⓑ 형제 동형 — 클릭 화면이 그리던 글자와 바이트 단위로 같다 (정상 응답에서)", () => {
    /**
     * ⚠️⚠️ **라운드 86 리뷰 L-13 — 이 아래 `legacy`가 무엇인지 정직하게 적어 둔다.**
     *
     * 이것은 옛 화면의 식을 **손으로 다시 적은 재구현**이다(옛 코드는 이 트랙이 모듈로 옮기면서
     * 저장소에서 사라졌으므로, 소스를 읽어 대조할 수 있는 원본은 더 이상 없다). 그러니 이 단언이
     * 증명하는 것은 *"모듈이 옛 화면과 같다"* 가 아니라 *"모듈이 **여기 적힌 식**과 같다"* 이다.
     *
     * 그런데도 재구현을 남기는 이유는 **대조군**이기 때문이다: 기대 문자열을 상수로 박아 두면
     * 모듈이 형식을 바꿀 때 사람이 그 상수를 함께 고치며 지나갈 수 있지만, 식으로 적어 두면
     * 천 단위 구분·단위 위치·구분자가 갈리는 순간 곧바로 빨개진다. ⚠️ 그래서 이 식을 고칠 때는
     * **모듈에 맞추려고** 고치지 않는다 — 그 순간 대조군이 사라진다.
     */
    it("막대 라벨이 옛 title 템플릿과 같은 문자열이다 (두 단위 모두)", () => {
      for (const unit of ["건", "회"] as TrendCountUnit[]) {
        for (const point of SAMPLE) {
          const legacy = `${point.date}: ${point.count.toLocaleString("ko-KR")}${unit}`;
          expect(trendBarLabel(point, unit)).toBe(legacy);
        }
      }
      // 천 단위 구분이 살아 있다(두 화면이 각자 적던 표기 그대로).
      expect(trendBarLabel({ date: "2026-08-17", count: 1234 }, "건")).toBe("2026-08-17: 1,234건");
      expect(trendBarLabel({ date: "2026-08-17", count: 1234 }, "회")).toBe("2026-08-17: 1,234회");
    });

    it("표 행이 옛 <td> 두 칸과 같은 문자열이고, 최근 날짜가 위로 온다", () => {
      const legacy = [...SAMPLE].reverse().map((point) => ({
        date: point.date,
        countText: `${point.count.toLocaleString("ko-KR")}회`
      }));
      expect(trendTableRows(SAMPLE, "회")).toEqual(legacy);
      // 뒤집는 것은 표뿐이다 — 막대는 시간순 그대로여야 기간의 모양이 그대로 보인다.
      expect(trendBars(SAMPLE, "회").map((bar) => bar.date)).toEqual(SAMPLE.map((point) => point.date));
      expect(trendTableRows(SAMPLE, "회")[0].date).toBe("2026-08-20");
    });

    it("두 화면이 같은 모듈을 지난다 (import 두 자리)", () => {
      for (const path of ["app/analytics/page.tsx", "app/clicks/page.tsx"]) {
        expect(readAdminSource(path), `${path}이(가) 추이 모듈을 지나지 않아요`).toContain(
          'from "../../src/lib/analytics-trend-view"'
        );
      }
      // 단위는 화면이 세는 것과 같다 — 분석은 이벤트(건), 클릭 통계는 클릭(회).
      expect(readAdminSource("app/analytics/page.tsx")).toContain('analyticsTrendView(summary?.dailyTotals ?? [], "건")');
      expect(readAdminSource("app/clicks/page.tsx")).toContain('analyticsTrendView(summary?.dailyTotals ?? [], "회")');
    });

    /**
     * 클릭 화면에서 이 트랙이 바꾸는 것은 *어디서 값을 만드는가*뿐이다 — 그 화면의 문구는
     * 한 글자도 움직이지 않는다(DNC-009 고지 한 줄 포함).
     */
    it("클릭 화면의 표 머리·고지·각주가 종전 그대로다 (부정 단언)", () => {
      const source = readAdminSource("app/clicks/page.tsx");
      expect(source).toContain("<th>날짜</th>");
      expect(source).toContain("<th>클릭 수</th>");
      expect(source).toContain("<h2>일별 추이 (최근 {summary.days}일)</h2>");
      expect(source).toContain("막대에 마우스를 올리면 날짜별 클릭 수를 볼 수 있어요. (서울 기준 날짜)");
      // DNC-009: 클릭 순위가 추천 점수와 무관하다는 고지.
      expect(source).toContain("※ 클릭 수가 많은 순서예요. 이 순위는 앱의 추천 순서나 추천 점수에 반영되지 않아요.");
      // 그 화면에는 최대치 문장이 서지 않는다(새 문구 0건).
      expect(source).not.toContain("peakSentence");
      expect(source).not.toContain("가장 많은 날");
    });

    /** 막대의 색·높이 계산·간격은 이 트랙 밖이다 — 두 화면에 그 식이 바이트 그대로 남는다. */
    it("막대의 색·높이·간격 식이 두 화면에 그대로 남는다 (이 모듈로 옮기지 않았다)", () => {
      for (const path of ["app/analytics/page.tsx", "app/clicks/page.tsx"]) {
        const source = readAdminSource(path);
        expect(source, `${path}: 막대 색`).toContain('background: entry.count > 0 ? "#F29B76" : "#EFE5DB",');
        expect(source, `${path}: 막대 높이`).toContain(
          "height: `${Math.max(entry.count > 0 ? 4 : 2, Math.round((entry.count / maxDaily) * 100))}%`"
        );
        expect(source, `${path}: 막대 간격`).toContain('style={{ alignItems: "flex-end", display: "flex", gap: 2, height: 120 }}');
      }
      const module = readAdminSource("src/lib/analytics-trend-view.ts");
      for (const forbidden of ["#F29B76", "#EFE5DB", "maxDaily", "height"]) {
        expect(module.includes(forbidden), `추이 모듈이 픽셀(${forbidden})을 들었어요`).toBe(false);
      }
    });
  });

  describe("ⓒ 지어내지 않기", () => {
    it("값이 전부 0이면 최대치도 문장도 없다", () => {
      expect(trendPeak(ALL_ZERO)).toBeNull();
      expect(trendPeakSentence(ALL_ZERO, "건")).toBeNull();
      expect(analyticsTrendView(ALL_ZERO, "건").peakSentence).toBeNull();
      // 빈 기간도 마찬가지다(0으로 시작하는 날 하나를 봉우리로 만들지 않는다).
      expect(trendPeak([])).toBeNull();
      expect(trendPeakSentence([], "회")).toBeNull();
      // 그래도 막대와 표는 그대로 선다 — 0건인 기간이라는 사실은 감추지 않는다.
      const view = analyticsTrendView(ALL_ZERO, "건");
      expect(view.bars).toHaveLength(ALL_ZERO.length);
      expect(view.showTable).toBe(true);
      expect(view.rows[0]).toEqual({ date: "2026-08-20", countText: "0건" });
    });

    it("최대치가 있으면 그 날과 수를 그대로 말한다", () => {
      expect(trendPeak(SAMPLE)).toEqual({ date: "2026-08-17", count: 1234, tiedDays: 1 });
      expect(trendPeakSentence(SAMPLE, "건")).toBe("가장 많은 날은 2026-08-17 하루예요 (1,234건).");
      expect(trendPeakSentence(SAMPLE, "회")).toBe("가장 많은 날은 2026-08-17 하루예요 (1,234회).");
    });

    it("같은 최대치인 날이 여럿이면 나머지 날을 지우지 않는다", () => {
      const tied: TrendPoint[] = [
        { date: "2026-08-14", count: 12 },
        { date: "2026-08-15", count: 3 },
        { date: "2026-08-16", count: 12 }
      ];
      expect(trendPeak(tied)).toEqual({ date: "2026-08-14", count: 12, tiedDays: 2 });
      expect(trendPeakSentence(tied, "건")).toBe("가장 많은 날이 2일 있어요 (각 12건, 가장 이른 날은 2026-08-14).");
      // 하나만 골라 "가장 많은 날은 X 하루예요"라고 적지 않는다.
      expect(trendPeakSentence(tied, "건")).not.toContain("하루예요");
    });

    /**
     * ⚠️ 라운드 86 리뷰 M-2 — **표를 말없이 지우지 않는다.**
     *
     * 종전 판정은 "행 수와 막대 수가 어긋나면 표를 세우지 않는다"였다. 그 규칙은 반쯤 맞는 표를
     * 막았지만, 표가 **값에 닿는 유일한 텍스트 경로**인 화면에서 그 경로를 **침묵으로** 닫았다.
     * 오늘은 그릴 수 있는 줄만 세우고 뺀 줄을 고지 한 줄로 말한다.
     */
    it("그릴 수 없는 점이 섞이면 표는 서고, 뺀 줄을 고지 한 줄이 수와 함께 말한다", () => {
      const broken = [
        { date: "2026-08-14", count: 3 },
        { date: "", count: 5 },
        { date: "2026-08-16", count: 7 }
      ] as TrendPoint[];
      const view = analyticsTrendView(broken, "건");
      expect(view.bars).toHaveLength(3);
      expect(view.showTable).toBe(true);
      // 표에는 **그릴 수 있는 줄만** 선다(날짜 없는 점을 한 줄로 지어내지 않는다).
      expect(view.rows).toEqual([
        { date: "2026-08-16", countText: "7건" },
        { date: "2026-08-14", countText: "3건" }
      ]);
      expect(view.omittedPoints).toBe(1);
      // 침묵 금지: 뺐다는 사실과 두 수가 함께 적힌다(운영자가 막대와 표를 나란히 읽는다).
      expect(view.omissionNotice).toBe(
        "일부 값을 표시하지 못했어요 — 1일이 응답에서 읽히지 않아 표에서 뺐어요 (막대 3개 · 표 2줄)."
      );

      // 수가 수가 아닌 경우도 같다.
      const nanPoint = analyticsTrendView(
        [
          { date: "2026-08-14", count: 3 },
          { date: "2026-08-15", count: Number.NaN }
        ],
        "건"
      );
      expect(nanPoint.showTable).toBe(true);
      expect(nanPoint.rows).toEqual([{ date: "2026-08-14", countText: "3건" }]);
      expect(nanPoint.omissionNotice).toContain("일부 값을 표시하지 못했어요");
      // 그래도 막대는 종전 그대로 남는다(이 트랙은 픽셀을 손대지 않는다).
      expect(nanPoint.bars).toHaveLength(2);

      // 전 점이 깨진 응답에서만 표가 서지 않고, 그때도 화면은 침묵하지 않는다.
      const allBroken = analyticsTrendView([{ date: "", count: Number.NaN }] as TrendPoint[], "건");
      expect(allBroken.showTable).toBe(false);
      expect(allBroken.rows).toEqual([]);
      expect(allBroken.omissionNotice).not.toBeNull();
    });

    /**
     * ⚠️ 라운드 86 리뷰 M-1 — **막대 경로가 던지지 않는다.**
     *
     * 타입은 `count: number`라고 말하지만 값은 네트워크에서 온다. `null` 한 점이면 종전 라벨 식은
     * `toLocaleString`에서 던졌고, 그 예외는 카드 하나가 아니라 **페이지 전체**를 가져갔다.
     */
    it("수가 수가 아닌 점이 섞여도 라벨을 만들다 던지지 않는다 (수를 지어내지도 않는다)", () => {
      const nullPoint = { date: "2026-08-15", count: null } as unknown as TrendPoint;
      expect(() => trendBarLabel(nullPoint, "건")).not.toThrow();
      expect(trendBarLabel(nullPoint, "건")).toBe("2026-08-15: 값 없음");
      // 0건으로 적으면 아무 일도 없던 날이 되고, 원문을 흘리면 "null건"이 화면에 뜬다.
      expect(trendBarLabel(nullPoint, "건")).not.toContain("0건");
      expect(trendBarLabel(nullPoint, "건")).not.toContain("null");
      // 날짜조차 없으면 낱말 하나만 남는다.
      expect(trendBarLabel({ date: "", count: undefined } as unknown as TrendPoint, "회")).toBe("값 없음");

      const view = analyticsTrendView(
        [
          { date: "2026-08-14", count: 3 },
          { date: "2026-08-15", count: null },
          { date: "2026-08-16", count: 7 }
        ] as unknown as TrendPoint[],
        "건"
      );
      // 막대 수는 그대로이고(기간의 모양), 그 점은 표·최대치 판정에서만 빠진다.
      expect(view.bars).toHaveLength(3);
      expect(view.bars[1].label).toBe("2026-08-15: 값 없음");
      expect(view.rows.map((row) => row.date)).toEqual(["2026-08-16", "2026-08-14"]);
      expect(view.peak).toEqual({ date: "2026-08-16", count: 7, tiedDays: 1 });
      expect(view.omittedPoints).toBe(1);
      // 그리고 그 응답 전체가 한 번도 던지지 않는다(카드가 선 페이지가 살아 있다).
      expect(() =>
        analyticsTrendView([{ date: null, count: null }] as unknown as TrendPoint[], "회")
      ).not.toThrow();
    });

    it("정상 응답에서는 행 수와 막대 수가 같고 표가 서며, 고지는 서지 않는다", () => {
      const view = analyticsTrendView(SAMPLE, "회");
      expect(view.showTable).toBe(true);
      expect(view.rows).toHaveLength(view.bars.length);
      expect(view.omittedPoints).toBe(0);
      // 정상 응답에서 새 글자는 0건이다 — 두 화면의 바이트 불변 주장이 사는 자리가 여기다.
      expect(view.omissionNotice).toBeNull();
      // 빈 기간도 어긋남이 아니다(0 = 0) — 종전 클릭 화면과 같은 그림(머리만 있는 표)이다.
      expect(analyticsTrendView([], "회").showTable).toBe(true);
      expect(analyticsTrendView([], "회").omissionNotice).toBeNull();
    });

    it("두 화면이 고지 한 줄을 같은 자리에서 그린다 (모듈이 지은 문장을 화면이 다시 짓지 않는다)", () => {
      for (const path of ["app/analytics/page.tsx", "app/clicks/page.tsx"]) {
        const source = readAdminSource(path);
        expect(source, `${path}: 고지 배선`).toContain(
          "{trend.omissionNotice ? <p className={styles.hint}>{trend.omissionNotice}</p> : null}"
        );
        expect(source, `${path}: 문장을 화면이 다시 적지 않는다`).not.toContain("일부 값을 표시하지 못했어요");
      }
    });

    /**
     * ⚠️ 라운드 86 리뷰 L-11 — 표를 세워 놓고도 "마우스를 올리면"만 적어 두면, 그 힌트가 이 카드를
     * 여전히 **마우스 전용**으로 소개한다(이 트랙이 고치려던 바로 그 오해다). 분석 화면만 고친다 —
     * 클릭 화면의 그 줄은 이 트랙 이전부터 표와 함께 서 있던 문장이라 바이트 불변 대상이다.
     */
    it("분석 화면의 힌트는 표를 가리키고, 클릭 화면의 힌트는 바이트 불변이다", () => {
      const analytics = readAdminSource("app/analytics/page.tsx");
      expect(analytics).toContain("날짜별 이벤트 수는 위 표에서 볼 수 있어요.");
      // 표가 서지 못한 응답에서만 종전 문장이 남는다(그때는 마우스가 유일한 경로인 것이 사실이다).
      expect(analytics).toContain("trend.showTable");
      expect(analytics).toContain("막대에 마우스를 올리면 날짜별 이벤트 수를 볼 수 있어요. (서울 기준 날짜)");
      const clicks = readAdminSource("app/clicks/page.tsx");
      expect(clicks).toContain("막대에 마우스를 올리면 날짜별 클릭 수를 볼 수 있어요. (서울 기준 날짜)");
      expect(clicks).not.toContain("위 표에서 볼 수 있어요");
    });
  });

  describe("ⓓ 표기는 한 자리에서만 만든다", () => {
    it("수를 글자로 만드는 자리가 이 모듈에 하나뿐이다", () => {
      const module = readAdminSource("src/lib/analytics-trend-view.ts");
      expect((module.match(/toLocaleString\(/g) ?? []).length, "추이 모듈의 표기 자리는 하나다").toBe(1);
      expect(module).toContain('count.toLocaleString("ko-KR")');
      // 새 표기 규칙 0건 — 종전 두 화면이 쓰던 그 한 줄이다.
      expect(module).not.toContain("Intl.NumberFormat");
      expect(module).not.toContain("toFixed");
    });

    it("두 화면의 추이 카드 안에는 표기 호출이 남지 않는다", () => {
      for (const path of ["app/analytics/page.tsx", "app/clicks/page.tsx"]) {
        const source = readAdminSource(path);
        const cardStart = source.indexOf("<h2>일별 추이");
        expect(cardStart, `${path}: 일별 추이 카드 제목이 소스에 없어요`).toBeGreaterThan(-1);
        const card = source.slice(cardStart);
        expect(card.length, `${path}: 일별 추이 카드를 찾지 못했어요`).toBeGreaterThan(200);
        expect(card, `${path}: 추이 카드가 표기를 다시 짓지 않는다`).not.toContain("toLocaleString");
      }
    });

    it("단위는 두 화면이 세는 것과 같다", () => {
      expect(formatTrendCount(0, "건")).toBe("0건");
      expect(formatTrendCount(1234567, "회")).toBe("1,234,567회");
    });
  });

  describe("ⓔ 외부 차트 라이브러리 0건", () => {
    it("모듈과 두 화면 어디에도 차트 의존성이 없다", () => {
      for (const path of ["src/lib/analytics-trend-view.ts", "app/analytics/page.tsx", "app/clicks/page.tsx"]) {
        expect(readAdminSource(path), `${path}에 차트 라이브러리 import가 있어요`).not.toMatch(
          /from ["'](recharts|chart\.js|d3|victory|nivo|echarts)/
        );
      }
      // 이 모듈은 어드민 밖(워크스페이스 패키지)도 들지 않는다 — 어드민의 관례 그대로다.
      expect(readAdminSource("src/lib/analytics-trend-view.ts")).not.toMatch(/from ["']@wooriai\//);
      // 순수 표시 모듈이라 어떤 import도 필요하지 않다(타입까지 자기 자리에서 정한다).
      expect(readAdminSource("src/lib/analytics-trend-view.ts")).not.toMatch(/^import /m);
    });

    /**
     * 형식이 비슷하다고 앱의 모듈을 옮겨 쓰지 않는다 — 한쪽은 **달**이고 이쪽은 **날짜**다.
     * (`apps/mobile/src/reports/trend-point-labels.ts`는 이 트랙의 무접촉 대상이다.)
     */
    it("모바일의 추이 라벨 모듈을 옮겨 쓰지 않는다", () => {
      const module = readAdminSource("src/lib/analytics-trend-view.ts");
      // 머리말은 그 파일을 **무접촉 대상으로 이름 붙여** 둔다 — 금지되는 것은 인용이 아니라
      // 코드가 그것을 끌어오는 것이다.
      expect(module).toContain("trend-point-labels.ts");
      expect(module).not.toMatch(/from ["'][^"']*trend-point-labels/);
      expect(module).not.toMatch(/from ["'][^"']*apps\/mobile/);
    });
  });
});
