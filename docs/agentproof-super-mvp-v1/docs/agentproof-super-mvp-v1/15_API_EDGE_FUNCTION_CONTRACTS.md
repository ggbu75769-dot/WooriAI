# 15. API / Supabase Edge Function 계약서

## 1. 원칙

현재 GitHub Pages에는 server route가 없으므로 운영 write/read는 Supabase Edge Function을 통해 처리한다. `NEXT_PUBLIC_SURVEY_API_URL` 또는 proof endpoint 환경변수에 설정된 Edge Function만 운영 경로다.

## 2. 현재 proof-submit kind 확장 정책

현재 `proof-submit`은 여러 `kind` payload를 처리한다. Super MVP에서는 다음 kind를 확정한다.

| kind | 용도 |
|---|---|
| `proof_pilot_design_session` | legacy design session 생성 |
| `proof_pilot_design_answers` | optional advanced settings 저장 |
| `proof_pilot_design_draft` | workProfile draft 저장 |
| `proof_application` | 파일럿 신청 |
| `admin_application_decision` | 관리자 승인/거절 |
| `proof_text_intake` | 단건 업무 입력 |
| `proof_csv_intake` | CSV/XLSX 업로드 접수 |
| `proof_quick_feedback` | 1클릭 사용 여부 |
| `admin_report_review` | report review/publish |
| `proof_conversion_request` | 운영 전환 문의 |
| `proof_data_request` | 개인정보 권리 요청 |
| `admin_raw_source_audit` | 원문 접근 감사 |

## 3. 추가할 read/action kind

| kind | 용도 |
|---|---|
| `proof_create_board_from_survey` | survey result 기반 board 생성 |
| `proof_project_summary` | Board/Dashboard summary read |
| `proof_report_view` | report_view scope로 report read |
| `proof_job_status` | CSV job status read |
| `proof_token_exchange` | raw token → short session context |

## 4. `proof_create_board_from_survey`

```ts
type ProofCreateBoardFromSurveyPayload = {
  kind: 'proof_create_board_from_survey';
  surveyResultId?: string;
  importedContext?: {
    persona?: string;
    recommendedWorkType?: string;
    riskDomains?: string[];
    score?: number;
  };
  companyName?: string;
  contactName?: string;
  email?: string;
  idempotencyKey: string;
};
```

### Response

```ts
type ProofCreateBoardFromSurveyResponse = {
  ok: true;
  projectId: string;
  boardAccessToken?: string; // raw token only once
  workProfileId: string;
  proofSessionId?: string;
  boardUrl: string;
};
```

## 5. `proof_project_summary`

```ts
type ProofProjectSummaryPayload = {
  kind: 'proof_project_summary';
  projectId: string;
  projectAccessToken: string;
};
```

Response는 `ProofProjectSummary`를 반환한다.

## 6. Error shape

```ts
type ProofErrorResponse = {
  ok: false;
  errorCode: string;
  errorMessage: string;
  traceId: string;
  retryable?: boolean;
};
```

## 7. 보안 계약

- raw token은 저장하지 않는다.
- email/phone은 encrypted 저장.
- analytics payload에 email/company/raw text 금지.
- CORS allowed origins만 허용.
- idempotencyKey 필수.
- projectId/token scope/status/expiry 검증.
- report view는 `report_view` scope + report published 필요.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
