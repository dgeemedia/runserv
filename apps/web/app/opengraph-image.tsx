// apps/web/app/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "RunServ — Bill your clients for the infrastructure you run";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0F1115",
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* Faint grid texture, echoing the checkout-card motif used across the product */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(#171A21 1px, transparent 1px), linear-gradient(90deg, #171A21 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            opacity: 0.5,
            display: "flex",
          }}
        />

        {/* Mark + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#169DE3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            R
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#ECEEF2" }}>
            Run<span style={{ color: "#169DE3" }}>Serv</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#ECEEF2",
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            Mark it up. We split it.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#169DE3",
              letterSpacing: "-0.02em",
              marginBottom: 28,
            }}
          >
            Your clients just pay.
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#868D99", maxWidth: 760 }}>
            Infrastructure billing for agencies and devs — priced your way, paid in USD or NGN.
          </div>
        </div>

        {/* Bottom accent bar, echoing the payout-split visual on the homepage */}
        <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", zIndex: 1 }}>
          <div style={{ width: "97%", background: "#4ADE80", display: "flex" }} />
          <div style={{ width: "3%", background: "#3A404C", display: "flex" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
