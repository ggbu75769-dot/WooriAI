# 28. 카피라이팅 / Empty State 문구집

## 1. 핵심 카피

```txt
AI 도입 여부를 감으로 정하지 마세요.
10일 동안 실제 업무로 증명하세요.
```

```txt
진단은 끝났습니다.
이제 실제 업무를 넣고 10일 Proof Board를 시작하세요.
```

```txt
붙여넣으면 결과 카드가 나오고,
10일이 지나면 운영 판단표가 남습니다.
```

## 2. CTA

| 위치 | Primary | Secondary |
|---|---|---|
| Landing | 무료 업무 검증 시작 | 10일 Proof Test 보기 |
| Survey Result | 10일 Proof Board 바로 만들기 | 샘플 Board 보기 |
| Board Empty | 첫 업무 붙여넣기 | 샘플로 먼저 보기 |
| Dashboard | 10일 결과표 보기 | 오늘 5건 더 입력하기 |
| Report | 운영 전환 문의 | 결과표 공유하기 |

## 3. 상태 문구

| 상태 | 문구 |
|---|---|
| no input | 아직 검증한 업무가 없습니다. 첫 업무를 붙여넣으면 결과 카드가 만들어집니다. |
| processing | 결과 카드를 만드는 중입니다. 위험표현과 누락정보를 함께 확인합니다. |
| low risk | 바로 초안으로 활용할 수 있지만 최종 확인은 사람이 해야 합니다. |
| human review | 사람 확인이 필요한 표현이 있습니다. 발송 전 담당자가 확인하세요. |
| blocked | 이 결과는 그대로 사용할 수 없습니다. 개인정보 또는 금지 표현이 감지되었습니다. |
| report low | 아직 데이터가 부족합니다. 업무 5건 이상을 넣으면 판단이 쉬워집니다. |
| report high | 충분한 사용 기록이 쌓였습니다. 운영 전환 판단에 사용할 수 있습니다. |

## 4. 위험표현 문구

- 가격 확정 표현이 있습니다.
- 납기 보장처럼 보이는 문장이 있습니다.
- 계약/법률 판단으로 오해될 수 있습니다.
- 환불/보상 확정 표현이 있습니다.
- 개인정보가 포함되어 마스킹이 필요합니다.
- 자동 발송을 암시하는 표현이 있습니다.

## 5. Report verdict 문구

| Verdict | 문구 |
|---|---|
| passed | 제한된 범위에서 운영 가능성이 확인되었습니다. |
| conditional_pass | 성과는 확인됐지만 사람 확인 조건이 필요합니다. |
| retest | 가능성은 있으나 더 많은 실제 업무 검증이 필요합니다. |
| failed | 현재 데이터로는 운영 전환을 추천하기 어렵습니다. |
| insufficient_data | 아직 판단할 만큼의 사용 기록이 부족합니다. |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
