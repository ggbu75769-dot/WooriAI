import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFLINE_AWARE_LOAD_ERROR_SCREENS } from "./offline-aware-screens";
import {
  CONFLICT_BANNER_MESSAGE,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  OFFLINE_SAVED_MESSAGE,
  SERVER_CONFIRMED_MESSAGE,
  LOAD_ERROR_NOTICE,
  LOAD_ERROR_RETRY_LABEL,
  OFFLINE_LOAD_NOTICE,
  resolveLoadErrorCopy,
  syncStatusBadgeLabel,
  syncStatusCountLabel,
  SYNC_ROW_CONFLICT_LABEL,
  SYNC_ROW_FAILED_LABEL,
  SYNC_ROW_PENDING_DELETE_LABEL,
  SYNC_ROW_PENDING_LABEL,
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

  // 라운드 39 UX-P: 남아 있던 세 화면(홈·기록·예산)까지 같은 단일 소스로 배선했다 -- 이제
  // 조회 실패 카드를 그리는 화면 여섯 곳이 모두 같은 문구를 쓴다(가족 화면은 다른 트랙 소관).
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
