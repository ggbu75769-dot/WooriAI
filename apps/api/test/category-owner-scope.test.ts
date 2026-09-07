import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 103 T1 — **`categories` 소유자 필터의 대장.**
 * 설계: docs/5차/round103-custom-expense-category-design.md §1.9(대장) · §1.2(왜 대장인가).
 *
 * ## 왜 대장인가
 * 라운드 103은 커스텀 지출 분류를 **별도 표가 아니라 `categories`의 가구 소유 행**으로 두기로
 * 했다(설계 §1.1 — `expenses.category_id`가 NOT NULL FK라 그 표 밖의 id는 지출에 저장될 수
 * 없다). 그 선택이 지는 비용은 하나다: **소유자 필터를 한 자리라도 빠뜨리면 가구 A의 분류가
 * 가구 B나 운영자에게 샌다.** 라운드 100이 `item_templates` 확장을 기각한 바로 그 이유이고,
 * 여기서 같은 위험을 감수할 수 있는 근거는 **모집단을 세었기 때문**이다 — 그 표를 읽는 자리는
 * 전부 `apps/api/src`(+시드) 안이고 워커가 0건이다(설계 §1.2).
 *
 * 그래서 이 파일이 세우는 계약은 하나다: **`apps/api/src`와 `apps/api/prisma`의 모든
 * `<무엇>.category.<동사>(` 호출은 아래 대장에 입장(stance)과 이유를 달고 등재돼 있다.**
 * 새 자리가 생기면 등재가 없으므로 **기본값이 빨강**이고, 그때 재는 사람이 그 자리가 어느
 * 입장인지 정해 한 줄을 적는다. 이 저장소가 `transaction-bounds`·`categories-cache-contract`로
 * 이미 두 번 쓴 방법이고, 형식(양방향 잠금·이유 필수·감싼 메서드 대조)도 그대로 따른다.
 *
 * ⚠️ **양방향이다.** 대장에만 있고 소스에는 없는 줄(= 낡은 등재)도 빨개진다 — 이유가 사라진
 * 줄이 남으면 다음 라운드가 그 줄을 근거로 인용하게 된다(라운드 82가 대장에 대해 물은 질문).
 *
 * ⚠️ 그리고 **등재만으로 초록이 되지 않는다.** `household-scoped`·`system-only`·`code-scoped`로
 * 등재한 자리는 그 호출의 **인자 안에서 술어 조각이 실제로 보여야** 한다. 등재는 선언이고
 * 술어는 값이라, 술어 없이 이름표만 붙이는 등재를 이 계약이 거절한다.
 *
 * DB가 필요 없는 순수 소스 계약이다(그래서 앱을 띄우지 않는다).
 */

/**
 * 자리의 입장 넷.
 *  · `household-scoped` — 호출자(또는 대상 행)의 가구로 좁힌다. 시드(NULL) + 그 가구만 본다.
 *  · `system-only`      — 운영 시드만 본다(`householdId: null`). 사용자 분류는 보이지 않는다.
 *  · `id-derived`       — 술어가 **이미 그 가구의 데이터에서 파생한 id 집합**이라 남의 분류가
 *                         들어올 수 없다(필터를 더해도 항등이다).
 *  · `code-scoped`      — 시드 code 집합으로 이미 좁다. 커스텀 code는 `custom_` 접두라 겹치지 않는다.
 */
type Stance = "household-scoped" | "system-only" | "id-derived" | "code-scoped";

/** 술어를 인자에서 확인할 수 없는 자리만 쓰는 입장들(= `predicate: null`이 허용되는 축). */
const STANCES_WITHOUT_PREDICATE: ReadonlySet<Stance> = new Set<Stance>(["id-derived"]);

type LedgerEntry = {
  /**
   * 설계 §1.9 표의 행 번호. `null`은 그 표가 쓰인 뒤에 생긴 자리 — 이 라운드가 새로 세운
   * 쓰기 엔드포인트(설계 §2.3)의 내부다. 표의 **열 자리는 전부** 아래 계약이 실재를 확인한다.
   */
  designRow: number | null;
  /** 그 호출을 감싼 메서드 이름. 순번만으로는 재배치를 잡지 못하므로 함께 대조한다. */
  member: string;
  stance: Stance;
  /** 그 호출의 **인자 안에서 그대로 보여야 하는** 술어 조각. 확인할 수 없는 자리만 `null`. */
  predicate: string | null;
  /** 빈 문자열 금지 — 자리만 채운 등재는 대장이 아니다. */
  reason: string;
};

/**
 * 키는 `파일경로#파일 안 순번`이다(줄 번호를 키로 쓰면 위쪽 한 줄만 늘어도 대장 전체가 낡는다 —
 * transaction-bounds 대장의 관례 그대로).
 */
const CATEGORY_READ_LEDGER: Readonly<Record<string, LedgerEntry>> = {
  // ── 설계 §1.9 표의 열 자리 ────────────────────────────────────────────────
  "src/finance/categories.controller.ts#0": {
    designRow: 1,
    member: "list",
    stance: "household-scoped",
    predicate: "householdId: null",
    reason:
      "앱이 보는 분류 목록. 시드 전량 + **호출자가 속한 가구**의 커스텀만 합류한다(설계 §2.2 — " +
      "`OR: [{householdId: null}, {householdId: {in: 호출자 가구 ids}}]`). 다가구 사용자의 읽기가 " +
      "합집합인 이유는 그 전부가 이 사람의 가구이기 때문이고, 읽기에는 하나를 고를 필요가 없다(§1.3)."
  },
  "src/admin/admin-categories.service.ts#0": {
    designRow: 2,
    member: "list",
    stance: "system-only",
    predicate: "householdId: null",
    reason:
      "어드민 카테고리 표. 운영자는 사용자가 만든 분류를 보지 않는다 — 어드민에 개인 데이터 " +
      "표면을 신설하지 않는다는 라운드 100·102와 같은 판단이다(설계 §1.9 #2). 종전에는 '필터 없이 " +
      "전량'이 곧 시드 전량이었다(그 표에 사용자 행이 있을 수 없었다)."
  },
  "src/admin/admin-categories.service.ts#1": {
    designRow: 3,
    member: "findById",
    stance: "system-only",
    predicate: "householdId: null",
    reason:
      "어드민 단건 조회(감사 로그 before 스냅샷). 커스텀 id는 여기서 miss가 되어 종전과 같은 404 " +
      "`CATEGORY_NOT_FOUND`로 떨어진다. `findUnique`가 유니크 키 밖 술어를 받지 않아 `findFirst`로 " +
      "바꾸었고, id가 PK라 결과는 여전히 0 또는 1건이다."
  },
  "src/admin/admin-categories.service.ts#2": {
    designRow: 4,
    member: "update",
    stance: "system-only",
    predicate: null,
    reason:
      "어드민 수정. 이 쓰기는 컨트롤러가 `findById`(system-only, 위 #1)를 **먼저** 지나므로 자연히 " +
      "시드 행만 받는다 — 그래서 인자 안에서 확인할 술어가 없다(설계 §1.9 #4의 '자연히 좁아진다'). " +
      "`where`를 `updateMany`로 바꿔 소유자 술어를 넣지 않는 이유: 그러면 '없으면 0건 갱신'이 되어 " +
      "404가 200으로 조용히 바뀐다. ⚠️ 그 파생이 끊기는 날(컨트롤러가 findById를 건너뛰는 날) 이 " +
      "줄의 이유가 거짓이 되므로, 그때 이 자리는 predicate를 가져야 한다."
  },
  "src/admin/admin-categories.service.ts#3": {
    designRow: null,
    member: "requireUniqueSeedName",
    stance: "system-only",
    predicate: "householdId: null",
    reason:
      "라운드 107 D6 — 어드민 이름 변경의 중복 검사(라운드 103이 커스텀 쪽에 세운 " +
      "`requireUniqueName`과 같은 규칙). 비교 모집단이 **시드 전량**인 이유가 곧 이 입장이다: " +
      "운영자는 사용자가 만든 분류를 보지 않는다(설계 §1.9의 그 판단). 커스텀 행까지 세면 " +
      "어드민 응답이 '몇 건 겹친다'는 형태로라도 사용자 데이터를 말하게 된다. ⚠️ 그 대가로 " +
      "어드민 이름이 어느 가구의 커스텀과 겹치는 방향은 여기서 막히지 않고, 그 가구의 커스텀 " +
      "쪽 검사(모집단에 시드를 포함한다)가 다음 쓰기에서 막는다."
  },
  "src/finance/milestone-report.service.ts#0": {
    designRow: 5,
    member: "getMilestoneReport",
    stance: "id-derived",
    predicate: null,
    reason:
      "100일/첫돌 리포트의 상위 5분류 이름 해석. 술어의 id 집합이 **그 아이의 지출**에서 파생한 " +
      "값(`groupBy(categoryId)` 상위 5)이라 남의 분류가 들어올 수 없다 — 소유자 필터를 더해도 " +
      "항등이다. 설계 §1.9 #5의 '무변경' 판정이 이 줄이다."
  },
  "src/onboarding/expenses-store.service.ts#0": {
    designRow: 6,
    member: "requireExistingCategory",
    stance: "household-scoped",
    predicate: "householdId: null",
    reason:
      "지출 생성·수정의 분류 검증(단일 소스). 인자에 `householdId`가 하나 늘어 술어가 " +
      "`{ id, OR: [{householdId: null}, {householdId}] }`로 좁아졌다 — 남의 가구 분류로는 지출을 " +
      "만들 수도 옮길 수도 없다. 거절의 코드·문장·상태는 종전 그대로(`EXPENSE_CATEGORY_INVALID` " +
      "400)이고, `selectable`·`active`를 보지 않는 것도 그대로다(설계 §2.6)."
  },
  "src/onboarding/import-pipeline.service.ts#0": {
    designRow: 7,
    member: "insertImportedExpenses",
    stance: "household-scoped",
    predicate: "householdId: null",
    reason:
      "가져오기 확정 직전의 분류 실재 확인(배치 한 문장). 잡의 가구로 좁혀 **확정이 남의 분류를 " +
      "지출에 심지 못하게** 한다(설계 §1.9 #7). 오늘 이 경로가 싣는 id는 정식 code의 id 아니면 " +
      "가져오기 스텁이라 동작 변화 0이고, 이 술어는 방어선이다."
  },
  "src/onboarding/import-pipeline.service.ts#1": {
    designRow: 8,
    member: "buildImportRowsFromParsed",
    stance: "system-only",
    predicate: "householdId: null",
    reason:
      "파서가 고른 code → 분류 id 해석. 파서의 `CATEGORY_KEYWORDS`가 정식 code 고정 목록이라 오늘도 " +
      "시드만 매치하지만, 그 사실이 파서 쪽 상수에만 적혀 있으면 사전이 넓어지는 날 조용히 남의 " +
      "분류를 집는다(설계 §1.9 #8 — 동작 변화 0의 방어선)."
  },
  "src/onboarding/onboarding-core.service.ts#0": {
    designRow: 9,
    member: "requireBudgetableCategories",
    stance: "household-scoped",
    predicate: "householdId: null",
    reason:
      "카테고리 예산(라운드 102)의 분류 검증. 그 아이의 가구로 좁혀 **남의 커스텀 분류에는 예산을 " +
      "세울 수 없게** 한다(설계 §1.9 #9). 자기 가구의 커스텀에는 세울 수 있다 — " +
      "`category_budgets.category_id`가 같은 표를 가리키므로 마이그레이션 0건이다. 라운드 102의 " +
      "두 갈래 판정(신규 거부 · 기존 유지)은 한 글자도 바뀌지 않는다."
  },
  // ⚠️ 두 시점(라운드 107 트랙 E): 종전 이 자리는 셋이었고 순번은 #0 정식 upsert · #1 별칭
  // upsert · #2 준비템 지도였다(그때는 참). → 이제 다섯이다. 트랙 E가 "시드는 있는 행을
  // 고치지 않는다"는 경계를 세우면서 각 upsert **앞에** 존재 확인 findUnique 를 넣었고,
  // 이 대장의 순번은 파일 등장 순서 파생이라 뒤의 셋이 통째로 밀렸다. 등재를 다시 적는
  // 것이 옳다 — 순번을 고정하려고 대장을 목록이 아닌 것으로 바꾸면, 새 호출이 조용히
  // 기존 등재를 물려받는 길이 열린다.
  "prisma/seed.ts#0": {
    designRow: 10,
    member: "seedCategories",
    stance: "code-scoped",
    predicate: "code: category.code",
    reason:
      "정식 12행의 **존재 확인**(라운드 107 E). 시드 code 집합으로 좁고 커스텀 code는 `custom_` " +
      "접두라 겹치지 않는다. 읽기 전용이며, 있으면 아래 upsert 를 건너뛰어 어드민 편집분을 " +
      "지킨다(설계 §1.9 #10과 같은 행)."
  },
  "prisma/seed.ts#1": {
    designRow: 10,
    member: "seedCategories",
    stance: "code-scoped",
    predicate: "code: category.code",
    reason:
      "정식 12행 upsert. 시드 code 집합으로 이미 좁고 커스텀 code는 `custom_` 접두라 절대 겹치지 " +
      "않는다(설계 §1.9 #10 — 무변경)."
  },
  "prisma/seed.ts#2": {
    designRow: 10,
    member: "seedCategories",
    stance: "code-scoped",
    predicate: "id: alias.id",
    reason:
      "별칭 9행의 **존재 확인**(라운드 107 E). 고정 UUID 로 지목하는 자리라 커스텀 행에 닿을 수 " +
      "없다. 읽기 전용이며 아래 upsert 의 건너뛰기 판정에만 쓰인다."
  },
  "prisma/seed.ts#3": {
    designRow: 10,
    member: "seedCategories",
    stance: "code-scoped",
    predicate: "id: alias.id",
    reason:
      "모바일 퀵타일 별칭 8 + 가져오기 스텁 1의 upsert. 고정 UUID로 지목하는 자리라 커스텀 행에 " +
      "닿을 수 없다(설계 §1.9 #10과 같은 행). ⚠️ 이 아홉 행이 `isSystem: false`로 시드된다는 사실이 " +
      "마이그레이션 000024의 CHECK를 한 방향으로 좁힌 근거다."
  },
  "prisma/seed.ts#4": {
    designRow: 10,
    member: "seedItemTemplates",
    stance: "code-scoped",
    predicate: "code: { in: categorySeeds.map",
    reason:
      "준비템 시드가 쓸 code→id 지도. 정식 12 code 집합으로 좁다(설계 §1.9 #10과 같은 행)."
  },

  // ── 설계 §2.3이 새로 세운 쓰기 엔드포인트의 내부(§1.9 표가 쓰인 뒤에 생긴 자리) ──────
  "src/households/custom-categories.service.ts#0": {
    designRow: null,
    member: "createCustomCategory",
    stance: "household-scoped",
    predicate: "where: { householdId }",
    reason:
      "가구당 상한 15의 분모(보관 행 포함). 그 가구의 커스텀 행만 세므로 시드도 남의 행도 들어오지 " +
      "않는다(설계 §1.7)."
  },
  "src/households/custom-categories.service.ts#1": {
    designRow: null,
    member: "createCustomCategory",
    stance: "household-scoped",
    predicate: "householdId,",
    reason:
      "커스텀 행 생성. 소유자 칸을 값으로 적는 유일한 쓰기이고, `isSystem: false`는 DB CHECK " +
      "(chk_categories_owner_is_system, 000024)가 요구하는 값이다 — 가구 소유 행은 시스템 시드일 수 없다."
  },
  "src/households/custom-categories.service.ts#2": {
    designRow: null,
    member: "updateCustomCategory",
    stance: "household-scoped",
    predicate: null,
    reason:
      "이름 변경·보관·복원의 쓰기. 위 `requireOwnCustomCategory`(#3, household-scoped)를 **먼저** " +
      "지난 id만 받으므로 인자 안에서 확인할 술어가 없다 — 어드민 update(#2)와 같은 파생 구조이고, " +
      "`updateMany`로 바꾸지 않는 이유도 같다(404가 200으로 바뀐다)."
  },
  "src/households/custom-categories.service.ts#3": {
    designRow: null,
    member: "requireOwnCustomCategory",
    stance: "household-scoped",
    predicate: "householdId }",
    reason:
      "PATCH 대상이 **그 가구의 커스텀 행**인가(설계 §2.3의 검증 순서 3번). `householdId` 술어 하나가 " +
      "시드 행(그 칸이 NULL이다)과 타 가구 행을 함께 걸러 404 `CUSTOM_CATEGORY_NOT_FOUND`로 보낸다."
  },
  "src/households/custom-categories.service.ts#4": {
    designRow: null,
    member: "requireUniqueName",
    stance: "household-scoped",
    predicate: "householdId: null",
    reason:
      "이름 중복 검사의 모집단(설계 §1.4): **시드 21행 전량 + 그 가구의 커스텀 전량**(보관 포함). " +
      "남의 가구 이름은 모집단이 아니다 — 그 이름과 겹치는 것은 막을 일이 아니고, 막으면 남의 " +
      "가구에 어떤 이름이 있는지 알려 주는 신탁이 된다."
  }
};

// ---------------------------------------------------------------------------
// 훑기 — 주석·문자열·정규식을 건너뛴 사본에서 `<무엇>.category.<동사>(`를 전수로 찾는다.
// ---------------------------------------------------------------------------

const API_ROOT = process.cwd();
/** 걷는 뿌리 둘 — 설계 §1.9가 이름으로 적은 그 둘(`apps/api/src` · `apps/api/prisma`). */
const SCAN_ROOTS = ["src", "prisma"] as const;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    // 마이그레이션 디렉터리는 SQL이라 이 훑기의 대상이 아니다.
    if (entry === "migrations" || entry === "node_modules") return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * `/` 앞의 이 토큰들 뒤에서는 슬래시가 **나눗셈이 아니라 정규식 리터럴**의 시작이다.
 * (`transaction-bounds.test.ts`의 같은 목록 — 그 파일이 라운드 82 리뷰 M-8에서 값으로 증명한
 * 목록을 그대로 쓴다. 그 훑기가 export되지 않아 이 파일이 사본을 든다.)
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
 * 소스에서 코드가 아닌 구간(줄 주석·블록 주석·문자열·템플릿 리터럴·정규식 리터럴)을 공백으로
 * 지운 사본. 길이와 줄 바꿈을 보존하므로 인덱스·줄 번호가 원본과 그대로 맞는다.
 *
 * ⚠️ 주석을 지우지 않으면 이 그물은 **자기 자신에게 걸린다** — 이 라운드가 남긴 설명문들이
 * `prisma.category.` 같은 문구를 값으로 여러 번 적기 때문이다(대장이 자기를 인용하는 자리).
 * 정규식 리터럴을 건너뛰지 않으면 극성이 뒤집힌다는 것도 라운드 82 리뷰 M-8이 실증했다.
 */
function blankNonCode(source: string): string {
  const out = source.split("");
  let index = 0;
  let previous = "";
  const blankTo = (end: number) => {
    for (; index < end && index < source.length; index += 1) {
      if (source[index] !== "\n") out[index] = " ";
    }
  };
  const regexCanStartHere = (): boolean => {
    if (previous === "") return true;
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

/** 호출 앞쪽에서 가장 가까운 **선언 줄**을 찾아 그 이름을 돌려준다(줄 번호를 신원으로 쓰지 않기 위함). */
function enclosingMember(code: string, callIndex: number): string {
  const before = code.slice(0, callIndex);
  const declaration =
    /^[ \t]*(?:(?:export|private|public|protected|static|readonly|abstract|override)\s+)*(?:async\s+)?(?:function\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*(?:<[^>\n]*>)?\s*\(/gm;
  let member = "(top level)";
  for (let match = declaration.exec(before); match !== null; match = declaration.exec(before)) {
    if (NOT_A_MEMBER.has(match[1])) continue;
    if (!looksLikeDeclaration(code, match.index + match[0].length - 1)) continue;
    member = match[1];
  }
  return member;
}

/** 그 호출의 인자 목록 전체(괄호 균형으로 잘라 낸 원본 조각). */
function callArguments(code: string, openParenIndex: number): string {
  let depth = 0;
  for (let cursor = openParenIndex; cursor < code.length; cursor += 1) {
    const char = code[cursor];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(openParenIndex + 1, cursor);
    }
  }
  return code.slice(openParenIndex + 1);
}

type CategorySite = {
  /** `파일경로#순번` — 대장의 키. */
  key: string;
  file: string;
  line: number;
  member: string;
  verb: string;
  argumentsText: string;
};

/**
 * 바늘은 **`.category.<동사>(`** 다 — 수신자 이름(`this.prisma` · `tx` · `client` · 앞으로
 * 생길 무엇이든)을 묻지 않는 쪽이 fail-closed다. `.categoryBudget.`은 이름이 달라 걸리지 않고,
 * `row.category.name`처럼 뒤에 `(`가 없는 접근도 걸리지 않는다.
 */
const CATEGORY_CALL = /\.category\.([A-Za-z]+)\s*\(/g;

function collectCategorySites(): CategorySite[] {
  const sites: CategorySite[] = [];
  for (const root of SCAN_ROOTS) {
    const files = listSourceFiles(join(API_ROOT, root)).sort();
    for (const file of files) {
      const code = blankNonCode(readFileSync(file, "utf8"));
      const relativePath = [root, relative(join(API_ROOT, root), file)].join(sep).split(sep).join("/");
      let ordinal = 0;
      CATEGORY_CALL.lastIndex = 0;
      for (let match = CATEGORY_CALL.exec(code); match !== null; match = CATEGORY_CALL.exec(code)) {
        const openParen = match.index + match[0].length - 1;
        sites.push({
          key: `${relativePath}#${ordinal}`,
          file: relativePath,
          line: code.slice(0, match.index).split("\n").length,
          member: enclosingMember(code, match.index),
          verb: match[1],
          argumentsText: callArguments(code, openParen)
        });
        ordinal += 1;
      }
    }
  }
  return sites;
}

describe("라운드 103 T1 — categories 소유자 필터 대장 (설계 §1.9)", () => {
  const sites = collectCategorySites();

  it("훑기 자체가 실재하는 자리를 찾는다 (주석 안의 언급은 세지 않는다)", () => {
    // 그물이 비면 아래 계약들이 조용히 통과한다 — 그물 자신을 먼저 고정한다.
    expect(sites.length).toBeGreaterThan(0);
    // 뿌리 둘 다에서 자리가 나온다(한쪽만 걸으면 대장의 절반이 유령이 된다).
    expect(sites.some((site) => site.file.startsWith("src/"))).toBe(true);
    expect(sites.some((site) => site.file.startsWith("prisma/"))).toBe(true);

    // 설계 §1.9가 이름으로 적은 파일들이 실제로 걸린다.
    for (const file of [
      "src/finance/categories.controller.ts",
      "src/admin/admin-categories.service.ts",
      "src/finance/milestone-report.service.ts",
      "src/onboarding/expenses-store.service.ts",
      "src/onboarding/import-pipeline.service.ts",
      "src/onboarding/onboarding-core.service.ts",
      "prisma/seed.ts"
    ]) {
      expect(sites.some((site) => site.file === file), `${file}에서 자리를 못 찾았어요`).toBe(true);
    }

    // ⚠️ 주석 안의 언급은 세지 않는다 — 이 라운드의 설명문들이 그 문구를 값으로 여러 번 적는다.
    //    (`admin-categories.service.ts`는 주석에서 `prisma.category.` 를 부르지만 자리는 넷이다.)
    // 라운드 107 D6이 셋 → 넷으로 늘렸다: 어드민 이름 변경의 중복 검사(`requireUniqueSeedName`,
    // 등재 `#3`)가 저장 전에 시드 전량의 이름을 한 번 읽는다.
    expect(sites.filter((site) => site.file === "src/admin/admin-categories.service.ts")).toHaveLength(4);
    // 그리고 `.categoryBudget.`은 이름이 달라 이 바늘에 걸리지 않는다.
    expect(sites.some((site) => site.verb === "" || site.member === "readCategoryBudgets")).toBe(false);
  });

  it("모든 자리가 대장에 등재돼 있다 (등재 없는 새 자리 = 빨강)", () => {
    const missing = sites
      .filter((site) => !(site.key in CATEGORY_READ_LEDGER))
      .map((site) => `${site.key} (${site.member}, ${site.file}:${site.line}, .${site.verb})`);
    expect(
      missing,
      "categories를 읽는 새 자리가 소유자 필터 대장에 없어요 — 설계 §1.9의 입장(stance)과 " +
        "이유를 한 줄 적어 주세요(등재 없는 자리는 기본값이 빨강입니다)"
    ).toEqual([]);
  });

  it("대장에 낡은 줄이 남지 않는다 (사라진 자리)", () => {
    const present = new Set(sites.map((site) => site.key));
    const stale = Object.keys(CATEGORY_READ_LEDGER).filter((key) => !present.has(key));
    // 이유가 사라진 줄이 남으면 다음 라운드가 그것을 근거로 인용한다 — 대장은 양방향이다.
    expect(stale).toEqual([]);
  });

  it("등재가 실제로 그 자리를 가리킨다 (감싼 메서드 · 빈 이유 금지 · 알려진 입장)", () => {
    for (const site of sites) {
      const entry = CATEGORY_READ_LEDGER[site.key];
      // 등재 자체가 없는 자리는 위 계약이 이미 이름으로 보고했다 — 여기서 한 번 더 터뜨려
      // 메시지를 흐리지 않는다.
      if (!entry) continue;
      // 왼쪽이 대장이 적어 둔 메서드, 오른쪽이 소스에서 실제로 감싸고 있는 메서드다.
      expect({ key: site.key, member: entry.member }).toEqual({ key: site.key, member: site.member });
      expect(entry.reason.trim().length, `${site.key}의 이유가 비었어요`).toBeGreaterThan(0);
      expect(
        ["household-scoped", "system-only", "id-derived", "code-scoped"],
        `${site.key}의 입장이 알려진 넷이 아니에요`
      ).toContain(entry.stance);
    }
  });

  it("술어를 적은 자리는 그 술어가 인자 안에 실제로 있다 (이름표만 붙인 등재 금지)", () => {
    const broken = sites
      .filter((site) => {
        const entry = CATEGORY_READ_LEDGER[site.key];
        return entry !== undefined && entry.predicate !== null && !site.argumentsText.includes(entry.predicate);
      })
      .map((site) => `${site.key} (${site.file}:${site.line}) — "${CATEGORY_READ_LEDGER[site.key].predicate}"`);
    expect(broken, "대장이 적은 술어가 그 호출의 인자에 없어요 — 필터가 빠졌거나 대장이 낡았어요").toEqual([]);
  });

  it("술어 없이 통과하는 자리는 파생·안전 축이거나 그 이유가 파생을 이름으로 말한다", () => {
    const withoutPredicate = sites.filter((site) => CATEGORY_READ_LEDGER[site.key]?.predicate === null);
    // 유령 방지: 술어 없는 자리가 전부여서는 안 된다(그러면 이 계약이 아무것도 지키지 않는다).
    expect(withoutPredicate.length).toBeLessThan(sites.length / 2);
    for (const site of sites) {
      const entry = CATEGORY_READ_LEDGER[site.key];
      if (!entry || entry.predicate !== null) continue;
      // `id-derived`는 술어가 없는 것이 옳은 유일한 입장이고, 나머지 입장으로 술어를 비우려면
      // **이유가 어느 선행 검사에서 파생하는지를 이름으로** 말해야 한다(파생이 끊기면 거짓이 된다).
      if (!STANCES_WITHOUT_PREDICATE.has(entry.stance)) {
        expect(
          /findById|requireOwnCustomCategory/.test(entry.reason),
          `${site.key}: 술어 없이 ${entry.stance}로 등재하려면 어느 선행 검사에서 좁아지는지를 이유에 적어 주세요`
        ).toBe(true);
      }
    }
  });

  it("설계 §1.9 표의 열 자리가 전부 등재돼 있다 (빠진 행 없음 · 번호 중복 없음)", () => {
    const entries = Object.values(CATEGORY_READ_LEDGER);
    const designRows = entries
      .map((entry) => entry.designRow)
      .filter((row): row is number => row !== null)
      .sort((left, right) => left - right);
    // #10(시드)만 한 행이 여러 자리를 덮는다 — 설계 표가 `seed.ts:24,59,95`라고 적은 그대로다.
    // ⚠️ 두 시점(라운드 107 트랙 E): 종전에는 **셋**이었다(그때는 참) → 이제 **다섯**이다.
    // 트랙 E 가 "시드는 있는 행을 고치지 않는다"는 경계를 세우면서 두 upsert 앞에 존재 확인
    // findUnique 를 넣었다. 늘어난 둘도 같은 설계 행(#10)의 자리다 — 읽는 모집단과 좁히는
    // 술어가 그 아래 upsert 와 같고(code / 고정 id), 새 판정 축이 생긴 것이 아니라 같은 축을
    // 한 번 먼저 읽을 뿐이기 때문이다. 그래서 설계 표에 행을 더하지 않고 #10 의 자리 수를 늘렸다.
    expect(designRows).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10]);
    expect(new Set(designRows).size).toBe(10);
    // 표 밖의 자리(= 이 라운드가 세운 쓰기 엔드포인트 내부)도 실재한다.
    expect(entries.filter((entry) => entry.designRow === null).length).toBeGreaterThan(0);
  });

  /**
   * 그물 자신의 계약 — 전수를 자처하는 훑기가 소스의 한 모양에서 극성을 뒤집으면, 그 뒤의 모든
   * 판정이 조용히 틀린 채 초록으로 남는다(라운드 82 리뷰 M-8이 실증한 그 결함).
   */
  it("훑기가 주석·문자열·정규식을 코드가 아닌 구간으로 건너뛴다", () => {
    // ⓐ 주석 안의 호출 모양은 세지 않는다.
    const commented = blankNonCode(
      ["// await this.prisma.category.findMany({});", "const x = 1;"].join("\n")
    );
    expect(commented).not.toContain("category.findMany");
    expect(commented).toContain("const x = 1;");

    // ⓑ 문자열 안의 호출 모양도 세지 않는다.
    const inString = blankNonCode('const s = "prisma.category.deleteMany(";\nconst y = 2;');
    expect(inString).not.toContain("category.deleteMany");
    expect(inString).toContain("const y = 2;");

    // ⓒ 진짜 코드는 남는다 — 그리고 그 자리에서 인자를 잘라 낼 수 있다.
    const real = "await tx.category.findMany({ where: { id: { in: ids }, householdId: null } });";
    const kept = blankNonCode(real);
    expect(kept).toBe(real);
    CATEGORY_CALL.lastIndex = 0;
    const match = CATEGORY_CALL.exec(kept)!;
    expect(match[1]).toBe("findMany");
    expect(callArguments(kept, match.index + match[0].length - 1)).toContain("householdId: null");

    // ⓓ 길이·줄 번호는 보존된다(인덱스 계산의 전제).
    for (const sample of ['const r = /["\\s]/g;\nconst s = "x";', "const half = (a + b) / 2;"]) {
      expect(blankNonCode(sample)).toHaveLength(sample.length);
      expect(blankNonCode(sample).split("\n")).toHaveLength(sample.split("\n").length);
    }
  });
});
