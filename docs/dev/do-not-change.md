# 우리아이 Do Not Change Contract

Source: `docs/4차/prompts/04_do_not_change_v0_4.md` and `docs/4차/contracts/do_not_change_contract_v0_4.yaml`  
Version: v0.4  
Repository overlay: v1.0 (2026-07-26)
Repo copy created: 2026-07-06  
Batch: 00 - Source Lock

This file is the repo-local copy of the WooriAI MVP Do Not Change contract. If implementation pressure conflicts with this file, stop and document the requested change for PM/Tech Lead approval before modifying the locked behavior.

The repository overlay updates only decisions that were explicitly superseded by the current implementation contract and Android Pixel Lock. Historical source documents remain unchanged.

## Contract Rules

| ID | Area | Do Not Change | Reason |
| --- | --- | --- | --- |
| DNC-001 | Product Positioning | 우리아이는 "아이 비용 관리 + 시기별 준비템 구매 내비게이션"이다. 일반 가계부/쇼핑몰/커뮤니티 앱으로 포지션을 바꾸지 않는다. | Scope creep 방지 |
| DNC-002 | MVP Core Loop | 지출 기록 -> 총액 확인 -> 준비템 확인 -> 구매 링크 클릭 -> 구매 후 기록/상태 체크 루프를 흐리지 않는다. | 제품 검증 루프 보호 |
| DNC-003 | Bottom Tabs | 하단 탭은 홈/기록/준비템/리포트/더보기 5개로 유지한다. | 현재 앱 구조와 Android Pixel Lock 계약 보호 |
| DNC-004 | Screen IDs | SPL, AUTH, ONB, HOME, EXP, ITEM, REP, FAM, IMP, SET, ADM 화면 ID를 임의 변경하지 않는다. | 디자인/QA/API 매핑 보호 |
| DNC-005 | Tech Stack | React Native + Expo, NestJS, PostgreSQL + Prisma, Next.js Admin, TanStack Query + Zustand 조합을 임의 교체하지 않는다. | 3차 개발 고정 준수 |
| DNC-006 | API Base | API base path는 `/api/v1`, OpenAPI 기반 DTO/타입 생성을 유지한다. | 클라이언트/서버 계약 보호 |
| DNC-007 | Data Model | `users`, `households`, `household_members`, `children`, `expenses`, `budgets`, `item_templates`, `child_item_statuses`, `product_links`, `affiliate_clicks`, `import_jobs/import_rows`, `consents`, `audit_logs` 도메인을 삭제/의미 변경하지 않는다. | 리포트/권한/수익화 구조 보호 |
| DNC-008 | RBAC | `owner`, `co_parent`, `viewer`, `gift_participant` 역할과 권한 원칙을 바꾸지 않는다. | 가족 공유 신뢰 보호 |
| DNC-009 | Recommendation Trust | 추천 점수에 제휴수수료율을 직접 변수로 넣지 않는다. | 추천 신뢰 보호 |
| DNC-010 | Affiliate Disclosure | 구매 CTA 인접 위치에 "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요." 또는 승인된 동등 문구를 숨기지 않는다. | 법무/신뢰 보호 |
| DNC-011 | Sponsored Separation | 스폰서 상품은 일반 추천과 시각적으로 구분하고 광고/스폰서 표시를 한다. | 광고 투명성 보호 |
| DNC-012 | Excel Import Approval | 엑셀/CSV AI 분석 결과는 사용자 미리보기와 승인 전 `expenses`에 저장하지 않는다. | 돈 데이터 신뢰 보호 |
| DNC-013 | Money Rules | 지출 금액은 0보다 큰 원화 정수. 미래 지출, 다통화, 자동 환불은 MVP에서 임의 추가하지 않는다. | BR-101/102 보호 |
| DNC-014 | Soft Delete | 지출 삭제는 soft delete + audit log로 처리한다. | 집계/감사 무결성 보호 |
| DNC-015 | Gift Handling | 선물 받은 물건은 기본 지출 합계에서 제외한다. | 리포트 정확성 보호 |
| DNC-016 | Out of Scope | 사진/영수증 AI, 커뮤니티, 가격 추적, 중고 연동, 보험/금융 제휴, 의료 조언은 MVP에 구현하지 않는다. | MVP 집중 |
| DNC-017 | Design Tokens | MOD_V1/native-v1.0 canonical인 Primary `#C94627`, Secondary `#267A68`, Background `#FFFDFC`, Text Primary `#211E1C`를 임의 교체하지 않는다. | 현재 코드·native branding·Pixel 기준의 브랜드 일관성 보호 |
| DNC-018 | UX Copy Tone | 저장/예산/제휴/빈화면 등 고정 UX 문구는 해요체와 쉬운 문장 톤을 유지한다. | 감성/신뢰 보호 |
| DNC-019 | Secrets | 실제 OAuth secret, 제휴 ID, 운영 DB URL을 코드/seed/test에 하드코딩하지 않는다. | 보안 보호 |
| DNC-020 | Medical Claims | 영양제/의료용품/병원 관련 추천에서 진단·치료·의학적 효능을 단정하지 않는다. | 법무 리스크 방지 |

## Implementation Checklist

Before each batch report, answer:

- screen ids preserved: yes/no
- API base preserved: yes/no
- affiliate disclosure preserved: yes/no
- recommendation commission excluded: yes/no
- import preview-before-save preserved: yes/no

If a batch does not touch a surface, answer based on whether the repo still preserves the locked contract and clearly note that the surface was not implemented or modified in that batch.

## Repository Overlay Migration Record

- Phase 2의 `#FF8A7A / #7DDCC7 / #FFF8F1 / #242424`는 historical legacy token이다.
- 신규 화면과 문서 검토는 `#C94627 / #267A68 / #FFFDFC / #211E1C`를 기준으로 한다.
- 기존 flat theme key는 현재 canonical token으로 redirect하는 호환 alias로만 유지할 수 있다.
- 하단 탭 계약은 현재 `AGENTS.md`와 앱 구현에 맞춰 5개 탭으로 고정한다.
