import { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { subscribeAppStateChange } from "../offline/connectivity";
import { isPixelLockBuild } from "../pixelLock/build-profile";
import { useAppLockStore } from "../stores/app-lock.store";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { theme } from "../theme";
import { announceForA11y, PrimaryButton, TextButton } from "../ui";
import { SkeletonCard } from "../ui/Skeleton";
import {
  APP_LOCK_COPY,
  APP_LOCK_FORGOT_PIN_LABEL,
  APP_LOCK_LOCKOUT_CLEARED_NOTICE,
  APP_LOCK_FORGOT_PIN_MESSAGE,
  APP_LOCK_FORGOT_PIN_TITLE,
  APP_LOCK_PIN_FORMAT_NOTICE,
  APP_LOCK_PIN_INPUT_LABEL,
  APP_LOCK_PIN_LENGTH,
  APP_LOCK_SCOPE_NOTICE,
  appLockLockoutNotice,
  appLockRemainingLockSeconds,
  appLockWrongPinNotice,
  isAppLockLockedOut,
  resolveAppLockGateStatus
} from "./app-lock";

/**
 * 라운드 55 트랙 B — 앱 잠금 오버레이 (docs/5차/round55-plan.md §2.4).
 *
 * **라우트가 아니라 오버레이다.** `app/lock.tsx`를 만들면 뒤로가기·딥링크·router.replace로
 * 우회 가능한 상태가 생긴다. 오버레이는 내비게이션 상태를 바꾸지 않으므로 우회 경로가 없다.
 * app/_layout.tsx에서 `<Stack>`과 `<PurchaseFollowupLifecycle/>` **뒤에** 마운트한다 —
 * 구매 확인 카드도 계정 데이터(품목명)를 전역 오버레이로 그리므로 그보다 위에 와야 덮는다.
 *
 * 잠금이 걸리지 않은 모든 상태(픽셀락·비세션·PIN 미설정)에서는 **null을 반환한다** — 기존 화면
 * 트리가 한 노드도 달라지지 않는다(수용 기준 2·6).
 *
 * AppState: 새 네이티브 구독을 만들지 않고 subscribeAppStateChange(FIX-118A의 단일 소스)에
 * 리스너를 하나 얹는다. 네이티브 리스너를 이 파일에서 직접 등록하지 않는 것이 계약이다
 * (src/security/app-lock-gate-contract.test.ts).
 *
 * ⚠️ 해제 수단은 PIN 하나뿐이다(수용 기준 10). 다른 잠금 해제 방식은 새 의존성을 필요로 하고
 * 이 빌드에 없다 — 없는 기능을 화면에서 광고하지 않는다.
 */
export function AppLockOverlay() {
  const pixelLockMode = isPixelLockBuild();
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  // 데모 세션도 잠근다(§2.7): 잠금은 계정이 아니라 이 기기에 대한 선택이다.
  const hasSession = Boolean(accessToken) || isTestSession;
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearSelectedChild = useSelectedChildStore((state) => state.clearSelectedChildId);

  const recordStatus = useAppLockStore((state) => state.recordStatus);
  const record = useAppLockStore((state) => state.record);
  const unlockedThisForeground = useAppLockStore((state) => state.unlockedThisForeground);

  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const status = resolveAppLockGateStatus({
    pixelLockMode,
    hasSession,
    recordStatus,
    enabled: record?.enabled ?? false,
    unlockedThisForeground
  });
  const blocking = status === "loading" || status === "locked" || status === "recovery";
  const lockedOut = status === "locked" && isAppLockLockedOut(record, nowMs);
  const wasLockedOutRef = useRef(false);

  /**
   * 대기 안내는 상태에 굳히지 않고 **매 렌더 계산한다**(GAP-058 P3).
   *
   * 문자열로 담아 두면 아래 1초 타이머가 다시 그려도 "N초 남았어요"의 N이 그대로 멈춰 있고,
   * 대기가 끝난 뒤까지 그 문장이 남는다 — 이미 입력할 수 있는데 기다리라고 말하는 거짓이 된다.
   * 남은 시간이 0이 되는 순간 이 값은 null이 되고, 아래 효과가 안내를 "이제 다시 입력할 수
   * 있어요."로 갈아 끼운다.
   */
  const lockoutNotice = lockedOut ? appLockLockoutNotice(appLockRemainingLockSeconds(record, nowMs)) : null;
  const displayedNotice = lockoutNotice ?? notice;

  // 세션이 생긴 뒤 1회 읽는다. 픽셀락/비세션에서는 SecureStore를 건드리지도 않는다.
  useEffect(() => {
    if (pixelLockMode || !hasSession) return;
    void useAppLockStore.getState().load();
  }, [hasSession, pixelLockMode]);

  // 백그라운드 왕복. 60초(APP_LOCK_GRACE_MS) 미만이면 잠기지 않는다 — 파일 피커·공유 시트·
  // 외부 브라우저 왕복이 매번 PIN을 묻게 만들지 않기 위해서다(§2.6).
  useEffect(() => {
    if (pixelLockMode || !hasSession) return;
    return subscribeAppStateChange((appState) => {
      const store = useAppLockStore.getState();
      if (appState === "active") {
        store.noteForegrounded(Date.now());
        return;
      }
      store.noteBackgrounded(Date.now());
    });
  }, [hasSession, pixelLockMode]);

  // 안드로이드 하드웨어 뒤로가기를 삼킨다(수용 기준 9). 오버레이가 떠 있는 동안만.
  useEffect(() => {
    if (!blocking) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [blocking]);

  // 대기 중에는 남은 초를 1초마다 다시 그린다. 대기가 아니면 타이머를 걸지 않는다.
  useEffect(() => {
    if (!lockedOut) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedOut]);

  /**
   * 대기 → 입력 가능으로 넘어가는 순간의 안내 갱신(GAP-058 P3). 위 타이머가 nowMs를 밀어
   * lockedOut이 false가 되면 여기서 문구를 다시 말한다 — 대기 안내를 읽고 기다리던 사람이
   * 화면을 다시 보지 않아도 되도록 낭독(announceForA11y)도 함께 한다.
   */
  useEffect(() => {
    if (lockedOut) {
      wasLockedOutRef.current = true;
      return;
    }
    const wasLockedOut = wasLockedOutRef.current;
    wasLockedOutRef.current = false;
    // 잠금이 아예 사라진 경우(해제·계정 전환)에는 아래 정리 효과가 안내를 비우는 것이 맞다.
    if (!wasLockedOut || status !== "locked") return;
    setNotice(APP_LOCK_LOCKOUT_CLEARED_NOTICE);
    announceForA11y(APP_LOCK_LOCKOUT_CLEARED_NOTICE);
  }, [lockedOut, status]);

  // 잠금이 풀리거나 사라지면 입력·안내를 비운다(다음 잠금에 이전 안내가 남지 않게).
  useEffect(() => {
    if (blocking) return;
    setPin("");
    setNotice(null);
  }, [blocking]);

  if (!blocking) return null;

  const submit = async () => {
    const now = Date.now();
    setNowMs(now);
    if (isAppLockLockedOut(record, now)) {
      // 문구 자체는 lockoutNotice가 매 렌더 계산한다(남은 초가 흐르도록). 여기서는 낭독만 한다.
      announceForA11y(appLockLockoutNotice(appLockRemainingLockSeconds(record, now)));
      return;
    }
    const result = await useAppLockStore.getState().submitPin(pin, now);
    if (result === "unlocked") {
      setPin("");
      setNotice(null);
      return;
    }
    setPin("");
    const nextRecord = useAppLockStore.getState().record;
    const message =
      result === "invalid-format"
        ? APP_LOCK_PIN_FORMAT_NOTICE
        : nextRecord
          ? appLockWrongPinNotice(nextRecord, now)
          : APP_LOCK_PIN_FORMAT_NOTICE;
    setNotice(message);
    announceForA11y(message);
  };

  /**
   * PIN 분실 탈출구(§2.6·수용 기준 7). 로그아웃은 PRIV-104 teardown을 발화시켜 **아직 서버에
   * 올라가지 않은 기록을 지운다** — 그 사실을 확인 다이얼로그에서 먼저 말한다.
   */
  const confirmForgotPin = () => {
    Alert.alert(APP_LOCK_FORGOT_PIN_TITLE, APP_LOCK_FORGOT_PIN_MESSAGE, [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          clearSession();
          clearSelectedChild();
          router.replace("/launch-animation");
        }
      }
    ]);
  };

  const copy = status === "recovery" ? APP_LOCK_COPY.recovery : status === "loading" ? APP_LOCK_COPY.loading : APP_LOCK_COPY.locked;

  return (
    <View testID="app-lock-overlay" style={overlayStyle}>
      <View style={{ gap: 8 }}>
        <Text style={titleStyle}>{copy.title}</Text>
        <Text style={bodyStyle}>{copy.body}</Text>
      </View>

      {status === "loading" ? (
        // 스켈레톤은 "불러오는 중" 라벨을 스스로 갖고 있어 위 문구와 겹친다 — 콜드 스타트
        // 홀딩 뷰와 같은 관례로 접근성 트리에서 감춘다(app/index.tsx).
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: theme.spacing.gap }}>
          <SkeletonCard />
        </View>
      ) : null}

      {status === "locked" ? (
        <View style={{ gap: 12 }}>
          <TextInput
            accessibilityLabel={APP_LOCK_PIN_INPUT_LABEL}
            autoFocus
            editable={!lockedOut}
            keyboardType="number-pad"
            maxLength={APP_LOCK_PIN_LENGTH}
            onChangeText={(value) => setPin(value.replace(/[^0-9]/g, ""))}
            placeholder="••••"
            placeholderTextColor={theme.colors.gray300}
            secureTextEntry
            style={pinInputStyle}
            value={pin}
          />
          <PrimaryButton
            disabled={lockedOut || pin.length !== APP_LOCK_PIN_LENGTH}
            label="잠금 해제"
            onPress={() => {
              void submit();
            }}
          />
        </View>
      ) : null}

      {/* 대기 중에는 계산된 남은 시간 안내가 먼저다 — 1초마다 N이 실제로 줄어든다. */}
      {displayedNotice ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={noticeStyle}>
          {displayedNotice}
        </Text>
      ) : null}

      {status === "loading" ? null : (
        <View style={{ gap: 10 }}>
          <TextButton label={APP_LOCK_FORGOT_PIN_LABEL} onPress={confirmForgotPin} />
          <Text style={scopeNoticeStyle}>{APP_LOCK_SCOPE_NOTICE}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * 불투명 전체 화면. `PurchaseFollowupLifecycle`의 카드(zIndex 30)보다 위에 온다.
 * pointerEvents를 열어 둔 채 화면 전체를 덮으므로 아래 화면의 터치가 통과하지 못한다.
 */
const overlayStyle = {
  backgroundColor: theme.colors.background,
  bottom: 0,
  gap: theme.spacing.section,
  justifyContent: "center",
  left: 0,
  padding: theme.spacing.screen,
  position: "absolute",
  right: 0,
  top: 0,
  zIndex: 100
} as const;

const titleStyle = {
  color: theme.colors.brown,
  fontSize: 20,
  fontWeight: "800"
} as const;

const bodyStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 19
} as const;

const pinInputStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  color: theme.colors.brown,
  fontSize: 24,
  letterSpacing: 8,
  paddingHorizontal: 16,
  paddingVertical: 14,
  textAlign: "center"
} as const;

const noticeStyle = {
  color: theme.colors.danger,
  fontSize: 13,
  lineHeight: 19
} as const;

const scopeNoticeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 17
} as const;
