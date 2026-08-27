import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Switch, Text, View } from "react-native";
import {
  listMyDevices,
  registerDevice,
  updateDevice,
  LOCAL_SESSION_TOKEN,
  type UserDeviceSummary
} from "../../src/api/client";
import { getPushToken, isPushSupported } from "../../src/notifications/push-token-source";
import { formatRelativeTime } from "../../src/notifications/relative-time";
import {
  getCurrentDevicePlatform,
  usePushRegistrationStore
} from "../../src/notifications/usePushDeviceRegistration";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, EmptyStateCard, ScreenHeader, SecondaryButton, StatusBadge } from "../../src/ui";

/**
 * PUSH-116 (SET-006) 알림 설정: 현재 기기의 푸시 등록 상태 + "푸시 알림" 마스터 토글 +
 * 등록된 내 기기 목록(기기별 알림 on/off, PATCH /me/devices/:id).
 *
 * 정직한 비활성 상태가 핵심 계약: expo-notifications가 아직 설치되지 않은 이 빌드에서는
 * 푸시 토큰을 얻을 수 없으므로 토글을 비활성으로 두고 "앱 업데이트 후 사용할 수 있어요"를
 * 안내한다 -- 동작하지 않는 기능을 켜지는 척 노출하지 않는다(DNC의 허위 표시 금지 정신).
 * 활성 절차는 src/notifications/push-token-source.ts 모듈 주석 참고.
 */

const deviceListQueryKey = ["my-devices"] as const;

function platformLabel(platform: string): string {
  if (platform === "ios") return "iPhone · iOS";
  if (platform === "android") return "Android 기기";
  return platform;
}

export default function NotificationSettingsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const hasSession = Boolean(authToken);
  const registeredDeviceId = usePushRegistrationStore((state) => state.registeredDeviceId);
  const queryClient = useQueryClient();

  // 이 빌드가 푸시를 지원하는지(플래그 on + expo-notifications 설치)는 마운트 시점에 한 번
  // 확정되는 정적 사실 -- 렌더마다 재계산할 필요 없이 초기값으로 고정한다.
  const [pushSupported] = useState(() => isPushSupported());

  const devices = useQuery({
    queryKey: deviceListQueryKey,
    enabled: hasSession,
    queryFn: () => listMyDevices(authToken!)
  });
  const deviceList = devices.data?.devices ?? [];
  const currentDevice = deviceList.find((device) => device.id === registeredDeviceId) ?? null;

  // 부팅 훅이 등록에 성공한 뒤 이 화면이 열리면 최신 상태를 반영하도록 목록을 한 번 갱신.
  useEffect(() => {
    if (registeredDeviceId) {
      void queryClient.invalidateQueries({ queryKey: deviceListQueryKey });
    }
  }, [registeredDeviceId, queryClient]);

  // 마스터 토글: 현재 기기가 이미 등록돼 있으면 그 행을 토글, 아니면 (권한 프롬프트 포함)
  // 토큰을 얻어 신규 등록. 서버가 (user, pushToken)으로 upsert하므로 중복 등록 걱정 없음.
  const toggleCurrentDevice = useMutation({
    mutationFn: async (next: boolean): Promise<UserDeviceSummary> => {
      if (currentDevice) {
        return updateDevice(authToken!, currentDevice.id, next);
      }
      const pushToken = await getPushToken({ requestPermission: true });
      if (!pushToken) {
        throw new Error("PUSH_TOKEN_UNAVAILABLE");
      }
      const platform = getCurrentDevicePlatform();
      if (!platform) {
        throw new Error("PUSH_PLATFORM_UNSUPPORTED");
      }
      const registered = await registerDevice(authToken!, { platform, pushToken, notificationEnabled: next });
      usePushRegistrationStore.getState().setRegisteredDeviceId(registered.id);
      return registered;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deviceListQueryKey });
    }
  });

  const toggleDevice = useMutation({
    mutationFn: (input: { deviceId: string; enabled: boolean }) =>
      updateDevice(authToken!, input.deviceId, input.enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deviceListQueryKey });
    }
  });

  const masterToggleValue = pushSupported && (currentDevice?.notificationEnabled ?? false);
  const masterToggleDisabled = !pushSupported || !hasSession || toggleCurrentDevice.isPending;

  return (
    <AppScreen>
      <View testID="screen-SET-006" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="설정" title="알림 설정" subtitle="푸시 알림과 기기별 수신을 관리해요" onBack={() => router.back()} />

        {!hasSession ? <EmptyStateCard title="로그인 후 이용할 수 있어요." actionLabel="확인" /> : null}

        {hasSession ? (
          <Card style={{ gap: 10 }}>
            <View style={toggleRowStyle}>
              <View style={{ flex: 1, gap: 3, paddingRight: 12 }}>
                <Text style={rowTitleStyle}>푸시 알림</Text>
                <Text style={rowSubtitleStyle}>
                  {currentDevice
                    ? "이 기기는 푸시 기기로 등록되어 있어요."
                    : "이 기기는 아직 푸시 기기로 등록되지 않았어요."}
                </Text>
              </View>
              {currentDevice ? <StatusBadge label="등록됨" tone="success" /> : <StatusBadge label="미등록" />}
              <Switch
                accessibilityLabel="푸시 알림"
                accessibilityRole="switch"
                disabled={masterToggleDisabled}
                onValueChange={(next) => toggleCurrentDevice.mutate(next)}
                thumbColor={theme.colors.white}
                trackColor={{ false: theme.colors.gray300, true: theme.colors.mainCoral }}
                value={masterToggleValue}
              />
            </View>
            {!pushSupported ? (
              <Text style={noticeTextStyle}>
                지금 앱 버전에서는 푸시 알림을 받을 수 없어요. 앱 업데이트 후 사용할 수 있어요.
              </Text>
            ) : null}
            {toggleCurrentDevice.isError ? (
              <Text style={errorTextStyle}>
                푸시 설정을 바꾸지 못했어요. 알림 권한을 확인한 뒤 다시 시도해 주세요.
              </Text>
            ) : null}
            {/* 인앱 알림(app/notifications.tsx, NOTI-102)과의 관계 안내 */}
            <Text style={rowSubtitleStyle}>앱 안의 알림함(홈 종 아이콘)은 푸시와 별개로 계속 표시돼요.</Text>
          </Card>
        ) : null}

        {hasSession ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={sectionTitleStyle}>내 기기</Text>

            {devices.isLoading ? (
              <Card>
                <Text style={rowSubtitleStyle}>불러오는 중이에요...</Text>
              </Card>
            ) : null}

            {devices.isError ? (
              <Card style={{ gap: 10 }}>
                <Text style={errorTextStyle}>기기 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Text>
                <SecondaryButton label="다시 시도" onPress={() => devices.refetch()} />
              </Card>
            ) : null}

            {devices.isSuccess && deviceList.length === 0 ? (
              <Card>
                <Text style={rowSubtitleStyle}>등록된 기기가 없어요. 푸시를 켜면 이 기기가 등록돼요.</Text>
              </Card>
            ) : null}

            {deviceList.map((device) => {
              const isThisDevice = device.id === registeredDeviceId;
              const updatedAtMs = Date.parse(device.updatedAt);
              const lastUsedText = Number.isNaN(updatedAtMs)
                ? null
                : `마지막 사용 ${formatRelativeTime(updatedAtMs, Date.now())}`;
              return (
                <Card key={device.id} style={{ gap: 6 }}>
                  <View style={toggleRowStyle}>
                    <View style={{ flex: 1, gap: 3, paddingRight: 12 }}>
                      <Text style={rowTitleStyle}>{platformLabel(device.platform)}</Text>
                      {lastUsedText ? <Text style={rowSubtitleStyle}>{lastUsedText}</Text> : null}
                    </View>
                    {isThisDevice ? <StatusBadge label="이 기기" tone="success" /> : null}
                    <Switch
                      accessibilityLabel={`${platformLabel(device.platform)} 알림`}
                      accessibilityRole="switch"
                      disabled={toggleDevice.isPending}
                      onValueChange={(next) => toggleDevice.mutate({ deviceId: device.id, enabled: next })}
                      thumbColor={theme.colors.white}
                      trackColor={{ false: theme.colors.gray300, true: theme.colors.mainCoral }}
                      value={device.notificationEnabled}
                    />
                  </View>
                </Card>
              );
            })}

            {toggleDevice.isError ? (
              <Text style={errorTextStyle}>알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

const toggleRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10
} as const;

const rowTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "700"
} as const;

const rowSubtitleStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 17
} as const;

const sectionTitleStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "800"
} as const;

const noticeTextStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 17
} as const;

const errorTextStyle = {
  color: theme.colors.danger,
  fontSize: 12,
  lineHeight: 17
} as const;
