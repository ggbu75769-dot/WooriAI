# 라운드 78 정찰 노트 (GAP-078)

> master 8559312(라운드 77 머지, PR #82) 기준 · 2026-08-30 실측. do-not-change.md(DNC-001~020) ·
> known-limitations A~R절 · gap-analysis 제외 판정 · round55-plan §6 비범위표 · round56~77-scout
> 완료분 · round61-backlog 대조 완료. 아래는 전부 그 밖이거나, 라운드 77이 **다음 결정의 입력으로
> 지목해 둔** 자리다.
>
> **라운드 77이 축을 "핵심 루프의 오른쪽 절반"(준비템 → 링크 → 구매 → 기록)으로 잡았다면,
> 이번 라운드는 축을 그 루프의 왼쪽 끝 — 루프가 시작되기도 전의 관문(아이 프로필·임신→출생
> 전환) — 과, 루프를 **사람 없이** 돌리는 층(백그라운드 워커)으로 옮긴다.**
>
> 이번 라운드의 관측도 하나로 모인다 — **라운드 77이 세운 다섯 판정이 전부 "한 칸 옆"에서
> 그대로 다시 성립한다.** 고친 자리는 고쳐졌고, **같은 병이 이웃 칸에 그대로 있다.**
> ① **R-1이 커머스 여정에서 고친 것**(서버가 코드로 말한 실패가 앱 표 밖에 있다)이
>    **아이 프로필 여정에 그대로 있다** — 그리고 그 여정에는 스윕조차 없어서, 표에 이미 있는
>    문장(`CHILD_BIRTH_DATE_TOO_OLD`)마저 온보딩 화면에는 **구조적으로 설 수 없다**(후보 1).
> ② **R-3이 어드민에서 이름 붙인 것**(사유를 버리는 것이 우연히 방패였다)의 반대 짝이
>    **워커에 있다** — 예약 게시 잡은 사유를 **요약에 담아 돌려주는데 아무도 읽지 않는다.**
>    파기 잡은 정확히 그 병을 **자기 클래스 주석에 적고 이미 고쳤다**(후보 2).
> ③ **R-4가 감춘 것은 제출 컨트롤뿐이었다** — `analyst`는 오늘도 편집 폼을 열어 값을 고칠 수
>    있고, [수정] 토글은 역할을 모른다. 옆 탭 `/categories`는 그 토글까지 이미 감춘다(후보 3).
> ④ **R-6 P-3의 "함수당 쓰기 호출 하나" 가정**은 실측하니 오늘 참이고(24 = 24), 그래서
>    **어긋나는 날 아무도 모른다** — 세 수치가 서로 다른 단위(호출부 / 시그니처)로 세어진다(후보 4).
> ⑤ **R-1 리뷰 M-3의 `indexOf` 끝점 위험은 일반형이었다** — 저장소 전체에서 **`indexOf`로 자른
>    구간 위에 선 부정 단언 74자리**가 실재 가드 없이 서 있고, 그중 **열한 자리는 바늘이 인자·
>    시그니처 모양**이라 M-3과 **같은 방식으로** 조용해진다(후보 5).

## 선행 확인 열하나 (후보 아님)

1. **라운드 77의 여섯 트랙은 전부 머지돼 있다**(실측). A=`src/api/api-error.ts:261`·`:263`의 표 두 줄 +
   `app/items/[itemTemplateId].tsx:644`의 `onError: (error) =>`, B=`src/lib/admin-api.ts`의 연결 실패
   갈래(+`retrySafe` 플래그 · `CONNECTION_FAILURE_CODE`), C=`ProductLinkBulkReplace.tsx`의
   `handlePreview` 갈래 넷 + 대장 **열다섯**, D=`src/lib/admin-role-copy.ts`(상수 **둘**) +
   `src/admin-write-role-gate.test.ts`(**643줄**), E=`src/family/invite-permissions.ts`의 `serverCopy`
   갈래, F=known-limitations **R절**. **재제안 대상이 아니다.**
2. **시드 카탈로그는 라운드 77 이후로도 그대로다**(2026-08-30 실측): `prisma/seed-data.ts`
   **2,083줄** · `active: true` **120** · `isSponsored: true` **5** · `timingLabel` **63**.
   **상태 변화 없음** — N-4 재검토 트리거(카탈로그 200건)는 발동하지 않았다(P3 참고).
3. **DNC-009/010/011은 오늘도 배선돼 있다.** `item-ranking.ts`의 수수료 grep 0건 ·
   `recommendation.ts`의 부정 단언 · `src/items/link-marker.ts` 한 자리의 마커·고지·공유 문장.
   **이 축에 후보 없음이고, 이번 라운드의 어느 트랙도 그 파일들을 열지 않는다.**
4. ⚠️ **지출→리포트의 데이터 정확성 축을 전수로 재었고 후보가 0건이다**(이번 라운드가 가중해
   따라간 방향 하나 — 값을 남긴다).
   - **합계 술어가 한 곳이다.** `expenses-store.service.ts:562` `sumExpenses`가
     `deletedAt: null` + `expenseType: "expense"`(선물·환불 제외, DNC-014/015) 하나를 들고,
     홈·월간·추이·연간·누적·카테고리 **여섯 집계 전부**가 그 술어를 글자 그대로 되풀이한다
     (`reporting-store.service.ts:74`·`:94`·`:137`·`:176`·`:219`·`:296`). 목록의 `totalAmountKrw`도
     배열 합이 아니라 그 DB 집계다(`expenses-store.service.ts:232-247` — 페이지네이션이 총액을
     흔들지 않게 한 자리).
   - **기간 경계도 한 곳이다.** `getSeoulMonthRange`의 `[startInclusive, endExclusive)` 하나를
     여섯이 함께 쓰고, 연·분기 경계는 정수 산술이라 서버 로컬 타임존과 무관하다
     (`trailingYearMonths` — `reporting-store.service.ts:25-34`). 날짜는 `date` 컬럼(일자)이라
     **시간대가 개입할 자리가 없다**.
   - **경계 입력의 500 구멍도 이미 막혀 있다.** `YEAR_MONTH_INPUT_PATTERN`
     (`common/validation/year-month.ts:21`)이 월을 `01-12`로 묶는데, 그 주석이 *"unbounded `\d{2}`가
     `2026-13`을 통과시켜 getSeoulMonthRange에서 500으로 터지던"* 사실을 값으로 적고 있다.
   - **환불은 서버가 만들 수 없는 값이다**(실측): `EXPENSE_TYPES`는 셋인데
     (`packages/domain/src/enums.ts:33`) 생성·수정 DTO는 `expense|gift`만 받고
     (`packages/contracts/src/schemas.ts:179`·`:231`), `apps/api/src`에서 `"refund"`를 쓰는 자리는
     **주석 한 줄**뿐이다. 앱의 환불 처리(배지·선물 체크박스 비활성·`expenseTypeForWire`)는
     **보존 로직**이고 허위 표시가 아니다. known-limitations가 이미 REC-121b로 전량 기록해 두었다.
   - **CSV 왕복의 손실도 이미 값으로 고정돼 있다**(`src/export/expense-csv.ts:22-27` +
     `apps/api/test/mobile-export-csv-roundtrip.test.ts`): 재가져오기가 살리는 칸은 날짜·항목·금액·
     메모 넷이고 구분·카테고리·판매처·결제수단·출처는 버려진다. **되살리려면 `import_rows` 스키마
     변경이 필요해 마이그레이션 0건 원칙 밖이다**(아래 기각 참고).
   **결론: 이 축에서 이번 라운드가 열 자리는 없다.** 다음 라운드가 같은 스윕을 다시 돌리지 않도록
   위 여섯 자리를 값으로 적어 둔다.
5. **커머스 실패 문구는 라운드 77 A가 닫았다.** `onError: (error) =>`가
   `apiErrorMessageForCode`를 지나고, 아는 코드면 폴을 띄우지 않고 `showLinkNotice`로 간다
   (`app/items/[itemTemplateId].tsx:644-649`). **이 축에 후보 없음.**
6. **구매 확인 루프의 등록 시점은 오늘도 정직하다** — `registerPurchaseFollowup`은
   `Linking.openURL` 성공 뒤에만 불린다(`:612-613`). 라운드 60 #4 그대로.
7. **워커 관측 인프라는 이미 두 축을 갖고 있다** — `stale`(틱이 끊겼다)과
   `degraded`(한 잡이 임계치 연속 실패)이고, 어드민 대시보드가 그 둘을 읽어 실패한 잡 **이름까지**
   말한다(`src/lib/worker-health-view.ts:48-51`의 `workerHealthStateNote`). **후보 2가 세우는 신호는
   배선 0건으로 그 문장에 실린다**(⚠️ 이 사실이 후보 2의 최소안을 서버 한 파일로 줄인다).
8. **파기 잡·링크 검사 잡은 이미 정직하다.** 파기는 phase 실패를 모아
   `DataRetentionPurgePhaseFailureError`로 **던지고**(`data-retention-purge.job.ts:686-696` ·
   그 이유가 `:672-682` 주석에 적혀 있다), 링크 검사는 판정 실패를 `errors`로 세어
   대시보드가 *"N건은 확인하지 못했어요"* 로 읽는다(라운드 44 N-9). **후보 2는 이 둘 사이에
   혼자 남은 셋째다.**
9. **어드민 예약 게시 화면은 "지난 예약" 배지를 이미 세운다**(라운드 73 D ·
   `src/lib/revision-rows.ts:97`의 `OVERDUE_SCHEDULE_NOTE`). ⚠️ 다만 그 주석이 적은 원인은
   *"워커가 꺼졌거나 멈춘 동안 그 시각이 지나갔다"* **둘뿐**이고, 셋째 원인(워커는 정상인데
   발행이 매 틱 실패한다)은 그 화면이 구분할 방법이 없다 — **후보 2가 여는 자리가 정확히 거기다.**
10. **하단 탭 넷 · 죽은 라우트 0건은 이번 라운드도 재스윕하지 않았다**(라운드 76이 전수 확인 ·
    77도 세지 않았다 — **두 라운드 연속 미확인**이라는 사실이 다음 라운드의 입력이다).
11. ⚠️ **api vitest는 이번 라운드도 돌리지 않았다**(정찰에 불필요 · 지시로 금지).
    `worker-jobs` 플레이크 관찰 기록 없음.

## 상위 후보

### 1. **루프에 들어오기 전 관문이 막다른 문장으로 끝난다 — 그 여정에는 스윕이 없고, 표에 이미 있는 문장조차 설 수 없다** — 모바일·온보딩/전환 — S

- **근거**: 넷이 한 줄로 이어져 있다.
  - ⓐ **서버는 이유를 코드로 말한다.** `apps/api/src/onboarding/onboarding-core.service.ts`가
    아홉 코드를 던지고, 그중 아이 프로필 여정의 넷은 전부 **해요체이고 다음에 할 일을 말한다**:
    `CHILD_BIRTH_DATE_FUTURE`(`:130` — *"출생일은 오늘보다 미래일 수 없어요."*) ·
    `CHILD_DUE_DATE_BEYOND_TERM`(`:214` — *"만삭(N주)보다 먼 날은 고를 수 없어요."*) ·
    `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`(`:452` — *"아이 상태는 '임신 중'에서 '태어났어요'로만
    바꿀 수 있어요."*) · `CHILD_STAGE_INPUT_REQUIRED`(`:93`·`:96`·`:99`·`:458`).
    ⚠️ **넷 다 다시 눌러도 결과가 같다.**
  - ⓑ ⚠️ **그 여정을 스윕하는 계약이 0건이다.** `src/api/api-error.test.ts:430`의 스윕은 단위가
    **아웃박스·준비템 상태 큐**이고 `outboxPathFiles`는 넷이다(`:431-439`) — **`onboarding-core.service.ts`가
    그 안에 없다.** 그래서 표에 있는 유일한 아이 코드(`CHILD_BIRTH_DATE_TOO_OLD`)는 스윕이 아니라
    **라운드 69 B가 손으로** 넣은 것이고, 그 뒤 서버가 더한 세 코드는 아무 단언도 깨지 않은 채
    표 밖에 있다. **가져오기 여정에는 목록이 있고(`IMPORT_JOURNEY_SERVER_FILES` — 셋),
    아이 프로필 여정에는 없다**(L-1의 큰 질문이 실제로 값을 치르는 첫 자리다).
  - ⓒ ⚠️⚠️ **온보딩 화면은 표를 구조적으로 읽지 못한다 — R-5가 초대 화면에서 고친 그 모양이다.**
    `src/onboarding/step-ui.tsx:116-124`:
    ```
    export function onboardingSaveErrorMessage(error, { isOnline = true } = {}) {
      if (isOnboardingConsentRequired(error)) return ONBOARDING_CONSENT_REQUIRED_MESSAGE;
      if (isOnboardingSaveForbidden(error)) return ONBOARDING_SAVE_FORBIDDEN_MESSAGE;
      if (!isOnline) return OFFLINE_RETRY_NOTICE;
      return ONBOARDING_SAVE_FAILED_MESSAGE;
    }
    ```
    **아는 코드가 둘뿐이고 `API_ERROR_MESSAGES`를 부르지 않는다.** 그래서 **표에 이미 있는
    `CHILD_BIRTH_DATE_TOO_OLD`조차 온보딩 화면에는 설 수 없다** — 같은 실패가 아이 관리 화면
    (`app/settings/children.tsx:532-534`, `useSaveErrorCopy` → `resolveSaveErrorCopy` → 표)에서는
    *"20년보다 오래된 날은 고를 수 없어요."* 이고, 온보딩에서는
    *"저장하지 못했어요…"* 다. ⚠️ **한 여정의 두 화면이 같은 실패를 정반대로 말한다**
    (R-5가 `invite.tsx` ↔ `accept/[token].tsx`에서 잡은 그 비대칭의 쌍둥이다).
  - ⓓ **문장을 지을 필요가 없다 — 앱이 이미 글자까지 같은 문장을 들고 있다.**
    `src/children/child-form.ts:191`의 `computeDateError`가 *"출생일은 오늘보다 미래일 수 없어요."* 를
    **리터럴로** 들고 있고(서버 원문과 바이트 동일), `:123`의 `CHILD_DUE_DATE_BEYOND_TERM_ERROR`는
    **이미 export된 상수**다(서버 원문과 바이트 동일 — 둘 다 도메인의 만삭 주차를 읽는다).
    라운드 69 B가 `CHILD_BIRTH_DATE_TOO_OLD_ERROR`로 세운 선례가 **그 파일 그 자리에** 있다.
- **실패 시나리오**: 엄마가 임신 34주에 가입해 아이를 만들고 두 달 뒤 아기가 태어난다.
  아빠(공동양육자)가 먼저 [아이가 태어났어요]를 눌러 전환을 마친다. 엄마의 폰은 그 화면을 어제
  열어 둔 채라 아직 "임신 중"으로 보이고, 그도 [아이가 태어났어요]를 누른다. 서버는
  400 `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`로 막는다(이미 born이라 pregnant→born이 아니다).
  화면이 말한다 — **"저장하지 못했어요. 잠시 후 다시 시도해 주세요."** 그는 30초 뒤 다시 누른다.
  같은 문장. 앱을 껐다 켠다 — **그러면 목록이 새로고침돼 이미 태어난 것으로 보이지만**, 앱이
  "기다리면 된다"고 말했으므로 그가 앱을 끌 이유가 없다. — 그리고 그 사이 **100일 리포트·준비템
  밴드·마일스톤 카운트다운이 전부 출산예정일에 고정된 화면**을 본다(라운드 27이 stageMode 전환을
  만든 바로 그 이유다).
- **최소안**: **아는 코드는 표가 말한다. 새 한국어 문장 0건 · 서버 0건 · 새 모듈 0건.**
  ⓐ **표 세 줄** — `API_ERROR_MESSAGES`에 `CHILD_BIRTH_DATE_FUTURE`(⚠️ `child-form.ts`의 리터럴을
  `CHILD_BIRTH_DATE_FUTURE_ERROR` 상수로 **승격**해 읽는다 — 문자열 바이트 불변) ·
  `CHILD_DUE_DATE_BEYOND_TERM`(이미 있는 상수를 읽는다) · `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`
  (**서버 원문 그대로** — `EXPENSE_FUTURE_DATE`·`EXPENSE_CATEGORY_INVALID`가 세운 선례).
  ⚠️ **꼬리에 `"잠시 후 다시"`를 쓰지 않고 띄어 쓴 표기를 쓴다**(R-1 규율 — P3 참고).
  ⓑ **온보딩 모듈에 갈래 하나** — `onboardingSaveErrorMessage`의 순서를
  **전용 둘 → 오프라인 → 표 → 전용 폴백**으로. ⚠️ `CONSENT_REQUIRED`·403·오프라인·모르는 실패의
  출력은 **바이트 불변**이고(그 넷이 이 모듈의 계약이다), 달라지는 것은 **표가 아는 코드**뿐이다
  — 그것이 이 갈래의 목적이다.
  ⓒ **두 번째 여정 스윕 신설** — `CHILD_PROFILE_JOURNEY_SERVER_FILES`
  (`onboarding/onboarding-core.service.ts` · `onboarding/child-access.service.ts`)와 **이유가 적힌
  제외 목록**. ⚠️ **기존 아웃박스 스윕과 합치지 않는다**(단위가 다르다 — 아이 저장에는 큐가 없다.
  R-1이 얻은 규율: *제외·면제의 사유는 그 스윕의 단위로만 적는다*). 오늘의 제외는 넷이고 사유는
  전부 그 단위로 적힌다:
  - `CHILD_STAGE_INPUT_REQUIRED` — ⚠️ **한 코드가 서버에서 세 문장을 나른다**(예정일/생년월일/단계).
    **표의 단위는 코드**라 하나를 고르면 나머지 둘에 거짓이 된다.
  - `BUDGET_NOT_FOUND` — 실패가 아니라 정상 흐름이다(`src/api/client.ts:854`가 문자열로 판정해
    `null`로 접는다 — "예산 미설정"이 그 화면의 정상 상태다).
  - `CONSENT_REQUIRED` — 문구가 아니라 **복구 동선**이 답이다(전용 버튼 `onReconsent` ·
    `src/onboarding/step-ui.tsx:161-173`). 표에 넣으면 그 동선을 잃는다.
  - `SETTINGS_CONFIRMATION_REQUIRED` — 확인 문자열은 **앱이 만드는 상수**이지 사용자가 치는 값이
    아니다(`src/api/local-backend.ts:2171-2183` ↔ 서버 `"DELETE CHILD"`/`"LEAVE HOUSEHOLD"`/
    `"DELETE ACCOUNT"`). 이 코드가 나오면 사용자가 고칠 것이 없는 **배선 어긋남**이다.
  ⓓ **관측 하나를 값으로** — ⚠️ **표는 "코드 하나 = 문장 하나"를 가정하는데 서버는 그렇지 않다.**
  2026-08-30 실측: 서버가 던지는 코드 **95** 중 **열여덟**이 서로 다른 문장을 둘 이상 나른다
  (최대 `FORBIDDEN` **다섯**). 오늘 표 안에 있는 셋이 그 열여덟에 속한다 —
  `FORBIDDEN`(5) · `ITEM_NOT_FOUND`(2, 한쪽은 어드민 영문) · `PRODUCT_LINK_NOT_FOUND`(2, 한쪽은
  어드민 영문). **셋 다 앱이 부르는 갈래는 하나뿐**이라 오늘 거짓은 없고, **그 사실을 값으로
  적는 것**이 이 항의 전부다(표를 늘리는 다음 라운드가 먼저 물어야 할 질문이다).
- **설계 긴장**: 아홉이다. ⓐ **서버 0건**(코드·문장·가드·전환 규칙 무접촉). ⓑ ⚠️ **`src/offline/**`
  전부 무접촉** — 온보딩 모듈은 `isOnline`을 **계속 인자로 받으므로** 모듈 대장 셋(6·8·2)도
  `OFFLINE_AWARE_SAVE_ERROR_SCREENS` 다섯도 **한 줄도 바뀌지 않는다**(R-5가 트랙 A·E를 갈라 놓은
  그 조건과 같다). ⓒ **`app/settings/children.tsx` 무접촉**(이미 배선돼 있다 — 본보기를 만지지
  않는다). ⓓ **`app/onboarding/**` 화면 0건**(모듈 한 자리만 바뀐다). ⓔ **`computeDateError`의
  판정·갈래·출력 바이트 불변**(리터럴이 상수로 올라갈 뿐이다 — `child-form.test.ts`가 그대로
  초록이어야 한다). ⓕ **기존 아웃박스 스윕의 파일 목록·제외 사유 바이트 불변**(두 스윕은 나란히
  선다). ⓖ **`src/family/**` 0건**(R-5가 닫은 자리). ⓗ 마이그레이션 0건. ⓘ DNC-018 · DNC-007
  (아이 도메인의 의미는 건드리지 않는다 — 문구만 읽는다).

### 2. **예약 게시가 매 틱 실패해도 워커는 "정상"이라고 말한다 — 파기 잡은 그 병을 자기 주석에 적고 이미 고쳤다** — api·워커 침묵 실패 — S

- **근거**: 같은 폴더의 두 잡이 정반대다.
  - ⓐ **예약 게시 잡은 실패를 요약에 담아 돌려주고 끝난다.**
    `apps/api/src/worker/jobs/scheduled-publish.job.ts:21-33`은
    `{ publishedCount, failedCount, recoveredCount, … }`를 **반환**한다. 발행이 던지면
    `content-revisions.service.ts:461-473`이 그 행을 `in_review`로 되돌리고 **`scheduledFor`를 그대로
    남긴다** — *"next tick retries; the failure is surfaced via the returned summary … rather than
    thrown"*. ⚠️ **그 요약을 읽는 제품 코드가 저장소에 0건이다**(실측: `failedCount`는 이 파일이
    쓰는 한 자리와 `apps/api/test/worker-health.e2e.test.ts`가 **0인지 확인하는 단언 둘**뿐이다 —
    앱·어드민·모니터 어디에도 소비자가 없다. 모바일의 동명 필드는 앱 잠금 실패 횟수로 무관하다).
  - ⓑ **그래서 관측 두 축이 전부 통과한다.** `scheduler.service.ts:114-132`는 **던지지 않은 잡**을
    `status=ok`로 기록하므로 `WorkerStatusService`의 `consecutiveFailures`가 **0으로 리셋**되고
    (`worker-status.service.ts:134`), `degraded`는 영영 false다(`:174`). `stale`도 false다(틱은 정상이다).
    **어드민 대시보드는 "정상"이라고 쓴다.**
  - ⓒ ⚠️⚠️ **바로 옆 잡이 그 병을 이름까지 붙여 고쳐 두었다.**
    `data-retention-purge.job.ts:676-682`:
    > *"run() executes ALL phases first (isolation above is unchanged), but if any phase failed
    > terminally it then throws DataRetentionPurgePhaseFailureError … **Previously a stalled phase
    > was invisible: run() swallowed the error and the scheduler logged status=ok forever.**"*
    **정확히 같은 문장이 오늘 예약 게시 잡에 대해 참이다.** 격리(한 초안이 나머지를 막지 않는다)와
    가시성(틱이 끝난 뒤 실패를 던진다)이 **서로 배타가 아니라는 것**을 그 잡이 이미 증명해 두었다.
  - ⓓ **운영자 화면도 그 셋째 원인을 구분하지 못한다.** `/reviews`의 배지는
    *"지난 예약 · 아직 게시되지 않았어요"* 이고(`src/lib/revision-rows.ts:97`), 그 주석이 적은 원인은
    **워커 꺼짐·멈춤 둘**이다. 화면 위쪽 안내도 `SCHEDULE_BLOCKING_WORKER_STATES`(off/stale)에만
    선다. ⚠️ **워커가 정상인데 발행만 매 틱 실패하는 셋째 상태에서는, 두 표시가 서로 모순되지
    않은 채 둘 다 참이 아니다.**
  - **영구 실패는 가정이 아니라 실측된 경로다**: `worker-jobs.db.test.ts:452`가
    *"compensates a failed publish … without aborting the batch"* 를 재현하며 그 행을
    *"the permanently-failing row"* 라고 부르고 테스트 끝에서 손으로 지운다.
- **실패 시나리오**: 운영자가 제휴 고지 문구 개정을 검토하고 **금요일 저녁 9시 예약 게시**로
  걸어 둔다(법무가 정한 시각이다). 그 사이 다른 운영자가 그 고지 키를 지운다. 금요일 9시,
  워커가 초안을 집어 `publishToLive`가 던지고, 잡은 그 행을 `in_review`로 되돌린 뒤
  `failedCount: 1`을 **요약에 담아** 정상 종료한다. 1분 뒤 다시. 주말 내내 **2,880번.**
  월요일 아침 운영자가 어드민을 연다 — 대시보드는 **"백그라운드 작업: 정상 · 마지막 실행 방금 전"**,
  검토 화면은 **"지난 예약 · 아직 게시되지 않았어요"**. 그는 워커가 정상이라고 읽었으므로
  예약이 왜 안 나갔는지 알 방법이 없고, 실제 사유(*"롤백할 대상 항목을 확인할 수 없어요"* 류의
  예외 메시지)는 **API 프로세스 stdout에만** 있다. — 그동안 앱은 **개정 전 고지 문구**를 계속
  띄운다(DNC-010이 지키는 그 자리다).
- **최소안**: **파기 잡이 이미 세운 모양을 그대로. 새 판정 0건 · 어드민 0건 · 스키마 0건.**
  ⓐ **잡이 실패를 던진다** — 모든 due 초안을 **먼저 전부 처리한 뒤**(격리 무변경),
  `result.failed.length > 0`이면 `ScheduledPublishFailureError`(요약을 메시지에 담는다 —
  `DataRetentionPurgePhaseFailureError`의 생성자 모양 그대로)를 던진다.
  ⚠️ **`publishDueScheduled`는 한 글자도 바꾸지 않는다**(보상·CAS·크래시 복구·감사 로그는
  `content-revisions.service.ts`의 계약이고 이 트랙의 파일이 아니다) — 던지는 자리는
  **얇은 어댑터**인 잡 하나다.
  ⓑ **화면·API는 배선 0건으로 살아난다** — 스케줄러가 `lastStatus:"failed"`를 기록하고
  (`scheduler.service.ts:131`), 연속 셋이면 `degraded`가 서고, 대시보드가 이미
  *"연속 3회 이상 실패한 작업이 있어요: cms_scheduled_publish"* 라고 **이름까지** 말한다
  (선행 확인 7). **어드민 워크스페이스 무접촉이 이 트랙의 값이다.**
  ⓒ **부정 단언 셋** — ① 실패가 하나도 없으면 **던지지 않고 요약도 종전과 같을** 것,
  ② 실패가 있어도 **due 초안 전수가 시도되고 보상까지 끝난 뒤에** 던질 것(격리 불변 —
  한 초안이 나머지를 막지 않는다), ③ ⚠️ **`recovered`(크래시 복구)만으로는 던지지 않을** 것
  (복구는 성공이지 실패가 아니다).
  ⓓ **요약이 실패 틱에서 `{}`가 되는 대가를 값으로 적는다** — 스케줄러가 실패 시 빈 요약을
  기록하므로(`worker-status.service.ts:136-137`) 그 틱의 `publishedCount`는 대시보드에서 사라진다.
  ⚠️ **파기 잡이 이미 치른 그 대가이고**, 링크 검사 한 줄이 그것을 다루는 방법(요약 대신
  `lastStatus`·`consecutiveFailures`를 읽는다)을 라운드 44 M-3에서 이미 배웠다.
- **설계 긴장**: 여덟이다. ⓐ ⚠️ **`apps/admin/**` 0건**(대시보드 문장·`worker-health-view.ts`·
  `revision-rows.ts` 전부 무접촉 — 이미 있는 기계가 새 신호를 받는다). ⓑ **`content-revisions.service.ts`
  무접촉**(발행·보상·CAS·`recoverStalePublishing`·감사 로그·`SYSTEM_WORKER_ACTOR` 전부 그대로).
  ⓒ **`scheduler.service.ts` 무접촉**(잡별 try/catch·로그 형식·`running` 걸쇠·틱 순서 무변경).
  ⓓ **`worker-status.service.ts` 무접촉**(임계치 3·`sanitizeSummary`·`stale` 계산 무변경).
  ⓔ **다른 여섯 잡 무접촉**(특히 파기 잡 — 본보기를 만지지 않는다). ⓕ **`/health/worker` 응답
  스키마 무변경**(새 필드 0건 — 오늘의 필드가 답을 이미 나른다). ⓖ 마이그레이션 0건 ·
  환경변수 0건. ⓗ **한국어 문구 0건**(이 트랙이 만드는 것은 로그·예외 메시지이지 화면 문장이
  아니다 — DNC-018의 단위가 아니라는 사실을 주석 한 줄로).

### 3. **`analyst`는 여전히 편집 폼을 열어 값을 고칠 수 있다 — 감춘 것은 [저장]뿐이었다 (R-6 P-1, 채택)** — 어드민·막다른 화면 — M

- **근거**: 라운드 77 R-4가 *"제출 컨트롤만 감췄다"* 고 스스로 적은 그 절반이 실측된다.
  - **[수정] 토글이 역할을 모른다**: `app/items/page.tsx:646-655` · `app/links/page.tsx:671-679`.
    `analyst`가 그 버튼을 누르면 `startEdit`이 돌고 편집 폼이 통째로 열린다.
  - **폼의 입력칸이 전부 편집 가능하다**: `ItemFormFields`(`app/items/page.tsx:160`)와
    `LinkFormFields`(`app/links/page.tsx:150`)는 `mode: "create" | "edit"`만 받고 **역할을 모른다**
    (그 사실이 R-6 P-1에 이미 적혀 있다). 고지 문구 화면의 `<textarea>`도 같다
    (`app/disclosures/page.tsx:86` — 그 자리 주석이 *"textarea가 남는다 — 값을 보는 것은 정당하다"*
    라고 판단을 적어 두었다).
  - **생성 카드는 읽을 값이 아예 없다**: 세 화면의 "새 X 추가" 카드는 `analyst`에게도 **빈 폼
    전체**를 렌더하고 그 아래 캡션만 세운다(`items:521-547` · `links:469-486` · `disclosures:193-221`).
    ⚠️ **빈 생성 폼에는 읽을 데이터가 0건**이다 — 편집 폼과 달리 "값을 보는 것은 정당하다"는
    R-4의 근거가 **여기에는 적용되지 않는다.**
  - ⚠️ **옆 탭이 이미 토글까지 감춘다.** `app/categories/page.tsx:322-325`:
    ```
    {!canEdit ? (<span className={styles.hint}>-</span>) : isEditing ? (…저장/취소…) : (<button>수정</button>)}
    ```
    **행의 입력칸은 `isEditing`일 때만 그려지고, `isEditing`에 들어가는 문은 `canEdit` 뒤에 있다** —
    그래서 `/categories`에서 `analyst`가 편집 가능한 입력칸을 보는 경로가 **구조적으로 0건**이다.
    **다섯 화면 중 하나만 그 답을 갖고 있고, R-4는 그 답의 절반만 가져왔다.**
  - **오늘 이 사실을 무는 계약도 절반이다**: `src/admin-write-role-gate.test.ts:80`의
    `ADMIN_WRITE_SCREENS`는 `submits`(제출 컨트롤)만 세고 **편집 컨트롤을 세는 칸이 없다**.
    갈래 판정 기계(`submitIsInsideGate` · `splitTopLevelTernary` — 라운드 77 리뷰 S-2가 강화)는
    **이미 있고**, 새 필드 하나가 그것을 그대로 쓴다.
- **실패 시나리오**: 제휴 담당자(`analyst`)가 준비템 관리에서 『젖병 소독기』의 시기 라벨 오타를
  발견한다. [수정]을 누른다 — 폼이 열린다. 라벨을 고치고, 분류도 잘못돼 있어 함께 바꾸고,
  가격대도 손본다. **저장 버튼을 찾는다.** 없다. 그 자리에는
  *"…수정은 편집자(editor) 이상 권한이 필요해요."* 라는 캡션 한 줄이 있다. — **그는 세 필드를
  고친 뒤에야 자기가 고칠 수 없다는 것을 안다.** R-4가 세운 목표(*"누르기 전에 말한다"*)가
  여기서 **누른 뒤·고친 뒤**로 밀려 있다. 그리고 [닫기]를 누르면 그 편집분은 조용히 사라진다.
- **최소안**: **`/categories`가 이미 고른 답을 나머지 셋에. 새 한국어 문장 0건 · 서버 0건.**
  ⓐ **생성 카드는 `canEdit` 뒤로** — `{canEdit ? <폼 …/> : <p>{캡션}</p>}`. ⚠️ 빈 폼에 읽을 값이
  없다는 것이 이 갈래의 근거이고, **캡션은 라운드 77이 만든 상수 그대로**다(`admin-role-copy.ts` —
  바이트 불변 · 사본 0건 추가).
  ⓑ **편집 폼은 남기고 `readOnly`로** — `ItemFormFields`·`LinkFormFields`·고지 `<textarea>`가
  `readOnly: boolean` 하나를 더 받아 `<input>`·`<textarea>`에 `readOnly`, `<select>`·
  `<input type="checkbox">`에 `disabled`를 건다(⚠️ **`<select>`에는 `readOnly`가 없다** — 두 속성이
  갈리는 이유를 주석 한 줄로 적는다: readOnly는 **값을 읽고 복사할 수 있게** 남기고, disabled만이
  선택형에서 같은 뜻을 낸다).
  ⓒ **토글 라벨이 사실을 말한다** — `!canEdit`이면 `"수정"` 대신 `"보기"`(⚠️ **이미 이 콘솔에 있는
  낱말**이다 — `app/items/page.tsx:588`·`app/links/page.tsx:578`·`app/audit-logs/page.tsx:70`.
  새 문장 0건이고 새 낱말도 0건이다). `"닫기"`는 그대로다.
  ⓓ **대장에 칸 하나** — `ADMIN_WRITE_SCREENS`에 `edits`(편집 입력 컨트롤과 그 여닫이 토글)를
  더하고, `submits`가 이미 지나는 그 **"게이트 안에 있는가" 판정**을 재사용한다.
  ⚠️ **`submits`의 값·`allows`·`kind`·`SCREEN_NOTICE_CONSTANTS`는 한 칸도 바뀌지 않는다.**
  ⓔ **부정 단언 하나** — 쓰기가 역할로 갈리는 다섯 화면에서 **`canEdit`이 거짓일 때 렌더되는
  편집 가능 컨트롤이 0건**일 것(오늘 `/categories`·`/reviews`가 이미 만족하고, 나머지 셋이 합류한다).
- **설계 긴장**: 아홉이다. ⓐ ⚠️ **`isEditor` 갈래 바이트 불변**(검토 요청 문안 넷·성공 배너 둘·
  힌트 넷 — R-4가 세운 자리). ⓑ ⚠️ **쓰기 catch 자리 수 2·2·2 불변**(`WRITE_ERROR_COPY_SITES`가
  세는 값 — 컨트롤을 감출 뿐 catch를 지우지 않는다. 대장 총합 **열다섯** 무변경).
  ⓒ **`src/lib/admin-role-copy.ts` 무접촉**(상수 둘 · 파생 규칙은 라운드 77이 세웠다 — 부르기만).
  ⓓ **`app/categories/page.tsx`·`app/reviews/page.tsx` 무접촉**(본보기 둘). ⓔ **`AdminShell.tsx`·
  `NAV_ITEMS`의 `roles` 셋 무접촉**(내비 감춤 ≠ 컨트롤 감춤 — R-4의 판정 그대로).
  ⓕ **`src/components/ProductLinkBulkReplace.tsx` 무접촉**(그 패널이 서는 조건 `role === "admin"`은
  이미 옳다). ⓖ **필터·검색 입력칸 무변경**(⚠️ 조회용 입력은 `analyst`의 일이다 — `readOnly`가
  가는 자리는 **폼 컴포넌트 안**뿐이라는 사실이 이 트랙의 경계다). ⓗ **서버 0건**(가드·데코레이터·
  403 문장). ⓘ DNC-018 · DNC-011(고지 문구 화면의 읽기는 그대로 열려 있다).

### 4. **어드민 전송 계층의 세 수치가 서로 다른 단위로 세어진다 — 오늘 우연히 맞다 (R-6 P-3, 채택)** — 어드민·계약 — S

- **근거**: 한 단언 안에서 두 단위가 섞인다. `apps/admin/src/lib/admin-api.test.ts:672-688`:
  ```
  const writeCalls      = [...source.matchAll(/method: "(?:POST|PUT|PATCH|DELETE)"/g)];   // 호출부
  const retrySafeCalls  = [...source.matchAll(/\{ retrySafe: true \}/g)];                 // 호출부
  const idempotentCallers = [...source.matchAll(/^export function \w+\([^)]*idempotencyKey\?: string\)/gm)]; // 시그니처
  expect(writeCalls.length - retrySafeCalls.length - idempotentCallers.length).toBe(10);
  ```
  ⚠️ **앞 둘은 파일 전체의 호출부를 세고, 셋째는 함수 시그니처를 센다.** 그 뺄셈이 참인 것은
  *"함수 하나가 `request()`를 정확히 한 번 부른다"* 는 **적히지 않은 가정** 덕분이다.
- **오늘 그 가정은 참이다**(2026-08-30 실측): `admin-api.ts` **1,383줄**을
  `\nexport (async )?function`으로 갈라 세면 쓰기 호출 **24**가 **함수 24개에 하나씩** 있고,
  `export` 밖(파일 머리)의 쓰기 호출은 **0건**, 한 함수에 둘 이상인 자리는 **0건**,
  `retrySafe`가 둘 붙은 자리도 **0건**이다. ⚠️ **그래서 오늘은 아무도 이 가정을 볼 수 없다.**
- **어긋나는 날의 모양**: ⓐ 한 함수가 `request()`를 **두 번** 부르면(예: 생성 후 즉시 재조회,
  혹은 조건부 PATCH/DELETE) `writeCalls`만 늘어 **"비멱등 쓰기"가 하나 늘어난 것처럼** 보인다.
  ⓑ 멱등키를 **인자로 받지 않고 안에서 만드는** 함수가 생기면 `idempotentCallers`가 놓치고 그
  함수는 비멱등으로 세어진다. ⓒ 반대로 `idempotencyKey?: string`을 받되 `request()`에 **넘기지 않는**
  함수는 멱등으로 세어진다. **셋 다 어느 단언도 깨지 않는다** — R-2가 "메서드로 유추하면 다음
  라운드의 새 POST가 조용히 한쪽에 떨어진다"고 적어 `retrySafe`를 **명시 플래그**로 만든 그
  판단의, 검증 쪽 쌍둥이다.
- **본보기는 같은 워크스페이스에 이미 있다**: `src/admin-write-role-gate.test.ts:198-213`의
  `adminApiWriteFunctions()`가 **정확히 그 함수 단위 파싱**을 한다(`\nexport (?:async )?function` 분할 →
  본문에서 메서드 리터럴 탐색 → 합성 함수 한 겹까지 승계). R-6 P-3이 *"그때 이미 쓰는 그 분할이
  본보기다"* 라고 지목한 자리다.
- **실패 시나리오**(오늘이 아니라 다음 라운드의 어느 날): 누군가 `bulkApplyProductLinks`에
  "적용 후 목록 재조회"를 한 함수 안에 합친다. `writeCalls`가 25가 되고 뺄셈은 11이 된다 —
  테스트는 **숫자만 고치면 초록**이다. 그 순간 *"멱등키 없는 진짜 쓰기 열"* 이라는 문장은
  실제 자리를 가리키지 않게 되고, **연결 실패·타임아웃의 문장 선택이 옳은지 묻는 유일한 수치가
  뜻을 잃는다**(R-2의 본체가 그 수치다).
- **최소안**: **세 수치를 한 단위로. 소스 변경 0건 · 문장 0건 · 수치 불변.**
  ⓐ **함수 단위로 센다** — `\nexport (?:async )?function` 분할로 함수 표를 만들고, 각 함수마다
  `{ writeCalls, retrySafe, idempotencyKeyParam, idempotencyKeyForwarded }` 넷을 읽는다.
  분류는 그 표에서 **파생**한다(retrySafe / 멱등 / 비멱등 쓰기).
  ⓑ **가정을 단언으로 승격** — ⚠️ **쓰기 함수 전수가 `request()`를 정확히 한 번 부를 것**.
  오늘 참인 사실이 **다음 라운드에 소리를 내게** 하는 것이 이 트랙의 본체다(어겨도 되는 날이
  오면 그때 분류 규칙을 다시 정하면 된다 — 지금 필요한 것은 **조용하지 않은 것**이다).
  ⓒ **멱등키가 실제로 실려 나가는지도 본다** — 시그니처에 받고 `request()`에 넘기지 않는 함수가
  **0건**일 것(오늘의 값).
  ⓓ **수치 셋(24·8·6·10)과 이름 목록(멱등 여섯 · retrySafe 여덟 · 진짜 쓰기 여섯의 부정 단언)은
  바이트 불변**이다 — 세는 방법만 바뀌고 **답이 같다는 것**이 이 트랙의 안전망이다.
- **설계 긴장**: 여섯이다. ⓐ ⚠️ **`src/lib/admin-api.ts` 무접촉**(제품 소스 0건 — 이 트랙은 **세는
  방법**만 고친다). ⓑ **타임아웃 갈래 셋·연결 실패 갈래 셋·`CONNECTION_FAILURE_CODE`·상한 두 값에
  대한 기존 단언 전부 무변경**(R-2가 세운 계약). ⓒ **`src/admin-write-role-gate.test.ts` 무접촉**
  (트랙 C 소유 — `adminApiWriteFunctions()`는 **읽어서 본보기로 삼을 뿐** 옮기지 않는다.
  ⚠️ 공용 모듈로 추출하면 두 트랙이 같은 파일을 열게 되므로 **이번 라운드는 사본 하나를 허용**하고,
  그 판단과 사유를 주석에 값으로 남긴다). ⓓ **`write-error-copy.ts`·`load-error-copy.ts` 무접촉.**
  ⓔ **서버 0건.** ⓕ 마이그레이션 0건.

### 5. **`indexOf` 끝점 위험은 일반형이었다 — 부정 단언 74자리가 가드 없이 서 있고, 열하나는 바늘이 인자 모양이다 (R-1 리뷰 M-3 후속, 채택)** — 저장소 전역·계약 건강 — M

- **근거**: R-1 리뷰 M-3이 한 자리에서 잡은 그 모양을 저장소 전체에서 세어 봤다
  (2026-08-30 실측 · `apps/mobile/src` + `apps/admin/src` + `packages`의 `*.test.ts(x)` 전수 ·
  판정: `const X = <소스>.slice(<indexOf …>)` 뒤에 `expect(X).not.toContain/toMatch`가 서고,
  그 앞 1,500자 안에 인덱스에 대한 `toBeGreaterThan` 가드가 없는 자리).
  - **그 모양의 자리: 76. 그중 시작·끝점의 실재를 먼저 확인하는 자리: 2.**
    나머지 **74**(파일 **41**)는 가드가 없다. ⚠️ **이 수치는 정찰의 어림 스윕이 낸 값이고,
    트랙 E가 세우는 스윕이 최종 판정이다** — 두 값이 다르면 **스윕 쪽이 옳다**(그것이 이 트랙이
    수치를 대장으로 옮기는 이유다).
  - ⚠️ **두 실패 방향이 다르다.** 끝점이 `-1`이면 구간이 **파일 끝까지 넓어지고**(M-3이 만난
    그 경우 — 답이 우연히 맞아 초록이었다), **시작점이 `-1`이면 구간이 빈 문자열이 되어
    부정 단언이 언제나 통과한다.** ⚠️ **뒤엣것이 더 조용하다** — 그물이 넓어지는 것은 언젠가
    빨개질 수 있지만, 빈 그물은 **영원히 초록**이다.
  - **바늘이 인자·시그니처 모양인 자리 열하나 / 파일 여덟**(가장 먼저 끊어지는 종류 — M-3이
    끊긴 이유와 **같다**):
    `expenses/failed-row-prefill.test.ts:471`·`:552`·`:613`(⚠️ **`"onError: (error) => {"`** —
    M-3이 고친 그 문자열의 형제다. 인자 이름을 `err`로 바꾸는 리팩터 한 번에 끊긴다) ·
    `items/item-expense-roundtrip-wiring.test.ts:159` · `items/item-trust-notes.test.ts:102` ·
    `home/home-section-priority.test.ts:27`·`:330` · `family/household-scope.test.ts:654` ·
    `family/record-permissions.test.ts:322` · `import/import-resume.test.ts:378` ·
    `reports/share-flow.test.ts:51`.
  - ⚠️⚠️ **그리고 이 위험이 이미 제품 소스의 배치를 바꿨다.**
    `app/items/[itemTemplateId].tsx:590-602`의 주석은 `clickLink` 뮤테이션 블록을 옮긴 이유를
    *"다른 파일의 소스 계약이 끝점을 잃기 때문"* 이라고 적는다. **소스 스캔 계약이 제품 코드의
    줄 순서를 정한 첫 자리**이고, 그 사유는 **오늘 이미 낡았다**(M-3이 끝점을 접두로 바꿨다).
- **실패 시나리오**: 누군가 `app/expenses/[expenseId].tsx`의 `onError: (error) => {`를
  `onError: (err) => {`로 바꾼다(린트 규칙 하나면 저장소 전체에서 일어날 수 있는 일이다).
  `failed-row-prefill.test.ts:613`의 시작점이 `-1`이 되고 구간은 **빈 문자열**이 된다.
  *"실패 분기는 …하지 않는다"* 는 단언 셋이 **아무것도 검사하지 않은 채 초록**이 되고,
  그 뒤로 누가 그 분기에 무엇을 넣어도 **아무도 모른다.** 저장소는 그 계약이 살아 있다고 믿는다.
- **최소안**: **끊어질 자리를 먼저 막고, 나머지는 세어서 얼린다. 제품 소스 0건.**
  ⓐ **열한 자리에 실재 확인** — 시작·끝 두 인덱스에 `toBeGreaterThan(-1)`(끝점은
  `toBeGreaterThan(시작)`)을 세우고, 바늘은 **인자 모양에 매이지 않는 접두**로 바꾼다.
  ⚠️ **R-1 리뷰 M-3이 이미 쓴 그 형식 그대로**(`purchase-followup-flow.test.ts:67-70`) — **새 형식
  0건**이고, 각 단언의 **검사 대상과 결과는 바이트 불변**이다(가드는 실패를 **드러내는** 것이지
  판정을 바꾸는 것이 아니다).
  ⓑ **나머지를 대장에 얼린다** — `packages/test-utils`에 스윕 하나를 세워
  **파일별 미가드 자리 수**를 값으로 적고 **비증가(래칫)** 를 단언한다. 정찰의 어림값은
  **74 / 41파일 → ⓐ 이후 63 / 38파일**이고, ⚠️ **대장에 적히는 것은 스윕 자신이 센 값**이다.
  ⚠️ **줄 번호로 적지 않는다**(그 파일을 여는 모든 트랙이 대장을 건드리게 된다) — 단위는
  **파일 → 개수**다.
  ⓒ **새 자리를 금지한다** — 대장에 없는 파일에서 이 모양이 새로 나면 빨개진다.
  ⓓ **`clickLink` 블록은 되돌리지 않는다**(⚠️ **카드 4의 판단**): 되돌리면 **동작 0건 변경에
  줄 이동만 한 번 더** 생기고, 옮긴 자리는 읽는 순서로도 옳다(헬퍼 뒤에 소비자). 다만
  **그 주석의 사유는 고쳐 적는다** — 오늘 그 자리를 지키는 것은 사라진 끝점이 아니라
  *"등록이 전부 이 뮤테이션 앞에 있다"* 는 사실이다. ⚠️ **이 한 줄은 트랙 A도 E도 아닌
  제품 소스**이므로, **이번 라운드는 손대지 않고 F가 판정으로만 남긴다**(그 파일을 여는 다음
  라운드의 몫이다 — 사유가 낡았다는 사실이 값이다).
- **설계 긴장**: 일곱이다. ⓐ ⚠️ **제품 소스 0건**(`apps/*/app/**`·`apps/*/src/**`의 비테스트 파일
  전부 무접촉 — `app/items/[itemTemplateId].tsx` 포함). ⓑ **각 단언의 판정·기대값 바이트 불변**
  (가드만 는다 — 이 트랙이 무언가를 빨갛게 만든다면 그것은 **이미 끊겨 있던 자리**다).
  ⓒ **테스트 건수 변화를 값으로 적는다**(가드가 `expect`를 늘리므로 F의 재실측에 영향이 있다 —
  ⚠️ 그 수치는 사람이 재는 유일한 수치다). ⓓ **`packages/test-utils`의 기존 다섯 계약 무접촉**
  (`OWNED_DOCS`·읽기 전용 가드·§0 파싱 — 신설 파일 하나다). ⓔ **트랙 A가 여는 두 파일
  (`src/api/api-error.test.ts` · `src/onboarding/local-progress.test.ts`) 무접촉** — 대장의 그 두 줄은
  **A 머지 뒤의 값**으로 적는다(머지 순서 참고). ⓕ **공용 헬퍼(`sliceBetween`)는 만들지 않는다** —
  50파일 마이그레이션은 이 라운드의 축이 아니고, 헬퍼를 먼저 만들면 쓰는 자리가 12뿐인 모듈이
  선다(다음 라운드의 결정으로 남긴다). ⓖ 서버 0건 · 마이그레이션 0건.

## P3

- **`"시도해 주세요"` vs `"시도해주세요"` — 재실측했고 이번 라운드도 통일하지 않는다.**
  2026-08-30 실측(주석·테스트 제외, `app/**`+`src/**`): 값이 R-6의 **30건 / 파일 열여덟** ·
  **10건 / 파일 셋**에서 **변하지 않았다.** 기각 사유도 그대로다(둘 다 어법상 허용 · 거짓이 아님 ·
  어느 트랙의 축도 아님). ⚠️ **다만 이번 라운드도 그 대가를 치를 자리가 하나 있다** — 트랙 A가
  표에 세 줄을 더하는데, **셋 다 기존 문장(폼 상수·서버 원문)에서 오므로 이번에도 방언은 늘지
  않는다.** 그 사실이 R-1 규율이 두 라운드 연속 지켜졌다는 증거다.
- **`withdrawn_at` 컬럼 — 보류 유지(마이그레이션 0건 원칙).** 라운드 75 P-1 → 76 Q-4 → 77 R-6이
  남긴 구조 그대로다. ⚠️ **이번 라운드의 어느 트랙도 `apps/api/src/auth/**`·`users` 테이블·
  파기 잡을 열지 않는다**(트랙 B가 여는 것은 `worker/jobs/scheduled-publish.job.ts` 하나이고,
  파기 잡은 **읽기 전용 본보기**다). **컬럼 신설은 여전히 별도 결정이다.**
- **L-1의 큰 질문(여정 파일 목록의 완전성) — 이번 라운드가 절반을 답한다.**
  실측: 저장소에서 여정 단위의 서버 파일 목록을 가진 것은 오늘도 **하나**
  (`IMPORT_JOURNEY_SERVER_FILES` — 셋)이고, 아웃박스 스윕(`outboxPathFiles` — 넷)은 여정이 아니라
  **큐의 단위**다. ⚠️ **트랙 A가 두 번째 목록을 세운다**(아이 프로필 여정 — 둘). 그래서 이번
  라운드가 얻는 것은 목록 자체가 아니라 **목록이 필요한지 묻는 기준**이다:
  *"그 여정의 화면이 서버 코드를 읽는 경로를 갖고 있는가"* — 갖고 있는데 스윕이 없으면
  표가 자라도 그 여정만 조용하고(A의 ⓒ), 경로가 아예 없으면 목록보다 **경로가 먼저**다(A의 ⓑ).
  **남은 여정 넷**(가족·동기화/오프라인·설정/파기·인증)은 이번에도 목록을 신설하지 않는다 —
  ⚠️ **그중 가족 여정은 이미 전용 모듈 셋**(`invite-permissions.ts`·`member-mutation-messages.ts`·
  `invite-accept-messages.ts`)**이 코드를 읽고 있어** 다음 라운드가 물어야 할 질문이 다르다
  (*"목록이 없다"* 가 아니라 *"세 모듈이 같은 표를 같은 순서로 읽는가"*).
- **준비템 탭의 비가상화 렌더 — N-4의 문턱 아래다(재실측, 넘지 않았다).**
  카탈로그 `active: true` **120**(준비템 62 + 링크 58)이라 한 밴드의 표시 행은 **62 미만**이고,
  다시 볼 트리거(**카탈로그 200건** 또는 **한 밴드 100행**)는 **발동하지 않았다.**
  ⚠️ N-4의 기각 조건(*"새 실측이 먼저 있어야 한다"*)을 지켜 **재었고 넘지 않았다**고 적는다.
- **CSV 왕복의 다섯 열 손실 — 기각(범위 밖 · 이번 라운드에 상태 변화 없음).**
  구분·카테고리·판매처·결제수단·출처는 재가져오기에서 버려지고, 그중 **구분이 사라지면 선물·환불
  행이 지출로 되돌아온다**(DNC-015가 합계에서 빼는 행이 합계에 들어온다). ⚠️ **되살리려면
  `import_rows`에 칸을 더하는 스키마 변경 + 확정 경로(`insertExpense`) 변경이 함께 필요하고,
  그 결정은 DNC-012(미리보기 승인 전 저장 금지)·DNC-015 판단이 선행**이다. 오늘 그 사실은
  **소스 주석과 왕복 테스트 양쪽에 값으로 고정돼 있어** 조용하지 않다
  (`src/export/expense-csv.ts:22-27` · `apps/api/test/mobile-export-csv-roundtrip.test.ts`).
  **마이그레이션 0건 원칙 밖이므로 별도 결정으로 남긴다.**
- **`refund` 구분이 서버에서 만들어질 수 없다는 사실 — 결함 아님(전수 확인).**
  실측: 생성·수정 DTO가 `expense|gift`만 받고(`packages/contracts/src/schemas.ts:179`·`:231`),
  `apps/api/src`에서 `"refund"`를 쓰는 자리는 주석 하나다. 앱의 환불 처리 전량
  (배지 · `REFUND_BADGE_NOTICE` · 선물 체크박스 비활성 · `expenseTypeForWire` · `LocalExpenseKind` ·
  CSV 구분 열 · 반복/자동완성 제외)은 **이미 저장된 행을 잃지 않기 위한 보존 로직**이고
  허위 표시가 아니다. known-limitations가 REC-121/121b로 그 판단을 이미 적어 두었다
  (부호 계층 복원은 서버 `sumExpenses` 변경이 선행 — 별도 티켓). **다음 라운드가 다시 세지 않도록
  적어 둔다.**
- **`link_health`의 `errors` 카운터 — 결함 아님(후보 2와 대조).** 판정 실패는 잡을 중단시키지
  않지만 **대시보드가 그 수를 읽어** *"N건은 확인하지 못했어요"* 로 말한다
  (`worker-health-view.ts`의 `checkedCounts` — 라운드 44 N-9). ⚠️ **예약 게시와 정확히 반대**이고,
  그 대조가 후보 2의 근거다. **이 잡은 후보가 아니다.**
- **어드민 카탈로그 전량 조회 · known-limitations M-3 잔여 · `ApplicationPrimitives.tsx:151-153`의
  정규식 제목 판정 · 미출처 틴트 `#fdeee6` 둘 · `docs/5차/round55-plan.md:258`의 GFM 셀 수 ·
  라운드 74 C의 `"11/11"` 부정 스윕 · `itemMatchesBand`의 `timingLabel` 폴백 사문 ·
  `app/(tabs)/reports.tsx`의 임신 중 보장된 400 1건 · 첫돌 이후 마일스톤 고착 ·
  가져오기 확정 칸 1건 · `AuthService.refresh`가 `user.status`를 보지 않는다 ·
  api 테스트 하네스의 동시 실행 구멍 · 서버 중복 아이 가드 부재(M-1 · DNC-007) ·
  발행 `before` 경합 · `monthly_wrapup` 콜드 스타트 시점 · 크래시 파이프라인 부재 ·
  서버 stdout의 두 로그 형식(O-1)** — 라운드 62~77이 남긴 그대로이고 **상태 변화가 없다.**
- **`worker-jobs` ScheduledPublishJob 플레이크 · `storage: "ok"` 초기값 · `"무료배송"` ·
  알림 벨 🔔 — 무접촉 유지.** ⚠️ **다만 첫째는 트랙 B가 여는 파일과 같은 테스트 파일에 산다** —
  B가 그 파일을 여는 김에 플레이크가 재현되면 **관찰 기록만** 남기고 고치지 않는다
  (범위 밖 · api vitest는 이번 정찰이 돌리지 않았다).
- **제외 목록 준수 확인**: 준비템 목록 **가격 표시**(라운드 64 트랙 B — 사용자 결정 대기) ·
  오프라인 로컬 아이 복구 · 외부 계정/키/자산 · **C-3 잠금 오버레이 낭독**(실기기 필요 —
  오늘로 **열두 라운드 연속** 미확인, 표기만 갱신) · **P-2 법무 대조** ·
  **P-3 테스트 건수 자동화**(라운드 76 실측 기각 — 재론 없음) · **표기 방언**(기각 확정) ·
  **S-4 파기 `targetId`**(기각 확정) · 40주 초과 달력 · `onBudgetRelevantChange` ·
  4가구/`viewedHouseholdId`. **이번 라운드의 어느 트랙도 이 자리들을 열지 않는다.**

## 코드 건강 판정

- **⚠️ 가장 값진 관측: 라운드 77이 세운 다섯 판정이 전부 "한 칸 옆"에서 그대로 다시 성립한다.**
  R-1(표 밖의 코드) → 아이 프로필 여정 · R-3(버리는 것이 방패)의 반대 짝(**담아서 돌려주는데
  아무도 읽지 않는다**) → 예약 게시 잡 · R-4(역할 게이트) → 편집 컨트롤 · R-6 P-3(단위가 섞인
  수치) → 그대로 · M-3(끝점) → 74자리의 일반형. **판정을 세운 라운드는 그 판정이 성립하는
  자리를 전부 닫지 않는다** — 그것이 이월 목록이 매 라운드 다시 차는 이유이고, 이번 라운드가
  **다섯 중 다섯을 이월에서 꺼내 쓴** 이유다.
- **⚠️ 새 이름 하나: "담아서 돌려주는데 아무도 읽지 않는다."** R-3은 *버리는 것이 방패였다* 를
  이름 붙였다(사유를 버려서 거짓이 화면에 서지 않았다). 후보 2는 그 **거울상**이다 — 사유를
  버리지 않고 **정직하게 요약에 담아 돌려주는데**, 그 요약을 읽는 코드가 0건이라 결과가 같다.
  **버리는 것과 담아 두고 아무도 안 읽는 것은 관측 가능성에서 구별되지 않는다.**
  ⚠️ 구별되는 순간은 **고칠 때**다: 버린 자리는 나르는 배선을 만들어야 하고(트랙 C·라운드 77),
  담아 둔 자리는 **이미 있는 신호 경로에 연결만 하면 된다**(트랙 B가 어드민 0건인 이유).
  **다음 라운드는 "요약·반환값을 읽는 소비자가 0건인 자리"를 먼저 세어 볼 만하다.**
- **같은 저장소가 같은 물음에 이미 답해 둔 자리를 먼저 찾는 것이 이번에도 가장 값쌌다.**
  후보 1의 문장은 **같은 파일**(`child-form.ts`)에, 후보 2의 답은 **같은 폴더**
  (`data-retention-purge.job.ts`의 클래스 주석)에, 후보 3의 답은 **옆 탭**(`/categories`)에,
  후보 4의 본보기는 **옆 테스트 파일**(`admin-write-role-gate.test.ts`)에, 후보 5의 형식은
  **라운드 77 리뷰가 고친 그 자리**에 완성된 채 있었다. **다섯 후보 전부 새 한국어 문장 0건**이고,
  ⚠️ **이것은 라운드 77(하나 필요)보다도 낮다** — 저장소가 자기 답을 점점 더 많이 들고 있다는 신호다.
- **⚠️ 소스 스캔 계약이 제품 소스의 배치를 정한 첫 자리가 나왔고, 그 사유는 이미 낡았다.**
  `app/items/[itemTemplateId].tsx:590-602`. 스캔 계약은 **관찰**이어야 하고 **제약**이 되면
  꼬리가 몸통을 흔든다. 되돌리는 것은 이번 라운드의 값이 아니지만(후보 5 ⓓ), **그 사유가
  낡았다는 사실**은 다음에 그 파일을 여는 라운드의 입력이다.
- **이번 라운드의 계약도 전부 파생/부정/전수다.** 다섯 후보가 살아남은 이유가 같다 —
  *여정에 스윕이 없다* · *반환값을 읽는 소비자가 0건이다* · *편집 컨트롤을 세는 것이 없다* ·
  *수치의 단위가 섞여 있다* · *구간의 실재를 묻는 것이 없다*. 다섯 다 **어떤 단언도 깨지 않는
  사실**이다. 계약도 같은 모양으로 선다: 여정 코드 표 ↔ 서버 스윕(교집합) ·
  실패 요약 ↔ 잡 상태(파생) · 편집 컨트롤 ↔ 역할 게이트(전수) · 세 수치 ↔ 함수 표(파생) ·
  미가드 자리 수(비증가 래칫).
- **큰 파일 판정 유지.** 트랙이 여는 파일 중 1,000줄을 넘는 것은 **하나**
  (`apps/mobile/src/family/household-scope.test.ts` **1,078** — 트랙 E가 그 안의 **한 자리**에
  가드를 세운다)이고, 800 언저리가 셋이다(`src/api/api-error.test.ts` **817** ·
  `apps/api/test/worker-jobs.db.test.ts` **793** · `apps/admin/src/lib/admin-api.test.ts` **785**).
  ⚠️ **넷 다 테스트 파일이고, 제품 소스 중 가장 큰 것은 `apps/admin/app/links/page.tsx` 724**이며
  거기서 만지는 것은 **렌더 게이트 세 자리**다. 이번 라운드도 그 축을 팔지 않는다.
- **이월 정산.** 이월 여섯 중 **셋을 채택**(R-6 P-1 → 트랙 C · R-6 P-3 → 트랙 D ·
  R-1 일반형 → 트랙 E), **하나를 카드로 판정**(R-1의 `clickLink` 블록 — **되돌리지 않는다**,
  트랙 E ⓓ · F가 사유 갱신을 판정으로 남긴다), **하나를 보류 유지**(`withdrawn_at`),
  **L-1은 절반만 답한다**(두 번째 여정 목록이 서고, **목록이 필요한지 묻는 기준**이 생긴다).
  **N-4 트리거는 재었고 발동하지 않았다.** 자유 발굴로 **둘**을 더했고, 각각 이번 라운드가
  가중해 따라간 방향의 **온보딩·전환**(후보 1)과 **워커 침묵 실패**(후보 2)다.
  ⚠️ **세 번째 가중 방향(지출→리포트 데이터 정확성)은 전수로 재었고 후보가 0건이다** —
  그 사실과 여섯 자리의 근거를 선행 확인 4에 값으로 남긴다.

## 트랙 구성 (파일 단위 상호 배타)

- **A 아이 프로필 여정의 실패가 이유를 말한다** (#1) — **즉시 착수 가능 · 루프 진입**
  - 소유: `apps/mobile/src/api/api-error.ts`(⚠️ **표 세 줄**) ·
    `apps/mobile/src/api/api-error.test.ts`(⚠️ **두 번째 여정 스윕 + 제외 넷 + 코드당 문장 관측**) ·
    `apps/mobile/src/children/child-form.ts`(⚠️ **리터럴 → 상수 승격 한 자리, 문자열 바이트 불변**) ·
    `apps/mobile/src/children/child-form.test.ts` ·
    `apps/mobile/src/onboarding/step-ui.tsx`(⚠️ **갈래 하나 삽입**) ·
    `apps/mobile/src/onboarding/local-progress.test.ts`(⚠️ **그 모듈의 계약 — 오늘 이 파일이
    `onboardingSaveErrorMessage`를 무는 유일한 자리다**)
  - 읽기: `apps/api/src/onboarding/onboarding-core.service.ts`·`child-access.service.ts` ·
    `app/settings/children.tsx` · `src/offline/messages.ts`
  - 금지: **서버 0건** · ⚠️ **`src/offline/**` 전부 무접촉**(모듈 대장 셋 6·8·2 ·
    `OFFLINE_AWARE_SAVE_ERROR_SCREENS` 다섯 · 두 스윕) · `app/settings/children.tsx` **무접촉** ·
    `app/onboarding/**` **0건** · `src/family/**` **0건** · **기존 아웃박스 스윕의 파일 목록·
    제외 사유 바이트 불변** · **`computeDateError`의 판정·출력 바이트 불변** ·
    `CONSENT_REQUIRED`·403·오프라인·모르는 실패의 출력 **바이트 불변** ·
    ⚠️ **새 문장은 `"잠시 후 다시"`를 쓰지 않고 띄어 쓴 표기를 쓴다**(P3) · 마이그레이션 0건 ·
    DNC-018 · DNC-007
  - 계약: ⓐ **아이 프로필 여정 서버 파일이 던지는 4xx 코드 전수**가 표에 있거나 **이유가 적힌
    제외 목록**에 있을 것(제외 사유는 **그 스윕의 단위로만** — R-1 규율). ⓑ **파생 단언** —
    온보딩 모듈의 갈래가 넷일 것(전용 둘 → 오프라인 → 표 → 전용 폴백)이고, 표의 **아무 코드로나**
    그 문장이 실제로 서는 것을 재현할 것. ⓒ **부정 단언** — 새 세 문장 어느 쪽도 `"잠시 후 다시"`를
    담지 않을 것. ⓓ 표 세 줄의 **출처 서버 파일**을 값으로(유령 줄 금지 — 기존 `origins` 관례).
    ⓔ **관측** — 서버 코드 **95** 중 **열여덟**이 문장을 둘 이상 나르고, 표 안의 셋이 거기 속한다는
    사실과 오늘 앱이 부르는 갈래가 하나뿐이라는 사실.

- **B 예약 게시의 실패가 워커 상태에 도달한다** (#2) — **A와 완전 독립, 즉시 착수 가능**
  - 소유: `apps/api/src/worker/jobs/scheduled-publish.job.ts`(⚠️ **전량 처리 뒤 throw 한 자리**) ·
    `apps/api/test/worker-jobs.db.test.ts`
  - 읽기: `apps/api/src/worker/jobs/data-retention-purge.job.ts`(**본보기 — 읽기만**) ·
    `apps/api/src/worker/scheduler.service.ts`·`worker-status.service.ts` ·
    `apps/admin/src/lib/worker-health-view.ts`
  - 금지: ⚠️ **`content-revisions.service.ts` 무접촉**(발행·보상·CAS·크래시 복구·감사 로그·
    `SYSTEM_WORKER_ACTOR`·`STALE_PUBLISHING_THRESHOLD_MS` 전부) · **`scheduler.service.ts`·
    `worker-status.service.ts` 무접촉**(잡별 try/catch · 로그 형식 · 임계치 3 · `sanitizeSummary` ·
    `stale` 계산) · **다른 여섯 잡 무접촉**(특히 파기 잡) · **`apps/admin/**` 0건** ·
    **`/health/worker` 응답 스키마 무변경**(새 필드 0건) · **환경변수 0건** · 마이그레이션 0건 ·
    **한국어 화면 문구 0건**
  - 계약: ⓐ **부정 단언** — 실패 0건인 틱은 **던지지 않고** 요약이 종전과 같을 것.
    ⓑ **격리 불변** — 실패가 있어도 **due 초안 전수가 시도되고 보상까지 끝난 뒤** 던질 것
    (한 초안이 나머지를 막지 않는다). ⓒ `recovered`만으로는 던지지 않을 것(복구는 성공이다).
    ⓓ **파생 단언** — 연속 실패가 임계치에 닿으면 `WorkerStatusService.snapshot()`의 `degraded`가
    참이고 그 잡 이름이 `failingJobNames`에 실릴 것(⚠️ **어드민 파일을 열지 않고** 그 경로가
    산다는 것을 서버 쪽에서 못 박는다). ⓔ 실패 틱의 `lastSummary`가 `{}`가 된다는 **대가**를
    값으로 적을 것(파기 잡이 이미 치른 대가라는 사실과 함께).

- **C 통하지 않는 편집 UI를 세우지 않는다** (#3) — **A·B와 독립**
  - 소유: `apps/admin/app/items/page.tsx` · `apps/admin/app/links/page.tsx` ·
    `apps/admin/app/disclosures/page.tsx`(⚠️ **생성 카드 게이트 · 폼 `readOnly` · 토글 라벨**) ·
    `apps/admin/src/admin-write-role-gate.test.ts`(⚠️ **대장에 `edits` 칸 + 전수 단언 하나**)
  - 읽기: `apps/admin/app/categories/page.tsx`(**본보기 — 읽기만**) ·
    `apps/api/src/admin/admin.controller.ts`의 `RequireAdminRoles`
  - 금지: ⚠️ **`isEditor` 갈래 바이트 불변**(검토 요청 문안 넷·성공 배너 둘·힌트 넷) ·
    ⚠️ **쓰기 catch 자리 수 2·2·2 불변**(`WRITE_ERROR_COPY_SITES` 총합 **열다섯** 무변경) ·
    `src/lib/admin-role-copy.ts` **무접촉**(상수 둘 · 파생 규칙 — 부르기만) ·
    `app/categories/page.tsx`·`app/reviews/page.tsx`·`app/users/page.tsx` **무접촉** ·
    `src/components/AdminShell.tsx`·`NAV_ITEMS`의 `roles` 셋 **무접촉** ·
    `src/components/ProductLinkBulkReplace.tsx` **무접촉** ·
    `src/lib/admin-api.ts`·`src/lib/admin-api.test.ts` **무접촉**(트랙 D) ·
    `src/lib/write-error-copy.ts`·`src/admin-write-error-copy.test.ts` **무접촉** ·
    ⚠️ **필터·검색 입력칸 무변경**(조회는 `analyst`의 일이다) · **표·읽기 렌더 무변경** ·
    **서버 0건** · **새 한국어 문장 0건 · 새 낱말 0건** · DNC-018
  - 계약: ⓐ **전수 단언** — 쓰기가 역할로 갈리는 다섯 화면에서 `canEdit`이 거짓일 때 렌더되는
    **편집 가능 컨트롤이 0건**일 것(라운드 77 리뷰 S-2가 세운 **갈래 위치 판정**을 그대로 쓴다 —
    부분 문자열이 아니라 최상위 삼항의 어느 갈래인지까지 읽는다).
    ⓑ **뒤집힌 소스가 실제로 빨개지는 것**을 재현 단언으로(S-2의 규율 — 강화가 침묵으로 되돌아가지
    않게). ⓒ `submits`·`allows`·`kind`·`SCREEN_NOTICE_CONSTANTS` **무변경**.
    ⓓ ⚠️ `<select>`에 `readOnly`가 없어 `disabled`로 갈리는 이유가 **주석에 값으로** 적힐 것
    (다음 라운드가 그 비대칭을 결함으로 읽지 않도록).

- **D 세 수치를 한 단위로 센다** (#4) — **A·B·C와 독립 · 가장 작다**
  - 소유: `apps/admin/src/lib/admin-api.test.ts`(⚠️ **세는 방법 한 자리**)
  - 읽기: `apps/admin/src/lib/admin-api.ts`(**읽기만**) ·
    `apps/admin/src/admin-write-role-gate.test.ts`의 `adminApiWriteFunctions()`(**본보기 — 읽기만**)
  - 금지: ⚠️ **제품 소스 0건**(`src/lib/admin-api.ts` 무접촉) ·
    ⚠️ **`src/admin-write-role-gate.test.ts` 무접촉**(트랙 C 소유 — 공용 모듈 추출 금지,
    **사본 하나를 허용하고 그 판단을 주석에** 적는다) ·
    **타임아웃 갈래 셋·연결 실패 갈래 셋·`CONNECTION_FAILURE_CODE`·상한 두 값의 기존 단언 무변경** ·
    **수치 넷(24·8·6·10)과 이름 목록 바이트 불변** · `write-error-copy.ts`·`load-error-copy.ts`
    **무접촉** · **서버 0건** · 마이그레이션 0건
  - 계약: ⓐ **파생 단언** — 세 분류가 **함수 표 하나**에서 파생될 것(호출부 세기와 시그니처 세기를
    섞지 않는다). ⓑ ⚠️ **가정의 승격** — 쓰기 함수 전수가 `request()`를 **정확히 한 번** 부를 것
    (오늘 참인 사실이 어긋나는 날 소리를 내게 한다). ⓒ 멱등키를 시그니처로 받고 `request()`에
    넘기지 않는 함수가 **0건**일 것. ⓓ **답이 종전과 같을 것**(24 = retrySafe 8 + 멱등 6 +
    비멱등 10) — 세는 방법만 바뀐다는 것이 이 트랙의 안전망이다.

- **E 잘라 낸 구간이 실재하는지 먼저 묻는다** (#5) — **A 머지 후**
  - 소유(모바일 테스트 여덟): `apps/mobile/src/expenses/failed-row-prefill.test.ts` ·
    `apps/mobile/src/items/item-expense-roundtrip-wiring.test.ts` ·
    `apps/mobile/src/items/item-trust-notes.test.ts` ·
    `apps/mobile/src/home/home-section-priority.test.ts` ·
    `apps/mobile/src/family/household-scope.test.ts` ·
    `apps/mobile/src/family/record-permissions.test.ts` ·
    `apps/mobile/src/import/import-resume.test.ts` · `apps/mobile/src/reports/share-flow.test.ts`
    (⚠️ **열한 자리에 가드 + 접두 끝점**) ·
    `packages/test-utils/src/source-contract-slice-guard.test.ts`(신설 — **파일별 수치 대장 + 래칫**)
  - 읽기: `apps/mobile/src/commerce/purchase-followup-flow.test.ts:62-71`(**형식의 본보기 — 읽기만**)
  - 금지: ⚠️ **제품 소스 0건**(`apps/*/app/**`·`apps/*/src/**`의 비테스트 파일 전부 —
    `app/items/[itemTemplateId].tsx` 포함) · ⚠️ **각 단언의 판정·기대값 바이트 불변**
    (가드만 는다) · **`src/api/api-error.test.ts`·`src/onboarding/local-progress.test.ts` 무접촉**
    (트랙 A 소유 — 대장의 그 두 줄은 **A 머지 뒤의 값**으로 적는다) ·
    `src/commerce/purchase-followup-flow.test.ts` **무접촉**(이미 고쳐져 있다) ·
    `packages/test-utils`의 기존 다섯 계약 **무접촉**(`OWNED_DOCS`·읽기 전용 가드·§0 파싱) ·
    ⚠️ **공용 헬퍼(`sliceBetween`) 신설 0건**(다음 라운드의 결정) ·
    **어드민·서버 테스트 무접촉**(오늘 그 워크스페이스의 자리는 트랙 C·D가 연다) ·
    서버 0건 · 마이그레이션 0건
  - 계약: ⓐ **열두 자리가 시작·끝의 실재를 먼저 물을 것**(형식은 M-3이 세운 그것 —
    `toBeGreaterThan(-1)` / `toBeGreaterThan(시작)`)이고 **바늘이 인자 모양이 아닐** 것.
    ⓑ **파일별 미가드 자리 수 대장**이 서고 **비증가**일 것(⚠️ 값은 **스윕 자신이 센 것** —
    정찰의 어림값 **63 / 38파일**과 다르면 스윕 쪽이 옳고, 그 차이도 값으로 적는다).
    ⓒ **대장에 없는 파일에 새 자리가 나면 빨개질** 것.
    ⓓ ⚠️ **시작점 `-1`이 빈 구간을 만들어 부정 단언이 언제나 통과한다**는 사실을 값으로
    (끝점 `-1`과 실패 방향이 다르고, **빈 그물이 더 조용하다**).

- **F 판정·접근성 표·확인의 표·출시 현황** — **A·B·C·D·E 머지 후**
  - 소유: `docs/operations/known-limitations.md` · `docs/qa/runtime-verification-required.md` ·
    `docs/qa/accessibility-offline-checklist.md` · `docs/5차/launch-readiness-status.md`
  - 금지: **제품 소스 0건** · `packages/test-utils/**` **무접촉**(§0 수치를 세는 계약은 라운드 75가
    세웠고 **트랙 E의 신설 파일도 F가 열지 않는다**) ·
    `packages/test-utils/src/repo-self-description.test.ts` **무접촉** ·
    `docs/store/**`·`infra/legal/**`·`README.md`·`AGENTS.md`·`CODEX_START_HERE.md` **무접촉** ·
    **행 삭제 0건 · 행 번호 불변**(#1~#123) · 각 행의 문장·기대 동작·근거 파일·부정 조건
    **바이트 불변** · **표면 값 재분류 0건** · K~R절의 **판정을 다시 쓰지 말 것**
    (R-6·L-1·N-4는 **갱신 한 줄**씩만)
  - 계약: ⓐ **known-limitations에 S절을 신설**하고 이번 라운드가 확정한 판정 다섯을 남길 것 —
    (1) **루프 진입 관문의 막다른 문장**(여정에 스윕이 없어 표가 자라도 조용했다는 사실 ·
    ⚠️ **표에 이미 있는 문장조차 온보딩 화면에는 구조적으로 설 수 없었다**는 사실 ·
    한 여정의 두 화면이 같은 실패를 정반대로 말하던 자리가 닫혔다는 사실),
    (2) **담아서 돌려주는데 아무도 읽지 않는다**(R-3의 거울상이라는 판정 · 파기 잡이 같은 병을
    자기 주석에 적고 이미 고쳐 두었다는 사실 · ⚠️ **격리와 가시성이 배타가 아니라는** 판정 ·
    실패 틱의 요약이 `{}`가 되는 대가),
    (3) **역할 게이트의 나머지 절반**(R-4가 감춘 것은 제출 컨트롤뿐이었고 편집 폼·토글은 남아
    있었다는 사실 · **빈 생성 폼에는 "값을 보는 것은 정당하다"가 적용되지 않는다**는 판정 ·
    `<select>`에 `readOnly`가 없어 두 속성으로 갈리는 이유),
    (4) **오늘 참이라 조용한 가정**(세 수치의 단위가 섞여 있었다는 사실 · 어긋나는 세 가지 모양 ·
    R-2가 `retrySafe`를 명시 플래그로 만든 판단의 검증 쪽 쌍둥이라는 사실),
    (5) **`indexOf` 끝점 위험의 일반형**(74 → 61이라는 수치 · ⚠️ **시작점 `-1`의 빈 구간이 끝점
    `-1`보다 조용하다**는 판정 · ⚠️ **소스 스캔 계약이 제품 소스의 배치를 정한 첫 자리와 그
    사유가 이미 낡았다**는 사실 — `clickLink` 블록은 되돌리지 않는다는 판정과 함께).
    ⓑ **R-6 갱신**: P-1·P-3은 **채택돼 닫혔고**(트랙 C·D), 표기 방언 수치는 **그대로**이며
    (30/18 · 10/3) 트랙 A의 세 줄이 그 수치를 **늘리지 않았다**는 사실.
    ⓒ **L-1 갱신 한 줄**: **두 번째 여정 목록**이 섰다는 사실과, **목록이 필요한지 묻는 기준**이
    생겼다는 사실, 남은 여정 넷 중 **가족 여정은 질문이 다르다**는 사실.
    ⓓ **N-4 갱신 한 줄**: 재었고 문턱 아래(카탈로그 **120**)라는 사실과 트리거 무변경.
    ⓔ **후보가 0건이었던 축을 값으로**: 지출→리포트 데이터 정확성 전수 실측(합계 술어 한 곳 ·
    기간 경계 한 곳 · 경계 입력 500 구멍 기막힘 · `refund` 생성 불가 · CSV 왕복 손실은 스키마
    결정) — **다음 라운드가 같은 스윕을 다시 돌리지 않도록.**
    ⓕ 접근성 표: 라운드 78분을 **A-19**로 세울 것(온보딩·전환 실패 문구 · 어드민 읽기 전용 폼의
    낭독 — ⚠️ `readOnly` 입력칸이 스크린리더에 어떻게 읽히는지가 **브라우저 확인 항목**이다).
    ⓖ **C-3은 오늘로 열두 라운드 연속 미확인**이라는 사실을 갱신.
    ⓗ `runtime-verification-required.md`에 라운드 78 신설분을 **#124~로 편입**하고 §0의 네 수·합계·
    §1-1 머리말 라운드 구간을 함께 갱신할 것(⚠️ 라운드 75 C의 계약이 그 값을 파싱으로 다시 세므로
    틀리면 `@wooriai/test-utils`가 먼저 빨개진다. 오늘의 값은 실기기 **110** · 브라우저 **8** ·
    서버 **4** · 작업 **1** · 합계 **123**이고 마지막 행 번호는 **#123**이다.
    ⚠️ **트랙 B의 항목은 `서버`이고 트랙 C의 항목은 `브라우저`다** — 폰이 필요 없다).
    ⓘ `launch-readiness-status.md`의 **테스트 건수 재실측**(라운드 77 값: api 817 · mobile 4,635 ·
    admin 510 · domain 131 · contracts 66 · test-utils 107 = **6,266**. ⚠️ **사람이 재는 유일한
    수치**이고, 이번 라운드는 **다섯 트랙 전부가 단언을 더한다** — 특히 트랙 E는 가드만으로도
    `expect`가 는다).

- **머지 순서**: **A·B·C·D는 서로 완전 독립**이고 즉시 병렬 가능하다 — A=모바일 여섯,
  B=api 둘, C=어드민 화면 셋 + 대장 하나, D=어드민 테스트 하나. **파일이 한 곳도 겹치지 않는다.**
  ⚠️ **C와 D는 같은 워크스페이스지만 층이 다르다**(C=`app/**`+`src/admin-write-role-gate.test.ts`,
  D=`src/lib/admin-api.test.ts`). ⚠️ **A와 E는 같은 워크스페이스지만 갈라져 있다**
  (A=`src/api/**`+`src/children/**`+`src/onboarding/**`, E=그 밖의 아홉 + `packages/test-utils`) —
  **E가 A의 두 파일을 열지 않는 것이 그 분리의 조건이다.**
  접점은 **읽기 방향으로만** 여섯이다: A가 `apps/api`의 아이 프로필 경로를, B가 파기 잡과
  스케줄러·상태 서비스를, C가 `/categories`와 `RequireAdminRoles`를, D가 `admin-api.ts`와
  옆 테스트의 파싱을, E가 `purchase-followup-flow.test.ts`의 형식을 **읽는다**.
  **A를 먼저 머지한다** — 이번 라운드에서 **핵심 루프에 들어오기 전 관문**이고, 사용자가 오늘
  실제로 막다른 문장을 읽는 유일한 자리다.
  그다음이 **E**(⚠️ **A → E** 순서를 권한다: E의 대장은 A가 소유한 두 파일
  (`src/api/api-error.test.ts` · `src/onboarding/local-progress.test.ts`)의 자리 수도 세는데,
  A가 그 파일에 새 `slice` 자리를 만들면 **A 뒤에 세야 한 번만 적는다.** 반대 순서여도 초록이지만
  대장을 두 번 고치게 된다).
  **B·C·D는 아무 때나**(가장 독립적이고, D는 가장 작다. ⚠️ **B는 api 테스트가 실 PostgreSQL을
  요구하므로**(`worker-jobs.db.test.ts`) 그 준비가 되는 시점에 맞춰 잡는 편이 낫다).
  **F는 마지막이고, 이번 F는 S절 다섯 판정 · R-6/L-1/N-4 갱신 세 줄 · 후보 0건 축의 값 ·
  A-19 · C-3 열두 라운드 표기 · #124~ 편입과 §0 재계산 · 테스트 건수 재실측이 본체다.**
