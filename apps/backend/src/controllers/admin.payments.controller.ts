// apps/backend/src/controllers/admin.payments.controller.ts
//
// Manual "resync" for a single payment — same verify+fulfill path as
// the reconciliation job, but on-demand, for when support needs to
// fix one stuck payment right now instead of waiting for the next
// scheduled run (e.g. tx_ref rs_cmsq64jz_1786738194962_qvqyjs).

import { Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { AdminRequest } from "../middleware/admin.middleware.js";
import { getGateway } from "../services/gateways/gateway.factory.js";
import { fulfillVerifiedPayment } from "./payments.controller.js";

// ------------------------------------------------------------------
// POST /admin/orgs/:orgId/payments/:paymentId/resync
// Re-verifies a payment directly against its gateway and, if the
// gateway confirms success, runs it through the normal fulfillment
// path (marks Payment SUCCESS, marks PaymentRequests PAID, sends the
// receipt email, writes the audit log) — exactly as the webhook would
// have, had it arrived.
// ------------------------------------------------------------------
export async function resyncPayment(req: AdminRequest, res: Response) {
  const { orgId, paymentId } = req.params;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { org: true } });
  if (!payment || payment.orgId !== orgId) {
    return res.status(404).json({ error: "Payment not found in this organization" });
  }
  if (!req.admin!.isPlatformAdmin && payment.org.tenantId !== req.admin!.tenantId) {
    return res.status(404).json({ error: "Payment not found in this organization" });
  }

  if (payment.status === "SUCCESS") {
    return res.json({ message: "Payment was already marked as successful — nothing to do.", alreadySynced: true });
  }

  if (payment.gateway === "MANUAL") {
    return res.status(400).json({ error: "This was a manually recorded payment — there's no gateway to resync it against." });
  }

  try {
    const adapter = getGateway(payment.gateway);
    const verified = await adapter.verifyTransaction(payment.gatewayRef);

    if (verified.status !== "success") {
      return res.status(409).json({
        error: `Gateway reports this payment as "${verified.status}", not successful. Nothing was changed.`,
      });
    }

    await fulfillVerifiedPayment(verified);

    await prisma.auditLog.create({
      data: {
        orgId,
        action: "payment.manually_resynced",
        metadata: { paymentId, gatewayRef: payment.gatewayRef, byAdmin: req.admin!.email },
      },
    });

    return res.json({ message: "Payment reconciled and marked as paid.", alreadySynced: false });
  } catch (err: any) {
    return res.status(502).json({ error: `Could not verify with gateway: ${err.message}` });
  }
}

// ------------------------------------------------------------------
// POST /admin/orgs/:orgId/payment-requests/mark-paid
// For payments settled outside the two gateways (bank transfer, cash,
// etc.). Creates a Payment with gateway=MANUAL and runs it through the
// same fulfillVerifiedPayment path a webhook would have — so the
// client's dashboard, the audit log, and Payment history all stay
// consistent with the gateway flow rather than needing a special case.
//
// PLATFORM-ONLY: manual settlement bypasses every gateway RunServ can
// split a platform fee through — the client already sent money
// straight to the tenant's own bank account, so RunServ was never in
// the money flow and has no way to collect its cut. Restricted to the
// PLATFORM tenant (RunServ itself, which owes itself no fee) until a
// real fee-collection mechanism exists for agency tenants (tenant
// wallet, charge-on-file, etc. — see IMPLEMENTATION.md, "Manual
// settlement fee gap").
// ------------------------------------------------------------------
const markPaidSchema = z.object({
  paymentRequestIds: z.array(z.string()).min(1, "Select at least one item"),
  note: z.string().optional(),
});

export async function markPaymentsPaidManually(req: AdminRequest, res: Response) {
  const { orgId } = req.params;
  const parsed = markPaidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });
  if (!req.admin!.isPlatformAdmin && org.tenantId !== req.admin!.tenantId) {
    return res.status(404).json({ error: "Organization not found" });
  }

  if (!req.admin!.isPlatformAdmin) {
    return res.status(403).json({
      error:
        "Manual payment settlement isn't available for agency accounts yet. Please direct your client to pay through the checkout link so the platform fee is collected automatically.",
    });
  }

  const items = await prisma.paymentRequest.findMany({
    where: { id: { in: parsed.data.paymentRequestIds }, orgId, status: { in: ["DUE", "OVERDUE", "UPCOMING"] } },
  });
  if (items.length !== parsed.data.paymentRequestIds.length) {
    return res.status(400).json({ error: "Some items are invalid, already paid, or belong to another organization" });
  }

  const totalUsd = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const reference = `manual_${randomUUID()}`;

  const payment = await prisma.payment.create({
    data: {
      tenantId: org.tenantId,
      orgId,
      gateway: "MANUAL",
      gatewayRef: reference,
      amount: totalUsd,
      currency: "USD",
      usdAmount: totalUsd,
      status: "PENDING",
      initiatedByUserId: null,
    },
  });

  await fulfillVerifiedPayment({
    status: "success",
    amount: totalUsd,
    currency: "USD",
    reference,
    orgId,
    paymentRequestIds: items.map((i) => i.id),
    paidAt: new Date().toISOString(),
    raw: { manual: true, note: parsed.data.note ?? null, markedByAdmin: req.admin!.email },
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      action: "payment.manually_marked_paid",
      metadata: { paymentId: payment.id, reference, note: parsed.data.note ?? null, byAdmin: req.admin!.email },
    },
  });

  return res.json({ message: "Marked as paid.", paymentId: payment.id });
}