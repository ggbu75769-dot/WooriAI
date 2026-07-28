# 알려진 한계 (Known Limitations)

갱신: 2026-07-27 · 브랜치: `codex/sprint2-catalog-payments`

## 해결된 주요 로컬 한계

- PostgreSQL/Prisma 영속화와 41개 migration fresh/upgrade 검증
- refresh token 회전·재사용 차단, Admin MFA/RBAC/CSRF/CSP
- CSV/XLSX 실제 파싱과 preview-before-save
- offline delta v2 cursor, tombstone, household scope, persisted reconciliation
- 5탭 Android Pixel Lock 설치 캡처 9/9
- 기본 catalog audit의 mutable dev DB 의존 제거
- 저위험 catalog 파일럿 승인·manifest·transactional publish runtime

## A. 외부 소유자 입력

| 항목 | 현재 영향 | 해제 조건 |
| --- | --- | --- |
| Android identity/signing | 내부 debug APK만 존재 | application ID/version/keystore 승인 |
| 실제 OAuth | mock/local만 검증 | Kakao 등 console 설정과 live credential |
| 운영 DB/Redis/storage | local 계약만 검증 | endpoint/credential, migrate, backup/restore |
| push/recall/merchant | live smoke 불가 | provider credential과 webhook/health |
| catalog 승인 | 409 in_review, 게시 0 | 독립 editorial/domain/safety review |
| 법적 운영자·스토어 | 제출 불가 | privacy/terms/support/status, listing/labels |
| monitoring | 운영 SLO 미검증 | dashboard/alert/crash provider |
| 물리 Android/iOS | 실제 성능·접근성 미확정 | 기기와 signing/build 환경 |

## B. 낮은 위험의 후속 개선

- `idempotency_keys` TTL 만료 행의 운영 스케줄 정리
- secondary route의 Design System 직접 사용 비율 확대
- 다크모드 강제 기기, 큰 글꼴, 노치/safe-area 반복 검증
- 운영 catalog 게시 후 실제 offer health/가격/빈 상태 UX 측정

## C. 증거 경계

- Release Gate 16/16은 로컬 구현·테스트·빌드 증거이며 운영 배포 증거가 아니다.
- Android Pixel 9/9는 emulator 설치 앱 증거이며 물리기기/스토어 증거가 아니다.
- 구조화 catalog 409개와 evidence 485건은 승인·게시를 뜻하지 않는다.
- fixture 통과는 일반 사용자 경로 또는 실제 provider 통과를 대신하지 않는다.
