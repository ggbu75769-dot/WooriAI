import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIT_LOG_ACTION_MAX_LENGTH,
  AUDIT_LOG_ACTION_PRESETS,
  auditLogActorKind,
  auditLogActorLabel,
  auditLogFilterError,
  auditLogFiltersFromSearchParams,
  auditLogFiltersToQuery,
  auditLogsHrefForActor,
  emptyAuditLogFilters,
  hasAnyAuditLogFilter,
  isAuditLogActorId,
  shortActorId,
  type AuditLogFilters
} from "./audit-log-filters";

const ACTOR_ID = "3f1c9a2e-8b4d-4c1a-9f77-1234567890ab";

function makeFilters(overrides: Partial<AuditLogFilters> = {}): AuditLogFilters {
  return { ...emptyAuditLogFilters(), ...overrides };
}

/** 검색 파라미터 스텁 (URLSearchParams와 같은 get 시그니처). */
function params(record: Record<string, string>) {
  return { get: (name: string) => record[name] ?? null };
}

/**
 * GAP-076 #4 ⓓ — **유령 프리셋 부정 단언**을 위한 서버 소스 읽기.
 *
 * 정본은 import하지 않고 **소스 텍스트로 읽어 파싱한다**: apps/admin은 apps/api를 의존성으로
 * 들지 않는다(라운드 60 P2-8의 근거 그대로 · `admin-canonical-mirrors.test.ts`가 쓰는 그 방법).
 */
const adminRoot = process.cwd();
const apiSrcDir = join(adminRoot, "..", "api", "src");

/** `apps/api/src/**`의 `.ts` 전수(테스트·d.ts 제외). */
function apiSourcePaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".d.ts") || /\.(?:test|spec)\.ts$/.test(entry.name)) continue;
      found.push(relative(apiSrcDir, fullPath).split(sep).join("/"));
    }
  };
  walk(apiSrcDir);
  return found.sort();
}

/** 주석은 걷어낸다 — 주석 안에 인용된 액션 문자열은 "서버가 기록하는 값"이 아니다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** `AuditLoggerService.record({ … action: "x" … })`가 쓰는 액션 문자열 전수. */
const AUDIT_ACTION_LITERAL = /\baction:\s*"([^"]+)"/g;

function serverRecordedActions(): Set<string> {
  const actions = new Set<string>();
  for (const path of apiSourcePaths()) {
    const source = codeOnly(readFileSync(join(apiSrcDir, ...path.split("/")), "utf8"));
    for (const match of source.matchAll(AUDIT_ACTION_LITERAL)) {
      // `action: string;`(타입 선언)·`action: query.action`(전달)은 리터럴이 아니라 안 걸린다.
      if (match[1].includes(".")) actions.add(match[1]);
    }
  }
  return actions;
}

describe("isAuditLogActorId (CS-101)", () => {
  it("accepts a UUID, with surrounding whitespace and any case", () => {
    expect(isAuditLogActorId(ACTOR_ID)).toBe(true);
    expect(isAuditLogActorId(`  ${ACTOR_ID.toUpperCase()}  `)).toBe(true);
  });

  it("rejects non-UUID text an operator might paste (email, nickname, partial id)", () => {
    expect(isAuditLogActorId("nj9702@example.com")).toBe(false);
    expect(isAuditLogActorId("튼튼이맘")).toBe(false);
    expect(isAuditLogActorId(ACTOR_ID.slice(0, 8))).toBe(false);
    expect(isAuditLogActorId("")).toBe(false);
  });
});

describe("auditLogFilterError (CS-101)", () => {
  it("passes empty filters", () => {
    expect(auditLogFilterError(emptyAuditLogFilters())).toBeNull();
  });

  it("explains a non-UUID actor id instead of letting the API 400 anonymously", () => {
    const message = auditLogFilterError(makeFilters({ actorUserId: "nj9702@example.com" }));
    expect(message).toContain("UUID");
  });

  it("accepts a valid actor id (whitespace trimmed)", () => {
    expect(auditLogFilterError(makeFilters({ actorUserId: ` ${ACTOR_ID} ` }))).toBeNull();
  });

  it("rejects an action longer than the server's MaxLength(80)", () => {
    expect(auditLogFilterError(makeFilters({ action: "a".repeat(AUDIT_LOG_ACTION_MAX_LENGTH) }))).toBeNull();
    expect(
      auditLogFilterError(makeFilters({ action: "a".repeat(AUDIT_LOG_ACTION_MAX_LENGTH + 1) }))
    ).toContain(String(AUDIT_LOG_ACTION_MAX_LENGTH));
  });

  it("rejects an inverted date range (which would silently return 0 rows)", () => {
    expect(auditLogFilterError(makeFilters({ fromDate: "2026-08-10", toDate: "2026-08-01" }))).toContain(
      "시작일"
    );
    expect(auditLogFilterError(makeFilters({ fromDate: "2026-08-01", toDate: "2026-08-01" }))).toBeNull();
  });

  it("rejects a malformed date (only reachable from a hand-edited URL)", () => {
    expect(auditLogFilterError(makeFilters({ fromDate: "2026-8-1" }))).toContain("시작일");
    expect(auditLogFilterError(makeFilters({ toDate: "2026-02-30" }))).toContain("종료일");
  });
});

describe("auditLogFiltersToQuery (CS-101)", () => {
  it("omits every empty filter", () => {
    expect(auditLogFiltersToQuery(emptyAuditLogFilters())).toEqual({});
  });

  it("trims action and actor id", () => {
    expect(auditLogFiltersToQuery(makeFilters({ action: "  expense.update  ", actorUserId: ` ${ACTOR_ID} ` }))).toEqual(
      { action: "expense.update", actorUserId: ACTOR_ID }
    );
  });

  it("drops an actor id that the API would reject", () => {
    expect(auditLogFiltersToQuery(makeFilters({ actorUserId: "not-a-uuid" }))).toEqual({});
  });

  it("expands dates to the local day boundaries", () => {
    const query = auditLogFiltersToQuery(makeFilters({ fromDate: "2026-08-03", toDate: "2026-08-03" }));
    const from = new Date(query.from!);
    const to = new Date(query.to!);
    // 로컬 타임존과 무관하게 성립하도록 로컬 필드로 검증한다.
    expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([2026, 7, 3]);
    expect([from.getHours(), from.getMinutes(), from.getSeconds()]).toEqual([0, 0, 0]);
    expect([to.getFullYear(), to.getMonth(), to.getDate()]).toEqual([2026, 7, 3]);
    expect([to.getHours(), to.getMinutes(), to.getSeconds()]).toEqual([23, 59, 59]);
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("ignores a malformed date rather than sending Invalid Date", () => {
    expect(auditLogFiltersToQuery(makeFilters({ fromDate: "not-a-date" }))).toEqual({});
  });
});

describe("hasAnyAuditLogFilter (CS-101)", () => {
  it("treats whitespace-only text as no filter", () => {
    expect(hasAnyAuditLogFilter(emptyAuditLogFilters())).toBe(false);
    expect(hasAnyAuditLogFilter(makeFilters({ action: "   " }))).toBe(false);
    expect(hasAnyAuditLogFilter(makeFilters({ actorUserId: ACTOR_ID }))).toBe(true);
    expect(hasAnyAuditLogFilter(makeFilters({ toDate: "2026-08-03" }))).toBe(true);
  });

  /**
   * GAP-087 트랙 A — **이 판정은 더 이상 사문이 아니다.**
   *
   * 라운드 87 정찰이 센 "호출부 0건인 export 열일곱" 중 어드민 몫 둘 가운데 하나가 이것이었다:
   * 계약(위 단언)만 초록이고 제품 소스 어디에서도 부르지 않았다. 그 사이 화면은 0건일 때마다
   * *"조건에 맞는 기록이 없어요."* 라고만 말했다 — **필터를 하나도 걸지 않은** 운영자에게도.
   * 지금은 그 문장을 가르는 자리(`audit-log-rows.ts`)가 이 함수를 부른다.
   *
   * ⚠️ 값이 아니라 **실재**만 문다(문장 자체는 audit-log-rows.test.ts가 진다).
   */
  it("제품 소스에 호출부가 실재한다 (계약만 초록인 사문이 아니다)", () => {
    const rows = readFileSync(join(adminRoot, "src/lib/audit-log-rows.ts"), "utf8");
    expect(rows).toContain('from "./audit-log-filters"');
    expect(rows).toMatch(/hasAnyAuditLogFilter\(/);
    // 그 호출부를 화면이 실제로 지난다(모듈만 두고 아무도 부르지 않으면 자리만 옮긴 것이다).
    const page = readFileSync(join(adminRoot, "app/audit-logs/page.tsx"), "utf8");
    expect(page).toContain("auditLogEmptyStateMessage(");
  });
});

describe("auditLogFiltersFromSearchParams (CS-101)", () => {
  it("prefills the actor id the users-lookup link carries", () => {
    expect(auditLogFiltersFromSearchParams(params({ actorUserId: ACTOR_ID }))).toEqual(
      makeFilters({ actorUserId: ACTOR_ID })
    );
  });

  it("also accepts an action, and ignores unknown params", () => {
    expect(auditLogFiltersFromSearchParams(params({ action: "expense.update", other: "x" }))).toEqual(
      makeFilters({ action: "expense.update" })
    );
  });

  it("drops a malformed actor id so the page opens unfiltered instead of failing", () => {
    expect(auditLogFiltersFromSearchParams(params({ actorUserId: "nj9702@example.com" }))).toEqual(
      emptyAuditLogFilters()
    );
  });

  it("drops an over-long action", () => {
    expect(
      auditLogFiltersFromSearchParams(params({ action: "a".repeat(AUDIT_LOG_ACTION_MAX_LENGTH + 1) }))
    ).toEqual(emptyAuditLogFilters());
  });

  it("handles a missing search-param object", () => {
    expect(auditLogFiltersFromSearchParams(null)).toEqual(emptyAuditLogFilters());
  });

  it("round-trips the href built for a user card", () => {
    const href = auditLogsHrefForActor(` ${ACTOR_ID} `);
    expect(href).toBe(`/audit-logs?actorUserId=${ACTOR_ID}`);
    const query = new URLSearchParams(href.slice(href.indexOf("?") + 1));
    expect(auditLogFiltersFromSearchParams(query)).toEqual(makeFilters({ actorUserId: ACTOR_ID }));
  });
});

describe("AUDIT_LOG_ACTION_PRESETS (CS-101)", () => {
  it("has unique action codes with a Korean label each", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(new Set(actions).size).toBe(actions.length);
    for (const preset of AUDIT_LOG_ACTION_PRESETS) {
      expect(preset.label.trim().length).toBeGreaterThan(0);
      expect(preset.action.length).toBeLessThanOrEqual(AUDIT_LOG_ACTION_MAX_LENGTH);
    }
  });

  it("every preset survives the filter validation it is meant to fill", () => {
    for (const preset of AUDIT_LOG_ACTION_PRESETS) {
      expect(auditLogFilterError(makeFilters({ action: preset.action }))).toBeNull();
      expect(auditLogFiltersToQuery(makeFilters({ action: preset.action }))).toEqual({
        action: preset.action
      });
    }
  });

  it("covers the expense actions CS asks about (수정·삭제)", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(actions).toContain("expense.update");
    expect(actions).toContain("expense.delete");
  });

  /**
   * GAP-062 #7: "가구에서 나간 적 없는데 기록이 안 보여요" / "탈퇴한 적 없어요" 문의는
   * 내보내기(household.member.remove)가 아니라 **본인이 실행한** 흐름을 찾아야 답할 수 있다.
   * 두 액션은 서버가 새로 기록하기 시작한 값이므로 프리셋에서도 구분돼 보여야 한다.
   */
  it("covers the self-service flows CS asks about (본인 탈퇴·가구 나가기)", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(actions).toContain("household.leave");
    expect(actions).toContain("account.delete");
    // 내보내기와 같은 라벨로 뭉뚱그리지 않는다 — 누가 실행했는지가 다르다.
    const labels = AUDIT_LOG_ACTION_PRESETS.filter((preset) =>
      ["household.leave", "household.member.remove"].includes(preset.action)
    ).map((preset) => preset.label);
    expect(new Set(labels).size).toBe(2);
  });

  /**
   * GAP-063 #5: "왜 갑자기 예산 경고가 뜨죠" 문의의 답은 budgets 행에 없다 —
   * (아이, 연월)당 한 칸이라 덮어쓰면 이전 금액이 사라지기 때문이다. 서버가 새로
   * 기록하기 시작한 `budget.upsert`가 유일한 근거이므로 프리셋에도 있어야 한다.
   */
  it("covers the money-write CS asks about (월 예산 덮어쓰기)", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(actions).toContain("budget.upsert");
    // 지출 수정과 뭉뚱그리지 않는다 — 바뀐 대상도 화면 영향도 다르다.
    const labels = AUDIT_LOG_ACTION_PRESETS.filter((preset) =>
      ["budget.upsert", "expense.update"].includes(preset.action)
    ).map((preset) => preset.label);
    expect(new Set(labels).size).toBe(2);
  });

  /**
   * GAP-064 #9: 가져오기 **승인**은 되돌릴 수 없고(확정된 잡은 다시 확정할 수 없다) 가구의
   * 아무 쓰기 권한자나 실행할 수 있다. "가져왔는데 일부가 안 들어왔어요" 문의에서 누가·언제
   * 승인했는지는 서버가 새로 기록하기 시작한 `import.confirm`에만 있으므로 프리셋에도 있어야
   * 한다(잡 행의 approved_at은 시각만 답하고 행위자는 답하지 않는다).
   */
  it("covers the import approval CS asks about (가져오기 승인)", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(actions).toContain("import.confirm");
    // 지출 수정과 뭉뚱그리지 않는다 — 한 번에 여러 건이 생기는 다른 사건이다.
    const labels = AUDIT_LOG_ACTION_PRESETS.filter((preset) =>
      ["import.confirm", "expense.update"].includes(preset.action)
    ).map((preset) => preset.label);
    expect(new Set(labels).size).toBe(2);
  });

  /**
   * GAP-065 #9: 고지 문구(DNC-010)는 key당 한 칸 upsert라 덮어쓰면 이전 문구가 사라지고,
   * admin 역할은 검토를 거치지 않고 바로 덮어쓴다. "고지가 왜 이렇게 바뀌었죠"에 답할
   * 근거는 `admin.disclosure.update`의 before/after뿐이므로 프리셋에도 있어야 한다.
   */
  it("covers the disclosure copy CS asks about (고지 문구 덮어쓰기)", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(actions).toContain("admin.disclosure.update");
    // 상품 링크 수정과 뭉뚱그리지 않는다 — 링크 하나가 아니라 종별 기본 문구가 통째로 바뀐다.
    const labels = AUDIT_LOG_ACTION_PRESETS.filter((preset) =>
      ["admin.disclosure.update", "admin.product_link.update"].includes(preset.action)
    ).map((preset) => preset.label);
    expect(new Set(labels).size).toBe(2);
  });

  /**
   * GAP-066 #9: 같은 고지 문구가 **리비전으로도** 바뀐다. 승인 발행은 프리셋에 있었지만
   * 예약 발행은 없어서, 사람이 자리에 없는 순간 라이브를 바꾸는 유일한 경로를 CS가 액션
   * 문자열을 외워 손으로 쳐야 찾을 수 있었다(GAP-066 #7이 그 봉투에 before를 채워도
   * 찾을 수 없으면 소용이 없다). 두 발행 경로가 나란히 후보로 서야 한다.
   */
  /**
   * GAP-076 #4: 어드민 계정의 **실패한** 로그인은 서버가 세 액션으로 세는데
   * (`admin.login_failed`·`admin.mfa_login_failed`·`admin.password_change_failed`) 앱 이용자의
   * 거절은 아무것도 세지 않았다 — 차단·탈퇴 계정의 로그인 시도가 조회 가능한 흔적을 하나도
   * 남기지 않았다는 뜻이다(라운드 75 P-1이 `users` 행 쓰기를 막은 것은 옳았고, 그래서 남은
   * 답이 `audit_logs` 행이었다). "앱에 못 들어가요" 문의에서 시도가 있었는지·왜 막혔는지를
   * 답할 수 있는 유일한 액션이므로 프리셋에도 서야 한다.
   */
  it("covers the rejected app login CS asks about (차단·탈퇴 계정의 로그인 거절)", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(actions).toContain("auth.login_rejected");
    // 성공한 로그인과 뭉뚱그리지 않는다 — 들어간 사람과 막힌 사람은 정반대의 문의다.
    const labels = AUDIT_LOG_ACTION_PRESETS.filter((preset) =>
      ["auth.login", "auth.login_rejected"].includes(preset.action)
    ).map((preset) => preset.label);
    expect(new Set(labels).size).toBe(2);
  });

  it("covers both publish paths CS asks about (승인 발행·예약 발행)", () => {
    const actions = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action);
    expect(actions).toContain("admin.content_revision.approve_publish");
    expect(actions).toContain("admin.content_revision.scheduled_publish");
    // 승인 발행과 뭉뚱그리지 않는다 — 행위자가 사람이 아니라 워커다.
    const labels = AUDIT_LOG_ACTION_PRESETS.filter((preset) =>
      ["admin.content_revision.approve_publish", "admin.content_revision.scheduled_publish"].includes(preset.action)
    ).map((preset) => preset.label);
    expect(new Set(labels).size).toBe(2);
  });
});

/**
 * GAP-076 #4 ⓓ — **유령 프리셋 부정 단언.**
 *
 * 오늘까지 이 표를 무는 단언은 중복·라벨·필터 검증 통과·특정 넷의 존재뿐이었다 —
 * **각 액션이 서버가 실제로 기록하는 문자열인지는 아무도 묻지 않았다.** 라운드 75 P-4의
 * 대장(`admin-canonical-mirrors.test.ts`)은 이 표를 *"부분집합이라 전수 대조 대상이 아니다"* 로
 * 면제해 뒀는데, 그 판정은 **한 방향에만** 옳다: "서버의 전부가 여기 있어야 한다"는 틀리지만
 * (프리셋은 의도된 부분집합이다), **"여기 있는 것은 서버에 있어야 한다"는 여전히 참이어야
 * 한다.** 오타 하나·서버에서 사라진 액션 하나는 CS에게 **0건짜리 후보**를 주는데, 0건은
 * "기록이 없다"와 화면에서 구별되지 않는다 — 오늘의 스물셋은 전부 실재하므로 이 단언이
 * 하는 일은 그 사실을 **묶어 두는 것**이다.
 *
 * ⚠️ **반대 방향은 세우지 않는다**(서버의 액션 전부가 프리셋에 있어야 한다 — 아니다).
 */
describe("AUDIT_LOG_ACTION_PRESETS의 유령 없음 (GAP-076 #4)", () => {
  it("스윕이 실제로 서버 소스를 훑는다 (빈 답이 조용히 통과하지 않게)", () => {
    expect(existsSync(apiSrcDir), "apps/api/src should exist").toBe(true);
    expect(apiSourcePaths().length).toBeGreaterThan(100);
    // 바늘 검증: 주석 안의 인용은 놓아주고, 타입 선언·값 전달은 애초에 리터럴이 아니다.
    expect(serverRecordedActions().size).toBeGreaterThan(30);
    expect([...codeOnly('// action: "ghost.action"').matchAll(AUDIT_ACTION_LITERAL)]).toHaveLength(0);
    expect([...codeOnly('action: "auth.login"').matchAll(AUDIT_ACTION_LITERAL)]).toHaveLength(1);
  });

  it("모든 프리셋의 action이 서버 소스에 실재한다", () => {
    const recorded = serverRecordedActions();
    const ghosts = AUDIT_LOG_ACTION_PRESETS.map((preset) => preset.action).filter(
      (action) => !recorded.has(action)
    );
    expect(ghosts, "서버가 기록하지 않는 프리셋(=조회하면 언제나 0건)").toEqual([]);
  });

  it("어드민의 실패 로그인 세 액션이 앱 쪽 거절 액션의 대칭 근거로 살아 있다", () => {
    const recorded = serverRecordedActions();
    // 이 셋이 있는데 앱 쪽에 대응 액션이 0건이던 것이 GAP-076 #4의 근거였다.
    for (const action of ["admin.login_failed", "admin.mfa_login_failed", "admin.password_change_failed"]) {
      expect(recorded.has(action), `${action}가 서버에 있다`).toBe(true);
    }
    expect(recorded.has("auth.login_rejected"), "앱 로그인 거절도 이제 기록된다").toBe(true);
  });
});

describe("auditLogActorLabel (CS-101)", () => {
  it("shows the admin email as-is", () => {
    const entry = { actorUserId: ACTOR_ID, actorEmail: "ops@wooriai.example" };
    expect(auditLogActorKind(entry)).toBe("admin");
    expect(auditLogActorLabel(entry)).toBe("ops@wooriai.example");
  });

  it("marks a non-admin actor as 사용자 with only the first 8 id chars", () => {
    const entry = { actorUserId: ACTOR_ID, actorEmail: null };
    expect(auditLogActorKind(entry)).toBe("non_admin");
    expect(auditLogActorLabel(entry)).toBe("사용자(3f1c9a2e)");
    // 개인정보(이메일·닉네임)나 UUID 전체가 라벨에 섞이지 않는다.
    expect(auditLogActorLabel(entry)).not.toContain(ACTOR_ID);
    expect(shortActorId(ACTOR_ID)).toHaveLength(8);
  });

  it("labels an actor-less entry as system", () => {
    const entry = { actorUserId: null, actorEmail: null };
    expect(auditLogActorKind(entry)).toBe("system");
    expect(auditLogActorLabel(entry)).toBe("시스템/알 수 없음");
  });
});
