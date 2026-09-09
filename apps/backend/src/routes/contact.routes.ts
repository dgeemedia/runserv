// apps/backend/src/routes/contact.routes.ts
import { Router } from "express";
import { submitContactEnquiry, listContactEnquiries, updateContactEnquiry } from "../controllers/contact.controller.js";
import { requireAdminAuth, requirePlatformAdmin } from "../middleware/admin.middleware.js";

const router = Router();

// Public — the marketing site's contact form
router.post("/contact", submitContactEnquiry);

// Platform (RunServ staff) only — these are leads for RunServ itself
router.get("/admin/platform/contact-enquiries", requireAdminAuth, requirePlatformAdmin, listContactEnquiries);
router.patch("/admin/platform/contact-enquiries/:id", requireAdminAuth, requirePlatformAdmin, updateContactEnquiry);

export default router;
