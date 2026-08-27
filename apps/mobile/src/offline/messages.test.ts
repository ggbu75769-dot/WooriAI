import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFLICT_BANNER_MESSAGE,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  OFFLINE_SAVED_MESSAGE,
  SERVER_CONFIRMED_MESSAGE,
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
