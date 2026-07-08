# 29. Codex 실행 프로토콜

## 1. 절대 원칙

- `agentproofKR/agentproofKR.github.io`만 작업한다.
- 다른 프로젝트 폴더/도메인/아키텍처를 섞지 않는다.
- 한국어 UI를 유지한다.
- 가짜 고객 수치/후기/로고/인증을 만들지 않는다.
- secret/token/raw text를 bundle/log/docs/analytics에 노출하지 않는다.
- 기능 변경에는 테스트를 함께 추가한다.

## 2. 작업 시작 절차

1. `AGENTS.md` 읽기.
2. `docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md` 읽기.
3. 해당 task packet 읽기.
4. 관련 현재 파일 직접 열기.
5. 변경 계획을 5줄 이하로 요약.
6. 작은 단위로 수정.
7. 테스트 실행.
8. 결과 보고.

## 3. 작업 단위 규칙

- 한 번에 route 흐름 + UI + DB + Edge를 모두 크게 바꾸지 않는다.
- AP-SMVP task 1개 단위로 진행한다.
- public UX 변경과 admin/security 변경은 분리한다.
- DB migration은 반드시 rollback risk를 적는다.

## 4. 완료 보고 형식

```txt
구현한 작업:
- AP-SMVP-00X ...

변경 파일:
- ...

테스트:
- pnpm lint: pass/fail
- pnpm typecheck: pass/fail
- pnpm test: pass/fail
- pnpm test:e2e: pass/fail or not run(reason)
- pnpm test:security: pass/fail or not run(reason)

확인한 UX:
- ...

남은 이슈:
- ...
```

## 5. 중단 기준

- 테스트가 깨졌는데 원인을 모를 때.
- 개인정보/토큰 노출 가능성이 생겼을 때.
- migration이 기존 운영 데이터를 삭제할 수 있을 때.
- survey 기존 저장 흐름이 깨질 때.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
