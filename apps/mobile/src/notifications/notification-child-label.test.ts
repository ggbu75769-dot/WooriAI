import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatNotificationRowTitle,
  resolveNotificationChildLabel,
  NOTIFICATION_CHILD_LABEL_SEPARATOR,
  type NotificationChildRef
} from "./notification-child-label";

const FIRST: NotificationChildRef = { id: "child-1", nickname: "다온이" };
const SECOND: NotificationChildRef = { id: "child-2", nickname: "두콩이" };

describe("R20-C 알림 행 아이 표시 규칙 (pure)", () => {
  it("아이가 1명이면 표시하지 않는다 (불필요한 노이즈 금지)", () => {
    expect(resolveNotificationChildLabel("child-1", [FIRST])).toBeNull();
  });

  it("아이가 2명 이상이면 해당 아이의 태명을 돌려준다", () => {
    expect(resolveNotificationChildLabel("child-1", [FIRST, SECOND])).toBe("다온이");
    expect(resolveNotificationChildLabel("child-2", [FIRST, SECOND])).toBe("두콩이");
  });

  it("childId가 없는 구 알림(R19-D 이전)은 표시하지 않는다", () => {
    expect(resolveNotificationChildLabel(undefined, [FIRST, SECOND])).toBeNull();
    expect(resolveNotificationChildLabel("", [FIRST, SECOND])).toBeNull();
  });

  it("이름을 해석할 수 없으면(목록에 없는 childId) 표시하지 않는다", () => {
    expect(resolveNotificationChildLabel("child-deleted", [FIRST, SECOND])).toBeNull();
  });

  it("아이 목록이 아직 로딩 전이면(undefined) 표시하지 않는다", () => {
    expect(resolveNotificationChildLabel("child-1", undefined)).toBeNull();
    expect(resolveNotificationChildLabel("child-1", [])).toBeNull();
  });

  it("태명이 공백뿐이면 빈 접두를 만들지 않는다", () => {
    expect(resolveNotificationChildLabel("child-2", [FIRST, { id: "child-2", nickname: "   " }])).toBeNull();
  });

  it("태명 앞뒤 공백은 다듬어 표시한다", () => {
    expect(resolveNotificationChildLabel("child-2", [FIRST, { id: "child-2", nickname: " 두콩이 " }])).toBe("두콩이");
  });
});

describe("R20-C 행 제목 조합", () => {
  const title = "이번 달 예산의 80%를 사용했어요";

  it("라벨이 있으면 태명을 접두로 붙인다 (행 접근성 라벨에도 함께 읽힌다)", () => {
    expect(formatNotificationRowTitle(title, "다온이")).toBe(`다온이${NOTIFICATION_CHILD_LABEL_SEPARATOR}${title}`);
    expect(formatNotificationRowTitle(title, "다온이")).toContain("다온이");
  });

  it("라벨이 없으면 제목을 그대로 둔다 (1명 가구는 기존과 동일)", () => {
    expect(formatNotificationRowTitle(title, null)).toBe(title);
  });
});

describe("R20-C 알림 화면 배선 (source verification -- 화면은 vitest에서 렌더하지 않는 관례)", () => {
  const screenSource = readFileSync(join(process.cwd(), "app/notifications.tsx"), "utf8");

  it("저장된 childId를 읽어 행 제목에 반영한다", () => {
    expect(screenSource).toContain("resolveNotificationChildLabel(entry.childId, householdChildren)");
    expect(screenSource).toContain("formatNotificationRowTitle(entry.title, childLabel)");
  });

  it("아이 이름은 공유 캐시인 [\"children\"] 쿼리에서 해석한다 (R19-C 캐시 공유)", () => {
    expect(screenSource).toContain('queryKey: ["children"]');
    expect(screenSource).toContain("listChildren(authToken!)");
    expect(screenSource).toContain("enabled: Boolean(authToken)");
  });
});
