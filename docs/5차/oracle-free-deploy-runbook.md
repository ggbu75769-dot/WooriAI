# Oracle Cloud Always Free 배포 런북 (완전 무료 경로, REL-010)

작성일: 2026-08-20 · 자산: `scripts/deploy/oracle-bootstrap.sh`, `infra/docker/docker-compose.prod.yml` + `docker-compose.caddy.yml`, `scripts/qa/backup-restore-drill.sh`(백업 복구 드릴, OPS-101)

**사용자가 직접 해야 하는 것은 §1~§3(약 30분)뿐이고, §4는 명령어 한 줄입니다.**

## 1. Oracle 계정 (10~15분, 본인만 가능 — 카드+휴대폰 인증)

1. https://signup.cloud.oracle.com — 홈 리전은 **South Korea Central (Seoul)** 선택(변경 불가).
2. 카드 등록(인증용 소액 후 환불). Always Free 리소스만 쓰면 과금 없음 — 업그레이드 안 하면 유료 전환되지 않음.

## 2. VM 생성 (10분)

콘솔 → Compute → Instances → **Create instance**:
- Image: **Ubuntu 24.04** (aarch64)
- Shape: **VM.Standard.A1.Flex** — **2 OCPU / 12GB** 권장 (Always Free 한도는 계정 전체 합산 4 OCPU/24GB)
- SSH 키: 본인 공개키 업로드(또는 콘솔에서 생성·다운로드)
- Networking: 기본 VCN 생성 그대로, **Public IP 할당** 확인
- 생성 후 **VCN → Security List → Ingress Rules에 TCP 80, 443 추가** (source 0.0.0.0/0) ← 잊기 쉬움

## 3. 준비물 2개 (5분)

- **DuckDNS 무료 도메인**: https://www.duckdns.org (GitHub 로그인) → 서브도메인 하나 생성(예: `wooriai`) → 토큰 복사. *(보유 도메인이 있으면 대신 A레코드를 VM 공인 IP로 지정하고 §4에서 `DOMAIN=` 사용)*
- **GitHub PAT**: 저장소가 비공개이므로 클론용 토큰 — github.com → Settings → Developer settings → Fine-grained token → 이 저장소만, **Contents: Read** 권한.

## 4. VM에서 한 줄 실행 (자동: Docker→클론→시크릿 생성→DB/API 기동→시드→HTTPS)

SSH 접속(`ssh ubuntu@<VM 공인 IP>`) 후:

```bash
curl -fsSL "https://raw.githubusercontent.com/ggbu75769-dot/WooriAI/master/scripts/deploy/oracle-bootstrap.sh" \
  -H "Authorization: Bearer <GITHUB_PAT>" -o bootstrap.sh \
&& sudo GITHUB_TOKEN=<GITHUB_PAT> DUCKDNS_SUBDOMAIN=<서브도메인> DUCKDNS_TOKEN=<duckdns토큰> bash bootstrap.sh
```

끝나면 마지막 줄에 **API 주소와 관리자 초기 비밀번호(1회 출력)** 가 나옵니다.
스크립트는 멱등이라 실패 시 같은 명령으로 재실행하면 됩니다.

- **재실행해도 관리자 자격증명은 안전**: 시드는 기존 관리자 계정의 비밀번호·활성 상태를 절대 되돌리지 않습니다(생성 시 1회만 적용, ADM-007). 첫 시드 성공 후에는 `ADMIN_SEED_PASSWORD` 평문이 `.env.production`에서 자동 제거(주석 처리)됩니다 — 초기 비밀번호는 스크립트 출력에서만 확인 가능하니 즉시 로그인해 교체하세요.
- 관리자 비밀번호와 헬스체크 결과 순서: 초기 비밀번호는 **헬스체크보다 먼저** 출력됩니다. 헬스체크가 실패해도(Security List 미개방, Let's Encrypt 발급 지연 등) 스크립트는 중단되지 않고 재시도 방법을 안내합니다.

## 5. 실행 직후 할 일

0. **어드민 접근 방법**: 어드민 웹은 VM에 배포되지 않는다(부트스트랩·prod compose에 없음 — 의도적). 운영자 PC의 저장소 체크아웃에서 dev 서버를 운영 API로 프록시해 접속하는 것이 기본 경로다(LP-D — 상세·대안은 `docs/operations/admin-access.md` §운영 접근 경로):
   ```bash
   ADMIN_API_PROXY_TARGET=https://<도메인> pnpm --filter admin dev
   # → http://localhost:3001 접속 후 로그인
   ```
   어드민을 VM에 컨테이너로 올리는 선택 경로는 `infra/docker/docker-compose.admin.yml` 오버레이(외부 미노출, SSH 터널 접속) — 같은 문서 참조.
1. 어드민 접속 → 초기 비밀번호로 로그인 → **즉시 비밀번호 변경 + MFA(TOTP) 등록**(강제 흐름).
2. 카카오 키가 준비되면 VM에서:
   ```bash
   sudo nano /opt/wooriai/.env.production   # OAUTH_KAKAO_* 3줄 주석 해제·값 입력
   cd /opt/wooriai && sudo docker compose -f infra/docker/docker-compose.prod.yml \
     -f infra/docker/docker-compose.caddy.yml --env-file .env.production up -d api
   ```
3. 모바일 릴리즈 빌드 env: `EXPO_PUBLIC_API_BASE_URL=https://<도메인>/api/v1`
4. 스모크 테스트: `curl https://<도메인>/api/v1/health/ready` (전체 스모크 — 근거: `grep -c '^chk ' scripts/qa/server-smoke.sh` → **37**검사 — 는 `SMOKE_BASE_URL=https://<도메인>/api/v1 bash scripts/qa/server-smoke.sh` — 테스트 데이터가 실제로 생성되니 감안)
5. `TRUST_PROXY=1` 확인: 부트스트랩이 생성하는 `.env.production`에 포함되어 있습니다(이 구성은 API가 항상 Caddy 리버스 프록시 1홉 뒤에서 동작). 이 값이 없으면 모든 요청이 프록시 IP 하나로 집계되어 per-IP rate limit이 전역 버킷 하나로 무력화됩니다. 기존 `.env.production`을 유지한 채 재실행한 경우(스크립트는 기존 파일을 덮어쓰지 않음) `TRUST_PROXY=1` 한 줄을 직접 추가하고 api를 재기동하세요.
6. (선택) FCM 푸시 실발송(PUSH-113): 부트스트랩이 생성하는 `.env.production`에는 **없으므로** 켜려면 `PUSH_ENABLED=1`과 `FCM_SERVICE_ACCOUNT_PATH=<서비스 계정 JSON 경로>` 두 줄을 직접 추가하고 api를 재기동하세요. 경로는 **api 컨테이너 안에서 읽을 수 있어야** 하므로 JSON 파일을 볼륨으로 마운트해야 합니다(JSON 내용·private key는 env/로그에 넣지 말 것 — DNC-019). 미설정이면 안전한 no-op(출시 비차단). 상태 확인: `curl https://<도메인>/api/v1/health/push` — 키 미주입 시 `enabled=false`가 정상.

## 6. 운영 메모

- **백업 — 자동 등록됨**: 부트스트랩 스크립트가 `/opt/wooriai-backup.sh`(백업 스크립트)와 `/etc/cron.d/wooriai-backup`을 자동 생성합니다(§9, OPS-101/OPS-115). 매일 18:00 UTC(03:00 KST) 실행 — 임시파일에 덤프 후 gzip 무결성·최소 크기 검증을 통과해야만 원자적으로 교체하므로 `pg_dump` 실패 시 기존 백업이 보존됩니다. 산출물은 `/opt/wooriai-backup-<요일1~7>.sql.gz` 요일별 7개 로테이션이고, 실행 결과(OK/FAIL)는 `tail /opt/wooriai-backup.log`로 확인합니다. Always Free Object Storage(20GB)로 복사해두면 무료. **복구 절차와 검증 드릴은 §부록 참조.**
- **업데이트 배포**: `cd /opt/wooriai && sudo git pull && sudo docker compose ... up -d --build` (마이그레이션은 migrate 서비스가 자동 적용).
- DuckDNS IP 갱신 크론은 스크립트가 등록함(10분 주기). 토큰은 root 전용 `/etc/wooriai/duckdns.curlconf`(600)에만 저장되고, 크론은 `/usr/local/sbin/wooriai-duckdns-update` 헬퍼(700)를 실행합니다 — 크론 파일이나 프로세스 목록에 토큰이 노출되지 않음.
- 이 스크립트는 로컬 검증 환경에 Docker 데몬이 없어 **VM 첫 실행이 곧 첫 검증**입니다. 오류 출력이 나오면 그대로 붙여넣어 주세요 — 바로 수정하겠습니다.

## 부록: 백업 복구 절차 (OPS-101 — "백업은 있는데 복구가 검증된 적이 없다" 해소)

백업 크론은 부트스트랩이 자동 등록하므로(§6) 수동으로 만들 필요가 없습니다. 이 부록은 **복구**를 다룹니다.

### A. 복구 드릴 (로컬 dev — 정기적으로 돌려서 백업 파일이 실제로 복구되는지 검증)

```bash
# dev Postgres 기동 상태에서 (localhost:5432, wooriai/wooriai_dev_password)
bash scripts/qa/backup-restore-drill.sh
```

동작: `wooriai_dev` 덤프 → 스크래치 DB `wooriai_drill` 생성·복원 → 핵심 테이블(users, children, expenses, item_templates, admin_users, product_links) 행 수를 원본과 비교 → 스크래치 DB 삭제 → PASS/FAIL 요약. 멱등이라 반복 실행해도 안전하며, 실패 시 종료 코드 1. 접속 정보는 `DRILL_PGHOST` 등 환경변수로 덮어쓸 수 있습니다(스크립트 헤더 참조). 2026-08-20 dev DB(시드+스모크 데이터)에서 6개 테이블 전부 일치로 PASS 검증 완료.

### B. 실서버 복구 (VM에서 — 데이터 유실/DB 손상 시)

```bash
cd /opt/wooriai

# 1) API 정지 (복구 중 쓰기 유입 차단)
sudo docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production stop api

# 2) 백업 선택 (요일별 로테이션: 1=월 … 7=일)
ls -lh /opt/wooriai-backup-*.sql.gz

# 3) DB 재생성 후 복원 (기존 DB를 통째로 교체)
sudo docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production \
  exec -T postgres psql -U wooriai -d postgres \
  -c "DROP DATABASE IF EXISTS wooriai;" -c "CREATE DATABASE wooriai;"
gunzip -c /opt/wooriai-backup-<요일>.sql.gz | sudo docker compose \
  -f infra/docker/docker-compose.prod.yml --env-file .env.production \
  exec -T postgres psql -U wooriai -d wooriai -v ON_ERROR_STOP=1 -q

# 4) API 재기동 + 확인
sudo docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production start api
curl -fsS https://<도메인>/api/v1/health/ready
```

주의: 복원 대상은 **백업 시점**의 데이터입니다 — 백업 이후의 변경은 사라집니다. 복원 전 현재 상태도 한 번 덤프해 두면(`pg_dump ... | gzip > /opt/wooriai-pre-restore.sql.gz`) 되돌릴 수 있습니다.

### C. (참고) 백업 크론 수동 재등록 — 부트스트랩 재실행이 가장 안전한 방법

크론이나 백업 스크립트가 사라졌다면 부트스트랩을 재실행하세요(멱등 — 기존 서비스에 영향 없이 스크립트·크론만 재생성됩니다). `/opt/wooriai-backup.sh`가 남아 있는 상태에서 크론 파일만 재등록하려면:

```bash
echo '0 18 * * * root /opt/wooriai-backup.sh >> /opt/wooriai-backup.log 2>&1' | sudo tee /etc/cron.d/wooriai-backup
```

과거의 `pg_dump | gzip > 대상파일` 원라이너는 pg_dump 실패 시 기존 백업을 빈 파일로 덮어쓰는 결함(OPS-115에서 해소)이 있으므로 다시 사용하지 마세요.
