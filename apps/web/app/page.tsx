// apps/web/app/page.tsx
import Link from "next/link";

export const metadata = {
  title: "RunServ — Infrastructure billing, handled",
  description:
    "RunServ turns scattered infrastructure invoices into one dashboard. Clients see what they owe, pick what to pay, and check out in USD or NGN.",
};

export default function MarketingPage() {
  return (
    <div style={{ background: "#0F1115", color: "#ECEEF2", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'IBM Plex Sans', ui-sans-serif, sans-serif; }
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        a { color: inherit; }
        .nav-link:hover { color: #ECEEF2 !important; }
        .cta-primary:hover { background: #3FB4F0 !important; }
        .feature-card { transition: border-color 0.15s ease; }
        .feature-card:hover { border-color: #3A404C; }
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-visual { order: -1; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ---------------- Nav ---------------- */}
      <nav
        style={{
          maxWidth: 1120, margin: "0 auto", padding: "24px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo/logo-mark-transparent.png" alt="RunServ" style={{ height: 28, width: "auto" }} />
          <span style={{ fontSize: 18, fontWeight: 700 }}>
            Run<span style={{ color: "#169DE3" }}>Serv</span>
          </span>
        </div>
        <Link
          href="/login"
          className="nav-link"
          style={{ fontSize: 14, color: "#868D99", textDecoration: "none", fontWeight: 500 }}
        >
          Client login →
        </Link>
      </nav>

      {/* ---------------- Hero ---------------- */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "60px 24px 40px" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div
              className="mono"
              style={{
                fontSize: 12, letterSpacing: "0.08em", color: "#169DE3",
                textTransform: "uppercase", marginBottom: 18,
              }}
            >
              Infrastructure billing
            </div>
            <h1 style={{ fontSize: "clamp(34px, 5vw, 52px)", lineHeight: 1.12, fontWeight: 700, margin: "0 0 20px", letterSpacing: "-0.02em" }}>
              See what you owe.
              <br />
              Pick what to pay.
              <br />
              <span style={{ color: "#169DE3" }}>One checkout.</span>
            </h1>
            <p style={{ fontSize: 17, color: "#868D99", lineHeight: 1.6, maxWidth: 440, margin: "0 0 32px" }}>
              Hosting, APIs, databases — every infrastructure cost a client owes,
              itemized in one place. They select what to settle and pay it in a
              single checkout, in USD or NGN.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/login"
                className="cta-primary"
                style={{
                  background: "#169DE3", color: "#FFFFFF", padding: "13px 24px",
                  borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none",
                }}
              >
                Client login
              </Link>
              <a
                href="#how-it-works"
                style={{
                  border: "1px solid #282D37", color: "#ECEEF2", padding: "13px 24px",
                  borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none",
                }}
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div
              style={{
                background: "#171A21", border: "1px solid #282D37",
                borderRadius: "4px 4px 20px 20px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
                maxWidth: 400, margin: "0 auto", overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 16,
                  background:
                    "linear-gradient(135deg, #0F1115 25%, transparent 25%), linear-gradient(225deg, #0F1115 25%, transparent 25%)",
                  backgroundSize: "16px 16px",
                  backgroundColor: "#171A21",
                }}
              />
              <div style={{ padding: "20px 22px 24px" }}>
                <div className="mono" style={{ fontSize: 11, color: "#868D99", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Payment requests
                </div>
                {[
                  ["Brevo", "45.00"],
                  ["Backend API Hosting", "120.00"],
                  ["Database Server", "89.50"],
                ].map(([name, amt]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px dashed #282D37" }}>
                    <span style={{ fontSize: 14 }}>{name}</span>
                    <span className="mono" style={{ fontSize: 14, color: "#ECEEF2" }}>${amt}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "#868D99" }}>Total</span>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>$254.50</span>
                </div>
                <div
                  style={{
                    marginTop: 16, background: "#169DE3", color: "#FFFFFF",
                    textAlign: "center", padding: "12px", borderRadius: 8, fontWeight: 600, fontSize: 14,
                  }}
                >
                  Pay now
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Built for teams billing clients for infrastructure</h2>
        <p style={{ color: "#868D99", fontSize: 15.5, marginBottom: 40, maxWidth: 560 }}>
          If you manage hosting, APIs, or servers on behalf of clients, RunServ
          replaces the spreadsheet-and-email-chain routine with something both
          sides can actually see.
        </p>
        <div className="feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            {
              title: "One dashboard, not five invoices",
              body: "Every service a client is billed for — hosting, APIs, databases, domains — lives in one place. No more chasing separate receipts.",
            },
            {
              title: "USD and NGN, one rate you control",
              body: "Clients choose their currency at checkout. Your margin on the conversion is yours to set, and you see the raw rate before any markup is applied.",
            },
            {
              title: "Reminders that send themselves",
              body: "Due and overdue balances get emailed automatically, so payment doesn't depend on you remembering to ask.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="feature-card"
              style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 14, padding: 24 }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#868D99", lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how-it-works" style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 80px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 40 }}>How it works</h2>
        <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {[
            { n: "01", title: "Services get added", body: "Each infrastructure cost — hosting, an API subscription, a database — is added with its own price and billing cycle." },
            { n: "02", title: "Clients see what's due", body: "On their login, clients see every due and upcoming charge, and check off exactly which ones to pay." },
            { n: "03", title: "One checkout settles it", body: "Selected items are summed into a single payment, in whichever currency the client picks, and a receipt goes out automatically." },
          ].map((s) => (
            <div key={s.n}>
              <div className="mono" style={{ fontSize: 13, color: "#169DE3", marginBottom: 10 }}>{s.n}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: "#868D99", lineHeight: 1.6, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CTA band ---------------- */}
      <section style={{ borderTop: "1px solid #282D37", borderBottom: "1px solid #282D37" }}>
        <div
          style={{
            maxWidth: 1120, margin: "0 auto", padding: "56px 24px",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20,
          }}
        >
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Ready to simplify client billing?</h2>
            <p style={{ color: "#868D99", fontSize: 14.5, margin: 0 }}>Clients log in and see their invoices — no setup on their end.</p>
          </div>
          <Link
            href="/login"
            className="cta-primary"
            style={{ background: "#169DE3", color: "#FFFFFF", padding: "14px 26px", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Client login
          </Link>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 32px", borderTop: "1px solid #282D37" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 32, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ maxWidth: 360 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <img src="/logo/logo-mark-transparent.png" alt="RunServ" style={{ height: 20, width: "auto" }} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                Run<span style={{ color: "#169DE3" }}>Serv</span>
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#868D99", lineHeight: 1.6, margin: 0 }}>
              Infrastructure billing, handled — one dashboard for every service
              cost your clients owe, and one checkout to settle it.
            </p>
          </div>

          <div style={{ fontSize: 13, color: "#868D99", lineHeight: 1.7 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "#868D99", textTransform: "uppercase", marginBottom: 6, opacity: 0.8 }}>
              Contact
            </div>
            <a href="mailto:support@runserv.org" style={{ color: "#868D99", textDecoration: "none", display: "block" }}>
              support@runserv.org
            </a>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #282D37", paddingTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "#868D99" }}>&copy; {new Date().getFullYear()} RunServ</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12.5, color: "#868D99" }}>RunServ &middot; Infrastructure billing, handled.</span>
            <Link href="/admin/login" style={{ fontSize: 11.5, color: "#565C68", textDecoration: "none" }}>
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}