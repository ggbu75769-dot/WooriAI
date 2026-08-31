// 라운드 89 트랙 D (#4) — **재개 조건 표기 관례 대장.**
//
// `docs/operations/known-limitations.md`는 6,285줄짜리 판정 문서인데, 오늘 그 문서를 무는 단언은
// **N-4 문턱 한 줄 하나**뿐이다(AC-5의 답). 그 사이에 라운드 86 **AA-3**이 표기 관례를 하나
// 세웠다 — *"재개 조건(사건형|결정형 · 손은 안|밖)"*, 그리고 **결정형이면 그 결정을 내릴 손이
// 어디 있는지를 함께 적는다.** 관례는 두 라운드를 살아남았고, **어떤 계약도 그것을 보지 못한다.**
// 이 파일이 그 관례를 기계가 지키게 한다.
//
// ## ⚠️ 이 그물은 신설이다 — 열넷 밖이고, 서는 날 그 수는 열다섯이 된다
//
// 라운드 89 정찰의 교차 확인 목록이 센 계약 그물은 **열넷**이다(라우트 표면 · 슬라이스 가드 ·
// 오프라인 대장 · 여정 스윕 · 체크표 자기집계 · 구독 대장 · `$transaction` 상한 대장 ·
// 정책/무효화 대장 · 미러 스윕 · DNC 가드 대장 · DNC 범위 대장 · DNC 비밀값 스윕 · 문장 수 계측 ·
// 주석 관용 앵커 대장). **이 대장은 그 열넷 중 하나가 아니라 열다섯째다** — 트랙 D가 여는 것은
// 기존 그물이 아니라 **새 그물**이고, 그래서 *"계약 그물을 둘 이상 함께 여는 트랙은 0건"* 이라는
// 이 라운드의 교차 확인이 이 트랙에도 그대로 참이다
// (`CONTRACT_NETS_BEFORE_THIS_ONE` · `CONTRACT_NET_COUNT_WITH_THIS_ONE`).
//
// ## ⚠️⚠️ 이 트랙은 문서를 한 글자도 고치지 않는다 — 순서가 이 그물의 존재 이유다
//
// 라운드 88이 이 후보를 집지 않은 이유는 순환이었다: **문서를 무는 계약을 문서를 쓰는 손(트랙 F)이
// 세우면, 그것은 계약이 문서를 지키는 것이 아니라 문서가 계약을 맞추는 것이다.** 오늘 그 순환이
// 끊긴다 — **라운드 88 F가 AC절을 먼저 썼고**, 이 트랙은 그 문서를 **읽기만** 하며, F는 이 계약이
// 이미 선 뒤에 AD절을 쓴다(`known-limitations.md:6077`이 적어 둔 재개 조건의 도래).
//
// ⚠️ **그래서 계약의 모양이 그 순서를 지킨다.**
//  · 래칫은 **하한**이다(`NOTATION_RATCHET`) — 형을 밝힌 자리 수·손의 위치를 적은 자리 수가
//    **줄지 않을 것**만 묻는다. F가 AD절을 쓰며 줄을 **더해도** 이 그물은 초록이다.
//  · **상한도 전수 일치도 묻지 않는다.** *"오늘 예순하나"* 를 등호로 물면 F가 조건을 하나 더 적는
//    순간 빨개지고, 그 순간 F는 계약을 맞추려고 문서를 고치게 된다 — 이 대장이 막으려는 바로 그
//    뒤집힘이다. 오늘의 실측은 값으로만 적고(`MEASURED_TODAY`), 계약이 무는 것은 하한뿐이다.
//  · 조항이 **강제되는 자리는 하나**다: **결정형으로 표기하면서 손의 위치를 적지 않는 줄이
//    새로 서는 날**(`decisiveSitesMissingHand`). F가 새 결정형을 적을 때 관례가 그때 강제된다.
//
// ## 바늘 셋 — ⚠️ 두 수를 한 낱말로 적지 않는다
//
// 같은 문서를 어떤 바늘로 보느냐에 따라 수가 갈린다. **갈린다는 사실 자체가 값이므로** 이
// 대장은 바늘을 이름으로 갈라 각각의 수를 따로 든다(`NeedleTally` · `tallyNeedles`).
//
//  · **괄호 바늘**(`paren`) — `재개 조건(…)`의 **괄호 안**에 형이 적힌 자리만 센다. AA-3의 관례가
//    실제로 요구하는 모양이고, **이 대장의 축(ⓒ)이 무는 바늘이다**. 당시 **61** · 라운드 89 리뷰
//    **80** · 오늘(라운드 91 D) **97**.
//  · **줄 바늘**(`line`) — 줄 어디에든 *사건형|결정형* 이라는 낱말이 있으면 센다. 당시 **84** ·
//    라운드 89 리뷰 **107** · 오늘 **129**. ⚠️ **이 수는 표기가 아니라 언급까지 센다** — 차이
//    (당시 스물셋 · 오늘 서른둘)의 대부분은 *"재개 조건에는 사건형과 결정형이 있고…"* 같은
//    **관례를 논하는 산문**이다.
//    그래서 축은 이 바늘을 쓰지 않는다.
//  · **접힘 바늘**(`window`) — 줄 바늘에 **앞뒤 한 줄**을 더해 본다. 표기가 두 줄로 접힌 자리를
//    회수한다. 손의 위치는 당시 줄 바늘 **12**·접힘 바늘 **14**, 라운드 89 리뷰 **19**·**21**,
//    오늘 줄 바늘 **26**·접힘 바늘 **28** (⚠️ 접힘의 크기 둘은 세 시점 내내 같다).
//
// ⚠️⚠️ **세 시점을 함께 적는 이유**: *당시* 는 트랙 D가 이 대장을 세운 커밋(`1b597c4`)의
// 워킹트리, *라운드 89 리뷰* 는 그 라운드의 HEAD(M-4의 재실측), *오늘* 은 **라운드 91 트랙 D**다.
// 한 라운드 안에서도 문서가 자라 실측이 전부 낡았고, 두 라운드가 더 지나 또 낡았다.
// 그동안 계약은 내내 초록이었다 — 무는 것이 하한뿐이기 때문이고, 그것이 이 설계의 첫 증거다.
//
// ## ⓒ 축 — 결정형이면 손의 위치를 함께 적었을 것
//
// 괄호 바늘의 결정형 자리는 당시 **열둘** · 라운드 89 리뷰 **열아홉** · 오늘 **스물넷**이고, 손의
// 위치를 함께 적은 자리는 **열하나 · 열여덟 · 스물셋**이다 — **어긋난 하나는 세 시점 내내 같은
// 하나**다(문서가 자라는 동안 관례를 어긴 자리는 늘지 않았다).
// 그 하나(라운드 86 Z-1의 기록)는 `DECISIVE_HAND_EXEMPTIONS`에 이유·재개 조건과 함께 선다.
//
// ⚠️ **면제는 줄 번호로 신원을 삼지 않는다.** 줄 번호는 F가 위쪽에 한 문단만 더해도 밀리고,
// 밀린 순간 이 계약은 엉뚱한 줄을 면제한다. 그래서 면제 줄은 **그 문장의 조각**(`context`)으로
// 자기를 가리키고, 계약이 그 조각이 문서에 실재하는지를 확인한다.
//
// ⚠️ **그리고 면제의 유령 검사는 *문장이 살아 있는가*까지만 묻고 *오늘도 어긋나 있는가*는 묻지
// 않는다.** 여기에는 판단이 있다: 주석 관용 앵커 대장은 *"면제 줄이 오늘 실제로 걸리지 않으면
// 빨개진다"* 를 골랐지만, 이 대장이 그 형식을 그대로 쓰면 **F가 그 한 줄에 손의 위치를 적어 고치는
// 순간 이 계약이 빨개진다** — 문서를 옳게 고치는 손을 그물이 막는 모양이다. 이 트랙의 금지 조항이
// 정확히 그 뒤집힘을 막으라고 하므로, 여기서는 **F의 손을 막지 않는 쪽**을 골랐다. 그 대신
// 오늘의 어긋남 수를 값으로 적어 두고(`DECISIVE_MISSING_HAND_TODAY`), 그 수가 0이 되는 날 이
// 면제 줄을 지우는 것이 다음 라운드의 일이라고 면제 줄 자신이 적는다.
//
// ## ⓓ 소스 축 — 관례는 문서 밖에도 산다 (⚠️⚠️ 라운드 91 D: 손 하나 → 전수 파생)
//
// 라운드 87 트랙 E가 AA-3의 표기를 **소스로** 처음 가져갔다. 라운드 89·90의 이 축은 그 사실을
// **손으로 적은 한 줄**로 졌다 — `SOURCE_AXIS_FILES = [dead-export-ledger.ts]`. 그 모양은
// *"적어 둔 그 파일이 관례를 지키는가"* 만 묻고 *"관례를 지고 있는 소스가 이것뿐인가"* 는 묻지
// 못한다. **라운드 91 트랙 D가 그 손 목록을 지우고 뿌리를 건다**(`apps/**` · `packages/**`).
//
// ⚠️ **그리고 뿌리를 열자 곧바로 새 자리가 나왔다**: `contract-net-ledger.test.ts` — 라운드 90
// E가 자기 계약에 *"도래한 조건·처분은 다음 라운드 몫"* 이라고 적으며 남긴 표기다. **손 목록이
// 계속 서 있었다면 이 대장은 그 자리를 오늘도 몰랐다** — 그것이 고치려던 병의 실물이다.
//
// ⚠️⚠️ **두 시점 — 그런데 그날의 기록이 하나를 빠뜨렸다(라운드 91 리뷰 H-1).** 트랙 D는 파생
// 결과를 **둘**로 적었지만, **D 커밋 시점에도 이미 셋이었다.** 빠진 하나는 같은 라운드 트랙 C의
// `apps/api/test/harness-catalog-cost.test.ts`이고, **C(`b320ab2`)는 D(`9b65ac0`)보다 세 시간
// 앞서 머지돼 있었다** — 즉 D의 워킹트리에 그 파일이 이미 표기 넷을 지고 서 있었다. D는 뿌리를
// 열어 놓고도 그 결과를 *예상했던 둘*로 적었고, 그래서 **래칫이 실측보다 한 칸 낮은 채로 섰다**
// (셋 중 하나가 표기를 잃어도 조용한 거짓 초록). 같은 라운드의 F는 판정 문서(AF-2)에 **셋**이라고
// 옳게 적었으므로, **오늘 어긋나 있던 것은 사실이 아니라 이 파일의 값 하나**다.
//
// 오늘의 파생 결과는 **셋**이고(좁은 바늘 6+1+4=11 · 넓은 바늘 9+2+4=15), 걷은 파일은 **966**이다
// (⚠️ 걷은 수는 다른 트랙이 파일을 더하는 동안에도 움직인다 — 그래서 계약은 하한만 문다).
//
// ⚠️ **세 파일 다 이 대장은 읽기만 한다** — 그래서 자리별 하한은 여전히 아래쪽만 막는다
// (`SOURCE_AXIS_FLOORS`: `dead-export-ledger.ts` **셋**, 오늘 처음 걸린 자리는 **0**). 대신
// 뿌리를 걷는 축에는 손 목록에 없던 조항이 하나 붙는다 — **표기를 지닌 소스 수의 래칫**
// (`SOURCE_COUNT_RATCHET` = **3**, 리뷰 H-1이 2에서 올렸다): 관례가 지워지는 날 목록에서 줄을
// 지워 조용해질 곳이 없다.
// ⚠️⚠️ **자리별 하한의 예측은 세 번 빗나갔고 방향은 매번 위쪽이었다**(4 → 5 → 6): 관례를 지키는
// 손은 조건을 닫으면서 새 조건을 남긴다. **하한은 그래도 셋 그대로다.**
//
// ## ⓕ 자기 배제 — 대장은 자기를 세지 않는다
//
// 이 파일과 그 계약 파일에는 재개 조건 표기가 **값과 설명으로** 실려 있다(면제 줄의 조건 · 사각의
// 재개 조건). 모집단에 들어오는 순간 이 대장은 자기 자신을 세게 되고, 그러면 다음 사람이 고치는
// 방법은 자기를 면제에 적는 것뿐이다 — 그 순간 면제 목록이 문을 연다(라운드 84 B · 85 E · 88 C가
// 같은 자리에 적은 규율). `LEDGER_SELF_FILES`가 그 배제를 값으로 진다.
//
// ## ⚠️ 사각 — 이 수들은 상한이 아니라 하한이다
//
// AB-5의 규율을 태어날 때부터 진다(`LEDGER_BLIND_SPOTS`). 이 대장이 세는 예순하나는 *"저장소에
// 형을 밝힌 재개 조건이 예순하나뿐이다"* 가 아니라 *"이 모집단·이 바늘 안에서 예순하나가
// 풀렸다"* 는 뜻이다. 밖에 남은 것은 사각마다 오늘 잰 값과 하한을 진다 — 가장 큰 것이
// **라운드 노트(`docs/5차/**`) 319**이고, 그다음이 **형 표기가 아예 없는 산문 조건**
// (당시 119 · 라운드 89 리뷰 145 · 오늘 **165**)이다.
// ⚠️ **라운드 91 D가 소스 축을 넓히며 사각이 여섯에서 여덟이 됐다** — 넓힌 축은 넓힌 만큼 새
// 사각을 진다: **표기의 실재만 셀 뿐 조건의 도래를 묻지 않는다**(`source-notation-existence` —
// D가 7로 적었고 오늘 재니 **11**) · **표기 없는 소스의 산문 조건은 이 뿌리 밖이다**
// (`unmarked-source-prose` — D가 48로 적었고 오늘 **68**).
//
// ## ⚠️ 전제 재실측 — 정찰의 다섯 수 중 넷이 그대로이고 하나는 바늘이 갈렸다
//
// 정찰(`docs/5차/round89-scout.md`)이 적은 수는 **203 · 61 · 84 · 11 · 14**다. **트랙 D 시점의**
// 워킹트리에서 다시 세니 **203 · 61 · 84 · 11 · 12**이고, 마지막 하나는 **틀린 것이 아니라 바늘이
// 다르다**: 손의 위치가 **다음 줄로 접힌 자리 둘**을 함께 세면 정확히 **14**가 된다(`window` 바늘).
// 그래서 이 대장은 손의 위치를 **두 수로** 든다 — 줄 바늘 12 · 접힘 바늘 14(`SCOUT_NEEDLE_VALUES`).
// ⚠️ **두 시점**: 위 다섯 수는 **정찰과 D의 대조 기록**이라 그대로 둔다(그날의 대조가 이 대장의
// 바늘 셋을 갈라 낸 근거다). 같은 라운드 HEAD의 실측은 **252 · 80 · 107 · 18 · 21**이고, 그 값은
// `MEASURED_TODAY`가 진다 — 두 표가 서로 다른 시점을 말한다는 사실 자체를 값으로 남긴다
// (라운드 89 리뷰 M-4).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/**
 * 이 대장 자신의 두 파일 — ⓕ **모집단에 넣지 않는다.**
 *
 * ⚠️⚠️ **라운드 91 트랙 D에서 이 줄이 일을 하기 시작했다.** 라운드 89·90에는 이 배제가
 * *모집단 정의에서 이미 참*이었다(모집단이 판정 문서 하나와 손으로 적은 소스 하나뿐이라 이
 * 파일들이 들어올 길이 없었다) — **우연이었다.** 오늘 소스 축이 `apps/**`·`packages/**`를
 * 걷자 그 우연이 끝났다: 이 두 파일은 `⚠️ 재개 조건(…)` 표기를 실제로 지고 있어서, 배제가
 * 없으면 파생 결과가 **둘이 아니라 넷**이 되고 이 대장은 **자기를 세는 축**이 된다.
 * 배제는 `readSourceAxisEntries`가 **걷는 자리에서** 진다(모집단마다 따로 적지 않는다).
 */
export const LEDGER_SELF_FILES = [
  "packages/test-utils/src/resume-condition-ledger.ts",
  "packages/test-utils/src/resume-condition-ledger.test.ts"
] as const;

/**
 * 이 대장이 서기 전의 계약 그물 열넷(라운드 89 정찰의 교차 확인 목록 그대로).
 *
 * ⚠️ 이 대장은 그 열넷 중 하나가 아니라 **열다섯째**다.
 */
export const CONTRACT_NETS_BEFORE_THIS_ONE = [
  "라우트 표면",
  "슬라이스 가드",
  "오프라인 대장",
  "여정 스윕",
  "체크표 자기집계",
  "구독 대장",
  "$transaction 상한 대장",
  "정책/무효화 대장",
  "미러 스윕",
  "DNC 가드 대장",
  "DNC 범위 대장",
  "DNC 비밀값 스윕",
  "문장 수 계측",
  "주석 관용 앵커 대장"
] as const;

/** 이 대장이 서는 날의 수 — **열다섯**. */
export const CONTRACT_NET_COUNT_WITH_THIS_ONE = CONTRACT_NETS_BEFORE_THIS_ONE.length + 1;

// ── 모집단 ────────────────────────────────────────────────────────────────────

export type LedgerDocument = {
  /** 저장소 상대 경로. */
  readonly path: string;
  /** 왜 이 문서인가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
  /** 오늘 실측한 자리 수의 하한(유령 방지 — 모집단이 0건이 아님을 값으로 보인다). */
  readonly minSites: number;
};

/**
 * 모집단은 **판정 문서 하나**다.
 *
 * ⚠️ `docs/5차/**`(라운드 노트)는 넣지 않는다 — 라운드별 **작업 기록**이지 판정 문서가 아니고,
 * 넣으면 이 대장의 수가 매 라운드 통째로 흔들려 래칫이 뜻을 잃는다. 그 자리 수는 사각이 값으로
 * 진다(`round-notes`).
 */
export const LEDGER_DOCUMENT: LedgerDocument = {
  path: "docs/operations/known-limitations.md",
  reason:
    "AA-3의 표기 관례가 태어난 문서이고, 재개 조건이 판정과 함께 사는 유일한 판정 문서다. " +
    "짝 문서 둘(runtime-verification-required.md · accessibility-offline-checklist.md)에는 " +
    "오늘 자리가 각각 다섯·넷이고(트랙 D 시점에는 하나·셋이었다 — 라운드 89 리뷰 M-4 재실측) " +
    "그중 형을 괄호로 밝힌 것은 여전히 하나(C-12의 사건형)뿐이며 **이 계약의 축이 무는 " +
    "결정형은 오늘도 0건**이라, 넣으면 축이 아무것도 지키지 못하는 뿌리가 하나 늘어난다.",
  minSites: 180
};

/** 재개 조건이 선 자리인가 — 이 대장이 **자리**를 세는 단위는 **줄**이다. */
export const RESUME_SITE = /재개\s*(?:조건|트리거)/;

/** 형 낱말(사건형 · 결정형). */
export const TYPE_WORD = /사건형|결정형/;

/** 결정형 낱말. */
export const DECISIVE_WORD = /결정형/;

/**
 * 손의 위치 어구.
 *
 * ⚠️ 문서는 *"손은 저장소 안"* 을, 소스는 *"손은 안"* 을 쓴다 — **둘 다 같은 관례**이므로 한
 * 바늘이 둘을 다 본다(관례를 좁게 읽어 소스 쪽을 어긋남으로 세면 이 대장은 첫날부터 거짓 빨강이다).
 */
export const HAND_PHRASE = /손은\s*(?:저장소\s*)?(?:안|밖)/;

/** `재개 조건(…)` 의 괄호 — 전역 플래그를 쓰므로 **부를 때마다 새로 만든다**(`lastIndex` 공유 금지). */
export function parenthesisedTypeNeedle(): RegExp {
  return /재개\s*(?:조건|트리거)\s*[（(]([^）)]*)[）)]/g;
}

export type ResumeSite = {
  /** 저장소 상대 경로. */
  readonly file: string;
  /** 1부터 세는 줄 번호 — **사람이 찾아가는 용도이지 신원이 아니다**(줄은 밀린다). */
  readonly line: number;
  /** 그 줄의 원문. */
  readonly text: string;
  /** 괄호 안에서 형이 밝혀진 표기들(둘 이상일 수 있다). */
  readonly parenthesised: readonly string[];
  /** 괄호 바늘: 형을 괄호로 밝혔는가. */
  readonly parenTyped: boolean;
  /** 괄호 바늘: 그 괄호 안이 **결정형**인가. */
  readonly parenDecisive: boolean;
  /** 괄호 바늘: 그 괄호 안에 손의 위치가 함께 있는가. */
  readonly parenHand: boolean;
  /** 줄 바늘: 줄 어디에든 형 낱말이 있는가. */
  readonly lineTyped: boolean;
  /** 줄 바늘: 줄 어디에든 손의 위치 어구가 있는가(형이 있는 줄에서만 뜻이 있다). */
  readonly lineHand: boolean;
  /** 접힘 바늘: 앞뒤 한 줄까지 보아 손의 위치가 있는가. */
  readonly windowHand: boolean;
  /** 세 갈래 — 전수가 이 셋 중 정확히 하나에 든다(ⓐ). */
  readonly bucket: "paren-typed" | "line-typed-only" | "prose";
};

/** 한 텍스트에서 재개 조건 자리를 **전수로** 걷는다. */
export function collectResumeSites(text: string, file: string): readonly ResumeSite[] {
  const lines = text.split("\n");
  const sites: ResumeSite[] = [];

  lines.forEach((line, index) => {
    if (!RESUME_SITE.test(line)) return;

    const needle = parenthesisedTypeNeedle();
    const parenthesised: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = needle.exec(line)) !== null) {
      if (TYPE_WORD.test(match[1])) parenthesised.push(match[1]);
    }

    const parenTyped = parenthesised.length > 0;
    const parenDecisive = parenthesised.some((inner) => DECISIVE_WORD.test(inner));
    const parenHand = parenthesised.some((inner) => HAND_PHRASE.test(inner));
    const lineTyped = TYPE_WORD.test(line);
    const lineHand = lineTyped && HAND_PHRASE.test(line);
    const window = [lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join("\n");
    const windowHand = lineTyped && HAND_PHRASE.test(window);

    sites.push({
      file,
      line: index + 1,
      text: line,
      parenthesised,
      parenTyped,
      parenDecisive,
      parenHand,
      lineTyped,
      lineHand,
      windowHand,
      bucket: parenTyped ? "paren-typed" : lineTyped ? "line-typed-only" : "prose"
    });
  });

  return sites;
}

/** 모집단 문서를 읽어 자리를 전수로 걷는다. */
export function collectDocumentSites(baseDir: string = repoRoot): readonly ResumeSite[] {
  const absolute = join(baseDir, LEDGER_DOCUMENT.path);
  return collectResumeSites(readFileSync(absolute, "utf8"), LEDGER_DOCUMENT.path);
}

/** 한 줄에 표기가 둘 이상 있어도 자리는 하나로 센다 — 그 차이를 값으로 들기 위한 수. */
export function countMentions(text: string): number {
  return (text.match(/재개\s*(?:조건|트리거)/g) ?? []).length;
}

// ── 바늘 셋 ───────────────────────────────────────────────────────────────────

export type NeedleTally = {
  /** 형을 밝힌 자리 수. */
  readonly typed: number;
  /** 손의 위치까지 함께 적은 자리 수. */
  readonly hand: number;
};

export type NeedleTallies = {
  /** 괄호 안만 보는 바늘 — **축이 무는 바늘**. */
  readonly paren: NeedleTally;
  /** 줄 전체를 보는 바늘. */
  readonly line: NeedleTally;
  /** 줄 전체 + 앞뒤 한 줄(접힌 표기 회수). */
  readonly window: NeedleTally;
};

/**
 * 바늘 셋의 수를 **각각** 낸다.
 *
 * ⚠️ 이 함수가 돌려주는 것은 **셋으로 갈린 수**다 — 하나로 합친 수를 돌려주는 자리는 이 파일에
 * 없다(*"두 수를 한 낱말로 적지 않는다"*).
 */
export function tallyNeedles(sites: readonly ResumeSite[]): NeedleTallies {
  return {
    paren: {
      typed: sites.filter((site) => site.parenTyped).length,
      hand: sites.filter((site) => site.parenTyped && site.parenHand).length
    },
    line: {
      typed: sites.filter((site) => site.lineTyped).length,
      hand: sites.filter((site) => site.lineHand).length
    },
    window: {
      typed: sites.filter((site) => site.lineTyped).length,
      hand: sites.filter((site) => site.windowHand).length
    }
  };
}

// ── 하한 래칫 ─────────────────────────────────────────────────────────────────

export type NotationRatchet = {
  /** 재개 조건 자리 전수의 하한. */
  readonly sites: number;
  /** 괄호 바늘 — 형 표기 하한. */
  readonly parenTyped: number;
  /** 괄호 바늘 — 손의 위치 하한. */
  readonly parenHand: number;
  /** 줄 바늘 — 형 표기 하한. */
  readonly lineTyped: number;
  /** 줄 바늘 — 손의 위치 하한. */
  readonly lineHand: number;
  /** 접힘 바늘 — 손의 위치 하한. */
  readonly windowHand: number;
};

/**
 * ⚠️⚠️ **전부 하한이다. 상한이 아니고 전수 일치도 아니다.**
 *
 * 이 수들이 묻는 것은 하나뿐이다 — *"형을 밝힌 자리와 손의 위치를 적은 자리가 **줄지 않았는가**"*.
 * F가 AD절을 쓰며 조건을 더하면 실측은 올라가고 이 그물은 그대로 초록이다. 실측이 **내려가는**
 * 날에만 소리가 난다: 관례를 지키던 줄이 지워졌거나, 형 표기 없이 다시 쓰였다는 뜻이다.
 *
 * ⚠️ **이 수를 낮추려면 이 파일을 열어 왜 낮추는지를 적어야 한다.**
 *
 * ⚠️ **두 시점 — 오늘의 실측은 이 하한보다 한참 위다.** 세울 때는 하한과 실측이 같은 수였지만
 * (`203 · 61 · 11 · 84 · 12 · 14`), 같은 라운드의 C·F가 조건을 더하며 실측이 `252 · 80 · 18 ·
 * 107 · 19 · 21`로 올라갔다(`MEASURED_TODAY`). **하한은 일부러 그대로 둔다** — 하한을 실측에
 * 붙여 올리는 것은 *"문서가 여기서 한 줄이라도 줄면 빨강"* 이라는 뜻이고, 그것은 F가 판정을
 * 다듬는 손까지 막는다. 이 그물이 지키려는 것은 **관례가 지워지지 않는 것**이지 문서의 크기가
 * 아니다(라운드 89 리뷰 M-4에서 다시 확인한 판단).
 */
export const NOTATION_RATCHET: NotationRatchet = {
  sites: 203,
  parenTyped: 61,
  parenHand: 11,
  lineTyped: 84,
  lineHand: 12,
  windowHand: 14
};

export type RatchetViolation = {
  readonly name: keyof NotationRatchet;
  readonly floor: number;
  readonly measured: number;
};

/**
 * 하한을 깬 자리들 — **비어 있어야 초록이다.**
 *
 * ⚠️ 이 함수는 *"오늘과 같은가"* 를 묻지 않는다. `measured > floor`는 언제나 통과다 —
 * 그것이 F가 줄을 더해도 이 그물이 초록인 이유이고, 계약이 이 함수만 무는 이유다.
 */
export function ratchetViolations(
  sites: readonly ResumeSite[],
  ratchet: NotationRatchet = NOTATION_RATCHET
): readonly RatchetViolation[] {
  const tallies = tallyNeedles(sites);
  const measured: Record<keyof NotationRatchet, number> = {
    sites: sites.length,
    parenTyped: tallies.paren.typed,
    parenHand: tallies.paren.hand,
    lineTyped: tallies.line.typed,
    lineHand: tallies.line.hand,
    windowHand: tallies.window.hand
  };
  const names = Object.keys(ratchet) as (keyof NotationRatchet)[];
  return names
    .filter((name) => measured[name] < ratchet[name])
    .map((name) => ({ name, floor: ratchet[name], measured: measured[name] }));
}

/**
 * 라운드 89 **HEAD**의 실측 — **기록이지 계약이 아니다.**
 *
 * 계약이 무는 것은 `NOTATION_RATCHET`(하한)뿐이고, 이 표는 *"그때 얼마였나"* 를 남긴다.
 *
 * ⚠️⚠️ **두 시점 — 이 표는 라운드 89 리뷰(M-4)가 재실측해 갱신한 값이다.**
 *  · **당시(트랙 D가 이 대장을 세운 시점 · 커밋 `1b597c4`)**: `203 · 210 · 61 · 11 · 12 · 84 ·
 *    12 · 14 · 119 · 23`. 그 시점의 워킹트리에서 정직하게 잰 수였고, 래칫과 같은 값이었다.
 *  · **오늘(같은 라운드의 HEAD)**: 아래 표. ⚠️ **같은 라운드 안에서 낡았다** — D 뒤에 머지된
 *    트랙 C(사문 대장의 `export const` 축)와 트랙 F(AD절 판정 다섯)가 판정 문서와 소스에 재개
 *    조건을 더 얹었기 때문이다. 문서는 라운드마다 자라고, **한 라운드 안에서도 자란다.**
 *
 * ⚠️⚠️ **세 시점 — 라운드 91 트랙 D가 다시 쟀고 또 낡아 있었다**: `294 · 312 · 97 · 23 · 24 ·
 * 129 · 26 · 28 · 165 · 32`. 라운드 90의 F가 판정 문서에 절을 더하며 자리가 `252 → 294`,
 * 괄호 바늘이 `80 → 97`, 결정형이 `19 → 24`로 또 올랐다. **어긋난 하나는 여전히 하나다**
 * (`DECISIVE_MISSING_HAND_TODAY`) — 문서가 세 라운드를 자라는 동안 관례를 어긴 자리는 늘지
 * 않았다는 뜻이고, 그것이 이 축이 지키는 것의 전부다.
 *
 * ⚠️ **그리고 그 사이에도 계약은 초록이었다 — 하한 설계 덕이다.** 이 대장이 `MEASURED_TODAY`를
 * 등호로 물었다면 D 다음 커밋에서 곧바로 빨개졌을 것이고, 그때 다음 사람이 고르는 쉬운 길은
 * **문서를 계약에 맞추는 것**이다(이 대장이 태어날 때부터 막으려던 그 뒤집힘). 실측이 낡는 것이
 * **정상**이고 그 낡음이 초록을 헐겁게 하지 않는다는 사실이, 하한을 고른 판단의 첫 근거다.
 * 그래서 리뷰는 **하한(`NOTATION_RATCHET`·`floor`)은 한 칸도 올리지 않고** 이 기록만 갱신한다.
 */
export const MEASURED_TODAY = {
  sites: 294,
  mentions: 312,
  parenTyped: 97,
  parenHand: 23,
  parenDecisive: 24,
  lineTyped: 129,
  lineHand: 26,
  windowHand: 28,
  prose: 165,
  lineTypedOnly: 32
} as const;

// ── ⓒ 축: 결정형이면 손의 위치를 함께 ────────────────────────────────────────

export type DecisiveHandExemption = {
  /** 그 자리의 표기 원문(괄호까지). */
  readonly notation: string;
  /**
   * 그 문장의 조각 — **면제의 신원**이다.
   *
   * ⚠️ 줄 번호를 쓰지 않는 이유: F가 위쪽에 문단 하나만 더해도 줄이 밀리고, 밀린 순간 이 면제는
   * 엉뚱한 자리를 가린다.
   */
  readonly context: string;
  /** 왜 오늘 어긋난 채로 서 있는가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
  /** ⚠️ **왜 이 트랙이 고치지 않는가.** */
  readonly whyNotFixedHere: string;
  /** 이 줄이 사라져야 하는 날. */
  readonly reopenCondition: string;
};

/**
 * 오늘 **결정형으로 표기했으면서 손의 위치를 적지 않은** 자리 — 하나뿐이다.
 *
 * 라운드 86 Z-1의 기록이고, **그 라운드의 기록이지 낡은 값이 아니다**(옛 라운드 문단을 고치는
 * 것은 이 저장소가 하지 않는 일이다).
 */
export const DECISIVE_HAND_EXEMPTIONS: readonly DecisiveHandExemption[] = [
  {
    notation: "재개 조건(결정형)",
    context: "근거를 값으로 적는 관례(대장)를 어느 라운드가 세우는",
    reason:
      "라운드 86 Z-1이 '주석의 근거를 값으로 적는 대장'을 기각하며 적은 조건이고, 그 자리는 " +
      "형만 밝히고 손의 위치를 적지 않았다 — AA-3의 관례가 손의 위치까지 요구하게 된 것이 " +
      "바로 그 라운드라, 이 한 줄은 관례가 완성되기 직전의 모양으로 남아 있다.",
    whyNotFixedHere:
      "⚠️⚠️ 이 트랙은 문서를 한 글자도 고치지 않는다. 고치면 '계약이 문서를 지킨다'가 아니라 " +
      "'문서가 계약을 맞춘다'가 되고, 그것이 라운드 88이 이 후보를 집지 않은 이유다. " +
      "고치는 손은 F뿐이다.",
    reopenCondition:
      "재개 조건(사건형): F가 그 줄에 손의 위치를 적는 날 — 그날 이 면제 줄을 지운다. " +
      "⚠️ 지우지 않아도 이 계약은 초록이다(유령 검사가 '문장이 살아 있는가'까지만 묻는다). " +
      "그 느슨함은 문서를 옳게 고치는 손을 그물이 막지 않게 하려는 것이고, 그래서 이 줄을 " +
      "지우는 것은 다음 라운드의 청소이지 계약의 강제가 아니다."
  }
];

/** 괄호 바늘로 본 **결정형** 자리. */
export function decisiveSites(sites: readonly ResumeSite[]): readonly ResumeSite[] {
  return sites.filter((site) => site.parenDecisive);
}

/**
 * ⚠️ **이 계약의 축** — 결정형으로 표기했는데 손의 위치가 없는 자리.
 *
 * 손의 위치는 **접힘 바늘까지 봐 준다**(표기가 두 줄로 접혔다고 어긋남으로 세지 않는다).
 */
export function decisiveSitesMissingHand(sites: readonly ResumeSite[]): readonly ResumeSite[] {
  return decisiveSites(sites).filter((site) => !site.parenHand && !site.windowHand);
}

/** 어떤 면제 줄이 이 자리를 가리키는가(문장 조각으로 맞춘다). */
export function exemptionFor(site: ResumeSite): DecisiveHandExemption | undefined {
  return DECISIVE_HAND_EXEMPTIONS.find((exemption) => site.text.includes(exemption.context));
}

/** 오늘의 어긋남 수 — 값으로 적어 둔다(0이 되는 날 면제 줄을 지운다). */
export const DECISIVE_MISSING_HAND_TODAY = 1;

// ── ⓓ 소스 축 — ⚠️⚠️ 손 하나가 아니라 뿌리에서 전수 파생(라운드 91 트랙 D) ────

/**
 * 소스 축의 **뿌리** — ⚠️⚠️ **파일 목록이 아니다.**
 *
 * 라운드 89·90의 이 축은 `SOURCE_AXIS_FILES`를 **손으로 적은 한 줄**이었다
 * (`dead-export-ledger.ts` 하나). 그 모양의 병은 계약이 *"그 파일이 관례를 지키는가"* 만
 * 묻고 *"관례를 지고 있는 소스가 이것뿐인가"* 는 묻지 못한다는 것이다 — 새 파일이 표기를
 * 지기 시작해도 이 대장은 그 사실을 **모른다**(AB-4가 적은 *"목록에 이름이 있다는 사실이
 * 그 자리는 세어졌다로 읽힌다"* 의 소스판). 오늘 그 손 목록을 지우고 **뿌리를 걷는다.**
 */
export const SOURCE_AXIS_ROOTS = ["apps", "packages"] as const;

/**
 * 걷지 않는 디렉터리 — **산출물·의존성은 소스가 아니라 사본이다.**
 *
 * 계약 그물 대장(`contract-net-ledger.test.ts`)이 같은 뿌리를 걸으며 쓴 대역 그대로다
 * (두 그물이 같은 저장소를 다른 바늘로 보되 **대역은 같게** 둔다).
 */
export const SOURCE_AXIS_SKIPPED_DIRECTORIES: readonly string[] = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  "generated",
  ".next",
  ".expo",
  ".turbo",
  ".git",
  "android",
  "ios"
];

/**
 * **읽지 않는** 확장자 — 이진·산출물.
 *
 * ⚠️ 소스 확장자를 **허용 목록**으로 적지 않는다: 허용 목록은 그 자체로 또 하나의 손 목록이라
 * `.kt`·`.java`·`.sql`처럼 나중에 붙는 소스를 조용히 밖에 둔다. 여기서는 *읽을 수 없는 것*만
 * 이름으로 덜어 내고, 나머지는 전부 읽는다.
 */
export const SOURCE_AXIS_BINARY_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".pack",
  ".jar",
  ".class",
  ".bin",
  ".keystore",
  ".jks",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".map",
  ".tsbuildinfo",
  ".log",
  ".lock"
];

/** 읽지 않는 크기 — 이 위는 소스가 아니라 자료다(오늘 걸린 파일 0건). */
export const SOURCE_AXIS_MAX_BYTES = 1_048_576;

export type SourceAxisEntry = {
  /** 저장소 상대 경로. */
  readonly path: string;
  /** 파일 원문. */
  readonly text: string;
};

/**
 * 뿌리를 걸어 **읽을 수 있는 소스 전수**를 낸다 — ⓕ **대장 자신의 두 파일은 여기서 빠진다.**
 *
 * ⚠️ 자기 배제가 이 자리에 있는 이유: 배제를 *모집단 정의*가 아니라 *걷기*가 지면, 모집단이
 * 넓어져도 배제가 함께 넓어진다. 라운드 89의 배제는 *"모집단이 문서 하나와 손으로 적은 소스
 * 하나라 자기 파일이 들어올 길이 없다"* 는 **우연**이었고, 오늘 뿌리를 열자 그 우연이 끝났다 —
 * 이 대장의 두 파일은 `⚠️ 재개 조건(…)` 표기를 실제로 지고 있어서, 배제가 없으면 이 축은
 * **자기를 세는 축**이 된다.
 */
export function readSourceAxisEntries(baseDir: string = repoRoot): readonly SourceAxisEntry[] {
  const entries: SourceAxisEntry[] = [];
  const selfFiles = LEDGER_SELF_FILES as readonly string[];

  const walk = (relative: string): void => {
    let listing;
    try {
      listing = readdirSync(join(baseDir, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of listing) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (SOURCE_AXIS_SKIPPED_DIRECTORIES.includes(entry.name)) continue;
        walk(next);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (SOURCE_AXIS_BINARY_EXTENSIONS.some((extension) => lower.endsWith(extension))) continue;
      if (selfFiles.includes(next)) continue; // ⓕ 자기 배제
      const absolute = join(baseDir, next);
      try {
        if (statSync(absolute).size > SOURCE_AXIS_MAX_BYTES) continue;
        entries.push({ path: next, text: readFileSync(absolute, "utf8") });
      } catch {
        continue;
      }
    }
  };

  for (const root of SOURCE_AXIS_ROOTS) {
    if (!existsSync(join(baseDir, root))) continue;
    walk(root);
  }
  return entries;
}

/**
 * 소스에서 **오늘 그 파일이 지고 있는** 표기만 세는 바늘.
 *
 * ⚠️ `⚠️` 표식을 함께 무는 이유: 같은 파일이 **과거의 조건을 인용**하기도 하는데
 * (*"라운드 87의 문장은 … 재개 조건(사건형): … 이었고"*), 인용은 오늘의 약속이 아니다.
 * 저장소의 관례상 살아 있는 값 앞에는 `⚠️`가 선다 — 그 표식을 신원으로 쓴다.
 * 인용까지 세는 넓은 바늘의 수는 사각이 값으로 진다(`quoted-source-conditions`).
 */
export function markedSourceNeedle(): RegExp {
  return /⚠️\s*재개\s*(?:조건|트리거)\s*[（(]([^）)]*)[）)]/g;
}

/** 인용까지 포함해 괄호 안에 형을 밝힌 표기 전부(넓은 바늘). */
export function anyParenSourceNeedle(): RegExp {
  return /재개\s*(?:조건|트리거)\s*[（(]([^）)]*)[）)]/g;
}

/** 한 텍스트에서 바늘에 걸린 **형이 밝혀진** 괄호 안 내용들. */
export function typedInners(text: string, needle: RegExp): readonly string[] {
  const inners: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = needle.exec(text)) !== null) {
    if (TYPE_WORD.test(match[1])) inners.push(match[1]);
  }
  return inners;
}

export type SourceAxisFile = {
  readonly path: string;
  /** 왜 이 파일인가 — **빈 문자열일 수 없다.** ⚠️ 손이 아니라 실측에서 파생된다. */
  readonly reason: string;
  /** 그 축이 **누구의 것인가**(이 대장은 **읽기만** 한다) — ⓒ **빈 문자열 금지.** */
  readonly owner: string;
  /** 오늘 실측한 표기 수(좁은 바늘) — ⚠️ 손으로 적지 않는다. */
  readonly valueToday: number;
  /** 오늘 실측한 괄호 전수(넓은 바늘 · 인용 포함). */
  readonly anyParenToday: number;
  /** ⚠️ 하한 — **오늘의 값보다 낮다**(사유는 아래). */
  readonly floor: number;
  /** 하한을 값보다 낮게 잡은 이유. */
  readonly floorReason: string;
};

/**
 * 자리별 **하한**의 역사 — ⚠️ **이 표는 뿌리가 아니다.**
 *
 * 모집단은 뿌리에서 파생되고, 이 표는 *"이미 서 있던 자리의 하한을 낮추지 않는다"* 만 진다.
 * 여기에 이름이 없는 파일은 **오늘 처음 걸린 자리**라 역사가 없고, 그래서 하한이
 * `SOURCE_AXIS_DEFAULT_FLOOR`(0)이다 — 그 자리를 지키는 것은 자리별 하한이 아니라
 * **표기 소스 수의 래칫**(`SOURCE_COUNT_RATCHET`)이다.
 *
 * ⚠️⚠️ **이 수를 내리지 말 것**(라운드 89 D가 셋으로 세운 이유 그대로).
 */
export const SOURCE_AXIS_FLOORS: Readonly<Record<string, number>> = {
  "packages/test-utils/src/dead-export-ledger.ts": 3
};

/** 오늘 처음 걸린 자리의 하한 — 역사가 없으므로 0. */
export const SOURCE_AXIS_DEFAULT_FLOOR = 0;

/** 자리별 하한의 사유(역사) — 표에 없는 자리는 아래 기본 사유를 진다. */
export const SOURCE_AXIS_FLOOR_NOTES: Readonly<Record<string, string>> = {
  "packages/test-utils/src/dead-export-ledger.ts":
    "⚠️⚠️ **네 시점 — 이 칸의 예측이 빗나갔고, 빗나간 방향까지 값으로 적는다.** 라운드 89 D " +
    "시점 표기는 넷이었고 이 칸은 *'그 넷 중 하나(export-const-axis의 결정형 · 손은 안)는 도래한 " +
    "조건이라 트랙 C가 소진하며 지울 수 있으니 하한은 넷이 아니라 셋'* 이라고 적었다 — 즉 " +
    "**4→3을 내다봤다.** 실제로는 **4 → 5 → 6**이다: C는 그 결정형을 소진하면서 사건형 둘을 " +
    "새로 적었고, 라운드 90 리뷰가 사각 하나를 더 열며(`jsx-apostrophe-string-masking`) 또 " +
    "하나를 남겼다. ⚠️ **관례를 지키는 손은 조건을 소진하면서 동시에 새 조건을 남긴다** — 그래서 " +
    "이 수는 줄지 않고 늘었다. 하한은 그래도 **셋 그대로 둔다**: 빗나간 방향은 위쪽이고 하한이 " +
    "막아야 하는 것은 아래쪽(관례가 지워지는 날)이다. 하한을 오늘의 값으로 올리면 다음 라운드가 " +
    "도래한 조건 셋을 정직하게 소진하는 순간 그 옳은 손이 빨강을 맞는다."
};

/**
 * 자리별 **소유자**의 주석 — ⚠️ 이것도 뿌리가 아니다.
 *
 * 표에 이름이 없어도 소유자 칸은 **빈 문자열일 수 없다**(ⓒ). 이름이 없는 자리는 경로에서
 * 파생한 소유를 지고, *"이 대장은 읽기만 한다"* 는 사실만은 어느 자리에나 선다.
 */
export const SOURCE_AXIS_OWNER_NOTES: Readonly<Record<string, string>> = {
  "packages/test-utils/src/dead-export-ledger.ts":
    "사문 대장 — 라운드 87 트랙 E가 AA-3의 표기를 소스로 처음 가져간 파일이고 라운드 89 C가 " +
    "`export const` 축을 얹었다. 이 대장은 읽기만 한다.",
  "packages/test-utils/src/contract-net-ledger.test.ts":
    "계약 그물 대장 — 라운드 90 E의 짝 계약이 이 파일의 목록을 문다. 이 대장은 읽기만 한다.",
  "apps/api/test/harness-catalog-cost.test.ts":
    "하네스 카탈로그 비용 계약 — 라운드 91 트랙 C가 세우며 표기 넷을 남긴 파일이고, 그중 하나가 " +
    "*공유 테스트 DB를 언제 비울지*의 결정형(손은 저장소 안)이다. ⚠️ 이 자리는 D의 기록이 " +
    "빠뜨렸던 셋째다(리뷰 H-1). 이 대장은 읽기만 한다."
};

/** 경로에서 소유를 파생한다 — **어떤 경로에도 빈 문자열을 돌려주지 않는다**(ⓒ). */
export function ownerForSourcePath(path: string): string {
  const note = SOURCE_AXIS_OWNER_NOTES[path];
  if (note) return note;
  const [root, workspace] = path.split("/");
  return (
    `${root}/${workspace ?? "?"}의 손 — 오늘 처음 이 뿌리에 걸린 자리라 이 대장에 이름이 아직 ` +
    "적히지 않았다(적는 것은 다음 라운드의 청소다). 이 대장은 읽기만 한다."
  );
}

/**
 * ⚠️⚠️ **전수 파생의 자리** — 걷어 온 소스에서 표기를 지닌 파일만 남긴다.
 *
 * `ownerFor`를 인자로 받는 이유는 계약이 **소유자 칸이 비는 날**을 픽스처로 재현할 수 있게
 * 하기 위해서다(빈 칸이 실제로 빨개지는지를 산문이 아니라 값으로 보인다).
 */
export function sourceAxisFilesFrom(
  entries: readonly SourceAxisEntry[],
  ownerFor: (path: string) => string = ownerForSourcePath
): readonly SourceAxisFile[] {
  const files: SourceAxisFile[] = [];
  for (const entry of entries) {
    const marked = typedInners(entry.text, markedSourceNeedle());
    if (marked.length === 0) continue;
    const anyParen = typedInners(entry.text, anyParenSourceNeedle());
    files.push({
      path: entry.path,
      reason:
        `뿌리 ${SOURCE_AXIS_ROOTS.join(" · ")} 를 걸어 나온 자리다 — ⚠️ 표식이 선 재개 조건 ` +
        `표기를 ${marked.length}건 지고 있어(괄호 전수 ${anyParen.length}건) AA-3의 같은 조항이 ` +
        "그 전부에 걸린다. 문서만 무는 계약은 관례의 절반만 지킨다.",
      owner: ownerFor(entry.path),
      valueToday: marked.length,
      anyParenToday: anyParen.length,
      floor: SOURCE_AXIS_FLOORS[entry.path] ?? SOURCE_AXIS_DEFAULT_FLOOR,
      floorReason:
        SOURCE_AXIS_FLOOR_NOTES[entry.path] ??
        "오늘 처음 뿌리에 걸린 자리라 역사가 없다 — 그래서 자리별 하한은 0이고, 이 파일이 표기를 " +
          "잃는 날 무는 것은 자리별 하한이 아니라 **표기 소스 수의 래칫**이다. ⚠️ 하한을 오늘의 " +
          "값으로 올리면 도래한 조건을 정직하게 소진하는 손이 빨강을 맞는다(라운드 89 D의 판단 그대로)."
    });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

/** 뿌리를 걸어 소스 축을 전수로 낸다. */
export function deriveSourceAxisFiles(baseDir: string = repoRoot): readonly SourceAxisFile[] {
  return sourceAxisFilesFrom(readSourceAxisEntries(baseDir));
}

/**
 * 오늘의 소스 축 — **손으로 적은 목록이 아니라 파생 결과다.**
 *
 * 오늘 걸린 자리는 **셋**이다(`apps/api/test/harness-catalog-cost.test.ts` **4** ·
 * `contract-net-ledger.test.ts` **1** · `dead-export-ledger.ts` **6**).
 *
 * ⚠️ 라운드 90 E가 *"도래한 조건·처분은 다음 라운드 몫"* 이라고 적으며 표기를 남긴 자리와,
 * 같은 라운드 트랙 C가 하네스 비용 계약에 적은 자리 — **손 목록이었다면 이 대장은 그 둘을
 * 오늘도 몰랐다.**
 * ⚠️⚠️ **그리고 셋째는 파생이 아니라 *기록*이 놓쳤다**(리뷰 H-1): 파생 함수는 D 시점에도 셋을
 * 냈는데 그 라운드가 값으로 적은 수가 둘이었다. **전수 파생은 옳게 돌았고, 그 위에 손으로 얹은
 * 수가 틀렸다** — 그래서 이 대장의 교훈은 *뿌리를 걷어라*에서 한 칸 나아가 *걷은 결과를 손으로
 * 다시 적지 마라*가 된다(아래 계약이 `files`를 파생 길이에 묶는 이유).
 */
export const SOURCE_AXIS_FILES: readonly SourceAxisFile[] = deriveSourceAxisFiles();

export type SourceNotation = {
  readonly file: string;
  /** 괄호 안 내용. */
  readonly inner: string;
  readonly decisive: boolean;
  readonly hand: boolean;
};

/** 걷어 온 소스에서 표기를 걷는다(⚠️ 표식이 선 것만). */
export function collectSourceNotationsFrom(
  entries: readonly SourceAxisEntry[]
): readonly SourceNotation[] {
  const found: SourceNotation[] = [];
  for (const entry of entries) {
    for (const inner of typedInners(entry.text, markedSourceNeedle())) {
      found.push({
        file: entry.path,
        inner,
        decisive: DECISIVE_WORD.test(inner),
        hand: HAND_PHRASE.test(inner)
      });
    }
  }
  return found;
}

/** 소스 축의 표기를 걷는다(⚠️ 표식이 선 것만) — 뿌리에서 전수로. */
export function collectSourceNotations(baseDir: string = repoRoot): readonly SourceNotation[] {
  return collectSourceNotationsFrom(readSourceAxisEntries(baseDir));
}

/**
 * 넓은 바늘로 센 수(인용 포함) — 사각의 값을 내는 자.
 *
 * ⚠️ **모집단 안에서만 센다**: 표기를 지니지 않은 소스가 옛 문장을 인용하는 자리까지 세면
 * 이 수는 이 축이 아니라 저장소 전체의 인용 습관을 재게 된다(그 수는 사각 `unmarked-source-prose`).
 */
export function countAnyParenSourceNotations(baseDir: string = repoRoot): number {
  return deriveSourceAxisFiles(baseDir).reduce((sum, file) => sum + file.anyParenToday, 0);
}

// ── ⓓ-② 전수 파생이 실제로 무는 자리 ─────────────────────────────────────────

/**
 * ⚠️ **표기를 지닌 소스 수의 래칫** — 오늘 **셋**, 그리고 **줄지 않는다.**
 *
 * 이것이 손 목록에는 없던 조항이다: 손 목록 시절 이 축은 *"적어 둔 그 파일이 관례를 지키는가"*
 * 만 물었고, 관례가 **지워지는** 날에도 목록에서 그 줄을 지우면 초록이었다. 뿌리를 걷는 오늘은
 * 그 줄을 지울 곳이 없다 — 표기가 사라지면 파생 수가 떨어지고 이 래칫이 먼저 빨개진다.
 *
 * ⚠️⚠️ **두 시점 — 라운드 91 리뷰 H-1이 2를 3으로 올린다. 이것은 하한 인상이 아니라 *오기의
 * 정정*이다.**
 *  · **D 시점(`9b65ac0`)**: 이 값은 **2**였다. 그런데 그 커밋의 워킹트리에서 뿌리를 걸으면 이미
 *    **셋**이 나왔다 — 같은 라운드 트랙 C의 `apps/api/test/harness-catalog-cost.test.ts`가
 *    **세 시간 앞서**(`b320ab2`) 머지되며 표기 넷을 지고 서 있었기 때문이다. D는 뿌리를 열어
 *    놓고도 결과를 손으로 **예상한 둘**로 적었고, 그래서 이 래칫은 **태어날 때부터 실측보다 한
 *    칸 낮았다**: 셋 중 하나가 표기를 통째로 잃어도 `3 >= 2`라 계약이 조용했다(거짓 초록).
 *  · **오늘(리뷰 H-1)**: 실측이 셋이므로 래칫도 **셋**이다. 하한을 실측에 붙이는 것이 이 대장의
 *    규율에 어긋나지 않는가 — 어긋나지 않는다. 이 수가 막는 것은 *조건이 소진되는 것*이 아니라
 *    **관례를 지고 있던 파일이 통째로 사라지는 것**이고(자리별 조건 수의 하한은 여전히
 *    `SOURCE_AXIS_FLOORS`가 따로 진다 · 인상 없음), 파일이 늘면 이 래칫은 그대로 초록이다.
 *  · ⚠️ **그래서 이 수를 다시 내리려면 이 문단을 열어 왜 내리는지를 적어야 한다** — 관례를 지고
 *    있던 소스가 정당하게 사라지는 라운드가 그 자리다.
 */
export const SOURCE_COUNT_RATCHET = 3;

/** 걷은 파일 수의 하한 — 유령 방지(뿌리가 통째로 빈 날 먼저 빨개진다). */
export const SOURCE_AXIS_WALKED_FLOOR = 400;

export type SourceCountViolation = {
  readonly floor: number;
  readonly measured: number;
  readonly files: readonly string[];
};

/** 표기 소스 수가 하한을 깼는가 — **`undefined`여야 초록이다.** */
export function sourceCountViolation(
  files: readonly SourceAxisFile[],
  floor: number = SOURCE_COUNT_RATCHET
): SourceCountViolation | undefined {
  if (files.length >= floor) return undefined;
  return { floor, measured: files.length, files: files.map((file) => file.path) };
}

export type SourceAxisDefect = {
  readonly path: string;
  readonly field: "owner" | "reason" | "floorReason" | "floor" | "valueToday";
  readonly detail: string;
};

/**
 * 자리마다 **칸이 실제로 채워졌는가** — ⓒ의 *빈 문자열 금지*를 값으로 무는 자.
 *
 * **비어 있어야 초록이다.**
 */
export function sourceAxisDefects(files: readonly SourceAxisFile[]): readonly SourceAxisDefect[] {
  const defects: SourceAxisDefect[] = [];
  for (const file of files) {
    if (file.owner.trim().length === 0) {
      defects.push({ path: file.path, field: "owner", detail: "소유자 칸이 비었다" });
    }
    if (file.reason.trim().length <= 40) {
      defects.push({ path: file.path, field: "reason", detail: "이 자리가 왜 모집단인지가 없다" });
    }
    if (file.floorReason.trim().length <= 40) {
      defects.push({ path: file.path, field: "floorReason", detail: "하한의 사유가 없다" });
    }
    if (file.floor >= file.valueToday) {
      defects.push({
        path: file.path,
        field: "floor",
        detail: `하한 ${file.floor}이 오늘의 값 ${file.valueToday}보다 낮지 않다`
      });
    }
    if (file.valueToday < 1) {
      defects.push({ path: file.path, field: "valueToday", detail: "표기가 0건인 자리가 모집단에 들었다" });
    }
  }
  return defects;
}

/**
 * 오늘 소스 축의 실측 — **기록이지 계약이 아니다**(계약이 무는 것은 래칫과 자리별 하한뿐).
 *
 * ⚠️⚠️ **두 시점(리뷰 H-1).**
 *  · **D 시점(`9b65ac0`)의 기록**: `walked 966 · files 2 · marked 7 · anyParen 11`.
 *    ⚠️ **그 시점의 실측이 아니라 손으로 예상한 수였다** — 같은 커밋의 워킹트리에서 뿌리를 걸으면
 *    이미 `files 3 · marked 11 · anyParen 15`가 나왔다. 같은 라운드 트랙 C의
 *    `apps/api/test/harness-catalog-cost.test.ts`가 **D보다 먼저 머지돼**(`b320ab2`) 표기 넷을
 *    지고 있었고, D의 기록은 그 파일을 세지 못했다.
 *  · **오늘**: 아래 표. `files`가 셋이고 `marked`는 `6 + 1 + 4`, `anyParen`은 `9 + 2 + 4`다.
 *    ⚠️ 판정 문서의 AF-2는 그날에도 **셋**이라고 옳게 적었으므로, 정정된 것은 사실이 아니라
 *    이 표와 `SOURCE_COUNT_RATCHET`뿐이다.
 *
 * ⚠️ `walked`는 다른 트랙이 파일을 더하는 동안에도 움직인다 — 계약이 무는 것은 하한
 * (`SOURCE_AXIS_WALKED_FLOOR`)뿐이라 그 움직임이 초록을 흔들지 않는다.
 */
export const SOURCE_AXIS_MEASURED_TODAY = {
  /** 걷은 파일 수(자기 두 파일 제외). */
  walked: 966,
  /** 표기를 지닌 소스 수 — **셋**(D의 기록은 둘이었고 그것이 오기였다). */
  files: 3,
  /** 좁은 바늘의 표기 전수(6 + 1 + 4). */
  marked: 11,
  /** 넓은 바늘의 괄호 전수(9 + 2 + 4). */
  anyParen: 15,
  /** 자리별 좁은 바늘 — `dead-export-ledger.ts` **6** · `harness-catalog-cost.test.ts` **4** · `contract-net-ledger.test.ts` **1**. */
  markedTopFile: 6,
  /** 자리별 넓은 바늘 — `dead-export-ledger.ts` **9**. */
  anyParenTopFile: 9
} as const;

// ── ⓔ 사각 ───────────────────────────────────────────────────────────────────

export type LedgerBlindSpot = {
  readonly id: string;
  /** 무엇이 모집단·바늘 밖인가. */
  readonly what: string;
  /** 왜 밖인가 — **빈 문자열일 수 없다.** */
  readonly why: string;
  /** 오늘 잰 값. */
  readonly valueToday: number;
  /** ⚠️ **하한**(상한이 아니다). */
  readonly floor: number;
  /** 오늘 다시 재는 자 — 손으로 적은 수는 다음 라운드에 조용히 낡는다. */
  readonly measure: (baseDir: string) => number;
  /** 이 사각을 배워야 하는 날의 조건. */
  readonly reopenCondition: string;
};

/** 라운드 노트와 짝 문서 — 모집단 밖의 자리를 세는 자. */
function countSitesIn(baseDir: string, relativePath: string): number {
  const absolute = join(baseDir, relativePath);
  if (!existsSync(absolute)) return 0;
  return collectResumeSites(readFileSync(absolute, "utf8"), relativePath).length;
}

/**
 * `docs/5차/**` — 라운드 노트가 사는 자리(이 대장이 **일부러** 세지 않는 것).
 *
 * ⚠️ 파일 목록을 손으로 적지 않는다: 라운드마다 노트가 한 벌씩 늘어나므로 손으로 적은 목록은
 * 다음 라운드에 조용히 낡고, 그러면 *"목록에 이름이 있다는 사실이 그 자리는 세어졌다로
 * 읽힌다"*(AB-4)의 모양이 된다. 뿌리를 적고 **걷는다.**
 */
export const ROUND_NOTES_ROOT = "docs/5차";

/** 라운드 노트 전수(`.md`만 · 하위 디렉터리까지). */
export function roundNoteFiles(baseDir: string = repoRoot): readonly string[] {
  const absoluteRoot = join(baseDir, ROUND_NOTES_ROOT);
  if (!existsSync(absoluteRoot)) return [];
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(baseDir, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".md")) found.push(next);
    }
  };
  walk(ROUND_NOTES_ROOT);
  return found.sort();
}

/** 짝 문서 둘 — 같은 계열의 판정/확인 문서이지만 형 표기가 오늘 0건이다. */
export const SIBLING_DOCUMENTS = [
  "docs/qa/runtime-verification-required.md",
  "docs/qa/accessibility-offline-checklist.md"
] as const;

/**
 * ⚠️⚠️ **이 대장의 수는 상한이 아니라 하한이다**(AB-5의 규율을 태어날 때부터).
 *
 * 예순하나는 *"저장소에 형을 밝힌 재개 조건이 예순하나뿐이다"* 가 아니라 *"이 모집단·이 바늘
 * 안에서 예순하나가 풀렸다"* 는 뜻이다. 밖은 아래 **여덟**으로 갈리고 하나하나가 오늘의 값과
 * 하한을 진다 — 앞의 여섯은 문서 축의 사각이고, 뒤의 둘은 **라운드 91 D가 소스 축을 넓히며
 * 새로 진 사각**이다.
 */
export const LEDGER_BLIND_SPOTS: readonly LedgerBlindSpot[] = [
  {
    id: "prose-only",
    what:
      "형 표기가 아예 없는 재개 조건 — *'⚠️ 재개 조건: 그 관계 필드가 생기는 날'* 처럼 산문으로만 " +
      "적힌 자리. **이 대장이 못 보는 것 중 가장 크다.**",
    why:
      "산문에는 문법이 없어 '이것이 사건형인가 결정형인가'를 기계가 가를 수 없다. 가르려면 " +
      "문장의 뜻을 읽어야 하고, 그것은 이 그물의 일이 아니라 사람의 일이다 — 그리고 그 사람은 " +
      "F다(이 트랙은 문서를 고치지 않는다).",
    valueToday: 165,
    floor: 60,
    measure: (baseDir) => collectDocumentSites(baseDir).filter((site) => site.bucket === "prose").length,
    reopenCondition:
      "재개 조건(결정형 · 손은 저장소 안): 관례를 소급해 적용할지를 F가 정하는 날 — " +
      "그날 이 165가 줄기 시작하고, 이 대장의 하한이 그 방향을 값으로 보여 준다. " +
      "⚠️ 세 시점: 트랙 D 시점 119 · 라운드 89 리뷰 145 · 라운드 91 D 재실측 **165** — " +
      "**가장 큰 사각은 라운드가 지나며 줄지 않고 늘고 있다.**"
  },
  {
    id: "folded-notation",
    what:
      "표기가 **두 줄로 접힌** 자리 — 손의 위치가 다음 줄로 넘어간 자리 둘, 그리고 여는 괄호가 " +
      "줄을 넘어가는 자리 하나(*'라운드 87의 재개 조건(\"그 스윕을 / 다시 돌리는 날\")'*).",
    why:
      "줄 바늘은 한 줄 안만 본다. 접힘 바늘(앞뒤 한 줄)이 오늘 그 둘을 회수하지만, 세 줄 넘게 " +
      "접힌 표기는 여전히 밖이다. ⚠️ **정찰의 14와 이 대장의 12가 갈린 자리가 정확히 이 둘이다** " +
      "— 갈림이 사각의 크기를 재 준 셈이다.",
    valueToday: 2,
    floor: 0,
    measure: (baseDir) => {
      const tallies = tallyNeedles(collectDocumentSites(baseDir));
      return tallies.window.hand - tallies.line.hand;
    },
    reopenCondition:
      "재개 조건(사건형): 표기가 세 줄 이상으로 접힌 자리가 생기는 날 — 그날 이 바늘의 창을 " +
      "넓히거나, 문단을 단위로 세는 법을 배워야 한다. ⚠️ 이 수가 0으로 내려가는 것은 " +
      "**좋은 방향**이라(접힘이 풀렸다는 뜻) 하한을 0으로 둔다."
  },
  {
    id: "round-notes",
    what:
      "`docs/5차/**` 라운드 노트의 재개 조건 자리 전수 — 오늘 노트 쉰 벌이 **319**를 지고 있다. " +
      "⚠️ 라운드 91 정찰이 적은 265와 갈리는데, 그 갈림의 자리는 **정찰 노트 자신**이다" +
      "(`round91-scout.md` 54 · 265 + 54 = 319): 정찰은 자기가 쓰고 있던 문서를 세지 못했다.",
    why:
      "⚠️ 라운드별 **작업 기록**이지 판정 문서가 아니다. 모집단에 넣으면 이 대장의 수가 매 라운드 " +
      "통째로 흔들리고(라운드마다 노트가 한 벌씩 늘어난다) 래칫이 뜻을 잃는다 — 넓히는 대신 " +
      "값으로 적는다.",
    valueToday: 319,
    floor: 100,
    measure: (baseDir) =>
      roundNoteFiles(baseDir).reduce((sum, path) => sum + countSitesIn(baseDir, path), 0),
    reopenCondition:
      "재개 조건(결정형 · 손은 저장소 안): 라운드 노트가 판정 문서로 승격되는 관례가 서는 날 — " +
      "오늘 그런 관례는 없고, 노트는 라운드가 끝나면 읽히지 않는다."
  },
  {
    id: "sibling-documents",
    what:
      "짝 문서 둘(`runtime-verification-required.md` 다섯 · `accessibility-offline-checklist.md` 여섯)의 " +
      "재개 조건 자리 **열하나** — 그중 형을 괄호로 밝힌 것은 **하나뿐**(C-12의 사건형)이고 " +
      "⚠️ **이 계약의 축이 무는 결정형은 오늘도 0건**이다. " +
      "⚠️ 세 시점: 트랙 D 시점 하나·셋(합 넷) · 라운드 89 리뷰 다섯·넷(합 아홉) · 라운드 91 D " +
      "다섯·여섯(합 **열하나**) — **자리는 세 배 가까이 늘었는데 괄호로 형을 밝힌 것은 여전히 " +
      "하나이고 결정형은 여전히 0건**이라, 이 사각을 모집단에 넣지 않기로 한 판단은 오늘도 같다.",
    why:
      "자리가 넷이고 결정형이 0건이라, 모집단에 넣어도 축은 아무것도 지키지 못하면서 하한만 " +
      "0인 뿌리가 하나 늘어난다(주석 관용 앵커 대장이 `ZERO_YIELD_ROOTS`에 적은 그 규율). " +
      "⚠️ **그리고 이 라운드에 그 둘을 여는 트랙이 있다**(E가 접근성 표를 읽는다) — " +
      "한 문서에 축 둘을 얹지 않는다.",
    valueToday: 11,
    floor: 1,
    measure: (baseDir) => SIBLING_DOCUMENTS.reduce((sum, path) => sum + countSitesIn(baseDir, path), 0),
    reopenCondition:
      "재개 조건(사건형): 짝 문서 중 하나에 **결정형** 표기가 처음 서는 날 — 그날 그 문서는 " +
      "`LEDGER_DOCUMENT` 옆에 서고 자기 하한을 얻는다."
  },
  {
    id: "quoted-source-conditions",
    what:
      "소스 축에서 **인용된 과거 조건** — 두 파일이 옛 문장을 인용하며 적어 둔 표기 넷" +
      "(⚠️ 표식이 없다).",
    why:
      "인용은 오늘의 약속이 아니라 어제의 기록이다. 인용까지 조항으로 물면 '옛 문장을 인용하려면 " +
      "그 문장을 고쳐 적어야 한다'가 되고, 그것은 기록을 지우는 일이다. ⚠️ 대신 넓은 바늘의 수를 " +
      "값으로 든다(오늘 좁은 바늘 **열하나** · 넓은 바늘 **열다섯** — 네 시점: 트랙 D 넷·여섯 · " +
      "라운드 90 다섯·일곱 · 라운드 91 D의 *기록* 일곱·열하나 · ⚠️ **라운드 91 리뷰 H-1의 실측 " +
      "열하나·열다섯**(D가 셋째 파일을 세지 못했다). ⚠️ 인용 넷의 자리는 그대로다 — " +
      "`dead-export-ledger.ts` 셋 · `contract-net-ledger.test.ts` 하나이고, 셋째 파일은 인용 0건이다).",
    valueToday: 4,
    floor: 0,
    measure: (baseDir) => countAnyParenSourceNotations(baseDir) - collectSourceNotations(baseDir).length,
    reopenCondition:
      "재개 조건(사건형): 인용과 약속을 `⚠️` 말고 다른 것으로 가르는 관례가 서는 날 — " +
      "오늘의 신원은 그 표식 하나뿐이고, 그 사실이 이 사각의 크기다."
  },
  {
    id: "one-line-two-sites",
    what: "한 줄에 재개 조건이 둘 이상 적힌 자리 — 줄 바늘이 그것을 **하나로** 센다.",
    why:
      "이 대장의 자리 단위는 **줄**이다(문장 단위로 가르려면 문장 경계를 알아야 하고, 마크다운 " +
      "강조·인용이 섞인 줄에서 그것은 다른 그물의 일이다). 오늘 언급 312와 자리 294의 차이가 " +
      "그 수이고, 판정이 갈리는 자리는 0건이다(둘 다 형 표기가 없거나 같은 형이다). " +
      "⚠️ 세 시점: 트랙 D 언급 210 · 자리 203 · 차이 일곱 → 라운드 89 리뷰 264 · 252 · 열둘 → " +
      "라운드 91 D **312 · 294 · 열여덟**.",
    valueToday: 18,
    floor: 0,
    measure: (baseDir) => {
      const absolute = join(baseDir, LEDGER_DOCUMENT.path);
      return countMentions(readFileSync(absolute, "utf8")) - collectDocumentSites(baseDir).length;
    },
    reopenCondition:
      "재개 조건(사건형): 한 줄 안에서 두 조건의 **형이 갈리는** 자리가 생기는 날 — " +
      "그날 이 대장은 자리를 문장으로 세는 법을 배워야 한다."
  },
  // ── ⚠️ 아래 둘은 **라운드 91 트랙 D가 소스 축을 넓히며 새로 생긴 사각**이다.
  //    넓힌 축은 넓힌 만큼 새 사각을 지고, 그 사각도 값과 하한으로 선다(AB-5).
  {
    id: "source-notation-existence",
    what:
      "이 축이 세는 것은 **표기의 실재**뿐이다 — 오늘 소스에 선 표기 **열하나**가 *그 조건이 오늘 " +
      "참인가* 는 **묻지 않은 채** 세어진다. 도래한 조건도, 아직 먼 조건도 이 축에서는 같은 한 건이다. " +
      "⚠️ 두 시점: 트랙 D의 기록은 **일곱**이었고 그것은 셋째 파일을 세지 못한 수였다(리뷰 H-1).",
    why:
      "*'그 조건이 오늘 참인가'* 를 기계가 가르려면 조건의 뜻을 읽어야 한다 — *'그 관계 필드가 " +
      "생기는 날'* 이 오늘인지 아닌지는 문장이 아니라 저장소의 상태가 답하고, 그 답은 조건마다 " +
      "다른 그물에 있다. 이 축이 그것까지 물면 표기 하나가 늘 때마다 새 그물이 하나 필요해진다. " +
      "⚠️ 그래서 이 대장은 **관례가 지켜지는가**만 묻고, 도래 여부는 조건을 적은 손이 진다.",
    valueToday: 11,
    floor: 2,
    measure: (baseDir) => collectSourceNotations(baseDir).length,
    reopenCondition:
      "⚠️ 재개 조건(결정형 · 손은 저장소 안): 조건의 **도래**를 값으로 가르는 관례가 서는 날 — " +
      "그날 이 축은 표기마다 *오늘 참인가* 를 함께 물 수 있고, 그 관례를 세우는 것은 이 대장이 " +
      "아니라 라운드의 결정이다(그 결정을 내릴 손은 저장소 안에 있다)."
  },
  {
    id: "unmarked-source-prose",
    what:
      "**표기를 지니지 않은 소스의 산문 조건** — 뿌리를 걸어 읽은 소스 가운데 `재개 조건`을 " +
      "말하되 괄호로 형을 밝히지 않은 자리(오늘 파일 **스물**이 자리 **예순여덟**을 지고 있다). " +
      "⚠️ 이 뿌리는 그 자리를 **세지 않고 지나간다** — 문서 축의 `prose-only`와 같은 사각의 소스판이다. " +
      "⚠️⚠️ 두 시점: 트랙 D의 기록은 파일 열여덟·자리 **마흔여덟**이었다(리뷰 H-1 재실측 시점에 " +
      "**예순여덟**). 이 수는 계약이 아니라 기록이고 **하한만 물린다** — 사각을 값으로 적는 손이 " +
      "관례를 말하는 산문을 늘릴 때마다 함께 오르기 때문이다.",
    why:
      "형이 없는 산문에는 문법이 없어 사건형·결정형을 기계가 가를 수 없고(문서 축이 같은 이유로 " +
      "165를 밖에 둔다), 소스에서는 그 자리 대부분이 *조건을 적은 것*이 아니라 *관례를 말한 것*이다. " +
      "⚠️ 그리고 이 뿌리에는 대역도 있다: 산출물·의존성 디렉터리와 이진 확장자, 1MB 위의 파일은 " +
      "걷지 않는다(`SOURCE_AXIS_SKIPPED_DIRECTORIES` · `SOURCE_AXIS_BINARY_EXTENSIONS` · " +
      "`SOURCE_AXIS_MAX_BYTES`) — 그 대역의 이름이 값으로 서 있다는 사실이 이 사각의 크기다.",
    valueToday: 68,
    floor: 10,
    measure: (baseDir) => {
      const entries = readSourceAxisEntries(baseDir);
      const population = new Set(sourceAxisFilesFrom(entries).map((file) => file.path));
      return entries
        .filter((entry) => !population.has(entry.path))
        .reduce(
          (sum, entry) => sum + entry.text.split("\n").filter((line) => RESUME_SITE.test(line)).length,
          0
        );
    },
    reopenCondition:
      "⚠️ 재개 조건(사건형): 소스의 산문 조건이 표기 관례를 지고 다시 쓰이기 시작하는 날 — " +
      "그날 이 예순여덟이 줄고 소스 축의 파생 수가 오르며, 두 수가 함께 움직인다는 사실이 " +
      "이 사각이 닫히고 있다는 신호다."
  }
];

// ── 전제 재실측 ───────────────────────────────────────────────────────────────

export type ScoutNeedleValue = {
  /** 무엇을 센 수인가. */
  readonly what: string;
  /** 어떤 바늘인가. */
  readonly needle: "paren" | "line" | "window" | "site";
  /** 정찰(`docs/5차/round89-scout.md`)이 적은 수. */
  readonly scout: number;
  /** 트랙 D가 2026-08-31 워킹트리에서 다시 잰 수. */
  readonly remeasured: number;
  /** 갈렸다면 왜 갈렸는가 — 같으면 빈 문자열이 아니라 *"같다"* 는 사실을 적는다. */
  readonly divergence: string;
};

/**
 * ⚠️ **전제 재실측 의무의 이행.** 정찰의 다섯 수를 다시 셌다.
 *
 * 넷은 그대로이고 하나는 **바늘이 갈렸다** — 정찰의 14가 틀린 것이 아니라, 손의 위치가 다음
 * 줄로 접힌 자리 둘을 함께 세는 바늘이었다. 그래서 이 대장은 그 수를 **버리지 않고 셋째 바늘로**
 * 든다(`window`). ⚠️ 두 수를 한 낱말로 적지 않는 규율이 여기에도 그대로 적용된다.
 *
 * ⚠️⚠️ **이 표는 *정찰 ↔ 트랙 D* 의 대조 기록이지 오늘의 실측이 아니다**(라운드 89 리뷰 M-4).
 * `remeasured`는 커밋 `1b597c4` 시점의 값이고 **일부러 그대로 둔다** — 두 바늘이 갈린 자리를
 * 보여 준 것이 그날의 대조이고, 그 대조를 오늘 값으로 덮으면 이 대장이 왜 바늘을 셋으로 갈랐는지가
 * 사라진다. 같은 라운드 HEAD의 실측은 `MEASURED_TODAY`가 진다(`252 · 80 · 107 · 18 · 21`).
 */
export const SCOUT_NEEDLE_VALUES: readonly ScoutNeedleValue[] = [
  {
    what: "재개 조건이 선 자리(줄) 전수",
    needle: "site",
    scout: 203,
    remeasured: 203,
    divergence:
      "같다. ⚠️ 다만 **언급**은 210이다(한 줄에 둘 이상인 자리 일곱) — 자리를 줄로 세는 이 " +
      "대장의 단위가 그 차이를 만들고, 그 수는 사각 `one-line-two-sites`가 값으로 진다."
  },
  {
    what: "형을 **괄호 안**에 밝힌 자리",
    needle: "paren",
    scout: 61,
    remeasured: 61,
    divergence:
      "같다. 이 바늘이 AA-3의 관례가 실제로 요구하는 모양이고, 이 계약의 축이 무는 바늘이다."
  },
  {
    what: "형 낱말이 **줄 어디에든** 있는 자리",
    needle: "line",
    scout: 84,
    remeasured: 84,
    divergence:
      "같다. ⚠️ 다만 이 수는 표기가 아니라 **언급까지** 센다 — 괄호 바늘과의 차이 스물셋은 " +
      "거의 전부 *'재개 조건에는 사건형과 결정형이 있고…'* 처럼 관례를 논하는 산문이고, " +
      "그래서 축은 이 바늘을 쓰지 않는다. **61과 84를 한 낱말로 적지 않는 이유가 이것이다.**"
  },
  {
    what: "손의 위치까지 **괄호 안**에 적은 자리",
    needle: "paren",
    scout: 11,
    remeasured: 11,
    divergence:
      "같다. ⚠️ 이 열하나가 축의 분자이고 분모는 결정형 열둘이다 — 어긋난 하나는 " +
      "`DECISIVE_HAND_EXEMPTIONS`가 이유·재개 조건과 함께 진다."
  },
  {
    what: "손의 위치까지 적은 자리(줄 바늘 · 접힘 바늘)",
    needle: "window",
    scout: 14,
    remeasured: 14,
    divergence:
      "⚠️ **한 줄만 보는 바늘로는 12이고, 앞뒤 한 줄까지 보는 바늘로는 14다.** 정찰의 14가 " +
      "틀린 것이 아니라 **접힌 표기 둘을 함께 센 값**이다(그 둘은 '…재개 조건이 결정형이고 / " +
      "손은 저장소 안이다' 처럼 손의 위치가 다음 줄에 있다). 그래서 이 대장은 12를 버리지 않고 " +
      "**두 수를 각각** 든다 — 줄 바늘 12 · 접힘 바늘 14. 접힘의 크기는 사각 " +
      "`folded-notation`이 값으로 진다."
  }
];
