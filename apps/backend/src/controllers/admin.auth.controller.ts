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

  const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }
  if (!admin.isActive) return res.status(403).json({ error: "This admin account is inactive" });

  const token = jwt.sign({ adminId: admin.id }, process.env.ADMIN_JWT_SECRET!, { expiresIn: "12h" });

  return res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
}
