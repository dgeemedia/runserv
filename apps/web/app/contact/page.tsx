// apps/web/app/contact/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "../../components/MarketingNav";
import ContactForm from "../../components/ContactForm";
import { OFFICES } from "../../lib/offices";
import { SITE_URL } from "../../lib/seo";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with RunServ — general enquiries, agency sign-up questions, support, or partnerships.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact RunServ",
    description: "Get in touch with RunServ — general enquiries, agency sign-up questions, support, or partnerships.",
    url: `${SITE_URL}/contact`,
    images: [{ url: "/social/og-image.png", width: 1200, height: 630, alt: "RunServ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact RunServ",
    description: "Get in touch with RunServ — general enquiries, agency sign-up questions, support, or partnerships.",
    images: ["/social/og-image.png"],
  },
};

export default function ContactPage() {
  return (
    <div style={{ background: "#0F1115", color: "#ECEEF2", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'IBM Plex Sans', ui-sans-serif, sans-serif; }
        input:focus, select:focus, textarea:focus { border-color: #169DE3 !important; }
        @media (max-width: 700px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <MarketingNav />

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px 90px" }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
            Get in touch
          </h1>
          <p style={{ fontSize: 15.5, color: "#868D99", maxWidth: 480, lineHeight: 1.6, margin: 0 }}>
            Questions about setting up your agency, an existing account, or anything
            else — send a message and we'll get back to you.
          </p>
        </div>

        <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 48 }}>
          <ContactForm />

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {OFFICES.map((office) => (
              <div key={office.region} style={{ fontSize: 13.5, color: "#868D99", lineHeight: 1.7 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "#868D99", textTransform: "uppercase", marginBottom: 6, opacity: 0.8 }}>
                  {office.region}
                </div>
                {office.operatedBy && (
                  <div style={{ fontSize: 12, color: "#5C636E", marginBottom: 6, marginTop: -2 }}>
                    Operated by {office.operatedBy}
                  </div>
                )}
                {office.lines.map((line) => (
                  <div key={line} style={{ color: "#ECEEF2" }}>{line}</div>
                ))}
                <a href={`tel:${office.tel}`} style={{ color: "#868D99", textDecoration: "none", display: "block", marginTop: 4 }}>
                  {office.phone}
                </a>
                <a href={`mailto:${office.email}`} style={{ color: "#868D99", textDecoration: "none", display: "block" }}>
                  {office.email}
                </a>
              </div>
            ))}
            <Link href="/" style={{ fontSize: 13.5, color: "#169DE3", textDecoration: "none" }}>
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
