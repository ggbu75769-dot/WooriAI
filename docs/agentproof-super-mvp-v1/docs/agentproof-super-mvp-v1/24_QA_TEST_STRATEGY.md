# 24. QA / 테스트 전략서

## 1. 기본 명령

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:security
pnpm build
```

## 2. 테스트 계층

| 계층 | 대상 |
|---|---|
| Unit | proofCore scoring, risk review, result card, redaction |
| Contract | Edge payload kinds, error shape, access guard |
| Integration | create board from survey, text intake, feedback, report |
| E2E | survey result → board → card → feedback → dashboard → report |
| Security | secret/token/raw text leakage, CORS, PII |
| Visual | landing, survey result, board, dashboard, report mobile/desktop |

## 3. 필수 E2E 시나리오

### E2E-001 중복 설문 제거

```txt
무료 진단 결과 페이지에서 CTA 클릭
→ /proof/pilot-design/questions를 거치지 않음
→ /proof/board 진입
→ 첫 입력 가능
```

### E2E-002 첫 결과 카드

```txt
Board 진입
→ sample 또는 text 입력
→ ResultCard 생성
→ 4개 사용 여부 버튼 표시
```

### E2E-003 feedback metrics

```txt
ResultCard에서 수정 후 사용 클릭
→ Board KPI 사용률/수정후 사용률 업데이트
→ dashboard에도 반영
```

### E2E-004 report guard

```txt
unpublished report_view 접근 차단
published report + report_view token 접근 허용
board_access token으로 report-only 접근 차단
```

### E2E-005 privacy

```txt
개인정보 포함 입력
→ 마스킹/차단 표시
→ analytics/log/localStorage에 원문 없음
```

## 4. Visual checkpoints

- `/` desktop/mobile
- `/survey/result` desktop/mobile
- `/proof/board` empty/with cards/mobile
- `/proof/dashboard` with summary
- `/proof/report` published
- `/admin/dashboard`

## 5. Acceptance

- 새 기능은 테스트 없이 완료 금지.
- UI 변경은 최소 1개 E2E 또는 visual assertion 필요.
- 보안/개인정보 관련 변경은 `test:security` 필수.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
