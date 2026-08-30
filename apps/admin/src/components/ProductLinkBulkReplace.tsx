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
  createIdempotencyKeyHolder,
  isAuthError,
  isIdempotentTimeoutError,
  isRetryUnsafeTimeoutError,
  type ProductLinkBulkApplyResult,
  type ProductLinkBulkPreviewResult
} from "../lib/admin-api";
import { linkPriceText } from "../lib/link-price-view";
import { writeErrorMessage } from "../lib/write-error-copy";
import { useAdminSession } from "../lib/admin-token-context";
import styles from "./admin-page.module.css";

const CSV_EXAMPLE = `${PRODUCT_LINK_BULK_CSV_HEADER}
,car-seat,coupang,https://link.coupang.com/a/abc123,159000
1f0e8a76-1234-4cde-8f00-aabbccddeeff,,,https://smartstore.naver.com/store/xyz,`;

export function ProductLinkBulkReplace({ onApplied }: { onApplied?: () => void }) {
  const { clearSession } = useAdminSession();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // R19-F: 적용(bulk-apply) 시도 하나당 멱등키 하나. 같은 CSV로 다시 누르는
  // 재시도는 **같은 키**를 다시 보내야 서버가 중복 반영을 걸러 준다. 반대로
  // CSV가 바뀌면(=body가 바뀌면) 반드시 새 키여야 한다 — 같은 키 + 다른 body는
  // 서버가 409 IDEMPOTENCY_KEY_CONFLICT로 거절한다. 그래서 키는 CSV 원문을
  // 지문으로 넘겨(current(csv)) CSV가 바뀌면 자동 회전시키고, 적용에 성공하면
  // rotate()로 명시 회전한다. 실패/타임아웃에서는 그대로 유지한다 — 그게 바로
  // 재시도가 중복 없이 처리되게 만드는 지점이다.
  const applyKey = useRef(createIdempotencyKeyHolder()).current;

  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ProductLinkBulkPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ProductLinkBulkApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // FIX-118C: 적용 요청이 쓰기 타임아웃(60초)으로 끊겼을 때의 안내. 서버에
  // 멱등키가 없어 "반영됐는지 모르는" 상태이므로, 자동 재시도 대신 현재 상태를
  // 재조회해서 운영자가 직접 판단하게 한다.
  const [timeoutNotice, setTimeoutNotice] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);

  // CSV가 바뀌면 이전 미리보기는 무효 — 다시 미리보기 전까지 적용을 막는다.
  const handleCsvChange = (next: string) => {
    setCsv(next);
    setPreview(null);
    setApplyResult(null);
    setError(null);
    setTimeoutNotice(null);
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
    setTimeoutNotice(null);
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

  /** 적용 타임아웃 직후 현재 링크 상태를 다시 읽어온다. bulk-preview는 검증만
   * 하고 절대 쓰지 않으므로 재조회로 써도 안전하다. 결과 표의 "현재 제휴 URL"이
   * 새 URL과 같으면 이미 반영된 것 — 다시 적용할 필요가 없다. */
  const recheckCurrentState = async () => {
    setRechecking(true);
    try {
      setPreview(await bulkPreviewProductLinks(csv));
    } catch {
      // 재조회까지 실패하면 안내 문구만 남긴다 — 목록 새로고침으로 확인하면 된다.
      setPreview(null);
    } finally {
      setRechecking(false);
    }
  };

  const handleApply = async () => {
    if (!preview || preview.summary.valid === 0) return;
    setApplying(true);
    setError(null);
    setTimeoutNotice(null);
    try {
      const result = await bulkApplyProductLinks(csv, applyKey.current(csv));
      setApplyResult(result);
      setPreview(null);
      // 이 CSV에 대한 적용이 끝났다 — 다음 적용은 새 시도로 취급한다.
      applyKey.rotate();
      onApplied?.();
    } catch (err) {
      if (isAuthError(err)) {
        clearSession();
        return;
      }
      // R19-F: 멱등키를 실어 보낸 뒤 타임아웃이면 재시도가 안전하다 — 같은 키를
      // 그대로 유지한 채 "적용"을 다시 누르면 서버는 500행을 다시 쓰지 않고 첫
      // 결과를 재생한다. 미리보기도 지우지 않아 버튼이 계속 눌리는 상태로 둔다.
      if (isIdempotentTimeoutError(err)) {
        setTimeoutNotice(
          "적용 요청이 오래 걸려 결과를 확인하지 못했어요. 같은 요청을 다시 보내면 중복 없이 처리되니, '적용'을 한 번 더 눌러 주세요. 이미 반영됐다면 첫 결과가 그대로 표시돼요."
        );
        onApplied?.();
        return;
      }
      // FIX-118C: 멱등키가 없던 시절의 경로(방어적으로 유지). 쓰기 타임아웃은
      // "실패"가 아니라 "결과 불명"이라 재시도를 권하지 않고, 현재 상태를 자동으로
      // 재조회해 이미 반영됐는지 표에서 확인하도록 안내한다.
      if (isRetryUnsafeTimeoutError(err)) {
        setPreview(null);
        setTimeoutNotice(
          // GAP-064 #4ⓐ: 예전에는 이 문장이 URL만 가리켰다 — 같은 CSV로 쓴 가격은 어디에서도
          // 대조할 수 없었다. 표에 가격 두 열이 생겼으니 안내도 그 자리를 함께 가리킨다.
          "적용 요청이 오래 걸려 결과를 확인하지 못했어요. 이미 반영됐을 수 있으니 바로 다시 적용하지 마세요. 현재 링크 상태를 다시 불러왔어요 — 아래 표의 '현재 제휴 URL'이 '새 제휴 URL'과, '현재 가격'이 '새 가격'과 같으면 이미 반영된 행이에요."
        );
        onApplied?.();
        setApplying(false);
        await recheckCurrentState();
        return;
      }
      // 라운드 76 트랙 B: 위 두 갈래(멱등 타임아웃·재시도 불가 타임아웃)는 이 패널이
      // 이미 갈라 두었고, 남은 실패(400 검증·403·5xx·연결 실패)의 서버 사유는 여기서
      // 통째로 버려지고 있었다. 종전 폴백은 서버가 아무 말도 못 했을 때만 선다.
      setError(writeErrorMessage(err, "적용하지 못했어요. 다시 미리보기 후 시도해 주세요."));
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
          {/* COM-107b: real downloadable template file (public/product-link-bulk-template.csv).
              CSV 파서는 # 주석 행을 지원하지 않아 템플릿에 유효한 형태의 예시 행 2개를
              담았다 — 아래 hint에서 예시 행 교체를 안내한다. */}
          <a
            className={styles.secondaryButton}
            style={{ textDecoration: "none" }}
            href="/product-link-bulk-template.csv"
            download
          >
            템플릿 다운로드
          </a>
          <button type="button" className={styles.secondaryButton} onClick={handleCopyHeader}>
            {copied ? "복사됨" : "헤더 복사"}
          </button>
        </div>
        <span className={styles.hint}>
          템플릿의 예시 행 2개(쿠팡/네이버 자리표시 URL)는 실제 값으로 교체한 뒤 업로드해 주세요. #
          주석 행은 지원하지 않아요.
        </span>
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
      {timeoutNotice ? (
        <div className={styles.calloutWarning} role="status">
          <strong>적용 결과를 확인해 주세요</strong>
          <span>{timeoutNotice}</span>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={recheckCurrentState}
              disabled={rechecking || previewing || applying}
            >
              {rechecking ? "확인 중..." : "현재 상태 다시 확인"}
            </button>
          </div>
        </div>
      ) : null}
      {applyResult ? (
        <p className={styles.successBanner}>
          적용 {applyResult.applied}건 · 건너뜀(변경 없음) {applyResult.skipped}건 · 오류 {applyResult.errors}건
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handlePreview}
          disabled={previewing || applying || rechecking}
        >
          {previewing ? "검증 중..." : "미리보기"}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleApply}
          disabled={applying || rechecking || !preview || preview.summary.valid === 0}
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
                  {/* GAP-064 #4ⓐ: 가격을 쓰는 유일한 경로가 이 CSV인데, 적용 뒤 받는 것은
                      {applied, skipped, errors} 숫자 셋뿐이라 **가격이 반영됐는지 확인할 자리가
                      없었다**(타임아웃 뒤 재조회조차 URL만 대조했다 — 위 recheckCurrentState 주석).
                      URL과 같은 모양으로 현재/새 값을 나란히 둔다. 가격 칸이 빈 행은 "-"이고,
                      그건 "0원으로 바꾼다"가 아니라 **가격을 그대로 둔다**는 뜻이다. */}
                  <th>현재 가격</th>
                  <th>새 가격</th>
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
                    {/* 금액 서식은 링크 표의 가격 열과 **같은 함수**를 쓴다(두 벌을 만들지 않는다). */}
                    <td>{linkPriceText({ priceSnapshotKrw: row.currentPriceSnapshotKrw ?? null })}</td>
                    <td>{linkPriceText({ priceSnapshotKrw: row.newPriceSnapshotKrw ?? null })}</td>
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
