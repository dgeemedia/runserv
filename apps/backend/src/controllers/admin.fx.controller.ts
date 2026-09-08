// apps/backend/src/controllers/admin.fx.controller.ts
import { Response } from "express";
import { z } from "zod";
import { AdminRequest } from "../middleware/admin.middleware.js";
import { getFxRate, updateFxRate, syncMarketRate, previewMarketRate } from "../services/fx.service.js";

// GET /admin/fx-rate — the calling admin's own tenant markup
export async function getFxRateAdmin(req: AdminRequest, res: Response) {
  const rate = await getFxRate(req.admin!.tenantId);
  return res.json({ rate });
}

// GET /admin/fx-rate/preview
// Fetches live quotes WITHOUT saving anything — this is how the admin
// sees the raw market number before any margin is applied, and before
// committing to it via PATCH or /sync.
export async function previewFxRateAdmin(req: AdminRequest, res: Response) {
  try {
    const preview = await previewMarketRate(req.admin!.tenantId);
    return res.json({ preview });
  } catch (err: any) {
    return res.status(502).json({ error: err.message ?? "Could not fetch live rates" });
  }
}

// PATCH /admin/fx-rate — set your tenant's markup %, and (platform
// admins only) the underlying market rate itself.
const updateSchema = z.object({
  marketRate: z.number().positive().optional(),
  markupPct: z.number().min(0).max(50).optional(),
});

export async function updateFxRateAdmin(req: AdminRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  if (parsed.data.marketRate === undefined && parsed.data.markupPct === undefined) {
    return res.status(400).json({ error: "Provide marketRate and/or markupPct" });
  }
  // Agency tenants set their own margin, not the underlying market
  // rate — that stays a platform-wide fact sourced from the PLATFORM
  // tenant's row, so all agencies' NGN pricing tracks the same market.
  if (parsed.data.marketRate !== undefined && !req.admin!.isPlatformAdmin) {
    return res.status(403).json({ error: "Only RunServ platform staff can set the underlying market rate — you can set your markupPct" });
  }

  await updateFxRate({ tenantId: req.admin!.tenantId, ...parsed.data, adminId: req.admin!.id });

  // Note: FX rate changes are tenant-wide, not org-scoped, so they
  // aren't written to AuditLog (which requires an orgId). Consider a
  // separate PlatformAuditLog model if you want these tracked too.

  const rate = await getFxRate(req.admin!.tenantId);
  return res.json({ rate });
}

// POST /admin/fx-rate/sync — pull the latest market rate from a public
// API. Platform-only: syncing writes the PLATFORM tenant's market
// rate, which every other tenant's checkout reads from as a fallback.
export async function syncFxRateAdmin(req: AdminRequest, res: Response) {
  if (!req.admin!.isPlatformAdmin) {
    return res.status(403).json({ error: "Only RunServ platform staff can sync the market rate" });
  }
  try {
    await syncMarketRate(req.admin!.tenantId, req.admin!.id);
    const rate = await getFxRate(req.admin!.tenantId);
    return res.json({ rate });
  } catch (err: any) {
    return res.status(502).json({ error: err.message ?? "Could not sync rate from provider" });
  }
}
