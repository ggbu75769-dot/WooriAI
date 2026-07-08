# 20. Analytics / Events / Funnel 설계서

## 1. 원칙

- analytics에는 비식별 이벤트만 보낸다.
- email, companyName, raw text, token, memo 금지.
- 이벤트는 제품 개선과 전환 퍼널 분석에만 사용한다.

## 2. 핵심 이벤트

| event | source | metadata |
|---|---|---|
| `survey_result_board_cta_clicked` | survey result | persona, scoreBucket, recommendedWorkType |
| `proof_board_created_from_survey` | result/start | projectId hash/ref, workType |
| `proof_board_viewed` | board | dayNumber, projectStatus |
| `proof_first_input_submitted` | board | inputType, workType |
| `proof_result_card_created` | board | riskLevel, source, latencyBucket |
| `proof_feedback_clicked` | board | feedbackStatus, riskLevel |
| `proof_dashboard_viewed` | dashboard | processedBucket, proofScoreBucket |
| `proof_report_viewed` | report | status, verdict |
| `proof_conversion_requested` | report/convert | verdict, recommendedPlan |
| `proof_security_block_shown` | board | riskType, severity |

## 3. Funnel metrics

| Metric | Formula |
|---|---|
| Board creation rate | board created / survey completed |
| First card rate | first result card / board created |
| Feedback rate | feedback clicked / result cards |
| 10-day completion | report draft/published / board created |
| Conversion request rate | conversion request / report viewed |

## 4. Product KPIs

- first result card time
- processed count
- draft usage rate
- saved minutes
- risk signal count
- human review count
- report reliability
- proof score distribution

## 5. 금지 metadata

```txt
email
phone
companyName
contactName
rawText
aiOutput
finalUsedOutput
projectAccessToken
adminToken
secret
memo
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
