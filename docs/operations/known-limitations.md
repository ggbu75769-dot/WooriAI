# 알려진 한계 (Known Limitations)

갱신: 2026-07-12 (라운드 4) · 브랜치: codex/source-audit-standalone-apk

라운드 4에서 해소된 항목은 제거했다. 남은 것은 (A) 외부 계정·키가 필요한 항목, (B) 위험도 낮은 후속 개선이다.

## 라운드 4에서 해소됨 (참고)

- ~~PostgreSQL 영속화~~ → 전 도메인 Prisma 전환 완료, 재시작 후 데이터 유지 검증.
- ~~refresh 토큰 무효화/회전 없음~~ → hash 저장·1회용 회전·재사용 시 family 전체 무효화·동시 사용 CAS 차단.
- ~~관리자 공용 토큰~~ → email/password + RBAC(admin/editor/analyst) + 감사 로그. 공용 토큰은 dev/test 전용.
- ~~AI 임포트 스텁·파일 피커 미구현~~ → expo-document-picker + multipart 업로드 + 서버 실 CSV/XLSX 파싱(CP949, formula injection 방어, 중복 후보 탐지).
- ~~Idempotency-Key 미처리~~ → 지출 생성·예산·import 승인에 적용.
- ~~감사 로그 인메모리 휘발~~ → audit_logs 테이블 영속화.
- ~~카테고리 리포트 전체 기간 고정~~ → 서버 기간 파라미터 지원.
- ~~토큰 평문 AsyncStorage~~ → SecureStore + 1회 마이그레이션. 콜드 스타트 세션 복원 결함도 수정.
- rate limit·security headers·body 제한·구조화 로깅·health/readiness 추가.

## A. 외부 계정·키·계약 (코드로 해결 불가)

| 항목 | 영향 | 필요한 사용자 조치 |
|---|---|---|
| 실 Kakao/Apple/Google OAuth | 실 소셜 로그인 불가. dev provider는 dev/test 한정, production은 501 | OAuth 콘솔 키 발급 → env 설정 + provider 토큰 검증 어댑터에 실 구현 연결 |
| 운영 PostgreSQL | 로컬 docker/포터블로만 검증됨 | 운영 `DATABASE_URL` 주입 후 `prisma migrate deploy` |
| 릴리즈 서명 keystore | debug keystore 서명 → 스토어 배포 불가 | keystore 발급 + Gradle signingConfig 연결 |
| applicationId `com.anonymous.wooriai` | 스토어 등록 부적합 | 실제 패키지명으로 변경(native 재빌드) |
| 실 제휴 링크 | 시드는 비제휴 dev 샘플 | 제휴 계약 + 관리자 CMS에서 실 URL 등록 |
| 크래시·성능 모니터링 | 구조화 로그만 존재 | Sentry 등 SDK 키 연동 |
| 푸시 알림 | 알림 화면은 정직한 빈 상태 | FCM 계정 + push provider 연동 |
| 법적 운영자 정보 | 정책 문구 placeholder | 실 사업자 정보로 교체 |

## B. 후속 개선 (위험도 낮음)

- 준비템 탭 기본 선택이 고정 "12-24개월"(픽셀락 승인 화면 기준) — 아이 단계 연동은 디자인 승인 후.
- ~~아이 단계 계산 기본 '오늘'이 UTC (`packages/domain/src/stage.ts`) — KST 00~09시 하루 오차.~~ **해결(FIX-STAGE-UTC)**: 기본 '오늘'을 `getSeoulToday()`(Asia/Seoul) 기준으로 계산하며, 서울 자정 주차/개월 롤오버·월말 생일 경계 테스트로 고정.
- 지출 수정 화면에 날짜/카테고리 편집 UI 미노출 (API는 지원).
- idempotency_keys 만료 행 정리는 로그인 시 refresh 토큰 정리와 달리 스케줄러 미구현 (24h TTL 필드는 존재).
- 도넛 원호 근사 표현(범례 %는 실데이터), 앱 정보 버전 하드코딩, `isValidCalendarDate` 로컬 복제.
- 관리자 계정 관리 API 미구현 — 계정 추가/역할 변경은 seed 또는 DB 직접 조작.
- 대화형 알림/온보딩 이어하기 등 P1 항목 일부는 후속 라운드.

## C. 런타임 재검증이 남은 항목

- 노치/펀치홀 Safe Area, 큰 글꼴, 다크모드 강제 기기.
- 실기기(비에뮬레이터) 설치 검증.
