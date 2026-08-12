// apps/backend/src/controllers/admin.email.controller.ts
import { Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AdminRequest } from "../middleware/admin.middleware.js";
import { sendInviteEmail, sendReceiptEmail, sendTestEmail, sendCustomMessageEmail } from "../services/email.service.js";
import { canonicalAppUrl } from "../lib/env.js";

// ------------------------------------------------------------------
// POST /admin/orgs/:orgId/users/:userId/resend-invite
// For a user stuck on "mustChangePassword" who never got, lost, or let
// expire their original invite email — issues a fresh token rather
// than trying to resurrect the old one.
// ------------------------------------------------------------------
export async function resendInvite(req: AdminRequest, res: Response) {
  const { orgId, userId } = req.params;

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { org: true } });
  if (!user || user.orgId !== orgId) {
    return res.status(404).json({ error: "User not found in this organization" });
  }
  if (!user.mustChangePassword) {
    return res.status(400).json({ error: "This user has already set their password — use password reset instead, not invite resend" });
  }

  // Invalidate any older, still-pending invite tokens for this user
  // before issuing a new one, so only the freshest link works.
  await prisma.inviteToken.updateMany({
    where: { userId: user.id, type: "INVITE", usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.inviteToken.create({
    data: {
      userId: user.id,
      token: rawToken,
      type: "INVITE",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  // canonicalAppUrl(), not raw WEB_APP_URL — WEB_APP_URL may now be a
  // comma-separated CORS allowlist (apex + www), and interpolating it
  // directly here would produce a broken multi-origin link.
  const inviteUrl = `${canonicalAppUrl()}/accept-invite?token=${rawToken}`;
  await sendInviteEmail({ to: user.email, name: user.name ?? undefined, orgName: user.org.name, inviteUrl, role: user.role });

  await prisma.auditLog.create({
    data: { orgId, action: "user.invite_resent", metadata: { userId: user.id, byAdmin: req.admin!.email } },
  });

  return res.json({ message: `Invite resent to ${user.email}` });
}

// ------------------------------------------------------------------
// POST /admin/orgs/:orgId/payments/:paymentId/resend-receipt
// For when a client says "I paid but never got the receipt" — re-sends
// from the stored Payment record rather than re-running the webhook.
// ------------------------------------------------------------------
export async function resendReceipt(req: AdminRequest, res: Response) {
  const { orgId, paymentId } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { org: true, initiatedBy: true, paymentRequests: { include: { service: true } } },
  });

  if (!payment || payment.orgId !== orgId) {
    return res.status(404).json({ error: "Payment not found in this organization" });
  }
  if (payment.status !== "SUCCESS") {
    return res.status(400).json({ error: "Only successful payments have a receipt to resend" });
  }
  if (!payment.initiatedBy) {
    return res.status(400).json({ error: "This payment has no linked user to send the receipt to" });
  }

  await sendReceiptEmail({
    to: payment.initiatedBy.email,
    name: payment.initiatedBy.name ?? undefined,
    orgName: payment.org.name,
    receiptNumber: payment.receiptNumber ?? payment.id,
    items: payment.paymentRequests.map((pr) => ({ name: pr.service.name, amount: Number(pr.amount).toFixed(2) })),
    total: `${Number(payment.amount).toFixed(2)} ${payment.currency}`,
    paidAt: payment.paidAt
      ? payment.paidAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "—",
    cardLast4: payment.cardLast4 ?? undefined,
  });

  await prisma.auditLog.create({
    data: { orgId, action: "payment.receipt_resent", metadata: { paymentId, byAdmin: req.admin!.email } },
  });

  return res.json({ message: `Receipt resent to ${payment.initiatedBy.email}` });
}

// ------------------------------------------------------------------
// POST /admin/orgs/:orgId/message
// Free-text email from you to a client — either one specific user, or
// every active user in the org. This is the one that's actually
// missing: the other endpoints in this file resend fixed templates,
// this is the only place you compose your own content.
// ------------------------------------------------------------------
const sendMessageSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Message body is required").max(10000),
  recipientUserId: z.string().optional(), // omit to send to every active user in the org
});

export async function sendMessageToOrg(req: AdminRequest, res: Response) {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const orgId = req.params.orgId;
  const { subject, body, recipientUserId } = parsed.data;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const recipients = recipientUserId
    ? await prisma.user.findMany({ where: { id: recipientUserId, orgId, isActive: true } })
    : await prisma.user.findMany({ where: { orgId, isActive: true } });

  if (recipients.length === 0) {
    return res.status(400).json({ error: "No active recipients found for this request" });
  }

  const results = await Promise.allSettled(
    recipients.map((user) =>
      sendCustomMessageEmail({ to: user.email, name: user.name ?? undefined, subject, body })
    )
  );

  const failed = results.filter((r) => r.status === "rejected").length;

  await prisma.auditLog.create({
    data: {
      orgId,
      action: "message.sent",
      metadata: { subject, recipientCount: recipients.length, failedCount: failed, byAdmin: req.admin!.email },
    },
  });

  if (failed > 0) {
    return res.status(207).json({
      message: `Sent to ${recipients.length - failed} of ${recipients.length} recipients (${failed} failed — check Brevo config/logs)`,
    });
  }

  return res.json({ message: `Sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}` });
}

// ------------------------------------------------------------------
// POST /admin/test-email
// Sends a bare-bones email to any address — for confirming BREVO_API_KEY
// and sender-domain verification actually work, without needing a real
// invite or payment to trigger one.
// ------------------------------------------------------------------
const testEmailSchema = z.object({ to: z.string().email() });

export async function sendTestEmailAdmin(req: AdminRequest, res: Response) {
  const parsed = testEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide a valid 'to' email address" });

  try {
    await sendTestEmail(parsed.data.to);
    return res.json({ message: `Test email sent to ${parsed.data.to}` });
  } catch (err: any) {
    return res.status(502).json({ error: err.message ?? "Brevo rejected the send — check BREVO_API_KEY and sender verification" });
  }
}