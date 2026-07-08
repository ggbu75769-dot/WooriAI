# 36. AGENTS.md Super MVP 업데이트 제안

## 1. 목적

현재 `AGENTS.md`는 AgentProof Landing V4.1 기준 문서를 우선시한다. Super MVP 작업에서는 기존 규칙을 유지하되, 새 source of truth를 추가해야 Codex가 옛 랜딩 중심 지시와 새 Proof Board 중심 지시 사이에서 흔들리지 않는다.

## 2. AGENTS.md에 추가할 섹션

아래 내용을 기존 `AGENTS.md` 상단 또는 `Source of truth` 앞에 추가한다.

```md
## AgentProof Super MVP v1 작업 기준

Super MVP 작업을 수행할 때는 아래 문서를 먼저 읽는다.

1. `docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md`
2. `docs/agentproof-super-mvp-v1/01_PRODUCT_DEFINITION.md`
3. `docs/agentproof-super-mvp-v1/02_CURRENT_SOURCE_AUDIT.md`
4. `docs/agentproof-super-mvp-v1/31_BACKLOG_TASK_PACKETS.md`
5. 현재 작업의 `codex-prompts/AP-SMVP-*.md`

Super MVP의 최우선 목표는 무료 진단 후 추가 설문 없이 Proof Board로 바로 연결하고, 실제 업무 입력 → 결과 카드 → 사용 여부 → Proof Score/Evidence Dashboard → 10일 결과표 → 운영 전환 문의까지 하나의 흐름으로 닫는 것이다.

### Super MVP에서 반드시 지킬 것

- 다른 프로젝트의 구조나 용어를 섞지 않는다.
- `/proof/pilot-design/questions`를 필수 funnel로 다시 만들지 않는다.
- 사용자 화면에서는 `업무`, `파일럿 보드`, `결과 카드`, `사용 여부`, `주의표현`, `사람 확인 필요`, `10일 결과표` 용어를 우선한다.
- 원문, 이메일, 회사명, 연락처, project access token, admin token, secret은 analytics/localStorage/log/bundle에 노출하지 않는다.
- 모든 핵심 화면은 숫자 중심이어야 한다.
```

## 3. 기존 규칙과의 관계

기존 규칙은 유지한다.

- 한국어 UI 유지
- 가짜 고객 로고/후기/인증/성과 수치 금지
- 실제 저장 성공 전 성공 메시지 금지
- secret 클라이언트 노출 금지
- keyboard accessibility 유지
- 320px 이상 가로 스크롤 금지
- 기능 변경 시 테스트 추가

## 4. 적용 task

- AP-SMVP-018 또는 첫 PR에서 문서만 먼저 적용 가능.


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```
