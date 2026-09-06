-- 라운드 100 T1: 커스텀 품목(사용자 직접 추가 준비물) — docs/5차/round100-custom-items-design.md §1.
--
-- 별도 테이블인 이유(§1.1): `item_templates`는 소유자 컬럼 없는 전 가구 공용 운영 시드라
-- (어드민 CRUD·시드·링크 헬스·CSV 벌크가 전부 무필터로 읽는다) 소유자 컬럼을 더하면 필터를
-- 한 자리만 빠뜨려도 교차 가구 유출이다. 상태(`item_status`)를 행에 내장하는 이유(§1.2):
-- `child_item_statuses.item_template_id`는 SQL FK로 item_templates(id)를 참조해(000001)
-- 커스텀 id를 그 표에 넣을 수 없고, 커스텀 품목은 그 아이 하나의 것이라 (품목, 아이)가
-- 항상 1:1이다 — 별도 상태 표가 필요 없다.
--
-- child_id ON DELETE CASCADE: 아이 물리 파기(data-retention-purge.job.ts purgeChildRows의
-- child.deleteMany)가 이 테이블 때문에 FK 위반으로 막히지 않도록 아이와 함께 자동 삭제된다
-- (push_boundary_marks의 000013 관례와 동일 — §1.5).
--
-- created_by/updated_by는 users(id)를 캐스케이드 없이 참조한다 — child_item_statuses
-- .updated_by_user_id와 같은 모양이라, 사용자 물리 파기 잡의 참조 차단 검사
-- (findReferenceBlockedUserIds · selectPurgeableStubs)에 이 표가 같은 방식으로 편입된다
-- (§1.5 T1 체크리스트 — 검사에 없으면 이 FK가 사용자 파기를 조용히 막는 새 자리가 된다).
-- deleted_by_user_id는 FK 없이 uuid만 둔다: 파기 후에도 남을 수 있는 값이라 잡이
-- expenses.deleted_by_user_id와 같은 방식으로 null로 끊는다.
--
-- 000011~000021과 동일하게 additive-only·재실행 안전(IF NOT EXISTS): 기존 마이그레이션은
-- 수정하지 않는다.
CREATE TABLE IF NOT EXISTS custom_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 아이 물리 파기 시 함께 삭제 (위 머리말).
  child_id            uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name                varchar(80) NOT NULL,            -- item_templates.name과 같은 폭 (§1.2)
  stage_band          varchar(20) NOT NULL,            -- "0-6개월" 등 밴드 라벨 원문 (§1.3)
  necessity_level     necessity_level NOT NULL DEFAULT 'essential',
  status              item_status NOT NULL DEFAULT 'not_prepared',
  created_by_user_id  uuid NOT NULL REFERENCES users(id),
  updated_by_user_id  uuid NOT NULL REFERENCES users(id),
  deleted_at          timestamptz,
  deleted_by_user_id  uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 목록 합류가 매번 도는 조회(살아 있는 행, 생성 순) 전용 부분 인덱스 (§1).
CREATE INDEX IF NOT EXISTS idx_custom_items_child_active
  ON custom_items(child_id, created_at) WHERE deleted_at IS NULL;
