// apps/web/app/admin/revenue/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRevenueSummary } from "../../../lib/adminApi";
import AdminBackLink from "../../../components/AdminBackLink";

export default function AdminRevenuePage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRevenueSummary().then((d) => setSummary(d.summary)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p style={{ color: "#868D99" }}>Loading…</p></Shell>;
  if (!summary) return <Shell><p style={{ color: "#F87171" }}>Could not load revenue.</p></Shell>;

  return (
    <Shell>
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Total revenue (all time)" value={`$${Number(summary.totalUsdAllTime).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        <StatCard label="This month" value={`$${Number(summary.totalUsdThisMonth).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        <StatCard label="Payments this month" value={summary.paymentsThisMonth} />
      </div>

      <Section title="By client">
        {summary.byOrg.map((o: any) => (
          <Row key={o.orgId}>
            <span>{o.orgName}</span>
            <span style={{ display: "flex", gap: 16, fontFamily: "monospace", fontSize: 13 }}>
              <span style={{ color: "#868D99" }}>{o.paymentsCount} payments</span>
              <span>${Number(o.totalUsd).toFixed(2)}</span>
            </span>
          </Row>
        ))}
      </Section>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Section title="By gateway">
            {summary.byGateway.map((g: any) => (
              <Row key={g.gateway}>
                <span>{g.gateway}</span>
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>${Number(g.totalUsd).toFixed(2)}</span>
              </Row>
            ))}
          </Section>
        </div>
        <div style={{ flex: 1 }}>
          <Section title="By currency">
            {summary.byCurrency.map((c: any) => (
              <Row key={c.currency}>
                <span>{c.currency}</span>
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>${Number(c.totalUsd).toFixed(2)}</span>
              </Row>
            ))}
          </Section>
        </div>
      </div>

      <Section title="Recent payments">
        {summary.recentPayments.map((p: any) => (
          <Row key={p.id}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.orgName}</div>
              <div style={{ fontSize: 11, color: "#868D99" }}>{p.receiptNumber} &middot; {p.gateway} &middot; {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</div>
            </div>
            <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
              <div>{p.amount} {p.currency}</div>
              {p.currency !== "USD" && <div style={{ fontSize: 11, color: "#868D99" }}>${Number(p.usdAmount).toFixed(2)} USD</div>}
            </div>
          </Row>
        ))}
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px 80px" }}>
        <AdminBackLink />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#169DE3", textTransform: "uppercase" }}>Admin</div>
            <h1 style={{ fontSize: 24, margin: "4px 0 0" }}>Revenue</h1>
          </div>
          <nav style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <Link href="/admin/orgs" style={{ color: "#868D99", textDecoration: "none" }}>Clients</Link>
            <Link href="/admin/settings" style={{ color: "#868D99", textDecoration: "none" }}>FX settings</Link>
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ flex: "1 1 160px", background: "#171A21", border: "1px solid #282D37", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11.5, color: "#868D99", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>{title}</h2>
      <div style={{ border: "1px solid #282D37", borderRadius: 12, background: "#171A21" }}>{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282D37", fontSize: 13.5 }}>{children}</div>;
}
