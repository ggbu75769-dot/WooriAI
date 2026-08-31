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
    // 라운드 87 D: 기기 행의 제목과 스위치 라벨은 같은 파생값을 읽는다(src/notifications/device-rows.ts).
    // 같은 플랫폼 기기 둘이 서로 다른 줄·다른 낭독이 되는 자리이고, 파생의 계약은 device-rows.test.ts.
    expect(screenSource).toContain("deviceRowTitle(platformLabel(device.platform), device.osVersion)");
    expect(screenSource).toContain(
      "deviceRowSwitchLabel(platformLabel(device.platform), device.osVersion, isThisDevice)"
    );
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

  /**
   * 라운드 88 트랙 B — 마스터 토글의 등록 인자가 부팅 훅과 **같은 한 벌**을 부른다.
   *
   * 이 화면이 만드는 등록은 *권한을 준 적 없는 사용자의 첫 기기 행*이고(부팅 훅은 권한을 묻지
   * 않는다), 종전에는 그 한 자리만 `appVersion`·`osVersion` 없이 등록해 라운드 87 D의 구별
   * 조각이 정확히 그 행에서만 서지 않았다. 목록은 이제 훅이 짓고 두 호출이 함께 읽는다 —
   * 실행 쪽 계약(키 집합·권한 갈래·창)은 `push-registration.test.ts`가 진다.
   */
  it("라운드 88 B: 등록 인자가 buildDeviceRegistrationBody 한 벌을 읽는다", () => {
    const screenSource = source("app/settings/notifications.tsx");
    expect(screenSource).toContain(
      "const registered = await registerDevice(authToken!, buildDeviceRegistrationBody({ platform, pushToken, notificationEnabled: next }));"
    );
    expect(screenSource).toContain("buildDeviceRegistrationBody,");
    // 목록을 두 곳에 손으로 적지 않는다.
    expect(screenSource).not.toContain("osVersion:");
    expect(screenSource).not.toContain("appVersion");
  });

  /**
   * ⓕ 바이트 불변 — 이 트랙은 **값이 도달하게** 할 뿐 문구를 만들지 않는다(새 한국어 문장 0건).
   *
   * 아래 스물넷은 주석을 걷은 화면 소스에서 한국어를 이고 있는 줄 전수이고(순서까지), 그 목록
   * 자체가 이 트랙의 부정 단언이다 — 등록 인자 한 줄이 이 목록을 한 바이트도 건드리지 않는다.
   */
  const SCREEN_KOREAN_LINES: readonly string[] = [
    'if (platform === "android") return "Android 기기";',
    ': `기기 목록을 ${devicesLoadErrorCopy.title}`;',
    ': `알림 설정을 ${deviceToggleSaveErrorCopy}`;',
    'announceForA11y("푸시 설정을 바꾸지 못했어요. 알림 권한을 확인한 뒤 다시 시도해 주세요.");',
    'eyebrow="설정"',
    'title="알림 설정"',
    'subtitle="앱 알림함과 푸시 알림을 관리해요"',
    '<EmptyStateCard title="로그인 후 이용할 수 있어요." actionLabel="확인" onPress={() => router.push("/login")} />',
    "<Text style={sectionTitleStyle}>앱 알림함</Text>",
    "홈 종 아이콘의 알림함에 어떤 소식을 남길지 고를 수 있어요. 끈 알림은 알림함에 쌓이지 않아요.",
    "<Text style={noticeTextStyle}>다시 켜면 그다음부터 알림함에 다시 쌓여요.</Text>",
    "<Text style={rowTitleStyle}>푸시 알림</Text>",
    '? "이 기기는 푸시 기기로 등록되어 있어요."',
    ': "이 기기는 아직 푸시 기기로 등록되지 않았어요."}',
    '{currentDevice ? <StatusBadge label="등록됨" tone="success" /> : <StatusBadge label="미등록" />}',
    'accessibilityLabel="푸시 알림"',
    "지금 앱 버전에서는 푸시 알림을 받을 수 없어요. 앱 업데이트 후 사용할 수 있어요.",
    "푸시 설정을 바꾸지 못했어요. 알림 권한을 확인한 뒤 다시 시도해 주세요.",
    "앱 안의 알림함(홈 종 아이콘)은 푸시와 별개로 계속 표시돼요. 종류별로 끄려면 위의 앱 알림함에서 바꿀 수 있어요.",
    "<Text style={sectionTitleStyle}>내 기기</Text>",
    "<Text style={rowSubtitleStyle}>불러오는 중이에요...</Text>",
    "<Text style={rowSubtitleStyle}>등록된 기기가 없어요. 푸시를 켜면 이 기기가 등록돼요.</Text>",
    ": `마지막 사용 ${formatRelativeTime(updatedAtMs, Date.now())}`;",
    '{isThisDevice ? <StatusBadge label="이 기기" tone="success" /> : null}'
  ];

  it("라운드 88 B ⓕ: 화면의 한국어 줄 전수·스위치 배선·실패 태그가 바이트 불변이다", () => {
    const screenSource = source("app/settings/notifications.tsx");
    const code = screenSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[^\n"'`]*\/\/.*$/gm, "");
    const koreanLines = code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /[가-힣]/.test(line));
    expect(koreanLines).toEqual([...SCREEN_KOREAN_LINES]);

    // `platformLabel`의 나머지 한 문자열은 한글이 없어 위 목록에 서지 않는다 — 따로 못 박는다.
    expect(screenSource).toContain('if (platform === "ios") return "iPhone · iOS";');

    // 스위치 배선 셋(종류별·마스터·기기별)과 그 값·비활성 조건.
    for (const wiring of [
      "onValueChange={(next) => setNotificationTypeEnabled(option.type, next)}",
      "onValueChange={(next) => toggleCurrentDevice.mutate(next)}",
      "onValueChange={(next) => toggleDevice.mutate({ deviceId: device.id, enabled: next })}",
      "value={enabled}",
      "value={masterToggleValue}",
      "value={device.notificationEnabled}",
      "disabled={masterToggleDisabled}",
      "disabled={toggleDevice.isPending}"
    ]) {
      expect(screenSource, wiring).toContain(wiring);
    }
    expect(screenSource.match(/accessibilityRole="switch"/g) ?? [], "스위치 전수").toHaveLength(3);

    // 조회 실패·저장 실패 문구가 공용 한 벌에서 오고(이 화면이 다시 짓지 않는다), 낭독 태그가
    // 그 두 자리에 그대로 서 있다(오프라인 대장·낭독 대장이 함께 무는 자리).
    for (const wiring of [
      "const devicesLoadErrorCopy = useLoadErrorCopy(devices.isError);",
      "const deviceToggleSaveErrorCopy = useSaveErrorCopy(toggleDevice.isError);",
      "devicesLoadErrorCopy.title === OFFLINE_LOAD_NOTICE",
      "deviceToggleSaveErrorCopy === OFFLINE_SAVE_NOTICE"
    ]) {
      expect(screenSource, wiring).toContain(wiring);
    }
    expect(
      screenSource.match(/accessibilityLiveRegion="polite" accessibilityRole="alert"/g) ?? [],
      "실패 줄의 낭독 태그 전수"
    ).toHaveLength(2);

    // 등록 실패는 오늘도 조용하다 — 이 트랙이 새 실패 문장을 세우지 않는다.
    expect(screenSource.match(/PUSH_TOKEN_UNAVAILABLE|PUSH_PLATFORM_UNSUPPORTED/g) ?? []).toHaveLength(2);
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
