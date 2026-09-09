// apps/web/app/page.tsx
import Link from "next/link";
import MarketingNav from "../components/MarketingNav";
import PaymentPreviewCard from "../components/PaymentPreviewCard";
import { SocialIcon } from "../components/SocialIcons";
import { SOCIAL_LINKS } from "../lib/social";
import { SITE_URL } from "../lib/seo";

export const metadata = {
  title: "RunServ — Infrastructure billing, handled",
  description:
    "RunServ turns scattered infrastructure invoices into one dashboard. Clients see what they owe, pick what to pay, and check out in USD or NGN.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "RunServ — Infrastructure billing, handled",
    description:
      "Every hosting, API, and server cost a client owes, itemized in one dashboard. One checkout, in USD or NGN.",
    url: SITE_URL,
    siteName: "RunServ",
    images: [{ url: "/social/og-image.png", width: 1200, height: 630, alt: "RunServ — Infrastructure billing, handled" }],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RunServ — Infrastructure billing, handled",
    description: "See what you owe. Pick what to pay. One checkout.",
    images: ["/social/og-image.png"],
  },
};

const faqs = [
  {
    q: "Do clients need to create an account?",
    a: "No setup on their side. They log in with the credentials you issue and see every service billed to their organization right away.",
  },
  {
    q: "Can a client pay only part of what's due?",
    a: "Yes — each item has its own checkbox. Clients choose exactly which charges to settle in a given checkout, and the total updates as they select.",
  },
  {
    q: "Who sets the USD to NGN rate?",
    a: "You do. RunServ shows the raw exchange rate before any markup, and your margin on the conversion is yours to configure.",
  },
  {
    q: "What happens if a payment is missed?",
    a: "Items move from due to overdue automatically, and reminder emails go out on your schedule — no manual chasing required.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function MarketingPage() {
  return (
    <div id="top" style={{ background: "#0F1115", color: "#ECEEF2", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'IBM Plex Sans', ui-sans-serif, sans-serif; }
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        a { color: inherit; }
        .nav-link:hover { color: #ECEEF2 !important; }
        .social-link:hover { color: #ECEEF2 !important; }
        .cta-primary:hover { background: #3FB4F0 !important; }
        .feature-card { transition: border-color 0.15s ease, transform 0.15s ease; }
        .feature-card:hover { border-color: #3A404C; transform: translateY(-2px); }
        .rowcard { transition: border-color 0.15s ease, transform 0.15s ease; }
        .rowcard:hover { border-color: #3A404C; transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) {
          .feature-card, .rowcard, .cta-primary { transition: none !important; }
        }
        @keyframes rs-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes rs-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-visual { order: -1; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .compare-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <MarketingNav />

      {/* ---------------- Hero ---------------- */}
      <section style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "64px 24px 40px", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute", top: -180, right: -160, width: 520, height: 520, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,157,227,0.16) 0%, rgba(22,157,227,0) 70%)",
            pointerEvents: "none",
          }}
        />
        <div className="hero-grid" style={{ position: "relative", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#868D99",
                marginBottom: 20, padding: "5px 11px 5px 9px", border: "1px solid #282D37", borderRadius: 20,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", animation: "rs-pulse 2s ease-in-out infinite" }} />
              Built for agencies billing infrastructure to clients
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
                href="/agency-signup"
                className="cta-primary"
                style={{
                  background: "#169DE3", color: "#FFFFFF", padding: "13px 24px",
                  borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none",
                }}
              >
                Create your workspace
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
            <PaymentPreviewCard />
          </div>
        </div>
      </section>

      {/* ---------------- Before / after ---------------- */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 10px" }}>
        <div
          className="compare-grid"
          style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
            background: "#12151B", border: "1px solid #21252E", borderRadius: 16, padding: 4,
          }}
        >
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#868D99", marginBottom: 14 }}>Without RunServ</div>
            {[
              "Invoices scattered across five email threads",
              "Clients unsure which balance is current",
              "You manually convert and chase each payment",
            ].map((t) => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ color: "#F87171", fontSize: 14, lineHeight: "20px" }}>✕</span>
                <span style={{ fontSize: 14, color: "#868D99", lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: 24, background: "#171A21", borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#169DE3", marginBottom: 14 }}>With RunServ</div>
            {[
              "Every cost itemized in one dashboard",
              "Clients see exactly what's due and overdue",
              "One checkout settles it, in USD or NGN",
            ].map((t) => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ color: "#4ADE80", fontSize: 14, lineHeight: "20px" }}>✓</span>
                <span style={{ fontSize: 14, color: "#ECEEF2", lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Built for teams billing clients for infrastructure</h2>
        <p style={{ color: "#868D99", fontSize: 15.5, marginBottom: 40, maxWidth: 560 }}>
          If you manage hosting, APIs, or servers on behalf of clients, RunServ
          replaces the spreadsheet-and-email-chain routine with something both
          sides can actually see.
        </p>
        <div className="feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            {
              icon: "▤",
              title: "One dashboard, not five invoices",
              body: "Every service a client is billed for — hosting, APIs, databases, domains — lives in one place. No more chasing separate receipts.",
            },
            {
              icon: "$",
              title: "USD and NGN, one rate you control",
              body: "Clients choose their currency at checkout. Your margin on the conversion is yours to set, and you see the raw rate before any markup is applied.",
            },
            {
              icon: "◔",
              title: "Reminders that send themselves",
              body: "Due and overdue balances get emailed automatically, so payment doesn't depend on you remembering to ask.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="feature-card"
              style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 14, padding: 24 }}
            >
              <div
                style={{
                  width: 34, height: 34, borderRadius: 9, background: "rgba(22,157,227,0.12)",
                  color: "#169DE3", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, marginBottom: 14,
                }}
              >
                {f.icon}
              </div>
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

      {/* ---------------- Positioning strip ---------------- */}
      <section style={{ borderTop: "1px solid #21252E", borderBottom: "1px solid #21252E" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 20, fontWeight: 600, color: "#ECEEF2", margin: 0, letterSpacing: "-0.01em" }}>
            The developers' choice for infrastructure billing.
          </p>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" style={{ maxWidth: 760, margin: "0 auto", padding: "20px 24px 90px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 32 }}>Questions</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#21252E", borderRadius: 14, overflow: "hidden" }}>
          {faqs.map((item) => (
            <details key={item.q} style={{ background: "#171A21", padding: "18px 22px" }}>
              <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, listStyle: "none" }}>
                {item.q}
              </summary>
              <p style={{ fontSize: 14, color: "#868D99", lineHeight: 1.6, margin: "10px 0 0" }}>{item.a}</p>
            </details>
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
            href="/agency-signup"
            className="cta-primary"
            style={{ background: "#169DE3", color: "#FFFFFF", padding: "14px 26px", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Create your workspace
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
            <div>52 Millbrook Road, Edmonton</div>
            <div>London, N9 7HX</div>
            <a href="tel:+442035904976" style={{ color: "#868D99", textDecoration: "none", display: "block" }}>
              +44 203 590 4976
            </a>
            <a href="mailto:support@runserv.org" style={{ color: "#868D99", textDecoration: "none", display: "block" }}>
              support@runserv.org
            </a>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #282D37", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: "#868D99" }}>&copy; {new Date().getFullYear()} RunServ</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  style={{ color: "#868D99", display: "flex" }}
                  className="social-link"
                >
                  <SocialIcon name={s.name} size={16} />
                </a>
              ))}
            </div>
            <span style={{ fontSize: 12.5, color: "#868D99" }}>RunServ &middot; Infrastructure billing, handled.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}