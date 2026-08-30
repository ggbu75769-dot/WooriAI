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
 * 소스에서 코드가 아닌 구간(줄 주석·블록 주석·따옴표 문자열·템플릿 리터럴)을 공백으로
 * 지운 사본을 만든다. 길이와 줄 바꿈을 보존하므로 인덱스와 줄 번호가 원본과 그대로 맞는다.
 */
function blankNonCode(source: string): string {
  const out = source.split("");
  let index = 0;
  const blankTo = (end: number) => {
    for (; index < end && index < source.length; index += 1) {
      if (source[index] !== "\n") out[index] = " ";
    }
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
      continue;
    }
    index += 1;
  }
  return out.join("");
}

/** 호출 인자 목록이 닫히는 지점까지 훑어 **깊이 1의 쉼표**(= 두 번째 인자) 유무를 본다. */
function hasSecondArgument(code: string, openParenIndex: number): boolean {
  let depth = 0;
  let sawTopLevelComma = false;
  for (let cursor = openParenIndex; cursor < code.length; cursor += 1) {
    const char = code[cursor];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return sawTopLevelComma;
    } else if (char === "," && depth === 1) sawTopLevelComma = true;
  }
  return sawTopLevelComma;
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
  const sites: TransactionSite[] = [];
  for (const file of listSourceFiles(API_SRC).sort()) {
    const source = readFileSync(file, "utf8");
    const code = blankNonCode(source);
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
        bounded: hasSecondArgument(code, openParen)
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

  it("모든 자리가 둘 중 하나에 속한다 (명시 상한 또는 대장)", () => {
    const bounded = sites.filter((site) => site.bounded).length;
    const ledgered = sites.filter((site) => !site.bounded && site.key in UNBOUNDED_LEDGER).length;
    // 합이 전수와 같다는 것이 이 파일의 계약 전부다. 총 자리 수 자체는 손으로 적지 않는다 —
    // 그 수는 라운드마다 달라지는 관측값이지 계약이 아니다.
    expect(bounded + ledgered).toBe(sites.length);
  });
});
