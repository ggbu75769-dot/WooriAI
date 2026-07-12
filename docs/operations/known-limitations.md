# 알려진 한계 (Known Limitations)

작성: 2026-07-12 · 브랜치: codex/source-audit-standalone-apk

이번 세션에서 **수정하지 않은 항목**과 그 사유. 대부분 코드로 해결할 수 없는 외부 의존성이거나, 문서상 의도된 개발 경계이거나, 대규모 재작성이 필요해 이번 범위를 벗어나는 것이다. 각 항목에 위험도와 필요한 후속 조치를 명시한다.

## A. 외부 계정·키·계약 (코드로 해결 불가)

| 항목 | 영향 | 필요한 사용자 조치 | 조치 후 검증 |
|---|---|---|---|
| 실 Kakao/Apple/Google OAuth | 실 소셜 로그인 불가. 현재 dev 스텁, 프로덕션에선 501 차단 | 각 OAuth 콘솔에서 client id/secret 발급 → env 설정 + `auth.service.ts`에 실 검증 구현 | `POST /api/v1/auth/oauth-login`에 실 토큰으로 로그인 성공 |
| PostgreSQL 영속화 | API 재시작 시 데이터 소실(인메모리) | `DATABASE_URL` + Prisma 마이그레이션 배포 | `prisma migrate deploy` 후 재시작 데이터 유지 |
| 릴리즈 서명 keystore | 스토어 배포 불가(현재 debug keystore) | 릴리즈 keystore 발급 + Gradle signingConfig 연결 | 서명된 AAB 생성 및 Play Console 업로드 |
| applicationId `com.anonymous.wooriai` | 스토어 등록 부적합 | 실제 패키지명으로 변경(네이티브 재빌드 필요) | 변경 후 assembleRelease 성공 |
| 실 제휴/커머스 링크 | example.com dev 링크 | 제휴사 계약 + 실 URL 시드 | 클릭 시 실 판매처 이동 + 클릭 로그 |
| 크래시·ANR·성능 모니터링 | 운영 관측 불가 | Sentry 등 SDK 연동 | 대시보드에 이벤트 수신 |

## B. 문서상 의도된 개발 경계 (`01_codex_master_instruction_v0_4 §8`)

- **AI 임포트 분석 스텁**: 엑셀/CSV 실제 내용 파싱은 규칙 기반 스텁. `apps/mobile/app/import/index.tsx`(IMP-001~003)는 픽셀락으로 고정된 데모 미리보기 화면(하드코딩 파일명 "5월 지출내역.xlsx", 총 128건 등)을 표시하고, "적용하고 리포트 보기"를 누르면 실제 import job(`/import/[importJobId]`)으로 이동해 신뢰도·승인 UI가 나온다. **승인 전 지출 미저장 안전장치는 실동작으로 검증됨.** 실제 파일 피커(expo-document-picker) 연동은 미구현.
  - 위험: 낮음(안전장치 존재). 후속: expo-document-picker 연동 + 데모 카드 실데이터화.
- **제휴 dev 링크 / OAuth dev 스텁**: 위 A 참조.

## C. 대규모 재작성이 필요해 이번 범위 밖 (P2/P3)

| 항목 | 위치 | 위험 |
|---|---|---|
| 아이 단계 계산 기본 '오늘'이 UTC | `packages/domain/src/stage.ts` | KST 00~09시 임신주차/개월 하루 오차 (낮음) |
| gift 타입 지출 API 생성 경로 공백 | `CreateExpenseDto`에 expenseType 없음 | 선물 기록 UI 미노출(제외 로직은 일관) |
| Idempotency-Key 미처리 | createExpense/upsertBudget | 네트워크 재시도 시 중복 생성 가능(UI는 연타 가드 있음) |
| 감사 로그 인메모리 휘발 | `audit-logger.service.ts` | 재시작 시 삭제 이력 소실(DB 전환 시 해소) |
| 지출 수정 화면 날짜/카테고리 편집 UI 부재 | `app/expenses/[expenseId].tsx` | API는 지원, UI 미노출 |
| 더보기 라벨-동작 불일치, 가족 하드코딩 이름/코드 | `app/(tabs)/more.tsx`, `app/family/index.tsx` | 픽셀락 고정 데모 데이터(P2) |
| refresh 토큰 무효화/회전 없음 | `auth.service.ts` logout | 탈취 시 30일 유효(DB 전환 시 블랙리스트 도입) |
| 카테고리 리포트가 전체 기간 고정 | `getCategoryReport`에 기간 파라미터 없음 | UI는 "전체 기간 카테고리 비중"으로 정직 표기(개선 라운드 2) — 서버 기간 파라미터는 후속 |
| 도넛 원호가 근사 표현 | `src/ui.tsx` DonutChartCard | 원호 색·개수는 범례와 일치, 정확한 비율 원호는 SVG 의존성 필요(범례 %는 실데이터) |
| `isValidCalendarDate` 로컬 복제 | new.tsx / [expenseId].tsx / local-backend.ts / domain | 알고리즘 동일(모순 없음) — domain 함수로 통합은 후속 정리 |
| 앱 정보 버전 하드코딩 | `more.tsx` "버전 0.0.0" | expo-constants 연동은 후속 |
| 알림 데이터 소스 없음 | `app/notifications.tsx` | 정직한 빈 상태 화면(가짜 알림 없음) — 실 알림은 푸시 인프라 필요 |

## D. 런타임 재검증이 남은 항목 (실기기·인프라 의존)

- 노치/펀치홀 기기 Safe Area, 키보드 가림, 큰 글꼴/작은 화면 글자 잘림, 다크모드 강제 기기 색상(앱 light 고정).
- Android 픽셀락 점수 재측정(`pnpm pixel:android`) — perceptual 기준 회귀 확인.
- 실 API 서버 연결 빌드(https, cleartext 차단), 실 DB 영속, 프로덕션 JWT/admin env.

이 문서의 항목 중 **치명·높음 등급의 미해결 결함은 없다.** 남은 것은 외부 의존성, 의도된 스텁 경계, 또는 위험도 중간 이하의 개선 항목이다.
