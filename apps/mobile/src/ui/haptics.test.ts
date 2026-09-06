import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHapticsStore, sanitizeHapticsEnabled } from "../stores/haptics.store";
import {
  hapticSelection,
  hapticSuccess,
  hapticWarning,
  tryLoadExpoHaptics,
  type ExpoHapticsModule,
  type VibrationFallbackModule
} from "./haptics";

/**
 * 라운드 101 트랙 B — 햅틱(터치 반응) 스캐폴드 계약.
 *
 * 고정하는 사실 네 가지:
 *  1. no-op 안전성 — expo-haptics 미설치(이 워크스페이스의 실제 상태)·사용자 끔에서 세 함수는
 *     아무것도 하지 않고 절대 던지지 않는다. 끔이면 모듈 로드조차 없다(푸시 flag-off와 같은 규율).
 *  2. 폴백 비대칭 — 성공/선택은 폴백이 **없고**(진동이 과하다), 경고만 Android 한정 짧은 1회
 *     Vibration 폴백을 탄다(근거는 src/ui/haptics.ts 머리말).
 *  3. persist 규약 — 스토어가 저장소의 다른 스토어와 같은 한 벌(name·version·방어적 migrate/merge),
 *     기본 켬, 명시적 false만 끔으로 살린다.
 *  4. 채택 지점 — 세 호출이 전부 핸들러/콜백 안이다(EXP-001/ITEM-001 비세션 렌더 무접촉).
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

function fakeHaptics(overrides: Partial<ExpoHapticsModule> = {}): ExpoHapticsModule {
  return {
    selectionAsync: vi.fn(async () => undefined),
    notificationAsync: vi.fn(async () => undefined),
    NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
    ...overrides
  } as ExpoHapticsModule;
}

function fakeFallback(platformOs: string): VibrationFallbackModule & { vibrate: ReturnType<typeof vi.fn> } {
  return { platformOs, vibrate: vi.fn() };
}

beforeEach(() => {
  useHapticsStore.getState().setHapticsEnabled(true);
});

describe("라운드 101 트랙 B 햅틱 no-op 안전성 (미설치 · 꺼짐)", () => {
  it("expo-haptics는 이 워크스페이스에 정말로 없고, 그 상태에서 세 함수는 던지지 않는다", () => {
    // The real loader: the dependency is genuinely absent, so the dynamic require inside
    // try/catch must swallow the resolution failure (push-token-source와 같은 계약).
    expect(tryLoadExpoHaptics()).toBeNull();
    expect(() => hapticSuccess()).not.toThrow();
    expect(() => hapticSelection()).not.toThrow();
    // 경고의 기본 폴백 경로(react-native 동적 require)까지 포함해 던지지 않는다.
    expect(() => hapticWarning()).not.toThrow();
  });

  it("사용자가 끄면 모듈 로드조차 하지 않는다 — 폴백 포함 전부 no-op", () => {
    useHapticsStore.getState().setHapticsEnabled(false);
    const loadModule = vi.fn(() => fakeHaptics());
    const fallback = fakeFallback("android");
    hapticSuccess({ loadModule });
    hapticSelection({ loadModule });
    hapticWarning({ loadModule, loadFallback: () => fallback });
    expect(loadModule).not.toHaveBeenCalled();
    expect(fallback.vibrate).not.toHaveBeenCalled();
  });

  it("성공/선택은 미설치 시 폴백 없이 no-op이다 — Vibration은 이 두 신호에 과하다", () => {
    const fallback = fakeFallback("android");
    // loadFallback 시임을 넘겨도 성공/선택 표면에는 그 인자가 닿는 자리 자체가 없다.
    hapticSuccess({ loadModule: () => null, loadFallback: () => fallback });
    hapticSelection({ loadModule: () => null, loadFallback: () => fallback });
    expect(fallback.vibrate).not.toHaveBeenCalled();
  });

  it("네이티브 거절·동기 throw를 삼킨다(햅틱 실패가 저장 흐름을 깨지 않는다)", async () => {
    const rejecting = fakeHaptics({
      notificationAsync: vi.fn(async () => {
        throw new Error("native boom");
      }),
      selectionAsync: vi.fn(() => {
        throw new Error("sync boom");
      }) as unknown as ExpoHapticsModule["selectionAsync"]
    });
    expect(() => hapticSuccess({ loadModule: () => rejecting })).not.toThrow();
    expect(() => hapticSelection({ loadModule: () => rejecting })).not.toThrow();
    expect(() => hapticWarning({ loadModule: () => rejecting })).not.toThrow();
    // 처리되지 않은 거절이 남지 않도록 마이크로태스크를 한 번 비운다.
    await Promise.resolve();
  });
});

describe("라운드 101 트랙 B 햅틱 발화 (설치·켬)", () => {
  it("성공은 Success, 경고는 Warning notification을, 선택은 selectionAsync를 부른다", () => {
    const haptics = fakeHaptics();
    hapticSuccess({ loadModule: () => haptics });
    expect(haptics.notificationAsync).toHaveBeenCalledWith(haptics.NotificationFeedbackType.Success);
    hapticWarning({ loadModule: () => haptics });
    expect(haptics.notificationAsync).toHaveBeenCalledWith(haptics.NotificationFeedbackType.Warning);
    hapticSelection({ loadModule: () => haptics });
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("경고: 모듈이 있으면 폴백은 부르지 않는다", () => {
    const haptics = fakeHaptics();
    const fallback = fakeFallback("android");
    hapticWarning({ loadModule: () => haptics, loadFallback: () => fallback });
    expect(haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(fallback.vibrate).not.toHaveBeenCalled();
  });

  it("경고 폴백은 Android 한정 짧은 1회다 — iOS·모듈 부재 폴백에서는 진동이 없다", () => {
    const android = fakeFallback("android");
    hapticWarning({ loadModule: () => null, loadFallback: () => android });
    expect(android.vibrate).toHaveBeenCalledTimes(1);
    expect(android.vibrate).toHaveBeenCalledWith(80);

    const ios = fakeFallback("ios");
    hapticWarning({ loadModule: () => null, loadFallback: () => ios });
    expect(ios.vibrate).not.toHaveBeenCalled();

    expect(() => hapticWarning({ loadModule: () => null, loadFallback: () => null })).not.toThrow();
  });
});

describe("라운드 101 트랙 B haptics.store persist 규약", () => {
  it("기본값은 켬이고, 명시적 false만 끔으로 살린다(모르는/손상 blob은 기본 켬)", () => {
    expect(useHapticsStore.getInitialState().hapticsEnabled).toBe(true);
    expect(sanitizeHapticsEnabled(false)).toBe(false);
    expect(sanitizeHapticsEnabled(true)).toBe(true);
    expect(sanitizeHapticsEnabled(undefined)).toBe(true);
    expect(sanitizeHapticsEnabled("corrupt")).toBe(true);
    expect(sanitizeHapticsEnabled(0)).toBe(true);

    const migrate = useHapticsStore.persist.getOptions().migrate!;
    expect(migrate(undefined, 0)).toEqual({ hapticsEnabled: true });
    expect(migrate({ hapticsEnabled: false }, 0)).toEqual({ hapticsEnabled: false });
    expect(migrate({ hapticsEnabled: "corrupt" }, 0)).toEqual({ hapticsEnabled: true });
    expect(migrate("not-an-object", 0)).toEqual({ hapticsEnabled: true });
  });

  it("토글은 조작 사실(touched)을 함께 적고, 같은 값의 재조작만 상태를 만들지 않는다 (리뷰 L-L1, 두 시점)", () => {
    // 두 시점: 종전에는 값이 같으면 언제나 no-op이었다 — touched 가드가 없어 하이드레이션이
    // 이 실행의 조작을 되감을 수 있었다(records-view·amount-presets와 비대칭). 이제 첫 조작은
    // 값이 같아도 touched를 세우고, touched가 선 뒤의 같은 값 재조작만 no-op이다.
    useHapticsStore.getState().setHapticsEnabled(true);
    expect(useHapticsStore.getState().touched).toBe(true);
    const before = useHapticsStore.getState();
    useHapticsStore.getState().setHapticsEnabled(true);
    expect(useHapticsStore.getState()).toBe(before);
    useHapticsStore.getState().setHapticsEnabled(false);
    expect(useHapticsStore.getState().hapticsEnabled).toBe(false);
  });

  it("리뷰 L-L1: 이 실행의 명시 조작이 하이드레이션보다 이긴다 (동라운드 두 스토어와 대칭)", () => {
    const options = useHapticsStore.persist.getOptions();
    const merge = options.merge!;
    // 조작 전: 저장본이 이긴다(종전 그대로).
    expect(
      merge({ hapticsEnabled: false }, { ...useHapticsStore.getInitialState(), touched: false })
    ).toMatchObject({ hapticsEnabled: false });
    // 조작 뒤: 방금 끈 진동을 옛 저장본(켬)이 되켜지 않는다.
    expect(
      merge({ hapticsEnabled: true }, { ...useHapticsStore.getInitialState(), hapticsEnabled: false, touched: true })
    ).toMatchObject({ hapticsEnabled: false });
    // 플래그는 저장하지 않는다 — 다음 실행에는 아무 의미가 없는 값이다.
    expect(options.partialize!(useHapticsStore.getState())).toEqual({
      hapticsEnabled: useHapticsStore.getState().hapticsEnabled
    });
  });

  it("persist 관례가 저장소의 다른 스토어와 같다(이름·버전·방어적 migrate/merge)", () => {
    const storeSource = source("src/stores/haptics.store.ts");
    expect(storeSource).toContain('name: "wooriai-haptics"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("version: 1");
    expect(storeSource).toContain("migrate: (persisted) => sanitizedState(persisted)");
    // 리뷰 L-L1(두 시점): 종전 merge는 저장본을 무조건 얹었다 — 이제 touched 가드를 지난다.
    expect(storeSource).toContain(
      "hapticsEnabled: current.touched ? current.hapticsEnabled : sanitizedState(persisted).hapticsEnabled"
    );
    // 기기 단위 선택 — 세션 teardown 목록에 들지 않는다(notification-preferences와 같은 범주).
    expect(source("src/offline/session-teardown.ts")).not.toContain("haptics");
  });
});

describe("라운드 101 트랙 B 채택 지점 (source verification — 화면은 vitest에서 렌더하지 않는 관례)", () => {
  it("지출 저장: hapticSuccess가 onSuccess(기기 저장 확정) 안에만 있다", () => {
    const src = source("app/expenses/new.tsx");
    // 슬라이스 두 끝 가드 — 앵커가 사라지면 슬라이스가 빈 판정을 하기 전에 여기서 빨개진다.
    const start = src.indexOf("onSuccess: async () => {");
    const end = src.indexOf("const isPixelLockAmountCapture");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(src.slice(start, end)).toContain("hapticSuccess();");
    // 렌더 무접촉: 호출은 이 한 곳뿐이다(EXP-001 비세션 렌더에는 닿는 자리 자체가 없다).
    expect(src.match(/hapticSuccess\(\);/g) ?? []).toHaveLength(1);
    expect(src).toContain('import { hapticSuccess } from "../../src/ui/haptics";');
  });

  it("준비템 상태 체크: hapticSelection이 기기 저장 확정 콜백(.then) 안에만 있다", () => {
    const src = source("app/(tabs)/items.tsx");
    const start = src.indexOf("void updateItemStatusOffline(authToken, queryClient, {");
    const end = src.indexOf("setStatusErrorMessage(ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE);");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const confirmedBlock = src.slice(start, end);
    expect(confirmedBlock).toContain(".then(() => {");
    expect(confirmedBlock).toContain("hapticSelection();");
    // 렌더 무접촉(ITEM-001) + 실패 경로(.catch)에서는 울리지 않는다: 호출은 이 한 곳뿐이다.
    expect(src.match(/hapticSelection\(\);/g) ?? []).toHaveLength(1);
    expect(src).toContain('import { hapticSelection } from "../../src/ui/haptics";');
  });

  it("앱 잠금: hapticWarning이 submit의 PIN 오류 갈래(안내 뒤)에만 있다", () => {
    const src = source("src/security/AppLockOverlay.tsx");
    const start = src.indexOf("const submit = async () => {");
    const end = src.indexOf("const confirmForgotPin");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const submitBlock = src.slice(start, end);
    expect(submitBlock).toContain("hapticWarning();");
    // 성공(unlocked) 갈래는 함수 밖으로 돌아가고, 경고는 오류 안내(setNotice) 뒤에 선다.
    expect(submitBlock.indexOf('if (result === "unlocked")')).toBeGreaterThan(-1);
    expect(submitBlock.indexOf("hapticWarning();")).toBeGreaterThan(submitBlock.indexOf("setNotice(message);"));
    expect(src.match(/hapticWarning\(\);/g) ?? []).toHaveLength(1);
  });

  it("설정: 터치 반응(진동) 토글이 알림·잠금 구획에 통계 동의와 같은 Switch 관례로 선다", () => {
    const src = source("app/settings/index.tsx");
    // 슬라이스 두 끝 가드 — 알림·잠금 구획의 렌더 시작과 다음 구획(데이터) 렌더 시작.
    const start = src.indexOf("{settingsSectionTitles.alerts}</Text>");
    const end = src.indexOf("{settingsSectionTitles.data}</Text>");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const alertsBlock = src.slice(start, end);
    expect(alertsBlock).toContain("터치 반응(진동)");
    expect(alertsBlock).toContain('accessibilityLabel="터치 반응(진동)"');
    expect(alertsBlock).toContain('accessibilityRole="switch"');
    expect(alertsBlock).toContain("accessibilityState={{ checked: hapticsEnabled }}");
    expect(alertsBlock).toContain("onValueChange={setHapticsEnabled}");
    expect(alertsBlock).toContain("value={hapticsEnabled}");
    // DNC-018 해요체 + 정직 고지(스캐폴드 빌드에서는 일부만 동작한다는 사실을 밝힌다).
    expect(alertsBlock).toContain(
      "저장이나 잘못된 입력 같은 순간에 짧은 진동으로 반응해요. 기기나 앱 버전에 따라 일부만 동작할 수 있어요."
    );
    // 값의 원천은 persist 스토어 하나다(화면 로컬 state 금지).
    expect(src).toContain("const hapticsEnabled = useHapticsStore((state) => state.hapticsEnabled);");
    expect(src).toContain("const setHapticsEnabled = useHapticsStore((state) => state.setHapticsEnabled);");
  });

  it("홈(index.tsx)은 소유 밖 — 이 라운드가 홈에 햅틱을 심지 않았다(예산 경고 채택은 이월)", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).not.toContain("haptic");
    expect(homeSource).not.toContain("haptics.store");
  });
});
