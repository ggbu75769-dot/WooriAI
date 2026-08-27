# 릴리즈 런북 (Release Runbook)

작성: 2026-07-12 · 브랜치: codex/source-audit-standalone-apk

## 1. 배포 전 체크리스트

- [ ] `npx --yes pnpm@11.7.0 install --frozen-lockfile` 성공
- [ ] `npx --yes pnpm@11.7.0 release:gate` 10/10 PASS
- [ ] 프로덕션 env 설정: `NODE_ENV=production`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WOORIAI_ADMIN_TOKEN`, `DATABASE_URL`, OAuth client id/secret, `EXPO_PUBLIC_API_BASE_URL`(https)
- [ ] `pnpm check:env` 통과 (누락 시 API 부팅 실패)
- [ ] DB 마이그레이션: `pnpm --filter api prisma:deploy` (= `prisma migrate deploy`)
- [ ] seed: `pnpm --filter api seed` — 시드 내용의 단일 소스는 `apps/api/prisma/seed-data.ts`
      (정식 카테고리 12 + 모바일 별칭 8 + 가져오기 스텁 1, 준비템 카탈로그, 제휴 고지 문구,
      상품 링크). 엔트리포인트는 `apps/api/prisma/seed.ts`이고 전부 `upsert`라 **재실행해도
      안전**하다. 로컬 dev DB는 `pnpm db seed`로도 같은 시드를 돌린다.
- [ ] 관리자 계정/토큰 발급 및 안전 보관(`WOORIAI_ADMIN_TOKEN`)
- [ ] 릴리즈 keystore 준비 + Gradle signingConfig 연결 (스토어 배포 시)
- [ ] applicationId를 실제 패키지명으로 변경 (현재 `com.anonymous.wooriai`)
- [ ] 개인정보처리방침·이용약관·제휴 고지 접근 경로 확인(설정 → 개인정보)
- [ ] 워커를 돌리는 배포면 `WORKER_ENABLED=1` 주입 + `/health/worker` 모니터 설정(§3.2)
- [ ] 로그·오류 추적(Sentry 등) 연결 지점 확인

## 2. 빌드 산출물

```bash
# 독립 실행형 테스트 APK (EXPO_PUBLIC_TEST_LOGIN=1, 온디바이스 로컬 백엔드)
npx --yes pnpm@11.7.0 android:build-apk
# → artifacts/android/wooriai-0.0.0-release.apk (+ .json 리포트)

# 실서버 연동 릴리즈 빌드 (TEST_LOGIN=0, EXPO_PUBLIC_API_BASE_URL=https 서버)
#   릴리즈 매니페스트는 cleartext HTTP 차단 → API는 반드시 https
cd apps/mobile/android && ./gradlew assembleRelease   # 또는 bundleRelease (AAB)
```

## 3. 배포 절차

1. API 배포: env 검증 → `NODE_ENV=production`으로 기동(시크릿 미설정 시 fail-fast).
2. DB: 마이그레이션 적용 후 seed. 롤백은 [rollback.md](rollback.md) 참조.
3. 모바일: 서명된 AAB를 Play Console 내부 테스트 트랙 → 단계적 확대.
4. 배포 후 스모크: 로그인 → 온보딩 → 지출 기록 → 홈/리포트 일치 → 준비템 → 설정 로그아웃.

### 3.1 헬스체크 엔드포인트

배포 판정에 쓰는 것은 **`/health`가 아니라 `/health/ready`**다. `/health`는 프로세스가 살아
있다는 것만 말하고 DB를 보지 않으므로, DB가 끊긴 인스턴스도 200을 준다.

| 경로 | 용도 | 판정 |
|---|---|---|
| `GET /api/v1/health` | liveness (프로세스 생존) | 200 |
| `GET /api/v1/health/ready` | readiness (DB 연결 포함) | 200 = ok, **503 = degraded** |
| `GET /api/v1/health/worker` | 워커(퍼지/정리 잡) 관측성 | **항상 200** — 본문으로 판정 |
| `GET /api/v1/health/push` | FCM 푸시 상태 | 미주입 시 `enabled=false` no-op |

`/health/ready`는 배포 인프라에 이미 헬스체크로 걸려 있다 — `fly.toml`
(`[[http_service.checks]] path = "/api/v1/health/ready"`)과
`infra/docker/docker-compose.prod.yml`의 컨테이너 `healthcheck`가 같은 경로를 본다. 경로를
바꾸려면 세 곳(코드·fly.toml·compose)을 함께 바꿔야 한다.

```bash
curl -fsS https://<도메인>/api/v1/health/ready    # {"status":"ok","db":{"connected":true},...}
curl -fsS https://<도메인>/api/v1/health/worker   # {"enabled":...,"stale":...,"jobs":[...]}
```

### 3.2 워커 모니터 설정 (`GET /api/v1/health/worker`)

INF-007이 막으려는 상황은 **"퍼지/정리 워커가 죽었는데 아무도 모르는 것"**이다. 이 엔드포인트는
워커가 죽어 있어도 **HTTP 200**을 준다(`health.controller.ts` 주석의 계약). 상태 코드로
알림을 걸면 영원히 울리지 않으므로, 업타임 체커를 **본문 문자열 매칭**으로 설정한다.

1. 무료 업타임 체커(UptimeRobot 등)에 `GET https://<도메인>/api/v1/health/worker` 모니터 생성.
2. 모니터 타입을 **"keyword"(본문 문자열 매칭)**로 설정.
3. 키워드에 `"stale":true` 를 **그대로**(따옴표 포함) 넣는다.
4. 알림 조건을 **"키워드가 존재하면 알림"**(keyword *exists* / found)으로 둔다 — 흔히 기본값인
   "키워드가 없으면 알림"과 반대다. 뒤집으면 정상일 때 계속 울린다.
5. 점검 주기는 워커 인터벌보다 길게(예: 5분). `stale`은 "enabled인데 인터벌의 3배 안에 끝난
   틱이 없음"이라 이미 여유를 포함한 판정이다.

워커는 **`WORKER_ENABLED=1`일 때만** 돈다(주기는 `WORKER_INTERVAL_MS`, 미설정 시 기본값) —
워커를 돌려야 하는 배포라면 §1 env 체크리스트에서 이 값을 함께 확인한다.

주의: 워커를 의도적으로 돌리지 않는 배포(`enabled=false`)는 **항상 `stale=false`**를 준다 —
그런 인스턴스에서 이 모니터는 조용하다(정상). 바꿔 말해 **"알림이 없었다"가 "워커가 돌았다"를
뜻하지 않으므로**, 배포 후 한 번은 본문의 `enabled`를 눈으로 확인한다. 응답 본문에는 잡 이름·
건수·설정 요약만 담기고 id·오류 문자열은 `WorkerStatusService`가 제거하므로, 무인증 모니터에
붙여도 안전하다.

## 4. 롤백

전체 절차는 [rollback.md](rollback.md)가 단일 소스다. 요약:

- **API**: 이전 이미지/태그로 재배포. 데이터는 PostgreSQL에 있으므로 **코드 롤백이 데이터를
  되돌리지는 않는다** — 스키마 호환성을 먼저 확인한다. 라운드 4 이후 마이그레이션은 additive
  위주라 대개 코드만 되돌려도 안전하다.
- **스키마 롤백**: Prisma는 down migration을 만들지 않는다. 불가피하면 배포 직전 백업으로
  복원한다([database-backup-restore.md](database-backup-restore.md)) — 백업 이후 데이터는
  유실되므로 최후 수단.
- 재기동 후 `GET /api/v1/health/ready`가 200인지 확인(§3.1).
- **모바일**: Play Console에서 이전 릴리즈로 롤백 또는 단계적 출시 중단. 서버 API는 하위 호환을
  유지해야 한다(응답 필드 제거 금지).

## 5. 장애 대응

초동 절차와 심각도 분류는 [incident-response.md](incident-response.md) 참조.

| 증상 | 점검 |
|---|---|
| API 부팅 실패 | 필수 시크릿 env 누락(`main.ts` fail-fast 메시지 확인) |
| `/health`는 200인데 앱이 안 됨 | `/health/ready`가 503인지 확인 — DB 연결 끊김(§3.1) |
| `/health/ready` 503 지속 | `DATABASE_URL`·DB 기동 상태·커넥션 수 확인, `pnpm db status` |
| 로그인 501 | 프로덕션에서 OAuth 실검증 미구현(`auth.service.ts`) — 실 OAuth 연동 필요 |
| cleartext 차단 오류 | `EXPO_PUBLIC_API_BASE_URL`이 http — https로 변경 |
| 홈/리포트 금액 불일치 | 집계 헬퍼 단일화 확인(`expensesForChild`) — 회귀 시 e2e `expense-home-report` |
| 오래된 데이터가 안 지워짐 | 워커 정지 — `/health/worker`의 `stale`·`jobs[].lastStatus` 확인(§3.2) |
| 마이그레이션 미적용 | `prisma migrate deploy` 누락 — `pnpm --filter api prisma:deploy` 재실행 |

## 6. 알려진 외부 의존성

[known-limitations.md](known-limitations.md) 참조 — 실 OAuth, PostgreSQL, 릴리즈 keystore, 실 제휴 링크, 모니터링 SDK.
