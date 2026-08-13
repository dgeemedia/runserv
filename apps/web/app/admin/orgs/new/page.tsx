// apps/web/app/admin/orgs/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "../../../../lib/adminApi";

export default function NewOrgPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    yearlyDiscountPct: 15,
    preferredGateway: "FLUTTERWAVE" as "PAYSTACK" | "FLUTTERWAVE",
    ownerEmail: "",
    ownerName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function slugify(name: string) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { org } = await createOrganization(form);
      router.push(`/admin/orgs/${org.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>New client</h1>
        <p style={{ color: "#868D99", fontSize: 13, marginBottom: 24 }}>
          Creates the organization and sends an invite email to their first owner.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Company name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })}
            style={inputStyle}
          />

          <label style={labelStyle}>URL slug</label>
          <input
            required
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: "#868D99", marginTop: -10, marginBottom: 12 }}>
            runserv.org/{form.slug || "your-client"}/dashboard
          </div>

          <label style={labelStyle}>Yearly billing discount (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.yearlyDiscountPct}
            onChange={(e) => setForm({ ...form, yearlyDiscountPct: Number(e.target.value) })}
            style={inputStyle}
          />

          <label style={labelStyle}>Primary payment gateway</label>
          <select
            value={form.preferredGateway}
            onChange={(e) => setForm({ ...form, preferredGateway: e.target.value as "PAYSTACK" | "FLUTTERWAVE" })}
            style={inputStyle}
          >
            <option value="FLUTTERWAVE">Flutterwave</option>
            <option value="PAYSTACK">Paystack</option>
          </select>
          <div style={{ fontSize: 11.5, color: "#868D99", marginTop: -8, marginBottom: 12 }}>
            Tried first at checkout. If it fails, checkout automatically retries on the other gateway — no separate setup needed.
          </div>

          <div style={{ height: 1, background: "#282D37", margin: "16px 0" }} />

          <label style={labelStyle}>Owner email (their first login)</label>
          <input
            type="email"
            required
            value={form.ownerEmail}
            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            style={inputStyle}
          />

          <label style={labelStyle}>Owner name (optional)</label>
          <input
            value={form.ownerName}
            onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            style={inputStyle}
          />

          {error && <p style={{ color: "#F87171", fontSize: 13 }}>{error}</p>}

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? "Creating…" : "Create client & send invite"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#868D99", marginTop: 8 };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginTop: 6, marginBottom: 4,
  background: "#171A21", border: "1px solid #282D37", borderRadius: 8, color: "#ECEEF2", fontSize: 14,
};
const btnStyle: React.CSSProperties = {
  marginTop: 20, width: "100%", padding: "12px", background: "#169DE3", color: "#FFFFFF",
  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
};
