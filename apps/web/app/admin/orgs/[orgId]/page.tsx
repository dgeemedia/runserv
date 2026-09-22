// apps/web/app/admin/orgs/[orgId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrganization, createService, updateService, deleteService, updateOrgActive, updateOrgUserActive, resendInvite, resendReceipt, resyncPayment, sendMessageToOrg, markPaymentsPaid, getCachedTenant } from "../../../../lib/adminApi";
import MarkdownComposer from "../../../../components/MarkdownComposer";
import AdminBackLink from "../../../../components/AdminBackLink";
import type { Organization, Service, OrgUser, Payment, PaymentRequest, EmailMessage, ServiceCategory, BillingCycle } from "@runserver/types";
import LoadingScreen from "../../../../components/LoadingScreen";
interface Params {
  params: { orgId: string };
}

const CATEGORIES: ServiceCategory[] = ["API", "SERVER", "DATABASE", "DOMAIN", "SECURITY", "STORAGE", "SOFTWARE", "DEVELOPMENT", "MAINTENANCE", "CONSULTING", "OTHER"];

// Services — grouping used to keep newly added services from clustering
// together with long-standing paid ones (see groupedServices below).
const SERVICE_SECTIONS: { status: "ACTIVE" | "PAUSED" | "CANCELLED"; label: string }[] = [
  { status: "ACTIVE", label: "Active" },
  { status: "PAUSED", label: "Paused" },
  { status: "CANCELLED", label: "Cancelled" },
];

export default function AdminOrgDetailPage({ params }: Params) {
  const { orgId } = params;

  // Manual settlement (bank transfer, cash, etc.) bypasses every
  // gateway RunServ can split a platform fee through, so it's
  // restricted server-side to the PLATFORM tenant (see
  // markPaymentsPaidManually). Mirrored here so agency admins don't
  // see controls that will just 403 — getCachedTenant() is a UI
  // convenience only; the server re-checks on every request.
  const isPlatformAdmin = getCachedTenant()?.type === "PLATFORM";

  const [org, setOrg] = useState<Organization & {
  services: Service[];
  users: OrgUser[];
  payments: Payment[];
  paymentRequests: (PaymentRequest & { service: Service })[];
  emailMessages: EmailMessage[];
} | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "SERVER" as ServiceCategory,
    description: "",
    monthlyAmount: "",
    billingCycle: "MONTHLY" as BillingCycle,
    nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Which service (by id) is currently being edited, if any — only one
  // edit form open at a time to keep the row list legible.
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "SERVER" as ServiceCategory,
    description: "",
    monthlyAmount: "",
    billingCycle: "MONTHLY" as BillingCycle,
    nextDueDate: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [showMessage, setShowMessage] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: "", body: "", recipientUserId: "" });
  const [messageSending, setMessageSending] = useState(false);
  const [messageResult, setMessageResult] = useState("");

  // Tracks which payment is currently being resynced so its button can
  // show a "Checking…" state and avoid duplicate clicks.
  const [resyncingPaymentId, setResyncingPaymentId] = useState<string | null>(null);

  // Manual settlement (bank transfer, cash, etc.) — admin selects
  // outstanding PaymentRequests and marks them paid directly, bypassing
  // both gateways entirely. Platform-admin only — see isPlatformAdmin above.
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [markPaidNote, setMarkPaidNote] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);

  // Conversation — filters + a page size so a long thread doesn't just
  // roll down forever. "Load more" bumps the visible count rather than
  // paginating server-side, since emailMessages is already capped at 50.
  const [convSearch, setConvSearch] = useState("");
  const [convDirection, setConvDirection] = useState<"ALL" | "OUTBOUND" | "INBOUND">("ALL");
  const [convRange, setConvRange] = useState<"ALL" | "7" | "30" | "90">("ALL");
  const [convVisibleCount, setConvVisibleCount] = useState(6);

  // Outstanding — filter by status so a client with a long backlog of
  // upcoming items doesn't bury the ones actually due.
  const [outstandingFilter, setOutstandingFilter] = useState<"ALL" | "OVERDUE" | "DUE" | "UPCOMING">("ALL");

  // Services — toggle which status group(s) show, so a client with a
  // long service history isn't stuck scrolling past everything at once.
  const [serviceFilter, setServiceFilter] = useState<"ALL" | "ACTIVE" | "PAUSED" | "CANCELLED">("ALL");

  // Recent payments — filter by status, and a page size for the same
  // "don't roll down forever" reason as Conversation above.
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "SUCCESS" | "PENDING" | "FAILED">("ALL");
  const [paymentVisibleCount, setPaymentVisibleCount] = useState(6);
  async function refresh() {
    const data = await getOrganization(orgId);
    setOrg(data.org);
  }

  // ---- Derived, filtered lists (hooks run every render, so these stay
  // above any early return; they degrade gracefully to [] while org is
  // still loading). ----

  const filteredMessages = useMemo(() => {
    const all = org?.emailMessages ?? [];
    const cutoffDays = convRange === "ALL" ? null : Number(convRange);
    const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000 : null;
    const q = convSearch.trim().toLowerCase();
    return all.filter((m) => {
      if (convDirection !== "ALL" && m.direction !== convDirection) return false;
      if (cutoff && new Date(m.createdAt).getTime() < cutoff) return false;
      if (q && !(m.subject.toLowerCase().includes(q) || m.bodyText.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [org?.emailMessages, convSearch, convDirection, convRange]);

  const visibleMessages = filteredMessages.slice(0, convVisibleCount);

  // Always computed across every status, regardless of the active
  // filter, so chip counts (e.g. "Paused · 2") stay accurate even
  // while a different status is selected.
  const groupedServices = useMemo(() => {
    const all = org?.services ?? [];
    return SERVICE_SECTIONS.map((section) => ({
      ...section,
      services: all.filter((s) => s.status === section.status),
    }));
  }, [org?.services]);

  const visibleServiceGroups = useMemo(
    () => (serviceFilter === "ALL" ? groupedServices : groupedServices.filter((g) => g.status === serviceFilter)),
    [groupedServices, serviceFilter]
  );

  const filteredOutstanding = useMemo(() => {
    const all = org?.paymentRequests ?? [];
    if (outstandingFilter === "ALL") return all;
    return all.filter((pr) => pr.status === outstandingFilter);
  }, [org?.paymentRequests, outstandingFilter]);

  const filteredPayments = useMemo(() => {
    const all = org?.payments ?? [];
    if (paymentFilter === "ALL") return all;
    return all.filter((p) => p.status === paymentFilter);
  }, [org?.payments, paymentFilter]);

  const visiblePayments = filteredPayments.slice(0, paymentVisibleCount);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [orgId]);

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createService(orgId, { ...form, monthlyAmount: Number(form.monthlyAmount) });
      setShowAddService(false);
      setForm({ ...form, name: "", description: "", monthlyAmount: "" });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditService(service: Service) {
    setEditingServiceId(service.id);
    setEditError("");
    setEditForm({
      name: service.name,
      category: service.category,
      description: service.description ?? "",
      monthlyAmount: String(service.monthlyAmount),
      billingCycle: service.billingCycle,
      nextDueDate: service.nextDueDate.slice(0, 10),
    });
  }

  function cancelEditService() {
    setEditingServiceId(null);
    setEditError("");
  }

  async function handleSaveEditService(e: React.FormEvent) {
    e.preventDefault();
    if (!editingServiceId) return;
    setEditError("");
    setEditSaving(true);
    try {
      await updateService(orgId, editingServiceId, {
        name: editForm.name,
        category: editForm.category,
        description: editForm.description || undefined,
        monthlyAmount: Number(editForm.monthlyAmount),
        billingCycle: editForm.billingCycle,
        nextDueDate: editForm.nextDueDate,
      });
      setEditingServiceId(null);
      await refresh();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleStatus(service: Service) {
    const next = service.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await updateService(orgId, service.id, { status: next });
    await refresh();
  }

  async function handleDeleteService(service: Service) {
    if (!confirm(`Delete "${service.name}"? If it has paid history it'll be cancelled instead of removed.`)) return;
    const { message } = await deleteService(orgId, service.id);
    alert(message);
    await refresh();
  }

  async function toggleOrgActive() {
    if (!org) return;
    await updateOrgActive(orgId, !org.isActive);
    await refresh();
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    await updateOrgUserActive(orgId, userId, !isActive);
    await refresh();
  }

  async function handleResendInvite(userId: string, email: string) {
    try {
      const { message } = await resendInvite(orgId, userId);
      alert(message);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleResendReceipt(paymentId: string) {
    try {
      const { message } = await resendReceipt(orgId, paymentId);
      alert(message);
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Re-verifies a stuck payment against its gateway and, if the
  // gateway confirms success, fulfills it — marks the Payment SUCCESS,
  // marks the related PaymentRequests PAID, and sends the receipt
  // email. Refreshes the org so the "Recent payments" list and the
  // client's own dashboard state (via PaymentRequest.status) reflect
  // the fix immediately.
  async function handleResyncPayment(paymentId: string) {
    setResyncingPaymentId(paymentId);
    try {
      const { message } = await resyncPayment(orgId, paymentId);
      alert(message);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResyncingPaymentId(null);
    }
  }

  function toggleRequest(id: string) {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Confirms and marks all currently-selected outstanding PaymentRequests
  // as paid via a manual (non-gateway) Payment record.
  async function handleMarkPaid() {
    if (selectedRequestIds.size === 0) return;
    if (!confirm(`Mark ${selectedRequestIds.size} item(s) as paid? This can't be undone from here.`)) return;
    setMarkingPaid(true);
    try {
      const { message } = await markPaymentsPaid(orgId, {
        paymentRequestIds: Array.from(selectedRequestIds),
        note: markPaidNote || undefined,
      });
      alert(message);
      setSelectedRequestIds(new Set());
      setMarkPaidNote("");
      setShowMarkPaid(false);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMarkingPaid(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageForm.body.trim()) {
      setMessageResult("Message body can't be empty");
      return;
    }
    setMessageSending(true);
    setMessageResult("");
    try {
      const { message } = await sendMessageToOrg(orgId, {
        subject: messageForm.subject,
        body: messageForm.body,
        recipientUserId: messageForm.recipientUserId || undefined,
      });
      setMessageResult(message);
      setMessageForm({ subject: "", body: "", recipientUserId: "" });
      await refresh(); // pull the just-sent message into the Conversation thread
    } catch (err: any) {
      setMessageResult(err.message);
    } finally {
      setMessageSending(false);
    }
  }

  // Opens the composer pre-filled to reply to a specific inbound message —
  // subject gets a "Re:" prefix, recipient defaults to the matched user
  // (falls back to "All active users" if the sender couldn't be matched).
  function startReply(m: EmailMessage) {
    setShowMessage(true);
    setMessageResult("");
    setMessageForm({
      subject: m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`,
      body: "",
      recipientUserId: m.userId ?? "",
    });
  }

  if (loading) return <LoadingScreen label="Loading client…" />;
  if (!org) return <div style={{ color: "#F87171", padding: 40, background: "#0F1115", minHeight: "100vh" }}>Organization not found.</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#ECEEF2", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 80px" }}>
        <AdminBackLink />
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#169DE3", textTransform: "uppercase" }}>Admin</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, margin: "4px 0 0" }}>{org.name}</h1>
          <button
            onClick={toggleOrgActive}
            style={{
              ...smallBtnStyle,
              background: org.isActive ? "#282D37" : "#169DE3",
              color: org.isActive ? "#ECEEF2" : "#FFFFFF",
            }}
          >
            {org.isActive ? "Deactivate client" : "Reactivate client"}
          </button>
        </div>
        <div style={{ fontSize: 13, color: "#868D99", marginBottom: 24 }}>
          /{org.slug} &middot; {org.preferredGateway} &middot; {Number(org.yearlyDiscountPct)}% yearly discount
          {!org.isActive && <span style={{ color: "#F87171" }}> &middot; INACTIVE — client cannot log in</span>}
        </div>

        {/* Users */}
        <Section title="Users">
          {org.users.map((u) => (
            <Row key={u.id}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name || u.email}</div>
                <div style={{ fontSize: 12, color: "#868D99" }}>{u.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={badgeStyle}>{u.role}</span>
                {u.mustChangePassword && (
                  <button
                    onClick={() => handleResendInvite(u.id, u.email)}
                    style={{ ...smallBtnStyle, padding: "6px 10px", fontSize: 11.5, background: "#282D37", color: "#ECEEF2" }}
                  >
                    Resend invite
                  </button>
                )}
                <button
                  onClick={() => toggleUserActive(u.id, u.isActive)}
                  style={{
                    ...smallBtnStyle,
                    padding: "6px 10px", fontSize: 11.5,
                    background: u.isActive ? "#282D37" : "#169DE3",
                    color: u.isActive ? "#ECEEF2" : "#FFFFFF",
                  }}
                >
                  {u.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </Row>
          ))}
        </Section>

        {/* Message client */}
        <Section
          title="Message client"
          action={
            <button onClick={() => setShowMessage((s) => !s)} style={smallBtnStyle}>
              {showMessage ? "Cancel" : "+ New message"}
            </button>
          }
        >
          {showMessage && (
            <form onSubmit={handleSendMessage} style={{ padding: 16, background: "#0F1115", borderRadius: 10, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                value={messageForm.recipientUserId}
                onChange={(e) => setMessageForm({ ...messageForm, recipientUserId: e.target.value })}
                style={inputStyle}
              >
                <option value="">All active users in this org</option>
                {org.users.filter((u) => u.isActive).map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
              <input
                placeholder="Subject"
                required
                value={messageForm.subject}
                onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                style={inputStyle}
              />
              <MarkdownComposer
                value={messageForm.body}
                onChange={(body) => setMessageForm({ ...messageForm, body })}
                placeholder="Write your message — supports **bold**, *italic*, [links](https://), and lists"
                rows={7}
              />
              {messageResult && (
                <p style={{ fontSize: 13, margin: 0, color: messageResult.toLowerCase().startsWith("sent") ? "#4ADE80" : "#F87171" }}>
                  {messageResult}
                </p>
              )}
              <button type="submit" disabled={messageSending} style={smallBtnStyle}>
                {messageSending ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
          {!showMessage && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>
              Send a one-off email to this client — a specific person or everyone active in the org.
            </p>
          )}
        </Section>

        {/* Conversation thread — sent messages + inbound replies via Brevo inbound
            parsing. Filterable so a long-running client thread doesn't just roll
            down forever — search, direction, and a date range narrow it, and
            results beyond the page size load on demand. */}
        <Section title="Conversation" bare>
          {(org.emailMessages?.length ?? 0) > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Search subject or message…"
                value={convSearch}
                onChange={(e) => { setConvSearch(e.target.value); setConvVisibleCount(6); }}
                style={{ ...inputStyle, flex: "1 1 200px" }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                {(["ALL", "OUTBOUND", "INBOUND"] as const).map((d) => (
                  <FilterChip key={d} active={convDirection === d} onClick={() => { setConvDirection(d); setConvVisibleCount(6); }}>
                    {d === "ALL" ? "All" : d === "OUTBOUND" ? "Sent" : "Client replies"}
                  </FilterChip>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["7", "30", "90", "ALL"] as const).map((r) => (
                  <FilterChip key={r} active={convRange === r} onClick={() => { setConvRange(r); setConvVisibleCount(6); }}>
                    {r === "ALL" ? "All time" : `Last ${r}d`}
                  </FilterChip>
                ))}
              </div>
            </div>
          )}

          {(org.emailMessages?.length ?? 0) === 0 && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No messages yet.</p>
          )}
          {(org.emailMessages?.length ?? 0) > 0 && filteredMessages.length === 0 && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No messages match these filters.</p>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {visibleMessages.map((m) => (
              <Card key={m.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, textTransform: "uppercase",
                          background: m.direction === "INBOUND" ? "rgba(74,222,128,0.14)" : "rgba(22,157,227,0.14)",
                          color: m.direction === "INBOUND" ? "#4ADE80" : "#4BB8F0",
                        }}
                      >
                        {m.direction === "INBOUND" ? "Client reply" : "Sent"}
                      </span>
                      {m.direction === "INBOUND" && (
                        <span style={{ fontSize: 12, color: "#868D99" }}>
                          {m.user ? (m.user.name || m.user.email) : m.fromAddress}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "#868D99" }}>{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.subject}</div>
                    <div style={{ fontSize: 13, color: "#ECEEF2", whiteSpace: "pre-wrap", marginTop: 2 }}>{m.bodyText}</div>
                  </div>
                  {m.direction === "INBOUND" && (
                    <button
                      onClick={() => startReply(m)}
                      style={{ ...smallBtnStyle, padding: "6px 10px", fontSize: 11.5, background: "#282D37", color: "#ECEEF2", flexShrink: 0, alignSelf: "flex-start" }}
                    >
                      Reply
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {filteredMessages.length > convVisibleCount && (
            <button onClick={() => setConvVisibleCount((c) => c + 6)} style={showMoreBtnStyle}>
              Show more ({filteredMessages.length - convVisibleCount} left)
            </button>
          )}
        </Section>

        {/* Services — grouped into Active / Paused / Cancelled so newly added
            services don't cluster together with long-standing paid ones. */}
        <Section
          title="Services"
          bare
          action={
            <button onClick={() => setShowAddService((s) => !s)} style={smallBtnStyle}>
              {showAddService ? "Cancel" : "+ Add service"}
            </button>
          }
        >
          {showAddService && (
            <form onSubmit={handleAddService} style={{ padding: 16, background: "#171A21", border: "1px solid #282D37", borderRadius: 10, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <input placeholder="Service name (e.g. Brevo)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              <div style={{ display: "flex", gap: 8 }}>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ServiceCategory })} style={{ ...inputStyle, flex: 1 }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as BillingCycle })} style={{ ...inputStyle, flex: 1 }}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" step="0.01" placeholder="Monthly amount (USD)" required value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                <input type="date" required value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              </div>
              {error && <p style={{ color: "#F87171", fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={saving} style={smallBtnStyle}>{saving ? "Saving…" : "Save service"}</button>
            </form>
          )}

          {org.services.length === 0 && !showAddService && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No services yet.</p>
          )}

          {org.services.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {(["ALL", "ACTIVE", "PAUSED", "CANCELLED"] as const).map((f) => {
                const count = f === "ALL" ? org.services.length : groupedServices.find((g) => g.status === f)?.services.length ?? 0;
                return (
                  <FilterChip key={f} active={serviceFilter === f} onClick={() => setServiceFilter(f)}>
                    {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} &middot; {count}
                  </FilterChip>
                );
              })}
            </div>
          )}

          {org.services.length > 0 && visibleServiceGroups.every((g) => g.services.length === 0) && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No services in this group.</p>
          )}

          {visibleServiceGroups.map((group) =>
            group.services.length === 0 ? null : (
              <div key={group.status} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: SERVICE_STATUS_DOT[group.status] }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#868D99" }}>
                    {group.label} &middot; {group.services.length}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {group.services.map((s) => (
                    <div key={s.id}>
                      {editingServiceId === s.id ? (
                        <form onSubmit={handleSaveEditService} style={{ padding: 16, background: "#171A21", border: "1px solid #282D37", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            placeholder="Service name"
                            required
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            style={inputStyle}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ServiceCategory })} style={{ ...inputStyle, flex: 1 }}>
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={editForm.billingCycle} onChange={(e) => setEditForm({ ...editForm, billingCycle: e.target.value as BillingCycle })} style={{ ...inputStyle, flex: 1 }}>
                              <option value="MONTHLY">Monthly</option>
                              <option value="YEARLY">Yearly</option>
                            </select>
                          </div>
                          <input
                            placeholder="Description (optional)"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            style={inputStyle}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Monthly amount (USD)"
                              required
                              value={editForm.monthlyAmount}
                              onChange={(e) => setEditForm({ ...editForm, monthlyAmount: e.target.value })}
                              style={{ ...inputStyle, flex: 1 }}
                            />
                            <input
                              type="date"
                              required
                              value={editForm.nextDueDate}
                              onChange={(e) => setEditForm({ ...editForm, nextDueDate: e.target.value })}
                              style={{ ...inputStyle, flex: 1 }}
                            />
                          </div>
                          {editError && <p style={{ color: "#F87171", fontSize: 13, margin: 0 }}>{editError}</p>}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="submit" disabled={editSaving} style={smallBtnStyle}>{editSaving ? "Saving…" : "Save changes"}</button>
                            <button type="button" onClick={cancelEditService} style={{ ...smallBtnStyle, background: "#282D37", color: "#ECEEF2" }}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <Card>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                              <div style={{ fontSize: 12, color: "#868D99" }}>
                                {s.category} &middot; {s.billingCycle === "YEARLY" ? "Yearly" : "Monthly"} &middot; next due {new Date(s.nextDueDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: "monospace", fontSize: 14 }}>${Number(s.monthlyAmount).toFixed(2)}/mo</span>
                              <button onClick={() => startEditService(s)} style={{ ...smallBtnStyle, padding: "8px 12px", background: "#282D37", color: "#ECEEF2" }}>
                                Edit
                              </button>
                              <button onClick={() => toggleStatus(s)} style={{ ...smallBtnStyle, background: s.status === "ACTIVE" ? "#282D37" : "#169DE3", color: s.status === "ACTIVE" ? "#ECEEF2" : "#FFFFFF" }}>
                                {s.status === "ACTIVE" ? "Pause" : "Activate"}
                              </button>
                              <button onClick={() => handleDeleteService(s)} style={{ ...smallBtnStyle, padding: "8px 12px", background: "#282D37", color: "#F87171" }}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </Section>

        {/* Outstanding — manual settlement for payments received outside the gateways.
            Selection UI is platform-admin only: agency admins would just hit a 403
            (manual settlement can't collect RunServ's platform fee, since the money
            never touches a gateway RunServ can split — see admin.payments.controller.ts). */}
        <Section
          title="Outstanding"
          bare
          action={
            isPlatformAdmin && selectedRequestIds.size > 0 && (
              <button onClick={() => setShowMarkPaid((s) => !s)} style={smallBtnStyle}>
                {showMarkPaid ? "Cancel" : `Mark ${selectedRequestIds.size} as paid`}
              </button>
            )
          }
        >
          {org.paymentRequests.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {(["ALL", "OVERDUE", "DUE", "UPCOMING"] as const).map((f) => (
                <FilterChip key={f} active={outstandingFilter === f} onClick={() => setOutstandingFilter(f)}>
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </FilterChip>
              ))}
            </div>
          )}

          {org.paymentRequests.length === 0 && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>Nothing outstanding.</p>
          )}
          {org.paymentRequests.length > 0 && filteredOutstanding.length === 0 && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>Nothing matches this filter.</p>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {filteredOutstanding.map((pr) => (
              <Card key={pr.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  {isPlatformAdmin ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedRequestIds.has(pr.id)}
                        onChange={() => toggleRequest(pr.id)}
                        style={{ width: 16, height: 16, accentColor: "#169DE3" }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{pr.service.name}</div>
                        <div style={{ fontSize: 12, color: "#868D99" }}>
                          {pr.periodLabel} &middot; <StatusTag status={pr.status} />
                        </div>
                      </div>
                    </label>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{pr.service.name}</div>
                      <div style={{ fontSize: 12, color: "#868D99" }}>
                        {pr.periodLabel} &middot; <StatusTag status={pr.status} />
                      </div>
                    </div>
                  )}
                  <span style={{ fontFamily: "monospace", fontSize: 14 }}>${Number(pr.amount).toFixed(2)}</span>
                </div>
              </Card>
            ))}
          </div>

          {!isPlatformAdmin && org.paymentRequests.length > 0 && (
            <p style={{ color: "#868D99", fontSize: 12.5, padding: "10px 4px 0" }}>
              Manual settlement isn't available on agency accounts yet — send your client the checkout link so payment (and RunServ's platform fee) is collected automatically.
            </p>
          )}

          {isPlatformAdmin && showMarkPaid && (
            <div style={{ padding: 16, background: "#171A21", border: "1px solid #282D37", borderRadius: 10, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                placeholder="Note (optional) — e.g. bank transfer ref #4521"
                value={markPaidNote}
                onChange={(e) => setMarkPaidNote(e.target.value)}
                style={inputStyle}
              />
              <button onClick={handleMarkPaid} disabled={markingPaid} style={smallBtnStyle}>
                {markingPaid ? "Marking…" : `Confirm — mark ${selectedRequestIds.size} as paid`}
              </button>
            </div>
          )}
        </Section>

        {/* Recent payments */}
        <Section title="Recent payments" bare>
          {org.payments.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {(["ALL", "SUCCESS", "PENDING", "FAILED"] as const).map((f) => (
                <FilterChip key={f} active={paymentFilter === f} onClick={() => { setPaymentFilter(f); setPaymentVisibleCount(6); }}>
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </FilterChip>
              ))}
            </div>
          )}

          {org.payments.length === 0 && <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No payments yet.</p>}
          {org.payments.length > 0 && filteredPayments.length === 0 && (
            <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No payments match this filter.</p>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {visiblePayments.map((p) => (
              <Card key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "monospace" }}>
                      {p.amount} {p.currency}
                    </div>
                    <div style={{ fontSize: 12, color: "#868D99" }}>
                      {p.gateway} &middot; {p.status} {p.receiptNumber ? `• ${p.receiptNumber}` : ""} {p.paidAt ? `• ${new Date(p.paidAt).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  {p.status === "SUCCESS" ? (
                    <button
                      onClick={() => handleResendReceipt(p.id)}
                      style={{ ...smallBtnStyle, padding: "6px 10px", fontSize: 11.5, background: "#282D37", color: "#ECEEF2" }}
                    >
                      Resend receipt
                    </button>
                  ) : p.gateway === "MANUAL" ? (
                    <span style={{ fontSize: 11.5, color: "#868D99" }}>Manual</span>
                  ) : (
                    // Covers PENDING (webhook may never have arrived) and
                    // FAILED (worth a second check in case the gateway's
                    // status changed since). Re-verifies directly against
                    // the gateway rather than trusting local state.
                    <button
                      onClick={() => handleResyncPayment(p.id)}
                      disabled={resyncingPaymentId === p.id}
                      style={{
                        ...smallBtnStyle, padding: "6px 10px", fontSize: 11.5,
                        background: "#282D37", color: "#ECEEF2",
                        opacity: resyncingPaymentId === p.id ? 0.6 : 1,
                        cursor: resyncingPaymentId === p.id ? "default" : "pointer",
                      }}
                    >
                      {resyncingPaymentId === p.id ? "Checking…" : "Resync with gateway"}
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {filteredPayments.length > paymentVisibleCount && (
            <button onClick={() => setPaymentVisibleCount((c) => c + 6)} style={showMoreBtnStyle}>
              Show more ({filteredPayments.length - paymentVisibleCount} left)
            </button>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, action, children, bare }: { title: string; action?: React.ReactNode; children: React.ReactNode; bare?: boolean }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {bare ? children : <div style={{ border: "1px solid #282D37", borderRadius: 12, background: "#171A21", padding: 4 }}>{children}</div>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#171A21", border: "1px solid #282D37", borderRadius: 12, padding: 14 }}>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: "6px 12px", borderRadius: 999, border: `1px solid ${active ? "#169DE3" : "#282D37"}`,
        background: active ? "rgba(22,157,227,0.14)" : "#171A21", color: active ? "#4BB8F0" : "#868D99",
        fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const PAYMENT_REQUEST_STATUS_COLOR: Record<string, string> = {
  OVERDUE: "#F87171", DUE: "#4BB8F0", UPCOMING: "#868D99", PAID: "#4ADE80", CANCELLED: "#868D99",
};

function StatusTag({ status }: { status: string }) {
  return <span style={{ color: PAYMENT_REQUEST_STATUS_COLOR[status] ?? "#868D99", fontWeight: 600 }}>{status}</span>;
}

const SERVICE_STATUS_DOT: Record<"ACTIVE" | "PAUSED" | "CANCELLED", string> = {
  ACTIVE: "#4ADE80", PAUSED: "#FACC15", CANCELLED: "#868D99",
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderBottom: "1px solid #282D37" }}>
      {children}
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: "monospace", background: "#0F1115", border: "1px solid #282D37",
  borderRadius: 6, padding: "3px 8px", color: "#868D99",
};

const inputStyle: React.CSSProperties = {
  padding: "9px 10px", background: "#171A21", border: "1px solid #282D37", borderRadius: 8, color: "#ECEEF2", fontSize: 13,
};

const smallBtnStyle: React.CSSProperties = {
  background: "#169DE3", color: "#FFFFFF", border: "none", borderRadius: 8,
  padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer",
};

const showMoreBtnStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 10, padding: "10px 14px",
  background: "#171A21", border: "1px solid #282D37", borderRadius: 10,
  color: "#4BB8F0", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
};