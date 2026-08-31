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
//    실제로 요구하는 모양이고, **이 대장의 축(ⓒ)이 무는 바늘이다**. 당시 **61** · 오늘 **80**.
//  · **줄 바늘**(`line`) — 줄 어디에든 *사건형|결정형* 이라는 낱말이 있으면 센다. 당시 **84** ·
//    오늘 **107**. ⚠️ **이 수는 표기가 아니라 언급까지 센다** — 차이(당시 스물셋 · 오늘 스물일곱)
//    대부분은 *"재개 조건에는 사건형과 결정형이 있고…"* 같은 **관례를 논하는 산문**이다.
//    그래서 축은 이 바늘을 쓰지 않는다.
//  · **접힘 바늘**(`window`) — 줄 바늘에 **앞뒤 한 줄**을 더해 본다. 표기가 두 줄로 접힌 자리를
//    회수한다. 손의 위치는 당시 줄 바늘 **12**·접힘 바늘 **14**, 오늘 줄 바늘 **19**·접힘 바늘 **21**
//    (접힘의 크기 둘은 그때도 오늘도 같다).
//
// ⚠️⚠️ **두 시점을 함께 적는 이유**(라운드 89 리뷰 M-4): 위의 *당시* 는 트랙 D가 이 대장을 세운
// 커밋(`1b597c4`)의 워킹트리이고, *오늘* 은 **같은 라운드의 HEAD**다. D 뒤에 머지된 트랙 C와
// 트랙 F가 판정 문서·소스에 재개 조건을 더 얹어 **한 라운드 안에서 실측이 전부 낡았다.**
// 그동안 계약은 내내 초록이었다 — 무는 것이 하한뿐이기 때문이고, 그것이 이 설계의 첫 증거다.
//
// ## ⓒ 축 — 결정형이면 손의 위치를 함께 적었을 것
//
// 괄호 바늘의 결정형 자리는 당시 **열둘**·오늘 **열아홉**이고, 손의 위치를 함께 적은 자리는
// 당시 **열하나**·오늘 **열여덟**이다 — **어긋난 하나는 그때도 오늘도 같은 하나**다.
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
// ## ⓓ 소스 축 — 관례는 문서 밖에도 산다
//
// 라운드 87 트랙 E가 AA-3의 표기를 **소스로** 처음 가져갔고, 오늘 그 관례를 소스에 지고 있는
// 파일은 `dead-export-ledger.ts` 하나다(⚠️ 표기 — 당시 **넷** · 오늘 **다섯**). 같은 조항이 그
// 전부에 걸린다.
// ⚠️ **그 파일은 이 라운드 트랙 C의 소유라 이 대장은 읽기만 한다** — 그래서 소스 축의 하한은
// **셋**이다: C가 도래한 결정형 조건(`export-const-axis`)을 소진하며 그 한 줄을 지울 수 있고,
// **도래한 조건을 지우는 것은 옳은 손이다.** 그물이 그것을 막으면 족쇄가 된다
// (`SOURCE_AXIS_FILES[].floor`).
// ⚠️⚠️ **그 예측은 빗나갔고 방향이 반대였다**(라운드 89 리뷰 M-4): 당시 이 자리는 **4→3**을
// 내다봤지만 실제로 일어난 것은 **4→5**다 — C는 예상대로 그 결정형 하나를 소진했으나 같은
// 걸음에 **사건형 둘을 새로 적었다.** 관례를 지키는 손은 조건을 닫으면서 새 조건을 남긴다.
// **하한은 그래도 셋 그대로다**(빗나간 방향이 위쪽이므로 하한은 여전히 아래쪽만 막는다).
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
// **형 표기가 아예 없는 산문 조건**(당시 119 · 오늘 **145**)이고, 그다음이
// **라운드 노트(`docs/5차/**`) 221**이다.
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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/**
 * 이 대장 자신의 두 파일 — ⓕ **모집단에 넣지 않는다.**
 *
 * 오늘 이 배제는 **모집단 정의에서 이미 참이다**(모집단은 판정 문서 하나와 소스 축 한 파일이고
 * 둘 다 이 파일이 아니다). 그래도 값으로 적어 둔다 — 모집단이 넓어지는 날 이 줄이 먼저 읽힌다.
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
 * ⚠️ **그리고 그 사이에도 계약은 초록이었다 — 하한 설계 덕이다.** 이 대장이 `MEASURED_TODAY`를
 * 등호로 물었다면 D 다음 커밋에서 곧바로 빨개졌을 것이고, 그때 다음 사람이 고르는 쉬운 길은
 * **문서를 계약에 맞추는 것**이다(이 대장이 태어날 때부터 막으려던 그 뒤집힘). 실측이 낡는 것이
 * **정상**이고 그 낡음이 초록을 헐겁게 하지 않는다는 사실이, 하한을 고른 판단의 첫 근거다.
 * 그래서 리뷰는 **하한(`NOTATION_RATCHET`·`floor`)은 한 칸도 올리지 않고** 이 기록만 갱신한다.
 */
export const MEASURED_TODAY = {
  sites: 252,
  mentions: 264,
  parenTyped: 80,
  parenHand: 18,
  parenDecisive: 19,
  lineTyped: 107,
  lineHand: 19,
  windowHand: 21,
  prose: 145,
  lineTypedOnly: 27
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

// ── ⓓ 소스 축 ────────────────────────────────────────────────────────────────

export type SourceAxisFile = {
  readonly path: string;
  /** 왜 이 파일인가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
  /** 이 라운드에 그 파일을 여는 트랙(이 대장은 **읽기만** 한다). */
  readonly owner: string;
  /** 오늘 실측한 표기 수. */
  readonly valueToday: number;
  /** ⚠️ 하한 — **오늘의 값보다 낮게** 잡는다(사유는 아래). */
  readonly floor: number;
  /** 하한을 값보다 낮게 잡은 이유. */
  readonly floorReason: string;
};

/**
 * 소스에 사는 재개 조건 — 오늘 그 관례를 지고 있는 파일은 하나다.
 *
 * ⚠️ **읽기만 한다.** `dead-export-ledger.ts`는 이 라운드 트랙 C의 소유다.
 */
export const SOURCE_AXIS_FILES: readonly SourceAxisFile[] = [
  {
    path: "packages/test-utils/src/dead-export-ledger.ts",
    reason:
      "라운드 87 트랙 E가 AA-3의 표기 관례를 소스로 처음 가져간 파일이고, 오늘 저장소에서 " +
      "그 표기를 지고 있는 유일한 소스다(사각의 재개 조건 넷). 문서만 무는 계약은 관례의 절반만 " +
      "지킨다 — 그래서 같은 조항이 이 넷에도 걸린다.",
    owner: "트랙 C(라운드 89) — 이 대장은 읽기만 한다",
    valueToday: 6,
    floor: 3,
    floorReason:
      "⚠️⚠️ **두 시점 — 이 칸의 예측이 빗나갔고, 빗나간 방향까지 값으로 적는다.** 당시(트랙 D " +
      "시점) 표기는 넷이었고 이 칸은 *'그 넷 중 하나(export-const-axis의 결정형 · 손은 안)는 " +
      "오늘 도래한 조건이라 트랙 C가 소진하며 지울 수 있으니 하한은 넷이 아니라 셋'* 이라고 " +
      "적었다 — 즉 **4→3을 내다봤다.** 실제로 일어난 것은 **4→5**다: C는 예상대로 그 결정형 " +
      "하나를 소진했지만(사문 대장이 export const 축을 들이며 그 조건이 닫혔다), 같은 걸음에 " +
      "**사건형 둘을 새로 적었다**(면제가 늘면 판정을 좁힌다 · 세지 않는 뿌리를 세는 라운드). " +
      "⚠️ **관례를 지키는 손은 조건을 소진하면서 동시에 새 조건을 남긴다** — 그래서 소스 축의 " +
      "수는 줄지 않고 늘었다. 하한은 그래도 **셋 그대로 둔다**: 예측이 빗나간 방향은 위쪽이고, " +
      "하한이 막아야 하는 것은 아래쪽(관례가 지워지는 날)이다. 하한을 오늘의 값으로 올리면 " +
      "다음 라운드가 도래한 조건 셋을 정직하게 소진하는 순간 그 옳은 손이 빨강을 맞는다. " +
      "⚠️ **세 시점 — 그 위쪽 어긋남이 한 번 더 났다**(라운드 90 리뷰 M-3): 4 → 5 → **6**. " +
      "리뷰가 사문 대장에 사각 하나를 새로 열며(`jsx-apostrophe-string-masking`) 사건형 조건 " +
      "하나를 또 남겼다 — **관례를 지키는 손은 조건을 소진하면서 동시에 새 조건을 남긴다**가 세 " +
      "번째로 참이 됐다. 하한은 여전히 셋이고, 계약이 무는 것은 그 하한뿐이라 세 번 다 초록이었다."
  }
];

/**
 * 소스에서 **오늘 이 파일이 지고 있는** 표기만 세는 바늘.
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

export type SourceNotation = {
  readonly file: string;
  /** 괄호 안 내용. */
  readonly inner: string;
  readonly decisive: boolean;
  readonly hand: boolean;
};

/** 소스 축의 표기를 걷는다(⚠️ 표식이 선 것만). */
export function collectSourceNotations(baseDir: string = repoRoot): readonly SourceNotation[] {
  const found: SourceNotation[] = [];
  for (const file of SOURCE_AXIS_FILES) {
    const absolute = join(baseDir, file.path);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, "utf8");
    const needle = markedSourceNeedle();
    let match: RegExpExecArray | null;
    while ((match = needle.exec(source)) !== null) {
      const inner = match[1];
      if (!TYPE_WORD.test(inner)) continue;
      found.push({
        file: file.path,
        inner,
        decisive: DECISIVE_WORD.test(inner),
        hand: HAND_PHRASE.test(inner)
      });
    }
  }
  return found;
}

/** 넓은 바늘로 센 수(인용 포함) — 사각의 값을 내는 자. */
export function countAnyParenSourceNotations(baseDir: string = repoRoot): number {
  let total = 0;
  for (const file of SOURCE_AXIS_FILES) {
    const absolute = join(baseDir, file.path);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, "utf8");
    const needle = anyParenSourceNeedle();
    let match: RegExpExecArray | null;
    while ((match = needle.exec(source)) !== null) {
      if (TYPE_WORD.test(match[1])) total += 1;
    }
  }
  return total;
}

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
 * 안에서 예순하나가 풀렸다"* 는 뜻이다. 밖은 아래 여섯으로 갈리고 하나하나가 오늘의 값과 하한을 진다.
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
    valueToday: 145,
    floor: 60,
    measure: (baseDir) => collectDocumentSites(baseDir).filter((site) => site.bucket === "prose").length,
    reopenCondition:
      "재개 조건(결정형 · 손은 저장소 안): 관례를 소급해 적용할지를 F가 정하는 날 — " +
      "그날 이 145가 줄기 시작하고, 이 대장의 하한이 그 방향을 값으로 보여 준다. " +
      "⚠️ 두 시점: 트랙 D 시점의 값은 119였고 같은 라운드의 C·F가 산문 조건을 더해 오늘 145다 " +
      "(라운드 89 리뷰 M-4 재실측) — **가장 큰 사각은 라운드가 지나며 줄지 않고 늘고 있다.**"
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
    what: "`docs/5차/**` 라운드 노트의 재개 조건 자리 전수(오늘 정찰 노트 아홉이 지고 있다).",
    why:
      "⚠️ 라운드별 **작업 기록**이지 판정 문서가 아니다. 모집단에 넣으면 이 대장의 수가 매 라운드 " +
      "통째로 흔들리고(라운드마다 노트가 한 벌씩 늘어난다) 래칫이 뜻을 잃는다 — 넓히는 대신 " +
      "값으로 적는다.",
    valueToday: 221,
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
      "짝 문서 둘(`runtime-verification-required.md` 다섯 · `accessibility-offline-checklist.md` 넷)의 " +
      "재개 조건 자리 **아홉** — 그중 형을 괄호로 밝힌 것은 **하나뿐**(C-12의 사건형)이고 " +
      "⚠️ **이 계약의 축이 무는 결정형은 오늘도 0건**이다. " +
      "⚠️ 두 시점: 트랙 D 시점에는 자리가 하나·셋(합 넷)이었고 오늘은 다섯·넷(합 아홉)이다 — " +
      "**자리는 배를 넘게 늘었는데 괄호로 형을 밝힌 것은 여전히 하나이고 결정형은 여전히 0건**이라, " +
      "이 사각을 모집단에 넣지 않기로 한 판단은 오늘도 같다(라운드 89 리뷰 M-4 재실측).",
    why:
      "자리가 넷이고 결정형이 0건이라, 모집단에 넣어도 축은 아무것도 지키지 못하면서 하한만 " +
      "0인 뿌리가 하나 늘어난다(주석 관용 앵커 대장이 `ZERO_YIELD_ROOTS`에 적은 그 규율). " +
      "⚠️ **그리고 이 라운드에 그 둘을 여는 트랙이 있다**(E가 접근성 표를 읽는다) — " +
      "한 문서에 축 둘을 얹지 않는다.",
    valueToday: 9,
    floor: 1,
    measure: (baseDir) => SIBLING_DOCUMENTS.reduce((sum, path) => sum + countSitesIn(baseDir, path), 0),
    reopenCondition:
      "재개 조건(사건형): 짝 문서 중 하나에 **결정형** 표기가 처음 서는 날 — 그날 그 문서는 " +
      "`LEDGER_DOCUMENT` 옆에 서고 자기 하한을 얻는다."
  },
  {
    id: "quoted-source-conditions",
    what:
      "소스 축에서 **인용된 과거 조건** — `dead-export-ledger.ts`가 라운드 87의 문장을 인용하며 " +
      "적어 둔 표기 둘(⚠️ 표식이 없다).",
    why:
      "인용은 오늘의 약속이 아니라 어제의 기록이다. 인용까지 조항으로 물면 '옛 문장을 인용하려면 " +
      "그 문장을 고쳐 적어야 한다'가 되고, 그것은 기록을 지우는 일이다. ⚠️ 대신 넓은 바늘의 수를 " +
      "값으로 든다(오늘 좁은 바늘 **다섯** · 넓은 바늘 **일곱** — 두 시점: 트랙 D 시점에는 넷·여섯이었고 " +
      "차이는 그때도 오늘도 둘이다).",
    valueToday: 2,
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
      "강조·인용이 섞인 줄에서 그것은 다른 그물의 일이다). 오늘 언급 264와 자리 252의 차이가 " +
      "그 수이고, 판정이 갈리는 자리는 0건이다(둘 다 형 표기가 없거나 같은 형이다). " +
      "⚠️ 두 시점: 트랙 D 시점에는 언급 210 · 자리 203 · 차이 일곱이었고, 오늘은 264 · 252 · " +
      "**열둘**이다(라운드 89 리뷰 M-4 재실측).",
    valueToday: 12,
    floor: 0,
    measure: (baseDir) => {
      const absolute = join(baseDir, LEDGER_DOCUMENT.path);
      return countMentions(readFileSync(absolute, "utf8")) - collectDocumentSites(baseDir).length;
    },
    reopenCondition:
      "재개 조건(사건형): 한 줄 안에서 두 조건의 **형이 갈리는** 자리가 생기는 날 — " +
      "그날 이 대장은 자리를 문장으로 세는 법을 배워야 한다."
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
