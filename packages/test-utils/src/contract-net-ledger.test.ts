// 라운드 90 트랙 E (round90-scout #5) — **계약 그물의 목록이 두 자리에서 갈리지 않는다.**
//
// ## ⚠️⚠️ 이 파일은 새 그물이 아니라 *세는 자*다 — 그물 수는 오늘도 열다섯
//
// 라운드 88 트랙 C가 `comment-tolerant-anchor-ledger.ts`를 세우며 **열넷째**라고 적었고,
// 라운드 89 트랙 D가 `resume-condition-ledger.ts`를 세우며 **열다섯째**라고 적었다. 두 대장은
// 각각 자기 앞의 그물 목록을 `CONTRACT_NETS_BEFORE_THIS_ONE`으로, 자기까지의 수를
// `CONTRACT_NET_COUNT_WITH_THIS_ONE`으로 **손으로** 들고 있다. 그 두 목록이 서로 맞는지를 세는
// 계약은 오늘까지 **0건**이었다 — AB-4가 이름 붙인 병(*"손으로 적은 목록"*)이 **한 겹 위에서**,
// 그러니까 *그물을 세는 자리 자신에게서* 다시 난 모양이다.
//
// 이 파일은 그 정합만 센다. **제품도 문서도 지키지 않고, 새 축을 얹지도 않는다** — 그래서
// **오늘의 그물 수는 열다섯 그대로이고**, *"계약 그물을 둘 이상 함께 여는 트랙은 0건"* 이라는
// 이 라운드의 교차 확인도 이 트랙에서 그대로 참이다. 라운드 89 트랙 E가
// `accessibility-checklist-shape.test.ts`를 **짝 계약**으로 놓으며 머리말에 같은 사실을 값으로
// 적은 그 자리와 같다.
//
// ⚠️ **그래서 이 파일은 두 이름을 export하지 않는다.** 지니는 순간 자기 자신을 그물로 세게 되고
// (라운드 84 B·85 E·88 C·89 D의 **자기 배제** 규율), 열다섯이 조용히 열여섯이 된다. 그 배제는
// 산문이 아니라 계약이다 — 아래 "이 그물의 자리"가 **자기 소스를 읽어** 확인한다.
//
// ## ⚠️ 손 목록을 하나 더 만들지 않는다 — 모집단은 전수 파생이다
//
// 이 계약이 고치려는 병이 정확히 *손으로 적은 목록*이므로, 여기에 세 번째 손 목록을 두면
// 병을 옮겨 적는 것이 된다. 모집단은 `packages/**`·`apps/**`를 걸어
// **`CONTRACT_NETS_BEFORE_THIS_ONE`을 export하는 파일 전수**에서 나온다(오늘 **둘** ·
// 걸은 파일 **906** = packages 46 + apps 860). 값은 소스에서 파싱하지 않고 **그 모듈을 실제로
// 불러** 읽는다 — 손으로 적힌 것을 무는 계약이 다시 텍스트만 보면 같은 자리에서 속는다.
//
// ⚠️ **유령 방지가 먼저다.** 그 수가 0이거나 하나면 이 계약은 아무것도 지키지 않는다 — 그래서
// 걸은 파일 수·모집단 수 둘 다 하한을 지고, 하한 아래면 **정합을 세기 전에** 빨개진다.
//
// ## ⚠️⚠️ 두 대장을 고치지 않는다 · 상한도 전수 일치도 묻지 않는다
//
// 두 대장은 각각 저장소 그물이고 이 트랙은 **어느 그물도 열지 않는다**(둘 다 읽기만 · 바이트
// 불변). 그리고 그물은 라운드마다 늘 수 있으므로 이 계약은 **하한만** 묻는다 —
// *"오늘 열다섯"* 을 등호로 물면 **열여섯째 그물을 세우는 트랙이 이 계약을 맞추게 되고**, 그
// 순간 세는 자가 세어지는 것을 막는 자가 된다(라운드 89 트랙 D가 `NOTATION_RATCHET`에 박아 둔
// 그 규율 그대로).
//
// 이 파일이 묻는 것은 여섯이다.
//  ⓐ **모집단** — 그 이름을 export하는 파일을 **전수로** 찾는다(오늘 둘 · 유령 방지 하한).
//  ⓑ **접두** — 짧은 목록이 긴 목록의 **접두**인가(**뒤처지는 것은 허용하되 갈라지는 것은 허용하지
//     않는다** — 라운드 89 E의 ⓑ와 같은 모양).
//  ⓒ **자기 수** — 각 파일의 `CONTRACT_NET_COUNT_WITH_THIS_ONE`이 **자기 목록 길이 + 1**인가.
//  ⓓ **오늘의 그물 수** — 가장 긴 목록의 길이 + 1이 오늘의 그물 수이고, 그 수가 **줄지 않는가**
//     (하한 래칫 · **상한 없음**).
//  ⓔ **이름의 유일성** — 한 목록 안에 같은 이름이 두 번 서지 않는가.
//  ⓕ **사각** — 이 그물이 못 보는 것을 값과 하한으로 적는다(+ 재개 조건을 자기 축과 함께).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

/** 이 파일의 저장소 상대 경로 — 자기 배제를 계약으로 확인하는 데 쓴다. */
const SELF_PATH = "packages/test-utils/src/contract-net-ledger.test.ts";

/**
 * 오늘의 두 대장 — ⚠️ **모집단이 아니다.** 모집단은 전수 파생이고, 이 둘은 *"파생 결과가 오늘
 * 이것이더라"* 를 사람에게 보여 주는 값이자 **두 그물이 오늘도 실재한다**는 유령 방지의 근거다.
 */
const KNOWN_LEDGERS_TODAY = [
  "packages/test-utils/src/comment-tolerant-anchor-ledger.ts",
  "packages/test-utils/src/resume-condition-ledger.ts"
] as const;

/** 목록 export의 이름 — 바늘을 **값으로** 적는다. */
const LIST_EXPORT_NAME = "CONTRACT_NETS_BEFORE_THIS_ONE";
/** 자기 수 export의 이름. */
const COUNT_EXPORT_NAME = "CONTRACT_NET_COUNT_WITH_THIS_ONE";

/**
 * 모집단 바늘 — **줄머리의 `export const <이름>`만** 문다.
 *
 * ⚠️ 주석·문자열에서 이름을 부르는 자리는 모집단이 아니다. 그래서 이 파일 자신도(이름을 값으로
 * 여러 번 적지만) 모집단에 들지 않는다 — 그 사실은 산문이 아니라 아래 계약이 확인한다.
 */
function exportNeedle(name: string): RegExp {
  return new RegExp(`^export const ${name}\\b`, "m");
}

// ---------------------------------------------------------------------------
// 뿌리 — `packages/**` · `apps/**` 전수 걷기 (셸 0건)
// ---------------------------------------------------------------------------

const SCAN_ROOTS = ["packages", "apps"] as const;

/** 산출물·의존성 대역 — 소스가 아니라 사본이라 걷지 않는다. */
const SKIP_DIRS = new Set([
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
]);

type ScannedFile = { readonly path: string; readonly root: string; readonly source: string };

function walk(absDir: string, relDir: string, root: string, out: ScannedFile[]): void {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(absDir, entry.name), `${relDir}/${entry.name}`, root, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const path = `${relDir}/${entry.name}`;
    out.push({ path, root, source: readFileSync(join(absDir, entry.name), "utf8") });
  }
}

const scanned: ScannedFile[] = [];
for (const root of SCAN_ROOTS) {
  walk(join(repoRoot, root), root, root, scanned);
}

/** 오늘 906(= packages 46 + apps 860). 하한만 값으로 진다. */
const SCANNED_FLOOR = 700;
/** apps 뿌리만의 하한 — 오늘 860. 그 뿌리에서 나온 자리가 0건이라는 사실이 사각에 적혀 있다. */
const SCANNED_APPS_FLOOR = 700;

const netFiles = scanned.filter((file) => exportNeedle(LIST_EXPORT_NAME).test(file.source));

// ---------------------------------------------------------------------------
// 값은 소스가 아니라 **모듈에서** 읽는다
// ---------------------------------------------------------------------------

type NetLedger = {
  readonly path: string;
  /** 실제로 불러 읽은 목록. */
  readonly nets: readonly string[];
  /** 실제로 불러 읽은 자기 수. */
  readonly count: number;
  /** 소스에서 **문자열 리터럴로** 적힌 항목 수 — 사각(`손-목록`)의 측정치다. */
  readonly literalEntries: number;
};

/**
 * 목록의 배열 리터럴에서 **문자열 리터럴 항목 수**를 센다.
 *
 * ⚠️ 이것으로 목록을 만들지 않는다(그러면 텍스트만 보는 계약이 된다). 이 수가 세는 것은 오직
 * *"이 목록이 오늘도 손으로 적혀 있는가"* 이고, 어느 대장이 목록을 소스에서 파생시키는 날 이
 * 수가 떨어져 사각 하한이 먼저 빨개진다 — 그것이 재개 조건의 도래 신호다.
 */
function countLiteralEntries(source: string): number {
  const start = source.search(new RegExp(`^export const ${LIST_EXPORT_NAME}\\s*=\\s*\\[`, "m"));
  if (start === -1) return 0;
  const end = source.indexOf("]", start);
  if (end === -1) return 0;
  return [...source.slice(start, end).matchAll(/"[^"\n]+"/g)].length;
}

async function loadLedger(file: ScannedFile): Promise<NetLedger> {
  const href = pathToFileURL(join(repoRoot, ...file.path.split("/"))).href;
  const module = (await import(/* @vite-ignore */ href)) as Record<string, unknown>;

  const nets = module[LIST_EXPORT_NAME];
  expect(Array.isArray(nets), `${file.path}의 ${LIST_EXPORT_NAME}이 배열이 아니에요`).toBe(true);
  const list = nets as readonly unknown[];
  for (const name of list) {
    expect(typeof name, `${file.path}의 ${LIST_EXPORT_NAME}에 문자열이 아닌 항목이 있어요`).toBe(
      "string"
    );
  }

  const count = module[COUNT_EXPORT_NAME];
  expect(
    typeof count,
    `${file.path}가 ${LIST_EXPORT_NAME}을 들면서 ${COUNT_EXPORT_NAME}을 수로 들지 않았어요`
  ).toBe("number");

  return {
    path: file.path,
    nets: list as readonly string[],
    count: count as number,
    literalEntries: countLiteralEntries(file.source)
  };
}

const ledgers: NetLedger[] = [];
for (const file of netFiles) {
  ledgers.push(await loadLedger(file));
}

/** 길이 오름차순 — 접두 판정과 "가장 긴 목록"이 여기서 나온다. */
const byLength = [...ledgers].sort((left, right) => left.nets.length - right.nets.length);
const longest = byLength[byLength.length - 1];

// ---------------------------------------------------------------------------
// 래칫 — **하한만.** 상한도 전수 일치도 없다.
// ---------------------------------------------------------------------------

/**
 * 이 세는 자가 설 때의 그물 수 — **열다섯**(가장 긴 목록 열넷 + 1).
 *
 * ⚠️ **등호로 묻지 않는다.** 열여섯째 그물이 서는 날 이 수는 열여섯이 되어야 하고, 그날 이
 * 계약은 **초록이어야 한다** — 상한을 물면 그 트랙이 이 파일을 고치게 된다.
 */
const NET_COUNT_WHEN_THIS_COUNTER_WAS_BUILT = 15;

/** 오늘 실측 — 값으로만 적는다(계약이 무는 것은 위 하한뿐이다). */
const MEASURED_TODAY = {
  scannedFiles: 906,
  netFiles: 2,
  listLengths: [13, 14],
  netCount: 15,
  handWrittenNames: 27,
  selfDeclaringMarkers: 0
} as const;

const selfSource = readFileSync(join(repoRoot, ...SELF_PATH.split("/")), "utf8");

// ---------------------------------------------------------------------------
// ⓐ 모집단
// ---------------------------------------------------------------------------

describe("ⓐ 모집단 — 그 이름을 export하는 파일 전수 (손 목록 0건)", () => {
  it("걷기가 살아 있다 (유령 방지: 뿌리가 통째로 빈 채 초록이 되지 않는다)", () => {
    expect(
      scanned.length,
      `packages/**·apps/**에서 걸린 소스가 ${scanned.length}건뿐이에요 — 걷기가 깨졌어요`
    ).toBeGreaterThanOrEqual(SCANNED_FLOOR);
    expect(scanned.filter((file) => file.root === "apps").length).toBeGreaterThanOrEqual(
      SCANNED_APPS_FLOOR
    );
    expect(scanned.filter((file) => file.root === "packages").length).toBeGreaterThan(0);
  });

  it("⚠️ 모집단이 둘 이상이다 — 0이거나 하나면 이 계약은 아무것도 지키지 않는다", () => {
    expect(
      netFiles.length,
      `${LIST_EXPORT_NAME}을 export하는 파일이 ${netFiles.length}건이에요 — ` +
        "둘 미만이면 '두 자리에서 갈리지 않는다'가 셀 대상이 없어 이 그물이 유령이 돼요"
    ).toBeGreaterThanOrEqual(2);
  });

  it("오늘 파생된 자리가 두 대장을 빠짐없이 덮는다", () => {
    const paths = netFiles.map((file) => file.path);
    for (const known of KNOWN_LEDGERS_TODAY) {
      expect(paths, `${known}가 모집단에서 빠졌어요 — 그 대장이 목록을 놓았나요?`).toContain(known);
    }
  });

  it("모든 자리가 목록과 자기 수를 함께 든다", () => {
    for (const ledger of ledgers) {
      expect(ledger.nets.length, `${ledger.path}의 목록이 비었어요`).toBeGreaterThan(0);
      expect(Number.isInteger(ledger.count), `${ledger.path}의 자기 수가 정수가 아니에요`).toBe(
        true
      );
      for (const name of ledger.nets) {
        expect(name.trim().length, `${ledger.path}에 빈 이름이 있어요`).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ⓑ 접두
// ---------------------------------------------------------------------------

describe("ⓑ 접두 — 뒤처지는 것은 허용하되 갈라지는 것은 허용하지 않는다", () => {
  it("짧은 목록이 긴 목록의 접두다", () => {
    for (const ledger of ledgers) {
      if (ledger.path === longest.path) continue;
      expect(
        longest.nets.slice(0, ledger.nets.length),
        `${ledger.path}의 목록이 ${longest.path}의 접두가 아니에요 — ` +
          "뒤처진 게 아니라 **갈렸어요**. 두 목록이 서로 다른 그물을 말하고 있어요"
      ).toEqual([...ledger.nets]);
    }
  });

  it("어느 두 목록을 짝지어도 짧은 쪽이 긴 쪽의 접두다 (셋째 자리가 서는 날을 위해)", () => {
    for (const left of ledgers) {
      for (const right of ledgers) {
        if (left.path === right.path) continue;
        const [shorter, taller] =
          left.nets.length <= right.nets.length ? [left, right] : [right, left];
        expect(
          taller.nets.slice(0, shorter.nets.length),
          `${shorter.path} ↔ ${taller.path}가 갈려요`
        ).toEqual([...shorter.nets]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ⓒ 자기 수
// ---------------------------------------------------------------------------

describe("ⓒ 자기 수 — 목록 길이 + 1", () => {
  it("각 파일의 자기 수가 자기 목록 길이 + 1이다", () => {
    for (const ledger of ledgers) {
      expect(
        ledger.count,
        `${ledger.path}의 ${COUNT_EXPORT_NAME}(${ledger.count})이 ` +
          `자기 목록 길이 ${ledger.nets.length} + 1과 달라요`
      ).toBe(ledger.nets.length + 1);
    }
  });

  it("뒤처진 대장의 자기 수는 오늘의 그물 수보다 작거나 같다", () => {
    // 접두(ⓑ)에서 따라 나오는 사실이지만, 갈림이 아니라 **수**로도 한 번 더 보인다.
    const today = longest.nets.length + 1;
    for (const ledger of ledgers) {
      expect(ledger.count, `${ledger.path}의 자기 수가 오늘의 그물 수를 넘어요`).toBeLessThanOrEqual(
        today
      );
    }
  });
});

// ---------------------------------------------------------------------------
// ⓓ 오늘의 그물 수 — 하한 래칫
// ---------------------------------------------------------------------------

describe("ⓓ 오늘의 그물 수 — 줄지 않는다 (⚠️ 상한도 전수 일치도 묻지 않는다)", () => {
  it("가장 긴 목록의 길이 + 1이 오늘의 그물 수이고, 그 수가 줄지 않았다", () => {
    const today = longest.nets.length + 1;
    expect(
      today,
      `오늘의 그물 수가 ${today}로 ${NET_COUNT_WHEN_THIS_COUNTER_WAS_BUILT} 아래로 내려갔어요 — ` +
        "그물이 사라졌다면 그 사실을 값으로 적고 하한을 내리세요"
    ).toBeGreaterThanOrEqual(NET_COUNT_WHEN_THIS_COUNTER_WAS_BUILT);
  });

  it("가장 긴 목록이 하나로 정해진다 (같은 길이 둘이면 접두라 내용도 같다)", () => {
    const tallest = ledgers.filter((ledger) => ledger.nets.length === longest.nets.length);
    for (const ledger of tallest) {
      expect(ledger.nets, `${ledger.path}와 ${longest.path}가 같은 길이인데 내용이 달라요`).toEqual([
        ...longest.nets
      ]);
    }
  });
});

// ---------------------------------------------------------------------------
// ⓔ 이름의 유일성
// ---------------------------------------------------------------------------

describe("ⓔ 이름의 유일성 — 한 목록 안에 같은 이름이 두 번 서지 않는다", () => {
  it("목록마다 중복 0건", () => {
    for (const ledger of ledgers) {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const name of ledger.nets) {
        if (seen.has(name)) duplicates.push(name);
        seen.add(name);
      }
      expect(duplicates, `${ledger.path}에 같은 이름이 두 번 서 있어요`).toEqual([]);
      expect(seen.size).toBe(ledger.nets.length);
    }
  });
});

// ---------------------------------------------------------------------------
// ⓕ 사각
// ---------------------------------------------------------------------------

/**
 * 그물 파일이 **자기를 이름으로 선언하는 표식** — 오늘 0건.
 *
 * 바늘: 걸린 소스 어디든 `export const <무엇> = "<목록에 적힌 이름>"`. 이름 관례를 앞질러
 * 정하지 않으려고 **이름이 아니라 값**으로 문다 — 어느 그물이 어떤 상수명을 고르든, 자기 이름을
 * 문자열로 선언하는 순간 여기 걸린다.
 */
const selfDeclaringMarkers = (() => {
  const names = new Set(ledgers.flatMap((ledger) => ledger.nets));
  const hits: string[] = [];
  for (const file of scanned) {
    for (const name of names) {
      if (new RegExp(`^export const \\w+(?:\\s*:[^=\\n]+)?\\s*=\\s*"${name}"`, "m").test(file.source)) {
        hits.push(`${file.path} → ${name}`);
        break;
      }
    }
  }
  return hits;
})();

/** 오늘 어느 소스도 자기를 그물 이름으로 선언하지 않는다 → 열넷 전부가 실재 미확인이다. */
const unresolvedNames = longest.nets.filter(
  (name) => !selfDeclaringMarkers.some((hit) => hit.endsWith(`→ ${name}`))
);

const handWrittenNames = ledgers.reduce((sum, ledger) => sum + ledger.literalEntries, 0);

describe("ⓕ 사각 — 이 그물이 못 보는 것을 값과 하한으로 적는다", () => {
  const BLIND_SPOTS = [
    {
      id: "실재-미확인",
      statement:
        "이 계약이 세는 것은 **목록끼리의 정합**이지 **그 이름이 가리키는 그물이 실재하는가**가 " +
        "아니다 — 오늘 열넷 중 저장소에서 자기 이름으로 풀리는 것은 0건이고, 그래서 목록이 " +
        "이미 사라진 그물을 부르고 있어도 이 그물은 초록이다.",
      /** 실재로 풀리지 않는 이름 수 — 오늘 열넷(=전부). 표식이 서면 이 수가 줄고 하한이 먼저 빨개진다. */
      floor: 14,
      measure: () => unresolvedNames.length
    },
    {
      id: "손-목록",
      statement:
        "이름은 소스에서 파생하지 않고 **손으로 적힌다** — 오늘 두 목록의 스물일곱 항목이 전부 " +
        "문자열 리터럴이고, **그물 파일이 자기를 이름으로 선언하는 표식은 0건**이다. 그래서 이 " +
        "계약은 손 목록끼리의 정합만 지킬 수 있고, 손이 두 자리에서 *같은 방식으로* 틀리면 못 본다.",
      /** 손으로 적힌 항목 수(오늘 스물일곱). 목록이 파생으로 바뀌는 날 이 수가 떨어진다. */
      floor: 27,
      measure: () => handWrittenNames
    },
    {
      id: "apps-뿌리-0건",
      statement:
        "모집단 걷기는 `apps/**`도 전수로 걷지만(오늘 860) 그 뿌리에서 나온 자리는 **0건**이다 — " +
        "오늘 그물 목록은 `packages/test-utils/src` 둘뿐이라, 걷기의 대부분이 아직 아무것도 " +
        "지키지 않는다. 뿌리를 좁히지 않는 이유는 그물이 앱 쪽에 설 수 있기 때문이다.",
      /** apps 아래에서 걸린 소스 수(오늘 860). */
      floor: SCANNED_APPS_FLOOR,
      measure: () => scanned.filter((file) => file.root === "apps").length
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
        `${spot.id} 사각을 다시 재니 하한(${spot.floor}) 아래예요 — ` +
          "사각이 사라졌다면 그 줄을 지우고, 좁아졌다면 하한을 내리세요"
      ).toBeGreaterThanOrEqual(spot.floor);
    });
  }

  it("⚠️ 재개 조건이 아직 도래하지 않았다 — 자기 선언 표식 0건 (값)", () => {
    // 이 수가 0을 넘는 날이 곧 아래 재개 조건의 도래다. 그날 이 대장의 목록은 손이 아니라
    // 소스에서 나와야 하고, 이 파일이 그 파생을 맡는다.
    expect(
      selfDeclaringMarkers,
      "그물 파일이 자기를 이름으로 선언하기 시작했어요 — 재개 조건이 도래했으니 " +
        "이 계약의 목록을 손 목록 대조가 아니라 소스 파생으로 다시 세우세요"
    ).toEqual([]);
    expect(MEASURED_TODAY.selfDeclaringMarkers).toBe(0);
  });

  it("재개 조건이 자기 축과 함께 이 파일에 적혀 있다 (AA-3 표기 관례)", () => {
    // ⚠️ 재개 조건(결정형 · 손은 저장소 안): **그물 파일이 자기를 이름으로 선언하는 표식을
    // 세울지 정하는 날** — 그날 이 목록은 손이 아니라 소스에서 나온다.
    //   · 자기 축: 이 계약의 축은 **목록끼리의 정합**(접두 · 자기 수 · 유일성 · 하한 래칫)이고,
    //     그 축은 표식이 서는 날 **실재 대조**로 넓어진다 — 축이 바뀌는 것이 아니라 모집단이
    //     손에서 소스로 옮겨 가는 것이다.
    expect(selfSource).toContain("재개 조건(결정형 · 손은 저장소 안)");
    expect(selfSource).toContain("그날 이 목록은 손이 아니라 소스에서 나온다");
    expect(selfSource).toContain("자기 축");
  });
});

// ---------------------------------------------------------------------------
// 이 그물의 자리 — 세는 자이지 그물이 아니다
// ---------------------------------------------------------------------------

describe("이 그물의 자리 — 세는 자는 자기를 세지 않는다", () => {
  it("이 파일은 두 이름을 export하지 않는다 (자기 배제)", () => {
    expect(
      exportNeedle(LIST_EXPORT_NAME).test(selfSource),
      `이 파일이 ${LIST_EXPORT_NAME}을 export하면 자기 자신을 그물로 세게 돼요`
    ).toBe(false);
    expect(
      exportNeedle(COUNT_EXPORT_NAME).test(selfSource),
      `이 파일이 ${COUNT_EXPORT_NAME}을 export하면 열다섯이 조용히 열여섯이 돼요`
    ).toBe(false);
  });

  it("그래서 모집단에 자기가 없다", () => {
    expect(netFiles.map((file) => file.path)).not.toContain(SELF_PATH);
  });

  it("머리말이 '그물 수는 오늘도 열다섯'을 값으로 적는다", () => {
    expect(selfSource).toContain("그물 수는 오늘도 열다섯");
    expect(NET_COUNT_WHEN_THIS_COUNTER_WAS_BUILT).toBe(15);
    // ⚠️ 실측은 하한으로만 문다 — 열여섯째 그물이 서는 날 이 줄이 빨개지면 안 된다.
    expect(longest.nets.length + 1).toBeGreaterThanOrEqual(MEASURED_TODAY.netCount);
  });

  it("두 대장은 이 트랙이 열지 않는다 — 목록 export가 이 파일 밖에만 산다", () => {
    // 이 파일이 그물을 여는 파일이라면 자기 소스에 목록이 있어야 한다. 없다는 것이
    // *"계약 그물을 둘 이상 함께 여는 트랙 0건"* 이 이 트랙에서도 참이라는 값이다.
    expect(netFiles.every((file) => file.path !== SELF_PATH)).toBe(true);
    // ⚠️ 여기서도 하한만 — 목록을 든 파일이 셋이 되는 날은 이 계약이 더 세는 날이지 빨간 날이 아니다.
    expect(netFiles.length).toBeGreaterThanOrEqual(MEASURED_TODAY.netFiles);
  });
});
