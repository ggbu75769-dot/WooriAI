import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VIEW_ONLY_HEADLINES } from "../family/record-permissions";
import { OFFLINE_AWARE_SAVE_ERROR_SCREENS } from "../offline/offline-aware-screens";
import { SHARED_KEY_COVERAGE } from "../query/shared-cache-policy";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const screenSource = () => source("app/settings/categories.tsx");
const settingsSource = () => source("app/settings/index.tsx");

/**
 * 라운드 103 T3 — **지출 분류 관리 화면의 배선 계약**
 * (설계 문서 docs/5차/round103-custom-expense-category-design.md §4.1 · §4.2 · §6.4).
 *
 * 판정·문구는 순수 모듈(./custom-category-form.ts — 옆 테스트가 지킨다)에 있고, 여기서 보는
 * 것은 그 모듈이 화면에 **연결돼 있는가**와, 이 화면이 저장소의 전역 규약 넷
 * (`["categories"]` includeAll · 역할 게이트 · 연타 가드 · 무효화 한 키)을 실제로 지나는가다.
 *
 * 화면은 이 repo의 vitest에서 렌더할 수 없으므로 소스 grep 관례를 따른다
 * (src/items/custom-item-wiring.test.ts · src/expenses/amount-presets-wiring.test.ts).
 *
 * ⚠️ **자르는 구간은 전부 양쪽 끝 실재 확인을 먼저 지난다**(라운드 78 규칙 —
 * source-contract-slice-guard): 시작 표식이 -1이면 구간이 빈 문자열이 되고, 빈 문자열 위에서는
 * 어떤 부정 단언도 **영원히 초록**이다.
 */

/**
 * 주석을 걷어 낸 소스 — 화면이 **하는 것**만 본다(record-permissions.test.ts·invite-flow.test.ts가
 * 같은 이유로 갖고 있는 그 헬퍼다). 이 저장소는 설계 근거를 주석에 길게 남기는 관례라, 아래
 * 부정 단언들이 원본을 보면 *"이 화면은 isSystem으로 가르지 않는다"* 라고 **설명한 문장** 때문에
 * 빨개진다 — 잡으려는 것은 배선이지 설명이 아니다.
 */
const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** 양쪽 끝 실재 확인을 값으로 지나는 구간 자르기 — 이 파일의 모든 slice가 이 함수를 지난다. */
function guardedSlice(text: string, startNeedle: string, endNeedle: string, label: string): string {
  const start = text.indexOf(startNeedle);
  expect(start, `${label}: 시작 표식 "${startNeedle}"이 소스에 없다`).toBeGreaterThan(-1);
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  expect(end, `${label}: 끝 표식 "${endNeedle}"이 시작 뒤에 없다`).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("§4.1 캐시 — [\"categories\"]를 includeAll로 채우고, 그 키 하나만 비운다", () => {
  it("이 화면이 전역 단일 키를 **includeAll: true**로 채운다 (보관 행을 그려야 한다)", () => {
    const screen = screenSource();
    const query = guardedSlice(screen, "const categories = useQuery({", "});", "categories 쿼리");
    expect(query).toContain('queryKey: ["categories"]');
    expect(query).toContain("listCategories(authToken!, { includeAll: true })");
    // 전역 규약의 신선도도 그대로다(shared-cache-policy의 그 키 기본과 같은 값).
    expect(query).toContain("staleTime: 5 * 60 * 1000");
    // 기본(활성·selectable) 목록으로 채우는 갈래가 없다 — 그러면 보관 구획이 영원히 비고,
    // 다른 소비처의 별칭 라벨이 조용히 "기타"로 무너진다(categories-cache-contract의 그 규약).
    expect(screen).not.toContain("listCategories(authToken!)");
  });

  it("성공 무효화는 [\"categories\"] 한 키뿐이다 — 추가 키 0건", () => {
    const screen = screenSource();
    const invalidations = screen.match(/invalidateQueries\(\{ queryKey: \["([a-z-]+)"\] \}\)/g) ?? [];
    expect(invalidations.length, "무효화 자리 셋(추가·이름 바꾸기·보관)").toBe(3);
    for (const line of invalidations) expect(line).toContain('["categories"]');
    // 다른 키를 곁들여 비우는 자리가 한 곳도 없다(지출도 리포트도 값이 바뀌지 않는다).
    for (const key of ["expenses", "report", "home", "budget", "children", "items"]) {
      expect(screen, `["${key}"] 무효화가 끼어들었다`).not.toContain(`invalidateQueries({ queryKey: ["${key}"] })`);
    }
    // 그리고 그 사실이 무효화 대장에도 값으로 서 있다(두 방향).
    const coverage = SHARED_KEY_COVERAGE.find((row) => row.queryKeyPrefix[0] === "categories");
    expect(coverage, "무효화 대장에 categories 줄이 없다").toBeDefined();
    expect(coverage!.hasNoAppWrites, "이제 앱 안 쓰기가 있다").toBe(false);
    expect(coverage!.writes.map((write) => write.mutation).sort()).toEqual(["archive", "create", "rename"]);
    for (const write of coverage!.writes) {
      expect(write.writeSite).toBe("app/settings/categories.tsx");
      expect(write.invalidatedKeyHeads).toEqual(["categories"]);
    }
  });
});

describe("§4.1 게이트 — useExpenseEntryGate를 지나고, 화면을 접지 않는다", () => {
  it("역할 게이트를 부르고, 머리말이 그 판정을 읽는다", () => {
    const screen = screenSource();
    expect(screen).toContain('from "../../src/family/useExpenseEntryGate"');
    expect(screen).toContain("const expenseGate = useExpenseEntryGate();");
    expect(screen).toContain("expenseGate.locked ? VIEW_ONLY_HEADLINES.categories : copy.subtitle");
    // 역할 문자열을 화면에서 직접 비교하지 않는다(판정은 순수 모듈 한 벌이다).
    expect(screen).not.toContain('"owner"');
    expect(screen).not.toContain('"co_parent"');
    expect(screen).not.toContain('"viewer"');
  });

  it("쓰기 셋이 전부 게이트를 지난다 — 우회하는 mutate 호출이 없다", () => {
    const screen = screenSource();
    for (const handler of ["submitDraft", "submitRename", "setActive", "confirmArchive"]) {
      expect(screen, `${handler}가 게이트를 지나지 않는다`).toContain(`= expenseGate.guard(`);
    }
    // 잠긴 세션에서 눌리는 자리는 전부 guard가 돌려준 핸들러다. 화면이 직접 부르는 mutate는
    // 그 핸들러 안(그리고 Alert의 확인 갈래) 뿐이다.
    const directCalls = screen.match(/\b(create|rename|archive)\.mutate\(/g) ?? [];
    expect(directCalls.length, "mutate 호출 자리").toBe(4);
  });

  it("화면을 잠그지 않는다 — 조기 반환도, 판정으로 노드를 접는 갈래도 없다", () => {
    const screen = screenSource();
    expect(screen).not.toContain("if (expenseGate.locked) return null;");
    expect(screen).not.toContain("{expenseGate.locked &&");
    expect(screen).not.toContain("expenseGate.locked ? (");
    // 판정을 읽는 삼항은 머리말 하나뿐이다(라운드 71 E가 예산 화면에 세운 그 계약과 같은 모양).
    expect(screen.match(/expenseGate\.locked \?/g) ?? []).toHaveLength(1);
  });
});

describe("§6.4 연타 가드 — 뮤테이션 셋이 전부 disabled={…isPending}", () => {
  it("추가·저장 버튼이 자기 뮤테이션의 진행 중을 읽는다 (control-blocks)", () => {
    const screen = screenSource();
    expect(screen).toContain("disabled={!canWrite || addBlocked || create.isPending}");
    expect(screen).toContain("disabled={!canWrite || renameNotice !== null || rename.isPending}");
    expect(screen).toContain("disabled={rename.isPending}");
    expect(screen).toContain("disabled={archive.isPending}");
  });

  it("실패 문구는 자리마다 자기 뮤테이션을 묻는다 (`??` 체인 금지 — 라운드 70 M-2)", () => {
    const screen = screenSource();
    for (const [variable, mutation] of [
      ["createErrorFallback", "create"],
      ["renameErrorFallback", "rename"],
      ["archiveErrorFallback", "archive"]
    ] as const) {
      expect(screen).toContain(`const ${variable} = useSaveErrorCopy(${mutation}.isError, ${mutation}.error);`);
    }
    expect(screen.match(/useSaveErrorCopy\(/g) ?? []).toHaveLength(3);
    expect(screen).not.toContain("create.error ?? rename.error");
    // 그리고 이 화면이 저장 실패 대장에 등재돼 있다(app/** 스윕과 목록의 정확한 일치).
    expect(OFFLINE_AWARE_SAVE_ERROR_SCREENS).toContain("app/settings/categories.tsx");
  });
});

describe("§4.1 세션 갈래 — 토큰·가구를 모르면 쓰기가 서지 않는다", () => {
  it("데모(로컬) 토큰 갈래를 갖고, 가구는 보고 있는 아이에서 온다", () => {
    const screen = screenSource();
    expect(screen).toContain("const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);");
    expect(screen).toContain("isTestSession ? LOCAL_HOUSEHOLD_ID : null");
    // 세션 기본 가구를 그대로 쓰지 않는다 — 다른 가구 초대를 수락한 뒤 남의 가구에 분류가 생긴다.
    expect(screen).toContain("resolveManagedHouseholdId({");
    expect(screen).toContain("childrenSettled: isChildrenSettled({");
    // 두 조회 모두 세션이 없으면 아예 켜지지 않는다.
    expect(screen.match(/enabled: Boolean\(authToken\)/g) ?? []).toHaveLength(2);
  });

  it("가구를 아직 모르는 창에서는 쓰기 컨트롤이 잠긴다", () => {
    const screen = screenSource();
    expect(screen).toContain("const canWrite = Boolean(authToken && householdId);");
    expect(screen).toContain("disabled={!canWrite ||");
  });
});

describe("§4.1 목록 — 시드 행을 그리지 않고, 두 구획으로 갈린다", () => {
  it("모집단은 순수 모듈이 정한다 — 화면이 isSystem을 직접 보지 않는다", () => {
    const screen = withoutComments(screenSource());
    expect(screen).toContain("const mine = splitCustomCategories(rows, householdId);");
    /**
     * ⚠️ 이 부정 단언이 이 라운드의 함정을 잠근다: `is_system = false`인 **시드** 행이 아홉이라
     * (모바일 퀵타일 별칭 8 + 가져오기 스텁 1 — dev DB 실측) 화면이 그 칸을 직접 보고 걸렀다면
     * 사용자가 만들지도 않은 아홉 행이 목록에 서고 보관을 누르는 순간 404가 났을 것이다.
     * 판정은 소유자 칸을 보는 순수 모듈 하나이고, 그 사실은 옆 테스트가 별칭 픽스처로 문다.
     */
    expect(screen, "화면이 isSystem으로 커스텀을 가른다").not.toContain("isSystem");
    expect(screen, "화면이 커스텀 판별을 다시 짓는다").not.toContain("householdId ===");
  });

  it("두 구획(사용 중 / 보관한 분류)과 빈 상태가 모듈 문구로 그려진다", () => {
    const screen = screenSource();
    expect(screen).toContain("{copy.inUseSectionTitle}");
    expect(screen).toContain("{copy.archivedSectionTitle}");
    expect(screen).toContain("{copy.emptyStateText}");
    expect(screen).toContain("{copy.archivedFootnote}");
    expect(screen).toContain("mine.inUse.map(renderRow)");
    expect(screen).toContain("mine.archived.map(renderRow)");
    // 보관 구획은 보관한 행이 있을 때만 선다(빈 구획 제목을 세우지 않는다).
    expect(screen).toContain("{mine.archived.length > 0 ? (");
  });

  it("보관 확인 Alert가 모듈 문구 네 조각을 그대로 넘긴다 (화면이 문장을 짓지 않는다)", () => {
    const screen = screenSource();
    const alertBlock = guardedSlice(
      screen,
      "const confirm = customCategoryArchiveConfirmCopy(name);",
      "});",
      "보관 확인 Alert"
    );
    expect(alertBlock).toContain("Alert.alert(confirm.title, confirm.message, [");
    expect(alertBlock).toContain("text: confirm.cancelLabel");
    expect(alertBlock).toContain("text: confirm.confirmLabel");
    expect(alertBlock).toContain("archive.mutate({ categoryId, active: false })");
  });

  it("⚠️ 화면 어디에도 \"삭제\"·DELETE가 없다 (§1.6 — 지우지 않는 조작이다)", () => {
    // ⚠️ 주석은 걷는다: 머리말이 *왜* 하드 삭제 경로가 없는지를 설명하며 그 낱말을 인용한다.
    const screen = withoutComments(screenSource());
    expect(screen).not.toContain("삭제");
    expect(screen).not.toContain("deleteCustomCategory");
    expect(screen).not.toContain('method: "DELETE"');
    // 잠금 머리말도 그 낱말을 쓰지 않는다(표의 문장이 이 화면의 것이기도 하다).
    expect(VIEW_ONLY_HEADLINES.categories).not.toContain("삭제");
  });

  it("a11y: 선택 상태를 라벨에 적지 않고, 오류만 낭독 영역으로 올린다", () => {
    // ⚠️ 주석은 걷는다 — 낭독 배선의 머리말이 *왜* 프롭 쌍만으로는 iOS에서 침묵인지를 설명하며
    // 그 프롭 이름을 인용한다(세는 것은 배선이지 설명이 아니다).
    const screen = withoutComments(screenSource());
    expect(screen).toContain("accessibilityLabel={customCategoryRowAccessibilityLabel(row.name)}");
    expect(screen).toContain("accessibilityLabel={customCategoryArchiveAccessibilityLabel(row.name)}");
    expect(screen).toContain("accessibilityLabel={customCategoryRestoreAccessibilityLabel(row.name)}");
    // 선택 상태를 라벨 문자열에 이어 붙이지 않는다(그 사실은 accessibilityState의 몫이다).
    expect(screen).not.toContain('". 선택됨"');
    // 저장을 잠그는 오류는 danger 토큰 + polite 낭독이다(라운드 102 §9.6의 그 갈래 규율).
    expect(screen.match(/accessibilityLiveRegion="polite"/g) ?? []).toHaveLength(5);
    expect(screen).toContain("color: theme.colors.danger");
    // 프롭 쌍만으로는 iOS가 침묵한다 — 크로스플랫폼의 답(announceForA11y)이 저장 실패 셋에 걸린다.
    expect(screen.match(/announceForA11y\(/g) ?? []).toHaveLength(3);
  });
});

describe("§4.2 진입점 — 설정의 '지출 분류 관리' 행 하나", () => {
  it("금액 프리셋 행 바로 아래에 서고, /settings/categories로 간다", () => {
    const settings = settingsSource();
    const presets = settings.indexOf('router.push("/settings/amount-presets")');
    const categories = settings.indexOf('router.push("/settings/categories")');
    expect(presets, "금액 프리셋 행").toBeGreaterThan(-1);
    expect(categories, "지출 분류 관리 행").toBeGreaterThan(presets);
    const between = guardedSlice(
      settings,
      'router.push("/settings/amount-presets")',
      'router.push("/settings/categories")',
      "두 행 사이"
    );
    // 그 사이에 다른 행이 끼지 않는다(= 바로 아래다).
    expect(between.match(/<ListRow/g) ?? [], "두 행 사이에 낀 다른 행").toHaveLength(1);
    expect(settings).toContain('title="지출 분류 관리"');
    expect(settings).toContain('subtitle="직접 만든 분류를 더하고, 이름을 바꾸고, 보관해요."');
  });

  it("입구는 하나뿐이다 — 지출 수정 화면의 칩 행 바로가기는 v1.1 이월이다 (§4.2)", () => {
    expect(source("app/expenses/[expenseId].tsx")).not.toContain("/settings/categories");
    expect(source("app/expenses/new.tsx")).not.toContain("/settings/categories");
  });
});
