import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_LIST_MAX_LIMIT, TREND_REPORT_DEFAULT_MONTHS } from "./client";

const contractsSchemasSource = () =>
  readFileSync(join(process.cwd(), "..", "..", "packages", "contracts", "src", "schemas.ts"), "utf8");

/**
 * R25 리뷰 후속: 모바일은 packages/contracts를 import하지 않고 수기로 미러한다
 * (known-limitations §D). REC-124(H1)/CSV-124 이후 기록 탭·홈·CSV의 모든 목록 요청이
 * `limit=EXPENSE_LIST_MAX_LIMIT`를 명시하므로, 서버가 상한을 낮추면(@Max 위반 → 400)
 * 세 화면이 동시에 죽는다. 두 값이 갈라지는 순간을 커밋 시점에 잡는 드리프트 가드다 —
 * manage-children-flow.test.ts 등 기존 수기 미러 계약 테스트와 같은 관례.
 */
describe("contracts 수기 미러 드리프트 가드", () => {
  it("EXPENSE_LIST_MAX_LIMIT이 packages/contracts의 값과 같다", () => {
    const match = contractsSchemasSource().match(/export const EXPENSE_LIST_MAX_LIMIT = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(EXPENSE_LIST_MAX_LIMIT);
  });

  /**
   * REP-128: 리포트 월간 탭이 요청하는 추이 개월 수도 같은 수기 미러다. 서버 상한
   * (TREND_REPORT_MAX_MONTHS)을 넘으면 @Max 위반 → 400이라 추이 차트가 통째로 죽으므로,
   * 기본값이 상한 안에 있는지까지 함께 못 박는다.
   */
  it("TREND_REPORT_DEFAULT_MONTHS가 packages/contracts의 값과 같고 서버 상한 안에 있다", () => {
    const source = contractsSchemasSource();
    const defaultMatch = source.match(/export const TREND_REPORT_DEFAULT_MONTHS = (\d+);/);
    const maxMatch = source.match(/export const TREND_REPORT_MAX_MONTHS = (\d+);/);
    expect(defaultMatch).not.toBeNull();
    expect(maxMatch).not.toBeNull();
    expect(Number(defaultMatch![1])).toBe(TREND_REPORT_DEFAULT_MONTHS);
    expect(TREND_REPORT_DEFAULT_MONTHS).toBeGreaterThanOrEqual(1);
    expect(TREND_REPORT_DEFAULT_MONTHS).toBeLessThanOrEqual(Number(maxMatch![1]));
  });
});
