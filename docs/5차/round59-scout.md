# 라운드 59 정찰 노트 (GAP-059)

> master 8f04a4d(라운드 58 머지) 기준. known-limitations A~I·gap-analysis 제외·round55 §6·round56/58-scout 완료분 대조 완료. 라운드 58 P3 잔여 2건 편입(#7은 원인 재진단 — "카운터 유실"이 아니라 동시 제출 가드 대칭).

## 상위 후보
1. **영구 실패(4xx) 행 5중 거짓** — 라운드 57~58이 연 상태의 미봉합: 기록 탭 합계(expense-list-reconciliation:92-110)·리포트 고지("대기 중" 문구)·CSV 고지·정기 지출 "기록됨" 판정(실패 행이 카드 끔)·자동완성 모집단(실패 공장). isPermanentlyFailedSyncRow 술어 신설. **설계 긴장**: 합계 제외는 정기 지출 판정만, 기록 탭은 고지, 리포트·CSV는 어휘 분리("대기" vs "보낼 수 없음") — 한 술어로 통일 금지. recurring-template:513-527 공유 근거 문단을 4자리 체계로 개정. — M
2. **고쳐서 다시 보내기 from 부재** — 저장 후 기록 탭 착지(원본 폐기가 보이는 화면은 sync-status뿐). "sync-fix" 소스 + "/sync-status" 목적지(replace 적정성 확인). new.tsx 무변경 성립. — S
3. **잠금 오버레이 TalkBack 투과** — Stack과 오버레이가 형제라 접근성 트리가 z-order로 안 잘림 → 잠금 중 금액·품목 낭독 가능(실측 표기). I절 4번("화면 노출은 없지만")이 명시 부정한 범위라 재제안 아님. importantForAccessibility — 단 비잠금 트리 무변경 계약·픽셀락 경로 유지 필수. — S/M
4. **정기 지출 상한 20 전역 vs 화면 아이별 표기** — 다자녀 막다른 길 + sanitize 전역 절단으로 최근 템플릿 소실. ⓐ 아이별 상한(정직) vs ⓑ 표기 정정(소형). — S
5. **다른 아이 실패 행 버튼 무언 부재** — J-9 관례(지우지 말고 사실을 말한다)의 예외. 안내 한 줄. — S
6. **check:env 17키 정체(실제 50키)** — INVITE_LINK_BASE_URL(죽은 초대 링크)·TRUST_PROXY(레이트리밋 오집계)·EXPO_PUBLIC_API_BASE_URL·WORKER_ENABLED 게이트 밖 + 드리프트 가드 부재. — S
7. **잠금 오버레이 busy 가드 부재** — 동시 제출 가드 대칭(설정 화면과 동일 모양). 카운터 자체는 동기 등록이라 유실 아님(SecureStore 역순 완료 경합·문구 되감김이 실제 노출면). — S
8. **admin E2E가 라운드 56 CS 경로 미커버** — users-lookup·actorUserId 딥링크·categories·disclosures·clicks 미방문. — M
9. **실서버 스모크에 거절 계약 0건** — CAT-124 12/21/400·금액 상한 400·텍스트 100/500 400·가져오기 임계 — 영구 실패 행 방지의 서버 절반 실측. chk 4~6줄. — S
10. **접근성 체크리스트 Batch 11 정체** — 라운드 33~58 신설 화면 부재. 코드 스윕(a11y-contract)에 오버레이 모달 계약 고정 + 문서 갱신. — S

## P3
- 역방향 등록 중복 가드 부재(같은 템플릿 2개), 프리필 날짜의 초안 누출 비대칭, 프리필 분류 캐시 도착 전 영구 비움, 오버레이 notice recovery 전이 잔류(추측).

## 코드 건강 판정
- index.tsx·new.tsx 분리 **비권장**(픽셀락 기준선 위험), client.ts 분할 보류(D절 위험 불변), 라운드 58 死코드 해소 확인, 신기능 계약 사각 없음(사각은 브라우저·실서버 계층).

## 트랙 구성
- **A 영구 실패 정직성**(#1): permission-denied·expense-list-reconciliation·pending-scope-notice·export-pending-notice·suggest-source·recurring-template(recordedItemNamesForMonth만)·messages — 화면 배선 0(모듈 인자가 스냅숏 전량)
- **B 접점 마감**(#2 #4 #5 +P3 중복 가드): post-save-destination·failed-row-prefill·sync-status.tsx·recurring.tsx·recurring-expense.store — recurring-template(A 소유)·new.tsx 금지, 상한 판정은 스토어 쪽
- **C 잠금 완결 III**(#3 #7 +P3 notice): _layout.tsx·AppLockOverlay·게이트 계약·a11y-contract — settings/app-lock.tsx·security/app-lock.ts 금지, 비잠금 트리 무변경·픽셀락 필수 확인
- **D 런치 게이트**(#6 #8 #9 #10): check-env·.env.example·server-smoke.sh·admin-e2e.mjs·접근성 체크리스트·상태 문서 — 모바일·api 소스 0건
- 머지 순서: A→B(문구 어휘 의존 시), C·D 독립.
