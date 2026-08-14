// apps/backend/src/routes/admin.routes.ts
import { Router } from "express";
import { adminLogin } from "../controllers/admin.auth.controller.js";
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  createService,
  updateService,
  updateOrgUser,
  deleteService,
} from "../controllers/admin.orgs.controller.js";
import { getRevenueSummary } from "../controllers/admin.revenue.controller.js";
import {
  getFxRateAdmin,
  previewFxRateAdmin,
  updateFxRateAdmin,
  syncFxRateAdmin,
} from "../controllers/admin.fx.controller.js";
import { resendInvite, resendReceipt, sendTestEmailAdmin, sendMessageToOrg } from "../controllers/admin.email.controller.js";
import { requireAdminAuth } from "../middleware/admin.middleware.js";

const router = Router();

router.post("/admin/auth/login", adminLogin);

router.get("/admin/orgs", requireAdminAuth, listOrganizations);
router.post("/admin/orgs", requireAdminAuth, createOrganization);
router.get("/admin/orgs/:orgId", requireAdminAuth, getOrganization);
router.patch("/admin/orgs/:orgId", requireAdminAuth, updateOrganization);

router.post("/admin/orgs/:orgId/services", requireAdminAuth, createService);
router.patch("/admin/orgs/:orgId/services/:serviceId", requireAdminAuth, updateService);

router.patch("/admin/orgs/:orgId/users/:userId", requireAdminAuth, updateOrgUser);
router.post("/admin/orgs/:orgId/users/:userId/resend-invite", requireAdminAuth, resendInvite);

router.post("/admin/orgs/:orgId/payments/:paymentId/resend-receipt", requireAdminAuth, resendReceipt);

router.post("/admin/orgs/:orgId/message", requireAdminAuth, sendMessageToOrg);

router.post("/admin/test-email", requireAdminAuth, sendTestEmailAdmin);

router.get("/admin/revenue", requireAdminAuth, getRevenueSummary);

router.get("/admin/fx-rate", requireAdminAuth, getFxRateAdmin);
router.get("/admin/fx-rate/preview", requireAdminAuth, previewFxRateAdmin);
router.patch("/admin/fx-rate", requireAdminAuth, updateFxRateAdmin);
router.post("/admin/fx-rate/sync", requireAdminAuth, syncFxRateAdmin);

router.delete("/admin/orgs/:orgId/services/:serviceId", requireAdminAuth, deleteService);

export default router;
