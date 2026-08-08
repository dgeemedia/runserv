// apps/web/app/admin/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminFxRate, previewAdminFxRate, updateAdminFxRate, sendTestEmail } from "../../../lib/adminApi";

export default function AdminFxSettingsPage() {
  const [rate, setRate] = useState<any>(null);
  const [marketRate, setMarketRate] = useState("");
  const [markupPct, setMarkupPct] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewAdminFxRate>>["preview"] | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState("");

  async function refresh() {
    const data = await getAdminFxRate();
    setRate(data.rate);
    setMarketRate(data.rate.marketRate);
    setMarkupPct(data.rate.markupPct);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handlePreview() {
    setPreviewing(true);
    setError("");
    setPreview(null);
    try {
      const { preview } = await previewAdminFxRate();
      setPreview(preview);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  function usePreviewQuote(value: number) {
    setMarketRate(value.toFixed(4));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    setSaved(false);
    try {
      await updateAdminFxRate({ marketRate: Number(marketRate), markupPct: Number(markupPct) });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const previewMarkupPct = Number(markupPct) || 0;
  const previewEffective = preview ? preview.suggestedMarketRate * (1 + previewMarkupPct / 100) : null;

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    setTestEmailSending(true);
    setTestEmailResult("");
    try {
      const { message } = await sendTestEmail(testEmailTo);
      setTestEmailResult(message);
    } catch (err: any) {
      setTestEmailResult(err.message);
    } finally {
      setTestEmailSending(false);
    }
  }

  if (loading) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#E8A33D", textTransform: "uppercase" }}>Admin</div>
            <h1 style={{ fontSize: 22, margin: "4px 0 0" }}>USD → NGN rate</h1>
          </div>
          <Link href="/admin/revenue" style={{ color: "#868D99", fontSize: 13, textDecoration: "none" }}>Revenue</Link>
        </div>

        <p style={{ color: "#868D99", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          Clients paying in NGN are charged <strong>market rate × (1 + your markup)</strong>. Service pricing
          stays in USD everywhere else — this only affects the number shown at checkout when a client picks NGN.
        </p>

        {/* Currently live rate */}
        <div style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#868D99", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            Currently charging clients
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "#868D99" }}>Effective rate</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>₦{Number(rate.effectiveRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} / $1</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#868D99" }}>
            <span>{rate.source === "synced" ? "Synced" : "Manually set"} &middot; {Number(rate.markupPct)}% markup</span>
            <span>{new Date(rate.updatedAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Preview step — see the raw quote before applying any margin */}
        <div style={{ marginBottom: 20 }}>
          <button type="button" onClick={handlePreview} disabled={previewing} style={smallBtnStyle}>
            {previewing ? "Fetching quotes…" : "Preview live market rate"}
          </button>

          {preview && (
            <div style={{ marginTop: 12, background: "#171A21", border: "1px solid #282D37", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#868D99", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                Raw quotes — no markup applied yet
              </div>
              {preview.quotes.map((q) => (
                <div key={q.source} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0" }}>
                  <span style={{ color: "#868D99" }}>{q.source}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "monospace" }}>₦{q.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <button type="button" onClick={() => usePreviewQuote(q.value)} style={tinyBtnStyle}>Use this</button>
                  </div>
                </div>
              ))}
              <div style={{ height: 1, background: "#282D37", margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "#868D99" }}>Average (suggested)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>₦{preview.suggestedMarketRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <button type="button" onClick={() => usePreviewQuote(preview.suggestedMarketRate)} style={tinyBtnStyle}>Use this</button>
                </div>
              </div>
              {previewEffective !== null && (
                <div style={{ fontSize: 12, color: "#E8A33D", marginTop: 6 }}>
                  With your current {markupPct}% markup, that'd charge clients ₦{previewEffective.toLocaleString(undefined, { maximumFractionDigits: 2 })} / $1
                </div>
              )}
            </div>
          )}
          <p style={{ fontSize: 11.5, color: "#868D99", marginTop: 8, lineHeight: 1.5 }}>
            Two independent providers, so one going stale or off doesn't quietly become what you charge.
            Nothing here is saved until you pick a value and hit "Save rate" below.
          </p>
        </div>

        <div style={{ height: 1, background: "#282D37", margin: "20px 0" }} />

        {/* Apply — explicit, separate step */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Market rate (₦ per $1)</label>
          <input type="number" step="0.01" value={marketRate} onChange={(e) => setMarketRate(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Your markup (%)</label>
          <input type="number" step="0.1" min="0" max="50" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} style={inputStyle} />
          <div style={{ fontSize: 11.5, color: "#868D99", marginTop: -8, marginBottom: 12 }}>
            e.g. 2 means clients pay 2% above the market rate — this is your margin on FX conversion.
          </div>

          {marketRate && markupPct && (
            <div style={{ fontSize: 12.5, color: "#868D99", marginBottom: 12 }}>
              Preview: ₦{(Number(marketRate) * (1 + Number(markupPct) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })} / $1 once saved
            </div>
          )}

          {error && <p style={{ color: "#F87171", fontSize: 13 }}>{error}</p>}
          {saved && <p style={{ color: "#4ADE80", fontSize: 13 }}>Saved.</p>}

          <button type="submit" disabled={saving} style={btnStyle}>
            {saving ? "Saving…" : "Save rate"}
          </button>
        </form>

        <div style={{ height: 1, background: "#282D37", margin: "32px 0 24px" }} />

        {/* Email — confirms Brevo is actually working, independent of the FX form above */}
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Email</h2>
        <p style={{ color: "#868D99", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          Send a bare-bones test email to confirm <span style={{ fontFamily: "monospace", fontSize: 12 }}>BREVO_API_KEY</span> and
          sender-domain verification are working, without needing a real invite or payment to trigger one.
        </p>
        <form onSubmit={handleSendTestEmail} style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            style={{ ...inputStyle, flex: 1, marginTop: 0, marginBottom: 0 }}
          />
          <button type="submit" disabled={testEmailSending} style={{ ...smallBtnStyle, whiteSpace: "nowrap" }}>
            {testEmailSending ? "Sending…" : "Send test"}
          </button>
        </form>
        {testEmailResult && (
          <p style={{ fontSize: 13, marginTop: 10, color: testEmailResult.toLowerCase().includes("sent") ? "#4ADE80" : "#F87171" }}>
            {testEmailResult}
          </p>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#868D99", marginTop: 8 };
const inputStyle: React.CSSProperties = {
  padding: "10px 12px", marginTop: 6, marginBottom: 4,
  background: "#171A21", border: "1px solid #282D37", borderRadius: 8, color: "#ECEEF2", fontSize: 14,
};
const btnStyle: React.CSSProperties = {
  marginTop: 8, padding: "12px", background: "#E8A33D", color: "#141414",
  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
};
const smallBtnStyle: React.CSSProperties = {
  background: "#282D37", color: "#ECEEF2", border: "1px solid #3A404C", borderRadius: 8,
  padding: "9px 14px", fontWeight: 500, fontSize: 13, cursor: "pointer",
};
const tinyBtnStyle: React.CSSProperties = {
  background: "none", border: "1px solid #3A404C", borderRadius: 6,
  padding: "3px 8px", fontSize: 11, color: "#868D99", cursor: "pointer",
};
