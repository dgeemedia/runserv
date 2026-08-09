// apps/backend/src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import authRoutes from "./routes/auth.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import orgRoutes from "./routes/org.routes.js";
import internalRoutes from "./routes/internal.routes.js";
import { generatePaymentRequests } from "./jobs/generatePaymentRequests.job.js";
import { sendPaymentReminders } from "./jobs/paymentReminders.job.js";

const app = express();

// Always allow local dev origins, regardless of what WEB_APP_URL is set
// to — this matters right now specifically because no domain exists yet,
// so WEB_APP_URL is a placeholder that will never match localhost, and
// login would otherwise fail in every local/dev environment until a real
// domain is deployed. WEB_APP_URL itself is still respected for prod.
const allowedOrigins = [
  process.env.WEB_APP_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin header (curl, Postman, server-to-server) — allow.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Capture the raw body alongside JSON parsing — Paystack's webhook
// signature is computed over the exact raw bytes, so we can't rely
// on Express's already-parsed object.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  })
);

// Basic abuse protection on auth endpoints
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Too many attempts, try again later" } });
app.use("/auth/login", loginLimiter);
app.use("/admin/auth/login", loginLimiter);
app.use("/auth/forgot-password", rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: "Too many attempts, try again later" } }));
app.use("/internal/jobs", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many attempts, try again later" } }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(authRoutes);
app.use(paymentsRoutes);
app.use(adminRoutes);
app.use(orgRoutes);
app.use(internalRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RunServ API listening on :${PORT}`));

// ------------------------------------------------------------------
// Scheduled jobs. In production on Render, these run as separate
// Render Cron Job services (see render.yaml) hitting the standalone
// scripts directly — that's more reliable than an in-process timer,
// which would silently stop firing on redeploys/restarts and would
// double-fire if the service ever scales to more than one instance.
// This in-process fallback stays available for local dev, gated
// behind ENABLE_INPROCESS_CRON so it's off by default in deployment.
// ------------------------------------------------------------------
if (process.env.ENABLE_INPROCESS_CRON === "true") {
  cron.schedule("0 6 * * *", () => generatePaymentRequests().catch(console.error)); // 6am daily
  cron.schedule("0 9 * * *", () => sendPaymentReminders().catch(console.error)); // 9am daily
  console.log("In-process cron enabled (dev mode) — disable via ENABLE_INPROCESS_CRON in production.");
}
