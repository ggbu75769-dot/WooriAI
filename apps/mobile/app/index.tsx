import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../src/analytics/client";
import { LOCAL_SESSION_TOKEN } from "../src/api/client";
import { localChildId, useLocalBackendStore } from "../src/api/local-backend";
import { isCurrentlyOnline, subscribeAppStateChange } from "../src/offline/connectivity";
import { shouldShowSessionExpiredNotice } from "../src/offline/session-expiry";
import { COLD_START_HOLD_COPY, coldStartHoldReason, type ColdStartHoldReason } from "../src/onboarding/cold-start-hold";
import { fetchOnboardingProgressForSelectedChild } from "../src/onboarding/onboarding-progress-scope";
import { hasResumeWorthyProgress } from "../src/onboarding/resume";
import {
  shouldAttemptSelectedChildRecovery,
  useSelectedChildRecovery
} from "../src/onboarding/selected-child-recovery";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useOnboardingResumeStore } from "../src/stores/onboarding-resume.store";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";
import { AppScreen, Card, SecondaryButton, Toast } from "../src/ui";
import { SkeletonCard } from "../src/ui/Skeleton";

declare const __DEV__: boolean;

/**
 * 라운드 52 C-09 — 콜드 스타트 홀딩 뷰.
 *
 * 예전에는 이 자리들이 전부 `return null`이었다: 스플래시가 내려간 뒤 리다이렉트가 정해질
 * 때까지(최악 6초, 두 개의 3초 안전 밸브) 흰 화면만 남았다. 판정은 그대로 두고 **그리는 것만**
 * 바꾼다 — 브랜드 배경(AppScreen) + "지금 무엇을 하고 있는지" 한 줄 + D6 스켈레톤 실루엣.
 *
 * 문구·이유 목록은 src/onboarding/cold-start-hold.ts 한 곳에 있다. 이 시점의 앱은 저장소조차
 * 아직 못 읽었으므로 **아는 사실이 없다** — 아이 이름도 금액도 그리지 않는다(스켈레톤은 값이
 * 아니라 자리 실루엣이다).
 *
 * 접근성: 스켈레톤 자체가 "불러오는 중" 라벨을 갖고 있어(src/ui/Skeleton.tsx) 문구와 겹친다.
 * 기록 탭 행과 같은 관례로 실루엣을 접근성 트리에서 감추고, 텍스트 두 줄만 읽히게 둔다.
 */
function ColdStartHoldView({ reason }: { reason: ColdStartHoldReason }) {
  const copy = COLD_START_HOLD_COPY[reason];
  return (
    <AppScreen>
      <View testID="screen-cold-start-hold" style={{ gap: theme.spacing.section }}>
        <View accessible accessibilityLiveRegion="polite" style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 20, fontWeight: "800" }}>{copy.title}</Text>
          <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 19 }}>{copy.body}</Text>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: theme.spacing.gap }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    </AppScreen>
  );
}

/**
 * The session store rehydrates from SecureStore (and the onboarding-progress/selected-child
 * stores from AsyncStorage) asynchronously. Redirecting before all three finish would always see
 * a null accessToken/selectedChildId on a cold start and either dump a logged-in user back onto
 * the landing screen or (MOB-107) send a test session to /(tabs) with no selectedChildId yet --
 * every screen's `Boolean(authToken && childId)` query gate would then race the same hydration,
 * so the index route must hold rendering until all three finish.
 *
 * 실기기 피드백 1: 로컬 백엔드 스토어도 기다린다. 테스트 세션의 라우팅이 이제 "로컬에 아이가
 * 있는가"를 보기 때문에(아래 효과), 그 스토어가 올라오기 전에 판정하면 이미 온보딩을 마친
 * 데모 사용자를 매 콜드 스타트마다 온보딩으로 되돌려보내게 된다. 아래 3초 안전 밸브가 이
 * 대기까지 함께 덮는다.
 */
function storesHydrated() {
  return (
    useSessionStore.persist.hasHydrated() &&
    useOnboardingProgressStore.persist.hasHydrated() &&
    useSelectedChildStore.persist.hasHydrated() &&
    useLocalBackendStore.persist.hasHydrated()
  );
}

/**
 * MOB-101 (round5a-sprint1-plan.md §4): once hydrated with a session that hasn't locally
 * reached home yet, this is the single place that asks the server where onboarding was left
 * off, so app restart / re-login / token refresh restores the exact interrupted step instead
 * of always sending the user back to ONB-001. `hasReachedHome` is trusted once true (no repeat
 * network round trip needed for already-onboarded sessions); the server check only runs for the
 * "not sure yet" case.
 *
 * 라운드 51 #2: 데모(테스트) 세션도 이 조회를 탄다. 예전에는 `isTestSession` 한 줄로 막혀
 * 있었는데, 그 예외 때문에 온보딩 도중 앱을 닫은 데모 사용자는 매번 ONB-001부터 다시
 * 시작했고 -- createChild는 로컬의 아이 한 자리를 통째로 교체하므로 -- 방금 입력한 태명이
 * 그대로 사라졌다. 데모의 진행도는 로컬 백엔드가 실서버와 같은 계약으로 이미 미러하고
 * 있으므로(src/api/local-backend.ts onboardingStatus), 이 조회는 데모에서 **요청 0건**의
 * 순수 로컬 조회다(client.ts의 isLocalToken 분기).
 */
type ProgressFetchState = "idle" | "loading" | "done";

/**
 * ANA-103: app_opened fires at most once per cold start (module-level flag, reset only when the
 * JS bundle reloads) -- re-renders and re-navigations through "/" within one launch never fire
 * it again. Only fired once hydration finished and a real (token-holding) session exists, so a
 * logged-out landing-screen visit or the loginless test session never emits it. A no-op unless
 * the ANA-102 consent toggle (app/settings/index.tsx) is ON -- see src/analytics/flag.ts.
 */
let hasTrackedAppOpenedThisLaunch = false;

export default function IndexScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  // AUTH-127: 마지막 세션이 만료로 끝났는지. 아래 로그아웃 분기의 목적지만 바꾼다.
  const lastEndReason = useSessionStore((state) => state.lastEndReason);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);
  const setResumeProgress = useOnboardingResumeStore((state) => state.setProgress);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  // FIX-119B/F5: 서버가 무효라고 답한 selectedChildId를 지우는 데 쓴다(아래 진행도 조회 참고).
  const clearSelectedChildId = useSelectedChildStore((state) => state.clearSelectedChildId);
  const [hydrated, setHydrated] = useState(storesHydrated);
  const [progressFetch, setProgressFetch] = useState<ProgressFetchState>("idle");
  const [hasResumeTarget, setHasResumeTarget] = useState(false);
  // R19-C(F1): 다자녀 복구 안내를 사용자가 확인했는지. 확인 전까지 /(tabs) 이동을 잡아둔다.
  const [recoveryNoticeAcknowledged, setRecoveryNoticeAcknowledged] = useState(false);
  /**
   * 라운드 51 #2: 진행도 조회에 쓸 토큰. 저장소의 다른 화면과 **같은 관례**다
   * (app/(onboarding)/prepared-items.tsx 등: `accessToken ?? (isTestSession ? LOCAL : null)`).
   * 데모 세션은 실토큰이 없으므로 이 값이 없으면 예전처럼 조회 자체가 돌지 않는다 --
   * 로그아웃 상태(둘 다 없음)에서 아무 요청도 하지 않던 동작은 그대로다.
   */
  const progressToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsubscribes = [
      useSessionStore.persist.onFinishHydration(() => setHydrated(storesHydrated())),
      useOnboardingProgressStore.persist.onFinishHydration(() => setHydrated(storesHydrated())),
      useSelectedChildStore.persist.onFinishHydration(() => setHydrated(storesHydrated())),
      useLocalBackendStore.persist.onFinishHydration(() => setHydrated(storesHydrated()))
    ];
    // Safety valve: zustand persist never fires onFinishHydration (and never flips
    // hasHydrated) when the storage read itself rejects or the stored JSON is
    // corrupt. Without a timeout the app would sit on a blank screen forever in
    // that case -- after a short grace period we proceed with whatever state we
    // have (no token -> the landing screen), which is always recoverable.
    const fallback = setTimeout(() => setHydrated(true), 3000);
    // Hydration may have finished between the initial render and effect registration.
    setHydrated(storesHydrated());
    return () => {
      clearTimeout(fallback);
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !accessToken || hasTrackedAppOpenedThisLaunch) {
      return;
    }
    hasTrackedAppOpenedThisLaunch = true;
    trackAndFlushAnalyticsEvent(accessToken, {
      eventName: "app_opened",
      payload: {},
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  }, [hydrated, accessToken]);

  useEffect(() => {
    if (!hydrated || !progressToken || hasReachedHome || progressFetch !== "idle") {
      return;
    }
    setProgressFetch("loading");
    // R19-C(F1): 이미 고른 아이가 있으면 그 아이 기준으로 물어본다 -- 다자녀 계정에서 둘째만
    // 끝낸 온보딩이 서버의 기본값(첫째)때문에 미완료로 보이던 문제를 없앤다. 아직 고른 아이가
    // 없으면 파라미터 없이(=첫째 기준) 예전과 동일하게 동작한다.
    //
    // FIX-119B/F5: 그 childId가 서버에서 무효면(삭제된 아이 404 / 권한 없음 403 / 비-UUID 400)
    // childId 없이 1회 재시도한다 -- 예전에는 아래 catch가 그 실패를 삼켜 이미 온보딩을 끝낸
    // 사용자를 ONB-001로 되돌려보냈다. 무효로 판명된 selectedChildId는 지워서, 다음 렌더에서
    // MOB-116 복구(GET /children 목록 기반 재선택)가 이어받게 한다.
    //
    // 라운드 51 #2: 데모 세션은 여기서 `LOCAL_SESSION_TOKEN`을 넘긴다(progressToken). 그러면
    // client.ts가 네트워크 대신 로컬 백엔드의 onboardingStatus()를 부르고, 아래 분기는 실세션과
    // 완전히 같은 {completed, nextStep, canRestart, summary} 계약 위에서 돈다.
    fetchOnboardingProgressForSelectedChild(progressToken, selectedChildId)
      .then(({ progress, childScopeRejected }) => {
        if (childScopeRejected) {
          clearSelectedChildId();
        }
        if (progress.completed) {
          markHomeReached();
          return;
        }
        // Only worth an interstitial resume screen once there is real progress to show
        // (consents already accepted, i.e. past the very first step) -- otherwise this is
        // just a fresh account and should start at ONB-001 like today. 데모 세션의 기준은
        // 조금 더 엄격하다 -- hasResumeWorthyProgress 주석 참고.
        if (hasResumeWorthyProgress(progress, isTestSession)) {
          setResumeProgress(progress);
          setHasResumeTarget(true);
        }
      })
      .catch(() => {
        // Offline / server unreachable: fall back to the local-only default below instead of
        // blocking the user indefinitely (local zustand persist is the offline-tolerant
        // fallback per round5a-sprint1-plan.md §4).
      })
      .finally(() => setProgressFetch("done"));
  }, [
    hydrated,
    isTestSession,
    progressToken,
    hasReachedHome,
    progressFetch,
    selectedChildId,
    clearSelectedChildId,
    markHomeReached,
    setResumeProgress
  ]);

  // Safety valve for the server progress check itself, mirroring the hydration fallback above:
  // getOnboardingProgress rejects on HTTP errors but a hung request (no response, no network
  // error surfaced) would leave progressFetch at "loading" -- which renders null -- forever.
  // After the same 3s grace period we proceed as if the check found nothing (progressFetch
  // "done" with no resume target), which routes to onboarding/tabs via the default redirect
  // below; a late response is harmless since every store update it makes is idempotent.
  useEffect(() => {
    if (progressFetch !== "loading") {
      return;
    }
    const fallback = setTimeout(() => setProgressFetch("done"), 3000);
    return () => clearTimeout(fallback);
  }, [progressFetch]);

  /**
   * MOB-107 (실기기 피드백 1로 갱신): 테스트 세션의 selectedChildId를 로컬 백엔드의 사실과
   * 맞춘다.
   *
   * - 로컬에 아이가 있는데 선택이 비어 있으면(`wooriai-selected-child` 블롭이 깨져 migrate가
   *   비운 업그레이드 설치 등) 그 아이를 다시 고른다 -- 그러지 않으면 모든 화면의
   *   `Boolean(authToken && childId)` 게이트가 영영 false로 굳어 비세션 미리보기만 보인다.
   * - 로컬에 아이가 **없으면**(= 온보딩을 아직 안 끝냈다. zero-start 마이그레이션으로 예전
   *   데모 데이터가 지워진 설치도 여기로 온다) 남아 있는 선택과 완료 표시를 지운다. 예전에는
   *   고정 데모 아이 id를 무조건 골라 줬는데, 이제 그 아이는 존재하지 않으므로 홈이 없는
   *   아이를 조회하게 된다. 표시를 지우면 아래 리다이렉트가 온보딩부터 다시 시작시킨다.
   */
  useEffect(() => {
    if (!hydrated || !isTestSession) {
      return;
    }
    const childId = localChildId();
    if (childId) {
      if (!selectedChildId) setSelectedChildId(childId);
      return;
    }
    if (selectedChildId) clearSelectedChildId();
    if (hasReachedHome) resetOnboarding();
  }, [
    hydrated,
    isTestSession,
    selectedChildId,
    hasReachedHome,
    setSelectedChildId,
    clearSelectedChildId,
    resetOnboarding
  ]);

  /**
   * MOB-116: same lost-selectedChildId hole for a REAL session. hasReachedHome lives in a
   * separate persisted store, so a missing/corrupt `wooriai-selected-child` blob leaves
   * hasReachedHome=true while selectedChildId is null -- the /(tabs) redirect below would then
   * pin every screen's `Boolean(authToken && childId)` gate false forever (logged-out preview
   * data, unrecoverable short of reinstalling). There is no fixture id to fall back to here, so
   * the hook re-derives the child from GET /children; an account with no server-side child
   * instead resets local onboarding progress so the ordinary MOB-101 flow routes back through
   * onboarding. See src/onboarding/selected-child-recovery.ts.
   *
   * R19-C(F1): 아이가 여러 명이면 복구가 첫째를 "골라준" 것이므로 hook이 안내(notice)를 돌려주고,
   * 아래에서 사용자가 확인할 때까지 이동을 잡아둔다 -- 둘째를 쓰던 사용자가 아무 안내 없이 첫째
   * 화면을 보게 되는 침묵 오선택을 막는다.
   *
   * 라운드 71 트랙 C(#3): 세 번째 인자가 네이티브 배선이다. 두 함수 모두 저장소에 **이미 있는
   * 것**이고(src/offline/connectivity.ts -- AppState 네이티브 구독은 그 모듈이 FIX-118A에서
   * 하나로 모아 두었다), 훅이 import 대신 주입으로 받는 이유는 판정 모듈을 vitest에서 그대로
   * import할 수 있게 남기기 위해서다(그 파일의 SelectedChildRecoveryWiring 머리말).
   */
  const childRecoveryInput = { hydrated, isTestSession, accessToken, hasReachedHome, selectedChildId };
  const childRecovery = useSelectedChildRecovery(
    childRecoveryInput,
    { setSelectedChildId, resetOnboarding },
    { isCurrentlyOnline, subscribeAppStateChange }
  );

  /**
   * 라운드 52 QA P3-4 — 홀딩 판정의 **단일 소스를 실제로 부른다.**
   *
   * C-09는 "어떤 상태에서 홀딩 뷰를 그리고 그때 이유가 무엇인가"를 순수 모듈에 값으로 고정해
   * 두었지만(coldStartHoldReason), 이 화면은 그 함수를 부르지 않고 세 자리에 이유 리터럴을
   * 직접 적었다. 즉 판정표가 두 벌이었고, 한쪽만 바뀌어도 아무 테스트가 깨지지 않는다 --
   * 모듈은 "문서"일 뿐 배선이 아니었다. 이제 화면이 그 함수 하나로 이유를 얻고, 아래 세 자리는
   * 그 결과를 그대로 쓴다.
   *
   * **분기 순서와 조건식은 그대로다.** 모듈의 검사 순서가 이 화면의 순서와 같으므로(픽셀락 →
   * rehydrate → 로그아웃 → 아이 복구 → 진행도 조회), 각 자리에서 이 값은 예전에 그 자리가
   * 적고 있던 리터럴과 정확히 같은 값이다. 리다이렉트 목적지·복구 안내 카드·에러 카드는
   * 한 줄도 바뀌지 않는다.
   */
  const pixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
  const childRecoveryNeeded = shouldAttemptSelectedChildRecovery(childRecoveryInput);
  const holdReason = coldStartHoldReason({
    pixelLockMode,
    hydrated,
    loggedOut: !accessToken && !isTestSession,
    // 에러 상태는 홀딩이 아니다 -- 재시도 버튼이 있는 카드를 그린다(아래).
    childRecoveryPending: childRecoveryNeeded && childRecovery.status !== "error",
    onboardingProgressPending: !hasReachedHome && Boolean(progressToken) && progressFetch !== "done"
  });

  if (pixelLockMode) {
    return <Redirect href="/pixel-lock?screen=HOME-001" />;
  }

  if (holdReason === "hydration") {
    // C-09: 예전의 `return null`. 판정(무엇을 기다리는가)은 그대로이고 그리는 것만 바뀌었다.
    return <ColdStartHoldView reason={holdReason} />;
  }

  if (!accessToken && !isTestSession) {
    // AUTH-127: 만료로 끝난 세션은 스플래시(3.6초 성장 애니메이션 + 시작하기 탭)를 다시 볼
    // 이유가 없다 -- 이미 이 앱을 쓰던 사람이고, 필요한 건 다시 로그인하는 것뿐이다. 곧바로
    // 로그인 화면으로 보내면 만료 안내(SESSION_EXPIRED_LOGIN_NOTICE)도 거기서 바로 읽힌다.
    // 앱이 살아 있는 동안의 만료는 sync-controller의 구독이 이미 같은 곳으로 보냈으므로,
    // 이 분기는 그 리다이렉트를 못 본 경우(만료 직후 앱 종료·콜드 스타트)를 받아낸다.
    // 명시적 로그아웃("logout")과 첫 실행(null)은 예전 그대로 스플래시로 간다.
    return <Redirect href={shouldShowSessionExpiredNotice({ accessToken, isTestSession, lastEndReason }) ? "/login" : "/launch-animation"} />;
  }

  // MOB-116: while the real-session child recovery above is still needed, hold the /(tabs)
  // redirect. Both success outcomes flip this condition off by themselves (recovered sets
  // selectedChildId; no-child clears hasReachedHome), so only the in-flight and error states
  // ever render here -- and the hook's internal timeout valve guarantees the in-flight null
  // cannot outlive the grace period, so no infinite spinner/blank is possible.
  //
  // 라운드 71 트랙 C(#3): 카드의 구조·버튼은 그대로이고 **문장 둘만** 판정에서 온다 -- 첫 줄은
  // 오프라인이면 그 사실을(아니면 종전 문장 그대로), 둘째 줄은 이 갈래가 아무것도 건드리지
  // 않는다는 사실을 말한다(src/onboarding/selected-child-recovery.ts). 그리고 이 카드가 떠 있는
  // 동안 훅이 재연결·포그라운드 복귀에 스스로 한 번 다시 시도하므로, [다시 시도]가 유일한 탈출구가
  // 아니게 됐다.
  if (childRecoveryNeeded && childRecovery.status === "error") {
    return (
      <AppScreen>
        <View testID="screen-child-recovery-error" style={{ gap: theme.spacing.section }}>
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>{childRecovery.copy.title}</Text>
            <Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 19 }}>
              {childRecovery.copy.body}
            </Text>
            <SecondaryButton label="다시 시도" onPress={childRecovery.retry} />
          </Card>
        </View>
      </AppScreen>
    );
  }

  if (holdReason === "child-recovery") {
    // C-09: 복구가 도는 동안(에러가 아닌 진행 중). 위 주석대로 이 대기는 훅의 3초 밸브가
    // 상한을 갖고 있고, 이제 그 3초가 흰 화면이 아니라 홀딩 뷰다.
    return <ColdStartHoldView reason={holdReason} />;
  }

  // R19-C(F1): 복구가 다자녀 중 첫째를 골라준 경우의 안내. 이 시점에는 selectedChildId가 이미
  // 채워져 위 조건이 false이므로, 확인 버튼을 누르기 전까지만 이 카드가 이동을 잡아둔다.
  if (childRecovery.notice && !recoveryNoticeAcknowledged) {
    return (
      <AppScreen>
        <View testID="screen-child-recovery-notice" style={{ gap: theme.spacing.section }}>
          <Toast message={childRecovery.notice} />
          <SecondaryButton label="확인" onPress={() => setRecoveryNoticeAcknowledged(true)} />
        </View>
      </AppScreen>
    );
  }

  // 라운드 51 #2: 데모 세션도 같은 관문을 지난다(예전에는 `!isTestSession &&`이 막았다).
  // 진행도 조회가 끝나기 전에 리다이렉트가 나가면 이어하기 판정 자체가 없는 것과 같다.
  if (!hasReachedHome) {
    // FIX-118A (m-9): "idle" must hold the redirect just like "loading" does. The server
    // progress check above runs in an effect, i.e. only AFTER this render commits — so on any
    // render where `hasReachedHome` has just become false (a cold start, or MOB-116's no-child
    // recovery calling resetOnboarding) `progressFetch` is still "idle" here. Falling through
    // then renders <Redirect href="/onboarding/child-status">, whose navigation effect fires
    // before the fetch ever starts: ONB-006 이어하기 is skipped and the user is dropped back at
    // the first onboarding step even though the server has resume-worthy progress.
    // Holding on "idle" is deadlock-free: this branch's conditions are exactly the ones that
    // make the progress effect run, so it always moves to "loading" on the very next commit,
    // and the 3s valve above bounds "loading". `progressToken`을 함께 보는 것은 그 등식을
    // 문자 그대로 유지하기 위해서다 -- 토큰이 없으면 조회가 돌지 않으므로 기다릴 대상도
    // 없다(지금 이 지점에 토큰 없이 도달하는 경로는 없지만, 위 로그아웃 분기가 바뀌어도
    // 빈 화면으로 굳지 않는다).
    if (holdReason === "onboarding-progress") {
      // C-09: 두 대기 상태("idle"·"loading")를 함께 붙잡는 계약은 그대로다 — 그 사이에 흰
      // 화면 대신 홀딩 뷰를 그린다. 조건식은 위 `onboardingProgressPending`에 그대로 있다
      // (`!hasReachedHome && progressToken && progressFetch !== "done"`) — 이 자리가 이미
      // `!hasReachedHome` 안이므로 두 표현은 같은 값이다.
      return <ColdStartHoldView reason={holdReason} />;
    }
    if (hasResumeTarget) {
      return <Redirect href="/onboarding/resume" />;
    }
  }

  // 실기기 피드백 1: 테스트 세션도 실계정과 **같은 관문**을 지난다. 예전에는 `|| isTestSession`
  // 때문에 데모 세션이 온보딩을 통째로 건너뛰고 곧장 탭으로 들어갔다(그리고 그 앞에서 데모
  // 데이터가 미리 심어져 있었다). 이제는 온보딩을 끝내 hasReachedHome이 서야만 탭으로 간다.
  return <Redirect href={hasReachedHome ? "/(tabs)" : "/onboarding/child-status"} />;
}
