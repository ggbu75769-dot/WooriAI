import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("MOB-102/EXP-005 offline UI wiring (source verification -- follows the existing\n  android-native-ui-quality.test.ts source-grep convention; screens aren't runtime-rendered\n  here because expo-sqlite/react-native have no native binding under vitest)", () => {
  it("routes quick-expense create through the offline-first path and shows OFFLINE_SAVED_MESSAGE, never the server-confirmed copy, right after the local write", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    expect(newExpenseSource).toContain('import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";');
    expect(newExpenseSource).toMatch(
      /import \{[^}]*createExpenseOffline[^}]*\} from "\.\.\/\.\.\/src\/offline\/sync-controller";/s
    );
    expect(newExpenseSource).toContain("createExpenseOffline(authToken, queryClient,");
    expect(newExpenseSource).toContain("let completionMessage = OFFLINE_SAVED_MESSAGE");
    expect(newExpenseSource).toContain("setSavedMessage(completionMessage)");
    expect(newExpenseSource).toContain("기기에 안전하게 저장했어요. 다음 기록을 입력해 주세요.");
    expect(newExpenseSource).not.toContain("기록했어요. 이번 달 우리 아이 비용에 더해둘게요.");
    // The real createExpense (server-immediate, no local-first staging) must not be used here.
    expect(newExpenseSource).not.toMatch(/[^.]\bcreateExpense\(authToken/);
  });

  it("adopts a server-loaded expense into the local offline table before allowing edit/delete, and routes both through the offline outbox", () => {
    const detailSource = source("app/expenses/[expenseId].tsx");
    expect(detailSource).toContain("import { adoptServerExpense, deleteExpenseOffline, updateExpenseOffline } from \"../../src/offline/sync-controller\";");
    expect(detailSource).toContain("adoptServerExpense(expense.data)");
    expect(detailSource).toContain("updateExpenseOffline(authToken, queryClient, localExpenseId,");
    expect(detailSource).toContain("deleteExpenseOffline(authToken, queryClient, localExpenseId)");
    expect(detailSource).toContain("setSavedMessage(OFFLINE_SAVED_MESSAGE)");
  });

  it("shows unsynced-count badges on the records tab that link to the EXP-005 sync-status screen, and marks unsynced rows with a distinct icon", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain('router.push("/sync-status")');
    expect(recordsSource).toContain("useOfflineSyncSnapshot");
    expect(recordsSource).toContain("offlineStatusIcon");
    expect(recordsSource).toContain("subscribeOfflineFlashMessage");
    expect(recordsSource).toContain(
      'syncSnapshot.remoteSync.authorizationState === "denied"'
    );
    const controllerSource = source("src/offline/sync-controller.ts");
    expect(controllerSource).toContain("removeFinancialQueries(queryClient)");
  });

  it("H-2 fix: reconciles the server list against outstanding local mutations (via the unit-tested expense-list-reconciliation module) instead of naively concatenating/double-summing, and manages the flash-message dismiss timer via a ref", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain('import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";');
    expect(recordsSource).toContain("reconcileMonthlyExpenses(");
    expect(recordsSource).toContain("flashTimerRef");
    expect(recordsSource).not.toContain("expenses.data.totalAmountKrw + offlinePendingTotalKrw");
    const controllerSource = source("src/offline/sync-controller.ts");
    const syncedBlock = controllerSource.slice(controllerSource.indexOf("if (summary.synced > 0)"));
    expect(syncedBlock.indexOf("invalidateFinancialMutationQueries")).toBeLessThan(
      syncedBlock.indexOf("refreshSnapshot(owner.scopeKey)")
    );
  });

  it("EXP-005 sync-status screen exists, shows the conflict banner copy, and offers all three D-10 conflict resolution choices plus retry/discard for failed rows", () => {
    const syncStatusSource = source("app/sync-status.tsx");
    expect(syncStatusSource).toContain("CONFLICT_BANNER_MESSAGE");
    expect(syncStatusSource).toContain("CONFLICT_OPTION_ADOPT_SERVER_LABEL");
    expect(syncStatusSource).toContain("CONFLICT_OPTION_REAPPLY_MINE_LABEL");
    expect(syncStatusSource).toContain("CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL");
    expect(syncStatusSource).toContain("resolveConflictKeepServer");
    expect(syncStatusSource).toContain("resolveConflictKeepMine");
    expect(syncStatusSource).toContain("resolveConflictKeepChosenFields");
    expect(syncStatusSource).toContain("retryOfflineMutation");
    expect(syncStatusSource).toContain("discardOfflineMutation");
  });

  it("mounts the offline sync lifecycle (connectivity/foreground flush trigger) once at the app root", () => {
    const rootLayoutSource = source("app/_layout.tsx");
    const lifecycleSource = source("src/offline/OfflineSyncLifecycle.tsx");
    const controllerSource = source("src/offline/sync-controller.ts");
    const pullRunnerSource = source("src/offline/delta-pull-runner.ts");
    const continuationSource = source("src/offline/sync-continuation.ts");
    expect(rootLayoutSource).toContain('import("../src/offline/OfflineSyncLifecycle")');
    expect(rootLayoutSource).toContain("<DeferredOfflineSyncLifecycle");
    expect(lifecycleSource).toContain(
      "useOfflineSyncLifecycle(token, scopeKey, sessionGeneration, client)"
    );
    expect(controllerSource).toContain("useSessionStore.subscribe(abortStaleFlushExecutions)");
    expect(controllerSource).toContain("useSelectedChildStore.subscribe(abortStaleFlushExecutions)");
    expect(controllerSource).toContain("createClientRemoteExpenseApi(activeToken, signal)");
    expect(controllerSource).toContain("isActive: () => offlineSyncOwnerIsActive(owner)");
    expect(controllerSource).toContain("getSyncChangesV2(");
    expect(pullRunnerSource).toContain("applyRemoteSyncPage({");
    expect(controllerSource).toContain("scopeSyncFlights");
    expect(controllerSource).toContain("resumeAfterActiveScopeFlight(");
    expect(controllerSource).toContain(
      "}, [hasSessionToken, queryClient, scopeKey, sessionGeneration]);"
    );
    expect(continuationSource).toContain("if (current) await current");
  });

  it("mobile package.json declares the SDK-54-pinned expo-sqlite and expo-network dependencies", () => {
    const packageJson = JSON.parse(source("package.json"));
    expect(packageJson.dependencies["expo-sqlite"]).toBe("~16.0.10");
    expect(packageJson.dependencies["expo-network"]).toBe("~8.0.8");
  });

  it("pins native storage and safe-area packages to the Expo SDK 54 / React Native 0.81 contract", () => {
    const packageJson = JSON.parse(source("package.json"));
    expect(packageJson.dependencies["@react-native-async-storage/async-storage"]).toBe("2.2.0");
    expect(packageJson.dependencies["react-native-safe-area-context"]).toBe("~5.6.0");
  });
});
