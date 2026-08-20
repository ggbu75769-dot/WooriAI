# 우리아이 전체 기능 점검 & 팔리는 앱 설계 (Round 5B 제안)

작성일: 2026-08-14
기준: `master` (f2e5c92, Round 5A 디자인 파운데이션까지) — apps/mobile · apps/api · apps/admin · packages · docs 전수 점검

> **구현 현황 업데이트 (2026-08-14, 이 브랜치에서 완료)**
> 아래 설계 중 다음 항목이 같은 PR에서 구현 완료됨:
> - P0-4 관리자 계정 API+UI (ADM-006) · P1-1의 디바이스 등록 API (`/me/devices`) · P1-2 분석 동의+이벤트 4종 (ANA-102/103) · P1-3 구매 확인 루프 (COM-108) · P1-4 `GET /categories`
> - §3 UX 수정: 1(스켈레톤)·2(탭 아이콘)·3(허위 정보 제거)·5(준비템 상태 필터)·6(알림 벨 정리)·7(지출 수정 날짜·카테고리)·8(장바구니→찜)·9(메뉴 정합화)·10(버전 표시)·11(도넛 기간 정합, REP-104)·12(온보딩 타임아웃 폴백)
> - P2 선행: 100일·첫돌 리포트+공유 (REP-103) · 제휴 링크 CSV 일괄 교체 도구 (COM-107 준비) · 경량 워커: CMS 예약 게시 실행+만료 데이터 정리 (INF-006-lite)
> - P0-1 카카오 모바일: 스캐폴드 완료 (AUTH-102) — 실 앱 키 env 3종만 주입하면 활성화
> 남은 것: 실 제휴 링크 데이터(외부 승인), 릴리즈 정체성(P0-3, 외부 결정), 푸시 발송(외부 인프라), §3-4 네이티브 date picker(네이티브 재빌드 필요), §3-13 픽셀락 분리.

이 문서는 4가지를 다룹니다.

1. 전체 기능 점검 (구현 완료 / 부분 / 스텁 매트릭스)
2. 필요한 기능 추가 설계 (우선순위별)
3. 사용자 입장에서 수정해야 할 부분 (UX 수정 목록)
4. "진짜 팔릴 수 있는 앱"으로 가는 설계 (수익·리텐션·출시 체크리스트)

---

## 1. 전체 기능 점검

### 1.1 요약 판정

핵심 루프(지출 기록 → 총액 확인 → 시기별 준비템 → 구매 링크 클릭 → 구매 후 체크)는 **서버·클라이언트 모두 실코드로 동작**하며, 테스트도 전부 green(api 단위 167, e2e 15개 suite, mobile 187, admin 20, contracts 34, `release:gate` 10/10)입니다. 기술 완성도는 출시 직전 수준이나, **수익과 직결되는 마지막 1cm — 실 로그인, 실 제휴 링크, 알림, 계측 — 이 전부 비어 있는 상태**입니다. 즉 "잘 만든 데모"와 "팔리는 앱" 사이에 있습니다.

### 1.2 기능별 상태 매트릭스

| 영역 | 상태 | 근거 |
|---|---|---|
| 지출 기록 (오프라인 outbox·낙관적 동시성·초안 자동저장) | ✅ 완전 | `apps/mobile/src/offline/`, `apps/api/src/finance/expenses.service.ts` (version CAS, Idempotency-Key) |
| 리포트 (월/분기/연/누적, 라인·도넛 차트) | ✅ 완전 | `app/(tabs)/reports.tsx`, `src/finance/reports.controller.ts` |
| 예산 설정·초과 넛지 | ✅ 완전 | `app/budget.tsx`, 홈 progress |
| 시기별 준비템 + 상태 변경 | ✅ 완전 | `app/(tabs)/items.tsx`, `ChildItemStatus` |
| 가족 초대 (역할별 링크·수락·강제 제외) | ✅ 완전 | `src/households/` — 단, 초대 URL이 `https://wooriai.local/...` 하드코딩 |
| 엑셀/CSV 임포트 (CP949, 인젝션 방어, row 검수) | ✅ 완전 | `src/imports/import-parser.ts` |
| 온보딩 4단계 + 이어하기 (MOB-101) | ✅ 완전 | `app/(onboarding)/` |
| 프라이버시 (계정/아이 삭제, 탈퇴 2-step) | ✅ 완전 | `src/settings/` |
| 관리자 CMS (Draft→Review→Publish, MFA, RBAC, CSRF) | ✅ 완전 | `apps/admin/`, `src/admin/content-revisions.controller.ts` |
| 제휴 리다이렉트 (opaque code, allowlist, 익명 클릭) | ✅ 완전 | `src/items-commerce/redirect.controller.ts` |
| Kakao OIDC | ⚠️ 절반 | **서버는 완성**(`src/auth/kakao/` — PKCE, nonce, JWKS 검증, CAS 재사용 방지). **모바일은 스텁**: `client.ts:433`이 `providerToken: "dev-kakao"` 전송, Kakao SDK 의존성 없음. 실키 env 미주입 |
| 분석/계측 (ANA-101) | ⚠️ 절반 | 서버 수집 API·PII 차단 완성, 모바일 큐/배치 완성. 그러나 **동의 UI가 없어 기본 OFF로 영구 휴면**, 이벤트 6종 중 2종만 발화 (`app_opened`, `expense_recorded`, `item_status_changed`, `affiliate_link_clicked` 미발화) |
| 제휴 커머스 데이터 | ⚠️ 절반 | 시드 상품링크 58개가 전부 `example.com`. 상품 상세의 평점 "★ 4.8 (2,154)"·경쟁 최저가가 **하드코딩 허위 데이터** (DNC 신뢰 원칙 위반 소지) |
| 디자인 시스템 (Round 5A) | ⚠️ 절반 | 테마 토큰은 적용됨. 신규 컴포넌트(`MoneyText`, `Skeleton`, `StageBadge`, `EmptyState`, `ListRow`)와 `src/money.ts`는 **어느 화면도 import하지 않음** — 화면마다 로컬 `formatKrw` 중복 |
| 알림 | ❌ 스텁 | `app/notifications.tsx` 빈 화면. `UserDevice` 모델(푸시 토큰)은 스키마만 있고 참조 코드 0 |
| 장바구니 담기 | ❌ 스텁 | 토스트만 출력, 실체 없음 (`items/[itemTemplateId].tsx:321`) |
| 결제 수단 선택 | ❌ 스텁 | 하드코딩 4개 목록 순환 |
| 영수증 첨부 | ❌ 미구현 | `Attachment` 모델 스키마만 존재, 참조 코드 0 |
| `packages/ui`·`packages/config` | ❌ 빈 껍데기 | 이름 export 1줄뿐. 실제 UI 킷은 `apps/mobile/src/ui.tsx` |

### 1.3 인프라·운영 격차

- **Rate limit이 인메모리** (전역 + 관리자 로그인 잠금 카운터) — 수평 확장 시 무력화. Redis 대기(INF-005).
- **워커/스케줄러 없음** — refresh 토큰·OAuth 트랜잭션 만료 정리는 lazy, CMS `scheduledFor` 예약 게시는 저장만 되고 실행 안 됨(INF-006).
- **델타 sync가 expense만** 커버 — 아이·준비템 상태·예산은 tombstone 없음. 모바일도 커서 미영속.
- **카테고리 목록 API 없음** — 클라이언트는 아이템/리포트 응답을 통해서만 카테고리를 봄.
- **관리자 계정 관리 API 미구현** — 계정 추가·비활성화가 seed/DB 직접 조작.
- 앱 정체성: 버전 `0.0.0`, 패키지 `com.anonymous.wooriai`, debug 서명 → **스토어 제출 불가** 상태.
- 외부 결정 대기(Wave 0): D-01 클라우드/리전, D-02 운영 법인, D-03 패키지명·도메인, D-04 Android/iOS 우선순위.

---

## 2. 필요한 기능 추가 설계 (우선순위별)

### P0 — 출시 차단 해제 (이거 없으면 앱이 아니라 데모)

**P0-1. 카카오 로그인 모바일 실연동 (AUTH-102)**
서버 OIDC는 이미 PKCE·nonce까지 완성이므로 모바일만 붙이면 됩니다. 네이티브 Kakao SDK 없이 `expo-auth-session`으로 가능:

```
1) POST /auth/kakao/prepare  → { state, nonce, authorizeUrl }
2) expo-auth-session 브라우저 플로우 (PKCE code_verifier는 기기 보관)
3) redirect 수신 → POST /auth/kakao/exchange { code, state, codeVerifier }
4) 기존 토큰 페어 저장 로직 그대로 재사용 (session.store)
```

- `EXPO_PUBLIC_TEST_LOGIN=1` 데모 경로는 현행 유지 (스토어 심사·QA용).
- 완료 조건: 실기기에서 카카오 계정 로그인 → `/me` 정상, 데모 세션과 충돌 없음(91fe928 회귀 테스트 포함).

**P0-2. 실 제휴 링크 파이프라인 (COM-107)**
- 쿠팡 파트너스 승인 → 시드 58개 링크를 실 딥링크로 교체하는 관리자 일괄 교체 도구(CSV 업로드) 추가. 이미 있는 admin product-links CRUD를 확장하면 됨.
- `AFFILIATE_ALLOWED_DOMAINS`에 `coupang.com`, `link.coupang.com`, `naver.com` 계열 등록.
- **허위 평점·허위 대표가 제거**(§3-3 참조) — 실데이터가 없으면 표시하지 않는 것이 DNC-009~011(신뢰 원칙)에 부합.

**P0-3. 릴리즈 정체성 (REL-006)**
- 패키지명 확정(D-03), 릴리즈 keystore 생성·보관 절차, 버전을 `expo-application`에서 읽어 표시 (`more.tsx:26` 하드코딩 제거).

**P0-4. 관리자 계정 관리 API (ADM-006)**
- admin 전용 `POST/PATCH /admin/users` (역할 부여, 비활성화, 초기 비밀번호 발급 후 강제 변경). 기존 RBAC·MFA 강제 흐름 재사용.

### P1 — 핵심 루프를 "수익 루프"로 완성

**P1-1. 푸시 알림 (NOTI-101) — 리텐션의 핵심**
`UserDevice` 모델이 이미 있으므로 스키마 변경 없이 시작 가능.

- 서버: `POST /me/devices` (Expo push token 등록), 발송 워커(INF-006과 함께 도입).
- 알림 종류 (모두 opt-in, 야간 발송 금지):
  - **시기 전환 알림**: 아이 stage가 바뀌는 주 → "이유식 준비 시기예요. 필수템 4개를 확인해보세요" (아이 성장 자체가 자연 리텐션 트리거 — 이 앱만의 구조적 장점)
  - 예산 80%/100% 도달
  - 주간 요약 (이번 주 지출·이번 달 페이스)
- `app/notifications.tsx` 빈 화면을 알림 이력 + 종류별 토글로 교체.

**P1-2. 분석 동의 + 이벤트 발화 완성 (ANA-102/103)**
- 온보딩 약관 단계에 분석 동의(선택) 항목 추가 → `analytics/flag` 연동.
- 미발화 4종 이벤트를 화면에 연결: `app_opened`(app/index), `expense_recorded`(EXP-001 저장), `item_status_changed`(items 탭), `affiliate_link_clicked`(상품 상세).
- 이것이 되어야 §4의 KPI(첫 기록률·체크율·클릭률)가 측정 가능해짐. **계측 없이는 "팔리는 앱" 여부를 알 수 없음.**

**P1-3. 구매 확인 루프 (COM-108)**
현재 루프가 "클릭"에서 끊깁니다. 클릭 → 복귀 시점을 잡아 구매를 지출로 되돌리는 고리:

- 제휴 링크로 나갔다가 앱 복귀(AppState) 시, 24시간 내 해당 아이템에 대해 1회 "혹시 구매하셨나요?" 프롬프트 → [샀어요: 금액 입력 → `source=purchase_followup` 지출 생성 + 준비템 자동 '준비했어요'] / [아직이요] / [관심 없어요: `not_needed`].
- `AffiliateClick`에 이미 user/child가 기록되므로 서버 추가 작업은 최소.
- 이 한 개 기능이 **준비템 체크율·재방문·지출 데이터 풍부화**를 동시에 올리는 최고 레버리지.

**P1-4. 카테고리 목록 엔드포인트 (`GET /categories`)** — 지출 수정 화면의 카테고리 편집 UI(§3-7) 선행 조건.

### P2 — 차별화·프리미엄 (v1.5 로드맵과 정합)

- **영수증 사진 → AI 자동 기록 (IMP-104)**: `Attachment` 모델 활용, 촬영 → 업로드 → LLM 파싱 → 기존 임포트 row-검수 UI 재사용. 무료 월 N회 / 프리미엄 무제한 → 첫 구독 상품.
- **연간/100일 리포트 (REP-103)**: "우리 아이 100일 비용 리포트" 공유 카드(이미지 내보내기) — 기획 문서의 바이럴 장치 1순위. 연간 PDF는 프리미엄.
- **가격 추적 알림 (COM-109)**: 관심(`interested`) 상태를 활용 — 찜한 준비템 가격 하락 시 푸시. `interested`가 현재 설정 불가인 문제(§3-5)를 먼저 풀어야 함.
- **인프라 승격**: Redis rate limit(INF-005), 발송·정리·예약게시 워커(INF-006), sync 범위 확대(아이·상태·예산 tombstone).

---

## 3. 사용자 입장에서 수정해야 할 부분 (UX 수정 목록)

우선순위순. 대부분 1~2일 크기의 저비용·고체감 수정입니다.

1. **로딩이 "잠시만요" 버튼으로 보임** — 거의 모든 화면이 로딩 시 `EmptyStateCard`+가짜 버튼을 렌더. Round 5A에서 만든 `Skeleton`/`SkeletonCard`를 실제 화면에 적용. (동시에 죽은 컴포넌트 `MoneyText`·`StageBadge`·`EmptyState`·`ListRow`·`src/money.ts` 채택, 화면별 로컬 `formatKrw` 중복 제거 — 파운데이션은 만들어놓고 안 쓰는 상태)
2. **탭 아이콘이 텍스트 글리프(○●□■☆★)** — 저가형 인상. `@expo/vector-icons` 등으로 교체.
3. **허위 정보 제거** — 상품 상세의 가짜 평점 "★ 4.8 (2,154)"·가짜 경쟁 최저가·프리뷰 사전입력 금액. 신뢰가 곧 전환율인 제휴 모델에서 치명적이며 DNC 계약 위반 소지. 실데이터 없으면 미표시.
4. **날짜 입력이 YYYY-MM-DD 수기 TextInput** — 네이티브 date picker(`@react-native-community/datetimepicker`)로 교체.
5. **준비템 탭 상태 필터 부재** — API는 `soon/prepared/not_needed` 탭을 지원하는데 UI가 없음. `interested`(찜)·`gifted`(선물받음) 상태는 표시만 되고 설정 불가. 기본 단계가 "12-24개월"로 고정되는 문제(known-limitations B)와 함께 수정 — **아이 stage 기준 자동 선택**.
6. **알림 벨(🔔)이 빈 화면으로 연결** — P1-1 전까지는 벨을 숨기는 게 정직함.
7. **지출 수정 화면에서 날짜·카테고리 편집 불가** — 서버 PATCH는 지원함, UI만 미노출.
8. **장바구니·결제수단 스텁 제거** — "장바구니 담기"는 토스트만 나오는 유령 기능 → `interested`(찜하기)로 대체하면 P2 가격추적과도 연결됨. 결제수단 하드코딩 목록은 자유 텍스트/최근 사용으로.
9. **로그아웃 프리뷰 메뉴 라벨-라우팅 불일치** — "알림 설정"→/settings, "데이터 백업"→/import, "고객센터"→/settings/privacy로 가는 등 엉킴 정리.
10. **앱 정보 "버전 0.0.0 · com.anonymous.wooriai" 노출** — P0-3과 함께 해결.
11. **리포트 분기/연간 도넛이 전체 기간 비율을 표시** — 서버에 기간 파라미터 추가 후 정합화(코드 주석으로 인지된 상태).
12. **온보딩 진행 조회 무응답 시 빈 화면** (Sprint1 노트 기지 이슈) — 타임아웃 후 재시도/처음부터 CTA.
13. **픽셀락 transform 핵이 프로덕션 화면 코드에 잔존** — QA 전용 경로로 분리.

---

## 4. "진짜 팔릴 수 있는 앱" 설계

### 4.1 돈이 흐르는 구조 (현재 vs 목표)

수익 모델은 기획대로 CPS 제휴가 1단계입니다. 퍼널로 보면:

```
설치 → 온보딩 완료 → 첫 지출 기록 → 준비템 확인 → 링크 클릭 → 구매 → 재방문
        (측정불가)      (측정불가)      (측정불가)    (example.com) (루프 끊김)  (알림 없음)
```

**현재는 퍼널의 모든 단계가 측정 불가이고, 돈이 발생하는 두 지점(실링크·구매확인)이 비어 있습니다.** 그래서 §2의 P0~P1이 곧 수익화 작업입니다:

- 실 로그인(P0-1) 없이는 설치가 사용자로 전환되지 않고,
- 실 제휴 링크(P0-2) 없이는 클릭이 수수료가 되지 않고,
- 계측(P1-2) 없이는 어디서 새는지 모르고,
- 구매 확인 루프(P1-3) 없이는 전환이 기록·리텐션으로 돌아오지 않고,
- 푸시(P1-1) 없이는 재방문이 없습니다.

### 4.2 이 앱의 구조적 강점 (팔릴 이유)

1. **리텐션 트리거가 제품 외부에 있음** — 아이는 계속 자라고, 시기마다 새 준비템이 필요함. "시기 전환 알림"은 스팸이 아니라 정보. 일반 가계부에는 없는 자연 재방문 동력.
2. **신뢰 기반 커머스 계약이 이미 코드에 있음** — 추천 점수에 수수료율 미반영, 스폰서 분리, 고지 강제(DNC-009~011), opaque redirect. 육아 카테고리에서 신뢰는 곧 전환율. 허위 평점(§3-3)만 제거하면 "광고판이 아닌 조언자" 포지션 방어 가능.
3. **공동양육 = 내장 바이럴** — 가족 초대(역할별)가 이미 완성. 초대 URL 실도메인 교체 + "아빠 초대" 온보딩 넛지만 추가하면 K-factor 장치가 됨.
4. **오프라인·동시성 견고함** — 육아 중 지하철·수유 중 한 손 입력 상황에서 안 잃어버리는 기록. 경쟁 대비 체감 품질.

### 4.3 KPI 계기판 (기획 목표 → 측정 경로)

| 지표 (목표) | 측정 이벤트 | 상태 |
|---|---|---|
| 가입 당일 첫 기록률 40%+ | `onboarding_completed` → `expense_recorded` | 후자 미발화 (P1-2) |
| 준비템 체크율 50%+ | `item_status_changed` | 미발화 (P1-2) |
| 상세→구매링크 클릭률 20%+ | `affiliate_link_clicked` | 미발화 (P1-2) |
| North Star: 월간 활성 아이 프로필 | `app_opened` + childId 집계 | 미발화 (P1-2) |
| 클릭→구매확인율 (신규) | P1-3 프롬프트 응답 | 신규 설계 |

### 4.4 출시 시퀀스 제안 (Round 5B → 5C)

**Round 5B — "돈과 사용자 연결" (2 스프린트)**
- Sprint 1: P0-1 카카오 실연동 · P0-2 실 제휴 링크 · P0-3 릴리즈 정체성 · §3-1/2/3 (스켈레톤·아이콘·허위정보 제거)
- Sprint 2: P1-1 푸시 · P1-2 계측 완성 · P1-3 구매 확인 루프 · §3-4~9 UX 수정
- 게이트: 실기기에서 "설치 → 카카오 가입 → 기록 → 클릭 → 구매확인 → 푸시 재방문" 전 퍼널이 이벤트로 측정될 것

**Round 5C — "성장 장치" (출시 후)**
- 100일 리포트 공유 카드 · 아빠 초대 넛지 · 영수증 AI(프리미엄 씨앗) · 가격 추적
- 인프라 승격(INF-005/006) — MAU 성장에 맞춰

**선행 외부 결정 (코드로 못 푸는 것)**: D-01~04(클라우드·법인·패키지명/도메인·플랫폼 우선순위), 쿠팡 파트너스/네이버 커넥트 계정 승인, 카카오 앱 키, 스토어 등록 자산, 개인정보처리방침 법적 검토.

### 4.5 하지 말 것 (범위 방어)

- 커뮤니티·중고거래·금융 제휴 등 2차 이후 항목을 지금 당기지 않기 (기획 문서의 명시적 제외 유지).
- 프리미엄 구독을 CPS 검증 전에 출시하지 않기 — 결제 인프라·환불 CS 비용 대비 초기 매출이 안 나옴. 영수증 AI 사용량 데이터가 쌓인 뒤 가격 책정.
- iOS/Android 동시 출시 금지 — D-04 결정에 따라 한 플랫폼 집중.

---

## 부록 A. 이번 점검에서 갱신이 필요한 문서

- `docs/audit/feature-traceability-matrix.md` — ADM 항목이 라운드 4 이전 상태("PARTIAL, 토큰 인증")로 stale. 현행(세션+MFA)으로 갱신 필요.
- `apps/admin/app/page.tsx`의 "Admin auth placeholder — x-admin-token" 안내 문구 — 실제로는 세션/MFA가 붙어 있으므로 문구 제거.
- `packages/ui`·`packages/config` — 빈 껍데기 유지 여부 결정 (모바일 UI 킷을 이관하거나, 워크스페이스에서 제거).

## 부록 B. 근거 파일 인덱스

- 모바일: `apps/mobile/src/api/client.ts`, `src/offline/sync-engine.ts`, `src/theme.ts`, `src/ui.tsx`, `src/analytics/flag.ts`, `app/(tabs)/*`, `app/items/[itemTemplateId].tsx`
- API: `apps/api/src/auth/kakao/`, `src/items-commerce/redirect.controller.ts`, `src/admin/content-revisions.controller.ts`, `prisma/schema.prisma` (UserDevice·Attachment 미사용 확인)
- 문서: `docs/0_원본아이디어/아이_가계부_어플_설계.txt`(수익 4단·바이럴·지표), `docs/dev/do-not-change.md`(DNC-009~011), `docs/operations/known-limitations.md`, `docs/5차/round5a-sprint2-plan.md`
