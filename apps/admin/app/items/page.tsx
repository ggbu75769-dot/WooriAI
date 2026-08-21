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
  listItemTemplates,
  updateItemTemplate,
  type ChildStageCode,
  type ItemTemplate,
  type ItemTemplateInput,
  type NecessityLevel
} from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

type ItemFormState = {
  name: string;
  necessityLevel: NecessityLevel;
  timingLabel: string;
  priceMinKrw: string;
  priceMaxKrw: string;
  reasonText: string;
  skipReasonText: string;
  usedSecondhandOk: boolean;
  safetyNote: string;
  stageCodes: ChildStageCode[];
  active: boolean;
};

function emptyItemForm(): ItemFormState {
  return {
    name: "",
    necessityLevel: "essential",
    timingLabel: "",
    priceMinKrw: "",
    priceMaxKrw: "",
    reasonText: "",
    skipReasonText: "",
    usedSecondhandOk: false,
    safetyNote: "",
    stageCodes: [],
    active: true
  };
}

function itemFormFromTemplate(item: ItemTemplate): ItemFormState {
  return {
    name: item.name,
    necessityLevel: item.necessityLevel,
    timingLabel: item.timingLabel ?? "",
    priceMinKrw: "",
    priceMaxKrw: "",
    reasonText: item.reasonText,
    skipReasonText: item.skipReasonText ?? "",
    usedSecondhandOk: item.usedSecondhandOk,
    safetyNote: item.safetyNote ?? "",
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
    stageCodes: form.stageCodes.length ? form.stageCodes : undefined,
    active: form.active
  };
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
  if (min) input.priceMinKrw = Number(min);
  if (max) input.priceMaxKrw = Number(max);
  return input;
}

function toggleStage(codes: ChildStageCode[], code: ChildStageCode): ChildStageCode[] {
  return codes.includes(code) ? codes.filter((entry) => entry !== code) : [...codes, code];
}

function ItemFormFields({
  form,
  onChange,
  idPrefix
}: {
  form: ItemFormState;
  onChange: (next: ItemFormState) => void;
  idPrefix: string;
}) {
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
          <span className={styles.hint}>비워두면 값을 바꾸지 않아요.</span>
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
          <span className={styles.hint}>비워두면 값을 바꾸지 않아요.</span>
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<ItemFormState>(emptyItemForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  // R19-F: POST /admin/item-templates에는 서버 멱등키가 붙어 있다. 생성 시도
  // 하나당 키 하나를 들고 있다가(입력이 바뀌면 지문 비교로 자동 회전) 성공하면
  // 회전한다 — 그래야 타임아웃 뒤 재시도가 같은 템플릿을 두 번 만들지 않는다.
  const createKey = useRef(createIdempotencyKeyHolder()).current;

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
      setLoadError("준비템 목록을 불러오지 못했어요.");
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (!session) return null;

  // COM-103: an editor's save goes through draft -> submit for review instead
  // of writing item_templates directly (that endpoint is admin-only now).
  const isEditor = session.admin.role === "editor";

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
      setCreateError("저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.");
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
      setEditError("저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.");
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
        <ItemFormFields form={createForm} onChange={setCreateForm} idPrefix="create" />
        {createError ? <p className={styles.errorBanner}>{createError}</p> : null}
        {createSuccess ? (
          <p className={styles.successBanner}>{isEditor ? "검토 요청을 보냈어요." : "저장했어요."}</p>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={handleCreate} disabled={creating}>
            {creating ? "저장 중..." : isEditor ? "검토 요청" : "추가"}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h2>준비템 목록</h2>
        {items === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner}>
            {loadError}
            <button type="button" className={styles.retryButton} onClick={loadItems}>
              다시 시도
            </button>
          </p>
        ) : null}
        {items && items.length === 0 ? <p className={styles.emptyState}>등록된 준비템이 없어요.</p> : null}
        {items && items.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>단계</th>
                  <th>필수도</th>
                  <th>가격대</th>
                  <th>활성</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td>{item.name}</td>
                      <td>{item.stageCodes.map((code) => CHILD_STAGE_LABELS[code]).join(", ") || "-"}</td>
                      <td>{NECESSITY_LEVEL_LABELS[item.necessityLevel]}</td>
                      <td>{item.priceBandText ?? "-"}</td>
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
                        <td colSpan={6}>
                          <ItemFormFields form={editForm} onChange={setEditForm} idPrefix={`edit-${item.id}`} />
                          {isEditor ? <p className={styles.hint}>저장하면 관리자에게 검토 요청이 전달돼요.</p> : null}
                          {editError ? <p className={styles.errorBanner}>{editError}</p> : null}
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
