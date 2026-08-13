// apps/backend/src/controllers/admin.orgs.controller.ts
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
    return res.status(err.statusCode ?? 500).json({
      error: `Organization created, but invite failed: ${err.message}`,
      org,
    });
  }
}

// ------------------------------------------------------------------
// PATCH /admin/orgs/:orgId
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
// Shared helper: builds the same shape of PaymentRequest the cron
// job (generatePaymentRequests) would eventually create for a
// service's current billing period. Called both here (so a newly
// added service is visible to the client immediately, without
// waiting on the next cron run) and by the cron job itself.
// ------------------------------------------------------------------
function periodLabelFor(dueDate: Date, billingCycle: "MONTHLY" | "YEARLY") {
  if (billingCycle === "YEARLY") {
    return `${dueDate.getFullYear()} (Annual)`;
  }
  return dueDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function statusFor(dueDate: Date) {
  const now = new Date();
  if (dueDate < now) return "OVERDUE" as const;
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (dueDate <= sevenDaysOut) return "DUE" as const;
  return "UPCOMING" as const;
}

// ------------------------------------------------------------------
// POST /admin/orgs/:orgId/services
// Add a billable service to a client org — this is what shows up as
// a checkbox line item on their dashboard once it comes due.
//
// Immediately creates the first PaymentRequest for it too, rather
// than waiting for the next scheduled generatePaymentRequests cron
// run — otherwise a client sees $0.00/no items until that job next
// fires, which for a brand-new service could be up to a day away.
// ------------------------------------------------------------------
const createServiceSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["API", "SERVER", "DATABASE", "DOMAIN", "SECURITY", "STORAGE", "SOFTWARE", "DEVELOPMENT", "MAINTENANCE", "CONSULTING", "OTHER"]).default("OTHER"),
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

  const nextDueDate = new Date(parsed.data.nextDueDate);

  // Yearly billing is priced off monthlyAmount * 12 minus the org's
  // yearly discount, matching how the yearly total is presumably
  // computed elsewhere (checkout/job) — kept here so the very first
  // payment request an org sees isn't priced differently from the
  // ones the cron job would generate for subsequent periods.
  const amount =
    parsed.data.billingCycle === "YEARLY"
      ? parsed.data.monthlyAmount * 12 * (1 - Number(org.yearlyDiscountPct) / 100)
      : parsed.data.monthlyAmount;

  const service = await prisma.service.create({
    data: {
      orgId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      monthlyAmount: parsed.data.monthlyAmount,
      billingCycle: parsed.data.billingCycle,
      nextDueDate,
    },
  });

  const paymentRequest = await prisma.paymentRequest.create({
    data: {
      orgId,
      serviceId: service.id,
      periodLabel: periodLabelFor(nextDueDate, parsed.data.billingCycle),
      billingCycle: parsed.data.billingCycle,
      amount,
      currency: org.currency,
      dueDate: nextDueDate,
      status: statusFor(nextDueDate),
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      action: "service.created",
      metadata: { serviceId: service.id, name: service.name, paymentRequestId: paymentRequest.id, createdByAdmin: req.admin!.email },
    },
  });

  return res.status(201).json({ service, paymentRequest });
}

// ------------------------------------------------------------------
// PATCH /admin/orgs/:orgId/services/:serviceId
// ------------------------------------------------------------------
const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["API", "SERVER", "DATABASE", "DOMAIN", "SECURITY", "STORAGE", "SOFTWARE", "DEVELOPMENT", "MAINTENANCE", "CONSULTING", "OTHER"]).optional(),
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