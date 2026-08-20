# 출시 준비 현황 (2026-08-20 기준)

72시간 계획(launch-72h-plan.md) 대비 현재 상태 요약. 상세 이력은 PR #3~#10.

## 코드 측: 완료 ✅

| 영역 | 상태 |
|---|---|
| 핵심 루프 (기록→총액→준비템→클릭→구매확인) | 완성 + 실서버 스모크 27/27 검증 (`scripts/qa/server-smoke.sh`) |
| 카카오 로그인 | 서버 OIDC 완성 + 모바일 스캐폴드 — **env 3종 주입만 남음** |
| 인앱 알림 (예산·시기·구매확인·주간 요약) | 완성 (푸시 발송은 FCM 인프라 대기) |
| 100일/첫돌 리포트·공유, CSV 내보내기 | 완성 |
| 워커 (예약게시·정리 4종·링크 헬스체크·**데이터 파기**) | 완성 — 파기 30일, 법적 문서와 일치 |
| 어드민 (CMS·계정·링크 일괄교체·대시보드·**KPI 퍼널**) | 완성 |
| 배포 자산 (Dockerfile·Fly·Oracle 원샷 스크립트·Caddy) | 완성 — VM 첫 실행이 첫 검증 |
| 안드로이드 빌드 (패키지 `kr.wooriai.app`·config plugin 자동화) | 완성 — keystore·버전 env만 남음 |
| 접근성 1차, 프라이버시(계정 전환 정리·파기), 보안 리뷰 2회 | 완료 |
| 테스트 | api 246 · mobile 469 · admin 68 · domain 28 · contracts 35, 릴리즈 게이트 11/11 |

## 문서 측: 초안 완료 (확정 대기) 📄

- Play 등록 정보 전문·스크린샷 가이드 (`docs/store/play-listing.md`)
- 데이터 안전 설문 답안지 — 코드 근거 인용 (`docs/store/data-safety-answers.md`)
- 개인정보처리방침·이용약관·계정 삭제 안내 HTML (`infra/legal/` — 법률 검토 전 배너, [대괄호] placeholder 교체 필요)
- 제출 체크리스트 (`docs/store/submission-checklist.md`)

## 사용자 액션만 남음 (코드로 불가) 🔑

1. **Oracle 가입 + VM 생성** → 런북 §4 한 줄 실행 (`docs/5차/oracle-free-deploy-runbook.md`)
2. **카카오 앱 키** → 서버/모바일 env 주입
3. **Google Play Console** 등록(가능하면 사업자 계정 — 개인은 20명×14일 테스트 강제) + **release keystore** 생성·백업
4. 쿠팡 파트너스 승인 → 어드민 CSV 도구로 링크 교체 (승인 전엔 비제휴 링크 플랜 B)
5. 법적 문서 placeholder(운영 주체·지원 이메일) 확정 + 정적 호스팅(Cloudflare Pages 무료)
6. 심사용 카카오 테스트 계정 준비
