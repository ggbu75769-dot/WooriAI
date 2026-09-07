import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildCreateChildBody,
  canTransitionStageMode,
  requiredDateFieldLabel,
  validateChildForm,
  BORN_TRANSITION_CONFIRM_MESSAGE,
  CHILD_STAGE_MODE_OPTIONS
} from "../children/child-form";

/**
 * 라운드 108(온보딩 나가는 길) — **ONB-001 세 번째 카드가 잠그는 것을 고르기 전에 말한다.**
 *
 * ## 무엇이 문제였나 (⚠️ 두 시점)
 *
 * 종전 그 카드의 설명은 `"지금 상황에 맞는 단계를 나중에 골라주세요."` **한 줄**이었고, 그 한
 * 줄이 두 가지를 잘못 말했다(그때도 틀렸다 — 사실이 바뀐 것이 아니다):
 *
 *  ⓐ **"나중에"가 아니었다.** 바로 다음 화면(ONB-002)이 단계를 필수로 묻고, 고르기 전에는
 *     [다음]이 비활성이다. 미루려고 고른 사람이 한 걸음 뒤에 같은 질문을 받았다.
 *  ⓑ **영구히 잠기는데 아무 말이 없었다.** manual로 만든 아이는 예정일도 생년월일도 받지
 *     않고 모드를 옮기는 길도 없어서, 날짜에서 나오는 기능 셋이 영원히 꺼져 있다.
 *
 * ## 이 파일이 무는 것 — 문구가 아니라 **문구가 말하는 사실**
 *
 * 카피를 리터럴로 못 박는 계약은 이미 있다(`src/a11y-contract.test.ts`의 ONB-001 카드 블록이
 * 제목·순서·낭독 라벨을 진다). 여기가 지는 몫은 다른 것이다: **그 설명이 오늘도 참인가.**
 * 그래서 셋을 나란히 세운다 — ⓐ 설명이 그 사실들을 말하고 있는가(소스), ⓑ 그 사실들이 오늘의
 * 코드에서 실제로 그러한가(순수 모듈 평가 + 소스 증인), ⓒ 어투가 이웃 문장과 같은가(DNC-018).
 * 사실 쪽이 바뀌는 날 — 예를 들어 서버가 manual → born 전이를 받게 되는 날 — 이 파일이
 * **먼저** 빨개지고, 그때 고칠 것은 화면의 문장이다.
 *
 * ⚠️ 전이 규칙 자체를 넓히는 것은 이 라운드가 하지 않았다(DNC-007에 닿는 별도 결정이다).
 * 바뀐 것은 말뿐이라, 아래 어느 단언도 서버 계약을 요구하지 않는다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const CHILD_STATUS_PATH = "app/(onboarding)/child-status.tsx";
const CHILD_PROFILE_PATH = "app/(onboarding)/child-profile.tsx";
const BUDGET_PATH = "app/(onboarding)/budget.tsx";

/** 주석을 걷은 뷰 — 이 라운드의 근거 문단이 옛 문장을 그대로 인용하기 때문이다. */
function withoutComments(sourceText: string): string {
  return sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * ONB-001의 카드 정의를 **소스에서** 읽는다(문구를 이 파일에 옮겨 적지 않는다).
 * 모양은 `src/a11y-contract.test.ts`가 이미 쓰는 그 파서를 인용한다 — 그 계약이 이 배열을
 * `description: "…"` **한 줄 리터럴**로 읽으므로, 설명을 여러 줄로 접으면 거기가 먼저 빨개진다.
 */
function stageCards(): { mode: string; title: string; description: string }[] {
  const src = source(CHILD_STATUS_PATH);
  // 양끝 존재 가드: 어느 한쪽 앵커가 사라지면 slice(-1, …)가 조용히 엉뚱한 구간을 잘라
  // 아래 matchAll이 0건을 내고, 그 0건이 "카드가 셋이다" 단언에서야 뒤늦게 드러난다.
  // 무엇이 없어졌는지 이름으로 먼저 말한다.
  const blockStart = src.indexOf("const stageOptions");
  expect(blockStart, "stageOptions 선언").toBeGreaterThan(-1);
  const blockEnd = src.indexOf("export default function");
  expect(blockEnd, "화면 컴포넌트 선언(stageOptions 구간의 끝)").toBeGreaterThan(blockStart);
  const block = src.slice(blockStart, blockEnd);
  const found = [
    ...block.matchAll(
      /\{\s*mode: "(\w+)",\s*icon: "([^"]+)",\s*title: "([^"]+)",\s*description: "([^"]+)",\s*tint: ([^\s,}]+)\s*\}/g
    )
  ].map((match) => ({ mode: match[1], title: match[3], description: match[4] }));
  if (found.length === 0) throw new Error("ONB-001의 카드 정의를 소스에서 찾지 못했다");
  return found;
}

const manualCard = () => {
  const card = stageCards().find((option) => option.mode === "manual");
  if (!card) throw new Error("manual 카드를 소스에서 찾지 못했다");
  return card;
};

/** ⚠️ 지우지 않고 남기는 **종전 설명의 원문**(AE-3의 왼쪽). */
const PREVIOUS_MANUAL_DESCRIPTION = "지금 상황에 맞는 단계를 나중에 골라주세요." as const;

describe("라운드 108 ⓐ — manual 카드가 잠그는 것을 고르기 전에 말한다", () => {
  it("세 카드 정의가 그대로 파싱되고, manual 카드의 설명이 종전 한 줄이 아니다", () => {
    const cards = stageCards();
    // 파서가 빗나가면 아래 전부가 조용히 공허해진다 — 셋이 다 잡히는지 먼저 본다.
    expect(cards.map((card) => card.mode)).toEqual(CHILD_STAGE_MODE_OPTIONS.map((option) => option.mode));
    expect(manualCard().description, "종전 한 줄이 그대로 남아 있다").not.toBe(PREVIOUS_MANUAL_DESCRIPTION);
    // ⚠️ 종전 문장의 거짓말은 "나중에"였다 — 그 낱말이 이 카드에서 사라졌다.
    expect(manualCard().description, "미룰 수 있다는 뜻이 남아 있다").not.toContain("나중에 골라");
  });

  it("설명이 사실 셋을 말한다 — 지금 고른다 · 무엇이 보이지 않는다 · 되돌릴 수 없다", () => {
    const description = manualCard().description;
    // ⓐ 언제 묻는가 — "다음 화면"이라고 적는다(미룬다고 말하지 않는다).
    expect(description).toContain("다음 화면");
    // ⓑ 무엇을 받지 않는가 → 그래서 무엇이 보이지 않는가.
    for (const fact of ["예정일", "생년월일", "100일", "첫돌"]) {
      expect(description, `잃는 것을 말하지 않는다: ${fact}`).toContain(fact);
    }
    // ⓒ 되돌릴 수 없다는 사실. 대안도 그 한 마디가 함께 진다(가리키는 것이 바로 위 두 카드다).
    expect(description).toContain("위 두 가지");
    expect(description).toContain("바꿀 수도 없어요");
  });

  it("어투가 이웃한 되돌릴 수 없음 문장과 같은 관찰형 해요체다 (DNC-018)", () => {
    const description = manualCard().description;
    // 이웃 문장이 이 저장소의 본보기다 — 사실만 말하고 재촉하지 않는다.
    expect(BORN_TRANSITION_CONFIRM_MESSAGE).toContain("되돌릴 수는 없어요");
    expect(description.endsWith("요.")).toBe(true);
    for (const blaming of ["주의", "경고", "안 됩니다", "해야 해요", "꼭 ", "!", "?"]) {
      expect(description, `겁주거나 다그치는 말이 들어 있다: ${blaming}`).not.toContain(blaming);
    }
    // 같은 사실을 두 번 말하지 않는다 — 카드 셋 가운데 이 문장을 지는 것은 하나뿐이다.
    const carrying = stageCards().filter((card) => card.description.includes("바꿀 수도 없어요"));
    expect(carrying.map((card) => card.mode)).toEqual(["manual"]);
  });

  it("눈과 귀가 같은 값을 받는다 — 설명이 곧 낭독 문장이다", () => {
    const src = source(CHILD_STATUS_PATH);
    // ONB-001의 카드 라벨은 제목 + 설명 한 틀이다(a11y-contract가 그 틀을 진다). 그래서 이
    // 사실들을 설명 밖(별도 Text)에 두면 소리로는 도달하지 않는다 — 그 배선이 살아 있는지 본다.
    expect(src).toContain("accessibilityLabel={`${option.title}. ${option.description}`}");
    expect(src).toContain("{option.description}");
  });
});

describe("라운드 108 ⓑ — 그 설명이 말하는 사실이 오늘의 코드에서 참이다", () => {
  it("사실 ①: manual은 다음 화면에서 **바로** 단계를 묻고, 고르기 전에는 저장이 막힌다", () => {
    const errors = validateChildForm("manual", { nickname: "튼튼이", dateText: "", manualStage: null });
    expect(errors.manualStageError).toBe("아이 단계를 하나 선택해 주세요.");
    const chosen = validateChildForm("manual", { nickname: "튼튼이", dateText: "", manualStage: "newborn_0_3" });
    expect(chosen.manualStageError).toBeNull();
    // 화면이 그 판정으로 [다음]을 막는다(ONB-002).
    const profile = withoutComments(source(CHILD_PROFILE_PATH));
    expect(profile).toContain('draft.stageMode === "manual" ?');
    expect(profile).toContain("!manualStageError");
  });

  it("사실 ②: manual 아이는 예정일도 생년월일도 받지 않는다(만들 때도, 고칠 때도)", () => {
    // 만들 때 — 두 날짜가 바디에서 빠진다.
    const body = buildCreateChildBody("household-1", "manual", {
      nickname: "튼튼이",
      dateText: "2026-01-02",
      manualStage: "newborn_0_3"
    });
    expect(body.dueDate).toBeUndefined();
    expect(body.birthDate).toBeUndefined();
    expect(body.manualStage).toBe("newborn_0_3");
    // 고칠 때 — 폼에 날짜 칸 자체가 없다(라벨이 null이면 그 칸이 그려지지 않는다).
    expect(requiredDateFieldLabel("manual")).toBeNull();
    expect(requiredDateFieldLabel("pregnant")).toBe("출산 예정일");
    expect(requiredDateFieldLabel("born")).toBe("출생일");
  });

  it("사실 ③: 그래서 날짜에서 나오는 기능 셋이 꺼져 있다 (홈 카운터 · 마일스톤 카드 · 마일스톤 리포트)", () => {
    // ⓐ 홈 헤더의 날짜 카운터 — manual에는 만들지 않는다.
    expect(source("src/home/baby-counter.ts")).toContain("manual(수동 단계) 및 알 수 없는 stageMode");
    // ⓑ 홈의 100일·첫돌 카운트다운 카드 — 출생 전(pregnant/manual)에는 아예 만들지 않는다.
    expect(source("src/home/milestone-countdown.ts")).toContain("출생 전(pregnant/manual)에는 아예 만들지 않는다");
    // ⓒ 리포트 탭의 마일스톤 리포트 — 생년월일이 없는 아이는 서버가 MILESTONE_UNAVAILABLE로 답한다.
    expect(source("app/(tabs)/reports.tsx")).toContain("MILESTONE_UNAVAILABLE");
    expect(source("src/api/local-backend.ts")).toContain("아이 생년월일이 등록되어야 100일/첫돌 리포트를 만들 수 있어요.");
  });

  it("사실 ④: 방식을 옮기는 길이 없다 — 허용된 전이는 pregnant → born 하나뿐이다", () => {
    const modes = CHILD_STAGE_MODE_OPTIONS.map((option) => option.mode);
    const allowed = modes.flatMap((from) =>
      modes.filter((to) => canTransitionStageMode(from, to)).map((to) => `${from}->${to}`)
    );
    expect(allowed, "허용된 전이").toEqual(["pregnant->born"]);
    // manual에서 나가는 전이는 0건이다 — 그래서 "위 두 가지로 바꿀 수도 없어요"가 참이다.
    expect(allowed.filter((pair) => pair.startsWith("manual->")), "manual에서 나가는 전이").toEqual([]);
    // 설정 화면의 전환 버튼이 그 술어 뒤에 선다(화면이 자기 판정을 따로 짓지 않는다).
    expect(source("app/settings/children.tsx")).toContain('canTransitionStageMode(child.stageMode, "born")');
  });

  it("⚠️ 잠기지 **않는** 것은 말하지 않는다 — 고른 단계 자체는 나중에 바꿀 수 있다", () => {
    // 이 구분이 문장의 정확도다: 잠기는 것은 **방식**(stageMode)이고, manualStage는 편집 폼에서
    // 언제든 바뀐다. 그래서 설명은 "단계를 바꿀 수 없다"고 말하지 않는다.
    const settings = source("app/settings/children.tsx");
    expect(settings).toContain('stageMode === "manual" ? (');
    expect(settings).toContain("아이 단계 선택");
    expect(manualCard().description, "바꿀 수 있는 것까지 잠긴다고 말한다").not.toContain("단계를 바꿀 수");
  });
});

describe("라운드 108 ⓒ — ONB-004의 기본값이 제안의 자리로 내려간다", () => {
  /** ⚠️ 지우지 않고 남기는 종전 기본값(AE-3의 왼쪽). 라운드 107까지 이 화면의 첫 렌더였다. */
  const PREVIOUS_BUDGET_DEFAULT = '"500000"' as const;

  it("빈 값에서 시작하고, 50만원은 placeholder로만 남는다", () => {
    const screen = withoutComments(source(BUDGET_PATH));
    expect(screen, "종전 기본값이 그대로 서 있다").not.toContain(`useState(${PREVIOUS_BUDGET_DEFAULT})`);
    expect(screen).toContain('const [amountDigits, setAmountDigits] = useState("");');
    expect(screen).toContain('placeholder="예) 500,000"');
  });

  it("그 꼴이 이 저장소가 이미 쓰는 관례다 (앞 걸음 ONB-002 · 예산 수정 화면 · money 모듈)", () => {
    // ⓐ 바로 앞 걸음이 같은 결함을 같은 방식으로 고쳤다(미리 채운 값 → 빈 칸 + placeholder).
    const profile = withoutComments(source(CHILD_PROFILE_PATH));
    expect(profile).toContain('const [nickname, setNickname] = useState("");');
    expect(profile).toContain('placeholder="예) 튼튼이"');
    // ⓑ 같은 값을 나중에 고치는 화면도 빈 값 + placeholder로 선다.
    const budgetEdit = withoutComments(source("app/budget.tsx"));
    expect(budgetEdit).toContain('const [amountDigits, setAmountDigits] = useState("");');
    // ⓒ 빈 문자열을 빈 문자열로 돌려주는 것은 money 모듈의 **의도**다(placeholder가 살아 있도록).
    expect(source("src/money.ts")).toContain("so the field's placeholder keeps showing");
  });

  it("새 갈래를 만들지 않는다 — 예산 미설정은 이 화면이 이미 만들던 상태다", () => {
    const screen = withoutComments(source(BUDGET_PATH));
    // 건너뛰기는 예산을 저장하지 않고 온보딩을 끝낸다(그 상태가 곧 "예산 미설정"이다).
    expect(screen).toContain('<TextButton disabled={save.isPending} label="나중에 설정할게요" onPress={skip}');
    const skipAt = screen.indexOf("function skip()");
    expect(skipAt, "건너뛰기 함수를 소스에서 찾지 못했다").toBeGreaterThan(-1);
    // 끝 앵커도 함께 잠근다 — 함수 닫는 줄의 모양이 바뀌면 slice가 파일 끝까지 삼켜
    // 아래 not.toContain이 화면 전체를 훑게 되고, 그때 이 단언은 거짓으로 빨개진다.
    const skipEnd = screen.indexOf("\n  }", skipAt);
    expect(skipEnd, "건너뛰기 함수의 닫는 줄").toBeGreaterThan(skipAt);
    const skipBody = screen.slice(skipAt, skipEnd);
    expect(skipBody, "건너뛰기가 예산을 저장한다").not.toContain("upsertBudget");
    expect(skipBody).toContain('completeStep("ONB-004")');
    expect(skipBody).toContain("markHomeReached()");
    // 홈은 그 상태를 진행바 대신 넛지로 받는다 — 화면 밖에 이미 서 있는 갈래다.
    expect(source("src/home/budget-progress.ts")).toContain("예산 미설정");
    expect(source("src/home/budget-pace.ts")).toContain("예산 미설정");
  });

  it("아무것도 치지 않은 첫 렌더에서 꾸짖지 않는다 — 오류 문구는 입력이 있을 때만 뜬다", () => {
    const screen = withoutComments(source(BUDGET_PATH));
    // 종전 가드가 그대로다(빈 칸은 아직 오류가 아니다 — ONB-002의 같은 규율).
    expect(screen).toContain("amountDigits.length > 0 && amountKrw <= 0");
    // 대신 기본 버튼이 비활성으로 시작한다(0원 저장이 새 나가지 않는다).
    expect(screen).toContain("const canSave = !amountError && amountKrw > 0");
  });
});
