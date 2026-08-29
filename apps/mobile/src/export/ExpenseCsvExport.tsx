import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { EXPENSE_LIST_MAX_LIMIT, listCategories, listChildren, listExpenses, LOCAL_SESSION_TOKEN } from "../api/client";
import { buildCategoryNameLookup } from "../categories";
// 라운드 66 트랙 B(#3): 다자녀 스코프 라벨의 해석·조립은 4탭·빠른 기록 시트·예산 화면과 **같은
// 순수 모듈 한 벌**에서만 온다(새 어휘를 만들지 않는다 — 라운드 48 T4의 `resolveChildScopeLabel`).
import { resolveChildScopeLabel, withChildScopeLabel, withSpokenChildScopeLabel } from "../children/child-switch";
import { collectExpensePages, ExpensePageCollectionError } from "./expense-page-collector";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { MoreSettingsPixelStyles } from "../pixelLock/styles";
import { theme } from "../theme";
import { CategoryChip, SecondaryButton, Toast } from "../ui";
import { AppIcon } from "../design-system";
import { isCurrentlyOnline } from "../offline/connectivity";
import { OFFLINE_RETRY_NOTICE, type LogoutPendingInput } from "../offline/messages";
import { refreshOfflineSyncSnapshot, useOfflineSyncSnapshot } from "../offline/sync-controller";
import { buildExpenseCsv } from "./expense-csv";
import {
  evaluateExportPendingNotice,
  exportPendingToastSuffix,
  EXPORT_PENDING_NOTICE_TEST_ID,
  type ExportPendingNotice
} from "./export-pending-notice";
import {
  canShiftCustomRange,
  collectExpensesForRange,
  customRangeLabel,
  customRangeMonthJumpBounds,
  defaultCustomRange,
  EXPORT_MONTH_JUMP_HINT,
  EXPORT_RANGE_OPTIONS,
  exportFileName,
  selectCustomRangeMonth,
  shiftCustomRange,
  yearMonthLabel,
  type CustomExportRange,
  type ExportRange
} from "./export-range";
// 라운드 67 트랙 C(#5): 기록·리포트 탭이 쓰는 **그 시트·그 판정**을 그대로 연다(새 시트를 만들지
// 않는다 — 라운드 66 A가 세운 달 점프 관례). 경계·이유 문장은 위 export-range.ts가 인자로 준다.
import { monthJumpTriggerAccessibilityLabel, MONTH_JUMP_TRIGGER_HINT, type MonthJumpBounds } from "../month-jump";
import { MonthJumpSheet } from "../MonthJumpSheet";
import { shareExpenseCsv } from "./share-csv";
import { csvShareToastMessage } from "./share-payload";

/**
 * EXP-106 데이터 내보내기(CSV) 공용 모듈 (CLEAN-123/A3).
 *
 * 원래 이 흐름은 더보기 탭(app/(tabs)/more.tsx) 안에만 인라인으로 있었고, 설정 화면에는
 * "데이터 가져오기"만 있어 데이터 이동성이 한쪽으로만 열려 있었다. 두 화면이 같은 내보내기를
 * 제공해야 하므로 상태·네트워크·토스트·카드 UI를 전부 이 모듈로 끌어올려 한 벌만 유지한다
 * (중복 구현 금지). 화면은 메뉴 행 하나를 그리고 이 컨트롤러를 카드/토스트에 넘기기만 한다.
 *
 * 카드 라디우스 등은 MoreSettingsPixelStyles(SET-001)를 그대로 쓴다 -- 더보기·설정 두 화면이
 * 공유하는 픽셀락 토큰이라 추출 전후로 더보기 탭의 픽셀이 바뀌지 않는다.
 */

export type ExpenseCsvExportToastState = { message: string; tone: "success" | "error" };

export type ExpenseCsvExportController = {
  /** 세션(토큰 + 선택된 아이)이 있어 실제로 내보낼 데이터가 존재하는지. */
  canExport: boolean;
  /** 기간 선택 카드 펼침 여부. */
  cardOpen: boolean;
  toggleCard: () => void;
  range: ExportRange;
  setRange: (range: ExportRange) => void;
  /** GAP-054 D#11: "직접 선택" 구간의 시작/끝 달(언제나 정규화된 값). */
  customRange: CustomExportRange;
  /** 한 쪽 끝을 한 달 옮긴다. 경계에서는 아무 일도 일어나지 않는다(버튼이 이미 비활성). */
  shiftCustomMonth: (edge: "start" | "end", delta: -1 | 1) => void;
  /** 그 방향으로 옮길 수 있는가 -- 화면은 이 값으로 화살표를 잠근다(시작>끝·미래 달 방지). */
  canShiftCustomMonth: (edge: "start" | "end", delta: -1 | 1) => boolean;
  /**
   * 라운드 67 트랙 C(#5): 지금 달 점프 시트가 열려 있는 끝(없으면 null). 한 번에 하나만 열린다 --
   * 두 시트가 동시에 서면 어느 쪽 달을 고르는지가 화면에서 사라진다.
   */
  monthJumpEdge: "start" | "end" | null;
  /** 달 라벨을 눌렀을 때. 같은 끝을 다시 누르면 닫힌다(기록 탭 트리거와 같은 토글). */
  toggleMonthJump: (edge: "start" | "end") => void;
  closeMonthJump: () => void;
  /** 그 끝의 시트가 쓸 경계·이유 문장. 판정은 전부 순수 모듈(src/month-jump.ts)이 한다. */
  monthJumpBounds: (edge: "start" | "end") => MonthJumpBounds;
  /** 시트에서 고른 달을 그 끝에 넣는다. 고를 수 없는 달이면 아무 일도 일어나지 않는다. */
  selectCustomMonth: (edge: "start" | "end", yearMonth: string) => void;
  /** 지금 고른 구간으로 저장할 파일 이름 -- 텍스트로 붙여 넣은 뒤 무엇으로 저장할지 미리 말한다. */
  fileName: string;
  /**
   * 라운드 66 트랙 B(#3): **어느 아이의 기록인가**. 아이가 하나(또는 아직 모름)면 `null`이고,
   * 그때 카드 제목도 파일 이름도 종전과 한 글자도 다르지 않다(`resolveChildScopeLabel`).
   */
  childScopeLabel: string | null;
  /**
   * GAP-056 #3: 고른 기간에서 **아직 서버에 올라가지 않아 CSV에 담기지 못하는** 기록 고지.
   * 0건이면 null이라 카드는 아무것도 그리지 않는다(판정은 export-pending-notice.ts).
   */
  pendingNotice: ExportPendingNotice | null;
  /**
   * 라운드 68 트랙 B(#2): 로그아웃이 지우는 것의 크기 — **아이·기간 필터를 지나지 않은** 이 기기
   * 전량이다(위 `pendingNotice`와 모집단이 다르다). 이 컨트롤러가 이미 구독 중인 스냅숏에서
   * 그대로 나오므로 소비 화면에는 새 구독도 새 요청도 없다. 문장을 만드는 것은
   * `logoutConfirmMessage`(src/offline/messages.ts)이고 이 값은 그 입력일 뿐이다.
   */
  devicePendingRecords: LogoutPendingInput;
  busy: boolean;
  toast: ExpenseCsvExportToastState | null;
  runExport: () => Promise<void>;
};

/** 비활성(로그아웃) 메뉴 행에 붙이는 캡션 -- 더보기·설정이 같은 문구를 쓴다. */
export const EXPORT_SIGNED_OUT_CAPTION = "로그인 후 이용 가능";
export const EXPORT_MENU_TITLE = "데이터 내보내기(CSV)";

/**
 * 라운드 45 UX-AA(후보 7): 공유되는 것이 파일이 아니라 텍스트임을 미리 말한다.
 *
 * 사실 근거: share-csv.ts는 expo-file-system/expo-sharing 없이 RN Share.share({ message })로
 * 보내므로 첨부 파일이 생기지 않는다. 그 사실을 화면이 말하지 않으면 사용자는 파일함을 뒤지게 되고,
 * 다음 행동(붙여 넣고 .csv로 저장)도 알 길이 없다.
 */
export const EXPORT_TEXT_SHARE_NOTICE =
  "파일이 아니라 텍스트로 공유돼요. 메일·메모에 붙여 넣고 .csv로 저장하면 엑셀에서 열 수 있어요.";
/** 버튼 라벨도 실제 동작(공유 시트 열기)을 그대로 말한다. */
export const EXPORT_SHARE_BUTTON_LABEL = "CSV 텍스트로 공유";

/**
 * GAP-054 D#11: 위 안내가 "붙여 넣고 .csv로 저장하면"이라고 다음 행동을 말해 놓고, 정작 **무슨
 * 이름으로** 저장할지는 사용자가 스스로 지어야 했다. 고른 기간이 이름에 들어 있어야 나중에
 * 파일만 보고도 무엇인지 알 수 있으므로, 화면이 그 이름을 미리 적어 준다(순수 계산은
 * export-range.ts의 `exportFileName`).
 */
export const EXPORT_FILE_NAME_LABEL = "저장할 이름";

export function useExpenseCsvExport(): ExpenseCsvExportController {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const canExport = Boolean(authToken && childId);

  // EXP-106: CSV의 "카테고리" 열은 서버가 지출에 실어주는 categoryId만으로는 이름을 알 수 없다.
  // 정식 시드 카테고리 12개는 고정 id가 없어(DB마다 랜덤 UUID) 정적 8타일 매핑으로는 전부
  // "기타"로 나갔다 -- src/categories.ts의 buildCategoryNameLookup 주석 참고. 지출 수정 화면·
  // 리포트 탭과 같은 ["categories"] 캐시를 공유하므로 대부분 이미 채워져 있고, 없으면(첫 진입
  // 직후·오프라인) 기존 정적 매핑으로 폴백한다.
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: canExport,
    staleTime: 5 * 60 * 1000,
    // CAT-124: includeAll=1 — CSV "카테고리" 열도 전량이 필요하다(별칭 id로 저장된 지출).
    queryFn: () => listCategories(authToken!, { includeAll: true })
  });

  /**
   * 라운드 66 트랙 B(#3) — 내보내기는 **선택된 아이 한 명**의 기록만 모으는데(아래 `runExport`의
   * `listExpenses(authToken, childId, …)`) 그 사실을 화면도 파일 이름도 말하지 않았다. 두 아이를
   * 키우는 사람이 각각 내보내면 화면이 **같은 이름**을 제시하고, 그대로 저장하면 앞의 파일이
   * 덮어쓰인다(본문에도 아이 열이 없어 내용으로도 구별되지 않는다 — export-range.ts의
   * `exportFileName` 주석).
   *
   * 목록은 4탭·설정이 이미 물고 있는 **같은 `["children"]` 캐시**다 — 새 캐시 키를 만들지 않으므로
   * 대개 이미 채워져 있고, 캐시가 아직 없으면 라벨이 null이라 화면이 종전 그대로일 뿐이다
   * (모르면 지어내지 않는다). 소비 화면(더보기 탭·설정)은 한 줄도 바뀌지 않는다 — 이 컨트롤러가
   * 스스로 읽는다(그 두 화면은 SET-001 픽셀락이라 무접촉이 이 트랙의 계약이다).
   */
  const children = useQuery({
    queryKey: ["children"],
    enabled: canExport,
    staleTime: 5 * 60 * 1000,
    queryFn: () => listChildren(authToken!)
  });
  const childScopeLabel = resolveChildScopeLabel(childId, children.data?.children);

  const [cardOpen, setCardOpen] = useState(false);
  const [range, setRange] = useState<ExportRange>("month");
  // GAP-054 D#11: 기본값은 이번 달 한 달 -- "직접 선택"을 처음 누른 사람이 보게 되는 구간이
  // 고정 "이번 달"과 같아, 화살표를 누른 만큼만 범위가 넓어진다(놀랄 일이 없다).
  const [customRange, setCustomRange] = useState<CustomExportRange>(() => defaultCustomRange(getSeoulToday()));
  /**
   * 라운드 67 트랙 C(#5) — 달 점프 시트가 열린 끝. 닫혀 있으면 카드는 종전과 한 줄도 다르지 않다
   * (시트는 열렸을 때만 그려진다 — 기록·리포트 탭과 같은 관례).
   */
  const [monthJumpEdge, setMonthJumpEdge] = useState<"start" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ExpenseCsvExportToastState | null>(null);
  // Same timer-in-ref discipline as records.tsx's confirmedFlash: a toast arriving right before
  // unmount (or replacing a pending one) must never setState after unmount / leak a timer.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string, tone: "success" | "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const toggleCard = useCallback(() => setCardOpen((open) => !open), []);

  // GAP-054 D#11: 판정은 전부 순수 모듈에 있다 -- 화면은 "어느 끝을 몇 달"만 말한다.
  // `getSeoulToday()`를 호출 시점에 읽으므로 자정을 넘겨도 미래 달 상한이 어긋나지 않는다.
  const shiftCustomMonth = useCallback((edge: "start" | "end", delta: -1 | 1) => {
    setCustomRange((current) => shiftCustomRange(current, edge, delta, getSeoulToday()));
  }, []);
  const canShiftCustomMonth = useCallback(
    (edge: "start" | "end", delta: -1 | 1) => canShiftCustomRange(customRange, edge, delta, getSeoulToday()),
    [customRange]
  );
  /**
   * 라운드 67 트랙 C(#5) — 달 라벨 → 시트. **스테퍼는 그대로 남는다**(대안이지 대체가 아니다 —
   * 한 칸 옮기기는 화살표가 여전히 빠르다. 라운드 65가 달력 픽커를 세우면서 손타이핑 칸을 남긴
   * 것과 같은 관례). 여기서도 판정은 한 줄도 짓지 않는다: 경계·이유 문장은 `customRangeMonthJumpBounds`,
   * 고른 달의 반영은 `selectCustomRangeMonth`가 하고 이 훅은 "어느 끝"만 말한다.
   */
  const toggleMonthJump = useCallback((edge: "start" | "end") => {
    setMonthJumpEdge((open) => (open === edge ? null : edge));
  }, []);
  const closeMonthJump = useCallback(() => setMonthJumpEdge(null), []);
  const monthJumpBounds = useCallback(
    (edge: "start" | "end") => customRangeMonthJumpBounds(customRange, edge, getSeoulToday()),
    [customRange]
  );
  const selectCustomMonth = useCallback((edge: "start" | "end", yearMonth: string) => {
    setCustomRange((current) => selectCustomRangeMonth(current, edge, yearMonth, getSeoulToday()));
    setMonthJumpEdge(null);
  }, []);
  /**
   * 구간 칩을 옮기면 열려 있던 시트를 닫는다 -- "직접 선택"이 아닌 구간에서는 그 줄 자체가 사라지고
   * (시트도 함께 언마운트된다), 다시 돌아왔을 때 사용자가 연 적 없는 시트가 서 있으면 안 된다.
   */
  const selectRange = useCallback((next: ExportRange) => {
    setMonthJumpEdge(null);
    setRange(next);
  }, []);
  const fileName = exportFileName({ range, todaySeoul: getSeoulToday(), custom: customRange, childLabel: childScopeLabel });

  /**
   * GAP-056 #3 — 이 기기에만 있어 CSV에 담기지 못하는 기록이 몇 건인가.
   *
   * 수집기는 `listExpenses`(서버 조회)만 부르므로 아웃박스에 남은 행은 파일에 실리지 않는다.
   * 리포트 탭이 같은 문제를 푼 방식(GAP-054 #3)을 그대로 따른다: 숫자를 지어내 합치지 않고,
   * 화면이 자기가 못 담는 것을 밝히는 한 줄만 둔다. 판정·문구는 전부 순수 모듈이 한다.
   *
   * 구독은 홈·리포트와 **같은 것**(useOfflineSyncSnapshot)이라 새 요청은 0건이고, 소비 화면
   * (더보기 탭·설정)은 한 줄도 바뀌지 않는다 -- 이 카드가 스스로 구독한다.
   */
  const offlineSyncSnapshot = useOfflineSyncSnapshot();
  useEffect(() => {
    // 리포트 탭(라운드 54 P2-3)과 같은 이유의 한 번 읽기: 앱 루트가 갱신하기 전에 이 화면으로
    // 곧장 들어온 첫 렌더에서도 큐를 읽어 두어야, 고지가 카드보다 한 박자 늦게 나타나지 않는다.
    void refreshOfflineSyncSnapshot();
  }, []);
  const pendingNotice = evaluateExportPendingNotice({
    rows: offlineSyncSnapshot.rows,
    // 세션이 없으면 내보내기 자체가 없다 -- 로그아웃 상태의 잔여 행을 세지 않는다.
    childId: canExport ? childId : null,
    range,
    todaySeoul: getSeoulToday(),
    custom: customRange,
    // 라운드 61 S-4: 위 `rows`를 믿어도 되는가. 저장소를 못 연 부팅에서는 빈 초깃값이라
    // 여기서 세면 0건이 되고, 0건이면 이 고지가 통째로 사라져 파일이 전량인 것처럼 읽힌다.
    storage: offlineSyncSnapshot.storage
  });
  const pendingCount = pendingNotice?.count ?? 0;
  /**
   * 라운드 61 S-4 — 토스트 꼬리표가 같은 사실을 읽도록 숫자와 함께 뽑아 둔다
   * (`pendingUnsendableCount`와 같은 이유 — 매 렌더 새 객체를 의존성에 넣지 않는다).
   */
  const pendingStorage = offlineSyncSnapshot.storage;
  /**
   * 라운드 59 트랙 A 후속 배선 — 그중 **보낼 수 없는**(영구 실패 4xx) 건수.
   *
   * 카드 고지(`pendingNotice.text`)는 이미 두 조각으로 어휘를 가르는데, 토스트 꼬리표만 이 값을
   * 넘기지 않아 같은 기기 상태를 한 화면 안에서 두 말로 부르고 있었다("아직 반영되지 않은 …"
   * 뒤에 붙어야 할 구분 문장이 토스트에서만 빠졌다). 판정·문구는 순수 모듈 한 곳이고
   * (export-pending-notice.ts), 0건이면 두 자리 모두 종전 문장 그대로다.
   *
   * 숫자로 뽑아 두는 이유: `pendingNotice`는 매 렌더 새 객체라 그대로 의존성에 넣으면
   * `runExport`가 렌더마다 새로 만들어진다(pendingCount와 같은 관례).
   */
  const pendingUnsendableCount = pendingNotice?.unsendableCount ?? 0;
  /**
   * 라운드 68 트랙 B(#2) — **이 기기 전량**의 대기 상태. 로그아웃 확인 문구가 읽는 값이다.
   *
   * 왜 이 훅이 들고 나가는가: 설정 화면(app/settings/index.tsx)은 이 컨트롤러를 통해 **이미**
   * 오프라인 스냅숏을 구독하고 있고, 그 화면이 스스로 구독하지 않는 것이 이 모듈의 오랜 계약이다
   * (export-pending-notice.test.ts — "소비 화면(더보기·설정)은 이 배선을 알 필요가 없다").
   * 그래서 구독을 하나 더 만드는 대신, 이미 손에 든 스냅숏에서 **아이·기간 필터를 지나지 않은**
   * 세 값만 그대로 내보낸다. 새 요청 0건이고, 문구 판정은 순수 모듈이 한다(offline/messages.ts).
   *
   * 위 `pendingNotice`와 모집단이 다르다는 점이 요점이다: 그쪽은 "지금 고른 아이 · 지금 고른
   * 기간"을 세고(파일에 빠지는 행), 이쪽은 로그아웃이 실제로 지우는 **모든 아이·모든 기간**을
   * 센다. 두 숫자를 한 값으로 합치면 둘 중 하나가 거짓이 된다.
   */
  const devicePendingRecords: LogoutPendingInput = {
    counts: offlineSyncSnapshot.counts,
    itemStatusRowCount: offlineSyncSnapshot.itemStatusRows.length,
    storage: offlineSyncSnapshot.storage
  };

  const runExport = useCallback(async () => {
    if (!authToken || !childId || busy) return;
    setBusy(true);
    try {
      // CSV-124: API-124 이후 한 요청은 한 페이지(기본 200 · 상한 500건)다. 월별 수집기는 이
      // 페처가 "그 달 전량"을 준다고 전제하므로, 여기서 커서를 끝까지 이어 붙여 그 전제를 지킨다
      // -- 첫 페이지만 담고 조용히 잘린 CSV가 나가는 것을 막는다(expense-page-collector.ts).
      // limit은 서버 상한으로 올려 월 500건 이하 사용자는 종전과 같이 요청 한 번으로 끝난다.
      const collected = await collectExpensesForRange(
        (yearMonth) =>
          collectExpensePages((cursor) =>
            listExpenses(authToken, childId, yearMonth, { limit: EXPENSE_LIST_MAX_LIMIT, cursor })
          ).then((page) => page.expenses),
        range,
        getSeoulToday(),
        // GAP-054 D#11: "직접 선택"이 아니면 무시된다(고정 3구간은 종전과 완전히 같은 경로).
        { custom: customRange }
      );
      if (collected.expenses.length === 0) {
        // GAP-056 #3: 서버에 0건이어도 이 기기에는 대기 행이 있을 수 있다. "기록이 없어요"로
        // 끝내면 방금 오프라인에서 적은 사람에게 그 기록이 사라진 것처럼 읽힌다.
        showToast(
          `선택한 기간에 내보낼 기록이 없어요.${exportPendingToastSuffix(pendingCount, pendingUnsendableCount, pendingStorage)}`,
          "error"
        );
        return;
      }
      const built = buildExpenseCsv(collected.expenses, {
        categoryName: buildCategoryNameLookup(categories.data?.categories)
      });
      const outcome = await shareExpenseCsv(built.csv);
      if (!outcome.shared) return; // user closed the share sheet -- not a success, not an error
      // GAP-056 #9: 잘림 두 갈래는 **잘리는 쪽이 반대**라 따로 싣는다(share-payload.ts 주석).
      // 행 상한 쪽은 최신 달부터 모으므로 오래된 기록이 빠지고, 용량 제한 쪽은 본문을 앞에서부터
      // 채우므로 최근 기록이 빠진다. built.truncated는 수집기가 이미 같은 상수(EXPORT_MAX_ROWS)로
      // 자른 뒤라 실제로는 켜지지 않지만, 켜진다면 그것도 행 상한 갈래다.
      const rowCapTruncated = collected.truncated || built.truncated;
      const truncated = outcome.truncated;
      const sharedRowCount = built.rowCount - outcome.droppedRows;
      // 라운드 45 O-8: Android는 시트를 닫아도 성공으로 resolve된다(share-csv.ts outcomeKnown).
      // 그 플랫폼에서는 "내보냈어요"라고 단정하지 않고 실제로 일어난 일만 적는다.
      // GAP-056 #3: 그 뒤에 "대기 N건은 이 CSV에 아직 반영되지 않았어요"가 붙는다 -- 성공 문장이
      // 대기 건을 덮으면 사용자는 이 파일을 전량으로 믿는다(0건이면 빈 문자열이라 문장이 길어지지
      // 않는다). 라운드 57 QA(P1-2): 문구가 "담기지 않았다"를 단언하지 않는 이유는
      // export-pending-notice.ts 머리말의 "대기 행의 두 종류" 참고.
      // 한 줄로 둔다: 이 호출의 인자 모양(성공 단정이 플랫폼 판정을 거친다는 사실)이 곧
      // src/export-flow.test.ts가 지는 계약이다.
      const shareMessage = csvShareToastMessage({ outcomeKnown: outcome.outcomeKnown, rowCount: sharedRowCount, truncated, rowCapTruncated });
      showToast(`${shareMessage}${exportPendingToastSuffix(pendingCount, pendingUnsendableCount, pendingStorage)}`, "success");
    } catch (error) {
      // CSV-124: 전량을 모으지 못한 경우는 "잠시 후 다시 시도"로 뭉뚱그리면 사용자가 같은 실패를
      // 반복한다. 원인(기록이 너무 많음)과 다음 행동(기간 좁히기)을 그대로 알린다.
      if (error instanceof ExpensePageCollectionError) {
        showToast("기록이 너무 많아 한 번에 내보낼 수 없어요. 기간을 좁혀서 다시 시도해주세요.", "error");
      } else {
        /**
         * GAP-056 #3 — **완전 오프라인**에서 이 흐름은 서버 조회부터 실패한다. 그 자리에서
         * "잠시 후 다시 시도해주세요"는 사실과 어긋난다: 기다릴 대상이 없고, 다시 눌러도 같은
         * 실패로 되돌아온다. 라운드 52 C-07(예산·아이 프로필 저장)이 이미 정한 갈래를 그대로
         * 따른다 -- 온라인 문구는 한 글자도 바꾸지 않고, 오프라인일 때만 messages.ts의 단일
         * 소스 문장으로 갈린다(문구를 여기서 새로 짓지 않는다).
         *
         * 판정은 실패 시점의 폴 한 번이다(app/family/index.tsx의 실패 Alert과 같은 관례).
         * 판정할 수 없는 플랫폼에서는 true라, 어긋나도 기존 문구로 안전하게 떨어진다.
         */
        void isCurrentlyOnline().then((isOnline) => {
          showToast(isOnline ? "내보내기에 실패했어요. 잠시 후 다시 시도해주세요." : OFFLINE_RETRY_NOTICE, "error");
        });
      }
    } finally {
      setBusy(false);
    }
  }, [authToken, busy, categories.data?.categories, childId, customRange, pendingCount, pendingStorage, pendingUnsendableCount, range, showToast]);

  return {
    busy,
    canExport,
    canShiftCustomMonth,
    cardOpen,
    childScopeLabel,
    closeMonthJump,
    customRange,
    devicePendingRecords,
    fileName,
    monthJumpBounds,
    monthJumpEdge,
    pendingNotice,
    range,
    runExport,
    selectCustomMonth,
    setRange: selectRange,
    shiftCustomMonth,
    toast,
    toggleCard,
    toggleMonthJump
  };
}

/**
 * GAP-054 D#11: 시작/끝 달 한 줄. **기록 탭 달 내비와 같은 문법**이다(DSN-053 P2-C) --
 * chevron 26 + 48dp 터치 타깃, 그리고 "더 갈 수 없음"은 색이 아니라 **opacity 0.35**로 말한다
 * (gray300 화살표는 AA 미달이라 그 화면에서 이미 버린 방식이다). 여기서 잠기는 방향이 곧
 * 이 기능의 두 규칙이다: 시작은 끝을 넘지 못하고, 끝은 이번 달을 넘지 못한다.
 *
 * 라운드 67 트랙 C(#5): 그 문법의 **나머지 절반**도 기록 탭과 같아진다 -- 가운데 달 라벨이 곧
 * 월 선택 시트의 입구다(라운드 66 A). 라운드 49 C-09·66 A의 선례대로 <Text>를 Pressable로
 * **감싸기만** 하므로 라벨의 스타일·문자열·자리는 한 글자도 바뀌지 않고, 이 줄은 이미 48dp
 * 화살표 둘이 높이를 잡고 있어 늘어나는 것은 히트 영역뿐이다. **화살표는 그대로 남는다** --
 * 한 칸 옮기기는 스테퍼가 여전히 빠르다(시트는 대안이지 대체가 아니다).
 */
function ExportMonthStepper({
  label,
  edge,
  controller
}: {
  label: string;
  edge: "start" | "end";
  controller: ExpenseCsvExportController;
}) {
  const yearMonth = edge === "start" ? controller.customRange.startYearMonth : controller.customRange.endYearMonth;
  const monthLabel = yearMonthLabel(yearMonth);
  const stepButton = (delta: -1 | 1) => {
    const enabled = controller.canShiftCustomMonth(edge, delta);
    return (
      <Pressable
        accessibilityLabel={`${label} ${delta < 0 ? "이전" : "다음"} 달`}
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        hitSlop={12}
        onPress={() => controller.shiftCustomMonth(edge, delta)}
        style={{
          alignItems: "center",
          justifyContent: "center",
          minHeight: theme.touchTarget,
          minWidth: theme.touchTarget,
          opacity: enabled ? 1 : 0.35
        }}
      >
        <AppIcon color={theme.colors.gray900} name={delta < 0 ? "chevron-left" : "chevron-right"} size={26} />
      </Pressable>
    );
  };
  const monthJumpOpen = controller.monthJumpEdge === edge;
  return (
    <>
      <View style={exportMonthStepperRowStyle}>
        <Text style={exportMonthStepperLabelStyle}>{label}</Text>
        <View style={exportMonthStepperNavStyle}>
          {stepButton(-1)}
          {/* 라벨을 소리에도 실어 준다 -- "2026년 8월"만 들으면 그것이 시작인지 끝인지 알 수 없다.
              라운드 67 트랙 C(#5): 그 문장 뒤에 "달 선택"이 붙고(트리거 라벨의 단일 소스는 순수
              모듈의 monthJumpTriggerAccessibilityLabel이다), 힌트가 **누르기 전에** 무엇이
              열리는지 말한다. 감싸인 <Text>는 라벨을 따로 달지 않는다 -- 접근성 컨테이너가 된
              Pressable이 이미 같은 문장을 읽어 주므로 두 번 읽히지 않게 한다. */}
          <Pressable
            accessibilityHint={MONTH_JUMP_TRIGGER_HINT}
            accessibilityLabel={monthJumpTriggerAccessibilityLabel(`${label} ${monthLabel}`)}
            accessibilityRole="button"
            accessibilityState={{ expanded: monthJumpOpen }}
            hitSlop={8}
            onPress={() => controller.toggleMonthJump(edge)}
            testID={`export-${edge}-month-jump-trigger`}
            style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}
          >
            <Text style={exportMonthValueStyle}>{monthLabel}</Text>
          </Pressable>
          {stepButton(1)}
        </View>
      </View>
      {/* 라운드 67 트랙 C(#5): 기록·리포트 탭과 **같은 시트**다(새 시트를 만들지 않는다). 닫혀
          있으면 아무것도 그리지 않으므로 카드는 종전과 픽셀 하나 다르지 않다. 어느 달을 고를 수
          있는지는 전부 순수 모듈이 정한다 -- 시작은 끝을 넘지 못하고, 끝은 이번 달을 넘지
          못하며, 하한은 이 화면의 10년 상한(CUSTOM_RANGE_MAX_MONTHS)이다. */}
      {monthJumpOpen ? (
        <MonthJumpSheet
          testID={`export-${edge}-month-jump-sheet`}
          selectedYearMonth={yearMonth}
          bounds={controller.monthJumpBounds(edge)}
          hint={EXPORT_MONTH_JUMP_HINT}
          onSelect={(next) => controller.selectCustomMonth(edge, next)}
          onClose={controller.closeMonthJump}
        />
      ) : null}
    </>
  );
}

/** 기간 칩 + 진행 상태를 보여주는 내보내기 버튼. 세션이 없거나 접혀 있으면 아무것도 안 그린다. */
export function ExpenseCsvExportCard({ controller }: { controller: ExpenseCsvExportController }) {
  if (!controller.canExport || !controller.cardOpen) return null;
  return (
    <View style={exportCardStyle()}>
      {/* 라운드 66 트랙 B(#3): 다자녀 계정에서만 붙는 대상 표기(어느 아이의 기록을 내보내는가).
          표시용은 줄표, 소리는 쉼표 -- 라운드 49 C-08이 정한 두 구분자 그대로다. 아이가 하나면
          라벨이 null이라 이 줄은 종전 <Text>내보낼 기간</Text>과 한 글자도 다르지 않다(접근성
          라벨도 undefined = 없는 것과 같다).

          ⚠️ **메뉴 행 제목(EXPORT_MENU_TITLE)에는 붙이지 않는다.** 그 행을 그리는 것은 설정
          화면과 더보기 탭이고 두 화면 모두 이 트랙의 무접촉 대상이다(SET-001 픽셀락 · 공용
          모듈을 부르기만 한다는 계약). 카드가 열려야 보이는 이 제목만으로도 "지금 내보내는
          것이 누구의 기록인가"는 눌리기 전에 읽힌다. */}
      <Text
        accessibilityLabel={
          controller.childScopeLabel
            ? withSpokenChildScopeLabel("내보낼 기간", controller.childScopeLabel)
            : undefined
        }
        style={exportCardTitleStyle}
      >
        {withChildScopeLabel("내보낼 기간", controller.childScopeLabel)}
      </Text>
      <View style={exportChipRowStyle}>
        {EXPORT_RANGE_OPTIONS.map((option) => (
          <CategoryChip
            key={option.value}
            label={option.label}
            selected={controller.range === option.value}
            onPress={() => controller.setRange(option.value)}
          />
        ))}
      </View>
      {/* GAP-054 D#11: 고정 3구간으로는 "작년 11월~올해 1월"(조리원 정산)·"작년 한 해"(연말정산)
          같은 실제로 필요한 기간을 만들 수 없었다 -- 답은 올해(작년이 빠진다) 아니면 전체(10년치를
          받아 엑셀에서 직접 자른다)뿐이었다. **시작/끝 달 두 줄은 "직접 선택" 칩을 고른 동안에만
          열린다** -- 고정 3구간을 쓰던 사람에게는 고를 칩이 하나 늘었을 뿐이다(칩 줄이 flexWrap인
          것도 그래서다: 네 번째 칩이 좁은 기기에서 잘려 나가지 않게).

          라운드 54 P2-8 — 예전 주석은 여기서 "새 컨트롤이 끼어들지 않는다"고 단언했는데, 사실이
          아니다: 같은 티켓이 아래에 **파일 이름 줄**을 더했고 그 줄은 구간과 무관하게 항상 보인다.
          그것은 의도된 추가다(공유되는 것이 파일이 아니라 본문 텍스트라, 무슨 이름으로 저장해야
          하는지가 그 다음 행동에 꼭 필요하다 -- 그 줄의 주석 참고). 조건부로 열리는 것은 위
          두 줄뿐이라는 것이 이 자리의 정확한 사실이다. */}
      {controller.range === "custom" ? (
        <View style={exportCustomRangeStyle}>
          <ExportMonthStepper label="시작 달" edge="start" controller={controller} />
          <ExportMonthStepper label="끝 달" edge="end" controller={controller} />
          <Text style={exportCardNoticeStyle}>{customRangeLabel(controller.customRange)} 기록을 내보내요.</Text>
        </View>
      ) : null}
      {/* 라운드 45 UX-AA(후보 7): 이 흐름은 파일을 만들지 않는다 -- expo-file-system/expo-sharing이
          없어 RN의 Share.share({ message })로 **본문 텍스트**를 보낸다(src/export/share-csv.ts의
          경로 결정 주석). "CSV로 내보내기"만 보고 첨부 파일을 기다리면 아무 파일도 오지 않으므로,
          무엇이 공유되고 어떻게 엑셀에서 여는지를 버튼 앞에서 밝힌다. */}
      <Text style={exportCardNoticeStyle}>{EXPORT_TEXT_SHARE_NOTICE}</Text>
      {/* GAP-056 #3: 동기화 대기 중인 변경은 서버 조회로 만드는 CSV에 반영되지 않는다(생성 대기는
          행이 통째로 빠지고, 수정·삭제 대기는 옛 값이 실린다 -- 라운드 57 QA P1-2). 버튼을
          누르기 전에 그 사실을 말해 두면, 사용자는 지금 내보낼지 동기화를 기다릴지 고를 수 있다.
          대기 0건이면 null이라 카드는 예전과 픽셀 하나 다르지 않다(고지 자체가 없다). */}
      {controller.pendingNotice ? (
        <Text style={exportCardNoticeStyle} testID={EXPORT_PENDING_NOTICE_TEST_ID}>
          {controller.pendingNotice.text}
        </Text>
      ) : null}
      {/* GAP-054 D#11: 위 안내가 시킨 "그 다음 행동"에 필요한 마지막 한 조각 -- 무슨 이름으로
          저장하면 되는지. 고른 기간이 이름 안에 있어 파일만 보고도 무엇인지 알 수 있다. */}
      <Text style={exportCardNoticeStyle}>
        {EXPORT_FILE_NAME_LABEL}: {controller.fileName}
      </Text>
      <SecondaryButton
        label={controller.busy ? "내보내는 중..." : EXPORT_SHARE_BUTTON_LABEL}
        accessibilityLabel={controller.busy ? "내보내는 중" : EXPORT_SHARE_BUTTON_LABEL}
        disabled={controller.busy}
        onPress={() => {
          void controller.runExport();
        }}
      />
    </View>
  );
}

/** 성공 · 잘림 · 실패 결과를 알리는 토스트(A11Y-115: Toast가 스스로 announce한다). */
export function ExpenseCsvExportToast({ controller }: { controller: ExpenseCsvExportController }) {
  if (!controller.toast) return null;
  return <Toast message={controller.toast.message} tone={controller.toast.tone} />;
}

function exportCardStyle() {
  return {
    backgroundColor: theme.colors.white,
    borderColor: "rgba(74, 63, 53, 0.08)",
    borderRadius: MoreSettingsPixelStyles.cardRadius,
    borderWidth: 1,
    gap: 12,
    padding: 14
  } as const;
}

const exportCardTitleStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "700"
} as const;

// 안내 한 줄: 카드 안의 보조 설명이라 본문 회색(gray600) 12px -- 흰 카드 위 대비는 앱 전역
// 규칙과 같다(새 색을 만들지 않는다).
const exportCardNoticeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 18
} as const;

const exportChipRowStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8
} as const;

// GAP-054 D#11: 카드 안에서만 쓰는 두 줄. 새 색·새 라디우스를 만들지 않고 카드가 이미 쓰는
// 토큰(gray600 캡션 · brown 본문 · 48dp 터치 타깃)만 다시 쓴다.
const exportCustomRangeStyle = {
  gap: 4
} as const;

const exportMonthStepperRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const exportMonthStepperLabelStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  fontWeight: "700"
} as const;

const exportMonthStepperNavStyle = {
  alignItems: "center",
  flexDirection: "row"
} as const;

const exportMonthValueStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800",
  minWidth: 96,
  textAlign: "center"
} as const;
