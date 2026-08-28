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

/**
 * GAP-060 #7(트랙 E 몫) — 남은 세 쓰기 화면(지출 상세·예산·정기 지출)의 같은 라벨.
 *
 * 위 시트가 세운 어휘를 **한 글자도 새로 만들지 않고** 따른다: 해석은 `resolveChildScopeLabel`,
 * 조립은 `withChildScopeLabel`, 조건은 다자녀 ∧ 세션 ∧ 아이 확정. 세 화면 다 공용
 * `ScreenHeader`(src/ui.tsx)의 `title` 슬롯을 쓰므로 라벨은 그 문자열에 붙는다.
 *
 * 낭독 전용 변형(`withSpokenChildScopeLabel`)이 여기서는 쓰이지 않는 이유는 어휘를 어긴 것이
 * 아니라 붙일 자리가 없어서다: 시트 제목은 `numberOfLines={1}`로 잘려 잘리지 않은
 * accessibilityLabel을 따로 두지만(위 테스트), `ScreenHeader`의 제목 Text는 잘리지 않아
 * **보이는 문구가 곧 접근성 이름**이고 덮어쓸 accessibilityLabel 슬롯 자체가 없다. 그 슬롯이
 * 생기면 그때 이 세 화면도 쉼표 변형을 함께 단다.
 */
describe("#7 지출 상세·예산·정기 지출의 아이 스코프 라벨 (트랙 E)", () => {
  it("세 화면 모두 ScreenHeader 제목에 같은 함수로 라벨을 붙인다 (부제·eyebrow·뒤로가기는 그대로)", () => {
    const expectations: ReadonlyArray<[string, string, string]> = [
      ["app/expenses/[expenseId].tsx", "지출 수정", 'eyebrow="지출 상세"'],
      ["app/budget.tsx", "월 예산 수정", 'eyebrow="예산 관리"'],
      ["app/expenses/recurring.tsx", "정기 지출", 'eyebrow="지출"']
    ];
    for (const [path, title, eyebrow] of expectations) {
      const screenSource = source(path);
      expect(screenSource, `${path}의 제목이 라벨 함수를 지나지 않는다`).toContain(
        `title={withChildScopeLabel("${title}", childScopeLabel)}`
      );
      // 문자열 결합·삼항 연산자를 화면에서 다시 적지 않는다(한 화면만 어긋나는 종류의 버그).
      expect(screenSource, `${path}가 라벨을 손으로 조립한다`).not.toContain("childScopeLabel} — ");
      expect(screenSource, `${path}의 종전 제목 리터럴이 남아 있다`).not.toContain(`title="${title}"`);
      // 나머지 헤더 슬롯은 손대지 않는다.
      expect(screenSource, `${path}의 eyebrow가 달라졌다`).toContain(eyebrow);
      expect(screenSource, `${path}의 뒤로가기 슬롯이 사라졌다`).toContain("onBack={() => router.back()}");
    }
  });

  it("지출 상세는 **이 지출이 속한 아이**로 라벨을 정하고, 목록은 이미 있는 useQuery(['children'])를 재사용한다", () => {
    const detailSource = source("app/expenses/[expenseId].tsx");
    // 선택된 아이(selectedChildId)가 아니라 지출의 childId다 -- 알림/딥링크로 다른 아이의 지출을
    // 열 수 있고, 화면이 보여 주는 숫자의 주인을 말해야 한다(라운드 49 C-05와 같은 근거).
    expect(detailSource).toContain(
      "const childScopeLabel = resolveChildScopeLabel(expense.data?.childId, childrenQuery.data?.children);"
    );
    expect(detailSource).not.toContain("resolveChildScopeLabel(selectedChildId");
    // 새 요청 0건: 가구 판정(L-4)이 이미 켜 둔 그 쿼리 하나뿐이고 두 번째가 생기지 않았다.
    expect((detailSource.match(/queryKey: \["children"\]/g) ?? []).length).toBe(1);

    // 판정 자체: 다자녀 가구에서 지출의 아이가 선택된 아이와 달라도 그 지출의 아이 이름이 선다.
    const children = [
      { id: "child-1", nickname: "다온이" },
      { id: "child-2", nickname: "하온이" }
    ];
    expect(withChildScopeLabel("지출 수정", resolveChildScopeLabel("child-2", children))).toBe(
      "하온이 — 지출 수정"
    );
    // 응답 전(로딩·실패)에는 childId가 undefined라 종전 제목 그대로다.
    expect(withChildScopeLabel("지출 수정", resolveChildScopeLabel(undefined, children))).toBe("지출 수정");
  });

  it("예산·정기 지출은 선택된 아이 기준이고, 목록은 **새 요청 없이** 캐시에서만 읽는다", () => {
    for (const [path, childIdExpression] of [
      ["app/budget.tsx", "childId"],
      ["app/expenses/recurring.tsx", "selectedChildId"]
    ] as const) {
      const screenSource = source(path);
      expect(screenSource, `${path}가 ["children"] 조회를 새로 켠다`).toContain(
        'queryClient.getQueryData<{ children: Child[] }>(["children"])?.children'
      );
      expect(screenSource, `${path}에 ["children"] useQuery가 생겼다`).not.toContain(
        'queryKey: ["children"]'
      );
      expect(screenSource, `${path}의 라벨 기준 아이가 다르다`).toContain(
        `const childScopeLabel = resolveChildScopeLabel(${childIdExpression}, cachedChildren);`
      );
      // BUD-001 / 비세션 경로 불변: 캐시 읽기가 authToken 게이트 뒤에 있다.
      expect(screenSource, `${path}의 캐시 읽기가 세션 게이트 밖에 있다`).toContain(
        "const cachedChildren = authToken\n    ? queryClient.getQueryData"
      );
    }
  });

  it("어휘는 트랙 B와 한 벌이다: 외동·비세션·미해석이면 세 제목이 종전 문자열 그대로다", () => {
    for (const title of ["지출 수정", "월 예산 수정", "정기 지출"]) {
      expect(withChildScopeLabel(title, null)).toBe(title);
      expect(withChildScopeLabel(title, resolveChildScopeLabel("child-1", [{ id: "child-1", nickname: "다온이" }]))).toBe(
        title
      );
      expect(withChildScopeLabel(title, resolveChildScopeLabel("child-1", undefined))).toBe(title);
      // 빈 태명은 접두사를 만들지 않는다(허위/빈 표시 금지).
      expect(
        withChildScopeLabel(
          title,
          resolveChildScopeLabel("child-1", [
            { id: "child-1", nickname: "  " },
            { id: "child-2", nickname: "하온이" }
          ])
        )
      ).toBe(title);
    }
  });
});

/**
 * 라운드 62 #7 — 같은 어휘를 **준비템 상세**까지 들고 간다.
 *
 * 왜 이 화면인가: 알림함의 "샀나요?"(purchase_pending)가 데려오는 착지 화면이고, 라운드 62 #2가
 * 이동 전에 그 알림의 아이로 **전환**하도록 고친 뒤로는 사용자가 보고 있는 아이가 조용히 바뀐 채
 * 이 화면이 열린다. 여기서 누르는 "이미 샀어요 · 지출로 기록"이 그 바뀐 아이 밑으로 들어가므로,
 * 화면이 누구의 준비템인지 말하지 않으면 전환 사실이 어디에도 남지 않는다.
 *
 * 이 화면에는 `ScreenHeader`가 없어(플로팅 뒤로가기/공유 + 히어로) 정보 카드 안의 한 줄로 붙는다.
 * 게이트는 기존 관례 그대로 다자녀 ∧ 세션이고, **비세션이 곧 ITEM-002 픽셀락 캡처**라 그 조건이
 * 캡처 불변을 그대로 지킨다.
 */
describe("라운드 62 #7 준비템 상세의 아이 스코프 라벨", () => {
  const itemDetailSource = () => source("app/items/[itemTemplateId].tsx");

  it("라벨은 공용 한 벌로 해석·조립한다 (화면이 문자열을 다시 잇지 않는다)", () => {
    const src = itemDetailSource();
    expect(src).toContain(
      'import { resolveChildScopeLabel, withChildScopeLabel } from "../../src/children/child-switch";'
    );
    expect(src).toContain("const childScopeLabel = resolveChildScopeLabel(childId, cachedChildren);");
    expect(src).toContain('withChildScopeLabel("준비템", childScopeLabel)');
    expect(src).not.toContain("childScopeLabel} — ");
    // 어휘 자체는 4탭·쓰기 화면과 같은 값이다.
    expect(withChildScopeLabel("준비템", "하온이")).toBe("하온이 — 준비템");
  });

  it("게이트는 둘이다: 세션 ∧ 다자녀 — ITEM-002 픽셀락 캡처(비세션)는 한 글자도 달라지지 않는다", () => {
    const src = itemDetailSource();
    // 렌더 게이트(정보 카드 안, 품목명 바로 위).
    expect(src).toContain("{hasSession && childScopeLabel ? (");
    // 캐시 읽기 자체가 authToken 뒤에 있다(같은 파일의 다른 세션 게이트들과 같은 형태).
    expect(src).toContain("const cachedChildren = authToken\n    ? queryClient.getQueryData");
    // 외동·목록 없음·아이 미확정이면 라벨이 null이라 줄 자체가 생기지 않는다.
    expect(resolveChildScopeLabel("child-1", [{ id: "child-1", nickname: "다온이" }])).toBeNull();
    expect(resolveChildScopeLabel("child-1", undefined)).toBeNull();
    expect(resolveChildScopeLabel(null, [
      { id: "child-1", nickname: "다온이" },
      { id: "child-2", nickname: "하온이" }
    ])).toBeNull();
  });

  it("새 요청 0건: ['children'] 조회를 켜지 않고 이미 채워진 캐시만 읽는다", () => {
    const src = itemDetailSource();
    expect(src).toContain('queryClient.getQueryData<{ children: Child[] }>(["children"])?.children');
    expect(src).not.toContain('queryKey: ["children"]');
  });

  it("알림 화면은 전환 사실을 착지 화면에 맡긴다 — 눈에 보이는 잔류 피드백을 두지 않는 근거가 적혀 있다", () => {
    const notificationsSource = source("app/notifications.tsx");
    // 전환은 여전히 공용 한 벌을 지난다(이 라운드가 바꾼 것은 주석과 착지 화면뿐이다).
    expect(notificationsSource).toContain("applyChildSwitch(selectedChildId, child, {");
    expect(notificationsSource).toContain("announce: announceForA11y");
    // push로 곧바로 덮이는 화면이라 눈에 보이는 한 줄을 세울 자리가 없다는 판단 근거.
    expect(notificationsSource).toContain("라운드 62 #7");
    expect(notificationsSource).toContain("착지 화면이 스스로 말한다");
  });
});
