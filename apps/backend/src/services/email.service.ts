// apps/backend/src/services/email.service.ts
import SibApiV3Sdk from "sib-api-v3-sdk";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY!;

const txEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const SENDER = {
  email: process.env.BREVO_SENDER_EMAIL!,
  name: process.env.BREVO_SENDER_NAME || "RunServ",
};

interface SendArgs {
  to: { email: string; name?: string };
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendArgs) {
  return txEmailApi.sendTransacEmail({
    sender: SENDER,
    to: [to],
    subject,
    htmlContent: html,
  });
}

// ------------------------------------------------------------------
// Shared layout — keep emails plain and legible, matches the app's
// "ledger" tone rather than a marketing template.
// ------------------------------------------------------------------
function layout(bodyHtml: string) {
  const logoUrl = `${process.env.WEB_APP_URL}/logo/logo-mark-light.png`;
  return `
  <div style="font-family: 'IBM Plex Sans', Arial, sans-serif; background:#f5f5f5; padding:32px 0;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e5e5e5;">
      <div style="padding:20px 32px; border-bottom:1px solid #eee;">
        <img src="${logoUrl}" alt="RunServ" height="24" style="height:24px; width:auto; display:block;" />
      </div>
      <div style="padding:32px;">
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px; background:#fafafa; font-size:12px; color:#999;">
        RunServ &middot; Infrastructure billing, handled.
      </div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------
// 1. Invite email — sent when an owner adds a new user to their org
// ------------------------------------------------------------------
export async function sendInviteEmail(params: {
  to: string;
  name?: string;
  orgName: string;
  inviteUrl: string;
  role: string;
}) {
  const html = layout(`
    <h2 style="margin:0 0 12px;">You've been added to ${params.orgName}</h2>
    <p style="color:#555; line-height:1.6;">
      You now have <strong>${params.role.toLowerCase()}</strong> access to ${params.orgName}'s
      RunServ dashboard, where you can view and pay infrastructure invoices.
    </p>
    <a href="${params.inviteUrl}"
       style="display:inline-block; margin-top:16px; background:#169DE3; color:#FFFFFF;
              padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">
      Set your password
    </a>
    <p style="color:#999; font-size:12px; margin-top:20px;">
      This link expires in 48 hours. If you weren't expecting this, you can ignore this email.
    </p>
  `);

  return send({ to: { email: params.to, name: params.name }, subject: `You're invited to ${params.orgName} on RunServ`, html });
}

// ------------------------------------------------------------------
// 2. Payment reminder — sent by the cron job as due dates approach
//    or pass (overdue)
// ------------------------------------------------------------------
export async function sendPaymentReminderEmail(params: {
  to: string;
  name?: string;
  orgName: string;
  items: { name: string; amount: string }[];
  total: string;
  dueDate: string;
  isOverdue: boolean;
  payUrl: string;
}) {
  const rows = params.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0; color:#333; font-size:14px;">${i.name}</td>
        <td style="padding:8px 0; text-align:right; font-family:monospace; font-size:14px;">$${i.amount}</td>
      </tr>`
    )
    .join("");

  const html = layout(`
    <h2 style="margin:0 0 8px;">
      ${params.isOverdue ? "Payment overdue" : "Payment due soon"}
    </h2>
    <p style="color:#555; line-height:1.6;">
      ${params.isOverdue ? "The following is now overdue" : "The following is due"}
      for <strong>${params.orgName}</strong> on ${params.dueDate}.
    </p>
    <table style="width:100%; border-collapse:collapse; margin:20px 0; border-top:1px solid #eee; border-bottom:1px solid #eee;">
      ${rows}
    </table>
    <p style="font-size:18px; font-weight:700; margin:0 0 20px;">Total: $${params.total} USD</p>
    <a href="${params.payUrl}"
       style="display:inline-block; background:#169DE3; color:#FFFFFF;
              padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">
      Pay now
    </a>
  `);

  return send({
    to: { email: params.to, name: params.name },
    subject: params.isOverdue
      ? `Overdue: $${params.total} for ${params.orgName}`
      : `Payment due: $${params.total} for ${params.orgName}`,
    html,
  });
}

// ------------------------------------------------------------------
// 4. Password reset — sent when a user requests a forgot-password link
// ------------------------------------------------------------------
export async function sendPasswordResetEmail(params: { to: string; name?: string; resetUrl: string }) {
  const html = layout(`
    <h2 style="margin:0 0 12px;">Reset your password</h2>
    <p style="color:#555; line-height:1.6;">
      We got a request to reset the password on your RunServ account.
      If this wasn't you, you can safely ignore this email — your password won't change.
    </p>
    <a href="${params.resetUrl}"
       style="display:inline-block; margin-top:16px; background:#169DE3; color:#FFFFFF;
              padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">
      Reset password
    </a>
    <p style="color:#999; font-size:12px; margin-top:20px;">
      This link expires in 1 hour.
    </p>
  `);

  return send({ to: { email: params.to, name: params.name }, subject: "Reset your RunServ password", html });
}

// ------------------------------------------------------------------
// 3. Receipt — sent immediately after a successful payment
// ------------------------------------------------------------------
export async function sendReceiptEmail(params: {
  to: string;
  name?: string;
  orgName: string;
  receiptNumber: string;
  items: { name: string; amount: string }[]; // line items always shown in USD (canonical service pricing)
  total: string; // pre-formatted with currency, e.g. "254.50 NGN" or "254.50 USD" — caller decides, this just renders it
  paidAt: string;
  cardLast4?: string;
}) {
  const rows = params.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0; color:#333; font-size:14px;">${i.name}</td>
        <td style="padding:8px 0; text-align:right; font-family:monospace; font-size:14px;">$${i.amount}</td>
      </tr>`
    )
    .join("");

  const html = layout(`
    <h2 style="margin:0 0 4px;">Payment received</h2>
    <p style="color:#999; font-size:13px; margin:0 0 20px;">Receipt #${params.receiptNumber} &middot; ${params.paidAt}</p>
    <table style="width:100%; border-collapse:collapse; margin-bottom:16px; border-top:1px solid #eee; border-bottom:1px solid #eee;">
      ${rows}
    </table>
    <p style="font-size:18px; font-weight:700; margin:0 0 4px;">Total paid: ${params.total}</p>
    ${params.cardLast4 ? `<p style="color:#999; font-size:13px;">Charged to card ending ${params.cardLast4}</p>` : ""}
    <p style="color:#555; margin-top:20px;">Thanks for keeping ${params.orgName}'s infrastructure running.</p>
  `);

  return send({ to: { email: params.to, name: params.name }, subject: `Receipt #${params.receiptNumber} — ${params.total} paid`, html });
}

// ------------------------------------------------------------------
// 5. Test email — no business meaning, just confirms BREVO_API_KEY and
// sender-domain verification are actually working from the admin panel,
// without needing a real invite or payment to trigger a send.
// ------------------------------------------------------------------
export async function sendTestEmail(to: string) {
  const html = layout(`
    <h2 style="margin:0 0 12px;">Test email</h2>
    <p style="color:#555; line-height:1.6;">
      If you're reading this, RunServ's Brevo configuration is working —
      API key valid, sender domain verified, delivery successful.
    </p>
    <p style="color:#999; font-size:12px; margin-top:20px;">Sent from the admin panel, not triggered by any real activity.</p>
  `);

  return send({ to: { email: to }, subject: "RunServ — test email", html });
}

// ------------------------------------------------------------------
// 6. Custom message — free-text email from you to a client, sent from
// the admin dashboard. Body is authored as Markdown (bold, italics,
// links, lists), rendered to HTML server-side, and run through an
// allowlist sanitizer before being sent — the admin composing this is
// trusted, but the sanitizer stays regardless, since it also strips
// anything the markdown renderer itself might pass through unexpectedly
// (e.g. a raw <script> tag typed directly into the body).
// ------------------------------------------------------------------
const ALLOWED_TAGS = ["p", "br", "strong", "em", "a", "ul", "ol", "li", "blockquote", "code", "pre", "h3", "h4"];

export async function sendCustomMessageEmail(params: {
  to: string;
  name?: string;
  subject: string;
  body: string; // Markdown
}) {
  const rawHtml = marked.parse(params.body, { async: false, gfm: true, breaks: true }) as string;

  const safeHtml = sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    // Only allow http(s)/mailto links — blocks javascript:, data:, etc.
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // Inline styling per tag, since email clients ignore <style> blocks
      // unpredictably — safer to style each element directly.
      p: sanitizeHtml.simpleTransform("p", { style: "color:#333; line-height:1.6; margin:0 0 14px;" }),
      a: sanitizeHtml.simpleTransform("a", { style: "color:#0B6FAE; text-decoration:underline;" }),
      strong: sanitizeHtml.simpleTransform("strong", { style: "font-weight:700;" }),
      ul: sanitizeHtml.simpleTransform("ul", { style: "margin:0 0 14px; padding-left:22px; color:#333;" }),
      ol: sanitizeHtml.simpleTransform("ol", { style: "margin:0 0 14px; padding-left:22px; color:#333;" }),
      li: sanitizeHtml.simpleTransform("li", { style: "margin-bottom:6px; line-height:1.6;" }),
      blockquote: sanitizeHtml.simpleTransform("blockquote", {
        style: "border-left:3px solid #169DE3; margin:0 0 14px; padding:2px 0 2px 14px; color:#555;",
      }),
      code: sanitizeHtml.simpleTransform("code", {
        style: "background:#f5f5f5; padding:2px 5px; border-radius:4px; font-family:monospace; font-size:13px;",
      }),
    },
  });

  const html = layout(`
    <h2 style="margin:0 0 16px;">${escapeHtml(params.subject)}</h2>
    ${safeHtml}
  `);

  return send({ to: { email: params.to, name: params.name }, subject: params.subject, html });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
