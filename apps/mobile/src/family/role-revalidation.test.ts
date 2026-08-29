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
  createOneShotRevalidationLatch,
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

  /**
   * 라운드 41 K-4 — "목록이 없으면 표를 건드리지 않는다"는 계약이 실제로 지켜지는가.
   *
   * 이 모듈은 처음부터 그 계약을 갖고 있었는데(`Array.isArray(households)`), 호출부가
   * `result.households ?? []`로 부재 응답을 **빈 배열로 메워** 넘기는 바람에 계약이 그 자리에서
   * 무력화됐다: 빈 배열은 배열이므로 apply가 불리고, setHouseholdRoles([])가 역할 표를 지워
   * 보기 전용 세션의 잠금이 근거 없이 풀렸다(그다음 저장은 다시 403 → failed 행).
   */
  it("K-4: 목록이 없는 응답(undefined/null)은 표를 건드리지 않는다", async () => {
    for (const absent of [undefined, null]) {
      const revalidator = createHouseholdRoleRevalidator({ minIntervalMs: 0 });
      const applyHouseholds = vi.fn();
      const fetchHouseholds = vi.fn(() => Promise.resolve(absent));

      expect(revalidator.request({ now: NOW, fetchHouseholds, applyHouseholds })).toBe(true);
      await vi.waitFor(() => expect(fetchHouseholds).toHaveBeenCalledTimes(1));
      await Promise.resolve();
      expect(applyHouseholds).not.toHaveBeenCalled();
    }
  });

  it("K-4: 부재 응답을 받아도 잠긴 세션은 잠긴 채로 남는다(표가 지워지지 않는다)", async () => {
    let householdRoles: HouseholdRoleMap | null = { "h-1": "viewer" };
    let knownHouseholdIds: string[] | null = ["h-1"];
    const lockedNow = () =>
      isExpenseEntryLocked({
        hasSession: true,
        role: resolveHouseholdRole({ householdRoles, knownHouseholdIds })
      });
    expect(lockedNow()).toBe(true);

    const revalidator = createHouseholdRoleRevalidator({ minIntervalMs: 0 });
    const fetchHouseholds = vi.fn(() => Promise.resolve(undefined));
    revalidator.request({
      now: NOW,
      fetchHouseholds,
      applyHouseholds: (households) => {
        householdRoles = Object.fromEntries(households.map((h) => [h.id, h.role ?? ""]));
        knownHouseholdIds = households.map((h) => h.id);
      }
    });

    await vi.waitFor(() => expect(fetchHouseholds).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(householdRoles).toEqual({ "h-1": "viewer" });
    expect(lockedNow()).toBe(true);
  });

  /**
   * 라운드 41 K-3 — 초대 수락처럼 "표가 방금 바뀐 것을 아는" 순간은 스로틀의 전제
   * (같은 사실을 반복해 묻는다)가 성립하지 않는다. 그 한 번이 스로틀에 먹히면 새 가구의
   * 역할·목록이 재로그인 전까지 갱신되지 않는다.
   */
  it("K-3: force는 스로틀만 건너뛴다(진행 중인 요청은 여전히 겹치지 않는다)", async () => {
    const revalidator = createHouseholdRoleRevalidator();
    const fetchHouseholds = fakeMe([{ id: "h-1", role: "viewer" }]);
    const applyHouseholds = vi.fn();

    expect(revalidator.request({ now: NOW, fetchHouseholds, applyHouseholds })).toBe(true);
    await vi.waitFor(() => expect(applyHouseholds).toHaveBeenCalledTimes(1));
    // 간격 안이라 평소에는 막히는 자리.
    expect(revalidator.request({ now: NOW + 1_000, fetchHouseholds, applyHouseholds })).toBe(false);
    expect(revalidator.request({ now: NOW + 1_000, fetchHouseholds, applyHouseholds, force: true })).toBe(true);
    await vi.waitFor(() => expect(fetchHouseholds).toHaveBeenCalledTimes(2));

    // 진행 중인 조회가 있으면 force여도 겹쳐 보내지 않는다.
    const busy = createHouseholdRoleRevalidator();
    const pending = vi.fn(() => new Promise<HouseholdRoleSnapshot[]>(() => {}));
    expect(busy.request({ now: NOW, fetchHouseholds: pending, applyHouseholds })).toBe(true);
    expect(busy.request({ now: NOW, fetchHouseholds: pending, applyHouseholds, force: true })).toBe(false);
    expect(pending).toHaveBeenCalledTimes(1);
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
    // 라운드 71 트랙 E: 본문은 인자가 됐고(화면마다 사실이 다르다) **기본값이 지출 기록의
    // 문장**이라 종전 호출부는 한 줄도 바뀌지 않는다. 재검증 트리거라는 이 배선도 그대로다.
    const explainBlock = hookSource.slice(
      hookSource.indexOf("export function explainExpenseViewOnly("),
      hookSource.indexOf("export function useExpenseEntryGate()")
    );
    expect(explainBlock).toContain("message: string = EXPENSE_VIEW_ONLY_MESSAGE");
    // 라운드 71 리뷰 S-1: 본문 자리에 문자열이 아닌 값이 오면(핸들러에 직접 이어 붙인 press
    // 이벤트) 기본 문장으로 떨어진다 — 자리(제목/본문)와 재검증 배선은 그대로다.
    expect(explainBlock).toContain(
      'Alert.alert(EXPENSE_VIEW_ONLY_ALERT_TITLE, typeof message === "string" ? message : EXPENSE_VIEW_ONLY_MESSAGE);'
    );
    expect(explainBlock).toContain("revalidateHouseholdRoles();");
    // 스로틀은 모듈 지역(앱 세션 수명)이고, 판정은 순수 모듈에 있다.
    expect(hookSource).toContain("const householdRoleRevalidator = createHouseholdRoleRevalidator();");
    expect(hookSource).toContain('from "./role-revalidation"');
    // 서버 목록은 GET /me 하나로 받고, 표는 세션 스토어가 통째로 갈아 끼운다.
    expect(hookSource).toContain("getMe(accessToken)");
    expect(hookSource).toContain("applyHouseholds: setHouseholdRoles");
    // 데모(로컬) 세션에는 서버 가구가 없다 -- 실토큰일 때만 부른다(L-1: 발사 안 함 = false).
    expect(hookSource).toContain("if (!accessToken) return false;");
  });

  it("K-4: 호출부가 부재 응답을 빈 목록으로 메우지 않는다", () => {
    const hookSource = source("src/family/useExpenseEntryGate.ts");
    expect(hookSource).toContain("getMe(accessToken).then((result) => result.households)");
    // `?? []`가 다시 들어오면 role-revalidation의 계약이 그 자리에서 무력화된다.
    expect(hookSource).not.toContain("result.households ?? []");
  });

  /**
   * 라운드 41 K-3 — 회복 경로가 없던 두 자리를 각각 막는다.
   */
  it("K-3: 초대 수락 응답이 표·목록을 서버 기준으로 한 벌로 다시 받는다", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    // 새 모듈을 만들지 않고 J-3의 재검증 경로를 그대로 재사용한다.
    expect(acceptSource).toContain('from "../../../src/family/useExpenseEntryGate"');
    expect(acceptSource).toContain("revalidateHouseholdRoles({ force: true });");
    // 한 가구짜리 사실(setHouseholdRole)은 그대로 두고, 그 **뒤에** 전체 갱신이 온다.
    const acceptIndex = acceptSource.indexOf("setHouseholdRole(result.household.id, result.household.role)");
    expect(acceptIndex).toBeGreaterThan(0);
    expect(acceptSource.indexOf("revalidateHouseholdRoles({ force: true })")).toBeGreaterThan(acceptIndex);
    // 데모 세션은 종전대로 제외된다(로컬 백엔드에는 서버 가구가 없다).
    const realSessionBlock = acceptSource.slice(acceptSource.indexOf("if (!isTestSession) {"), acceptIndex);
    expect(realSessionBlock).toContain("useSessionStore.setState({ defaultHouseholdId: result.household.id });");
  });

  it("K-3: 표는 있는데 목록이 없는 세션은 앱 세션당 한 번 스스로 재검증한다", () => {
    const hookSource = source("src/family/useExpenseEntryGate.ts");
    // 판정은 순수 모듈에 있다(표가 쓸 만한가의 기준이 두 벌이 되지 않게).
    expect(hookSource).toContain("needsHouseholdIdsRepair({ householdRoles, knownHouseholdIds })");
    // 라운드 42 L-1: 래치도 순수 모듈이다(소진 조건이 화면 코드에 흩어지지 않게).
    expect(hookSource).toContain("const householdIdsRepairLatch = createOneShotRevalidationLatch();");
    expect(hookSource).toContain("householdIdsRepairLatch.reset();");
    // 트리거는 렌더가 아니라 이펙트다(조회는 백그라운드라 이번 렌더의 화면은 그대로다).
    expect(hookSource).toContain("useEffect(() => {");
    // 잠금 안내 경로와 같은 함수를 쓴다 -- 재검증이 두 벌로 갈리지 않는다.
    expect(hookSource.match(/revalidateHouseholdRoles\(/g) ?? []).toHaveLength(3);
  });

  /**
   * 라운드 42 L-1 — 래치를 **먼저** 소진하던 배선(K-3의 첫 판)이 되돌아오면 안 된다.
   */
  it("L-1: 자가 치유는 실제 발사 여부를 보고 소진하고, force로 스로틀을 건너뛴다", () => {
    const hookSource = source("src/family/useExpenseEntryGate.ts");
    // 반환값(발사 여부)이 래치의 유일한 소진 조건이다.
    expect(hookSource).toContain(
      "householdIdsRepairLatch.attempt(() => revalidateHouseholdRoles({ force: true }));"
    );
    // 재검증 함수는 발사 여부를 boolean으로 돌려준다(버려지면 L-1이 그대로 되돌아온다).
    expect(hookSource).toContain("export function revalidateHouseholdRoles(options?: { force?: boolean }): boolean {");
    expect(hookSource).toContain("if (!accessToken) return false;");
    expect(hookSource).toContain("return householdRoleRevalidator.request({");
    // 래치를 먼저 세우고 부르던 옛 배선.
    expect(hookSource).not.toContain("attemptedHouseholdIdsRepair = true;");
  });
});

/**
 * 라운드 42 L-1 — 요청이 나가지도 않았는데 소진되던 래치.
 *
 * 시나리오: 초대 수락 직후의 force 재검증이 실패해 `lastRequestedAt`만 세워진 상태에서 홈이
 * 뜬다. 훅은 래치를 먼저 소진한 뒤 재검증을 부르는데, 그 요청은 5분 스로틀에 먹혀 나가지
 * 않는다 -- 래치만 비고 세션 내내 재시도가 없다.
 */
describe("라운드 42 L-1 자가 치유 래치", () => {
  it("발사되면 소진되고, 두 번째 기회에는 부르지도 않는다", () => {
    const latch = createOneShotRevalidationLatch();
    const fire = vi.fn(() => true);

    expect(latch.attempt(fire)).toBe(true);
    expect(latch.isSpent()).toBe(true);
    expect(latch.attempt(fire)).toBe(false);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("스로틀에 먹혀 발사되지 않으면 래치는 열린 채로 남아 다음 기회에 다시 시도한다", () => {
    const latch = createOneShotRevalidationLatch();
    let allowed = false;
    const fire = vi.fn(() => {
      if (!allowed) return false;
      return true;
    });

    expect(latch.attempt(fire)).toBe(false);
    expect(latch.isSpent()).toBe(false);
    expect(latch.attempt(fire)).toBe(false);
    expect(fire).toHaveBeenCalledTimes(2);

    // 스로틀이 풀린 다음 기회에 비로소 소진된다.
    allowed = true;
    expect(latch.attempt(fire)).toBe(true);
    expect(latch.isSpent()).toBe(true);
    expect(latch.attempt(fire)).toBe(false);
    expect(fire).toHaveBeenCalledTimes(3);
  });

  it("세션이 끊기면 다시 열린다(같은 앱 세션의 다른 계정에는 그 계정 몫의 한 번이 필요하다)", () => {
    const latch = createOneShotRevalidationLatch();
    latch.attempt(() => true);
    expect(latch.isSpent()).toBe(true);

    latch.reset();
    expect(latch.isSpent()).toBe(false);
    expect(latch.attempt(() => true)).toBe(true);
  });

  /**
   * 훅 상호작용 그대로: 실제 재검증기(스로틀 포함)에 래치를 물려 본다. 진행 중인 요청 때문에
   * 건너뛴 첫 시도가 래치를 태우지 않고, 그 요청이 끝난 뒤의 다음 기회에 실제로 발사된다.
   */
  it("실제 재검증기와 물렸을 때: 겹침으로 건너뛴 시도는 래치를 태우지 않는다", async () => {
    const revalidator = createHouseholdRoleRevalidator({ minIntervalMs: 0 });
    const latch = createOneShotRevalidationLatch();
    const applyHouseholds = vi.fn();

    // 이미 도는 조회 하나(끝나지 않는다).
    let settle: (households: HouseholdRoleSnapshot[]) => void = () => {};
    const pending = vi.fn(
      () => new Promise<HouseholdRoleSnapshot[]>((resolve) => {
        settle = resolve;
      })
    );
    expect(revalidator.request({ now: NOW, fetchHouseholds: pending, applyHouseholds })).toBe(true);

    // 자가 치유의 첫 기회: force여도 겹쳐 보내지 않으므로 발사되지 않는다 -> 래치는 그대로.
    const repair = fakeMe([{ id: "h-1", role: "co_parent" }]);
    const attemptRepair = () =>
      latch.attempt(() =>
        revalidator.request({ now: NOW, fetchHouseholds: repair, applyHouseholds, force: true })
      );
    expect(attemptRepair()).toBe(false);
    expect(latch.isSpent()).toBe(false);
    expect(repair).not.toHaveBeenCalled();

    // 진행 중이던 조회가 끝나면 다음 기회에 실제로 나간다.
    settle([{ id: "h-1", role: "viewer" }]);
    await vi.waitFor(() => expect(applyHouseholds).toHaveBeenCalledTimes(1));
    expect(attemptRepair()).toBe(true);
    expect(latch.isSpent()).toBe(true);
    await vi.waitFor(() => expect(repair).toHaveBeenCalledTimes(1));
  });

  it("클라이언트는 서버 계약 그대로의 GET /me 하나만 더한다", () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain("export function getMe(token: string) {");
    expect(clientSource).toContain('households: Array<{ id: string; name: string; role: string }>;');
    expect(clientSource).toContain('}>("/me", { token });');
  });
});
