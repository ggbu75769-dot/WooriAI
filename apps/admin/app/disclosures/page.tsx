"use client";

import { useCallback, useEffect, useState } from "react";
import { isAuthError, listDisclosures, updateDisclosure, type Disclosure } from "../../src/lib/admin-api";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

function DisclosureRow({
  disclosure,
  onSaved,
  onAuthError
}: {
  disclosure: Disclosure;
  onSaved: (next: Disclosure) => void;
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
      const next = await updateDisclosure(disclosure.key, text.trim());
      onSaved(next);
      setSaved(true);
    } catch (err) {
      if (isAuthError(err)) {
        onAuthError();
        return;
      }
      setError("저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2>{disclosure.key}</h2>
      <div className={styles.field}>
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </div>
      {error ? <p className={styles.errorBanner}>{error}</p> : null}
      {saved ? <p className={styles.successBanner}>저장했어요.</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

export default function DisclosuresPage() {
  const { session, clearSession } = useAdminSession();
  const [disclosures, setDisclosures] = useState<Disclosure[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      setLoadError("고지 문구 목록을 불러오지 못했어요.");
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadDisclosures();
  }, [loadDisclosures]);

  if (!session) return null;

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
    try {
      const created = await updateDisclosure(key, newText.trim());
      setDisclosures((current) => (current ? [...current, created] : [created]));
      setNewKey("");
      setNewText("");
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setCreateError("저장하지 못했어요. 다시 시도해 주세요.");
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
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="new-disclosure-key">키</label>
            <input id="new-disclosure-key" type="text" value={newKey} onChange={(event) => setNewKey(event.target.value)} />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="new-disclosure-text">문구</label>
          <textarea id="new-disclosure-text" value={newText} onChange={(event) => setNewText(event.target.value)} />
        </div>
        {createError ? <p className={styles.errorBanner}>{createError}</p> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={handleAddKey} disabled={creating}>
            {creating ? "저장 중..." : "추가"}
          </button>
        </div>
      </section>

      {disclosures === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
      {loadError ? (
        <p className={styles.errorBanner}>
          {loadError}
          <button type="button" className={styles.retryButton} onClick={loadDisclosures}>
            다시 시도
          </button>
        </p>
      ) : null}
      {disclosures && disclosures.length === 0 ? <p className={styles.emptyState}>등록된 고지 문구가 없어요.</p> : null}
      {disclosures?.map((disclosure) => (
        <DisclosureRow
          key={disclosure.key}
          disclosure={disclosure}
          onAuthError={clearSession}
          onSaved={(next) =>
            setDisclosures((current) => (current ? current.map((entry) => (entry.key === next.key ? next : entry)) : current))
          }
        />
      ))}
    </div>
  );
}
