"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  LINK_HEALTH_LABELS,
  LINK_HEALTH_UNKNOWN_LABEL,
  PRODUCT_PLATFORMS,
  PRODUCT_PLATFORM_LABELS,
  createIdempotencyKeyHolder,
  createProductLink,
  draftAndSubmitContentRevision,
  isAuthError,
  listItemTemplates,
  listProductLinks,
  updateProductLink,
  type ItemTemplate,
  type LinkHealthStatus,
  type ProductLink,
  type ProductLinkInput,
  type ProductPlatform
} from "../../src/lib/admin-api";
import { isHttpUrl } from "../../src/lib/validation";
import { useAdminSession } from "../../src/lib/admin-token-context";
import { ProductLinkBulkReplace } from "../../src/components/ProductLinkBulkReplace";
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

// COM-105: link_health 워커 잡이 기록한 헬스체크 결과 배지.
// null(미확인)은 아직 검사 전이거나 제휴 URL이 없는 링크.
function healthLabel(status: LinkHealthStatus | null): string {
  return status ? LINK_HEALTH_LABELS[status] : LINK_HEALTH_UNKNOWN_LABEL;
}

function healthBadgeClass(status: LinkHealthStatus | null): string {
  if (status === "ok") return `${styles.badge} ${styles.badgeActive}`;
  if (status === "broken") return `${styles.badge} ${styles.badgeInactive}`;
  return styles.badge; // unstable/미확인: 중립 배지
}

// 마지막 확인 시각을 "n분 전/n시간 전/n일 전"으로 표시(체크 주기가 시간 단위라 초 단위 정밀도는 불필요).
function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diffMinutes = Math.floor((now.getTime() - timestamp) / 60_000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
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
  // R19-F: POST /admin/product-links에는 서버 멱등키가 붙어 있다. 시도 하나당
  // 키 하나(입력이 바뀌면 지문 비교로 자동 회전, 성공하면 rotate) — 타임아웃 뒤
  // 재시도가 같은 링크를 두 번 만들어 displayOrder를 어지럽히지 않게 한다.
  const createKey = useRef(createIdempotencyKeyHolder()).current;

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

  // COM-103: an editor's save goes through draft -> submit for review instead
  // of writing product_links directly (that endpoint is admin-only now).
  const isEditor = session.admin.role === "editor";

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
      if (isEditor) {
        await draftAndSubmitContentRevision({
          entityType: "product_link",
          payload: toProductLinkInput(createForm, "create") as Record<string, unknown>
        });
      } else {
        const input = toProductLinkInput(createForm, "create");
        const created = await createProductLink(input, createKey.current(JSON.stringify(input)));
        setLinks((current) => (current ? [created, ...current] : [created]));
        createKey.rotate();
      }
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
      if (isEditor) {
        await draftAndSubmitContentRevision({
          entityType: "product_link",
          entityId: editingId,
          payload: toProductLinkInput(editForm, "edit") as Record<string, unknown>
        });
      } else {
        const updated = await updateProductLink(editingId, toProductLinkInput(editForm, "edit"));
        setLinks((current) => (current ? current.map((link) => (link.id === editingId ? updated : link)) : current));
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
        <h1>상품 링크 관리</h1>
        <p>준비템에 연결된 상품 URL과 제휴/스폰서 표시를 관리해요.</p>
      </div>

      {/* COM-107-prep: CSV 일괄 교체는 API가 admin-only라 admin 세션에서만 노출한다. */}
      {session.admin.role === "admin" ? <ProductLinkBulkReplace onApplied={loadAll} /> : null}

      <section className={styles.card}>
        <h2>새 상품 링크 추가</h2>
        {itemTemplates.length === 0 ? (
          <p className={styles.emptyState}>먼저 준비템을 등록해야 상품 링크를 연결할 수 있어요.</p>
        ) : (
          <>
            {isEditor ? <p className={styles.hint}>편집자 계정은 바로 저장하지 않고, 검토 요청을 관리자에게 보내요.</p> : null}
            <LinkFormFields form={createForm} onChange={setCreateForm} itemTemplates={itemTemplates} idPrefix="create" />
            {createError ? <p className={styles.errorBanner}>{createError}</p> : null}
            {createSuccess ? (
              <p className={styles.successBanner}>{isEditor ? "검토 요청을 보냈어요." : "저장했어요."}</p>
            ) : null}
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={handleCreate} disabled={creating}>
                {creating ? "저장 중..." : isEditor ? "검토 요청" : "추가"}
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
                  <th>링크 상태</th>
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
                        <span className={healthBadgeClass(link.healthStatus)}>{healthLabel(link.healthStatus)}</span>
                        {link.healthCheckedAt ? (
                          <span className={styles.hint}> {formatRelativeTime(link.healthCheckedAt)}</span>
                        ) : null}
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
                        <td colSpan={9}>
                          <LinkFormFields
                            form={editForm}
                            onChange={setEditForm}
                            itemTemplates={itemTemplates}
                            idPrefix={`edit-${link.id}`}
                          />
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
