# 라운드 106 정찰 S4 — 테스트 품질 감사 (유령 단언 사냥)

> **읽은 시점**: 2026-09-07 08:11 ~ 08:40 UTC (워킹트리 HEAD). 다른 트랙 20개가 동시 편집 중이라
> **모든 인용은 그 창의 값**이다. 특히 S4-3의 실측(72)은 이 창 안에서 다른 트랙이 방금 만든 앵커를
> 포함한다 — 되재면 달라질 수 있고, 그 사실 자체가 S4-3의 근거다.
>
> **읽기 전용.** 소스도 테스트도 0바이트 고치지 않았다. `git` 명령 0건. 실행한 것은 읽기와
> `vitest run` 한 파일(`packages/test-utils/src/comment-tolerant-anchor-ledger.test.ts`)뿐이다.

## 모집단 (값)

| 무엇 | 오늘 |
| --- | --- |
| 테스트 파일 | **456** |
| `it(`/`test(` 자리 | **8,643** |
| 테스트 코드 총 줄수 | **180,665** |
| 제품 코드를 **한 줄도 import하지 않고** 파일을 문자열로만 읽는 테스트 파일 | **76** (29,616줄 · 16%) |
| 제품 import + 소스 스캔을 함께 하는 파일 | 235 (102,698줄) |
| 순수 동작 테스트(스캔 0건) | 145 (48,351줄) |
| `vi.mock(` 총 호출 | **5** |
| `.rejects`/`.resolves` 단언 | 151 — **await 누락 0건** |

> 마지막 두 줄이 이 저장소의 성격을 말한다: **목이 실물을 대신하는 자리가 사실상 없다**(축 ④는
> 값으로 비어 있다). 대신 위험은 전부 **문자열 앵커**와 **모집단이 빌 수 있는 반복문**에 몰려 있다.

---

## 요약 표

| # | 한 줄 | 심각도 | 크기 |
|---|---|---|---|
| **S4-1** | `onboarding-resume.test.ts`가 *"app/index.tsx가 서버 진행도를 가져온다"* 를 무는데, 그 이름은 **주석에만** 남아 있다 — 화면은 다른 함수를 부른다 | **상** | S |
| **S4-2** | `record-gap.test.ts`가 무는 `hasPendingLocalRecords`는 **라운드 80이 코드에서 없앤 이름**이고, 오늘 그 파일의 주석 셋에만 산다 | **상** | S |
| **S4-3** | 주석 관용 앵커 래칫이 지키는 모집단은 스윕 파일의 **7.7%**(26/337)다 — 조건이 "헬퍼 이름이 `readSource`" 하나뿐이라, 나머지에서 **주석에만 걸린 앵커 40개**가 래칫 밖에 서 있다 | **상** | M |
| **S4-4** | `link-price.test.ts:269`의 `it` 전체가 **공허하다** — 걸러낸 목록이 오늘 0건이라 반복문이 0회 돌고, 남는 단언은 `length >= 0` 하나다 | 중 | S |
| **S4-5** | `items-stage-band-flow.test.ts` · `item-labels.test.ts`의 앵커 넷이 **대상 파일의 주석에만** 있다 (`toChildDto` · `renderItemFooter` · `ModV1Primitives`) | 중 | S |
| **S4-6** | `seed-data.test.ts`의 세 형제 중 **하나만 모집단 하한이 없다** — 같은 파일이 옳은 형식을 두 번 보여 준다 | 중 | XS |
| **S4-7** | 어드민 MFA 중간 토큰의 **거절 갈래 셋이 테스트 0건**이다 — 위조·만료·형식오류를 아무도 보내 보지 않는다 | 중 | S |
| **S4-8** | `packages/test-utils`에서 셋째로 큰 계약 파일(1,502줄)이 **역돌연변이 실증 0건**이고, 지키는 것은 마크다운 문서의 라운드 번호 정합이다 — 정작 그 표가 23라운드째 "미확인"이라 적은 항목은 그대로다 | 중 | M |
| **S4-9** | `f(x) === f(x)` 꼴 **동어반복 단언 6자리** (그중 하나는 100회 반복하는 "속성 테스트"다) | 하 | XS |
| **S4-10** | `toBeGreaterThanOrEqual(0)` **기록 전용 단언 3자리** — 스스로 "기록만"이라 적어 두었지만 읽는 사람에게는 계약처럼 보인다 | 하 | XS |

**이미 튼튼한 축**은 맨 끝 §"다시 파지 말 것"에 값으로 적었다. 축 ④(모킹)는 실질적으로 **모집단이 없다**.

---

## S4-1 [상 · S] 온보딩 이어하기 계약이 **주석 하나**로 서 있다

### 그 테스트가 초록인 이유
`apps/mobile/src/onboarding-resume.test.ts:308-319`

```
it("has app/index.tsx fetch server onboarding progress and route to the resume screen for an interrupted session", () => {
  const indexSource = source("app/index.tsx");
  expect(indexSource).toContain("getOnboardingProgress");            // :311
  expect(indexSource).toContain('<Redirect href="/onboarding/resume" />');
  ...
```

`source()`는 파일을 **원문 그대로** 읽는다(주석을 걷지 않는다). `apps/mobile/app/index.tsx`에서
`getOnboardingProgress`가 나오는 자리는 **딱 하나, 주석이다**:

```
apps/mobile/app/index.tsx:267
  // getOnboardingProgress rejects on HTTP errors but a hung request (no response, no network
```

### 왜 아무것도 증명하지 못하는가
화면이 실제로 부르는 것은 **다른 함수**다 — `fetchOnboardingProgressForSelectedChild`
(`apps/mobile/app/index.tsx:13` import · `:225` 호출). 이름이 갈린 시점에 이 단언은
"코드가 이 일을 한다"에서 "옛 이름을 적은 주석이 아직 있다"로 조용히 바뀌었다.

- 그 주석 한 줄을 지우면 **테스트가 빨개진다**(코드는 그대로인데).
- 서버 진행도 조회를 통째로 들어내고 주석만 남기면 **테스트는 초록이다**.

두 방향 모두 테스트가 이름값(`has app/index.tsx fetch server onboarding progress`)을 못 한다는 뜻이다.

### 어떻게 고쳐야 진짜 그물이 되는가
같은 파일 `:304`가 이미 옳은 형식을 갖고 있다 — `resumeSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")`로
주석을 걷고 나서 본다. 같은 관례로 `indexSource`를 걷고, 앵커를 **오늘 실제로 부르는 이름**
(`fetchOnboardingProgressForSelectedChild`)으로 바꾼다. 옛 이름을 계속 기록하고 싶으면
`admin-write-role-gate.test.ts`가 세운 짝 형식을 쓴다: *"주석에 옛 이름이 남아 있다"* +
*"코드 쪽에는 그 이름이 없다"* 를 한 짝으로.

---

## S4-2 [상 · S] 알림 억제 근거가, 그 근거를 **없앤 라운드의 주석**으로 지켜지고 있다

### 그 테스트가 초록인 이유
`apps/mobile/src/notifications/record-gap.test.ts:179-183`

```
it("훅이 홈 스냅샷에서 값을 뽑아 넘긴다 -- 새 요청도 새 구독도 없다", () => {
  const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
  expect(hookSource).toContain("lastRecordedOn: latestRecordedOn(home.recentExpenses)");
  // P1-3: 억제 근거도 같은 평가 한 번에 실려 나간다(훅은 offline 모듈을 import하지 않는다).
  expect(hookSource).toContain("hasPendingLocalRecords");            // :183
```

`useHomeNotificationEvaluation.ts`에서 `hasPendingLocalRecords`가 나오는 자리는 **셋뿐이고 전부 주석**이다:

```
apps/mobile/src/notifications/useHomeNotificationEvaluation.ts:71    * 남아 있었다): 종전에는 화면이 `hasPendingRecordsForChild`로 미리 접은 `hasPendingLocalRecords`
:144   * 종전에는 화면이 `hasPendingRecordsForChild`로 미리 접은 `hasPendingLocalRecords` boolean을
:221        // 라운드 80 B: 종전의 `hasPendingLocalRecords` boolean 대신 **행**을 넘긴다 -- 그래야
```

### 왜 아무것도 증명하지 못하는가
세 주석이 하나같이 **"종전에는"** 으로 시작한다 — 라운드 80 B가 boolean을 행으로 바꾸면서
그 이름을 코드에서 걷어냈다. 즉 이 단언은 *"오늘 억제 근거가 같은 평가에 실려 나간다"* 가 아니라
*"라운드 80의 이력 주석이 아직 지워지지 않았다"* 를 확인한다. 억제 배선을 통째로 들어내도 초록이고,
이력 주석을 정리하는 순간 빨개진다 — **계약의 방향이 정확히 뒤집혀 있다**.

### 어떻게 고쳐야 진짜 그물이 되는가
같은 `it` 안의 다른 단언들은 옳다(`lastRecordedOn: latestRecordedOn(home.recentExpenses)`는
코드에 있고, `not.toMatch(/^import .*from "\.\.\/offline\//m)`는 `^…m` 앵커라 주석 줄에 걸리지 않는다).
`:183` 한 줄만 오늘 실제로 넘어가는 것(라운드 80 B가 세운 **행** — `generators.ts`의 `PendingRecordScope`
쪽 이름)으로 바꾸고, 이왕이면 `hookSource`를 주석 걷은 사본으로 한 번 만들어 이 파일 전체가 그것을 보게 한다.

---

## S4-3 [상 · M] 주석 관용 앵커 래칫이 **스윕 파일의 7.7%**만 지킨다

### 오늘의 실측 (대장 자신의 바늘로 다시 잼)

`packages/test-utils/src/comment-tolerant-anchor-ledger.ts`의 `collectCommentToleranceAnchors()`를
`packages/test-utils`에서 그대로 돌린 값(2026-09-07 08:2x UTC):

| 값 | 오늘 |
| --- | --- |
| 걷은 테스트 파일(`apps/mobile/src` + `apps/admin/src`) | **336** |
| 그중 **모집단**에 들어온 파일 | **26** (7.7%) |
| 풀린 앵커 | 732 → code-only 652 · **comment-tolerant 72** · comment-only 8 |
| 모집단 **밖**으로 밀린 자리 | **446** — `helper-named-reader` **203** · `derived-subject` 140 · `non-literal-needle` 78 · `regex-anchor` 24 · `app-root-convention` 1 |

**밖으로 미는 조건이 사실상 하나다**: 헬퍼 이름이 문자 그대로 `readSource`여야 한다
(`comment-tolerant-anchor-ledger.ts:523-524` `APP_ROOT_READ_SOURCE`). 이 저장소의 관례적 이름은
`source`다 — 두 뿌리에서 `readFileSync(join(…))`으로 소스를 읽는 테스트 파일은 **238개**인데
그중 헬퍼를 `readSource`로 이름 붙인 것은 **27개**뿐이다(그 27에서 루트가 `process.cwd()`가 아닌
`design-system-restore.test.ts` 하나가 더 떨어져 모집단 26이 된다). **나머지 232개는 이름 때문에 밖이다.**

### 밖에 무엇이 서 있는가 — 대장의 파서를 그대로 빌려 넓혀 재 봤다
같은 두 뿌리에서 **헬퍼 이름 제한만 풀고**, 판정은 대장이 export하는 `splitCodeAndComments()`로 했다:

| 값 | 넓힌 스윕 |
| --- | --- |
| 걷은 테스트 파일 | 337 |
| 루트까지 풀려 실제로 판정한 파일 | **132** (나머지는 루트 상수 꼴이 달라 이 임시 파서가 못 풀었다 — 즉 아래 수는 **하한**이다) |
| 풀린 앵커 | **1,904** (대장의 732 대비 2.6배) |
| comment-tolerant | 64 |
| **comment-only (오늘 초록인 이유가 주석 하나뿐)** | **40** |

대장 안쪽의 comment-only 여덟은 전부 `QUOTATION_EXEMPTIONS`에 이유·증명·짝과 함께 적혀 있다.
**밖의 마흔에는 그런 줄이 없다.** 그중 넷은 아래 S4-1·S4-2·S4-5로 따로 세웠고, 나머지 중에도
같은 성질의 것이 있다(예: `apps/mobile/src/onboarding/consent-recovery.test.ts:156`
`expect(login).toContain("hasResumeWorthyProgress")` — `app/(auth)/login.tsx:217`의 주석에만 있다.
⚠️ 이 자리는 바로 위 줄이 *"로그인 화면의 주석도 그 사실대로 정정돼 있다"* 라고 **의도를 밝힌** 자리라
결함이 아니라 **면제 줄이 없는 면제**다 — 대장 안이었다면 그 줄을 요구했을 것이다).

### 래칫은 살아 있다 — 오늘 실제로 빨갛다
```
$ (packages/test-utils) npx vitest run src/comment-tolerant-anchor-ledger.test.ts
FAIL  ⓔ 래칫 … : expected 72 to be less than or equal to 70
FAIL  상한이 오늘 실측값과 정확히 같다 … : expected 70 to be 72
Test Files 1 failed (1) · Tests 2 failed | 39 passed (41)
```
새로 걸린 둘은 이 창에 다른 트랙이 만든 자리다 —
`apps/mobile/src/family/pending-invites.test.ts:233·:249·:260·:261` ·
`apps/mobile/src/design-foundation.test.ts:294`.
**이 그물은 값을 한다.** 문제는 그 값이 미치는 범위가 7.7%라는 것뿐이다.

### 어떻게 고쳐야 진짜 그물이 되는가
1. `APP_ROOT_READ_SOURCE`의 **이름 고정을 푼다** — 판정에 필요한 것은 이름이 아니라
   *"몸통이 `readFileSync(join(<루트 상수>, rel))`이고 루트가 `process.cwd()`"* 라는 사실뿐이고,
   그 확인은 이미 `appRootDeclaration()`이 한다. 이름만 풀면 모집단이 26 → **최소 132**로 넓어진다
   (`readFileSync(join(…))`을 가진 파일 자체는 238이므로 상한은 그쪽이다).
2. 넓히는 그 커밋에서 **래칫을 새 실측으로 다시 못 박고**, 늘어난 comment-only는
   `QUOTATION_EXEMPTIONS`처럼 이유·증명·짝을 지게 한다(그 형식은 이미 서 있다).
3. 사각 `helper-named-reader`의 하한(오늘 203)은 그날 0이 되고, 그 0이 **걷어서 나온 0**임을
   같은 파일의 관례(`⚠️ 그 0은 걷어서 나온 0이다`)로 적는다.

---

## S4-4 [중 · S] `it` 하나가 통째로 공허하다 — 반복문이 0회 돈다

### 그 테스트가 초록인 이유
`apps/mobile/src/items/link-price.test.ts:269-286`

```
it("가격이 있는 픽스처는 전부 그릴 수 있고, 그 준비템의 가격대 안에 있다 (플랜 B: 현재 0건)", () => {
  const priced = localProductLinkFixtures.filter((link) => link.priceSnapshotKrw !== null);
  expect(priced.length).toBeGreaterThanOrEqual(0);      // :271 — 항상 참
  for (const link of priced) { ... }                    // 오늘 0회
```

`apps/mobile/src/api/local-fixtures.ts`의 링크 픽스처 **여섯 전부**가 `priceSnapshotKrw: null`이다
(`:320 :334 :348 :362 :376 :390`). 그래서 `priced.length === 0`이고, 반복문 안의
`resolveLinkPriceDisplay` 검증 · 가격대 검증은 **한 번도 실행되지 않는다**.

### 왜 아무것도 증명하지 못하는가
남는 단언은 `0 >= 0` 하나다. `resolveLinkPriceDisplay`를 통째로 `() => null`로 바꿔도 이 `it`은 초록이다.
머리말은 이 상태를 *"가격이 되살아나는 날(플랜 A 전환)을 위한 래칫으로 남긴다"* 라고 적었는데,
**남은 것은 래칫이 아니라 잠든 코드**다 — 되살아나는 날에 무엇이 빨개져서 사람을 부르는지가 없다.

### 어떻게 고쳐야 진짜 그물이 되는가
같은 파일이 이미 옳은 형식을 갖고 있다(`:253-258`은 픽스처 배열 블록에 대해 `not.toContain("Date.now(")`처럼
**모집단이 빌 수 없는** 단언을 쓴다). 둘 중 하나를 고른다:
- ⓐ **테스트 안에서 픽스처를 만든다** — `resolveLinkPriceDisplay`에 가격 있는 행을 직접 넘겨
  "그릴 수 있고 가격대 안"을 실제로 확인한다(픽스처의 현재 상태와 무관해진다).
- ⓑ **오늘의 0을 계약으로 못 박는다** — `expect(priced.length, "플랜 B: 스냅샷은 전 행 null이다").toBe(0)`.
  그러면 플랜 A로 가격이 돌아오는 날 **이 줄이 먼저 빨개져서** ⓐ를 세우게 만든다.
  (⚠️ 지금의 `>= 0`은 두 방향 어디로도 사람을 부르지 않는다.)

---

## S4-5 [중 · S] 앵커 넷이 대상 파일의 **주석에만** 있다

| 자리 | 앵커 | 대상 파일에서 그 문자열이 사는 곳 |
| --- | --- | --- |
| `apps/mobile/src/items/items-stage-band-flow.test.ts:111` | `expect(items).toContain("toChildDto")` | `apps/mobile/app/(tabs)/items.tsx:341-342` — **주석** |
| `apps/mobile/src/items/items-stage-band-flow.test.ts:112` | `expect(source("src/items/stage-bands.ts")).toContain("toChildDto")` | `apps/mobile/src/items/stage-bands.ts:114 · :122 · :130` — **전부 주석** |
| `apps/mobile/src/items/item-labels.test.ts:198` | `expect(labels).toContain("renderItemFooter")` | `apps/mobile/src/items/item-labels.ts:23` — **머리말 주석** |
| `apps/mobile/src/items/item-labels.test.ts:199` | `expect(labels).toContain("ModV1Primitives")` | `apps/mobile/src/items/item-labels.ts:21` — **머리말 주석** |

### 왜 아무것도 증명하지 못하는가
`items-stage-band-flow.test.ts:108`의 `it` 제목은 *"두 원천이 서버에서 같은 함수(`toChildDto`)에서
온다는 **근거가 소스에 적혀 있다**"* 라 **의도가 문서 확인**임을 밝힌다. 그렇더라도 값의 성질은 같다:
모바일 두 파일에서 이 이름은 코드에 **0건**이고, 서버가 실제로 그 함수를 쓰는지는
같은 `it`의 `:115` (`expect(storeShared).toContain("export function toChildDto(")`)만 확인한다.
즉 `:111·:112` 두 줄은 **주석 관리 상태**를 확인하고, 그 사실이 제목에도 코드에도 표시돼 있지 않다.

`item-labels.test.ts:198-199`는 더 미끄럽다 — 이름만 보면 *"이 파일이 두 컴포넌트를 쓴다"* 로 읽히는데,
`item-labels.ts`가 하는 일은 판정뿐이고 그 두 이름은 *"이 파일에는 호출부 없는 판정만 있다"* 를 설명하는
**머리말 안**에 있다. 머리말을 다듬으면 빨개지고, 판정 로직을 바꿔도 초록이다.

### 어떻게 고쳐야 진짜 그물이 되는가
세 줄 다 **의도가 문서 확인이면 그렇게 말한다**: 변수 이름을 `labelsDoc`/`itemsDoc`처럼 바꾸고,
`splitCodeAndComments`류로 **주석 쪽만** 뽑아 거기서 찾는다. 그러면 (a) 읽는 사람이 속지 않고,
(b) 코드 쪽에 그 이름이 생기는 날 자동으로 판정이 갈린다. 반대로 의도가 배선 확인이면
앵커를 **코드에 실재하는 호출 형태**로 바꾼다.

---

## S4-6 [중 · XS] 형제 셋 중 하나만 모집단 하한이 없다

`apps/api/test/seed-data.test.ts`

```
:335  it("requires skip guidance for every convenience/optional item", …)
        const nonEssential = itemTemplateSeeds.filter(item => convenience|optional);
        ← 하한 없음
        for (const item of nonEssential) { … }

:350  it("requires a safety note whenever a medical disclaimer is required", …)
        expect(medicalItems.length).toBeGreaterThan(0);              // :354  ← 하한 있음

:465  it("essential 품목은 예외 없이 링크 ≥1", …)
        expect(essentials.length, "essential 품목이 없으면 이 절은 아무것도 묻지 않는다")
          .toBeGreaterThan(0);                                       // :471  ← 하한 있음 + 이유까지
```

### 왜 아무것도 증명하지 못할 수 있는가
오늘은 공허하지 않다 — 시드에 `convenience`/`optional` 품목이 **39건** 있다
(`apps/api/prisma/seed-data.ts`). 문제는 **되돌리면 빨개지는지 확인된 적이 없다**는 것이다.
필수도 enum 값이 바뀌거나(`convenience` → 다른 이름) 시드가 그 등급을 잃으면 반복문이 0회 돌고
*"건너뛰기 안내가 없는 품목 0건"* 이 **보지 않아서 0**이 된다. 옆의 형제 둘이 정확히 그 사고를
막으려고 하한을 지고 있으므로, 이 파일은 **자기 안에 옳은 형식을 두 번 보여 준다**.

### 고치는 법
한 줄이다: `expect(nonEssential.length, "convenience/optional이 없으면 이 절은 아무것도 묻지 않는다").toBeGreaterThan(0);`
(형제 `:471`의 문구를 그대로 빌린다.)

---

## S4-7 [중 · S] 어드민 MFA 중간 토큰 — **거절 갈래 셋이 테스트 0건**

### 무엇이 안 잡히나
`apps/api/src/admin/admin-token-crypto.ts:59-77` `verifyAdminMfaPendingToken`은 셋으로 거절한다.

| 갈래 | 줄 | 테스트 |
| --- | --- | --- |
| 형식 오류(점 셋으로 안 갈림) | `:60-63` | **0건** |
| 서명 불일치(위조·다른 비밀값) | `:66-68` | **0건** |
| 만료 또는 `type` 불일치 | `:72-74` | **0건** |

`apps/api/test/admin-mfa-session.e2e.test.ts`가 `mfaToken`을 쓰는 자리는 **아홉**인데
(`:209 :215 :220 :262 :295 :325 :330 :337 :374`) 전부 **직전 로그인이 방금 내준 토큰을 그대로** 보낸다.
`:374`도 "다른 기기 세션"이지 다른 계정이 아니다. `ADMIN_MFA_TOKEN_INVALID`라는 코드 문자열은
저장소의 어느 테스트 파일에도 **0건**이다.

### 왜 이것이 8,643개 안에서 안 보였나
이 축은 "테스트가 없다"가 아니라 **"행복 경로만 있다"** 라서 파일 수·테스트 수 어디에도 티가 나지 않는다.
`admin-token-crypto.ts`는 어떤 테스트도 **이름으로 부르지 않는다**(0건) — HTTP로만 지나가고,
HTTP로 지나가는 경로는 성공 갈래뿐이다.

### 어떻게 고쳐야 진짜 그물이 되는가
`.e2e`가 아니라 **단위 테스트 한 파일**이 맞다(비밀값은 `requireSecret`의 dev 폴백을 그대로 쓴다):
서명한 토큰의 payload 한 글자를 바꿔 401 · 서명 조각을 잘라 401 · `exp`를 과거로 만든
payload를 같은 비밀값으로 서명해 401 · 그리고 **성공 한 건**(대조군). 넷 다 `throw`를 무는
`expect(...).toThrow()` 한 줄씩이라 크기는 S다.

---

## S4-8 [중 · M] 1,502줄짜리 계약이 지키는 것이 **마크다운의 라운드 번호**다

`packages/test-utils/src/accessibility-checklist-shape.test.ts` (1,502줄)

| 자리 | 값 |
| --- | --- |
| 래칫·하한류 단언 | **68** |
| 픽스처/교란/역돌연변이 실증 | **0** |
| 무는 대상 | `docs/qa/accessibility-offline-checklist.md` · `docs/qa/runtime-verification-required.md` |

### 왜 아무것도 (제품에 대해) 증명하지 못하는가
파일 머리말이 스스로 적어 두었다 — *"이 계약이 세는 것은 그 **수의 정합**이지 **확인 여부가 아니다**
— C-3을 실제로 확인할 손은 저장소 밖이고, 그 배정을 이 파일이 대신할 수는 없다"*
(`:26-28`). 즉 이 그물이 빨개지는 유일한 조건은 *세 자리 중 한 자리만 라운드 번호를 올렸을 때*이고,
정작 그 표가 말하는 항목(C-3 — 잠금 오버레이 TalkBack 투과)은 **라운드 67부터 오늘 89까지 스물세 라운드째
"미확인"** 인 채로 초록이다.

라운드 104·105가 세운 규율(되돌리면 빨개지는지 실증한다)의 관점에서 보면, 이 파일에는
**교란 픽스처가 0건**이다 — `comment-tolerant-anchor-ledger.test.ts`(픽스처 12자리) ·
`resume-condition-ledger.test.ts`(71자리) · `dead-export-ledger.test.ts`(12자리)와 대조된다.
같은 형태의 이웃 `contract-net-ledger.test.ts`(526줄 · 래칫류 29 · 픽스처 **0**)도 같은 자리에 있다.

### 어떻게 고쳐야 진짜 그물이 되는가
이 파일을 **더 키우지 않는다**가 첫 권고다. 그 위에 둘 중 하나:
- ⓐ **역돌연변이 한 자리**를 넣는다 — 메모리 픽스처 문서 셋을 만들어 *"C절만 90으로 올린 사본"* 에서
  이 계약이 실제로 빨개지는지 보인다(`comment-tolerant-anchor-ledger.test.ts:290-322`가 그 형식이다).
  그러면 68개 래칫이 장식이 아님을 **한 번**에 증명한다.
- ⓑ 축을 **문서에서 앱으로 한 칸 옮긴다** — C-3이 말하는 성질(잠금 오버레이가 뒤 화면을 TalkBack에
  노출하지 않는다)은 `apps/mobile/src/security/AppLockOverlay.tsx`의 소스 계약으로 **일부** 잡을 수 있다.
  손이 저장소 밖이라는 사실은 그대로지만, "미확인 23라운드"의 크기는 줄어든다.

---

## S4-9 [하 · XS] `f(x) === f(x)` — 동어반복 여섯

| 자리 | 단언 | 왜 항상 참인가 |
| --- | --- | --- |
| `packages/domain/src/stage.boundary.test.ts:287` (그 `it`은 `:278`) | `expect(calculateChildStage(input)).toEqual(calculateChildStage(input))` | `calculateChildStage`는 `today`를 인자로 받는 **순수 함수**다(`packages/domain/src/stage.ts:57-88` — `Date.now()` 0건). ⚠️ 이 줄은 `it("[속성] 멱등성 100건 …")` 안에서 **100번 돈다** — 100개의 동어반복이다 |
| `apps/api/test/request-log-fields.test.ts:586` | `expect(loggablePath(sample)).toBe(loggablePath(sample))` | 같은 `it`의 `:581`이 이미 `rule.pattern.global === false`를 물어 **상태 이월이 없음을 직접** 확인한다. 이 줄은 그 뒤에 붙은 사족이고, `global`이 `true`여도 `test()`가 아니라 `loggablePath()`를 두 번 부르므로 갈리지 않을 수 있다 |
| `apps/mobile/src/preparation/preparation-restore.test.ts:557` | `preparationAutoExpandKey("child-1", ["가","나"])` 두 번 | 같은 `it`의 `:555` `expect(new Set(signatures).size).toBe(cases.length)`가 **진짜 계약**(여덟 입력이 여덟 서명)이다 |
| `apps/mobile/src/preparation/search-draft.test.ts:69` | `searchResultCountAnnouncement("젖병",5)` 두 번 | 바로 아래 `:71·:73`의 두 `not.toBe`가 실제 계약이다 |
| `apps/mobile/src/notifications/generators.test.ts:104` | `budgetNotifications(budgetInput)[0].dedupeKey` 두 번 | 같은 `it`의 `:105-110`이 달 넘김을 실제로 확인한다 |
| `apps/mobile/src/security/app-lock.test.ts:90` | `hashPin("1234","salt-a")` 두 번 | 앞 두 줄(`:88-89`)의 `not.toEqual` 둘이 진짜 계약이다. `createAppLockRecord`가 솔트를 무작위로 뽑는 것은 `:77-85`가 이미 따로 확인한다 |

### 왜 값이 있는 지적인가
여섯 다 **옆에 진짜 계약이 있다** — 즉 지우면 잃는 것이 없다. 그런데 여섯 다 *"멱등이다" ·
"두 번 물어도 같은 답이다" · "재렌더가 서명을 흔들지 않는다"* 처럼 **성질을 약속하는 문장**을 달고
있어서, 다음 사람이 *"그 성질은 이미 잡혀 있다"* 고 믿게 만든다. 특히 첫 줄은
`it("[속성] …")` 이라는 이름을 달고 100회를 돌아 **가장 비싸고 가장 아무것도 아닌 자리**다.

### 고치는 법
- `stage.boundary.test.ts:278-289`: 두 번 부를 이유가 있으려면 **입력이 달라야 한다**. 이 자리에
  진짜로 값이 있는 속성은 이미 옆에 있다 — `:273` `expect(result.stageCode).toBe(expectedStageForMonths(result.ageMonths))`
  꼴로 **다른 경로**(달력 이동 · 문자열 정규화)로 같은 결론에 닿는지를 묻는 것. 그게 아니면 지운다.
- 나머지 다섯: 지우거나, 정말 부수효과가 걱정이면 **부수효과를 무는 단언**으로 바꾼다
  (예: 호출 전후 `process.env`/모듈 캐시가 같은지).

---

## S4-10 [하 · XS] `toBeGreaterThanOrEqual(0)` — 기록 전용 세 자리

| 자리 | 단언 |
| --- | --- |
| `packages/test-utils/src/repo-self-description.test.ts:1102` | `expect(dead.length, "모집단 밖의 죽은 좌표 — 양방향 수라 기록만 (E 시점 3 · 오늘 1)").toBeGreaterThanOrEqual(0)` |
| `packages/test-utils/src/resume-condition-ledger.test.ts:1727` | `expect(staleProseBlindSpots().length).toBeGreaterThanOrEqual(0)` |
| `apps/mobile/src/items/link-price.test.ts:271` | (S4-4에서 다룸) |

앞의 둘은 **스스로 "기록만"이라 적어 두었고** 그 판단에는 근거가 있다(양방향으로 움직이는 수에
하한을 두면 거짓 계약이 된다 — 라운드 95 M-1의 규율). 결함으로 세지 않는다. 다만 값의 성질은
같다: `expect`로 적혀 있으면 읽는 사람은 계약으로 읽는다.

**권하는 형태**: 값을 남기고 싶으면 `expect`가 아니라 `console.info`/스냅샷 파일이거나,
아니면 **양방향임을 계약으로 만든다** — 예: `expect(dead.length).toBeLessThanOrEqual(RECORDED_MAX)`처럼
*나쁜 방향에만* 상한을 걸면 0-정보 줄이 아니게 된다.
(`resume-condition-ledger.test.ts:1729`의 `downwardGoodBlindSpots().length >= 1`이 바로 옆에서
그 옳은 형식을 보여 준다 — 그 줄은 "아래가 좋은 방향인 자리가 실재한다"를 실제로 문다.)

---

## 다시 파지 말 것 — 이미 튼튼한 축 (값으로)

| 축 | 실측 |
| --- | --- |
| **④ 모킹이 실물을 대신하는 자리** | `vi.mock(` **총 5회**. 그중 둘(`sqlite-retention.test.ts:20` · `sqlite-migrations.test.ts:26`)은 목이 아니라 **금지 장치**다 — `expo-sqlite`를 열면 즉시 던진다. 러너 검증은 **진짜 `node:sqlite`** 로 돈다. 컴포넌트 렌더 테스트 **0건**(`*.test.tsx` 0개)이라 "목 위에서만 참"인 성질이 살 자리가 거의 없다 |
| **스킵이 조용히 초록을 만드는가** | `apps/api`의 `describe.skipIf(!dbAvailable)` **23파일**은 실질적으로 죽은 코드다 — `apps/api/vitest.config.ts:32`가 `globalSetup`을 걸고, `apps/api/test/global-setup.ts:35`의 `SELECT 1`이 실패하면 `:44`가 **런 전체를 중단**한다(*"individual suites skip"* 을 막는 것이 그 파일의 명시된 목적이다) |
| **그 스킵의 스킵** | 모바일 SQLite 쪽은 한 걸음 더 갔다 — `sqlite-migrations.test.ts:198-208` *"실제 SQLite 검증이 조용히 스킵되지 않는다"* 가 `node:sqlite` 로드와 **실제 open**까지 확인한다. 이 형식이 저장소의 정답이고, S4-4·S4-6이 빌려 쓸 형식이다 |
| **비동기 단언 누락** | `.rejects`/`.resolves` **151자리 · await 누락 0건** |
| **`packages/domain` 경계 테스트** | 자기 오라클 위험이 **막혀 있다**. `stage.boundary.test.ts:28-41`의 `expectedStageForWeek`/`expectedStageForMonths`는 `stage.ts:93-116`의 사본이지만, 같은 파일 `:216-225`(월령 경계 열 줄)·`:64-80`(주차 12/13·27/28)이 **리터럴로** 표를 못 박아 둔다 — 사본과 원본이 함께 틀어지면 그 리터럴이 먼저 빨개진다 |
| **DNC-009** | `recommendation.boundary.test.ts:100-116` — 시드 고정 난수로 수수료율 100건(0·음수·`MAX_SAFE_INTEGER`·NaN 포함)을 넣고 점수 불변을 확인한다. 동어반복이 아니다(`baseline`은 `affiliateCommissionRate: undefined`, 비교군은 임의 값) |
| **`a11y-contract.test.ts` 모집단 하한** | 8,353줄인데 스윕마다 바닥이 있다 — `:275 :430 :871 :3708 :3841 :4852 :5403 :5466 :5479 :5480`. *"대장이 비면 이 스윕이 조용히 죽는다"* 라는 문구까지 값으로 적혀 있다 |
| **`seed-data.test.ts` 하한** | `:329-331`(스테이지별 ≥5) · `:354`(의료 고지) · `:471`·`:500`(essential 두 절) — S4-6의 한 자리만 빠져 있다 |
| **주석 관용 래칫 자체** | 오늘 **실제로 빨갛다**(72 > 70). 그물이 일한다는 실증이고, S4-3은 "안 된다"가 아니라 "범위가 7.7%"라는 지적이다 |
| **`.not.toContain` 2,219자리** | 표본으로 본 자리들은 **앵커 부재를 먼저 막는다** — 예: `share-flow.test.ts:127-130`이 `slice`의 두 표식을 `toBeGreaterThan(-1)`로 먼저 물고 *"두 표식이 사라지면 아래 `not.toContain`이 전부 통과한다"* 를 주석으로 적어 두었다. 이 관례는 축 ①의 대표적 함정을 이미 알고 있다는 증거다 |

---

## 권고 (넷)

1. **S4-3을 먼저 연다 — 이름 고정 하나를 푸는 것이 나머지 절반을 자동으로 잡는다.**
   `APP_ROOT_READ_SOURCE`에서 헬퍼 이름 `readSource` 제약만 빼면 모집단이 26 → 최소 132파일,
   앵커가 732 → 최소 1,904로 넓어지고, S4-1·S4-2·S4-5의 네 자리가 **다음 라운드부터는 정찰 없이**
   래칫에서 떨어진다. 넓히는 커밋에서 래칫을 새 실측으로 다시 못 박고, comment-only로 새로 들어오는
   자리마다 `QUOTATION_EXEMPTIONS` 형식(이유·증명·짝)을 요구한다.
   ⚠️ 이 트랙은 **래칫이 이미 빨간 상태에서 시작한다**(72 > 70) — 넓히기 전에 그 둘부터 정리한다.

2. **S4-1·S4-2 두 줄은 지금 고친다(크기 S, 다른 트랙과 교집합 없음).**
   둘 다 *배선을 무는 척하며 이력 주석을 무는* 자리라, 값이 가장 크고 위험이 가장 작다.
   고치는 김에 두 파일의 `source()` 호출을 주석 걷은 사본으로 한 번 만들어 파일 전체가 그것을 보게 한다.

3. **"모집단이 빌 수 있는 반복문"에 하한을 요구하는 관례를 값으로 못 박는다.**
   오늘 저장소는 그 관례를 **알고 있으나 강제하지 않는다**(a11y-contract는 열 자리에서 지키고,
   seed-data는 셋 중 둘에서 지키고, link-price는 지키지 않는다). `mutation-press-guard.test.ts`류의
   소스 스캔 계약을 하나 더 세워, *"`.filter(…)` 결과를 `for…of`로만 도는 `it`은 그 목록의 하한을
   함께 문다"* 를 세는 것이 가장 싼 길이다. 오늘의 위반 후보는 스캔으로 **94자리**가 잡히고
   (대부분은 이미 하한이 있다), 실제 결함은 S4-4·S4-6 둘이다 — **먼저 그 둘을 고쳐 두면 새 계약의
   첫날 값이 0이 된다**.

4. **S4-7(MFA 토큰 거절 갈래)은 어드민 트랙이 가져간다.**
   e2e를 늘리지 말고 단위 테스트 한 파일(네 자리)로 끝낸다. 이 저장소에서 "8,643개 테스트"가
   가장 크게 오해를 부르는 자리가 여기다 — 파일 수·테스트 수 어디에도 안 보이는데,
   인증 경계의 거절 갈래 셋이 통째로 비어 있다.

> **일부러 권고하지 않는 것**: S4-8을 "고친다". 1,502줄 문서-형태 계약을 **더 키우는 트랙은 열지 않는다.**
> 값이 있는 것은 그 파일에 **교란 픽스처 한 자리**를 더해 68개 래칫이 장식이 아님을 한 번 보이는 것뿐이고,
> 그마저 다른 세 권고보다 뒤다.

---

## 소유 파일 목록 (트랙 경계 — 교집합 없음)

| 트랙 | 발견 | 소유 파일 (읽기 아닌 **쓰기** 대상) |
| --- | --- | --- |
| **T1 앵커 모집단** | S4-3 | `packages/test-utils/src/comment-tolerant-anchor-ledger.ts`<br>`packages/test-utils/src/comment-tolerant-anchor-ledger.test.ts` |
| **T2 유령 앵커 정정** | S4-1 · S4-2 · S4-5 | `apps/mobile/src/onboarding-resume.test.ts`<br>`apps/mobile/src/notifications/record-gap.test.ts`<br>`apps/mobile/src/items/items-stage-band-flow.test.ts`<br>`apps/mobile/src/items/item-labels.test.ts` |
| **T3 빈 모집단 하한** | S4-4 · S4-6 | `apps/mobile/src/items/link-price.test.ts`<br>`apps/api/test/seed-data.test.ts` |
| **T4 인증 거절 갈래** | S4-7 | `apps/api/test/admin-mfa-token.test.ts` *(신설)* |
| **T5 동어반복 정리** | S4-9 · S4-10 | `packages/domain/src/stage.boundary.test.ts`<br>`apps/api/test/request-log-fields.test.ts`<br>`apps/mobile/src/preparation/preparation-restore.test.ts`<br>`apps/mobile/src/preparation/search-draft.test.ts`<br>`apps/mobile/src/notifications/generators.test.ts`<br>`apps/mobile/src/security/app-lock.test.ts` |
| **(보류)** | S4-8 | `packages/test-utils/src/accessibility-checklist-shape.test.ts` — **이 라운드에 열지 않는다** |

- T1과 T2는 **논리적으로 이어지지만 파일이 겹치지 않는다** — T1이 넓히면 T2의 네 자리가 래칫에서
  떨어지므로, **T2를 먼저** 하거나 같은 라운드에 함께 한다(T1만 먼저 하면 그 순간 래칫이 더 빨개진다).
- 어느 트랙도 **제품 소스를 고치지 않는다**. S4-1·S4-2가 가리키는 `apps/mobile/app/index.tsx` ·
  `apps/mobile/src/notifications/useHomeNotificationEvaluation.ts`는 **읽기 대상**이다
  (주석을 지우는 것은 답이 아니다 — 앵커가 무엇을 보는가를 고친다).
- S4-7의 신설 파일은 `apps/api/test/` 아래에 새 이름으로 서므로 다른 트랙과 충돌하지 않는다.
