# 18. 보안 / 개인정보 / 접근제어 설계서

## 1. 기본 원칙

- 원문은 가능한 저장하지 않는다.
- 저장해야 하면 암호화하고 retention을 제한한다.
- analytics/log/bundle에 email/company/raw text/token/secret을 보내지 않는다.
- raw token은 생성 직후 한 번만 보여주고 DB에는 hash만 저장한다.
- report는 `report_view` scope와 published 상태가 모두 필요하다.

## 2. 접근 token scope

| scope | 가능 |
|---|---|
| `board_access` | `/proof/board`, text/csv intake, feedback |
| `report_view` | published `/proof/report` read only |
| admin token | admin mutations |

## 3. Access failure states

- missing_token
- invalid_token
- revoked_token
- expired_token
- scope_mismatch
- cross_project
- project_not_active
- report_not_published

## 4. Raw source access

Admin이 원문/민감 source를 보려면 반드시 reason이 필요하다.

Audit fields:

- admin id
- reason
- related resource type/id
- rawTextStored false 여부
- fingerprint/hash
- timestamp

## 5. PII 탐지

- 전화번호
- 이메일
- 주소
- 카드번호
- 주민등록번호
- 사업자번호
- 계좌번호 패턴은 P1 추가 가능

## 6. Retention

| 데이터 | 정책 |
|---|---|
| CSV 원본 파일 | 기본 delete_after_parse |
| raw text | encrypted or redacted, report에는 excerpt/masked |
| result card | sanitized output 저장 |
| feedback | 저장 |
| audit log | 저장 |
| access token raw | 저장 금지 |
| token hash | 저장 |

## 7. Security acceptance

- `pnpm test:security` 통과.
- bundle에 secret/key/token 없음.
- analytics payload allowlist test 통과.
- logs/error message에 raw text/token 없음.
- project/report scope mismatch test 통과.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
