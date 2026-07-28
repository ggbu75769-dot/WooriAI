# Release 4E 기능 검증 및 제품 고도화 결과

작성 시각: 2026-07-17 KST  
Branch: `codex/sprint2-catalog-payments`  
HEAD: `db7a7a455afec892b8fa1205e477dbe507a5931d`  
기준 환경: Node `v20.20.2`, pnpm `10.28.1`

## 판정

Release 4E에서 확인된 코드 P0 1건, P1 3건, 고빈도 P2 4건을 재현 테스트와 함께 수정했다. 최종 자동 검증 기준 open P0/P1은 0이다. 이는 production-ready 판정이 아니다. 실제 승인 법률 문서, catalog 외부 검수, 실 provider, 외부 staging, production 서명, 설치 앱 접근성 검증이 남아 있으므로 Production은 계속 `NO-GO`다.

## 주요 수정

### 오프라인 데이터 격리와 복구

- 오프라인 지출과 outbox에 사용자-가족 scope를 추가했다.
- 다른 계정으로 전환해도 이전 계정의 pending row가 조회, 수정, 전송되지 않는다.
- 기존 scope 없는 로컬 row는 다음 로그인 사용자에게 귀속시키지 않고 격리한다.
- 계정 삭제 시 현재 scope의 로컬 데이터만 제거한다.
- 자동 재시도를 5회로 제한하고 이후에는 명시적인 수동 재시도를 사용한다.

### 금융 불변식

- 환불과 지원금 지출을 오프라인에서 수정할 때 일반 지출로 변환될 수 있던 경로를 제거했다.
- 기존 서버 adjustment kind를 보존하고 Report 순지출 계산을 깨뜨리지 않는다.
- financial mutation 후 expense, home, budget, Report V3 cache를 동일 계약으로 갱신한다.

### Legal fail-closed

- placeholder, 미래 효력, 잘못된 version/hash뿐 아니라 reserved, private, example URL도 유효 문서로 인정하지 않는다.
- 유효한 production 문서가 없으면 신규 동의는 계속 fail-closed다.
- seed나 placeholder 값을 실제 승인 문서로 변조하지 않았다.

### Report V3와 알림

- production 초기 Report는 Report V3 aggregate만 source of truth로 사용한다.
- 실제 지출 0원이어도 planned 또는 recurring이 있으면 planned-only 상태를 유지한다.
- 수신된 notification route는 navigation 경계에서 다시 allowlist 검사하며 unknown/malicious 값은 이동하지 않는다.

### production 오염 차단

- 첫 contamination export에서 Release 4E가 추가한 로컬 household fixture 식별자가 검출됐다.
- scope helper에서 fixture 값을 제거하고 기존 production-replaced runtime 경계에서만 주입하도록 수정했다.
- 재실행한 production Hermes bundle 검사에서 forbidden finding 0으로 PASS했다.

## AIM 시나리오 결과

세부 Actor/Input/Mission/계약/검증 계층은 `docs/qa/evidence/release4e-aim-traceability.json`에 있다.

| Scenario | 결과 | 핵심 증거 |
|---|---|---|
| Legal consent | PASS | legal policy unit + phase4 E2E |
| Onboarding resume | PASS | mobile resume + onboarding E2E |
| Multi-child/session switch | PASS | session cache boundary + data integrity |
| Lifecycle parity | PASS | KST boundary table + server/local parity |
| Weekly preparation | PASS | ranking/API/component contracts |
| Bundle apply | PASS | atomic/idempotent API E2E |
| Item CAS/privacy | PASS | CAS/RBAC/gift privacy E2E |
| Search corpus | PASS | 200/200, p95 235.68ms |
| Offline expense | PASS | scoped queue/idempotency/retry tests |
| Report planned-only | PASS | selector/aggregate/request-plan tests |
| Notifications | PASS | tenant isolation/read/route allowlist |
| Owner transfer | PASS | owner-only/CAS/leave guard |
| Privacy delete | PASS | idempotent delete/post-delete denial/local purge |
| Admin publish | PASS automated | API DB race + Admin render; browser unavailable |
| Admin import | PASS automated | formula/partial failure/API + Admin render; browser unavailable |

## 테스트와 빌드

- `pnpm release:gate`: 11/11 PASS.
- forced workspace tests: 685 assertions PASS.
- API E2E: 19 files / 106 tests PASS.
- API full: 52 files / 251 tests PASS.
- Mobile: 49 files / 304 tests PASS.
- Admin: 7 files / 33 tests PASS.
- Domain: 8 files / 41 tests PASS.
- critical repeats: mobile 260/260, domain 180/180, API DB race 110/110 PASS.
- DB: fresh 및 Release 3 upgrade 모두 migration 31까지 PASS.
- production contamination export: PASS, finding 0.
- catalog: canonical 408, in_review 408, published 0, high-risk 84, offer 0 유지.
- secret scan: PASS.
- dependency audit: high/critical 0, moderate 8. JSON 상세 조회는 registry HTTP 410으로 별도 기록했다.
- Android internal standalone APK: build PASS. production/store artifact가 아니다.

## Android provenance

- APK: `artifacts/android/wooriai-0.0.0-release-standalone.apk`
- SHA-256: `0D4CE0DA5E1CDC26641EC3F068F09D223170D4B28550458CE3CBE342E222C43D`
- Size: `77,607,439` bytes
- Embedded Hermes SHA-256: `DF620AEB4D33F3966717912E7EB284A4E6A7A45498F7F7336D343FB0DFBDABE1`
- Package/version: `com.anonymous.wooriai`, `0.0.0 (1)`
- Signing: internal debug certificate, SHA-256 `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C`
- ADB: 도구는 발견했으나 연결된 device/emulator가 없어 설치 및 smoke는 `NOT_RUN`.

## 검증 제한

- Admin headless browser skill이 요구하는 Node REPL browser tool이 현재 세션에 노출되지 않아 browser interaction은 `NOT_AVAILABLE`이다. 새 browser framework는 추가하지 않았다.
- 연결 단말이 없어 APK 설치, cold launch, planned-only Report, notification deep link, owner transfer, offline reconnect smoke를 실행하지 않았다.
- 37-route strict source contract는 PASS했지만 전체 TalkBack, 폭, font scale 실기기 검증 완료를 주장하지 않는다.
- local multi-replica staging parity와 backup/restore drill은 Release 4E에서 재실행하지 않았다.

## 외부 blocker

- 실제 승인 법률 문서
- 408개 catalog 편집 승인
- 84개 high-risk 전문가 및 안전 승인
- 실제 push/recall provider
- 승인 merchant offer
- 외부 staging
- production signing, AAB, Play beta

## 연결 증거

- `docs/qa/evidence/release4e-aim-traceability.json`
- `docs/qa/evidence/release4e-findings.json`
- `docs/qa/evidence/release4e-test-evidence.json`
- `docs/qa/evidence/release4e-manifest.json`
- `artifacts/dev-snapshots/release4e-file-ownership.json`
- `artifacts/android/release4e-build-provenance.json`
