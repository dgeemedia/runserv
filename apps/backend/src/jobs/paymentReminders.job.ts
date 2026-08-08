// apps/backend/src/jobs/paymentReminders.job.ts
import { prisma } from "../lib/prisma.js";
import { sendPaymentReminderEmail } from "../services/email.service.js";

const REMINDER_WINDOW_DAYS = 3; // start reminding this many days before due
const MAX_REMINDERS = 4; // stop nagging after this many emails per item

/**
 * Run daily. Groups each org's DUE/OVERDUE items into one email
 * (not one email per line item) and sends to every OWNER + FINANCE
 * user in that org, since either could be the one paying.
 */
export async function sendPaymentReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const dueItems = await prisma.paymentRequest.findMany({
    where: {
      status: { in: ["DUE", "OVERDUE"] },
      dueDate: { lte: windowEnd },
      remindersSent: { lt: MAX_REMINDERS },
    },
    include: { service: true, org: { include: { users: { where: { role: { in: ["OWNER", "FINANCE"] }, isActive: true } } } } },
  });

  const byOrg = new Map<string, typeof dueItems>();
  for (const item of dueItems) {
    const list = byOrg.get(item.orgId) ?? [];
    list.push(item);
    byOrg.set(item.orgId, list);
  }

  let emailsSent = 0;

  for (const [orgId, items] of byOrg) {
    const org = items[0].org;
    const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
    const isOverdue = items.some((i) => i.status === "OVERDUE");
    const earliestDue = items.reduce((min, i) => (i.dueDate < min ? i.dueDate : min), items[0].dueDate);

    for (const recipient of org.users) {
      await sendPaymentReminderEmail({
        to: recipient.email,
        name: recipient.name ?? undefined,
        orgName: org.name,
        items: items.map((i) => ({ name: i.service.name, amount: Number(i.amount).toFixed(2) })),
        total: total.toFixed(2),
        dueDate: earliestDue.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        isOverdue,
        payUrl: `${process.env.WEB_APP_URL}/${org.slug}/dashboard`,
      });
      emailsSent++;
    }

    await prisma.paymentRequest.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { remindersSent: { increment: 1 }, lastReminderAt: now },
    });
  }

  console.log(`[paymentReminders] sent ${emailsSent} emails across ${byOrg.size} orgs`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  sendPaymentReminders().then(() => process.exit(0));
}
