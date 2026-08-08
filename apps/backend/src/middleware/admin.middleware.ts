// apps/backend/src/middleware/admin.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export interface AdminRequest extends Request {
  admin?: { id: string; email: string };
}

interface AdminTokenPayload {
  adminId: string;
}

/**
 * Verifies an admin JWT, signed with ADMIN_JWT_SECRET — a different
 * secret from client-org tokens (JWT_SECRET), so a leaked or forged
 * client token can never be replayed as an admin token.
 */
export async function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token" });

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminId } });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: "Admin account is inactive" });
    }

    req.admin = { id: admin.id, email: admin.email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
