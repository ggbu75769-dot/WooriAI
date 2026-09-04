/**
 * QA-118: 아이 관리(MOB-118, SET-005) journey -- the child-management flow driven end-to-end
 * through the exact modules the settings "아이 관리" screen (app/settings/children.tsx) calls:
 * the public API-client surface (src/api/client.ts) with LOCAL_SESSION_TOKEN, the shared form
 * module (src/children/child-form.ts), the pure switch planner (src/children/child-switch.ts),
 * the persisted selected-child store, and a real @tanstack/react-query QueryClient for the
 * cache-invalidation side effects. Follows the demo-user-journey.test.ts conventions: one
 * ordered `describe`, each `it` builds on the previous one's state, `beforeAll` wipes the
 * local backend via resetLocalBackendForTests().
 *
 * The screen component itself imports react-native (unparseable under vitest); its wiring to
 * these modules is pinned by the source-contract tests in
 * src/children/manage-children-flow.test.ts. This journey covers the *behavior* of that wiring.
 *
 * Steps that CANNOT be exercised against the local backend are noted inline as SKIPPED-STEP
 * comments:
 *
 *   SKIPPED STEP ("아이 2명 생성", partially) -- the local demo backend keeps exactly ONE child
 *   record: localBackend.createChild() renames the seeded fixture child and always returns
 *   LOCAL_CHILD_ID, and listChildren() therefore never grows past one entry (see
 *   local-backend.ts createChild/toFullChildDto). A real second child only exists server-side.
 *   The journey therefore represents child #2 as the `Child`-shaped row `GET /children` would
 *   return for it -- which is all the switch flow consumes: planChildSwitch() takes
 *   {id, nickname}, the store takes the id, and the QueryClient invalidation is keyed by prefix,
 *   not by backend state.
 *
 *   FIX-118B(F3): that rename-instead-of-create behavior used to be reported to the user as
 *   "추가했어요" -- a false success. app/settings/children.tsx now HIDES 아이 추가 in the demo
 *   session (isDemoSession -> "데모에서는 아이를 추가할 수 없어요" 안내), so step 2 below no
 *   longer walks the demo user through a create; it pins the two halves of that decision instead:
 *   the shared form/body mapping still works (it is what the real server path uses), while the
 *   demo backend demonstrably renames rather than creates. The screen-side gating itself is
 *   pinned by src/children/manage-children-flow.test.ts.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { calculateChildStage, getSeoulToday, isValidCalendarDate } from "@wooriai/domain";
import {
  LOCAL_SESSION_TOKEN,
  createChild,
  getHome,
  listChildren,
  listItems,
  updateChild,
  type Child
} from "../api/client";
import { resetLocalBackendForTests, seedLocalDemoFixturesForTests } from "../api/local-backend";
import {
  LOCAL_CHILD_ID,
  LOCAL_ITEM_BLOCKS,
  LOCAL_ITEM_CARRIER,
  LOCAL_ITEM_DIAPER,
  localItemTemplateFixtures
} from "../api/local-fixtures";
import {
  buildCreateChildBody,
  buildUpdateChildBody,
  isChildFormValid,
  validateChildForm
} from "../children/child-form";
import { CHILD_SCOPED_QUERY_KEY_PREFIXES, planChildSwitch } from "../children/child-switch";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";

const token = LOCAL_SESSION_TOKEN;
const today = getSeoulToday();

/** `years` years before today, clamped to day 28 when the same day does not exist in the
 * target year (today = Feb 29 minus N years). Keeps the journey green on any run date. */
function yearsAgoSeoul(years: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const candidate = `${year - years}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidCalendarDate(candidate) ? candidate : `${year - years}-${String(month).padStart(2, "0")}-28`;
}

/** The second child as the server would list it (see the SKIPPED-STEP header note). */
const SECOND_CHILD = { id: "journey-child-2", nickname: "튼튼이" };

// Mutable journey context shared across the ordered steps (vitest runs the `it`s in file order).
const journey: {
  firstChild: Child | null;
  queryClient: QueryClient;
} = {
  firstChild: null,
  queryClient: new QueryClient()
};

/** Seeds one cached query per child-scoped family for `childId` -- the same key shapes the
 * screens use (["home", childId], ["expenses", childId, ...], ...). */
function seedChildScopedCaches(queryClient: QueryClient, childId: string) {
  for (const prefix of CHILD_SCOPED_QUERY_KEY_PREFIXES) {
    queryClient.setQueryData([...prefix, childId], { seededFor: childId });
  }
}

function invalidatedKeys(queryClient: QueryClient): string[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.isInvalidated)
    .map((query) => query.queryKey.join("/"))
    .sort();
}

describe("QA-118: 아이 관리 journey (create -> switch -> edit/재계산) through the client modules", () => {
  beforeAll(() => {
    resetLocalBackendForTests();
    // 실기기 피드백 1: 테스트 로그인은 이제 데이터 0에서 시작한다. 이 여정은 이미 아이가
    // 있는 세션의 전환·편집을 검증하므로 그 상태를 arrange로 만들어 둔다.
    seedLocalDemoFixturesForTests();
    useSessionStore.getState().clearSession();
    useSelectedChildStore.getState().clearSelectedChildId();
  });

  // -------------------------------------------------------------------------
  // Step 1 -- session + the seeded child list (the screen's ["children"] query)
  // -------------------------------------------------------------------------
  it("step 1: demo session starts with the seeded fixture child selected and listed in full", async () => {
    useSessionStore.getState().startTestSession();
    expect(useSelectedChildStore.getState().selectedChildId).toBe(LOCAL_CHILD_ID);

    // The screen's list query: queryKey ["children"], queryFn listChildren(authToken!).
    const { children } = await listChildren(token);
    expect(children).toHaveLength(1);
    const child = children[0];
    journey.firstChild = child;
    expect(child.id).toBe(LOCAL_CHILD_ID);
    expect(child.nickname).toBe("다온이");
    expect(child.stageMode).toBe("born");
    expect(child.dueDate).toBeNull();
    expect(child.manualStage).toBeNull();
    expect(child.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // currentStage/stageLabel are computed, never stored: they must agree with the domain's
    // stage calculation for the listed birthDate (the same invariant the real API guarantees).
    const calculated = calculateChildStage({ stageMode: "born", birthDate: child.birthDate!, today });
    expect(child.currentStage).toBe(calculated.stageCode);
    expect(child.stageLabel).toBe(calculated.stageLabel);
    // The fixture child is ~24 months old -- squarely a toddler; the edit step below moves it.
    expect(child.currentStage).toBe("toddler_1_3");
  });

  // -------------------------------------------------------------------------
  // Step 2 -- the shared add-form path, and why the demo session must not offer it
  // -------------------------------------------------------------------------
  it("step 2: the add-form path validates and maps the body, but the demo backend replaces instead of adding", async () => {
    // Same validation the screen's add form runs before submitting (unchanged, shared with
    // onboarding -- this half of the path is what the real server session uses).
    const values = { nickname: "첫째 여정이", dateText: yearsAgoSeoul(3), manualStage: null };
    const errors = validateChildForm("born", values);
    expect(isChildFormValid(errors)).toBe(true);

    const body = buildCreateChildBody("local-household-daon", "born", values);
    expect(body).toMatchObject({ nickname: "첫째 여정이", stageMode: "born", birthDate: values.dateText });
    expect(body.dueDate).toBeUndefined();

    // FIX-118B(F3), demonstrated: calling createChild in the demo session does NOT add a child --
    // it returns the same single id and replaces that one profile. Reporting that as "추가했어요"
    // was a false success, which is why the screen hides 아이 추가 in demo mode
    // (app/settings/children.tsx isDemoSession; pinned in manage-children-flow.test.ts). The
    // journey keeps exercising it here only to lock the demo backend's real behavior in place.
    //
    // 실기기 피드백 1: 교체는 단계 입력까지 비운다 -- 그래야 온보딩을 다시 시작한 사용자가
    // 이번엔 다른 시기를 골라도 저장이 막히지 않는다(local-backend.ts createChild 주석).
    const created = await createChild(token, body);
    expect(created.id).toBe(LOCAL_CHILD_ID);
    expect((await listChildren(token)).children).toEqual([]);

    // 온보딩(src/onboarding/child-create.ts)이 하는 것과 같이 단계 입력을 이어 붙이면 다시
    // 한 명이 된다 -- 두 번째 아이는 끝내 생기지 않는다.
    await updateChild(token, created.id, { stageMode: "born", birthDate: values.dateText });
    const { children } = await listChildren(token);
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(LOCAL_CHILD_ID);
    expect(children[0].nickname).toBe("첫째 여정이");
    expect(children[0].birthDate).toBe(values.dateText);
    journey.firstChild = children[0];
  });

  // -------------------------------------------------------------------------
  // Step 3 -- switching children invalidates every child-scoped cache, nothing else
  // -------------------------------------------------------------------------
  it("step 3a: switching to the second child applies the planner's store write + invalidation plan", async () => {
    const queryClient = journey.queryClient;
    // Warm caches for BOTH children plus two child-independent queries the switch must spare.
    seedChildScopedCaches(queryClient, LOCAL_CHILD_ID);
    seedChildScopedCaches(queryClient, SECOND_CHILD.id);
    queryClient.setQueryData(["children"], { children: [journey.firstChild, SECOND_CHILD] });
    queryClient.setQueryData(["household-members"], { members: [] });
    expect(invalidatedKeys(queryClient)).toEqual([]);

    const plan = planChildSwitch(useSelectedChildStore.getState().selectedChildId, SECOND_CHILD);
    expect(plan).not.toBeNull();
    expect(plan!.childId).toBe(SECOND_CHILD.id);
    expect(plan!.announcement).toBe("튼튼이로 전환했어요.");
    expect(plan!.invalidateKeys).toBe(CHILD_SCOPED_QUERY_KEY_PREFIXES);

    // Apply the plan exactly as app/settings/children.tsx does on a row tap.
    useSelectedChildStore.getState().setSelectedChildId(plan!.childId);
    for (const key of plan!.invalidateKeys) {
      await queryClient.invalidateQueries({ queryKey: [...key] });
    }

    expect(useSelectedChildStore.getState().selectedChildId).toBe(SECOND_CHILD.id);
    // Every child-scoped family is stale for BOTH children (prefix matching) ...
    const expected = CHILD_SCOPED_QUERY_KEY_PREFIXES.flatMap((prefix) => [
      [...prefix, LOCAL_CHILD_ID].join("/"),
      [...prefix, SECOND_CHILD.id].join("/")
    ]).sort();
    expect(invalidatedKeys(queryClient)).toEqual(expected);
    // ... while the child-independent queries stay warm.
    expect(queryClient.getQueryState(["children"])!.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(["household-members"])!.isInvalidated).toBe(false);
  });

  it("step 3b: re-tapping the already selected child is a no-op (warm caches survive)", async () => {
    expect(planChildSwitch(useSelectedChildStore.getState().selectedChildId, SECOND_CHILD)).toBeNull();

    // Switch back to child #1 for the edit step -- a fresh plan with the mirrored announcement.
    const backPlan = planChildSwitch(SECOND_CHILD.id, { id: LOCAL_CHILD_ID, nickname: "첫째 여정이" });
    expect(backPlan!.announcement).toBe("첫째 여정이로 전환했어요.");
    useSelectedChildStore.getState().setSelectedChildId(backPlan!.childId);
    expect(useSelectedChildStore.getState().selectedChildId).toBe(LOCAL_CHILD_ID);
  });

  // -------------------------------------------------------------------------
  // Step 4 -- editing the birth date recomputes the stage everywhere
  // -------------------------------------------------------------------------
  it("step 4a: the edit-form path (validate -> buildUpdateChildBody -> updateChild) moves the stage", async () => {
    const before = journey.firstChild!;

    // Edit form: new nickname + a birth date 5 years back (toddler_1_3 -> kid_4_7). The edit
    // form requires the date (requireDate mirrors the server's normalizeChildInput contract).
    const values = { nickname: "다섯살 여정이", dateText: yearsAgoSeoul(5), manualStage: null };
    expect(isChildFormValid(validateChildForm("born", values, { requireDate: true }))).toBe(true);

    const body = buildUpdateChildBody(before.stageMode, values);
    // born-mode edits send exactly nickname + birthDate (never dueDate/manualStage).
    expect(body).toEqual({ nickname: "다섯살 여정이", birthDate: values.dateText });

    const updated = await updateChild(token, before.id, body);
    expect(updated.id).toBe(before.id);
    expect(updated.nickname).toBe("다섯살 여정이");
    expect(updated.birthDate).toBe(values.dateText);
    // Stage recomputation: changed from the pre-edit stage and equal to the domain's answer.
    expect(updated.currentStage).not.toBe(before.currentStage);
    expect(updated.currentStage).toBe("kid_4_7");
    const calculated = calculateChildStage({ stageMode: "born", birthDate: values.dateText, today });
    expect(updated.currentStage).toBe(calculated.stageCode);
    expect(updated.stageLabel).toBe(calculated.stageLabel);
    journey.firstChild = updated;

    // The edit persists into subsequent reads of the list AND the Home header.
    const { children } = await listChildren(token);
    expect(children[0]).toMatchObject({
      nickname: "다섯살 여정이",
      birthDate: values.dateText,
      currentStage: "kid_4_7",
      stageLabel: calculated.stageLabel
    });
    const home = await getHome(token, LOCAL_CHILD_ID);
    expect(home.child.currentStage).toBe("kid_4_7");
    expect(home.child.stageLabel).toBe(calculated.stageLabel);
  });

  it("step 4b: the recomputed stage repartitions the 준비템 now/soon tabs", async () => {
    // Pre-edit (toddler_1_3): diaper+carrier were "now", blocks (kid_4_7) was "soon".
    // Post-edit (kid_4_7) the partition flips -- the exact loop the invalidation exists for.
    const nowIds = (await listItems(token, LOCAL_CHILD_ID, "now")).items.map((item) => item.id);
    const soonIds = (await listItems(token, LOCAL_CHILD_ID, "soon")).items.map((item) => item.id);
    expect(nowIds).toEqual([LOCAL_ITEM_BLOCKS]);
    // 나머지는 전부 "곧 필요"로 넘어간다 -- 카탈로그가 늘어도(실기기 피드백 1의 임신~첫돌
    // 준비템 추가) 뜻이 바뀌지 않도록 픽스처에서 기대값을 만든다.
    expect(soonIds.sort()).toEqual(
      localItemTemplateFixtures
        .filter((fixture) => !fixture.stageCodes.includes("kid_4_7"))
        .map((fixture) => fixture.id)
        .sort()
    );
    expect(soonIds).toEqual(expect.arrayContaining([LOCAL_ITEM_CARRIER, LOCAL_ITEM_DIAPER]));

    // Cross-check against the fixtures' stageCodes so a fixture change fails loudly here.
    for (const fixture of localItemTemplateFixtures) {
      const expectNow = fixture.stageCodes.includes("kid_4_7");
      expect(nowIds.includes(fixture.id)).toBe(expectNow);
      expect(soonIds.includes(fixture.id)).toBe(!expectNow);
    }
  });

  it("step 4c: after an edit the screen invalidates ['children'] plus every child-scoped cache", async () => {
    const queryClient = journey.queryClient;
    // Re-warm the caches invalidated in step 3a so this step observes fresh transitions.
    seedChildScopedCaches(queryClient, LOCAL_CHILD_ID);
    queryClient.setQueryData(["children"], { children: [journey.firstChild] });
    expect(queryClient.getQueryState(["children"])!.isInvalidated).toBe(false);

    // Mirror of the screen's shared onEditOrAddSettled handler: children list first, then the
    // child-scoped prefixes (a date edit moves the server-computed stage -> 준비템/리포트).
    await queryClient.invalidateQueries({ queryKey: ["children"] });
    await Promise.all(
      CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
    );

    expect(queryClient.getQueryState(["children"])!.isInvalidated).toBe(true);
    for (const prefix of CHILD_SCOPED_QUERY_KEY_PREFIXES) {
      expect(queryClient.getQueryState([...prefix, LOCAL_CHILD_ID])!.isInvalidated).toBe(true);
    }
    // The unrelated household query still survives even the edit-path invalidation.
    expect(queryClient.getQueryState(["household-members"])!.isInvalidated).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Step 5 -- guard rails: invalid edits change nothing
  // -------------------------------------------------------------------------
  it("step 5: future birth dates and unknown children are rejected without side effects", async () => {
    const snapshotBefore = (await listChildren(token)).children[0];

    // The shared form blocks a future birth date before any request is made ...
    const futureDate = `${Number(today.slice(0, 4)) + 1}-01-01`;
    const formErrors = validateChildForm("born", { nickname: "x", dateText: futureDate, manualStage: null });
    expect(formErrors.dateError).toBe("출생일은 오늘보다 미래일 수 없어요.");
    // ... and the backend enforces the same rule with the same message (defense in depth).
    await expect(updateChild(token, LOCAL_CHILD_ID, { birthDate: futureDate })).rejects.toThrow(
      "출생일은 오늘보다 미래일 수 없어요."
    );
    await expect(updateChild(token, "no-such-child", { nickname: "유령" })).rejects.toThrow(
      "아이 프로필을 찾을 수 없어요."
    );

    // Neither failed call changed the stored child.
    expect((await listChildren(token)).children[0]).toEqual(snapshotBefore);
    expect(useSelectedChildStore.getState().selectedChildId).toBe(LOCAL_CHILD_ID);
  });
});
