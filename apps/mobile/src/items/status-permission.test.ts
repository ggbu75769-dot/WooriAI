import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPENSE_VIEW_ONLY_ALERT_TITLE,
  EXPENSE_VIEW_ONLY_MESSAGE,
  isExpenseEntryLocked
} from "../family/record-permissions";
import {
  guardItemStatusChange,
  ITEM_STATUS_VIEW_ONLY_ALERT_TITLE,
  ITEM_STATUS_VIEW_ONLY_MESSAGE
} from "./status-permission";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 51 #8 — 보기 전용 역할이 준비 상태를 바꾸려 할 때.
 *
 * 고치는 문제: 서버는 이 PATCH에도 편집 권한을 요구하는데(apps/api items-catalog.service.ts의
 * `requireChildAccess(..., true)`) 앱에는 게이트가 없어서, viewer/gift_participant가 버튼을
 * 누르면 403이 돌아오고 화면은 "잠시 후 다시 시도해 주세요"라고 답했다 — 잠시 후에도 같은
 * 403이라 영원히 지켜지지 않는 약속이었다.
 */
describe("#8 준비 상태 변경 보기 전용 안내", () => {
  it("판정을 새로 만들지 않고 지출 게이트와 같은 한 곳을 읽는다", () => {
    // 서버가 두 동작에 같은 편집 권한을 요구하므로 판정도 하나여야 한다.
    expect(isExpenseEntryLocked({ hasSession: true, role: "viewer" })).toBe(true);
    expect(isExpenseEntryLocked({ hasSession: true, role: "gift_participant" })).toBe(true);
    expect(isExpenseEntryLocked({ hasSession: true, role: "co_parent" })).toBe(false);
    // 역할 미상은 잠그지 않고(모르면 예전 동작), 비세션은 절대 잠기지 않는다(픽셀락 캡처).
    expect(isExpenseEntryLocked({ hasSession: true, role: undefined })).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: false, role: "viewer" })).toBe(false);

    // 배선도 그 한 곳을 읽는다 -- 준비템 쪽에 판정 사본을 두지 않는다.
    const hook = source("src/items/useItemStatusGate.ts");
    expect(hook).toContain("useExpenseEntryGate()");
    expect(hook).not.toContain("VIEW_ONLY_ROLES");
    expect(source("src/family/useExpenseEntryGate.ts")).toContain("isExpenseEntryLocked({ hasSession, role })");
  });

  it("문구는 준비 상태의 말로 하되 지출 안내와 같은 문형이다", () => {
    expect(ITEM_STATUS_VIEW_ONLY_ALERT_TITLE).toBe(EXPENSE_VIEW_ONLY_ALERT_TITLE);
    expect(ITEM_STATUS_VIEW_ONLY_MESSAGE).toBe(
      "보기 전용으로 참여하고 있어요. 준비 상태는 관리자·공동부모가 바꿀 수 있어요."
    );
    // 지출 문구를 그대로 쓰면 준비 상태를 바꾸려던 사람에게 엉뚱한 답이 간다.
    expect(ITEM_STATUS_VIEW_ONLY_MESSAGE).not.toBe(EXPENSE_VIEW_ONLY_MESSAGE);
    expect(ITEM_STATUS_VIEW_ONLY_MESSAGE).not.toContain("기록은");
    // 재시도를 권하지 않는다 -- 다시 눌러도 결과가 같다.
    expect(ITEM_STATUS_VIEW_ONLY_MESSAGE).not.toContain("다시");
    expect(ITEM_STATUS_VIEW_ONLY_MESSAGE.endsWith("요.")).toBe(true);
  });

  it("잠겼으면 안내로, 아니면 원래 동작으로", () => {
    const calls: string[] = [];
    const explain = () => calls.push("explain");
    const action = (value: string) => calls.push(`action:${value}`);

    guardItemStatusChange(true, explain, action)("prepared");
    expect(calls).toEqual(["explain"]);

    guardItemStatusChange(false, explain, action)("prepared");
    expect(calls).toEqual(["explain", "action:prepared"]);
  });

  /**
   * 화면 배선(react-native는 vitest에서 렌더할 수 없다). 노드를 **지우지 않고** 눌렀을 때
   * 안내로 답하는 관례를 함께 못박는다 — 버튼이 사라지면 ITEM-001/002 픽셀락 캡처와 어긋날
   * 위험이 생기고, 보기 전용 참여자에게 필요한 것은 "버튼이 왜 없지?"가 아니라 사실이다.
   */
  it("두 화면 모두 상태 변경 실행 앞에 게이트를 지난다", () => {
    const items = source("app/(tabs)/items.tsx");
    const detail = source("app/items/[itemTemplateId].tsx");

    // 잠긴 세션에서 큐에 넣으면 403 실패 행이 될 뿐이다 -- 게이트는 그 행이 만들어지는 함수
    // 안에서, 저장 호출보다 **앞에** 선다. 두 화면의 함수 경계가 달라 각자 그 구간만 본다.
    for (const [path, screen, blockStart, blockEnd] of [
      // 목록 탭: 확인 Alert까지 감싸는 requestStatusChange가 게이트 자리다(그 안에서 실행 함수
      // applyStatusChange를 부른다) -- Alert를 띄운 뒤에야 막으면 눌러 놓고 되돌리는 꼴이 된다.
      ["app/(tabs)/items.tsx", items, "const requestStatusChange = (", "// MOB-117 당겨서 새로고침"],
      ["app/items/[itemTemplateId].tsx", detail, "const applyStatusChange = (", "const toggleInterested ="]
    ] as const) {
      expect(screen, `${path} mounts the gate`).toContain("const itemStatusGate = useItemStatusGate();");
      const block = screen.slice(screen.indexOf(blockStart), screen.indexOf(blockEnd));
      expect(block.length, `${path} block found`).toBeGreaterThan(0);
      const guardIndex = block.indexOf("if (itemStatusGate.locked)");
      const runIndex = block.search(/applyStatusChange\(|updateItemStatusOffline\(/);
      expect(guardIndex, `${path} guards the status change`).toBeGreaterThan(-1);
      expect(block, `${path} explains instead of queueing`).toContain("itemStatusGate.explain();");
      expect(runIndex, `${path} guards before the write`).toBeGreaterThan(guardIndex);
    }

    // 버튼 자체는 그대로 남는다(안내로 답하는 관례).
    expect(items).toContain('label="준비했어요"');
    expect(items).toContain('label="괜찮아요"');
    expect(detail).toContain('label={isGifted ? "선물 받음 취소" : "선물로 받았어요"}');
  });

  it("지출 진입점 게이트는 종전 그대로다 (UX-R 배선 무접촉)", () => {
    expect(source("app/(tabs)/items.tsx")).toContain("const openExpenseLinkPrompt = expenseGate.guard(");
    expect(source("app/items/[itemTemplateId].tsx")).toContain("onPress={expenseGate.guard(() =>");
  });
});
