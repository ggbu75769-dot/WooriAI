import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  ["/privacy", "개인정보처리방침"],
  ["/terms", "이용약관"],
  ["/account-deletion", "계정 삭제"],
  ["/data-export", "데이터 내보내기"],
  ["/support", "고객지원"]
] as const;

export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ margin: "0 auto", maxWidth: 760, padding: "48px 24px", fontFamily: "sans-serif", lineHeight: 1.7 }}>
      <header style={{ borderBottom: "1px solid #e7ddd5", marginBottom: 28, paddingBottom: 20 }}>
        <Link href="/privacy" style={{ color: "#b54025", fontWeight: 800, textDecoration: "none" }}>우리아이</Link>
        <h1>{title}</h1>
        <nav aria-label="법적 문서 및 고객지원" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
      </header>
      {children}
    </main>
  );
}

export function LegalPlaceholderNotice() {
  return (
    <p role="status" style={{ background: "#fff3cd", border: "1px solid #e7c85b", borderRadius: 8, padding: 16 }}>
      이 문서는 법률 검토와 운영자 승인이 필요한 출시 전 템플릿입니다. 승인된 원문과 공개 URL이 설정될 때까지 출시 게이트가 차단됩니다.
    </p>
  );
}
