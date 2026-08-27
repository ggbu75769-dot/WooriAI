import Link from "next/link";
import styles from "../src/components/admin-page.module.css";

/**
 * ADM-130: 404 screen for admin URLs that don't match a route.
 *
 * Without this file a mistyped path (or a stale bookmark from before a page was
 * renamed) lands on Next's default English "404 | This page could not be
 * found", which looks like an outage rather than a typo. Rendering inside the
 * admin layout keeps the nav available, so the operator can get where they were
 * going without retyping a URL.
 *
 * 재시도 버튼이 없는 것은 의도된 것이다: 404는 일시적 실패가 아니라서 같은 경로를
 * 다시 렌더해봐야 결과가 같다(그 복구 액션은 error.tsx만 갖는다). 여기서 쓸모 있는
 * 유일한 행동은 존재하는 화면으로 돌아가는 것뿐이다.
 */
export default function AdminNotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>찾을 수 없는 화면이에요</h1>
        <p>주소가 바뀌었거나 잘못 입력했을 수 있어요.</p>
      </div>

      <section className={styles.card}>
        <p className={styles.emptyState}>요청하신 관리자 화면이 없어요.</p>
        <div className={styles.actions} style={{ alignItems: "center", marginTop: 8 }}>
          <Link href="/" className={styles.primaryButton} style={{ textDecoration: "none" }}>
            대시보드로 가기
          </Link>
        </div>
      </section>
    </main>
  );
}
