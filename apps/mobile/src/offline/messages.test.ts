import { describe, expect, it } from "vitest";
import {
  CONFLICT_BANNER_MESSAGE,
  CONFLICT_OPTION_ADOPT_SERVER_LABEL,
  CONFLICT_OPTION_REAPPLY_MINE_LABEL,
  CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL,
  OFFLINE_SAVED_MESSAGE,
  SERVER_CONFIRMED_MESSAGE
} from "./messages";

describe("MOB-102 offline copy (round5a-sprint1-plan.md §3.3, §3.4)", () => {
  it("matches the design doc's exact offline-save and server-confirmed copy", () => {
    expect(OFFLINE_SAVED_MESSAGE).toBe("기기에 저장했어요. 연결되면 자동으로 반영할게요.");
    expect(SERVER_CONFIRMED_MESSAGE).toBe("기록 변경을 서버에 반영했어요.");
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
