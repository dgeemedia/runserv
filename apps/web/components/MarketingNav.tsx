// apps/web/components/MarketingNav.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export default function MarketingNav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <nav
      style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(15,17,21,0.78)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #21252E",
      }}
    >
      <div
        style={{
          maxWidth: 1120, margin: "0 auto", padding: "16px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/logo/logo-mark-transparent.png" alt="RunServ" style={{ height: 26, width: "auto" }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: "#ECEEF2" }}>
            Run<span style={{ color: "#169DE3" }}>Serv</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="rs-desktop-links" style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-link"
              style={{ fontSize: 14, color: "#868D99", textDecoration: "none", fontWeight: 500 }}
            >
              {l.label}
            </a>
          ))}
          <Link href="/login" className="nav-link" style={{ fontSize: 14, color: "#868D99", textDecoration: "none", fontWeight: 500 }}>
            Client login
          </Link>
          <Link href="/admin/login" className="nav-link" style={{ fontSize: 14, color: "#868D99", textDecoration: "none", fontWeight: 500 }}>
            Sign in
          </Link>
          <Link
            href="/agency-signup"
            className="cta-primary"
            style={{
              background: "#169DE3", color: "#FFFFFF", padding: "9px 18px",
              borderRadius: 8, fontWeight: 600, fontSize: 13.5, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            Create your workspace
          </Link>
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="rs-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "none", width: 38, height: 38, borderRadius: 8,
            border: "1px solid #282D37", background: "#171A21",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            position: "relative", flexShrink: 0,
          }}
        >
          <span style={{ position: "relative", width: 16, height: 12, display: "block" }}>
            <span className="rs-burger-bar" style={{ top: open ? 5 : 0, transform: open ? "rotate(45deg)" : "none" }} />
            <span className="rs-burger-bar" style={{ top: 5, opacity: open ? 0 : 1 }} />
            <span className="rs-burger-bar" style={{ top: open ? 5 : 10, transform: open ? "rotate(-45deg)" : "none" }} />
          </span>
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className="rs-drawer"
        style={{
          maxHeight: open ? 520 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.28s ease, opacity 0.2s ease",
          borderBottom: open ? "1px solid #21252E" : "none",
        }}
      >
        <div style={{ padding: "8px 24px 22px", display: "flex", flexDirection: "column", gap: 2 }}>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{
                fontSize: 15, color: "#ECEEF2", textDecoration: "none", fontWeight: 500,
                padding: "12px 4px", borderBottom: "1px solid #1D212A",
              }}
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            style={{
              fontSize: 15, color: "#ECEEF2", textDecoration: "none", fontWeight: 500,
              padding: "12px 4px", borderBottom: "1px solid #1D212A",
            }}
          >
            Client login
          </Link>
          <Link
            href="/admin/login"
            onClick={() => setOpen(false)}
            style={{
              fontSize: 15, color: "#ECEEF2", textDecoration: "none", fontWeight: 500,
              padding: "12px 4px", borderBottom: "1px solid #1D212A",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/agency-signup"
            style={{
              marginTop: 14, background: "#169DE3", color: "#FFFFFF", padding: "12px 18px",
              borderRadius: 8, fontWeight: 600, fontSize: 14.5, textDecoration: "none", textAlign: "center",
            }}
          >
            Create your workspace
          </Link>
        </div>
      </div>

      <style>{`
        .rs-burger-bar {
          position: absolute; left: 0; width: 100%; height: 2px;
          background: #ECEEF2; border-radius: 2px;
          transition: top 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
        }
        @media (max-width: 980px) {
          .rs-desktop-links { display: none !important; }
          .rs-burger { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
