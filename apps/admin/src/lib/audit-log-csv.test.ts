import { describe, expect, it, vi } from "vitest";
import type { AdminAuditLogEntry, AdminAuditLogsResult } from "./admin-api";
import {
  AUDIT_LOG_CSV_COLUMNS,
  AUDIT_LOG_EXPORT_MAX_ROWS,
  AUDIT_LOG_EXPORT_PAGE_SIZE,
  auditLogCsvFilename,
  buildAuditLogCsv,
  collectAuditLogsForExport,
  escapeCsvCell
} from "./audit-log-csv";

function makeEntry(overrides: Partial<AdminAuditLogEntry> = {}): AdminAuditLogEntry {
  return {
    id: "log-1",
    createdAt: "2026-08-21T01:02:03.000Z",
    actorUserId: "user-1",
    actorEmail: "admin@example.com",
    householdId: null,
    action: "admin.admin_user.update",
    targetType: "admin_user",
    targetId: "target-1",
    before: null,
    after: null,
    ipHash: "abcd1234",
    ...overrides
  };
}

function pageResult(auditLogs: AdminAuditLogEntry[], offset: number, total: number): AdminAuditLogsResult {
  return {
    auditLogs,
    pageInfo: { total, limit: AUDIT_LOG_EXPORT_PAGE_SIZE, offset, hasMore: offset + auditLogs.length < total }
  };
}

// ADM-117: CSV 셀 방어 — product-link-bulk-csv.util(API 쪽)의 수식 인젝션
// 중화 관례 + RFC-4180 따옴표/개행 이스케이프.
describe("escapeCsvCell (ADM-117)", () => {
  it("passes plain text through untouched", () => {
    expect(escapeCsvCell("admin.admin_user.update")).toBe("admin.admin_user.update");
    expect(escapeCsvCell("")).toBe("");
  });

  it("neutralizes formula-injection leading characters with a quote prefix", () => {
    expect(escapeCsvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(escapeCsvCell("+1234")).toBe("'+1234");
    expect(escapeCsvCell("-cmd")).toBe("'-cmd");
    expect(escapeCsvCell("@import")).toBe("'@import");
    expect(escapeCsvCell("\tleading-tab")).toBe("'\tleading-tab");
  });

  it("quotes cells containing commas, quotes, or newlines (RFC-4180)", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes BEFORE quoting so the guard prefix survives inside quotes", () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
  });
});

describe("buildAuditLogCsv (ADM-117)", () => {
  it("emits the fixed header row followed by one CRLF-terminated line per entry", () => {
    const csv = buildAuditLogCsv([makeEntry()]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(AUDIT_LOG_CSV_COLUMNS.join(","));
    expect(lines[0]).toBe("id,createdAt,actorEmail,actorUserId,householdId,action,targetType,targetId,before,after,ipHash");
    expect(lines[1]).toBe(
      "log-1,2026-08-21T01:02:03.000Z,admin@example.com,user-1,,admin.admin_user.update,admin_user,target-1,,,abcd1234"
    );
    // Trailing CRLF -> last split element is empty.
    expect(lines[2]).toBe("");
  });

  it("serializes before/after snapshots as JSON strings inside escaped cells", () => {
    const csv = buildAuditLogCsv([
      makeEntry({ before: { role: "editor" }, after: { role: "admin", note: "a,b" } })
    ]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('"{""role"":""editor""}"');
    expect(dataLine).toContain('"{""role"":""admin"",""note"":""a,b""}"');
  });

  it("neutralizes formula-looking values coming from log fields", () => {
    const csv = buildAuditLogCsv([makeEntry({ action: "=2+5", targetId: "@target" })]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain("'=2+5");
    expect(dataLine).toContain("'@target");
  });

  it("caps the output at 1,000 data rows even when given more", () => {
    const entries = Array.from({ length: AUDIT_LOG_EXPORT_MAX_ROWS + 50 }, (_, i) => makeEntry({ id: `log-${i}` }));
    const csv = buildAuditLogCsv(entries);
    // header + 1000 data rows + trailing empty chunk from the final CRLF
    expect(csv.split("\r\n")).toHaveLength(1 + AUDIT_LOG_EXPORT_MAX_ROWS + 1);
  });
});

describe("auditLogCsvFilename (ADM-117)", () => {
  it("formats as audit-logs-YYYYMMDD.csv from the given local date", () => {
    expect(auditLogCsvFilename(new Date(2026, 7, 21))).toBe("audit-logs-20260821.csv");
    expect(auditLogCsvFilename(new Date(2026, 0, 5))).toBe("audit-logs-20260105.csv");
  });
});

describe("collectAuditLogsForExport (ADM-117)", () => {
  it("walks the existing list endpoint in limit-100 pages until hasMore is false", async () => {
    const total = 230;
    const all = Array.from({ length: total }, (_, i) => makeEntry({ id: `log-${i}` }));
    const fetchPage = vi.fn(async ({ limit, offset }: { limit?: number; offset?: number }) =>
      pageResult(all.slice(offset ?? 0, (offset ?? 0) + (limit ?? 0)), offset ?? 0, total)
    );

    const { entries, truncated } = await collectAuditLogsForExport(fetchPage);

    expect(entries).toHaveLength(total);
    expect(truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map(([query]) => query)).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
      { limit: 100, offset: 200 }
    ]);
  });

  it("stops at the 1,000-row cap and reports truncation when the server has more", async () => {
    const total = 1450;
    const all = Array.from({ length: total }, (_, i) => makeEntry({ id: `log-${i}` }));
    const fetchPage = vi.fn(async ({ limit, offset }: { limit?: number; offset?: number }) =>
      pageResult(all.slice(offset ?? 0, (offset ?? 0) + (limit ?? 0)), offset ?? 0, total)
    );

    const { entries, truncated } = await collectAuditLogsForExport(fetchPage);

    expect(entries).toHaveLength(AUDIT_LOG_EXPORT_MAX_ROWS);
    expect(entries[0].id).toBe("log-0");
    expect(entries[999].id).toBe("log-999");
    expect(truncated).toBe(true);
    // 100행 x 10페이지에서 상한에 닿으면 더 요청하지 않는다.
    expect(fetchPage).toHaveBeenCalledTimes(10);
  });

  it("does not report truncation when exactly 1,000 rows exist", async () => {
    const total = AUDIT_LOG_EXPORT_MAX_ROWS;
    const all = Array.from({ length: total }, (_, i) => makeEntry({ id: `log-${i}` }));
    const fetchPage = vi.fn(async ({ limit, offset }: { limit?: number; offset?: number }) =>
      pageResult(all.slice(offset ?? 0, (offset ?? 0) + (limit ?? 0)), offset ?? 0, total)
    );

    const { entries, truncated } = await collectAuditLogsForExport(fetchPage);

    expect(entries).toHaveLength(total);
    expect(truncated).toBe(false);
  });

  it("returns an empty collection when there are no matching rows", async () => {
    const fetchPage = vi.fn(async () => pageResult([], 0, 0));

    const { entries, truncated } = await collectAuditLogsForExport(fetchPage);

    expect(entries).toHaveLength(0);
    expect(truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("bails out instead of looping forever on a hasMore=true empty page", async () => {
    const fetchPage = vi.fn(async () => ({
      auditLogs: [],
      pageInfo: { total: 10, limit: AUDIT_LOG_EXPORT_PAGE_SIZE, offset: 0, hasMore: true }
    }));

    const { entries, truncated } = await collectAuditLogsForExport(fetchPage);

    expect(entries).toHaveLength(0);
    expect(truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
