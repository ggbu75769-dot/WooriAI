-- AgentProof Super MVP v1 DB Migration Blueprint
-- 적용 전 기존 migration과 충돌 여부를 확인한다.

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

create index if not exists proof_projects_org_status_idx
  on public.proof_projects(organization_id, status);

create index if not exists proof_cases_project_created_idx
  on public.proof_cases(project_id, created_at desc);

create index if not exists proof_feedbacks_project_status_idx
  on public.proof_feedbacks(project_id, feedback_status);

create index if not exists proof_reports_project_status_idx
  on public.proof_reports(project_id, status);

create index if not exists proof_jobs_project_status_idx
  on public.proof_jobs(project_id, status, created_at desc);

create index if not exists proof_job_items_job_status_idx
  on public.proof_job_items(job_id, status, row_number);

create index if not exists proof_events_session_created_idx
  on public.proof_events(session_id, created_at desc);

create index if not exists risk_reviews_event_idx
  on public.risk_reviews(event_id);
