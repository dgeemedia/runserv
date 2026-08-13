// apps/web/components/LoadingScreen.tsx
"use client";

import Logo from "./Logo";

export default function LoadingScreen({ label }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#0F1115",
        color: "#868D99",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 64,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid #282D37",
            borderTopColor: "#169DE3",
            animation: "rs-spin 0.85s linear infinite",
          }}
        />
        <Logo variant="dark" height={24} />
      </div>
      {label && <p style={{ fontSize: 13, margin: 0 }}>{label}</p>}
      <style>{`
        @keyframes rs-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}