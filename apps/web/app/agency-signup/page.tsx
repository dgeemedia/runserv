// apps/web/app/agency-signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signupTenant } from "../../lib/adminApi";
import Logo from "../../components/Logo";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AgencySignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleNameChange(value: string) {
    setTenantName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signupTenant({ tenantName, slug, adminEmail, adminName: adminName || undefined, password });
      router.push("/admin/tenant"); // next step: connect Flutterwave
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ECEEF2", fontFamily: "system-ui, sans-serif", background: "#0F1115", padding: "40px 16px" }}>
      <form onSubmit={handleSubmit} style={{ width: 380, padding: 32, background: "#171A21", border: "1px solid #282D37", borderRadius: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Logo variant="dark" height={28} />
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#169DE3", textTransform: "uppercase", marginBottom: 6 }}>
          Get started
        </div>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Bill your clients through RunServ</h1>
        <p style={{ color: "#868D99", fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
          One dashboard for every client's hosting, API, and infra costs — itemized, marked up, and billed in
          USD or NGN. You'll connect your own Flutterwave sub-account next, so your clients' payments settle
          straight to you.
        </p>

        <label style={labelStyle}>Agency / business name</label>
        <input value={tenantName} onChange={(e) => handleNameChange(e.target.value)} required style={inputStyle} placeholder="Acme Studio" />

        <label style={labelStyle}>Workspace URL</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "#868D99" }}>runserv.org/</span>
          <input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
            required
            style={{ ...inputStyle, marginTop: 0, marginBottom: 0, flex: 1 }}
            placeholder="acme-studio"
          />
        </div>

        <label style={labelStyle}>Your email</label>
        <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required style={inputStyle} />

        <label style={labelStyle}>Your name (optional)</label>
        <input value={adminName} onChange={(e) => setAdminName(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={inputStyle} />

        {error && <p style={{ color: "#F87171", fontSize: 13, marginTop: 4 }}>{error}</p>}

        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "Creating your workspace…" : "Create workspace"}
        </button>

        <p style={{ fontSize: 12.5, color: "#868D99", marginTop: 16, textAlign: "center" }}>
          Already have an account? <Link href="/admin/login" style={{ color: "#169DE3", textDecoration: "none" }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#868D99", display: "block", marginTop: 12 };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginTop: 6, marginBottom: 4,
  background: "#0F1115", border: "1px solid #282D37", borderRadius: 8, color: "#ECEEF2", fontSize: 14,
  boxSizing: "border-box",
};
const btnStyle: React.CSSProperties = {
  width: "100%", padding: "12px", background: "#169DE3", color: "#FFFFFF",
  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginTop: 20,
};
