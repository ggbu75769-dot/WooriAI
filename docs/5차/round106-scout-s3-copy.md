# 라운드 106 정찰 S3 — 한국어 문구·어투 감사 (DNC-018)

**읽은 시점: 2026-09-07 08:10–08:21 UTC (작업 트리 HEAD, 다른 에이전트 20개가 동시 편집 중).**
아래 인용은 전부 그 창 안에서 읽은 바이트다. 인용한 줄 번호는 그 시점의 것이고, 같은 파일을
다른 트랙이 건드렸다면 **문자열로 다시 찾아야 한다**(줄 번호가 아니라 문자열이 앵커다).

산출물은 이 파일 하나다. 소스는 한 바이트도 고치지 않았다(읽기 전용 정찰).

## 무엇을 쟀는가

`apps/mobile/app` · `apps/mobile/src`의 비테스트 `.ts`/`.tsx`에서 주석을 걷어내고 한글이 든
문자열 리터럴 **2,430건**을 뽑아(중복·대장(ledger) 문자열 포함) 일곱 축으로 훑었다. 서버 쪽은
`apps/api/src`가 던지는 오류 코드 **105개**를 뽑아 모바일 화이트리스트
(`apps/mobile/src/api/api-error.ts`)와 대조했다.

---

## 1. 요약 표

| # | 한 줄 | 심각도 | 크기 | 즉시 착수 |
| --- | --- | --- | --- | --- |
| 1 | 로그인 첫 화면: 다시 눌러도 영원히 실패하는 501·OAuth 다섯 코드가 전부 "네트워크 연결을 확인한 뒤 다시 시도해 주세요"로 접힌다 | **높음** | 작음(표 한 행 + 코드 목록) | 예 (픽셀락 무접촉) |
| 2 | CSV 내보내기: `["categories"]`가 아직 없으면 **모든 행의 분류가 "기타"** 로 적힌 파일이 나간다 | **높음** | 작음(게이트 한 줄) | 예 (게이트만 — 새 문구는 SET-001 접촉) |
| 3 | 같은 물건을 준비템 / 준비물 / 준비 목록 **세 이름**으로 부른다(한 카드 안에서도) | 중간 | 중간(문구 20여 곳) | 예 (전부 세션 갈래 — 캡처 무접촉) |
| 4 | 초대 랜딩 페이지(서버 렌더 HTML)만 명령형·붙여쓰기·개발 용어로 앱 톤 계약 밖에 있다 | 중간 | 작음(3줄) | 예 |
| 5 | 기록 탭 분류 칩 폴백이 **모르는 분류를 "기타"라고 단정**한다 | 낮음-중간 | 작음 | 예 |
| 6 | 알림 두 곳만 "확인해볼까요?"(붙여쓰기) — 나머지 열넷은 "확인해 보세요/볼까요" | 낮음 | 아주 작음 | 예 |
| 7 | 준비템 상세의 메모 낭독 라벨이 "품목 메모" — 눈에 보이는 카드는 "내 메모" | 낮음 | 아주 작음 | 예 (낭독 라벨 — 픽셀 무접촉) |
| 8 | CSV 공유 토스트가 "행 상한에 닿아"라는 개발 용어로 원인을 말한다 | 낮음 | 아주 작음 | 예 |
| 9 | 초대 만료 문구가 앱과 랜딩 페이지에서 미세하게 갈린다("사용했거나" / "사용되었거나") | 낮음 | 아주 작음 | 예 |

⚠️ **픽셀락 재캡처가 필요해 지금 불가능한 항목: 없다.** 픽셀락 라우트는 아홉이고
(`apps/mobile/app/pixel-lock.tsx:12-22` — SPL-001 · HOME-001 · EXP-001 · ITEM-001 · ITEM-002 ·
REP-001 · FAM-001 · IMP-003 · SET-001), 위 아홉 발견의 문구는 **전부 세션 갈래이거나 낭독
라벨이거나 서버 HTML**이라 비세션 캡처 경로에 서지 않는다(근거는 각 항목의 "픽셀락" 줄).
⚠️ 다만 **#2의 고침이 "분류 이름을 아직 못 불러왔어요" 같은 새 줄을 더보기 화면에 세우면**
그때는 SET-001 캡처가 바뀌므로 재캡처가 필요하다 — 그래서 제안은 **문구 추가 없이 버튼을
잠그는 쪽**으로 적었다.

---

## 2. 발견

### #1 — 다시 눌러도 안 되는 로그인 실패에 "네트워크를 확인하고 다시 시도"를 권한다 (축 3)

**오늘의 문장 (정확히 인용):**

> `"로그인 중 문제가 발생했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요."`

**왜 문제인가.** 이 한 문장이 **여섯 가지 서로 다른 실패**를 받는다. 그중 둘은 다시 눌러도
영원히 성공하지 않고, 다섯은 네트워크와 아무 상관이 없다.

- 카카오 키 없이 만든 스토어 빌드에서 "카카오로 시작하기"를 누르면 경로는
  `oauthLogin("kakao")`이고, 프로덕션 서버는 그것을 **501로 fail-closed** 한다:
  `throw new NotImplementedException({ code: "OAUTH_LOGIN_NOT_IMPLEMENTED", message: "OAuth provider token verification is not implemented yet; oauth-login is disabled outside development/test." })`
  (`apps/api/src/auth/auth.service.ts:26-32`). 이 사람은 **앱을 영영 쓸 수 없는데**, 화면은
  자기 와이파이를 의심하며 몇 번이고 다시 누른다.
- `OAUTH_REDIRECT_URI_NOT_ALLOWED`(400, `"허용되지 않은 redirect 주소예요."`)도 같은 갈래다 —
  배포 설정이 어긋난 것이라 사용자가 무엇을 해도 풀리지 않는다.
- `OAUTH_TRANSACTION_INVALID` · `OAUTH_NONCE_MISMATCH`는 **서버가 이미 옳은 다음 행동을 적어
  두었다**: `"인증 절차를 다시 시작해주세요."` 그런데 그 문장은 화이트리스트에 없어 버려지고,
  대신 네트워크를 탓하는 문장이 뜬다.

⚠️ **이 결함은 라운드 45가 이미 같은 화면에서 한 번 고친 결함이다.** 그때 `USER_WITHDRAWN` ·
`USER_BLOCKED` 둘을 `accountStatusErrorMessage`로 건져냈고, 그 커밋의 주석이 지금 이 자리에
그대로 남아 진단을 적고 있다: *"네트워크는 멀쩡했고, 몇 번을 다시 눌러도 결과는 같다"*
(`apps/mobile/app/(auth)/login.tsx:260-263`). **OAuth 쪽 여섯은 그 구조에 아직 합류하지
않았다.**

**근거 파일:줄** (2026-09-07 08:14 UTC 읽음)

- `apps/mobile/src/auth/login-copy.ts:93` — `LOGIN_FAILED_MESSAGE` 정의
- `apps/mobile/src/auth/login-copy.ts:109-117` — `developerBuild && !kakaoConfigured`가 아니면
  **무조건** 이 문장 하나(즉 실사용자 빌드는 모든 실패에서 이 문장)
- `apps/mobile/app/(auth)/login.tsx:264-268` — `accountStatusErrorMessage` 갈래(둘만 건짐)
- `apps/mobile/app/(auth)/login.tsx:277-281` — 나머지 전량이 `loginFailureMessage`로 떨어진다
- `apps/api/src/auth/auth.service.ts:26-32` — 501 `OAUTH_LOGIN_NOT_IMPLEMENTED`
- `apps/api/src/auth/kakao/kakao-auth.service.ts:23-27` — `"인증 절차를 다시 시작해주세요."`
- `apps/api/src/auth/kakao/kakao-auth.service.ts:62-67`, `:117-122` —
  `"허용되지 않은 redirect 주소예요."`
- `apps/mobile/src/api/api-error.ts:185-464` — 표에 `OAUTH_*`가 **한 행도 없다**

**제안 문장(해요체·관찰형).** 서버 원문을 그대로 내보내지 않는다는 이 저장소의 규율
(`api-error.ts:19-31`)을 그대로 지키면서, 표에 세 행을 더한다.

- `OAUTH_LOGIN_NOT_IMPLEMENTED` · `OAUTH_REDIRECT_URI_NOT_ALLOWED`(다시 눌러도 안 되는 갈래) →
  **"지금은 카카오 로그인을 쓸 수 없어요. 앱을 최신 버전으로 업데이트한 뒤에도 같으면 잠시
  기다려 주세요."**
  (재시도를 권하지 않는다 — `USER_WITHDRAWN` 행이 세운 형식 그대로.)
- `OAUTH_TRANSACTION_INVALID` · `OAUTH_NONCE_MISMATCH`(처음부터 다시 하면 풀리는 갈래) →
  **"로그인 절차가 만료됐어요. 카카오 로그인을 처음부터 다시 해 주세요."**
  (네트워크를 말하지 않는다 — 연결은 이 실패의 원인도 해법도 아니다.)
- `OAUTH_CODE_EXCHANGE_FAILED` · `OAUTH_ID_TOKEN_INVALID`(진짜 일시 실패) → 종전 문장 유지.

**픽셀락.** AUTH 화면은 픽셀락 아홉에 없다(`app/pixel-lock.tsx:12-22`). **재캡처 불필요.**

---

### #2 — 분류 이름이 도착하기 전에 CSV를 만들면, 모든 행이 "기타"로 적힌 파일이 나간다 (축 6)

**오늘의 문장 (정확히 인용):** 파일 안의 값이다 —

> `날짜,구분,카테고리,항목,판매처,결제수단,금액(원),메모,출처` (헤더:
> `apps/mobile/src/export/expense-csv.ts:69`)

그리고 그 "카테고리" 열의 모든 칸에 들어갈 수 있는 값:

> `"기타"`

**왜 문제인가.** `canExport`는 분류 목록이 도착했는지를 **묻지 않는다**:

```
const canExport = Boolean(authToken && childId);          // ExpenseCsvExport.tsx:148
…
categoryName: buildCategoryNameLookup(categories.data?.categories)   // :344
```

`categories.data`가 아직 `undefined`면 `buildCategoryNameLookup`은 빈 맵을 만들고
`categoryNameFor`로 떨어지는데(`categories.ts:130`), 그 함수의 마지막 줄은
`return "기타";`(`categories.ts:90`)다. 서버가 시드하는 정식 분류는 **DB마다 랜덤 UUID**라
정적 8타일 매핑에 하나도 없다 — 즉 **전 행이 "기타"** 가 된다. 이 사실은 그 함수 자신의
주석이 이미 적어 두었다: *"on a real session every canonical category … collapsed to '기타'
in the report donut legend and in the CSV export"*(`categories.ts:106-112`).

⚠️ **이것이 라운드 105가 홈에서 막은 바로 그 갈래다.** 그 라운드의 판정은 명시적이다 —
*"그 순간 폴백을 태우면 세 줄이 전부 '기타'라고 말하고, 그것은 사용자가 적은 적 없는 분류명을
화면이 단언하는 **허위 표시**다. 그래서 모르면 null을 돌려주고 … '모르면 말하지 않는다'"*
(`apps/mobile/src/home/recent-expense-category.ts:13-21`).
그리고 **리포트 탭은 이미 그 게이트를 걸어 두었다**:
`segments: categories.isSuccess && activeCategory.isSuccess ? categorySegments : undefined`
(`app/(tabs)/reports.tsx:1110`). 내보내기만 게이트가 없다.

**화면보다 나쁜 이유가 하나 더 있다.** 화면의 오표시는 다음 렌더에서 스스로 고쳐지지만,
**CSV는 파일이다.** 사용자가 자기 가계부·엑셀로 가져가 그대로 쓰고, 앱은 그것을 되돌릴 수
없다. 첫 설치 직후 로그인하자마자 내보내는 사람, 오프라인에서 캐시 없이 여는 사람이 정확히
그 창에 선다(그 창은 코드 주석도 인정한다 — *"없으면(첫 진입 직후·오프라인) 기존 정적 매핑으로
폴백한다"*, `ExpenseCsvExport.tsx:150-154`).

**근거 파일:줄** (2026-09-07 08:17 UTC 읽음)

- `apps/mobile/src/export/ExpenseCsvExport.tsx:148` — `canExport`에 분류 조건 없음
- `apps/mobile/src/export/ExpenseCsvExport.tsx:155-161` — `["categories"]` 조회
- `apps/mobile/src/export/ExpenseCsvExport.tsx:344` — 폴백이 그대로 실린다
- `apps/mobile/src/categories.ts:122-131` — `buildCategoryNameLookup`의 폴백 한 줄
- `apps/mobile/src/categories.ts:82-91` — `categoryNameFor`의 `return "기타";`
- `apps/mobile/app/(tabs)/reports.tsx:1110` — **같은 위험을 이미 막은 자리(선례)**
- `apps/mobile/src/home/recent-expense-category.ts:13-21` — 라운드 105의 판정문

**제안(문구가 아니라 게이트).** 새 문장을 만들지 않는 쪽을 권한다 — SET-001 캡처 접촉을 피하기
위해서다.

- `canExport`에 `categories.isSuccess`를 더해 **분류 목록이 도착하기 전에는 버튼이 눌리지
  않게** 한다. 이미 있는 `busy` 비활성 상태를 그대로 재사용하면 새 문구가 0건이다.
- 그래도 한 줄을 세워야 한다면 문장은 **"분류 이름을 아직 불러오지 못했어요. 잠시 뒤에 다시
  내보내 주세요."**(⚠️ 이 줄을 더보기 화면에 세우면 SET-001 캡처가 바뀐다 — 그때는
  실기기 재캡처가 필요하고 **지금은 불가능하다**.)

**픽셀락.** 게이트만 거는 안은 **무접촉**(노드가 늘지 않는다). 새 문구를 세우는 안은 SET-001
접촉 — **지금 불가능**.

---

### #3 — 같은 물건을 준비템 · 준비물 · 준비 목록 세 이름으로 부른다 (축 5)

**오늘의 문장 (정확히 인용).** 홈의 **첫 실행 안내 카드 한 장**이 세 줄로 세 낱말을 쓴다:

> 제목: `` `지금 시기 준비물 ${count}개를 골라뒀어요` ``
> 부제: `"준비템 탭에서 확인하고 준비한 것만 체크해 보세요."`
> 버튼: `"준비물 확인하기"`

같은 홈 화면의 **바로 옆 카드**는 같은 것을 다르게 부른다:

> `"지금 시기 준비템을 골라뒀어요"` (`src/home/prep-nudge.ts:83`)

그리고 준비템 탭 안에서는 성공 토스트가 **세 번째 이름**을 쓴다:

> `` `『${name}』${objectParticle(name)} 준비 목록에 추가했어요.` ``

**왜 문제인가.** 하단 탭 라벨은 `"준비템"`이고(DNC-003이 잠근 네 탭 중 하나 —
`app/(tabs)/_layout.tsx:17`), 목적지도 `/(tabs)/items` 하나다. 그런데 **거기로 보내는 문장이
목적지를 다른 이름으로 부른다.** 처음 앱을 켠 사람은 "준비물 확인하기"를 눌러 "준비템"이라고
적힌 탭에 도착하고, 그 안에서 "준비 목록에 추가했어요"라는 토스트를 받는다. 세 낱말 사이의
관계를 아는 사람은 이 코드를 쓴 사람뿐이다.

온보딩에서는 **한 화면 안에서 두 낱말이 서로를 가리킨다**:
`subtitle="체크한 항목은 준비물 목록에서 완료로 표시할게요."`(`prepared-items.tsx:154`)와
`"…준비템 탭에서 다시 체크할 수 있어요."`(`prepared-items-selection.ts:83`)가 같은 곳을 말한다.

**근거 파일:줄** (2026-09-07 08:15–08:19 UTC 읽음)

*"준비물"이 서는 자리 (사용자에게 보이는 것만)*

- `apps/mobile/src/home/first-run-guide.ts:217` · `:223` — 홈 첫 실행 카드 제목·버튼
- `apps/mobile/src/items/custom-item-form.ts:121` — `"준비물 직접 추가하기"`(준비템 탭 버튼)
- `apps/mobile/src/items/custom-item-form.ts:126` — `"직접 추가한 준비물"`(타일 발밑 표식)
- `apps/mobile/src/items/custom-item-form.ts:146-147` — 시트 제목 `"준비물 직접 추가"` ·
  `"준비물 수정"` · 라벨 `"준비물 이름"`
- `apps/mobile/src/items/custom-item-form.ts:158` — 낭독 `"직접 추가할 준비물 저장"`
- `apps/mobile/src/items/custom-item-form.ts:202` — 삭제 확인 `"직접 추가한 준비물을 지울까요?"`
- `apps/mobile/src/items/custom-item-form.ts:208` · `:213` — 상한·404 문장
- `apps/mobile/src/items/next-stage-preview.ts:198` · `:299-300` — 다음 시기 미리보기 두 줄
- `apps/mobile/app/(tabs)/items.tsx:1287` — 낭독 `` `${nextStageBand} 준비물 미리보기` ``
- `apps/mobile/src/notifications/stage-preview-d7.ts:162` — 알림 본문
- `apps/mobile/app/(onboarding)/prepared-items.tsx:152` · `:154` · `:222` · `:224` · `:263`
- `apps/mobile/app/(onboarding)/resume.tsx:135-136`
- `apps/mobile/src/onboarding/local-progress.ts:253`

*같은 것을 "준비템"이라 부르는 자리*

- `apps/mobile/app/(tabs)/_layout.tsx:17` — 탭 라벨(DNC-003)
- `apps/mobile/app/(tabs)/items.tsx:1345` · `:1358` — 빈 상태 두 줄
- `apps/mobile/src/home/prep-nudge.ts:80` · `:82-83` — 홈 넛지 카드
- `apps/mobile/src/api/api-error.ts:333` · `:385` · `:387` · `:412` — 오류 문장 넷
- `apps/mobile/src/items/item-filters.ts:146` · `:149`

*세 번째 이름*

- `apps/mobile/src/items/custom-item-form.ts:163` — `"준비 목록에 추가했어요."`
- `apps/mobile/src/items/prep-milestones.ts:161` — `"지금 시기 준비, 모두 마쳤어요"`

**⚠️ 이 갈림은 우연이 아니라 문서가 고정한 값이다.** `docs/5차/round100-custom-items-design.md`
§9.6이 `"준비물 직접 추가하기"`와 `"직접 추가한 준비물"`을 **확정값**으로 적었고(그 문서 195·
440줄), 서버 오류 문장 셋도 같은 낱말로 계약에 들어갔다(그 문서 388-390줄). 그래서 이 발견의
제안은 "고쳐라"가 아니라 **"어느 낱말이 계약인지를 한 번 정하고, 정한 쪽으로 문서와 코드가 함께
움직여라"** 다.

**제안 문장(해요체·관찰형).** 탭 라벨이 DNC-003으로 잠겨 있으므로 **"준비템"이 계약**이다.
바꿀 자리와 문장:

- `"지금 시기 준비물 3개를 골라뒀어요"` → **"지금 시기 준비템 3개를 골라뒀어요"**
- `"준비물 확인하기"` → **"준비템 확인하기"** (바로 옆 넛지 카드의
  `"준비템 탭에서 확인하기"`와 같은 결)
- `"준비물 직접 추가하기"` → **"준비템 직접 추가하기"**
- `"직접 추가한 준비물"` → **"직접 추가한 준비템"**
- `"체크한 항목은 준비물 목록에서 완료로 표시할게요."` →
  **"체크한 항목은 준비템 탭에서 완료로 표시할게요."**(같은 화면의 다른 줄이 이미 쓰는 말)
- `"『기저귀』를 준비 목록에 추가했어요."` → **"『기저귀』를 준비템 목록에 추가했어요."**
- 온보딩 머리말 `"출산 준비물"`은 **그대로 둔다** — 그 자리는 탭이 아니라 *출산 준비*라는 일반
  개념을 부르는 곳이고, 억지로 바꾸면 임신 중인 사람에게 낯선 조어가 된다(이건 관찰이지 규칙이
  아니다 — 판단이 갈리면 그대로 두는 쪽이 안전하다).

**픽셀락.** 위 자리는 **전부 세션 갈래**라 캡처 무접촉이다. 근거를 값으로 적는다:

- 홈 첫 실행 카드: `evaluateHomeFirstRunGuide`가 `if (!input.hasSession) return null;`
  (`src/home/first-run-guide.ts:233`) — HOME-001 캡처는 비세션이다.
- 준비템 탭 커스텀 품목: `app/(tabs)/items.tsx:522`의 `hasSession` 게이트 아래에만 서고,
  비세션 갈래는 `:658`의 `if (!hasSession) return visibleItems;`에서 미리보기 픽스처로 끝난다
  (라운드 100 설계 문서 195줄이 *"비세션 프리뷰는 `if (!hasSession)`에서 먼저 반환하므로 캡처
  무접촉이 구조로 보장된다"* 고 같은 말을 적어 두었다).
- 온보딩: 픽셀락 라우트 아홉에 온보딩이 **없다**(`app/pixel-lock.tsx:12-22`).

**재캡처 불필요.**

---

### #4 — 초대 랜딩 페이지만 앱의 톤 계약 밖에 있다 (축 1·7 + 해요체)

**오늘의 문장 (정확히 인용):**

> `<p>우리아이 앱에서 초대를 수락하세요.</p>`
> `<p class="hint">버튼이 동작하지 않는다면 우리아이 앱이 설치되어 있는지 확인해주세요. 앱 설치 후 이 링크를 다시 열면 초대를 수락할 수 있어요.</p>`
> `<p class="hint">가족에게 새 초대 링크를 요청해주세요.</p>`

**왜 문제인가.** 이 세 줄은 **아직 앱을 깔지 않은 사람이 브라우저에서 보는 첫 우리아이**다 —
초대를 받은 배우자·조부모, 즉 이 앱의 핵심 사용자 그 자체다. 그런데 앱의 톤 계약과 세 군데에서
갈린다:

1. **명령형** — `"초대를 수락하세요."`. 앱 문자열 2,430건에는 이런 맨 명령형이 없다. 앱은
   `"~해 주세요"`(136건) · `"~해 보세요"` · `"~해 볼까요?"`로만 권한다.
2. **붙여쓰기** — `"확인해주세요"` · `"요청해주세요"`. 앱은 **136건 전부 `"해 주세요"`(띄어쓰기)**
   이고 `"해주세요"`는 **0건**이다. 같은 사람이 브라우저 → 앱으로 넘어오면 같은 회사가 두 가지
   맞춤법을 쓰는 것을 본다.
3. **개발 용어** — `"버튼이 동작하지 않는다면"`. "동작"은 사람이 버튼을 두고 쓰는 말이 아니다.

**근거 파일:줄** (2026-09-07 08:20 UTC 읽음)

- `apps/api/src/households/invite-landing.controller.ts:111-115` — 정상 초대 페이지
- `apps/api/src/households/invite-landing.controller.ts:119-121` — 만료 페이지
- 대조 자료: 앱 문자열 2,430건 중 `해 주세요` **136** / `해주세요` **0** /
  `습니다`·`입니다`·`십시오` **각 0**

**제안 문장(해요체·관찰형).**

- `"우리아이 앱에서 초대를 수락하세요."` → **"우리아이 앱에서 초대를 수락할 수 있어요."**
  (사실 서술로 내리면 명령형이 사라지고, 바로 아래 CTA 버튼이 행동을 맡는다.)
- `"버튼이 동작하지 않는다면 … 설치되어 있는지 확인해주세요."` →
  **"버튼이 눌리지 않으면 우리아이 앱이 깔려 있는지 확인해 주세요."**
- `"가족에게 새 초대 링크를 요청해주세요."` → **"가족에게 새 초대 링크를 요청해 주세요."**
  (띄어쓰기 한 칸)

⚠️ **짝을 함께 봐야 한다.** 앱의 만료 카드 세 줄은 이 페이지와 *같은 사실을 같은 순서로* 말하는
것이 계약이고, 그 대조를 `apps/mobile/src/family/invite-accept-messages.test.ts`가 **두 파일의
소스를 함께 읽어** 고정한다(`invite-accept-messages.ts:29-40`). 랜딩만 고치면 그 테스트가
무엇을 말하는지 확인해야 한다.

**픽셀락.** 서버 렌더 HTML — 픽셀락 라우트 아홉과 무관. **재캡처 불필요.**

---

### #5 — 분류 칩 폴백이 "모른다"를 "기타"라고 단정한다 (축 6)

**오늘의 문장 (정확히 인용):**

> ```
> const fallbackName = categoryNameFor(selectedCategoryId);
> chips.unshift({ id: selectedCategoryId, label: fallbackName, plainLabel: fallbackName, … });
> ```
> 그 결과 칩에 적히는 값: `"기타"`

**왜 문제인가.** 이 자리는 "선택된 분류가 서버 목록에 없다"는 창이다. 즉 **앱이 그 분류의
이름을 모르는** 상태인데, 화면은 모른다고 말하는 대신 **실재하는 다른 분류의 이름**("기타"는
카탈로그의 여덟 번째 실제 분류다 — `categories.ts:74`)을 적는다. 사용자는 자기가 고르지 않은
분류로 목록이 걸린 것처럼 읽는다.

같은 화면이 바로 옆에서는 정반대 규율을 지키고 있어서 대비가 선명하다:
*"못 찾은 경우에도 이름을 지어내지 않도록 `categoryFiltered`를 따로 넘긴다"*
(`app/(tabs)/records.tsx:1782-1784`). 스코프 문장은 지어내지 않는데 **칩 라벨은 지어낸다.**

**얼마나 좁은 창인가(정직하게).** `selectableCategories`가 선택된 분류를 `isCurrent`로
언제나 살려 두므로(`src/categories.ts:356`, `:378-383`), 이 폴백은 그 id가 응답에 **아예 없을
때만** 선다 — 예를 들어 리포트 범례에서 드릴다운으로 들어온 뒤 다른 가구 아이로 전환해
`["categories"]`가 다시 채워진 경우다. **드물다. 그래도 지어낸 값이다.**

**근거 파일:줄** (2026-09-07 08:18 UTC 읽음)

- `apps/mobile/src/expenses/records-list-view.ts:143-150` — 폴백 칩 삽입
- `apps/mobile/src/categories.ts:82-91` — `return "기타";`
- `apps/mobile/app/(tabs)/records.tsx:1782-1791` — 같은 화면의 "지어내지 않는다" 규율

**제안.** 문구가 아니라 값을 바꾸는 쪽이 맞다 — 라운드 105가 홈에서 고른 답과 같다.
`categoryNameFor` 대신 **이름을 모를 때 세울 중립 라벨**을 쓴다:

- 칩 라벨 → **"선택한 분류"**
  (그 칩이 하는 일 — 지금 걸린 필터 — 만 말하고, 어느 분류인지는 **말하지 않는다**.)
- 또는 이 창에서는 칩을 세우지 않고 `categoryFiltered`만 참으로 두어, 스코프 줄이 이미 쓰는
  "이름 없는 필터" 갈래로 떨어뜨린다.

**픽셀락.** 기록 탭은 픽셀락 아홉에 없다. **재캡처 불필요.**

---

### #6 — 알림 두 곳만 "확인해볼까요?" (축 5, 표기 갈림)

**오늘의 문장 (정확히 인용):**

> `"기록 탭에서 지난 며칠을 함께 확인해볼까요?"` (기록 리마인더)
> `` `리포트 탭에서 ${month}월을 함께 확인해볼까요?` `` (지난달 정리)

**왜 문제인가.** 같은 알림 생성기 안의 이웃 문장들은 전부 띄어 쓴다 —
`"이번 달 지출을 확인해 볼까요?"`(`generators.ts:140`) · `"남은 예산을 확인해 보세요."`(`:151`) ·
`"새 준비템을 확인해 보세요."`(`:178`) · `"구매하셨다면 지출로 기록해 보세요."`(`:218`) ·
`"『다온이』 지출 내역을 확인해 보세요."`(`:328`). 앱 전체로도 `"해 보세요/볼까요"`가 열넷,
붙여 쓴 것은 이 **둘뿐**이다. 알림함에서 두 줄이 나란히 뜨면 한 눈에 보인다.

**근거 파일:줄** (2026-09-07 08:19 UTC 읽음)

- `apps/mobile/src/notifications/generators.ts:630`
- `apps/mobile/src/notifications/generators.ts:762`
- 대조군: 같은 파일 `:140` · `:151` · `:178` · `:218` · `:328`

**제안 문장.** **"기록 탭에서 지난 며칠을 함께 확인해 볼까요?"** ·
**"리포트 탭에서 5월을 함께 확인해 볼까요?"** (띄어쓰기 한 칸씩.)

**픽셀락.** 알림 본문 — 캡처 라우트 아님. **재캡처 불필요.**

---

### #7 — 준비템 상세의 메모 낭독 라벨만 "품목"이라고 부른다 (축 5)

**오늘의 문장 (정확히 인용):**

> `export const ITEM_MEMO_CARD_TITLE = "내 메모";`
> `export const ITEM_MEMO_INPUT_LABEL = "품목 메모 입력 (선택)";`

**왜 문제인가.** 눈으로 보는 사람은 `"내 메모"`라고 적힌 카드 안의 입력칸을 누르지만, **소리로
듣는 사람은 `"품목 메모 입력"`을 듣는다.** 그 화면 어디에도 "품목"이라는 낱말이 없다 — 이
화면은 "준비템" 상세이고, 이 저장소에서 "품목"은 **지출 입력의 항목명**을 부르는 말이다
(`app/expenses/new.tsx:2174`의 `"품목명 (예: 기저귀)"` 등 스물 남짓). 즉 낭독만 다른 화면의
어휘를 데려온다.

**근거 파일:줄** (2026-09-07 08:19 UTC 읽음)

- `apps/mobile/src/items/item-memo.ts:29` — 보이는 카드 제목
- `apps/mobile/src/items/item-memo.ts:38` — 낭독 라벨
- `apps/mobile/app/items/[itemTemplateId].tsx:53-62` — 둘 다 이 화면이 쓴다

**제안 문장.** **`"내 메모 입력 (선택)"`** — 보이는 제목과 같은 말로 맞춘다(선택 표기 관례는
그대로 둔다).

**픽셀락.** ITEM-002는 캡처 라우트지만 이 값은 `accessibilityLabel`이라 **픽셀에 한 점도 닿지
않는다**(그리는 노드가 아니다). **재캡처 불필요.**

---

### #8 — CSV 공유 토스트가 "행 상한에 닿아"로 원인을 말한다 (축 7)

**오늘의 문장 (정확히 인용):**

> `"행 상한에 닿아 오래된 기록이 빠졌을 수 있어요"`

**왜 문제인가.** 이 토스트는 방금 CSV를 공유한 사람이 본다. "행 상한"은 코드 상수
(`EXPORT_MAX_ROWS`)의 이름이지 사람의 말이 아니다. 문장의 **사실 부분**("오래된 기록이 빠졌을
수 있어요")은 정확하고 단정도 피했다 — 문제는 원인을 부르는 낱말 하나뿐이다. 나란히 붙는
다른 문장은 이미 사람의 말을 쓴다: `"용량 제한으로 최근 기록부터 빠졌어요"`(`:163`).

**근거 파일:줄** (2026-09-07 08:20 UTC 읽음)

- `apps/mobile/src/export/share-payload.ts:160`
- 대조: 같은 함수 `:163`

**제안 문장.** **"한 번에 담을 수 있는 양을 넘어 오래된 기록이 빠졌을 수 있어요"**
(⚠️ `"빠졌을 수 있어요"`의 **비단정형은 그대로 둔다** — 그 조심스러움에는 근거가 있다
(`share-payload.ts:139-148`), 지금 고치는 것은 원인을 부르는 낱말뿐이다.)

**픽셀락.** 토스트 — 캡처 무접촉. **재캡처 불필요.**

---

### #9 — 초대 만료 문구가 두 표면에서 미세하게 갈린다 (축 5)

**오늘의 문장 (정확히 인용):**

> 앱: `"이미 사용했거나 기간이 지난 초대 링크일 수 있어요."`
> 랜딩: `<p>이미 사용되었거나 기간이 지난 초대 링크일 수 있어요.</p>`

**왜 문제인가.** 두 표면이 *같은 사실을 같은 순서로* 말하기로 한 계약인데
(`invite-accept-messages.ts:29-40`), 그 한 줄만 능동("사용했거나")과 피동("사용되었거나")으로
갈린다. 문서화된 의도적 차이는 하나뿐이다 — 랜딩의 `"가족에게"`를 앱에서 `"가족 관리자에게"`로
좁힌 것(그 주석 `:38-40`). **이 갈림은 문서에 없다.**

덧붙여, 앱 문자열 2,430건에서 `"되었"`을 쓰는 것은 **딱 한 줄**이다(`"초대가 만료되었거나 유효하지
않아요."`, `invite-accept-messages.ts:69`) — 나머지는 전부 `"됐"` 형이다. 이것도 랜딩 h1과의
바이트 짝 때문이라 **혼자 고치면 계약이 깨진다.**

**근거 파일:줄** (2026-09-07 08:20-08:21 UTC 읽음)

- `apps/mobile/src/family/invite-accept-messages.ts:69` · `:76` · `:83`
- `apps/api/src/households/invite-landing.controller.ts:119-121`
- 대조: 앱 문자열 중 `되었` **1건** · `유효` **1건**(둘 다 이 파일)

**제안.** #4와 **한 커밋으로 함께** 움직인다. 랜딩을 앱 쪽 표현으로 맞추는 방향을 권한다
(더 짧고 능동이다):

- 랜딩 `"이미 사용되었거나 기간이 지난…"` → **"이미 사용했거나 기간이 지난 초대 링크일 수
  있어요."**
- 두 표면의 h1 `"초대가 만료되었거나 유효하지 않아요"` → **"이 초대는 더 이상 쓸 수 없어요"**
  (`"유효"`라는 한자어를 없애고, 존재 여부를 흘리지 않는 성질은 그대로다 —
  `invite-accept-messages.ts:18-27`의 "오라클을 만들지 않는다" 규율을 깨지 않는다.)

**픽셀락.** FAM-001은 캡처 라우트지만 이 카드는 **초대 수락 화면(`app/family/accept/[token].tsx`)**
이고 FAM-001이 가리키는 `/family`가 아니다(`app/pixel-lock.tsx:19`). **재캡처 불필요.**

---

## 3. 이미 좋은 것 — 값으로 적는다

정찰이 "문제 없음"을 침묵으로 남기면 다음 사람이 같은 자리를 다시 판다. 그래서 **재어 본 값을
그대로 적는다.**

1. **해요체는 흔들림이 없다.** 사용자 문자열 2,430건에서 `습니다` **0** · `입니다` **0** ·
   `십시오` **0**. 명령형(`~하세요.`)도 앱 안에는 없다 — 유일한 예외가 서버 렌더 랜딩 페이지이고,
   그것이 위 #4다.

2. **재촉·불안 유발 어휘가 실측 0건이다.** `서두르|늦었|아직도|빨리` 바늘로 앱 문자열 전량을
   훑어 **0건**. 그리고 그것은 우연이 아니라 규칙으로 적혀 있다 —
   *"톤은 해요체·사실 서술(DNC-018). 재촉('아직도 안 보셨어요')·평가는 넣지 않는다."*
   (`src/home/prep-nudge.ts:65`).

3. **부정적 평가를 붙였던 자리를 스스로 걷어낸 이력이 있다.** 예산 초과 달의 보조 문구에서
   `😥`를 뺀 판단이 근거와 함께 남아 있다 — *"예산을 넘긴 것은 대개 아이에게 필요한 것을 산
   결과인데, 그 옆에 우는 얼굴을 붙이면 앱이 사용자의 한 달을 **평가**하는 문장이 된다"*
   (`src/home/budget-progress.ts:246-251`). 축하 쪽(`👏`)은 남기고 평가 쪽만 뺀 것도 값이다.

4. **축하가 사실을 앞지르지 않는다.** 준비율 배지는 반올림이 아니라 **개수**로 완료를
   판정하고(`src/items/prep-milestones.ts:69-73`, `:161`), 구간 문구는 **수 중립**이라 어느
   분수에서도 참이다(`"좋은 출발이에요!"` · `"절반까지 왔어요!"` — `:75-92`, 예전
   `"벌써 4분의 1을 채웠어요"`가 3/8에서 거짓이던 것을 고친 자리다).

5. **조사(축 4)는 이 저장소가 가장 잘 지켜 둔 축이다.** 사용자가 지은 이름 뒤의 조사가
   리터럴로 박힌 자리를 독립적으로 다시 훑었는데 **0건**이다.
   - 이름을 끼우는 문장은 전부 `src/text/korean-particles.ts`를 지난다
     (`custom-item-form.ts:163`·`:168`·`:202`, `notifications/generators.ts:177`,
     `stage-preview-d7.ts:154-155`, `children/child-switch.ts` 등).
   - `『…』` 뒤에 조사가 오는 자리 열넷을 전수로 봤다 — 조사가 붙는 곳은 **전부 값에서 고르고**,
     나머지는 조사를 아예 쓰지 않는다.
   - 가구 이름은 **조사를 피하게 설계**돼 있다: 구(句)가 언제나 `"가구"`로 끝나도록 만들어
     `를`·`로`·`에`가 어느 이름에도 맞는다(`src/family/household-scope.ts:230-242` —
     *"'이/가'·'와/과'를 붙이면 '콩가 있는 가구' 같은 문장이 나온다"*).
   - `${…}` 뒤에 조사가 고정으로 붙은 자리 스물셋을 전부 열어 봤는데 앞말이 **전부 고정
     꼬리**였다(`…원` · `…기록` · `…요청` · `…삭제` · `…지우기`) — 받침이 갈릴 수 없다.
   - 그리고 이 전부를 `src/korean-particle-guard.test.ts`(1,900줄 넘는 스윕)가 **소스에서**
     지키고, 못 보는 자리를 "사각"으로 값과 하한까지 적어 둔다.

6. **서버 원문이 화면으로 새는 길이 구조적으로 막혀 있다.** `api-error.ts`는 아는 코드만 자기
   표의 한국어를 쓰고 모르는 코드는 호출부 폴백으로 떨어뜨린다(`:19-31`). 덕분에 서버의 영어
   문장(`"Import job is not ready to confirm."` · `"Import files can include up to 2,000 rows."`)과
   개발 문장(`"허용되지 않은 redirect 주소예요."`)이 **한 건도** 사용자 화면에 닿지 않는다.
   ⚠️ 다만 그 방패가 **옳은 문장까지 함께 버리는** 자리가 #1이다.

7. **"다시 시도"를 권할 자리와 아닐 자리가 이미 갈려 있다.** 확인한 것만 적는다 —
   탈퇴 계정(`api-error.ts:432`) · 초대 만료(`invite-accept-messages.ts:83`) · 권한 없는 참여자
   (`children/household-join.ts:126`) · 4xx로 파킹된 아웃박스 행
   (`offline/permission-denied.ts:243`) · 끝난 가져오기 미리보기
   (`import/import-failure-messages.ts:152`)가 전부 **재시도를 권하지 않고 다음 행동을 말한다.**
   준비템 상태 변경은 한발 더 나아가, 큐에 들어간 뒤에는 **"다시 눌러 주세요"가 거짓말**이라며
   문구를 통째로 갈아엎은 이력을 남겼다(`items/status-mutation-messages.ts:7-24`).

8. **개발자용 문장이 실사용자 빌드에 실리지 않는다.** `"PC와 같은 Wi-Fi에서 API 서버가 켜져
   있는지 확인해 주세요."`는 **빌드 성격**으로 갈려 실사용자에게 도달 불가다
   (`src/auth/login-copy.ts:76-89`, `:109-117`). 축 7에서 가장 위험했을 문장이 이미 닫혀 있다.

9. **부분 데이터를 전체인 양 말하지 않는다.** 리포트 도넛은 분류 목록이 성공했을 때만 그리고
   (`app/(tabs)/reports.tsx:1110`), 홈 최근 기록은 모르면 분류 토큰을 **아예 말하지 않으며**
   (`src/home/recent-expense-category.ts:13-21`), CSV 공유 토스트는 iOS/Android의 결과 인지
   차이 때문에 Android에서는 성공을 단정하지 않는다(`src/export/share-payload.ts:106-113`).
   ⚠️ 그 규율에서 아직 빠진 두 자리가 #2와 #5다.

---

## 4. 권고

**권고 1 — #1(로그인)을 먼저 한다.** 아홉 중 유일하게 *"앱을 아예 못 쓰는 사람"* 을 만드는
자리이고, 크기는 표 세 행이다. 라운드 45가 `USER_WITHDRAWN`·`USER_BLOCKED`로 이미 길을 깔아
두었으므로(`accountStatusErrorMessage`) 새 구조가 필요 없다. **판단이 필요한 것은 문구가 아니라
분류**다: 여섯 OAuth 코드 중 어느 것이 "다시 하면 풀린다"이고 어느 것이 "영영 안 된다"인지를
서버 소유자와 한 번 정하고 표에 적는다.

**권고 2 — #2(CSV)는 문구가 아니라 게이트로 고친다.** 새 문장을 세우면 SET-001 픽셀락이
움직이고 실기기 재캡처가 필요해 **지금 불가능하다**. `canExport`에 `categories.isSuccess`를
더하는 한 줄은 노드를 늘리지 않는다. 선례가 같은 저장소 안에 있다
(`app/(tabs)/reports.tsx:1110`) — 새 판단을 만들지 말고 그 판단을 복사한다.

**권고 3 — #3(준비물/준비템)은 "고치는 라운드"가 아니라 "정하는 라운드"로 연다.**
`docs/5차/round100-custom-items-design.md` §9.6이 `"준비물"`을 확정값으로 적었고 서버 오류 문장
셋도 그 낱말로 계약에 들어갔다. 코드만 바꾸면 문서·계약과 갈린다. **먼저 한 줄을 어딘가에 적어야
한다**: *"사용자에게 보이는 이 개념의 이름은 `준비템` 하나다(탭 라벨 DNC-003이 그 근거)."*
그 줄이 생기면 나머지는 기계적이다. ⚠️ 스무 자리를 한 커밋에 몰지 말고 **표면별로** 나눈다
(홈 카드 / 준비템 탭 커스텀 / 온보딩 / 알림) — 동시 편집 중인 다른 트랙과의 충돌 면이 줄어든다.

**권고 4 — #4·#9(초대 두 표면)를 한 커밋으로 묶는다.** 둘은 같은 짝이고, 앱 쪽만 고치면
`invite-accept-messages.test.ts`의 두-파일 대조 계약이 무엇을 말하는지 확인해야 한다.
서버 HTML은 픽셀락과 무관하므로 이 묶음은 **오늘 그대로 착수 가능하다.**

**권고 5 — #6·#7·#8은 한 사람이 30분에 끝낼 "소소 세 건"으로 묶는다.**
띄어쓰기 두 칸, 낭독 라벨 한 줄, 낱말 하나. 커밋 관례를 그대로 쓰면
`fix(mobile): 문구 소소 3건 (DNC-018 · 라운드 106 정찰 S3)`. ⚠️ 다만 **#5는 여기 묶지 않는다** —
그것은 표기가 아니라 *값을 지어내는가*의 문제라 판단이 필요하다.

---

## 5. 소유 파일 목록 (교집합 없음)

동시 편집 중인 다른 트랙과 부딪히지 않도록, **한 파일은 한 묶음에만** 넣었다.

**묶음 A — 로그인 실패 문구 (#1)**

- `apps/mobile/src/api/api-error.ts` (표에 `OAUTH_*` 행 추가)
- `apps/mobile/src/auth/login-copy.ts`
- `apps/mobile/app/(auth)/login.tsx`

**묶음 B — CSV 내보내기 게이트 (#2)**

- `apps/mobile/src/export/ExpenseCsvExport.tsx`

**묶음 C — 준비템 낱말 통일 (#3) · 표면별 하위 묶음**

- C-1 홈: `apps/mobile/src/home/first-run-guide.ts`
- C-2 준비템 탭 커스텀: `apps/mobile/src/items/custom-item-form.ts`
- C-3 다음 시기 미리보기: `apps/mobile/src/items/next-stage-preview.ts` ·
  `apps/mobile/app/(tabs)/items.tsx`
- C-4 온보딩: `apps/mobile/app/(onboarding)/prepared-items.tsx` ·
  `apps/mobile/app/(onboarding)/resume.tsx` · `apps/mobile/src/onboarding/local-progress.ts` ·
  `apps/mobile/src/onboarding/prepared-items-selection.ts`
- C-5 알림: `apps/mobile/src/notifications/stage-preview-d7.ts`
- C-6 문서/계약: `docs/5차/round100-custom-items-design.md` ·
  `apps/api/src/onboarding/custom-items.service.ts` · `apps/mobile/src/api/local-backend.ts`

**묶음 D — 초대 두 표면 (#4 · #9)**

- `apps/api/src/households/invite-landing.controller.ts`
- `apps/mobile/src/family/invite-accept-messages.ts`

**묶음 E — 분류 칩 폴백 (#5)**

- `apps/mobile/src/expenses/records-list-view.ts`
- `apps/mobile/src/categories.ts` (⚠️ 이 파일은 #2의 원인이기도 하다 — **B는 이 파일을 건드리지
  않고** `ExpenseCsvExport.tsx`의 게이트만 고치는 안으로 적었으므로 교집합이 생기지 않는다.)

**묶음 F — 문구 소소 3건 (#6 · #7 · #8)**

- `apps/mobile/src/notifications/generators.ts`
- `apps/mobile/src/items/item-memo.ts`
- `apps/mobile/src/export/share-payload.ts`

⚠️ **묶음마다 계약 테스트가 문구를 물고 있을 수 있다.** 이 정찰은 소스만 읽었고 테스트는
돌리지 않았다 — 착수하는 사람이 각 문자열을 `apps/mobile/src/**/*.test.ts`에서 먼저 grep해
어느 계약이 그 바이트를 들고 있는지 확인해야 한다(특히 `korean-particle-guard.test.ts` ·
`invite-accept-messages.test.ts` · `custom-item-form.test.ts` · `next-stage-preview.test.ts` ·
`messages.test.ts`).
