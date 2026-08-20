"use client";

// COM-107-prep: CSV 일괄 교체 패널. 쿠팡 파트너스/네이버 커넥트 승인이 나면
// 시드된 example.com 링크 58건을 CSV 한 번 업로드로 실제 제휴 링크로 교체한다.
// 흐름: CSV 붙여넣기/파일 선택 -> 미리보기(검증만, 쓰기 없음) -> 적용(유효 행만).
// 관리자(admin) 역할 전용 — API 엔드포인트 자체가 admin-only라 링크 페이지에서
// admin 세션일 때만 렌더링한다.

import { useRef, useState } from "react";
import {
  PRODUCT_LINK_BULK_CSV_HEADER,
  bulkApplyProductLinks,
  bulkPreviewProductLinks,
  isAuthError,
  type ProductLinkBulkApplyResult,
  type ProductLinkBulkPreviewResult
} from "../lib/admin-api";
import { useAdminSession } from "../lib/admin-token-context";
import styles from "./admin-page.module.css";

const CSV_EXAMPLE = `${PRODUCT_LINK_BULK_CSV_HEADER}
,car-seat,coupang,https://link.coupang.com/a/abc123,159000
1f0e8a76-1234-4cde-8f00-aabbccddeeff,,,https://smartstore.naver.com/store/xyz,`;

export function ProductLinkBulkReplace({ onApplied }: { onApplied?: () => void }) {
  const { clearSession } = useAdminSession();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ProductLinkBulkPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ProductLinkBulkApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // CSV가 바뀌면 이전 미리보기는 무효 — 다시 미리보기 전까지 적용을 막는다.
  const handleCsvChange = (next: string) => {
    setCsv(next);
    setPreview(null);
    setApplyResult(null);
    setError(null);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleCsvChange(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  };

  const handleCopyHeader = async () => {
    try {
      await navigator.clipboard.writeText(PRODUCT_LINK_BULK_CSV_HEADER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 코드 블록에서 직접 복사하면 된다.
    }
  };

  const handlePreview = async () => {
    if (!csv.trim()) {
      setError("CSV 내용을 입력하거나 파일을 선택해 주세요.");
      return;
    }
    setPreviewing(true);
    setError(null);
    setApplyResult(null);
    try {
      setPreview(await bulkPreviewProductLinks(csv));
    } catch (err) {
      if (isAuthError(err)) {
        clearSession();
        return;
      }
      setError("미리보기에 실패했어요. CSV 형식을 확인하고 다시 시도해 주세요.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!preview || preview.summary.valid === 0) return;
    setApplying(true);
    setError(null);
    try {
      const result = await bulkApplyProductLinks(csv);
      setApplyResult(result);
      setPreview(null);
      onApplied?.();
    } catch (err) {
      if (isAuthError(err)) {
        clearSession();
        return;
      }
      setError("적용하지 못했어요. 다시 미리보기 후 시도해 주세요.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2>CSV 일괄 교체</h2>
      <p className={styles.hint}>
        제휴 승인 후 상품 링크의 제휴 URL을 한 번에 교체해요. 먼저 미리보기로 검증한 다음, 유효한 행만
        적용돼요. 대상은 productLinkId 또는 itemTemplate(코드/이름)+platform으로 지정해요. affiliateUrl은
        https:// 이면서 허용된 제휴 도메인이어야 해요.
      </p>

      <div className={styles.field}>
        <label htmlFor="bulk-csv-template">CSV 템플릿</label>
        <pre className={styles.calloutCode} id="bulk-csv-template">
          {CSV_EXAMPLE}
        </pre>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={handleCopyHeader}>
            {copied ? "복사됨" : "헤더 복사"}
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="bulk-csv-file">CSV 파일 (UTF-8)</label>
        <input
          id="bulk-csv-file"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="bulk-csv-text">CSV 내용</label>
        <textarea
          id="bulk-csv-text"
          rows={8}
          value={csv}
          onChange={(event) => handleCsvChange(event.target.value)}
          placeholder={PRODUCT_LINK_BULK_CSV_HEADER}
        />
        <span className={styles.hint}>파일을 선택하면 내용이 여기에 채워져요. 직접 붙여넣어도 돼요.</span>
      </div>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}
      {applyResult ? (
        <p className={styles.successBanner}>
          적용 {applyResult.applied}건 · 건너뜀(변경 없음) {applyResult.skipped}건 · 오류 {applyResult.errors}건
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={handlePreview} disabled={previewing || applying}>
          {previewing ? "검증 중..." : "미리보기"}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleApply}
          disabled={applying || !preview || preview.summary.valid === 0}
        >
          {applying ? "적용 중..." : preview ? `적용 (유효 ${preview.summary.valid}건)` : "적용"}
        </button>
      </div>

      {preview ? (
        <>
          <p className={styles.hint}>
            총 {preview.summary.total}행 중 유효 {preview.summary.valid}행, 오류 {preview.summary.errors}행이에요.
            적용하면 유효한 행만 반영돼요.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>행</th>
                  <th>상태</th>
                  <th>대상 링크</th>
                  <th>현재 제휴 URL</th>
                  <th>새 제휴 URL</th>
                  <th>메시지</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <span
                        className={
                          row.status === "valid"
                            ? `${styles.badge} ${styles.badgeActive}`
                            : `${styles.badge} ${styles.badgeInactive}`
                        }
                      >
                        {row.status === "valid" ? "유효" : "오류"}
                      </span>
                    </td>
                    <td>{row.matchedTitle ?? row.matchedProductLinkId ?? "-"}</td>
                    <td>{row.currentAffiliateUrl ?? "(없음)"}</td>
                    <td>{row.newAffiliateUrl ?? "-"}</td>
                    <td>{row.status === "valid" ? "교체 예정이에요." : (row.errorMessage ?? row.errorCode ?? "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
