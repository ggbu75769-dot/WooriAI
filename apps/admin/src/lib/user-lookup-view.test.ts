import { describe, expect, it } from "vitest";
import type { AdminLookupUser } from "./admin-api";
import {
  accountStateLabel,
  childSummary,
  effectiveQueryLength,
  formatLookupDate,
  householdRoleSummary,
  lastActivityLabel,
  userActivitySummary,
  userDisplayLabel,
  userLookupQueryError
} from "./user-lookup-view";

function user(overrides: Partial<AdminLookupUser> = {}): AdminLookupUser {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    email: "parent@example.com",
    displayName: "우리아이맘",
    authProvider: "kakao",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    households: [],
    expenseCount: 0,
    ...overrides
  };
}

// ADM-127: 검색어 검증은 서버(admin-users-lookup.service.ts)와 같은 기준을 쓴다 —
// LIKE 와일드카드를 뺀 실질 길이가 2자 이상이어야 한다. `%%` 한 방으로 전체
// 사용자 명단이 나오는 길을 클라이언트에서도 막는다.
describe("userLookupQueryError (ADM-127)", () => {
  it("requires a non-empty query", () => {
    expect(userLookupQueryError("")).toContain("입력");
    expect(userLookupQueryError("   ")).toContain("입력");
  });

  it("requires at least 2 characters", () => {
    expect(userLookupQueryError("a")).toContain("2자");
    expect(userLookupQueryError("ab")).toBeNull();
    expect(userLookupQueryError("  ab  ")).toBeNull();
  });

  it("does not count LIKE wildcards toward the minimum length", () => {
    expect(effectiveQueryLength("%%")).toBe(0);
    expect(effectiveQueryLength("%a%")).toBe(1);
    expect(effectiveQueryLength("a_b")).toBe(2);
    expect(userLookupQueryError("%%")).toContain("2자");
    expect(userLookupQueryError("%_%")).toContain("2자");
    // 이메일에 흔한 밑줄은 정상 검색어로 통과한다.
    expect(userLookupQueryError("kim_a")).toBeNull();
  });
});

describe("user lookup card labels", () => {
  it("falls back from display name to email to a shortened id", () => {
    expect(userDisplayLabel(user())).toBe("우리아이맘");
    expect(userDisplayLabel(user({ displayName: "  " }))).toBe("parent@example.com");
    expect(userDisplayLabel(user({ displayName: null, email: null }))).toBe("22222222…");
  });

  it("marks withdrawn/blocked accounts and soft-deleted rows distinctly", () => {
    expect(accountStateLabel(user())).toBe("활성");
    expect(accountStateLabel(user({ status: "withdrawn" }))).toBe("탈퇴");
    expect(accountStateLabel(user({ status: "blocked" }))).toBe("차단");
    expect(accountStateLabel(user({ status: "active", deletedAt: "2026-08-02T00:00:00.000Z" }))).toBe(
      "탈퇴(삭제 처리됨)"
    );
  });

  it("shows children as nickname + stage mode only (no birth/due dates)", () => {
    expect(childSummary({ nickname: "콩이", stageMode: "pregnant" })).toBe("콩이 · 임신 중");
    expect(childSummary({ nickname: "봄이", stageMode: "born" })).toBe("봄이 · 출생");
    expect(childSummary({ nickname: "별이", stageMode: "manual" })).toBe("별이 · 직접 선택");
  });

  it("renders the household role and membership state together", () => {
    expect(householdRoleSummary({ role: "owner", memberStatus: "active" })).toBe("소유자 · 활성");
    expect(householdRoleSummary({ role: "co_parent", memberStatus: "pending" })).toBe("공동 양육자 · 초대 대기");
    expect(householdRoleSummary({ role: "gift_participant", memberStatus: "left" })).toBe("선물 참여자 · 나감");
  });

  it("summarizes activity with counts only — never an expense amount", () => {
    const summary = userActivitySummary(
      user({
        expenseCount: 12,
        households: [
          {
            id: "h1",
            name: "우리집",
            role: "owner",
            memberStatus: "active",
            isOwner: true,
            children: [
              { id: "c1", nickname: "콩이", stageMode: "pregnant" },
              { id: "c2", nickname: "봄이", stageMode: "born" }
            ]
          }
        ]
      })
    );
    expect(summary).toBe("가구 1개 · 아이 2명 · 지출 12건");
    expect(summary).not.toContain("원");
  });

  it("distinguishes 'never active' from a real last-login timestamp", () => {
    expect(lastActivityLabel(user({ lastLoginAt: null }))).toBe("기록 없음");
    expect(lastActivityLabel(user({ lastLoginAt: "2026-08-01T00:00:00.000Z" }))).not.toBe("기록 없음");
    expect(formatLookupDate(null)).toBe("-");
  });
});
