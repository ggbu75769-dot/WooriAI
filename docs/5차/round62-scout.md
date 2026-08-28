# 라운드 62 정찰 노트 (GAP-062)

> master c4a4cce(라운드 61 머지) 기준. do-not-change.md(DNC-001~020)·known-limitations A~I절·
> gap-analysis 제외 판정·round55-plan §6 비범위표·round56~61-scout 완료분·round61-backlog(락 —
> 봉합 완료, 동시 실행 구멍은 "이름만 붙였다"로 명명됨) 대조 완료. 아래는 전부 그 밖이거나,
> 라운드 58~61이 접점으로 남긴 잔여(라운드 61이 명시한 후속 후보 포함)다.

## 상위 후보

### 1. 지출 쓰기가 `["report"]`를 무효화하지 않는다 — 핵심 루프의 "총액 확인"이 옛 숫자를 말한다 — S
- **근거**: 지출 쓰기 경로 넷이 무효화하는 키에 `["report"]`가 없다 —
  `app/expenses/new.tsx:1213-1214`(expenses·home), `app/expenses/[expenseId].tsx:650-651`(수정)·
  `:670`(삭제), `src/offline/sync-controller.ts:243-255`(flush 확정: expenses·home·items·item-detail).
  반면 **가져오기 확정**(`app/import/[importJobId].tsx:416`)과 **예산 저장**(`app/budget.tsx:238`)은
  둘 다 `["report"]`를 무효화한다 — 규칙이 이미 있는데 지출 경로만 지나쳤다.
  리포트 탭의 쿼리 키는 전부 `["report", …]`다(`app/(tabs)/reports.tsx:261-419`).
- **실패 시나리오**: 리포트 탭은 탭 전환으로 언마운트되지 않으므로(react-navigation 기본) 돌아와도
  `refetchOnMount`가 돌지 않고, `staleTime: 30_000`(`app/_layout.tsx:28`)과 포커스 리페치는 **앱
  포그라운드 복귀**에만 걸린다. 즉 리포트를 한 번 열어 둔 뒤 FAB로 3건을 기록하고 리포트로 돌아오면
  월간 합계·카테고리 도넛·6개월 추이가 **기록 전 값 그대로**다. 더 나쁜 것은 시점이다:
  오프라인 대기 동안에는 "반영되지 않은 기록 N건" 고지가 사실을 말하지만
  (`app/(tabs)/reports.tsx:209-239` — 고지는 비-synced 행만 센다), flush가 확정되는 순간 그 고지가
  **사라지고** 서버 집계 캐시는 여전히 낡은 채로 남는다 — 경고가 걷히는 그 순간에 숫자가 조용히
  틀린다.
- **최소안**: 네 자리의 무효화 목록에 `["report"]` 한 줄씩. 홈·기록 탭은 이미 `["home"]`·
  `["expenses"]`로 갱신되므로 추가 요청은 리포트 탭이 **활성일 때만** 발생한다(비활성 쿼리는
  invalidate가 refetch를 일으키지 않는다). `refresh-wiring-contract.test.ts`에 "지출 쓰기 4경로가
  리포트 캐시를 갱신한다"는 소스 계약을 추가해 다음에 생길 쓰기 경로가 다시 빠뜨리지 않게 한다.
- **설계 긴장**: `["budget"]`도 같은 상태다(`usedAmountKrw`를 싣는데 아무 지출 쓰기도 무효화하지
  않는다). 예산 화면은 스택 화면이라 마운트마다 다시 물으므로 증상이 30초 창에 그친다 —
  같은 줄에 넣을지, 리포트만 고칠지는 트랙에서 판단. 리포트 합계를 **클라이언트에서 재조정하는
  것은 금지**(집계 규칙 두 벌 — `src/reports/pending-scope-notice.ts` 머리말이 이미 못박았다).

### 2. 알림을 눌러도 **그 알림의 아이**로 데려가지 않는다 — S/M
- **근거**: `src/notifications/notification-route.ts:149-168` `notificationTapRoute`는
  `entry.type`·`entry.dedupeKey`만 읽고 `entry.childId`를 **한 번도 보지 않는다**.
  화면은 그 결과를 그대로 push한다(`app/notifications.tsx:309`). 착지 화면은 전부
  **지금 선택된 아이**로 동작한다 — `/budget`(`app/budget.tsx:86`),
  `/items/{id}`(`app/items/[itemTemplateId].tsx:278`), `/(tabs)/items`·`/(tabs)/records`.
  정작 행 제목은 R20-C가 **다른 아이의 태명을 접두로 붙여** 그리고 있다
  (`src/notifications/notification-child-label.ts`).
- **실패 시나리오**: 다자녀 가구에서 둘째로 전환해 홈을 열면 둘째의 `budget_80` 알림이 쌓인다.
  첫째로 돌아와 알림함에서 "튼튼이 · 이번 달 예산의 80%를 사용했어요"를 누르면 **첫째의 예산 수정
  화면**이 열리고, 그 화면의 [저장]은 첫째의 `(childId, yearMonth)` 예산을 덮는다 — 예산 행은
  이월도 이력도 없고 서버 감사 로그도 없어(후보 7) 앱 안에서 복구할 방법이 없다.
  `purchase_pending`은 더 직접적이다: 다른 아이의 준비템 상세를 열고, 그 화면의 "지출 기록하고
  준비 완료"가 **지금 아이**의 지출과 준비 상태를 바꾼다 — 구매 확인 카드가 라운드 39 UX-O에서
  `isFollowupForSelectedChild`로 이미 막아 둔 바로 그 오기록을, 알림 경로가 우회한다.
- **최소안**: `notificationTapRoute`가 목적지와 함께 `childId`를 돌려주고(순수 판정 그대로),
  화면은 그 아이가 `["children"]`에 **있을 때만** 기존 전환 한 벌(`src/children/child-switch.ts`의
  `switchChild` — 스토어 쓰기 + 아이 스코프 캐시 무효화 + 안내)을 한 번 태운 뒤 이동한다.
  `childId`가 없거나(구 blob) 목록에 없으면(삭제된 아이) **종전 그대로** 이동 — 지어내지 않는다.
- **설계 긴장**: 알림함이라는 목록 화면이 전역 아이 선택을 바꾸는 부수효과를 갖는 것이 옳은가.
  대안은 "전환하지 않고 사실만 안내"인데, 그러면 사용자는 알림 하나를 보려고 설정 > 아이 관리를
  거쳐야 한다. 전환을 택하면 안내 문구(`childSwitch`가 이미 내는 그 문장)가 반드시 함께 떠야 한다.

### 3. 오프라인 **대기** 행에 취할 수 있는 행동이 0개 — S
- **근거**: 기록 탭의 대기 행은 탭하면 동기화 상태 화면으로 간다
  (`app/(tabs)/records.tsx:250` `onPress={pushSyncStatus}`, 이유는 `:1286-1288` 주석 —
  "서버 id가 없어 상세로 갈 수도, 같은 삭제 경로를 탈 수도 없다"). 그런데 그 목적지의 대기 행은
  **문장 한 줄뿐**이다(`app/sync-status.tsx:411-419` `PendingRow` — "연결되면 자동으로 반영할게요").
  실패 행에는 재시도·버리기·고쳐서 다시 보내기가 다 있고(`:378-408`), 충돌 행에는 3갈래가 있는데,
  대기 행에만 아무것도 없다.
- **실패 시나리오**: 비행기 모드/지하철에서 38,500원을 385,000원으로 잘못 적는다. 그 값은 즉시
  홈 히어로(`monthlyUsed` 재조정)·기록 탭 월 합계·예산 경고·정기 지출 "기록됨" 판정에 들어가고,
  연결이 돌아올 때까지 사용자가 **고칠 수도 지울 수도 없다**. 오프라인 우선을 표방하는 앱에서
  오프라인 상태가 곧 편집 불가 상태다.
- **최소안**: `PendingRow`에 "버리기" 하나. 경로는 이미 있다(`discardOfflineMutation` →
  `sync-engine.ts:1035-1038 discardFailedMutation` = 아웃박스 정리 + 로컬 행 삭제). 파괴적이므로
  확인 Alert(전체 버리기와 같은 관례, `app/sync-status.tsx:602-612`) + **`syncing`/`inFlight` 행은
  제외**(전송 중 행을 지우면 서버에만 남는 고아 지출이 생긴다 — 그 술어를 순수 모듈로 내놓는다).
- **설계 긴장**: "고쳐서 다시 보내기"(라운드 58 #5 기계장치가 그대로 있다 —
  `src/expenses/failed-row-prefill.ts`)를 대기 행에도 열면 훨씬 좋지만, 프리필을 여는 사이 flush가
  성공하면 **원본 폐기 대상이 사라져 중복 기록**이 된다. 실패 행에는 없던 경합이므로 이번 라운드
  밖으로 두고 "버리기"까지가 정직한 최소치다.

### 4. 가구 전환이 **아이 추가·가구 탈퇴**에 전달되지 않는다 — 아이 없는 가구는 앱 안에서 영영 나갈 수 없다 — M
- **근거**: 전환 상태는 가족 화면의 지역 `useState`다(`app/family/index.tsx:177`). 라운드 61 #3이
  초대 화면까지는 파라미터로 들고 갔지만(`inviteScreenHref`), 나머지 두 관리 화면은 여전히
  아이 기준 판정을 다시 돌린다 — `app/settings/privacy.tsx:186-192`(탈퇴 대상),
  `app/settings/children.tsx`(아이 추가 대상). 그 판정
  (`src/family/household-scope.ts:67-85 resolveManagedHouseholdId`)은 **아이가 하나도 없는 가구를
  구조적으로 가리킬 수 없다**(1단계는 선택 아이의 가구, 3단계는 `defaultHouseholdId`).
  라운드 61이 "탈퇴 화면은 후속"으로 명시해 남긴 절반이다.
- **실패 시나리오**: 시가에서 만든 빈 가구의 초대를 수락한다. 그 가구는 가족 화면에서 "다른 가구
  보기"로 볼 수만 있고 — 아이를 넣을 수도(아이 추가는 늘 내 아이의 가구로 간다), 나갈 수도 없다
  (탈퇴 대상도 늘 내 아이의 가구다). 즉 계정에 **영구히 붙어 있는 가구**가 생긴다. 게다가 잘못
  누르면 탈퇴 카드는 자기가 어느 가구를 나가는지 라벨로는 말하지만(라운드 60 A) 그 대상이 사용자가
  방금 보고 있던 가구가 아니다.
- **최소안**: 가족 화면에 "이 가구에서 나가기" 진입점을 두고 `householdId`를 파라미터로 넘긴다
  (라운드 61 #3의 `inviteScreenHref`와 **같은 관례**: 전환 중일 때만 싣고, 받는 쪽은
  `collectKnownHouseholdIds` 화이트리스트로 검증해 모르면 조용히 종전 판정으로 되돌아간다).
  아이 추가는 후속으로 분리 가능.
- **설계 긴장**: 되돌릴 수 없는 화면에 딥링크 파라미터를 여는 일이다 — 검증 실패는 **차단이 아니라
  종전 동작**이어야 하고(모르면 말하지 않는다), 탈퇴 카드의 대상 라벨은 파라미터로 온 가구를
  가리켜야 한다. 1가구 계정에서는 파라미터 자체가 생기지 않아 SET-003 화면이 한 글자도 안 바뀐다.

### 5. **삭제한 아이의 기기 잔재** — 정기 지출·알림·구매 대기가 남는다 — S
- **근거**: 아이 프로필 삭제의 뒤처리는 쿼리 캐시뿐이다
  (`app/settings/privacy.tsx:214-218` → `finishChildRemoval` → `CHILD_REMOVAL_INVALIDATE_KEYS`).
  기기에 persist되는 아이 단위 상태 셋은 그대로 남는다 —
  `src/stores/recurring-expense.store.ts`(`template.childId`),
  `src/notifications/notification.store.ts`(`entry.childId`),
  `src/commerce/purchase-followup.store.ts`(`entry.childId`). 세 스토어 모두 `resetAll()`(계정 전환)
  하나뿐이고 아이 단위 정리 API가 없다.
- **실패 시나리오**: 라운드 61이 가구 탈퇴 쪽에 남긴 P3 주석(`app/settings/privacy.tsx:277-291`)이
  말한 그 잔재인데, **아이 삭제는 사정이 다르다** — 그쪽은 "어느 아이가 사라졌는지 모른다"가 이유였고,
  여기서는 `childId`를 손에 쥐고 있다. 결과: 삭제한 아이의 알림 줄이 알림함에 계속 서 있고(이름을
  해석할 수 없으니 태명 접두도 안 붙어 어느 아이 것인지도 안 보인다), 그 줄을 누르면 후보 2의
  경로로 지금 아이의 화면이 열린다. 정기 지출 템플릿은 아이별 상한 20칸을 차지한 채 남는다.
- **최소안**: 세 스토어에 `clearForChild(childId)` 순수 액션 + `finishChildRemoval`에서 3줄 호출.
  가구 탈퇴 경로에서는 부르지 않는다(그쪽은 여전히 사라진 아이 집합을 모른다 — 그 P3 주석은 유지).
- **설계 긴장**: PRIV-104 teardown 계약(정체성 전환에만 발화)과 섞이지 않게 **별도 액션**으로 둔다.
  알림은 dedupe 기억(`seenDedupeKeys`)까지 지울지 결정해야 한다 — 남겨 두면 같은 아이 id가 다시
  생길 일이 없으므로 무해하고, 지우면 blob이 더 깨끗하다(둘 다 정직하다).

### 6. 라운드 61 #10(임신 42주 고착) 봉합이 **더보기 탭을 지나쳤다** — S
- **근거**: `resolveStageDisplayLabel`(`src/home/stage-display-label.ts`)을 지나는 곳은 셋이다 —
  홈 헤더(`app/(tabs)/index.tsx:1755`), 설정 요약(`app/settings/index.tsx:110`), 아이 관리
  (`app/settings/children.tsx:485`). 더보기 탭의 프로필 카드는 서버 라벨을 **그대로** 그린다
  (`app/(tabs)/more.tsx:191` `visibleProfile` → `:301-302` 접근성 라벨 · `:315` StageBadge ·
  `:327` 본문). 온보딩 이어하기도 같다(`app/(onboarding)/resume.tsx:87`).
- **실패 시나리오**: 예정일이 2주 넘게 지났는데 출생 전환을 안 한 프로필에서, 홈은 "예정일이
  지났어요"라고 하고 더보기 탭 배지는 "임신 42주차"라고 한다 — 한 앱이 같은 아이에 대해 두 문장을
  말한다. 라운드 61이 없애려던 바로 그 단언이 화면 하나에 남아 있는 셈이다.
- **최소안**: 더보기가 `["children"]` 캐시를 `getQueryData`로 읽어(홈·예산·정기 지출 화면이 이미
  쓰는 "새 요청 0건" 관례) 같은 함수를 지난다. `HomeSummary.child`에는 `stageMode`/`dueDate`가
  없으므로(`src/api/client.ts:185`) 원천은 그 캐시뿐이다.
- **설계 긴장**: SET-001 픽셀락. 더보기 캡처는 **비로그인 경로**로 찍히고 그 경로의
  `previewProfile`(`more.tsx:64`)은 한 글자도 바뀌면 안 된다 — 세션 렌더에서만 판정을 태운다
  (라운드 60 #7이 아이 스코프 라벨에서 쓴 것과 같은 게이트).

### 7. 가구 탈퇴·계정 삭제에 **감사 로그가 없다** — S
- **근거**: 같은 컨트롤러에서 아이 프로필 삭제만 기록한다
  (`apps/api/src/settings/settings.controller.ts:49-52` `child_profile.delete`). 가구 탈퇴
  (`:76-84`)와 계정 삭제(`:102-110`)에는 `auditLogger.record` 호출이 없다. 남이 나를 내보내는 쪽은
  기록된다(`households.controller.ts:33` `household.member.remove`) — 즉 감사 로그는 "내보내졌다"는
  알지만 "스스로 나갔다"는 모른다.
- **실패 시나리오**: "가구에서 나간 적 없는데 기록이 안 보여요" CS에 어드민이 답할 근거가 0이다
  (구성원 행은 `left`로만 남고 누가·언제·어느 경로로 그랬는지가 없다). 계정 삭제는 더 심하다 —
  파기 잡이 30일 뒤 사용자 행을 물리 삭제하면(`DEFAULT_PURGE_RETENTION_DAYS`) 그 계정이 존재했다는
  사실 자체가 사라진다. 감사 로그였다면 730일 보존창에 익명화된 운영 기록으로 남았을 것이다
  (phase 3은 `actorUserId`만 null로 만든다).
- **최소안**: `record` 2건(`household.leave`, `account.delete`) + 어드민 감사 로그 화면 설명 문구.
  PII는 싣지 않는다(기존 봉투 마스킹 관례 그대로). 곁가지로 `budget.upsert`도 이력이 없는 금액
  변경이라 후보지만, 볼륨이 달라 별도 판단.
- **설계 긴장**: 감사 행의 `userId`가 곧 탈퇴/삭제 당사자다 — phase 3의 익명화 스코프에 실제로
  걸리는지 확인이 선행(걸리므로 `child_profile.delete`와 같은 모양이면 된다).

### 8. `household_invites`가 무기한 쌓인다 — 파기 잡의 유일한 사각 — S/M
- **근거**: 파기 잡 9단계 어디에도 초대 행의 연령 기준 삭제가 없다. 지워지는 경우는 둘뿐이다 —
  초대자가 파기될 때(`data-retention-purge.job.ts:838-839`), 가구가 고아가 될 때(`:882`).
  스키마는 토큰 해시·역할·채널을 든다(`apps/api/prisma/schema.prisma:210-226`), 인덱스
  `idx_household_invites_expires_at`은 있지만 그것을 쓰는 것은 만료 표시 UPDATE뿐이다
  (`households/household-runtime.service.ts:349·386·570`).
- **실패 시나리오**: `analytics_events`(400일)·`affiliate_clicks`(400일)·`audit_logs`(730일)·
  `import_rows`(90일)가 전부 연령 파기를 갖춘 지금, 만료·수락·취소된 초대만 영구히 남는다.
  개인정보 밀도는 낮지만 **정책상 "보존 기간이 정해지지 않은 테이블"이 하나 남아 있는 것** 자체가
  privacy-policy 정합의 구멍이고, 성장은 사용자 수에 비례한다.
- **최소안**: phase 10 + `HOUSEHOLD_INVITES_RETENTION_DAYS`(기본값·근거 주석·PM 확인 문구는
  라운드 58 #10/60 #5 선례 그대로) + `.env.example`·`scripts/check-env.ts` 등재.
  **`pending`은 대상에서 제외**(만료 전에는 살아 있는 링크다 — 상태가 정해진 행만 지운다).
- **설계 긴장**: 취소된 초대를 지우면 "이 링크는 왜 안 되나"에 답할 근거가 사라진다 — 취소·수락
  사실은 이미 감사 로그(`household.invite.cancel`)와 구성원 행에 있으므로 중복 보존이 아니라는
  판단을 주석에 남긴다.

### 9. 홈 "누적 총액" 카드가 오프라인 대기를 세지 않는다 — 같은 화면 히어로는 센다 — S
- **근거**: 히어로 금액은 재조정된 `monthlyUsed`(`app/(tabs)/index.tsx:1465`,
  `reconcileMonthlyExpenses`)인데 누적 카드는 서버 집계를 **그대로** 쓴다
  (`src/home/cumulative-total.ts:34-35`, 배선 `app/(tabs)/index.tsx:1622`).
- **실패 시나리오**: 오프라인으로 5건을 적은 직후 홈에서 히어로는 그 5건을 포함한 이번 달 금액을,
  바로 아래 누적 카드는 그 5건이 빠진 전 기간 금액을 말한다. 부제는 제외 항목을 스스로 밝히는
  자리인데(`CUMULATIVE_TOTAL_SUBTITLE` — "선물로 받은 건 제외") 아직 반영되지 않은 기록은 밝히지
  않는다. 정직성 규율(모르면 말하지 않는다·빼놓은 것은 밝힌다)을 이 카드만 절반만 지킨다.
- **최소안**: 리포트 탭이 이미 쓰는 어휘 그대로 한 줄 고지(`src/reports/pending-scope-notice.ts`의
  술어 재사용), 또는 그 기간에 대기 행이 있을 때 카드를 접는다.
- **설계 긴장**: **재집계는 금지**다 — 누적은 전 기간이라 클라이언트에 재조정할 모집단(월 캐시)이
  아예 없다. 그래서 답은 숫자를 고치는 것이 아니라 사실을 밝히는 것이다(H절 "기간 합계 엔드포인트"는
  여전히 비범위).

### 10. 실기기 체크표 라운드 61분 공백(3라운드 연속 재발) + a11y 스윕 밖 2건 — S
- **근거**: `docs/qa/runtime-verification-required.md`의 표는 22~29(라운드 58~60)에서 멈춰 있다.
  라운드 61 신설 8건 중 **저장소 상태 두 줄만** §5에 서술로 있고(재오픈 게이트·홈 `unknown`),
  나머지 여섯(가구 탈퇴 세션 잔재·Alert 3버튼 상한 표기·전환 초대 전달·synced 90일 파기·온보딩
  단계 이벤트·admin_sessions 정리)은 표에 없다. 라운드 61 #8이 이 공백을 "재발"이라 부르며 메웠는데
  같은 자리에서 또 벌어졌다. `src/a11y-contract.test.ts`에도 라운드 61 신설 UI(가구 전환 Alert의
  버튼 라벨·"보는 중" 표기, 동기화 상태 화면의 저장소 상태 줄)가 없다.
- **최소안**: 30~35행 추가 + a11y 계약 2건. 라운드 62 자신의 항목도 통합 시점에 같은 파일에 넣는다.
- **설계 긴장**: 없음. 다만 이 항목이 세 라운드째 재발했다는 사실 자체가 신호다 — 체크표 갱신을
  트랙 산출물이 아니라 라운드 종료 조건으로 옮길지 판단할 자리.

## P3

- **정기 지출 문구·절단의 단일 소스 미정리** — `src/stores/recurring-expense.store.ts:62-65`가
  "문구를 `recurring-template.ts`로 옮기는 것은 다음 라운드의 몫", `:190-191`이 "아이별 절단을 그
  모듈로 옮기는 것은 후속 정리"라고 **자기 손으로 두 번** 적어 뒀다(라운드 59부터 밀림).
- **admin E2E가 라운드 61 신설 패널을 지나지 않는다** — `scripts/qa/admin-e2e.mjs`의 analytics
  단계가 "온보딩 단계 이탈" 표와 퍼널의 온보딩 4단 접두(`apps/admin/app/analytics/page.tsx:101-109`,
  `:253-281`)를 확인하지 않는다.
- **죽은 스타일** `pendingNoticeStyle`(`app/settings/privacy.tsx:518`) — 참조 0건.
- **온보딩 이어하기 화면의 단계 라벨**(`app/(onboarding)/resume.tsx:87`) — 후보 6과 같은 원인,
  도달 빈도가 낮아 분리.
- **"저장하고 계속 기록"이 없다** — 영수증 여러 장을 한 번에 옮겨 적는 사람은 저장마다
  홈/기록 탭을 거쳐 FAB로 되돌아온다(`post-save-destination.ts`에 그 목적지가 없다). EXP-001은
  비세션 캡처라 세션 전용 보조 액션은 가능하지만 기능 추가라 별도 판단.
- **더보기 세션 메뉴에 정기 지출이 없다** — 홈 카드와 설정(3탭 깊이) 둘뿐
  (`src/settings/more-menu.ts:106` 부근 7행 구성). 행 수 총량 계약(SET-001 compact)과 충돌.
- **첫돌 이후 리포트 고착**(`src/reports/milestone-selection.ts:54`) — 라운드 61 P3 그대로.
  앱 범위가 "임신~첫돌"이라 설계 판단이 선행이고, 이번 라운드에서도 코드 대상이 아니다.
- **`viewedHouseholdId`가 탭 이탈 시 사라진다** — 후보 4의 설계에서 함께 결론 낼 것
  (`app/family/index.tsx:160-176` 주석이 "의도된 성질"이라 적어 뒀으므로, 바꾼다면 그 주석부터).

## 코드 건강 판정

- 죽은 export 스윕 결과 **실질 사각 없음**(모듈 내부·테스트 전용 상수뿐). `index.tsx`·`new.tsx`
  분리는 라운드 59 판정(픽셀락 기준선 위험) 그대로 **비권장** — 이번 후보 중 그 두 파일을 건드리는
  것은 무효화 한 줄(후보 1)과 카드 고지(후보 9)뿐이라 구조 변경이 필요 없다.
- 주석 드리프트 미발견. 오히려 저장소가 스스로 남긴 후속(P3 1번, 후보 4·5의 근거 주석)이 이번
  라운드 후보의 절반을 이미 지목하고 있다.

## 트랙 구성 (파일 단위 상호 배타)

- **A 기록 반영·대기 행 정직**(#1 #3 #9)
  - 소유: `app/expenses/new.tsx` · `app/expenses/[expenseId].tsx` · `app/(tabs)/index.tsx` ·
    `src/home/cumulative-total.ts` · `src/offline/sync-controller.ts` · `src/offline/sync-engine.ts` ·
    `src/offline/messages.ts` · `app/sync-status.tsx` · `src/refresh-wiring-contract.test.ts`
  - 금지: `app/(tabs)/reports.tsx`(무효화 키만 늘린다 — 이 화면은 읽기 전용) ·
    `src/reports/pending-scope-notice.ts`(재사용만) · `app/(tabs)/records.tsx`
  - 계약: HOME-001 **비세션 미리보기 분기 무변경**(`index.tsx`의 픽셀락 경로), 리포트 합계
    클라이언트 재집계 금지, `syncing`/in-flight 행 폐기 금지

- **B 알림 여정·아이 스코프**(#2 + #5의 스토어 API)
  - 소유: `src/notifications/notification-route.ts` · `app/notifications.tsx` ·
    `src/notifications/notification.store.ts` · `src/commerce/purchase-followup.store.ts` ·
    `src/stores/recurring-expense.store.ts`
  - 금지: `src/children/child-switch.ts`(재사용만 — 전환 한 벌은 그대로) ·
    `app/settings/privacy.tsx`(트랙 E 소유) · `app/(tabs)/index.tsx`(A 소유)
  - 계약: 아이를 모르면 **종전 동작**(전환하지 않는다), persist blob 마이그레이션 없음
    (액션만 추가), 알림 dedupe 키 정책 변경은 근거 주석 필수

- **C 표시층·실기기 문서**(#6 #10 + P3 온보딩 라벨)
  - 소유: `app/(tabs)/more.tsx` · `app/(onboarding)/resume.tsx` · `src/a11y-contract.test.ts` ·
    `docs/qa/runtime-verification-required.md` · `docs/qa/accessibility-offline-checklist.md`
  - 금지: `src/home/stage-display-label.ts`(판정 불변 — 재사용만) · `app/settings/index.tsx` ·
    `app/settings/children.tsx`(E 소유)
  - 계약: **SET-001 픽셀락** — 더보기 비로그인 미리보기 행(구성·순서·문구·목적지·`previewProfile`)
    한 글자도 불변, 세션 렌더에서만 판정을 태운다. 해요체(DNC-018)

- **D 서버 보존·감사**(#7 #8)
  - 소유: `apps/api/src/settings/settings.controller.ts` ·
    `apps/api/src/worker/jobs/data-retention-purge.job.ts` · `apps/api/prisma/schema.prisma`(주석만) ·
    `.env.example` · `scripts/check-env.ts` · 관련 `apps/api/test/*` · `docs/operations/*`
  - 금지: 모바일 0건. 마이그레이션 신규 0건(파기는 기존 컬럼으로 판정) ·
    **새 e2e는 shared 레인 — `exclusive-suites.ts` 등재 금지**(라운드 61 A가 봉합한 락 프로토콜의
    비용, 그 파일 머리말)
  - 계약: 보존 기간 단축은 PM/법무 확인 문구 동반(라운드 58 #10 선례), 감사 봉투에 PII 금지

- **E 가구 여정 마감**(#4 + #5 배선) — **B 머지 후**
  - 소유: `app/family/index.tsx` · `app/settings/privacy.tsx` · `app/settings/children.tsx` ·
    `src/family/household-scope.ts` · `src/family/invite-flow.ts`
  - 금지: `app/family/accept/[token].tsx`(수락의 "덮어쓰지 않는다" 계약 불변) ·
    `src/stores/session.store.ts` 구조 변경 · `src/expenses/records-list-view.ts`(읽기 판정 재사용만)
  - 계약: **1가구 계정 결과 불변**(FAM-001 · SET-001 · SET-003 픽셀락), 파라미터는 아는 가구
    화이트리스트로만 — 검증 실패는 차단이 아니라 종전 판정, 죽은 값은 붙들지 않되 살아 있는 값은
    덮어쓰지 않는다(라운드 60·61이 세운 두 규칙 그대로)

- **머지 순서**: B → E(E가 B의 아이 단위 정리 액션을 배선한다). A · C · D는 독립.
  C의 체크표는 A·B·D·E가 끝난 뒤 라운드 62 항목을 한 번 더 추가(같은 트랙 소유라 충돌 없음).
