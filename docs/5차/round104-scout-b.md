# 라운드 104 스카우트 B — 실패·복구 경로에서 사용자가 막히는 자리

작성: 2026-09-07 · 범위: 읽기 전용 정찰(소스 변경 0). 다른 에이전트가 쓰는 중인
`apps/mobile/app/settings/`, `apps/mobile/src/categories/`, `apps/mobile/src/api/api-error.ts`,
`apps/mobile/src/family/record-permissions.ts`, `apps/mobile/src/route-surface.test.ts`는 지적 대상에서 제외했고
`api-error.ts`는 **열지 않았다**(§B-6의 대조는 서버 소스와 `api-error.test.ts`만으로 세웠다).

## 요약

| # | 한 줄 | 심각도 | 크기 | 즉시 착수 |
|---|---|---|---|---|
| B-1 | 접힌 **수정**이 멱등키를 물려받아 409 IDEMPOTENCY_KEY_CONFLICT로 굳는다 — 재시도 버튼도 없고, 화면의 안내를 따르면 **중복 지출**이 생긴다 | **상** | M | 가능 |
| B-2 | 세션 만료 401 한 번이 **큐 전량**을 'failed'로 태우고, 재로그인해도 되살리는 자동 경로가 0건 | **상** | S | 가능 |
| B-3 | 429·408도 같은 자리에서 자동 재시도를 잃는다 — 엔진의 permanent 분류와 화면의 "재시도 가능" 판정이 어긋나 있다 | 중 | S | 가능(B-2와 한 트랙) |
| B-4 | 비-JSON 오류 응답에서 status가 사라져 준비템 큐의 8회 탈출구가 작동하지 않고, 대기 준비템 행에는 취할 행동이 **0개** | 중 | S | 가능 |
| B-5 | 동기화 상태 화면의 복구 버튼 **전부**가 오류를 삼킨다(파일 전체 `catch` 0개) — 저장소가 답하지 않으면 완전 침묵 | 중 | S | 가능 |
| B-6 | 에러 표시 대조 근거: 서버가 던지는 코드 중 앱 표에 없는 것으로 **확인 가능한** 후보 목록 | 하 | S | 대조만 |

**사용자가 스스로 못 빠져나오는 것은 B-1 하나다**(B-2는 회복 경로가 있으나 사용자가 스스로 찾아야 하고,
B-4·B-5는 외부 조건이 걷히거나 앱을 재시작하면 풀린다).

---

## B-1 [상 · M] 접힌 수정이 멱등키를 물려받아 영구 실패로 굳고, 화면의 안내가 중복 지출을 만든다

### 실패 시나리오 (구체적 입력·상태 → 사용자가 보는 것)

1. 서버에 이미 있는 지출 E(version v)를 상세 화면에서 수정 저장한다 →
   `updateExpenseOffline`(`apps/mobile/src/offline/sync-controller.ts:440`) → `recordLocalUpdate`
   (`apps/mobile/src/offline/sync-engine.ts:242`)가 mutation **U1**(`idempotencyKey=K`, `expectedVersion=v`)을 큐에 넣는다.
2. flush가 U1을 보낸다. **서버는 커밋한다**(version v+1) — 그리고 멱등 행에 `requestHash(body1)`과 응답을
   24시간 보관한다(`apps/api/src/common/idempotency/idempotency.interceptor.ts:198-206`,
   TTL은 같은 파일 `:16` `IDEMPOTENCY_TTL_MS = 24h`).
3. **응답이 유실된다**(터널 진입, 앱 강제 종료, 10초 타임아웃 — `apps/mobile/src/api/client.ts:83`
   `DEFAULT_FETCH_TIMEOUT_MS = 10_000`). 클라이언트는 이를 transient로 보고 행을 'pending'으로 남긴다
   (`sync-engine.ts:824-838`), `inFlight`는 false로 되돌아간다.
4. 사용자가 같은 지출을 다시 열어 **한 번 더 고친다**(금액 오타 정정 등). `recordLocalUpdate`의 병합이
   기존 U1에 **필드만 덮어쓰고 `idempotencyKey`는 그대로 둔다**:
   `apps/mobile/src/offline/outbox-merge.ts:101-109` — `{ ...pendingUpdate, payload: {...} , ...MERGED_RETRY_BUDGET_RESET }`.
   그 리셋 상수(`outbox-merge.ts:57-63`)가 초기화하는 것은 `attemptCount`·`nextRetryAt`·`lastError`·
   `lastErrorStatus`·`lastErrorCode`뿐이다 — `idempotencyKey`는 목록에 없다(주석도 "큐에서의 자리
   (`mutationId`·`createdAt`·`idempotencyKey`)는 기존 행 것을 그대로 유지한다"고 명시한다).
5. 다음 flush: **같은 키 K + 다른 본문** → 서버 `reserve()`가 requestHash 불일치를 보고 409
   (`idempotency.interceptor.ts:263-264` → `:180-182` → `:89-91`
   `"이미 다른 요청 본문으로 사용된 Idempotency-Key예요."`).
6. `apps/mobile/src/api/client.ts:1179-1190` — 409이지만 봉투 코드가 `VERSION_CONFLICT`가 아니므로
   `ExpenseHttpError(409, body)`. → `apps/mobile/src/offline/remote-api.ts:154-161` — `status < 500`이라
   `RemotePermanentError(409, …)`. → `sync-engine.ts:756-783` — 행 `syncState='failed'`,
   `lastErrorStatus=409`, `lastErrorCode="IDEMPOTENCY_KEY_CONFLICT"`.
7. `apps/mobile/src/offline/permission-denied.ts:90-96` — 재시도 가능 4xx 집합은 `{401,408,429}`뿐이라
   409는 **재시도 불가**로 판정된다. `apps/mobile/app/sync-status.tsx:337`이 재시도 버튼 자리를 걷고
   `:391`이 `SYNC_STATUS_PERMANENT_FAILURE_HINT`를 세운다:
   **"다시 보내도 같은 결과예요. 내용을 고쳐 새로 기록하거나 버려 주세요."**

사용자가 보는 것: 두 번째 수정이 영영 반영되지 않는 실패 행 하나와, 그 지출을 **새로 기록하라**는 안내.
그 안내를 실제로 따르면(`sync-status.tsx:399-418` `고쳐서 다시 보내기` → `/expenses/new` 프리필) 서버에는 이미
첫 수정이 반영된 E가 그대로 있으므로 **같은 지출이 두 건**이 된다. 기록 탭에서는 그 실패 행이 목록에 서지도
않아(영구 실패 + `canonicalId` 보유 행은 서버 행에 자리를 내준다 —
`apps/mobile/src/offline/expense-list-reconciliation.ts:165-185`) 사용자는 무엇이 왜 어긋났는지 볼 근거조차 없다.

### 복구 가능한가 — **앱 안에서는 편집을 살릴 길이 없다**

- 재시도 버튼은 화면이 걷었고, 있었더라도 통하지 않는다: `retryFailedMutation`은 멱등키를 **일부러 그대로 둔다**
  (`sync-engine.ts:1077` *"The idempotency key is untouched, so a re-send stays deduplicated."*) → 같은 409.
- 자동 재시도도 없다: 'failed' 행은 flush pass가 건너뛴다(`sync-engine.ts:608`).
- 24시간 뒤 멱등 행이 만료되면 같은 요청이 통과하겠지만, 그때도 행은 'failed'라 아무도 다시 보내지 않는다.
- 남는 선택지는 **버리기(두 번째 편집 유실)** 또는 **중복 생성**뿐. 앱 재설치는 불필요하다(손실만 확정될 뿐).

### 이 함정이 삭제 경로에는 없다는 사실이 근거다 (비대칭)

같은 상황에서 사용자가 수정 대신 **삭제**를 누르면 병합은 새 행을 만든다
(`outbox-merge.ts:79-87` — `return [incoming]`), 즉 **새 멱등키**를 받는다. 그 요청은 409
IDEMPOTENCY가 아니라 409 **VERSION_CONFLICT**(서버 v+1 ≠ expectedVersion v —
`apps/api/src/finance/expenses.service.ts:133,165,193-195`)로 떨어져 충돌 3지선다로 간다 — 설계된 회복 경로다.
**접기(fold)가 키를 물려받는 것 하나만이** 같은 사고를 회복 불가로 만든다.

### 고치는 크기

파일 2개(`outbox-merge.ts` + 그 테스트), 서버·계약 변경 0.
처방: **payload가 실제로 달라지는 `update`+`update` 접기에서만** `idempotencyKey`를 새로 발급한다.
그러면 서버가 이미 v+1이므로 그 요청은 409 VERSION_CONFLICT가 되고, 이미 있는 충돌 해소 UI가 받는다.

⚠️ **`create` 접기(`outbox-merge.ts:89-98`)에는 같은 처방을 쓰면 안 된다** — 생성이 서버에 닿은 뒤 키를 바꾸면
그것이 곧 **중복 지출 생성**이다. 오늘 그 경로는 UI에서 도달 불가이기도 하다: 대기 행을 누르면 상세가 아니라
동기화 상태 화면으로 간다(`apps/mobile/app/(tabs)/records.tsx:429` `onPress={pushSyncStatus}`)라
`recordLocalUpdate`가 대기 create를 만날 입구가 없다. 처방 범위를 update 접기로 못 박아야 한다.

### 막는 것
없음. 픽셀락·새 의존성·서버·DNC 무관.

---

## B-2 [상 · S] 세션 만료 401 한 번이 큐 전량을 'failed'로 태우고, 재로그인해도 자동으로 되살아나지 않는다

### 실패 시나리오

오프라인 여행 중 지출 12건을 기록해 뒀다. 그 사이 리프레시 토큰이 30일 TTL로 만료되거나 재사용 감지로
폐기됐다. 앱을 포그라운드로 되돌리면 flush가 돈다.

1. 첫 요청이 401 → `requestExpenseJson`이 단일 비행 리프레시를 시도 → 리프레시도 401 →
   `endSessionAsExpired()`(`apps/mobile/src/api/client.ts:1160-1175`, `:610-612`).
2. 그리고 **그대로 아래로 떨어져** `ExpenseHttpError(401, …)`를 던진다(`client.ts:1191-1193`).
3. `remote-api.ts:154` → `RemotePermanentError(401)` → `sync-engine.ts:756` → 행 `'failed'`.
4. 이 갈래는 `break`가 아니라 **`continue`**(`sync-engine.ts:783`)다 → 같은 pass에서 **나머지 11건도 전부
   'failed'**가 된다. 세션이 이미 비었으므로 뒤 요청들은 리프레시 시도조차 하지 못한다
   (`client.ts:1162` `if (currentRefreshToken)`).
5. 동시에 `isSessionExpiryTransition`이 로그인 화면으로 보낸다(`sync-controller.ts:717-730`).
6. 같은 계정으로 재로그인 → `isSessionIdentityChange`가 false라 큐는 보존된다 —
   `apps/mobile/src/offline/session-expiry.ts:27-29`가 약속한 그대로다
   (*"outbox / local_expenses / sync_meta: KEPT … Unsynced records survive the expiry"*).
7. **그러나 12건은 전부 'failed'이고, flush pass는 'failed'를 건너뛴다**(`sync-engine.ts:608`).
   부팅 복구는 'syncing' 표시만 되돌린다(`sync-engine.ts:511` `recoverInterruptedSyncState`).
   저장소 전체에서 failed→pending을 되돌리는 **자동 경로는 0건**이다: `retryAllFailedMutations`의
   호출부는 `apps/mobile/app/sync-status.tsx:717`(사용자가 누르는 버튼) 하나뿐이다.

사용자가 보는 것: 다시 로그인했는데 기록 탭 배지가 "실패 12"로 남아 있고, 리포트·CSV 고지도 그대로다.
AUTH-127이 지킨 것은 "행이 남는다"까지이고, **그 행들이 다시 올라가는 일은 일어나지 않는다.**

### 복구 가능한가
가능하지만 전적으로 사용자 몫이다 — 동기화 상태 화면을 스스로 찾아 "지출 12건 재시도"를 눌러야 한다.
어느 화면도 "여기서 다시 보낼 수 있다"고 말하지 않는다. 앱 재설치는 불필요.

### 고치는 크기
파일 2개(`sync-engine.ts` + `sync-controller.ts`)와 그 테스트. 서버·계약 0.
두 처방 중 하나:
(a) 401은 permanent로 파킹하지 않고 transient(백오프)로 돌린다 — 세션이 없는 동안 flush 자체가 돌지 않으므로
   (`sync-controller.ts:681` `if (!token) return;`) 재시도 폭풍이 생기지 않는다.
(b) 세션이 다시 서는 순간 **401로 굳은 행만** pending으로 되돌린다(`useOfflineSyncLifecycle`의 토큰 재진입).

⚠️ `permission-denied.ts`의 판정은 **이미 옳다**(401을 재시도 가능으로 본다) — 고칠 곳은 엔진이다.
그 파일을 건드리지 않는 것이 트랙 경계를 깨끗하게 유지한다.

### 막는 것
없음.

---

## B-3 [중 · S] 429·408도 같은 자리에서 자동 재시도를 잃는다 — 엔진과 화면이 서로 다른 말을 한다

### 실패 시나리오

`isRetryableSyncError`(`permission-denied.ts:90-96`)는 **401·408·429**를 "다시 보내면 통할 수 있다"로 판정하고,
그 근거를 주석으로 적어 두었다(*"408·429는 시간이 지나면 같은 요청이 통과한다. 이 셋까지 '무익'이라고 말하면
그 자체가 허위 안내다"*). 그런데 엔진은 이 셋을 **4xx라는 이유 하나로** 'failed'에 영구 파킹한다
(`remote-api.ts:154` → `sync-engine.ts:756`, 준비템 큐도 같다 `sync-engine.ts:954`).
즉 **앱이 스스로 다시 보내면 통할 실패를 자동 재시도 대상에서 뺀다.**

429의 실제 경로: `apps/api/src/common/security/rate-limit.middleware.ts:236-247`(코드 `RATE_LIMITED`,
메시지 *"요청이 너무 많아요. 잠시 후 다시 시도해주세요."*), 전역 한도는 **IP당 300req/60초**
(같은 파일 `:6-7` `DEFAULT_WINDOW_MS=60_000`, `DEFAULT_GLOBAL_MAX=300`). 큐가 큰 사용자의 한 번의 flush,
또는 통신사 CGNAT처럼 여러 사용자가 IP를 공유하는 환경에서 밟힌다. **한도 창은 60초인데 행은 영구 파킹된다.**

사용자가 보는 것: 서버가 "잠시 후 다시 시도해주세요"라고 답한 실패가, 사용자가 손으로 재시도를 누르기 전까지
영원히 올라가지 않는다.

### 복구 가능한가
가능(재시도 버튼은 남는다 — 429는 재시도 가능 판정이다). 자동 회복만 없다.

### 고치는 크기
B-2와 **같은 한 줄**(재시도 가능 status는 permanent가 아니라 transient 갈래로 보낸다)이라 같은 트랙에 둔다.
5xx가 이미 갖고 있는 `MAX_SERVER_ERROR_ATTEMPTS` 상한(`sync-engine.ts:73`)을 그대로 재사용하면
head-of-line 위험도 종전과 같다.

### 막는 것
없음.

---

## B-4 [중 · S] 비-JSON 오류 응답에서 status가 사라져 준비템 큐의 탈출구가 작동하지 않고, 대기 준비템 행에는 행동이 0개다

### 실패 시나리오

운영 배포는 리버스 프록시(Caddy) 뒤에 있다(`docs/5차/oracle-free-deploy-runbook.md:3`,
`docs/5차/day1-deploy-runbook.md:94` *"HTTPS는 앞단에 Caddy/nginx … 80/443 → api:3000"*).
API 컨테이너 재기동 중 프록시가 내는 502/504는 본문이 비어 있거나 HTML이다.

1. `requestJson`은 본문을 **무방비로** 파싱한다: `apps/mobile/src/api/client.ts:681`
   `const data = (await response.json()) as T;` → 비-JSON이면 여기서 `SyntaxError`가 던져지고
   **`ApiHttpError`는 만들어지지 않는다**(`:689`가 실행되지 못한다).
   ⚠️ 지출 경로는 같은 자리를 방어한다: `client.ts:1178` `await response.json().catch(() => null)` —
   **두 전송 경로가 비대칭**이다.
2. 준비템 상태 PATCH는 `requestJson`을 탄다(`client.ts:1401-1405`). 그 `SyntaxError`는
   `rethrowItemStatusError`의 `ApiHttpError` 검사를 통과하지 못해(`remote-api.ts:189-194`) 원본 그대로 올라간다.
3. sync-engine에는 `status` 필드가 없으므로 **네트워크 오류**로 분류된다(`sync-engine.ts:94-97`
   `transientServerErrorStatus`는 `status >= 500`인 숫자만 본다). 결정적 5xx 탈출구
   (`MAX_SERVER_ERROR_ATTEMPTS`, `sync-engine.ts:73`)는 **적용되지 않는다** — 그 상한은
   `serverErrorStatus !== null`일 때만 걸린다(`sync-engine.ts:991`).
4. 그 결과 `summary.stoppedForNetwork = true; break`(`sync-engine.ts:1013-1014`)로 **준비템 큐 전체가
   head-of-line 블록**되고, 상한도 없다.
5. 그동안 사용자가 그 행에 취할 수 있는 행동은 **없다**: 'pending' 준비템 행은 문장 한 줄만 그린다
   (`apps/mobile/app/sync-status.tsx:580-584` — `ITEM_STATUS_QUEUED_MESSAGE`). 재시도·버리기는
   `isFailed`일 때만 붙는다(`:542-579`). 지출 대기 행에는 GAP-062 #3이 버리기를 줬는데
   (`sync-status.tsx:507-509`) 준비템에는 대응물이 없다.

사용자가 보는 것: 연결은 멀쩡한데 준비템 상태 변경이 "연결되면 자동으로 반영할게요"에 계속 머문다.
누를 것도, 버릴 것도 없다.

### 복구 가능한가
프록시가 정상으로 돌아오면 저절로 풀린다(그래서 상이 아니라 중). 프록시 설정이 잘못돼 지속되면 앱 안에서
그 행을 치울 방법이 없다.

### 고치는 크기
`client.ts` 한 줄의 대칭화(`.catch(() => null)`)로 status가 보존되고, 그 순간 8회 상한과 permanent/transient
분류가 종전 설계대로 작동한다. 선택적으로 준비템 **대기** 행에도 버리기를 붙인다 — 컨트롤러 함수
(`discardOfflineItemStatus`, `sync-controller.ts:525`)는 상태를 가리지 않으므로 화면 렌더 조건만 넓히면 된다.
서버·계약 0.

### 막는 것
없음. (`client.ts` 수정은 읽기 경로 전체에 닿으므로 `client-refresh-*.test.ts`와 함께 본다.)

---

## B-5 [중 · S] 동기화 상태 화면의 복구 버튼 전부가 오류를 삼킨다 — 파일 전체에 `catch`가 0개다

### 실패 시나리오

`apps/mobile/app/sync-status.tsx`는 921줄이고 `catch`가 **0개**다(`grep -c catch` = 0). 이 화면은 막힌 기록을
푸는 **유일한** 화면인데, 모든 복구 동작이 fire-and-forget이다:

- 충돌 3지선다: `:232`·`:237`(삭제 충돌 갈래) · `:256`(고른 값으로 저장) · `:264`·`:269`
- 실패 행: 재시도 `:449`, 버리기 `:333`·`:424`·`:438`·`:452`
- 준비템 행: 재시도 `:570`, 버리기 `:550`·`:563`·`:575`
- 일괄: 전체 재시도 `:716`, 전체 버리기 `:730`

이 함수들은 전부 저장소 접근으로 시작한다(`sync-controller.ts:537`·`544`·`572`·`581`·`589` …
모두 첫 줄이 `await getOfflineStore()`). 부팅 뒤 저장소가 죽으면(디스크 가득 참, SQLite I/O 오류)
이 호출들은 reject하고 **화면은 아무 말도 하지 않는다.**

그리고 그 상태에서 저장소 미가용 고지도 뜨지 않는다:
`publishStorageUnavailableSnapshot`은 **행과 건수를 일부러 그대로 둔다**(`sync-controller.ts:157-166`,
"0으로 밀지 않는 이유"가 그 주석의 요지다). 화면은 그 고지를 `!hasAny`(목록이 빈 경우)에만 그린다
(`sync-status.tsx:894`). 즉 **행이 남아 있으면 `OFFLINE_STORAGE_UNAVAILABLE_NOTICE`
(`apps/mobile/src/offline/messages.ts:207`)는 절대 나오지 않는다.**

사용자가 보는 것: 버튼을 눌러도 목록이 그대로다. 다시 누른다. 화면은 계속 침묵한다.

### 복구 가능한가
앱을 완전히 재시작해 저장소가 다시 열리면 회복된다(문구도 그렇게 약속한다 — *"앱을 다시 켜면 다시
시도할게요"*). 다만 그 문구가 이 상태에서는 화면에 서지 않는다.

### 고치는 크기
화면 1파일 + 문구 1개. 이 저장소에 **이미 있는 패턴**을 그대로 쓰면 된다: 라운드 62 #2가 대기 행 버리기
거절에 세운 행 내부 한 줄(`SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE`, `messages.ts:359`,
사용처 `sync-status.tsx:504-506`). 서버·계약 0.

### 막는 것
없음.

---

## B-6 [하] 에러 표시 계약 — 대조 근거 (표 파일은 읽지 않았다)

지시대로 `apps/mobile/src/api/api-error.ts`는 열지 않았다. 대신 ① **서버가 실제로 던지는 코드**를
`apps/api/src` 전수 grep으로 세고, ② 앱 표의 내용은 **독립 증거**인 `apps/mobile/src/api/api-error.test.ts`가
열거하는 코드로만 추정했다(그 테스트는 라운드 103의 `CUSTOM_CATEGORY_*`까지 담고 있어 최신이다).
따라서 아래 "표에 없음"은 **강한 추정**이지 단정이 아니다 — 표를 여는 트랙이 마지막으로 확인해야 한다.

서버 코드 총계: **`code: "..."` 유일값 105개**(admin 전용 다수 포함). 그중 모바일이 실제로 받을 수 있고
**재시도가 무익하거나 문구가 행동을 바꾸는** 것만 추립니다.

| 코드 | status | 던지는 자리 | 재시도로 풀리나 | 표(추정) | 왜 중요한가 |
|---|---|---|---|---|---|
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | `idempotency.interceptor.ts:89-91` | **아니오**(같은 키·같은 본문인 한) | 없음 | B-1의 문장이 여기서 뭉개진다. 서버 메시지 셋 중 둘(`:277` *"이전 요청 처리에 실패했어요. 다시 시도해 주세요."*, `:284` *"이전 요청이 아직 처리 중이에요. 잠시 후 다시 시도해 주세요."*)은 **재시도를 권하는데**, 앱은 409를 재시도 불가로 판정해 버튼을 걷고 "다시 보내도 같은 결과예요"를 세운다 — **서버 문장과 화면 문장이 정면으로 어긋난다** |
| `RATE_LIMITED` | 429 | `rate-limit.middleware.ts:236-247` | 예(60초 뒤) | 없음 | B-3. 문구가 뭉개지면 사용자는 "잠시 후"라는 유일한 행동 지시를 못 본다 |
| `PAYLOAD_TOO_LARGE` | 413 | `body-size-error.middleware.ts:31` | 아니오 | 없음 | 무엇을 줄여야 하는지 화면이 말할 수 없다 |
| `CATEGORY_BUDGET_LIMIT_EXCEEDED` | 400 | `onboarding-core.service.ts:735` | 아니오 | 없음 | 라운드 102 신규. 예산 화면의 막다른 문장 |
| `CATEGORY_BUDGET_INVALID_CATEGORY` | 400 | `onboarding-core.service.ts:862` | 아니오 | 없음 | 〃 |
| `CUSTOM_ITEM_LIMIT_EXCEEDED` | 400 | `custom-items.service.ts:81` | 아니오 | 없음 | 라운드 100 신규 |
| `CUSTOM_ITEM_EXPENSE_LINK_UNSUPPORTED` | 400 | `items-catalog.service.ts:428` | 아니오 | 없음 | 아웃박스에서는 도달 불가(`remote-api.ts:256-262`가 expenseId를 싣지 않는다) — 다른 호출부만 해당 |
| `EXPENSE_CHILD_MISMATCH` | 403 | `expenses-store.service.ts:430` | 아니오 | 없음 | |
| `EXPENSE_CURSOR_INVALID` | 400 | `expenses-store.service.ts:126,138` | 아니오 | 없음 | 커서는 서버가 준 값이라 정상 흐름에서는 안 나지만, 나면 목록 전체가 실패한다 |
| `REPORT_PERIOD_INVALID` | 400 | `reporting-store.service.ts:279,285` | 아니오 | 없음 | |
| `MILESTONE_UNAVAILABLE` | — | `milestone-report.service.ts:37` | 아니오 | 없음 | |
| `DEVICE_NOT_FOUND` | 404 | `devices.controller.ts:197` | 아니오 | 없음 | |
| `CONSENT_REQUIRED` | 403 | `onboarding-core.service.ts:344` | 아니오 | 없음(온보딩 화면이 자기 문구를 갖는다 — `step-ui.tsx`) | 알려진 한계 M-1에 이미 기록됨 |

**우선순위 하나만 꼽으면 `IDEMPOTENCY_KEY_CONFLICT`다** — 다른 것들은 "문구가 뭉개진다"이지만 이것은
**문구와 화면 판정이 서로 반대**이고, 그 판정이 사용자의 유일한 탈출구(재시도 버튼)를 없앤다.

---

## 확인했지만 문제가 아니었던 것 (다음 라운드가 다시 세지 않도록)

- **`createExpenseRowOrTranslateFk`의 좁은 FK 번역면(라운드 103 지적)** — 오늘 남은 5xx 구멍은 없다.
  `expenses`의 FK 다섯 축(`apps/api/prisma/migrations/000001_init/migration.sql:196-217`) 중
  `category_id`는 `requireExistingCategory`(400 `EXPENSE_CATEGORY_INVALID`,
  `expenses-store.service.ts:466-476`), `linked_item_template_id`는
  `requireExistingItemTemplateAnyStatus`(400, `:478-485`), `linked_product_link_id`는 사전 조회 + P2003 번역
  (`:168-193`), `household_id`/`child_id`/`created_by_user_id`는 `requireChildAccess`가 앞에서 막는다.
  int4 초과 금액과 길이 초과는 DTO가 400으로 잡는다(`apps/api/src/finance/dto/expense.dto.ts` —
  `MONEY_KRW_MAX`, `EXPENSE_ITEM_NAME_MAX_LENGTH` 등이 **생성·수정 양쪽에** 걸려 있다).
- **커스텀 준비템 상태 쓰기** — `child_item_statuses.item_template_id`의 SQL FK 때문에 커스텀 id가
  그 표에 들어갈 수 없다는 위험은 설계가 이미 피했다(커스텀은 상태를 행에 내장 —
  `apps/api/prisma/migrations/000022_custom_items/migration.sql:5-8`, 분기는
  `items-catalog.service.ts:422-435`). 404 `ITEM_NOT_FOUND`는 아웃박스가 성공 수렴으로 폐기한다
  (`sync-engine.ts:222-241`, `:959-966`).
- **오프라인 저장소 파기 SQL** — 대기·실패·충돌·삭제 대기·미결 아웃박스 행을 다섯 조건으로 전부 제외한다
  (`apps/mobile/src/offline/sqlite-offline-store.ts:387-395`). 데이터 손실 경로 없음.
- **델타 동기화 커서** — 계정 스코프 키로 저장하고 불일치 시 폐기(`delta-sync.ts:60-69`),
  서버의 400 `SYNC_CURSOR_INVALID`는 한 번만 전체 재풀로 되돌린다(`:150-161`, 두 번째는 그대로 전파하므로
  루프가 없다). 커서는 페이지 적용 **후에만** 전진한다(`:164-175`).
- **세션 만료 시 개인정보 경계** — `session-expiry.ts` 전문이 큐·캐시·푸시 해제의 경계를 값으로 고정한다.
  B-2는 그 경계의 문제가 아니라 **되살리는 경로가 없다**는 문제다.
- **초대 흐름** — 링크 유실(라운드 52 C-04), 역할 누락(Android 버튼 상한 `invite-flow.ts:186-223`),
  참여 후 아이 목록 조회 실패(`app/family/accept/[token].tsx:115-121`)까지 이미 닫혀 있다.

---

## 권고 순위 · 트랙 경계 (소유 파일 교집합 없음)

### 1순위 — 트랙 B1 · 접힌 수정의 멱등키 (B-1)
소유 파일:
- `apps/mobile/src/offline/outbox-merge.ts`
- `apps/mobile/src/offline/outbox-merge.test.ts`

범위: `update`+`update` 접기에서 payload가 실제로 달라지면 `idempotencyKey`를 새로 발급.
`create` 접기는 **손대지 않는다**(중복 생성 위험 — 위 §B-1 경고). 서버·계약 0.

### 2순위 — 트랙 B2 · 재시도 가능 4xx를 자동 재시도로 되돌린다 (B-2 + B-3)
소유 파일:
- `apps/mobile/src/offline/sync-engine.ts`
- `apps/mobile/src/offline/sync-engine.test.ts`
- `apps/mobile/src/offline/sync-edge-cases.test.ts`
- `apps/mobile/src/offline/sync-controller.ts`

범위: `RemotePermanentError` 중 `isRetryableSyncError(status)`가 참인 것(401·408·429)은 'failed' 파킹이 아니라
백오프 transient로 보낸다(5xx와 같은 `MAX_SERVER_ERROR_ATTEMPTS` 상한 재사용). 그리고/또는 세션이 다시 설 때
401로 굳은 행만 pending으로 되돌린다.
⚠️ `apps/mobile/src/offline/permission-denied.ts`는 **건드리지 않는다** — 그 판정은 이미 옳다.

### 3순위 — 트랙 B3 · 오류 본문 파싱의 비대칭 (B-4)
소유 파일:
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/api/client-refresh-flow.test.ts`
- `apps/mobile/src/api/client-refresh-matrix.test.ts`

범위: `requestJson`(`:681`)과 `requestMultipartJson`(`:737`)의 본문 파싱을 지출 경로(`:1178`)와 대칭으로
방어해 status/code를 보존한다. 이 한 줄로 준비템 큐의 8회 상한과 permanent/transient 분류가 설계대로 돌아온다.

### 4순위 — 트랙 B4 · 동기화 상태 화면의 침묵 (B-5 + 준비템 대기 행 버리기)
소유 파일:
- `apps/mobile/app/sync-status.tsx`
- `apps/mobile/src/offline/messages.ts`
- `apps/mobile/src/offline/messages.test.ts`

범위: 복구 핸들러에 실패 표면(행 내부 한 줄, 라운드 62 #2 패턴 재사용)을 붙이고,
저장소 미가용 고지를 빈 목록 밖에서도 볼 수 있게 한다. 준비템 **대기** 행에 버리기를 추가한다
(컨트롤러 함수는 이미 상태를 가리지 않는다 — 화면 렌더 조건만 넓히면 된다).

### 5순위 — 트랙 B5 · 에러 코드 표 대조 (B-6)
소유 파일:
- `apps/mobile/src/api/api-error.ts` *(이번 라운드에 다른 에이전트가 쓰는 중 — 그 작업이 끝난 뒤)*
- `apps/mobile/src/api/api-error.test.ts`

범위: §B-6 표를 실제 표와 대조하고, 최소한 `IDEMPOTENCY_KEY_CONFLICT` 한 줄을 넣는다
(단, 트랙 B1이 먼저 들어가면 그 코드를 만날 일 자체가 크게 줄어든다 — **순서상 B1이 앞이다**).
