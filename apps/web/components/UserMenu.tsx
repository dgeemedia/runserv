// apps/web/components/UserMenu.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserMenu({ orgName }: { orgName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    localStorage.removeItem("rs_token");
    router.push("/login");
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: "50%", background: "#171A21",
          border: "1px solid #282D37", color: "#ECEEF2", cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div
            style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)", width: 200, zIndex: 20,
              background: "#171A21", border: "1px solid #282D37", borderRadius: 10,
              padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {orgName && (
              <div style={{ padding: "8px 10px 6px", fontSize: 11.5, color: "#868D99", borderBottom: "1px solid #282D37", marginBottom: 4 }}>
                Signed in &middot; {orgName}
              </div>
            )}
            <button
              onClick={handleLogout}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", color: "#F87171", fontSize: 13.5,
                fontWeight: 600, cursor: "pointer", padding: "8px 10px", borderRadius: 7, textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}