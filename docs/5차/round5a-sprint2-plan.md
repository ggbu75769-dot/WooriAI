# Round 5A Sprint 2 — 커머스 운영·실인증 구조·분석 안전성 (설계 계약)

대상 백로그(B0): **COM-103, COM-106, AUTH-101(서버 구조), ANA-101**
전제: Sprint 1 완료(마이그레이션 000006까지). 외부 계정(카카오 실키, 도메인)은 미확보 — 실키는 env 주입만으로 활성화되는 구조로 만든다.

## 0. 공통 원칙
- additive 마이그레이션만. 기존 테스트 green 유지. 오류 응답은 기존 `{ error: { code, message } }` 컨벤션.
- `apps/api/package.json`의 `test:e2e` 목록은 executor가 직접 수정하지 않는다(신규 e2e 파일명만 보고 → 오케스트레이터가 일괄 반영).
- `app.module.ts`는 ANA-101 담당만 수정한다(신규 AnalyticsModule 등록). 나머지는 기존 모듈(auth/admin/items-commerce) 내부에서 해결.

## 1. 마이그레이션 000007 (단일 선행 작업)

```text
content_revisions
  id uuid PK, entity_type varchar(32), entity_id uuid NULL(신규 생성 초안),
  revision_no int, payload jsonb, status varchar(16)
    (draft|in_review|published|rejected|archived),
  author_admin_id uuid, reviewer_admin_id uuid NULL, review_note text NULL,
  submitted_at/reviewed_at/published_at timestamptz NULL, scheduled_for timestamptz NULL,
  created_at, updated_at
  UNIQUE(entity_type, entity_id, revision_no), INDEX(status), INDEX(entity_type, entity_id)

oauth_transactions
  id uuid PK, provider varchar(16), state varchar(64) UNIQUE, nonce_hash varchar(128),
  code_challenge varchar(128) NULL, redirect_uri text,
  expires_at, consumed_at NULL, created_at
  INDEX(expires_at)

analytics_events
  id uuid PK, event_name varchar(64), event_version int, event_id uuid UNIQUE,
  occurred_at timestamptz, received_at timestamptz DEFAULT now(),
  user_anon_id varchar(64) NULL, household_anon_id varchar(64) NULL,
  app_version varchar(32) NULL, platform varchar(16) NULL, payload jsonb
  INDEX(event_name, occurred_at)

product_links
  + redirect_code varchar(16) NOT NULL UNIQUE — 기존 행은 SQL로 랜덤 backfill
    (예: substr(md5(gen_random_uuid()::text),1,12))
```

Prisma 모델 추가 시 기존 컨벤션(관계 필드 없음, @map snake_case) 유지.

## 2. AUTH-101 — 카카오 OIDC 서버 검증 구조

원칙(설계서 §4): 사용자 고유키는 `provider + subject`(현 users 유니크와 일치), provider token을 앱 세션으로 재사용하지 않음, 같은 이메일 자동 병합 금지(현 구조상 해당 없음).

### 흐름
```
POST /auth/kakao/prepare
  → { transactionId, state, nonce }   // nonce 평문 1회 반환, 서버는 sha256 저장, TTL 10분
POST /auth/kakao/exchange
  { transactionId, code, redirectUri, codeVerifier }
  1) tx 조회: 미소비·미만료·state 일치 (소비 시도는 원자적 — consumed_at CAS)
  2) redirectUri ∈ OAUTH_KAKAO_REDIRECT_URIS(csv env) 검사
  3) KakaoOidcClient.exchangeCode(): kauth token endpoint에 code+code_verifier 교환
  4) ID token 검증: RS256 JWKS(캐시, kid 매칭), iss="https://kauth.kakao.com",
     aud=OAUTH_KAKAO_CLIENT_ID, exp/iat, nonce(sha256)=tx.nonce_hash
  5) users find-or-create by (authProvider='kakao', providerUserId=sub).
     status blocked → 403, withdrawn → 재활성화 정책은 이번 범위 아님(403 + code)
  6) 기존 TokenService로 access/refresh 발급(기존 family 로테이션 재사용)
  7) tx consumed 마킹. 재사용 → 401 OAUTH_TRANSACTION_INVALID
```

### 구현 요구
- `KakaoOidcClient`는 인터페이스로 추상화(토큰 교환·JWKS 조회). 실구현은 fetch, 테스트는 mock 주입.
- JWT 검증은 `jose` 라이브러리 사용(RS256/JWKS). apps/api 의존성 추가 허용.
- env: `OAUTH_KAKAO_CLIENT_ID`(기존 슬롯 소비), `OAUTH_KAKAO_CLIENT_SECRET`(신규, optional), `OAUTH_KAKAO_REDIRECT_URIS`(신규 csv). requireSecret 패턴 + .env.example + check-env 갱신.
- 기존 `/auth/oauth-login` dev 스텁과 모바일 데모 로그인은 그대로 유지(회귀 금지).
- provider access/refresh token은 DB에 저장하지 않는다.
- 감사 가능성: 로그인 성공/실패에 기존 request log 외 별도 PII 로그 금지(sub/email 평문 로그 금지).

### 테스트 (mock JWKS — 자체 RSA 키쌍 생성)
정상 신규/재로그인, 서명 위조, 만료, aud 불일치, iss 불일치, nonce 불일치, tx 재사용(replay), redirectUri 비허용, blocked 사용자. e2e 신규 파일.

## 3. COM-103 — CMS Draft→Review→Publish

### 역할 규칙 (기존 AdminRole 3종 유지: admin/editor/analyst)
- **editor**: 초안 작성·수정·제출만. 기존 직접 변경 엔드포인트(POST/PATCH item-templates·product-links, PUT disclosures)는 **admin 전용으로 축소**(editor 403 — 이것이 백로그의 "editor 단독 즉시 게시 제한").
- **admin**: 검토·승인게시·반려·롤백·긴급 비활성화. **자신이 작성한 revision은 승인 불가**(작성자·승인자 분리).
- **analyst**: 조회만.

### API (admin 모듈 내부)
```
POST   /admin/content-revisions            { entityType, entityId|null, payload }
PATCH  /admin/content-revisions/:id        draft 상태 + 작성자 본인만
POST   /admin/content-revisions/:id/submit           → in_review
POST   /admin/content-revisions/:id/approve-publish   admin, 비작성자 → 트랜잭션 live 반영
POST   /admin/content-revisions/:id/reject { note }
POST   /admin/content-revisions/:id/rollback           admin — published 이력 payload로 새 revision 생성 후 즉시 게시
GET    /admin/content-revisions?entityType&entityId&status  (+ 단건 GET에 live 스냅샷 포함 → diff용)
```
- entityType: `item_template | product_link | disclosure`. payload는 entityType별 기존 create/update DTO 규칙으로 검증 후 게시.
- revision_no는 entity별 증가. 게시 시 live 테이블 반영 + published_at 기록 + 감사로그(AuditLoggerService) 전 액션 기록.
- 긴급 비활성화 = 기존 active=false PATCH(admin 전용) 유지.
- scheduled_for는 저장만(실행 워커는 INF-006 이후 — notes에 기록).

### Admin 웹 (ADM-005 최소형)
- items/links/disclosures 페이지: editor 세션이면 직접 저장 대신 "초안 저장 → 검토 요청" 플로우.
- 신규 검토 화면: in_review 목록 → live vs payload 필드별 diff → 승인 게시/반려(사유).
- 이력: entity별 revision 목록 + 롤백 버튼(admin).
- 기존 admin 계정(단독 admin)으로도 전 흐름이 동작해야 함(작성자·승인자 분리는 "타인 작성분만 승인"으로 강제하되, revision이 admin 본인 작성인 경우를 대비해 dev/test용 우회는 만들지 말고 seed에 editor 계정 추가).

## 4. COM-106 — 제휴 opaque redirect

```
GET /r/:code   (공개, 인증 불요, 기존 전역 rate limit 적용 확인)
  1) redirect_code로 active 링크 조회 (미존재/비활성 → 404 { error })
  2) 대상 URL = affiliateUrl ?? url. 도메인이 AFFILIATE_ALLOWED_DOMAINS(csv env,
     서브도메인 허용 매칭) 밖이면 → 404 + 링크 자동 비활성화는 하지 않고 경고 로그
  3) affiliate_clicks 기록: userId NULL 허용, ipHash=sha256(ip+salt env), userAgent,
     subId=clickId(자체 uuid — PII 금지), referrerScreenId='redirect'
  4) 302 Location: 대상 URL (쿼리로 받은 어떤 값도 목적지에 반영하지 않음 — open redirect 원천 차단)
```
- 기존 `POST /product-links/:id/click`도 동일 allowlist 검사 + ipHash/userAgent/subId 채움(응답 계약 유지).
- 모바일: 클릭 후 `Linking.openURL` 실패 시 "링크 복사" 폴백(expo-clipboard, 아이템 상세 화면).
- env: `AFFILIATE_ALLOWED_DOMAINS`, `AFFILIATE_CLICK_IP_SALT` (requireSecret + .env.example + check-env).
- e2e: 정상 302·클릭 로그, 비허용 도메인, 비활성 링크, 미존재 code, URL 조작 무영향, subId에 사용자/아이 식별자 미포함.

## 5. ANA-101 — 이벤트 envelope·PII 차단

### contracts (`packages/contracts/src/analytics.ts`, index에서 export)
- envelope: `{ eventName, eventVersion, eventId(uuid), occurredAt(ISO), appVersion?, platform?('ios'|'android'), payload }` — zod `.strict()`.
- 초기 이벤트 레지스트리 6종 (payload는 enum/불리언/버킷/정수 count만):
  `app_opened v1`, `onboarding_completed v1{stepCount}`, `expense_recorded v1{categoryCode, amountBucket(enum: lt10k|10k_50k|50k_100k|100k_500k|gte500k), source(manual|import|followup), offline(boolean)}`, `expense_synced v1{latencyBucket}`, `item_status_changed v1{itemCategoryCode, status}`, `affiliate_link_clicked v1{platform, screenId}`.
- **PII 금지 테스트**: 레지스트리 전 스키마의 키를 금지 목록(`memo,itemName,merchant,email,phone,displayName,name,birthDate,amountKrw,url` 등)과 대조하는 lint 테스트 + 자유 문자열 필드 금지(enum literal만 허용) 검증.

### API (신규 AnalyticsModule — app.module.ts 등록은 이 작업만)
```
POST /v1/analytics/events   (JwtAuthGuard)  body: { events: Envelope[] } (최대 50)
  - 이벤트별 검증: 레지스트리에 없는 name/version → rejected
  - user_anon_id = HMAC-SHA256(userId, ANALYTICS_ANON_SALT), household도 동일 — 클라이언트 전송값 무시
  - event_id 중복은 무시(멱등, accepted로 응답)
  - 응답: { accepted: n, rejected: [{index, reason}] } (부분 실패가 전체 400 아님)
  - payload에 금지 키 존재 시 rejected(스키마 strict가 차단) — raw 저장 전 재확인
```
- env: `ANALYTICS_ANON_SALT` (requireSecret + .env.example + check-env).

### 모바일 (최소)
- `src/analytics/` 경량 클라이언트: 큐잉+배치 전송. **opt-in 플래그(기본 OFF)** — ANA-102(동의) 전까지 실전송 없음.
- 배선 2곳만: 온보딩 완료, 지출 동기화 완료. 플래그 OFF 기본이므로 동작 무영향(테스트로 OFF 시 미전송 검증).

## 6. 검증 게이트
Sprint 1과 동일: 전 앱 테스트 green + 신규 e2e + diff-reviewer Sev-High 0.
