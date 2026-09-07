import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES } from "../api/api-error";
import { INVITE_UNAVAILABLE_ESCAPE_LABEL } from "./invite-accept-messages";

/**
 * 라운드 111 — **가족 화면의 조회 실패 갈래를 연다.**
 *
 * ## 무엇이 막다른 길이었나 (정찰의 실측을 오늘 소스에서 다시 확인했다)
 *
 * `app/family/index.tsx`의 `if (hasSession && membersPhase === "error")`는 정상 렌더보다 **먼저**
 * return하고, 종전에 그 return 안에는 `<AppScreen><EmptyStateCard .../></AppScreen>` 하나뿐이었다.
 * 정상 렌더가 들고 있던 뒤로가기 Pressable(`accessibilityLabel="뒤로가기"` · `‹` · hitSlop 12 ·
 * `router.back()`)은 **그 갈래에 없었다.**
 *  · 앱은 전역 `headerShown:false`(`app/_layout.tsx`)라 OS 헤더도 없다 → 화면 안의 나가는 길 0개.
 *  · 유일한 버튼은 [다시 시도]였는데, 403에서는 **다시 눌러도 영원히 같은 403**이다.
 *
 * 저장소는 이 모양을 이미 두 번 결함으로 판정하고 고쳤다(라운드 93 #1 동기화 상태 화면 ·
 * 라운드 108-T18 준비템 상세). 이 계약은 세 번째가 되풀이되지 않게 그 두 사실을 값으로 문다.
 *
 * ## 이 계약이 무는 두 축
 *
 * ⓐ **실패 갈래에도 나가는 길이 있다** — 그리고 그것은 정상 렌더가 쓰는 **그 한 벌**이지 사본이
 *    아니다(사본이 되는 순간 두 자리가 갈리고, 그 갈림이 이 결함의 원형이다).
 * ⓑ **403에는 재시도를 약속하지 않는다** — 문구도 버튼도 지킬 수 있는 것만 말한다.
 *
 * ⓒ 그리고 **코드가 없는 실패(네트워크·5xx·오프라인)의 문구·행동은 한 글자도 바뀌지 않는다.**
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const FAMILY_SCREEN = "app/family/index.tsx";
const HOUSEHOLD_SERVICE = "../../apps/api/src/households/household-runtime.service.ts";

/** 주석을 지우되 자리는 그대로 둔다(이 저장소의 소스 대조 계약이 쓰는 그 함수). */
function maskComments(sourceText: string): string {
  return sourceText
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_all, prefix: string, line: string) => prefix + line.replace(/./g, " "));
}

/**
 * 두 표지 **사이**를 자른다 — 길이를 손으로 적지 않는다(`screen-phase.test.ts`의 그 관례:
 * 에러 갈래를 `source.slice(errorBranch, loadingBranch)`로 잡는다). 주석이 늘고 줄어도
 * 경계가 따라 움직이므로 이 계약이 길이 상수 때문에 빨개지는 일이 없다.
 */
function sliceBetween(sourceText: string, from: string, to: string): string {
  const start = sourceText.indexOf(from);
  expect(start, `소스에서 찾지 못했다: ${from}`).toBeGreaterThanOrEqual(0);
  const end = sourceText.indexOf(to, start + from.length);
  expect(end, `닫는 표지를 찾지 못했다: ${to}`).toBeGreaterThan(start);
  return sourceText.slice(start, end);
}

describe("라운드 111 ⓐ 가족 화면 실패 갈래의 나가는 길", () => {
  it("실패 갈래가 제목줄(뒤로가기 포함)을 그린다 — 종전에는 카드 하나뿐이었다", () => {
    const code = maskComments(source(FAMILY_SCREEN));
    // 갈래 자체는 종전 그대로다(조건을 바꾸지 않았다).
    expect(code).toContain('if (hasSession && membersPhase === "error") {');
    // 갈래의 경계는 바로 다음 갈래다(길이를 손으로 적지 않는다 — screen-phase.test.ts의 관례).
    const branch = sliceBetween(
      code,
      'if (hasSession && membersPhase === "error") {',
      "if (householdScopePending"
    );
    expect(branch, "실패 갈래 안에 제목줄이 있어야 한다").toContain("<FamilyHeaderRow />");
    expect(branch).toContain("<EmptyStateCard");
    // ⚠️ 정상 렌더보다 **먼저** 서는 갈래라는 사실도 그대로다(그것이 이 결함의 조건이었다).
    expect(code.indexOf("<FamilyHeaderRow />")).toBeLessThan(code.indexOf("if (householdScopePending"));
  });

  it("그 제목줄은 정상 렌더가 쓰는 **그 한 벌**이다 — 사본이 아니라 두 자리가 같은 컴포넌트를 부른다", () => {
    const code = maskComments(source(FAMILY_SCREEN));
    // 두 자리(실패 갈래 · 정상 렌더)에서 정확히 두 번 불린다.
    expect((code.match(/<FamilyHeaderRow \/>/g) ?? []).length, "호출부는 둘이다").toBe(2);
    // 선언은 하나뿐이고, 앱 소스의 공통 규율대로 `export const`가 아니라 화면 지역 함수다.
    expect((code.match(/function FamilyHeaderRow\(\)/g) ?? []).length).toBe(1);
    expect(code).not.toContain("export function FamilyHeaderRow");
    expect(code).not.toContain("const FamilyHeaderRow =");
  });

  it("뒤로가기의 모양은 종전 그대로다 — 문구·역할·hitSlop·목적지 어느 것도 새로 짓지 않았다", () => {
    const raw = source(FAMILY_SCREEN);
    // 이 네 줄이 종전 정상 렌더의 그 Pressable 바이트다(자리만 옮겼다).
    expect(raw).toContain('accessibilityLabel="뒤로가기"');
    expect(raw).toContain("hitSlop={12}");
    expect(raw).toContain("onPress={() => router.back()}");
    expect(raw).toContain("<Text style={familyBackStyle}>‹</Text>");
    // 사본 금지의 자기 증명: 이 화면에 뒤로가기는 **하나**뿐이다(둘이면 두 자리가 갈릴 수 있다).
    // ⚠️ 수는 **주석을 지운 코드**에서 센다 — 이 라운드의 주석이 두 자리에서 그 호출을 인용하므로
    //    원문 바이트로 세면 3이 나온다(그 3은 코드가 아니라 산문이다).
    expect((raw.match(/accessibilityLabel="뒤로가기"/g) ?? []).length, "뒤로가기는 하나뿐이다").toBe(1);
    const code = maskComments(raw);
    expect((code.match(/router\.back\(\)/g) ?? []).length, "router.back()도 하나뿐이다").toBe(1);
  });

  it("⚠️ 이동이 사본이 아니었다는 **소유 밖 계약의 증인** — 눌림 피드백 자리 수가 7 그대로다", () => {
    /**
     * 이 트랙이 고른 값이 아니라 **다른 계약이 이미 붙들고 있던 값**이다: 사본을 만들었다면
     * 8이 되어 `src/family-invite-flow.test.ts`가 먼저 빨개졌을 자리다. 두 줄이 함께 서 있어야
     * 이 선택이 산문이 아니라 **자기 무효화되는 값**이 된다.
     */
    const raw = source(FAMILY_SCREEN);
    expect((raw.match(/style=\{familyPressedTextFeedback\}/g) ?? []).length).toBe(7);
    expect(source("src/family-invite-flow.test.ts")).toContain(
      "expect(familySource.match(/style=\\{familyPressedTextFeedback\\}/g) ?? []).toHaveLength(7);"
    );
  });

  it("이 갈래에 나가는 길이 필요한 이유가 오늘도 참이다 — 앱에는 OS 헤더가 없다", () => {
    expect(source("app/_layout.tsx")).toContain("<Stack screenOptions={{ headerShown: false }}>");
  });

  it("감싸는 View는 새 스타일을 만들지 않는다 — 바로 아래 로딩 갈래가 이미 쓰는 그 간격이다", () => {
    const code = maskComments(source(FAMILY_SCREEN));
    expect((code.match(/<View style=\{\{ gap: theme\.spacing\.section \}\}>/g) ?? []).length).toBe(2);
  });
});

describe("라운드 111 ⓑ 403에는 재시도를 약속하지 않는다", () => {
  it("서버 실측 — 이 화면의 조회 403은 `assertMember`의 code: \"FORBIDDEN\"이다", () => {
    const service = source(HOUSEHOLD_SERVICE);
    // 이 화면이 부르는 그 엔드포인트가 실제로 그 가드를 지난다.
    expect(service).toContain("  async listMembers(user: AuthenticatedUser, householdId: string) {\n    this.assertMember(user, householdId);");
    // 가드가 던지는 값(코드가 `HOUSEHOLD_*`가 아니라 일반 403 기본 코드라는 것이 이 자리의 실측이다).
    expect(service).toContain("  private assertMember(user: AuthenticatedUser, householdId: string) {");
    expect(service).toContain(
      'throw new ForbiddenException({ code: "FORBIDDEN", message: "가족 접근 권한이 없어요." });'
    );
  });

  it("앱이 그 코드를 읽을 수 있다 — client는 봉투를 들고 있는 ApiHttpError를 던진다", () => {
    const client = maskComments(source("src/api/client.ts"));
    // 이 화면의 조회가 지나는 배선(로컬 데모 토큰이 아니면 requestJson).
    expect(client).toContain(
      'return requestJson<{ members: HouseholdMember[] }>(`/households/${householdId}/members`, { token });'
    );
    expect(client).toContain("throw new ApiHttpError(response.status, data);");
  });

  it("화면은 그 코드일 때만 갈린다 — 추출기도 문구도 이미 있는 한 벌을 읽는다", () => {
    const code = maskComments(source(FAMILY_SCREEN));
    expect(code).toContain(
      'const forbiddenTitle = familyErrorCodeOf(members.error) === "FORBIDDEN" ? apiErrorMessageForCode("FORBIDDEN") : null;'
    );
    // 봉투를 이 화면이 다시 파싱하지 않는다(가족 도메인의 추출기 한 벌을 지난다).
    expect(code).not.toContain("error?.body?.code");
    expect(code).not.toContain("JSON.parse(");
    expect(source("src/family/member-mutation-messages.ts")).toContain(
      "export function familyErrorCodeOf(error: unknown): string | null {"
    );
  });

  it("문장은 표의 그 한 줄이다 — 화면이 새 문구를 짓지 않는다", () => {
    // 기대값은 리터럴이다(표를 다시 불러 만든 값과 비교하지 않는다).
    expect(API_ERROR_MESSAGES.FORBIDDEN).toBe(
      "권한이 없어 처리하지 못했어요. 가족 구성원 여부와 내 역할을 확인해 주세요."
    );
    // 화면에는 그 문장의 사본이 없다(주석을 지운 코드에서 확인한다).
    expect(maskComments(source(FAMILY_SCREEN))).not.toContain("가족 구성원 여부와 내 역할을");
  });

  it("그 문장은 **기다리라고 말하지 않는다** — 이 축의 값은 문구 자체에 있다", () => {
    expect(API_ERROR_MESSAGES.FORBIDDEN).not.toContain("다시 시도");
    expect(API_ERROR_MESSAGES.FORBIDDEN).not.toContain("잠시 후");
    // 종전 갈래(UX-N의 그 문장)는 반대다 — 그 문장이 이 403에도 서던 것이 결함이었다.
    expect(source("src/offline/messages.ts")).toContain(
      'export const LOAD_ERROR_NOTICE = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";'
    );
  });

  it("버튼도 재시도가 아니라 **나가는 길**이다 — replace로 탭 셸에 선다", () => {
    const code = maskComments(source(FAMILY_SCREEN));
    // 갈래는 **카드 하나**에 걸린다(프롭마다 삼항을 걸지 않는다 — 화면 주석 ①).
    expect(code).toContain("{forbiddenTitle ? (");
    // 403 카드는 삼항의 **참 가지**다 — 경계는 `) : (`이고 길이를 손으로 적지 않는다.
    const forbiddenCard = sliceBetween(code, "{forbiddenTitle ? (", ") : (");
    expect(forbiddenCard).toContain("title={forbiddenTitle}");
    expect(forbiddenCard).toContain("actionLabel={FAMILY_FORBIDDEN_EXIT_LABEL}");
    expect(forbiddenCard).toContain('onPress={() => router.replace("/(tabs)")}');
    // 그 카드에는 재시도가 없다 — [다시 시도]는 거짓 가지(종전 카드)에만 남는다.
    expect(forbiddenCard).not.toContain("members.refetch()");
    expect(forbiddenCard).not.toContain("loadErrorCopy");
  });

  it("⚠️ 그 꼴이 소유 밖 계약 셋의 바이트를 그대로 남긴다 (`??` 꼴을 고르지 않은 이유)", () => {
    /**
     * 이 트랙이 고른 값이 아니라 **다른 계약 셋이 이미 붙들고 있던 바이트**다. `??` 꼴
     * (라운드 108-T18이 준비템 상세에서 고른 그것)을 쓰면 셋이 함께 빨개진다 — 오늘 그 화면에서
     * 실제로 둘이 빨간 채로 있고, 이 단언 셋은 그 일이 이 화면에서 되풀이되지 않게 문다.
     */
    for (const contract of [
      "src/screen-phase.test.ts",
      "src/loading-skeleton-contract.test.ts",
      "src/family/member-mutation-messages.test.ts"
    ]) {
      expect(source(contract), `${contract}가 그 바이트를 문다`).toContain('toContain("title={loadErrorCopy.title}")');
    }
    const code = maskComments(source(FAMILY_SCREEN));
    expect(code).toContain("title={loadErrorCopy.title}");
    expect(code).toContain("actionLabel={loadErrorCopy.actionLabel}");
  });

  it("목적지도 라벨도 새로 짓지 않았다 — 같은 도메인의 같은 403이 이미 고른 값들이다", () => {
    // 목적지: 라운드 60 리뷰 P1-2가 *"403 무한 재시도"* 를 고치며 고른 그 탭 셸.
    expect(source("src/children/household-join.ts")).toContain(
      'return { kind: "blocked", notice: HOUSEHOLD_JOIN_VIEWER_NOTICE, href: "/(tabs)" };'
    );
    // 라벨: 같은 성격의 막다른 길(끝난 초대)이 쓰는 그 문자열과 **값이 같다**.
    expect(maskComments(source(FAMILY_SCREEN))).toContain('const FAMILY_FORBIDDEN_EXIT_LABEL = "앱 둘러보기";');
    expect(INVITE_UNAVAILABLE_ESCAPE_LABEL).toBe("앱 둘러보기");
    // 새 export const를 만들지 않는다(앱 소스 공통 금지 — 화면 지역 상수다).
    expect(maskComments(source(FAMILY_SCREEN))).not.toContain("export const FAMILY_FORBIDDEN_EXIT_LABEL");
  });

  it("⚠️ 관측 — 이 갈래의 카드는 ErrorState로 선다(공용 컴포넌트가 제목으로 고른다)", () => {
    /**
     * 이 라운드가 고른 것이 아니라 **공용 컴포넌트가 제목으로 고르는** 사실이다. 표의 그 문장에는
     * "못했"이 있으므로 종전 갈래와 **같은 시각 문법**으로 선다 — 라운드 108-T18의 그 자리와는
     * 반대인데(그 문장에는 셋 다 없어 EmptyState로 섰다), 여기서는 실제로 무언가에 실패한 것이
     * 맞으므로 그 편이 사실에 가깝다. 이 단언은 그 사실을 값으로 붙든다.
     */
    expect(source("src/design-system/components/ApplicationPrimitives.tsx")).toContain(
      "if (/못했|실패|오류/.test(title)) return <ErrorState actionLabel={onPress ? actionLabel : undefined} onAction={onPress} title={title} />;"
    );
    expect(API_ERROR_MESSAGES.FORBIDDEN).toMatch(/못했|실패|오류/);
  });
});

describe("라운드 111 ⓒ 코드가 없는 실패는 종전 그대로다", () => {
  it("두 값 모두 forbiddenTitle이 null이면 종전으로 떨어진다 (UX-N의 그 훅 그대로)", () => {
    const code = maskComments(source(FAMILY_SCREEN));
    // 종전 카드의 세 프롭이 한 글자도 바뀌지 않았다.
    expect(code).toContain("title={loadErrorCopy.title}");
    expect(code).toContain("actionLabel={loadErrorCopy.actionLabel}");
    expect(code).toContain("onPress={() => members.refetch()}");
    expect(code).toContain("const loadErrorCopy = useLoadErrorCopy(members.isError);");
  });

  it("공용 훅은 넓히지 않았다 — 넓히면 이 막다른 길이 없는 열다섯 자리가 함께 바뀐다", () => {
    expect(source("src/offline/use-load-error-copy.ts")).toContain(
      "export function useLoadErrorCopy(isError: boolean): LoadErrorCopy {"
    );
    // 이 화면의 폴은 여전히 하나다(둘째 훅 금지 — offline/messages.test.ts가 같은 수를 문다).
    expect((maskComments(source(FAMILY_SCREEN)).match(/useLoadErrorCopy\(/g) ?? []).length).toBe(1);
    // 대기 초대 줄의 온라인 갈래 문장도 바이트 불변이다(라운드 72 트랙 B).
    expect(source(FAMILY_SCREEN)).toContain(
      'const FAMILY_PENDING_INVITE_LOAD_ERROR_TEXT = "대기 중인 초대를 불러오지 못했어요. 눌러서 다시 시도해 주세요.";'
    );
  });
});

describe("라운드 111 ⓓ FAM-001 픽셀락 캡처는 이 갈래를 지나지 않는다", () => {
  it("캡처 대상에 FAM-001이 실제로 있고, 그 캡처는 세션을 지운 프리뷰 렌더다", () => {
    const pixelLockScreens = JSON.parse(source("../../scripts/pixel-lock/pixel-lock-screens.json")) as Record<
      string,
      { route: string }
    >;
    expect(Object.keys(pixelLockScreens)).toContain("FAM-001");
    expect(pixelLockScreens["FAM-001"].route).toBe("wooriai:///pixel-lock?screen=FAM-001");
    expect(source("app/pixel-lock.tsx")).toContain('"FAM-001": "/family"');
    expect(source("app/pixel-lock.tsx")).toContain("clearSession();");
    // 두 갈래 모두 `hasSession` 뒤에 선다 — 비세션 캡처는 오류 카드에도 스켈레톤에도 닿지 않는다.
    const code = maskComments(source(FAMILY_SCREEN));
    expect(code).toContain('if (hasSession && membersPhase === "error") {');
    expect(code).toContain('if (householdScopePending || (hasSession && membersPhase === "loading")) {');
    // 캡처가 지나는 정상 렌더의 기준 프레임은 종전 그대로다(이 갈래에는 그 testID가 없다).
    expect(code).toContain("<View testID={familyReferenceScreenId} style={familyReferenceFrameStyle()}>");
    expect((code.match(/testID=\{familyReferenceScreenId\}/g) ?? []).length).toBe(1);
  });
});
