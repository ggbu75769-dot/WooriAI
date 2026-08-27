/**
 * UX-L(A) — 기록 목록 행의 롱프레스 액션시트 + "같은 내용으로 또 기록" 프리필 계약(순수 로직).
 *
 * 왜 필요한가: 기록 탭의 행 탭은 무조건 상세(/expenses/{id})로 갔고, 삭제는 그 상세 화면
 * **맨 아래** 텍스트 링크였다(탭 3회 + 카드 전체 스크롤). 반복 구매(기저귀·분유)를 다시 적는
 * 경로는 아예 없어서, 같은 품목을 매번 처음부터 타이핑해야 했다. 이 모듈은 행 하나에서 바로
 * 고를 수 있는 세 갈래(수정 / 같은 내용으로 또 기록 / 삭제)를 **한 곳에서** 만든다.
 *
 * "한 곳에서"가 중요한 이유: 이 목록은 눈으로 보는 액션시트와 스크린리더의 커스텀 액션
 * (accessibilityActions)을 **동시에** 먹인다. 롱프레스는 스크린리더 사용자가 발견할 수 없는
 * 제스처라 두 경로가 반드시 있어야 하는데, 둘을 따로 적으면 한쪽에만 항목이 늘거나 선물 행의
 * 제외 규칙이 갈린다.
 *
 * 이 모듈은 react-native / expo-router / 저장소에 의존하지 않는다(vitest 단위 테스트 대상).
 * 화면은 여기서 받은 라벨·순서·버튼 스타일을 그대로 RN Alert / accessibilityActions에 꽂기만 한다.
 */

/** 행에서 고를 수 있는 동작. 액션시트 항목 = 스크린리더 커스텀 액션 이름. */
export type RecordRowActionKey = "edit" | "repeat" | "delete";

export type RecordRowAction = {
  key: RecordRowActionKey;
  /** 액션시트 버튼 · 스크린리더 액션 메뉴에 보이는 문구. */
  label: string;
  /** 힌트 문장처럼 여러 개를 한 줄에 늘어놓을 때 쓰는 짧은 이름. */
  shortLabel: string;
  /** 파괴적 동작인가(Alert 버튼 style="destructive"). */
  destructive: boolean;
};

export const RECORD_ROW_EDIT_LABEL = "수정";
/** 반복 구매 재기록. "또 기록"만으로는 무엇이 복사되는지 알 수 없어 문장형으로 둔다. */
export const RECORD_ROW_REPEAT_LABEL = "같은 내용으로 또 기록";
export const RECORD_ROW_DELETE_LABEL = "삭제";
export const RECORD_ROW_CANCEL_LABEL = "취소";

/** 액션시트 본문. 제목은 행의 품목명이라 여기서는 "무엇을 할지"만 묻는다(DNC-018 해요체). */
export const RECORD_ROW_SHEET_MESSAGE = "이 기록으로 무엇을 할까요?";

/** 품목명이 빈 행(레거시/손상 데이터)에서 쓰는 액션시트 제목 — 이름을 지어내지 않는다. */
export const RECORD_ROW_SHEET_FALLBACK_TITLE = "지출 기록";

/**
 * RN Alert(Android)의 버튼 상한. Alert.js가 `buttons.slice(0, 3)`으로 **말없이 잘라내고**
 * 남은 셋을 neutral/negative/positive에 배치한다 — 그래서 취소까지 넣어 4개를 보내면
 * 안드로이드에서는 마지막 버튼이 조용히 사라진다. 아래 buildRecordRowActionSheet가 이 상한을
 * 알고 취소 버튼을 넣을지 결정한다(넣지 못하는 경우에는 cancelable로 물러날 길을 남긴다).
 */
export const ANDROID_ALERT_BUTTON_LIMIT = 3;

/**
 * 이 행을 "같은 내용으로 또 기록"할 수 있는가.
 *
 * DNC-015: 선물은 지출 합계에서 제외된다. 선물 행을 일반 지출로 복사하면 사용자가 쓰지 않은
 * 돈이 이번 달 합계에 들어가 버린다 — 그건 허위 표시다. 반대로 "선물도 복사"는 의미가 없다:
 * 선물은 다시 사는 물건이 아니라 받은 물건이라 "또 기록"이라는 반복 구매 동선 자체가 성립하지
 * 않는다(같은 이유로 EXP-113 최근 품목 칩도 선물 행을 후보에서 뺀다 — recent-items.ts).
 * 그래서 선물·환불 행에서는 이 항목을 **아예 내놓지 않는다**(선물 아님으로 몰래 바꾸지 않는다).
 *
 * expenseType이 없는 레거시 행은 expense로 간주한다(recent-items.ts와 같은 규칙).
 */
export function isRepeatableExpenseType(expenseType?: string | null): boolean {
  return expenseType === undefined || expenseType === null || expenseType === "expense";
}

/** 행에서 "또 기록"을 내놓을 수 있는지 판정할 때 보는 필드. 모르는 필드는 넘기지 않는다. */
export type RepeatableRowInput = {
  /** 품목명. `undefined`면 "이 호출부가 아직 모르는 값"이라 검사에서 빠진다. */
  itemName?: string | null;
  /** 원화 정수 금액(DNC-013). `undefined`면 위와 같이 검사에서 빠진다. */
  amountKrw?: number | null;
  expenseType?: string | null;
};

/**
 * 라운드 38 H-7 — 아는 필드만으로 "또 기록"을 검사할 때 통과시키는 대체값.
 * 판정 규칙을 여기 다시 적지 않기 위한 자리 채움일 뿐이라 화면에 나가지 않는다.
 */
const REPEAT_CHECK_KNOWN_GOOD_ITEM_NAME = "-";
const REPEAT_CHECK_KNOWN_GOOD_AMOUNT_KRW = 1;

/**
 * 이 행에 "또 기록" 항목을 내놓을 수 있는가.
 *
 * 라운드 38 H-7: 종전에는 이 목록이 `expenseType`만 봤고, 프리필을 만드는
 * `buildRepeatExpenseParams`는 여기에 더해 **빈 품목명·0 이하 금액**도 막았다. 두 규칙이 갈린
 * 만큼(손상된 레거시 행, 금액이 0인 행) 액션시트와 스크린리더 액션 메뉴에 "같은 내용으로 또
 * 기록"이 보이는데 눌러도 아무 일도 일어나지 않는 항목이 남았다 — 반응 없는 버튼은 고장으로
 * 읽힌다. 그래서 판정을 그 함수에 **그대로 위임한다**(규칙을 이 파일에 두 번 적지 않는 것이
 * 요점이다). 아직 넘어오지 않은 필드는 통과값으로 채워, 아는 만큼만 검사한다.
 */
export function canRepeatRecordRow(row: RepeatableRowInput): boolean {
  return (
    buildRepeatExpenseParams({
      itemName: typeof row.itemName === "string" ? row.itemName : REPEAT_CHECK_KNOWN_GOOD_ITEM_NAME,
      amountKrw: typeof row.amountKrw === "number" ? row.amountKrw : REPEAT_CHECK_KNOWN_GOOD_AMOUNT_KRW,
      expenseType: row.expenseType
    }) !== null
  );
}

/** 행에서 고를 수 있는 동작 목록. 삭제는 **항상 마지막**이다(아래 힌트 문장의 조사 근거이기도 하다). */
export function buildRecordRowActions(input: RepeatableRowInput): RecordRowAction[] {
  const actions: RecordRowAction[] = [
    { key: "edit", label: RECORD_ROW_EDIT_LABEL, shortLabel: "수정", destructive: false }
  ];
  // 프리필을 만들 수 없는 행에서는 항목 자체를 빼므로, 액션시트와 accessibilityActions
  // (recordRowAccessibilityActions는 이 목록을 그대로 옮긴다) 어디에도 남지 않는다.
  if (canRepeatRecordRow(input)) {
    actions.push({ key: "repeat", label: RECORD_ROW_REPEAT_LABEL, shortLabel: "또 기록", destructive: false });
  }
  actions.push({ key: "delete", label: RECORD_ROW_DELETE_LABEL, shortLabel: "삭제", destructive: true });
  return actions;
}

/** RN `accessibilityActions` 배열. 이름은 액션 키 그대로라 핸들러가 문자열을 다시 매핑하지 않는다. */
export function recordRowAccessibilityActions(actions: readonly RecordRowAction[]): { name: RecordRowActionKey; label: string }[] {
  return actions.map((action) => ({ name: action.key, label: action.label }));
}

/**
 * `onAccessibilityAction`이 받은 액션 이름 → 이 행이 실제로 제공하는 동작.
 *
 * 목록에 없는 이름(다른 화면의 액션, OS가 보내는 표준 액션)은 null로 떨어뜨린다 — 선물 행에
 * 존재하지도 않는 "또 기록"이 어떤 경로로든 들어와 실행되는 일이 없어야 한다.
 */
export function resolveRecordRowAction(
  actionName: string,
  actions: readonly RecordRowAction[]
): RecordRowActionKey | null {
  const matched = actions.find((action) => action.key === actionName);
  return matched ? matched.key : null;
}

/**
 * 스크린리더 힌트. 롱프레스는 눈에 보이지 않는 제스처라 "여기에 뭔가 더 있다"는 사실 자체를
 * 말해 줘야 한다(커스텀 액션 메뉴는 TalkBack/VoiceOver 버전에 따라 자동 안내가 없다).
 *
 * 조사: 목록의 **마지막은 언제나 "삭제"**(buildRecordRowActions)라 "…를"로 끝내면 항상 맞는다.
 */
export function recordRowAccessibilityHint(actions: readonly RecordRowAction[]): string {
  return `길게 누르면 ${actions.map((action) => action.shortLabel).join("·")}를 고를 수 있어요.`;
}

/**
 * 행 전체의 스크린리더 라벨.
 *
 * 왜 직접 만드나: 롱프레스/커스텀 액션을 얹으려면 바깥 Pressable 하나가 행 전체의 접근성
 * 요소가 되어야 하고(안쪽 공용 ListRow는 접근성 트리에서 감춘다), 그러면 라벨을 명시해야 한다.
 * 인자는 화면이 ListRow에 넘기는 **바로 그 세 문자열**이라 보이는 것과 읽히는 것이 갈릴 수 없다.
 * 쉼표로 끊는 이유는 "기저귀 기저귀 · 8월 27일 38,500원"처럼 한 덩어리로 이어 읽히지 않게
 * 하기 위해서다.
 */
export function recordRowAccessibilityLabel(input: {
  itemName: string;
  subtitle: string;
  amountLabel: string;
}): string {
  return [input.itemName, input.subtitle, input.amountLabel].filter((part) => part.trim().length > 0).join(", ");
}

/** 액션시트 버튼 하나. `actionKey`가 null이면 취소(아무 일도 하지 않는다). */
export type RecordRowAlertButton = {
  label: string;
  actionKey: RecordRowActionKey | null;
  style?: "cancel" | "destructive";
};

export type RecordRowActionSheet = {
  title: string;
  message: string;
  buttons: RecordRowAlertButton[];
  /** Android Alert은 기본이 cancelable:false다 — 취소 버튼을 못 넣을 때 반드시 켜야 갇히지 않는다. */
  cancelable: boolean;
};

/**
 * 액션시트(=이 앱의 관례인 RN Alert 다중 버튼) 구성.
 *
 * 이 앱에는 별도 액션시트 컴포넌트가 없고, 확인/선택은 전부 `Alert.alert(제목, 문구, 버튼[])`
 * 관례를 쓴다(app/sync-status.tsx, app/items/[itemTemplateId].tsx, app/expenses/[expenseId].tsx).
 * 그래서 새 UI 관례를 만들지 않고 같은 Alert를 쓰되, **플랫폼별 버튼 상한**만 여기서 흡수한다.
 *
 * - 취소 버튼이 상한 안에 들어가면 넣는다(iOS는 상한이 없어 항상 들어간다).
 * - 들어가지 못하면(Android + 동작 3개) 취소를 빼고 `cancelable`을 켠다. 버튼이 조용히 잘려
 *   사라지는 것보다, 뒤로 가기/바깥 탭이라는 안드로이드 표준 동작으로 빠져나가는 편이 낫다.
 *   cancelable은 두 경우 모두 켠다(취소 버튼이 있어도 뒤로 가기를 막을 이유가 없다).
 */
export function buildRecordRowActionSheet(input: {
  itemName: string;
  /** 라운드 38 H-7: 넘기면 "또 기록"이 프리필 규칙(0 이하 금액 제외)까지 통과한 경우에만 뜬다. */
  amountKrw?: number | null;
  expenseType?: string | null;
  platform: string;
}): RecordRowActionSheet {
  const actions = buildRecordRowActions({
    itemName: input.itemName,
    amountKrw: input.amountKrw,
    expenseType: input.expenseType
  });
  const buttons: RecordRowAlertButton[] = actions.map((action) => ({
    label: action.label,
    actionKey: action.key,
    ...(action.destructive ? { style: "destructive" as const } : {})
  }));
  const buttonLimit = input.platform === "android" ? ANDROID_ALERT_BUTTON_LIMIT : Number.POSITIVE_INFINITY;
  if (buttons.length < buttonLimit) {
    buttons.push({ label: RECORD_ROW_CANCEL_LABEL, actionKey: null, style: "cancel" });
  }
  return {
    title: input.itemName.trim() || RECORD_ROW_SHEET_FALLBACK_TITLE,
    message: RECORD_ROW_SHEET_MESSAGE,
    buttons,
    cancelable: true
  };
}

// ---------------------------------------------------------------------------------------------
// "같은 내용으로 또 기록" 프리필 계약 (기록 탭 → /expenses/new)
//
// 기존 계약은 itemName·itemTemplateId 두 개였다(준비템 → 지출 기록 동선). 여기에 amountKrw·
// categoryId를 **추가**한다. 직렬화(기록 탭)와 파싱(빠른 기록 시트)을 한 파일에 두는 이유는
// 하나뿐이다: 두 쪽이 갈리면 값이 조용히 사라지고, 그건 사용자가 "또 기록"을 눌렀는데 금액만
// 빈 채로 열리는 형태로만 드러난다. 한 모듈이면 왕복 테스트로 고정할 수 있다.
//
// 날짜(spentOn)는 **일부러 넘기지 않는다**. 이건 과거 기록의 복사가 아니라 새 기록이라,
// 시트가 늘 하듯 오늘 날짜로 시작해야 한다(지난달 행에서 또 기록을 눌러 지난달로 저장되면
// 이번 달 합계가 조용히 어긋난다).
// ---------------------------------------------------------------------------------------------

/** URL 파라미터로 실려 가는 값(전부 문자열). categoryId는 없을 수 있다. */
export type RepeatExpenseParams = {
  itemName: string;
  amountKrw: string;
  categoryId?: string;
};

/**
 * 행 → 프리필 파라미터. 그대로 다시 기록할 수 없는 행이면 null이다.
 *
 * 라운드 38 H-7: 이 세 줄이 "또 기록이 가능한가"의 **유일한 정의**다 — 행 액션 목록
 * (`canRepeatRecordRow` → `buildRecordRowActions`)이 이 함수를 호출해 판정하므로, 목록에 뜨는데
 * 눌러도 아무 일이 없는 항목이 생길 수 없다.
 *
 * 금액 규칙은 DNC-013(0보다 큰 원화 정수)과 같다.
 */
export function buildRepeatExpenseParams(row: {
  itemName: string;
  amountKrw: number;
  categoryId?: string | null;
  expenseType?: string | null;
}): RepeatExpenseParams | null {
  if (!isRepeatableExpenseType(row.expenseType)) return null;
  const itemName = row.itemName?.trim() ?? "";
  if (itemName.length === 0) return null;
  if (!Number.isInteger(row.amountKrw) || row.amountKrw <= 0) return null;
  const categoryId = row.categoryId?.trim() ?? "";
  return {
    itemName,
    amountKrw: String(row.amountKrw),
    ...(categoryId.length > 0 ? { categoryId } : {})
  };
}

/** 빠른 기록 시트가 실제로 쓰는 프리필 값. */
export type ExpensePrefill = {
  /** 품목명(없으면 빈 문자열 — 기존 계약 그대로). */
  itemName: string;
  /** 금액 입력칸에 넣을 숫자 문자열(유효하지 않으면 빈 문자열 = 예전처럼 빈 칸에서 시작). */
  amountText: string;
  /** 카테고리 id(없으면 null). 이 id가 시트의 8타일 밖이면 화면이 무시한다. */
  categoryId: string | null;
};

/** expo-router의 파라미터는 string | string[] 둘 다 올 수 있다 — 첫 값만 읽는다. */
function firstParamValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

/**
 * 프리필 파라미터 파싱. 잘못된 값(음수·소수·문자·0)은 **조용히 버린다** — 링크로 들어온
 * 금액을 그대로 믿고 칸에 넣으면 저장 가드에 걸려 이유 없이 막히는 화면이 된다. 버려도
 * 사용자는 평소처럼 금액을 치면 되고, 잘못된 값이 기록에 남는 경로는 생기지 않는다.
 */
export function parseExpensePrefillParams(params: {
  itemName?: unknown;
  amountKrw?: unknown;
  categoryId?: unknown;
}): ExpensePrefill {
  const itemName = firstParamValue(params.itemName).trim();
  const amountRaw = firstParamValue(params.amountKrw).trim();
  const amountKrw = /^\d+$/.test(amountRaw) ? Number(amountRaw) : Number.NaN;
  const amountText = Number.isInteger(amountKrw) && amountKrw > 0 ? String(amountKrw) : "";
  const categoryId = firstParamValue(params.categoryId).trim();
  return { itemName, amountText, categoryId: categoryId.length > 0 ? categoryId : null };
}
