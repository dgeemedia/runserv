// apps/web/components/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";

const NAV_ITEMS = [
  { href: "/admin/orgs", label: "Clients" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/settings", label: "FX settings" },
];

export default function AdminNav() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    localStorage.removeItem("rs_admin_token");
    router.push("/admin/login");
  }

  return (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(15,17,21,0.85)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #282D37",
      }}
    >
      <div
        style={{
          maxWidth: 900, margin: "0 auto", padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Link href="/admin/orgs" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <Logo variant="dark" height={20} />
            <span
              style={{
                marginLeft: 9, fontSize: 10.5, fontWeight: 700, color: "#169DE3",
                letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px",
                background: "rgba(22,157,227,0.12)", borderRadius: 5,
              }}
            >
              Admin
            </span>
          </Link>

          <nav style={{ display: "flex", gap: 4 }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    fontSize: 13.5, fontWeight: 600, padding: "7px 12px", borderRadius: 7,
                    textDecoration: "none",
                    color: active ? "#ECEEF2" : "#868D99",
                    background: active ? "#1B2029" : "transparent",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setConfirmOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: "1px solid #282D37", borderRadius: 8, padding: "7px 12px",
              color: "#868D99", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>

          {confirmOpen && (
            <div
              style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220,
                background: "#171A21", border: "1px solid #282D37", borderRadius: 10,
                padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <p style={{ fontSize: 12.5, color: "#868D99", margin: "0 0 10px" }}>
                Sign out of the admin panel?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleLogout}
                  style={{
                    flex: 1, background: "#F87171", color: "#0F1115", border: "none",
                    borderRadius: 7, padding: "7px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                  }}
                >
                  Log out
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  style={{
                    flex: 1, background: "#282D37", color: "#ECEEF2", border: "none",
                    borderRadius: 7, padding: "7px 0", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}