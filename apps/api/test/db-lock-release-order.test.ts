import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assertReleaseOrderingGuarantee, findConcurrentRuns } from "./helpers/shared-db-lock";

/**
 * 라운드 61 A — 공유 DB 락의 **반납 순서 불변식**을 런타임에 고정하는 하네스 테스트.
 * DB 불필요.
 *
 * 배경(재현·근거는 docs/5차/round61-backlog.md B-1): `db-lock.setup.ts`는 락 반납을
 * `afterAll(release)`로 예약한다. 그 반납이 "이 스위트는 DB를 더는 건드리지 않는다"를
 * 뜻하려면 스위트 자신의 정리 훅보다 **뒤에** 돌아야 한다. setup의 훅이 가장 먼저
 * 등록되므로 after 훅을 역순·순차로 도는 `sequence.hooks: "stack"`에서만 그것이 성립하고,
 * "parallel"이면 정리와 동시에, "list"면 정리보다 먼저 반납된다.
 *
 * 그 조건이 깨지면 증상은 **1/3 확률의 플레이크**로만 나타난다 — 전역 델타를 세는 배타
 * 스위트가 앞 스위트의 DELETE 위에서 스냅샷을 찍을 때만 빨개진다. 그래서 조건 자체를
 * 여기서 직접 재현해 둔다: 산문이나 설정 파일 읽기가 아니라, 이 파일의 훅이 실제로 어떤
 * 순서로 도는지를 본다.
 */

/** 아래 두 afterAll이 실제로 돈 순서. 늦게 등록한 쪽이 먼저 들어와야 한다. */
const ranInOrder: string[] = [];

/**
 * **먼저** 등록되는 훅 = `db-lock.setup.ts`의 `afterAll(release)`와 같은 자리.
 *
 * "stack"에서는 이 훅이 마지막에, 그것도 늦게 등록된 훅이 **await까지 끝난 뒤에** 돈다.
 *   - "parallel"이면 둘이 동시에 시작해 늦은 훅의 50ms가 아직 안 끝났으므로 빈 배열,
 *   - "list"면 이 훅이 먼저 돌아 역시 빈 배열이 된다.
 * 둘 다 여기서 빨간불이 된다.
 */
afterAll(() => {
  expect(
    ranInOrder,
    "락 반납(먼저 등록된 afterAll)이 스위트 정리(나중에 등록된 afterAll)보다 뒤에 돌지 " +
      "않았어요. sequence.hooks가 \"stack\"이 아니면 배타 스위트가 이전 스위트의 정리와 " +
      "겹쳐 돌아요 — apps/api/vitest.config.ts의 sequence 설정을 확인해 주세요."
  ).toEqual(["suite-cleanup"]);
});

/** **나중에** 등록되는 훅 = 스위트 자신의 정리(여러 번의 deleteMany 왕복)를 흉내 낸다. */
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  ranInOrder.push("suite-cleanup");
});

const API_ROOT = join(__dirname, "..");

describe("공유 DB 락 — 반납 순서 불변식 (라운드 61 A)", () => {
  it("이 워커에 실제로 적용된 sequence.hooks가 stack이다", () => {
    const hooks = (
      globalThis as { __vitest_worker__?: { config?: { sequence?: { hooks?: unknown } } } }
    ).__vitest_worker__?.config?.sequence?.hooks;

    // 내부 상태라 읽히지 않을 수 있다(가드도 그때는 검사를 건너뛴다). 다만 읽혔다면
    // 반드시 "stack"이어야 한다 — 읽히지 않는다면 그 사실 자체를 남긴다.
    expect(
      hooks === undefined || hooks === "stack",
      `적용된 sequence.hooks가 "${String(hooks)}"예요 — 락 반납이 스위트 정리보다 먼저 돌아요.`
    ).toBe(true);
    expect(
      hooks,
      "__vitest_worker__.config를 읽지 못했어요 — assertReleaseOrderingGuarantee가 조용히 " +
        "no-op이 됐다는 뜻이라, 위 afterAll 순서 검사만 남아요. vitest 버전 변경을 확인해 주세요."
    ).toBe("stack");
  });

  it("vitest.config.ts가 sequence.hooks를 기본값에 맡기지 않고 직접 고정한다", () => {
    const config = readFileSync(join(API_ROOT, "vitest.config.ts"), "utf8");
    expect(config).toMatch(/sequence:\s*\{\s*hooks:\s*"stack"\s*\}/);
  });

  it("가드가 stack이 아닌 값에서 실패하고, 읽을 수 없을 때는 통과시킨다", () => {
    const globalScope = globalThis as { __vitest_worker__?: unknown };
    const original = globalScope.__vitest_worker__;
    try {
      globalScope.__vitest_worker__ = { config: { sequence: { hooks: "parallel" } } };
      expect(() => assertReleaseOrderingGuarantee("some.test.ts")).toThrow(/sequence\.hooks/);

      globalScope.__vitest_worker__ = { config: { sequence: { hooks: "list" } } };
      expect(() => assertReleaseOrderingGuarantee("some.test.ts")).toThrow(/sequence\.hooks/);

      globalScope.__vitest_worker__ = { config: { sequence: { hooks: "stack" } } };
      expect(() => assertReleaseOrderingGuarantee("some.test.ts")).not.toThrow();

      // 내부 구조가 바뀌어 읽히지 않는 경우: 멀쩡한 실행을 세우지 않는다.
      globalScope.__vitest_worker__ = {};
      expect(() => assertReleaseOrderingGuarantee("some.test.ts")).not.toThrow();
    } finally {
      globalScope.__vitest_worker__ = original;
    }
  });

  /**
   * 두 번째 경계: 이 락은 **한 실행 안에서만** 배타를 보장한다(락 디렉터리가 실행 pid로
   * 나뉜다). 같은 DB를 향한 동시 실행은 감지해서 경고하는 것이 전부이므로, 최소한 그
   * 감지가 죽은 실행을 살아 있다고 잘못 세지는 않는지 고정한다.
   */
  it("동시 실행 감지가 죽은 기록을 걷어내고 살아 있는 남의 실행만 센다", () => {
    const registryDir = mkdtempSync(join(tmpdir(), "wooriai-lock-registry-test-"));
    try {
      mkdirSync(registryDir, { recursive: true });
      const record = (pid: number) =>
        JSON.stringify({ pid, startedAt: new Date().toISOString(), lockDir: "/tmp/whatever" });

      // 살아 있는 실행: 확실히 살아 있다고 아는 pid는 이 프로세스뿐이라 그것을 쓴다
      // (아래에서 selfPid를 달리 주어 "남의 실행"으로 보게 만든다).
      writeFileSync(join(registryDir, "self.json"), record(process.pid));
      // 죽은 실행: 어떤 시스템의 pid_max보다도 큰 값이라 kill(pid, 0)이 ESRCH를 준다.
      writeFileSync(join(registryDir, "dead.json"), record(0x7ffffff0));
      writeFileSync(join(registryDir, "garbage.json"), "not json");

      // selfPid를 다른 값으로 주면 self.json은 "남의 실행"으로 잡혀야 한다.
      expect(findConcurrentRuns(registryDir, -1).map((run) => run.pid)).toEqual([process.pid]);
      // 자기 자신은 세지 않는다.
      expect(findConcurrentRuns(registryDir, process.pid)).toEqual([]);
      // 죽은/손상된 기록은 지워져 다음 실행에 쌓이지 않는다.
      expect(readdirSync(registryDir)).toEqual(["self.json"]);
      // 레지스트리가 아예 없을 때도 던지지 않는다.
      expect(findConcurrentRuns(join(registryDir, "nope"), -1)).toEqual([]);
    } finally {
      rmSync(registryDir, { recursive: true, force: true });
    }
  });

  it("모든 스위트가 반드시 지나는 acquireSharedDb가 그 가드를 호출한다", () => {
    const source = readFileSync(join(API_ROOT, "test", "helpers", "shared-db-lock.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function acquireSharedDb"));
    expect(body).toContain("assertReleaseOrderingGuarantee(id);");
    // 락 디렉터리를 읽기 **전에** 검사해야 옵트아웃 경로(WOORIAI_TEST_ALLOW_NO_LOCK)도 덮인다.
    expect(body.indexOf("assertReleaseOrderingGuarantee(id);")).toBeLessThan(body.indexOf("lockDir()"));
  });
});
