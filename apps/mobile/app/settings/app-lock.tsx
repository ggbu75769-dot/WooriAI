import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";
import {
  APP_LOCK_LOCK_NOW_A11Y_LABEL,
  APP_LOCK_LOCK_NOW_HINT,
  APP_LOCK_LOCK_NOW_LABEL,
  APP_LOCK_LOCKOUT_CLEARED_NOTICE,
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
  appLockWrongCurrentPinNotice,
  isAppLockLockedOut
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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const wasLockedOutRef = useRef(false);

  /**
   * 라운드 58 통합리뷰 P2-2 — 대기 안내는 **오버레이와 같은 패턴**이다(GAP-058 P3,
   * src/security/AppLockOverlay.tsx).
   *
   * 무엇이 잘못돼 있었나: 이 화면은 대기 문구를 `setNotice(...)`로 상태에 **굳혀** 두었다.
   * 문자열은 다시 계산되지 않으므로 "30초 남았어요"의 30이 그대로 멈춰 있고, 30초가 지나
   * 이미 입력할 수 있게 된 뒤에도 그 문장이 화면에 남았다 — 기다릴 필요가 없는 사람에게
   * 기다리라고 말하는 거짓이 된다(오버레이가 같은 이유로 이미 고친 결함이다).
   *
   * 그래서 같은 네 조각을 그대로 가져온다: 잠금 기록 구독(record) · 매 렌더 계산하는 안내 ·
   * 1초 타이머 · 대기가 끝나는 순간의 APP_LOCK_LOCKOUT_CLEARED_NOTICE. 대기·남은 횟수 판정은
   * 잠금 화면과 **같은 기록·같은 함수**를 지난다(입구가 둘이라고 시도 예산이 두 배가 되지 않게 —
   * GAP-058 #2).
   */
  const lockedOut = isAppLockLockedOut(record, nowMs);
  const lockoutNotice = lockedOut ? appLockLockoutNotice(appLockRemainingLockSeconds(record, nowMs)) : null;
  /** 대기 중에는 계산된 남은 시간이 먼저다 — 1초마다 N이 실제로 줄어든다. */
  const displayedNotice = lockoutNotice ?? notice;

  useEffect(() => {
    if (!hasSession) return;
    void useAppLockStore.getState().load();
  }, [hasSession]);

  // 대기 중에만 1초마다 다시 그린다(대기가 아니면 타이머를 걸지 않는다 — 오버레이와 같다).
  useEffect(() => {
    if (!lockedOut) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedOut]);

  /**
   * 대기 → 입력 가능으로 넘어가는 순간의 안내 갱신. 위 타이머가 nowMs를 밀어 lockedOut이
   * false가 되면 여기서 문구를 다시 말한다 — 대기 안내를 읽고 기다리던 사람이 화면을 다시
   * 보지 않아도 되도록 낭독(announceForA11y)도 함께 한다.
   *
   * 폼을 닫아 둔 상태(idle)에서는 말하지 않는다: 입력칸이 없는 화면에 "이제 다시 입력할 수
   * 있어요"만 떠 있으면 무엇에 대한 말인지 알 수 없다.
   */
  useEffect(() => {
    if (lockedOut) {
      wasLockedOutRef.current = true;
      return;
    }
    const wasLockedOut = wasLockedOutRef.current;
    wasLockedOutRef.current = false;
    if (!wasLockedOut || mode === "idle") return;
    setNotice(APP_LOCK_LOCKOUT_CLEARED_NOTICE);
    announceForA11y(APP_LOCK_LOCKOUT_CLEARED_NOTICE);
  }, [lockedOut, mode]);

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
      // 라운드 58 통합리뷰 P2-2: 그렇게 굳은 문자열도 대기 동안에는 위 lockoutNotice가 덮고,
      // 대기가 끝나는 순간 위 효과가 APP_LOCK_LOCKOUT_CLEARED_NOTICE로 갈아 끼운다.
      return record ? appLockWrongCurrentPinNotice(record, nowMs) : APP_LOCK_PIN_FORMAT_NOTICE;
    }
    if (result === "save-failed") return APP_LOCK_SAVE_FAILED_NOTICE;
    return APP_LOCK_PIN_FORMAT_NOTICE;
  };

  /**
   * 라운드 58 통합리뷰 P2-2 — 제출 직전에 "지금"을 다시 읽는다. 이 값이 낡아 있으면 남은 초가
   * 실제보다 길게 보이고(마지막 렌더 시점 기준) 대기 판정도 한 박자 늦는다.
   * 대기 중이면 스토어를 부르지 않는다: 그 호출은 정의상 `locked-out`으로 끝나고, 문구는 이미
   * 화면에 흐르고 있다(낭독만 한 번 더 한다 — 오버레이 submit과 같은 순서다).
   */
  const beginSubmit = (now: number): boolean => {
    setNowMs(now);
    if (isAppLockLockedOut(useAppLockStore.getState().record, now)) {
      announceForA11y(appLockLockoutNotice(appLockRemainingLockSeconds(useAppLockStore.getState().record, now)));
      return false;
    }
    return true;
  };

  const submitEnable = async () => {
    if (nextPin !== confirmPin) {
      fail(APP_LOCK_PIN_MISMATCH_NOTICE);
      return;
    }
    const now = Date.now();
    if (!beginSubmit(now)) return;
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
    if (!beginSubmit(now)) return;
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
    if (!beginSubmit(now)) return;
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
      // 라운드 58 통합리뷰 P2-2: 대기 중에는 입력칸도 잠근다(오버레이의 `editable={!lockedOut}`와
      // 같다). 받을 수 없는 입력을 받아 두면 사용자는 다 치고 나서야 막힌 것을 안다.
      editable={!lockedOut}
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

        {/* 라운드 71 트랙 E: 문구는 종전 그대로이고 **목적지 하나**가 더해진다 — 이 카드는
            "로그인 후 이용할 수 있어요"라고 말하면서 로그인으로 가는 길을 주지 않았고, [확인]은
            눌러도 아무 일도 일어나지 않는 가짜 버튼이었다(컴포넌트 타입이 그것을 허용했다). */}
        {!hasSession ? (
          <EmptyStateCard title="로그인 후 이용할 수 있어요." actionLabel="확인" onPress={() => router.push("/login")} />
        ) : null}

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
            {displayedNotice ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {displayedNotice}
              </Text>
            ) : null}
            <PrimaryButton
              disabled={busy || lockedOut || nextPin.length !== APP_LOCK_PIN_LENGTH || confirmPin.length !== APP_LOCK_PIN_LENGTH}
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
            {displayedNotice ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {displayedNotice}
              </Text>
            ) : null}
            <PrimaryButton
              disabled={
                busy ||
                lockedOut ||
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
            {displayedNotice ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {displayedNotice}
              </Text>
            ) : null}
            <PrimaryButton
              disabled={busy || lockedOut || currentPin.length !== APP_LOCK_PIN_LENGTH}
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
