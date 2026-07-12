DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('admin', 'editor', 'analyst');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Domain data (users/households/...) is still in-memory as of this phase, so rows
-- referenced by audit_logs.actor_user_id / household_id do not exist in Postgres
-- yet. audit_logs also now records admin actions, whose actor is an admin_users.id
-- rather than a users.id. Relax these to plain (unenforced) uuid columns so audit
-- writes for both end-user and admin actions can succeed during the transition;
-- domain-data migration in a later phase can reintroduce stricter FKs if desired.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_household_id_fkey;

-- user_id is intentionally NOT a foreign key to users(id): end-user accounts are
-- still in-memory as of this phase (see comment above), so real user ids issued by
-- the in-memory dev-login flow do not exist as rows in the users table yet.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  family_id uuid NOT NULL,
  jti uuid NOT NULL UNIQUE,
  token_hash varchar(128) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  display_name varchar(80) NOT NULL,
  role admin_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint varchar(120) NOT NULL,
  idem_key varchar(120) NOT NULL,
  request_hash varchar(128) NOT NULL,
  response_json jsonb,
  status_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT uq_idempotency_keys_user_endpoint_key UNIQUE (user_id, endpoint, idem_key)
);

CREATE TABLE IF NOT EXISTS disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(80) NOT NULL UNIQUE,
  text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_by varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
