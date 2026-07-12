-- Round 5A Sprint 1 (round5a-sprint1-plan.md §1): 지출 낙관적 동시성(version)과
-- 관리자 TOTP MFA/쿠키 세션 기능을 위한 스키마 확장. 이 마이그레이션은 컬럼/테이블을
-- 추가만 하며(additive), 기존 데이터·제약에는 영향을 주지 않는다.

-- MOB-103: expenses 낙관적 동시성 락에 쓰일 버전 카운터. 생성 시 1, 이후 모든
-- 수정·soft delete마다 +1 (증가 로직은 후속 스프린트에서 API 레이어에 구현).
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- SEC-101: admin_users에 TOTP MFA 등록 상태를 저장. totp_secret은 base32 secret,
-- mfa_recovery_codes는 1회용 복구코드 해시 배열(JSONB), mfa_enabled_at은 MFA 등록
-- 완료 시각(NULL이면 미등록).
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_enabled_at timestamptz;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_recovery_codes jsonb;

-- SEC-102: 기존 Bearer/localStorage 토큰 대신 HttpOnly 쿠키 기반 관리자 세션을
-- 발급하기 위한 세션 테이블. token_hash는 랜덤 256bit 세션 토큰의 sha256 해시.
-- admin_user_id는 이 스키마의 기존 컨벤션(Prisma @relation 미사용, FK 제약 없는
-- plain uuid 컬럼)을 그대로 따른다.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  token_hash varchar(128) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  ip varchar(64),
  user_agent text,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
