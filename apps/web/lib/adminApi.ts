// apps/web/lib/adminApi.ts
import type {
  AdminLoginResponse,
  CreateOrganizationRequest,
  CreateServiceRequest,
  UpdateServiceRequest,
  Organization,
  Service,
  OrgUser,
} from "@runserver/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("rs_admin_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await handle<AdminLoginResponse>(res);
  localStorage.setItem("rs_admin_token", data.token);
  return data;
}

export async function listOrganizations() {
  const res = await fetch(`${API_URL}/admin/orgs`, { headers: authHeaders() });
  return handle<{ orgs: (Organization & { _count: { services: number; users: number } })[] }>(res);
}

export async function getOrganization(orgId: string) {
  const res = await fetch(`${API_URL}/admin/orgs/${orgId}`, { headers: authHeaders() });
  return handle<{ org: Organization & { services: Service[]; users: OrgUser[] } }>(res);
}

export async function updateOrgActive(orgId: string, isActive: boolean) {
  const res = await fetch(`${API_URL}/admin/orgs/${orgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ isActive }),
  });
  return handle<{ org: Organization }>(res);
}

export async function updateOrgUserActive(orgId: string, userId: string, isActive: boolean) {
  const res = await fetch(`${API_URL}/admin/orgs/${orgId}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ isActive }),
  });
  return handle<{ user: { id: string; email: string; isActive: boolean } }>(res);
}

export async function getRevenueSummary() {
  const res = await fetch(`${API_URL}/admin/revenue`, { headers: authHeaders() });
  return handle<{ summary: any }>(res);
}

export async function getAdminFxRate() {
  const res = await fetch(`${API_URL}/admin/fx-rate`, { headers: authHeaders() });
  return handle<{ rate: { pair: string; marketRate: string; markupPct: string; effectiveRate: string; source: string; updatedAt: string } }>(res);
}

export async function previewAdminFxRate() {
  const res = await fetch(`${API_URL}/admin/fx-rate/preview`, { headers: authHeaders() });
  return handle<{
    preview: {
      quotes: { source: string; value: number }[];
      suggestedMarketRate: number;
      currentMarketRate: number;
      currentMarkupPct: number;
    };
  }>(res);
}

export async function updateAdminFxRate(payload: { marketRate?: number; markupPct?: number }) {
  const res = await fetch(`${API_URL}/admin/fx-rate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handle<{ rate: any }>(res);
}

export async function syncAdminFxRate() {
  const res = await fetch(`${API_URL}/admin/fx-rate/sync`, { method: "POST", headers: authHeaders() });
  return handle<{ rate: any }>(res);
}

export async function createOrganization(payload: CreateOrganizationRequest) {
  const res = await fetch(`${API_URL}/admin/orgs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handle<{ org: Organization; owner: { id: string; email: string } }>(res);
}

export async function createService(orgId: string, payload: CreateServiceRequest) {
  const res = await fetch(`${API_URL}/admin/orgs/${orgId}/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handle<{ service: Service }>(res);
}

export async function updateService(orgId: string, serviceId: string, payload: UpdateServiceRequest) {
  const res = await fetch(`${API_URL}/admin/orgs/${orgId}/services/${serviceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handle<{ service: Service }>(res);
}
