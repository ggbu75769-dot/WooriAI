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
 * 이 모듈을 지나는 운영자 화면 둘과, 각 화면이 세는 것의 이름(분석은 이벤트, 클릭 통계는 클릭).
 *
 * ⚠️ 라운드 88 트랙 A — 추이 카드의 각주·최대치 한 줄·표 이름에 대한 단언은 **이 목록을 함께 돈다**.
 * 한 화면만 무는 단언을 새로 만들면, 그 순간 다른 화면의 같은 자리가 다시 아무도 세지 않는 자리가
 * 된다(이 트랙이 고친 것이 정확히 그 모양이다).
 */
const TREND_SCREENS = [
  ["app/analytics/page.tsx", "이벤트 수"],
  ["app/clicks/page.tsx", "클릭 수"]
] as const;

/**
 * 라운드 86 트랙 D — 운영자 화면 둘의 "일별 추이"가 값을 남긴다.
 *
 * 분석 화면은 값을 `title`(마우스 호버)에만 줬고, 형제 화면(클릭 통계)은 처음부터 날짜·건수
 * 표를 갖고 있었다. 이 모듈은 옳은 형식을 **발명하지 않고** 두 화면이 같은 자리에서 만들게
 * 모은다 — 그래서 계약의 절반이 *"클릭 화면의 글자가 종전과 바이트 단위로 같다"* 이다.
 *
 * ⚠️ 라운드 88 트랙 A — 그 절반은 **모듈이 옮긴 자리에 대한 주장**이었는데, 이 파일이 그것을
 * 클릭 화면의 각주·최대치 부재까지 넓혀 못 박아 두고 있었다. 트랙의 범위를 지킨 옳은 문장이었지만
 * 다음 라운드에는 *결정*으로 읽혔다. 오늘부터 각주·최대치 한 줄·표 이름은 **두 화면이 같은
 * 질문을 함께 받고**(`for (const path of [...])`), 바이트 불변으로 남는 것은 표 머리와 고지다.
 *
 * ⚠️ **두 시점(라운드 88 리뷰 M-1)** — 아래 ⓑ절의 제목은 라운드 86 트랙 D 당시 *"클릭 화면이
 * 그리던 글자와 바이트 단위로 같다 (정상 응답에서)"* 였고, 그때는 참이었다. **라운드 88 트랙 A**가
 * 그 화면에 최대치 한 줄과 갈래 각주를 세운 뒤로는 정상 응답에서도 새 글자가 서므로 그 제목은
 * 거짓이 됐다 — 오늘 ⓑ절이 실제로 무는 것은 **표 머리 두 칸·카드 제목·DNC-009 고지·막대 식**,
 * 즉 트랙 A가 손대지 않은 자리들뿐이다.
 */
describe("analytics-trend-view (라운드 86 트랙 D)", () => {
  describe("ⓑ 형제 동형 — 클릭 화면의 표 머리·카드 제목·고지·막대 식이 바이트 단위로 같다", () => {
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
     * 라운드 86 트랙 D가 클릭 화면에서 바꾼 것은 *어디서 값을 만드는가*뿐이었다 — 표 머리 두 칸과
     * 카드 제목, DNC-009 고지 한 줄은 그때도 오늘도 바이트 불변이다(라운드 88 트랙 A는 그 자리를
     * 손대지 않는다 · 각주와 최대치 한 줄은 이제 아래 두 화면 공통 단언이 문다).
     */
    it("클릭 화면의 표 머리·카드 제목·DNC-009 고지가 종전 그대로다", () => {
      const source = readAdminSource("app/clicks/page.tsx");
      expect(source).toContain("<th>날짜</th>");
      expect(source).toContain("<th>클릭 수</th>");
      expect(source).toContain("<h2>일별 추이 (최근 {summary.days}일)</h2>");
      // DNC-009: 클릭 순위가 추천 점수와 무관하다는 고지.
      expect(source).toContain("※ 클릭 수가 많은 순서예요. 이 순위는 앱의 추천 순서나 추천 점수에 반영되지 않아요.");
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

    /** 주석을 걷어낸 화면 소스 — 갈래 판정은 코드만 본다(화면 주석의 인용을 회귀로 세지 않는다). */
    const screenCode = (path: string): string =>
      readAdminSource(path)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");

    /** 추이 카드 한 덩이 — 제목부터 그 카드를 닫는 `</section>`까지. */
    const trendCard = (path: string): string => {
      const code = screenCode(path);
      const start = code.indexOf("<h2>일별 추이");
      expect(start, `${path}: 일별 추이 카드 제목이 소스에 없어요`).toBeGreaterThan(-1);
      const end = code.indexOf("</section>", start);
      expect(end, `${path}: 추이 카드를 닫는 </section>이 없어요`).toBeGreaterThan(start);
      return code.slice(start, end);
    };

    /** `{trend.showTable ? "…" : "…"}` — 두 팔이 **문자열 리터럴**인 각주 갈래 하나. */
    const SHOW_TABLE_FOOTNOTE = /\{\s*trend\.showTable\s*\?\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*\}/;

    type FootnoteBranch = {
      /** `showTable`이 **참**인 팔의 문장. */
      readonly whenTable: string;
      /** `showTable`이 **거짓**인 팔의 문장. */
      readonly whenNoTable: string;
      readonly start: number;
      readonly end: number;
    };

    const footnoteBranch = (path: string, card: string): FootnoteBranch => {
      const hit = SHOW_TABLE_FOOTNOTE.exec(card);
      expect(hit, `${path}: 각주가 trend.showTable 갈래(문자열 두 팔)로 서 있지 않아요`).not.toBeNull();
      return {
        whenTable: JSON.parse(hit![1]) as string,
        whenNoTable: JSON.parse(hit![2]) as string,
        start: hit!.index,
        end: hit!.index + hit![0].length
      };
    };

    /** 줄바꿈·들여쓰기를 한 칸으로 눌러 **여러 줄로 흩어진 같은 문장**도 한 문장으로 읽는다. */
    const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

    /**
     * ⚠️ 라운드 86 리뷰 L-11 — 표를 세워 놓고도 "마우스를 올리면"만 적어 두면, 그 힌트가 이 카드를
     * 여전히 **마우스 전용**으로 소개한다(이 트랙이 고치려던 바로 그 오해다).
     *
     * ⚠️ 라운드 88 트랙 A — 그때는 분석 화면만 고쳤고, 이 자리가 클릭 화면의 옛 각주를 바이트로
     * 못 박아 두었다. 그러나 그 화면에도 표는 이미 같은 값에서 서 있었다 — 각주가 말하는 유일
     * 경로가 그 화면의 유일 경로가 아니었다. 오늘 두 화면은 **같은 값(`trend.showTable`)에서
     * 같은 갈래**를 받는다.
     *
     * ## ⚠️ 두 시점 — 라운드 88 리뷰 H-2: 이 루프가 잡겠다는 회귀 둘에 초록이었다
     *
     * **라운드 88 트랙 A 당시** 이 단언은 셋만 물었다: 두 문장이 소스에 **있는가** ·
     * `{trend.showTable` 이 **있는가** · 옛 각주의 **한 줄짜리 바이트 형태**가 카드에 없는가.
     * 그 셋은 *"어느 문장이 어느 팔에 있는가"* 를 한 번도 묻지 않았다 —
     *
     *  ① **두 팔을 뒤바꾸면**(표가 선 응답에 "마우스를 올리면") 세 단언이 전부 그대로 참이라
     *     이 카드가 다시 마우스 전용으로 소개되는 동안 계약은 초록이었다.
     *  ② 갈래는 그대로 둔 채 **갈래 밖에 조건 없는 옛 각주를 여러 줄 형태로 하나 더** 세우면,
     *     부재 단언이 `<p className={styles.hint}>막대에 마우스를 올리면` 이라는 **바이트 한 형태**만
     *     보고 있어서 역시 초록이었다.
     *
     * **라운드 88 리뷰 이후**: 갈래를 **파싱해** 두 팔을 값으로 꺼내고(어느 문장이 어느 팔인가),
     * 부재는 바이트 형태가 아니라 **자리로** 묻는다 — 두 문장의 모든 출현이 그 갈래 **안**이어야
     * 한다(줄바꿈을 눌러 보므로 여러 줄 형태도 같이 잡힌다). 두 화면 공통 루프는 그대로다.
     *
     * ⚠️ 남은 한계: 각주를 문자열 리터럴이 아니라 상수·보간으로 옮기면 이 파서가 갈래를 찾지 못하고
     * **그 자리에서 빨개진다**(거짓 초록이 아니라 거짓 빨강 — 그때 이 계약을 함께 고치라는 뜻이다).
     */
    it("두 화면의 각주가 표가 선 팔에서만 표를 가리킨다 (같은 값에서 같은 갈래 · 팔까지 묻는다)", () => {
      for (const [path, countNoun] of TREND_SCREENS) {
        const card = trendCard(path);
        const branch = footnoteBranch(path, card);
        const tableSentence = `날짜별 ${countNoun}는 위 표에서 볼 수 있어요.`;
        const mouseSentence = `막대에 마우스를 올리면 날짜별 ${countNoun}를 볼 수 있어요. (서울 기준 날짜)`;

        // ⓐ **어느 문장이 어느 팔에 있는가** — 표가 서는 팔이 그 표를 가리킨다.
        expect(branch.whenTable, `${path}: 표가 선 팔이 표를 가리키지 않아요`).toContain(tableSentence);
        expect(branch.whenTable, `${path}: 표가 선 팔이 마우스를 유일 경로로 소개해요(두 팔이 뒤바뀌었어요)`).not.toContain(
          mouseSentence
        );
        // ⓑ 종전 문장은 표가 **서지 못한** 팔에만 남는다(그때는 마우스가 유일 경로인 것이 사실이다).
        expect(branch.whenNoTable, `${path}: 표가 못 선 팔이 종전 문장 그대로가 아니에요`).toBe(mouseSentence);
        expect(branch.whenNoTable, `${path}: 표가 못 선 팔이 서지도 않은 표를 가리켜요`).not.toContain(tableSentence);

        // ⓒ 부재는 **자리로** 묻는다: 두 문장은 이 갈래 밖 어디에도 서지 않는다.
        //    (바이트 한 형태가 아니라 갈래 밖 전체를 보므로 여러 줄로 흩어진 각주도 여기서 잡힌다.)
        const outsideBranch = collapse(`${card.slice(0, branch.start)} ${card.slice(branch.end)}`);
        expect(outsideBranch, `${path}: 표 각주가 showTable 갈래 밖에도 서 있어요`).not.toContain(collapse(tableSentence));
        expect(outsideBranch, `${path}: 조건 없는 옛 각주가 갈래 밖에 서 있어요`).not.toContain(collapse(mouseSentence));
      }
    });

    /**
     * ⓒ·ⓓ — 최대치 한 줄과 표 이름도 두 화면이 함께 받는다.
     *
     * 최대치 문장은 **모듈이 짓고**(`trendPeakSentence`) 화면은 값이 있을 때만 그 줄을 세운다 —
     * 화면이 손으로 적는 문구가 0건이라야 두 화면의 표기가 갈리지 않는다. 표 이름은 같은 카드의
     * 막대 그림(role="img")과 겹쳐 읽히지 않게 끝말이 갈린다(그림은 "막대 그래프" · 표는 "표").
     */
    it("두 화면이 최대치 한 줄과 표 이름을 같은 모양으로 받는다", () => {
      for (const [path, countNoun] of TREND_SCREENS) {
        const source = readAdminSource(path);
        expect(source, `${path}: 최대치 한 줄 배선`).toContain(
          "{trend.peakSentence ? <p className={styles.hint}>{trend.peakSentence}</p> : null}"
        );
        // 문장을 화면이 다시 짓지 않는다(모듈이 지은 그 문구만 흐른다).
        expect(source, `${path}: 최대치 문장을 화면이 다시 적어요`).not.toContain("가장 많은 날");
        expect(source, `${path}: 추이 표에 이름이 없어요`).toContain(
          "aria-label={`최근 ${summary.days}일 일별 " + countNoun + " 표`}"
        );
        expect(source, `${path}: 막대 그림의 이름이 갈리지 않아요`).toContain(
          "aria-label={`최근 ${summary.days}일 일별 " + countNoun + " 막대 그래프`}"
        );
      }
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
