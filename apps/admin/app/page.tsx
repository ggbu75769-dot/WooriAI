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
    },
    {
      id: "ADM-006",
      title: "Admin accounts",
      description: "Create admin users, change roles, and deactivate accounts (admin role only).",
      href: "/users"
    }
  ];

  return (
    <main style={{ background: "#FFF8F1", color: "#242424", minHeight: "100vh", padding: 32 }}>
      <p style={{ color: "#7A7A7A" }}>ADM-001</p>
      <h1>WooriAI Admin CMS</h1>
      <section style={{ background: "#FFFFFF", borderRadius: 8, marginBottom: 20, padding: 20 }}>
        <h2>Admin authentication</h2>
        <p>세션 쿠키 + CSRF + TOTP MFA 기반 인증이 적용되어 있습니다. 레거시 x-admin-token 헤더는 개발/테스트 환경 전용이며 프로덕션에서는 차단됩니다.</p>
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
