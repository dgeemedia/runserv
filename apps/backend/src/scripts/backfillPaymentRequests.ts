// apps/backend/src/scripts/backfillPaymentRequests.ts
import { prisma } from "../lib/prisma.js";

/**
 * One-time backfill for services created before createService started
 * generating an initial PaymentRequest immediately. Finds every ACTIVE
 * service with no live (DUE/OVERDUE/UPCOMING) payment request and
 * creates one now, using the same pricing/labeling logic as
 * createService and generatePaymentRequests.job.ts.
 *
 * Safe to run more than once — services that already have a live
 * payment request are skipped.
 */

function periodLabelFor(dueDate: Date, billingCycle: "MONTHLY" | "YEARLY") {
  if (billingCycle === "YEARLY") {
    return `${dueDate.getFullYear()} (Annual)`;
  }
  return dueDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function statusFor(dueDate: Date, now: Date) {
  if (dueDate < now) return "OVERDUE" as const;
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (dueDate <= sevenDaysOut) return "DUE" as const;
  return "UPCOMING" as const;
}

async function backfillPaymentRequests() {
  const now = new Date();

  const services = await prisma.service.findMany({
    where: {
      status: "ACTIVE",
      paymentRequests: {
        none: { status: { in: ["DUE", "OVERDUE", "UPCOMING"] } },
      },
    },
    include: { org: true },
  });

  console.log(`[backfillPaymentRequests] ${services.length} service(s) with no live payment request found.`);

  for (const service of services) {
    const isYearly = service.billingCycle === "YEARLY";
    const discountPct = Number(service.org.yearlyDiscountPct);

    const amount = isYearly
      ? Number(service.monthlyAmount) * 12 * (1 - discountPct / 100)
      : Number(service.monthlyAmount);

    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        orgId: service.orgId,
        serviceId: service.id,
        periodLabel: periodLabelFor(service.nextDueDate, service.billingCycle),
        billingCycle: service.billingCycle,
        amount: amount.toFixed(2),
        currency: service.org.currency,
        dueDate: service.nextDueDate,
        status: statusFor(service.nextDueDate, now),
      },
    });

    await prisma.auditLog.create({
      data: {
        orgId: service.orgId,
        action: "service.backfilled_payment_request",
        metadata: { serviceId: service.id, paymentRequestId: paymentRequest.id, serviceName: service.name },
      },
    });

    console.log(`  created ${paymentRequest.id} for service ${service.id} (${service.name}) — ${paymentRequest.status}`);
  }

  console.log(`[backfillPaymentRequests] done.`);
}

backfillPaymentRequests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfillPaymentRequests] failed:", err);
    process.exit(1);
  });