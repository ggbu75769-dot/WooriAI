import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as localBackend from "../api/local-backend";
import { LOCAL_HOUSEHOLD_ID } from "../api/local-fixtures";
import { formatInviteExpiry, memberBadge, memberRoleLabel } from "./memberLabels";

const mobileRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

describe("FAM-121B member role labels", () => {
  it("labels all four domain roles distinctly instead of collapsing them into 멤버", () => {
    const labels = ["owner", "co_parent", "viewer", "gift_participant"].map((role) => memberRoleLabel(role));

    expect(labels).toEqual(["관리자", "공동부모", "보기 전용", "선물 참여"]);
    expect(new Set(labels).size).toBe(4);
    // An unknown role must not be mislabeled as one of the real ones.
    expect(memberRoleLabel("future_role")).toBe("멤버");
  });

  it("marks a pending membership as 수락 대기 so it is never shown as already joined", () => {
    expect(memberBadge("co_parent", "active")).toEqual({ label: "공동부모", tone: "neutral" });
    expect(memberBadge("co_parent", "pending")).toEqual({ label: "공동부모 · 수락 대기", tone: "neutral" });
    expect(memberBadge("viewer", "pending").label).toBe("보기 전용 · 수락 대기");
    expect(memberBadge("owner", "active").tone).toBe("warning");
  });
});

describe("FAM-121B invite expiry formatting", () => {
  // Built from local-time components (then serialized) so the expectations hold in any
  // TZ the test runner happens to use — the formatter renders in the device's own zone,
  // which for this app's users is Asia/Seoul.
  const at = (year: number, monthIndex: number, day: number, hour: number) => new Date(year, monthIndex, day, hour, 0);
  const now = at(2026, 7, 27, 10);

  it("counts calendar days remaining and names the expiry date", () => {
    expect(formatInviteExpiry(at(2026, 7, 30, 10).toISOString(), now)).toBe("8월 30일까지 · 3일 남음");
    // Later the same calendar day is "오늘 만료", not "0일 남음".
    expect(formatInviteExpiry(at(2026, 7, 27, 23).toISOString(), now)).toBe("8월 27일까지 · 오늘 만료");
    // A few hours away but landing tomorrow reads 1일, not 0일.
    expect(formatInviteExpiry(at(2026, 7, 28, 2).toISOString(), now)).toBe("8월 28일까지 · 1일 남음");
  });

  it("never implies a lapsed invite is still usable", () => {
    expect(formatInviteExpiry(at(2026, 7, 26, 10).toISOString(), now)).toBe("만료됨");
    expect(formatInviteExpiry("not-a-date", now)).toBe("not-a-date");
  });
});

describe("FAM-121B pending invite listing and cancellation (local backend)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("lists a created invite as pending without ever exposing the link or token", () => {
    const created = localBackend.createInvite(LOCAL_HOUSEHOLD_ID, "co_parent", "link");
    const { invites } = localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID);

    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({
      householdId: LOCAL_HOUSEHOLD_ID,
      role: "co_parent",
      status: "pending",
      canReshareLink: false
    });
    const serialized = JSON.stringify(invites[0]);
    expect(serialized).not.toContain(created.inviteUrl);
    expect(serialized).not.toContain("/invite/");
  });

  it("cancels a pending invite so it disappears from the list and stops being acceptable", () => {
    const created = localBackend.createInvite(LOCAL_HOUSEHOLD_ID, "viewer", "link");
    const inviteToken = created.inviteUrl.split("/invite/")[1];
    const inviteId = localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID).invites[0].id;

    expect(localBackend.cancelHouseholdInvite(LOCAL_HOUSEHOLD_ID, inviteId)).toEqual({ success: true });
    expect(localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID).invites).toEqual([]);
    expect(() => localBackend.acceptInvite(inviteToken)).toThrowError();
    // Cancelling twice is rejected rather than silently succeeding.
    expect(() => localBackend.cancelHouseholdInvite(LOCAL_HOUSEHOLD_ID, inviteId)).toThrowError();
    expect(() => localBackend.cancelHouseholdInvite(LOCAL_HOUSEHOLD_ID, "missing-invite")).toThrowError();
  });

  it("drops an accepted invite out of the pending list", () => {
    const created = localBackend.createInvite(LOCAL_HOUSEHOLD_ID, "co_parent", "link");
    localBackend.acceptInvite(created.inviteUrl.split("/invite/")[1]);

    expect(localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID).invites).toEqual([]);
  });
});

describe("FAM-121B family surface contract", () => {
  it("wires the owner-only 대기 중인 초대 section into the family screen", () => {
    const source = readSource("app/family/index.tsx");

    expect(source).toContain("listHouseholdInvites");
    expect(source).toContain("cancelHouseholdInvite");
    expect(source).toContain("대기 중인 초대");
    expect(source).toContain("confirmCancelInvite");
    // Owner-only + session-only gating: the section renders under canManageMembers,
    // which is itself false whenever there is no session (see hasSession && myRole).
    expect(source).toContain("{canManageMembers ? (");
    expect(source).toContain('enabled: canManageMembers');
    expect(source).toContain('const canManageMembers = hasSession && myRole === "owner"');
    // Destructive action keeps the repo's confirm-Alert convention.
    expect(source).toContain("Alert.alert(`${roleLabel} 초대를 취소할까요?`");
  });

  it("keeps the FAM-001 pixel-lock preview badges at the reference image's 관리자/멤버 wording", () => {
    const source = readSource("app/family/index.tsx");

    // The non-session preview path is exactly what the FAM-001 capture renders.
    expect(source).toContain('previewMembers');
    expect(source).toContain('label={member.role === "owner" ? "관리자" : "멤버"}');
    // The four-role labels apply only to a real session.
    expect(source).toContain("{hasSession ? (");
    expect(source).toContain("memberBadge(member.role, member.status)");
  });

  it("offers a dependency-free copy path on the invite screen and tells the truth about link recovery", () => {
    const source = readSource("app/family/invite.tsx");
    const packageJson = readSource("package.json");

    expect(source).toContain("selectable");
    expect(source).toContain("길게 눌러");
    expect(source).toContain("지금 화면에서만 볼 수 있어요");
    // FAM-121B introduces no new dependency: expo-clipboard is not in apps/mobile's
    // dependencies, so the copy affordance must stay Share + selectable text.
    // (The screen may *mention* expo-clipboard in a comment explaining why; what must
    // not appear is an actual clipboard import or call.)
    expect(packageJson).not.toContain("expo-clipboard");
    expect(source).not.toMatch(/from\s+["'][^"']*clipboard["']/i);
    expect(source).not.toContain("setStringAsync");
    expect(source).not.toContain("Clipboard.setString");
  });
});
