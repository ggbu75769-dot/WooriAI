import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_CREATE_FAILED_MESSAGE } from "../expenses/save-error-messages";
// 라운드 70 트랙 B: 저장 실패 문구가 지나게 된 화이트리스트 표(문구를 여기 다시 적지 않는다).
import { API_ERROR_MESSAGES, ApiHttpError } from "../api/api-error";
import { CHILD_BIRTH_DATE_TOO_OLD_ERROR } from "../children/child-form";
// 라운드 69 트랙 A(#1): 같은 사실을 말하는 두 자리 — 정기 지출 관리 화면의 고지와 로그아웃 줄.
import { RECURRING_DEVICE_ONLY_NOTICE } from "../expenses/recurring-template";
import {
  OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS,
  OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS,
  OFFLINE_AWARE_LOAD_ERROR_SCREENS,
  OFFLINE_AWARE_SAVE_ERROR_EXEMPT_SCREENS,
  OFFLINE_AWARE_SAVE_ERROR_SCREENS
} from "./offline-aware-screens";
import {
  CONFLICT_BANNER_MESSAGE,
  FAILED_ROW_OTHER_CHILD_NOTICE,
  FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE,
  FAILED_ROW_PREFILL_DATE_RESET_NOTICE,
  SYNC_STATUS_FIX_AND_RESEND_LABEL,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  OFFLINE_SAVED_MESSAGE,
  OFFLINE_STORAGE_UNAVAILABLE_NOTICE,
  OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE,
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
  countLogoutPendingRecords,
  logoutConfirmMessage,
  LOGOUT_CONFIRM_BASE_MESSAGE,
  LOGOUT_CONFIRM_TITLE,
  LOGOUT_COUNTED_TEARDOWN_STORES,
  LOGOUT_UNCOUNTED_TEARDOWN_STORES,
  syncStatusDiscardAllConfirmMessage,
  SESSION_EXPIRED_LOGIN_NOTICE,
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
  // 라운드 72 트랙 B: 목록의 셋은 카드가 아니다(Card+Text+버튼 둘 · 요약 한 줄 하나).
  // 그 사실과 이유는 이 파일이 손으로 적지 않는다 -- 목록과 같은 단일 소스에서 온다.
  it("is the single source for every screen wired so far", () => {
    const screens = OFFLINE_AWARE_LOAD_ERROR_SCREENS;
    expect(screens.length).toBeGreaterThan(0);
    for (const path of screens) {
      const screenSource = source(path);
      expect(screenSource, `${path} imports the shared hook`).toContain('src/offline/use-load-error-copy"');
      const nonCardReason = OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS[path];
      if (nonCardReason) {
        // 예외는 **이유가 값으로 남아 있을 때만** 예외다(빈 문자열로 목록을 늘릴 수 없다).
        expect(nonCardReason.length, `${path}의 예외 사유가 값으로 남아 있다`).toBeGreaterThan(30);
        // 카드가 아니어도 판정은 같은 훅에서 온다 -- 화면이 문구를 스스로 고르지 않는다.
        expect(screenSource, `${path} still resolves its copy through the shared hook`).toContain(
          "= useLoadErrorCopy("
        );
      } else {
        expect(screenSource, `${path} renders the resolved copy`).toContain("title={loadErrorCopy.title}");
        expect(screenSource, `${path} keeps the retry label from the same source`).toContain(
          "actionLabel={loadErrorCopy.actionLabel}"
        );
      }
      // 재발 방지: 같은 화면에 옛 리터럴이 다시 인라인되면 두 문구가 갈린다.
      expect(screenSource, `${path} must not inline the old copy again`).not.toContain(
        'title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."'
      );
    }
  });

  /**
   * 라운드 72 트랙 B — 예외 목록이 **목록의 부분집합**이고, 그 밖으로 자라지 않는다.
   *
   * 예외를 값으로 적어 두는 것의 값은 "이유가 어딘가에 있다"가 아니라 **다음 라운드가 이 자리를
   * 다시 세지 않는다**는 것이다. 그래서 두 방향을 함께 고정한다: 예외에 적힌 화면은 반드시
   * 목록 안에 있고(배선된 화면만 예외가 될 수 있다), 예외가 아닌 화면은 카드 계약을 그대로 진다
   * (위 루프의 else 갈래).
   */
  it("라운드 72 트랙 B: 카드 아닌 자리의 예외는 목록 안에서만 산다", () => {
    for (const path of Object.keys(OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS)) {
      expect(OFFLINE_AWARE_LOAD_ERROR_SCREENS, `${path}는 목록 안의 화면이다`).toContain(path);
    }
    // 오늘의 여섯(라운드 73 E가 초대 화면을, 라운드 74 D가 검수·개인정보 두 화면을 더했다).
    // 늘어나면 이 줄이 먼저 빨개지고, 늘린 라운드가 이유를 함께 적게 된다.
    expect(Object.keys(OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS).sort()).toEqual([
      "app/family/accept/[token].tsx",
      "app/import/[importJobId].tsx",
      "app/settings/children.tsx",
      "app/settings/index.tsx",
      "app/settings/notifications.tsx",
      "app/settings/privacy.tsx"
    ]);
    // 라운드 74 트랙 D — 이 여섯 중 둘은 **한 화면 안에 자리가 여럿**이다(검수 둘 · 개인정보 넷).
    // 그래서 이유가 자리 모양만이 아니라 "왜 자리마다 훅을 하나씩 부르는가"까지 적는다.
    for (const path of ["app/import/[importJobId].tsx", "app/settings/privacy.tsx"] as const) {
      expect(OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS[path], path).toContain("자리마다");
    }
  });

  /**
   * 라운드 73 트랙 E — **배선하지 않기로 한 자리도 값이다.**
   *
   * L-2는 여덟 라운드 동안 `app/(onboarding)/prepared-items.tsx`의 한 줄을 "남은 P3"로 이월했다.
   * 이번 라운드가 그 자리를 다시 재어 보니 배선이 답이 아니었는데(공용 문장은 [다시 시도]를
   * 가리키는데 그 자리에는 그 버튼이 없고, 이미 더 구체적인 탈출구 문장이 있다), **"배선하지
   * 않는다"는 판정은 어떤 단언도 깨지 않는다.** 그래서 제외를 목록으로 적고, 그 목록이
   * 두 방향으로 사실과 묶여 있게 한다 — 제외는 배선 목록 밖에 있고, 실제로 훅을 부르지 않는다.
   */
  it("라운드 73 트랙 E: 제외 목록은 이유를 지고, 배선 목록과 겹치지 않는다 (L-2 이월 종결)", () => {
    const exempt = Object.entries(OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS);
    expect(exempt.length).toBeGreaterThan(0);
    for (const [path, reason] of exempt) {
      // 이유가 값으로 남아 있을 때만 제외다(빈 문자열로 목록을 늘릴 수 없다).
      expect(reason.length, `${path}의 제외 사유가 값으로 남아 있다`).toBeGreaterThan(30);
      expect(OFFLINE_AWARE_LOAD_ERROR_SCREENS, `${path}는 배선 목록 밖이다`).not.toContain(path);
      // 제외해 놓고 조용히 배선돼 있지 않다(그 반대도 아니다 — 위 스윕이 그쪽을 본다).
      expect(source(path), `${path}는 공용 훅을 부르지 않는다`).not.toContain("useLoadErrorCopy(");
    }
    expect(Object.keys(OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS)).toEqual([
      "app/(onboarding)/prepared-items.tsx"
    ]);
    // 그 화면의 문구·분기는 이 라운드가 손대지 않는다 — 제외의 근거가 되는 그 모양 그대로다.
    const preparedItems = source("app/(onboarding)/prepared-items.tsx");
    expect(preparedItems).toContain("{!isLoadingOptions && !hasOptions ? (");
    expect(preparedItems).toContain(
      '"준비물 목록을 불러오지 못했어요. 이 단계는 건너뛰고 나중에 준비템 탭에서 체크해도 돼요."'
    );
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

  /**
   * 라운드 72 트랙 B(GAP-072 #2) — L-2가 세어 둔 옛 리터럴 넷의 배선.
   *
   * 네 자리의 공통 규율은 하나다: **온라인 갈래는 종전과 바이트 단위로 같고**, 오프라인 갈래만
   * 공용 단일 소스 문장으로 갈린다. 그래서 아래 단언들은 새 문구를 고정하는 것이 아니라
   * (문구는 이 파일 위쪽이 이미 고정한다) **종전 문자열이 그대로 나온다는 사실**을 고정한다.
   */
  describe("라운드 72 트랙 B: 설정·가족 네 자리의 오프라인 인지 배선", () => {
    it("아이 관리(SET-005)의 조회 실패 카드가 공용 문구·라벨을 그대로 받는다", () => {
      const src = source("app/settings/children.tsx");
      expect(src).toContain("const loadErrorCopy = useLoadErrorCopy(children.isError);");
      expect(src).toContain("<Text style={{ color: theme.colors.danger }}>{loadErrorCopy.title}</Text>");
      // 카드 구조·[다시 시도] 버튼·재조회 대상은 그대로다(문구만 갈린다).
      expect(src).toContain("<SecondaryButton label={loadErrorCopy.actionLabel} onPress={() => children.refetch()} />");
      // 종전 두 리터럴은 공용 상수와 **같은 값**이라 온라인 화면이 한 글자도 바뀌지 않는다.
      expect(LOAD_ERROR_NOTICE).toBe("불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      expect(LOAD_ERROR_RETRY_LABEL).toBe("다시 시도");
    });

    it("알림 설정(SET-006)은 주어만 더하고, 오프라인 갈래에는 그 주어를 붙이지 않는다", () => {
      const src = source("app/settings/notifications.tsx");
      expect(src).toContain("const devicesLoadErrorCopy = useLoadErrorCopy(devices.isError);");
      expect(src).toContain("? devicesLoadErrorCopy.title");
      expect(src).toContain(": `기기 목록을 ${devicesLoadErrorCopy.title}`");
      expect(src).toContain("<Text style={errorTextStyle}>{devicesLoadErrorText}</Text>");
      expect(src).toContain(
        "<SecondaryButton label={devicesLoadErrorCopy.actionLabel} onPress={() => devices.refetch()} />"
      );
      // 온라인 갈래 바이트 불변: 접두 + 공용 문장이 종전 문자열과 정확히 같다.
      expect(`기기 목록을 ${LOAD_ERROR_NOTICE}`).toBe("기기 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      // "기기 목록을 지금은 오프라인이에요…"는 문장이 아니다 -- 오프라인 갈래는 공용 문장 그대로다.
      expect(`기기 목록을 ${OFFLINE_LOAD_NOTICE}`).not.toBe(OFFLINE_LOAD_NOTICE);
    });

    it("설정 요약 줄(SET-001)은 판정만 공유하고, 문구는 같은 문장의 앞 문장을 잘라 쓴다", () => {
      const src = source("app/settings/index.tsx");
      // 연결 판정은 공용 훅 하나 -- 이 화면은 isCurrentlyOnline을 손으로 다시 적지 않는다.
      expect(src).toContain("const loadErrorCopy = useLoadErrorCopy(children.isError || members.isError);");
      expect(src).not.toContain("isCurrentlyOnline()");
      expect(src).not.toContain('/offline/connectivity"');
      expect(src).toContain(
        'const summaryErrorText = loadErrorCopy.title === OFFLINE_LOAD_NOTICE ? summaryOfflineText : summaryUnavailableText;'
      );
      // 온라인 갈래는 종전 문자열 그대로다.
      expect(src).toContain('const summaryUnavailableText = "불러오지 못했어요";');
      // 새 문구 0건: 오프라인 갈래는 공용 문장에서 잘라 만든다(화면에 리터럴이 없다).
      expect(src).toContain(
        'const summaryOfflineText = OFFLINE_LOAD_NOTICE.slice(0, OFFLINE_LOAD_NOTICE.indexOf(".") + 1);'
      );
      expect(src).not.toContain("지금은 오프라인이에요");
      // 그 잘라내기가 무엇을 만드는지 값으로 못박는다(공용 문장이 바뀌면 여기가 먼저 빨개진다).
      expect(OFFLINE_LOAD_NOTICE.slice(0, OFFLINE_LOAD_NOTICE.indexOf(".") + 1)).toBe("지금은 오프라인이에요.");
    });

    it("가족 화면의 대기 초대 줄은 같은 파일의 기존 판정을 읽는다(둘째 훅 금지)", () => {
      const src = source("app/family/index.tsx");
      // 구성원 목록 카드가 이미 부르는 그 훅 하나뿐이다 -- 화면당 폴 한 번이라는 관례.
      expect(src.match(/useLoadErrorCopy\(/g) ?? []).toHaveLength(1);
      expect(src).toContain("const loadErrorCopy = useLoadErrorCopy(members.isError);");
      expect(src).toContain(
        "loadErrorCopy.title === OFFLINE_LOAD_NOTICE ? loadErrorCopy.title : FAMILY_PENDING_INVITE_LOAD_ERROR_TEXT;"
      );
      expect(src).toContain("<Text style={familyInviteErrorStyle}>{pendingInviteLoadErrorText}</Text>");
      // 온라인 갈래 바이트 불변: 이 줄만 뒷절이 "눌러서"다(줄 자체가 버튼인 유일한 자리).
      expect(src).toContain(
        'const FAMILY_PENDING_INVITE_LOAD_ERROR_TEXT = "대기 중인 초대를 불러오지 못했어요. 눌러서 다시 시도해 주세요.";'
      );
    });
  });

  /**
   * 라운드 74 트랙 D(GAP-074 #4) — 부정 단언 스윕이 찾아낸 **화면 셋 · 자리 일곱**의 배선.
   *
   * 셋 다 공용 훅을 아예 부르지 않아 라운드 73까지의 스윕(목록 ↔ 사용 집합의 일치)을 **양쪽이
   * 일치한 채** 통과했다. 규율은 라운드 72 B·73 E와 같다: **온라인 갈래는 종전과 바이트 단위로
   * 같고**, 오프라인 갈래만 공용 단일 소스 문장으로 갈린다. 그래서 아래 단언들은 새 문구를
   * 고정하지 않고 **종전 문자열이 그대로 나온다는 사실**과 **자리마다 자기 판정을 그린다는
   * 사실**을 고정한다.
   */
  describe("라운드 74 트랙 D: 지출 상세 · 파기 미리보기 넷 · 검수 조회 둘의 배선", () => {
    it("지출 상세(EXP-002)의 조회 실패 카드가 공용 문구·라벨을 그대로 받는다", () => {
      const src = source("app/expenses/[expenseId].tsx");
      expect(src).toContain("const loadErrorCopy = useLoadErrorCopy(expense.isError);");
      expect(src).toContain("title={loadErrorCopy.title}");
      expect(src).toContain("actionLabel={loadErrorCopy.actionLabel}");
      // 카드 구조·재조회 대상은 그대로다(문구만 갈린다 — EXP-002 렌더 구조 불변).
      expect(src).toContain("onPress={() => expense.refetch()}");
      // 종전 두 리터럴이 화면에서 사라졌고, 그 값은 공용 상수와 **같다**(온라인 갈래 바이트 불변).
      expect(src).not.toContain('title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."');
      expect(src).not.toContain('actionLabel="다시 시도"');
      expect(resolveLoadErrorCopy({ isOnline: true })).toEqual({
        title: "불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        actionLabel: "다시 시도"
      });
      // 이 화면은 폴을 손으로 띄우지 않는다(판정은 훅 하나).
      expect(src).not.toContain("isCurrentlyOnline()");
    });

    it("개인정보 화면(SET-003/004)은 조회 자리 넷이 각자 자기 판정을 그린다", () => {
      const src = source("app/settings/privacy.tsx");
      const wired: ReadonlyArray<[string, string]> = [
        ["privacyLoadErrorCopy", "privacy"],
        ["childPreviewLoadErrorCopy", "childPreview"],
        ["householdPreviewLoadErrorCopy", "householdPreview"],
        ["accountPreviewLoadErrorCopy", "accountPreview"]
      ];
      for (const [variable, query] of wired) {
        expect(src, `${variable}의 근거`).toContain(`const ${variable} = useLoadErrorCopy(${query}.isError);`);
        // 각 문장은 자기 자리에서 한 번씩만 쓰인다(한 판정이 네 자리에 얹히던 종전 배선의 반대).
        expect(src.match(new RegExp(`\\{${variable}\\.title\\}`, "g")) ?? [], variable).toHaveLength(1);
      }
      // 호출 수가 넷으로 고정이라 hooks 규칙에 안전하다(조건부 호출·루프 호출이 아니다).
      expect(src.match(/useLoadErrorCopy\(/g) ?? []).toHaveLength(4);
      // 고정 문자열 하나를 넷이 나눠 쓰던 종전 배선은 사라졌다.
      expect(src).not.toContain("const loadFailedText =");
      expect(src).not.toContain('"불러오지 못했어요. 잠시 후 다시 시도해 주세요."');
      // 동의 내역 카드의 [다시 시도]도 같은 단일 소스에서 온다(온라인 갈래 라벨 불변).
      expect(src).toContain(
        "<SecondaryButton label={privacyLoadErrorCopy.actionLabel} onPress={() => privacy.refetch()} />"
      );
      // ⚠️ 파괴 흐름의 **저장** 실패 배선은 한 글자도 바뀌지 않는다(라운드 71 B · 리뷰 S-4의 데모 갈래).
      expect(src).toContain("const isOnline = useErrorTimeConnectivity(isError && !isDemoSession);");
      expect(src).toContain(
        "return destructiveFlowErrorMessage(kind, error, { isOnline: isDemoSession || isOnline });"
      );
      // 정의 하나 + 저장 실패 네 자리 = 다섯(파괴 흐름 셋 + 동의 갱신 하나).
      expect(src.match(/useFlowFailureText\(/g) ?? []).toHaveLength(5);
    });

    it("검수 화면(IMP-004)은 조회 둘만 배선하고, K-10 경고 자리는 그대로다", () => {
      const src = source("app/import/[importJobId].tsx");
      expect(src).toContain("const jobLoadErrorCopy = useLoadErrorCopy(job.isError);");
      expect(src).toContain("const rowsLoadErrorCopy = useLoadErrorCopy(rows.isError);");
      expect(src).toContain("<Text style={{ color: theme.colors.danger }}>{jobLoadErrorCopy.title}</Text>");
      expect(src).toContain("<Text style={{ color: theme.colors.danger }}>{rowsLoadErrorCopy.title}</Text>");
      expect(src).toContain("<SecondaryButton label={jobLoadErrorCopy.actionLabel} onPress={() => job.refetch()} />");
      expect(src).toContain("<SecondaryButton label={rowsLoadErrorCopy.actionLabel} onPress={() => rows.refetch()} />");
      // 조회는 정확히 둘이다 — 세 번째가 생기면 그 자리가 무엇인지 먼저 물어야 한다.
      expect(src.match(/useLoadErrorCopy\(/g) ?? []).toHaveLength(2);
      expect(src).not.toContain("const loadFailedText =");
      // ⚠️ 일괄 선택의 **중간 실패**는 이 배선의 대상이 아니다(K-10: 앞부분은 이미 서버에 남아
      // 있다 — 조회 문구를 돌려 쓰면 그 사실을 감춘다). 그 자리는 자기 문장을 그대로 지킨다.
      expect(src).toContain(
        "<Text style={{ color: theme.colors.danger }}>{IMPORT_BULK_PARTIAL_FAILURE_TEXT}</Text>"
      );
      // 저장 셋의 배선(라운드 71 A · 72 E)과 그 여정의 문구 판정은 무변경이다.
      expect(src).toContain("const toggleFailureOnline = useErrorTimeConnectivity(toggleRow.isError);");
      expect(src).toContain("const categoryFailureOnline = useErrorTimeConnectivity(updateCategory.isError);");
      expect(src).toContain("const confirmFailureOnline = useErrorTimeConnectivity(confirm.isError);");
      expect(src).toContain('importFailureMessage("row_edit"');
      expect(src).toContain('importFailureMessage("confirm"');
    });
  });

  it("probes connectivity once per error, from the existing isCurrentlyOnline helper", () => {
    const hookSource = source("src/offline/use-load-error-copy.ts");
    expect(hookSource).toContain('from "./connectivity"');
    expect(hookSource).toContain("isCurrentlyOnline()");
    expect(hookSource).toContain("resolveLoadErrorCopy(");
    // 판정 실패/미확정 시 기존 문구로 떨어지는 안전 폴백(웹은 isCurrentlyOnline이 항상 true).
    expect(hookSource).toContain("useState(true)");
    // 문구 리터럴은 messages.ts에만 있다 -- 훅은 문자열을 만들지 않는다.
    //
    // 주석은 제거하고 본다(위 onlineManager 계약과 같은 관례): 이 훅의 머리말은 자기가 막는
    // 오표시를 설명하려고 문구를 **이름으로** 인용하는데, 그것은 화면이 읽는 문자열이 아니다.
    // 여기서 잡으려는 것은 "훅이 문장을 스스로 만드는 일"이지 "문장을 언급하는 일"이 아니다.
    const hookCode = hookSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(hookCode).not.toContain("불러오지 못했어요");
    expect(hookCode).not.toContain("오프라인이에요");
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
  it("목록의 화면이 옛 리터럴 대신 공용 훅을 쓰고, 그 훅이 실패 시점에 연결을 확인한다", () => {
    // 라운드 73 트랙 E: 손으로 적던 두 경로가 목록에서 온다(목록 ↔ 사용 집합의 일치는 아래 스윕).
    for (const path of OFFLINE_AWARE_SAVE_ERROR_SCREENS) {
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
    // 라운드 70 B: 시그니처가 넓어졌다(실패 값을 함께 받는다) — 연결 판정은 종전 그대로
    // 첫 인자에만 걸린다.
    const hookSource = source("src/offline/use-load-error-copy.ts");
    expect(hookSource).toContain("export function useSaveErrorCopy(isError: boolean, error?: unknown): string {");
    expect(hookSource).toContain("resolveSaveErrorCopy({ isOnline: useErrorTimeConnectivity(isError), error })");
    // 조회·저장 두 훅이 **같은** cancelled 패턴 하나를 공유한다(사본이 다시 갈라지지 않게).
    expect(hookSource.match(/let cancelled = false;/g) ?? []).toHaveLength(1);
    expect(hookSource).toContain("if (!cancelled) setIsOnline(online);");
    expect(hookSource).toContain("cancelled = true;");
    // 에러가 풀리면 판정이 초기값으로 복원된다(연결이 돌아온 뒤의 실패를 오프라인이라 하지 않는다).
    expect(hookSource).toContain("if (!isError) {");

    // 예산 화면은 토스트 한 곳, 아이 관리 화면은 세 뮤테이션(편집·출생 전환·추가)이 각자 한 자리.
    expect(source("app/budget.tsx")).toContain("<Toast message={saveErrorText} tone=\"error\" />");
    // 라운드 70 B: 두 화면 모두 실패 값을 함께 넘긴다 — 넘기지 않으면 훅은 코드를 볼 수 없다.
    expect(source("app/budget.tsx")).toContain("const saveErrorText = useSaveErrorCopy(save.isError, save.error);");
  });

  /**
   * 라운드 70 리뷰(M-2) — **자리별 사유는 그 자리 뮤테이션에서 온다.**
   *
   * 종전 계약은 훅 하나(세 상태의 OR + 세 실패의 `??` 체인)가 만든 **한 문장**을 세 자리가
   * 함께 그리는 형태였다. 그런데 세 카드는 동시에 떠 있을 수 있고 `??`는 언제나 먼저 실패한
   * 것을 고르므로, 편집이 날짜 하한으로 실패한 채 고착되면 그다음 추가 실패가 자기 자리에서
   * **남의 사유**("20년보다 오래된…")로 읽혔다 — 사유를 말할 수 있게 된 라운드 70 B가 그만큼
   * 오표시의 여지도 함께 만든 자리다.
   *
   * 이제 세 자리가 각자 자기 뮤테이션을 묻는다. 훅 호출 수는 셋으로 **고정**이라(조건부 호출이
   * 아니다) hooks 규칙에 안전하다.
   */
  it("아이 관리 화면은 자리마다 자기 뮤테이션의 사유를 그린다 (M-2)", () => {
    const screen = source("app/settings/children.tsx");

    // 뮤테이션 하나당 훅 하나 — 셋 다 자기 상태와 자기 실패 값을 함께 넘긴다.
    const wired: ReadonlyArray<[string, string]> = [
      ["editFailedText", "saveEdit"],
      ["bornFailedText", "markChildBorn"],
      ["addFailedText", "addChild"]
    ];
    for (const [variable, mutation] of wired) {
      expect(screen, `${variable}의 근거`).toContain(
        `const ${variable} = useSaveErrorCopy(${mutation}.isError, ${mutation}.error);`
      );
      // 그리는 자리의 조건도 같은 뮤테이션이다(조건과 문장이 갈리면 그 자리가 남의 사유를 그린다).
      expect(screen, `${variable}가 그려지는 자리`).toContain(
        `{${mutation}.isError ? <Text style={{ color: theme.colors.danger }}>{${variable}}</Text> : null}`
      );
      // 각 문장은 자기 자리에서 한 번씩만 쓰인다.
      expect(screen.match(new RegExp(`\\{${variable}\\}`, "g")) ?? [], variable).toHaveLength(1);
    }
    // 호출 수가 고정이라 hooks 규칙에 안전하다(조건부 호출·루프 호출이 아니다).
    expect(screen.match(/useSaveErrorCopy\(/g) ?? []).toHaveLength(3);

    // 합쳐 고르던 종전 배선(OR + ?? 체인, 그리고 세 자리가 공유하던 한 문장)이 되살아나지 않는다.
    expect(screen).not.toContain("saveFailedText");
    expect(screen).not.toContain("saveEdit.isError || markChildBorn.isError || addChild.isError");
    expect(screen).not.toContain("saveEdit.error ?? markChildBorn.error ?? addChild.error");
  });

  /**
   * 라운드 73 트랙 E(GAP-073 #5) — **저장 쪽에도 목록이 선다.**
   *
   * 라운드 70 B가 세운 종전 계약은 같은 사실을 **손으로 적은 배열**로 지켰다
   * (`["app/budget.tsx", "app/settings/children.tsx"]`). 그래서 새 저장 실패 문구가 생겨도
   * 아무도 세지 않았다 — 오늘 세어 보니 그렇게 남은 자리가 셋이었다(알림 저장 · 초대 참여 ·
   * 초대 조회). 조회 쪽이 라운드 38 H-12 이후 줄어들 수 있었던 이유는 목록이 아니라 **스윕**이
   * 있었기 때문이라, 같은 형식으로 바꾼다: 목록은 offline-aware-screens.ts 한 곳이고 여기서는
   * `app/**`을 훑어 사용 집합과의 **정확한 일치**만 본다(위 조회 쪽 스윕과 같은 모양).
   *
   * 넷째 화면이 생기면 이 단언이 먼저 빨개지고, 만든 사람이 "그 화면의 저장 실패는 무엇을
   * 말해야 하는가"에 답한 뒤 목록에 한 줄을 적게 된다.
   */
  it("라운드 73 트랙 E: 목록이 useSaveErrorCopy를 실제로 쓰는 app/** 화면 집합과 정확히 일치한다", () => {
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
        if (!readFileSync(fullPath, "utf8").includes("useSaveErrorCopy(")) continue;
        // 목록은 mobile 루트 기준 상대 경로(POSIX 구분자)로 적는다.
        wired.push(relative(mobileRoot, fullPath).split(sep).join("/"));
      }
    };
    walk(appRoot);

    expect(wired.sort()).toEqual([...OFFLINE_AWARE_SAVE_ERROR_SCREENS].sort());
    // 오늘의 값: 라운드 72까지 둘 → 이 트랙 뒤 넷.
    expect(OFFLINE_AWARE_SAVE_ERROR_SCREENS).toHaveLength(4);
  });

  /**
   * 라운드 73 트랙 E — 스윕이 `app/**`만 훑으므로, `src/**`에 조용히 생긴 호출부는 목록 밖에
   * 남을 수 있다. 오늘 그런 자리는 0건이고(훅 정의부 자신뿐이다), 생기는 날 이 단언이 먼저
   * 빨개진다 — 그때 물어야 할 것은 "그 모듈이 어느 화면의 문장을 만드는가"다.
   */
  it("라운드 73 트랙 E: src/** 에는 훅 정의부 말고 호출부가 없다 (스윕의 사각을 닫는다)", () => {
    const users: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(join(mobileRoot, directory))) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const relativePath = `${directory}/${name}`;
        if (statSync(join(mobileRoot, relativePath)).isDirectory()) {
          walk(relativePath);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        // 주석은 걷어내고 본다 — 목록 모듈(offline-aware-screens.ts)의 머리말은 자기가 무엇을
        // 세는지 설명하려고 훅 **이름**을 인용한다. 여기서 잡으려는 것은 호출부이지 언급이 아니다
        // (recurring-flow.test.ts의 codeOnly와 같은 관례).
        const code = source(relativePath)
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/\/\/[^\n]*/g, " ");
        if (/\buseSaveErrorCopy\s*\(/.test(code)) users.push(relativePath);
      }
    };
    walk("src");

    // 정의부(훅 자신)는 호출부가 아니다.
    expect(users.filter((path) => path !== "src/offline/use-load-error-copy.ts")).toEqual([]);
  });

  /**
   * 라운드 73 트랙 E(GAP-073 #5) — 목록이 넷이 되며 배선된 두 자리.
   *
   * 두 자리의 규율은 라운드 72 트랙 B와 같다: **온라인 갈래는 종전과 바이트 단위로 같고**,
   * 오프라인 갈래만 공용 단일 소스 문장으로 갈린다. 그래서 아래 단언들은 새 문구를 고정하지
   * 않고(문구는 이 파일 위쪽이 이미 고정한다) **종전 문자열이 그대로 나온다는 사실**을 고정한다.
   */
  describe("라운드 73 트랙 E: 알림 저장·초대 참여의 오프라인 인지 배선", () => {
    it("알림 설정(SET-006)은 주어만 더하고, 오프라인 갈래에는 그 주어를 붙이지 않는다", () => {
      const src = source("app/settings/notifications.tsx");
      expect(src).toContain("const deviceToggleSaveErrorCopy = useSaveErrorCopy(toggleDevice.isError);");
      expect(src).toContain("? deviceToggleSaveErrorCopy");
      expect(src).toContain(": `알림 설정을 ${deviceToggleSaveErrorCopy}`");
      expect(src).toContain("<Text style={errorTextStyle}>{deviceToggleSaveErrorText}</Text>");
      // 온라인 갈래 바이트 불변: 접두 + 공용 문장이 종전 문자열과 정확히 같다.
      expect(`알림 설정을 ${SAVE_ERROR_NOTICE}`).toBe("알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      expect(`알림 설정을 ${resolveSaveErrorCopy({ isOnline: true })}`).toBe(
        "알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
      );
      // "알림 설정을 지금은 오프라인이에요…"는 문장이 아니다 — 오프라인 갈래는 공용 문장 그대로다.
      expect(`알림 설정을 ${OFFLINE_SAVE_NOTICE}`).not.toBe(OFFLINE_SAVE_NOTICE);
      expect(src).not.toContain('"알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."');
      expect(src).not.toContain(">알림 설정을 저장하지 못했어요");
      // 이 화면의 다른 판정(알림함 종류별 스위치 · 푸시 정직 비활성)은 무접촉이다.
      expect(src).toContain("masterToggleDisabled = !pushSupported");
      expect(src).toContain("앱 업데이트 후 사용할 수 있어요");
    });

    it("초대 조회(FAM-003)는 주어만 더하고, [다시 시도]는 같은 단일 소스에서 온다", () => {
      const src = source("app/family/accept/[token].tsx");
      expect(src).toContain("const inviteLoadErrorCopy = useLoadErrorCopy(invite.isError);");
      expect(src).toContain("? inviteLoadErrorCopy.title");
      expect(src).toContain(": `초대 정보를 ${inviteLoadErrorCopy.title}`");
      expect(src).toContain("<Text style={{ color: theme.colors.danger }}>{inviteLoadErrorText}</Text>");
      expect(src).toContain(
        "<SecondaryButton label={inviteLoadErrorCopy.actionLabel} onPress={() => invite.refetch()} />"
      );
      // 온라인 갈래 바이트 불변: 접두 + 공용 문장·라벨이 종전 두 문자열과 정확히 같다.
      expect(`초대 정보를 ${LOAD_ERROR_NOTICE}`).toBe("초대 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      expect(LOAD_ERROR_RETRY_LABEL).toBe("다시 시도");
      // 종전 리터럴은 이 화면에서 사라졌다(두 자리가 다시 갈라지지 않게).
      expect(src).not.toContain('"초대 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."');
    });

    it("초대 참여는 자기 문장을 지키고, 오프라인 갈래만 공용 문장으로 갈린다", () => {
      const src = source("app/family/accept/[token].tsx");
      expect(src).toContain("const acceptSaveErrorCopy = useSaveErrorCopy(accept.isError, accept.error);");
      expect(src).toContain(
        "{acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error)}"
      );
      // 온라인 갈래 바이트 불변: 종전 판정 함수와 두 문장이 그대로다(라운드 70 A).
      expect(src).toContain('const acceptFailedText = "가족에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.";');
      expect(src).toContain('const alreadyMemberText = "이미 이 가족의 구성원이에요.";');
      expect(src).toContain(
        'return hasApiErrorCode(error, "HOUSEHOLD_ALREADY_MEMBER") ? alreadyMemberText : acceptFailedText;'
      );
      // 이 화면도 직접 폴을 띄우지 않는다(판정은 훅 하나).
      expect(src).not.toContain("isCurrentlyOnline()");
    });

    /**
     * ⓒ **파생 단언** — 오프라인 문장이 서는 조건이 화면의 판단이 아니라
     * `resolveSaveErrorCopy`의 **순서**에서 나온다. 화면의 비교는 `=== OFFLINE_SAVE_NOTICE`
     * 하나뿐이므로, 그 비교가 참인 순간은 "아는 코드가 없다"가 이미 참인 순간이다.
     */
    it("오프라인 갈래는 아는 코드가 없을 때만 선다 (코드 → 오프라인 → 모르는 실패)", () => {
      const alreadyMember = new ApiHttpError(409, {
        error: { code: "HOUSEHOLD_ALREADY_MEMBER", message: "서버 원문", requestId: "req-1" }
      });
      // 연결 판정이 어긋난 채로(오프라인이라고 봤는데) 서버 코드가 도착해도 표가 앞선다.
      expect(resolveSaveErrorCopy({ isOnline: false, error: alreadyMember })).not.toBe(OFFLINE_SAVE_NOTICE);
      // 그리고 그 문구는 화면의 전용 문장과 **글자까지 같다** — 어느 갈래로 가도 사용자가 읽는
      // 문장이 하나다(화면은 종전 판정 함수를 그대로 지난다).
      expect(resolveSaveErrorCopy({ isOnline: false, error: alreadyMember })).toBe("이미 이 가족의 구성원이에요.");
      // 코드가 없을 때만 오프라인 문장이 선다.
      expect(resolveSaveErrorCopy({ isOnline: false, error: new Error("Network request failed") })).toBe(
        OFFLINE_SAVE_NOTICE
      );
      expect(resolveSaveErrorCopy({ isOnline: true, error: new Error("Network request failed") })).toBe(
        SAVE_ERROR_NOTICE
      );
    });
  });
});

/**
 * 라운드 74 트랙 D(GAP-074 #4) — **옛 리터럴 부정 단언 스윕.**
 *
 * ## 무엇이 새는 축이었나
 *
 * 이 파일에는 이미 두 방향의 스윕이 있다: `app/**`에서 `useLoadErrorCopy(`/`useSaveErrorCopy(`를
 * **실제로 쓰는 화면 집합**과 목록의 정확한 일치. 그 둘은 "배선해 놓고 목록에 안 적었다"와
 * "목록에 적어 놓고 배선을 뗐다"를 잡는다.
 *
 * 라운드 73의 L-2 갱신 블록이 그 스윕이 **잡지 못하는 축**을 미리 적어 뒀다:
 * *"새 리터럴 감지는 아니다: 새 화면이 공용 훅을 아예 부르지 않고 자기 문장을 손으로 적으면
 * 사용 집합에도 목록에도 없으므로 **양쪽이 일치한 채 통과한다.** … 그 축을 잡으려면 다른 형태의
 * 단언(예: **옛 리터럴의 부정 단언 스윕**)이 따로 필요하고, **오늘 그것은 조회 쪽에도 저장
 * 쪽에도 없다.**"*
 *
 * 실제로 그렇게 통과한 채 살아 있던 옛 조회 실패 리터럴이 **화면 셋 · 자리 일곱**이었고
 * (지출 상세 하나 · 개인정보 넷 · 검수 둘), 그 위에서 L-2의 제목은 "P3 0"이었다. 종결을 세는
 * 목록이 그것을 세고 있지 않으면 종결이 아니다 — 그래서 반대 방향의 단언을 여기 세운다.
 *
 * ## 스윕이 묻는 것
 *
 * **`app/**`에 옛 실패 리터럴이 살아 있는 화면은 배선 목록이나 제외 목록에 예외 없이 이름이
 * 있어야 한다.** 두 목록 어디에도 없는 화면이 하나라도 있으면 실패한다 — 즉 다음 라운드가
 * 손으로 문장을 적는 순간, 두 답(배선하거나 이유를 값으로 적거나) 중 하나를 **고르게 된다.**
 * 조회·저장 두 쪽에 같은 형태로 선다(라운드 73 N-3이 지목한 그 대칭이다).
 *
 * 바늘은 손으로 적지 않고 공용 상수의 앞 문장에서 **파생**한다. 그래서 주어가 앞에 붙은 변형
 * ("기기 목록을 …", "초대 정보를 …", "대기 중인 초대를 …")도 같은 그물에 걸리고, 문구가 바뀌면
 * 스윕이 세는 대상도 함께 따라간다.
 */
describe("라운드 74 D: 옛 실패 리터럴 부정 단언 스윕", () => {
  const mobileRoot = process.cwd();

  /**
   * 주석은 걷어내고 본다 — 이 저장소의 화면 주석은 자기가 무엇을 고쳤는지 설명하려고 **옛
   * 문장을 인용한다**(검수 화면의 403 설명 · 알림 설정의 종전 문장 · 이 파일 자신). 여기서
   * 잡으려는 것은 화면이 사용자에게 그리는 문자열이지 그 문장을 언급하는 일이 아니다
   * (recurring-flow.test.ts의 codeOnly와 같은 관례).
   */
  const codeOnly = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  /** 바늘은 공용 상수의 **앞 문장**이다(손으로 적지 않는다 — 문구가 바뀌면 함께 따라간다). */
  const firstSentenceOf = (notice: string) => notice.slice(0, notice.indexOf("."));
  const OLD_LOAD_FAILURE_PHRASE = firstSentenceOf(LOAD_ERROR_NOTICE);
  const OLD_SAVE_FAILURE_PHRASE = firstSentenceOf(SAVE_ERROR_NOTICE);

  /** `app/**`의 화면별 **출현 횟수**(코드만 — 0건인 화면은 담지 않는다). */
  const appScreenPhraseCounts = (phrase: string): Map<string, number> => {
    const found = new Map<string, number>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        const count = codeOnly(readFileSync(fullPath, "utf8")).split(phrase).length - 1;
        if (count === 0) continue;
        found.set(relative(mobileRoot, fullPath).split(sep).join("/"), count);
      }
    };
    walk(join(mobileRoot, "app"));
    return new Map([...found].sort(([a], [b]) => (a < b ? -1 : 1)));
  };

  /** `app/**`의 화면 중 코드(주석 제외)에 그 문장이 살아 있는 것들. */
  const appScreensWithPhrase = (phrase: string): string[] => [...appScreenPhraseCounts(phrase).keys()];

  /**
   * 스윕 자신의 계약. 저장 쪽 답이 오늘 0건이라, **그물이 찢어져 있어도 통과하는** 형태가 될 수
   * 있다 — 그래서 바늘과 주석 제거가 실제로 동작하는지를 값으로 못박는다.
   */
  it("바늘은 파생값이고, 살아 있는 문자열과 주석 인용을 가른다", () => {
    expect(OLD_LOAD_FAILURE_PHRASE).toBe("불러오지 못했어요");
    expect(OLD_SAVE_FAILURE_PHRASE).toBe("저장하지 못했어요");
    // 주어가 앞에 붙은 계열도 같은 바늘에 걸린다.
    expect(`기기 목록을 ${LOAD_ERROR_NOTICE}`).toContain(OLD_LOAD_FAILURE_PHRASE);
    expect(`알림 설정을 ${SAVE_ERROR_NOTICE}`).toContain(OLD_SAVE_FAILURE_PHRASE);
    // 살아 있는 문자열은 잡고, 같은 문장의 주석 인용은 놓아준다.
    expect(codeOnly(`const t = "${LOAD_ERROR_NOTICE}";`)).toContain(OLD_LOAD_FAILURE_PHRASE);
    expect(codeOnly(`// 종전 문장은 "${LOAD_ERROR_NOTICE}"였다`)).not.toContain(OLD_LOAD_FAILURE_PHRASE);
    expect(codeOnly(`/** ${SAVE_ERROR_NOTICE} */`)).not.toContain(OLD_SAVE_FAILURE_PHRASE);
  });

  it("ⓐ 조회: 옛 리터럴이 살아 있는 app/** 화면은 예외 없이 배선 목록이나 제외 목록에 있다", () => {
    const screens = appScreensWithPhrase(OLD_LOAD_FAILURE_PHRASE);
    // 그물이 실제로 app 트리를 훑고 있다는 증거(빈 답이 조용히 통과하지 않게).
    expect(screens.length).toBeGreaterThan(0);
    const named = new Set<string>([
      ...OFFLINE_AWARE_LOAD_ERROR_SCREENS,
      ...Object.keys(OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS)
    ]);
    expect(screens.filter((path) => !named.has(path))).toEqual([]);
  });

  it("ⓐ 저장: 같은 형태의 스윕이 저장 쪽에도 선다 (대칭 — 라운드 73 N-3이 지목한 그 단언)", () => {
    const screens = appScreensWithPhrase(OLD_SAVE_FAILURE_PHRASE);
    const named = new Set<string>([
      ...OFFLINE_AWARE_SAVE_ERROR_SCREENS,
      ...Object.keys(OFFLINE_AWARE_SAVE_ERROR_EXEMPT_SCREENS)
    ]);
    expect(screens.filter((path) => !named.has(path))).toEqual([]);
    // 오늘의 답은 0건이다 — 화면이 그리는 저장 실패 문장은 전부 순수 모듈에서 오고, 그 모듈들이
    // 각자 자기 여정의 판정을 이미 지고 있다(save-error-messages · import-failure-messages ·
    // destructive-flow-messages · step-ui · app-lock). 손으로 적는 화면이 하나 생기는 날 위
    // 단언이 먼저 빨개진다.
    expect(screens).toEqual([]);
  });

  /**
   * 라운드 74 적대적 리뷰 D-1 — **스윕이 파일 단위라 "이미 이름이 있는 화면"은 자유롭다.**
   *
   * 위 두 단언은 "그 문장이 살아 있는 화면이 목록 안에 있는가"만 묻는다. 그래서 **이미 배선돼
   * 목록에 있는 화면**이 옛 리터럴을 자리 하나에 손으로 다시 적으면(공용 훅은 그대로 부르면서)
   * 그물이 그것을 보고도 통과시킨다 — 이 라운드가 실제로 고친 자리가 정확히 그 모양이었다
   * (개인정보 화면은 훅을 부르면서도 고정 문자열 하나를 넷이 나눠 쓰고 있었다).
   *
   * 그래서 **횟수**를 고정한다. 오늘 살아 있는 세 자리는 전부 "그 문장이어야 하는 이유"가 있는
   * 자리이고, 그 이유를 여기 값으로 적는다. 자리가 하나라도 늘면 이 단언이 먼저 빨개진다.
   */
  const LOAD_PHRASE_EXPECTED_OCCURRENCES: Readonly<Record<string, { count: number; reason: string }>> = {
    "app/(onboarding)/prepared-items.tsx": {
      count: 1,
      reason:
        "배선하지 않기로 한 자리(제외 목록). 공용 문장이 가리키는 [다시 시도]가 그 화면에 없고 " +
        "이미 더 구체적인 탈출구 문장을 갖고 있다 — 그 한 줄이 그 이유의 본체다."
    },
    "app/settings/index.tsx": {
      count: 1,
      reason:
        "설정 요약 줄의 **온라인 갈래**는 종전 문자열 바이트 불변이다(`summaryUnavailableText`). " +
        "오프라인 갈래는 공용 문장에서 잘라 만들어 리터럴이 없다."
    },
    "app/family/index.tsx": {
      count: 1,
      reason:
        "대기 초대 줄은 줄 자체가 눌리는 자리라 뒷절이 '눌러서'다 — 온라인 갈래가 공용 카드 " +
        "문구가 아니라 자기 문장 그대로여야 한다(`FAMILY_PENDING_INVITE_LOAD_ERROR_TEXT`)."
    }
  };

  it("ⓓ 조회: 화면별 옛 리터럴 **출현 횟수**가 값과 정확히 일치한다 (파일 단위 스윕의 사각)", () => {
    const counts = appScreenPhraseCounts(OLD_LOAD_FAILURE_PHRASE);
    expect(Object.fromEntries(counts)).toEqual(
      Object.fromEntries(
        Object.entries(LOAD_PHRASE_EXPECTED_OCCURRENCES).map(([path, entry]) => [path, entry.count])
      )
    );
    // 이유가 값으로 남아 있을 때만 그 자리가 허용된다(빈 문자열로 표를 늘릴 수 없다).
    for (const [path, entry] of Object.entries(LOAD_PHRASE_EXPECTED_OCCURRENCES)) {
      expect(entry.reason.trim().length, `${path}의 사유가 값으로 남아 있다`).toBeGreaterThan(30);
      expect(entry.count, `${path}의 기대 출현 수`).toBeGreaterThan(0);
    }
    // 배선된 화면 열넷 중 이 표에 이름이 있는 것은 둘뿐이다 — 나머지 열둘은 **0건**이고,
    // 그중 하나라도 리터럴을 손으로 되쓰면 위 `toEqual`이 먼저 빨개진다.
    const wiredWithLiteral = OFFLINE_AWARE_LOAD_ERROR_SCREENS.filter((path) =>
      Object.hasOwn(LOAD_PHRASE_EXPECTED_OCCURRENCES, path)
    );
    expect(wiredWithLiteral.sort()).toEqual(["app/family/index.tsx", "app/settings/index.tsx"]);
  });

  it("ⓓ 저장: 옛 저장 실패 리터럴은 화면 어디에도 0건이다 (같은 형태의 횟수 고정)", () => {
    expect(Object.fromEntries(appScreenPhraseCounts(OLD_SAVE_FAILURE_PHRASE))).toEqual({});
  });

  it("ⓔ 두 제외 목록의 이유는 빈 문자열일 수 없고, 배선 목록과 겹치지 않는다", () => {
    const lists = [
      ["조회", OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS, OFFLINE_AWARE_LOAD_ERROR_SCREENS],
      ["저장", OFFLINE_AWARE_SAVE_ERROR_EXEMPT_SCREENS, OFFLINE_AWARE_SAVE_ERROR_SCREENS]
    ] as const;
    for (const [label, exempt, wired] of lists) {
      for (const [path, reason] of Object.entries(exempt)) {
        expect(reason.trim().length, `${label} 제외 ${path}의 사유가 값으로 남아 있다`).toBeGreaterThan(30);
        expect(wired, `${label} 제외 ${path}는 배선 목록 밖이다`).not.toContain(path);
      }
    }
  });

  /**
   * ⓑ 오늘의 값. 라운드 73이 "제외를 값으로 적는다"는 기계를 만들고 넷 중 하나만 넣은 뒤
   * "P3 0개"를 선언했으므로, 이번 라운드가 만든 값도 여기 남긴다 — 다음 라운드가 문서의 산문이
   * 아니라 이 줄과 대조하게 된다.
   */
  it("ⓑ 조회 목록 열넷 · 카드가 아닌 자리 여섯(다섯 이상) · 저장 목록 넷", () => {
    expect(OFFLINE_AWARE_LOAD_ERROR_SCREENS).toHaveLength(14);
    expect(Object.keys(OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS)).toHaveLength(6);
    expect(OFFLINE_AWARE_SAVE_ERROR_SCREENS).toHaveLength(4);
    // 이번 라운드가 더한 셋이 실제로 목록 안에 있다(스윕이 통과한 이유가 목록이지 예외가 아니다).
    for (const path of [
      "app/expenses/[expenseId].tsx",
      "app/import/[importJobId].tsx",
      "app/settings/privacy.tsx"
    ] as const) {
      expect(OFFLINE_AWARE_LOAD_ERROR_SCREENS).toContain(path);
      expect(Object.keys(OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS)).not.toContain(path);
    }
  });
});

/**
 * 라운드 70 트랙 B — **저장 실패 문구가 서버 코드를 볼 수 있게 됐다.**
 *
 * 종전 `resolveSaveErrorCopy`는 인자로 `isOnline` 하나만 받아, 구조적으로 사유를 볼 수 없었다.
 * 그래서 다시 눌러도 영원히 같은 답이 오는 실패에까지 "잠시 후 다시 시도해 주세요."라고 말했다.
 * 이제 실패 값을 함께 받아 화이트리스트 표(src/api/api-error.ts)를 한 번 지난다.
 *
 * 이 describe가 지키는 것은 둘이다: **아는 코드는 말한다**, 그리고 **모르는 실패의 동작은 한
 * 글자도 바뀌지 않는다**(라운드 45가 세운 규칙 · 라운드 52의 두 폴백 문장).
 */
describe("라운드 70 B 저장 실패 문구의 코드 인지", () => {
  const mobileRoot = process.cwd();

  /** 서버 봉투를 그대로 실어 나르는 실제 실패 값(client.ts가 던지는 그 클래스다). */
  const httpError = (status: number, code: string) =>
    new ApiHttpError(status, { error: { code, message: "서버 원문", requestId: "req-1" } });

  it("아는 코드면 표의 문구를 쓴다 — 라운드 69가 남긴 배선 빚(아이 출생일 하한)이 여기서 갚아진다", () => {
    expect(resolveSaveErrorCopy({ isOnline: true, error: httpError(400, "CHILD_BIRTH_DATE_TOO_OLD") })).toBe(
      CHILD_BIRTH_DATE_TOO_OLD_ERROR
    );
    // 문구는 폼이 이미 세운 그 문장이다 — 같은 경계를 두 자리가 다르게 말하지 않는다.
    expect(API_ERROR_MESSAGES.CHILD_BIRTH_DATE_TOO_OLD).toBe(CHILD_BIRTH_DATE_TOO_OLD_ERROR);
    expect(resolveSaveErrorCopy({ isOnline: true, error: httpError(400, "CHILD_BIRTH_DATE_TOO_OLD") })).not.toBe(
      SAVE_ERROR_NOTICE
    );
  });

  it("403은 표의 **중립** 문구 그대로다 — 화면 쪽으로 좁히지 않는다(다른 여섯 화면이 같은 코드를 받는다)", () => {
    expect(resolveSaveErrorCopy({ isOnline: true, error: httpError(403, "FORBIDDEN") })).toBe(
      API_ERROR_MESSAGES.FORBIDDEN
    );
    // 이 표는 라운드 70이 한 글자도 바꾸지 않았다(서버 문장 일곱이 이 한 코드 아래 있다).
    expect(API_ERROR_MESSAGES.FORBIDDEN).toBe(
      "권한이 없어 처리하지 못했어요. 가족 구성원 여부와 내 역할을 확인해 주세요."
    );
  });

  it("코드가 먼저다 — 서버가 답을 줬다는 사실 자체가 연결이 있었다는 뜻이다", () => {
    // 오프라인 판정이 어긋난 채로 서버 코드가 도착하는 경우에도 표가 앞선다
    // (member-mutation-messages.ts가 세운 그 순서 그대로).
    expect(resolveSaveErrorCopy({ isOnline: false, error: httpError(400, "CHILD_BIRTH_DATE_TOO_OLD") })).toBe(
      CHILD_BIRTH_DATE_TOO_OLD_ERROR
    );
  });

  it("⚠ 모르는 실패의 동작은 종전과 바이트 단위로 같다 (두 폴백 문장 무변경)", () => {
    for (const error of [
      undefined,
      null,
      new Error("Network request failed"),
      httpError(500, "INTERNAL_ERROR"),
      httpError(400, "SOME_CODE_THE_TABLE_DOES_NOT_KNOW"),
      // 봉투가 아닌 본문(모양이 바뀌어도 조용히 예전처럼 동작한다).
      new ApiHttpError(400, { message: "not an envelope" })
    ]) {
      expect(resolveSaveErrorCopy({ isOnline: true, error })).toBe(SAVE_ERROR_NOTICE);
      expect(resolveSaveErrorCopy({ isOnline: false, error })).toBe(OFFLINE_SAVE_NOTICE);
    }
    // 인자를 생략한 종전 호출도 그대로다.
    expect(resolveSaveErrorCopy({ isOnline: true })).toBe(SAVE_ERROR_NOTICE);
    expect(resolveSaveErrorCopy({ isOnline: false })).toBe(OFFLINE_SAVE_NOTICE);
  });

  it("프로토타입 체인의 값이 문구로 둔갑하지 않는다(표 조회는 hasOwnProperty를 쓴다)", () => {
    for (const code of ["toString", "constructor", "__proto__"]) {
      expect(resolveSaveErrorCopy({ isOnline: true, error: httpError(400, code) })).toBe(SAVE_ERROR_NOTICE);
    }
  });

  it("판정은 봉투 파서를 한 벌 더 만들지 않고 표 모듈을 그대로 지난다 (source contract)", () => {
    const messagesSource = readFileSync(join(mobileRoot, "src/offline/messages.ts"), "utf8");
    expect(messagesSource).toContain('import { apiErrorCodeOf, apiErrorMessageForCode } from "../api/api-error";');
    expect(messagesSource).toContain("const knownByCode = apiErrorMessageForCode(apiErrorCodeOf(error));");
    // 표의 문구를 이 파일에 사본으로 적지 않는다(코드 이름은 주석에 나올 수 있다 — 문장이 아니다).
    for (const copy of Object.values(API_ERROR_MESSAGES)) {
      expect(messagesSource, copy).not.toContain(`"${copy}"`);
    }
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

describe("라운드 61 #6 저장소를 열지 못했을 때의 문구", () => {
  it("일어난 일·모르는 것·다음에 할 일을 말한다 (DNC-018 해요체, 한 줄)", () => {
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).toBe(
      "이 기기의 저장소를 열지 못했어요. 대기 중인 기록이 있는지 지금은 알 수 없어요. 앱을 다시 켜면 다시 시도할게요."
    );
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE.split("\n")).toHaveLength(1);
    for (const sentence of OFFLINE_STORAGE_UNAVAILABLE_NOTICE.split(". ")) {
      expect(sentence.trim().length).toBeGreaterThan(0);
    }
  });

  it("건수를 말하지 않는다 — 저장소를 못 열었으므로 0건도 주장할 수 없다", () => {
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).not.toMatch(/\d/);
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).toContain("알 수 없어요");
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).not.toContain("동기화됐어요");
  });

  it("지키지 못할 약속(자동 복구·데이터 안전)을 하지 않는다", () => {
    // 재시도는 이 앱 세션에 한 번뿐이다(store-open-gate.ts) -- "곧 자동으로"라고 말할 수 없다.
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).not.toContain("자동으로");
    // 열지 못한 파일의 내용은 이 앱도 모른다 -- 안전하다고도, 사라졌다고도 말하지 않는다.
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).not.toContain("안전");
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).not.toContain("사라졌");
    // 비난·지시형 금지(DNC-018).
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).not.toContain("확인하세요");
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).not.toContain("확보");
  });
});

/**
 * 라운드 68 트랙 B(#2) — 설정 화면의 로그아웃 확인 문구.
 *
 * 이 계약이 잡는 사실은 "문구가 짧다"가 아니라 **두 자리가 같은 사실을 말하는가**이다(라운드 64
 * M-2·65 A·67 B와 같은 형식): 로그아웃이 세는 건수와 동기화 상태 화면이 세는 건수가 같은 술어에서
 * 오는가, 그리고 대기가 없을 때 화면이 종전과 한 글자도 다르지 않은가.
 */
describe("라운드 68 B(#2) 로그아웃 확인 문구", () => {
  const mobileRoot = process.cwd();
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

  it("대기 0건이면 종전 문장 그대로다 (없는 위험을 지어내지 않는다)", () => {
    expect(LOGOUT_CONFIRM_TITLE).toBe("로그아웃 할까요?");
    expect(LOGOUT_CONFIRM_BASE_MESSAGE).toBe("다시 로그인해야 이용할 수 있어요.");
    expect(logoutConfirmMessage()).toBe(LOGOUT_CONFIRM_BASE_MESSAGE);
    expect(logoutConfirmMessage({ counts: { pending: 0, syncing: 0, failed: 0, conflict: 0 } })).toBe(
      LOGOUT_CONFIRM_BASE_MESSAGE
    );
    expect(logoutConfirmMessage({ counts: null, itemStatusRowCount: 0, storage: "ok" })).toBe(
      LOGOUT_CONFIRM_BASE_MESSAGE
    );
  });

  it("대기가 있으면 건수를 숫자로 말하고, 종전 문장은 접두로 그대로 남는다", () => {
    const message = logoutConfirmMessage({ counts: { pending: 3, syncing: 1, failed: 1, conflict: 0 } });
    expect(message.startsWith(`${LOGOUT_CONFIRM_BASE_MESSAGE}\n`)).toBe(true);
    expect(message).toContain("기록 5건");
  });

  it("확인 문구 계열과 **같은 두 가지**를 말한다: 어디에만 있는지 · 되돌릴 수 있는지", () => {
    const message = logoutConfirmMessage({ counts: { pending: 2, syncing: 0, failed: 0, conflict: 0 } });
    expect(message).toContain("이 기기에만");
    expect(message).toContain("되돌릴 수 없어요");
    // 같은 계열(전체 버리기)이 쓰는 주어·서술을 그대로 따른다 -- 새 어휘를 만들지 않는다.
    expect(syncStatusDiscardAllConfirmMessage(2)).toContain("이 기기에만");
    expect(message).toContain(recordsCountPhrase(2));
    // 해요체(DNC-018) · 책망/지시형 없음.
    expect(message.endsWith("요.")).toBe(true);
  });

  it("건수는 동기화 상태 화면과 **같은 술어**다: 지출 큐 네 상태 전부 + 준비템 상태 큐 전부", () => {
    expect(countLogoutPendingRecords({ pending: 1, syncing: 2, failed: 3, conflict: 4 })).toBe(10);
    expect(countLogoutPendingRecords({ pending: 1, syncing: 0, failed: 0, conflict: 0 }, 2)).toBe(3);
    expect(countLogoutPendingRecords(null, 0)).toBe(0);
    // 그 화면이 목록에 세우는 다섯 갈래가 정확히 이 덧셈이다(app/sync-status.tsx의 hasAny).
    const syncStatusSource = source("app/sync-status.tsx");
    expect(syncStatusSource).toContain(
      'snapshot.rows.filter((row) => row.syncState === "pending" || row.syncState === "syncing")'
    );
    expect(syncStatusSource).toContain('snapshot.rows.filter((row) => row.syncState === "failed")');
    expect(syncStatusSource).toContain('snapshot.rows.filter((row) => row.syncState === "conflict")');
    expect(syncStatusSource).toContain("snapshot.itemStatusRows.filter(");
  });

  it("저장소를 못 연 상태에서는 0건이라고 말하지 않는다 (라운드 61 S-4·M-1)", () => {
    const unknown = logoutConfirmMessage({ counts: { pending: 0, syncing: 0, failed: 0, conflict: 0 }, storage: "unavailable" });
    expect(unknown).toContain(OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE);
    expect(unknown).not.toMatch(/\d+건/);
    // 그래도 잃을 수 있는 것이 무엇인지는 말한다(조건문으로 — 있다고 단정하지 않는다).
    expect(unknown).toContain("되돌릴 수 없어요");
    expect(unknown.startsWith(`${LOGOUT_CONFIRM_BASE_MESSAGE}\n`)).toBe(true);
  });

  it("만료 경로와 부딪히지 않는다: 이 문장은 명시적 로그아웃 자리에만 선다 (AUTH-127)", () => {
    // 만료는 정체성을 유지해 아무것도 지우지 않고, 로그인 화면이 반대 방향을 약속한다.
    expect(SESSION_EXPIRED_LOGIN_NOTICE).toContain("저장하지 않은 기록도 이어서 반영할게요");
    const settingsSource = source("app/settings/index.tsx");
    expect(settingsSource).toContain(
      "Alert.alert(LOGOUT_CONFIRM_TITLE, logoutConfirmMessage({ ...csvExport.devicePendingRecords, recurringTemplateCount })"
    );
    // 화면은 문구를 다시 적지 않는다(단일 소스는 이 파일이다 -- 인라인 Alert 문자열이 없다).
    expect(settingsSource).not.toContain('Alert.alert("로그아웃');
    expect(settingsSource).not.toContain('clearSession("expired")');
  });

  it("건수는 **새 요청 0건**으로 온다: 이미 구독 중인 스냅숏 한 벌에서 아이 필터 없이 읽는다", () => {
    const cardSource = source("src/export/ExpenseCsvExport.tsx");
    expect(cardSource).toContain("const devicePendingRecords: LogoutPendingInput = {");
    expect(cardSource).toContain("counts: offlineSyncSnapshot.counts,");
    expect(cardSource).toContain("itemStatusRowCount: offlineSyncSnapshot.itemStatusRows.length,");
    // 내보내기 고지(아이·기간 필터를 지나는 값)와 섞이지 않는다 -- 모집단이 다르다.
    expect(cardSource).toContain("childId: canExport ? childId : null,");
    // 소비 화면은 여전히 스냅숏을 스스로 구독하지 않는다(export-pending-notice.test.ts의 계약).
    expect(source("app/settings/index.tsx")).not.toContain("useOfflineSyncSnapshot");
  });
});

/**
 * 라운드 69 트랙 A(#1) — 로그아웃이 지우는 **세 번째 목록**.
 *
 * 라운드 68이 세운 문구의 모집단이 아웃박스에서 멈춰 있었고, 같은 teardown이 지우는 정기 지출
 * 템플릿(사용자가 직접 적은 계정 데이터 · 서버에 사본 없음 · 아이당 최대 20개)은 그 수에 잡히지
 * 않았다. 그래서 같은 폰에서 로그아웃한 사람은 "대기 0건" 갈래로 떨어져 종전 한 줄만 읽고, 다시
 * 로그인하면 정기 지출만 비어 있는 화면을 만났다.
 *
 * 이 계약이 잡는 것은 넷이다.
 *  1. **네 좌표 회귀 고정** — 대기0·정기0(종전 무변경) / 대기N·정기0(라운드 68 무변경) /
 *     대기0·정기M / 둘 다. 이번 변화의 절반이 "종전과 한 글자도 달라지면 안 되는 쪽"이다.
 *  2. **두 모집단을 한 문장에 합치지 않는다** — 합계 숫자는 어느 화면에서도 다시 확인할 수 없다.
 *  3. **한 사실을 두 자리가 다르게 말하지 않는다** — 관리 화면 고지와 로그아웃 줄의 뒷문장 겹침.
 *  4. **파생 단언** — teardown이 비우는 스토어 목록과 이 문구가 "센다/세지 않는다"로 판정한
 *     목록이 같은가. 라운드 68이 아웃박스만 세고 멈춘 이유가 "빠졌다는 사실이 어떤 단언도 깨지
 *     않았다"이므로, 다음 `resetAll()`이 판단 없이 지나가지 못하게 한다.
 */
describe("라운드 69 A(#1) 로그아웃이 지우는 세 번째 목록", () => {
  const mobileRoot = process.cwd();
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
  const expenseCounts = (pending: number) => ({ pending, syncing: 0, failed: 0, conflict: 0 });
  const RECURRING_SENTENCE_TAIL = "서버에서 돌아오지 않으니 다시 적어야 해요.";

  it("회귀 고정 네 좌표 — 0/0은 종전 한 줄, 대기만 있으면 라운드 68 두 줄 그대로", () => {
    expect(logoutConfirmMessage({ counts: expenseCounts(0), recurringTemplateCount: 0 })).toBe(
      LOGOUT_CONFIRM_BASE_MESSAGE
    );
    expect(logoutConfirmMessage({ counts: expenseCounts(2), recurringTemplateCount: 0 })).toBe(
      `${LOGOUT_CONFIRM_BASE_MESSAGE}\n${recordsCountPhrase(2)}은 아직 이 기기에만 저장돼 있어요. 로그아웃하면 되돌릴 수 없어요.`
    );
  });

  it("정기 지출만 있으면 그 줄만 선다 — 없는 기록 손실을 지어내지 않는다", () => {
    const recurringOnly = logoutConfirmMessage({ counts: expenseCounts(0), recurringTemplateCount: 3 });
    expect(recurringOnly).toBe(
      `${LOGOUT_CONFIRM_BASE_MESSAGE}\n정기 지출 3개는 이 기기에만 저장돼 있어요. ${RECURRING_SENTENCE_TAIL}`
    );
    // 확인 문구 계열과 **같은 두 가지**를 말한다: 어디에만 있는지 · 되돌릴 수 있는지.
    expect(recurringOnly).toContain("이 기기에만");
    expect(recurringOnly).toContain("서버에서 돌아오지 않으니");
    // 다만 기록 줄의 서술("되돌릴 수 없어요")은 서지 않는다 — 이 목록은 다시 적을 수 있다.
    expect(recurringOnly).not.toContain("되돌릴 수 없어요");
    // 성질이 다른 두 손실이라 서술도 다르다: 이쪽은 사용자가 할 수 있는 일로 끝난다.
    expect(recurringOnly).toContain("다시 적어야 해요");
  });

  it("둘 다면 줄이 셋이고, 두 수를 더한 숫자는 어디에도 없다 (한 문장에 합치지 않는다)", () => {
    const both = logoutConfirmMessage({
      counts: expenseCounts(2),
      itemStatusRowCount: 1,
      recurringTemplateCount: 3
    });
    const lines = both.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(LOGOUT_CONFIRM_BASE_MESSAGE);
    expect(lines[1]).toContain(recordsCountPhrase(3));
    expect(lines[2]).toContain("정기 지출 3개");
    // 합계(3+3)는 어느 화면에서도 다시 확인할 수 없는 숫자다 — 그 수를 말하지 않는다.
    expect(both).not.toContain("6건");
    expect(both).not.toContain("6개");
    // 단위도 각자의 화면과 같다: 동기화 상태는 "건", 정기 지출 관리 화면은 "개".
    expect(source("app/expenses/recurring.tsx")).toContain("저장한 정기 지출 ${childTemplates.length}개");
  });

  it("한 사실을 두 자리가 다르게 말하지 않는다 — 관리 화면 고지가 로그아웃도 말한다", () => {
    // 라운드 66이 세운 조건절은 "기기를 바꾸면"이라 로그아웃을 비켜 갔다. 조건절만 넓힌다.
    expect(RECURRING_DEVICE_ONLY_NOTICE).toContain("기기를 바꾸거나 로그아웃하면");
    expect(RECURRING_DEVICE_ONLY_NOTICE).toContain(RECURRING_SENTENCE_TAIL);
    // 로그아웃 줄은 그 뒷문장을 **글자 그대로** 쓴다(두 자리가 같은 사실을 말한다).
    const line = logoutConfirmMessage({ recurringTemplateCount: 1 });
    expect(line).toContain(RECURRING_SENTENCE_TAIL);
    // 해요체(DNC-018) · 없는 기능(서버 동기화·백업)을 예고하지 않는다.
    expect(line.endsWith("요.")).toBe(true);
    expect(line).not.toMatch(/동기화(돼|될|해|합|됩)|백업(돼|될|됩)|나중에 (복구|복원)/);
  });

  it("저장소를 못 연 갈래의 문장은 무변경이고, 정기 지출 줄만 덧붙는다 (저장소가 다르다)", () => {
    const unknownAlone = logoutConfirmMessage({ storage: "unavailable" });
    const unknownWithList = logoutConfirmMessage({ storage: "unavailable", recurringTemplateCount: 4 });
    // 종전 두 줄이 접두로 그대로 남는다 — "모른다"의 문장을 손대지 않는다.
    expect(unknownWithList.startsWith(`${unknownAlone}\n`)).toBe(true);
    expect(unknownWithList).toContain(OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE);
    expect(unknownWithList).toContain("정기 지출 4개");
    // 정기 지출은 zustand persist라 그 판정과 저장소가 다르다: 아웃박스 건수는 여전히 침묵한다.
    expect(unknownWithList).not.toMatch(/\d+건/);
  });

  it("파생 단언 — teardown이 비우는 스토어가 전부 '센다/세지 않는다' 중 하나로 판정돼 있다", () => {
    const teardown = source("src/offline/session-teardown.ts");
    const called = new Set(
      Array.from(teardown.matchAll(/(use\w+Store)\.getState\(\)\.reset(?:All)?\(/g), (match) => match[1])
    );
    expect(called.size).toBeGreaterThan(0);
    const judged = new Set<string>([
      ...LOGOUT_COUNTED_TEARDOWN_STORES,
      ...Object.keys(LOGOUT_UNCOUNTED_TEARDOWN_STORES)
    ]);
    // teardown에 resetAll이 하나 늘면 여기서 깨진다 — 판단하지 않고 지나갈 수 없게 한다.
    expect([...called].filter((name) => !judged.has(name))).toEqual([]);
    // 반대 방향도 본다: 목록에만 남은 이름은 teardown을 따라오지 못한 낡은 판정이다.
    expect([...judged].filter((name) => !called.has(name))).toEqual([]);
    // 라운드 69 리뷰 S-2 — 한 겹 더. 위 두 방향은 `reset()`/`resetAll()`이라는 **호출 모양**에
    // 걸려 있어서, 스토어를 비우는 방법이 달라지면(예: `.setState(초기값)`, 전용 헬퍼) 그 스토어는
    // 조용히 판정 밖으로 빠진다. 그래서 호출이 아니라 **import 목록**을 한 번 더 긁는다.
    // 전제: session-teardown.ts는 스토어를 오직 teardown 목적으로만 import한다(읽기용 조회나
    // 파생 계산을 위해 스토어를 가져오지 않는다 — 그런 import가 생기면 이 단언이 먼저 깨지고,
    // 그때 판정 목록이 아니라 이 전제를 다시 봐야 한다).
    const imported = new Set(Array.from(teardown.matchAll(/import \{ (use\w+Store) \}/g), (match) => match[1]));
    expect(imported.size).toBeGreaterThan(0);
    expect([...imported].filter((name) => !judged.has(name))).toEqual([]);
    // 세는 쪽 하나는 실제로 문구에 도달한다(목록만 적어 두고 말하지 않는 일이 없게).
    expect([...LOGOUT_COUNTED_TEARDOWN_STORES]).toContain("useRecurringExpenseStore");
    expect(logoutConfirmMessage({ recurringTemplateCount: 1 })).toContain("정기 지출 1개");
    // 세지 않기로 한 것에는 **근거가 값으로** 붙어 있다(적지 않으면 다음 라운드가 목록을 늘린다).
    for (const [name, reason] of Object.entries(LOGOUT_UNCOUNTED_TEARDOWN_STORES)) {
      expect(reason.trim().length, `${name}의 제외 근거가 비어 있다`).toBeGreaterThan(10);
    }
    // 아웃박스는 스토어가 아니라 wipe다 — 그쪽은 종전대로 counts·itemStatusRowCount가 센다.
    expect(teardown).toContain("wipeOfflineStore(store)");
  });

  it("정기 지출 개수는 **새 요청 0건**이다: 셀렉터 하나 · 아이 필터 없음 · 내보내기 모듈 무접촉", () => {
    const settingsSource = source("app/settings/index.tsx");
    expect(settingsSource).toContain(
      "const recurringTemplateCount = useRecurringExpenseStore((state) => state.templates.length);"
    );
    // teardown은 모든 아이의 것을 지운다 — 아이 필터를 지나면 화면이 실제보다 작은 수를 말한다.
    expect(settingsSource).not.toContain("templates.filter");
    // 화면은 문구를 다시 적지 않는다(단일 소스는 이 파일이다).
    expect(settingsSource).not.toContain(RECURRING_SENTENCE_TAIL);
    // CSV 내보내기 모듈에는 들어가지 않는다(그 파일의 계약: 템플릿을 CSV에 싣지 않는다 —
    // recurring-flow.test.ts, 라운드 65 A의 왕복 계약). 주석은 그 사실을 설명해도 된다.
    const cardCode = source("src/export/ExpenseCsvExport.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    expect(cardCode).not.toContain("recurring");
  });

  it("P3 열 라운드 이월 청산 — 실패 행 안내가 동기화 문구 단일 소스로 왔다 (값 불변)", () => {
    expect(FAILED_ROW_OTHER_CHILD_NOTICE).toBe("다른 아이의 기록이에요. 그 아이를 선택하면 고쳐서 다시 보낼 수 있어요.");
    expect(source("src/expenses/failed-row-prefill.ts")).not.toContain("export const FAILED_ROW_OTHER_CHILD_NOTICE");
    expect(source("app/sync-status.tsx")).toContain(
      'import { buildFailedRowPrefillParams } from "../src/expenses/failed-row-prefill";'
    );
  });
});
