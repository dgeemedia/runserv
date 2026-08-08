// apps/backend/src/controllers/admin.revenue.controller.ts
import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AdminRequest } from "../middleware/admin.middleware.js";

// ------------------------------------------------------------------
// GET /admin/revenue
// Aggregates SUCCESS payments across every client, always in USD
// (the canonical `usdAmount` field) so NGN and USD charges roll up
// into one comparable total rather than needing separate totals per
// currency.
// ------------------------------------------------------------------
export async function getRevenueSummary(_req: AdminRequest, res: Response) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [allTime, thisMonth, byOrgRaw, byGatewayRaw, byCurrencyRaw, recent] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { usdAmount: true } }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", paidAt: { gte: startOfMonth } },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["orgId"],
      where: { status: "SUCCESS" },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["gateway"],
      where: { status: "SUCCESS" },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { status: "SUCCESS" },
      _sum: { usdAmount: true },
      _count: true,
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESS" },
      orderBy: { paidAt: "desc" },
      take: 15,
      include: { org: { select: { name: true } } },
    }),
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
