import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("MOB-101 onboarding resume contract", () => {
  describe("routeForOnboardingNextStep", () => {
    it("routes each server nextStep to the right screen, skipping past already-completed steps", async () => {
      const { routeForOnboardingNextStep } = await import("./onboarding/resume");

      // No child created yet -- safe to (re)start at ONB-001 either way.
      expect(routeForOnboardingNextStep("consents")).toBe("/onboarding/child-status");
      expect(routeForOnboardingNextStep("child-profile")).toBe("/onboarding/child-status");

      // A child already exists server-side -- resuming must skip straight past ONB-001/ONB-002
      // instead of re-running child creation (the bug this fixes: re-submitting child-profile
      // after a restart used to create a duplicate child).
      expect(routeForOnboardingNextStep("prepared-items")).toBe("/onboarding/prepared-items");
      expect(routeForOnboardingNextStep("budget")).toBe("/onboarding/budget");
      expect(routeForOnboardingNextStep("home")).toBe("/(tabs)");
    });
  });

  /**
   * 라운드 51 #2 — 이어하기(ONB-006)를 띄울 만한 진행인가.
   *
   * 라운드 99 트랙 F1(H) — ⚠️ 두 시점: 종전에는 갈래가 둘이었다(실세션은 동의만 있어도
   * 이어하기, 데모만 "실제로 남긴 것" 요구 — 그 비대칭의 전제는 "실계정은 로그인 직후 곧장
   * ONB-001로 간다"였다). 로그인 목적지가 실세션도 "/"로 통일되면서 그 전제가 죽었고 —
   * 방금 로그인한 실계정도 동의가 막 기록된 채 곧바로 이 판정에 닿는다 — 기준은 한 벌이
   * 됐다: 사용자가 실제로 남긴 것(아이·준비물 제출)이 있을 때만 이어하기다. 근거 전문은
   * src/onboarding/resume.ts의 머리말에 있다.
   */
  describe("hasResumeWorthyProgress (라운드 51 #2 · 라운드 99 F1에서 기준 한 벌로)", () => {
    const child = {
      id: "11111111-1111-4111-8111-111111111111",
      nickname: "여정이",
      stageMode: "born",
      currentStage: "newborn_0_3",
      stageLabel: "신생아"
    };
    const progress = (summary: {
      consentsAccepted: boolean;
      child?: typeof child | null;
      preparedItemsCount?: number | null;
    }) =>
      ({
        completed: false,
        nextStep: "prepared-items",
        canRestart: false,
        summary: {
          consentsAccepted: summary.consentsAccepted,
          child: summary.child ?? null,
          preparedItemsCount: summary.preparedItemsCount ?? null,
          budget: null
        }
      }) as never;

    it("동의 전에는 이어하기가 없다(그냥 새 계정이다)", async () => {
      const { hasResumeWorthyProgress } = await import("./onboarding/resume");
      expect(hasResumeWorthyProgress(progress({ consentsAccepted: false }))).toBe(false);
    });

    it("동의만으로는 이어하기가 아니다 -- 방금 로그인한 계정이 '하던 곳부터?'를 듣지 않는다", async () => {
      const { hasResumeWorthyProgress } = await import("./onboarding/resume");
      // 라운드 99 트랙 F1(H) — ⚠️ 두 시점: 종전 실세션 갈래는 여기서 true였다("실계정은 로그인
      // 직후 곧장 ONB-001로 간다"는 전제 위에서). 로그인 목적지가 "/"로 통일된 지금, 이 진행도는
      // 방금 가입해 동의를 막 올린 계정과 구별되지 않으므로 이어하기가 아니라 ONB-001이다 —
      // 목적지 자체는 종전과 같다(routeForOnboardingNextStep의 "consents"/"child-profile" 두 줄).
      expect(hasResumeWorthyProgress(progress({ consentsAccepted: true }))).toBe(false);
    });

    it("사용자가 실제로 남긴 것이 있어야 이어하기로 간다 (세션 종류 무관 한 벌)", async () => {
      const { hasResumeWorthyProgress } = await import("./onboarding/resume");
      // 아이를 만들고 나간 상태 -- 여기서 이어하지 않으면 입력한 태명이 사라진다.
      expect(hasResumeWorthyProgress(progress({ consentsAccepted: true, child }))).toBe(true);
      // 준비물 단계까지 제출하고 나간 상태(0개 체크도 제출이다).
      expect(hasResumeWorthyProgress(progress({ consentsAccepted: true, preparedItemsCount: 0 }))).toBe(true);
    });
  });

  describe("onboarding-progress store's child-create idempotency key", () => {
    beforeEach(async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      useOnboardingProgressStore.getState().resetOnboarding();
    });

    // 라운드 99 트랙 F1(M) — ⚠️ 두 시점: 종전 이 셋은 인자 없이 불렀다("키가 있으면 무조건
    // 재사용"). 이제 키는 제출 본문의 지문에 묶인다 — 같은 본문 재시도만 같은 키를 받고,
    // 본문이 달라지면(입력을 고친 재제출) 새 키가 나가 서버 409(IDEMPOTENCY_KEY_CONFLICT)
    // 루프에 갇히지 않는다.
    it("hands out a stable key across retries of the SAME-body child-profile submission", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      const state = useOnboardingProgressStore.getState();

      const first = state.getOrCreateChildCreateIdempotencyKey("hash-a");
      const second = state.getOrCreateChildCreateIdempotencyKey("hash-a");
      expect(first).toBe(second);
      expect(typeof first).toBe("string");
      expect(first.length).toBeGreaterThan(0);
    });

    it("라운드 99 F1(M): 본문이 갈리면 새 키 -- 같은 키 + 다른 본문의 409 루프를 만들지 않는다", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      const state = useOnboardingProgressStore.getState();

      const first = state.getOrCreateChildCreateIdempotencyKey("hash-a");
      const second = state.getOrCreateChildCreateIdempotencyKey("hash-b");
      expect(second).not.toBe(first);
      // 새 본문으로 갈아탄 뒤에는 그 본문의 재시도가 다시 안정적으로 같은 키를 받는다.
      expect(state.getOrCreateChildCreateIdempotencyKey("hash-b")).toBe(second);
      // 지문도 키와 함께 저장돼 있다(둘은 언제나 한 쌍이다).
      expect(useOnboardingProgressStore.getState().childCreateIdempotencyBodyHash).toBe("hash-b");
    });

    it("라운드 99 F1(M): 지문 없는 옛 blob의 키는 재사용하지 않는다 (어느 본문의 키인지 모른다)", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      // 구버전이 남긴 모양: 키만 있고 지문이 없다(마이그레이션 sanitize가 null로 채운다).
      useOnboardingProgressStore.setState({
        childCreateIdempotencyKey: "onb-child-legacy",
        childCreateIdempotencyBodyHash: null
      });
      const key = useOnboardingProgressStore.getState().getOrCreateChildCreateIdempotencyKey("hash-a");
      expect(key).not.toBe("onb-child-legacy");
    });

    it("clears the key on success so a later, genuinely new submission gets a fresh one", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      const state = useOnboardingProgressStore.getState();

      const first = state.getOrCreateChildCreateIdempotencyKey("hash-a");
      state.clearChildCreateIdempotencyKey();
      const second = state.getOrCreateChildCreateIdempotencyKey("hash-a");

      expect(useOnboardingProgressStore.getState().childCreateIdempotencyKey).toBe(second);
      expect(second).not.toBe(first);
    });

    it("clears the key (and its body hash) when onboarding is reset", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      const state = useOnboardingProgressStore.getState();

      state.getOrCreateChildCreateIdempotencyKey("hash-a");
      state.resetOnboarding();

      expect(useOnboardingProgressStore.getState().childCreateIdempotencyKey).toBeNull();
      expect(useOnboardingProgressStore.getState().childCreateIdempotencyBodyHash).toBeNull();
    });
  });

  describe("local-backend onboardingStatus() mirrors the real API's {completed, nextStep, canRestart, summary} contract", () => {
    beforeEach(async () => {
      const localBackend = await import("./api/local-backend");
      localBackend.resetLocalBackendForTests();
      localBackend.seedLocalDemoFixturesForTests();
    });

    it("walks consents -> child-profile -> prepared-items -> completed as each step is submitted", async () => {
      const localBackend = await import("./api/local-backend");

      const beforeConsents = localBackend.onboardingStatus();
      expect(beforeConsents).toMatchObject({ completed: false, nextStep: "consents", canRestart: true });
      expect(beforeConsents.summary.child).toBeNull();

      localBackend.upsertConsents();
      const afterConsents = localBackend.onboardingStatus();
      // ensureSeeded() pre-populates a demo child (and a current-month budget) for the
      // standalone test-mode backend, so once consents are accepted the very next status is
      // already past child-profile, waiting only on the prepared-items step.
      expect(afterConsents.summary.consentsAccepted).toBe(true);
      expect(afterConsents.canRestart).toBe(false);
      expect(afterConsents.summary.child).not.toBeNull();
      expect(afterConsents.nextStep).toBe("prepared-items");

      localBackend.setPreparedItems(afterConsents.summary.child!.id, []);
      const afterPreparedItems = localBackend.onboardingStatus();
      expect(afterPreparedItems.summary.preparedItemsCount).toBe(0);
      // The demo backend's pre-seeded budget means submitting prepared-items (even with zero
      // items checked, same as the real server) is the last gap -- onboarding is now complete.
      expect(afterPreparedItems.completed).toBe(true);
      expect(afterPreparedItems.nextStep).toBe("home");
      expect(afterPreparedItems.summary.budget).not.toBeNull();
    });

    /**
     * 라운드 99 트랙 F1(L) — ⚠️ 두 시점: 종전 미러는 **이번 달** 예산만 봐서, 지난달에 온보딩을
     * 끝낸 데모 사용자가 달이 바뀌는 것만으로 nextStep "budget"으로 되돌아갔다. 실서버는
     * `budget.findFirst({ where: { childId } })` — 아무 달이든 하나 있으면 완료다(이 파일이
     * 약속한 그 미러 계약). 이제 미러도 달 무관이다.
     */
    it("예산이 지난달에만 있어도 완료다 (실서버 findFirst = 아무 달 — 달이 바뀌어도 완료가 풀리지 않는다)", async () => {
      const localBackend = await import("./api/local-backend");
      const { getSeoulMonthRange, getSeoulToday } = await import("@wooriai/domain");

      localBackend.upsertConsents();
      const status = localBackend.onboardingStatus();
      const childId = status.summary.child!.id;
      localBackend.setPreparedItems(childId, []);

      // 시드가 심어 둔 이번 달 예산을 지우고, 지난달 예산 하나만 남긴다(달이 바뀐 상황의 재현).
      const currentMonth = getSeoulMonthRange(getSeoulToday()).yearMonth;
      const [year, month] = currentMonth.split("-").map(Number);
      const previousMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
      localBackend.useLocalBackendStore.setState({ budgets: { [previousMonth]: 300000 } });

      const rolledOver = localBackend.onboardingStatus();
      expect(rolledOver.completed).toBe(true);
      expect(rolledOver.nextStep).toBe("home");
      expect(rolledOver.summary.budget).toEqual({ yearMonth: previousMonth, amountKrw: 300000 });

      // 이번 달 예산이 있으면 종전과 같이 그 달이 요약에 실린다(선호 순서까지 이관).
      localBackend.useLocalBackendStore.setState({ budgets: { [previousMonth]: 300000, [currentMonth]: 500000 } });
      expect(localBackend.onboardingStatus().summary.budget).toEqual({ yearMonth: currentMonth, amountKrw: 500000 });
    });
  });

  /**
   * 라운드 51 #2 — 데모 세션의 **중간 이탈 → 이어하기** 시나리오.
   *
   * 프로덕션 데모 빌드는 데이터 0에서 시작하므로(local-backend ensureSeeded는 아이를 만들지
   * 않는다) 여기서도 시드 픽스처를 심지 않고, 사용자가 실제로 하는 순서 그대로 진행한다:
   * 테스트 로그인이 동의를 기록 → ONB-002에서 태명 입력 → 그대로 앱 종료.
   *
   * 예전에는 이 상태로 앱을 다시 열면 app/index.tsx가 진행도를 아예 묻지 않아
   * `/onboarding/child-status`로 돌아갔고, 거기서 다시 만든 아이가 로컬의 한 자리를 통째로
   * 교체해(createChild) 방금 입력한 태명이 사라졌다. 이제 진행도가 "아이는 있고 준비물
   * 단계가 남았다"고 답하므로 이어하기가 ONB-003으로 건너뛴다 -- 아이를 다시 만들 일이 없고,
   * 태명도 그대로 남는다.
   */
  describe("데모 세션 중간 이탈 → 이어하기 (라운드 51 #2)", () => {
    beforeEach(async () => {
      const localBackend = await import("./api/local-backend");
      // 시드 픽스처 없이 = 실제 데모 빌드와 같은 0에서 시작.
      localBackend.resetLocalBackendForTests();
    });

    it("태명을 입력하고 나간 데모 세션은 준비물 단계부터 이어하고 태명이 남는다", async () => {
      const { LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN, getOnboardingProgress, listChildren, upsertConsents } =
        await import("./api/client");
      const { createOnboardingChild } = await import("./onboarding/child-create");
      const { buildCreateChildBody } = await import("./children/child-form");
      const { hasResumeWorthyProgress } = await import("./onboarding/resume");
      const { routeForOnboardingNextStep } = await import("./onboarding/resume");

      // 1) 테스트 로그인이 동의를 기록한 직후: 아직 남긴 것이 없으므로 이어하기가 아니다.
      await upsertConsents(LOCAL_SESSION_TOKEN);
      const justLoggedIn = await getOnboardingProgress(LOCAL_SESSION_TOKEN);
      expect(justLoggedIn).toMatchObject({ completed: false, nextStep: "child-profile" });
      // 라운드 99 F1(H): 판정이 세션 종류를 가르지 않게 되면서 둘째 인자가 사라졌다(위 describe).
      expect(hasResumeWorthyProgress(justLoggedIn)).toBe(false);

      // 2) ONB-002에서 태명을 입력하고 앱 종료.
      await createOnboardingChild(
        LOCAL_SESSION_TOKEN,
        buildCreateChildBody(LOCAL_HOUSEHOLD_ID, "born", {
          nickname: "이어하기",
          dateText: "2026-03-02",
          manualStage: null
        })
      );

      // 3) 다시 열었을 때: 이어하기 대상이고, 목적지는 ONB-003(준비물)이다.
      const afterRestart = await getOnboardingProgress(LOCAL_SESSION_TOKEN);
      expect(afterRestart.completed).toBe(false);
      expect(afterRestart.nextStep).toBe("prepared-items");
      expect(afterRestart.summary.child).toMatchObject({ nickname: "이어하기" });
      expect(hasResumeWorthyProgress(afterRestart)).toBe(true);
      expect(routeForOnboardingNextStep(afterRestart.nextStep)).toBe("/onboarding/prepared-items");

      // 4) 입력한 아이 정보가 그대로 남아 있다(아이를 다시 만들지 않으므로 교체도 없다).
      const children = (await listChildren(LOCAL_SESSION_TOKEN)).children;
      expect(children).toHaveLength(1);
      expect(children[0]).toMatchObject({ nickname: "이어하기", stageMode: "born", birthDate: "2026-03-02" });
    });
  });

  describe("wired-up source contract (mirrors the existing onboarding-flow.test.ts source-scan convention)", () => {
    it("adds the ONB-006 resume screen and its /onboarding/resume route alias", () => {
      for (const relativePath of ["app/(onboarding)/resume.tsx", "app/onboarding/resume.tsx"]) {
        expect(existsSync(join(mobileRoot, relativePath)), `${relativePath} should exist`).toBe(true);
      }

      const resumeSource = source("app/(onboarding)/resume.tsx");
      expect(resumeSource).toContain("ONB-006");
      expect(resumeSource).toContain('testID="screen-ONB-006"');
      expect(resumeSource).toContain("routeForOnboardingNextStep");
      expect(resumeSource).toContain("canRestart");

      expect(source("app/onboarding/resume.tsx")).toContain("../(onboarding)/resume");
    });

    /**
     * 라운드 99 트랙 F1(L) — ⚠️ 두 시점: 종전 부제는 `지난번에는 "${stepLabel}" 단계까지
     * 진행했어요.`였다. stepLabel은 nextStep — 아직 **가지 않은** 단계라, 그 문장은 안 간
     * 단계를 진행했다고 과장했다(hasResumeWorthyProgress가 게이트를 세울 때 "사실이 아닌
     * 말"이라 적은 바로 그 문형). 이제 과거를 단정하지 않고 갈 곳만 말한다(DNC-018 해요체).
     */
    it("ONB-006 부제는 안 간 단계를 진행했다고 말하지 않는다", () => {
      const resumeSource = source("app/(onboarding)/resume.tsx");
      expect(resumeSource).toContain('subtitle={`이번에는 "${stepLabel}"부터 이어가요.`}');
      // 옛 과장 문형은 코드에서 사라졌다(주석의 이력 인용만 남는다).
      const rendered = resumeSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
      expect(rendered).not.toContain("단계까지 진행했어요");
    });

    it("has app/index.tsx fetch server onboarding progress and route to the resume screen for an interrupted session", () => {
      const indexSource = source("app/index.tsx");

      expect(indexSource).toContain("getOnboardingProgress");
      expect(indexSource).toContain('<Redirect href="/onboarding/resume" />');
      // The already-onboarded fast path (test-login-flow.test.ts pins this exact substring) must
      // survive untouched -- the new server-progress check only runs for sessions that haven't
      // locally reached home yet.
      // 실기기 피드백 1: 데모(테스트) 세션의 예외(`|| isTestSession`)가 빠졌다 -- 테스트 로그인도
      // 이제 아이 정보 입력을 포함한 온보딩을 마쳐야 탭으로 간다.
      expect(indexSource).toContain('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"');
    });

    /**
     * 라운드 51 #2: 데모 세션이 진행도 조회를 타는지 소스에서 고정한다. 화면 자체는 expo-router
     * 없이 렌더할 수 없으므로 이 파일의 기존 관례(소스 스캔)를 따른다.
     */
    it("데모(테스트) 세션도 진행도 조회와 이어하기 판정을 함께 탄다", () => {
      const indexSource = source("app/index.tsx");

      // 데모 토큰으로 조회한다(= client.ts의 로컬 분기 → 요청 0건의 순수 로컬 조회).
      expect(indexSource).toContain("LOCAL_SESSION_TOKEN");
      expect(indexSource).toContain("fetchOnboardingProgressForSelectedChild(progressToken");
      // 이어하기 판정은 공유 순수 모듈이 한다. 라운드 99 F1(H) — ⚠️ 두 시점: 종전 핀은
      // `hasResumeWorthyProgress(progress, isTestSession)`이었다(데모만 엄격한 두 기준).
      // 로그인 목적지 통일로 기준이 한 벌이 되면서 인자도 진행도 하나다.
      expect(indexSource).toContain("hasResumeWorthyProgress(progress)");
      // 조회 자체를 막던 `isTestSession` 게이트가 되살아나면 여기서 잡힌다.
      expect(indexSource).not.toContain("!hydrated || isTestSession");
      // 진행도 조회가 끝나기 전에 온보딩으로 튕기지 않도록 잡아두는 관문도 데모 포함이다.
      expect(indexSource).not.toContain("if (!isTestSession && !hasReachedHome)");
      // MOB-107 복구(로컬 아이 ↔ selectedChildId 정합)는 그대로 남아 있어야 한다.
      expect(indexSource).toContain("localChildId()");
    });

    it("has the (tabs) guard defer to '/' so a mid-onboarding deep link re-resolves through the resume-aware entry point", () => {
      const tabsLayoutSource = source("app/(tabs)/_layout.tsx");
      expect(tabsLayoutSource).toContain('<Redirect href="/" />');
    });

    it("sends a stable Idempotency-Key with child creation so a retried submission cannot duplicate the child", () => {
      const childProfileSource = source("app/(onboarding)/child-profile.tsx");
      expect(childProfileSource).toContain("getOrCreateChildCreateIdempotencyKey");
      expect(childProfileSource).toContain("clearChildCreateIdempotencyKey");

      const clientSource = source("src/api/client.ts");
      expect(clientSource).toContain("idempotencyKey?: string");
      expect(clientSource).toContain('"Idempotency-Key": idempotencyKey');
    });
  });
});
