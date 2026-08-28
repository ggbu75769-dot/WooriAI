# 라운드 64 정찰 노트 (GAP-064)

> master 6e0a006(라운드 63 머지) 기준. do-not-change.md(DNC-001~020)·known-limitations A~I절·
> gap-analysis 제외 판정·round55-plan §6 비범위표·round56~63-scout 완료분·round61-backlog
> (락 봉합 완료 + "이름만 붙인" 동시 실행 구멍)·docs/dev/source-lock.md 화면 표 대조 완료.
> 아래는 전부 그 밖이거나, 라운드 58~63이 접점으로 남긴 잔여다.
>
> **이번 라운드의 무게중심은 커머스 루프다.** 지시받은 대로 그 구간을 다시 훑었고, 라운드
> 51·52 이후 손길이 뜸했던 자리에서 **DNC-010·DNC-011에 직접 걸리는 결함 둘**과 **운영이
> 자기가 쓴 값을 되읽지 못하는 자리 하나**가 나왔다(후보 1·4·5).
>
> **선행 정정 2건(후보 아님).**
> 1. 라운드 63 P3의 「시드에 `priceCheckedAt`이 한 건도 없다」는 **지금 사실이 아니다** —
>    `apps/api/prisma/seed.ts:178-187`의 `resolveSeedPriceCheckedAt`이 가격이 있는 링크에
>    확인 시각을 채우고(재실행이 시각을 오늘로 밀지 않는 규칙까지 함께), `:229`가 그 값을
>    쓴다. dev/QA에서 판매처 가격은 **그려진다**. 그 P3 항목은 재검토가 아니라 **삭제 대상**이다.
>    (그 대신 아래 후보 4가 그 값의 **운영 쪽 사각**을 든다 — 시드가 채우기 시작한 만큼
>    오히려 지금이 더 급하다.)
> 2. 라운드 62 P3·라운드 63이 전제로 남겨 둔 「홈이 준비템 상태를 서버 값 그대로 읽는다」도
>    **해소돼 있다** — 홈은 대기 중인 상태 변경을 얹은 배열을 넘긴다
>    (`app/(tabs)/index.tsx:1092-1096` `recommendedItemsWithPendingStatus` → `:1663-1667`·`:1542`,
>    라운드 51 QA P2-2). 오프라인 준비 상태의 홈↔준비템 탭 불일치는 **재제안 대상이 아니다.**

## 상위 후보

### 1. 화면에서 가장 강한 구매 버튼이 **스폰서 링크를 연다** — 바로 옆 판정은 그걸 막고 있다 — S
- **근거**: 판매처 행의 채워진 "구매하기"는 **첫 비스폰서 링크**가 받는다. 그 판정은 순수 모듈에
  있고 근거 문단까지 붙어 있다 — "구분은 하되, 구분이 우대가 되면 안 된다"
  (`src/items/link-marker.ts:237-254` `primaryPurchaseLinkIndex`, 배선 `app/items/[itemTemplateId].tsx:657`·`:897`).
  그런데 카드 아래 **전폭 PrimaryButton "바로 구매하기"**는 그 판정을 지나지 않고
  `visibleDetail.productLinks[0]`을 그대로 연다(`:973-982`, 특히 `:977`
  `const firstLink = visibleDetail.productLinks[0];`). 즉 같은 화면에서 스폰서 행은 외곽선
  버튼으로 격하되고, 그 아래 가장 큰 버튼이 **같은 스폰서 링크**를 연다.
- **실패 시나리오**: 가정이 아니라 **지금 시드로 재현된다.** 시드 링크 58건은 품목당 1건이고,
  그중 다섯(`stroller`·`pregnancy_diary`·`wipes_bulk`·`push_walker`·`kids_bicycle`)은 **유일한
  링크가 스폰서**다(`apps/api/prisma/seed-data.ts:1229·1289·1469·1694·1919 부근
  `isSponsored: true`). 그 다섯 상세에서 `primaryPurchaseLinkIndex`는 `-1`이라 채워진 버튼이
  하나도 없는데, 바로 아래 "바로 구매하기"는 그 광고 링크를 연다 — DNC-011이 세우려던 시각
  구분이 **한 줄 아래에서 통째로 되돌려진다.** 운영에서는 더 조용하다: 링크 순서는 어드민
  `displayOrder`와 워커 헬스 강등이 함께 정하므로(`apps/api/src/onboarding/items-catalog.service.ts:129-145`
  `sortProductLinksForApp`), **비스폰서 1순위 링크가 broken 판정을 받아 뒤로 밀리는 순간**
  스폰서가 index 0으로 올라온다. 코드 변경도 어드민 조작도 없이 그날부터 전폭 CTA가 광고가
  된다. 스토어 신고서가 "현재 스폰서 미운영 전제"라고 적어 둔 그 스위치를 켜기 전에 닫아야
  하는 자리다(`docs/store/data-safety-answers.md` §D).
- **최소안**: 새 판정을 만들지 않는다 — `primaryPurchaseLinkIndex`가 이미 답을 알고 있다.
  "바로 구매하기"가 그 인덱스의 링크를 열고, `-1`(전부 스폰서)이면 **그 버튼을 렌더하지
  않는다**(링크 0건에서 죽은 버튼을 지운 라운드 43 C2와 같은 규율 — 판매처 행의 외곽선 "구매"는
  그대로 남아 스폰서 링크로 갈 길은 여전히 있다). 고지 문구는 종전 그대로 집합 판정이 정하므로
  (`productLinksDisclosureText`) 한 글자도 바뀌지 않는다.
- **설계 긴장**: 정렬은 건드리지 않는다(DNC-009 — 이 라운드에서 링크 순서를 바꾸는 변경은
  금지다). "전부 스폰서면 CTA가 사라진다"는 것이 구매 경로를 좁히는 것 아닌가: 좁히지 않는다
  — 같은 링크가 판매처 행에 그대로 서 있고 그 행에는 스폰서 배지·캡션이 붙어 있다. 오히려
  **광고를 광고라고 말한 자리에서만** 누르게 되는 것이 DNC-011의 취지다. ITEM-002 픽셀락은
  비세션 프리뷰 경로이고 그 픽스처의 index 0은 비스폰서라(`app/items/[itemTemplateId].tsx:235-241`)
  캡처 렌더가 한 픽셀도 달라지지 않는다.

### 2. 준비템 **목록**이 비용을 한 글자도 말하지 않는다 — 지출 관리 앱의 준비물 화면인데 — M
- **근거**: 서버는 준비템마다 가격대를 내려준다(`ItemSummary.priceBandText` — `src/api/client.ts:266`,
  서버 `items-catalog.service.ts`의 `priceBandText(priceMinKrw, priceMaxKrw)`). 앱은 그 값을
  받아서 **비세션 미리보기에서만** 그린다(`app/(tabs)/items.tsx:674-682` — `ProductCard price=`,
  `ITEM_PRICE_BAND_FALLBACK_TEXT`도 그 한 자리에서만 쓰인다: `src/items/item-labels.ts:89`).
  세션 렌더는 DSN-053 P2-B의 타일 그리드이고, 그 타일이 받는 계약에는 **가격 필드가 아예 없다**
  (`src/preparation/PreparationListParity.tsx:19-32` `PreparationParityItem` = id·code·nameKo·
  timelineBucket·dueWindowLabel·plan·groupId). 어댑터도 가격을 옮기지 않는다
  (`src/preparation/catalog-contract.ts` `toPreparationParityItem`).
- **실패 시나리오**: 핵심 루프의 3단("시기별 준비템 확인")은 **무엇을 얼마에 준비해야 하는가**를
  보는 자리다. 지금 그 화면이 말하는 것은 이름·분류·상태 pill·준비율뿐이고, 비용은 품목을
  하나씩 열어야만 나온다 — 한 밴드에 수십 개가 서 있는 화면에서 "이번 달에 뭘 먼저 살까"를
  정하려면 상세를 스무 번 왕복해야 한다. 같은 앱의 홈 히어로는 이번 달 지출을, 리포트는 누적을
  말하는데, 정작 **앞으로 나갈 돈**을 보여 줄 수 있는 유일한 화면만 그 값을 버린다. 그리고
  버려지는 것은 추정이 아니라 **서버가 이미 보낸 사실**이다.
- **최소안**: `PreparationParityItem`에 `priceText?: string` 한 칸을 **가산**하고, 어댑터가
  `priceBandText`를 그대로(가공 없이) 옮기고, 타일이 값이 있을 때만 한 줄 그린다 — 없으면 줄이
  없다(`ITEM_PRICE_BAND_FALLBACK_TEXT`를 목록에 다시 쓰지 않는다: "가격 정보가 없어요"를 30개
  타일에 반복하면 화면이 모르는 것을 말하는 데 절반을 쓴다). 합계·평균은 **만들지 않는다**.
- **설계 긴장**: **이 후보만 채택 판단이 선행이다.** `docs/5차/design-restore-spec.md`의
  ITEM-001 항목이 타일 구성을 "148h·원 44 pill·이름 12/700 2줄 균형·상태 pill"로 못박고 있어,
  줄 하나를 더하는 것은 승인 디자인에 대한 **변경 요청**이다(DNC 규율대로 임의 변경 대신
  문서화가 먼저다). 다만 잠금 그 자체는 아니다: ITEM-001 픽셀락 캡처는 **비세션 분기**이고
  (`app/(tabs)/items.tsx:630-692`) 이번 변경은 세션 렌더에만 닿으므로 캡처는 불변이다.
  그리고 가격대는 **범위 문자열**이라 합계로 쓸 수 없다 — 그 사실이 이미 앱의 두 곳에 근거로
  적혀 있다(`src/items/linked-expense.ts:16`, `app/items/[itemTemplateId].tsx:1031` "범위라 특정
  값을 지어내는 셈"). 그래서 이 후보의 상한은 **한 줄 표시**이고, "준비 예상 비용 합계" 같은
  파생은 이 라운드 밖이다.

### 3. 카카오톡으로 나가는 리포트 숫자에는 **대기 고지가 붙지 않는다** — 화면에는 붙는데 — S
- **근거**: 라운드 63 트랙 A가 대기 고지를 세 자리(홈 누적·홈 마일스톤 부제·리포트 누적)로
  넓혔지만, 그 숫자를 **앱 밖으로 내보내는 경로**는 지나지 않았다. 월간 요약 공유 문구는
  머리글·금액·구간·인사이트·앱 서명 다섯 줄이고(`src/reports/share-text.ts:97-112`
  `buildMonthlyShareMessage`), 대기 건수는 인자에도 없다. 정작 같은 화면이 그 건수를 이미
  손에 쥐고 있다 — `evaluateReportPendingScopeNotice`가 선택 기간(월/분기/연) 기준으로 세고
  있고(`app/(tabs)/reports.tsx:238-250`), 월간 공유는 정확히 그 **월 스코프**다
  (`:622-628`, 버튼 `:896-906`).
- **실패 시나리오**: 지하철에서 3건을 적고 리포트 탭을 연다. 화면 머리에는 "반영되지 않은
  기록 3건"이 서 있고, 그 아래 인사이트 카드의 [공유하기]를 누르면 그 3건이 빠진 금액이
  배우자에게 그대로 간다 — 보내는 사람은 화면의 고지를 봤지만 **받는 사람은 볼 근거가 없다**.
  이 모듈이 없애려던 결함과 정확히 같은 모양이다: 이미 "8월 1일~27일 기준" 줄로 *부분 구간*을
  밝히고 있고(`share-text.ts:22-31`), 그 줄이 빠질 수 있는 경우에는 **공유 자체를 접는다**
  (`:101-103` F-5 fail-safe). *부분 반영*만 그 규율 밖에 있다.
- **최소안**: 문구를 새로 만들지 않는다 — 화면 세 자리가 쓰는 그 문장 조각
  (`src/reports/pending-scope-notice.ts`)을 금액 줄 **바로 아래** 한 줄로 넣는다(구간 줄과 같은
  자리·같은 이유). 인자는 건수 하나이고, 0이면 줄이 없어 종전 문구와 한 글자도 다르지 않다.
- **설계 긴장**: 마일스톤(100일/첫돌) 공유는 **뺀다** — 그 창은 라운드 63이 "제3의 기간이라
  월/분기/연 스코프로도 누적의 무기간 규칙으로도 셀 수 없다"고 판정하고 남긴 자리이고, 여기서
  창 경계를 다시 계산하면 집계 규칙이 두 벌이 된다. 대안으로 "대기가 있으면 공유 버튼을 감춘다"
  (F-5와 같은 fail-safe)도 성립하지만, 부분 구간은 **말할 수 없는** 사실이었던 반면 대기 건수는
  **말할 수 있는** 사실이라 감추는 쪽이 과하다.

### 4. 어드민이 CSV로 써 넣은 **판매처 가격을 되읽을 수 없다** — 같은 화면의 URL은 되읽는다 — S/M
- **근거**: 어드민 상품 링크 DTO에 가격 두 필드가 **없다**(`items-catalog.service.ts:628-645`
  `toAdminProductLinkDto` — id·platform·title·url·affiliateUrl·isAffiliate·isSponsored·
  disclosureText·active·`healthStatus`·`healthCheckedAt`). 앱용 DTO에는 있다(`:567-585`
  `toProductLinkDto`, "둘 다 있을 때만" 규칙까지). 화면도 마찬가지다 — 링크 목록 표에는 가격
  열이 없고(`apps/admin/app/links/page.tsx`, 헬스 배지는 `:575-578`에 있다), 벌크 미리보기 행은
  **현재/새 제휴 URL만** 든다(`apps/admin/src/lib/admin-api.ts:542-557`
  `ProductLinkBulkPreviewRow`, 표 `src/components/ProductLinkBulkReplace.tsx:275-301`). 그런데
  가격을 쓰는 **유일한** 경로가 바로 그 CSV다(`PRODUCT_LINK_BULK_CSV_HEADER` — `admin-api.ts:562`,
  서버 `product-link-bulk.service.ts:107-123`이 `priceCheckedAt`을 함께 찍는다).
- **실패 시나리오**: 셋이 겹친다. ⓐ **쓰기 확인 불가** — 500행 CSV를 적용하고 받는 것은
  `{applied, skipped, errors}` 숫자 셋뿐이다(`ProductLinkBulkApplyResult`). 타임아웃 뒤 반영을
  확인하라고 패널이 제공하는 재조회조차 URL만 대조한다(그 근거가 주석에 그대로 있다 —
  `ProductLinkBulkReplace.tsx:102-105` "현재 제휴 URL이 새 URL과 같으면 이미 반영된 것").
  가격이 반영됐는지는 **어디에서도 확인할 수 없다.** ⓑ **조용한 만료** — 앱은 확인 시각이
  180일을 넘긴 스냅샷을 그리지 않는다(`src/items/link-price.ts:41-47`·`:88`
  `LINK_PRICE_MAX_AGE_DAYS`). 그 판정은 정직하지만 **아무에게도 보고되지 않는다**: 어느 날부터
  가격 비교가 통째로 비어도 운영은 알 길이 없고, 헬스처럼 어드민에 배지가 서지도 않는다.
  ⓒ **커버리지 불가시** — 62개 품목 중 몇 개에 가격이 있는지 세는 수단이 없다.
  같은 워커/배치가 쓰는 값인데 `healthStatus`는 표에 있고 가격만 없는 비대칭이다.
- **최소안**: `toAdminProductLinkDto`에 `priceSnapshotKrw`·`priceCheckedAt` 두 줄을 **가산**하고
  (앱 DTO의 "둘 다 있을 때만" 규칙을 여기서 재사용한다 — 어드민에는 한쪽만 있는 상태도
  보여야 하므로 **값은 그대로 싣되 화면이 그 상태를 이름으로 말한다**: "시각 없음"),
  링크 표에 가격·확인 시각 열 하나. 만료 표기는 새 상수를 만들지 않고 `LINK_PRICE_MAX_AGE_DAYS`를
  계약에서 읽는다(숫자를 어드민에 다시 박으면 다음 라운드에 갈린다 — 라운드 63 #9의 교훈).
  벌크 미리보기 행에 `currentPriceSnapshotKrw`/`newPriceSnapshotKrw`를 더하면 ⓐ가 함께 닫힌다.
  **마이그레이션 0건, 새 엔드포인트 0건.**
- **설계 긴장**: DNC-009 — 가격은 표시 전용이고 정렬·추천에 절대 들어가지 않는다(그 계약은
  `link-price.ts:49-52`와 `sortProductLinksForApp`이 함께 지고 있으며, 이 변경은 어느 쪽도
  건드리지 않는다). "만료 임박"을 배지로 말할지 목록 필터로 말할지는 헬스 필터
  (`src/lib/link-filters.ts`)의 관례를 따르되, **필터를 늘리면 그만큼 어드민 상태가 늘어난다** —
  이번 최소치는 열 하나 + 지난 값의 시각적 흐림까지다.

### 5. 제휴 고지가 **경로마다 다르게 나간다** — 공유 메시지에는 아예 없다 — S
- **근거**: 두 자리가 어긋나 있다.
  - ⓐ **공유 메시지에 고지가 없다.** 링크를 자동으로 열지 못했을 때 뜨는 카드의 "링크 공유하기"는
    리다이렉트 URL **한 줄만** 보낸다(`app/items/[itemTemplateId].tsx:539-542`
    `Share.share({ message: linkOpenFallback.redirectUrl })`). 바로 그 상태 객체가
    `disclosureText`를 들고 있는데도(`:299-303`·`:514`) 화면 문구 복원에만 쓰인다. 받는 사람은
    **제휴 링크라는 사실을 한 번도 듣지 못한 채** 그 URL로 구매한다. 상세 상단의 [공유하기]도
    같은 계열이다 — 이름·가격대만 보내고 링크도 고지도 없다(`:719-725`).
  - ⓑ **클릭 응답만 기본 고지를 붙이지 않는다.** 서버는 링크의 `disclosure_text`가 비면 종별
    기본 문구(어드민이 관리하는 `affiliate_purchase`/`sponsored_product`)로 채워 준다 —
    앱 DTO(`items-catalog.service.ts:581`)와 어드민 DTO(`:638`) 둘 다 `defaultDisclosureFor`를
    지난다. **클릭 응답만 지나지 않는다**(`:276` `disclosureText: productLink.disclosureText ?? undefined`).
    그래서 그 링크를 누르면 앱의 확인 카드가 고지 대신 `"구매 링크"`를 쓴다(`:504-506`).
- **실패 시나리오**: ⓑ는 시드에서는 재현되지 않는다 — 시드의 `disclosureText: null` 34건은
  전부 제휴도 스폰서도 아닌 일반 링크다(확인함). **재현 조건은 운영의 정상 경로다**: 어드민이
  제휴 링크를 만들면서 문구 칸을 비우고 고지 CMS(`PUT /admin/disclosures/:key`)의 기본값에
  기대는 것 — 그러라고 만든 기능이다. 그 순간 목록은 고지를 말하고 클릭 카드는 말하지 않는다.
  ⓐ는 조건이 없다: 오늘도 링크를 열지 못한 사람이 "링크 공유하기"를 누르면 고지 없는 제휴
  URL이 그대로 나간다. DNC-010은 "구매 CTA 인접 위치에 고지를 숨기지 않는다"는 계약인데,
  **앱 밖으로 나간 구매 링크에는 인접이라 부를 자리 자체가 없다** — 그러면 문장을 함께
  보내는 것 말고 지킬 방법이 없다.
- **최소안**: ⓐ 공유 메시지를 `{disclosureText}\n{url}` 두 줄로 만든다. 문구는 화면이 이미
  들고 있는 값이고(없으면 집합 판정 `productLinksDisclosureText`의 결과를 쓴다), 조립은
  `link-marker.ts`에 한 줄 짜리 순수 함수로 두어 두 벌이 되지 않게 한다. 고지 대상이 없는 일반
  링크는 **종전 그대로 URL 한 줄**이다(없는 고지를 지어내지 않는다 — 라운드 43 M-1 규율).
  ⓑ 클릭 응답이 `defaultDisclosureFor`를 지나게 한다(서버 한 줄, 같은 파일 안).
- **설계 긴장**: 제휴 URL을 앱 밖으로 내보내는 일 자체를 좁힐지가 별개 판단으로 남는다 —
  이 저장소에는 그 목적의 **공개 리다이렉트**가 이미 있다(후보 8). 이번 최소안은 "지금 나가는
  것에 고지를 붙인다"까지이고, 목적지를 `/r/:code`로 바꾸는 것은 후보 8과 함께 판단한다.

### 6. 매일 누르는 칩들이 **48dp 최소 타깃에 미달**한다 — 저장소 자신의 토큰이 48이다 — S
- **근거**: `theme.touchTarget = 48`(`src/theme.ts:179`, DSN-053 토큰 표에도 "**touchTarget 48**"로
  못박혀 있다). 그런데 기록 경로의 제안 칩들은 `minHeight: 38` + `hitSlop 3` = **44dp**다 —
  최근 품목(`app/expenses/new.tsx:1560`·`:1584`), 품목 자동완성(`:2036`·`:2045`), 판매처 제안
  (`:1937`·`:1946`), 지출 상세의 판매처 제안(`app/expenses/[expenseId].tsx:938`·`:947`).
  커머스 상세의 플로팅 크롬 둘도 같다 — 34dp 정사각 + `hitSlop 5` = **44dp**
  (`app/items/[itemTemplateId].tsx:175-182`·`:187`·`:190`). 같은 저장소가 다른 자리에서는
  이 규율을 명시적으로 지킨다: 상세 탭 밴드에 "텍스트+패딩(≈31dp)에 hitSlop 6으로는 48dp 타깃
  미달이라 높이로 확보한다"(`app/items/[itemTemplateId].tsx:820`), 예산 칩·리포트 화살표·
  아이 전환 트리거는 `minHeight: theme.touchTarget`을 직접 쓴다.
- **실패 시나리오**: 이 칩들은 **하루에 가장 여러 번 눌리는 컨트롤**이다(빠른 기록 시트의
  프리필 3종). 한 손으로 유아를 안고 지하철에서 누르는 상황이 이 앱의 기본 자세인데, 44dp는
  WCAG 2.5.8(24) 은 넘지만 이 저장소가 스스로 고른 48dp 규율에는 못 미친다 — 빗나간 탭은
  가로 ScrollView에서 스크롤로 먹히므로 "눌렀는데 아무 일도 없다"로 나타난다. 커머스 상세의
  [공유하기]는 더 나쁘다: 그 화면에서 **그 버튼 말고 공유에 닿는 길이 없다**(뒤로가기는 OS
  제스처가 대신하지만 공유는 대체 경로가 없다). a11y 계약 테스트에도 터치 타깃을 보는 단언이
  **0건**이라(`src/a11y-contract.test.ts` 57건 중 없음) 다음에 생길 칩도 같은 값으로 태어난다.
- **최소안**: **`hitSlop`만 올린다** — 칩은 3 → 5(38+10=48), 크롬은 5 → 7(34+14=48).
  `hitSlop`은 레이아웃 속성이 아니라 히트 영역이라 **렌더는 한 픽셀도 바뀌지 않는다**:
  EXP-001·EXP-003·ITEM-002 픽셀락이 전부 그대로다. `a11y-contract.test.ts`에 "이 화면군의
  Pressable은 (높이 + 2×hitSlop) ≥ theme.touchTarget" 소스 계약 1건을 더해 재발을 막는다.
- **설계 긴장**: 없다시피 하다. 다만 `hitSlop`을 늘리면 이웃 칩의 히트 영역과 겹칠 수 있는데,
  칩 사이 `gap`이 8이라 세로 확장(38→48)은 겹치지 않고 가로는 좌우 5씩이라 gap 8 안에서
  만난다 — **가로는 늘리지 말고 세로만** `{top, bottom}` 형태로 주는 것이 안전한 모양이다.
  이 판단을 계약 테스트 문구에 함께 적어 둘 것.

### 7. 어드민이 **복구 코드를 몇 장 남겼는지 모른 채** 태운다 — 다 쓰면 영구 잠금이다 — S
- **근거**: 라운드 63 #3이 재등록 입구를 세우면서 화면이 "복구 코드는 한 번만 쓸 수 있어요"라고
  **말하기 시작했다**(`apps/admin/src/components/AdminShell.tsx:246-252`). 그런데 몇 장 남았는지는
  어디에도 없다. 서버는 안다 — 로그인 때 쓴 코드를 목록에서 빼고 남은 배열을 다시 쓴다
  (`apps/api/src/admin/admin-auth.service.ts:363-367`, 감사 로그 `:191` `admin.mfa_recovery_code_used`).
  세션 응답이 나르는 것은 `mfaEnabled` 불리언 하나뿐이라 화면이 물어볼 자리가 없다.
- **실패 시나리오**: 라운드 63이 고친 것은 "인증 앱을 잃었을 때의 출구"이고, 남은 것은 **그
  출구에 닿기 전에 연료가 떨어지는 경로**다. 폰을 바꾼 운영자는 복구 코드로 로그인하다가 —
  코드가 한 장씩 소모된다는 사실은 화면이 말해 주지만 잔량은 말해 주지 않으므로 — 마지막 한
  장을 쓴 것을 **다 쓴 뒤에야** 안다. 그 시점에 인증 앱도 코드도 없으면 재등록 입구
  (`MfaDisableForm`)조차 코드를 요구하므로 들어갈 수 없고, 남는 복구책은 `admin_users` 직접
  UPDATE뿐이다 — 라운드 63이 없애려던 바로 그 상태로 되돌아간다. 감사 로그에 소모 기록이
  쌓이지만 그것은 **사후 조회**이고, 잠긴 사람은 어드민에 못 들어가므로 볼 수 없다.
- **최소안**: 세션/`me` 응답에 `mfaRecoveryCodesRemaining: number` 한 칸(**개수만** — 값도
  해시도 절대 싣지 않는다). 헤더 계정 영역의 재등록 안내 옆에 "남은 복구 코드 N장" 한 줄,
  임계(예: 1장) 이하에서는 지금 재등록하라는 문장을 같은 자리에 덧붙인다(새 화면·새 라우트
  0건 — 라운드 63 #3이 세운 그 자리 그대로). 문구는 이미 있는 안내와 같은 톤을 쓴다.
- **설계 긴장**: 잔량 노출이 공격자에게 주는 정보는 "몇 번 더 시도할 수 있나"가 아니다 —
  복구 코드는 추측 대상이 아니라 소지 대상이고, 이 값은 **로그인을 마친 세션에만** 보인다.
  다만 그 사실을 근거 주석에 남겨야 다음 라운드가 되돌리지 않는다. 코드 **재발급만** 하는
  별도 경로(해제 없이)를 만들지는 않는다 — SEC-101의 "해제 → 즉시 재등록" 순서를 흐리고,
  라운드 63이 그 순서를 유일하게 안전한 모양으로 판정했다.

### 8. `/r/:code` 공개 리다이렉트가 **도달 불가능하다** — 코드를 아는 화면이 하나도 없다 — S
- **근거**: 컨트롤러는 완성돼 있다 — 인증 없는 공개 라우트, 오픈 리다이렉트 방어, 도메인
  allowlist, 익명 클릭 행 기록까지(`apps/api/src/items-commerce/redirect.controller.ts:23-69`).
  `product_links.redirect_code`는 NOT NULL UNIQUE이고 시드·생성 경로가 값을 채운다
  (`apps/api/prisma/seed.ts:238-240`, 마이그레이션 000007). 그런데 **저장소 전체에서 그 컬럼을
  읽는 곳은 이 컨트롤러의 `findFirst` 한 줄뿐이다** — 앱 DTO에도, 어드민 DTO에도, 어드민
  화면에도, 계약에도 `redirectCode`가 없다(전 소스 grep 결과 2건: 그 주석과 그 쿼리). 즉
  코드를 알아내는 유일한 방법은 12자 hex를 맞히는 것이다.
- **실패 시나리오**: 주석이 스스로 목적을 적어 뒀다 — "meant to be shared/clicked by anyone,
  including someone with no WooriAI account". 그 목적이 오늘 하나도 실현되지 않는다: 마케팅
  링크를 만들 수도, 고객에게 상품을 보낼 수도 없고, 000008이 익명 클릭을 위해 컬럼 셋을
  nullable로 바꾼 마이그레이션도 놀고 있다. 그리고 이 부재가 후보 5ⓐ를 더 나쁘게 만든다:
  앱이 밖으로 내보낼 수 있는 유일한 링크가 **원본 제휴 URL**이라, 공유될 때마다 우리 고지도
  우리 클릭 계측도 없이 파트너로 직행한다. 공유용으로 설계된 안전한 URL이 옆에 있는데 쓰이지
  않는 것이다. 라운드 58 #3(`lockNow`)·라운드 63 #3(`adminMfaDisable`)과 **같은 모양**이지만
  이번에는 死코드가 export가 아니라 **라우트와 컬럼**이다.
- **최소안**: 어드민 링크 표에 "공유 링크" 한 칸을 세운다 — `toAdminProductLinkDto`에
  `redirectCode`를 가산하고, 화면이 `${INVITE_LINK_BASE_URL}/r/${code}` 관례로 조립해 복사
  버튼을 붙인다(그 베이스 URL 관례는 초대 링크가 이미 쓴다 —
  `apps/api/src/households/household-runtime.service.ts:325-327`, `scripts/check-env.ts:42`).
  **모바일 0건**이고, 앱의 공유 경로를 이 URL로 바꾸는 것은 후보 5의 고지 규칙이 먼저 선
  뒤에 판단한다.
- **설계 긴장**: 공개 링크를 운영이 뿌리기 시작하면 **고지가 앱 밖에 남지 않는다** — 그래서
  복사 버튼 옆에 "이 링크를 공유할 때는 제휴 고지 문구를 함께 보내세요"를 종별 기본 문구와
  함께 제공하는 것이 이 후보의 필수 조건이다(DNC-010). 대안은 이 라우트를 **의도적으로 죽은
  것으로 문서화**하고 컬럼 주석에 그 판단을 남기는 것 — `import_rows.rawJson`이 라운드 60에서
  받은 처리와 같다. 둘 중 하나는 골라야 한다: 지금처럼 아무 말 없이 두면 다음 정찰이 같은
  자리를 또 판다.

### 9. 엑셀 가져오기의 **승인 순간이 아무 데도 남지 않는다** — 그러라고 만든 컬럼이 비어 있다 — S
- **근거**: `import_jobs.approved_at`은 스키마에 있고(`apps/api/prisma/schema.prisma:490`),
  **저장소 전체에서 읽지도 쓰지도 않는다**(grep 1건 = 그 선언). 확정 경로는 상태를 `confirmed`로
  바꾸고 `importedCount`만 적는다(`apps/api/src/onboarding/import-pipeline.service.ts:304-359`,
  특히 `:316-342`). 감사 로그도 없다 — 같은 저장소의 지출 수정·삭제, 아이 삭제, 가구 탈퇴,
  계정 삭제, 그리고 라운드 63이 더한 `budget.upsert`까지 전부 `auditLogger.record`를 지나는데
  (`apps/api/src/finance/expenses.controller.ts:98`·`:118`,
  `settings.controller.ts:49`·`:97`·`:142`, `budgets.controller.ts:63`) 가져오기 컨트롤러에는
  한 건도 없다(`apps/api/src/imports/imports.controller.ts` 전체).
- **실패 시나리오**: DNC-012는 이 앱의 돈 데이터 신뢰 계약이다 — "미리보기와 **승인** 전
  `expenses`에 저장하지 않는다". 그 계약의 핵심 사건인 **승인**이 서버에 사건으로 남지 않는다.
  확정은 쓰기 권한이 있는 **아무 구성원이나** 할 수 있고(`requireImportJobAccess(user, id, true)`),
  잡 행이 아는 사람은 업로드한 사람(`user_id`)뿐이다. 대개는 만들어진 지출의
  `created_by_user_id`로 승인자를 역추적할 수 있지만, **유효 행이 0건이면 그마저 없다** —
  잡은 영구히 `confirmed`가 되어 다시 확정할 수 없는데(`:306-308` `preview_ready`만 확정 가능)
  누가 언제 그렇게 만들었는지 답할 근거가 서버에 하나도 없다. 게다가 90일 뒤 phase 9가 검수
  행을, phase 11이 파일명을 지우면(라운드 63 #6) 남는 것은 건수뿐이다. "카드 내역을 가져왔는데
  일부가 안 들어왔어요" CS에 어드민이 답할 자료가 0이 되는 구간이 바로 그때다.
- **최소안**: 확정 트랜잭션이 `approvedAt: new Date()`를 함께 적고(**마이그레이션 0건** —
  컬럼은 이미 있다), 컨트롤러가 `record({ action: "import.confirm", targetType: "import_job",
  before: { status, candidateCount }, after: { importedCount, skippedCount } })` 한 건을 남긴다.
  어드민 액션 프리셋(`apps/admin/src/lib/audit-log-filters.ts`)에 한 줄. 봉투에 **파일명을 싣지
  않는다** — 그 문자열이야말로 phase 11이 90일 뒤 마스킹하는 값이라, 감사 로그(730일)에 복사하면
  라운드 63 #6이 닫은 구멍이 더 긴 창으로 되살아난다.
- **설계 긴장**: 볼륨은 문제가 아니다(가져오기는 드물고 멱등 인터셉터가 이미 붙어 있다 —
  `imports.controller.ts:141`). 진짜 판단은 `approved_at`을 **어디의 진실로 삼을지**다:
  감사 로그가 생기면 그 컬럼은 중복이 되므로, 컬럼을 "확정 시각의 단일 소스"로 선언하고
  스키마 주석에 근거를 남기든지(그러면 `updated_at`에 기대는 코드가 없어야 한다) 아예 죽은
  컬럼으로 문서화하든지 **한쪽으로 정해야 한다**. 이번 최소안은 전자다 — 컬럼 이름이 이미
  그 뜻이고, 어드민이 잡을 조회하게 될 때 감사 로그 조인 없이 읽을 수 있는 값이 하나는
  있어야 한다.

### 10. 실기기 체크표·a11y 스윕의 라운드 64분 — 라운드 63이 세운 전용 트랙을 이번에도 돌린다 — S
- **근거**: 라운드 63 트랙 F가 규율을 **전용 트랙**으로 승격시켰고 실제로 잔여 없이 마감했다 —
  §1-1이 43~48번까지(`docs/qa/runtime-verification-required.md:150-155`), a11y는 A-3의 #21·#22
  보강 + 새 A-4(#23~#26)까지 들어와 있다(`docs/qa/accessibility-offline-checklist.md:87-97`).
  즉 이번 라운드에 **물려받은 빚은 없다** — 새로 만드는 몫만 있다.
- **최소안**: 이번 라운드가 사용자에게 보이게 만드는 변화마다 §1-1에 한 행 —
  스폰서 CTA 격하(후보 1: "유일한 링크가 스폰서인 품목에서 전폭 CTA가 사라지고 판매처 행의
  외곽선 버튼만 남는가"), 준비템 목록 가격 줄(후보 2, 채택 시), 공유 문구의 대기 줄(후보 3:
  대기 3건 상태에서 공유한 텍스트에 그 줄이 있는가 · 0건이면 종전과 같은가), 공유 메시지의
  고지(후보 5ⓐ), 터치 타깃(후보 6: **렌더가 한 픽셀도 안 바뀌었는지**와 빗나간 탭이 줄었는지를
  함께 본다). a11y는 A-5 표로 이어 붙이고, `src/a11y-contract.test.ts`에 후보 6의 타깃 계약과
  후보 1의 CTA 라벨 계약을 넣는다.
- **설계 긴장**: 라운드 63이 남긴 판단 하나가 그대로다 — "통합자 체크를 문서 안의 문장이 아니라
  **릴리즈 게이트가 볼 수 있는 형태**로 옮길지". 라운드 63은 전용 트랙으로 답했고 그것이
  실제로 통했으므로, 이번 라운드는 **자동화를 새로 시도하지 말고** 같은 방식을 한 번 더 돌린
  뒤 두 라운드치 근거로 판단하는 쪽을 권한다.

## P3

- **`ProductComparisonRow`의 `caption` 기본값이 아직 `"무료배송"`이다**(`src/ui.tsx:594`).
  라운드 43 C3이 "배송 조건은 API 어디에도 없는 값이라 근거 없는 주장"이라며 없앤 그 문자열이
  기본 인자로 남아 있고, **비세션 경로에서 실제로 렌더된다**(상세가 `caption={hasSession ? … : undefined}`를
  넘기므로 — `app/items/[itemTemplateId].tsx:900`). ITEM-002 픽셀락 캡처 안이라 실사용자에게는
  보이지 않지만, 기본값을 지우려면 캡처 대조가 선행이다.
- **주석 드리프트 1건(라운드 63 P3 그대로 남음)** — `src/stores/recurring-expense.store.ts:85-87`이
  "배선을 하지 않았다 — 후속 배선용 계약이다"라고 적어 뒀는데 배선은 이미 있다
  (`app/expenses/[expenseId].tsx:127`·`:743`·`:1384`).
- **정기 지출 문구·절단의 단일 소스 미정리 — 네 라운드째** (`recurring-expense.store.ts:64`·`:226`).
  저장소가 자기 손으로 두 번 적어 둔 후속이고 라운드 59부터 밀렸다.
- **`__resetOnboardingStepAnalyticsForTests` 死코드**(`src/onboarding/step-ui.tsx`) — 참조 0건
  (테스트 포함). 라운드 63 P3에서 그대로 넘어왔다.
- **`affiliate_clicks.user_agent`가 원문 그대로 400일 남는데 읽는 곳이 0건이다.**
  두 클릭 경로가 헤더를 그대로 적고(`items-catalog.service.ts:269`,
  `redirect.controller.ts:64`), 어드민 클릭 통계는 플랫폼·링크·날짜로만 집계한다
  (`affiliate-click-breakdown.service.ts`). 같은 문자열은 분석 페이로드에서는 **금지 키**다
  (`packages/contracts/src/analytics.ts:304` `userAgent`). 처리방침·데이터 안전 신고에 기재는
  돼 있으므로(`docs/store/data-safety-answers.md:129`) 허위는 아니지만, **수집 최소화** 쪽으로는
  근거가 없는 보관이다. 줄이는 방향은 신고 문구와 함께 움직여야 해서 PM 확인이 선행이다.
- **4가구 이상 계정의 "다른 가구 보기"에는 여전히 전용 화면이 없다** —
  `householdSwitchPrompt`가 초과 사실을 정직하게 돌려주고 본문 한 줄로 말하지만
  (`src/family/household-scope.ts:366-385`), 그 주석이 예고한 "다음 라운드의 전체 목록 화면"은
  아직 없다. 라운드 61 #1이 남긴 자리.
- **아이 삭제 대상 표기의 다자녀 문턱** — 1아이 계정에도 이름을 적는 편이 더 정직하다는 판단이
  코드 주석에 이미 적혀 있고(`household-scope.ts:428-433`), 가구 탈퇴 쪽 짝과 **함께** 옮기는
  별도 판단으로 남아 있다.
- **`pending` 초대의 게으른 만료 사각**(파기 잡 phase 10 주석,
  `data-retention-purge.job.ts:222-233`) · **첫돌 이후 리포트 고착**(`milestone-selection.ts:54`) ·
  **`viewedHouseholdId` 탭 이탈 소실**(`app/family/index.tsx:160-176`) · **더보기 세션 메뉴에
  정기 지출 부재** · **다자녀 알림은 "본 아이" 것만 생성**(`generators.ts:456-499`) —
  라운드 62·63이 남긴 그대로이고 이번 라운드에도 상태 변화가 없다.

## 코드 건강 판정

- **死코드의 무게중심이 export에서 스키마·라우트로 옮겨 갔다.** 저장소 전체(mobile/api/admin/
  contracts/domain + scripts)에서 참조 0인 export는 **둘뿐**이고(`__resetOnboardingStepAnalyticsForTests`,
  `isStageBandLabel`) 둘 다 무해하다 — 라운드 63이 지목한 `adminMfaDisable`은 배선됐다. 반면
  **읽히지 않는 스키마·라우트가 셋** 있다: `import_jobs.approved_at`(쓰기·읽기 0 — 후보 9),
  `product_links.redirect_code` + `GET /r/:code`(노출 0 = 도달 불가 — 후보 8),
  `import_rows.raw_json`(이미 주석으로 죽은 컬럼 선언 — 유지). 다음 라운드의 스윕은 export가
  아니라 **컬럼·라우트 단위**로 도는 편이 값이 있다.
- **주석 드리프트 2건**(P3의 `recurring-expense.store.ts:85-87`, `ui.tsx:594`의 `"무료배송"`
  기본값 — 후자는 주석이 아니라 코드가 주석을 배신한 경우다). 라운드 63 대비 하나 늘었다.
- **구조 대변경은 여전히 비권장.** `app/(tabs)/index.tsx` 2,506줄 · `app/expenses/new.tsx`
  2,357줄 · `app/(tabs)/records.tsx` 1,872줄로 라운드 59 판정(픽셀락 기준선 위험) 그대로다.
  이번 후보 중 그 파일들을 건드리는 것은 **`hitSlop` 숫자 네 개**(후보 6)뿐이라 분리가 선행
  조건이 아니다.
- **테스트 사각은 접근성 계약에 있다.** `src/a11y-contract.test.ts`는 57건인데 **터치 타깃을
  보는 단언이 0건**이라, 후보 6의 네 자리가 소스 계약 없이 태어났고 다음 칩도 같은 값으로
  태어난다. 커머스 쪽도 비슷하다 — `link-marker.test.ts`가 `primaryPurchaseLinkIndex`의 값
  계약은 촘촘히 고정하면서(`:524-540`) **그 판정이 화면의 전폭 CTA에도 쓰이는가**는 묻지
  않는다. 후보 1이 지나갈 수 있었던 이유가 정확히 그 빈칸이다.
- **api 테스트 하네스의 동시 실행 구멍은 라운드 61 A가 "이름만 붙였다"고 명시했고 이번에도
  닫히지 않았다 — 재제안 아님**(그 문서의 QA 수칙을 따를 것: 결과를 근거로 삼기 전에 같은 DB를
  쓰는 다른 실행이 없는지 먼저 확인한다).

## 트랙 구성 (파일 단위 상호 배타)

- **A 커머스 CTA·고지 (모바일)** (#1 · #5ⓐ · #6의 상세 크롬 2줄)
  - 소유: `app/items/[itemTemplateId].tsx` · `src/items/link-marker.ts` ·
    `src/ui.tsx`(`ProductComparisonRow` **한 컴포넌트만**) · 관련 `src/items/*.test.ts`
  - 금지: 링크 **정렬·랭킹** 무접촉(DNC-009 — 서버가 준 순서를 그대로 그린다) ·
    `app/(tabs)/items.tsx`(B 소유) · `apps/api/**`(D 소유 — #5ⓑ의 서버 한 줄은 D가 진다) ·
    `src/items/link-price.ts`(재사용만)
  - 계약: **스폰서는 순서와 무관하게 강조를 받지 않는다**(전부 스폰서면 전폭 CTA를 렌더하지
    않는다 — 죽은 버튼을 만들지 않는다), 고지 대상이 없으면 문구를 지어내지 않는다,
    **고지 없는 구매 링크를 앱 밖으로 내보내지 않는다**, ITEM-002 비세션 캡처 불변
    (`hitSlop`은 레이아웃이 아니다), 해요체(DNC-018)

- **B 준비템 목록의 비용** (#2) — **채택 판단 먼저**(승인 디자인 변경 요청 대상)
  - 소유: `app/(tabs)/items.tsx` · `src/preparation/PreparationListParity.tsx` ·
    `src/preparation/catalog-contract.ts` · `src/items/item-labels.ts`
  - 금지: `app/items/[itemTemplateId].tsx`(A) · **비세션 미리보기 분기 한 글자도**
    (`items.tsx:630-692` — ITEM-001 픽셀락) · 서버 0건
  - 계약: 가격대는 **서버 문자열 그대로**(합계·평균·추정 금지 — 범위라 특정 값을 지어내는
    셈이다), 값이 없으면 줄이 없다(폴백 문구를 목록에 반복하지 않는다), 정렬·추천 무접촉,
    채택하지 않기로 하면 **그 판단을 `catalog-contract.ts` 머리말에 근거와 함께 남긴다**

- **C 공유 문구 정직** (#3)
  - 소유: `src/reports/share-text.ts` · `app/(tabs)/reports.tsx` · 관련 `src/reports/*.test.ts`
  - 금지: `src/reports/pending-scope-notice.ts` · `src/home/cumulative-total.ts`(**재사용만** —
    스코프 규칙 불변) · `src/reports/milestone-share.ts`(마일스톤 창은 이번 범위 밖) ·
    `app/(tabs)/index.tsx`
  - 계약: **클라이언트 재집계 금지**(고지만 는다 — H절 그대로), 문장 조각은
    `pending-scope-notice` 단일 소스, 대기 0건이면 공유 문구가 **한 글자도** 다르지 않을 것,
    REP-001 비세션 미리보기 경로 무변경

- **D 어드민·서버 커머스 운영** (#4 · #5ⓑ · #7 · #8) — **A·B·C와 독립, 즉시 착수 가능**
  - 소유: `apps/api/src/onboarding/items-catalog.service.ts` ·
    `apps/api/src/admin/admin-auth.service.ts`·`admin-auth.controller.ts`(세션 DTO) ·
    `apps/api/src/admin/product-link-bulk.*` · `apps/admin/**` · 관련 `apps/api/test/*`
  - 금지: **모바일 0건** · **마이그레이션 신규 0건**(가격·`redirect_code`·복구 코드 배열 전부
    기존 컬럼이다) · 링크 정렬·랭킹 무접촉 · `apps/api/src/items-commerce/**`(라우트 무변경) ·
    **새 e2e는 shared 레인, `exclusive-suites.ts` 등재 금지**(라운드 61 A가 봉합한 락 프로토콜의
    비용, 그 파일 머리말)
  - 계약: 복구 코드는 **개수만**(값·해시 금지, 로그인 완료 세션에만), 가격은 **표시 전용**
    (DNC-009), 만료 문턱은 `LINK_PRICE_MAX_AGE_DAYS`를 **읽을 것**(숫자를 어드민에 다시 박지
    말 것 — 라운드 63 #9), `/r/:code`를 노출하면 **제휴 고지 문구를 같은 자리에서 함께 제공**
    (DNC-010), SEC-101의 "해제 → 즉시 재등록" 순서 불변

- **E 가져오기 승인 기록 (서버)** (#9)
  - 소유: `apps/api/src/onboarding/import-pipeline.service.ts` ·
    `apps/api/src/imports/imports.controller.ts` · `apps/api/prisma/schema.prisma`(**주석만**) ·
    관련 `apps/api/test/*` · `docs/store/data-safety-answers.md` · `docs/operations/*`
  - 금지: 모바일 0건 · **마이그레이션 신규 0건**(`approved_at`은 이미 있다) ·
    `import_jobs` 행 삭제 금지(`fk_expenses_import_job`) · 파기 잡 무변경 ·
    새 e2e는 shared 레인
  - 계약: 감사 봉투에 **파일명·행 원문 금지**(phase 11이 90일에 마스킹하는 값을 730일 창에
    복사하지 않는다), `approved_at`의 뜻을 스키마 주석에 **한 문장으로 확정**할 것

- **F 접근성 타깃 · 실기기 문서** (#6의 나머지 · #10) — **A·B·C 머지 후**
  - 소유: `app/expenses/new.tsx` · `app/expenses/[expenseId].tsx`(**`hitSlop` 값만**) ·
    `src/a11y-contract.test.ts` · `docs/qa/runtime-verification-required.md` ·
    `docs/qa/accessibility-offline-checklist.md`
  - 금지: **레이아웃 속성 변경 금지**(`minHeight`·`padding`·`gap` 무접촉 — 렌더가 바뀌면
    EXP-001·EXP-003 픽셀락 대조가 필요해진다) · 제품 로직 0건 · `app/items/**`(A가 이미 진다)
  - 계약: 히트 영역 확장은 **세로만**(`{top, bottom}` — 가로는 칩 간 gap 8과 겹친다),
    계약 테스트는 "(높이 + 2×세로 hitSlop) ≥ `theme.touchTarget`"을 소스에서 고정,
    체크표에는 이번 라운드 **자신의** 항목까지 한 번에 넣는다

- **머지 순서**: **D · E는 완전 독립**(서버·어드민, 모바일 0건이라 언제든). **A · B · C는
  모바일이지만 파일이 겹치지 않아 병렬 가능** — 단 **B는 채택 판단이 선행**이고, 채택하지
  않으면 그 판단만 남기고 트랙을 접는다. **F는 마지막**(A·B·C가 머지한 변경을 계약 테스트와
  체크표가 읽는다). #5는 ⓐ(A)·ⓑ(D)로 갈리지만 서로 의존하지 않는다 — 다만 통합 시점에
  **두 경로가 같은 문구를 말하는지** 한 번 대조할 것.
