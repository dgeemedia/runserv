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

// ------------------------------------------------------------------
// POST /orgs/:orgId/checkout
// Client checks boxes on the dashboard -> this creates one transaction
// for the summed total, in whichever currency the client picked (USD
// or NGN). Tries the org's preferredGateway first (Flutterwave by
// default for new orgs); if that gateway's initialization fails for
// any reason, automatically retries on the other gateway before
// giving up — see the fallback logic below.
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

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

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

  if (currency === "NGN") {
    const converted = await convertUsdToNgn(totalUsd);
    chargeAmount = converted.amountNgn;
    fxRateApplied = converted.effectiveRate;
  }

  const gateway = getGateway(org.preferredGateway);
  const fallbackGatewayId: PaymentGateway = org.preferredGateway === "FLUTTERWAVE" ? "PAYSTACK" : "FLUTTERWAVE";
  const fallbackGateway = getGateway(fallbackGatewayId);

  const initParams = {
    email: req.user!.email,
    amount: chargeAmount,
    currency,
    paymentRequestIds: items.map((i) => i.id),
    orgId,
    callbackUrl: `${process.env.WEB_APP_URL}/payment-complete`,
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
      orgId,
      gateway: usedGateway.id,
      gatewayRef: tx.reference,
      amount: chargeAmount,
      currency,
      usdAmount: totalUsd,
      fxRateApplied,
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
export async function getOrgFxRate(_req: AuthedRequest, res: Response) {
  const rate = await getFxRate();
  return res.json({ rate });
}

// ------------------------------------------------------------------
// Shared fulfillment logic — called by both webhook handlers once a
// transaction has been independently verified against the gateway's
// own API (never trust the webhook body alone, even after signature
// check, since a signature only proves origin, not current status).
// ------------------------------------------------------------------
async function fulfillVerifiedPayment(verified: VerifiedTransaction) {
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

  const [org, items, initiator] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: verified.orgId } }),
    prisma.paymentRequest.findMany({ where: { id: { in: verified.paymentRequestIds } }, include: { service: true } }),
    payment.initiatedByUserId ? prisma.user.findUnique({ where: { id: payment.initiatedByUserId } }) : null,
  ]);

  if (initiator) {
    await sendReceiptEmail({
      to: initiator.email,
      name: initiator.name ?? undefined,
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
