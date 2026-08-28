# 라운드 58 정찰 노트 (GAP-058)

> master 071ecf8(라운드 55~57 머지) 기준. known-limitations A~I절·gap-analysis 제외 판정·round55-plan §6·round56-scout 대조 완료 — 아래는 전부 그 밖이거나 55~57이 접점으로 남긴 잔여.

## 상위 후보 (우선순위순)

1. **정기 지출 역방향 진입 부재** — 템플릿 생성이 빈 폼뿐(recurring.tsx:126 파라미터 파싱 0). 지출 상세에 "정기 지출로 등록"(액션시트는 Android 3버튼 상한이라 금지 — record-row-actions.ts:49). dayOfMonth는 spentOn 일자 기본. 선물/환불 제외. — S/M
2. **잠금 설정 화면이 실패 대기를 안 지남** — changePin/disableLock(app-lock.store.ts:114-133)이 대기 검사·실패 등록 없이 무제한 시도 가능(오버레이만 30/60/300초). I절 어느 항목도 아님(두 번째 입구). submitPin과 같은 판정 3줄 + "locked-out" 유니온. — S
3. **lockNow 死코드** — 호출부 0건. "잠깐 폰을 빌려줄 때" 위협 모델인데 지금 잠글 수단이 없음. 설정 화면 "지금 잠그기" 버튼. — S
4. **일괄 재시도 라벨 거짓** — sync-status.tsx:532가 실패 전량 계수, 실제 재큐는 필터 후(sync-engine.ts:1075-1085). 재시도 가능 0건이면 버튼 미표시(라운드 51 P2-3 선례 확장), countRetryableFailedRows 순수 판정. — S
5. **"고쳐서 다시 보내기" 미구현(56 #8 절반)** — 영구 실패 행 payload를 /expenses/new 프리필 + 저장 확정 후에만 원본 폐기. spentOn 프리필은 record-row-actions.ts:226-228 원칙의 명시적 예외(재작성). 403 제외. — M
6. **자동완성이 오프라인 대기·지난달을 못 봄** — expenseHistory=서버 이번 달 캐시만(new.tsx:569-573). 매달 1일 실종+오프라인 비대칭. recent-items의 "로컬 우선→서버 폴백"을 suggest-source 공용 모듈로. 중복 계수 주의. — S
7. **정기 지출 저장 후 기록 탭 착지** — from=recurring이 미지값 폴백(post-save-destination.ts:88-92). 홈("/(tabs)")으로 승격, KNOWN_ENTRY_SOURCES 추가. — S
8. **가져오기 101~120자 잔여 비대칭** — 57은 121+만 강등(IMPORT_TEXT_COLUMN_MAX_LENGTH=120). 확정은 DTO 미경유라 110자 지출 생성→상세에서 편집 불가. 임계를 100으로. — S
9. **문서 정합** — runtime-verification-required.md가 "인메모리 서버"(거짓)·"Kakao dev stub"·구식 체크표; store 문서에 정기 지출·앱 잠금 0건. — S
10. **감사 로그 보존 정책 부재(56C 곁가지)** — purge 잡에 audit_logs 연령 삭제 단계 없음(무한 성장). 8단계 auditLogPurge + AUDIT_LOGS_RETENTION_DAYS(기본 길게·env·근거 주석·PM 확인 문구). — M

## P3 묶음
- buildRecentMerchantSuggestions 死코드(merchant-suggest.ts:180-185) — 배선 또는 삭제
- 판매처 칩 useMemo 비대칭(new.tsx 매 렌더)
- 잠금 대기 만료 후 notice 미갱신(AppLockOverlay.tsx:119-124, 추측 표기)
- 마이그레이션 실패 시 사용자 가시성(의도된 브릭이나 표시 미확인, 추측)

## 트랙 구성 (파일 무충돌)
- **A 정기 지출 왕복**(#1 #7): recurring.tsx·recurring-template·post-save-destination·[expenseId].tsx·recurring-flow.test — new.tsx 금지(C 소유)
- **B 앱 잠금 완결**(#2 #3 +P3 notice): app-lock.store·security/app-lock·settings/app-lock.tsx·AppLockOverlay — settings/index.tsx 금지
- **C 동기화 실패 정직성**(#4 #5): sync-status.tsx·permission-denied·messages·sync-engine·failed-row-prefill(신규)·record-row-actions·new.tsx
- **D 서버·운영·문서**(#8 #9 #10): import-pipeline·purge 잡·docs/qa·docs/store — 모바일 0건
- **E 자동완성 소스 통일**(#6 +P3): suggest-source(신규)·merchant-suggest·item-autocomplete·recent-items 순수 모듈만 — 배선(new/[expenseId])은 A·C 머지 후 별도 커밋
