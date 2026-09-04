import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { trackAndFlushAnalyticsEvent } from "../analytics/client";
import { buildPurchaseFollowupAnsweredPayload, type PurchaseFollowupAnswer } from "../analytics/events";
import { LOCAL_SESSION_TOKEN } from "../api/client";
import { EXPENSE_ENTRY_SOURCE_PARAM } from "../expenses/post-save-destination";
import { useExpenseEntryGate } from "../family/useExpenseEntryGate";
import { isPixelLockBuild } from "../pixelLock/build-profile";
import { resolveAppLockGateStatus } from "../security/app-lock";
import { useAppLockStore } from "../stores/app-lock.store";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { announceForA11y, Card, PrimaryButton, SecondaryButton, TextButton } from "../ui";
// T10(토스급): 등장 스프링·퇴장 페이드는 공용 reduce-motion 훅을 존중한다(직접 조회 복붙 금지 —
// state-screen-conventions.test.ts의 단일 소스 계약).
import { useReducedMotion } from "../ui/useReducedMotion";
import { theme } from "../theme";
import { isPurchaseFollowupHeldByAppLock } from "./purchase-followup-resolution";
import { createPurchaseFollowupSessionGate, evaluateFollowupPrompt, followupSessionKey } from "./purchase-followup-session";
import {
  createPurchaseFollowupEligibilityTimer,
  isFollowupForSelectedChild,
  purchaseFollowupMerchantLabel,
  usePurchaseFollowupStore,
  type PurchaseFollowupEntry
} from "./purchase-followup.store";

/**
 * COM-108 구매 확인 루프: mounted once at the app root (app/_layout.tsx, right after <Stack> so
 * it overlays every screen -- same lifetime pattern as OfflineSyncLifecycle). On cold start
 * (post-rehydration) and on every foreground return (AppState 'active') it checks the persisted
 * purchase-followup store for a pending product-link click that is 3min–24h old and, at most
 * once per app session per click, shows a non-blocking bottom card asking 구매하셨나요?.
 *
 * 라운드 81 트랙 B(자격 도래 타이머): 그 두 순간에 더해, 판정이 돌 때마다 **다음 자격 도래
 * 시각**에 한 번 더 판정하도록 일회용 타이머를 건다(자격 창이 앱 안에서 열리는 세션을 통째로
 * 놓치던 자리 — 술어는 purchase-followup.store.ts의 nextPromptEligibleDelayMs).
 *
 * Never blocks navigation: the overlay wrapper uses pointerEvents="box-none" so only the card
 * itself is touchable, and the component renders null (and attaches no listeners) whenever
 * there is no real/demo session -- preview & logged-out states stay completely inert.
 *
 * 라운드 39 UX-O(아이 스코프): 이 카드는 전역 오버레이라 **아이를 전환해도 그대로 떠 있었다**.
 * 그 상태에서 "샀어요"를 누르면 A의 클릭이 B의 지출로 기록되고 B의 준비템까지 준비 완료가
 * 된다(R19-B). 이제 후보 판정(selectPromptEligibleFollowup)과 렌더 둘 다 지금 선택된 아이를
 * 함께 본다 -- 판정 규칙과 그 근거는 purchase-followup.store.ts의 isFollowupForSelectedChild에.
 */

/**
 * Clicks already prompted in this app session (module-level on purpose: survives remounts of
 * the lifecycle component but resets on every cold start, which is exactly the "not yet
 * prompted this session" gate). Keyed by click identity, so a fresh re-click may prompt again.
 *
 * 라운드 39 I-3: 게이트와 판정 자체는 src/commerce/purchase-followup-session.ts에 있다 — 아이
 * A↔B 왕복(A 표시 → B 후보 표시 → A 복귀 재표시)을 단위 테스트로 고정하기 위해서다. 이 파일은
 * 그 순수 판정을 스토어·AppState·화면 상태에 꽂기만 한다.
 */
const promptSessionGate = createPurchaseFollowupSessionGate();

const purchaseFollowupOverlayStyle = {
  bottom: 28,
  left: 16,
  position: "absolute",
  right: 16,
  zIndex: 30
} as const;

/**
 * T10(토스급) — 등장·퇴장 모션의 이동 거리(dp). 카드가 아래에서 12dp 떠오르며 서고, 내려갈 때
 * 같은 거리로 가라앉는다. 값이 크면 오버레이가 화면을 가로지르는 것처럼 보이고, 작으면 페이드와
 * 구분되지 않는다 — 바텀 카드 하나 높이 안에서 끝나는 최소의 이동이다.
 */
const FOLLOWUP_CARD_RISE_DP = 12;

/** 퇴장 페이드 길이(ms). 등장 스프링과 달리 답을 이미 받은 카드라 짧게 물러난다. */
const FOLLOWUP_CARD_EXIT_MS = 120;

/** 퇴장 잔상의 버튼이 받는 핸들러 — 잔상은 pointerEvents="none"이라 실제로는 불리지 않는다. */
function noopFollowupAnswer() {
  return undefined;
}

/**
 * T10 — 카드의 **보이는 부분** 한 벌. 살아 있는 카드와 퇴장 잔상(답을 받고 120ms 페이드로
 * 내려가는 그 프레임)이 같은 픽셀을 그리기 위해 공유한다 — 두 벌로 적으면 잔상이 원본과
 * 미세하게 다른 카드로 깜빡인다. 판정·핸들러 내용은 전부 호출부(라이프사이클 컴포넌트)에
 * 남는다: 이 컴포넌트는 문장 셋과 버튼 셋을 그리기만 한다.
 */
function FollowupCardContent({
  entry,
  onPurchased,
  onNotYet,
  onDismiss
}: {
  entry: PurchaseFollowupEntry;
  onPurchased: () => void;
  onNotYet: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card style={{ backgroundColor: theme.colors.mint }}>
      <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
        {`『${entry.itemName}』 구매하셨나요?`}
      </Text>
      {entry.priceBandText ? (
        <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{entry.priceBandText}</Text>
      ) : null}
      <PrimaryButton label="샀어요" onPress={onPurchased} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SecondaryButton label="아직이요" onPress={onNotYet} style={{ flex: 1 }} />
        <TextButton label="괜찮아요" onPress={onDismiss} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export function PurchaseFollowupLifecycle() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  // Demo/test sessions count too: this is a pure client feature (see the store's doc comment).
  const hasSession = Boolean(accessToken) || isTestSession;
  // UX-R(M): "샀어요"는 지출 생성 화면으로 가는 입구다. 보기 전용 참여자에게는 그 저장이
  // 403으로 막히므로 같은 판정으로 안내한다. 훅이라 아래 조기 반환들보다 위에 있어야 한다.
  const expenseGate = useExpenseEntryGate();
  /**
   * 라운드 27 L-2: 이벤트 발사에 쓰는 토큰은 화면들과 **같은 관례**로 고른다
   * (app/items/[itemTemplateId].tsx, app/(tabs)/records.tsx의 `authToken`).
   *
   * 예전에는 `accessToken`을 그대로 넘겨서, 데모 세션(accessToken=null·isTestSession)에서 누른
   * 답변이 큐에만 쌓였다가 **나중에 실계정으로 로그인한 순간 실토큰으로 전송**될 수 있었다
   * (src/analytics/client.ts의 flushAnalyticsQueue는 큐를 세션별로 나누지 않는다). 데모 세션은
   * 데모 토큰으로 곧바로 flush를 시도하고 실패하면 그 자리에서 버려지는 편이 맞다 --
   * 데모에서 누른 답변이 실계정 통계에 섞이는 것이 훨씬 나쁘다.
   */
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  /**
   * 지금 선택된 아이. 값이 바뀌면 아래 effect가 다시 돌아 **그 아이의 대기 항목**을 새로
   * 판정한다 -- 아이 전환은 앱 안에서 일어나므로 AppState "active"가 뜨지 않아 이 구독이
   * 없으면 아이로 돌아와도 다음 포그라운드 복귀까지 카드가 나타나지 않는다.
   */
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  /**
   * 라운드 60 트랙 B(#6) — 지금 앱 잠금 오버레이가 화면을 덮고 있는가. **읽기만 한다**:
   * 이 컴포넌트는 app-lock 스토어에 아무것도 쓰지 않고, 잠금 규칙도 다시 적지 않는다 —
   * 상태 판정은 저장소의 단일 소스(resolveAppLockGateStatus)가, "그래서 카드를 보류하는가"는
   * 순수 함수 하나(isPurchaseFollowupHeldByAppLock)가 갖는다.
   *
   * 왜 필요한가: 이 카드는 콜드 스타트·포그라운드 복귀에 **스스로** 뜨는데 그 두 순간이 곧
   * 잠금이 PIN을 묻는 순간이다. 카드가 그 뒤에서 판정되면 아래 announceForA11y가 잠긴 화면
   * 위로 품목명 원문을 읽어 준다(오버레이도 접근성 방패도 명령형 낭독은 막지 못한다).
   *
   * 게이트 입력 다섯은 AppLockOverlay의 useAppLockGate와 **같은 값**이다. hasSession은 이미
   * 위에서 같은 규칙으로 만들었고(실토큰 또는 데모 세션), 픽셀락 판정도 저장소의 단일
   * 소스(isPixelLockBuild)에서 온다.
   */
  const appLockRecordStatus = useAppLockStore((state) => state.recordStatus);
  const appLockEnabled = useAppLockStore((state) => state.record?.enabled ?? false);
  const appLockUnlockedThisForeground = useAppLockStore((state) => state.unlockedThisForeground);
  const appLockHeld = isPurchaseFollowupHeldByAppLock(
    resolveAppLockGateStatus({
      pixelLockMode: isPixelLockBuild(),
      hasSession,
      recordStatus: appLockRecordStatus,
      enabled: appLockEnabled,
      unlockedThisForeground: appLockUnlockedThisForeground
    })
  );
  const snoozeFollowup = usePurchaseFollowupStore((state) => state.snoozeFollowup);
  // 라운드 60 리뷰(P2-10): "샀어요" 이탈 재질문도 답변 예산을 쓴다(스토어의 순수 규칙 재사용).
  const intendPurchaseFollowup = usePurchaseFollowupStore((state) => state.intendPurchaseFollowup);
  const dismissFollowup = usePurchaseFollowupStore((state) => state.dismissFollowup);
  const [activeFollowup, setActiveFollowup] = useState<PurchaseFollowupEntry | null>(null);
  /**
   * 판정은 effect 안에서 도는데(AppState 리스너·rehydration 콜백) 그 판정이 "지금 떠 있는 카드"를
   * 알아야 한다 — 상태를 의존성에 넣으면 카드가 뜰 때마다 리스너를 다시 걸게 되므로 ref로 읽는다.
   */
  const activeFollowupRef = useRef<PurchaseFollowupEntry | null>(null);
  /**
   * T10(토스급) — 카드 모션 상태. 등장은 스프링(불투명도 + 12dp 떠오름), 퇴장은 120ms 페이드다.
   * 판정 로직은 한 글자도 지나지 않는다: 모션이 읽는 것은 이미 내려진 판정(activeFollowup)뿐이고,
   * 잔상(exitingFollowup)은 **답을 받은 카드**(closeCard)만 남긴다 — 아이 전환·앱 잠금·세션 종료로
   * 내려가는 카드는 종전처럼 즉시 사라진다(그 셋은 보안·정합의 가드라 잔상을 남기면 안 된다).
   * reduce-motion이면 등장은 정착 상태로 곧장 서고 잔상은 아예 만들지 않는다.
   */
  const reduceMotionEnabled = useReducedMotion();
  const [exitingFollowup, setExitingFollowup] = useState<PurchaseFollowupEntry | null>(null);
  const enterMotion = useRef(new Animated.Value(1)).current;
  const exitMotion = useRef(new Animated.Value(0)).current;
  // 등장 리플레이의 키는 세션 게이트가 쓰는 그 키다(followupSessionKey) — 같은 카드가 재렌더로
  // 참조만 바뀌어도 스프링이 다시 튀지 않고, 다른 카드(다른 클릭)가 서면 새로 떠오른다.
  const activeFollowupKey = activeFollowup ? followupSessionKey(activeFollowup) : null;

  useEffect(() => {
    if (!activeFollowupKey) return;
    // 새 카드가 서면 이전 답의 잔상은 곧바로 내린다(두 카드가 겹쳐 그려지지 않게).
    setExitingFollowup(null);
    if (reduceMotionEnabled) {
      enterMotion.setValue(1);
      return;
    }
    enterMotion.setValue(0);
    const spring = Animated.spring(enterMotion, {
      friction: 8,
      tension: 64,
      toValue: 1,
      useNativeDriver: true
    });
    spring.start();
    return () => spring.stop();
  }, [activeFollowupKey, reduceMotionEnabled, enterMotion]);

  useEffect(() => {
    if (!exitingFollowup) return;
    if (reduceMotionEnabled) {
      setExitingFollowup(null);
      return;
    }
    exitMotion.setValue(1);
    const timing = Animated.timing(exitMotion, {
      duration: FOLLOWUP_CARD_EXIT_MS,
      toValue: 0,
      useNativeDriver: true
    });
    // 완주한 페이드만 잔상을 지운다 — cleanup의 stop()은 finished:false로 끝나 setState가 없다.
    timing.start(({ finished }) => {
      if (finished) setExitingFollowup(null);
    });
    return () => timing.stop();
  }, [exitingFollowup, reduceMotionEnabled, exitMotion]);

  useEffect(() => {
    if (!hasSession) {
      activeFollowupRef.current = null;
      setActiveFollowup(null);
      return;
    }
    /**
     * 라운드 60 트랙 B(#6): 잠금이 덮고 있는 동안에는 **판정 자체를 하지 않는다**. 리스너도
     * 걸지 않는다 — 잠긴 사이에 온 "active"로 후보를 골라 두면 세션 표출 예산(takeSlot)만
     * 소진되고 사용자는 그 물음을 본 적이 없다. 잠금이 풀리면 이 effect가 다시 돌아
     * (appLockHeld가 의존성이다) 조건이 여전한 항목을 그때 판정한다.
     */
    if (appLockHeld) return;
    /**
     * 라운드 81 트랙 B — **자격 창이 열리는 순간을 보고 있는다.**
     *
     * 아래 방아쇠 셋(하이드레이션 · `AppState "active"` · 의존성 변화)은 전부 사용자가 앱 밖에서
     * 무언가를 한 순간이라, 링크를 누르고 3분 안에 돌아온 사람에게는 그 세션 내내 판정이 다시
     * 서지 않았다(자격은 14분째 갖춰져 있는데도). 그래서 판정이 돌 때마다 **다음 자격 도래
     * 시각에 한 번 깨우는 일회용 타이머**를 다시 건다 — 창 상수도, 세션 슬롯도, 아이 게이트도
     * 한 글자도 약해지지 않는다. 타이머가 하는 일은 "그때 다시 물어본다" 하나다.
     */
    /**
     * 라운드 81 리뷰(M-1) — **타이머가 발화해도 앱이 뒤에 있으면 판정하지 않는다.**
     *
     * 위 앱 잠금 게이트(appLockHeld)는 백그라운드를 덮지 못한다: `unlockedThisForeground`는
     * `noteForegrounded`에서만 false가 되므로, 앱이 백그라운드로 내려간 것만으로는 이 effect가
     * 다시 돌지 않는다. 그런데 타이머는 안드로이드에서 백그라운드에도 발화할 수 있고, 그때
     * `check()`가 돌면 **사용자가 본 적 없는 물음이 세션 표출 슬롯(takeSlot)을 쓰고** 아래 낭독
     * effect가 announcedKeyRef까지 소모한다 — 나중에 실제로 카드를 볼 때는 슬롯도 낭독 기억도
     * 이미 쓰인 뒤라, 스크린리더 사용자에게는 그 물음이 영영 소리로 오지 않는다.
     *
     * 그래서 앞에 있지 않으면 **아무것도 하지 않고 넘긴다**(다시 걸지도 않는다). 남은 판정은
     * 다음 `"active"`가 맡는다 — 그 방아쇠는 아래 리스너가 이미 들고 있고, 그 자리에서 판정이
     * 다시 돌며 타이머도 다시 걸린다. 즉 이 가드가 잃는 것은 없고, 백그라운드에서 조용히
     * 소모되던 두 자원만 지켜진다.
     */
    const eligibilityTimer = createPurchaseFollowupEligibilityTimer(() => {
      if (AppState.currentState !== "active") return;
      check();
    });
    const check = () => {
      const now = Date.now();
      // 라운드 39 I-3: 아이가 바뀌어 가려진 카드는 세션 슬롯을 돌려받고 내려간다 — 그래야 그
      // 아이로 돌아왔을 때 다시 묻는다(규칙과 근거는 purchase-followup-session.ts).
      const next = evaluateFollowupPrompt({
        gate: promptSessionGate,
        active: activeFollowupRef.current,
        entries: usePurchaseFollowupStore.getState().entries,
        now,
        selectedChildId
      });
      activeFollowupRef.current = next;
      setActiveFollowup(next);
      // 판정이 끝난 자리에서 다음 깨움을 다시 건다(이전 타이머는 그 안에서 해제된다 --
      // 포그라운드 복귀로 판정이 다시 돌아도 타이머가 겹쳐 쌓이지 않는다).
      eligibilityTimer.schedule(usePurchaseFollowupStore.getState().entries, now, selectedChildId);
    };
    // Cold start: only check once the persisted entries have actually rehydrated -- checking the
    // (still-empty) initial state would silently miss the stored click.
    if (usePurchaseFollowupStore.persist.hasHydrated()) check();
    const unsubscribeHydration = usePurchaseFollowupStore.persist.onFinishHydration(() => check());
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") check();
    });
    return () => {
      unsubscribeHydration();
      subscription.remove();
      // 언마운트·의존성 변화(세션 종료·아이 전환·앱 잠금)에서 반드시 해제한다 -- 지난 판정이
      // 걸어 둔 깨움이 살아남으면 이미 무효가 된 조건으로 판정이 한 번 더 돈다.
      eligibilityTimer.clear();
    };
  }, [hasSession, selectedChildId, appLockHeld]);

  /**
   * 이번 앱 세션에 이미 낭독한 카드의 키(라운드 60 트랙 B #6). 아래 effect의 의존성에 잠금
   * 상태가 들어오면서, 잠금이 걸렸다 풀리는 것만으로 **같은 카드가 두 번 읽힐** 수 있게 됐다 --
   * 사용자에게는 새 물음이 하나 더 생긴 것처럼 들린다. 키는 세션 게이트가 쓰는 그 키다
   * (followupSessionKey -- 같은 준비템의 새 클릭은 다른 키라 다시 읽어 준다).
   */
  const announcedKeyRef = useRef<string | null>(null);

  // A11Y-115: the card overlays the bottom of whatever screen the user is on, so a screen-reader
  // user gets an audible cue when it appears instead of discovering it by chance.
  //
  // 라운드 60 트랙 B(#6): 잠금이 덮고 있는 동안에는 읽지 않는다. 위 판정이 이미 보류되므로
  // 새 카드가 뜨는 일은 없지만, **이미 떠 있던 카드**가 잠금을 만나는 경로가 남는다(설정의
  // "지금 잠그기", 60초를 넘긴 백그라운드 복귀). 그때 이 낭독이 나가면 잠긴 화면 위로 품목명
  // 원문이 새는 것은 마찬가지다.
  //
  // 라운드 60 리뷰(P2-1): 억제 범위는 **잠금 전이 하나**다. 종전에는 키가 한 번 기억되면
  // 앱 세션 내내 남아서, 아이 전환으로 카드가 내려갔다가 그 아이로 돌아와 **다시 선** 카드도
  // 낭독되지 않았다(라운드 39 I-3이 슬롯을 돌려주며 되살린 그 재표출이다). 화면에 새로 뜬
  // 물음을 스크린리더 사용자만 듣지 못하는 상태라, 억제가 잡으려던 것(잠금이 걸렸다 풀리는
  // 것만으로 같은 카드가 두 번 읽히는 일)보다 넓게 잡고 있었다.
  //
  // 그래서 **카드가 내려갈 때 기억을 지운다**: 내려간 카드가 다시 서면 그것은 새 물음이다.
  // 잠금 보류(appLockHeld)는 카드를 내리지 않으므로(첫 effect가 판정 자체를 건너뛴다) 기억이
  // 그대로 남고, 풀린 뒤 같은 카드는 여전히 다시 읽히지 않는다.
  //
  // 라운드 81 리뷰(M-1): 낭독 기억은 **카드가 실제로 그려지는 프레임에서만** 소모한다. 아래
  // 두 가드는 렌더의 조기 반환 둘과 같은 술어다(잠금 보류 · 아이 게이트) -- 그리지 않는 프레임에
  // 키를 적어 두면 그 카드는 나중에 화면에 서도 다시는 읽히지 않는다. 두 가드의 차이는 기억을
  // 지우느냐다: 잠금은 카드를 내리지 않으므로 기억을 그대로 두고(풀린 뒤 같은 카드는 다시 읽지
  // 않는다), 아이 전환은 첫 effect가 곧 activeFollowup을 비워 기억을 지운다(그 아이로 돌아와
  // 다시 선 카드는 새 물음이다 -- 위 P2-1 문단).
  useEffect(() => {
    if (!activeFollowup) {
      announcedKeyRef.current = null;
      return;
    }
    if (appLockHeld) return;
    if (!isFollowupForSelectedChild(activeFollowup, selectedChildId)) return;
    const key = followupSessionKey(activeFollowup);
    if (announcedKeyRef.current === key) return;
    announcedKeyRef.current = key;
    announceForA11y(`『${activeFollowup.itemName}』 구매하셨나요?`);
  }, [activeFollowup, appLockHeld, selectedChildId]);

  /**
   * T10 — 답을 받고 내려가는 카드의 120ms 잔상. pointerEvents="none"이라 어떤 탭도 받지 않고
   * (핸들러는 형식상의 no-op), 스토어·판정에는 아무 흔적이 없다 — 아래 정식 가드 셋(세션 · 잠금 ·
   * 아이 스코프)과 같은 술어를 그대로 지나야만 그려지므로, 잠금 화면 위나 다른 아이의 화면에
   * 잔상이 남는 일도 없다.
   */
  if (
    hasSession &&
    !activeFollowup &&
    exitingFollowup &&
    !appLockHeld &&
    isFollowupForSelectedChild(exitingFollowup, selectedChildId)
  ) {
    return (
      <View pointerEvents="none" style={purchaseFollowupOverlayStyle}>
        <Animated.View
          style={{
            opacity: exitMotion,
            transform: [
              {
                translateY: exitMotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [FOLLOWUP_CARD_RISE_DP, 0]
                })
              }
            ]
          }}
        >
          <FollowupCardContent
            entry={exitingFollowup}
            onPurchased={noopFollowupAnswer}
            onNotYet={noopFollowupAnswer}
            onDismiss={noopFollowupAnswer}
          />
        </Animated.View>
      </View>
    );
  }

  if (!hasSession || !activeFollowup) return null;
  /**
   * 라운드 60 트랙 B(#6): 잠금 중에는 그리지도 않는다. 오버레이가 어차피 위를 덮지만, 덮고
   * 있다는 사실에 기대는 대신 이 카드가 스스로 물러난다 -- 대기 항목은 그대로 pending이고
   * 잠금이 풀리면 같은 카드가 다시 선다(위 두 effect가 그때 다시 돈다).
   */
  if (appLockHeld) return null;
  /**
   * 렌더 시점의 아이 게이트(라운드 39 UX-O). 후보 판정에서 이미 걸렀지만, 카드가 떠 있는 동안
   * 설정에서 아이를 바꾸면 화면에 남은 카드가 다른 아이의 것이 된다 -- 그 한 프레임에 "샀어요"를
   * 누르면 바로 오기록이므로 그리지 않는다. 스토어의 대기 항목은 여전히 pending이고, 아이 전환은
   * 위 effect를 다시 돌려 이 카드의 세션 슬롯을 돌려주므로(라운드 39 I-3) **그 아이로 돌아오면
   * 같은 카드가 다시 보인다** -- 종전에는 그 슬롯이 잠긴 채라 세션 내내 다시 뜨지 않았다.
   */
  if (!isFollowupForSelectedChild(activeFollowup, selectedChildId)) return null;

  /**
   * 카드를 화면에서 내린다. 세션 슬롯은 **그대로 잡아 둔다** -- 이 앱 세션에는 이미 물었고
   * 답(또는 답하러 가는 행동)을 받았으므로 같은 물음을 다시 세우지 않는다.
   */
  const closeCard = () => {
    // T10: 판정·스토어 상태는 종전 그대로다 — 답을 받은 카드가 화면에서 내려가는 120ms 잔상만
    // 여기서 준비한다(reduce-motion이면 잔상 없이 곧장 내려간다).
    if (!reduceMotionEnabled) setExitingFollowup(activeFollowup);
    activeFollowupRef.current = null;
    setActiveFollowup(null);
  };

  const closeWith = (action: (itemTemplateId: string) => void) => {
    action(activeFollowup.itemTemplateId);
    // 답을 받은 항목이다 -- 스토어 상태도 pending을 벗어난다.
    closeCard();
  };

  /**
   * ANA-127: purchase_followup_answered -- the last funnel stage, and until now the only step of
   * the purchase loop with no instrumentation at all, which is what made 링크 클릭 -> 구매 전환율
   * uncomputable. All three answers fire (an "아직이요"/"괜찮아요" is a real answer, and dropping
   * them would silently inflate the purchase rate). Payload is the answer enum plus the clicked
   * link's platform -- never the item name, price band or child id. A no-op without ANA-102
   * consent (src/analytics/flag.ts), same gate every other event goes through.
   */
  const trackAnswer = (answer: PurchaseFollowupAnswer) => {
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "purchase_followup_answered",
      payload: buildPurchaseFollowupAnsweredPayload({ answer, platform: activeFollowup.platform }),
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  };

  return (
    <View pointerEvents="box-none" style={purchaseFollowupOverlayStyle}>
      {/* T10: 등장 스프링(불투명도 + 12dp 떠오름). reduce-motion이면 위 effect가 정착 상태(1)로
          곧장 세워 전이가 없다. 카드의 픽셀 자체는 FollowupCardContent 한 벌 그대로다. */}
      <Animated.View
        style={{
          opacity: enterMotion,
          transform: [
            {
              translateY: enterMotion.interpolate({
                inputRange: [0, 1],
                outputRange: [FOLLOWUP_CARD_RISE_DP, 0]
              })
            }
          ]
        }}
      >
        <FollowupCardContent
          entry={activeFollowup}
          onPurchased={() => {
            // Same route params as the item-detail "지출 기록하고 준비 완료" action, so
            // app/expenses/new.tsx prefills the item name and records the expense with
            // linkedItemTemplateId (analytics source becomes "followup"). Not edited here.
            // R19-B: 그 덕분에 이 "샀어요" 경로도 저장 시 서버가 준비템을 준비 완료로
            // 올리는 동일한 효과를 얻는다 -- 여기서 별도 상태 API를 부르지 않는다.
            // 잠긴 세션에서는 카드를 닫지도, 답변을 기록하지도 않는다 -- 아직 답하지 않은
            // 물음이라 다음에 다시 물어야 하고, "샀어요"는 여기서 실행되지 않았다.
            if (expenseGate.locked) {
              expenseGate.explain();
              return;
            }
            const { itemName, itemTemplateId } = activeFollowup;
            /**
             * 라운드 49 C-06(b): 이 카드는 **이미 알고 있는 사실**을 기록 화면에 넘긴다.
             * 지금까지는 품목 이름과 준비템 id만 넘기고, 어느 플랫폼의 어느 링크를 눌러
             * 산 것인지는 이 자리에서 그냥 버렸다 -- 그래서 사용자가 방금 쿠팡에서 산
             * 물건인데도 판매처 칸이 비어 있었고(사용자가 다시 타이핑해야 했다), 지출과
             * 제휴 링크를 잇는 열(linkedProductLinkId)은 영원히 비어 있었다.
             *
             * 두 값 모두 **사실만** 넘긴다: 판매처는 플랫폼을 아는 경우에만
             * (custom 링크는 상호를 모르므로 넘기지 않는다 -- purchaseFollowupMerchantLabel),
             * 링크 id는 대기 항목에 실제로 기록돼 있을 때만. 판매처는 프리필이라 기록
             * 화면에서 사용자가 지우거나 고쳐 쓸 수 있다.
             *
             * ⚠️ DNC-009: linkedProductLinkId는 기록·정산용이다 -- 추천 점수·정렬로
             * 흘러가면 안 된다.
             */
            const merchant = purchaseFollowupMerchantLabel(activeFollowup.platform);
            const { productLinkId } = activeFollowup;
            trackAnswer("purchased");
            /**
             * 라운드 60 트랙 B(#2 곁가지) — **done 확정은 여기가 아니다.**
             *
             * 종전에는 이 자리에서 곧바로 completeFollowup을 불러 대기 항목을 done으로
             * 굳혔다. 그런데 이 버튼이 실제로 하는 일은 기록 시트를 여는 것뿐이라, 사용자가
             * 시트를 그냥 닫으면 **기록은 없는데 물음만 사라진 상태**가 남았다: 앱은 다시
             * 묻지 않고(pending이 아니다) 지출도 없다 -- 핵심 루프가 조용히 끊긴다. 퍼널도
             * 같은 이유로 부풀었다("샀어요" 수가 곧 구매 수로 읽힌다).
             *
             * 이제 done은 **저장이 확정된 자리**에서만 붙는다(app/expenses/new.tsx의
             * onSuccess + resolvePurchaseFollowupForExpense). 이탈하면 항목은 pending으로
             * 남아 다음 앱 세션에 다시 물을 수 있다.
             *
             * 계측 이벤트(위 trackAnswer)는 그대로 둔다 -- 그것은 저장의 기록이 아니라
             * **답의 기록**이고, 사용자는 실제로 "샀어요"라고 답했다. 그 답과 뒤따르는
             * expense_recorded 사이의 간격이 곧 이탈률이라, 여기서 이벤트를 빼면 그 간격을
             * 잴 수 없다(ANA-127이 세우려던 바로 그 전환율이다).
             *
             * 라운드 60 리뷰(P2-10): 다만 **재질문에는 상한이 있어야 한다.** 이탈하면 항목이
             * pending으로 남는데, 그 재표출이 아무 예산도 쓰지 않으면 24시간 창이 닫힐 때까지
             * 같은 물음이 앱을 열 때마다 되풀이된다. 그래서 답을 준 이 자리에서 답변 예산
             * (PURCHASE_FOLLOWUP_MAX_PROMPTS) 한 칸을 쓴다 -- "아직이요"와 같은 축이다.
             * 저장이 실제로 확정되면 그 자리에서 done으로 덮이므로 이 소진은 이탈에만 남는다.
             */
            intendPurchaseFollowup(itemTemplateId);
            closeCard();
            // 라운드 48 T4(D1): 어디에서 왔는지를 함께 넘긴다. 저장 후 목적지는 그 값으로
            // 정해지는데(src/expenses/post-save-destination.ts), 이 경로는 **종전 그대로 기록
            // 탭**이다 -- 이 카드는 어느 화면 위에도 뜨는 전역 오버레이라 사용자가 준비템 탭을
            // 보고 있었다는 보장이 없다. 파라미터를 지금 붙여 두는 이유는 판정이 값 하나로
            // 모이게 하기 위해서다(화면이 출처를 모르면 규칙을 적용할 자리도 없다).
            router.push({
              pathname: "/expenses/new",
              params: {
                itemName,
                itemTemplateId,
                // 모르는 값은 파라미터 자체를 붙이지 않는다(빈 문자열을 넘기면 기록 화면이
                // "판매처를 지웠다"와 "모른다"를 구분할 수 없다).
                ...(merchant ? { merchant } : {}),
                ...(productLinkId ? { linkedProductLinkId: productLinkId } : {}),
                [EXPENSE_ENTRY_SOURCE_PARAM]: "purchase-followup"
              }
            });
          }}
          onNotYet={() => {
            trackAnswer("not_purchased");
            closeWith(snoozeFollowup);
          }}
          onDismiss={() => {
            trackAnswer("dismissed");
            closeWith(dismissFollowup);
          }}
        />
      </Animated.View>
    </View>
  );
}
