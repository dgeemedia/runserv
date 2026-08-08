// apps/backend/src/jobs/generatePaymentRequests.job.ts
import { prisma } from "../lib/prisma.js";

/**
 * Run daily. For every ACTIVE service whose nextDueDate has arrived,
 * create the next PaymentRequest and roll nextDueDate forward.
 * Yearly-billed services get the org's discount applied here, once,
 * rather than recalculated ad hoc on the frontend.
 */
export async function generatePaymentRequests() {
  const now = new Date();

  const dueServices = await prisma.service.findMany({
    where: { status: "ACTIVE", nextDueDate: { lte: now } },
    include: { org: true },
  });

  for (const service of dueServices) {
    const isYearly = service.billingCycle === "YEARLY";
    const discountPct = Number(service.org.yearlyDiscountPct);

    const amount = isYearly
      ? Number(service.monthlyAmount) * 12 * (1 - discountPct / 100)
      : Number(service.monthlyAmount);

    const periodLabel = isYearly
      ? `${service.nextDueDate.getFullYear()} (Annual)`
      : service.nextDueDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    await prisma.$transaction([
      prisma.paymentRequest.create({
        data: {
          orgId: service.orgId,
          serviceId: service.id,
          periodLabel,
          billingCycle: service.billingCycle,
          amount: amount.toFixed(2),
          currency: service.org.currency,
          dueDate: service.nextDueDate,
          status: "DUE",
        },
      }),
      prisma.service.update({
        where: { id: service.id },
        data: {
          nextDueDate: isYearly
            ? addMonths(service.nextDueDate, 12)
            : addMonths(service.nextDueDate, 1),
        },
      }),
    ]);
  }

  // Anything DUE that's now past its due date flips to OVERDUE
  await prisma.paymentRequest.updateMany({
    where: { status: "DUE", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });

  console.log(`[generatePaymentRequests] processed ${dueServices.length} services at ${now.toISOString()}`);
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Allow running directly: `pnpm jobs:generate-requests`
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePaymentRequests().then(() => process.exit(0));
}
