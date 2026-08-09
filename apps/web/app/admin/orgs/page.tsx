// apps/web/app/admin/orgs/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listOrganizations } from "../../../lib/adminApi";
import Logo from "../../../components/Logo";
import type { Organization } from "@runserver/types";

type OrgRow = Organization & { _count: { services: number; users: number } };

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listOrganizations()
      .then((data) => setOrgs(data.orgs))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ marginBottom: 20 }}>
          <Logo variant="dark" height={24} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#169DE3", textTransform: "uppercase" }}>Admin</div>
            <h1 style={{ fontSize: 24, margin: "4px 0 0" }}>Client organizations</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/admin/revenue" style={{ color: "#868D99", fontSize: 13, textDecoration: "none" }}>Revenue</Link>
            <Link href="/admin/settings" style={{ color: "#868D99", fontSize: 13, textDecoration: "none" }}>FX settings</Link>
            <Link
              href="/admin/orgs/new"
              style={{ background: "#169DE3", color: "#FFFFFF", padding: "10px 16px", borderRadius: 8, fontWeight: 600, textDecoration: "none", fontSize: 14 }}
            >
              + New client
            </Link>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#868D99" }}>Loading…</p>
        ) : orgs.length === 0 ? (
          <p style={{ color: "#868D99" }}>No clients yet. Create your first one.</p>
        ) : (
          <div style={{ border: "1px solid #282D37", borderRadius: 12, overflow: "hidden" }}>
            {orgs.map((org, i) => (
              <Link
                key={org.id}
                href={`/admin/orgs/${org.id}`}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "16px 20px", textDecoration: "none", color: "#ECEEF2",
                  background: "#171A21", borderBottom: i < orgs.length - 1 ? "1px solid #282D37" : "none",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{org.name}</div>
                  <div style={{ fontSize: 12, color: "#868D99" }}>/{org.slug} &middot; {org.preferredGateway}</div>
                </div>
                <div style={{ fontSize: 12, color: "#868D99", textAlign: "right" }}>
                  <div>{org._count.services} services</div>
                  <div>{org._count.users} users</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
