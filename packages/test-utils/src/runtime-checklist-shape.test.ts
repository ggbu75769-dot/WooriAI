// 라운드 75 트랙 C (GAP-075 #3) — 확인의 표가 자기를 센다.
//
// `docs/qa/runtime-verification-required.md` §0(라운드 74 트랙 E 신설)은 이 표의 모든 행에
// `표면` 칸을 붙이고 **표면별 행 수 · 합계 · §1 수**를 적어 두었다. 좋은 절인데, 그 절이
// **자기 규율 밖에** 있었다:
//
//  ① 그 수치를 다시 세는 것이 저장소에 **0건**이었다(그 문서를 여는 코드 셋은 전부 주석에서
//     이름을 부를 뿐이다). 즉 §0은 스스로 "손으로 적지 않는다 — 표를 파싱해 센다"고 적어 두고도,
//     실제로 파싱해 세는 것은 **사람이 그 명령을 기억해서 돌릴 때뿐**이었다.
//  ② 그리고 이 표는 **라운드마다 반드시 자란다** — 표 자신의 머리말이 그것을 라운드 종료
//     조건으로 못박았다. 다음 라운드가 행을 더하는 순간 §0의 여섯 숫자가 전부 조용히 틀린다.
//     라운드 74 O-3이 이름 붙인 병("인용이 실측을 대신한다")이 **O-3을 쓴 라운드의 산출물에**
//     다음 라운드에 자동으로 발병하도록 심겨 있었다.
//
// 이 파일이 묻는 것은 다섯이다.
//  ⓐ **파생 단언** — §0 표의 네 수·합계·`뜻` 칸의 두 수·셸 블록 주석의 여섯 숫자가 전부
//     **이 파일을 파싱한 값**과 같은가(손으로 적은 숫자가 한 자리도 검증 밖에 남지 않는다).
//  ⓑ **부정 단언** — 모든 표의 모든 행이 그 표 헤더와 **같은 셀 수**인가. `#98`이 오늘까지
//     이것을 깼다: 셀이 여섯이라 GFM이 초과 셀을 버렸고, **근거 파일 칸이 통째로 렌더에서
//     사라져** 그 행을 밟으려는 사람이 무엇을 읽어야 하는지 알 수 없었다.
//  ⓒ **전수 단언** — 표면 값이 넷뿐이고 빈 칸이 0건인가(§0이 산문으로 선언한 그 전수 확인을
//     값으로: "①의 네 수를 더한 값이 ②와 같다").
//  ⓓ 행 번호가 1..N **연속이고 중복 0건**인가(열 개 문서가 `#69`·`#103` 같은 번호로 서로를
//     가리킨다 — 번호가 흔들리면 그 인용이 전부 끊긴다).
//  ⓔ 라운드 구간 목록(§1-1 머리말)이 §1-1의 행을 **빠짐없이 한 번씩** 덮고, 마지막 구간이
//     이번 라운드 신설분으로 끝나는가(행을 더하고 머리말을 안 고치는 것도 같은 병이다).
//
// ⚠️ **셸을 실행하지 않는다.** 파싱으로 답이 나오므로 명령이 필요 없고, 그래서 라운드 74가
// 세운 읽기 전용 가드(`repo-self-description.test.ts`의 `FORBIDDEN_COMMAND_PATTERNS`)와
// 부딪히지 않는다. §0의 셸 블록은 **사람이 손으로 같은 값을 확인하는 근거**로 남기고, 이
// 계약은 그 블록이 적은 숫자까지 함께 센다 — 두 방언을 통일하지 않는 이유는 그 문서와
// `known-limitations.md` P절에 값으로 적혀 있다.
//
// ⚠️ **이 계약은 표의 내용을 묻지 않는다.** 행의 문장·기대 동작·근거 파일·부정 조건은 라운드
// 62~75가 쌓아 둔 사실 진술이고, 여기서 다루는 것은 **모양**뿐이다(셀 수 · 번호 · 표면 값 ·
// 그 셋에서 파생되는 수치). 축이 다른 계약을 한 파일에 넣지 않는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

const CHECKLIST_PATH = "docs/qa/runtime-verification-required.md";

/** §0이 선언한 표면 값 넷 — 순서까지 그 절의 표·셸 블록과 같다. */
const SURFACES = ["실기기", "브라우저", "서버", "작업"] as const;
type Surface = (typeof SURFACES)[number];

const source = readFileSync(join(repoRoot, ...CHECKLIST_PATH.split("/")), "utf8");
const lines = source.split("\n");

// ---------------------------------------------------------------------------
// 마크다운 표 파서 — 파일 하나를 문자열로 읽어 표만 뽑는다(셸 0건).
// ---------------------------------------------------------------------------

type Row = { readonly cells: string[]; readonly line: number };
type Table = { readonly header: string[]; readonly rows: Row[]; readonly line: number };

/**
 * 한 줄을 셀로 가른다.
 *
 * ⚠️ 이스케이프된 `\|`는 셀 경계가 **아니다**(GFM과 같은 규칙). 이 구분이 없으면
 * `docs/qa/fixed-issues.md:26` 같은 자리를 결함으로 오인한다 — 라운드 75 정찰이 그 자리를
 * "결함이 아니다"라고 판정한 근거가 정확히 이것이다.
 */
function splitCells(line: string): string[] {
  const trimmed = line.trim();
  return trimmed
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

function isDelimiterLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|[\s:|-]+\|$/.test(trimmed) && trimmed.includes("-");
}

function parseTables(): Table[] {
  const tables: Table[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!isTableLine(lines[index]) || !isDelimiterLine(lines[index + 1] ?? "")) continue;
    const header = splitCells(lines[index]);
    const rows: Row[] = [];
    let cursor = index + 2;
    while (cursor < lines.length && isTableLine(lines[cursor])) {
      rows.push({ cells: splitCells(lines[cursor]), line: cursor + 1 });
      cursor += 1;
    }
    tables.push({ header, rows, line: index + 1 });
    index = cursor - 1;
  }
  return tables;
}

const tables = parseTables();

/** 체크표(§1 · §1-1) — 첫 칸이 `#`인 표 전부. */
const checklistTables = tables.filter((table) => table.header[0] === "#");

/** 번호가 붙은 행 전부 — §0의 셸 명령 ②(`^\| *[0-9]+ *\|`)가 세는 그 집합과 같다. */
const numberedRows = tables.flatMap((table) =>
  table.rows.filter((row) => /^\d+$/.test(row.cells[0])).map((row) => ({ ...row, table }))
);

function headingLine(prefix: string): number {
  const index = lines.findIndex((line) => line.startsWith(prefix));
  expect(index, `${prefix} 제목을 찾지 못했어요`).toBeGreaterThan(-1);
  return index + 1;
}

const SECTION_0_LINE = headingLine("## 0. ");
const SECTION_1_LINE = headingLine("## 1. ");
const SECTION_1_1_LINE = headingLine("### 1-1.");

function sliceLines(fromLine: number, toLine: number): string {
  return lines.slice(fromLine - 1, toLine - 1).join("\n");
}

const section0 = sliceLines(SECTION_0_LINE, SECTION_1_LINE);
const section1Intro = sliceLines(SECTION_1_1_LINE, checklistTables[1]?.line ?? SECTION_1_1_LINE);

/** §1 = `## 1.`와 `### 1-1.` 사이의 번호 행(셸 명령 ③의 awk 범위와 같다). */
const section1Rows = numberedRows.filter(
  (row) => row.line > SECTION_1_LINE && row.line < SECTION_1_1_LINE
);
const section11Rows = numberedRows.filter((row) => row.line > SECTION_1_1_LINE);

function surfaceOf(row: { cells: string[] }): string {
  return row.cells[1].replace(/`/g, "").trim();
}

function countBySurface(surface: Surface): number {
  return numberedRows.filter((row) => surfaceOf(row) === surface).length;
}

// ---------------------------------------------------------------------------
// §0이 손으로 적은 숫자들을 그 자리에서 뽑는다 — 값은 여기에 다시 적지 않는다.
// ---------------------------------------------------------------------------

/** §0의 실행 표면 요약표(헤더 셋). */
const surfaceSummaryTable = tables.find(
  (table) =>
    table.line > SECTION_0_LINE &&
    table.line < SECTION_1_LINE &&
    table.header[0] === "표면" &&
    table.header.length === 3
);

function boldInt(cell: string, where: string): number {
  const match = /\*\*(\d+)\*\*/.exec(cell);
  expect(match, `${where}에서 굵은 숫자를 찾지 못했어요`).toBeTruthy();
  return Number(match![1]);
}

/** §0 표가 적은 표면별 수(순서 보존). */
function declaredSurfaceCounts(): { surface: string; count: number }[] {
  expect(surfaceSummaryTable, "§0의 실행 표면 요약표를 찾지 못했어요").toBeTruthy();
  return surfaceSummaryTable!.rows
    .filter((row) => row.cells[0].startsWith("`"))
    .map((row) => ({
      surface: row.cells[0].replace(/`/g, "").trim(),
      count: boldInt(row.cells[2], `§0 표의 ${row.cells[0]} 줄`)
    }));
}

/** §0 표의 (합계) 줄 — 굵은 합계와 `뜻` 칸이 적은 §1·§1-1 두 수. */
function declaredTotals(): { total: number; section1: number; section11: number } {
  const row = surfaceSummaryTable!.rows.find((entry) => entry.cells[0].includes("합계"));
  expect(row, "§0 표의 (합계) 줄을 찾지 못했어요").toBeTruthy();
  const parts = /§1\s*(\d+)\s*\+\s*§1-1\s*(\d+)/.exec(row!.cells[1]);
  expect(parts, "§0 (합계) 줄의 `뜻` 칸이 §1·§1-1의 수를 숫자로 적지 않았어요").toBeTruthy();
  return {
    total: boldInt(row!.cells[2], "§0 표의 (합계) 줄"),
    section1: Number(parts![1]),
    section11: Number(parts![2])
  };
}

/** §0의 셸 블록(사람이 손으로 확인하는 근거 — 이 계약은 **읽기만** 한다). */
function shellBlock(): string {
  const start = section0.indexOf("```sh");
  expect(start, "§0의 셸 블록이 사라졌어요(삭제 금지 — 사람이 손으로 확인하는 근거다)").toBeGreaterThan(-1);
  const end = section0.indexOf("```", start + 5);
  expect(end, "§0의 셸 블록이 닫히지 않았어요").toBeGreaterThan(start);
  return section0.slice(start, end);
}

/** 셸 블록 주석이 괄호 안에 적어 둔 숫자들(`# ① … (106 · 3 · 4 · 1)`). */
function commentNumbers(marker: string): number[] {
  const line = shellBlock()
    .split("\n")
    .find((entry) => entry.trimStart().startsWith("#") && entry.includes(marker));
  expect(line, `셸 블록에서 ${marker} 주석을 찾지 못했어요`).toBeTruthy();
  const groups = [...line!.matchAll(/\(([^)]*)\)/g)];
  expect(groups.length, `${marker} 주석에 괄호로 적은 수치가 없어요`).toBeGreaterThan(0);
  const numbers = [...groups[groups.length - 1][1].matchAll(/\d+/g)].map((match) => Number(match[0]));
  expect(numbers.length, `${marker} 주석의 괄호 안에 숫자가 없어요`).toBeGreaterThan(0);
  return numbers;
}

/** §1-1 머리말이 적은 라운드 구간 목록(`13~21은 라운드 49~57` 꼴). */
function declaredRoundRanges(): { start: number; end: number; round: string }[] {
  return [...section1Intro.matchAll(/(\d+)~(\d+)(?:은|는) 라운드 ([0-9~]+)/g)].map((match) => ({
    start: Number(match[1]),
    end: Number(match[2]),
    round: match[3]
  }));
}

// ---------------------------------------------------------------------------

describe("체크표의 모양 (ⓑ 셀 경계 · 빈 칸)", () => {
  it("파싱이 실제로 표를 찾았다 (빈 스윕 금지)", () => {
    expect(tables.length).toBeGreaterThan(10);
    expect(checklistTables.length).toBeGreaterThan(10);
    expect(numberedRows.length).toBeGreaterThan(100);
  });

  it("모든 표의 모든 행이 그 표 헤더와 같은 셀 수다", () => {
    const broken = tables.flatMap((table) =>
      table.rows
        .filter((row) => row.cells.length !== table.header.length)
        .map(
          (row) =>
            `${CHECKLIST_PATH}:${row.line} — 행 "${row.cells[0]}"의 셀이 ${row.cells.length}칸인데 헤더는 ${table.header.length}칸(GFM은 초과 셀을 버린다 — 마지막 칸이 렌더에서 사라진다)`
        )
    );
    expect(broken).toEqual([]);
  });

  it("빈 셀이 0건이다", () => {
    const empty = tables.flatMap((table) =>
      table.rows.flatMap((row) =>
        row.cells
          .map((cell, index) => ({ cell, index }))
          .filter((entry) => entry.cell === "")
          .map(
            (entry) =>
              `${CHECKLIST_PATH}:${row.line} — "${table.header[entry.index] ?? entry.index}" 칸이 비었다`
          )
      )
    );
    expect(empty).toEqual([]);
  });

  it("체크표의 헤더는 두 모양뿐이다 (§1 넷 · §1-1 다섯)", () => {
    const shapes = new Set(checklistTables.map((table) => table.header.join(" | ")));
    expect([...shapes].sort()).toEqual([
      "# | 표면 | 확인 항목 | 기대 동작",
      "# | 표면 | 확인 항목 | 기대 동작 | 근거 파일"
    ]);
  });

  it("번호 행은 전부 체크표 안에 있다 (다른 표에 숨은 번호 0건)", () => {
    const strays = numberedRows
      .filter((row) => !checklistTables.includes(row.table))
      .map((row) => `${CHECKLIST_PATH}:${row.line}`);
    expect(strays).toEqual([]);
  });
});

describe("행 번호 (ⓓ 열 개 문서가 이 번호로 서로를 가리킨다)", () => {
  it("1..N이 연속이고 중복이 0건이다", () => {
    const numbers = numberedRows.map((row) => Number(row.cells[0]));
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, index) => index + 1));
  });

  it("행이 파일 안에서 번호 순으로 서 있다", () => {
    const linesInOrder = numberedRows.map((row) => row.line);
    expect(linesInOrder).toEqual([...linesInOrder].sort((a, b) => a - b));
  });
});

describe("표면 칸 (ⓒ 전수)", () => {
  it("모든 행의 표면 값이 넷 중 하나다", () => {
    const unknown = numberedRows
      .filter((row) => !(SURFACES as readonly string[]).includes(surfaceOf(row)))
      .map((row) => `${CHECKLIST_PATH}:${row.line} — #${row.cells[0]}의 표면 "${row.cells[1]}"`);
    expect(unknown).toEqual([]);
  });

  it("표면 값은 백틱으로 감싼 그 넷이다 (표기가 갈리지 않는다)", () => {
    const written = new Set(numberedRows.map((row) => row.cells[1]));
    expect([...written].sort()).toEqual(SURFACES.map((surface) => `\`${surface}\``).sort());
  });

  it("넷의 합이 전체 행 수와 같다 (§0이 산문으로 선언한 전수 확인)", () => {
    const sum = SURFACES.reduce((total, surface) => total + countBySurface(surface), 0);
    expect(sum).toBe(numberedRows.length);
  });
});

describe("§0의 수치는 파싱에서 파생된다 (ⓐ 손으로 적은 숫자 0건)", () => {
  it("§0 표의 표면 넷이 §0이 선언한 그 넷이고 순서도 같다", () => {
    expect(declaredSurfaceCounts().map((entry) => entry.surface)).toEqual([...SURFACES]);
  });

  it("§0 표의 표면별 행 수가 실제 행 수와 같다", () => {
    const mismatched = declaredSurfaceCounts()
      .filter((entry) => entry.count !== countBySurface(entry.surface as Surface))
      .map(
        (entry) =>
          `${entry.surface}: §0은 ${entry.count}이라고 적었는데 표에는 ${countBySurface(entry.surface as Surface)}행이 있다`
      );
    expect(mismatched).toEqual([]);
  });

  it("§0 표의 합계가 전체 행 수와 같고, `뜻` 칸의 §1·§1-1 두 수도 같다", () => {
    const declared = declaredTotals();
    expect(declared.total).toBe(numberedRows.length);
    expect(declared.section1).toBe(section1Rows.length);
    expect(declared.section11).toBe(section11Rows.length);
    expect(declared.section1 + declared.section11).toBe(declared.total);
  });

  it("셸 블록 주석 ①의 네 수가 실제 표면별 행 수와 같다", () => {
    expect(commentNumbers("①")).toEqual(SURFACES.map((surface) => countBySurface(surface)));
  });

  it("셸 블록 주석 ②·③의 수가 실제 합계·§1 행 수와 같다", () => {
    expect(commentNumbers("②")).toEqual([numberedRows.length]);
    expect(commentNumbers("③")).toEqual([section1Rows.length]);
  });

  it("셸 블록의 표면 순회 목록이 표면 넷과 같은 순서다", () => {
    const forLine = /for s in ([^;]+);/.exec(shellBlock());
    expect(forLine, "셸 블록의 `for s in …` 줄을 찾지 못했어요").toBeTruthy();
    expect(forLine![1].trim().split(/\s+/)).toEqual([...SURFACES]);
  });

  it("사람이 손으로 확인하는 근거 셋이 그대로 남아 있다 (삭제 금지)", () => {
    const block = shellBlock();
    expect(block).toContain("grep -cE");
    expect(block).toContain("awk '/^## 1\\. /,/^### 1-1\\./'");
    expect(block).toContain(CHECKLIST_PATH);
  });

  it("§0이 이 계약을 이름으로 가리킨다 (두 방언이 각자 무엇을 하는지 값으로 남는다)", () => {
    expect(section0).toContain("runtime-checklist-shape.test.ts");
  });
});

describe("§1-1 머리말의 라운드 구간 (ⓔ 신설분 편입)", () => {
  it("머리말이 적은 항목 수가 §1-1의 실제 행 수와 같다", () => {
    const declared = /아래 (\d+)개 항목/.exec(section1Intro);
    expect(declared, "§1-1 머리말에서 '아래 N개 항목'을 찾지 못했어요").toBeTruthy();
    expect(Number(declared![1])).toBe(section11Rows.length);
  });

  it("라운드 구간이 §1-1의 모든 행을 빠짐없이 한 번씩 덮는다", () => {
    const ranges = declaredRoundRanges();
    expect(ranges.length).toBeGreaterThan(10);

    const numbers = section11Rows.map((row) => Number(row.cells[0]));
    expect(ranges[0].start).toBe(Math.min(...numbers));
    expect(ranges[ranges.length - 1].end).toBe(Math.max(...numbers));

    const gaps = ranges
      .slice(1)
      .map((range, index) => ({ previous: ranges[index], range }))
      .filter((entry) => entry.range.start !== entry.previous.end + 1)
      .map(
        (entry) =>
          `라운드 ${entry.previous.round}(${entry.previous.start}~${entry.previous.end}) 다음이 ${entry.range.start}부터다`
      );
    expect(gaps).toEqual([]);

    const covered = ranges.reduce((total, range) => total + (range.end - range.start + 1), 0);
    expect(covered).toBe(section11Rows.length);
  });

  it("마지막 구간이 이번 라운드 신설분이고, 그 행들이 실제로 표에 있다", () => {
    const ranges = declaredRoundRanges();
    const last = ranges[ranges.length - 1];
    // ⚠️ 이 파일에서 **라운드마다 사람이 갱신하는 유일한 값**이다(라운드 종료 트립와이어) —
    // 나머지 수치는 전부 파싱으로 파생된다. 다음 라운드가 행을 더하고 이 줄을 안 고치면 여기가 빨개진다.
    expect(last.round).toBe("75");

    const rows = section11Rows.filter((row) => {
      const number = Number(row.cells[0]);
      return number >= last.start && number <= last.end;
    });
    expect(rows.length).toBe(last.end - last.start + 1);
    for (const row of rows) {
      expect((SURFACES as readonly string[]).includes(surfaceOf(row))).toBe(true);
      expect(row.cells[2], `#${row.cells[0]}의 확인 항목이 트랙을 이름으로 적는다`).toContain("트랙");
    }
  });
});
