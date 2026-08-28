import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import { LOCAL_SESSION_TOKEN, type CategoryListItem } from "../../src/api/client";
import { buildCategoryNameLookup, categoryCatalog } from "../../src/categories";
import { amountDigitsOnly, formatAmountDigits, formatKrw } from "../../src/money";
import {
  formatRecurringTemplateLine,
  parseRecurringTemplatePrefill,
  recurringPrefillParams,
  recurringRecordAccessibilityLabel,
  RECURRING_ITEM_NAME_MAX_LENGTH,
  RECURRING_MERCHANT_MAX_LENGTH,
  RECURRING_PREFILL_NOTICE,
  RECURRING_RECORD_ACTION_LABEL,
  RECURRING_SKIP_ACTION_LABEL,
  RECURRING_TEMPLATE_LIMIT,
  type RecurringExpenseTemplate,
  type RecurringPaymentMethod,
  type RecurringTemplateDraft
} from "../../src/expenses/recurring-template";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { useRecurringExpenseStore } from "../../src/stores/recurring-expense.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  AppScreen,
  Card,
  CategoryChip,
  EmptyStateCard,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  StatusBadge,
  TextButton,
  announceForA11y
} from "../../src/ui";

/**
 * 라운드 55 트랙 A — 정기 지출 관리 화면(설계: docs/5차/round55-plan.md §1).
 *
 * ## 이 화면이 하지 않는 일 (DNC-013)
 *
 * **지출을 만들지 않는다.** `createExpense`도 `createExpenseOffline`도 부르지 않고, 그럴 수
 * 있는 모듈을 import하지도 않는다(소스 계약 테스트 src/expenses/recurring-flow.test.ts가 그
 * 사실을 고정한다). 여기서 저장되는 것은 "매월 이맘때 이 정도를 쓴다"는 사용자의 메모이고,
 * 실제 지출은 언제나 사용자가 빠른 기록 시트에서 확인하고 저장할 때만 생긴다.
 *
 * 그래서 화면 위쪽에 그 사실을 **먼저** 적어 둔다. 다른 가계부 앱의 "자동 기록"을 기대하고
 * 들어온 사람이 저장만 해 두고 기록이 됐다고 믿으면, 그 달 합계가 조용히 틀린다.
 *
 * ## 규칙을 화면에 다시 적지 않는다
 *
 * 검증·문구·상한은 전부 순수 모듈(src/expenses/recurring-template.ts)과 스토어에 있고, 이
 * 화면은 결과 문장을 그대로 보여주기만 한다. 이 저장소가 반복해서 겪은 실패 모드가 "화면과
 * 판정 모듈에 규칙이 두 벌"이라 여기서는 판정을 한 줄도 하지 않는다.
 */

const recurringScreenId = "screen-recurring-expenses";

/** 결제 수단 세그먼트. 값·라벨은 빠른 기록 시트(app/expenses/new.tsx)와 같은 목록이다. */
const recurringPaymentMethods: readonly { value: RecurringPaymentMethod; label: string }[] = [
  { value: "card", label: "카드" },
  { value: "cash", label: "현금" },
  { value: "transfer", label: "계좌 이체" },
  { value: "mobile_pay", label: "모바일 결제" }
];

type FormState = {
  /** 수정 중인 템플릿 id(신규면 null). */
  editingId: string | null;
  itemName: string;
  amountDigits: string;
  categoryId: string | null;
  paymentMethod: RecurringPaymentMethod;
  merchant: string;
  dayDigits: string;
};

const emptyForm: FormState = {
  editingId: null,
  itemName: "",
  amountDigits: "",
  categoryId: null,
  paymentMethod: "card",
  merchant: "",
  dayDigits: ""
};

/**
 * 라운드 58 #1 — 지출 상세에서 넘어온 프리필로 시작하는 폼.
 *
 * 파싱은 순수 모듈이 전부 한다(`parseRecurringTemplatePrefill`) — 이 화면은 그 결과를 칸에
 * 옮겨 담기만 한다. 파라미터가 없으면 값이 전부 비어 있어 `emptyForm`과 같아지므로, 평소처럼
 * 열린 화면은 예전과 한 픽셀도 다르지 않다.
 *
 * 결제 수단만 기본값을 되살린다: 프리필이 없거나 화이트리스트 밖이면 `null`이 오는데, 이 폼의
 * 세그먼트에는 "고르지 않음"이 없다(빠른 기록 시트와 같이 카드에서 시작한다).
 *
 * 라운드 58 통합리뷰 P2-1 — **이름을 모르는 분류는 채우지 않는다**(`isNamedCategoryId`).
 * 프리필의 분류 id는 서버 정식 카테고리 UUID일 수 있고, 그 이름은 `["categories"]` 캐시에만
 * 있다. 캐시가 아직 비어 있으면(콜드 스타트·오프라인 첫 실행) 이 화면은 그 id가 무엇인지 말할
 * 수 없다 — 그때 칩을 세우면 사용자가 고른 적 없는 이름("기타")이 선택된 것처럼 보이고, 그대로
 * 저장하면 화면이 말한 적 없는 분류가 매월 반복되는 약속으로 굳는다. 그래서 비워 두고 사용자가
 * 고르게 한다(모르면 지어내지 않는다 — 저장 검증이 "분류를 골라 주세요"로 이어서 안내한다).
 */
function formFromPrefill(
  prefill: ReturnType<typeof parseRecurringTemplatePrefill>,
  isNamedCategoryId: (categoryId: string) => boolean
): FormState {
  return {
    ...emptyForm,
    itemName: prefill.itemName,
    amountDigits: prefill.amountDigits,
    categoryId: prefill.categoryId && isNamedCategoryId(prefill.categoryId) ? prefill.categoryId : null,
    paymentMethod: prefill.paymentMethod ?? emptyForm.paymentMethod,
    dayDigits: prefill.dayDigits
  };
}

function formFromTemplate(template: RecurringExpenseTemplate): FormState {
  return {
    editingId: template.id,
    itemName: template.itemName,
    amountDigits: String(template.amountKrw),
    categoryId: template.categoryId,
    paymentMethod: template.paymentMethod,
    merchant: template.merchant ?? "",
    dayDigits: String(template.dayOfMonth)
  };
}

export default function RecurringExpensesScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const canManage = Boolean(authToken && selectedChildId);

  /**
   * UX-R(M) / 라운드 40 J-9 — `/expenses/new`로 가는 진입점은 예외 없이 이 게이트를 지난다.
   *
   * 보기 전용 참여자(viewer)를 그대로 시트로 보내면 로컬 우선 저장이 "기기에 저장했어요"라고
   * 말한 뒤 flush에서 403을 받아 failed 행으로 굳는다 — 진입점 하나만 빠져도 그 거짓말이
   * 되살아난다. 버튼을 지우지 않고 눌렀을 때 사실을 말하는 것이 이 앱의 관례다.
   *
   * 템플릿 저장·수정·삭제는 게이트를 지나지 않는다: 그건 지출이 아니라 이 기기의 메모이고,
   * 보기 전용 참여자도 자기 화면에서 무엇을 볼지 정할 수 있어야 한다.
   */
  const expenseGate = useExpenseEntryGate();

  const templates = useRecurringExpenseStore((state) => state.templates);
  const addTemplate = useRecurringExpenseStore((state) => state.addTemplate);
  const updateTemplate = useRecurringExpenseStore((state) => state.updateTemplate);
  const removeTemplate = useRecurringExpenseStore((state) => state.removeTemplate);
  const setTemplateActive = useRecurringExpenseStore((state) => state.setTemplateActive);

  /**
   * 라운드 58 #1 — 지출 상세("정기 지출로 등록")가 실어 보낸 프리필.
   *
   * 이름은 전부 이 앱에 이미 있는 프리필 계약 그대로이고(itemName·amountKrw·categoryId·
   * paymentMethod) 새로 생긴 이름은 `dayOfMonth` 하나뿐이다. 값 해석은 한 줄도 여기서 하지
   * 않는다 — 판정이 화면과 모듈 두 벌이 되지 않게(이 화면의 규율).
   */
  const params = useLocalSearchParams<{
    itemName?: string;
    amountKrw?: string;
    categoryId?: string;
    paymentMethod?: string;
    dayOfMonth?: string;
  }>();
  // 파싱 자체는 문자열 몇 개를 보는 일이라 memo가 필요 없다(useLocalSearchParams는 매 렌더
  // 새 객체를 주므로 memo를 걸어도 어차피 다시 돈다 — 있지도 않은 안정성을 암시하지 않는다).
  const prefill = parseRecurringTemplatePrefill(params);

  /**
   * 라운드 58 통합리뷰 P2-1 — 분류 이름 해석의 원천: 기록 탭·리포트·CSV와 **같은
   * `["categories"]` 캐시**다.
   *
   * 여기서 목록을 새로 부르지 않는다(useQuery가 아니라 getQueryData — 새 요청 0건):
   * 이 화면은 지출을 만들지 않는 메모 화면이라 열었다는 이유로 네트워크가 돌 이유가 없고,
   * 그 캐시는 홈·기록 탭이 이미 채워 둔다. 같은 관례가 동기화 상태 화면에도 있다
   * (app/sync-status.tsx의 `["categories"]` 구독 주석 — 그쪽은 화면이 오래 떠 있어 구독까지
   * 하고, 이 화면은 프리필을 **여는 순간 한 번** 읽으면 끝이라 읽기만 한다).
   *
   * 이름을 못 구하는 id는 `기타`로 부르지 않는다: `isNamedCategoryId`가 false를 돌려주고,
   * 프리필은 그 분류를 비운 채 열린다(formFromPrefill 주석).
   */
  const queryClient = useQueryClient();
  const cachedCategories = authToken
    ? queryClient.getQueryData<{ categories: CategoryListItem[] }>(["categories"])?.categories
    : undefined;
  const categoryName = useMemo(() => buildCategoryNameLookup(cachedCategories), [cachedCategories]);
  /** 이 앱이 **이름으로 부를 수 있는** 분류인가(8타일 + 캐시에 실제로 있는 서버 분류). */
  const isNamedCategoryId = useMemo(() => {
    const named = new Set<string>(categoryCatalog.map((category) => category.id));
    for (const category of cachedCategories ?? []) {
      if (category?.id && category.name?.trim()) named.add(category.id);
    }
    return (categoryId: string) => named.has(categoryId);
  }, [cachedCategories]);

  // 프리필은 **화면을 처음 열 때 한 번만** 폼에 들어간다(useState 초기값). 이후 사용자가 고친
  // 값을 파라미터가 다시 덮어쓰면, 링크로 열린 화면에서 타이핑이 되돌려지는 것처럼 보인다.
  const [form, setForm] = useState<FormState>(() => formFromPrefill(prefill, isNamedCategoryId));
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * 채워진 채로 열린 폼은 "이미 저장된 것"으로 보인다 — 아직 아무것도 저장되지 않았다는 사실을
   * 폼 위 한 줄이 말한다. 저장하거나 다른 항목을 수정하기 시작하면 그 줄은 사실이 아니게 되므로
   * 함께 사라진다.
   */
  const [showPrefillNotice, setShowPrefillNotice] = useState(prefill.hasPrefill);

  // 이 화면은 **선택된 아이의** 템플릿만 보여준다. 둘째의 정기 지출이 첫째 화면에 섞이면
  // 어느 아이의 약속인지 사용자가 알 수 없다(홈 카드도 같은 기준으로 고른다).
  const childTemplates = useMemo(
    () => templates.filter((template) => template.childId === selectedChildId),
    [templates, selectedChildId]
  );

  /**
   * 폼이 든 분류가 이 화면의 8타일 밖일 수 있다 — 지출은 서버 카테고리 목록(정식 12개)으로도
   * 저장되고, 저장해 둔 템플릿을 "수정"으로 열면 그 id가 그대로 폼에 들어온다. 그때 칩 줄에
   * 아무것도 선택돼 보이지 않으면, 폼은 분류를 들고 있는데 화면은 고르지 않은 것처럼 보인다
   * (그대로 저장하면 사용자가 보지 못한 분류가 남는다). 그래서 그 id의 칩을 앞에 세운다.
   *
   * 라운드 58 통합리뷰 P2-1 — **이름은 `["categories"]` 캐시가 해석한다**(`categoryName` =
   * buildCategoryNameLookup). 종전에는 `categoryNameFor` 하나로 해석했는데, 그 함수는 8타일과
   * 데모 픽스처만 알아서 서버 시드 카테고리(UUID가 DB마다 다르다)가 전부 "기타"로 적혔다 —
   * 리포트 도넛 범례와 CSV가 같은 이유로 이미 이 캐시를 지나고 있었고(src/categories.ts
   * buildCategoryNameLookup 주석), 이 칩만 남아 있었다. 프리필은 이름을 모르는 id를 애초에
   * 싣지 않으므로(formFromPrefill) 이 자리에서 "기타"가 보이는 경우는 캐시가 빈 채로 저장해 둔
   * 템플릿을 수정으로 열 때뿐이고, 그때도 값은 사용자가 저장한 그 분류 그대로다(바꾸지 않는다).
   */
  const categoryChips = useMemo(() => {
    const base = categoryCatalog.map((category) => ({ id: category.id, label: category.label }));
    if (!form.categoryId || base.some((chip) => chip.id === form.categoryId)) return base;
    return [{ id: form.categoryId, label: categoryName(form.categoryId) }, ...base];
  }, [categoryName, form.categoryId]);

  const resetForm = () => {
    setForm(emptyForm);
    setSaveError(null);
    setShowPrefillNotice(false);
  };

  const submit = () => {
    const draft: RecurringTemplateDraft = {
      childId: selectedChildId ?? "",
      itemName: form.itemName,
      amountKrw: form.amountDigits.length > 0 ? Number(form.amountDigits) : Number.NaN,
      categoryId: form.categoryId ?? "",
      paymentMethod: form.paymentMethod,
      merchant: form.merchant,
      dayOfMonth: form.dayDigits.length > 0 ? Number(form.dayDigits) : Number.NaN
    };
    const result = form.editingId ? updateTemplate(form.editingId, draft) : addTemplate(draft);
    if (!result.ok) {
      setSaveError(result.message);
      announceForA11y(result.message);
      return;
    }
    resetForm();
    announceForA11y(form.editingId ? "정기 지출을 수정했어요." : "정기 지출을 저장했어요.");
  };

  const confirmRemove = (template: RecurringExpenseTemplate) => {
    Alert.alert("정기 지출 삭제", `『${template.itemName}』 정기 지출을 목록에서 지울까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          removeTemplate(template.id);
          if (form.editingId === template.id) resetForm();
          announceForA11y("정기 지출을 지웠어요.");
        }
      }
    ]);
  };

  return (
    <AppScreen>
      <View testID={recurringScreenId} style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="지출"
          title="정기 지출"
          subtitle="매월 반복되는 지출을 적어 두면 홈에서 확인할 수 있어요"
          onBack={() => router.back()}
        />

        {/* DNC-013을 사용자 말로 옮긴 한 줄. 화면에서 가장 먼저 읽히는 자리에 둔다. */}
        <Card style={{ gap: 6 }}>
          <Text style={rowTitleStyle}>자동으로 기록되지는 않아요</Text>
          <Text style={rowSubtitleStyle}>
            여기에 적어 두면 그 달에 아직 기록에 없을 때 홈에서 알려드려요. 지출은 확인하고 저장할 때만 남아요.
          </Text>
        </Card>

        {!canManage ? (
          <EmptyStateCard title="로그인하고 아이를 선택하면 정기 지출을 적어 둘 수 있어요." actionLabel="확인" />
        ) : null}

        {canManage ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={sectionTitleStyle}>{form.editingId ? "정기 지출 수정" : "정기 지출 추가"}</Text>
            <Card style={{ gap: 14 }}>
              {/* 라운드 58 #1: 지출에서 넘어와 이미 채워진 폼일 때만 뜨는 한 줄(문구는 순수 모듈). */}
              {showPrefillNotice && !form.editingId ? (
                <Text style={rowSubtitleStyle}>{RECURRING_PREFILL_NOTICE}</Text>
              ) : null}
              <View style={{ gap: 6 }}>
                <Text style={fieldLabelStyle}>품목명</Text>
                <TextInput
                  accessibilityLabel="정기 지출 품목명 입력"
                  maxLength={RECURRING_ITEM_NAME_MAX_LENGTH}
                  onChangeText={(value) => setForm((state) => ({ ...state, itemName: value }))}
                  placeholder="예: 기저귀"
                  placeholderTextColor={theme.colors.gray600}
                  returnKeyType="done"
                  style={inputStyle}
                  value={form.itemName}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={fieldLabelStyle}>금액</Text>
                <View style={amountRowStyle}>
                  <TextInput
                    accessibilityLabel="정기 지출 금액 입력"
                    keyboardType="number-pad"
                    onChangeText={(value) =>
                      setForm((state) => ({ ...state, amountDigits: amountDigitsOnly(value) }))
                    }
                    placeholder="0"
                    placeholderTextColor={theme.colors.gray600}
                    returnKeyType="done"
                    style={[inputStyle, { flex: 1 }]}
                    value={formatAmountDigits(form.amountDigits)}
                  />
                  <Text style={fieldLabelStyle}>원</Text>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={fieldLabelStyle}>분류</Text>
                <View style={chipRowStyle}>
                  {categoryChips.map((category) => (
                    <CategoryChip
                      key={category.id}
                      label={category.label}
                      onPress={() => setForm((state) => ({ ...state, categoryId: category.id }))}
                      selected={form.categoryId === category.id}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={fieldLabelStyle}>결제 수단</Text>
                <View style={chipRowStyle}>
                  {recurringPaymentMethods.map((method) => (
                    <CategoryChip
                      key={method.value}
                      label={method.label}
                      onPress={() => setForm((state) => ({ ...state, paymentMethod: method.value }))}
                      selected={form.paymentMethod === method.value}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={fieldLabelStyle}>결제일</Text>
                <View style={amountRowStyle}>
                  <Text style={fieldLabelStyle}>매월</Text>
                  <TextInput
                    accessibilityLabel="정기 지출 결제일 입력 (1일부터 31일)"
                    keyboardType="number-pad"
                    maxLength={2}
                    onChangeText={(value) =>
                      setForm((state) => ({ ...state, dayDigits: amountDigitsOnly(value).slice(0, 2) }))
                    }
                    placeholder="5"
                    placeholderTextColor={theme.colors.gray600}
                    returnKeyType="done"
                    style={[inputStyle, { width: 72 }]}
                    value={form.dayDigits}
                  />
                  <Text style={fieldLabelStyle}>일</Text>
                </View>
                {/* 없는 날(2월 31일)을 고를 수 있게 두되, 그때 어떻게 되는지 미리 말한다 —
                    판정은 recurringDueDateForMonth가 그 달 말일로 클램프한다. */}
                <Text style={rowSubtitleStyle}>
                  그 달에 없는 날짜(예: 31일)는 그달의 마지막 날로 알려드려요.
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={fieldLabelStyle}>판매처 (선택)</Text>
                <TextInput
                  accessibilityLabel="정기 지출 판매처 입력 (선택)"
                  maxLength={RECURRING_MERCHANT_MAX_LENGTH}
                  onChangeText={(value) => setForm((state) => ({ ...state, merchant: value }))}
                  placeholder="예: 쿠팡"
                  placeholderTextColor={theme.colors.gray600}
                  returnKeyType="done"
                  style={inputStyle}
                  value={form.merchant}
                />
              </View>

              {saveError ? (
                <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                  {saveError}
                </Text>
              ) : null}

              <PrimaryButton label={form.editingId ? "수정 저장" : "저장"} onPress={submit} />
              {form.editingId ? <SecondaryButton label="취소" onPress={resetForm} /> : null}
              <Text style={rowSubtitleStyle}>
                {`저장한 정기 지출 ${childTemplates.length}개 · 최대 ${RECURRING_TEMPLATE_LIMIT}개`}
              </Text>
            </Card>
          </View>
        ) : null}

        {canManage ? (
          <View style={{ gap: theme.spacing.gap }}>
            <Text style={sectionTitleStyle}>저장한 정기 지출</Text>
            {childTemplates.length === 0 ? (
              <Card>
                <Text style={rowSubtitleStyle}>아직 적어 둔 정기 지출이 없어요. 위에서 하나 추가해 보세요.</Text>
              </Card>
            ) : null}
            {childTemplates.map((template) => (
              <Card key={template.id} style={{ gap: 10 }}>
                <View style={toggleRowStyle}>
                  <View style={{ flex: 1, gap: 3, paddingRight: 12 }}>
                    <Text style={rowTitleStyle}>{template.itemName}</Text>
                    <Text style={rowSubtitleStyle}>{formatRecurringTemplateLine(template)}</Text>
                    {template.merchant ? <Text style={rowSubtitleStyle}>{template.merchant}</Text> : null}
                  </View>
                  {template.active ? null : <StatusBadge label="꺼짐" />}
                  <Switch
                    accessibilityLabel={`${template.itemName} 정기 지출 알림`}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: template.active }}
                    onValueChange={(next) => setTemplateActive(template.id, next)}
                    thumbColor={theme.colors.white}
                    trackColor={{ false: theme.colors.gray300, true: theme.colors.mainCoral }}
                    value={template.active}
                  />
                </View>
                <View style={actionRowStyle}>
                  {/*
                    프리필 진입점. 파라미터는 순수 모듈이 만들고(recurringPrefillParams) 빠른 기록
                    시트가 같은 이름으로 파싱한다 — 두 쪽이 갈리면 값이 조용히 사라진다.
                    ⚠️ 이 버튼은 **시트를 열 뿐** 저장하지 않는다. 지출은 사용자가 그 화면에서
                    확인하고 저장할 때만 생긴다(DNC-013).
                    홈 카드(트랙 C)와 중복 잔소리가 아닌 이유: 여기에는 "N건 미기록" 같은 판정이
                    없다. 사용자가 스스로 연 자기 목록의 바로가기일 뿐이다.
                  */}
                  <TextButton
                    accessibilityLabel={recurringRecordAccessibilityLabel(template)}
                    label={RECURRING_RECORD_ACTION_LABEL}
                    onPress={expenseGate.guard(() => {
                      const params = recurringPrefillParams(template);
                      if (!params) return;
                      router.push({ pathname: "/expenses/new", params });
                    })}
                  />
                  <TextButton
                    accessibilityLabel={`${template.itemName} 정기 지출 수정`}
                    label="수정"
                    onPress={() => {
                      setForm(formFromTemplate(template));
                      setSaveError(null);
                      setShowPrefillNotice(false);
                    }}
                  />
                  <Pressable
                    accessibilityLabel={`${template.itemName} 정기 지출 삭제`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => confirmRemove(template)}
                  >
                    <Text style={deleteLinkStyle}>삭제</Text>
                  </Pressable>
                </View>
                <Text style={rowSubtitleStyle}>
                  {`한 번 기록하면 ${formatKrw(template.amountKrw)}이 이번 달 합계에 들어가요.`}
                </Text>
              </Card>
            ))}
            {/* 판정의 한계를 사실대로 밝힌다: 이름이 다르면(‘기저귀’ vs ‘기저귀 대형’) 못 찾고,
                그때 쓰라고 홈 카드에 "이미 기록했어요"가 있다(설계 §6 위험 5). */}
            <Text style={rowSubtitleStyle}>
              적어 둔 날짜가 지났는데 그달 기록에 같은 품목명이 없으면 홈에서 알려드려요. 다른 이름으로 적으셨다면 홈 카드에서
              『{RECURRING_SKIP_ACTION_LABEL}』로 넘길 수 있어요.
            </Text>
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

const toggleRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10
} as const;

const actionRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 16
} as const;

const amountRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 8
} as const;

const chipRowStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8
} as const;

const inputStyle = {
  backgroundColor: theme.colors.beige,
  borderRadius: theme.radii.small,
  color: theme.colors.brown,
  fontSize: 15,
  minHeight: theme.touchTarget,
  paddingHorizontal: 14,
  paddingVertical: 12
} as const;

const fieldLabelStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "700"
} as const;

const rowTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "700"
} as const;

const rowSubtitleStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 17
} as const;

const sectionTitleStyle = {
  color: theme.colors.brown,
  fontSize: 14,
  fontWeight: "800"
} as const;

const deleteLinkStyle = {
  color: theme.colors.danger,
  fontSize: 13,
  fontWeight: "700"
} as const;

const errorTextStyle = {
  color: theme.colors.danger,
  fontSize: 12,
  lineHeight: 17
} as const;
