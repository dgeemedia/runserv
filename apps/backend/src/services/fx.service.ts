// apps/backend/src/services/fx.service.ts
import { prisma } from "../lib/prisma.js";

const PAIR = "USD_NGN";

/**
 * The rate actually charged to clients: the stored market rate plus
 * your configured margin. This is the ONLY place this formula lives —
 * every checkout and every display value calls through here, so
 * changing your margin never requires touching more than one row.
 */
function computeEffectiveRate(marketRate: number, markupPct: number) {
  return marketRate * (1 + markupPct / 100);
}

export async function getFxRate() {
  let row = await prisma.exchangeRate.findUnique({ where: { pair: PAIR } });

  // First run: seed a sane starting point so checkout never 500s on a
  // missing row. Admin should immediately review/adjust this in /admin.
  if (!row) {
    row = await prisma.exchangeRate.create({
      data: { pair: PAIR, marketRate: 1550.0, markupPct: 2.0, source: "manual" },
    });
  }

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

export async function convertUsdToNgn(amountUsd: number) {
  const rate = await getFxRate();
  const effective = Number(rate.effectiveRate);
  return { amountNgn: Math.round(amountUsd * effective * 100) / 100, effectiveRate: effective };
}

export async function updateFxRate(params: { marketRate?: number; markupPct?: number; adminId: string }) {
  const existing = await prisma.exchangeRate.findUnique({ where: { pair: PAIR } });

  return prisma.exchangeRate.upsert({
    where: { pair: PAIR },
    create: {
      pair: PAIR,
      marketRate: params.marketRate ?? 1550.0,
      markupPct: params.markupPct ?? 2.0,
      source: "manual",
      updatedByAdminId: params.adminId,
    },
    update: {
      ...(params.marketRate !== undefined ? { marketRate: params.marketRate, source: "manual" } : {}),
      ...(params.markupPct !== undefined ? { markupPct: params.markupPct } : {}),
      updatedByAdminId: params.adminId,
    },
  });
}

/**
 * Pulls a live USD->NGN rate from a free public endpoint so the admin
 * doesn't have to hand-type it every day. This only updates
 * `marketRate` — `markupPct` (your margin) is untouched, since that's
 * a business decision, not a market fact.
 */
export async function syncMarketRate(adminId: string) {
  const rate = await fetchLiveMarketRate();

  const updated = await prisma.exchangeRate.upsert({
    where: { pair: PAIR },
    create: { pair: PAIR, marketRate: rate.value, markupPct: 2.0, source: "synced", updatedByAdminId: adminId },
    update: { marketRate: rate.value, source: "synced", updatedByAdminId: adminId },
  });

  return updated;
}

/**
 * Fetches the live rate WITHOUT saving it — lets the admin preview
 * what "sync" would set marketRate to, and see it applied against the
 * current markupPct, before committing to it. Also returns a second
 * reference point (the average of two providers) since any single
 * provider can occasionally be stale or wrong, and this is money.
 */
export async function previewMarketRate() {
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

  const current = await getFxRate();

  return {
    quotes: rates,
    // Simple average when both providers responded — a basic sanity
    // check against one provider having a stale or outlier number.
    suggestedMarketRate: rates.reduce((sum, r) => sum + r.value, 0) / rates.length,
    currentMarketRate: Number(current.marketRate),
    currentMarkupPct: Number(current.markupPct),
  };
}

async function fetchLiveMarketRate(): Promise<{ source: string; value: number }> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("open.er-api.com unreachable");
  const data = await res.json();
  const rate = data?.rates?.NGN;
  if (!rate) throw new Error("open.er-api.com did not return an NGN rate");
  return { source: "open.er-api.com", value: rate };
}

async function fetchLiveMarketRateFallback(): Promise<{ source: string; value: number }> {
  const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
  if (!res.ok) throw new Error("exchangerate-api.com unreachable");
  const data = await res.json();
  const rate = data?.rates?.NGN;
  if (!rate) throw new Error("exchangerate-api.com did not return an NGN rate");
  return { source: "exchangerate-api.com", value: rate };
}
