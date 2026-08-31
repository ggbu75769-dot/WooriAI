import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { UserDeviceSummary } from "../api/client";
import { deviceRowSwitchLabel, deviceRowTitle } from "./device-rows";

const mobileRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

/** 주석을 뺀 코드 줄만 남긴다(문서가 인용한 문자열을 "정의"로 세지 않기 위해). */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * 라운드 87 트랙 D — 기기 목록의 두 줄이 서로 다른 줄이 된다.
 *
 * 실패 시나리오: 안드로이드 기기를 둘 등록한 사람에게 두 행의 제목도 두 스위치의 낭독도
 * 글자 하나 다르지 않았다(`platformLabel`은 플랫폼당 한 문자열이다). 가를 값(`osVersion`)은
 * **앱이 등록할 때 자기 손으로 올려** 응답에 이미 실려 오는 값이라, 서버도 요청도 건드리지
 * 않고 화면이 읽기만 하면 된다.
 *
 * ⚠️ 플랫폼 문자열은 화면의 `platformLabel` 하나가 소스이고, 이 파일은 그 바이트를 아래
 * 소스 단언으로 못박은 뒤 같은 문자열을 픽스처로 쓴다(두 벌 정의를 만들지 않는다).
 */
const IOS_LABEL = "iPhone · iOS";
const ANDROID_LABEL = "Android 기기";

const device = (overrides: Partial<UserDeviceSummary> = {}): UserDeviceSummary => ({
  id: "device-abc-123",
  platform: "android",
  notificationEnabled: true,
  appVersion: "1.4.0",
  osVersion: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  ...overrides
});

/** 화면의 두 호출부와 같은 모양(아래 ⓑ가 그 두 줄이 실재하는지 소스로 확인한다). */
const row = (summary: UserDeviceSummary, platformLabel: string, isCurrentDevice = false) => ({
  title: deviceRowTitle(platformLabel, summary.osVersion),
  switchLabel: deviceRowSwitchLabel(platformLabel, summary.osVersion, isCurrentDevice)
});

describe("라운드 87 D 기기 행의 구별 문구", () => {
  it("ⓐ 같은 플랫폼 기기 둘이 서로 다른 문자열로 그려지고 서로 다르게 낭독된다", () => {
    // 실패 시나리오 그대로: 안드로이드 기기 둘(등록 훅이 올린 API 레벨이 다르다).
    const older = row(device({ id: "device-old", osVersion: "33" }), ANDROID_LABEL);
    const newer = row(device({ id: "device-new", osVersion: "34" }), ANDROID_LABEL);

    expect(older.title).toBe("Android 기기 · 33");
    expect(newer.title).toBe("Android 기기 · 34");
    expect(older.title).not.toBe(newer.title);
    expect(older.switchLabel).toBe("Android 기기 · 33 알림");
    expect(newer.switchLabel).toBe("Android 기기 · 34 알림");
    expect(older.switchLabel).not.toBe(newer.switchLabel);

    // iOS 쪽도 같다(같은 아이폰 둘이 OS 버전으로 갈린다).
    const iosOne = row(device({ platform: "ios", osVersion: "17.5" }), IOS_LABEL);
    const iosTwo = row(device({ platform: "ios", osVersion: "18.1.1" }), IOS_LABEL);
    expect(iosOne.title).toBe("iPhone · iOS · 17.5");
    expect(iosTwo.title).toBe("iPhone · iOS · 18.1.1");
    expect(iosOne.switchLabel).not.toBe(iosTwo.switchLabel);
  });

  it("ⓐ-2 둘 다 값이 없으면 갈리지 않는다 — 그 한계를 값으로 적어 둔다", () => {
    // ⚠️ 등록 훅을 거치지 않은 행(마스터 토글의 `registerDevice` 경로)은 `osVersion`이 null이라
    // 가를 재료가 아예 없다. 그때 지어내지 않는 것이 이 트랙의 규율이고, 두 줄이 같아지는 것은
    // 오늘 남는 사각이다(그 경로에 값을 실어 보내는 것은 이 트랙의 일이 아니다).
    const first = row(device({ id: "device-1" }), ANDROID_LABEL);
    const second = row(device({ id: "device-2" }), ANDROID_LABEL);
    expect(first.title).toBe(second.title);
    expect(first.switchLabel).toBe(second.switchLabel);

    // 다만 *이 기기*는 그 둘도 가른다 — 낭독으로 도달하는 사실이기 때문이다(ⓓ).
    const current = row(device({ id: "device-1" }), ANDROID_LABEL, true);
    expect(current.switchLabel).not.toBe(second.switchLabel);
  });

  it("ⓒ osVersion이 없으면 조각이 서지 않고 종전 문자열과 바이트 단위로 같다", () => {
    // 종전 렌더: 제목 `platformLabel(device.platform)` · 라벨 `` `${platformLabel(...)} 알림` ``.
    for (const [platformLabel, expectedTitle] of [
      [ANDROID_LABEL, "Android 기기"],
      [IOS_LABEL, "iPhone · iOS"]
    ] as const) {
      for (const missing of [null, undefined, "", "   "]) {
        const summary = device({ platform: "android", osVersion: missing as string | null });
        expect(deviceRowTitle(platformLabel, summary.osVersion), String(missing)).toBe(expectedTitle);
        expect(deviceRowSwitchLabel(platformLabel, summary.osVersion, false), String(missing)).toBe(
          `${expectedTitle} 알림`
        );
      }
    }
  });

  it("ⓒ-2 버전 모양이 아닌 값은 원문을 흘리지 않고 종전 문자열로 돌아간다", () => {
    for (const raw of ["Unknown", "14 (Q)", "안드로이드 14", "17.5.1.2.3", "99999", "<script>", "  "]) {
      expect(deviceRowTitle(ANDROID_LABEL, raw), raw).toBe(ANDROID_LABEL);
      expect(deviceRowSwitchLabel(ANDROID_LABEL, raw, false), raw).toBe(`${ANDROID_LABEL} 알림`);
    }
    // 값 자체가 문자열이 아닌 응답(방어)도 같은 갈래로 떨어진다.
    expect(deviceRowTitle(ANDROID_LABEL, 34 as unknown as string)).toBe(ANDROID_LABEL);
    // 공백만 있는 값은 다듬어 통과시킨다 — 흘리는 것이 아니라 같은 버전이다.
    expect(deviceRowTitle(ANDROID_LABEL, " 34 ")).toBe("Android 기기 · 34");
  });

  it("ⓓ *이 기기* 사실이 배지에만 있지 않고 낭독에도 도달한다", () => {
    const summary = device({ osVersion: "34" });
    expect(deviceRowSwitchLabel(ANDROID_LABEL, summary.osVersion, true)).toBe("Android 기기 · 34 알림, 이 기기");
    expect(deviceRowSwitchLabel(ANDROID_LABEL, summary.osVersion, false)).toBe("Android 기기 · 34 알림");

    // 배지의 그 문자열 그대로다(새 문구를 짓지 않았다) — 화면의 배지 라벨과 같은 바이트.
    const screen = readSource("app/settings/notifications.tsx");
    expect(screen).toContain('<StatusBadge label="이 기기" tone="success" />');
    // 판정도 같은 값이다: 배지와 낭독이 서로 다른 기기를 가리킬 자리가 없다.
    expect(screen).toContain("const isThisDevice = device.id === registeredDeviceId;");
    expect(screen).toContain("{isThisDevice ? <StatusBadge label=\"이 기기\" tone=\"success\" /> : null}");
  });

  it("ⓑ 행 제목과 스위치 라벨이 같은 파생값을 읽는다", () => {
    // 라벨은 제목을 그대로 앞에 세운다 — 두 문장이 갈릴 자리가 없다.
    for (const platformLabel of [ANDROID_LABEL, IOS_LABEL]) {
      for (const osVersion of [null, undefined, "", "34", "17.5", "Unknown"]) {
        for (const isCurrent of [true, false]) {
          const title = deviceRowTitle(platformLabel, osVersion);
          const label = deviceRowSwitchLabel(platformLabel, osVersion, isCurrent);
          expect(label.startsWith(`${title} 알림`), `${platformLabel}/${String(osVersion)}`).toBe(true);
          expect(label).toBe(isCurrent ? `${title} 알림, 이 기기` : `${title} 알림`);
        }
      }
    }

    // 화면의 두 자리가 실제로 그 파생을 지나간다(화면은 vitest에서 렌더되지 않으므로 소스 계약).
    const screen = readSource("app/settings/notifications.tsx");
    expect(screen).toContain(
      "<Text style={rowTitleStyle}>{deviceRowTitle(platformLabel(device.platform), device.osVersion)}</Text>"
    );
    expect(screen).toContain(
      "accessibilityLabel={deviceRowSwitchLabel(platformLabel(device.platform), device.osVersion, isThisDevice)}"
    );
    expect(screen).toContain('import { deviceRowSwitchLabel, deviceRowTitle } from "../../src/notifications/device-rows";');
    // 라벨을 조립하는 자리는 모듈 하나뿐이다(화면에 두 벌 리터럴을 만들지 않았다).
    expect(screen).not.toContain("} 알림`");

    // 플랫폼 문자열은 화면의 `platformLabel` 하나가 소스이고 바이트가 그대로다(새 이름 0건).
    expect(screen).toContain('if (platform === "ios") return "iPhone · iOS";');
    expect(screen).toContain('if (platform === "android") return "Android 기기";');
    // 주석은 종전 문자열을 **인용**하므로(그것이 이 트랙의 근거다) 코드 줄만 본다.
    const moduleCode = stripComments(readSource("src/notifications/device-rows.ts"));
    for (const forbidden of ['"ios"', '"android"', "iPhone", "Android"]) {
      expect(moduleCode, `모듈은 플랫폼 이름을 짓지 않는다: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("ⓔ 앱 버전·푸시 토큰·기기 id는 그리지 않는다", () => {
    // 그려서 갈라지는 것만 그린다: 같은 빌드를 쓰는 두 기기는 appVersion이 갈리지 않고,
    // 토큰·id는 애초에 표시 대상이 아니다.
    const summary = device({ id: "device-abc-123", appVersion: "1.4.0", osVersion: "34" });
    const drawn = [
      deviceRowTitle(ANDROID_LABEL, summary.osVersion),
      deviceRowSwitchLabel(ANDROID_LABEL, summary.osVersion, true)
    ];
    for (const text of drawn) {
      expect(text).not.toContain(summary.id);
      expect(text).not.toContain(String(summary.appVersion));
    }

    // 모듈은 그 셋을 인자로도 받지 않는다(그릴 방법 자체가 없다).
    const moduleSource = readSource("src/notifications/device-rows.ts");
    for (const forbidden of ["appVersion", "pushToken", "deviceId"]) {
      expect(moduleSource.includes(`${forbidden}:`), forbidden).toBe(false);
    }

    // 화면도 그 값들을 그리지 않는다 — appVersion은 이 화면에 등장하지 않고, id는 키·PATCH
    // 인자·*이 기기* 판정에만 쓰인다(사람이 읽는 문자열로 나가지 않는다).
    const screen = readSource("app/settings/notifications.tsx");
    expect(screen).not.toContain("appVersion");
    expect(screen.match(/device\.id/g) ?? [], "기기 id를 읽는 자리 전수").toHaveLength(4);
    for (const site of [
      "deviceList.find((device) => device.id === registeredDeviceId)",
      "<Card key={device.id} style={{ gap: 6 }}>",
      "const isThisDevice = device.id === registeredDeviceId;",
      "toggleDevice.mutate({ deviceId: device.id, enabled: next })"
    ]) {
      expect(screen, site).toContain(site);
    }
  });

  it("서버·요청·등록 인자는 한 글자도 바뀌지 않았다", () => {
    const screen = readSource("app/settings/notifications.tsx");
    // 새 쿼리 0건 — 이 화면의 조회는 기기 목록 하나 그대로다.
    expect(screen.match(/useQuery\(/g) ?? []).toHaveLength(1);
    expect(screen).toContain("queryFn: () => listMyDevices(authToken!)");
    // 등록·수정 호출 인자 그대로(마스터 토글이 두 값을 보내지 않는 사실은 오늘 그대로 둔다).
    expect(screen).toContain(
      "const registered = await registerDevice(authToken!, { platform, pushToken, notificationEnabled: next });"
    );
    expect(screen).toContain("return updateDevice(authToken!, currentDevice.id, next);");
    expect(screen).toContain("updateDevice(authToken!, input.deviceId, input.enabled)");

    // 실패 문구 두 자리와 태그도 그대로다(오프라인 대장·낭독 대장이 무는 바이트).
    expect(screen.match(/accessibilityLiveRegion="polite" accessibilityRole="alert"/g) ?? []).toHaveLength(2);
    expect(screen).toContain("<Text style={errorTextStyle}>{devicesLoadErrorText}</Text>");
    expect(screen).toContain("`기기 목록을 ${devicesLoadErrorCopy.title}`");
    expect(screen).toContain("`알림 설정을 ${deviceToggleSaveErrorCopy}`");
    // 마지막 사용 줄과 마스터 토글 라벨도 종전 그대로.
    expect(screen).toContain("`마지막 사용 ${formatRelativeTime(updatedAtMs, Date.now())}`");
    expect(screen).toContain('accessibilityLabel="푸시 알림"');
  });
});
