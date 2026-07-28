# WooriAI 제품 재설계 개발완료보고서

- 작성일: 2026-07-15
- 대상 저장소: `F:\WooriAI`
- 현재 브랜치: `codex/sprint2-catalog-payments`
- 현재 HEAD: `7721fc152ca23e848856eff00c495d56960d4437`
- 검증된 제품 소스 SHA: `378906b638b3b7bce902c5f03f8e28af6693dfca`
- 판정: **Sprint 0~2 로컬 개발 완료 / 운영 출시 미완료**

## 1. 종합 판정

WooriAI 제품 재설계의 Sprint 0~2 범위는 코드, 데이터 마이그레이션, 자동 테스트, clean-source Android APK, 설치 앱 adb 캡처 및 Pixel Lock 기준에서 로컬 개발 완료 상태다.

다음 항목은 이 완료 판정에 포함되지 않는다.

- GitHub 원격 브랜치 push 및 PR
- 운영 서버·운영 데이터베이스 배포
- EAS/internal distribution 및 앱스토어 출시
- iOS 설치·실기기 증적
- 운영 OAuth·외부 비밀키 주입과 실제 사용자 인증 검증
- Sprint 3 이후 기능

따라서 현재 상태는 **출시 가능한 로컬 기준선**이며, **운영 출시 완료**를 의미하지 않는다.

## 2. 완료 범위

### Sprint 0 — 제품 상태 및 UI 하드닝

- 프로덕션 경로의 데모·미리보기 데이터 노출 차단
- 홈, 빠른 지출, 준비템, 리포트의 실제 상태 중심 구조 정리
- 4개 하단 탭 `홈 / 기록 / 준비템 / 리포트` 유지
- 중복 메뉴, 가짜 평점·가격, 의미 없는 빈 그래프 및 비동작 CTA 정리
- 금액, 카테고리, 결제수단 기본값 및 빈 상태 계약 보강
- Android 9개 기준 화면의 승인 레퍼런스와 Pixel Lock 회귀 계약 확정

### Sprint 1 — 계정·자녀 프로필과 온보딩

- 계정 프로필과 자녀 프로필을 별도 화면·상태로 분리
- 모든 주요 탭에서 계정 프로필로 한 번에 진입
- 다중 자녀 목록, 추가, 선택, 전환 및 프로필 수정
- 임신·출생·수동 단계와 날짜 입력·수정 계약
- 자녀 전환 시 홈, 지출, 준비템, 상세, 리포트, 예산 쿼리 무효화
- 자녀별 예산·지출·준비 상태·리포트 데이터 격리
- 자녀 미선택·비로그인 딥링크 진입 가드
- 로그아웃 시 세션, 선택 자녀, 온보딩, 쿼리 캐시 및 로컬 테스트 데이터 정리
- 기존 단일 자녀 저장 데이터를 다중 자녀 구조로 안전하게 승격

### Sprint 2 — 결제수단·카탈로그·프로필 보강

- 사용자 결제수단 등록, 수정, 기본값 변경, 비활성화 및 이력 연결 보존
- 동시 기본 결제수단 변경 시 활성 기본값 1개 보장
- 지출 생성·수정 화면의 결제수단 선택 연결
- 카드번호·계좌번호 등 민감 숫자열 입력 차단
- 자녀별 최근 90일 빠른 지출 항목 최대 6개 제공
- 빠른 지출 항목에서 이전 금액을 자동 복사하지 않도록 보호
- 자녀 성별을 선택 사항으로 추가하고 비우기·직접 입력 지원
- 성별 정보가 추천 순위에 영향을 주지 않도록 계약 고정
- 10개 성장 단계, 160개 고유 준비템 카탈로그 구축
- 160개 항목 전체 reviewed/active 상태 및 단계·이유·건너뛰기 안내·검수일 검증
- 커머스 항목 58개, 활성 링크 98개, 핵심 항목 40개에 링크 2개 이상 제공
- 관리자 카탈로그 검증·커버리지 확인 경로 추가

## 3. 데이터베이스 및 호환성

Sprint 2 데이터 변경은 additive migration으로 구성했다.

- `000009_catalog_content`
- `000010_user_payment_methods`
- `000011_catalog_content_backfill`

`pnpm sprint2:verify-db` 검증 결과:

| 검증 경로 | 결과 | 확인 내용 |
| --- | --- | --- |
| 신규 설치 | PASS | 000001~000011 적용, seed/import 2회, 160개 카탈로그·98개 링크·중복 코드 0 |
| Sprint 1 업그레이드 | PASS | 기존 사용자·자녀·지출·준비 상태 보존, 신규 마이그레이션 적용 |
| 기본 결제수단 동시성 | PASS | 활성 기본값 정확히 1개 유지 |
| 결제수단 비활성화 | PASS | 과거 지출의 결제수단 연결과 조회 가능성 보존 |
| 코드 롤백 호환성 | PASS | Sprint 1 코드로 최신 11개 마이그레이션 DB의 핵심 루프 E2E 1/1 통과 |

DB down migration이나 운영 DB 배포를 검증했다는 의미는 아니다.

## 4. 기능·품질 검증 결과

### Release gate

`pnpm release:gate`: **11/11 PASS**

| 항목 | 결과 |
| --- | --- |
| 의존성 고정 설치 | PASS |
| 환경 변수 예제 검사 | PASS |
| Prisma validate/generate | PASS |
| 로컬 PostgreSQL 기동 | PASS |
| Lint | PASS |
| Typecheck | PASS |
| 전체 테스트 | PASS |
| API E2E | PASS |
| Build dry-run | PASS |
| Peer dependency 검사 | PASS |

세부 테스트 결과:

- Mobile: 34파일, 247테스트 PASS
- API 전체: 35파일, 173테스트 PASS
- API release E2E: 15파일, 73테스트 PASS
- 결제수단 집중 API E2E: 5/5 PASS
- Catalog validate/coverage: PASS

### 카탈로그 품질

| 항목 | 결과 |
| --- | ---: |
| 고유 reviewed/active 준비템 | 160 |
| 필수 성장 단계 | 10/10 충족 |
| 커머스 연결 항목 | 58 |
| 활성 상품 링크 | 98 |
| 핵심 항목 링크 2개 이상 | 40/40 |
| 중복 코드·정확히 같은 이름 | 0 |
| 누락된 단계·이유·검수일 | 0 |
| 비허용 URL·고아 링크 | 0 |

외부 상품 URL은 스키마·호스트·정책 기준으로 검증했으며, 모든 외부 목적지의 실시간 HTTP 응답을 확인했다는 의미는 아니다.

## 5. Android 설치 앱 증적

### Clean-source APK

- 빌드 명령: `pnpm pixel:android:build-apk`
- 제품 소스 SHA: `378906b638b3b7bce902c5f03f8e28af6693dfca`
- 빌드 당시 dirty: `false`
- 패키지: `com.anonymous.wooriai`
- 파일 크기: 68,768,979 bytes
- SHA-256: `99ca5f9fcb902d2f3fb92667d76845fd794b86c07f17eb2f44661308f6712156`
- 보존 APK: `artifacts/pixel-lock/android/apks/wooriai-sprint2-378906b.apk`

### Sprint 2 기능 캡처

설치된 Android 앱에서 `adb shell screencap -p`와 `adb pull`로 캡처했으며 6/6 PASS다.

| 증적 ID | 결과 | 검증 내용 |
| --- | --- | --- |
| PAY-001 | PASS | 결제수단 목록과 기본값 |
| PAY-002 | PASS | 결제수단 추가·수정과 민감 숫자열 차단 |
| EXP-PAY-001 | PASS | 지출 결제수단 선택 |
| PROFILE-GENDER-001 | PASS | 선택적 성별과 프로필 표시 |
| ITEM-CATALOG-001 | PASS | 실제 카탈로그 기반 준비템 카드 |
| ITEM-COVERAGE-001 | PASS | 필수 성장 단계 커버리지 |

Browser, Expo web, Playwright 캡처는 최종 증적으로 사용하지 않았다.

### Android Pixel Lock

`pnpm pixel:android`: **9/9 PASS**

| 화면 | 점수 | 결과 |
| --- | ---: | --- |
| SPL-001 | 0.0230 | PASS |
| HOME-001 | 0.0000 | PASS |
| EXP-001 | 0.0000 | PASS |
| ITEM-001 | 0.0000 | PASS |
| ITEM-002 | 0.0489 | PASS |
| REP-001 | 0.0397 | PASS |
| FAM-001 | 0.0363 | PASS |
| IMP-003 | 0.0459 | PASS |
| SET-001 | 0.0195 | PASS |

모든 화면은 `renderValid=true`이고 기준 `0.0500` 이하이다.

## 6. 핵심 제품 계약 보존

- 4개 하단 탭 유지
- 지출 기록 → 합계 → 준비템 → 구매 링크 → 구매 후 기록/상태의 MVP 루프 유지
- 구매 CTA 인접 제휴 고지 유지
- 추천 순위에서 제휴 수수료 배제
- Excel 저장 전 미리보기·선택 확인 유지
- 가족 owner/co-parent/viewer RBAC 유지
- API v1, 인증, 감사로그, affiliate logging 및 기존 지출 호환성 유지

## 7. 주요 커밋

| 커밋 | 내용 |
| --- | --- |
| `d7bfd08` | Sprint 0 데모 fallback 제거와 실제 제품 상태 적용 |
| `b42439a` | Sprint 1 계정·다중 자녀 프로필 흐름 |
| `8b0de80` | Sprint 2 카탈로그·결제수단 기능 |
| `c0d2b99` | Sprint 2 종료 검증 도구 |
| `8945118` | 빠른 지출 UI 계약 보존 |
| `378906b` | clean Pixel APK 빌드 재현성 보강 |
| `7721fc1` | Sprint 2 최종 로컬 기준선 증적 |

현재 작업 트리는 clean이다. `codex/sprint2-catalog-payments` 원격 브랜치는 아직 존재하지 않아 현재 결과는 로컬 전용이다.

## 8. 미완료 및 출시 전 조치

| 항목 | 상태 | 필요한 조치 |
| --- | --- | --- |
| GitHub push/PR | 미완료 | 브랜치 push 후 리뷰·병합 |
| 운영 API/DB 배포 | 미완료 | 운영 migration·seed·rollback 계획과 배포 증적 |
| Android internal/store build | 미완료 | EAS 또는 공식 배포 서명 빌드와 설치 검증 |
| iOS 검증 | 미완료 | iOS 빌드·설치·핵심 흐름 검증 |
| 실제 OAuth | 미완료 | 운영 제공자 설정·비밀키·딥링크 검증 |
| 자녀 사진 업로드 | 미완료 | 저장소·업로드·권한·삭제 계약 구현 |
| 외부 링크 실시간 상태 | 부분 | 링크 헬스체크/운영 모니터링 추가 |
| Sprint 3 이후 | 범위 외 | 별도 승인·계획 필요 |

## 9. 최종 승인 문구

> WooriAI 제품 재설계 Sprint 0~2는 검증된 소스 SHA `378906b`를 기준으로 로컬 개발, 데이터 호환성, 자동 테스트, 설치 Android 앱 증적 및 9화면 Pixel Lock 검증을 완료했다. 현재 HEAD `7721fc1`에는 그 결과를 재현하기 위한 최종 증적 문서가 포함되어 있다. 다만 원격 반영, 운영 배포, 스토어 출시 및 iOS 검증은 별도 출시 승인 절차가 필요하다.

## 10. 재현 명령

```powershell
pnpm catalog:validate
pnpm catalog:coverage
pnpm sprint2:verify-db
pnpm release:gate
pnpm pixel:android:build-apk
pnpm sprint2:capture-evidence
pnpm pixel:android
```

## 11. 근거 문서

- `docs/qa/evidence/sprint2-catalog-payments-android-2026-07-14.md`
- `docs/qa/evidence/sprint2-catalog-quality-2026-07-14.md`
- `docs/qa/evidence/latest-release-gate.md`
- `docs/qa/evidence/sprint1-android-pixel-gate-2026-07-14.md`
- `docs/audit/sprint1-profile-onboarding-scope.md`
- `artifacts/pixel-lock/android/reports/pixel-apk.json`
- `artifacts/pixel-lock/android/reports/sprint2-evidence.json`
- `artifacts/pixel-lock/android/reports/latest.md`
