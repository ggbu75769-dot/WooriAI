# Release 4 Admin 분류체계 운영 설계 및 실행 결과

작성: 2026-07-16 KST  
범위: Release 4 카탈로그 `domain/category/subcategory` 운영

## 다음 개선 사항 도출

기존 Admin은 카탈로그 coverage와 품목 상태는 보여 주지만 분류체계를 변경할
수단이 없었다. 운영자가 새 분류를 추가하거나 이름을 교정하려면 DB를 직접
수정해야 했고, 참조 중인 분류를 잘못 제거하거나 여러 운영자가 순서를 덮어쓸
위험이 있었다.

기존 품목 편집 import 이후 남은 저장소 내부 P0 중 다음 수직 슬라이스를
분류체계 운영으로 선택했다. 신규 품목 import까지 한 번에 확장하지 않고,
기존 `CatalogNode.active/version`을 재사용해 migration 없이 닫을 수 있는
범위로 제한했다.

## 설계 불변식

- 3단계 계층과 안정적인 `Cxx[-xx[-xx]]` 코드를 유지한다.
- 물리 삭제는 제공하지 않는다. 보관은 `active=false`와 version 증가로 남긴다.
- 활성 하위 분류, 직접 품목 매핑, domain coverage 결정이 하나라도 있으면
  보관을 차단한다.
- 생성·수정·보관·정렬은 기존 Admin 세션, CSRF, MFA, RBAC와 감사 로그를
  그대로 사용한다.
- 생성·수정·정렬은 `admin/editor`, 실제 보관은 `admin`만 수행한다.
- 수정과 보관은 `expectedVersion`이 일치할 때만 반영한다.
- 순서 변경은 활성 형제 전체를 정확히 한 번씩 제출해야 하며 모든 version을
  검증한 뒤 한 트랜잭션에서 10 단위 display order로 반영한다.
- 순서 변경은 품목 매핑·추천 순위·coverage 상태를 바꾸지 않는다.

## 운영 UX

1. 트리에서 depth, 직접/하위 포함 품목 수, 활성 하위 수와 version을 본다.
2. 단계와 상위 분류를 선택해 계층 규칙에 맞는 분류를 생성한다.
3. 이름과 설명을 수정한다. 동시 변경이면 저장을 거부하고 재로딩을 요구한다.
4. 위/아래 이동은 즉시 저장하지 않고 변경 order를 먼저 보여 준다.
5. 보관 전 영향 미리보기에서 차단 이유와 연결 수를 확인한다.
6. 참조가 없는 leaf만 관리자가 보관한다. 데이터는 삭제하지 않는다.

## API

| Method | Route | 역할 |
| --- | --- | --- |
| GET | `/admin/catalog/taxonomy/tree` | 활성 트리와 참조 집계 조회 |
| POST | `/admin/catalog/taxonomy/nodes` | 계층 검증 후 분류 생성 |
| PATCH | `/admin/catalog/taxonomy/nodes/:id` | version 기반 이름·설명·아이콘 수정 |
| POST | `/admin/catalog/taxonomy/nodes/:id/archive-preview` | 참조와 보관 차단 사유 계산 |
| POST | `/admin/catalog/taxonomy/nodes/:id/archive` | Admin 전용 논리 보관 |
| POST | `/admin/catalog/taxonomy/reorder-preview` | 활성 형제 전체와 version 검증 |
| POST | `/admin/catalog/taxonomy/reorder` | 형제 순서 원자적 반영 |

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| API/Admin typecheck | PASS |
| Admin 전체 테스트 | PASS, 6 files / 30 tests |
| Catalog Admin PostgreSQL E2E | PASS, 3 tests |
| 계층 생성과 depth 집계 | PASS |
| stale version 수정 | 충돌 차단 PASS |
| 품목 연결 leaf 보관 | 영향 표시 및 차단 PASS |
| 활성 형제 전체 순서 변경 | preview/원자 적용/재조회 PASS |
| 참조 없는 leaf 논리 보관 | PASS |
| API production build | PASS, main/publisher/worker bundles |
| Admin production build | PASS, 16 static pages; `/catalog` 8.36 kB |

이번 변경은 Admin/API 전용이므로 Android Pixel Lock은 실행하지 않았다. 전체
release gate도 반복하지 않고 변경 범위의 타입·테스트·PostgreSQL·프로덕션
빌드를 검증했다.

## 남은 Admin P0와 다음 순서

운영 큐 상세 목록, 대상 이동, 신고 일괄 해결과 eligible 링크 재검사 상태는
후속 수직 슬라이스에서 완료했다. R4-P0-005는 아직 `PARTIAL`이며 신규
품목·분류 import, 고위험 검수 workbench, R4 네이티브 offer health/가격
provider 연결이 남아 있다.
