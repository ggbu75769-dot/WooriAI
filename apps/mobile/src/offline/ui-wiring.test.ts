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

  /**
   * 라운드 104 B-5 — **복구 버튼이 실패를 삼키지 않는다.**
   *
   * 종전에는 이 화면(921줄)에 `catch`가 **0개**였다. 막힌 기록을 푸는 유일한 화면인데 복구 동작
   * 열넷이 전부 fire-and-forget이었고, 그 함수들은 하나같이 `await getOfflineStore()`로 시작하므로
   * 부팅 뒤 저장소가 죽으면(디스크 가득 참, SQLite I/O 오류) 호출은 조용히 reject하고 목록은 그대로
   * 남았다 — 사용자는 눌러도 아무 일이 없는 버튼을 다시 눌렀다.
   *
   * 화면은 vitest에서 렌더할 수 없으므로(위 describe 머리말의 오래된 사정) 이 계약도 소스 대조다.
   * 무는 것은 **자리 전수**다: 복구 호출 이름 하나하나를 코드에서 찾아, 그 자리가 실패 표면
   * (`…run(() => …)`)이나 `.catch(`를 지나는지 본다. 새 복구 버튼이 붙으면 자동으로 이 질문을 받는다.
   */
  const RECOVERY_CALLS = [
    "resolveConflictKeepServer",
    "resolveConflictKeepMine",
    "resolveConflictKeepChosenFields",
    "retryOfflineMutation",
    "discardOfflineMutation",
    "retryOfflineItemStatus",
    "discardOfflineItemStatus",
    "retryAllOfflineMutations",
    "discardAllOfflineMutations",
    "discardPendingOfflineMutation"
  ] as const;

  /** 잡으려는 것은 코드의 호출이지 주석의 인용이 아니다(이 저장소의 다른 스윕과 같은 관례). */
  const codeOnly = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  it("라운드 104 B-5: 동기화 상태 화면의 복구 호출 전수가 실패를 붙잡는다 (종전에는 파일 전체 catch가 0개였다)", () => {
    const code = codeOnly(source("app/sync-status.tsx"));
    // 유령 방지: 그물이 실제로 이 화면을 훑고 있고, 이 화면에 `catch`가 실재한다.
    expect(code).toContain(".catch(");

    const unguarded: string[] = [];
    let sites = 0;
    for (const name of RECOVERY_CALLS) {
      const pattern = new RegExp(`\\b${name}\\(`, "g");
      let called: RegExpExecArray | null;
      let seen = 0;
      while ((called = pattern.exec(code))) {
        seen += 1;
        sites += 1;
        const before = code.slice(Math.max(0, called.index - 40), called.index);
        const after = code.slice(called.index, called.index + 260);
        // 출구 둘: 실패 표면 러너(`…run(() => …)` — 행의 `rowAction.run`, 섹션의 `runBulkAction`)
        // 를 지나거나, 그 자리에서 직접 `.catch(`로 거절을 붙잡거나.
        const wrappedByRunner = /\brun[A-Za-z]*\(\(\)\s*=>\s*$/.test(before);
        if (!wrappedByRunner && !after.includes(".catch(")) unguarded.push(`${name}@${called.index}`);
      }
      expect(seen, `${name}의 호출부가 이 화면에 실재한다`).toBeGreaterThan(0);
    }
    // 정찰이 센 열넷을 하한으로 둔다(오늘 실측은 그보다 많다 — 갈래마다 버리기가 따로 선다).
    expect(sites, "이 화면의 복구 호출 자리").toBeGreaterThanOrEqual(14);
    expect(unguarded, "거절을 삼키는 복구 호출").toEqual([]);

    // 그리고 그 실패가 사용자에게 **보인다** — 행/섹션 안의 한 줄로.
    expect(code).toContain("syncStatusActionFailedMessage()");
    expect(code).toContain("<RecoveryActionFailureLine visible=");
  });

  it("라운드 104 B-5: 저장소 미가용 고지가 빈 목록 밖에서도 선다 (행이 남아 있으면 종전에는 절대 뜨지 않았다)", () => {
    const code = codeOnly(source("app/sync-status.tsx"));
    // 종전에는 이 상수가 `ListEmptyComponent` 한 자리에만 있었다. 그런데 저장소 미가용 스냅숏은
    // 행과 건수를 **일부러 그대로 둔다**(sync-controller.ts) — 즉 목록이 비지 않아 고지가 뜰 수
    // 없었다. 이제 머리말에도 같은 문장이 선다.
    const noticeSites = code.match(/OFFLINE_STORAGE_UNAVAILABLE_NOTICE/g) ?? [];
    // import 한 줄 + 머리말 + 빈 목록 카드.
    expect(noticeSites.length).toBeGreaterThanOrEqual(3);
    const headerAt = code.indexOf("const listHeader");
    const emptyAt = code.indexOf("const listEmpty");
    expect(headerAt, "머리말 블록").toBeGreaterThan(-1);
    expect(emptyAt, "빈 목록 블록").toBeGreaterThan(-1);
    expect(headerAt).toBeLessThan(emptyAt);
    const header = code.slice(headerAt, emptyAt);
    expect(header).toContain('snapshot.storage === "unavailable"');
    expect(header).toContain("OFFLINE_STORAGE_UNAVAILABLE_NOTICE");
  });

  it("mobile package.json declares the SDK-52-pinned expo-sqlite and expo-network dependencies", () => {
    const packageJson = JSON.parse(source("package.json"));
    expect(packageJson.dependencies["expo-sqlite"]).toBe("~15.1.4");
    expect(packageJson.dependencies["expo-network"]).toBe("~7.0.5");
  });
});
