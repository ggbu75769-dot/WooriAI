# 런타임 검증 필요 항목 (실기기/에뮬레이터 전용)

작성: 2026-07-12 (브랜치 codex/test-login-ui) · **갱신: 2026-08-28 — 라운드 61 트랙 E(GAP-061 #8)**
· 직전 갱신: 라운드 58 트랙 D(GAP-058 #9)

이 문서는 이번 소스 감사·개선 작업에서 **소스/테스트 수준으로는 검증했으나 실제 Android 기기(또는 에뮬레이터)에서만 최종 확인 가능한 항목**을 기록한다. 아래 항목은 PASS로 표시하지 않았다 — 소스 검증 완료와 런타임 검증은 구분한다.

> **2026-08-28 갱신 요지.** 이 문서의 §4·§5에 **지금은 사실이 아닌 문장 세 개**가 남아 있었다(서버가
> 인메모리다 / 카카오 로그인이 dev stub이다 / 로컬 persist에 마이그레이션 경로가 없다). 셋 다 그 뒤
> 라운드에서 구현이 끝났고, 문서만 옛 상태에 머물러 있었다 — 런타임 검증 문서가 거짓을 말하면
> "무엇을 아직 확인하지 못했는가"라는 이 문서의 유일한 쓸모가 사라진다(§5의 "임포트 파싱은 AI
> 스텁"과 §1-9의 "스텁 3행 프리뷰"도 같은 이유로 함께 정정했다). 정정하면서 §1 체크표에
> 라운드 49~57에 들어온 기능들(§1-1의 13~21번)도 함께 넣었다. 표에 없던 동안 그 기능들은
> **실기기에서 한 번도 확인되지 않은 채로** 출시 대기열에 있었다.

## 1. 독립 실행형 테스트 APK (최우선)

`artifacts/android/wooriai-0.0.0-release.apk` (EXPO_PUBLIC_TEST_LOGIN=1, 릴리즈 빌드) 설치 후:

| # | 확인 항목 | 기대 동작 |
|---|---|---|
| 1 | 앱 최초 실행 | 스플래시 애니메이션 → 로그인 화면(AUTH-001) |
| 2 | 테스트 로그인 | 약관/개인정보 동의 2개 체크 후 "테스트 계정으로 시작하기" → 홈 진입 |
| 3 | 재실행 | 테스트 세션이 유지되어 바로 홈 진입 (로그인 반복 없음) |
| 4 | 지출 기록 핵심 루프 | 빠른 지출 기록 저장 → 홈 총액·이번 달 사용액 즉시 반영 → 리포트 월간/누적 동일 금액 |
| 5 | 지출 수정/삭제 | 기록 목록 → 상세 → 수정 반영, 삭제(확인 다이얼로그) 후 합계에서 제외 |
| 6 | 예산 | 예산 수정 저장 → 홈 잔여 예산 반영. 예산 미설정 상태에서도 입력 가능 |
| 7 | 준비템 | 상태 변경(이미 준비/필요 없음 등) 시 탭 간 이동 즉시 반영, 상세의 제휴 고지·외부 링크 |
| 8 | 외부 구매 링크 | 클릭 시 외부 브라우저 이동 (로컬 클릭 로그 기록) |
| 9 | 엑셀 가져오기 | 실제 csv/xlsx 파일 업로드 → 파일 내용에서 뽑은 행 프리뷰(헤더 추론·카테고리 키워드 추론, 낮은 신뢰도/중복 후보 행 기본 미선택·경고 배지) → 승인 후에만 지출 생성, 요약(가져온 수/제외 수). 길이·금액 상한을 넘는 행은 **그 행만** 떨어지고 파일 전체가 거절되지 않는지 |
| 10 | 가족 | 멤버 목록(owner 본인 + 픽스처 공동부모), owner의 멤버 삭제 2단계 확인, 초대 링크 생성("테스트 모드 — 실제 전송되지 않음" 안내) |
| 11 | 설정/개인정보 | 아이 프로필 삭제·가구 탈퇴·계정 삭제 각 2단계 확인 흐름, 로그아웃 후 로그인 화면 복귀 |
| 12 | 앱 재시작 후 데이터 유지 | 기록한 지출/예산/준비템 상태가 재실행 후에도 유지 (zustand persist) |

### 1-1. 라운드 49~60 신설 기능 (2026-08-28 추가 — 실기기 확인 미실시)

아래 17개 항목(13~21은 라운드 49~57, 22~29는 라운드 58~60)은 소스·vitest로는 그린이지만 **실기기 확인
기록이 없다.** 각 항목의 근거 파일을 함께 적는다
(문구·판정은 대부분 순수 모듈에 고정돼 있어, 기기에서 볼 것은 "그 판정이 실제 화면·실제 저장소·실제
백그라운드 전환에서도 같은가"다).

| # | 확인 항목 | 기대 동작 | 근거 파일 |
|---|---|---|---|
| 13 | 앱 잠금(PIN) 설정·해제 | 설정 > 앱 잠금에서 4자리 PIN 등록 → 앱을 백그라운드로 보냈다 오면 잠금 화면, 정확한 PIN에만 해제. 오입력 반복 시 대기 안내(30/60/300초)가 실제로 카운트다운되는지 | `app/settings/app-lock.tsx`, `src/security/app-lock.ts`, `src/security/AppLockOverlay.tsx` |
| 14 | 앱 잠금 저장소(기기 재부팅·재설치) | PIN이 SecureStore에 남아 재부팅 후에도 잠금 유지. 삭제/재설치 후에는 잠금 없음. **읽기 실패 시 잠금이 열리는 일이 없어야 함**(설계상 `recovery`로 닫힘) | `src/security/app-lock-storage.ts` |
| 15 | 정기 지출 템플릿 | 템플릿 등록 → 홈 카드 "이번 달 정기 지출 N건이 아직 기록에 없어요" 노출 → 카드에서 기록하면 사라짐. 이번 달 건너뛰기 동작 | `src/expenses/recurring-template.ts`, `app/expenses/recurring.tsx` |
| 16 | 가져오기 이어보기 | 검수 중 앱을 벗어났다 돌아오면 "검토하던 가져오기로 돌아가기" 진입점이 뜨고 같은 잡으로 복귀. 확정/폐기 후에는 사라짐 | `src/import/import-resume.ts`, `app/import/` |
| 17 | 판매처 자동완성 | 판매처 입력 시 이번 달 기록에서 뽑은 후보 칩/타이핑 연동 노출, 선택 시 입력칸 반영. 후보가 없으면 아무것도 뜨지 않음 | `src/expenses/merchant-suggest.ts`, `app/expenses/new.tsx` |
| 18 | 동기화 실패 사유 안내 | 비행기 모드에서 기록 → 연결 복구 후 반영. 권한 없는 계정(보기 전용)으로 만든 실패 행은 "재시도"가 아니라 **사유 안내**로 보임(403은 재시도 불가) | `src/offline/permission-denied.ts`, `app/sync-status.tsx` |
| 19 | 지출 상세 결제 수단 편집 | 상세에서 결제 수단을 바꿔 저장 → 목록/상세에 반영, 오프라인이면 대기 후 반영. 환불/선물 기록의 보존 규칙이 유지되는지 | `src/expenses/expense-detail-rows.ts`, `app/expenses/[expenseId].tsx` |
| 20 | 달력 날짜 선택기 | 기록 시트에서 달력을 열어 2주보다 오래된 날짜 선택 가능, 미래 날짜는 선택 불가, 월 이동 한계(과거 상한)에서 화살표 비활성 | `src/expenses/date-picker-month.ts`, `src/expenses/ExpenseDatePicker.tsx` |
| 21 | 기록 공백 알림(record_gap) | 마지막 기록에서 3일 이상 비면 알림함에 엔트리 1건(주 1회 dedupe), 눌러 기록 화면으로 이동. 설정에서 끄면 뜨지 않고, 기록 0건인 신규 사용자에게는 발화하지 않음. 문구가 책망조가 아닌지(DNC-018) | `src/notifications/generators.ts`(`recordGapNotification`), `src/notifications/notification.store.ts` |

**라운드 58~60분 (2026-08-28 추가 — GAP-061 #8).** 라운드 58~60은 세 라운드 연속으로 이 표를
갱신하지 않았다. 라운드 58 #9가 같은 공백을 메우면서 "표에 없던 동안 그 기능들은 실기기에서 한
번도 확인되지 않은 채로 출시 대기열에 있었다"고 적어 두었는데, **그 공백이 곧바로 재발했다**
(GAP-061 #8이 그것을 "재발"이라고 부른 이유다). 아래 8개는 그 사이에 들어온 기능이다 — 판정·문구는
대부분 순수 모듈에 고정돼 있고 vitest도 그린이라, 기기에서 볼 것은 다시 한 번 **"그 판정이 실제
화면·실제 저장소·실제 백그라운드 전환에서도 같은가"** 다.

| # | 확인 항목 | 기대 동작 | 근거 파일 |
|---|---|---|---|
| 22 | 정기 지출 역방향 등록 (라운드 58 #1) | 지출 상세에서 "정기 지출로 등록" → 결제일이 그 지출의 일자로 채워진 채 템플릿 폼이 열리고, 저장하면 목록에 뜬다. 이미 등록한 지출에서는 그 사실이 표기되고(중복 템플릿이 생기지 않는지), 선물·환불 기록에는 버튼이 없다 | `app/expenses/[expenseId].tsx`(`RECURRING_REGISTER_ACTION_LABEL`), `src/expenses/recurring-template.ts`, `src/stores/recurring-expense.store.ts`, `app/expenses/recurring.tsx`(프리필 수신) |
| 23 | "지금 잠그기" + 설정 화면 대기 (라운드 58 #2·#3) | 설정 > 앱 잠금의 "지금 잠그기"를 누르면 **화면 전환 없이 곧바로** 잠금 오버레이가 선다(폰을 건네주기 직전 동선). PIN 변경·해제도 오버레이와 같은 대기(30/60/300초)를 지나는지 — 설정 화면이 무제한 시도 입구가 되지 않아야 함 | `src/security/app-lock.ts`(`APP_LOCK_LOCK_NOW_*`), `src/stores/app-lock.store.ts`(`lockNow`), `app/settings/app-lock.tsx` |
| 24 | 일괄 재시도 라벨 (라운드 58 #4) | 동기화 상태 화면의 일괄 재시도가 **실제로 다시 보낼 수 있는 건수**만 말하는지. 실패가 전부 403/4xx 영구 실패면 버튼 자체가 뜨지 않아야 한다(권한 없는 계정으로 만든 행으로 재현) | `src/offline/permission-denied.ts`(`countRetryableFailedRows`), `app/sync-status.tsx` |
| 25 | 고쳐서 다시 보내기 (라운드 58 #5 / 59 #2) | 영구 실패 행의 "고쳐서 다시 보내기" → 원문(금액·품목·날짜)이 채워진 기록 시트, 고쳐 저장하면 **동기화 상태 화면으로 되돌아오고** 그 자리에서 원본 실패 행이 사라진다. 저장을 취소하면 원본이 그대로 남는지 | `src/expenses/failed-row-prefill.ts`, `src/expenses/post-save-destination.ts`(`sync-fix`), `app/sync-status.tsx`, `app/expenses/new.tsx` |
| 26 | 잠금 오버레이 접근성 방패 (라운드 59 #3) | 잠금 중 TalkBack으로 화면을 훑을 때 **뒤쪽 금액·품목이 읽히지 않는지**. 잠금을 켜지 않은 계정에서는 낭독이 종전과 완전히 같은지(방패가 평소에도 무언가를 지우고 있지 않은지) | `app/_layout.tsx`, `src/security/AppLockOverlay.tsx`(`AppLockScreenShield`), 코드 계약 `src/a11y-contract.test.ts` — **§2-1 C-3와 같은 항목이다(실측 미실시)** |
| 27 | 가구 스코프 · "다른 가구 보기" (라운드 60 #1) | 다가구 계정에서 아이 추가·가족 관리·초대 생성·가구 탈퇴가 **선택한 아이의 가구**를 대상으로 하는지, 화면에 어느 가구인지가 표기되는지. "다른 가구 보기"로 전환했을 때 목록·초대 폼이 그 가구로 바뀌는지. **1가구 계정에서는 아무것도 달라지지 않아야 한다** | `src/family/household-scope.ts`, `app/family/index.tsx`, `app/family/invite.tsx`, `app/settings/children.tsx`, `app/settings/privacy.tsx` |
| 28 | 구매 확인 해소 (라운드 60 #2) | "샀나요?" 프롬프트에서 기록을 남기면 그 대기가 **사라지고 다시 묻지 않는지**, 알림함의 purchase_pending 엔트리도 함께 정리되는지. 잠금 중에는 품목명이 낭독되지 않는지(라운드 60 #6) | `src/commerce/purchase-followup-resolution.ts`, `src/commerce/PurchaseFollowupPrompt.tsx`, `src/commerce/purchase-followup.store.ts` |
| 29 | 초대 수락 재시도·탈출구 (라운드 60 #3) | 뷰어(보기 전용)로 초대를 수락했을 때 온보딩이 무한 재시도로 빠지지 않고 사실 안내 + "나중에 하기"가 나오는지. 아이 목록 조회가 실패한 상황을 "아이 없음"으로 단정해 **중복 아이를 만들지 않는지**(비행기 모드로 재현) | `src/children/household-join.ts`(`planAfterHouseholdJoin`·`HOUSEHOLD_JOIN_*`), `app/family/accept/[token].tsx`, `app/(onboarding)/` |

## 2. 시각/UX (기기 의존)

- 실제 화면 여백·Safe Area (노치/펀치홀 기기)
- 키보드가 입력 필드를 가리는지 (지출 기록·예산·온보딩 입력)
- 스크롤 감각, 목록 성능 (기록 다수 입력 후)
- 기기별 글자 잘림 (작은 화면·큰 글꼴 설정)
- 다크 모드 강제 기기에서의 색상 (앱은 light 고정 선언)
- 터치 영역 실측 (44dp 기준)

### 2-1. 접근성 (2026-08-28 추가 — 라운드 59 트랙 D / GAP-059 #10)

기기에서만 확인 가능한 접근성 항목은 `docs/qa/accessibility-offline-checklist.md` **C절**에
표로 정리했다(터치 영역 실측·대비 실측·낭독 순서·포커스 이동·글꼴 확대 등 11개). 같은 문서의
A절은 소스 스윕이 이미 붙들고 있는 계약이라 사람이 다시 볼 필요가 없다 — **C절만 기기 대상**이다.
(라운드 61 트랙 E / GAP-061 #8: A절에 두 줄만 "스윕 밖"으로 남아 사람 확인을 요구하고 있었는데 —
정기 지출 입력 4종·달력 픽커 셀 — 그 라벨·역할·상태를 `a11y-contract.test.ts`가 계약으로 가져갔다.
C-5·C-6에는 코드로 증명할 수 없는 **낭독 순서**와 **제스처 충돌**만 남는다.)

특히 **C-3(잠금 오버레이 TalkBack 투과)** 은 **코드 구조상 확정된 결함이고 실기기 미검증**이다
(라운드 59 통합리뷰 P2-4에서 "실측된 결함"이라는 표기를 정정했다 — TalkBack/VoiceOver로 직접
확인한 기록은 없다): 잠금 화면과 뒤쪽 Stack이 형제라 접근성 트리가 z-order로 잘리지 않아 **잠금
중에도 금액·품목이 낭독될 수 있다**. 라운드 59 트랙 C가 `importantForAccessibility`로 잘라 냈고
그 계약은 `a11y-contract.test.ts`(GAP-059 #3)가 붙들지만, 실제로 잘렸는지는 기기 낭독으로만 안다 —
같은 표기가 `AppLockOverlay.tsx`의 `AppLockScreenShield` 주석에도 그대로 있다.

## 3. Android Pixel Lock 재검증

- EXP-001 날짜 표시를 preview 모드에서 고정 날짜로 되돌렸으므로 `pnpm pixel:android` 재실행으로 9개 화면 점수 재확인 필요 (ITEM-002는 0.0491/0.0500으로 여유가 1.9%뿐 — 회귀 주의)
- **ITEM-002 재캡처 필요 (라운드 47 UX-AB)** — 시드의 제휴 고지 문구를 해요체로 고쳤다(`apps/api/prisma/seed-data.ts`). 준비템 상세에 렌더되는 **고지 문구 한 줄**이 델타의 전부이고 레이아웃·색·자간은 손대지 않았지만, ITEM-002는 임계까지 여유가 1.9%뿐이라 문구 길이 변화만으로도 줄바꿈이 달라질 수 있다. 재캡처해서 0.0500 아래를 유지하는지 확인할 것. (스코프 근거: 이번 변경은 문자열 리터럴 치환뿐 — 스타일·컴포넌트 트리 변경 없음.)
- 픽셀 캡처는 adb screencap 기반 — 이번 세션에서는 ADB/에뮬레이터 실행이 금지되어 수행하지 않음

## 4. 실서버 연동 빌드 (외부 의존)

다음은 테스트 APK 범위 밖이며 외부 서비스 키/인프라가 필요하다:

- 실제 Kakao OAuth — **구현은 끝났다(2026-08-28 정정).** 서버는 prepare/exchange 2단계 OIDC를
  갖고 있고 ID 토큰을 JWKS 서명·iss/aud/exp·nonce 왕복까지 검증한다
  (`apps/api/src/auth/kakao/kakao-auth.service.ts`, e2e `test/auth-kakao-oidc.e2e.test.ts`).
  남은 것은 **키/리다이렉트 URI env뿐**이다: `OAUTH_KAKAO_CLIENT_ID` ·
  `OAUTH_KAKAO_CLIENT_SECRET` · `OAUTH_KAKAO_REDIRECT_URIS`(서버) + `EXPO_PUBLIC_KAKAO_ENABLED=1` ·
  `EXPO_PUBLIC_KAKAO_CLIENT_ID` · `EXPO_PUBLIC_KAKAO_REDIRECT_URI`(앱). 실기기 검증 대상은
  "카카오 콘솔에 등록된 실제 앱 키로 로그인 왕복이 되는가"이지 "구현이 있는가"가 아니다.
  (별개로 남아 있는 dev 경로 `POST /auth/oauth-login`은 테스트 로그인용이며, 위 OIDC 경로와
  다른 엔드포인트다.)
- 실 API 서버 연결 빌드 (EXPO_PUBLIC_API_BASE_URL을 https 서버로 설정 — 릴리즈 빌드는 cleartext HTTP 차단됨)
- ~~API 서버의 DB 영속화 (현재 인메모리)~~ — **거짓 문장이었다(2026-08-28 정정).** API 서버는
  Prisma + PostgreSQL로 영속화한다(`apps/api/prisma/schema.prisma`, 마이그레이션 20종,
  `test/persistence.db.test.ts`). 재시작해도 데이터는 남는다. 실기기 검증 대상은 영속화 여부가
  아니라 **운영 DB 연결·백업/복구 리허설**(docs/operations/database-backup-restore.md)이다.
- 프로덕션 JWT/관리자 시크릿 env 설정 (미설정 시 이제 프로덕션에서 fail-fast)
- 릴리즈 서명 키스토어 (현재 debug keystore 서명 — 스토어 배포 불가)
- 실제 제휴 링크/커머스 연동 (현재 example.com dev 링크)
- 카카오 공유, 알림 권한 플로우 (미구현 범위 — v0.4 스코프 외)
- 크래시·ANR·성능 계측 (모니터링 인프라 필요)

## 5. 알려진 잔여 리스크

- ~~로컬 백엔드 persist 스키마 변경 시 마이그레이션 경로 없음 (version: 1만 명시)~~ —
  **거짓 문장이었다(2026-08-28 정정).** 지금은 두 저장소 모두 버전 경로가 있다:
  (1) 로컬 백엔드 zustand persist는 `version: 3` + `migrate`(2 이하는 데모 데이터 제거를 위한
  일회성 초기화, 3 이상은 필드 단위 보존 — `apps/mobile/src/api/local-backend.ts`),
  (2) 오프라인 SQLite는 `PRAGMA user_version`을 진실로 삼는 **마이그레이션 러너**가 있다
  (버전당 한 트랜잭션, 실패 시 통째 롤백, 다운그레이드 감지 — `src/offline/sqlite-offline-store.ts`,
  `src/offline/sqlite-migrations.test.ts`).
  남은 실기기 확인 항목은 "경로가 있는가"가 아니라 **구버전 APK로 만든 실제 기기 데이터가 새
  빌드에서 마이그레이션되는가**다.
  - 그 옆에 있던 "마이그레이션이 실패했을 때 사용자에게 무엇이 보이는가"(round58-scout P3
    "마이그레이션 실패 시 사용자 가시성" — 의도된 브릭이지만 표시 미확인)는 **열린 질문이 아니라
    확인 항목으로 좁혀졌다(2026-08-28 갱신).** 코드가 답을 갖고 있기 때문이다: 저장소를 열지
    못하면 스냅샷이 `storage: "unavailable"`을 싣고(`apps/mobile/src/offline/sync-controller.ts`),
    두 화면이 그 사실을 말한다.
  - 그래서 기기에서 볼 것은 다음 두 줄이 **실제로 뜨는가**다(문구 단일 소스는
    `apps/mobile/src/offline/messages.ts`):
    1. 동기화 상태 화면(`app/sync-status.tsx`)의 빈 상태에 `OFFLINE_STORAGE_UNAVAILABLE_NOTICE`
       한 줄 — "모든 기록이 동기화됐어요."가 아니어야 한다. **재오픈 게이트가 그 세션에 딱 한 번
       재시도하는 동작**(`src/offline/store-open-gate.ts`)까지 포함해 본다: 첫 실패 뒤 화면을
       다시 열어도 재시도는 더 늘지 않고, 다음 기회는 앱 재시작이다.
    2. 홈 최하단 동기화 줄(`app/(tabs)/index.tsx`의 `SyncStatusBar`)이 같은 상황에서 `"unknown"`
       톤(경고)으로 `OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE`를 보여야 한다 — 라운드 61 M-1
       전에는 빈 스냅샷의 0건을 완료로 읽어 "모든 기록이 동기화됐어요."라고 단언했다
       (`src/home/home-sync-status.ts`).
    재현 방법은 기기 저장소를 못 열게 만드는 것이다(저장 공간 고갈, 또는 DB 파일 손상/권한 제거).
- `startTestSession()`과 persist rehydration의 이론적 경쟁 (실사용 타이밍상 희박)
- ~~임포트 실제 파싱(xlsx/csv 내용 분석)은 AI 분석 스텁~~ — **더 이상 스텁이 아니다(2026-08-28
  정정).** 서버가 실제 파일을 파싱한다: csv(인코딩 판별 포함)·xlsx 헤더 추론, 날짜/금액/적요 열
  매핑, 카테고리 키워드 추론과 신뢰도 산출(`apps/api/src/imports/import-parser.ts`,
  `test/import-parser-inference.test.ts`, `test/import-parsing.db.test.ts`). 남은 경계는 "AI"가
  아니라 **추론 규칙의 한계**(우리가 아는 헤더 키워드 밖의 은행 양식은 열을 못 찾을 수 있다)이며,
  그때 사용자가 보는 화면이 정직한지가 실기기 확인 대상이다.
