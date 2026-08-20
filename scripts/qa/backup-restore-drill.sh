#!/usr/bin/env bash
# 백업·복구 드릴 (OPS-101) — "백업은 있는데 복구가 검증된 적이 없다"를 로컬에서 해소한다.
#
# 무엇을 하나:
#   1. dev Postgres(wooriai_dev)를 pg_dump로 덤프
#   2. 스크래치 DB(wooriai_drill) 생성 후 덤프를 복원
#   3. 핵심 테이블 행 수를 원본 ↔ 복원본 비교
#   4. 스크래치 DB 삭제 + PASS/FAIL 요약 출력
#
# 사용법 (로컬 dev DB 기동 상태에서):
#   bash scripts/qa/backup-restore-drill.sh
#
# 접속 정보는 환경변수로 덮어쓸 수 있다:
#   DRILL_PGHOST(기본 localhost) DRILL_PGPORT(5432) DRILL_PGUSER(wooriai)
#   DRILL_PGPASSWORD(wooriai_dev_password) DRILL_SOURCE_DB(wooriai_dev) DRILL_SCRATCH_DB(wooriai_drill)
#
# 멱등: 이전 실행이 남긴 스크래치 DB가 있으면 먼저 삭제하고 시작하며,
# 종료 시(실패 포함) 스크래치 DB와 덤프 임시 파일을 정리한다.
set -euo pipefail

PGHOST="${DRILL_PGHOST:-localhost}"
PGPORT="${DRILL_PGPORT:-5432}"
PGUSER="${DRILL_PGUSER:-wooriai}"
PGPASSWORD="${DRILL_PGPASSWORD:-wooriai_dev_password}"
export PGHOST PGPORT PGUSER PGPASSWORD

SOURCE_DB="${DRILL_SOURCE_DB:-wooriai_dev}"
SCRATCH_DB="${DRILL_SCRATCH_DB:-wooriai_drill}"
# 무결성을 대표 검증할 핵심 테이블 (사용자·아이·지출·준비템·관리자·제휴링크)
KEY_TABLES=(users children expenses item_templates admin_users product_links)

DUMP_FILE="$(mktemp -t wooriai-drill-XXXXXX.sql)"
log() { echo -e "\n[drill] $*"; }

# psql 공통 래퍼: -X(개인 psqlrc 무시), 오류 즉시 중단
q() { psql -X -v ON_ERROR_STOP=1 "$@"; }

cleanup() {
  q -d postgres -qc "DROP DATABASE IF EXISTS ${SCRATCH_DB};" >/dev/null 2>&1 || true
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

log "0. 접속 확인: ${PGUSER}@${PGHOST}:${PGPORT}/${SOURCE_DB}"
q -d "$SOURCE_DB" -qc "SELECT 1;" >/dev/null \
  || { echo "[drill] dev DB에 접속할 수 없습니다 — docker compose(infra/docker/docker-compose.yml) 또는 로컬 Postgres 기동 여부를 확인하세요."; exit 1; }

log "1. pg_dump: ${SOURCE_DB} → ${DUMP_FILE}"
pg_dump -d "$SOURCE_DB" --no-owner --no-privileges -f "$DUMP_FILE"
echo "[drill]   덤프 크기: $(du -h "$DUMP_FILE" | cut -f1)"

log "2. 스크래치 DB 재생성: ${SCRATCH_DB} (있으면 삭제 후 생성 — 멱등)"
q -d postgres -qc "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
q -d postgres -qc "CREATE DATABASE ${SCRATCH_DB};"

log "3. 복원: ${DUMP_FILE} → ${SCRATCH_DB}"
q -d "$SCRATCH_DB" -q -f "$DUMP_FILE" >/dev/null

log "4. 핵심 테이블 행 수 비교 (원본 ↔ 복원본)"
fail=0
printf '%-16s %12s %12s   %s\n' "테이블" "원본" "복원본" "판정"
printf '%-16s %12s %12s   %s\n' "----------------" "------------" "------------" "----"
for t in "${KEY_TABLES[@]}"; do
  src="$(q -d "$SOURCE_DB"  -Atqc "SELECT count(*) FROM ${t};")"
  dst="$(q -d "$SCRATCH_DB" -Atqc "SELECT count(*) FROM ${t};")"
  if [ "$src" = "$dst" ]; then verdict="OK"; else verdict="MISMATCH"; fail=$((fail+1)); fi
  printf '%-16s %12s %12s   %s\n' "$t" "$src" "$dst" "$verdict"
done

log "5. 스크래치 DB 삭제"
q -d postgres -qc "DROP DATABASE IF EXISTS ${SCRATCH_DB};"

if [ "$fail" = "0" ]; then
  log "PASS ✅  덤프→복원→행 수 일치 (${#KEY_TABLES[@]}개 핵심 테이블 전부) — 백업 파일로 복구 가능함이 검증되었습니다."
else
  log "FAIL ❌  ${fail}개 테이블에서 행 수 불일치 — 백업/복원 경로를 점검하세요."
  exit 1
fi
