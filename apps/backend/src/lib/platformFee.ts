// apps/backend/src/lib/platformFee.ts
//
// Computes RunServ's cut of a transaction based on the tenant's
// configured fee model. This is the ONLY place this math lives —
// checkout (to build the gateway split) and fulfillment (to record
// the PlatformFeeLedger row) both call through here, so the two
// numbers can never drift apart.
//
// NOTE: FX_SPREAD_SHARE currently falls back to treating fxMarkupUsd
// as the full spread-share base. If you want RunServ to take a
// percentage OF the tenant's markup rather than the whole markup,
// multiply by feePct here — left as the simplest correct starting
// point since it's the one variable most likely to change once you
// see real transaction volume.

import { Prisma } from "@prisma/client";

// feePct/flatFeeUsd accept Prisma's Decimal type because callers pass
// the raw Tenant record straight from the DB (Decimal columns never
// come back as plain `number` — see the Number(...) wrapping used on
// every other Decimal field throughout the codebase, e.g.
// yearlyDiscountPct in admin.orgs.controller.ts). Plain `number` is
// also accepted so this stays easy to unit-test without a real
// Prisma object.
export type TenantForFee = {
  feeModel: "TRANSACTION_PCT" | "FX_SPREAD_SHARE" | "FLAT_SUBSCRIPTION";
  feePct: Prisma.Decimal | number;
  flatFeeUsd: Prisma.Decimal | number | null;
};

export function computePlatformFeeUsd(
  tenant: TenantForFee,
  params: { totalUsd: number; fxMarkupUsd: number | null }
): number {
  const feePct = Number(tenant.feePct);

  switch (tenant.feeModel) {
    case "TRANSACTION_PCT":
      return round2((params.totalUsd * feePct) / 100);

    case "FX_SPREAD_SHARE":
      // Only applies to NGN checkouts (where an FX markup exists at
      // all) — a USD-denominated checkout has no spread to share.
      if (!params.fxMarkupUsd) return 0;
      return round2((params.fxMarkupUsd * feePct) / 100);

    case "FLAT_SUBSCRIPTION":
      // Flat monthly fee is billed to the tenant separately (not
      // deducted per-transaction), so no per-checkout fee applies here.
      return 0;

    default:
      return 0;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}