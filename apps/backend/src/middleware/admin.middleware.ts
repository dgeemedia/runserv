// apps/backend/src/middleware/admin.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    tenantId: string;
    /** True only for AdminUsers belonging to the PLATFORM tenant (RunServ staff). */
    isPlatformAdmin: boolean;
  };
}

interface AdminTokenPayload {
  adminId: string;
}

/**
 * Verifies an admin JWT, signed with ADMIN_JWT_SECRET — a different
 * secret from client-org tokens (JWT_SECRET), so a leaked or forged
 * client token can never be replayed as an admin token.
 *
 * Also resolves and attaches the admin's tenant. Every downstream
 * controller MUST scope its queries by req.admin.tenantId (unless
 * req.admin.isPlatformAdmin is true and the route is explicitly a
 * platform-only route) — this middleware only authenticates the
 * admin, it does not by itself prevent cross-tenant data access.
 */
export async function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token" });

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminId },
      include: { tenant: true },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: "Admin account is inactive" });
    }
    if (!admin.tenant.isActive || admin.tenant.status === "SUSPENDED") {
      return res.status(403).json({ error: "This account's tenant is suspended" });
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      tenantId: admin.tenantId,
      isPlatformAdmin: admin.tenant.type === "PLATFORM",
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Extra gate for platform-only routes (managing other tenants, global
 * FX market rate, cross-tenant revenue reporting). Chain AFTER
 * requireAdminAuth: [requireAdminAuth, requirePlatformAdmin].
 */
export function requirePlatformAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  if (!req.admin?.isPlatformAdmin) {
    return res.status(403).json({ error: "This action is restricted to RunServ platform staff" });
  }
  next();
}
