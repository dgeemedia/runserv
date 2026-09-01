// apps/backend/src/services/gateways/gateway.factory.ts
import type { PaymentGateway } from "@runserver/types";
import type { GatewayAdapter } from "./gateway.types.js";
import { paystackAdapter } from "./paystack.adapter.js";
import { flutterwaveAdapter } from "./flutterwave.adapter.js";

// MANUAL is a valid PaymentGateway value (for Payment records created by
// admin.payments.controller.ts's markPaymentsPaidManually), but it has no
// real gateway to talk to — so it's deliberately excluded here. Every call
// site that might see a MANUAL payment (resyncPayment, reconcilePendingPayments)
// already guards against passing it into getGateway before reaching this point.
type LiveGateway = Exclude<PaymentGateway, "MANUAL">;

const adapters: Record<LiveGateway, GatewayAdapter> = {
  PAYSTACK: paystackAdapter,
  FLUTTERWAVE: flutterwaveAdapter,
};

export function getGateway(gateway: LiveGateway): GatewayAdapter {
  return adapters[gateway];
}
