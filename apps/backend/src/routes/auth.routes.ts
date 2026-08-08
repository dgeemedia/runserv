// apps/backend/src/routes/auth.routes.ts
import { Router } from "express";
import { login, acceptInvite, inviteUser, forgotPassword, resetPassword } from "../controllers/auth.controller.js";
import { requireAuth, requireRole, requireMatchingOrgParam } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/auth/login", login);
router.post("/auth/accept-invite", acceptInvite);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);

// Only an OWNER can add new users (e.g. their finance person) to the org
router.post("/orgs/:orgId/users", requireAuth, requireMatchingOrgParam, requireRole("OWNER"), inviteUser);

export default router;
