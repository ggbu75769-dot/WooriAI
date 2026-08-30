import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BORN_TRANSITION_ACTION_LABEL,
  BORN_TRANSITION_CONFIRM_CTA,
  BORN_TRANSITION_CONFIRM_MESSAGE,
  BORN_TRANSITION_CONFIRM_TITLE,
  buildUpdateChildBody,
  canTransitionStageMode,
  isChildFormValid,
  validateChildForm,
  type ChildFormValues
} from "./child-form";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * CHILD-127: 임신 중 가입한 사용자의 아이가 태어나도 stageMode를 born으로 바꿀 방법이 없어
 * 100일/첫돌 리포트가 영구히 막히고 단계·준비템 밴드가 출산예정일에 고정되던 결함.
 * 순수 로직(전환 가능 여부, 바디 조립)은 실제로 import해서 검증하고, 화면 배선은
 * manage-children-flow.test.ts / child-deletion.test.ts의 source-grep 관례를 따른다
 * (react-native를 import하는 화면은 vitest에서 렌더할 수 없다).
 */
describe("CHILD-127 전환 가능 여부 판정", () => {
  it("allows pregnant → born only", () => {
    expect(canTransitionStageMode("pregnant", "born")).toBe(true);
  });

  it("refuses the reverse direction and every other combination (mirrors the server rule)", () => {
    expect(canTransitionStageMode("born", "pregnant")).toBe(false);
    expect(canTransitionStageMode("born", "manual")).toBe(false);
    expect(canTransitionStageMode("manual", "born")).toBe(false);
    expect(canTransitionStageMode("manual", "pregnant")).toBe(false);
    expect(canTransitionStageMode("pregnant", "manual")).toBe(false);
    // 이미 born인 아이에게는 액션 자체가 뜨면 안 된다 (같은 값으로의 "전환"도 false).
    expect(canTransitionStageMode("born", "born")).toBe(false);
    // 아이 목록이 아직 안 왔을 때 (stageMode 미상) 도 액션을 열지 않는다.
    expect(canTransitionStageMode(null, "born")).toBe(false);
  });
});

describe("CHILD-127 전환 PATCH 바디 조립", () => {
  const values = (dateText: string): ChildFormValues => ({ nickname: " 튼튼이 ", dateText, manualStage: null });

  it("sends stageMode and birthDate together, and never a dueDate (the server keeps the stored one)", () => {
    const body = buildUpdateChildBody("pregnant", values(" 2026-03-01 "), { transitionToStageMode: "born" });
    expect(body).toEqual({ nickname: "튼튼이", stageMode: "born", birthDate: "2026-03-01" });
    expect(body).not.toHaveProperty("dueDate");
    expect(body).not.toHaveProperty("manualStage");
  });

  it("refuses to assemble a body for a transition the server would reject", () => {
    expect(() => buildUpdateChildBody("born", values("2026-03-01"), { transitionToStageMode: "pregnant" })).toThrow(
      /허용되지 않은 아이 상태 전환/
    );
    expect(() => buildUpdateChildBody("manual", values("2026-03-01"), { transitionToStageMode: "born" })).toThrow();
    expect(() => buildUpdateChildBody("pregnant", values("2026-03-01"), { transitionToStageMode: "manual" })).toThrow();
  });

  it("keeps the plain edit body byte-identical when no transition is requested (backward compatible)", () => {
    const plain = buildUpdateChildBody("pregnant", values("2026-08-31"));
    expect(plain).toEqual({ nickname: "튼튼이", dueDate: "2026-08-31" });
    expect(plain).not.toHaveProperty("stageMode");
    // 같은 stageMode를 target으로 넘겨도 전환이 아니므로 stageMode를 붙이지 않는다.
    expect(buildUpdateChildBody("pregnant", values("2026-08-31"), { transitionToStageMode: "pregnant" })).toEqual({
      nickname: "튼튼이",
      dueDate: "2026-08-31"
    });
  });

  it("validates the entered birth date with the same rules as the born edit form", () => {
    const check = (dateText: string) =>
      validateChildForm("born", { nickname: "튼튼이", dateText, manualStage: null }, { requireDate: true });
    expect(check("").dateError).toBe("아이 생년월일을 입력해 주세요.");
    expect(check("2026/03/01").dateError).toBe("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
    expect(check("2026-02-30").dateError).toBe("실제 존재하는 날짜인지 확인해 주세요.");
    expect(check("2999-01-01").dateError).toBe("출생일은 오늘보다 미래일 수 없어요.");
    expect(isChildFormValid(check("2026-03-01"))).toBe(true);
  });
});

describe("CHILD-127 안내 문구 (DNC-018 해요체)", () => {
  it("names the action after what happened and warns that the switch is one-way", () => {
    expect(BORN_TRANSITION_ACTION_LABEL).toBe("아이가 태어났어요");
    expect(BORN_TRANSITION_CONFIRM_MESSAGE).toContain("출산예정일");
    expect(BORN_TRANSITION_CONFIRM_MESSAGE).toContain("출생일 기준으로 바뀌어요");
    expect(BORN_TRANSITION_CONFIRM_MESSAGE).toContain("되돌릴 수는 없어요");
    for (const copy of [BORN_TRANSITION_CONFIRM_TITLE, BORN_TRANSITION_CONFIRM_MESSAGE, BORN_TRANSITION_CONFIRM_CTA]) {
      expect(copy.trim().length).toBeGreaterThan(0);
      expect(copy).not.toMatch(/[a-zA-Z]/);
    }
  });
});

describe("CHILD-127 아이 관리 화면 배선 (app/settings/children.tsx source contract)", () => {
  const screenSource = source("app/settings/children.tsx");

  it("offers the action only on a pregnant child, and only to editors", () => {
    expect(screenSource).toContain(
      'canEditChildren && canTransitionStageMode(child.stageMode, "born") && bornChildId !== child.id'
    );
    expect(screenSource).toContain("label={BORN_TRANSITION_ACTION_LABEL}");
    // 상태 전환은 별도 카드 상태를 쓴다 -- 편집 폼과 폼/에러 상태를 공유하지 않는다.
    expect(screenSource).toContain("const [bornChildId, setBornChildId] = useState<string | null>(null)");
    expect(screenSource).toContain("const [bornDateText, setBornDateText] = useState(\"\")");
  });

  it("collects the birth date through the same date field the edit form uses", () => {
    expect(screenSource).toContain("function ChildDateField(");
    expect(screenSource).toContain("accessibilityLabel={`${dateLabel} 입력`}");
    expect(screenSource).toContain('dateLabel={requiredDateFieldLabel("born")!}');
    expect(screenSource).toContain('validateChildForm("born", bornTransitionValues(child), { requireDate: true })');
  });

  it("confirms with an Alert before the irreversible PATCH", () => {
    expect(screenSource).toContain('import { Alert, Pressable, Text, TextInput, View } from "react-native"');
    expect(screenSource).toContain("Alert.alert(BORN_TRANSITION_CONFIRM_TITLE, BORN_TRANSITION_CONFIRM_MESSAGE");
    expect(screenSource).toContain('{ text: "취소", style: "cancel" }');
    expect(screenSource).toContain("onPress: () => markChildBorn.mutate({ child, values })");
    // 확인 전에 검증부터 -- 잘못된 날짜로 Alert를 띄우지 않는다.
    const submitBlock = screenSource.slice(screenSource.indexOf("const submitBornTransition = (child: Child) => {"));
    expect(submitBlock.indexOf("isChildFormValid(errors)")).toBeLessThan(submitBlock.indexOf("Alert.alert("));
    expect(submitBlock).toContain('canTransitionStageMode(child.stageMode, "born")');
  });

  it("PATCHes through the shared builder and invalidates every child-scoped cache on success", () => {
    expect(screenSource).toContain(
      'buildUpdateChildBody(input.child.stageMode, input.values, { transitionToStageMode: "born" })'
    );
    // 무효화는 편집과 같은 단일 경로를 쓴다 (children + CHILD_SCOPED_QUERY_KEY_PREFIXES: home/items/report/...).
    const successBlock = screenSource.slice(screenSource.indexOf("const markChildBorn = useMutation("));
    expect(successBlock.slice(0, 1200)).toContain("await invalidateChildScopedQueries()");
    expect(screenSource).toContain("CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => queryClient.invalidateQueries");
    expect(successBlock.slice(0, 1200)).toContain("announceForA11y(");
  });

  it("shows the existing save-failure copy instead of a silent failure", () => {
    // 라운드 70 리뷰(M-2): 자리마다 **자기 뮤테이션의** 사유를 그린다 — 종전에는 세 뮤테이션이
    // 한 문장(saveFailedText)을 공유해서, 편집이 먼저 실패해 있으면 이 자리가 남의 사유를
    // 읽었다(`??` 체인은 언제나 먼저 실패한 것을 고른다). 계약은 src/offline/messages.test.ts.
    // ⚠️ 라운드 79 통합: 여는 태그의 바이트가 아니라 **모양**을 묻는다 — 조건(markChildBorn)·
    // 스타일·문장은 그대로 엄격하고, 접근성 프롭에는 관대하다(낭독 계약은 src/a11y-contract.test.ts).
    expect(screenSource).toMatch(
      /\{markChildBorn\.isError \? <Text[^>]*style=\{\{ color: theme\.colors\.danger \}\}>\{bornFailedText\}<\/Text> : null\}/
    );
    expect(screenSource).toContain("const bornFailedText = useSaveErrorCopy(markChildBorn.isError, markChildBorn.error);");
    expect(screenSource).toContain("disabled={markChildBorn.isPending}");
  });

  it("keeps the transition out of the plain edit form (stageMode is not a form field)", () => {
    // 편집 저장 경로는 그대로 -- 전환 옵션 없이 호출된다.
    expect(screenSource).toContain("buildUpdateChildBody(input.child.stageMode, input.values)");
    // 편집 폼의 모드 칩(CHILD_STAGE_MODE_OPTIONS)은 여전히 '아이 추가'에서만 쓴다.
    const editFormBlock = screenSource.slice(
      screenSource.indexOf("function ChildFormFields("),
      screenSource.indexOf("function formValuesForChild(")
    );
    expect(editFormBlock).not.toContain("CHILD_STAGE_MODE_OPTIONS");
  });
});
