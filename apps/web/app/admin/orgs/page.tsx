// apps/web/app/admin/orgs/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listOrganizations } from "../../../lib/adminApi";
import AdminNav from "../../../components/AdminNav";
import LoadingScreen from "../../../components/LoadingScreen";
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

  if (loading) return <LoadingScreen label="Loading clients…" />;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <AdminNav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0, fontWeight: 700, letterSpacing: "-0.01em" }}>Client organizations</h1>
            <p style={{ color: "#868D99", fontSize: 13, margin: "4px 0 0" }}>
              {orgs.length} client{orgs.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            href="/admin/orgs/new"
            style={{ background: "#169DE3", color: "#FFFFFF", padding: "10px 16px", borderRadius: 8, fontWeight: 600, textDecoration: "none", fontSize: 14 }}
          >
            + New client
          </Link>
        </div>

        {orgs.length === 0 ? (
          <div style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 14, padding: "40px 24px", textAlign: "center", color: "#868D99" }}>
            <div style={{ fontSize: 15, color: "#ECEEF2", fontWeight: 600, marginBottom: 6 }}>No clients yet</div>
            <p style={{ fontSize: 13.5, margin: 0 }}>Create your first one to get started.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/admin/orgs/${org.id}`}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "16px 20px", textDecoration: "none", color: "#ECEEF2",
                  background: "#171A21", border: "1px solid #282D37", borderRadius: 12,
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3A6E8F"; e.currentTarget.style.background = "#1B2029"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#282D37"; e.currentTarget.style.background = "#171A21"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 38, height: 38, borderRadius: 10, background: "#0F1115",
                      border: "1px solid #282D37", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 15, color: "#169DE3", flexShrink: 0,
                    }}
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                      {org.name}
                      {!org.isActive && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#F87171", background: "rgba(248,113,113,0.14)", padding: "2px 6px", borderRadius: 5, textTransform: "uppercase" }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#868D99", marginTop: 2 }}>/{org.slug} &middot; {org.preferredGateway}</div>
                  </div>
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