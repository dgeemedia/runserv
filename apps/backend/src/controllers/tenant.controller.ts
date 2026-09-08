// apps/backend/src/controllers/tenant.controller.ts
//
// Self-serve onboarding for new agency tenants, plus platform-only
// endpoints for RunServ staff to manage tenants. Deliberately kept
// separate from admin.orgs.controller.ts (which manages a tenant's
// CLIENTS) — this file manages the TENANTS themselves.
import { Response, Request } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AdminRequest } from "../middleware/admin.middleware.js";

// ------------------------------------------------------------------
// POST /tenants/signup
// Step 1 of onboarding (see IMPLEMENTATION.md Section 6). Public —
// no auth required, this IS how an agency gets its first admin login.
// Creates the Tenant (status PENDING_ONBOARDING until they connect
// Flutterwave) and its first AdminUser (implicitly the owner; there's
// no separate "role" on AdminUser yet — every AdminUser on a tenant
// has full access to that tenant, same as the platform's own staff
// model today).
// ------------------------------------------------------------------
const signupSchema = z.object({
  tenantName: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  adminEmail: z.string().email(),
  adminName: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signupTenant(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { tenantName, slug, adminEmail, adminName, password } = parsed.data;

  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) return res.status(409).json({ error: "That slug is already taken" });

  const existingEmail = await prisma.adminUser.findUnique({ where: { email: adminEmail.toLowerCase() } });
  if (existingEmail) return res.status(409).json({ error: "An account with that email already exists" });

  const passwordHash = await bcrypt.hash(password, 12);

  const { tenant, admin } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName, slug, type: "AGENCY", status: "PENDING_ONBOARDING" },
    });
    const admin = await tx.adminUser.create({
      data: { tenantId: tenant.id, email: adminEmail.toLowerCase(), name: adminName, passwordHash },
    });
    return { tenant, admin };
  });

  const token = jwt.sign({ adminId: admin.id }, process.env.ADMIN_JWT_SECRET!, { expiresIn: "12h" });

  return res.status(201).json({
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status },
    nextStep: "connect_payment", // frontend should route here — see connectFlutterwaveSubaccount below
  });
}

// ------------------------------------------------------------------
// POST /admin/tenant/connect-flutterwave
// Step 2 of onboarding. Any admin of the calling tenant can complete
// this. For v1, the tenant creates their Flutterwave sub-account
// themselves (via Flutterwave's dashboard or API using their own
// Flutterwave account) and pastes the resulting sub-account ID here —
// fully automating sub-account creation via Flutterwave's API on
// RunServ's behalf is a reasonable v2 (see IMPLEMENTATION.md open
// questions on which Flutterwave product/flow fits best).
// ------------------------------------------------------------------
const connectSchema = z.object({
  flutterwaveSubaccountId: z.string().min(3),
});

export async function connectFlutterwaveSubaccount(req: AdminRequest, res: Response) {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const tenant = await prisma.tenant.update({
    where: { id: req.admin!.tenantId },
    data: {
      flutterwaveSubaccountId: parsed.data.flutterwaveSubaccountId,
      flutterwaveOnboardedAt: new Date(),
      status: "ACTIVE",
    },
  });

  return res.json({ tenant: { id: tenant.id, status: tenant.status, flutterwaveSubaccountId: tenant.flutterwaveSubaccountId } });
}

// ------------------------------------------------------------------
// GET /admin/tenant — the calling admin's own tenant settings
// ------------------------------------------------------------------
export async function getMyTenant(req: AdminRequest, res: Response) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.admin!.tenantId } });
  return res.json({ tenant });
}

// ------------------------------------------------------------------
// PATCH /admin/tenant — tenant self-service settings (name, support email).
// Fee model is deliberately NOT editable here — see updateTenantFeeModel,
// platform-only, so a tenant can't set their own platform fee to zero.
// ------------------------------------------------------------------
const updateMyTenantSchema = z.object({
  name: z.string().min(2).optional(),
  supportEmail: z.string().email().optional(),
});

export async function updateMyTenant(req: AdminRequest, res: Response) {
  const parsed = updateMyTenantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const tenant = await prisma.tenant.update({ where: { id: req.admin!.tenantId }, data: parsed.data });
  return res.json({ tenant });
}

// ==================================================================
// PLATFORM-ONLY (RunServ staff) — mount behind [requireAdminAuth,
// requirePlatformAdmin] in tenant.routes.ts.
// ==================================================================

// GET /admin/platform/tenants
export async function listTenants(_req: AdminRequest, res: Response) {
  const tenants = await prisma.tenant.findMany({
    where: { type: "AGENCY" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { organizations: true, payments: true } } },
  });
  return res.json({ tenants });
}

// PATCH /admin/platform/tenants/:tenantId — fee model, suspend/reactivate
const platformUpdateTenantSchema = z.object({
  feeModel: z.enum(["TRANSACTION_PCT", "FX_SPREAD_SHARE", "FLAT_SUBSCRIPTION"]).optional(),
  feePct: z.number().min(0).max(100).optional(),
  flatFeeUsd: z.number().min(0).optional(),
  status: z.enum(["PENDING_ONBOARDING", "ACTIVE", "SUSPENDED"]).optional(),
  isActive: z.boolean().optional(),
});

// GET /admin/platform/tenants/:tenantId/audit-log
export async function getTenantAuditLog(req: AdminRequest, res: Response) {
  const logs = await prisma.platformAuditLog.findMany({
    where: { tenantId: req.params.tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { performedByAdmin: { select: { email: true } } },
  });
  return res.json({ logs });
}

export async function updateTenantAsPlatform(req: AdminRequest, res: Response) {
  const parsed = platformUpdateTenantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const before = await prisma.tenant.findUniqueOrThrow({ where: { id: req.params.tenantId } });

  const tenant = await prisma.tenant.update({
    where: { id: req.params.tenantId },
    data: parsed.data,
  });

  // Every platform-level change to a tenant's rules is logged — this is
  // real money routing (fee model/rate) and account status, so there
  // should always be a "who changed what, and when" trail, especially
  // once more than one person has platform admin access.
  await prisma.platformAuditLog.create({
    data: {
      tenantId: tenant.id,
      performedByAdminId: req.admin!.id,
      action: "tenant.rules_updated",
      metadata: { before: sanitizeTenantForLog(before), after: sanitizeTenantForLog(tenant), changes: parsed.data },
    },
  });

  return res.json({ tenant });
}

function sanitizeTenantForLog(t: { feeModel: string; feePct: unknown; flatFeeUsd: unknown; status: string; isActive: boolean }) {
  return { feeModel: t.feeModel, feePct: t.feePct?.toString(), flatFeeUsd: t.flatFeeUsd?.toString() ?? null, status: t.status, isActive: t.isActive };
}
