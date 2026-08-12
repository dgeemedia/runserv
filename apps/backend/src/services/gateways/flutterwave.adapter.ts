// apps/backend/src/services/gateways/flutterwave.adapter.ts
import type { GatewayAdapter, InitTransactionParams, InitTransactionResult, VerifiedTransaction } from "./gateway.types.js";

const BASE_URL = "https://api.flutterwave.com/v3";

function headers() {
  return {
    Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

// Minimal shapes covering only the fields this adapter actually reads
// off Flutterwave's responses — enough to satisfy strict mode without
// modeling their full API schema.
interface FlutterwaveInitResponse {
  data: { link: string };
}

interface FlutterwaveVerifyResponse {
  data: {
    status: string;
    amount: number;
    currency: string;
    tx_ref: string;
    meta?: { orgId?: string; paymentRequestIds?: string };
    card?: { last_4digits?: string; type?: string };
    created_at: string;
    [key: string]: unknown;
  };
}

export const flutterwaveAdapter: GatewayAdapter = {
  id: "FLUTTERWAVE",

  async initializeTransaction(params: InitTransactionParams): Promise<InitTransactionResult> {
    // tx_ref is ours to generate and is what we look the payment up by later —
    // Paystack calls the equivalent "reference", Flutterwave calls it "tx_ref".
    const txRef = `rs_${params.orgId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const res = await fetch(`${BASE_URL}/payments`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        tx_ref: txRef,
        amount: params.amount.toFixed(2),
        currency: params.currency,
        redirect_url: params.callbackUrl,
        customer: { email: params.email },
        meta: { orgId: params.orgId, paymentRequestIds: params.paymentRequestIds.join(",") },
      }),
    });

    if (!res.ok) throw new Error(`Flutterwave init failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as FlutterwaveInitResponse;
    return { checkoutUrl: data.data.link, reference: txRef };
  },

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const res = await fetch(`${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`Flutterwave verify failed: ${res.status} ${await res.text()}`);
    const { data } = (await res.json()) as FlutterwaveVerifyResponse;

    const paymentRequestIds: string[] = (data.meta?.paymentRequestIds ?? "")
      .split(",")
      .filter(Boolean);

    return {
      status: data.status === "successful" ? "success" : data.status === "pending" ? "pending" : "failed",
      amount: data.amount,
      currency: data.currency as "USD" | "NGN",
      reference: data.tx_ref,
      orgId: data.meta?.orgId ?? "",
      paymentRequestIds,
      cardLast4: data.card?.last_4digits,
      cardBrand: data.card?.type,
      paidAt: data.created_at,
      raw: data,
    };
  },

  async verifyWebhookSignature(_rawBody: string, headers: Record<string, string | undefined>): Promise<boolean> {
    // Flutterwave doesn't HMAC-sign the body — it echoes back a static
    // secret hash you set in your dashboard. Compare directly.
    const incoming = headers["verif-hash"];
    return !!incoming && incoming === process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  },

  extractReferenceFromWebhook(body: any): string | null {
    return body?.data?.tx_ref ?? null;
  },

  isSuccessEvent(body: any): boolean {
    return body?.event === "charge.completed" && body?.data?.status === "successful";
  },
};