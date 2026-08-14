import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError, scheduleContentRevision } from "./lib/admin-api";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const REVISION_ID = "3f6d2c10-aaaa-4bbb-8ccc-112233445566";
const SAMPLE_REVISION = {
  id: REVISION_ID,
  entityType: "disclosure",
  entityId: null,
  revisionNo: 1,
  payload: { key: "sched_test", text: "예약 문구" },
  status: "in_review",
  authorAdminId: "author-id",
  reviewerAdminId: null,
  reviewNote: null,
  submittedAt: "2026-08-14T00:00:00.000Z",
  reviewedAt: null,
  publishedAt: null,
  scheduledFor: "2026-08-15T09:00:00.000Z",
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z"
};

// COM-103b: CMS scheduled publishing — API client function against a stubbed
// fetch (same pattern as admin-api.test.ts), plus source checks that the
// review page actually wires the 예약 게시 UI up.
describe("scheduleContentRevision API client (COM-103b)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123; other=1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCH /admin/content-revisions/:id/schedule sets an ISO scheduledFor with the CSRF header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_REVISION));

    const result = await scheduleContentRevision(REVISION_ID, "2026-08-15T09:00:00.000Z");

    expect(result.scheduledFor).toBe("2026-08-15T09:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`/api/v1/admin/content-revisions/${REVISION_ID}/schedule`);
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-token-123");
    expect(JSON.parse(String(init.body))).toEqual({ scheduledFor: "2026-08-15T09:00:00.000Z" });
  });

  it("sends an explicit null body to clear the schedule (예약 해제)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...SAMPLE_REVISION, scheduledFor: null }));

    const result = await scheduleContentRevision(REVISION_ID, null);

    expect(result.scheduledFor).toBeNull();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ scheduledFor: null });
  });

  it("maps the past-time / self-schedule error envelopes onto AdminApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: { code: "CONTENT_REVISION_SCHEDULE_IN_PAST", message: "예약 게시 시각은 미래 시각이어야 해요." }
      })
    );

    const failure = await scheduleContentRevision(REVISION_ID, "2020-01-01T00:00:00.000Z").catch((error) => error);

    expect(failure).toBeInstanceOf(AdminApiError);
    expect((failure as AdminApiError).status).toBe(400);
    expect((failure as AdminApiError).code).toBe("CONTENT_REVISION_SCHEDULE_IN_PAST");
    expect((failure as AdminApiError).message).toBe("예약 게시 시각은 미래 시각이어야 해요.");
  });
});

describe("Review page 예약 게시 UI (COM-103b)", () => {
  it("exposes the schedule function from the api lib", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("scheduleContentRevision");
    expect(api).toContain("/schedule");
  });

  it("shows the 예약 상태 plus datetime-local input and 설정/해제 actions for in_review revisions", () => {
    const source = readSource("app/reviews/page.tsx");
    expect(source).toContain("scheduleContentRevision");
    expect(source).toContain('type="datetime-local"');
    expect(source).toContain("예약 게시 설정");
    expect(source).toContain("예약 해제");
    expect(source).toContain("예약 게시:");
    // Client-side guard mirrors the API's future-only rule.
    expect(source).toContain("예약 게시 시각은 미래 시각으로 입력해 주세요.");
  });

  it("tells the operator that scheduled publishing needs the background worker (WORKER_ENABLED=1)", () => {
    const source = readSource("app/reviews/page.tsx");
    expect(source).toContain("WORKER_ENABLED=1");
  });
});
