#!/usr/bin/env bash
# LP-C: Play 업로드용 release keystore 원커맨드 생성 + GitHub 시크릿 등록 안내.
#
#   bash scripts/release/make-keystore.sh [keystore-경로]   (기본: $HOME/wooriai-release.keystore)
#
# 하는 일:
#   1. keytool로 RSA 4096 / 유효기간 12000일(약 32년) keystore 생성 — 레포 "밖"($HOME)에.
#   2. GitHub Actions(android-release.yml)가 쓰는 시크릿 4개의 값을 화면에 "만" 출력:
#        WOORIAI_KEYSTORE_B64 · WOORIAI_KEYSTORE_PASSWORD · WOORIAI_KEY_ALIAS · WOORIAI_KEY_PASSWORD
#
# 비밀값 취급 원칙 (DNC-019와 같은 태도):
#   - 비밀번호·base64 값을 파일로 남기지 않는다. 이 스크립트는 keystore 파일 하나만 만든다.
#   - 출력을 리다이렉트해 파일로 저장하지 말 것. 터미널 스크롤백에서 복사해 GitHub에 붙여넣고,
#     비밀번호는 비밀번호 관리자에 보관한 뒤 터미널을 닫아라(history에는 남지 않는다 — 인자로
#     비밀번호를 받지 않기 때문).
#   - keystore를 레포 안에 두지 말 것(*.keystore는 gitignore지만 애초에 밖이 원칙 —
#     docs/5차/launch-72h-plan.md §3.1).
set -euo pipefail

KEYSTORE_PATH="${1:-$HOME/wooriai-release.keystore}"
KEY_ALIAS="${WOORIAI_KEY_ALIAS:-wooriai}"
VALIDITY_DAYS=12000 # 약 32.8년 (30년+ — Play 요구는 2033-10-22 이후 만료)
DNAME="${WOORIAI_KEYSTORE_DNAME:-CN=WooriAI Release, OU=Mobile, O=WooriAI, L=Seoul, C=KR}"

fail() {
  echo "오류: $1" >&2
  exit 1
}

command -v keytool >/dev/null 2>&1 || fail "keytool이 없습니다. JDK 17을 설치하세요 (예: temurin-17)."
command -v base64 >/dev/null 2>&1 || fail "base64가 없습니다."

[ -e "$KEYSTORE_PATH" ] && fail "$KEYSTORE_PATH 가 이미 있습니다. 기존 keystore를 덮어쓰면 앱을 영구히 업데이트할 수 없게 될 수 있어 중단합니다. 다른 경로를 인자로 주거나, 정말 새로 만들 keystore라면 기존 파일을 직접 옮긴 뒤 다시 실행하세요."

# 레포(git 저장소) 안에 keystore를 만들려는 실수를 막는다.
KEYSTORE_DIR="$(cd "$(dirname "$KEYSTORE_PATH")" 2>/dev/null && pwd)" || fail "디렉터리가 없습니다: $(dirname "$KEYSTORE_PATH")"
if git -C "$KEYSTORE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "$KEYSTORE_DIR 는 git 저장소 안입니다. keystore는 레포 밖(\$HOME 권장)에 두세요."
fi

# 비밀번호: env(WOORIAI_KEYSTORE_PASSWORD)가 있으면 그 값, 없으면 강한 랜덤 생성.
# PKCS12(현행 keytool 기본 포맷)는 store/key 비밀번호가 사실상 하나라 같은 값을 쓴다 —
# 시크릿은 4개 계약(WOORIAI_KEY_PASSWORD 포함)을 유지하되 두 값이 동일하다.
if [ -n "${WOORIAI_KEYSTORE_PASSWORD:-}" ]; then
  STORE_PASSWORD="$WOORIAI_KEYSTORE_PASSWORD"
else
  # (head가 파이프를 먼저 닫으면 tr가 SIGPIPE로 죽어 pipefail에 걸리므로, 고정 길이만 읽어 자른다)
  STORE_PASSWORD="$(head -c 1024 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9')"
  STORE_PASSWORD="${STORE_PASSWORD:0:32}"
  [ "${#STORE_PASSWORD}" -eq 32 ] || fail "랜덤 비밀번호 생성 실패"
fi

umask 077
export STORE_PASSWORD # keytool -storepass:env가 읽는다 (인자·프로세스 목록에 비밀번호 미노출)
if ! KEYTOOL_LOG="$(keytool -genkeypair -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA -keysize 4096 \
  -validity "$VALIDITY_DAYS" \
  -dname "$DNAME" \
  -storepass:env STORE_PASSWORD \
  -keypass:env STORE_PASSWORD 2>&1)"; then
  echo "$KEYTOOL_LOG" >&2 # keytool 진단 출력 — 비밀번호는 env로만 전달돼 여기 실리지 않는다.
  fail "keytool 생성 실패 (위 keytool 출력 참고)"
fi

KEYSTORE_B64="$(base64 -w0 "$KEYSTORE_PATH" 2>/dev/null || base64 "$KEYSTORE_PATH" | tr -d '\n')"

cat <<EOF

✅ release keystore 생성 완료: $KEYSTORE_PATH
   (RSA 4096, alias=$KEY_ALIAS, 유효기간 ${VALIDITY_DAYS}일 ≈ 32년)

⚠️⚠️ 지금 바로 "서로 다른 2곳"에 백업하세요 ⚠️⚠️
   예: ① 비밀번호 관리자 첨부파일 ② 오프라인 USB/외장디스크.
   이 파일과 비밀번호를 잃으면 Play에 올린 앱을 영구히 업데이트할 수 없습니다.
   레포에 커밋 금지 · 클라우드 공유 폴더에 평문 보관 비권장.

── GitHub 시크릿 4개 등록 ─────────────────────────────────────────────
GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret
아래 이름/값 4개를 그대로 등록하세요 (이름 오타 금지 — 워크플로가 이 이름을 찾습니다):

  1) WOORIAI_KEYSTORE_B64
$KEYSTORE_B64

  2) WOORIAI_KEYSTORE_PASSWORD
$STORE_PASSWORD

  3) WOORIAI_KEY_ALIAS
$KEY_ALIAS

  4) WOORIAI_KEY_PASSWORD
$STORE_PASSWORD
     (PKCS12 keystore라 keystore 비밀번호와 같은 값입니다)

gh CLI가 있다면 파일을 거치지 않고 이렇게 등록할 수도 있습니다:
  base64 -w0 "$KEYSTORE_PATH" | gh secret set WOORIAI_KEYSTORE_B64
  gh secret set WOORIAI_KEYSTORE_PASSWORD   # 프롬프트에 비밀번호 붙여넣기
  gh secret set WOORIAI_KEY_ALIAS --body "$KEY_ALIAS"
  gh secret set WOORIAI_KEY_PASSWORD        # 프롬프트에 비밀번호 붙여넣기

── 비밀값 취급 ────────────────────────────────────────────────────────
- 위 base64/비밀번호를 파일로 저장하지 마세요(이 스크립트도 남기지 않았습니다).
- 비밀번호는 비밀번호 관리자에 보관한 뒤 이 터미널 창을 닫으세요.
- 로컬 빌드(pnpm android:build-aab)에서는 같은 값을
  WOORIAI_UPLOAD_KEYSTORE=$KEYSTORE_PATH / WOORIAI_UPLOAD_KEYSTORE_PASSWORD /
  WOORIAI_UPLOAD_KEY_ALIAS / WOORIAI_UPLOAD_KEY_PASSWORD 로 넘기면 됩니다.

다음 단계: docs/store/submission-checklist.md §0.2 (Actions 릴리즈 빌드 — 변수 등록 + Run workflow)
EOF
