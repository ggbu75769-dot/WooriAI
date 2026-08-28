import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { afterAll, expect } from "vitest";
import { EXCLUSIVE_SUITES } from "./exclusive-suites";
import { acquireSharedDb } from "./shared-db-lock";

/**
 * 라운드 60 QA — e2e 스위트가 자라며 인메모리 레이트리밋의 **기본값**(전역 300req/60s,
 * auth 30/60s)을 한 파일 안에서 실제로 넘기 시작했다(expense-home-report.e2e가 429).
 * 리밋은 요청 시점에 env를 읽으므로 여기서 시험용 여유 값을 주입한다 — 이 setup은
 * 모든 테스트 파일 로드 전에 실행된다(vitest setupFiles).
 *
 * 프로덕션 방어를 검증하는 security-middleware.e2e는 각 케이스가 자체 값을 설정하고
 * afterEach에서 지우므로(그 파일의 삭제 목록 참고) 이 기본 주입과 무관하게 종전
 * 그대로 동작한다. `??=`라 CI/개발자가 명시한 값이 있으면 그것이 이긴다.
 */
process.env.RATE_LIMIT_GLOBAL_MAX ??= "100000";
process.env.RATE_LIMIT_AUTH_MAX ??= "100000";
process.env.RATE_LIMIT_REDIRECT_MAX ??= "100000";
process.env.RATE_LIMIT_ANALYTICS_MAX ??= "100000";
process.env.RATE_LIMIT_ANALYTICS_USER_MAX ??= "100000";

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

// Top-level await: the gate closes before the test file's own module graph loads, so
// **acquiring** is independent of hook ordering entirely.
//
// 라운드 61 A: 반대쪽인 **반납**은 그렇지 않다. 아래 `afterAll(release)`는 이 파일이 가장
// 먼저 등록하는 훅이므로, after 훅을 역순·순차로 도는 `sequence.hooks: "stack"`에서만
// 스위트 자신의 정리 훅보다 뒤에 돈다 — 그리고 그래야만 "반납 = 이 스위트의 DB 작업 끝"이
// 성립한다. 그 조건은 vitest.config.ts가 고정하고, `acquireSharedDb`가 워커에 실제로 적용된
// 값을 확인한 뒤에야 락을 내준다(shared-db-lock.ts의 `assertReleaseOrderingGuarantee`).
// 순서 자체는 test/db-lock-release-order.test.ts가 런타임에 재현해 고정한다.
const release = await acquireSharedDb(mode, `${suiteFileName}-${randomUUID()}`);

afterAll(release);
