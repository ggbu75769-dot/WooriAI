import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as localBackend from "./api/local-backend";
import {
  loginCtaLabel,
  loginFootnote,
  loginSubtitle,
  STORE_LOGIN_CTA_LABEL,
  STORE_LOGIN_FOOTNOTE,
  STORE_LOGIN_SUBTITLE,
  TEST_LOGIN_CTA_LABEL,
  TEST_LOGIN_FOOTNOTE,
  TEST_LOGIN_SUBTITLE
} from "./auth/login-copy";
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
    // 라운드 65 후속(#6): CTA 라벨은 화면 안 삼항이 아니라 login-copy.ts의 갈래에서 온다.
    expect(loginSource).toContain("loginCtaLabel(isTestLoginEnabled)");
    expect(TEST_LOGIN_CTA_LABEL).toBe("테스트 계정으로 시작하기");
    expect(loginSource).toContain("startTestSession");
    // 실기기 피드백 1: 예전에는 여기서 markHomeReached()로 온보딩을 통째로 건너뛰었다. 이제
    // 테스트 로그인도 실계정과 같은 여정을 타므로 "/"로 보내고 app/index.tsx가 판정한다.
    expect(loginSource).not.toContain("markHomeReached()");
    expect(loginSource).toContain('router.replace(inviteResumeHref ?? "/");');
    // 데모임을 알리는 최소 표시는 유지한다(DNC: 데모/실계정 구분).
    expect(loginSource).toContain("loginFootnote(isTestLoginEnabled)");
    expect(TEST_LOGIN_FOOTNOTE).toBe("기록은 이 기기에만 저장되며 실제 카카오 로그인이 아니에요.");
  });

  it("enables local test login in the standalone Android APK profile only", () => {
    const buildSource = readFileSync(join(mobileRoot, "..", "..", "scripts/build-android-apk.ts"), "utf8");
    expect(buildSource).toContain('standalone: "1"');
    expect(buildSource).toContain('production: "0"');
  });
});

/**
 * 라운드 65 B(#3) — **env 갈래의 문구는 두 갈래가 같은 자리에서 읽혀야 한다.**
 *
 * 로그인 히어로 부제의 두 갈래가 서로 뒤바뀌어 있었다: 테스트 빌드에는 "테스트 계정도 실제
 * 가입과 똑같이 시작해요."가, **실사용자가 받는 빌드**(Play AAB·production APK는
 * `EXPO_PUBLIC_TEST_LOGIN="0"`)에는 "준비된 테스트 계정으로 로그인하고 … 둘러보세요."가 붙어
 * 있었다. 개발 빌드에서는 재현되지 않고 AUTH-001은 픽셀락 대상도 아니라
 * (scripts/pixel-lock/pixel-lock-screens.json) 어떤 자동 경로도 이것을 보지 못했다 -- 그래서
 * 갈래를 값으로 고정한다.
 */
describe("로그인 첫 화면 문구 (AUTH-001 -- 빌드 갈래별 사실)", () => {
  it("스토어/실사용 빌드는 테스트 계정을 말하지 않는다", () => {
    const subtitle = loginSubtitle(false);
    expect(subtitle).toBe(STORE_LOGIN_SUBTITLE);
    for (const forbidden of ["테스트", "둘러보", "준비된"]) {
      expect(subtitle).not.toContain(forbidden);
    }
    // 실제로 일어나는 일만 말한다: 카카오 로그인 -> 온보딩(아이 정보).
    expect(subtitle).toContain("카카오");
    expect(subtitle).toContain("아이 정보");
  });

  it("테스트 빌드는 테스트 계정임을 말하고, 실가입과 같은 여정임을 밝힌다", () => {
    const subtitle = loginSubtitle(true);
    expect(subtitle).toBe(TEST_LOGIN_SUBTITLE);
    expect(subtitle).toContain("테스트 계정");
    expect(subtitle).toContain("실제 가입과 똑같이");
  });

  it("두 갈래가 서로 다른 사실을 말하지 않는다 -- 문구가 뒤바뀔 자리가 없다", () => {
    expect(loginSubtitle(true)).not.toBe(loginSubtitle(false));
    // "테스트"라는 말은 테스트 빌드 갈래에만 있다(그 반대는 곧 이번에 고친 결함이다).
    expect(loginSubtitle(true).includes("테스트")).toBe(true);
    expect(loginSubtitle(false).includes("테스트")).toBe(false);
    // 해요체(DNC-018).
    for (const line of [...loginSubtitle(true).split("\n"), ...loginSubtitle(false).split("\n")]) {
      expect(line.trim().endsWith("요.")).toBe(true);
    }
  });

  it("스토어/실사용 빌드의 CTA·꼬리말도 테스트 계정을 말하지 않는다 (라운드 65 후속 #6)", () => {
    expect(loginCtaLabel(false)).toBe(STORE_LOGIN_CTA_LABEL);
    expect(loginFootnote(false)).toBe(STORE_LOGIN_FOOTNOTE);
    for (const copy of [loginCtaLabel(false), loginFootnote(false)]) {
      for (const forbidden of ["테스트", "데모", "이 기기에만"]) {
        expect(copy).not.toContain(forbidden);
      }
    }
    // 실사용 빌드가 말하는 것은 실제로 일어나는 일뿐이다: 카카오 로그인 · 계정에 남는 필수 동의.
    expect(loginCtaLabel(false)).toContain("카카오");
    expect(loginFootnote(false)).toContain("동의");
  });

  it("테스트 빌드의 CTA·꼬리말은 데모임을 밝힌다 (DNC: 데모/실계정 구분)", () => {
    expect(loginCtaLabel(true)).toBe(TEST_LOGIN_CTA_LABEL);
    expect(loginFootnote(true)).toBe(TEST_LOGIN_FOOTNOTE);
    expect(loginCtaLabel(true)).toContain("테스트 계정");
    expect(loginFootnote(true)).toContain("실제 카카오 로그인이 아니에요");
  });

  it("세 문구의 갈래가 **같은 방향**이다 — 한 벌이 뒤바뀌면 여기서 빨개진다", () => {
    // #3이 고친 결함은 삼항 하나에서 났고, 같은 모양의 삼항이 CTA·꼬리말에도 하나씩 있었다.
    for (const branch of [loginSubtitle, loginCtaLabel, loginFootnote]) {
      expect(branch(true)).not.toBe(branch(false));
    }
    // "테스트"라는 말은 테스트 갈래에만, "카카오로 시작"은 스토어 갈래에만 있다.
    expect(loginCtaLabel(true).includes("테스트")).toBe(true);
    expect(loginCtaLabel(false).includes("테스트")).toBe(false);
    expect(loginFootnote(true).includes("이 기기에만")).toBe(true);
    expect(loginFootnote(false).includes("이 기기에만")).toBe(false);
    // 해요체(DNC-018) — 꼬리말 두 갈래 모두.
    for (const footnote of [loginFootnote(true), loginFootnote(false)]) {
      expect(footnote.trim().endsWith("요.")).toBe(true);
    }
  });

  it("화면은 삼항이 아니라 그 한 함수를 부른다(갈래가 두 벌로 갈리지 않는다)", () => {
    const loginSource = readFileSync(join(mobileRoot, "app/(auth)/login.tsx"), "utf8");
    expect(loginSource).toContain("<Text style={styles.subtitle}>{loginSubtitle(isTestLoginEnabled)}</Text>");
    expect(loginSource).not.toContain("준비된 테스트 계정으로 로그인하고");
    // 테스트 빌드임을 알리는 배지는 그대로 남는다(데모/실계정 구분 -- DNC). 꼬리말은 라운드 65
    // 후속(#6)에서 CTA와 함께 login-copy.ts로 올라갔고, 값은 한 글자도 바뀌지 않았다.
    expect(loginSource).toContain("테스트용 APK");
    expect(loginSource).toContain("<Text style={styles.testNotice}>{loginFootnote(isTestLoginEnabled)}</Text>");
    expect(TEST_LOGIN_FOOTNOTE).toBe("기록은 이 기기에만 저장되며 실제 카카오 로그인이 아니에요.");
  });

  /**
   * 정찰 노트의 곁가지: "env 갈래의 한쪽만 손보면 아무도 모른다." 저장소에서 사용자 문구가
   * env로 갈리는 자리는 지금 이 부제 하나뿐이고(푸시·카카오 갈래는 문구가 아니라 기능 유무를
   * 판정한다), 새로 생기면 여기 계약이 먼저 깨지도록 이 목록을 좁게 유지한다.
   */
  it("EXPO_PUBLIC_TEST_LOGIN은 화면에서 **한 번만** 읽히고, 그 값으로 갈리는 사용자 문구는 login-copy.ts의 세 갈래뿐이다", () => {
    const loginSource = readFileSync(join(mobileRoot, "app/(auth)/login.tsx"), "utf8");
    // ⓐ 플래그를 읽는 자리는 하나다(여러 곳에서 읽으면 그 중 하나만 뒤집혀도 아무도 모른다).
    const flagReads = loginSource.match(/process\.env\.EXPO_PUBLIC_TEST_LOGIN/g) ?? [];
    expect(flagReads).toHaveLength(1);
    // ⓑ 그 값을 쓰는 자리는 배지 조건 하나 + 로그인 분기 하나 + 문구 세 함수뿐이다.
    //    라운드 65 후속(#6): 화면에 남아 있던 CTA·꼬리말 삼항 둘을 login-copy.ts로 올렸다.
    for (const call of ["loginSubtitle(isTestLoginEnabled)", "loginCtaLabel(isTestLoginEnabled)", "loginFootnote(isTestLoginEnabled)"]) {
      expect(loginSource).toContain(call);
    }
    // ⓒ 갈래 문구가 화면 파일에 리터럴로 다시 적히지 않는다(두 벌이 되는 순간이 곧 결함이다).
    for (const copy of [
      TEST_LOGIN_SUBTITLE,
      STORE_LOGIN_SUBTITLE,
      TEST_LOGIN_CTA_LABEL,
      STORE_LOGIN_CTA_LABEL,
      TEST_LOGIN_FOOTNOTE,
      STORE_LOGIN_FOOTNOTE
    ]) {
      expect(loginSource, `${copy} 는 login-copy.ts에만 있어야 한다`).not.toContain(copy);
    }
  });
});
