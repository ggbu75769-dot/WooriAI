import React from "react";
import Link from "next/link";

export default function AdminHomePage() {
  const sections = [
    {
      id: "ADM-002",
      title: "Item templates",
      description: "Create and update preparation items, including required skip copy for non-essential items.",
      href: "/items"
    },
    {
      id: "ADM-003",
      title: "Product links",
      description: "Manage product URLs, affiliate flags, sponsored markers, and CTA-adjacent disclosure overrides.",
      href: "/links"
    },
    {
      id: "ADM-004",
      title: "Disclosures",
      description: "Update affiliate, sponsored, and nutrition/supplement policy copy without a mobile app deploy.",
      href: "/disclosures"
    },
    {
      id: "ADM-004",
      title: "Click summary",
      description: "Review affiliate click totals by platform from the admin analytics endpoint.",
      href: "/clicks"
    },
    {
      id: "ADM-005",
      title: "Content review",
      description: "Review editor-submitted drafts, diff against the live copy, and approve, reject, or roll back.",
      href: "/reviews"
    }
  ];

  return (
    <main style={{ background: "#FFF8F1", color: "#242424", minHeight: "100vh", padding: 32 }}>
      <p style={{ color: "#7A7A7A" }}>ADM-001</p>
      <h1>WooriAI Admin CMS</h1>
      <section style={{ background: "#FFFFFF", borderRadius: 8, marginBottom: 20, padding: 20 }}>
        <h2>관리자 로그인과 보안</h2>
        <p>관리자 로그인은 API가 발급한 HttpOnly 세션 쿠키를 사용하며, 브라우저 저장소에 인증 토큰을 보관하지 않습니다.</p>
        <p>비밀번호 확인 뒤 등록된 관리자는 MFA 코드를 추가로 확인하고, 처음 로그인한 관리자는 다른 CMS 기능을 사용하기 전에 MFA 등록을 완료해야 합니다.</p>
        <p>상태 변경 요청은 CSRF 쿠키와 요청 헤더를 함께 검증합니다. 개발·테스트 전용 API 호환 경로는 CMS의 production 인증 방식이 아닙니다.</p>
      </section>
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {sections.map((section) => (
          <article key={`${section.id}-${section.title}`} style={{ background: "#FFFFFF", borderRadius: 8, padding: 20 }}>
            <p style={{ color: "#7A7A7A" }}>{section.id}</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <Link href={section.href}>바로가기</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
