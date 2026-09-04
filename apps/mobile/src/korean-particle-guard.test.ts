import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import {
  hasFinalConsonant as babyCounterHasFinalConsonant,
  objectParticle as babyCounterObjectParticle,
  withParticle as babyCounterWithParticle
} from "./home/baby-counter";
import {
  directionParticle,
  hasFinalConsonant,
  nameWithHonorificSuffix,
  objectParticle,
  subjectParticle,
  withParticle
} from "./text/korean-particles";

/**
 * 라운드 93 트랙 B — **사용자가 지은 이름 뒤의 조사가 값에서 갈린다.**
 *
 * 한국어의 을/를 · 이/가 · 은/는 · 과/와 · (으)로는 **앞 낱말의 받침**으로 갈린다. 문장에 이름을
 * 끼워 넣고 그 뒤에 조사를 리터럴로 못 박으면, 받침이 반대인 값이 들어온 날 문장이 깨진다:
 *
 *   "지훈를 추가했어요"     ← `app/settings/children.tsx` (받침 있는 별명)
 *   "김가네과 함께해요"     ← `app/family/accept/[token].tsx` (받침 없는 가구 이름)
 *
 * ⚠️⚠️ **이 저장소는 이 물음에 이미 답을 골랐다 — 두 갈래로.**
 *  ⓐ **값의 꼬리를 고정 명사로 끝맺는다**: `householdScopePhrase`가 `‘…’ 가구`로,
 *    `pendingInviteTarget`이 `… 초대`로, `recordsCountPhrase`가 `기록 N건`으로 끝난다. 그래서
 *    그 뒤의 `를`·`로`·`은`이 **언제나** 옳다.
 *  ⓑ **받침에서 조사를 고른다**: `src/home/baby-counter.ts`의 `objectParticle`·`withParticle`.
 *
 * **그런데 세는 계약이 0건이었다.** 그래서 위 넷은 스물세 라운드 동안 아무도 빨갛게 만들지 않았다.
 * 이 파일이 그 자를 세운다 — 그리고 이 자는 *넷을 고쳤다*를 세지 않는다. **모집단 전수마다 판정
 * 하나**를 내고, *갈리는데 고정으로 적은 자리*가 **0건**임을 부정 단언으로 문다.
 *
 * ## ⚠️ 이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다
 *
 * 저장소에는 앱 경계를 넘어 도는 그물 **열다섯**이 있다. **이 파일은 그 하나가 아니다.**
 * 이 스윕이 걷는 것은 `SWEEP_SCOPE_LABEL` 하나 — `apps/mobile/{app,src}/**` 뿐이고, 어드민·api·
 * `packages/**`로는 한 걸음도 나가지 않는다. 그 사실을 주석이 아니라 **값**으로 두는 이유는, 다음
 * 라운드에 누군가 이 파일을 "저장소 조사 그물"로 넓히려 할 때 넓히는 손이 `SWEEP_ROOTS`를 고치며
 * 지나가게 하기 위해서다 — 주석은 조용히 거짓이 되지만 값은 빨개진다.
 * (라운드 92 트랙 A의 `src/keyboard-tap-guard.test.ts`와 같은 계열이고, 그 파일의 형식을 인용한다.)
 *
 * ⚠️ **그리고 이 파일이 소스를 읽는 헬퍼를 하나 세운다**(`readSweptSource`). 그래서 앵커 대장
 * (`packages/test-utils/src/comment-tolerant-anchor-ledger.ts`)의 사각 `helper-named-reader`가
 * 라운드 92의 **166**에서 하나 오른다. ⚠️ **부채가 아니라 스윕이 하나 늘었다는 뜻이다** — 그 사각은
 * 하한으로 물리므로(오늘 하한 164) 오르는 쪽으로는 빨개지지 않는다(`ANCHOR_LEDGER_NOTE`).
 *
 * ## ⚠️⚠️ 전제 재실측 — 정찰의 수는 하한이었고, 모집단의 경계가 갈렸다
 *
 * 정찰(2026-08-31)은 *"보간 뒤 받침 의존 조사 **33**자리(모바일·어드민·패키지) · 안전한 것 **29** ·
 * 갈리는 것 **넷**"* 이라고 적었다. 오늘 `apps/mobile` 하나만 걸어 다시 재니 **트랙 전 33 · 트랙 뒤
 * 38**이다. 갈린 이유는 셋이고 전부 값으로 적는다:
 *
 *  · ⚠️ **정찰의 바늘은 *리터럴 조사가 붙은 자리*만 셌다.** 이 계약은 **조사가 서는 자리**를 센다 —
 *    리터럴로 붙은 것(**꼴 A**)과 **값에서 고른 것**(**꼴 B** · `${name}${objectParticle(name)}`)이
 *    같은 모집단이다. 그러지 않으면 이 트랙이 넷을 고치는 순간 그 넷이 모집단에서 **사라져** 모집단이
 *    33에서 29로 줄고, 래칫이 *"줄지 않는다"* 를 물 수 없다.
 *  · 꼴 B는 트랙 전에도 **다섯**이 있었다(전부 `src/home/baby-counter.ts`). 정찰의 33은 그 다섯을
 *    보지 않았다 — 그래서 트랙 전 전수는 29 + 5 = **34**가 아니라, 어드민·패키지를 뺀 **33**이다.
 *  · ⚠️ **두 형태를 함께 적은 자리는 이 바늘 밖이다**(`이(가)` · `(으)로`). 아래 사각 ⓔ가 그 수를
 *    값으로 진다. 정찰의 33에는 그중 하나가 들어 있었다.
 *
 * **트랙 B 커밋 시점의 값**: 모집단 **38**(꼴 A **29** · 꼴 B **9**) · 판정 `fixed-tail` **29** ·
 * `chooses-from-value` **9** · ⚠️⚠️ `varies-but-written-fixed` **0** · 걷는 파일 **281**(정찰 하한).
 *
 * ⚠️⚠️ **오늘의 값(라운드 93 리뷰 M-6 재실측)**: 모집단 **39**(꼴 A **30** · 꼴 B **9**) ·
 * `fixed-tail` **30** · `chooses-from-value` **9**(그대로) · ⚠️⚠️ `varies-but-written-fixed`
 * **0**(그대로 · 상한) · 걷는 파일 **282**(트랙 B가 신설한 `src/text/korean-particles.ts` 하나).
 * **움직인 것은 계사 쌍 하나가 데려온 자리다** — 자세한 갈래는 아래 두 줄이 값으로 적는다:
 *
 *  · ⚠️ **이름만 바뀐 자리 다섯** — `이에요`를 `이`로 읽고 있던 계사 자리들이 제 이름을 얻었다
 *    (`src/offline/messages.ts:60`·`:135`·`:145` · `src/home/milestone-countdown.ts:190` ·
 *    ⚠️⚠️ 그리고 리뷰의 목록에 없던 **다섯째** `src/reports/monthly-insight.ts:252`).
 *    **판정은 다섯 다 그때도 오늘도 `fixed-tail`이고**, 바뀐 것은 대장에 적힌 이름뿐이다.
 *  · ⚠️⚠️ **새로 들어온 자리 하나** — `src/family/invite-flow.ts:123`의
 *    `${EXPENSE_EDIT_ROLE_LABELS}예요`. 받침 **없는** 형이라 `예요`가 바늘에 없던 어제까지
 *    이 자리는 **사각도 아니고 아무 데도 없었다**(`readParticle`이 `null`을 내고 지나갔다).
 *    ⚠️ **이것이 이 라운드가 배운 것이다 — 쌍의 한쪽만 없어도 자리 전체가 조용히 사라진다.**
 *
 * ## ⚠️⚠️ 이 트랙이 화면에서 바꾼 것 — 조사 한 글자씩 넷
 *
 * `app/settings/children.tsx`의 두 문장과 `app/family/accept/[token].tsx`의 두 문장이다.
 * **낱말·어순·마침표는 바이트 불변**이고 바뀐 것은 조사 하나씩이다(ⓓ가 부정 단언으로 문다).
 * `app/expenses/new.tsx`에는 **주석 한 문단**(AG-4의 거짓 인용을 두 시점으로 정정)만 더했다.
 *
 * ⚠️⚠️ **그리고 그 넷 가운데 하나를 다른 계약이 바이트로 물고 있었다** —
 * `src/a11y-contract.test.ts:1012-1014`가 `children.tsx`의 낭독 한 줄을 **`를`까지 포함해** 통째로
 * 인용한다. 그 파일은 이 라운드에서 **트랙 C의 것**이라 트랙 B가 고치지 않는다. 아래 사각
 * `fixed-particle-pinned-by-another-contract`가 그 사실과 재개 조건을 값으로 진다.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ## 라운드 94 트랙 A — **받침에서 갈리는 것이 조사만이 아니다**(접미사가 이 자에 들어왔다)
 *
 * 라운드 93 리뷰(M-5)가 사각 `suffix-not-particle`로 열어 둔 자리를 **오늘 제품에서 닫는다.**
 * 그 사각이 남긴 것은 *"누가 언젠가 고쳐야 한다"* 가 아니라 ⓐ 자리 ⓑ 옛 바이트와 옳은 바이트
 * ⓒ 발동했을 때 이 수가 얼마가 되는가 **셋**이었고, 오늘 그 셋이 그대로 쓰였다.
 *
 *  · **`-네`(호칭 접미사).** `app/(tabs)/more.tsx`의 세 바이트(낭독 라벨 삼항 두 갈래 + 보이는
 *    가구 카드)가 `${visibleProfile.nickname}네`를 리터럴로 적고 있었다 → 오늘 셋 다
 *    `nameWithHonorificSuffix(visibleProfile.nickname)`을 지난다("지훈" → **"지훈이네"** ·
 *    "서아" → "서아네"). **표면 둘 · 바이트 셋**은 그때도 오늘도 같고, 갈래만 옮겨 갔다.
 *  · **`)로` → `)으로`.** `src/home/budget-edit.ts`의 지난달 실지출 칩 라벨이
 *    `지난달 실지출(${amountText})로` 였다. 꼬리는 **언제나 `원`**(받침 ㄴ)이고 (으)로의 ㄹ
 *    예외에도 걸리지 않으므로 소리로는 `으로`다 — **그리고 같은 칩의 낭독은 처음부터 `으로`였다.**
 *    ⚠️ 한 칩의 보이는 줄과 낭독이 서로 다른 조사를 쓰던 자리이고(라운드 93 리뷰 L-8), 오늘
 *    둘이 같은 조사를 쓴다. **값에서 갈리게 하지 않는 이유는 꼬리가 고정이기 때문이다**(`fixed-tail`).
 *
 * ⚠️⚠️ **그리고 이 걸음은 *통합이 아니라 트랙의 커밋*에 실린다.** 라운드 93은 문구를 고친 트랙과
 * 그 문구를 바이트로 물던 계약이 서로 다른 트랙의 소유라, 핀 이동을 **통합 커밋이 뒤늦게** 닫았다
 * (위 사각의 *"발동됨(라운드 93 통합)"*). 라운드 94는 그 부채를 **배정 단계에서** 없앴다 —
 * *제품 문구를 고치는 트랙이 그 문구를 바이트로 무는 계약 파일 전부를 함께 소유한다*(AH-4).
 * 아래 `PIN_MIGRATIONS`가 그 이동을 자리·옛 바이트·오늘의 바이트 **셋으로** 지고, 옛 바이트가
 * 코드 어디에도 없음을 부정 단언으로 문다.
 *
 * ⚠️⚠️ **배정이 낸 값 하나를 숨기지 않는다** — 정찰이 트랙 A에 준 계약 파일은 **셋**이었는데
 * (`a11y-contract` · `design-restore-p2d` · 이 파일), 오늘 소스를 다시 걸으니 그 세 바이트를 무는
 * 계약이 **하나 더** 있었다: `src/settings/more-menu.test.ts`(핀 **셋**). 그리고 칩 라벨을 무는
 * `src/home/budget-edit.test.ts`(핀 **둘**)까지 세면 아래 `PIN_MIGRATIONS`가 지는 것이
 * **계약 넷 · 핀 여덟**이고, 여기에 **이 파일 자신의 핀 하나**(`closingMarks` 자리의
 * `literalParticle` 등호 — ⓕ 절이 따로 문다)를 더해 **계약 다섯 · 핀 아홉**이다.
 * ⚠️ **두 수를 한 낱말로 적지 않는다** — 대장이 자기 자신을 무는 순환을 만들지 않으려고 아홉째
 * 핀은 대장 밖에 둔다. **정찰의 넷은 하한이었다** — 배정이 완전했는지는 배정표가 아니라 이 수가 말한다.
 *
 * ⚠️ **오늘의 값(라운드 94 트랙 A)**: 조사 모집단은 **39 그대로**다(`)로` 한 자리가 `로`에서
 * `으로`로 옮겨 갔을 뿐 자리가 나거나 들지 않았다) · `fixed-tail` **30** · `chooses-from-value`
 * **9** · `varies-but-written-fixed` **0**(상한). **접미사 모집단은 셋**이고 갈래가 뒤집혔다:
 * *값에서 고른다* **0 → 3** · *갈리는데 고정으로 적었다* **3 → 0**.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ## 라운드 96 T5 — **묻지 않기로 했던 자리 여섯 중 다섯이 물음에 들어왔다**
 *
 * 사각 ⓔ(`both-forms-written-is-outside-this-needle`)가 값으로 세어 두던 두 형태 표기
 * (`이(가)` · `(으)로`) 여섯 중 **순수 모듈의 다섯**이 값에서 고르는 꼴(꼴 B)로 이관됐다 —
 * 고르는 함수 둘이 새로 섰다(`subjectParticle` · `directionParticle`, 후자는 ㄹ 예외까지 진다):
 *  · `src/notifications/generators.ts`의 단계 전환 제목(`『${childName}』이(가)` → `subjectParticle`)
 *  · `src/children/child-switch.ts`의 전환 안내·낭독 라벨 둘(`(으)로` → `directionParticle`)
 *  · `src/children/child-deletion.ts` · `src/children/household-join.ts`의 전환 토스트 둘(같은 이관)
 * 남은 하나(`app/settings/children.tsx`의 `(으)로 전환` 라벨)는 이 라운드에서 그 파일을 소유한
 * 트랙(T6)의 몫이라 사각 ⓔ의 실측이 6에서 **1**로 내려간 채 남는다.
 *
 * ⚠️ **오늘의 값(라운드 96 T5)**: 모집단 **44**(꼴 A **30** 그대로 · 꼴 B **9 → 14**) ·
 * `fixed-tail` **30** · `chooses-from-value` **14** · `varies-but-written-fixed` **0**(상한 그대로) ·
 * 사각 ⓔ **6 → 1**. 걷는 파일 수와 접미사 모집단(셋)은 그대로다.
 */

/** 이 스윕이 걷는 앱 경계. `apps/mobile/` 밖으로는 한 걸음도 나가지 않는다. */
const SWEEP_SCOPE_LABEL = "apps/mobile/{app,src}/**" as const;

/** 뿌리 둘 — 화면(`app`)과 그 화면이 쓰는 순수 모듈(`src`). */
const SWEEP_ROOTS = ["app", "src"] as const;

const mobileRoot = process.cwd();

/**
 * ⚠️ 앵커 대장의 사각이 이 파일 때문에 하나 오른다는 사실 — 주석이 아니라 값으로.
 * (`comment-tolerant-anchor-ledger.test.ts`가 그 사각을 **하한**으로 물므로 오르는 쪽은 초록이다.)
 */
const ANCHOR_LEDGER_NOTE =
  "helper-named-reader: 라운드 92의 실측 166 · 하한 164 — 이 파일의 readSweptSource가 그 사각을 하나 올린다(부채가 아니라 스윕이 하나 늘었다). ⚠️ 두 시점(라운드 93 리뷰 M-2): 그 예측이 적중했다 — HEAD 실측 167이고 오른 하나가 이 파일이다(자: comment-tolerant-anchor-ledger.ts:532의 NAMED_SOURCE_READER + collectCommentToleranceAnchors().outside)" as const;

/** 정찰(2026-08-31)이 낸 하한. ⚠️ 값은 갱신하되 이 하한은 내리지 않는다. */
const SCOUT_LOWER_BOUNDS = {
  /** 조사가 서는 자리 전수(꼴 A + 꼴 B). 정찰의 33은 모바일 밖을 포함한 다른 바늘의 수다. */
  particleSites: 33,
  /** 값의 꼬리가 고정이라 갈리지 않는 자리. */
  fixedTailSites: 29,
  /** 값에서 조사를 고르는 자리 — 정찰은 *트랙 뒤 넷*이라 적었고, 오늘 전수는 그보다 크다. */
  choosingSites: 9,
  /** 스윕이 걷는 비테스트 `.ts`·`.tsx` 전수. */
  sweptFiles: 281
} as const;

/**
 * 받침에 따라 갈리는 조사 쌍. ⚠️ **손으로 지은 목록이지만 모집단이 아니라 *바늘*이다** —
 * 모집단은 아래 `collectParticleSites()`가 소스에서 파생한다.
 *
 * ⚠️ `(으)로`만 규칙이 하나 더 있다: **받침이 ㄹ이면 `로`** 다("서울로" · "첫돌로").
 *
 * ⚠️⚠️ **라운드 93 리뷰(M-6)가 여섯째 쌍을 더했다 — 계사 `이에요`/`예요`.**
 * 이것은 문법상 조사가 아니라 **서술격 조사(계사) `이다`의 해요체**인데, **받침으로 갈린다는 점이
 * 똑같고**(받침 있으면 `이에요` · 없으면 `예요`) 이 앱의 화면 문구가 **네 자리**에서 그것을
 * 보간 뒤에 리터럴로 못 박고 있다. ⚠️ **그전까지 이 바늘은 그 넷을 `이`로 읽고 있었다** —
 * `readParticle`이 `이에요`의 앞 한 글자만 보고 멈췄기 때문이고, 그래서 *갈리는 자리가 아니라
 * 다른 조사*로 잘못 이름 붙은 채 대장에 실려 있었다. **잘못된 것은 판정이 아니라 이름이었다**
 * (넷 다 꼬리가 고정이라 `fixed-tail`인 것은 그때도 오늘도 같다).
 *
 * ⚠️⚠️ **그래서 이 쌍은 목록의 *맨 앞*에 선다** — `readParticle`이 `withBatchim`을 먼저 전수로
 * 훑으므로 **긴 것이 짧은 것보다 앞에 있어야** `이에요`가 `이`에 먹히지 않는다(`으로`가 `로`보다
 * 앞에 서야 하는 것과 같은 규율이고, 그 규율이 이제 두 자리에서 걸린다).
 */
const PARTICLE_PAIRS: readonly {
  readonly withBatchim: string;
  readonly withoutBatchim: string;
  readonly rieulTakesWithoutForm: boolean;
}[] = [
  // ⚠️ 긴 것 먼저 — `이에요`가 `이`보다 **반드시** 앞에 있어야 한다(아래 픽스처가 그 순서를 문다).
  { withBatchim: "이에요", withoutBatchim: "예요", rieulTakesWithoutForm: false },
  { withBatchim: "으로", withoutBatchim: "로", rieulTakesWithoutForm: true },
  { withBatchim: "을", withoutBatchim: "를", rieulTakesWithoutForm: false },
  { withBatchim: "이", withoutBatchim: "가", rieulTakesWithoutForm: false },
  { withBatchim: "은", withoutBatchim: "는", rieulTakesWithoutForm: false },
  { withBatchim: "과", withoutBatchim: "와", rieulTakesWithoutForm: false }
];

/**
 * 보간 `}`와 조사 사이에 낄 수 있는 닫는 문자들. ⚠️ **공백은 넣지 않는다** — 넣으면
 * `${label} 이하` · `${phrase} 이 기기` 처럼 조사가 아닌 낱말이 조사로 읽힌다(오늘 넷을 걸러 낸다).
 */
const CLOSING_MARKS = /^[)\]'"’”』」》]*/;

/**
 * ⚠️ **두 형태를 함께 적은 자리는 조사가 고정된 자리가 아니다** — `이(가)` · `(으)로` 꼴.
 * 이 저장소가 고른 **세 번째 답**이고, 이 바늘은 그것을 세지 않는다(사각 ⓔ가 수를 진다).
 */
const BOTH_FORMS_SHAPE = /^\((을|를|이|가|은|는|과|와|으로|로)\)/;

/**
 * ⓒ **값의 꼬리 대장** — 자리마다 *무엇으로 끝나기에 갈리지 않는가*를 값으로 적는다.
 *
 * ⚠️ **이것은 모집단이 아니라 근거다.** 모집단은 전수 걷기가 내고(ⓐ), 이 대장에 줄이 없는 자리는
 * 자동으로 `varies-but-written-fixed`로 떨어져 **빨개진다**. 그래서 새 자리가 조용히 숨을 수 없다.
 *
 * ⚠️ 근거는 산문이 아니라 **소스 바이트**다: `evidence`가 `evidenceFile`에 실재해야 하고, 그 안에서
 * `tails`가 **따옴표 바로 앞**에 서 있어야 한다(= 정말 값의 끝이다). 그리고 `aliasEvidence`가 있으면
 * 그 한 걸음도 자리 파일에 실재해야 한다 — *이름을 되짚는 것*은 걸음이 아니고, **정의를 여는 것**이
 * 한 걸음이다(사각 ⓑ).
 */
const FIXED_TAIL_LEDGER: readonly {
  readonly file: string;
  readonly expression: string;
  readonly particle: string;
  readonly tails: readonly string[];
  readonly evidenceFile: string;
  readonly evidence: readonly string[];
  readonly aliasEvidence?: string;
}[] = [
  {
    file: "app/expenses/recurring.tsx",
    expression: "formatKrw(template.amountKrw)",
    particle: "이",
    tails: ["원"],
    evidenceFile: "src/money.ts",
    evidence: ["`${krwFormatter.format(safeAbsoluteAmount(amount))}원`"]
  },
  {
    file: "app/family/index.tsx",
    expression: "pendingInviteTarget(roleLabel, createdAtLabel)",
    particle: "를",
    tails: ["초대"],
    evidenceFile: "app/family/index.tsx",
    evidence: ["`${createdAtLabel}에 만든 ${roleLabel} 초대`", "`${roleLabel} 초대`"]
  },
  {
    file: "src/design-system/components/ModV1Primitives.tsx",
    expression: "formatKrw(budgetKrw)",
    particle: "을",
    tails: ["원"],
    evidenceFile: "src/money.ts",
    evidence: ["`${krwFormatter.format(safeAbsoluteAmount(amount))}원`"]
  },
  {
    file: "src/expenses/record-row-actions.ts",
    expression: 'actions.map((action) => action.shortLabel).join("·")',
    particle: "를",
    tails: ["삭제"],
    evidenceFile: "src/expenses/record-row-actions.ts",
    // 목록의 **마지막 원소가 언제나 삭제**다(buildRecordRowActions의 마지막 push).
    evidence: ['shortLabel: "삭제"']
  },
  {
    file: "src/expenses/records-calendar.ts",
    expression: "records",
    particle: "이",
    tails: ["기록"],
    evidenceFile: "src/expenses/records-calendar.ts",
    evidence: ['const records = scoped ? "이 조건의 기록" : "기록";']
  },
  {
    file: "src/expenses/records-list-view.ts",
    expression: "RECORDS_SEARCH_FIELDS_LABEL",
    particle: "로",
    tails: ["메모"],
    evidenceFile: "src/expenses/records-list-view.ts",
    evidence: ['RECORDS_SEARCH_FIELDS_LABEL = "품목명, 판매처, 메모"']
  },
  {
    file: "src/export/export-pending-notice.ts",
    expression: "recordsCountPhrase(count)",
    particle: "은",
    tails: ["건"],
    evidenceFile: "src/offline/messages.ts",
    evidence: ["`기록 ${count}건`"]
  },
  {
    file: "src/family/household-scope.ts",
    expression: "phrase",
    particle: "를",
    tails: ["가구"],
    evidenceFile: "src/family/household-scope.ts",
    evidence: ["`‘${text}’ 가구`", "`${text}의 가구`"],
    aliasEvidence: "export function householdScopePhrase("
  },
  {
    file: "src/family/household-scope.ts",
    expression: "phrase",
    particle: "로",
    tails: ["가구"],
    evidenceFile: "src/family/household-scope.ts",
    evidence: ["`‘${text}’ 가구`", "`${text}의 가구`"],
    aliasEvidence: "export function householdScopePhrase("
  },
  {
    // ⚠️⚠️ **두 시점(라운드 94 트랙 A)**: 트랙 B·라운드 93 시점 이 파일은 대장에 **줄 둘**을
    // 지고 있었다 — `particle: "으로"`(칩 라벨 `…과 같은 ${amountText}으로 시작` + 낭독 둘)와
    // `particle: "로"`(지난달 실지출 칩의 보이는 줄 `…(${amountText})로`). **판정은 둘 다
    // `fixed-tail`이었고 그것은 옳았다**(꼬리가 `원`으로 고정이라 갈릴 자리가 없다) — 틀린 것은
    // *어느 형이 옳은가*였다: `원`은 받침 ㄴ이라 소리로는 `으로`이고, 같은 칩의 낭독은 처음부터
    // `으로`였다. 오늘 그 한 글자가 옮겨 가면서 **줄 둘이 하나로 합쳐졌다** — 네 자리가 전부
    // 이 한 줄을 지난다(자리 수는 그대로 넷 · 대장 줄만 둘에서 하나가 됐다).
    file: "src/home/budget-edit.ts",
    expression: "amountText",
    particle: "으로",
    tails: ["원"],
    evidenceFile: "src/money.ts",
    evidence: ["`${krwFormatter.format(safeAbsoluteAmount(amount))}원`"],
    aliasEvidence: "const amountText = formatKrw("
  },
  {
    file: "src/home/budget-progress.ts",
    expression: "formatKrw(lastMonthBudgetKrw)",
    particle: "이",
    tails: ["원"],
    evidenceFile: "src/money.ts",
    evidence: ["`${krwFormatter.format(safeAbsoluteAmount(amount))}원`"]
  },
  {
    file: "src/home/cumulative-total.ts",
    expression: "recordsCountPhrase(count)",
    particle: "은",
    tails: ["건"],
    evidenceFile: "src/offline/messages.ts",
    evidence: ["`기록 ${count}건`"]
  },
  {
    // ⚠️⚠️ **라운드 93 리뷰(M-6)가 계사 쌍을 세우며 처음 모집단에 들어온 자리다.**
    // 그전까지 이 자리는 **어느 판정도 받지 못했다** — `예요`가 바늘에 없어 `readParticle`이
    // `null`을 내고 그대로 지나갔다(사각이 아니라 **아무 데도 없는 자리**였다).
    // 꼬리는 고정이다: `EXPENSE_EDIT_ROLES`가 `["owner", "co_parent"]`이고 `join("·")`의
    // **마지막 원소**가 `co_parent` → `"공동부모"`, 받침이 없어 `예요`가 옳다.
    file: "src/family/invite-flow.ts",
    expression: "EXPENSE_EDIT_ROLE_LABELS",
    particle: "예요",
    tails: ["공동부모"],
    evidenceFile: "src/family/memberLabels.ts",
    evidence: ['co_parent: "공동부모"'],
    aliasEvidence: 'const EXPENSE_EDIT_ROLE_LABELS = EXPENSE_EDIT_ROLES.map((role) => memberRoleLabel(role)).join("·");'
  },
  {
    file: "src/home/last-month-comparison.ts",
    expression: "formatKrw(lastMonthToDateKrw)",
    particle: "을",
    tails: ["원"],
    evidenceFile: "src/money.ts",
    evidence: ["`${krwFormatter.format(safeAbsoluteAmount(amount))}원`"]
  },
  {
    file: "src/home/milestone-countdown.ts",
    expression: "label",
    // ⚠️ **두 시점(라운드 93 리뷰 M-6)**: 트랙 B 시점 이 줄의 `particle`은 `"이"` 였다 — 그때
    // `readParticle`이 `이에요`의 앞 한 글자에서 멈췄기 때문이다. 계사 쌍이 목록에 서면서
    // 소스가 실제로 지고 있는 `이에요`(`src/home/milestone-countdown.ts:190`)로 이관한다.
    // **판정은 그때도 오늘도 `fixed-tail`이다** — 바뀐 것은 이름뿐이다.
    particle: "이에요",
    // 둘 다 받침 ㄹ이라 갈리지 않는다.
    tails: ["100일", "첫돌"],
    evidenceFile: "src/home/milestone-countdown.ts",
    evidence: ['d100: "100일"', '"first-birthday": "첫돌"'],
    aliasEvidence: "const label = MILESTONE_LABEL[milestone];"
  },
  {
    file: "src/notifications/generators.ts",
    expression: "formatKrw(spentKrw)",
    particle: "을",
    tails: ["원"],
    evidenceFile: "src/money.ts",
    evidence: ["`${krwFormatter.format(safeAbsoluteAmount(amount))}원`"]
  },
  {
    file: "src/notifications/notification-row-actions.ts",
    expression: 'actions.map((action) => action.shortLabel).join("·")',
    particle: "를",
    tails: ["지우기"],
    evidenceFile: "src/notifications/notification-row-actions.ts",
    evidence: ['shortLabel: "지우기"']
  },
  {
    file: "src/offline/messages.ts",
    expression: "SYNC_STATUS_SYNCING_LABEL",
    // ⚠️ **두 시점(라운드 93 리뷰 M-6)**: 트랙 B 시점 `"이"` → 오늘 `"이에요"`
    // (`src/offline/messages.ts:60` · 판정은 그때도 오늘도 `fixed-tail`이다).
    particle: "이에요",
    tails: ["동기화 중"],
    evidenceFile: "src/offline/messages.ts",
    evidence: ['SYNC_STATUS_SYNCING_LABEL = "동기화 중"']
  },
  {
    file: "src/offline/messages.ts",
    expression: "SYNC_ROW_UNSENDABLE_LABEL",
    // ⚠️ **두 시점(라운드 93 리뷰 M-6)**: 트랙 B 시점 `"이"` → 오늘 `"이에요"`. 이 한 줄이
    // 자리 **둘**을 진다(`src/offline/messages.ts:135` · `:145` — 같은 값·같은 계사).
    particle: "이에요",
    tails: ["보낼 수 없는 기록"],
    evidenceFile: "src/offline/messages.ts",
    evidence: ['SYNC_ROW_UNSENDABLE_LABEL = "보낼 수 없는 기록"']
  },
  {
    file: "src/offline/messages.ts",
    expression: "recordsCountPhrase(count)",
    particle: "은",
    tails: ["건"],
    evidenceFile: "src/offline/messages.ts",
    evidence: ["`기록 ${count}건`"]
  },
  {
    file: "src/reports/milestone-share.ts",
    expression: "label",
    particle: "을",
    tails: ["100일", "첫돌"],
    evidenceFile: "src/reports/milestone-share.ts",
    evidence: ['return type === "d100" ? "100일" : "첫돌";'],
    aliasEvidence: "const label = milestoneLabel(report.type);"
  },
  {
    file: "src/reports/monthly-insight.ts",
    expression: "formatKrw(dailyAverageKrw)",
    // ⚠️⚠️ **두 시점(라운드 93 리뷰 M-6) · 그리고 리뷰의 목록이 하나 모자랐다.** 트랙 B 시점
    // `"이"` → 오늘 `"이에요"`(`src/reports/monthly-insight.ts:252`). 리뷰가 이관 대상으로 든
    // 계사는 **넷**이었는데 계사 쌍을 목록에 세우자 이 **다섯째** 자리가 함께 드러났다 —
    // **손으로 센 넷과 바늘이 낸 다섯을 한 낱말로 적지 않는다.** 판정은 그대로 `fixed-tail`이다.
    particle: "이에요",
    tails: ["원"],
    evidenceFile: "src/money.ts",
    evidence: ["`${krwFormatter.format(safeAbsoluteAmount(amount))}원`"]
  },
  {
    file: "src/reports/pending-scope-notice.ts",
    expression: "recordsCountPhrase(count)",
    particle: "은",
    tails: ["건"],
    evidenceFile: "src/offline/messages.ts",
    evidence: ["`기록 ${count}건`"]
  },
  {
    file: "src/settings/destructive-flow-messages.ts",
    expression: "REQUEST_LABEL_BY_KIND[kind]",
    particle: "이",
    // 네 값이 전부 "요청"으로 끝난다.
    tails: ["아이 프로필 삭제 요청", "가구 탈퇴 요청", "계정 삭제 요청", "동의 저장 요청"],
    evidenceFile: "src/settings/destructive-flow-messages.ts",
    evidence: [
      'child_profile_delete: "아이 프로필 삭제 요청"',
      'household_leave: "가구 탈퇴 요청"',
      'account_delete: "계정 삭제 요청"',
      'consent_update: "동의 저장 요청"'
    ]
  }
];

/**
 * ⓒ **오늘 고치는 그 넷** — 사용자가 지은 값 뒤에 조사가 서는 자리다. 파일과 문장으로 못 박는다.
 *
 * `previousSentence`는 **트랙 전 바이트**이고, `tailAfterParticle`은 오늘 소스에 있는 꼬리다.
 * ⓓ가 `previousSentence === 옛 조사 + tailAfterParticle`을 부정 단언으로 문다 —
 * **바뀐 것이 조사 한 글자뿐**이라는 사실이 값에서 나온다.
 */
const USER_NAMED_VALUE_SITES: readonly {
  readonly file: string;
  readonly value: string;
  readonly chooser: string;
  readonly previousParticle: string;
  readonly previousSentence: string;
  readonly tailAfterParticle: string;
}[] = [
  {
    file: "app/settings/children.tsx",
    value: "addedName",
    chooser: "objectParticle",
    previousParticle: "를",
    previousSentence: "를 추가했어요.",
    tailAfterParticle: " 추가했어요."
  },
  {
    file: "app/settings/children.tsx",
    value: "addedName",
    chooser: "objectParticle",
    previousParticle: "를",
    previousSentence: "를 추가하고 선택했어요.",
    tailAfterParticle: " 추가하고 선택했어요."
  },
  {
    file: "app/family/accept/[token].tsx",
    value: "result.household.name",
    chooser: "withParticle",
    previousParticle: "과",
    previousSentence: "과 함께해요.",
    tailAfterParticle: " 함께해요."
  },
  {
    file: "app/family/accept/[token].tsx",
    value: "joinedResult.household.name",
    chooser: "withParticle",
    previousParticle: "과",
    previousSentence: "과 함께해요.",
    tailAfterParticle: " 함께해요."
  }
];

/** ⓓ 두 화면의 한국어 리터럴 수 — **새 낱말 0건**의 자. 트랙 전후가 같다. */
const KOREAN_LITERAL_LEDGER: readonly { readonly file: string; readonly count: number }[] = [
  { file: "app/settings/children.tsx", count: 35 },
  { file: "app/family/accept/[token].tsx", count: 25 }
];

/**
 * ⓕ 사각 — ⚠️ **이 스윕이 못 보는 것을 값과 하한으로 적는다.**
 *
 * 이 계약이 세는 수는 *"이 앱의 조사가 이만큼 옳다"* 가 아니라 *"이 모집단 안에서 이만큼이 풀렸다"* 다.
 */
const BLIND_SPOTS: readonly {
  readonly id: string;
  readonly measure: number;
  readonly floor: number;
  readonly reason: string;
  readonly resumeCondition: string;
}[] = [
  {
    id: "concatenated-not-interpolated",
    // 이 바늘 밖의 모양 — `이름 + "를"` 꼴. 오늘 이 모집단에 0건이다.
    measure: 0,
    floor: 0,
    reason:
      "**이 자는 템플릿 보간 뒤만 본다.** 조사를 문자열 이어 붙이기로 붙인 자리(`name + \"를\"`)나 " +
      "배열을 `join`으로 이어 만든 자리는 이 바늘에 걸리지 않는다. ⚠️ **오차의 방향은 조용한 쪽(거짓 초록)이다** — " +
      "그렇게 쓴 자리가 생기면 이 계약은 빨개지지 않고 그냥 못 본다. ⚠️ 오늘 이 모집단에 그 모양은 0건이고, " +
      "아래 `it`이 그 0을 소스로 다시 센다(0인 것은 오늘의 값이지 규율이 아니다).",
    resumeCondition:
      "재개 조건(사건형): 이어 붙이기로 조사를 붙인 자리가 이 모집단에 처음 서는 날 — 그날 이 바늘은 " +
      "보간 말고도 이어 붙이기를 함께 세어야 하고, 그 첫 모집단은 오늘의 38이다."
  },
  {
    id: "tail-followed-one-step-only",
    // 한 걸음(정의를 여는 것)으로 꼬리를 확인한 자리 가운데, 근거가 **자리 파일 밖**에 있는 것.
    // ⚠️ **두 시점(라운드 93 리뷰 M-6)**: 트랙 B 시점 **11** → 그날 **12**. 늘린 하나는
    // `src/family/invite-flow.ts`의 계사 자리이고, 그 꼬리의 근거(`co_parent: "공동부모"`)가
    // `src/family/memberLabels.ts`에 있어 걸음이 파일을 건너간다. **부채가 아니라 자리가 하나
    // 늘었다는 뜻이다** — 그 자리는 그전까지 어느 판정도 받지 못하고 있었다.
    // ⚠️⚠️ **세 시점(라운드 94 트랙 A)**: 12 → **11**. 줄어든 하나는 `src/home/budget-edit.ts`가
    // 지고 있던 **대장 줄 둘**(`으로`·`로`)이 조사 한 글자가 옮겨 가며 **하나로 합쳐진 것**이다.
    // ⚠️ **자리가 준 것이 아니다** — 그 파일의 조사 자리는 그때도 오늘도 넷이고, 이 수가 세는 것은
    // *걸음이 파일을 건너간 대장 줄 수*라서 줄이 합쳐지면 함께 준다. **두 수를 한 낱말로 적지 않는다.**
    measure: 11,
    floor: 1,
    reason:
      "**값의 꼬리가 고정인지는 *한 걸음*만 따라간다** — 이름을 되짚는 것(별칭·매개변수)은 걸음으로 세지 않고, " +
      "**정의를 여는 것**이 한 걸음이다. 함수가 만든 문자열을 두 걸음 이상 좇지 않으므로, 두 걸음 뒤에서 꼬리가 " +
      "갈리는 자리는 이 자가 `fixed-tail`로 잘못 읽을 수 있다. ⚠️⚠️ **다만 오차의 방향은 거짓 빨강(안전)이 기본이다**: " +
      "한 걸음으로 꼬리에 닿지 못하면 그 자리는 대장에 줄이 없어 `varies-but-written-fixed`로 떨어지고 **빨개진다**. " +
      "조용해지는 쪽은 대장에 줄이 있으면서 두 걸음 뒤가 갈리는 경우뿐이고, 그때는 `evidence`가 소스에서 사라지며 " +
      "함께 빨개진다. 이 수는 근거가 자리 파일 밖에 있는 줄 수(= 걸음이 실제로 파일을 건너간 자리)다.",
    resumeCondition:
      "재개 조건(사건형): `formatKrw`·`recordsCountPhrase`처럼 대장이 근거로 삼은 함수의 꼬리가 바뀌는 날 — " +
      "그날 `evidence`가 소스에서 사라져 이 계약이 먼저 빨개지고, 걸음을 늘릴지 값의 꼬리를 되돌릴지가 그날의 판단이다."
  },
  {
    id: "non-hangul-tail-is-convention-not-grammar",
    // 오늘 이 모집단에서 한글이 아닌 끝으로 실제로 떨어진 자리 — 소스 대조로는 셀 수 없다(런타임 값이다).
    measure: 0,
    floor: 0,
    reason:
      "**이름이 라틴 문자·숫자·이모지로 끝나면 받침 판정이 서지 않는다.** 그때 `korean-particles.ts`는 " +
      "**받침 없는 형**(를·와)으로 떨어지고, 그 답은 저장소가 이미 고른 관례(`src/home/baby-counter.ts:87-89`)이지 " +
      "문법이 아니다 — 숫자는 실제로는 읽는 소리를 따라 갈린다(\"둘째2\"는 *이*, \"둘째3\"은 *삼*). " +
      "⚠️ 이 계약은 **그 갈래가 존재한다는 사실과 답**을 값으로 적을 뿐, 어느 이름이 그리로 떨어지는지는 세지 못한다 " +
      "(사용자 입력은 런타임 값이라 소스에 없다). 그래서 이 수는 0이고, 0인 것은 *없다*가 아니라 *셀 수 없다*는 뜻이다.",
    resumeCondition:
      "재개 조건(사건형): 숫자·라틴 문자로 끝나는 아이 별명이나 가구 이름이 실제로 보고되는 날 — 그날 이 답은 " +
      "관례에서 판정으로 올라가야 하고(읽는 소리 표), 첫 모집단은 이 대장의 꼴 B 아홉이다."
  },
  {
    id: "both-forms-written-is-outside-this-needle",
    // ⚠️ **두 시점(라운드 96 T5)**: 라운드 93~94 시점 **여섯**(`이(가)` 하나 + `(으)로` 다섯) →
    // 오늘 **하나**. T5가 순수 모듈 다섯 자리를 값에서 고르는 꼴(꼴 B — subjectParticle ·
    // directionParticle)로 이관했고, 남은 하나는 화면 라벨(`app/settings/children.tsx`의
    // `(으)로 전환`)이다 — 그 파일은 이 라운드에서 다른 트랙(T6)의 소유라 T5가 쓰지 않는다.
    measure: 1,
    floor: 1,
    reason:
      "**두 형태를 함께 적는 답**(`…(으)로 전환` — 종전에는 `『${childName}』이(가) …` 등 여섯)은 조사를 고정한 것도 " +
      "값에서 고른 것도 아니라 **묻지 않기로 한 것**이다. 이 바늘은 그 꼴을 모집단에서 뺀다 — 빼지 않으면 " +
      "`varies-but-written-fixed`로 잘못 떨어져 거짓 빨강이 된다. ⚠️ **오늘 그 자리는 하나이고**(라운드 96 T5가 " +
      "다섯을 꼴 B로 이관 — 남은 하나는 T6 소유 화면의 라벨), 그 하나는 이 계약이 초록이라는 사실 밖에 있다 — 옳다고 말한 적이 없다.",
    resumeCondition:
      "재개 조건(사건형): 두 형태 표기를 화면 문구에서 걷어 내기로 정하는 라운드가 서는 날 — " +
      "그날 그 여섯이 이 모집단으로 들어오고, 첫 모집단은 오늘의 38 + 6이다. " +
      "→ **발동됨(라운드 96 T5 · 일부)**: 여섯 중 다섯이 꼴 B로 들어왔다(모집단 39 → 44 · 꼴 B 9 → 14). " +
      "남은 하나(`app/settings/children.tsx`)는 그 파일을 소유한 트랙의 몫이고, 이 수가 0이 되는 날 이 사각은 닫힌다."
  },
  {
    id: "source-not-runtime",
    measure: 0,
    floor: 0,
    reason:
      "이 계약은 **소스 대조**다 — TalkBack이 그 조사를 실제로 어떻게 읽는지, 화면에 그 글자가 정말 그렇게 " +
      "그려지는지는 이 자가 묻지 않는다(런타임 확인 0건). 그 확인은 **실기기 항목**의 몫이고, 이 계약이 " +
      "초록이라는 사실은 그 항목을 대신하지 않는다.",
    resumeCondition:
      "재개 조건(사건형): 실기기 확인이 *받침 있는 별명 · 받침 없는 가구 이름*을 항목으로 받는 날 — " +
      "그날 이 사각은 그 항목 번호를 함께 든다."
  },
  {
    // ⚠️⚠️ 이 트랙의 축이 **아닌** 것을 축과 함께 적는다(AD-5의 처방).
    id: "fixed-particle-pinned-by-another-contract",
    // 이 트랙이 고친 넷 가운데, 다른 계약이 **옛 바이트를 그대로 인용**하고 있던 자리 수.
    // 종전(트랙 B 완료 시점): 1 — 아래 reason이 적은 그 세 줄. 라운드 93 통합(메인 세션)이
    // 같은 라운드 안에서 그 핀을 오늘의 바이트로 옮겨 적어(두 시점 주석 동반) 오늘 0이다.
    measure: 0,
    floor: 0,
    reason:
      "**고정 조사는 문장에만 있는 것이 아니라 그 문장을 인용한 계약에도 있었다.** " +
      "`src/a11y-contract.test.ts:1012-1014`가 `app/settings/children.tsx`의 낭독 한 줄을 " +
      "`announceForA11y(\\`${input.values.nickname.trim()}를 추가하고 선택했어요.${switchNotice}\\`);` 로 " +
      "**`를`까지 포함해 통째로** 인용한다. 이 트랙이 그 줄의 조사를 고치면 그 인용은 거짓이 된다. " +
      "⚠️⚠️ **그 파일은 이 라운드에서 트랙 C의 소유라 트랙 B가 한 바이트도 쓰지 않는다** — " +
      "그래서 이 자리는 *고쳐졌지만 옆 계약이 아직 옛 바이트를 든 채*이고, 그 사실을 숨기지 않고 값으로 적는다. " +
      "⚠️ 이것은 AG-4가 이름 붙인 병(*인용한 손이 인용당한 자리를 따라가지 않는다*)의 **같은 얼굴**이다.",
    resumeCondition:
      "재개 조건(사건형): 트랙 C 또는 그 뒤의 손이 `src/a11y-contract.test.ts`의 그 세 줄을 " +
      "오늘의 바이트(`${addedName}${objectParticle(addedName)} 추가하고 선택했어요.`)로 옮겨 적는 날 — " +
      "그날 이 사각의 실측은 1에서 0으로 내려간다. " +
      "→ **발동됨(라운드 93 통합)**: 메인 세션이 트랙 B·C 커밋 직후 그 핀을 옮겨 적었고, 실측은 0이다. " +
      "아래 it이 두 방향(핀이 오늘의 바이트를 들고, 화면과 계약 어느 쪽에도 옛 바이트가 없다)을 계속 잰다."
  },
  {
    // ⚠️⚠️ 라운드 93 리뷰(M-5)가 연 사각 — **조사가 아닌데 받침으로 갈리는 것**.
    id: "suffix-not-particle",
    // ⚠️⚠️ **두 시점(라운드 94 트랙 A) · 이 사각은 오늘 닫혔다.**
    //  · 라운드 93 리뷰 시점: **2**(표면 둘 — 낭독 라벨 하나 · 보이는 줄 하나 · 바이트로는 셋).
    //    하한은 1이었다. 재는 것은 *이 바늘이 못 보는 채로 리터럴 `네`가 붙어 있는 표면 수*였다.
    //  · 오늘: **0.** 세 바이트가 전부 `nameWithHonorificSuffix()`를 지나 리터럴 `}네`가 코드에
    //    한 자리도 남지 않았다. ⚠️ **하한을 1에서 0으로 내리는 것은 래칫을 푸는 것이 아니다** —
    //    이 자리의 래칫은 이제 **상한 0**으로 아래 `ⓑ-접미사` 절이 진다(*갈리는데 고정으로 적은
    //    접미사 자리 0건*). 되돌리면 그 상한이 먼저 빨개진다.
    measure: 0,
    floor: 0,
    reason:
      "**조사 바늘(`PARTICLE_PAIRS`)은 조사만 안다.** 그런데 받침으로 갈리는 것은 조사만이 아니다 — " +
      "가구를 부르는 **호칭 접미사 `-네`** 도 앞말의 받침으로 갈린다(받침이 있으면 사이에 `이`가 든다: " +
      "\"지훈**이**네\" · 없으면 바로 붙는다: \"민수네\"). " +
      "⚠️ **라운드 93 리뷰 시점의 사실**: `app/(tabs)/more.tsx`가 사용자가 지은 별명 뒤에 `네`를 " +
      "리터럴로 붙이고 있었다 — 그때 `:406`·`:407`이 낭독 라벨(삼항 두 갈래)이고 `:417`이 화면에 " +
      "보이는 가구 카드였다. 받침 있는 별명이 들어오면 화면과 낭독이 함께 \"지훈네\"가 됐고, 그것은 " +
      "트랙 B가 고친 `}를`·`}과`와 **정확히 같은 병**이었다. " +
      "⚠️⚠️ **오늘의 사실(라운드 94 트랙 A)**: 그 세 바이트가 전부 순수 함수 " +
      "`nameWithHonorificSuffix()`를 지난다(오늘의 자리 `:413`·`:414`·`:424`) — 리터럴 `}네`는 코드에 " +
      "**0건**이고, 남은 `}네`는 그 화면의 **주석 둘**뿐이다(마스킹이 그것을 세지 않는다는 사실을 " +
      "아래 it이 유령 방지로 확인한다). " +
      "⚠️ **그리고 이 사각이 열려 있던 동안 오차의 방향은 조용한 쪽(거짓 초록)이었다** — 조사 쌍에 " +
      "없는 꼴이라 계약이 빨개지지 않고 그냥 못 봤다. 그래서 이 자리는 이제 조사 모집단과 **나란한 " +
      "접미사 모집단**을 따로 걷고, 그 모집단에서 *갈리는데 고정으로 적은 자리*를 **상한 0**으로 문다 — " +
      "못 보는 것을 값으로 적는 데서 그치지 않고 **보게 만든 것**이 이 사각이 닫힌 방식이다.",
    resumeCondition:
      "재개 조건(사건형): 받침 있는 별명을 쓰는 가구에서 \"…네\"가 어색하다는 보고가 서거나, " +
      "`-네` 말고 다른 받침 의존 접미사가 이 모집단에 처음 서는 날 — 그날 이 바늘은 조사 쌍 말고 " +
      "**접미사 규칙**(사이 `이`의 삽입)을 함께 알아야 하고, 첫 모집단은 오늘의 표면 둘(바이트 셋)이다. " +
      "→ **발동됨(라운드 94 트랙 A · 뒤쪽 갈래)**: 접미사 규칙이 `HONORIFIC_SUFFIX_CHOOSER_NEEDLE`로 " +
      "이 자에 들어왔고 첫 모집단은 그 셋이었다. 실측은 2에서 0으로 내려갔다. " +
      "⚠️ **앞쪽 갈래(실사용 보고)는 오늘도 서지 않았다** — 이 트랙이 고친 근거는 보고가 아니라 " +
      "규칙이고, 그 사실을 한 낱말로 적지 않는다. " +
      "⚠️⚠️ **다시 열리는 조건(오늘 새로 적는다)**: 이미 `네`로 끝나는 이름(\"김가네\")에 접미사가 " +
      "또 붙는 갈래(\"김가네네\")는 오늘도 그대로다 — `nameWithHonorificSuffix()`가 막지 않고, " +
      "**막지 않는 것이 오늘의 바이트가 하던 일과 같아서** 이 트랙은 그것을 바꾸지 않았다. " +
      "그 꼴이 실제로 보고되는 날 이 사각은 *접미사 중복*으로 다시 서고, 첫 모집단은 오늘의 셋이다."
  }
];

/**
 * ⓕ **핀 이동 대장(라운드 94 트랙 A · AH-4의 이행)** — *제품 문구를 고치는 손이 그 문구를 바이트로
 * 무는 계약을 함께 옮겼다*는 사실을 **자리 · 옛 바이트 · 오늘의 바이트 셋으로** 진다.
 *
 * ⚠️⚠️ **라운드 93과 갈리는 곳이 여기다.** 그때는 문구를 고친 트랙과 그 문구를 물던 계약이 서로
 * 다른 트랙의 소유라, 핀 이동을 **통합 커밋이 뒤늦게** 닫았다(위 사각
 * `fixed-particle-pinned-by-another-contract`의 *"발동됨(라운드 93 통합)"*). 오늘 이 대장이 세는
 * 이동은 **전부 트랙 A의 커밋 안**에 있다 — 통합이 닫을 부채가 0이라는 뜻이고, 0이 아니면 이
 * 대장이 그것을 값으로 보인다.
 *
 * ⚠️ **계약 파일은 이 스윕의 모집단 밖이다**(`.test.`는 `listSweptFiles`가 걷지 않는다) — 그래서
 * `readFileSync`로 따로 읽고, `product`가 모집단 안에 있는지는 아래 it이 확인한다.
 *
 * ⚠️ 부정 단언은 **주석을 걷은 뒤**에 선다 — 두 시점 규율이 옛 바이트를 주석에 남기라고 하므로,
 * 걷지 않으면 정직하게 적은 손이 빨강을 맞는다(AE-3).
 */
const PIN_MIGRATIONS: readonly {
  /** 옛 바이트를 물고 있던 계약 파일(`apps/mobile/` 기준 상대 경로). */
  readonly contract: string;
  /** 그 계약이 인용하던 제품 파일. */
  readonly product: string;
  readonly previousPin: string;
  readonly todayPin: string;
  /** 제품 쪽 바이트 — 인용을 통째로 든 자리는 핀과 같고, 값이 낀 자리(칩 라벨)는 다르다. */
  readonly previousProductByte: string;
  readonly todayProductByte: string;
}[] = [
  {
    contract: "src/design-restore-p2d.test.ts",
    product: "app/(tabs)/more.tsx",
    previousPin: "<Text style={moreHouseholdNameStyle}>{visibleProfile.nickname}네</Text>",
    todayPin: "<Text style={moreHouseholdNameStyle}>{nameWithHonorificSuffix(visibleProfile.nickname)}</Text>",
    previousProductByte: "<Text style={moreHouseholdNameStyle}>{visibleProfile.nickname}네</Text>",
    todayProductByte: "<Text style={moreHouseholdNameStyle}>{nameWithHonorificSuffix(visibleProfile.nickname)}</Text>"
  },
  {
    contract: "src/a11y-contract.test.ts",
    product: "app/(tabs)/more.tsx",
    previousPin: "? `${visibleProfile.nickname}네, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`",
    todayPin:
      "? `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`",
    previousProductByte: "? `${visibleProfile.nickname}네, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`",
    todayProductByte:
      "? `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`"
  },
  {
    contract: "src/a11y-contract.test.ts",
    product: "app/(tabs)/more.tsx",
    previousPin: ": `${visibleProfile.nickname}네, ${sessionStageLabel}, 프로필 관리`",
    todayPin: ": `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${sessionStageLabel}, 프로필 관리`",
    previousProductByte: ": `${visibleProfile.nickname}네, ${sessionStageLabel}, 프로필 관리`",
    todayProductByte: ": `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${sessionStageLabel}, 프로필 관리`"
  },
  {
    // ⚠️⚠️ **정찰의 배정표에 없던 계약이다** — 트랙 A에 배정된 계약은 셋이었는데, 같은 세 바이트를
    // 무는 넷째가 소스에 있었다(핀 셋). **배정이 완전했는지는 배정표가 아니라 이 대장이 말한다.**
    contract: "src/settings/more-menu.test.ts",
    product: "app/(tabs)/more.tsx",
    previousPin: "<Text style={moreHouseholdNameStyle}>{visibleProfile.nickname}네</Text>",
    todayPin: "<Text style={moreHouseholdNameStyle}>{nameWithHonorificSuffix(visibleProfile.nickname)}</Text>",
    previousProductByte: "<Text style={moreHouseholdNameStyle}>{visibleProfile.nickname}네</Text>",
    todayProductByte: "<Text style={moreHouseholdNameStyle}>{nameWithHonorificSuffix(visibleProfile.nickname)}</Text>"
  },
  {
    contract: "src/settings/more-menu.test.ts",
    product: "app/(tabs)/more.tsx",
    previousPin: "? `${visibleProfile.nickname}네, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`",
    todayPin:
      "? `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`",
    previousProductByte: "? `${visibleProfile.nickname}네, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`",
    todayProductByte:
      "? `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${householdCaption}, ${sessionStageLabel}, 프로필 관리`"
  },
  {
    contract: "src/settings/more-menu.test.ts",
    product: "app/(tabs)/more.tsx",
    previousPin: ": `${visibleProfile.nickname}네, ${sessionStageLabel}, 프로필 관리`",
    todayPin: ": `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${sessionStageLabel}, 프로필 관리`",
    previousProductByte: ": `${visibleProfile.nickname}네, ${sessionStageLabel}, 프로필 관리`",
    todayProductByte: ": `${nameWithHonorificSuffix(visibleProfile.nickname)}, ${sessionStageLabel}, 프로필 관리`"
  },
  {
    // ⚠️ 칩 라벨은 **값이 낀 자리**다 — 계약은 렌더된 문장을 물고 제품은 보간 꼴을 지닌다.
    contract: "src/home/budget-edit.test.ts",
    product: "src/home/budget-edit.ts",
    previousPin: '"지난달 실지출(1,412,000원)로"',
    todayPin: '"지난달 실지출(1,412,000원)으로"',
    previousProductByte: "`지난달 실지출(${amountText})로`",
    todayProductByte: "`지난달 실지출(${amountText})으로`"
  },
  {
    contract: "src/home/budget-edit.test.ts",
    product: "src/home/budget-edit.ts",
    previousPin: '"지난달 실지출(100,000,000원)로"',
    todayPin: '"지난달 실지출(100,000,000원)으로"',
    previousProductByte: "`지난달 실지출(${amountText})로`",
    todayProductByte: "`지난달 실지출(${amountText})으로`"
  }
];

// ───────────────────────────────────────────────────────────────────────────────
// 자 — 주석(그리고 필요하면 문자열)을 걷는다. 라운드 92 A의 `maskComments`를 같은 규율로 쓴다.
// ───────────────────────────────────────────────────────────────────────────────

type MaskOptions = { readonly strings: boolean };

/**
 * 주석을(그리고 `strings`면 문자열 **내용**까지) 같은 길이의 공백으로 바꾼다.
 * ⚠️ **길이를 보존한다** — 자리 계산이 원본과 어긋나지 않게 하려는 것이고, 픽스처가 그 사실을 확인한다.
 */
function maskComments(source: string, options: MaskOptions = { strings: false }): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | '"' | "'" | "`" = "code";
  while (index < source.length) {
    const char = source[index];
    const pair = source.slice(index, index + 2);
    if (state === "code") {
      if (pair === "//") {
        state = "line";
        out += "  ";
        index += 2;
        continue;
      }
      if (pair === "/*") {
        state = "block";
        out += "  ";
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        state = char;
        out += char;
        index += 1;
        continue;
      }
      out += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      } else {
        out += " ";
      }
      index += 1;
      continue;
    }
    if (state === "block") {
      if (pair === "*/") {
        state = "code";
        out += "  ";
        index += 2;
      } else {
        out += char === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }
    // 문자열 안.
    if (char === "\\") {
      out += options.strings ? "  " : source.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === state) {
      state = "code";
      out += char;
      index += 1;
      continue;
    }
    out += options.strings ? (char === "\n" ? "\n" : " ") : char;
    index += 1;
  }
  return out;
}

/** ⓐ 모집단의 뿌리 — 비테스트 `.ts`·`.tsx` 전수. **손 목록이 아니라 걷기다.** */
function listSweptFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      if (entry.name.includes(".test.")) continue;
      found.push(relative(mobileRoot, path).split(sep).join("/"));
    }
  };
  for (const root of SWEEP_ROOTS) walk(join(mobileRoot, root));
  return found.sort();
}

function readSweptSource(relativePath: string): string {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

function lineOf(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (code[i] === "\n") line += 1;
  return line;
}

type Interpolation = {
  /** `${` 의 자리. */
  readonly start: number;
  /** 짝이 맞는 `}` 의 자리. */
  readonly end: number;
  /** `${` 와 `}` 사이의 식. */
  readonly expression: string;
};

/**
 * 템플릿 보간 `${…}` 전수 — 중괄호 깊이와 문자열을 함께 세어 **짝이 맞는 `}`** 를 찾는다.
 * ⚠️ 닫는 짝을 찾지 못한 자리는 버린다(잘린 소스에서 유령 자리를 만들지 않는다).
 */
function interpolationsOf(code: string): Interpolation[] {
  const out: Interpolation[] = [];
  let from = 0;
  for (;;) {
    const at = code.indexOf("${", from);
    if (at === -1) break;
    let depth = 1;
    let quote: string | null = null;
    let index = at + 2;
    for (; index < code.length; index += 1) {
      const char = code[index];
      if (quote !== null) {
        if (char === "\\") index += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    // ⚠️ 존재 가드 — 짝이 없으면 이 자리는 없던 것으로 한다.
    if (index >= code.length) {
      from = at + 2;
      continue;
    }
    out.push({ start: at, end: index, expression: code.slice(at + 2, index) });
    from = index + 1;
  }
  return out;
}

/**
 * ⚠️ **조사를 고르는 함수의 이름도 소스에서 파생한다** — 손으로 적지 않는다.
 * 모집단 전수에서 `export function …Particle(` 을 걷는다(오늘 넷: 두 모듈 × 둘).
 */
function particleChooserNames(): string[] {
  const found: string[] = [];
  for (const file of sweptFiles) {
    const code = maskComments(readSweptSource(file));
    for (const matched of code.matchAll(/export function ([A-Za-z0-9_$]*Particle)\s*\(/g)) {
      found.push(matched[1]);
    }
  }
  return [...new Set(found)].sort();
}

type ParticleVerdict = "fixed-tail" | "chooses-from-value" | "varies-but-written-fixed";

type ParticleSite = {
  readonly file: string;
  readonly line: number;
  /** 조사 앞에 서는 값의 식. */
  readonly expression: string;
  /** 보간과 조사 사이에 낀 닫는 문자들(오늘 하나만 비어 있지 않다). */
  readonly closingMarks: string;
  /** 꼴 A면 리터럴 조사, 꼴 B면 null. */
  readonly literalParticle: string | null;
  /** 꼴 B면 조사를 고르는 함수 이름과 그 인자, 꼴 A면 null. */
  readonly chooser: { readonly name: string; readonly argument: string } | null;
  readonly verdict: ParticleVerdict;
};

const sweptFiles = listSweptFiles();
const chooserNames = particleChooserNames();

const ledgerKey = (file: string, expression: string, particle: string): string =>
  `${file}::${expression}::${particle}`;

const fixedTailByKey = new Map(
  FIXED_TAIL_LEDGER.map((entry) => [ledgerKey(entry.file, entry.expression, entry.particle), entry])
);

/** 조사 하나를 앞에서부터 읽는다 — `으로`가 `로`보다 먼저 서야 한다(긴 것 먼저). */
function readParticle(text: string): string | null {
  for (const pair of PARTICLE_PAIRS) {
    if (text.startsWith(pair.withBatchim)) return pair.withBatchim;
  }
  for (const pair of PARTICLE_PAIRS) {
    if (text.startsWith(pair.withoutBatchim)) return pair.withoutBatchim;
  }
  return null;
}

function pairOf(particle: string): (typeof PARTICLE_PAIRS)[number] | null {
  return PARTICLE_PAIRS.find((pair) => pair.withBatchim === particle || pair.withoutBatchim === particle) ?? null;
}

/** 종성 인덱스(0 = 받침 없음 · 8 = ㄹ). 한글 음절이 아니면 null. */
function finalConsonantIndex(word: string): number | null {
  const lastChar = word.trim().slice(-1);
  if (!lastChar) return null;
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28;
}

/** 그 꼬리 뒤에 서야 할 조사. ⚠️ `(으)로`만 받침 ㄹ에서 `로`로 떨어진다. */
function expectedParticle(tail: string, particle: string): string | null {
  const pair = pairOf(particle);
  if (pair === null) return null;
  const index = finalConsonantIndex(tail);
  if (index === null || index === 0) return pair.withoutBatchim;
  if (index === 8 && pair.rieulTakesWithoutForm) return pair.withoutBatchim;
  return pair.withBatchim;
}

/** ⓐ 모집단 — 손 목록이 아니라 전수 걷기에서 파생한다. */
function collectParticleSites(): ParticleSite[] {
  const sites: ParticleSite[] = [];
  for (const file of sweptFiles) {
    const code = maskComments(readSweptSource(file));
    const interpolations = interpolationsOf(code);
    for (let index = 0; index < interpolations.length; index += 1) {
      const current = interpolations[index];
      const after = code.slice(current.end + 1, current.end + 40);
      const marks = CLOSING_MARKS.exec(after);
      const closingMarks = marks === null ? "" : marks[0];
      const rest = after.slice(closingMarks.length);
      const line = lineOf(code, current.start);

      // 꼴 B — 조사가 값에서 나온다(`${name}${objectParticle(name)}`).
      if (rest.startsWith("${")) {
        const next = interpolations[index + 1];
        if (next === undefined) continue;
        const call = /^([A-Za-z0-9_$]+)\s*\((.*)\)$/.exec(next.expression.trim());
        if (call === null || !chooserNames.includes(call[1])) continue;
        sites.push({
          file,
          line,
          expression: current.expression.trim(),
          closingMarks,
          literalParticle: null,
          chooser: { name: call[1], argument: call[2].trim() },
          verdict: "chooses-from-value"
        });
        continue;
      }

      // 꼴 A — 조사가 리터럴로 붙어 있다.
      const particle = readParticle(rest);
      if (particle === null) continue;
      // ⚠️ 두 형태를 함께 적은 자리는 이 바늘 밖이다.
      if (BOTH_FORMS_SHAPE.test(rest.slice(particle.length))) continue;
      const expression = current.expression.trim();
      const known = fixedTailByKey.has(ledgerKey(file, expression, particle));
      sites.push({
        file,
        line,
        expression,
        closingMarks,
        literalParticle: particle,
        chooser: null,
        verdict: known ? "fixed-tail" : "varies-but-written-fixed"
      });
    }
  }
  return sites;
}

const particleSites = collectParticleSites();
const byVerdict = (verdict: ParticleVerdict): ParticleSite[] =>
  particleSites.filter((site) => site.verdict === verdict);

/** 두 형태를 함께 적은 자리 — 사각 ⓔ가 세는 수(이 바늘 밖이므로 따로 센다). */
function bothFormsSiteCount(): number {
  let count = 0;
  for (const file of sweptFiles) {
    const code = maskComments(readSweptSource(file));
    count += (code.match(/(을|를|이|가|은|는|과|와)\((을|를|이|가|은|는|과|와)\)/g) ?? []).length;
    count += (code.match(/\(으\)로/g) ?? []).length;
  }
  return count;
}

/** 이어 붙이기로 조사를 붙인 자리 — 사각 ⓐ가 세는 수. */
function concatenatedParticleCount(): number {
  let count = 0;
  for (const file of sweptFiles) {
    const code = maskComments(readSweptSource(file));
    count += (code.match(/\+\s*["'](을|를|이|가|은|는|과|와|으로|로)["']/g) ?? []).length;
  }
  return count;
}

/**
 * ⓕ-② **받침에 기대는 *호칭 접미사*가 서는 자리** — 라운드 93 리뷰가 사각으로 열고
 * 라운드 94 트랙 A가 **모집단으로 승격**한 자다.
 *
 * ⚠️ **조사가 아니라 접미사다.** `-네`("김가네" · "지훈이네")는 조사가 아니라 가구를 부르는
 * 접미사인데 **받침으로 갈리는 것은 조사와 똑같다**: 받침이 있으면 사이에 `이`가 든다
 * ("지훈**이**네"), 없으면 바로 붙는다("민수네"). 조사 바늘(`PARTICLE_PAIRS`)은 조사만 알아서
 * 이 자리를 **한 자리도 보지 못한다** — 그래서 조사 모집단과 **나란한 모집단**을 따로 걷는다.
 *
 * ⚠️⚠️ **그래서 이 자는 값을 grep으로 세지 않고 스윕과 같은 마스킹 규율로 파생한다** —
 * 주석을 걷어 낸 코드에서 ⓐ `}` 바로 뒤의 `네`(**꼴 A** — 리터럴로 붙은 것)와 ⓑ 접미사를 고르는
 * 함수의 호출(**꼴 B** — 값에서 고르는 것)을 함께 센다. 주석을 걷지 않으면 그 화면의 주석이
 * 자리로 잘못 세어진다(오늘 실제로 `more.tsx`가 그 꼴을 주석 **둘**에 적고 있다).
 *
 * ⚠️ **꼴 A와 꼴 B가 같은 모집단인 이유는 조사 쪽과 똑같다** — 고치는 손이 모집단을 줄이지
 * 못하게 하려는 것이다(트랙 A가 셋을 고치는 순간 그 셋이 사라지면 래칫이 물 것이 없어진다).
 */
type HonorificSuffixVerdict = "chooses-from-value" | "varies-but-written-fixed";

type HonorificSuffixSite = {
  readonly file: string;
  readonly line: number;
  /** 그 접미사가 서는 표면 — 낭독 라벨(문자열 안)인가, 보이는 줄(JSX 텍스트)인가. */
  readonly surface: "낭독 라벨" | "보이는 줄";
  /** 꼴 B면 접미사를 고르는 함수 이름, 꼴 A면 null. */
  readonly chooser: string | null;
  readonly verdict: HonorificSuffixVerdict;
};

/**
 * ⚠️ **접미사를 고르는 함수의 이름도 손으로 적지 않는다** — 조사 쪽(`particleChooserNames`)과
 * 같은 규율로 소스에서 파생한다. 오늘 하나(`nameWithHonorificSuffix`).
 */
function honorificSuffixChooserNames(): string[] {
  const found: string[] = [];
  for (const file of sweptFiles) {
    const code = maskComments(readSweptSource(file));
    for (const matched of code.matchAll(/export function ([A-Za-z0-9_$]*HonorificSuffix)\s*\(/g)) {
      found.push(matched[1]);
    }
  }
  return [...new Set(found)].sort();
}

const suffixChooserNames = honorificSuffixChooserNames();

/**
 * ⚠️ **규칙이 사는 파일은 *자리*가 아니다.** 접미사 함수의 본문은 `` `${name}${linker}네` `` 라
 * 꼴 A의 바늘(`}네`)에 스스로 걸린다 — 그것은 화면 문구가 아니라 **규칙 자체**이므로 모집단에서
 * 뺀다(조사 쪽에서 `korean-particles.ts`의 `"을"`·`"과"`가 모집단 밖인 것과 같은 이유다).
 * ⚠️ 이 목록도 손이 아니라 **소스에서 파생한다** — 접미사 함수를 `export`하는 파일 전수다.
 * ⚠️ **사각(라운드 94 리뷰 L-1)**: 이 배제는 *규칙이 사는 줄*이 아니라 **파일을 통째로** 뺀다 —
 * 그 파일이 언젠가 화면 문구도 함께 지면 그 자리는 조용히 안 보인다(오차의 방향은 **거짓 초록**).
 * 오늘 그 파일은 하나이고 순수 규칙만 들어 무해하다(`suffixChooserFiles`가 그 하나를 값으로 문다).
 */
function honorificSuffixModuleFiles(): string[] {
  return sweptFiles.filter((file) =>
    /export function [A-Za-z0-9_$]*HonorificSuffix\s*\(/.test(maskComments(readSweptSource(file)))
  );
}

const suffixChooserFiles = honorificSuffixModuleFiles();

/** 짝이 맞는 `)`의 자리. ⚠️ **존재 가드** — 짝이 없으면 `null`(잘린 소스에서 유령 자리를 만들지 않는다). */
function matchingParen(code: string, openAt: number): number | null {
  if (code[openAt] !== "(") return null;
  let depth = 0;
  let quote: string | null = null;
  for (let index = openAt; index < code.length; index += 1) {
    const char = code[index];
    if (quote !== null) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

const EXPORT_FUNCTION_PREFIX = "export function ";

function honorificSuffixSites(): HonorificSuffixSite[] {
  const found: HonorificSuffixSite[] = [];
  for (const file of sweptFiles) {
    // ⚠️ 규칙이 사는 파일은 자리가 아니다(위 `honorificSuffixModuleFiles`의 근거).
    if (suffixChooserFiles.includes(file)) continue;
    const code = maskComments(readSweptSource(file));

    // 꼴 A — 접미사가 리터럴로 붙었다(`}네`). ⚠️ 오늘 0건이고, 다시 서는 날 상한이 빨개진다.
    for (let at = code.indexOf("}네"); at !== -1; at = code.indexOf("}네", at + 1)) {
      // ⚠️ 존재 가드 — 파일 끝에서는 뒤 글자가 없다(`slice`는 빈 문자열을 낸다).
      const next = at + 2 < code.length ? code[at + 2] : "";
      found.push({
        file,
        line: lineOf(code, at),
        surface: next === "<" ? "보이는 줄" : "낭독 라벨",
        chooser: null,
        verdict: "varies-but-written-fixed"
      });
    }

    // 꼴 B — 접미사를 값에서 고른다(`nameWithHonorificSuffix(nickname)`).
    for (const name of suffixChooserNames) {
      const needle = `${name}(`;
      for (let at = code.indexOf(needle); at !== -1; at = code.indexOf(needle, at + 1)) {
        // ⚠️ 정의 자체는 *자리*가 아니다 — 순수 모듈의 `export function` 한 줄을 세지 않는다.
        const before = code.slice(Math.max(0, at - EXPORT_FUNCTION_PREFIX.length), at);
        if (before === EXPORT_FUNCTION_PREFIX) continue;
        const end = matchingParen(code, at + needle.length - 1);
        // ⚠️ 존재 가드 — 짝이 없으면 이 자리는 없던 것으로 한다.
        if (end === null) continue;
        found.push({
          file,
          line: lineOf(code, at),
          surface: code.slice(end + 1, end + 3) === "}<" ? "보이는 줄" : "낭독 라벨",
          chooser: name,
          verdict: "chooses-from-value"
        });
      }
    }
  }
  return found.sort((left, right) => (left.file === right.file ? left.line - right.line : left.file < right.file ? -1 : 1));
}

function koreanLiteralCount(code: string): number {
  return (code.match(/["'`][^"'`]*[가-힣][^"'`]*["'`]/g) ?? []).length;
}

// ───────────────────────────────────────────────────────────────────────────────
// ① 순수 함수의 값 — 받침 판정을 표로 못 박는다.
// ───────────────────────────────────────────────────────────────────────────────

describe("ⓒ 순수 함수 — 받침에서 조사가 갈린다(표로 못 박는다)", () => {
  it("받침 있는 음절로 끝나면 `을`·`과`다", () => {
    for (const name of ["지훈", "하율", "사랑", "김가람", "첫돌"]) {
      expect(hasFinalConsonant(name), `${name}: 받침이 있다`).toBe(true);
      expect(objectParticle(name)).toBe("을");
      expect(withParticle(name)).toBe("과");
      // 라운드 96 T5: 주격도 같은 판정 하나를 지난다.
      expect(subjectParticle(name)).toBe("이");
    }
    // 라운드 96 T5: (으)로만 ㄹ 예외가 있다 — 받침 ㄹ("첫돌")은 `로`, 그 밖의 받침은 `으로`.
    expect(directionParticle("지훈")).toBe("으로");
    expect(directionParticle("첫돌")).toBe("로");
  });

  it("받침 없는 음절로 끝나면 `를`·`와`다", () => {
    for (const name of ["서아", "가네", "다온이", "김가네", "유주"]) {
      expect(hasFinalConsonant(name), `${name}: 받침이 없다`).toBe(false);
      expect(objectParticle(name)).toBe("를");
      expect(withParticle(name)).toBe("와");
      // 라운드 96 T5: 주격·방향도 같은 갈래로 떨어진다.
      expect(subjectParticle(name)).toBe("가");
      expect(directionParticle(name)).toBe("로");
    }
  });

  it("⚠️ 한글이 아닌 끝(라틴·숫자·이모지)에서는 판정이 서지 않고, **받침 없는 형**으로 떨어진다", () => {
    for (const name of ["Ben", "둘째2", "🐣", "kim", "!!"]) {
      expect(hasFinalConsonant(name), `${name}: 판정이 서지 않는다`).toBeNull();
      // ⚠️ 이 답은 관례이지 문법이 아니다(사각 `non-hangul-tail-is-convention-not-grammar`).
      expect(objectParticle(name)).toBe("를");
      expect(withParticle(name)).toBe("와");
      // 라운드 96 T5: 주격·방향도 같은 관례를 따른다(가 · 로).
      expect(subjectParticle(name)).toBe("가");
      expect(directionParticle(name)).toBe("로");
    }
  });

  it("빈 값·공백만 있는 값에서도 터지지 않고 같은 답으로 떨어진다", () => {
    for (const name of ["", "   ", "\n"]) {
      expect(hasFinalConsonant(name)).toBeNull();
      expect(objectParticle(name)).toBe("를");
      expect(withParticle(name)).toBe("와");
    }
  });

  it("앞뒤 공백은 판정 전에 걷는다 — 화면이 `trim()`을 잊어도 조사는 이름을 본다", () => {
    expect(hasFinalConsonant("  지훈  ")).toBe(true);
    expect(objectParticle(" 지훈 ")).toBe("을");
    expect(withParticle(" 서아 ")).toBe("와");
  });

  it("⚠️⚠️ 자모가 분해된 이름(NFD)에서도 판정이 선다 (라운드 94 리뷰 M-6 · 교란)", () => {
    // ⚠️ **교란**: 같은 "지훈"이라도 분해형은 마지막 글자가 음절이 아니라 **자모**(`U+11AB`)라,
    // 정규화 전에는 판정이 `null`로 떨어져 받침 있는 이름이 조용히 `를`·`와`로 갈렸다.
    const decomposed = "지훈".normalize("NFD");
    expect(decomposed, "픽스처가 실제로 분해형이다(유령 방지)").not.toBe("지훈");
    expect([...decomposed]).toHaveLength(5);
    expect(hasFinalConsonant(decomposed), "분해형에서도 받침이 보인다").toBe(true);
    expect(objectParticle(decomposed)).toBe("을");
    expect(withParticle(decomposed)).toBe("과");
    // 받침 없는 쪽도 *물을 수 없다*가 아니라 **없다**로 떨어진다(세 갈래가 뭉개지지 않는다).
    expect(hasFinalConsonant("서아".normalize("NFD"))).toBe(false);
    expect(objectParticle("서아".normalize("NFD"))).toBe("를");
  });

  it("⚠️⚠️ 저장소의 옛 답(`src/home/baby-counter.ts`)과 **한 자리도 다르지 않다**", () => {
    // 두 모듈이 갈리는 날 이 자가 먼저 빨개진다(옮겨 적은 규칙이 조용히 갈리지 않게).
    for (const name of ["지훈", "서아", "하율", "가네", "Ben", "둘째2", "🐣", "", "첫돌", "100일"]) {
      expect(hasFinalConsonant(name), `${name}: 받침 판정`).toBe(babyCounterHasFinalConsonant(name));
      expect(objectParticle(name), `${name}: 을/를`).toBe(babyCounterObjectParticle(name));
      expect(withParticle(name), `${name}: 과/와`).toBe(babyCounterWithParticle(name));
    }
  });

  it("⚠️⚠️ 두 벌이 오늘 **정규화 한 줄만큼** 갈렸다는 사실을 값으로 적는다 (라운드 94 리뷰 M-6)", () => {
    // ⚠️ **두 시점.** ① 라운드 93 트랙 B 시점: 두 벌이 *한 글자도 다르지 않았다*(위 표가 그 등호다).
    // ② 오늘: 리뷰가 `korean-particles.ts`의 `hasFinalConsonant`에만 `NFC` 정규화를 걸었다 —
    // `baby-counter.ts`는 **이 라운드에서도 읽기만 하는 파일**이라(그 파일의 소유가 이 트랙이 아니다)
    // 옮겨 적은 규칙이 처음으로 갈렸다. ⚠️ **숨기지 않고 값으로 적는다** — 위 표(NFC 이름 열)는
    // 여전히 등호로 서고, 갈리는 곳은 **분해형 입력 하나**다.
    const decomposed = "지훈".normalize("NFD");
    expect(hasFinalConsonant(decomposed), "이쪽은 정규화한다").toBe(true);
    expect(babyCounterHasFinalConsonant(decomposed), "그쪽은 오늘도 정규화하지 않는다").toBeNull();
    expect(babyCounterObjectParticle(decomposed), "그래서 태명 문구는 아직 받침 없는 형으로 떨어진다").toBe("를");
    // ⚠️ **다시 등호가 되는 날**(사건형): 분해형 태명이 홈 카운터 문구에서 실제로 보고되거나, 두 벌을
    // 한 벌로 합치는 라운드가 서는 날 — 그날 이 자는 등호로 돌아가고, 첫 모집단은 이 한 갈래다.
    // ⚠️ 이 줄은 **표기 꼴을 일부러 쓰지 않는다** — 재개 조건 대장의 소스 축은 이 파일도 걷으므로,
    // 리뷰가 조건 하나를 새로 세우면 그쪽 수가 함께 움직인다(고치는 손이 옆 대장을 흔들지 않는다).
    expect(babyCounterWithParticle(decomposed)).toBe("와");
  });

  it("⚠️ `(으)로`의 ㄹ 예외가 이 계약의 자에 들어 있다 — 받침 ㄹ은 `로`다", () => {
    expect(finalConsonantIndex("첫돌")).toBe(8);
    expect(expectedParticle("첫돌", "으로")).toBe("로");
    expect(expectedParticle("원", "으로")).toBe("으로");
    expect(expectedParticle("메모", "로")).toBe("로");
    // ㄹ 예외는 `(으)로`에만 있다 — 을/를은 받침 ㄹ에서도 `을`이다.
    expect(expectedParticle("첫돌", "을")).toBe("을");
    expect(expectedParticle("100일", "이")).toBe("이");
    // 라운드 96 T5: 규칙 모듈(`directionParticle`)과 이 자가 같은 예외를 안다 — 갈리면 여기가 빨개진다.
    for (const word of ["첫돌", "서울", "원", "메모", "지훈", "Ben"]) {
      expect(directionParticle(word), `${word}: (으)로`).toBe(expectedParticle(word, "으로"));
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// ② 소스 스윕 — 모집단은 걷기에서 파생한다.
// ───────────────────────────────────────────────────────────────────────────────

describe("마스킹 — 이 자가 무엇을 걷는지 픽스처가 보여 준다", () => {
  const fixture = [
    "// `${name}를 추가했어요.`",
    'const quoted = "${name}를 추가했어요.";',
    "/* `${name}과 함께해요.` */",
    "const real = `${name}를 추가했어요.`;"
  ].join("\n");

  it("주석은 걷고 코드는 남긴다 — 그리고 길이가 보존된다", () => {
    const masked = maskComments(fixture);
    expect(masked).toHaveLength(fixture.length);
    // 주석 안의 보간은 사라지고, 코드와 문자열 안의 보간은 남는다.
    expect(interpolationsOf(masked)).toHaveLength(2);
  });

  it("문자열까지 걷는 걸음은 인용된 자리를 세지 않는다", () => {
    const masked = maskComments(fixture, { strings: true });
    expect(masked).toHaveLength(fixture.length);
    expect(interpolationsOf(masked)).toHaveLength(0);
  });

  it("⚠️ 공백을 닫는 문자로 세지 않는다 — 그러지 않으면 낱말이 조사로 읽힌다", () => {
    // 실제 소스에서 걸러 낸 모양들(`${label} 이하` · `${…} 이 기기` · `‘${text}’ 가구`).
    expect(CLOSING_MARKS.exec("’ 가구")?.[0]).toBe("’");
    expect(readParticle(" 가구")).toBeNull();
    expect(readParticle(" 이하")).toBeNull();
    expect(readParticle("이 있는 날짜")).toBe("이");
  });

  it("⚠️⚠️ **긴 것 먼저** — 계사 `이에요`가 `이`에 먹히지 않는다 (라운드 93 리뷰 M-6)", () => {
    // ⚠️ 이 순서가 뒤집히면 아래 넷이 다시 `이`로 읽히고 대장 셋이 유령 줄이 된다.
    const withBatchimForms = PARTICLE_PAIRS.map((pair) => pair.withBatchim);
    // 존재 가드 — 둘 다 목록에 있어야 순서를 물을 수 있다(-1끼리 비교하면 항진명제가 된다).
    expect(withBatchimForms).toContain("이에요");
    expect(withBatchimForms).toContain("이");
    expect(withBatchimForms.indexOf("이에요")).toBeLessThan(withBatchimForms.indexOf("이"));
    // ⚠️ `으로`/`로`는 **같은 목록 안의 순서가 아니라 두 고리의 순서**가 지킨다 —
    // `readParticle`이 `withBatchim` 전수를 먼저 훑고 그다음에야 `withoutBatchim`을 본다.
    expect(withBatchimForms).toContain("으로");
    expect(PARTICLE_PAIRS.map((pair) => pair.withoutBatchim)).toContain("로");
    expect(readParticle("으로 전환")).toBe("으로");

    // 바늘이 실제로 긴 것을 고른다.
    expect(readParticle("이에요.")).toBe("이에요");
    expect(readParticle("예요.")).toBe("예요");
    // 그리고 `이`는 여전히 `이`다(계사가 아닌 자리를 먹지 않는다).
    expect(readParticle("이 있는 날짜")).toBe("이");

    // 받침으로 갈린다는 것도 순수 함수가 말한다 — 이 쌍이 이 모집단에 들어온 이유다.
    expect(expectedParticle("동기화 중", "이에요")).toBe("이에요");
    expect(expectedParticle("첫돌", "이에요")).toBe("이에요");
    expect(expectedParticle("소파", "이에요")).toBe("예요");
  });
});

describe("ⓐ 모집단 — 전수에서 파생한다(손 목록 금지)", () => {
  it("스윕 경계가 값으로 서 있다 — 이 파일은 저장소 그물 열다섯의 하나가 아니다", () => {
    expect(SWEEP_SCOPE_LABEL).toBe("apps/mobile/{app,src}/**");
    expect([...SWEEP_ROOTS]).toEqual(["app", "src"]);
    expect(sweptFiles.every((file) => file.startsWith("app/") || file.startsWith("src/"))).toBe(true);
    expect(sweptFiles.some((file) => file.includes("node_modules"))).toBe(false);
    // 어드민·api·packages는 뿌리 밖이라 세는 자리가 구조적으로 0건이다.
    expect(sweptFiles.filter((file) => file.includes("apps/admin") || file.includes("packages/"))).toEqual([]);
  });

  it("⚠️ 앵커 대장의 사각이 이 파일 때문에 하나 오른다는 사실이 머리말에 값으로 있다", () => {
    expect(ANCHOR_LEDGER_NOTE).toContain("helper-named-reader");
    expect(ANCHOR_LEDGER_NOTE).toContain("166");
    expect(ANCHOR_LEDGER_NOTE).toContain("부채가 아니라");
  });

  it("유령 방지 — 모집단이 0건이 아니고 정찰의 하한을 넘는다", () => {
    expect(sweptFiles.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.sweptFiles);
    expect(particleSites.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.particleSites);
    for (const site of particleSites) {
      expect(site.line).toBeGreaterThan(0);
      expect(sweptFiles).toContain(site.file);
      expect(site.expression.length).toBeGreaterThan(0);
    }
  });

  it("⚠️ 조사를 고르는 함수 이름도 소스에서 파생한다 — 손으로 적지 않는다", () => {
    // ⚠️ **두 시점(라운드 96 T5)**: 트랙 B~라운드 94 시점 이 목록은 둘(`objectParticle` ·
    // `withParticle`)이었다. T5가 괄호 표기 여섯 중 다섯을 값에서 고르는 꼴로 이관하며 둘을
    // 더 세웠다 — 주격(`subjectParticle` · 이/가)과 방향(`directionParticle` · (으)로, ㄹ 예외 포함).
    // 전부 `text/korean-particles.ts`가 지고, `home/baby-counter.ts`의 옛 두 벌은 그대로다.
    expect(chooserNames).toEqual(["directionParticle", "objectParticle", "subjectParticle", "withParticle"]);
    expect(maskComments(readSweptSource("src/text/korean-particles.ts"))).toContain("export function objectParticle(");
    expect(maskComments(readSweptSource("src/text/korean-particles.ts"))).toContain("export function subjectParticle(");
    expect(maskComments(readSweptSource("src/text/korean-particles.ts"))).toContain("export function directionParticle(");
    expect(maskComments(readSweptSource("src/home/baby-counter.ts"))).toContain("export function withParticle(");
  });

  it("⚠️⚠️ 새 `export const`가 0건이다 — 새 순수 모듈은 `export function`만 세운다", () => {
    const module = maskComments(readSweptSource("src/text/korean-particles.ts"));
    expect(module).not.toContain("export const");
    // ⚠️ **두 시점 · 등호가 아니라 하한**: 트랙 B 커밋 시점 **셋**(hasFinalConsonant · objectParticle ·
    // withParticle) → 라운드 94 트랙 A가 접미사 함수 하나를 더해 오늘 **넷**이다. 이 자가 무는 것은
    // *몇 개인가*가 아니라 **`export const`가 0건이라는 사실**이므로, 함수가 느는 쪽으로는 빨개지지
    // 않는다(사문 대장의 절반 문턱 여유가 0이라 `export const`만 상한 0으로 남는다).
    expect((module.match(/export function /g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("⚠️ 새 순수 모듈은 화면을 import하지 않는다 — 문구가 아니라 규칙만 든다", () => {
    const module = maskComments(readSweptSource("src/text/korean-particles.ts"));
    expect(module).not.toContain("import ");
    expect(module).not.toContain("react-native");
  });
});

describe("ⓑ 판정 셋 — 자리마다 소스에서 하나가 나온다", () => {
  it("모든 자리가 셋 중 하나로 갈리고, 셋의 합이 모집단이다", () => {
    const verdicts: ParticleVerdict[] = ["fixed-tail", "chooses-from-value", "varies-but-written-fixed"];
    for (const site of particleSites) expect(verdicts).toContain(site.verdict);
    expect(
      byVerdict("fixed-tail").length + byVerdict("chooses-from-value").length + byVerdict("varies-but-written-fixed").length
    ).toBe(particleSites.length);
  });

  it("⚠️⚠️ 트랙 뒤 — **갈리는데 고정으로 적은 자리가 0건이다**", () => {
    const offenders = byVerdict("varies-but-written-fixed").map(
      (site) => `${site.file}:${site.line} \${${site.expression}}${site.literalParticle ?? ""}`
    );
    expect(offenders).toEqual([]);
  });

  it("*값의 꼬리가 고정이라 갈리지 않는* 자리가 정찰의 스물아홉을 넘고, 자리마다 대장에 줄이 있다", () => {
    const fixed = byVerdict("fixed-tail");
    expect(fixed.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.fixedTailSites);
    for (const site of fixed) {
      const entry = fixedTailByKey.get(ledgerKey(site.file, site.expression, site.literalParticle ?? ""));
      expect(entry, `${site.file}:${site.line} 대장 줄`).toBeDefined();
      expect(entry?.tails.length).toBeGreaterThan(0);
    }
  });

  it("⚠️ 대장에 유령 줄이 없다 — 모든 줄이 오늘 실재하는 자리를 가리킨다", () => {
    const usedKeys = new Set(
      byVerdict("fixed-tail").map((site) => ledgerKey(site.file, site.expression, site.literalParticle ?? ""))
    );
    const unused = FIXED_TAIL_LEDGER.filter(
      (entry) => !usedKeys.has(ledgerKey(entry.file, entry.expression, entry.particle))
    ).map((entry) => `${entry.file} \${${entry.expression}}${entry.particle}`);
    expect(unused).toEqual([]);
    expect(new Set(FIXED_TAIL_LEDGER.map((entry) => ledgerKey(entry.file, entry.expression, entry.particle))).size).toBe(
      FIXED_TAIL_LEDGER.length
    );
  });

  it("⚠️⚠️ 대장의 꼬리는 산문이 아니라 **소스 바이트**다 — 근거가 오늘도 그 파일에 있다", () => {
    for (const entry of FIXED_TAIL_LEDGER) {
      expect(sweptFiles, `${entry.evidenceFile}: 근거 파일이 모집단 안에 있다`).toContain(entry.evidenceFile);
      const evidenceSource = readSweptSource(entry.evidenceFile);
      for (const line of entry.evidence) {
        expect(evidenceSource, `${entry.file}: 근거 "${line}"가 사라졌다`).toContain(line);
      }
      // 꼬리가 정말 **값의 끝**이다 — 근거 안에서 따옴표/백틱 바로 앞에 서 있다.
      for (const tail of entry.tails) {
        const standsAtEnd = entry.evidence.some(
          (line) => line.includes(`${tail}"`) || line.includes(`${tail}\``) || line.includes(`${tail}'`)
        );
        expect(standsAtEnd, `${entry.file}: "${tail}"가 값의 끝이 아니다`).toBe(true);
      }
      if (entry.aliasEvidence !== undefined) {
        // 이름을 되짚는 한 걸음도 소스에 실재한다(사각 ⓑ).
        expect(readSweptSource(entry.file), `${entry.file}: 별칭 근거`).toContain(entry.aliasEvidence);
      }
    }
  });

  it("⚠️⚠️ 그 꼬리들이 실제로 그 조사를 부른다 — 순수 함수가 대장을 다시 판정한다", () => {
    const mismatched: string[] = [];
    for (const entry of FIXED_TAIL_LEDGER) {
      // ⚠️ 닫는 문자가 낀 자리는 조사가 값이 아니라 괄호 뒤에 온다 — 아래 사각이 따로 문다.
      const sites = byVerdict("fixed-tail").filter(
        (site) => ledgerKey(site.file, site.expression, site.literalParticle ?? "") === ledgerKey(entry.file, entry.expression, entry.particle)
      );
      if (sites.every((site) => site.closingMarks.length > 0)) continue;
      for (const tail of entry.tails) {
        const expected = expectedParticle(tail, entry.particle);
        if (expected !== entry.particle) mismatched.push(`${entry.file} "${tail}" → ${expected} (적힌 것: ${entry.particle})`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("*값에서 조사를 고르는* 자리가 아홉이고, **조사가 바로 그 값을 본다**", () => {
    const choosing = byVerdict("chooses-from-value");
    expect(choosing.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.choosingSites);
    for (const site of choosing) {
      expect(site.chooser).not.toBeNull();
      // ⚠️ 유령 방지 — `${a}${objectParticle(b)}`처럼 **다른 값**을 보는 자리가 없다.
      expect(site.chooser?.argument, `${site.file}:${site.line}: 조사가 다른 값을 본다`).toBe(site.expression);
      expect(chooserNames).toContain(site.chooser?.name ?? "");
    }
  });
});

describe("ⓒ 오늘 고치는 그 넷 — 사용자가 지은 값 뒤의 자리를 이름으로 못 박는다", () => {
  it("넷이 전부 `chooses-from-value`이고, 파일·값·고르는 함수가 대장과 같다", () => {
    expect(USER_NAMED_VALUE_SITES).toHaveLength(4);
    for (const entry of USER_NAMED_VALUE_SITES) {
      const matched = byVerdict("chooses-from-value").filter(
        (site) => site.file === entry.file && site.expression === entry.value && site.chooser?.name === entry.chooser
      );
      expect(matched.length, `${entry.file}: \${${entry.value}} 자리`).toBeGreaterThan(0);
    }
  });

  it("⚠️⚠️ 두 화면에 고정 조사가 한 자리도 남지 않았다", () => {
    for (const file of ["app/settings/children.tsx", "app/family/accept/[token].tsx"]) {
      expect(particleSites.filter((site) => site.file === file && site.literalParticle !== null)).toEqual([]);
    }
    expect(readSweptSource("app/settings/children.tsx")).not.toContain("}를 추가");
    expect(readSweptSource("app/family/accept/[token].tsx")).not.toContain("}과 함께해요");
  });

  it("아이 추가는 **보이는 토스트와 낭독이 같은 값·같은 조사**를 지난다", () => {
    const code = maskComments(readSweptSource("app/settings/children.tsx"));
    expect(code).toContain("const addedName = input.values.nickname.trim();");
    expect(code).toContain("const addedNotice = `${addedName}${objectParticle(addedName)} 추가했어요.`;");
    expect(code).toContain('showToast(`${addedNotice}${switchNotice}`, "success");');
    expect(code).toContain("announceForA11y(`${addedName}${objectParticle(addedName)} 추가하고 선택했어요.${switchNotice}`);");
    // 이름을 두 번 `trim()`하지 않는다 — 두 문장이 갈릴 자리가 없다.
    expect((code.match(/input\.values\.nickname\.trim\(\)/g) ?? []).length).toBe(1);
  });

  it("초대 수락 착지는 **판정 갈래와 화면 갈래**가 같은 조사를 지난다", () => {
    const code = maskComments(readSweptSource("app/family/accept/[token].tsx"));
    expect(code).toContain(
      "const joinedText = `${result.household.name}${withParticle(result.household.name)} 함께해요.`;"
    );
    expect(code).toContain(
      "{`${joinedResult.household.name}${withParticle(joinedResult.household.name)} 함께해요.`}"
    );
    expect((code.match(/withParticle\(/g) ?? []).length).toBe(2);
  });
});

describe("ⓓ 바이트 불변 — 바뀐 것은 조사 한 글자씩 넷뿐이다(부정 단언)", () => {
  it("⚠️⚠️ 옛 문장은 *옛 조사 + 오늘의 꼬리*와 정확히 같다 — 낱말·어순·마침표가 그대로다", () => {
    for (const entry of USER_NAMED_VALUE_SITES) {
      expect(`${entry.previousParticle}${entry.tailAfterParticle}`).toBe(entry.previousSentence);
      expect(readSweptSource(entry.file), `${entry.file}: 오늘의 꼬리`).toContain(entry.tailAfterParticle);
      // 그리고 옛 문장(고정 조사가 붙은 꼴)은 소스에서 사라졌다.
      expect(maskComments(readSweptSource(entry.file))).not.toContain(`}${entry.previousSentence}`);
    }
  });

  it("새 한국어 낱말 0건 — 두 화면의 한국어 리터럴 수가 트랙 전과 같다", () => {
    for (const entry of KOREAN_LITERAL_LEDGER) {
      expect(koreanLiteralCount(maskComments(readSweptSource(entry.file))), entry.file).toBe(entry.count);
    }
  });

  it("⚠️ 저장소가 이미 고른 답 셋(고정 꼬리)을 이 트랙이 건드리지 않았다", () => {
    // 그 셋이 이 트랙의 **근거**다 — 바이트가 그대로여야 근거가 산다.
    expect(readSweptSource("src/family/household-scope.ts")).toContain("`‘${text}’ 가구`");
    expect(readSweptSource("app/family/index.tsx")).toContain("`${roleLabel} 초대`");
    expect(readSweptSource("src/offline/messages.ts")).toContain("`기록 ${count}건`");
    // 그리고 그 셋은 오늘도 `fixed-tail`로 서 있다.
    for (const file of ["src/family/household-scope.ts", "app/family/index.tsx", "src/offline/messages.ts"]) {
      expect(byVerdict("fixed-tail").filter((site) => site.file === file).length).toBeGreaterThan(0);
    }
  });

  it("⚠️ `app/expenses/new.tsx`는 주석 한 문단만 바뀌었다 — AG-4의 거짓 인용이 두 시점으로 적혀 있다", () => {
    const raw = readSweptSource("app/expenses/new.tsx");
    // ① 옛 문장을 지우지 않았다.
    expect(raw).toContain("품목명 칸의 `itemNameInputRef`와 같은 관례다");
    // ② 오늘의 정정 — 언제 쓰였고, 왜 거짓이며, 오늘의 사실이 무엇인지.
    expect(raw).toContain("두 시점");
    expect(raw).toContain("bbf1d97");
    expect(raw).toContain("32e1648");
    expect(raw).toContain("쓰인 날 이미 거짓이었다");
    expect(raw).toContain("서로 반대");
    // ③ 그 사실이 소스와 맞는다 — `itemNameInputRef`는 정말 포커스를 주는 데 둘 쓰인다.
    const code = maskComments(raw);
    expect((code.match(/itemNameInputRef\.current\?\.focus\(\)/g) ?? []).length).toBe(2);
    expect(code).not.toContain("merchantInputRef.current?.focus()");
    expect(code).toContain("merchantInputRef.current?.blur();");
  });

  it("⚠️⚠️ 그 정정이 든 좌표가 오늘도 참이다 — **인용이 인용당한 자리를 따라간다**(AG-4의 처방)", () => {
    const raw = readSweptSource("app/expenses/new.tsx");
    const code = maskComments(raw);
    // 주석을 걷은 뒤의 자리 둘 — 소스에서 파생한다(손으로 적지 않는다).
    const lines: number[] = [];
    for (const matched of code.matchAll(/itemNameInputRef\.current\?\.focus\(\)/g)) {
      lines.push(lineOf(code, matched.index));
    }
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(
        raw,
        `AG-4 정정 문단이 \`:${line}\`을 들고 있지 않다 — 그 문단의 좌표 둘을 오늘의 ${lines.join("·")}로 옮겨 적어라(AG-5의 규율: 인용은 인용당한 자리를 따라간다)`
      ).toContain(`\`:${line}\``);
    }
    // ⚠️ 옛 좌표도 지우지 않는다 — AG-4가 그 둘을 집은 시점이 값이다.
    expect(raw).toContain("`:1561`");
    expect(raw).toContain("`:2290`");
  });
});

describe("ⓔ 래칫 — 되돌리면 빨개진다", () => {
  it("모집단은 줄지 않는다(하한) · 고정으로 적은 자리는 0을 상한으로 한다", () => {
    expect(particleSites.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.particleSites);
    expect(byVerdict("varies-but-written-fixed").length).toBeLessThanOrEqual(0);
    expect(byVerdict("chooses-from-value").length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.choosingSites);
  });

  it("⚠️ 고치는 쪽이 모집단을 줄이지 못한다 — 꼴 A와 꼴 B가 **같은 모집단**이다", () => {
    // 넷을 고정 조사로 되돌리면 꼴 B가 아홉에서 다섯으로 내려가며 위 하한이 깨지고,
    // 동시에 그 넷이 `varies-but-written-fixed`로 떨어져 상한도 깨진다(두 자가 함께 문다).
    const shapeA = particleSites.filter((site) => site.literalParticle !== null).length;
    const shapeB = particleSites.filter((site) => site.chooser !== null).length;
    expect(shapeA + shapeB).toBe(particleSites.length);
    expect(shapeB).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.choosingSites);
  });
});

describe("ⓕ 사각 — 이 스윕이 못 보는 것을 값과 하한으로 적는다", () => {
  // ⚠️ **두 시점**: 트랙 B 커밋 시점 **여섯** → 라운드 93 리뷰(M-5)가 `suffix-not-particle`을
  // 더해 오늘 **일곱**이다. **하한 넷은 올리지 않는다**(사각을 정직하게 닫는 손이 빨강을 맞지
  // 않게 하려는 것이고, 늘어난 수는 아래 첫 단언이 아니라 이 주석이 진다).
  it("사각 일곱이 이유와 재개 조건을 함께 진다 (트랙 B 시점 여섯 · 하한 넷)", () => {
    // ⚠️ 등호가 아니라 **하한**이다 — 사각을 더 여는 손이 빨강을 맞으면 아무도 열지 않는다.
    expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(4);
    for (const spot of BLIND_SPOTS) {
      expect(spot.id.length).toBeGreaterThan(0);
      expect(spot.reason.length).toBeGreaterThan(60);
      expect(spot.resumeCondition).toContain("재개 조건");
      expect(spot.measure).toBeGreaterThanOrEqual(spot.floor);
    }
    expect([...new Set(BLIND_SPOTS.map((spot) => spot.id))]).toHaveLength(BLIND_SPOTS.length);
  });

  it("이어 붙이기로 붙인 조사는 이 바늘 밖이라는 사실이 값으로 서 있다 (오늘 0건)", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "concatenated-not-interpolated");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("거짓 초록");
    expect(concatenatedParticleCount()).toBe(spot?.measure ?? -1);
    // 그리고 그 바늘이 유령이 아니다 — 픽스처에서는 실제로 잡는다.
    expect(maskComments('const s = name + "를";').match(/\+\s*["'](을|를)["']/g)).toHaveLength(1);
  });

  it("⚠️ 꼬리를 **한 걸음**만 따라간다는 사실과 오차의 방향이 값으로 적혀 있다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "tail-followed-one-step-only");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("거짓 빨강");
    // 근거가 자리 파일 밖에 있는 줄 수 — 걸음이 실제로 파일을 건너간 자리다.
    const crossFile = FIXED_TAIL_LEDGER.filter((entry) => entry.evidenceFile !== entry.file).length;
    expect(crossFile).toBe(spot?.measure ?? -1);
  });

  it("⚠️ 한글이 아닌 끝의 답은 관례이지 문법이 아니라는 사실이 값으로 적혀 있다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "non-hangul-tail-is-convention-not-grammar");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("baby-counter.ts:87-89");
    expect(spot?.resumeCondition).toContain("보고되는 날");
    // 그 관례가 소스에 실재한다 — 두 모듈이 같은 답을 적어 두었다.
    expect(readSweptSource("src/home/baby-counter.ts")).toContain("받침 없는 형태");
    expect(readSweptSource("src/text/korean-particles.ts")).toContain("받침 없는 형");
  });

  it("⚠️⚠️ 두 형태를 함께 적은 자리는 이 바늘 밖이라는 사실이 값으로 서 있다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "both-forms-written-is-outside-this-needle");
    expect(spot).toBeDefined();
    expect(bothFormsSiteCount()).toBeGreaterThanOrEqual(spot?.floor ?? 1);
    expect(bothFormsSiteCount()).toBe(spot?.measure ?? -1);
    // ⚠️ **두 시점(라운드 96 T5)**: 종전 이 자리는 실재하는 둘을 이름으로 보였다 —
    // `readSweptSource("src/notifications/generators.ts")`가 `이(가)`를,
    // `readSweptSource("src/children/child-switch.ts")`가 `(으)로 전환했어요.`를 들고 있었다.
    // 오늘 그 다섯 자리는 꼴 B(subjectParticle · directionParticle)로 이관돼 코드에서 사라졌고
    // (아래 부정 단언), 남은 하나(T6 소유 화면의 라벨)가 이 수의 전부다.
    expect(readSweptSource("app/settings/children.tsx")).toContain("(으)로 전환");
    expect(maskComments(readSweptSource("src/notifications/generators.ts"))).not.toContain("이(가)");
    expect(maskComments(readSweptSource("src/children/child-switch.ts"))).not.toContain("(으)로");
    expect(maskComments(readSweptSource("src/children/child-deletion.ts"))).not.toContain("(으)로");
    expect(maskComments(readSweptSource("src/children/household-join.ts"))).not.toContain("(으)로");
    // 그리고 이 모집단은 그 꼴을 세지 않는다(모양 규칙이 유령이 아니다).
    // ⚠️ 이 규칙은 **조사를 읽어 낸 다음의 나머지**를 본다 — `이(가)`에서 `이`를 뗀 `(가) …`.
    expect(BOTH_FORMS_SHAPE.test("(가) 들어섰어요")).toBe(true);
    expect(BOTH_FORMS_SHAPE.test(" 있는 날짜")).toBe(false);
    expect(readParticle("이(가) 들어섰어요")).toBe("이");
  });

  it("⚠️⚠️ 닫는 문자가 낀 자리 하나가 오늘 받침 형으로 옮겨 갔다 — 보이는 줄과 낭독이 같은 조사를 쓴다 (두 시점)", () => {
    const withMarks = byVerdict("fixed-tail").filter((site) => site.closingMarks.length > 0);
    expect(withMarks).toHaveLength(1);
    expect(withMarks[0].file).toBe("src/home/budget-edit.ts");
    expect(withMarks[0].closingMarks).toBe(")");
    // ⚠️ **두 시점(라운드 94 트랙 A)**: 트랙 B·라운드 93 시점 이 단언은 `toBe("로")` 였고, 그 옆에
    // *"값의 꼬리는 고정이라 갈리지 않지만 받침 형과는 어긋난다 — 안전한 스물아홉을 건드리지 않는
    // 것이 이 트랙의 금지라 고치지 않고 값으로 적는다"* 가 적혀 있었다. **판정(`fixed-tail`)은
    // 그때도 오늘도 옳았고, 틀린 것은 어느 형이 옳은가였다.** 눈에는 조사가 괄호 뒤에 오지만
    // **소리는 괄호가 아니라 값의 꼬리를 따른다** — `원`은 받침 ㄴ이고 ㄹ 예외도 아니므로 `으로`다.
    expect(expectedParticle("원", "으로")).toBe("으로");
    expect(withMarks[0].literalParticle).toBe("으로");

    // ⚠️⚠️ **그리고 이제 한 칩의 두 표면이 같은 조사를 쓴다** — 그 사실을 둘을 나란히 놓아 문다.
    const chipSource = maskComments(readSweptSource("src/home/budget-edit.ts"));
    expect(chipSource, "보이는 줄").toContain("label: `지난달 실지출(${amountText})으로`,");
    expect(chipSource, "낭독").toContain("accessibilityLabel: `지난달 실지출 ${amountText}으로 맞추기`,");
    // 옛 바이트는 (두 시점 주석 속 말고는) 코드 어디에도 없다.
    expect(chipSource).not.toContain("`지난달 실지출(${amountText})로`");
  });

  it("소스 대조이지 런타임이 아니다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "source-not-runtime");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("실기기");
    expect(spot?.measure).toBe(0);
  });

  it("⚠️⚠️ 고친 넷을 옛 바이트로 물던 옆 계약의 핀이 오늘의 바이트로 옮겨 적혔다 (재개 조건 발동 · 두 시점)", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "fixed-particle-pinned-by-another-contract");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("a11y-contract.test.ts:1012-1014");
    expect(spot?.resumeCondition).toContain("발동됨(라운드 93 통합)");
    // 종전(트랙 B 완료 시점): 옆 계약이 옛 바이트 `…nickname.trim()}를 추가하고 선택했어요.` 를 코드로
    // 들고 있어 이 수가 1이었다. 통합이 핀을 옮겨 적은 오늘, 핀은 **오늘의 바이트**를 들고 있고
    // 옛 바이트는 (두 시점 주석 속 말고는) 코드 어디에도 없다.
    const contract = readFileSync(join(mobileRoot, "src/a11y-contract.test.ts"), "utf8");
    expect(contract).toContain("${addedName}${objectParticle(addedName)} 추가하고 선택했어요.");
    expect(maskComments(contract)).not.toContain("를 추가하고 선택했어요.");
    // 화면 쪽도 옮겨 간 그대로다 — 두 파일이 같은 오늘의 문장을 지난다.
    expect(maskComments(readSweptSource("app/settings/children.tsx"))).not.toContain("를 추가하고 선택했어요.");
    expect(spot?.measure).toBe(0);
  });

  it("⚠️⚠️ 조사가 아닌데 받침으로 갈리는 접미사 `-네`의 사각이 오늘 0으로 내려갔다 (라운드 93 리뷰 M-5 → 라운드 94 트랙 A · 두 시점)", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "suffix-not-particle");
    expect(spot).toBeDefined();
    expect(spot?.reason).toContain("거짓 초록");
    expect(spot?.resumeCondition).toContain("재개 조건(사건형)");
    // ⚠️ 발동이 *일어났다*는 사실과 *어느 갈래로 일어났는가*를 함께 문다 — 두 갈래를 한 낱말로
    // 적지 않는다(앞쪽 갈래인 실사용 보고는 오늘도 서지 않았다).
    expect(spot?.resumeCondition).toContain("발동됨(라운드 94 트랙 A · 뒤쪽 갈래)");
    expect(spot?.resumeCondition).toContain("앞쪽 갈래(실사용 보고)는 오늘도 서지 않았다");

    // ⓐ 실측을 **소스에서 파생한다** — 손 목록도 grep도 아니고 스윕과 같은 마스킹 규율이다.
    const sites = honorificSuffixSites();
    expect(sites.length, "바이트로 센 자리 (오늘 셋 — 라벨의 두 갈래 + 보이는 줄)").toBe(3);
    const surfaces = [...new Set(sites.map((site) => site.surface))].sort();
    expect(surfaces).toEqual(["낭독 라벨", "보이는 줄"]);
    // ⚠️⚠️ **두 시점**: 라운드 93 리뷰 시점 이 자리의 실측은 **표면 둘**(리터럴 `네`가 붙은 표면
    // 수)이었다. 오늘 그 표면 수는 그대로 둘인데 **리터럴로 적힌 것이 0**이라 사각이 0이다 —
    // 사각이 세는 것은 *표면*이 아니라 **이 자가 못 보는 채로 남은 자리**이기 때문이다.
    expect(
      sites.filter((site) => site.verdict === "varies-but-written-fixed").length,
      "못 보는 채로 남은 자리"
    ).toBe(spot?.measure ?? -1);

    // ⓑ 그 자리들이 오늘 어디인지 값으로 든다(유령 사각 금지 · 자리는 한 파일이다).
    // ⚠️ **두 시점**: 라운드 93 시점의 자리는 `:406`·`:407`·`:417`이었고, 트랙 A가 import 한 줄과
    // 두 시점 주석을 더하며 오늘의 자리로 내려왔다(AG-5: 인용은 인용당한 자리를 따라간다).
    expect([...new Set(sites.map((site) => site.file))]).toEqual(["app/(tabs)/more.tsx"]);
    expect(sites.map((site) => site.line)).toEqual([413, 414, 424]);
    expect(sites.filter((site) => site.surface === "낭독 라벨").map((site) => site.line)).toEqual([413, 414]);
    expect(sites.filter((site) => site.surface === "보이는 줄").map((site) => site.line)).toEqual([424]);

    // ⓒ 마스킹이 실제로 일하고 있다 — 같은 파일이 **주석에도** 그 꼴을 적는데 세어지지 않는다.
    const more = readSweptSource("app/(tabs)/more.tsx");
    expect(more, "주석의 그 꼴이 오늘도 있다(유령 방지)").toContain('"{닉네임}네"');
    // ⚠️ **두 시점**: 트랙 A 전에는 마스킹 전 `}네`가 **넷**이었다(코드 셋 + 주석 하나). 오늘은
    // **셋**이고 **셋 다 주석**이다 — 두 시점 주석이 옛 바이트를 남기기 때문이고, 그래서 이 수가
    // 0이 아니라는 사실 자체가 *지우지 않았다*의 증거다. ⚠️ 등호가 아니라 **하한**으로 문다:
    // 주석을 더 적는 손이 빨강을 맞으면 아무도 두 시점을 적지 않는다(마스킹 뒤의 0이 상한을 진다).
    expect((more.match(/}네/g) ?? []).length, "마스킹 전에는 셋 이상(전부 주석)").toBeGreaterThanOrEqual(3);
    expect((maskComments(more).match(/}네/g) ?? []).length, "마스킹 뒤에는 0건").toBe(0);

    // ⓓ 그 꼴이 **조사 모집단 밖**이라는 것도 값으로 — 조사 자리와 한 자리도 겹치지 않는다.
    for (const site of sites) {
      expect(particleSites.filter((particle) => particle.file === site.file && particle.line === site.line)).toEqual([]);
    }
    expect(readParticle("네, 프로필 관리"), "`네`는 조사 쌍에 없다").toBeNull();

    // ⓔ 그리고 이 라운드는 **제품을 고쳤다** — 옛 바이트가 코드에서 사라졌다(두 시점 주석은 예외).
    expect(maskComments(more)).not.toContain("${visibleProfile.nickname}네");
    expect(more, "옛 바이트를 지우지 않고 주석으로 남겼다").toContain("${visibleProfile.nickname}네");
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// ③ 라운드 94 트랙 A — 접미사 모집단 · 순수 함수의 값 · 핀 이동.
// ───────────────────────────────────────────────────────────────────────────────

describe("ⓒ-접미사 순수 함수 — 받침에서 `-네` 앞의 `이`가 갈린다(표로 못 박는다)", () => {
  it("받침 있는 음절로 끝나면 사이에 `이`가 든다", () => {
    for (const [name, expected] of [
      ["지훈", "지훈이네"],
      ["하율", "하율이네"],
      ["사랑", "사랑이네"],
      ["김가람", "김가람이네"],
      ["첫돌", "첫돌이네"]
    ] as const) {
      expect(hasFinalConsonant(name), `${name}: 받침이 있다`).toBe(true);
      expect(nameWithHonorificSuffix(name)).toBe(expected);
    }
  });

  it("받침 없는 음절로 끝나면 바로 붙는다", () => {
    for (const [name, expected] of [
      ["서아", "서아네"],
      ["민수", "민수네"],
      ["다온이", "다온이네"],
      ["유주", "유주네"]
    ] as const) {
      expect(hasFinalConsonant(name), `${name}: 받침이 없다`).toBe(false);
      expect(nameWithHonorificSuffix(name)).toBe(expected);
    }
  });

  it("⚠️ 한글이 아닌 끝(라틴·숫자·이모지)에서는 판정이 서지 않고, **받침 없는 형**으로 떨어진다", () => {
    // ⚠️ 조사 셋과 **같은 답**이다 — 저장소가 이미 고른 갈래를 접미사에도 그대로 쓴다.
    // 그 근거는 *옳음이 아니라 안전*이다(사각 `non-hangul-tail-is-convention-not-grammar`):
    // 소리를 모르는 자리에서 어느 한쪽을 지어내는 것보다 어느 이름에도 덜 어색한 쪽이 낫다.
    for (const name of ["Ben", "둘째2", "🐣", "kim", "!!"]) {
      expect(hasFinalConsonant(name), `${name}: 판정이 서지 않는다`).toBeNull();
      expect(nameWithHonorificSuffix(name)).toBe(`${name}네`);
    }
  });

  it("빈 값·공백만 있는 값에서도 터지지 않고 같은 답으로 떨어진다", () => {
    for (const name of ["", "   "]) {
      expect(hasFinalConsonant(name)).toBeNull();
      // ⚠️ **두 시점**: 트랙 A 시점의 이 자리는 `` `${name}네` `` 였고 `"   "` 에서 `"   네"` 를 냈다.
      // 오늘은 꼬리 공백을 걷은 뒤 붙이므로 두 값이 같은 `"네"` 로 떨어진다(라운드 94 리뷰 M-6).
      expect(nameWithHonorificSuffix(name)).toBe("네");
    }
  });

  it("⚠️⚠️ 꼬리 공백이 붙은 이름에서 접미사가 값 안으로 새지 않는다 (라운드 94 리뷰 M-6 · 교란)", () => {
    // ⚠️ **교란**: 걷기 전에는 판정만 공백을 걷고 **출력은 원값**이라 사이의 `이`가 공백 뒤에
    // 붙었다 — `"지훈 "` → `"지훈 이네"`(화면에도 낭독에도 그대로 나갔다).
    for (const name of ["지훈 ", "지훈  ", "지훈\n", "지훈\t"]) {
      expect(hasFinalConsonant(name), `${JSON.stringify(name)}: 받침은 보였다`).toBe(true);
      expect(nameWithHonorificSuffix(name), `${JSON.stringify(name)}: 공백이 사이에 끼지 않는다`).toBe("지훈이네");
    }
    // 받침 없는 쪽도 같은 규율이다(사이에 드는 글자가 없어도 꼬리 공백은 걷는다).
    expect(nameWithHonorificSuffix("서아 ")).toBe("서아네");
    // ⚠️ **앞 공백은 걷지 않는다** — 이 함수가 지는 것은 접미사가 붙는 꼬리 하나다.
    expect(nameWithHonorificSuffix(" 지훈")).toBe(" 지훈이네");
  });

  it("⚠️⚠️ 자모가 분해된 이름(NFD)에서도 사이의 `이`가 선다 (라운드 94 리뷰 M-6 · 교란)", () => {
    // ⚠️ **교란**: 정규화 전에는 마지막 글자가 음절이 아니라 자모라 판정이 `null`이 되고,
    // 받침 있는 이름이 조용히 `"지훈네"` 로 떨어졌다(조사 쪽과 **같은 한 갈래**다).
    const decomposed = "지훈".normalize("NFD");
    expect(decomposed).not.toBe("지훈");
    expect(nameWithHonorificSuffix(decomposed)).toBe("지훈이네");
    // 출력도 `NFC`다 — 값이 조합형과 분해형으로 갈려 화면에 두 벌로 남지 않는다.
    expect(nameWithHonorificSuffix(decomposed).normalize("NFD")).not.toBe(nameWithHonorificSuffix(decomposed));
    expect(nameWithHonorificSuffix("서아".normalize("NFD"))).toBe("서아네");
    // 두 갈래가 겹쳐 들어와도(분해형 + 꼬리 공백) 한 값으로 떨어진다.
    expect(nameWithHonorificSuffix(`${decomposed}  `)).toBe("지훈이네");
  });

  it("⚠️⚠️ 접미사 규칙은 **관례이지 문법이 아니다** — 이미 `네`로 끝나는 이름에도 또 붙는다", () => {
    // ⚠️ 이것은 버그가 아니라 **오늘의 바이트가 하던 일과 같게 둔 것**이다(사각 ⓓ가 조건을 진다).
    // 트랙 A가 바꾼 것은 *접미사 앞의 `이` 한 글자*이고, 중복을 막는 판정을 새로 짓지 않았다.
    expect(nameWithHonorificSuffix("김가네")).toBe("김가네네");
    expect(hasFinalConsonant("김가네"), "`네`는 받침이 없다").toBe(false);
    const spot = BLIND_SPOTS.find((entry) => entry.id === "suffix-not-particle");
    expect(spot?.resumeCondition).toContain("김가네네");
  });
});

describe("ⓑ-접미사 판정 — 접미사 자리마다 소스에서 하나가 나온다", () => {
  const suffixSites = honorificSuffixSites();

  it("⚠️ 접미사를 고르는 함수 이름도 소스에서 파생한다 — 손으로 적지 않는다", () => {
    expect(suffixChooserNames).toEqual(["nameWithHonorificSuffix"]);
    expect(maskComments(readSweptSource("src/text/korean-particles.ts"))).toContain(
      "export function nameWithHonorificSuffix("
    );
    // ⚠️ 유령 방지 — **규칙이 사는 파일은 자리가 아니다**. 그 파일도 손 목록이 아니라 파생이고
    // (`honorificSuffixModuleFiles`), 그 안의 정의 한 줄과 본문의 `}네`가 자리로 세어지지 않는다.
    expect(suffixChooserFiles).toEqual(["src/text/korean-particles.ts"]);
    expect(suffixSites.filter((site) => site.file === "src/text/korean-particles.ts")).toEqual([]);
  });

  it("모든 접미사 자리가 둘 중 하나로 갈리고, 둘의 합이 모집단이다", () => {
    const verdicts: HonorificSuffixVerdict[] = ["chooses-from-value", "varies-but-written-fixed"];
    for (const site of suffixSites) {
      expect(verdicts).toContain(site.verdict);
      expect(site.line).toBeGreaterThan(0);
      expect(sweptFiles).toContain(site.file);
    }
    const choosing = suffixSites.filter((site) => site.verdict === "chooses-from-value");
    const fixed = suffixSites.filter((site) => site.verdict === "varies-but-written-fixed");
    expect(choosing.length + fixed.length).toBe(suffixSites.length);
  });

  it("⚠️⚠️ 트랙 뒤 — *값에서 고른다* 셋 · *갈리는데 고정으로 적었다* **0건** (오늘 0 → 셋 · 셋 → 0)", () => {
    const choosing = suffixSites.filter((site) => site.verdict === "chooses-from-value");
    const offenders = suffixSites
      .filter((site) => site.verdict === "varies-but-written-fixed")
      .map((site) => `${site.file}:${site.line} (${site.surface})`);
    // ⚠️ **상한 0** — 한 자리라도 리터럴 `}네`로 되돌리면 여기가 먼저 빨개진다.
    expect(offenders).toEqual([]);
    // ⚠️ **하한 셋** — 모집단은 줄지 않는다(꼴 A와 꼴 B가 같은 모집단이라 고치는 손이 줄이지 못한다).
    expect(choosing.length).toBeGreaterThanOrEqual(3);
    for (const site of choosing) {
      expect(suffixChooserNames).toContain(site.chooser ?? "");
    }
  });

  it("⚠️ 접미사 모집단에 오늘 서는 꼴은 `-네` 하나뿐이라는 사실이 값으로 선다", () => {
    // ⚠️ `아/야`·`이랑`·`이나`·`이라`는 오늘 **0건**이다 — 없다는 것도 소스에서 낸다.
    // (`}` 바로 뒤에 붙는 받침 의존 접미사만 센다 — 낱말 안의 같은 글자는 자리가 아니다.)
    const others = ["아", "야", "이랑", "이나", "이라"];
    const hits: string[] = [];
    for (const file of sweptFiles) {
      const code = maskComments(readSweptSource(file));
      for (const suffix of others) {
        const needle = `}${suffix}`;
        for (let at = code.indexOf(needle); at !== -1; at = code.indexOf(needle, at + 1)) {
          hits.push(`${file}:${lineOf(code, at)} ${needle}`);
        }
      }
    }
    expect(hits).toEqual([]);
    // 그리고 바늘이 유령이 아니다 — 픽스처에서는 실제로 잡는다.
    expect(maskComments("const s = `${name}이랑`;").includes("}이랑")).toBe(true);
  });

  it("⚠️ 보이는 줄과 낭독 라벨이 **같은 한 함수**를 지난다 — 두 표면이 갈릴 자리가 없다", () => {
    const byFile = suffixSites.filter((site) => site.file === "app/(tabs)/more.tsx");
    expect(byFile.filter((site) => site.surface === "보이는 줄").length).toBeGreaterThanOrEqual(1);
    expect(byFile.filter((site) => site.surface === "낭독 라벨").length).toBeGreaterThanOrEqual(2);
    expect([...new Set(byFile.map((site) => site.chooser))]).toEqual(["nameWithHonorificSuffix"]);
    // 그리고 그 함수가 **바로 그 값**을 본다(유령 방지 — 다른 값을 보는 자리가 없다).
    const code = maskComments(readSweptSource("app/(tabs)/more.tsx"));
    expect((code.match(/nameWithHonorificSuffix\(visibleProfile\.nickname\)/g) ?? []).length).toBe(3);
    expect((code.match(/nameWithHonorificSuffix\(/g) ?? []).length).toBe(3);
  });
});

describe("ⓕ 핀 이동 — 문구를 고친 손이 그 문구를 무는 계약을 함께 옮겼다 (AH-4의 이행)", () => {
  const readContract = (path: string): string => readFileSync(join(mobileRoot, path), "utf8");

  it("⚠️⚠️ 핀마다 자리·옛 바이트·오늘의 바이트 셋이 값으로 서 있고, 옛 바이트가 코드에 없다", () => {
    // ⚠️ 등호가 아니라 **하한**이다 — 정찰이 배정한 계약은 셋이었고 소스가 낸 수는 그보다 컸다.
    expect(PIN_MIGRATIONS.length).toBeGreaterThanOrEqual(8);
    for (const pin of PIN_MIGRATIONS) {
      expect(pin.previousPin, `${pin.contract}: 옛 바이트와 오늘의 바이트가 같다`).not.toBe(pin.todayPin);
      const contract = readContract(pin.contract);
      expect(contract, `${pin.contract}: 오늘의 바이트를 들고 있지 않다`).toContain(pin.todayPin);
      // ⚠️ 주석을 걷은 뒤에 문다 — 두 시점 주석 속의 옛 바이트는 *지우지 않은 것*이지 부채가 아니다.
      expect(maskComments(contract), `${pin.contract}: 옛 바이트가 코드에 남아 있다`).not.toContain(pin.previousPin);
      expect(contract, `${pin.contract}: 옛 바이트를 두 시점으로 남기지 않았다`).toContain(pin.previousPin);
      expect(contract, `${pin.contract}: 두 시점 표기`).toContain("두 시점");
    }
  });

  it("⚠️ 그 핀들이 가리키는 제품 자리가 모집단 안에 있고, 오늘의 바이트를 지닌다", () => {
    for (const pin of PIN_MIGRATIONS) {
      expect(sweptFiles, `${pin.product}: 모집단 밖이다`).toContain(pin.product);
      const product = maskComments(readSweptSource(pin.product));
      expect(product, `${pin.product}: 오늘의 바이트`).toContain(pin.todayProductByte);
      expect(product, `${pin.product}: 옛 바이트가 코드에 남아 있다`).not.toContain(pin.previousProductByte);
    }
  });

  it("⚠️⚠️ 계약 파일 수와 핀 수를 나란히 적는다 — **정찰의 넷은 하한이었다**", () => {
    const contracts = [...new Set(PIN_MIGRATIONS.map((pin) => pin.contract))].sort();
    // 정찰이 트랙 A에 이름으로 배정한 핀은 넷이었다(a11y-contract 둘 · design-restore-p2d 하나 ·
    // 이 파일의 `closingMarks` 하나). 소스가 낸 수는 **계약 다섯 · 핀 아홉**이고, 그중 이 대장이
    // 지는 것이 **계약 넷 · 핀 여덟**이다(아홉째는 이 파일 자신의 것이라 대장 밖에 둔다).
    expect(contracts.length).toBeGreaterThanOrEqual(4);
    expect(PIN_MIGRATIONS.length, "대장이 지는 핀").toBeGreaterThanOrEqual(8);
    expect(contracts).toContain("src/a11y-contract.test.ts");
    expect(contracts).toContain("src/design-restore-p2d.test.ts");
    expect(contracts).toContain("src/settings/more-menu.test.ts");
    expect(contracts).toContain("src/home/budget-edit.test.ts");
    // ⚠️ 그리고 이 파일 자신의 핀(`closingMarks`의 `literalParticle`)은 위 ⓕ 절이 따로 문다 —
    // 대장이 자기 자신을 무는 순환을 만들지 않는다.
    expect(contracts).not.toContain("src/korean-particle-guard.test.ts");
  });

  it("⚠️⚠️ 이 이동이 **통합이 아니라 트랙의 커밋**에 실린다는 사실이 머리말에 값으로 있다", () => {
    const self = readContract("src/korean-particle-guard.test.ts");
    expect(self).toContain("통합이 아니라 트랙의 커밋");
    expect(self).toContain("배정 단계에서");
    // 라운드 93의 그 부채가 어떤 얼굴이었는지도 옆에 남아 있다(두 시점).
    expect(self).toContain("발동됨(라운드 93 통합)");
  });
});
