// apps/backend/src/routes/internal.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { generatePaymentRequests } from "../jobs/generatePaymentRequests.job.js";
import { sendPaymentReminders } from "../jobs/paymentReminders.job.js";

const router = Router();

/**
 * Render's free plan has no built-in scheduler (Cron Jobs require a
 * paid plan). Instead, these two endpoints let an external free
 * scheduler — Vercel's Cron Jobs, cron-job.org, GitHub Actions, etc. —
 * trigger the same job logic over HTTP on a schedule. Protected by a
 * shared secret so they can't be hit by anyone who finds the URL.
 */
function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.post("/internal/jobs/generate-payment-requests", requireCronSecret, async (_req, res) => {
  try {
    await generatePaymentRequests();
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[internal/jobs/generate-payment-requests]", err);
    return res.status(500).json({ error: err.message ?? "Job failed" });
  }
});

router.post("/internal/jobs/send-reminders", requireCronSecret, async (_req, res) => {
  try {
    await sendPaymentReminders();
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[internal/jobs/send-reminders]", err);
    return res.status(500).json({ error: err.message ?? "Job failed" });
  }
});

export default router;
