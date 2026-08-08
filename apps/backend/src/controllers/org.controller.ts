// apps/backend/src/controllers/org.controller.ts
import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthedRequest } from "../middleware/auth.middleware.js";

// ------------------------------------------------------------------
// GET /orgs/resolve/:slug
// The dashboard route is /[org]/dashboard where [org] is a slug from
// the URL — never trusted directly. This resolves that slug to a real
// org id server-side and confirms it's the same org the caller's JWT
// belongs to, so the frontend never has to trust localStorage (or a
// hand-edited URL) for something as load-bearing as "which org's
// invoices am I about to show".
// ------------------------------------------------------------------
export async function resolveOrgBySlug(req: AuthedRequest, res: Response) {
  const { slug } = req.params;

  const org = await prisma.organization.findUnique({ where: { slug } });

  if (!org || !org.isActive) {
    return res.status(404).json({ error: "Organization not found" });
  }

  if (org.id !== req.user!.orgId) {
    // Don't say "wrong org" — same generic 403 whether the slug
    // belongs to someone else entirely or just isn't this user's org.
    return res.status(403).json({ error: "You don't have access to this organization" });
  }

  return res.json({
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      currency: org.currency,
      preferredGateway: org.preferredGateway,
    },
  });
}
