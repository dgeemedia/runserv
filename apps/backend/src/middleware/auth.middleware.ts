// apps/backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    orgId: string;
    email: string;
    role: "OWNER" | "FINANCE" | "MEMBER";
  };
}

interface TokenPayload {
  userId: string;
  orgId: string;
}

/**
 * Verifies the JWT, confirms the user + org still exist and are active,
 * and attaches a minimal `req.user` for downstream handlers.
 * Every route that touches org data should sit behind this.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { org: true },
    });

    if (!user || !user.isActive || !user.org.isActive) {
      return res.status(401).json({ error: "Account or organization is inactive" });
    }

    req.user = {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      role: user.role,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Ensures the :orgId in the URL actually matches the org encoded in
 * the caller's JWT. Without this, the URL param is purely decorative —
 * controllers that read req.user.orgId are already safe, but a
 * mismatched URL (e.g. a stale bookmark, or someone hand-editing the
 * address bar) should fail loudly with 403 rather than silently
 * serving data for a different org than the URL implies.
 */
export function requireMatchingOrgParam(req: AuthedRequest, res: Response, next: NextFunction) {
  const urlOrgId = req.params.orgId;
  if (!req.user || urlOrgId !== req.user.orgId) {
    return res.status(403).json({ error: "You don't have access to this organization" });
  }
  next();
}

/**
 * Restricts a route to specific roles within the org.
 * Usage: requireRole("OWNER") or requireRole("OWNER", "FINANCE")
 */
export function requireRole(...roles: Array<"OWNER" | "FINANCE" | "MEMBER">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to do this" });
    }
    next();
  };
}
