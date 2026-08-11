import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AdminRequest } from "../middleware/admin.middleware.js";
import { inviteUserToOrg } from "../services/invite.service.js";

// ------------------------------------------------------------------
// GET /admin/orgs
// ------------------------------------------------------------------
export async function listOrganizations(_req: AdminRequest, res: Response) {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { services: true, users: true } },
    },
  });
  return res.json({ orgs });
}

// ------------------------------------------------------------------
// GET /admin/orgs/:orgId
// ------------------------------------------------------------------
export async function getOrganization(req: AdminRequest, res: Response) {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.orgId },
    include: {
      users: true,
      services: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!org) return res.status(404).json({ error: "Organization not found" });
  return res.json({ org });
}

// ------------------------------------------------------------------
// POST /admin/orgs
// Creates the org and invites its first OWNER in one step — this is
// the entry point for onboarding a new client.
// ------------------------------------------------------------------
const createOrgSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  currency: z.string().default("USD"),
  yearlyDiscountPct: z.number().min(0).max(100).default(15),
  preferredGateway: z.enum(["PAYSTACK", "FLUTTERWAVE"]).default("FLUTTERWAVE"),
  ownerEmail: z.string().email(),
  ownerName: z.string().optional(),
});

export async function createOrganization(req: AdminRequest, res: Response) {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { ownerEmail, ownerName, ...orgData } = parsed.data;

  const existingSlug = await prisma.organization.findUnique({ where: { slug: orgData.slug } });
  if (existingSlug) return res.status(409).json({ error: "That slug is already taken" });

  const org = await prisma.organization.create({
    data: { ...orgData, createdByAdminId: req.admin!.id },
  });

  try {
    const owner = await inviteUserToOrg({
      orgId: org.id,
      orgName: org.name,
      email: ownerEmail,
      name: ownerName,
      role: "OWNER",
    });

    await prisma.auditLog.create({
      data: { orgId: org.id, action: "org.created", metadata: { createdByAdmin: req.admin!.email, ownerEmail } },
    });

    return res.status(201).json({ org, owner: { id: owner.id, email: owner.email } });
  } catch (err: any) {
    // Org was created but the owner invite failed (e.g. email already in
    // use elsewhere) — surface that clearly rather than leaving it silent.
    return res.status(err.statusCode ?? 500).json({
      error: `Organization created, but invite failed: ${err.message}`,
      org,
    });
  }
}

// ------------------------------------------------------------------
// PATCH /admin/orgs/:orgId
// Adjust pricing-level org settings: discount %, preferred gateway, active status
// ------------------------------------------------------------------
const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  yearlyDiscountPct: z.number().min(0).max(100).optional(),
  preferredGateway: z.enum(["PAYSTACK", "FLUTTERWAVE"]).optional(),
  isActive: z.boolean().optional(),
});

export async function updateOrganization(req: AdminRequest, res: Response) {
  const parsed = updateOrgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const org = await prisma.organization.update({ where: { id: req.params.orgId }, data: parsed.data });

  await prisma.auditLog.create({
    data: { orgId: org.id, action: "org.updated", metadata: { updatedByAdmin: req.admin!.email, changes: parsed.data } },
  });

  return res.json({ org });
}

// ------------------------------------------------------------------
// POST /admin/orgs/:orgId/services
// Add a billable service to a client org — this is what shows up as
// a checkbox line item on their dashboard once it comes due.
// ------------------------------------------------------------------
const createServiceSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["API", "SERVER", "DATABASE", "DOMAIN", "SECURITY", "STORAGE", "OTHER"]).default("OTHER"),
  description: z.string().optional(),
  monthlyAmount: z.number().positive(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  nextDueDate: z.string(), // ISO date string
});

export async function createService(req: AdminRequest, res: Response) {
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const orgId = req.params.orgId;
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const service = await prisma.service.create({
    data: {
      orgId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      monthlyAmount: parsed.data.monthlyAmount,
      billingCycle: parsed.data.billingCycle,
      nextDueDate: new Date(parsed.data.nextDueDate),
    },
  });

  await prisma.auditLog.create({
    data: { orgId, action: "service.created", metadata: { serviceId: service.id, name: service.name, createdByAdmin: req.admin!.email } },
  });

  return res.status(201).json({ service });
}

// ------------------------------------------------------------------
// PATCH /admin/orgs/:orgId/services/:serviceId
// Edit pricing, pause, cancel, or reschedule a service
// ------------------------------------------------------------------
const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["API", "SERVER", "DATABASE", "DOMAIN", "SECURITY", "STORAGE", "OTHER"]).optional(),
  description: z.string().optional(),
  monthlyAmount: z.number().positive().optional(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]).optional(),
  nextDueDate: z.string().optional(),
});

export async function updateService(req: AdminRequest, res: Response) {
  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { nextDueDate, ...rest } = parsed.data;

  const service = await prisma.service.update({
    where: { id: req.params.serviceId },
    data: { ...rest, ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}) },
  });

  await prisma.auditLog.create({
    data: {
      orgId: service.orgId,
      action: "service.updated",
      metadata: { serviceId: service.id, updatedByAdmin: req.admin!.email, changes: parsed.data },
    },
  });

  return res.json({ service });
}

// ------------------------------------------------------------------
// PATCH /admin/orgs/:orgId/users/:userId
// Deactivate/reactivate a specific client-org user (e.g. someone who
// left the client's company) without deleting their history.
// ------------------------------------------------------------------
const updateUserSchema = z.object({
  isActive: z.boolean(),
});

export async function updateOrgUser(req: AdminRequest, res: Response) {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || user.orgId !== req.params.orgId) {
    return res.status(404).json({ error: "User not found in this organization" });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { isActive: parsed.data.isActive } });

  await prisma.auditLog.create({
    data: {
      orgId: user.orgId,
      action: parsed.data.isActive ? "user.reactivated" : "user.deactivated",
      metadata: { userId: user.id, email: user.email, byAdmin: req.admin!.email },
    },
  });

  return res.json({ user: { id: updated.id, email: updated.email, isActive: updated.isActive } });
}
