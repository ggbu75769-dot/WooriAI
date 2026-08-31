import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditLogsHrefForActor, emptyAuditLogFilters, type AuditLogFilters } from "./audit-log-filters";
import {
  AUDIT_LOG_FULL_ID_SUMMARY,
  auditLogActorCell,
  auditLogEmptyStateMessage,
  auditLogTargetCell
} from "./audit-log-rows";

const adminRoot = process.cwd();

function readAdminSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `apps/admin/${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/** 서버가 실제로 내려주는 세 모양(감사 로그 한 행의 행위자 축). */
const USER_ACTOR = "3f2a91c4-1b2d-4a5e-8c7f-0123456789ab";
const ADMIN_ACTOR = "9a8b7c6d-5e4f-4a3b-8c2d-ba9876543210";
const TARGET_ID = "11112222-3333-4444-5555-666677778888";

function makeFilters(overrides: Partial<AuditLogFilters> = {}): AuditLogFilters {
  return { ...emptyAuditLogFilters(), ...overrides };
}

/**
 * GAP-087 트랙 A — 감사 로그 표가 값을 **글자로** 남기고, 그 행위자로 되짚는 길을 준다.
 *
 * 종전 이 표에서 전체 UUID에 닿는 경로는 `<td title=…>` 하나였다(마우스 호버 · `<td>`는 포커스를
 * 받지 않는다). 그런데 같은 화면의 **행위자 필터가 바로 그 전체 UUID를 요구한다** —
 * 표가 보여 준 것으로 그 표의 필터를 채울 수 없었다. 여기서 고정하는 것은 그 도달 경로다.
 */
describe("auditLogActorCell (GAP-087 ⓐⓑ)", () => {
  it("어드민 계정이 아닌 행위자: 축약 라벨은 그대로 두고 전체 UUID를 글자로 준다", () => {
    const cell = auditLogActorCell({ actorUserId: USER_ACTOR, actorEmail: null });
    // 칸에 서는 표기는 종전 그대로다(개인정보 없이 앞 8자).
    expect(cell.label).toBe("사용자(3f2a91c4)");
    // ⓐ 도달: 전체 값이 title 속성이 아니라 셀의 값으로 있다.
    expect(cell.fullActorId).toBe(USER_ACTOR);
  });

  it("ⓑ 되짚기 주소는 auditLogsHrefForActor 하나에서만 온다 (새 주소 만들기 0건)", () => {
    const cell = auditLogActorCell({ actorUserId: USER_ACTOR, actorEmail: null });
    expect(cell.traceHref).toBe(auditLogsHrefForActor(USER_ACTOR));
    // 그 주소는 이 화면이 마운트 때 읽는 파라미터와 같은 이름이다(사용자 조회의 딥링크와 동일).
    expect(cell.traceHref).toContain("actorUserId=");
  });

  it("ⓑ 어드민 계정 행에는 되짚기 링크가 서지 않는다 (라벨이 이미 그 사람을 부른다)", () => {
    const cell = auditLogActorCell({ actorUserId: ADMIN_ACTOR, actorEmail: "ops@wooriai.example" });
    expect(cell.label).toBe("ops@wooriai.example");
    expect(cell.traceHref).toBeNull();
    // 그래도 값에는 닿는다 — 전체 UUID는 글자로 서고, 그것이 필터에 넣을 수 있는 유일한 값이다
    // (라벨의 이메일은 행위자 필터가 400으로 되돌려보내는 값이다).
    expect(cell.fullActorId).toBe(ADMIN_ACTOR);
  });

  it("행위자가 없는 행(시스템/알 수 없음)에는 펼칠 값도 되짚을 주소도 없다", () => {
    const cell = auditLogActorCell({ actorUserId: null, actorEmail: null });
    expect(cell.label).toBe("시스템/알 수 없음");
    expect(cell.fullActorId).toBeNull();
    expect(cell.traceHref).toBeNull();
  });

  it("개인정보 0건 — 이메일·닉네임을 새로 그리지 않는다", () => {
    const cell = auditLogActorCell({ actorUserId: USER_ACTOR, actorEmail: null });
    // 어드민이 아닌 행위자에는 애초에 이메일이 없고, 이 모듈이 더한 값은 UUID뿐이다.
    expect(JSON.stringify(cell)).not.toContain("@");
    const module = readAdminSource("src/lib/audit-log-rows.ts");
    expect(module).not.toContain("actorEmail!");
    expect(module).not.toContain("displayName");
  });
});

describe("auditLogTargetCell (GAP-087 ⓐ)", () => {
  it("축약 표기는 종전 화면의 formatTarget과 바이트 단위로 같다", () => {
    const cell = auditLogTargetCell({ targetType: "expense", targetId: TARGET_ID });
    expect(cell.label).toBe("expense · 11112222…");
    expect(cell.fullTargetId).toBe(TARGET_ID);
  });

  it("targetId가 없는 행은 종류만 서고 펼칠 값이 없다", () => {
    const cell = auditLogTargetCell({ targetType: "disclosure", targetId: null });
    expect(cell.label).toBe("disclosure");
    expect(cell.fullTargetId).toBeNull();
  });

  it("전체 값이 축약에 가려지지 않는다 (앞 8자가 아니라 전부)", () => {
    const cell = auditLogTargetCell({ targetType: "expense", targetId: TARGET_ID });
    expect(cell.fullTargetId).toHaveLength(TARGET_ID.length);
    expect(cell.label).not.toContain(TARGET_ID);
  });
});

describe("auditLogEmptyStateMessage (GAP-087 ⓒ)", () => {
  it("필터가 하나도 없을 때와 있을 때의 문장이 다르다", () => {
    const unfiltered = auditLogEmptyStateMessage(emptyAuditLogFilters());
    const filtered = auditLogEmptyStateMessage(makeFilters({ action: "expense.update" }));
    expect(unfiltered).not.toBe(filtered);
    // 필터를 걸지 않은 운영자에게 "당신의 조건이 걸렀다"고 말하지 않는다.
    expect(unfiltered).not.toContain("조건에 맞는");
    expect(unfiltered).toContain("필터가 하나도 걸려 있지 않아요");
  });

  it("필터가 걸린 갈래의 문장은 바이트 불변이다 (admin-e2e 스텝 9·11의 앵커)", () => {
    for (const filters of [
      makeFilters({ action: "qa.e2e.no-such-action" }),
      makeFilters({ actorUserId: USER_ACTOR }),
      makeFilters({ fromDate: "2026-08-01" }),
      makeFilters({ toDate: "2026-08-31" })
    ]) {
      expect(auditLogEmptyStateMessage(filters)).toBe("조건에 맞는 기록이 없어요.");
    }
  });

  it("공백만 있는 필터는 필터가 아니다 (판정이 hasAnyAuditLogFilter에서 온다)", () => {
    expect(auditLogEmptyStateMessage(makeFilters({ action: "   " }))).toBe(
      auditLogEmptyStateMessage(emptyAuditLogFilters())
    );
  });

  it("판정을 여기서 다시 짓지 않는다 — 사문이던 hasAnyAuditLogFilter가 그 호출부다", () => {
    const module = readAdminSource("src/lib/audit-log-rows.ts");
    expect(module).toContain("hasAnyAuditLogFilter");
    // 필터 유무를 손으로 다시 세는 자리가 생기지 않았다.
    expect(module).not.toMatch(/filters\.(?:action|actorUserId|fromDate|toDate)/);
  });
});

/**
 * 이 모듈이 **하지 않기로 한 것**을 값으로 문다 — 다음 라운드가 다시 재지 않도록.
 */
describe("audit-log-rows의 경계 (GAP-087)", () => {
  it("서버 0건 · 새 주소 0건 — 요청도 URL 조립도 이 모듈에 없다", () => {
    const module = readAdminSource("src/lib/audit-log-rows.ts");
    expect(module).not.toContain("listAuditLogs");
    expect(module).not.toContain("fetch(");
    // 주소 문자열은 auditLogsHrefForActor 안에만 있다.
    expect(module).not.toContain("/audit-logs?");
    expect(module).toContain("auditLogsHrefForActor");
  });

  it("펼침 라벨이 두 칸에 손으로 두 번 적히지 않는다", () => {
    expect(AUDIT_LOG_FULL_ID_SUMMARY).toBe("전체 ID 보기");
    const page = readAdminSource("app/audit-logs/page.tsx");
    expect(page).not.toContain('"전체 ID 보기"');
    expect((page.match(/AUDIT_LOG_FULL_ID_SUMMARY/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
