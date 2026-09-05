import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { router, Stack } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, Image, InteractionManager, SafeAreaView, View } from "react-native";
import { KoreanText as Text } from "../src/design-system/components/KoreanText";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fixtureSessionToken, LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../src/api/fixture-identifiers";
import {
  bindPendingIntentToUser,
  bindPendingIntentOnAuthentication,
  canConsumePendingIntentForUser,
  canRestoreItemIntent,
  parsePendingNavigationIntent,
  type PendingNavigationIntent
} from "../src/navigation/pending-intent";
import { useSessionStore } from "../src/stores/session.store";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { AppErrorBoundary } from "../src/crash/AppErrorBoundary";
import { installGlobalCrashHandlers, reportCrash } from "../src/crash/crash-adapter";

const queryClient = new QueryClient();
const startupMark = require("../assets/splash-mark.png");
installGlobalCrashHandlers();

function StartupLoadingState({ title, description }: { title: string; description: string }) {
  return (
    <SafeAreaView style={{ backgroundColor: "#FFF9F3", flex: 1 }}>
      <View
        accessibilityLabel={`${title}. ${description}`}
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={{ alignItems: "center", flex: 1, justifyContent: "center", padding: 24 }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#FFFFFF",
            borderColor: "#F1E5DA",
            borderRadius: 36,
            borderWidth: 1,
            height: 112,
            justifyContent: "center",
            marginBottom: 24,
            width: 112
          }}
        >
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            resizeMode="contain"
            source={startupMark}
            style={{ height: 132, width: 132 }}
          />
        </View>
        <Text style={{ color: "#17324D", fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: 10 }}>우리아이</Text>
        <Text style={{ color: "#211E1C", fontSize: 17, fontWeight: "800", textAlign: "center" }}>{title}</Text>
        <Text style={{ color: "#5F5854", fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 280, textAlign: "center" }}>{description}</Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 9, marginTop: 22 }}>
          <ActivityIndicator accessibilityElementsHidden color="#17324D" importantForAccessibility="no-hide-descendants" size="small" />
          <Text style={{ color: "#746B65", fontSize: 13, fontWeight: "700" }}>안전하게 불러오는 중</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * MOB-102 (round5a-sprint1-plan.md §3.2 point 4): mounted once at the app root so the offline
 * outbox flush-on-reconnect/foreground wiring runs for the whole app lifetime, independent of
 * which screen/tab is currently focused.
 */
function DeferredOfflineSyncLifecycle() {
  const [Lifecycle, setLifecycle] = useState<ComponentType | null>(null);
  useEffect(() => {
    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void import("../src/offline/OfflineSyncLifecycle")
        .then(({ default: LoadedLifecycle }) => {
          if (active) setLifecycle(() => LoadedLifecycle);
        })
        .catch((error) => reportCrash(error, false));
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, []);
  return Lifecycle ? <Lifecycle /> : null;
}

function sessionStoresHydrated() {
  return useSessionStore.persist.hasHydrated() && useSelectedChildStore.persist.hasHydrated();
}

function SessionNavigationGate({ children }: { children: ReactNode }) {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const userId = useSessionStore((state) => state.userId);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const token = accessToken ?? (isTestSession ? fixtureSessionToken : null);
  const currentUserId = userId ?? (isTestSession ? LOCAL_USER_ID : null);
  const currentHouseholdId = defaultHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const [hydrated, setHydrated] = useState(sessionStoresHydrated);
  const [pendingIntent, setPendingIntent] = useState<PendingNavigationIntent | null>(null);
  const previousToken = useRef<string | null | undefined>(undefined);
  const consumed = useRef(new Set<string>());

  useEffect(() => {
    if (hydrated) return;
    const subscriptions = [
      useSessionStore.persist.onFinishHydration(() => setHydrated(sessionStoresHydrated())),
      useSelectedChildStore.persist.onFinishHydration(() => setHydrated(sessionStoresHydrated()))
    ];
    // A slow native read must never be treated as a completed logged-out hydration. Doing that
    // races a valid persisted session onto the launch route, producing the intermittent
    // logo -> blank transition seen on Android cold starts. Storage adapters already fail
    // closed for rejected/corrupt reads; this timer only retries a genuinely slow read while
    // the branded native/loading surface remains visible.
    const retry = setTimeout(() => {
      if (!sessionStoresHydrated()) {
        void useSessionStore.persist.rehydrate();
        void useSelectedChildStore.persist.rehydrate();
      }
    }, 4000);
    setHydrated(sessionStoresHydrated());
    return () => {
      clearTimeout(retry);
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [hydrated]);

  useEffect(() => {
    const accept = (url: string | null) => {
      const parsed = url ? parsePendingNavigationIntent(url) : null;
      if (!parsed || consumed.current.has(parsed.fingerprint)) return;
      const session = useSessionStore.getState();
      const authenticatedUserId = session.userId ?? (session.isTestSession ? LOCAL_USER_ID : null);
      setPendingIntent(bindPendingIntentToUser(parsed, authenticatedUserId));
    };
    void Linking.getInitialURL().then(accept);
    const subscription = Linking.addEventListener("url", ({ url }) => accept(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (previousToken.current && !token) setPendingIntent(null);
    previousToken.current = token;
  }, [token]);

  useEffect(() => {
    if (!hydrated || !token || !pendingIntent || consumed.current.has(pendingIntent.fingerprint)) return;
    const authenticatedIntent = bindPendingIntentOnAuthentication(pendingIntent, currentUserId);
    if (authenticatedIntent !== pendingIntent) {
      setPendingIntent(authenticatedIntent);
      return;
    }
    if (!canConsumePendingIntentForUser(pendingIntent, currentUserId)) {
      consumed.current.add(pendingIntent.fingerprint);
      setPendingIntent(null);
      return;
    }
    let active = true;
    const expectedToken = token;
    void import("../src/api/client")
      .then(async ({ getCatalogItem, listChildren }) => {
        const { children } = await listChildren(token);
        if (!canRestoreItemIntent(pendingIntent, currentHouseholdId, children)) return false;
        await getCatalogItem(token, pendingIntent.itemId, pendingIntent.childId);
        return true;
      })
      .then((allowed) => {
        const currentSession = useSessionStore.getState();
        const currentToken = currentSession.accessToken ?? (currentSession.isTestSession ? fixtureSessionToken : null);
        if (!active || currentToken !== expectedToken) return;
        consumed.current.add(pendingIntent.fingerprint);
        setPendingIntent(null);
        if (allowed) {
          router.replace(`/items/${pendingIntent.itemId}?contextType=child&contextId=${pendingIntent.childId}`);
        } else {
          router.replace("/notifications");
        }
      })
      .catch(() => {
        if (!active) return;
        consumed.current.add(pendingIntent.fingerprint);
        setPendingIntent(null);
        router.replace("/notifications");
      });
    return () => { active = false; };
  }, [currentHouseholdId, currentUserId, hydrated, pendingIntent, token]);

  if (!hydrated) {
    return (
      <StartupLoadingState
        description="저장된 정보를 안전하게 불러오고 있어요."
        title="앱을 준비하고 있어요"
      />
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SessionNavigationGate>
          <DeferredOfflineSyncLifecycle />
          <Stack screenOptions={{ headerShown: false }} />
        </SessionNavigationGate>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
