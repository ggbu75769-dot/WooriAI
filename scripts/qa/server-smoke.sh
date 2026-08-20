#!/usr/bin/env bash
# 실서버 핵심 루프 스모크 v2 (확정 계약 기반) — 사용법: dev 서버 기동 후 SMOKE_BASE_URL=<베이스> bash scripts/qa/server-smoke.sh
set -uo pipefail
B="${SMOKE_BASE_URL:-http://localhost:3400/api/v1}"
J='content-type: application/json'
fail=0
step() { echo -e "\n=== $1 ==="; }
chk() { if [ "$2" != "0" ]; then echo "  ✗ FAIL: $1"; fail=$((fail+1)); else echo "  ✓ $1"; fi }

step "1. dev oauth 로그인"
LOGIN=$(curl -s -X POST $B/auth/oauth-login -H "$J" -d '{"provider":"kakao","providerToken":"dev-kakao"}')
AT=$(echo "$LOGIN" | jq -r '.tokens.accessToken // empty'); RT=$(echo "$LOGIN" | jq -r '.tokens.refreshToken // empty')
HH=$(echo "$LOGIN" | jq -r '.user.households[0].id')
chk "액세스 토큰 발급" $([ -n "$AT" ]; echo $?)
A="authorization: Bearer $AT"

step "2. /me + 리프레시 회전·재사용 탐지"
chk "/me" $(curl -s $B/me -H "$A" | jq -e '.user.id' >/dev/null; echo $?)
REF=$(curl -s -X POST $B/auth/refresh -H "$J" -d "{\"refreshToken\":\"$RT\"}")
AT2=$(echo "$REF" | jq -r '.accessToken // empty'); RT2=$(echo "$REF" | jq -r '.refreshToken // empty')
chk "리프레시 회전" $([ -n "$AT2" ] && [ "$RT2" != "$RT" ]; echo $?)
chk "구 RT 재사용 401" $([ "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/refresh -H "$J" -d "{\"refreshToken\":\"$RT\"}")" = "401" ]; echo $?)
A="authorization: Bearer $AT2"

step "3. 온보딩: 동의 → 아이 생성 → 예산"
chk "필수 동의 저장" $(curl -s -X PUT $B/consents -H "$A" -H "$J" -d '{"consents":[{"type":"terms","version":"2026-07-06","accepted":true},{"type":"privacy","version":"2026-07-06","accepted":true}]}' | jq -e '.' >/dev/null; echo $?)
CHILD=$(curl -s -X POST $B/children -H "$A" -H "$J" -H "Idempotency-Key: smoke-child-$RANDOM" -d "{\"householdId\":\"$HH\",\"nickname\":\"스모크\",\"stageMode\":\"born\",\"birthDate\":\"2026-06-01\"}")
CID=$(echo "$CHILD" | jq -r '.child.id // .id // empty')
chk "아이 생성" $([ -n "$CID" ]; echo $?)
YM="$(date +%Y-%m)"
BUD=$(curl -s -X PUT $B/children/$CID/budget -H "$A" -H "$J" -d "{\"yearMonth\":\"${YM}-01\",\"amountKrw\":500000}")
chk "예산 설정(500,000)" $(echo "$BUD" | jq -e '[.. | numbers] | any(. == 500000)' >/dev/null; echo $?)

step "4. 지출: 생성→홈→수정(버전)→충돌 409"
CATID=$(curl -s $B/categories -H "$A" | jq -r '.categories[0].id')
EXP=$(curl -s -X POST $B/children/$CID/expenses -H "$A" -H "$J" -H "Idempotency-Key: smoke-exp-$RANDOM" -d "{\"amountKrw\":38500,\"categoryId\":\"$CATID\",\"itemName\":\"기저귀\",\"spentOn\":\"$(date +%Y-%m-%d)\"}")
EID=$(echo "$EXP" | jq -r '.expense.id // .id // empty'); VER=$(echo "$EXP" | jq -r '.expense.version // .version // 1')
chk "지출 생성" $([ -n "$EID" ]; echo $?)
chk "홈 합계 반영" $(curl -s "$B/home?childId=$CID" -H "$A" | jq -e '[.. | numbers] | any(. >= 38500)' >/dev/null; echo $?)
PATCH=$(curl -s -X PATCH $B/expenses/$EID -H "$A" -H "$J" -d "{\"amountKrw\":40000,\"expectedVersion\":$VER}")
chk "수정(낙관적 잠금)" $(echo "$PATCH" | jq -e '[.. | numbers] | any(. == 40000)' >/dev/null; echo $?)
chk "스테일 버전 409" $([ "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $B/expenses/$EID -H "$A" -H "$J" -d "{\"amountKrw\":41000,\"expectedVersion\":$VER}")" = "409" ]; echo $?)

step "5. 카테고리 12종"
chk "목록" $(curl -s $B/categories -H "$A" | jq -e '.categories | length >= 12' >/dev/null; echo $?)

step "6. 준비템: 목록→상태→상세"
ITEMS=$(curl -s "$B/children/$CID/items?tab=now" -H "$A")
TID=$(echo "$ITEMS" | jq -r '.items[0].id // empty')
chk "목록" $([ -n "$TID" ]; echo $?)
ST=$(curl -s -X PATCH $B/children/$CID/items/$TID/status -H "$A" -H "$J" -d '{"status":"prepared"}')
chk "상태 prepared" $(echo "$ST" | jq -e '(.. | strings) | select(.=="prepared")' >/dev/null; echo $?)
DET=$(curl -s $B/children/$CID/items/$TID -H "$A")
PLID=$(echo "$DET" | jq -r '.productLinks[0].id // empty')
chk "상세+상품링크" $([ -n "$PLID" ]; echo $?)

step "7. 제휴 클릭 + 공개 리다이렉트"
CLK=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/product-links/$PLID/click -H "$A" -H "$J" -d "{\"childId\":\"$CID\"}")
chk "클릭 기록(2xx)" $([ "${CLK:0:1}" = "2" ]; echo $?)
chk "무효 코드 404" $([ "$(curl -s -o /dev/null -w '%{http_code}' $B/../r/AAAAAAAAAAAA)" = "404" ]; echo $?)

step "8. 리포트: 월간/카테고리(연)/누적/100일"
MON=$(curl -s "$B/children/$CID/reports/monthly?yearMonth=${YM}" -H "$A")
chk "월간 total>=40000" $(echo "$MON" | jq -e '.totalExpenseKrw >= 40000' >/dev/null; echo $?)
chk "카테고리(연)" $(curl -s "$B/children/$CID/reports/category?year=$(date +%Y)" -H "$A" | jq -e '.categories | length >= 1' >/dev/null; echo $?)
chk "누적" $(curl -s "$B/children/$CID/reports/cumulative" -H "$A" | jq -e '.' >/dev/null; echo $?)
MIL=$(curl -s "$B/children/$CID/reports/milestone?type=d100" -H "$A")
chk "100일 partial(생후 <100일)+총액 포함" $(echo "$MIL" | jq -e '.type=="d100" and .partial==true and .totalKrw >= 40000' >/dev/null; echo $?)

step "9. 디바이스: 등록→업서트→토글"
DEV=$(curl -s -X POST $B/me/devices -H "$A" -H "$J" -d '{"pushToken":"ExponentPushToken[smoke]","platform":"android"}')
DID=$(echo "$DEV" | jq -r '.id // empty')
chk "등록" $([ -n "$DID" ]; echo $?)
chk "업서트 동일 id" $([ "$(curl -s -X POST $B/me/devices -H "$A" -H "$J" -d '{"pushToken":"ExponentPushToken[smoke]","platform":"android"}' | jq -r '.id')" = "$DID" ]; echo $?)
chk "토글 off" $(curl -s -X PATCH $B/me/devices/$DID -H "$A" -H "$J" -d '{"notificationEnabled":false}' | jq -e '.notificationEnabled == false' >/dev/null; echo $?)

step "10. 분석 이벤트(멱등)"
EV="{\"events\":[{\"eventId\":\"11111111-1111-4111-8111-111111111111\",\"name\":\"app_opened\",\"occurredAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"schemaVersion\":1,\"payload\":{}}]}"
chk "수집" $(curl -s -X POST $B/analytics/events -H "$A" -H "$J" -d "$EV" | jq -e '.' >/dev/null; echo $?)
chk "중복 멱등" $(curl -s -X POST $B/analytics/events -H "$A" -H "$J" -d "$EV" | jq -e '.' >/dev/null; echo $?)

step "11. 델타 동기화"
chk "expense 델타" $(curl -s "$B/sync/changes" -H "$A" | jq -e '.changes | length >= 1' >/dev/null; echo $?)

step "11. 워커 하트비트 (INF-007)"
WH=$(curl -s ${B%/api/v1}/api/v1/health/worker)
chk "worker health 응답 형태" $(echo "$WH" | jq -e 'has("enabled") and has("stale") and has("jobs")' >/dev/null; echo $?)

echo -e "\n================= 결과: 실패 $fail 건 ================="
