import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * PUSH-116 source contract (settings-flow.test.ts convention -- screens aren't runtime-rendered
 * because react-native has no native binding under vitest): the devices API is wired in
 * client.ts, the SET-006 screen exists with an honest disabled state, settings has exactly one
 * entry point, the boot hook is mounted outside app/_layout.tsx, and the flag is documented.
 */
describe("PUSH-116 push settings contract", () => {
  it("exposes the devices API client functions with local-session branches", async () => {
    const client = await import("../api/client");
    expect(client.registerDevice).toEqual(expect.any(Function));
    expect(client.listMyDevices).toEqual(expect.any(Function));
    expect(client.updateDevice).toEqual(expect.any(Function));

    const clientSource = source("src/api/client.ts");
    for (const expected of [
      'requestJson<UserDeviceSummary>("/me/devices"',
      'requestJson<{ devices: UserDeviceSummary[] }>("/me/devices"',
      "requestJson<UserDeviceSummary>(`/me/devices/${deviceId}`",
      "localDevices.registerLocalDevice",
      "localDevices.listLocalDevices",
      "localDevices.updateLocalDevice"
    ]) {
      expect(clientSource, `client.ts should contain ${expected}`).toContain(expected);
    }
  });

  it("creates the SET-006 notifications screen with honest push availability", () => {
    const screenPath = "app/settings/notifications.tsx";
    expect(existsSync(join(mobileRoot, screenPath)), `${screenPath} should exist`).toBe(true);
    const screenSource = source(screenPath);
    // 등록 상태 + 마스터 토글 + 기기 목록/기기별 토글.
    expect(screenSource).toContain('testID="screen-SET-006"');
    expect(screenSource).toContain("listMyDevices");
    expect(screenSource).toContain("registerDevice");
    expect(screenSource).toContain("updateDevice");
    expect(screenSource).toContain("마지막 사용");
    // 허위 기능 노출 금지: 토큰을 얻을 수 없는 빌드에서는 토글 비활성 + 업데이트 안내.
    expect(screenSource).toContain("isPushSupported");
    expect(screenSource).toContain("앱 업데이트 후 사용할 수 있어요");
    expect(screenSource).toContain("masterToggleDisabled = !pushSupported");
    // 인앱 알림(NOTI-102)과의 관계 안내 1줄.
    expect(screenSource).toContain("푸시와 별개로 계속 표시돼요");
    // A11Y: switches carry role + Korean label.
    expect(screenSource).toContain('accessibilityRole="switch"');
    expect(screenSource).toContain('accessibilityLabel="푸시 알림"');
  });

  it("adds exactly one settings entry point to the notifications screen", () => {
    const settingsSource = source("app/settings/index.tsx");
    const occurrences = settingsSource.split('router.push("/settings/notifications")').length - 1;
    expect(occurrences).toBe(1);
    expect(settingsSource).toContain('title="알림 설정"');
  });

  it("mounts the boot registration hook in the tabs layout, not the root layout", () => {
    const tabsSource = source("app/(tabs)/_layout.tsx");
    expect(tabsSource).toContain("usePushDeviceRegistration(");
    // 훅은 early return(Redirect)보다 앞에 위치해 렌더 간 훅 순서가 고정된다.
    expect(tabsSource.indexOf("usePushDeviceRegistration(")).toBeLessThan(tabsSource.indexOf("<Redirect"));

    const rootSource = source("app/_layout.tsx");
    expect(rootSource).not.toContain("usePushDeviceRegistration");
  });

  it("documents the flag in .env.example and gates on EXPO_PUBLIC_PUSH_ENABLED", () => {
    const envExample = source("../../.env.example");
    expect(envExample).toContain("EXPO_PUBLIC_PUSH_ENABLED=0");

    const tokenSource = source("src/notifications/push-token-source.ts");
    // babel-preset-expo 인라인 규칙: 멤버 표현식을 리터럴로 유지 (kakao-login.ts와 동일).
    expect(tokenSource).toContain('process.env.EXPO_PUBLIC_PUSH_ENABLED === "1"');
    // 활성 절차 문서화: 의존성 1줄, google-services.json, 서버 PUSH_ENABLED.
    expect(tokenSource).toContain("expo-notifications");
    expect(tokenSource).toContain("google-services.json");
    expect(tokenSource).toContain("PUSH_ENABLED=1");
    // 서버 FCM 직발송에 맞는 네이티브 디바이스 토큰 사용.
    expect(tokenSource).toContain("getDevicePushTokenAsync");
  });
});
