# 실가계부 앱 대비 격차·오류 분석 (GAP-054)

> 라운드 53 정찰. 실행은 DSN-053(디자인 복원) 완료 후. 근거 파일:라인은 정찰 시점(a43dc09) 기준.

## P0 오류 3건 (최우선)
1. **환불 기록 수정 시 지출로 둔갑** — 상세 화면이 expenseType을 isGift 삼항으로 재구성해 refund가 "expense"로 덮임 → 월 합계 오염, 앱 내 복구 불가. 수정: 원본 refund면 payload에서 expenseType 생략 + 환불 배지 + 선물 체크박스 비활성. 서버 무변경.
2. **금액 상한 부재** — int4 상한(2,147,483,647) 초과 입력이 로컬 저장 성공 후 flush에서 5xx 무한 재시도 poison. 수정: 클라 가드 + 서버 @Max 검증(마이그레이션 불필요) + contracts max.
3. **리포트 탭만 오프라인 대기 미반영** — 홈/기록/예산은 재조정, 리포트는 서버 집계만 → 화면 간 숫자 불일치. 수정: 대기 N건 고지 한 줄(합계 재조정은 두 벌 규칙 위험 — 고지 우선).

## P1 격차 (가계부 표준인데 없음)
4. **반복/고정 지출** — 전무. 최소안: 로컬 반복 템플릿 + "이번 달 정기 지출 N건 미기록" 리마인더 카드(자동 기록 금지 — 허위 데이터). 서버 테이블(000021 추가만)은 후속.
5. **카테고리별 예산** — 총액 1행뿐. 유니크 제약 교체가 필요해 PM 승인 대상(후속). 대체안: 리포트 카테고리 카드에 "지난 3개월 평균 대비 ±N%" 한 줄.
6. **기록 리마인더** — 인앱 record_gap 종류 추가("3일 동안 기록이 없어요" → 달력 딥링크), 주 1회 dedupe. 푸시는 A절이라 불가(재제안 아님).
7. **날짜 달력 픽커** — 14일 칩+ISO 손타이핑뿐. 기존 buildCalendarMonth 재사용 선택기(미래 비활성 유지, EXP-001 불변).
8. **판매처 검색 미지원** — matchRecordSearch가 itemName·memo만. merchant 갈래+스니펫 추가.
9. **앱 잠금 없음** — PIN 잠금(의존성 0, SecureStore+persist), _layout 게이트 + 3초 밸브 관례 필수. 생체는 의존성=사용자 몫.
10. **결제수단 수정 불가** — 서버 PATCH는 열려 있는데 상세 화면이 읽기 전용. 편집 컨트롤 + payload 1줄.
11. **내보내기 고정 3구간·CSV만** — 사용자 지정 yearMonth 범위 추가(xlsx는 새 의존성이라 제외).
12. **기간 자유 지정 통계** — 서버 신규 엔드포인트 선행 필요(후속 티켓).

## 제외 판정(근거 요약)
수입(income) enum 확장=의미 변경(PM 승인)/ 월 시작일=경계 하드코딩 전면/ 고정·변동비=#4 선행/ 다크 모드=P1 트랙 충돌+DNC-017 대응표/ 접근성 배율=P1 파일 겹침(후속)/ 사진·위젯·숏컷=DNC-016·android 손패치 금지/ 온보딩 중단=잔여 미발견.

## 실행 트랙(디자인 복원 후, 파일 무충돌)
- **A 기록 정합·금액 경계**: #1 #2 #10 — [expenseId].tsx, expense-detail-rows, budget 2화면, expense.dto @Max, upsert-budget.dto, contracts (서버 검증만·먼저)
- **B 리포트 정합·리마인더**: #3 #6 — reports.tsx, pending-scope-notice(신규), notifications 5파일
- **C 기록 입력**: #7 (+#2 클라 가드) — new.tsx, entry-form-guards, date-picker-month(신규). 상한 문구는 entry-form-guards 단일 소스(A가 import)
- **D 조회·이동성**: #8 #11 — records-list-view, records.tsx, export-range, ExpenseCsvExport
- 후속 단독: #4 반복 지출, #9 앱 잠금, #5/#12 서버 승인 건
