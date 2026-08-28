# 라운드 61 정찰 노트 (GAP-061)

> master b226742(라운드 60 머지) 기준. known-limitations A~I·제외 판정·round55 §6·round56~60-scout·round61-backlog(락 — 트랙 A 진행 중)·서버 승인 대기·코드 건강 보류 대조 완료.

## 상위 후보
1. **"다른 가구 보기" Android 3버튼 상한 초과** — family/index.tsx:357 Alert 버튼=1+가구 수, 3가구부터 마지막(=기본 가구 쪽) 무언 잘림. 저장소가 세 번 문서화한 함정(ANDROID_ALERT_BUTTON_LIMIT·inviteRolePrompt 선례)을 라운드 60 신설만 지나침. householdSwitchPrompt 순수 판정(상한 초과를 자르지 말고 사실 반환). — S
2. **가구 탈퇴 후 세션 잔재** — privacy.tsx onSuccess가 캐시만 무효화, householdIds/Roles/defaultHouseholdId 방치 → 나간 가구가 후보·판정·다음 탈퇴 대상에 잔존(persist라 재시작 무효). revalidateHouseholdRoles({force:true}) 1줄 + 나간 가구가 기본이면 비움("덮어쓰지 않는다" 계약과 무충돌 근거). — S
3. **가구 전환이 초대·탈퇴 화면에 미전달** — 전환 상태가 화면 지역이라 invite.tsx가 아이 가구로 재계산 → 빈 가구 보며 만든 초대가 다른 가구로 감(+돌아오면 목록에 없음 — C-04 재발). householdId 파라미터(아는 가구 화이트리스트 검증·모르면 무시). 탈퇴 화면은 후속. — S/M
4. **local_expenses synced 행 무한 누적 + 스냅샷 전량 로드** — 동기화 성공·adoptServerExpense가 행을 남기고 listLocalExpenses 무제한 SELECT * → 8화면 구독 스냅샷이 저장마다 전량 왕복. 최소안: counts 전용 쿼리 분리+부팅 1회 오래된 synced 파기(conflict·pendingDelete·비canonical 제외 계약 선행, "이 품목 이력" 모집단 확인). — M
5. **온보딩 단계 이벤트 읽기 경로 부재(60 #9 반쪽)** — payload->>'step' GROUP BY(ANA-128 선례)+요약 DTO+퍼널 4단 접두. 서버·어드민만. — M
6. **오프라인 저장소 부팅 실패 거절 캐시** — storePromise 실패가 영구 캐시·전부 삼켜짐(runtime-verification 실기기 항목의 코드 대응). 실패 시 재오픈 허용+스냅샷 상태 한 칸+정직 문구(래치). — S/M
7. **admin_sessions 정리 잡 부재** — ip·UA 실린 행 무기한(다른 세션 테이블은 전부 잡 있음). admin-session-cleanup.job + env 스펙. — S
8. **실기기 체크표 라운드 58~60 공백 재발** + a11y 스윕 밖 2줄(정기 지출·달력 픽커) 편입. — S
9. **커밋된 4.1MB .tmp-export-test 번들** — 옛 소스 전문이 grep 오염(실사 확인). 삭제+gitignore(픽셀락 런타임 참조 재확인 후). — S
10. **임신 42주 고착** — 예정일 경과 후 라벨·밴드·칩이 임신 후기 유지. 표시층에서 유예 초과 시 주차 미표기(도메인 계약 불변). — S

## P3
첫돌 이후 리포트 고착(설계 판단), 단계 계측 동의 타이밍 과소 계수(분해 도입 시 문서화), viewedHouseholdId 복귀 마찰(#3 설계에서), 탈퇴 가구의 템플릿·알림 잔재(#2 설계에서).

## 트랙 구성 (A=락 진행 중)
- **B 가구 여정 마감**(#1 #2 #3, B 안 순서 #2→#1→#3): household-scope·family/index·family/invite·settings/privacy·invite-flow — accept/[token]·session.store 구조 변경 금지, 1가구 불변·FAM-001 재확인
- **C 오프라인 저장소 수명**(#4 #6): sqlite-offline-store·sync-controller·types·messages·sync-edge-cases — 화면 0건·sync-engine 읽기만·파기 제외 계약 선행
- **D 어드민·서버 운영**(#5 #7): analytics-summary(+dto)·admin analytics·admin-session-cleanup(신규)·worker/scheduler·check-env — 모바일 0건·**새 e2e는 shared 레인, exclusive-suites 등재 금지(트랙 A 충돌)**
- **E 실기기·건강(소)**(#8 #9 #10 표시층): runtime-verification·접근성 체크리스트·a11y-contract 스윕·.tmp-export-test 삭제·stage 표시층(주차 미표기 — 도메인 불변)
