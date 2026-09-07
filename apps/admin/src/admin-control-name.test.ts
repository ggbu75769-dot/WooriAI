import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 106 트랙 T5 — **어드민의 입력칸이 이름을 갖는다, 그리고 그 규율이 모집단을 얻는다.**
 *
 * 라운드 89 트랙 B가 어드민의 **표**에 이름을 세우고(`admin-table-name.test.ts`), 라운드 90
 * 트랙 B가 **상태 문장**에 소리를 주었다(`admin-status-announce.test.ts`). 남아 있던 셋째
 * 자리가 **입력칸**이다: 운영자가 실제로 값을 넣는 자리인데, 그 자리에 이름이 있는지를
 * 오늘까지 어느 계약도 묻지 않았다.
 *
 * 이 트랙이 실측한 결함은 **열**이었다(전부 이 라운드에서 고쳤다):
 *  · `src/components/AdminShell.tsx` 여덟 — 로그인·2단계 인증·비밀번호 변경·인증 앱 재등록의
 *    입력칸이 `placeholder` 하나에만 기대고 있었다. placeholder는 이름의 **폴백**이라 글자를
 *    치는 순간 사라지고 보조기술에 따라 이름으로 읽히지도 않는다 — 어드민에 들어가는 **첫**
 *    화면이 그랬다.
 *  · `app/disclosures/page.tsx` 하나 — 고지 문구 카드마다 반복되는 `<textarea>`에 이름이
 *    아예 없었다(카드가 열이면 같은 소리를 내는 칸이 열이다).
 *  · `app/items/page.tsx` 하나 — "적용 단계" 체크박스 여덟을 묶는 `<label>`이 `htmlFor`도
 *    없고 컨트롤을 감싸지도 않아, HTML 명세상 **아무것도 이름 짓지 않는** 라벨이었다.
 *
 * 오늘 실측 **0건**. 이 파일이 하는 일은 그 0을 계약으로 만드는 것이다 — 이름 없는 새 입력칸이
 * 붙는 날 여기가 빨개진다.
 *
 * ## ⚠️⚠️ 이 스윕의 경계를 값으로 적어 둔다 — 저장소 그물이 아니다
 *
 * 이 스윕이 걷는 것은 `SWEEP_ROOTS` 둘(`apps/admin/{app,src}/**`)뿐이고, `apps/admin/` 밖으로는
 * 한 걸음도 나가지 않는다. 그 사실을 주석이 아니라 **값**으로 두는 이유는 형제 스윕 둘과 같다:
 * 다음 라운드에 누군가 이 파일을 "저장소 입력칸 그물"로 넓히려 하면 넓히는 손이 이 값들을
 * 고치며 지나가게 된다. 주석은 조용히 거짓이 되지만 값은 빨개진다.
 *
 * ⚠️ **모바일을 세지 않는다**는 것은 사각이 아니라 범위다: React Native에는 `<label>`도
 * `aria-label`도 없고 그 축은 `apps/mobile/src/a11y-contract.test.ts`가 자기 모집단으로 진다.
 * 여기서 세는 것은 **HTML의 이름 짓기 네 갈래** 하나뿐이다.
 */

/** 이 스윕이 걷는 뿌리 둘. */
const SWEEP_ROOTS = ["app", "src"] as const;

/** 이 스윕의 앱 경계 — 값으로 든다(저장소 그물이 아니다). */
const SWEEP_SCOPE_LABEL = "apps/admin/{app,src}/**" as const;

/** 값을 넣는 태그 셋. `<button>`은 자식 글자가 곧 이름이라 이 축이 아니다. */
const NAMED_TAGS = ["input", "textarea", "select"] as const;

/**
 * ⓔ 래칫 — 이름을 요구받는 입력칸의 수는 줄지 않는다. 라운드 106 트랙 T5의 실측값 **예순**
 * (주석 속 태그 인용 셋을 뺀 수 — 감사 로그 4 · 카테고리 6 · 고지 3 · 준비템 17 · 링크 12 ·
 * 검토 3 · 사용자 조회 1 · 관리자 계정 4 · 셸 8 · CSV 벌크 2).
 */
const MIN_CONTROLS = 60;

/** 그 칸들이 사는 파일 수(실측 열). */
const MIN_FILES = 10;

const adminRoot = process.cwd();

/**
 * ⓑ **이름의 갈래 — 무엇을 이름으로 셀 것인가.**
 *
 * 넷뿐이고, 넷 다 이 저장소에 실재하는 관례다. 새로 발명한 갈래는 0건이다.
 */
const NAME_SOURCES: readonly { key: string; how: string; example: string }[] = [
  {
    key: "label-htmlFor",
    how: "같은 파일의 <label htmlFor=…>가 이 칸의 id를 가리킨다 — `app/**` 폼의 기본 관례다.",
    example: 'app/users/page.tsx: <label htmlFor="create-email">이메일</label>'
  },
  {
    key: "aria-label",
    how: "라벨을 세울 자리가 없는 칸(표 안의 인라인 편집·카드마다 반복되는 칸·좁은 로그인 카드)이 쓴다.",
    example: "app/categories/page.tsx: aria-label={`${category.code} 이름`}"
  },
  {
    key: "aria-labelledby",
    how: "이미 화면에 서 있는 글자를 이름으로 빌린다(표 이름 축이 쓰는 그 속성).",
    example: 'app/links/page.tsx: aria-labelledby="link-filter-health-label"'
  },
  {
    key: "wrapping-label",
    how: "`<label>`이 칸을 **감싸** 그 안의 글자가 곧 이름이 된다(체크박스 격자가 쓰는 모양).",
    example: "app/items/page.tsx: <label className={styles.stageOption}><input type=\"checkbox\" …/>{라벨}</label>"
  }
];

/**
 * ⓓ **면제 — 이름을 요구하지 않는 칸과 그 이유.** ⚠️ 빈 문자열 금지.
 *
 * 오늘 면제는 **0건**이다. 목록을 비워 두는 것 자체가 값이다 — 면제를 더하려는 손은
 * 여기에 이유를 적으며 지나가게 된다(적을 이유가 없으면 그 칸은 이름을 가져야 하는 칸이다).
 */
const EXEMPTIONS: readonly { file: string; index: number; reason: string }[] = [];

function listSweptFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx") && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(relative(adminRoot, full).split(sep).join("/"));
      }
    }
  };
  for (const root of SWEEP_ROOTS) walk(join(adminRoot, root));
  return out.sort();
}

function read(relativePath: string): string {
  return readFileSync(join(adminRoot, relativePath), "utf8");
}

/** 한 줄에서 **따옴표 밖의** `//`부터 줄 끝까지를 지운다(`http://`를 자르지 않기 위해서). */
function stripLineComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "/" && line[i + 1] === "/") return `${line.slice(0, i)} `;
  }
  return line;
}

/**
 * 주석을 **길이를 지키며** 지운다(공백으로 덮는다).
 *
 * ⚠️ 왜 길이를 지키는가: 이 파일의 위치(index)가 그대로 사람이 읽는 좌표이고, 면제 목록도
 * 그 좌표를 키로 쓴다. 주석을 잘라 내면 좌표가 통째로 밀려 대장이 유령이 된다.
 * ⚠️ 왜 지우는가: 이 저장소의 주석은 `<select>`·`<input type="checkbox">` 같은 태그를 **글자로**
 * 인용한다(라운드 78 트랙 C가 readOnly/disabled 비대칭을 적어 둔 세 자리가 그렇다). 지우지
 * 않으면 그 인용이 모집단에 들어와 영영 이름 없는 칸으로 남는다.
 */
function codeOnly(source: string): string {
  const blank = (match: string): string => match.replace(/[^\n]/g, " ");
  const withoutBlocks = source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank);
  return withoutBlocks
    .split("\n")
    .map((line) => {
      const stripped = stripLineComment(line);
      return stripped.length === line.length ? stripped : stripped + " ".repeat(line.length - stripped.length);
    })
    .join("\n");
}

/**
 * 여는 태그 하나의 속성 문자열. `[^>]*`로 자를 수 없다 — 속성 값 안의 화살표 함수
 * (`onChange={(event) => …}`)가 `>`를 품기 때문이다. 그래서 중괄호 깊이를 세며 걷는다.
 */
function tagAttributes(source: string, start: number): string | null {
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0 && source[cursor - 1] !== "=") return source.slice(start, cursor);
  }
  return null;
}

type Control = { file: string; tag: string; index: number; attrs: string };

/**
 * ⚠️ **못 푼 자리는 조용히 버리지 않는다.** 파서가 여는 태그를 못 닫으면 그 칸은 모집단에서
 * 빠지고, 빠진 칸은 어떤 단언도 무는 것이 없어 **영원히 초록**이다. 그래서 값으로 모은다.
 */
const PARSE_FAILURES: string[] = [];

function controlsOf(file: string, code: string): Control[] {
  const out: Control[] = [];
  for (const tag of NAMED_TAGS) {
    for (const match of code.matchAll(new RegExp(`<${tag}(?=[\\s/>])`, "g"))) {
      const index = match.index as number;
      const attrs = tagAttributes(code, index + tag.length + 1);
      if (attrs === null) {
        PARSE_FAILURES.push(`${file}@${index}: <${tag}>의 여는 태그를 닫지 못했어요`);
        continue;
      }
      out.push({ file, tag, index, attrs });
    }
  }
  return out.sort((left, right) => left.index - right.index);
}

/** 이 칸을 **감싸는** `<label>`이 있는가 — 바로 앞의 `<label`이 아직 닫히지 않았는가. */
function isWrappedByLabel(code: string, index: number): boolean {
  const open = code.lastIndexOf("<label", index);
  if (open < 0) return false;
  return code.indexOf("</label>", open) > index;
}

/** 이 칸의 id를 가리키는 `<label htmlFor>`가 같은 파일에 있는가(리터럴·템플릿 둘 다). */
function hasLabelFor(code: string, attrs: string): boolean {
  const literal = /\sid="([^"]+)"/.exec(attrs);
  if (literal) return code.includes(`htmlFor="${literal[1]}"`);
  const template = /\sid=\{`([^`]+)`\}/.exec(attrs);
  if (template) return code.includes(`htmlFor={\`${template[1]}\`}`);
  return false;
}

function nameSourcesOf(code: string, control: Control): string[] {
  const found: string[] = [];
  if (hasLabelFor(code, control.attrs)) found.push("label-htmlFor");
  if (/\saria-label[=\s]/.test(control.attrs)) found.push("aria-label");
  if (/\saria-labelledby=/.test(control.attrs)) found.push("aria-labelledby");
  if (isWrappedByLabel(code, control.index)) found.push("wrapping-label");
  return found;
}

const SWEPT_FILES = listSweptFiles();
const CODE = new Map(SWEPT_FILES.map((file) => [file, codeOnly(read(file))] as const));
const ALL_CONTROLS = SWEPT_FILES.flatMap((file) => controlsOf(file, CODE.get(file) as string));
const EXEMPT_KEYS = new Set(EXEMPTIONS.map((entry) => `${entry.file}@${entry.index}`));

describe("어드민 입력칸이 이름을 갖는다 (라운드 106 트랙 T5)", () => {
  describe("ⓐ 모집단 — 손 목록이 아니라 파일 전수에서 파생한다", () => {
    it("스윕은 apps/admin 안에서만 돈다 (저장소 그물이 아니다)", () => {
      expect(SWEEP_SCOPE_LABEL).toBe("apps/admin/{app,src}/**");
      expect(SWEEP_ROOTS.length, "뿌리가 늘었다면 이 스윕의 경계가 바뀐 것이에요").toBe(2);
      for (const file of SWEPT_FILES) {
        expect(
          SWEEP_ROOTS.some((root) => file.startsWith(`${root}/`)),
          `${file}: 스윕이 ${SWEEP_SCOPE_LABEL} 밖으로 나갔어요`
        ).toBe(true);
        expect(file, `${file}: 스윕이 앱 밖의 경로를 걷었어요`).not.toContain("..");
      }
      // 유령 방지 — 모집단이 0건이면 아래 단언들은 영원히 초록이다.
      expect(SWEPT_FILES.length, "스윕이 걷은 비테스트 .tsx").toBeGreaterThan(0);
    });

    it("못 푼 자리가 없다 (빠진 칸은 어떤 단언도 물지 않는다)", () => {
      expect(PARSE_FAILURES, "파서가 못 푼 입력칸은 모집단에서 조용히 빠져요").toEqual([]);
    });

    it("입력칸을 전수로 세고, 그 수는 줄지 않는다", () => {
      expect(ALL_CONTROLS.length, "이름을 요구받는 입력칸 수").toBeGreaterThanOrEqual(MIN_CONTROLS);
      const files = new Set(ALL_CONTROLS.map((control) => control.file));
      expect(files.size, "입력칸이 사는 파일 수").toBeGreaterThanOrEqual(MIN_FILES);
      // 주석 인용을 세지 않는다 — 라운드 78이 적어 둔 `<select>`·`<input type="checkbox">`
      // 세 자리는 코드가 아니라 글자다(그 셋이 모집단에 들어오면 영영 이름 없는 칸이 된다).
      for (const control of ALL_CONTROLS) {
        expect(control.attrs, `${control.file}@${control.index}: 주석 속 태그를 세고 있어요`).not.toBe("");
      }
    });
  });

  describe("ⓑ 모든 입력칸이 이름을 갖는다 (네 갈래 중 하나)", () => {
    it("이름 없는 입력칸이 0건이다", () => {
      const unnamed = ALL_CONTROLS.filter(
        (control) =>
          !EXEMPT_KEYS.has(`${control.file}@${control.index}`) &&
          nameSourcesOf(CODE.get(control.file) as string, control).length === 0
      ).map((control) => `${control.file}@${control.index} <${control.tag}> ${control.attrs.replace(/\s+/g, " ").trim().slice(0, 80)}`);
      expect(
        unnamed,
        "이름 없는 입력칸이 있어요 — <label htmlFor>·aria-label·aria-labelledby·감싸는 <label> 중 하나를 주세요\n" +
          "  ⚠️ placeholder는 이름이 아니라 **폴백**입니다(글자를 치면 사라지고 보조기술에 따라 읽히지 않아요)."
      ).toEqual([]);
    });

    it("갈래 표에 없는 이름 짓기를 쓰지 않는다", () => {
      const known = new Set(NAME_SOURCES.map((entry) => entry.key));
      for (const control of ALL_CONTROLS) {
        for (const source of nameSourcesOf(CODE.get(control.file) as string, control)) {
          expect(known, `${control.file}@${control.index}: 갈래 표에 없는 이름 출처 ${source}`).toContain(source);
        }
      }
      // 갈래마다 이유가 적혀 있다(빈 문자열 금지 — 이유를 못 적는 갈래는 관례가 아니다).
      for (const entry of NAME_SOURCES) {
        expect(entry.how.length, `${entry.key}: 갈래의 이유가 비어 있어요`).toBeGreaterThan(0);
        expect(entry.example.length, `${entry.key}: 갈래의 본보기가 비어 있어요`).toBeGreaterThan(0);
      }
    });

    it("면제는 이유를 갖는다 (오늘은 0건)", () => {
      expect(EXEMPTIONS, "면제가 생겼다면 그 자리가 왜 이름을 갖지 않아도 되는지 적으세요").toEqual([]);
    });
  });

  describe("ⓒ 이 라운드가 고친 열 자리가 그대로 있다", () => {
    it("셸의 로그인·MFA·비밀번호 입력칸 여덟이 이름을 갖는다 (문구는 placeholder와 같다)", () => {
      const shell = CODE.get("src/components/AdminShell.tsx") as string;
      for (const name of [
        "관리자 이메일",
        "비밀번호",
        "현재 비밀번호",
        "새 비밀번호 (10자 이상)",
        "새 비밀번호 확인",
        "인증 코드 또는 복구 코드",
        "인증 앱의 6자리 코드"
      ]) {
        expect(shell, `셸의 "${name}" 칸이 이름을 잃었어요`).toContain(`aria-label="${name}"`);
        // ⚠️ 새 문구 0건 — 이름은 이미 그 자리에 있던 placeholder의 글자 그대로다.
        expect(shell, `"${name}"의 placeholder가 사라졌어요`).toContain(`placeholder="${name}"`);
      }
      const controls = ALL_CONTROLS.filter((control) => control.file === "src/components/AdminShell.tsx");
      expect(controls.length, "셸의 입력칸 수").toBe(8);
    });

    it("고지 문구 카드의 textarea가 카드마다 다른 이름을 갖는다", () => {
      const source = CODE.get("app/disclosures/page.tsx") as string;
      // 카드가 map 안이라 id는 문서에서 유일할 수 없다 — 그래서 aria-label이고, 키가 이름이 된다.
      expect(source).toContain("aria-label={`${disclosure.key} 문구`}");
    });

    it("준비템 폼의 '적용 단계' 묶음이 이름을 갖는다 (label이 아무것도 짓지 않던 자리)", () => {
      const source = CODE.get("app/items/page.tsx") as string;
      expect(source).toContain("<label id={`${idPrefix}-stages-label`}>적용 단계</label>");
      expect(source).toContain('role="group" aria-labelledby={`${idPrefix}-stages-label`}');
      // 폼이 한 화면에 여러 번 뜨므로 id는 리터럴이 아니라 idPrefix에서 짓는다.
      expect(source, "적용 단계 묶음의 id가 리터럴로 굳었어요 — 폼이 여러 번 뜨면 문서에서 유일하지 않아요").not.toContain(
        '<label id="stages-label">'
      );
    });
  });
});
