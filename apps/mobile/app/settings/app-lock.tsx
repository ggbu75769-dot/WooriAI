import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";
import {
  APP_LOCK_LOCK_NOW_A11Y_LABEL,
  APP_LOCK_LOCK_NOW_HINT,
  APP_LOCK_LOCK_NOW_LABEL,
  APP_LOCK_PIN_FORMAT_NOTICE,
  APP_LOCK_PIN_INPUT_LABEL,
  APP_LOCK_PIN_LENGTH,
  APP_LOCK_PIN_MISMATCH_NOTICE,
  APP_LOCK_SAVE_FAILED_NOTICE,
  APP_LOCK_SCOPE_NOTICE,
  APP_LOCK_TITLE,
  APP_LOCK_LOGOUT_KEEPS_SERVER_DATA_NOTICE,
  APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE,
  appLockLockoutNotice,
  appLockRemainingLockSeconds,
  appLockWrongCurrentPinNotice
} from "../../src/security/app-lock";
import { useAppLockStore, type AppLockMutationResult } from "../../src/stores/app-lock.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { announceForA11y, AppScreen, Card, EmptyStateCard, PrimaryButton, ScreenHeader, SecondaryButton, StatusBadge } from "../../src/ui";

/**
 * 라운드 55 트랙 B — 앱 잠금 설정 (docs/5차/round55-plan.md §2, `testID="screen-app-lock"`).
 *
 * PIN 4자리 설정 · 변경 · 해제. 저장은 SecureStore 한 키(src/security/app-lock-storage.ts)이고
 * 이 화면은 스토어 액션만 부른다.
 *
 * 문구 계약(수용 기준 10·11):
 * - PIN 말고 다른 해제 수단은 **한 글자도 언급하지 않는다**. 그런 수단은 전부 새 의존성을
 *   필요로 해 이 빌드에 없고, 없는 기능을 광고하지 않는다(푸시 토글이 expo-notifications
 *   부재를 정직하게 밝히는 관례와 같다).
 * - "완전한 보호"를 주장하지 않는다. 이 잠금이 막는 것은 곁눈질 하나뿐이며, 그 범위를
 *   APP_LOCK_SCOPE_NOTICE 한 문장이 말한다.
 * - PIN을 잊었을 때의 유일한 길이 로그아웃이라는 사실과, 그 로그아웃이 **아직 서버에 올라가지
 *   않은 기록을 지운다**는 사실을 켜기 전에 미리 말한다(잠금 화면과 같은 두 문장).
 *
 * ⚠️ 이 화면으로 오는 설정 메뉴 행(SET-002)은 트랙 C가 붙인다(§3). 지금은 `/settings/app-lock`
 * 라우트로 직접 도달한다.
 */

type Mode = "idle" | "enable" | "change" | "disable";

export default function AppLockSettingsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const hasSession = Boolean(accessToken) || isTestSession;

  const recordStatus = useAppLockStore((state) => state.recordStatus);
  const record = useAppLockStore((state) => state.record);
  const enabled = Boolean(record?.enabled);

  const [mode, setMode] = useState<Mode>("idle");
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasSession) return;
    void useAppLockStore.getState().load();
  }, [hasSession]);

  const resetForm = (next: Mode) => {
    setMode(next);
    setCurrentPin("");
    setNextPin("");
    setConfirmPin("");
    setNotice(null);
    setDone(null);
  };

  const fail = (message: string) => {
    setNotice(message);
    announceForA11y(message);
  };

  const succeed = (message: string) => {
    resetForm("idle");
    setDone(message);
    announceForA11y(message);
  };

  /**
   * 실패 결과 → 문구. 세 폼(켜기·변경·끄기)이 같은 판정을 지나므로 문구도 한 자리에서 고른다.
   *
   * 대기(`locked-out`)와 남은 횟수는 잠금 화면과 **같은** 기록에서 온다(GAP-058 #2) — 설정
   * 화면에서 무제한으로 찍어 보고 그 사이 오버레이만 기다리게 만들 수 없다.
   */
  const failureNotice = (result: AppLockMutationResult, nowMs: number): string => {
    const record = useAppLockStore.getState().record;
    if (result === "locked-out") return appLockLockoutNotice(appLockRemainingLockSeconds(record, nowMs));
    if (result === "wrong-pin") {
      // 방금 5회째를 채웠다면 이 문구가 곧바로 대기 안내로 바뀐다(같은 판정 한 벌).
      return record ? appLockWrongCurrentPinNotice(record, nowMs) : APP_LOCK_PIN_FORMAT_NOTICE;
    }
    if (result === "save-failed") return APP_LOCK_SAVE_FAILED_NOTICE;
    return APP_LOCK_PIN_FORMAT_NOTICE;
  };

  const submitEnable = async () => {
    if (nextPin !== confirmPin) {
      fail(APP_LOCK_PIN_MISMATCH_NOTICE);
      return;
    }
    const now = Date.now();
    setBusy(true);
    const result = await useAppLockStore.getState().enableLock(nextPin);
    setBusy(false);
    if (result === "ok") {
      succeed("앱 잠금을 켰어요.");
      return;
    }
    fail(failureNotice(result, now));
  };

  const submitChange = async () => {
    if (nextPin !== confirmPin) {
      fail(APP_LOCK_PIN_MISMATCH_NOTICE);
      return;
    }
    const now = Date.now();
    setBusy(true);
    const result = await useAppLockStore.getState().changePin(currentPin, nextPin, now);
    setBusy(false);
    if (result === "ok") {
      succeed("PIN을 바꿨어요.");
      return;
    }
    fail(failureNotice(result, now));
  };

  const submitDisable = async () => {
    const now = Date.now();
    setBusy(true);
    const result = await useAppLockStore.getState().disableLock(currentPin, now);
    setBusy(false);
    if (result === "ok") {
      succeed("앱 잠금을 껐어요.");
      return;
    }
    fail(failureNotice(result, now));
  };

  /**
   * "지금 잠그기"(GAP-058 #3). 이 잠금의 위협 모델이 "잠깐 빌려준 폰"인데 지금까지는 앱을
   * 60초 넘게 백그라운드에 둬야만 잠겼다 — 건네기 직전에 잠글 수단이 없었다.
   *
   * 화면을 옮기지 않는다: 오버레이가 전역이라 상태만 되돌리면 그 자리에서 덮인다.
   */
  const lockNow = () => {
    resetForm("idle");
    useAppLockStore.getState().lockNow();
    announceForA11y("앱을 잠갔어요. PIN을 입력해 주세요.");
  };

  const pinField = (label: string, value: string, onChange: (next: string) => void) => (
    <TextInput
      accessibilityLabel={label}
      keyboardType="number-pad"
      maxLength={APP_LOCK_PIN_LENGTH}
      onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
      placeholder="••••"
      placeholderTextColor={theme.colors.gray300}
      secureTextEntry
      style={pinInputStyle}
      value={value}
    />
  );

  return (
    <AppScreen>
      <View testID="screen-app-lock" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="설정"
          title={APP_LOCK_TITLE}
          subtitle="이 기기에서 앱을 열 때 PIN 4자리를 물어봐요"
          onBack={() => router.back()}
        />

        {!hasSession ? <EmptyStateCard title="로그인 후 이용할 수 있어요." actionLabel="확인" /> : null}

        {hasSession ? (
          <Card style={{ gap: 10 }}>
            <View style={rowStyle}>
              <Text style={rowTitleStyle}>{APP_LOCK_TITLE}</Text>
              {recordStatus === "unknown" ? (
                <StatusBadge label="확인 중" />
              ) : enabled ? (
                <StatusBadge label="켜짐" tone="success" />
              ) : (
                <StatusBadge label="꺼짐" />
              )}
            </View>
            {/* 이 잠금이 막는 것과 막지 못하는 것. 잠금 화면과 같은 한 문장을 쓴다. */}
            <Text style={rowSubtitleStyle}>{APP_LOCK_SCOPE_NOTICE}</Text>
            {recordStatus === "unreadable" ? (
              <Text style={errorTextStyle}>
                저장된 잠금 정보를 읽지 못했어요. 앱을 다시 시작해도 같으면 로그아웃한 뒤 다시 로그인해 주세요.
              </Text>
            ) : null}
            {done ? (
              <Text accessibilityLiveRegion="polite" style={doneTextStyle}>
                {done}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* PIN을 잊었을 때의 유일한 길과 그 대가. 켜기 전에 읽히도록 폼보다 위에 둔다. */}
        {hasSession ? (
          <Card style={{ gap: 6 }}>
            <Text style={rowTitleStyle}>PIN을 잊으면</Text>
            <Text style={rowSubtitleStyle}>로그아웃하고 다시 로그인하는 방법뿐이에요.</Text>
            <Text style={rowSubtitleStyle}>{APP_LOCK_LOGOUT_KEEPS_SERVER_DATA_NOTICE}</Text>
            <Text style={rowSubtitleStyle}>{APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE}</Text>
          </Card>
        ) : null}

        {hasSession && mode === "idle" ? (
          <View style={{ gap: theme.spacing.gap }}>
            {enabled ? (
              <>
                <PrimaryButton
                  accessibilityLabel={APP_LOCK_LOCK_NOW_A11Y_LABEL}
                  label={APP_LOCK_LOCK_NOW_LABEL}
                  onPress={lockNow}
                />
                <Text style={rowSubtitleStyle}>{APP_LOCK_LOCK_NOW_HINT}</Text>
                <SecondaryButton label="PIN 변경" onPress={() => resetForm("change")} />
                <SecondaryButton label="잠금 끄기" onPress={() => resetForm("disable")} />
              </>
            ) : (
              <PrimaryButton label="잠금 켜기" onPress={() => resetForm("enable")} />
            )}
          </View>
        ) : null}

        {hasSession && mode === "enable" ? (
          <Card style={{ gap: 12 }}>
            <Text style={rowTitleStyle}>새 PIN 4자리</Text>
            {pinField(APP_LOCK_PIN_INPUT_LABEL, nextPin, setNextPin)}
            <Text style={rowTitleStyle}>한 번 더 입력</Text>
            {pinField("PIN 4자리 다시 입력", confirmPin, setConfirmPin)}
            {notice ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {notice}
              </Text>
            ) : null}
            <PrimaryButton
              disabled={busy || nextPin.length !== APP_LOCK_PIN_LENGTH || confirmPin.length !== APP_LOCK_PIN_LENGTH}
              label="잠금 켜기"
              onPress={() => {
                void submitEnable();
              }}
            />
            <SecondaryButton label="취소" onPress={() => resetForm("idle")} />
          </Card>
        ) : null}

        {hasSession && mode === "change" ? (
          <Card style={{ gap: 12 }}>
            <Text style={rowTitleStyle}>지금 쓰는 PIN</Text>
            {pinField("지금 쓰는 PIN 4자리", currentPin, setCurrentPin)}
            <Text style={rowTitleStyle}>새 PIN 4자리</Text>
            {pinField(APP_LOCK_PIN_INPUT_LABEL, nextPin, setNextPin)}
            <Text style={rowTitleStyle}>한 번 더 입력</Text>
            {pinField("PIN 4자리 다시 입력", confirmPin, setConfirmPin)}
            {notice ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {notice}
              </Text>
            ) : null}
            <PrimaryButton
              disabled={
                busy ||
                currentPin.length !== APP_LOCK_PIN_LENGTH ||
                nextPin.length !== APP_LOCK_PIN_LENGTH ||
                confirmPin.length !== APP_LOCK_PIN_LENGTH
              }
              label="PIN 바꾸기"
              onPress={() => {
                void submitChange();
              }}
            />
            <SecondaryButton label="취소" onPress={() => resetForm("idle")} />
          </Card>
        ) : null}

        {hasSession && mode === "disable" ? (
          <Card style={{ gap: 12 }}>
            <Text style={rowTitleStyle}>지금 쓰는 PIN</Text>
            {pinField("지금 쓰는 PIN 4자리", currentPin, setCurrentPin)}
            <Text style={rowSubtitleStyle}>잠금을 끄면 앱을 열 때 PIN을 묻지 않아요.</Text>
            {notice ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {notice}
              </Text>
            ) : null}
            <PrimaryButton
              disabled={busy || currentPin.length !== APP_LOCK_PIN_LENGTH}
              label="잠금 끄기"
              onPress={() => {
                void submitDisable();
              }}
            />
            <SecondaryButton label="취소" onPress={() => resetForm("idle")} />
          </Card>
        ) : null}
      </View>
    </AppScreen>
  );
}

const rowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10,
  justifyContent: "space-between"
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

const errorTextStyle = {
  color: theme.colors.danger,
  fontSize: 12,
  lineHeight: 17
} as const;

const doneTextStyle = {
  color: theme.colors.coral[700],
  fontSize: 12,
  lineHeight: 17
} as const;

const pinInputStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  color: theme.colors.brown,
  fontSize: 22,
  letterSpacing: 8,
  paddingHorizontal: 16,
  paddingVertical: 12,
  textAlign: "center"
} as const;
