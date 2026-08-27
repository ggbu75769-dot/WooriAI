-- CAT-124: 카테고리 "노출 범위"를 서버 계약으로 표현한다.
--
-- 문제(docs/operations/known-limitations.md B절): `GET /categories`가 active=true 행을
-- 전부 돌려주는데, 시드는 세 묶음이다 —
--   * 정식 12개 (seed-data.ts `categorySeeds`)
--   * 모바일 퀵타일 별칭 8개 (`mobileCategoryAliasSeeds`, code 접두 `mobile_`)
--     — 모바일이 하드코딩한 UUID를 유효한 categoryId로 만들려고 만든 행
--   * 엑셀 가져오기 스텁 1개 (`importStubCategorySeeds`, code `import_stub_default`)
-- 합 21행. 사용자에게 고르라고 내밀 목록은 정식 12개뿐인데, 별칭은 뜻이 겹치지만 이름이
-- 달라("기저귀/위생" vs "기저귀") 클라이언트 동명 중복 제거로는 지울 수 없었다.
--
-- 해결: 행을 지우는 대신 **노출 여부 플래그를 더한다**. `is_system`을 재활용하지 않는
-- 이유는 그 컬럼이 "시스템 시드 vs 사용자 정의"라는 다른 뜻을 이미 갖고 있어서다
-- (별칭/스텁도 시스템이 만든 행이다). 뜻을 겹쳐 쓰면 DNC-007(도메인 의미 불변) 위반.
--
-- DNC-007 준수: **컬럼 추가만** 한다 — 행 삭제 없음, 기존 id 불변, active 불변.
-- 별칭·스텁 행은 그대로 살아 있어서
--   (a) 이미 그 id로 저장된 지출이 목록·리포트·CSV에서 계속 이름을 찾고,
--   (b) 8타일 빠른 입력과 오프라인 재전송이 그 id로 계속 지출을 만들 수 있다
--       (지출 생성/수정의 categoryId 검증은 selectable을 보지 않는다 —
--        expenses-store.service.ts `requireExistingCategory`).
-- 바뀌는 것은 "기본 목록 응답에 실리는가" 하나뿐이며, `?includeAll=1`로 전량 조회한다.
--
-- 000009~000017과 같은 additive 관례: ADD COLUMN IF NOT EXISTS + 안전한 기본값.
-- DEFAULT true라서 기존 21행은 일단 전부 노출 대상이 되고, 아래 UPDATE가 seed 코드
-- 기준으로 별칭 8 + 스텁 1만 false로 내린다(코드 목록을 명시해 LIKE 패턴 오탐 방지).
-- 기존 마이그레이션(000001~000017)은 수정하지 않는다.
--
-- 인덱스는 추가하지 않는다: categories는 시드 21행 규모라 플래너가 어차피 seq scan을
-- 고르고, 기존 idx_categories_active_order로 정렬은 이미 커버된다.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS selectable boolean NOT NULL DEFAULT true;

UPDATE categories
SET selectable = false, updated_at = now()
WHERE selectable = true
  AND code IN (
    -- mobileCategoryAliasSeeds (apps/api/prisma/seed-data.ts)
    'mobile_diaper_hygiene',
    'mobile_feeding_dairy',
    'mobile_feeding_meal',
    'mobile_clothes_laundry',
    'mobile_outing_mobility',
    'mobile_hospital_checkup',
    'mobile_toys_books',
    'mobile_etc',
    -- importStubCategorySeeds (apps/api/prisma/seed-data.ts)
    'import_stub_default'
  );
