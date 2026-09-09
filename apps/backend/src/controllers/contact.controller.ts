// apps/backend/src/controllers/contact.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AdminRequest } from "../middleware/admin.middleware.js";
import { sendContactEnquiryEmail } from "../services/email.service.js";

const TOPICS = ["General enquiry", "Agency sign-up", "Support", "Partnership / press"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------
// POST /contact
// Public — the marketing site's contact form. No auth: anyone can hit
// this, so treat everything in the body as untrusted. Rate-limited at
// the app level (see server.ts) since this has no other abuse guard.
// ------------------------------------------------------------------
export async function submitContactEnquiry(req: Request, res: Response) {
  const { name, email, company, topic, message, hp_website } = req.body ?? {};

  // Honeypot — a real visitor never sees or fills this field (hidden via
  // CSS on the frontend). A bot filling every field usually fills it too.
  // Report success without actually sending anything, so the bot doesn't
  // learn its submission was rejected and try to adapt.
  if (hp_website) {
    return res.json({ ok: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (typeof message !== "string" || message.trim().length < 10) {
    return res.status(400).json({ error: "Message is too short." });
  }

  const safeTopic = typeof topic === "string" && TOPICS.includes(topic) ? topic : TOPICS[0];

  const enquiry = await prisma.contactEnquiry.create({
    data: {
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      company: company ? String(company).slice(0, 200) : null,
      topic: safeTopic,
      message: String(message).slice(0, 5000),
    },
  });

  // The enquiry is safely stored either way — don't fail the request
  // just because the notification email had a hiccup. Whoever's
  // checking /admin/platform/contact-enquiries still sees it.
  try {
    await sendContactEnquiryEmail({
      name: enquiry.name,
      email: enquiry.email,
      company: enquiry.company ?? undefined,
      topic: enquiry.topic,
      message: enquiry.message,
    });
  } catch (err) {
    console.error("[contact] Failed to send notification email:", err);
  }

  return res.json({ ok: true });
}

// ------------------------------------------------------------------
// GET /admin/platform/contact-enquiries
// Platform (RunServ staff) only — these are leads for RunServ itself,
// not scoped to any tenant/agency, so no tenant admin should see them.
// ------------------------------------------------------------------
export async function listContactEnquiries(req: AdminRequest, res: Response) {
  const enquiries = await prisma.contactEnquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return res.json({ enquiries });
}

// ------------------------------------------------------------------
// PATCH /admin/platform/contact-enquiries/:id
// Toggle the handled flag once someone's followed up — lets the list
// double as a lightweight inbox instead of a write-only log.
// ------------------------------------------------------------------
export async function updateContactEnquiry(req: AdminRequest, res: Response) {
  const { id } = req.params;
  const { handled } = req.body ?? {};

  const enquiry = await prisma.contactEnquiry.update({
    where: { id },
    data: { handled: Boolean(handled) },
  });

  return res.json({ enquiry });
}
