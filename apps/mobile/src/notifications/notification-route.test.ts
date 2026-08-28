import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRecordsCalendarViewParam,
  notificationTapRoute,
  RECORDS_CALENDAR_VIEW,
  RECORDS_VIEW_PARAM
} from "./notification-route";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 39 UX-O: 알림 탭 목적지 판정.
 *
 * 회귀의 핵심은 weekly_summary다 -- 예산 알림과 한 조건으로 묶여 예산 **수정 폼**으로 가고
 * 있었는데, 그 알림 본문은 "지출 내역을 확인해보세요"다. 종류별 목적지를 값으로 못박는다.
 */
describe("라운드 39 UX-O 알림 탭 목적지", () => {
  it("주간 요약은 지출 내역으로 간다 (예산 수정 폼이 아니라)", () => {
    const route = notificationTapRoute({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W34" });
    expect(route).toBe("/(tabs)/records");
    expect(route).not.toBe("/budget");
  });

  it("예산 80%/100% 알림은 그대로 예산 화면으로 간다", () => {
    expect(notificationTapRoute({ type: "budget_80", dedupeKey: "budget_80:child-1:2026-08" })).toBe("/budget");
    expect(notificationTapRoute({ type: "budget_100", dedupeKey: "budget_100:child-1:2026-08" })).toBe("/budget");
  });

  it("시기 전환 알림은 준비템 탭으로 간다", () => {
    expect(notificationTapRoute({ type: "stage_transition", dedupeKey: "stage_transition:child-1:12개월" })).toBe(
      "/(tabs)/items"
    );
  });

  it("구매 확인 알림은 그 준비템 상세로 간다", () => {
    expect(notificationTapRoute({ type: "purchase_pending", dedupeKey: "purchase_pending:item-diaper:1700000000000" })).toBe(
      "/items/item-diaper"
    );
  });

  it("dedupeKey에서 준비템을 못 뽑거나 모르는 종류면 준비템 목록으로 떨어진다 (기존 폴백 그대로)", () => {
    expect(notificationTapRoute({ type: "purchase_pending", dedupeKey: "purchase_pending" })).toBe("/(tabs)/items");
    expect(notificationTapRoute({ type: "something_new", dedupeKey: "something_new:1" })).toBe("/(tabs)/items");
  });
});

/**
 * 라운드 56 트랙 D(#10) — 기록 리마인더는 **달력**으로 착지한다.
 *
 * 왜 값으로 못박는가: 이 알림이 말하는 사실("며칠 동안 기록이 없어요")은 리스트에 **없는 것**이다.
 * 목적지만 기록 탭으로 두면 사용자는 있는 기록의 목록을 보게 되고, 알림이 가리킨 빈 며칠은 화면
 * 어디에도 나타나지 않는다. 빈 날을 보여 주는 화면은 달력 격자 하나뿐이다(UX-D).
 */
describe("라운드 56 D#10 record_gap 달력 착지", () => {
  it("record_gap은 기록 탭 + view=calendar를 싣는다 (다른 종류는 예전 그대로 문자열 목적지)", () => {
    expect(notificationTapRoute({ type: "record_gap", dedupeKey: "record_gap:child-1:2026-W34" })).toEqual({
      pathname: "/(tabs)/records",
      params: { [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW }
    });
    // 주간 요약은 "지출 내역"을 말하므로 리스트 그대로다 -- 달력 파라미터가 번지지 않는다.
    expect(notificationTapRoute({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W34" })).toBe(
      "/(tabs)/records"
    );
  });

  it("파라미터 이름·값은 링크를 만드는 쪽과 읽는 쪽의 단일 소스다", () => {
    expect(RECORDS_VIEW_PARAM).toBe("view");
    expect(RECORDS_CALENDAR_VIEW).toBe("calendar");
    // 읽는 쪽(기록 탭)이 이 모듈의 상수·파서를 그대로 쓴다 -- 문자열을 두 번 적으면 "보내는데
    // 읽지 못하는" 조합이 조용히 생긴다(category-drilldown.ts P3-6과 같은 요지).
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain(
      'import { isRecordsCalendarViewParam, RECORDS_VIEW_PARAM } from "../../src/notifications/notification-route";'
    );
    expect(recordsSource).toContain("const viewParam = monthParams[RECORDS_VIEW_PARAM];");
  });

  it("읽기 쪽 방어: 배열이면 첫 값, 모르는 값이면 false (파라미터가 없던 때와 같다)", () => {
    expect(isRecordsCalendarViewParam("calendar")).toBe(true);
    expect(isRecordsCalendarViewParam(["calendar", "list"])).toBe(true);
    for (const raw of [undefined, null, "", "list", "CALENDAR", "달력", [], ["list"]] as const) {
      expect(isRecordsCalendarViewParam(raw as string | string[] | null | undefined), String(raw)).toBe(false);
    }
  });

  /**
   * 재적용 규율(라운드 51 C-#11 · 라운드 52 QA P1-1/P2-1과 같은 계약): 기록 탭은 한 번 열리면
   * 계속 마운트된 채로 남으므로, 가드가 없으면 재렌더·뒤로가기·아이 전환마다 사용자가 방금 고른
   * 리스트를 달력으로 되돌린다.
   */
  it("기록 탭은 view 파라미터를 1회 적용하고 소모한다 (뒤로/재진입이 보기를 재강제하지 않는다)", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain("const appliedViewParamRef = useRef(false);");
    const effectStart = recordsSource.indexOf("if (appliedViewParamRef.current) return;");
    expect(effectStart).toBeGreaterThan(0);
    const effect = recordsSource.slice(effectStart, effectStart + 260);
    expect(effect).toContain("if (!isRecordsCalendarViewParam(viewParam)) return;");
    expect(effect).toContain("appliedViewParamRef.current = true;");
    expect(effect).toContain("setRecordsViewMode(RECORDS_VIEW_MODE_CALENDAR);");
    // 소모 표시가 적용보다 **먼저** 서야 한 커밋에서 두 번 돌아도 한 번만 적용된다.
    expect(effect.indexOf("appliedViewParamRef.current = true;")).toBeLessThan(
      effect.indexOf("setRecordsViewMode(RECORDS_VIEW_MODE_CALENDAR);")
    );
  });

  it("DSN-053 기록 탭 디자인 불변: 달 내비 48dp·비활성 opacity와 세그먼트 배선이 그대로다", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain("minHeight: theme.touchTarget, minWidth: theme.touchTarget");
    expect(recordsSource).toContain("opacity: canGoNextMonth ? 1 : 0.35");
    expect(recordsSource).toContain("<SegmentedControl options={RECORDS_VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />");
    expect(recordsSource).toContain('const RECORDS_VIEW_LIST = "리스트"');
    expect(recordsSource).toContain('const RECORDS_VIEW_CALENDAR = "달력"');
  });
});
