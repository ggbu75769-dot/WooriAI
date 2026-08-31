import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 89 트랙 B — **어드민의 표가 이름을 갖는다, 그리고 그 규율이 모집단을 얻는다.**
 *
 * 라운드 88 트랙 A가 두 화면의 추이 표에 `aria-label`을 세웠지만, 그 단언은 추이 카드
 * **둘**만 돌았다. 그래서 어제까지 어드민의 표 열일곱 중 이름을 가진 것은 그 둘뿐이었고,
 * 나머지 열다섯은 스크린리더에서 "표, 7열 40행"으로만 불렸다 — 어느 표인지 말해주는 자리가
 * 없었다. 이 파일은 그 자리를 **모집단으로** 만든다.
 *
 * ⚠️⚠️ **이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다.**
 *
 * 저장소에는 앱 경계를 넘어 도는 그물들이 있다(모바일·어드민·API를 함께 걷는 열넷/열다섯
 * 목록). **이 파일은 그 하나가 아니다.** 이 스윕이 걷는 것은 아래 `SWEEP_ROOT` 하나 —
 * `apps/admin/app/**` 뿐이다. 그 사실을 주석이 아니라 **값**으로 두는 이유는, 다음 라운드에
 * 누군가 이 파일을 "어드민 표 그물"에서 "저장소 표 그물"로 넓히려 할 때 넓히는 손이
 * `SWEEP_ROOT`를 고치며 지나가게 하기 위해서다. 주석은 조용히 거짓이 되지만 값은 빨개진다.
 *
 * ⚠️ 이 스윕이 **모바일·API·`packages/**`의 표를 세지 않는다**는 것은 사각이 아니라 범위다:
 * 모바일에는 `<table`이 없고(React Native), 어드민만이 HTML 표를 그린다.
 */
const SWEEP_ROOT = "app" as const;

/** 이 스윕이 걷는 앱 경계. `apps/admin/` 밖으로는 한 걸음도 나가지 않는다. */
const SWEEP_SCOPE_LABEL = "apps/admin/app/**" as const;

const adminRoot = process.cwd();

/**
 * ⓔ 래칫 — 이름을 가진 표의 수는 줄지 않는다.
 *
 * 라운드 89 트랙 B가 다시 세어 확정한 수(정찰의 grep 하한과 같았다): 표 열일곱.
 */
const MIN_TABLES = 17;

/**
 * 화면이 문자열을 손으로 적은 표 이름의 수(= 아래 대장의 길이). 라운드 88의 둘 + 라운드 89의 여섯.
 *
 * ⚠️ **정찰의 예상보다 늘었다** — 정찰은 "h2가 표의 이름이 될 수 없는 자리만"으로 잡았고,
 * 그 자리는 셋(추이 카드 둘 + 검토 상세의 값 비교 표)일 것으로 봤다. 실제로 재실측하니
 * **여섯**이었다: 검토 화면 셋과 분석의 KPI 퍼널이 더 붙었는데, 이유는 a11y가 아니라
 * **읽기 계약의 바이트 앵커**다(아래 대장의 `why`가 그 자리를 각각 이름으로 적는다).
 * 이 트랙이 그 계약들을 고치지 않는 것이 조항이므로, 화면이 이름을 짓는 쪽으로 갈렸다.
 */
const MIN_SCREEN_AUTHORED_NAMES = 8;

function listSweptFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        out.push(relative(adminRoot, full).split(sep).join("/"));
      }
    }
  };
  walk(join(adminRoot, SWEEP_ROOT));
  return out.sort();
}

function read(relativePath: string): string {
  return readFileSync(join(adminRoot, relativePath), "utf8");
}

type OpenTag = { tag: string; attrs: string; index: number };

/**
 * 열린 태그를 전수로 뽑는다. 속성 안에 `<`·`>`가 없는 태그만 잡히는데, 이 파일이 보는
 * `<table`·`<h2`·`role="img"` 세 자리는 모두 그 모양이다(화살표 함수가 들어가는 자리가 아니다).
 */
function openTags(source: string): OpenTag[] {
  const out: OpenTag[] = [];
  const re = /<([A-Za-z][A-Za-z0-9.]*)([^<>]*?)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    out.push({ tag: match[1], attrs: match[2], index: match.index });
  }
  return out;
}

/** `${...}` 자리를 `…` 한 글자로 접고 공백을 고른다 — 대장이 읽히는 모양을 위해서. */
function foldExpressions(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "$" && text[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < text.length && depth > 0) {
        if (text[i] === "{") depth += 1;
        else if (text[i] === "}") depth -= 1;
        i += 1;
      }
      i -= 1;
      out += "…";
      continue;
    }
    out += text[i];
  }
  return out.replace(/\s+/g, " ").trim();
}

/** JSX 자식에서 `{...}` 표현식을 접고 글자만 남긴다(h2 안쪽 글자를 읽을 때). */
function foldJsxChildren(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "{") {
      let depth = 1;
      i += 1;
      while (i < text.length && depth > 0) {
        if (text[i] === "{") depth += 1;
        else if (text[i] === "}") depth -= 1;
        i += 1;
      }
      i -= 1;
      out += "…";
      continue;
    }
    out += text[i];
  }
  return out.replace(/<[^<>]*>/g, "").replace(/\s+/g, " ").trim();
}

type Heading = { id: string | null; text: string };

function headings(source: string): Heading[] {
  const out: Heading[] = [];
  const re = /<h2([^<>]*?)>([\s\S]*?)<\/h2>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const id = /\sid="([^"]+)"/.exec(match[1]);
    out.push({ id: id ? id[1] : null, text: foldJsxChildren(match[2]) });
  }
  return out;
}

type Named = {
  file: string;
  index: number;
  kind: "labelledby" | "label";
  /** `aria-labelledby`가 가리키는 id (label이면 null). */
  ref: string | null;
  /** 접근성 이름의 글자 — `${...}`는 `…`로 접힌다. */
  name: string;
};

function ariaNameOf(file: string, source: string, tag: OpenTag): Named | null {
  const labelledby = /aria-labelledby="([^"]+)"/.exec(tag.attrs);
  if (labelledby) {
    const target = headings(source).find((heading) => heading.id === labelledby[1]);
    return {
      file,
      index: tag.index,
      kind: "labelledby",
      ref: labelledby[1],
      name: target ? target.text : ""
    };
  }
  const templateLabel = /aria-label=\{`([^`]*)`\}/.exec(tag.attrs);
  if (templateLabel) {
    return { file, index: tag.index, kind: "label", ref: null, name: foldExpressions(templateLabel[1]) };
  }
  const stringLabel = /aria-label="([^"]*)"/.exec(tag.attrs);
  if (stringLabel) {
    return { file, index: tag.index, kind: "label", ref: null, name: stringLabel[1].replace(/\s+/g, " ").trim() };
  }
  return null;
}

/** 스윕이 세는 자리: 표 전부, 그리고 이름을 가진 그림(`role="img"` — 추이 카드의 막대 그래프). */
function tablesOf(source: string): OpenTag[] {
  return openTags(source).filter((tag) => tag.tag === "table");
}

function figuresOf(source: string): OpenTag[] {
  return openTags(source).filter((tag) => tag.tag !== "table" && /role="img"/.test(tag.attrs));
}

const SWEPT_FILES = listSweptFiles();
const SOURCES = new Map(SWEPT_FILES.map((file) => [file, read(file)] as const));

const ALL_TABLES = SWEPT_FILES.flatMap((file) =>
  tablesOf(SOURCES.get(file) as string).map((tag) => ({ file, tag }))
);

/**
 * ⓒ **화면이 지은 이름 대장** — h2에서 파생하지 못해 화면이 문자열을 적은 자리 전부.
 *
 * ⚠️ 각 항목의 `why`는 **왜 이 표에는 h2가 이름이 될 수 없는지**를 적는다. 빈 문자열 금지 —
 * 이유를 못 적겠으면 그 자리는 `aria-labelledby`로 돌려야 하는 자리다.
 */
const SCREEN_AUTHORED_NAMES: { file: string; name: string; why: string }[] = [
  {
    file: "app/analytics/page.tsx",
    name: "최근 …일 일별 이벤트 수 표",
    why:
      '카드의 h2("일별 추이")는 같은 카드의 막대 그림과 표를 **함께** 덮는 카드의 이름이다. ' +
      "라운드 88 트랙 A가 세운 관례대로 한 카드의 두 이름은 끝말로 갈린다(그림 \"막대 그래프\" · 표 \"표\")."
  },
  {
    file: "app/clicks/page.tsx",
    name: "최근 …일 일별 클릭 수 표",
    why:
      '카드의 h2("일별 추이 (최근 N일)")는 막대 그림과 표를 함께 덮는 카드의 이름이다. ' +
      "형제 화면(분석)과 같은 자리·같은 관례 — 라운드 88 트랙 A."
  },
  {
    file: "app/analytics/page.tsx",
    name: "KPI 퍼널 표",
    why:
      '이 표의 h2("KPI 퍼널")에는 id를 붙일 수 없다 — 읽기 계약 `src/admin-analytics.test.ts:353`이 ' +
      '`<h2>KPI 퍼널</h2>`를 **바이트로** 앵커해 카드 순서를 재고 있고, 속성이 하나라도 붙으면 그 계약이 ' +
      "먼저 빨개진다. 그 계약은 이 트랙의 읽기 전용 목록에 있으므로 고치지 않는다."
  },
  {
    file: "app/reviews/page.tsx",
    name: "검토 목록 표",
    why:
      '이 표의 h2("검토 목록")에는 id를 붙일 수 없다 — 읽기 계약 `src/lib/revision-rows.test.ts:317`이 ' +
      "이 화면의 `id=\"` 자리 수를 **셋**으로 못 박고 있다(폼 컨트롤 셋). 그 파일은 `apps/admin/src/lib/**`이라 " +
      "이 트랙의 변경 0건 구역이다."
  },
  {
    file: "app/reviews/page.tsx",
    name: "제출 값과 라이브 값 비교",
    why:
      '이 표에는 h2가 아예 없다. 카드의 h2("상세 보기 - …")는 표 **둘**(값 비교 · 이력)을 함께 담는 ' +
      "카드의 이름이라, 빌리면 두 표가 같은 이름으로 불린다. 같은 카드의 이력 표와 끝말로 갈린다(비교 / 표)."
  },
  {
    file: "app/reviews/page.tsx",
    name: "게시 이력 표",
    why:
      'h2("이력")는 이 표의 이름이 맞지만 id를 붙일 수 없다 — 위와 같은 `id="` 셋 계약 ' +
      "(`src/lib/revision-rows.test.ts:317`)이 이 화면 전체를 세기 때문이다."
  },
  {
    file: "app/users-lookup/page.tsx",
    name: "… 계정 정보",
    why:
      "이 표의 h2({userDisplayLabel(user)})는 조회 결과 map **안**에 있어 사용자 수만큼 반복된다 — " +
      "id를 붙이면 한 문서에 같은 id가 여러 개 서고 `aria-labelledby`가 어느 것을 가리키는지 정해지지 않는다. " +
      "게다가 그 h2는 사람의 이름이지 표의 이름이 아니다."
  },
  {
    file: "app/users-lookup/page.tsx",
    name: "… 가구 표",
    why:
      'h2("가구")가 같은 map 안에서 사용자마다 반복돼 id가 문서에서 유일할 수 없다. ' +
      "같은 카드의 계정 정보 표와 끝말로 갈린다(정보 / 표)."
  }
];

describe("어드민 표 이름 (라운드 89 트랙 B)", () => {
  describe("스윕의 경계", () => {
    it("이 그물은 apps/admin/app/** 하나만 걷는다 (저장소 그물이 아니다)", () => {
      expect(SWEEP_ROOT).toBe("app");
      expect(SWEEP_SCOPE_LABEL).toBe("apps/admin/app/**");
      // 걷은 파일이 하나도 빠짐없이 그 경계 안이다 — `..`로 앱 밖을 넘보지 않는다.
      for (const file of SWEPT_FILES) {
        expect(file.startsWith("app/"), `${file}이(가) 스윕 경계 밖이에요`).toBe(true);
      }
      expect(SWEPT_FILES.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe("ⓐ 모집단 — 표 자리를 전수로 세고, 모두 이름을 갖는다", () => {
    it("손 목록이 아니라 파일 전수에서 표를 센다", () => {
      // 표를 그리는 화면 아홉이 모두 스윕에 들어 있다(전수 파생의 하한).
      const screensWithTables = new Set(ALL_TABLES.map((entry) => entry.file));
      expect([...screensWithTables].sort()).toEqual([
        "app/analytics/page.tsx",
        "app/audit-logs/page.tsx",
        "app/categories/page.tsx",
        "app/clicks/page.tsx",
        "app/items/page.tsx",
        "app/links/page.tsx",
        "app/reviews/page.tsx",
        "app/users-lookup/page.tsx",
        "app/users/page.tsx"
      ]);
      expect(ALL_TABLES.length).toBeGreaterThanOrEqual(MIN_TABLES);
    });

    it("모든 표가 이름을 갖는다 (aria-label 또는 aria-labelledby)", () => {
      const unnamed = ALL_TABLES.filter(
        (entry) => ariaNameOf(entry.file, SOURCES.get(entry.file) as string, entry.tag) === null
      ).map((entry) => `${entry.file}@${entry.tag.index}`);
      expect(unnamed, "이름 없는 표가 있어요 — 새 표에는 aria-labelledby(또는 aria-label)를 함께 세우세요").toEqual([]);
    });
  });

  describe("ⓑ 이름의 출처 — labelledby가 가리키는 id는 같은 파일의 <h2>다", () => {
    it("가리키는 id가 실재하고 그것이 h2다", () => {
      for (const { file, tag } of ALL_TABLES) {
        const source = SOURCES.get(file) as string;
        const named = ariaNameOf(file, source, tag);
        if (!named || named.kind !== "labelledby") continue;
        const h2Ids = headings(source).map((heading) => heading.id);
        expect(h2Ids, `${file}: aria-labelledby="${named.ref}"가 가리키는 <h2 id>가 없어요`).toContain(named.ref);
        // 가리키기만 하고 비어 있는 제목은 이름이 아니다.
        expect(named.name.length, `${file}: "${named.ref}" h2에 읽을 글자가 없어요`).toBeGreaterThan(0);
      }
    });

    it("id는 한 파일 안에서 유일하다 (map 안에서 반복되는 제목에 id를 붙이지 않았다)", () => {
      for (const file of SWEPT_FILES) {
        const ids = headings(SOURCES.get(file) as string)
          .map((heading) => heading.id)
          .filter((id): id is string => id !== null);
        expect(new Set(ids).size, `${file}: 같은 h2 id가 두 번 서 있어요`).toBe(ids.length);
      }
    });
  });

  describe("ⓒ 화면이 지은 이름은 값으로 센다", () => {
    it("대장이 소스의 aria-label 자리와 정확히 같다", () => {
      const found = ALL_TABLES.map((entry) => ariaNameOf(entry.file, SOURCES.get(entry.file) as string, entry.tag))
        .filter((named): named is Named => named !== null && named.kind === "label")
        .map((named) => `${named.file} :: ${named.name}`)
        .sort();
      const ledger = SCREEN_AUTHORED_NAMES.map((entry) => `${entry.file} :: ${entry.name}`).sort();
      expect(found, "화면이 지은 표 이름이 대장과 갈려요 — 새 이름을 지었으면 이유와 함께 대장에 적으세요").toEqual(
        ledger
      );
      expect(ledger.length).toBe(MIN_SCREEN_AUTHORED_NAMES);
    });

    it("각 항목이 왜 h2가 그 표의 이름이 아닌지를 적는다 (빈 문자열 금지)", () => {
      for (const entry of SCREEN_AUTHORED_NAMES) {
        expect(entry.why.trim().length, `${entry.file} :: ${entry.name} — 이유가 비어 있어요`).toBeGreaterThan(0);
        // 이유는 h2를 걸고 말해야 한다(카드 이름이라서 / map 안이라서 / h2가 없어서).
        expect(entry.why, `${entry.file} :: ${entry.name} — 이유가 h2를 걸지 않아요`).toMatch(/h2|카드|map/);
      }
    });
  });

  describe("ⓓ 한 카드 두 이름 — 끝말로 갈린다", () => {
    it("같은 카드의 표·그림 이름은 끝말이 서로 다르다", () => {
      for (const file of SWEPT_FILES) {
        const source = SOURCES.get(file) as string;
        const named = [...tablesOf(source), ...figuresOf(source)]
          .map((tag) => ariaNameOf(file, source, tag))
          .filter((entry): entry is Named => entry !== null);
        if (named.length === 0) continue;

        const cardStarts = [...source.matchAll(/className=\{styles\.card\}/g)].map((match) => match.index as number);
        const cardOf = (index: number): number => {
          let card = -1;
          for (const start of cardStarts) {
            if (start < index) card = start;
            else break;
          }
          return card;
        };

        const byCard = new Map<number, Named[]>();
        for (const entry of named) {
          const card = cardOf(entry.index);
          byCard.set(card, [...(byCard.get(card) ?? []), entry]);
        }

        for (const [card, entries] of byCard) {
          if (entries.length < 2) continue;
          const names = entries.map((entry) => entry.name);
          expect(new Set(names).size, `${file}@card:${card}: 한 카드에 같은 이름 둘 — ${names.join(" / ")}`).toBe(
            names.length
          );
          const tails = names.map((name) => name.split(" ").at(-1));
          expect(
            new Set(tails).size,
            `${file}@card:${card}: 한 카드의 이름 둘이 끝말로 갈리지 않아요 — ${names.join(" / ")}`
          ).toBe(tails.length);
        }
      }
    });

    it("추이 카드의 관례를 인용한다 — 그림은 \"막대 그래프\", 표는 \"표\" (라운드 88 트랙 A)", () => {
      for (const [file, countNoun] of [
        ["app/analytics/page.tsx", "이벤트 수"],
        ["app/clicks/page.tsx", "클릭 수"]
      ] as const) {
        const source = SOURCES.get(file) as string;
        expect(source, `${file}: 추이 표 이름이 바뀌었어요`).toContain(
          "aria-label={`최근 ${summary.days}일 일별 " + countNoun + " 표`}"
        );
        expect(source, `${file}: 막대 그림 이름이 바뀌었어요`).toContain(
          "aria-label={`최근 ${summary.days}일 일별 " + countNoun + " 막대 그래프`}"
        );
      }
    });
  });

  describe("ⓔ 래칫 — 이름을 가진 표의 수는 줄지 않는다", () => {
    it("표 열일곱이 모두 이름을 갖는다", () => {
      const named = ALL_TABLES.filter(
        (entry) => ariaNameOf(entry.file, SOURCES.get(entry.file) as string, entry.tag) !== null
      );
      expect(ALL_TABLES.length).toBeGreaterThanOrEqual(MIN_TABLES);
      expect(named.length).toBe(ALL_TABLES.length);
      expect(named.length).toBeGreaterThanOrEqual(MIN_TABLES);
    });
  });

  describe("ⓕ 바이트 불변 — 이름 축 말고는 한 글자도 건드리지 않았다", () => {
    it("표 머리가 그대로다", () => {
      const heads: [string, string[]][] = [
        ["app/users/page.tsx", ["<th>이메일</th>", "<th>표시 이름</th>", "<th>역할</th>", "<th>마지막 로그인</th>"]],
        ["app/audit-logs/page.tsx", ["<th>시각</th>", "<th>행위자</th>", "<th>액션</th>", "<th>대상</th>", "<th>상세</th>"]],
        ["app/reviews/page.tsx", ["<th>필드</th>", "<th>현재 라이브 값</th>", "<th>제출된 값</th>", "<th>버전</th>"]],
        ["app/categories/page.tsx", ["<th>코드</th>", "<th>이름</th>", "<th>표시 순서</th>"]],
        ["app/clicks/page.tsx", ["<th>플랫폼</th>", "<th>클릭 수</th>", "<th>준비템</th>", "<th>날짜</th>"]],
        ["app/analytics/page.tsx", ["<th>단계</th>", "<th>이벤트 수</th>", "<th>답변</th>", "<th>이벤트</th>"]],
        ["app/users-lookup/page.tsx", ["<th>이메일</th>", "<th>계정 상태</th>", "<th>가구</th>", "<th>역할</th>"]]
      ];
      for (const [file, cells] of heads) {
        const source = SOURCES.get(file) as string;
        for (const cell of cells) {
          expect(source, `${file}: 표 머리 ${cell}이(가) 사라졌어요`).toContain(cell);
        }
      }
    });

    it("DNC-009 고지가 그대로다 (클릭 순위는 추천 점수에 반영되지 않는다)", () => {
      const clicks = SOURCES.get("app/clicks/page.tsx") as string;
      expect(clicks).toContain("※ 클릭 수가 많은 순서예요. 이 순위는 앱의 추천 순서나 추천 점수에 반영되지 않아요.");
      expect(clicks).toContain("{/* DNC-009: 이 표는 열람용 집계일 뿐 추천 순서·점수와 무관하다. */}");
    });

    it("오류·0건 문구가 그대로다", () => {
      expect(SOURCES.get("app/audit-logs/page.tsx")).toContain("조건에 맞는 기록이 없어요.");
      expect(SOURCES.get("app/users/page.tsx")).toContain("등록된 계정이 없어요.");
      expect(SOURCES.get("app/categories/page.tsx")).toContain("조건에 맞는 카테고리가 없어요.");
      expect(SOURCES.get("app/items/page.tsx")).toContain("조건에 맞는 준비템이 없어요.");
      expect(SOURCES.get("app/links/page.tsx")).toContain("조건에 맞는 상품 링크가 없어요.");
      expect(SOURCES.get("app/reviews/page.tsx")).toContain("해당 상태의 초안이 없어요.");
      for (const file of ["app/users/page.tsx", "app/audit-logs/page.tsx", "app/reviews/page.tsx"]) {
        expect(SOURCES.get(file), `${file}: 다시 시도 버튼이 사라졌어요`).toContain("다시 시도");
      }
    });

    it("막대 식이 그대로다 (두 화면 같은 한 줄)", () => {
      for (const file of ["app/analytics/page.tsx", "app/clicks/page.tsx"]) {
        expect(SOURCES.get(file), `${file}: 막대 높이 식이 바뀌었어요`).toContain(
          "height: `${Math.max(entry.count > 0 ? 4 : 2, Math.round((entry.count / maxDaily) * 100))}%`"
        );
      }
    });

    it("title 속성 넷이 그대로다 (감사 로그 둘 · 막대 둘)", () => {
      const audit = SOURCES.get("app/audit-logs/page.tsx") as string;
      expect(audit).toContain("<td title={entry.actorUserId ?? undefined}>");
      expect(audit).toContain("<td title={entry.targetId ?? undefined}>");
      for (const file of ["app/analytics/page.tsx", "app/clicks/page.tsx"]) {
        expect(SOURCES.get(file), `${file}: 막대의 title이 사라졌어요`).toContain("title={entry.label}");
      }
      const titles = ["app/audit-logs/page.tsx", "app/analytics/page.tsx", "app/clicks/page.tsx"].reduce(
        (sum, file) => sum + ((SOURCES.get(file) as string).match(/\stitle=\{/g) ?? []).length,
        0
      );
      expect(titles, "title 속성의 수가 넷에서 갈렸어요").toBe(4);
    });

    it("S-3의 자리(items·links)는 표 이름 축으로만 열렸다", () => {
      const items = SOURCES.get("app/items/page.tsx") as string;
      const links = SOURCES.get("app/links/page.tsx") as string;
      // 역할 게이트·[수정] 토글·저장 경로는 이 트랙이 만지지 않는다.
      expect(items).toContain("ADMIN_EDITOR_WRITE_ROLE_NOTICE");
      expect(links).toContain("ADMIN_EDITOR_WRITE_ROLE_NOTICE");
      expect(links).toContain('<label id="link-filter-health-label">링크 상태</label>');
      // 이 트랙이 두 파일에 더한 것은 id 하나와 aria-labelledby 하나씩뿐이다.
      for (const [file, source] of [
        ["app/items/page.tsx", items],
        ["app/links/page.tsx", links]
      ] as const) {
        expect((source.match(/aria-labelledby=/g) ?? []).length, `${file}: labelledby 자리 수`).toBeLessThanOrEqual(2);
      }
    });

    it("대장의 이유가 건 바이트 앵커가 아직 그 자리에 있다", () => {
      // 이 둘이 사라지는 날, 위 대장의 그 항목들은 `aria-labelledby`로 돌아갈 수 있다.
      expect(SOURCES.get("app/analytics/page.tsx"), "KPI 퍼널 h2가 바뀌었어요").toContain("<h2>KPI 퍼널</h2>");
      const reviews = SOURCES.get("app/reviews/page.tsx") as string;
      expect((reviews.match(/ id="/g) ?? []).length, '검토 화면의 id=" 자리는 셋이다').toBe(3);
    });

    it("새 상호작용 표면 0건 — 표 이름은 레이아웃도 조작도 아니다", () => {
      for (const { file, tag } of ALL_TABLES) {
        expect(tag.attrs, `${file}: 표에 상호작용 속성이 붙었어요`).not.toMatch(/tabIndex|onClick|role="button"/);
      }
    });
  });
});
