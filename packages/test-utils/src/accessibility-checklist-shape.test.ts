// 라운드 89 트랙 E (round89-scout #5) — 접근성 표의 C-3 경과 수가 두 자리에서 갈리지 않는다.
//
// ⚠️ **이것은 새 그물이 아니라 `runtime-checklist-shape.test.ts`의 *짝*이다.** 라운드 75 트랙 C가
// 짝 문서(`docs/qa/runtime-verification-required.md`)에 세운 계약을 **같은 계열의 둘째 문서**
// (`docs/qa/accessibility-offline-checklist.md`)에 같은 방식으로 놓는다: 문서가 손으로 적은 수를
// **그 문서를 파싱한 값**에서 파생시킨다(셸 0건 · 문서 쓰기 0건). 두 파일의 축은 서로 다르고
// (그쪽은 짝 문서의 §0 여섯 숫자, 이쪽은 접근성 표의 C-3 경과 수) 한 트랙이 한 그물에 축 둘을
// 얹지 않는다 — 그 사실을 아래 "이 그물의 자리"가 값으로 확인한다.
//
// **오늘의 관측(정찰이 값으로 본 것을 이 파일이 다시 셌다).** C-3(잠금 오버레이 TalkBack 투과)의
// "몇 라운드째 미확인인가"를 말하는 자리가 본문에 **둘**인데, 세 라운드째 서로 다른 수를 말한다:
//
//   · `## C절.` 표의 C-3 행 — **스물두**(67·68·…·88)
//   · `## 수동 증거` 절의 C-3 줄 — **열아홉**(67·68·…·85)
//
// 두 자리 각각은 **자기 안에서는 정합**이다(수사 = 목록 길이). 갈린 것은 **어디까지 적었는가**뿐이고,
// 그 갈림은 라운드 86·87·88 동안 C절만 자라는 사이에 셋으로 벌어졌다. 이 계약이 세는 것은 그
// **수의 정합**이지 **확인 여부가 아니다** — C-3을 실제로 확인할 손은 저장소 밖이고, 그 배정을
// 이 파일이 대신할 수는 없다(그 사실은 ⓕ 사각에 값으로 적혀 있다).
//
// 이 파일이 묻는 것은 여섯이다.
//  ⓐ **자기 정합** — 경과 수를 말하는 두 자리 각각에서 한글 수사가 **열거된 라운드 목록의 길이**와
//     같은가(오늘 22/22 · 19/19).
//  ⓑ **접두** — "수동 증거" 절의 목록이 C절 목록의 **접두**인가(두 목록이 서로 다른 라운드를
//     말하면 그날 빨개진다 — 뒤처지는 것은 허용하되 **갈라지는 것**은 허용하지 않는다).
//  ⓒ **갈림의 상한 래칫** — 두 목록의 **끝 라운드 차이가 오늘의 값(3)을 넘지 않는가**.
//     ⚠️ **이것이 이 계약의 축이다**: 다음 라운드가 C절만 89로 올리면 차이가 넷이 되어 **그 갱신이
//     빨개진다**. 고치는 법은 하나뿐이고 쉽다 — **두 자리를 함께 올린다**(그때 차이는 그대로 셋이다).
//  ⓓ **목록의 모양** — 목록이 **67부터 빠짐없이 연속**인가(중간에 빠진 라운드가 0건).
//  ⓔ **좌표** — C-3이 짝 문서의 `#26`이고 표면이 `실기기`라는 사실이 **두 문서에서 같은 값**인가.
//  ⓕ **사각** — 이 그물이 못 보는 것을 값과 하한으로 적는다.
//
// ⚠️ **이 계약은 문서를 고치지 않는다.** 읽기만 한다(`docs/**` 쓰기 0건). 두 자리를 맞추는 갱신은
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

/** 오늘: 268 · 1022 · 1042. 값은 여기 적지 않고 제목에서 찾는다. */
const SECTION_A_LINE = headingLine("## A절.");
const SECTION_C_LINE = headingLine("## C절.");
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

describe("바늘과 모집단 (빈 스윕 금지 · 옛 라운드 문단 제외)", () => {
  it("문서를 실제로 읽었고 절 셋이 제자리에 있다", () => {
    expect(lines.length).toBeGreaterThan(1000);
    expect(SECTION_A_LINE).toBeLessThan(SECTION_C_LINE);
    expect(SECTION_C_LINE).toBeLessThan(SECTION_MANUAL_LINE);
    expect(cRows.length).toBeGreaterThan(10);
    expect(c3Row, "C절 표에서 C-3 행을 찾지 못했어요").toBeTruthy();
  });

  it("경과 수를 말하는 자리가 본문에 둘이고, C절과 수동 증거 절에 하나씩이다", () => {
    expect(cSectionSites.length, "C절에서 C-3의 경과 수 자리를 하나 찾지 못했어요").toBe(1);
    expect(manualSites.length, "수동 증거 절에서 C-3의 경과 수 자리를 하나 찾지 못했어요").toBe(1);
    expect(
      strayBodySites.map((site) => `${CHECKLIST_PATH}:${site.line}`),
      "C절·수동 증거 절 밖에 경과 수를 말하는 자리가 새로 생겼어요 — 자리가 셋이 되면 ⓑ·ⓒ가 무엇과 무엇을 견주는지 다시 정해야 합니다"
    ).toEqual([]);
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

describe("ⓐ 자기 정합 — 한글 수사가 라운드 목록의 길이와 같다", () => {
  for (const [label, sites] of [
    ["C절 C-3 행", () => cSectionSites],
    ["수동 증거 절 C-3 줄", () => manualSites]
  ] as const) {
    it(`${label}의 수사가 목록 길이와 같다`, () => {
      const site = sites()[0];
      expect(site, `${label}을 찾지 못했어요`).toBeTruthy();
      expect(
        Number.isNaN(site.declared),
        `${label}의 "${site.numeral}"을(를) 수로 읽지 못했어요 — 수사를 바꿨다면 이 계약의 표도 함께 늘리세요`
      ).toBe(false);
      expect(
        site.declared,
        `${CHECKLIST_PATH}:${site.line} — "${site.numeral}"은 ${site.declared}인데 목록은 ${site.rounds.length}개예요`
      ).toBe(site.rounds.length);
    });
  }

  it("두 목록이 줄지 않는다 (오늘의 하한: 스물두 · 열아홉)", () => {
    // ⚠️ **하한 래칫**이지 오늘 값의 사본이 아니다 — 두 자리가 함께 자라는 갱신은 이 줄을 통과해야
    // 하고(그것이 이 계약이 바라는 갱신이다), 목록이 **줄어드는** 것만 여기서 잡힌다.
    // 경과 라운드는 확인이 오기 전에는 되돌아가지 않는다.
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
});

describe("ⓒ 갈림의 상한 래칫 (이 계약의 축)", () => {
  /**
   * ⚠️⚠️ **오늘의 값이다(88 − 85 = 3).** 이 상수를 올리는 것은 *갈림을 넓히는 것*이므로,
   * 올리려는 사람은 왜 두 자리를 함께 고칠 수 없었는지를 여기 함께 적어야 한다.
   * C절만 한 라운드 더 올리면 넷이 되어 이 줄이 빨개진다 — 그때의 고침은 **수동 증거 절도 함께
   * 올리는 것**이고, 그러면 차이는 그대로 셋이다.
   */
  const MAX_DIVERGENCE = 3;

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
      `C절은 라운드 ${lastOf(cSectionSites[0].rounds)}까지, 수동 증거 절은 ${lastOf(manualSites[0].rounds)}까지 적혀 있어요 — 한 자리만 올리지 말고 두 자리를 함께 올리세요(${CHECKLIST_PATH}:${cSectionSites[0].line} · :${manualSites[0].line})`
    ).toBeLessThanOrEqual(MAX_DIVERGENCE);
  });

  it("상한이 장식이 아니다 (목록 길이보다 한참 아래에 서 있다)", () => {
    // 오늘의 갈림은 셋이고 상한도 셋이다 — 여유가 0이라는 뜻이고, 그래서 다음 한 걸음이 잡힌다.
    // ⚠️ 다만 여유 0을 단언하지는 않는다: **두 자리를 함께 올리는 갱신**은 갈림을 줄이며
    // 여유를 늘리고, 그 갱신이야말로 이 계약이 바라는 것이다.
    expect(MAX_DIVERGENCE).toBeLessThan(cSectionSites[0].rounds.length);
    expect(
      lastOf(cSectionSites[0].rounds) - lastOf(manualSites[0].rounds)
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("ⓓ 목록의 모양 — 67부터 빠짐없이 연속", () => {
  for (const [label, sites] of [
    ["C절 C-3 행", () => cSectionSites],
    ["수동 증거 절 C-3 줄", () => manualSites]
  ] as const) {
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

describe("ⓕ 사각 — 이 그물이 못 보는 것을 값과 하한으로 적는다", () => {
  const BLIND_SPOTS = [
    {
      id: "확인-여부",
      statement:
        "이 계약은 C-3이 확인됐는지를 세지 않는다 — 그 손(사람·기기·날짜 배정)은 저장소 밖이고, 여기서 세는 것은 두 자리가 말하는 수의 정합뿐이다.",
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
