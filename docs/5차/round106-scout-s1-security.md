# 라운드 106 정찰 S1 — 보안·개인정보 감사

- 작성: 2026-09-07 (읽은 시점은 발견마다 표기)
- 범위: `apps/api` · `apps/mobile` · `apps/admin` · `packages/*` · `infra/legal`
- **읽기 전용 산출물.** 소스 변경 0건, git 명령 0건. 비밀값 원문은 이 문서에 옮겨 적지 않았다(있는 자리만 적었다).
- ⚠️ 다른 에이전트 20개가 동시 편집 중이다. `apps/api/src/finance/expenses.service.ts`는 정찰 중에 실제로 바뀌었다(08:05 읽기 → 08:19 수정 → 08:20 재확인, 줄 번호 119→133으로 밀림). **아래 인용은 전부 2026-09-07 08:20 UTC 기준으로 재확인한 값**이고, 줄이 밀려도 찾을 수 있도록 심볼 이름을 함께 적는다.

---

## 요약

| # | 한 줄 | 심각도 | 크기 | 즉시 착수 |
| --- | --- | --- | --- | --- |
| S1-1 | 지출 수정/삭제 감사 봉투가 사용자 자유 문자열(`itemName`·`merchant`·`memo`)을 원문으로 싣는다 — audit_logs에 730일, 어드민 뷰어·CSV로 유출, 계정 삭제 후에도 남는다 | 상 | M | 예 |
| S1-2 | 모바일 "로그아웃"이 서버에 아무 말도 하지 않는다 — `POST /api/v1/auth/logout`은 구현돼 있는데 호출자가 0건이라, 로그아웃 뒤에도 refresh 토큰이 최대 30일 유효하다 | 상 | S | 예 |
| S1-3 | 가구 구성원 강퇴 감사 봉투가 `displayName`(카카오 닉네임)을 원문으로 싣는다 — S1-1과 같은 730일·같은 뷰어, 대상자가 탈퇴해도 남는다 | 중 | S | 예 |
| S1-4 | PRIV-104 teardown 대장에서 빠진 영속 스토어 둘(`wooriai-onboarding-progress` · `wooriai-selected-child`) — "안 지우는 이유"를 적는 저장소 관례도 지켜지지 않았다 | 중 | S | 예 |
| S1-5 | `pnpm audit`: critical 2 / high 45 / moderate 28 / low 1. 서버 런타임에서 실제로 도달 가능한 것은 multer 2.0.2(high×3)와 next 15.5.20(high×3 포함 8건, 패치 한 칸) | 중 | M | 예 |
| S1-6 | `affiliate_clicks.user_agent`가 무인증 공개 경로에서 헤더 원문을 길이 상한 없이 `text`에 적는다 — 그 컬럼의 기존 판정문이 다루지 않은 축 | 하 | S | 예 |
| S1-7 | `oauth_transactions.code_challenge`는 쓰기만 있고 읽는 곳 0건 — 판정은 DTO 주석에 있으나 스키마 쪽에는 없다(같은 저장소의 `user_agent` 관례와 어긋남) | 하 | S | 예 |

**오늘 문제 없음으로 판정한 축 2개**(근거는 §축 판정에 있다): **권한 우회(축 2)**, **입력 신뢰(축 4)**.

---

## S1-1 — 지출 감사 봉투에 실리는 자유 문자열 (상 / M)

### 무엇이 새는가

사용자가 적은 **품목명·판매처·메모** 원문이 `audit_logs.before_json` / `after_json`에 그대로 들어가, ① 어드민 감사 뷰어 JSON 응답으로 나가고 ② 그 화면의 CSV 내보내기로 운영자 PC에 파일로 떨어지며 ③ **계정을 삭제해도 730일 동안 살아 있다.**

### 근거 (전부 2026-09-07 08:20 UTC 확인)

봉투를 만드는 자리:

- `apps/api/src/finance/expenses.service.ts:133-134` — `const before = toExpenseSnapshot(row); const audit = { householdId: row.householdId, before };`, `:143`·`:161` — `return { expense, ...audit, after: expense };` (`updateExpense`)
- `apps/api/src/onboarding/expenses-store.service.ts:323` — `const before = toExpenseDto(expense);` (`deleteExpense`, `:321`)

그 스냅샷이 담는 필드:

- `apps/api/src/finance/expense-snapshot.ts:44-62` `toExpenseSnapshot` — `itemName`, `merchant`, `memo`를 포함한 13개 필드
- `apps/api/src/onboarding/store-shared.ts:137-154` `toExpenseDto` — 같은 세 필드 포함

봉투를 감사 로그로 넘기는 자리:

- `apps/api/src/finance/expenses.controller.ts:98-106` (`action: "expense.update"`, `before: result.before`, `after: result.after`)
- `apps/api/src/finance/expenses.controller.ts:118-126` (`action: "expense.delete"`, 동일)

DB에 적히는 자리:

- `apps/api/src/common/audit/audit-logger.service.ts:77-78` — `beforeJson: entry.before`, `afterJson: entry.after` (변환·마스킹 없음)

다시 나가는 자리:

- `apps/api/src/admin/audit-logs.service.ts:124-125` — `before: redactSensitiveValues(row.beforeJson)`. 그 마스킹의 판정 규칙은 `:12`의 `SENSITIVE_KEY_PATTERN = /password|passwd|secret|token|authorization|cookie|credential|recovery|otp|totp|apikey|api_key/i`이고 `:39`가 **키 이름으로만** 판정한다 — `memo`·`itemName`·`merchant`는 어느 것에도 걸리지 않아 원문 그대로 통과한다.
- `apps/api/src/admin/audit-logs.controller.ts:19-23` — `@RequireAdminRoles("admin")` 한 겹. admin 역할이면 전 가구·전 사용자의 이 봉투를 필터 없이 페이지네이션으로 읽는다.
- `apps/admin/src/lib/audit-log-csv.ts:69-70` — `snapshotToCell(entry.before)` / `(entry.after)`가 봉투를 `JSON.stringify`해 CSV 셀에 넣는다. `AUDIT_LOG_EXPORT_MAX_ROWS = 1000`(`:10`)까지 한 파일로 떨어진다.

지워지지 않는 이유:

- `apps/api/src/worker/jobs/data-retention-purge.job.ts:88` — `DEFAULT_AUDIT_LOGS_RETENTION_DAYS = 730`
- 같은 파일 `:1127-1130` — 탈퇴 사용자 처리(phase 3)는 `auditLog.updateMany({ where: { actorUserId: { in: userIds } }, data: { actorUserId: null } })` 뿐이다. **`before_json`/`after_json`은 한 글자도 건드리지 않는다.**

### 이것이 왜 결함인가 — 저장소 자신의 규율과 어긋난다

같은 저장소가 **감사 봉투에 자유 문자열을 싣지 않는다**를 세 곳에서 명문으로 세워 두었다:

- `apps/api/src/onboarding/custom-items.service.ts:119-121` — *"감사 로그는 id·childId만 — **이름은 싣지 않는다**: 자유 문자열은 개인정보 밀도가 높은 축이고 파기 잡이 그런 문자열을 뒤늦게 마스킹해 온 전례가 있다"*
- `apps/api/src/onboarding/import-pipeline.service.ts:656-670`·`:760-773` — 확정/되돌리기 봉투는 **상태·건수·시각뿐**(파일명·행 원문 금지)
- `apps/api/src/auth/kakao/kakao-auth.service.ts` `recordLoginRejected` doc — *"⚠️ **PII 0건**: sub·이메일·닉네임·ID 토큰은 싣지 않는다"*
- `apps/api/src/onboarding/onboarding-core.service.ts:721` (예산 봉투) — *"봉투에는 금액·연월·childId만 싣는다 — PII도, 지출 원문도 없다"*

그리고 어드민 노출 정책도 정확히 반대를 말한다: `apps/api/src/admin/admin-users-lookup.service.ts:96-99` — *"싣지 않는다 — … 그리고 **지출 금액/품목/가맹점/메모 일체**"*. 즉 **같은 admin 역할이 사용자 조회 도구에서는 명시적으로 금지된 값을, 감사 뷰어에서는 원문으로 읽는다.**

### 개인정보처리방침과의 불일치

`infra/legal/privacy-policy.html:114-118` (2026-09-02 갱신본):

> 보안·책임 추적 기록(감사 기록): 주요 데이터 변경 이력(제8조)은 생성일로부터 2년(730일) 보관 후 자동 파기됩니다. **이 기록에는 원본 식별정보가 남지 않습니다**(계정 삭제 시 행위자 연결값이 제거되고, 접속 IP는 일방향 해시로만 기록됩니다).

`expense.update` / `expense.delete` 행에는 `childId`와 함께 그 아이에 대한 사용자 작성 자유 문자열이 원문으로 남는다. 문장이 오늘 사실과 다르다.

### 공격/사고 시나리오

1. **사고(가장 현실적)** — 운영자가 CS 조사를 위해 감사 뷰어에서 CSV를 받는다(`audit-log-csv.ts`의 정상 기능). 그 파일 한 장에 최대 1,000행, 각 행에 지출 메모·품목명·판매처가 들어 있다. 그 파일은 이후 저장소·메일·메신저 어디로든 간다.
2. **탈퇴 후 잔존** — 사용자가 계정 삭제를 마치고, 파기 잡이 phase 1~4를 전부 돌려 `expenses` 행까지 물리 삭제한다. 그래도 `audit_logs`의 그 봉투는 최대 730일 남고, 그 안에 "○○ 산부인과", "△△ 조리원 잔금", 사용자가 적은 메모가 그대로 들어 있다.
3. **내부자** — admin 역할 계정 하나가 탈취되면(어드민은 MFA·세션 12h로 잘 지켜지지만) 감사 뷰어 한 화면으로 **전 사용자의 소비 문자열**을 훑을 수 있다. `admin-users-lookup`은 그것을 막으려고 만든 도구인데, 옆 화면이 그 통제를 무력화한다.

### 고치는 크기 — M

봉투를 만드는 자리 3개(위 인용)가 스냅샷 대신 **바뀐 축 이름 + 금액·날짜·카테고리 id**만 싣게 바꾸는 것. `custom-categories.service.ts:196-204`가 이미 그 모양이다(`changed: ["name","active"]` — 값이 아니라 축 이름). CS가 답해야 하는 질문("금액이 혼자 바뀌었어요")은 금액 두 개면 답이 되므로 기능 손실이 없다.

기존 행 정리는 파기 잡에 phase 하나를 더하는 일이고(그 잡의 phase 5가 `admin.user_lookup.search`의 옛 검색어를 마스킹한 것과 **같은 형식**: `data-retention-purge.job.ts:1280-1310`), 그 선례가 있으므로 새 설계가 필요 없다.

### 막는 것

`request-log-fields.test.ts`가 라우트를 전수 스윕해 "로그에 실릴 수 있는 경로"를 잠근 것과 같은 형식의 **감사 봉투 스윕 테스트**. 오늘 `apps/api/test/`에 그런 테스트는 없다(`audit-logger.service.test.ts`는 영속화만 본다). 스윕이 `auditLogger.record` 호출부의 `before`/`after` 키 집합을 대장과 대조하면, 다음 라운드가 새 봉투에 자유 문자열을 넣는 순간 먼저 빨개진다.

---

## S1-2 — 모바일 로그아웃이 서버에 아무 말도 하지 않는다 (상 / S)

### 무엇이 새는가

사용자가 설정에서 [로그아웃]을 누르면 **앱이 로컬 상태만 지운다.** 서버의 refresh 토큰 family는 **폐기되지 않는다.** 그 토큰은 SecureStore에 마지막으로 쓰인 값 그대로 최대 30일(family 절대 수명 90일 이내) 유효하고, 그 사이 누구든 그 값을 손에 넣으면 `POST /api/v1/auth/refresh`로 access 토큰을 계속 발급받아 그 계정의 지출·아이 정보 전부를 읽고 쓸 수 있다.

### 근거 (2026-09-07 08:20 UTC 확인)

서버는 올바르게 구현돼 있다:

- `apps/api/src/auth/auth.controller.ts:26-34` — `POST auth/logout`
- `apps/api/src/auth/auth.service.ts:139-159` `logout()` — `refreshToken`이 오면 `verifyRefreshToken` → `refreshTokenStore.revokeFamily(familyId)`

호출자가 없다:

- 저장소 전체에서 `"auth/logout"` 문자열이 걸리는 곳은 **어드민 클라이언트(`apps/admin/src/lib/admin-api.ts:1033`, `/admin/auth/logout`)와 API 테스트뿐**이다. `apps/mobile/**`에는 0건.
- 실제 로그아웃 버튼: `apps/mobile/app/settings/index.tsx:265-276` — `onPress: () => { clearSession(); clearSelectedChild(); router.replace("/launch-animation"); }`. 네트워크 호출 없음.
- `clearSession("logout")`은 `apps/mobile/src/stores/session.store.ts:337-350`에서 로컬 필드만 null로 만든다.
- 나머지 두 `clearSession()` 자리(`apps/mobile/app/pixel-lock.tsx:58` — QA 전용 라우트, `apps/mobile/app/settings/privacy.tsx:559` — 계정 삭제 성공 후)도 마찬가지다. 단, **계정 삭제 경로는 안전하다**: 서버의 `settings.controller.ts:181-182`가 `withdrawUser` 직후 `refreshTokenStore.revokeAllForUser(...)`를 부른다. 즉 **폐기가 되는 유일한 사용자 경로는 계정 삭제뿐이고, 평범한 로그아웃에는 폐기가 없다.**

토큰 수명:

- `apps/api/src/auth/token.service.ts:64` — `REFRESH_TOKEN_TTL_SECONDS = 60*60*24*30` (30일)
- 같은 파일 `:75` — `DEFAULT_REFRESH_FAMILY_MAX_AGE_DAYS = 90`
- 저장 위치는 안전하다: `apps/mobile/src/stores/secure-session-storage.ts`가 `expo-secure-store`를 쓰고(`:39-70`), 평문 AsyncStorage에 남아 있던 옛 토큰은 1회 마이그레이션 후 제거한다(`:89-91`).

### 공격/사고 시나리오

1. **중고 기기·분실** — 사용자가 폰을 팔기 전에 앱에서 로그아웃하고 초기화를 잊는다(또는 앱만 지운다). 안드로이드 SecureStore는 앱 데이터에 남고, 클라우드 백업/루팅/포렌식으로 뽑히면 그 refresh 토큰은 **여전히 유효**하다. 사용자는 로그아웃했다고 믿는다.
2. **PIN 잠금 우회 뒤** — `app-lock`이 실패 임계에 도달해 세션을 끊는 경로도 같은 `clearSession()`이다. 즉 "잠금을 뚫으려던 사람 때문에 세션을 끊었다"는 바로 그 상황에서 서버 토큰은 살아 있다.
3. **재사용 탐지가 도와주지 않는다** — 회전 재사용 탐지(`auth.service.ts:81-87`)는 **같은 토큰이 두 번 쓰일 때** family를 폐기한다. 로그아웃한 사용자는 그 토큰을 다시 쓰지 않으므로, 훔친 쪽이 혼자 조용히 회전시키면 탐지 신호가 발생하지 않는다.

### 고치는 크기 — S

설정 로그아웃의 `onPress`에서 `clearSession()` **앞**에 best-effort `POST /api/v1/auth/logout { refreshToken }` 한 번(실패해도 로그아웃은 진행 — 서버 코드가 이미 "만료·손상 토큰은 로그아웃을 막지 않는다"로 그렇게 설계돼 있다: `auth.service.ts:146-149`).

### 막는 것

모바일 쪽 테스트 하나(로그아웃 탭 → 요청 목록에 `POST /auth/logout`이 있다) + API e2e는 이미 있다(`apps/api/test/refresh-token-rotation.db.test.ts:176`이 로그아웃 후 회전이 401임을 잠근다 — **서버 계약은 이미 테스트가 있고, 그 계약을 쓰는 클라이언트가 없는 것**이 오늘의 상태다).

---

## S1-3 — 강퇴 감사 봉투의 `displayName` (중 / S)

### 무엇이 새는가

가구 관리자가 구성원을 내보내면 그 **구성원의 표시 이름**(카카오 닉네임 — 실명인 경우가 흔하다)이 감사 봉투에 원문으로 실려 S1-1과 같은 경로(730일 · 어드민 뷰어 · CSV)로 나간다. 그리고 이 값은 **대상자가 나중에 탈퇴해도 지워지지 않는다**: 파기 잡 phase 3은 `actorUserId`(=강퇴를 실행한 관리자)만 null로 만들고, 봉투 안의 대상자 이름은 손대지 않기 때문이다.

### 근거 (2026-09-07 08:20 UTC 확인)

- `apps/api/src/households/household-runtime.service.ts:291` `removeMember`, `:311-312` — `const displayNames = await this.memberDisplayNames([member]); const before = toMemberDto(member, displayNames);`, `:318` — `return { success: true, before, after: toMemberDto(updated, displayNames), householdId }`
- 같은 파일 `:660-676` `toMemberDto` — 반환 객체에 `displayName: displayNames.get(member.userId) ?? ""`
- `apps/api/src/households/households.controller.ts:30-38` — `action: "household.member.remove"`, `before: result.before`, `after: result.after`
- 이후 경로·보존 기간·마스킹 미적용은 S1-1과 **같은 줄들**이다(`audit-logger.service.ts:77-78` → `audit-logs.service.ts:12,39,124-125` → `audit-logs.controller.ts:19-23`; `data-retention-purge.job.ts:88`, `:1127-1130`).

같은 파일의 형제 봉투는 이 값을 싣지 않는다: `toInviteDto`(`:682-700`)는 id·역할·채널·상태·시각만 담는다. 즉 **한 컨트롤러 안에서 두 봉투의 규율이 갈려 있다.**

### 공격/사고 시나리오

부부가 갈라서며 한쪽이 가구에서 내보내진다. 그 사람이 이후 앱을 탈퇴하고 "제 정보를 지워 주세요"를 요청한다. `users` 행은 익명화/파기되지만, 상대 가구의 강퇴 감사 행에는 그 사람의 이름이 남아 있고, 그것이 어드민 감사 화면과 CSV로 계속 조회된다. 방침 문장(`privacy-policy.html:114-118`)은 그렇지 않다고 적혀 있다.

### 고치는 크기 — S

`households.controller.ts`의 두 `record` 호출이 `result.before/after`를 그대로 넘기는 대신 `{ memberId, userId, role, status }`만 뽑아 싣는 것(응답 계약은 이미 `{ success: true }`뿐이라 API 모양은 안 바뀐다). 또는 `removeMember`가 감사용 봉투를 따로 돌려주는 것.

### 막는 것

S1-1과 **같은 스윕 테스트** 하나가 두 발견을 함께 잠근다.

---

## S1-4 — PRIV-104 teardown 대장에서 빠진 영속 스토어 둘 (중 / S)

### 무엇이 새는가

계정 A가 로그아웃한 뒤에도 이 기기의 AsyncStorage에 A의 온보딩 진행 상태가 남는다: `childDraft.stageMode`(임신 중 / 출산 후 — 건강 인접 사실), `completedStepIds`, `hasReachedHome`, `childCreateIdempotencyKey`. 계정 B가 같은 기기에 로그인하면 그 값들이 그대로 있다.

**오늘 새는 것은 위 넷이고**, 같은 blob의 `childDraft.nickname` / `dueDate` / `birthDate` 칸은 **현재 아무도 쓰지 않는다**(정직하게 적는다 — 아래 확인 참고). 그러나 그 세 칸은 스토어 API(`updateChildDraft`)가 그대로 열어 두고 있어, 다음 라운드가 아이 이름 입력을 초안에 물리는 순간 **아이 이름·생년월일이 계정 경계를 넘는다.**

### 근거 (2026-09-07 08:20 UTC 확인)

- `apps/mobile/src/stores/onboarding-progress.store.ts:10-16` — `childDraft: { stageMode, nickname, dueDate, birthDate, manualStage }`, `:139-141` — `persist({ name: "wooriai-onboarding-progress", storage: createJSONStorage(() => persistStorage) })`. `apps/mobile/src/stores/persist-storage.ts:16-17`이 그 `persistStorage`를 `AsyncStorage`로 잇는다(SecureStore가 아니다).
- `apps/mobile/src/stores/selected-child.store.ts:21-30` — `persist({ name: "wooriai-selected-child", ... })`
- `apps/mobile/src/offline/session-teardown.ts` — 정체성 전환에서 리셋하는 스토어 목록은 `:247`~`:299`: query cache · purchase-followup · notification · homeFirstRunGuide · firstRecordCelebration · recurringExpense · importResume · analyticsConsent · recentSearches · quickRecordPins · budgetWarningHaptic · appLock. **`useOnboardingProgressStore`와 `useSelectedChildStore`는 이 목록에 없다**(import 자체가 없다).
- `apps/mobile/src/stores/session.store.ts:337-350` `clearSession` — 로그아웃 갈래도 두 스토어를 건드리지 않는다.
- 로그아웃 버튼(`apps/mobile/app/settings/index.tsx:271-273`)이 `clearSelectedChild()`를 **손으로** 부른다. 즉 `selectedChildId`는 "모듈이 아니라 화면이 지운다" — 지우는 자리가 대장 밖에 흩어져 있어, 다음 로그아웃 경로가 생기면 조용히 빠진다.

**저장소 관례와의 어긋남**: 이 저장소는 영속 스토어마다 "teardown에서 지운다 / 안 지운다 + 왜"를 파일 머리에 적는다 —
`apps/mobile/src/stores/amount-presets.store.ts:33`(*"⚠️ 세션 교체에서 **초기화하지 않는다**. 이 값은 계정…"*), `apps/mobile/src/stores/haptics.store.ts:33`(동일), `apps/mobile/src/stores/recent-searches.store.ts:27-29`(*"품목명·판매처·메모의 조각 … 정체성이 바뀌면 resetAll이 지운다"*), `apps/mobile/src/stores/quick-record-pins.store.ts:24-25`.
**`onboarding-progress.store.ts`와 `selected-child.store.ts`에는 그 문장이 한 줄도 없다.** 즉 판정이 내려진 적 없이 빠진 것이지, 이유를 적고 뺀 것이 아니다.

### 확인해 둔 사실(과장 방지)

`childDraft.nickname` / `dueDate` / `birthDate`에 값을 쓰는 코드는 오늘 0건이다: `updateChildDraft(...)` 호출은 `apps/mobile/app/(onboarding)/child-status.tsx:80`의 `updateChildDraft({ stageMode })` 하나뿐이고, 아이 프로필 화면은 초안에서 채우지 않는다(`apps/mobile/app/(onboarding)/child-profile.tsx:45-46` — `useState("")`로 시작하고 `:68`의 `draft`는 `stageMode`만 읽는다). 그래서 **"A의 아이 이름이 B에게 보인다"는 오늘 재현되지 않는다.** 새는 것은 `stageMode`·진행도·멱등키다.

### 공격/사고 시나리오

가족 공유 태블릿·중고 기기·A/S 대차 단말에서 A가 로그아웃하고 B가 로그인한다. B의 앱은 A의 `hasReachedHome=true`와 `completedStepIds`를 들고 부팅해 온보딩 게이트를 다르게 지나고(복구 경로 `apps/mobile/src/onboarding/selected-child-recovery.ts:82-89`가 뒤늦게 바로잡는다), A가 임신 중이었다는 사실(`stageMode`)이 기기에 남아 있다. 같은 teardown이 **최근 검색어와 빠른 기록 핀**은 "A가 무엇을 찾았는지가 B의 화면에 남지 않게" 지우는데(`recent-searches.store.ts:29`), 그보다 더 민감한 이 blob은 남는다.

### 고치는 크기 — S

`session-teardown.ts`의 목록에 두 줄을 더하고(`useOnboardingProgressStore.getState().resetOnboarding()` · `useSelectedChildStore.getState().clearSelectedChildId()`), 두 스토어 파일에 관례대로 한 문장을 적는 것. `selected-child`는 화면이 손으로 부르던 자리를 모듈로 옮기면 지우는 자리가 하나가 된다.

### 막는 것

`persist(` 를 쓰는 `apps/mobile/src/**` 스토어를 전수로 훑어 **teardown 목록에 있거나, 파일에 "안 지우는 이유" 문장이 있거나 둘 중 하나**를 요구하는 스윕 테스트(오늘 `apps/mobile/src/offline/session-teardown.test.ts`는 목록에 있는 것만 확인한다 — 빠진 것을 찾지 못한다). `loggable-path.ts`의 `UNMASKED_SECRET_CANDIDATE_PATHS`가 세운 "예외는 값으로 적는다" 관례와 같은 형식이다.

---

## S1-5 — 의존성 (`pnpm audit`, 있는 그대로) (중 / M)

실행: `pnpm audit --json` (2026-09-07 08:07 UTC, 저장소 루트, exit 0).

```
vulnerabilities: { info: 0, low: 1, moderate: 28, high: 45, critical: 2 }
dependencies: 1074 / devDependencies: 183 / optionalDependencies: 152 / total: 1303
```

**서버 런타임에서 실제로 도달 가능한 것**(설치된 버전은 `node_modules/.pnpm` 기준 확인):

| 패키지 | 설치 | 권고 | 등급 | 도달 경로 |
| --- | --- | --- | --- | --- |
| `multer` | 2.0.2 | ≥2.2.0 | high×3 + moderate×1 (GHSA-xf7r-hgr6-v32p, -v52c-386h-88mc, -5528-5vmv-3xc2, -72gw-mp4g-v24j, -3p4h-7m6x-2hcm) | `@nestjs/platform-express` 전이. `POST /api/v1/children/:childId/imports/excel`(인증 필요, `imports.controller.ts:84`)이 유일한 multipart 입구 — DoS(중첩 필드명·중단된 업로드 정리 누락·자원 고갈) |
| `next` | 15.5.20 | ≥15.5.21 | high×3 + moderate×5 (SSRF in rewrites GHSA-p9j2-gv94-2wf4, SSRF in Server Actions, App Router DoS, cache confusion 등) | 어드민이 `output: "standalone"` 서버로 뜨고 `/api/v1/*` rewrite를 갖는다(`apps/admin/next.config.js`). **패치 한 칸이면 8건이 사라진다** |
| `@nestjs/core` | 10.4.22 | ≥11.1.18 | moderate (GHSA-36xv-jgw5-4q75) | ⚠️ 픽스가 11.x 라인에만 있다 — 10.x에는 패치가 없으므로 **메이저 업그레이드 결정**이고 이 라운드의 작업이 아니다. 판정 기록만 남길 것 |
| `qs` 6.14.2 / `body-parser` 1.20.4 / `undici` 6.27.0 / `fast-uri` 3.1.3 / `brace-expansion` / `js-yaml` / `nanoid` / `decode-uri-component` | — | 각 권고 참조 | express/nest/prisma 전이. 대부분 DoS. 락파일 갱신으로 함께 올라간다 |

**빌드/CLI 시점에만 도는 것**(런타임 노출 아님 — 그러나 `dev=false`로 집계된다): `tar`(critical 1 + high 다수, expo CLI 전이), `sharp`, `image-size`, `@xmldom/xmldom`, `file-type`, `fast-xml-parser`, `postcss`, `browserslist`. **critical 2건은 둘 다 이 묶음이다**(`tar` GHSA-23hp-3jrh-7fpw, `vitest` GHSA-5xrq-8626-4rwp — 후자는 `dev=true`).

즉시 착수 가능한 것은 **next 패치 한 칸**과 **multer 하한 올리기**(pnpm `overrides`로 전이 버전을 끌어올리는 형태). `@nestjs/core`는 별도 결정.

---

## S1-6 — `affiliate_clicks.user_agent`의 길이 상한 없음 (하 / S)

### 무엇이 새는가

새는 것은 없다 — **쌓인다.** 무인증 공개 리다이렉트가 `user-agent` 헤더 **원문**을 상한 없는 `text` 컬럼에 그대로 적는다.

- `apps/api/src/items-commerce/redirect.controller.ts:82,95` — `const userAgentHeader = request.headers?.["user-agent"]; … userAgent: Array.isArray(...) ? [0] : userAgentHeader` (`@Controller("r")`, 가드 없음 — `:48-54`)
- `apps/api/src/onboarding/items-catalog.service.ts:484` — 인증 클릭 경로도 동일
- `apps/api/prisma/schema.prisma:650` — `userAgent String? @map("user_agent") @db.Text` (같은 표의 `subId`·`referrerScreenId`·`ipHash`는 각각 `VarChar(128)`·`VarChar(50)`·`VarChar(128)`로 잘려 있다)

그 컬럼에는 이미 **긴 판정 기록**이 붙어 있다(`schema.prisma:619-649`, GAP-069 P3 — 읽는 곳 0건 / 최소화 비대칭 / 방침 기재 여부 / 지우거나 해시하는 것은 PM 판단). 그 판정문이 다루는 축은 **개인정보**다. **길이**는 그 문서 어디에도 없다.

### 시나리오

`/api/v1/r/:code`는 레이트리밋 60 req/min/IP다(`rate-limit.middleware.ts:9,28` — `DEFAULT_REDIRECT_MAX = 60`). 유효 코드 하나만 알면 분당 60행 × (헤더 상한까지의) 임의 길이 문자열이 `affiliate_clicks`에 쌓인다. 보존은 400일(`data-retention-purge.job.ts:51` `DEFAULT_AFFILIATE_CLICKS_RETENTION_DAYS = 400`). 실제 UA는 300자를 넘지 않으므로 자르는 데 잃는 것이 없다.

### 크기 — S

두 쓰기 자리에서 `.slice(0, N)` + 스키마를 `VarChar(N)`으로 좁히는 마이그레이션(같은 표의 다른 세 칸이 이미 그 모양이다).

---

## S1-7 — `oauth_transactions.code_challenge`: 쓰기만 있고 읽는 곳 0건 (하 / S)

### 사실관계

- 쓴다: `apps/api/src/auth/kakao/kakao-auth.service.ts:85` — `codeChallenge: input.codeChallenge ?? null`
- **읽는 곳은 0건이다.** 저장소 전역 grep(`code_challenge|codeChallenge`)에서 API 쪽 참조는 스키마 선언(`schema.prisma:993`) · 마이그레이션 · DTO(`prepare-kakao-oauth.dto.ts:17`) · 위 한 줄뿐이다. `exchange`는 클라이언트가 보낸 `codeVerifier`를 **그대로** 카카오 토큰 엔드포인트로 넘길 뿐이고(`kakao-oidc-client.http.ts:84-85`), 저장된 challenge와 대조하지 않는다.
- **판정은 이미 적혀 있다**: `apps/api/src/auth/dto/prepare-kakao-oauth.dto.ts:8-12` — *"Kakao's token endpoint is the actual PKCE verifier, this server doesn't re-derive/validate the challenge itself."*

### 그래서 이것은 결함인가

**보안 결함이 아니다.** PKCE 검증의 주체는 카카오이고(authorize에 challenge가 실렸다면 verifier 없는 교환은 카카오가 거절한다), 서버는 state 일치·1회성 CAS·nonce 해시 왕복을 전부 한다(`kakao-auth.service.ts:113-115`, `:129-135`, `:144-149`).

결함은 **판정 기록의 위치**다. 같은 저장소가 "쓰기만 살아 있는 컬럼"을 발견하면 **스키마 쪽에** 사실관계와 판단을 적는 관례를 여섯 번 반복했다(`affiliate_clicks.user_agent`가 그 여섯 번째 — `schema.prisma:619-622`가 앞의 다섯을 열거한다). `code_challenge`는 그 관례를 지나지 않았고, DTO 주석은 **prepare 입력**의 문서이지 **컬럼**의 문서가 아니다. 다음 라운드가 스키마만 보고 "PKCE 검증이 서버에 있다"고 읽을 수 있는 자리다.

### 크기 — S

`schema.prisma:993`에 판정 세 줄. 값·동작 변경 0건.

---

## 축 판정

### 축 2 — 권한 우회: **오늘 문제 없음**

전수로 확인했다(2026-09-07 08:0x~08:20 UTC).

- **가드 누락 없음.** `apps/api/src/**/*.controller.ts` 전부를 `@Controller`/`@UseGuards`/HTTP 데코레이터로 훑었다. 가드가 없는 라우트는 다섯이고 각각 이유가 파일에 적혀 있다: `health.controller.ts`(`:18,47,55` — 본문이 숫자·불리언뿐), `push-health.controller.ts:23`(동일), `invite-landing.controller.ts:35`(공개 랜딩, 오라클 없음), `redirect.controller.ts:54`(공개 제휴 리다이렉트), `auth.controller.ts:14,20`·`kakao-auth.controller.ts:11,17`(로그인 전 경로), `households.controller.ts:79`(`GET invites/:token` — 토큰 자체가 인증).
- **가드 뒤에서 서비스가 소유를 다시 묻는다.** 아이 스코프는 전부 `ChildAccessService.requireChildAccess`(`child-access.service.ts:16-28`)를 지난다 — 지출 생성/수정/삭제, 예산, 커스텀 준비물, 준비템 상태, 가져오기, 리포트. 가구 스코프는 `assertMember`/`assertOwner`(`household-runtime.service.ts:603-615`)를 지난다. 기기는 `userId`로 좁혀 조회하고 불일치도 404로 통일한다(`devices.controller.ts:119-124`).
- **라운드 103이 잠근 카테고리 소유자 축의 형제 자원들도 확인했다.** 카테고리 목록은 `OR: [{householdId: null}, {householdId: {in: 내 가구}}]`(`categories.controller.ts:74-81`), 예산 카테고리는 `requireBudgetableCategories(tx, child.householdId, …)`(`onboarding-core.service.ts:762-768`), 지출 카테고리는 `requireExistingCategory(categoryId, householdId)`(`expenses-store.service.ts:466-468`), 가져오기 확정도 `job.householdId`로 좁힌 일괄 검증(`import-pipeline.service.ts:763-768`), 델타 동기화는 `householdId: { in: user.households }`(`sync.service.ts:38,48`).
- **다른 아이의 지출 id를 상태 행에 밀어 넣는 것은 가능하지만 읽히지 않는다**: `setChildItemStatus`(`items-catalog.service.ts:1080-1090`)는 `expenseId`를 검증 없이 저장하지만, 유일한 독자 `linkedExpenseDto`(`:1060-1071`)가 `{ id, childId, deletedAt: null }`로 좁혀 읽어 금액이 새지 않는다 — 그 방어가 코드에 주석으로 명시돼 있다.
- **어드민 RBAC**: 역할 판정은 매 요청 DB에서 admin 행을 다시 읽고(`admin-auth.guard.ts:66,82-85`), 비활성화는 선제 revoke까지 한다(`admin-users.controller.ts:173-175`). 레거시 `x-admin-token`은 프로덕션에서 무조건 403(`admin-token.guard.ts:26-28`).

### 축 4 — 입력 신뢰: **오늘 문제 없음**

- 전역 검증 파이프가 `whitelist: true` + `forbidNonWhitelisted: true` + `transform: true`(`bootstrap.ts:51-58`)라, DTO에 선언되지 않은 키는 요청 자체가 400이다.
- **금액**: `@IsInt() @Min(1) @Max(MONEY_KRW_MAX)`가 지출(`expense.dto.ts:30-32,114-116`) · 예산(`upsert-budget.dto.ts:45-48`) · 카테고리 예산(`:23-26`) · 가져오기 행(`import.dto.ts:46-49`)에 같은 상수로 걸려 있다. 자유 문자열은 전부 `@MaxLength`.
- **id**: 클라이언트가 준 모든 id가 소유자 술어를 지난다(위 축 2 목록). `linkedProductLinkId`만 존재 확인이고 그 이유가 DTO에 적혀 있다(`expense.dto.ts:90-100` — 형식만 검사하고 존재 확인은 저장 경로가 한다).
- **역할**: 초대 DTO가 `@IsIn(["co_parent","viewer","gift_participant"])`(`household.dto.ts:4-5`)로 `owner` 승격을 원천 차단한다.
- **집계**: 분석 이벤트는 `user_anon_id`/`household_anon_id`를 **요청 본문에서 읽지 않고 서버가 매번 다시 만든다**(`analytics.service.ts:27-36`), 페이로드는 `.strict()` 스키마 재검증(`:57-65`). 제휴 클릭의 `subId`는 자체 생성 uuid(`items-catalog.service.ts:471,482`).
- **멱등키**: `(userId, endpoint, idemKey)` 유니크로 행위자 스코프가 걸려 있어 남의 키를 재생할 수 없다(`idempotency.interceptor.ts:147-151,199`).
- **동기화 커서**: 클라이언트 문자열이지만 모양(ISO ms + uuid)만 통과하고, 조회 범위는 커서가 아니라 **사용자의 가구 목록**이 정한다(`cursor.ts:47-64`, `sync.service.ts:38,48`).

### 축 3 — 토큰·세션 (서버 측): **S1-2 외에는 문제 없음**

- JWT 페이로드는 `{sub, status, type, iat, exp, (jti, familyId)}`로 최소화돼 있고 사용자 정보는 매 검증마다 DB에서 다시 만든다(`token.service.ts:29-37,196-253`).
- refresh는 1회용 + 회전 + 재사용 시 family 전체 폐기 + 절대 수명 90일(`auth.service.ts:59-101`). 저장은 해시만(`refresh-token.store.ts:45,69,141` `hashToken`).
- 어드민 세션: 32바이트 난수, sha256만 저장, 12h 절대 만료, HttpOnly+SameSite=Lax+Secure(프로덕션), 상태변경 메서드에 double-submit CSRF, MFA 등록 게이트(`admin-session.service.ts:15,40-53`, `admin-cookies.ts:53-55`, `admin-auth.controller.ts:178-193`, `admin-auth.guard.ts:72-85`).
- 탈퇴는 `revokeAllForUser`(`settings.controller.ts:181-182`).
- 남는 성질(결함 아님, 기록용): access 토큰 30분은 취소 목록이 없어 폐기 후 최대 30분 유효하다. 다만 `auth.guard.ts:30-33`(`JwtAuthGuard`)가 매 요청 `status !== "active"`를 DB 기준으로 확인하므로 탈퇴·차단은 즉시 막힌다.

### 축 5 — 비밀값 (DNC-019): **오늘 문제 없음**

- 저장소 전역에서 AWS 키·PEM 개인키·GitHub/OpenAI/Slack 토큰 패턴 스캔 결과 0건.
- `.gitignore`가 `.env`/`.env.*`(example 제외) · `launch.config.json`(카카오 키) · `*.keystore`/`*.jks` · `scripts/qa/out/`(어드민 MFA 시크릿이 찍힐 수 있는 스크린샷)를 명시적으로 제외한다.
- 부팅 시 필수 비밀값 강제: `assertRequiredSecretsConfigured()`(`require-secret.ts:39-49`)가 JWT 두 개 · 어드민 토큰 · 제휴 도메인 · 클릭 IP 솔트 · 분석 솔트를 확인하고, `NODE_ENV`가 development/test가 **아니면** dev 폴백을 절대 쓰지 않는다(`:18-31` — 미설정 `NODE_ENV`도 프로덕션 취급).

---

## 권고 (4개)

1. **감사 봉투의 자유 문자열을 지금 끊고, 그 규율을 스윕 테스트로 세운다 (S1-1 + S1-3).**
   봉투를 만드는 세 자리를 "바뀐 축 이름 + 금액·날짜·id"로 좁힌다. 형식은 이미 저장소에 있다(`custom-categories.service.ts:196-204`의 `changed: [...]`). 그리고 `apps/api/test/`에 `auditLogger.record` 호출부의 `before`/`after` 키를 대장과 대조하는 스윕을 추가한다 — `request-log-fields.test.ts`가 로그 필드에 대해 한 것과 같은 형식. **그 테스트가 없으면 이 결함은 다음 라운드에 다시 자란다.** 옛 행 마스킹은 파기 잡 phase 5의 선례를 그대로 복제하면 된다.
2. **모바일 로그아웃을 서버 로그아웃과 잇는다 (S1-2).** 서버 코드·테스트가 이미 있고 클라이언트 한 줄이 없다. 크기 대비 위험이 가장 큰 항목이다.
3. **`next`를 15.5.21로 올린다 (S1-5).** 패치 한 칸으로 high 3건 포함 8건이 사라진다. `multer`는 pnpm overrides로 ≥2.2.0. `@nestjs/core`는 픽스가 11.x에만 있으므로 **여기서 고치지 말고 판정 기록만 남긴다.**
4. **영속 상태의 "안 지우는 이유"를 값으로 만든다 (S1-4).** teardown 대장에 두 스토어를 더하고, `persist(`를 쓰는 모바일 스토어를 전수로 훑어 "대장에 있거나 이유가 적혀 있거나"를 요구하는 스윕을 추가한다. 오늘의 대장은 목록에 있는 것만 확인해서 **빠진 것을 찾지 못한다.**

---

## 트랙 경계 — 교집합 없는 소유 파일 목록

> 아래 여섯 묶음은 파일이 한 번도 겹치지 않는다. 각 트랙은 **자기 목록 밖의 파일을 수정하지 않는다.**

**T1 — 지출 감사 봉투 (S1-1)**
```
apps/api/src/finance/expenses.service.ts
apps/api/src/finance/expenses.controller.ts
apps/api/src/onboarding/expenses-store.service.ts
apps/api/test/audit-envelope-pii.test.ts          (신규)
```
⚠️ 정찰 중 `expenses.service.ts`가 다른 에이전트에 의해 수정됐다(08:19 UTC). 착수 전 재확인 필수.
⚠️ `expense-snapshot.ts` / `store-shared.ts`는 **건드리지 않는다** — 그 두 함수는 409 충돌 payload와 델타 동기화의 계약이다(`expense-snapshot.ts:20-42`가 그 이유를 적어 두었다). 봉투 쪽에서만 좁힌다.

**T2 — 강퇴 감사 봉투 (S1-3)**
```
apps/api/src/households/households.controller.ts
apps/api/src/households/household-runtime.service.ts
```

**T3 — 모바일 teardown 대장 (S1-4)**
```
apps/mobile/src/offline/session-teardown.ts
apps/mobile/src/offline/session-teardown.test.ts
apps/mobile/src/stores/onboarding-progress.store.ts
apps/mobile/src/stores/selected-child.store.ts
```

**T4 — 서버 로그아웃 배선 (S1-2)**
```
apps/mobile/src/auth/server-logout.ts             (신규)
apps/mobile/app/settings/index.tsx
```
⚠️ T3이 `session-teardown.ts`를 소유한다. T4는 그 파일을 만지지 말고 자기 모듈을 화면에서 부른다.

**T5 — 의존성 (S1-5)**
```
package.json
apps/admin/package.json
pnpm-lock.yaml
```

**T6 — 판정 기록 (S1-6 + S1-7)**
```
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/<신규>/migration.sql
apps/api/src/items-commerce/redirect.controller.ts
apps/api/src/onboarding/items-catalog.service.ts
```
⚠️ `items-catalog.service.ts`는 손이 자주 닿는 큰 파일이다. 이 트랙이 만지는 것은 `clickProductLink`의 `userAgent` 한 줄뿐임을 착수 시 명시할 것.
