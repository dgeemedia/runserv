// apps/backend/src/services/gateways/paystack.adapter.ts
import crypto from "node:crypto";
import type { GatewayAdapter, InitTransactionParams, InitTransactionResult, VerifiedTransaction } from "./gateway.types.js";

const BASE_URL = "https://api.paystack.co";

function headers() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

// Minimal shapes covering only the fields this adapter actually reads
// off Paystack's responses — enough to satisfy strict mode without
// modeling their full API schema.
interface PaystackInitResponse {
  data: { authorization_url: string; reference: string };
}

interface PaystackVerifyResponse {
  data: {
    status: string;
    amount: number;
    currency: string;
    reference: string;
    metadata: { orgId: string; paymentRequestIds: string[] };
    authorization?: { last4?: string; card_type?: string };
    paid_at: string;
    [key: string]: unknown;
  };
}

export const paystackAdapter: GatewayAdapter = {
  id: "PAYSTACK",

  async initializeTransaction(params: InitTransactionParams): Promise<InitTransactionResult> {
    const res = await fetch(`${BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        email: params.email,
        amount: Math.round(params.amount * 100), // smallest currency unit (cents or kobo)
        currency: params.currency,
        callback_url: params.callbackUrl,
        metadata: { orgId: params.orgId, paymentRequestIds: params.paymentRequestIds },
      }),
    });

    if (!res.ok) throw new Error(`Paystack init failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as PaystackInitResponse;
    return { checkoutUrl: data.data.authorization_url, reference: data.data.reference };
  },

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const res = await fetch(`${BASE_URL}/transaction/verify/${reference}`, { headers: headers() });
    if (!res.ok) throw new Error(`Paystack verify failed: ${res.status} ${await res.text()}`);
    const { data } = (await res.json()) as PaystackVerifyResponse;

    return {
      status: data.status === "success" ? "success" : data.status === "abandoned" ? "pending" : "failed",
      amount: data.amount / 100,
      currency: data.currency,
      reference: data.reference,
      orgId: data.metadata.orgId,
      paymentRequestIds: data.metadata.paymentRequestIds,
      cardLast4: data.authorization?.last4,
      cardBrand: data.authorization?.card_type,
      paidAt: data.paid_at,
      raw: data,
    };
  },

  async verifyWebhookSignature(rawBody: string, headers: Record<string, string | undefined>): Promise<boolean> {
    const signature = headers["x-paystack-signature"];
    if (!signature) return false;
    const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(rawBody).digest("hex");
    return hash === signature;
  },

  extractReferenceFromWebhook(body: any): string | null {
    return body?.data?.reference ?? null;
  },

  isSuccessEvent(body: any): boolean {
    return body?.event === "charge.success";
  },
};