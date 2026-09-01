// apps/backend/src/jobs/reconcilePendingPayments.job.ts
//
// Webhooks are best-effort — a signature mismatch, a dropped request,
// or Flutterwave/Paystack giving up on retries can all leave a Payment
// stuck at PENDING forever even though the charge actually succeeded
// on the gateway's side (this is what happened with tx_ref
// rs_cmsq64jz_1786738194962_qvqyjs — payment completed on Flutterwave,
// webhook never fulfilled it).
//
// Run this on a schedule (every 15-30 min) alongside the existing
// generatePaymentRequests job. It finds PENDING payments older than a
// grace window, re-verifies each one directly against its gateway's
// own API, and runs it through the same fulfillVerifiedPayment() path
// the webhook handler uses — so receipts, audit logs, and
// PaymentRequest.status all get updated identically either way.

import { prisma } from "../lib/prisma.js";
import { getGateway } from "../services/gateways/gateway.factory.js";
import { fulfillVerifiedPayment } from "../controllers/payments.controller.js";


// Give the webhook a fair chance to arrive on its own before we
// bother re-checking — avoids racing a webhook that's just slow.
const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes

// Don't keep re-verifying forever — a payment abandoned mid-checkout
// (user closed the tab) will legitimately stay PENDING/unpaid on the
// gateway's side. Past this age, stop polling; it's just dead.
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function reconcilePendingPayments() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - GRACE_PERIOD_MS);
  const oldest = new Date(now.getTime() - MAX_AGE_MS);

  const stuck = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: cutoff, gte: oldest },
    },
  });

  let reconciled = 0;
  let stillPending = 0;
  let failed = 0;

    for (const payment of stuck) {
    if (payment.gateway === "MANUAL") continue; // manual payments are fulfilled immediately at creation, never sit PENDING

    try {
      const adapter = getGateway(payment.gateway);
      const verified = await adapter.verifyTransaction(payment.gatewayRef);
      
      if (verified.status === "success") {
        await fulfillVerifiedPayment(verified);
        reconciled++;
        console.log(`[reconcilePendingPayments] fulfilled ${payment.gatewayRef} (${payment.gateway}) via reconciliation`);
      } else if (verified.status === "failed") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        failed++;
      } else {
        stillPending++;
      }
    } catch (err: any) {
      // Gateway lookup itself errored (network blip, bad ref, etc.) —
      // leave it PENDING, next run will retry.
      console.error(`[reconcilePendingPayments] verify failed for ${payment.gatewayRef}:`, err.message);
    }
  }

  console.log(
    `[reconcilePendingPayments] checked ${stuck.length} pending payments: ` +
    `${reconciled} fulfilled, ${failed} marked failed, ${stillPending} still pending at ${now.toISOString()}`
  );
}

// Allow running directly: `pnpm jobs:reconcile-payments`
if (import.meta.url === `file://${process.argv[1]}`) {
  reconcilePendingPayments().then(() => process.exit(0));
}