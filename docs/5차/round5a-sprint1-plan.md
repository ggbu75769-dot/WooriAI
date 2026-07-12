# Round 5A Sprint 1 — 제품 신뢰성·관리자 보안 (설계 계약)

기준 문서: `wooriai_round5_production_readiness_design_v0_3.docx`, 백로그 v0.3
대상 백로그: **COM-101, MOB-101, MOB-102, MOB-103, SEC-101, SEC-102** (모두 B0)
제외: 외부 계정·인프라 결정(D-01~D-04)이 필요한 항목(REL-*, INF-*, AUTH-101/102 실연동)은 결정 후 착수.

## 0. 공통 원칙

- 기존 통과 테스트를 깨지 않는다. 스키마 변경은 additive(expand)만 허용.
- 금액은 양의 정수 원칙 유지. 환불 모델(LED-101)은 이번 스프린트 범위 아님.
- 새 마이그레이션은 `apps/api/prisma/migrations/` 순번 규칙(raw SQL)을 따른다.
- 사용자 노출 문구는 한국어, 기존 톤(존댓말) 유지.

## 1. DB 스키마 확장 (마이그레이션 000006)

### expenses
- `version INT NOT NULL DEFAULT 1` — 생성 시 1, 모든 수정·soft delete 시 +1.

### admin_users (실제 테이블명은 schema.prisma 확인)
- `totp_secret TEXT NULL` (base32, 저장 시 암호화 불필요 — 단일 DB 신뢰 경계, 단 로그 노출 금지)
- `mfa_enabled_at TIMESTAMPTZ NULL`
- `mfa_recovery_codes JSONB NULL` — scrypt/sha256 해시 배열, 사용된 코드는 제거

### admin_sessions (신규)
- `id UUID PK`, `admin_user_id FK`, `token_hash TEXT NOT NULL UNIQUE`(랜덤 256bit 세션 토큰의 sha256),
  `created_at`, `expires_at`, `last_seen_at`, `ip TEXT NULL`, `user_agent TEXT NULL`, `revoked_at TIMESTAMPTZ NULL`
- 인덱스: admin_user_id, expires_at

## 2. MOB-103 서버 계약 — 낙관적 동시성 + delta sync

### 2.1 version 노출
- 지출 단건/목록/홈/기록 응답의 expense 객체에 `version` 포함.

### 2.2 조건부 수정/삭제
- `PATCH /v1/expenses/:id`, `DELETE /v1/expenses/:id` 요청에 optional `expectedVersion: number`
  (PATCH는 body, DELETE는 query 또는 body — 구현 일관성 있게 택1하고 계약 테스트로 고정).
- `expectedVersion` 제공 + 서버 version 불일치 →
  `409 { "error": { "code": "VERSION_CONFLICT" }, "current": <최신 expense 객체 | soft-deleted면 { id, deleted: true, version } > }`
- `expectedVersion` 미제공 시 기존 동작(하위 호환). 모바일 신규 코드는 항상 전송.
- 수정 성공 응답에 새 `version` 포함. 멱등성은 기존 Idempotency-Key 인터셉터 재사용.

### 2.3 delta sync
```
GET /v1/sync/changes?cursor=<opaque>&limit=<max 200, default 100>
```
- 범위: 세션 사용자의 가구 소속 expenses (추후 리소스 타입 확장 가능한 envelope).
- 정렬: `(updated_at, id)` 오름차순 안정 정렬. cursor는 `base64(updatedAt|id)` opaque 문자열.
- 응답:
```json
{
  "changes": [
    { "type": "expense", "op": "upsert", "data": { ...expense, "version": 3 } },
    { "type": "expense", "op": "delete", "id": "...", "version": 4, "deletedAt": "..." }
  ],
  "nextCursor": "…",
  "hasMore": false
}
```
- soft delete된 행은 `op: "delete"` tombstone으로 내려간다. cursor 없이 호출하면 처음부터.
- e2e: 생성→수정→삭제→커서 반복 조회 시 누락·중복 없음, 타 가구 데이터 미노출(IDOR).

## 3. MOB-102 모바일 — 오프라인 outbox

### 3.1 로컬 저장 (expo-sqlite)
```
local_expenses(local_id TEXT PK, canonical_id TEXT NULL, child_id TEXT, payload TEXT(JSON),
               version INT NULL, sync_state TEXT CHECK IN ('pending','syncing','synced','failed','conflict'),
               created_at, updated_at)
mutation_outbox(mutation_id TEXT PK, idempotency_key TEXT NOT NULL, operation TEXT CHECK IN ('create','update','delete'),
                target_local_id TEXT, payload TEXT(JSON), expected_version INT NULL,
                attempt_count INT DEFAULT 0, next_retry_at TEXT NULL, last_error TEXT NULL, created_at)
```

### 3.2 흐름
1. 지출 생성/수정/삭제 → SQLite 먼저 기록, UI 즉시 반영(react-query 캐시 갱신).
2. 온라인이면 즉시 flush: outbox 순서대로 `Idempotency-Key: <idempotency_key>`로 전송.
3. 성공 → canonical_id/version 저장, sync_state='synced', outbox 행 제거.
4. 네트워크 오류 → 'pending' 유지, 지수 backoff(next_retry_at), NetInfo 연결 복구·앱 foreground 시 재시도.
5. 4xx 영구 실패(422 등) → 'failed' + 사용자에게 재시도/삭제 선택.
6. 409 VERSION_CONFLICT → 'conflict' + 충돌 UI.

### 3.3 문구 (설계서 §5.2)
- 오프라인 저장 직후: **“기기에 저장했어요. 연결되면 자동으로 반영할게요.”**
- 서버 확인 후: **“기록했어요. 이번 달 우리 아이 비용에 더해둘게요.”**

### 3.4 충돌 UI (EXP-005, D-10 기본값)
- 안내: “다른 기기에서 이 기록이 바뀌었어요.”
- 선택지: ① 다른 기기 값 유지 ② 내 변경 다시 적용 ③ 두 값 나란히 보기.
- silent last-write-wins 금지.

### 3.5 동기화 상태 표시
- 기록 탭에 대기/동기화 중/실패/충돌 건수 배지 + 상태별 목록 진입.
- 미동기화 항목은 목록에서 아이콘으로 구분.

## 4. MOB-101 온보딩 이어하기

- 온보딩 각 단계 완료 시 서버에 진행 상태 저장(단계 키 + 입력 요약). 로컬 zustand persist는 보조.
- 앱 재시작·재로그인 시: 서버 진행 상태 조회 → 중단 단계로 복원. “처음부터 / 이어서” 선택 제공(ONB-006).
- 온보딩 미완료 세션은 탭 홈 진입 차단(라우팅 가드).
- 단계 커밋은 멱등: 같은 단계 재제출로 가구/아이가 중복 생성되지 않는다 (기존 Idempotency-Key 또는 서버측 upsert).
- 서버 저장이 필요한 신규 필드/테이블은 마이그레이션 000007로 추가(이 작업 단독 소유).

## 5. SEC-101/102 Admin 보안

### SEC-101 TOTP MFA (D-09 기본값: TOTP + 복구코드)
- otplib 기반 TOTP. 등록: secret 생성 → otpauth URL/QR 표시 → 코드 검증 성공 시 `mfa_enabled_at` 설정 + 복구코드 10개 1회 발급(해시 저장, 평문은 그 화면에서만).
- 로그인: 이메일/비밀번호 성공 → MFA 등록자는 TOTP 단계(복구코드 대체 가능, 사용 즉시 소각).
- 정책: 모든 admin/editor/analyst 계정은 최초 로그인 시 MFA 등록을 강제(등록 전에는 MFA 설정 외 API 접근 차단).
- 감사로그: 등록/해제/복구코드 사용/실패 누적.
- brute-force: TOTP 검증 실패 5회 → 계정 15분 잠금(기존 rate limit과 별개).

### SEC-102 브라우저 세션
- Bearer/localStorage 토큰 제거 → 로그인 성공 시 `admin_sessions` 발급 + `Set-Cookie: HttpOnly; Secure; SameSite=Lax; Path=/`(이름 예: `admin_session`). dev 환경은 Secure 예외 허용.
- 모든 admin API는 쿠키 세션 인증. 만료/폐기 세션 즉시 401.
- CSRF: SameSite=Lax + 상태 변경 요청(POST/PATCH/DELETE)에 `X-CSRF-Token` 더블서밋 검증.
- Next.js admin 앱: CSP(default-src 'self' 계열), `frame-ancestors 'none'`, `X-Content-Type-Options` 등 보안 헤더.
- 로그아웃 = 세션 revoke. 계정 비활성화 시 해당 계정 모든 세션 revoke.

## 6. COM-101 아이템 상세 렌더

- `apps/mobile/app/items/[itemTemplateId].tsx`에 두 섹션 노출:
  - **“왜 필요해요?”** — `reasonText` (전 품목 존재)
  - **“이런 경우엔 안 사도 돼요”** — `skipReasonText` (null이면 섹션 숨김)
- 긴 문구 줄바꿈 처리, 스크린리더 라벨, 구매 CTA 인접 제휴 고지 위치 유지.
- 62종 시드에서 필드 렌더 검증 테스트(데이터 계층 단위 + 화면 로직).
- 픽셀락 기준 이미지 변경이 필요하면 QA-101 재측정 대상으로 표시(강제 갱신 금지, 문서에 기록).

## 7. 검증 게이트 (스프린트 완료 기준)

1. `pnpm test` (turbo: api/mobile/admin 단위) 전체 green
2. api `test:e2e` 전체 green (신규 sync/mfa e2e 포함)
3. 신규 기능별 수용 기준: §2~§6 각 항목의 테스트 존재
4. diff-reviewer 검수에서 Sev-High 0건
