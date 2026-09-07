import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES } from "../api/api-error";

/**
 * 라운드 109(라운드 108-T18 이월) — **내려간 준비템 앞의 막다른 길을 닫는다.**
 *
 * ## 무엇이 막다른 길이었나 (T18의 실측을 오늘 소스에서 다시 확인했다)
 *
 * `purchase_pending` 알림은 준비템 상세로 곧장 보낸다. 그런데 그 준비템이 카탈로그에서
 * 내려갔거나(비활성) 커스텀 품목이 지워졌으면 `GET /items/:id`가 404 `ITEM_NOT_FOUND`를 준다
 * (`apps/api/src/onboarding/items-catalog.service.ts`의 `requireItemTemplate` ·
 * `requireItemTemplateOrCustom` — 소프트 삭제된 커스텀 id도 두 표 어디에도 없어 같은 404다).
 * 그때 화면은 `EmptyStateCard` 하나만 그렸고 그 카드의 유일한 행동이 **[다시 시도]** 였다:
 *  · 이 화면에는 OS 헤더가 없다(전역 `headerShown:false`). 상세 본문의 떠 있는 뒤로가기
 *    (`ProductDetailNavigation`)는 **정상 갈래에만** 서므로 오류 카드 화면에는 문이 없다.
 *  · [다시 시도]는 같은 요청을 다시 내므로 **영원히 같은 404**로 되돌아온다.
 * 즉 알림을 눌러 들어온 사람은 하드웨어 뒤로가기를 아는 경우에만 우연히 빠져나갔다.
 *
 * ## 이 계약이 무는 것
 *
 * ⓐ 문장은 **표에서 온다** — 새 한국어 문장 0건(`src/api/api-error.ts`가 이 코드의 단일 소스다).
 * ⓑ 라벨도 저장소에 이미 있던 문자열이고, 두 자리가 갈리면 여기가 빨개진다.
 * ⓒ 갈래는 그 코드일 때만 선다 — 코드가 없는 실패(네트워크·5xx·오프라인)의 문구·행동은
 *    **한 글자도** 바뀌지 않는다(UX-N의 그 두 문장 그대로).
 * ⓓ ITEM-002 픽셀락 캡처는 이 갈래를 지나지 않는다(캡처는 세션을 지운 프리뷰 렌더다).
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const ITEM_DETAIL = "app/items/[itemTemplateId].tsx";

/** 주석을 지우되 자리는 그대로 둔다(이 저장소의 소스 대조 계약이 쓰는 그 함수). */
function maskComments(sourceText: string): string {
  return sourceText
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_all, prefix: string, line: string) => prefix + line.replace(/./g, " "));
}

describe("ITEM_NOT_FOUND 막다른 길 — 문장과 나가는 길 (라운드 108-T18 이월)", () => {
  it("ⓐ 문장은 표의 그 한 줄이다 — 화면이 새 문구를 짓지 않는다", () => {
    // 기대값은 리터럴이다(표를 다시 불러 만든 값과 비교하지 않는다).
    expect(API_ERROR_MESSAGES.ITEM_NOT_FOUND).toBe(
      "준비템을 찾을 수 없어요. 목록에서 내려갔을 수 있으니 준비템 탭에서 확인해 주세요."
    );
    // 화면에는 그 문장의 사본이 없다(주석을 지운 코드에서 확인한다).
    expect(maskComments(source(ITEM_DETAIL))).not.toContain("목록에서 내려갔을 수 있으니");
  });

  it("ⓐ 화면은 그 코드일 때만 표를 지난다 (코드 → 오프라인 → 일반 순서)", () => {
    const code = maskComments(source(ITEM_DETAIL));
    expect(code).toContain(
      'apiErrorCodeOf(detail.error) === "ITEM_NOT_FOUND" ? apiErrorMessageForCode("ITEM_NOT_FOUND") : null;'
    );
    // 판정은 api-error의 공용 함수 한 벌을 지난다 — 화면이 오류 봉투를 다시 파싱하지 않는다.
    expect(code).not.toContain("error?.body?.code");
    /**
     * ⚠️ **왜 `hasApiErrorCode`가 아닌가 — 소유 밖 바이트 핀.** 그 술어를 쓰려면 import 줄에
     * 이름을 하나 더해야 하는데, 그 줄은 `src/api/api-error.test.ts`(소유 밖)가 바이트로 붙든다.
     * 두 줄이 함께 서 있어야 이 선택이 산문이 아니라 **자기 무효화되는 값**이 된다 — 핀이 모양으로
     * 풀리는 날 아래가 먼저 빨개져, 그때 더 읽기 좋은 술어로 되돌릴 수 있다.
     */
    expect(source(ITEM_DETAIL)).toContain(
      'import { apiErrorCodeOf, apiErrorMessageForCode } from "../../src/api/api-error";'
    );
    expect(source("src/api/api-error.test.ts")).toContain(
      '\'import { apiErrorCodeOf, apiErrorMessageForCode } from "../../src/api/api-error";\''
    );
  });

  it("ⓑ 나가는 길의 라벨은 준비템 탭이 이미 쓰는 그 문자열이다 (새 한국어 문장 0건)", () => {
    expect(maskComments(source(ITEM_DETAIL))).toContain('const MISSING_ITEM_EXIT_LABEL = "준비템 목록 보기";');
    // 사본이 갈리면 여기가 빨개진다(그쪽은 화면 지역 리터럴이라 읽을 이름이 없다).
    expect(source("app/(tabs)/items.tsx")).toContain('actionLabel="준비템 목록 보기"');
    // 새 export const를 만들지 않는다(공통 금지 — 화면 지역 상수다).
    expect(maskComments(source(ITEM_DETAIL))).not.toContain("export const MISSING_ITEM_EXIT_LABEL");
  });

  it("ⓑ 그 길은 되돌아가기가 아니라 나가기다 — replace로 준비템 탭에 선다", () => {
    const code = maskComments(source(ITEM_DETAIL));
    expect(code).toContain(
      'onPress={() => (missingItemTitle ? router.replace("/(tabs)/items") : detail.refetch())}'
    );
    // 목적지 문자열은 이 파일이 이미 쓰던 그것이다(준비 완료 뒤 복귀 경로 — 새 라우트 0건).
    expect((code.match(/router\.replace\("\/\(tabs\)\/items"\)/g) ?? []).length).toBe(2);
  });

  it("ⓒ 코드가 없는 실패는 종전 그대로다 — 문구도 [다시 시도]도 한 글자도 바뀌지 않는다", () => {
    const code = maskComments(source(ITEM_DETAIL));
    // 두 값 모두 `missingItemTitle`이 null이면 종전 값으로 떨어진다(UX-N의 그 훅 그대로).
    expect(code).toContain("title={missingItemTitle ?? loadErrorCopy.title}");
    expect(code).toContain("actionLabel={missingItemTitle ? MISSING_ITEM_EXIT_LABEL : loadErrorCopy.actionLabel}");
    expect(code).toContain("const loadErrorCopy = useLoadErrorCopy(detail.isError);");
    // 공용 훅의 시그니처는 넓히지 않았다 — 넓히면 이 막다른 길이 없는 열한 자리가 함께 바뀐다.
    expect(source("src/offline/use-load-error-copy.ts")).toContain(
      "export function useLoadErrorCopy(isError: boolean): LoadErrorCopy {"
    );
  });

  it("⚠️ 관측 — 이 갈래의 카드는 ErrorState가 아니라 EmptyState로 선다 (공용 컴포넌트의 제목 라우팅)", () => {
    /**
     * 이 라운드가 고른 것이 아니라 **공용 컴포넌트가 제목으로 고르는** 사실이다:
     * `EmptyStateCard`는 제목에 못했·실패·오류가 있으면 `ErrorState`를, 없으면 `EmptyState`를
     * 그린다. 표의 그 문장에는 셋 다 없으므로 이 갈래만 중립 빈 상태로 선다 — 값 자체는 그럴듯하다
     * (아무것도 실패하지 않았고, 그 준비템이 없어졌을 뿐이다. DNC-018의 담담한 어투와도 맞는다).
     * 둘 다 `onPress`가 있으면 행동 버튼을 그리므로 나가는 길은 어느 쪽이든 선다.
     * 이 단언은 그 사실을 **값으로** 붙든다 — 그 정규식이 바뀌는 날 여기가 빨개져 다시 보게 한다.
     */
    const primitives = source("src/design-system/components/ApplicationPrimitives.tsx");
    expect(primitives).toContain(
      "if (/못했|실패|오류/.test(title)) return <ErrorState actionLabel={onPress ? actionLabel : undefined} onAction={onPress} title={title} />;"
    );
    expect(API_ERROR_MESSAGES.ITEM_NOT_FOUND).not.toMatch(/못했|실패|오류/);
    // 종전 갈래(UX-N의 두 문장)는 반대다 — 그쪽은 계속 ErrorState로 선다(한 글자도 바뀌지 않았다).
    expect(source("src/offline/messages.ts")).toContain(
      'export const LOAD_ERROR_NOTICE = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";'
    );
  });

  it("ⓓ ITEM-002 픽셀락 캡처는 이 갈래를 지나지 않는다 (캡처 경로 불변)", () => {
    // 캡처 대상 목록에 ITEM-002가 실제로 있다(이 단언이 유령이 아니다).
    const pixelLockScreens = JSON.parse(source("../../scripts/pixel-lock/pixel-lock-screens.json")) as Record<
      string,
      { route: string }
    >;
    expect(Object.keys(pixelLockScreens)).toContain("ITEM-002");
    expect(pixelLockScreens["ITEM-002"].route).toBe("wooriai:///pixel-lock?screen=ITEM-002");
    // 그런데 그 캡처는 **세션을 지운 프리뷰 렌더**이고,
    expect(source("app/pixel-lock.tsx")).toContain("clearSession();");
    expect(source("app/pixel-lock.tsx")).toContain('"ITEM-002": "/items/preview-diaper-party-pack"');
    // 이 갈래는 세션 뒤에 선다 — 비세션은 오류 카드 자체에 닿지 않는다.
    expect(maskComments(source(ITEM_DETAIL))).toContain('if (hasSession && detailPhase === "error") {');
  });
});
