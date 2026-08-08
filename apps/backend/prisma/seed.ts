// apps/backend/prisma/seed.ts
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

/**
 * Creates the first RunServer admin account so you can log into
 * /admin and start creating client orgs. Run once:
 *   pnpm --filter @runserver/backend exec tsx prisma/seed.ts
 *
 * Change ADMIN_EMAIL / ADMIN_PASSWORD via env, or edit below directly.
 * Rotate this password immediately after first login in production.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL || "you@runserver.io";
  const password = process.env.ADMIN_PASSWORD || "change-me-immediately";

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({
    data: { email, passwordHash, name: "RunServer Admin" },
  });

  console.log(`Created admin user: ${email}`);
  console.log(`Temporary password: ${password} — change this after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
