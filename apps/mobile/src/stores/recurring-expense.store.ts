import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";
// 라운드 59 P3: 중복 판정의 이름 비교는 이 앱의 단일 소스를 그대로 쓴다("물 티슈"/"물티슈"를
// 같게 보는 규칙 — 자동완성·카테고리 추천·정기 지출 판정이 모두 이 함수 하나를 지난다).
import { normalizeItemName } from "../expenses/item-name-match";
import {
  applyRecurringSkip,
  buildRecurringTemplate,
  RECURRING_LIMIT_MESSAGE,
  RECURRING_TEMPLATE_LIMIT,
  recurringTemplateValidationError,
  sanitizeRecurringTemplates,
  type RecurringExpenseTemplate,
  type RecurringTemplateDraft
} from "../expenses/recurring-template";

/**
 * 라운드 55 트랙 A — 반복/고정 지출 템플릿 저장소(설계: docs/5차/round55-plan.md §1.1).
 *
 * ## 왜 오프라인 아웃박스가 아니라 persist 스토어인가
 *
 * 이 저장소에는 지출 행을 담는 곳이 이미 있다: SQLite의 `local_expenses` + `mutation_outbox`
 * (src/offline/*). 하지만 그곳은 **flush가 서버로 올리는** 자리다. 템플릿을 거기 넣으면
 * 사용자가 한 번도 확인하지 않은 지출이 서버에 생긴다 — DNC-013(자동 기록 금지)의 정면 위반이다.
 * 템플릿은 지출이 아니라 **입력 보조**이므로, 저장소의 다른 기기 단위 상태와 같은 자리
 * (zustand persist + persistStorage)에 둔다.
 *
 * persist 관례는 notification-preferences.store.ts를 그대로 본뜬다: `version: 1` +
 * 방어적 sanitize를 `migrate`와 `merge` **양쪽**에 문다. 품목명·금액은 민감 자격증명이 아니므로
 * SecureStore 어댑터(secure-session-storage.ts)는 쓰지 않는다 — 그건 세션 토큰만의 특례다.
 *
 * ## 이 스토어에는 지출을 만드는 경로가 없다
 *
 * `createExpense`도 `createExpenseOffline`도 import하지 않는다. "이미 기록했어요"(`skipThisMonth`)
 * 조차 지출을 만들지 않고 그 달을 목록에서 빼기만 한다. 소스 계약 테스트
 * (src/expenses/recurring-flow.test.ts)가 이 사실을 고정한다.
 *
 * ## PRIV-104 (계정 전환 시 초기화)
 *
 * 여기 담기는 값(품목명·금액·분류·판매처)은 명백한 **계정 데이터**다. 그래서 세션 정체성이
 * 바뀔 때 지워져야 하고, 그 배선(`resetAll()` 호출)은 트랙 C가 src/offline/session-teardown.ts에
 * 넣는다. 대조군인 notification-preferences는 "이 기기에서 어떤 알림을 볼까"라는 기기 단위
 * 선택이라 일부러 합류하지 않는다 — 반복 템플릿은 그 범주가 아니다.
 */

/** 수정 대상이 사라졌을 때(다른 화면에서 지운 뒤 저장). 화면이 그대로 보여준다. */
export const RECURRING_TEMPLATE_MISSING_MESSAGE = "이 정기 지출을 찾을 수 없어요. 목록을 다시 확인해 주세요.";

/**
 * 라운드 59 P3 — 같은 아이 밑에 **같은 품목의 정기 지출**을 두 개 만들려 할 때.
 *
 * 왜 막나: 이 앱의 리마인더 판정은 품목명 하나로 돈다(`buildRecurringReminder` → 이번 달 기록에
 * 그 이름이 있는가). 같은 이름의 템플릿이 둘이면 한 번 기록해도 **두 줄이 함께 사라지고**, 반대로
 * 두 줄이 함께 재촉한다 — 사용자에게는 "기저귀를 두 번 사라"는 카드로 읽힌다. 금액이 다른 두
 * 약속(38,500원과 41,000원)을 적어 둔 사람에게도 앱은 어느 쪽이 기록됐는지 말할 방법이 없다.
 *
 * 그래서 **저장 대신 사실을 말한다**(조용히 버리지도, 조용히 덮어쓰지도 않는다 — 덮어쓰면
 * 사용자가 지운 적 없는 금액·결제일이 사라진다). 무엇을 하면 되는지까지 한 줄에 담는다: 기존
 * 항목을 수정하면 된다. 그 항목은 이미 같은 화면의 목록에 서 있다(app/expenses/recurring.tsx).
 *
 * ⚠️ 자리: 정기 지출 문구의 단일 소스는 src/expenses/recurring-template.ts다. 이 두 개만 여기
 * 있는 이유는 라운드 59 트랙 A가 그 파일을 소유해 같은 라운드에서 충돌하기 때문이고, 문구를
 * 그 모듈로 옮기는 것은 다음 라운드의 몫이다(RECURRING_TEMPLATE_MISSING_MESSAGE가 이미 이
 * 파일에 있는 것과 같은 모양이라 튀지도 않는다).
 */
export function recurringDuplicateMessage(itemName: string): string {
  return `『${itemName.trim()}』 정기 지출이 이미 있어요. 기존 항목을 수정해 주세요.`;
}

/**
 * 역방향 등록 버튼(지출 상세 "정기 지출로 등록")이 **이미 등록된 지출**에서 다는 표기.
 *
 * 판정은 아래 `findRecurringTemplateByItemName` 하나뿐이라 화면이 규칙을 다시 적지 않는다.
 */
export const RECURRING_ALREADY_REGISTERED_LABEL = "이미 등록됨";

/**
 * 라운드 59 P3 — 이 아이 밑에 **같은 품목명의 템플릿**이 이미 있는가(있으면 그 항목).
 *
 * 중복 판정과 "이미 등록됨" 표기가 **같은 함수**를 지나게 하려고 순수 함수로 내놓는다. 값 비교는
 * `normalizeItemName`이라 "물 티슈"와 "물티슈"는 같은 항목이고, 아이가 다르면 같은 이름이어도
 * 다른 항목이다(첫째와 둘째가 각자 '기저귀'를 적어 둘 수 있어야 한다).
 *
 * 접점(이 라운드 밖): app/expenses/[expenseId].tsx의 "정기 지출로 등록"이 이 함수로 판정해
 * `RECURRING_ALREADY_REGISTERED_LABEL`을 달면, 눌러 봐야 저장에서 거절당하는 왕복이 없어진다.
 * 그 파일은 라운드 59 트랙 B의 소유가 아니라 배선을 하지 않았다 — 후속 배선용 계약이다.
 */
export function findRecurringTemplateByItemName(
  templates: readonly RecurringExpenseTemplate[],
  childId: string | null | undefined,
  itemName: string,
  options: { excludeId?: string } = {}
): RecurringExpenseTemplate | null {
  const child = childId?.trim() ?? "";
  if (child.length === 0) return null;
  const name = normalizeItemName(itemName ?? "");
  if (name.length === 0) return null;
  return (
    templates.find(
      (template) =>
        template.id !== options.excludeId &&
        template.childId === child &&
        normalizeItemName(template.itemName) === name
    ) ?? null
  );
}

/**
 * 라운드 59 #4 — 상한 20은 **아이 한 명당**이다.
 *
 * 종전에는 판정이 전역(`templates.length`)인데 화면 표기는 아이별(`childTemplates.length`)이라,
 * 둘째의 정기 지출을 하나도 못 적는 사람에게 화면이 "저장한 정기 지출 0개 · 최대 20개"라고
 * 말했다 — 화면이 말한 것과 앱이 하는 일이 다른, 정직성 문제였다. 상한의 근거(홈 카드 한 장·관리
 * 화면 한 화면에 들어가야 한다 — recurring-template.ts `RECURRING_TEMPLATE_LIMIT` 주석)도 아이별
 * 판정과 맞는다: 그 두 화면은 언제나 **선택된 아이**의 템플릿만 그린다.
 *
 * 마이그레이션: 전역 20 이하로 저장된 기존 blob은 아이별로도 전부 20 이하라 그대로 살아난다
 * (사용자가 보는 목록이 한 줄도 달라지지 않는다).
 */
function templateCountForChild(templates: readonly RecurringExpenseTemplate[], childId: string): number {
  return templates.reduce((count, template) => (template.childId === childId ? count + 1 : count), 0);
}

/** 저장 시도의 결과. 실패는 예외가 아니라 **값**이다(화면이 문장을 그대로 보여준다). */
export type RecurringTemplateSaveResult =
  | { ok: true; template: RecurringExpenseTemplate }
  | { ok: false; message: string };

export type RecurringExpenseState = {
  templates: RecurringExpenseTemplate[];
  /**
   * 새 템플릿. 검증 실패·상한 초과(**아이별** 20개)·같은 아이의 같은 품목명 중복은 저장하지
   * 않고 이유를 돌려준다(라운드 59 #4·P3).
   */
  addTemplate: (draft: RecurringTemplateDraft) => RecurringTemplateSaveResult;
  /** 기존 템플릿 수정(id·createdAt·skip 이력·active는 그대로 유지된다). */
  updateTemplate: (id: string, draft: RecurringTemplateDraft) => RecurringTemplateSaveResult;
  removeTemplate: (id: string) => void;
  setTemplateActive: (id: string, active: boolean) => void;
  /** "이번 달은 이미 기록했어요" — 지출을 만들지 않는다. */
  skipThisMonth: (id: string, yearMonth: string) => void;
  /** PRIV-104: 계정 정체성이 바뀔 때 전부 지운다. */
  resetAll: () => void;
};

/**
 * 로컬 id. 관례는 src/api/local-backend.ts의 `local-${prefix}-${base36 시각}-${카운터}`다
 * (같은 밀리초에 두 건을 만들어도 카운터가 갈라 준다).
 */
let localIdCounter = 0;
function generateRecurringTemplateId(): string {
  localIdCounter += 1;
  return `local-recurring-${Date.now().toString(36)}-${localIdCounter}`;
}

/** 저장된 blob의 원본 배열(형식이 아니면 빈 배열). 그룹으로 나누기 전에 한 번만 꺼낸다. */
function rawTemplateList(persisted: unknown): unknown[] {
  const list =
    persisted && typeof persisted === "object" ? (persisted as { templates?: unknown }).templates : persisted;
  return Array.isArray(list) ? list : [];
}

/** blob 한 줄이 말하는 아이(문자열이 아니면 ""). 검증은 하지 않는다 — 묶기 위한 열쇠일 뿐이다. */
function rawChildIdOf(candidate: unknown): string {
  if (!candidate || typeof candidate !== "object") return "";
  const childId = (candidate as { childId?: unknown }).childId;
  return typeof childId === "string" ? childId.trim() : "";
}

function rawIdOf(candidate: unknown): string {
  if (!candidate || typeof candidate !== "object") return "";
  const id = (candidate as { id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

/**
 * 저장된 blob에서 살릴 수 있는 것만 남긴다(값 규칙은 전부 순수 모듈에 있다).
 *
 * 라운드 59 #4 — **절단도 아이별**이다. `sanitizeRecurringTemplates`는 상한을 목록 앞에서부터
 * 전역으로 세어 20개에서 끊는다. 상한이 아이별이 된 지금 그 절단을 그대로 두면, 첫째의 템플릿
 * 20개 뒤에 저장된 **둘째의 템플릿이 앱을 다시 켤 때 통째로 사라진다** — 저장은 됐는데 재시작
 * 후 없어지는, 사용자가 손쓸 수 없는 소실이다.
 *
 * 그래서 아이별로 나눠 같은 함수를 각각 지나게 하고(규칙을 여기 다시 적지 않는다 — 검증·상한·
 * skip 이력 정리가 전부 그 모듈 것이다), 결과를 **원래 순서대로** 되돌린다(목록 순서는 사용자가
 * 저장한 순서다). 순수 모듈을 고치지 않는 이유: 그 파일은 이 라운드에서 트랙 A의 소유다 —
 * 아이별 절단을 그 안으로 옮기는 것은 후속 정리로 남긴다.
 *
 * 옛 blob에 같은 아이·같은 품목명이 둘 들어 있어도 **지우지 않는다**(중복 가드는 이 라운드부터
 * 저장 시점에 선다). 읽는 쪽에서 조용히 지우면 사용자가 적어 둔 약속이 설명 없이 사라진다.
 */
function sanitizedState(persisted: unknown) {
  const list = rawTemplateList(persisted);
  const byChild = new Map<string, unknown[]>();
  for (const candidate of list) {
    const key = rawChildIdOf(candidate);
    const group = byChild.get(key);
    if (group) group.push(candidate);
    else byChild.set(key, [candidate]);
  }
  const survivors = new Map<string, RecurringExpenseTemplate>();
  for (const group of byChild.values()) {
    for (const template of sanitizeRecurringTemplates({ templates: group })) {
      if (!survivors.has(template.id)) survivors.set(template.id, template);
    }
  }
  const templates: RecurringExpenseTemplate[] = [];
  const emitted = new Set<string>();
  for (const candidate of list) {
    const id = rawIdOf(candidate);
    if (id.length === 0 || emitted.has(id)) continue;
    const template = survivors.get(id);
    if (!template) continue;
    emitted.add(id);
    templates.push(template);
  }
  return { templates };
}

export const useRecurringExpenseStore = create<RecurringExpenseState>()(
  persist(
    (set, get) => ({
      templates: [],

      addTemplate: (draft) => {
        const invalid = recurringTemplateValidationError(draft);
        if (invalid !== null) return { ok: false, message: invalid };
        // 검증을 지났으므로 아이는 반드시 있다(RECURRING_CHILD_REQUIRED_MESSAGE).
        const childId = draft.childId.trim();
        // 라운드 59 #4: 상한은 **이 아이의** 템플릿 수로 센다(위 templateCountForChild 주석).
        // 상한은 저장 **전에** 말한다 — 조용히 버리면 사용자는 저장된 줄 안다(수용 기준 #2).
        if (templateCountForChild(get().templates, childId) >= RECURRING_TEMPLATE_LIMIT) {
          return { ok: false, message: RECURRING_LIMIT_MESSAGE };
        }
        // 라운드 59 P3: 같은 아이·같은 품목명은 하나뿐이다(위 recurringDuplicateMessage 주석).
        const duplicate = findRecurringTemplateByItemName(get().templates, childId, draft.itemName);
        if (duplicate) return { ok: false, message: recurringDuplicateMessage(duplicate.itemName) };
        const template = buildRecurringTemplate(draft, {
          id: generateRecurringTemplateId(),
          createdAt: new Date().toISOString()
        });
        if (!template) return { ok: false, message: RECURRING_LIMIT_MESSAGE };
        set((state) => ({ templates: [...state.templates, template] }));
        return { ok: true, template };
      },

      updateTemplate: (id, draft) => {
        const invalid = recurringTemplateValidationError(draft);
        if (invalid !== null) return { ok: false, message: invalid };
        const existing = get().templates.find((template) => template.id === id);
        if (!existing) return { ok: false, message: RECURRING_TEMPLATE_MISSING_MESSAGE };
        // 라운드 59 P3: 이름을 고쳐 **다른 항목과 같아지는** 경우도 중복이다(자기 자신은 뺀다 —
        // 금액만 고치는 평범한 수정이 자기 이름에 걸리면 아무것도 수정할 수 없다).
        const duplicate = findRecurringTemplateByItemName(get().templates, draft.childId, draft.itemName, {
          excludeId: existing.id
        });
        if (duplicate) return { ok: false, message: recurringDuplicateMessage(duplicate.itemName) };
        // 수정은 **내용만** 바꾼다: 만든 시각과 "이미 기록했어요" 이력, on/off 상태는 사용자가
        // 따로 손댄 값이라 금액을 고쳤다고 되돌아가면 안 된다(이번 달 넘김이 되살아난다).
        const next = buildRecurringTemplate(draft, {
          id: existing.id,
          createdAt: existing.createdAt,
          active: existing.active,
          skippedYearMonths: existing.skippedYearMonths
        });
        if (!next) return { ok: false, message: RECURRING_TEMPLATE_MISSING_MESSAGE };
        set((state) => ({
          templates: state.templates.map((template) => (template.id === id ? next : template))
        }));
        return { ok: true, template: next };
      },

      removeTemplate: (id) =>
        set((state) => {
          const templates = state.templates.filter((template) => template.id !== id);
          // 값이 바뀌지 않으면 같은 배열을 유지한다(구독자가 헛돌지 않게).
          return templates.length === state.templates.length ? state : { templates };
        }),

      setTemplateActive: (id, active) =>
        set((state) => {
          const target = state.templates.find((template) => template.id === id);
          if (!target || target.active === active) return state;
          return {
            templates: state.templates.map((template) =>
              template.id === id ? { ...template, active } : template
            )
          };
        }),

      skipThisMonth: (id, yearMonth) =>
        set((state) => {
          const target = state.templates.find((template) => template.id === id);
          if (!target) return state;
          const next = applyRecurringSkip(target, yearMonth);
          // applyRecurringSkip은 바뀌지 않으면 **같은 객체**를 돌려준다.
          if (next === target) return state;
          return { templates: state.templates.map((template) => (template.id === id ? next : template)) };
        }),

      resetAll: () => set((state) => (state.templates.length === 0 ? state : { templates: [] }))
    }),
    {
      name: "wooriai-recurring-expenses",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ templates: state.templates }),
      migrate: (persisted) => sanitizedState(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })
    }
  )
);
