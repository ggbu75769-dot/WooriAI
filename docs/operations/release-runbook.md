# 릴리즈 런북 (Release Runbook)

갱신: 2026-07-27 · 브랜치: `codex/sprint2-catalog-payments`

이 문서는 실행 절차다. 현재 전체 상태와 증거 경계는 `current-development-status-and-next-design-baseline-2026-07-26.md`를 우선한다.

## 1. 출시 후보 선행 조건

- [ ] 변경이 리뷰 가능한 commit/PR에 고정되고 release 대상 SHA가 승인됨
- [ ] `pnpm install --frozen-lockfile` PASS
- [ ] `pnpm release:gate` 16/16 PASS
- [ ] `pnpm release:config` PASS
- [ ] `pnpm release5:external-readiness`가 `READY`
- [ ] `pnpm catalog:audit` 후 `publishedContentReady=true`
- [ ] 승인된 Android application ID, semver, versionCode
- [ ] 조직 소유 release signing secret 주입
- [ ] privacy/terms/support/status HTTPS URL과 법적 운영자 정보 승인
- [ ] production DB/Redis/object storage/OAuth/push/recall/merchant/monitoring 준비
- [ ] backup 생성과 별도 환경 restore drill PASS

현재 로컬 환경은 위 production 조건을 만족하지 않는다. placeholder를 임의 운영값으로 바꾸지 않는다.

## 2. 검증 명령

```powershell
pnpm release:gate
pnpm release:config
pnpm release5:external-readiness
pnpm catalog:audit
pnpm pixel:android
```

- Release Gate는 격리 catalog DB를 생성해 41개 migration과 seed를 적용하고 감사 후 제거한다.
- Pixel 최종 증거는 설치 Android 앱의 adb `screencap`만 인정한다.
- 브라우저/Expo web 캡처는 Android Pixel 최종 증거가 아니다.

## 3. DB 배포

1. 승인된 production `DATABASE_URL`을 secret storage에서 주입한다.
2. 배포 직전 backup과 restore 가능한지 확인한다.
3. `pnpm --filter api prisma:deploy`로 forward migration을 적용한다.
4. seed가 필요한 경우 승인된 환경과 대상 범위를 확인한 뒤 `pnpm --filter api seed`를 실행한다.
5. `/api/v1/health`와 readiness, worker/queue, object storage를 확인한다.

운영 롤백에 임의의 migration down을 사용하지 않는다. 이전 애플리케이션 이미지와 검증된 backup restore 또는 별도 forward-fix migration을 사용한다.

## 4. Android 산출물

```powershell
# 내부 standalone APK
pnpm android:build-apk

# production config/signing이 준비된 뒤 AAB
pnpm android:build-aab
```

- 모든 최종 APK는 `F:/WooriAI` 프로젝트 루트에 둔다.
- `artifacts`에는 보고서, 스크린샷, diff, heatmap, 로그만 둔다.
- 직접 Gradle 호출로 빌드 스크립트의 source/profile/provenance 검증을 우회하지 않는다.
- signed AAB는 Play Console internal track에서 먼저 검증한다.

## 5. Staging·물리기기 smoke

1. 실제 OAuth 로그인·refresh·logout·unlink·계정 삭제
2. 온보딩 완료와 재진입
3. 지출 생성 → 홈/리포트 합계 → 준비템 → 구매 링크 → 구매 후 상태
4. 가족 owner/co-parent/viewer RBAC와 교차 household 차단
5. Excel preview-before-save와 오류 복구
6. 네트워크 단절·재연결·충돌·delta cursor/tombstone 수렴
7. push, recall, merchant, object storage
8. 물리 Android/TalkBack/큰 글꼴/safe area와 iOS core loop
9. crash/latency/error-rate dashboard와 alert

## 6. 출시·롤백

1. release SHA와 config evidence를 고정한다.
2. Play internal → 제한 closed beta → 단계적 rollout 순으로 확대한다.
3. 오류율, 인증 실패, queue backlog, recall/merchant 상태, 삭제 SLA를 감시한다.
4. 임계값 초과 시 rollout을 중단하고 이전 승인 빌드/API 이미지로 복귀한다.
5. DB는 destructive rollback 대신 restore drill이 끝난 backup 또는 forward fix를 사용한다.

## 7. 현재 차단

- `pnpm release:config`: 46개 운영 입력 차단
- external readiness: core/OAuth/push/recall/merchant/signing 6영역 차단
- catalog: 409개 `in_review`, 독립 검토 0, 게시 0
- physical Android/iOS/store: 미실행
