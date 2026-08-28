import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXCLUSIVE_SUITES } from "./helpers/exclusive-suites";

/**
 * 라운드 51 D-#4 — 배타 스위트 목록의 **조용한 강등**을 막는 하네스 테스트. DB 불필요.
 *
 * 배경: `test/helpers/db-lock.setup.ts`는 파일 basename이 EXCLUSIVE_SUITES에 있으면
 * 배타로, 없으면 공유로 락을 잡는다. 판정이 "이름이 목록에 있는가" 하나이므로, 목록에
 * **존재하지 않는 파일명**이 남아 있어도 아무 신호가 없다 — 그 스위트는 이름이 바뀐
 * 순간부터 공유 모드로 조용히 강등되고, 전역 델타(admin-dashboard-summary 등)를 세는
 * 단언이 다른 파일과 겹칠 때만 간헐적으로 깨진다. 목록이 사실과 어긋나는 순간을
 * 커밋 시점에 빨갛게 만든다.
 */
const TEST_DIR = __dirname;

describe("EXCLUSIVE_SUITES 정합 가드 (PERF-130 / 라운드 51 D-#4)", () => {
  it("목록의 모든 항목이 test/ 아래에 실재하는 테스트 파일이다", () => {
    const missing = [...EXCLUSIVE_SUITES].filter((fileName) => !existsSync(join(TEST_DIR, fileName)));
    expect(missing, `EXCLUSIVE_SUITES에 없는 파일이 남아 있어요: ${missing.join(", ")}`).toEqual([]);
  });

  it("목록의 항목이 경로가 아닌 basename이다 (db-lock.setup이 basename으로 비교한다)", () => {
    for (const fileName of EXCLUSIVE_SUITES) {
      expect(basename(fileName)).toBe(fileName);
      expect(fileName).toMatch(/\.test\.ts$/);
    }
  });

  it("db-lock.setup이 목록 모듈을 그대로 쓰고, testPath가 비면 조용히 넘어가지 않는다", () => {
    const setupSource = readFileSync(join(TEST_DIR, "helpers", "db-lock.setup.ts"), "utf8");
    // 목록의 단일 출처: setup 파일이 자체 사본을 들지 않는다.
    expect(setupSource).toContain('from "./exclusive-suites"');
    expect(setupSource).not.toContain("new Set([");
    // `testPath ?? ""` 형태의 조용한 폴백이 되살아나면 여기서 잡힌다.
    expect(setupSource).not.toMatch(/testPath\s*\?\?/);
    expect(setupSource).toContain("throw new Error");
  });

  it("락 디렉터리가 없을 때 acquireSharedDb가 옵트아웃 없이 그냥 통과하지 않는다", () => {
    const lockSource = readFileSync(join(TEST_DIR, "helpers", "shared-db-lock.ts"), "utf8");
    expect(lockSource).toContain("WOORIAI_TEST_ALLOW_NO_LOCK");
    expect(lockSource).toContain("console.warn");
  });

  /**
   * 반대 방향(목록에서 빠졌는데 배타가 필요한 스위트)은 여기서 자동으로 잡지 않는다.
   * 산문에서 "배타"를 언급하는 파일을 세는 방식은 이미 배타를 **뗀** 경위를 설명하는
   * 파일(link-health.db / items-commerce)까지 걸어 오탐만 남겼다. 어떤 스위트가 전역
   * 상태를 보는지는 그 스위트의 단언을 읽어야 아는 판단이라, 목록에 넣는 순간의 근거를
   * exclusive-suites.ts 주석에 남기는 기존 관례를 그대로 유지한다.
   */
});
