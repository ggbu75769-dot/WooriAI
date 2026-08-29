/**
 * PERF-130 — the authoritative list of test files that must own the shared test
 * database alone. `db-lock.setup.ts` reads it to decide each file's lock mode; every
 * other mention in the repo (comments, docs) should point at this constant rather than
 * repeat a count, which is how the "four suites"/"~66 files" prose went stale
 * (R31 리뷰 F1).
 *
 * 라운드 51 D-#4: 목록이 여기(별도 모듈)에 사는 이유는 **검증 가능하게** 하기 위해서다.
 * `db-lock.setup.ts`는 최상위 await로 락을 잡는 setup 파일이라, 테스트가 그 모듈을
 * import하는 순간 락을 한 번 더 잡는다 — 즉 목록을 그 파일에 두면 "여기 적힌 파일이
 * 실제로 존재하는가"를 테스트가 확인할 방법이 없었다. 이름이 바뀌거나 삭제된 스위트가
 * 목록에 남아도 아무도 모르고, 그 스위트는 **조용히** shared로 강등돼 배타가 필요한
 * 이유(전역 델타·시드 스냅샷·전역 삭제)가 그대로 플레이크가 된다. 하네스 테스트
 * (test/exclusive-suites.test.ts)가 이 상수를 직접 읽어 실재를 고정한다.
 *
 * Almost every suite scopes what it reads and writes to identifiers it generated
 * itself (see the note at the bottom of test/helpers/test-db.ts) and so runs fully in
 * parallel. The entries below are exceptions because they read or write state that is
 * database-wide by definition:
 *
 *   - the three admin aggregate suites snapshot a total before and after and assert
 *     on the delta, and those endpoints count every row in wooriai_test. They also
 *     reconcile two fields of a SINGLE response against each other (dailyTotals sum
 *     == windowTotal, byPlatform sum == totalClicks); the service computes those with
 *     separate concurrent queries, so even one foreign INSERT landing between them
 *     makes an honest response fail the reconciliation;
 *   - `categories.e2e` pins the exact seeded category list (12 selectable / 21 total),
 *     which any suite that inserts a category would change;
 *   - `data-retention-purge` runs the purge job, which deletes withdrawn users and
 *     orphaned households across the whole database — including rows other suites
 *     are still using. GAP-067 #7 added a second database-wide write to the same
 *     job (phase 10a marks every lapsed `pending` family invite `expired`), which
 *     this entry already covers.
 *
 * TEST-132 removed `link-health.db` from this list — it was never an original entry:
 * the round-30 review (F2) added it here to stop a global write from trampling other
 * suites, and TEST-132 removed the global write instead. It used to mark every product
 * link outside its own fixtures as freshly checked (a `updateMany` over the whole
 * table) so that the job's global candidate batch would only contain its own rows —
 * a database-wide write that trampled other suites' links. The job's candidate query
 * is still global, so the suite now bounds the *population* instead of writing to it:
 * the Prisma client it hands the job ANDs `id IN (its own links)` onto the job's own
 * `findMany` where clause, leaving the job's conditions, ordering and batch cap
 * untouched. Exact-count assertions (`checked: N`) survive intact, and a harness test
 * asserts the scope really is in effect so it cannot silently regress to global.
 *
 * TEST-131 removed `items-commerce` from this list. Nothing in it verified global
 * state: it compared a `tab=all` snapshot against the union of the four status tabs
 * (now scoped to the catalog rows that provably existed for the whole test, so a
 * template another suite creates or drops mid-test cannot skew either side), and two
 * of its tests corrupted a *seeded* product link's URL in place to exercise the click
 * guards (now their own throwaway 준비템 + 링크, so a parallel suite clicking the
 * seeded link can never see the corrupted row). See that file for the details.
 *
 * See test/helpers/shared-db-lock.ts for the protocol. Add a file here only if it
 * genuinely cannot scope itself — an exclusive suite stalls the whole worker pool
 * while it runs, so the list is a cost, not a default.
 */
export const EXCLUSIVE_SUITES: ReadonlySet<string> = new Set([
  "admin-dashboard-summary.e2e.test.ts",
  "admin-analytics-summary.e2e.test.ts",
  "admin-affiliate-click-breakdown.e2e.test.ts",
  "categories.e2e.test.ts",
  "data-retention-purge.db.test.ts"
]);
