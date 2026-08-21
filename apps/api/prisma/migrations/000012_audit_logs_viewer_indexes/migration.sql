-- ADM-113: 어드민 감사 로그 뷰어. audit_logs 테이블 자체는 000001부터 존재하고
-- AuditLoggerService가 이미 기록 중이므로 additive 인덱스만 추가한다
-- (000011_perf_indexes와 동일한 CREATE INDEX IF NOT EXISTS 관례, 000001~000011은
-- 수정하지 않는다).
--
-- 1) 전체 목록 기본 정렬: ORDER BY created_at DESC, id DESC (+ 기간 필터
--    created_at BETWEEN). 기존 인덱스는 (household_id, created_at) /
--    (target_type, target_id) 뿐이라 전역 시간순 조회는 seq scan + sort였다.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at, id);

-- 2) 액션 타입 필터: WHERE action = ? ORDER BY created_at DESC.
--    선두 컬럼 action 등호 조건 후 created_at 순서를 그대로 타므로 정렬이 필요 없다.
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs (action, created_at);

-- 3) 관리자(행위자) 필터: WHERE actor_user_id = ? ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON audit_logs (actor_user_id, created_at);
