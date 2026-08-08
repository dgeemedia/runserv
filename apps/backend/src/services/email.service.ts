// apps/backend/src/services/email.service.ts
import SibApiV3Sdk from "sib-api-v3-sdk";

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY!;

const txEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const SENDER = {
  email: process.env.BREVO_SENDER_EMAIL!,
  name: process.env.BREVO_SENDER_NAME || "RunServer",
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
        <img src="${logoUrl}" alt="RunServer" height="24" style="height:24px; width:auto; display:block;" />
      </div>
      <div style="padding:32px;">
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px; background:#fafafa; font-size:12px; color:#999;">
        RunServer &middot; Infrastructure billing, handled.
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
      RunServer dashboard, where you can view and pay infrastructure invoices.
    </p>
    <a href="${params.inviteUrl}"
       style="display:inline-block; margin-top:16px; background:#E8A33D; color:#141414;
              padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">
      Set your password
    </a>
    <p style="color:#999; font-size:12px; margin-top:20px;">
      This link expires in 48 hours. If you weren't expecting this, you can ignore this email.
    </p>
  `);

  return send({ to: { email: params.to, name: params.name }, subject: `You're invited to ${params.orgName} on RunServer`, html });
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
       style="display:inline-block; background:#E8A33D; color:#141414;
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
      We got a request to reset the password on your RunServer account.
      If this wasn't you, you can safely ignore this email — your password won't change.
    </p>
    <a href="${params.resetUrl}"
       style="display:inline-block; margin-top:16px; background:#E8A33D; color:#141414;
              padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">
      Reset password
    </a>
    <p style="color:#999; font-size:12px; margin-top:20px;">
      This link expires in 1 hour.
    </p>
  `);

  return send({ to: { email: params.to, name: params.name }, subject: "Reset your RunServer password", html });
}

// ------------------------------------------------------------------
// 3. Receipt — sent immediately after a successful payment
// ------------------------------------------------------------------
export async function sendReceiptEmail(params: {
  to: string;
  name?: string;
  orgName: string;
  receiptNumber: string;
  items: { name: string; amount: string }[];
  total: string;
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
    <p style="font-size:18px; font-weight:700; margin:0 0 4px;">Total paid: $${params.total} USD</p>
    ${params.cardLast4 ? `<p style="color:#999; font-size:13px;">Charged to card ending ${params.cardLast4}</p>` : ""}
    <p style="color:#555; margin-top:20px;">Thanks for keeping ${params.orgName}'s infrastructure running.</p>
  `);

  return send({ to: { email: params.to, name: params.name }, subject: `Receipt #${params.receiptNumber} — $${params.total} paid`, html });
}
