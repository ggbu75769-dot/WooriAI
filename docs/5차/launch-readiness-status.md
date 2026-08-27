# 출시 준비 현황 (2026-08-27 기준, 라운드 22까지)

72시간 계획(launch-72h-plan.md) 대비 현재 상태 요약. 상세 이력은 PR #3~#19 + PR #20~#29(라운드 13~22).

## 코드 측: 완료 ✅

| 영역 | 상태 |
|---|---|
| 핵심 루프 (기록→총액→준비템→클릭→구매확인) | 완성 + 실서버 스모크 29/29 검증 (`scripts/qa/server-smoke.sh`) |
| 카카오 로그인 | 서버 OIDC 완성 + 모바일 스캐폴드 — **env 3종 주입만 남음** |
| 인앱 알림 (예산·시기·구매확인·주간 요약) | 완성 + **FCM HTTP v1 발송 스캐폴드**(PUSH-113) — `PUSH_ENABLED=1`+`FCM_SERVICE_ACCOUNT_PATH` 주입 시 실발송, 미주입 시 안전한 no-op. 상태 확인 `GET /api/v1/health/push` |
| 100일/첫돌 리포트·공유, CSV 내보내기 | 완성 |
| 워커 (예약게시·정리 4종·링크 헬스체크·**데이터 파기**) | 완성 — 파기 30일, 법적 문서와 일치 |
| 어드민 (CMS·계정·링크 일괄교체·대시보드·**KPI 퍼널**·**감사 로그 뷰어**) | 완성 — 감사 로그 메뉴는 admin 역할 전용(ADM-113, 마스킹·필터·페이지네이션) |
| 배포 자산 (Dockerfile·Fly·Oracle 원샷 스크립트·Caddy) | 완성 — VM 첫 실행이 첫 검증 |
| **정적 지원 사이트** (`infra/site/` — 랜딩·FAQ·지원/삭제 안내) | **완성**(SITE-113) — legal 문서와 합쳐 Cloudflare Pages 무료 배포, 절차는 `infra/site/README.md` |
| 안드로이드 빌드 (패키지 `kr.wooriai.app`·config plugin 자동화) | 완성 — keystore·버전 env만 남음 |
| 접근성 1차, 프라이버시(계정 전환 정리·파기), 보안 리뷰 2회 | 완료 |
| 테스트 | **api 459 · mobile 970 · admin 128 · domain 118 · contracts 39 · test-utils 11 (총 1,725)**, 릴리즈 게이트 11/11 PASS[^1] |
| 실서버 검증 | HTTP 스모크 29/29 (워커·푸시 헬스 포함) · 어드민 브라우저 E2E 10단계 (감사 로그 뷰어·역할 게이트 포함, QA-114) · 백업 복구 드릴 6/6 |
| 정밀 리뷰 | 4라운드 32건 + 커버리지 표적 테스트가 찾은 실버그 6건·잠재 이슈 4건 — 전량 수정 |
| 성능 | DB 인덱스 실측(파기 16ms→0.07ms)·감사 로그 뷰어 인덱스 3종 · /home 이중 조회 제거 · 기록 탭 FlatList 가상화 · 부하 p95 기준선 |
| 견고성 | 전역 ErrorBoundary · 온보딩 멈춤 버그 수정+재시도 카드 · 오프라인 삭제-404 수렴·충돌 행 가시화 |
| 사용 편의 (라운드 13) | 홈 예산 임박·초과 경고 배너(80%/100%) · 지출 입력 최근 항목 칩 빠른 재입력 |
| 운영 관측성 | `GET /health/worker` (stale 판정·잡 상태) + `GET /health/push` (발송 카운터) — 무료 업타임 체커 연결 가능 |
| **스토어 그래픽** | **512 아이콘·1024×500 피처 그래픽·스크린샷 3장 생성 완료** (docs/store/assets, 최소 요건 충족) |
| **AAB 빌드** | **원커맨드 파이프라인** (`pnpm android:build-aab`, keystore env만 필요, --check 검증 완료) |

[^1]: 라운드 22 최종 재인증(2026-08-27) 기준 — 스모크 31/31·게이트 11/11. 라운드 21~22: 설정 진입 불가 치명 결함 해소, 기록 카테고리 필터 실세션 0건 수정, 준비템 시기 미리보기·필수도 필터·검색, 가족 초대 여정(수락 왕복·대기 목록·온보딩 튕김), getHome 30배 최적화, 금액 프리셋·지난달 대비 인사이트, 리뷰 발견 9건 전량 수정. 라운드 12 시점 총 1,023에서 +702.

## 문서 측: 초안 완료 (확정 대기) 📄

- Play 등록 정보 전문·스크린샷 가이드 (`docs/store/play-listing.md`)
- 데이터 안전 설문 답안지 — 코드 근거 인용 (`docs/store/data-safety-answers.md`)
- 개인정보처리방침·이용약관·계정 삭제 안내 HTML (`infra/legal/` — 법률 검토 전 배너, [대괄호] placeholder 교체 필요)
- 지원 사이트 랜딩·FAQ·문의 페이지 + Cloudflare Pages 배포 가이드 (`infra/site/`, SITE-113)
- 제출 체크리스트 (`docs/store/submission-checklist.md`)

## 사용자 액션만 남음 (코드로 불가) 🔑

1. **Oracle 가입 + VM 생성** → 런북 §4 한 줄 실행 (`docs/5차/oracle-free-deploy-runbook.md`)
2. **카카오 앱 키** → 서버/모바일 env 주입
3. **Google Play Console** 등록(가능하면 사업자 계정 — 개인은 20명×14일 테스트 강제) + **release keystore** 생성·백업
4. 쿠팡 파트너스 승인 → 어드민 CSV 도구로 링크 교체 (승인 전엔 비제휴 링크 플랜 B)
5. 법적 문서 placeholder(운영 주체·지원 이메일) 확정 + **정적 호스팅 — `infra/site/` + `infra/legal/`을 Cloudflare Pages 무료 플랜에 업로드** (배포 절차·Play Console URL 매핑: `infra/site/README.md`)
6. 심사용 카카오 테스트 계정 준비
7. (선택) 푸시를 켤 경우: Firebase 프로젝트 생성 → 서비스 계정 JSON 발급 → `PUSH_ENABLED=1`·`FCM_SERVICE_ACCOUNT_PATH` 주입 (미주입 시 no-op, 출시 비차단)
