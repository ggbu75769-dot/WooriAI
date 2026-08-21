-- PUSH-113 후속(적대 리뷰 M-2): 예산 경계(80%/100%) 푸시의 동시성 레이스 제거.
-- 기존 디스패치는 "usedBefore = usedAfter - 이번 지출액" 역산으로 경계 통과를
-- 판정했는데, 동시 지출 2건이면 중복 발송(둘 다 통과 판정)과 누락(둘 다 미통과
-- 판정)이 모두 가능했다. 이 테이블은 (아이, 월, 경계)당 1행의 "발송 클레임"을
-- 저장한다: usedAfter가 경계 이상일 때 INSERT ... ON CONFLICT DO NOTHING으로
-- 클레임을 시도하고, 클레임에 성공한 요청만 발송한다. unique 제약이 중복을,
-- usedBefore 역산 제거가 누락을 구조적으로 없앤다 (push-dispatch.service.ts).
--
-- 000011~000012와 동일하게 additive-only: 기존 마이그레이션은 수정하지 않는다.
--
-- ON DELETE CASCADE: 아이 물리 파기(data-retention-purge.job.ts purgeChildRows의
-- child.deleteMany)가 이 테이블 때문에 FK 위반으로 막히지 않도록 마크는 아이와
-- 함께 자동 삭제된다 — purge 코드 수정 불필요. 마크에는 개인정보가 없고
-- (child_id + 월 + 경계 정수뿐), 아이가 사라지면 존재 이유도 사라진다.
CREATE TABLE IF NOT EXISTS push_boundary_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  -- 'YYYY-MM' (예: '2026-08') — Asia/Seoul 기준 월 (getSeoulMonthRange).
  year_month varchar(7) NOT NULL,
  -- 경계 백분율: 80 또는 100 (애플리케이션이 이 두 값만 기록한다).
  boundary int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_push_boundary_marks UNIQUE (child_id, year_month, boundary)
);
