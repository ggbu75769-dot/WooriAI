"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  PRODUCT_PLATFORMS,
  PRODUCT_PLATFORM_LABELS,
  createProductLink,
  isAuthError,
  listItemTemplates,
  listProductLinks,
  updateProductLink,
  type ItemTemplate,
  type ProductLink,
  type ProductLinkInput,
  type ProductPlatform
} from "../../src/lib/admin-api";
import { isHttpUrl } from "../../src/lib/validation";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

type LinkFormState = {
  itemTemplateId: string;
  platform: ProductPlatform;
  title: string;
  url: string;
  affiliateUrl: string;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string;
  active: boolean;
};

function emptyLinkForm(firstItemId: string): LinkFormState {
  return {
    itemTemplateId: firstItemId,
    platform: "coupang",
    title: "",
    url: "",
    affiliateUrl: "",
    isAffiliate: false,
    isSponsored: false,
    disclosureText: "",
    active: true
  };
}

function linkFormFromLink(link: ProductLink): LinkFormState {
  return {
    itemTemplateId: link.itemTemplateId,
    platform: link.platform,
    title: link.title,
    url: link.url,
    affiliateUrl: link.affiliateUrl ?? "",
    isAffiliate: link.isAffiliate,
    isSponsored: link.isSponsored,
    disclosureText: link.disclosureText ?? "",
    active: link.active
  };
}

function validateLinkForm(form: LinkFormState): string | null {
  if (!form.itemTemplateId) return "연결할 준비템을 선택해 주세요.";
  if (!form.title.trim()) return "제목을 입력해 주세요.";
  if (!form.url.trim()) return "URL을 입력해 주세요.";
  if (!isHttpUrl(form.url)) return "URL은 http:// 또는 https:// 로 시작해야 해요.";
  if (form.affiliateUrl.trim() && !isHttpUrl(form.affiliateUrl)) {
    return "제휴 URL은 http:// 또는 https:// 로 시작해야 해요.";
  }
  return null;
}

function toProductLinkInput(form: LinkFormState, mode: "create" | "edit"): ProductLinkInput {
  const input: ProductLinkInput = {
    itemTemplateId: form.itemTemplateId,
    platform: form.platform,
    title: form.title.trim(),
    url: form.url.trim(),
    isAffiliate: form.isAffiliate,
    isSponsored: form.isSponsored,
    active: form.active
  };
  const affiliateUrl = form.affiliateUrl.trim();
  const disclosureText = form.disclosureText.trim();
  if (mode === "edit") {
    // PATCH keeps omitted fields, so an emptied optional text field must still be sent:
    // the server cleans "" to null, letting the operator clear a stored override
    // (e.g. fall back to the default disclosure copy).
    input.affiliateUrl = affiliateUrl;
    input.disclosureText = disclosureText;
  } else {
    if (affiliateUrl) input.affiliateUrl = affiliateUrl;
    if (disclosureText) input.disclosureText = disclosureText;
  }
  return input;
}

function LinkFormFields({
  form,
  onChange,
  itemTemplates,
  idPrefix
}: {
  form: LinkFormState;
  onChange: (next: LinkFormState) => void;
  itemTemplates: ItemTemplate[];
  idPrefix: string;
}) {
  return (
    <div className={styles.form}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-item`}>연결할 준비템</label>
          <select
            id={`${idPrefix}-item`}
            value={form.itemTemplateId}
            onChange={(event) => onChange({ ...form, itemTemplateId: event.target.value })}
          >
            <option value="">선택해 주세요</option>
            {itemTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-platform`}>플랫폼</label>
          <select
            id={`${idPrefix}-platform`}
            value={form.platform}
            onChange={(event) => onChange({ ...form, platform: event.target.value as ProductPlatform })}
          >
            {PRODUCT_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {PRODUCT_PLATFORM_LABELS[platform]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-title`}>제목</label>
          <input
            id={`${idPrefix}-title`}
            type="text"
            maxLength={160}
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-url`}>URL</label>
          <input
            id={`${idPrefix}-url`}
            type="url"
            value={form.url}
            onChange={(event) => onChange({ ...form, url: event.target.value })}
          />
          <span className={styles.hint}>http:// 또는 https:// 로 시작하는 주소만 등록할 수 있어요.</span>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-affiliate-url`}>제휴 URL (선택)</label>
          <input
            id={`${idPrefix}-affiliate-url`}
            type="url"
            value={form.affiliateUrl}
            onChange={(event) => onChange({ ...form, affiliateUrl: event.target.value })}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-disclosure`}>고지 문구 재정의 (선택)</label>
        <textarea
          id={`${idPrefix}-disclosure`}
          value={form.disclosureText}
          onChange={(event) => onChange({ ...form, disclosureText: event.target.value })}
        />
        <span className={styles.hint}>비워두면 기본 제휴/스폰서 고지 문구가 표시돼요.</span>
      </div>

      <div className={styles.checkboxRow}>
        <input
          id={`${idPrefix}-affiliate`}
          type="checkbox"
          checked={form.isAffiliate}
          onChange={(event) => onChange({ ...form, isAffiliate: event.target.checked })}
        />
        <label htmlFor={`${idPrefix}-affiliate`}>제휴 링크</label>
      </div>

      <div className={styles.checkboxRow}>
        <input
          id={`${idPrefix}-sponsored`}
          type="checkbox"
          checked={form.isSponsored}
          onChange={(event) => onChange({ ...form, isSponsored: event.target.checked })}
        />
        <label htmlFor={`${idPrefix}-sponsored`}>스폰서 상품</label>
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

export default function ProductLinksPage() {
  const { session, clearSession } = useAdminSession();
  const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>([]);
  const [links, setLinks] = useState<ProductLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<LinkFormState>(emptyLinkForm(""));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LinkFormState>(emptyLinkForm(""));
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const [linkResult, itemResult] = await Promise.all([listProductLinks(), listItemTemplates()]);
      setLinks(linkResult.links);
      setItemTemplates(itemResult.items);
      setCreateForm((current) => (current.itemTemplateId ? current : emptyLinkForm(itemResult.items[0]?.id ?? "")));
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError("상품 링크 목록을 불러오지 못했어요.");
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!session) return null;

  const itemNameById = (id: string) => itemTemplates.find((item) => item.id === id)?.name ?? id;

  const handleCreate = async () => {
    const validationMessage = validateLinkForm(createForm);
    if (validationMessage) {
      setCreateError(validationMessage);
      return;
    }
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      const created = await createProductLink(toProductLinkInput(createForm, "create"));
      setLinks((current) => (current ? [created, ...current] : [created]));
      setCreateForm(emptyLinkForm(itemTemplates[0]?.id ?? ""));
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

  const startEdit = (link: ProductLink) => {
    setEditingId(link.id);
    setEditForm(linkFormFromLink(link));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    const validationMessage = validateLinkForm(editForm);
    if (validationMessage) {
      setEditError(validationMessage);
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateProductLink(editingId, toProductLinkInput(editForm, "edit"));
      setLinks((current) => (current ? current.map((link) => (link.id === editingId ? updated : link)) : current));
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
        <h1>상품 링크 관리</h1>
        <p>준비템에 연결된 상품 URL과 제휴/스폰서 표시를 관리해요.</p>
      </div>

      <section className={styles.card}>
        <h2>새 상품 링크 추가</h2>
        {itemTemplates.length === 0 ? (
          <p className={styles.emptyState}>먼저 준비템을 등록해야 상품 링크를 연결할 수 있어요.</p>
        ) : (
          <>
            <LinkFormFields form={createForm} onChange={setCreateForm} itemTemplates={itemTemplates} idPrefix="create" />
            {createError ? <p className={styles.errorBanner}>{createError}</p> : null}
            {createSuccess ? <p className={styles.successBanner}>저장했어요.</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={handleCreate} disabled={creating}>
                {creating ? "저장 중..." : "추가"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>상품 링크 목록</h2>
        {links === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner}>
            {loadError}
            <button type="button" className={styles.retryButton} onClick={loadAll}>
              다시 시도
            </button>
          </p>
        ) : null}
        {links && links.length === 0 ? <p className={styles.emptyState}>등록된 상품 링크가 없어요.</p> : null}
        {links && links.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>준비템</th>
                  <th>제목</th>
                  <th>플랫폼</th>
                  <th>URL</th>
                  <th>제휴</th>
                  <th>스폰서</th>
                  <th>활성</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <Fragment key={link.id}>
                    <tr>
                      <td>{itemNameById(link.itemTemplateId)}</td>
                      <td>{link.title}</td>
                      <td>{PRODUCT_PLATFORM_LABELS[link.platform]}</td>
                      <td>
                        <a href={link.url} target="_blank" rel="noreferrer noopener">
                          링크 열기
                        </a>
                      </td>
                      <td>{link.isAffiliate ? "예" : "아니오"}</td>
                      <td>{link.isSponsored ? "예" : "아니오"}</td>
                      <td>
                        <span className={link.active ? `${styles.badge} ${styles.badgeActive}` : `${styles.badge} ${styles.badgeInactive}`}>
                          {link.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => (editingId === link.id ? cancelEdit() : startEdit(link))}
                        >
                          {editingId === link.id ? "닫기" : "수정"}
                        </button>
                      </td>
                    </tr>
                    {editingId === link.id ? (
                      <tr>
                        <td colSpan={8}>
                          <LinkFormFields
                            form={editForm}
                            onChange={setEditForm}
                            itemTemplates={itemTemplates}
                            idPrefix={`edit-${link.id}`}
                          />
                          {editError ? <p className={styles.errorBanner}>{editError}</p> : null}
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={handleEditSave}
                              disabled={editSubmitting}
                            >
                              {editSubmitting ? "저장 중..." : "저장"}
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
