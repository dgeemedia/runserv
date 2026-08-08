// apps/backend/src/routes/payments.routes.ts
import { Router } from "express";
import {
  createCheckout,
  handlePaystackWebhook,
  handleFlutterwaveWebhook,
  listPaymentRequests,
  getOrgFxRate,
} from "../controllers/payments.controller.js";
import { requireAuth, requireRole, requireMatchingOrgParam } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/orgs/:orgId/payment-requests", requireAuth, requireMatchingOrgParam, listPaymentRequests);
router.get("/orgs/:orgId/fx-rate", requireAuth, requireMatchingOrgParam, getOrgFxRate);

// FINANCE and OWNER can initiate payments; plain MEMBER cannot (view-only)
router.post("/orgs/:orgId/checkout", requireAuth, requireMatchingOrgParam, requireRole("OWNER", "FINANCE"), createCheckout);

// Webhooks are unauthenticated (gateways can't send a JWT) — protected
// instead by signature verification inside each handler.
router.post("/webhooks/paystack", handlePaystackWebhook);
router.post("/webhooks/flutterwave", handleFlutterwaveWebhook);

export default router;
