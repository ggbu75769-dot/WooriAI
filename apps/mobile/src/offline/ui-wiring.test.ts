import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("MOB-102/EXP-005 offline UI wiring (source verification -- follows the existing\n  android-native-ui-quality.test.ts source-grep convention; screens aren't runtime-rendered\n  here because expo-sqlite/react-native have no native binding under vitest)", () => {
  it("routes quick-expense create through the offline-first path and shows OFFLINE_SAVED_MESSAGE, never the server-confirmed copy, right after the local write", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    expect(newExpenseSource).toContain('import { OFFLINE_SAVED_MESSAGE } from "../../src/offline/messages";');
    expect(newExpenseSource).toContain('import { createExpenseOffline } from "../../src/offline/sync-controller";');
    expect(newExpenseSource).toContain("createExpenseOffline(authToken, queryClient,");
    // 라운드 48 T4(D1): "저장하고 계속 기록"만 다른 문구를 쓴다(화면에 남아 칸이 비워지는 이유를
    // 말해야 한다). 종전 경로 -- 저장 후 화면을 떠나는 저장 -- 는 여전히 OFFLINE_SAVED_MESSAGE다.
    expect(newExpenseSource).toContain("continueRecording ? CONTINUE_RECORDING_SAVED_MESSAGE : OFFLINE_SAVED_MESSAGE");
    expect(newExpenseSource).not.toContain("기록했어요. 이번 달 우리 아이 비용에 더해둘게요.");
    // The real createExpense (server-immediate, no local-first staging) must not be used here.
    expect(newExpenseSource).not.toMatch(/[^.]\bcreateExpense\(authToken/);
  });

  it("adopts a server-loaded expense into the local offline table before allowing edit/delete, and routes both through the offline outbox", () => {
    const detailSource = source("app/expenses/[expenseId].tsx");
    // 라운드 42 L-5: 같은 모듈을 두 번 import하던 두 줄(K-11의 useOfflineSyncSnapshot)을 한 줄로
    // 합치면서 여러 줄 import가 됐다 -- 확인하는 것은 여전히 "이 세 함수가 이 모듈에서 온다"이다.
    const syncControllerImport = detailSource.slice(
      detailSource.indexOf("import {\n  adoptServerExpense,"),
      detailSource.indexOf('} from "../../src/offline/sync-controller";')
    );
    expect(syncControllerImport).toContain("adoptServerExpense,");
    expect(syncControllerImport).toContain("deleteExpenseOffline,");
    expect(syncControllerImport).toContain("updateExpenseOffline,");
    expect(detailSource.match(/from "\.\.\/\.\.\/src\/offline\/sync-controller"/g) ?? []).toHaveLength(1);
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
  });

  it("H-2 fix: reconciles the server list against outstanding local mutations (via the unit-tested expense-list-reconciliation module) instead of naively concatenating/double-summing, and manages the flash-message dismiss timer via a ref", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain('import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";');
    expect(recordsSource).toContain("reconcileMonthlyExpenses(");
    expect(recordsSource).toContain("flashTimerRef");
    expect(recordsSource).not.toContain("expenses.data.totalAmountKrw + offlinePendingTotalKrw");
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
    expect(rootLayoutSource).toContain("useOfflineSyncLifecycle");
    expect(rootLayoutSource).toContain("<OfflineSyncLifecycle");
  });

  it("mobile package.json declares the SDK-52-pinned expo-sqlite and expo-network dependencies", () => {
    const packageJson = JSON.parse(source("package.json"));
    expect(packageJson.dependencies["expo-sqlite"]).toBe("~15.1.4");
    expect(packageJson.dependencies["expo-network"]).toBe("~7.0.5");
  });
});
