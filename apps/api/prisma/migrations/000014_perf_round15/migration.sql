-- PERF-115: EXPLAIN 전수 감사(라운드15)에서 확정된 인덱스 보강. 000011/000012와
-- 동일한 additive CREATE INDEX IF NOT EXISTS 관례이며 000001~000013은 수정하지
-- 않는다. 감사 판정·확신도 요약은 docs/operations/perf-index-notes.md의
-- "PERF-115 (000014)" 절 참고. 런칭 전이라 CONCURRENTLY 미사용(000011과 동일).

-- 1) 파기 워커 4단계 스텁 후보 선정 + 3단계 참조 차단 검사
--    (data-retention-purge.job.ts selectPurgeableStubs / findReferenceBlockedUserIds):
--    NOT EXISTS (SELECT 1 FROM expenses e WHERE e.created_by_user_id = u.id)
--    안티조인이 expenses.created_by_user_id 무인덱스라 최대 볼륨 테이블(expenses)을
--    후보 행마다 풀스캔한다. 단일 컬럼 인덱스로 anti-join 프로브가 index-only로 풀린다.
CREATE INDEX IF NOT EXISTS idx_expenses_created_by
  ON expenses (created_by_user_id);

-- 2) attachments 보조 인덱스 (예방): attachments에는 PK 외 인덱스가 0개인데
--    파기 캐스케이드가 30초 트랜잭션 안에서 expense_id IN (...) UPDATE
--    (deleteExpensesHard의 FK 널링)와 child_id IN (...) DELETE(purgeChildRows)를
--    수행한다. 첨부가 쌓이면 배치당 풀스캔 x2가 트랜잭션 타임아웃 예산을 잠식한다.
CREATE INDEX IF NOT EXISTS idx_attachments_expense
  ON attachments (expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_child
  ON attachments (child_id);
