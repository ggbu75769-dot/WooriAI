# Release 4 Admin 운영 큐 상세화 및 안전 작업 설계

작성: 2026-07-16 KST  
범위: Release 4 카탈로그 운영 큐 7종의 상세 조회, 대상 이동, 신고 처리와 링크 재검사

## 다음 개선 사항 도출

기존 Admin은 필수 메타데이터 누락, 검수 대기, 검수 만료, 중복 후보, 링크
차단·리콜, 가격 확인, 사용자 신고의 개수만 표시했다. 서버도 일부 큐에 원시
Prisma 행을 반환해 운영자가 어떤 품목을 고쳐야 하는지 안정적으로 찾기
어려웠다.

실제 자동 처리기를 감사한 결과 `product_link.health_check`는 legacy
`ProductLink`에만 연결되어 있었다. R4 네이티브 `ProductOffer` 가격 갱신이나
recall 자동 해제 처리기는 없다. 따라서 없는 기능을 “재시도”로 표시하지 않고,
실제 처리 경로가 있는 작업만 실행하도록 범위를 정했다.

## 설계 불변식

- 모든 큐는 `R4-*` 품목으로 제한하고 품목 ID·code·이름을 함께 반환한다.
- 7개 큐 모두 상세 원인과 대상 품목 이동을 제공한다.
- 고위험 검수, recall, blocked offer는 자동 일괄 승인하지 않는다.
- 가격 제공자가 없으므로 stale 가격은 수동 확인 대상으로 명시한다.
- 링크 재검사는 `healthState=failed`이고 legacy link가 연결된 offer만 가능하다.
- 동일 offer/version의 재검사는 같은 outbox dedupe key를 사용한다.
- 링크 작업 상태는 `available / queued / processing / dead_letter / unavailable`로
  구분한다. DLQ는 기존 운영 콘솔에서 재시도한다.
- 사용자 신고 일괄 해결은 1~100개의 서로 다른 open 신고 전체가 현재 상태와
  일치할 때만 한 트랜잭션으로 반영한다.
- 링크 재검사는 Admin만, 신고 해결은 Admin/Editor만 수행하며 모두 감사 로그를
  남긴다.

## 운영 UX

1. 7개 큐 카드 중 하나를 선택하면 상세 행을 표시한다.
2. 각 행의 `품목 보기`로 일반 품목 목록을 해당 code로 필터링하고 이동한다.
3. 신고 큐는 필요한 행을 선택해 한 번에 해결한다. 중간 상태 변경이 있으면
   전체 작업을 거부하고 다시 불러온다.
4. eligible 링크만 `링크 재검사`를 제공한다. 대기·처리·DLQ 상태에서는 새
   작업을 복제하지 않는다.
5. 네이티브 R4 링크, 가격, recall처럼 처리기가 없는 행은 자동화 불가 사유를
   그대로 보여 준다.

## API와 작업 연결

| Method | Route/topic | 역할 |
| --- | --- | --- |
| GET | `/admin/catalog/queues` | 타입화된 7개 상세 큐와 capability 반환 |
| POST | `/admin/catalog/reports/resolve-batch` | 선택한 open 신고를 원자적으로 해결 |
| POST | `/admin/catalog/offers/:id/retry-health-check` | eligible legacy link 검사 outbox 등록 |
| Worker | `product_link.health_check` | legacy health 결과를 연결된 R4 offer에 동기화 |
| Existing UI | `/operations` DLQ | 발행 후 실패한 재검사 작업 처리 |

DB migration이나 새 queue 상태 테이블은 추가하지 않았다. 기존 `JobOutbox`,
`DeadLetterJob`, `ProductLinkHealth`, `ProductOffer`를 재사용한다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| API/Admin typecheck | PASS |
| Admin 전체 테스트 | PASS, 6 files / 31 tests |
| Catalog Admin PostgreSQL E2E | PASS, 4 tests |
| R4 범위·누락 필드·대상 code 상세 | PASS |
| 중복 report ID와 이미 해결된 신고 | 전체 거부 PASS |
| 2개 open 신고 원자 해결 | PASS |
| 동일 링크 재검사 중복 요청 | 같은 outbox 반환 PASS |
| queued 상태 재조회 | 재실행 차단과 상태 표시 PASS |
| health handler 결과의 R4 offer 동기화 | `failed → healthy` PASS |
| API production build | PASS, main/publisher/worker bundles |
| Admin production build | PASS, 16 static pages; `/catalog` 10.3 kB |

이번 변경은 Admin/API/worker 경로에 한정되어 Android Pixel Lock은 실행하지
않았다. 전체 release gate도 반복하지 않고 변경 범위의 타입, 전체 Admin 테스트,
PostgreSQL E2E와 프로덕션 빌드를 검증했다.

## 남은 Admin P0와 다음 순서

R4-P0-005는 계속 `PARTIAL`이다. 운영 큐 상세 조회와 내부에서 검증 가능한 작업
연결은 완료했지만, R4 네이티브 offer health/가격 provider는 외부 연동 전까지
자동 재시도할 수 없다. 저장소 내부의 다음 수직 슬라이스는 84개 고위험 품목을
위한 검수 workbench다. 품목별 전문가 근거와 만료일을 요구하고, blanket
일괄 승인은 금지하며 작성자/검수자 분리를 유지한다.
