import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { afterAll, expect } from "vitest";
import { EXCLUSIVE_SUITES } from "./exclusive-suites";
import { acquireSharedDb } from "./shared-db-lock";

/**
 * PERF-130 setup file: gates every test file on the shared-database readers/writer
 * lock before the file itself is loaded. Registered via `setupFiles` in
 * vitest.config.ts, so no individual suite has to know the mechanism exists.
 *
 * *Which* suites need the database to themselves — and why each one does — lives in
 * test/helpers/exclusive-suites.ts (`EXCLUSIVE_SUITES`); this file only applies it.
 * See test/helpers/shared-db-lock.ts for the locking protocol itself.
 */

// Vitest populates the worker's test path before it executes setup files, so this
// resolves to the file this setup run belongs to.
//
// 라운드 51 D-#4: 비어 있으면 **던진다**. 예전에는 `?? ""`로 흘려보냈는데,
// basename("")은 ""이고 ""는 EXCLUSIVE_SUITES에 없으므로 배타 스위트가 조용히 shared로
// 강등됐다 — 그러면 전역 델타를 세는 admin-dashboard-summary 같은 스위트가 다른 파일과
// 겹쳐 돌면서 간헐적으로 실패한다(원인은 로그 어디에도 남지 않는다). 락 모드를 정할 수
// 없다는 것은 이 게이트가 아무것도 보장하지 못한다는 뜻이므로, 잘못된 통과 대신 즉시
// 실패한다.
const testPath = expect.getState().testPath;
if (!testPath) {
  throw new Error(
    "[db-lock.setup] 이 setup 실행이 어느 테스트 파일의 것인지 알 수 없어요 " +
      "(expect.getState().testPath가 비어 있음). 배타 스위트가 조용히 공유 모드로 " +
      "강등되는 것을 막기 위해 여기서 중단해요 — vitest 버전/실행 방식을 확인해 주세요."
  );
}

const suiteFileName = basename(testPath);
const mode = EXCLUSIVE_SUITES.has(suiteFileName) ? "exclusive" : "shared";

// Top-level await: the gate closes before the test file's own module graph loads,
// which keeps it independent of `sequence.hooks` ordering between this setup file's
// hooks and the suite's.
const release = await acquireSharedDb(mode, `${suiteFileName}-${randomUUID()}`);

afterAll(release);
