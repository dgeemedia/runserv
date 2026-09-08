// apps/backend/src/services/fx.service.ts
import { prisma } from "../lib/prisma.js";

const PAIR = "USD_NGN";

/**
 * The rate actually charged to clients: the stored market rate plus
 * the tenant's configured margin. This is the ONLY place this formula
 * lives — every checkout and every display value calls through here,
 * so changing a tenant's margin never requires touching more than one row.
 */
function computeEffectiveRate(marketRate: number, markupPct: number) {
  return marketRate * (1 + markupPct / 100);
}

/**
 * Finds (or lazily creates) the platform's own ExchangeRate row — this
 * is the single source of truth for `marketRate` (the raw USD->NGN
 * number, which is not a per-tenant concept) and doubles as the
 * default markup for any tenant that hasn't set their own yet.
 */
async function getPlatformTenantId(): Promise<string> {
  const platform = await prisma.tenant.findFirstOrThrow({ where: { type: "PLATFORM" } });
  return platform.id;
}

async function getOrCreateRow(tenantId: string) {
  let row = await prisma.exchangeRate.findUnique({ where: { tenantId_pair: { tenantId, pair: PAIR } } });
  if (row) return row;

  // No row yet for this tenant — fall back to the platform's market
  // rate (never invent a market rate per-tenant) with a sane default
  // markup, so checkout never 500s for a freshly onboarded tenant.
  const platformTenantId = await getPlatformTenantId();
  const platformRow =
    tenantId === platformTenantId
      ? null // avoid infinite recursion when seeding the platform's own row
      : await prisma.exchangeRate.findUnique({ where: { tenantId_pair: { tenantId: platformTenantId, pair: PAIR } } });

  return prisma.exchangeRate.create({
    data: {
      tenantId,
      pair: PAIR,
      marketRate: platformRow ? platformRow.marketRate : 1550.0,
      markupPct: 2.0,
      source: "manual",
    },
  });
}

export async function getFxRate(tenantId: string) {
  const row = await getOrCreateRow(tenantId);

  const marketRate = Number(row.marketRate);
  const markupPct = Number(row.markupPct);

  return {
    pair: row.pair,
    marketRate: marketRate.toFixed(4),
    markupPct: markupPct.toFixed(2),
    effectiveRate: computeEffectiveRate(marketRate, markupPct).toFixed(4),
    source: row.source as "manual" | "synced",
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function convertUsdToNgn(tenantId: string, amountUsd: number) {
  const rate = await getFxRate(tenantId);
  const effective = Number(rate.effectiveRate);
  return { amountNgn: Math.round(amountUsd * effective * 100) / 100, effectiveRate: effective };
}

export async function updateFxRate(params: { tenantId: string; marketRate?: number; markupPct?: number; adminId: string }) {
  const { tenantId, adminId, ...rest } = params;
  await getOrCreateRow(tenantId); // ensure a row exists so upsert's `update` branch is the common path

  return prisma.exchangeRate.upsert({
    where: { tenantId_pair: { tenantId, pair: PAIR } },
    create: {
      tenantId,
      pair: PAIR,
      marketRate: rest.marketRate ?? 1550.0,
      markupPct: rest.markupPct ?? 2.0,
      source: "manual",
      updatedByAdminId: adminId,
    },
    update: {
      ...(rest.marketRate !== undefined ? { marketRate: rest.marketRate, source: "manual" } : {}),
      ...(rest.markupPct !== undefined ? { markupPct: rest.markupPct } : {}),
      updatedByAdminId: adminId,
    },
  });
}

/**
 * Pulls a live USD->NGN rate from a free public endpoint so the
 * platform admin doesn't have to hand-type it every day. Only the
 * PLATFORM tenant's row should call this — an agency tenant's markup
 * is a business decision, not a market fact, and their `marketRate`
 * should track the platform's, not its own separately synced value.
 */
export async function syncMarketRate(tenantId: string, adminId: string) {
  const rate = await fetchLiveMarketRate();

  const updated = await prisma.exchangeRate.upsert({
    where: { tenantId_pair: { tenantId, pair: PAIR } },
    create: { tenantId, pair: PAIR, marketRate: rate.value, markupPct: 2.0, source: "synced", updatedByAdminId: adminId },
    update: { marketRate: rate.value, source: "synced", updatedByAdminId: adminId },
  });

  return updated;
}

/**
 * Fetches the live rate WITHOUT saving it — lets the admin preview
 * what "sync" would set marketRate to, and see it applied against the
 * tenant's current markupPct, before committing to it. Also returns a
 * second reference point (the average of two providers) since any
 * single provider can occasionally be stale or wrong, and this is money.
 */
export async function previewMarketRate(tenantId: string) {
  const [primary, secondary] = await Promise.allSettled([
    fetchLiveMarketRate(),
    fetchLiveMarketRateFallback(),
  ]);

  const rates: { source: string; value: number }[] = [];
  if (primary.status === "fulfilled") rates.push(primary.value);
  if (secondary.status === "fulfilled") rates.push(secondary.value);

  if (rates.length === 0) {
    throw new Error("Could not reach any exchange rate provider — enter the rate manually instead");
  }

  const current = await getFxRate(tenantId);

  return {
    quotes: rates,
    // Simple average when both providers responded — a basic sanity
    // check against one provider having a stale or outlier number.
    suggestedMarketRate: rates.reduce((sum, r) => sum + r.value, 0) / rates.length,
    currentMarketRate: Number(current.marketRate),
    currentMarkupPct: Number(current.markupPct),
  };
}

// Shape of the fields we actually read off each provider's response.
// Both open.er-api.com and exchangerate-api.com return a `rates` map
// keyed by currency code — this is enough to type the `.NGN` access
// below without needing the full response schema.
interface RatesResponse {
  rates?: Record<string, number>;
}

async function fetchLiveMarketRate(): Promise<{ source: string; value: number }> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("open.er-api.com unreachable");
  const data = (await res.json()) as RatesResponse;
  const rate = data?.rates?.NGN;
  if (!rate) throw new Error("open.er-api.com did not return an NGN rate");
  return { source: "open.er-api.com", value: rate };
}

async function fetchLiveMarketRateFallback(): Promise<{ source: string; value: number }> {
  const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
  if (!res.ok) throw new Error("exchangerate-api.com unreachable");
  const data = (await res.json()) as RatesResponse;
  const rate = data?.rates?.NGN;
  if (!rate) throw new Error("exchangerate-api.com did not return an NGN rate");
  return { source: "exchangerate-api.com", value: rate };
}