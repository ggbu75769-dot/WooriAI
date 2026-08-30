import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 82 트랙 D(GAP-082 #4) — **`/home` 응답을 누가 기다리는가**의 대장.
 *
 * ## 왜 이 파일이 생겼나
 *
 * `GET /home`은 이 앱에서 가장 무거운 읽기다: `requireChildAccess` + 병렬 다섯(예산 · 이번 달
 * 합계 · 전 기간 합계 · 최근 3건 · 추천 셋)이고, 그 마지막 하나가 **활성 카탈로그 전량 + 그
 * 아이의 상태 행 전량**을 읽어 셋으로 자른다(apps/api/src/onboarding/items-catalog.service.ts).
 *
 * 그런데 라운드 81까지 그 응답을 구독하는 화면이 **셋**이었고, 뒤의 둘(리포트 · 더보기)은 그
 * 응답에서 `child` 밖의 필드를 **하나도** 읽지 않았다. 게다가 그 `child`는 두 화면이 이미
 * 켜 둔 `["children"]` 행의 **진부분집합**이다 — 서버가 두 응답의 아이를 같은 함수로 만들기
 * 때문이다(apps/api/src/onboarding/store-shared.ts의 `toChildDto`. `HomeSummary.child`는 그
 * 넷만 추린 것이고 `Child`는 `householdId`·`stageMode`·`dueDate`·`birthDate`·`manualStage`를
 * 더 갖는다 — src/api/client.ts).
 *
 * 그 어긋남은 성능보다 **정직성** 쪽이 컸다. 다자녀 가구에서 리포트 탭 제목은 `["children"]`이
 * 그린 "다온이 — 리포트"인데, `/home`이 아직 안 왔거나 실패하면 같은 화면이 내보내는 공유
 * 문장은 "우리 아이"였다. 더보기에서는 눈에 보였다 — 가구 카드가 `["children"]`으로 "보호자
 * 2명 · 아이 2명"을 이미 그리는 프레임에서 바로 위 프로필 카드만 "..."였다.
 *
 * 라운드 82 A(리포트) · D(더보기)가 두 화면의 원천을 `["children"]` 하나로 합쳤다. 이 파일은
 * **그 상태가 유지되는지**를 소스 스윕으로 붙든다(react-native 화면은 vitest에서 렌더할 수
 * 없으므로 offline/messages.test.ts · refresh-wiring-contract.test.ts와 같은 그렙 관례다).
 *
 * ## 두 방향 (라운드 73 E · 74 D가 오프라인 문구에서 세운 그 모양)
 *
 *  1. **구독 방향** — `app/**`에서 `getHome(`을 부르거나 `["home", ...]`을 쿼리 키로 켜는 화면
 *     집합이 `HOME_PAYLOAD_SUBSCRIBER_SCREENS`와 **정확히 일치**할 것. 오늘 그 목록은 홈 하나다.
 *  2. **접촉 방향** — 그 키를 구독하지 않으면서 만지기만 하는 자리(무효화 · 캐시 읽기 · 주석)는
 *     `HOME_CACHE_NON_SUBSCRIBER_SCREENS`에 **이유와 함께** 이름이 있을 것. 한 방향만 있으면
 *     새 화면이 변수명을 달리해 구독을 되살려도 두 목록이 일치한 채 통과한다(라운드 74 D가
 *     "훅을 아예 부르지 않는 화면"에서 겪은 그 사각이다).
 *
 * ⚠️ **이 대장은 홈을 읽기만 한다.** 홈이 그 응답을 구독하는 것은 정상이고, 홈의 첫 페인트
 * 구성 계약은 src/home/home-cold-start-defer.test.ts가 이미 진다 — 이 파일은 그 계약의
 * 모집단(오늘 화면 하나)이 **왜 하나인지**를 화면별 구성으로 적어 둘 뿐이다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** `app/**`의 화면 파일 전수(모바일 루트 기준 POSIX 상대 경로). */
function appScreenPaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      found.push(relative(mobileRoot, fullPath).split(sep).join("/"));
    }
  };
  walk(join(mobileRoot, "app"));
  return found.sort();
}

/**
 * 구독의 두 얼굴: 응답을 직접 부르거나(`getHome(`), 그 키로 `useQuery`를 켜거나.
 *
 * ⚠️ **무효화는 구독이 아니다** — `invalidateQueries({ queryKey: ["home"] })`는 여러 화면이
 * 저장 뒤에 부르는데, 비활성 쿼리는 무효화돼도 요청이 되지 않는다. 그래서 문자열 하나로
 * 세지 않고 `useQuery` 선언을 실제로 파싱해서 그 키가 `["home"`로 시작하는지 본다
 * (파서는 아래 `parseQueries` — 첫 페인트 대장이 쓰는 것과 **같은 한 벌**이다).
 */
const isHomeSubscriber = (src: string) =>
  src.includes("getHome(") || parseQueries(src).some((query) => query.key.startsWith('["home"'));

/**
 * 구독이 아닌 접촉의 세 얼굴: 주석 · 무효화(`invalidateQueries`) · 캐시 읽기(`getQueryData`).
 * 제외 목록의 화면에서 그 키가 나오는 **모든 줄**이 셋 중 하나여야 한다 — 이유를 적어 놓고
 * 네 번째 얼굴(예: `useQueries`·수동 `fetchQuery`)이 조용히 들어오는 것을 막는다.
 */
function homeKeyLines(src: string): string[] {
  return src.split("\n").filter((line) => line.includes('["home"'));
}

function isNonSubscribingHomeKeyLine(line: string): boolean {
  const trimmed = line.trim();
  const isComment = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
  return isComment || trimmed.includes("invalidateQueries") || trimmed.includes("getQueryData");
}

/**
 * `/home` 응답을 구독해도 되는 화면. **오늘 하나다.**
 *
 * 다시 늘어나는 것 자체는 금지가 아니다 — 늘리려면 여기에 이름과 **이유**가 함께 들어와야 하고,
 * 그 이유는 "그 응답의 `child` 밖 필드를 읽는다"여야 한다. `child` 네 칸만 필요하다면 그것은
 * 이미 켜 둔 `["children"]`의 진부분집합이라 새 구독의 근거가 되지 못한다.
 */
const HOME_PAYLOAD_SUBSCRIBER_SCREENS: Readonly<Record<string, string>> = {
  "app/(tabs)/index.tsx":
    "홈 히어로 카드 · 예산 진행바 · 최근 기록 3건 · 추천 준비템 셋이 전부 이 응답의 child 밖 필드다(totalExpenseKrw · monthly · recentExpenses · recommendedItems). 이 화면이 그 응답의 유일한 소비자이고, 첫 페인트 구성 계약은 src/home/home-cold-start-defer.test.ts가 진다."
};

/**
 * 구독하지 않으면서 `["home"` 문자열을 갖는 자리와 그 이유.
 *
 * ⚠️ 무효화(`invalidateQueries`)는 구독이 아니다 — 비활성 쿼리는 무효화돼도 다시 불려 가지
 * 않는다(라운드 82 이전 items.tsx가 그 사실을 자기 주석에 적어 두고 있다). 캐시 **읽기**
 * (`getQueryData`)도 구독이 아니다: 쿼리를 활성화하지 않으므로 요청을 만들지 않고, 캐시가
 * 없으면 그 자리를 아예 그리지 않는다(app/budget.tsx의 규율).
 */
const HOME_CACHE_NON_SUBSCRIBER_SCREENS: Readonly<Record<string, string>> = {
  "app/(tabs)/items.tsx":
    "준비 상태를 바꾼 뒤 홈의 준비율이 낡지 않도록 무효화만 한다. 이 화면은 그 응답을 읽지 않으므로 쿼리는 비활성이고, 무효화는 다음 홈 마운트 때 갱신을 예약할 뿐 요청을 만들지 않는다.",
  "app/(tabs)/more.tsx":
    "라운드 82 D가 구독을 없앴다 — 프로필 카드의 이름·단계가 ['children'] 한 행에서 온다. 남은 것은 그 사실을 적은 주석과 이 대장을 가리키는 줄뿐이다(요청 0건).",
  "app/(tabs)/reports.tsx":
    "라운드 82 A가 구독을 없앴다 — 공유 문구의 태명이 ['children']의 selectedChild에서 온다. 남은 것은 그 사실과 무효화 목록에서 이 키를 뺀 이유를 적은 주석뿐이다(요청 0건).",
  "app/budget.tsx":
    "예산 미설정이라 budget 응답에 사용액이 없을 때만 getQueryData로 홈 캐시의 monthly.usedAmountKrw를 폴백으로 읽고, 저장 뒤에는 홈 카드가 낡지 않도록 무효화한다. 읽기는 쿼리를 켜지 않으므로(캐시가 없으면 undefined) 이 화면의 요청 수는 그대로다.",
  "app/expenses/new.tsx":
    "지출을 저장한 뒤 홈의 총액·예산·최근 기록이 낡지 않도록 무효화만 한다(핵심 루프의 기록 → 총액 확인 구간). 이 화면은 그 응답을 읽지 않는다.",
  "app/import/[importJobId].tsx":
    "가져오기 검수를 확정한 뒤 홈 집계가 낡지 않도록 무효화만 한다. 이 화면이 읽는 것은 잡·행 목록뿐이다.",
  "app/import/index.tsx":
    "가져오기를 마친 뒤 홈 집계가 낡지 않도록 무효화만 한다. 이 화면이 읽는 것은 업로드 결과뿐이다.",
  "app/settings/privacy.tsx":
    "아이 삭제·계정 삭제 뒤 캐시를 지우는 규칙을 적은 주석에서 이 키를 언급한다(지우는 목록 자체는 src/children/child-deletion.ts 한 벌이다). 이 화면은 그 응답을 읽지도 켜지도 않는다."
};

describe("라운드 82 D(#4) `/home` 응답 구독 대장", () => {
  it("ⓐ 구독 방향: 그 응답을 부르거나 켜는 app/** 화면은 대장의 목록과 정확히 같다", () => {
    const subscribers = appScreenPaths().filter((path) => isHomeSubscriber(source(path)));
    expect(subscribers).toEqual(Object.keys(HOME_PAYLOAD_SUBSCRIBER_SCREENS).sort());
    // 오늘의 값: 홈 하나다. 목록을 늘리려면 아래 사유 계약(이유가 값으로 남을 것)을 함께 지나야 한다.
    expect(subscribers).toHaveLength(1);
    for (const [path, reason] of Object.entries(HOME_PAYLOAD_SUBSCRIBER_SCREENS)) {
      expect(reason.length, `${path}의 구독 사유가 값으로 남아 있다`).toBeGreaterThan(30);
    }
  });

  it("ⓐ 접촉 방향: 구독하지 않으면서 그 키를 만지는 자리는 전부 이유와 함께 등재돼 있다", () => {
    const touching = appScreenPaths().filter((path) => {
      const src = source(path);
      return src.includes('["home"') && !isHomeSubscriber(src);
    });
    expect(touching).toEqual(Object.keys(HOME_CACHE_NON_SUBSCRIBER_SCREENS).sort());
    for (const [path, reason] of Object.entries(HOME_CACHE_NON_SUBSCRIBER_SCREENS)) {
      // 빈 문자열로 목록을 늘릴 수 없다(라운드 73 E의 제외 목록과 같은 규율).
      expect(reason.length, `${path}의 제외 사유가 값으로 남아 있다`).toBeGreaterThan(30);
      // 제외해 놓고 조용히 구독으로 돌아와 있지 않다(그 반대는 위 스윕이 본다).
      expect(isHomeSubscriber(source(path)), `${path}는 그 응답을 구독하지 않는다`).toBe(false);
      expect(Object.keys(HOME_PAYLOAD_SUBSCRIBER_SCREENS), `${path}는 구독 목록 밖이다`).not.toContain(path);
      // 접촉의 얼굴이 셋(주석 · 무효화 · 캐시 읽기) 중 하나가 아닌 줄이 없다.
      for (const line of homeKeyLines(source(path))) {
        expect(isNonSubscribingHomeKeyLine(line), `${path}: ${line.trim()}`).toBe(true);
      }
    }
  });

  it("ⓑ 아이의 이름·단계를 말하는 두 화면의 원천은 ['children'] 하나다", () => {
    const more = source("app/(tabs)/more.tsx");
    expect(more).toContain(
      "const selectedChild = childId ? children.data?.children.find((child) => child.id === childId) : undefined;"
    );
    expect(more).toContain("const visibleProfile = authToken ? (selectedChild ?? loadingProfile) : previewProfile;");
    expect(more).toContain("stageMode: selectedChild?.stageMode,");
    // 두 번째 원천이 다시 생기지 않는다 — 그 응답의 어떤 칸도 읽지 않는다.
    expect(more).not.toContain("home.data");

    // 리포트는 트랙 A의 자리다(이 트랙은 읽기만 한다) — 같은 규율이 서 있는지만 본다.
    const reports = source("app/(tabs)/reports.tsx");
    expect(reports).toContain('const shareChildName = selectedChild?.nickname ?? "우리 아이";');
    expect(reports).not.toContain("home.data");
  });
});

/**
 * 화면별 **첫 페인트 요청 구성** — 라운드 82 D 계약 ⓔ.
 *
 * 기준 프레임: 세션이 있고(`authToken`) 아이도 정해져 있으며(`childId`) 캐시가 비어 있는
 * 콜드 스타트의 **첫 렌더**. 그 프레임에서 `enabled`가 참인 쿼리만 요청이 된다.
 *
 * ⚠️ 수치는 손으로 적지 않는다: 아래 목록은 소스에서 뽑은 쿼리 이름 · 키 · `enabled` 식과
 * 대조되고(그래서 쿼리가 하나 늘면 이 파일이 먼저 빨개진다), 첫 페인트 수는 목록에서 **센다**.
 */
type FirstPaintQuery = {
  /** 화면 안의 변수명. */
  name: string;
  /** 소스에 적힌 쿼리 키 그대로. */
  key: string;
  /** 소스에 적힌 `enabled` 식 그대로. */
  enabled: string;
  /** 위 기준 프레임에서 이 쿼리가 요청이 되는가. */
  firesOnFirstPaint: boolean;
  /** 왜 그런가 — 게이트가 무엇인가. */
  reason: string;
};

const FIRST_PAINT_QUERY_LEDGER: Readonly<Record<string, readonly FirstPaintQuery[]>> = {
  "app/(tabs)/index.tsx": [
    {
      name: "home",
      key: '["home", childId]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "히어로 카드의 총액·예산·최근 기록·추천 셋이 전부 이 한 응답이다 — 이 화면의 첫 페인트가 곧 이 응답이다."
    },
    {
      name: "categoriesQuery",
      key: '["categories"]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "빠른 기록 칩이 카테고리 이름을 그린다. 기록 탭·지출 화면과 같은 키라 대개 이미 채워진 캐시를 읽는다."
    },
    {
      name: "thisMonthExpenses",
      key: '["expenses", childId, thisYearMonth]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "주간 카드가 첫 페인트에 쓰는 데이터라 미루지 않는다(UX-W C8 — home-cold-start-defer.test.ts가 이 자리를 붙든다)."
    },
    {
      name: "lastMonthExpenses",
      key: '["expenses", childId, lastYearMonth]',
      enabled: "Boolean(authToken && childId && lastYearMonth && thisMonthExpenses.isFetched)",
      firesOnFirstPaint: false,
      reason: "UX-W(C8)이 첫 페인트 뒤로 미룬 쿼리다 — 이번 달 조회가 끝나야 켜진다. 소비자 둘 다 '완전한 데이터일 때만 렌더'라 붙잡을 이유가 없다."
    },
    {
      name: "lastMonthBudget",
      key: '["budget", childId, lastYearMonth]',
      enabled: "Boolean(authToken && childId && lastYearMonth) && homeHasNoBudgetThisMonth",
      firesOnFirstPaint: false,
      reason: "이번 달 예산이 없다는 사실을 홈 응답에서 알아야 켜진다(homeHasNoBudgetThisMonth) — 첫 페인트에는 그 응답이 아직 없다."
    },
    {
      name: "childrenQuery",
      key: '["children"]',
      enabled: "Boolean(authToken)",
      firesOnFirstPaint: true,
      reason: "아이 전환 칩·헤더 라벨의 원천이고 아이가 정해지지 않은 창에서도 필요하다(게이트가 토큰 하나다)."
    }
  ],
  "app/(tabs)/reports.tsx": [
    {
      name: "monthly",
      key: '["report", "monthly", childId, reportYearMonth]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "이 탭의 기본 카드(이번 달 총액·예산 대비)라 게이트가 세션뿐이다."
    },
    {
      name: "previousMonth",
      key: '["report", "monthly", childId, previousMonthYearMonth]',
      enabled: 'Boolean(authToken && childId && period === "월간")',
      firesOnFirstPaint: true,
      reason: "기본 기간이 월간이라 첫 페인트에 함께 뜬다. 키가 월간 카드와 같아서([◀] 한 칸) 이동이 오늘의 즉시 렌더를 유지한다 — 트렌드 응답으로 대체하는 교환은 라운드 82 정찰이 재고 기각했다."
    },
    {
      name: "cumulative",
      key: '["report", "cumulative", childId]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "전 기간 누적 카드가 기간 칩과 무관하게 늘 서 있어서 게이트가 세션뿐이다(기간을 바꿔도 이 값은 같다)."
    },
    {
      name: "activeCategory",
      key: '["report", "category", childId, categoryPeriod]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "카테고리 카드가 첫 페인트에 서 있다(기간 칩이 바뀌면 키가 바뀐다)."
    },
    {
      name: "categories",
      key: '["categories"]',
      enabled: "Boolean(authToken)",
      firesOnFirstPaint: true,
      reason: "카테고리 이름·색을 그리는 목록이고 홈·기록 탭과 같은 키라 대개 캐시가 이미 따뜻하다."
    },
    {
      name: "quarterTrend",
      key: '["report", "trend", childId, quarterEndYearMonth, QUARTER_TREND_MONTHS]',
      enabled: 'Boolean(authToken && childId && period === "분기")',
      firesOnFirstPaint: false,
      reason: "분기 칩을 고른 뒤에만 켜진다 — 기본 기간이 월간이라 첫 페인트에는 없다."
    },
    {
      name: "yearly",
      key: '["report", "yearly", childId, yearStart.getFullYear()]',
      enabled: 'Boolean(authToken && childId && period === "연간")',
      firesOnFirstPaint: false,
      reason: "연간 칩을 고른 뒤에만 켜진다 — 같은 이유로 첫 페인트에는 없다."
    },
    {
      name: "childrenQuery",
      key: '["children"]',
      enabled: "Boolean(authToken)",
      firesOnFirstPaint: true,
      reason: "제목의 아이 라벨 · 마일스톤 타입(생년월일) · 공유 문구의 태명이 전부 이 한 행에서 온다(라운드 82 A가 합친 그 원천)."
    },
    {
      name: "milestone",
      key: '["report", "milestone", childId, milestoneType]',
      enabled: "Boolean(authToken && childId && childrenSettled)",
      firesOnFirstPaint: false,
      reason: "어떤 마일스톤인지는 생년월일이 정하므로 ['children']이 끝나야 켜진다(REP-127) — 첫 페인트 바로 다음 프레임이다."
    },
    {
      name: "monthlyTrend",
      key: '["report", "trend", childId, reportYearMonth, MONTHLY_TREND_MONTHS]',
      enabled: 'Boolean(authToken && childId && period === "월간")',
      firesOnFirstPaint: true,
      reason: "기본 기간이 월간이라 추이 카드가 첫 페인트에 함께 선다."
    }
  ],
  "app/(tabs)/more.tsx": [
    {
      name: "children",
      key: '["children"]',
      enabled: "Boolean(authToken)",
      firesOnFirstPaint: true,
      reason: "라운드 82 D 뒤 이 화면의 **유일한** 첫 페인트 요청이다 — 프로필 카드의 이름·단계, 가구 카드의 '아이 M명', 관리 대상 가구 판정이 전부 이 한 행에서 온다."
    },
    {
      name: "members",
      key: '["household-members", householdId]',
      enabled: "Boolean(authToken && householdId)",
      firesOnFirstPaint: false,
      reason: "관리 대상 가구는 ['children']이 끝나야 정해진다(resolveManagedHouseholdId는 조회 중이면 null을 준다 — 다가구 계정에서 잠깐 다른 가구를 그리지 않으려는 규율). 그래서 첫 페인트 다음 프레임이다."
    }
  ]
};

/** 소스에서 쿼리 선언을 뽑는다 — 손배열이 아니라 스윕이 센다. */
function parseQueries(src: string): Array<{ name: string; key: string; enabled: string | null }> {
  const pattern = /const (\w+) = useQuery\(\{\s*\n\s*queryKey: (\[[^\n]*\]),\s*\n(?:\s*enabled: (.*),\s*\n)?/g;
  const parsed: Array<{ name: string; key: string; enabled: string | null }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(src)) !== null) {
    parsed.push({ name: match[1], key: match[2], enabled: match[3] ?? null });
  }
  return parsed;
}

describe("라운드 82 D(#4) 화면별 첫 페인트 요청 구성", () => {
  it("ⓔ 대장의 쿼리 목록이 소스의 선언과 정확히 같다(쿼리가 늘면 여기가 먼저 깨진다)", () => {
    for (const [path, ledger] of Object.entries(FIRST_PAINT_QUERY_LEDGER)) {
      const src = source(path);
      const parsed = parseQueries(src);
      // 스윕이 한 선언도 놓치지 않았다 — 모양이 다른 선언이 생기면 이 수가 어긋난다.
      expect(parsed.length, `${path}의 useQuery 선언 수`).toBe(src.split("useQuery({").length - 1);
      expect(
        parsed,
        `${path}의 쿼리 구성`
      ).toEqual(ledger.map((entry) => ({ name: entry.name, key: entry.key, enabled: entry.enabled })));
      for (const entry of ledger) {
        expect(entry.reason.length, `${path}:${entry.name}의 사유가 값으로 남아 있다`).toBeGreaterThan(30);
      }
    }
  });

  it("ⓔ 리포트 탭의 첫 페인트 요청이 종전(여덟)보다 작다", () => {
    const countFirstPaint = (path: string) =>
      FIRST_PAINT_QUERY_LEDGER[path].filter((entry) => entry.firesOnFirstPaint).length;
    // 라운드 82 A 이전의 값이 여덟이었다(그중 하나가 `["home", childId]`였다). 값은 대장에서 센다.
    expect(countFirstPaint("app/(tabs)/reports.tsx")).toBeLessThan(8);
    // 더보기는 라운드 82 D 이전에 둘이었고(홈 + 아이 목록), 지금은 그보다 작다.
    expect(countFirstPaint("app/(tabs)/more.tsx")).toBeLessThan(2);
    // 두 화면 다 첫 페인트에 `/home`을 기다리지 않는다 — 그 응답을 기다리는 화면은 홈뿐이다.
    for (const path of ["app/(tabs)/reports.tsx", "app/(tabs)/more.tsx"]) {
      expect(FIRST_PAINT_QUERY_LEDGER[path].some((entry) => entry.key.startsWith('["home"'))).toBe(false);
    }
    expect(FIRST_PAINT_QUERY_LEDGER["app/(tabs)/index.tsx"].some((entry) => entry.key === '["home", childId]')).toBe(
      true
    );
  });

  it("ⓔ 미룬 쿼리는 대장에도 미룬 것으로 적히고, 그 계약은 홈이 그대로 진다", () => {
    const deferred = FIRST_PAINT_QUERY_LEDGER["app/(tabs)/index.tsx"].find(
      (entry) => entry.name === "lastMonthExpenses"
    );
    expect(deferred?.firesOnFirstPaint).toBe(false);
    // 그 계약의 집은 여전히 home-cold-start-defer.test.ts다 — 이 대장은 그 사실을 읽기만 한다.
    expect(source("src/home/home-cold-start-defer.test.ts")).toContain(
      "enabled: Boolean(authToken && childId && lastYearMonth && thisMonthExpenses.isFetched)"
    );
  });
});
