// 라운드 89 트랙 E (round89-scout #5) — C-3 경과 수가 **세 자리**에서 갈리지 않는다.
// ⚠️ 두 시점: 트랙 E가 세울 때 이 줄은 *"두 자리"* 였다. 셋째 자리(짝 문서 §0-1)는
// **라운드 89 리뷰 M-3**이 찾았고, 그날 이 계약이 그 자리도 함께 물게 넓혀졌다.
//
// ⚠️ **이것은 새 그물이 아니라 `runtime-checklist-shape.test.ts`의 *짝*이다.** 라운드 75 트랙 C가
// 짝 문서(`docs/qa/runtime-verification-required.md`)에 세운 계약을 **같은 계열의 둘째 문서**
// (`docs/qa/accessibility-offline-checklist.md`)에 같은 방식으로 놓는다: 문서가 손으로 적은 수를
// **그 문서를 파싱한 값**에서 파생시킨다(셸 0건 · 문서 쓰기 0건). 두 파일의 축은 서로 다르고
// (그쪽은 짝 문서의 §0 여섯 숫자, 이쪽은 접근성 표의 C-3 경과 수) 한 트랙이 한 그물에 축 둘을
// 얹지 않는다 — 그 사실을 아래 "이 그물의 자리"가 값으로 확인한다.
//
// **오늘의 관측(정찰이 값으로 본 것을 이 파일이 다시 셌다 — 두 시점으로 적는다).**
// C-3(잠금 오버레이 TalkBack 투과)의 "몇 라운드째 미확인인가"를 말하는 자리는 **셋**이다 —
// 접근성 표 본문에 둘, 짝 문서 §0-1에 하나.
//
//   · **당시(정찰 시점 — 이 계약이 태어난 이유)**: 접근성 표의 두 자리가 세 라운드째 서로 다른 수를
//     말했다. `## C절.` 표의 C-3 행 — **스물두**(67·68·…·88) · `## 수동 증거` 절의 C-3 줄 —
//     **열아홉**(67·68·…·85). ⚠️ 그리고 이 계약도 자리를 **둘로만** 셌다(모집단을 한 파일로 그었다).
//   · **오늘(라운드 89 HEAD 재실측)**: 같은 라운드의 트랙 F가 **접근성 표의 두 자리를 함께 올려**
//     갈림이 닫혔다. `## C절.` 표의 C-3 행 — **스물세**(67·68·…·89) · `## 수동 증거` 절의 C-3 줄 —
//     **스물세**(67·68·…·89). 끝 라운드 차이 = **0**. ⚠️ **그리고 라운드 89 리뷰(M-3)가 셋째 자리를
//     찾았다** — `docs/qa/runtime-verification-required.md:367` §0-1의 🔒 줄, 오늘 **스물세**(67·…·89)로
//     C절과 정합이지만 **어느 계약도 물지 않던 자리**였다. 오늘부터는 이 파일이 함께 문다.
//
// 세 자리 각각은 **자기 안에서는 정합**이다(수사 = 목록 길이 — 당시 22/19, 오늘 23/23/23). 갈린 것은
// **어디까지 적었는가**뿐이었고, 그 갈림은 라운드 86·87·88 동안 C절만 자라는 사이에 셋으로 벌어졌다가
// 라운드 89에 0으로 닫혔다. 이 계약이 세는 것은 그
// **수의 정합**이지 **확인 여부가 아니다** — C-3을 실제로 확인할 손은 저장소 밖이고, 그 배정을
// 이 파일이 대신할 수는 없다(그 사실은 ⓕ 사각에 값으로 적혀 있다).
//
// 이 파일이 묻는 것은 여덟이다(라운드 91 트랙 E가 ⓖ를, 라운드 92 트랙 E가 ⓗ를 더했다).
//  ⓐ **자기 정합** — 경과 수를 말하는 **세 자리** 각각에서 한글 수사가 **열거된 라운드 목록의 길이**와
//     같은가(당시 22/22 · 19/19 두 자리, 오늘 23/23 · 23/23 · 23/23 세 자리).
//  ⓑ **접두** — "수동 증거" 절의 목록이 C절 목록의 **접두**인가(두 목록이 서로 다른 라운드를
//     말하면 그날 빨개진다 — 뒤처지는 것은 허용하되 **갈라지는 것**은 허용하지 않는다).
//  ⓒ **갈림의 상한 래칫** — 두 목록의 **끝 라운드 차이가 오늘의 실측 갈림(0)을 넘지 않는가**.
//     ⚠️ **이것이 이 계약의 축이다**: 다음 라운드가 C절만 90으로 올리면 차이가 하나가 되어 **그 갱신이
//     빨개진다**. 고치는 법은 하나뿐이고 쉽다 — **세 자리를 함께 올린다**(그때 차이는 그대로 0이다).
//     ⚠️ **두 시점**: 당시 이 상한은 3(88 − 85)이었다. 같은 라운드의 트랙 F가 두 자리를 함께 올려
//     갈림이 0이 됐는데 상한만 3으로 남아, *"C절만 올리기"* 가 세 걸음까지 조용히 통과하는 상태로
//     한동안 초록이었다(라운드 89 리뷰 M-2). **두 자리를 함께 올린 라운드는 이 상한도 그날의
//     실측 갈림으로 함께 내린다** — 그것이 이 상수에 값으로 박힌 규율이다.
//  ⓓ **목록의 모양** — 목록이 **67부터 빠짐없이 연속**인가(중간에 빠진 라운드가 0건).
//  ⓔ **좌표** — 접근성 표가 짝 문서를 가리키는 자리가 **실재로 풀리는가**.
//     ⚠️ **세 시점 — 이 축은 라운드 90 트랙 D가 *모집단만* 넓혔다(새 축을 얹지 않았다).**
//      · **당시(라운드 89 트랙 E·리뷰 M-3)**: 모집단이 **한 자리**였다 — C-3이 스스로 적은 좌표
//        (짝 문서의 행 번호 하나 · 표면 하나)가 두 문서에서 같은 값인가만 물었다. 접근성 표
//        전체가 짝 문서를 아흔 번 넘게 가리키고 있었는데 **그 아흔은 어느 계약도 풀어 보지 않았다.**
//      · **트랙 D 커밋 시점(2026-08-31 · 트랙 F 머지 전)**: `§1-1 #N` 꼴로 가리키는 자리를
//        **전수**로 걸기 시작했다 — 자리 **91** · 인용된 번호 **95**(사슬 셋이 그 차이다:
//        `#37·#40·#45` · `#38·#48` · `#56·#57`) · 서로 다른 번호 **91**(⚠️ 정찰이 값으로 적은
//        **87**은 자리마다 **첫 번호만** 셌을 때의 값이다 — 그 갈림이 이 트랙의 재실측이고,
//        하한은 정찰의 87로 둔다) · 표면까지 함께 적은 참조 **32** · 역방향 **8**(⚠️ 정찰의
//        하한은 7 — 줄바꿈을 넘는 자리 하나를 `:575`에서 더 찾았다) · 짝 문서의 번호 행 **163**.
//      · **오늘(라운드 90 리뷰 M-2의 HEAD 재실측 · 트랙 F 머지 뒤)**: 같은 라운드의 F가 접근성
//        표에 A-31(`#106`)을, 짝 문서에 `#164`·`#165`를 더해 수가 함께 움직였다 —
//        자리 **92** · 인용된 번호 **96** · 서로 다른 번호 **92** · 표면까지 적은 참조 **33** ·
//        역방향 **8**(그대로) · 짝 문서의 번호 행 **165**(§1-1은 **153**). 어긋남은 세 시점 다
//        **0**이다. ⚠️ **아래 단언이 무는 것은 이 수들이 아니라 하한**이므로(래칫), 이 문단은
//        *언제 무엇이 실측이었는가*의 기록이고 F의 갱신은 계약을 빨갛게 만들지 않았다.
//  ⓕ **사각** — 이 그물이 못 보는 것을 값과 하한으로 적는다.
//  ⓖ **문서가 옮겨 적은 이 계약의 상수** — 접근성 표가 ⓒ의 상수(`MAX_DIVERGENCE`)를 **산문으로
//     인용한 자리**가 오늘의 상수와 같은 수를 말하는가.
//     ⚠️ **라운드 91 트랙 E가 더한 새 축이고, 세운 이유는 사각 `문서가-옮겨-적은-계약-상수`가
//     자기 재개 조건에 *그날의 첫 모집단*까지 적어 두었기 때문이다**(라운드 90 트랙 D → 오늘 도래).
//      · **모집단(오늘 셋)**: `:22` 머리말 · `:1153` C절 C-3 행 · `:1188` 수동 증거 절.
//      · ⚠️⚠️ **두 시점을 적은 자리는 *오늘* 쪽만 문다** — `:22`는 *"셋 → 0"* 의 역사를 지녔고,
//        그 인용까지 물면 이 계약은 문서에게 **기록을 지우라**고 요구하게 된다.
//      · ⚠️ **오늘 세 자리 다 상수(0)와 맞아 이 축은 첫날부터 초록이다** — 빨간 계약을 세우면
//        이 트랙이 문서를 고쳐야 하고, 그 순간 *계약이 문서를 지킨다*가 뒤집힌다.
//      · ⚠️ **무는 것은 문서 쪽이지 상수가 아니다** — 상수는 한 바이트도 움직이지 않았다(0 그대로 ·
//        올리는 것은 갈림을 넓히는 일이라 금지, 내리는 쪽만 안전하다).
//  ⓗ **이동 의무 — *누가 언제 이 좌표를 옮기는가*가 자리마다 적혀 있는가.**
//     이 계약(과 짝 계약)의 **소스**가 문서의 좌표를 **등호로 무는 자리**마다, 그 자리 **바로 위**에
//     옮기는 손과 시점이 적혀 있을 것을 묻는다.
//     ⚠️ **라운드 92 트랙 E가 더한 새 축이고, 세운 이유는 AF-5가 값으로 적은 그 비용이다.**
//     ⓖ의 `[22, 1223, 1267]`은 F의 문서 걸음이 밀 때마다 **F가 함께 옮겨야 하는 등호**이고, 그
//     의무는 오늘 저장소에서 **그 한 자리에만** 적혀 있었다 — 절 이름을 등호로 무는 자리들은 같은
//     의무를 지면서도 **한 자도 적혀 있지 않았다**. 그 빈 자리를 이 트랙이 적는다.
//      · **모집단(두 파일 합 · 전수 파생 · 손 목록 금지)**: 문서 줄 번호를 리터럴 배열로 등호에 넣은
//        자리 **하나** · 절 제목 문자열을 등호로 찾는 자리 **여덟**.
//        ⚠️ **두 시점**: 정찰의 실측은 **하나와 여섯**이었다 — 그 여섯은 `headingLine(…)` 꼴만
//        셌을 때의 값이고, 같은 일을 하는 `startsWith("### 0-1.")` 꼴 **둘**이 그 갈림이다(이 트랙의
//        재실측). **하한은 정찰의 여섯으로 둔다**(라운드 90 트랙 D가 87을 하한으로 둔 그 형식).
//      · ⚠️⚠️ **두 수를 한 낱말로 적지 않는다** — 한 수로 접으면 이 축이 닫힌 것으로 읽힌다.
//      · ⚠️ **의무 문장은 이 트랙이 소스에 적는 것이므로 세우는 순간 초록이다** — 문서는 한 글자도
//        고치지 않는다(고치는 손은 F뿐이고, `[22, 1223, 1267]`의 값도 F가 옮긴다).
//      · **재개 조건(사건형): 저장소의 다른 계약이 문서 좌표를 등호로 물기 시작하는 날 — 그날 이
//        모집단이 이 두 파일 밖으로 넓어진다.**
//
// ⚠️ **이 계약은 문서를 고치지 않는다.** 읽기만 한다(`docs/**` 쓰기 0건). 세 자리를 맞추는 갱신은
// 문서 트랙의 몫이고, 이 파일은 그 갱신이 **한 자리만 고치고 지나가는 것**을 막는 자리에 선다.
//
// ⚠️ **머리말의 옛 라운드 문단은 모집단이 아니다.** `:199`·`:229`·`:262`(네·다섯·여섯 라운드 연속)는
// 낡은 수가 아니라 **그 라운드의 기록**이다 — 같은 모양을 하고 있어도 세지 않는다. 그 셋이 오늘도
// 실재한다는 사실은 ⓕ 사각에 하한으로 적혀 있다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

const CHECKLIST_PATH = "docs/qa/accessibility-offline-checklist.md";
/** 짝 문서 — 좌표(ⓔ)를 대조하기 위해서만 읽는다. */
const PAIR_DOC_PATH = "docs/qa/runtime-verification-required.md";
/** 짝 계약 — 이 파일의 본보기이자 같은 계열의 첫째 그물(읽기만 · 바이트 불변). */
const PAIR_CONTRACT_PATH = "packages/test-utils/src/runtime-checklist-shape.test.ts";
/** 이 계약 자신 — ⓖ의 **자기 배제**를 값으로 보이기 위해서만 읽는다. */
const SELF_PATH = "packages/test-utils/src/accessibility-checklist-shape.test.ts";
/** 판정 문서 — ⓖ의 사각(이 축이 못 보는 *이름+값* 자리)을 값으로 재기 위해서만 읽는다. */
const JUDGEMENT_DOC_PATH = "docs/operations/known-limitations.md";

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, ...relativePath.split("/")), "utf8");
}

const source = read(CHECKLIST_PATH);
const lines = source.split("\n");

function headingLine(prefix: string): number {
  const index = lines.findIndex((line) => line.startsWith(prefix));
  expect(index, `${prefix} 제목을 찾지 못했어요`).toBeGreaterThan(-1);
  return index + 1;
}

/**
 * 오늘: **304 · 1272 · 1292**. 값은 여기 적지 않고 제목에서 찾는다.
 *
 * ⚠️ **두 시점 — 라운드 92 리뷰 M-4가 이 기록을 HEAD 실측으로 갱신했다.** 종전 이 자리는
 * *268 · 1022 · 1042*라고 적혀 있었고, 그것은 **그 수를 적은 라운드의 실측**이었다(그 뒤로 A절이
 * 자라고 C-3이 라운드마다 문단을 얹으며 세 제목이 함께 밀렸다). ⚠️ **이 세 수는 기록이지 계약이
 * 아니다** — 계약이 무는 것은 아래 `headingLine`이 찾는 **절의 이름**뿐이라 줄이 밀려도 빨개지지
 * 않고, 그래서 이 괄호가 조용히 낡을 수 있었다.
 *
 * ⚠️ **이동 의무(ⓗ · 라운드 92 트랙 E)** — 아래 셋은 절의 **줄 번호**가 아니라 **이름**을 등호로
 * 무는 자리다. 그래서 F가 절을 더하거나 지워 줄이 밀리는 라운드에는 아무도 손대지 않아도 되고,
 * **절의 이름 자신이 바뀌는 라운드에만** 옮긴다 — 그 손은 그 제목을 고치는 **문서 트랙(F)**이고,
 * 시점은 **그 제목을 고치는 그 라운드 안**이다(다음 라운드로 미루면 그 사이 이 계약이 빨간 채로
 * 선다). 이름이 사라지면 아래 `headingLine`이 그 자리에서 곧바로 빨개진다(ⓓ fail-closed).
 */
const SECTION_A_LINE = headingLine("## A절.");
/**
 * ⚠️ **이동 의무(ⓗ)** — `## C절.` 제목을 고치는 손이 **같은 라운드 안에** 이 등호를 함께 옮긴다.
 * 오늘 그 손은 문서 트랙(F)이다 — 이 계약은 문서를 고치지 않으므로, 제목이 먼저 움직이고 이
 * 등호가 뒤따른다.
 */
const SECTION_C_LINE = headingLine("## C절.");
/**
 * ⚠️ **이동 의무(ⓗ)** — `## 수동 증거` 제목을 고치는 손이 **같은 라운드 안에** 이 등호를 함께
 * 옮긴다(오늘 그 손은 문서 트랙 F다). 이 절은 C-3의 셋 가운데 둘째 자리를 지므로, 이름이 바뀌면
 * ⓑ·ⓒ의 견줌이 통째로 멈춘다 — 그래서 조용히 낡는 대신 그 자리에서 빨개지는 쪽을 고른다.
 */
const SECTION_MANUAL_LINE = headingLine("## 수동 증거");

// ---------------------------------------------------------------------------
// 한글 수사 → 수 (관형사형: 한·두·세·네·… · 열아홉 · 스물두)
// ---------------------------------------------------------------------------

const UNITS: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9
};

const TENS: Record<string, number> = { 열: 10, 스물: 20, 서른: 30 };

/** 홀로 설 때의 꼴(`스무 라운드`는 `스물`이 아니다). */
const STANDALONE: Record<string, number> = { ...UNITS, 열: 10, 스무: 20, 서른: 30 };

/** 모르는 수사는 `NaN`으로 돌려 계약이 그 자리에서 빨개지게 한다(조용한 통과 금지). */
function koreanNumeral(word: string): number {
  if (word in STANDALONE) return STANDALONE[word];
  for (const [tens, base] of Object.entries(TENS)) {
    if (!word.startsWith(tens)) continue;
    const unit = UNITS[word.slice(tens.length)];
    if (unit !== undefined) return base + unit;
  }
  return Number.NaN;
}

// ---------------------------------------------------------------------------
// 바늘 — "<한글 수사> 라운드 연속 … (67·68·…)" 자리를 전수로 걷는다.
// ---------------------------------------------------------------------------

/**
 * ⚠️ **바늘을 값으로 적는다.** 이 정규식은 *수사 + "라운드 연속" + 괄호 안 라운드 목록*이 한 덩어리로
 * 선 자리만 문다. 그래서 `A-29`의 산문("C-3이 스물두 **라운드째** 그러하듯")처럼 목록을 지지 않는
 * 인용은 모집단 밖이다 — 그 자리에는 맞출 목록이 없으므로 정합을 물을 대상도 없다.
 * 수사와 괄호 사이는 줄바꿈을 넘을 수 있다(수동 증거 절의 그 줄이 실제로 두 줄에 걸쳐 있다).
 */
const ROUND_RUN_PATTERN = /([가-힣]+)\s*라운드\s*연속[^(]{0,40}\(\s*(\d+(?:\s*·\s*\d+)*)/g;

type RoundRunSite = {
  readonly numeral: string;
  readonly declared: number;
  readonly rounds: number[];
  readonly line: number;
};

function collectSites(text: string, lineOffset = 0): RoundRunSite[] {
  return [...text.matchAll(ROUND_RUN_PATTERN)].map((match) => ({
    numeral: match[1],
    declared: koreanNumeral(match[1]),
    rounds: match[2].split("·").map((piece) => Number(piece.trim())),
    line: lineOffset + text.slice(0, match.index).split("\n").length
  }));
}

function sliceLines(fromLine: number, toLine: number): string {
  return lines.slice(fromLine - 1, toLine - 1).join("\n");
}

/** 머리말(A절 앞) — 옛 라운드 문단이 사는 자리. **모집단 밖**이다. */
const headlineSites = collectSites(sliceLines(1, SECTION_A_LINE));
/** 본문(A절부터 끝까지) — 이 계약의 모집단. */
const bodySites = collectSites(
  lines.slice(SECTION_A_LINE - 1).join("\n"),
  SECTION_A_LINE - 1
);

const cSectionSites = bodySites.filter(
  (site) => site.line >= SECTION_C_LINE && site.line < SECTION_MANUAL_LINE
);
const manualSites = bodySites.filter((site) => site.line >= SECTION_MANUAL_LINE);
const strayBodySites = bodySites.filter(
  (site) => !cSectionSites.includes(site) && !manualSites.includes(site)
);

// ---------------------------------------------------------------------------
// 셋째 자리 — **짝 문서** §0-1의 C-3 줄 (라운드 89 리뷰 M-3)
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **경과 수를 말하는 자리는 둘이 아니라 셋이었다.**
 *
 *  · **당시(라운드 89 트랙 E가 이 계약을 세운 시점)**: 이 파일은 자리를 **둘**로 셌다 —
 *    접근성 표의 C절 행과 수동 증거 절. 모집단을 `docs/qa/accessibility-offline-checklist.md`
 *    **한 파일 안**으로 그었기 때문이고, 그래서 짝 문서 §0-1이 같은 사실을 세 번째로 말한다는
 *    것을 보지 못했다. 그 자리는 어느 계약도 물지 않은 채 라운드 여럿을 지나왔다.
 *  · **오늘(라운드 89 리뷰 M-3이 찾았다)**: `docs/qa/runtime-verification-required.md:367`
 *    §0-1의 🔒 줄이 같은 경과 수를 **셋째로** 말한다. C-3의 판정은 접근성 표가 지는데
 *    (그 줄이 스스로 그렇게 적는다), 수는 여기에도 손으로 한 벌 더 적혀 있었다.
 *
 * 그래서 모집단을 **한 파일**이 아니라 **한 사실**로 다시 긋는다 — 파서는 그대로 재사용하고
 * (`ROUND_RUN_PATTERN`·`collectSites`), ⓐ 자기 정합 · ⓑ 접두 · ⓒ 갈림 상한 · ⓓ 목록 모양을
 * 셋째 자리에도 똑같이 묻는다. 한 자리만 올리고 지나가는 갱신이 이제 **세 자리 어디서든** 잡힌다.
 *
 * ⚠️ 짝 문서의 다른 `라운드 연속` 자리(오늘 `:266` 일곱 · `:1212` 여덟)는 **모집단 밖**이다 —
 * 접근성 표의 머리말 옛 문단과 같은 성격의, 날짜가 박힌 그 라운드의 기록이다. §0-1로 범위를
 * 좁히는 것이 그 둘을 빼는 방법이고, 그 둘이 오늘도 실재한다는 사실은 ⓕ 사각이 하한으로 든다.
 */
const pairLines = read(PAIR_DOC_PATH).split("\n");

/**
 * 짝 문서 §0-1의 범위 — `### 0-1.`부터 다음 `## `까지(0-based 인덱스).
 *
 * ⚠️ **이동 의무(ⓗ · 라운드 92 트랙 E)** — 이 등호가 무는 것은 짝 문서의 **절 이름**이다.
 * 짝 문서에 행이 늘어 줄이 밀리는 라운드에는 아무도 손대지 않고, **§0-1의 제목이 바뀌거나 그 절이
 * 사라지는 라운드에만** 옮긴다 — 그 손은 짝 문서를 고치는 **문서 트랙(F)**이고, 시점은 **그 제목을
 * 고치는 그 라운드 안**이다. 못 찾으면 아래 단언이 `-1`에서 빨개진다(ⓓ fail-closed).
 */
const PAIR_S01_FROM = pairLines.findIndex((line) => line.startsWith("### 0-1."));
const PAIR_S01_TO = pairLines.findIndex(
  (line, index) => index > PAIR_S01_FROM && /^## /.test(line)
);

const pairSection01Sites = collectSites(
  pairLines.slice(PAIR_S01_FROM, PAIR_S01_TO).join("\n"),
  PAIR_S01_FROM
);

/** 짝 문서 전체의 경과 수 자리 — §0-1 밖의 것은 옛 기록이다(ⓕ의 하한이 그 실재를 든다). */
const pairAllSites = collectSites(pairLines.join("\n"));
const pairLegacySites = pairAllSites.filter(
  (site) => site.line < PAIR_S01_FROM || site.line >= PAIR_S01_TO
);

// ---------------------------------------------------------------------------
// C절 표 — 경과 수 축을 진 줄이 어디까지인지(ⓕ) 세기 위해 행을 뽑는다.
// ---------------------------------------------------------------------------

type Row = { readonly cells: string[]; readonly line: number };

function splitCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

function tableRows(fromLine: number, toLine: number, idPattern: RegExp): Row[] {
  const rows: Row[] = [];
  for (let index = fromLine - 1; index < toLine - 1 && index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const cells = splitCells(lines[index]);
    if (!idPattern.test(cells[0])) continue;
    rows.push({ cells, line: index + 1 });
  }
  return rows;
}

/** `C-1`~`C-12` 행 전부(오늘 열둘). */
const cRows = tableRows(SECTION_C_LINE, SECTION_MANUAL_LINE, /^C-\d+$/);
const c3Row = cRows.find((row) => row.cells[0] === "C-3");
const manualSection = lines.slice(SECTION_MANUAL_LINE - 1).join("\n");

// ---------------------------------------------------------------------------
// ⓔ의 모집단 — 한 자리(C-3)에서 **전수**로 (라운드 90 트랙 D)
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **넓힌 것은 모집단이지 축이 아니다.** 이 파일의 ⓔ는 처음부터 *좌표가 두 문서에서 같은
 * 값인가*를 물었고, 그 모집단이 **C-3 한 자리**였다. 라운드 90 트랙 D가 하는 일은 그 한 자리를
 * **접근성 표가 짝 문서를 가리키는 자리 전부**로 바꾸는 것뿐이다 — 새 축(ⓖ)을 얹지 않는다.
 *
 * ⚠️ **바늘을 값으로 적는다.** 접근성 표가 짝 문서를 부르는 꼴은 `… §1-1 #85` 한 가지이고,
 * 굵게(`**#152**`)·사슬(`#37·#40·#45`)·표면 딸림(`**#113**(표면 `브라우저`)`)이 그 변주다.
 * 그래서 이 바늘은 **`§1-1` 뒤에 붙은 `#N` 덩어리**만 문다 —
 *  · `§1-1의 74~81행`·`§1-1이 91번까지` 같은 **범위 산문은 모집단 밖**이다(그 자리에는 풀 좌표가
 *    아니라 그 라운드가 어디까지 채웠는지의 기록이 있다),
 *  · 짝 문서를 부르지 않고 선 `#160`·`#161` 같은 산문 속 번호도 모집단 밖이다(어느 표의 번호인지를
 *    그 자리가 말하지 않으므로 풀 대상이 없다 — 종전 ⓔ가 C-3 칸에서 그 둘을 피한 것과 같은 이유다).
 */
const COORDINATE_SITE_PATTERN =
  /§1-1\s*(?:의|이|은|는)?\s*(\*{0,2}#\d+\*{0,2}(?:\s*·\s*\*{0,2}#\d+\*{0,2})*)/g;

/** 표면까지 함께 적은 참조 — `§1-1 **#113**(표면 `브라우저`)` 꼴(오늘 33 · D 커밋 시점 32). */
const SURFACE_SITE_PATTERN =
  /§1-1\s*(?:의|이|은|는)?\s*\*{0,2}#(\d+)\*{0,2}\s*\(\s*표면\s*`([^`]+)`/g;

/** 역방향 — 짝 문서가 접근성 표의 항목을 이름으로 가리키는 자리(오늘 8 · 정찰 하한 7). */
const REVERSE_REF_PATTERN =
  /accessibility-offline-checklist\.md`?\s*(?:의|에도|에|이|은|는)?\s*\*{0,2}([AC]-\d+)/g;

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

type CoordinateSite = { readonly numbers: number[]; readonly line: number };

function collectCoordinateSites(text: string): CoordinateSite[] {
  return [...text.matchAll(COORDINATE_SITE_PATTERN)].map((match) => ({
    numbers: (match[1].match(/\d+/g) ?? []).map(Number),
    line: lineOf(text, match.index)
  }));
}

type SurfaceSite = { readonly number: number; readonly surface: string; readonly line: number };

function collectSurfaceSites(text: string): SurfaceSite[] {
  return [...text.matchAll(SURFACE_SITE_PATTERN)].map((match) => ({
    number: Number(match[1]),
    surface: match[2],
    line: lineOf(text, match.index)
  }));
}

const coordinateSites = collectCoordinateSites(source);
/** 사슬을 편 전수(오늘 96 · D 커밋 시점 95) — 사슬의 둘째·셋째 번호도 좌표다. */
const citedNumbers = coordinateSites.flatMap((site) => site.numbers);
const surfaceSites = collectSurfaceSites(source);

/** 짝 문서의 번호 행 — `| 85 | `실기기` | … |` 꼴. */
type NumberedRow = {
  readonly number: number;
  readonly surface: string;
  readonly item: string;
  readonly line: number;
};

function numberedRows(docLines: string[], fromIndex: number, toIndex: number): NumberedRow[] {
  const rows: NumberedRow[] = [];
  for (let index = Math.max(fromIndex, 0); index < Math.min(toIndex, docLines.length); index += 1) {
    const trimmed = docLines[index].trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const cells = splitCells(docLines[index]);
    if (!/^\d+$/.test(cells[0])) continue;
    rows.push({
      number: Number(cells[0]),
      surface: (cells[1] ?? "").replace(/`/g, "").trim(),
      item: cells[2] ?? "",
      line: index + 1
    });
  }
  return rows;
}

/**
 * 짝 문서 §1-1의 범위 — `### 1-1.`부터 다음 `## `까지(0-based 인덱스 · 오늘 **398~1216**행).
 *
 * ⚠️ **두 시점(리뷰 M-4)** — 종전 이 괄호는 *395~1185*였다. 그 사이 앞쪽이 세 줄, §1-1 자신이
 * 스물여덟 줄 자랐고(라운드 92 F의 `#168` 행 포함), 아래 등호는 **절 이름**만 물므로 그 성장에 빨개지지 않았다.
 *
 * ⚠️ **이동 의무(ⓗ)** — 괄호 안의 `395~1185`는 **기록**이지 이 계약이 무는 값이 아니다(무는 것은
 * 아래 등호의 **절 이름**뿐이다). 그래서 §1-1이 라운드마다 자라도 옮길 것이 없고, **그 제목이
 * 바뀌는 라운드에만** 문서 트랙(F)이 **같은 라운드 안에** 이 등호를 함께 옮긴다.
 */
const PAIR_S11_FROM = pairLines.findIndex((line) => line.startsWith("### 1-1."));
const PAIR_S11_TO = pairLines.findIndex(
  (line, index) => index > PAIR_S11_FROM && /^## /.test(line)
);

/** §1-1의 번호 행(오늘 153 — 13~165 · D 커밋 시점 151 — 13~163). */
const pairSection11Rows = numberedRows(pairLines, PAIR_S11_FROM, PAIR_S11_TO);
/** 짝 문서 전체의 번호 행(오늘 165 — 1~165, 빠진 번호 0 · D 커밋 시점 163). */
const pairAllRows = numberedRows(pairLines, 0, pairLines.length);
const pairRowByNumber = new Map(pairSection11Rows.map((row) => [row.number, row]));

/** 접근성 표의 항목 이름 — A절은 `### A-N.` 제목, C절은 표의 첫 칸. */
const accessibilityItemIds = new Set<string>([
  ...lines.flatMap((line) => {
    const match = /^### (A-\d+)\./.exec(line);
    return match ? [match[1]] : [];
  }),
  ...cRows.map((row) => row.cells[0])
]);

const pairDocText = pairLines.join("\n");
const reverseSites = [...pairDocText.matchAll(REVERSE_REF_PATTERN)].map((match) => ({
  id: match[1],
  line: lineOf(pairDocText, match.index)
}));

// ---------------------------------------------------------------------------
// 이 계약의 축 상수 — ⓒ가 물고, ⓖ가 **문서가 옮겨 적은 그 값**을 대조한다.
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **오늘의 실측 갈림이다(89 − 89 = 0).** 이 상수를 올리는 것은 *갈림을 넓히는 것*이므로,
 * 올리려는 사람은 왜 두 자리를 함께 고칠 수 없었는지를 여기 함께 적어야 한다.
 * C절만 한 라운드 더 올리면 하나가 되어 이 줄이 빨개진다 — 그때의 고침은 **수동 증거 절도 함께
 * 올리는 것**이고, 그러면 차이는 그대로 0이다.
 *
 * ⚠️⚠️ **두 시점 — 이 상수는 라운드 89 리뷰(M-2)가 내린 값이다.**
 *  · **당시(라운드 89 트랙 E가 이 계약을 세운 시점)**: 갈림 셋(C절 88 · 수동 증거 절 85)이
 *    실측이었고 상수도 3이었다. 그래서 *"C절만 올리면 넷이 되어 빨개진다"* 가 참이었다.
 *  · **오늘(라운드 89 HEAD 재실측)**: 같은 라운드의 트랙 F가 **두 자리를 함께 89로 올려**
 *    갈림이 **0**이 됐다. 상수만 3으로 남으니 *"C절만 올리기"* 는 갈림 하나·둘·셋까지
 *    조용히 통과했다 — **계약의 축이 세 걸음만큼 헐거워진 채 초록이었다.**
 *
 * ⚠️ **그래서 규율을 값으로 적는다: 두 자리를 함께 올린 라운드는 이 상한도 그날의 실측
 * 갈림으로 함께 내린다.** 상한을 오늘의 실측에 붙여 두면 갈림이 다시 벌어지기 위해서는
 * 누군가 **이 상수를 의식적으로 올려야** 하고, 그 한 줄의 변경이 곧 신호다(문서가 조용히
 * 갈라지는 길이 사라진다). 내리는 것은 언제나 안전하다 — 갈림은 하한이 없다.
 *
 * ⚠️ **라운드 91 트랙 E가 이 상수를 describe 안에서 모듈 자리로 옮겼다** — 값은 한 바이트도
 * 바뀌지 않았고(0 그대로), 옮긴 이유는 아래 ⓖ가 **같은 binding**을 물게 하기 위해서다.
 * 문서 쪽 값과 대조하는 축이 상수의 *사본*을 들면 그 사본이 낡는 순간 축이 거짓말을 한다.
 */
const MAX_DIVERGENCE = 0;

// ---------------------------------------------------------------------------
// ⓖ의 모집단 — **문서가 이 계약의 상수를 산문으로 인용한 자리** (라운드 91 트랙 E · #5)
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **이 축은 사각 `문서가-옮겨-적은-계약-상수`가 재개 조건으로 예고한 바로 그 축이다.**
 * 그 사각은 라운드 90 트랙 D가 세우며 *"문서가 인용한 계약 상수의 정합이 한 트랙의 축이 되는
 * 라운드가 서는 날 — 그날 F가 이미 고친 그 두 자리가 그 계약의 첫 모집단이다"* 라고 적었다.
 * **오늘 그 라운드가 섰고(라운드 91 · 후보 #5), 첫 모집단은 셋이다**(F가 고친 두 자리에
 * 머리말 `:22`가 더해진다 — 그 자리는 같은 걸음을 *기록*으로 적은 자리다).
 *
 * ⚠️ **바늘을 값으로 적는다.** 이 문서가 그 상수를 부르는 꼴은 하나다 —
 * `끝 라운드 차이가 <값>을 넘지 …`. 값 자리에는 아라비아 숫자(`**0**`·`**0을`), 한글 수사(`셋`),
 * 또는 **자리표**(`…` — 이름만 부르고 값을 옮기지 않는 자리)가 선다.
 *
 * ⚠️⚠️ **두 시점을 적은 자리는 *오늘* 쪽만 문다.** `:22`는 *"셋 → 0"* 의 역사를 지닌 자리다 —
 * 옛 문장을 `*"…"*` 인용으로 그대로 옮긴 뒤 그것을 **굵은 오늘 값**으로 정정한다. 그 인용까지
 * 물면 이 계약은 문서에게 *역사를 지우라*고 요구하게 되고, **기록을 죽이는 계약**이 된다.
 * 그래서 인용 안(`*"…"*`)의 값은 `pastValues`로 남기고 **무는 대상 밖**에 둔다.
 */
const CONSTANT_QUOTE_PATTERN =
  /끝 라운드 차이가\s*(\*{0,2})(\d+|[가-힣]+?|…)(\*{0,2})\s*[을를]\s*넘지/g;

/** 옛 문장을 그대로 옮긴 자리 — `*"… 셋을 넘지 않는가"*` 꼴의 인용 구간. */
const PROSE_QUOTE_SPAN_PATTERN = /\*"[^"]*"\*/g;

/** 인용을 정정한 **오늘 값** — `… M-2가 **0**으로 내린 뒤였다` 의 그 굵은 값. */
const CORRECTION_VALUE_PATTERN = /\*\*(\d+|[가-힣]+)\*\*/g;

/** 수사의 **수량형**(`셋`·`넷`) — 위 `koreanNumeral`은 관형사형(`세`·`네`)을 읽는다. */
const CARDINALS: Record<string, number> = {
  하나: 1,
  둘: 2,
  셋: 3,
  넷: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10
};

/** 모르는 꼴은 `NaN`으로 돌려 그 자리가 조용히 통과하지 못하게 한다. */
function constantValue(token: string): number {
  if (/^\d+$/.test(token)) return Number(token);
  if (token in CARDINALS) return CARDINALS[token];
  return koreanNumeral(token);
}

type ConstantSite = {
  readonly line: number;
  /** `단언` = 오늘의 값을 그 자리에서 말한다 · `인용+정정` = 옛 문장을 옮긴 뒤 오늘 값으로 고친다. */
  readonly shape: "단언" | "인용+정정" | "인용만";
  /** ⚠️ 이 계약이 **무는** 값. */
  readonly todayValues: readonly number[];
  /** ⚠️ 기록으로 남은 옛 값 — **무는 대상 밖**이다. */
  readonly pastValues: readonly number[];
};

function collectConstantSites(text: string): ConstantSite[] {
  const sites: ConstantSite[] = [];
  text.split("\n").forEach((line, index) => {
    const quotes = [...line.matchAll(CONSTANT_QUOTE_PATTERN)];
    if (quotes.length === 0) return;
    const spans = [...line.matchAll(PROSE_QUOTE_SPAN_PATTERN)].map((match) => ({
      from: match.index,
      to: match.index + match[0].length
    }));
    const read = quotes.map((match) => {
      const at = match.index;
      const span = spans.find((candidate) => at >= candidate.from && at < candidate.to);
      return {
        at,
        span,
        value: match[2] === "…" ? Number.NaN : constantValue(match[2])
      };
    });
    const asserted = read.filter((quote) => !quote.span && Number.isFinite(quote.value));
    const pastValues = read
      .filter((quote) => quote.span && Number.isFinite(quote.value))
      .map((quote) => quote.value);

    if (asserted.length > 0) {
      sites.push({
        line: index + 1,
        shape: "단언",
        todayValues: asserted.map((quote) => quote.value),
        pastValues
      });
      return;
    }

    // 인용만 남은 자리 — 그 인용을 **정정한 굵은 값**이 오늘 쪽이다(`:22`가 이 꼴이다).
    const quotedEnds = read.flatMap((quote) => (quote.span ? [quote.span.to] : []));
    const tail = quotedEnds.length > 0 ? line.slice(Math.max(...quotedEnds)) : "";
    const correction = [...tail.matchAll(CORRECTION_VALUE_PATTERN)][0];
    const corrected = correction ? constantValue(correction[1]) : Number.NaN;
    sites.push({
      line: index + 1,
      shape: Number.isFinite(corrected) ? "인용+정정" : "인용만",
      todayValues: Number.isFinite(corrected) ? [corrected] : [],
      pastValues
    });
  });
  return sites;
}

/**
 * 사각 `문서가-옮겨-적은-계약-상수`가 쓰는 **다른 자** — *구절이 선 줄*을 센다(오늘 3 · 하한 2).
 * ⚠️ 위 `collectConstantSites`와 **서로 다른 바늘**이고(이쪽은 인용의 꼴까지 본다), ⓖ가
 * 두 자를 맞대어 본다 — **갈리면 빨개진다**(한쪽이 새 자리를 보고 다른 쪽이 못 보는 날).
 */
function quotedConstantLineCount(text: string): number {
  return text.split("\n").filter((line) => line.includes("끝 라운드 차이")).length;
}

/** 오늘: 자리 셋 — `:22`(인용+정정) · `:1153`(단언) · `:1188`(단언). 세 자리 다 값이 **0**이다. */
const constantSites = collectConstantSites(source);

// ---------------------------------------------------------------------------
// ⓗ의 모집단 — **소스가 문서의 좌표를 등호로 무는 자리** (라운드 92 트랙 E · #5)
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **이 축이 무는 것은 좌표의 값이 아니라 *이동 의무*다.**
 *
 * 라운드 90 트랙 D는 같은 문서의 좌표 축을 세우며 **하한**을 골랐고(오늘 `>= 91` 꼴 넷), 그래서
 * F의 걸음에 흔들리지 않는다. 라운드 91 트랙 E의 ⓖ는 **등호**를 골랐고(`[22, 1223, 1267]`), 그래서
 * **절이 서는 라운드마다 F가 그 줄을 함께 옮겨야 한다**. 둘 다 옳은 선택이고 값은 AF-5에 있다 —
 * 이 축이 묻는 것은 *어느 쪽이 옳은가*가 아니라, **등호를 고른 자리마다 그 의무가 적혀 있는가**다.
 *
 * ⚠️ **모집단은 손 목록이 아니라 두 파일의 소스에서 전수로 파생한다**(후보 #1이 값으로 본 병 —
 * *관례를 세는 계약의 모집단이 손 목록이면 그 관례에서 빠진 자리는 구조적으로 보이지 않는다*).
 * 파일의 범위만 값이고(오늘 이 계약과 그 짝 둘), 자리는 바늘이 찾는다.
 *
 * ⚠️ **자기 배제(ⓔ)** — **주석 안**에서 같은 꼴을 인용한 자리는 모집단 밖이다. 이 파일의 머리말은
 * `startsWith("### 0-1.")` 같은 꼴을 *설명하려고* 여러 번 적는데, 그 인용은 문서의 좌표를 무는
 * 자리가 아니라 **이 계약을 설명하는 문장**이다. ⚠️ 그 배제를 부르는 이름은 이 파일에 이미 있는
 * `SELF_PATH`를 그대로 쓴다 — 오늘 저장소에 이 관례가 **열두 자리 · 이름 넷**으로 갈려 있고
 * 정합을 세는 자리가 **0건**이라(P3 · 결정형 13), 여기서 다섯째 이름을 만들면 그 갈림만 넓힌다.
 */
const MOVE_DUTY_FILES = [SELF_PATH, PAIR_CONTRACT_PATH] as const;

/**
 * ⓐ **절 제목 문자열을 등호로 찾는 자리** — `headingLine("## A절.")`·`startsWith("### 0-1.")` 꼴.
 * ⚠️ 이 정규식 자신은 이 바늘에 걸리지 않는다(이름 뒤에 `\(`가 오지 `(`가 오지 않는다).
 */
const SECTION_NAME_BITE_PATTERN = /(?:headingLine|startsWith)\(\s*"(#{2,3} [^"]*)"/g;

/** ⓑ **문서 줄 번호를 리터럴 배열로 등호에 넣은 자리** — 단언의 대상이 줄 번호인 것만 문다. */
const LINE_ARRAY_BITE_PATTERN = /\.toEqual\(\[\s*\d+(?:\s*,\s*\d+)*\s*\]\)/g;

/** ⓖ 사각 `반대-방향`의 자 — **문서가** 소스의 좌표를 `<파일>:<줄>`로 부르는 자리. */
const SOURCE_COORDINATE_IN_DOC_PATTERN =
  /[A-Za-z0-9_./-]+\.(?:ts|tsx|js|mjs|cjs|json|sh|yml|yaml)`?:\d+/g;

/** 이동 의무가 갖춰야 할 것 — ⚠️ **빈 문장 금지: 길이로 막고, 손과 시점을 함께 묻는다.** */
const DUTY_MIN_LENGTH = 40;
const DUTY_HAND_PATTERN = /트랙[ (*]{0,3}[A-F]|[A-F]가|사람/;
const DUTY_WHEN_PATTERN = /라운드|날|시점|때/;
const DUTY_MOVE_PATTERN = /옮/;

type MoveDutySite = {
  readonly file: string;
  readonly line: number;
  readonly kind: "줄 번호 배열" | "절 이름";
  /** 무는 문자열 — 절 제목이거나 줄 번호 배열 리터럴. */
  readonly bite: string;
  /** 자리 **바로 위**의 잇닿은 주석 덩어리. */
  readonly duty: string;
};

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/** 자리 바로 위의 잇닿은 주석 덩어리 — 빈 줄이나 코드가 끼면 거기서 끊긴다(*바로 위*의 뜻). */
function dutyAbove(fileLines: readonly string[], index: number): string {
  const block: string[] = [];
  for (let cursor = index - 1; cursor >= 0 && isCommentLine(fileLines[cursor]); cursor -= 1) {
    block.unshift(fileLines[cursor].trim());
  }
  return block.join("\n");
}

function collectMoveDutySites(file: string, text: string): MoveDutySite[] {
  const fileLines = text.split("\n");
  const sites: MoveDutySite[] = [];
  fileLines.forEach((line, index) => {
    if (isCommentLine(line)) return; // ⓔ 자기 배제 — 설명하는 문장 안의 인용
    for (const match of line.matchAll(SECTION_NAME_BITE_PATTERN)) {
      sites.push({
        file,
        line: index + 1,
        kind: "절 이름",
        bite: match[1],
        duty: dutyAbove(fileLines, index)
      });
    }
  });
  for (const match of text.matchAll(LINE_ARRAY_BITE_PATTERN)) {
    const before = text.slice(0, match.index);
    const opened = before.lastIndexOf("expect(");
    // 단언의 대상이 **줄 번호**인 배열만 좌표다 — 합성 소스의 번호 배열(`[37, 999]`)은 밖이다.
    if (!/\.line\b/.test(before.substring(Math.max(opened, 0)))) continue;
    const index = before.split("\n").length - 1;
    if (isCommentLine(fileLines[index])) continue; // ⓔ 자기 배제
    sites.push({
      file,
      line: index + 1,
      kind: "줄 번호 배열",
      bite: match[0],
      duty: dutyAbove(fileLines, index)
    });
  }
  return sites.sort((left, right) => left.line - right.line);
}

/** ⓔ의 값 — **주석 안**에서 같은 꼴을 부른 줄 수(모집단 밖이라는 사실의 근거). */
function commentBiteMentions(text: string): number {
  return text
    .split("\n")
    .filter((line) => isCommentLine(line) && [...line.matchAll(SECTION_NAME_BITE_PATTERN)].length > 0)
    .length;
}

/** 이동 의무가 갖추지 못한 것들 — 빈 배열이면 그 자리는 의무를 적었다. */
function dutyGaps(site: MoveDutySite): string[] {
  const duty = site.duty.trim();
  const gaps: string[] = [];
  if (duty.length < DUTY_MIN_LENGTH) gaps.push(`문장이 ${duty.length}자예요(하한 ${DUTY_MIN_LENGTH})`);
  if (!DUTY_MOVE_PATTERN.test(duty)) gaps.push("*옮긴다*는 말이 없어요");
  if (!DUTY_HAND_PATTERN.test(duty)) gaps.push("*누가* 옮기는지가 없어요");
  if (!DUTY_WHEN_PATTERN.test(duty)) gaps.push("*언제* 옮기는지가 없어요");
  return gaps;
}

/** ⓓ fail-closed — 절 이름 등호가 **못 찾으면 빨개지는 자**인 근거. */
function failClosedBy(site: MoveDutySite, text: string): "headingLine" | "이름 붙은 인덱스" | "없음" {
  const line = text.split("\n")[site.line - 1] ?? "";
  if (line.includes("headingLine(")) return "headingLine";
  const named = /const\s+([A-Za-z0-9_$]+)\s*=/.exec(line);
  if (
    named &&
    new RegExp(`expect\\(\\s*${named[1]}[\\s\\S]{0,300}?toBeGreaterThan\\(-1\\)`).test(text)
  ) {
    return "이름 붙은 인덱스";
  }
  return "없음";
}

const moveDutySources = MOVE_DUTY_FILES.map((file) => ({ file, text: read(file) }));
const moveDutySites = moveDutySources.flatMap((entry) => collectMoveDutySites(entry.file, entry.text));
/** ⓒ **두 수를 가른다** — 오늘 절 이름 여덟(정찰 하한 여섯) · 줄 번호 배열 하나. */
const sectionNameSites = moveDutySites.filter((site) => site.kind === "절 이름");
const lineArraySites = moveDutySites.filter((site) => site.kind === "줄 번호 배열");

/**
 * ⚠️ 시험용 호출은 **이름을 한 번 거쳐** 부른다 — 그러지 않으면 fail-closed를 값으로 보이는 그
 * 한 줄이 스스로 모집단에 들어와, 자리 수를 부풀리고 의무 문장을 요구하게 된다.
 */
const callHeadingLine: (prefix: string) => number = headingLine;

// ---------------------------------------------------------------------------

describe("바늘과 모집단 (빈 스윕 금지 · 옛 라운드 문단 제외)", () => {
  it("문서를 실제로 읽었고 절 셋이 제자리에 있다", () => {
    expect(lines.length).toBeGreaterThan(1000);
    expect(SECTION_A_LINE).toBeLessThan(SECTION_C_LINE);
    expect(SECTION_C_LINE).toBeLessThan(SECTION_MANUAL_LINE);
    expect(cRows.length).toBeGreaterThan(10);
    expect(c3Row, "C절 표에서 C-3 행을 찾지 못했어요").toBeTruthy();
  });

  it("경과 수를 말하는 자리가 접근성 표 본문에 둘이고, C절과 수동 증거 절에 하나씩이다", () => {
    expect(cSectionSites.length, "C절에서 C-3의 경과 수 자리를 하나 찾지 못했어요").toBe(1);
    expect(manualSites.length, "수동 증거 절에서 C-3의 경과 수 자리를 하나 찾지 못했어요").toBe(1);
    expect(
      strayBodySites.map((site) => `${CHECKLIST_PATH}:${site.line}`),
      "C절·수동 증거 절 밖에 경과 수를 말하는 자리가 새로 생겼어요 — 자리가 늘면 ⓑ·ⓒ가 무엇과 무엇을 견주는지 다시 정해야 합니다"
    ).toEqual([]);
  });

  it("셋째 자리 — 짝 문서 §0-1이 같은 경과 수를 하나 말한다 (라운드 89 리뷰 M-3)", () => {
    expect(PAIR_S01_FROM, `${PAIR_DOC_PATH}에서 §0-1 제목을 찾지 못했어요`).toBeGreaterThan(-1);
    expect(PAIR_S01_TO, `${PAIR_DOC_PATH}에서 §0-1의 끝(다음 ## 제목)을 찾지 못했어요`).toBeGreaterThan(
      PAIR_S01_FROM
    );
    expect(
      pairSection01Sites.length,
      `${PAIR_DOC_PATH} §0-1에서 C-3의 경과 수 자리를 하나 찾지 못했어요 — 자리가 사라졌다면 이 계약의 셋째 축을 지우고, 늘었다면 ⓑ·ⓒ의 견줌을 다시 정하세요`
    ).toBe(1);
  });

  it("짝 문서의 옛 라운드 문단은 같은 모양인데도 모집단 밖이다 (§0-1 밖)", () => {
    // 오늘 둘(:266 일곱 · :1212 여덟). 날짜가 박힌 그 라운드의 기록이라 갱신 대상이 아니다.
    expect(pairLegacySites.length, "짝 문서의 옛 라운드 문단 둘이 사라졌어요").toBeGreaterThanOrEqual(2);
    for (const site of pairLegacySites) {
      // 옛 문단도 그 자신은 정합이다 — 낡은 것이 아니라 그때의 기록이라는 근거.
      expect(site.rounds.length, `짝 문서 :${site.line}의 ${site.numeral} 문단`).toBe(site.declared);
    }
  });

  it("머리말의 옛 라운드 문단은 같은 모양인데도 모집단 밖이다", () => {
    // 오늘 셋(:199 네 · :229 다섯 · :262 여섯). 그 라운드의 기록이라 갱신 대상이 아니다.
    expect(headlineSites.length, "머리말의 옛 라운드 문단 셋이 사라졌어요").toBeGreaterThanOrEqual(3);
    expect(headlineSites.map((site) => site.declared)).toEqual(
      expect.arrayContaining([4, 5, 6])
    );
    for (const site of headlineSites) {
      expect(site.line, `${CHECKLIST_PATH}:${site.line}이 A절 뒤에 있어요`).toBeLessThan(
        SECTION_A_LINE
      );
      // 옛 문단도 그 자신은 정합이다 — 낡은 것이 아니라 그때의 기록이라는 근거.
      expect(site.rounds.length, `머리말 ${site.numeral} 문단`).toBe(site.declared);
    }
  });
});

/**
 * ⚠️ **경과 수 축을 진 자리 전수 — 오늘 셋이다**(라운드 89 리뷰 M-3이 셋째를 찾기 전에는 둘이었다).
 * ⓐ·ⓓ가 이 표를 그대로 돈다 — 자리가 넷째로 늘면 이 한 줄만 늘리면 된다.
 */
const SITE_AXES = [
  ["C절 C-3 행", CHECKLIST_PATH, () => cSectionSites],
  ["수동 증거 절 C-3 줄", CHECKLIST_PATH, () => manualSites],
  ["짝 문서 §0-1의 C-3 줄", PAIR_DOC_PATH, () => pairSection01Sites]
] as const;

describe("ⓐ 자기 정합 — 한글 수사가 라운드 목록의 길이와 같다", () => {
  for (const [label, path, sites] of SITE_AXES) {
    it(`${label}의 수사가 목록 길이와 같다`, () => {
      const site = sites()[0];
      expect(site, `${label}을 찾지 못했어요`).toBeTruthy();
      expect(
        Number.isNaN(site.declared),
        `${label}의 "${site.numeral}"을(를) 수로 읽지 못했어요 — 수사를 바꿨다면 이 계약의 표도 함께 늘리세요`
      ).toBe(false);
      expect(
        site.declared,
        `${path}:${site.line} — "${site.numeral}"은 ${site.declared}인데 목록은 ${site.rounds.length}개예요`
      ).toBe(site.rounds.length);
    });
  }

  it("두 목록이 줄지 않는다 (하한: 스물두 · 열아홉 — 오늘 실측은 스물셋 · 스물셋)", () => {
    // ⚠️ **하한 래칫**이지 오늘 값의 사본이 아니다 — 두 자리가 함께 자라는 갱신은 이 줄을 통과해야
    // 하고(그것이 이 계약이 바라는 갱신이다), 목록이 **줄어드는** 것만 여기서 잡힌다.
    // 경과 라운드는 확인이 오기 전에는 되돌아가지 않는다.
    // ⚠️ 두 시점: 하한 22·19는 **당시**의 실측이었고, 오늘 HEAD의 실측은 23·23이다. 하한은
    // 일부러 그대로 둔다 — 여기서 축을 지는 것은 ⓒ의 **상한**이고(그쪽은 실측으로 함께 내렸다),
    // 이 줄은 되돌아감만 막는 바닥이라 낡아도 초록을 헐겁게 만들지 않는다.
    expect(cSectionSites[0].rounds.length, "C절 C-3의 라운드 목록이 짧아졌어요").toBeGreaterThanOrEqual(22);
    expect(manualSites[0].rounds.length, "수동 증거 절의 라운드 목록이 짧아졌어요").toBeGreaterThanOrEqual(19);
  });
});

describe("ⓑ 접두 — 뒤처지는 것은 되고, 갈라지는 것은 안 된다", () => {
  it("수동 증거 절의 목록이 C절 목록의 접두다", () => {
    const cRounds = cSectionSites[0].rounds;
    const manualRounds = manualSites[0].rounds;
    expect(
      manualRounds.length,
      "수동 증거 절의 목록이 C절 목록보다 길어요 — 두 자리의 앞뒤가 뒤집혔습니다"
    ).toBeLessThanOrEqual(cRounds.length);
    expect(
      cRounds.slice(0, manualRounds.length),
      "두 목록이 같은 라운드를 말하지 않아요 — 한쪽이 뒤처지는 것과 두 목록이 갈라지는 것은 다른 일입니다"
    ).toEqual(manualRounds);
  });

  it("두 목록이 같은 라운드에서 시작한다", () => {
    expect(manualSites[0].rounds[0]).toBe(cSectionSites[0].rounds[0]);
  });

  it("짝 문서 §0-1의 목록도 C절 목록의 접두이고 같은 라운드에서 시작한다 (셋째 자리)", () => {
    const cRounds = cSectionSites[0].rounds;
    const pairRounds = pairSection01Sites[0].rounds;
    expect(
      pairRounds.length,
      `${PAIR_DOC_PATH} §0-1의 목록이 접근성 표 C절 목록보다 길어요 — 판정을 지는 쪽은 접근성 표이고, 짝 문서가 그보다 앞서 갈 수는 없습니다`
    ).toBeLessThanOrEqual(cRounds.length);
    expect(
      cRounds.slice(0, pairRounds.length),
      `${PAIR_DOC_PATH} §0-1과 접근성 표 C절이 같은 라운드를 말하지 않아요 — 뒤처지는 것과 갈라지는 것은 다른 일입니다`
    ).toEqual(pairRounds);
    expect(pairRounds[0]).toBe(cRounds[0]);
  });
});

describe("ⓒ 갈림의 상한 래칫 (이 계약의 축)", () => {
  const lastOf = (rounds: number[]) => rounds[rounds.length - 1];

  it("C절이 수동 증거 절보다 뒤로 가지 않는다", () => {
    expect(lastOf(cSectionSites[0].rounds)).toBeGreaterThanOrEqual(
      lastOf(manualSites[0].rounds)
    );
  });

  it("두 목록의 끝 라운드 차이가 오늘의 값을 넘지 않는다", () => {
    const divergence = lastOf(cSectionSites[0].rounds) - lastOf(manualSites[0].rounds);
    expect(
      divergence,
      `C절은 라운드 ${lastOf(cSectionSites[0].rounds)}까지, 수동 증거 절은 ${lastOf(manualSites[0].rounds)}까지 적혀 있어요 — 한 자리만 올리지 말고 세 자리를 함께 올리세요(${CHECKLIST_PATH}:${cSectionSites[0].line} · :${manualSites[0].line} · ${PAIR_DOC_PATH}:${pairSection01Sites[0].line})`
    ).toBeLessThanOrEqual(MAX_DIVERGENCE);
  });

  it("짝 문서 §0-1의 끝 라운드도 같은 상한 안에 있다 (셋째 자리 · 라운드 89 리뷰 M-3)", () => {
    // 셋째 자리도 C절보다 앞서 갈 수 없고, 뒤처지는 폭은 같은 상한을 진다.
    expect(
      lastOf(cSectionSites[0].rounds),
      `${PAIR_DOC_PATH} §0-1이 접근성 표 C절보다 앞서 있어요`
    ).toBeGreaterThanOrEqual(lastOf(pairSection01Sites[0].rounds));
    const divergence = lastOf(cSectionSites[0].rounds) - lastOf(pairSection01Sites[0].rounds);
    expect(
      divergence,
      `C절은 라운드 ${lastOf(cSectionSites[0].rounds)}까지, 짝 문서 §0-1은 ${lastOf(pairSection01Sites[0].rounds)}까지 적혀 있어요 — 한 자리만 올리지 말고 세 자리를 함께 올리세요(${CHECKLIST_PATH}:${cSectionSites[0].line} · :${manualSites[0].line} · ${PAIR_DOC_PATH}:${pairSection01Sites[0].line})`
    ).toBeLessThanOrEqual(MAX_DIVERGENCE);
  });

  it("상한이 장식이 아니다 (목록 길이보다 한참 아래에 서 있다)", () => {
    // ⚠️ 두 시점.
    //  · **당시**: 갈림 셋 · 상한 셋 — 여유 0이라 다음 한 걸음이 잡힌다고 적혀 있었다.
    //  · **오늘**: 갈림 0 · 상한 0 — 같은 라운드의 트랙 F가 두 자리를 함께 89로 올린 뒤
    //    리뷰(M-2)가 상한을 그 실측으로 함께 내렸다. 여유는 여전히 0이고, 그래서 **C절만
    //    올리는 다음 한 걸음이 그 자리에서 잡힌다**(당시 값 3으로 두면 세 걸음이 통과했다).
    // ⚠️ 다만 여유 0을 단언하지는 않는다: **두 자리를 함께 올리는 갱신**은 갈림을 늘리지 않고
    //  (0을 그대로 둔 채) 통과해야 하며, 그 갱신이야말로 이 계약이 바라는 것이다.
    expect(MAX_DIVERGENCE).toBeLessThan(cSectionSites[0].rounds.length);
    expect(
      lastOf(cSectionSites[0].rounds) - lastOf(manualSites[0].rounds)
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("ⓓ 목록의 모양 — 67부터 빠짐없이 연속", () => {
  for (const [label, , sites] of SITE_AXES) {
    it(`${label}의 목록이 67부터 연속이고 빠진 라운드가 0건이다`, () => {
      const rounds = sites()[0].rounds;
      expect(rounds[0], `${label}의 목록이 67에서 시작하지 않아요`).toBe(67);
      const gaps = rounds
        .map((round, index) => ({ round, expected: rounds[0] + index }))
        .filter((entry) => entry.round !== entry.expected)
        .map((entry) => `${entry.expected} 자리에 ${entry.round}이(가) 있다`);
      expect(gaps, `${label}의 목록에 빠지거나 뒤바뀐 라운드가 있어요`).toEqual([]);
      expect(new Set(rounds).size, `${label}의 목록에 중복이 있어요`).toBe(rounds.length);
    });
  }
});

describe("ⓔ 좌표 — 두 문서가 같은 값을 말한다", () => {
  /**
   * C-3이 스스로 적은 좌표(짝 문서의 행 번호 · 표면)를 그 자리에서 뽑는다.
   *
   * ⚠️ 행 번호는 **짝 문서를 이름으로 부른 자리**에서만 읽는다 — C-3 칸에는 라운드마다 자란 산문이
   * 있고 거기에는 짝 문서의 **다른** 행 번호(오늘 `#160`·`#161`)도 인용돼 있다.
   * 그리고 한 자리 안에서 같은 좌표가 여러 번 되풀이되면(오늘 C-3 칸에서 행 번호 열둘 · 표면 열다섯)
   * **전부 같은 값이어야 한다** — 한 칸 안에서 갈리는 것도 두 문서가 갈리는 것과 같은 병이다.
   */
  function declaredCoordinate(text: string, where: string): { row: number; surface: string } {
    const rows = [
      ...text.matchAll(/(?:짝 문서|runtime-verification-required\.md`?)의?\s*\*{0,2}`#(\d+)`/g)
    ].map((match) => Number(match[1]));
    const surfaces = [
      ...text.matchAll(/표면[은이]?\s*\*{0,2}`(실기기|브라우저|서버|작업)`/g)
    ].map((match) => match[1]);
    expect(rows.length, `${where}이 짝 문서의 행 번호를 적지 않았어요`).toBeGreaterThan(0);
    expect(surfaces.length, `${where}이 실행 표면을 적지 않았어요`).toBeGreaterThan(0);
    expect([...new Set(rows)], `${where} 안에서 짝 문서 행 번호가 갈려요`).toHaveLength(1);
    expect([...new Set(surfaces)], `${where} 안에서 실행 표면이 갈려요`).toHaveLength(1);
    return { row: rows[0], surface: surfaces[0] };
  }

  it("C절 C-3 행과 수동 증거 절이 같은 좌표를 말한다", () => {
    const fromRow = declaredCoordinate(c3Row!.cells.join(" | "), "C절의 C-3 행");
    const fromManual = declaredCoordinate(manualSection, "수동 증거 절의 C-3 줄");
    expect(fromRow).toEqual(fromManual);
  });

  it("그 좌표가 짝 문서에서 실제로 그 행이고 표면도 같다", () => {
    const coordinate = declaredCoordinate(c3Row!.cells.join(" | "), "C절의 C-3 행");
    const pairDoc = read(PAIR_DOC_PATH).split("\n");
    const rowLine = pairDoc.findIndex((line) =>
      new RegExp(`^\\|\\s*${coordinate.row}\\s*\\|`).test(line.trim())
    );
    expect(rowLine, `짝 문서에서 #${coordinate.row} 행을 찾지 못했어요`).toBeGreaterThan(-1);

    const cells = splitCells(pairDoc[rowLine]);
    expect(cells[0]).toBe(String(coordinate.row));
    expect(
      cells[1].replace(/`/g, "").trim(),
      `짝 문서 #${coordinate.row}의 표면이 접근성 표가 적은 \`${coordinate.surface}\`와 달라요`
    ).toBe(coordinate.surface);
    // 번호만 같고 다른 항목이면 좌표가 아니라 우연이다.
    expect(cells[2], `짝 문서 #${coordinate.row}의 확인 항목`).toContain("잠금 오버레이");
  });

  it("접근성 표는 짝 문서의 수치를 옮겨 적지 않고 계수 계약의 이름만 남긴다", () => {
    // 자동 계수는 짝 문서에만 걸린다 — 이 문서가 그 수를 베끼면 그 사본이 조용히 낡는다.
    expect(manualSection).toContain("runtime-checklist-shape.test.ts");
  });
});

describe("ⓔ 좌표(전수) — 같은 축, 넓힌 모집단 (라운드 90 트랙 D)", () => {
  it("모집단이 0건이 아니다 (오늘 자리 92 · 번호 96 · 서로 다른 번호 92 — 하한은 D 커밋 시점의 91·95·87)", () => {
    // ⚠️ 유령 방지의 첫 줄: 바늘이 아무것도 잡지 못한 채 초록인 스윕을 금지한다.
    expect(
      coordinateSites.length,
      "접근성 표가 §1-1을 가리키는 자리가 줄었어요 — 바늘이 낡았는지 먼저 보세요"
    ).toBeGreaterThanOrEqual(91);
    expect(citedNumbers.length, "인용된 좌표 전수가 줄었어요").toBeGreaterThanOrEqual(95);
    expect(
      new Set(citedNumbers).size,
      "서로 다른 좌표 번호가 정찰의 하한(87) 아래예요"
    ).toBeGreaterThanOrEqual(87);
    // 자리마다 번호가 하나 이상이다(빈 자리를 세지 않는다).
    expect(coordinateSites.filter((site) => site.numbers.length === 0)).toEqual([]);
  });

  it("가리키는 번호가 짝 문서 §1-1의 행으로 실제로 풀린다 (오늘 어긋남 0)", () => {
    const dangling = coordinateSites.flatMap((site) =>
      site.numbers
        .filter((number) => !pairRowByNumber.has(number))
        .map((number) => `${CHECKLIST_PATH}:${site.line} → #${number}`)
    );
    expect(
      dangling,
      `짝 문서 §1-1에 없는 번호를 가리키는 자리가 있어요 — 좌표가 유령이 됐거나(행이 사라졌다) 번호를 잘못 적었습니다(${PAIR_DOC_PATH} §1-1은 오늘 ${pairSection11Rows.length}행)`
    ).toEqual([]);
  });

  it("표면까지 적은 참조는 그 표면이 짝 문서의 행과 같다 (오늘 33 · 어긋남 0)", () => {
    expect(
      surfaceSites.length,
      "표면까지 함께 적은 참조가 줄었어요 — 하한은 정찰의 32입니다(오늘 실측은 33)"
    ).toBeGreaterThanOrEqual(32);
    const mismatched = surfaceSites
      .filter((site) => pairRowByNumber.get(site.number)?.surface !== site.surface)
      .map(
        (site) =>
          `${CHECKLIST_PATH}:${site.line} — #${site.number}을(를) \`${site.surface}\`로 적었는데 ${PAIR_DOC_PATH}는 \`${pairRowByNumber.get(site.number)?.surface ?? "(행 없음)"}\``
      );
    expect(
      mismatched,
      "접근성 표가 적은 실행 표면이 짝 문서의 행과 갈려요 — 표면은 짝 문서가 지는 값입니다"
    ).toEqual([]);
  });

  it("역방향 — 짝 문서가 접근성 표의 항목을 가리키는 자리도 실재로 풀린다 (오늘 8 · 하한 7)", () => {
    expect(
      reverseSites.length,
      "짝 문서가 접근성 표를 이름으로 가리키는 자리가 정찰의 하한(7) 아래예요"
    ).toBeGreaterThanOrEqual(7);
    const dangling = reverseSites
      .filter((site) => !accessibilityItemIds.has(site.id))
      .map((site) => `${PAIR_DOC_PATH}:${site.line} → ${site.id}`);
    expect(
      dangling,
      `접근성 표에 없는 항목을 가리키는 자리가 짝 문서에 있어요(접근성 표의 항목은 오늘 ${accessibilityItemIds.size}개 — A절 제목 + C절 행)`
    ).toEqual([]);
  });

  it("유령 방지 — 짝 문서의 번호 행이 165이고 빠진 번호가 0건이다 (하한은 D 커밋 시점의 163)", () => {
    expect(PAIR_S11_FROM, `${PAIR_DOC_PATH}에서 §1-1 제목을 찾지 못했어요`).toBeGreaterThan(-1);
    expect(
      PAIR_S11_TO,
      `${PAIR_DOC_PATH}에서 §1-1의 끝(다음 ## 제목)을 찾지 못했어요`
    ).toBeGreaterThan(PAIR_S11_FROM);
    expect(
      pairAllRows.length,
      "짝 문서의 번호 행이 줄었어요 — 하한은 정찰의 163입니다"
    ).toBeGreaterThanOrEqual(163);
    expect(pairSection11Rows.length, "§1-1의 번호 행이 줄었어요").toBeGreaterThanOrEqual(151);
    const numbers = pairAllRows.map((row) => row.number);
    const gaps = numbers
      .map((number, index) => ({ number, expected: numbers[0] + index }))
      .filter((entry) => entry.number !== entry.expected)
      .map((entry) => `${entry.expected} 자리에 ${entry.number}이(가) 있다`);
    expect(gaps, "짝 문서의 번호가 빠지거나 뒤바뀌었어요").toEqual([]);
    expect(new Set(numbers).size, "짝 문서의 번호에 중복이 있어요").toBe(numbers.length);
    expect(numbers[0], "짝 문서의 번호가 1에서 시작하지 않아요").toBe(1);
  });

  it("바늘이 장식이 아니다 — 유령 좌표와 어긋난 표면은 합성 소스에서 잡힌다", () => {
    // ⚠️ **합성 소스로 증명한다**(라운드 88 D의 형식): 오늘 저장소에 그 모양이 0건이어도 계약이
    // 그것을 무는지는 여기서 값으로 보인다 — 문서를 한 글자도 고치지 않고 바늘을 시험한다.
    const known = pairSection11Rows[0];
    const ghost = collectCoordinateSites(
      `실기기 확인은 \`runtime-verification-required.md\` §1-1 #999`
    );
    expect(ghost).toHaveLength(1);
    expect(ghost[0].numbers.every((number) => pairRowByNumber.has(number))).toBe(false);

    // 사슬의 둘째 번호가 유령이어도 잡힌다(첫 번호만 세면 지나간다).
    const chain = collectCoordinateSites("§1-1 #37·#999");
    expect(chain[0].numbers).toEqual([37, 999]);
    expect(chain[0].numbers.filter((number) => !pairRowByNumber.has(number))).toEqual([999]);

    // 표면을 실재하는 행에 **다르게** 적으면 어긋남으로 걸린다.
    const wrongSurface = known.surface === "실기기" ? "브라우저" : "실기기";
    const surfaces = collectSurfaceSites(`§1-1 **#${known.number}**(표면 \`${wrongSurface}\`)`);
    expect(surfaces).toHaveLength(1);
    expect(pairRowByNumber.get(surfaces[0].number)?.surface).not.toBe(surfaces[0].surface);

    // 그리고 짝 문서가 없는 항목을 부르면 역방향에서 걸린다.
    expect(accessibilityItemIds.has("C-3")).toBe(true);
    expect(accessibilityItemIds.has("C-99")).toBe(false);
  });
});

describe("ⓖ 문서가 옮겨 적은 이 계약의 상수 — 오늘 값의 정합 (라운드 91 트랙 E)", () => {
  /**
   * ⚠️ **무는 자리 수는 줄지 않는다(ⓔ 래칫).** 오늘 셋 — `:22` · `:1153` · `:1188`.
   * 자리가 사라지는 날(문서가 그 설명을 지우는 날) 이 하한이 먼저 빨개져 사람이 그 삭제를 본다.
   */
  const BITING_SITES_FLOOR = 3;

  it("ⓐ 모집단이 0건이 아니고, 오늘 자리는 셋이다 (유령 방지)", () => {
    expect(
      constantSites.length,
      `${CHECKLIST_PATH}에서 *"끝 라운드 차이가 …을 넘지"* 꼴을 한 자리도 찾지 못했어요 — 바늘이 낡았거나 문서가 그 설명을 지웠어요`
    ).toBeGreaterThan(0);
    expect(
      constantSites.map((site) => site.line),
      "인용 자리의 줄 번호가 오늘의 실측과 달라요 — 값을 갱신하고 아래 사각의 자도 함께 보세요"
    )
      // ⚠️⚠️ **두 시점 — 이 좌표는 라운드마다 갱신되는 값이다**(라운드 93 트랙 F).
      //  · **라운드 91 트랙 F 시점**: `22 · 1223 · 1267`(그 앞 라운드 91 트랙 E 커밋 시점은
      //    `22 · 1153 · 1188`이었다).
      //  · **라운드 92 트랙 F 시점**: `22 · 1281 · 1333` — F가 A-33 절(#108)과 C-3의 세 자리
      //    갱신을 이 문서에 적으면서 아래 두 자리가 밀렸다.
      //  · **라운드 93 트랙 F 시점**: `22 · 1343 · 1404` — F가 **A-34 절**(#109·#110 · 행 둘과
      //    문단 넷)과 C-3의 세 자리 갱신, 그리고 머리말의 라운드 93 문단을 적으면서 아래 두 자리가
      //    다시 밀렸다(`:22`는 A절보다 위라 이번에도 움직이지 않는다).
      //  · **라운드 94 트랙 F 시점**: `22 · 1378 · 1446` — F가 **A-35 절**(#111 · 행 하나와
      //    문단 넷)과 C-3의 세 자리 갱신을 적으면서 아래 두 자리가 **35줄·42줄** 밀렸다
      //    (`:22`는 A절보다 위라 네 라운드째 움직이지 않는다). ⚠️ **네 라운드 이어 값(0)도
      //    꼴(인용+정정 · 단언 · 단언)도 한 바이트도 바뀌지 않았고, 움직인 것은 좌표뿐이다** —
      //    **이 의무의 세 번째 이행**이다(판정 `docs/operations/known-limitations.md` **AI-5**).
      //    ⚠️ **값(0)도 꼴(인용+정정 · 단언 · 단언)도 한 바이트도 바뀌지 않았고, 움직인 것은
      //    좌표뿐이다** — 세 라운드 이어 같은 문장이 같은 값을 말한다.
      //  · **오늘(라운드 95 트랙 F 뒤)**: `22 · 1430 · 1506` — F가 **A-36 절**(#112 · 행 하나와
      //    문단 여섯)과 C-3의 세 자리 갱신, 그리고 머리말의 라운드 95 문단을 적으면서 아래 두
      //    자리가 **52줄·60줄** 밀렸다(`:22`는 A절보다 위라 **다섯 라운드째** 움직이지 않는다).
      //    ⚠️ **다섯 라운드 이어 값(0)도 꼴도 한 바이트 바뀌지 않았고, 움직인 것은 좌표뿐이다** —
      //    **이 의무의 네 번째 이행**이고, 옮긴 손은 그 절을 세운 그 라운드의 F다
      //    (판정 `docs/operations/known-limitations.md` **AJ-5**).
      // ⚠️ **그래서 이 한 줄은 이 계약의 트립와이어다** — 라운드 90 트랙 D가 같은 문서의 좌표
      // 축을 세울 때 *하한*을 골라 F의 걸음에 흔들리지 않게 했는데(오늘 `>= 91` 꼴 넷),
      // 이 축은 *등호*를 골랐으므로 **절이 서는 라운드마다 F가 이 줄을 함께 옮긴다.**
      // ⚠️⚠️ **그 의무는 이제 주석이 아니라 아래 ⓗ가 값으로 진다**(라운드 92 트랙 E) — 오늘의
      // 이 걸음이 그 의무의 **두 번째 이행**이고, 라운드 91 F의 첫 이행이 선례였다.
      // 판정과 그 갈림의 값은 `docs/operations/known-limitations.md` **AF-5 · AG-5**에 있다.
      .toEqual([22, 1430, 1506]);
    expect(constantSites.map((site) => site.shape)).toEqual(["인용+정정", "단언", "단언"]);
  });

  it("ⓑ 세 자리가 말하는 오늘의 수가 이 계약의 상수와 같다", () => {
    for (const site of constantSites) {
      for (const value of site.todayValues) {
        expect(
          value,
          `${CHECKLIST_PATH}:${site.line}이 갈림 상한을 ${value}(으)로 적는데 계약의 상수는 ${MAX_DIVERGENCE}예요 — 문서 쪽을 상수로 맞추세요(⚠️ 상수를 문서에 맞추지 마세요 · 이 상수는 내리는 쪽만 안전합니다)`
        ).toBe(MAX_DIVERGENCE);
      }
    }
    expect(
      constantSites.flatMap((site) => site.todayValues).length,
      `오늘 값을 말하는 자리가 ${BITING_SITES_FLOOR} 아래로 줄었어요 — 문서가 그 설명을 지웠다면 이 하한도 함께 내리세요`
    ).toBeGreaterThanOrEqual(BITING_SITES_FLOOR);
  });

  it("ⓑ' 두 시점을 적은 자리는 오늘 쪽만 문다 (역사를 지우지 않는다)", () => {
    // ⚠️⚠️ `:22`는 *"셋 → 0"* 의 역사를 지닌 자리다. 그 **셋**은 낡은 값이 아니라 **기록**이고,
    // 그것까지 물면 이 계약은 문서에게 역사를 지우라고 요구하게 된다.
    const past = constantSites.flatMap((site) => site.pastValues);
    expect(past, "인용으로 남은 옛 값이 0건이에요 — 문서가 역사를 지웠거나 인용의 꼴이 바뀌었어요").not
      .toEqual([]);
    expect(
      past.some((value) => value !== MAX_DIVERGENCE),
      "오늘 인용된 옛 값이 전부 오늘의 상수와 같아졌어요 — 그렇다면 이 자리가 더 이상 두 시점이 아니고, 이 줄을 지우거나 다시 적으세요"
    ).toBe(true);
    // 그런데도 이 계약은 초록이다 — 그것이 *오늘 쪽만 문다*의 뜻이다.
    expect(constantSites.flatMap((site) => site.todayValues)).toEqual([
      MAX_DIVERGENCE,
      MAX_DIVERGENCE,
      MAX_DIVERGENCE
    ]);
  });

  it("ⓒ 유령 방지 — 자리 수가 사각의 자와 같다 (두 자가 갈리면 빨개진다)", () => {
    expect(
      constantSites.length,
      `인용 자리(${constantSites.length})와 사각 \`문서가-옮겨-적은-계약-상수\`의 자(${quotedConstantLineCount(source)})가 갈렸어요 — 한쪽만 보는 새 자리가 생겼다는 뜻이니 두 바늘을 함께 보세요`
    ).toBe(quotedConstantLineCount(source));
  });

  it("ⓓ 자기 배제 — 이 계약 자신의 소스에 적힌 인용은 모집단 밖이다", () => {
    const selfSource = read(SELF_PATH);
    // 이 파일에도 같은 구절이 여럿 있다(머리말의 ⓒ 설명 · `it` 제목 · 아래 사각의 문장).
    expect(
      quotedConstantLineCount(selfSource),
      "이 계약의 소스에서 그 구절이 사라졌어요 — 자기 배제가 유령이 됐다는 뜻이니 이 줄을 다시 적으세요"
    ).toBeGreaterThan(0);
    expect(
      collectConstantSites(selfSource).length,
      "자기 배제가 유령이 아니라는 것을 값으로 보입니다"
    ).toBeGreaterThan(0);
    // 그런데도 모집단은 접근성 표 한 파일에서만 나온다.
    expect(constantSites).toEqual(collectConstantSites(source));
  });

  it("바늘이 장식이 아니다 — 낡은 자리는 합성 소스에서 잡힌다", () => {
    // ⚠️ **문서를 고치지 않고** 바늘을 시험한다: 라운드 90 F 이전의 문장을 합성해 넣는다.
    const stale = "  · ⓒ 두 목록의 끝 라운드 차이가 **셋**을 넘지 않는가";
    const staleSites = collectConstantSites(stale);
    expect(staleSites).toHaveLength(1);
    expect(staleSites[0].shape).toBe("단언");
    expect(staleSites[0].todayValues).toEqual([3]);
    expect(staleSites[0].todayValues[0]).not.toBe(MAX_DIVERGENCE);

    // 반대로 F가 세 자리를 올리며 이 문장을 그대로 두면 초록이다(접점 ⑥).
    const kept = "  · ⓒ 두 목록의 끝 라운드 차이가 **0을 넘지\n않는가**(⚠️ **종전 이 자리는 *셋*이었다**)";
    expect(collectConstantSites(kept)[0].todayValues).toEqual([MAX_DIVERGENCE]);

    // 이름만 부르고 값을 옮기지 않은 자리(`…`)는 무는 대상이 아니다.
    const named = '아래 이 칸이 적은 *"두 목록의 끝 라운드 차이가 …을 넘지 않는가"* 의 그 수는';
    expect(collectConstantSites(named)[0].todayValues).toEqual([]);
    expect(collectConstantSites(named)[0].shape).toBe("인용만");
  });
});

describe("ⓗ 이동 의무 — 누가 언제 이 좌표를 옮기는가 (라운드 92 트랙 E)", () => {
  /**
   * ⓕ **래칫 — 무는 자리 수는 줄지 않는다.** 하한은 **정찰의 실측**(줄 번호 배열 하나 · 절 이름
   * 여섯)이고, 오늘 이 트랙의 재실측은 **하나와 여덟**이다. ⚠️ **두 수를 한 낱말로 접지 않는다.**
   */
  const LINE_ARRAY_FLOOR = 1;
  const SECTION_NAME_FLOOR = 6;

  it("ⓐ 모집단 — 두 파일에서 전수로 파생되고 0건이 아니다 (유령 방지)", () => {
    expect(MOVE_DUTY_FILES.length, "모집단의 파일 범위가 둘이 아니에요").toBe(2);
    for (const entry of moveDutySources) {
      expect(entry.text.length, `${entry.file}을(를) 읽지 못했어요`).toBeGreaterThan(0);
      expect(
        collectMoveDutySites(entry.file, entry.text).length,
        `${entry.file}에서 좌표를 무는 자리를 한 자리도 찾지 못했어요 — 바늘이 낡았는지 먼저 보세요`
      ).toBeGreaterThan(0);
    }
    expect(moveDutySites.length, "모집단이 0건이에요").toBeGreaterThan(0);
  });

  it("ⓒ 두 수를 따로 든다 — 줄 번호 등호와 절 이름 등호 (한 낱말로 접지 않는다)", () => {
    // ⚠️ 오늘: 줄 번호 배열 **하나**(`[22, 1223, 1267]`) · 절 이름 **여덟**(두 파일 합).
    expect(
      lineArraySites.length,
      "문서 줄 번호를 배열 등호로 무는 자리가 줄었어요 — 그 자리가 사라졌다면 ⓖ가 함께 사라진 것입니다"
    ).toBeGreaterThanOrEqual(LINE_ARRAY_FLOOR);
    expect(
      sectionNameSites.length,
      `절 이름을 등호로 무는 자리가 정찰의 하한(${SECTION_NAME_FLOOR}) 아래예요`
    ).toBeGreaterThanOrEqual(SECTION_NAME_FLOOR);
    // 두 수가 서로 다른 자를 낸다(같은 수가 나오면 바늘 하나가 죽은 것이다).
    expect(lineArraySites.length + sectionNameSites.length).toBe(moveDutySites.length);
    expect(lineArraySites.length).not.toBe(sectionNameSites.length);
    // 두 파일이 각각 자리를 진다 — 한 파일만 세는 축이 아니다.
    for (const file of MOVE_DUTY_FILES) {
      expect(
        sectionNameSites.filter((site) => site.file === file).length,
        `${file}에 절 이름을 무는 자리가 0건이에요`
      ).toBeGreaterThan(0);
    }
  });

  it("ⓑ 자리마다 바로 위에 이동 의무가 적혀 있다 (빈 문장 금지 · 길이로 막는다)", () => {
    const missing = moveDutySites
      .filter((site) => dutyGaps(site).length > 0)
      .map((site) => `${site.file}:${site.line} — ${dutyGaps(site).join(" · ")}`);
    expect(
      missing,
      "좌표를 등호로 무는 자리 바로 위에 *누가 언제 이것을 옮기는가*가 없어요 — 자리를 새로 만든 사람이 그 문장을 함께 적으세요"
    ).toEqual([]);
    // 의무 문장이 실제로 길다(장식 한 낱말이 통과하지 않는다).
    for (const site of moveDutySites) {
      expect(site.duty.trim().length, `${site.file}:${site.line}의 의무 문장`).toBeGreaterThanOrEqual(
        DUTY_MIN_LENGTH
      );
    }
  });

  it("ⓓ fail-closed — 절 이름 등호는 못 찾으면 빨개지는 자다 (유령이 아니다)", () => {
    // ⓐ 값으로: `headingLine`은 못 찾으면 **던진다**(조용히 -1을 돌려주지 않는다).
    expect(() => callHeadingLine("## 이 문서에 없는 절 제목")).toThrow();
    // ⓑ 전수로: 자리마다 그 근거가 둘 중 하나다 — `headingLine`이거나, 자르기 전에 실재를 물은
    //    이름 붙은 인덱스(`expect(<이름>).toBeGreaterThan(-1)`)다.
    const unguarded = sectionNameSites
      .filter((site) => {
        const text = moveDutySources.find((entry) => entry.file === site.file)!.text;
        return failClosedBy(site, text) === "없음";
      })
      .map((site) => `${site.file}:${site.line} (${site.bite})`);
    expect(
      unguarded,
      "절 이름을 못 찾아도 조용한 자리가 있어요 — 그 자리는 유령이고, 문서가 절 이름을 바꾼 날 아무도 모릅니다"
    ).toEqual([]);
    // 근거 둘이 실제로 둘 다 서 있다(한 꼴만 남으면 이 자가 절반만 본다).
    const grounds = new Set(
      sectionNameSites.map(
        (site) => failClosedBy(site, moveDutySources.find((entry) => entry.file === site.file)!.text)
      )
    );
    expect([...grounds].sort()).toEqual(["headingLine", "이름 붙은 인덱스"]);
  });

  it("ⓔ 자기 배제 — 이 계약을 설명하는 문장 안의 인용은 모집단 밖이다", () => {
    // 이 파일의 머리말·주석은 같은 꼴을 여러 번 인용한다(오늘 그 줄이 여럿이다).
    expect(
      commentBiteMentions(read(SELF_PATH)),
      "주석 안의 인용이 0건이면 이 배제는 유령이에요 — 배제가 무엇을 빼는지 값으로 보이세요"
    ).toBeGreaterThan(0);
    // 그런데도 모집단에는 주석 줄이 한 자리도 없다.
    const inComments = moveDutySites.filter((site) => {
      const text = moveDutySources.find((entry) => entry.file === site.file)!.text;
      return isCommentLine(text.split("\n")[site.line - 1] ?? "");
    });
    expect(inComments, "주석 안의 인용이 모집단에 들어왔어요").toEqual([]);
    // 합성 소스로 그 배제를 값으로 보인다(문서도 소스도 고치지 않는다).
    const needle = "headingLine";
    const quoted = `// 이 계약은 ${needle}("## A절.")로 절 이름을 찾는다고 설명한다`;
    expect(collectMoveDutySites("합성", quoted)).toEqual([]);
    expect(commentBiteMentions(quoted)).toBe(1);
  });

  it("ⓕ 래칫 — 무는 자리는 줄지 않고, 의무가 빈 자리는 0을 넘지 않는다", () => {
    expect(moveDutySites.length).toBeGreaterThanOrEqual(LINE_ARRAY_FLOOR + SECTION_NAME_FLOOR);
    expect(moveDutySites.filter((site) => dutyGaps(site).length > 0).length).toBe(0);
  });

  it("바늘이 장식이 아니다 — 의무 없는 자리는 합성 소스에서 잡힌다", () => {
    // ⚠️ **합성 소스로 증명한다**(라운드 88 D의 형식) — 저장소를 한 글자도 고치지 않고 바늘을 시험한다.
    const needle = "headingLine";
    const bare = `const SECTION_X_LINE = ${needle}("## 새 절.");`;
    const bareSites = collectMoveDutySites("합성", bare);
    expect(bareSites).toHaveLength(1);
    expect(bareSites[0].kind).toBe("절 이름");
    expect(dutyGaps(bareSites[0]).length).toBeGreaterThan(0);

    // 같은 자리에 의무를 적으면 초록이다 — 고치는 법이 하나뿐이고 쉽다.
    const written = [
      "/**",
      " * ⚠️ 이동 의무 — 이 제목을 고치는 문서 트랙(F)이 같은 라운드 안에 이 등호를 함께 옮긴다.",
      " */",
      bare
    ].join("\n");
    const writtenSites = collectMoveDutySites("합성", written);
    expect(writtenSites).toHaveLength(1);
    expect(dutyGaps(writtenSites[0])).toEqual([]);

    // 한 낱말짜리 장식은 통과하지 못한다(길이·손·시점을 함께 묻는다).
    const decorated = collectMoveDutySites("합성", ["// 옮긴다", bare].join("\n"));
    expect(dutyGaps(decorated[0]).length).toBeGreaterThan(0);

    // 그리고 줄 번호 배열 쪽 바늘은 **줄 번호가 아닌 배열**을 세지 않는다.
    const numbersNotLines = collectMoveDutySites(
      "합성",
      "expect(chain[0].numbers).toEqual([37, 999]);"
    );
    expect(numbersNotLines).toEqual([]);
  });

  /**
   * ⓖ **사각 — 값과 하한으로 적는다.** ⚠️ 이 축이 **못 보는 것**이 무엇인지가 이 축의 절반이다.
   */
  const MOVE_DUTY_BLIND_SPOTS = [
    {
      id: "문서에서-파생한-좌표",
      statement:
        "⚠️ **문서를 파싱해 파생한 좌표는 이 바늘 밖이다.** 라운드 90 트랙 D의 축(위 ⓔ 전수)이 그 자리이고, 그 좌표들은 등호가 아니라 **문서에서 읽어 만든 값**이라 옮길 사람이 없다 — 그래서 이동 의무를 물을 대상도 없다. ⚠️ **그 축의 자리 수는 이 트랙이 다시 재고 값으로 적는다**: **D 커밋 시점 91 · 라운드 91 실측 92 · 오늘(라운드 92 트랙 E 재실측) 93**(인용된 번호는 오늘 97). 세 시점 다 계약은 초록이었다 — D가 **하한**을 골랐기 때문이고, 그 선택의 값이 이 사각의 크기다.",
      /** 파싱으로 파생한 좌표 자리 수(오늘 93). 하한은 D 커밋 시점의 91. */
      floor: 91,
      measure: () => coordinateSites.length
    },
    {
      id: "반대-방향",
      statement:
        "⚠️ **문서가 소스의 좌표를 무는 반대 방향은 이 바늘 밖이고, 그 수는 훨씬 크다.** 이 축은 *소스가 문서를 가리키는* 자리만 센다(오늘 아홉). 그 반대 — 문서가 `<파일>:<줄>` 꼴로 소스를 가리키는 자리는 **이 계약이 읽는 문서 셋만 세어도 서른셋**이고, 저장소 전체로는 그보다 훨씬 크다(이 계약은 문서 셋만 읽으므로 그 밖은 이 자도 세지 않는다 — 그 사실이 이 사각의 두 겹째다). 그 자리들에는 이동 의무가 **한 자도 적혀 있지 않고**, 옮기는 손도 반대다(소스가 밀리면 **문서**를 고쳐야 한다).",
      /** 문서 셋이 소스 좌표를 부른 자리 수(오늘 33). 자리가 늘면 사각도 함께 는다. */
      floor: 25,
      measure: () =>
        [CHECKLIST_PATH, PAIR_DOC_PATH, JUDGEMENT_DOC_PATH]
          .map((path) => (read(path).match(SOURCE_COORDINATE_IN_DOC_PATTERN) ?? []).length)
          .reduce((sum, count) => sum + count, 0)
    },
    {
      id: "적힘-지켜짐",
      statement:
        "⚠️⚠️ **의무가 적혀 있다는 것과 그 의무가 지켜진다는 것은 다르다 — 이 자는 앞쪽만 센다.** 자리마다 *누가 언제 옮기는가*가 적혀 있는지는 여기서 값으로 걸리지만, **그 손이 그날 실제로 옮겼는가**는 이 그물 밖이다. 뒤쪽은 **라운드마다 F의 걸음이 답한다** — F가 절을 세우며 `[22, 1223, 1267]`을 함께 옮기면 이 계약이 초록으로 남고, 잊으면 ⓖ가 **그 자리에서** 빨개진다(그것이 등호를 고른 값이다). ⚠️ 그래서 이 사각의 자는 *지켜짐*이 아니라 **의무가 적힌 자리 수**를 센다 — 아홉 자리 다 적혀도 사각은 사라지지 않는다. **재개 조건(사건형): 저장소의 다른 계약이 문서 좌표를 등호로 물기 시작하는 날 — 그날 이 모집단이 이 두 파일 밖으로 넓어진다.**",
      /** 의무가 적힌 자리 수(오늘 9 = 줄 번호 1 + 절 이름 8). 하한은 정찰의 1+6. */
      floor: LINE_ARRAY_FLOOR + SECTION_NAME_FLOOR,
      measure: () => moveDutySites.filter((site) => dutyGaps(site).length === 0).length
    }
  ] as const;

  it("사각마다 문장이 비어 있지 않고 id가 서로 다르다 (최소 셋)", () => {
    expect(MOVE_DUTY_BLIND_SPOTS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(MOVE_DUTY_BLIND_SPOTS.map((spot) => spot.id)).size).toBe(
      MOVE_DUTY_BLIND_SPOTS.length
    );
    for (const spot of MOVE_DUTY_BLIND_SPOTS) {
      expect(spot.statement.trim().length, `${spot.id} 사각의 문장이 비었어요`).toBeGreaterThan(20);
    }
    // ⚠️ 재개 조건은 이 축과 **함께** 적힌다(AD-5) — 산문이 아니라 값으로 확인한다.
    expect(
      MOVE_DUTY_BLIND_SPOTS.some((spot) => spot.statement.includes("재개 조건(사건형)")),
      "이 축의 재개 조건이 사라졌어요"
    ).toBe(true);
  });

  for (const spot of MOVE_DUTY_BLIND_SPOTS) {
    it(`${spot.id}: 사각이 오늘도 실재한다 (유령 사각 금지)`, () => {
      expect(
        spot.measure(),
        `${spot.id} 사각을 다시 재니 하한(${spot.floor}) 아래예요 — 사각이 사라졌다면 그 줄을 지우고, 좁아졌다면 하한을 내리세요`
      ).toBeGreaterThanOrEqual(spot.floor);
    });
  }
});

describe("ⓕ 사각 — 이 그물이 못 보는 것을 값과 하한으로 적는다", () => {
  const BLIND_SPOTS = [
    {
      id: "확인-여부",
      statement:
        "이 계약은 C-3이 확인됐는지를 세지 않는다 — 그 손(사람·기기·날짜 배정)은 저장소 밖이고, 여기서 세는 것은 세 자리(접근성 표 C절·수동 증거 절·짝 문서 §0-1)가 말하는 수의 정합뿐이다.",
      /** 이 계약이 C-3 칸에서 읽는 자리 = 라운드 목록 하나. 나머지 만 자가 넘는 산문은 축 밖이다. */
      floor: 1,
      measure: () => collectSites(c3Row!.cells.join(" | ")).length
    },
    {
      id: "다른-C절-줄",
      statement:
        "C-12처럼 경과 수 축이 아직 없는 C절 줄은 이 그물에 걸리지 않는다 — 오늘 열둘 중 축을 진 줄은 C-3 하나뿐이다.",
      /** 축이 없는 줄의 수(오늘 열하나). 줄이 늘면 사각도 함께 는다. */
      floor: 11,
      measure: () => cRows.filter((row) => collectSites(row.cells.join(" | ")).length === 0).length
    },
    {
      id: "머리말-옛-문단",
      statement:
        "머리말의 옛 라운드 문단은 같은 모양인데도 모집단 밖이다 — 그 수들은 낡은 것이 아니라 그 라운드의 기록이다.",
      floor: 3,
      measure: () => headlineSites.length
    },
    {
      id: "짝-문서-옛-문단",
      statement:
        "짝 문서에도 같은 모양의 옛 라운드 문단이 있고(오늘 :266 일곱 · :1212 여덟), 그 둘은 §0-1 밖이라 모집단 밖이다 — 셋째 자리로 무는 것은 §0-1의 🔒 줄 하나뿐이다(라운드 89 리뷰 M-3).",
      floor: 2,
      measure: () => pairLegacySites.length
    },
    {
      id: "좌표-내용",
      statement:
        "ⓔ가 무는 것은 **좌표의 실재**다 — 그 번호가 짝 문서 §1-1의 행으로 풀리는가, 표면을 함께 적었다면 그 표면이 같은가까지다. **그 행의 확인 항목이 접근성 표가 말하는 그 일인지는 세지 않는다**(오늘 자리 92 · 인용 번호 96 전부가 이 사각 안에 있고 — D 커밋 시점에는 91·95였다 — 사람이 읽어야 풀리는 판단이다). C-3 한 자리만 예외로 `잠금 오버레이`라는 낱말까지 대조한다 — 라운드 89가 그 자리에 손으로 심은 표식이고, 전수로 옮길 수 있는 형식이 아니다.",
      /** 내용까지는 못 보는 자리 = 인용된 좌표 전수(오늘 96). 모집단이 늘면 사각도 함께 는다. */
      floor: 91,
      measure: () => citedNumbers.length
    },
    {
      id: "문서가-옮겨-적은-계약-상수",
      statement:
        "이 계약의 상수를 **문서가 손으로 옮겨 적은 자리**는 이 그물 밖이다. ⚠️⚠️ **두 시점 — 이 문장이 태어날 때의 사실과 오늘의 사실이 다르다**(라운드 90 리뷰 M-1). · **라운드 90 트랙 D 커밋 시점**: 갈려 있었다 — 계약 상수 `MAX_DIVERGENCE = 0`인데 문서 두 자리(당시 `docs/qa/accessibility-offline-checklist.md:1085` C-3 행 · `:1111` 수동 증거 절)가 아직 *\"끝 라운드 차이가 셋을 넘지 않는가\"* 라고 적고 있었다(값 0 ↔ 셋 · 자리 둘). · **오늘(HEAD)**: **같은 라운드의 트랙 F가 그 두 자리를 0으로 고쳤다** — 오늘 그 자리는 `:1153`(C-3 행) · `:1188`(수동 증거 절)이고 둘 다 *\"0을 넘지 않는가\"* 라고 적는다. 즉 **이 사각이 예고한 수리가 같은 라운드 안에서 이행됐고, 갈림은 오늘 0건이다**(판정은 known-limitations의 AE-3). ⚠️ **그런데 사각은 사라지지 않았다**: 이 그물은 그 정합을 **여전히 세지 않으므로**, 문서가 내일 다시 낡아도 조용하다 — 사각이 말하는 것은 *오늘 갈렸는가*가 아니라 *갈려도 아무도 모른다*이다. ⚠️ 그래서 아래 `measure`가 세는 것도 갈림이 아니라 **그 상수를 옮겨 적은 산문 자리의 수**다(참이든 거짓이든 자리는 그대로 있고, 하한은 그 자리가 사라졌는지만 묻는다). ⚠️ 이 트랙은 그 갈림을 **무는 축을 세우지 않는다**: 오늘 빨간 계약을 세우면 이 트랙이 문서를 고쳐야 하고, 그 순간 *계약이 문서를 지킨다*가 *문서가 계약을 맞춘다*로 뒤집힌다 — 고치는 손은 문서 트랙(F)이었다. ⚠️ **재개 조건(사건형): 문서가 인용한 계약 상수의 정합이 한 트랙의 축이 되는 라운드가 서는 날 — 그날 F가 이미 고친 그 두 자리가 그 계약의 첫 모집단이다.** · ⚠️⚠️ **셋째 시점(오늘 · 라운드 91 트랙 E)**: **그 조건이 도래했고 그 축이 위 ⓖ로 섰다** — 첫 모집단은 F가 고친 두 자리에 머리말 `:22`를 더한 **셋**이고, 세 자리 다 오늘 값이 상수(0)와 같아 **오늘 값으로 통과한다**(빨간 계약을 세우면 이 트랙이 문서를 고쳐야 하고 그 순간 순서가 뒤집힌다 — 그래서 세우지 않았다). ⚠️ **그런데 이 사각은 오늘도 사라지지 않는다**: ⓖ가 문 것은 *이 상수 하나*이고 아래 `이-상수-하나만`이 그 나머지를 값으로 진다. 그래서 이 줄의 `measure`도 그대로 **산문 자리의 수**를 세고(오늘 3 · 하한 2), ⓖ가 그 자와 자기 자를 맞대어 **갈리면 빨개진다**.",
      /**
       * 계약의 ⓒ 축을 산문으로 옮겨 적은 자리 수(오늘 셋 — 접근성 표 머리말 `:22` · C-3 행
       * `:1153` · 수동 증거 절 `:1188`. D 커밋 시점에는 둘이었다).
       * ⚠️ **이 자는 그 자리가 *참인지*를 묻지 않는다** — 산문 자리의 수이므로 F의 수리 전후가
       * 같은 답을 낸다. 그것이 이 사각이 사각인 이유다.
       */
      floor: 2,
      measure: () => quotedConstantLineCount(source)
    },
    {
      id: "이-상수-하나만",
      statement:
        "⚠️ **ⓖ가 무는 것은 *이 계약의 상수 하나*뿐이다.** 저장소 전체로 보면 문서 넷(`docs/operations/known-limitations.md` · 확인 문서 둘 · `docs/dev/do-not-change.md`)이 소스의 수치 상수를 **이름과 값을 함께** 적은 자리가 **12**이고 그 이름은 **아홉**이다(`ANDROID_ALERT_BUTTON_LIMIT` 3 · `DEFAULT_ADMIN_SESSION_RETENTION_DAYS` 30 · `ENTRY_DATE_MAX_PAST_MONTHS` 240 **두 자리** · `EXPORT_FILE_NAME_CHILD_MAX_LENGTH` 20 · `MAX_DIVERGENCE` 0 **세 자리** · `MORE_SEARCH_HIT_SLOP` 6 · `NOTIFICATION_BELL_HIT_SLOP` 6 · `QUARTER_TREND_MONTHS` 3 · `SYNCED_ROW_RETENTION_DAYS` 90 — 판정은 known-limitations의 **AE-3**). ⚠️⚠️ **오늘 열둘 다 값이 맞는데, 그중 아홉 자리는 오늘도 세는 자가 0건이다** — ⓖ가 연 것은 접근성 표의 **세 자리**뿐이고, 그마저 *이름 없이 값만* 적힌 산문이라 AE-3의 바늘(이름+값)에는 걸리지 않는다. 아래 `measure`는 **이 상수의 이름+값 자리**(판정 문서의 `:7049`·`:7222`·`:7261`)를 세는데, ⚠️ **그 셋조차 이 축 밖이다**(ⓖ는 접근성 표 한 파일만 읽는다) — 사각이 사각인 이유가 그것이다. ⚠️ **재개 조건(사건형): 문서가 인용한 수치 상수 **전수**가 한 트랙의 축이 되는 라운드가 서는 날 — 그날의 첫 모집단은 AE-3이 낸 **아홉 이름 열두 자리**다.**",
      /** 이 상수를 *이름과 함께* 적은 판정 문서의 줄(오늘 셋). 자리가 늘면 사각도 함께 는다. */
      floor: 3,
      measure: () =>
        read(JUDGEMENT_DOC_PATH)
          .split("\n")
          .filter((line) => line.includes("MAX_DIVERGENCE")).length
    },
    {
      id: "문자열-상수의-값",
      statement:
        "⚠️ **문자열 상수의 *값*(문구 전문)을 옮겨 적은 자리는 이 바늘 밖이다.** ⓖ가 읽는 꼴은 *수*이고, 이 문서가 소스의 상수를 부르는 자리는 대부분 **이름만**이다 — 오늘 이 표가 이름으로 부르는 소스 상수는 **예순여섯**(자리 마흔아홉 줄)이고, 그 값이 문서가 적은 문구와 같은지는 **이 축이 하나도 세지 않는다**. 저장소 전체로는 문서 넷이 문자열 상수를 **이름만으로도 321** 자리에서 부른다(AE-3의 사각). ⚠️ 그중 일부는 다른 그물이 진다(`release-readiness`가 `\"44px\"` 한 낱말을 물고, DNC 계약들이 고지 문구를 문다) — 그러나 **이 그물은 아니다.**",
      /** 이 표가 이름으로 부르는 소스 상수의 가짓수(오늘 66). 이름이 늘면 사각도 함께 는다. */
      floor: 60,
      measure: () =>
        new Set(source.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) ?? []).size
    }
  ] as const;

  it("사각마다 문장이 비어 있지 않고 id가 서로 다르다", () => {
    expect(new Set(BLIND_SPOTS.map((spot) => spot.id)).size).toBe(BLIND_SPOTS.length);
    for (const spot of BLIND_SPOTS) {
      expect(spot.statement.trim().length, `${spot.id} 사각의 문장이 비었어요`).toBeGreaterThan(20);
    }
  });

  for (const spot of BLIND_SPOTS) {
    it(`${spot.id}: 사각이 오늘도 실재한다 (유령 사각 금지)`, () => {
      expect(
        spot.measure(),
        `${spot.id} 사각을 다시 재니 하한(${spot.floor}) 아래예요 — 사각이 사라졌다면 그 줄을 지우고, 좁아졌다면 하한을 내리세요`
      ).toBeGreaterThanOrEqual(spot.floor);
    });
  }

  it("C-12가 그 사각 안에 있다 (이름으로 지목한다)", () => {
    const c12 = cRows.find((row) => row.cells[0] === "C-12");
    expect(c12, "C절 표에서 C-12 행을 찾지 못했어요").toBeTruthy();
    expect(
      collectSites(c12!.cells.join(" | ")),
      "C-12에 경과 수 축이 생겼어요 — 그러면 이 사각의 하한을 내리고 그 줄도 ⓐ~ⓓ의 모집단에 넣으세요"
    ).toEqual([]);
  });
});

describe("이 그물의 자리 — runtime-checklist-shape.test.ts의 짝", () => {
  it("짝 계약이 있고, 그쪽은 짝 문서를 문다", () => {
    expect(existsSync(join(repoRoot, ...PAIR_CONTRACT_PATH.split("/")))).toBe(true);
    expect(read(PAIR_CONTRACT_PATH)).toContain(PAIR_DOC_PATH);
  });

  it("두 그물의 축이 서로 다르다 (한 그물에 축 둘을 얹지 않는다)", () => {
    // 짝 계약은 접근성 표를 세지 않고, 이 계약은 짝 문서의 §0 수치를 세지 않는다.
    expect(read(PAIR_CONTRACT_PATH)).not.toContain(CHECKLIST_PATH);
    expect(cSectionSites.length + manualSites.length).toBe(2);
  });
});
