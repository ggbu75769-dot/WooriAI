"use client";

import { useCallback, useEffect, useState } from "react";
import {
  draftAndSubmitContentRevision,
  isAuthError,
  listDisclosures,
  updateDisclosure,
  type Disclosure
} from "../../src/lib/admin-api";
import { ADMIN_WRITE_ROLE_NOTICE } from "../../src/lib/admin-role-copy";
import { useAdminSession } from "../../src/lib/admin-token-context";
import { disclosureKeyBadge } from "../../src/lib/disclosure-keys";
import { loadErrorCopy, type LoadErrorCopy } from "../../src/lib/load-error-copy";
import { writeErrorMessage } from "../../src/lib/write-error-copy";
import styles from "../../src/components/admin-page.module.css";

// COM-103: an editor's save goes through draft -> submit for review instead of
// writing disclosures directly (PUT /admin/disclosures/:key is admin-only now).
function DisclosureRow({
  disclosure,
  isEditor,
  canEdit,
  onSaved,
  onDraftSubmitted,
  onAuthError
}: {
  disclosure: Disclosure;
  isEditor: boolean;
  /** 라운드 77 트랙 D: 이 카드의 제출 컨트롤이 서는 조건(admin 직접 저장 · editor 검토 요청). */
  canEdit: boolean;
  onSaved: (next: Disclosure) => void;
  onDraftSubmitted: () => void;
  onAuthError: () => void;
}) {
  const [text, setText] = useState(disclosure.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) {
      setError("문구를 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (isEditor) {
        await draftAndSubmitContentRevision({
          entityType: "disclosure",
          entityId: disclosure.id ?? undefined,
          payload: { key: disclosure.key, text: text.trim() }
        });
        onDraftSubmitted();
      } else {
        const next = await updateDisclosure(disclosure.key, text.trim());
        onSaved(next);
      }
      setSaved(true);
    } catch (err) {
      if (isAuthError(err)) {
        onAuthError();
        return;
      }
      setError(writeErrorMessage(err, "저장하지 못했어요. 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  };

  // GAP-065 #9: 이 경로는 키를 검증하지 않고 upsert하므로 오타 키도 "저장했어요"가 된다.
  // 저장을 막는 대신(나중에 쓸 키를 미리 막게 된다) 앱이 그 키를 읽는지 사실만 적는다.
  const badge = disclosureKeyBadge(disclosure.key);

  return (
    <div className={styles.card}>
      <h2>
        {disclosure.key}{" "}
        <span className={`${styles.badge} ${badge.appRead ? styles.badgeActive : ""}`}>{badge.label}</span>
      </h2>
      <p className={styles.hint}>{badge.hint}</p>
      {isEditor ? <p className={styles.hint}>저장하면 관리자에게 검토 요청이 전달돼요.</p> : null}
      <div className={styles.field}>
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </div>
      {error ? <p className={styles.errorBanner}>{error}</p> : null}
      {saved ? <p className={styles.successBanner}>{isEditor ? "검토 요청을 보냈어요." : "저장했어요."}</p> : null}
      {/* 라운드 77 트랙 D(GAP-077 #4ⓑ): 문구 자체는 읽기 권한자에게도 그대로 보인다
          (textarea가 남는다 — 값을 보는 것은 정당하다). 내려가는 것은 제출 컨트롤뿐이다. */}
      {canEdit ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : isEditor ? "검토 요청" : "저장"}
          </button>
        </div>
      ) : (
        <p className={styles.hint}>{ADMIN_WRITE_ROLE_NOTICE}</p>
      )}
    </div>
  );
}

export default function DisclosuresPage() {
  const { session, clearSession } = useAdminSession();
  const [disclosures, setDisclosures] = useState<Disclosure[] | null>(null);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const loadDisclosures = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      const result = await listDisclosures();
      setDisclosures(result.disclosures);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError(loadErrorCopy(error, "고지 문구 목록을 불러오지 못했어요."));
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadDisclosures();
  }, [loadDisclosures]);

  if (!session) return null;

  // COM-103: an editor's save goes through draft -> submit for review instead
  // of writing disclosures directly.
  const isEditor = session.admin.role === "editor";
  /**
   * 라운드 77 트랙 D(GAP-077 #4ⓑ): 화면이 서버와 같은 기준을 읽는다 — 직접 저장(PUT
   * /admin/disclosures/:key)은 `@RequireAdminRoles("admin")`, 검토 요청은 `editor`,
   * `analyst`에게 열린 쓰기 경로는 0건이다. 종전에는 `isEditor` 한 칸뿐이라 `analyst`가
   * `admin`과 같은 저장 UI를 보고 눌러 봐야 403만 받았다.
   */
  const canEdit = session.admin.role === "admin" || session.admin.role === "editor";

  const handleAddKey = async () => {
    const key = newKey.trim();
    if (!key) {
      setCreateError("키를 입력해 주세요.");
      return;
    }
    if (!newText.trim()) {
      setCreateError("문구를 입력해 주세요.");
      return;
    }
    if (disclosures?.some((entry) => entry.key === key)) {
      setCreateError("이미 존재하는 키예요. 아래 목록에서 수정해 주세요.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      if (isEditor) {
        await draftAndSubmitContentRevision({ entityType: "disclosure", payload: { key, text: newText.trim() } });
      } else {
        const created = await updateDisclosure(key, newText.trim());
        setDisclosures((current) => (current ? [...current, created] : [created]));
      }
      setNewKey("");
      setNewText("");
      setCreateSuccess(true);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setCreateError(writeErrorMessage(error, "저장하지 못했어요. 다시 시도해 주세요."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>제휴 고지 문구</h1>
        <p>제휴, 스폰서, 영양제 관련 고지 문구를 앱 배포 없이 수정해요.</p>
      </div>

      <section className={styles.card}>
        <h2>새 고지 문구 키 추가</h2>
        {isEditor ? <p className={styles.hint}>편집자 계정은 바로 저장하지 않고, 검토 요청을 관리자에게 보내요.</p> : null}
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="new-disclosure-key">키</label>
            <input id="new-disclosure-key" type="text" value={newKey} onChange={(event) => setNewKey(event.target.value)} />
            {/* GAP-065 #9: 오타 키가 태어나는 자리다 — 저장 전에 같은 사실을 미리 보여 준다. */}
            {newKey.trim() ? <p className={styles.hint}>{disclosureKeyBadge(newKey).label}</p> : null}
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="new-disclosure-text">문구</label>
          <textarea id="new-disclosure-text" value={newText} onChange={(event) => setNewText(event.target.value)} />
        </div>
        {createError ? <p className={styles.errorBanner}>{createError}</p> : null}
        {createSuccess ? (
          <p className={styles.successBanner}>{isEditor ? "검토 요청을 보냈어요." : "저장했어요."}</p>
        ) : null}
        {canEdit ? (
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={handleAddKey} disabled={creating}>
              {creating ? "저장 중..." : isEditor ? "검토 요청" : "추가"}
            </button>
          </div>
        ) : (
          <p className={styles.hint}>{ADMIN_WRITE_ROLE_NOTICE}</p>
        )}
      </section>

      {disclosures === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
      {loadError ? (
        <p className={styles.errorBanner}>
          {loadError.message}
          {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 실패에는 이 버튼을 세우지 않는다. */}
          {loadError.canRetry ? (
            <button type="button" className={styles.retryButton} onClick={loadDisclosures}>
              다시 시도
            </button>
          ) : null}
        </p>
      ) : null}
      {disclosures && disclosures.length === 0 ? <p className={styles.emptyState}>등록된 고지 문구가 없어요.</p> : null}
      {disclosures?.map((disclosure) => (
        <DisclosureRow
          key={disclosure.key}
          disclosure={disclosure}
          isEditor={isEditor}
          canEdit={canEdit}
          onAuthError={clearSession}
          onDraftSubmitted={() => {}}
          onSaved={(next) =>
            setDisclosures((current) => (current ? current.map((entry) => (entry.key === next.key ? next : entry)) : current))
          }
        />
      ))}
    </div>
  );
}
