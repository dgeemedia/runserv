// apps/web/components/PaymentPreviewCard.tsx
"use client";

import { useState } from "react";

// Illustrative only — the real dashboard pulls the live rate from the
// backend at checkout. Keeping it here as a constant makes that explicit.
const USD_TO_NGN = 1550;

const LINE_ITEMS = [
  { name: "Render hosting", usd: 25 },
  { name: "Postgres DB", usd: 40 },
  { name: "Domain + SSL", usd: 30 },
];

function formatUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatNgn(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function PaymentPreviewCard() {
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");

  const totalUsd = LINE_ITEMS.reduce((sum, i) => sum + i.usd, 0);

  const fmt = (usd: number) => (currency === "USD" ? formatUsd(usd) : formatNgn(usd * USD_TO_NGN));

  return (
    <div
      style={{
        background: "#171A21", border: "1px solid #282D37",
        borderRadius: "4px 4px 20px 20px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        maxWidth: 400, margin: "0 auto", overflow: "hidden",
        animation: "rs-float 6s ease-in-out infinite",
      }}
    >
      <div
        style={{
          height: 16,
          background:
            "linear-gradient(135deg, #0F1115 25%, transparent 25%), linear-gradient(225deg, #0F1115 25%, transparent 25%)",
          backgroundSize: "16px 16px",
          backgroundColor: "#171A21",
        }}
      />
      <div style={{ padding: "20px 22px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 14, color: "#868D99" }}>Bright Path Clinic owes</span>
          <div style={{ display: "flex", border: "1px solid #282D37", borderRadius: 8, padding: 2, gap: 2 }}>
            <button
              onClick={() => setCurrency("USD")}
              style={{
                border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 6,
                fontSize: 11.5, fontWeight: 700, letterSpacing: "0.02em",
                background: currency === "USD" ? "#169DE3" : "transparent",
                color: currency === "USD" ? "#FFFFFF" : "#868D99",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              USD
            </button>
            <button
              onClick={() => setCurrency("NGN")}
              style={{
                border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 6,
                fontSize: 11.5, fontWeight: 700, letterSpacing: "0.02em",
                background: currency === "NGN" ? "#169DE3" : "transparent",
                color: currency === "NGN" ? "#FFFFFF" : "#868D99",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              NGN
            </button>
          </div>
        </div>

        {LINE_ITEMS.map((item) => (
          <div
            key={item.name}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "9px 0", borderBottom: "1px dashed #282D37",
            }}
          >
            <span style={{ fontSize: 14 }}>{item.name}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "#ECEEF2" }}>
              {fmt(item.usd)}
            </span>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 16, marginTop: 4 }}>
          <span style={{ fontSize: 13, color: "#868D99" }}>Total</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700 }}>
            {fmt(totalUsd)}
          </span>
        </div>

        <div
          style={{
            marginTop: 16, background: "#169DE3", color: "#FFFFFF",
            textAlign: "center", padding: "12px", borderRadius: 8, fontWeight: 600, fontSize: 14,
          }}
        >
          Pay now
        </div>
      </div>
    </div>
  );
}
