-- Round 5A Sprint 2 (round5a-sprint2-plan.md §1): CMS 초안 검토 흐름(COM-103), 카카오
-- OIDC 서버 검증 트랜잭션(AUTH-101), 분석 이벤트 원본 저장(ANA-101), 제휴 opaque
-- redirect(COM-106)를 위한 스키마 확장. additive 마이그레이션이며 기존 데이터·제약에는
-- 영향을 주지 않는다.

-- COM-103: CMS 초안(draft) → 검토(review) → 게시(publish) 리비전 이력.
-- entity_id는 신규 생성 초안일 때 NULL(게시 시 실제 엔티티 id로 확정).
CREATE TABLE IF NOT EXISTS content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(32) NOT NULL,
  entity_id uuid,
  revision_no integer NOT NULL,
  payload jsonb NOT NULL,
  status varchar(16) NOT NULL,
  author_admin_id uuid NOT NULL,
  reviewer_admin_id uuid,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_revisions_entity_revision
  ON content_revisions(entity_type, entity_id, revision_no);
CREATE INDEX IF NOT EXISTS idx_content_revisions_status ON content_revisions(status);
CREATE INDEX IF NOT EXISTS idx_content_revisions_entity ON content_revisions(entity_type, entity_id);

-- AUTH-101: 카카오 OIDC 서버 검증용 1회성 트랜잭션(state/nonce/PKCE). TTL 10분,
-- consumed_at으로 재사용(replay) 방지.
CREATE TABLE IF NOT EXISTS oauth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(16) NOT NULL,
  state varchar(64) NOT NULL UNIQUE,
  nonce_hash varchar(128) NOT NULL,
  code_challenge varchar(128),
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_transactions_expires_at ON oauth_transactions(expires_at);

-- ANA-101: 클라이언트 분석 이벤트 envelope 원본 저장. PII 금지는 애플리케이션 레이어의
-- 레지스트리·zod strict 스키마가 강제(이 테이블은 저장소일 뿐).
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name varchar(64) NOT NULL,
  event_version integer NOT NULL,
  event_id uuid NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  user_anon_id varchar(64),
  household_anon_id varchar(64),
  app_version varchar(32),
  platform varchar(16),
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_occurred ON analytics_events(event_name, occurred_at);

-- COM-106: 제휴 opaque redirect 코드. 기존 행은 랜덤 코드로 backfill한 뒤
-- NOT NULL + UNIQUE 제약을 건다(동일 마이그레이션 트랜잭션 내에서 안전하게 처리).
-- DEFAULT를 함께 걸어두는 이유: redirect_code는 이번 스프린트의 스키마 확장 범위이고,
-- 이 컬럼을 채우는 API 로직(COM-106)은 후속 작업이다. 그 전까지 기존
-- product_links.create 경로(예: 관리자 상품링크 생성)가 값을 명시하지 않아도 NOT NULL
-- 제약을 어기지 않도록 DB 레벨 기본값을 둔다.
ALTER TABLE product_links ADD COLUMN IF NOT EXISTS redirect_code varchar(16);

UPDATE product_links
SET redirect_code = substr(md5(gen_random_uuid()::text), 1, 12)
WHERE redirect_code IS NULL;

ALTER TABLE product_links ALTER COLUMN redirect_code SET DEFAULT substr(md5(gen_random_uuid()::text), 1, 12);
ALTER TABLE product_links ALTER COLUMN redirect_code SET NOT NULL;

ALTER TABLE product_links ADD CONSTRAINT uq_product_links_redirect_code UNIQUE (redirect_code);
