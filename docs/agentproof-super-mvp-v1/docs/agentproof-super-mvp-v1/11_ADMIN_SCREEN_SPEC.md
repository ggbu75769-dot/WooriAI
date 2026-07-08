# 11. 화면설계서 — Admin

## 1. Admin 목표

운영자는 수동 운영을 통해 P0 파일럿을 안전하게 검수하고 전환시킨다.

## 2. `/admin/dashboard`

### KPI

- 신규 신청
- 활성 Proof Project
- 리포트 검수 대기
- 보안 이벤트
- 전환 문의
- Provider 실패율

## 3. `/admin/pilot-applications`

| 기능 | 요구사항 |
|---|---|
| 신청 목록 | submitted/reviewing/approved/conditionally/rejected |
| 신청 상세 | 회사명, 담당자, 업무 유형, 위험 domain, paid intent |
| 승인 | approved/conditionally/rejected + reason 필수 |
| 프로젝트 생성 | 승인 후 proof_project/work_profile/project_member 생성 |

## 4. `/admin/projects`

- project status 관리
- participant/case limit 확인
- board_access/report_view token 상태 확인
- token revoke/expire P1 UI placeholder
- 최근 처리건수, risk count, feedback rate

## 5. `/admin/result-cards`

- result cards 검색/필터
- blocked/high risk 카드 확인
- sample/real 구분
- raw source 접근은 audit reason 필수

## 6. `/admin/reports`

- draft 생성
- review 상태
- published 공개
- recheck_needed 표시
- report reliability 확인
- 전환 CTA context 확인

## 7. `/admin/audit-security`

- raw source access audit
- PII redaction events
- prompt injection/security blocks
- token scope mismatch
- provider failures

## 8. `/admin/conversions`

- report 기반 전환 문의
- plan: `single_work_190000`
- recommended start date
- decision maker memo
- status: new/contacted/won/lost

## 9. Acceptance

- Admin 작업은 사용자 board token으로 불가능하다.
- Raw source 접근은 reason 없이 불가능하다.
- Report publish 전 공개 report_view가 열리지 않는다.
- 모든 admin mutation은 audit event를 남긴다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
