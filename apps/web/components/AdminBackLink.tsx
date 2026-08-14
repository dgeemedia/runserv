// apps/web/components/AdminBackLink.tsx
"use client";
import Link from "next/link";

export default function AdminBackLink() {
  return (
    <Link href="/admin/orgs" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#868D99", fontSize: 13, textDecoration: "none", marginBottom: 16 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Dashboard
    </Link>
  );
}