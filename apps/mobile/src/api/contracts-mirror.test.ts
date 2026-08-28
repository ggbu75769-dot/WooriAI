import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_LIST_MAX_LIMIT, TREND_REPORT_DEFAULT_MONTHS } from "./client";
import { LINK_PRICE_MAX_AGE_DAYS } from "../items/link-price";

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

  /**
   * 라운드 64 M-2 — 가격 스냅샷 만료 문턱도 같은 수기 미러다(계약과 모바일 두 벌).
   *
   * 두 값이 갈라지면 조용히 틀린다: 어드민 표의 "만료" 배지는 **서버가 계약 상수로** 판정한
   * `priceExpired`를 그리고, 앱은 자기 상수로 그릴지 말지를 정한다. 문턱이 어긋나는 순간
   * 어드민은 "앱에 보인다"고 말하는데 앱은 안 그리는(혹은 그 반대) 상태가 되고, 그 표가
   * 드러내려던 '조용한 만료'를 표 자신이 틀리게 보고한다.
   *
   * 계약 주석이 근거로 들던 `apps/api/test/mobile-link-price-contract.test.ts`는 존재한 적이
   * 없었다 — 그래서 가드를 여기(이미 있는 수기 미러 계약 파일)에 세우고 그 주석을 정정했다.
   */
  it("LINK_PRICE_MAX_AGE_DAYS가 packages/contracts의 값과 같다", () => {
    const match = contractsSchemasSource().match(/export const LINK_PRICE_MAX_AGE_DAYS = (\d+);/);
    expect(match, "packages/contracts에서 LINK_PRICE_MAX_AGE_DAYS를 찾지 못했다").not.toBeNull();
    expect(Number(match![1])).toBe(LINK_PRICE_MAX_AGE_DAYS);
  });

  /**
   * 라운드 42 L-7 — `ImportJob.childId`가 양쪽에 남아 있는지 고정한다.
   *
   * 이 필드는 라운드 41 K-2가 응답 계약에 새로 실은 값이고, 검수 화면(app/import/[importJobId].tsx)의
   * "대상 아이" 표시가 **오직 이 값**에 걸려 있다 -- 선택 아이 스토어로 되돌아가면 아이를 바꾼 뒤
   * 예전 검수 링크에서 헤더가 틀린 이름을 확신에 차서 보여 주고, 그대로 수백 건이 엉뚱한 아이의
   * 가계부로 확정된다. 모바일은 contracts를 import하지 않고 수기로 미러하므로(known-limitations §D),
   * 서버 계약에서 이 필드가 빠지는 순간을 커밋 시점에 잡는 드리프트 가드를 둔다.
   */
  it("L-7: ImportJob.childId가 서버 계약과 모바일 미러 양쪽에 있다", () => {
    const contractsSource = contractsSchemasSource();
    const importJobBlock = contractsSource.slice(
      contractsSource.indexOf("export const importJobSchema = z.object({"),
      contractsSource.indexOf("export const importRowSchema = z.object({")
    );
    expect(importJobBlock).toContain("childId: uuidSchema,");

    const clientSource = readFileSync(join(process.cwd(), "src", "api", "client.ts"), "utf8");
    const mirrorBlock = clientSource.slice(
      clientSource.indexOf("export type ImportJob = {"),
      clientSource.indexOf("export type ImportRow = {")
    );
    expect(mirrorBlock).toContain("childId: string;");
  });
});
