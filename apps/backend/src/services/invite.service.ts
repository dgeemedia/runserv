// apps/backend/src/services/invite.service.ts
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { sendInviteEmail } from "./email.service.js";
import type { OrgRole } from "@runserver/types";

/**
 * Creates a user in PENDING (mustChangePassword) state, generates a
 * one-time invite token, and emails it via Brevo. Used both when an
 * org OWNER adds a teammate (e.g. their finance person) and when a
 * RunServer admin creates a brand-new client org and needs to invite
 * that client's first OWNER.
 */
export async function inviteUserToOrg(params: {
  orgId: string;
  orgName: string;
  email: string;
  name?: string;
  role: OrgRole;
}) {
  const existing = await prisma.user.findUnique({ where: { email: params.email.toLowerCase() } });
  if (existing) {
    throw Object.assign(new Error("A user with this email already exists"), { statusCode: 409 });
  }

  const tempPasswordHash = await bcrypt.hash(crypto.randomUUID(), 12);

  const user = await prisma.user.create({
    data: {
      orgId: params.orgId,
      email: params.email.toLowerCase(),
      name: params.name,
      role: params.role,
      passwordHash: tempPasswordHash,
      mustChangePassword: true,
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.inviteToken.create({
    data: {
      userId: user.id,
      token: rawToken,
      type: "INVITE",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
    },
  });

  const inviteUrl = `${process.env.WEB_APP_URL}/accept-invite?token=${rawToken}`;

  await sendInviteEmail({ to: user.email, name: user.name ?? undefined, orgName: params.orgName, inviteUrl, role: params.role });

  return user;
}
