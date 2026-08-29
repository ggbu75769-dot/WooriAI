# 라운드 69 정찰 노트 (GAP-069)

> master 2f3095f(라운드 68 머지) 기준. do-not-change.md(DNC-001~020)·known-limitations A~I절·
> gap-analysis 제외 판정·round55-plan §6 비범위표·round56~68-scout 완료분·round61-backlog 대조
> 완료. 아래는 전부 그 밖이거나, 라운드 68이 접점으로 남긴 잔여다.
>
> **이번 라운드의 축은 "앱이 이미 알고 있는 사실이 사용자에게 도달하는가"이고, 그 질문을 세 갈래로
> 던졌다** — ⓐ 파괴적 순간에 **사라지는 것의 목록**이 전부인가(라운드 68 #2의 뒷면), ⓑ 서버가
> 한국어로 말해 준 **실패 사유**가 화면까지 오는가(라운드 45 UX-Z의 화이트리스트를 3년치 코드로
> 다시 대조), ⓒ **모르는 값**을 앱이 조용히 지어내는 자리가 남았는가. 셋 다에서 나왔고, 넷째로
> **밖으로 나가는 공개 URL의 실패 화면**이 하나 더 나왔다 — 라운드 67 #4·68 #3이 공유를 개통하고
> 좁히는 동안, 그 링크를 받은 **앱을 써 본 적 없는 사람**이 무엇을 보는지는 아무도 열어 보지 않았다.
>
> **선행 확인 일곱(후보 아님).**
> 1. **라운드 68 여섯 트랙은 전부 머지돼 있다.** A=`packages/domain/src/money-date.ts`의
>    `ENTRY_DATE_MAX_PAST_MONTHS`/`getEntryDateFloor`/`isBeforeEntryDateFloor` + 복제 걷기
>    (`entry-form-guards.ts` 한 벌) + 서버 두 코드(`assertExpenseDateWithinPastFloor` ·
>    `assertBirthDateWithinPastFloor`), B=`offline/messages.ts:395-403`(`logoutConfirmMessage`) +
>    `app/import/index.tsx:300`(`withChildScopeLabel`) + `more-menu.ts`의 조건부 8행째,
>    C=`items-catalog.service.ts`의 `shareableRedirectUrl`(+`PRODUCT_LINK_HEALTH_BROKEN` 타입
>    결합), D=`schema.prisma`의 `PushBoundaryMark`/`ContentRevision` 주석 + 파기 잡 클래스 문서,
>    E=`src/expenses/RecordsCalendar.tsx`(records 2,001→**1,761**줄), F=체크표 §1-1 **81행**까지.
>    **재제안 대상이 아니다.**
> 2. ⚠️ **라운드 68 F가 절반만 마쳤다 — a11y 표에 A-9가 없다.** 커밋 `3757bc7`이 만진 파일은
>    `docs/qa/runtime-verification-required.md` **하나**이고(74~81행), 라운드 68 노트가 예고한
>    "a11y **Batch 19 / A-9**"는 `docs/qa/accessibility-offline-checklist.md`에 **들어오지 않았다**
>    (마지막 표가 여전히 `### A-8. 라운드 67 신설 UI`, #42까지). 다섯 라운드 연속 잔여 0이던 기록이
>    여기서 끊겼다 — **물려받은 빚이 있는 첫 라운드다**(트랙 F).
> 3. **날짜 하한은 쓰는 경로 셋에 실제로 다 서 있다.** `entry-form-guards.ts:257`(폼) ·
>    `store-shared.ts:213`(서버 생성·수정) · `import-pipeline.service.ts`의
>    `validationStatusForImportRow`(가져오기 행). 곁가지로 라운드 68 리뷰가
>    `failed-row-prefill.ts:290`(고쳐서 다시 보내기 프리필)까지 같은 도메인 술어로 막았다.
>    **하한 자체를 다시 팔 자리는 없다** — 남은 것은 그 코드의 **이름**뿐이다(후보 2).
> 4. **준비템 카탈로그에 시기 절벽은 없다.** `prisma/seed-data.ts`의 63개 템플릿을 열 밴드에
>    대조했다 — `pregnancy_early` 5 · `pregnancy_mid` 8 · `pregnancy_late` 15 · `newborn_0_3` 18 ·
>    `infant_4_6` 14 · `infant_7_12` 17 · `toddler_1_3` 17 · `kid_4_7` 11 · `elementary` 9 ·
>    `middle_school` 7. 첫돌 이후에도 목록이 비지 않는다. **첫돌 이후에 고착되는 것은 카탈로그가
>    아니라 마일스톤 리포트 하나뿐**이고(`milestone-selection.ts` — 첫돌 도달 후 영원히
>    `first-birthday`), 그 카드는 제목·창 문구가 자기가 무엇인지 정확히 말하므로 **정직성 결함이
>    아니라 설계 항목**이다(P3 그대로).
> 5. **환불·선물 축은 짝이 맞다.** 서버의 집계 다섯 자리가 전부 `expenseType: "expense"`로 좁히고
>    (`expenses-store.service.ts:530·550` · `reporting-store.service.ts:138·177·219·297` ·
>    `milestone-report.service.ts:56` · `push-dispatch.service.ts:137`), 앱은 refund를 만들 입력이
>    아예 없으며(`CreatableExpenseType`) 편집이 refund를 지출로 둔갑시키지 않는 방어가 두 겹이다
>    (`expense-detail-rows.ts:136-190`). **팔 자리 없음.**
> 6. **모바일 소스 231개 중 어떤 테스트도 언급하지 않는 모듈은 1개**
>    (`src/pixelLock/styles/BottomTabPixelStyles.ts` — 픽셀락 상수표라 정상)**이고, 참조 0건인
>    export는 둘뿐이다**(`legal-links.ts:29`의 `LEGAL_DOCUMENT_LABELS` — **새 발견** ·
>    `step-ui.tsx:209`의 `__resetOnboardingStepAnalyticsForTests` — 여섯 라운드 이월). 커버리지
>    사각은 이 라운드의 축이 아니다.
> 7. **`scripts/check-env.ts`의 `INVITE_LINK_BASE_URL` 설명은 이미 소비자 셋을 말한다**
>    (`:44-46` — 라운드 68 P3에 남아 있던 그 항목은 실제로는 라운드 67에서 갚혔다). 목록에서 뺀다.

## 상위 후보

### 1. **로그아웃이 지우는 세 번째 목록**을 확인 문구가 세지 않는다 — 그 목록의 자기 고지는 "기기를 바꾸면"이라 이 경로를 비켜 간다 — S/M

- **근거**: 라운드 68 #2가 로그아웃 확인에 "무엇이 사라지는가"를 넣었는데, **모집단이 아웃박스에서
  멈춰 있다.**
  - 문구가 세는 것: `devicePendingRecords = { counts, itemStatusRowCount, storage }`
    (`src/export/ExpenseCsvExport.tsx:304-307`) → `logoutConfirmMessage`
    (`src/offline/messages.ts:395-403`). 즉 **지출 아웃박스 + 준비템 상태 큐**다.
  - `clearSession()`이 발화시키는 teardown이 실제로 지우는 것은 그보다 넓다
    (`src/offline/session-teardown.ts`): `wipeOfflineStore`(아웃박스) 외에
    **`useRecurringExpenseStore.getState().resetAll()`(`:259`)**,
    `usePurchaseFollowupStore…resetAll()`(`:243`), `useNotificationStore…resetAll()`(`:245`),
    `useImportResumeStore…resetAll()`(`:263`), `useAppLockStore…resetAll()`(`:270`).
  - 그중 **정기 지출 템플릿은 사용자가 직접 적은 계정 데이터이고 서버에 사본이 없다.** 그 스토어의
    머리말이 스스로 그렇게 적어 뒀다(`src/stores/recurring-expense.store.ts:46-50` — "여기 담기는
    값(품목명·금액·분류·판매처)은 명백한 **계정 데이터**다… 세션 정체성이 바뀔 때 지워져야 하고").
    아이당 최대 **20개**(`recurring-template.ts:90`).
  - 그리고 **그 기능의 자기 고지가 이 경로를 정확히 비켜 간다**:
    `RECURRING_DEVICE_ONLY_NOTICE`(`recurring-template.ts:539-540`) = "이 목록은 이 기기에만
    저장돼요. **기기를 바꾸면** 서버에서 돌아오지 않으니 다시 적어야 해요."
    라운드 66 #4가 이 문장을 세울 때 상상한 사고는 **기기 교체**였고, 로그아웃은 그 문장의 조건절
    밖이다. 저장소 전체에서 "로그아웃하면 정기 지출이 사라진다"고 적는 자리는 **0곳**이다
    (`grep 로그아웃` → `recurring-template.ts`·`app/expenses/recurring.tsx` 모두 0건).
- **실패 시나리오**: 매달 챙기던 정기 지출 12개(기저귀 정기배송·분유·어린이집비…)를 적어 둔
  사용자가 **같은 폰에서** 로그아웃한다. 이유는 여럿이다 — 배우자 계정으로 잠깐 바꿔 보려고,
  로그인이 이상해서 껐다 켜려고, 카카오 계정을 정리하려고. 확인창이 말하는 것은 "다시 로그인해야
  이용할 수 있어요."(대기 0건이면 그게 전부다)뿐이고, **정기 지출은 대기 건수에 잡히지 않으므로
  0건 갈래로 떨어진다.** 다시 로그인하면 지출·예산·아이·준비 상태는 서버에서 그대로 돌아오고
  **정기 지출 목록만 비어 있다** — 화면은 "아직 적어 둔 정기 지출이 없어요"라고 말한다. 사용자가
  읽어 둔 유일한 경고는 "기기를 바꾸면"이었고, 기기는 바꾸지 않았다. **앱이 지운 것을 사용자가
  지운 셈이 됐고, 미리 물어본 적이 없다** — 라운드 68 #2가 아웃박스에 대해 정확히 이 판단을 내렸다.
- **최소안**: **모집단 한 칸 + 문장 한 줄.** ⓐ `devicePendingRecords`에 정기 지출 개수를 더한다 —
  값은 zustand 셀렉터 하나(`useRecurringExpenseStore((s) => s.templates.length)`)라 **새 요청
  0건**이고, 로그아웃이 모든 아이의 것을 지우므로 **아이 필터를 지나지 않는 전량**이 맞다(라운드
  68이 아웃박스에 내린 판단과 같다). ⓑ `logoutConfirmMessage`가 두 모집단을 **한 문장에 합치지
  않는다** — 기록(되돌릴 수 없는 미동기화)과 목록(다시 적어야 하는 입력 보조)은 성질이 다르다.
  0/0이면 종전 한 줄 그대로. ⓒ `RECURRING_DEVICE_ONLY_NOTICE`의 조건절을 넓힌다("기기를 바꾸거나
  로그아웃하면") — **한 사실을 두 자리가 다르게 말하지 않게** 하는 것이 이 후보의 절반이다.
  마이그레이션 0건·화면 구조 0건.
- **설계 긴장**: 넷이다. ⓐ **구매 확인 대기는 세지 않는다.** 같은 teardown이 지우고 핵심 루프
  5단계이긴 하지만, 그 항목은 **24시간이면 스스로 만료되고**(`PURCHASE_FOLLOWUP_MAX_AGE_MS`)
  최대 5건이며(`MAX_ENTRIES`), 클릭 자체는 `affiliate_clicks`로 서버에 남는다 — "되돌릴 수 없다"고
  말할 만한 값이 아니다. **그 판단을 값으로 적어 둘 것**: 적지 않으면 다음 라운드가 목록을 다섯 개로
  늘린다. 알림함·이어보기·PIN도 같은 이유로 제외(전자 둘은 파생, PIN은 이 기기의 선택이다).
  ⓑ **`storage === "unknown"` 갈래를 건드리지 않는다.** 그쪽은 저장소를 못 연 부팅의 이야기이고
  정기 지출은 zustand persist라 그 판정과 **저장소가 다르다** — 두 사실을 한 문장에 섞으면 "모른다"가
  거짓이 된다(라운드 61 S-4·M-1이 두 번 다룬 함정). 정기 지출 건수는 그 갈래에서도 말할 수 있다.
  ⓒ **템플릿을 서버로 올리는 것은 여전히 범위 밖이다** — 라운드 66 #4의 긴장 그대로(DNC-007 도메인
  목록 밖 · DNC-013 자동 기록 금지가 이 값을 로컬에 둔 이유다). 이번에 하는 일은 **사실을 말하는
  것**뿐이다. ⓓ **만료 세션(`clearSession("expired")`)은 무접촉** — 라운드 68 #2의 긴장 ⓒ 그대로다.

### 2. **서버가 이미 한국어로 말한 실패 사유가 화면까지 오지 않는 코드가 여섯** — 그중 셋은 사용자가 고치면 바로 풀리는 실패다 — S/M

- **근거**: 라운드 45 UX-Z가 세운 **코드→문구 화이트리스트**(`src/api/api-error.ts:99-156`)를
  오늘의 서버 코드 전량과 마주 세웠다. 아웃박스 flush가 4xx를 받으면 그 행은
  `RemotePermanentError`가 되고(`remote-api.ts:161·191`), **재시도 버튼이 사라지며**
  (`permission-denied.ts` — 400/403/404는 "재시도 무익"), 동기화 상태 화면에는 그 문구가 그대로
  선다. 표에 없는 코드의 문구는 `PERMANENT_FAILURE_MESSAGE = "요청을 처리하지 못했어요."`
  (`remote-api.ts:135`) 하나다 — **막다른 문장 + 버튼 없음**이 그 행의 최종 상태다.
  - **`EXPENSE_DATE_TOO_OLD`**(`store-shared.ts:217`) — **라운드 68이 방금 만든 코드가 표에 없다.**
    서버 원문은 "20년보다 오래된 날은 고를 수 없어요."이고 폼이 쓰는 문장과 **글자까지 같다**
    (`entry-form-guards.ts:228`).
  - **`CHILD_BIRTH_DATE_TOO_OLD`**(`onboarding-core.service.ts:157`) — 같은 라운드의 짝. 이쪽은
    아웃박스를 타지 않지만 아이 저장 화면의 폴백 문구로 접힌다.
  - **`EXPENSE_LINKED_ITEM_TEMPLATE_INVALID`**(`expenses-store.service.ts:437`, 400) — "연결된
    준비템을 찾을 수 없어요." **가장 도달하기 쉬운 자리다**: 준비템에서 "샀어요"를 눌러 오프라인
    저장 → 그 사이 어드민이 그 템플릿을 내림/교체 → flush 400. 사용자가 할 일은 명확한데
    (연결을 떼고 다시 저장) 화면은 그 말을 하지 않는다.
  - **`ITEM_NOT_FOUND`**(`items-catalog.service.ts:684`, 404) — "준비템을 찾을 수 없어요."
    준비템 **상태 큐**(`rethrowItemStatusError`)가 지나는 유일한 4xx다.
  - **`CHILD_NOT_FOUND`**(`child-access.service.ts:19`, 404) / **`EXPENSE_NOT_FOUND`**
    (`expenses-store.service.ts:409`, 404) — 다른 기기에서 아이/지출이 지워진 뒤 남은 큐가 받는 답.
  - **곁가지 하나가 성격이 다르다**: `requireExistingCategory`는 **이미 완성된 해요체 문장**
    ("존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요.")을 **`VALIDATION_ERROR`라는
    바구니 코드**로 던진다(`expenses-store.service.ts:426-431`). 화이트리스트는 코드 단위라 그
    문장을 **구조적으로 꺼낼 수 없다** — `VALIDATION_ERROR`를 표에 넣으면 DTO 검증 실패 전량이
    카테고리 문구를 뒤집어쓴다. **표의 결함이 아니라 코드 부여의 결함이다.**
- **실패 시나리오**: 지하철에서 준비템 상세의 쿠팡 링크를 누르고 "샀어요"로 45,000원을 적었다.
  기기에 저장됐고 홈 합계에도 섰다. 지상에 올라와 flush가 돌고, 그 사이 운영이 그 준비템을 교체해
  둔 상태라 서버가 400 + "연결된 준비템을 찾을 수 없어요."를 답한다. 동기화 상태 화면에 서는 것은
  **"요청을 처리하지 못했어요."** 한 줄이고, 재시도 버튼도 없다. 다음 안내가 "내용을 고쳐 새로
  기록하거나 버려 주세요"인데 **무엇을 고쳐야 하는지가 그 화면 어디에도 없다** — 사용자가 볼 수
  있는 값(금액·품목·날짜)에는 아무 문제가 없기 때문이다. 그 행은 큐에 영원히 남거나 버려지고,
  45,000원은 어느 쪽이든 사라진다. **핵심 루프 4→5단계의 마지막 한 칸이 조용히 끊긴다.**
- **최소안**: **표에 다섯 줄 + 서버에 코드 하나 + 이름 하나.** ⓐ 화이트리스트에 위 다섯 코드를
  더한다. 날짜 두 줄의 문구는 **새로 짓지 않고 폼 상수를 import한다**(`amountOverLimitMessage`가
  이미 세운 선례 — 같은 한도를 두 자리가 다른 문장으로 말하면 그 자체가 두 계약이다). 나머지 셋은
  서버 원문이 이미 해요체라 그대로 쓰되, 404 둘에는 **다음에 할 일**을 한 문장 붙인다(재시도를
  권하지 않는다 — `USER_WITHDRAWN`이 세운 형식). ⓑ 카테고리 갈래에 자기 코드를 준다
  (`EXPENSE_CATEGORY_INVALID` 계열) — 문구는 **서버가 이미 들고 있는 그 문장 그대로**이고,
  `VALIDATION_ERROR`의 나머지 소비자는 한 글자도 바뀌지 않는다. ⓒ **`assertNotFutureDate`를
  범위에 맞는 이름으로 바꾼다** — 라운드 68이 그 자리에 "이름은 미래 갈래만 말하지만 이 함수는 이제
  두 경계를 본다… 호출부를 함께 고쳐야 해서 다음 라운드로 미룬다"고 **적어 두고 넘긴** 빚이다
  (`store-shared.ts:222-236`). 호출부는 셋뿐이다(생성·수정·`validationStatusForImportRow`).
- **설계 긴장**: 넷이다. ⓐ **모르는 코드의 폴백은 그대로 둔다.** 표에 없는 코드가 서버 원문을 바로
  노출하게 만드는 것은 라운드 45가 세 가지 이유로 거절한 길이다(영어 원문 · 톤 계약 미검증 ·
  내부 사정 누출). 이번에 하는 일은 **아는 코드를 늘리는 것**이지 규칙을 바꾸는 것이 아니다.
  ⓑ **분류(permanent/transient)와 status/body는 한 글자도 바꾸지 않는다** — 문구만 갈린다.
  `isRetryableSyncError`의 401/408/429 예외도 무접촉이다. ⓒ **`EXPENSE_DATE_TOO_OLD`의 도달성이
  낮다는 사실을 함께 적을 것**: 라운드 68 이후 폼·프리필·달력이 전부 막으므로 이 코드를 받는 행은
  **업데이트 전에 큐에 들어간 행**과 **구버전 앱을 쓰는 공동양육자**뿐이다. 그래도 표에 넣는 이유는
  "그때 사용자가 보는 것이 막다른 문장"이라는 것이고, 낮은 도달성이 곧 낮은 비용이다.
  ⓓ **`ACCOUNT_STATUS_ERROR_CODES`(로그인 화면 전용)는 넓히지 않는다** — 그 목록이 좁은 것이 계약이다.

### 3. 준비템 탭의 **시기 밴드가 실패하면 조용히 "12-24개월"이 된다** — 그 탭의 약속이 "시기별"이다 — S/M

- **근거**: 준비템 탭은 아이의 현재 단계를 **`/home`에서만** 읽는다.
  - `const home = useQuery({ queryKey: ["home", childId], … })`(`app/(tabs)/items.tsx:269-272`).
  - 그 응답에서 쓰는 것은 **`child.currentStage` 한 필드가 전부**다 — 소비처가 정확히 둘이다:
    기본 밴드 칩(`:277` → `resolveDefaultStageLabel`)과 **"출산 전" 칩의 노출 판정**
    (`:530-533` → `shouldOfferPreBirthFilter`).
  - `home.data`가 없으면(로딩 중 **또는 실패**) `currentStage`가 `undefined`이고,
    `resolveDefaultStageLabel`은 인자로 받은 `fallback`을 돌려준다 — 이 화면이 넘기는 값은
    **`"12-24개월"` 리터럴**이다(`:280`). `shouldOfferPreBirthFilter`는 `false`가 된다.
  - **그런데 같은 화면이 `["children"]`을 이미 받아 두고 있고**(`:410-414` — 아이 전환 시트와
    다자녀 라벨이 쓴다), 그 응답의 `Child`에는 **`currentStage`가 들어 있다**
    (`src/api/client.ts:789-799`). 두 값은 서버에서 **같은 함수 한 벌**이 만든다
    (`apps/api/src/onboarding/store-shared.ts:88` `toChildDto` — `/home`은 `reporting-store.service.ts`의
    `child: toChildDto(child)`, `/children`은 `onboarding-core.service.ts:408`). 즉 **정의상 같은 값**이다.
  - 그리고 화면에는 `items` 쿼리의 에러 카드만 있다(`:463-466`). `items`는 `tab="all"`이라 **성공**
    하므로, `/home`만 실패한 화면은 **완전히 건강해 보인다** — 어디에도 "지금 시기를 모른다"는 표시가 없다.
- **실패 시나리오**: 임신 28주 사용자가 지하철·엘리베이터·회사 와이파이 전환 구간에서 준비템 탭을
  연다. `/home`이 실패한다(같은 순간 `items`는 캐시 또는 재시도로 살아난다). 화면은 **"12-24개월"
  밴드를 선택한 채로** 걸음마기 준비템을 그리고, **"출산 전" 칩은 아예 나타나지 않는다** — 그 칩은
  `currentStage`가 임신 코드일 때만 서기 때문이다(`pre-birth-filter.ts`). 사용자가 보는 것은
  "우리아이가 나에게 보행기와 이유식 그릇을 권한다"이고, 화면은 그 이유를 말하지 않는다.
  **탭의 이름이 곧 약속이고(시기별 준비물 — DNC-001), 그 약속이 깨진 순간이 침묵으로 지나간다.**
  콜드 스타트에서도 같은 모양이 잠깐 보인다(기본 칩이 12-24개월로 그려졌다가 뒤늦게 튄다).
- **최소안**: **출처를 하나로 + 모르면 모른다고.** ⓐ `currentStage`를 **`["children"]` 캐시의
  선택된 아이**에서 읽는다 — 화면이 이미 구독 중인 그 쿼리이고, 값은 위 근거대로 서버에서
  같은 함수가 만든다. `/home` 쿼리는 이 화면에서 **사라진다**(소비처가 그 한 필드뿐이다 —
  당겨서 새로고침의 `["home"]` 무효화는 홈 탭 캐시를 위해 남길지 함께 판단). ⓑ
  `resolveDefaultStageLabel`이 **`{ label, resolved }`를 돌려주게** 해 "폴백을 썼다"를 화면이 알 수
  있게 한다(값과 모름을 구분하는 라운드 61·68의 그 형식). ⓒ 아이 쿼리가 **실패로 정착했을 때만**
  칩 줄 위에 한 줄을 세운다("지금 시기를 확인하지 못했어요. 시기를 직접 골라 주세요." 계열) —
  정착 판정은 이미 있는 술어를 쓴다(`src/family/household-scope.ts:58` `isChildrenSettled`).
  **로딩 중에는 아무 말도 하지 않는다**(첫 페인트마다 경고가 번쩍이면 그것이 새 소음이다).
- **설계 긴장**: 넷이다. ⓐ **픽셀락 이중 게이트를 그대로 둔다.** `isPixelLockMode`는
  `resolveDefaultStageLabel`이 이미 최우선으로 보고, ITEM-001 캡처는 비세션이라 `["children"]`도
  꺼져 있다 — 캡처는 어느 쪽으로도 흔들리지 않는다. **그 이중 게이트를 값으로 증명할 것**(라운드
  68 #5가 IMP-003에 대해 세운 것과 같은 논증). ⓑ **요청 수 감소는 곁가지이지 목적이 아니다.**
  `["home", childId]`는 홈 탭과 공유하는 키라 실제 절감은 "홈을 아직 안 본 상태에서 준비템 탭으로
  직행"에서만 생긴다. **이 후보의 본체는 정직성**이고, 요청 이야기를 앞세우면 다음 사람이 캐시
  온기를 근거로 되돌린다. ⓒ **폴백 밴드 값 자체는 바꾸지 않는다.** `"12-24개월"`이 좋은 기본값이라
  남는 것이 아니라 **선택이 필요한 화면이라 하나는 서야 하기 때문**이고, 바꾸면 ITEM-001 캡처
  판정이 딸려 온다. 고치는 것은 "그 값이 사실인 척하는 것"이다. ⓓ **`shouldOfferPreBirthFilter`의
  규칙은 무접촉** — 노출 판정과 적용 판정을 같은 값으로 묶은 라운드 43 UX-V의 계약 그대로,
  입력 출처만 바뀐다.

### 4. 우리 도메인을 거쳐 **밖으로 나간 링크의 실패 화면이 원시 JSON**이다 — 같은 저장소에 한국어 안내 페이지의 선례가 있다 — S/M

- **근거**: 이 앱이 외부인에게 내보내는 공개 URL은 둘이고, **실패 화면이 서로 다른 종류다.**
  - **가족 초대**: `InviteLandingController`(`src/households/invite-landing.controller.ts`)가
    `text/html; charset=utf-8` + `no-store` + `X-Frame-Options: DENY`로 **자족적인 한국어 페이지**를
    돌려준다. 알 수 없음·만료·사용됨은 전부 **같은 일반 페이지**(오라클 금지)이고, 전역 프리픽스
    예외까지 받아 `/invite/:token`이라는 **사람이 읽는 주소**다.
  - **구매 링크**: `AffiliateRedirectController`(`src/items-commerce/redirect.controller.ts`)는
    실패에서 `NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR)`를 던진다(`:31` 비활성/미존재,
    `:44` 허용 도메인 밖). 그 값은 `GlobalExceptionFilter`가 **JSON 봉투**로 굳혀 내보낸다:
    `{"error":{"code":"PRODUCT_LINK_NOT_FOUND","message":"상품 링크를 찾을 수 없어요.","requestId":"…"}}`.
  - 그리고 그 주소가 **밖으로 나간다**: 라운드 67 #4가 앱의 공유 버튼을 그 URL로 열었고
    (`items-catalog.service.ts`의 `publicRedirectShareUrl` → `shareUrl`), 라운드 68 #3이 `broken`
    링크만 좁혔다. 실제로 나가는 문자열은 **`${INVITE_LINK_BASE_URL}/api/v1/r/<코드>`** 다
    (라운드 64 C-1이 프리픽스를 바로잡은 그 경로 — 짧은 `/r/`는 여전히 라우트 판단 대기).
  - **정직성 관점에서 이 자리가 특히 나쁜 이유**: `api-error.ts`가 앱 안에서 원천 차단하는 값
    (서버 원문·오류 코드·`requestId`)이 **앱 밖에서는 그대로 노출된다.** 앱에는 있는 규율이
    공개 웹 표면에는 없다.
- **실패 시나리오**: 사용자가 준비템 상세에서 [링크 공유하기]로 친구에게 `…/api/v1/r/7f3…`를
  카카오톡으로 보낸다. 며칠 뒤 친구가 누른다. 그 사이 운영이 그 링크를 내렸다 — **런북에 적힌
  정상 절차다**("쿠팡 파트너스 승인 → 어드민 CSV 도구로 링크 교체", launch-readiness-status §사용자
  액션 4). 카카오 인앱 브라우저에 뜨는 것은 흰 화면 위의 `{"error":{"code":…,"requestId":"8f3c…"}}`
  한 줄이다. **그 친구는 우리아이를 써 본 적이 없고, 그것이 이 서비스에서 본 유일한 화면이다.**
  링크를 보낸 사용자에게도 남는 것은 "내가 이상한 걸 보냈다"뿐이다. (도메인 허용목록에서 빠진
  판매처도 같은 화면이다 — `:38-45`. 운영이 `AFFILIATE_ALLOWED_DOMAINS`를 좁히는 순간 이미 나간
  모든 사본이 그 화면이 된다.)
- **최소안**: **초대 랜딩과 같은 형식의 한국어 페이지 한 장.** 새 규율이 아니라 그 선례를 한 칸
  넓히는 것이다 — 같은 헤더 셋(`Content-Type`·`no-store`·`X-Frame-Options`), 같은 이스케이프 규칙,
  같은 "오라클 없음"(알 수 없는 코드·비활성·도메인 차단이 **전부 같은 페이지**). 문장은 사실만
  말한다("이 구매 링크는 지금 열 수 없어요." + 앱에서 다른 판매처를 볼 수 있다는 한 줄).
  **성공 경로(302)·클릭 집계·레이트리밋·허용목록 판정은 한 글자도 바뀌지 않는다.**
- **설계 긴장**: 다섯이다. ⓐ **`/api/v1` 아래에서 HTML을 돌려주는 것이 이 후보의 핵심 결정이다.**
  그 프리픽스의 모든 실패는 JSON 봉투라는 것이 계약이고, 이 라우트만 예외로 만들면 다음 사람이
  "여기도 HTML이었나"를 매번 물어야 한다. 선택지 둘 — **(가) `Accept` 협상**(브라우저면 HTML,
  아니면 종전 JSON 그대로)과 **(나) 짧은 `/r/:code` 프리픽스 예외를 열고 거기에만 페이지를 둔다**.
  **권고는 (가)**: 새 공개 라우트를 열지 않고(그건 라운드 64가 "별도 판단"으로 미룬 그것이다),
  JSON 계약도 깨지지 않으며, 이 라우트의 성공 경로는 애초에 **브라우저만 따라갈 수 있는 302**라
  `Accept`가 신뢰할 만한 판별자다. 어느 쪽이든 **그 근거를 컨트롤러 머리말에 적을 것**.
  ⓑ **상태 코드는 404를 유지한다.** 초대 랜딩이 200인 이유는 존재 오라클 회피인데 여기에는 감출
  비밀이 없고, 404를 200으로 바꾸면 스모크 한 줄이 실제로 깨진다
  (`scripts/qa/server-smoke.sh:101` — "무효 코드 404"). **본문만 바뀐다.**
  ⓒ **실패에 클릭 행을 남기지 않는다** — 지금도 남기지 않고(`affiliateClick.create`는 302 직전에만
  돈다), 그 순서를 바꾸지 않는다. ⓓ **이 페이지에서 다른 판매처를 추천하지 않는다.** 그 순간 이
  URL은 커머스 페이지가 되고 DNC-010·DNC-011(고지·스폰서 구분)이 통째로 딸려 온다. 사실 한 줄과
  앱으로 가는 길까지다. ⓔ **어드민 표의 복사 URL은 무접촉**(라운드 68 #3의 판단 그대로 —
  운영은 죽은 링크를 직접 눌러 봐야 한다).

### 5. 오래 남은 부채 셋 — 48dp 미달 한 자리 · 죽은 export 둘 — S

- **근거**: 셋 다 값으로 확인했다.
  - **엑셀 업로드 화면의 뒤로가기만 44dp다**: `app/import/index.tsx:295`의 `hitSlop={6}`에
    `styles.backButton`이 **32×32**(`:492-497`)라 **32 + 2×6 = 44**. 같은 역할의 다른 버튼들은
    이미 48이다 — 준비템 상세 34dp + `PRODUCT_DETAIL_CHROME_HIT_SLOP`(7) = 48
    (`app/items/[itemTemplateId].tsx:190-194`가 그 산수를 주석에 적어 뒀다), 가족 화면 `hitSlop={12}`,
    리포트 화살표는 `theme.touchTarget`(=48, `src/theme.ts:179`)을 통째로 쓴다. 라운드 65·66·67·68
    P3에서 **네 번** 이월됐다. `hitSlop`은 레이아웃 속성이 아니라 **IMP-003/ExcelPreview 캡처는
    한 픽셀도 바뀌지 않는다**(라운드 64가 입력 칩 48dp에서 세운 그 논증).
  - **참조 0건 export 둘**(테스트 포함 전량 스윕): `src/consent/legal-links.ts:29`의
    `LEGAL_DOCUMENT_LABELS`(**새 발견** — 같은 파일의 다른 export는 전부 살아 있다),
    `src/onboarding/step-ui.tsx:209`의 `__resetOnboardingStepAnalyticsForTests`(**일곱 번째 이월**).
- **실패 시나리오**: 앞의 것은 손이 작지 않은 사람도 놓치는 44dp이고, 그 화면은 **수백 행짜리
  가져오기를 시작하기 전에 되돌아 나가는 유일한 출구**다. 뒤의 둘은 사용자에게 아무 일도
  일으키지 않지만, **`__reset…ForTests`라는 이름의 죽은 함수는 다음 사람에게 "테스트가 이 상태를
  초기화한다"고 거짓말한다** — 실제로 부르는 테스트는 0건이라 그 상태는 스위트 사이를 넘어간다.
- **최소안**: `hitSlop` 6 → 8(= 48), 죽은 export 둘 삭제. **동작 0건·문구 0건·캡처 0건.**
- **설계 긴장**: ⓐ **숫자를 바꾸는 것이 아니라 계약을 세우는 것이 이 항목의 본체다** —
  `src/a11y-contract.test.ts`가 이미 다른 자리들의 산수를 단언하고 있으므로(`:1261`·`:1318`),
  이 버튼도 그 표에 한 줄로 들어가야 다섯 번째 이월이 없다. ⓑ `LEGAL_DOCUMENT_LABELS`를 지우기
  전에 **약관 화면이 라벨을 어디서 읽는지 확인할 것** — 살아 있는 다른 상수와 이름이 비슷하다.

## P3

- **`ProductComparisonRow`의 `caption` 기본값이 아직 `"무료배송"`이다**(`src/ui.tsx:658-666`).
  ITEM-002 픽셀락 캡처 안이라 캡처 대조가 선행이다. 라운드 64~68 P3 그대로. **여섯 번째다.**
- **짧은 `/r/:code` URL은 여전히 라우트 판단 대기.** 후보 4는 **지금 실제로 응답하는 경로**의
  실패 화면만 고치고 프리픽스 예외는 만들지 않는다(권고안 (가)를 택하면 그렇다).
- **`FAILED_ROW_OTHER_CHILD_NOTICE`가 아직 `failed-row-prefill.ts:198`에 있다** — 동기화 상태 화면
  문구의 단일 소스는 `src/offline/messages.ts`다. **열 라운드째**이고, 후보 1이 그 두 파일을 함께
  여니 그 트랙에서 갚을 수 있다.
- **첫돌 이후 마일스톤 리포트 고착**: `selectMilestoneReportType`(`src/reports/milestone-selection.ts`)이
  첫돌 도달 후 영원히 `first-birthday`를 부른다. 세 살 아이의 부모가 리포트 탭에서 보는 마일스톤
  카드는 **첫 1년 창의 합계**다. 카드가 제목·창 문구로 자기가 무엇인지 정확히 말하므로 **허위
  표시는 아니고**(선행 확인 4), 다음 마일스톤을 정의하는 것은 새 리포트 타입 = 서버 계약 결정이다.
  **설계 항목으로 남긴다.**
- **`affiliate_clicks.user_agent`가 원문 그대로 400일 남는데 읽는 곳이 0건이다**
  (`schema.prisma:523`). 같은 표의 IP는 **해시**한다(`ipHash` — `hashClickIp`). 즉 한 표 안에서
  한 식별자는 최소화하고 다른 하나는 원문이다. 처리방침·데이터 세이프티에는 이미 기재돼 있어
  **법적 결함은 아니다**(`infra/legal/privacy-policy.html:80` · `docs/store/data-safety-answers.md:129`).
  지우거나 해시하는 것은 PM 판단이므로, 이번에 할 수 있는 것은 **왜 남기는지를 컬럼 옆에 적는 것**
  뿐이다(라운드 64~68이 다섯 번 쓴 형식의 여섯 번째). 트랙 D가 같은 도메인을 열지만 파일이
  다르므로 **묶지 않았다** — 채택한다면 D에 한 칸 붙이는 편이 싸다.
- **`worker-jobs.db.test.ts`의 ScheduledPublishJob 보상 케이스 플레이크 — 이번 라운드에는 처방을
  내리지 않는다(기각).** 라운드 61의 "생존 픽스처 면역" 처방은 **이미 이 파일에 적용돼 있다**:
  `scopedPrisma`가 `contentRevision.findMany`에 `id IN (이 파일의 픽스처)`를 AND로 덧붙여
  예약 게시 잡의 due 배치와 stale 회수를 모두 좁힌다(파일 머리말 "해법은 link-health.db.test.ts의
  TEST-132 기법 복제다"). 그리고 `publishDueScheduled`의 **호출부는 이 잡 하나뿐이고**
  (`grep publishDueScheduled` → 서비스 정의 + 잡), 워커 스케줄러는 `WORKER_ENABLED=1`에서만 돌며
  테스트는 그 값을 켜지 않는다. `content_revisions`를 **전역으로 지우는 술어는 저장소에 0건**이다
  (파기 잡의 어느 phase에도 없다 — 라운드 68 D가 그 사실을 스키마 주석으로 못박았다). 즉
  **"병렬 스위트 퍼지"라는 가설의 경로가 코드에 없다.** 처방을 지어내는 대신, 다음 실패에서
  **실제 단언 이름과 관측된 status를 남길 것**을 요구한다(라운드 61이 만료 픽스처에서 그렇게
  원인을 확증했다). 근거 없는 면역 처방은 통과하는 테스트의 모양만 바꾼다.
- **오프라인 storage 상태에 "unread"가 없다**(round68 리뷰 S-3) · **어드민 카탈로그 목록 전량 조회**
  (문턱 500건 · 현재 준비템 62 — 문턱 한참 아래) · **`admin-e2e.mjs`의 복구 코드 잔량 미커버** ·
  **4가구 이상 계정의 "다른 가구 보기" 전용 화면 부재** · **`viewedHouseholdId` 탭 이탈 소실** ·
  **다자녀 알림은 "본 아이" 것만 생성** · **아이 삭제 대상 표기의 다자녀 문턱** ·
  **판매처별 가격 표시(사용자 결정 대기 — 제안하지 않는다)** · **발행 `before` 경합(주석 수용)** ·
  **`monthly_wrapup` 콜드 스타트 시점(수용)** · **40주 초과 저장 프로필의 달력 초기 달** ·
  **`onBudgetRelevantChange` 이름** · **가져오기 확정 칸 1건(라운드 67의 명시적 교환)** —
  라운드 62~68이 남긴 그대로이고 이번 라운드에도 상태 변화가 없다.
- **온보딩 첫 화면과 알림 벨의 이모지 글리프**(`app/(onboarding)/child-status.tsx` · `NotificationBell.tsx`) —
  라운드 66~68 P3 그대로.

## 코드 건강 판정

- **이번 라운드의 스윕은 "사실이 사용자에게 도달하는 경로"였고, 셋 다 같은 모양의 구멍을 냈다.**
  라운드 68이 **경계 상수**를 축으로 잡았다면 이번에는 **전달 경로**다 — ⓐ 파괴적 액션이 세는
  모집단(후보 1) · ⓑ 실패 코드의 화이트리스트(후보 2) · ⓒ 값을 모를 때의 폴백(후보 3). 공통점이
  뚜렷하다: **세 자리 모두 "기능은 이미 있고, 목록/표/판정에 한 줄이 빠졌을 뿐"이다.** 그래서 셋 다
  구조 변경 0건이고, 셋 다 **다음 라운드가 같은 자리에 또 한 줄을 빠뜨릴 수 있는 모양**이라 계약이
  값을 세는 방식이어야 한다(예: teardown이 부르는 `resetAll` 목록과 로그아웃 문구가 세는 목록이
  **같은 술어에서 파생되는가**).
- **`api-error.ts` 화이트리스트가 이번 스윕의 진짜 교훈이다.** 그 표는 라운드 45에 세워진 뒤
  **코드가 늘 때 함께 늘어나는 규율이 없었다** — 라운드 68이 서버 코드를 둘 만들면서 표를 열지
  않은 것이 증거이고, 그 이전에도 넷이 밀려 있었다(후보 2). 표를 채우는 것보다 중요한 것은
  **"이 코드는 앱에서 어떻게 보이는가"를 코드 추가의 체크 항목으로 만드는 것**이고, 그 자리는
  `api-error.test.ts`의 소스 계약이다(서버가 던지는 4xx 코드 목록과 표의 교집합을 단언하는 형식 —
  라운드 64 M-2·67 B가 쓴 "두 자리가 같은 사실을 말하는가"의 여섯 번째 표본).
- **`VALIDATION_ERROR`는 코드가 아니라 바구니다.** 완성된 해요체 문장이 그 안에 갇혀 있는 자리를
  하나 찾았는데(카테고리), 이것은 표의 결함이 아니라 **코드 부여 규칙의 결함**이다. 같은 모양이
  더 있는지는 이번에 다 훑지 못했다 — 어드민 경로의 `BULK_ROW_*` 열두 코드는 잘 갈라져 있고,
  앱이 지나는 경로에서 확인된 것은 이 한 자리다. **다음 라운드가 이 축을 이어받는다면 질문은
  "이 400의 사유가 코드에 있는가, 문장에만 있는가"다.**
- **큰 파일 판정은 라운드 68의 갈래를 그대로 유지한다.** 오늘의 줄 수:
  `app/(tabs)/index.tsx` 2,516 · `app/expenses/new.tsx` 2,364 · `app/(tabs)/records.tsx` **1,761**
  (라운드 68 전 2,001 — E가 267줄을 떼었다) · `app/expenses/[expenseId].tsx` 1,423 ·
  `app/import/[importJobId].tsx` 1,375 · `app/(tabs)/reports.tsx` 1,370 ·
  `app/items/[itemTemplateId].tsx` 1,206. **캡처를 지지 않는 쪽**(`records.tsx`·`[expenseId].tsx`·
  `[importJobId].tsx`)에서만, 한 덩어리씩이라는 기준은 그대로다. **이번 라운드는 그 축을 팔지
  않는다** — 후보 셋이 전부 다른 파일이고, 라운드 68이 방금 떼어 낸 자리를 연속으로 건드리는 것은
  회귀 위험만 겹친다.
- **테스트 사각은 이번에도 "없는 것을 잡는 계약"이다.** 후보 1·2·3이 오래 살아남은 이유가 같다 —
  *목록에 없다*·*표에 없다*·*폴백을 썼다*는 사실은 **어떤 단언도 깨지 않는다**. 그래서 이번
  계약도 전부 **교집합/파생 형태**로 세울 것: 로그아웃 문구가 세는 저장소 목록과 teardown이
  지우는 목록, 서버 4xx 코드 목록과 화이트리스트, 준비템 탭의 밴드 입력과 `["children"]` 캐시.
- **api 테스트 하네스의 동시 실행 구멍은 라운드 61 A가 "이름만 붙였다"고 명시했고 이번에도
  닫히지 않았다 — 재제안 아님**(그 문서의 QA 수칙을 따를 것: 결과를 근거로 삼기 전에 같은 DB를
  쓰는 다른 실행이 없는지 먼저 확인한다).

## 트랙 구성 (파일 단위 상호 배타)

- **A 로그아웃이 지우는 목록을 다 세기** (#1) — **즉시 착수 가능**
  - 소유: `apps/mobile/app/settings/index.tsx` · `apps/mobile/src/offline/messages.ts` ·
    `apps/mobile/src/export/ExpenseCsvExport.tsx`(`devicePendingRecords`만) ·
    `apps/mobile/src/expenses/recurring-template.ts`(문구만) ·
    `apps/mobile/src/expenses/failed-row-prefill.ts`(P3 문구 이사) · 관련 `*.test.ts`
  - 금지: **새 요청 0건**(정기 지출 개수는 zustand 셀렉터, 대기 건수는 이미 구독 중인 스냅숏) ·
    **0/0이면 로그아웃 문구 무변경**(없는 위험을 지어내지 않는다) · **구매 확인 대기·알림함·
    이어보기·PIN은 세지 않는다**(각각의 근거를 주석에 적을 것 — 적지 않으면 다음 라운드가 목록을
    늘린다) · `storage === "unknown"` 문장 **무변경**(정기 지출은 다른 저장소다 — 두 사실을 한
    문장에 섞지 말 것) · `clearSession("expired")` 경로·로그인 화면 문구 **무접촉**(AUTH-127) ·
    `src/offline/session-teardown.ts` **동작 0줄 변경**(이 트랙은 세는 쪽이다) ·
    정기 지출을 서버로 올리지 말 것(DNC-007·DNC-013 — 라운드 66 #4의 긴장 그대로) ·
    `app/expenses/recurring.tsx` 레이아웃 무변경
  - 계약: 로그아웃 문구는 `syncStatusDiscardAllConfirmMessage` 계열과 **같은 두 가지**를 말할 것
    (어디에만 있는지 · 되돌릴 수 있는지)이되 **두 모집단을 한 문장에 합치지 말 것**,
    `RECURRING_DEVICE_ONLY_NOTICE`와 로그아웃 문구가 **같은 사실을 말하는지**를 소스 계약으로,
    회귀 고정은 **네 좌표**(대기0·정기0 = 종전 한 줄 / 대기N·정기0 / 대기0·정기M / 둘 다) +
    teardown이 부르는 `resetAll` 목록과 문구가 세는 목록의 **파생 단언**, 해요체(DNC-018)

- **B 실패의 이름 — 서버가 말한 사유를 화면까지** (#2) — **A와 독립, 즉시 착수 가능**
  - 소유: `apps/mobile/src/api/api-error.ts` · `apps/api/src/onboarding/store-shared.ts` ·
    `apps/api/src/onboarding/expenses-store.service.ts` ·
    `apps/api/src/onboarding/import-pipeline.service.ts`(개명 호출부만) ·
    관련 `*.test.ts` · `apps/api/test/*`
  - 금지: **모르는 코드의 폴백 규칙 무변경**(서버 원문을 그대로 노출하지 말 것 — 라운드 45가 세
    가지 이유로 거절한 길이다) · **분류·status·body 무변경**(permanent/transient 경계,
    `isRetryableSyncError`의 401/408/429 예외) · `ACCOUNT_STATUS_ERROR_CODES` 확장 금지 ·
    **`VALIDATION_ERROR`를 표에 넣지 말 것**(바구니 코드다 — 카테고리 갈래에 자기 코드를 준다) ·
    날짜 두 코드의 문구는 **새로 짓지 말 것**(`entry-form-guards.ts`·`child-form.ts`의 상수를
    읽는다 — 그 두 파일은 **읽기만**, 편집은 A·C 어느 트랙도 하지 않는다) ·
    개명은 **이름만**(판정·기준 시각·던지는 코드 한 글자도 바뀌지 않는다) · 마이그레이션 0건
  - 계약: 표에 코드를 더하는 규율을 **소스 계약으로** 세울 것(앱이 지나는 4xx 코드 목록과
    화이트리스트의 교집합 — 라운드 64 M-2·67 B의 "두 자리가 같은 사실을 말하는가" 형식),
    404 둘에는 **다음에 할 일**을 붙이되 재시도를 권하지 말 것(`USER_WITHDRAWN`의 형식),
    개명 후 `assertExpenseDateWithinPastFloor`와의 관계를 머리말에 남길 것, 해요체(DNC-018)

- **C 준비템 탭의 시기 밴드 — 출처 하나, 모르면 모른다** (#3) — **A·B와 독립**
  - 소유: `apps/mobile/app/(tabs)/items.tsx` · `apps/mobile/src/items/stage-bands.ts` ·
    관련 `*.test.ts`
  - 금지: **폴백 밴드 값(`"12-24개월"`) 변경 금지**(ITEM-001 캡처 판정이 딸려 온다) ·
    `isPixelLockMode` 최우선 규칙 **무변경**(이중 게이트를 **값으로 증명할 것**) ·
    `shouldOfferPreBirthFilter`·`src/items/pre-birth-filter.ts`·`item-filters.ts` **판정 무접촉**
    (입력 출처만 바뀐다) · 목록 요청(`tab="all"`)·준비율·찜 칩 **무접촉** ·
    **로딩 중에는 아무 말도 하지 말 것**(정착 판정은 기존 `isChildrenSettled`) ·
    `["children"]` 쿼리 옵션 변경 금지(이미 화면이 쓰는 그대로 읽기만) ·
    서버 0건 · `app/(tabs)/index.tsx`(홈)·`reports.tsx` **무접촉**
  - 계약: `currentStage`의 두 출처가 **서버에서 같은 함수(`toChildDto`)에서 온다**는 사실을
    주석 근거로 남길 것, `resolveDefaultStageLabel`은 **값과 "폴백을 썼다"를 함께** 돌려줄 것
    (라운드 61 S-4·68 #2가 세운 "0건과 모름은 다르다"의 같은 형식), 회귀 고정은 **네 좌표**
    (임신·출생 각각 × 아이 캐시 있음/실패) + **비세션 렌더 불변**, 해요체(DNC-018)

- **D 밖으로 나가는 링크의 실패 화면** (#4) — **완전 독립(서버), 즉시 착수 가능**
  - 소유: `apps/api/src/items-commerce/redirect.controller.ts` ·
    `apps/api/src/items-commerce/affiliate-link-guard.util.ts`(문구 자리만, 필요할 때) ·
    `apps/api/test/affiliate-redirect.e2e.test.ts` · (채택 시) `apps/api/prisma/schema.prisma`의
    **`AffiliateClick.userAgent` 블록 주석만**(P3의 여섯 번째 판정 기록)
  - 금지: **성공 경로(302)·목적지 계산·허용목록 판정·클릭 행 생성 순서 무변경** ·
    **상태 코드 404 유지**(스모크 `scripts/qa/server-smoke.sh:101`이 그 숫자를 본다) ·
    **새 공개 라우트/프리픽스 예외를 열지 말 것**(짧은 `/r/`는 P3 그대로) ·
    실패에 클릭 행을 남기지 말 것 · **이 페이지에서 다른 판매처를 추천하지 말 것**
    (DNC-010·DNC-011이 통째로 딸려 온다) · 존재 오라클 금지(미존재·비활성·도메인 차단이 **같은
    페이지**) · 어드민 표의 복사 URL(`toAdminProductLinkDto`)·`shareableRedirectUrl` **무접촉** ·
    `GlobalExceptionFilter` 무변경(이 라우트 안에서 끝낼 것)
  - 계약: 페이지는 초대 랜딩(`invite-landing.controller.ts`)과 **같은 형식**일 것(헤더 셋 ·
    이스케이프 · 자족적 HTML · `noindex`), **`/api/v1` 아래에서 HTML을 내는 근거**(권고: `Accept`
    협상)를 컨트롤러 머리말에 적을 것, e2e는 **네 갈래**를 고정할 것(정상 302 불변 ·
    미존재 · 비활성 · 도메인 차단 — 뒤 셋이 **바이트 단위로 같은 본문**인지), 해요체(DNC-018)

- **E 오래 남은 부채 셋 + a11y 계약** (#5) — **A·B·C·D와 독립**
  - 소유: `apps/mobile/app/import/index.tsx`(`hitSlop` 한 값만) ·
    `apps/mobile/src/consent/legal-links.ts` · `apps/mobile/src/onboarding/step-ui.tsx` ·
    **`apps/mobile/src/a11y-contract.test.ts`**(이 라운드의 유일한 소유자 — 뒤로가기 산수 +
    라운드 69 신설 UI의 낭독 계약을 **여기 한 곳에** 넣는다)
  - 금지: **렌더 0건 변경**(`hitSlop`은 레이아웃 속성이 아니다 — IMP-003/ExcelPreview 캡처 불변) ·
    `styles.backButton`의 32×32·`navigationBar` 레이아웃 **무변경**(높이로 벌지 않는다) ·
    `app/import/index.tsx`의 라운드 68 라벨 배선·픽셀락 자산 **무접촉** ·
    죽은 export 삭제 전 **살아 있는 이웃 상수와 이름이 겹치지 않는지 확인할 것** ·
    다른 트랙의 소스 파일 무접촉
  - 계약: 뒤로가기 48dp를 **산수로** 단언할 것(`:1261`·`:1318`이 쓴 형식 그대로 — 그래야 다섯 번째
    이월이 없다), 트랙 A·C가 만드는 새 UI의 낭독 계약도 **같은 파일에서** 세울 것(문구를 다시
    단언하지 않고 그 문구가 낭독되는 자리에 걸려 있는지만 본다 — 라운드 66·67·68의 형식)

- **F 실기기 체크표 · 접근성 표 · 문서** — **A·B·C·D·E 머지 후**
  - 소유: `docs/qa/runtime-verification-required.md` ·
    `docs/qa/accessibility-offline-checklist.md` ·
    `docs/operations/known-limitations.md`(C절 — **답이 도착하면 그 줄을 지운다**) ·
    `docs/5차/launch-readiness-status.md`
  - 금지: 제품 소스 0건 · `src/a11y-contract.test.ts` **무접촉**(이번 라운드는 E가 소유한다) ·
    C절 문장을 다시 다듬지 말 것(라운드 67이 답을 적을 칸까지 만들어 뒀다) ·
    후보 5의 죽은 export 항목을 §1-1에 만들지 말 것(화면 변화 0건)
  - 계약: **⚠️ 물려받은 빚부터 갚을 것 — a11y 표에 `A-9`(라운드 68 신설 UI)가 없다**(선행 확인 2).
    라운드 68의 다섯(로그아웃 고지 · 업로드 아이 라벨 · 지금 잠그기 행 · 깨진 링크 공유 차단 ·
    달력 뷰 분리)을 **A-9**로 먼저 세우고, 라운드 69분을 **A-10**으로 잇는다.
    체크표 §1-1은 **82행부터**: 로그아웃 정기 지출 고지(후보 1 — ⚠️ **대기 0·정기 0이면 종전 한 줄
    그대로인지** · 정기 지출만 있을 때 그 문장만 뜨는지 · 실제로 로그아웃하면 목록이 비는지 ·
    정기 지출 화면의 고지가 로그아웃도 말하는지), 실패 행 문구(후보 2 — ⚠️ **모르는 코드는 종전
    문장 그대로인지** · 준비템 상태 큐 행도 같은 문구를 받는지 · 재시도 버튼 유무가 안 바뀌었는지),
    준비템 시기 밴드(후보 3 — 비행기 모드로 아이 캐시를 비운 채 탭 진입 시 **밴드를 지어내지
    않는지** · 임신 계정에서 "출산 전" 칩이 살아 있는지 · ⚠️ **정상 상태가 종전과 한 글자도 다르지
    않은지** · ITEM-001 비세션 렌더 불변), 공개 링크 실패 화면(후보 4 — **실기기 카카오톡으로 보낸
    링크를 다른 폰에서 열 것** · 정상 링크의 302가 그대로인지 · 세 실패 갈래가 같은 화면인지),
    뒤로가기 48dp(후보 5 — 렌더 불변 + 실제로 넓어졌는지).
    각 행에 **부정 조건**을 함께 적을 것(이번 변화 다섯 중 넷이 "종전과 한 글자도 달라지면 안 되는
    쪽"을 갖는다). **C-3(잠금 오버레이 낭독, 릴리즈 전 필수)은 세 라운드 연속 미확인이다 — 이번에
    답이 오게 할 것.**

- **머지 순서**: **A · B · C · D · E는 서로 완전 독립**이다(A=설정·오프라인 문구, B=오류 코드
  양쪽 층, C=준비템 탭, D=커머스 리다이렉트, E=가져오기 화면 한 값 + a11y 계약 — 파일이 한 곳도
  겹치지 않는다). 유일한 접점은 **B가 `entry-form-guards.ts`·`child-form.ts`를 읽기만 한다**는
  것이고 그 두 파일은 어느 트랙도 편집하지 않는다. **E는 다른 트랙이 만드는 UI의 낭독 계약도
  지므로 A·C보다 늦게 마무리하는 편이 낫다**(파일은 겹치지 않으니 착수는 언제든 가능하다).
  **F는 마지막이고, 이번 F는 라운드 68에서 물려받은 A-9부터 갚는다.**
