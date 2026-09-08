// apps/backend/src/controllers/admin.revenue.controller.ts
import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AdminRequest } from "../middleware/admin.middleware.js";

// ------------------------------------------------------------------
// GET /admin/revenue
// Aggregates SUCCESS payments across every client the calling admin
// can see, always in USD (the canonical `usdAmount` field) so NGN and
// USD charges roll up into one comparable total rather than needing
// separate totals per currency.
//
// Tenant-scoped: an AGENCY admin sees only their own tenant's revenue
// (their clients' gross payments — not RunServ's platform fee cut of
// it, see platformFeeUsd below). A PLATFORM admin sees every tenant's
// gross revenue, same as before this upgrade.
// ------------------------------------------------------------------
export async function getRevenueSummary(req: AdminRequest, res: Response) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const tenantScope = req.admin!.isPlatformAdmin ? {} : { tenantId: req.admin!.tenantId };

  const [allTime, thisMonth, byOrgRaw, byGatewayRaw, byCurrencyRaw, recent, platformFeeAllTime] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCESS", ...tenantScope }, _sum: { usdAmount: true } }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", paidAt: { gte: startOfMonth }, ...tenantScope },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["orgId"],
      where: { status: "SUCCESS", ...tenantScope },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["gateway"],
      where: { status: "SUCCESS", ...tenantScope },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { status: "SUCCESS", ...tenantScope },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESS", ...tenantScope },
      orderBy: { paidAt: "desc" },
      take: 15,
      include: { org: { select: { name: true } } },
    }),
    // RunServ's own cut — only meaningful/shown to platform admins,
    // since an agency's platform fee is a cost to them, not "their"
    // revenue in the sense this endpoint otherwise reports.
    req.admin!.isPlatformAdmin
      ? prisma.platformFeeLedger.aggregate({ _sum: { feeUsdAmount: true } })
      : null,
  ]);

  const orgNames = await prisma.organization.findMany({
    where: { id: { in: byOrgRaw.map((r) => r.orgId) } },
    select: { id: true, name: true },
  });
  const orgNameMap = new Map(orgNames.map((o) => [o.id, o.name]));

  return res.json({
    summary: {
      totalUsdAllTime: (allTime._sum.usdAmount ?? 0).toString(),
      totalUsdThisMonth: (thisMonth._sum.usdAmount ?? 0).toString(),
      paymentsThisMonth: thisMonth._count,
      platformFeeUsdAllTime: platformFeeAllTime ? (platformFeeAllTime._sum.feeUsdAmount ?? 0).toString() : null,
      byOrg: byOrgRaw
        .map((r) => ({
          orgId: r.orgId,
          orgName: orgNameMap.get(r.orgId) ?? "Unknown",
          totalUsd: (r._sum.usdAmount ?? 0).toString(),
          paymentsCount: r._count,
        }))
        .sort((a, b) => Number(b.totalUsd) - Number(a.totalUsd)),
      byGateway: byGatewayRaw.map((r) => ({
        gateway: r.gateway,
        totalUsd: (r._sum.usdAmount ?? 0).toString(),
        paymentsCount: r._count,
      })),
      byCurrency: byCurrencyRaw.map((r) => ({
        currency: r.currency,
        totalUsd: (r._sum.usdAmount ?? 0).toString(),
        paymentsCount: r._count,
      })),
      recentPayments: recent.map((p) => ({
        id: p.id,
        orgName: p.org.name,
        amount: p.amount.toString(),
        currency: p.currency,
        usdAmount: p.usdAmount.toString(),
        gateway: p.gateway,
        paidAt: p.paidAt?.toISOString() ?? null,
        receiptNumber: p.receiptNumber,
      })),
    },
  });
}
