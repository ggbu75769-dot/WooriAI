-- PERF-119: 라운드18 FIX-118B가 도입한 크로스계정 푸시 클레임
-- (devices.controller.ts claimPushToken)의 인덱스 보강. 000011/000012/000014와
-- 동일한 additive CREATE INDEX IF NOT EXISTS 관례이며 000001~000014는 수정하지
-- 않는다. 런칭 전이라 CONCURRENTLY 미사용(000011·000014와 동일).
--
-- 문제: claimPushToken은 기기 등록/갱신 트랜잭션마다
--   UPDATE user_devices SET notification_enabled = false
--    WHERE push_token = $1 AND user_id <> $2 AND notification_enabled = true
-- 를 실행하는데, user_devices의 기존 인덱스는 PK(id), idx_user_devices_user_id,
-- 그리고 000010의 uq_user_devices_user_push_token (user_id, push_token)뿐이다.
-- 복합 유니크의 선두 컬럼이 user_id라 push_token 단독 술어에는 사용할 수 없어
-- 등록 요청 한 건마다 user_devices 전체를 seq scan 한다. POST /me/devices는
-- 앱 부팅·권한 변경·토큰 로테이션마다 호출되는 상시 경로다.
--
-- 실측 (wooriai_perf_r19 스크래치 DB, user_devices 50,500행 — 기기 5만 대 +
-- 계정 전환으로 같은 토큰을 공유하는 행 500쌍, ANALYZE 후 3회 측정):
--   before: Seq Scan, 8.2~11.5ms / shared hit 829, Rows Removed by Filter 50,498
--   after : Index Scan using idx_user_devices_push_token,
--           스캔 노드 0.06~0.13ms / shared hit 7, 전체 UPDATE 0.33~0.59ms
-- 토큰당 매치 행이 1~2건뿐이라 인덱스가 술어를 그대로 흡수한다(잔여
-- notification_enabled/user_id 조건은 힙 필터). 인덱스 크기 3.3MB(5만 행).
--
-- push_token 단일 컬럼으로 두는 이유: (push_token, notification_enabled) 복합은
-- 토큰당 매치가 이미 1~2행이라 이득이 없고, `WHERE push_token IS NOT NULL` 부분
-- 인덱스는 토큰 없는 기기 행을 제외해 더 작아지지만 Prisma @@index로 표현할 수
-- 없다. 이 인덱스는 schema.prisma에 @@index로 함께 선언해 스키마와 DB를
-- 일치시키는 쪽을 택했다(000011의 부분 인덱스 2건과 반대 판단).

CREATE INDEX IF NOT EXISTS idx_user_devices_push_token
  ON user_devices (push_token);
