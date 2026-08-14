import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { LOCAL_SESSION_TOKEN } from "../src/api/client";
import { PurchaseFollowupLifecycle } from "../src/commerce/PurchaseFollowupPrompt";
import { useOfflineSyncLifecycle } from "../src/offline/sync-controller";
import { useSessionStore } from "../src/stores/session.store";

const queryClient = new QueryClient();

/**
 * MOB-102 (round5a-sprint1-plan.md §3.2 point 4): mounted once at the app root so the offline
 * outbox flush-on-reconnect/foreground wiring runs for the whole app lifetime, independent of
 * which screen/tab is currently focused.
 */
function OfflineSyncLifecycle() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const token = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const client = useQueryClient();
  useOfflineSyncLifecycle(token, client);
  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineSyncLifecycle />
      <Stack screenOptions={{ headerShown: false }} />
      {/* COM-108: mounted after <Stack> so the 구매하셨나요? follow-up card overlays whatever
          screen is focused. Inert without a real/demo session and never blocks navigation --
          see src/commerce/PurchaseFollowupPrompt.tsx. */}
      <PurchaseFollowupLifecycle />
    </QueryClientProvider>
  );
}
