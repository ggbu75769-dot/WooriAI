"use client";

import { useEffect } from "react";

/**
 * ADM-130: last-resort boundary for failures in the root layout itself.
 *
 * Next only reaches this file when app/layout.tsx (or something it renders,
 * e.g. AdminShell/AdminTokenProvider) throws — at that point error.tsx is
 * unreachable because it renders *inside* that layout. Per the Next.js
 * convention this component therefore replaces the root layout and must render
 * its own <html>/<body>; `lang="ko"` is repeated here for the same reason.
 *
 * Styling stays inline rather than importing the shared CSS module the other
 * admin pages use: the whole point of this screen is that the surrounding app
 * failed to mount, so it must not depend on anything else loading successfully.
 * Only the palette is shared (배경 #FFF8F1, 본문 #242424, 강조 #FF8A3D), so the
 * screen still looks like our tool without depending on our stylesheets.
 */
export default function AdminGlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] 관리자 앱을 시작하지 못했어요.", error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ background: "#FFF8F1", color: "#242424", margin: 0 }}>
        <main
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "center",
            minHeight: "100vh",
            padding: 32,
            textAlign: "center"
          }}
        >
          <h1 style={{ fontSize: 22, margin: 0 }}>관리자 화면을 열지 못했어요</h1>
          <p style={{ color: "#7A7A7A", fontSize: 14, margin: 0 }}>
            잠시 후 다시 시도해주세요. 계속 이 화면이 보이면 개발팀에 알려주세요.
          </p>
          {error.digest ? (
            <p style={{ color: "#7A7A7A", fontSize: 12, margin: 0 }}>오류 코드: {error.digest}</p>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#FF8A3D",
                border: "none",
                borderRadius: 8,
                color: "#FFFFFF",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                padding: "9px 16px"
              }}
            >
              다시 시도
            </button>
            {/* 라우터 컨텍스트까지 무너진 상황이라 next/link 대신 전체 새로고침으로 홈에 간다. */}
            <a
              href="/"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E0D9CF",
                borderRadius: 8,
                color: "#242424",
                fontSize: 14,
                padding: "9px 16px",
                textDecoration: "none"
              }}
            >
              대시보드로 가기
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
