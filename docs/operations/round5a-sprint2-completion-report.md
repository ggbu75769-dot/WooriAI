# Round 5A Sprint 2 완료 보고서 — 커머스 운영·실인증 구조·분석 안전성

- 기준: `docs/5차/round5a-sprint2-plan.md` (설계 계약), Round 5 백로그 v0.3
- 완료 백로그 항목(B0): **COM-103, COM-106, AUTH-101(서버 구조), ANA-101**
- 검증: api 단위 **167/167**(34파일), api e2e **14파일**(신규 4파일 포함), admin **20/20**, mobile **187/187**, contracts **34/34** — 전부 green, 각 앱 `tsc --noEmit` clean
- 검수: diff-reviewer 전수 검수 → High 1·Medium 2·Low 8 식별 → High/Medium 전건 + Low 7건 수정, Low 1건(L-8 포함 전건 처리)

## 1. 배포된 것

### DB (마이그레이션 000007·000008, additive-only)
- `content_revisions`, `oauth_transactions`, `analytics_events` 신설
- `product_links.redirect_code` (unique, 기존 행 backfill + DB default)
- `affiliate_clicks.user_id/household_id/child_id` nullable화 (익명 redirect 클릭)
- seed: editor 계정(dev/test 전용) — 작성자·승인자 분리 검증용

### COM-103 — CMS Draft→Review→Publish
- `POST/PATCH /admin/content-revisions` + submit/approve-publish/reject/rollback. 상태: draft→in_review→(publishing)→published / rejected / archived.
- **editor는 초안·제출만, 게시는 admin — 본인 작성분 승인 금지(서버 강제)**. 기존 직접 변경 엔드포인트는 admin 전용으로 축소.
- 게시는 기존 admin 비즈니스 규칙(OnboardingStoreService) 재사용, 상태 전이는 updateMany CAS + 실패 시 보상 복원. revisionNo 경합은 P2002 재시도(소진 시 409).
- 롤백: published 이력 payload로 새 revision 생성 후 즉시 게시. 전 액션 감사로그.
- Admin 웹: 검토 페이지(in_review 목록, live vs payload 필드별 diff, 승인/반려), revision 이력·롤백, editor 세션의 초안 플로우.
- scheduled_for는 저장만 — 실행 워커는 INF-006(큐 인프라) 이후.

### COM-106 — 제휴 opaque redirect
- `GET /r/{code}` 공개 라우트: active 링크 → allowlist(서브도메인 매칭, `evil-coupang.com`류 거부) → 익명 클릭 기록(ipHash=sha256(ip+salt), userAgent, subId=자체 uuid) → 302. 쿼리/헤더는 Location에 절대 반영되지 않음(open redirect 원천 차단).
- 기존 인앱 클릭 API도 allowlist 검사 + 클릭 메타 기록 확장(응답 계약 유지).
- 모바일: 링크 열기 실패 시 공유(Share)·다시 시도 폴백.

### AUTH-101 — 카카오 OIDC 서버 검증 구조 (실키는 env 주입으로 활성화)
- `POST /auth/kakao/prepare`(tx+state+nonce, TTL 10분) → `POST /auth/kakao/exchange`(state·redirectUri 대조 → tx 원자 소비(CAS, 외부 호출 전 선점으로 replay 창 제거) → code 교환 → jose JWKS 검증: RS256 고정·iss/aud/exp·sub 필수·nonce 해시 대조).
- 사용자 키는 (kakao, sub) find-or-create — **동시 최초 로그인 P2002는 전체 재시도로 흡수**(중복 사용자 0). 이메일 자동 병합 없음. provider token 저장·로그 없음. blocked/withdrawn 403.
- 기존 dev 스텁·모바일 데모 로그인 그대로 유지. 필요 env: `OAUTH_KAKAO_CLIENT_ID/SECRET(선택)/REDIRECT_URIS`.
- 테스트: mock JWKS(RSA 키쌍)로 e2e 14종(위조/만료/aud/iss/nonce/state/replay/blocked 등) + 단위 8종.

### ANA-101 — 이벤트 envelope·PII 차단
- contracts에 zod 레지스트리 6종(app_opened, onboarding_completed, expense_recorded, expense_synced, item_status_changed, affiliate_link_clicked — payload는 enum/불리언/버킷/정수만).
- **PII lint**: 레지스트리 순회형 테스트 — 금지 키(memo·itemName·email·amountKrw 등) + 자유 문자열 필드 금지. 새 이벤트 추가 시 자동 검사.
- `POST /analytics/events`(배치≤50): envelope+스키마 이중 strict 검증, event_id 멱등(동시 중복 P2002 처리), anon id는 서버 HMAC 파생(클라이언트 값 무시·응답 미노출), 부분 실패 응답 `{accepted, rejected[]}`.
- 모바일 경량 클라이언트: **opt-in 기본 OFF(큐잉 자체 차단)** — ANA-102(동의) 연동 전 실전송 없음.

### 환경 변수 (신규 5종, check-env·부트 검사 연동)
`OAUTH_KAKAO_CLIENT_SECRET`(선택), `OAUTH_KAKAO_REDIRECT_URIS`, `AFFILIATE_ALLOWED_DOMAINS`, `AFFILIATE_CLICK_IP_SALT`, `ANALYTICS_ANON_SALT` — 뒤 3종은 프로덕션 부트 시 필수 검증(지연 500 방지).

## 2. 검수에서 잡은 결함 (수정 완료)

| 심각도 | 내용 | 수정 |
|---|---|---|
| High | 동시 최초 로그인 P2002 → 500 (dev 스텁까지 회귀) | 트랜잭션 전체 재시도(P2002 시 find 경로), 동시성 회귀 테스트 |
| Medium | CMS revisionNo 경합 → 미처리 500 | P2002 재시도 + 409 |
| Medium | approve/reject 동시 요청 시 이중 게시·상태 오염 | updateMany CAS 선점(publishing) + 보상 복원 |
| Low×7 | state 미검증, sub 부재 500, RS256 미고정, displayName 기본값, disclosure key 불일치, check-env 과잉 필수, 부트 검사 미확장, 가구 선택 비결정 | 전건 수정 |

## 3. 남은 참고 사항
- redirect 라우트는 현재 `/api/v1/r/{code}` — 짧은 도메인 매핑은 D-03(도메인 결정) 후 인프라에서.
- CMS 예약 게시 실행, 링크 헬스체크(COM-105), 알림 등 큐 기반 작업은 INF-005/006(Redis·worker)이 선행.
- 카카오 실연동 활성화 = 카카오 콘솔 앱 생성 후 `OAUTH_KAKAO_*` 주입 + 모바일 SDK/딥링크 연결(REL-001 패키지명 결정 필요).

## 4. Round 5A 누적 현황 (Sprint 1+2)
코드로 진행 가능한 B0 중 완료: COM-101/103/106, MOB-101/102/103, SEC-101/102, AUTH-101(서버), ANA-101 — **10개**.
다음 코드 가능 후보: INF-005/006(Redis rate limit·outbox/DLQ — docker 로컬), PRIV-103(삭제 상태머신), MOB-103 모바일 델타 병합 완성, ANA-102(동의 연동), REL-006(원격 앱 설정).
외부 결정 대기(D-01~D-04)는 Sprint 1 보고서와 동일.
