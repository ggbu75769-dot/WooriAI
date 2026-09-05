import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * MOB-118 아이 관리 (SET-005) source contract -- follows the settings-flow.test.ts /
 * a11y-contract.test.ts source-grep convention (screens import react-native transitively, which
 * vitest cannot parse, so screen wiring is asserted on raw source; API/client behavior is
 * asserted on real imports).
 */
describe("MOB-118 children API client contract", () => {
  it("exposes listChildren and updateChild alongside createChild", async () => {
    const client = await import("../api/client");
    expect(client.listChildren).toEqual(expect.any(Function));
    expect(client.updateChild).toEqual(expect.any(Function));
    expect(client.createChild).toEqual(expect.any(Function));
  });

  it("mirrors the server contract: GET /children list and PATCH /children/:childId", () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain('requestJson<{ children: Child[] }>("/children", { token })');
    expect(clientSource).toContain("requestJson<Child>(`/children/${childId}`, { method: \"PATCH\", token, body })");
    // CHILD-127: UpdateChildBody mirrors UpdateChildDto -- stageMode is now sendable but only
    // as the one-way pregnant -> born transition (server rejects everything else). The type must
    // carry it, and the comment must pin the transition-only contract.
    const bodyBlock = clientSource.slice(
      clientSource.indexOf("export type UpdateChildBody"),
      clientSource.indexOf("export function updateChild")
    );
    expect(bodyBlock).toContain("stageMode?: ChildStageMode");
    expect(clientSource).toContain("pregnant → born 단방향 전환 전용");
  });

  it("routes local test sessions to the local backend mirrors", async () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain("local(() => localBackend.listChildren())");
    expect(clientSource).toContain("local(() => localBackend.updateChild(childId, body))");

    const localBackend = await import("../api/local-backend");
    expect(localBackend.listChildren).toEqual(expect.any(Function));
    expect(localBackend.updateChild).toEqual(expect.any(Function));
  });
});

describe("MOB-118 아이 관리 screen contract (app/settings/children.tsx)", () => {
  const screenPath = "app/settings/children.tsx";

  it("exists as a settings-stack route (DNC-003: no new tab) with the SET-005 testID", () => {
    expect(existsSync(join(mobileRoot, screenPath))).toBe(true);
    const screenSource = source(screenPath);
    expect(screenSource).toContain('testID="screen-SET-005"');
    // Not a tab: the (tabs) layout is untouched by this feature (asserted by path alone here;
    // settings-flow.test.ts already pins the fixed tab structure).
  });

  it("is reachable from the settings index", () => {
    const settingsIndexSource = source("app/settings/index.tsx");
    expect(settingsIndexSource).toContain('router.push("/settings/children")');
    expect(settingsIndexSource).toContain("아이 관리");
  });

  it("lists children, marks the current selection, and switches via the shared applyChildSwitch path", () => {
    const screenSource = source(screenPath);
    expect(screenSource).toContain('queryKey: ["children"]');
    expect(screenSource).toContain("listChildren(authToken!)");
    // HOME-138: 스토어 쓰기 + 아이 스코프 무효화 + 안내는 src/children/child-switch.ts의
    // applyChildSwitch 한 곳에만 있다(홈 헤더 1탭 전환과 같은 경로). 화면이 그 세 줄을 다시
    // 손으로 적으면 한쪽이 무효화를 빠뜨렸을 때 A→B 캐시 오염이 되살아난다.
    expect(screenSource).toContain("applyChildSwitch(selectedChildId, child, {");
    expect(screenSource).not.toContain("planChildSwitch(");
    expect(screenSource).toContain("setSelectedChildId,");
    expect(screenSource).toContain("queryClient.invalidateQueries");
    expect(screenSource).toContain('<StatusBadge label="현재 선택" tone="success" />');
  });

  it("edits through the shared onboarding validation and invalidates child-scoped caches", () => {
    const screenSource = source(screenPath);
    expect(screenSource).toContain('from "../../src/children/child-form"');
    expect(screenSource).toContain("validateChildForm");
    expect(screenSource).toContain("buildUpdateChildBody(input.child.stageMode, input.values)");
    expect(screenSource).toContain("CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => queryClient.invalidateQueries");
    expect(screenSource).toContain('queryClient.invalidateQueries({ queryKey: ["children"] })');
  });

  it("adds a child with the same field mapping as onboarding and selects it", () => {
    const screenSource = source(screenPath);
    // 라운드 99 F1(M): 본문을 변수로 받아 멱등키 지문과 요청이 같은 한 값을 쓴다(핀만 그 모양으로 이관).
    expect(screenSource).toContain("const body = buildCreateChildBody(householdId!, input.stageMode, input.values);");
    expect(screenSource).toContain("setSelectedChildId(created.id)");
    expect(screenSource).toContain("CHILD_STAGE_MODE_OPTIONS.map");
  });

  // FIX-118B(F2): the settings add-form had no Idempotency-Key, so a lost response could be
  // retried into a SECOND child. Same protection as onboarding (ONB-002/MOB-101), settings-scoped
  // key: one per input session, rotated on success.
  it("sends an Idempotency-Key with 아이 추가 (one key per input session, rotated on success)", () => {
    const screenSource = source(screenPath);
    expect(screenSource).toContain('from "../../src/children/child-create-idempotency"');
    // 라운드 99 트랙 F1(M) — ⚠️ 두 시점: 종전 핀은 `getOrCreateChildCreateKey(addIdempotencyKeyRef)`
    // (홀더만, 본문 무관)였다. 키가 본문 지문에 묶이면서 호출이 지문을 함께 넘긴다 — 입력을
    // 고친 재제출이 옛 키를 재사용해 409(IDEMPOTENCY_KEY_CONFLICT) 루프에 갇히지 않는다.
    expect(screenSource).toContain(
      "getOrCreateChildCreateKey(addIdempotencyKeyRef, childCreateBodyFingerprint(body))"
    );
    // Rotated when a new input session opens AND after a successful creation.
    const startAddBlock = screenSource.slice(screenSource.indexOf("const startAdd = () => {"));
    expect(startAddBlock.slice(0, 400)).toContain("rotateChildCreateKey(addIdempotencyKeyRef)");
    // 라운드 99 F1(M): 지문 주석·본문 변수화로 뮤테이션 머리가 길어져 창을 900 → 1600으로 넓혔다
    // (무는 사실은 그대로다 — 성공 onSuccess 초입에서 회전한다).
    const onSuccessBlock = screenSource.slice(screenSource.indexOf("const addChild = useMutation("));
    expect(onSuccessBlock.slice(0, 1600)).toContain("rotateChildCreateKey(addIdempotencyKeyRef)");
    // The key must actually reach the request as a header (client.ts third argument).
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain('headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined');
  });

  // FIX-118B(F3): the demo backend's createChild only RENAMES the single fixture child, so the
  // old flow showed "추가했어요" for something that never happened. 데모에서는 추가 버튼을 숨긴다.
  it("hides 아이 추가 in the demo (local) session and explains why instead of faking success", () => {
    const screenSource = source(screenPath);
    expect(screenSource).toContain("const isDemoSession = authToken === LOCAL_SESSION_TOKEN");
    expect(screenSource).toContain("데모에서는 아이를 추가할 수 없어요.");
    // Both the button and the form are gated, and submitAdd refuses as a last line of defense.
    expect(screenSource).toContain("canAddChild && !isDemoSession && !addOpen");
    expect(screenSource).toContain("canAddChild && !isDemoSession && addOpen");
    expect(screenSource).toContain("|| isDemoSession) return;");
    // 편집(개명)은 데모에서도 실제로 동작하므로 계속 열어 둔다.
    expect(screenSource).toContain("{canEditChildren ? (");
  });

  it("gates edit/add controls to owner and co_parent (view-only roles see no edit controls)", () => {
    const screenSource = source(screenPath);
    expect(screenSource).toContain('const canEditChildren = myRole === "owner" || myRole === "co_parent"');
    expect(screenSource).toContain("{canEditChildren ? (");
    expect(screenSource).toContain("canAddChild && !isDemoSession && !addOpen");
    expect(screenSource).toContain("보기 전용 멤버는 아이 정보를 수정할 수 없어요.");
  });

  /**
   * 라운드 63 리뷰 #1 — **전환 파라미터가 목록의 게이트를 지배하지 않는다.**
   *
   * 라운드 63 #7이 가구 파라미터를 받으면서 역할 조회를 그 가구 하나로 일원화했는데, 목록은
   * 파라미터 가구의 아이가 아니라 이 계정이 아는 **전 가구의 아이**다. 그래서 빈 가구 B의
   * owner가 B로 전환해 들어오면 시가 가구 A(viewer)의 아이 행에 [편집]이 서서 누르면 403을
   * 만나고(라운드 40이 없앤 보기 전용 허위 표시), 역방향에서는 자기 아이의 편집이 사라졌다.
   *
   * 계약: 목록의 세 게이트(편집 · 출생 전환 · 보기 전용 안내)는 `scopedHouseholdId`의 역할을,
   * 추가 폼 쪽은 대상 가구(`householdId`)의 역할을 본다.
   */
  it("전환 파라미터는 추가 폼에만 적용되고 목록의 편집·출생 전환·보기 전용 안내는 아이의 가구를 따른다", () => {
    const screenSource = source(screenPath);
    // 목록 쪽 판정의 근거는 파라미터가 아니라 선택된 아이의 가구다.
    expect(screenSource).toContain('queryKey: ["household-members", scopedHouseholdId]');
    expect(screenSource).toContain("listHouseholdMembers(authToken!, scopedHouseholdId!)");
    expect(screenSource).toContain(
      'const myRole = scopedMembers.data?.members.find((member) => member.userId === userId)?.role;'
    );
    expect(screenSource).toContain('const canEditChildren = myRole === "owner" || myRole === "co_parent"');
    // 추가 쪽 판정의 근거는 생성이 실제로 가는 그 가구다.
    expect(screenSource).toContain('queryKey: ["household-members", householdId]');
    expect(screenSource).toContain('const canAddChild = myAddRole === "owner" || myAddRole === "co_parent"');
    // 목록의 세 게이트가 전부 canEditChildren이고, 추가 게이트는 하나도 섞이지 않는다.
    expect(screenSource).toContain("{canEditChildren ? (");
    expect(screenSource).toContain('canEditChildren && canTransitionStageMode(child.stageMode, "born")');
    expect(screenSource).toContain("canEditChildren && bornChildId === child.id");
    expect(screenSource).toContain("hasSession && !canEditChildren && scopedMembers.isSuccess");
    expect(screenSource).not.toContain("canEditChildren && !isDemoSession");
    // 추가 게이트 셋은 전부 canAddChild다(버튼 · 폼 · 데모 안내).
    expect(screenSource).toContain("hasSession && canAddChild && isDemoSession");
    expect(screenSource).toContain("canAddChild && !isDemoSession && !addOpen");
    expect(screenSource).toContain("canAddChild && !isDemoSession && addOpen");
    expect(screenSource).not.toContain("canAddChild && canTransitionStageMode");
  });

  it("follows the A11Y-101/A11Y-115 conventions (labels, roles, state, hitSlop, announce)", () => {
    const screenSource = source(screenPath);
    expect(screenSource).toContain('accessibilityLabel="태명 또는 별명 입력"');
    expect(screenSource).toContain("accessibilityLabel={`${dateLabel} 입력`}");
    expect(screenSource).toContain('returnKeyType="done"');
    expect(screenSource).toContain("accessibilityLabel={`${child.nickname} 정보 편집`}");
    expect(screenSource).toContain("accessibilityState={{ selected }}");
    expect(screenSource).toContain("hitSlop={8}");
    // HOME-138: 전환 안내(announceForA11y(plan.announcement))는 applyChildSwitch 안으로
    // 옮겼다 -- 화면은 announce 콜백으로 같은 함수를 넘긴다(src/children/child-switch.test.ts가
    // 안내가 실제로 불리는지까지 검증한다).
    expect(screenSource).toContain("announce: announceForA11y");
    // No internal screen IDs in labels (a11y-contract sweep covers this globally too).
    expect(screenSource).not.toMatch(/accessibilityLabel=\{?\s*["'`](?:pixel-)?screen-/);
  });

  it("reuses the shared form module from the onboarding screen (single source of validation)", () => {
    const onboardingSource = source("app/(onboarding)/child-profile.tsx");
    expect(onboardingSource).toContain('from "../../src/children/child-form"');
    expect(onboardingSource).not.toContain("function computeDateError");
  });
});

// FIX-118B(F2): the settings-scoped key holder itself (pure module, no react-native).
// 라운드 99 트랙 F1(M) — ⚠️ 두 시점: 종전 홀더는 키 문자열 하나였고 호출도 홀더 하나였다
// ("같은 입력 세션 = 같은 키"). 키가 제출 본문 지문에 묶이면서 아래 케이스들이 그 새 사실을
// 문다 — 같은 본문 재시도만 같은 키, 본문이 갈리면 새 키(409 IDEMPOTENCY_KEY_CONFLICT 루프 차단).
describe("FIX-118B 설정 아이 추가 Idempotency-Key holder", () => {
  it("reuses one key across retries of the same-body submission and rotates after success", async () => {
    const { getOrCreateChildCreateKey, rotateChildCreateKey } = await import("./child-create-idempotency");
    const holder = { current: null as { key: string; bodyFingerprint: string } | null };

    const first = getOrCreateChildCreateKey(holder, "fp-a");
    expect(first).toMatch(/^set-child-/);
    // A retry of the SAME submission must reuse it -- that is what makes the POST idempotent.
    expect(getOrCreateChildCreateKey(holder, "fp-a")).toBe(first);
    expect(holder.current?.key).toBe(first);

    // 성공 시 회전: the next 아이 추가 is a new creation, not a replay of the previous one.
    rotateChildCreateKey(holder);
    expect(holder.current).toBeNull();
    const second = getOrCreateChildCreateKey(holder, "fp-a");
    expect(second).not.toBe(first);
    expect(second).toMatch(/^set-child-/);
  });

  it("라운드 99 F1(M): 본문이 갈리면 새 키 -- 같은 키 + 다른 본문의 409 루프를 만들지 않는다", async () => {
    const { getOrCreateChildCreateKey } = await import("./child-create-idempotency");
    const holder = { current: null as { key: string; bodyFingerprint: string } | null };

    const first = getOrCreateChildCreateKey(holder, "fp-a");
    // 응답을 잃은 사용자가 입력을 고쳐 재제출 → 재시도가 아니라 새 제출이라 새 키.
    const second = getOrCreateChildCreateKey(holder, "fp-b");
    expect(second).not.toBe(first);
    // 새 본문의 재시도는 다시 안정적으로 같은 키를 받는다.
    expect(getOrCreateChildCreateKey(holder, "fp-b")).toBe(second);
  });

  it("라운드 99 F1(M): childCreateBodyFingerprint는 정규화 지문이다 (필드 순서·undefined 부재 무관, 값이 다르면 다르다)", async () => {
    const { childCreateBodyFingerprint } = await import("./child-create-idempotency");
    const base = { householdId: "hh-1", nickname: "튼튼이", stageMode: "born", birthDate: "2026-03-02", dueDate: undefined };

    // 같은 본문 = 같은 지문(키 순서·undefined 필드의 유무는 본문의 차이가 아니다).
    expect(childCreateBodyFingerprint(base)).toBe(
      childCreateBodyFingerprint({ nickname: "튼튼이", birthDate: "2026-03-02", stageMode: "born", householdId: "hh-1" })
    );
    // 값이 하나라도 다르면 다른 지문 — 이 차이가 곧 "새 키를 발급하라"는 신호다.
    expect(childCreateBodyFingerprint(base)).not.toBe(
      childCreateBodyFingerprint({ ...base, nickname: "씩씩이" })
    );
    expect(childCreateBodyFingerprint(base)).not.toBe(
      childCreateBodyFingerprint({ ...base, birthDate: "2026-03-03" })
    );
  });

  it("does not collide with onboarding's key namespace (set-child- vs onb-child-)", async () => {
    const { generateChildCreateIdempotencyKey } = await import("./child-create-idempotency");
    const keys = new Set(Array.from({ length: 50 }, () => generateChildCreateIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key.startsWith("set-child-")).toBe(true);
      expect(key.startsWith("onb-child-")).toBe(false);
    }
  });
});

describe("MOB-118 local backend child mirrors", () => {
  it("lists the seeded demo child with the full Child shape", async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
    const { children } = localBackend.listChildren();
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      nickname: "다온이",
      stageMode: "born",
      dueDate: null,
      manualStage: null
    });
    expect(children[0].birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(children[0].stageLabel).toBeTruthy();
  });

  it("updates nickname and birth date and recomputes the stage fields", async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
    const { children } = localBackend.listChildren();
    const child = children[0];
    const updated = localBackend.updateChild(child.id, { nickname: "새이름", birthDate: "2020-01-01" });
    expect(updated.nickname).toBe("새이름");
    expect(updated.birthDate).toBe("2020-01-01");
    expect(updated.currentStage).not.toBe(child.currentStage);
    // The change persists into subsequent reads.
    expect(localBackend.listChildren().children[0].nickname).toBe("새이름");
  });

  it("rejects a future birth date and an unknown child id", async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
    const { children } = localBackend.listChildren();
    expect(() => localBackend.updateChild(children[0].id, { birthDate: "2999-01-01" })).toThrow(
      "출생일은 오늘보다 미래일 수 없어요."
    );
    expect(() => localBackend.updateChild("no-such-child", { nickname: "x" })).toThrow("아이 프로필을 찾을 수 없어요.");
  });
});
