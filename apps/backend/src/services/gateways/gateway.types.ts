// apps/backend/src/services/gateways/gateway.types.ts
import type { PaymentGateway } from "@runserver/types";

export interface InitTransactionParams {
  email: string;
  amount: number; // in `currency`'s major unit (dollars or naira, not cents/kobo)
  currency: "USD" | "NGN";
  paymentRequestIds: string[];
  orgId: string;
  callbackUrl: string;
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
