// apps/web/app/(dashboard)/[org]/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPaymentRequests, createCheckout, getFxRate, resolveOrg, OrgAccessError } from "../../../../lib/api";
import Logo from "../../../../components/Logo";
import LoadingScreen from "../../../../components/LoadingScreen";

interface Params {
  params: { org: string };
}

type LoadState = "loading" | "ready" | "unauthenticated" | "forbidden" | "not-found";

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  DUE: { bg: "rgba(22,157,227,0.14)", fg: "#4BB8F0", label: "Due" },
  OVERDUE: { bg: "rgba(248,113,113,0.14)", fg: "#F87171", label: "Overdue" },
  UPCOMING: { bg: "rgba(134,141,153,0.14)", fg: "#868D99", label: "Upcoming" },
};

const CATEGORY_ICON: Record<string, string> = {
  API: "◆", SERVER: "▣", DATABASE: "▤", DOMAIN: "◈", SECURITY: "◉",
  STORAGE: "▦", SOFTWARE: "◇", DEVELOPMENT: "◐", MAINTENANCE: "◑",
  CONSULTING: "◒", OTHER: "○",
};

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

  const dueCount = useMemo(() => items.filter((i) => i.status === "DUE" || i.status === "OVERDUE").length, [items]);
  const overdueCount = useMemo(() => items.filter((i) => i.status === "OVERDUE").length, [items]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function pay() {
    if (!org || selected.size === 0) return;
    setPaying(true);
    try {
      const { checkoutUrl } = await createCheckout(org.id, Array.from(selected), currency);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      alert(err.message);
      setPaying(false);
    }
  }

  if (state === "loading") {
    return <LoadingScreen label="Loading your invoices…" />;
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
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 180px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <Logo variant="dark" height={22} />
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12.5, color: "#868D99", marginBottom: 4 }}>{org?.name}</div>
          <h1 style={{ fontSize: 26, margin: 0, fontWeight: 700, letterSpacing: "-0.01em" }}>Payment requests</h1>
        </div>

        {/* Summary strip */}
        {items.length > 0 && (
          <div
            style={{
              display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap",
            }}
          >
            <SummaryPill label="Items" value={items.length} />
            <SummaryPill label="Due now" value={dueCount} accent={dueCount > 0 ? "#169DE3" : undefined} />
            {overdueCount > 0 && <SummaryPill label="Overdue" value={overdueCount} accent="#F87171" />}
          </div>
        )}

        {items.length === 0 ? (
          <div
            style={{
              background: "#171A21", border: "1px solid #282D37", borderRadius: 14,
              padding: "40px 24px", textAlign: "center", color: "#868D99",
            }}
          >
            <div style={{ fontSize: 15, color: "#ECEEF2", fontWeight: 600, marginBottom: 6 }}>No payment requests yet</div>
            <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
              Nothing's due right now — new items will show up here as they're added to your account.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button onClick={toggleAll} style={linkBtnStyle}>
                {selected.size === items.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item) => {
                const isSelected = selected.has(item.id);
                const badge = STATUS_STYLES[item.status] ?? STATUS_STYLES.UPCOMING;
                return (
                  <label
                    key={item.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "16px 18px", background: isSelected ? "#1B2029" : "#171A21",
                      border: `1px solid ${isSelected ? "#3A6E8F" : "#282D37"}`,
                      borderRadius: 12, cursor: "pointer", transition: "border-color 0.15s ease, background 0.15s ease",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(item.id)}
                        style={{ width: 17, height: 17, accentColor: "#169DE3", flexShrink: 0 }}
                      />
                      <span
                        style={{
                          width: 34, height: 34, borderRadius: 9, background: "#0F1115",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, color: "#868D99", flexShrink: 0, border: "1px solid #282D37",
                        }}
                      >
                        {CATEGORY_ICON[item.service.category] ?? "○"}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.service.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                          <span style={{ fontSize: 12, color: "#868D99" }}>{item.periodLabel}</span>
                          <span
                            style={{
                              fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                              background: badge.bg, color: badge.fg, textTransform: "uppercase", letterSpacing: "0.03em",
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </span>
                    </span>
                    <span style={{ fontFamily: "monospace", textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>${Number(item.amount).toFixed(2)}</div>
                      {currency === "NGN" && fxRate && (
                        <div style={{ fontSize: 11, color: "#868D99" }}>
                          ≈ ₦{(Number(item.amount) * Number(fxRate.effectiveRate)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div
          style={{
            position: "sticky", bottom: 0, background: "rgba(23,26,33,0.92)", backdropFilter: "blur(8px)",
            borderTop: "1px solid #282D37", padding: 16,
          }}
        >
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "#868D99", marginBottom: 2 }}>
                {selected.size} of {items.length} selected
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700 }}>
                {currency === "USD" ? `$${displayTotal.toFixed(2)}` : `₦${displayTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </div>
              {currency === "NGN" && (
                <div style={{ fontSize: 11, color: "#868D99" }}>≈ ${totalUsd.toFixed(2)} USD</div>
              )}
            </div>
            <button
              onClick={pay}
              disabled={paying || selected.size === 0}
              style={{
                background: selected.size === 0 ? "#282D37" : "#169DE3",
                color: selected.size === 0 ? "#868D99" : "#FFFFFF",
                border: "none", borderRadius: 10, padding: "13px 24px", fontWeight: 600,
                fontSize: 14.5, cursor: selected.size === 0 ? "default" : "pointer",
                transition: "background 0.15s ease",
              }}
            >
              {paying ? "Redirecting…" : "Proceed to checkout"}
            </button>
          </div>
        </div>
      )}
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

function SummaryPill({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "baseline", gap: 6, padding: "8px 14px",
        background: "#171A21", border: "1px solid #282D37", borderRadius: 10,
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: accent ?? "#ECEEF2" }}>{value}</span>
      <span style={{ fontSize: 12, color: "#868D99" }}>{label}</span>
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
            background: currency === c ? "#169DE3" : "transparent",
            color: currency === c ? "#FFFFFF" : "#868D99",
            transition: "background 0.15s ease",
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#169DE3", color: "#FFFFFF", border: "none", borderRadius: 8,
  padding: "10px 18px", fontWeight: 600, cursor: "pointer",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#169DE3", fontSize: 12.5,
  fontWeight: 600, cursor: "pointer", padding: 0,
};