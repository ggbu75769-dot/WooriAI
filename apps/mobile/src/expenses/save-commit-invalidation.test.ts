import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

/**
 * 라운드 104 트랙 SAVE(정찰 A의 F1) — **지출 저장의 확정이 캐시 무효화를 기다리지 않는다.**
 *
 * 고치는 문제: 저장을 누르면 로컬 저장(SQLite 우선)은 이미 끝나 "기기에 저장했어요" 토스트가
 * 서는데, 같은 화면의 저장 버튼은 `saveExpense.isPending`으로 "저장하는 중"에 잠긴 채 남았다.
 * onSuccess가 캐시 무효화 여섯을 직접 await했고, react-query는 `await this.options.onSuccess?.(…)`
 * 가 끝난 **뒤에야** success를 dispatch하기 때문이다(@tanstack/query-core mutation.js).
 * 그 대기의 길이는 화면이 정하지 못한다 — invalidateQueries는 매칭되는 **활성** 쿼리의 refetch
 * 완료까지 resolve하지 않고(queryClient.js refetchQueries → Promise.all), 요청 하나의 상한은
 * 10초(src/api/client.ts DEFAULT_FETCH_TIMEOUT_MS)에 재시도 기본 3회와 백오프가 붙으며,
 * onlineManager 배선이 없어(FIX-118A) 오프라인에서 즉시 resolve되는 탈출구도 없다.
 *
 * ⚠️ **이 파일은 소스를 읽기만 하지 않는다 — 화면의 onSuccess 본문을 그대로 꺼내 실물
 * react-query 위에서 돌린다.** 그 이유는 이 트랙이 잠그려는 성질이 문자열이 아니라 **시간**이기
 * 때문이다: 무효화 문자열의 존재만 무는 계약(src/refresh-wiring-contract.test.ts의 GAP-062)은
 * `await`를 되돌려 놓아도 그대로 초록이다. 여기서는 끝나지 않는 재조회를 캐시에 심어 두고,
 * 그 아래에서 뮤테이션이 예산 안에 **확정되는지**를 값으로 잰다.
 *
 * 본문을 돌리는 방법은 이 저장소가 이미 쓰는 관례를 따른다 — src/offline/messages.test.ts가
 * 화면의 조건절을 `new Function`으로 꺼내 실제로 돌리는 그 방식이고, 다른 점은 대상이 조건절이
 * 아니라 콜백 본문이라 `with (scope)`로 화면의 이름들을 하네스가 대신 세워 준다는 것뿐이다.
 * 본문이 새 이름을 참조하면 하네스는 그 이름을 말하며 빨개진다(아래 SCOPE_MISS_PREFIX).
 *
 * ⚠️ 이 하네스가 **못 보는 것**(사각, 정직하게 적는다):
 *  · 화면 렌더는 없다 — 버튼의 `disabled`/라벨이 `isPending`에 걸려 있다는 사실 자체는 아래
 *    ⓔ가 소스로 문다(react-native는 vitest에서 렌더되지 않는다 — 이 저장소의 관례).
 *  · 무효화 여섯은 종전처럼 **차례로** 돈다. 앞의 재조회가 멈춰 서면 뒤의 무효화도 그만큼
 *    늦는다 — 이 트랙이 바꾼 것은 그 사슬의 길이가 아니라 **확정이 그 사슬에 묶여 있던 것**이다.
 *  · mutationFn(로컬 저장) 자체의 시간은 이 파일의 대상이 아니다(여기서는 즉시 끝난다).
 */

const MOBILE_ROOT = process.cwd();
const source = (relativePath: string) => readFileSync(join(MOBILE_ROOT, relativePath), "utf8");

/** 주석 자리를 **같은 길이의 공백**으로 덮는다 — 좌표가 원본과 어긋나면 본문을 잘못 자른다. */
function maskComments(text: string): string {
  const blank = (chunk: string) => chunk.replace(/[^\n]/g, " ");
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
}

/** `표식 … {` 뒤의 중괄호 짝을 세어 콜백 **본문**만 원본 그대로 돌려준다(주석 포함). */
function callbackBody(text: string, startNeedle: string): string {
  const masked = maskComments(text);
  const at = masked.indexOf(startNeedle);
  expect(at, `시작 표식을 찾지 못했다: ${startNeedle}`).toBeGreaterThan(-1);
  let depth = 0;
  let open = -1;
  for (let index = at; index < masked.length; index += 1) {
    const char = masked[index];
    if (char === "{") {
      if (depth === 0) open = index;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  throw new Error(`닫는 중괄호를 찾지 못했다: ${startNeedle}`);
}

const SCOPE_MISS_PREFIX = "하네스가 세우지 않은 이름";

const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor as new (
  parameterName: string,
  body: string
) => (scope: unknown) => Promise<void>;

/**
 * 화면의 onSuccess 본문을 **그대로** 실행 가능한 함수로 만든다.
 *
 * `with (scope)`를 쓰는 이유: 본문이 참조하는 화면의 이름(상태 setter · ref · 순수 모듈)을 하나씩
 * 인자로 옮겨 적으면 그 목록이 본문보다 먼저 낡는다. 프록시가 대신 받아, 하네스에 없는 이름은
 * **이름을 말하며** 던진다 — 다음 사람이 무엇을 세워 줘야 하는지 실패 메시지가 알려 준다.
 * (Function 생성자가 만드는 함수는 sloppy 모드라 `with`가 선다.)
 */
function runnableHandler(body: string, deps: Record<string, unknown>): () => Promise<void> {
  const scope = new Proxy(deps, {
    has: (_target, key) => typeof key === "string",
    get: (target, key) => {
      if (typeof key !== "string") return undefined;
      if (key in target) return target[key];
      if (key in globalThis) return (globalThis as unknown as Record<string, unknown>)[key];
      throw new Error(`${SCOPE_MISS_PREFIX}: ${key}`);
    }
  });
  const compiled = new AsyncFunction("__scope", `with (__scope) {\n${body}\n}`);
  return () => compiled(scope);
}

type RefetchMode = "hang" | "reject-late" | "settle";

type CacheHarness = {
  readonly client: QueryClient;
  /** 그 키의 queryFn이 불린 횟수 — 최초 1회 + 무효화가 일으킨 재조회. */
  readonly fetchCount: (queryKey: readonly string[]) => number;
  readonly isFetching: (queryKey: readonly string[]) => boolean;
  readonly release: () => void;
};

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

/**
 * 앱과 같은 조건의 캐시에 **활성** 쿼리를 세운다(무효화는 활성 쿼리만 재조회한다).
 *
 * ⚠️ 화면을 열어 둔 사용자와 같은 상태로 맞춘다 — **첫 조회는 응답이 와서 데이터가 있고**,
 * 저장이 일으키는 **재조회**만 모드를 따른다. 그렇게 해야 무효화가 재조회를 새로 띄우고
 * (react-query는 데이터가 없는 채 떠 있는 조회에는 새 요청을 겹치지 않고 그 약속을 그대로
 * 돌려준다 — query.js fetch의 `state.data !== undefined && cancelRefetch` 갈래) 그 재조회의
 * 성질을 이 하네스가 정할 수 있다. `hang`은 영영 끝나지 않는 재조회 = 연결이 나쁜 자리,
 * `reject-late`는 늦게 실패하는 재조회, `settle`은 곧바로 응답이 오는 자리다.
 */
async function cacheWith(keys: readonly (readonly string[])[], mode: RefetchMode): Promise<CacheHarness> {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });
  client.mount();
  const counts = new Map<string, number>();
  const pending: (() => void)[] = [];
  const unsubscribes: (() => void)[] = [];
  for (const queryKey of keys) {
    const hash = JSON.stringify(queryKey);
    const observer = new QueryObserver(client, {
      queryKey: [...queryKey],
      queryFn: () => {
        const call = (counts.get(hash) ?? 0) + 1;
        counts.set(hash, call);
        if (call === 1 || mode === "settle") return Promise.resolve(call);
        return new Promise<number>((resolve, reject) => {
          pending.push(() => (mode === "reject-late" ? reject(new Error("늦게 실패한 재조회")) : resolve(call)));
        });
      }
    });
    unsubscribes.push(observer.subscribe(() => {}));
  }
  // 첫 조회가 캐시에 앉을 때까지 기다린다(여기까지가 "화면을 열어 둔 상태"다).
  for (let round = 0; round < 10; round += 1) await tick();
  const release = () => {
    // 매달린 재조회를 풀어 준다(테스트가 끝난 뒤 떠 있는 약속을 남기지 않는다).
    for (const settle of pending.splice(0)) settle();
    for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
    client.unmount();
    client.clear();
  };
  cleanups.push(release);
  return {
    client,
    fetchCount: (queryKey) => counts.get(JSON.stringify(queryKey)) ?? 0,
    isFetching: (queryKey) =>
      client.getQueryCache().find({ queryKey: [...queryKey] })?.state.fetchStatus === "fetching",
    release
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** 예산(ms) 안에 그 약속이 끝나면 true. 대기 자체를 재는 자리라 가짜 타이머를 쓰지 않는다. */
async function settlesWithin(promise: Promise<unknown>, budgetMs: number): Promise<boolean> {
  let done = false;
  promise.then(
    () => (done = true),
    () => (done = true)
  );
  const deadline = Date.now() + budgetMs;
  while (!done && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  return done;
}

/** 확정을 재는 예산. 이 핸들러가 하는 일은 전부 마이크로태스크라 넉넉하다. */
const COMMIT_BUDGET_MS = 300;

const ENTRY_KEYS = [["expenses"], ["home"], ["report"], ["budget"], ["items"], ["item-detail"]] as const;
const DETAIL_SAVE_KEYS = [["expenses"], ["expense", "exp-1"], ["report"], ["budget"]] as const;
const DETAIL_DELETE_KEYS = [["expenses"], ["report"], ["budget"]] as const;

type Recorder = {
  resetFormCalls: number;
  savedMessages: string[];
  timers: { delayMs: number; run: () => void }[];
  replaced: string[];
  leftAfterMutation: number;
};

function newRecorder(): Recorder {
  return { resetFormCalls: 0, savedMessages: [], timers: [], replaced: [], leftAfterMutation: 0 };
}

/** 기록 시트(app/expenses/new.tsx) onSuccess가 참조하는 이름 전부. */
function entryDeps(
  client: QueryClient,
  recorder: Recorder,
  options: { continueRecording: boolean; linkedItemTemplateId: string | null }
): Record<string, unknown> {
  return {
    queryClient: client,
    continueAfterSaveRef: { current: options.continueRecording },
    linkedItemTemplateId: options.linkedItemTemplateId,
    failedLocalId: null,
    discardOfflineMutation: () => Promise.resolve(),
    resolvePurchaseFollowupForExpense: () => null,
    usePurchaseFollowupStore: { getState: () => ({ entries: [], completeFollowup: () => {} }) },
    childId: "child-1",
    clearDraftForCurrentChild: () => {},
    setSaveErrorMessage: () => {},
    setSavedMessage: (message: string) => recorder.savedMessages.push(message),
    CONTINUE_RECORDING_SAVED_MESSAGE: "계속 기록 문구",
    OFFLINE_SAVED_MESSAGE: "기기 저장 문구",
    hapticSuccess: () => {},
    amountText: "12000",
    selectedCategoryId: "diaper",
    authToken: "token",
    isCurrentlyOnline: () => Promise.resolve(true),
    trackAndFlushAnalyticsEvent: () => {},
    buildExpenseRecordedPayload: () => ({}),
    Platform: { OS: "android" },
    resetFormForNextEntry: () => {
      recorder.resetFormCalls += 1;
    },
    leaveTimerRef: { current: null },
    router: { replace: (destination: string) => recorder.replaced.push(destination) },
    postSaveDestination: "/(tabs)/records",
    setTimeout: (run: () => void, delayMs: number) => {
      recorder.timers.push({ delayMs, run });
      return 0;
    },
    clearTimeout: () => {}
  };
}

/** 지출 상세(app/expenses/[expenseId].tsx)의 두 onSuccess가 참조하는 이름 전부. */
function detailDeps(client: QueryClient, recorder: Recorder): Record<string, unknown> {
  return {
    queryClient: client,
    expenseId: "exp-1",
    OFFLINE_SAVED_MESSAGE: "기기 저장 문구",
    setSaveErrorMessage: () => {},
    setRemoteChangeNotice: () => {},
    setSavedMessage: (message: string) => recorder.savedMessages.push(message),
    leaveTimerRef: { current: null },
    leaveAfterMutation: () => {
      recorder.leftAfterMutation += 1;
    },
    setTimeout: (run: () => void, delayMs: number) => {
      recorder.timers.push({ delayMs, run });
      return 0;
    },
    clearTimeout: () => {}
  };
}

/** 저장이 확정된 자리 = 뮤테이션이 success로 끝난 자리(버튼의 잠금이 풀리는 그 값). */
async function commitOf(client: QueryClient, handler: () => Promise<void>) {
  const observer = new MutationObserver(client, {
    mutationFn: () => Promise.resolve({ ok: true }),
    onSuccess: handler
  });
  const settled = await settlesWithin(observer.mutate(undefined), COMMIT_BUDGET_MS);
  const result = observer.getCurrentResult();
  return { settled, isPending: result.isPending, isSuccess: result.isSuccess, isError: result.isError };
}

const entrySuccessBody = () => callbackBody(source("app/expenses/new.tsx"), "onSuccess: async () => {");

function detailSuccessBody(mutation: "save" | "remove"): string {
  const detail = source("app/expenses/[expenseId].tsx");
  const slice =
    mutation === "save"
      ? detail.slice(detail.indexOf("const save = useMutation({"), detail.indexOf("const remove = useMutation({"))
      : detail.slice(detail.indexOf("const remove = useMutation({"), detail.indexOf("function confirmDelete()"));
  expect(slice.length, `${mutation} 뮤테이션 구간을 찾지 못했다`).toBeGreaterThan(0);
  return callbackBody(slice, "onSuccess: async () => {");
}

describe("ⓐ 선행 재현 — 무효화를 기다리면 뮤테이션이 그동안 pending으로 남는다 (react-query 실물)", () => {
  /**
   * 이 트랙 전체가 이 문장 위에 서 있으므로 화면을 꺼내기 전에 실물로 먼저 못 박는다.
   * 두 갈래는 **같은 무효화 여섯**을 돌리고, 다른 것은 onSuccess가 그것을 기다리는가뿐이다.
   */
  const invalidateAll = (client: QueryClient) =>
    ENTRY_KEYS.reduce(
      (chain, queryKey) => chain.then(() => client.invalidateQueries({ queryKey: [...queryKey] })),
      Promise.resolve()
    );

  it("옛 모양(await) — 끝나지 않는 재조회 아래에서는 저장이 확정되지 않는다", async () => {
    const cache = await cacheWith(ENTRY_KEYS, "hang");
    let committed = 0;
    const commit = await commitOf(cache.client, async () => {
      await invalidateAll(cache.client);
      committed += 1;
    });

    expect(commit.settled, "무효화를 기다리는 동안 뮤테이션이 끝나지 않는다").toBe(false);
    expect(commit.isPending, '버튼은 그 내내 "저장하는 중"으로 잠긴다').toBe(true);
    expect(committed, "await 뒤의 문장은 한 번도 서지 못한다").toBe(0);
    expect(cache.isFetching(["expenses"]), "재조회는 실제로 떠 있다(대기의 원인)").toBe(true);
  });

  it("오늘의 모양(대기 없음) — 같은 무효화·같은 캐시인데 저장은 예산 안에 확정된다", async () => {
    const cache = await cacheWith(ENTRY_KEYS, "hang");
    let committed = 0;
    const commit = await commitOf(cache.client, async () => {
      void invalidateAll(cache.client).catch(() => {});
      committed += 1;
    });

    expect(commit.settled).toBe(true);
    expect(commit.isPending, "버튼이 풀린다").toBe(false);
    expect(commit.isSuccess).toBe(true);
    expect(committed, "확정 뒤의 문장이 곧바로 선다").toBe(1);
    // 그리고 무효화는 사라진 것이 아니라 **떠 있다**(첫 키는 이미 재조회 중이다).
    expect(cache.fetchCount(["expenses"]), "최초 조회 1 + 무효화가 일으킨 재조회 1").toBe(2);
    expect(cache.isFetching(["expenses"])).toBe(true);
  });
});

describe("ⓑ 기록 시트 저장 — app/expenses/new.tsx의 onSuccess 본문을 그대로 돌린다", () => {
  it('"저장하고 계속 기록" — 끝나지 않는 무효화 아래에서도 확정되고 폼이 비워진다', async () => {
    const cache = await cacheWith(ENTRY_KEYS, "hang");
    const recorder = newRecorder();
    const handler = runnableHandler(
      entrySuccessBody(),
      entryDeps(cache.client, recorder, { continueRecording: true, linkedItemTemplateId: "tpl-1" })
    );

    const commit = await commitOf(cache.client, handler);

    expect(commit.settled, "무효화가 끝나지 않아도 뮤테이션은 끝난다").toBe(true);
    expect(commit.isPending, "저장 버튼의 잠금이 풀린다").toBe(false);
    expect(commit.isSuccess).toBe(true);
    // 마트 연속 기록: 폼이 **그 자리에서** 비워진다(예전에는 무효화 여섯 뒤였다 — 그동안 친
    // 다음 항목을 뒤늦게 온 리셋이 덮었다).
    expect(recorder.resetFormCalls, "resetFormForNextEntry가 확정과 함께 선다").toBe(1);
    expect(recorder.savedMessages, "성공 문구도 함께 선다").toEqual(["계속 기록 문구"]);
    // 무효화가 없어진 것이 아니다 — 첫 키는 이미 재조회 중이고, 아직 끝나지 않았다.
    expect(cache.fetchCount(["expenses"])).toBe(2);
    expect(cache.isFetching(["expenses"]), "확정 시점에 재조회는 여전히 떠 있다").toBe(true);
  });

  it("화면을 떠나는 갈래 — 이동 타이머(650ms)가 무효화를 기다리지 않고 걸린다", async () => {
    const cache = await cacheWith(ENTRY_KEYS, "hang");
    const recorder = newRecorder();
    const handler = runnableHandler(
      entrySuccessBody(),
      entryDeps(cache.client, recorder, { continueRecording: false, linkedItemTemplateId: "tpl-1" })
    );

    const commit = await commitOf(cache.client, handler);

    expect(commit.settled).toBe(true);
    expect(commit.isPending).toBe(false);
    expect(recorder.timers.map((timer) => timer.delayMs), "타이머 하나 · 종전과 같은 650ms").toEqual([650]);
    expect(recorder.replaced, "타이머가 아직 돌지 않았으므로 이동은 없다").toEqual([]);
    recorder.timers[0]!.run();
    expect(recorder.replaced, "타이머가 돌면 예전 그대로 목적지로 간다").toEqual(["/(tabs)/records"]);
  });

  it("늦게 실패하는 무효화에서도 확정은 성공으로 남는다(실패로 뒤집히지 않는다)", async () => {
    const cache = await cacheWith(ENTRY_KEYS, "reject-late");
    const recorder = newRecorder();
    const handler = runnableHandler(
      entrySuccessBody(),
      entryDeps(cache.client, recorder, { continueRecording: true, linkedItemTemplateId: "tpl-1" })
    );

    const commit = await commitOf(cache.client, handler);
    cache.release();
    await tick();

    expect(commit.settled).toBe(true);
    expect(commit.isSuccess, "저장은 이미 기기에서 확정됐다 — 재조회 실패가 그것을 뒤집지 않는다").toBe(true);
    expect(commit.isError).toBe(false);
    expect(recorder.resetFormCalls).toBe(1);
  });

  it("무효화는 여전히 여섯 키 전부에서 일어난다 — 없앤 것이 아니라 기다리지 않을 뿐이다", async () => {
    const cache = await cacheWith(ENTRY_KEYS, "settle");
    const recorder = newRecorder();
    const handler = runnableHandler(
      entrySuccessBody(),
      entryDeps(cache.client, recorder, { continueRecording: true, linkedItemTemplateId: "tpl-1" })
    );

    const commit = await commitOf(cache.client, handler);
    // 확정은 이미 끝났고, 무효화 사슬은 그 뒤에 이어서 돈다 — 그것이 끝나기를 여기서 기다린다.
    for (let round = 0; round < 20; round += 1) await tick();

    expect(commit.settled).toBe(true);
    for (const queryKey of ENTRY_KEYS) {
      expect(cache.fetchCount(queryKey), `${JSON.stringify(queryKey)}가 재조회되지 않았다`).toBe(2);
    }
  });

  it("연결이 없는 기록은 준비템 두 키를 건드리지 않는다 — 조건 분기가 그대로다", async () => {
    const cache = await cacheWith(ENTRY_KEYS, "settle");
    const recorder = newRecorder();
    const handler = runnableHandler(
      entrySuccessBody(),
      entryDeps(cache.client, recorder, { continueRecording: true, linkedItemTemplateId: null })
    );

    await commitOf(cache.client, handler);
    for (let round = 0; round < 20; round += 1) await tick();

    for (const queryKey of [["expenses"], ["home"], ["report"], ["budget"]] as const) {
      expect(cache.fetchCount(queryKey), `${JSON.stringify(queryKey)}`).toBe(2);
    }
    for (const queryKey of [["items"], ["item-detail"]] as const) {
      expect(cache.fetchCount(queryKey), `연결 없는 기록이 ${JSON.stringify(queryKey)}를 건드렸다`).toBe(1);
    }
  });
});

describe("ⓒ 지출 수정·삭제 — app/expenses/[expenseId].tsx의 두 onSuccess 본문을 그대로 돌린다", () => {
  it("수정 저장 — 끝나지 않는 무효화 아래에서도 확정되고 650ms 타이머가 걸린다", async () => {
    const cache = await cacheWith(DETAIL_SAVE_KEYS, "hang");
    const recorder = newRecorder();
    const handler = runnableHandler(detailSuccessBody("save"), detailDeps(cache.client, recorder));

    const commit = await commitOf(cache.client, handler);

    expect(commit.settled).toBe(true);
    expect(commit.isPending, "수정 저장 버튼의 잠금이 풀린다").toBe(false);
    expect(recorder.savedMessages).toEqual(["기기 저장 문구"]);
    expect(recorder.timers.map((timer) => timer.delayMs)).toEqual([650]);
    expect(recorder.leftAfterMutation, "타이머가 돌기 전에는 화면을 떠나지 않는다").toBe(0);
    expect(cache.fetchCount(["expenses"]), "무효화는 떠 있다").toBe(2);
  });

  it("수정 저장 — 응답이 오는 자리에서는 네 키가 전부 다시 불린다", async () => {
    const cache = await cacheWith(DETAIL_SAVE_KEYS, "settle");
    const recorder = newRecorder();
    const handler = runnableHandler(detailSuccessBody("save"), detailDeps(cache.client, recorder));

    await commitOf(cache.client, handler);
    for (let round = 0; round < 20; round += 1) await tick();

    for (const queryKey of DETAIL_SAVE_KEYS) {
      expect(cache.fetchCount(queryKey), `${JSON.stringify(queryKey)}가 재조회되지 않았다`).toBe(2);
    }
  });

  it("삭제 — 끝나지 않는 무효화 아래에서도 확정되고, 세 키는 그대로 무효화된다", async () => {
    const hanging = await cacheWith(DETAIL_DELETE_KEYS, "hang");
    const hangingRecorder = newRecorder();
    const commit = await commitOf(
      hanging.client,
      runnableHandler(detailSuccessBody("remove"), detailDeps(hanging.client, hangingRecorder))
    );

    expect(commit.settled).toBe(true);
    expect(commit.isPending).toBe(false);
    expect(hangingRecorder.timers.map((timer) => timer.delayMs)).toEqual([650]);

    const settling = await cacheWith(DETAIL_DELETE_KEYS, "settle");
    const settlingRecorder = newRecorder();
    await commitOf(
      settling.client,
      runnableHandler(detailSuccessBody("remove"), detailDeps(settling.client, settlingRecorder))
    );
    for (let round = 0; round < 20; round += 1) await tick();
    for (const queryKey of DETAIL_DELETE_KEYS) {
      expect(settling.fetchCount(queryKey), `${JSON.stringify(queryKey)}가 재조회되지 않았다`).toBe(2);
    }
  });
});

describe("ⓓ 하네스 자신 — 이 파일이 재는 것이 정말 화면의 본문이다", () => {
  it("세 본문이 실제로 무효화를 담고 있다(빈 구간을 돌리고 초록이 되는 일이 없다)", () => {
    const bodies = [entrySuccessBody(), detailSuccessBody("save"), detailSuccessBody("remove")];
    const counted = bodies.map((body) => (body.match(/queryClient\.invalidateQueries\(/g) ?? []).length);
    expect(counted, "기록 시트 여섯 · 수정 넷 · 삭제 셋").toEqual([6, 4, 3]);
  });

  it("하네스에 없는 이름을 참조하면 그 이름을 말하며 빨개진다", async () => {
    const handler = runnableHandler("이런이름은없다();", {});
    await expect(handler()).rejects.toThrow(SCOPE_MISS_PREFIX);
  });
});

describe("ⓔ 이 하네스가 재는 isPending이 곧 버튼의 잠금이다 (화면은 렌더되지 않으므로 소스로 잇는다)", () => {
  it("세 버튼이 그 뮤테이션의 isPending으로 잠기고 라벨을 바꾼다", () => {
    const entry = source("app/expenses/new.tsx");
    expect(entry).toContain("disabled={saveExpense.isPending || isSaveBlocked}");
    expect(entry).toContain('label={saveExpense.isPending ? "저장하는 중"');
    const detail = source("app/expenses/[expenseId].tsx");
    expect(detail).toContain("save.isPending");
    expect(detail).toContain("remove.isPending");
  });
});
