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
