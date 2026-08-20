# Oracle Cloud Always Free 배포 런북 (완전 무료 경로, REL-010)

작성일: 2026-08-20 · 자산: `scripts/deploy/oracle-bootstrap.sh`, `infra/docker/docker-compose.prod.yml` + `docker-compose.caddy.yml`

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

## 5. 실행 직후 할 일

1. 어드민 접속 → 초기 비밀번호로 로그인 → **즉시 비밀번호 변경 + MFA(TOTP) 등록**(강제 흐름).
2. 카카오 키가 준비되면 VM에서:
   ```bash
   sudo nano /opt/wooriai/.env.production   # OAUTH_KAKAO_* 3줄 주석 해제·값 입력
   cd /opt/wooriai && sudo docker compose -f infra/docker/docker-compose.prod.yml \
     -f infra/docker/docker-compose.caddy.yml --env-file .env.production up -d api
   ```
3. 모바일 릴리즈 빌드 env: `EXPO_PUBLIC_API_BASE_URL=https://<도메인>/api/v1`
4. 스모크 테스트: `curl https://<도메인>/api/v1/health/ready`

## 6. 운영 메모

- **백업**: 매일 1회 `docker compose exec postgres pg_dump -U wooriai wooriai | gzip > backup.sql.gz` 크론 권장(§부록 명령 참조). Always Free Object Storage(20GB)로 복사해두면 무료.
- **업데이트 배포**: `cd /opt/wooriai && sudo git pull && sudo docker compose ... up -d --build` (마이그레이션은 migrate 서비스가 자동 적용).
- DuckDNS IP 갱신 크론은 스크립트가 등록함(10분 주기).
- 이 스크립트는 로컬 검증 환경에 Docker 데몬이 없어 **VM 첫 실행이 곧 첫 검증**입니다. 오류 출력이 나오면 그대로 붙여넣어 주세요 — 바로 수정하겠습니다.

## 부록: 백업 크론 한 줄

```bash
echo '0 18 * * * root cd /opt/wooriai && docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.production exec -T postgres pg_dump -U wooriai wooriai | gzip > /opt/wooriai-backup-$(date +\%u).sql.gz' | sudo tee /etc/cron.d/wooriai-backup
```
(요일별 7개 파일 로테이션, 매일 03:00 KST)
