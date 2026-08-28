import { useEffect, useRef, useState, type ReactNode } from "react";
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
 * 이 파일은 짝이 되는 조각 하나를 더 내보낸다: `AppLockScreenShield`(GAP-059 #3). 오버레이가
 * 화면을 덮어도 **접근성 트리는 z-order로 잘리지 않아** 뒤의 금액·품목명이 그대로 읽혔다.
 * 방패는 잠금을 켠 사람에게만 서고, PIN 미설정·픽셀락에서는 노드조차 만들지 않는다 —
 * 위 두 수용 기준은 그대로다(자세한 근거·대안 비교는 그 함수의 주석).
 *
 * AppState: 새 네이티브 구독을 만들지 않고 subscribeAppStateChange(FIX-118A의 단일 소스)에
 * 리스너를 하나 얹는다. 네이티브 리스너를 이 파일에서 직접 등록하지 않는 것이 계약이다
 * (src/security/app-lock-gate-contract.test.ts).
 *
 * ⚠️ 해제 수단은 PIN 하나뿐이다(수용 기준 10). 다른 잠금 해제 방식은 새 의존성을 필요로 하고
 * 이 빌드에 없다 — 없는 기능을 화면에서 광고하지 않는다.
 */
/**
 * 게이트 입력 조립 **한 자리**. 오버레이와 아래 방패(AppLockScreenShield)가 같은 판정을 봐야
 * 하므로 `resolveAppLockGateStatus`의 인자를 모으는 곳도 하나여야 한다 — 두 벌이 되면 "덮고
 * 있는데 뒤 트리는 열려 있는" 어긋남이 생긴다(라운드 52 QA P3-4가 판정표 이중화를 금지한 것과
 * 같은 이유).
 */
function useAppLockGate() {
  const pixelLockMode = isPixelLockBuild();
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  // 데모 세션도 잠근다(§2.7): 잠금은 계정이 아니라 이 기기에 대한 선택이다.
  const hasSession = Boolean(accessToken) || isTestSession;
  const recordStatus = useAppLockStore((state) => state.recordStatus);
  const enabled = useAppLockStore((state) => state.record?.enabled ?? false);
  const unlockedThisForeground = useAppLockStore((state) => state.unlockedThisForeground);

  const status = resolveAppLockGateStatus({
    pixelLockMode,
    hasSession,
    recordStatus,
    enabled,
    unlockedThisForeground
  });
  return {
    pixelLockMode,
    hasSession,
    enabled,
    status,
    blocking: status === "loading" || status === "locked" || status === "recovery"
  };
}

export function AppLockOverlay() {
  const { pixelLockMode, hasSession, status, blocking } = useAppLockGate();
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearSelectedChild = useSelectedChildStore((state) => state.clearSelectedChildId);

  const record = useAppLockStore((state) => state.record);

  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const lockedOut = status === "locked" && isAppLockLockedOut(record, nowMs);
  const wasLockedOutRef = useRef(false);
  const submittingRef = useRef(false);

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

  /**
   * 입력·안내는 **게이트 상태에 매인다**(GAP-059 P3 — 라운드 58이 "추측"으로 남긴 잔류 점검).
   *
   * 종전에는 `blocking`이 hinge였다. `blocking`은 loading·locked·recovery를 하나로 뭉친 값이라
   * **그 셋 사이의 이동에서는 변하지 않는다** — 즉 `locked`에서 "PIN이 맞지 않아요. 3번 더
   * 틀리면…"을 띄운 채 `recovery`로 넘어가면 그 문장이 그대로 남는다. recovery 화면에는 PIN
   * 입력칸도 [잠금 해제] 버튼도 없으므로(아래 `status === "locked"` 분기), 사용자는 입력할 곳도
   * 없는 화면에서 "다시 입력하라"는 말을 읽게 된다.
   *
   * 오늘 그 전이가 실제로 열려 있는가: `recordStatus`는 `loaded`가 된 뒤로 `unreadable`이 되지
   * 않는다(load()는 `unknown`일 때만 읽고, 3초 밸브도 `unknown`일 때만 닫는다). 그래서 지금
   * 코드에서 locked → recovery는 도달하지 않는다 — **잠재 결함**이다. 그래도 hinge를 옮기는
   * 이유는, 안내가 매인 대상이 "무언가 덮고 있다"가 아니라 "지금 이 상태에서 한 말"이기
   * 때문이다. 반대 방향(recovery → locked: 밸브가 닫은 뒤 진짜 읽기가 늦게 도착)은 이미
   * 도달 가능하고, 그때도 이전 상태의 문구를 들고 가지 않는다.
   *
   * 대기 만료 안내(위 효과)는 `status`가 그대로인 채 `lockedOut`만 false가 되는 전이라 이
   * 효과가 다시 돌지 않는다 — 방금 세운 문구를 스스로 지우지 않는다.
   */
  useEffect(() => {
    setPin("");
    setNotice(null);
  }, [status]);

  if (!blocking) return null;

  /**
   * PIN 제출 — 설정 화면과 **같은 모양의 busy 가드**를 단다(GAP-059 #7, 라운드 58 P3 재진단).
   *
   * 무엇이 실제 노출면인가(정확히): "실패 카운터가 유실된다"가 아니다. 카운터는
   * `registerFailedAttempt` → `setState`가 **동기로** 올리므로 두 번째 제출은 이미 올라간 값을
   * 읽는다(app-lock.store.ts의 judgeCurrentPin). 겹칠 때 실제로 상하는 것은 둘이다.
   * ① **SecureStore 역순 완료 경합** — 두 제출이 각자 `writeAppLockRecord`를 띄우면 나중에
   *    시작한 쓰기가 먼저 끝날 수 있고, 그러면 디스크에는 **더 낮은 failedCount·더 이른
   *    lockedUntilMs**가 남는다. 강제 종료로 대기를 우회할 수 없어야 한다는 수용 기준 5가 바로
   *    그 디스크 값에 걸려 있다.
   * ② **문구 되감김** — 두 제출이 각자 끝나면서 `setNotice`를 하므로, 나중에 도착한 응답이
   *    "4번 더 틀리면…"을 "3번 더 틀리면…" 뒤에 덮어써 남은 횟수가 거꾸로 흐른다.
   *
   * 그래서 가드는 두 겹이다: 여기(재진입 차단 + 버튼 비활성)와 스토어(`submitPin`의 동시 제출
   * 합류). `busy` 상태만으로는 **같은 틱의 이중 탭**을 막지 못한다 — 다시 그려지기 전에 두
   * 번째 onPress가 들어오므로 ref로 먼저 닫는다.
   */
  const submit = async () => {
    if (submittingRef.current) return;
    const now = Date.now();
    setNowMs(now);
    if (isAppLockLockedOut(record, now)) {
      // 문구 자체는 lockoutNotice가 매 렌더 계산한다(남은 초가 흐르도록). 여기서는 낭독만 한다.
      announceForA11y(appLockLockoutNotice(appLockRemainingLockSeconds(record, now)));
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    try {
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
    } finally {
      // 성공하면 이 컴포넌트는 곧 null을 반환하며 사라진다 — 그때의 setBusy는 no-op이다.
      submittingRef.current = false;
      setBusy(false);
    }
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
            disabled={busy || lockedOut || pin.length !== APP_LOCK_PIN_LENGTH}
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
 * 잠금 중 **뒤 화면 트리를 접근성 트리에서 가리는 방패** (GAP-059 #3).
 *
 * 무엇이 새고 있었나: 오버레이는 `<Stack>`·구매 확인 카드와 **형제**라서 z-order로만 위에
 * 온다. 접근성 트리는 z-order로 잘리지 않으므로, 화면은 덮여 있어도 TalkBack은 뒤에 남아 있는
 * 금액·품목명을 그대로 읽는다. 눈으로는 막혔는데 귀로는 열려 있는 상태였다.
 *
 * ── 왜 `<Stack>`에 prop을 얹지 않았나 (두 겹으로 불가) ──────────────────────────────────
 * ① 타입: expo-router의 `Stack`은 `withLayoutContext(NativeStackNavigator)`라 prop 타입이
 *    `NativeStackNavigatorProps`에서 나온다 — `importantForAccessibility`도
 *    `accessibilityElementsHidden`도 그 안에 없어 tsc가 거부한다.
 * ② 런타임: 설령 통과시켜도 내비게이터는 알려진 키만 빼고 나머지를 `NativeStackView`로 넘기는데
 *    (expo-router/build/fork/native-stack/createNativeStackNavigator.js), 그 뷰는
 *    `{ state, navigation, descriptors, describe }` 넷만 구조분해하고 **나머지를 버린다**
 *    (@react-navigation/native-stack의 NativeStackView.native.js). 즉 조용히 사라진다.
 * 그래서 남는 방법은 뒤 트리를 감싸는 노드 하나뿐이다.
 *
 * ── 왜 "잠금일 때만 감싸기"가 아닌가 ────────────────────────────────────────────────────
 * `locked ? <View>{children}</View> : children`은 잠금이 켜지고 꺼질 때마다 그 자리의 엘리먼트
 * 타입이 바뀌므로 **화면 트리 전체가 언마운트→재마운트된다**. react-navigation은 언마운트
 * 시점에 컨테이너 상태를 비우고 재마운트가 그것을 복구하므로 라우트 자체는 살아남지만
 * (@react-navigation/core의 useNavigationBuilder), 화면 컴포넌트의 로컬 상태는 전부 날아간다 —
 * 60초 자리를 비웠다가 돌아온 사람이 **쓰다 만 지출 입력**을 잃는다. 잠금이 지키려는 것이
 * 기록인데 잠금 때문에 기록을 잃게 만들 수는 없다.
 *
 * ── 그래서: 잠금이 켜져 있는 동안 **상시 마운트, prop만 토글** ──────────────────────────
 * - 방패는 `record.enabled`가 참일 때(또는 recovery) 한 번 켜지고, 그 프로세스에서는 내려오지
 *   않는다(단방향 래치). 잠금/해제 왕복에서는 노드가 그대로 있고 두 prop만 바뀌므로 재마운트가
 *   **한 번도** 일어나지 않는다. 래치를 되돌리지 않는 것도 같은 이유다 — 설정에서 잠금을 꺼도,
 *   비활성 노드 하나를 없애자고 화면 전체를 다시 그릴 이유가 없다.
 * - **PIN 미설정 사용자에게는 이 노드가 아예 생기지 않는다**(수용 기준 2: 앱 동작·화면 트리
 *   불변). 잠금을 켠 사람에게만, 켠 뒤에 생긴다.
 * - **픽셀락 이중 안전 분기**(수용 기준 6): `isPixelLockBuild()`는 빌드 상수이고 픽셀락 빌드는
 *   세션 자체가 없어 게이트가 항상 `inactive`다 — 잠금 경로는 애초에 돌지 않는다. 그래도 래치
 *   조건 맨 앞에서 한 번 더 끊어, 캡처 빌드의 뷰 계층에는 이 노드가 **존재할 수 없게** 한다
 *   (pixel:android:guard 기준선 무영향).
 * - 잔여 한 조각(정직 고지): 콜드 스타트에서 SecureStore 기록을 아직 못 읽은 `loading` 구간은
 *   기록을 읽기 전이라 래치가 켜질 수 없어 뒤 트리가 가려지지 않는다. 그 구간은 3초 밸브로
 *   상한이 잡혀 있고 뒤에 있는 것은 콜드 스타트 홀딩 화면이다. 이 구간까지 덮으려면 모든
 *   사용자의 부팅마다 방패를 붙였다 떼야 하고, 그것이 곧 위에서 물린 재마운트다.
 *
 * ⚠️ **실기기 미검증**: TalkBack/VoiceOver로 직접 확인하지 않았다. 여기 적은 근거는 전부
 * 코드상 확정 사실(위 두 라이브러리의 prop 처리, RN `View`의 두 prop 계약)이고, "실제로
 * 읽히지 않더라"는 실측은 아니다. 실기기 확인 항목으로 남긴다.
 */
export function AppLockScreenShield({ children }: { children: ReactNode }) {
  const { pixelLockMode, enabled, status, blocking } = useAppLockGate();

  // 단방향 래치. 구독한 상태에서 파생되므로 값이 참이 되는 그 렌더에서 곧바로 읽힌다.
  const shieldedRef = useRef(false);
  if (!pixelLockMode && (enabled || status === "recovery")) shieldedRef.current = true;
  if (!shieldedRef.current) return <>{children}</>;

  return (
    <View
      // iOS: 이 뷰의 하위 요소를 VoiceOver 트리에서 제외한다.
      accessibilityElementsHidden={blocking}
      // 뷰 평탄화로 네이티브 노드가 사라졌다 생기는 일이 없도록 못을 박는다 — prop만 바뀌어야 한다.
      collapsable={false}
      // Android: 하위 전체를 TalkBack 트리에서 제외한다.
      importantForAccessibility={blocking ? "no-hide-descendants" : "auto"}
      style={shieldStyle}
    >
      {children}
    </View>
  );
}

/** 레이아웃 통과용. 뒤 트리가 있던 자리를 그대로 채운다(부모는 SafeAreaProvider의 flex:1 뷰). */
const shieldStyle = { flex: 1 } as const;

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
