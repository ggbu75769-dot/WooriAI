# 라운드 77 정찰 노트 (GAP-077)

> master adcbd54(라운드 76 머지, PR #81) 기준 · 2026-08-30 실측. do-not-change.md(DNC-001~020) ·
> known-limitations A~Q절 · gap-analysis 제외 판정 · round55-plan §6 비범위표 · round56~76-scout
> 완료분 · round61-backlog 대조 완료. 아래는 전부 그 밖이거나, 라운드 76이 **다음 결정의 입력으로
> 지목해 둔** 자리다.
>
> **라운드 76이 축을 "목록이 닫힌 곳의 바로 옆 칸"으로 잡았다면, 이번 라운드는 축을
> 핵심 루프의 오른쪽 절반 — 커머스 구간(준비템 확인 → 링크 클릭 → 구매 확인 → 기록)과
> 그 뒤의 리포트·공유 — 그리고 그 루프를 운영하는 사람의 화면으로 옮긴다.**
>
> 이번 라운드의 관측은 하나로 모인다 — **"다시 시도해 주세요"가 다시 시도해도 소용없는
> 자리에 서 있고, 그 자리가 세 층에 하나씩 있다.**
> ① **사용자**: 구매 링크 클릭이 404로 죽으면(어드민이 내린 링크·허용 목록 밖 도메인) 앱은
>    *"링크를 열지 못했어요. **잠시 후 다시 시도해 주세요.**"* 라고 말한다. 서버는 이유를
>    알고 있고, 그 코드는 앱의 표에 **없다**(후보 1 — 핵심 루프 4단계).
> ② **운영자**: 어드민의 **연결 실패** 문장 하나가 GET·POST·PATCH·DELETE를 가리지 않고
>    *"…**다시 시도해 주세요.**"* 다. 같은 파일이 **타임아웃**에는 R19-F 판정 셋을 세워 두고
>    (읽기 / 비멱등 쓰기 / 멱등 쓰기) 재시도를 권하지 **않는** 문장까지 지어 두었는데,
>    연결 실패는 그 판정을 지나지 않는다 — 오늘 멱등키 없는 쓰기가 **열여덟**이다(후보 2).
> ③ **운영자, 다시**: CSV 미리보기 실패는 **모든 실패**에 *"**CSV 형식을 확인**하고 다시
>    시도해 주세요."* 라고 원인을 단정한다 — 403·5xx·연결 실패·60초 타임아웃 전부(후보 3).
>    라운드 76이 `app/reviews/page.tsx:229`에서 고친 그 모양이 **면제 목록 안에서** 살아 있었다.
>
> 그리고 넷째가 **문장이 아니라 화면**에 있다 — **`analyst` 계정은 통하지 않는 저장 UI를
> 세 화면에서 본다**(후보 4). 저장을 누르면 서버가 403으로 막고, 그 사실을 화면은 누르기
> 전까지 말하지 않는다. 같은 저장소의 다른 두 화면(`/categories`·`/reviews`)은 이미 정직하다.

## 선행 확인 아홉 (후보 아님)

1. **라운드 76의 여섯 트랙은 전부 머지돼 있다**(실측). A=`src/offline/offline-aware-screens.ts`의
   모듈 대장 셋 + `messages.test.ts`의 `src/**` 스윕, B=`apps/admin/src/lib/write-error-copy.ts` +
   `src/admin-write-error-copy.test.ts`, C=`import-failure-messages.test.ts:59`의
   `"imports/imports.controller.ts"` 편입(목록 **셋**), D=`kakao-auth.service.ts:205`의
   `action: "auth.login_rejected"` + `audit-log-filters.ts:189`의 프리셋(**스물셋**),
   E=`apps/api/src/onboarding/timing-label-range.ts`, F=known-limitations **Q절**.
   **재제안 대상이 아니다.**
2. **시드 카탈로그는 라운드 76 이후로도 그대로다**(2026-08-30 실측): `prisma/seed-data.ts`
   **2,083줄** · `active: true` **120**(준비템 62 + 링크 58) · `isSponsored: true` **5** ·
   `isAffiliate: true` **19** · `timingLabel` **63**. **상태 변화 없음.**
3. **DNC-009는 오늘도 배선돼 있다.** `apps/api/src/onboarding/item-ranking.ts`에서
   `수수료`/`commission` grep **0건**이고, `packages/domain/src/recommendation.ts:67`이
   *"수수료율을 실어도 점수가 한 점도 달라지지 않는다"* 를 **부정 단언**으로 증명한다
   (`recommendation.boundary.test.ts:100` — 임의 수수료율 100건 속성 테스트). **이 축에 후보 없음.**
4. **DNC-010/011도 그대로다.** 마커·고지·공유 문장이 `src/items/link-marker.ts` 한 자리에서
   나오고(`productLinkMarker:43` · `productLinksDisclosureText` · `purchaseLinkShareMessage`),
   `ui.tsx:1157`의 `AffiliateDisclosure`는 `text`가 **필수**라 스스로 문장을 짓지 않는다
   (라운드 43 M-1). 준비템 **목록**에는 링크가 서지 않으므로 스폰서 구분의 사각도 없다.
5. **구매 확인 루프의 등록·소진 시점은 오늘도 정직하다.** `registerPurchaseFollowup`은
   `Linking.openURL`이 성공한 뒤에만 불리고(`app/items/[itemTemplateId].tsx:532-533`),
   `done` 확정은 카드가 아니라 **저장이 확정된 자리**에서만 붙는다(라운드 60 B).
   이탈은 답변 예산 한 칸을 쓴다(`intendPurchaseFollowup`). **결함이 아니다.**
6. **커머스 실패 문구는 이미 접근성으로 낭독된다.** `clickedTitle`은 `<Toast>`로 그려지고
   (`app/items/[itemTemplateId].tsx:1146`), `ui.tsx:1128-1145`의 Toast가
   `announceForA11y` + `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`를 진다
   (A11Y-115). **후보 1이 세우는 새 문장은 배선 0건으로 낭독된다.**
7. **리포트 공유 문구는 이번 라운드가 열 자리가 없다.** `src/reports/share-text.ts`는
   진행 중인 달의 **구간 줄**(없으면 공유 자체를 접는 fail-safe, 라운드 36 F-5)과 **대기 건수 줄**
   (GAP-064 #3)을 이미 지고, 금액·문장을 화면이 그린 값에서만 받는다(집계 재계산 0건).
   두 공유 경로의 catch(`reports.tsx:594`·`:831`)가 침묵하는 것도 값이 적혀 있다(시트 취소가
   정상 경로). **이 축에 후보 없음.**
8. **CSV 내보내기(월말 정리)의 실패 갈래도 이미 셋이다** — 전량 수집 실패(원인+다음 행동) ·
   오프라인(공용 문장) · 그 밖(`src/export/ExpenseCsvExport.tsx:369`·`:381-383`).
   **표기 방언 둘만 남아 있고 그것은 P3다.**
9. **하단 탭 넷 · 죽은 라우트 0건은 라운드 76이 전수로 확인했고 이번 라운드가 다시 세지 않았다**
   (재스윕하지 않았다고 적는다 — 그 사실이 다음 라운드의 입력이다).

## 상위 후보

### 1. **핵심 루프 4단계가 막다른 문장으로 끝난다 — 서버는 이유를 알고, 앱의 표는 그 코드를 밖에 둔다** — 모바일·커머스 — S

- **근거**: 넷이 한 줄로 이어져 있다.
  - ⓐ **서버는 이유를 코드로 말한다.** `apps/api/src/onboarding/items-catalog.service.ts:413`이
    `PRODUCT_LINK_NOT_FOUND`(404, *"상품 링크를 찾을 수 없어요."*)를 던지고, **같은 코드가 두
    갈래**에서 난다 — 링크가 `active:false`가 되었거나 지워졌을 때(`:411-413`), 그리고
    **허용 도메인 목록 밖**일 때(`:422-424` — COM-106이 `/r/:code`와 코드를 통일해 둔 자리다).
    바로 위 `:418`의 `requireHttpUrl`은 `PRODUCT_LINK_URL_SCHEME_INVALID`(400)를 던진다.
    ⚠️ **셋 다 다시 눌러도 결과가 같다.**
  - ⓑ **앱은 그 코드를 보지 않는다.** `app/items/[itemTemplateId].tsx:546-549`:
    ```
    onError: () => {
      showLinkFailure("링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.");
      setLinkOpenFallback(null);
    }
    ```
    `error` 인자를 **받지도 않는다**. `showLinkFailure`(`:514-522`)가 하는 일은 폴 한 번으로
    오프라인만 갈라내는 것이라(라운드 60 #4), **연결이 있는 실패의 사유는 전부 이 한 문장이다.**
  - ⓒ ⚠️ **제외 목록의 사유가 오늘 반만 참이다.** `src/api/api-error.test.ts:465-466`이
    `PRODUCT_LINK_NOT_FOUND`를 표 밖에 두며 적은 이유는 *"클릭은 아웃박스를 타지 않는 즉시
    요청이라 실패해도 큐 행이 남지 않고, **그 화면이 자기 문구를 쓴다**"* 이다. 앞 절은 참이고
    (그래서 **아웃박스 교집합 계약**의 단위로는 옳은 제외다), **뒤 절이 오늘 거짓을 나른다** —
    그 "자기 문구"가 영원히 통하지 않을 일에 **잠시 후 다시**라고 말한다.
    `PRODUCT_LINK_URL_SCHEME_INVALID`(`:468-469`)도 같은 모양이다.
  - ⓓ **형제 코드는 이미 표 안에서 정직하다.** `src/api/api-error.ts:192`의
    `LINKED_PRODUCT_LINK_NOT_FOUND` = *"연결하려던 구매 링크를 찾지 못했어요. **링크 없이 다시
    저장해 주세요.**"* 이고, `api-error.test.ts:234`가 *"`잠시 후 다시`를 담지 않는다"* 를 부정
    단언으로 못박아 두었다. ⚠️ **같은 사실(그 링크가 없다)을 두 코드가 말하는데, 지출 저장
    경로의 것만 정직하다.** 표에 이미 `ITEM_NOT_FOUND`·`CHILD_NOT_FOUND`(*"…목록에서 내려갔을
    수 있으니 … 확인해 주세요."*)라는 **같은 문형**이 있다 — 새 문형을 지을 필요가 없다.
- **실패 시나리오**: 아빠가 6-12개월 칩에서 『아기 식판』을 열어 [쿠팡에서 보기]를 누른다.
  그 링크는 어제 어드민이 내렸다(제휴 계약 종료). 화면이 말한다 — **"링크를 열지 못했어요.
  잠시 후 다시 시도해 주세요."** 그는 5초 뒤 다시 누른다. 같은 문장. 화면을 닫았다 다시 연다.
  같은 문장. **그 상세에는 다른 판매처 링크가 두 개 더 서 있는데**, 앱이 "기다리면 된다"고
  말했으므로 그는 다른 링크를 눌러 볼 이유가 없다. — 핵심 루프의 3단계(준비템 확인)와
  4단계(링크 클릭) 사이가 여기서 끊기고, 5단계(구매 확인·기록)는 **한 번도 열리지 않는다**
  (`registerPurchaseFollowup`은 열린 뒤에만 불린다 — 선행 확인 5).
- **최소안**: **아는 코드는 표가 말한다. 판정 신설 0건 · 새 모듈 0건 · 서버 0건.**
  ⓐ **표 두 줄** — `src/api/api-error.ts`의 `API_ERROR_MESSAGES`에 `PRODUCT_LINK_NOT_FOUND`와
  `PRODUCT_LINK_URL_SCHEME_INVALID`를 편입한다. 문형은 표에 이미 있는 그것이다(`ITEM_NOT_FOUND`
  계열 — 무엇이 없는지 + 지금 할 수 있는 일). ⚠️ **꼬리에 `"잠시 후 다시"`를 쓰지 않는다**
  (`LINKED_PRODUCT_LINK_NOT_FOUND`가 지는 그 부정 단언과 같은 규율). ⚠️ **띄어 쓴 표기**
  (`"확인해 주세요"`)를 쓴다 — 붙여 쓴 방언 셋에 넷째를 더하지 않는다(P3).
  ⓑ **화면 한 자리** — `onError`가 `error`를 받아 `apiErrorMessage(error, 종전 문장)`를 지난다.
  **아는 코드면 폴을 띄우지 않고**(서버가 답했다는 것이 곧 연결이 있었다는 뜻이다 —
  `invite-permissions.ts:130`의 판정 순서 근거 그대로) `showLinkNotice`로, 모르는 실패면
  **종전 그대로** `showLinkFailure`로 간다. ⚠️ **종전 문장 바이트 불변**이고,
  `showLinkFailure`의 폴·seq 걸쇠 구조는 **한 글자도 바뀌지 않는다.**
  ⓒ **제외 목록의 사유를 고친다** — 두 코드가 표로 옮겨 갔다는 사실과, 그 제외의 근거가
  *"화면이 자기 문구를 쓴다"* 가 아니라 **"아웃박스가 지나지 않는다"** 였다는 구분을 값으로
  적는다(⚠️ 그 구분이 이 후보의 본체다 — 제외의 이유가 둘이면 하나가 거짓이 되어도 조용하다).
- **설계 긴장**: 여덟이다. ⓐ **서버 0건**(코드·메시지·허용 목록·클릭 행 · `/r/:code` 무접촉).
  ⓑ **오프라인 갈래 무변경**(`showLinkFailure`의 폴 한 번 · `linkNoticeSeqRef` 걸쇠 · 라운드 60 #4의
  등록 시점). ⓒ **`registerPurchaseFollowup`·`retryOpenFallbackLink`·`shareFallbackLink` 무접촉**
  (구매 확인 창·공유 판정 `canSharePurchaseLink`는 라운드 64·67·68이 닫았다). ⓓ **`src/items/**` 0건**
  (`link-marker.ts`의 마커·고지·공유 문장 — DNC-010/011). ⓔ **`src/offline/**` 0건**(모듈 대장 셋·
  화면 목록 다섯·두 스윕 전부 무접촉 — 새 문장이 `src/api/api-error.ts`에 서고 그 파일의 바늘은
  오늘도 **주석에만** 있다). ⓕ **아웃박스 교집합 계약의 단언 문장 불변**(제외가 표로 옮겨 가는 것은
  그 계약이 이미 허용하는 두 답 중 하나다). ⓖ **`app/**` 옛 리터럴 횟수 표 무변경**
  (이 화면의 문자열은 그 바늘 모양이 아니다). ⓗ DNC-018 해요체.

### 2. **어드민의 연결 실패는 R19-F 판정을 지나지 않는다 — 타임아웃에는 셋을 세워 두고 (S-3 후속, 채택)** — 어드민·이중 반영 — S

- **근거**: 같은 함수 안에서 두 갈래가 갈린다. `apps/admin/src/lib/admin-api.ts`의 `request()`:
  - ⓐ **타임아웃 갈래는 판정 셋이다.** `:495-499`가 `method`와 `idempotent`를 계산해
    `fetchWithTimeout`에 넘기고(`:521-523`), `AdminApiTimeoutError`(`:416-440`)가 그 둘로 문장을
    고른다 — 읽기 `READ_TIMEOUT_MESSAGE` · 비멱등 쓰기 `WRITE_TIMEOUT_MESSAGE`(*"반영 여부가
    확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요"* — **재시도를 권하지 않기 위해**
    지은 문장) · 멱등 쓰기 `IDEMPOTENT_WRITE_TIMEOUT_MESSAGE`. `retryUnsafe` 필드까지 함께 실린다.
  - ⓑ ⚠️ **연결 실패 갈래는 한 문장이다.** 바로 아래 `:524`:
    ```
    throw new AdminApiError(0, "서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    ```
    **`method`와 `idempotent`가 그 자리 스코프에 이미 있는데도** 읽지 않는다. GET·POST·PATCH·
    DELETE가 전부 같은 문장을 받고, 그 문장은 **다시 시도하라고 말한다.**
  - ⚠️ **`fetch`의 거절은 "보내지 못했다"와 "보냈는데 답을 못 받았다"를 구분하지 않는다.**
    연결이 서기 전에 죽으면 서버는 아무것도 모르지만, 요청 본문이 나간 뒤 커넥션이 끊기면
    (리셋·TLS 종료·중간 프록시) 서버는 이미 처리했을 수 있다. 클라이언트가 그 둘을 가를 방법은
    없고 — **그것이 정확히 `WRITE_TIMEOUT_MESSAGE`가 존재하는 이유다.** 같은 불확실성에 대해
    타임아웃은 보수적으로, 연결 실패는 낙관적으로 말한다.
  - **오늘 그 문장이 닿는 쓰기를 세어 봤다**(실측): `request()`를 부르는 쓰기 호출
    **스물넷**(`method: "POST"|"PATCH"|"PUT"|"DELETE"`), 그중 `idempotencyKey`를 실어 보내는 것이
    **여섯**(`createItemTemplate` · `createProductLink` · `bulkApplyProductLinks` ·
    `approvePublishContentRevision` · `rollbackContentRevision` · `createAdminUser`).
    ⚠️ **나머지 열여덟은 멱등키가 없다** — 서버가 중복을 걸러 주지 않는 쓰기에 재시도를 권한다.
  - ⚠️ **라운드 76이 그 문장의 도달 범위를 넓혔다(의도한 값이었다).** 트랙 B가 쓰기 catch 아홉을
    한 벌로 모으면서 서버 사유가 화면까지 나르게 됐고, `admin-write-error-copy.test.ts:325`가
    *"연결 실패도 admin-api.ts가 만든 문장 그대로 닿는다"* 를 계약으로 세웠다. 종전 폴백도
    재시도를 권했으므로 **해악이 늘지는 않았지만**, 이제 그 문장이 열넷 자리에 **정확히 그대로**
    선다 — 고칠 자리가 하나로 모였다는 뜻이기도 하다.
- **실패 시나리오**: 운영자가 카페 와이파이에서 준비템 하나의 시기 라벨을 고치고 [저장]을
  누른다. 요청은 나갔고 서버는 반영했는데, 응답이 오기 전에 와이파이가 끊긴다. 화면이 말한다 —
  **"서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요."** 그는 연결을
  되살리고 다시 누른다. `updateItemTemplate`은 멱등키가 없는 열여덟 중 하나다. — 같은 주,
  다른 운영자가 같은 화면에서 **60초 타임아웃**을 만난다. 그 화면은 말한다 — *"반영 여부가
  확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요."* **같은 불확실성인데 한쪽만
  경고한다.**
- **최소안**: **타임아웃이 이미 가진 판정을 연결 실패에도 세운다. 새 판정 0건 · 조회 문장 바이트 불변.**
  ⓐ **연결 실패도 `method`·`idempotent`로 갈린다** — 읽기는 **오늘의 문장 그대로**(바이트 불변),
  비멱등 쓰기는 `WRITE_TIMEOUT_MESSAGE`와 **같은 모양**(반영 여부를 단정하지 않고 새로고침을
  먼저 권한다), 멱등 쓰기는 *"같은 요청을 다시 보내면 중복 없이 처리돼요"* 를 그대로 잇는다.
  ⚠️ **문장 조립은 타임아웃 쪽 상수를 재활용하는 방향이 아니라** — 그 문장들은 *"(60초)"* 를
  못박고 있어 연결 실패에 그대로 쓰면 거짓이다 — **같은 규율(재시도를 권하지 않는다)의 새 문장
  둘**이다. 새 한국어 문장이 서는 **유일한 자리**이고 그 이유가 여기다.
  ⓑ **타입은 늘리지 않는다** — 종전처럼 `AdminApiError(0, …)`을 던진다. 그래서
  `writeErrorMessage`/`loadErrorCopy`가 **한 글자도 바뀌지 않고** 그 문장을 나른다(트랙 C·라운드 76 B의
  파일 무접촉). 필요하면 `code`만 붙인다(오늘 `undefined`다).
  ⓒ **부정 단언** — ① GET의 연결 실패 문장이 **바이트 불변**일 것(`admin-load-error-copy.test.ts:613`이
  이미 그 리터럴을 소스에서 찾는다 — 그 계약이 이 트랙의 안전망이다), ② 비멱등 쓰기의 연결 실패
  문장이 **`"다시 시도해 주세요"`로 끝나지 않을** 것(R19-F의 규율을 문장 모양으로 못박는다),
  ③ 타임아웃 갈래 셋의 문장·`retryUnsafe`·상한 두 값(10초·60초)이 **무변경**일 것.
- **설계 긴장**: 아홉이다. ⓐ ⚠️ **`src/lib/write-error-copy.ts`·`src/admin-write-error-copy.test.ts`
  무접촉**(트랙 C 소유 — 이 트랙은 **문장을 만들기만** 하고, 나르는 한 벌은 라운드 76이 이미 세웠다).
  ⓑ ⚠️ **`src/lib/load-error-copy.ts` 무접촉**(조회 열여섯은 라운드 75가 닫았다 — 읽기 문장이
  바이트 불변이므로 그 열여섯의 화면은 **아무것도 달라지지 않는다**). ⓒ **`app/**`·`src/components/**` 0건**
  (화면은 한 자리도 열지 않는다). ⓓ **타임아웃 상한·멱등키 홀더·CSRF·`credentials` 무변경.**
  ⓔ **서버 0건**(응답 계약·인터셉터 무접촉). ⓕ **읽기 경로의 재시도 안내는 그대로 옳다**
  (조회는 다시 눌러도 안전하다 — 쓰기와 **정반대**라는 것이 R19-F의 값이다).
  ⓖ **새 문장 둘 외에 새 문구 0건.** ⓗ **마이그레이션 0건.** ⓘ DNC-018.

### 3. **CSV 미리보기가 없는 원인을 단정한다 — 면제 목록이 스스로 예고한 그 자리 (Q-2 잔여, 채택)** — 어드민·허위 표시 — S

- **근거**: 라운드 76 Q-2가 *"다음 라운드의 값으로 남긴다"* 고 적은 그 자리이고, 재어 보니
  **이월 사유보다 무겁다.**
  - `apps/admin/src/components/ProductLinkBulkReplace.tsx:93-99`(`handlePreview`의 catch):
    ```
    } catch (err) {
      if (isAuthError(err)) { clearSession(); return; }
      setError("미리보기에 실패했어요. CSV 형식을 확인하고 다시 시도해 주세요.");
    }
    ```
    ⚠️ **`err`를 401 판정에만 쓰고 버린다.** 그래서 이 한 문장이 **모든 실패**에 선다 —
    403(`RequireAdminRoles("admin")` — `product-link-bulk.controller.ts:31`) · 5xx ·
    연결 실패 · **60초 타임아웃** · DTO 검증 400(`AdminProductLinkBulkCsvDto` — 빈 문자열·20만 자 초과).
    그중 **CSV 형식이 원인인 것은 하나뿐**이다.
  - ⚠️ **라운드 76이 고친 그 모양 그대로다.** `app/reviews/page.tsx:229`의 *"본인이 작성한 초안은
    승인할 수 없어요"* 와 문장 구조가 같다 — **첫 문장은 참, 꼬리는 없는 원인의 단정.**
    그리고 라운드 76 트랙 B가 세운 부정 단언(*어떤 쓰기 폴백도 원인을 단정하지 않는다*,
    `admin-write-error-copy.test.ts:554-599`)의 꼬리 화이트리스트는 셋이다
    (`"다시 시도해 주세요."` · `"입력값을 확인하고 다시 시도해 주세요."` ·
    `"다시 미리보기 후 시도해 주세요."`). ⚠️ **`"CSV 형식을 확인하고 다시 시도해 주세요."` 는
    그 셋에 없다** — 즉 이 자리가 대장에 들어오는 순간 **고치기 전에 빨개진다.**
  - **면제의 이유가 절반만 맞았다.** 오늘 그 자리는 `WRITE_ERROR_COPY_EXEMPT_SITES`의
    `"…#bulk-preview"`(`admin-write-error-copy.test.ts:183-188`)이고 사유는 *"미리보기는 서버가
    검증만 하고 아무것도 쓰지 않는 요청이라 이 대장의 단위(쓰기)가 아니다"* 다. **그 절반은 참**
    (쓰기가 아니다)이고, **나머지 절반이 이 후보다** — 쓰기가 아니라는 사실은 *사유를 버려도 된다*
    는 뜻이 아니다.
  - ⚠️⚠️ **그런데 그 자리에 `writeErrorMessage`를 그냥 붙이면 새 거짓이 선다.**
    `POST /bulk-preview`는 `timeoutMsForMethod`(`admin-api.ts:387`)에 **쓰기(60초)** 로 분류되고
    멱등키가 없으므로, 타임아웃 시 `WRITE_TIMEOUT_MESSAGE`가 나온다 — *"**반영 여부가 확실하지
    않으니** 목록을 새로고침해 확인한 뒤…"*. **아무것도 쓰지 않는 요청에 대한 거짓이다.**
    ⚠️ **오늘 그 문장이 화면에 서지 않는 유일한 이유가 이 catch가 사유를 통째로 버리기 때문**이라는
    것이 이 후보에서 가장 값진 관측이다 — **버리는 것이 우연히 방패 노릇을 하고 있었다.**
  - **같은 파일이 30줄 아래에서 그 갈래를 이미 갈라 두었다**: `handleApply`(`:131-164`)는
    `isIdempotentTimeoutError` → `isRetryUnsafeTimeoutError` → `writeErrorMessage` 순서로
    **셋을 갈라낸다**. 미리보기에는 그 순서가 없다.
- **실패 시나리오**: `analyst` 계정의 운영자가 제휴 승인 후 URL 500행을 붙여 넣고 [미리보기]를
  누른다. 서버는 403으로 막는다(그 라우트는 `admin` 전용이다). 화면이 말한다 — **"미리보기에
  실패했어요. CSV 형식을 확인하고 다시 시도해 주세요."** 그는 CSV를 연다. 헤더를 고친다. 다시
  붙여 넣는다. 같은 문장. 인코딩을 UTF-8로 바꾼다. 같은 문장. **그가 실제로 해야 할 일은
  관리자에게 권한을 부탁하는 것**인데, 화면은 30분 동안 그를 파일 쪽으로 보낸다.
- **최소안**: **라운드 76 B가 세운 한 벌을 이 자리에도. 판정 신설 0건 · 새 한국어 문구 0건.**
  ⓐ **catch가 갈래 셋을 지난다** — `handleApply`가 이미 쓰는 그 순서를 그대로 빌린다:
  ① **타임아웃이면 미리보기 전용 안내**(⚠️ 그 자리에서 `WRITE_TIMEOUT_MESSAGE`가 서지 않게
  막는 것이 이 갈래의 목적이다 — 미리보기는 **다시 눌러도 안전하다**. 문장은 패널이 이미 들고
  있는 타임아웃 안내 둘의 어법을 따른다), ② 아니면 `writeErrorMessage(err, 폴백)`,
  ③ 401은 종전 그대로 세션을 지운다.
  ⓑ **원인 단정 한 절 제거** — 폴백에서 **"CSV 형식을 확인하고"를 뺀다**(꼬리는 화이트리스트의
  `"다시 시도해 주세요."`). ⚠️ **이 트랙에서 문자열이 바뀌는 유일한 자리**이고, CSV 형식이 실제
  원인일 때는 **서버가 그 사유를 말한다.**
  ⓒ **대장 이동 한 줄** — `WRITE_ERROR_COPY_EXEMPT_SITES`의 `#bulk-preview` 항목을 지우고
  `WRITE_ERROR_COPY_SITES["src/components/ProductLinkBulkReplace.tsx"]`를 **1 → 2**로. 총합은
  **열넷 → 열다섯**. ⚠️ **`#recheck-current-state`·`#copy-csv-header` 두 면제는 그대로**
  (둘 다 화면에 세우는 문장이 없다 — 사유 바이트 불변).
  ⓓ **면제 사유의 판정을 값으로 고쳐 적는다** — *"쓰기가 아니다"* 와 *"사유를 버려도 된다"* 는
  다른 말이라는 사실, 그리고 **쓰기 단위의 대장이 읽기 의미의 POST를 하나 안고 있다**는 사실을
  그 자리에 적는다(다음 라운드가 그 예외를 다시 세지 않도록).
- **설계 긴장**: 여덟이다. ⓐ ⚠️ **`src/lib/write-error-copy.ts` 무접촉**(한 벌은 라운드 76이 세웠다 —
  이 트랙은 **부르기만** 한다). ⓑ ⚠️ **`src/lib/admin-api.ts` 무접촉**(트랙 B 소유 — 판정 함수
  `isTimeoutError`·`isIdempotentTimeoutError`·`isRetryUnsafeTimeoutError`는 **읽기만**).
  ⓒ **`handleApply`의 세 갈래·멱등키 회전·재조회·타임아웃 안내 두 문장 무변경**(라운드 64·R19-F가
  세운 자리 — 이 트랙은 **미리보기 catch 하나**다). ⓓ **`app/links/page.tsx` 무접촉**(트랙 D 소유 —
  이 패널이 렌더되는 조건 `role === "admin"`은 이미 옳다). ⓔ **CSV 파싱·표·행 오류 렌더 0건.**
  ⓕ **서버 0건**(`product-link-bulk.controller.ts`·DTO·서비스 무접촉). ⓖ **폴백 꼬리 화이트리스트
  셋 무변경**(새 꼬리를 만들지 않는다 — 그것이 이 부정 단언이 사는 방식이다). ⓗ DNC-018.

### 4. **`analyst`는 통하지 않는 저장 UI를 세 화면에서 본다 — 같은 저장소의 두 화면은 이미 정직하다** — 어드민·막다른 화면 — S

- **근거**: 라운드 76 리뷰 M-1이 **문장**을 고치며 이유로 적어 둔 그 사실이, **화면**에서는
  그대로 남아 있다(`src/lib/write-error-copy.ts:68-69` — *"어드민 내비에는 역할 제한이 없어
  `analyst` 계정도 준비템·링크·고지 문구 저장 UI까지 걸어 들어오고(쓰기 버튼만 `isEditor`로
  갈린다)"*).
  - **서버**: 준비템·링크·고지 문구의 직접 쓰기는 `@RequireAdminRoles("admin")`
    (`apps/api/src/admin/admin.controller.ts:69`·`:87`·`:111`·`:129`·`:186`). 편집자는 콘텐츠
    검토를 지난다(`content-revisions.controller.ts:64`·`:73`·`:92` = `admin, editor`).
    **`analyst`에게 열린 쓰기 경로는 0건이다.**
  - **어드민 화면**: 세 화면이 역할을 **`isEditor` 하나로만** 읽는다
    (`app/items/page.tsx:420` · `app/links/page.tsx:334` · `app/disclosures/page.tsx:129`).
    그래서 갈래가 둘뿐이다 — 편집자면 "검토 요청", **아니면 곧바로 저장**. ⚠️ **`analyst`는
    "아니면" 쪽에 떨어져 `admin`과 **똑같은 화면**을 본다**: [추가]·[저장] 버튼
    (`items:528`·`:663` · `links:470`·`:687` · `disclosures:88`·`:197`), 전체 입력 폼,
    성공 배너 문안까지.
  - ⚠️ **같은 저장소가 그 답을 두 번 적어 두었다.** `app/categories/page.tsx:55`는
    `const canEdit = session?.admin.role === "admin";` 로 갈리고 `:170-172`에 캡션 한 줄을 세운다 —
    *"지금 계정은 조회만 할 수 있어요. 수정은 관리자(admin) 권한이 필요해요."* 그 파일의
    `admin-api.ts` 쪽 근거 주석까지 있다(`:1136-1139` — *"조회는 모든 역할, 수정만 admin.
    그래서 /categories 페이지는 editor/analyst에게도 표를 보여주되 **편집 컨트롤만 감춘다**"*).
    `app/reviews/page.tsx:206`도 `isAdmin`으로 승인·롤백 버튼을 가린다(`:458`·`:544`).
    **다섯 화면 중 둘은 정직하고 셋은 아니다.**
  - **내비에는 이미 기계가 있다.** `AdminShell.tsx:26`의 `NAV_ITEMS`는 `roles?: AdminRole[]`를
    받고 `:75`가 그것으로 거른다 — 오늘 셋(`/users-lookup`·`/users`·`/audit-logs`)만 쓴다.
    ⚠️ **다만 이 축의 답은 내비를 감추는 것이 아니다** — `analyst`는 준비템·링크·고지를 **읽어야**
    한다(그것이 분석가의 일이다). 답은 `/categories`가 이미 고른 그 답, **편집 컨트롤만** 감추는
    것이다.
  - **오늘 이 사실을 무는 테스트는 0건이다**(실측): `src/content-revisions.test.ts:36`·`:46`·`:55`가
    세 화면에서 `session.admin.role === "editor"`를 확인하고, `:71`이 검토 화면의 `"admin"`을
    확인한다 — **`analyst`가 무엇을 보는지는 아무도 묻지 않는다.**
- **실패 시나리오**: 제휴 담당자가 `analyst` 계정을 받는다(클릭 통계·분석을 보는 것이 그의 일이다).
  준비템 관리에 들어가 시기 라벨 오타를 발견하고, 고칠 수 있어 보이므로 고친다. [저장]을 누른다.
  — 라운드 76 전이었다면 화면에 **"Admin access is required."** 라는 영문이 섰고, 오늘은
  *"저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."* 가 선다. **둘 다 그가 무엇을
  해야 하는지 말하지 않는다.** 그는 입력값을 고친다. 같은 문장. 다른 필드를 지운다. 같은 문장.
  결국 관리자에게 *"어드민이 고장 났다"* 고 보고한다. — 옆 탭(카테고리 관리)은 그 시각
  **"지금 계정은 조회만 할 수 있어요. 수정은 관리자(admin) 권한이 필요해요."** 라고 말하고 있다.
- **최소안**: **`/categories`가 이미 고른 답을 세 화면에. 새 한국어 문구 0건 · 서버 0건.**
  ⓐ **문장 하나를 한 자리로** — 오늘 `app/categories/page.tsx:171`에 인라인으로 있는 그 캡션을
  `apps/admin/src/lib/admin-role-copy.ts`(신설)의 상수 하나로 올리고, 카테고리 화면이 그것을
  import한다(⚠️ **문자열 바이트 불변** — 사본을 넷으로 늘리는 것이 P-4가 경고한 드리프트의 씨앗이다).
  ⓑ **세 화면이 `canEdit`을 읽는다** — `role === "admin" || role === "editor"`(편집자는 검토
  요청 경로가 **실제로 통한다**). `canEdit`이 거짓이면 폼의 제출 버튼을 내리고 그 자리에 ⓐ의
  캡션을 세운다. ⚠️ **`isEditor` 갈래는 한 글자도 바뀌지 않는다**(검토 요청 문안 넷·성공 배너
  둘·힌트 넷 전부 바이트 불변). ⚠️ **폼 자체는 남긴다**(읽기 권한자가 값을 보는 것은 정당하다 —
  `/categories`가 표를 남기는 것과 같은 판정).
  ⓒ **부정 단언 한 벌** — 쓰기가 `admin` 전용인 어드민 화면 전수에서 **제출 컨트롤이 역할
  게이트를 지날 것**. 오늘의 값은 **다섯**(카테고리·검토·준비템·링크·고지)이고, 그 목록과
  `NAV_ITEMS`의 `roles` 셋이 **서로 다른 축**이라는 사실도 값으로 적는다(내비 감춤 ≠ 컨트롤 감춤).
  ⓓ **쓰기 catch 수 무변경** — 라운드 76 B의 `WRITE_ERROR_COPY_SITES`가 세 화면에서 세는 자리
  (2·2·2)는 **하나도 늘거나 줄지 않는다**(컨트롤을 감출 뿐 catch를 지우지 않는다).
- **설계 긴장**: 아홉이다. ⓐ ⚠️ **`src/components/ProductLinkBulkReplace.tsx` 무접촉**(트랙 C 소유 —
  그 패널이 서는 조건 `app/links/page.tsx:454`의 `role === "admin"`은 **이미 옳고** 이 트랙이
  건드리지 않는다). ⓑ ⚠️ **`src/lib/write-error-copy.ts`·`src/admin-write-error-copy.test.ts`
  무접촉**(트랙 C) — 이 트랙은 **문장을 못 보게 하는 것이 아니라 그 문장에 닿을 일이 없게** 한다.
  ⓒ **`src/lib/admin-api.ts` 무접촉**(트랙 B). ⓓ **서버 0건**(`RequireAdminRoles` 데코레이터·
  가드·403 문장 무접촉 — 화면이 서버와 **같은 기준**을 읽을 뿐이다). ⓔ **`AdminShell.tsx` 무접촉**
  (내비 목록·`roles` 셋 무변경 — 이 축의 답이 아니다). ⓕ **`src/content-revisions.test.ts`의
  네 단언 무변경**(`isEditor` 갈래가 그대로라 초록으로 지난다). ⓖ **`app/reviews/page.tsx` 무접촉**
  (이미 `isAdmin`으로 갈린다). ⓗ **`admin-canonical-mirrors.test.ts` 무접촉**(⚠️ 신설 모듈은
  **문자열 상수 하나**이지 `Record` 표가 아니다 — 상수 표 전수 스크레이프의 단위가 아니라는 사실을
  주석 한 줄로). ⓘ DNC-018 · DNC-008(앱의 역할과 다른 축이다 — 어드민 콘솔 역할 셋이다).

### 5. **초대 화면은 훅이 만든 완성 문장을 불리언 한 칸으로 읽고 버린다 (Q-1 P-3 잔여, 채택)** — 모바일·구조 — S

- **근거**: 라운드 76 리뷰 P-3이 값으로 남긴 자리이고, 오늘 다시 재도 같다.
  - `app/family/invite.tsx:162-165`:
    ```
    const inviteSaveErrorCopy = useSaveErrorCopy(invite.isError, invite.error);
    const inviteCreateErrorText = inviteCreateErrorMessage(invite.error, {
      isOnline: inviteSaveErrorCopy !== OFFLINE_SAVE_NOTICE
    });
    ```
    훅이 돌려주는 것은 **완성된 문장**이다(`resolveSaveErrorCopy` — `src/offline/messages.ts:650-654`:
    **아는 코드 → 오프라인 → 폴백** 순서). 화면은 그 문장을 **한 번 비교하고 버린 뒤** 문장을
    모듈에서 다시 받는다.
  - ⚠️ **그래서 "서버가 코드로 말한 실패"의 문장은 이 화면에 구조적으로 설 수 없다.**
    아는 코드가 오면 훅의 답은 `OFFLINE_SAVE_NOTICE`가 아니므로 `isOnline: true`가 되고, 모듈은
    **일반 폴백**(`INVITE_CREATE_FAILED_MESSAGE`)을 돌려준다. 라운드 76은 이 파생을 의도로 적고
    단언까지 세웠다(`invite-permissions.test.ts:131-145` — *"서버가 코드를 준 실패는 오프라인으로
    읽히지 않는다"*). **그 단언은 참이고, 참인 채로 문장을 버린다.**
  - **오늘 결함이 아닌 이유**: 초대 생성이 서버에서 얻는 코드는 `FORBIDDEN` 하나이고
    (`household-runtime.service.ts:321`~ — owner 전용 403), 그것은 모듈의 **첫 갈래**가 이미
    전용 문장으로 답한다(`INVITE_FORBIDDEN_MESSAGE`). 두 판정이 오늘 같은 값으로 수렴한다.
  - ⚠️ **그 표는 자란다.** `API_ERROR_MESSAGES`는 라운드마다 코드를 받아 왔고, **이번 라운드
    후보 1이 둘을 더한다.** 초대 경로에 코드가 하나 생기는 날(예: 초대 개수 상한·이미 구성원)
    화면은 **아무 단언도 깨지 않은 채** 일반 문장을 말한다.
  - **형제 화면은 반대다.** `app/family/accept/[token].tsx:367`은 훅의 문장을 **그대로 그린다**
    (`acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(...)`).
    **한 여정의 두 화면이 같은 훅을 정반대로 쓴다.**
- **실패 시나리오**(오늘이 아니라 다음 라운드의 어느 날): 서버가 초대 생성에 상한을 건다
  (`HOUSEHOLD_INVITE_LIMIT` — *"대기 중인 초대가 너무 많아요. 먼저 정리해 주세요."*). 앱 전역 표에
  한 줄이 오르고, 다른 화면들은 그날부터 그 문장을 말한다. **초대 화면만 말하지 않는다** —
  *"초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요."* 엄마는 30초 뒤 다시 누른다.
  정리해야 할 대기 초대 다섯 개는 **바로 전 화면**(가족 관리)에 목록으로 떠 있다.
- **최소안**: **버리던 값을 쓴다. 두 문자열 바이트 불변 · 오늘의 출력 전부 바이트 불변.**
  ⓐ **모듈이 인자 하나를 더 받는다** — `inviteCreateErrorMessage(error, { isOnline, serverCopy })`:
  **403 → 오프라인 → 서버가 말한 문장 → 초대 전용 폴백**. `serverCopy`가 `SAVE_ERROR_NOTICE`
  (= 훅도 모르는 실패)면 종전대로 `INVITE_CREATE_FAILED_MESSAGE`다.
  ⚠️ **오프라인 문장은 `OFFLINE_RETRY_NOTICE` 그대로**(초대는 "저장"이 아니라 "만들기"라
  `OFFLINE_SAVE_NOTICE`를 그대로 쓰면 *"연결된 뒤 다시 **저장**해 주세요"* 가 된다 — 라운드 76이
  그 갈래를 고른 이유다).
  ⓑ **화면 한 줄** — 이미 계산해 둔 `inviteSaveErrorCopy`를 `serverCopy`로 함께 넘긴다.
  ⚠️ **`isOnline` 파생은 그대로 둔다**(`!== OFFLINE_SAVE_NOTICE` — 라운드 76의 그 단언이 무엇을
  뜻하는지 값으로 적혀 있고, 이 트랙은 그 뜻을 **바꾸지 않고 나머지 절반을 쓴다**).
  ⓒ **부정 단언 둘** — ① 오늘 도달 가능한 모든 입력에서 답이 **종전과 바이트가 같을** 것
  (403 · 오프라인 · 모르는 실패 · null/undefined), ② 표에 코드가 하나 늘면 그 문장이 화면에
  **실제로 선다**는 것을 표의 아무 코드로나 재현할 것(그 재현이 이 트랙의 본체다).
- **설계 긴장**: 일곱이다. ⓐ ⚠️ **`src/offline/**` 전부 무접촉** — 화면이 `useSaveErrorCopy(`를
  계속 부르므로 `OFFLINE_AWARE_SAVE_ERROR_SCREENS`는 **다섯 그대로**이고, 모듈이 `isOnline`을
  계속 받으므로 모듈 대장 셋(**6·8·2**)도 **한 줄도 바뀌지 않는다**(⚠️ 이 조건이 트랙 A·E를
  파일로 갈라 놓는 근거다). ⓑ **두 문자열 바이트 불변**(`INVITE_CREATE_FAILED_MESSAGE` ·
  `INVITE_FORBIDDEN_MESSAGE`)·**판정 순서에서 403이 첫째**. ⓒ **서버 0건**(초대 생성 API·TTL·
  토큰 해시 무접촉). ⓓ **`app/family/index.tsx`·`accept/[token].tsx`·`member-mutation-messages.ts`
  무접촉**(셋 다 이미 배선돼 있다 — 본보기를 만지지 않는다). ⓔ **`src/api/api-error.ts` 무접촉**
  (트랙 A 소유 — 이 트랙은 표를 **읽는 경로를 열기만** 한다). ⓕ **진입점 잠금 판정
  (`isInviteEntryPointLocked`)·`INVITE_SCOPE_NOTICE`·역할 선택 UI 무변경** · 픽셀락 FAM-002 무접촉.
  ⓖ DNC-018.

## P3

- **`"시도해 주세요"` vs `"시도해주세요"` — 재실측했고, 이번 라운드도 통일하지 않는다.**
  2026-08-30 실측(주석·테스트 제외, `app/**`+`src/**`): 띄어 쓴 쪽 **31건 / 파일 열여덟**(라운드 76의
  30에서 하나 늘었다 — 트랙 A의 대장 문장), 붙여 쓴 쪽 **10건 / 파일 셋**
  (`src/auth/kakao-login.ts` 7 · `src/export/ExpenseCsvExport.tsx` 2 · `src/export/expense-page-collector.ts` 1).
  **Q-1이 남긴 수치와 동일하다.** 기각 사유도 그대로다(둘 다 어법상 허용 · 거짓이 아님 ·
  어느 트랙의 축도 아님). ⚠️ **다만 이번 라운드가 그 대가를 한 번 더 확인했다**: 후보 1이 표에
  새 문장을 넣는데, 그 문장이 붙여 쓴 방언을 쓰면 방언 파일이 **넷**이 된다. **트랙 A의 금지
  조항에 "띄어 쓴 표기"를 명시로 적는다** — 통일하지 않기로 한 결정이 값을 치르는 자리는
  이제 **새 문장을 짓는 순간**이다.
- **`withdrawn_at` 컬럼 — 보류 유지(마이그레이션 0건 원칙).** 라운드 75 P-1 → 76 Q-4가 남긴
  구조 그대로다: 파기 잡이 탈퇴 시각을 아는 방법은 `updated_at` 하나뿐이고
  (`data-retention-purge.job.ts:1053` · 그 사실이 `:378-380` 주석에 값으로 적혀 있다), 탈퇴 계정의
  `users` 행을 쓰는 **새 경로가 생기면** 같은 결함이 돌아오는데 그 부정 단언은 침묵한다.
  ⚠️ **이번 라운드의 어느 트랙도 `apps/api/src/auth/**`·`users` 테이블·파기 잡을 열지 않는다.**
  컬럼 신설은 여전히 **별도 결정**이다.
- **S-4 후속(파기 phase 3의 `targetId`) — 기각. 제품 표면에 허위 문장이 0건이다.**
  실측: phase 3이 null로 바꾸는 것은 `actorUserId` 하나이고(`data-retention-purge.job.ts:1109-1112`),
  `targetType: "users"` 행의 `targetId`는 남는다 — **그 사실은 라운드 76 리뷰 S-4가 이미
  잡 주석(`:388-396`)에 값으로 적어 고쳤다.** 오늘 물어야 할 것은 *"그 값을 지울 것인가"* 인데,
  ⓐ 앱·어드민 어디에도 *"탈퇴하면 감사 로그가 익명화된다"* 는 문장이 **없고**
  (`apps/mobile`의 `익명` grep은 분석 동의 문구 셋뿐이다), ⓑ 지우면 *"누구에 대한 조치였는가"*
  라는 **감사 기록의 본체**가 사라진다. **허위 표시 축이 아니라 보존 정책 결정**이고, 그 판단은
  P-2(법무)와 같은 성질이다. **다음 라운드가 다시 세지 않도록 이 근거를 남긴다.**
- **L-1의 큰 질문(여정 목록) — 여전히 열려 있고, 이번 라운드도 목록을 신설하지 않는다.**
  실측: 저장소에서 여정 단위의 서버 파일 목록을 가진 것은 오늘도 **하나뿐**이다
  (`IMPORT_JOURNEY_SERVER_FILES` — 라운드 76 C 이후 **셋**). 커머스 여정에는 그런 목록이 없다.
  ⚠️ **다만 후보 1이 그 여정에 **목록 없이** 답한다** — 코드를 앱 전역 표에 편입하면 그 여정의
  실패 문구는 **여정을 정의하지 않고도** 정직해진다(라운드 76 Q-3이 이름 붙인 그 구분:
  *"여정을 정의하지 않고도 물을 수 있던 질문"*). **여정 목록 신설은 이번에도 별도 결정이다.**
- **준비템 탭의 비가상화 렌더 — 실측했고 N-4의 문턱 아래라 제안하지 않는다.**
  사실: `app/(tabs)/items.tsx`는 `AppScreen`(ScrollView) 안에서 `.map`으로 행을 그린다 —
  기록 탭(SectionList)·동기화 상태(FlatList)·엑셀 검수(FlatList)가 PERF-102 이후 옮겨 간 그
  구조가 아니다. **오늘의 상한은 카탈로그 62행**이고(선행 확인 2), 화면이 실제로 그리는 것은
  밴드·필수도·상태 필터를 지난 `listedItems`라 그보다 **적다**. PERF-102가 기록 탭을 옮긴 근거는
  *"a month of heavy use is hundreds of rows"*(`records.tsx:152`)였고 **여기는 그 문턱이 아니다.**
  ⚠️ N-4의 기각 조건(*"새 실측이 먼저 있어야 한다"*)을 지켜 **재었고 넘지 않았다**고 적는다.
  다시 볼 트리거: 어드민 카탈로그가 **200건**을 넘거나, 한 밴드의 표시 행이 100을 넘는 날.
- **`app/expenses/new.tsx:1258` 등 손배선 연결 폴 다섯 — 결함 아님(전수 확인).**
  `useErrorTimeConnectivity`(라운드 72 E) 밖에 남은 `isCurrentlyOnline()` 호출은 다섯이고
  (`expenses/new.tsx:1258` · `items/[itemTemplateId].tsx:517` · `family/index.tsx:251` ·
  `import/index.tsx:214` · `export/ExpenseCsvExport.tsx:381`), **라운드 52 C-07이 없앤 두 구멍
  (언마운트 setState · 늦게 도착한 옛 판정)이 서는 자리는 하나도 없다**: 넷은 setState를 하지
  않고(분석 페이로드 하나 · `Alert.alert` 둘 · 토스트 하나), 커머스 상세는 `linkNoticeSeqRef`
  걸쇠로 두 구멍을 **직접** 막는다(`:493-503`·`:516-521`). **후보 아님 — 다음 라운드가 같은
  스윕을 다시 돌리지 않도록 적어 둔다.**
- **`admin-write-error-copy.test.ts:325`의 이름은 트랙 B 뒤에 낡는다(접점 하나).**
  그 테스트(*"연결 실패도 admin-api.ts가 만든 문장 그대로 닿는다"*)는 오류를 **손으로 만들어**
  검사하므로 트랙 B가 머지돼도 **초록이다**. 다만 문장이 갈래 셋이 된 뒤에는 이름이 절반만
  맞는다. ⚠️ **B를 C보다 먼저 머지하면** C가 그 파일을 여는 김에 한 줄을 정리한다(파일 소유는
  C 하나 그대로다).
- **어드민 카탈로그 전량 조회 · known-limitations M-3 잔여 · `ApplicationPrimitives.tsx:151-153`의
  정규식 제목 판정 · 미출처 틴트 `#fdeee6` 둘 · `docs/5차/round55-plan.md:258`의 GFM 셀 수 ·
  라운드 74 C의 `"11/11"` 부정 스윕 · `itemMatchesBand`의 `timingLabel` 폴백 사문 ·
  `app/(tabs)/reports.tsx`의 임신 중 보장된 400 1건 · 첫돌 이후 마일스톤 고착 ·
  가져오기 확정 칸 1건 · `AuthService.refresh`가 `user.status`를 보지 않는다 ·
  api 테스트 하네스의 동시 실행 구멍 · 서버 중복 아이 가드 부재(M-1 · DNC-007) ·
  발행 `before` 경합 · `monthly_wrapup` 콜드 스타트 시점 · 크래시 파이프라인 부재 ·
  서버 stdout의 두 로그 형식(O-1)** — 라운드 62~76이 남긴 그대로이고 **상태 변화가 없다.**
- **`worker-jobs` ScheduledPublishJob 플레이크 · `storage: "ok"` 초기값 · `"무료배송"` ·
  알림 벨 🔔 — 무접촉 유지.** 재검토 트리거는 이번에도 발동하지 않았다.
  ⚠️ **api vitest를 이번 라운드는 돌리지 않았다**(정찰에 불필요) — 플레이크 관찰 기록 없음.
- **제외 목록 준수 확인**: 준비템 목록 **가격 표시**(라운드 64 트랙 B — 사용자 결정 대기) ·
  오프라인 로컬 아이 복구 · 외부 계정/키/자산 · **C-3 잠금 오버레이 낭독**(실기기 필요 —
  오늘로 **열한 라운드 연속** 미확인, 표기만 갱신) · **P-2 법무 대조**(항목 이름 1:1) ·
  **P-3 테스트 건수 자동화**(라운드 76이 실측 기각 — 재론 없음) · **C/E 인용 두 방언**(판정 완료) ·
  40주 초과 달력 · `onBudgetRelevantChange` · 4가구/`viewedHouseholdId`.
  **이번 라운드의 어느 트랙도 이 자리들을 열지 않는다.**

## 코드 건강 판정

- **⚠️ 가장 값진 관측: "다시 시도해 주세요"가 이 저장소의 **기본값**이고, 그 기본값이 옳은지를
  묻는 자리가 층마다 따로 있다.** 라운드 70~76은 그 물음을 여정별로 닫아 왔다 — 저장(70 B) ·
  조회(72~75) · 모듈(76 A) · 어드민 쓰기(76 B). 이번에 나온 셋은 **여정이 아니라 층**으로 갈렸다:
  사용자의 즉시 요청(후보 1) · 클라이언트 전송 계층(후보 2) · 검증 전용 요청(후보 3).
  셋 다 "재시도가 통하는가"를 **아는 코드가 바로 옆에 있는데** 묻지 않았다.
- **⚠️ 버리는 것이 방패 노릇을 하고 있던 자리가 둘 나왔다.** ⓐ CSV 미리보기 catch는 사유를
  통째로 버려서 **쓰기 타임아웃 문구가 화면에 서지 않는다**(후보 3) — 사유를 나르는 순간 그
  거짓이 드러난다. ⓑ 초대 화면은 훅의 문장을 버려서 **표가 자라도 아무 일이 없다**(후보 5).
  **결함을 가리는 결함은 고치는 순서를 뒤집는다** — 나르기 전에 판정을 먼저 세워야 한다는 것이
  이번 라운드가 트랙 C에 갈래 셋을 요구하는 이유다.
- **제외의 이유가 둘이면, 하나가 거짓이 되어도 조용하다.** `api-error.test.ts:465`의
  `PRODUCT_LINK_NOT_FOUND` 제외는 이유를 둘 적었다 — *"아웃박스를 타지 않는다"*(계약의 단위,
  참) + *"그 화면이 자기 문구를 쓴다"*(오늘 거짓을 나른다). 라운드 76이 Q-1에서 얻은 문장
  (*"면제는 '판정을 안 지난다'가 아니라 '이 스윕이 요구하는 배선이 없어도 된다'이고, 둘을 같은
  낱말로 적으면 다음 라운드가 그 자리를 다시 연다"*)의 쌍둥이다 — **면제 사유는 그 스윕의
  단위로만 적어야 하고, 그 밖의 사실은 사유가 아니라 관측이다.**
- **같은 저장소가 같은 물음에 이미 답해 둔 자리를 먼저 찾는 것이 이번에도 가장 값쌌다.**
  후보 2의 답은 30줄 위 `AdminApiTimeoutError`에, 후보 3의 답은 30줄 아래 `handleApply`에,
  후보 4의 답은 옆 탭 `/categories`에 **문장까지 완성된 채** 있었다. 다섯 후보 중 **새 한국어
  문장이 필요한 것은 후보 2 하나**(연결 실패의 쓰기 갈래 둘)이고, 그마저 기존 문장을 그대로
  쓸 수 없는 이유가 명확하다(*"(60초)"* 가 거짓이 된다).
- **이번 라운드의 계약도 전부 파생/부정/전수다.** 다섯 후보가 살아남은 이유가 같다 —
  *표가 그 코드를 밖에 뒀다* · *연결 실패가 판정을 지나지 않는다* · *면제가 사유를 버린다* ·
  *역할 게이트를 세는 것이 없다* · *훅의 문장을 세는 것이 없다*. 다섯 다 **어떤 단언도 깨지 않는
  사실**이다. 그래서 계약도 같은 모양으로 선다: 코드 표 ↔ 서버 스윕(교집합) · 문장 ↔ 메서드·멱등
  판정(파생) · 폴백 꼬리 화이트리스트(부정) · 제출 컨트롤 ↔ 역할(전수) · 훅 출력 ↔ 화면 문장(파생).
- **큰 파일 판정 유지.** 트랙이 여는 파일 중 1,000줄을 넘는 것은 셋이다
  (`apps/mobile/app/items/[itemTemplateId].tsx` 1,206 · `apps/admin/src/lib/admin-api.ts` ·
  `apps/admin/app/links/page.tsx`)이고 셋 다 만지는 것은 **catch 한 자리 · throw 한 줄 · 렌더 게이트
  두 자리**다. 이번 라운드도 그 축을 팔지 않는다.
- **이월 정산.** 이월 여섯 중 **셋을 채택**(Q-2 잔여 → 트랙 C · S-3 후속 → 트랙 B ·
  Q-1 P-3 → 트랙 E), **둘을 실측 기각**(Q-1 표기 방언 — 수치 동일·거짓 아님 / S-4 targetId —
  제품 표면에 허위 0건, 보존 정책 결정), **하나를 보류 유지**(`withdrawn_at` — 별도 결정),
  **L-1 큰 질문은 열어 둔 채** 그 여정에 목록 없이 답하는 길을 하나 냈다(트랙 A).
  자유 발굴로 **둘**을 더했고 둘 다 **핵심 루프의 오른쪽 절반**에 있다(후보 1 = 사용자의 4단계 ·
  후보 4 = 그 카탈로그를 만드는 사람의 화면).

## 트랙 구성 (파일 단위 상호 배타)

- **A 구매 링크 클릭 실패가 이유를 말한다** (#1) — **즉시 착수 가능 · 핵심 루프**
  - 소유: `apps/mobile/src/api/api-error.ts`(⚠️ **표 두 줄** — `PRODUCT_LINK_NOT_FOUND` ·
    `PRODUCT_LINK_URL_SCHEME_INVALID`) · `apps/mobile/src/api/api-error.test.ts`(⚠️ **제외 사유
    정정 + 새 두 줄의 부정 단언**) · `apps/mobile/app/items/[itemTemplateId].tsx`(⚠️ **`clickLink`의
    `onError` 한 자리**)
  - 읽기: `apps/api/src/onboarding/items-catalog.service.ts`(`:411-424`) · `src/offline/messages.ts`
  - 금지: **서버 0건**(코드·문장·허용 목록·클릭 행·`/r/:code` 무접촉) ·
    **오프라인 갈래 무변경**(`showLinkFailure`의 폴 한 번 · `linkNoticeSeqRef` 걸쇠 ·
    라운드 60 #4의 **성공 후 등록** 시점) · `registerPurchaseFollowup`·`retryOpenFallbackLink`·
    `shareFallbackLink`·`canSharePurchaseLink` **무접촉** · `src/items/link-marker.ts` **무접촉**
    (DNC-010/011) · ⚠️ **`src/offline/**` 0건**(모듈 대장 셋 6·8·2 · 화면 목록 다섯 · 두 스윕) ·
    `app/family/**` 0건(트랙 E) · **종전 폴백 문장 바이트 불변** ·
    ⚠️ **새 문장은 `"잠시 후 다시"`를 쓰지 않고 띄어 쓴 표기(`"확인해 주세요"`)를 쓴다**(P3) ·
    DNC-018
  - 계약: ⓐ **아는 코드면 그 문장이, 모르면 종전 문장이** 설 것(오프라인 폴은 **모르는 실패에서만**
    돈다 — 서버가 답했다는 사실이 곧 연결이 있었다는 뜻이다). ⓑ **부정 단언** — 두 새 문장 어느
    쪽도 `"잠시 후 다시"`를 담지 않을 것(`LINKED_PRODUCT_LINK_NOT_FOUND`가 지는 그 단언과 같은 모양).
    ⓒ **아웃박스 교집합 계약이 초록인 채로** 제외 둘이 표로 옮겨 갈 것(그 계약이 허용하는 두 답 중
    하나다 — 단언 문장 불변). ⓓ 제외 목록에 남는 사유는 **그 스윕의 단위(아웃박스)로만** 적힐 것.

- **B 어드민 연결 실패도 R19-F 판정을 지난다** (#2) — **A와 완전 독립, 즉시 착수 가능**
  - 소유: `apps/admin/src/lib/admin-api.ts`(⚠️ **`request()`의 연결 실패 throw 한 줄 →
    메서드·멱등 갈래 셋**) · `apps/admin/src/lib/admin-api.test.ts`
  - 금지: ⚠️ **`src/lib/write-error-copy.ts`·`src/admin-write-error-copy.test.ts` 무접촉**(트랙 C) ·
    ⚠️ **`src/lib/load-error-copy.ts`·`src/admin-load-error-copy.test.ts` 무접촉**(조회 열여섯) ·
    **`app/**`·`src/components/**` 0건** · **읽기(GET) 문장 바이트 불변** ·
    **타임아웃 갈래 셋 무변경**(`READ/WRITE/IDEMPOTENT_WRITE_TIMEOUT_MESSAGE` · `retryUnsafe` ·
    상한 10초·60초 · `AdminApiTimeoutError` 필드) · **`AdminApiError` 타입·상속 구조 무변경**
    (새 클래스 0건 — 소비 쪽이 한 글자도 바뀌지 않아야 한다) · **멱등키 홀더·CSRF·`credentials`
    무변경** · **4xx/5xx 응답 본문 매핑 무변경**(`:552`의 폴백 문장 포함) · **서버 0건** ·
    마이그레이션 0건 · DNC-018
  - 계약: ⓐ **파생 단언** — 연결 실패 문장이 `STATE_CHANGING_METHODS`와 `Boolean(idempotencyKey)`
    **둘로만** 갈릴 것(타임아웃 갈래가 쓰는 그 두 값 그대로 — 판정을 새로 만들지 않는다).
    ⓑ **부정 단언** — 비멱등 쓰기의 연결 실패 문장이 `"다시 시도해 주세요"`로 **끝나지 않을** 것.
    ⓒ GET의 연결 실패가 **오늘의 문자열 그대로**일 것(⚠️ `admin-load-error-copy.test.ts:613`이
    이미 그 리터럴을 소스에서 찾으므로, 이 트랙이 그 파일을 열지 않고도 안전망이 선다).
    ⓓ 멱등 쓰기의 연결 실패는 **중복 없이 처리된다는 사실**을 말할 것(오늘 열여덟 vs 여섯이라는
    수치를 테스트에 값으로 남긴다).

- **C 미리보기 실패가 원인을 단정하지 않는다** (#3) — **A·B와 독립**
  - 소유: `apps/admin/src/components/ProductLinkBulkReplace.tsx`(⚠️ **`handlePreview`의 catch 하나**) ·
    `apps/admin/src/admin-write-error-copy.test.ts`(⚠️ **면제 → 대장 이동 · 총합 열넷 → 열다섯**)
  - 읽기: `apps/admin/src/lib/admin-api.ts`(`isTimeoutError`·`isIdempotentTimeoutError`·
    `isRetryUnsafeTimeoutError` — **읽기만**) · `src/lib/write-error-copy.ts`
  - 금지: ⚠️ **`src/lib/write-error-copy.ts` 무접촉**(한 벌은 라운드 76이 세웠다 — 부르기만) ·
    ⚠️ **`src/lib/admin-api.ts` 무접촉**(트랙 B) · **`handleApply`의 세 갈래·멱등키 회전·
    `recheckCurrentState`·타임아웃 안내 두 문장 무변경** · **`#recheck-current-state`·
    `#copy-csv-header` 두 면제의 사유 바이트 불변** · **폴백 꼬리 화이트리스트 셋 무변경**
    (`ACTION_TAILS` — 새 꼬리를 만들지 않는다) · **CSV 파싱·행 오류 표·요약 렌더 0건** ·
    `app/links/page.tsx` **무접촉**(트랙 D) · **서버 0건** · DNC-018
  - 계약: ⓐ 미리보기 catch가 **갈래 셋**을 지날 것(401 → 타임아웃 전용 안내 → 서버 사유/폴백).
    ⓑ ⚠️ **부정 단언** — 미리보기 실패에 **`WRITE_TIMEOUT_MESSAGE`가 서지 않을** 것
    (*"반영 여부가 확실하지 않으니"* 는 아무것도 쓰지 않는 요청에 대한 거짓이다).
    ⓒ 폴백에서 **원인 단정 한 절이 사라질** 것 — 라운드 76 B의 ⓔ 부정 단언이 **고치기 전에
    빨갛다**(대장에 들어오는 순간 꼬리 화이트리스트가 거른다).
    ⓓ 대장 총합이 **열넷 → 열다섯**이고 남은 면제 셋의 이유가 **빈 문자열이 아닐** 것.

- **D 통하지 않는 저장 UI를 세우지 않는다** (#4) — **A·B·C와 독립**
  - 소유: `apps/admin/app/items/page.tsx` · `apps/admin/app/links/page.tsx` ·
    `apps/admin/app/disclosures/page.tsx`(⚠️ **셋 다 제출 컨트롤에 `canEdit` 게이트**) ·
    `apps/admin/app/categories/page.tsx`(⚠️ **인라인 캡션 → 공용 상수 import, 문자열 바이트 불변**) ·
    `apps/admin/src/lib/admin-role-copy.ts`(신설 — **문자열 상수 하나**) ·
    `apps/admin/src/admin-write-role-gate.test.ts`(신설)
  - 읽기: `apps/api/src/admin/*.controller.ts`의 `RequireAdminRoles` · `src/components/AdminShell.tsx`
  - 금지: ⚠️ **쓰기 catch를 지우거나 더하지 않는다**(라운드 76 B의 `WRITE_ERROR_COPY_SITES`가
    세 화면에서 세는 **2·2·2**가 불변 — 컨트롤을 감출 뿐이다) ·
    ⚠️ **`isEditor` 갈래 바이트 불변**(검토 요청 문안·성공 배너·힌트 전부) ·
    `src/components/ProductLinkBulkReplace.tsx`·`src/lib/write-error-copy.ts`·
    `src/admin-write-error-copy.test.ts` **무접촉**(트랙 C) · `src/lib/admin-api.ts` **무접촉**(트랙 B) ·
    `src/components/AdminShell.tsx`·`NAV_ITEMS`·`roles` 셋 **무접촉**(내비를 감추는 것이 답이 아니다) ·
    `app/reviews/page.tsx`·`app/users/page.tsx`·`app/audit-logs/page.tsx`·`app/users-lookup/page.tsx`
    **무접촉**(넷 다 이미 `isAdmin`으로 갈린다) · **폼·표·읽기 렌더 무변경**(읽기 권한자는 값을
    본다) · **서버 0건**(가드·데코레이터·403 문장) · **새 한국어 문구 0건** · DNC-018
  - 계약: ⓐ **전수 단언** — 쓰기가 `admin` 전용인 어드민 화면(오늘 **다섯**)의 제출 컨트롤이
    예외 없이 역할 게이트를 지날 것. ⓑ `canEdit`의 뜻이 **서버와 같을** 것(`admin` 직접 저장 ·
    `editor` 검토 요청 · `analyst` 없음 — 세 역할 전수). ⓒ **부정 단언** — 캡션 문자열의 사본이
    저장소에 **하나뿐**일 것(카테고리 화면의 인라인이 사라지고 상수만 남는다). ⓓ **내비 게이트와
    컨트롤 게이트는 서로 다른 축**이라는 사실을 값으로(`NAV_ITEMS`의 `roles` 셋은 무변경).

- **E 초대 화면이 훅의 문장을 쓴다** (#5) — **A·B·C·D와 독립 · 가장 작다**
  - 소유: `apps/mobile/app/family/invite.tsx`(⚠️ **인자 하나 추가 — 한 줄**) ·
    `apps/mobile/src/family/invite-permissions.ts`(⚠️ **갈래 하나 삽입**) ·
    `apps/mobile/src/family/invite-permissions.test.ts`
  - 읽기: `src/offline/messages.ts` · `src/api/api-error.ts`
  - 금지: ⚠️ **`src/offline/**` 전부 무접촉**(`OFFLINE_AWARE_SAVE_ERROR_SCREENS` **다섯 그대로** ·
    모듈 대장 셋 **6·8·2 그대로** · 두 스윕 · `use-load-error-copy.ts` · `messages.ts`) ·
    **두 문자열 바이트 불변**(`INVITE_CREATE_FAILED_MESSAGE`·`INVITE_FORBIDDEN_MESSAGE`) ·
    **403이 첫 갈래**(연결 판정보다 앞) · **오프라인 문장은 `OFFLINE_RETRY_NOTICE`**(`OFFLINE_SAVE_NOTICE`가
    아니다 — 초대는 "저장"이 아니다) · **`isOnline` 파생 표현 무변경**(`!== OFFLINE_SAVE_NOTICE`) ·
    `src/api/api-error.ts` **무접촉**(트랙 A) · `app/family/index.tsx`·`accept/[token].tsx`·
    `src/family/member-mutation-messages.ts`·`invite-flow.ts` **무접촉** · **서버 0건** ·
    진입점 잠금 판정·`INVITE_SCOPE_NOTICE`·역할 선택 UI 무변경 · 픽셀락 FAM-002 무접촉 · DNC-018
  - 계약: ⓐ **오늘 도달 가능한 모든 입력에서 답이 바이트 불변**일 것(403 · 오프라인 ·
    모르는 실패 · null/undefined — 라운드 76의 단언 문장을 그대로 두고 갈래만 는다).
    ⓑ **표에 코드가 하나 늘면 그 문장이 화면에 실제로 선다**는 것을 표의 아무 코드로나 재현할 것
    (이 트랙의 본체다). ⓒ **판정 순서 네 칸**(403 → 오프라인 → 서버 문장 → 초대 전용 폴백)이
    값으로 적힐 것. ⓓ 형제 화면(`accept/[token].tsx`)이 훅의 문장을 **그대로 쓰는** 것과 이제
    같은 축이라는 사실을 주석 한 줄로(두 화면이 갈라져 있던 이유가 값으로 남는다).

- **F 판정·접근성 표·확인의 표·출시 현황** — **A·B·C·D·E 머지 후**
  - 소유: `docs/operations/known-limitations.md` · `docs/qa/runtime-verification-required.md` ·
    `docs/qa/accessibility-offline-checklist.md` · `docs/5차/launch-readiness-status.md`
  - 금지: **제품 소스 0건** · `packages/test-utils/**` **무접촉**(§0 수치를 세는 계약은 라운드 75가
    세웠다 — 이 트랙은 **표를 갱신**하고 그 계약이 다시 센다) ·
    `packages/test-utils/src/repo-self-description.test.ts` **무접촉**(`OWNED_DOCS`·읽기 전용 가드·
    옛 수치 스윕 — `"11/11"` 문제는 P3 유지) ·
    `docs/store/**`·`infra/legal/**`·`README.md`·`AGENTS.md`·`CODEX_START_HERE.md` **무접촉** ·
    **행 삭제 0건 · 행 번호 불변**(#1~#118) · 각 행의 문장·기대 동작·근거 파일·부정 조건
    **바이트 불변** · **표면 값 재분류 0건** · K~Q절의 **판정을 다시 쓰지 말 것**
    (Q-1·Q-2는 **갱신 한 줄**씩만)
  - 계약: ⓐ **known-limitations에 R절을 신설**하고 이번 라운드가 확정한 판정 다섯을 남길 것 —
    (1) **핵심 루프 4단계의 막다른 문장**(서버가 코드로 말한 두 실패가 앱 표 밖에 있었다는 사실 ·
    ⚠️ **제외의 이유가 둘이면 하나가 거짓이 되어도 조용하다**는 판정 · 그 제외 사유는 **그 스윕의
    단위로만** 적는다는 규율),
    (2) **연결 실패의 판정 공백**(타임아웃에는 R19-F 판정 셋이 있고 연결 실패에는 없었다는 사실 ·
    멱등키 없는 쓰기 **열여덟** vs 멱등 **여섯** · ⚠️ `fetch`의 거절이 "보내지 못했다"와 "답을 못
    받았다"를 구분하지 않는다는 사실),
    (3) **버리는 것이 방패였다**(미리보기 catch가 사유를 버려 **쓰기 타임아웃 문구의 거짓**을
    가리고 있었다는 사실 · 쓰기 단위 대장이 **읽기 의미의 POST** 하나를 안게 됐다는 사실 ·
    ⚠️ 라운드 76 B의 ⓔ 부정 단언이 **고치기 전에 빨갰다**는 사실),
    (4) **역할 게이트의 세 번째 상태**(`isEditor` 하나로 갈린 화면 셋에서 `analyst`가 `admin`의
    화면을 본다는 사실 · 같은 저장소의 두 화면이 이미 답을 적어 두었다는 사실 · ⚠️ **내비 감춤과
    컨트롤 감춤은 다른 축**이라는 판정),
    (5) **훅의 문장을 불리언으로 읽는 구조**(Q-1 P-3의 종결 · 오늘 결함이 아니었던 이유와,
    표가 자라는 순간 결함이 되는 이유 · 형제 화면과 축이 같아졌다는 사실).
    ⓑ **Q-1 갱신 한 줄**: 표기 방언 수치는 그대로이고(31/18 · 10/3), **새 문장을 짓는 순간이
    그 결정이 값을 치르는 자리**라는 사실. ⓒ **Q-2 갱신 한 줄**: 미리보기 잔여가 닫혔고, 남은
    면제 셋의 성질(화면에 문장을 세우지 않는 자리)이 다르다는 사실. ⓓ **L-1 갱신 한 줄**:
    커머스 여정에 **목록 없이** 답했다는 사실과 큰 질문은 그대로라는 사실. ⓔ **N-4 갱신 한 줄**:
    준비템 탭 렌더를 **재었고 문턱 아래**였다는 사실과 다시 볼 트리거(카탈로그 200건 · 한 밴드
    100행). ⓕ 접근성 표: 라운드 77분을 **A-18**로 세울 것(구매 링크 실패 문구 · 어드민 연결 실패
    문구 · 미리보기 실패 문구 · **역할 캡션 세 화면** — Toast·배너의 낭독 경로는 이미 있다).
    ⓖ **C-3은 오늘로 열한 라운드 연속 미확인**이라는 사실을 갱신. ⓗ
    `runtime-verification-required.md`에 라운드 77 신설분을 **#119~로 편입**하고 §0의 네 수·합계·
    §1-1 머리말 라운드 구간을 함께 갱신할 것(⚠️ 라운드 75 C의 계약이 그 값을 파싱으로 다시 세므로,
    틀리면 `@wooriai/test-utils`가 먼저 빨개진다. 오늘의 값은 실기기 **108** · 브라우저 **5** ·
    서버 **4** · 작업 **1** · 합계 **118**이고 마지막 행 번호는 **#118**이다).
    ⓘ `launch-readiness-status.md`의 **테스트 건수 재실측**(오늘의 값: api 817 · mobile 4,627 ·
    admin 478 · domain 131 · contracts 66 · test-utils 107 = **6,226**. ⚠️ **사람이 재는 유일한
    수치** — 자동화는 라운드 76 P3에서 실측 기각했다).

- **머지 순서**: **A·B·C·D·E는 서로 완전 독립**이고 즉시 병렬 가능하다 — A=모바일 커머스 셋,
  B=어드민 전송 계층 둘, C=어드민 CSV 패널 둘, D=어드민 화면 넷 + 신설 둘, E=모바일 가족 셋.
  **파일이 한 곳도 겹치지 않는다.** ⚠️ **B·C·D는 같은 워크스페이스지만 층이 다르다**
  (B=`src/lib/admin-api.*`, C=`src/components/ProductLinkBulkReplace.tsx`+`src/admin-write-error-copy.test.ts`,
  D=`app/**`+`src/lib/admin-role-copy.ts`+신설 테스트). ⚠️ **A와 E는 같은 워크스페이스지만
  갈라져 있다**(A=`src/api/api-error.*`+`app/items/**`, E=`src/family/**`+`app/family/invite.tsx`) —
  **둘 다 `src/offline/**`를 열지 않는 것이 그 분리의 조건이다.**
  접점은 **읽기 방향으로만** 다섯이다: A가 `apps/api`의 클릭 경로를, B가 자기 파일의 타임아웃
  갈래를, C가 `admin-api.ts`의 판정 셋을, D가 `apps/api`의 `RequireAdminRoles`를, E가
  `src/api/api-error.ts`와 `src/offline/messages.ts`를 **읽는다**.
  **A를 먼저 머지하는 편이 낫다** — 이번 라운드에서 유일하게 **핵심 루프 한가운데**에 있고,
  사용자가 오늘 실제로 막다른 문장을 읽는 자리다.
  그다음이 **B**(연결 실패 문장이 트랙 C가 여는 자리에도 흘러들므로, **B → C** 순서면 C가 그 파일을
  여는 김에 낡은 테스트 이름 한 줄을 함께 정리한다 — 반대 순서여도 초록이지만 손이 한 번 더 간다).
  **D·E는 아무 때나**(가장 독립적이고, E는 가장 작다).
  **F는 마지막이고, 이번 F는 R절 다섯 판정 · Q-1/Q-2/L-1/N-4 갱신 네 줄 · A-18 ·
  C-3 열한 라운드 표기 · #119~ 편입과 §0 재계산 · 테스트 건수 재실측이 본체다.**
