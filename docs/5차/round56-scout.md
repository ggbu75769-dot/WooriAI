# 라운드 56 정찰 노트 (GAP-056)

> 라운드 55(반복 지출·PIN 잠금) 진행 중 병행 정찰. 근거 파일:라인은 master 6d8a2aa + 라운드 55 작업 트리 기준. 제외 문서(known-limitations A~H절, gap-analysis §22, round55-plan §6) 대조 완료.

## 라운드 55에 즉시 전달한 발견 (이 라운드 후보 아님)
- **정기 지출 템플릿 길이 상한 120 vs 서버 DTO 100** — `recurring-template.ts`가 varchar(120)을 미러했지만 유효 계약은 `apps/api/src/finance/dto/expense.dto.ts:45-54`의 `@MaxLength(100)`. 101~120자 템플릿 → 원탭 기록 → flush 400 → 영구 실패 행. 트랙 A에 100으로 정정 지시 전달(2026-08-28).

## 상위 후보 (우선순위순)

### #1 텍스트 길이 상한이 클라이언트에 전무 → 영구 실패 행 (금액 상한 P0-2의 텍스트판) — S/M
- 서버: expense.dto.ts itemName 100·merchant 100·memo 500(Update 동일). 클라: new.tsx·[expenseId].tsx 판매처/메모에 maxLength·가드 0건.
- 오프라인 저장 성공 후 flush 400 → RemotePermanentError → 재시도/버리기 두 갈래뿐(재시도 무익, 버리기 손실).
- 채택안: amount-limit.ts를 본뜬 `src/expenses/text-limits.ts` 단일 소스 + contracts 상수 + 서버 DTO 참조(값 불변) + 화면 maxLength+안내.
- 곁가지: DTO 100 vs 컬럼 120 vs import_rows 120 — 가져오기로는 101~120자가 들어오고 손입력은 막히는 비대칭 존재.

### #2 판매처 자동완성 부재 — S+S
- 입력(라운드 49)·검색(54 D#8)·CSV 열은 있는데 입력 보조만 없음. new.tsx:1405 주석("상호 사전이 없다")은 stale — 이번 달 지출 캐시에 판매처가 있다. item-autocomplete.ts 문법 재사용, 새 요청 0건.
- 배선 파일이 new.tsx(55 점유)라 순수 모듈 먼저, 배선은 55 머지 후.

### #3 CSV 내보내기가 오프라인 대기 기록을 조용히 누락 — S
- ExpenseCsvExport.tsx:155-164 수집기는 listExpenses만. "N건 내보냈어요"가 대기 5건을 빠뜨린 채 성공 단정. 완전 오프라인 실패 문구도 "잠시 후 다시"(대상 없음) — budget.tsx C-07 선례로 messages.ts 사용.
- 채택안: pending-scope-notice 판정 재사용(기간 스코프만) 고지 한 줄 + 문구 정정.

### #4 어드민 CS 도달 경로 — S, 완전 독립
- 서버는 expense.delete 감사 로그 + actorUserId 필터 DTO(audit-logs.dto.ts:33-35) + admin-api까지 지원. 끊긴 곳은 audit-logs/page.tsx 필터 입력칸·users-lookup 링크 0건·페이지 설명("관리자 행위"만 언급).
- 곁가지: expense.update는 감사 로그 자체가 없음(expenses.controller.ts:64-72) — 별도 판단.

### #5 가져오기 검토 재진입 불가 — S(클라 persist)
- import/index.tsx:91-94 push 후 jobId 미보관, 서버 목록 엔드포인트 없음. DNC-012상 검토 단계가 길어지는 게 정상인데 이탈=미아.
- 채택안: `wooriai-import-resume` persist 1건 + "이어서 보기" 카드 + 확정/취소 시 삭제 + PRIV-104 합류(55 트랙 C 파일이라 머지 후 1줄).

### #6 저장 후 setTimeout 내비게이션 미취소 — S
- [expenseId].tsx:437·454, new.tsx:884 — 650ms 타이머에 clearTimeout 없음 → 언마운트 후 화면 튐(뒤로 한 번 더 파임/사용자가 고른 탭 덮어씀). ExpenseCsvExport.tsx:116-123 timer-in-ref 관례로 정리. (실기기 미재현 — 코드상 취소 경로 부재는 사실)

### #7 로컬 SQLite 마이그레이션 장치 부재 — S/M, 라운드 57 권장
- sqlite-offline-store.ts CREATE IF NOT EXISTS 4벌뿐, PRAGMA user_version 0건. 기존 테이블 컬럼 추가 시 구 기기 전면 실패. permission-denied.ts:16-17이 선언한 후속 티켓(#8)의 선행 조건.

### #8 실패 행 사유 문자열 비교 → status/code 컬럼 보존 — M, #7 선행 필요, 라운드 57
- 400류에 "재시도" 대신 "고쳐서 다시 보내기"(payload 프리필) 제공. permission-denied.ts 문자열 비교 폐기.

### #9 "올해" 내보내기 상한 절단 방향이 반대 — S
- export-range.ts:375-387 닫힌 구간은 오름차순 수집 후 절단 → 오래된 행이 남고 최근 달이 버려짐("전체"·"직접 선택"은 최신 우선). 역순 통일.

### #10 record_gap 알림이 달력 뷰로 못 감 — S
- records.tsx:817 viewMode useState 고정, 파라미터 없음. RECORDS_MONTH_PARAM·drilldown nonce 관례로 `view=calendar` 추가. 덤: 달력 선호가 세션 간 저장 안 됨.

## 보류 판정 요약
리포트 3개월 평균 대비(승인 대기 파생) / 월 넘나드는 검색(서버 신규) / 새 달 예산 원탭·홈 롱프레스·알림 벨(55 트랙 C 충돌 or 실익 소) / 상세 "또 기록"(55 파일 재평가) / 판매처 부제(설계 판단 존중).

## 라운드 56 추천 트랙 (라운드 55 점유 12파일 완전 회피)
- **A 텍스트 길이 경계**: text-limits.ts(신규)+contracts+expense.dto 참조화+[expenseId].tsx(maxLength+타이머 정리 #6 상세분)
- **B 내보내기 정직성**: export-pending-notice.ts(신규)+ExpenseCsvExport(고지·문구)+export-range 절단 방향(#3·#9)
- **C 어드민 CS**: audit-logs 필터·users-lookup 링크·audit-log-filters.ts(신규) — 모바일 0건(#4)
- **D 재진입**: import-resume 스토어+카드, notification-route view=calendar+records.tsx 적용(#5·#10). PRIV-104 합류는 55 머지 후 1줄.
- **E(55 머지 직후 소커밋)**: merchant-suggest.ts 순수 모듈은 56에서, new.tsx/[expenseId].tsx 배선은 별도 커밋(#2). new.tsx의 타이머 정리(#6)도 이때.
- 라운드 57: #7→#8 오프라인 저장소 한 라운드 통짜.
