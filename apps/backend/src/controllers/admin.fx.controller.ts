// apps/backend/src/controllers/admin.fx.controller.ts
import { Response } from "express";
import { z } from "zod";
import { AdminRequest } from "../middleware/admin.middleware.js";
import { getFxRate, updateFxRate, syncMarketRate, previewMarketRate } from "../services/fx.service.js";

// GET /admin/fx-rate
export async function getFxRateAdmin(_req: AdminRequest, res: Response) {
  const rate = await getFxRate();
  return res.json({ rate });
}

// GET /admin/fx-rate/preview
// Fetches live quotes WITHOUT saving anything — this is how the admin
// sees the raw market number before any margin is applied, and before
// committing to it via PATCH or /sync.
export async function previewFxRateAdmin(_req: AdminRequest, res: Response) {
  try {
    const preview = await previewMarketRate();
    return res.json({ preview });
  } catch (err: any) {
    return res.status(502).json({ error: err.message ?? "Could not fetch live rates" });
  }
}

// PATCH /admin/fx-rate — manually set the market rate and/or your markup %
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

  await updateFxRate({ ...parsed.data, adminId: req.admin!.id });

  // Note: FX rate changes are platform-wide, not org-scoped, so they
  // aren't written to AuditLog (which requires an orgId). Consider a
  // separate PlatformAuditLog model if you want these tracked too.

  const rate = await getFxRate();
  return res.json({ rate });
}

// POST /admin/fx-rate/sync — pull the latest market rate from a public API
export async function syncFxRateAdmin(req: AdminRequest, res: Response) {
  try {
    await syncMarketRate(req.admin!.id);
    const rate = await getFxRate();
    return res.json({ rate });
  } catch (err: any) {
    return res.status(502).json({ error: err.message ?? "Could not sync rate from provider" });
  }
}
