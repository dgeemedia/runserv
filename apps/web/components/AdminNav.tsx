// apps/web/components/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import { getCachedTenant } from "../lib/adminApi";

const BASE_NAV_ITEMS = [
  { href: "/admin/orgs", label: "Clients" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/settings", label: "FX settings" },
  { href: "/admin/tenant", label: "Tenant" },
];

const PLATFORM_NAV_ITEM = { href: "/admin/platform/tenants", label: "Platform" };

export default function AdminNav() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenant, setTenant] = useState<ReturnType<typeof getCachedTenant>>(null);

  useEffect(() => {
    setTenant(getCachedTenant());
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navItems = tenant?.type === "PLATFORM" ? [...BASE_NAV_ITEMS, PLATFORM_NAV_ITEM] : BASE_NAV_ITEMS;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    localStorage.removeItem("rs_admin_token");
    localStorage.removeItem("rs_admin_tenant");
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
            {tenant && tenant.type === "AGENCY" && (
              <span style={{ marginLeft: 8, fontSize: 12.5, color: "#868D99" }}>{tenant.name}</span>
            )}
          </Link>

          <nav className="rs-admin-desktop-nav" style={{ display: "flex", gap: 4 }}>
            {navItems.map((item) => {
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

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="rs-admin-desktop-nav"
            onClick={() => setConfirmOpen(true)}
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

          {/* Hamburger — mobile only */}
          <button
            className="rs-admin-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: "none", width: 36, height: 36, borderRadius: 8,
              border: "1px solid #282D37", background: "#171A21",
              alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
            }}
          >
            <span style={{ position: "relative", width: 15, height: 11, display: "block" }}>
              <span className="rs-admin-burger-bar" style={{ top: menuOpen ? 4.5 : 0, transform: menuOpen ? "rotate(45deg)" : "none" }} />
              <span className="rs-admin-burger-bar" style={{ top: 4.5, opacity: menuOpen ? 0 : 1 }} />
              <span className="rs-admin-burger-bar" style={{ top: menuOpen ? 4.5 : 9, transform: menuOpen ? "rotate(-45deg)" : "none" }} />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        style={{
          maxHeight: menuOpen ? 400 : 0, opacity: menuOpen ? 1 : 0, overflow: "hidden",
          transition: "max-height 0.25s ease, opacity 0.2s ease",
          borderTop: menuOpen ? "1px solid #282D37" : "none",
        }}
      >
        <div style={{ padding: "10px 20px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 14.5, fontWeight: 600, padding: "11px 8px", borderRadius: 8,
                  textDecoration: "none",
                  color: active ? "#ECEEF2" : "#868D99",
                  background: active ? "#1B2029" : "transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
            style={{
              marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "none",
              border: "1px solid #282D37", borderRadius: 8, padding: "10px 12px",
              color: "#F87171", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </div>
      </div>

      <style>{`
        .rs-admin-burger-bar {
          position: absolute; left: 0; width: 100%; height: 2px;
          background: #ECEEF2; border-radius: 2px;
          transition: top 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
        }
        @media (max-width: 680px) {
          .rs-admin-desktop-nav { display: none !important; }
          .rs-admin-burger { display: flex !important; }
        }
      `}</style>

      {/* Logout confirm — a real overlay so it works from both the desktop
          button and the mobile drawer, instead of a dropdown anchored to
          a button that's hidden on small screens. */}
      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,17,21,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 300, background: "#171A21", border: "1px solid #282D37",
              borderRadius: 12, padding: 18, boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            }}
          >
            <p style={{ fontSize: 13.5, color: "#ECEEF2", margin: "0 0 4px", fontWeight: 600 }}>
              Sign out of the admin panel?
            </p>
            <p style={{ fontSize: 12.5, color: "#868D99", margin: "0 0 14px" }}>
              You'll need to log in again to continue.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, background: "#F87171", color: "#0F1115", border: "none",
                  borderRadius: 7, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                Log out
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  flex: 1, background: "#282D37", color: "#ECEEF2", border: "none",
                  borderRadius: 7, padding: "9px 0", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}