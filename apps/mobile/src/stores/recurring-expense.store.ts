import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";
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

/** 저장 시도의 결과. 실패는 예외가 아니라 **값**이다(화면이 문장을 그대로 보여준다). */
export type RecurringTemplateSaveResult =
  | { ok: true; template: RecurringExpenseTemplate }
  | { ok: false; message: string };

export type RecurringExpenseState = {
  templates: RecurringExpenseTemplate[];
  /** 새 템플릿. 상한 초과·검증 실패는 저장하지 않고 이유를 돌려준다. */
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

/** 저장된 blob에서 살릴 수 있는 것만 남긴다(규칙은 전부 순수 모듈에 있다). */
function sanitizedState(persisted: unknown) {
  return { templates: sanitizeRecurringTemplates(persisted) };
}

export const useRecurringExpenseStore = create<RecurringExpenseState>()(
  persist(
    (set, get) => ({
      templates: [],

      addTemplate: (draft) => {
        const invalid = recurringTemplateValidationError(draft);
        if (invalid !== null) return { ok: false, message: invalid };
        // 상한은 저장 **전에** 말한다 — 조용히 버리면 사용자는 저장된 줄 안다(수용 기준 #2).
        if (get().templates.length >= RECURRING_TEMPLATE_LIMIT) {
          return { ok: false, message: RECURRING_LIMIT_MESSAGE };
        }
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
