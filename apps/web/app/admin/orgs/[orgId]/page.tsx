// apps/web/app/admin/orgs/[orgId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getOrganization, createService, updateService, deleteService, updateOrgActive, updateOrgUserActive, resendInvite, resendReceipt, sendMessageToOrg } from "../../../../lib/adminApi";
import MarkdownComposer from "../../../../components/MarkdownComposer";
import AdminBackLink from "../../../../components/AdminBackLink";
import type { Organization, Service, OrgUser, Payment, EmailMessage, ServiceCategory, BillingCycle } from "@runserver/types";

interface Params {
  params: { orgId: string };
}

const CATEGORIES: ServiceCategory[] = ["API", "SERVER", "DATABASE", "DOMAIN", "SECURITY", "STORAGE", "SOFTWARE", "DEVELOPMENT", "MAINTENANCE", "CONSULTING", "OTHER"];

export default function AdminOrgDetailPage({ params }: Params) {
  const { orgId } = params;
  const [org, setOrg] = useState<(Organization & { services: Service[]; users: OrgUser[]; payments: Payment[]; emailMessages: EmailMessage[] }) | null>(null);
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

  async function refresh() {
    const data = await getOrganization(orgId);
    setOrg(data.org);
  }

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

  if (loading) return <div style={{ color: "#868D99", padding: 40, background: "#0F1115", minHeight: "100vh" }}>Loading…</div>;
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

        {/* Conversation thread — sent messages + inbound replies via Brevo inbound parsing */}
        <Section title="Conversation">
          {org.emailMessages?.length === 0 && <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No messages yet.</p>}
          {org.emailMessages?.map((m) => (
            <Row key={m.id}>
              <div style={{ maxWidth: 520 }}>
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
            </Row>
          ))}
        </Section>

        {/* Services */}
        <Section
          title="Services"
          action={
            <button onClick={() => setShowAddService((s) => !s)} style={smallBtnStyle}>
              {showAddService ? "Cancel" : "+ Add service"}
            </button>
          }
        >
          {showAddService && (
            <form onSubmit={handleAddService} style={{ padding: 16, background: "#0F1115", borderRadius: 10, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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

          {org.services.length === 0 && !showAddService && <p style={{ color: "#868D99", fontSize: 13 }}>No services yet.</p>}

          {org.services.map((s) => (
            <div key={s.id}>
              {editingServiceId === s.id ? (
                <form onSubmit={handleSaveEditService} style={{ padding: 16, background: "#0F1115", borderRadius: 10, margin: "8px 0", display: "flex", flexDirection: "column", gap: 8 }}>
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
                <Row>
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
                </Row>
              )}
            </div>
          ))}
        </Section>

        {/* Recent payments */}
        <Section title="Recent payments">
          {org.payments.length === 0 && <p style={{ color: "#868D99", fontSize: 13, padding: "8px 4px" }}>No payments yet.</p>}
          {org.payments.map((p) => (
            <Row key={p.id}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "monospace" }}>
                  {p.amount} {p.currency}
                </div>
                <div style={{ fontSize: 12, color: "#868D99" }}>
                  {p.gateway} &middot; {p.status} {p.receiptNumber ? `• ${p.receiptNumber}` : ""} {p.paidAt ? `• ${new Date(p.paidAt).toLocaleDateString()}` : ""}
                </div>
              </div>
              {p.status === "SUCCESS" && (
                <button
                  onClick={() => handleResendReceipt(p.id)}
                  style={{ ...smallBtnStyle, padding: "6px 10px", fontSize: 11.5, background: "#282D37", color: "#ECEEF2" }}
                >
                  Resend receipt
                </button>
              )}
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2>
        {action}
      </div>
      <div style={{ border: "1px solid #282D37", borderRadius: 12, background: "#171A21", padding: 4 }}>{children}</div>
    </div>
  );
}

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