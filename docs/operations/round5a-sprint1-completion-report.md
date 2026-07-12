# Round 5A Sprint 1 완료 보고서 — 제품 신뢰성·관리자 보안

- 기준: `docs/5차/round5a-sprint1-plan.md` (설계 계약), Round 5 백로그 v0.3
- 완료 백로그 항목(B0): **COM-101, MOB-101, MOB-102, MOB-103(서버+모바일 축소), SEC-101, SEC-102**
- 검증: api 단위 **115/115**, api e2e **36/36**(10파일), mobile **174/174**(27파일), admin **14/14** — 전부 green, 각 앱 `tsc --noEmit` clean
- 검수: diff-reviewer 전수 검수 → High 3·Medium 3·Low 6 식별 → High/Medium 전건 + Low 2건 수정 완료, 최종 재실행 green

## 1. 배포된 것

### DB (마이그레이션 000006, additive-only)
- `expenses.version`(낙관적 동시성), `admin_users.totp_secret/mfa_enabled_at/mfa_recovery_codes`, `admin_sessions` 테이블

### MOB-103 서버 — 낙관적 동시성 + delta sync
- 지출 응답 전체에 `version` 노출. PATCH(body)/DELETE(query)의 optional `expectedVersion`.
- 불일치 시 `409 { error: { code: "VERSION_CONFLICT" }, current }` — CAS(`updateMany` 조건부 increment)로 race-safe, 검증 실패 시 조건부 롤백(버전 역행 방지).
- `GET /v1/sync/changes` — `(updated_at, id)` keyset 커서, upsert/delete tombstone envelope, 가구 스코프(IDOR e2e 검증), limit 100/최대 200.

### MOB-102 모바일 — 오프라인 outbox (`apps/mobile/src/offline/`)
- `local_expenses` + `mutation_outbox` (expo-sqlite 실구현 + 테스트용 in-memory 구현, 인터페이스 추상화).
- 로컬 우선 저장 → `Idempotency-Key` 재전송, 지수 backoff, expo-network+AppState 재시도 트리거.
- in-flight 마커로 전송 중 편집 유실 방지, flush 단일 promise 가드 직렬화, create+update/create+delete/update+update outbox 병합.
- 충돌 3분기 UI(D-10): 다른 기기 값 유지 / 내 변경 다시 적용 / 두 값 나란히 보기. silent LWW 없음.
- EXP-005 동기화 상태 화면(`app/sync-status.tsx`) + 기록 탭 배지·아이콘·목록/합계 정합(reconcile 순수함수).
- 문구 계약: 오프라인 "기기에 저장했어요…" / 서버 확인 후에만 "기록했어요…".
- 축소 범위: 델타 pull은 재연결 시 1회 조회+invalidate. 커서 영속화·완전 멀티디바이스 병합은 Sprint 2 후보.

### MOB-101 온보딩 이어하기
- 진행 상태를 기존 리소스(동의·아이·준비템·예산)에서 파생 — 별도 저장소 없음(드리프트 원천 차단).
- `/children` 멱등화(Idempotency-Key)로 중복 아이 생성 방지. ONB-006 이어하기 화면(가구에 아이가 있으면 "처음부터" 비노출 — 보수적 규칙). (tabs) 진입 가드.

### SEC-101/102 Admin 보안
- **세션**: Bearer/localStorage 완전 제거 → `admin_sessions` + HttpOnly 쿠키(12h 고정 만료), 로그인마다 신규 세션(고정 공격 차단), 로그아웃/비활성화 시 revoke.
- **CSRF**: 더블서밋(`admin_csrf` 쿠키 + `X-CSRF-Token`), 상태 변경 메서드만.
- **CSP**: Next.js nonce 기반 CSP + `frame-ancestors 'none'` + nosniff. admin 3001 → API 3000 same-origin 프록시.
- **MFA(D-09)**: otplib TOTP, QR 등록, 복구코드 10개(1회용·해시), 5회 실패 15분 잠금, 전 관리자 강제 등록(403 게이트). 실브라우저로 전 플로우 수동 검증됨.
- 레거시 `x-admin-token`은 dev/test 전용(프로덕션 fail-closed).

### COM-101 아이템 상세
- "왜 필요해요?"(reasonText) / "이런 경우엔 안 사도 돼요"(skipReasonText, null 시 숨김) 렌더. 62종 시드 데이터 검증. 픽셀락 기준 이미지는 QA-101 재측정 대상(`docs/5차/round5a-sprint1-notes.md`).

## 2. 검수에서 잡은 결함 (수정 완료)

| 심각도 | 내용 | 수정 |
|---|---|---|
| High | 모든 409를 VERSION_CONFLICT로 오인 → 해결 불가 유령 충돌 | `error.code` 검사로 분류 + null-current 방어 |
| High | 기록 탭 pending 편집 이중 표시·이중 합산 | canonicalId 제외 + 합계 재계산 순수함수 |
| High | flush 전송 중 편집 무음 유실 | in-flight 마커 + append + flush mutex |
| Medium | CAS 롤백 무조건 decrement → 버전 역행 가능 | 조건부 롤백(`version = expected+1`일 때만) |
| Medium | adoptServerExpense가 pending payload 덮어씀 | synced 아닐 때 payload 보존 |
| Medium | 픽셀락 재측정 기록 누락 | notes 문서화 |
| Low×2 | admin bare Error 500 / MFA 화면 계정 전환 세션 잔존 | UnauthorizedException / logout 후 clear |

잔여 Low(참고 수준)와 후속 개선 후보는 `docs/5차/round5a-sprint1-notes.md`에 기록.

## 3. 대신 결정한 기본값 (변경 원하면 재논의)

- **D-09**: TOTP + 1회용 복구코드 (passkey 대비 구현·복구 비용 낮음)
- **D-10**: 충돌 시 사용자 선택형 3분기 (설계서 §5.3)

## 4. 남은 B0 — 사용자 결정이 선행되어야 하는 것 (Wave 0)

| 결정 | 내용 | 막혀 있는 백로그 |
|---|---|---|
| D-01 | 운영 클라우드/리전 | INF-001~008, OBS-*, QA-103/104/107 |
| D-02 | 운영 법인/개인정보 처리자 | PRIV-102 이후 전부, REL-007 |
| D-03 | 앱 패키지명·도메인 | REL-001~003, MOB-106, PRIV-103 |
| D-04 | Android 우선 vs iOS 동시 | REL-002/003, AUTH-102 |

결정 없이도 코드로 진행 가능한 다음 스프린트 후보: **COM-103(CMS Draft→Review→Publish), COM-106(제휴 opaque redirect), ANA-101(이벤트 envelope), AUTH-101(카카오 OIDC 서버 검증 구조 — 키는 후반 주입), INF-005/006(Redis rate limit·outbox/DLQ — docker 로컬), MOB-103 모바일 완성(커서 영속화 델타 병합), PRIV-103(삭제 API·상태머신 — 웹 도메인 제외)**
