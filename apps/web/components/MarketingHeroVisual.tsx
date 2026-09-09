// apps/web/components/MarketingHeroVisual.tsx
"use client";

import { useState } from "react";

const ITEMS = [
  { name: "Render hosting", price: 25 },
  { name: "Postgres DB", price: 40 },
  { name: "Domain + SSL", price: 30 },
];

const FX_RATE = 1581; // illustrative NGN/$1
const PLATFORM_FEE_PCT = 3;

export default function MarketingHeroVisual() {
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");

  const total = ITEMS.reduce((sum, i) => sum + i.price, 0);
  const fee = Math.round(total * (PLATFORM_FEE_PCT / 100) * 100) / 100;
  const payout = total - fee;

  const fmt = (usd: number) =>
    currency === "USD" ? `$${usd.toFixed(2)}` : `₦${Math.round(usd * FX_RATE).toLocaleString()}`;

  return (
    <div
      style={{
        background: "#171A21", border: "1px solid #282D37",
        borderRadius: "4px 4px 20px 20px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        maxWidth: 400, margin: "0 auto", overflow: "hidden",
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
      <div style={{ padding: "22px 22px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "#868D99" }}>Bright Path Clinic owes</span>
          <div style={{ display: "flex", background: "#0F1115", border: "1px solid #282D37", borderRadius: 7, padding: 2 }}>
            {(["USD", "NGN"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                style={{
                  border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 11.5, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
                  background: currency === c ? "#169DE3" : "transparent",
                  color: currency === c ? "#FFFFFF" : "#868D99",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {ITEMS.map((item) => (
          <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px dashed #282D37" }}>
            <span style={{ fontSize: 14 }}>{item.name}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "#ECEEF2" }}>{fmt(item.price)}</span>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 16, marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: "#868D99" }}>Total</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600 }}>{fmt(total)}</span>
        </div>

        <div style={{ fontSize: 11, color: "#868D99", marginBottom: 8 }}>Splits automatically at checkout</div>
        <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "#0F1115", marginBottom: 10 }}>
          <div style={{ width: `${100 - PLATFORM_FEE_PCT}%`, background: "#4ADE80", transition: "width 0.3s ease" }} />
          <div style={{ width: `${PLATFORM_FEE_PCT}%`, background: "#3A404C", transition: "width 0.3s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span style={{ color: "#ECEEF2" }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#4ADE80", marginRight: 6 }} />
            You keep <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(payout)}</span>
          </span>
          <span style={{ color: "#868D99" }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#3A404C", marginRight: 6 }} />
            RunServ {PLATFORM_FEE_PCT}% <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(fee)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
