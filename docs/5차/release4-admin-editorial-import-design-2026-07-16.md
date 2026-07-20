# Release 4 Admin 편집 메타데이터 import 설계 및 실행 결과

작성: 2026-07-16 KST  
범위: 기존 `R4-*` 품목의 편집 메타데이터 일괄 수정

## 문제와 범위 결정

Admin에는 coverage·운영 큐·개별 검수/게시와 별도의 콘텐츠 revision
이력/롤백이 이미 있었다. 반면 여러 품목의 설명과 출처를 행 단위로 검증하고
선택 적용하는 운영 경로는 없었고 `CatalogImport`도 업로드 메타데이터만
기록했다.

이번 수직 슬라이스는 새 품목이나 분류를 생성하지 않는다. 기존 품목 code를
기준으로 다음 5개 편집 필드만 갱신한다.

- `nameKo`
- `shortDescription`
- `reasonText`
- `timingSummary`
- `sourceSummary`

이 제한은 잘못된 파일이 분류·생애주기·안전 등급을 대량 변경하는 것을 막고,
현재 408개 기존 품목의 편집 병목부터 닫기 위한 것이다.

## 운영 흐름

1. 관리자 또는 편집자가 1~1,000행 JSON 파일을 선택한다.
2. 브라우저가 파일 SHA-256을 계산하고 서버에 구조화된 행을 보낸다.
3. 서버가 code 존재, Release 4 범위, 중복, 빈 필드, 길이, 실제 변경 여부를
   행별 검증한다.
4. UI가 유효/오류 행과 변경 필드를 preview하고 유효 행만 기본 선택한다.
5. 오류 행은 UTF-8 CSV로 내려받는다. `=`, `+`, `-`, `@` 시작 셀은 수식
   실행을 막도록 이스케이프한다.
6. 선택 적용은 한 DB 트랜잭션에서 import를 `ready → validating → applied`로
   claim한다. 실패하면 claim과 품목 수정이 함께 롤백된다.
7. 적용된 품목은 `draft`가 되고 기존 검수자/검수일은 제거된다. 다른 관리자가
   다시 검수한 뒤에만 게시할 수 있다.

## API

| Method | Route | 역할 |
| --- | --- | --- |
| POST | `/admin/catalog/imports/preview` | 행별 검증 결과와 import 상태 생성 |
| POST | `/admin/catalog/imports/:id/apply` | 선택한 유효 행을 원자적으로 적용 |
| GET | `/admin/catalog/imports/:id/errors.csv` | 오류 행 CSV export |

기존 HttpOnly admin session, CSRF, MFA와 `admin/editor` RBAC 경계를 그대로
사용한다. `CatalogImport.validationJson`을 재사용하므로 DB migration은 없다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| API typecheck | PASS |
| Admin typecheck | PASS |
| API production build | PASS, main/publisher/worker bundles |
| Admin 전체 테스트 | PASS, 6 files / 29 tests |
| Catalog Admin PostgreSQL E2E | PASS, 2 tests |
| Admin production build | PASS, 16 static pages |
| 잘못된 행 선택 적용 | 트랜잭션 롤백 PASS |
| 유효 행 선택 적용 | 1회 적용, draft/재검수 전환 PASS |
| 동일 import 재적용 | 충돌 차단 PASS |
| 오류 CSV 수식 주입 방어 | PASS |

## 아직 열려 있는 Admin P0

분류 트리 생성·수정·보관·정렬과 영향 미리보기는 다음 수직 슬라이스에서
완료했다. 상세 결과는 `release4-admin-taxonomy-operations-design-2026-07-16.md`를
따른다.

운영 큐 상세 이동, 신고 일괄 해결, eligible 링크 재검사 상태는 후속 수직
슬라이스에서 완료했다. 남은 항목은 다음과 같다.

1. 신규 품목·분류 생성 import
2. 고위험 근거 입력을 포함한 검수 workbench
3. R4 네이티브 offer health/가격 provider 연결

따라서 R4-P0-005 전체는 계속 `PARTIAL`이다.
