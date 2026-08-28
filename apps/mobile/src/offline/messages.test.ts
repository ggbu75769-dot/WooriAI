import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_CREATE_FAILED_MESSAGE } from "../expenses/save-error-messages";
import { OFFLINE_AWARE_LOAD_ERROR_SCREENS } from "./offline-aware-screens";
import {
  CONFLICT_BANNER_MESSAGE,
  FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE,
  FAILED_ROW_PREFILL_DATE_RESET_NOTICE,
  SYNC_STATUS_FIX_AND_RESEND_LABEL,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  OFFLINE_SAVED_MESSAGE,
  SERVER_CONFIRMED_MESSAGE,
  LOAD_ERROR_NOTICE,
  LOAD_ERROR_RETRY_LABEL,
  OFFLINE_LOAD_NOTICE,
  OFFLINE_RETRY_NOTICE,
  OFFLINE_SAVE_NOTICE,
  resolveLoadErrorCopy,
  resolveSaveErrorCopy,
  SAVE_ERROR_NOTICE,
  syncStatusBadgeLabel,
  syncStatusCountLabel,
  SYNC_ROW_CONFLICT_LABEL,
  SYNC_ROW_FAILED_LABEL,
  SYNC_ROW_PENDING_DELETE_LABEL,
  SYNC_ROW_PENDING_LABEL,
  SYNC_ROW_UNSENDABLE_LABEL,
  recordsCountPhrase,
  unsendableRecordsSuffixText,
  unsendableRowsNoticeText,
  SYNC_STATUS_CONFLICT_LABEL,
  SYNC_STATUS_FAILED_LABEL,
  SYNC_STATUS_PENDING_LABEL,
  SYNC_STATUS_SYNCING_LABEL
} from "./messages";

describe("MOB-102 offline copy (round5a-sprint1-plan.md §3.3, §3.4)", () => {
  it("matches the design doc's exact offline-save and server-confirmed copy", () => {
    expect(OFFLINE_SAVED_MESSAGE).toBe("기기에 저장했어요. 연결되면 자동으로 반영할게요.");
    expect(SERVER_CONFIRMED_MESSAGE).toBe("기록했어요. 이번 달 우리 아이 비용에 더해둘게요.");
  });

  it("matches the design doc's exact conflict banner and three option labels", () => {
    expect(CONFLICT_BANNER_MESSAGE).toBe("다른 기기에서 이 기록이 바뀌었어요.");
    expect(CONFLICT_OPTION_ADOPT_SERVER_LABEL).toBe("다른 기기 값 유지");
    expect(CONFLICT_OPTION_REAPPLY_MINE_LABEL).toBe("내 변경 다시 적용");
    expect(CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL).toBe("두 값 나란히 보기");
  });

  it("keeps the offline-saved and server-confirmed messages distinct (no silent success language mixup)", () => {
    expect(OFFLINE_SAVED_MESSAGE).not.toBe(SERVER_CONFIRMED_MESSAGE);
  });
});

describe("REC-123(H4) 동기화 상태 문구 단일 소스", () => {
  const mobileRoot = process.cwd();
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

  it("pins the short status names actually shown on both screens' count badges", () => {
    expect(SYNC_STATUS_PENDING_LABEL).toBe("대기");
    expect(SYNC_STATUS_SYNCING_LABEL).toBe("동기화 중");
    expect(SYNC_STATUS_FAILED_LABEL).toBe("실패");
    expect(SYNC_STATUS_CONFLICT_LABEL).toBe("충돌");
  });

  it("builds the badge text and the screen-reader count text from the same names", () => {
    expect(syncStatusBadgeLabel("pending", 3)).toBe("대기 3");
    expect(syncStatusBadgeLabel("failed", 0)).toBe("실패 0");
    expect(syncStatusBadgeLabel("conflict", 2)).toBe("충돌 2");
    // A11Y-115: TalkBack에서는 "대기 3"이 무엇의 3인지 모호해 단위를 붙인다.
    expect(syncStatusCountLabel("pending", 3)).toBe("대기 3건");
    expect(syncStatusCountLabel("failed", 1)).toBe("실패 1건");
    expect(syncStatusCountLabel("conflict", 2)).toBe("충돌 2건");
  });

  it("keeps the records-list row subtitles explicit (they sit among ordinary expense rows)", () => {
    expect(SYNC_ROW_PENDING_LABEL).toBe("동기화 대기");
    expect(SYNC_ROW_FAILED_LABEL).toBe("동기화 실패 · 확인 필요");
    expect(SYNC_ROW_CONFLICT_LABEL).toBe("다른 기기와 충돌 · 확인 필요");
    expect(SYNC_ROW_PENDING_DELETE_LABEL).toBe("삭제 대기 중");
    for (const label of [SYNC_ROW_PENDING_LABEL, SYNC_ROW_FAILED_LABEL, SYNC_ROW_CONFLICT_LABEL, SYNC_ROW_PENDING_DELETE_LABEL]) {
      expect(label, `"${label}" must stay a plain, non-technical phrase (DNC-018)`).not.toMatch(/sync|SYNC|error|Error/);
    }
  });

  it("is the only place the two screens get this copy from -- neither inlines a status word again", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    const syncStatusSource = source("app/sync-status.tsx");
    for (const [name, screenSource] of [
      ["records", recordsSource],
      ["sync-status", syncStatusSource]
    ] as const) {
      expect(screenSource, `${name} imports the copy`).toContain('src/offline/messages"');
      // 인라인 재발 방지: 상태 이름 + 카운트를 화면에서 직접 조립하던 형태
      // (`대기 ${n}` / `충돌 ${n}건` 등)가 다시 나타나면 실패한다.
      expect(screenSource, `${name} must not rebuild a status label inline`).not.toMatch(/`(대기|실패|충돌|동기화 대기|동기화 실패) \$\{/);
    }
    expect(recordsSource).toContain("syncStatusBadgeLabel(");
    expect(recordsSource).toContain("syncStatusCountLabel(");
    expect(syncStatusSource).toContain("syncStatusBadgeLabel(");
  });
});

describe("라운드 58 #5 '고쳐서 다시 보내기' 문구", () => {
  it("행동을 그대로 말하는 문장형 라벨이다 ('수정'이 아니다 — 서버에 없는 기록이다)", () => {
    expect(SYNC_STATUS_FIX_AND_RESEND_LABEL).toBe("고쳐서 다시 보내기");
  });

  it("날짜 폴백 안내는 지금 상태와 다음에 할 일만 말한다 (DNC-018 해요체, 비난 없음)", () => {
    expect(FAILED_ROW_PREFILL_DATE_RESET_NOTICE).toBe("그 날짜로는 저장할 수 없어서 오늘로 두었어요. 맞는 날짜를 골라 주세요.");
    expect(FAILED_ROW_PREFILL_DATE_RESET_NOTICE.split("\n")).toHaveLength(1);
    expect(FAILED_ROW_PREFILL_DATE_RESET_NOTICE).toMatch(/요\.$/);
    expect(FAILED_ROW_PREFILL_DATE_RESET_NOTICE).not.toMatch(/확인하세요|하십시오|오류|에러|잘못|실수/);
    // 앱이 날짜를 대신 고쳐 놓고 침묵하지 않는다는 것이 이 문장의 존재 이유다.
    expect(FAILED_ROW_PREFILL_DATE_RESET_NOTICE).toContain("오늘로 두었어요");
  });

  it("두 문구 모두 화면이 아니라 이 모듈에서 온다 (인라인 리터럴 금지)", () => {
    // 주석은 걷어내고 본다 — 화면 주석이 문구를 **설명하려고** 인용하는 것은 금지 대상이 아니다
    // (recurring-flow.test.ts의 codeOnly와 같은 관례).
    const codeOnly = (relativePath: string) =>
      readFileSync(join(process.cwd(), relativePath), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
    const syncStatus = codeOnly("app/sync-status.tsx");
    const newExpense = codeOnly("app/expenses/new.tsx");
    expect(syncStatus).not.toContain(`"${SYNC_STATUS_FIX_AND_RESEND_LABEL}"`);
    expect(newExpense).not.toContain(`"${FAILED_ROW_PREFILL_DATE_RESET_NOTICE}"`);
    expect(syncStatus).toContain("SYNC_STATUS_FIX_AND_RESEND_LABEL");
    expect(newExpense).toContain("FAILED_ROW_PREFILL_DATE_RESET_NOTICE");
  });

  /**
   * 라운드 58 통합리뷰 P1-1 — 아이 어긋남 안내. 이 문장이 뜨는 순간은 저장을 막는 순간이라,
   * 무엇이 사실이고 무엇을 하면 되는지를 한 줄에 담아야 한다(그러지 않으면 "왜 저장이 안 되지"만
   * 남는다). 조용히 지금 아이 밑으로 저장하면 아이 A의 지출이 B의 합계에 들어가고 원본 실패
   * 행까지 폐기된다 — 그래서 말한다.
   */
  it("아이 어긋남 안내는 사실과 다음에 할 일만 말한다 (DNC-018 해요체, 비난 없음)", () => {
    expect(FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE).toBe(
      "이 기록은 다른 아이의 기록이에요. 그 아이로 바꾼 뒤에 저장할 수 있어요."
    );
    expect(FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE.split("\n")).toHaveLength(1);
    expect(FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE).toMatch(/요\.$/);
    expect(FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE).not.toMatch(/확인하세요|하십시오|오류|에러|잘못|실수/);
    // 무엇을 하면 되는지가 문장 안에 있다(막기만 하고 침묵하지 않는다).
    expect(FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE).toContain("바꾼 뒤에 저장할 수 있어요");
  });
});

describe("UX-N 오프라인 조회 실패 문구", () => {
  const mobileRoot = process.cwd();
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

  it("keeps the existing copy when the device is online (server error, timeout, unknown)", () => {
    expect(resolveLoadErrorCopy({ isOnline: true })).toEqual({
      title: "불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      actionLabel: "다시 시도"
    });
    expect(LOAD_ERROR_NOTICE).toBe("불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("says the honest thing when the device is offline", () => {
    expect(resolveLoadErrorCopy({ isOnline: false }).title).toBe(OFFLINE_LOAD_NOTICE);
    expect(OFFLINE_LOAD_NOTICE).toBe("지금은 오프라인이에요. 연결된 뒤 다시 시도해 주세요.");
  });

  it("never promises an automatic reload -- FIX-118A removed the onlineManager wiring that would refetch on reconnect", () => {
    // 이 테스트는 문구와 배선을 함께 묶어 둔다: 누군가 "연결되면 자동으로"라고 약속하려면 먼저
    // 재연결 재조회를 실제로 배선해야 하고, 그러면 아래 소스 스캔이 먼저 깨져 이 결정이 드러난다.
    // (배선 부재 자체의 계약은 src/query/app-refetch.test.ts가 진다.)
    expect(OFFLINE_LOAD_NOTICE).not.toContain("자동으로");
    // 주석은 제거하고 본다 -- 해당 모듈들은 제거된 배선을 문서 주석에서 이름으로 설명한다.
    const glueCode = source("src/query/install-app-refetch.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(glueCode).not.toContain("onlineManager");
  });

  it("keeps the retry button on both branches -- offline never hides the only way back", () => {
    expect(resolveLoadErrorCopy({ isOnline: true }).actionLabel).toBe(LOAD_ERROR_RETRY_LABEL);
    expect(resolveLoadErrorCopy({ isOnline: false }).actionLabel).toBe(LOAD_ERROR_RETRY_LABEL);
    expect(LOAD_ERROR_RETRY_LABEL).toBe("다시 시도");
  });

  it("stays a 해요체 statement of fact, with no blame or alarm (DNC-018)", () => {
    for (const copy of [LOAD_ERROR_NOTICE, OFFLINE_LOAD_NOTICE]) {
      expect(copy).toMatch(/요\.$/);
      // "연결을 확인하세요"류 지시·비난, 기술 용어, 경고 톤 금지.
      expect(copy).not.toMatch(/확인하세요|하십시오|오류|에러|실패|네트워크|offline|error/i);
    }
  });

  // 라운드 39 UX-P: 남아 있던 세 화면(홈·기록·예산)까지 같은 단일 소스로 배선했다.
  // 라운드 52 C-05: 마지막으로 남아 있던 가족 화면까지 들어와, 조회 실패 카드를 그리는 화면은
  // 모두 같은 문구를 쓴다.
  // 라운드 38 H-12: 목록은 여기 다시 적지 않는다 -- 세 계약 파일이 함께 읽는 단일 소스에서 온다.
  it("is the single source for every screen wired so far", () => {
    const screens = OFFLINE_AWARE_LOAD_ERROR_SCREENS;
    expect(screens.length).toBeGreaterThan(0);
    for (const path of screens) {
      const screenSource = source(path);
      expect(screenSource, `${path} imports the shared hook`).toContain('src/offline/use-load-error-copy"');
      expect(screenSource, `${path} renders the resolved copy`).toContain("title={loadErrorCopy.title}");
      expect(screenSource, `${path} keeps the retry label from the same source`).toContain(
        "actionLabel={loadErrorCopy.actionLabel}"
      );
      // 재발 방지: 같은 화면에 옛 리터럴이 다시 인라인되면 두 문구가 갈린다.
      expect(screenSource, `${path} must not inline the old copy again`).not.toContain(
        'title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."'
      );
    }
  });

  /**
   * 라운드 38 H-12: 위 목록(src/offline/offline-aware-screens.ts)이 현실과 갈라지지 않게 한다.
   *
   * 그 목록은 세 계약 파일(여기 · screen-phase.test.ts · loading-skeleton-contract.test.ts)이
   * 함께 읽는 단일 소스라, 새 화면을 배선하고 목록에 넣는 것을 잊으면 세 계약이 **한꺼번에**
   * 그 화면을 지나쳐 간다(실제로 reports.tsx가 그렇게 두 목록 어디에도 없었다). app/**을 훑어
   * 훅을 실제로 쓰는 화면 집합과 목록이 정확히 같은지 확인한다.
   */
  it("라운드 38 H-12: 목록이 useLoadErrorCopy를 실제로 쓰는 화면 집합과 정확히 일치한다", () => {
    const appRoot = join(mobileRoot, "app");
    const wired: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        if (!readFileSync(fullPath, "utf8").includes("useLoadErrorCopy(")) continue;
        // 목록은 mobile 루트 기준 상대 경로(POSIX 구분자)로 적는다.
        wired.push(relative(mobileRoot, fullPath).split(sep).join("/"));
      }
    };
    walk(appRoot);

    expect(wired.sort()).toEqual([...OFFLINE_AWARE_LOAD_ERROR_SCREENS].sort());
  });

  /**
   * 라운드 39 UX-P: 홈은 실패 시 화면 전체가 카드 하나로 대체되므로(early return) FAB도 빠른
   * 기록 버튼도 함께 사라진다. "기록은 지금도 남길 수 있어요"는 사실이지만(SQLite 우선 저장),
   * 그 자리에서 할 수 없다면 못 지킬 약속이 된다 -- 그래서 문장과 입구를 함께 고정한다.
   */
  it("라운드 39 UX-P: 홈 실패 카드만 보조문을 달고, 그 문장이 약속하는 입구를 같이 내준다", () => {
    const hookSource = source("src/offline/use-load-error-copy.ts");
    expect(hookSource).toContain('export const OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE = "기록은 지금도 남길 수 있어요.";');
    expect(hookSource).toContain('export const OFFLINE_RECORDING_ENTRY_LABEL = "지금 기록하기";');

    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("{OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE}");
    expect(homeSource).toContain(
      '<TextButton label={OFFLINE_RECORDING_ENTRY_LABEL} onPress={() => router.push("/expenses/new")} />'
    );

    // 기록·예산 화면에는 붙이지 않는다 -- 문구만 오프라인 인지로 갈리고 구조는 그대로다.
    for (const path of ["app/(tabs)/records.tsx", "app/budget.tsx"] as const) {
      expect(source(path), path).not.toContain("OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE");
    }
  });

  it("라운드 52 C-05: 오프라인 문장은 조회 카드 밖에서도 같은 단일 소스에서 온다", () => {
    // 이름만 다를 뿐 같은 문장이다 -- 구성원 삭제·초대 취소 실패가 이 상수를 읽는다
    // (src/family/member-mutation-messages.ts).
    expect(OFFLINE_RETRY_NOTICE).toBe(OFFLINE_LOAD_NOTICE);
  });

  it("probes connectivity once per error, from the existing isCurrentlyOnline helper", () => {
    const hookSource = source("src/offline/use-load-error-copy.ts");
    expect(hookSource).toContain('from "./connectivity"');
    expect(hookSource).toContain("isCurrentlyOnline()");
    expect(hookSource).toContain("resolveLoadErrorCopy(");
    // 판정 실패/미확정 시 기존 문구로 떨어지는 안전 폴백(웹은 isCurrentlyOnline이 항상 true).
    expect(hookSource).toContain("useState(true)");
    // 문구 리터럴은 messages.ts에만 있다 -- 훅은 문자열을 만들지 않는다.
    expect(hookSource).not.toContain("불러오지 못했어요");
    expect(hookSource).not.toContain("오프라인이에요");
  });
});

/**
 * 라운드 52 C-07 — 서버 직행 저장(월 예산 · 아이 프로필)의 실패 문구.
 *
 * 지출 기록은 SQLite 우선이라 오프라인에서도 성공하지만, 이 두 쓰기는 아웃박스를 거치지 않아
 * 그냥 실패한다. 그런데도 두 화면은 원인과 무관하게 "잠시 후 다시 시도해 주세요."만 띄웠다.
 */
describe("UX/C-07 저장 실패 문구", () => {
  const mobileRoot = process.cwd();
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

  it("온라인 실패는 종전 문구 그대로다", () => {
    expect(resolveSaveErrorCopy({ isOnline: true })).toBe("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(SAVE_ERROR_NOTICE).toBe("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    // 같은 실패가 화면마다 다르게 들리지 않게, 지출 저장 실패 문구와 글자까지 같다.
    expect(SAVE_ERROR_NOTICE).toBe(EXPENSE_CREATE_FAILED_MESSAGE);
  });

  it("오프라인이면 기다릴 대상이 없다는 사실을 말한다", () => {
    expect(resolveSaveErrorCopy({ isOnline: false })).toBe(OFFLINE_SAVE_NOTICE);
    expect(OFFLINE_SAVE_NOTICE).toBe("지금은 오프라인이에요. 연결된 뒤 다시 저장해 주세요.");
  });

  it("자동 저장을 약속하지 않는다 -- 예산·아이 프로필에는 담아 둘 대기열이 없다", () => {
    // 약속하려면 먼저 대기열을 만들어야 하고, 그러면 이 테스트가 먼저 깨져 그 결정이 드러난다.
    expect(OFFLINE_SAVE_NOTICE).not.toContain("자동");
    expect(OFFLINE_SAVE_NOTICE).not.toContain("연결되면");
    // 아웃박스가 실제로 받아 주는 지출 저장 문구와는 다른 문장이어야 한다.
    expect(OFFLINE_SAVE_NOTICE).not.toBe(OFFLINE_SAVED_MESSAGE);
  });

  it("DNC-018: 해요체 사실 진술이고 비난·기술 용어가 없다", () => {
    for (const copy of [SAVE_ERROR_NOTICE, OFFLINE_SAVE_NOTICE]) {
      expect(copy).toMatch(/요\.$/);
      expect(copy).not.toMatch(/확인하세요|하십시오|오류|에러|네트워크|offline|error/i);
    }
  });

  /**
   * 라운드 52 QA P3-1 — 두 화면의 손배선을 공용 훅으로 모았다.
   *
   * 예전에는 각 화면의 `onError`가 직접 `isCurrentlyOnline().then(setState)`를 띄웠다. 저장
   * 실패 직후 화면을 떠나면(가장 흔한 반응) 사라진 화면에 setState가 걸리고, 연달아 실패하면
   * 늦게 도착한 옛 판정이 최신 판정을 덮어쓸 수 있었으며, 한 번 오프라인 문구가 된 상태는
   * 연결이 돌아와도 복원되지 않았다. 조회 실패 카드(useLoadErrorCopy)가 이미 cancelled
   * 패턴으로 해결해 둔 문제들이라, 같은 파일의 같은 패턴을 쓰는 훅 하나로 모은다.
   */
  it("두 화면이 옛 리터럴 대신 공용 훅을 쓰고, 그 훅이 실패 시점에 연결을 확인한다", () => {
    for (const path of ["app/budget.tsx", "app/settings/children.tsx"] as const) {
      const screenSource = source(path);
      expect(screenSource, `${path} uses the shared hook`).toContain("useSaveErrorCopy(");
      expect(screenSource, `${path} imports it from the shared wiring layer`).toContain(
        'src/offline/use-load-error-copy"'
      );
      // 화면이 직접 폴을 띄우지 않는다 -- 그 자리가 언마운트·레이스 구멍이었다.
      expect(screenSource, `${path} must not poll connectivity by hand`).not.toContain("isCurrentlyOnline()");
      // 재발 방지: 고정 문구가 다시 인라인되면 오프라인에서 틀린 안내가 돌아온다.
      expect(screenSource, `${path} must not inline the old copy again`).not.toContain(
        '"저장하지 못했어요. 잠시 후 다시 시도해 주세요."'
      );
    }

    // 판정은 훅 한 곳에서 순수 함수로 내려온다.
    const hookSource = source("src/offline/use-load-error-copy.ts");
    expect(hookSource).toContain("export function useSaveErrorCopy(isError: boolean): string {");
    expect(hookSource).toContain("resolveSaveErrorCopy({ isOnline: useErrorTimeConnectivity(isError) })");
    // 조회·저장 두 훅이 **같은** cancelled 패턴 하나를 공유한다(사본이 다시 갈라지지 않게).
    expect(hookSource.match(/let cancelled = false;/g) ?? []).toHaveLength(1);
    expect(hookSource).toContain("if (!cancelled) setIsOnline(online);");
    expect(hookSource).toContain("cancelled = true;");
    // 에러가 풀리면 판정이 초기값으로 복원된다(연결이 돌아온 뒤의 실패를 오프라인이라 하지 않는다).
    expect(hookSource).toContain("if (!isError) {");

    // 예산 화면은 토스트 한 곳, 아이 관리 화면은 세 뮤테이션(편집·출생 전환·추가)이 같은 자리를 쓴다.
    expect(source("app/budget.tsx")).toContain("<Toast message={saveErrorText} tone=\"error\" />");
    expect(source("app/budget.tsx")).toContain("const saveErrorText = useSaveErrorCopy(save.isError);");
    expect(source("app/settings/children.tsx")).toContain(
      "const saveFailedText = useSaveErrorCopy(saveEdit.isError || markChildBorn.isError || addChild.isError);"
    );
    expect(source("app/settings/children.tsx").match(/\{saveFailedText\}/g) ?? []).toHaveLength(3);
  });
});

/**
 * 라운드 59 트랙 A — **"동기화 대기"와 "보낼 수 없는 기록"은 다른 말이다.**
 *
 * 영구 실패(4xx) 행은 기다려도 반영되지 않는다. 그 행까지 "대기 중"이라고 부르던 세 자리(기록 탭
 * 고지·리포트 고지·CSV 고지)가 이제 어휘를 가른다. 조각은 이 파일이 단일 소스로 정하고, 세 자리는
 * 조립만 한다 -- 같은 사실을 화면마다 다른 말로 부르지 않기 위해서다(REC-123(H4)).
 */
describe("라운드 59 트랙 A 영구 실패 어휘", () => {
  it("상태 이름이 아니라 '할 수 없는 일'로 부른다 (일시 실패와 섞이지 않게)", () => {
    expect(SYNC_ROW_UNSENDABLE_LABEL).toBe("보낼 수 없는 기록");
    // 배지의 짧은 라벨("실패")을 재사용하지 않는다 -- 그 배지는 5xx·네트워크 실패까지 함께 센다.
    expect(SYNC_ROW_UNSENDABLE_LABEL).not.toBe(SYNC_STATUS_FAILED_LABEL);
    expect(SYNC_ROW_UNSENDABLE_LABEL).not.toContain(SYNC_ROW_PENDING_LABEL);
  });

  it("주어는 수식을 떼기만 한다 ('대기'도 '전부 실패'도 아니다 — 통합리뷰 P1-1)", () => {
    expect(recordsCountPhrase(5)).toBe("기록 5건");
    expect(recordsCountPhrase(5)).not.toContain(SYNC_ROW_PENDING_LABEL);
    expect(recordsCountPhrase(5)).not.toContain(SYNC_ROW_UNSENDABLE_LABEL);
    // 주어가 스스로 무엇을 단언하지 않는다 -- 참인 관측은 뒤따르는 술어("…에 아직 반영되지
    // 않았어요")가 말하고, 그 술어는 영구 실패가 섞이든 아니든 같은 문장이다.
    expect(recordsCountPhrase(5)).not.toContain("반영");
    expect(recordsCountPhrase(5)).not.toContain("빠져");
  });

  it("내역 문장은 어휘를 다시 적지 않고 라벨에서 만든다 (해요체 DNC-018)", () => {
    expect(unsendableRecordsSuffixText(2)).toBe("그중 2건은 보낼 수 없는 기록이에요.");
    expect(unsendableRowsNoticeText(2)).toBe("이 중 2건은 보낼 수 없는 기록이에요.");
    for (const text of [unsendableRecordsSuffixText(1), unsendableRowsNoticeText(1)]) {
      expect(text).toContain(SYNC_ROW_UNSENDABLE_LABEL);
      expect(text.endsWith("요.")).toBe(true);
      expect(text.split("\n")).toHaveLength(1);
      // 비난·지시 없음: 무엇을 하라고 시키지 않는다(다음 행동은 동기화 상태 화면이 말한다).
      expect(text).not.toContain("해 주세요");
    }
  });

  it("기록 탭만 '이 중'인 이유는 지시 대상이 문장이 아니라 화면이기 때문이다", () => {
    expect(unsendableRowsNoticeText(3).startsWith("이 중")).toBe(true);
    expect(unsendableRecordsSuffixText(3).startsWith("그중")).toBe(true);
    // 나머지는 글자까지 같은 문장이다(두 자리가 갈라지지 않게).
    expect(unsendableRowsNoticeText(3).slice("이 중".length)).toBe(
      unsendableRecordsSuffixText(3).slice("그중".length)
    );
  });
});
