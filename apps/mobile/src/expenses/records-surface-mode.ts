/**
 * 기록 탭의 **표면 판정** 순수 모듈 — "지금 이 화면은 무엇을 말할 수 있는 상태인가".
 *
 * ## 왜 생겼나 (이월 항목: 0건 사용자에게 서던 컨트롤 무더기)
 *
 * 종전에 `app/(tabs)/records.tsx`의 `listHeader`는 **검색 입력 · 분류 칩 줄 · 정렬 토글**을
 * 어떤 상태에서도 무조건 그렸다(그때는 참이었다 — 그 컨트롤들이 하나씩 붙던 라운드마다
 * "이 달에 목록이 있다"가 암묵 전제였고, 아무도 그 전제를 판정으로 적지 않았다). 그래서
 * 아직 아무것도 기록하지 않은 사람의 첫 화면이 **가리킬 대상이 하나도 없는 컨트롤 무더기**로
 * 시작했다: 무엇을 검색하고, 무엇을 분류로 좁히고, 무엇을 금액순으로 정렬하라는 것인지
 * 화면 안에 없다. 그 줄들이 세로 자리를 먹는 만큼 핵심 루프 1단계(지출 기록)로 가는 빈 상태
 * 카드는 아래로 밀린다.
 *
 * ## 이 모듈이 가르는 다섯 갈래 — ⚠️ 셋째와 넷째를 섞으면 사용자가 갇힌다
 *
 *  · `"loading"`      — 아직 확정된 목록이 없다(조회 중이거나 쿼리가 비활성이다).
 *  · `"error"`        — 조회가 확정 실패했다.
 *  · `"empty"`        — 로드 성공 · **필터 0개** · 모집단 0건. **여기서만** 컨트롤을 걷는다.
 *  · `"filtered-empty"` — 로드 성공 · 필터가 걸렸고 그 결과가 0건. ⚠️ 여기서 컨트롤을 걷으면
 *    사용자가 **자기가 건 필터를 되돌릴 수단을 잃는다**(검색어를 지울 입력칸도, 칩을 풀
 *    "전체"도 사라진다). 그래서 이 갈래는 `"list"`와 **같은 편**에 선다.
 *  · `"list"`         — 화면에 설 행이 있다.
 *
 * ## 로딩을 걷지 않는 이유 (라운드 104 트랙 SEARCH #3의 "골격 유지"와 같은 판단)
 *
 * 로딩 중에 컨트롤을 걷으면 달을 넘길 때마다 검색창·칩 줄·정렬 토글이 사라졌다 다시 서면서
 * 헤더 높이가 튄다 — 그때 사용자가 이미 치고 있던 검색어의 입력칸까지 언마운트된다. 로딩은
 * "0건"이라는 **사실을 아직 모르는** 상태이므로, 모르는 동안에는 아무것도 걷지 않는다.
 * 비활성 쿼리(비세션·아이 미선택)도 같은 이유로 `"loading"`이다: 로드가 확정되지 않았는데
 * "기록이 하나도 없다"고 판정하면 그 자체가 근거 없는 단정이다.
 *
 * ## 모집단의 뜻 — 이 화면이 실제로 아는 만큼만
 *
 * 이 화면은 **보고 있는 한 달**만 들고 있다(쿼리 키 `["expenses", childId, recordsYearMonth]`).
 * "이 계정에 기록이 한 건이라도 있는가"를 묻는 API는 없으므로, `"empty"`가 뜻하는 것은
 * *"지금 이 화면이 보는 모집단이 0건"* 이지 *"계정 전체가 0건"* 이 아니다. 그 대신 걷는 것은
 * **필터 컨트롤뿐**이고 달 이동(‹ ›)·월 선택 시트·리스트/달력 토글은 그대로 남긴다 — 빈 달에서
 * 다른 달로 빠져나가는 길이 하나도 막히지 않는다.
 *
 * 화면 비의존(react-native를 import하지 않는다 — vitest가 RN을 렌더할 수 없다는 이 저장소의
 * 확립된 규율. records-sort.ts·records-date-groups.ts와 같은 결).
 */

/** 기록 탭 표면의 다섯 갈래. 화면은 이 값 하나로 컨트롤 노출을 정한다. */
export type RecordsSurfaceMode = "loading" | "error" | "empty" | "filtered-empty" | "list";

/**
 * 다섯 갈래 판정.
 *
 * 순서는 화면(`records.tsx`)의 `listEmpty` 분기 순서를 **그대로** 따른다(로딩 → 오류 → 필터
 * 0건 → 빈 달). 두 자리가 다른 순서로 물으면 같은 상태를 두고 본문과 헤더가 다른 말을 한다.
 *
 * `searchText`(입력값)와 `appliedSearchText`(디바운스 확정값)를 **둘 다** 본다: 확정 전
 * 350ms 동안 입력값만 차 있는 창이 있는데, 그때 확정값만 보면 사용자가 첫 글자를 치는 순간
 * 판정이 `"empty"`로 떨어져 **치고 있던 입력칸이 손 아래에서 사라진다**.
 */
export function recordsSurfaceMode(input: {
  /** 그 달 서버 조회가 로딩 중인가(`expenses.isLoading`). */
  isLoading: boolean;
  /** 그 달 서버 조회가 확정 실패했는가(`expenses.isError`). */
  isError: boolean;
  /** 서버 응답이 손에 있는가(`Boolean(expenses.data)`) — 비활성 쿼리에서는 false다. */
  hasData: boolean;
  /** **필터 이전** 모집단 건수(그 달 서버 행 + 오프라인 대기 행) — 월 요약 줄과 같은 셈이다. */
  populationCount: number;
  /** 필터를 적용한 뒤 화면에 설 행 수(`listData.length`). */
  visibleCount: number;
  /** 검색 입력칸의 **현재 값**(아직 확정되지 않았을 수 있다). */
  searchText: string;
  /** 디바운스로 확정되어 실제 필터에 걸린 검색어. */
  appliedSearchText: string;
  /** 고른 분류 칩. 고르지 않았으면 null("전체"). */
  categoryId: string | null;
}): RecordsSurfaceMode {
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  // 비활성 쿼리(비세션·아이 미선택): 로딩도 오류도 아니지만 확정된 목록이 없다 — 머리말 참고.
  if (!input.hasData) return "loading";
  if (recordsFilterApplied(input)) return input.visibleCount > 0 ? "list" : "filtered-empty";
  // 필터가 없는데 보이는 행이 있다면 그것이 곧 모집단이다(전체 기간 스코프처럼 모집단 셈이
  // 월을 넘는 경우에도 "행이 있는데 빈 상태"라고 말하지 않는다).
  if (input.populationCount > 0 || input.visibleCount > 0) return "list";
  return "empty";
}

/**
 * 필터가 하나라도 걸렸는가. 공백만 친 검색어는 필터가 아니다(필터 문구 모듈들이 쓰는
 * `normalizeRecordSearchText`와 같은 방향의 판정 — 여기서는 "걸렸는가"만 묻는다).
 */
function recordsFilterApplied(input: {
  searchText: string;
  appliedSearchText: string;
  categoryId: string | null;
}): boolean {
  if (input.categoryId !== null) return true;
  return input.searchText.trim().length > 0 || input.appliedSearchText.trim().length > 0;
}

/**
 * 검색 입력 · 최근 검색어 줄 · 분류 칩 줄 · 정렬 토글을 지금 세울 것인가.
 *
 * 걷는 갈래는 `"empty"` **하나뿐**이다. 특히 `"filtered-empty"`에서 참인 것이 이 함수의
 * 존재 이유다 — 0건을 만든 필터를 되돌릴 컨트롤이 그 화면에 남아 있어야 한다(머리말 ⚠️).
 */
export function areRecordsFilterControlsVisible(mode: RecordsSurfaceMode): boolean {
  return mode !== "empty";
}
