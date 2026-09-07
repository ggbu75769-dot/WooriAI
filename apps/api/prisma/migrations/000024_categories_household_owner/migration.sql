-- 라운드 103 T1: 커스텀 지출 카테고리 — docs/5차/round103-custom-expense-category-design.md §1.
--
-- 별도 표를 만들지 않는 이유는 §1.1(대안 A) — `expenses.category_id`가 NOT NULL FK라
-- `categories` 밖의 id는 지출에 저장될 수 없고 그 칸을 비울 수도 없다. 그래서 소유자 칸을
-- 이 표에 더한다: **NULL = 오늘의 운영 시드 21행 · NOT NULL = 그 가구가 만든 분류.**
--
-- 000018과 같은 additive 관례(그 파일이 스스로 "DNC-007 준수"라고 적은 조건 목록과 글자
-- 단위로 같다): **컬럼·색인 추가만** 한다 — 행 삭제 없음, 기존 id 불변, code 불변,
-- active/selectable 불변. 000011~000023과 동일하게 재실행 안전(IF NOT EXISTS)이고 기존
-- 마이그레이션(000001~000023)은 수정하지 않는다.

-- 가구 물리 파기(data-retention-purge.job.ts의 household.deleteMany)가 이 표 때문에 FK
-- 위반으로 막히지 않도록 가구와 함께 자동 삭제된다 — custom_items(000022)·
-- category_budgets(000023)의 child_id 캐스케이드와 같은 관례다(§1.8).
-- created_by_user_id는 **두지 않는다**(§1.8): NOT NULL user FK를 더하면 사용자 파기 잡의
-- findReferenceBlockedUserIds·selectPurgeableStubs 두 자리에 NOT EXISTS 한 줄씩을 같은
-- 목록으로 더해야 하고, 빠뜨리면 이 표가 사용자 파기를 조용히 막는 새 자리가 된다.
-- 행위자·시각은 감사 로그(custom_category.update)가 답한다.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE CASCADE;

-- 가구 목록 조회는 언제나 (household_id) 단일 술어다(§2.2의 OR 갈래). 시드 21행은 NULL이라
-- 부분 색인에 들지 않는다 — 색인 크기가 커스텀 행 수만큼만 자란다.
CREATE INDEX IF NOT EXISTS idx_categories_household
  ON categories(household_id) WHERE household_id IS NOT NULL;

-- 이름 중복은 서비스가 먼저 400 CUSTOM_CATEGORY_NAME_DUPLICATE로 막지만(§1.4), 마지막
-- 방어선은 DB가 진다. 정규화(trim + 소문자)를 색인 식에 그대로 적는다 — 서비스와 같은 규칙.
-- ⚠️ 이 색인이 지키는 것은 §1.4의 비교 모집단 **②(그 가구의 커스텀 행)뿐**이다. ①(시드 21행의
-- 이름)은 household_id IS NULL이라 부분 색인 밖이고, 그 축은 서비스 검사가 유일한 방어선이다
-- (그 사실을 test/custom-categories.e2e.test.ts가 값으로 문다).
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_household_name
  ON categories(household_id, lower(btrim(name))) WHERE household_id IS NOT NULL;

-- is_system은 000018이 "시스템 시드 vs 사용자 정의"라고 이미 뜻을 적어 둔 칸이다. 그 뜻과
-- 소유자 칸이 갈리지 않도록 DB가 등호의 **한 방향**을 진다: 가구가 소유한 행은 결코
-- 시스템 시드일 수 없다.
--
-- ⚠️ 두 시점 (설계 §1의 초안 → 이 파일) — 설계는 이 자리에 **양방향 등호**
-- `CHECK ((household_id IS NULL) = is_system)`를 적었고, 근거로 "오늘 21행 전부
-- (household_id IS NULL, is_system = true)라 검증은 즉시 통과한다"를 들었다. 그 실측이
-- 틀렸다: 시드는 정식 12행만 `is_system = true`이고, 모바일 퀵타일 별칭 8 + 가져오기 스텁 1
-- 은 **`is_system = false`로 시드된다**(prisma/seed.ts의 별칭 upsert — 그 아홉 행은 시스템이
-- 만들었지만 시드 코드가 그 칸을 false로 적는다). 양방향 등호는 그 아홉 행에서 곧바로
-- 위반이라 마이그레이션 자체가 실패한다. 그래서 이 라운드가 실제로 지켜야 하는 방향
-- (커스텀 행이 시스템 시드를 자처하지 못한다)만 남긴다 — 반대 방향(`is_system = false`이면
-- 가구 소유다)은 오늘 참이 아니고, 그 아홉 행의 is_system 값을 바꾸는 것은 additive가 아니다.
--
-- 귀결 하나를 함께 적어 둔다: `is_system = false`는 **커스텀 행의 충분조건이 아니다**
-- (별칭·스텁 9행이 이미 false다). 커스텀 행을 가리는 유일한 술어는 `household_id`이고,
-- 응답에서도 그 칸이 표식이다(§2.2의 가산 필드).
ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS chk_categories_owner_is_system;
ALTER TABLE categories
  ADD CONSTRAINT chk_categories_owner_is_system CHECK (household_id IS NULL OR is_system = false);
