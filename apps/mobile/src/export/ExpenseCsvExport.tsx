import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import { EXPENSE_LIST_MAX_LIMIT, listCategories, listExpenses, LOCAL_SESSION_TOKEN } from "../api/client";
import { buildCategoryNameLookup } from "../categories";
import { collectExpensePages, ExpensePageCollectionError } from "./expense-page-collector";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { MoreSettingsPixelStyles } from "../pixelLock/styles";
import { theme } from "../theme";
import { CategoryChip, SecondaryButton, Toast } from "../ui";
import { buildExpenseCsv } from "./expense-csv";
import { collectExpensesForRange, EXPORT_RANGE_OPTIONS, type ExportRange } from "./export-range";
import { shareExpenseCsv } from "./share-csv";

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
  busy: boolean;
  toast: ExpenseCsvExportToastState | null;
  runExport: () => Promise<void>;
};

/** 비활성(로그아웃) 메뉴 행에 붙이는 캡션 -- 더보기·설정이 같은 문구를 쓴다. */
export const EXPORT_SIGNED_OUT_CAPTION = "로그인 후 이용 가능";
export const EXPORT_MENU_TITLE = "데이터 내보내기(CSV)";

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

  const [cardOpen, setCardOpen] = useState(false);
  const [range, setRange] = useState<ExportRange>("month");
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
        getSeoulToday()
      );
      if (collected.expenses.length === 0) {
        showToast("선택한 기간에 내보낼 기록이 없어요.", "error");
        return;
      }
      const built = buildExpenseCsv(collected.expenses, {
        categoryName: buildCategoryNameLookup(categories.data?.categories)
      });
      const outcome = await shareExpenseCsv(built.csv);
      if (!outcome.shared) return; // user closed the share sheet -- not a success, not an error
      const truncated = collected.truncated || built.truncated || outcome.truncated;
      const sharedRowCount = built.rowCount - outcome.droppedRows;
      showToast(
        truncated
          ? `기록 ${sharedRowCount}건을 내보냈어요. (용량 제한으로 일부만 포함됐어요)`
          : `기록 ${sharedRowCount}건을 내보냈어요.`,
        "success"
      );
    } catch (error) {
      // CSV-124: 전량을 모으지 못한 경우는 "잠시 후 다시 시도"로 뭉뚱그리면 사용자가 같은 실패를
      // 반복한다. 원인(기록이 너무 많음)과 다음 행동(기간 좁히기)을 그대로 알린다.
      showToast(
        error instanceof ExpensePageCollectionError
          ? "기록이 너무 많아 한 번에 내보낼 수 없어요. 기간을 좁혀서 다시 시도해주세요."
          : "내보내기에 실패했어요. 잠시 후 다시 시도해주세요.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }, [authToken, busy, categories.data?.categories, childId, range, showToast]);

  return { busy, canExport, cardOpen, range, runExport, setRange, toast, toggleCard };
}

/** 기간 칩 3개 + 진행 상태를 보여주는 내보내기 버튼. 세션이 없거나 접혀 있으면 아무것도 안 그린다. */
export function ExpenseCsvExportCard({ controller }: { controller: ExpenseCsvExportController }) {
  if (!controller.canExport || !controller.cardOpen) return null;
  return (
    <View style={exportCardStyle()}>
      <Text style={exportCardTitleStyle}>내보낼 기간</Text>
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
      <SecondaryButton
        label={controller.busy ? "내보내는 중..." : "CSV로 내보내기"}
        accessibilityLabel={controller.busy ? "내보내는 중" : "CSV로 내보내기"}
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

const exportChipRowStyle = {
  flexDirection: "row",
  gap: 8
} as const;
