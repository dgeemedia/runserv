// apps/web/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("rs_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email: string, password: string, turnstileToken: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, turnstileToken }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Login failed");
  const data = await res.json();
  // Only the token is trusted state. The org itself is re-resolved
  // from the URL slug (via resolveOrg) on every dashboard load rather
  // than cached here — see lib/api.ts's resolveOrg for why.
  localStorage.setItem("rs_token", data.token);
  return data;
}

export async function acceptInvite(token: string, newPassword: string) {
  const res = await fetch(`${API_URL}/auth/accept-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Could not set password");
  return res.json();
}

export async function forgotPassword(email: string, turnstileToken: string) {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, turnstileToken }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Something went wrong");
  return res.json();
}

export async function resetPassword(token: string, newPassword: string, turnstileToken: string) {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword, turnstileToken }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Could not reset password");
  return res.json();
}

export async function getFxRate(orgId: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/fx-rate`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Could not load exchange rate");
  return (await res.json()).rate as { effectiveRate: string; marketRate: string; markupPct: string };
}

// ------------------------------------------------------------------
// Resolves the :org slug in the URL to a real org id, verified
// server-side against the caller's token. This is what the dashboard
// calls on load instead of trusting localStorage — a stale bookmark,
// shared device, or hand-edited URL can never serve the wrong org's
// data, since the backend checks the slug against the JWT's orgId.
// ------------------------------------------------------------------
export class OrgAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function resolveOrg(slug: string) {
  const res = await fetch(`${API_URL}/orgs/resolve/${slug}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new OrgAccessError(body.error || "Could not resolve organization", res.status);
  }
  return (await res.json()).org as { id: string; name: string; slug: string; currency: string; preferredGateway: string };
}

export async function getPaymentRequests(orgId: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/payment-requests`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Could not load payment requests");
  return (await res.json()).items as Array<{
    id: string;
    periodLabel: string;
    amount: string;
    dueDate: string;
    status: "DUE" | "OVERDUE" | "UPCOMING";
    service: { name: string; category: string; description: string | null };
  }>;
}

export async function createCheckout(orgId: string, paymentRequestIds: string[], currency: "USD" | "NGN" = "USD") {
  const res = await fetch(`${API_URL}/orgs/${orgId}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ paymentRequestIds, currency }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Checkout failed");
  return res.json() as Promise<{ checkoutUrl: string; reference: string; total: number; currency: string }>;
}