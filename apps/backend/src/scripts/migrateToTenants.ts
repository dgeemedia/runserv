// apps/backend/src/scripts/migrateToTenants.ts
//
// Run ONCE, after `prisma migrate dev` has applied the tenant schema
// change, and BEFORE deploying the new tenant-scoped code to
// production traffic:
//
//   pnpm --filter @runserver/backend exec tsx src/scripts/migrateToTenants.ts
//
// What it does:
//   1. Creates a single PLATFORM tenant representing RunServ / "you",
//      since your existing AdminUsers, Organizations, Payments, and
//      ExchangeRate row all currently represent your own operation.
//   2. Backfills tenantId onto every existing AdminUser, Organization,
//      Payment, and ExchangeRate row.
//
// Safe to re-run: every step is idempotent (checks before writing).
import { prisma } from "../lib/prisma.js";

const PLATFORM_SLUG = "runserv-platform";

async function main() {
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: PLATFORM_SLUG },
    create: { name: "RunServ", slug: PLATFORM_SLUG, type: "PLATFORM", status: "ACTIVE" },
    update: {},
  });
  console.log(`Platform tenant: ${platformTenant.id}`);

  // --- AdminUser ---------------------------------------------------
  // Prisma requires tenantId to be non-null once the schema migration
  // has run, so this assumes you ran the migration with a temporary
  // default or nullable column first. If `prisma migrate dev` refused
  // to apply the schema because existing rows have no tenantId, see
  // IMPLEMENTATION.md Step 2 for the two-phase migration approach
  // (add column nullable -> backfill via this script -> make it
  // required in a second migration).
  const adminResult = await prisma.adminUser.updateMany({
    where: { tenantId: null as any },
    data: { tenantId: platformTenant.id },
  });
  console.log(`Backfilled tenantId on ${adminResult.count} admin users`);

  // --- Organization --------------------------------------------------
  const orgResult = await prisma.organization.updateMany({
    where: { tenantId: null as any },
    data: { tenantId: platformTenant.id },
  });
  console.log(`Backfilled tenantId on ${orgResult.count} organizations`);

  // --- Payment ---------------------------------------------------
  const paymentResult = await prisma.payment.updateMany({
    where: { tenantId: null as any },
    data: { tenantId: platformTenant.id },
  });
  console.log(`Backfilled tenantId on ${paymentResult.count} payments`);

  // --- ExchangeRate ---------------------------------------------------
  // The old schema had one global row (unique on `pair` alone). Move
  // it onto the platform tenant so existing NGN pricing is unaffected.
  const existingRate = await prisma.exchangeRate.findFirst({ where: { tenantId: null as any } });
  if (existingRate) {
    await prisma.exchangeRate.update({
      where: { id: existingRate.id },
      data: { tenantId: platformTenant.id },
    });
    console.log(`Moved existing exchange rate row onto the platform tenant`);
  }

  console.log("Done. Verify row counts above match your expectations before deploying.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
