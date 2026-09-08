// apps/backend/src/controllers/admin.auth.controller.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function adminLogin(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email or password format" });

  const { email, password } = parsed.data;

  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
    include: { tenant: true },
  });

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }
  if (!admin.isActive) return res.status(403).json({ error: "This admin account is inactive" });
  if (!admin.tenant.isActive || admin.tenant.status === "SUSPENDED") {
    return res.status(403).json({ error: "This account's tenant is suspended" });
  }

  const token = jwt.sign({ adminId: admin.id }, process.env.ADMIN_JWT_SECRET!, { expiresIn: "12h" });

  return res.json({
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name },
    tenant: {
      id: admin.tenant.id,
      name: admin.tenant.name,
      slug: admin.tenant.slug,
      type: admin.tenant.type,
      status: admin.tenant.status,
    },
  });
}
