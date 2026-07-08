# 23. 10일 결과표 / 운영 전환 명세서

## 1. Report 목적

10일 결과표는 예쁜 보고서가 아니라 대표/팀장이 월 19만 원 운영 전환 여부를 판단하는 의사결정 화면이다.

## 2. Report 필수 필드

- project id
- work name/type
- period
- proof score
- verdict
- processed count
- feedback breakdown
- saved minutes
- risk count
- human review count
- reliability
- allowed scope
- excluded scope
- next action
- conversion CTA

## 3. 전환 로직

| 조건 | CTA |
|---|---|
| passed | 월 19만 원 운영 전환 추천 |
| conditional_pass | 조건부 운영 전환 상담 추천 |
| retest | 재검증 후 운영 전환 검토 |
| failed | 업무 범위 재설계 권장 |
| insufficient_data | 데이터 추가 입력 권장 |

## 4. Conversion payload

```ts
type ProofConversionRequestPayload = {
  kind: 'proof_conversion_request';
  projectId: string;
  projectAccessToken: string;
  reportId?: string;
  requestedPlan: 'single_work_190000';
  resultType: 'pass' | 'conditional_pass' | 'retest' | 'fail' | 'insufficient_data';
  recommendedPlan: 'single_work_190000';
  pricePlan: 'single_work_190000';
  planPrice: 190000;
  sourceCta: string;
  decisionMakerMemo?: string;
  email?: string;
};
```

## 5. Report publish guard

- draft는 admin만.
- review는 admin만.
- published만 report_view token으로 열람 가능.
- recheck_needed는 공개 링크에서 “재검증 필요”로 표시하거나 차단.

## 6. Acceptance

- report에는 5개 핵심 숫자가 첫 화면에 보인다.
- report 전환 CTA는 reportId/projectId/verdict를 포함한다.
- conversion request는 raw text를 포함하지 않는다.
- report view scope mismatch는 차단한다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
