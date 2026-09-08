// apps/web/app/admin/tenant/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getMyTenant, updateMyTenant, connectFlutterwaveSubaccount } from "../../../lib/adminApi";
import AdminBackLink from "../../../components/AdminBackLink";
import type { Tenant } from "@runserver/types";

const FEE_MODEL_LABELS: Record<Tenant["feeModel"], string> = {
  TRANSACTION_PCT: "Transaction fee",
  FX_SPREAD_SHARE: "FX spread share",
  FLAT_SUBSCRIPTION: "Flat monthly subscription",
};

export default function TenantSettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [subaccountId, setSubaccountId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  async function refresh() {
    const { tenant } = await getMyTenant();
    setTenant(tenant);
    setName(tenant.name);
    setSupportEmail(tenant.supportEmail ?? "");
    setSubaccountId(tenant.flutterwaveSubaccountId ?? "");
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await updateMyTenant({ name, supportEmail: supportEmail || undefined });
      await refresh();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnectError("");
    setConnecting(true);
    try {
      await connectFlutterwaveSubaccount({ flutterwaveSubaccountId: subaccountId });
      await refresh();
    } catch (err: any) {
      setConnectError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  if (loading || !tenant) return null;

  const isPlatform = tenant.type === "PLATFORM";
  const isConnected = !!tenant.flutterwaveSubaccountId;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 80px" }}>
        <AdminBackLink />
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#169DE3", textTransform: "uppercase" }}>Admin</div>
          <h1 style={{ fontSize: 22, margin: "4px 0 0" }}>Tenant settings</h1>
        </div>

        {/* Status banner */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, marginBottom: 24,
            background: tenant.status === "ACTIVE" ? "rgba(74,222,128,0.08)" : "rgba(250,204,21,0.08)",
            border: `1px solid ${tenant.status === "ACTIVE" ? "rgba(74,222,128,0.3)" : "rgba(250,204,21,0.3)"}`,
          }}
        >
          <div
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: tenant.status === "ACTIVE" ? "#4ADE80" : "#FACC15",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {tenant.status === "ACTIVE" && "Active — checkouts are live"}
            {tenant.status === "PENDING_ONBOARDING" && "Pending — connect Flutterwave below to start accepting payments"}
            {tenant.status === "SUSPENDED" && "Suspended by RunServ — contact support"}
          </span>
        </div>

        {/* Profile */}
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Profile</h2>
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 32 }}>
          <label style={labelStyle}>Agency / business name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Support email (shown to your clients)</label>
          <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} style={inputStyle} placeholder="support@yourbrand.com" />

          <div style={{ fontSize: 12, color: "#868D99", marginTop: 4 }}>
            Slug: <span style={{ fontFamily: "monospace" }}>{tenant.slug}</span> (not editable — contact RunServ to change it)
          </div>

          {profileError && <p style={{ color: "#F87171", fontSize: 13, marginTop: 8 }}>{profileError}</p>}
          {profileSaved && <p style={{ color: "#4ADE80", fontSize: 13, marginTop: 8 }}>Saved.</p>}

          <button type="submit" disabled={profileSaving} style={{ ...btnStyle, marginTop: 12 }}>
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
        </form>

        <div style={{ height: 1, background: "#282D37", margin: "0 0 28px" }} />

        {/* Flutterwave connection — not relevant for the platform's own internal tenant */}
        {!isPlatform && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>Payment settlement</h2>
            <p style={{ color: "#868D99", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              Your clients' payments split automatically at checkout: your share settles straight to your own
              Flutterwave sub-account, and RunServ's fee (see billing terms below) is retained separately.
              {" "}Create a sub-account in your Flutterwave dashboard, then paste its ID here.
            </p>

            {isConnected ? (
              <div style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#868D99", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                  Connected Flutterwave sub-account
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 13.5 }}>{tenant.flutterwaveSubaccountId}</div>
                {tenant.flutterwaveOnboardedAt && (
                  <div style={{ fontSize: 12, color: "#868D99", marginTop: 6 }}>
                    Connected {new Date(tenant.flutterwaveOnboardedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ) : null}

            <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
              <label style={labelStyle}>{isConnected ? "Update sub-account ID" : "Flutterwave sub-account ID"}</label>
              <input
                value={subaccountId}
                onChange={(e) => setSubaccountId(e.target.value)}
                placeholder="RS_XXXXXXXXXXXXXXX"
                style={inputStyle}
              />
              {connectError && <p style={{ color: "#F87171", fontSize: 13 }}>{connectError}</p>}
              <button type="submit" disabled={connecting || !subaccountId} style={{ ...btnStyle, marginTop: 8 }}>
                {connecting ? "Connecting…" : isConnected ? "Update connection" : "Connect Flutterwave"}
              </button>
            </form>

            <div style={{ height: 1, background: "#282D37", margin: "28px 0" }} />
          </>
        )}

        {/* Billing terms — read-only; set by RunServ platform staff */}
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>Your billing terms</h2>
        <p style={{ color: "#868D99", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          Set by RunServ. {isPlatform ? "As the platform tenant, no platform fee applies to you." : "Contact RunServ support to discuss changing these."}
        </p>
        {!isPlatform && (
          <div style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: "#868D99" }}>Fee model</span>
              <span style={{ fontWeight: 600 }}>{FEE_MODEL_LABELS[tenant.feeModel]}</span>
            </div>
            {tenant.feeModel === "FLAT_SUBSCRIPTION" ? (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#868D99" }}>Monthly fee</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>${Number(tenant.flatFeeUsd ?? 0).toFixed(2)}</span>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#868D99" }}>
                  {tenant.feeModel === "FX_SPREAD_SHARE" ? "Share of your FX markup" : "Fee per transaction"}
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{Number(tenant.feePct).toFixed(2)}%</span>
              </div>
            )}
          </div>
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
  padding: "12px", background: "#169DE3", color: "#FFFFFF",
  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
};
