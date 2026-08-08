// apps/backend/src/services/gateways/gateway.factory.ts
import type { PaymentGateway } from "@runserver/types";
import type { GatewayAdapter } from "./gateway.types.js";
import { paystackAdapter } from "./paystack.adapter.js";
import { flutterwaveAdapter } from "./flutterwave.adapter.js";

const adapters: Record<PaymentGateway, GatewayAdapter> = {
  PAYSTACK: paystackAdapter,
  FLUTTERWAVE: flutterwaveAdapter,
};

export function getGateway(gateway: PaymentGateway): GatewayAdapter {
  return adapters[gateway];
}
