# 16. 상태머신 / 점수 / 판정 로직 설계서

## 1. Proof Project 상태

```txt
ready → active → report_draft → report_review → report_published → converted/closed
                    ↓
               recheck_needed
```

## 2. Proof Session 상태

```txt
test_ready → active → completed
   ↓           ↓
cancelled   cancelled
```

## 3. Proof State

```txt
diagnosed
→ test_ready
→ active_proof
→ low_adoption_risk / risk_restricted / template_revision_needed / conversion_ready
→ passed / conditional_pass / retest / failed
```

## 4. Proof Score 공식

현재 `proofCore.calculateProofScore`의 축을 유지한다.

| 축 | 점수 | 설명 |
|---|---:|---|
| adoptionScore | 20 | 사용건수/처리건수 목표 달성 |
| efficiencyScore | 25 | 절감시간 비율과 일관성 |
| qualityScore | 20 | draft usage rate와 human edit burden |
| contractConformanceScore | 20 | 금지행위/사람확인 기준 준수 |
| riskControlScore | 15 | severe/medium risk와 human review rate |
| expansionScore | 0 | P1 이후 |
| 합계 | 100 | finalProofScore |

## 5. BoardMetrics 계산

| 지표 | 공식 |
|---|---|
| processedCount | resultCards.length |
| actualCaseCount | non-sample cards |
| utilizationRate | actualCaseCount / caseLimit |
| copyRate | copied + used statuses / processed |
| draftUsageRate | used_as_is + used_with_edits / processed |
| usedWithEditsRate | used_with_edits / processed |
| notUsedRate | not_used / processed |
| estimatedSavedMinutes | sum conservativeSavedMinutes |
| riskFlagCount | sum riskFlags.length |
| humanReviewCount | sum humanReviewRequired.length |
| reportReliability | 처리건수 + feedback rate 기반 |

## 6. Verdict

| 조건 | Verdict | UI |
|---|---|---|
| usage < 5 | failed 또는 insufficient_data | 데이터 부족/운영 비추천 |
| severe hard block 있음 + score >= 60 | conditional_pass | 조건부 운영 가능 |
| score >= 80, hard block 없음 | passed | 운영 가능 |
| score >= 60 | conditional_pass | 조건부 운영 가능 |
| score >= 40 | retest | 재검증 필요 |
| else | failed | 운영 비추천 |

## 7. Hard block

- 가격 확정 + 사람 확인 없음
- 납기 확정 + 사람 확인 없음
- 계약/법률 판단
- 외부 AI 모드에서 개인정보 위험
- 자동 발송 표현
- 10일 완료 후 사용건수 5건 미만

## 8. Report reliability

| 신뢰도 | 조건 |
|---|---|
| 낮음 | actualCaseCount < 5 |
| 보통 | actualCaseCount 5~19 또는 feedback rate < 50% |
| 높음 | actualCaseCount >= 20, feedback rate >= 50%, risk/human gate 집계 가능 |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
