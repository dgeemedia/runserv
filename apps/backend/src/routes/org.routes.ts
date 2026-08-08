// apps/backend/src/routes/org.routes.ts
import { Router } from "express";
import { resolveOrgBySlug } from "../controllers/org.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/orgs/resolve/:slug", requireAuth, resolveOrgBySlug);

export default router;
