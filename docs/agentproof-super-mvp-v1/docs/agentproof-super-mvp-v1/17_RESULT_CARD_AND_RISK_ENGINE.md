# 17. Result Card / Risk Engine 설계서

## 1. Result Card의 역할

Result Card는 AgentProof의 최소 가치 단위다. 사용자는 결과 카드 하나에서 “이 업무를 AI로 처리해도 되는지”를 즉시 판단한다.

## 2. Result Card 정보 구조

```txt
상태 chip + 제목
한 줄 요약
초안
누락정보
주의표현
사람 확인 필요
절감시간
사용 여부 버튼
```

## 3. Risk flag 분류

| type | label | severity |
|---|---|---|
| `price_commitment` | 가격 확정 표현 | high |
| `delivery_commitment` | 납기 확정 표현 | high |
| `contract_commitment` | 계약/법률 판단 | critical |
| `refund_or_compensation` | 환불/보상 확정 | high |
| `privacy` | 개인정보/민감정보 | critical |
| `auto_send` | 자동 발송 | critical |
| `customer_trust` | 고객 신뢰 위험 | medium |
| `missing_info` | 누락정보 | low/medium |

## 4. 추천 수정 문구

| 위험 | 추천 |
|---|---|
| 가격 확정 | “담당자 확인 후 안내드리겠습니다.” |
| 납기 확정 | “가능 일정은 물류/생산 확인 후 안내드리겠습니다.” |
| 계약 판단 | “계약 관련 사항은 담당자 검토 후 안내드리겠습니다.” |
| 환불/보상 | “내부 기준 확인 후 처리 가능 여부를 안내드리겠습니다.” |
| 개인정보 | “개인정보는 입력하지 말고 담당 부서에 문의해 주세요.” |
| 자동 발송 | “최종 발송 전 담당자 확인이 필요합니다.” |

## 5. Copy allowed 정책

- low/medium: copy allowed, warning 표시.
- high: copy allowed but human review required 강조.
- blocked/critical privacy/auto_send: copy disabled 또는 masked draft만 copy.

## 6. 사용 여부 버튼

| UI | 내부 값 | 지표 반영 |
|---|---|---|
| 그대로 사용 | `used_as_is` | draftUsageRate + saved minutes |
| 수정 후 사용 | `used_with_edits` | draftUsageRate + edit burden |
| 복사만 함 | `copied_only` | copyRate만 |
| 안 씀 | `not_used` | notUsedRate |

## 7. Acceptance

- 위험표현이 있는 카드는 위험 chip이 반드시 표시된다.
- 사람이 확인해야 할 항목은 초안보다 아래에 숨기지 않는다.
- blocked 카드는 copy 버튼이 disabled 또는 safe draft only다.
- feedback 클릭은 중복 클릭해도 idempotent하게 처리한다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
