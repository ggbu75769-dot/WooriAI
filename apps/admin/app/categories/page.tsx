"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminApiError,
  isAuthError,
  isTimeoutError,
  listAdminCategories,
  updateAdminCategory,
  type AdminCategory
} from "../../src/lib/admin-api";
import {
  CATEGORY_GROUPS,
  CATEGORY_GROUP_LABELS,
  categoryDraftError,
  categoryDraftPatch,
  categoryGroup,
  emptyCategoryFilter,
  filterCategories,
  isAliasLikeCategory,
  selectableToggleWarning,
  toCategoryDraft,
  type CategoryDraft,
  type CategoryFilter
} from "../../src/lib/category-rows";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

/**
 * ADM-127: 카테고리 관리.
 *
 * 표는 전량(시드 21행)을 보여주고, 편집은 이름·표시 순서·active·selectable 넷뿐이다.
 * 행 추가/삭제 UI는 없다(DNC-007) — id/code가 모바일 퀵타일과 이미 저장된 지출에
 * 묶여 있어 지우거나 바꾸면 과거 지출의 카테고리 해석이 깨진다.
 *
 * 권한: 조회는 모든 어드민 역할, 수정은 admin 전용(API가 강제). editor/analyst에게는
 * 표를 그대로 보여주되 편집 버튼을 감춘다 — 카테고리 상태 확인 자체는 운영 업무다.
 */
export default function CategoriesPage() {
  const { session, clearSession } = useAdminSession();

  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>(emptyCategoryFilter());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowSuccess, setRowSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = session?.admin.role === "admin";

  const loadCategories = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const result = await listAdminCategories();
      setCategories(result.categories);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError(
        isTimeoutError(error)
          ? "카테고리를 불러오는 데 시간이 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요."
          : "카테고리 목록을 불러오지 못했어요."
      );
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  if (!session) return null;

  const startEdit = (category: AdminCategory) => {
    setEditingId(category.id);
    setDraft(toCategoryDraft(category));
    setRowError(null);
    setRowSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setRowError(null);
  };

  const saveEdit = async (category: AdminCategory) => {
    if (!draft) return;
    const validationMessage = categoryDraftError(draft);
    if (validationMessage) {
      setRowError(validationMessage);
      return;
    }
    const patch = categoryDraftPatch(category, draft);
    if (!patch) {
      cancelEdit();
      return;
    }
    // CAT-124: 별칭 행을 다시 "노출"로 되돌리면 앱 선택 목록에 중복 항목이 생긴다.
    if (patch.selectable === true) {
      const warning = selectableToggleWarning(category, true);
      if (warning && !window.confirm(warning)) return;
    }

    setSaving(true);
    setRowError(null);
    setRowSuccess(null);
    try {
      const result = await updateAdminCategory(category.id, patch);
      setRowSuccess(`"${result.category.name}" 카테고리를 수정했어요.`);
      cancelEdit();
      await loadCategories();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      if (isTimeoutError(error)) {
        setRowError("저장 결과를 확인하지 못했어요. 목록을 새로고침해 반영 여부를 확인해 주세요.");
        return;
      }
      setRowError(
        error instanceof AdminApiError && error.status === 403
          ? "카테고리 수정은 관리자(admin) 권한에서만 할 수 있어요."
          : "카테고리를 수정하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."
      );
    } finally {
      setSaving(false);
    }
  };

  const visible = categories ? filterCategories(categories, filter) : [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>카테고리 관리</h1>
        <p>지출 카테고리의 이름·표시 순서와 노출 상태를 관리해요.</p>
      </div>

      <section className={styles.card}>
        <h2>알아두기</h2>
        <p className={styles.hint}>
          <strong>노출(selectable)</strong>은 앱의 카테고리 선택 목록에 이 카테고리를 내밀지 여부예요.{" "}
          <strong>사용(active)</strong>은 카테고리 행 자체를 살려 둘지 여부고요 — 사용을 끄면 이름 표시에도 쓰이지 않아요.
        </p>
        <p className={styles.hint}>
          <strong>앱 별칭</strong> 행은 앱의 빠른 입력 타일이 쓰는 내부용 카테고리라 지금은 숨김 상태예요. 별칭 행을 노출로
          바꾸면 앱 선택 목록에 다시 나타나고, 뜻이 겹치는 정식 카테고리와 이름만 다른 항목이 나란히 보이게 돼요.
        </p>
        <p className={styles.hint}>
          카테고리는 추가하거나 지울 수 없어요. 이미 기록된 지출이 이 카테고리들을 가리키고 있어서, 이름·순서·노출만 바꿀 수
          있게 해 두었어요.
        </p>
        {!canEdit ? (
          <p className={styles.hint}>지금 계정은 조회만 할 수 있어요. 수정은 관리자(admin) 권한이 필요해요.</p>
        ) : null}
      </section>

      <section className={styles.card}>
        <h2>카테고리 목록</h2>
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="category-search">코드·이름 검색</label>
              <input
                id="category-search"
                type="text"
                value={filter.search}
                onChange={(event) => setFilter({ ...filter, search: event.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="category-group">구분</label>
              <select
                id="category-group"
                value={filter.group}
                onChange={(event) => setFilter({ ...filter, group: event.target.value as CategoryFilter["group"] })}
              >
                <option value="all">전체</option>
                {CATEGORY_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {CATEGORY_GROUP_LABELS[group]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {categories === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner}>
            {loadError}
            <button type="button" className={styles.retryButton} onClick={loadCategories}>
              다시 시도
            </button>
          </p>
        ) : null}
        {rowError ? <p className={styles.errorBanner}>{rowError}</p> : null}
        {rowSuccess ? <p className={styles.successBanner}>{rowSuccess}</p> : null}
        {categories && visible.length === 0 ? <p className={styles.emptyState}>조건에 맞는 카테고리가 없어요.</p> : null}

        {categories && visible.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>코드</th>
                  <th>이름</th>
                  <th>표시 순서</th>
                  <th>구분</th>
                  <th>사용</th>
                  <th>노출</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((category) => {
                  const isEditing = editingId === category.id && draft !== null;
                  const group = categoryGroup(category);
                  return (
                    <tr key={category.id}>
                      <td>
                        <code>{category.code}</code>
                      </td>
                      <td>
                        {isEditing && draft ? (
                          <input
                            type="text"
                            aria-label={`${category.code} 이름`}
                            maxLength={50}
                            value={draft.name}
                            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                          />
                        ) : (
                          category.name
                        )}
                      </td>
                      <td>
                        {isEditing && draft ? (
                          <input
                            type="number"
                            aria-label={`${category.code} 표시 순서`}
                            value={draft.displayOrder}
                            onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value })}
                          />
                        ) : (
                          category.displayOrder
                        )}
                      </td>
                      <td>
                        <span className={styles.badge}>{CATEGORY_GROUP_LABELS[group]}</span>
                      </td>
                      <td>
                        {isEditing && draft ? (
                          <input
                            type="checkbox"
                            aria-label={`${category.code} 사용`}
                            checked={draft.active}
                            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                          />
                        ) : (
                          <span
                            className={
                              category.active
                                ? `${styles.badge} ${styles.badgeActive}`
                                : `${styles.badge} ${styles.badgeInactive}`
                            }
                          >
                            {category.active ? "사용" : "미사용"}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing && draft ? (
                          <input
                            type="checkbox"
                            aria-label={`${category.code} 노출`}
                            checked={draft.selectable}
                            onChange={(event) => setDraft({ ...draft, selectable: event.target.checked })}
                          />
                        ) : (
                          <span
                            className={
                              category.selectable
                                ? `${styles.badge} ${styles.badgeActive}`
                                : `${styles.badge} ${styles.badgeInactive}`
                            }
                          >
                            {category.selectable ? "노출" : "숨김"}
                          </span>
                        )}
                        {isAliasLikeCategory(category) && !category.selectable ? (
                          <span className={styles.hint}>별칭 행을 노출로 바꾸면 앱 선택 목록에 다시 나타나요.</span>
                        ) : null}
                      </td>
                      <td>
                        {!canEdit ? (
                          <span className={styles.hint}>-</span>
                        ) : isEditing ? (
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={saving}
                              onClick={() => saveEdit(category)}
                            >
                              {saving ? "저장 중..." : "저장"}
                            </button>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={saving}
                              onClick={cancelEdit}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={editingId !== null}
                            onClick={() => startEdit(category)}
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
