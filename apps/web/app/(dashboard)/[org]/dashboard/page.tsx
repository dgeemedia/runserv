// apps/web/app/(dashboard)/[org]/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPaymentRequests, createCheckout, getFxRate, resolveOrg, OrgAccessError } from "../../../../lib/api";
import Logo from "../../../../components/Logo";

interface Params {
  params: { org: string }; // the URL slug — never trusted directly, see resolveOrg
}

type LoadState = "loading" | "ready" | "unauthenticated" | "forbidden" | "not-found";

export default function DashboardPage({ params }: Params) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<Awaited<ReturnType<typeof getPaymentRequests>>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");
  const [fxRate, setFxRate] = useState<{ effectiveRate: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("rs_token");
    if (!token) {
      setState("unauthenticated");
      return;
    }

    // The slug in the URL is resolved server-side against the caller's
    // token — this is the fix for trusting localStorage/URL directly.
    // A stale bookmark, shared device, or hand-edited slug can never
    // pull up another org's invoices; the backend rejects any mismatch.
    resolveOrg(params.org)
      .then(async (resolvedOrg) => {
        setOrg(resolvedOrg);
        const [requests, rate] = await Promise.all([
          getPaymentRequests(resolvedOrg.id),
          getFxRate(resolvedOrg.id),
        ]);
        setItems(requests);
        setSelected(new Set(requests.filter((i) => i.status !== "UPCOMING").map((i) => i.id)));
        setFxRate(rate);
        setState("ready");
      })
      .catch((err) => {
        if (err instanceof OrgAccessError && err.status === 401) setState("unauthenticated");
        else if (err instanceof OrgAccessError && err.status === 403) setState("forbidden");
        else setState("not-found");
      });
  }, [params.org]);

  const totalUsd = useMemo(
    () => items.filter((i) => selected.has(i.id)).reduce((sum, i) => sum + Number(i.amount), 0),
    [items, selected]
  );

  const displayTotal = useMemo(() => {
    if (currency === "USD" || !fxRate) return totalUsd;
    return totalUsd * Number(fxRate.effectiveRate);
  }, [totalUsd, currency, fxRate]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function pay() {
    if (!org || selected.size === 0) return;
    setPaying(true);
    try {
      const { checkoutUrl } = await createCheckout(org.id, Array.from(selected), currency);
      window.location.href = checkoutUrl; // hand off to the gateway's hosted checkout
    } catch (err: any) {
      alert(err.message);
      setPaying(false);
    }
  }

  if (state === "loading") {
    return <StatusScreen>Loading…</StatusScreen>;
  }

  if (state === "unauthenticated") {
    return (
      <StatusScreen>
        <p style={{ marginBottom: 16 }}>You need to sign in to view this.</p>
        <button onClick={() => router.push("/login")} style={btnStyle}>Sign in</button>
      </StatusScreen>
    );
  }

  if (state === "forbidden") {
    return (
      <StatusScreen>
        <p style={{ marginBottom: 4, color: "#F87171" }}>You don't have access to this organization.</p>
        <p style={{ color: "#868D99", fontSize: 13, marginBottom: 16 }}>
          You're signed in, but this account belongs to a different organization.
        </p>
        <button onClick={() => router.push("/login")} style={btnStyle}>Switch account</button>
      </StatusScreen>
    );
  }

  if (state === "not-found") {
    return <StatusScreen>That organization doesn't exist.</StatusScreen>;
  }

  return (
    <div style={{ color: "#ECEEF2", fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#0F1115" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 160px" }}>
        <div style={{ marginBottom: 20 }}>
          <Logo variant="dark" height={22} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>Payment requests</h1>
            <div style={{ fontSize: 12.5, color: "#868D99", marginTop: 2 }}>{org?.name}</div>
          </div>
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>

        {items.map((item) => (
          <label
            key={item.id}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: 16, marginBottom: 8, background: "#171A21", border: "1px solid #282D37", borderRadius: 10, cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
              <span>
                <div style={{ fontWeight: 600 }}>{item.service.name}</div>
                <div style={{ fontSize: 12, color: "#868D99" }}>{item.periodLabel} &middot; {item.status}</div>
              </span>
            </span>
            <span style={{ fontFamily: "monospace", textAlign: "right" }}>
              <div>${Number(item.amount).toFixed(2)}</div>
              {currency === "NGN" && fxRate && (
                <div style={{ fontSize: 11, color: "#868D99" }}>
                  ≈ ₦{(Number(item.amount) * Number(fxRate.effectiveRate)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </span>
          </label>
        ))}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "#171A21", borderTop: "1px solid #282D37", padding: 16 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 20 }}>
              {currency === "USD" ? `$${displayTotal.toFixed(2)}` : `₦${displayTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </div>
            {currency === "NGN" && (
              <div style={{ fontSize: 11, color: "#868D99" }}>≈ ${totalUsd.toFixed(2)} USD</div>
            )}
          </div>
          <button
            onClick={pay}
            disabled={paying || selected.size === 0}
            style={{ background: "#E8A33D", color: "#141414", border: "none", borderRadius: 8, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            {paying ? "Redirecting…" : "Proceed to checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#ECEEF2", fontFamily: "system-ui, sans-serif", background: "#0F1115", textAlign: "center", padding: 20 }}>
      {children}
    </div>
  );
}

function CurrencyToggle({ currency, onChange }: { currency: "USD" | "NGN"; onChange: (c: "USD" | "NGN") => void }) {
  return (
    <div style={{ display: "flex", background: "#171A21", border: "1px solid #282D37", borderRadius: 8, padding: 3 }}>
      {(["USD", "NGN"] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
            background: currency === c ? "#E8A33D" : "transparent",
            color: currency === c ? "#141414" : "#868D99",
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#E8A33D", color: "#141414", border: "none", borderRadius: 8,
  padding: "10px 18px", fontWeight: 600, cursor: "pointer",
};
