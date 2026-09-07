import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemStatusOutboxRow, LocalExpenseRow } from "./types";

/**
 * 라운드 106 T2 — **동기화 스냅숏의 참조 안정화**를 값으로 무는 스위트.
 *
 * ⚠️ **두 시점.**
 * - 종전: `sync-controller.ts`는 "vitest에서 실행 불가"(파일 머리말)로 취급돼 소스 grep 계약만
 *   붙어 있었다. 그래서 `refreshSnapshot`이 **내용이 같아도 매번 새 객체를 싣는다**는 사실은
 *   어떤 테스트도 보지 못했고, 반대로 그것을 고칠 때 생기는 위험 — 달라졌는데 같다고 판정해
 *   화면이 낡은 값에 멈추는 쪽 — 도 잠글 방법이 없었다.
 * - 이제: 이 컨트롤러를 **실제로 import해서** 돌린다. 그 문이 열린 근거는 두 가지다.
 *   ① 저장소 열기 팩토리는 `Platform.OS === "web"`이면 메모리 저장소를 쓴다 — 네이티브
 *      SQLite를 건드리지 않는다(이 스위트가 react-native를 그 한 필드로 대체하는 이유).
 *   ② `useOfflineSyncSnapshot`이 부르는 것은 `useSyncExternalStore` 하나이고, React가 그것에
 *      하는 일(구독 + `getSnapshot()` 재호출 + `Object.is`면 렌더 생략)은 이 스위트가 그대로
 *      흉내 낼 수 있다. 아래 harness가 그 두 인자를 붙잡아 둔다.
 *   화면(.tsx) 렌더는 여전히 여기서 하지 않는다 — 이 스위트가 무는 것은 스냅숏의 **값과 참조**다.
 */
const harness = vi.hoisted(() => ({
  subscribe: null as null | ((listener: () => void) => () => void),
  getSnapshot: null as null | (() => unknown)
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // 이 스위트는 훅을 컴포넌트 밖에서 부른다. 부수효과는 앱 루트의 배선(useOfflineSyncLifecycle)
    // 이고 이 트랙의 대상이 아니므로 no-op으로 둔다.
    useEffect: () => undefined,
    useSyncExternalStore: (subscribe: (listener: () => void) => () => void, getSnapshot: () => unknown) => {
      harness.subscribe = subscribe;
      harness.getSnapshot = getSnapshot;
      return getSnapshot();
    }
  };
});
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-router", () => ({ router: { replace: () => undefined } }));
// 오프라인으로 고정한다: 이 스위트가 부르는 쓰기 경로(updateItemStatusOffline)가 배경 flush로
// 새어 나가 알림 횟수를 흔들지 않게 한다.
vi.mock("expo-network", () => ({ getNetworkStateAsync: async () => ({ isConnected: false, isInternetReachable: false }) }));
/**
 * 컨트롤러가 여는 저장소를 **테스트가 손에 쥔다.** 같은 인스턴스를 돌려주게 해 두면, 경계값
 * (필드 하나만 다름 · undefined↔null)을 엔진을 거치지 않고 정확히 만들 수 있다.
 */
vi.mock("./memory-offline-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./memory-offline-store")>();
  const singleton = actual.createMemoryOfflineStore();
  return { createMemoryOfflineStore: () => singleton };
});

const { createMemoryOfflineStore } = await import("./memory-offline-store");
const { refreshOfflineSyncSnapshot, updateItemStatusOffline, useOfflineSyncSnapshot } = await import(
  "./sync-controller"
);
type SyncSnapshot = ReturnType<typeof useOfflineSyncSnapshot>;

const store = createMemoryOfflineStore();

let notifications = 0;
// React가 하는 일과 같은 순서다: 구독해 두고, 알림이 오면 getSnapshot()을 다시 읽는다.
useOfflineSyncSnapshot();
harness.subscribe?.(() => {
  notifications += 1;
});

function currentSnapshot(): SyncSnapshot {
  return harness.getSnapshot!() as SyncSnapshot;
}

function expenseRow(overrides: Partial<LocalExpenseRow> = {}): LocalExpenseRow {
  return {
    localId: "lexp_1",
    canonicalId: null,
    childId: "child-1",
    payload: {
      childId: "child-1",
      categoryId: "cat-diaper",
      amountKrw: 12000,
      spentOn: "2026-09-02",
      itemName: "기저귀",
      merchant: "쿠팡",
      memo: null,
      paymentMethod: "card",
      expenseType: "expense"
    },
    version: null,
    syncState: "pending",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    createdAt: "2026-09-02T01:00:00.000Z",
    updatedAt: "2026-09-02T01:00:00.000Z",
    ...overrides
  };
}

function itemStatusRow(overrides: Partial<ItemStatusOutboxRow> = {}): ItemStatusOutboxRow {
  return {
    mutationId: "m_1",
    childId: "child-1",
    itemTemplateId: "tpl_bottle",
    status: "prepared",
    itemName: "젖병",
    syncState: "pending",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: "2026-09-02T01:00:00.000Z",
    updatedAt: "2026-09-02T01:00:00.000Z",
    ...overrides
  };
}

/** 저장소를 비우고, 준 행들을 심고, 스냅숏을 그 상태로 맞춘 뒤 알림 계수기를 0으로 되돌린다. */
async function seed(rows: LocalExpenseRow[], statusRows: ItemStatusOutboxRow[] = []): Promise<SyncSnapshot> {
  await store.clearAll();
  for (const row of rows) await store.insertLocalExpense(row);
  for (const row of statusRows) await store.insertItemStatusMutation(row);
  await refreshOfflineSyncSnapshot();
  notifications = 0;
  return currentSnapshot();
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("라운드 106 T2 — 스냅숏 참조 안정화(내용이 같으면 이전 객체 유지)", () => {
  it("내용이 그대로면 스냅숏 객체·배열·집계의 참조를 모두 유지하고 알림도 내지 않는다", async () => {
    const before = await seed([expenseRow(), expenseRow({ localId: "lexp_2", syncState: "synced", version: 3 })], [
      itemStatusRow()
    ]);

    // 저장소를 한 글자도 바꾸지 않고 두 번 더 읽는다(15초 연결 폴링·포그라운드 복귀가 하는 일).
    await refreshOfflineSyncSnapshot();
    await refreshOfflineSyncSnapshot();

    const after = currentSnapshot();
    expect(after).toBe(before);
    expect(after.rows).toBe(before.rows);
    expect(after.itemStatusRows).toBe(before.itemStatusRows);
    expect(after.counts).toBe(before.counts);
    expect(notifications).toBe(0);
  });

  it("경계값 0건 ↔ 0건: 빈 스냅숏끼리도 새 객체를 만들지 않는다", async () => {
    const before = await seed([]);
    expect(before.rows).toHaveLength(0);
    expect(before.itemStatusRows).toHaveLength(0);

    await refreshOfflineSyncSnapshot();

    expect(currentSnapshot()).toBe(before);
    expect(notifications).toBe(0);
  });

  /**
   * 라운드 105 ITEMS가 실측으로 남긴 이월 그 자체다: 준비템 탭의 `pendingStatusIndex` memo는
   * `syncSnapshot.itemStatusRows`를 의존성으로 쓴다(app/(tabs)/items.tsx). 상태를 한 번 체크하면
   * 알림은 **한 번**이어야 하고, 그 뒤 도는 갱신들은 같은 배열 참조를 그대로 둬야 한다.
   */
  it("준비템 상태 체크 1회 = 알림 1회, 뒤따르는 무변화 갱신은 itemStatusRows 참조를 그대로 둔다", async () => {
    await seed([]);
    const queryClient = { setQueriesData: () => undefined, invalidateQueries: async () => undefined };

    await updateItemStatusOffline("token", queryClient as never, {
      childId: "child-1",
      itemTemplateId: "tpl_bottle",
      status: "prepared",
      itemName: "젖병"
    });

    expect(notifications).toBe(1);
    const afterCheck = currentSnapshot();
    expect(afterCheck.itemStatusRows).toHaveLength(1);

    await refreshOfflineSyncSnapshot();
    await refreshOfflineSyncSnapshot();

    expect(currentSnapshot()).toBe(afterCheck);
    expect(currentSnapshot().itemStatusRows).toBe(afterCheck.itemStatusRows);
    expect(notifications).toBe(1);
  });
});

/**
 * 안전 축: **놓치는 방향의 오류가 없다.** 내용이 달라졌는데 같다고 판정하면 화면이 낡은 값에
 * 멈춘다(대기 배지가 사라지지 않는다 · 충돌 화면이 옛 서버 값을 그린다 · 실패 사유가 안 바뀐다).
 * 아래 표는 스냅숏이 나르는 **모든 필드**를 한 번씩 건드리고, 그때마다 새 객체 + 알림이 서는지
 * 본다. 표가 필드를 빠뜨리는 날은 맨 아래 대조 테스트가 먼저 붉어진다.
 */
type MissedSignalCase = {
  /** types.ts가 선언한 필드 이름(대조용). */
  field: string;
  label: string;
  seedRows?: LocalExpenseRow[];
  seedStatusRows?: ItemStatusOutboxRow[];
  mutate: () => Promise<void>;
  /** 어느 배열이 새 참조가 돼야 하는가. */
  axis: "rows" | "itemStatusRows";
};

const expenseFieldCases: MissedSignalCase[] = [
  {
    field: "localId",
    label: "행 하나가 다른 행으로 바뀐다(길이 동일)",
    mutate: async () => {
      await store.deleteLocalExpense("lexp_1");
      await store.insertLocalExpense(expenseRow({ localId: "lexp_9" }));
    },
    axis: "rows"
  },
  {
    field: "canonicalId",
    label: "서버 id가 붙는다(null → 값)",
    mutate: () => store.updateLocalExpense("lexp_1", { canonicalId: "exp_1" }),
    axis: "rows"
  },
  {
    field: "childId",
    label: "다른 아이의 행이 된다",
    mutate: () => store.updateLocalExpense("lexp_1", { childId: "child-2" }),
    axis: "rows"
  },
  {
    field: "version",
    label: "버전만 오른다",
    mutate: () => store.updateLocalExpense("lexp_1", { version: 7 }),
    axis: "rows"
  },
  {
    field: "syncState",
    label: "대기 → 실패",
    mutate: () => store.updateLocalExpense("lexp_1", { syncState: "failed" }),
    axis: "rows"
  },
  {
    field: "pendingDelete",
    label: "삭제 대기가 켜진다",
    mutate: () => store.updateLocalExpense("lexp_1", { pendingDelete: true }),
    axis: "rows"
  },
  {
    field: "conflictCurrent",
    label: "충돌 스냅숏이 붙는다(null → 값)",
    mutate: () =>
      store.updateLocalExpense("lexp_1", {
        conflictCurrent: {
          deleted: false,
          expense: { ...expenseRow().payload, id: "exp_1", version: 4 }
        }
      }),
    axis: "rows"
  },
  {
    field: "conflictCurrent",
    label: "충돌 스냅숏의 서버 금액만 달라진다(중첩 한 칸)",
    seedRows: [
      expenseRow({
        syncState: "conflict",
        conflictCurrent: { deleted: false, expense: { ...expenseRow().payload, id: "exp_1", version: 4 } }
      })
    ],
    mutate: () =>
      store.updateLocalExpense("lexp_1", {
        conflictCurrent: {
          deleted: false,
          expense: { ...expenseRow().payload, amountKrw: 999_000, id: "exp_1", version: 4 }
        }
      }),
    axis: "rows"
  },
  {
    field: "conflictCurrent",
    label: "충돌 스냅숏이 묘비(deleted)로 바뀐다",
    seedRows: [
      expenseRow({
        syncState: "conflict",
        conflictCurrent: { deleted: false, expense: { ...expenseRow().payload, id: "exp_1", version: 4 } }
      })
    ],
    mutate: () => store.updateLocalExpense("lexp_1", { conflictCurrent: { deleted: true, id: "exp_1", version: 4 } }),
    axis: "rows"
  },
  {
    field: "lastError",
    label: "실패 사유 문장이 달라진다",
    mutate: () => store.updateLocalExpense("lexp_1", { lastError: "권한이 없어요" }),
    axis: "rows"
  },
  {
    field: "lastErrorStatus",
    label: "경계값 undefined → null(모름의 두 표현)",
    mutate: () => store.updateLocalExpense("lexp_1", { lastErrorStatus: null }),
    axis: "rows"
  },
  {
    field: "lastErrorStatus",
    label: "null → 403",
    seedRows: [expenseRow({ lastErrorStatus: null })],
    mutate: () => store.updateLocalExpense("lexp_1", { lastErrorStatus: 403 }),
    axis: "rows"
  },
  {
    field: "lastErrorCode",
    label: "경계값 undefined → null",
    mutate: () => store.updateLocalExpense("lexp_1", { lastErrorCode: null }),
    axis: "rows"
  },
  {
    field: "createdAt",
    label: "생성 시각이 달라진다",
    mutate: () => store.updateLocalExpense("lexp_1", { createdAt: "2026-09-03T01:00:00.000Z" }),
    axis: "rows"
  },
  {
    field: "updatedAt",
    label: "수정 시각이 달라진다",
    mutate: () => store.updateLocalExpense("lexp_1", { updatedAt: "2026-09-03T01:00:00.000Z" }),
    axis: "rows"
  }
];

const payloadFieldCases: MissedSignalCase[] = (
  [
    ["childId", { childId: "child-2" }],
    ["categoryId", { categoryId: "cat-toy" }],
    ["amountKrw", { amountKrw: 12001 }],
    ["spentOn", { spentOn: "2026-09-03" }],
    ["itemName", { itemName: "기저귀 대형" }],
    ["merchant", { merchant: null }],
    ["memo", { memo: "메모 한 줄" }],
    ["paymentMethod", { paymentMethod: "cash" as const }],
    ["linkedItemTemplateId", { linkedItemTemplateId: "tpl_bottle" }],
    ["linkedProductLinkId", { linkedProductLinkId: "link_1" }],
    ["expenseType", { expenseType: "gift" as const }]
  ] as const
).map(([field, patch]) => ({
  field: `payload.${field}`,
  label: `payload.${field}만 달라진다`,
  mutate: () => store.updateLocalExpense("lexp_1", { payload: { ...expenseRow().payload, ...patch } }),
  axis: "rows" as const
}));

const itemStatusFieldCases: MissedSignalCase[] = (
  [
    ["mutationId", { mutationId: "m_2" }],
    ["childId", { childId: "child-2" }],
    ["itemTemplateId", { itemTemplateId: "tpl_car_seat" }],
    ["status", { status: "interested" as const }],
    ["itemName", { itemName: "카시트" }],
    ["syncState", { syncState: "failed" as const }],
    ["attemptCount", { attemptCount: 1 }],
    ["nextRetryAt", { nextRetryAt: "2026-09-02T01:05:00.000Z" }],
    ["lastError", { lastError: "네트워크가 불안정해요" }],
    ["lastErrorStatus", { lastErrorStatus: null }],
    ["lastErrorCode", { lastErrorCode: null }],
    ["inFlight", { inFlight: true }],
    ["createdAt", { createdAt: "2026-09-03T01:00:00.000Z" }],
    ["updatedAt", { updatedAt: "2026-09-03T01:00:00.000Z" }]
  ] as const
).map(([field, patch]) => ({
  field,
  label: `준비템 큐의 ${field}만 달라진다`,
  seedStatusRows: [itemStatusRow(), itemStatusRow({ mutationId: "m_other", itemTemplateId: "tpl_wipe" })],
  mutate: () => store.updateItemStatusMutation("m_1", patch as Partial<ItemStatusOutboxRow>),
  axis: "itemStatusRows" as const
}));

describe("라운드 106 T2 — 놓침 방향의 오류가 없다(달라졌으면 반드시 새 참조 + 알림)", () => {
  for (const testCase of [...expenseFieldCases, ...payloadFieldCases, ...itemStatusFieldCases]) {
    it(`${testCase.field}: ${testCase.label}`, async () => {
      // 기본 모집단은 **길이가 같고 원소 하나만 다른** 경계값을 만들도록 두 행이다: 길이 비교로
      // 빠져나갈 수 없으니 실제로 필드까지 내려가 봐야 판정이 선다.
      const before = await seed(
        testCase.seedRows ?? [expenseRow(), expenseRow({ localId: "lexp_2", childId: "child-1" })],
        testCase.seedStatusRows ?? [itemStatusRow()]
      );

      await testCase.mutate();
      await refreshOfflineSyncSnapshot();

      const after = currentSnapshot();
      expect(after, "내용이 달라졌는데 이전 스냅숏 객체가 그대로다").not.toBe(before);
      expect(after[testCase.axis], `${testCase.axis} 배열이 새 참조가 아니다`).not.toBe(before[testCase.axis]);
      expect(notifications, "구독자가 알림을 받지 못했다").toBeGreaterThanOrEqual(1);
    });
  }

  it("행이 하나 늘어난다(길이 변화)", async () => {
    const before = await seed([expenseRow()]);
    await store.insertLocalExpense(expenseRow({ localId: "lexp_2" }));
    await refreshOfflineSyncSnapshot();
    expect(currentSnapshot()).not.toBe(before);
    expect(currentSnapshot().rows).toHaveLength(2);
    expect(notifications).toBe(1);
  });

  it("행 순서만 바뀌어도 새 참조다(목록이 그대로 서면 안 된다)", async () => {
    const before = await seed([expenseRow(), expenseRow({ localId: "lexp_2" })]);
    await store.clearAll();
    await store.insertLocalExpense(expenseRow({ localId: "lexp_2" }));
    await store.insertLocalExpense(expenseRow());
    await refreshOfflineSyncSnapshot();
    expect(currentSnapshot()).not.toBe(before);
    expect(notifications).toBe(1);
  });

  /**
   * `storage` 칸은 숫자가 아니라 **"이 숫자를 믿어도 되는가"** 다(라운드 61 #6). 행·건수가 그대로인
   * 채 이 칸만 되돌아오는 갈래가 실제로 있으므로(저장소가 한 번 실패했다가 다시 열린다), 비교가
   * 이 칸을 빼먹으면 화면은 "모름" 한 줄에 영영 멈춘다.
   */
  it("행·건수가 그대로여도 storage가 unavailable → ok로 돌아오면 새 참조다", async () => {
    const before = await seed([expenseRow()]);
    vi.spyOn(store, "listLocalExpenses").mockRejectedValueOnce(new Error("디스크가 가득 찼어요"));

    await refreshOfflineSyncSnapshot();
    const unavailable = currentSnapshot();
    expect(unavailable.storage).toBe("unavailable");
    expect(unavailable.rows).toBe(before.rows); // 읽어 둔 행은 그대로 둔다(그 티켓의 계약)

    await refreshOfflineSyncSnapshot();
    const recovered = currentSnapshot();
    expect(recovered.storage).toBe("ok");
    expect(recovered).not.toBe(unavailable);
    expect(notifications).toBe(2);
  });
});

/**
 * 손으로 적은 필드 목록이 **types.ts와 갈라지는 날**을 잡는 대조. 이 스위트의 표(위)와
 * 비교 함수(sync-controller.ts)가 함께 붙들리므로, 필드를 하나 더 만든 사람은 둘 중 하나를
 * 빠뜨릴 수 없다 — 빠뜨리면 여기가 먼저 붉어진다.
 */
function declaredFields(source: string, typeName: string): string[] {
  const start = source.indexOf(`export type ${typeName} = {`);
  expect(start, `${typeName} 선언을 찾지 못했다`).toBeGreaterThan(-1);
  const end = source.indexOf("\n};", start);
  expect(end, `${typeName} 선언의 끝을 찾지 못했다`).toBeGreaterThan(start);
  const block = source.slice(start, end);
  return [...block.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]!);
}

describe("라운드 106 T2 — 비교 대상 필드 대조(types.ts가 단일 소스)", () => {
  const typesSource = readFileSync(join(process.cwd(), "src/offline/types.ts"), "utf8");
  const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");

  it("스냅숏이 나르는 세 타입의 모든 필드가 위 표에 한 번씩은 등장한다", () => {
    const covered = new Set(
      [...expenseFieldCases, ...payloadFieldCases, ...itemStatusFieldCases].map((testCase) => testCase.field)
    );
    for (const field of declaredFields(typesSource, "LocalExpenseRow")) {
      if (field === "payload") continue; // payload는 아래 필드별 표가 통째로 덮는다
      expect(covered.has(field), `LocalExpenseRow.${field}를 건드리는 경우가 표에 없다`).toBe(true);
    }
    for (const field of declaredFields(typesSource, "ExpensePayload")) {
      expect(covered.has(`payload.${field}`), `ExpensePayload.${field}를 건드리는 경우가 표에 없다`).toBe(true);
    }
    for (const field of declaredFields(typesSource, "ItemStatusOutboxRow")) {
      expect(covered.has(field), `ItemStatusOutboxRow.${field}를 건드리는 경우가 표에 없다`).toBe(true);
    }
  });

  it("비교 함수가 그 필드들을 실제로 읽는다(손비교라 목록이 코드에 적혀 있다)", () => {
    const start = controllerSource.indexOf("function isSameExpensePayload(");
    const end = controllerSource.indexOf("async function refreshSnapshot(");
    expect(start, "비교 함수 블록의 시작을 찾지 못했다").toBeGreaterThan(-1);
    expect(end, "비교 함수 블록의 끝을 찾지 못했다").toBeGreaterThan(start);
    const comparators = controllerSource.slice(start, end);
    const fields = [
      ...declaredFields(typesSource, "LocalExpenseRow"),
      ...declaredFields(typesSource, "ExpensePayload"),
      ...declaredFields(typesSource, "ItemStatusOutboxRow")
    ];
    for (const field of fields) {
      expect(comparators.includes(`.${field}`), `비교 함수가 ${field}를 읽지 않는다`).toBe(true);
    }
    // 집계 네 칸도 같은 계약이다(건수만 달라지는 갱신을 놓치면 배지가 멈춘다).
    for (const countKey of ["pending", "syncing", "failed", "conflict"]) {
      expect(comparators.includes(`.${countKey}`), `비교 함수가 counts.${countKey}를 읽지 않는다`).toBe(true);
    }
  });
});
