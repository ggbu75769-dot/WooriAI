import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOUSEHOLD_JOIN_VIEWER_NOTICE } from "../children/household-join";
import {
  buildChildrenEmptyStateCard,
  buildPrivacyEmptyStateCard,
  showsStandingAddChildEntry
} from "./empty-state-cards";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const childrenSource = () => source("app/settings/children.tsx");
const privacySource = () => source("app/settings/privacy.tsx");
/** "옛 문구가 사라졌다"는 단언은 **그리는 코드**에만 묻는다 — 두 시점 주석이 옛 문구를 인용한다. */
const maskComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/**
 * 빈 상태 감사 — 설정의 0건 카드 둘(SET-005 아이 관리 · SET-003 약관 및 개인정보).
 *
 * 판정 기준 셋: ⓐ 무슨 일이 있었는지 말하는가 · ⓑ 다음에 무엇을 하면 되는지 말하는가 ·
 * ⓒ 그 행동으로 가는 버튼이 있는가.
 *  - 아이 관리: ⓐ만 참이었다("등록된 아이가 없어요" + `[새로고침]` — 이미 성공한 조회를 다시
 *    부르는 버튼이고, 실제로 푸는 `[아이 추가]`는 카드 밖 화면 아래에 있었다).
 *  - 개인정보: ⓐ가 없었다("표시할 항목이 없어요" — 무엇이 없는지조차 말하지 않았다).
 *
 * 화면은 vitest에서 렌더할 수 없어(react-native import) 순수 모듈은 **값**으로, 배선은
 * **소스 문자열**로 붙든다(settings-flow.test.ts와 같은 관례).
 */

const baseChildrenInput = {
  listEmpty: true,
  canAddChild: true,
  isDemoSession: false,
  addFormOpen: false,
  role: "owner"
};

describe("빈 상태 감사 — 아이 0건 카드(SET-005)", () => {
  it("목록이 비지 않았으면 카드가 서지 않는다", () => {
    expect(buildChildrenEmptyStateCard({ ...baseChildrenInput, listEmpty: false })).toBe(null);
  });

  it("추가할 수 있는 사람에게는 그 빈 상태를 실제로 푸는 행동을 준다", () => {
    expect(buildChildrenEmptyStateCard(baseChildrenInput)).toEqual({
      action: "add-child",
      title: "등록된 아이가 없어요",
      actionLabel: "아이 추가"
    });
    // 공동부모도 같다(서버의 편집 역할 둘).
    expect(buildChildrenEmptyStateCard({ ...baseChildrenInput, role: "co_parent" })).toEqual({
      action: "add-child",
      title: "등록된 아이가 없어요",
      actionLabel: "아이 추가"
    });
  });

  it("폼이 이미 열려 있으면 같은 버튼을 다시 주지 않는다 (누르면 입력·멱등 키가 초기화된다)", () => {
    expect(buildChildrenEmptyStateCard({ ...baseChildrenInput, addFormOpen: true })).toEqual({
      action: null,
      title: "등록된 아이가 없어요"
    });
  });

  it("확실히 막힌 역할에게는 이미 있는 그 문장을 쓰고, 눌러도 결과가 같은 버튼은 붙이지 않는다", () => {
    for (const role of ["viewer", "gift_participant"]) {
      expect(buildChildrenEmptyStateCard({ ...baseChildrenInput, canAddChild: false, role })).toEqual({
        action: null,
        title: HOUSEHOLD_JOIN_VIEWER_NOTICE
      });
    }
    // 문장은 가구 참여 직후 같은 상황에서 읽히는 그 한 줄이다(새 문구 0건).
    expect(HOUSEHOLD_JOIN_VIEWER_NOTICE).toBe("아직 등록된 아이가 없어요. 가족 관리자가 아이를 등록하면 바로 볼 수 있어요.");
  });

  it("역할을 모르는 동안·데모에서는 종전 카드 그대로다 (모를 때 단정하지 않는다)", () => {
    const loading = { ...baseChildrenInput, canAddChild: false, role: undefined };
    expect(buildChildrenEmptyStateCard(loading)).toEqual({
      action: "refresh",
      title: "등록된 아이가 없어요",
      actionLabel: "새로고침"
    });
    expect(buildChildrenEmptyStateCard({ ...baseChildrenInput, isDemoSession: true })).toEqual({
      action: "refresh",
      title: "등록된 아이가 없어요",
      actionLabel: "새로고침"
    });
  });

  it("입구는 화면에 하나다 — 카드가 [아이 추가]를 들 때만 아래 버튼이 자리를 넘긴다", () => {
    expect(showsStandingAddChildEntry(buildChildrenEmptyStateCard(baseChildrenInput))).toBe(false);
    expect(showsStandingAddChildEntry(null)).toBe(true);
    expect(showsStandingAddChildEntry({ action: "refresh", title: "t", actionLabel: "l" })).toBe(true);
    expect(showsStandingAddChildEntry({ action: null, title: "t" })).toBe(true);
  });
});

describe("빈 상태 감사 — 개인정보 0건 카드(SET-003)", () => {
  it("로딩·실패 중에는 서지 않는다 (그 둘은 각자의 얼굴이 있다)", () => {
    expect(buildPrivacyEmptyStateCard({ hasSession: true, settled: false, showsConsentCard: false })).toBe(null);
  });

  it("동의 내역 카드가 서면 빈 카드가 아니다", () => {
    expect(buildPrivacyEmptyStateCard({ hasSession: true, settled: true, showsConsentCard: true })).toBe(null);
  });

  it("무엇이 없는지 이름으로 말한다 — 이 자리에서 응답이 정하는 것은 동의 내역 하나다", () => {
    expect(buildPrivacyEmptyStateCard({ hasSession: true, settled: true, showsConsentCard: false })).toEqual({
      action: "refresh",
      title: "표시할 동의 내역이 없어요.",
      actionLabel: "새로고침"
    });
  });

  it("조회가 꺼져 있는 비세션에서는 새로고침이 아니라 로그인이 그 행동이다", () => {
    expect(buildPrivacyEmptyStateCard({ hasSession: false, settled: true, showsConsentCard: false })).toEqual({
      action: "login",
      title: "로그인 후 이용할 수 있어요.",
      actionLabel: "로그인하기"
    });
    // 잠금 카드 셋(app-lock · children · notifications)이 이미 쓰는 그 한 벌이다(새 문구 0건).
    for (const path of ["app/settings/app-lock.tsx", "app/settings/children.tsx", "app/settings/notifications.tsx"]) {
      expect(source(path), `${path}의 잠금 카드`).toContain('title="로그인 후 이용할 수 있어요."');
      expect(source(path), `${path}의 잠금 카드 라벨`).toContain('actionLabel="로그인하기"');
    }
  });
});

describe("빈 상태 감사 — 화면 배선(설정 두 화면)", () => {
  it("아이 관리: 카드가 모듈 산출을 읽고, 액션 키마다 목적지를 배선한다", () => {
    const children = childrenSource();
    expect(children).toContain('from "../../src/settings/empty-state-cards"');
    expect(children).toContain("const childrenEmptyCard = buildChildrenEmptyStateCard({");
    expect(children).toContain("listEmpty: children.isSuccess && childList.length === 0,");
    const at = children.indexOf('childrenEmptyCard.action === "add-child" ? (');
    expect(at, "추가 갈래").toBeGreaterThan(-1);
    const block = children.slice(at, children.indexOf(") : null}", at));
    expect(block, "추가 갈래의 목적지").toContain("onPress={startAdd}");
    expect(block, "새로고침 갈래의 목적지").toContain("onPress={() => children.refetch()}");
    // 액션이 없는 갈래에는 버튼 노드를 만들지 않는다(GAP-071 #5의 짝 계약).
    expect(block).toContain("<EmptyStateCard title={childrenEmptyCard.title} />");
  });

  it("아이 관리: 목록 아래 [아이 추가]가 같은 판정 하나를 읽는다 (입구가 둘이 되지 않는다)", () => {
    const children = childrenSource();
    expect(children).toContain(
      "hasSession && canAddChild && !isDemoSession && !addOpen && showsStandingAddChildEntry(childrenEmptyCard)"
    );
    // 추가의 역할·데모 게이트는 종전 그대로다(이 감사는 게이트를 넓히지 않는다).
    expect(children).toContain("canAddChild && !isDemoSession && addOpen");
    expect(children).toContain("|| isDemoSession) return;");
  });

  it("아이 관리: 화면이 문구를 다시 적지 않는다", () => {
    const children = maskComments(childrenSource());
    expect(children, "0건 카드 제목 리터럴").not.toContain('title="등록된 아이가 없어요"');
    expect(children, "0건 카드 새로고침 라벨").not.toContain('actionLabel="새로고침"');
  });

  it("개인정보: 판정이 flows 개수가 아니라 동의 카드를 읽고, 비세션은 로그인으로 간다", () => {
    const privacy = privacySource();
    expect(privacy).toContain('from "../../src/settings/empty-state-cards"');
    expect(privacy).toContain("const privacyEmptyCard = buildPrivacyEmptyStateCard({");
    expect(privacy).toContain("showsConsentCard: showConsentCard");
    // 종전 판정(응답의 flows 개수)은 사라졌다 — 삭제·탈퇴 카드 셋은 응답이 아니라 화면 안
    // flowCopy로 언제나 그려지므로, 그 개수는 이 자리에서 무엇이 없는지를 말해 주지 못한다.
    const rendered = maskComments(privacy);
    expect(rendered, "옛 판정").not.toContain("flows.length === 0");
    expect(rendered, "옛 제목").not.toContain('title="표시할 항목이 없어요"');
    const at = privacy.indexOf('privacyEmptyCard.action === "login" ? (');
    expect(at, "비세션 갈래").toBeGreaterThan(-1);
    const block = privacy.slice(at, privacy.indexOf(") : null}", at));
    expect(block, "비세션 목적지").toContain('onPress={() => router.push("/login")}');
    expect(block, "세션 목적지").toContain("onPress={() => privacy.refetch()}");
  });

  it("개인정보: 삭제·탈퇴 카드 셋(SET-004)은 이 감사와 무관하게 종전 그대로 선다", () => {
    const privacy = privacySource();
    expect(privacy).toContain('testID="screen-SET-004"');
    for (const flowTitle of ["아이 프로필 삭제", "가구 탈퇴", "계정 삭제"]) {
      expect(privacy, `${flowTitle} 카드`).toContain(`title: "${flowTitle}"`);
    }
    expect(privacy).toContain("{flowCopy.child_profile_delete.title}");
  });
});
