# 라운드 65 정찰 노트 (GAP-065)

> master fc845eb(라운드 64 머지) 기준. do-not-change.md(DNC-001~020)·known-limitations A~I절·
> gap-analysis 제외 판정·round55-plan §6 비범위표·round56~64-scout 완료분·round61-backlog
> (락 봉합 완료 + "이름만 붙인" 동시 실행 구멍)·docs/dev/source-lock.md 화면 표 대조 완료.
> 아래는 전부 그 밖이거나, 라운드 58~64가 접점으로 남긴 잔여다.
>
> **이번 라운드의 무게중심은 지시받은 대로 "최근 라운드가 안 간 구석"이다** — 온보딩·로그인
> 첫 실행 경험, 알림·동의 채널, CSV/엑셀 왕복, 입력 성능. 커머스 루프는 라운드 51·52·64가
> 세 번 훑었고 이번 정찰에서 새 결함이 나오지 않았다(후보 9 하나만 남는다). 대신 **핵심 루프의
> 바깥쪽 두 끝** — 앱에 들어오는 첫 화면과, 데이터를 넣고 빼는 왕복 — 에서 굵은 것 넷이 나왔다
> (후보 1·2·3·4).
>
> **선행 확인 3건(후보 아님).**
> 1. 라운드 63 P3·라운드 64 P3의 「`recurring-expense.store.ts:85-87` 주석 드리프트」는
>    **해소돼 있다** — 지금 그 자리(`:90`)는 "…라고 적고 있었지만, 배선은 라운드 58 #1이 이미
>    끝냈다"로 정정됐다. 그 항목은 재검토가 아니라 **삭제 대상**이다.
> 2. 라운드 64 #9가 연 `import_jobs.approved_at`은 **읽고 쓰인다**(확정 CAS와 같은 statement,
>    `import-pipeline.service.ts:346-351`, 감사 봉투 `:411`). 라운드 64 코드 건강이 지목한
>    "읽히지 않는 스키마·라우트 셋" 중 둘(`approved_at`·`redirect_code`)은 닫혔다 — 남은
>    `import_rows.raw_json`은 주석으로 죽은 컬럼이 선언돼 있어 유지다. 대신 **같은 스윕을 한 번
>    더 돌려 두 개를 새로 찾았다**(아래 코드 건강).
> 3. 라운드 63 #8(달력 빈 칸 → 기록)은 **채택돼 배선까지 끝났다**
>    (`records-calendar.ts:429-441` `resolveCalendarCellAction`·`CALENDAR_FUTURE_HINT`).
>    재제안 대상이 아니다.

## 상위 후보

### 1. 우리가 내보낸 CSV를 그대로 다시 올리면 **전 행이 "가져올 수 없어요"** 가 된다 — S
- **근거**: 내보내기 헤더는 `날짜,구분,카테고리,항목,판매처,결제수단,금액(원),메모,출처`이고
  (`apps/mobile/src/export/expense-csv.ts:54`), 그 모듈 머리말은 스스로 **"a file we export can be
  fed straight back into the excel import"** 라고 적어 두었다(`:9-19`). 그런데 서버의 열 인식
  키워드에 **`항목`이 없다** — item 키워드는 `내용·적요·가맹점명·가맹점·상품명·품목·거래내용·
  이용가맹점` 여덟 개뿐이고(`apps/api/src/imports/import-parser.ts:34-39`), `"항목".includes(k)`는
  여덟 개 모두 거짓이다(`품목`과 `항목`은 다른 글자다). 헤더 판정을 실제 문자열로 돌려 보면
  결과가 `{dateIdx:0, amountIdx:6, memoIdx:7}` — **itemIdx가 없다**
  (`detectHeaderColumns`, `:348-372` → `toParsedRow`가 `-1`을 빈 문자열로 읽는다 `:171-179`).
- **실패 시나리오**: 기기를 바꾸거나 계정을 옮기려고 [내보내기]로 받은 CSV를 그대로 올린다.
  파싱은 성공하고(날짜·금액·메모는 잡힌다) 미리보기 화면이 열리는데, **모든 행의 품목명이
  비어 있다.** 그러면 서버가 전 행을 `missing_item_name`으로 판정하고
  (`import-pipeline.service.ts:648`) `selected`를 false로 굳히므로(`:628`), 확정 버튼이 가져가는
  행은 **0건**이다. 화면이 사용자에게 하는 말은 행마다 붙는 `"이 행은 가져올 수 없어요 · 원본
  파일에서 고친 뒤 다시 올려 주세요"`인데(`apps/mobile/src/import/preview-rows.ts:86`), 그 파일은
  **이 앱이 만든 파일**이라 고칠 것이 없다 — 정직하지만 막다른 길이다. 곁가지도 같이 있다:
  `구분` 열(지출/선물/환불)은 파서의 `ParsedImportRow`에 자리 자체가 없어(`import-parser.ts:6-14`)
  재가져오기에서 **선물이 지출로 바뀐다** — CSV-127이 그 열을 더한 이유가 "선물 행이 합계에서
  빠지는데 열이 없어 스프레드시트에서 틀린 합계가 나온다"였으므로(`expense-csv.ts:14-19`),
  같은 결함을 우리 가져오기가 되살리는 셈이다(DNC-015).
- **최소안**: `HEADER_KEYWORDS.item`에 `"항목"` **한 줄**을 더한다(서버 1파일 1줄, 마이그레이션
  0건). 내보내기 헤더를 `품목`으로 바꾸는 대안은 **이미 밖에 나가 있는 파일들을 못 살린다** —
  키워드 쪽을 넓히는 편이 과거 파일까지 함께 살아난다. 그리고 두 저장소를 잇는 **왕복 계약
  테스트 1건**을 둔다: `EXPENSE_CSV_HEADER`를 서버 파서에 그대로 먹여 네 열(date·amount·item·memo)이
  전부 잡히는지. 지금 그 계약은 어느 쪽에도 없어서(`expense-csv.test.ts`는 헤더 문자열만 고정한다)
  다음에 열을 하나 더해도 아무 테스트가 깨지지 않는다.
- **설계 긴장**: `구분`의 왕복은 **이번 최소안에 넣지 않는다** — `import_rows`에 `expense_type`
  칸이 없어 스키마 변경이고, 확정이 `insertExpense`에 넘기는 값도 늘어난다(DNC-012·DNC-015가
  걸린 자리라 PM 선행). 다만 **그 사실을 문서로 남기는 것**은 이번 몫이다: 지금은 "내보내기가
  구분을 싣는다"와 "가져오기가 구분을 버린다"가 각자 자기 파일에만 적혀 있어, 두 문장을 나란히
  읽을 자리가 없다. 키워드 추가의 부작용은 좁다 — `적요`·`항목` 두 열이 함께 있는 은행 양식에서는
  **먼저 나오는 열**이 이긴다(else-if 사슬, `:350-363`). 그 순서 규칙은 종전과 같고, 이번 변경이
  바꾸는 것은 "아무 열도 못 찾던" 경우뿐이다.

### 2. 가져오기 검수 화면이 **분류를 보여주지도, 고치지도 못한다** — 서버 PATCH는 세 필드를 이미 받는다 — M
- **근거**: 서버 `PATCH /imports/:jobId/rows/:rowId`는 `selected`뿐 아니라 `categoryId`·
  `parsedItemName`·`parsedAmountKrw`를 **받아서 다시 검증한다**
  (`apps/api/src/imports/dto/import.dto.ts:26-46`, 반영 `import-pipeline.service.ts:265-278`).
  앱은 그 세 필드를 **읽은 값 그대로 되돌려 보낼 뿐**이다 — 체크박스를 뒤집는 뮤테이션이
  `categoryId: row.categoryId, parsedItemName: row.parsedItemName, parsedAmountKrw: row.parsedAmountKrw`를
  함께 싣는 것이 전부고(`app/import/[importJobId].tsx:341-348`), 행 카드에는 입력칸이 하나도 없다
  (`:146-180` `ImportRowCard` — 품목명·금액·날짜·배지·안내문). **분류는 아예 그리지도 않는다**
  (`src/import/preview-rows.ts:173-183` `importRowDisplay` = title·amountText·dateText).
- **실패 시나리오**: 분류는 **품목명 키워드 표**가 정한다(`import-parser.ts:44-58` — 11개 코드,
  각 3~7개 낱말). 실제 카드 내역의 적요는 `쿠팡`·`이마트`·`올리브영` 같은 **가맹점 이름**이라
  그 표의 어느 낱말과도 맞지 않고, 맞지 않은 행은 전부 하드코딩된 스텁 분류
  `가져오기 기본`으로 떨어진다(`import-pipeline.service.ts:110`·`:569`). 그 분류는
  `selectable=false`라 **기록 탭 필터 칩이 없고**(known-limitations B절 CAT-124 "남은 것") 리포트
  카테고리 비중에서도 한 덩어리로 뭉친다. 즉 200행짜리 카드 내역을 가져오면 대부분이 "가져오기
  기본"이 되는데, 사용자는 **승인 전에 그 사실을 볼 수도 없고** 승인 후에는 200건을 지출 상세에서
  하나씩 열어 고쳐야 한다. DNC-012가 지키려는 것은 "미리보기와 승인"인데, 지금 미리보기가 보여
  주는 것은 승인 대상의 절반뿐이다. 후보 1의 잠금 행도 여기 걸린다 — 서버는 `parsedItemName`을
  받아 그 행을 살려 낼 수 있는데, 화면은 "원본 파일에서 고쳐 오라"고 말한다.
- **최소안**: 두 가지만. ⓐ **행에 분류를 그린다** — 이름 해석은 이미 있는 공유 캐시
  (`["categories"]` + `buildCategoryNameLookup`, 리포트·기록 탭과 같은 자리)를 쓰고, 값이 없으면
  줄을 만들지 않는다. ⓑ **분류만 편집 가능하게 한다** — 칩 행 하나(`selectableCategories`를 지난
  목록, 지출 수정 화면과 같은 모듈)를 눌러 `PATCH { categoryId }`. **품목명·금액 편집은 이번
  범위 밖**이다(텍스트 입력이 2,000행 가상화 목록 안에 들어가면 초점·키보드 문제가 따라오고,
  길이·상한 문구도 함께 와야 한다 — 후보 1이 잠금 행 자체를 없애므로 급하지 않다). 서버 0건,
  마이그레이션 0건.
- **설계 긴장**: `가져오기 기본` 스텁을 **없애는 쪽**(맞는 분류를 못 찾으면 `기타`로)이 더
  근본적으로 보이지만, 그건 이미 만들어진 지출들의 분류를 소급해 바꾸는 문제가 되고
  CAT-124가 그 행을 일부러 살려 둔 판단과 충돌한다 — 이번은 **보이게 하고 고칠 수 있게**까지다.
  그리고 편집을 열면 `userReviewed` 플래그의 뜻이 넓어진다("중복을 확인했다" → "값을 손봤다")
  — 서버가 이미 두 뜻을 같은 칸으로 쓰고 있으므로(`:265-278`) 화면 문구가 그 사실을 흐리지
  않게 적을 것. IMP-003 픽셀락은 **비세션 미리보기**라(`app/import/index.tsx`) 이 화면은 캡처
  밖이다.

### 3. 스토어 빌드의 **첫 화면**이 "준비된 테스트 계정으로 로그인하고"라고 말한다 — 분기가 뒤집혀 있다 — S
- **근거**: 로그인 화면 부제가 `isTestLoginEnabled` 삼항인데 **두 갈래의 문구가 서로 반대다**
  (`apps/mobile/app/(auth)/login.tsx:211-214`):
  테스트 빌드(`EXPO_PUBLIC_TEST_LOGIN=1`)에는 "테스트 계정도 실제 가입과 똑같이 시작해요.",
  **그 밖의 모든 빌드**에는 "준비된 테스트 계정으로 로그인하고 우리아이의 주요 화면을 편하게
  둘러보세요." 그런데 Play 업로드용 AAB는 `EXPO_PUBLIC_TEST_LOGIN: "0"`으로 빌드된다
  (`scripts/build-android-aab.ts:83`·`:304`, APK의 production 프로파일도 같다 —
  `scripts/build-android-apk.ts:16-19`). 즉 **실사용자가 받는 빌드에만** 그 문장이 뜬다.
  같은 화면의 버튼은 그때 "카카오로 시작하기"다(`:278-282`).
- **실패 시나리오**: 스토어에서 앱을 받은 사람이 처음 보는 문장이 "준비된 테스트 계정으로
  로그인하고 … 둘러보세요"다. 카카오 계정으로 진짜 가입하려는 사람에게는 **거짓이고**(준비된
  계정도, 둘러보기도 없다 — 그 뒤는 온보딩 4단계다), 심사자에게는 "이 앱은 테스트 계정으로
  둘러보는 데모"라는 인상을 준다. 이 문장은 라운드에서 손댄 적이 없는 것이 아니라 **한쪽만
  손댔다**: "실기기 피드백 1"이 테스트 빌드 쪽 문구를 사실과 맞추면서(`:209-210` 주석) 반대 갈래를
  그대로 두고 갔다. 릴리즈 문서 어느 체크표에도 "로그인 화면 문구"를 보는 행이 없고
  (`docs/store/submission-checklist.md`·`docs/qa/runtime-verification-required.md`), AUTH-001은
  픽셀락 대상도 아니라(`app/pixel-lock.tsx:12-22` — 목록에 없다) 어떤 자동 경로도 이것을 보지 않는다.
- **최소안**: 비테스트 갈래 문구를 실제 동작으로 바꾼다("카카오로 로그인하면 아이 정보부터
  차근차근 시작해요." 계열, 해요체 DNC-018). 두 갈래가 **같은 사실**을 말하므로 삼항 자체를
  없애는 것도 성립하지만, 테스트 빌드의 "실제 카카오 로그인이 아니에요" 배지·꼬리말은
  그대로 남겨야 한다(`:204-206`·`:285-289`). 문구를 `src/auth/`의 상수 한 곳으로 옮겨
  `test-login-flow.test.ts`가 **두 갈래가 서로 다른 사실을 말하지 않는지**를 소스 계약으로 고정한다.
- **설계 긴장**: 없다시피 하다. 다만 이 결함의 모양이 신호다 — **env 갈래의 한쪽만 손보면
  아무도 모른다.** 저장소에 env로 갈리는 사용자 문구가 여기 말고도 있는지(푸시 설정의 비활성
  안내, 데모 세션 안내) 같은 트랙에서 한 번 훑을 것.

### 4. 필수 동의가 **한 방향뿐이다** — 약관을 개정하면 전 사용자가 "동의 안 함"이 되고 되돌릴 화면이 없다 — S/M
- **근거**: 앱이 보내는 동의는 로그인 성공 직후 딱 한 번이고, **버전이 코드에 박혀 있다**
  (`apps/mobile/src/api/client.ts:680-692` — `{ type: "terms", version: "2026-07-06" }` /
  `privacy` 두 줄). 서버는 **type + version이 정확히 일치하는 행만** 동의로 인정한다
  (`apps/api/src/onboarding/onboarding-core.service.ts:134-137`, 정의는 `:60-64`). 같은 문자열이
  네 곳에 복사돼 있다(위 둘 + `src/api/local-backend.ts:1727-1730`·`:2007-2011`) — 계약이 아니라
  네 벌의 리터럴이다. 그리고 **`marketing`("소식 알림 동의")은 앱이 한 번도 보내지 않는다**:
  서버·데모 정의에는 있고, 설정 > 약관 및 개인정보의 "동의 내역" 카드가 그것을 그대로 그리며
  (`src/settings/consent-summary.ts:47-55` → `app/settings/privacy.tsx:448`·`:473-483`)
  `consentStatusText`가 `"동의 안 함"`을 찍는데(`:33-35`), 켤 컨트롤이 앱 어디에도 없다.
- **실패 시나리오**: ⓐ **개정 경로가 없다.** 출시 전에 반드시 해야 하는 일 중 하나가 정책 문구에
  실 사업자 정보를 넣는 것이고(known-limitations A절 "법적 운영자 정보"), 문구가 바뀌면 버전도
  바뀌어야 한다. 그 순간 기존 사용자 전원의 `terms`/`privacy`가 **미동의로 뒤집히고**(서버는
  구버전 행을 못 본다) 앱은 여전히 옛 버전을 PUT하므로 **다시 동의할 방법이 없다** — 설정 화면은
  "동의 안 함"을 읽기 전용으로 보여 줄 뿐이다. 앱이 그 상태를 차단하지 않으니 기능은 계속
  돌아가고, 남는 것은 **"동의 안 함"이라고 적힌 화면과 동의 없이 쓰이는 서비스**다.
  ⓑ **`marketing`은 처음부터 그 상태다** — 화면이 존재하는 동의를 "동의 안 함"으로 영원히
  표시한다(죽은 UI가 아니라 **켤 수 없는 스위치의 상태 표시**다). ⓒ 곁가지: 로그인은
  `await upsertConsents(...)`를 **성공 경로 한가운데서** 기다리므로(`app/(auth)/login.tsx:137`)
  그 PUT이 실패하면 세션은 이미 저장됐는데 `router.replace`가 실행되지 않고 "로그인 중 문제가
  발생했어요"가 뜬다. 같은 함수의 데모 경로는 정확히 반대다 — `void … .catch(() => {})`
  (`:187`).
- **최소안**: 세 가지, 전부 가산이다. ⓐ **버전을 서버에서 받아서 되돌려준다** — 앱이
  `GET /consents`(이미 있는 라우트)가 준 정의의 `version`을 그대로 실어 PUT한다. 리터럴 네 벌이
  하나(서버 정의)로 줄고, 개정해도 앱을 다시 배포할 필요가 없다. ⓑ **설정 화면에서 필수 동의가
  미충족이면 다시 동의할 수 있게 한다** — 새 화면이 아니라 "동의 내역" 카드 안의 버튼 하나
  (`accepted === false`인 필수 항목이 하나라도 있을 때만 렌더). `marketing`은 같은 카드에서
  스위치 하나로 켜고 끈다(서버 `upsertConsents`가 이미 `accepted` 불리언을 받는다 — 서버 0건).
  ⓒ 로그인의 `await`를 데모 경로와 같은 모양으로 맞추고, 실패는 재제출 경로
  (`app/(onboarding)/resume.tsx:96`)가 이미 있으니 로그인 실패로 승격하지 않는다.
- **설계 긴장**: "미동의 상태에서 앱을 계속 쓰게 둘 것인가"는 **이번 범위 밖**이다 — 차단 게이트를
  세우면 기존 사용자가 업데이트 한 번에 앱 밖으로 밀려나므로 PM·법무 판단이 선행이다. 이번
  최소안은 **되돌아올 길을 만드는 것까지**이고, 차단 여부는 그 길이 선 다음에 정한다. 그리고
  `marketing` 동의를 켤 수 있게 만든다고 마케팅 알림이 생기는 것은 아니다 — 푸시는 A절(자산 3종
  부재)로 no-op이고, 이 스위치는 **동의 기록**일 뿐이라는 사실을 문구가 말해야 한다(없는 기능을
  약속하지 않는다).

### 5. 동의하라고 요구하는 **약관 본문을 앱 안에서 읽을 수 없다** — 문서는 저장소에 있다 — S
- **근거**: 로그인 화면의 필수 체크박스 둘은 라벨만 있다 — "이용약관 동의", "개인정보 수집·이용
  동의"(`app/(auth)/login.tsx:236-247`). 눌러서 읽을 링크도, 본문을 펼치는 시트도 없다
  (전 앱에서 `Linking.openURL`을 쓰는 곳은 커머스 링크와 카카오 인증 둘뿐이다 —
  `app/items/[itemTemplateId].tsx:523-543`, `src/auth/kakao-login.ts:246`). 설정의 SET-003은
  제목이 **"약관 및 개인정보"** 인데 그리는 것은 동의 여부 줄뿐이다
  (`app/settings/privacy.tsx:452-483`). 정작 문서는 저장소에 있다 —
  `infra/legal/terms-of-service.html`·`privacy-policy.html`·`account-deletion.html`.
- **실패 시나리오**: 사용자는 **읽을 수 없는 문서에 필수 동의를 하고** 앱을 시작한다. 그 뒤에도
  읽을 자리가 없어서, "무엇에 동의했는지" 물어보면 앱이 답할 수 있는 것은 "동의함 · 8월 4일"뿐이다.
  스토어 심사 쪽에서도 같은 자리가 비어 있다 — `docs/store/play-listing.md:149`가 "개인정보처리방침
  URL — 호스팅 후 URL 입력(필수)"을 열린 체크박스로 두고 있는데, **앱 안 링크는 그 체크표에도
  없다.** 그리고 후보 4ⓐ와 겹친다: 문구를 개정하면 사용자는 무엇이 바뀌었는지 볼 수도 없이
  "동의 안 함"이 된다.
- **최소안**: 저장소의 관례를 그대로 쓴다 — **자산이 없으면 정직하게 감춘다**(푸시 토글과 같은
  모양, `src/notifications/push-token-source.ts`). `EXPO_PUBLIC_TERMS_URL`·
  `EXPO_PUBLIC_PRIVACY_POLICY_URL` 두 키를 `scripts/check-env.ts`의 스펙 표에 추가하고,
  값이 있을 때만 로그인 체크박스 옆과 SET-003 "동의 내역" 카드에 [보기] 링크를 그린다
  (값이 없으면 화면이 종전과 한 글자도 다르지 않다 — AUTH-001은 픽셀락 밖이고 SET-003은
  카드가 늘지 않는다). 본문을 앱에 복사해 넣지 **않는다**: `infra/legal/*.html`이 단일 소스이고
  두 벌이 되면 개정 때 갈린다.
- **설계 긴장**: URL 호스팅 자체는 **A절**(사용자 자산)이라 이 라운드가 만들 수 없다 — 그래서
  최소안이 "링크를 그린다"가 아니라 "값이 주입되면 링크를 그린다"이다. 대안(앱 번들에 HTML을
  넣고 WebView로 연다)은 새 의존성이고(`react-native-webview` 미설치) A절 관례에 걸린다.
  둘 중 무엇도 하지 않기로 한다면 **그 판단을 문서에 남겨야** 한다 — 지금은 "안 하기로 했다"가
  아니라 "아무 데도 적혀 있지 않다"이고, 다음 정찰이 같은 자리를 또 판다.

### 6. 키보드가 올라오면 **첫 탭이 통째로 먹힌다** — 저장소의 다른 스캐폴드는 이미 고쳐 뒀다 — S
- **근거**: 앱 전 화면의 스크롤러인 `AppScreen`은 `ScrollView`에 `keyboardShouldPersistTaps`를
  넘기지 않는다(`apps/mobile/src/ui.tsx:84-103`) — RN 기본값은 `"never"`이고, 그 뜻은 **키보드가
  떠 있는 동안의 첫 탭은 자식에게 가지 않고 키보드만 내린다**는 것이다. 저장소가 그 비용을
  이미 알고 있다: 판매처 자동완성 칩이 blur에서 접히지 않는 이유가 통째로 그 설명이다
  ("첫 탭에 칩이 사라져 **두 번째 탭이 맞을 자리가 없다**" — `app/expenses/new.tsx:549-556`).
  그런데 **같은 저장소의 다른 스캐폴드는 이미 `"handled"` 다** —
  `src/design-system/components/ScreenScaffold.tsx:38`(DSN-053 이식본). 기록 탭의 `SectionList`도
  같은 상태다(`app/(tabs)/records.tsx:1831-` — 검색 입력은 그 리스트의 헤더 안에 있다 `:1709`).
- **실패 시나리오**: 이 앱에서 가장 자주 반복되는 동작이 정확히 이 모양이다. 빠른 기록 시트에서
  금액을 치고(키보드) → 카테고리 타일을 누른다 → **아무 일도 일어나지 않는다** → 다시 누른다.
  하루에 서너 번, 한 손으로 유아를 안고 있는 상태에서다. 같은 일이 품목 자동완성 칩·판매처 칩·
  날짜 칩·달력 픽커 칸·선물 체크박스·결제수단 칩에서 반복되고, 기록 탭에서는 검색어를 친 뒤
  카테고리 칩이나 결과 행을 누를 때, 준비템 탭에서는 통합 검색 뒤 타일을 누를 때 생긴다
  (`src/preparation/PreparationListParity.tsx:400-411`). 증상은 "눌렀는데 반응이 없다"이고,
  라운드 64 #6이 터치 타깃에서 지목한 것과 **같은 인상**을 만든다 — 원인이 다른데 사용자에게는
  한 가지로 보인다.
- **최소안**: `AppScreen`의 `ScrollView`에 `keyboardShouldPersistTaps="handled"` 한 줄, 기록 탭
  `SectionList`에 같은 값 한 줄. `"handled"`는 **자식이 처리한 탭만** 통과시키므로 빈 자리를
  누르면 종전처럼 키보드가 내려간다. `hitSlop`과 같은 성격으로 **렌더는 한 픽셀도 바뀌지 않는다**
  — EXP-001·HOME-001·REP-001·ITEM-001·IMP-003·SET-001 픽셀락 전부 불변이다. 재발 방지는
  소스 계약 1건: "앱의 스크롤 스캐폴드는 `keyboardShouldPersistTaps`를 명시한다"
  (`src/a11y-contract.test.ts`의 라운드 64 #6 계약과 같은 자리·같은 문법).
- **설계 긴장**: `"always"`가 아니라 `"handled"`를 고르는 이유를 계약 문구에 남길 것 —
  `"always"`면 빈 자리를 눌러도 키보드가 내려가지 않아 "닫는 법을 모르겠다"가 생긴다.
  그리고 `AppScreen`은 **전 화면이 지나는 컴포넌트**라 변경이 넓다: 이 라운드에서 `AppScreen`에
  다른 prop을 함께 더하지 않는 것(한 번에 하나만)이 안전한 모양이다.

### 7. 공유 프리미티브 셋이 여전히 **44dp**다 — 라운드 64가 세운 계약 테스트는 그 셋을 읽지 않는다 — S
- **근거**: 라운드 64 #6은 화면 파일 안의 **인라인 칩·크롬**을 48dp로 올리고 소스 계약까지
  붙였다(`src/a11y-contract.test.ts:918-946` — `SUGGEST_CHIP_HIT_SLOP`·
  `PRODUCT_DETAIL_CHROME_HIT_SLOP`). 그런데 그 계약이 읽는 파일은 `app/expenses/new.tsx`·
  `app/expenses/[expenseId].tsx`·`app/items/[itemTemplateId].tsx` **셋뿐**이라, 같은 값(44)으로
  서 있는 **공유 컴포넌트들**은 그대로 통과한다:
  - `CategoryChip` — `minHeight: 38`(`src/ui.tsx:343`) + `hitSlop 3`(`:335`) = **44**.
    8개 화면 17자리에서 쓰인다(온보딩 단계 선택 · 지출 시트 · 지출 상세 · 정기 지출 ·
    아이 관리 · 기록 탭 필터 · 준비템 · CSV 내보내기).
  - `SegmentedControl` 탭 — `paddingVertical: 9`(`:292`) + 13px 텍스트 + `hitSlop 4`(`:286`)
    ≈ **44**. 리포트 기간(월/분기/연)과 기록 탭 보기 전환이 이것이다.
  - `NotificationBell` — 36dp 정사각(`src/notifications/NotificationBell.tsx:34`) +
    `hitSlop 4`(`:18`) = **44**. 홈 헤더의 알림 입구다.
  - 더보기 탭 검색 버튼 — 36dp(`app/(tabs)/more.tsx:441`) + `hitSlop 4`(`:295`) = **44**.
  대조군도 같은 저장소 안에 있다: 예산 조정 칩(`app/budget.tsx:78`)·리포트 기간 화살표
  (`app/(tabs)/reports.tsx:1021`)는 `theme.touchTarget`(=48, `src/theme.ts:179`)을 직접 쓰고,
  **이식된 design-system의 SegmentedControl은 `minHeight: 48`** 이다
  (`src/preparation/PreparationListParity.tsx:137`).
- **실패 시나리오**: 라운드 64가 고친 칩과 **한 화면에 나란히 서 있는** 컨트롤이 여전히 44다 —
  기록 시트에서 자동완성 칩은 48인데 그 아래 카테고리 칩은 44이고, 리포트에서 화살표는 48인데
  그 사이 기간 탭은 44다. 사용자에게는 "어떤 건 잘 눌리고 어떤 건 안 눌린다"로 나타나고,
  그 판단이 컴포넌트 경계와 일치하지 않아 학습되지도 않는다. 게다가 이 넷은 **공유
  컴포넌트**라, 새 화면이 하나 생길 때마다 44dp 컨트롤이 자동으로 따라 태어난다 —
  라운드 64가 소스 계약으로 막으려던 재발 경로가 정확히 여기서 열려 있다.
- **최소안**: 라운드 64와 **같은 규율**로 `hitSlop`만 올린다 — 칩 3 → `{top:5, bottom:5,
  left:3, right:3}`(38+10=48, 가로는 그대로: 칩 사이 `gap` 8), 세그먼트 탭 4 → 세로 6~7,
  벨·검색 36dp는 `{top:6, bottom:6, left:6, right:6}`(36+12=48 — 이 둘은 이웃 컨트롤이 없어
  가로도 안전하다). 레이아웃 속성은 **한 개도** 건드리지 않으므로 픽셀락 전부 불변이다.
  그리고 계약 테스트를 **화면 목록이 아니라 컴포넌트 목록**으로 넓힌다: `src/ui.tsx`의
  `CategoryChip`·`SegmentedControl`, `NotificationBell` — 라운드 64의 계약이 "다음 칩도 같은
  값으로 태어난다"를 막으려 했다면 그 자물쇠는 프리미티브에 있어야 한다.
- **설계 긴장**: 세그먼트 탭은 셋이 **맞붙어 있다**(`flex: 1`, 사이 간격 0). 그래서 좌우
  `hitSlop`은 **올리지 않는다** — 올리면 옆 탭의 영역과 겹쳐 오탭이 늘고, 그건 지금보다 나쁘다.
  세로만 늘리는 판단은 라운드 64가 칩에서 내린 것과 같고, 그 근거를 계약 문구에 함께 적을 것.
  `minHeight`를 48로 올리는 쪽(더 정직한 해법)은 **모든 픽셀락 캡처의 재대조**를 부르므로 이번
  범위 밖이다 — 그 판단은 DSN-053 승인 디자인에 대한 변경 요청으로 따로 문서화한다.

### 8. 아이 **생년월일·예정일에는 달력이 없다** — 지출 두 화면에만 있다 — M
- **근거**: 온보딩 ONB-002의 날짜 칸은 `TextInput` 하나에 `placeholder="YYYY-MM-DD"`·
  `maxLength={10}`이고(`app/(onboarding)/child-profile.tsx:143-170`), 설정의 아이 관리도 같은
  모양이다(`app/settings/children.tsx:99-120`·`:141-158`). 그런데 이 저장소에는 **완성된 월
  달력 픽커**가 있다 — `src/expenses/ExpenseDatePicker.tsx` + 순수 판정
  `src/expenses/date-picker-month.ts`(격자는 기록 탭 달력의 `buildCalendarMonth` 재사용, 접근성
  라벨·월 이동 상한까지). 그 픽커를 쓰는 화면은 `app/expenses/new.tsx:1683`과
  `app/expenses/[expenseId].tsx:1151` **둘뿐**이다.
- **실패 시나리오**: 이 날짜는 앱에서 **가장 중요한 한 값**이다 — 단계 밴드·준비템 목록·
  마일스톤 리포트·홈 히어로가 전부 여기서 나온다. 그리고 온보딩이 그것을 **필수**로 받는다
  (`validateChildForm(..., { requireDate: true })` — `child-form.ts:91-105`). 그런데 첫 실행에서
  사용자가 해야 하는 일은 `2025-11-14`를 **손으로 정확히 치는 것**이고, 한 글자만 어긋나면
  "날짜는 YYYY-MM-DD 형식으로 입력해 주세요."에 막혀 [다음]이 비활성이다. 안드로이드에서는
  키보드조차 숫자가 아니다 — `keyboardType="numbers-and-punctuation"`은 **iOS 전용 값**이라
  그 사실이 코드 주석에 적혀 있다(`child-profile.tsx:145-150`). 즉 안드로이드 신규 사용자는
  일반 키보드에서 하이픈을 찾아 열 글자를 친다. 2주보다 오래된 영수증 하나를 위해 달력을 세운
  라운드가 있었는데(GAP-054 #7 — `date-picker-month.ts:9-13`), **앱을 처음 켠 사람이 반드시
  지나는 칸**은 그 전 상태 그대로다.
- **최소안**: 픽커 컴포넌트를 재사용하되 **선택 가능 범위를 인자로 받게** 한다. 지금 판정은
  "미래가 아닌가" 한 줄이고(`date-picker-month.ts:96-100` `isExpenseDatePickerDateSelectable`),
  출생일은 그 규칙이 그대로 맞지만 **출산 예정일은 미래여야 한다** — 그래서 판정 함수에
  `direction: "past" | "future"` 한 칸을 가산하고 기존 호출부는 기본값으로 종전과 **정확히 같은
  값**을 낸다(지출 두 화면 무변경). 화면은 손타이핑 칸을 **없애지 않는다** — 달력 버튼을 옆에
  더할 뿐이라, 이미 손에 익은 사람과 스크린리더 사용자의 경로가 그대로 남는다.
- **설계 긴장**: 이 후보만 **범위가 픽커 모듈까지 들어간다** — 그 모듈은 지출 두 화면이 이미
  쓰고 있고 `date-picker-month.test.ts`가 값 계약을 촘촘히 고정하고 있으므로, 가산 인자의
  기본값이 종전 동작과 같다는 것을 **테스트로 먼저** 못박고 시작할 것. 미래 방향의 상한도
  정해야 한다(임신은 40주가 한계인데 픽커는 20년치 과거 상한만 갖고 있다 —
  `EXPENSE_DATE_PICKER_MAX_PAST_MONTHS`); 상한 값을 새로 짓지 말고 도메인의 임신 주차 규칙
  (`packages/domain/src/stage.ts`)에서 읽을 것. SET-005·ONB 화면은 픽셀락 대상이 아니지만
  (`app/pixel-lock.tsx:12-22`) 온보딩은 첫 실행 경로라 실기기 확인이 필수다.

### 9. DNC-010 고지 문구를 **무엇에서 무엇으로** 바꿨는지 서버가 모른다 — S
- **근거**: `PUT /admin/disclosures/:key`는 감사 로그를 남기지만 봉투에 **`after`만** 있다
  (`apps/api/src/admin/admin.controller.ts:159-175` — `after: { text: body.text }`, `before` 없음).
  대조군은 같은 저장소 안에 있다: 지출 수정·삭제, 라운드 63 #5의 `budget.upsert`, 라운드 64 #9의
  `import.confirm`은 전부 before/after 쌍이다. 행 자체도 답하지 못한다 —
  `disclosures.updated_by`는 스키마에 있고(`apps/api/prisma/schema.prisma:671`) **저장소 전체에서
  읽지도 쓰지도 않는다**(grep 1건 = 그 선언). 그리고 이 액션은 CS 프리셋에도 없다
  (`apps/admin/src/lib/audit-log-filters.ts:155-178` — `admin.disclosure.update` 부재).
- **실패 시나리오**: 이 테이블에 담긴 것은 **DNC-010이 잠근 그 문장**이다(`affiliate_purchase` /
  `sponsored_product` — 링크의 문구 칸이 비면 앱·어드민·클릭 응답이 전부 이 값을 쓴다,
  `items-catalog.service.ts:965-969`). admin 역할은 검토(content revision)를 거치지 않고 **직접
  덮어쓴다**(editor만 draft→review를 탄다 — `apps/admin/app/disclosures/page.tsx:44-52`). 그래서
  누군가 그 문장을 약하게 바꿔 놓으면, 남는 근거는 "언제 누가 **무엇으로** 바꿨다"뿐이고
  **무엇이었는지**는 어디에도 없다 — 되돌릴 값이 서버에 없다는 뜻이다. 시드를 다시 돌리면
  복구되지만(`prisma/seed.ts:84-92`의 upsert가 `text`를 덮어쓴다) 그건 운영 DB에서 할 일이 아니다.
  같은 화면이 **아무 `key`나 새로 만들 수 있다**는 점이 이 사각을 넓힌다(`adminUpdateDisclosure`는
  키를 검증하지 않고 upsert한다 — `:559-570`): `affiliate_purchse` 같은 오타로 저장하면 화면은
  "저장됐어요"라고 답하는데 앱이 읽는 값은 그대로다.
- **최소안**: 셋 다 작다. ⓐ 감사 봉투에 `before: { text }` — upsert 직전 조회 1회(지출 경로와
  같은 정밀도, `budget.upsert`가 라운드 63에서 고른 그 모양). ⓑ 어드민 액션 프리셋에
  `admin.disclosure.update` 한 줄. ⓒ **앱이 실제로 읽는 키를 화면이 표시한다** — 새 검증을
  세우는 대신(모르는 키를 막으면 나중에 쓸 키를 미리 막는다) `defaultDisclosureFor`가 읽는 두
  키를 어드민 목록에서 배지로 구분한다("앱이 이 키를 읽어요"). 마이그레이션 0건.
- **설계 긴장**: `disclosures.updated_by`를 **어느 쪽으로 정할지**가 남는다 — 감사 로그가
  before/after를 지면 그 컬럼은 중복이므로, 라운드 64 #9가 `approved_at`에서 내린 것과 같은
  판단을 해야 한다: 컬럼을 살려 "마지막 수정자의 단일 소스"로 선언하고 스키마 주석에 근거를
  남기든지, 죽은 컬럼으로 문서화하든지. 이번 최소안은 **후자**를 권한다 — `approved_at`과 달리
  이 값을 조인 없이 읽어야 하는 화면이 아직 없고, 어드민 계정 id를 행에 복사하면 계정 삭제 때
  정리 대상이 하나 늘어난다.

### 10. 실기기 체크표·a11y 스윕의 라운드 65분 — 라운드 63이 세운 전용 트랙을 이번에도 돌린다 — S
- **근거**: 라운드 64 트랙 F가 잔여 없이 마감했다 — §1-1이 49~52번까지
  (`docs/qa/runtime-verification-required.md:194-197`), a11y는 새 A-5(#27~#29)까지 들어와 있고
  (`docs/qa/accessibility-offline-checklist.md:114-116`), C-1(터치 영역 실측)이 "계산은 코드가,
  실측은 손가락이"로 갈라져 있다(`:151`). 즉 **물려받은 빚은 없다** — 새로 만드는 몫만 있다.
- **최소안**: 이번 라운드가 사용자에게 보이게 만드는 변화마다 §1-1에 한 행 —
  내보낸 CSV 재가져오기(후보 1: "우리 CSV를 그대로 올려 확정까지 되는가 · 선물 행이 지출로
  들어오는지 함께 본다"), 검수 화면의 분류 표시·편집(후보 2), 로그인 첫 화면 문구(후보 3:
  **TEST_LOGIN=0 빌드로** 확인해야 한다 — 개발 빌드에서는 재현되지 않는다), 동의 재동의·
  marketing 스위치(후보 4), 약관 링크(후보 5: env 미주입에서 **화면이 종전과 같은지**까지),
  키보드 첫 탭(후보 6: "금액을 친 직후 타일 한 번에 눌리는가"와 **빈 자리를 누르면 여전히
  키보드가 내려가는가**를 함께), 터치 타깃(후보 7: 렌더 불변 + 세그먼트 옆 탭 오탭 없음),
  달력 픽커(후보 8: 예정일이 미래로 고를 수 있는가 · 안드로이드 키보드). a11y는 A-6 표로 이어
  붙이고, `src/a11y-contract.test.ts`에 후보 6의 스캐폴드 계약과 후보 7의 프리미티브 계약을 넣는다.
- **설계 긴장**: 라운드 63·64가 "전용 트랙 + 문서 안의 문장"으로 두 라운드 연속 성공했다.
  이번이 **세 번째**이므로, 라운드 64가 미뤄 둔 판단("통합자 체크를 릴리즈 게이트가 볼 수 있는
  형태로 옮길지")을 이번 라운드 끝에 **결론 내는 것**이 이 트랙의 마지막 일이다 — 세 라운드치
  근거가 모였다. 후보 3이 그 판단에 재료를 하나 더 준다: 릴리즈 빌드에서만 재현되는 결함은
  체크표의 문장으로는 잡히지 않았다.

## P3

- **준비템 목록 가격(라운드 64 #2)의 채택 판단이 아직 없다 — 그리고 그 부재조차 기록되지
  않았다.** 라운드 64 트랙 B의 계약은 "채택하지 않기로 하면 **그 판단을 `catalog-contract.ts`
  머리말에 근거와 함께 남긴다**"였는데, 그 파일 머리말(`src/preparation/catalog-contract.ts:1-21`)에
  가격에 관한 문장이 한 줄도 없다. 즉 라운드 64의 종료 조건 하나가 미충족이다. **사용자 결정
  대기 상태라면 그 사실 자체를 그 자리에 적는 것**이 이번 라운드의 최소 몫이다.
- **`ProductComparisonRow`의 `caption` 기본값이 아직 `"무료배송"`이다**(`src/ui.tsx:594`,
  라운드 64 P3 그대로). ITEM-002 픽셀락 캡처 안이라 캡처 대조가 선행이다.
- **상세 상단 [공유하기]가 이름·가격대만 보낸다**(`app/items/[itemTemplateId].tsx:782-786`) —
  링크도 고지도 없어 받는 사람이 할 수 있는 일이 없다. 라운드 64 #5가 "같은 계열"로 지목했지만
  ⓐ(링크 열기 실패 카드)만 닫혔다. 목적지를 `/r/:code`로 바꾸는 판단과 함께 서야 한다.
- **`dateFieldLabel` 死코드 + 그 테스트가 지금 화면과 반대되는 문구를 고정한다** —
  `src/children/child-form.ts:41-45`는 제품 코드에서 참조 0건이고(모든 폼이
  `requiredDateFieldLabel`을 쓴다), `child-form.test.ts:24-26`이 `"출산 예정일 (선택)"`을 값으로
  못박아 두었다. 날짜는 이제 **필수**다.
- **`__resetOnboardingStepAnalyticsForTests` 死코드**(`src/onboarding/step-ui.tsx`) — 참조 0건
  (테스트 포함). 라운드 63·64 P3에서 그대로 넘어왔다.
- **정기 지출 문구·절단의 단일 소스 미정리 — 다섯 라운드째**(`src/stores/recurring-expense.store.ts:64`·
  `:232`). 저장소가 자기 손으로 두 번 적어 둔 후속이고 라운드 59부터 밀렸다.
- **`check-env.ts`의 `INVITE_LINK_BASE_URL` 설명이 소비자 하나를 빠뜨렸다**(`scripts/check-env.ts:42-45`
  — "가족 초대 링크가 wooriai.local로 발급"). 라운드 64 D(#8) 이후 그 값은 어드민이 복사해
  뿌리는 **공개 공유 URL**도 만든다(`items-catalog.service.ts:215-218`). 초대 링크는 받는 사람이
  못 열면 끝이지만, 공유 URL은 **블로그·카카오톡에 남는다** — 설명 한 줄에 그 사실을 더할 것.
- **온보딩 첫 화면과 알림 벨만 이모지 글리프로 남아 있다** — `app/(onboarding)/child-status.tsx:19`·
  `:26`·`:33`(🤰👶🧸)과 `src/notifications/NotificationBell.tsx:22`(🔔). "D1 후속(실기기 피드백 2)"이
  텍스트 글리프를 Ionicons로 통일한 스윕이 이 둘을 지나쳤고, 하필 **첫 실행에서 처음 보는
  화면**과 **홈 헤더**다.
- **`affiliate_clicks.user_agent`가 원문 그대로 400일 남는데 읽는 곳이 0건이다** ·
  **4가구 이상 계정의 "다른 가구 보기" 전용 화면 부재** · **아이 삭제 대상 표기의 다자녀 문턱** ·
  **`pending` 초대의 게으른 만료 사각** · **첫돌 이후 리포트 고착** · **`viewedHouseholdId` 탭
  이탈 소실** · **다자녀 알림은 "본 아이" 것만 생성** — 라운드 62~64가 남긴 그대로이고 이번
  라운드에도 상태 변화가 없다.

## 코드 건강 판정

- **컬럼 단위 스윕을 실제로 돌렸다(라운드 64의 권고 이행).** `schema.prisma`의 스칼라 필드
  전량을 저장소 전체(`apps`·`packages`·`scripts`, `.sql` 포함)와 대조한 결과, 참조 0인 컬럼은
  **둘**이다: `child_item_statuses.status_note`(VarChar(200), 쓰기·읽기 0 — 주석도 없다)와
  `disclosures.updated_by`(후보 9). `attachments` 테이블은 전부가 미사용이지만 **문서화돼
  있으므로 제외**한다(`docs/store/data-safety-answers.md:86` — "스키마에 `Attachment`가 있으나
  업로드 코드 경로가 없다"). `categories.parent_category_id`도 의도적 제외가 DTO 주석에 적혀
  있다(`admin-categories.dto.ts:8`). 라운드 64가 지목한 셋 중 둘은 닫혔다(머리말 2번).
  **다음 스윕은 컬럼이 아니라 `disclosures.active` 같은 "선언됐지만 조건에 안 쓰이는 플래그"
  단위가 값이 있다** — `disclosuresByKey()`는 `active`를 보지 않고 전량을 읽는다
  (`items-catalog.service.ts:903-906`).
- **주석 드리프트: 하나 해소, 둘 신규.** 라운드 63·64가 든
  `recurring-expense.store.ts:85-87`은 정정됐다(머리말 1번). 대신 **터치 타깃 표기의
  "44dp"가 두 곳에 남아 있다** — `src/ui.tsx:155`("44dp 정사각 터치 타깃(theme.touchTarget)" —
  실제 값은 48이라 괄호 안이 본문을 배신한다)와 `app/(tabs)/records.tsx:516`("44dp 최소 터치
  타깃"). DSN-053이 토큰을 48로 올린 뒤 남은 잔재이고, 라운드 64가 a11y 체크리스트 C-1에
  "기준은 48dp다(44가 아니다)"를 굳이 적어 넣은 이유가 이 혼선이다.
- **구조 대변경은 여전히 비권장.** `app/(tabs)/index.tsx` 2,506줄 · `app/expenses/new.tsx`
  2,374줄 · `app/(tabs)/records.tsx` 1,872줄로 라운드 59 판정(픽셀락 기준선 위험) 그대로다.
  이번 후보 중 그 파일들을 건드리는 것은 **`keyboardShouldPersistTaps` 한 줄**(후보 6)뿐이라
  분리가 선행 조건이 아니다. 반면 **`src/ui.tsx`(1,069줄)는 이번에 세 후보가 동시에 겨눈다**
  (6·7 + P3의 `"무료배송"`) — 트랙 경계에서 컴포넌트 단위로 소유를 나눌 것.
- **테스트 사각은 "두 저장소를 잇는 계약"에 있다.** 후보 1이 지나갈 수 있었던 이유가 그것이다 —
  `expense-csv.test.ts`는 헤더 문자열을, `import-parser-inference.test.ts`는 키워드 표를 각각
  고정하는데, **그 둘을 맞대 보는 테스트가 없다.** 같은 모양이 하나 더 있다: 라운드 64 M-2가
  `LINK_PRICE_MAX_AGE_DAYS`의 수기 미러에 붙인 `contracts-mirror.test.ts`가 그 공백을 메운
  선례이므로, CSV 왕복도 같은 자리(모바일 쪽 미러 계약)에 놓는 것이 관례에 맞다.
  a11y 쪽 사각은 후보 7이 든 그대로다 — 라운드 64의 터치 계약이 **화면 세 개만** 읽는다.
- **api 테스트 하네스의 동시 실행 구멍은 라운드 61 A가 "이름만 붙였다"고 명시했고 이번에도
  닫히지 않았다 — 재제안 아님**(그 문서의 QA 수칙을 따를 것: 결과를 근거로 삼기 전에 같은 DB를
  쓰는 다른 실행이 없는지 먼저 확인한다).

## 트랙 구성 (파일 단위 상호 배타)

- **A 가져오기 왕복 (서버 + 검수 화면)** (#1 · #2)
  - 소유: `apps/api/src/imports/import-parser.ts` · `apps/api/src/imports/dto/import.dto.ts`(읽기만) ·
    `apps/mobile/app/import/[importJobId].tsx` · `apps/mobile/src/import/preview-rows.ts` ·
    `apps/mobile/src/export/expense-csv.ts`(**주석·계약 테스트만**) · 관련 `apps/api/test/*` ·
    `apps/mobile/src/import/*.test.ts`
  - 금지: `import-pipeline.service.ts`의 **판정 규칙 무접촉**(`validationStatusForImportRow`·
    `buildImportRowsFromParsed` — 열 인식만 넓힌다) · 마이그레이션 신규 0건 ·
    `expenseType`/`merchant` 왕복 **금지**(스키마 변경 + DNC-012·DNC-015 = PM 선행) ·
    `app/expenses/**`(C 소유) · **새 e2e는 shared 레인, `exclusive-suites.ts` 등재 금지**
  - 계약: 내보내기 헤더는 **한 글자도 바꾸지 않는다**(이미 밖에 나간 파일이 기준이다),
    왕복 계약 테스트는 `EXPENSE_CSV_HEADER`를 **서버 파서에 그대로 먹여** 네 열을 단언할 것,
    분류 편집은 `selectableCategories`를 지난 목록만(지출 수정 화면과 같은 모듈),
    값이 없으면 줄을 만들지 않는다, 해요체(DNC-018)

- **B 첫 실행 · 동의 · 약관** (#3 · #4 · #5) — **A·C·D와 독립, 즉시 착수 가능**
  - 소유: `apps/mobile/app/(auth)/login.tsx` · `apps/mobile/app/settings/privacy.tsx`(**동의 카드만**) ·
    `apps/mobile/src/settings/consent-summary.ts` · `apps/mobile/src/api/client.ts`(`upsertConsents` 한 함수) ·
    `apps/mobile/src/api/local-backend.ts`(동의 정의·`upsertConsents`) · `scripts/check-env.ts` ·
    `.env.example` · 관련 `apps/mobile/src/*.test.ts`
  - 금지: `apps/api/**`(서버 0건 — `GET/PUT /consents`는 이미 필요한 것을 다 받는다) ·
    `app/settings/privacy.tsx`의 **파괴 플로우 카드 3종 무접촉**(SET-004 픽셀락) ·
    `infra/legal/*.html` 본문 무변경(단일 소스) · 앱 번들에 약관 본문 복사 금지 ·
    **미동의 차단 게이트 금지**(PM·법무 선행)
  - 계약: 동의 **버전은 서버 정의를 그대로 되돌려준다**(리터럴을 앱에 다시 박지 않는다),
    약관 링크는 **env가 있을 때만** 렌더(없으면 화면이 종전과 한 글자도 다르지 않다 — 푸시
    토글과 같은 정직한 부재), `marketing` 스위치 문구는 **없는 기능을 약속하지 않는다**
    (푸시는 A절로 no-op — 이 스위치는 동의 기록이다), 로그인 문구는 **두 갈래가 서로 다른
    사실을 말하지 않을 것**(소스 계약 1건)

- **C 입력 마찰 · 터치 타깃 (공유 프리미티브)** (#6 · #7) — **A·B와 파일 무충돌**
  - 소유: `apps/mobile/src/ui.tsx`(**`AppScreen`·`CategoryChip`·`SegmentedControl` 세 컴포넌트만**) ·
    `apps/mobile/src/notifications/NotificationBell.tsx` · `apps/mobile/app/(tabs)/more.tsx`
    (**`hitSlop` 값만**) · `apps/mobile/app/(tabs)/records.tsx`(**`SectionList` prop 한 줄만**) ·
    `apps/mobile/src/a11y-contract.test.ts`
  - 금지: **레이아웃 속성 변경 금지**(`minHeight`·`padding`·`gap`·`height` 무접촉 — 렌더가
    바뀌면 픽셀락 6종 재대조가 필요해진다) · `src/ui.tsx`의 `ProductComparisonRow`(P3, 이번 범위 밖) ·
    `app/expenses/**`·`app/items/**`(라운드 64 F가 이미 진 자리 — 값만 확인하고 손대지 않는다) ·
    제품 로직 0건
  - 계약: 스크롤 스캐폴드는 `"handled"`(**`"always"` 아님** — 빈 자리를 누르면 키보드가
    내려가야 한다), 히트 영역 확장은 **이웃이 있는 컨트롤에서 세로만**(세그먼트 탭은 맞붙어
    있으므로 가로 금지 — 라운드 64가 칩에서 내린 판단과 같다), 계약 테스트는 **화면이 아니라
    컴포넌트**를 읽을 것, `theme.touchTarget`(48)을 숫자로 다시 박지 말 것

- **D 아이 날짜 입력 (달력)** (#8) — **C 머지 후**(`src/ui.tsx`를 읽기만 한다)
  - 소유: `apps/mobile/src/expenses/date-picker-month.ts` · `apps/mobile/src/expenses/ExpenseDatePicker.tsx` ·
    `apps/mobile/app/(onboarding)/child-profile.tsx` · `apps/mobile/app/settings/children.tsx` ·
    `apps/mobile/src/children/child-form.ts` · 관련 `*.test.ts`
  - 금지: `app/expenses/new.tsx`·`app/expenses/[expenseId].tsx` **무변경**(가산 인자의 기본값이
    종전 동작과 같다는 것으로 증명한다 — 두 화면을 고쳐야 한다면 설계가 틀린 것이다) ·
    `records-calendar.ts`의 `buildCalendarMonth` **재사용만**(격자 규칙을 두 벌로 만들지 않는다) ·
    도메인(`packages/domain`) 무변경 · 손타이핑 칸 **삭제 금지**
  - 계약: 미래 방향의 상한은 **도메인의 임신 주차 규칙에서 읽을 것**(새 숫자를 짓지 않는다),
    출생일은 종전과 같은 "미래 아님" 규칙(DNC-013), 칸의 접근성 라벨은 "왜 못 고르는지"까지
    말할 것(픽커의 기존 관례), 값 계약 테스트를 **먼저** 넣고 시작할 것

- **E 어드민 고지 감사** (#9) — **완전 독립(서버·어드민), 즉시 착수 가능**
  - 소유: `apps/api/src/admin/admin.controller.ts`(`updateDisclosure` 한 핸들러) ·
    `apps/api/prisma/schema.prisma`(**주석만**) · `apps/admin/src/lib/audit-log-filters.ts` ·
    `apps/admin/app/disclosures/page.tsx` · 관련 `apps/api/test/*` · `apps/admin/src/*.test.ts`
  - 금지: 모바일 0건 · **마이그레이션 신규 0건** · `adminUpdateDisclosure`의 **키 검증 신설 금지**
    (모르는 키를 막으면 나중에 쓸 키를 미리 막는다 — 표시로 해결한다) ·
    `items-catalog.service.ts`의 `defaultDisclosureFor` 무변경 · 새 e2e는 shared 레인
  - 계약: 감사 봉투에 PII 금지(문구 두 개만), `updated_by`는 **한쪽으로 정할 것**(살릴지 죽은
    컬럼으로 문서화할지 — 라운드 64 #9가 `approved_at`에서 내린 것과 같은 형식의 판단),
    "앱이 읽는 키" 배지는 서버가 실제로 읽는 두 키에서 **파생**시킬 것(어드민에 문자열을 다시
    박지 말 것 — 라운드 63 #9의 교훈)

- **F 실기기 · 접근성 문서** (#10) — **A·B·C·D 머지 후**
  - 소유: `docs/qa/runtime-verification-required.md` · `docs/qa/accessibility-offline-checklist.md` ·
    `apps/mobile/src/a11y-contract.test.ts`(**C가 넣은 계약 위에 추가만**) ·
    `apps/mobile/src/preparation/catalog-contract.ts`(**머리말 판단 문단 — P3 1번**)
  - 금지: 제품 소스 0건(계약 테스트가 읽는 대상은 A~E가 이미 머지한 파일이다)
  - 계약: 라운드 65 자신의 항목을 **한 번에** 넣는다, 후보 3의 행에는 **`TEST_LOGIN=0` 빌드**임을
    명시할 것(개발 빌드에서 재현되지 않는 첫 항목이다), 그리고 라운드 64가 미뤄 둔 판단
    ("통합자 체크를 릴리즈 게이트가 볼 수 있는 형태로 옮길지")을 **이 트랙에서 결론 낼 것**

- **머지 순서**: **B · E는 완전 독립**(B는 로그인·설정·스크립트, E는 서버·어드민 — 언제든).
  **A는 서버 1줄 + 가져오기 화면**이라 다른 모바일 트랙과 파일이 겹치지 않는다.
  **C → D 순서는 지켜야 한다** — D가 손대는 두 화면(`child-profile`·`children`)이 C가 고치는
  `CategoryChip`·`AppScreen`을 쓰므로, C가 먼저 들어가면 D의 실기기 확인이 최종 상태를 본다.
  **F는 마지막**. 후보 4·5는 같은 화면 두 곳(로그인·SET-003)을 공유하므로 **한 트랙(B)에서
  함께** 처리하고, 후보 1·2도 확정 경로를 공유하므로 나누지 않는다.
