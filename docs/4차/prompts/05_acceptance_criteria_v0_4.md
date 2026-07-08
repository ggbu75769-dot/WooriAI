# 우리아이 Phase 4 Acceptance Criteria v0.4

아래 기준은 PR merge, QA pass, 릴리즈 후보 판정에 사용한다.

| AC ID | Module | Priority | Criteria |
| --- | --- | --- | --- |
| AC-GLOBAL-001 | Global | P0 | pnpm lint, pnpm typecheck, pnpm test가 통과해야 한다. 실패 시 실패 이유와 미해결 범위를 문서화한다. |
| AC-GLOBAL-002 | Global | P0 | 주요 API는 OpenAPI 3.1 문서와 일치해야 한다. 앱은 생성 타입 또는 공유 DTO를 사용한다. |
| AC-GLOBAL-003 | Global | P0 | 모든 화면은 Loading, Empty, Data, Error, Offline/Permission 상태 중 필요한 상태를 처리한다. |
| AC-GLOBAL-004 | Global | P0 | 한국어 UX 문구는 해요체와 쉬운 표현을 사용한다. |
| AC-AUTH-001 | Auth/Consent | P0 | 필수 약관/개인정보 동의 전에는 가입 완료/온보딩 진입이 불가하다. |
| AC-AUTH-002 | Auth/Consent | P0 | 토큰은 안전 저장소에 저장하고 refresh/logout이 동작한다. |
| AC-ONB-001 | Onboarding | P0 | 신규 사용자는 임신/출산/수동 단계 선택 후 4단계 이하로 HOME-001에 진입한다. |
| AC-ONB-002 | Onboarding | P0 | 예정일/생년월일/수동 단계에 따라 child_stage_code가 정확히 계산된다. |
| AC-HOME-001 | Home | P0 | 홈은 누적 금액, 이번 달 사용액/예산, 준비템 3~5개, 최근 기록 3개를 표시한다. |
| AC-HOME-002 | Home | P0 | 기록 저장/수정/삭제 후 홈 금액이 즉시 갱신된다. |
| AC-EXP-001 | Expense | P0 | 품목 선택→금액 입력→저장이 정상 네트워크에서 10초 이내 가능하다. |
| AC-EXP-002 | Expense | P0 | 금액은 0보다 큰 정수만 허용하고 미래 날짜는 제한한다. |
| AC-EXP-003 | Expense | P0 | 삭제된 지출은 리포트에서 제외되며 audit log에 남는다. |
| AC-BUD-001 | Budget | P0 | 월 예산은 아이 프로필 단위로 Asia/Seoul 월 경계 기준 집계된다. |
| AC-REP-001 | Report | P0 | 월별/누적/카테고리 총액은 홈 금액과 일치한다. 삭제/선물 기본 제외. |
| AC-ITEM-001 | Items | P0 | 현재 아이 단계 기준 준비템이 추천 점수 순으로 노출된다. |
| AC-ITEM-002 | Items | P0 | 이미 준비/필요 없음 상태는 지금 필요 탭에서 제외된다. |
| AC-ITEM-003 | Items | P0 | 모든 준비템은 필수/편의/선택 중 하나의 등급을 가진다. 선택/편의는 안 사도 되는 경우 설명이 있다. |
| AC-AFF-001 | Affiliate | P0 | 구매 링크 클릭 전 또는 CTA 인접 위치에 제휴 고지가 보인다. |
| AC-AFF-002 | Affiliate | P0 | 구매 링크 클릭 시 affiliate_clicks 로그가 저장된다. |
| AC-AFF-003 | Affiliate | P0 | 추천 순위는 제휴수수료율에 직접 영향받지 않는다. |
| AC-FAM-001 | Family | P1 | owner만 가족 초대/삭제가 가능하다. co_parent는 지출 추가 가능, viewer는 리포트 조회만 가능하다. |
| AC-FAM-002 | Family | P1 | 초대 수락 후 공동부모가 추가한 지출이 같은 아이 리포트에 반영된다. |
| AC-IMP-001 | Excel Import | P1 | xlsx/csv만 허용하고 10MB 또는 2,000행 초과 시 안내한다. |
| AC-IMP-002 | Excel Import | P1 | AI 분석 결과는 사용자 승인 전 expenses 테이블에 저장되지 않는다. |
| AC-IMP-003 | Excel Import | P1 | 신뢰도 0.70 미만은 기본 미선택이며 중복 후보가 표시된다. |
| AC-ADM-001 | Admin | P0 | 관리자는 준비템/상품 링크/고지 문구를 앱 배포 없이 수정할 수 있다. |
| AC-PRIV-001 | Privacy | P0 | 계정 삭제, 가구 탈퇴, 아이 프로필 삭제 플로우가 분리되어 있고 영향 범위가 고지된다. |
| AC-ACCESS-001 | Accessibility | P0 | 주요 터치 영역은 44px 이상, CTA 권장 높이는 56px이며 고지 문구를 지나치게 작게 숨기지 않는다. |
