// apps/backend/src/routes/tenant.routes.ts
import { Router } from "express";
import {
  signupTenant,
  connectFlutterwaveSubaccount,
  getMyTenant,
  updateMyTenant,
  listTenants,
  updateTenantAsPlatform,
  getTenantAuditLog,
} from "../controllers/tenant.controller.js";
import { requireAdminAuth, requirePlatformAdmin } from "../middleware/admin.middleware.js";

const router = Router();

// Public — self-serve signup, step 1 of onboarding
router.post("/tenants/signup", signupTenant);

// Any admin of their own tenant
router.get("/admin/tenant", requireAdminAuth, getMyTenant);
router.patch("/admin/tenant", requireAdminAuth, updateMyTenant);
router.post("/admin/tenant/connect-flutterwave", requireAdminAuth, connectFlutterwaveSubaccount);

// Platform (RunServ staff) only
router.get("/admin/platform/tenants", requireAdminAuth, requirePlatformAdmin, listTenants);
router.patch("/admin/platform/tenants/:tenantId", requireAdminAuth, requirePlatformAdmin, updateTenantAsPlatform);
router.get("/admin/platform/tenants/:tenantId/audit-log", requireAdminAuth, requirePlatformAdmin, getTenantAuditLog);

export default router;
