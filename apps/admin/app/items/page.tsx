"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  CHILD_STAGE_CODES,
  CHILD_STAGE_LABELS,
  NECESSITY_LEVELS,
  NECESSITY_LEVEL_LABELS,
  createIdempotencyKeyHolder,
  createItemTemplate,
  draftAndSubmitContentRevision,
  isAuthError,
  listAdminCategories,
  listItemTemplates,
  updateItemTemplate,
  type AdminCategory,
  type ChildStageCode,
  type ItemTemplate,
  type ItemTemplateInput,
  type NecessityLevel
} from "../../src/lib/admin-api";
import { ADMIN_WRITE_ROLE_NOTICE } from "../../src/lib/admin-role-copy";
import { itemCategoryOptions, type ItemCategoryOption } from "../../src/lib/item-category-options";
import { loadErrorCopy, loadErrorMessage, type LoadErrorCopy } from "../../src/lib/load-error-copy";
import { writeErrorMessage } from "../../src/lib/write-error-copy";
import {
  EMPTY_ITEM_FILTERS,
  activeProductLinkCount,
  filterItemTemplates,
  hasAnyItemFilter,
  itemFilterSummary,
  productLinkCount,
  type ItemFilterState
} from "../../src/lib/item-filters";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

type ItemFormState = {
  name: string;
  /** 분류 categoryId. ""는 "고르지 않음" — 생성이면 분류 없이 저장, 수정이면 기존 분류 유지. */
  categoryId: string;
  necessityLevel: NecessityLevel;
  timingLabel: string;
  priceMinKrw: string;
  priceMaxKrw: string;
  reasonText: string;
  skipReasonText: string;
  usedSecondhandOk: boolean;
  safetyNote: string;
  medicalDisclaimerRequired: boolean;
  stageCodes: ChildStageCode[];
  active: boolean;
};

function emptyItemForm(): ItemFormState {
  return {
    name: "",
    categoryId: "",
    necessityLevel: "essential",
    timingLabel: "",
    priceMinKrw: "",
    priceMaxKrw: "",
    reasonText: "",
    skipReasonText: "",
    usedSecondhandOk: false,
    safetyNote: "",
    medicalDisclaimerRequired: false,
    stageCodes: [],
    active: true
  };
}

/**
 * ADM-124: 수정 폼은 저장된 값을 그대로 보여줘야 한다. 예전에는 가격 두 칸만 늘 빈칸으로
 * 시작해서 (1) 현재 가격대를 폼에서 확인할 수 없고, (2) 빈칸=미전송이라 한 번 넣은
 * 가격대를 지울 수도 없었다. 이제 서버가 원시 값(priceMinKrw/priceMaxKrw)을 내려주므로
 * 다른 필드(timingLabel 등)와 같은 규칙 — 프리필하고, 비우면 지운다 — 을 따른다.
 */
function itemFormFromTemplate(item: ItemTemplate): ItemFormState {
  return {
    name: item.name,
    // 라운드 49 C-02: 어드민 상세 응답이 categoryId를 실어 주면 그대로 프리필한다.
    // 아직 안 실어 주는 동안에는 빈 선택으로 시작하고, 빈 선택은 "그대로 둠"이다.
    categoryId: item.categoryId ?? "",
    necessityLevel: item.necessityLevel,
    timingLabel: item.timingLabel ?? "",
    priceMinKrw: item.priceMinKrw == null ? "" : String(item.priceMinKrw),
    priceMaxKrw: item.priceMaxKrw == null ? "" : String(item.priceMaxKrw),
    reasonText: item.reasonText,
    skipReasonText: item.skipReasonText ?? "",
    usedSecondhandOk: item.usedSecondhandOk,
    safetyNote: item.safetyNote ?? "",
    // 라운드 48 T1: 서버가 이 값을 내려주기 전 응답과 섞여도 체크박스가 깨지지 않게 기본 false.
    medicalDisclaimerRequired: item.medicalDisclaimerRequired ?? false,
    stageCodes: item.stageCodes,
    active: item.active
  };
}

function validateItemForm(form: ItemFormState): string | null {
  if (!form.name.trim()) return "이름을 입력해 주세요.";
  if (!form.reasonText.trim()) return "이유를 입력해 주세요.";
  const min = form.priceMinKrw.trim();
  const max = form.priceMaxKrw.trim();
  if (min && Number.isNaN(Number(min))) return "최소 가격은 숫자로 입력해 주세요.";
  if (max && Number.isNaN(Number(max))) return "최대 가격은 숫자로 입력해 주세요.";
  if (min && max && Number(min) > Number(max)) return "최소 가격이 최대 가격보다 클 수 없어요.";
  return null;
}

function toItemTemplateInput(form: ItemFormState, mode: "create" | "edit"): ItemTemplateInput {
  const input: ItemTemplateInput = {
    name: form.name.trim(),
    necessityLevel: form.necessityLevel,
    reasonText: form.reasonText.trim(),
    usedSecondhandOk: form.usedSecondhandOk,
    // 라운드 48 T1: boolean은 usedSecondhandOk와 같은 관례 — 생성/수정 모두 항상 보낸다
    // (체크를 푼 것과 안 보낸 것을 구분할 필요가 없다).
    medicalDisclaimerRequired: form.medicalDisclaimerRequired,
    stageCodes: form.stageCodes.length ? form.stageCodes : undefined,
    active: form.active
  };
  // 라운드 49 C-02: 분류는 고른 경우에만 보낸다. 서버 DTO가 @IsUUID라 ""는 400이고,
  // 생략은 생성에서 "분류 없음", 수정에서 "기존 분류 유지"다(서버가 categoryId 생략을
  // undefined로 흘려 보낸다) — 즉 분류 해제는 아직 어느 쪽으로도 표현할 수 없다.
  if (form.categoryId) input.categoryId = form.categoryId;
  const timingLabel = form.timingLabel.trim();
  const skipReasonText = form.skipReasonText.trim();
  const safetyNote = form.safetyNote.trim();
  if (mode === "edit") {
    // PATCH keeps omitted fields, so an emptied optional text field must still be sent:
    // the server cleans "" to null, which is how an operator clears a stored override.
    input.timingLabel = timingLabel;
    input.skipReasonText = skipReasonText;
    input.safetyNote = safetyNote;
  } else {
    if (timingLabel) input.timingLabel = timingLabel;
    if (skipReasonText) input.skipReasonText = skipReasonText;
    if (safetyNote) input.safetyNote = safetyNote;
  }
  const min = form.priceMinKrw.trim();
  const max = form.priceMaxKrw.trim();
  if (mode === "edit") {
    // ADM-124: 텍스트 필드와 같은 관례. PATCH는 생략한 필드를 그대로 두므로, 비운 칸도
    // 반드시 보내야 한다 — 숫자 칸은 ""가 아니라 null이 "지움"이다(서버가 null을 받아
    // 가격대를 비운다). 값이 있으면 종전대로 숫자를 보낸다.
    input.priceMinKrw = min ? Number(min) : null;
    input.priceMaxKrw = max ? Number(max) : null;
  } else {
    if (min) input.priceMinKrw = Number(min);
    if (max) input.priceMaxKrw = Number(max);
  }
  return input;
}

function toggleStage(codes: ChildStageCode[], code: ChildStageCode): ChildStageCode[] {
  return codes.includes(code) ? codes.filter((entry) => entry !== code) : [...codes, code];
}

function ItemFormFields({
  form,
  onChange,
  idPrefix,
  mode,
  categoryOptions,
  categoryLoadError
}: {
  form: ItemFormState;
  onChange: (next: ItemFormState) => void;
  idPrefix: string;
  mode: "create" | "edit";
  categoryOptions: ItemCategoryOption[];
  /** 분류 목록 조회가 실패한 이유(라운드 73 트랙 D의 한 벌이 만든 문장). 성공이면 null. */
  categoryLoadError: string | null;
}) {
  // ADM-124: 수정 폼에서 빈칸은 이제 "지움"이다(예전 안내 "비워두면 값을 바꾸지 않아요"는
  // 실제 동작과 어긋난 데다, 지우는 방법 자체가 없었다).
  const priceHint = mode === "edit" ? "비우면 가격대를 지워요." : "비워두면 가격대를 표시하지 않아요.";
  // 라운드 49 C-02: 분류는 가격/텍스트 칸과 규칙이 다르다 — 서버가 categoryId 생략을
  // "그대로 둠"으로 해석하므로 수정에서 빈 선택은 지움이 아니라 유지다. 실제 동작과
  // 어긋나는 안내를 두지 않으려고 모드별로 문구를 나눈다.
  const categoryHint =
    mode === "edit"
      ? "비워두면 지금 분류를 그대로 둬요(분류 해제는 아직 지원하지 않아요)."
      : "비워두면 분류 없이 저장해요. 앱에서 지출을 기록할 때 이 분류가 먼저 채워져요.";
  return (
    <div className={styles.form}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-name`}>이름</label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            maxLength={120}
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-necessity`}>필수도</label>
          <select
            id={`${idPrefix}-necessity`}
            value={form.necessityLevel}
            onChange={(event) => onChange({ ...form, necessityLevel: event.target.value as NecessityLevel })}
          >
            {NECESSITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {NECESSITY_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </div>
        {/* 라운드 49 C-02: 준비템 분류. 시드 밖에서 만든 준비템은 이 칸이 없던 동안
            categoryId가 영영 null이라, 앱의 "준비템 → 지출 기록" 분류 프리필이 그
            품목에서만 조용히 동작하지 않았다. */}
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-category`}>분류</label>
          <select
            id={`${idPrefix}-category`}
            value={form.categoryId}
            onChange={(event) => onChange({ ...form, categoryId: event.target.value })}
          >
            <option value="">분류 없음</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <span className={styles.hint}>{categoryHint}</span>
          {categoryLoadError ? <span className={styles.hint}>{categoryLoadError}</span> : null}
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-timing`}>타이밍 라벨</label>
          <input
            id={`${idPrefix}-timing`}
            type="text"
            value={form.timingLabel}
            onChange={(event) => onChange({ ...form, timingLabel: event.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-price-min`}>최소 가격(원)</label>
          <input
            id={`${idPrefix}-price-min`}
            type="number"
            min={0}
            value={form.priceMinKrw}
            onChange={(event) => onChange({ ...form, priceMinKrw: event.target.value })}
          />
          <span className={styles.hint}>{priceHint}</span>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-price-max`}>최대 가격(원)</label>
          <input
            id={`${idPrefix}-price-max`}
            type="number"
            min={0}
            value={form.priceMaxKrw}
            onChange={(event) => onChange({ ...form, priceMaxKrw: event.target.value })}
          />
          <span className={styles.hint}>{priceHint}</span>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-reason`}>이유</label>
        <textarea
          id={`${idPrefix}-reason`}
          value={form.reasonText}
          onChange={(event) => onChange({ ...form, reasonText: event.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-skip-reason`}>안 사도 되는 경우</label>
        <textarea
          id={`${idPrefix}-skip-reason`}
          value={form.skipReasonText}
          onChange={(event) => onChange({ ...form, skipReasonText: event.target.value })}
        />
        {form.necessityLevel !== "essential" ? (
          <span className={styles.hint}>필수템이 아니라면 입력을 권장해요.</span>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-safety`}>의료 안내</label>
        <textarea
          id={`${idPrefix}-safety`}
          value={form.safetyNote}
          onChange={(event) => onChange({ ...form, safetyNote: event.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label>적용 단계</label>
        <div className={styles.stageGrid}>
          {CHILD_STAGE_CODES.map((code) => (
            <label key={code} className={styles.stageOption}>
              <input
                type="checkbox"
                checked={form.stageCodes.includes(code)}
                onChange={() => onChange({ ...form, stageCodes: toggleStage(form.stageCodes, code) })}
              />
              {CHILD_STAGE_LABELS[code]}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.checkboxRow}>
        <input
          id={`${idPrefix}-secondhand`}
          type="checkbox"
          checked={form.usedSecondhandOk}
          onChange={(event) => onChange({ ...form, usedSecondhandOk: event.target.checked })}
        />
        <label htmlFor={`${idPrefix}-secondhand`}>중고 구매 가능</label>
      </div>

      {/* 라운드 48 T1: 의료/영양제 성격 준비템 표시(DNC-020). 켜면 앱 상세에 "구매 전
          의사·약사와 상담해 주세요" 안내 카드가 뜬다 — 효능·필요 여부를 단정하는 문구는
          어디에도 넣지 않는다. */}
      <div className={styles.checkboxRow}>
        <input
          id={`${idPrefix}-medical-disclaimer`}
          type="checkbox"
          checked={form.medicalDisclaimerRequired}
          onChange={(event) => onChange({ ...form, medicalDisclaimerRequired: event.target.checked })}
        />
        <label htmlFor={`${idPrefix}-medical-disclaimer`}>의료 상담 안내 필요</label>
      </div>

      <div className={styles.checkboxRow}>
        <input
          id={`${idPrefix}-active`}
          type="checkbox"
          checked={form.active}
          onChange={(event) => onChange({ ...form, active: event.target.checked })}
        />
        <label htmlFor={`${idPrefix}-active`}>활성</label>
      </div>
    </div>
  );
}

export default function ItemTemplatesPage() {
  const { session, clearSession } = useAdminSession();
  const [items, setItems] = useState<ItemTemplate[] | null>(null);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);
  // 라운드 49 C-02: 분류 셀렉트의 선택지. /categories 조회는 어드민 역할 전부에게
  // 열려 있어(admin-categories.controller.ts) 편집자 계정에서도 그대로 쓴다.
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  // 라운드 73 트랙 D: 종전에는 불리언 하나였다(실패 사실만 남고 이유는 버려졌다).
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<ItemFormState>(emptyItemForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  // R19-F: POST /admin/item-templates에는 서버 멱등키가 붙어 있다. 생성 시도
  // 하나당 키 하나를 들고 있다가(입력이 바뀌면 지문 비교로 자동 회전) 성공하면
  // 회전한다 — 그래야 타임아웃 뒤 재시도가 같은 템플릿을 두 번 만들지 않는다.
  const createKey = useRef(createIdempotencyKeyHolder()).current;

  // UX-X C7: 목록 필터는 링크 화면(link-filters.ts)과 같은 관례로 전부 클라이언트
  // 상태 — 준비템 목록은 이미 통째로 받아온다.
  const [filters, setFilters] = useState<ItemFilterState>(EMPTY_ITEM_FILTERS);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>(emptyItemForm());
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const result = await listItemTemplates();
      setItems(result.items);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError(loadErrorCopy(error, "준비템 목록을 불러오지 못했어요."));
    }
  }, [session, clearSession]);

  // 분류 목록은 준비템 목록과 독립적으로 실패할 수 있다. 실패해도 나머지 폼은 그대로
  // 쓸 수 있어야 하므로(분류만 못 고르는 상태) 목록 전체를 막는 loadError와 섞지 않는다.
  const loadCategories = useCallback(async () => {
    if (!session) return;
    try {
      const result = await listAdminCategories();
      setCategories(result.categories);
      setCategoryLoadError(null);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      // [다시 시도] 버튼이 서지 않는 자리(폼 안의 한 줄)라 문장만 받는다.
      setCategoryLoadError(loadErrorMessage(error, "분류 목록을 불러오지 못해 지금은 고를 수 없어요."));
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  if (!session) return null;

  // COM-103: an editor's save goes through draft -> submit for review instead
  // of writing item_templates directly (that endpoint is admin-only now).
  const isEditor = session.admin.role === "editor";
  /**
   * 라운드 77 트랙 D(GAP-077 #4ⓑ): 역할을 `isEditor` 하나로만 읽으면 갈래가 둘뿐이라
   * `analyst`가 "편집자가 아니다" 쪽에 떨어져 `admin`과 같은 저장 UI를 봤다 — 눌러 봐야
   * 서버가 403이다. 화면이 이제 **서버와 같은 기준**을 읽는다: 직접 저장은 `admin`
   * (`@RequireAdminRoles("admin")`), 검토 요청은 `editor`(content-revisions = `admin, editor`),
   * `analyst`에게 열린 쓰기 경로는 0건. ⚠️ 폼·표는 그대로 남는다(읽기 권한자가 값을 보는 것은
   * 정당하다 — `/categories`가 표를 남기는 것과 같은 판정). 사라지는 것은 제출 컨트롤뿐이다.
   */
  const canEdit = session.admin.role === "admin" || session.admin.role === "editor";

  const filteredItems = items ? filterItemTemplates(items, filters) : null;
  const createCategoryOptions = itemCategoryOptions(categories, createForm.categoryId);
  const editCategoryOptions = itemCategoryOptions(categories, editForm.categoryId);
  const filtersApplied = hasAnyItemFilter(filters);

  const handleCreate = async () => {
    const validationMessage = validateItemForm(createForm);
    if (validationMessage) {
      setCreateError(validationMessage);
      return;
    }
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      if (isEditor) {
        await draftAndSubmitContentRevision({
          entityType: "item_template",
          payload: toItemTemplateInput(createForm, "create") as Record<string, unknown>
        });
      } else {
        const input = toItemTemplateInput(createForm, "create");
        const created = await createItemTemplate(input, createKey.current(JSON.stringify(input)));
        setItems((current) => (current ? [created, ...current] : [created]));
        createKey.rotate();
      }
      setCreateForm(emptyItemForm());
      setCreateSuccess(true);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setCreateError(writeErrorMessage(error, "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."));
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item: ItemTemplate) => {
    setEditingId(item.id);
    setEditForm(itemFormFromTemplate(item));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    const validationMessage = validateItemForm(editForm);
    if (validationMessage) {
      setEditError(validationMessage);
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      if (isEditor) {
        await draftAndSubmitContentRevision({
          entityType: "item_template",
          entityId: editingId,
          payload: toItemTemplateInput(editForm, "edit") as Record<string, unknown>
        });
      } else {
        const updated = await updateItemTemplate(editingId, toItemTemplateInput(editForm, "edit"));
        setItems((current) => (current ? current.map((item) => (item.id === editingId ? updated : item)) : current));
      }
      setEditingId(null);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setEditError(writeErrorMessage(error, "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."));
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>준비템 관리</h1>
        <p>출산·육아 준비템을 등록하고 단계, 필수도, 가격대를 관리해요.</p>
      </div>

      <section className={styles.card}>
        <h2>새 준비템 추가</h2>
        {isEditor ? <p className={styles.hint}>편집자 계정은 바로 저장하지 않고, 검토 요청을 관리자에게 보내요.</p> : null}
        <ItemFormFields
          form={createForm}
          onChange={setCreateForm}
          idPrefix="create"
          mode="create"
          categoryOptions={createCategoryOptions}
          categoryLoadError={categoryLoadError}
        />
        {createError ? <p className={styles.errorBanner}>{createError}</p> : null}
        {createSuccess ? (
          <p className={styles.successBanner}>{isEditor ? "검토 요청을 보냈어요." : "저장했어요."}</p>
        ) : null}
        {canEdit ? (
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={handleCreate} disabled={creating}>
              {creating ? "저장 중..." : isEditor ? "검토 요청" : "추가"}
            </button>
          </div>
        ) : (
          <p className={styles.hint}>{ADMIN_WRITE_ROLE_NOTICE}</p>
        )}
      </section>

      <section className={styles.card}>
        <h2>준비템 목록{items ? ` (${itemFilterSummary(items.length, filteredItems?.length ?? 0)})` : ""}</h2>
        {items === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner}>
            {loadError.message}
            {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 실패에는 이 버튼을 세우지 않는다. */}
            {loadError.canRetry ? (
              <button type="button" className={styles.retryButton} onClick={loadItems}>
                다시 시도
              </button>
            ) : null}
          </p>
        ) : null}

        {/* UX-X C7: 이름으로 바로 찾고, 상품 링크가 없어 구매로 이어지지 않는 준비템을
            골라낸다. 둘 다 이미 받아온 목록만 좁히므로 추가 요청이 없다. */}
        {items && items.length > 0 ? (
          <div className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="item-filter-query">검색</label>
                <input
                  id="item-filter-query"
                  type="text"
                  maxLength={120}
                  placeholder="준비템 이름"
                  value={filters.query ?? ""}
                  onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                />
                <span className={styles.hint}>대소문자를 가리지 않고 부분 일치로 찾아요.</span>
              </div>
            </div>

            <div className={styles.checkboxRow}>
              <input
                id="item-filter-missing-links"
                type="checkbox"
                checked={filters.missingLinksOnly ?? false}
                onChange={(event) => setFilters({ ...filters, missingLinksOnly: event.target.checked })}
              />
              <label htmlFor="item-filter-missing-links">상품 링크 없음만 보기</label>
            </div>
            {/* UX-X(R43) M-5: 기준은 활성 링크다 — 비활성 링크만 남은 준비템도
                사용자 화면에서는 구매처가 0이라 함께 걸린다. */}
            <span className={styles.hint}>링크가 전부 비활성인 준비템도 함께 나와요.</span>

            {filtersApplied ? (
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setFilters(EMPTY_ITEM_FILTERS)}>
                  필터 초기화
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {items && items.length === 0 ? <p className={styles.emptyState}>등록된 준비템이 없어요.</p> : null}
        {items && items.length > 0 && filteredItems && filteredItems.length === 0 ? (
          <p className={styles.emptyState}>조건에 맞는 준비템이 없어요.</p>
        ) : null}
        {filteredItems && filteredItems.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>단계</th>
                  <th>필수도</th>
                  <th>가격대</th>
                  <th>링크 수</th>
                  <th>활성</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td>{item.name}</td>
                      <td>{item.stageCodes.map((code) => CHILD_STAGE_LABELS[code]).join(", ") || "-"}</td>
                      <td>{NECESSITY_LEVEL_LABELS[item.necessityLevel]}</td>
                      <td>{item.priceBandText ?? "-"}</td>
                      {/* UX-X(R43) M-5: 표시 기준은 사용자에게 보이는 활성 링크 수다.
                          비활성 링크가 있으면 그 수를 옆에 덧붙인다 — "링크 자체가 없음"과
                          "있는데 전부 내려가 있음"은 운영자가 할 일이 다르다. */}
                      <td>
                        {activeProductLinkCount(item)}
                        {productLinkCount(item) > activeProductLinkCount(item) ? (
                          <span className={styles.hint}>
                            {" "}
                            (비활성 {productLinkCount(item) - activeProductLinkCount(item)})
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className={item.active ? `${styles.badge} ${styles.badgeActive}` : `${styles.badge} ${styles.badgeInactive}`}>
                          {item.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => (editingId === item.id ? cancelEdit() : startEdit(item))}
                        >
                          {editingId === item.id ? "닫기" : "수정"}
                        </button>
                      </td>
                    </tr>
                    {editingId === item.id ? (
                      <tr>
                        <td colSpan={7}>
                          <ItemFormFields
                            form={editForm}
                            onChange={setEditForm}
                            idPrefix={`edit-${item.id}`}
                            mode="edit"
                            categoryOptions={editCategoryOptions}
                            categoryLoadError={categoryLoadError}
                          />
                          {isEditor ? <p className={styles.hint}>저장하면 관리자에게 검토 요청이 전달돼요.</p> : null}
                          {editError ? <p className={styles.errorBanner}>{editError}</p> : null}
                          {/* 표의 [수정]/[닫기] 토글이 이 폼을 여닫으므로, 컨트롤이 내려가도
                              읽기 권한자가 갇히는 자리가 없다. */}
                          {canEdit ? (
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={handleEditSave}
                                disabled={editSubmitting}
                              >
                                {editSubmitting ? "저장 중..." : isEditor ? "검토 요청" : "저장"}
                              </button>
                              <button type="button" className={styles.secondaryButton} onClick={cancelEdit} disabled={editSubmitting}>
                                취소
                              </button>
                            </div>
                          ) : (
                            <p className={styles.hint}>{ADMIN_WRITE_ROLE_NOTICE}</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
