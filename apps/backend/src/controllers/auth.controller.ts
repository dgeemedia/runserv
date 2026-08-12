// apps/backend/src/controllers/auth.controller.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { inviteUserToOrg } from "../services/invite.service.js";
import { sendPasswordResetEmail } from "../services/email.service.js";
// import { verifyTurnstile } from "../services/turnstile.service.js"; // disabled — see NEXT_PUBLIC_TURNSTILE_SITE_KEY setup
import { AuthedRequest } from "../middleware/auth.middleware.js";

// ------------------------------------------------------------------
// POST /auth/login
// Client signs in with email + password. No org code needed —
// the email is already scoped to their organization.
// ------------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().optional(), // Turnstile disabled
});

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email or password format" });

  const { email, password } = parsed.data;

  // Turnstile temporarily disabled — see NEXT_PUBLIC_TURNSTILE_SITE_KEY setup.
  // if (!(await verifyTurnstile(turnstileToken, req.ip))) {
  //   return res.status(400).json({ error: "Verification failed. Please try again." });
  // }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { org: true },
  });

  // Same generic error whether the user doesn't exist or the password
  // is wrong — don't leak which one it was.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }

  if (!user.isActive || !user.org.isActive) {
    return res.status(403).json({ error: "This account is no longer active" });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  // process.env.JWT_EXPIRES_IN || "7d" types as plain `string`, but
  // @types/jsonwebtoken@9's SignOptions.expiresIn wants `number |
  // StringValue` (a template-literal type like "7d" | "12h" | ...).
  // Cast at the call site rather than loosening the env var's type
  // everywhere it's read.
  const token = jwt.sign({ userId: user.id, orgId: user.orgId }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  });

  return res.json({
    token,
    mustChangePassword: user.mustChangePassword,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    org: { id: user.org.id, name: user.org.name, slug: user.org.slug },
  });
}

// ------------------------------------------------------------------
// POST /auth/accept-invite
// Consumes a one-time invite token, sets the real password. No
// Turnstile check here — the token already came from an email we
// sent, so this endpoint isn't reachable by an anonymous bot the way
// login/forgot/reset are.
// ------------------------------------------------------------------
const acceptInviteSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function acceptInvite(req: Request, res: Response) {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { token, newPassword } = parsed.data;

  const inviteToken = await prisma.inviteToken.findUnique({ where: { token }, include: { user: true } });

  if (!inviteToken || inviteToken.usedAt || inviteToken.expiresAt < new Date()) {
    return res.status(400).json({ error: "This invite link is invalid or has expired" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: inviteToken.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.inviteToken.update({
      where: { id: inviteToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return res.json({ message: "Password set. You can now sign in." });
}

// ------------------------------------------------------------------
// POST /orgs/:orgId/users
// OWNER-only: invite a new user into the org (e.g. their finance person)
// ------------------------------------------------------------------
const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["OWNER", "FINANCE", "MEMBER"]).default("MEMBER"),
});

export async function inviteUser(req: AuthedRequest, res: Response) {
  const parsed = inviteUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, name, role } = parsed.data;
  const orgId = req.user!.orgId;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

  try {
    const user = await inviteUserToOrg({ orgId, orgName: org.name, email, name, role });

    await prisma.auditLog.create({
      data: { orgId, userId: req.user!.id, action: "user.invited", metadata: { invitedEmail: email, role } },
    });

    return res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json({ error: err.message ?? "Could not invite user" });
  }
}

// ------------------------------------------------------------------
// POST /auth/forgot-password
// Always returns a generic success message regardless of whether the
// email exists, so this endpoint can't be used to enumerate accounts.
// ------------------------------------------------------------------
const forgotPasswordSchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string().optional(), // Turnstile disabled
});

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email format" });

  const { email } = parsed.data;

  // Turnstile temporarily disabled — see NEXT_PUBLIC_TURNSTILE_SITE_KEY setup.
  // if (!(await verifyTurnstile(turnstileToken, req.ip))) {
  //   return res.status(400).json({ error: "Verification failed. Please try again." });
  // }

  const genericResponse = { message: "If an account exists for that email, a reset link has been sent." };

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) return res.json(genericResponse); // don't leak existence

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.inviteToken.create({
    data: {
      userId: user.id,
      token: rawToken,
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h — shorter-lived than an invite
    },
  });

  const resetUrl = `${process.env.WEB_APP_URL}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail({ to: user.email, name: user.name ?? undefined, resetUrl });

  return res.json(genericResponse);
}

// ------------------------------------------------------------------
// POST /auth/reset-password
// Consumes a PASSWORD_RESET token (distinct from an INVITE token —
// checked explicitly so an old invite link can't double as a reset link).
// ------------------------------------------------------------------
const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  turnstileToken: z.string().optional(), // Turnstile disabled
});

export async function resetPassword(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { token, newPassword } = parsed.data;

  // Turnstile temporarily disabled — see NEXT_PUBLIC_TURNSTILE_SITE_KEY setup.
  // if (!(await verifyTurnstile(turnstileToken, req.ip))) {
  //   return res.status(400).json({ error: "Verification failed. Please try again." });
  // }

  const resetToken = await prisma.inviteToken.findUnique({ where: { token } });

  if (
    !resetToken ||
    resetToken.type !== "PASSWORD_RESET" ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date()
  ) {
    return res.status(400).json({ error: "This reset link is invalid or has expired" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash, mustChangePassword: false } }),
    prisma.inviteToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  return res.json({ message: "Password reset. You can now sign in." });
}