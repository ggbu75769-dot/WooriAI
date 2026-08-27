import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_LIST_MAX_LIMIT } from "./client";

/**
 * R25 리뷰 후속: 모바일은 packages/contracts를 import하지 않고 수기로 미러한다
 * (known-limitations §D). REC-124(H1)/CSV-124 이후 기록 탭·홈·CSV의 모든 목록 요청이
 * `limit=EXPENSE_LIST_MAX_LIMIT`를 명시하므로, 서버가 상한을 낮추면(@Max 위반 → 400)
 * 세 화면이 동시에 죽는다. 두 값이 갈라지는 순간을 커밋 시점에 잡는 드리프트 가드다 —
 * manage-children-flow.test.ts 등 기존 수기 미러 계약 테스트와 같은 관례.
 */
describe("contracts 수기 미러 드리프트 가드", () => {
  it("EXPENSE_LIST_MAX_LIMIT이 packages/contracts의 값과 같다", () => {
    const contractsSource = readFileSync(
      join(process.cwd(), "..", "..", "packages", "contracts", "src", "schemas.ts"),
      "utf8"
    );
    const match = contractsSource.match(/export const EXPENSE_LIST_MAX_LIMIT = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(EXPENSE_LIST_MAX_LIMIT);
  });
});
