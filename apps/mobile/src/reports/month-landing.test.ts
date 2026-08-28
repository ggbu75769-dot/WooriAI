import { describe, expect, it } from "vitest";
import { RECORDS_MONTH_PARAM } from "../expenses/import-landing-month";
import { RECORDS_DRILLDOWN_NONCE_PARAM } from "./category-drilldown";
import {
  buildReportsMonthLandingTarget,
  resolveReportsMonthLandingNonceParam,
  resolveReportsMonthLandingParam,
  REPORTS_MONTH_NONCE_PARAM,
  REPORTS_MONTH_PARAM,
  REPORTS_TAB_PATHNAME
} from "./month-landing";

/**
 * GAP-066 트랙 A(#2 후속) — 리포트 탭의 **달 착지 파라미터**(값 + 회차).
 *
 * 만드는 쪽의 첫 소비자는 라운드 66 E("지난달 정리" 알림)다. 그 트랙이 이름·형식·방어를 다시
 * 적지 않도록, 규약을 이 모듈 하나에 두고 계약을 여기서 고정한다.
 */

const TODAY = "2026-08-27";

describe("리포트 달 착지 — 규약", () => {
  it("달 파라미터 이름은 기록 탭과 **같은 글자**다 (목적지마다 규약을 외우지 않게)", () => {
    expect(REPORTS_MONTH_PARAM).toBe(RECORDS_MONTH_PARAM);
    expect(REPORTS_TAB_PATHNAME).toBe("/(tabs)/reports");
    // 회차 파라미터는 드릴다운과 **다른 이름**이어야 한다(같은 화면에 두 착지가 섞이지 않게).
    expect(REPORTS_MONTH_NONCE_PARAM).not.toBe(RECORDS_DRILLDOWN_NONCE_PARAM);
  });

  it("링크는 달과 회차를 함께 싣는다", () => {
    expect(buildReportsMonthLandingTarget({ yearMonth: "2026-07", nonce: 3, todayIso: TODAY })).toEqual({
      pathname: "/(tabs)/reports",
      params: { month: "2026-07", monthJump: "3" }
    });
  });

  it("갈 수 없는 달·말이 안 되는 회차에는 링크를 만들지 않는다 (엉뚱한 달에 내려놓지 않는다)", () => {
    expect(buildReportsMonthLandingTarget({ yearMonth: "2026-09", nonce: 1, todayIso: TODAY })).toBeNull();
    expect(buildReportsMonthLandingTarget({ yearMonth: "2026-13", nonce: 1, todayIso: TODAY })).toBeNull();
    expect(buildReportsMonthLandingTarget({ yearMonth: "1990-01", nonce: 1, todayIso: TODAY })).toBeNull();
    expect(buildReportsMonthLandingTarget({ yearMonth: "2026-07", nonce: 1.5, todayIso: TODAY })).toBeNull();
    expect(buildReportsMonthLandingTarget({ yearMonth: "2026-07", nonce: -1, todayIso: TODAY })).toBeNull();
  });
});

describe("리포트 달 착지 — 읽기 쪽 방어", () => {
  it("배열이면 첫 값만 보고, 형식이 어긋나면 null이다 (파라미터가 없던 때와 같은 동작)", () => {
    expect(resolveReportsMonthLandingParam("2026-07")).toBe("2026-07");
    expect(resolveReportsMonthLandingParam(["2026-07", "2026-06"])).toBe("2026-07");
    expect(resolveReportsMonthLandingParam("2026-13")).toBeNull();
    expect(resolveReportsMonthLandingParam("2026-7")).toBeNull();
    expect(resolveReportsMonthLandingParam(undefined)).toBeNull();
    expect(resolveReportsMonthLandingParam(null)).toBeNull();
  });

  it("회차는 숫자 문자열만 통과하고, 비교는 문자열 그대로다", () => {
    expect(resolveReportsMonthLandingNonceParam("7")).toBe("7");
    expect(resolveReportsMonthLandingNonceParam(["7", "8"])).toBe("7");
    expect(resolveReportsMonthLandingNonceParam("007")).toBe("007");
    expect(resolveReportsMonthLandingNonceParam("1234567890123")).toBeNull();
    expect(resolveReportsMonthLandingNonceParam("abc")).toBeNull();
    expect(resolveReportsMonthLandingNonceParam(undefined)).toBeNull();
  });
});
