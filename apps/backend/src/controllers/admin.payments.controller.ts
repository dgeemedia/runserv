// apps/backend/src/controllers/admin.payments.controller.ts
//
// Manual "resync" for a single payment — same verify+fulfill path as
// the reconciliation job, but on-demand, for when support needs to
// fix one stuck payment right now instead of waiting for the next
// scheduled run (e.g. tx_ref rs_cmsq64jz_1786738194962_qvqyjs).

import { Response } from "express";
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

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.orgId !== orgId) {
    return res.status(404).json({ error: "Payment not found in this organization" });
  }

  if (payment.status === "SUCCESS") {
    return res.json({ message: "Payment was already marked as successful — nothing to do.", alreadySynced: true });
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