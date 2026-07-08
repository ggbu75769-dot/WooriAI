# 14. 데이터 모델 / Supabase 설계서

## 1. Source of truth

Super MVP에서 실제 운영 데이터의 source of truth는 Supabase Postgres다. localStorage는 demo/cache/fallback 용도로만 사용한다.

## 2. 현재 핵심 테이블

| 테이블 | 역할 |
|---|---|
| `organizations` | 고객 회사 |
| `users` | 참여자/관리자 |
| `pilot_design_sessions` | legacy 파일럿 설계 세션 |
| `work_profiles` | 고객 업무 정의 |
| `proof_applications` | 파일럿 신청 |
| `proof_projects` | Proof Board 운영 단위 |
| `project_members` | 접근 token hash/role |
| `input_intakes` | 입력 원문 수신/마스킹 |
| `file_uploads` | CSV/XLSX 업로드 증거 |
| `file_import_rows` | 업로드 row |
| `proof_cases` | 결과 카드 생성 대상 업무 |
| `proof_ai_outputs` | AI 출력 구조 |
| `proof_feedbacks` | 사용 여부 |
| `proof_reports` | 10일 결과표 |
| `conversion_requests` | 운영 전환 문의 |
| `work_contracts` | 허용/금지/사람 확인 기준 |
| `proof_sessions` | 10일 proof 기간 |
| `proof_events` | 실제 proof event |
| `risk_reviews` | 위험 분석 |
| `human_edit_burdens` | 수정 부담 |
| `time_saving_estimates` | 절감시간 |
| `proof_scores` | 점수 |
| `proof_verdicts` | 판정 |
| `evidence_ledgers` | 최종 증거 원장 |

## 3. 추가 테이블

CSV/XLSX 비동기 처리를 위해 추가한다.

```sql
create table if not exists public.proof_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.proof_projects(id) on delete cascade,
  job_type text not null check (job_type in ('csv_import','bulk_recheck','report_build')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  total_items integer not null default 0,
  processed_items integer not null default 0,
  failed_items integer not null default 0,
  error_code text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.proof_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.proof_jobs(id) on delete cascade,
  row_number integer not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','blocked')),
  input_hash text,
  case_id uuid references public.proof_cases(id) on delete set null,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, row_number)
);
```

## 4. Summary read model

Board/Dashboard/Report hydration을 위해 Edge에서 다음 shape를 반환한다.

```ts
type ProofProjectSummary = {
  project: { id: string; status: string; startDate: string; endDate: string; caseLimit: number };
  workProfile: { id: string; workName: string; workType: string; workTypeLabel: string };
  metrics: BoardMetrics;
  proofScore?: ProofScore;
  verdict?: Verdict;
  recentResultCards: ResultCard[];
  riskBreakdown: Array<{ category: string; count: number; severeCount: number }>;
  humanGateSummary: { requiredCount: number; satisfiedCount: number; missingCount: number };
  report?: { id: string; status: string; reliability: string; publishedAt?: string };
};
```

## 5. 필수 인덱스

```sql
create index if not exists proof_projects_org_status_idx on public.proof_projects(organization_id, status);
create index if not exists proof_cases_project_created_idx on public.proof_cases(project_id, created_at desc);
create index if not exists proof_feedbacks_project_status_idx on public.proof_feedbacks(project_id, feedback_status);
create index if not exists proof_reports_project_status_idx on public.proof_reports(project_id, status);
create index if not exists proof_jobs_project_status_idx on public.proof_jobs(project_id, status, created_at desc);
create index if not exists proof_job_items_job_status_idx on public.proof_job_items(job_id, status, row_number);
create index if not exists proof_events_session_created_idx on public.proof_events(session_id, created_at desc);
create index if not exists risk_reviews_event_idx on public.risk_reviews(event_id);
```

## 6. Data retention

- raw file: 기본 delete_after_parse.
- raw text: encrypted 또는 redacted, analytics/log 금지.
- hash/excerpt/sanitized summary만 report에 사용.
- raw source admin access는 reason/audit 필수.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
