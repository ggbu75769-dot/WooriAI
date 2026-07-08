# 우리아이 Phase 4 Do Not Change Contract v0.4

Codex는 아래 항목을 임의 변경하지 않는다. 변경이 필요하면 먼저 PM/Tech Lead 승인 요청 문서를 남긴다.

| ID | Area | Do Not Change | Reason |
| --- | --- | --- | --- |
| DNC-001 | Product Positioning | 우리아이는 “아이 비용 관리 + 시기별 준비템 구매 내비게이션”이다. 일반 가계부/쇼핑몰/커뮤니티 앱으로 포지션을 바꾸지 않는다. | Scope creep 방지 |
| DNC-002 | MVP Core Loop | 지출 기록 → 총액 확인 → 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태 체크 루프를 흐리지 않는다. | 제품 검증 루프 보호 |
| DNC-003 | Bottom Tabs | 하단 탭은 홈/기록/준비템/리포트 4개로 유지한다. | 2차 화면 고정 준수 |
| DNC-004 | Screen IDs | SPL, AUTH, ONB, HOME, EXP, ITEM, REP, FAM, IMP, SET, ADM 화면 ID를 임의 변경하지 않는다. | 디자인/QA/API 매핑 보호 |
| DNC-005 | Tech Stack | React Native + Expo, NestJS, PostgreSQL + Prisma, Next.js Admin, TanStack Query + Zustand 조합을 임의 교체하지 않는다. | 3차 개발 고정 준수 |
| DNC-006 | API Base | API base path는 /api/v1, OpenAPI 기반 DTO/타입 생성을 유지한다. | 클라이언트/서버 계약 보호 |
| DNC-007 | Data Model | users, households, household_members, children, expenses, budgets, item_templates, child_item_statuses, product_links, affiliate_clicks, import_jobs/import_rows, consents, audit_logs 도메인을 삭제/의미 변경하지 않는다. | 리포트/권한/수익화 구조 보호 |
| DNC-008 | RBAC | owner, co_parent, viewer, gift_participant 역할과 권한 원칙을 바꾸지 않는다. | 가족 공유 신뢰 보호 |
| DNC-009 | Recommendation Trust | 추천 점수에 제휴수수료율을 직접 변수로 넣지 않는다. | 추천 신뢰 보호 |
| DNC-010 | Affiliate Disclosure | 구매 CTA 인접 위치에 “이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.” 또는 승인된 동등 문구를 숨기지 않는다. | 법무/신뢰 보호 |
| DNC-011 | Sponsored Separation | 스폰서 상품은 일반 추천과 시각적으로 구분하고 광고/스폰서 표시를 한다. | 광고 투명성 보호 |
| DNC-012 | Excel Import Approval | 엑셀/CSV AI 분석 결과는 사용자 미리보기와 승인 전 expenses에 저장하지 않는다. | 돈 데이터 신뢰 보호 |
| DNC-013 | Money Rules | 지출 금액은 0보다 큰 원화 정수. 미래 지출, 다통화, 자동 환불은 MVP에서 임의 추가하지 않는다. | BR-101/102 보호 |
| DNC-014 | Soft Delete | 지출 삭제는 soft delete + audit log로 처리한다. | 집계/감사 무결성 보호 |
| DNC-015 | Gift Handling | 선물 받은 물건은 기본 지출 합계에서 제외한다. | 리포트 정확성 보호 |
| DNC-016 | Out of Scope | 사진/영수증 AI, 커뮤니티, 가격 추적, 중고 연동, 보험/금융 제휴, 의료 조언은 MVP에 구현하지 않는다. | MVP 집중 |
| DNC-017 | Design Tokens | Primary #FF8A7A, Secondary #7DDCC7, Background #FFF8F1 등 디자인 토큰을 임의 교체하지 않는다. | 브랜드 일관성 보호 |
| DNC-018 | UX Copy Tone | 저장/예산/제휴/빈화면 등 고정 UX 문구는 해요체와 쉬운 문장 톤을 유지한다. | 감성/신뢰 보호 |
| DNC-019 | Secrets | 실제 OAuth secret, 제휴 ID, 운영 DB URL을 코드/seed/test에 하드코딩하지 않는다. | 보안 보호 |
| DNC-020 | Medical Claims | 영양제/의료용품/병원 관련 추천에서 진단·치료·의학적 효능을 단정하지 않는다. | 법무 리스크 방지 |
