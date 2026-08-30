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
 *
 * ## 라운드 83 B(#2) — 모집단이 **탭 다섯**이다 (W-4의 이행)
 *
 * 라운드 82 D가 이 대장을 세울 때 모집단은 그 라운드가 만진 세 탭(홈 · 리포트 · 더보기)뿐이었다.
 * 그래서 "어느 탭이 콜드 스타트에 무엇을 켜는가"라는 질문에 답이 있는 탭과 없는 탭이 갈렸고,
 * 실제로 기록 탭은 홈이 UX-W(C8)로 이미 미뤄 둔 지난달 지출 쿼리(`["expenses", childId, 지난달]`
 * — 홈과 **같은 키**다)를 첫 페인트에 이번 달 쿼리와 나란히 켜고 있었다. 그 응답의 유일한
 * 소비자(`lastMonthInsight`)는 이미 `expenses.data`를 기다리므로, 지난달이 먼저 도착해도 그 줄은
 * 그려지지 않는다 — 먼저 받아 봐야 그릴 것이 0건인 왕복이었다.
 *
 * 라운드 83 B가 기록 탭의 그 한 줄을 홈과 같은 모양(`expenses.isFetched` 뒤)으로 미루면서,
 * 이 대장의 모집단을 **탭 다섯 전부**로 넓힌다. 이제 탭 하나가 새 쿼리를 켜면 어느 탭이든
 * 이 파일이 먼저 빨개진다(종전에는 기록 · 준비물 탭이 그 스윕 밖이었다).
 *
 * ⚠️ 준비물 탭(`app/(tabs)/items.tsx`)은 이 라운드에서 **읽기만** 한다 — 대장에 들어올 뿐
 * 변경 0건이다. 홈 · 리포트 · 더보기 세 항목도 라운드 82 D가 적은 그대로 바이트 불변이다.
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
  "app/(tabs)/records.tsx": [
    {
      name: "expenses",
      key: '["expenses", childId, recordsYearMonth]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "이 탭의 목록 · 건수 · 월 합계 · 카테고리 집계가 전부 이 한 응답이다 — 기록 탭의 첫 페인트가 곧 이 응답이다."
    },
    {
      name: "lastMonthExpenses",
      key: '["expenses", childId, lastYearMonth]',
      enabled: "Boolean(authToken && childId && lastYearMonth && isCurrentMonth && expenses.isFetched)",
      firesOnFirstPaint: false,
      reason: "라운드 83 B가 홈(UX-W C8)과 같은 순서로 미뤘다 — 이번 달 조회가 끝나야 켜진다. 소비자인 '지난달 같은 시점 대비' 한 줄이 이미 expenses.data를 기다리므로, 먼저 받아도 그 프레임에 그릴 것이 0건이다(키는 홈과 공유하는 그대로다)."
    },
    {
      name: "categories",
      key: '["categories"]',
      enabled: "Boolean(authToken)",
      firesOnFirstPaint: true,
      reason: "카테고리 필터 칩과 행 부제의 이름 해석이 이 목록에서 온다. 홈 · 리포트 · 지출 화면과 같은 키라 대개 이미 채워진 캐시를 읽는다."
    },
    {
      name: "childrenQuery",
      key: '["children"]',
      enabled: "Boolean(authToken)",
      firesOnFirstPaint: true,
      reason: "헤더의 아이 라벨과 작성자 라벨이 쓸 가구 판정(resolveExpenseHouseholdId)의 원천이고, 아이가 정해지지 않은 창에서도 필요하다(게이트가 토큰 하나다)."
    },
    {
      name: "householdMembers",
      key: '["household-members", householdId]',
      enabled: "Boolean(authToken && householdId)",
      firesOnFirstPaint: false,
      reason: "가구는 ['children']이 끝나야 정해진다(resolveExpenseHouseholdId는 목록이 없으면 null을 준다) — 첫 페인트 다음 프레임이다. 목록이 없는 동안 작성자 라벨은 종전처럼 생략된다."
    }
  ],
  "app/(tabs)/items.tsx": [
    {
      name: "childrenQuery",
      key: '["children"]',
      enabled: "Boolean(authToken)",
      firesOnFirstPaint: true,
      reason: "시기 밴드의 원천이다 — 라운드 69 C가 이 화면의 단계 판정을 ['home']에서 이 한 행으로 옮겼고(그래서 이 탭은 홈 응답을 무효화만 한다), 게이트가 토큰 하나다."
    },
    {
      name: "items",
      key: '["items", childId, "catalog"]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "준비물 카탈로그 전량과 그 아이의 상태 행이 이 한 응답이다 — 이 탭의 본문이 곧 이 응답이라 미룰 자리가 없다."
    },
    {
      name: "categories",
      key: '["categories"]',
      enabled: "Boolean(authToken && childId)",
      firesOnFirstPaint: true,
      reason: "분류 섹션의 이름·아이콘을 정한다. 새 화면 데이터가 아니라 기록 탭·리포트가 이미 채워 두는 그 공유 캐시다."
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

/**
 * 라운드 82 리뷰 L-14 — **`firesOnFirstPaint`를 손으로 믿지 않는다.**
 *
 * 종전에는 그 칸이 대장에 적힌 **불리언**이었고 어디와도 대조되지 않았다. 그래서 "첫 페인트 수가
 * 여덟보다 작다"는 단언은 *그 불리언들의 합*만 셌고, 누군가 `enabled`를 손대지 않은 채 불리언만
 * 뒤집으면(또는 게이트를 넓히고 불리언을 그대로 두면) 조용히 통과했다 — 대장이 소스에서 뽑은
 * 이름·키·`enabled` 셋만 대조하고 정작 **판정**은 대조하지 않는 자리였다.
 *
 * 이제 그 칸은 **`enabled` 식에서 계산된다**: 아래 프레임(콜드 스타트 첫 렌더)에서 식을 평가한
 * 값과 대장의 불리언이 같아야 한다. 불리언만 뒤집으면 빨개지고, `enabled`가 바뀌면 그 변화가
 * 곧바로 첫 페인트 수에 반영된다.
 */
type FirstPaintValue = { value: string | boolean; reason: string };

/**
 * **첫 페인트 프레임** — 세션이 있고(`authToken`) 아이도 정해져 있으며(`childId`) 캐시가 비어 있는
 * 콜드 스타트의 첫 렌더에서 각 이름이 갖는 값. 이름마다 왜 그 값인지가 함께 적힌다.
 *
 * 모르는 이름이 `enabled`에 나타나면 평가가 **던진다** — 새 게이트가 들어오면 그 이름의 첫 페인트
 * 값을 여기에 값으로 적게 하려는 것이 이 사전의 규율이다.
 */
const FIRST_PAINT_FRAME: Readonly<Record<string, FirstPaintValue>> = {
  authToken: { value: true, reason: "기준 프레임이 '세션이 있는' 콜드 스타트다." },
  childId: { value: true, reason: "기준 프레임이 '아이가 정해진' 콜드 스타트다." },
  householdId: {
    value: false,
    reason: "가구는 ['children'] 응답이 정한다 — 첫 렌더에는 아직 없다(더보기의 resolveManagedHouseholdId도, 기록 탭의 resolveExpenseHouseholdId도 목록이 없으면 null을 준다)."
  },
  lastYearMonth: { value: true, reason: "지난달 키는 오늘 날짜로 만드는 문자열이라 첫 렌더에 이미 있다." },
  period: { value: "월간", reason: "리포트 탭의 기본 세그먼트다(useState 초기값)." },
  isCurrentMonth: {
    value: true,
    reason: "기록 탭이 보고 있는 달 — 달 이동(monthOffset)의 초기값이 0이라 첫 렌더는 언제나 이번 달이다."
  },
  "thisMonthExpenses.isFetched": {
    value: false,
    reason: "같은 프레임에서 막 켜진 쿼리라 아직 끝나지 않았다(UX-W C8이 미룬 근거 그 자체)."
  },
  "expenses.isFetched": {
    value: false,
    reason: "기록 탭의 이번 달 쿼리 — 같은 프레임에서 막 켜졌으므로 아직 끝나지 않았다(라운드 83 B가 지난달을 그 뒤로 미룬 근거 그 자체)."
  },
  homeHasNoBudgetThisMonth: {
    value: false,
    reason: "['home'] 응답에서 파생되는 값이라 첫 렌더에는 응답이 없다(그래서 거짓)."
  },
  childrenSettled: {
    value: false,
    reason: "['children'] 조회가 끝났는가 — 같은 프레임에서 막 켜졌으므로 아직 아니다."
  }
};

/**
 * `enabled` 식을 첫 페인트 프레임에서 평가한다.
 *
 * 지원하는 모양은 오늘 소스에 실재하는 것뿐이다 — `Boolean(...)` 감싸기, `&&` 연쇄,
 * `이름`/`이름.속성`, `이름 === "리터럴"`. `||`·`!`·삼항 같은 모양이 새로 들어오면 여기서
 * 던진다(그 모양의 첫 페인트 판정은 사람이 한 번 더 재야 한다는 뜻이다).
 */
function evaluateFirstPaint(expression: string): boolean {
  const trimmed = expression.trim();
  if (trimmed.startsWith("Boolean(") && trimmed.endsWith(")")) {
    const inner = trimmed.slice("Boolean(".length, -1);
    // 바깥 괄호가 실제로 짝이 맞을 때만 벗긴다(`Boolean(a) && b`는 벗기면 안 된다).
    if (isBalanced(inner)) return evaluateFirstPaint(inner);
  }
  if (trimmed.includes("||") || trimmed.startsWith("!") || trimmed.includes("?")) {
    throw new Error(`첫 페인트 평가가 모르는 모양이다: ${expression}`);
  }

  const parts = splitTopLevel(trimmed, "&&");
  if (parts.length > 1) return parts.every((part) => evaluateFirstPaint(part));

  const comparison = trimmed.match(/^([\w.]+)\s*===\s*"([^"]*)"$/);
  if (comparison) return lookup(comparison[1]).value === comparison[2];
  if (/^[\w.]+$/.test(trimmed)) return Boolean(lookup(trimmed).value);
  throw new Error(`첫 페인트 평가가 모르는 모양이다: ${expression}`);
}

function lookup(name: string): FirstPaintValue {
  const entry = FIRST_PAINT_FRAME[name];
  if (!entry) throw new Error(`첫 페인트 프레임에 ${name}의 값이 적혀 있지 않다`);
  return entry;
}

function isBalanced(source: string): boolean {
  let depth = 0;
  for (const char of source) {
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/** 괄호 깊이 0에서만 연산자로 가른다. */
function splitTopLevel(source: string, operator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (depth === 0 && source.startsWith(operator, index)) {
      parts.push(source.slice(start, index));
      index += operator.length - 1;
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

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

  /**
   * 라운드 82 리뷰 L-14 — 대장의 `firesOnFirstPaint`가 **`enabled` 식과 대조된다**. 불리언만
   * 뒤집으면 여기가 먼저 빨개지므로, 아래 "여덟보다 작다"가 무력화될 수 없다.
   */
  it("ⓔ 첫 페인트 여부는 손으로 적은 불리언이 아니라 `enabled` 식이 정한다", () => {
    const used = new Set<string>();
    for (const [path, ledger] of Object.entries(FIRST_PAINT_QUERY_LEDGER)) {
      for (const entry of ledger) {
        const enabled = entry.enabled;
        expect(enabled, `${path}:${entry.name}의 enabled 식`).not.toBeNull();
        for (const name of enabled!.match(/[A-Za-z_$][\w$.]*/g) ?? []) {
          if (name !== "Boolean") used.add(name);
        }
        expect(evaluateFirstPaint(enabled!), `${path}:${entry.name} — ${enabled}`).toBe(entry.firesOnFirstPaint);
      }
    }

    // 프레임에 낡은 줄이 남지 않는다(양방향) — 쓰이지 않는 이름은 지운다.
    expect(Object.keys(FIRST_PAINT_FRAME).filter((name) => !used.has(name))).toEqual([]);
    for (const [name, entry] of Object.entries(FIRST_PAINT_FRAME)) {
      expect(entry.reason.length, `${name}의 사유가 값으로 남아 있다`).toBeGreaterThan(20);
    }

    // 평가기 자신이 무언가를 실제로 가른다(전부 참/전부 거짓으로 통과하지 않는다).
    expect(evaluateFirstPaint("Boolean(authToken && childId)")).toBe(true);
    expect(evaluateFirstPaint('Boolean(authToken && childId && period === "분기")')).toBe(false);
    // 모르는 이름·모르는 모양은 던진다 — 새 게이트가 조용히 참으로 세어지지 않는다.
    expect(() => evaluateFirstPaint("Boolean(authToken && somethingNew)")).toThrow();
    expect(() => evaluateFirstPaint("Boolean(authToken || childId)")).toThrow();
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

  /**
   * 라운드 83 B(#2) 계약 ⓑ — **모집단이 탭 다섯이다.**
   *
   * 대장이 세 탭만 덮던 동안 기록 · 준비물 탭의 첫 페인트 구성은 어디에도 적히지 않았고, 그래서
   * 홈이 이미 미뤄 둔 같은 키를 기록 탭이 첫 페인트에 켜고 있다는 사실이 아무 데서도 빨개지지
   * 않았다. 이제 탭이 하나라도 쿼리를 늘리면 위 ⓔ 스윕이 먼저 깨진다.
   */
  it("ⓑ 모집단: 대장의 화면이 app/(tabs)의 탭 다섯 전부다", () => {
    const tabScreens = appScreenPaths().filter(
      (path) => path.startsWith("app/(tabs)/") && !path.endsWith("/_layout.tsx")
    );
    expect(tabScreens).toHaveLength(5);
    expect(Object.keys(FIRST_PAINT_QUERY_LEDGER).sort()).toEqual(tabScreens);
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

/**
 * 라운드 83 B(#2) — **기록 탭이 홈과 같은 순서로 기다린다.**
 *
 * 홈은 UX-W(C8)에서 지난달 지출 쿼리를 `thisMonthExpenses.isFetched` 뒤로 미뤘는데, 기록 탭은
 * **같은 캐시 키**(`["expenses", childId, 지난달]`)를 첫 페인트에 이번 달 쿼리와 나란히 켜고
 * 있었다. 그 응답을 쓰는 자리는 "지난달 같은 시점 대비" 한 줄 하나이고, 그 줄은 이미
 * `expenses.data`(이번 달 목록)가 있어야만 계산된다 — 지난달이 먼저 도착한 프레임에는 그릴
 * 것이 애초에 0건이라, 첫 페인트를 두 달치 커서 루프가 함께 붙잡을 이유가 없었다.
 *
 * 고친 것은 `enabled` 한 줄뿐이다: 키 · 페처 · 소비자 · 문구 · 렌더 노드가 모두 그대로이고,
 * 쿼리는 **미뤄지기만** 한다(과거 달을 볼 때 비활성이던 `isCurrentMonth` 게이트도 그대로다).
 * 홈의 계약은 여전히 src/home/home-cold-start-defer.test.ts가 지고, 이 describe는 기록 탭 쪽의
 * 같은 두 단언(배선 · 선언 순서)과 그 defer가 **새 창을 만들지 않는다**는 사실을 붙든다.
 */
describe("라운드 83 B(#2) 기록 탭 첫 페인트 defer", () => {
  const recordsSource = () => source("app/(tabs)/records.tsx");

  it("ⓐ 배선: 지난달 지출 쿼리는 이번 달 쿼리가 끝난 뒤에야 켜진다(홈과 같은 두 단언)", () => {
    expect(recordsSource()).toContain(
      "enabled: Boolean(authToken && childId && lastYearMonth && isCurrentMonth && expenses.isFetched)"
    );
    // 선언 순서도 계약이다 — 지난달 쿼리가 위에 있으면 `expenses`를 참조할 수 없다.
    expect(recordsSource().indexOf("const expenses = useQuery({")).toBeLessThan(
      recordsSource().indexOf("const lastMonthExpenses = useQuery({")
    );
  });

  it("ⓐ 이번 달 쿼리는 미루지 않는다 — 목록·건수·월 합계가 첫 페인트에 쓰는 데이터다", () => {
    const src = recordsSource();
    const start = src.indexOf("const expenses = useQuery({");
    const thisMonthQuery = src.slice(start, src.indexOf("});", start));
    expect(thisMonthQuery).toContain("enabled: Boolean(authToken && childId)");
    expect(thisMonthQuery).not.toContain("isFetched");
  });

  it("ⓔ 부정: 새 창이 0건이다 — 비교 줄의 게이트는 종전과 같이 이번 달 응답이다", () => {
    const src = recordsSource();
    // 지난달 응답만 있고 이번 달이 없는 프레임에서 비교 줄이 그려진 적이 없다(그 게이트가 이미
    // expenses.data다). 그래서 이 defer가 "보이던 것이 사라지는" 창을 새로 만들지 않는다.
    expect(src).toContain("isCurrentMonth && expenses.data");
    expect(src).toContain("if (!lastYearMonth || !lastMonthServerExpenses) return null;");
    // 캐시 키는 홈과 공유하는 그대로다 — 추가 왕복 0건이고 ["expenses"] 무효화에 그대로 걸린다.
    expect(src).toContain('queryKey: ["expenses", childId, lastYearMonth]');
    expect(src).toContain('queryKey: ["expenses", childId, recordsYearMonth]');
    // 페처도 그대로 전량 수집이다(REC-124 H1) — 미룬 것이지 잘라 온 것이 아니다.
    expect(src).toContain(
      "queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken!, childId!, lastYearMonth!, page))"
    );
  });

  it("ⓓ 대소: 기록 탭의 첫 페인트 요청이 종전(넷)보다 작다", () => {
    const firstPaintCount = (path: string) =>
      FIRST_PAINT_QUERY_LEDGER[path].filter((entry) => entry.firesOnFirstPaint).length;
    // 종전 넷: 이번 달 지출 · 지난달 지출 · 카테고리 · 아이 목록. 값은 손으로 적지 않고 대장에서
    // 센다(그 대장의 불리언은 위 ⓔ 스윕이 `enabled` 식 평가와 대조한다).
    expect(firstPaintCount("app/(tabs)/records.tsx")).toBeLessThan(4);
    // 미룬 것은 지난달 한 줄뿐이다 — 나머지 셋은 그대로 첫 페인트에 선다.
    const deferred = FIRST_PAINT_QUERY_LEDGER["app/(tabs)/records.tsx"].filter(
      (entry) => !entry.firesOnFirstPaint
    );
    expect(deferred.map((entry) => entry.name)).toEqual(["lastMonthExpenses", "householdMembers"]);
  });
});
