// apps/backend/src/routes/internal.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { generatePaymentRequests } from "../jobs/generatePaymentRequests.job.js";
import { sendPaymentReminders } from "../jobs/paymentReminders.job.js";
import { handleInboundEmail } from "../controllers/inbound.controller.js";

const router = Router();
const upload = multer(); // memory storage — only reading text fields, no attachments kept

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

// upload.none() parses SendGrid's multipart/form-data body into
// req.body as plain string fields (from/to/subject/text/...).
router.post("/webhooks/email/inbound", upload.none(), handleInboundEmail);

export default router;
