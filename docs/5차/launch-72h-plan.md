# 우리아이 72시간 출시 준비 실행 계획 (D-3 → D-0)

작성일: 2026-08-14 · 기준 브랜치: `claude/app-feature-review-design-xx71k3` (PR #3, 릴리즈 게이트 11/11 PASS)

## 0. 목표와 현실적인 정의

**72시간 안에 달성할 것 = "스토어 심사 제출 완료 + 운영 서버 가동"** 입니다.
스토어 *공개*는 우리가 통제할 수 없는 두 가지에 걸립니다 — 반드시 미리 인지하세요:

1. **Google 심사 기간**: 보통 1~7일.
2. **신규 개인 개발자 계정 제한**: 2023-11 이후 만든 *개인* Play Console 계정은 프로덕션 공개 전
   **테스터 20명 × 14일 비공개 테스트**가 강제됩니다. **법인/조직 계정은 면제.**
   → 개인 계정으로 갈 거라면 3일 안에 "비공개 테스트 시작"이 최대치이고,
   조직 계정(사업자 필요)이면 3일 안에 프로덕션 심사 제출까지 가능합니다. **D-02(운영 주체) 결정이 곧 출시 속도입니다.**

Android 단독 출시입니다(iOS는 다음 사이클 — D-04 결정 반영).

## 1. 지금 즉시 (0~2시간) — 계정·승인 신청은 대기시간이 길어서 가장 먼저

전부 사용자 본인만 할 수 있는 것들입니다. 오늘 안에 전부 "신청"까지 끝내세요.

- [ ] **Google Play Console 등록** ($25, 결제 즉시). 가능하면 **조직(사업자) 계정** — 위 14일 규칙 회피.
- [ ] **카카오 개발자 앱 생성** (developers.kakao.com) → 네이티브/REST 키 확보. 심사 없이 즉시 발급.
- [ ] **쿠팡 파트너스 가입 신청** — 승인까지 수일 걸릴 수 있음. *출시 차단 요소 아님*(§5 참고).
- [ ] **도메인 구입** (예: wooriai.app / woori-ai.kr) — 초대 링크·API·개인정보처리방침 호스팅에 필요.
- [ ] **패키지명 확정** (예: `kr.wooriai.app`) — 한 번 제출하면 영구 불변. 도메인과 정합되게.
- [ ] **PR #3 머지** — 모든 준비 코드가 이 브랜치에 있습니다. master 기준으로 빌드하려면 머지가 선행.
- [ ] (선택) GitHub Actions 러너/빌링 수리 — 출시 자체엔 불필요, 로컬 release:gate로 대체 가능.

## 2. Day 1 — 서버를 실제로 띄운다

### 2.1 인프라 (반나절)
가장 빠른 경로 기준(단일 리전, 관리형 Postgres):

- 추천: **Fly.io / Railway / Render** 중 하나 (Docker 배포 + 관리형 PG, 신용카드만 있으면 1시간 내).
  국내 규제·지연시간 민감해지면 나중에 네이버클라우드/AWS 서울로 이전.
- [ ] PostgreSQL 15+ 인스턴스 생성 → `DATABASE_URL`
- [ ] API 배포 (NestJS, `PORT=3000`). 헬스체크 경로: `GET /api/v1/health/ready`
- [ ] 도메인 연결 + HTTPS (플랫폼 자동 인증서)
- [ ] `pnpm --filter api prisma:deploy && pnpm --filter api seed` (마이그레이션 10개, 시드: 카테고리 12·준비템 86·링크 58)

### 2.2 프로덕션 환경변수 (부트 시 `assertRequiredSecretsConfigured`가 누락을 즉시 잡음)
```
NODE_ENV=production
DATABASE_URL=<관리형 PG>
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET  ← openssl rand -base64 48 로 각각 생성
AFFILIATE_CLICK_IP_SALT / ANALYTICS_ANON_SALT ← 동일 방식 생성
AFFILIATE_ALLOWED_DOMAINS=coupang.com,link.coupang.com,naver.com,smartstore.naver.com
AFFILIATE_DISCLOSURE_TEXT=이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
OAUTH_KAKAO_CLIENT_ID / OAUTH_KAKAO_CLIENT_SECRET ← 카카오 콘솔
OAUTH_KAKAO_REDIRECT_URIS=wooriai://oauth/kakao
WORKER_ENABLED=1          ← 단일 인스턴스 1개에만 (CMS 예약 게시·만료 정리)
LINK_HEALTH_ENABLED=1     ← 링크 헬스체크 (실링크 투입 후)
```

### 2.3 운영 계정·데이터
- [ ] 관리자 1호 계정: seed로 생성 → **즉시 `POST /admin/auth/change-password`로 비밀번호 교체 + MFA 등록**(강제 흐름 있음)
- [ ] 필요 시 admin UI(/users)에서 팀원 계정 발급 — 임시 비밀번호 1회 노출 방식
- [ ] 초대 링크 도메인: `household-runtime.service.ts`의 `https://wooriai.local/invite/…` 하드코딩을 실제 도메인으로 교체하는 1줄 수정 필요 → **유일하게 남은 코드 수정**. (딥링크 `wooriai://` 스킴 처리와 함께 검증)

## 3. Day 2 — 앱을 실제로 빌드한다

### 3.1 앱 정체성
- [ ] `apps/mobile/app.config.js`: `android.package=<확정 패키지명>`, `version=1.0.0`, `versionCode=1`
- [ ] 앱 아이콘은 Round 5A에서 준비됨(`apps/mobile/assets`) — 스토어용 512px·피처 그래픽만 추가 제작
- [ ] **release keystore 생성** 및 2곳 백업 (분실 = 앱 영구 업데이트 불가):
  `keytool -genkeypair -v -keystore wooriai-release.keystore -alias wooriai -keyalg RSA -keysize 4096 -validity 10000`

### 3.2 프로덕션 빌드
- [ ] `.env`: `EXPO_PUBLIC_API_BASE_URL=https://<도메인>/api/v1`, `EXPO_PUBLIC_KAKAO_ENABLED=1`,
  `EXPO_PUBLIC_KAKAO_CLIENT_ID`, `EXPO_PUBLIC_KAKAO_REDIRECT_URI=wooriai://oauth/kakao`, `EXPO_PUBLIC_TEST_LOGIN=0`
- [ ] 카카오 콘솔에 redirect URI 등록(서버 allowlist와 동일 값)
- [ ] `expo prebuild --platform android` — Round 5A 빌드 노트의 gradle·네트워크 보안 설정 2종은 REL-009 config plugin(`apps/mobile/plugins/with-wooriai-android-release.js`)이 **자동 적용**(손패치 불필요). 패키지명·버전은 env로 주입: `WOORIAI_ANDROID_PACKAGE=<확정 패키지명> WOORIAI_APP_VERSION=1.0.0 WOORIAI_ANDROID_VERSION_CODE=1`
- [ ] 스토어 제출용은 APK가 아닌 **AAB**: `cd android && ./gradlew bundleRelease` (release keystore 서명 설정 추가)
- [ ] 기존 `pnpm android:build-apk --profile production`은 실기기 스모크용 APK로 병행 사용

### 3.3 실기기 QA (기존 QA 런북 + 이번 신기능)
핵심 루프 1회 완주가 기준: **카카오 가입 → 온보딩 → 지출 기록 → 준비템 → 링크 클릭 → 복귀 구매확인 → 리포트/알림 확인**
- [ ] 오프라인 기록 → 재연결 동기화, 로그아웃→재로그인(데이터 정리 확인)
- [ ] 분석 동의 ON 후 서버 `analytics_events` 수신 확인 (KPI 퍼널 가동 증거)
- [ ] `PGBIN=… pnpm release:gate` 최종 1회 (현재 11/11 PASS 상태 유지 확인)

## 4. Day 3 — 제출한다

- [ ] **개인정보처리방침 + 이용약관**을 도메인에 정적 호스팅 (docs 1차 비즈니스 룰 기반으로 작성; 수집 항목: 카카오 식별자·이메일, 아이 정보(생일/예정일), 지출 기록, 선택적 익명 통계. 처리 위탁: 호스팅 사업자. 파기: 탈퇴 시 즉시 — 이미 구현된 삭제 플로우와 일치하게)
- [ ] Play Console: 앱 생성 → 데이터 안전 설문(위 항목 그대로), 콘텐츠 등급(만 3세+ 아님 — 보호자 대상 금융/가계부), 광고 없음, 대상 연령 성인
- [ ] 스토어 자산: 스크린샷 4~8장(홈/기록/준비템/리포트/100일 리포트 — pixel-lock 캡처 재활용 가능), 512 아이콘, 1024×500 그래픽, 앱 설명(§6 문구 초안)
- [ ] **내부 테스트 트랙에 AAB 업로드 → 자가 설치 검증 → 심사 제출**
  - 조직 계정: 프로덕션 심사 제출까지
  - 개인 계정: 비공개 테스트 시작 + 테스터 20명 모집 개시(가족·맘카페·지인)
- [ ] 크래시 모니터링: 최소 Play Console 자동 수집으로 시작(Sentry는 출시 후 1주 내 추가 권장)

## 5. 제휴 링크 전략 (쿠팡 승인 대기와 무관하게 출시)

시드 58개 링크가 example.com이므로 그대로는 출시 불가. 승인 타이밍별 플랜:

- **승인 완료 시**: admin의 CSV 일괄 교체 도구로 쿠팡 파트너스 딥링크 투입 (미리보기→적용, 도메인 allowlist 검증 자동)
- **승인 전 출시 시**: 같은 CSV 도구로 **일반(비제휴) 쿠팡/네이버 검색 링크** 투입 + admin에서 해당 링크 `isAffiliate=false` 유지 → 제휴 고지 미표시(DNC 규칙과 정합). 승인 후 CSV 재업로드로 무중단 전환.
- 투입 직후 `LINK_HEALTH_ENABLED=1` 워커가 깨진 링크를 24시간 주기로 잡아줌.

## 6. 스토어 설명문 초안 (100자/4000자)

- 짧은 설명: "임신부터 첫돌까지, 우리 아이에게 들어간 돈과 앞으로 필요한 준비물을 가장 쉽게."
- 핵심 소구 4개: ① 10초 지출 기록(오프라인에서도) ② 시기별 준비물 체크리스트 ③ 월 예산·리포트·100일 비용 리포트 ④ 가족 공동 기록(아빠 초대)

## 7. 요약: 사용자 결정 4개가 전부다

| 결정 | 마감 | 영향 |
|---|---|---|
| D-02 운영 주체(개인 vs 사업자) | 오늘 | 개인이면 14일 테스트 강제 → 공개일 +2주 |
| D-03 패키지명·도메인 | 오늘 | 빌드·카카오·약관 전부의 선행 조건 |
| D-01 호스팅 선택 | Day 1 오전 | 이후 언제든 이전 가능, 지금은 속도 우선 |
| 쿠팡 승인 대기 여부 | Day 2 | §5 플랜 B로 출시 비차단 |

코드는 준비됐습니다(테스트 전량 green, 릴리즈 게이트 PASS). 남은 것은 계정·키·서명·심사 — 즉 위 체크박스들입니다.
