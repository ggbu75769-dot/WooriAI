import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isExpenseEntryLocked,
  resolveHouseholdRole,
  type HouseholdRoleMap
} from "./record-permissions";
import {
  createHouseholdRoleRevalidator,
  ROLE_REVALIDATE_MIN_INTERVAL_MS,
  type HouseholdRoleSnapshot
} from "./role-revalidation";

/**
 * 라운드 40 J-3 — 승격(viewer → co_parent)이 앱에 영영 반영되지 않던 문제.
 *
 * 역할 표를 채우는 세 경로가 전부 사용자 행동에 달려 있었고(로그인 · 초대 수락 · 가족 화면
 * 방문), 가족 화면은 기본 가구 하나만 조회한다. 이제 **잠금 안내를 띄우는 순간**이 재검증
 * 트리거다: 백그라운드로 GET /me를 한 번 부르고 표 전체를 서버 기준으로 갈아 끼운다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const NOW = Date.parse("2026-08-27T12:00:00.000Z");

/** 서버가 지금 말하는 목록을 돌려주는 가짜 /me. */
function fakeMe(households: HouseholdRoleSnapshot[]) {
  return vi.fn(() => Promise.resolve(households));
}

describe("라운드 40 J-3 역할 재검증 스로틀", () => {
  it("안내 1회 → 재조회 1회 → 받은 목록으로 표를 갱신한다", async () => {
    const revalidator = createHouseholdRoleRevalidator();
    const fetchHouseholds = fakeMe([{ id: "h-1", role: "co_parent" }]);
    const applyHouseholds = vi.fn();

    expect(revalidator.request({ now: NOW, fetchHouseholds, applyHouseholds })).toBe(true);
    await vi.waitFor(() => expect(applyHouseholds).toHaveBeenCalledTimes(1));
    expect(fetchHouseholds).toHaveBeenCalledTimes(1);
    expect(applyHouseholds).toHaveBeenCalledWith([{ id: "h-1", role: "co_parent" }]);
  });

  it("표가 갱신되면 다음 판정부터 잠금이 풀린다(승격 반영)", async () => {
    // 승격 전: 서버가 가구 하나뿐이라고 말한 viewer라 잠겨 있다.
    let householdRoles: HouseholdRoleMap | null = { "h-1": "viewer" };
    let knownHouseholdIds: string[] | null = ["h-1"];
    const lockedNow = () =>
      isExpenseEntryLocked({
        hasSession: true,
        role: resolveHouseholdRole({ householdRoles, knownHouseholdIds })
      });
    expect(lockedNow()).toBe(true);

    const revalidator = createHouseholdRoleRevalidator();
    revalidator.request({
      now: NOW,
      fetchHouseholds: fakeMe([{ id: "h-1", role: "co_parent" }]),
      // 세션 스토어의 setHouseholdRoles가 하는 일과 같은 모양(표 전체 교체).
      applyHouseholds: (households) => {
        householdRoles = Object.fromEntries(households.map((h) => [h.id, h.role ?? ""]));
        knownHouseholdIds = households.map((h) => h.id);
      }
    });

    await vi.waitFor(() => expect(lockedNow()).toBe(false));
  });

  it("같은 세션에서 안내를 여러 번 봐도 간격 안에서는 한 번만 나간다", async () => {
    const revalidator = createHouseholdRoleRevalidator();
    const fetchHouseholds = fakeMe([{ id: "h-1", role: "viewer" }]);
    const applyHouseholds = vi.fn();

    expect(revalidator.request({ now: NOW, fetchHouseholds, applyHouseholds })).toBe(true);
    await vi.waitFor(() => expect(applyHouseholds).toHaveBeenCalledTimes(1));

    expect(revalidator.request({ now: NOW + 1_000, fetchHouseholds, applyHouseholds })).toBe(false);
    expect(
      revalidator.request({
        now: NOW + ROLE_REVALIDATE_MIN_INTERVAL_MS - 1,
        fetchHouseholds,
        applyHouseholds
      })
    ).toBe(false);
    expect(fetchHouseholds).toHaveBeenCalledTimes(1);

    // 간격이 지나면 다시 확인한다(그 사이에 승격됐을 수 있다).
    expect(
      revalidator.request({
        now: NOW + ROLE_REVALIDATE_MIN_INTERVAL_MS,
        fetchHouseholds,
        applyHouseholds
      })
    ).toBe(true);
    await vi.waitFor(() => expect(fetchHouseholds).toHaveBeenCalledTimes(2));
  });

  it("조회가 끝나기 전의 두 번째 안내는 요청을 겹쳐 보내지 않는다", () => {
    const revalidator = createHouseholdRoleRevalidator();
    const fetchHouseholds = vi.fn(() => new Promise<HouseholdRoleSnapshot[]>(() => {}));
    const applyHouseholds = vi.fn();

    expect(revalidator.request({ now: NOW, fetchHouseholds, applyHouseholds })).toBe(true);
    expect(
      revalidator.request({
        now: NOW + ROLE_REVALIDATE_MIN_INTERVAL_MS * 2,
        fetchHouseholds,
        applyHouseholds
      })
    ).toBe(false);
    expect(fetchHouseholds).toHaveBeenCalledTimes(1);
  });

  it("실패하면 표를 건드리지 않는다(예전 표 그대로 = 새로 잠기는 것이 없다)", async () => {
    const revalidator = createHouseholdRoleRevalidator({ minIntervalMs: 0 });
    const applyHouseholds = vi.fn();
    const failing = vi.fn(() => Promise.reject(new Error("offline")));

    expect(revalidator.request({ now: NOW, fetchHouseholds: failing, applyHouseholds })).toBe(true);
    await vi.waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
    // 마이크로태스크가 다 돌 때까지 기다려도 apply는 없다.
    await Promise.resolve();
    expect(applyHouseholds).not.toHaveBeenCalled();
  });
});

describe("라운드 40 J-3 배선 (source contract)", () => {
  it("안내가 곧 재검증 트리거다 — 기존 클라이언트 호출 하나를 재사용한다", () => {
    const hookSource = source("src/family/useExpenseEntryGate.ts");
    // 안내 함수 안에서 재검증을 부른다(guard도 잠기면 이 함수를 지난다).
    const explainBlock = hookSource.slice(
      hookSource.indexOf("export function explainExpenseViewOnly()"),
      hookSource.indexOf("export function useExpenseEntryGate()")
    );
    expect(explainBlock).toContain("Alert.alert(EXPENSE_VIEW_ONLY_ALERT_TITLE, EXPENSE_VIEW_ONLY_MESSAGE);");
    expect(explainBlock).toContain("revalidateHouseholdRoles();");
    // 스로틀은 모듈 지역(앱 세션 수명)이고, 판정은 순수 모듈에 있다.
    expect(hookSource).toContain("const householdRoleRevalidator = createHouseholdRoleRevalidator();");
    expect(hookSource).toContain('from "./role-revalidation"');
    // 서버 목록은 GET /me 하나로 받고, 표는 세션 스토어가 통째로 갈아 끼운다.
    expect(hookSource).toContain("getMe(accessToken)");
    expect(hookSource).toContain("applyHouseholds: setHouseholdRoles");
    // 데모(로컬) 세션에는 서버 가구가 없다 -- 실토큰일 때만 부른다.
    expect(hookSource).toContain("if (!accessToken) return;");
  });

  it("클라이언트는 서버 계약 그대로의 GET /me 하나만 더한다", () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain("export function getMe(token: string) {");
    expect(clientSource).toContain('households: Array<{ id: string; name: string; role: string }>;');
    expect(clientSource).toContain('}>("/me", { token });');
  });
});
