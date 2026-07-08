# 우리아이 Phase 4 Task Breakdown v0.4

## 작업 ID 체계
- BOOT: 부트스트랩/환경
- DOMAIN: 공통 도메인
- DB: 데이터베이스/시드
- API/EXPAPI/BUDAPI/REPAPI/ITEMAPI/COMAPI/FAMAPI/IMPAPI: 백엔드
- APP: 모바일 앱
- ADM: 관리자 CMS
- QA/REL: 테스트/릴리즈

## 전체 작업표
| Task ID | Area | Priority | Target | Description | Dependencies | Acceptance Summary | Codex Batch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BOOT-001 | Bootstrap | P0 | repo/docs | 현재 repo 구조와 Phase 3 산출물을 대조하고 누락 파일 목록을 작성한다. | 없음 | docs/dev/source-lock.md 생성 | Batch 00 |
| BOOT-002 | Bootstrap | P0 | root | pnpm-workspace.yaml, turbo.json, package scripts, tsconfig base를 생성한다. | BOOT-001 | pnpm install 후 workspace 인식 | Batch 01 |
| BOOT-003 | Bootstrap | P0 | infra/docker | postgres, redis, minio, api용 docker-compose.yml을 만든다. | BOOT-002 | docker compose up -d 성공 | Batch 01 |
| BOOT-004 | Bootstrap | P0 | root | .env.example과 scripts/check-env.ts를 작성한다. | BOOT-002 | 필수 env 누락 시 명확한 오류 | Batch 01 |
| BOOT-005 | Bootstrap | P0 | .github/workflows | lint, typecheck, unit test, build dry-run CI를 구성한다. | BOOT-002 | PR에서 CI가 실행됨 | Batch 01 |
| DOC-001 | Documentation | P0 | docs/dev | Do Not Change 계약을 repo에 복사하고 README에서 참조한다. | BOOT-001 | 변경 금지 항목이 문서화됨 | Batch 00 |
| DOMAIN-001 | Domain | P0 | packages/domain | auth_provider, member_role, child_stage_code, item_status 등 enum을 고정한다. | BOOT-002 | API/mobile/admin이 동일 enum import | Batch 02 |
| DOMAIN-002 | Domain | P0 | packages/domain | 임신 주차/출생 후 개월/수동 단계 계산기를 구현한다. | DOMAIN-001 | BR-002/003/004 테스트 통과 | Batch 02 |
| DOMAIN-003 | Domain | P0 | packages/domain | 추천 점수 계산기를 구현한다. 수수료율은 점수 변수로 사용하지 않는다. | DOMAIN-001 | BR-301~305 테스트 통과 | Batch 02 |
| DOMAIN-004 | Domain | P0 | packages/domain | 원화 금액, Asia/Seoul 월 경계, 날짜 제한 유틸을 구현한다. | DOMAIN-001 | 월 경계/미래 날짜 테스트 통과 | Batch 02 |
| DOMAIN-005 | Contracts | P0 | packages/contracts | OpenAPI DTO 또는 Zod schema를 공유 패키지로 정리한다. | DOMAIN-001 | API 요청/응답 타입을 앱에서 사용 | Batch 02 |
| DB-001 | Database | P0 | apps/api/prisma | Phase 3 DB 설계를 schema.prisma로 반영한다. | BOOT-002 | Prisma validate 통과 | Batch 03 |
| DB-002 | Database | P0 | apps/api/prisma/migrations | 초기 migration을 생성하고 PostgreSQL에 적용한다. | DB-001 | migrate dev/deploy 성공 | Batch 03 |
| DB-003 | Database | P0 | seed | 기본 12개 카테고리 seed를 작성한다. | DB-002 | 카테고리 중복 없이 재실행 가능 | Batch 03 |
| DB-004 | Database | P0 | seed | 시기별 준비템 seed를 작성한다. | DB-003 | 필수/편의/선택, 안 사도 되는 경우 필드 포함 | Batch 03 |
| DB-005 | Database | P0 | seed | 개발용 product_links seed를 작성한다. 실제 제휴 링크는 넣지 않는다. | DB-004 | affiliate/sponsored flag 테스트 가능 | Batch 03 |
| DB-006 | Database | P0 | db | soft delete, unique, FK, indexes를 확인한다. | DB-002 | 중복/권한/조회 성능 기준 충족 | Batch 03 |
| API-001 | API Common | P0 | apps/api | NestJS app bootstrap과 /api/v1 prefix를 설정한다. | BOOT-002 | GET /health OK | Batch 04 |
| API-002 | API Common | P0 | apps/api/common | ValidationPipe, GlobalExceptionFilter, ErrorResponse를 구현한다. | API-001 | 400/401/403/500 응답 형식 통일 | Batch 04 |
| API-003 | Auth API | P0 | modules/auth | OAuth login dev stub + token pair 발급을 구현한다. | API-002, DB-001 | /auth/oauth-login 동작 | Batch 04 |
| API-004 | Auth API | P0 | modules/auth | refresh token, logout, auth guard를 구현한다. | API-003 | 토큰 만료/재발급 테스트 통과 | Batch 04 |
| API-005 | RBAC | P0 | common/guards | household membership/role guard를 구현한다. | API-004 | owner/co_parent/viewer 권한 테스트 | Batch 04 |
| API-006 | Consents API | P0 | modules/consents | 필수/선택 동의 저장 및 버전 조회 API를 구현한다. | API-004 | 필수 동의 없이는 온보딩 불가 | Batch 05 |
| API-007 | Children API | P0 | modules/children | 아이 프로필 생성/조회/수정 API를 구현한다. | API-005, DOMAIN-002 | stage 계산값 반환 | Batch 05 |
| API-008 | Onboarding API | P0 | modules/children/items/budgets | prepared item 상태와 첫 예산 설정 API를 연결한다. | API-007 | 온보딩 완료 후 home summary 가능 | Batch 05 |
| APP-001 | Mobile Foundation | P0 | apps/mobile | Expo Router, QueryClient, Zustand store, theme tokens를 구성한다. | BOOT-002 | 앱 실행 및 네비게이션 동작 | Batch 05 |
| APP-002 | Mobile Auth | P0 | apps/mobile/app/(auth) | AUTH-001 로그인/약관 동의 화면을 구현한다. | APP-001, API-003 | 필수 동의 전 계속 비활성 | Batch 05 |
| APP-003 | Mobile Onboarding | P0 | apps/mobile/app/(onboarding) | ONB-001~004 화면과 API 연결을 구현한다. | APP-002, API-007 | 4단계 이하로 HOME-001 진입 | Batch 05 |
| APP-004 | Mobile State | P0 | apps/mobile/src/stores | session, selectedChild, onboardingProgress store를 구현한다. | APP-001 | 재실행 시 세션/온보딩 상태 유지 | Batch 05 |
| EXPAPI-001 | Expenses API | P0 | modules/expenses | 지출 생성 API를 구현한다. | API-005, DB-003 | 금액 0보다 큰 정수, 미래 날짜 제한 | Batch 06 |
| EXPAPI-002 | Expenses API | P0 | modules/expenses | 지출 목록/상세/수정/soft delete API를 구현한다. | EXPAPI-001 | 삭제 후 리포트 제외 + audit log | Batch 06 |
| BUDAPI-001 | Budgets API | P0 | modules/budgets | 월 예산 조회/수정 API를 구현한다. | API-005 | Asia/Seoul 기준 월 예산 | Batch 06 |
| REPAPI-001 | Reports API | P0 | modules/reports | 월별/누적/카테고리 집계 API를 구현한다. | EXPAPI-002, BUDAPI-001 | 홈과 동일한 월 사용액 | Batch 06 |
| HOMEAPI-001 | Home API | P0 | modules/home | 홈 요약 API를 구현한다. | REPAPI-001 | 누적/월예산/추천템/최근기록 반환 | Batch 06 |
| APP-EXP-001 | Mobile Expense | P0 | EXP-001 | 빠른 지출 기록 화면을 구현한다. | APP-003, EXPAPI-001 | 품목→금액→저장 10초 가능 | Batch 06 |
| APP-EXP-002 | Mobile Expense | P0 | EXP-004/003 | 기록 리스트와 상세 수정/삭제 화면을 구현한다. | APP-EXP-001, EXPAPI-002 | 수정/삭제 후 홈/리포트 일치 | Batch 06 |
| APP-HOME-001 | Mobile Home | P0 | HOME-001 | 홈 대시보드를 구현한다. | HOMEAPI-001, APP-EXP-001 | 빈 홈 금지, 저장 후 즉시 갱신 | Batch 06 |
| APP-REP-001 | Mobile Reports | P0 | REP-001/002 | 월별/누적 리포트 화면을 구현한다. | REPAPI-001 | 삭제/선물 제외 집계 일치 | Batch 06 |
| ITEMAPI-001 | Items API | P0 | modules/items | 아이 단계 기준 준비템 목록 API를 구현한다. | DOMAIN-003, DB-004 | 이미 준비/필요없음 지금 필요 제외 | Batch 07 |
| ITEMAPI-002 | Items API | P0 | modules/items | 준비템 상세/상태 변경 API를 구현한다. | ITEMAPI-001 | 상태 변경 즉시 추천/홈 반영 | Batch 07 |
| COMAPI-001 | Commerce API | P0 | modules/commerce | 상품 링크 조회와 affiliate_clicks 저장 API를 구현한다. | ITEMAPI-002 | 클릭 로그에 user/child/item/product/platform 저장 | Batch 07 |
| APP-ITEM-001 | Mobile Items | P0 | ITEM-001 | 준비템 목록 탭/카드/상태 변경 UI를 구현한다. | ITEMAPI-001 | 필수도 배지, 상태 버튼 노출 | Batch 07 |
| APP-ITEM-002 | Mobile Items | P0 | ITEM-002 | 준비템 상세 화면을 구현한다. | ITEMAPI-002 | 왜 필요한지/안 사도 되는 경우/가격대 표시 | Batch 07 |
| APP-COM-001 | Mobile Commerce | P0 | ITEM-003 | 구매 링크 바텀시트와 외부 링크 열기를 구현한다. | COMAPI-001 | 구매 CTA 인접 제휴 고지 필수 | Batch 07 |
| APP-COM-002 | Mobile Commerce | P1 | ITEM-004 | 구매 후 기록 유도 화면을 구현한다. | APP-COM-001 | 샀나요? → 기록/상태 업데이트 가능 | Batch 07 |
| FAMAPI-001 | Family API | P1 | modules/households | 가족 멤버 목록/역할 조회 API를 구현한다. | API-005 | viewer는 리포트만 가능 | Batch 08 |
| FAMAPI-002 | Family API | P1 | modules/households | 초대 링크 생성/만료/수락 API를 구현한다. | FAMAPI-001 | 초대 토큰 만료와 재공유 처리 | Batch 08 |
| FAMAPP-001 | Mobile Family | P1 | FAM-001/002 | 가족 관리와 초대 역할 선택 화면을 구현한다. | FAMAPI-001 | 관리자만 초대/삭제 가능 | Batch 08 |
| FAMAPP-002 | Mobile Family | P1 | FAM-003 | 초대 수락 플로우를 구현한다. | FAMAPI-002 | 수락 후 같은 아이 가계부 접근 | Batch 08 |
| IMPAPI-001 | Import API | P1 | modules/imports | xlsx/csv 업로드 시작 API와 파일 제한을 구현한다. | API-005 | 10MB/2,000행 제한, 형식 검증 | Batch 09 |
| IMPAPI-002 | Import Worker | P1 | workers | AI 분석 stub/worker와 import_rows preview 생성을 구현한다. | IMPAPI-001 | 0.70 미만 기본 미선택, 중복 후보 표시 | Batch 09 |
| IMPAPI-003 | Import API | P1 | modules/imports | 선택 행 confirm → expenses 생성 API를 구현한다. | IMPAPI-002 | 사용자 승인 전 expenses 저장 금지 | Batch 09 |
| IMPAPP-001 | Mobile Import | P1 | IMP-001/002 | 엑셀 업로드 시작/분석 진행 화면을 구현한다. | IMPAPI-001 | 업로드 전 개인정보 안내 | Batch 09 |
| IMPAPP-002 | Mobile Import | P1 | IMP-003/004 | 분석 미리보기/가져오기 완료 화면을 구현한다. | IMPAPI-002/003 | 선택 행만 가져오고 리포트 즉시 반영 | Batch 09 |
| ADM-001 | Admin | P0 | apps/admin | Next.js Admin shell과 admin auth placeholder를 구성한다. | BOOT-002 | 내부 관리자만 접근 | Batch 10 |
| ADM-002 | Admin | P0 | ADM-002 | 준비템 CMS CRUD를 구현한다. | ITEMAPI-001 | 안 사도 되는 경우 필수 필드 처리 | Batch 10 |
| ADM-003 | Admin | P0 | ADM-003 | 상품 링크/제휴/스폰서 관리 화면을 구현한다. | COMAPI-001 | 링크/고지 앱 배포 없이 수정 | Batch 10 |
| ADM-004 | Admin | P0 | ADM-004 | 고지/정책 문구 관리 화면을 구현한다. | ADM-001 | 제휴/영양제/스폰서 문구 관리 | Batch 10 |
| SET-001 | Settings | P0 | SET-001~004 | 설정, 개인정보/동의, 데이터 삭제/탈퇴 플로우를 구현한다. | APP-003, API-006 | 삭제 범위/영향 2단계 확인 | Batch 10 |
| QA-001 | QA | P0 | tests | unit test: domain, API services, recommendation, RBAC를 작성한다. | Batch 06~10 | 핵심 도메인 테스트 통과 | Batch 11 |
| QA-002 | QA | P0 | tests/e2e | API e2e: auth→onboarding→expense→report→item click를 작성한다. | QA-001 | 핵심 루프 e2e 통과 | Batch 11 |
| QA-003 | QA | P1 | mobile tests | 앱 수동 QA 스크립트를 docs/qa에 작성한다. | APP 완료 | QA Runbook과 동일 플로우 검증 | Batch 11 |
| REL-001 | Release | P0 | release | 버전, env, migration, legal, analytics, rollback 체크리스트를 완료한다. | QA-002 | Release Checklist all green | Batch 11 |
