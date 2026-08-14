-- COM-105: 제휴 링크 헬스체크. 죽었거나 redirect가 깨진 상품 링크는 전환을 조용히
-- 죽이므로, 워커 잡(link_health)이 주기적으로 affiliate_url을 확인한 결과를
-- product_links에 기록하고 관리자 링크 화면에 노출한다.
-- additive 마이그레이션이며 기존 행에는 영향이 없다(새 컬럼은 모두 NULL = 미확인).
-- 000001~000008은 수정하지 않는다.
--
-- health_status 값 의미(src/worker/jobs/link-health.job.ts와 동일):
--   'ok'       최종 응답 2xx/3xx (redirect는 최대 5홉까지 추적)
--   'broken'   4xx 또는 5홉을 넘는 redirect 체인/루프
--   'unstable' 5xx/타임아웃/네트워크 오류 (다음 라운드에 재시도)
--   NULL       아직 확인 전(미확인)
ALTER TABLE product_links ADD COLUMN IF NOT EXISTS health_status varchar(16);
ALTER TABLE product_links ADD COLUMN IF NOT EXISTS health_checked_at timestamptz;
