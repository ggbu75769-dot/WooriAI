-- Round 5A Sprint 2 (round5a-sprint2-plan.md §4, COM-106): 공개 opaque redirect
-- (GET /r/:code)는 인증이 필요 없으므로 클릭을 남기는 시점에 로그인한 사용자/가구/아이
-- 컨텍스트가 아예 없을 수 있다. additive 마이그레이션이며 기존 행(모두 값이 채워져
-- 있음)에는 영향이 없다: NOT NULL만 해제하고, FK 제약은 그대로 둔다(NULL이 아닌 값에는
-- 여전히 참조 무결성이 적용된다). 000001~000007은 수정하지 않는다.

ALTER TABLE affiliate_clicks ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE affiliate_clicks ALTER COLUMN household_id DROP NOT NULL;
ALTER TABLE affiliate_clicks ALTER COLUMN child_id DROP NOT NULL;
