// apps/backend/src/controllers/payments.controller.ts
import { Response, Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthedRequest } from "../middleware/auth.middleware.js";
import { getGateway } from "../services/gateways/gateway.factory.js";
import type { GatewayAdapter, VerifiedTransaction } from "../services/gateways/gateway.types.js";
import type { PaymentGateway } from "@runserver/types";
import { sendReceiptEmail } from "../services/email.service.js";
import { convertUsdToNgn, getFxRate } from "../services/fx.service.js";
import { computePlatformFeeUsd } from "../lib/platformFee.js";
import { canonicalAppUrl } from "../lib/env.js";

// ------------------------------------------------------------------
// POST /orgs/:orgId/checkout
// Client checks boxes on the dashboard -> this creates one transaction
// for the summed total, in whichever currency the client picked (USD
// or NGN). Tries the org's preferredGateway first (Flutterwave by
// default for new orgs); if that gateway's initialization fails for
// any reason, automatically retries on the other gateway before
// giving up — see the fallback logic below.
//
// Multi-tenant: if the org's tenant is an AGENCY with a connected
// Flutterwave sub-account, the transaction is split at the gateway —
// the tenant's cut settles to their sub-account, RunServ's platform
// fee is retained. PLATFORM-tenant orgs (RunServ's own clients) and
// AGENCY tenants that haven't connected payment yet checkout without
// a split, same as before this upgrade.
// ------------------------------------------------------------------
const checkoutSchema = z.object({
  paymentRequestIds: z.array(z.string()).min(1, "Select at least one item to pay"),
  currency: z.enum(["USD", "NGN"]).default("USD"),
});

export async function createCheckout(req: AuthedRequest, res: Response) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const orgId = req.user!.orgId;
  const { paymentRequestIds, currency } = parsed.data;

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, include: { tenant: true } });

  // Defensive only — the admin "new org" form's zod schema restricts
  // preferredGateway to PAYSTACK/FLUTTERWAVE, so this should be
  // unreachable. Guards against the type-level possibility now that
  // PaymentGateway includes MANUAL for Payment records.
  if (org.preferredGateway === "MANUAL") {
    return res.status(500).json({ error: "This organization is not configured with a valid payment gateway." });
  }

  const items = await prisma.paymentRequest.findMany({
    where: { id: { in: paymentRequestIds }, orgId, status: { in: ["DUE", "UPCOMING", "OVERDUE"] } },
  });

  if (items.length !== paymentRequestIds.length) {
    return res.status(400).json({ error: "Some selected items are invalid, already paid, or belong to another organization" });
  }

  // All service pricing is canonically in USD — convert only at the
  // point of charging, never store a discounted/converted price back
  // onto the PaymentRequest itself.
  const totalUsd = items.reduce((sum, i) => sum + Number(i.amount), 0);

  let chargeAmount = totalUsd;
  let fxRateApplied: number | null = null;
  let fxMarkupUsd: number | null = null;

  if (currency === "NGN") {
    const [converted, rate] = await Promise.all([
      convertUsdToNgn(org.tenantId, totalUsd),
      getFxRate(org.tenantId),
    ]);
    chargeAmount = converted.amountNgn;
    fxRateApplied = converted.effectiveRate;
    fxMarkupUsd = totalUsd * (Number(rate.markupPct) / 100);
  }

  // Platform fee — computed in USD terms regardless of charge currency
  // for consistent reporting, then expressed as a % of the WHOLE
  // transaction (platformSplitPct) for the gateway split below.
  const platformFeeUsd = computePlatformFeeUsd(org.tenant, { totalUsd, fxMarkupUsd });
  const platformFeeInChargeCurrency =
    currency === "NGN" && fxRateApplied ? platformFeeUsd * fxRateApplied : platformFeeUsd;

  // IMPORTANT: split is built whenever the tenant is an AGENCY with a
  // connected sub-account — NOT gated on platformFeeInChargeCurrency > 0.
  // A tenant on FLAT_SUBSCRIPTION legitimately has a $0 per-transaction
  // fee, but their clients' money must still route to THEIR sub-account,
  // not RunServ's main account. Passing platformSplitPct: 0 tells the
  // gateway "send 100% to the tenant" — omitting `split` entirely here
  // was the bug this comment exists to prevent from being reintroduced.
  const split =
    org.tenant.type === "AGENCY" && org.tenant.flutterwaveSubaccountId
      ? {
          tenantSubaccountId: org.tenant.flutterwaveSubaccountId,
          platformSplitPct: chargeAmount > 0 ? platformFeeInChargeCurrency / chargeAmount : 0,
        }
      : undefined;

  const gateway = getGateway(org.preferredGateway);
  const fallbackGatewayId: PaymentGateway = org.preferredGateway === "FLUTTERWAVE" ? "PAYSTACK" : "FLUTTERWAVE";
  const fallbackGateway = getGateway(fallbackGatewayId);

  const initParams = {
    email: req.user!.email,
    amount: chargeAmount,
    currency,
    paymentRequestIds: items.map((i) => i.id),
    orgId,
    callbackUrl: `${canonicalAppUrl()}/payment-complete`,
    // Split settlement is currently only wired up for Flutterwave (see
    // flutterwave.adapter.ts) — Paystack's adapter ignores `split` for
    // now. If org.preferredGateway is PAYSTACK, an AGENCY tenant's
    // transactions will NOT split until paystack.adapter.ts implements
    // Paystack's subaccount API too. Flagged in IMPLEMENTATION.md.
    split,
  };

  // Try the org's preferred gateway first; if it fails for any reason
  // (bad credentials, the gateway's API being down, a rejected currency,
  // etc.) automatically retry on the other one before giving up. This is
  // what makes "Flutterwave primary, Paystack fallback" (or the reverse,
  // for an org explicitly set to Paystack) actually resilient rather than
  // just a static preference that fails the whole checkout on a hiccup.
  let tx: Awaited<ReturnType<GatewayAdapter["initializeTransaction"]>>;
  let usedGateway: GatewayAdapter;
  let fellBack = false;

  try {
    tx = await gateway.initializeTransaction(initParams);
    usedGateway = gateway;
  } catch (primaryErr: any) {
    console.error(`[checkout] ${gateway.id} init failed for org ${orgId}, falling back to ${fallbackGateway.id}:`, primaryErr.message);
    try {
      tx = await fallbackGateway.initializeTransaction(initParams);
      usedGateway = fallbackGateway;
      fellBack = true;
    } catch (fallbackErr: any) {
      console.error(`[checkout] ${fallbackGateway.id} fallback also failed for org ${orgId}:`, fallbackErr.message);
      return res.status(502).json({ error: "Both payment gateways are currently unavailable. Please try again shortly." });
    }
  }

  await prisma.payment.create({
    data: {
      tenantId: org.tenantId,
      orgId,
      gateway: usedGateway.id,
      gatewayRef: tx.reference,
      amount: chargeAmount,
      currency,
      usdAmount: totalUsd,
      fxRateApplied,
      platformFeeUsd,
      status: "PENDING",
      initiatedByUserId: req.user!.id,
    },
  });

  if (fellBack) {
    await prisma.auditLog.create({
      data: {
        orgId,
        userId: req.user!.id,
        action: "payment.gateway_fallback_used",
        metadata: { attemptedGateway: gateway.id, usedGateway: usedGateway.id, reference: tx.reference },
      },
    });
  }

  return res.json({ checkoutUrl: tx.checkoutUrl, reference: tx.reference, total: chargeAmount, currency, gateway: usedGateway.id });
}

// ------------------------------------------------------------------
// GET /orgs/:orgId/fx-rate
// Lets the dashboard show a live NGN preview before checkout.
// ------------------------------------------------------------------
export async function getOrgFxRate(req: AuthedRequest, res: Response) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: req.user!.orgId } });
  const rate = await getFxRate(org.tenantId);
  return res.json({ rate });
}

// ------------------------------------------------------------------
// Shared fulfillment logic — called by both webhook handlers once a
// transaction has been independently verified against the gateway's
// own API (never trust the webhook body alone, even after signature
// check, since a signature only proves origin, not current status).
//
// Exported (not just internal to this file) so the same idempotent
// path can also be triggered by:
//   - jobs/reconcilePendingPayments.job.ts, a periodic sweep that
//     re-verifies any Payment stuck at PENDING in case its webhook
//     never arrived or was rejected
//   - controllers/admin.payments.controller.ts's resyncPayment, an
//     on-demand "fix this one payment now" admin action
// Both call sites re-verify against the gateway first and only ever
// pass in a VerifiedTransaction — this function itself doesn't care
// where the verification came from.
// ------------------------------------------------------------------
export async function fulfillVerifiedPayment(verified: VerifiedTransaction) {
  if (verified.status !== "success") return;

  const payment = await prisma.payment.findUnique({ where: { gatewayRef: verified.reference } });
  if (!payment || payment.status === "SUCCESS") return; // idempotent — already processed, or unknown ref

  const receiptNumber = `RS-${Date.now().toString(36).toUpperCase()}`;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        paidAt: new Date(verified.paidAt),
        cardLast4: verified.cardLast4,
        cardBrand: verified.cardBrand,
        receiptNumber,
        rawWebhookPayload: verified.raw as any,
      },
    }),
    prisma.paymentRequest.updateMany({
      where: { id: { in: verified.paymentRequestIds }, orgId: verified.orgId },
      data: { status: "PAID", paymentId: payment.id },
    }),
  ]);

  // Record what RunServ earned from this transaction, using the fee
  // snapshotted at checkout time (see payments.controller.ts createCheckout
  // and lib/platformFee.ts) — never recomputed here, so a tenant's fee
  // model changing after checkout but before settlement can't silently
  // alter a transaction that already quoted the client a total.
  const feeUsd = payment.platformFeeUsd ? Number(payment.platformFeeUsd) : 0;
  await prisma.platformFeeLedger.upsert({
    where: { paymentId: payment.id },
    create: {
      tenantId: payment.tenantId,
      paymentId: payment.id,
      feeModel: (await prisma.tenant.findUniqueOrThrow({ where: { id: payment.tenantId } })).feeModel,
      feeUsdAmount: feeUsd,
      tenantUsdAmount: Number(payment.usdAmount) - feeUsd,
    },
    update: {}, // idempotent — fulfillVerifiedPayment can be called more than once for the same reference
  });

    const [org, items, initiator] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: verified.orgId } }),
    prisma.paymentRequest.findMany({ where: { id: { in: verified.paymentRequestIds } }, include: { service: true } }),
    payment.initiatedByUserId ? prisma.user.findUnique({ where: { id: payment.initiatedByUserId } }) : null,
  ]);

  // Manual payments (bank transfer, cash, etc.) have no initiating user —
  // fall back to the org's OWNER(s) so a receipt still goes out.
  const receiptRecipients = initiator
    ? [initiator]
    : await prisma.user.findMany({ where: { orgId: verified.orgId, role: "OWNER", isActive: true } });

  for (const recipient of receiptRecipients) {
    await sendReceiptEmail({
      to: recipient.email,
      name: recipient.name ?? undefined,
      orgName: org.name,
      receiptNumber,
      items: items.map((i) => ({ name: i.service.name, amount: Number(i.amount).toFixed(2) })), // line items shown in USD (canonical)
      total: `${Number(payment.amount).toFixed(2)} ${payment.currency}`,
      paidAt: new Date(verified.paidAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      cardLast4: verified.cardLast4,
    });
  }

  await prisma.auditLog.create({
    data: {
      orgId: verified.orgId,
      userId: payment.initiatedByUserId,
      action: "payment.succeeded",
      metadata: {
        reference: verified.reference,
        gateway: payment.gateway,
        amount: payment.amount.toString(),
        currency: payment.currency,
        usdAmount: payment.usdAmount.toString(),
      },
    },
  });
}

async function handleGatewayWebhook(adapter: GatewayAdapter, req: Request, res: Response) {
  const rawBody = (req as any).rawBody as string;
  const headerMap = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  ) as Record<string, string | undefined>;

  const validSignature = await adapter.verifyWebhookSignature(rawBody, headerMap);
  if (!validSignature) return res.status(401).json({ error: "Invalid signature" });

  if (!adapter.isSuccessEvent(req.body)) {
    return res.status(200).json({ received: true }); // ack, nothing actionable
  }

  const reference = adapter.extractReferenceFromWebhook(req.body);
  if (!reference) return res.status(200).json({ received: true });

  // Never trust the webhook body's amounts/status directly — always
  // re-fetch the transaction from the gateway's own verify endpoint.
  const verified = await adapter.verifyTransaction(reference);
  await fulfillVerifiedPayment(verified);

  return res.status(200).json({ received: true });
}

export async function handlePaystackWebhook(req: Request, res: Response) {
  return handleGatewayWebhook(getGateway("PAYSTACK"), req, res);
}

export async function handleFlutterwaveWebhook(req: Request, res: Response) {
  return handleGatewayWebhook(getGateway("FLUTTERWAVE"), req, res);
}

// ------------------------------------------------------------------
// GET /orgs/:orgId/payment-requests
// Powers the checkbox dashboard: due, overdue, and upcoming items.
// Amounts here are always canonical USD — currency choice happens
// at checkout, not on the line items.
// ------------------------------------------------------------------
export async function listPaymentRequests(req: AuthedRequest, res: Response) {
  const items = await prisma.paymentRequest.findMany({
    where: { orgId: req.user!.orgId, status: { in: ["DUE", "OVERDUE", "UPCOMING"] } },
    include: { service: true },
    orderBy: { dueDate: "asc" },
  });

  return res.json({ items });
}

// ------------------------------------------------------------------
// GET /orgs/:orgId/payment-history
// Everything the client has already paid — powers the client-facing
// "Payment history" section so a PaymentRequest doesn't just vanish
// from the dashboard the moment it flips to PAID (whether via a
// gateway or a manual admin settlement).
// ------------------------------------------------------------------
export async function listPaymentHistory(req: AuthedRequest, res: Response) {
  const items = await prisma.paymentRequest.findMany({
    where: { orgId: req.user!.orgId, status: "PAID" },
    include: { service: true, payment: true },
    orderBy: { dueDate: "desc" },
  });

  return res.json({ items });
}