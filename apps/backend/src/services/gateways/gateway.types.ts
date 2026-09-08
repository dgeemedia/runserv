// apps/backend/src/services/gateways/gateway.types.ts
import type { PaymentGateway } from "@runserver/types";

export interface InitTransactionParams {
  email: string;
  amount: number; // in `currency`'s major unit (dollars or naira, not cents/kobo)
  currency: "USD" | "NGN";
  paymentRequestIds: string[];
  orgId: string;
  callbackUrl: string;
  /**
   * Multi-tenant split settlement — when set, the gateway routes this
   * transaction to the tenant's own sub-account instead of RunServ's
   * main settlement account, taking RunServ's cut via `platformSplitPct`.
   *
   * `platformSplitPct` is RunServ's share of the WHOLE transaction, as a
   * fraction (0.03 = 3%), regardless of which fee model produced it —
   * always expressed this way so the gateway adapter has one unambiguous
   * number to act on. Pass 0 (not undefined) when the tenant's fee model
   * charges them separately (e.g. FLAT_SUBSCRIPTION) — this still tells
   * the gateway to route the FULL amount to the tenant's sub-account;
   * omitting `split` entirely would silently send it to RunServ's main
   * account instead, which is a real bug this type exists to prevent.
   */
  split?: {
    tenantSubaccountId: string;
    platformSplitPct: number;
  };
}

export interface InitTransactionResult {
  checkoutUrl: string;
  reference: string;
}

export interface VerifiedTransaction {
  status: "success" | "failed" | "pending";
  amount: number; // in `currency`'s major unit
  currency: "USD" | "NGN";
  reference: string;
  orgId: string;
  paymentRequestIds: string[];
  cardLast4?: string;
  cardBrand?: string;
  paidAt: string;
  raw: unknown;
}

/**
 * Every payment gateway we integrate implements this shape. The
 * controller layer talks only to this interface, never to Paystack
 * or Flutterwave's SDKs directly — that's what lets an org switch
 * `preferredGateway` without any controller code changing.
 */
export interface GatewayAdapter {
  readonly id: PaymentGateway;
  initializeTransaction(params: InitTransactionParams): Promise<InitTransactionResult>;
  verifyTransaction(reference: string): Promise<VerifiedTransaction>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | undefined>): Promise<boolean>;
  /** Pulls the transaction reference out of a webhook payload, before signature-based lookup. */
  extractReferenceFromWebhook(body: any): string | null;
  /** Whether this webhook event represents a successful charge worth verifying. */
  isSuccessEvent(body: any): boolean;
}
