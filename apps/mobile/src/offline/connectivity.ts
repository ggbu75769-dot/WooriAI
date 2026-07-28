import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";

/**
 * MOB-102 §3.2 point 4: "네트워크 오류 ... NetInfo 연결 복구·앱 foreground 시 재시도". This app
 * uses expo-network (an Expo-SDK-maintained package, so it stays managed-workflow-compatible
 * without extra native linking) rather than @react-native-community/netinfo. expo-network only
 * exposes a point-in-time `getNetworkStateAsync` poll (no push/event API), so "connection
 * recovered" is detected by polling on an interval and diffing against the last known state.
 * "App foreground" is detected via AppState, which does have a native event.
 *
 * Not unit-tested (no native network/AppState in vitest's node environment) -- the logic this
 * drives (flushOutbox) is fully covered in sync-engine.test.ts; this module is a thin, mostly
 * declarative wiring layer around it.
 */

const POLL_INTERVAL_MS = 15_000;

export async function isCurrentlyOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    // If the platform can't report network state (e.g. web), assume online and let the actual
    // fetch call fail/succeed as the real signal.
    return true;
  }
}

export type ConnectivityWatcherHandle = { stop: () => void };

/** Reactive connectivity for status UI. `null` means the first native probe is
 * still in flight; callers must not claim offline until the platform confirms it. */
export function useConnectivityStatus(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void isCurrentlyOnline().then((value) => {
        if (active) setOnline(value);
      });
    };
    refresh();
    const pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") refresh();
    });
    return () => {
      active = false;
      clearInterval(pollTimer);
      subscription.remove();
    };
  }, []);
  return online;
}

/** Calls `onReconnect` once when connectivity transitions from offline->online (poll-detected),
 * and once every time the app returns to the foreground. Callers (sync-controller.ts) treat
 * every call as "try a flush now" -- flushOutbox is itself idempotent/cheap to call redundantly
 * (it no-ops if the outbox is empty). */
export function startConnectivityWatcher(onReconnect: () => void): ConnectivityWatcherHandle {
  let lastKnownOnline: boolean | null = null;

  const pollTimer = setInterval(() => {
    void isCurrentlyOnline().then((online) => {
      if (online && lastKnownOnline === false) {
        onReconnect();
      }
      lastKnownOnline = online;
    });
  }, POLL_INTERVAL_MS);

  const handleAppStateChange = (status: AppStateStatus) => {
    if (status === "active") {
      onReconnect();
    }
  };
  const subscription = AppState.addEventListener("change", handleAppStateChange);

  return {
    stop: () => {
      clearInterval(pollTimer);
      subscription.remove();
    }
  };
}
