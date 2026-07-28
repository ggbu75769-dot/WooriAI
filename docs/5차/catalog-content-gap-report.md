# Release 3 catalog content gap report

작성일: 2026-07-15

## 구현된 구조

- `ItemTemplate`에 content status/version/review/source note가 있다.
- `ItemContentSource`, `ItemContextTag`, `ItemTemplateContextTag` 정규화 schema와 index가 migration `000012_release3_foundation`에 있다.
- 예약 revision의 reviewer/author 분리와 CAS publish worker가 있다.
- 추천 ranking은 affiliate commission과 분리된 기존 계약을 유지한다.

## 출시 차단 gap

- 승인된 공공/전문 source URL과 검수일 데이터가 seed/import되어 있지 않다.
- context tag taxonomy와 item별 weight가 제품 소유자 승인 데이터로 연결되지 않았다.
- 의료·안전 문구의 법률/전문가 검수 증적이 없다.
- 링크 checker에 DNS rebinding/private IP 방어와 redirect hop/response-size 제한이 완결되지 않았다.
- source freshness SLA와 expired-content 자동 비노출 정책의 운영 검증이 없다.

따라서 schema/CMS 기반만 구현된 상태이며 “catalog content 완료”나 공개 출시 준비 완료로 판단하지 않는다.
