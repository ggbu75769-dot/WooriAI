import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { ListRenderItemInfo, ViewStyle } from "react-native";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { getSeoulToday } from "@wooriai/domain";
import {
  confirmImport,
  getImportJob,
  listCategories,
  listImportRows,
  LOCAL_SESSION_TOKEN,
  updateImportRow,
  type Child,
  type ConfirmImportResponse,
  type ImportJob,
  type ImportRow
} from "../../src/api/client";
// 라운드 65 A(#2): 검수 화면이 내미는 분류 목록은 **지출 수정 화면과 같은 모듈**을 지난다 --
// 퀵타일 별칭·가져오기 스텁·노출 제외 분류를 화면마다 다시 걸러 내지 않는다(CAT-124).
import { selectableCategories } from "../../src/categories";
import {
  importLandingMonthNotice,
  resolveImportLandingMonth,
  RECORDS_MONTH_PARAM
} from "../../src/expenses/import-landing-month";
// 라운드 71 리뷰 M-1: 잠긴 세션의 머리말 문장은 화면이 짓지 않는다 — 여섯 화면의 단일 소스가
// src/family/record-permissions.ts의 VIEW_ONLY_HEADLINES 표다(트랙 E가 세우고 A가 읽어 쓴다).
import { VIEW_ONLY_HEADLINES } from "../../src/family/record-permissions";
import { explainExpenseViewOnly, useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import {
  canConfirmImport,
  canStartImportBulkRun,
  canToggleImportRow,
  cancelImportBulkRun,
  claimImportBulkRun,
  isImportBulkRunActive,
  runImportBulkSelection,
  subscribeImportBulkRuns,
  IMPORT_BULK_CANCEL_A11Y_LABEL,
  IMPORT_BULK_CANCEL_LABEL,
  IMPORT_BULK_CANCELLED_TEXT,
  IMPORT_BULK_CLAIM_BUSY_TEXT,
  IMPORT_BULK_PARTIAL_FAILURE_TEXT,
  IMPORT_CONFIRM_PENDING_TEXT,
  type ImportBulkRunHandle,
  type ImportBulkRunOutcome
} from "../../src/import/bulk-run";
// 라운드 71 트랙 A: 행 편집·확정 실패는 조회 실패가 아니다 — 문구·판정은 이 순수 모듈 한 곳에서 온다.
import { importFailureMessage } from "../../src/import/import-failure-messages";
import { shouldForgetImportResume, shouldMarkImportResumeConfirmed } from "../../src/import/import-resume";
// 라운드 72 트랙 E: 실패 시점 연결 판정은 공용 배선 한 벌에서 온다(손으로 다시 적지 않는다).
import { useErrorTimeConnectivity } from "../../src/offline/use-load-error-copy";
import {
  attentionFilterChipLabel,
  buildImportBulkSelectionPlan,
  canEditImportRowCategory,
  confirmableSelectedRowIds,
  countImportRowsNeedingAttention,
  countUnappliedReviewedRows,
  filterImportRows,
  importBulkProgressLabel,
  importBulkSelectionLabel,
  importCategoryNameResolver,
  importRowBadge,
  importRowCategoryA11ySuffix,
  importRowCategoryEditLabel,
  importRowCategoryView,
  importRowDisplay,
  importRowNotice,
  importStubCategoryPredicate,
  isImportRowSelectable,
  rollbackImportRowSelection,
  setImportRowSelection,
  shouldPatchImportRowCategory,
  shouldShowAttentionFilter,
  toggleImportRowSelection,
  IMPORT_ATTENTION_FILTER_EMPTY_TEXT,
  IMPORT_ROW_CATEGORY_LABEL,
  IMPORT_ROW_CATEGORY_STUB_HINT,
  IMPORT_ROW_LOCKED_A11Y_PREFIX,
  IMPORT_ROW_LOCKED_MESSAGE,
  IMPORT_TARGET_CHILD_LABEL,
  importTargetChildNotice,
  resolveImportTargetChildName,
  type ImportCategoryOption,
  type ImportRowCategoryView,
  type ImportRowFilter
} from "../../src/import/preview-rows";
import { useImportResumeStore } from "../../src/stores/import-resume.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  Card,
  CategoryChip,
  EmptyStateCard,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  StatusBadge
} from "../../src/ui";

/**
 * 확정 요청에 실을 행 id. 판정 자체(확정 가능 + 선택됨)는 순수 모듈이 갖고 있다 --
 * 서버가 `validationStatus !== "valid"`인 행을 어차피 건너뛰므로(import-pipeline.service.ts:233)
 * 화면이 그런 id를 실어 보낼 이유가 없다.
 */
const selectedRowIds = (rows: ImportRow[]) => confirmableSelectedRowIds(rows);

type ImportRowsResponse = { rows: ImportRow[] };

const statusCopy: Record<ImportJob["status"], { label: string; tone: "neutral" | "success" | "warning" }> = {
  uploaded: { label: "업로드 완료 · 분석 대기 중", tone: "neutral" },
  analyzing: { label: "분석 진행 중이에요", tone: "warning" },
  preview_ready: { label: "검수 대기 중이에요", tone: "warning" },
  confirmed: { label: "가져오기 완료", tone: "success" },
  failed: { label: "분석에 실패했어요", tone: "warning" },
  cancelled: { label: "가져오기가 취소됐어요", tone: "neutral" }
};

/**
 * **조회** 실패 전용 문구다(잡 조회 · 행 목록 조회 두 자리).
 *
 * 라운드 71 트랙 A: 종전에는 이 한 문자열이 **네 자리**에 섰다 — 위 둘에 더해 행 체크·분류
 * 편집 실패와 최종 확정 실패까지. 뒤의 둘은 "불러오지" 못한 것이 아니라 **저장하지 못한
 * 것**이라 동사부터 틀렸고, 그 자리에는 [다시 시도]도 없었다. 이제 그 둘은
 * `importFailureMessage`(src/import/import-failure-messages.ts)를 지난다. 여기 남은 두 자리는
 * 실제로 [다시 시도]가 통하는 조회 실패이고, 그 오프라인 인지 배선은 목록 파일
 * (`src/offline/offline-aware-screens.ts`)을 여는 다른 라운드의 몫이다(P3).
 */
const loadFailedText = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

// UX-S: 이 화면의 스크롤러는 FlatList 자체다(아래 주석 참고) -- 웹에서 스크롤바만 감추는
// 기록 탭과 같은 스타일을 그대로 쓴다.
const webScrollHiddenStyle = {
  msOverflowStyle: "none",
  scrollbarWidth: "none"
} as unknown as ViewStyle;

type ImportRowToggleHandler = (row: ImportRow) => void;
type ImportRowCategoryExpandHandler = (rowId: string) => void;
type ImportRowCategorySelectHandler = (row: ImportRow, categoryId: string) => void;

/**
 * FlatList 한 항목. 행 memo가 깨지지 않도록 **이미 계산된 값**(또는 렌더마다 같은 참조)만
 * 담는다.
 *
 * 라운드 65 A(#2): 분류 줄은 여기서 미리 계산하지 **않는다** -- `importRowCategoryView`가
 * 돌려주는 객체는 매번 새 참조라, 여기 담으면 어느 행 하나가 바뀔 때마다 2,000행 전부의 memo가
 * 깨진다. 대신 목록·해석 함수(둘 다 useMemo로 안정된 참조)를 넘기고 계산은 행 안에서 한다 --
 * 값은 같고 참조만 안정된다.
 */
type ImportRowListItem = {
  row: ImportRow;
  disabled: boolean;
  onToggle: ImportRowToggleHandler;
  /** `selectableCategories`를 지난 목록(= 지출 수정 화면의 칩과 같은 목록). */
  categoryOptions: readonly ImportCategoryOption[];
  /** 목록에 없는 id의 이름 해석. 모르면 null을 돌려주고, 그러면 분류 줄 자체가 사라진다. */
  resolveCategoryName: (categoryId: string) => string | null;
  /** 라운드 65 후속(#8): "가져오기 스텁인가"를 서버 `code`로 답하는 술어. */
  isImportStubCategory: (categoryId: string) => boolean;
  categoryExpanded: boolean;
  onExpandCategory: ImportRowCategoryExpandHandler;
  onSelectCategory: ImportRowCategorySelectHandler;
};

/** 행 카드의 분류 줄 + (편집 가능할 때) 칩 목록. 새 픽커를 만들지 않고 CategoryChip을 쓴다. */
function ImportRowCategoryBlock({
  row,
  category,
  options,
  editable,
  expanded,
  onExpand,
  onSelect
}: {
  row: ImportRow;
  category: ImportRowCategoryView;
  options: readonly ImportCategoryOption[];
  editable: boolean;
  expanded: boolean;
  onExpand: ImportRowCategoryExpandHandler;
  onSelect: ImportRowCategorySelectHandler;
}) {
  const handleExpand = useCallback(() => onExpand(row.id), [onExpand, row.id]);

  return (
    <View style={{ gap: 6 }}>
      <View style={summaryRowStyle}>
        <Text style={summaryLabelStyle}>{IMPORT_ROW_CATEGORY_LABEL}</Text>
        <Text style={summaryValueStyle}>{category.name}</Text>
      </View>
      {/* 스텁 분류(자동 분류 실패)로 떨어진 행만 이 한 줄을 받는다 -- 승인 전에 보이게 하는 것이
          이 라운드의 요점이다. */}
      {category.needsChoice ? <Text style={rowNoticeStyle}>{IMPORT_ROW_CATEGORY_STUB_HINT}</Text> : null}
      {editable ? (
        <View style={{ gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={importRowCategoryEditLabel(expanded)}
            accessibilityState={{ expanded }}
            hitSlop={8}
            onPress={handleExpand}
          >
            <Text style={rowCategoryEditStyle}>{importRowCategoryEditLabel(expanded)}</Text>
          </Pressable>
          {/* PERF: 칩은 **펼친 행에만** 마운트한다 -- 2,000행 상한에서 행마다 12개 칩을 항상
              그리면 가상화가 아끼려던 것을 그대로 다시 쓴다. */}
          {expanded ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {options.map((option) => (
                <CategoryChip
                  key={option.id}
                  label={option.label}
                  selected={option.id === row.categoryId}
                  onPress={() => onSelect(row, option.id)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * 정말로 확정 불가한 행. 체크박스를 그리지 않는 이유:
 * 서버는 `validationStatus !== "valid"`인 행의 `selected`를 무조건 false로 되돌린다
 * (apps/api/src/onboarding/import-pipeline.service.ts:192). 예전 화면은 그 행도 똑같은
 * 체크박스로 그려서, 눌러도 아무 일이 없는 **침묵하는 컨트롤**이 2,000행짜리 목록 안에 섞여
 * 있었다. 이제는 누를 수 있는 척을 하지 않고, 서버 규칙을 화면이 문장으로 말한다.
 *
 * 라운드 41 K-1: 이 카드는 이제 `importRowSelectability(row) === "locked"`인 행에만 쓴다.
 * 체크 한 번이면 valid가 되는 **검토 가능** 행(duplicate_candidate / low_confidence_...)은
 * 아래 선택 가능 카드로 간다 -- 여기에 두면 가져올 방법 자체가 사라지고, 아래 안내문("원본
 * 파일에서 고친 뒤 다시 올려 주세요")까지 거짓이 된다(다시 올려도 판정은 같다).
 */
const LockedImportRowCard = memo(function LockedImportRowCard({
  row,
  categoryOptions,
  resolveCategoryName,
  isImportStubCategory
}: {
  row: ImportRow;
  categoryOptions: readonly ImportCategoryOption[];
  resolveCategoryName: (categoryId: string) => string | null;
  isImportStubCategory: (categoryId: string) => boolean;
}) {
  const display = importRowDisplay(row);
  const badge = importRowBadge(row);
  /**
   * 라운드 65 A(#2): 잠긴 행도 **분류는 보여 준다**(고치지는 못한다 -- 분류를 바꿔도 이 행이
   * 잠긴 이유는 그대로다). 이 카드는 `accessible` 한 덩어리라 자식 텍스트가 따로 읽히지
   * 않으므로, 분류는 라벨 문자열에도 함께 실어야 스크린리더에 들린다.
   */
  const category = importRowCategoryView(row, categoryOptions, resolveCategoryName, isImportStubCategory);

  return (
    <View
      accessible
      accessibilityLabel={`${IMPORT_ROW_LOCKED_A11Y_PREFIX}, ${display.title}, ${display.amountText}, ${display.dateText}${importRowCategoryA11ySuffix(category)}, ${IMPORT_ROW_LOCKED_MESSAGE}`}
      style={rowCardLockedStyle}
    >
      <View style={rowHeaderStyle}>
        <View style={lockMarkStyle}>
          <Text accessible={false} style={lockMarkTextStyle}>🔒</Text>
        </View>
        <Text style={rowTitleStyle}>{display.title}</Text>
      </View>
      <Text style={rowAmountStyle}>{display.amountText}</Text>
      <Text style={rowDateStyle}>{display.dateText}</Text>
      {category ? (
        <View style={summaryRowStyle}>
          <Text style={summaryLabelStyle}>{IMPORT_ROW_CATEGORY_LABEL}</Text>
          <Text style={summaryValueStyle}>{category.name}</Text>
        </View>
      ) : null}
      {badge ? <StatusBadge label={badge.label} tone={badge.tone} /> : null}
      <Text style={rowNoticeStyle}>{IMPORT_ROW_LOCKED_MESSAGE}</Text>
    </View>
  );
});

function ImportRowCard({
  row,
  disabled,
  onToggle,
  categoryOptions,
  resolveCategoryName,
  isImportStubCategory,
  categoryExpanded,
  onExpandCategory,
  onSelectCategory
}: {
  row: ImportRow;
  disabled: boolean;
  onToggle: ImportRowToggleHandler;
  categoryOptions: readonly ImportCategoryOption[];
  resolveCategoryName: (categoryId: string) => string | null;
  isImportStubCategory: (categoryId: string) => boolean;
  categoryExpanded: boolean;
  onExpandCategory: ImportRowCategoryExpandHandler;
  onSelectCategory: ImportRowCategorySelectHandler;
}) {
  const display = importRowDisplay(row);
  const badge = importRowBadge(row);
  // K-1: 검토 가능 행이면 "체크 = 확인 완료"라는 사실을 한 줄로 말한다(valid 행에는 null).
  const notice = importRowNotice(row);
  const handlePress = useCallback(() => onToggle(row), [onToggle, row]);
  const category = importRowCategoryView(row, categoryOptions, resolveCategoryName, isImportStubCategory);
  // 목록을 아직 못 받았으면 고를 것이 없다(빈 칩 줄을 그리지 않는다). 편집을 받지 않는 상태
  // (확정 완료·일괄 실행 중·이 행 반영 중)는 체크박스와 같은 판정 하나를 그대로 쓴다.
  const categoryEditable = !disabled && canEditImportRowCategory(row) && categoryOptions.length > 0;

  /**
   * 라운드 65 A(#2): 체크박스 영역과 분류 영역을 **형제**로 나눈다. 예전에는 카드 자체가
   * 체크박스 Pressable이었는데, 그 안에 칩을 넣으면 ⓐ 칩 탭이 체크 토글과 겹치고 ⓑ
   * `accessible`한 체크박스가 자식을 삼켜 칩이 스크린리더에 닿지 않는다. 카드의 테두리·여백은
   * 바깥 View가 그대로 물려받아 렌더는 종전과 같고(IMP-003 픽셀락은 비세션 업로드 화면
   * app/import/index.tsx라 이 화면은 캡처 밖이다), 체크 영역이 곧 터치 타깃인 것도 그대로다.
   */
  return (
    <View style={[rowCardStyle, row.selected ? rowCardSelectedStyle : null, disabled ? rowCardDisabledStyle : null]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.selected, disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={rowCardMainStyle}
      >
        <View style={rowHeaderStyle}>
          <View style={checkboxStyle(row.selected)}>{row.selected ? <Text style={checkmarkStyle}>✓</Text> : null}</View>
          <Text style={rowTitleStyle}>{display.title}</Text>
        </View>
        <Text style={rowAmountStyle}>{display.amountText}</Text>
        {/* UX-S: 같은 품목·같은 금액이 여러 줄인 파일(정기 구매)에서 어떤 줄인지 구분하려면 날짜가
            있어야 한다. */}
        <Text style={rowDateStyle}>{display.dateText}</Text>
        {badge ? <StatusBadge label={badge.label} tone={badge.tone} /> : null}
        {notice ? <Text style={rowNoticeStyle}>{notice}</Text> : null}
      </Pressable>
      {category ? (
        <ImportRowCategoryBlock
          row={row}
          category={category}
          options={categoryOptions}
          editable={categoryEditable}
          expanded={categoryExpanded}
          onExpand={onExpandCategory}
          onSelect={onSelectCategory}
        />
      ) : null}
    </View>
  );
}

// PERF: 행은 memo로 감싼다 -- 2,000행 상한에서 한 행을 체크할 때마다 전 행이 다시 그려지면
// 가상화의 이점이 사라진다(기록 탭 ServerExpenseListRow와 같은 관례).
const SelectableImportRowCard = memo(ImportRowCard);

// 모듈 스코프 renderItem / keyExtractor / 구분자 -- 화면이 리렌더돼도 FlatList가 받는 prop
// 참조가 그대로다(기록 탭과 같은 관례).
function renderImportRow({ item }: ListRenderItemInfo<ImportRowListItem>) {
  return isImportRowSelectable(item.row) ? (
    <SelectableImportRowCard
      row={item.row}
      disabled={item.disabled}
      onToggle={item.onToggle}
      categoryOptions={item.categoryOptions}
      resolveCategoryName={item.resolveCategoryName}
      isImportStubCategory={item.isImportStubCategory}
      categoryExpanded={item.categoryExpanded}
      onExpandCategory={item.onExpandCategory}
      onSelectCategory={item.onSelectCategory}
    />
  ) : (
    <LockedImportRowCard
      row={item.row}
      categoryOptions={item.categoryOptions}
      resolveCategoryName={item.resolveCategoryName}
      isImportStubCategory={item.isImportStubCategory}
    />
  );
}

function importRowKey(item: ImportRowListItem) {
  return item.row.id;
}

function ImportRowSeparator() {
  return <View style={{ height: theme.spacing.gap }} />;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={filterChipStyle(selected)}
    >
      <Text style={{ color: selected ? theme.colors.white : theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CompletionSummaryCard({
  summary,
  landingNotice,
  onDone
}: {
  summary: { importedCount: number; skippedCount: number };
  /**
   * 라운드 51 C-#11: 버튼이 **이번 달이 아닌 달**로 데려갈 때만 붙는 한 줄
   * (importLandingMonthNotice). 이번 달로 가는 경우에는 null이라 카드가 종전과 똑같다.
   */
  landingNotice: string | null;
  onDone: () => void;
}) {
  return (
    <Card style={{ gap: 12 }}>
      <Text style={summaryTitleStyle}>가져오기를 완료했어요</Text>
      <View style={summaryRowStyle}>
        <Text style={summaryLabelStyle}>가져온 항목</Text>
        <Text style={summaryValueStyle}>{summary.importedCount}건</Text>
      </View>
      <View style={summaryRowStyle}>
        <Text style={summaryLabelStyle}>제외한 항목</Text>
        <Text style={summaryValueStyle}>{summary.skippedCount}건</Text>
      </View>
      {landingNotice ? <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{landingNotice}</Text> : null}
      <PrimaryButton label="가계부에서 확인하기" onPress={onDone} />
    </Card>
  );
}

export default function ImportPreviewScreen() {
  const params = useLocalSearchParams<{ importJobId?: string }>();
  const importJobId = String(params.importJobId ?? "");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const queryClient = useQueryClient();
  // 라운드 40 J-6: CSV 임포트 확정도 결국 지출을 만드는 동작이라 다른 진입점과 같은 판정을
  // 쓴다(잠금은 실세션 + 보기 전용 역할에서만 참이므로 비세션 IMP-003 렌더는 불변이다).
  const expenseGate = useExpenseEntryGate();
  const [completionSummary, setCompletionSummary] = useState<ConfirmImportResponse | null>(null);
  const [rowFilter, setRowFilter] = useState<ImportRowFilter>("all");
  const [pendingRowIds, setPendingRowIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkOutcome, setBulkOutcome] = useState<ImportBulkRunOutcome | null>(null);
  /**
   * 라운드 42 L-4: 직전 루프가 아직 등록부에서 내려오지 않아 실행권을 못 받은 상태. 예전에는
   * 그냥 return이라 버튼을 눌러도 아무 일도, 아무 말도 없었다(고장과 구분되지 않았다).
   */
  const [bulkClaimBlocked, setBulkClaimBlocked] = useState(false);
  /**
   * 라운드 65 A(#2): 분류 칩을 펼쳐 둔 행. **한 번에 하나만** 펼친다 -- 2,000행 목록에서 모든
   * 행이 칩 12개를 항상 들고 있으면 가상화가 아끼려던 것을 그대로 다시 쓴다.
   */
  const [expandedCategoryRowId, setExpandedCategoryRowId] = useState<string | null>(null);
  const rowsQueryKey = useMemo(() => ["import-rows", importJobId] as const, [importJobId]);

  /**
   * 라운드 41 K-6: 순차 PATCH 루프의 취소 토큰과 마운트 표식.
   *
   * 루프는 최대 2,000건이라 화면보다 오래 살 수 있었다 -- 이탈 후에도 고아 루프가 계속 PATCH를
   * 보내고 캐시에 썼고, 다시 들어와 버튼을 누르면 두 루프가 같은 행을 반대 방향으로 뒤집었다.
   * 규칙 자체는 순수 모듈(src/import/bulk-run.ts)에 있고, 여기서는 그 핸들을 붙잡아 둔다.
   */
  const bulkRunRef = useRef<ImportBulkRunHandle | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      bulkRunRef.current?.cancel();
      // 핸들을 아직 못 잡은 사이(claim 직전)에 언마운트되는 경우까지 덮는다.
      cancelImportBulkRun(importJobId);
    };
  }, [importJobId]);

  // 화면을 벗어나면(blur) 진행 중인 일괄 반영을 멈춘다 -- 사용자가 이미 떠난 화면의 상태를
  // 계속 서버에 쓰지 않는다. cleanup은 blur와 언마운트 양쪽에서 돈다.
  useFocusEffect(
    useCallback(() => {
      return () => {
        bulkRunRef.current?.cancel();
      };
    }, [])
  );

  const job = useQuery({
    queryKey: ["import-job", importJobId],
    enabled: Boolean(authToken && importJobId),
    queryFn: () => getImportJob(authToken!, importJobId),
    refetchInterval: (query) => (query.state.data?.status === "analyzing" ? 1500 : false)
  });
  const rows = useQuery({
    queryKey: rowsQueryKey,
    enabled: Boolean(authToken && importJobId && job.data?.status !== "analyzing"),
    queryFn: () => listImportRows(authToken!, importJobId)
  });

  /**
   * 라운드 65 A(#2) — 분류 이름 해석과 칩 목록의 원천.
   *
   * 리포트·기록 탭과 **같은 공유 캐시**(`["categories"]`)를 쓴다: 이미 채워져 있으면 요청 없이
   * 그 값을 그대로 읽고, 비어 있으면 여기서 한 번 채운다. `getQueryData` 읽기만으로 두지 않는
   * 이유는 이 화면이 값을 **고치는** 화면이기 때문이다 -- 더보기 > 가져오기로 곧장 들어온
   * 사용자(캐시가 빈 흔한 경로)에게 칩 줄이 통째로 사라지면 이 라운드가 여는 길이 닫힌다.
   *
   * CAT-124: includeAll=1 -- 같은 응답 하나가 칩 목록(selectableCategories로 좁힘)과 스텁·별칭
   * id의 이름 해석을 동시에 먹인다(기록 탭과 같은 규약, src/categories-cache-contract.test.ts).
   * 비세션(IMP-003 캡처 경로)에서는 authToken이 없어 요청 자체가 없다.
   */
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken),
    staleTime: 5 * 60 * 1000,
    queryFn: () => listCategories(authToken!, { includeAll: true })
  });
  const serverCategories = categories.data?.categories;
  // 지출 수정 화면과 같은 필터를 지난 목록 = 화면이 **내밀어도 되는** 분류만. 여기서는 행의
  // 현재 값을 넘기지 않는다: 스텁("가져오기 기본")을 칩으로 되살려 다시 고르게 하면, 이 라운드가
  // 없애려는 바로 그 상태를 사용자가 손으로 만들 수 있게 된다.
  const categoryOptions = useMemo<ImportCategoryOption[]>(
    () => selectableCategories(serverCategories ?? []).map((category) => ({ id: category.id, label: category.name })),
    [serverCategories]
  );
  const resolveCategoryName = useMemo(() => importCategoryNameResolver(serverCategories), [serverCategories]);
  /**
   * 라운드 65 후속(#8): "자동으로 분류하지 못했어요 · 분류를 골라 주세요"를 붙일 근거.
   *
   * 종전 판정은 "칩 목록에 없으면 스텁"이었는데, 그 목록은 별칭·비활성 행을 걸러 낸 **좁힌**
   * 목록이라(`selectableCategories`) 멀쩡히 분류된 행에도 재촉이 붙을 수 있었다. 근거를 서버가
   * 준 `code`(`import_stub_default`)로 바꾼다 -- 같은 `includeAll=1` 응답 안에 이미 있는 값이라
   * 새 요청은 0건이다.
   */
  const isImportStubCategory = useMemo(() => importStubCategoryPredicate(serverCategories), [serverCategories]);

  /**
   * UX-S: 검수 화면이 **어느 아이의 가계부**에 쓰는지 한 줄로 밝힌다.
   *
   * 가져오기 작업은 `POST /children/:childId/imports/excel`로 만들어지므로 특정 아이에 묶이는데,
   * 이 화면에는 그 이름이 어디에도 없어서 다자녀 가구에서 아이를 바꾼 뒤 예전 링크로 돌아오면
   * 엉뚱한 아이에게 수백 건을 확정할 수 있었다.
   *
   * 라운드 41 K-2: 기준은 **`job.childId`**다(서버 응답에 새로 실린 필드). 예전에는 선택 아이
   * 스토어 값을 그대로 "대상 아이"라고 단언했는데, 서버가 지출을 붙이는 곳은 잡에 박힌
   * `job.childId`다 -- 아이를 바꾼 뒤 예전 검수 링크로 돌아오면 헤더가 **틀린 이름**을 확신에 차서
   * 보여 줬다. 이제 그 두 값이 갈릴 수가 없다.
   *
   * `["children"]` 캐시를 **읽기만** 한다(useQuery가 아니라 getQueryData -- 이 화면 때문에 새로
   * 도는 요청은 0). 캐시가 없으면 순수 모듈이 null을 돌려주고 줄 자체가 사라진다(허위 표시 금지).
   */
  const cachedChildren = queryClient.getQueryData<{ children: Child[] }>(["children"])?.children;
  const targetChildName = resolveImportTargetChildName(job.data?.childId, cachedChildren);
  /**
   * 라운드 42 L-6: 잡에는 아이가 박혀 있는데(childId) 그 이름을 이 기기가 모를 때 -- 캐시가 아직
   * 없거나, 목록에 없는 아이다. 예전에는 줄이 그냥 사라져 화면이 **대상 아이를 밝히지 않은 채**
   * 확정을 열어 뒀다(K-2가 겨냥한 그 자리다). 이름을 지어내지 않고 모른다는 사실만 말한다.
   * 확정은 막지 않는다: 서버가 지출을 넣는 곳은 어차피 job.childId이고, 캐시가 비었다는 이유로
   * 정상적인 가져오기를 잠그는 쪽이 더 나쁘다. 비세션에서는 job.data가 없어 null이다(IMP-003 불변).
   */
  const targetChildNotice = importTargetChildNotice(job.data?.childId, cachedChildren);

  const toggleRow = useMutation({
    mutationFn: (row: ImportRow) =>
      updateImportRow(authToken!, importJobId, row.id, {
        selected: !row.selected,
        categoryId: row.categoryId,
        parsedItemName: row.parsedItemName,
        parsedAmountKrw: row.parsedAmountKrw
      }),
    // 낙관적 갱신: 캐시의 그 행만 뒤집는다. 예전에는 PATCH가 끝나야 화면이 바뀌었고, 그동안
    // `toggleRow.isPending`이 **전 행을 잠갔다** -- 2,000행짜리 목록에서 체크 한 번마다 목록
    // 전체가 굳었다.
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: rowsQueryKey });
      const snapshot = queryClient.getQueryData<ImportRowsResponse>(rowsQueryKey);
      setPendingRowIds((ids) => {
        const next = new Set(ids);
        next.add(row.id);
        return next;
      });
      queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
        current ? { rows: toggleImportRowSelection(current.rows, row.id) as ImportRow[] } : current
      );
      return { snapshot };
    },
    // 성공하면 **서버가 돌려준 행**을 그대로 캐시에 꽂는다 -- 전체 재조회가 사라지고, 서버가
    // selected를 되돌린 경우에도 화면이 즉시 진실을 보여 준다.
    onSuccess: (updated) => {
      queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
        current ? { rows: current.rows.map((row) => (row.id === updated.id ? updated : row)) } : current
      );
    },
    // 실패하면 그 행만 원래대로 되돌린다(스냅샷 통째로 덮으면 그 사이 성공한 다른 행까지 지워진다).
    // 라운드 71 트랙 A / 72 트랙 E: **롤백 동작은 한 줄도 바뀌지 않는다.** 종전에 이 자리에 함께
    // 있던 연결 상태 폴은 공용 배선(useErrorTimeConnectivity)으로 옮겨 갔다 — 아래 참고.
    onError: (_error, row, context) => {
      const snapshot = context?.snapshot;
      if (!snapshot) return;
      queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
        current ? { rows: rollbackImportRowSelection(current.rows, row.id, snapshot.rows) as ImportRow[] } : current
      );
    },
    onSettled: (_data, _error, row) => {
      setPendingRowIds((ids) => {
        if (!ids.has(row.id)) return ids;
        const next = new Set(ids);
        next.delete(row.id);
        return next;
      });
    }
  });
  /**
   * 라운드 65 A(#2) — 분류 편집 PATCH.
   *
   * 서버는 이 필드를 진작부터 받고 있었다(`UpdateImportRowDto.categoryId`). 보내는 것은
   * `categoryId` **하나뿐**이다 -- 나머지 필드는 서버가 현재 값과 병합하므로(같은 서비스의
   * merge 규칙) 화면이 읽은 값을 되돌려 실을 이유가 없다.
   *
   * 낙관적 갱신을 하지 않는 이유: 이 PATCH는 `userReviewed`를 세우며 `validationStatus`까지
   * 다시 계산한다(검토 가능 행이 valid로 바뀐다). 그 결과를 화면이 미리 흉내 내면 L-2가 닫아 둔
   * "체크는 켜졌는데 서버는 모르는" 창이 분류 쪽에 새로 열린다. 대신 그 행만 `pendingRowIds`로
   * 잠그고(확정 버튼도 같은 값을 본다) 서버가 돌려준 행을 그대로 캐시에 꽂는다.
   */
  const updateCategory = useMutation({
    mutationFn: ({ row, categoryId }: { row: ImportRow; categoryId: string }) =>
      updateImportRow(authToken!, importJobId, row.id, { categoryId }),
    onMutate: async ({ row }) => {
      // 라운드 65 후속(#5): 진행 중인 목록 재조회를 먼저 세운다 — `toggleRow.onMutate`와 같은
      // 한 줄이다. onSuccess가 서버가 돌려준 행을 캐시에 꽂는데, 그 사이 날아가던 refetch가
      // 뒤늦게 착지하면 **분류를 고르기 전의 행**으로 되돌아간다(사용자가 고른 값이 조용히
      // 사라지고, 잠금이 풀린 뒤에야 보인다).
      await queryClient.cancelQueries({ queryKey: rowsQueryKey });
      setPendingRowIds((ids) => {
        const next = new Set(ids);
        next.add(row.id);
        return next;
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) =>
        current ? { rows: current.rows.map((row) => (row.id === updated.id ? updated : row)) } : current
      );
    },
    // 라운드 71 트랙 A: 캐시는 손대지 않는다(이 뮤테이션은 낙관 갱신을 하지 않으므로 되돌릴
    // 것이 없다). 라운드 72 트랙 E: 실패 뒤에 설 문장을 고르기 위한 연결 판정은 공용 배선이
    // 지므로 이 자리에는 남길 일이 없다 — `onError` 갈래 자체가 사라졌다.
    onSettled: (_data, _error, { row }) => {
      setPendingRowIds((ids) => {
        if (!ids.has(row.id)) return ids;
        const next = new Set(ids);
        next.delete(row.id);
        return next;
      });
    }
  });

  /**
   * 라운드 51 C-#11 — 확정한 행들의 **대표 월**(YYYY-MM). 없으면 null.
   *
   * ref인 이유: 값을 정할 수 있는 유일한 시점이 확정 요청을 만드는 자리(= 어떤 행을 보내는지
   * 아는 유일한 자리)이고, 읽는 곳은 그 뒤의 onSuccess다. state로 두면 그 사이 렌더를 기다려야
   * 한다. 화면에 그리는 값은 onSuccess에서 state로 옮긴다.
   */
  const landingMonthRef = useRef<string | null>(null);
  const [landingMonth, setLandingMonth] = useState<string | null>(null);
  const confirm = useMutation({
    mutationFn: () => {
      const rowList = rows.data?.rows ?? [];
      const confirmedIds = selectedRowIds(rowList);
      // 실제로 가져가는 행만 본다 -- 확정에서 빠진 행(잠긴 행·체크 해제)의 날짜로 착지 월을
      // 정하면 사용자가 가져오지 않은 달을 열게 된다.
      const confirmedIdSet = new Set(confirmedIds);
      landingMonthRef.current = resolveImportLandingMonth(rowList.filter((row) => confirmedIdSet.has(row.id)));
      return confirmImport(authToken!, importJobId, confirmedIds);
    },
    onSuccess: async (result) => {
      setLandingMonth(landingMonthRef.current);
      setCompletionSummary(result);
      await queryClient.invalidateQueries({ queryKey: ["import-job", importJobId] });
      // Import confirmation changes expense totals that feed every report tab (monthly,
      // category, cumulative, yearly all share the "report" key prefix), plus the home
      // summary, the records list, and budget "used" tracking — invalidate all of them so
      // nothing goes stale after a confirm.
      await queryClient.invalidateQueries({ queryKey: ["report"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["budget"] });
    }
  });

  /**
   * 라운드 71 트랙 A — **실패한 그 순간의 연결 상태.** 자리마다 따로 들고 있는 이유는 두 실패가
   * 동시에 화면에 설 수 있고 원인이 서로 다를 수 있기 때문이다(라운드 71 리뷰 S-6: 체크 토글과
   * 분류 편집은 서로 다른 요청이라 한쪽의 연결 판정이 다른 쪽 문장에 얹히면 안 된다 — 문장을
   * 고를 때 **오류와 연결 판정을 같은 짝으로** 집는다).
   *
   * 라운드 72 트랙 E — 그 판정을 **손으로 세 벌 적지 않는다.** 종전 배선은 뮤테이션마다
   * `useState(true)` + 시작 시 무장 + `onError`의 `void isCurrentlyOnline().then(setX)`였고,
   * 그 형태에는 라운드 52 QA P3-1이 예산·아이 프로필에서 이미 없앤 두 구멍이 남아 있었다 —
   * ① 실패 직후 화면을 떠나면 사라진 화면에 setState가 걸리고(검수 화면은 뒤로 나가는 것이 가장
   * 흔한 반응이다), ② **연속 실패에서 늦게 도착한 옛 판정이 최신 판정을 덮는다**(터널 안에서 얻은
   * "오프라인"이 터널을 빠져나온 뒤의 실패에 뒤늦게 얹혀, 연결이 있는데도 화면이 오프라인이라고
   * 말한다 — 라운드 71 A가 세운 정직한 문장이 배선 때문에 틀린 사실을 말하는 경우다).
   *
   * 공용 배선(`useErrorTimeConnectivity`)은 그 둘을 cancelled 가드 하나로 이미 닫아 두었고,
   * 에러가 풀리면 초기값 true로 되돌리므로 종전의 "매 시도 시작에서 무장"도 그대로다. 기본값
   * true는 폴이 돌아오기 전과 판정 불가 플랫폼(web)에서 **일반 문구로 안전하게 떨어짐**을 뜻한다.
   * 문구·판정 함수(`importFailureMessage`)는 한 글자도 바뀌지 않는다.
   */
  const toggleFailureOnline = useErrorTimeConnectivity(toggleRow.isError);
  const categoryFailureOnline = useErrorTimeConnectivity(updateCategory.isError);
  const confirmFailureOnline = useErrorTimeConnectivity(confirm.isError);

  const rowList = rows.data?.rows ?? [];
  const selectedCount = selectedRowIds(rowList).length;
  const attentionCount = countImportRowsNeedingAttention(rowList);
  // 라운드 42 L-2: 체크는 켜졌는데 서버가 아직 valid로 바꿔 주지 않은 검토 가능 행(판정은 순수 모듈).
  const unappliedReviewedCount = countUnappliedReviewedRows(rowList);
  const status = job.data?.status;
  const isPreviewReady = status === "preview_ready";
  const isBulkRunning = bulkProgress !== null;
  /**
   * 라운드 51 C-#11 — 가져온 기록이 **실제로 있는 달**로 내려놓는다.
   *
   * 종전에는 언제나 `router.replace("/(tabs)/records")`라 이번 달이 열렸다. 가져오기의
   * 절대다수는 지난 몇 달치 가계부라, 128건을 확정하고 "가계부에서 확인하기"를 누른 사용자가
   * 곧바로 빈 목록을 보는 일이 흔했다("가져왔는데 안 보여요").
   *
   * 대표 월을 모르면(날짜를 하나도 못 읽은 파일, 새로고침 후 이미 confirmed 상태로 들어온 화면)
   * 파라미터를 붙이지 않고 종전 그대로 이동한다. 기록 탭도 파라미터가 없으면 종전과 같다.
   */
  const recordsLandingNotice = importLandingMonthNotice({ landingMonth, todayIso: getSeoulToday() });
  const goToRecords = () => {
    if (!landingMonth) {
      router.replace("/(tabs)/records");
      return;
    }
    router.replace({ pathname: "/(tabs)/records", params: { [RECORDS_MONTH_PARAM]: landingMonth } });
  };

  /**
   * 라운드 42 L-3 — "확인 필요만 보기"의 막다른 길.
   *
   * 칩은 확인 필요 행이 하나라도 있을 때만 그려진다(shouldShowAttentionFilter). 그런데 필터를 켠
   * 채 그 행들을 전부 처리하면 -- 체크 한 번이면 valid가 되는 검토 가능 행이 대부분이라 흔한
   * 경로다 -- 칩이 언마운트되면서 `rowFilter`만 "attention"으로 남는다. 그러면 목록은 비었는데
   * ("확인이 필요한 행이 없어요") 필터를 **끌 컨트롤이 화면에 없다**: 가져올 행이 다 있는데도
   * 뒤로 나갔다 다시 들어오는 것 말고는 목록을 되살릴 방법이 없었다. 칩이 사라지는 그 조건에서
   * 필터도 함께 푼다(판정은 칩과 같은 순수 함수를 쓴다 -- 두 벌로 갈리면 이 버그가 되돌아온다).
   */
  useEffect(() => {
    if (rowFilter === "attention" && !shouldShowAttentionFilter(attentionCount)) setRowFilter("all");
  }, [attentionCount, rowFilter]);

  /**
   * 라운드 56 D#5 — **이어서 보기 카드를 지우는 유일한 자리.**
   *
   * 카드(app/import/index.tsx)는 "아직 검토할 것이 남아 있다"고 말한다. 그 말이 더는 사실이
   * 아닌 순간은 둘뿐이다: 잡이 끝났거나(취소·실패) 서버에서 사라졌거나(404 — 만료·삭제).
   * 판정은 순수 모듈 하나가 갖는다 -- 화면이 상태 문자열을 다시 나열하면 그 목록이 곧 두 번째
   * 계약이 된다. 네트워크 실패나 아직 오지 않은 응답에는 손대지 않는다(잠깐 끊긴 것을
   * "없어졌다"로 단정하면 앱이 사용자의 돌아갈 길을 스스로 지운다).
   *
   * `importJobId`를 함께 넘기므로 **이 화면이 보고 있는 잡일 때만** 지운다: 옛 링크로 들어간
   * 화면이 뒤늦게 깨어나도 그 사이 새로 올린 파일의 카드를 지우지 못한다.
   *
   * 라운드 67 #3 — **확정된 잡은 지우지 않고 결과로 바꾼다.** 종전에는 확정이 곧 삭제였고,
   * 그래서 잘못 확정한 200건으로 돌아갈 주소가 앱 어디에도 남지 않았다(서버에 "내 가져오기
   * 목록"이 없다). 이제 그 저장본에 서버가 말한 건수를 적어 두면 /import의 카드가
   * "방금 가져온 결과 · 되돌리기"가 된다. 뮤테이션 성공이 아니라 **읽은 상태**로 판정하는
   * 이유는 위와 같다: 확정 직후 화면을 떠났다 다시 들어와도 같은 결론에 닿아야 한다.
   */
  const forgetImportReview = useImportResumeStore((state) => state.forgetImportReview);
  const markImportConfirmed = useImportResumeStore((state) => state.markImportConfirmed);
  const confirmedImportedCount = job.data?.importedCount;
  useEffect(() => {
    if (shouldForgetImportResume({ status, error: job.error })) {
      forgetImportReview(importJobId);
      return;
    }
    if (shouldMarkImportResumeConfirmed({ status }) && confirmedImportedCount !== undefined) {
      markImportConfirmed(importJobId, confirmedImportedCount);
    }
  }, [status, job.error, importJobId, forgetImportReview, markImportConfirmed, confirmedImportedCount]);

  /**
   * 라운드 41 K-7: 토글·일괄도 확정과 **같은 게이트**를 지난다.
   *
   * 서버는 행 PATCH에도 편집 권한을 요구한다(`requireImportJobAccess(user, id, true)` → 403).
   * 게이트가 확정 버튼에만 걸려 있어서, 보기 전용 참여자가 딥링크로 검수 화면에 닿으면 체크가
   * 켜졌다가 403으로 되돌아가고 "불러오지 못했어요. 잠시 후 다시 시도해 주세요."라는 **틀린
   * 이유**만 남았다(다시 시도해도 결과가 같다).
   *
   * `expenseGate.guard`를 쓰지 않고 `locked` + 모듈 스코프 `explainExpenseViewOnly`를 직접
   * 쓰는 이유: guard는 렌더마다 새 함수라 의존성에 넣으면 행 memo가 통째로 깨진다. 판정은
   * 같은 훅의 같은 boolean이다.
   */
  const gateLocked = expenseGate.locked;

  // `mutate`는 react-query가 렌더마다 같은 참조로 돌려주는 값이다 -- 뮤테이션 객체(`toggleRow`)를
  // 의존성으로 잡으면 매 렌더 새 핸들러가 생겨 행 memo가 통째로 깨진다.
  const toggleMutate = toggleRow.mutate;
  const handleToggle = useCallback<ImportRowToggleHandler>(
    (row) => {
      if (gateLocked) {
        explainExpenseViewOnly();
        return;
      }
      toggleMutate(row);
    },
    [gateLocked, toggleMutate]
  );

  /**
   * 라운드 65 A(#2): 칩 목록은 한 번에 한 행만 펼친다(다시 누르면 접힌다). 다른 행을 펼치면
   * 앞 행은 자동으로 접힌다 -- 상태가 id 하나라 그 규칙이 곧 자료 구조다.
   */
  const handleExpandCategory = useCallback<ImportRowCategoryExpandHandler>((rowId) => {
    setExpandedCategoryRowId((current) => (current === rowId ? null : rowId));
  }, []);

  const updateCategoryMutate = updateCategory.mutate;
  const handleSelectCategory = useCallback<ImportRowCategorySelectHandler>(
    (row, categoryId) => {
      if (gateLocked) {
        explainExpenseViewOnly();
        return;
      }
      // 고른 순간 닫는다(고르는 것이 이 목록의 유일한 일이다). 이미 그 분류면 PATCH를 보내지
      // 않는다 -- 값이 그대로인 요청도 서버에서는 `userReviewed`를 세우는 "확인했어요"가 된다.
      setExpandedCategoryRowId(null);
      if (!shouldPatchImportRowCategory(row, categoryId)) return;
      updateCategoryMutate({ row, categoryId });
    },
    [gateLocked, updateCategoryMutate]
  );

  const filteredRows = useMemo(() => filterImportRows(rowList, rowFilter), [rowList, rowFilter]);
  /**
   * 라운드 41 K-9: 일괄 계획은 **화면에 보이는 행**에서만 세운다. "확인 필요만 보기" 필터를 켜
   * 둔 채 누른 버튼이 보이지 않는 수백 행까지 뒤집으면, 사용자가 승인한 적 없는 변경이다.
   * 라벨도 같은 사실을 말한다(필터 중에는 "보이는 행 선택/해제").
   */
  const bulkPlan = useMemo(() => buildImportBulkSelectionPlan(filteredRows), [filteredRows]);

  /**
   * "전체 선택/해제". 서버 계약에 **일괄 PATCH가 없어서**
   * (apps/api/src/imports/imports.controller.ts는 `PATCH imports/:importJobId/rows/:rowId` 단건만
   * 노출한다 — 129줄) 클라이언트가 순차로 보낸다. 그래서 진행 표시가 선택이 아니라 필수다:
   * 2,000행 상한에서는 수백 건이 오갈 수 있다. 서버에 일괄 엔드포인트가 생기면 순수 모듈이 이미
   * 계산해 둔 `targetRowIds`를 그대로 본문에 실으면 되므로 이 호출부만 바뀐다.
   *
   * 이미 원하는 상태인 행과 잠긴 행은 계획에서 빠진다 — 서버가 false로 되돌릴 요청을 굳이 보내지
   * 않는다. 검토 가능 행은 포함된다(K-1): 일괄 선택이 곧 "이 행들 확인했어요"다.
   *
   * 경합 규칙(K-6)은 전부 순수 모듈이 갖고 있다. 여기서 하는 일은 세 가지뿐이다:
   *  - `claimImportBulkRun`으로 **잡 하나에 루프 하나**를 보장하고(재진입 이중 실행 차단),
   *  - 진행 보고를 받을 때마다 아직 마운트돼 있는지 확인하고(고아 루프의 캐시 쓰기 차단),
   *  - 끝나면 무슨 일이 있었든 **재조회**로 진실을 다시 받아 온다.
   * 마지막 항목이 특히 중요하다: 낙관 갱신은 `selected`만 뒤집는데, 검토 가능 행은 서버에서
   * `validationStatus`까지 valid로 바뀐다 — 재조회하지 않으면 확정 본문에서 조용히 빠진다.
   */
  const applyBulkSelection = useCallback(async () => {
    if (gateLocked) {
      explainExpenseViewOnly();
      return;
    }
    const cached = queryClient.getQueryData<ImportRowsResponse>(rowsQueryKey)?.rows ?? [];
    const plan = buildImportBulkSelectionPlan(filterImportRows(cached, rowFilter));
    if (
      !canStartImportBulkRun({
        hasAuth: Boolean(authToken),
        isPreviewReady,
        isBulkRunning,
        pendingRowCount: pendingRowIds.size,
        targetRowCount: plan.targetRowIds.length
      })
    ) {
      return;
    }
    const handle = claimImportBulkRun(importJobId);
    // 이미 이 잡의 루프가 돌고 있다(화면이 두 번 마운트됐거나 탭이 빨리 두 번 들어왔다).
    // 라운드 42 L-4: 조용히 돌아가지 않고 그 사실을 한 줄로 말한다 -- 곧 풀리는 상태다.
    if (!handle) {
      setBulkClaimBlocked(true);
      return;
    }
    setBulkClaimBlocked(false);
    bulkRunRef.current = handle;
    setBulkOutcome(null);
    setBulkProgress({ done: 0, total: plan.targetRowIds.length });

    try {
      const result = await runImportBulkSelection({
        rowIds: plan.targetRowIds,
        selected: plan.nextSelected,
        isCancelled: handle.isCancelled,
        // `selected`만 보낸다 — 서버는 나머지 필드를 현재 값과 병합한다(같은 서비스의 merge 규칙).
        patchRow: (rowId, selected) => updateImportRow(authToken!, importJobId, rowId, { selected }),
        // PERF: 캐시 쓰기를 N건씩 모은다(순수 모듈의 배치 규칙) — 매 건마다 2,000행 배열을
        // 새로 만들면 O(n^2)다.
        onProgress: ({ done, total, appliedRowIds }) => {
          if (!mountedRef.current || handle.isCancelled()) return;
          setBulkProgress({ done, total });
          queryClient.setQueryData<ImportRowsResponse>(rowsQueryKey, (current) => {
            if (!current) return current;
            let next: readonly ImportRow[] = current.rows;
            for (const rowId of appliedRowIds) {
              next = setImportRowSelection(next, rowId, plan.nextSelected) as ImportRow[];
            }
            return next === current.rows ? current : { rows: next as ImportRow[] };
          });
        }
      });
      if (!mountedRef.current) return;
      setBulkOutcome(result.outcome);
    } finally {
      handle.release();
      if (bulkRunRef.current === handle) bulkRunRef.current = null;
      if (mountedRef.current) setBulkProgress(null);
      /**
       * 완료·중단·실패 어느 쪽이든 서버가 진실이다(검토 가능 행은 selected만이 아니라
       * validationStatus까지 바뀐다).
       *
       * 라운드 42 L-2: 이 재조회는 **마운트 여부와 무관하게** 실행한다. 예전에는
       * `if (mountedRef.current)` 안에 있어서, 화면을 벗어나며 루프가 취소된 경우
       * (언마운트·blur가 정확히 그 경로다) 캐시에는 진행 중 onProgress가 써 둔 `selected`만
       * 남고 `validationStatus`는 낡은 값 그대로였다. 게다가 그 쓰기가 `dataUpdatedAt`을
       * 갱신해 캐시가 fresh해지므로, 30초 안에 다시 들어오면 재조회조차 돌지 않아 화면이
       * "체크는 켜졌지만 확인 필요"라는 존재하지 않는 상태를 보여 줬다.
       *
       * queryClient는 전역이라 언마운트 뒤에도 안전하게 부를 수 있다 -- 비활성 쿼리는
       * stale 표시만 되고(네트워크는 다음 진입 때) 사라진 화면의 상태를 건드리지 않는다.
       */
      await queryClient.invalidateQueries({ queryKey: rowsQueryKey });
    }
  }, [
    authToken,
    gateLocked,
    importJobId,
    isBulkRunning,
    isPreviewReady,
    pendingRowIds,
    queryClient,
    rowFilter,
    rowsQueryKey
  ]);

  const cancelBulkSelection = useCallback(() => {
    bulkRunRef.current?.cancel();
  }, []);

  const listData = useMemo<ImportRowListItem[]>(
    () =>
      filteredRows.map((row) => ({
        row,
        // 잠기는 것은 **그 행 하나**뿐이다(진행 중이거나, 일괄 작업 중이거나, 서버가 편집을 더는
        // 받지 않는 상태). 예전처럼 목록 전체가 굳지 않는다.
        disabled: !canToggleImportRow({ isPreviewReady, isBulkRunning, isRowPending: pendingRowIds.has(row.id) }),
        onToggle: handleToggle,
        categoryOptions,
        resolveCategoryName,
        isImportStubCategory,
        categoryExpanded: expandedCategoryRowId === row.id,
        onExpandCategory: handleExpandCategory,
        onSelectCategory: handleSelectCategory
      })),
    [
      categoryOptions,
      expandedCategoryRowId,
      filteredRows,
      handleExpandCategory,
      handleSelectCategory,
      handleToggle,
      isBulkRunning,
      isImportStubCategory,
      isPreviewReady,
      pendingRowIds,
      resolveCategoryName
    ]
  );

  const showList = !rows.isLoading && !rows.isError && rowList.length > 0;
  /**
   * 라운드 42 L-4: **다른 마운트의 루프가 아직 등록부에 남아 있는가**(claimImportBulkRun이
   * null을 돌려줄 상태인가). 이 화면 자신이 돌리는 중이면 `isBulkRunning`이 이미 막으므로,
   * 여기서 보는 것은 "이전 루프가 아직 release되지 않은" 경우뿐이다. 눌리는 척하지 않도록
   * 버튼 disabled에 그대로 반영하고, 이미 눌러 본 사용자에게는 아래 한 줄로 이유를 말한다.
   *
   * 라운드 44 리뷰 N-6: 이 값을 렌더 중에 한 번 읽기만 하면 **되살아나지 않는다**. 앞 마운트의
   * 루프가 release되는 순간에는 이 화면의 상태가 아무것도 바뀌지 않으므로 재렌더가 없고,
   * 확정 버튼이 잠긴 채 그대로 남는다(사용자는 IMPORT_BULK_CLAIM_BUSY_TEXT만 보며 기다린다).
   * 등록부 구독을 외부 스토어로 읽어 claim/release 시점에 다시 그린다.
   */
  const bulkRunRegistered = useSyncExternalStore(
    subscribeImportBulkRuns,
    useCallback(() => isImportBulkRunActive(importJobId), [importJobId]),
    useCallback(() => false, [])
  );
  const bulkRunHeldElsewhere = !isBulkRunning && bulkRunRegistered;
  const canBulkSelect =
    !bulkRunHeldElsewhere &&
    canStartImportBulkRun({
      hasAuth: Boolean(authToken),
      isPreviewReady,
      isBulkRunning,
      pendingRowCount: pendingRowIds.size,
      targetRowCount: bulkPlan.targetRowIds.length
    });
  /**
   * 라운드 42 L-2: 확정 판정도 순수 모듈 하나가 갖는다. 새로 들어온 두 조건(진행 중인 단건
   * 토글 · 아직 반영되지 않은 검토 체크)이 **영구 손실 창**을 닫는다 -- 그 상태로 확정이 나가면
   * 그 행들은 본문에서 빠진 채 잡이 confirmed로 넘어가 다시는 가져올 수 없다.
   */
  const confirmBlockedByPending = pendingRowIds.size > 0 || unappliedReviewedCount > 0;
  const canConfirm = canConfirmImport({
    isPreviewReady,
    isConfirming: confirm.isPending,
    isBulkRunning,
    // 라운드 43 리뷰 M-6: 앞 마운트의 루프가 아직 등록부에 남아 있는 좁은 창에서도 확정을
    // 열지 않는다 -- 그 루프가 계속 PATCH를 보내는 동안 잡이 confirmed로 넘어가면 남은 행은
    // 다시 편집할 수 없다(IMPORT_NOT_EDITABLE). 일괄 버튼(canBulkSelect)과 같은 값을 본다.
    isBulkRunHeldElsewhere: bulkRunHeldElsewhere,
    confirmableSelectedCount: selectedCount,
    pendingRowCount: pendingRowIds.size,
    unappliedReviewedCount
  });

  const listHeader = (
    <View style={{ gap: theme.spacing.section, marginBottom: theme.spacing.section }}>
      <ScreenHeader
        eyebrow="데이터 가져오기"
        title="가져오기 진행 상황"
        subtitle={expenseGate.locked ? VIEW_ONLY_HEADLINES.importReview : "분석 결과를 확인하고 가져올 항목을 골라요"}
        onBack={() => router.back()}
      />

      {job.isLoading ? (
        <Card>
          <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
        </Card>
      ) : null}

      {job.isError ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
          <SecondaryButton label="다시 시도" onPress={() => job.refetch()} />
        </Card>
      ) : null}

      {job.data ? (
        <Card style={{ gap: 8 }}>
          <StatusBadge label={statusCopy[job.data.status].label} tone={statusCopy[job.data.status].tone} />
          {targetChildName ? (
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>{IMPORT_TARGET_CHILD_LABEL}</Text>
              <Text style={summaryValueStyle}>{targetChildName}</Text>
            </View>
          ) : null}
          {/* 라운드 42 L-6: 이름을 못 찾았을 때만 나오는 한 줄(사실 고지 -- 확정은 막지 않는다). */}
          {targetChildNotice ? <Text style={mutedTextStyle}>{targetChildNotice}</Text> : null}
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>전체 행</Text>
            <Text style={summaryValueStyle}>{job.data.rowCount}건</Text>
          </View>
          <View style={summaryRowStyle}>
            <Text style={summaryLabelStyle}>선택됨</Text>
            <Text style={summaryValueStyle}>{selectedCount}건</Text>
          </View>
          {attentionCount > 0 ? (
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>확인 필요</Text>
              <Text style={summaryValueStyle}>{attentionCount}건</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* 검수 도구는 서버가 편집을 받는 동안(preview_ready)에만 낸다 -- 확정이 끝난 뒤에 누를 수
          없는 버튼을 남겨 두지 않는다. */}
      {showList && isPreviewReady ? (
        <View style={{ gap: theme.spacing.gap }}>
          <View style={toolbarRowStyle}>
            {shouldShowAttentionFilter(attentionCount) ? (
              <FilterChip
                label={attentionFilterChipLabel(attentionCount)}
                selected={rowFilter === "attention"}
                onPress={() => setRowFilter((current) => (current === "attention" ? "all" : "attention"))}
              />
            ) : null}
            <SecondaryButton
              label={
                bulkProgress
                  ? importBulkProgressLabel(bulkProgress.done, bulkProgress.total)
                  : importBulkSelectionLabel(filteredRows, rowFilter)
              }
              disabled={!canBulkSelect}
              onPress={applyBulkSelection}
              style={{ flexGrow: 1, flexShrink: 1 }}
            />
            {/* K-6: 수백 건짜리 순차 PATCH에 탈출구가 없으면 유일한 방법이 "앱 끄기"였다. */}
            {isBulkRunning ? (
              <SecondaryButton
                label={IMPORT_BULK_CANCEL_LABEL}
                accessibilityLabel={IMPORT_BULK_CANCEL_A11Y_LABEL}
                onPress={cancelBulkSelection}
              />
            ) : null}
          </View>
          {/* K-10: 중간 실패는 "아무것도 안 됐어요"가 아니다 — 앞부분은 이미 서버에 남아 있다.
              목록 조회 실패 문구(loadFailedText)를 돌려 쓰면 그 사실을 감추게 된다. */}
          {bulkOutcome === "failed" ? (
            <Text style={{ color: theme.colors.danger }}>{IMPORT_BULK_PARTIAL_FAILURE_TEXT}</Text>
          ) : null}
          {bulkOutcome === "cancelled" ? <Text style={mutedTextStyle}>{IMPORT_BULK_CANCELLED_TEXT}</Text> : null}
          {/* L-4: 실행권을 못 받아 아무 일도 일어나지 않은 그 한 번을 설명한다. 이전 루프가
              등록부에서 내려오면 이 줄도 함께 사라진다(상태를 붙잡아 두지 않는다). */}
          {bulkClaimBlocked && bulkRunHeldElsewhere ? (
            <Text style={mutedTextStyle}>{IMPORT_BULK_CLAIM_BUSY_TEXT}</Text>
          ) : null}
        </View>
      ) : null}

      {rows.isLoading ? (
        <Card>
          <Text style={mutedTextStyle}>미리보기를 불러오는 중이에요...</Text>
        </Card>
      ) : null}

      {rows.isError ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
          <SecondaryButton label="다시 시도" onPress={() => rows.refetch()} />
        </Card>
      ) : null}
    </View>
  );

  /**
   * 라운드 71 트랙 A — 두 편집 뮤테이션 중 실패한 쪽의 **값**. 종전 조건(`toggleRow.isError ||
   * updateCategory.isError`)과 참·거짓이 같고(react-query의 `error`는 isError일 때만 non-null),
   * 다른 점은 그 값을 문구 판정에 넘길 수 있다는 것뿐이다. 둘이 동시에 실패했으면 사용자가
   * 방금 누른 쪽(체크)을 먼저 말한다.
   *
   * 라운드 71 리뷰 S-6: 오류와 **그 실패의 연결 판정**을 한 짝으로 집는다 — 고르는 자리가 하나면
   * 둘이 어긋날 수 없다(종전에는 오류는 이쪽에서, 연결 판정은 공용 상태 하나에서 왔다).
   */
  const rowEditFailure = toggleRow.error
    ? { error: toggleRow.error, isOnline: toggleFailureOnline }
    : updateCategory.error
      ? { error: updateCategory.error, isOnline: categoryFailureOnline }
      : null;

  const listFooter = (
    <View style={{ gap: theme.spacing.gap, marginTop: theme.spacing.section }}>
      {/* 라운드 71 트랙 A: 체크·분류 편집 실패는 **저장** 실패다. 종전에는 조회 실패 문구가
          그대로 섰고(동사부터 틀렸다), 가장 도달하기 쉬운 갈래인 "같은 아이의 파일을 새로
          올려 앞 잡이 cancelled로 내려간" 경우(IMPORT_NOT_EDITABLE)가 하필 가장 조용했다.
          이제 서버가 준 이름마다 정직한 문장과 다음 할 일이 선다. */}
      {rowEditFailure ? (
        <Text style={{ color: theme.colors.danger }}>
          {importFailureMessage("row_edit", rowEditFailure.error, { isOnline: rowEditFailure.isOnline })}
        </Text>
      ) : null}
      {/* 라운드 40 J-6: 확정은 서버에서 **편집 권한**을 요구한다(import-pipeline.service.ts의
          `requireImportJobAccess(user, id, true)` → 403). 게이트가 없으면 보기 전용 참여자가
          업로드·검수를 다 끝낸 뒤 마지막 버튼에서 "불러오지 못했어요. 잠시 후 다시 시도해
          주세요."라는 **틀린 이유**를 받는다(다시 시도해도 결과가 같다). 다른 지출 진입점과
          같은 판정 하나를 거쳐, 잠겼으면 뮤테이션을 실행하지 않고 사실을 말한다. */}
      {/* 라운드 42 L-2: 체크가 아직 서버에 반영되지 않은 동안에는 확정을 열지 않는다 --
          그 상태로 확정하면 그 행들이 본문에서 빠진 채 잡이 confirmed로 넘어가 영영 가져올 수
          없다(IMPORT_NOT_EDITABLE). 버튼이 왜 잠겼는지는 아래 한 줄이 말한다. */}
      <PrimaryButton
        label={confirm.isPending ? "가져오는 중..." : "선택한 항목 가져오기"}
        disabled={!canConfirm}
        onPress={expenseGate.guard(() => confirm.mutate())}
      />
      {isPreviewReady && confirmBlockedByPending ? (
        <Text style={mutedTextStyle}>{IMPORT_CONFIRM_PENDING_TEXT}</Text>
      ) : null}
      {/* 라운드 43 리뷰 M-6: 이전 루프 정리 창에서 확정이 잠긴 이유. 곧 풀리는 같은 상태라
          일괄 버튼과 같은 문구를 재사용한다(새 문구를 만들지 않는다). 위의 반영 대기 안내와
          동시에 두 줄이 쌓이지 않게 그쪽이 없을 때만 나온다. */}
      {isPreviewReady && !confirmBlockedByPending && bulkRunHeldElsewhere ? (
        <Text style={mutedTextStyle}>{IMPORT_BULK_CLAIM_BUSY_TEXT}</Text>
      ) : null}
      {/* 라운드 71 트랙 A: 마지막 버튼의 실패도 조회 실패가 아니다. `IMPORT_NOT_CONFIRMABLE`
          (상태 검사 · 확정 CAS 두 자리)은 다시 눌러도 같은 답이 오는 사실이라, 재시도를 권하는
          대신 검수 내용이 남지 않는다는 것과 다음에 할 일을 말한다. 버튼·카드 구조는 무변경이다. */}
      {confirm.isError ? (
        <Text style={{ color: theme.colors.danger }}>
          {importFailureMessage("confirm", confirm.error, { isOnline: confirmFailureOnline })}
        </Text>
      ) : null}
    </View>
  );

  const listEmpty =
    rows.isLoading || rows.isError ? null : rowList.length === 0 ? (
      <EmptyStateCard title="가져올 항목이 없어요" actionLabel="돌아가기" onPress={() => router.replace("/import")} />
    ) : (
      // 필터 때문에 비었을 때 "가져올 항목이 없어요"는 사실이 아니다.
      <Card>
        <Text style={mutedTextStyle}>{IMPORT_ATTENTION_FILTER_EMPTY_TEXT}</Text>
      </Card>
    );

  if (status === "confirmed" && job.data) {
    return (
      <View testID="screen-IMP-003" style={screenStyle}>
        <FlatList
          data={emptyRowList}
          keyExtractor={importRowKey}
          renderItem={renderImportRow}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <CompletionSummaryCard
              summary={completionSummary ?? { importedCount: job.data.importedCount, skippedCount: job.data.rowCount - job.data.importedCount }}
              landingNotice={recordsLandingNotice}
              onDone={goToRecords}
            />
          }
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={[listStyle, webScrollHiddenStyle]}
          contentContainerStyle={listContentStyle}
        />
      </View>
    );
  }

  // PERF: 서버 상한이 2,000행이다. 예전에는 AppScreen(ScrollView) 안에서 `.map()`으로 전 행을
  // 즉시 마운트했다 — 큰 파일 하나로 화면이 굳었다. 이제 스크롤러가 FlatList 자체이고
  // (ScrollView 안에 중첩하면 가상화가 꺼진다 — 기록 탭 PERF-102와 같은 이유) 헤더·푸터는
  // ListHeaderComponent/ListFooterComponent로 옮겼다.
  return (
    <View testID="screen-IMP-003" style={screenStyle}>
      <View testID="screen-IMP-004" style={{ flex: 1 }}>
        <FlatList
          data={listData}
          keyExtractor={importRowKey}
          renderItem={renderImportRow}
          ItemSeparatorComponent={ImportRowSeparator}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={[listStyle, webScrollHiddenStyle]}
          contentContainerStyle={listContentStyle}
        />
      </View>
    </View>
  );
}

/** 완료 화면에서 FlatList에 넘기는 빈 목록(모듈 스코프 상수 — 매 렌더 새 배열을 만들지 않는다). */
const emptyRowList: ImportRowListItem[] = [];

const screenStyle = {
  backgroundColor: theme.colors.background,
  flex: 1
} as const;

const listStyle = {
  backgroundColor: theme.colors.background,
  flex: 1
} as const;

const listContentStyle = {
  backgroundColor: theme.colors.background,
  flexGrow: 1,
  padding: theme.spacing.screen
} as const;

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13
} as const;

const toolbarRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  flexWrap: "wrap",
  gap: theme.spacing.gap
} as const;

function filterChipStyle(selected: boolean) {
  return {
    alignItems: "center",
    backgroundColor: selected ? theme.colors.mainCoral : theme.colors.white,
    borderColor: selected ? theme.colors.mainCoral : theme.colors.primary100,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    // 44dp 터치 타깃(theme.touchTarget) — 새 치수를 만들지 않는다.
    minHeight: theme.touchTarget,
    paddingHorizontal: 16
  } as const;
}

const summaryRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between"
} as const;

const summaryLabelStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  fontWeight: "700"
} as const;

const summaryValueStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "800"
} as const;

const summaryTitleStyle = {
  color: theme.colors.brown,
  fontSize: 16,
  fontWeight: "800"
} as const;

const rowCardStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  gap: 6,
  // 44dp 터치 타깃: 카드 자체가 체크박스라 카드 높이가 곧 터치 타깃이다.
  minHeight: theme.touchTarget,
  padding: theme.spacing.card
} as const;

/**
 * 카드 안에서 **체크박스로 동작하는 영역**. 카드의 테두리·배경·여백은 바깥 View(rowCardStyle)가
 * 그대로 갖고, 이 블록은 종전 카드 내부와 같은 간격만 갖는다(라운드 65 A #2 전과 렌더 동일).
 */
const rowCardMainStyle = {
  gap: 6
} as const;

// A11Y-117: 12px 텍스트 버튼 -- coral[500]은 흰 배경에서 3.16:1(AA 미달)이라 coral[700]을 쓴다
// (지출 상세의 "직접 입력" 토글과 같은 자리·같은 값).
const rowCategoryEditStyle = {
  color: theme.colors.coral[700],
  fontSize: 12,
  fontWeight: "700"
} as const;

const rowCardSelectedStyle = {
  borderColor: theme.colors.mainCoral
} as const;

const rowCardDisabledStyle = {
  opacity: 0.6
} as const;

const rowCardLockedStyle = {
  backgroundColor: theme.colors.beige,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  gap: 6,
  minHeight: theme.touchTarget,
  padding: theme.spacing.card
} as const;

const rowHeaderStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10
} as const;

function checkboxStyle(checked: boolean) {
  return {
    alignItems: "center",
    backgroundColor: checked ? theme.colors.mainCoral : theme.colors.white,
    borderColor: checked ? theme.colors.mainCoral : theme.colors.gray300,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20
  } as const;
}

const lockMarkStyle = {
  alignItems: "center",
  height: 20,
  justifyContent: "center",
  width: 20
} as const;

const lockMarkTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13
} as const;

const checkmarkStyle = {
  color: theme.colors.white,
  fontSize: 12,
  fontWeight: "800"
} as const;

const rowTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 14,
  fontWeight: "800"
} as const;

const rowAmountStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "700"
} as const;

const rowDateStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "600"
} as const;

const rowNoticeStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "600",
  lineHeight: 18
} as const;
