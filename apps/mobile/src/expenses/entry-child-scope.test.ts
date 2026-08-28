import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveChildScopeLabel,
  withChildScopeLabel,
  withSpokenChildScopeLabel
} from "../children/child-switch";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * GAP-060 #7(트랙 B 몫) — **쓰기 화면의 아이 스코프 라벨**, 빠른 기록 시트 편.
 *
 * 고치는 문제: 4탭(홈·기록·준비템·리포트)은 라운드 48~49에 전부 "누구의 숫자인가"를 달았는데
 * 정작 **쓰는 화면**에는 하나도 없었다. 아이 선택은 전역 스토어라 시트가 열려 있는 동안에도
 * 바뀌고(알림·딥링크·다른 탭), 둘째를 보다 FAB를 누른 사용자는 저장한 뒤 합계가 엉뚱한 아이
 * 밑에서 늘어난 것을 보고서야 안다.
 *
 * 새 어휘를 만들지 않는다: 라벨 해석도 문장 조립도 4탭이 쓰는 순수 모듈 한 벌
 * (src/children/child-switch.ts)에서 온다. 나머지 쓰기 화면(지출 상세·예산·정기 지출)은
 * 트랙 E가 **이 어휘를 그대로** 따른다 — 제목 문자열만 갈아 끼운다.
 */
describe("#7 빠른 기록 시트의 아이 스코프 라벨", () => {
  it("어휘는 4탭과 같다: 눈에는 줄표, 귀에는 쉼표, 이름이 먼저", () => {
    expect(withChildScopeLabel("지출 기록", "다온이")).toBe("다온이 — 지출 기록");
    expect(withSpokenChildScopeLabel("지출 기록", "다온이")).toBe("다온이, 지출 기록");
  });

  it("다자녀 가구에서만 붙는다 (외동·아이 모름·목록 없음이면 제목이 종전 그대로다)", () => {
    const children = [
      { id: "child-1", nickname: "다온이" },
      { id: "child-2", nickname: "하온이" }
    ];
    expect(resolveChildScopeLabel("child-1", children)).toBe("다온이");
    // 외동 가구·목록을 모를 때·아이를 아직 고르지 않았을 때는 라벨이 없다.
    expect(resolveChildScopeLabel("child-1", [children[0]])).toBeNull();
    expect(resolveChildScopeLabel("child-1", undefined)).toBeNull();
    expect(resolveChildScopeLabel(null, children)).toBeNull();
    // 라벨이 없으면 문장은 원문 그대로다 = 화면이 한 글자도 달라지지 않는다.
    expect(withChildScopeLabel("지출 기록", null)).toBe("지출 기록");
    expect(withSpokenChildScopeLabel("지출 기록", null)).toBe("지출 기록");
  });

  it("시트 제목이 그 두 함수를 쓰고, 부제·크기·정렬은 그대로다", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    expect(newExpenseSource).toContain('withChildScopeLabel("지출 기록", childScopeLabel)');
    expect(newExpenseSource).toContain('accessibilityLabel={withSpokenChildScopeLabel("지출 기록", childScopeLabel)}');
    // 라벨을 화면에서 다시 해석하지 않는다(삼항 연산자·문자열 결합 금지 -- 한 화면만 어긋난다).
    expect(newExpenseSource).toContain(
      "const childScopeLabel = resolveChildScopeLabel(childId, cachedChildren);"
    );
    expect(newExpenseSource).not.toContain("childScopeLabel} — ");
    // DSN-053 P2-C의 헤더 수치는 그대로다(제목 19/800 + 부제 11).
    expect(newExpenseSource).toContain('<Text style={{ color: theme.colors.gray600, fontSize: 11 }}>품목을 고르고 금액만 입력하세요</Text>');
    expect(newExpenseSource).toContain('style={{ color: theme.colors.gray900, fontSize: 19, fontWeight: "800" }}');
  });

  it("아이 목록은 **새 요청 없이** 이미 있는 캐시에서만 읽는다 (시트를 여는 것으로 네트워크가 돌지 않는다)", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    expect(newExpenseSource).toContain('queryClient.getQueryData<{ children: Child[] }>(["children"])?.children');
    // 이 화면의 오랜 계약(auto-fill-wiring.test.ts와 같은 사실): 조회 쿼리를 만들지 않는다.
    expect(newExpenseSource).not.toContain("useQuery(");
  });

  it("EXP-001 비세션 캡처 불변: 캐시 읽기 자체가 authToken 뒤에 있다", () => {
    const newExpenseSource = source("app/expenses/new.tsx");
    expect(newExpenseSource).toContain("const cachedChildren = authToken\n    ? queryClient.getQueryData");
    // 세션이 없으면 목록이 undefined -> 라벨 null -> 제목 문자열이 종전 그대로다.
    expect(resolveChildScopeLabel(null, undefined)).toBeNull();
  });
});
