import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 91 트랙 A — **누르는 자리는 왕복이 끝나기 전에 두 번 눌리지 않는다.**
 *
 * 핵심 루프 4단계(구매 링크)에서 **두 번 누르면 클릭이 두 번 기록됐다.** 누르는 자리 둘
 * (`app/items/[itemTemplateId].tsx`의 판매처 비교 행 · 구매 CTA)이 한 핸들러
 * (`handleProductLinkPress`)로 모이는데, 그 핸들러는 왕복이 끝나기 전에는 아무것도 막지
 * 않았다. 그래서 두 번째 탭이 ⓐ `affiliate_link_clicked`를 하나 더 쏘고 ⓑ 서버에 클릭 행을
 * 하나 더 만들었다.
 *
 * ⚠️ **그 해악을 서버 소스가 이미 이름으로 적어 두었다** —
 * `apps/api/src/onboarding/items-catalog.service.ts`의 주석이 *"집계에는 열린 적 없는 클릭이
 * 쌓인다(**허위 수치**)"* 라고 쓴다. 라운드 64 S-4가 그 해악의 한 방향(쓰기 뒤 실패)을 닫았고,
 * **연타는 같은 해악의 두 번째 문**이었다. 그 수가 서는 자리는 어드민 클릭 통계의 순위 카드
 * (DNC-009 고지가 붙은 그 카드)와 대시보드의 `affiliateClicks7d`다.
 *
 * ## ⚠️ 답을 발명하지 않았다 — 저장소가 이미 고른 형식을 인용했다
 *
 * `if (…isPending) return;`은 이 저장소에 이미 **일곱 자리**가 서 있다
 * (`app/settings/children.tsx` 셋 · `app/settings/privacy.tsx` 셋 · `app/import/index.tsx` 하나).
 * 트랙 A가 더한 것은 그 여덟째 한 줄이고 **렌더는 바이트 불변**이다.
 *
 * ⚠️⚠️ **두 시점 — 라운드 91 리뷰(M-1)가 그 한 줄을 *링크 단위*로 좁혔다.** A의 조건은
 * `if (clickLink.isPending) return;` 이라 **뮤테이션 단위**였고, 그 모양은 대기 창 동안 *누른 적
 * 없는 다른 판매처 행까지* 삼켰다(누르는 자리 둘이 한 핸들러로 모이되 **서로 다른 링크**를
 * 넘긴다). 오늘의 조건은 `clickLink.variables?.id === link.id`를 함께 물어 **같은 링크의 두 번째
 * 탭만** 떨어뜨린다 — 중복 기록은 언제나 같은 링크에서 나므로 막는 힘은 그대로다. 그 정규형은
 * `LINK_SCOPED_GUARD`가 값으로 지고, 넓은 조건으로 되돌리면 그 자리가 빨개진다.
 *
 * ⚠️ **`disabled`를 쓰지 않은 이유가 이 계약의 값 절반이다.** `PrimaryButton`은 `disabled`면
 * 배경이 `gray300`이 되어 **대기 창 동안 픽셀이 바뀌고**, 그 버튼은 승인 캡처(ITEM-002 ·
 * DSN-053)의 자리다. `ProductComparisonRow`에는 `disabled` 프롭이 **아예 없다**. 눌림을 막는
 * 옳은 형식이 이 자리에서는 컨트롤이 아니라 핸들러다 — 아래 ⓓ가 그 사실을 **부정 단언**으로 문다.
 *
 * ## ⚠️ 이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다
 *
 * 저장소에는 앱 경계를 넘어 도는 그물 **열다섯**이 있다. **이 파일은 그 하나가 아니다.**
 * 이 스윕이 걷는 것은 `SWEEP_SCOPE_LABEL` 하나 — `apps/mobile/{app,src}/**` 뿐이고,
 * 어드민·api·`packages/**`로는 한 걸음도 나가지 않는다. 그 사실을 주석이 아니라 **값**으로
 * 두는 이유는, 다음 라운드에 누군가 이 파일을 "저장소 연타 그물"로 넓히려 할 때 넓히는 손이
 * `SWEEP_ROOTS`를 고치며 지나가게 하기 위해서다 — 주석은 조용히 거짓이 되지만 값은 빨개진다.
 * (라운드 89 B의 `admin-table-name.test.ts` · 라운드 90 B의 `admin-status-announce.test.ts`와
 * 같은 계열이다.)
 *
 * ## 판정 셋 — 손으로 적지 않고 소스에서 파생한다
 *
 * 모집단은 `apps/mobile/{app,src}/**`의 비테스트 `.tsx` 전수에서 나온 `useMutation` 선언이고,
 * 자리마다 셋 중 하나가 **소스에서** 나온다.
 *
 *  · `control-blocks` — 그 뮤테이션의 `isPending`이 **`disabled` 프롭에 닿는다**(직접이거나,
 *    같은 파일의 이름 붙은 불리언을 한 번 거친다). 눌림 자체가 서지 않는다.
 *  · `handler-blocks` — 핸들러 첫머리에 `if (…isPending) return;` 이 선다. 픽셀은 그대로 두고
 *    **두 번째 탭만** 조용히 떨어진다.
 *  · `does-not-block` — 위 둘 다 아니다. ⚠️ **이 판정에는 이유가 반드시 붙고**(`UNBLOCKED_SITES`),
 *    빈 이유는 계약이 길이로 막는다. 이유는 **그 파일의 소스로 증명한다**(`provenBy`).
 *
 * ⚠️ **컨트롤이 먼저다.** 일곱 자리는 `disabled`와 핸들러 가드를 **둘 다** 지니는데, 그런 자리는
 * `control-blocks`로 센다 — 눌림이 서지 않는 쪽이 더 강한 판정이기 때문이다. 그래서 오늘
 * `handler-blocks`는 **트랙 A가 더한 그 하나뿐**이고, 그 하나가 이 트랙의 값이다(ⓒ).
 *
 * ## ⚠️ 전제 재실측 — 정찰의 31·25·셋은 하한이었고 하나가 움직였다
 *
 * 정찰(2026-08-31)이 grep으로 낸 수는 **선언 31 · `disabled={…isPending…}` 25 · 읽되 막지 않음 2 ·
 * 아예 읽지 않음 4** 였다. 오늘 워킹트리에서 다시 재니 **선언은 31로 같고**, 정찰이 쓴
 * 같은 바늘(`disabled={` 안에 `.isPending`이 직접 있는가)도 **25로 같다**.
 *
 * ⚠️ **갈린 것은 판정이지 수가 아니다.** 정찰이 *"읽되 막지 않는다"* 로 센 **둘**은 오늘
 * 소스를 따라가 보니 **막는다** — 한 걸음을 거칠 뿐이다:
 *  · `app/settings/notifications.tsx`의 `toggleCurrentDevice` →
 *    `const masterToggleDisabled = … || toggleCurrentDevice.isPending;` → `disabled={masterToggleDisabled}`.
 *  · `app/import/[importJobId].tsx`의 `confirm` →
 *    `isConfirming: confirm.isPending` → `const canConfirm = canConfirmImport({…})` → `disabled={!canConfirm}`.
 * **그래서 이 계약의 `control-blocks`는 25가 아니라 27이다**(정찰의 25는 하한이었다). 정찰의
 * 나머지 셋(*막지 않는다*)은 오늘도 셋이고, 그 셋에 이유가 붙는다.
 *
 * ⚠️ **정찰이 지목한 마스킹 함정은 이 모집단에 오지 않는다.** 정찰은
 * `src/query/shared-cache-policy.ts`가 같은 낱말을 여러 번 인용하니 주석을 걷고 세라고 적었는데,
 * 오늘 재어 보니 그 인용들은 **주석이 아니라 문자열 리터럴**이고(무효화 정책 대장이 손으로
 * 적어 둔 `sliceStart` 열넷), 그 파일은 `.ts`라 **`.tsx` 전수인 이 모집단 밖이다.**
 * 그럼에도 이 스윕은 **주석과 문자열 둘 다 걷고** 센다 — 오늘 그 걸음의 차이는 0이지만
 * (`MASKING_DELTA_TODAY`), 0인 것은 오늘의 값이지 규율이 아니다. 그 자가 실제로 무엇을 걷는지는
 * 픽스처가 보여 준다(아래 "마스킹" 절).
 *
 * ⚠️ 그리고 그 대장이 손으로 적은 열넷(이름 열하나)은 **이 스윕의 모집단이 아니다** — 고치려는
 * 병이 정확히 *손으로 적은 모집단*이라, 이 파일은 전수에서만 파생한다. 그 목록은 **비교
 * 대상으로만** 한 번 읽고(ⓐ의 마지막 단언), 거기서 나오는 값이 이 계약의 값이다:
 * **손 열하나는 전수 서른하나의 부분집합이고 그보다 작다.**
 *
 * ## ⚠️ 이 스윕은 마스킹한 소스만 문다 — ⚠️⚠️ **다만 두 뷰가 있다**(리뷰 L-3의 정정)
 *
 * 아래 모든 문자열 앵커는 `maskComments` 를 지난 소스를 본다 — 주석이 남긴 인용 덕에 초록인
 * 자리(라운드 88 C의 주석 관용 앵커)가 **구조적으로 설 수 없다.**
 *
 * ⚠️⚠️ **그러나 *"마스킹 소스"* 가 곧 *"문자열까지 걷은 소스"* 는 아니다.** 이 자는 뷰를 **둘**
 * 낸다:
 *  · **기본 뷰**(`maskComments(raw)`) — 주석만 걷고 **문자열 내용은 남긴다.** `disabled={…}` 탐색
 *    (`disabledExpressions`) · `controlPath` · 핸들러 가드 탐색 · 아래 ⓒ~ⓔ의 앵커가 전부 이 뷰를
 *    본다. 그래서 *"어떤 문자열 리터럴이 `disabled=`를 담고 있으면 컨트롤 판정이 뒤집힐 수 있다"*
 *    는 사각이 **구조적으로 남는다**(ⓕ의 `control-verdict-is-file-scoped`가 값으로 진다).
 *  · **문자열까지 걷는 뷰**(`maskComments(raw, { strings: true })`) — **선언 계수에만** 쓴다.
 *    소스를 인용해 둔 표(`shared-cache-policy.ts`)가 `useMutation` 자리를 만들지 않게 하려는 것이다.
 *
 * ⚠️ **오늘 두 뷰의 갈림은 0이다**(`MASKING_DELTA_TODAY` — 아래 "마스킹" 절의 마지막 `it`이 다시
 * 잰다). **0인 것은 오늘의 값이지 규율이 아니고**, 그 0이 위 사각을 지우지도 않는다.
 */

/** 이 스윕이 걷는 앱 경계. `apps/mobile/` 밖으로는 한 걸음도 나가지 않는다. */
const SWEEP_SCOPE_LABEL = "apps/mobile/{app,src}/**" as const;

/** 뿌리 둘 — 화면(`app`)과 그 화면이 쓰는 모듈·UI(`src`). */
const SWEEP_ROOTS = ["app", "src"] as const;

const mobileRoot = process.cwd();

/** 정찰(2026-08-31)이 grep으로 낸 하한. ⚠️ 값은 갱신하되 이 하한은 내리지 않는다. */
const SCOUT_LOWER_BOUNDS = {
  /** 비테스트 `.tsx` 전수. */
  sweptFiles: 58,
  /** `useMutation` 선언 전수. */
  mutationSites: 31,
  /** 정찰이 쓴 바늘 — `disabled={` 안에 `.isPending`이 **직접** 있는 자리. */
  directDisabledSites: 25
} as const;

/** 오늘의 실측 — ⚠️ 늘어나는 쪽만 안전하다(줄면 규율이 사라진 것이다). */
const CONTROL_BLOCKING_FLOOR = 27;

/** ⚠️ 막지 않는 자리는 **늘지 않는다.** 새 자리가 붙는 날 이 계약이 먼저 빨개진다. */
const DOES_NOT_BLOCK_CEILING = 3;

/**
 * 핵심 루프 4단계의 그 자리 — **이름으로 못 박는다**(ⓒ).
 *
 * 판정이 다시 `does-not-block`으로 떨어지는 날 빨개진다. 그 하나가 이 트랙의 값이다.
 *
 * ⚠️⚠️ **두 시점 — 이 값은 라운드 91 A가 적은 줄이 아니라 라운드 91 리뷰가 좁힌 줄이다.**
 *  · **A 시점**: `if (clickLink.isPending) return;` — 조건이 **뮤테이션 단위**였다.
 *  · **오늘(리뷰 M-1)**: `if (clickLink.isPending && clickLink.variables?.id === link.id) return;`
 *    — 조건이 **링크 단위**다.
 *
 * ⚠️ **왜 넓은 가드가 틀렸는가.** 이 화면의 누르는 자리 둘은 한 핸들러로 모이지만 **서로 다른
 * 링크**를 넘긴다(비교 행은 그 행의 `link`, CTA는 `primaryPurchaseLink`). 뮤테이션 단위 조건은
 * *"이 화면에서 왕복이 하나라도 돌면 아무것도 못 누른다"* 는 뜻이라, 첫 탭의 대기 창에서
 * **다른 판매처를 눌러 보는 정당한 행동까지** 아무 말 없이 삼켰다 — 그 자리는 A가 막으려던 중복
 * 기록(**허위 수치**)과 상관이 없다. 오늘의 조건은 *같은 링크인가*까지 물어 **같은 링크의 두 번째
 * 탭만** 떨어뜨린다. 중복 기록을 막는 힘은 그대로다: 두 번 기록되는 자리는 언제나 같은 링크다.
 *
 * ⚠️ 판정 함수(`hasHandlerGuard`)는 조건 안쪽을 **문장 경계까지** 보므로 두 모양을 **둘 다**
 * 받는다 — 그래서 좁힌 걸음이 판정을 흔들지 않았고, 이 값과 아래 정규형만 함께 옮긴다.
 */
const CORE_LOOP_SITE = {
  file: "app/items/[itemTemplateId].tsx",
  mutation: "clickLink",
  handler: "handleProductLinkPress",
  /** 저장소가 일곱 자리에서 이미 고른 관례의 여덟째 — ⚠️ 오늘은 그 관례에 **링크 단위** 한 짝이 붙는다. */
  guard: "if (clickLink.isPending && clickLink.variables?.id === link.id) return;",
  /** 그 가드가 무는 **인자의 이름** — 핸들러가 받는 링크다(넓은 가드에는 이 자리가 없었다). */
  guardArgument: "link"
} as const;

/** 관례의 본보기 일곱이 사는 자리 — 이 형식이 발명이 아니라 인용임을 값으로 둔다. */
const GUARD_PRECEDENTS: readonly { readonly file: string; readonly count: number }[] = [
  { file: "app/settings/children.tsx", count: 3 },
  { file: "app/settings/privacy.tsx", count: 3 },
  { file: "app/import/index.tsx", count: 1 }
];

/** 본보기의 하한 — **실측**이 이 아래로 내려가면 관례가 지워진 것이다(표의 합도 이 수와 같다). */
const GUARD_PRECEDENT_FLOOR = 7;

type PressVerdict = "control-blocks" | "handler-blocks" | "does-not-block";

type MutationSite = {
  readonly file: string;
  readonly name: string;
  readonly verdict: PressVerdict;
  /** `isPending`이 `disabled`까지 가는 길에 거친 이름들(직접이면 빈 배열). */
  readonly via: readonly string[];
};

/**
 * `does-not-block` 자리의 이유 — ⚠️ **빈 문자열 금지**이고, 이유는 **그 파일의 소스로 증명한다.**
 *
 * `provenBy`는 그 이유가 참임을 보이는 **마스킹된 코드 조각**이다(주석이 아니라 코드여야 한다 —
 * 라운드 88 C가 세운 그 구별). 유령 방지: 여기 적힌 자리와 오늘 파생된 `does-not-block` 자리가
 * **정확히 같은 집합**이어야 한다.
 */
const UNBLOCKED_SITES: readonly {
  readonly file: string;
  readonly name: string;
  readonly reason: string;
  readonly provenBy: string;
}[] = [
  {
    file: "app/(tabs)/records.tsx",
    name: "removeExpense",
    reason:
      "눌림이 삭제 확인 Alert **뒤**에 선다 — 목록 행의 액션시트가 아니라 확인 대화의 '삭제'가 mutate를 부르고, " +
      "그 대화는 고르는 순간 닫힌다. 뮤테이션의 isPending으로 목록을 잠그면 삭제와 무관한 행까지 굳는다.",
    provenBy: "onPress: () => removeExpenseMutate(expense)"
  },
  {
    file: "app/import/[importJobId].tsx",
    name: "toggleRow",
    reason:
      "잠금이 뮤테이션 단위가 아니라 **행 단위**다 — 2,000행 목록에서 toggleRow.isPending은 체크 한 번마다 전 행을 굳혔다. " +
      "그 자리를 pendingRowIds가 대신 지고, 같은 행의 두 번째 탭은 그 값이 막는다.",
    provenBy: "isRowPending: pendingRowIds.has(row.id)"
  },
  {
    file: "app/import/[importJobId].tsx",
    name: "updateCategory",
    reason:
      "같은 이유로 행 단위 잠금이다 — 이 PATCH는 낙관 갱신을 하지 않고 그 행만 pendingRowIds로 잠근 뒤 " +
      "서버가 돌려준 행을 캐시에 꽂는다. 뮤테이션 단위 isPending은 고르지 않은 행까지 잠근다.",
    provenBy: "setPendingRowIds((ids) => {"
  }
];

/**
 * ⓕ 사각 — ⚠️ **이 스윕이 못 보는 것을 값과 하한으로 적는다.**
 *
 * 이 계약이 세는 수는 *"저장소의 연타 자리가 이만큼이다"* 가 아니라 *"이 모집단 안에서
 * 이만큼이 풀렸다"* 는 뜻이다(AB-5의 규율).
 */
const BLIND_SPOTS: readonly {
  readonly id: string;
  readonly measure: number;
  readonly floor: number;
  readonly reason: string;
  readonly resumeCondition: string;
}[] = [
  {
    id: "writes-outside-useMutation",
    // 파생값(아래 계약이 다시 센다): 마스킹된 모집단의 `void <호출>(` + 맨 `fetch(` 자리.
    measure: 35,
    floor: 1,
    reason:
      "쓰기가 `useMutation` 밖에 서면 이 바늘에 걸리지 않는다 — 직접 `fetch(`(오늘 이 모집단에 0건)와 " +
      "`void <호출>(`(오늘 35)이 그 자리다. 그 자리들의 연타 판정은 이 계약이 묻지 않는다.",
    resumeCondition:
      "재개 조건(사건형): `useMutation` 밖의 쓰기가 핵심 루프 안에 서는 날 — 그날 첫 모집단은 이 35다."
  },
  {
    id: "admin-has-no-such-sweep",
    // 이 스윕이 어드민에서 세는 자리 — 뿌리가 apps/mobile 하나이므로 구조적으로 0이다.
    measure: 0,
    floor: 0,
    reason:
      "어드민에는 이 축의 스윕이 0건이다. 이 스윕은 뿌리가 `apps/mobile` 하나라 그 자리를 세지 않는다 — " +
      "값은 손으로 재어 두었다: 어드민 비테스트 `.tsx`의 `<button` 68 · `disabled=` 44. " +
      "⚠️ 정찰의 29는 더 좁은 바늘이었고(오늘 같은 낱말을 전수로 세니 44다) 그 갈림도 값이다.",
    resumeCondition: "재개 조건(사건형): 연타 가드가 어드민에서 한 트랙의 축이 되는 라운드가 서는 날."
  },
  {
    id: "source-not-runtime",
    measure: 0,
    floor: 0,
    reason:
      "이 계약은 **소스 대조**다 — 실제로 두 번 눌러 클릭이 한 번만 기록되는지는 이 자가 묻지 않는다(런타임 확인 0건). " +
      "그 확인은 실기기 항목의 몫이고, 이 계약이 초록이라는 사실은 그 항목을 대신하지 않는다.",
    resumeCondition:
      "재개 조건(사건형): 실기기 확인이 이 자리를 항목으로 받는 날 — 그날 이 사각은 그 항목 번호를 함께 든다."
  },
  {
    // ⚠️⚠️ 라운드 91 리뷰 M-2가 연 넷째 사각 — 넓힌 것이 아니라 **처음부터 있던 사각을 이름으로 적는다**.
    id: "control-verdict-is-file-scoped",
    // 오늘 `control-blocks`로 세어진 자리 수(아래 `it`이 다시 잰다 — 하한으로만 견준다).
    measure: 27,
    floor: 1,
    reason:
      "**`control-blocks` 판정은 파일 단위다 — `disabled`가 *그 뮤테이션의 누르는 자리*에 붙었는지는 묻지 않는다.** " +
      "`controlPath`가 보는 것은 ⓐ 같은 파일 어딘가의 `disabled={…}` 식과 ⓑ 그 식이 그 뮤테이션의 `isPending`에 " +
      "이름으로 닿는가뿐이고, **그 `disabled`가 붙은 태그가 그 뮤테이션을 부르는 그 태그인가**는 이 자의 바늘 밖이다. " +
      "그래서 한 파일에 누르는 자리가 여럿이면 *다른 버튼의 `disabled`* 가 이 뮤테이션의 판정을 사 준다. " +
      "⚠️ 그리고 그 식을 찾는 걸음은 **문자열 내용을 남긴 기본 뷰**를 보므로(L-3), 같은 파일의 어떤 문자열 리터럴이 " +
      "`disabled=`와 그 이름을 함께 담고 있어도 판정이 사진다. " +
      "⚠️⚠️ **오염의 실물 한 모양을 함께 적어 둔다**: 핵심 루프의 그 자리(`app/items/[itemTemplateId].tsx`의 " +
      "`clickLink`)에서 누군가 `const …Disabled = … || clickLink.isPending;` 같은 이름을 세우고 그 이름을 아무 " +
      "`disabled={…}`에나 쓰면 — 그 태그가 `handleProductLinkPress`를 부르지 않아도 — 이 자는 그 자리를 " +
      "`handler-blocks`가 아니라 `control-blocks`로 센다. " +
      "⚠️ **그때 조용해지지는 않는다: ⓒ가 fail-safe다.** ⓒ는 그 자리의 판정이 `handler-blocks`임을 **등호로** 물고 " +
      "`handler-blocks`가 오늘 그 하나뿐임도 함께 무므로, 오염이 판정을 뒤집는 순간 계약이 **빨개진다** — " +
      "사람이 보게 되는 것이 이 사각이 조용히 넓어지는 모양이 아니라 빨강이라는 사실이, 이 사각을 값으로만 적고 " +
      "바늘을 넓히지 않은 이유다(태그 단위로 좁히려면 JSX 트리를 걸어야 하고, 그것은 이 스윕의 자가 아니다).",
    resumeCondition:
      "재개 조건(사건형): 한 파일 안에서 뮤테이션 둘 이상이 서로 다른 누르는 자리를 지고 그중 하나만 " +
      "`disabled`를 받는 자리가 처음 발견되는 날 — 그날 이 자는 판정을 파일 단위에서 **태그 단위**로 좁혀야 하고, " +
      "그 첫 모집단은 오늘의 27이다."
  }
];

// ───────────────────────────────────────────────────────────────────────────────
// 자 — 주석과 문자열을 걷는다.
// ───────────────────────────────────────────────────────────────────────────────

type MaskOptions = { readonly strings: boolean };

/**
 * 주석을(그리고 `strings`면 문자열 **내용**까지) 같은 길이의 공백으로 바꾼다.
 *
 * ⚠️ **길이를 보존한다** — 자리 계산이 원본과 어긋나지 않게 하려는 것이고, 계약이 그 사실을
 * 픽스처로 확인한다.
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

function listSweptFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
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

/** `open`에서 시작해 짝이 맞는 `close`까지의 **안쪽**을 돌려준다(문자열 안의 괄호는 세지 않는다). */
function balancedBody(source: string, openIndex: number, open: string, close: string): string | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote !== null) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

/** `const <이름> = <식>` 의 식 본문 — 최상위 `;`나 닫히지 않은 괄호에서 멈춘다. */
function constInitializers(code: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const declaration = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(code)) !== null) {
    const start = match.index + match[0].length;
    let depth = 0;
    let quote: string | null = null;
    let i = start;
    for (; i < code.length; i += 1) {
      const char = code[i];
      if (quote !== null) {
        if (char === "\\") i += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "(" || char === "[" || char === "{") depth += 1;
      else if (char === ")" || char === "]" || char === "}") {
        if (depth === 0) break;
        depth -= 1;
      } else if (char === ";" && depth === 0) break;
    }
    out.push({ name: match[1], body: code.slice(start, i) });
  }
  return out;
}

/** `disabled={…}` 의 식 전수. */
function disabledExpressions(code: string): string[] {
  const out: string[] = [];
  const needle = /\bdisabled=\{/g;
  let match: RegExpExecArray | null;
  while ((match = needle.exec(code)) !== null) {
    const body = balancedBody(code, match.index + "disabled=".length, "{", "}");
    if (body !== null) out.push(body);
  }
  return out;
}

function mentionsName(text: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(text);
}

/**
 * 한 뮤테이션의 `isPending`이 `disabled`까지 가는 길 — 같은 파일의 이름 붙은 값들을 따라간다.
 *
 * ⚠️ 이름을 **거쳐서** 막는 자리가 실재한다(정찰이 *"읽되 막지 않는다"* 로 셌던 둘). 한 걸음도
 * 따라가지 않는 자는 그 둘을 결함으로 읽고, 그러면 이 계약이 없는 결함 둘을 만든다.
 */
function controlPath(code: string, mutationName: string): readonly string[] | null {
  const pending = `${mutationName}.isPending`;
  const initializers = constInitializers(code).filter((entry) => entry.name !== mutationName);
  const tainted = new Map<string, string[]>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of initializers) {
      if (tainted.has(entry.name)) continue;
      if (entry.body.includes(pending)) {
        tainted.set(entry.name, [entry.name]);
        grew = true;
        continue;
      }
      const upstream = [...tainted.keys()].find((name) => mentionsName(entry.body, name));
      if (upstream !== undefined) {
        tainted.set(entry.name, [...(tainted.get(upstream) ?? []), entry.name]);
        grew = true;
      }
    }
  }
  for (const expression of disabledExpressions(code)) {
    if (expression.includes(pending)) return [];
    const hit = [...tainted.keys()].find((name) => mentionsName(expression, name));
    if (hit !== undefined) return tainted.get(hit) ?? [hit];
  }
  return null;
}

/**
 * ⚠️ 조건이 `.isPending` **하나뿐인** 모양만 보는 자는 관례 일곱 중 넷을 놓친다 —
 * 저장소의 가드는 `if (!isChildFormValid(errors) || addChild.isPending || …) return;` 처럼
 * 다른 판정과 한 조건에 함께 선다. 그래서 조건 안쪽은 **문장 경계(`;`·`{`·`}`)까지** 본다.
 */
function hasHandlerGuard(code: string, mutationName: string): boolean {
  return new RegExp(`if\\s*\\([^;{}]*\\b${mutationName}\\.isPending[^;{}]*\\)\\s*return\\s*;`).test(code);
}

/** 이름을 묻지 않는 같은 바늘 — 관례가 몇 자리에 서 있는지를 센다. */
const ANY_HANDLER_GUARD = /if\s*\([^;{}]*\.isPending[^;{}]*\)\s*return\s*;/g;

/**
 * ⚠️⚠️ **핵심 루프 가드의 정규형** — 문자열도 호출도 없고, **링크 단위**다(리뷰 M-1).
 *
 * `hasHandlerGuard`는 조건 안쪽을 문장 경계까지 보므로 **뮤테이션 단위 가드도 `handler-blocks`로
 * 받는다** — 판정만 물면 라운드 91 A의 넓은 조건으로 되돌리는 걸음이 조용히 지나간다. 그래서
 * 이 정규형이 그 자리를 메운다: 조건이 `…isPending`과 `…variables?.id === <인자>.id`를 **둘 다**
 * 지녀야 지난다.
 */
const LINK_SCOPED_GUARD =
  /^if \([A-Za-z_$][\w$]*\.isPending && [A-Za-z_$][\w$]*\.variables\?\.id === [A-Za-z_$][\w$]*\.id\) return;$/;

/** ⓐ 모집단 — 손 목록이 아니라 전수에서 파생한다. */
function collectMutationSites(): MutationSite[] {
  const sites: MutationSite[] = [];
  for (const file of listSweptFiles()) {
    const raw = readSweptSource(file);
    const code = maskComments(raw);
    // 선언을 셀 때는 문자열 **내용**까지 걷는다 — 소스를 인용해 둔 표가 자리를 만들지 않게.
    const declarationView = maskComments(raw, { strings: true });
    const declaration = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*useMutation\s*[(<]/g;
    let match: RegExpExecArray | null;
    while ((match = declaration.exec(declarationView)) !== null) {
      const name = match[1];
      const via = controlPath(code, name);
      const verdict: PressVerdict =
        via !== null ? "control-blocks" : hasHandlerGuard(code, name) ? "handler-blocks" : "does-not-block";
      sites.push({ file, name, verdict, via: via ?? [] });
    }
  }
  return sites;
}

function siteKey(site: { readonly file: string; readonly name: string }): string {
  return `${site.file}::${site.name}`;
}

const sweptFiles = listSweptFiles();
const mutationSites = collectMutationSites();
const byVerdict = (verdict: PressVerdict): MutationSite[] => mutationSites.filter((site) => site.verdict === verdict);

describe("마스킹 — 이 자가 무엇을 걷는지 픽스처가 보여 준다", () => {
  const fixture = [
    "// const ghost = useMutation({ 주석 안의 인용",
    "/* const phantom = useMutation({ 블록 안의 인용 */",
    'const table = "const quoted = useMutation({";',
    "const real = useMutation({ mutationFn: send });"
  ].join("\n");

  it("주석은 걷고 코드는 남긴다 — 그리고 길이가 보존된다", () => {
    const code = maskComments(fixture);
    expect(code).toHaveLength(fixture.length);
    expect(code).not.toContain("const ghost");
    expect(code).not.toContain("const phantom");
    expect(code).toContain("const real = useMutation({");
    // 문자열 **내용**은 기본 걸음에서 남는다 — 그래서 선언 계수는 아래 걸음을 한 번 더 쓴다.
    expect(code).toContain("const quoted = useMutation({");
  });

  it("문자열까지 걷는 걸음은 인용된 선언을 세지 않는다", () => {
    const view = maskComments(fixture, { strings: true });
    expect(view).toHaveLength(fixture.length);
    expect(view).not.toContain("const quoted");
    expect(view).toContain("const real = useMutation({");
    const declarations = view.match(/\bconst\s+[A-Za-z_$][\w$]*\s*=\s*useMutation\s*[(<]/g) ?? [];
    expect(declarations).toHaveLength(1);
  });

  it("오늘 이 모집단에서 마스킹이 지우는 선언은 0이다 — 0인 것은 오늘의 값이지 규율이 아니다", () => {
    let rawDeclarations = 0;
    for (const file of sweptFiles) {
      rawDeclarations += (
        readSweptSource(file).match(/\bconst\s+[A-Za-z_$][\w$]*\s*=\s*useMutation\s*[(<]/g) ?? []
      ).length;
    }
    const maskingDeltaToday = rawDeclarations - mutationSites.length;
    expect(maskingDeltaToday).toBe(0);
  });
});

describe("ⓐ 모집단 — 전수에서 파생한다", () => {
  it("스윕 경계가 값으로 서 있다 — 이 파일은 저장소 그물 열다섯의 하나가 아니다", () => {
    expect(SWEEP_ROOTS).toEqual(["app", "src"]);
    expect(SWEEP_SCOPE_LABEL).toBe("apps/mobile/{app,src}/**");
    for (const file of sweptFiles) {
      expect(file.startsWith("app/") || file.startsWith("src/")).toBe(true);
      expect(file).not.toContain("..");
    }
  });

  it("유령 방지 — 모집단이 0건이 아니고 정찰의 하한을 넘는다", () => {
    expect(sweptFiles.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.sweptFiles);
    expect(mutationSites.length).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.mutationSites);
  });

  it("정찰이 쓴 좁은 바늘(직접 `disabled={…isPending…}`)도 오늘 다시 재면 하한을 넘는다", () => {
    let direct = 0;
    for (const site of mutationSites) {
      const code = maskComments(readSweptSource(site.file));
      if (disabledExpressions(code).some((expression) => expression.includes(`${site.name}.isPending`))) {
        direct += 1;
      }
    }
    expect(direct).toBeGreaterThanOrEqual(SCOUT_LOWER_BOUNDS.directDisabledSites);
  });

  it("⚠️ 모집단은 손 목록이 아니다 — 저장소의 손 목록은 이 전수의 부분집합이고 그보다 작다", () => {
    // 무효화 정책 대장(`src/query/shared-cache-policy.ts`)은 뮤테이션 자리를 **손으로** 적어 둔
    // 유일한 목록이다(문자열 리터럴 안의 `sliceStart`·`sliceEnd` 열넷 · 이름 열하나).
    // 이 스윕은 그 목록을 모집단으로 쓰지 않는다 — 고치려는 병이 정확히 *손으로 적은 모집단*이다.
    // 여기서는 그 목록을 **비교 대상으로만** 읽어, 손이 전수보다 작다는 사실을 값으로 남긴다.
    const hand = readSweptSource("src/query/shared-cache-policy.ts");
    const quoted = hand.match(/const ([A-Za-z_$][\w$]*) = useMutation\(\{/g) ?? [];
    const handNames = new Set(quoted.map((line) => line.slice("const ".length, line.indexOf(" = useMutation"))));
    expect(handNames.size).toBeGreaterThan(0);
    const derivedNames = new Set(mutationSites.map((site) => site.name));
    for (const name of handNames) expect(derivedNames.has(name)).toBe(true);
    expect(handNames.size).toBeLessThan(mutationSites.length);
  });
});

describe("ⓑ 판정 셋 — 자리마다 소스에서 하나가 나온다", () => {
  it("모든 자리가 셋 중 하나로 갈린다", () => {
    const verdicts = new Set(mutationSites.map((site) => site.verdict));
    for (const verdict of verdicts) {
      expect(["control-blocks", "handler-blocks", "does-not-block"]).toContain(verdict);
    }
    expect(byVerdict("control-blocks").length + byVerdict("handler-blocks").length + byVerdict("does-not-block").length).toBe(
      mutationSites.length
    );
  });

  it("컨트롤이 막는 자리는 줄지 않는다", () => {
    expect(byVerdict("control-blocks").length).toBeGreaterThanOrEqual(CONTROL_BLOCKING_FLOOR);
  });

  it("한 걸음 거쳐 막는 자리가 실재한다 — 정찰이 *읽되 막지 않는다*로 셌던 둘", () => {
    const indirect = byVerdict("control-blocks").filter((site) => site.via.length > 0);
    expect(indirect.length).toBeGreaterThanOrEqual(2);
    expect(indirect.map(siteKey)).toContain("app/settings/notifications.tsx::toggleCurrentDevice");
    expect(indirect.map(siteKey)).toContain("app/import/[importJobId].tsx::confirm");
  });

  it("막지 않는 자리는 늘지 않는다", () => {
    expect(byVerdict("does-not-block").length).toBeLessThanOrEqual(DOES_NOT_BLOCK_CEILING);
  });

  it("막지 않는 자리와 이유 대장이 정확히 같은 집합이다 — 유령도 누락도 0건", () => {
    expect(UNBLOCKED_SITES.map(siteKey).sort()).toEqual(byVerdict("does-not-block").map(siteKey).sort());
  });

  it("빈 이유 금지 — 그리고 이유는 그 파일의 코드가 증명한다", () => {
    for (const entry of UNBLOCKED_SITES) {
      expect(entry.reason.trim().length).toBeGreaterThan(20);
      const code = maskComments(readSweptSource(entry.file));
      expect(code).toContain(entry.provenBy);
    }
  });
});

describe("ⓒ 핵심 루프의 그 자리 — clickLink는 막는 쪽에 선다", () => {
  const coreLoopKey = siteKey({ file: CORE_LOOP_SITE.file, name: CORE_LOOP_SITE.mutation });
  const site = mutationSites.find((entry) => siteKey(entry) === coreLoopKey);

  it("그 자리가 모집단 안에 실재한다", () => {
    expect(site).toBeDefined();
  });

  it("판정이 `handler-blocks`다 — 다시 *막지 않는다*로 떨어지는 날 빨개진다", () => {
    expect(site?.verdict).toBe("handler-blocks");
  });

  it("가드가 핸들러의 **첫 문장**이다", () => {
    const code = maskComments(readSweptSource(CORE_LOOP_SITE.file));
    const headNeedle = `const ${CORE_LOOP_SITE.handler} = (`;
    const headIndex = code.indexOf(headNeedle);
    expect(headIndex).toBeGreaterThan(-1);
    const braceIndex = code.indexOf("{", code.indexOf("=>", headIndex));
    expect(braceIndex).toBeGreaterThan(headIndex);
    const body = balancedBody(code, braceIndex, "{", "}");
    expect(body).not.toBeNull();
    expect((body ?? "").trim().startsWith(CORE_LOOP_SITE.guard)).toBe(true);
  });

  it("답은 발명이 아니라 인용이다 — 관례 일곱이 **오늘도 소스에** 서 있다 (실측)", () => {
    // ⚠️⚠️ 두 시점(리뷰 L-4). 종전 이 자리의 마지막 줄은 `precedents`에 **표에 적힌 수**를 더해
    //    놓고 그 합이 일곱인지를 물었다 — 표만 읽고 소스를 한 번도 재지 않는 **항진 단언**이라,
    //    세 파일에서 관례가 통째로 사라져도 초록이었다. 오늘은 **실측 쪽**을 문다.
    let declared = 0;
    let measured = 0;
    for (const entry of GUARD_PRECEDENTS) {
      const code = maskComments(readSweptSource(entry.file));
      const found = (code.match(ANY_HANDLER_GUARD) ?? []).length;
      expect(found, `${entry.file}에 선 관례 자리`).toBeGreaterThanOrEqual(entry.count);
      declared += entry.count;
      measured += found;
    }
    // ⚠️ 무는 것은 **소스에서 실제로 센 수**다(하한 — 관례가 늘어도 초록이다).
    expect(measured, "세 본보기 파일에서 오늘 실제로 센 관례 자리").toBeGreaterThanOrEqual(
      GUARD_PRECEDENT_FLOOR
    );
    // 그리고 아래 한 줄은 **소스가 아니라 표를 검산한다**(표 무결성 — 손으로 적은 수의 합).
    expect(declared, "GUARD_PRECEDENTS 표에 적힌 수의 합 (표 무결성 검산)").toBe(GUARD_PRECEDENT_FLOOR);
  });

  it("핸들러가 막는 자리는 오늘 그 하나다 — 컨트롤이 막는 자리가 더 강한 판정이라 그쪽으로 센다", () => {
    expect(byVerdict("handler-blocks").map(siteKey)).toEqual([coreLoopKey]);
  });
});

/**
 * ⓓ의 대장 — ⚠️⚠️ **라운드 90 트랙 B의 sha256 형식을 그대로 인용한다**
 * (`apps/admin/src/admin-landmark-current.test.ts`의 `ELEMENT_LEDGER` · 그 파일 `:337-354`).
 *
 * ⚠️⚠️ **두 시점(리뷰 M-4) — 종전 이 절의 머리말은 *"렌더 바이트 불변"* 이라고 적었지만 아래가
 * 실제로 물던 것은 **속성 이름과 그 순서**뿐이었다.** 이름과 순서를 지키면서 값은 얼마든지
 * 바꿀 수 있으므로(`style={{ flex: 1 }}` → `style={{ flex: 2 }}`) 그 낱말은 실측보다 넓었다.
 * 오늘 그 자리를 **한 줄로 실효**시킨다: 누르는 자리 **두 여는 태그의 전체 바이트**를 해시로 문다.
 *
 * 각 줄은 `<태그> :: <sha256 앞 12> :: <미리보기>`이고, 해시가 도는 대상은
 * `<태그이름 + 속성 전체 + '>'`의 **마스킹된 바이트 전부**다 — 속성 이름·순서·값·공백·줄바꿈
 * 가운데 한 글자라도 달라지면 해시가 갈린다(= 픽셀이 바뀔 수 있는 자리가 바뀌면 빨개진다).
 *
 * ⚠️ **값은 손으로 지은 것이 아니라 HEAD(`8daa27f`)의 바이트에서 떴고**, 워킹트리에서 다시 뜬
 * 해시가 두 자리 다 그것과 같았다(트랙 A도 이번 리뷰도 이 두 태그를 한 글자도 고치지 않았다).
 * ⚠️ 미리보기는 **읽으라고** 있다 — 해시만 있으면 빨개졌을 때 무엇이 달라졌는지 알 수 없다.
 */
const PRESS_SITE_LEDGER: readonly string[] = [
  "ProductComparisonRow :: 63c08fe2b5a8 :: <ProductComparisonRow primaryAction={hasSession && index === filledPurchaseRowIndex} seller={lin",
  'PrimaryButton :: f905e44921d0 :: <PrimaryButton label="바로 구매하기" onPress={() => handleProductLinkPress(primaryPurchaseLink)} style'
];

describe("ⓓ 렌더 바이트 불변 — 누르는 자리 둘의 여는 태그가 종전 바이트와 같다(해시 · 부정 단언)", () => {
  function sha12(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex").substring(0, 12);
  }

  function preview(text: string): string {
    return text.replace(/\s+/g, " ").substring(0, 96);
  }

  /** 여는 태그 전수 — 속성 안의 `{…}`(화살표 함수 포함)를 넘어서 `>`를 찾는다. */
  function openTags(code: string): { tag: string; body: string }[] {
    const out: { tag: string; body: string }[] = [];
    const opener = /<([A-Z][A-Za-z0-9_.]*)/g;
    let match: RegExpExecArray | null;
    while ((match = opener.exec(code)) !== null) {
      let depth = 0;
      let quote: string | null = null;
      let i = match.index + match[0].length;
      for (; i < code.length; i += 1) {
        const char = code[i];
        if (quote !== null) {
          if (char === "\\") i += 1;
          else if (char === quote) quote = null;
          continue;
        }
        if (char === '"' || char === "'" || char === "`") {
          quote = char;
          continue;
        }
        if (char === "{") depth += 1;
        else if (char === "}") depth -= 1;
        else if (char === ">" && depth === 0) break;
      }
      out.push({ tag: match[1], body: code.slice(match.index + match[0].length, i) });
    }
    return out;
  }

  function attributeNames(body: string): string[] {
    const names: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let i = 0;
    while (i < body.length) {
      const char = body[i];
      if (quote !== null) {
        if (char === "\\") i += 2;
        else {
          if (char === quote) quote = null;
          i += 1;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        i += 1;
        continue;
      }
      if (char === "{") {
        depth += 1;
        i += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        i += 1;
        continue;
      }
      if (depth === 0) {
        const named = /^([A-Za-z][A-Za-z0-9_]*)\s*=/.exec(body.slice(i));
        if (named !== null) {
          names.push(named[1]);
          i += named[0].length;
          continue;
        }
      }
      i += 1;
    }
    return names;
  }

  const pressSites = openTags(maskComments(readSweptSource(CORE_LOOP_SITE.file))).filter((tag) =>
    tag.body.includes(CORE_LOOP_SITE.handler)
  );

  it("그 핸들러를 무는 자리는 정확히 둘이다", () => {
    expect(pressSites.map((tag) => tag.tag)).toEqual(["ProductComparisonRow", "PrimaryButton"]);
  });

  it("⚠️⚠️ 두 여는 태그의 **전체 바이트**가 종전과 같다 (sha256 · 리뷰 M-4)", () => {
    const rebuilt = pressSites.map((tag) => {
      const full = `<${tag.tag}${tag.body}>`;
      return `${tag.tag} :: ${sha12(full)} :: ${preview(full)}`;
    });
    expect(rebuilt).toEqual([...PRESS_SITE_LEDGER]);
    // 유령 방지 — 대장이 비었거나 자리가 사라지면 위 등호가 조용히 통과하지 않게.
    expect(PRESS_SITE_LEDGER).toHaveLength(2);
    expect(rebuilt.every((line) => line.split(" :: ")[1].length === 12)).toBe(true);
    // 그리고 그 해시가 **실제로 바이트를 무는지**를 픽스처로 보인다(한 글자만 바꿔도 갈린다).
    const nudged = `<${pressSites[1].tag}${pressSites[1].body} >`;
    expect(sha12(nudged)).not.toBe(sha12(`<${pressSites[1].tag}${pressSites[1].body}>`));
  });

  it("속성 이름과 **순서**가 종전 그대로다 (해시가 갈렸을 때 어디가 갈렸는지 읽는 자리)", () => {
    expect(attributeNames(pressSites[0].body)).toEqual(["primaryAction", "seller", "price", "caption", "onPress"]);
    expect(attributeNames(pressSites[1].body)).toEqual(["label", "onPress", "style"]);
  });

  it("⚠️ 두 자리 어디에도 `disabled`가 붙지 않는다 — 대기 창 동안 픽셀이 바뀌면 안 된다", () => {
    for (const tag of pressSites) {
      expect(attributeNames(tag.body)).not.toContain("disabled");
      expect(tag.body).not.toContain("isPending");
    }
  });

  it("`disabled`를 고르지 않은 이유가 UI 소스에 그대로 있다", () => {
    const ui = maskComments(readSweptSource("src/ui.tsx"));
    // PrimaryButton: disabled면 배경이 gray300이 된다 — 승인 캡처(ITEM-002 · DSN-053)의 픽셀이 바뀐다.
    expect(ui).toContain("backgroundColor: disabled ? theme.colors.gray300");
    // ProductComparisonRow: `disabled` 프롭이 아예 없다.
    const rowIndex = ui.indexOf("export function ProductComparisonRow({");
    expect(rowIndex).toBeGreaterThan(-1);
    const props = balancedBody(ui, ui.indexOf("(", rowIndex), "(", ")");
    expect(props).not.toBeNull();
    expect(props ?? "").not.toContain("disabled");
  });
});

describe("ⓔ 소음 금지 — 막힌 탭은 조용히 아무 일도 하지 않는다", () => {
  const raw = readSweptSource(CORE_LOOP_SITE.file);
  const code = maskComments(raw);

  it("가드 한 줄에 문자열도 호출도 없다", () => {
    expect(code).toContain(CORE_LOOP_SITE.guard);
    // 문자열도 호출도 없는 모양 하나 — 문구를 세울 자리가 구조적으로 없다.
    expect(CORE_LOOP_SITE.guard).toMatch(LINK_SCOPED_GUARD);
  });

  it("⚠️ 가드가 **링크 단위**다 — 대기 창에 다른 판매처를 누르면 그 링크는 통과한다", () => {
    // ⚠️⚠️ 두 시점(리뷰 M-1). 라운드 91 A의 조건은 뮤테이션 단위라 **누른 적 없는 다른 판매처
    // 행까지** 삼켰다. 오늘의 조건은 핸들러가 받은 그 링크와 `variables`를 견주어 **같은 링크의
    // 두 번째 탭만** 떨어뜨린다 — 중복 기록은 언제나 같은 링크에서 나므로 막는 힘은 그대로다.
    expect(CORE_LOOP_SITE.guard).toContain(`${CORE_LOOP_SITE.mutation}.variables?.id`);
    expect(CORE_LOOP_SITE.guard).toContain(`=== ${CORE_LOOP_SITE.guardArgument}.id`);
    // 핸들러가 실제로 그 이름의 인자를 받는다(가드가 무는 것이 유령 이름이 아니다).
    expect(code).toContain(`const ${CORE_LOOP_SITE.handler} = (${CORE_LOOP_SITE.guardArgument}: `);
    // 누르는 자리 둘이 **서로 다른 링크**를 넘긴다 — 그래서 뮤테이션 단위 조건이 틀렸다.
    const pressedArguments = [...code.matchAll(/handleProductLinkPress\(([A-Za-z_$][\w$]*)\)/g)].map(
      (match) => match[1]
    );
    expect(pressedArguments).toEqual(["link", "primaryPurchaseLink"]);
    expect(new Set(pressedArguments).size).toBe(2);
  });

  it("⚠️ 교란 — 넓은(뮤테이션 단위) 가드로 되돌리면 이 계약이 빨개진다", () => {
    const wide = `if (${CORE_LOOP_SITE.mutation}.isPending) return;`;
    // 되돌린 줄은 오늘의 정규형을 지나지 못한다 — 이 단언이 그 되돌림을 무는 자리다.
    expect(wide).not.toMatch(LINK_SCOPED_GUARD);
    expect(wide).not.toContain(`=== ${CORE_LOOP_SITE.guardArgument}.id`);
    // ⚠️ 그리고 판정 함수는 넓은 모양도 `handler-blocks`로 받는다(문장 경계까지 보는 바늘이다) —
    //    그래서 판정만 물면 되돌림이 조용히 지나간다. 정규형이 그 자리를 메운다.
    expect(hasHandlerGuard(wide, CORE_LOOP_SITE.mutation)).toBe(true);
    expect(hasHandlerGuard(CORE_LOOP_SITE.guard, CORE_LOOP_SITE.mutation)).toBe(true);
  });

  it("새 낭독 0건 — 이 화면은 낭독 API를 부르지 않는다", () => {
    expect(code).not.toContain("AccessibilityInfo");
    expect(code).not.toContain("announceForAccessibility");
  });

  it("새 한국어 리터럴 0건 — 화면의 한국어 문자열 수가 종전 그대로다", () => {
    const literals = code.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
    const korean = literals.filter((literal) => /[가-힣]/.test(literal));
    // ⚠️⚠️ **등호다 — 그리고 등호인 것이 이 단언의 뜻이다**(리뷰 L-5). 이 자가 무는 것은
    //    *"이 트랙이 문구를 더하지 않았다"* 이므로 늘어도 줄어도 소리가 나야 한다. 대신 그 등호가
    //    **정당한 문구 편집까지** 막으므로, 빨개졌을 때 사람이 무엇을 해야 하는지를 함께 적는다.
    expect(
      korean,
      // 토스 이월 라운드 T-A(2026-09-05)가 44 → 40으로 옮겼다: "선물로 받았어요" 확인 Alert
      // 제거(가역 조작 무확인 — gifted-status-flow.test.ts)로 그 Alert의 문구 넷(제목·본문·
      // "취소"·"표시하기")이 정당하게 걷혔다. 연타 가드와 무관한 편집이다.
      `이 화면의 한국어 문자열이 40에서 ${korean.length}로 갈렸어요. 연타 가드는 문구를 더하지 ` +
        "않으므로, 이 수가 움직였다면 (ⓐ 이 트랙이 문구를 더했거나 (ⓑ 다른 라운드가 이 화면의 " +
        "문구를 정당하게 고친 것입니다. ⓑ라면 **이 대장을 그 라운드가 함께 갱신해야 합니다** — " +
        "이 줄의 40을 오늘의 값으로 옮기고, 그 편집이 연타 가드와 무관하다는 사실을 커밋 메시지에 " +
        "적어 주세요(값을 옮기는 것이 이 계약을 무르게 하지 않습니다: 무는 것은 *한 트랙이 문구를 " +
        "조용히 더하지 않았는가*이지 문구 수 자체가 아닙니다)."
    ).toHaveLength(40);
  });

  it("서버 0건 · 새 요청 0건 — 이 화면의 뮤테이션 수도 종전 그대로다", () => {
    const here = mutationSites.filter((site) => site.file === CORE_LOOP_SITE.file);
    expect(here.map((site) => site.name)).toContain(CORE_LOOP_SITE.mutation);
    expect(here.length).toBeLessThanOrEqual(1);
  });

  it("금지된 자리는 손대지 않았다 — 분석 페이로드·구매 확인 대기의 자리가 그대로다", () => {
    expect(code).toContain('eventName: "affiliate_link_clicked"');
    expect(code).toContain('buildAffiliateLinkClickedPayload({ platform: link.platform, screenId: "item_detail" })');
    // GAP-060 #4 — 링크가 실제로 열린 뒤에만 남는다(가드는 그 자리를 옮기지 않는다).
    expect(code).toContain("await Linking.openURL(result.redirectUrl);\n        registerPurchaseFollowup(link);");
  });
});

describe("ⓕ 사각 — 이 스윕이 못 보는 것을 값과 하한으로 적는다", () => {
  it("사각 넷이 이유와 재개 조건을 함께 진다", () => {
    expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(BLIND_SPOTS.map((spot) => spot.id)).size).toBe(BLIND_SPOTS.length);
    for (const spot of BLIND_SPOTS) {
      expect(spot.reason.trim().length).toBeGreaterThan(20);
      expect(spot.resumeCondition).toMatch(/재개 조건\((결정형|사건형)/);
      expect(spot.measure).toBeGreaterThanOrEqual(spot.floor);
    }
  });

  it("⚠️ `control-blocks` 판정이 **파일 단위**라는 사실이 값으로 적혀 있다 (리뷰 M-2)", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "control-verdict-is-file-scoped");
    expect(spot).toBeDefined();
    // ⚠️ 하한으로만 견준다 — 자리가 늘어도 초록이어야 한다(등호는 옳은 손을 막는다).
    expect(spot!.measure).toBeLessThanOrEqual(byVerdict("control-blocks").length);
    expect(spot!.measure).toBe(CONTROL_BLOCKING_FLOOR);
    // 사각이 유령이 아니다 — 그 판정이 실제로 자리를 내고 있다.
    expect(byVerdict("control-blocks").length).toBeGreaterThan(0);

    // ⚠️⚠️ 사각의 **실물**을 픽스처로 보인다: 핵심 루프의 그 파일에 `clickLink.isPending`을 물린
    //    이름을 세우고, 그 이름을 **핸들러를 부르지 않는 엉뚱한 태그**의 `disabled`에 쓴다.
    //    오늘 그 자리는 `null`(컨트롤이 막지 않는다)이고, 오염 뒤에는 길이 열린다 —
    //    즉 판정이 `handler-blocks`에서 `control-blocks`로 뒤집힌다.
    const clean = maskComments(readSweptSource(CORE_LOOP_SITE.file));
    expect(controlPath(clean, CORE_LOOP_SITE.mutation)).toBeNull();
    const contaminated = maskComments(
      `${readSweptSource(CORE_LOOP_SITE.file)}\n` +
        `const ghostDisabled = ${CORE_LOOP_SITE.mutation}.isPending;\n` +
        "<UnrelatedButton disabled={ghostDisabled} onPress={() => undefined} />\n"
    );
    expect(controlPath(contaminated, CORE_LOOP_SITE.mutation)).not.toBeNull();

    // ⚠️ **그리고 그때 조용해지지 않는다 — ⓒ가 fail-safe다.** ⓒ는 그 자리의 판정을 등호로 물고
    //    `handler-blocks`가 오늘 그 하나뿐임도 함께 무므로, 뒤집히는 순간 계약이 빨개진다.
    const contaminatedVerdict: PressVerdict =
      controlPath(contaminated, CORE_LOOP_SITE.mutation) !== null
        ? "control-blocks"
        : hasHandlerGuard(contaminated, CORE_LOOP_SITE.mutation)
          ? "handler-blocks"
          : "does-not-block";
    expect(contaminatedVerdict).not.toBe("handler-blocks");
  });

  it("`useMutation` 밖의 쓰기는 모집단 밖이다 — 그 수를 값으로 적는다", () => {
    let voidCalls = 0;
    let bareFetch = 0;
    for (const file of sweptFiles) {
      const code = maskComments(readSweptSource(file));
      voidCalls += (code.match(/\bvoid\s+[A-Za-z_$][\w$.]*\s*\(/g) ?? []).length;
      bareFetch += (code.match(/(^|[^A-Za-z0-9_$.])fetch\s*\(/g) ?? []).length;
    }
    const spot = BLIND_SPOTS.find((entry) => entry.id === "writes-outside-useMutation");
    expect(spot).toBeDefined();
    expect(bareFetch).toBe(0);
    expect(voidCalls + bareFetch).toBe(spot?.measure);
  });

  it("어드민은 이 스윕의 뿌리 밖이다 — 세는 자리가 구조적으로 0건이다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "admin-has-no-such-sweep");
    expect(spot?.measure).toBe(0);
    expect(sweptFiles.filter((file) => file.includes("admin"))).toHaveLength(0);
  });

  it("소스 대조이지 런타임이 아니다", () => {
    const spot = BLIND_SPOTS.find((entry) => entry.id === "source-not-runtime");
    expect(spot?.measure).toBe(0);
    expect(spot?.reason).toContain("소스 대조");
  });
});
