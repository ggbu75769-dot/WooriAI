# 라운드 76 정찰 노트 (GAP-076)

> master 33683ce(라운드 75 머지, PR #80) 기준. do-not-change.md(DNC-001~020)·known-limitations
> A~P절·gap-analysis 제외 판정·round55-plan §6 비범위표·round56~75-scout 완료분·round61-backlog
> 대조 완료. 아래는 전부 그 밖이거나, 라운드 75가 **다음 결정의 입력으로 지목해 둔** 자리다.
>
> **라운드 74가 축을 "앱이 남기는 기록"으로, 라운드 75가 "남의 이름으로 한 약속"으로 옮겼다.
> 이번 라운드는 축을 다시 안으로 — 그러나 문서가 아니라 **사람이 실제로 걷는 화면**으로
> 돌린다.** 여정 넷(핵심 루프 · 가입 첫 10분 · 월말 정리 · 가족 참여)을 화면 단위로 걸어
> 보고, 그 위에 이월 후보 다섯을 실측했다.
>
> 이번 라운드의 관측은 하나로 모인다 — **실패했을 때 앱이 이유를 아는데도 말하지 않는
> 자리가 둘 있고, 둘 다 그것을 세는 목록의 *바깥 한 칸*에 서 있었다.**
> ① 모바일: 저장 실패 문구의 오프라인 정직은 화면(`app/**`)에서 다 닫혔는데, **문장이 사는
> 곳은 모듈(`src/**`)이라** 그 층에는 목록이 없었다 — 가족 참여 여정의 **첫 단추**(초대 링크
> 만들기)가 그 사각에 서 있다(후보 1).
> ② 어드민: 조회 실패는 라운드 73~75가 열여섯 자리를 한 판정으로 묶었는데, **쓰기 실패에는
> 그 목록이 없다** — 아홉 자리가 서버가 보낸 한국어 사유를 통째로 버리고, 그중 **한 자리는
> 실패 원인을 단정해 거짓을 말한다**(후보 2).
>
> ⚠️ 그리고 라운드 75가 P-1에 값으로 남긴 관측성 손실이 오늘 확인됐다 — **어드민 로그인은
> 거절을 세는데(`admin.login_failed`), 앱 로그인은 세지 않는다**(후보 4).

## 선행 확인 여덟 (후보 아님)

1. **라운드 75의 여섯 트랙은 전부 머지돼 있다.** A=`household-runtime.service.ts:157`의
   `existing.status === "active"` 갈래, B=`packages/test-utils/src/data-retention-promise.test.ts`,
   C=`packages/test-utils/src/runtime-checklist-shape.test.ts` + `runtime-verification-required.md` §0,
   D=`load-error-copy.ts`의 `LOAD_ERROR_COPY_SITES` **열여섯** + `AdminShell.tsx:477`의 조회 한 벌,
   E=`apps/admin/src/admin-canonical-mirrors.test.ts`, F=known-limitations **P절**.
   **재제안 대상이 아니다.**
2. **라운드 75가 세운 수치는 오늘도 맞다**(실측): `runtime-verification-required.md` §0 =
   실기기 **106** · 브라우저 **3** · 서버 **4** · 작업 **1** · 합계 **114**(§1 12 + §1-1 102),
   마지막 행 번호 **#114**. `launch-readiness-status.md:20`의 테스트 건수도 합이 맞는다
   (802+4611+451+131+66+107 = **6,168**). **재제안하지 않는다.**
3. **DNC-009·010·011은 오늘도 배선돼 있다.** `src/items/link-marker.ts`가 마커·고지·공유 문장을
   한 자리에서 내고(`productLinkMarker:43` · `productLinksDisclosureText:212` ·
   `purchaseLinkShareMessage`), 추천 점수 모듈에서 `수수료`/`commission` grep은 **0건**이다.
   **이 축에 후보 없음.**
4. **시드 카탈로그는 라운드 75 이후로도 그대로다**(2026-08-30 실측): `seed-data.ts` 2,083줄 ·
   `active: true` **120**(준비템 62 + 링크 58) · 스폰서 **5** · 제휴 **19**. **상태 변화 없음.**
5. **모바일에 죽은 라우트가 0건이다**(이번 라운드 신규 스윕). `app/**`·`src/**`의 정적
   `router.push/replace("…")` 목적지를 전부 모아 라우트 파일과 대조했다 — 실재하지 않는 셋
   (`/faq`·`/support`·`/lock`)은 **부정 단언이 이미 금지**하고 있다
   (`src/settings/support-links.test.ts:219-220` · `src/security/app-lock-gate-contract.test.ts:52-53`).
   **후보 아님 — 다음 라운드가 같은 스윕을 다시 돌리지 않도록 적어 둔다.**
6. **하단 탭은 넷이다(DNC-003 위반 아님).** `app/(tabs)/`에 화면 파일이 다섯인데
   `_layout.tsx:79`가 `more`를 `href: null`로 내린다 — 탭바에 서는 것은 홈·기록·준비템·리포트
   넷뿐이다. **확인만.**
7. **구매 링크 → 구매 확인 카드 경로는 오프라인에서 유령 물음을 만들지 않는다.**
   `registerPurchaseFollowup`은 `Linking.openURL`이 성공한 뒤에만 불리고
   (`app/items/[itemTemplateId].tsx:530-532`), 그 앞의 `clickProductLink`가 서버 호출이라
   오프라인이면 `onError` 갈래로 갈라진다(`:549-552`). **결함이 아니다.**
8. **역할 게이트(DNC-008)의 쓰기 화면 스윕은 오늘도 전수다.**
   `src/family/record-permissions.test.ts:669`가 `app/**`의 `useMutation(` 화면을 훑어
   게이트를 지나거나 **이유가 적힌 목록**(`UNGATED_WITH_REASON`)에 있는지 본다.
   **이 축에 후보 없음.**

## 상위 후보

### 1. **가족 참여 여정의 첫 단추가 오프라인에 거짓말한다 — 그리고 그 문장은 스윕이 걷지 않는 층에 산다** — 모바일·여정 정직 — S

- **근거**: 셋이 한 줄로 이어져 있다.
  - ⓐ **문장.** `apps/mobile/src/family/invite-permissions.ts:46`:
    ```
    export const INVITE_CREATE_FAILED_MESSAGE = "초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
    ```
    `inviteCreateErrorMessage`(`:109-114`)는 403만 갈라내고(`INVITE_FORBIDDEN_MESSAGE`) 나머지는
    전부 이 문장이다. **`isOnline`을 받지 않는다** — 이 모듈에 `offline`·`OFFLINE` grep은 **0건**이다.
    화면은 `app/family/invite.tsx:202` 한 자리에서 그 값을 그대로 그린다.
  - ⓑ **형제 모듈은 이미 정직하다.** 같은 폴더의 `src/family/member-mutation-messages.ts:118-123`은
    `{ isOnline }`을 받아 `!isOnline`이면 `OFFLINE_RETRY_NOTICE`로 간다. 그 모듈을 쓰는 화면
    (`app/family/index.tsx`)은 조회 쪽도 배선돼 있다(`OFFLINE_AWARE_LOAD_ERROR_SCREENS`).
    ⚠️ **즉 가족 화면은 정직하고, 거기서 [초대 만들기]를 눌러 들어간 화면만 아니다.**
  - ⓒ ⚠️ **두 스윕 사이에 이 층이 없다.** 라운드 74 D가 세운 옛 리터럴 부정 단언 스윕은
    `appScreenPhraseCounts`(`src/offline/messages.test.ts:860-880`)가 **`join(mobileRoot, "app")`
    한 뿌리**를, 그것도 **`.tsx`만** 걷는다. 그리고 그 바늘은 `SAVE_ERROR_NOTICE`의 앞 문장
    (`"저장하지 못했어요"`)이라, `"초대 링크를 **만들지** 못했어요"`는 바늘 모양으로도 걸리지
    않는다. 라운드 75 선행 확인 6이 `src/**`를 재긴 했지만 그것은 **조회** 리터럴이었다
    (둘, 둘 다 이유 있음). **저장 쪽 `src/**`는 오늘까지 아무도 세지 않았다.**
  - **오늘 그 층에 무엇이 있는지 세어 봤다**(주석 제외, `src/**`의 `.ts`·`.tsx`, 바늘 셋 =
    `"불러오지 못했어요"` · `"저장하지 못했어요"` · `"잠시 후 다시"`): 걸린 것이 **열여섯**,
    그중 둘은 정의상 밖이다(`offline/messages.ts` = 문장의 단일 소스 · `offline/offline-aware-screens.ts`
    = 목록 자신). **판정이 필요한 모듈은 열넷**이고 갈래가 셋으로 갈린다.
    - **`isOnline`을 받는다(정직) — 다섯**: `settings/destructive-flow-messages.ts:198-206` ·
      `family/member-mutation-messages.ts:118-123` · `import/import-failure-messages.ts:196-207` ·
      `onboarding/step-ui.tsx:116-122` · `export/ExpenseCsvExport.tsx:382`(인라인 삼항).
    - **받지 않아도 되는 이유가 있다 — 여덟**: `expenses/save-error-messages.ts`(지출은 SQLite
      우선 저장이라 오프라인에서 **성공**한다 — 이 문장이 서는 것은 로컬 쓰기 실패뿐이다) ·
      `items/status-mutation-messages.ts`(아웃박스 큐에 들어간다) ·
      `security/app-lock.ts:334`(SecureStore 로컬 저장이라 네트워크가 등장하지 않는다) ·
      `errors/ErrorBoundary.tsx:49`(크래시 화면) ·
      `auth/kakao-login.ts`(카카오가 준 OAuth 오류 코드의 매핑이라 **연결이 있어야 도달한다**.
      연결이 없을 때의 문장은 `src/auth/login-copy.ts:93`이 이미 정직하게 낸다 — 아래 P3) ·
      `import/bulk-run.ts:217`(다른 클라이언트가 잡은 작업 — **실제로 기다리면 풀린다**) ·
      `children/household-join.ts:65`("잠시 후 다시"를 아예 말하지 않는 두 갈래 문장 —
      라운드 60 리뷰 P1-1) · `onboarding/selected-child-recovery.ts:93`(온라인 갈래이고 오프라인은
      `OFFLINE_RETRY_NOTICE`로 갈린다 — 라운드 75 선행 확인 6).
    - ⚠️ **받지 않고, 받지 않을 이유도 없다 — 하나**: **`family/invite-permissions.ts`.**
  - ⚠️ **바늘의 방언도 이 자리에서 재어야 했다.** 꼬리 바늘을 공용 상수에서 그대로 파생시키면
    (`"잠시 후 다시 시도해 주세요"`) `auth/kakao-login.ts`와 `export/ExpenseCsvExport.tsx`가
    **구조적으로 보이지 않는다** — 그 셋은 `"시도해주세요"`(붙여 씀)를 쓴다(P3). 그래서
    바늘은 **`"잠시 후 다시"`까지만** 잡아야 열넷이 다 걸린다. 파생 바늘이 **문장 전체**일 때
    한 글자 차이가 그물을 찢는다는 것이 오늘의 값이다.
  - **덤**: `app/family/invite.tsx`는 `OFFLINE_AWARE_SAVE_ERROR_SCREENS`(오늘 **넷**)에도
    `OFFLINE_AWARE_SAVE_ERROR_EXEMPT_SCREENS`(오늘 **0**)에도 없다 — **양쪽이 일치한 채
    통과한다.** 라운드 74 D가 `app/**`에서 닫은 그 모양이 **모듈 층으로 한 칸 옮겨** 그대로 있다.
- **실패 시나리오**: 엄마가 지하철에서 아빠를 가족에 부른다. 가족 화면은 이미 정직하게
  **"지금은 오프라인이에요…"** 라고 말하고 있다. 그런데 [가족 초대] → 역할 고르기 →
  [초대 링크 만들기]를 누르면 화면이 말한다 — **"초대 링크를 만들지 못했어요. 잠시 후 다시
  시도해 주세요."** 기다릴 대상이 없다. 30초 뒤 다시 누른다. 같은 문장. 세 번째에 포기하고
  앱을 닫는다. 그가 실제로 해야 할 일은 **지상으로 나가는 것**인데, 앱은 한 화면 전에 그
  사실을 알고 있었고 다음 화면에서 잊어버렸다. — 그리고 이 자리는 **가족 참여 여정의 첫
  단추**다: 여기서 멈춘 사람은 초대 수락 화면·역할·공동 기록을 **한 번도 보지 못한다.**
- **최소안**: **형제 모듈이 이미 지나온 그 관례를 그대로. 새 문구 0건.**
  ⓐ **모듈 한 겹** — `inviteCreateErrorMessage`가 `{ isOnline }`을 받아 **아는 코드(403) →
  오프라인 → 온라인 폴백** 순서로 답한다(`member-mutation-messages.ts:118-123`의 순서 그대로).
  ⚠️ **`INVITE_FORBIDDEN_MESSAGE`·`INVITE_CREATE_FAILED_MESSAGE` 두 문자열 바이트 불변.**
  ⓑ **화면 한 자리** — `app/family/invite.tsx:202`가 `useSaveErrorCopy(invite.isError, invite.error)`
  를 부르고, `=== OFFLINE_SAVE_NOTICE`일 때만 공용 문장으로 갈린다
  (`app/family/accept/[token].tsx`가 라운드 73 E에서 쓴 그 두 줄과 같은 모양 — 온라인 갈래
  바이트 불변). 목록은 **넷 → 다섯**.
  ⓒ **모듈 층의 대장을 만든다** — `src/offline/offline-aware-screens.ts`에 두 목록을 더한다:
  오프라인 판정을 받는 **모듈**과, 받지 않는 **모듈 + 이유**(위 근거의 **열넷**이 그 값이다).
  그리고 `messages.test.ts`의 스윕이 **`src/**`도 걷는다** — 바늘은 손으로 적지 않고
  `LOAD_ERROR_NOTICE`·`SAVE_ERROR_NOTICE`의 **앞 문장 둘 + 꼬리 조각**(`"잠시 후 다시"`)에서
  파생시킨다(앞 문장 바늘만으로는 `"만들지 못했어요"`를, 꼬리 **전체**로는 붙여 쓴 방언 셋을
  못 본다 — 위 근거의 마지막 문단). 정의상 밖인 둘(문장의 단일 소스 · 목록 자신)도 **값으로**
  적는다.
  ⚠️ **화면 쪽 스윕은 한 글자도 바뀌지 않는다**(`app/**` 목록·횟수 표 무변경 — 두 스윕이
  서로 다른 뿌리를 걷는다는 것이 값으로 남는다).
- **설계 긴장**: 여덟이다. ⓐ **온라인 갈래 바이트 불변**(문자열 둘·403 갈래·순서). ⓑ **서버 0건**
  (초대 생성 API·만료·해시 저장 무접촉). ⓒ **`app/family/index.tsx`·`accept/[token].tsx` 무접촉**
  (둘 다 이미 배선돼 있다 — 자리가 늘지도 줄지도 않는다). ⓓ **`member-mutation-messages.ts`
  무접촉**(본보기다). ⓔ **조회 쪽 목록 셋 무변경.** ⓕ **`src/auth/**`·`src/export/**` 문구 0건**
  (대장에 **이유만** 오른다 — 표기 방언은 P3). ⓖ **픽셀락 무접촉**(FAM-002는 캡처 아홉에 없다).
  ⓗ DNC-018 해요체.

### 2. **어드민의 쓰기 실패는 서버가 보낸 이유를 버린다 — 그리고 한 자리는 그 자리에 없는 원인을 단정한다** — 어드민·허위 표시 — M

- **근거**: 라운드 73 D → 75 D가 **조회** 쪽에 세운 판정 한 벌이 오늘 열여섯 자리를 묶고 있고
  (`src/lib/load-error-copy.ts:119` `LOAD_ERROR_COPY_SITES` · `:146` 면제 하나),
  그 파일 머리말이 스스로 경계를 적어 둔다 — *"쓰기 실패의 판정은 R19-F가 근거와 함께 세워
  뒀다(`WRITE_TIMEOUT_MESSAGE`) — **여기는 조회만이다**"*(`:23`). ⚠️ **그 문장이 옳았고, 그래서
  쓰기 쪽에는 오늘까지 목록이 없다.**
  - **어드민의 catch 자리를 전수로 세어 갈래를 냈다**(`app/**` + `src/components/**`, 2026-08-30):
    | 갈래 | 자리 | 오늘의 행동 |
    |---|---|---|
    | 조회(한 벌) | 16 | `loadErrorCopy`/`loadErrorMessage` — 서버 사유·재시도 가능 여부를 말한다 |
    | 쓰기(사유를 말한다) | 6 | `error instanceof AdminApiError ? error.message : 폴백` 손 사본 — `AdminShell.tsx:164`·`:252`·`:329`·`:354`·`:509` · `app/reviews/page.tsx:283` |
    | 쓰기(부분) | 4 | `app/users/page.tsx:41`의 지역 함수 `mutationErrorMessage`(코드 **둘**만 매핑) 세 자리 + `app/categories/page.tsx:128`(타임아웃만) |
    | 쓰기(**통째로 버린다**) | 9 | `app/reviews/page.tsx:229`·`:253`·`:306` · `app/items/page.tsx:454`·`:497` · `app/links/page.tsx:373`·`:439` · `app/disclosures/page.tsx:62`·`:162` |
  - ⚠️ **버리는 아홉 자리에는 `AdminApiError`·`isTimeoutError` grep이 0건이다**(세 파일 전수 —
    `items`·`links`·`disclosures`는 쓰기 catch에서 그 이름을 한 번도 부르지 않는다).
    그래서 **쓰기 타임아웃 문구까지 함께 사라진다**: `admin-api.ts:395`의 `WRITE_TIMEOUT_MESSAGE`
    (*"반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요"* — R19-F가
    **재시도를 권하지 않기 위해** 지은 문장)와 `:401`의 `IDEMPOTENT_WRITE_TIMEOUT_MESSAGE`가
    전부 폴백 한 문장으로 수렴한다. 폴백은 *"저장하지 못했어요. **입력값을 확인**하고 **다시
    시도**해 주세요."* — 타임아웃에서 **틀린 원인(입력값)** 을 지목하고 **금지된 행동(재시도)** 을
    권한다.
  - ⚠️⚠️ **그중 한 자리는 원인을 단정한다.** `app/reviews/page.tsx:229`(`handleApprove`의 catch):
    ```
    setActionError("승인 게시하지 못했어요. 본인이 작성한 초안은 승인할 수 없어요.");
    ```
    이 문장은 **모든 실패**에 선다 — 네트워크 끊김, 500, 60초 타임아웃, 이미 게시된 초안.
    운영자가 남이 쓴 초안을 승인하다 서버가 잠깐 죽어도 화면은 **"본인이 작성한 초안은 승인할
    수 없어요"** 라고 말한다. 사실이 아닌 원인이고, 운영자는 있지도 않은 문제를 고치려 든다.
  - ⚠️ **같은 파일이 30줄 아래에서 정답을 적어 두었다.** `app/reviews/page.tsx:282-286`
    (`handleSchedule`): *"// API가 이미 한국어 사용자 메시지를 내려줘요(과거 시각·본인 제출
    초안 등)."* → `error instanceof AdminApiError && error.message ? error.message : 폴백`.
    **한 화면 안에서 형제 넷 중 하나만 서버의 말을 듣는다.**
  - **되돌릴 수 없는 자리라는 것이 무게를 더한다.** 버리는 아홉 중 넷이 **멱등키를 실어
    보내는 쓰기**다(`approveKey.current(detail.id)` · `rollbackKey.current(revisionId)` —
    `app/reviews/page.tsx:220`·`:297`). 멱등키가 붙은 쓰기의 타임아웃 문구는 *"같은 요청을
    다시 보내면 중복 없이 처리돼요"* 인데(`admin-api.ts:401`), 그 사실을 아는 유일한 문장이
    화면에 닿지 못한다 — 안전하게 재시도할 수 있는 사람에게 **재시도하면 안 된다고 읽히는
    침묵**을 준다.
  - **오늘 이 자리를 무는 테스트는 0건이다**(전수: 어드민 테스트에서 그 아홉 문자열 grep 0건).
- **실패 시나리오**: 운영자가 제휴 고지 문구를 고친다(DNC-010이 잠근 그 문장이다). [저장]을
  누르고 60초를 기다린다. 서버는 이미 반영했지만 응답이 늦었다. 화면이 말한다 — **"저장하지
  못했어요. 다시 시도해 주세요."** 운영자는 다시 누른다. — 같은 주, 다른 운영자가 콘텐츠 검토
  화면에서 동료의 초안을 승인한다. API 서버가 재시작 중이다. 화면이 말한다 — **"승인 게시하지
  못했어요. 본인이 작성한 초안은 승인할 수 없어요."** 그는 자기가 그 초안을 쓴 적이 없다는
  것을 알기에 **어드민 계정 권한이 잘못됐다고 판단하고** 관리자에게 계정 문의를 넣는다.
  옆 화면(대시보드·준비템 목록·감사 로그 열여섯 자리)은 그 시각 전부 **왜 실패했는지와
  [다시 시도]가 통하는지를** 말하고 있다.
- **최소안**: **조회 쪽이 이미 가진 한 벌을 쓰기 쪽에 세운다. 새 판정 0건 · 새 한국어 문구 0건.**
  ⓐ **한 벌**(`apps/admin/src/lib/write-error-copy.ts`, 신설) — `writeErrorMessage(error, fallback)`:
  서버가 이유를 주면 그 문장, 아니면 **종전 폴백 그대로**. ⚠️ 판정을 새로 만들지 않는다
  (`AdminApiError`·`isTimeoutError`·`isRetryUnsafeTimeoutError`는 `admin-api.ts`가 이미 낸다 —
  **그 파일은 읽기만**). `load-error-copy.ts`와 **합치지 않는다**: 그 파일 머리말이 "여기는
  조회만"이라고 경계를 값으로 적어 뒀고, 쓰기의 재시도 판정은 조회와 **정반대**다(R19-F).
  ⓑ **대장 둘** — `WRITE_ERROR_COPY_SITES`(경로 → 자리 수)와 이유가 적힌 면제 목록. 스윕 범위는
  라운드 75 D가 정한 그 두 뿌리(`app/**` + `src/components/**`)이고 **`src/lib/**`가 밖인 이유도
  같은 값으로** 적는다.
  ⓒ **원인 단정 한 문장 정정** — `app/reviews/page.tsx:229`의 폴백에서 **"본인이 작성한 초안은
  승인할 수 없어요"를 뺀다**(서버가 그 이유를 알면 서버가 말한다). ⚠️ 이 한 자리만이 **문자열이
  바뀌는 자리**이고, 나머지 여덟은 폴백 문자열 **바이트 불변**이다.
  ⓓ **지역 함수를 공용으로** — `app/users/page.tsx:41`의 `mutationErrorMessage`가 매핑하는 코드
  둘(`ADMIN_SELF_UPDATE_FORBIDDEN`·`ADMIN_EMAIL_EXISTS`)은 **그 화면의 판정으로 남기고**, 그
  아래 폴백만 공용 한 벌을 지난다(문장 셋 바이트 불변).
  ⓔ **부정 단언** — 대장 밖에서 쓰기 catch가 폴백 문자열을 손으로 적으면 빨개진다(조회 쪽
  스윕과 같은 모양 · 라운드 74 D의 옛 리터럴 스윕과 같은 형식).
- **설계 긴장**: 아홉이다. ⓐ ⚠️ **`LOAD_ERROR_COPY_SITES`·면제 목록·`load-error-copy.ts` 무접촉**
  (열여섯은 라운드 75가 닫았다 — 자리가 늘지도 줄지도 않는다). ⓑ **`admin-api.ts` 무접촉**
  (`WRITE_TIMEOUT_MESSAGE`·`IDEMPOTENT_WRITE_TIMEOUT_MESSAGE`·타임아웃 상한·멱등키 홀더
  전부 읽기만 — 이 트랙은 그 문장을 **화면까지 나르기만** 한다). ⓒ **API 호출·멱등키 회전·
  성공 문구·목록 새로고침 무변경**(고쳐지는 것은 **실패했을 때 무엇이 보이는가**뿐).
  ⓓ **새 한국어 문구 0건**(문장은 전부 서버가 이미 내려보내는 것이거나 종전 폴백이다).
  ⓔ **폴백 바이트 불변 여덟 · 바뀌는 문장 하나**(위 ⓒ — 그 한 문장이 오늘 거짓을 말한다).
  ⓕ **서버 0건**(어떤 코드·메시지도 새로 만들지 않는다 — 트랙 E가 만드는 사유를 이 트랙이
  **나른다**). ⓖ **`app/audit-logs/page.tsx`·`src/lib/audit-log-filters.ts` 무접촉**(트랙 D 소유).
  ⓗ **`src/lib/admin-canonical-mirrors.test.ts` 무접촉**(새 상수 표를 만들지 않는다 — 대장은
  **자리 수**이지 값 미러가 아니다. 그 사실을 `NON_MIRROR_CONSTANT_TABLES`에 손으로 더하지
  않아도 되도록, 대장은 `Record<string, number>` 꼴로 조회 쪽과 같게 짓는다). ⓘ DNC-018.

### 3. **여정 스윕이 그 여정의 컨트롤러를 빠뜨린다 (L-1 잔여, 채택)** — 계약 — S

- **근거**: 라운드 75 정찰이 실측해 known-limitations **L-1 갱신 블록**에 값으로 남긴 그 자리다.
  오늘 다시 재도 같다.
  - `apps/mobile/src/import/import-failure-messages.test.ts:43`의 `IMPORT_JOURNEY_SERVER_FILES`는
    서버 파일 **둘**을 손으로 든다(`imports/import-parser.ts` · `onboarding/import-pipeline.service.ts`).
  - **그 여정에는 셋째 파일이 있다.** `apps/api/src/imports/imports.controller.ts:101`이
    `FileInterceptor`의 `fileFilter`에서 `code: "IMPORT_FILE_TYPE_INVALID"`를 던진다 —
    **mimetype 화이트리스트 1차 관문**이라 업로드 여정에서 가장 먼저 만나는 거절이다.
  - **오늘 사용자에게는 아무 일도 일어나지 않는다**: 그 코드는 라운드 45 UX-Z가 앱 전역 표에
    세워 뒀고(`src/api/api-error.ts:223`), 이 스윕의 제외 목록에도 이유와 함께 있다.
  - ⚠️ **위험한 것은 다음이다.** 그 컨트롤러에 새 코드가 하나 들어오면 스윕은 **초록인 채로**
    그것을 놓친다 — 목록이 파일 단위라 목록 밖 파일은 구조적으로 보이지 않는다(라운드 74 O-4가
    이름 붙인 그 모양이 **파일 목록 층**에서 다시 난 것이다).
  - **그런데 이번엔 답이 값싸다.** L-1이 남긴 큰 질문("여정 목록을 만들지, 발견할 때마다
    세울지")은 여전히 비싸지만, **여정 파일 목록이 그 여정의 컨트롤러를 빠뜨렸는지**는 파생으로
    물을 수 있다: `apps/api/src/**/*.controller.ts` **서른둘**(실측)을 훑어, **여정 파일에서
    무언가를 import하는 컨트롤러**를 뽑으면 오늘 답은 **정확히 하나**다
    (`imports/imports.controller.ts` — `import-pipeline.service`에서 `ImportPipelineService`·
    `IMPORT_MAX_FILE_SIZE_BYTES`를 든다). 그 파생 집합이 목록에 없으면 빨개진다.
- **실패 시나리오**: 다음 라운드가 업로드 관문에 코드를 하나 더한다(예: 빈 파일 거절
  `IMPORT_FILE_EMPTY`). 컨트롤러에서 던지므로 스윕은 **여전히 초록**이다. 사용자는 파일을
  올리고 `importFailureMessage`의 일반 폴백 — **"업로드하지 못했어요. 잠시 후 다시 시도해
  주세요."** — 을 받는다. 다시 올린다. 같은 문장. 파일이 비어 있다는 사실은 서버만 알고
  아무도 말하지 않는다. 라운드 71 A가 이 여정에 문장을 준 이유가 정확히 그것이었다.
- **최소안**: **목록을 파생시킨다. 문구·표·서버 0건.**
  ⓐ **파생 단언** — 컨트롤러 트리를 훑어 여정 파일을 import하는 컨트롤러를 뽑고, 그 집합이
  `IMPORT_JOURNEY_SERVER_FILES`에 **포함**될 것(아니면 **이유가 적힌 제외 목록**에).
  ⓑ **목록은 셋이 된다** — `imports/imports.controller.ts` 편입. 오늘 그 파일이 던지는 코드는
  하나이고 이미 제외 목록에 이유가 있으므로 **다른 단언은 그대로 초록**이다(스윕 하한 ≥10도
  그대로 — 새 코드가 늘지 않는다).
  ⓒ **하한 단언 한 겹** — 컨트롤러 스캔이 조용히 0건이 되지 않도록 "훑은 컨트롤러 ≥ 30"을
  앞에 세운다(정규식이 죽으면 이 계약도 함께 죽는다 — 이 파일이 이미 쓰는 그 관례).
- **설계 긴장**: 여섯이다. ⓐ **`import-failure-messages.ts` 무접촉**(표·문구·판정 0건 —
  이 트랙은 **테스트 한 파일**이다). ⓑ **서버 0건**(`imports.controller.ts`는 읽기만).
  ⓒ **제외 목록의 기존 셋 무변경**(`IMPORT_TOO_MANY_ROWS`·`IMPORT_FILE_TYPE_INVALID`·
  `IMPORT_FILE_TOO_LARGE`의 이유 문장 바이트 불변). ⓓ **형제 스윕 무접촉**
  (`src/settings/destructive-flow-messages.test.ts`는 단위가 **메서드**다 — 컨트롤러 파생이
  그 단위에 맞지 않는다는 사실을 **주석 한 줄로** 남긴다). ⓔ **`api-error.test.ts`의 아웃박스
  교집합 계약 무접촉**(단위가 다르다). ⓕ **여정 목록 신설 0건**(L-1의 큰 질문은 여전히 열려
  있다 — 이 트랙은 **중간 크기 답 하나**만 낸다).

### 4. **거절된 로그인은 아무 흔적도 남기지 않는다 — 어드민은 그 흔적을 세는데 (P-1 잔여, 채택)** — 관측성·감사 — S

- **근거**: 라운드 75 적대적 리뷰 S-7이 P-1에 값으로 남긴 그 사실이 오늘도 그대로다.
  - **거절은 감사 로그 앞에서 난다.** `apps/api/src/auth/kakao/kakao-auth.service.ts:159`·`:162`가
    `USER_BLOCKED`·`USER_WITHDRAWN` 403을 던지고, `auth.login` 기록은 **그 뒤**(`:169-175`)에만
    선다. 라운드 75 A가 `users` 행 쓰기를 막은 뒤로, 차단·탈퇴 계정의 로그인 시도는
    **조회 가능한 흔적을 아무것도** 남기지 않는다.
  - ⚠️ **어드민 쪽에는 그 흔적이 있다.** 서버가 오늘 기록하는 감사 액션을 전수로 세면
    (`apps/api/src/**`의 `action: "…"` 전수) **`admin.login_failed` · `admin.mfa_login_failed` ·
    `admin.password_change_failed`** 셋이 실패를 센다. 앱 로그인에는 대응하는 액션이 **0건**이다.
    **같은 저장소가 운영자의 실패는 세고 이용자의 거절은 세지 않는다.**
  - **쓸 자리는 열려 있다.** `audit_logs`는 `users`에 FK가 없고(`schema.prisma:736-755` —
    라운드 000002가 뗐다), 파기 잡 phase 3이 탈퇴 계정의 감사 로그를 **익명화**한다
    (`data-retention-purge.job.ts:1104` `auditLogsAnonymized`). 즉 **행 하나를 더 쓰는 것이
    P-1을 되돌리지 않는다** — P-1이 금지한 것은 `users` 행을 만지는 일이고, 그 경고는
    P-1 자신이 *"행을 다시 만지는 순간 P-1이 돌아온다 … 원하면 그것은 **감사 로그의 새
    액션**이지 `users` 행이 아니다"* 라고 이미 방향까지 적어 두었다.
  - ⚠️ **덤으로 어드민의 액션 프리셋에 유령을 막는 단언이 없다.**
    `apps/admin/src/lib/audit-log-filters.ts:169-198`의 `AUDIT_LOG_ACTION_PRESETS`는 **스물둘**
    인데, `audit-log-filters.test.ts:155-198`이 묻는 것은 **중복·라벨 비어 있지 않음·필터 검증
    통과·특정 넷의 존재**뿐이다 — **각 액션이 서버가 실제로 기록하는 문자열인지는 아무도
    묻지 않는다.** 라운드 75 P-4의 대장도 이 표를 *"부분집합이라 전수 대조 대상이 아니다"* 로
    면제해 뒀는데(`admin-canonical-mirrors.test.ts:496`), 그 판정은 **한 방향에만** 옳다:
    부분집합이라 "서버의 전부가 여기 있어야 한다"는 틀리지만, **"여기 있는 것은 서버에
    있어야 한다"는 여전히 참이어야 한다.** 오늘 스물둘은 전부 실재한다(실측) — **"틀려도
    조용하다"** 다.
- **실패 시나리오**: 탈퇴한 이용자가 한 달에 한 번씩 로그인을 눌러 본다(라운드 75 P-1이 그린
  바로 그 사람이다 — 이제 파기 시계는 밀리지 않는다). 고객센터에 *"앱에 못 들어가요"* 문의가
  온다. 담당자가 사용자 조회를 연다. **마지막 활동 —**(라운드 75 이후 그 값은 정직해졌다).
  감사 로그를 연다. **행 0건.** 그는 이 사람이 로그인을 시도했는지, 탈퇴 상태인지, 차단됐는지,
  아니면 애초에 가입한 적이 없는지 **구별할 방법이 없다.** 요청 로그의 4xx만 남는데 거기에는
  userId가 없다(인증 전이다). — 같은 화면에서 어드민 계정의 실패한 로그인은 **행 하나로**
  보인다.
- **최소안**: **감사 액션 하나. `users` 행 0건 · 응답 0건.**
  ⓐ **거절 앞에 기록 한 줄** — `USER_BLOCKED`·`USER_WITHDRAWN`을 던지기 **전에**
  `action: "auth.login_rejected"` 한 행(`actorUserId` = 그 사용자 id · `targetType: "users"` ·
  `after: { provider, reason: "blocked" | "withdrawn" }`). ⚠️ **PII 0건** — `sub`·이메일·닉네임·
  토큰은 싣지 않는다(`auth.login`이 지키는 그 규율 그대로 — round5a-sprint2-plan §2 · DNC-019).
  ⓑ **부정 단언 두 방향** — ① 그 경로가 `users.updated_at`·`last_login_at`을 **한 값도 움직이지
  않을 것**(라운드 75 P-1의 그 단언이 그대로 서 있다는 것을 **이 트랙이 다시 확인**한다),
  ② 403 응답의 **코드·문장·상태·판정 순서**(차단이 탈퇴보다 먼저) 바이트 불변.
  ⓒ **프리셋 한 줄 + 유령 부정 단언** — 프리셋에 `auth.login_rejected`를 더하고(CS가 이 문의를
  받는 순간 필요한 필터다), **모든 프리셋의 action이 서버 소스에 실재할 것**이라는 부정 단언을
  세운다(`admin-canonical-mirrors.test.ts`가 이미 `apps/api/src`를 읽는 그 방법 그대로).
  ⚠️ **반대 방향은 세우지 않는다** — 프리셋은 의도된 부분집합이고, 그 사실은 P-4의 면제 문장이
  이미 값으로 적어 두었다.
- **설계 긴장**: 아홉이다. ⓐ ⚠️ **`households/household-runtime.service.ts` 무접촉**(라운드 75 A가
  닫은 그 갈래를 한 글자도 만지지 않는다 — 이 트랙이 쓰는 것은 **다른 테이블**이다).
  ⓑ **파기 잡 0건**(phase 순서·상수 여섯·익명화 로직 — 읽기만). ⓒ **마이그레이션 0건 · 새 컬럼
  0건**(`withdrawn_at`은 여전히 이번 라운드 밖 — P3). ⓓ **모바일 0건**(`USER_WITHDRAWN`·
  `ACCOUNT_DELETE_REJOIN_NOTICE`는 하한으로 정직하다). ⓔ **정상 로그인 경로 무변경**
  (`auth.login` 행의 모양·시점 그대로). ⓕ **dev `/auth/oauth-login` 무접촉**(프로덕션 fail-closed).
  ⓖ **`apps/admin/app/audit-logs/page.tsx` 무접촉**(프리셋 목록을 읽는 화면 — 렌더 0건).
  ⓗ **`admin-canonical-mirrors.test.ts` 무접촉**(그 면제 문장은 오늘도 옳다 — 이 트랙은 **다른
  파일**에 부정 단언을 세운다). ⓘ **감사 로그 보존 창(730일) 무변경.**

### 5. **어드민 CMS의 "준비 시기"는 오늘도 아무 판정을 지나지 않는다 — 답은 셋 중 "서버"다 (O-2 잔여, 채택)** — 핵심 루프 3단계 — M

- **근거**: 라운드 74 O-2가 남기고 라운드 75 P-4가 **이유를 고쳐 적은** 그 잔여다. 오늘 셋을
  재어 봤고, 그중 하나가 값싸다.
  - **오늘의 사실**: `apps/admin/app/items/page.tsx`의 `timingLabel` 편집 필드는 어떤 문자열이든
    받고, 서버는 공백만 정리한다(`apps/api/src/onboarding/items-catalog.service.ts:1025` —
    `cleanOptionalText(...) ?? ""`). 그 값은 `app/items/[itemTemplateId].tsx`의
    **"준비 시기" 사실 줄**로 그대로 간다. 대조하는 자리는 **서버·어드민 어디에도 0건**이다.
  - **라운드 75가 정리한 세 갈래를 재어 본 결과.**
    ① **빌드 설정(`transpilePackages`)** — `apps/admin`의 dependencies를 넷에서 늘리는 일이고
    (`@wooriai/domain`의 `main`이 raw TS다), 라운드 60 P2-8의 근거를 뒤집는 **별도 판단**이다. **기각.**
    ③ **값 미러 + 대조 테스트** — P-4가 세운 대장이 받아 줄 모양이긴 한데, 미러해야 하는 것이
    **문자열 목록이 아니라 개월 경계 산술**이다(라벨이 말하는 구간 ↔ `stageCodes`가 덮는 구간의
    겹침). 미러가 아니라 **로직 사본**이 되므로 P-4가 세운 규율에 어긋난다. **기각.**
    ② **서버가 판정한다** — ⚠️ **오늘 재어 보니 이 길에는 남은 일이 거의 없다.**
    `apps/api`는 이미 `@wooriai/domain`을 의존성으로 들고(`package.json:24`), **판정 로직이
    이미 저장소에 있다** — `apps/api/test/seed-data.test.ts`의 `stageNotationRanges`(`:110`,
    경계를 `calculateChildStage`를 나이로 훑어 **파생**시킨다)와 `parseTimingLabelMonths`(`:134-166`).
    ⚠️ **그 둘이 테스트 파일 안에만 산다** — 라운드 74 B가 만든 그 계약이 **시드만** 무는
    구조적 이유가 정확히 그것이었다.
  - **판정의 모양도 이미 정해져 있다**(라운드 74 B · 74 리뷰 B-2가 대칭까지 세워 뒀다):
    ① 라벨 구간이 `stageCodes` 합집합을 벗어나지 않을 것, ② 품목이 지는 스테이지 하나하나가
    라벨과 겹칠 것, ③ 라벨이 밴드 칩 이름을 그대로 말하면 더 이른 칩에 서 있지 않을 것.
  - ⚠️ **그리고 이 트랙이 만드는 사유는 오늘 운영자에게 닿지 않는다** — `app/items/page.tsx:454`·
    `:497`이 서버 메시지를 버리기 때문이다(후보 2). **두 트랙이 합쳐져야 루프가 닫힌다.**
- **실패 시나리오**: 운영자가 `push_walker`(걸음마 보조 장난감)의 준비 시기를 계절 캠페인에
  맞춰 `"12~24개월"`로 고친다. 저장된다 — 아무 경고도 없다. 생후 8개월 아이의 부모가
  **`6-12개월` 칩**에서 그 준비템을 열면 상세가 말한다: **"준비 시기: 12~24개월."** 지금
  사라는 건지 나중에 사라는 건지 모르는 채로 화면을 닫는다. 핵심 루프의 3단계(준비템 확인)와
  4단계(구매 링크) 사이가 그 한 줄에서 끊긴다. — 라운드 74 B가 시드에서 **정확히 이 어긋남
  열 건**을 고쳤고, 그 계약은 운영 입력을 보지 못한다.
- **최소안**: **판정을 테스트 밖으로 꺼내고, 저장 경로가 그것을 지난다. 시드 값 0건.**
  ⓐ **모듈 이전**(`apps/api/src/onboarding/timing-label-range.ts`, 신설) —
  `stageNotationRanges`·`parseTimingLabelMonths`·겹침 판정을 **로직 그대로** 옮긴다.
  ⚠️ **개월 수를 손으로 다시 적지 않는다**(경계는 오늘처럼 `packages/domain`에서 파생).
  `seed-data.test.ts`는 지역 사본을 지우고 이 모듈을 import한다 — **단언은 한 줄도 바뀌지 않는다.**
  ⓑ **저장 경로 한 겹** — 준비템 생성·수정에서 `timingLabel`이 **개월을 말하고** `stageCodes`와
  **명백히 어긋날 때만** 400(`ITEM_TIMING_LABEL_MISMATCH`)으로 거절한다. 메시지는 **어긋난
  구간을 그대로 말한다**(운영자가 고칠 수 있는 유일한 실패라 재시도를 권하지 않는다).
  ⚠️ ⓒ **파싱되지 않는 라벨은 통과한다** — `"출산 전후"`·`"돌 무렵"` 같은 서술 표기, 임신·세(歲)
  표기는 판정 대상이 아니다(`parseTimingLabelMonths`가 오늘 이미 그 셋에 null을 돌려준다).
  **모르면 지어내지 않는다** — CMS의 자유도를 줄이는 것이 목적이 아니라 **명백한 모순**만 막는다.
  ⓓ **빈 문자열·미지정 무변경**(오늘 `?? ""`로 저장되는 그 갈래 그대로 — 상세 화면은 빈 값이면
  사실 줄을 아예 그리지 않는다).
- **설계 긴장**: 아홉이다. ⓐ ⚠️ **`apps/admin/**` 0건**(사유를 **만들기만** 한다 — 보이게 하는
  것은 트랙 B다. 두 트랙이 한 파일도 겹치지 않는다). ⓑ **시드 값 0건**(`seed-data.ts`의
  `timingLabel` 62줄·품목·필수도·가격·링크·`reasonText`·`safetyNote` 한 글자도 만지지 않는다).
  ⓒ **밴드 라벨 네 문자열 무접촉**(`"0-6개월"`·`"6-12개월"`·`"12-24개월"`·`"24개월+"` — ITEM-001
  캡처·`packages/contracts`·서버 쿼리 파라미터가 함께 잠근 값). ⓓ **`packages/domain` 읽기만**
  (스테이지 정의·`calculateChildStage` 무변경). ⓔ **모바일 0건**(`itemMatchesBand`·
  `resolveDefaultStageLabel`·상세의 `productDetailFacts` 무접촉 — 그 판정들은 라운드 74 B가 닫았다).
  ⓕ **`seed-data.test.ts`의 단언 문장 불변**(import 출처만 바뀐다 — 계약이 약해지지 않았다는
  것이 그 방식으로 보인다). ⓖ **마이그레이션 0건**(기존 행 검증·정정 0건 — 이미 저장된 값은
  건드리지 않는다. 오늘 그 값은 전부 시드이고 시드는 초록이다). ⓗ **콘텐츠 검토(초안) 경로도
  같은 판정을 지나야 한다**(`content-revisions.service.ts:816`이 `timingLabel`을 나른다 —
  검토를 우회로 만들지 않는다). ⓘ DNC-020(의학적 단정 금지)은 이 자리에 새로 생기지 않는다.

## P3

- **`withdrawn_at` 컬럼 — 보류 유지(마이그레이션 0건 원칙).** 라운드 75 P-1이 남긴 구조는
  그대로다: 파기 잡이 탈퇴 시각을 아는 방법은 `updated_at` 하나뿐이고, 탈퇴 계정의 행을 쓰는
  **새 경로가 생기면** 같은 결함이 돌아오는데 그 부정 단언은 침묵한다. ⚠️ **트랙 D는 그 구조를
  건드리지 않는다** — `users` 행이 아니라 `audit_logs` 행을 하나 더 쓰고, 라운드 75의 부정
  단언을 **다시 확인**한다. 컬럼 신설은 여전히 별도 결정이다.
- **법적 문서 항목 이름 1:1 대조 — 기각 유지(법무 판단).** `privacy-policy.html:5`의 HTML
  주석이 요구하는 *"데이터 안전 답안지와 항목이 1:1로 일치"* 중, 라운드 75 B가 건 것은
  **보존 기간 숫자**뿐이다. 항목 **이름** 전수 대조는 법률 검토의 일이고, 그 밖의 셋
  (배포된 페이지 · 배포 env override 값 · Play 콘솔에 **제출된** 답변)은 계약의 시야 밖이다
  (`runtime-verification-required.md` #112). **상태 변화 없음 — 이번 라운드의 어느 트랙도
  `infra/legal/**`·`docs/store/**`를 열지 않는다.**
- **`launch-readiness-status.md`의 테스트 건수 자동화 — 기각(오늘 실측했다).**
  라운드 75 P-3은 *"스위트를 실제로 돌려야 나오는 값"* 이라고 적었다. 값싼 대안(정적으로
  `it(`·`test(`를 세는 것)을 오늘 재어 보니 **구조적으로 미달한다**:
  test-utils **94** vs 실제 **107** · domain **116** vs **131** · contracts **48** vs **66**
  (셋 다 부족하다 — `it.each`·`describe.each`·루프 안의 `it`이 정적으로 한 줄이기 때문이다).
  ⚠️ 즉 **틀린 숫자를 자동으로 적는 계약**이 되어 지금보다 나쁘다. **P-3의 판정을 유지하고,
  다음 라운드가 같은 실험을 다시 하지 않도록 이 수치를 남긴다.**
- **`"시도해 주세요"` vs `"시도해주세요"` — 두 표기, 이번 라운드는 고치지 않는다.**
  실측(주석 제외, `app/**`+`src/**`): 띄어쓴 쪽 **30건 / 파일 열여덟**, 붙인 쪽 **10건 / 파일 셋**
  (`src/auth/kakao-login.ts` 7 · `src/export/ExpenseCsvExport.tsx` 2 · `src/export/expense-page-collector.ts` 1).
  ⚠️ **둘 다 사용자에게 보이고**, 하필 그 셋이 **가입 첫 10분**(카카오 로그인 실패)과
  **월말 정리**(CSV 내보내기) 여정에 있다. 다만 ① 둘 다 어법상 허용되는 표기라 **거짓이 아니고**,
  ② 고치면 사용자 문구 열 줄이 바이트로 바뀌는데 그 축(문구 표기 통일)은 이번 라운드 어느
  트랙의 축도 아니다. **트랙 A가 그 파일들을 대장에 이름만 올리고 문구는 0건 만진다.**
  ⚠️ **다만 그 방언이 계약에 값을 치른다는 사실이 오늘 처음 나왔다**: 파생 바늘을 공용 상수의
  **문장 전체**로 잡으면 이 셋이 스윕에 **구조적으로 안 걸린다**(후보 1의 마지막 근거).
  그래서 트랙 A의 바늘은 `"잠시 후 다시"`까지만 잡는다 — **방언을 통일하지 않은 대가를 그물이
  대신 치르고 있고, 그 사실이 이제 값으로 적힌다.** 다음 라운드가 표기 축을 열면 이 수치가
  시작점이다.
- **카카오 로그인 실패 문구는 이미 오프라인 정직이다 — 무접촉 근거.**
  `src/auth/login-copy.ts:93`의 `LOGIN_FAILED_MESSAGE`는 *"로그인 중 문제가 발생했어요.
  **네트워크 연결을 확인한 뒤** 다시 시도해 주세요."* 로, `step-ui.tsx:64`가 온보딩에서 쓰는
  그 문형과 같다(기다리라고 하지 않고 확인할 것을 말한다). **트랙 A의 대상이 아니다.**
- **어드민 `AdminShell.tsx`의 쓰기 다섯 자리는 이미 사유를 말한다 — 대장에 이름만 오른다.**
  `:164`·`:252`·`:329`·`:354`·`:509`가 전부 `error instanceof AdminApiError ? error.message : 폴백`
  손 사본이다. 트랙 B가 그 다섯을 **공용 한 벌로 바꾸되 문장은 바이트 불변**이다(사본이 다섯
  벌인 것이 다음 드리프트의 씨앗이라는 것이 라운드 75 P-4의 교훈이다).
- **어드민 카탈로그 전량 조회 · known-limitations M-3 잔여 · `ApplicationPrimitives.tsx:151-153`의
  정규식 제목 판정 · 미출처 틴트 `#fdeee6` 둘 · `docs/5차/round55-plan.md:258`의 GFM 셀 수 ·
  라운드 74 C의 `"11/11"` 부정 스윕 · `itemMatchesBand`의 `timingLabel` 폴백 사문 ·
  `app/(tabs)/reports.tsx`의 임신 중 보장된 400 1건 · 첫돌 이후 마일스톤 고착 ·
  가져오기 확정 칸 1건 · `AuthService.refresh`가 `user.status`를 보지 않는다 ·
  api 테스트 하네스의 동시 실행 구멍 · 서버 중복 아이 가드 부재(M-1 · DNC-007) ·
  발행 `before` 경합 · `monthly_wrapup` 콜드 스타트 시점 · 크래시 파이프라인 부재 ·
  서버 stdout의 두 로그 형식(O-1)** — 라운드 62~75가 남긴 그대로이고 **상태 변화가 없다.**
- **`worker-jobs` ScheduledPublishJob 플레이크 · `storage: "ok"` 초기값 · `"무료배송"` ·
  알림 벨 🔔 — 무접촉 유지.** 재검토 트리거는 이번에도 발동하지 않았다.
  ⚠️ **api vitest를 이번 라운드는 돌리지 않았다**(정찰에 불필요) — 플레이크 관찰 기록 없음.
- **성능·용량과 테스트 인프라(N-4) — 다시 재지 않았고 제안하지 않는다.** N-4의 기각 조건
  ("새 실측이 먼저 있어야 한다")을 이번 라운드가 충족시키지 않았다. **재지 않았다고 적는다.**
- **제외 목록 준수 확인**: 준비템 목록 **가격 표시**(라운드 64 트랙 B — 사용자 결정 대기) ·
  오프라인 로컬 아이 복구 · 외부 계정/키/자산 · **C-3 잠금 오버레이 낭독**(실기기 필요 —
  오늘로 **열 라운드 연속** 미확인, 표기만 갱신) · **C/E 인용 두 방언**(P-3 판정 완료, 재론 없음) ·
  40주 초과 달력 · `onBudgetRelevantChange` · 4가구/`viewedHouseholdId`(라운드 75 종결).
  **이번 라운드의 어느 트랙도 이 자리들을 열지 않는다.**

## 코드 건강 판정

- **목록이 닫힌 곳의 바로 옆 칸에 같은 결함이 산다 — 이번엔 두 번 났다.**
  모바일의 조회·저장 오프라인 정직은 `app/**`에서 **완전히** 닫혔다(라운드 72~74). 어드민의
  조회 사유 소비는 열여섯 자리에서 **완전히** 닫혔다(라운드 73~75). 그런데 오늘 후보 1은
  **화면이 아니라 모듈**에서, 후보 2는 **조회가 아니라 쓰기**에서 같은 결함을 냈다.
  ⚠️ 라운드 75가 어드민 스윕에서 얻은 교훈(*"스윕의 범위는 어디에 코드가 있는가가 아니라
  **어디에 사용자가 있는가**로 정해야 한다"*)의 쌍둥이가 오늘 나왔다 — **스윕의 축은 "무엇을
  걷는가"뿐 아니라 "무엇을 세는가"로도 정해야 한다.** `app/**`을 걷되 **모듈이 문장을 갖는
  저장소**에서는 그 뿌리가 답이 아니고, 조회를 세는 대장 옆에는 **쓰기를 세는 대장**이 있어야 한다.
- **⚠️ 가장 값진 관측: 앱이 이유를 아는데도 말하지 않는 자리가, 같은 파일 안에서 갈렸다.**
  `app/reviews/page.tsx`는 형제 넷 중 **하나**(`handleSchedule`)에서만 서버의 한국어 사유를
  쓰고, 그 자리에 *"API가 이미 한국어 사용자 메시지를 내려줘요"* 라는 주석까지 달아 두었다.
  나머지 셋은 30줄 위아래에서 그 사실을 모른다. 그리고 그중 하나는 **모르는 원인을 단정한다**.
  라운드 75가 P-1에서 얻은 문장(*"문장이 참인 것과 그 문장의 근거가 참인 것은 다른 일이다"*)의
  다음 층이 이것이다 — **한 파일 안에서 옳은 답을 이미 적어 둔 자리가 있으면, 그 형제들이
  왜 다른 답을 하는지를 값으로 물어야 한다. 주석은 형제에게 전파되지 않는다.**
- **라운드 75가 "이유까지 적으라"고 한 이월이 오늘 실제로 값을 냈다.**
  O-2가 *"미결정"* 이 아니라 *"의존 구조"* 라고 다시 적힌 덕분에, 이번 라운드는 "막을까"를
  묻지 않고 **셋 중 어느 문을 열까**만 물었다 — 그리고 재어 보니 답이 이미 저장소 안에 있었다
  (판정 로직이 **테스트 파일 안에** 살고 있었다). ⚠️ **판정을 테스트에만 두면 그 판정은 시드만
  문다** — 계약이 옳을수록 그 사실이 안 보인다. 라운드 74 B가 훌륭한 계약을 세우고도 운영
  입력을 놓친 이유가 그것이고, 라운드 75가 그 이유를 이월에 적어 두지 않았다면 이번 라운드도
  같은 자리를 "미결정"으로 지나갔을 것이다.
- **관측성은 대칭으로 재야 한다.** 어드민은 실패한 로그인을 세 종류로 센다
  (`admin.login_failed`·`admin.mfa_login_failed`·`admin.password_change_failed`).
  앱은 성공만 센다(`auth.login`). 그 비대칭은 아무 단언도 깨지 않고, **CS가 답할 수 없는 문의가
  생길 때까지 보이지 않는다.** 라운드 75 A가 거짓 활동 표시를 없앤 것은 옳았고, 그때 함께 사라진
  흔적을 **다른 축에서** 되살리는 것이 오늘의 일이다 — 같은 값을 되돌리는 것이 아니라.
- **이번 라운드의 계약도 전부 파생/부정/전수다.** 다섯 후보가 살아남은 이유가 같다 —
  *스윕이 `app/**`만 걷는다* · *쓰기 실패를 세는 대장이 없다* · *여정 파일 목록이 컨트롤러를
  못 본다* · *거절을 세는 것이 없다* · *판정이 테스트 안에만 산다*. 다섯 다 **어떤 단언도 깨지
  않는 사실**이다. 그래서 계약도 같은 모양으로 선다: 모듈 뿌리 전수 ↔ 대장(전수),
  쓰기 자리 ↔ 대장(전수+부정), 컨트롤러 파생 ↔ 파일 목록(파생), 거절 경로의 `users` 쓰기 0건
  (부정) + 프리셋 ↔ 서버 액션(부정), 저장 경로 ↔ 도메인 경계(파생).
- **큰 파일 판정 유지.** 트랙이 여는 파일 중 1,000줄을 넘는 것은 셋이다
  (`apps/admin/src/components/AdminShell.tsx` · `apps/admin/app/links/page.tsx` ·
  `apps/api/src/onboarding/items-catalog.service.ts`)이고 셋 다 만지는 것은 **catch 몇 자리와
  저장 경로 한 겹**이다. 이번 라운드도 그 축을 팔지 않는다.
- **이월 정산.** 이월 다섯 중 **셋을 채택**(L-1 → 트랙 C · P-1 관측성 → 트랙 D · O-2 → 트랙 E),
  **하나를 실측 기각**(P-3 테스트 건수 자동화 — 정적 세기가 구조적으로 미달), **하나를 보류
  유지**(P-2 법무 판단 · P-1의 `withdrawn_at` 컬럼). 자유 발굴로 **둘**을 더했고 둘 다
  **사용자·운영자가 실패한 순간 읽는 문장**이다(후보 1·2).

## 트랙 구성 (파일 단위 상호 배타)

- **A 초대 만들기의 오프라인 정직 + 모듈 층의 저장 실패 대장** (#1) — **즉시 착수 가능**
  - 소유: `apps/mobile/src/family/invite-permissions.ts`(⚠️ **`inviteCreateErrorMessage`에
    `isOnline` 한 겹** — 문자열 둘 바이트 불변) · `apps/mobile/src/family/invite-permissions.test.ts` ·
    `apps/mobile/app/family/invite.tsx`(⚠️ **실패 문구 한 자리**) ·
    `apps/mobile/src/offline/offline-aware-screens.ts`(SAVE 화면 목록 넷 → 다섯 + **모듈 대장 둘 신설**) ·
    `apps/mobile/src/offline/messages.test.ts`(⚠️ **`src/**` 스윕 신설**)
  - 금지: **온라인 갈래 바이트 불변**(`INVITE_CREATE_FAILED_MESSAGE`·`INVITE_FORBIDDEN_MESSAGE`·
    403 갈래·판정 순서) · **새 문구 0건** · **서버 0건**(초대 생성 API·만료·토큰 해시 무접촉) ·
    `app/family/index.tsx`·`app/family/accept/[token].tsx` **무접촉**(이미 배선돼 있다) ·
    `src/family/member-mutation-messages.ts`·`invite-flow.ts`·`invite-accept-messages.ts` **무접촉** ·
    **조회 쪽 목록 셋 무변경**(`OFFLINE_AWARE_LOAD_ERROR_*`) · **`app/**` 옛 리터럴 횟수 표 무변경** ·
    **`src/auth/**`·`src/export/**`·`src/expenses/**`·`src/security/**` 문구 0건**(대장에 **이유만**) ·
    픽셀락 무접촉 · DNC-018
  - 계약: ⓐ **전수 단언** — `src/**`에서 실패 문구의 꼬리(`LOAD/SAVE_ERROR_NOTICE`의 마지막
    문장에서 **파생**한 바늘)를 들고 있는 모듈은 예외 없이 **오프라인 판정을 받거나, 이유가
    적힌 면제 목록**에 있을 것(오늘 **열넷** — 다섯 배선 · 여덟 면제 · **하나가 이 트랙의
    대상**. 정의상 밖인 둘도 이유와 함께 값으로).
    ⓑ 초대 생성 실패가 오프라인일 때 **공용 문장**으로, 그 밖에는 **종전 두 문장 그대로** 갈릴 것
    (판정 순서: 아는 코드 → 오프라인 → 폴백). ⓒ `OFFLINE_AWARE_SAVE_ERROR_SCREENS` 합이
    **넷 → 다섯**이고 `app/**` 사용 집합과 정확히 일치할 것. ⓓ 면제 이유는 **빈 문자열 금지.**

- **B 어드민의 쓰기 실패가 이유를 말한다** (#2) — **A와 완전 독립, 즉시 착수 가능**
  - 소유: `apps/admin/src/lib/write-error-copy.ts`(신설 — 한 벌 + 대장 둘) ·
    `apps/admin/src/admin-write-error-copy.test.ts`(신설) ·
    `apps/admin/app/reviews/page.tsx` · `apps/admin/app/items/page.tsx` ·
    `apps/admin/app/links/page.tsx` · `apps/admin/app/disclosures/page.tsx` ·
    `apps/admin/app/users/page.tsx` · `apps/admin/app/categories/page.tsx` ·
    `apps/admin/src/components/AdminShell.tsx` · `apps/admin/src/components/ProductLinkBulkReplace.tsx`
  - 금지: ⚠️ **`src/lib/load-error-copy.ts` 무접촉**(`LOAD_ERROR_COPY_SITES` 열여섯·면제 하나·
    `loadErrorCopy`/`loadErrorMessage`/`loadErrorRetryable` 전부 — 조회는 라운드 75가 닫았다) ·
    ⚠️ **`src/lib/admin-api.ts` 무접촉**(`WRITE_TIMEOUT_MESSAGE`·`IDEMPOTENT_WRITE_TIMEOUT_MESSAGE`·
    타임아웃 상한·`AdminApiTimeoutError`·멱등키 홀더 — **읽기만**) ·
    **API 호출·멱등키 회전·성공 문구·목록 새로고침·폼 검증 무변경** ·
    **새 한국어 문구 0건**(폴백 문자열 **여덟 바이트 불변**, 바뀌는 것은
    `app/reviews/page.tsx:229`의 **원인 단정 한 절**뿐) ·
    `src/lib/audit-log-filters.ts`·`app/audit-logs/page.tsx` **무접촉**(트랙 D) ·
    `src/admin-canonical-mirrors.test.ts`·`src/lib/admin-token-context.tsx` **무접촉** ·
    **서버 0건**(새 코드·새 메시지 0건 — 사유는 트랙 E가 만든다) · 마이그레이션 0건 · DNC-018
  - 계약: ⓐ **전수 단언** — `app/**` + `src/components/**`의 **쓰기 catch**가 예외 없이
    `WRITE_ERROR_COPY_SITES`에 자리 수로 있거나 **이유가 적힌 면제 목록**에 있을 것
    (`src/lib/**`가 범위 밖인 이유도 값으로 — 라운드 75 D가 조회 쪽에 세운 그 형식).
    ⓑ **부정 단언** — 대장 밖에서 쓰기 실패 폴백을 손으로 적으면 빨개질 것(옛 리터럴 스윕 형식).
    ⓒ 서버가 사유를 주면 그 문장이, 아니면 **종전 폴백이 바이트 그대로** 설 것.
    ⓓ **쓰기 타임아웃 두 문장이 화면까지 닿을 것**(`WRITE_TIMEOUT_MESSAGE` ·
    `IDEMPOTENT_WRITE_TIMEOUT_MESSAGE` — R19-F의 "재시도를 권하지 않는다"가 실제로 보인다).
    ⓔ **부정 단언** — 어떤 쓰기 폴백도 **실패 원인을 단정하지 않을 것**(오늘 `reviews:229`가
    이것을 깬다 — 이 단언이 **고치기 전에 빨갛다**).

- **C 여정 목록이 자기 컨트롤러를 센다** (#3) — **A·B와 독립 · 가장 작다**
  - 소유: `apps/mobile/src/import/import-failure-messages.test.ts` **한 파일**
  - 읽기: `apps/api/src/**/*.controller.ts`(서른둘) · `apps/api/src/imports/imports.controller.ts`
  - 금지: **서버 0건** · `apps/mobile/src/import/import-failure-messages.ts` **무접촉**
    (표·문구·판정 0건) · **제외 목록 기존 셋의 이유 문장 바이트 불변** ·
    `src/settings/destructive-flow-messages.test.ts`·`src/api/api-error.test.ts` **무접촉**
    (단위가 각각 메서드·아웃박스 파일이다 — 그 사실은 **주석 한 줄**로) ·
    **여정 목록 신설 0건**(L-1의 큰 질문은 열어 둔다) · `app/import/**` 0건
  - 계약: ⓐ **파생 단언** — 여정 서버 파일을 import하는 `*.controller.ts` 집합이
    `IMPORT_JOURNEY_SERVER_FILES`에 포함되거나 **이유와 함께 제외**될 것(오늘 답은 하나).
    ⓑ 목록이 **둘 → 셋**이 된 뒤에도 코드 스윕 하한(≥10)·유령 없음·반대 방향 단언이 **전부
    초록**일 것. ⓒ 컨트롤러 스캔의 **하한 단언**(≥30) — 정규식이 조용히 0건이 되지 않게.

- **D 거절된 로그인을 세는 한 줄** (#4) — **A·B·C와 독립**
  - 소유: `apps/api/src/auth/kakao/kakao-auth.service.ts`(⚠️ **403 두 갈래 **앞**에 감사 기록
    한 줄**) · `apps/api/test/auth-kakao-oidc.e2e.test.ts` ·
    `apps/admin/src/lib/audit-log-filters.ts`(⚠️ **프리셋 한 줄**) ·
    `apps/admin/src/lib/audit-log-filters.test.ts`
  - 금지: ⚠️ **`apps/api/src/households/household-runtime.service.ts` 무접촉**(라운드 75 A의
    `status === "active"` 갈래를 한 글자도 만지지 않는다 — 이 트랙이 쓰는 것은 `audit_logs`다) ·
    **`users` 행 쓰기 0건**(`updated_at`·`last_login_at` 불변 — 부정 단언이 그것을 다시 확인한다) ·
    **응답 계약 0건**(`USER_BLOCKED`·`USER_WITHDRAWN`의 코드·문장·403 · **차단이 탈퇴보다 먼저**
    나는 순서) · **정상 로그인 무변경**(`auth.login` 행의 모양·시점) ·
    **PII 0건**(`sub`·이메일·닉네임·토큰 금지 — DNC-019) · **파기 잡 0건**(익명화·phase 순서·
    상수 여섯 읽기만) · **마이그레이션 0건 · 새 컬럼 0건**(`withdrawn_at` — P3) ·
    dev `/auth/oauth-login` 무접촉 · `apps/admin/app/audit-logs/page.tsx`·`src/admin-audit-logs.test.ts`
    **무접촉** · `src/admin-canonical-mirrors.test.ts` **무접촉** · `apps/mobile/**` 0건
  - 계약: ⓐ 차단·탈퇴 거절이 `auth.login_rejected` **한 행**을 남길 것(사유·provider만 · 성공
    로그인에는 서지 않을 것). ⓑ **부정 단언** — 그 경로가 `users.updated_at`·`last_login_at`을
    **한 값도 움직이지 않을 것**(라운드 75 P-1의 단언을 이 트랙이 다시 확인한다).
    ⓒ **부정 단언** — 그 행의 어느 칸에도 카카오 식별자·이메일·닉네임·토큰이 없을 것.
    ⓓ **부정 단언** — `AUDIT_LOG_ACTION_PRESETS`의 모든 action이 **서버 소스에 실재**할 것
    (유령 프리셋 0건). ⚠️ 반대 방향(서버 전부가 프리셋에)은 **세우지 않는다** — 부분집합은 의도다.

- **E 어드민이 넣은 "준비 시기"를 서버가 판정한다** (#5) — **A·B·C·D와 파일 독립**
  - 소유: `apps/api/src/onboarding/timing-label-range.ts`(신설 — 판정 이전) ·
    `apps/api/src/onboarding/items-catalog.service.ts`(⚠️ **저장 경로 한 겹**) ·
    `apps/api/src/admin/content-revisions.service.ts`(⚠️ **검토 경로가 같은 판정을 지나는
    한 자리** — 우회로를 만들지 않는다) · `apps/api/test/seed-data.test.ts`(⚠️ **지역 사본을
    import로** — 단언 문장 불변) · `apps/api/test/items-catalog-timing-label.test.ts`(신설)
  - 금지: ⚠️ **`apps/admin/**` 0건**(사유를 **만들기만** 한다 — 보이게 하는 것은 트랙 B) ·
    **시드 값 0건**(`prisma/seed-data.ts` 무접촉 — `timingLabel` 62줄·품목·필수도·가격·링크·
    `reasonText`·`skipReasonText`·`safetyNote` 전부) · **밴드 라벨 네 문자열 무접촉** ·
    `packages/domain`·`packages/contracts` **읽기만** · **모바일 0건**(`itemMatchesBand`·
    `resolveDefaultStageLabel`·`productDetailFacts`·`src/items/stage-bands.ts` 무접촉) ·
    **파싱 불가 라벨 통과**(서술·임신·세(歲) 표기를 새로 막지 않는다) · **빈 값 갈래 무변경** ·
    **기존 행 일괄 검증·정정 0건** · 마이그레이션 0건 ·
    `apps/api/src/auth/**` **무접촉**(트랙 D)
  - 계약: ⓐ **파생 단언** — 판정 모듈이 개월 경계를 `packages/domain`에서 **파생**시킬 것
    (숫자를 손으로 적지 않는다 — 오늘 테스트가 하는 그대로). ⓑ `seed-data.test.ts`의 **단언이
    한 줄도 바뀌지 않은 채** 새 모듈을 지날 것(계약이 약해지지 않았다는 증거). ⓒ 저장 경로가
    **명백한 모순만** 400으로 거절하고, 그 메시지가 **어긋난 구간을 그대로 말할** 것.
    ⓓ **부정 단언** — 파싱되지 않는 라벨·빈 라벨은 **오늘과 똑같이 저장될 것**.
    ⓔ 검토(초안) 경로도 같은 판정을 지날 것(우회 0건).

- **F 판정·접근성 표·확인의 표·출시 현황** — **A·B·C·D·E 머지 후**
  - 소유: `docs/operations/known-limitations.md` · `docs/qa/runtime-verification-required.md` ·
    `docs/qa/accessibility-offline-checklist.md` · `docs/5차/launch-readiness-status.md`
  - 금지: **제품 소스 0건** · `packages/test-utils/**` **무접촉**(§0 수치를 세는 계약은 라운드 75가
    세웠다 — 이 트랙은 **표를 갱신**하고 그 계약이 다시 센다) ·
    `packages/test-utils/src/repo-self-description.test.ts` **무접촉**(`OWNED_DOCS`·읽기 전용 가드·
    옛 수치 스윕 — `"11/11"` 문제는 P3 유지) ·
    `docs/store/**`·`infra/legal/**`·`README.md`·`AGENTS.md`·`CODEX_START_HERE.md` **무접촉** ·
    **행 삭제 0건 · 행 번호 불변**(#1~#114) · 각 행의 문장·기대 동작·근거 파일·부정 조건
    **바이트 불변** · **표면 값 재분류 0건** · K~P절의 **판정을 다시 쓰지 말 것**
    (P-1·P-4는 **갱신 한 줄**씩만)
  - 계약: ⓐ **known-limitations에 Q절을 신설**하고 이번 라운드가 확정한 판정 다섯을 남길 것 —
    (1) **문장이 사는 층**(모바일의 저장 실패 문구는 화면이 아니라 **모듈**에 있고, 스윕은
    `app/**`을 걷고 있었다는 사실 · 오늘의 모듈 **열넷**과 그 갈래 셋 · ⚠️ **파생 바늘을 문장
    전체로 잡으면 표기 방언 셋이 구조적으로 안 보인다**는 사실 · ⚠️ **표기 방언 둘은 고치지
    않았다**는 사실과 그 수치),
    (2) **쓰기 실패의 대장**(어드민 조회 열여섯 옆에 쓰기 대장이 없었다는 사실 · 사유를 버리던
    아홉 · ⚠️ **원인을 단정하던 한 문장**과 같은 파일 30줄 아래에 정답이 적혀 있었다는 사실 ·
    R19-F의 쓰기 타임아웃 문구가 화면에 닿지 못하고 있었다는 사실),
    (3) **여정 목록이 자기 컨트롤러를 센다**(L-1의 큰 질문은 **여전히 열려 있다**는 사실과,
    중간 크기 답 하나가 오늘 값이 됐다는 사실),
    (4) **거절을 세는 대칭**(어드민은 실패 로그인을 세 종류로 세고 앱은 세지 않았다는 사실 ·
    ⚠️ `users` 행이 아니라 `audit_logs` 행이라는 축 구분 · `withdrawn_at`은 **여전히 밖**),
    (5) **판정을 테스트에만 두면 시드만 문다**(O-2 잔여가 닫힌 이유와, 라운드 74 B의 계약이
    운영 입력을 구조적으로 못 보던 이유 · ⚠️ **CMS의 자유도는 줄이지 않았다** — 명백한 모순만
    막고 서술 표기는 통과한다는 판정).
    ⓑ **P-1 갱신 한 줄**: 관측성 손실의 절반이 감사 액션 하나로 닫혔고, `withdrawn_at` 구조는
    그대로라는 사실. ⓒ **P-4 갱신 한 줄**: 프리셋 면제의 판정이 **한 방향에만** 옳았다는 사실
    (부분집합이라 전수 대조는 아니지만, **유령 부정 단언**은 서야 했다).
    ⓓ **O-2 종결 한 줄**: 셋 중 어느 문을 왜 열었는지(빌드 설정·값 미러를 기각한 근거 포함).
    ⓔ **L-1 갱신 한 줄**: 컨트롤러 파생이 붙었고 여정 목록 질문은 남는다는 사실.
    ⓕ 접근성 표: 라운드 76분을 **A-17**로 세울 것(초대 만들기 실패 문구 · 어드민 쓰기 실패
    사유·타임아웃 문구 · 준비템 저장 거절 문구). ⓖ **C-3은 오늘로 열 라운드 연속 미확인**이라는
    사실을 갱신. ⓗ `runtime-verification-required.md`에 라운드 76 신설분을 **#115~로 편입**하고
    §0의 네 수·합계·§1-1 머리말 라운드 구간을 함께 갱신할 것(⚠️ 라운드 75 C의 계약이 그 값을
    파싱으로 다시 세므로, 틀리면 `@wooriai/test-utils`가 먼저 빨개진다).
    ⓘ `launch-readiness-status.md`의 **테스트 건수 재실측**(⚠️ **사람이 재는 유일한 수치** —
    자동화는 P3에서 실측 기각했다).

- **머지 순서**: **A·B·C·D·E는 서로 완전 독립**이고 즉시 병렬 가능하다 — A=모바일 가족·오프라인
  다섯, B=어드민 쓰기 실패 열, C=모바일 테스트 한 파일, D=api 인증 둘 + 어드민 감사 필터 둘,
  E=api 준비템 다섯. **파일이 한 곳도 겹치지 않는다.** ⚠️ **B와 D는 같은 워크스페이스지만
  파일이 완전히 분리돼 있다**(B는 `app/**`+`src/components/**`+`src/lib/write-error-copy.ts`,
  D는 `src/lib/audit-log-filters.*`). ⚠️ **D와 E는 같은 워크스페이스지만 갈라져 있다**
  (D는 `src/auth/**`+`test/auth-*`, E는 `src/onboarding/**`+`src/admin/content-revisions.service.ts`+`test/seed-data.*`).
  접점은 **읽기 방향으로만** 다섯이다: A가 `src/offline/messages.ts`를, B가 `admin-api.ts`·
  `load-error-copy.ts`를, C가 `apps/api/src/**/*.controller.ts`를, D가 `apps/api/src`의 액션
  문자열을, E가 `packages/domain`을 **읽는다**.
  **B를 먼저 머지하는 편이 낫다** — 이번 라운드에서 유일하게 **오늘 거짓을 말하는 문장**이
  있고(`reviews:229`), 그 트랙이 열려야 **E가 만드는 사유가 운영자에게 닿는다.**
  그다음이 **A**(사용자 여정의 첫 단추이고, 모듈 대장이 다음 라운드의 그물이 된다).
  **C·D는 아무 때나**(가장 작고 서로 독립이다). **E는 B 뒤**가 낫다.
  **F는 마지막이고, 이번 F는 Q절 다섯 판정 · P-1/P-4/O-2/L-1 갱신 네 줄 · A-17 ·
  C-3 열 라운드 표기 · #115~ 편입과 §0 재계산 · 테스트 건수 재실측이 본체다.**
