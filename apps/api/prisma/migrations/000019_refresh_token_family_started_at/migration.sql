-- SEC-131: refresh 토큰 family의 **절대 수명 상한**을 위한 기준 시각 컬럼.
--
-- 문제: 회전(POST /auth/refresh)마다 새 refresh 토큰의 exp가 `now + 30일`로 다시
-- 밀린다. family 단위 재사용 감지(000008)는 "훔친 토큰을 두 번 쓰면 family 전체 폐기"를
-- 보장하지만, **정상 회전만 계속되는 세션에는 끝이 없다** — 30일에 한 번씩만 앱을 열어도
-- 최초 로그인 한 번으로 만들어진 세션이 영구히 살아 있다. 기기 분실이나 조용한 토큰
-- 유출(재사용 없이 공격자만 회전)의 노출 창이 영원히 닫히지 않는다는 뜻이다.
-- 이제 family 최초 생성 시각 + REFRESH_FAMILY_MAX_AGE_DAYS(기본 90일)를 넘기면 회전을
-- 거부하고 재로그인을 강제한다(auth.service.ts refresh).
--
-- 왜 새 컬럼인가 — `MIN(created_at) GROUP BY family_id`로 유도할 수 없다:
-- 로그인 때 만들어진 family의 첫 행은 expires_at(생성 +30일)이 지나면 로그인마다 도는
-- 청소(refresh-token.store.ts deleteExpired: `DELETE ... WHERE expires_at < now()`)에
-- 지워진다. 상한이 30일보다 길어서(90일) 판정이 필요한 시점에는 최초 행이 이미 없을 수
-- 있고, 남은 행들의 MIN(created_at)은 최근 회전 시각에 가까워 상한이 회전할 때마다 뒤로
-- 밀린다 — 상한이 없는 것과 같아진다. 그래서 회전 시 승계되는 값을 행에 직접 들고 간다.
--
-- 000009~000018과 같은 additive 관례: ADD COLUMN IF NOT EXISTS + 안전한 기본값.
-- 기존 마이그레이션(000001~000018)은 수정하지 않는다.
--
-- 기본값 now()는 신규 행(로그인)에 정확하고, 아래 UPDATE가 **기존 행에 한해** 같은
-- family 안에서 지금 살아 있는 가장 이른 created_at으로 되돌린다. 이미 첫 행이 청소된
-- 오래된 family는 실제보다 늦은 시각이 잡힐 수 있지만(= 상한이 조금 관대해짐), 어차피
-- 런칭 전이라 그런 family 자체가 없고, 이 백필은 "상한이 아예 없던 상태"보다 항상 엄격하다.
--
-- 인덱스는 추가하지 않는다: 상한 판정은 언제나 jti 유니크 조회로 이미 뽑아 둔 단일 행의
-- 컬럼을 보는 것이라 family_started_at을 술어로 쓰는 스캔이 없다.

-- 타입 표기는 이 테이블의 나머지 시각 컬럼(000001)과 같은 무정밀도 `timestamptz`로 맞춘다
-- (Postgres 기본 정밀도가 6이라 schema.prisma의 @db.Timestamptz(6)과 동치).
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS family_started_at timestamptz NOT NULL DEFAULT now();

UPDATE refresh_tokens AS t
SET family_started_at = f.started_at
FROM (
  SELECT family_id, MIN(created_at) AS started_at
  FROM refresh_tokens
  GROUP BY family_id
) AS f
WHERE t.family_id = f.family_id
  AND t.family_started_at > f.started_at;
