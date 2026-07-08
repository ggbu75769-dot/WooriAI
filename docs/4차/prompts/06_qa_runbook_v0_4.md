# 우리아이 Phase 4 QA Runbook v0.4

## 기본 명령
| Name | Command | Purpose |
| --- | --- | --- |
| Install | pnpm install | 전체 워크스페이스 의존성 설치 |
| Env Check | pnpm check:env | 필수 환경변수 누락 확인 |
| Infra Up | docker compose -f infra/docker/docker-compose.yml up -d | Postgres/Redis/MinIO 로컬 실행 |
| DB Generate | pnpm --filter api prisma:generate | Prisma client 생성 |
| DB Migrate | pnpm --filter api prisma:migrate | 로컬 DB migration 적용 |
| DB Seed | pnpm --filter api seed | 카테고리/준비템/개발 링크 seed |
| Lint | pnpm lint | 전체 lint |
| Typecheck | pnpm typecheck | 전체 TypeScript typecheck |
| Unit Test | pnpm test | Unit test |
| API E2E | pnpm --filter api test:e2e | API e2e |
| Mobile Start | pnpm --filter mobile start | Expo dev server |
| API Start | pnpm --filter api start:dev | NestJS dev server |
| Admin Start | pnpm --filter admin dev | Next.js admin dev server |
| Build | pnpm build | 전체 build dry-run |

## 수동/자동 QA 시나리오
| Run ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| QR-00 | 환경 준비 | pnpm install, .env.example 복사, docker compose up -d, prisma migrate/seed를 실행한다. | 로컬 API, DB, admin, mobile dev server가 모두 기동 |
| QR-01 | 스모크: 첫 가입 | dev login → 필수 동의 → ONB-001~004 → HOME-001 진입 | 홈에 아이 단계/누적/예산/준비템이 표시 |
| QR-02 | 스모크: 빠른 기록 | HOME CTA → EXP-001 → 기저귀 49,800원 저장 | 홈/리포트 월 사용액 즉시 +49,800원 |
| QR-03 | 지출 수정/삭제 | EXP-004에서 항목 선택 → 금액 수정 → 삭제 | 수정 후 집계 반영, 삭제 후 제외 + audit log |
| QR-04 | 준비템 상태 | ITEM-001에서 카시트 이미 샀어요 처리 | 지금 필요에서 제외되고 이미 준비 탭에 표시 |
| QR-05 | 제휴 링크 | ITEM-002 → ITEM-003 → 쿠팡/네이버 버튼 클릭 | CTA 인접 고지 노출, affiliate_clicks 저장 |
| QR-06 | 리포트 집계 | REP-001/002에서 월별/누적 확인 | 홈 월 금액과 리포트 금액 일치 |
| QR-07 | 가족 초대 | owner가 co_parent 초대 → 수락 → co_parent 지출 추가 | owner 리포트에 공동부모 지출 반영 |
| QR-08 | 권한 제한 | viewer 계정으로 지출 추가/예산 수정 시도 | 403 또는 권한 부족 UI 표시 |
| QR-09 | 엑셀 업로드 | xlsx/csv 업로드 → 분석 → 미리보기 → 선택 가져오기 | 승인 전 expenses 0건, 승인 후 선택 행만 저장 |
| QR-10 | 엑셀 예외 | 잘못된 파일, 10MB 초과, 2,000행 초과, 잘못된 컬럼 업로드 | 업로드 전/분석 전 명확한 오류 표시 |
| QR-11 | 관리자 CMS | ADM-002/003/004에서 준비템/링크/고지 수정 | 앱에서 수정값 반영 |
| QR-12 | 개인정보/삭제 | SET-003/004에서 동의 확인/계정 삭제/아이 삭제 플로우 확인 | 2단계 확인, 영향 고지, 삭제 후 접근 차단 |
| QR-13 | 오프라인/오류 | 네트워크 차단 후 홈/기록/링크 동작 확인 | 캐시/오류/재시도/입력값 유지 정책 준수 |
| QR-14 | 접근성 | 버튼 크기, 대비, 스크린리더 label, 그래프 수치 텍스트 확인 | 주요 UX 접근성 기준 충족 |
| QR-15 | 릴리즈 게이트 | lint/typecheck/test/e2e/build/admin build/db migration dry-run | 모든 게이트 green 또는 승인된 waiver 존재 |

## 버그 등급
| Severity | 기준 | 예시 |
|---|---|---|
| S0 Blocker | 데이터 손실, 로그인 불가, 결제/제휴 고지 누락, 개인정보 삭제 불가 | 지출 저장 후 금액 유실, 승인 전 엑셀 내역 저장 |
| S1 Critical | 핵심 루프 실패, 권한 우회, 리포트 집계 오류 | 공동부모 권한 우회, 삭제 내역이 리포트에 포함 |
| S2 Major | 우회 가능한 주요 UX/API 오류 | 특정 상태 Empty UI 누락 |
| S3 Minor | 문구/간격/경미한 표시 오류 | 줄바꿈, 버튼 여백 |
