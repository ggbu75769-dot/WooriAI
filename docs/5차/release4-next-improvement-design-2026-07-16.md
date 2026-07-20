# Release 4 다음 개선 설계 및 1차 실행 결과

작성: 2026-07-16 KST  
판정 기준: 저장소 구현, 생성 번들 증거, 외부 배포 증거를 분리한다.

## 우선순위 도출

| 순위 | 개선 항목 | 선정 이유 | 이번 결과 |
| ---: | --- | --- | --- |
| 1 | 프로덕션 번들에서 로컬 fixture 완전 격리 | 실제 배포를 막는 P0이며 저장소 내부에서 독립적으로 닫을 수 있음 | 구현 및 production-shape HBC 스캔 PASS |
| 2 | Admin 카탈로그 운영 제품 완성 | 408개 항목의 검수·게시를 실행할 운영 병목 | 기존 품목 import·분류체계·운영 큐 수직 슬라이스 완료, 나머지 진행 중 |
| 3 | 직접 디자인 시스템 마이그레이션 | facade 사용률과 실제 마이그레이션 수치의 괴리를 제거 | Admin 이후 화면별 수직 슬라이스 |
| 4 | 카탈로그 전문 검수·상점 Offer | 출시 가치에 필수이나 승인 주체와 실제 상점 데이터가 필요 | 외부 입력 대기 |

## 1차 설계: 프로덕션 fixture 경계

### 문제

기존 앱은 `client.ts`뿐 아니라 앱 시작, 세션 저장소, 설정, 카테고리,
온보딩 경로가 `local-backend.ts` 또는 `local-fixtures.ts`를 직접 import했다.
따라서 환경 변수가 프로덕션이어도 Metro 의존성 그래프에 로컬 세션과 데모
데이터가 포함됐다.

### 경계 원칙

1. 앱 런타임은 `fixture-runtime.ts`만 참조한다.
2. production 프로필은 Metro resolver가 이를
   `fixture-runtime.production.ts`로 교체한다.
3. production 교체 모듈은 fixture 값을 갖지 않고, 로컬 백엔드 import도 하지
   않는다.
4. Pixel Lock/standalone/test 프로필은 기존 로컬 백엔드 동작을 보존한다.
5. 프로덕션 export는 HTTPS API URL 없이는 즉시 실패한다.
6. 최종 판정은 소스 검색이 아니라 생성된 Android Hermes 번들 바이트를
   금지 시그니처로 검사한다.

### 구현

- `apps/mobile/src/api/fixture-runtime.ts`: 내부 검증용 실제 fixture 어댑터
- `apps/mobile/src/api/fixture-runtime.production.ts`: production no-fixture 어댑터
- `apps/mobile/metro.config.js`: 명시적 production 교체와 HTTPS fail-closed
- `apps/mobile/src/api/prepared-item-ids.ts`: API 계약용 UUID를 fixture 파일에서 분리
- 앱 시작·세션·설정·카테고리·온보딩의 직접 fixture import 제거
- Pixel Lock 접근성 ID도 프로필별 어댑터를 통과하도록 변경
- Android APK/AAB/release gate 빌드 진입점에 `WOORIAI_BUILD_PROFILE` 명시
- `pnpm release4:contamination:export`: production export 생성 후 HBC 직접 검사
- 정적 회귀 테스트: production-reachable 경로의 직접 fixture import 재유입 차단

## 수용 기준과 결과

| 기준 | 결과 |
| --- | --- |
| production 프로필이 HTTPS API URL 없으면 실패 | PASS |
| production-reachable 코드가 local backend/fixture를 직접 import하지 않음 | PASS |
| 생성 Android HBC 금지 시그니처 0건 | PASS |
| 모바일 타입체크 | PASS |
| 모바일 전체 테스트 | PASS, 41 files / 275 tests |
| 엄격 UX 계약 | PASS, 37/37 facade/scaffold; 직접 마이그레이션 0/37은 그대로 공개 |
| 내부 standalone/test 동작 회귀 | 모바일 전체 테스트 PASS |

생성 번들:
`artifacts/release4-production-safe-export/_expo/static/js/android/entry-10ad3b9afc176d3ddf7290e3681168a2.hbc`  
크기: 3,609,027 bytes  
SHA-256: `18465C84338C39BBD73C97B34F515D333B4282D22CE36E0678992BC20FFC1586`

## 다음 구현 파동: Admin 운영 완성

다음 저장소 내부 P0는 Admin을 “페이지가 존재하는 상태”에서 “408개 항목을
실제로 검수·게시할 수 있는 운영 제품”으로 닫는 것이다.

1. 분류 트리 생성·수정·보관·정렬과 영향 미리보기 — 완료
2. 기존 품목 행 단위 import preview, 선택 적용, 오류 CSV export — 완료
3. 게시 전 고위험·출처·중복·coverage 검증 요약 — 부분 구현
4. 변경 이력과 롤백 — 기존 구현 확인
5. 검수 큐의 필터·일괄 선택·실패 재시도·감사 로그 — 남음

완료 기준은 Admin UI 존재 여부가 아니라, 대표 import 파일을 preview하고 일부
승인한 뒤 오류를 export하며, 게시·롤백 결과가 감사 로그에 남는 통합 테스트다.

### 2차 실행 결과

기존 `R4-*` 품목의 편집 메타데이터 JSON import에 대해 행별 preview, 유효 행
선택 적용, 오류 CSV export와 감사 로그를 구현했다. 적용은 원자적이며 품목을
`draft`로 되돌려 재검수를 강제한다. 상세 설계와 증거는
`release4-admin-editorial-import-design-2026-07-16.md`를 따른다.

### 3차 실행 결과

분류 트리 조회·생성·수정·논리 보관과 형제 순서 변경을 구현했다. 보관 전 활성
하위·품목 매핑·coverage 결정 영향을 보여 주고 참조가 있으면 차단한다. 정렬은
활성 형제 전체와 optimistic version을 검증한 뒤 원자 적용한다. 상세 설계와
증거는 `release4-admin-taxonomy-operations-design-2026-07-16.md`와
`artifacts/release4-admin-taxonomy-evidence.json`을 따른다.

### 4차 실행 결과

7개 운영 큐를 R4 품목으로 제한한 타입화된 상세 행으로 바꾸고, 대상 품목 이동,
사용자 신고 선택 원자 해결, eligible legacy 링크의 outbox 재검사와
`available/queued/processing/dead_letter/unavailable` 상태를 구현했다. 가격과
R4 네이티브 링크 처리기가 없다는 경계도 UI에 그대로 노출한다. 상세 설계와
증거는 `release4-admin-operations-queue-design-2026-07-16.md`와
`artifacts/release4-admin-queue-evidence.json`을 따른다.

신규 품목·분류 import, 고위험 검수 workbench, R4 네이티브 offer health/가격
provider 연결은 남아 있으므로 Admin P0 전체 완료로 판정하지 않는다. 다음 구현
파동은 품목별 전문가 근거와 만료일, 작성자/검수자 분리를 유지하는 고위험 검수
workbench다.

## 남은 출시 경계

이번 PASS는 현재 소스에서 생성한 production-shape 번들에 대한 로컬 증거다.
실제 production API/OAuth/push/legal 설정, production keystore, AAB/APK 서명,
staging/Play 설치와 롤백 증거는 없다. 따라서 전체 Release 4 판정은 계속
`PARTIAL / production NO-GO`다.
