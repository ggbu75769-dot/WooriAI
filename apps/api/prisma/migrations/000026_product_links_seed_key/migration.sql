-- 라운드 107 트랙 E — `product_links`의 **안정 시드 식별자**. 정찰 S5 D3 ②
-- (docs/5차/round106-scout-s5-data.md:178~).
--
-- 무엇을 고치는가. 시드는 자기 행을 `(item_template_id, platform, title)`로 찾아 왔다.
-- 그 셋은 전부 어드민 편집 축이다(AdminUpdateProductLinkDto: itemTemplateId? · platform? ·
-- title? · url? — 이 표에는 오늘 운영자가 못 고치는 콘텐츠 컬럼이 하나도 없다). 그래서
-- 운영자가 링크 이름을 한 글자만 고쳐도 다음 배포의 시드가 그 행을 자기 것으로 알아보지
-- 못하고 두 번째 링크를 만들었다.
--
-- 실측(임시 DB, 마이그레이션 000001~000025 적용 → 시드 1회 → 링크 제목 1건 편집 →
-- 재시드 1회): product_links 67 → 68행. car_seat/coupang 링크가 **둘 다 active**로 남아
-- 준비템 상세에 같은 상품의 구매 CTA가 둘 뜨고, CSV 일괄 교체 도구
-- (admin/product-link-bulk.service.ts)는 (itemTemplate, platform)에 **정확히 1건**을
-- 요구하므로 그 링크를 더는 고칠 수도 없다.
--
-- 키의 모양은 `<item_templates.code>:<platform>`이다(값은 prisma/seed-data.ts의
-- productLinkSeedKey가 정한다). 지어낸 규칙이 아니라 위 CSV 도구가 이미 쓰던 식별자이고,
-- 오늘 시드 링크 67건의 그 쌍은 67개로 전부 다르다(실측).
--
-- 000018·000022~000025와 같은 additive 관례: **컬럼·색인 추가만** 한다 — 행 삭제 없음,
-- 기존 id 불변, 기존 값 불변, 재실행 안전(IF NOT EXISTS), 기존 마이그레이션 무수정.
-- 기존 행의 값은 여기서 채우지 않는다: 어느 행이 어느 시드 링크인지는 seed-data.ts의
-- 목록만 아는데, 그 목록 67줄을 SQL에 한 번 더 베껴 두면 그 사본이 다음 라운드에 낡는다.
-- 대신 시드가 첫 실행에서 한 번 **입양**한다(seed.ts의 matchSeedProductLink — 제목 →
-- URL → 그 쌍의 가장 오래된 행 순, seed_key 한 칸만 쓰고 콘텐츠는 손대지 않는다).
--
-- ✅ **되돌릴 수 있다** — 000024가 스스로 "롤백 안전지대가 없다"고 적은 것과 다르다.
--   ① 코드만 롤백: 이전 빌드의 시드는 이 컬럼을 모르고 종전대로 (item, platform, title)로
--      매칭한다. 컬럼은 남지만 아무도 읽지 않아 무해하고, 운영 조회 경로(GET /items/:id ·
--      /r/:code · 어드민 목록·CSV)는 이 컬럼을 처음부터 보지 않는다. 잃는 것은 하나뿐이다 —
--      롤백 기간에 링크 이름을 고치면 종전의 중복 결함이 그대로 재현된다(즉 되돌림의 비용은
--      "고쳐진 것이 다시 고장난다"이지 데이터 손상이 아니다).
--   ② 마이그레이션 롤백(DROP COLUMN + DROP INDEX): 사라지는 것은 "어느 행이 어느 시드
--      링크인가"의 매핑뿐이고 **행·콘텐츠는 그대로**다. 그 매핑은 위 입양 사다리가 다시
--      만들 수 있으므로 앞으로 굴려도 복구된다.
-- 그래서 이 마이그레이션에는 "되돌리면 사용자 데이터가 구별 불가능해지는" 자리가 없다.

ALTER TABLE product_links
  ADD COLUMN IF NOT EXISTS seed_key varchar(120);

-- 부분 유니크: 시드가 만들지 않은 링크(운영자가 어드민에서 만든 행)는 NULL로 남고 색인에
-- 들지 않는다 — 색인 크기가 시드 링크 수(오늘 67)만큼만 자란다. 유일성은 시드가 시작할 때
-- 시드 데이터 안에서 먼저 확인하지만(어느 두 줄이 부딪혔는지 이름으로 말한다), 마지막
-- 방어선은 DB가 진다: 같은 키를 두 행이 갖는 순간 "시드가 자기 행을 하나로 찾는다"라는
-- 이 설계의 전제가 깨지기 때문이다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_links_seed_key
  ON product_links(seed_key) WHERE seed_key IS NOT NULL;
