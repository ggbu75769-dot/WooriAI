# 라운드 61 백로그

라운드 60 통합 리뷰에서 **코드 수정을 라운드 61로 미루기로 한** 항목을 근거와 재현 절차까지 적어
둔다. 이 문서에 있는 것은 "다음 라운드에 고칠 것"이지 "수용한 위험"이 아니다 — 수용한 위험은
`docs/operations/known-limitations.md`가 든다.

---

## B-1. api 테스트 스위트의 배타 락 구멍 — 배타 스위트끼리 겹쳐 돈다

- **관측**: 라운드 60 QA(C-11g)에서 `pnpm --filter api test`가 **3회 중 1회** 꼴로 배타 등재
  스위트에서 깨졌다(전역 델타/합계 대조 단언). 같은 파일을 단독으로 돌리면 언제나 통과한다.
- **범위**: 테스트 하네스만. 프로덕션 코드·런타임 동작과는 무관하다.
- **관련 파일**: `apps/api/test/helpers/shared-db-lock.ts`,
  `apps/api/test/helpers/db-lock.setup.ts`, `apps/api/test/helpers/exclusive-suites.ts`,
  `apps/api/vitest.config.ts`.

### 무엇이 잘못돼 있나

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
