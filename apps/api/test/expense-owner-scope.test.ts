import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 108 트랙 C(C-1) — **`expenses` 표 소유자 필터의 대장.**
 *
 * ## 왜 이 표에 대장을 세우나 (정찰이 센 근거)
 * 권한 경계 정찰이 `apps/api/src`의 `prisma.<모델>.<동사>(` 자리를 전수로 세고 사용자 데이터를
 * 네 입장으로 분류한 결과, **소유자 술어도 선행 검사도 없는 자리는 0건**이었다 — 오늘 코드는
 * 안전하다. 문제는 그 안전을 **유지하는 장치가 표마다 없다**는 것이고, 그중 `expenses`가 가장
 * 위험하다:
 *   ① 모집단이 가장 크다 — 사용자 요청 존만 29자리(`categories` 15의 두 배).
 *   ② 소유자 칸이 **둘**이다 — `household_id` **와** `child_id`(`categories`는 하나뿐이다).
 *      그래서 "좁혔다"는 말이 두 축으로 갈리고, 어느 축으로 좁혔는지를 적지 않으면 다음 사람이
 *      `childId`만 보고 "가구로도 좁았겠지"라고 읽는다.
 *   ③ 인가가 **두 벌**이다 — `ExpensesVersionService.authorizeExpenseRow`(PATCH/DELETE)와
 *      `ExpensesStoreService.requireExpenseAccess`(GET·목록). 한 벌이 망가져도 다른 벌이
 *      초록이라 소스만 봐서는 어느 쪽이 죽었는지 알 수 없다.
 *   ④ 새는 값이 가장 아프다 — 품목명·판매처·메모·금액. 라운드 107이 그 문자열들을 감사 봉투에서
 *      빼내느라 트랙 하나를 통째로 쓴, 바로 그 값들이다.
 *
 * 그래서 이 파일이 세우는 계약은 하나다: **`apps/api/src`와 `apps/api/prisma`의 모든
 * `<무엇>.expense.<동사>(` 호출은 아래 대장에 입장(stance)·구역(zone)·이유를 달고 등재돼 있다.**
 * 새 자리가 생기면 등재가 없으므로 **기본값이 빨강**이고, 그때 재는 사람이 그 자리가 어느
 * 입장인지 정해 한 줄을 적는다. 형식은 `category-owner-scope.test.ts`(라운드 103 T1)를 그대로
 * 복제했고 — 전수 훑기(주석·문자열·정규식을 지운 사본에서) · 양방향 잠금 · 이유 필수 ·
 * 감싼 메서드 대조 — **바늘과 입장만** 이 표에 맞게 바꿨다.
 *
 * ⚠️ **양방향이다.** 대장에만 있고 소스에는 없는 줄(= 낡은 등재)도 빨개진다 — 이유가 사라진
 * 줄이 남으면 다음 라운드가 그 줄을 근거로 인용하게 된다.
 *
 * ⚠️ 그리고 **등재만으로 초록이 되지 않는다.** 술어를 적은 자리는 그 술어가 호출 인자(또는
 * 인자가 참조하는 `where` 바인딩) 안에서 **글자로 보여야** 하고, 선행 검사에 기대는 자리는
 * 그 검사의 **이름과 파일**을 적어야 하며 그 이름이 그 파일의 코드에 실재해야 한다.
 * 등재는 선언이고 술어·검사는 값이라, 이름표만 붙이는 등재를 이 계약이 거절한다.
 *
 * DB가 필요 없는 순수 소스 계약이다(그래서 앱을 띄우지 않는다).
 */

/**
 * 자리의 입장 일곱. 앞의 다섯은 사용자 요청 존의 축이고, 뒤의 둘은 사용자가 없는 존이다.
 *
 *  · `household-scoped`     — `where`가 `householdId`로 좁는다. 그 값은 호출자의 소속
 *                             (`user.households`)이거나 이미 인가된 행의 가구다.
 *  · `child-scoped`         — `where`가 `childId`로 좁는다. **그 `childId`를 호출자(또는 그 행)에
 *                             묶는 자리**는 이 호출 밖에 있으므로 `gate`가 이름으로 가리킨다.
 *                             (소유자 칸이 둘이라 `categories`보다 입장이 하나 더 필요한 지점이다 —
 *                             `expenses.household_id`는 그 아이의 가구와 같으므로 두 축 중 어느
 *                             쪽으로 좁혔는지가 실제로 갈린다.)
 *  · `authorization-input`  — **인가 검사에 먹일 행을 읽는 자리.** 소유자 술어를 넣으면 안 된다:
 *                             검사가 `row.householdId`를 봐야 하고, 술어로 걸러 버리면 403이
 *                             404로 조용히 바뀌어 "남의 지출이 없는 것처럼" 보인다. 대신 읽은
 *                             행이 **밖으로 나가기 전에** `gate`가 반드시 던진다.
 *  · `access-derived`       — `where`에 소유자 칸이 없고, 같은 요청 안의 **선행 검사**가 이미 그
 *                             id를 좁혔다. `gate`가 그 검사의 이름이다.
 *  · `id-derived`           — 술어의 id(집합)가 **이미 소유자로 좁힌 읽기/쓰기의 결과**라 남의 행이
 *                             들어올 수 없다(소유자 필터를 더해도 항등이다).
 *  · `operator-zone`        — 어드민 콘솔. 운영자는 가구 구성원이 아니므로 가구로 좁히지 **않는
 *                             것이 의도**다. 이유가 무엇이 밖으로 나가는지(건수인지 행 내용인지)를
 *                             말해야 한다 — 라운드 100·102의 "어드민에 개인 데이터 표면을
 *                             신설하지 않는다"가 여기서 지켜지는지가 그 문장으로 판정된다.
 *  · `system-zone`          — 워커(사용자 없음). 가구로 좁히지 않는 것이 의도이지만 **잡 자신의
 *                             기준**(보존 기한 컷오프 · 대상 id 집합)으로는 반드시 좁는다 —
 *                             술어 없는 전역 쓸기(`deleteMany({})`)는 여기서 빨강이다.
 */
type Stance =
  | "household-scoped"
  | "child-scoped"
  | "authorization-input"
  | "access-derived"
  | "id-derived"
  | "operator-zone"
  | "system-zone";

/** 그 자리가 어느 존에 서 있나. 경로에서 파생하지만 **등재가 스스로 적어야** 한다(대조한다). */
type Zone = "app" | "push" | "admin" | "worker" | "seed";

/** `predicate: null`이 허용되는 입장들. 나머지 입장은 술어를 글자로 보여야 한다. */
const STANCES_WITHOUT_PREDICATE: ReadonlySet<Stance> = new Set<Stance>(["access-derived", "operator-zone"]);

/** `gate`(선행 검사 이름)를 **반드시** 적어야 하는 입장들. */
const STANCES_REQUIRING_GATE: ReadonlySet<Stance> = new Set<Stance>([
  "child-scoped",
  "authorization-input",
  "access-derived",
  "id-derived"
]);

/**
 * 소유자 칸 둘. `household-scoped`/`child-scoped`로 등재하려면 그 축이 술어에 실제로 서야 하고,
 * 반대로 소유자 칸이 술어에 보이는데 `access-derived`/`authorization-input`으로 등재하면
 * **입장을 약하게 적은 것**이라 거절한다(대장이 실제보다 위험하게 읽히는 것도 거짓이다).
 */
const OWNER_AXES = { household: /\bhouseholdId\b/, child: /\bchildId\b/ } as const;

type LedgerEntry = {
  /** 그 호출을 감싼 메서드 이름. 순번만으로는 재배치를 잡지 못하므로 함께 대조한다. */
  member: string;
  zone: Zone;
  stance: Stance;
  /**
   * 그 호출의 **인자(또는 인자가 참조하는 `where` 바인딩) 안에서 그대로 보여야 하는** 술어 조각.
   * 확인할 수 없는 자리만 `null`(그 입장은 위 STANCES_WITHOUT_PREDICATE 둘뿐이다).
   */
  predicate: string | null;
  /** 선행 검사의 이름. `gateFile`의 코드에 그 이름이 실재해야 한다. */
  gate: string | null;
  /** `gate`가 사는 파일(생략하면 그 자리와 같은 파일). */
  gateFile?: string;
  /** 빈 문자열 금지 — 자리만 채운 등재는 대장이 아니다. */
  reason: string;
};

const EXPENSES_FILE = "src/finance/expenses.service.ts";
const STORE_FILE = "src/onboarding/expenses-store.service.ts";
const IMPORT_FILE = "src/onboarding/import-pipeline.service.ts";
const CHILD_ACCESS_FILE = "src/onboarding/child-access.service.ts";

/**
 * 키는 `파일경로#파일 안 순번`이다(줄 번호를 키로 쓰면 위쪽 한 줄만 늘어도 대장 전체가 낡는다 —
 * `transaction-bounds`·`category-owner-scope` 대장의 관례 그대로).
 */
const EXPENSE_OWNER_LEDGER: Readonly<Record<string, LedgerEntry>> = {
  // ── 어드민 존(운영자 토큰) ────────────────────────────────────────────────────
  "src/admin/admin-users-lookup.service.ts#0": {
    member: "search",
    zone: "admin",
    stance: "operator-zone",
    predicate: "createdByUserId: { in: userIds }",
    gate: null,
    reason:
      "어드민 사용자 조회의 '이 사람이 남긴 지출 건수'. 밖으로 나가는 것은 **건수뿐**이고 " +
      "행 내용(품목명·판매처·메모·금액)은 한 글자도 싣지 않는다 — 라운드 100·102가 그은 " +
      "'어드민에 개인 데이터 표면을 신설하지 않는다'는 선이 여기서 지켜지는 방식이다. " +
      "가구로 좁히지 않는 것이 의도(운영자는 구성원이 아니다)이고, 대신 조회 대상 사용자 " +
      "id 집합으로 좁으며 soft delete 된 행은 세지 않는다(DNC-014)."
  },
  "src/admin/dashboard-summary.service.ts#0": {
    member: "getSummary",
    zone: "admin",
    stance: "operator-zone",
    predicate: null,
    gate: null,
    reason:
      "어드민 대시보드의 전체 지출 **건수 하나**(스칼라 COUNT). 이 대장에서 술어가 없는 유일한 " +
      "읽기이고, 그래도 되는 이유는 응답이 정수 하나라 어느 가구·어느 아이도 지목하지 " +
      "않기 때문이다. ⚠️ 여기에 `where`나 `select`가 붙어 **행**을 돌려주는 날 이 이유는 " +
      "거짓이 되므로, 그때 이 자리는 입장을 다시 정해야 한다."
  },

  // ── 사용자 요청 존 ① 낙관적 잠금 계층(ExpensesVersionService) ─────────────────
  // 이 파일의 열 자리 중 **여덟**이 `{ where: { id } }` 뿐이다. 그 여덟을 지키는 것은
  // 인가 두 벌 중 한 벌인 `authorizeExpenseRow` 하나뿐이므로, 아래 등재는 전부 그 이름을
  // gate 로 지목한다 — 그 메서드가 사라지거나 이름이 바뀌면 이 대장이 먼저 빨개진다.
  [`${EXPENSES_FILE}#0`]: {
    member: "updateExpense",
    zone: "app",
    stance: "authorization-input",
    predicate: "id: expenseId",
    gate: "authorizeExpenseRow",
    reason:
      "PATCH의 인가 입력. 바로 다음 줄이 `authorizeExpenseRow(user, raw, true)`이고, 그 검사가 " +
      "`row.householdId`로 역할을 찾으므로 여기에 소유자 술어를 넣으면 **검사가 볼 것이 " +
      "사라진다**. 술어로 걸렀다면 남의 지출이 403이 아니라 404로 나가 '그런 지출은 없다'는 " +
      "거짓을 말하게 된다(오늘 계약은 403 FORBIDDEN — expenses-version.db.test.ts가 고정한다)."
  },
  [`${EXPENSES_FILE}#1`]: {
    member: "updateExpense",
    zone: "app",
    stance: "access-derived",
    predicate: "id: expenseId",
    gate: "authorizeExpenseRow",
    reason:
      "expectedVersion 없는 갈래의 version 증가. 이 메서드 첫머리의 `authorizeExpenseRow`를 " +
      "**먼저** 지난 id만 여기 닿는다. ⚠️ 그 순서가 뒤집히는 날(검사보다 먼저 쓰는 날) 이 " +
      "줄의 이유가 거짓이 된다."
  },
  [`${EXPENSES_FILE}#2`]: {
    member: "updateExpense",
    zone: "app",
    stance: "access-derived",
    predicate: "id: expenseId, version: expectedVersion",
    gate: "authorizeExpenseRow",
    reason:
      "낙관적 잠금의 CAS(compare-and-swap). 술어의 `version`은 동시성 가드이지 소유자 술어가 " +
      "아니다 — 소유는 위 `authorizeExpenseRow`가 이미 판정했다. 0건이면 409 VERSION_CONFLICT."
  },
  [`${EXPENSES_FILE}#3`]: {
    member: "updateExpense",
    zone: "app",
    stance: "access-derived",
    predicate: "id: expenseId",
    gate: "authorizeExpenseRow",
    reason: "CAS 성공 뒤 최종 version 재조회(`select: { version: true }` — 행 내용은 읽지 않는다)."
  },
  [`${EXPENSES_FILE}#4`]: {
    member: "deleteExpense",
    zone: "app",
    stance: "authorization-input",
    predicate: "id: expenseId",
    gate: "authorizeExpenseRow",
    reason: "DELETE의 인가 입력. 근거는 위 #0과 같다(검사가 볼 행을 읽는 자리라 소유자 술어를 넣지 않는다)."
  },
  [`${EXPENSES_FILE}#5`]: {
    member: "deleteExpense",
    zone: "app",
    stance: "access-derived",
    predicate: "id: expenseId",
    gate: "authorizeExpenseRow",
    reason: "expectedVersion 없는 갈래의 version 증가. `authorizeExpenseRow`를 먼저 지난 id만 닿는다."
  },
  [`${EXPENSES_FILE}#6`]: {
    member: "deleteExpense",
    zone: "app",
    stance: "access-derived",
    predicate: "id: expenseId, version: expectedVersion",
    gate: "authorizeExpenseRow",
    reason: "삭제 쪽 CAS. 근거는 #2와 같다."
  },
  [`${EXPENSES_FILE}#7`]: {
    member: "versionConflictFor",
    zone: "app",
    stance: "household-scoped",
    predicate: "householdId: { in: householdIds }",
    gate: "authorizeExpenseRow",
    reason:
      "⚠️ **이 대장에서 가장 조심할 자리다.** 여기서 읽은 행이 409 응답의 `current`로 " +
      "**밖으로 나간다**(품목명·판매처·메모·금액을 담은 스냅샷). " +
      "⚠️ 두 시점(라운드 108 T24 후속) — **종전**에는 이 자리가 `access-derived`였고 술어는 " +
      "`id: expenseId` 하나였다. 그때의 이유도 참이었다: 두 호출자(updateExpense·deleteExpense) " +
      "모두 `authorizeExpenseRow`를 지난 뒤에만 이 메서드를 부른다(그 사실은 **지금도 참**이고, " +
      "이 후속 트랙이 두 호출부를 전수로 다시 따라가 확인했다 — 오늘 실제로 새는 값은 없었다). " +
      "그런데 T24가 역돌연변이로 재어 보니, 그 관문 **한 벌만** 지웠을 때 성공 갈래는 스토어의 " +
      "`requireExpenseAccess`가 대신 403을 던져 테스트가 전부 초록이었고 **CAS가 실패하는 이 " +
      "갈래에서만** 남의 지출 원문이 409로 나갔다 — 인가 두 벌이 서로를 가려, 보장이 서 있는 " +
      "줄이 죽어도 아무도 보지 못했다. **지금**은 읽기 자체가 호출자의 가구 집합으로 좁는다 " +
      "(`householdIds`는 `user.households.map(h => h.id)` — sync.service.ts#0과 같은 모양). " +
      "관문이 살아 있는 오늘은 **항등**이라 사용자에게 나가는 축은 하나도 줄지 않았고, 관문이 " +
      "한 겹 죽는 날에는 이 읽기가 0건을 돌려주어 `current`가 null이 된다."
  },
  [`${EXPENSES_FILE}#8`]: {
    member: "hydrateOne",
    zone: "app",
    stance: "id-derived",
    predicate: "id: dto.id",
    gate: "requireExpenseAccess",
    gateFile: STORE_FILE,
    reason:
      "단건 응답에 version만 덧입힌다. `dto.id`는 **스토어가 방금 돌려준 DTO의 id**이고 그 DTO는 " +
      "`ExpensesStoreService.requireExpenseAccess`(인가 두 벌 중 다른 한 벌)를 지나야 만들어진다 — " +
      "남의 id가 들어올 수 없어 소유자 필터를 더해도 항등이다. 생성 경로(createExpense)의 id도 " +
      "방금 그 사용자가 만든 행이다. `select: { version: true }`라 행 내용은 읽지 않는다."
  },
  [`${EXPENSES_FILE}#9`]: {
    member: "hydrateMany",
    zone: "app",
    stance: "id-derived",
    predicate: "id: { in: dtos.map((dto) => dto.id) }",
    gate: "requireChildAccess",
    gateFile: STORE_FILE,
    reason:
      "목록·홈의 version 덧입히기. id 집합이 `listExpenses`/`hydrateHome`이 이미 받아 든 DTO 배열에서 " +
      "파생하고, 그 배열은 `ExpensesStoreService.listExpenses`→`requireChildAccess`(또는 홈의 같은 " +
      "관문)를 지난 뒤에만 존재한다. `select: { id, version }`라 행 내용은 읽지 않는다."
  },

  // ── 사용자 요청 존 ② 100일/첫돌 리포트 ───────────────────────────────────────
  // ⚠️ 두 시점(라운드 108 트랙 C, C-3): **종전**에는 이 두 자리의 gate 가
  // `MilestoneReportService.requireChildView` 였다 — 저장소에서 아이 인가를 두 번째로
  // 구현한 유일한 자리였고, 그 메서드의 주석 스스로가 "mirroring ChildAccessService.
  // requireChildAccess" 라고 적고 있었다(그때는 참). **지금**은 그 사본을 지우고
  // `ChildAccessService`를 주입했으므로 gate 가 다른 모든 아이 경로와 같은 한 벌
  // (`requireChildAccess`)을 가리킨다. 두 구현의 거동은 대조 결과 완전히 같았다:
  // 같은 `child.findUnique` → `!child || child.deletedAt` → 404 CHILD_NOT_FOUND →
  // 역할 조회(`memberRoleFor`와 글자까지 같은 식) → 403 FORBIDDEN, 문구도 동일.
  // `edit` 인자만 사본에 없었고 리포트는 읽기라 기본값 false 로 같다.
  "src/finance/milestone-report.service.ts#0": {
    member: "getMilestoneReport",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: CHILD_ACCESS_FILE,
    reason:
      "100일/첫돌 창의 합계·건수. 술어는 호출 인자에 직접 서지 않고 바로 위의 `const where` " +
      "바인딩에 담겨 있다(이 훑기가 그 바인딩까지 따라간다). 축은 **아이**이고, 그 아이가 " +
      "호출자의 가구인지는 메서드 첫 줄의 `requireChildAccess`가 판정한다."
  },
  "src/finance/milestone-report.service.ts#1": {
    member: "getMilestoneReport",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: CHILD_ACCESS_FILE,
    reason: "같은 창의 분류별 groupBy(상위 5 분류). 술어·gate 는 #0과 같은 `where` 바인딩·같은 관문이다."
  },

  // ── 사용자 요청 존 ③ 지출 스토어(ExpensesStoreService) ────────────────────────
  [`${STORE_FILE}#0`]: {
    member: "createExpenseRowOrTranslateFk",
    zone: "app",
    stance: "access-derived",
    predicate: null,
    gate: "requireChildAccess",
    gateFile: STORE_FILE,
    reason:
      "행 삽입(FK 위반을 400으로 옮기는 래퍼). 인자가 통째로 변수(`args`)라 확인할 술어가 없다 — " +
      "소유자 칸(`householdId`·`childId`)은 호출자 `insertExpense`가 값으로 적어 넣고, 그 두 값은 " +
      "수동 생성 경로에서는 `createExpense`→`requireChildAccess(user, childId, true)`가, 가져오기 " +
      "확정 경로에서는 `requireImportJobAccess(edit)`가 이미 판정한 것이다(그 메서드 머리말의 " +
      "'⚠️ 호출 전 접근검증 필수' 규약). ⚠️ 그 규약을 어기는 새 호출자가 생기면 이 줄이 거짓이 된다."
  },
  [`${STORE_FILE}#1`]: {
    member: "updateExpense",
    zone: "app",
    stance: "access-derived",
    predicate: "id: expense.id",
    gate: "requireExpenseAccess",
    gateFile: STORE_FILE,
    reason:
      "GET·목록 쪽 인가 한 벌(`requireExpenseAccess(user, expenseId, true)`)이 돌려준 행의 id로만 " +
      "쓴다. 소유자 술어를 넣지 않는 이유는 어드민 update 와 같다 — `updateMany`로 바꾸면 " +
      "'없으면 0건 갱신'이 되어 404가 200으로 조용히 바뀐다."
  },
  [`${STORE_FILE}#2`]: {
    member: "deleteExpense",
    zone: "app",
    stance: "access-derived",
    predicate: "id: expense.id",
    gate: "requireExpenseAccess",
    gateFile: STORE_FILE,
    reason:
      "soft delete(DNC-014 — 행을 지우지 않고 `deletedAt`을 적는다). 대상 행은 위 #1과 같은 " +
      "`requireExpenseAccess(…, true)`가 이미 골라 놓은 것이다."
  },
  [`${STORE_FILE}#3`]: {
    member: "requireExpenseAccess",
    zone: "app",
    stance: "authorization-input",
    predicate: "id: expenseId",
    gate: "requireChildAccess",
    gateFile: STORE_FILE,
    reason:
      "**인가 두 벌 중 GET·목록 쪽 한 벌의 입력.** 읽은 행의 `childId`를 곧바로 " +
      "`requireChildAccess(user, expense.childId, edit)`에 먹이므로 여기 소유자 술어를 넣으면 " +
      "검사가 볼 것이 사라진다(위 expenses.service #0과 같은 구조). 이 자리가 죽으면 남의 지출 " +
      "상세(품목명·판매처·메모·금액)가 200으로 나가므로, 그 거동은 " +
      "expenses-version.db.test.ts의 `GET /expenses/:id` 403 단언이 값으로 고정한다."
  },
  [`${STORE_FILE}#4`]: {
    member: "expensesForChild",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: STORE_FILE,
    reason:
      "기록 탭·홈이 쓰는 목록 조회(keyset 커서). 축은 **아이**이고, 그 아이가 호출자의 것인지는 " +
      "이 메서드가 판정하지 않는다 — 머리말이 '⚠️ 호출 전 접근검증 필수'라고 적은 그대로 " +
      "`listExpenses`/`getHome`이 먼저 `requireChildAccess`를 통과시킨다."
  },
  [`${STORE_FILE}#5`]: {
    member: "sumExpenses",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: STORE_FILE,
    reason:
      "조회 범위 전체의 합계(DNC-015 — `expenseType: \"expense\"`로 선물 제외). 축과 관문은 #4와 같다."
  },

  // ── 사용자 요청 존 ④ 가져오기 파이프라인 ─────────────────────────────────────
  [`${IMPORT_FILE}#0`]: {
    member: "undoImport",
    zone: "app",
    stance: "household-scoped",
    predicate: "householdId: job.householdId",
    gate: "requireImportJobAccess",
    gateFile: IMPORT_FILE,
    reason:
      "되돌리기가 지울 **살아 있는** 행 조회. 이 대장에서 **가구 축**으로 좁는 세 자리 중 하나다 " +
      "(라운드 108 T24 후속으로 `expenses.service.ts#7`이 합류하기 전에는 둘이었다) — " +
      "`importJobId`만으로도 오늘은 좁지만, 잡의 가구를 함께 걸어 '남의 잡 id를 알아낸 사람이 " +
      "남의 지출을 지우는' 길을 술어로 막는다. `job`은 `requireImportJobAccess(edit)`가 돌려준 것이다."
  },
  [`${IMPORT_FILE}#1`]: {
    member: "undoImport",
    zone: "app",
    stance: "id-derived",
    predicate: "id: { in: alive.map((expense) => expense.id) }",
    gate: "requireImportJobAccess",
    gateFile: IMPORT_FILE,
    reason:
      "위 #0이 고른 id 집합만 soft delete 한다 — 그 집합이 이미 가구로 좁으므로 소유자 필터를 " +
      "더해도 항등이다. `deletedAt: null`을 다시 거는 것은 소유가 아니라 경합(그 사이 사용자가 " +
      "손으로 지운 행의 삭제 시각을 덮지 않기) 때문이다."
  },
  [`${IMPORT_FILE}#2`]: {
    member: "insertImportedExpenses",
    zone: "app",
    stance: "access-derived",
    predicate: null,
    gate: "requireImportJobAccess",
    gateFile: IMPORT_FILE,
    reason:
      "확정 트랜잭션의 배치 삽입. 인자가 `{ data: expenseRows }`라 확인할 술어가 없고, 소유자 칸은 " +
      "바로 위에서 `job.householdId`·`job.childId`로 채운다 — 그 `job`은 " +
      "`requireImportJobAccess(user, importJobId, true)`가 돌려준 것이다(DNC-012 — 승인 전에는 " +
      "expenses 에 넣지 않는다)."
  },
  [`${IMPORT_FILE}#3`]: {
    member: "buildImportRowsFromParsed",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: IMPORT_FILE,
    reason:
      "미리보기의 중복 후보 찾기. 축은 **아이**이고 관문은 업로드 경로의 " +
      "`requireChildAccess(user, childId, true)`다. 좁히지 않으면 '같은 날·같은 금액'이라는 " +
      "조건만으로 남의 지출 id가 미리보기 행에 실린다."
  },

  // ── 사용자 요청 존 ⑤ 준비템 상세 ─────────────────────────────────────────────
  "src/onboarding/items-catalog.service.ts#0": {
    member: "linkedExpenseDto",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: "src/onboarding/items-catalog.service.ts",
    reason:
      "준비템 상세에 붙는 '연결된 지출'(금액·날짜). id와 **아이**를 함께 걸어, 다른 아이의 지출 id가 " +
      "`child_item_statuses.expense_id`에 남아 있어도 금액이 새지 않는다(그 파일 주석의 '방어적 " +
      "좁히기'). `deletedAt: null`은 소유가 아니라 정확성 조건이다 — 지운 지출의 금액이 상세에 " +
      "남으면 총액과 어긋나는 허위 표시가 된다."
  },

  // ── 사용자 요청 존 ⑥ 되돌릴 수 없는 쓰기(아이 프로필 삭제) ────────────────────
  "src/onboarding/onboarding-core.service.ts#0": {
    member: "confirmChildProfileDeletion",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: "src/onboarding/onboarding-core.service.ts",
    reason:
      "⚠️ **이 대장에서 회귀의 결과가 유출이 아니라 파괴인 자리다.** 아이 삭제가 그 아이의 " +
      "**살아 있는 지출 전량**을 한 트랜잭션에서 soft delete 하고, 파기 잡이 나중에 하드 삭제한다 " +
      "— 복구 경로가 없다. 축은 아이이고 관문은 " +
      "`requireChildAccess(user, childId, true)`(편집 권한 필수)다. 그 관문의 교차가구 거동은 " +
      "expense-destructive-scope.e2e.test.ts가 403 + '한 건도 지워지지 않았다'로 고정한다."
  },

  // ── 사용자 요청 존 ⑦ 리포트 집계 ─────────────────────────────────────────────
  "src/onboarding/reporting-store.service.ts#0": {
    member: "getTrendReport",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: "src/onboarding/reporting-store.service.ts",
    reason: "월별 추이(6개월). 축은 아이, 관문은 메서드 첫 줄의 `requireChildAccess`. 교차가구는 report-trend.e2e.test.ts가 고정한다."
  },
  "src/onboarding/reporting-store.service.ts#1": {
    member: "getYearlyReport",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: "src/onboarding/reporting-store.service.ts",
    reason: "연간 리포트. 축·관문은 #0과 같다."
  },
  "src/onboarding/reporting-store.service.ts#2": {
    member: "getCumulativeReport",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: "src/onboarding/reporting-store.service.ts",
    reason: "누적 리포트. 축·관문은 #0과 같다."
  },
  "src/onboarding/reporting-store.service.ts#3": {
    member: "categoryBreakdown",
    zone: "app",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "requireChildAccess",
    gateFile: "src/onboarding/reporting-store.service.ts",
    reason:
      "분류별 분해(월간·카테고리 리포트가 공유). 이 메서드 자신은 `user`를 받지 않으므로 관문은 " +
      "호출자(`getMonthlyReport`·`getCategoryReport`)의 `requireChildAccess`다."
  },

  // ── 푸시 존(요청 뒤 fire-and-forget, 사용자 인자 없음) ────────────────────────
  "src/push/push-dispatch.service.ts#0": {
    member: "onExpenseCreated",
    zone: "push",
    stance: "id-derived",
    predicate: "id: expenseId",
    gate: "createExpense",
    gateFile: EXPENSES_FILE,
    reason:
      "예산 경계 판정을 위해 방금 만든 지출 한 건을 다시 읽는다. `expenseId`는 " +
      "`ExpensesVersionService.createExpense`가 **그 요청에서 막 만든 행**의 id라 남의 행을 " +
      "지목할 수 없다. 이 값이 사용자에게 나가지 않고 알림 대상도 이 행의 `childId`/`householdId`에서 " +
      "파생하므로 경계를 넘지 않는다(실패는 전부 삼키고 로그만 남긴다)."
  },
  "src/push/push-dispatch.service.ts#1": {
    member: "evaluateChildMonth",
    zone: "push",
    stance: "child-scoped",
    predicate: "childId,",
    gate: "onExpenseCreated",
    gateFile: "src/push/push-dispatch.service.ts",
    reason:
      "그 아이·그 달의 사용액 합계(예산 80%/100% 판정). 사용자가 없는 존이라 '호출자의 가구'가 " +
      "없고, `childId`는 위 #0이 읽은 지출 행(또는 `onBudgetRelevantChange`가 읽은 아이 행)에서 " +
      "온다 — 알림을 받는 디바이스도 같은 행의 가구에서 파생하므로 합계가 그 가구 밖으로 나가지 않는다."
  },

  // ── 델타 동기화(가구 축으로 좁는 세 자리 중 하나) ─────────────────────────────
  "src/sync/sync.service.ts#0": {
    member: "getChanges",
    zone: "app",
    stance: "household-scoped",
    predicate: "householdId: { in: householdIds }",
    gate: null,
    reason:
      "오프라인 델타 동기화. 이 대장에서 **선행 검사 없이도 그 자체로 좁은** 유일한 자리다 — " +
      "`householdIds`가 `user.households.map(h => h.id)`, 즉 토큰이 말하는 소속 그대로라 " +
      "가구 밖 행이 술어에 들어올 수 없다. 술어는 인자에 직접 서지 않고 위의 " +
      "`const where: Prisma.ExpenseWhereInput` 바인딩에 담겨 있다(훑기가 따라간다). " +
      "⚠️ 두 시점(라운드 108 T24 후속): `expenses.service.ts#7`이 같은 모양의 술어를 갖게 " +
      "됐지만 그 자리는 선행 검사(`authorizeExpenseRow`)도 함께 지나므로, **선행 검사 없이** 좁는 " +
      "자리는 여전히 여기 하나다. " +
      "⚠️ 이 자리는 **행 전체**(품목명·판매처·메모·금액)를 내보내므로 `householdId` 술어가 " +
      "빠지는 순간 전 사용자의 지출이 흐른다 — 이 대장에서 술어가 가장 무거운 자리다."
  },

  // ── 워커 존(사용자 없음 — 파기·보존 잡) ──────────────────────────────────────
  "src/worker/jobs/data-retention-purge.job.ts#0": {
    member: "purgeExpenses",
    zone: "worker",
    stance: "system-zone",
    predicate: "deletedAt: { lt: cutoff }",
    gate: null,
    reason:
      "phase 1 — 보존 기한이 지난 지출 tombstone 중 반복 실패로 건너뛴 행을 로그에 남기기 위한 조회. " +
      "가구로 좁지 않는 것이 의도(잡에는 사용자가 없다)이고, 대신 **보존 컷오프**로 좁는다. " +
      "`deletedAt: { lt: cutoff }`는 '이미 지워진 지 오래된 행'만 고른다는 뜻이다."
  },
  "src/worker/jobs/data-retention-purge.job.ts#1": {
    member: "purgeExpenses",
    zone: "worker",
    stance: "system-zone",
    predicate: "deletedAt: { lt: cutoff }",
    gate: null,
    reason: "phase 1의 실제 배치 조회. 술어 근거는 #0과 같다(컷오프 밖 행은 절대 고르지 않는다)."
  },
  "src/worker/jobs/data-retention-purge.job.ts#2": {
    member: "deleteExpensesHard",
    zone: "worker",
    stance: "system-zone",
    predicate: "id: { in: expenseIds }",
    gate: null,
    reason:
      "⚠️ 이 저장소에서 지출 행을 **정말로 지우는** 유일한 자리다. 술어가 호출자가 넘긴 id 집합 " +
      "하나뿐인 것이 의도이고, 그래서 **술어 없는 전역 쓸기**(`deleteMany({})`)가 이 계약에서 " +
      "빨강인 것이 중요하다 — 그 한 줄의 결과는 되돌릴 수 없다."
  },
  "src/worker/jobs/data-retention-purge.job.ts#3": {
    member: "purgeChildRows",
    zone: "worker",
    stance: "system-zone",
    predicate: "childId: { in: childIds }",
    gate: null,
    reason:
      "phase 2 — 파기 대상 아이들의 지출 id 수집(자기 `deletedAt`과 무관하게 전량: 지워진 아이의 " +
      "지출은 살아 있어도 함께 사라진다). 대상 아이 집합으로 좁는다."
  },
  "src/worker/jobs/data-retention-purge.job.ts#4": {
    member: "purgeWithdrawnUsers",
    zone: "worker",
    stance: "system-zone",
    predicate: "deletedByUserId: { in: userIds }",
    gate: null,
    reason:
      "phase 3 — 탈퇴 계정의 nullable 역참조 끊기. 지출 행 자체는 남고 '누가 지웠는지'만 null이 된다 " +
      "(NOT NULL인 `created_by_user_id`는 여기서 끊을 수 없어 아래 #5가 별도로 판정한다)."
  },
  "src/worker/jobs/data-retention-purge.job.ts#5": {
    member: "findReferenceBlockedUserIds",
    zone: "worker",
    stance: "system-zone",
    predicate: "createdByUserId: { in: userIds }",
    gate: null,
    reason:
      "탈퇴 처리에서 '완전 파기 대신 익명화로 분류해야 하는' 사용자 찾기 — NOT NULL FK로 지출을 " +
      "남긴 사용자가 그 대상이다. `select`·`distinct`가 사용자 id 하나만 읽고 행 내용은 읽지 않는다."
  }
};

// ---------------------------------------------------------------------------
// 훑기 — 주석·문자열·정규식을 건너뛴 사본에서 `<무엇>.expense.<동사>(`를 전수로 찾는다.
// (`category-owner-scope.test.ts`의 훑기를 그대로 복제했다. 그 파일이 export 하지 않아
//  이 파일이 사본을 든다 — 라운드 103 T1이 `transaction-bounds.test.ts`에 대해 한 것과 같다.)
// ---------------------------------------------------------------------------

const API_ROOT = process.cwd();
/** 걷는 뿌리 둘. `prisma`는 오늘 자리가 0건이지만 함께 걷는다 — 아래에 그 사실 자체가 계약으로 있다. */
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
 * (라운드 82 리뷰 M-8이 값으로 증명한 목록 — `transaction-bounds.test.ts` ·
 *  `category-owner-scope.test.ts`가 같은 사본을 든다.)
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
 * ⚠️ 주석을 지우지 않으면 이 그물은 **자기 자신에게 걸린다** — 소스의 설명문들이
 * `prisma.expense.` 같은 문구를 값으로 여러 번 적기 때문이다.
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

/**
 * 호출 앞쪽에서 가장 가까운 **선언 줄**을 찾아 이름과 시작 위치를 돌려준다.
 * 이름은 대장 대조에, 시작 위치는 아래 `where` 바인딩 추적의 범위 상한에 쓴다
 * (다른 메서드의 동명 지역변수를 집지 않게 하기 위함).
 */
function enclosingMember(code: string, callIndex: number): { member: string; start: number } {
  const before = code.slice(0, callIndex);
  const declaration =
    /^[ \t]*(?:(?:export|private|public|protected|static|readonly|abstract|override)\s+)*(?:async\s+)?(?:function\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*(?:<[^>\n]*>)?\s*\(/gm;
  let member = "(top level)";
  let start = 0;
  for (let match = declaration.exec(before); match !== null; match = declaration.exec(before)) {
    if (NOT_A_MEMBER.has(match[1])) continue;
    if (!looksLikeDeclaration(code, match.index + match[0].length - 1)) continue;
    member = match[1];
    start = match.index;
  }
  return { member, start };
}

/** 여는 괄호/대괄호/중괄호에서 시작해 균형이 맞는 지점까지의 원본 조각. */
function balancedSlice(code: string, openIndex: number): string {
  let depth = 0;
  for (let cursor = openIndex; cursor < code.length; cursor += 1) {
    const char = code[cursor];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(openIndex, cursor + 1);
    }
  }
  return code.slice(openIndex);
}

/** 그 호출의 인자 목록 전체(괄호 균형으로 잘라 낸 원본 조각). */
function callArguments(code: string, openParenIndex: number): string {
  const slice = balancedSlice(code, openParenIndex);
  return slice.startsWith("(") && slice.endsWith(")") ? slice.slice(1, -1) : slice.slice(1);
}

/**
 * 인자가 `where`를 **변수로** 넘기는 자리(오늘 셋: milestone ×2 · sync ×1)를 위해,
 * 그 바인딩의 객체 리터럴을 찾아 인자 뒤에 이어 붙인 텍스트를 만든다.
 *
 * 왜 필요한가: 이 표에서 소유자 술어가 인자에 직접 서지 않는 자리가 실제로 있고
 * (`const where = { childId, ... }` 뒤 `aggregate({ where, ... })`), 그 자리에
 * `predicate: null`을 허용해 버리면 **가장 넓은 읽기 셋이 술어 없이 통과**한다
 * (그중 하나인 sync 는 지출 행 전체를 내보낸다). 그래서 술어를 비우는 대신 바인딩을 따라간다.
 *
 * 범위는 **감싼 메서드 안**으로 제한한다 — 파일 어디서나 찾으면 다른 메서드의 동명 변수를
 * 집어 극성이 조용히 뒤집힌다.
 */
function resolvedArguments(code: string, argumentsText: string, scopeStart: number, callIndex: number): string {
  const names = new Set<string>();
  if (/(^|[{,\s])where\s*(,|\}|$)/.test(argumentsText)) names.add("where");
  for (const match of argumentsText.matchAll(/where\s*:\s*([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  const scope = code.slice(scopeStart, callIndex);
  let extra = "";
  for (const name of names) {
    const declaration = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b[^=;]*=\\s*\\{`, "g");
    let last: RegExpExecArray | null = null;
    for (let match = declaration.exec(scope); match !== null; match = declaration.exec(scope)) last = match;
    if (last) extra += `\n${balancedSlice(code, scopeStart + last.index + last[0].length - 1)}`;
  }
  return argumentsText + extra;
}

type ExpenseSite = {
  /** `파일경로#순번` — 대장의 키. */
  key: string;
  file: string;
  line: number;
  member: string;
  verb: string;
  argumentsText: string;
};

/**
 * 바늘은 **`.expense.<동사>(`** 다 — 수신자 이름(`this.prisma` · `tx` · `client` · 앞으로 생길
 * 무엇이든)을 묻지 않는 쪽이 fail-closed다. `.expenses.`(복수)나 `row.expense.amountKrw`처럼
 * 뒤에 `(`가 없는 접근은 걸리지 않는다.
 */
const EXPENSE_CALL = /\.expense\.([A-Za-z]+)\s*\(/g;

function collectExpenseSites(): ExpenseSite[] {
  const sites: ExpenseSite[] = [];
  for (const root of SCAN_ROOTS) {
    const files = listSourceFiles(join(API_ROOT, root)).sort();
    for (const file of files) {
      const code = blankNonCode(readFileSync(file, "utf8"));
      const relativePath = [root, relative(join(API_ROOT, root), file)].join(sep).split(sep).join("/");
      let ordinal = 0;
      EXPENSE_CALL.lastIndex = 0;
      for (let match = EXPENSE_CALL.exec(code); match !== null; match = EXPENSE_CALL.exec(code)) {
        const openParen = match.index + match[0].length - 1;
        const { member, start } = enclosingMember(code, match.index);
        const argumentsText = callArguments(code, openParen);
        sites.push({
          key: `${relativePath}#${ordinal}`,
          file: relativePath,
          line: code.slice(0, match.index).split("\n").length,
          member,
          verb: match[1],
          argumentsText: resolvedArguments(code, argumentsText, start, match.index)
        });
        ordinal += 1;
      }
    }
  }
  return sites;
}

/** 경로에서 구역을 판정한다 — 등재가 스스로 적은 `zone`과 대조한다. */
function zoneOf(file: string): Zone {
  if (file.startsWith("prisma/")) return "seed";
  if (file.startsWith("src/admin/")) return "admin";
  if (file.startsWith("src/worker/")) return "worker";
  if (file.startsWith("src/push/")) return "push";
  return "app";
}

const codeCache = new Map<string, string>();
function codeOf(relativePath: string): string {
  const cached = codeCache.get(relativePath);
  if (cached !== undefined) return cached;
  const code = blankNonCode(readFileSync(join(API_ROOT, relativePath), "utf8"));
  codeCache.set(relativePath, code);
  return code;
}

describe("라운드 108 C-1 — expenses 소유자 필터 대장", () => {
  const sites = collectExpenseSites();

  it("훑기 자체가 실재하는 자리를 찾는다 (주석 안의 언급은 세지 않는다)", () => {
    // 그물이 비면 아래 계약들이 조용히 통과한다 — 그물 자신을 먼저 고정한다.
    expect(sites.length).toBeGreaterThan(0);

    // 정찰이 이름으로 적은 파일들이 실제로 걸린다.
    for (const file of [
      EXPENSES_FILE,
      STORE_FILE,
      IMPORT_FILE,
      "src/finance/milestone-report.service.ts",
      "src/onboarding/reporting-store.service.ts",
      "src/sync/sync.service.ts",
      "src/worker/jobs/data-retention-purge.job.ts"
    ]) {
      expect(sites.some((site) => site.file === file), `${file}에서 자리를 못 찾았어요`).toBe(true);
    }

    // ⚠️ 주석 안의 언급은 세지 않는다 — 이 표를 설명하는 문장들이 그 문구를 값으로 여러 번 적는다.
    // `expenses.service.ts`는 주석에서 `expense.findUnique`를 부르지만 자리는 열이다.
    expect(sites.filter((site) => site.file === EXPENSES_FILE)).toHaveLength(10);
  });

  it("모든 자리가 대장에 등재돼 있다 (등재 없는 새 자리 = 빨강)", () => {
    const missing = sites
      .filter((site) => !(site.key in EXPENSE_OWNER_LEDGER))
      .map((site) => `${site.key} (${site.member}, ${site.file}:${site.line}, .${site.verb})`);
    expect(
      missing,
      "expenses를 읽거나 쓰는 새 자리가 소유자 필터 대장에 없어요 — 입장(stance)·구역(zone)·이유를 " +
        "한 줄 적어 주세요(등재 없는 자리는 기본값이 빨강입니다)"
    ).toEqual([]);
  });

  it("대장에 낡은 줄이 남지 않는다 (사라진 자리)", () => {
    const present = new Set(sites.map((site) => site.key));
    const stale = Object.keys(EXPENSE_OWNER_LEDGER).filter((key) => !present.has(key));
    // 이유가 사라진 줄이 남으면 다음 라운드가 그것을 근거로 인용한다 — 대장은 양방향이다.
    expect(stale).toEqual([]);
  });

  it("등재가 실제로 그 자리를 가리킨다 (감싼 메서드 · 구역 · 빈 이유 금지)", () => {
    for (const site of sites) {
      const entry = EXPENSE_OWNER_LEDGER[site.key];
      // 등재 자체가 없는 자리는 위 계약이 이미 이름으로 보고했다 — 여기서 한 번 더 터뜨려
      // 메시지를 흐리지 않는다.
      if (!entry) continue;
      // 왼쪽이 대장이 적어 둔 값, 오른쪽이 소스에서 실제로 읽은 값이다.
      expect({ key: site.key, member: entry.member, zone: entry.zone }).toEqual({
        key: site.key,
        member: site.member,
        zone: zoneOf(site.file)
      });
      expect(entry.reason.trim().length, `${site.key}의 이유가 비었어요`).toBeGreaterThan(0);
    }
  });

  it("술어를 적은 자리는 그 술어가 인자(또는 그 인자가 참조하는 where 바인딩) 안에 실제로 있다", () => {
    const broken = sites
      .filter((site) => {
        const entry = EXPENSE_OWNER_LEDGER[site.key];
        return entry !== undefined && entry.predicate !== null && !site.argumentsText.includes(entry.predicate);
      })
      .map((site) => `${site.key} (${site.file}:${site.line}) — "${EXPENSE_OWNER_LEDGER[site.key].predicate}"`);
    expect(broken, "대장이 적은 술어가 그 호출의 인자에 없어요 — 필터가 빠졌거나 대장이 낡았어요").toEqual([]);
  });

  it("술어 없이 등재할 수 있는 입장은 둘뿐이고, 그 자리는 전체의 소수다", () => {
    const withoutPredicate = sites.filter((site) => EXPENSE_OWNER_LEDGER[site.key]?.predicate === null);
    for (const site of withoutPredicate) {
      const entry = EXPENSE_OWNER_LEDGER[site.key]!;
      expect(
        STANCES_WITHOUT_PREDICATE.has(entry.stance),
        `${site.key}: ${entry.stance}로 등재하려면 술어를 글자로 적어 주세요(비울 수 있는 입장은 ` +
          `access-derived·operator-zone 둘뿐입니다)`
      ).toBe(true);
    }
    // 유령 방지: 술어 없는 자리가 늘어나 대장이 선언만 남는 것을 막는다.
    // 오늘 셋(스토어의 create 래퍼 · 가져오기 배치 삽입 · 어드민 전체 건수)뿐이다.
    expect(withoutPredicate.length).toBeLessThan(sites.length / 3);
  });

  it("소유자 축으로 등재한 자리는 그 축이 술어에 실제로 서고, 서 있는 축을 약하게 적지 않는다", () => {
    for (const site of sites) {
      const entry = EXPENSE_OWNER_LEDGER[site.key];
      if (!entry) continue;
      // ⓐ `household-scoped`/`child-scoped`는 그 칸이 술어에 보여야 한다.
      //    (소유자 칸이 둘이라 "좁혔다"가 두 축으로 갈린다 — 이름표와 값이 어긋나면 빨강이다.)
      if (entry.stance === "household-scoped") {
        expect(
          OWNER_AXES.household.test(entry.predicate ?? ""),
          `${site.key}: household-scoped인데 술어에 householdId가 없어요`
        ).toBe(true);
      }
      if (entry.stance === "child-scoped") {
        expect(
          OWNER_AXES.child.test(entry.predicate ?? ""),
          `${site.key}: child-scoped인데 술어에 childId가 없어요`
        ).toBe(true);
      }
      // ⓑ 반대로 소유자 칸이 인자에 **보이는데** 파생 입장으로 적으면 대장이 실제보다
      //    위험하게 읽힌다 — 그것도 거짓이므로 거절한다.
      if (entry.stance === "access-derived" || entry.stance === "authorization-input") {
        const axis = OWNER_AXES.household.test(site.argumentsText)
          ? "householdId"
          : OWNER_AXES.child.test(site.argumentsText)
            ? "childId"
            : null;
        expect(
          axis,
          `${site.key}: 인자에 ${axis}가 보이는데 ${entry.stance}로 등재돼 있어요 — ` +
            `household-scoped/child-scoped로 올려 적어 주세요`
        ).toBe(null);
      }
    }
  });

  it("선행 검사에 기대는 자리는 그 검사의 이름이 지목한 파일의 코드에 실재한다", () => {
    for (const site of sites) {
      const entry = EXPENSE_OWNER_LEDGER[site.key];
      if (!entry) continue;
      if (STANCES_REQUIRING_GATE.has(entry.stance)) {
        expect(
          entry.gate,
          `${site.key}: ${entry.stance}로 등재하려면 어느 선행 검사에서 좁아지는지를 gate에 이름으로 적어 주세요`
        ).not.toBeNull();
      }
      if (!entry.gate) continue;
      const gateFile = entry.gateFile ?? site.file;
      // 이름이 코드에서 사라지면(삭제·개명) 이 대장이 먼저 빨개진다 — 주석에만 남은 이름은
      // 훑기가 지운 사본에서 보이지 않으므로 통과하지 못한다.
      expect(
        new RegExp(`\\b${entry.gate}\\b`).test(codeOf(gateFile)),
        `${site.key}: gate "${entry.gate}"가 ${gateFile}의 코드에 없어요(주석에만 남은 이름은 인정하지 않습니다)`
      ).toBe(true);
    }
  });

  /**
   * 모집단 인구조사 — 보고서 ①이 값으로 서는 자리.
   *
   * ⚠️ 두 시점(라운드 108 트랙 C): 권한 경계 정찰은 **사용자 요청 존 29자리**를 셌다.
   * 이 트랙이 다시 세었을 때도 29였고(정찰과 정확히 일치), 그 밖에 푸시 2 · 어드민 2 ·
   * 워커 6이 있어 전체는 39다. 정찰이 29라고 적은 것은 푸시 존 둘을 '사용자 없는 자리'로
   * 따로 뺀 결과이지 수가 달라진 것이 아니다.
   *
   * 이 숫자를 리터럴로 적는 이유: 새 자리가 생기면 등재 계약이 이미 빨개지지만, **어느 존이
   * 늘었는지**는 그 메시지가 말하지 않는다. 어드민/워커 존에 지출 표면이 하나 느는 것은
   * 등재 한 줄과 다른 무게의 결정이므로(라운드 100·102가 어드민에 대해 그은 선) 여기서 따로 센다.
   */
  it("구역별 자리 수가 인구조사와 같다 (app 29 · push 2 · admin 2 · worker 6 · seed 0)", () => {
    const census = { app: 0, push: 0, admin: 0, worker: 0, seed: 0 } satisfies Record<Zone, number>;
    for (const site of sites) census[zoneOf(site.file)] += 1;
    expect(census).toEqual({ app: 29, push: 2, admin: 2, worker: 6, seed: 0 });
    expect(sites).toHaveLength(39);
  });

  /**
   * 인가가 **두 벌**이라는 사실 자체를 값으로 고정한다.
   *
   * `authorization-input`은 "인가 검사에 먹일 행을 읽는" 자리이므로, 그 자리의 수와 gate 이름이
   * 곧 "이 표에 인가 구현이 몇 벌 있나"의 답이다. 오늘은 셋(PATCH·DELETE의 입력 둘 +
   * GET·목록의 입력 하나)이고 gate 는 두 이름(`authorizeExpenseRow`·`requireChildAccess`)이다.
   * **세 번째 벌이 생기면 여기서 먼저 빨개진다** — 그때 필요한 것은 이 숫자를 고치는 것이 아니라
   * 왜 또 한 벌을 만들었는지 적는 것이다(C-3이 리포트 쪽 사본에 대해 내린 결론과 같은 판단).
   */
  it("인가에 행을 먹이는 자리는 셋이고 두 파일에만 있다 (구현이 세 벌로 늘면 빨강)", () => {
    const inputs = sites.filter((site) => EXPENSE_OWNER_LEDGER[site.key]?.stance === "authorization-input");
    expect(inputs.map((site) => site.key).sort()).toEqual([
      `${EXPENSES_FILE}#0`,
      `${EXPENSES_FILE}#4`,
      `${STORE_FILE}#3`
    ]);
    const gates = [...new Set(inputs.map((site) => EXPENSE_OWNER_LEDGER[site.key]!.gate))].sort();
    expect(gates).toEqual(["authorizeExpenseRow", "requireChildAccess"]);
  });

  /**
   * 그물 자신의 계약 — 전수를 자처하는 훑기가 소스의 한 모양에서 극성을 뒤집으면, 그 뒤의 모든
   * 판정이 조용히 틀린 채 초록으로 남는다(라운드 82 리뷰 M-8이 실증한 그 결함).
   */
  it("훑기가 주석·문자열·정규식을 코드가 아닌 구간으로 건너뛴다", () => {
    // ⓐ 주석 안의 호출 모양은 세지 않는다.
    const commented = blankNonCode(["// await this.prisma.expense.findMany({});", "const x = 1;"].join("\n"));
    expect(commented).not.toContain("expense.findMany");
    expect(commented).toContain("const x = 1;");

    // ⓑ 문자열 안의 호출 모양도 세지 않는다.
    const inString = blankNonCode('const s = "prisma.expense.deleteMany(";\nconst y = 2;');
    expect(inString).not.toContain("expense.deleteMany");
    expect(inString).toContain("const y = 2;");

    // ⓒ 진짜 코드는 남는다 — 그리고 그 자리에서 인자를 잘라 낼 수 있다.
    const real = "await tx.expense.findMany({ where: { childId, deletedAt: null } });";
    const kept = blankNonCode(real);
    expect(kept).toBe(real);
    EXPENSE_CALL.lastIndex = 0;
    const match = EXPENSE_CALL.exec(kept)!;
    expect(match[1]).toBe("findMany");
    expect(callArguments(kept, match.index + match[0].length - 1)).toContain("childId,");

    // ⓓ 길이·줄 번호는 보존된다(인덱스 계산의 전제).
    for (const sample of ['const r = /["\\s]/g;\nconst s = "x";', "const half = (a + b) / 2;"]) {
      expect(blankNonCode(sample)).toHaveLength(sample.length);
      expect(blankNonCode(sample).split("\n")).toHaveLength(sample.split("\n").length);
    }
  });

  /**
   * `where` 바인딩 추적의 계약. 이 추적이 조용히 실패하면 milestone ×2 · sync ×1이
   * "술어가 인자에 없다"로 빨개지는 대신… 이 아니라, 그 반대가 더 위험하다: 추적이 **너무
   * 넓어** 다른 메서드의 동명 변수를 집으면, 실제로는 소유자 술어가 빠진 자리가 초록으로 남는다.
   */
  it("where 바인딩 추적은 같은 메서드 안만 본다 (다른 메서드의 동명 변수를 집지 않는다)", () => {
    const source = [
      "class T {",
      "  async safe() {",
      "    const where = { childId, deletedAt: null };",
      "    return this.prisma.expense.aggregate({ where, _sum: { amountKrw: true } });",
      "  }",
      "  async unsafe() {",
      "    return this.prisma.expense.aggregate({ where, _sum: { amountKrw: true } });",
      "  }",
      "}"
    ].join("\n");
    const code = blankNonCode(source);
    const found: string[] = [];
    EXPENSE_CALL.lastIndex = 0;
    for (let match = EXPENSE_CALL.exec(code); match !== null; match = EXPENSE_CALL.exec(code)) {
      const openParen = match.index + match[0].length - 1;
      const { start } = enclosingMember(code, match.index);
      found.push(resolvedArguments(code, callArguments(code, openParen), start, match.index));
    }
    expect(found).toHaveLength(2);
    // 앞의 자리는 바인딩을 따라가 술어가 보이고,
    expect(found[0]).toContain("childId,");
    // 뒤의 자리는 자기 메서드 안에 바인딩이 없으므로 보이지 않는다(= 등재가 술어로 통과할 수 없다).
    expect(found[1]).not.toContain("childId,");
  });
});
