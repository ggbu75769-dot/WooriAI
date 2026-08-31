"use client";

import Link from "next/link";
import { useEffect } from "react";
import styles from "../src/components/admin-page.module.css";

/**
 * ADM-130: route-segment error boundary for the whole admin app.
 *
 * Without this file a render-time exception in any admin page falls through to
 * Next's built-in error screen — an untranslated English "Application error: a
 * client-side exception has occurred" with no way back other than editing the
 * URL. Operators then have no idea whether the CMS is broken or they simply hit
 * a bad row, and nothing tells them to retry.
 *
 * This boundary keeps the operator inside the admin shell (it renders as a
 * child of app/layout.tsx, so the nav and session stay mounted), speaks the
 * same 해요체 as the rest of the CMS, and offers the two actions that actually
 * recover: `reset()` re-renders the failed segment in place, and a link back to
 * the dashboard for when the failure is not transient. Errors that break the
 * root layout itself cannot be caught here — global-error.tsx handles those.
 */
export default function AdminRouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 서버 로그에는 이미 남지만, 운영자가 브라우저 콘솔만 열어봐도 원인을 알 수 있게 한다.
    console.error("[admin] 화면을 렌더링하는 중 오류가 발생했어요.", error);
  }, [error]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>화면을 불러오지 못했어요</h1>
        <p>일시적인 문제일 수 있어요. 다시 시도해보고, 그래도 안 되면 대시보드로 돌아가 주세요.</p>
      </div>

      <section className={styles.card}>
        <p className={styles.errorBanner} role="alert">문제가 생겨 이 화면을 표시할 수 없어요.</p>
        {error.digest ? <p className={styles.hint}>오류 코드: {error.digest}</p> : null}
        <div className={styles.actions} style={{ alignItems: "center", marginTop: 16 }}>
          <button type="button" className={styles.primaryButton} onClick={() => reset()}>
            다시 시도
          </button>
          <Link href="/" className={styles.secondaryButton} style={{ textDecoration: "none" }}>
            대시보드로 가기
          </Link>
        </div>
      </section>
    </div>
  );
}
