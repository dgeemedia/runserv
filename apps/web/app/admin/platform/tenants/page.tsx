// apps/web/app/admin/platform/tenants/page.tsx
//
// Platform-only dashboard (backend enforces this via requirePlatformAdmin
// — an agency admin hitting this page will just get 403s from the API).
// This is where RunServ sets the rules each agency tenant operates
// under: fee model, fee rate/flat amount, and active/suspended status.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminBackLink from "../../../../components/AdminBackLink";
import { listPlatformTenants, updatePlatformTenant } from "../../../../lib/adminApi";
import type { TenantWithCounts, TenantFeeModel, TenantStatus } from "@runserver/types";

const FEE_MODEL_OPTIONS: { value: TenantFeeModel; label: string }[] = [
  { value: "TRANSACTION_PCT", label: "Transaction fee (% per checkout)" },
  { value: "FX_SPREAD_SHARE", label: "FX spread share (% of their markup)" },
  { value: "FLAT_SUBSCRIPTION", label: "Flat monthly subscription ($)" },
];

const STATUS_COLORS: Record<TenantStatus, string> = {
  ACTIVE: "#4ADE80",
  PENDING_ONBOARDING: "#FACC15",
  SUSPENDED: "#F87171",
};

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<TenantWithCounts[] | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refresh() {
    try {
      const { tenants } = await listPlatformTenants();
      setTenants(tenants);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F1115", color: "#F87171", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        {error}
      </div>
    );
  }

  if (!tenants) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px" }}>
        <AdminBackLink />
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#169DE3", textTransform: "uppercase" }}>Platform</div>
          <h1 style={{ fontSize: 22, margin: "4px 0 0" }}>Agency tenants</h1>
        </div>
        <p style={{ color: "#868D99", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          Every agency using RunServ to bill their own clients. Set each tenant's fee model, rate, and
          active status here — this is the only place these rules can be changed; tenants only see the
          result on their own Tenant settings page.
        </p>

        {tenants.length === 0 && (
          <div style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 12, padding: 20, color: "#868D99", fontSize: 13.5 }}>
            No agency tenants have signed up yet. New signups land here automatically via <span style={{ fontFamily: "monospace" }}>POST /tenants/signup</span>.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tenants.map((tenant) => (
            <TenantRow
              key={tenant.id}
              tenant={tenant}
              expanded={expandedId === tenant.id}
              onToggle={() => setExpandedId(expandedId === tenant.id ? null : tenant.id)}
              onSaved={refresh}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TenantRow({
  tenant,
  expanded,
  onToggle,
  onSaved,
}: {
  tenant: TenantWithCounts;
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => Promise<void>;
}) {
  const [feeModel, setFeeModel] = useState<TenantFeeModel>(tenant.feeModel);
  const [feePct, setFeePct] = useState(tenant.feePct);
  const [flatFeeUsd, setFlatFeeUsd] = useState(tenant.flatFeeUsd ?? "0");
  const [status, setStatus] = useState<TenantStatus>(tenant.status);
  const [subaccountId, setSubaccountId] = useState(tenant.flutterwaveSubaccountId ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    setSaved(false);
    try {
      await updatePlatformTenant(tenant.id, {
        feeModel,
        feePct: feeModel === "FLAT_SUBSCRIPTION" ? undefined : Number(feePct),
        flatFeeUsd: feeModel === "FLAT_SUBSCRIPTION" ? Number(flatFeeUsd) : undefined,
        status,
        flutterwaveSubaccountId: subaccountId && subaccountId !== tenant.flutterwaveSubaccountId ? subaccountId : undefined,
      });
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[tenant.status] }} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "#ECEEF2" }}>{tenant.name}</div>
            <div style={{ fontSize: 12, color: "#868D99", marginTop: 2 }}>
              {tenant.slug} &middot; {tenant._count.organizations} client{tenant._count.organizations === 1 ? "" : "s"} &middot; {tenant._count.payments} payment{tenant._count.payments === 1 ? "" : "s"}
              {tenant.flutterwaveSubaccountId ? " · Flutterwave connected" : " · Not connected to Flutterwave"}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: "#868D99" }}>{expanded ? "Hide" : "Edit rules"}</span>
      </button>

      {expanded && (
        <form onSubmit={handleSave} style={{ padding: "0 18px 18px", borderTop: "1px solid #282D37" }}>
          {/* Settlement — bank details the agency submitted, and the sub-account
              ID staff attach once they've created it by hand in Flutterwave.
              Subaccounts live under RunServ's own Flutterwave account, so the
              agency can never create this themselves — see tenant.controller.ts. */}
          <div style={{ marginTop: 16, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#868D99", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              Settlement
            </div>
            {tenant.settlementSubmittedAt ? (
              <div style={{ background: "#0F1115", border: "1px solid #282D37", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13 }}>
                <Detail label="Country" value={tenant.settlementCountry} />
                <Detail label="Bank" value={tenant.settlementBankName} />
                <Detail label="Account number" value={tenant.settlementAccountNumber} mono />
                <Detail label="Account name" value={tenant.settlementAccountName} />
                <div style={{ fontSize: 11.5, color: "#868D99", marginTop: 6 }}>
                  Submitted {new Date(tenant.settlementSubmittedAt).toLocaleDateString()} — create the sub-account in
                  Flutterwave using this local account number, then paste the resulting ID below.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "#868D99", marginBottom: 12 }}>
                No settlement details submitted yet — nothing to create a sub-account from.
              </div>
            )}
          </div>

          <label style={labelStyle}>Flutterwave sub-account ID</label>
          <input
            value={subaccountId}
            onChange={(e) => setSubaccountId(e.target.value)}
            placeholder="RS_XXXXXXXXXXXXXXX"
            style={inputStyle}
          />
          {tenant.flutterwaveOnboardedAt && (
            <div style={{ fontSize: 11.5, color: "#868D99", marginTop: -2, marginBottom: 4 }}>
              Connected {new Date(tenant.flutterwaveOnboardedAt).toLocaleDateString()}
            </div>
          )}

          <label style={labelStyle}>Tenant status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TenantStatus)} style={inputStyle}>
            <option value="PENDING_ONBOARDING">Pending onboarding</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <label style={labelStyle}>Fee model</label>
          <select value={feeModel} onChange={(e) => setFeeModel(e.target.value as TenantFeeModel)} style={inputStyle}>
            {FEE_MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {feeModel === "FLAT_SUBSCRIPTION" ? (
            <>
              <label style={labelStyle}>Monthly fee (USD)</label>
              <input type="number" step="0.01" min="0" value={flatFeeUsd} onChange={(e) => setFlatFeeUsd(e.target.value)} style={inputStyle} />
            </>
          ) : (
            <>
              <label style={labelStyle}>
                {feeModel === "FX_SPREAD_SHARE" ? "Share of this tenant's FX markup (%)" : "Fee per transaction (%)"}
              </label>
              <input type="number" step="0.1" min="0" max="100" value={feePct} onChange={(e) => setFeePct(e.target.value)} style={inputStyle} />
            </>
          )}

          {saveError && <p style={{ color: "#F87171", fontSize: 13, marginTop: 8 }}>{saveError}</p>}
          {saved && <p style={{ color: "#4ADE80", fontSize: 13, marginTop: 8 }}>Saved.</p>}

          <button type="submit" disabled={saving} style={{ ...btnStyle, marginTop: 12 }}>
            {saving ? "Saving…" : "Save rules for this tenant"}
          </button>
        </form>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ color: "#868D99" }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#868D99", marginTop: 12, display: "block" };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginTop: 6, marginBottom: 4,
  background: "#0F1115", border: "1px solid #282D37", borderRadius: 8, color: "#ECEEF2", fontSize: 14,
};
const btnStyle: React.CSSProperties = {
  padding: "10px 16px", background: "#169DE3", color: "#FFFFFF",
  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13.5,
};
