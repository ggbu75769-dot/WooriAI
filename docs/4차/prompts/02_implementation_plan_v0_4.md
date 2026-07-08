# 우리아이 Phase 4 Implementation Plan v0.4

## 목표
Codex가 단발성 코드 생성을 넘어서, Phase 3에서 고정된 개발 구조를 실제 MVP 구현 순서로 안정적으로 실행하도록 만든다.

## 구현 단계
| Phase ID | Phase | Estimate | Owner | Scope | Exit Criteria |
| --- | --- | --- | --- | --- | --- |
| IP-00 | 소스 고정 및 실행 기준 정렬 | 0.5d | PM/Tech Lead/Codex | 1~3차 산출물과 현재 리포지토리를 대조하고 변경 금지 항목을 루트 README와 docs에 고정한다. | Do Not Change 계약 승인, 문서 링크/파일 경로 고정 |
| IP-01 | 모노레포 부트스트랩 | 1d | Codex | pnpm workspace, turbo, Expo mobile, NestJS API, Next.js admin, packages/domain/contracts/ui/config/test-utils 골격을 만든다. | pnpm install, lint/typecheck 스크립트, docker compose skeleton |
| IP-02 | 공통 도메인/계약 패키지 | 1d | Codex | Enum, stage calculator, money/date utils, recommendation rule, Zod DTO를 packages/domain/contracts에 구현한다. | 공통 테스트 통과, 앱/API 동일 enum 사용 |
| IP-03 | DB/Prisma/Seed | 1.5d | Codex | Phase 3 SQL/Prisma 기준으로 schema.prisma, migration, seed categories/item_templates/product_links를 구현한다. | migrate + seed 후 핵심 테이블/인덱스 생성 |
| IP-04 | 백엔드 공통 기반 | 2d | Codex | NestJS modules, validation pipe, error filter, auth guard, household role guard, audit logger를 구축한다. | API가 /api/v1 아래에서 공통 응답/오류 규격을 사용 |
| IP-05 | 인증/동의/온보딩 | 2d | Codex | OAuth stub/dev login, token storage, consent save, child profile, prepared items, budget onboarding을 앱/API로 연결한다. | 신규 사용자가 4단계 이하로 HOME-001 진입 |
| IP-06 | 홈/기록/예산/리포트 핵심 루프 | 3d | Codex | HOME-001, EXP-001/003/004, BUD-001, REP-001/002를 구현한다. | 10초 기록, 저장 후 홈/리포트 즉시 갱신 |
| IP-07 | 준비템/제휴 구매 루프 | 2.5d | Codex | ITEM-001/002/003/004, recommendation score, affiliate click logging, disclosure UI를 구현한다. | 이미 준비/필요없음 제외, 클릭 로그 저장, 제휴 고지 인접 노출 |
| IP-08 | 가족 초대 P1 | 2d | Codex | FAM-001/002/003, invite token, role acceptance, RBAC 적용을 구현한다. | 공동부모 지출이 같은 아이 리포트에 반영 |
| IP-09 | 엑셀 업로드 베타 P1 | 3d | Codex | IMP-001~004, xlsx/csv upload, import_jobs/import_rows, AI 분석 stub/worker, preview confirm을 구현한다. | 사용자 승인 전 expenses 저장 금지, 0.70 미만 미선택 |
| IP-10 | 관리자 CMS P0 | 2d | Codex | ADM-001~004, item template/product link/disclosure 관리, click summary를 구현한다. | 앱 배포 없이 준비템/링크/고지 수정 가능 |
| IP-11 | QA 하드닝 및 릴리즈 | 3d | QA/Codex | 자동/수동 테스트, 접근성, 데이터 삭제, 제휴/개인정보 고지, 릴리즈 체크리스트를 완료한다. | Release Gate 통과, rollback plan 준비 |

## 권장 실행 원칙
- 한 번의 Codex 실행은 최대 1개 Batch 또는 서로 강하게 연결된 2~3개 Task ID만 처리한다.
- DB/API/앱 화면을 동시에 크게 바꾸지 않는다. 계약 → API → 앱 → 테스트 순서로 간다.
- 매 Batch 종료 시 Do Not Change 준수 여부를 보고한다.
- P0 완료 전 P2 기능을 구현하지 않는다.
