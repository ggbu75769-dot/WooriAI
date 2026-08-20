-- NOTI-100 follow-up: POST /me/devices의 findFirst -> create 등록 흐름은 DB
-- 제약이 없어 동시 요청이 같은 (user_id, push_token) 기기 행을 중복 생성할 수
-- 있었다. (user_id, push_token) 유니크 인덱스를 추가해 DB가 최종 방어선이 되게
-- 하고, 컨트롤러는 P2002를 잡아 update로 재시도한다(devices.controller.ts).
-- push_token이 NULL인 행은 Postgres 기본(NULLS DISTINCT) 그대로 여러 개 허용 —
-- 토큰 없는 기기 행은 애초에 이 중복 판정의 대상이 아니다.
-- 000001~000009는 수정하지 않는다.

-- 1) 기존 중복 행 정리: 같은 (user_id, push_token) 쌍에서는 가장 최근에 갱신된
--    행(updated_at 최대, 동률이면 id가 큰 쪽)만 남기고 삭제한다 — 인덱스 생성이
--    기존 데이터 때문에 실패하지 않도록 선행한다.
DELETE FROM user_devices a
USING user_devices b
WHERE a.user_id = b.user_id
  AND a.push_token = b.push_token
  AND a.push_token IS NOT NULL
  AND a.id <> b.id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));

-- 2) 유니크 인덱스: 같은 사용자 + 같은 푸시 토큰 조합은 기기 행 하나만 존재한다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_devices_user_push_token
  ON user_devices (user_id, push_token);
