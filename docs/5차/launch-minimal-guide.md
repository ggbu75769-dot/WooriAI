# 출시 최소 작업 가이드 (초안 — 트랙 LP-B)

작성: 2026-09-02. **사용자가 직접 해야 하는 일을 최소로** 줄인 출시 절차.
값 입력은 ①의 파일 하나뿐이고, 나머지는 스크립트가 한다.

> 다른 트랙이 만드는 단계(키스토어·AAB·어드민 배포)는 **자리표시**로 남겨 두었다 —
> 메인 세션이 각 트랙 산출물 확정 후 이 문서에 통합한다.

## ① launch.config.json 채우기 (약 5분)

```bash
cp launch.config.example.json launch.config.json
```

파일을 열어 **[필수] 4개**를 채운다(각 항목의 한국어 주석 참고):

| 필드 | 내용 | 예 |
|---|---|---|
| `operatorName` | 운영 주체명(개인 성명 또는 상호) | `홍길동` |
| `supportEmail` | 실제 수신 가능한 지원 이메일 | `help@example.com` |
| `domain` | API 서버 도메인(스킴 없이) | `wooriai.duckdns.org` |
| `launchDate` | 시행일(출시일), YYYY-MM-DD | `2026-09-15` |

카카오 키 3종(`kakao.restApiKey` 등)은 developers.kakao.com에서 발급받아 채운다 —
**비워 두어도 진행된다**(카카오 단계만 건너뛰고 표식이 남는다. 발급은 심사 없이 즉시,
`docs/5차/launch-72h-plan.md` §1 참고). `siteDomain` 등 [선택] 항목은 비우면 합리적
기본값이 쓰인다.

⚠️ `launch.config.json`과 `.env.production`은 .gitignore 대상 — 커밋하지 않는다.

## ② pnpm launch:prepare (자동)

```bash
pnpm launch:prepare
```

스크립트가 한 번에 수행한다:

- `infra/legal/*.html`·`infra/site/*.html`의 `[대괄호]` placeholder를 ①의 값으로 치환
  (운영자명·지원 이메일·시행일·개인정보 보호책임자·수탁업체). 단
  **`[적용 법령·기간은 법률 검토 시 확정]`과 초안 배너는 그대로 둔다** — 법률 검토
  대상이며 라운드 75 보존 계약이 그 자리를 핀으로 걸고 있다.
- `.env.production` 생성: JWT 시크릿·salt·DB 비밀번호·관리자 초기 비밀번호 등
  비밀값 8개 자동 생성(crypto), 도메인 파생 URL 6개 자동, 카카오 키 주입.
- `pnpm check:env --file .env.production` 통과 확인까지 자동 검증.

끝나면 요약이 출력된다(치환 파일 목록·남은 수동 항목). 재실행해도 안전하다 —
치환은 멱등이고, 기존 `.env.production`은 덮어쓰지 않는다(재생성은 `--force-env`,
단 이미 배포한 뒤라면 시크릿이 전부 회전되므로 주의).

## ③ 서버 배포 (Oracle 무료 VM — 반자동)

`docs/5차/oracle-free-deploy-runbook.md`를 따른다. 요지: VM에서
`scripts/deploy/oracle-bootstrap.sh` 실행(도메인/DuckDNS 지정) — docker·caddy·DB·
시드까지 자동. ②에서 만든 `.env.production`을 VM의 `/opt/wooriai/.env.production`으로
올려 쓰면 카카오 키·시크릿이 그대로 반영된다(부트스트랩은 기존 파일을 덮어쓰지 않는다).

배포 후: `curl https://<도메인>/api/v1/health/ready` 확인 → 어드민에
`ADMIN_SEED_EMAIL`(=지원 이메일)과 `.env.production`의 `ADMIN_SEED_PASSWORD`로
로그인해 **즉시 비밀번호 교체 + MFA 등록**(ADM-007).

## ④ 지원 사이트 배포 (약 10분)

②의 치환이 끝난 뒤 `infra/site/README.md`의 절차대로 Cloudflare Pages에 업로드:

```bash
mkdir -p /tmp/wooriai-site && cp infra/site/*.html infra/site/site.css infra/legal/*.html /tmp/wooriai-site/
```

배포 도메인이 `launch.config.json`의 `siteDomain`(비웠으면 `domain`)과 일치하는지
확인 — `.env.production`의 `EXPO_PUBLIC_TERMS_URL` 등 4개 URL이 그 도메인으로
파생되어 있다. 다르면 config를 고치고 ②를 다시 본다.

> ⚠️ 법적 문서는 아직 "법률 전문가 검토 전 초안" 배너가 붙어 있다. 검토 완료 후
> 배너 제거·`[적용 법령·기간…]` 확정은 별도 수동 단계다(코드 계약과 함께 갱신).

## ⑤ 서명 키스토어 (자리표시 — 트랙: 키스토어 스크립트)

<!-- TODO(메인 세션): 키스토어 트랙 산출물(scripts/release/make-keystore.sh) 사용법으로 교체 -->
`scripts/release/make-keystore.sh` 참고. 키스토어 파일은 리포지토리 밖(`$HOME`)에 보관 —
`*.keystore`/`*.jks`는 gitignore되어 있다.

## ⑥ AAB 빌드·서명 (자리표시 — 트랙: AAB 워크플로)

<!-- TODO(메인 세션): android-release 워크플로/로컬 빌드 트랙 산출물로 교체 -->
`.github/workflows/android-release.yml` 또는 `pnpm android:build-aab` 트랙 문서 참고.
빌드 시 `.env.production`의 `EXPO_PUBLIC_*` 값(API URL·카카오·약관/지원 URL)을 주입한다
— `EXPO_PUBLIC_*`는 번들 시점 인라인이므로 값 변경 = 재빌드다.

## ⑦ 어드민 콘솔 배포 (자리표시 — 트랙: 어드민 배포)

<!-- TODO(메인 세션): admin.Dockerfile / docker-compose.admin.yml 트랙 산출물로 교체 -->
`infra/docker/docker-compose.admin.yml` 트랙 문서 참고.

## ⑧ 실기기 QA + 스토어 제출

- 최소 QA 30분 시트: `docs/qa/launch-minimal-qa.md`
- Play Console 등록: `docs/store/play-listing.md` — 개인정보처리방침 URL·지원 URL·
  계정 삭제 URL은 ④의 배포 주소를 그대로 입력(입력 후 경로 변경 금지)
- 제출 절차: `docs/5차/launch-72h-plan.md` §4

## 남은 수동 항목 체크리스트

- [ ] 카카오 키 발급·주입(①에서 비웠다면) + 카카오 콘솔 redirect URI(`wooriai://oauth/kakao`) 등록
- [ ] 법률 검토: 초안 배너 제거, `[적용 법령·기간은 법률 검토 시 확정]` 확정
- [ ] 어드민 초기 비밀번호 교체 + MFA 등록(③)
- [ ] (사업자인 경우) 개인정보 보호책임자 성명 확인 — 기본값은 운영 주체명
- [ ] (선택) 푸시 실발송: `PUSH_ENABLED=1` + FCM 서비스 계정(런북 §5 참고 — 출시 비차단)
