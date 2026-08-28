# 라운드 60 정찰 노트 (GAP-060)

> master c76aece(라운드 59 머지) 기준. known-limitations A~I·gap-analysis 제외·round55 §6·round56/58/59-scout 완료분·라운드 59 P2 잔여·코드 건강 보류 판정 대조 완료.

## 상위 후보
1. **가구 스코프 두 벌** — 읽기(L-4 resolveExpenseHouseholdId)는 아이 가구, 쓰기·파괴·관리(아이 추가 children.tsx:300·가족 관리·초대 생성·가구 탈퇴·더보기/설정 요약)는 defaultHouseholdId 고정. 초대 수락(accept/[token].tsx:78)이 기본 가구를 영구 변경 → 둘째가 시가 가구에 생성(앱 내 복구 불가)·H1 관리 도달 불가·이름 없는 가구 탈퇴. 최소안: 아이 추가 대상 가구를 선택 아이 기준 + 나머지 가구 이름 표기. 1가구 계정 결과 불변·FAM-001/SET-001 픽셀락 필수. — M
2. **구매 확인 루프가 기록을 모름** — completeFollowup 호출 1곳뿐, 저장 onSuccess가 대기 미해소 → 기록 후에도 "샀나요?" 재질문+purchase_pending 알림 잔존. purchase-followup-resolution 순수 판정 + onSuccess 2줄. 곁가지: "샀어요" 저장 전 done 확정(퍼널 부풀림). — S
3. **초대 수락 막다른 길 2종** — 뷰어 403 온보딩 무한 재시도(step-ui 전 실패 동일 문구), listChildren 실패를 "아이 없음"으로 단정→중복 아이. planAfterHouseholdJoin 갈래 3→5(모름/권한 없음). — S
4. **링크 실패도 구매 확인 대기 등록** — recordLinkClick이 openURL·서버 기록 앞. 실패 시 등록 취소 + 커머스 경로 오프라인 정직 문구(useSaveErrorCopy) 합류. — S
5. **가져오기 행 무기한 보존** — import_rows 연령 파기 없음(미승인 행 포함), privacy-policy "승인한 내역만 저장"과 불일치, phase 8 주석 거짓. purge phase 9(IMPORT_ROWS_RETENTION_DAYS 기본 90·근거 주석) + 문서 정합. rawJson 죽은 컬럼 주석. — M
6. **잠금 중 품목명 낭독** — PurchaseFollowupPrompt가 잠금 오버레이 순간 announceForA11y(명령형 — 방패 통과). I절 4번("품목명 원문 아님")의 반례. 잠금 blocking 동안 판정 보류 + I절 정정. 실기기 미실측 표기. — S
7. **쓰기 화면 아이 라벨 부재** — new/[expenseId]/budget/recurring에 스코프 라벨 0(4탭은 라운드 48~49 완비). withChildScopeLabel 재사용, EXP-001 비세션 불변. — S
8. **부하 스모크 볼륨 축 부재** — 수용한 위험(H절 홈 전량 조회·F절 깊은 커서·델타)의 크기를 잰 적 없음. load-smoke.mjs 볼륨 파라미터+시드 축+재측정 문서. — S/M
9. **온보딩 단계 이탈 계측 사각** — 이벤트 9종에 온보딩 완료뿐(퍼널 1단이 이미 완료). 단계 enum 이벤트 추가(append-only·PII-lint 통과·마이그레이션 0). — M
10. **홈 당겨서 새로고침 ["home"]만** — 쿼리 6개 중 1개 갱신, 히어로와 주간 카드 숫자 갈림. — S

## P3
저장소 열기 실패 가시성(runtime-verification §5 항목에 코드 대응), 더보기/설정 요약 스코프 혼합(#1 흡수), rawJson 주석, 샀어요 미저장 퍼널.

## 트랙 구성
- **A 가구 스코프 단일화**(#1): household-scope.ts(신규)·settings/children·family/index·family/invite·settings/privacy·more.tsx·settings/index — accept/[token](C)·records-list-view(재사용만) 금지, 1가구 불변 계약+픽셀락
- **B 커머스 왕복 마감**(#2 #4 #6 +#7 new.tsx 몫): purchase-followup-resolution(신규)·PurchaseFollowupPrompt·purchase-followup.store·items/[itemTemplateId]·new.tsx·known-limitations I절 정정 — security 읽기만·notifications 미접촉
- **C 초대·온보딩 여정**(#3 #9): household-join·accept/[token]·onboarding step-ui·(onboarding)/*·contracts/analytics·admin analytics(+api e2e) — family/index·invite(A) 금지, append-only·PII-lint
- **D 서버 보존·실측**(#5 #8): purge 잡·schema 주석·.env.example·check-env·load-smoke.mjs·문서 — 모바일 0건, 라운드 58 #10 선례
- **E(소, B 머지 후)**(#7 나머지 #10): [expenseId]·budget·recurring·(tabs)/index — new.tsx(B)·child-switch(재사용만) 금지, B 어휘 준수
