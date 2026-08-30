import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 82 C — **`$transaction` 상한의 대장.**
 *
 * ## 왜 대장인가
 * 인터랙티브 트랜잭션에 두 번째 인자를 주지 않으면 **Prisma 기본값(timeout 5초 ·
 * maxWait 2초)** 위에서 돈다. 그 기본값이 옳은 자리도 있고 아닌 자리도 있는데, 오늘까지
 * 저장소에는 **어느 쪽인지 적힌 곳이 없었다** — 근거가 적힌 상한은 둘뿐이었고
 * (`PURGE_TX_OPTIONS` · `IMPORT_TX_OPTIONS`), 나머지는 그냥 기본값이었다. 그래서 다음
 * 라운드가 "이 자리는 왜 상한이 없나"를 매번 처음부터 다시 재야 했다.
 *
 * 이 파일이 세우는 계약은 하나다: **`apps/api/src`의 모든 `$transaction`은 명시 상한을
 * 가지거나, 아래 대장에 이유와 함께 있거나 둘 중 하나다.** 새 자리가 생기면 둘 다 아니므로
 * 빨개지고, 그때 재는 사람이 이유를 한 줄 적거나 상한을 준다.
 *
 * ⚠️ **래칫이 아니라 대장이다.** 목록의 크기를 고정하지 않는 이유는 상한이 필요 없는
 * 트랜잭션이 실제로 있기 때문이다(아래 이유들). 대신 **양방향**으로 잠근다 — 대장에 있는데
 * 실제로는 상한을 갖게 된 자리(= 낡은 등재)도 빨개진다. 이유가 사라진 줄이 남으면 다음
 * 라운드가 그 줄을 근거로 인용하게 되고, 그것이 라운드 80이 대장에 대해 물은 질문이다.
 *
 * ## 세는 방법
 * 소스를 문자열·주석·템플릿 리터럴을 건너뛰며 훑어 `$transaction(` 호출을 전수로 찾고
 * (주석 안의 `$transaction` 언급 — household-runtime.service.ts·import-pipeline.service.ts의
 * 설명문 — 은 세지 않는다), 그 호출의 괄호가 닫힐 때까지 **깊이 1의 쉼표**가 있었는지로
 * 두 번째 인자(= 명시 상한)의 유무를 판정한다. 자리의 이름은 파일 안의 **순번**과
 * 그 호출을 감싼 **메서드 이름**으로 부른다 — 줄 번호를 키로 쓰면 위쪽 한 줄만 늘어도
 * 대장 전체가 낡는다.
 *
 * DB가 필요 없는 순수 소스 계약이다(그래서 앱을 띄우지 않는다).
 */

/** 대장에 등재된 자리 하나: 감싼 메서드와 **빈 문자열이 아닌 이유**. */
type LedgerEntry = { member: string; reason: string };

/**
 * 명시 상한 **없이** 기본값 위에서 도는 것이 옳은 자리들. 키는 `파일경로#파일 안 순번`이다.
 *
 * 공통 판정 기준: **본문의 일감이 입력 크기에 비례하지 않고**(고정 문장 수 · 배열형 배치),
 * 그 몇 문장이 5초 안에 끝나지 못한다면 그것은 트랜잭션 예산의 문제가 아니라 DB가 이미
 * 병든 상태라는 뜻인 자리들. 정찰이 값으로 남긴 둘(`product-link-bulk`의 배열형 ·
 * `confirmChildProfileDeletion`의 두 문장 고정)이 이 기준의 원본이다.
 */
const UNBOUNDED_LEDGER: Readonly<Record<string, LedgerEntry>> = {
  "src/admin/product-link-bulk.service.ts#0": {
    member: "apply",
    reason:
      "배열형 `$transaction([...])`이라 인터랙티브 트랜잭션의 timeout/maxWait 옵션이 애초에 " +
      "적용되지 않는다(두 번째 인자를 받는 오버로드가 아니다). 문장 수는 CSV 변경 행 수에 " +
      "비례하지만 어드민 단발 작업이고, 상한을 주려면 배열형을 인터랙티브로 바꾸는 별개 결정이 먼저다."
  },
  "src/auth/refresh-token.store.ts#0": {
    member: "rotate",
    reason:
      "고정 세 문장(advisory lock · updateMany 한 건 · create 한 건)이고 입력 크기와 무관하다. " +
      "여기서 5초를 넘긴다는 것은 같은 family의 락을 다른 회전이 그만큼 붙잡고 있다는 뜻이라, " +
      "예산을 늘리는 것은 토큰 회전 폭주를 더 오래 견디는 쪽이지 고치는 쪽이 아니다(재시도가 정답)."
  },
  "src/auth/refresh-token.store.ts#1": {
    member: "revokeFamily",
    reason:
      "고정 두 문장(advisory lock · updateMany 한 건)이고 입력 크기와 무관하다. " +
      "위 `rotate`와 같은 락을 잡으므로 판단도 같다."
  },
  "src/households/household-runtime.service.ts#0": {
    member: "attemptFindOrCreateProviderUser",
    reason:
      "로그인 한 번의 고정 문장(사용자 조회 → 갱신/생성 → 멤버십 조회 → 없을 때만 가구·멤버 생성) " +
      "이고 입력 크기와 무관하다. 로그인은 사용자가 화면 앞에서 기다리는 요청이라 예산을 늘리는 " +
      "것이 오히려 나쁘다 — 5초 안에 못 끝나면 빨리 실패하고 다시 누르게 하는 편이 낫다."
  },
  "src/households/household-runtime.service.ts#1": {
    member: "withdrawUser",
    reason:
      "두 문장 고정(user.update 하나 · householdMember.updateMany 하나). 멤버십 수는 한 사람이 " +
      "속한 가구 수라 한 자릿수이고, 그마저도 updateMany 한 문장 안에 있다."
  },
  "src/households/household-runtime.service.ts#2": {
    member: "acceptInvite",
    reason:
      "두 문장 고정(초대 updateMany 하나 · 멤버 update 또는 create 하나). 입력 크기와 무관하고, " +
      "초대 수락도 사용자가 화면 앞에서 기다리는 단발 요청이다."
  },
  "src/onboarding/items-catalog.service.ts#0": {
    member: "adminCreateItemTemplate",
    reason:
      "두 문장 + 단계 코드 수만큼의 배치(replaceItemTemplateStages). 단계 코드는 도메인이 정한 " +
      "고정 집합이라 어드민이 늘릴 수 있는 축이 아니다(준비템 카탈로그와 다른 점이 여기다)."
  },
  "src/onboarding/items-catalog.service.ts#1": {
    member: "adminUpdateItemTemplate",
    reason: "위 `adminCreateItemTemplate`과 같은 모양·같은 판단(update 하나 + 같은 단계 배치)."
  },
  "src/onboarding/expenses-store.service.ts#0": {
    member: "createExpense",
    reason:
      "지출 한 건의 삽입 + (연결된 준비템이 있을 때만) 상태 표시 한 건이라 문장 수가 고정이다. " +
      "가져오기 확정 경로는 같은 `insertExpense`를 **자기 트랜잭션**(IMPORT_TX_OPTIONS) 안에서 " +
      "부르므로, 행 수에 비례하는 쪽은 이미 상한을 가진 그 자리다."
  },
  "src/onboarding/onboarding-core.service.ts#1": {
    member: "confirmChildProfileDeletion",
    reason:
      "두 문장 고정(child.update 하나 · expense.updateMany 하나 — 지출 수가 아무리 많아도 " +
      "updateMany 한 문장이다). 정찰이 값으로 남긴 자리다."
  },
  "src/devices/devices.controller.ts#0": {
    member: "register",
    reason:
      "두 문장 고정(userDevice.create 하나 · 같은 토큰을 쥔 타 사용자 행 updateMany 하나). " +
      "기기 등록은 앱이 부팅하며 거는 단발 요청이고 입력 크기와 무관하다."
  },
  "src/devices/devices.controller.ts#1": {
    member: "updateAndClaim",
    reason: "위 `register`와 같은 두 문장 고정(update 하나 · updateMany 하나)."
  }
};

type TransactionSite = {
  /** `파일경로#순번` — 대장의 키. */
  key: string;
  file: string;
  line: number;
  member: string;
  bounded: boolean;
};

const API_SRC = join(process.cwd(), "src");

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * `/` 앞의 이 토큰들 뒤에서는 슬래시가 **나눗셈이 아니라 정규식 리터럴**의 시작이다.
 * (구두점 판정만으로는 `return /x/.test(v)` 같은 자리를 가르지 못한다.)
 */
const REGEX_ALLOWED_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "case",
  "do",
  "else",
  "yield",
  "await"
]);

/**
 * 소스에서 코드가 아닌 구간(줄 주석·블록 주석·따옴표 문자열·템플릿 리터럴·**정규식 리터럴**)을
 * 공백으로 지운 사본을 만든다. 길이와 줄 바꿈을 보존하므로 인덱스와 줄 번호가 원본과 그대로 맞는다.
 *
 * ⚠️ 라운드 82 리뷰 M-8 — **정규식 리터럴을 건너뛰지 않으면 극성이 뒤집힌다.** 실증:
 * `src/admin/product-link-bulk-csv.util.ts`의 `.replace(/["\s]/g, "")`. 종전 훑기는 그 정규식 안의
 * `"`를 문자열 시작으로 읽어 **거기서부터 다음 따옴표까지**를 지웠고, 그 뒤로는 문자열 안과 밖이
 * 통째로 뒤바뀐 채 파일 끝까지 갔다 — 진짜 코드가 지워지고(= `$transaction` 자리를 놓친다) 문자열
 * 안이 코드로 남는다(= 없는 자리를 세거나 괄호 세기가 어긋난다). 전수를 자처하는 그물에서 이것은
 * 정확히 "조용히 통과"의 모양이라, 아래 계약에 그 파일을 근거로 한 회귀 단언을 함께 세운다.
 *
 * 나눗셈과 정규식은 **직전 유의미 토큰**으로 가른다(값 뒤의 `/`는 나눗셈, 그 외에는 정규식).
 */
function blankNonCode(source: string): string {
  const out = source.split("");
  let index = 0;
  /** 직전 유의미 토큰의 마지막 글자. 문자열·정규식을 지난 직후에는 "값"을 뜻하는 표식을 둔다. */
  let previous = "";
  const blankTo = (end: number) => {
    for (; index < end && index < source.length; index += 1) {
      if (source[index] !== "\n") out[index] = " ";
    }
  };
  const regexCanStartHere = (): boolean => {
    if (previous === "") return true;
    // 값(식별자·숫자·닫는 괄호·문자열) 뒤의 `/`는 나눗셈이다.
    if (/[\w$)\]]/.test(previous)) {
      const identifier = source.slice(0, index).match(/([A-Za-z_$][\w$]*)\s*$/);
      return identifier !== null && REGEX_ALLOWED_KEYWORDS.has(identifier[1]);
    }
    return true;
  };
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      blankTo(end === -1 ? source.length : end);
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      blankTo(end === -1 ? source.length : end + 2);
      continue;
    }
    if (char === "/" && regexCanStartHere()) {
      // 정규식 리터럴: `\` 이스케이프와 `[...]` 문자 클래스 안의 `/`는 종결자가 아니다.
      let cursor = index + 1;
      let inClass = false;
      let closed = false;
      while (cursor < source.length && source[cursor] !== "\n") {
        const inner = source[cursor];
        if (inner === "\\") {
          cursor += 2;
          continue;
        }
        if (inner === "[") inClass = true;
        else if (inner === "]") inClass = false;
        else if (inner === "/" && !inClass) {
          cursor += 1;
          closed = true;
          break;
        }
        cursor += 1;
      }
      if (closed) {
        while (cursor < source.length && /[a-z]/.test(source[cursor])) cursor += 1;
        blankTo(cursor);
        previous = "x";
        continue;
      }
      // 닫히지 않으면 정규식이 아니었다는 뜻이라 나눗셈으로 되돌린다.
      previous = "/";
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === quote) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      blankTo(cursor);
      previous = "x";
      continue;
    }
    if (!/\s/.test(char)) previous = char;
    index += 1;
  }
  return out.join("");
}

/**
 * 두 번째 인자 자리의 **식 그대로**. 없으면 null.
 * (인자 목록이 닫히는 지점까지 훑어 **깊이 1의 쉼표** 뒤를 잘라 낸다.)
 */
function secondArgument(code: string, openParenIndex: number): string | null {
  let depth = 0;
  let commaIndex = -1;
  for (let cursor = openParenIndex; cursor < code.length; cursor += 1) {
    const char = code[cursor];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return commaIndex === -1 ? null : code.slice(commaIndex + 1, cursor).trim();
    } else if (char === "," && depth === 1 && commaIndex === -1) commaIndex = cursor;
  }
  return null;
}

/** `timeout`/`maxWait`를 실제로 담은 객체 리터럴의 이름들(예: `PURGE_TX_OPTIONS`). */
function collectBoundsConstants(sources: ReadonlyArray<string>): Set<string> {
  const names = new Set<string>();
  for (const code of sources) {
    const declaration = /\b(?:const|let|var|readonly)\s+([A-Za-z_$][\w$]*)[^=\n]*=\s*(\{[^{}]*\})/g;
    for (let match = declaration.exec(code); match !== null; match = declaration.exec(code)) {
      if (TX_BOUNDS_KEYS.test(match[2])) names.add(match[1]);
    }
  }
  return names;
}

/** 인터랙티브 트랜잭션의 상한 옵션 키. 이 둘 말고는 예산을 정하지 않는다. */
const TX_BOUNDS_KEYS = /\b(timeout|maxWait)\s*:/;

/**
 * 그 호출이 **명시 상한**을 가졌는가.
 *
 * ⚠️ 라운드 82 리뷰 M-8 — 종전에는 *"두 번째 인자가 있는가"* 만 물었다. 그러면 상한과 무관한
 * 두 번째 인자(`isolationLevel`만 준 자리 등)도 "명시 상한"으로 분류돼 대장 밖으로 빠져나간다.
 * 이제 그 인자에 `timeout`/`maxWait`가 실제로 있는지를 본다 — 상수로 넘긴 자리
 * (`PREPARED_ITEMS_TX_OPTIONS` 같은 이름)는 그 상수의 선언에서 같은 키를 확인한다.
 */
function hasExplicitBounds(code: string, openParenIndex: number, boundsConstants: ReadonlySet<string>): boolean {
  const argument = secondArgument(code, openParenIndex);
  if (argument === null) return false;
  if (TX_BOUNDS_KEYS.test(argument)) return true;
  return (argument.match(/[A-Za-z_$][\w$]*/g) ?? []).some((name) => boundsConstants.has(name));
}

/** 호출 앞쪽에서 가장 가까운 **메서드 선언 줄**을 찾아 그 이름을 돌려준다. */
const NOT_A_MEMBER = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "else",
  "do",
  "function",
  "typeof",
  "await",
  "new",
  "constructor"
]);

/**
 * 줄 첫머리의 `이름(` 은 **선언일 수도 호출일 수도** 있다(`assertImportFileMatchesExtension(...)`
 * 처럼 들여쓰기만 앞선 문장 호출이 실제로 있다). 인자 목록이 닫힌 뒤에 오는 글자로 가른다 —
 * 선언이면 본문 `{`(또는 반환 타입 `:`)이고, 호출이면 `;`·`.`·`)` 같은 것들이다.
 */
function looksLikeDeclaration(code: string, openParenIndex: number): boolean {
  let depth = 0;
  let cursor = openParenIndex;
  for (; cursor < code.length; cursor += 1) {
    const char = code[cursor];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const after = code.slice(cursor + 1).match(/^\s*(.)/);
  return after !== null && (after[1] === "{" || after[1] === ":");
}

function enclosingMember(code: string, callIndex: number): string {
  const before = code.slice(0, callIndex);
  const declaration = /^[ \t]*(?:(?:private|public|protected|static|readonly|abstract|override)\s+)*(?:async\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*(?:<[^>\n]*>)?\s*\(/gm;
  let member = "(top level)";
  for (let match = declaration.exec(before); match !== null; match = declaration.exec(before)) {
    if (NOT_A_MEMBER.has(match[1])) continue;
    if (!looksLikeDeclaration(code, match.index + match[0].length - 1)) continue;
    member = match[1];
  }
  return member;
}

function collectTransactionSites(): TransactionSite[] {
  const files = listSourceFiles(API_SRC).sort();
  const codeByFile = new Map(files.map((file) => [file, blankNonCode(readFileSync(file, "utf8"))]));
  // 상한을 담은 상수 이름은 파일 하나가 아니라 **전수**에서 모은다(선언과 사용처가 다른 파일이다).
  const boundsConstants = collectBoundsConstants([...codeByFile.values()]);

  const sites: TransactionSite[] = [];
  for (const file of files) {
    const code = codeByFile.get(file)!;
    const relativePath = ["src", relative(API_SRC, file)].join(sep).split(sep).join("/");
    let ordinal = 0;
    for (
      let found = code.indexOf("$transaction(");
      found !== -1;
      found = code.indexOf("$transaction(", found + 1)
    ) {
      const openParen = found + "$transaction".length;
      sites.push({
        key: `${relativePath}#${ordinal}`,
        file: relativePath,
        line: code.slice(0, found).split("\n").length,
        member: enclosingMember(code, found),
        bounded: hasExplicitBounds(code, openParen, boundsConstants)
      });
      ordinal += 1;
    }
  }
  return sites;
}

describe("라운드 82 C — apps/api/src의 $transaction 상한 대장", () => {
  const sites = collectTransactionSites();

  it("훑기 자체가 실재하는 자리를 찾는다 (주석 안의 언급은 세지 않는다)", () => {
    // 그물이 비어 있으면 아래 계약 둘이 조용히 통과한다 — 그물 자신을 먼저 고정한다.
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.some((site) => site.bounded)).toBe(true);

    // 근거가 적힌 상한 둘은 실재한다(대장이 인용하는 원본).
    expect(sites.some((site) => site.file.endsWith("data-retention-purge.job.ts") && site.bounded)).toBe(true);
    expect(sites.some((site) => site.file.endsWith("import-pipeline.service.ts") && site.bounded)).toBe(true);

    // 라운드 82 C가 상한을 준 자리는 **명시 상한을 가진 쪽**에 있다(대장에 있지 않다).
    const preparedItems = sites.find((site) => site.member === "setPreparedItems");
    expect(preparedItems).toBeDefined();
    expect(preparedItems!.bounded).toBe(true);

    // 주석 안의 `$transaction` 언급을 세지 않는다는 사실도 함께 고정한다.
    const runtimeSites = sites.filter((site) => site.file.endsWith("household-runtime.service.ts"));
    expect(runtimeSites.map((site) => site.member)).toEqual([
      "attemptFindOrCreateProviderUser",
      "withdrawUser",
      "acceptInvite"
    ]);
  });

  it("명시 상한이 없는 자리는 전부 대장에 이유와 함께 있다", () => {
    const missing = sites
      .filter((site) => !site.bounded && !(site.key in UNBOUNDED_LEDGER))
      .map((site) => `${site.key} (${site.member}, ${site.file}:${site.line})`);
    expect(missing).toEqual([]);

    for (const site of sites.filter((entry) => !entry.bounded)) {
      const entry = UNBOUNDED_LEDGER[site.key];
      // 이유는 **빈 문자열이 아니어야** 한다 — 자리만 채운 등재는 대장이 아니다.
      expect(entry.reason.trim().length).toBeGreaterThan(0);
      // 등재가 실제로 그 자리를 가리키는지도 본다(순번만으로는 재배치를 잡지 못한다) —
      // 왼쪽이 대장이 적어 둔 메서드, 오른쪽이 소스에서 실제로 감싸고 있는 메서드다.
      expect({ key: site.key, member: entry.member }).toEqual({ key: site.key, member: site.member });
    }
  });

  it("대장에 낡은 줄이 남지 않는다 (상한을 갖게 됐거나 사라진 자리)", () => {
    const unbounded = new Set(sites.filter((site) => !site.bounded).map((site) => site.key));
    const stale = Object.keys(UNBOUNDED_LEDGER).filter((key) => !unbounded.has(key));
    // 이유가 사라진 줄이 남으면 다음 라운드가 그것을 근거로 인용한다 — 대장은 양방향이다.
    expect(stale).toEqual([]);
  });

  /**
   * 라운드 82 리뷰 M-8 — **그물 자신의 계약.** 전수를 자처하는 훑기가 소스의 한 모양(정규식
   * 리터럴)에서 극성을 뒤집으면, 그 뒤의 모든 판정이 조용히 틀린 채 초록으로 남는다.
   */
  it("M-8: 훑기가 정규식 리터럴을 코드가 아닌 구간으로 건너뛴다", () => {
    // ⓐ 실증 자리 — 종전 훑기가 이 파일의 `/["\s]/g`에서 문자열 안팎을 뒤집었다.
    const csvUtil = blankNonCode(
      readFileSync(join(API_SRC, "admin", "product-link-bulk-csv.util.ts"), "utf8")
    );
    // 정규식 안의 문자 클래스는 지워지고, 그 뒤의 **진짜 코드**는 살아 있다.
    expect(csvUtil).not.toContain('["\\s]');
    expect(csvUtil).toContain("const columnByIndex = new Map");
    expect(csvUtil).toContain("throw new BadRequestException");
    // 문자열 리터럴의 내용은 여전히 지워진다(코드로 오인되지 않는다).
    expect(csvUtil).not.toContain("ADMIN_BULK_CSV_HEADER_INVALID");

    // ⓑ 나눗셈은 정규식이 아니다 — 값 뒤의 `/`는 그대로 코드로 남는다.
    const division = blankNonCode('const half = (a + b) / 2;\nconst rate = total / count;\nconst x = "keep";');
    expect(division).toContain("(a + b) / 2");
    expect(division).toContain("total / count");
    expect(division).not.toContain("keep");

    // ⓒ 키워드 뒤의 `/`는 정규식이다.
    const afterKeyword = blankNonCode('function f(v) { return /a"b/.test(v); }\nconst tail = "지워진다";');
    expect(afterKeyword).toContain("return");
    expect(afterKeyword).toContain(".test(v)");
    expect(afterKeyword).not.toContain('a"b');
    expect(afterKeyword).not.toContain("지워진다");

    // ⓓ 길이·줄 번호는 보존된다(인덱스 계산의 전제).
    for (const sample of ['const r = /["\\s]/g;\nconst s = "x";', "const half = (a + b) / 2;"]) {
      expect(blankNonCode(sample)).toHaveLength(sample.length);
      expect(blankNonCode(sample).split("\n")).toHaveLength(sample.split("\n").length);
    }
  });

  /**
   * 라운드 82 리뷰 M-8 — **"두 번째 인자가 있다"는 "상한이 있다"가 아니다.**
   * 상한 판정은 `timeout`/`maxWait`가 실제로 있는지를 보고, 상수로 넘긴 자리는 그 상수의 선언까지
   * 따라간다(오늘 `setPreparedItems`가 그 모양이다).
   */
  it("M-8: 상한 판정이 timeout/maxWait의 실재를 본다 (상수 참조 포함)", () => {
    const boundsConstants = collectBoundsConstants([
      "const PREPARED_ITEMS_TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;",
      "const OTHER = { isolationLevel: 'Serializable' };"
    ]);
    expect([...boundsConstants]).toEqual(["PREPARED_ITEMS_TX_OPTIONS"]);

    const boundsOf = (call: string) => hasExplicitBounds(call, call.indexOf("$transaction(") + "$transaction".length, boundsConstants);
    expect(boundsOf("await this.prisma.$transaction(async (tx) => { await tx.a.b(); });")).toBe(false);
    expect(boundsOf("await this.prisma.$transaction(async (tx) => { await tx.a.b(); }, { timeout: 30_000 });")).toBe(true);
    expect(boundsOf("await this.prisma.$transaction(async (tx) => { await tx.a.b(); }, PREPARED_ITEMS_TX_OPTIONS);")).toBe(
      true
    );
    // 두 번째 인자가 있어도 상한 키가 없으면 **대장에 있어야 하는 자리**다(종전에는 빠져나갔다).
    expect(
      boundsOf("await this.prisma.$transaction(async (tx) => { await tx.a.b(); }, { isolationLevel: 'Serializable' });")
    ).toBe(false);
    // 배열형은 두 번째 인자 자체가 없다(대장의 product-link-bulk 항목이 그 근거다).
    expect(boundsOf("await this.prisma.$transaction([one, two, three]);")).toBe(false);

    // 오늘 소스의 상한 상수가 실제로 그 이름들로 잡힌다(단위 표본이 아니라 전수에서).
    const declared = collectBoundsConstants(
      listSourceFiles(API_SRC).map((file) => blankNonCode(readFileSync(file, "utf8")))
    );
    for (const name of ["PURGE_TX_OPTIONS", "IMPORT_TX_OPTIONS", "PREPARED_ITEMS_TX_OPTIONS"]) {
      expect(declared.has(name), `${name}이 상한 상수로 잡히지 않았다`).toBe(true);
    }
  });

  it("모든 자리가 둘 중 하나에 속한다 (명시 상한 또는 대장)", () => {
    const bounded = sites.filter((site) => site.bounded).length;
    const ledgered = sites.filter((site) => !site.bounded && site.key in UNBOUNDED_LEDGER).length;
    // 합이 전수와 같다는 것이 이 파일의 계약 전부다. 총 자리 수 자체는 손으로 적지 않는다 —
    // 그 수는 라운드마다 달라지는 관측값이지 계약이 아니다.
    expect(bounded + ledgered).toBe(sites.length);
  });
});
