// apps/backend/prisma/seed.ts
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

/**
 * Creates the PLATFORM tenant (RunServ itself) and its first admin
 * account so you can log into /admin and start creating client orgs
 * or managing other agency tenants. Run once:
 *   pnpm --filter @runserver/backend exec tsx prisma/seed.ts
 *
 * Change ADMIN_EMAIL / ADMIN_PASSWORD via env, or edit below directly.
 * Rotate this password immediately after first login in production.
 *
 * NOTE: if you're upgrading an existing single-tenant deployment
 * (data created before the multi-tenant migration), do NOT run this
 * seed script against that database — use scripts/migrateToTenants.ts
 * instead, which creates the PLATFORM tenant AND backfills your
 * existing orgs/admins/payments/exchange rate onto it, preserving
 * your existing data. This seed script is only for a brand-new,
 * empty database.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL || "you@runserver.io";
  const password = process.env.ADMIN_PASSWORD || "change-me-immediately";

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists — skipping.`);
    return;
  }

  const platformTenant = await prisma.tenant.upsert({
    where: { slug: "runserv-platform" },
    create: { name: "RunServ", slug: "runserv-platform", type: "PLATFORM", status: "ACTIVE" },
    update: {},
  });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({
    data: { tenantId: platformTenant.id, email, passwordHash, name: "RunServ Admin" },
  });

  console.log(`Created platform tenant and admin user: ${email}`);
  console.log(`Temporary password: ${password} — change this after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
