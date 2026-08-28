import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as localBackend from "./api/local-backend";
import { LOCAL_CHILD_ID, LOCAL_ITEM_CAR_SEAT } from "./api/local-fixtures";
import { useSelectedChildStore } from "./stores/selected-child.store";
import { useSessionStore } from "./stores/session.store";

const mobileRoot = process.cwd();

describe("Android local test login", () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
    localBackend.resetLocalBackendForTests();
    useSelectedChildStore.getState().clearSelectedChildId();
  });

  it("persists an explicit local test session without fake OAuth tokens", () => {
    const state = useSessionStore.getState() as ReturnType<typeof useSessionStore.getState> & {
      startTestSession?: () => void;
    };

    expect(state.startTestSession).toBeTypeOf("function");
    state.startTestSession?.();
    const updated = useSessionStore.getState() as ReturnType<typeof useSessionStore.getState> & {
      isTestSession?: boolean;
    };
    expect(updated).toMatchObject({
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null
    });
    expect(updated.isTestSession).toBe(true);
  });

  /**
   * 실기기 피드백 1의 핵심 계약: 테스트 로그인은 **데이터 0**에서 시작한다.
   *
   * 예전에는 startTestSession()이 데모 아이("다온이", 생후 24개월)·시드 지출 3건·가구 구성원
   * 2명·이번 달 예산을 자동으로 만들고 그 아이를 골라 둔 뒤 홈으로 직행했다. 사용자 요청은
   * 정반대 -- 실계정 신규 가입과 똑같이 빈 상태에서 시작하고 아이 정보는 온보딩에서 직접
   * 입력한다.
   */
  it("starts a local test session with zero user data -- no demo child, expenses, budget or selection", () => {
    useSessionStore.getState().startTestSession();

    expect(localBackend.listChildren().children).toEqual([]);
    expect(localBackend.localChildId()).toBeNull();
    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();

    const backend = localBackend.useLocalBackendStore.getState();
    expect(backend.expenses).toEqual([]);
    expect(backend.budgets).toEqual({});
    expect(backend.itemStatuses).toEqual({});
    expect(backend.importJobs).toEqual([]);
    // 남는 것은 가구 관리자(본인) 한 명뿐 -- 실계정 가입도 그 상태에서 시작한다.
    expect(backend.members.map((member) => member.role)).toEqual(["owner"]);
  });

  /** 앱 콘텐츠(준비템 카탈로그·상품 링크)는 실서버 시드에 해당하므로 0에서도 그대로 있다. */
  it("keeps the catalog content so the 준비템 tab still works on a zero-data session", () => {
    useSessionStore.getState().startTestSession();

    const created = localBackend.createChild({ nickname: "여정이" });
    // 임신 중으로 시작해도 "지금 필요"에 보여 줄 준비물이 있어야 한다(임신~첫돌이 이 앱의 시기다).
    localBackend.updateChild(created.id, { stageMode: "manual", manualStage: "pregnancy_mid" });
    expect(localBackend.listItems(created.id, "now").items.length).toBeGreaterThan(0);
    expect(localBackend.listItems(created.id, "all").items.length).toBeGreaterThan(0);
    // 구매 링크와 고지 문구(앱 콘텐츠)도 그대로 있다 -- 핵심 루프의 마지막 고리다.
    expect(localBackend.getItemDetail(created.id, LOCAL_ITEM_CAR_SEAT).productLinks.length).toBeGreaterThan(0);
  });

  /** 온보딩에서 입력한 아이 정보가 그대로 로컬 백엔드에 남는다(임신 중 포함). */
  it("creates the child from the onboarding input instead of renaming a demo fixture", () => {
    useSessionStore.getState().startTestSession();

    const created = localBackend.createChild({ nickname: "튼튼이" });
    expect(created.id).toBe(LOCAL_CHILD_ID);
    // 단계 입력 전에는 아직 "아이가 있다"고 말하지 않는다 -- 절반짜리 아이를 노출하지 않는다.
    expect(localBackend.listChildren().children).toEqual([]);

    localBackend.updateChild(created.id, { stageMode: "pregnant", dueDate: "2999-01-01" });
    const [child] = localBackend.listChildren().children;
    expect(child).toMatchObject({
      id: LOCAL_CHILD_ID,
      nickname: "튼튼이",
      stageMode: "pregnant",
      dueDate: "2999-01-01",
      birthDate: null
    });
    expect(child.currentStage).toBe("pregnancy_early");
  });

  it("admits a persisted local test session through the root route only after onboarding", () => {
    const rootSource = readFileSync(join(mobileRoot, "app/index.tsx"), "utf8");
    expect(rootSource).toContain("isTestSession");
    // 실기기 피드백 1: 데모 세션 예외(`|| isTestSession`)를 뺐다 -- 테스트 로그인도 아이 정보
    // 입력을 포함한 온보딩을 마쳐야 탭으로 간다.
    expect(rootSource).toContain('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"');
    expect(rootSource).not.toContain('hasReachedHome || isTestSession ? "/(tabs)"');
  });

  it("leaves launch after the persisted test session hydrates asynchronously", () => {
    const launchSource = readFileSync(join(mobileRoot, "app/launch-animation.tsx"), "utf8");
    expect(launchSource).toContain("useSessionStore");
    expect(launchSource).toContain("isTestSession && !isPixelLockMode");
    expect(launchSource).toContain('<Redirect href="/(tabs)" />');
  });

  it("renders a branded accessible consent screen for the test APK", () => {
    const loginSource = readFileSync(join(mobileRoot, "app/(auth)/login.tsx"), "utf8");

    expect(loginSource).toContain('const isTestLoginEnabled = process.env.EXPO_PUBLIC_TEST_LOGIN === "1"');
    expect(loginSource).toContain('testID="screen-AUTH-001"');
    expect(loginSource).toContain("테스트용 APK");
    expect(loginSource).toContain("우리 아이의 기록을 시작해요");
    expect(loginSource).toContain("이용약관 동의");
    expect(loginSource).toContain("개인정보 수집·이용 동의");
    expect(loginSource).toContain('accessibilityRole="checkbox"');
    expect(loginSource).toContain("테스트 계정으로 시작하기");
    expect(loginSource).toContain("startTestSession");
    // 실기기 피드백 1: 예전에는 여기서 markHomeReached()로 온보딩을 통째로 건너뛰었다. 이제
    // 테스트 로그인도 실계정과 같은 여정을 타므로 "/"로 보내고 app/index.tsx가 판정한다.
    expect(loginSource).not.toContain("markHomeReached()");
    expect(loginSource).toContain('router.replace(inviteResumeHref ?? "/");');
    // 데모임을 알리는 최소 표시는 유지한다(DNC: 데모/실계정 구분).
    expect(loginSource).toContain("기록은 이 기기에만 저장되며 실제 카카오 로그인이 아니에요.");
  });

  it("enables local test login in the standalone Android APK profile only", () => {
    const buildSource = readFileSync(join(mobileRoot, "..", "..", "scripts/build-android-apk.ts"), "utf8");
    expect(buildSource).toContain('standalone: "1"');
    expect(buildSource).toContain('production: "0"');
  });
});
