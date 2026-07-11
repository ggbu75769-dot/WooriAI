# 수정 이슈 목록

작성: 2026-07-12 · 브랜치: codex/test-login-ui · 상세 배경: [source-audit-and-fix.md](source-audit-and-fix.md)

| ID | 우선순위 | 영역 | 문제 | 원인 | 수정 파일 | 수정 내용 | 검증 |
|---|---|---|---|---|---|---|---|
| FIX-01 | P1 | 가족/권한 | owner의 멤버 강제 삭제 기능 부재 (AC-FAM-001 위반) | 엔드포인트 미구현 (leave/withdraw만 존재) | apps/api/src/households/{household-runtime.service.ts, households.controller.ts, households.module.ts} | DELETE /households/:id/members/:memberId — owner만, 본인 400, 미존재 404, audit log, 삭제 후 접근 차단 | family-invite e2e: owner 성공/비owner 403/삭제 후 403 |
| FIX-02 | P1 | 리포트 | 연별 합계 기능 부재 | yearly 엔드포인트 미구현 | apps/api/src/finance/{reports.controller.ts, dto/query.dto.ts}, onboarding-store.service.ts, packages/contracts/src/schemas.ts | GET reports/yearly — 12개월 전부, 동일 집계 헬퍼 재사용, zod 스키마 | e2e: 연간=월합, 삭제/선물 제외 |
| FIX-03 | P1 | 보안 | 프로덕션에서 예측 가능한 폴백 시크릿으로 서명 가능 | `?? "dev-secret"` 무조건 폴백 | apps/api/src/common/config/require-secret.ts(신규), auth/token.service.ts, admin/admin-token.guard.ts | production+env 미설정 → 기동 실패, dev/test는 폴백 유지 | 유닛 3파일 (require-secret/token.service/admin-token.guard) |
| FIX-04 | P1 | 보안 | 상품 링크 URL scheme 미검증 (javascript: 등 통과 가능) | @IsUrl만으로는 scheme 미제한 | apps/api/src/common/validation/{url-scheme.ts, is-http-url.decorator.ts}(신규), admin/dto/admin.dto.ts, onboarding-store.service.ts | http/https 화이트리스트 + 리다이렉트 직전 재검증 | admin-settings e2e: javascript:/data: → 400 |
| FIX-05 | P1 | 데이터 정합성 | 실세션 API 실패 시 preview 가짜 데이터 표시 (오류 은폐) | `data ?? preview` fallback | apps/mobile/app/(tabs)/{index,reports,items}.tsx, family/index.tsx, items/[itemTemplateId].tsx | hasSession 게이트: 실세션은 로딩/에러(+재시도)/실데이터만, preview는 세션 없음 전용 (픽셀락 렌더 불변) | real-session-data-integrity.test 4건 |
| FIX-06 | P1 | 리포트 | 기준월 2025-05 하드코딩 → 실사용 시 잘못된 월 | preview 픽스처가 실경로에 유출 | apps/mobile/app/(tabs)/reports.tsx | 실세션은 현재 월(Seoul), preview는 기존 픽스처 유지 | 소스 계약 테스트 + typecheck |
| FIX-07 | P1 | 리포트 | 분기/연간 세그먼트 무동작 (활성 버튼 미구현) | period state 미사용 | apps/mobile/app/(tabs)/reports.tsx, src/api/client.ts | 월간=monthly, 분기=3개월 합산(useQueries), 연간=yearly API, 단위별 이전/다음 네비 | 소스 계약 테스트 |
| FIX-08 | P1 | 리포트 | 카테고리 도넛/전월 대비 +12.5%/절약 팁이 항상 가짜 수치 | 장식용 컴포넌트에 하드코딩 | apps/mobile/src/ui.tsx, app/(tabs)/reports.tsx | DonutChartCard segments·LineChartCard deltaLabel 선택 prop(미전달 시 기존 렌더), 실세션은 실데이터 계산·없으면 숨김 | 픽셀락 계약 테스트 유지 + 신규 계약 |
| FIX-09 | P1 | 홈 | "전체 보기" 라벨 무동작 | Pressable 미적용 | apps/mobile/app/(tabs)/index.tsx | /(tabs)/records 연결 (시각 불변) | 소스 계약 테스트 |
| FIX-10 | P1 | 테스트 APK | 서버 부재로 조작 기능 전부 HTTP 실패 | 테스트 세션에 데이터 계층 없음 | apps/mobile/src/api/{local-backend.ts, local-fixtures.ts}(신규), client.ts, stores/session.store.ts + 화면 15개 | 온디바이스 영속 로컬 백엔드(36개 함수), 도메인 규칙 동일 적용, 시드, LOCAL_SESSION_TOKEN 분기(가짜 OAuth 토큰 없음 유지) | local-backend.test 9건 + 전체 스위트 |
| FIX-11 | P1 | Navigation | `__DEV__` 개발 빌드가 무조건 픽셀락 하네스로 하이재킹 | 픽셀 캡처 편의 조건 과확장 | apps/mobile/app/index.tsx, launch-animation.tsx | `EXPO_PUBLIC_PIXEL_LOCK==="1"`일 때만 리다이렉트 (캡처 APK는 플래그 명시 설정 — 무영향 확인) | test-login-flow 계약 유지 |
| FIX-12 | P1 | 픽셀락 | EXP-001 날짜가 동적이라 픽셀 캡처 비결정적 | 실날짜 개선이 preview 경로까지 적용 | apps/mobile/app/expenses/new.tsx | preview 모드는 기준 이미지와 동일한 고정 날짜, 실세션만 오늘(Seoul) | android-native-ui-quality 신규 계약 |
| FIX-13 | P1 | 예산 | 예산 미설정 사용자가 예산 화면에서 무한 에러 dead-end | getBudget 404를 일반 에러로 처리 | apps/mobile/src/api/client.ts, app/budget.tsx | 404 → null 반환, "아직 예산이 없어요" + 입력 카드 정상 렌더 | typecheck + 전체 스위트 |
| FIX-14 | P1 | 지출 기록 | 저장 버튼 연타 시 중복 생성 가능 | disabled 누락 | apps/mobile/app/expenses/new.tsx | disabled={isPending} | 신규 소스 계약 |
| FIX-15 | P2 | UI 통일 | 미니멀 화면 12개: raw 화면 ID 노출, 영문 라벨, 디자인 불일치, 상태 처리 부재 | 배치 구현 후 미다듬 | app/(onboarding)/* 4, (tabs)/records.tsx, expenses/[expenseId].tsx, budget.tsx, settings/{index,privacy}.tsx, family/{invite,accept/[token]}.tsx, import/[importJobId].tsx | theme 토큰+공통 컴포넌트, 해요체, 로딩/에러/빈/저장 중 상태, 콤마 포맷+검증, 2단계 확인, 예산 건너뛰기 | mobile 소스 계약 테스트 전체 그린 |
| FIX-16 | P2 | 설정 | 가구 탈퇴 확정 미연결 ("준비 중") | 클라이언트 함수 부재 | apps/mobile/src/api/client.ts, app/settings/privacy.tsx | confirmHouseholdLeave 추가 + 2단계 확정 흐름 연결 (로컬 모드 포함) | typecheck + 스위트 |
| FIX-17 | P2 | 보안/Android | 릴리즈 빌드 cleartext HTTP 허용, SYSTEM_ALERT_WINDOW 릴리즈 포함 | prebuild 기본값 방치 | apps/mobile/app.json, android/app/src/main/AndroidManifest.xml, src/debug/AndroidManifest.xml | 릴리즈 cleartext 차단(debug 유지), 릴리즈에서 오버레이 권한 제거 | 릴리즈 APK 빌드 성공 |
| FIX-18 | P2 | 임포트 | 에러 문구 영문("Upload failed") | 미번역 | apps/mobile/app/import/index.tsx | 해요체 한국어 통일 | 픽셀락 기본 렌더 불변 확인 |
| FIX-19 | P2 | 리포트 | 절약 팁 카피가 전월 비교인데 "예산 초과" 문구 표시, 증감 0에도 표시 | 카피 로직 오류 | apps/mobile/app/(tabs)/reports.tsx | 감소/증가 분기 카피, 0이면 숨김 | 스위트 그린 |
| FIX-20 | P2 | 안정성 | hasSession 경로 `data!` non-null 단언 → paused 상태 크래시 가능 | 방어 부족 | (tabs)/{index,items}.tsx, family/index.tsx, items/[itemTemplateId].tsx | `isLoading \|\| !data` 가드 | typecheck |
| FIX-21 | P2 | 로컬 백엔드 | acceptInvite 만료 미검사, 테스트 로그인 동의 미기록, 온보딩 화면 로컬 미지원 | 초기 구현 누락 | local-backend.ts, (auth)/login.tsx, (onboarding)/{child-profile,prepared-items}.tsx | 만료 검사, upsertConsents 기록, authToken+LOCAL_HOUSEHOLD_ID 패턴 | local-backend 테스트 |
| FIX-22 | P2 | 가족 | 멤버 삭제 연타 가드 부재 | disabled 누락 | app/family/index.tsx | disabled={isPending} | 스위트 그린 |
| FIX-23 | P3 | 위생 | JVM 크래시 로그 파일 잔존, SDK 사용자 경로 하드코딩, Donut key 충돌 가능, persist version 미명시 | — | android/hs_err·replay 삭제, scripts/build-android-apk.ts, src/ui.tsx, local-backend.ts | 각각 삭제/제거/index 키/version:1 | typecheck + 스위트 |

## 미수정 항목 (사유는 source-audit-and-fix.md §5)

인메모리 API 저장, OAuth/AI 임포트/제휴 링크 dev stub, debug keystore 릴리즈 서명, applicationId, 픽셀락 점수 실측(ADB 금지) — 모두 문서화된 경계 또는 외부 자산 필요.
