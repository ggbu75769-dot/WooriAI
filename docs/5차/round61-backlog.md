# 라운드 61 백로그

라운드 60 통합 리뷰에서 **코드 수정을 라운드 61로 미루기로 한** 항목을 근거와 재현 절차까지 적어
둔다. 이 문서에 있는 것은 "다음 라운드에 고칠 것"이지 "수용한 위험"이 아니다 — 수용한 위험은
`docs/operations/known-limitations.md`가 든다.

---

## B-1. api 테스트 스위트의 배타 락 구멍 — 배타 스위트끼리 겹쳐 돈다

> **상태: 라운드 61 트랙 A에서 봉합 완료.** 다만 봉합한 것은 아래 라운드 60이 적어 둔 결함이
> **아니다** — 그 전제(“vitest 2.x의 `sequence.hooks` 기본값은 `parallel`”)가 실측 결과
> 사실이 아니었다. 실제로 무엇이 열려 있었고 무엇을 닫았는지는 맨 아래
> [라운드 61 A 결과](#라운드-61-a-결과-2026-08-28)를 읽어라. 이 절의 나머지는 라운드 60의
> 기록으로 그대로 둔다(정정 표시만 붙였다).

- **관측**: 라운드 60 QA(C-11g)에서 `pnpm --filter api test`가 **3회 중 1회** 꼴로 배타 등재
  스위트에서 깨졌다(전역 델타/합계 대조 단언). 같은 파일을 단독으로 돌리면 언제나 통과한다.
- **범위**: 테스트 하네스만. 프로덕션 코드·런타임 동작과는 무관하다.
- **관련 파일**: `apps/api/test/helpers/shared-db-lock.ts`,
  `apps/api/test/helpers/db-lock.setup.ts`, `apps/api/test/helpers/exclusive-suites.ts`,
  `apps/api/vitest.config.ts`.

### 무엇이 잘못돼 있나 (⚠️ 전제가 틀렸다 — 라운드 61 A 정정)

`db-lock.setup.ts`는 setupFiles로 실행되며 최상위 await로 락을 잡고, 반납은
`afterAll(release)`로 예약한다. **vitest 2.x의 `sequence.hooks` 기본값은 `parallel`**이므로 이
`afterAll`은 테스트 파일 자신의 루트 `afterAll`(픽스처 정리 · `app.close()`)과 **동시에** 돈다.
이 사실 자체는 저장소도 이미 알고 있다 — `shared-db-lock.ts`의 `READER_DRAIN_SETTLE_MS` 주석이
정확히 그 이유로 250ms 유예를 두고 있다.

문제는 그 보정이 **리더 → 라이터 방향에만** 있다는 것이다. 반대 방향, 즉 **떠나는 배타 스위트**에는
어떤 보정도 없다:

1. 배타 스위트 A의 마지막 테스트가 끝난다. 루트 `afterAll` 둘이 **동시에** 시작한다 —
   ⓐ A 자신의 정리(여러 번의 `deleteMany` 왕복), ⓑ `release()`.
2. `release()`는 동기 `rmSync` 한 번이라 즉시 끝난다. ⓐ는 아직 DB에 붙어 있다.
3. 배타 스위트 B가 25ms 폴링에서 마커를 잡는다. **배타 스위트는 리더 파일을 발행하지 않으므로**
   `acquireExclusive`의 배출 대기(`readersPresent`)에는 A가 아예 보이지 않는다 — 0명으로 읽히고
   곧바로 통과한다.
4. B는 250ms 유예 뒤 Nest를 띄우고 "before" 스냅샷을 찍는다. 그 사이 A의 DELETE가 계속 착지한다.
5. B의 전역 델타(before/after 차이)나 한 응답 안의 두 필드 대조(`dailyTotals` 합 == `windowTotal`,
   `byPlatform` 합 == `totalClicks`)가 외래 변경을 만나 깨진다.

같은 창으로 **shared 리더들도** 동시에 들어온다(마커가 사라졌으므로). 그쪽은 대개 자기 식별자만
읽고 쓰도록 스코프돼 있어 증상이 드물지만, 원인은 하나다: **락 반납이 그 스위트의 DB 작업 종료를
뜻하지 않는다.**

`READER_DRAIN_SETTLE_MS`(250ms)가 이 구멍을 부분적으로 가려 준다. 그래서 실패가 3회 중 1회처럼
확률적으로 나타난다 — A의 정리가 250ms + Nest 부팅 시간 안에 끝나면 그 실행은 통과한다.

### 재현 절차

1. postgres 준비: `pg_isready || service postgresql start`.
2. 그대로 반복 실행해 확률 재현(관측된 비율 ≈ 1/3):
   ```bash
   for i in 1 2 3 4 5 6; do pnpm --filter api test > /tmp/api-run-$i.log 2>&1; echo "run $i exit=$?"; done
   grep -l "Failed Tests" /tmp/api-run-*.log
   ```
   깨지는 파일은 `EXCLUSIVE_SUITES`(`apps/api/test/helpers/exclusive-suites.ts`)에 등재된 다섯 중
   하나이고, 같은 파일 단독 실행은 통과한다:
   `pnpm --filter api exec vitest run test/admin-dashboard-summary.e2e.test.ts`
3. 확정 재현(겹침을 눈으로 확인). 배타 스위트 하나의 루트 `afterAll` **첫 줄**에 시각 로그와 인위적
   지연을 넣고, 다른 배타 스위트의 `beforeAll`에 시각 로그를 넣는다:
   ```ts
   // test/categories.e2e.test.ts (배타 등재) — 정리 앞
   afterAll(async () => {
     console.log("[repro] A cleanup start", Date.now());
     await new Promise((r) => setTimeout(r, 3000));
     console.log("[repro] A cleanup end", Date.now());
   });
   // test/admin-dashboard-summary.e2e.test.ts (배타 등재) — 스냅샷 앞
   beforeAll(() => console.log("[repro] B snapshot", Date.now()));
   ```
   두 스위트가 같은 실행에 들어가도록 돌리면 `B snapshot`이 `A cleanup end`보다 **앞선** 타임스탬프로
   찍힌다. 지연을 3초로 두는 이유는 현재 유예(250ms) + Nest 부팅으로는 가려지지 않게 하기 위해서다.
4. 배타 스위트가 리더 목록에 보이지 않는다는 사실은 `acquireExclusive`의 배출 루프에
   `console.log(readerIds(dir))`를 넣으면 바로 보인다 — 다른 배타 스위트가 정리 중이어도 빈 배열이다.

### 라운드 61에서 볼 만한 방향 (미확정 — 판단은 그 라운드에서)

- **반납을 정리 뒤로 미룬다**: `db-lock.setup.ts`가 `sequence.hooks`에 기대지 않도록 반납을 파일
  종료 시점(`onTestFinished`/`globalTeardown` 계열, 또는 vitest의 hook 순서 설정)으로 옮긴다.
  가장 근본적이지만 setup 파일이 스위트 훅 순서에 개입하는 형태라 영향 범위를 봐야 한다.
- **배타 스위트도 자기 자리를 발행한다**: 배타 보유자가 마커와 함께 `readers/`에 파일을 두고,
  정리가 끝난 뒤 지운다. `acquireExclusive`의 기존 배출 대기가 그대로 다음 배타 스위트를 붙잡는다
  (코드 변경이 가장 작다).
- **떠나는 쪽에도 정착 유예를 준다**: `READER_DRAIN_SETTLE_MS`와 대칭으로 마커를 지우기 전 유예를
  둔다. 가장 싸지만 확률을 낮출 뿐 구멍을 닫지는 않는다 — 임시 완화로만.

⚠️ 어느 방향이든 **`EXCLUSIVE_SUITES`를 늘려 우회하지 말 것**. 그 목록은 비용이고
(`exclusive-suites.ts` 머리말), 이 문제는 목록의 내용이 아니라 락 프로토콜의 경계에 있다.

### 이 항목이 라운드 60에서 코드로 고쳐지지 않은 이유

라운드 60 리뷰의 나머지 항목은 전부 제품 코드(여정·문구·보존)였고, 이 항목만 테스트 하네스의
동시성 프로토콜이다. 세 방향 모두 **전 스위트의 실행 순서에 영향을 주는 변경**이라, 같은 라운드에서
제품 변경과 섞으면 회귀가 났을 때 어느 쪽 탓인지 가릴 수 없다. 그래서 라운드 60에서는 관측·근거·재현
절차만 남기고 수정은 분리했다.

---

### 라운드 61 A 결과 (2026-08-28)

#### 1. 위 재현 절차를 그대로 수행한 결과 — 두 재현 모두 **전제를 부정했다**

**확률 재현(수정 전, 6회):** 6/6 **그린**(76 파일 / 661 테스트). 관측된 1/3 실패는 이 창에서
재현되지 않았다. 실행 시간 67·76·69·68·69·68초(평균 69.5초). — 나중에 밝혀지지만, 이 6회가
그린이었던 것과 뒤이은 6회 중 4회가 깨진 것의 차이는 **머신이 조용했는가**였다(아래 3-2).

**확정 재현(수정 전, 3초 지연 주입):** 문서가 예고한 `B snapshot < A cleanup end`가 아니라
정반대가 나왔다. `categories`(배타) 정리 뒤 `admin-dashboard-summary`(배타) 스냅샷:

```
categories cleanup end      ...604671
LOCK release(exclusive)     ...605193   ← 정리보다 522ms 뒤
LOCK acquired(exclusive) B  ...605451
dashboard beforeAll         ...606217   ← A의 정리 종료보다 1.5초 뒤
```

#### 2. 왜 전제가 틀렸나 — 실측한 사실 세 가지

1. **vitest 2.1.9의 `sequence.hooks` 기본값은 `parallel`이 아니라 `"stack"`이다.**
   `vitest/dist/chunks/resolveConfig.*.js`가 `resolved.sequence.hooks ??= "stack"`으로 채운다.
   문서가 어긋나 있다 — **같은 버전의 CLI 도움말은 기본값을 `"parallel"`이라고 적는다.** 라운드
   60의 전제는 그 도움말/공식 문서를 따른 것이고, 코드가 아니었다.
   `"stack"`은 after 훅을 **역순으로, 순차로** 돈다. setup 파일의 `afterAll(release)`이 가장 먼저
   등록되므로 역순에서는 **마지막**이다 → 반납이 스위트 정리 뒤에 온다.
2. **훅을 어디에 등록했느냐가 한 겹 더 있다.** 자식 스위트(`describe(...)` 안)의 `afterAll`은
   부모(파일) 스위트의 `afterAll`보다 **항상** 먼저 끝난다 — `sequence.hooks` 값과 무관하다.
   api의 DB 스위트는 전부 정리 훅을 `describe` 안에 두고 있어, 설령 `parallel`이었더라도 겹치지
   않았을 것이다. (파일 최상위 `afterAll`을 쓰는 파일은 `auth.service` / `kakao-auth.service` /
   `token.service` 셋뿐이고, 셋 다 `prisma.$disconnect()`만 한다 — DB 쓰기가 없다.)
3. **`READER_DRAIN_SETTLE_MS`는 리더 전용 보정이 아니다.** 배출 루프 **뒤에 무조건** 실행되므로
   배타→배타 hand-off에도 그대로 적용된다. 리더 전용이었던 것은 코드가 아니라 그 주석이었다.

훅 등록 위치 × `sequence.hooks` 실측표(vitest 2.1.9):

| 스위트 정리 훅 위치 | `stack`(실제 기본) | `parallel` | `list` |
| --- | --- | --- | --- |
| 파일 최상위 | 정리 **뒤** 반납 ✅ | 정리와 **동시** ❌ | 정리보다 **먼저** ❌ |
| `describe` 안 | 정리 뒤 ✅ | 정리 뒤 ✅ | 정리 뒤 ✅ |

#### 3. 그래서 무엇을 봉합했나

구멍은 “지금 열려 있다”가 아니라 **“두 겹의 암묵적 우연에만 기대고 있다”**였다. 둘 다 한 줄로
사라진다 — vitest 업그레이드가 기본값을 (도움말이 적은 대로) 되돌리거나, 누가 스위트의 정리
훅을 `describe` 밖으로 옮기면. 그리고 그때 증상은 컴파일 오류가 아니라 **1/3 확률의 플레이크**다.
그래서 그 전제를 **명시하고 강제**하는 쪽으로 봉합했다.

- `apps/api/vitest.config.ts` — `sequence: { hooks: "stack" }`를 직접 고정(기본값에 기대지 않는다).
- `apps/api/test/helpers/shared-db-lock.ts` — `assertReleaseOrderingGuarantee()` 추가. 워커에
  **실제로 적용된** 값을 읽어 `"stack"`이 아니면 즉시 던진다. 모든 스위트가 지나는
  `acquireSharedDb`의 첫 줄에서 호출하므로(락 디렉터리를 보기 전 → `WOORIAI_TEST_ALLOW_NO_LOCK`
  옵트아웃 경로까지 덮인다) 우회 경로가 없다. 값을 읽지 못하면(내부 API 구조 변경) 검사를
  **건너뛴다** — 확실히 틀렸을 때만 실패한다. 머리말에 위 실측표를 남겼고,
  `READER_DRAIN_SETTLE_MS` 주석의 잘못된 근거(“리더 전용”)를 정정했다.
- `apps/api/test/db-lock-release-order.test.ts` — 신규 하네스 테스트(DB 불필요). 파일 최상위에
  afterAll 두 개를 등록해 **순서 자체를 런타임에 재현**한다(먼저 등록한 쪽이 나중에 등록한 쪽의
  `await`가 끝난 뒤에 도는가). 그 밖에 적용값·설정 고정·가드 동작(`parallel`/`list`에서 던지고,
  읽을 수 없으면 통과)·`acquireSharedDb`의 호출 위치를 함께 고정한다.

**채택하지 않은 방향과 이유** — “배타 스위트도 `readers/`에 자기 자리를 발행” 방향은 반납 순서가
보장된 뒤에는 **잉여**다(마커 제거가 이미 “정리 끝”을 뜻하므로 배출 대기가 붙잡을 것이 없다).
“떠나는 쪽에도 정착 유예”는 문서 자신이 적었듯 확률만 낮춘다. `EXCLUSIVE_SUITES`는 손대지 않았다.

#### 3-2. 봉합 도중 실제로 관측된 구멍 — 락의 두 번째 경계는 **실행 단위**다

봉합 후 검증 6회 중 4회가 깨졌고, 그중 하나가 라운드 60이 적어 둔 바로 그 모양이었다:

```
FAIL test/admin-dashboard-summary.e2e.test.ts > counts seeded data correctly...
AssertionError: expected 2 to be 1     ← after.activeUsers - before.activeUsers
```

**직접 관측한 사실**: 그 6회 동안 이 작업 트리를 다른 세션들이 동시에 쓰고 있었다 —
`apps/api/src/worker/*`와 `apps/api/test/worker-*.test.ts`가 실행 **도중에** 바뀌었고(그래서
`TypeError: this.status.recordTickStart is not a function` 같은 반쯤 적용된 리팩터 오류가 났다),
전체 테스트 수가 실행마다 661 → 665 → 667 → 672로 늘었으며, 실행 시간이 평소 69초에서
143~155초로 부풀었다(4코어 포화). 143초를 넘긴 실행은 전부 깨졌고, 조용한 창에서 돈 6회는
전부 통과했다.

**그 위에서 코드를 읽어 확인한 구멍**: 락 디렉터리 이름이
`wooriai-api-test-db-lock-${process.pid}` — 즉 **그 실행의 pid** 다. 같은 `wooriai_test`를 향한
`pnpm --filter api test`가 둘 동시에 돌면 서로의 락 디렉터리를 아예 보지 못하므로, 두 실행의
배타 스위트는 아무 보호 없이 겹쳐 돈다. 남의 실행이 만든 사용자 한 명이 before/after 사이에
끼면 델타가 정확히 1 대신 2가 된다.

두 번째 api 실행을 현장에서 붙잡아 확인한 것은 아니므로 이 실패의 원인을 단정하지는 않는다.
다만 **라운드 60의 “3회 중 1회”에 대해 지금까지 나온 설명 중 가장 그럴듯하다** — 단독 실행은
언제나 통과하고, 같은 파일을 함께 돌려도 (위 확정 재현대로) 겹치지 않는데, 여러 세션이 한 DB를
나눠 쓰면 정확히 그런 확률적 실패가 난다. 그리고 이 구멍은 관측과 무관하게 코드에 **실재**한다.

라운드 61 A는 이 구멍을 **닫지 않고 이름을 붙였다**. 닫으려면 락 디렉터리를 DB 단위 고정 경로로
옮겨야 하는데, `createLockDir`의 초기화 `rmSync`와 teardown의 삭제가 곧바로 남의 실행이 들고 있는
락을 지운다 — 참조 카운팅이 필요한 별개의 설계 변경이다. 대신:

- `createLockDir`이 DATABASE_URL 해시로 나뉜 실행 레지스트리(`/tmp/wooriai-api-test-runs-<hash>/`)에
  자기 기록을 남기고, **살아 있는 다른 실행이 있으면 globalSetup이 크게 경고한다.** 죽은 기록은
  걷어내고, 기록은 원자적으로(write→rename) 쓴다. 실패시키지는 않는다 — 한 머신에서 여러 세션이
  도는 것은 흔한 현실이라 하드 실패는 막으려는 플레이크보다 자주 앞을 가로막는다.
- 경고문이 실패 모양(`expected 2 to be 1`)까지 적어 두므로, 다음에 같은 실패를 본 사람은 코드가
  아니라 동시 실행을 먼저 본다.

> **QA 수칙**: `pnpm --filter api test`의 결과를 근거로 삼을 때는 같은 DB를 쓰는 다른 실행이
> 없는지 먼저 확인할 것. 불가피하면 `DATABASE_URL`로 실행마다 다른 DB를 줄 것.

#### 4. 봉합 후 검증

- **확정 재현(수정 후)**: 정상 실행은 그대로 안전한 순서(`cleanup end` → `release` → 다음 스위트
  `acquired` → `snapshot`). `--sequence.hooks=parallel`로 강제하면 이제 **첫 파일에서 즉시**
  가드가 던지고 실행이 빨간불이 된다 — 조용히 겹쳐 돌던 자리다.
- **가드 2중화 확인**: 가드를 우회한 격리 환경에서 순서 테스트만 돌렸을 때
  `stack` 통과 / `parallel` 실패 / `list` 실패.
- **전체 스위트**: 최종 트리에서 **3회 연속 그린**(77 파일 / 672 테스트). 그 앞 6회는 5/6
  그린이고, 유일한 실패는 이 트랙과 무관한 `worker-jobs.db.test.ts`(같은 시각 다른 세션이 손보던
  파일, 단독 실행은 통과)였다.

**전체 수행 시간**: 아래. 모두 같은 4코어 머신이지만 **머신 부하가 창마다 달랐다**(위 3-2 참고).

| 창 | 1 | 2 | 3 | 4 | 5 | 6 | 평균 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 봉합 전 (76파일/661테스트, 조용) | 67s | 76s | 69s | 68s | 69s | 68s | **69.5s** | 6/6 그린 |
| 봉합 후 (77파일/672테스트, 부하 3.2~5.6) | 71s | 71s | 72s | 79s | 71s | 73s | 72.8s | 5/6 |
| 봉합 후 (77파일/672테스트, 조용) | 71s | 71s | 71s | – | – | – | 71.0s | 3/3 그린 |
| 봉합 후 · 최종 트리 (77파일/672테스트) | 72s | 72s | 82s | – | – | – | **75.3s** | 3/3 그린 |

조용한 창끼리 비교하면 **69.5초 → 71~75초**이고, 그 사이 테스트 수가 661 → 672로 늘었다(이 트랙이
더한 하네스 테스트 5개 + 다른 세션이 더한 것들). 실행 간 편차가 ±10초에 이르는 창이라 이 차이를
설정 탓으로 돌릴 수는 없다.

**고정한 `sequence.hooks` 자체의 비용은 0이다** — 추정이 아니라 확인된 사실이다: vitest 2.1.9의
`resolveConfig`가 `resolved.sequence.hooks ??= "stack"`으로 채우므로 고정 전후의 **적용값이
같고**(워커에서 실제로 읽어 확인했다), 새로 도는 코드는 파일당 프로퍼티 한 번 읽기(가드)와
globalSetup에서 한 번의 `mkdir`+`readdir`+`write`(실행 레지스트리)뿐이다. 늘어난 몫은 새로 생긴
테스트 파일 하나가 락 풀을 한 번 더 지나는 값이다.

#### 5. 남는 것 (수용)

반납 순서는 `await`된 정리까지만 보장한다. 스위트가 await하지 않고 흘려보낸 작업(닫히는 Nest 앱의
뒷정리 등)의 여운은 여전히 `READER_DRAIN_SETTLE_MS`(250ms) + 다음 배타 스위트의 Nest 부팅 시간이
흡수한다. 이것은 순서 보장으로 닫을 수 있는 종류가 아니라 알려진 여유값이며, 이 값을 키워
플레이크를 덮으려는 시도는 잘못된 방향이라고 코드 주석에 명시했다.
