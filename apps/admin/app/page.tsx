export default function AdminHomePage() {
  const sections = [
    {
      id: "ADM-002",
      title: "Item templates",
      description: "Create and update preparation items, including required skip copy for non-essential items."
    },
    {
      id: "ADM-003",
      title: "Product links",
      description: "Manage product URLs, affiliate flags, sponsored markers, and CTA-adjacent disclosure overrides."
    },
    {
      id: "ADM-004",
      title: "Disclosures",
      description: "Update affiliate, sponsored, and nutrition/supplement policy copy without a mobile app deploy."
    },
    {
      id: "ADM-004",
      title: "Click summary",
      description: "Review affiliate click totals by platform from the admin analytics endpoint."
    }
  ];

  return (
    <main style={{ background: "#FFF8F1", color: "#242424", minHeight: "100vh", padding: 32 }}>
      <p style={{ color: "#7A7A7A" }}>ADM-001</p>
      <h1>WooriAI Admin CMS</h1>
      <section style={{ background: "#FFFFFF", borderRadius: 8, marginBottom: 20, padding: 20 }}>
        <h2>Admin auth placeholder</h2>
        <p>Internal admin requests use the x-admin-token header until production admin auth is connected.</p>
      </section>
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {sections.map((section) => (
          <article key={`${section.id}-${section.title}`} style={{ background: "#FFFFFF", borderRadius: 8, padding: 20 }}>
            <p style={{ color: "#7A7A7A" }}>{section.id}</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
