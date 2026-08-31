# 라운드 87 정찰 노트 (GAP-087)

> master `d68436e`(라운드 86 머지, PR #91) 기준 · 2026-08-31 실측. do-not-change.md(DNC-001~020) ·
> known-limitations **A~AA절**(AA-1~AA-5 + AA-R 전문 포함) · runtime-verification-required.md ·
> accessibility-offline-checklist.md · round56~86-scout 완료분 대조 완료.
>
> **이번 라운드의 지시는 자유 탐색이고, 그 위에 AA-5 규율이 얹혀 있다** — AA-1~AA-4가 각 절 끝에
> 남긴 *"다음 라운드가 먼저 세어 볼 만한 것"* 넷을 각각 **실측**하고, 발동하면 트랙으로 · 아니면
> 값과 재개 조건으로 남기는 것. 그래서 순서를 이렇게 잡았다:
> ① AA-1~AA-4의 질문 넷을 전수로 세고(각각 모집단을 먼저 정하고 그다음 바늘),
> ② AA-5의 질문(K~AA절이 남긴 질문 전수 중 답해지지 않은 것)을 세고,
> ③ 그다음 미개척 표면을 훑었다(감사 뷰 · 알림 기기 목록 · 콘텐츠 리비전 · 지출 입력 두 화면 ·
> CSV 내보내기 · 어드민 미러).
>
> **관측은 하나로 모인다 — 라운드 86이 *"판정을 옮긴 라운드는 옮기지 못한 절반을 세어야 한다"* 를
> 닫았고, 오늘 세어 보니 그 옆에 더 조용한 것이 있다:
> **한 층에서 닫은 규율이 바로 옆 층에서는 세어지지 않는다.**
> 다섯 후보 중 넷이 같은 모양이다:
> ① **호버로만 닿는 값을 라운드 86 D가 두 화면에서 걷었는데**, 같은 저장소에 남은 마지막 둘은
>    같은 화면의 표 두 칸이고 **화면이 그 사실을 문장으로 자백하고 있다**(후보 1 · AA-2의 답).
> ② **온보딩 실패 문장을 라운드 86 B가 세웠는데**, 그 라운드가 스스로 *"이 창에는 서지 않는다"* 라고
>    적어 둔 창이 아직 그대로다 — 그리고 **그 결정의 손이 저장소 안에 있다**(후보 2 · AA-3의 답).
> ③ **낭독 스윕 둘이 *"프롭만 걸린 자리 0건"* 을 단언하는데**, 그 둘의 모집단은 `app/**`과 대장
>    다섯이고 **온보딩 저장 실패 카드는 모듈 층에 살아서 둘 다의 밖**이다 — 그 카드는 오늘
>    **프롭만** 걸려 있다(후보 3 · AA-4의 답 · **어드민은 라운드 75에 같은 사각을 이미 닫았다**).
> ④ **행마다 갈리지 않는 낭독 라벨을 라운드 86 C가 가족 화면에서 걷었는데**, 저장소 전수 마흔여섯
>    자리 중 **아직 하나가 남아 있다**(후보 4).
> ⑤ **호출부 0건인 판정을 라운드 86 A가 하나 걷고 하나 되살렸는데**, 세어 보니 열일곱이고
>    **이유가 적힌 것은 둘뿐**이다(후보 5 · AA-1의 답 · 기계로 닫는다).

## 선행 확인 (후보 아님)

1. **라운드 86의 여섯 트랙은 전부 머지돼 있다**(실측).
   A=`apps/mobile/src/items/item-labels.ts`(사문 `itemListBadgeLabel` 제거 · 목록이
   `necessityBadgeLabel`을 부른다), B=`apps/mobile/app/(onboarding)/prepared-items.tsx`(조회 실패
   갈래에 공용 문장 + 고유 안내 · 제외 대장 `OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS`가 **0건**),
   C=`apps/mobile/src/family/memberLabels.ts`(`pendingInviteTarget` — 행·확인창·낭독이 한 값),
   D=`apps/admin/src/lib/analytics-trend-view.ts`(분석·클릭 두 화면이 같은 모듈을 지난다 — 실측:
   두 `page.tsx`가 모두 `analyticsTrendView`를 import한다), E=`packages/test-utils/src/dnc-secret-scan.ts`,
   F=known-limitations **AA절**(문서 **5,170줄** · AA절 `:4759~5170` · AA-R 포함).
   **재제안 대상 아님.**

2. ⚠️⚠️ **AA-5 규율 이행 — AA-1~AA-4가 남긴 질문 넷 전수에 오늘 답한다**(라운드 84가 만든 고정 절차).

   | # | 자리 | 질문 | 2026-08-31 실측 답 | 발동 |
   | --- | --- | --- | --- | --- |
   | 1 | AA-1 `:4999` | **순수 판정 모듈 중 화면 호출부가 0건인 export**가 몇이고 그중 계약만 초록인 것이 몇인가 | 모바일 `export function` **867 중 15** · 어드민 `src/lib` **146 중 2** = **열일곱**, ⚠️ **열일곱 다 테스트 참조가 있다**(전부 "계약만 초록") · ⚠️ **이유가 소스에 적힌 것은 둘** (아래 3) | ⚠️ **예 → 트랙 E**(기계로 닫는다 · 오늘 사용자에게 보이는 결함은 0건) |
   | 2 | AA-2 `:5031` | **두 화면이 같은 모양의 UI를 각자 조립하는 자리**가 몇이고 그중 둘이 이미 갈려 있는 것이 몇인가 | 어드민 전수 재실측: 라운드 86 D가 닫은 뒤 **호버로만 닿는 값이 남은 자리는 둘**이고 **한 화면·한 표**다(아래 4) · 모바일 지출 입력 두 화면은 **조립이 다르되 판정은 갈리지 않았다**(아래 9 · 기각) | ⚠️ **예 → 트랙 A** |
   | 3 | AA-3 `:5066` | 이 문서의 재개 조건 중 **그 조건의 전제를 오늘 다시 재어 본 것**이 몇인가 | 문서 전수 **재개 조건 125줄** · 그중 오늘 전제를 재실측한 것 **일곱**(이월 보류 다섯 + AA-R 둘) · ⚠️ **손이 저장소 안인 미배정 결정이 셋 남았고 그중 하나는 자기 소스가 자리를 지목해 두었다**(아래 5) | ⚠️ **예 → 트랙 B** |
   | 4 | AA-4 `:5100` | 이 저장소의 **스윕 중 자기 모집단의 사각을 값으로 적어 둔 것**이 몇인가 | 디렉터리를 걷는 스윕 **스물아홉** 중 뿌리·제외·사각을 **값으로** 적은 것 **다섯**(아래 6) · ⚠️ **적지 않은 사각 하나에 값이 앉아 있다** — 낭독 스윕 둘의 밖에 **프롭만 걸린 카드 하나**(아래 7) | ⚠️ **예 → 트랙 C** |
   | 5 | AA-5 `:5129` | K~AA절이 남긴 질문 전수 중 **아직 답해지지 않은 것**이 몇이고 그중 ①·② 결여가 몇인가 | 질문을 남긴 절 **서른하나**(등장 **서른여섯**) · **답해지지 않은 것 0** · ⚠️ **그러나 질문 자리에 답을 되짚는 줄이 있는 것은 열다섯뿐**이고 **열여섯은 답이 다른 절에 산다**(아래 8) | ⚠️ **예 → 트랙 F**(갱신 한 줄씩) |

   ⚠️ **다섯 다 발동했다.** 그리고 넷 중 **셋은 사용자·운영자가 오늘 보고 있는 자리**였다 —
   AA-5의 일반형(*"가장 싼 자산은 다음 라운드가 셀 수 있는 질문"*)이 두 번째로 참이다.

3. ⚠️ **AA-1의 답 — 호출부 0건인 export 열일곱, 이유가 적힌 것은 둘.**
   모집단을 먼저 정했다: **모바일 `apps/mobile/src/**/*.ts`(테스트·`local-backend`·`local-fixtures`
   제외)와 어드민 `apps/admin/src/lib/**`의 `export function`** 중, 제품 소스(`app/**`·`src/**`
   비테스트) 어디에서도 — **자기 파일 안까지 포함해** — 이름이 나오지 않는 것(node 스크래치).
   - **모바일 열다섯**: `analytics/client.ts:getQueuedAnalyticsEventCount`·`__resetAnalyticsClientForTests` ·
     `auth/release-build.ts:isRealUserBuild` · `consent/consent-definitions.ts:hasPendingRequiredConsents` ·
     `consent/legal-links.ts:legalDocumentUrl` · `import/bulk-run.ts:resetImportBulkRuns` ·
     `import/import-failure-messages.ts:isNamedImportFailure` · `import/preview-rows.ts:canBulkSelectImportRows` ·
     `notifications/local-devices.ts:resetLocalDevicesForTests` ·
     `notifications/notification-preferences.store.ts:notificationTypeLabel` ·
     `notifications/usePushDeviceRegistration.ts:resetPushRegistrationForTests` ·
     `offline/offline-aware-screens.ts:usesOfflineAwareLoadErrorCopy` ·
     `query/query-client-registry.ts:resetAppQueryClientRegistryForTests` ·
     `settings/destructive-flow-messages.ts:destructiveFlowFallbackMessage` ·
     `settings/support-links.ts:supportLinkUrl`.
   - **어드민 둘**: `src/lib/admin-api.ts:updateContentRevisionDraft` ·
     `src/lib/audit-log-filters.ts:hasAnyAuditLogFilter`.
   - ⚠️ **열일곱 다 테스트 참조가 있다** — 즉 **전부** 라운드 86 A가 `itemListBadgeLabel`에서 본
     그 모양(*"계약만 초록인데 아무도 부르지 않는다"*)이다.
   - ⚠️ **그런데 셋으로 갈린다.** ⓐ **이름이 자기를 고백하는 여섯**(`*ForTests`·`reset*`) ·
     ⓑ **이유가 소스에 적힌 둘** — `import-failure-messages.ts:172-179`와
     `destructive-flow-messages.ts:180-184`의 *"⚠ **테스트 전용 export**(라운드 71 리뷰 S-8) …
     **지우지 않는다**"* (⚠️ **이것이 옳은 형식이고, 열일곱 중 둘뿐이다** — ⚠️ 같은 관례가 이
     저장소에 **넷** 있는데 나머지 둘은 `export const`에 붙어 있어 오늘 모집단 밖이다) · ⓒ **아무 말 없는 아홉**.
   - ⚠️ **오늘 사용자에게 보이는 결함은 0건이다**(하나씩 판정했다): `canBulkSelectImportRows`는
     화면이 더 넓은 `canStartImportBulkRun`으로 **대체**했고(`app/import/[importJobId].tsx:1019-1026`),
     `legalDocumentUrl`·`supportLinkUrl`은 화면이 쓰는 복수형(`legalDocumentUrls`·`supportLinkUrls`)의
     단수 편의판이며, `notificationTypeLabel`은 화면이 목록(`NOTIFICATION_TYPE_OPTIONS`)을 돌아 이미
     이름을 짓는다. ⚠️ **그래서 후보 5는 "화면을 고친다"가 아니라 "이유를 값으로 적게 하는 기계"다.**
   - ⚠️ **다만 어드민 하나는 계약의 문장이 거짓에 가깝다**: `content-revisions.test.ts:19-30`은
     *"exposes the full draft → review → publish surface"* 라며 여덟 이름의 **소스 텍스트 포함**을
     단언하는데, 그중 `updateContentRevisionDraft`는 **어느 화면도 부르지 않는다**(초안을 만들고
     곧바로 제출하는 `draftAndSubmitContentRevision` 하나만 쓰인다 — `admin-api.ts:1286-1293`).
     **표면이 "있다"는 단언과 "닿는다"는 사실이 갈린 자리다**(트랙 E가 값으로 적는다).
   - ⚠️ **이 스윕의 사각을 값으로 적는다(AA-4의 규율을 태어날 때부터 적용)**: ⓐ **`export const`는
     세지 않았다** — 같은 조건으로 재면 **591 중 13**이 나오는데 그중 **열하나가 계약 전용 데이터
     모듈**(`offline-aware-screens.ts`의 대장 셋 · `shared-cache-policy.ts` 셋 · `messages.ts` 셋 ·
     `empty-period-card.ts` · `more-menu.ts`)이라 **테스트만 부르는 것이 그 모듈의 설계**다
     (`offline-aware-screens.ts:13`가 그 사실을 머리말에 적어 두었다). ⓑ **이름으로 훑으므로 흔한
     이름을 가르지 못한다**(AA-4가 이름 붙인 그 사각). ⓒ **`.tsx`의 컴포넌트 export는 모집단 밖**이다.

4. ⚠️⚠️ **AA-2의 답 — 호버로만 닿는 값이 남은 자리는 둘이고, 한 화면·한 표다.**
   어드민 전수(`app/**`·`src/**`의 `.tsx`, 테스트 제외)에서 `title=` 속성은 **넷**이다.
   - 둘(`app/analytics/page.tsx:511` · `app/clicks/page.tsx:190`)은 **라운드 86 D가 표로 도달 경로를
     만든 뒤**라 `title`이 유일 경로가 아니다(두 화면이 `analyticsTrendView` 한 모듈을 지난다).
   - ⚠️ **남은 둘이 감사 로그 표다**: `app/audit-logs/page.tsx:362`
     `<td title={entry.actorUserId ?? undefined}>` · `:366` `<td title={entry.targetId ?? undefined}>`.
     화면에 텍스트로 서는 것은 **UUID 앞 8자**뿐이고(`audit-log-filters.ts:225` `shortActorId` ·
     `page.tsx:53-56` `formatTarget`), ⚠️ **소스가 그 사실을 자백한다** — `page.tsx:52`의 주석
     *"대상 표시: target_type + 축약 id (**UUID 전체는 title 속성으로만**)"* 이고 화면 문장도
     `:379`에서 *"전체 ID는 칸에 **마우스를 올리면** 보여요"* 라고 적는다.
   ⚠️ **AA-2의 일반형이 그대로 참이다** — 그리고 이 자리는 한 칸 더 나쁘다: **그 화면의 필터가 바로
   그 값을 요구한다**(`auditLogFilterError`가 *"행위자 ID는 UUID 형식이어야 해요"* 라고 막는다).
   **표가 보여 준 것으로 그 표의 필터를 채울 수 없다**(후보 1).

5. ⚠️⚠️ **AA-3의 답 — 재개 조건 125줄 중 오늘 전제를 다시 잰 것은 일곱이고, 손이 안에 있는 미배정
   결정이 셋 남았다.**
   문서에서 *"재개 조건"* 이 나오는 줄은 **125**이고, 괄호로 형을 밝힌 것은 **사건형 26 · 결정형 2**
   (나머지는 산문 안에서 형이 갈린다 — ⚠️ **이 표기 불균형 자체가 AA-3의 다음 사각이다**).
   손이 **저장소 안**인 결정형 전수와 오늘의 처분:
   | 조건 | 사는 곳 | 손 | 오늘 |
   | --- | --- | --- | --- |
   | **온보딩 `isError && hasOptions` 창에 실패 문장이 서지 않는다** | AA-R ② `:5161-5168` | ⚠️ **안**(조항이 그렇게 적었다) | ⚠️ **집어 든다 → 트랙 B** |
   | **근거를 값으로 적는 관례(대장)** — *"어느 라운드가 세우는 날"* | Z-1 갱신 `:4845` | 안 | 집지 않는다(아래 ⓑ) |
   | **막대를 포커스 가능하게 만들 것인가**(디자인·접근성 결정) | AA-2 `:5027` | 안 | 집지 않는다 — **표가 이미 값을 텍스트로 준다**(그 결정의 값이 오늘 0) |
   | 기록 탭 검색의 분류 갈래 | Z절 `:4570` | 안 | 집지 않는다 — **약속이 오늘도 참**(재실측: `records-list-view.ts:841`의 라벨이 여전히 *"품목명, 판매처, 메모"* 이고 placeholder는 `:847`에서 파생) |
   | 준비템 분류 필수 입력 | Z-3 `:4688` | **밖**(카탈로그 정책·서버 계약) | 집지 않는다 |
   | 서버의 중복 대기 초대 방지 | AA-4 `:4911` | **밖**(서버 정책) | 집지 않는다 |
   | 감사 뷰 **대상 축** 필터 | `:4920` | **밖**(서버 DTO에 파라미터 0건) | 집지 않는다 · ⚠️ **트랙 A는 서버를 열지 않는다** |
   | 타일 안 배지(승인 디자인) | AA-1 `:4995` | **밖**(디자인 승인) | 집지 않는다 |
   | C-3 잠금 오버레이 확인 | 접근성 표 C-3 | **밖**(사람·기기·날짜) | ⚠️ **스물한 라운드 연속 미확인** |
   - ⓐ ⚠️ **AA-R ②의 전제를 다시 쟀고 오늘도 참이다** — 그리고 **그 자리를 소스가 스스로 지목한다**:
     `app/(onboarding)/prepared-items.tsx:288-292`가 *"`isError && hasOptions`에서는 실패 문장 두 줄이
     `!hasOptions` 갈래에 묶여 있어 서지 않고, 이 버튼만 목록 아래에 맥락 없이 남는다 … **다음
     라운드가 집어 들 자리로 … AA-3 갱신에 값으로 적었다**"* 라고 적어 두었다. **조건이 자기 손과
     자기 자리를 함께 적어 둔 첫 사례**이고, 그러면 그것은 조건이 아니라 **배정 대기 작업**이다.
   - ⓑ **Z-1의 대장은 오늘도 세우지 않는다.** 이유를 값으로 남긴다: 오늘 이 정찰이 세운 세 실측
     (AA-1 열일곱 · AA-2 넷 · AA-4 스물아홉)이 **전부 주석이 아니라 소스 구조에서 나왔다** — 즉
     *"주석의 근거를 세는 대장"* 보다 **호출부·모집단을 세는 기계**가 먼저 값을 냈다. 트랙 E가 그
     축의 첫 대장이고, 주석 축은 그 뒤에 세우는 것이 순서다. ⚠️ **재개 조건(결정형 · 손은 안):
     호출부 대장이 한 라운드를 살아남는 날.**
   - ⓒ **AA-R ①(연속 실패 재판정)은 이월 보류이고 상태 변화 0이다** — `use-load-error-copy.ts`의
     effect deps는 오늘도 `[isError]` 하나이고, 재개 조건(*자동 재시도가 붙는 날*)은 오지 않았다
     (⚠️ **어느 트랙도 자동 재시도·폴러를 세우지 않는다**).

6. ⚠️ **AA-4의 답(전반) — 디렉터리를 걷는 스윕은 스물아홉이고, 사각을 값으로 적은 것은 다섯이다.**
   모집단: `readdirSync`로 트리를 걸어 **모집단을 스스로 만드는** 계약(손 배열이 아니다) —
   모바일 열아홉 · 어드민 여섯 · packages 넷.
   - **사각·뿌리·제외를 값으로 적은 다섯**: `apps/mobile/src/offline/offline-aware-screens.ts`
     (배선·제외·`NON_CARD`·모듈 대장 셋 + ⚠️ **바늘이 못 보는 표기 방언 셋을 이름까지 적어 두었다**
     `:265-270`) · `packages/test-utils/src/source-contract-slice-guard.test.ts`(래칫 + 유령 방지) ·
     `packages/test-utils/src/dnc-scope-guard.ts` · `packages/test-utils/src/dnc-secret-scan.ts`
     (뿌리마다 이유 · 면제마다 증명) · `apps/admin/src/admin-load-error-copy.test.ts`
     (⚠️ **`SCREEN_SOURCE_ROOTS` + `NON_SCREEN_SOURCE_ROOTS` — "걷지 않는 뿌리와 그 이유"** `:36-56`).
   - ⚠️⚠️ **어드민의 그 다섯째가 오늘의 열쇠다.** 그 파일이 적어 둔 경위는 이렇다:
     *"라운드 73~74의 스윕은 `app/**` 하나만 걸었다. 그래서 파생 단언이 `src/**`를 **구조적으로 보지
     못했고**, 어드민에서 가장 먼저 만나는 화면(`src/components/AdminShell.tsx`)이 한 벌을 부르지 않은
     채 목록에도 면제 목록에도 없이 통과했다."* **라운드 75가 어드민에서 닫은 사각이다.**

7. ⚠️⚠️ **AA-4의 답(값) — 같은 사각이 모바일 낭독 스윕에 그대로 있고, 그 안에 값이 앉아 있다.**
   저장 실패 문장의 낭독을 묻는 계약은 둘이고, **둘 다 모집단이 `src/**`를 보지 않는다**:
   - ⓐ **라운드 79 스윕**(`src/a11y-contract.test.ts:3442-3449`) — 모집단은 대장
     `OFFLINE_AWARE_SAVE_ERROR_SCREENS`이고, 오늘 그 대장은 **화면 다섯**이다(`app/budget.tsx` ·
     `app/family/accept/[token].tsx` · `app/family/invite.tsx` · `app/settings/children.tsx` ·
     `app/settings/notifications.tsx`). **온보딩 화면은 그 대장에 없다** — 온보딩의 실패 문구는
     **모듈**(`src/onboarding/step-ui.tsx`)이 지므로 화면 대장이 아니라 모듈 대장
     (`OFFLINE_AWARE_FAILURE_COPY_MODULES`)에 있고, **그 모듈 대장은 문구의 정직성만 묻고 낭독은
     묻지 않는다.**
   - ⓑ **라운드 80 스윕**(`a11y-contract.test.ts:4498-4530`) — 모집단은
     `listRouteSources()`(`:3807-3811`)이고 주석이 *"`app/**`의 라우트 소스 전수"* 라고 적는다.
     화면별 표(`MUTATION_TRIGGER_SITES_BY_SCREEN` `:4449-4463`)에 **`app/(onboarding)/**`가 0건**이다 —
     세 온보딩 화면은 실패 카드를 **컴포넌트 태그 하나**로 그리므로 스캐너가 문장을 보지 못한다.
   - ⚠️⚠️ **그래서 두 스윕의 부정 단언이 오늘 거짓이다.** 둘 다
     *"프롭만 걸려 안드로이드에서만 읽히는 자리 0건"*(`androidOnly.sort()).toEqual([])`)을 단언하는데,
     `src/onboarding/step-ui.tsx:275`의 `OnboardingSaveErrorCard`는
     `<View accessibilityLiveRegion="polite" accessibilityRole="alert">` **프롭 둘만** 갖고
     `announceForA11y`가 **0건**이다(파일 전수 grep). 이 저장소 자신의 분류로 그것은 `live-region` —
     **안드로이드 한정**이고, 그 이유가 `a11y-contract.test.ts:3162-3165`에 값으로 적혀 있다:
     *"`accessibilityLiveRegion`은 @platform android 프롭이고 … **프롭 조합만으로는 iOS에서 아무
     소리도 나지 않는다.** 크로스플랫폼 출구는 `announceForA11y`."*
   - ⚠️ **저장소는 이 자리를 알고 있었다.** `ROUND79_ANNOUNCE_PROPS_ADDED`(`:3431-3437`)에 이 파일이
     여섯째 항목으로 서 있고 설명이 *"OnboardingSaveErrorCard — … (**모듈 층의 한 자리**)"* 다.
     **프롭은 걸었는데 출구 분류는 어느 스윕도 하지 않았다** — 대장에 이름이 있다는 사실이 오히려
     *"이 자리는 세어졌다"* 로 읽혔다(라운드 86 A가 `itemListBadgeLabel`에서 본 그 착시).
   - **도달 경로는 실재한다**: ONB-002·003·004의 저장 실패가 이 카드를 세운다
     (`app/(onboarding)/child-profile.tsx:342` · `prepared-items.tsx:256` · `budget.tsx:148`) —
     **앱의 첫 여정이고, 그 카드가 iOS에서 소리로 나가지 않는다**(후보 3).
   - ⚠️ **본보기는 같은 저장소에 있다**(AA-2의 둘째 규율): `app/(auth)/login.tsx:146-150`이
     `useEffect(() => { if (loginError) announceForA11y(loginError); }, [loginError])`로 같은 문제를
     이미 푼다.

8. ⚠️ **AA-5의 답 — 질문은 전부 답해졌고, 답을 되짚는 줄이 없는 것이 열여섯이다.**
   *"다음 라운드가 먼저 세어 볼 만한 것"* 은 known-limitations에 **서른여섯 번** 나오고 **서른한 절**에
   걸쳐 있다. ⚠️ **이 수를 처음 잴 때 여덟을 놓쳤다** — 그 문장이 줄바꿈으로 갈려
   (`다음 라운드가 먼저\n  세어 볼 만한 것`) 한 줄 grep이 **28**만 셌다. **정찰 자신의 스윕에도
   구조적 사각이 있었고, 그 사각에 Z-1과 AA-2가 앉아 있었다** — AA-4의 일반형이 오늘 세 번째로 참이다
   (이 사실을 값으로 남긴다).
   - **답해지지 않은 것 0**: R-6~W-5는 그 자리에 `⚠️ **갱신 (…)`이 붙어 있고(**열다섯**),
     X-1~X-5는 라운드 84가 · Y-1~Y-5는 라운드 85가 · Z-1~Z-5는 라운드 86이 · AA-1~AA-4는 오늘
     **각 라운드의 절 안 표**에서 답했다.
   - ⚠️ **그런데 그 열여섯(X·Y·Z·AA)에는 질문 자리에 답을 되짚는 줄이 없다.** 질문만 읽는 사람은
     *"아직 아무도 안 셌다"* 로 읽고 다시 센다. **비용은 한 줄이고 수확은 라운드 하나**다 —
     트랙 F가 **갱신 한 줄씩** 붙인다(판정을 다시 쓰지 않는다 · 라운드 86 F의 그 형식 그대로).

9. **미개척 표면 여섯을 훑었고 다섯은 값이 0이었다**(기각을 값으로 · 각각 재개 조건과 함께).
   - ⚠️ **지출 입력 두 화면의 조립이 갈렸는가 — 재었고 갈리지 않았다(핵심 루프 1단계).**
     `app/expenses/new.tsx`와 `app/expenses/[expenseId].tsx`는 한국어 리터럴 **열하나**를 함께 들고
     있어 AA-2의 모집단에 들어왔다. 재어 보니 **조립만 다르고 판정은 같다**: 새 기록은 묶음 헬퍼
     (`isAmountOverLimitForSave`·`hasExpenseTextOverLimit`·`textOverLimitNotices`)로 **저장 버튼 위
     한 줄**을 세우고, 수정은 같은 모듈의 단품(`isAmountOverLimit`·`amountOverLimitMessage`·
     `isItemNameOverLimit`·`isMerchantOverLimit`·`isMemoOverLimit`)으로 **칸 옆 인라인 오류**를
     세운다(`[expenseId].tsx:532-580`). **두 화면 다 상한·0 이하·날짜·정수 넷을 막고 버튼을 잠근다** —
     ⚠️ 게다가 `new.tsx:2325-2333`의 주석이 *"같은 문장이 화면마다 다른 색으로 서 있었다"* 를 라운드
     57 QA가 이미 통일했다고 적는다. **갈린 자리를 찾지 못했다.**
     ⚠️ **재개 조건(사건형): 어느 한쪽에 새 저장 가드가 서는 날**(그날 반대쪽에 같은 축이 있는지를
     그 트랙이 함께 센다).
   - **감사 뷰 CSV — 재었고 제안하지 않는다.** `audit-log-csv.ts:16-28`의 열 열하나에 `actorUserId`·
     `targetId`·`householdId`가 **전부** 실려 있고 수식 인젝션 중화·RFC-4180까지 지난다. 즉 전체 ID의
     도달 경로가 아예 없는 것은 아니다 — ⚠️ **다만 그것은 파일 한 벌을 내려받는 길이고, 화면 위에서
     행 하나를 되짚는 길이 아니다**(후보 1이 여는 것은 후자다). ⚠️ **`householdId`는 CSV에는 있고
     표에는 열이 없다** — 이 축은 **서버 필터가 없어** 오늘 값이 0이다(위 5의 결정형 · 손은 밖).
   - **콘텐츠 리비전 편집 표면 — 재었고 제안하지 않는다.** `updateContentRevisionDraft`가 호출부
     0건인 것은 **초안을 고치는 화면이 없기 때문**이고, 반려(`rejectContentRevision`)받은 편집자는
     원래 화면에서 다시 저장해 새 초안을 만든다(`draftAndSubmitContentRevision`). 흐름이 닫혀 있다.
     ⚠️ **재개 조건(사건형): 검수 화면에서 초안 본문을 고치는 요구가 실제로 서는 날** —
     ⚠️ 그때까지는 **계약의 문장이 "닿는다"고 오해되지 않게 하는 것**만 값이다(트랙 E).
   - **어드민 손 미러 — 재었고 갈린 것 0건.** `admin-canonical-mirrors.test.ts`가 정본을 소스로
     읽어 대조하고 있고, 면제 둘(`AUDIT_LOG_CSV_COLUMNS`·`AUDIT_LOG_ACTION_PRESETS`)에는 이유가
     값으로 있다. ⚠️ **재개 조건(사건형): 새 손 미러가 서는 날** — ⚠️ **트랙 A의 금지 조항이
     "새 손 미러 0건"을 진다.**
   - **CSV 내보내기(모바일)·설정 화면 — 이월 판정 그대로.** `SYNC_STATUS_RETRY_ALL_LABEL` 사문은
     오늘도 화면 참조 0건이고(재실측), 재개 조건(*준비템 상태 큐까지 다루는 일괄 액션이 서는 날*)은
     오지 않았다. ⚠️ **트랙 E의 모집단이 `export function`이라 이 상수는 그 대장의 밖이고, 그 사실이
     E의 사각 칸에 값으로 적힌다.**
   - **api 응답 크기 · 별칭 검색 · 매칭 사유 — 이월 판정 그대로**(각 아래 P3).

10. ⚠️ **후보 4의 근거는 저장소 전수 한 번으로 나왔다.**
    `app/**`·`src/**`(비테스트)에서 낭독 라벨을 **템플릿 리터럴로 만드는 자리는 마흔여섯**이고, 그중
    **목록 행의 컨트롤**에 붙은 것들은 예외 없이 **행마다 갈리는 값**을 끼운다 —
    `member.displayName`(`app/family/index.tsx:617`) · `pendingInviteTarget(roleLabel, createdAtLabel)`
    (`:664` — 라운드 86 C가 세운 그 값) · `child.nickname`(`app/settings/children.tsx:740`) ·
    `template.itemName`(`app/expenses/recurring.tsx:529·557·566`) · `item.name`
    (`app/(tabs)/items.tsx:1109·1114`).
    ⚠️ **딱 하나가 다르다**: `app/settings/notifications.tsx:334`의
    `` accessibilityLabel={`${platformLabel(device.platform)} 알림`} `` — 끼운 값이 **기기별이 아니라
    플랫폼별**이라(`platformLabel`은 `:64-68`에서 `"iPhone · iOS"`·`"Android 기기"` 둘만 돌려준다)
    **안드로이드 기기 둘을 등록한 사람에게 두 스위치가 글자 하나 다르지 않게 들린다**(후보 4).
    ⚠️ **`src/ui.tsx:697·704`의 `${seller}에서 구매하기` 둘은 이 판정 밖이다** — 준비템 판매처 1:1과
    구매 확인 판매처 라벨은 **영구 기각**이고, 이 줄은 제안이 아니라 제외 확인이다.

11. **이월 보류는 오늘도 상태 변화 0이다. 재론하지 않는다(각 한 줄 · 전부 재실측).**
    ⓐ **쿼리 방아쇠 자리 열하나** — `a11y-contract.test.ts`의 `QUERY_TRIGGER_SITES_BY_SCREEN` 합이
    오늘도 **11**(화면 여섯). **A-20 #85 선행, 보류 유지.** ⚠️ **트랙 C가 이 파일을 열지만 그 표는
    바이트 불변이 금지 조항이다.**
    ⓑ **`monthly_wrapup`의 달 이동 구멍** — 보류 유지이고 ⚠️ **어느 트랙도 `src/notifications/**`를
    쓰기로 열지 않는다**(⚠️ **트랙 D가 `src/notifications/` 아래에 파생 모듈 하나를 신설하지만
    알림 생성·게이트 파일은 무접촉이다** — 아래 트랙 표의 소유를 보라).
    ⓒ **`/budget` 겹침** — `route-surface.test.ts:187`의 `URL_OVERLAPS`가 오늘도 **둘**(`/`·`/budget`) —
    **실기기 #133 대기 · 라우트 표면 무접촉.**
    ⓓ **S-3(어드민 `disabled`)** — `disabled={readOnly}`는 오늘도 `app/items/page.tsx` **6** ·
    `app/links/page.tsx` **5** = **열하나**. 브라우저 확인 #130 선행이고 ⚠️ **트랙 A의 소유는
    `app/audit-logs/page.tsx` 하나라 그 두 파일은 이번에도 접점 0건이다**(두 라운드 연속).
    ⓔ **`withdrawn_at`** — 그 컬럼 이름이 나오는 자리는 오늘도 **셋 · 파일 둘**이고 셋 다 *"그 컬럼이
    없다"* 를 말한다. **마이그레이션 0건 원칙 · 별도 결정 유지** — ⚠️ **어느 트랙도 `apps/api/src`·
    `prisma/`를 쓰기로 열지 않는다.**

12. **별칭 검색 · placeholder 문구 · 검색 결과 매칭 사유 — 셋 다 디자인 승인 선행이고 변화 0.**
    `ItemSummary`·`PreparationParityItem`·`itemTemplateSeeds` 어디에도 별칭 필드가 없다(재실측 0건).
    ⚠️ **트랙 D가 기기 줄에 한 조각을 더하지만 그것은 별칭이 아니라 오늘 응답에 실재하는 필드다.**

13. **시드의 네 수를 재실측했다**(node 스크래치): `itemTemplateSeeds` **62** · `productLinkSeeds` **67** ·
    `categorySeeds` **12** · `affiliatePartnerCode` non-null **0건** · 제휴 **19** · 스폰서 **5**.
    ⚠️ **N-4의 두 문턱(200 / 100)은 오늘도 미발동이고, 준비템 탭 비가상화는 이번에도 제안하지 않는다
    (10라운드 연속).**

14. ⚠️ **api vitest는 이번 라운드도 돌리지 않았다**(정찰에 불필요 · 지시로 금지). 다섯 후보의 근거는
    전부 **소스·시드·문서와 순수 계산**에서 나왔다(node 스크래치 재현).
    ⚠️ **후보 1~4는 서버 코드를 한 줄도 필요로 하지 않는다** — 넷 다 화면이 **이미 손에 든 값**을 쓴다
    (`entry.actorUserId`·`itemsQuery.isError`·`onboardingSaveErrorMessage`의 결과 문자열 ·
    `UserDeviceSummary.osVersion`은 앱이 **자기가 등록한** 값이다 —
    `usePushDeviceRegistration.ts:118-119` → `devices.controller.ts:55-56`). **후보 5는 읽기만 하는 스윕이다.**

## 상위 후보

### 1. **감사 로그 표가 운영자에게 필요한 값을 마우스에만 준다 — 그리고 그 값을 요구하는 필터가 같은 화면에 있다** — 어드민·운영 — M

- **근거**: 여섯이 한 줄로 이어진다(축 — *한 층에서 닫은 규율이 옆 층에서는 세어지지 않는다*).
  - ⓐ **값이 어디 있나.** 행위자 칸은 `사용자(3f2a91c4)` 꼴로 **앞 8자**만 그리고
    (`audit-log-filters.ts:237-242` → `:225` `shortActorId`), 대상 칸은 `target_type · 3f2a91c4…`
    꼴이다(`page.tsx:53-56`). **전체 UUID는 `<td title=…>` 속성 하나뿐**이다(`:362`·`:366`).
  - ⓑ ⚠️⚠️ **그래서 마우스가 없는 사람에게 이 표의 식별자는 존재하지 않는다.** `title`은 호버로만
    뜨고, `<td>`는 포커스를 받지 않는다. 화면 문장이 그 사실을 그대로 말한다 — `:379`
    *"전체 ID는 칸에 **마우스를 올리면** 보여요"*. ⚠️ **화면이 자기 도달 경로의 한계를 문장으로
    자백하고 있는데 어느 단언도 그것을 묻지 않는다**(라운드 86 D가 분석 화면에서 만난 그 모양).
  - ⓒ ⚠️⚠️ **한 칸 더 나쁘다 — 그 값을 요구하는 필터가 같은 화면에 있다.** 행위자 필터는
    **완전한 UUID**를 요구하고(`auditLogFilterError`가 *"행위자 ID는 UUID 형식이어야 해요.
    사용자 조회 화면의 '이 사용자 감사 로그 보기'로 들어오면 자동으로 채워져요."* 로 막는다),
    그 안내가 가리키는 길은 **다른 화면**(`app/users-lookup/page.tsx:210`)이다. 즉 **표에서 수상한
    행을 발견한 운영자가 "이 행위자의 다른 로그"로 가는 길이 이 화면에는 없다** — CS 문의를 이
    화면에서 확인하라고 머리말이 말하는데(`:236-239`), 되짚는 걸음이 끊긴다.
  - ⓓ ⚠️ **옳은 형식은 같은 저장소에 이미 있다**(AA-2의 둘째 규율). 그 링크를 만드는 순수 함수가
    **이미 있고 이미 쓰인다** — `audit-log-filters.ts:124` `auditLogsHrefForActor(actorUserId)`가
    `/audit-logs?actorUserId=…`를 만들고 사용자 조회 화면이 그것을 쓴다. 그리고 표 안에서 긴 값을
    펼치는 관례도 이미 있다 — 같은 행의 `상세` 칸이 `<details><summary>변경 내용 보기</summary>`로
    스냅샷 JSON을 펼친다(`page.tsx:64-80`).
  - ⓔ ⚠️⚠️ **그리고 0건 문장이 조건을 지어낸다.** `:344`는 언제나
    *"조건에 맞는 기록이 없어요."* 라고 적는데, **필터가 하나도 없을 때도 같은 문장**이다 —
    필터를 걸지 않은 운영자에게 *"당신의 조건이 걸렀다"* 고 말한다. ⚠️ **그 둘을 가르는 판정은
    이미 있고, 호출부가 0건이다**: `audit-log-filters.ts:101` `hasAnyAuditLogFilter`
    (선행 확인 3의 열일곱 중 하나 — **AA-1이 되살리라고 한 바로 그 모양**).
  - ⓕ **서버는 한 줄도 필요 없다.** `actorUserId`·`targetId`는 응답에 이미 있고 CSV에도 이미 실린다
    (`audit-log-csv.ts:16-28`). 새 파라미터·새 요청 0건.
- **최소안**: 순수 모듈 하나(`audit-log-rows.ts`)가 ⓐ 행의 **전체 식별자 텍스트**와 ⓑ 그 행위자로
  가는 **href**와 ⓒ **0건 문장 두 갈래**를 만들고, 표가 그것을 그린다. 새 형식 0건 — 긴 값은 같은
  행이 이미 쓰는 `<details>` 관례로, 링크는 이미 있는 헬퍼로, 문장은 두 문장 중 하나로.
- **크기**: 신설 모듈 하나 + 표 두 칸 + 문장 한 갈래 + 힌트 한 줄 정정.

### 2. **온보딩 준비물 화면에서 목록이 뜬 뒤 다시 불러오기가 실패하면, 맥락 없는 버튼만 남는다 — 그리고 그 결정의 손은 저장소 안에 있다고 문서가 이미 적어 두었다** — 모바일·온보딩 — S

- **근거**: 다섯이 한 줄로 이어진다(축 — *결정형 조건 중 손이 안에 있는 것은 배정 대기 작업이다*).
  - ⓐ **오늘의 모습.** 조회 실패 문장 두 줄(공용 문장 + 화면 고유 안내)이 `!isLoadingOptions &&
    !hasOptions` 갈래 **안에** 묶여 있다(`app/(onboarding)/prepared-items.tsx:189-202`). 그래서
    **목록이 한 번 뜬 뒤** 다시 불러오기가 실패한 창(`isError && hasOptions`)에서는 그 두 줄이 서지
    않고, `:295-301`의 `[목록 다시 불러오기]`만 화면 맨 아래에 **맥락 없이** 남는다.
  - ⓑ ⚠️ **그 창은 실재한다.** 버튼을 눌러 재조회가 실패하면 react-query는 앞의 `data`를 유지하므로
    `options.length > 0`이 그대로다 — **즉 사용자가 버튼을 누를 때마다 들어가는 창**이고, 두 번째
    실패부터는 화면이 아무 말도 하지 않는다.
  - ⓒ ⚠️⚠️ **이것은 라운드 86 B의 회귀가 아니다** — 그 라운드 전에도 버튼은 그 자리에 있었고 문장
    쪽은 아예 없었다. ⚠️ **그리고 그 라운드가 이 자리를 자기 소스에 값으로 적어 두었다**
    (`:288-292`): *"실패 문장 두 줄이 `!hasOptions` 갈래에 묶여 있어 서지 않고, 이 버튼만 목록 아래에
    맥락 없이 남는다 … 다음 라운드가 집어 들 자리로 `known-limitations.md` AA-3 갱신에 값으로 적었다."*
    문서 쪽에도 같은 문장이 **재개 조건(결정형 · 손은 저장소 안)** 으로 서 있다(`:5161-5168`).
  - ⓓ ⚠️ **AA-3의 규율대로라면 이것은 기다릴 조건이 아니다.** 손이 안에 있는 조건은 **미배정 작업**
    이고, AA-3은 *"배정되지 않은 채 오래 서 있으면 그 조건의 전제까지 함께 낡는다"* 고 적었다 —
    라운드 86 B가 집어 든 조건은 전제 셋 중 둘이 이미 거짓이었다. **오늘 그 전제를 다시 쟀고 아직
    참이다**(위 선행 확인 5ⓐ) — **참일 때 집는 것이 싸다.**
  - ⓔ **얹되 지우지 않는 규율은 그대로 지켜진다.** 0건 갈래(*"지금 시기에 보여드릴 준비물이 아직
    없어요…"*)는 실패가 아니므로 **한 글자도 바뀌지 않고**, 화면 고유의 건너뛰기 안내도 후퇴하지
    않는다. 바뀌는 것은 **그 두 줄이 서는 조건 하나**다.
- **최소안**: 실패 문장 두 줄을 `itemsQuery.isError` **하나의 조건 아래로** 옮기고(목록이 있든
  없든 선다), 0건 문장은 `!isLoadingOptions && !hasOptions && !itemsQuery.isError`로 좁힌다.
  **새 문장 0건 · 새 쿼리 0건 · 버튼 자리 바이트 불변**(그 짝의 거리 문제는 기기 확인 #153 ⓑ의 몫이고
  이 트랙은 그것을 옮기지 않는다).
- **크기**: 화면 한 갈래의 조건 이동 + 대장 스윕의 갈래 단언 갱신.

### 3. **온보딩 저장 실패 카드가 iOS에서 소리로 나가지 않는다 — 그리고 두 낭독 스윕이 그 자리를 구조적으로 보지 못한 채 "0건"을 단언한다** — 모바일·온보딩·접근성 — M

- **근거**: 여섯이 한 줄로 이어진다(축 — *스윕의 사각에 값이 앉아 있다 · AA-4*).
  - ⓐ **무엇이 조용한가.** `src/onboarding/step-ui.tsx:254-306`의 `OnboardingSaveErrorCard`는
    `<View accessibilityLiveRegion="polite" accessibilityRole="alert">` **프롭 둘만** 걸고
    `announceForA11y`는 **파일 전수 0건**이다.
  - ⓑ ⚠️ **이 저장소의 판정으로 그것은 반쪽이다.** `a11y-contract.test.ts:3162-3165`가 값으로 적어
    두었다 — *"`accessibilityLiveRegion`은 @platform android 프롭이고 `accessibilityRole="alert"`에
    대응하는 VoiceOver 트레이트가 없다 — **프롭 조합만으로는 iOS에서 아무 소리도 나지 않는다.**"*
    출구 분류로 `live-region`이고, 그 칸의 뜻이 **안드로이드 한정**이다.
  - ⓒ ⚠️⚠️ **그런데 두 스윕이 *"그런 자리 0건"* 을 단언한다.** 라운드 79 스윕(`:3442-3449`)의
    모집단은 대장 `OFFLINE_AWARE_SAVE_ERROR_SCREENS`(**화면 다섯** · 온보딩 없음)이고, 라운드 80
    스윕(`:4498-4530`)의 모집단은 `listRouteSources()` = **`app/**` 전수**다. **온보딩 실패 문장은
    화면이 아니라 모듈에 살아서 둘 다의 밖이다** — 세 화면은 실패를 **컴포넌트 태그 하나**로 그린다.
  - ⓓ ⚠️⚠️ **그리고 대장에 이름이 있다는 사실이 그것을 감췄다.** `ROUND79_ANNOUNCE_PROPS_ADDED`
    (`:3431-3437`)의 여섯째 항목이 바로 이 파일이고 설명이 *"OnboardingSaveErrorCard — … (**모듈 층의
    한 자리**)"* 다. **프롭을 건 사실은 값으로 있고, 그 프롭이 반쪽이라는 판정은 어디에도 없다.**
  - ⓔ ⚠️ **같은 사각을 어드민은 라운드 75에 이미 닫았다.** `admin-load-error-copy.test.ts:36-56`이
    `SCREEN_SOURCE_ROOTS = ["app", "src/components"]`와 **걷지 않는 뿌리와 그 이유**를 값으로 들고,
    머리말이 *"`app/**` 하나만 걸어서 `src/**`를 **구조적으로 보지 못했다**"* 고 적는다.
    **한쪽 앱에만 있는 규율이다**(Y-3이 이름 붙인 그 축).
  - ⓕ **본보기도 같은 저장소에 있다.** `app/(auth)/login.tsx:146-150`이 `useEffect` +
    `announceForA11y(loginError)`로 같은 조건(눌린 버튼 아래에 서는 실패 카드)을 이미 푼다.
- **최소안**: 카드가 **자기 문장을 effect에서 한 번 낭독**한다(프롭 둘은 그대로 · 렌더 도중이 아니라
  effect 안 · 의존은 그 문장). 그리고 낭독 스윕에 **모듈 층 뿌리**를 값으로 세워 — 어드민의 그 형식
  그대로 *"걷는 뿌리 · 걷지 않는 뿌리와 이유"* — 이 자리가 다음부터 자동으로 질문을 받게 한다.
- **크기**: 컴포넌트에 effect 하나 + import 한 이름 + 스윕에 뿌리 한 벌.

### 4. **같은 플랫폼 기기 둘의 알림 스위치가 소리로 구별되지 않는다 — 그리고 그것을 가를 값을 앱이 자기 손으로 서버에 올려놓고 쓰지 않는다** — 모바일·설정 — S

- **근거**: 다섯이 한 줄로 이어진다(축 — *라운드 86 C가 가족 화면에서 닫은 규율의 마지막 자리*).
  - ⓐ **오늘의 라벨.** `app/settings/notifications.tsx:334`의 스위치 라벨은
    `` `${platformLabel(device.platform)} 알림` `` 이고, `platformLabel`(`:64-68`)이 돌려주는 것은
    `"iPhone · iOS"`·`"Android 기기"` **둘뿐**이다. **안드로이드 기기 둘을 등록한 사람에게 두 스위치가
    글자 하나 다르지 않게 들린다** — 그 스위치는 **되돌릴 수 있지만** 어느 기기의 알림을 껐는지
    화면이 말하지 않는다.
  - ⓑ ⚠️ **저장소 전수에서 이 모양은 하나 남았다**(선행 확인 10). 목록 행 컨트롤의 낭독 라벨 마흔여섯
    자리 중 **행마다 갈리지 않는 값을 끼운 것은 이 하나**이고, 나머지는 전부 이름·닉네임·품목명 —
    ⚠️ **그중 하나가 라운드 86 C가 만든 `pendingInviteTarget(roleLabel, createdAtLabel)`이다.**
    **같은 규율의 마지막 자리다.**
  - ⓒ ⚠️⚠️ **가를 값은 이미 손에 있다.** `UserDeviceSummary`(`src/api/client.ts:1573-1581`)는
    `appVersion`·`osVersion`을 싣고, 그 값은 **앱이 자기 손으로 올린 것**이다
    (`usePushDeviceRegistration.ts:118-119` → `devices.controller.ts:55-56`·`:112-113`). 화면은
    `platform`·`notificationEnabled`·`updatedAt` 셋만 쓴다.
  - ⓓ ⚠️ **그리고 이 둘은 라운드 86의 응답 필드 스윕에 잡히지 않았다** — 같은 이름이
    `RegisterDeviceBody`(`:1584-1592`)에도 있어서 *"화면이 쓰고 있다"* 로 분류됐다. **AA-4가 이름 붙인
    그 사각에 앉아 있던 둘**이고, 그 사각을 알고 다시 재니 값이 나왔다.
  - ⓔ ⚠️ **지어내지 않을 자리도 실재한다**: 마스터 토글이 만드는 등록 경로
    (`app/settings/notifications.tsx:112-117`의 `registerDevice`)는 `appVersion`·`osVersion`을 **보내지
    않는다** — 그 경로로 만들어진 행은 두 값이 `null`이다. **없으면 그 조각을 그리지 않는다**
    (라운드 86 C의 `createdAt` 부재 처리와 같은 규율).
- **최소안**: 순수 함수 하나가 기기 한 대의 **구별 문구**(플랫폼 + 있으면 OS 버전, 그리고 *이 기기*
  여부)를 만들고, **행 제목과 스위치 라벨이 그 한 값을 함께 읽는다**(두 문장이 갈릴 자리를 만들지
  않는다 — 라운드 51 P2-3의 규율). 값이 없으면 종전 문자열 그대로다.
- **크기**: 파생 모듈 하나 + 행 한 줄 + 라벨 한 줄.

### 5. **호출부가 0건인 판정이 열일곱인데 이유가 적힌 것은 둘이다 — "지우지 않는다"는 관례가 저장소에 이미 있는데 세는 자리가 없다** — 계약·전 저장소 — M

- **근거**: 다섯이 한 줄로 이어진다(축 — *AA-1의 질문을 산문이 아니라 기계로 닫는다*).
  - ⓐ **수는 위에 있다**(선행 확인 3): 모바일 **867 중 15** · 어드민 `src/lib` **146 중 2** =
    **열일곱**이고 **열일곱 다 테스트만 부른다.**
  - ⓑ ⚠️ **옳은 형식은 이미 있고 둘뿐이다.** `import/import-failure-messages.ts:172-179`와
    `settings/destructive-flow-messages.ts:180-184`가 *"⚠ **테스트 전용 export**(라운드 71 리뷰 S-8).
    화면은 … 부르지 않는다. **지우지 않는다** — …"* 라고 **이유와 함께** 적는다. 나머지 열다섯 중
    여섯은 이름이 자기를 고백하고(`*ForTests`), **아홉은 아무 말이 없다.**
  - ⓒ ⚠️⚠️ **이 저장소는 같은 자리에서 두 번 데었다.** 라운드 69 E는 참조 0건인 `__reset…ForTests`를
    *"테스트가 이 상태를 초기화한다는 거짓말"* 이라며 걷었고(그 사실이
    `src/onboarding/step-ui.tsx:319-321`에 적혀 있다), 라운드 86 A는 `itemListBadgeLabel`을 같은
    이유로 걷었다. **두 번 다 정찰이 손으로 찾았고, 두 번 다 세는 자리는 생기지 않았다.**
  - ⓓ ⚠️ **어드민 하나는 계약의 문장이 사실보다 넓다**: `content-revisions.test.ts:19-30`이
    *"the full draft → review → publish surface"* 라며 여덟 이름의 **소스 텍스트 포함**만 단언하는데,
    `updateContentRevisionDraft`는 어느 화면도 부르지 않는다. **"있다"와 "닿는다"가 갈렸다.**
  - ⓔ **모집단을 먼저, 바늘은 그다음**(대장 자신의 경고). `export const`를 같은 조건으로 재면 **591 중
    13**인데 그중 **열하나가 계약 전용 데이터 모듈**이라(설계상 테스트만 부른다 —
    `offline-aware-screens.ts:13`가 그렇게 적는다) 같은 잣대를 대면 **첫날부터 면제부**가 된다.
    ⚠️ **그래서 오늘의 모집단은 `export function` 하나이고, 나머지 축은 사각으로 적는다.**
- **최소안**: `packages/test-utils`에 **호출부 0건 대장**을 세운다 — 뿌리(모집단)와 그 이유, 항목마다
  *"왜 남아 있는가"*, 그리고 **래칫**(항목 수는 늘지 않는다). 새 항목이 생기면 두 답 중 하나를
  **값으로** 고르게 된다: 지우거나, 이유를 적거나. **제품 소스 0건 수정**(스윕은 읽기만 한다).
- **크기**: 신설 모듈 하나 + 신설 계약 하나(라운드 85 E·86 E와 같은 형식).

## P3

- **이월 다섯(U절 셋 · S-3 · `withdrawn_at`) — 전부 재실측했고 상태 변화 0**(선행 확인 11).
  ⚠️ **S-3의 두 파일은 이번에도 어느 트랙도 열지 않는다**(세 라운드 연속 접점 0건).
- **AA-R ① 연속 실패 재판정 — 재실측했고 재개 조건 미도래**(`use-load-error-copy.ts`의 deps는 오늘도
  `[isError]` 하나 · **자동 재시도 0건**). ⚠️ **어느 트랙도 폴러·자동 재시도를 세우지 않는다.**
- **별칭 검색 · placeholder 문구 · 매칭 사유 — 디자인 승인 선행, 변화 0**(선행 확인 12).
- **L-11 진짜 동치 · `PreparedItemsDto` 상한 — 별도 결정 유지, 오늘 새로 잰 것 없음.**
- **가격 표시(잠금) — 후보 넷 어디에도 가격·링크 수가 들어가지 않는다**(명시).
- **기록 탭 검색의 분류 갈래 — 결정형 조건이 오늘도 도래하지 않았고 집지 않는다.** 재실측:
  `RECORDS_SEARCH_FIELDS_LABEL`은 여전히 *"품목명, 판매처, 메모"* 하나이고 placeholder가 그 값에서
  파생한다(`records-list-view.ts:841·847`) — **약속이 참이라 고칠 어긋남이 없다.**
- **Z-1의 "근거 대장" — 결정형이고 손은 안이지만 오늘 집지 않는다.** 이유를 값으로 남긴다: 오늘의
  세 실측이 전부 **소스 구조**에서 나왔고 주석 축은 그보다 뒤다. ⚠️ **재개 조건(결정형 · 손은 안):
  트랙 E의 호출부 대장이 한 라운드를 살아남는 날.**
- **막대 포커스 가능화(AA-2 `:5027`) — 재었고 값이 0이다.** 라운드 86 D의 표가 이미 값을 텍스트로
  주므로 새 상호작용 표면은 값이 아니다. ⚠️ **재개 조건(결정형 · 손은 안): 표로 닿지 못하는 값이
  차트에 생기는 날.**
- **감사 뷰 대상(targetType·targetId) 필터 · 서버 중복 초대 방지 · 카탈로그 분류 필수 입력 ·
  타일 안 배지 — 넷 다 손이 저장소 밖이라 집지 않는다**(선행 확인 5의 표).
- **지출 입력 두 화면의 조립 · 감사 CSV · 콘텐츠 리비전 편집 표면 · 어드민 손 미러 ·
  `SYNC_STATUS_RETRY_ALL_LABEL` — 다섯 다 재었고 제안하지 않는다**(선행 확인 9 · 전부 재개 조건과 함께).
- **성능 넷 — 재실측했고 넷 다 미도래.** 첫 페인트(⚠️ **어느 트랙도 `useQuery` 선언을 더하지 않는다**) ·
  렌더 비용(활성 카탈로그 **62** · N-4 문턱 200 미도래) · 번들(⚠️ **새 의존성 0건 · 트랙 넷 다 기존
  import만 쓴다**) · api 루프(⚠️ **`apps/api/**` 쓰기 0건**).
- **`PURCHASE_FOLLOWUP_MERCHANT_LABELS` 미실행 · CSV 왕복 다섯 열 손실 · `refund` 생성 불가 ·
  `link_health`의 `errors` 카운터 · 서버 알림 층 · 홈의 손 폴 다섯 · 공유 카드 왕복 · 어드민 카탈로그
  전량 조회 · M-3 잔여 · `ApplicationPrimitives.tsx` 정규식 제목 판정 · 미출처 틴트 둘 ·
  `itemMatchesBand` 사문 · 첫돌 이후 마일스톤 고착 · `AuthService.refresh`의 `user.status` ·
  api 하네스 동시 실행 구멍 · 서버 중복 아이 가드 부재 · 발행 `before` 경합 · 크래시 파이프라인 부재 ·
  서버 stdout 두 로그 형식(O-1) · `Share.share`의 catch 없는 `void` 둘 · 결제 수단 기본값** —
  라운드 62~86이 남긴 그대로이고 **상태 변화 0.**
- **제외 목록 준수 확인**: 준비템 목록 **가격 표시**(잠금) · 오프라인 로컬 아이 복구 · 외부 계정/키/자산 ·
  **C-3 잠금 오버레이 낭독**(오늘로 **스물한 라운드 연속** 미확인) · **P-2 법무 대조** ·
  P-3 테스트 건수 자동화 · **표기 방언 통일**(⚠️ 선행 확인 6의 *"시도해주세요"* 셋은 제안이 아니라
  스윕이 이미 적어 둔 사각의 인용이다) · S-4 파기 `targetId` · 40주 초과 달력 ·
  `onBudgetRelevantChange` · 4가구/`viewedHouseholdId` · **지출→리포트 정확성 축** · **공유 왕복 축** ·
  **준비템 완료율 동기부여** · **준비템 탭 비가상화** · **홈 수치 정합** · **C/E 인용 두 방언** ·
  **`getHome` 카탈로그 전량 읽기** · **`previousMonth` 캐시 온기** · **준비템 판매처 1:1**
  (⚠️ 선행 확인 10의 `${seller}` 둘) · **app/** 전수 대장** · **하네스 셋째 모집단** ·
  **워커 시간 예산** · **리포트 첫 페인트 추가 축소** · **밴드별 카운트** · **구매 확인 판매처 라벨** —
  **전부 오늘도 제안하지 않는다.**

## 코드 건강 판정

- **핵심 루프는 오늘도 끊긴 데가 없다.** 지출 기록 → 총액 → 준비템(라운드 86 A가 필수도를 세웠다) →
  구매 링크 → 기록/상태 체크. ⚠️ **이번 라운드의 다섯 트랙 중 핵심 루프의 렌더를 여는 것은 0건이고**,
  그 사실이 값이다 — 오늘 나온 결함 다섯은 전부 **루프의 바깥 테두리**(운영자 도구 · 온보딩 ·
  설정 · 계약)에 있었다.
- **두 층의 비대칭이 이번 라운드의 주제다.** 화면 층에서 닫힌 규율 셋(호버 금지 · 실패 문장 배선 ·
  행마다 갈리는 낭독 라벨)이 **모듈 층·형제 화면·형제 앱**에서는 세어지지 않고 있었다. ⚠️ **그리고
  세 자리 다 "고칠 방법"이 아니라 "세는 자리"가 없어서 남았다** — 그래서 트랙 셋이 화면 한 줄과 함께
  **모집단 한 벌**을 세운다.
- **계약 그물은 더 촘촘해졌지만 뿌리는 여전히 `app/**` 편향이다.** 어드민은 라운드 75에 뿌리를 넓혔고
  모바일은 아직이다(트랙 C가 그 한 칸). ⚠️ **이 비대칭은 Y-3이 이름 붙인 축의 재발이다.**
- **기각을 값으로 남긴 것은 열셋이다**(선행 확인 3의 열일곱 중 열다섯 판정 · 선행 확인 9의 다섯 ·
  선행 확인 10의 `${seller}` 둘 · 선행 확인 11의 다섯 · 성능 넷 · 기록 탭 검색 · Z-1 대장 ·
  막대 포커스 · 손이 밖인 넷 — **전부 재개 조건과 함께이고, 그중 넷은 조건이 결정형이라고 이름 붙인다**).

## 트랙 구성 (파일 단위 상호 배타)

- **A 감사 로그 표가 값을 텍스트로 남기고, 그 행위자로 되짚는 길을 준다** (#1) — **유일한 어드민 트랙**
  - 소유: `apps/admin/src/lib/audit-log-rows.ts`(**신설 — 전체 식별자 텍스트 · 행위자 href ·
    0건 문장 두 갈래**) · `apps/admin/src/lib/audit-log-rows.test.ts`(**신설**) ·
    `apps/admin/app/audit-logs/page.tsx`(⚠️ **행위자·대상 두 칸 + 0건 문장 한 갈래 + 힌트 한 줄**) ·
    `apps/admin/src/admin-audit-logs.test.ts` · `apps/admin/src/lib/audit-log-filters.test.ts`
    (⚠️ **`hasAnyAuditLogFilter`의 호출부 실재 단언만 — 이 파일은 이 트랙 말고 아무도 열지 않는다**)
  - 읽기: `apps/admin/src/lib/audit-log-filters.ts`(**`hasAnyAuditLogFilter`·`auditLogsHrefForActor`·
    `shortActorId`·`auditLogActorLabel` — 읽기만 · 바이트 불변**) · `apps/admin/src/lib/admin-api.ts`
    (**`AdminAuditLogEntry` 모양 — 읽기만**) · `apps/admin/src/lib/audit-log-csv.ts`(**CSV 열 —
    읽기만 · 바이트 불변**) · `apps/admin/src/lib/analytics-trend-view.ts`·`worker-health-view.ts`
    (**순수 표시 모듈의 관례 — 읽기만**) · `apps/admin/app/users-lookup/page.tsx`
    (**같은 헬퍼를 쓰는 형제 — 읽기만 · 무접촉**)
  - 금지: ⚠️ **서버 0건**(새 파라미터·새 필터 축 0건 — 대상 축은 서버 DTO 결정이고 손이 밖이다) ·
    ⚠️ **`audit-log-filters.ts` 바이트 불변**(⚠️ **새 export 0건** — 미러 스윕의 면제 둘이 이 파일을
    가리킨다) · ⚠️ **새 손 미러 0건**(`admin-canonical-mirrors.test.ts` 무접촉) ·
    ⚠️ **CSV 열·순서·셀 방어 규칙 바이트 불변** · ⚠️ **필터 폼·프리셋·검증 문구 0건 변경** ·
    ⚠️ **`title` 속성을 지우지 말 것**(더하는 것은 도달 경로이지 빼는 것이 아니다) ·
    ⚠️ **개인정보 0건**(이메일·닉네임을 새로 그리지 말 것 — `shortActorId` 머리말의 그 규율) ·
    ⚠️ **페이지네이션·CSV 버튼·역할 게이트·`catch` 갈래 0건 변경**(`admin-load-error-copy.test.ts`의
    catch 스윕이 이 화면을 문다) · ⚠️ **`app/items|links/**` 0건**(S-3의 자리) ·
    **모바일 0건 · `packages/**` 0건 · `docs/**` 0건**
  - 계약: ⓐ **도달** — 행위자와 대상의 **전체 식별자가 텍스트 노드로** 화면에 있을 것
    (`title` 속성이 유일한 경로가 아닐 것 — **부정 단언**). ⓑ **되짚기** — 행위자 칸에서 그 행위자의
    로그로 가는 길이 **기존 `auditLogsHrefForActor` 한 함수**에서 올 것(새 주소 만들기 0건 ·
    ⚠️ **어드민 계정 행에는 그 길이 서지 않을 것** — `actorUserId`가 없다). ⓒ **0건 두 갈래** —
    필터가 하나도 없을 때와 있을 때의 문장이 **다를 것**이고 그 판정이 `hasAnyAuditLogFilter`에서
    올 것(**호출부 0건인 판정을 남기지 않는다**). ⓓ **자백 제거** — 힌트 문장에 *"마우스를 올리면"*
    이 남아 있지 않을 것(**부정 단언** — 거짓이 된 근거가 다시 근거로 쓰이지 않게). ⓔ **형식** —
    긴 값을 펼치는 모양이 같은 행의 `상세` 칸이 이미 쓰는 관례일 것(**새 형식·새 클래스 0건이면
    더 좋다**). ⓕ **바이트 불변** — 열 이름 다섯 · 페이지 표시 · CSV 문구 · 역할 안내.

- **B 온보딩 준비물 화면이 목록이 있을 때도 실패를 말한다** (#2) — **A·C·D·E와 완전 독립 · 결정형 조건 배정**
  - 소유: `apps/mobile/app/(onboarding)/prepared-items.tsx`(⚠️ **실패 두 줄의 조건 이동 + 0건 갈래
    조건 좁히기 · 그 밖은 바이트 불변**) · `apps/mobile/src/offline/messages.test.ts`
    (⚠️ **오프라인 대장의 갈래 단언 — 이 파일은 이 트랙 하나만 연다**)
  - 읽기: `apps/mobile/src/offline/offline-aware-screens.ts`(**배선·제외 대장 — 읽기만 ·
    ⚠️ 바이트 불변: 이 화면은 이미 배선 목록에 있고 제외 목록은 0건이다**) ·
    `apps/mobile/src/offline/messages.ts`·`use-load-error-copy.ts`(**공용 문장·훅 — 읽기만**) ·
    `apps/mobile/src/a11y-contract.test.ts`(**GAP-086 ⓔ 블록이 이 화면을 문다 — 읽기만 ·
    ⚠️ 트랙 C의 소유라 손대지 말 것 · 초록으로 남는지는 B가 확인한다**) ·
    `apps/mobile/src/onboarding/local-progress.ts`·`prepared-items-selection.ts`(**읽기만 · 무접촉**)
  - 금지: ⚠️ **0건 갈래 문구 바이트 불변**(*"지금 시기에 보여드릴 준비물이 아직 없어요…"*) ·
    ⚠️ **화면 고유 안내를 공용 문장으로 후퇴시키지 말 것**(라운드 86 B가 지킨 그 값 — **얹되
    지우지 않는다**) · ⚠️ **`[목록 다시 불러오기]` 버튼의 자리·라벨·조건 바이트 불변**
    (⚠️ **그 버튼의 바로 앞 `{itemsQuery.isError ? (` 사이에 `hasOptions`가 끼지 않을 것** —
    a11y·오프라인 두 계약이 그 구간을 자른다) · ⚠️ **새 쿼리·새 키·폴러·자동 재시도 0건** ·
    ⚠️ **`useLoadErrorCopy` 호출 수는 하나 그대로**(조회 자리당 한 번) ·
    ⚠️ **`canSkip`·`canPassPreparedItemsLocally`·저장 경로 0건**(라운드 72 A의 오프라인 통과 무접촉) ·
    ⚠️ **`src/offline/messages.ts`의 문자열 0건 신설 · 새 한국어 문장 0건** ·
    ⚠️ **다른 온보딩 화면 0건**(ONB-001·002·004 무접촉 — **`src/onboarding/step-ui.tsx`는 트랙 C의
    소유이고 이 트랙은 읽지도 쓰지도 않는다**) · **서버 0건 · `app/settings/**` 0건**(트랙 D의 소유)
  - 계약: ⓐ **창** — `isError && hasOptions`에서 **실패 문장 두 줄이 선다**(⚠️ **오늘 그 갈래가
    픽스처로 세워진다 — 목록이 있는 채 실패한 상태**). ⓑ **0건 갈래** — 준비물이 없어서 뜬 문장에는
    실패 문장도 오프라인 문장도 붙지 않을 것(**두 갈래가 더 벌어진다** · 부정 단언). ⓒ **문구** —
    오프라인 갈래는 공용 단일 소스 그대로 · 온라인 갈래는 접두 + 공용 문장으로 종전과 **바이트 단위로
    같을 것**. ⓓ **부재** — 화면 고유의 건너뛰기 안내가 여전히 그 자리에 있을 것(부정 단언).
    ⓔ **대장** — 배선 목록·`NON_CARD`·제외 목록(0건)이 **한 줄도 바뀌지 않을 것**.
    ⓕ ⚠️ **주석 정정** — 화면 주석의 *"이 창에서는 서지 않는다"* 가 소스에 남아 있지 않을 것
    (**거짓이 된 근거를 남기지 않는다** — 라운드 85 A·86 A의 그 규율).

- **C 온보딩 저장 실패 카드가 두 플랫폼에서 소리로 나가고, 낭독 스윕이 모듈 층을 본다** (#3) — **유일한 a11y 스캐너 트랙**
  - 소유: `apps/mobile/src/onboarding/step-ui.tsx`(⚠️ **`OnboardingSaveErrorCard`에 effect 하나 +
    import 한 이름 · 그 밖은 바이트 불변**) · `apps/mobile/src/a11y-contract.test.ts`
    (⚠️ **낭독 스윕에 모듈 층 뿌리 한 벌 + 그 자리의 출구 단언 — 이 파일은 이 트랙 하나만 연다**)
  - 읽기: `apps/mobile/src/ui.tsx`(**`announceForA11y` 단일 소스 — 읽기만 · 바이트 불변**) ·
    `apps/mobile/app/(auth)/login.tsx`(**본보기 — 읽기만 · 무접촉**) ·
    `apps/mobile/src/offline/offline-aware-screens.ts`(**모듈 대장 · 저장 화면 대장 — 읽기만**) ·
    `apps/admin/src/admin-load-error-copy.test.ts`(**뿌리 형식의 본보기 — 읽기만 · 쓰기 0건**) ·
    `apps/mobile/src/shared-decision-wiring.test.ts`·`src/api/api-error.test.ts`·
    `src/design-foundation.test.ts`·`src/onboarding-step-progress.test.ts`
    (**이 파일을 무는 계약 넷 — 읽기만 · 초록으로 남는지는 C가 확인한다**)
  - 금지: ⚠️ **문구 0건 신설·0건 변경**(카드가 읽는 것은 **화면에 이미 그려진 그 문자열**이다 —
    두 벌 리터럴을 만들지 말 것) · ⚠️ **프롭 둘을 빼지 말 것**(`ROUND79_ANNOUNCE_PROPS_ADDED`가
    그 바이트를 문다 · **더하는 것이지 바꾸는 것이 아니다**) · ⚠️ **렌더 도중 낭독 0건**
    (effect 안 · 의존 배열이 그 문장을 들 것) · ⚠️ **`useErrorTimeConnectivity` 배선·데모 세션 인자·
    `isOnboardingSaveForbidden`·`onboardingSaveErrorMessage` 판정 바이트 불변**
    (`shared-decision-wiring.test.ts`·`api-error.test.ts`가 그 자리를 문다) ·
    ⚠️ **`QUERY_TRIGGER_SITES_BY_SCREEN`·`MUTATION_TRIGGER_SITES_BY_SCREEN`·
    `SAVE_ERROR_ANNOUNCE_BLOCKED_BY_SOURCE_PIN`·`ALERT_ROLE_WITHOUT_LIVE_REGION` 바이트 불변**
    (⚠️ **모집단을 옮기지 말고 뿌리를 하나 더할 것** — 옮기면 U절 이월과 라운드 80의 값이 함께 흔들린다) ·
    ⚠️ **`app/**` 0건**(트랙 B·D의 소유) · ⚠️ **`src/offline/**` 0건**(트랙 B의 대장) ·
    **서버 0건 · 어드민 0건 · `packages/**` 0건**
  - 계약: ⓐ **출구** — 카드가 서는 순간 그 문장이 `announceForA11y`로 **한 번** 나갈 것
    (effect 안 · 같은 문장을 매 렌더 다시 읽지 않을 것). ⓑ **두 플랫폼** — 프롭 둘과 낭독이 **함께**
    있을 것(관례는 언제나 둘 다 — 이 저장소의 그 문장 그대로). ⓒ **뿌리** — 낭독 스윕이 **걷는 뿌리**와
    **걷지 않는 뿌리와 그 이유**를 값으로 가질 것(어드민의 그 형식 · 이유는 빈 문자열일 수 없다).
    ⓓ **유령 방지** — 모듈 층 모집단이 **0건이 아님**을 값으로 보일 것(빈 모집단 위에서는 모든 부정
    단언이 통과한다). ⓔ **부정** — 모듈 층에 **프롭만 걸린 자리가 0건**일 것이고, 그 0이 손으로 적은
    값이 아니라 **모집단에서 파생**할 것. ⓕ **사각** — 이 스윕이 못 보는 것(문장을 프롭 없는 요소에
    그리는 컴포넌트 등)이 값으로 적혀 있을 것(AA-4).

- **D 기기 목록의 두 줄이 서로 다른 줄이 된다** (#4) — **A·B·C·E와 완전 독립 · 가장 작다**
  - 소유: `apps/mobile/src/notifications/device-rows.ts`(**신설 — 기기 한 대의 구별 문구 파생**) ·
    `apps/mobile/src/notifications/device-rows.test.ts`(**신설**) ·
    `apps/mobile/app/settings/notifications.tsx`(⚠️ **행 제목 한 줄 + 스위치 라벨 한 줄** —
    그 밖은 바이트 불변) · `apps/mobile/src/notifications/push-settings-contract.test.ts`
  - 읽기: `apps/mobile/src/api/client.ts`(**`UserDeviceSummary` 모양 — 읽기만 · 바이트 불변**) ·
    `apps/mobile/src/notifications/relative-time.ts`(**`formatRelativeTime` — 읽기만 · 바이트 불변**) ·
    `apps/mobile/src/notifications/usePushDeviceRegistration.ts`(**등록이 무엇을 보내는가 — 읽기만 ·
    쓰기 0건**) · `apps/mobile/src/notifications/local-devices.ts`(**데모 거울 — 읽기만**) ·
    `apps/mobile/src/family/memberLabels.ts`(**라운드 86 C의 본보기 — 읽기만 · 무접촉**) ·
    `apps/mobile/src/offline/messages.test.ts`·`src/a11y-contract.test.ts`(**이 화면을 무는 계약 둘 —
    ⚠️ 트랙 B·C의 소유라 손대지 말 것 · 초록으로 남는지는 D가 확인한다**)
  - 금지: ⚠️ **서버 0건 · 새 요청 0건**(`osVersion`·`appVersion`은 응답에 **이미** 있다) ·
    ⚠️ **`registerDevice`·`updateDevice` 호출 인자 0건 변경**(마스터 토글의 등록 경로가 두 값을 보내지
    않는 사실은 **오늘 그대로 두고 화면이 없으면 안 그린다**) · ⚠️ **조회 실패·저장 실패 문구와 그
    태그 바이트 불변**(⚠️ **`<Text style={errorTextStyle}>` 두 자리는 오프라인 대장과 낭독 대장이 함께
    문다**) · ⚠️ **마스터 토글·푸시 정직 비활성·알림 종류 스위치·비세션 카드 0건** ·
    ⚠️ **`platformLabel`의 두 문자열 바이트 불변**(⚠️ 새 플랫폼 이름을 짓지 말 것) ·
    ⚠️ **지어내지 않기**(값이 없으면 그 조각을 그리지 않고 종전 문자열로 돌아갈 것 · 원문을 그대로
    흘리지도 말 것) · ⚠️ **새 한국어 문장은 0건에 가깝게**(조각을 잇는 구두점 말고는 새 문장이 없다) ·
    ⚠️ **`src/notifications/generators.ts`·`notification.store.ts`·`monthly-wrapup` 0건**
    (U절 이월 · 알림 생성 경로 무접촉) · **`app/(onboarding)/**` 0건**(트랙 B의 소유) ·
    **`src/onboarding/**` 0건**(트랙 C의 소유) · **어드민 0건 · `packages/**` 0건**
  - 계약: ⓐ **구별** — 같은 플랫폼 기기 둘이 **서로 다른 문자열**로 그려지고 **서로 다르게 낭독될 것**
    (⚠️ **오늘 그 갈래가 픽스처로 세워진다** — OS 버전이 다른 둘 · 둘 다 `null`인 둘). ⓑ **한 값** —
    행 제목과 스위치 라벨이 **같은 파생값**을 읽을 것(두 문장이 갈릴 자리를 만들지 않는다).
    ⓒ **부재** — `osVersion`이 없으면 그 조각이 서지 않고 종전 문자열과 **바이트 단위로 같을 것**.
    ⓓ **이 기기** — *이 기기* 사실이 배지에만 있지 않고 **낭독에도 도달할 것**.
    ⓔ **부정** — 앱 버전·푸시 토큰·기기 id를 그리지 말 것(⚠️ **그려서 갈라지는 것만 그린다** —
    앱 버전은 두 기기가 같은 빌드를 쓰면 갈리지 않고, 토큰·id는 표시 대상이 아니다).

- **E 호출부 0건인 판정에 이유를 값으로 (사문 대장)** (#5) — **유일한 packages 트랙 · A~D와 완전 독립**
  - 소유: `packages/test-utils/src/dead-export-ledger.ts`(**신설 — 모집단 결정 · 항목마다 이유 ·
    사각 · 래칫**) · `packages/test-utils/src/dead-export-ledger.test.ts`(**신설**)
  - 읽기: `apps/mobile/src/**`·`apps/mobile/app/**`·`apps/admin/src/**`·`apps/admin/app/**`
    (**스윕 대상 — 쓰기 0건**) · `packages/test-utils/src/dnc-secret-scan.ts`·`dnc-scope-guard.ts`·
    `source-contract-slice-guard.test.ts`(**형식의 본보기 — 읽기만 · 바이트 불변**) ·
    `apps/mobile/src/import/import-failure-messages.ts`·`src/settings/destructive-flow-messages.ts`
    (**"테스트 전용 export" 관례의 증명 — 읽기만**) · `apps/admin/src/content-revisions.test.ts`
    (**"있다"와 "닿는다"가 갈린 자리 — 읽기만 · 쓰기 0건**)
  - 금지: ⚠️ **제품 소스 0건 수정**(⚠️ **열일곱 중 하나도 지우거나 주석을 달지 말 것** — 이 라운드가
    하는 일은 **세는 자리를 세우는 것**이고, 지우는 판단은 그 자리가 선 다음이다) ·
    ⚠️ **`export const` 축을 모집단에 넣지 말 것**(계약 전용 데이터 모듈 열하나가 첫날부터 면제부가
    된다 — **그 사실은 사각으로 적는다**) · ⚠️ **모집단을 정하기 전에 바늘을 쓰지 말 것** ·
    ⚠️ **면제를 이유 없이 늘리지 말 것 · 이유는 빈 문자열일 수 없고 소스로 확인될 것** ·
    ⚠️ **래칫을 실측보다 느슨하게 두지 말 것**(값은 트랙이 실측한다) ·
    ⚠️ **기존 가드·대장 파일 0건 수정**(`dnc-guard-ledger.ts`·`dnc-scope-guard.ts`·`dnc-secret-scan.ts`·
    `source-contract-slice-guard.test.ts` **바이트 불변** — ⚠️ **이것은 DNC 조항이 아니므로 DNC 대장에
    행을 만들지 말 것**) · ⚠️ **`docs/dev/do-not-change.md` 무접촉** · ⚠️ **자기 파일을 모집단에 넣지
    말 것** · **`apps/**` 쓰기 0건 · `docs/**` 0건**
  - 계약: ⓐ **결정** — *무엇을 호출부로 볼 것인가*(제품 소스 · 자기 파일 포함)와 *무엇을 모집단으로
    볼 것인가*(`export function` · 계약 전용 데이터 모듈 제외)가 **값으로** 적혀 있을 것.
    ⓑ **유령 방지** — 모집단이 0건이 아님을 값으로 보이고, **뿌리마다 파일 수가 하한을 넘을 것**.
    ⓒ **항목** — 오늘의 열일곱이 **전수로** 있고 각각 셋 중 하나일 것: *이름이 고백하는 것* ·
    *이유가 소스에 있는 것*(⚠️ **그 이유가 실제로 그 파일에 있는지 소스로 확인할 것**) ·
    *이유가 대장에만 있는 것*(⚠️ **그 이유는 빈 문자열일 수 없다**).
    ⓓ **래칫** — 항목 수가 오늘의 실측보다 **늘지 않을 것**(새 사문이 생기면 두 답 중 하나를 값으로
    고르게 된다). ⓔ **사각** — `export const` 축의 수와 그 대부분이 계약 전용 데이터라는 사실,
    이름으로 훑는 스윕이 흔한 이름을 못 가른다는 사실, `.tsx` 컴포넌트가 모집단 밖이라는 사실이
    **값으로** 적혀 있을 것(AA-4의 규율을 태어날 때부터). ⓕ **자기 참조** — 대장 자신의 export가
    모집단에 들어가지 않을 것 · 루프 안 단언이면 **항목 id 전수**를 모집단으로 못 박을 것.

- **F 판정·확인의 표·접근성 표·출시 현황** — **A·B·C·D·E 머지 후**
  - 소유: `docs/operations/known-limitations.md` · `docs/qa/runtime-verification-required.md` ·
    `docs/qa/accessibility-offline-checklist.md` · `docs/5차/launch-readiness-status.md`
  - 금지: **제품 소스 0건** · `packages/**`·`apps/**` 무접촉 · `docs/dev/do-not-change.md` **무접촉** ·
    `docs/store/**`·`infra/legal/**`·`README.md`·`AGENTS.md`·`CODEX_START_HERE.md` 무접촉 ·
    **행 삭제 0건 · 행 번호 불변** · 각 행의 문장·기대 동작·근거 파일·부정 조건 **바이트 불변** ·
    K~AA절의 **판정을 다시 쓰지 말 것**(AA-1~AA-5는 **갱신 한 줄**씩만)
  - 계약: ⓐ **known-limitations에 AB절을 신설**하고 이번 라운드가 확정한 판정 다섯을 남길 것 —
    (1) **한 층에서 닫은 규율은 옆 층에서 다시 세어지지 않는다**(호버 금지·실패 문장 배선·행마다
    갈리는 낭독 라벨 셋이 전부 화면 층에서 닫힌 뒤 모듈 층·형제 화면·형제 앱에 남아 있었다),
    (2) **화면이 자기 도달 경로의 한계를 문장으로 자백하고 있으면 그것은 결함의 자백이다**
    (*"전체 ID는 칸에 마우스를 올리면 보여요"* — ⚠️ **그리고 그 값을 요구하는 필터가 같은 화면에
    있었다**),
    (3) **조건이 자기 손과 자기 자리를 함께 적어 두면 그것은 조건이 아니라 배정 대기 작업이다**
    (AA-R ②가 소스와 문서 두 곳에 자리를 적어 두었고, 오늘 전제를 다시 재니 아직 참이었다 —
    **참일 때 집는 것이 싸다**),
    (4) **대장에 이름이 있다는 사실이 "그 자리는 세어졌다"로 읽힌다**(프롭을 건 사실은 값으로
    있었고 그 프롭이 반쪽이라는 판정은 어디에도 없었다 — 라운드 86 A의 착시가 한 칸 옆에서 반복),
    (5) **스윕의 사각은 정찰 자신의 스윕에도 있다**(AA-5를 세다가 줄바꿈 때문에 여덟을 놓쳤고,
    그 사각에 Z-1과 AA-2가 앉아 있었다 — **수를 낼 때는 그 수를 어떻게 냈는지도 함께 적는다**).
    ⓑ ⚠️ **AA-1~AA-5가 남긴 질문 다섯 전수와 오늘의 답을 한 자리에 남길 것**(다섯 다 발동 ·
    전부 재개 조건과 함께). ⚠️ **수치를 옮겨 적는 대신 그 수를 세는 자리를 가리킬 것**(O-3·X-4).
    ⓒ ⚠️⚠️ **AA-5의 답을 이행할 것 — X-1~X-4 · Y-1~Y-4 · Z-1~Z-4 · AA-1~AA-4의 질문 자리에
    "어느 절이 답했는지" 갱신 한 줄씩**(⚠️ **판정을 옮겨 적지 말고 되짚는 줄만** — 옮겨 적으면
    그것이 사본이 된다). ⚠️ **그리고 그 열여섯이라는 수를 세는 자리를 함께 적을 것.**
    ⓓ **U-2·U-5·W-2·W-3·W-5·X-5·Y-5·Z-5의 판정을 다시 쓰지 않을 것** — 라운드 84~86이 답했고
    오늘 상태 변화가 0이다.
    ⓔ **N-4의 두 수에 대한 오늘의 답** — 미발동(10라운드 연속)이라는 사실만, ⚠️ **수는 화면이
    세므로 옮겨 적지 않는다.**
    ⓕ **U절 셋 · S-3 · `withdrawn_at` · AA-R ① 갱신 각 한 줄** — 재실측과 *"상태 변화 0"*.
    ⚠️ **S-3 줄에는 세 라운드 연속 접점 0건이라는 사실을 적을 것.**
    ⚠️ **AA-R ②는 "닫힘"으로 갱신하되 그 조건이 결정형이었고 손이 안이었다는 사실을 남길 것**
    (AA-3의 첫 이행이다).
    ⓖ **기각을 값으로 열셋** — 응답 필드·사문 열다섯 판정 · 지출 입력 두 화면 · 감사 CSV ·
    콘텐츠 리비전 편집 표면 · 어드민 손 미러 · `SYNC_STATUS_RETRY_ALL_LABEL` · 성능 넷 ·
    기록 탭 검색 · Z-1 대장 · 막대 포커스 · 손이 밖인 넷 · `${seller}` 둘
    (**전부 재개 조건과 함께 · 결정형 넷은 그 사실과 손의 위치를 함께**).
    ⓗ 접근성 표: 라운드 87분을 **A-28**로 세울 것(⚠️ **실기기 셋** — 온보딩 저장 실패 카드가
    **iOS에서** 소리로 도달하는가 · 목록이 있는 채 실패한 창에서 문장과 버튼이 한 짝으로 읽히는가 ·
    같은 플랫폼 기기 둘의 스위치가 **서로 다르게** 들리는가). ⚠️ **트랙 A의 어드민 항목은 종전
    판정대로 행이 아니라 문단으로**(브라우저 화면은 이 표의 조건 밖이다) ·
    ⚠️ **트랙 E는 소스 계약이라 행이 서지 않는다.**
    ⓘ **C-3은 오늘로 스물한 라운드 연속 미확인**이라는 사실을 갱신 · ⚠️ **그 줄의 조건이 AA-3의
    분류로는 여전히 *"손이 저장소 밖"* 이라는 사실을 한 줄로 적을 것.**
    ⓙ `runtime-verification-required.md`에 라운드 87 신설분을 **#156부터** 편입하고 §0의 네 수·
    합계·§1-1 머리말 라운드 구간을 함께 갱신할 것(⚠️ 라운드 75 C의 계약이 그 값을 파싱으로 다시
    세므로 틀리면 `@wooriai/test-utils`가 먼저 빨개진다). ⚠️ **표면 배분**: 트랙 B·C·D는 **실기기**,
    트랙 A는 **브라우저**, 트랙 E는 **소스 계약이라 행이 서지 않는다.**
    ⓚ `launch-readiness-status.md`의 **테스트 건수 재실측**. ⚠️ **정찰은 이 수치를 적지 않는다**(O-3).

- **머지 순서**: **A·B·C·D·E는 서로 완전 독립**이고 즉시 병렬 가능하다 —
  A=`apps/admin/**`, B=`app/(onboarding)/prepared-items.tsx` + `src/offline/messages.test.ts`,
  C=`src/onboarding/step-ui.tsx` + `src/a11y-contract.test.ts`,
  D=`app/settings/notifications.tsx` + `src/notifications/device-rows.*` +
  `src/notifications/push-settings-contract.test.ts`, E=`packages/test-utils/**`.
  **파일이 한 곳도 겹치지 않는다.**
  ⚠️ **접점은 읽기 방향으로만 다섯이다**: ① B가 `src/a11y-contract.test.ts`(C의 소유)의 GAP-086 ⓔ
  블록을 **초록으로 남겨야** 한다 — 그 블록이 자르는 구간은 `[목록 다시 불러오기]` 바로 앞의
  `{itemsQuery.isError ? (` 부터라, **B의 새 갈래가 그 구간에 끼지 않는 것이 금지 조항이다**,
  ② D가 `src/offline/messages.test.ts`(B의 소유)와 `src/a11y-contract.test.ts`(C의 소유)의 알림 설정
  단언을 **초록으로 남겨야** 한다 — 그 둘이 무는 것은 실패 문구 두 자리이고 D가 여는 것은 기기 행과
  스위치 라벨이라 **문자열이 겹치지 않는다**, ③ C가 `src/offline/offline-aware-screens.ts`의 모듈
  대장을 **읽기만** 한다, ④ A가 `src/lib/audit-log-filters.ts`를 **읽지만 바이트 불변**이다
  (⚠️ **미러 스윕의 면제 둘이 그 파일을 가리키므로 새 export를 더하면 그 계약이 먼저 빨개진다**),
  ⑤ E가 제품 소스 전역을 **읽기만** 한다.
  ⚠️⚠️ **금지 조항의 교차 확인**: a11y 스캐너를 여는 트랙은 **C 하나** · 오프라인 대장은 **B 하나** ·
  어드민 catch 스윕이 닿는 화면을 여는 트랙은 **A 하나**이고, **라우트 표면 · 슬라이스 가드 ·
  여정 스윕 · 체크표 자기집계 · 구독 대장 · `$transaction` 상한 대장 · 정책/무효화 대장 · 미러 스윕 ·
  DNC 가드 대장 · DNC 범위 대장 · DNC 비밀값 스윕 · 문장 수 계측 — 이 열둘은 어느 트랙도 열지 않는다.**
  ⚠️ **계약 그물을 둘 이상 함께 여는 트랙은 0건이다**(라운드 86이 트랙 B 하나에서 받았던 경고가
  이번에는 서지 않는다 — B와 C가 그물을 하나씩 나눠 진다).
  **B를 먼저 머지한다** — 결정형 조건을 집어 드는 트랙이라 그 결정의 근거가 커밋 메시지에 남아야
  하고, 고치는 것이 **갈래 조건 하나**로 가장 작다. 그다음 **C**(같은 여정의 다른 층 · ⚠️ **B의
  화면을 읽지 않으므로 순서가 값을 바꾸지는 않는다 — 다만 온보딩 두 자리를 한 흐름으로 확인하려면
  붙여 두는 것이 싸다**). 그다음 **D**(가장 작은 화면 변경 · 픽스처가 오늘 0건인 갈래를 스스로
  만든다). 그다음 **A**(어드민 · 브라우저 확인이 따라붙는다 · 이번 라운드에서 가장 넓은 화면 변경).
  **E는 마지막이고 가장 크다** — ⚠️ **그 트랙의 절반은 코드가 아니라 *모집단 결정*이고, 서두르면
  그 대장이 첫날부터 면제부가 된다**(라운드 85 E·86 E가 같은 자리에서 받은 경고 그대로).
  **F는 마지막이고, 이번 F의 본체는 AB절 다섯 판정 · AA-1~AA-5에 대한 오늘의 답 다섯 ·
  ⚠️ X~AA절 열여섯 질문 자리에 되짚는 갱신 한 줄씩 · 결정형 조건 아홉의 전수와 손의 위치 ·
  N-4 미발동 한 줄 · U절 셋·S-3·`withdrawn_at`·AA-R ①·② 갱신 여섯 줄 · 기각 열셋을 값으로 ·
  A-28(실기기 셋) · C-3 스물한 라운드 표기 · 확인의 표 #156~ 편입과 §0 재계산 · 테스트 건수 재실측이다.**
