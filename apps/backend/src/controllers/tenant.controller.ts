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
    nextStep: "connect_payment", // frontend should route here — see submitSettlementDetails below
  });
}

// ------------------------------------------------------------------
// POST /admin/tenant/settlement-details
// Step 2 of onboarding. Flutterwave sub-accounts always live under
// RunServ's own Flutterwave account — an agency has no Flutterwave
// account of its own to create one from — so the agency can't create
// their sub-account themselves. Instead they submit the settlement
// bank details here, RunServ staff create the sub-account by hand in
// the Flutterwave dashboard (which accepts a local bank account
// number directly on the sub-account form for supported countries),
// and a platform admin then attaches the resulting sub-account ID via
// updateTenantAsPlatform below, which is what actually flips the
// tenant to ACTIVE.
// ------------------------------------------------------------------
const settlementDetailsSchema = z.object({
  bankName: z.string().min(2),
  accountNumber: z.string().min(4),
  accountName: z.string().min(2),
  country: z.string().min(2),
});

export async function submitSettlementDetails(req: AdminRequest, res: Response) {
  const parsed = settlementDetailsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const tenant = await prisma.tenant.update({
    where: { id: req.admin!.tenantId },
    data: {
      settlementBankName: parsed.data.bankName,
      settlementAccountNumber: parsed.data.accountNumber,
      settlementAccountName: parsed.data.accountName,
      settlementCountry: parsed.data.country,
      settlementSubmittedAt: new Date(),
    },
  });

  return res.json({ tenant });
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

// PATCH /admin/platform/tenants/:tenantId — fee model, suspend/reactivate,
// and attaching the Flutterwave sub-account ID once RunServ staff have
// created it by hand (see submitSettlementDetails above).
const platformUpdateTenantSchema = z.object({
  feeModel: z.enum(["TRANSACTION_PCT", "FX_SPREAD_SHARE", "FLAT_SUBSCRIPTION"]).optional(),
  feePct: z.number().min(0).max(100).optional(),
  flatFeeUsd: z.number().min(0).optional(),
  status: z.enum(["PENDING_ONBOARDING", "ACTIVE", "SUSPENDED"]).optional(),
  isActive: z.boolean().optional(),
  flutterwaveSubaccountId: z.string().min(3).optional(),
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

  // Attaching a sub-account ID for the first time is what actually
  // completes onboarding — auto-stamp the connection time and, unless
  // the caller explicitly set a different status in this same request,
  // move the tenant to ACTIVE so staff don't have to remember a second step.
  const { flutterwaveSubaccountId, ...rest } = parsed.data;
  const isFirstConnection = !!flutterwaveSubaccountId && !before.flutterwaveSubaccountId;

  const tenant = await prisma.tenant.update({
    where: { id: req.params.tenantId },
    data: {
      ...rest,
      ...(flutterwaveSubaccountId ? { flutterwaveSubaccountId } : {}),
      ...(isFirstConnection ? { flutterwaveOnboardedAt: new Date() } : {}),
      ...(isFirstConnection && parsed.data.status === undefined ? { status: "ACTIVE" as const } : {}),
    },
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
