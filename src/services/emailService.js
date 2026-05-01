const nodemailer = require('nodemailer');

/**
 * Build a nodemailer transporter from environment variables.
 *
 * Supported names (first match wins):
 *   SMTP_HOST
 *   SMTP_PORT (default 587)
 *   SMTP_USER  or  SMTP_USERNAME
 *   SMTP_PASS  or  SMTP_PASSWORD  (Gmail app passwords may include spaces — we strip them)
 *   MAIL_FROM  or  EMAIL_FROM  (optional; falls back to SMTP user)
 *
 * If SMTP_HOST is missing the transporter is `null` and email sending is
 * silently skipped — the rest of the app keeps working in dev.
 */
let cachedTransporter;

function smtpUser() {
  return (process.env.SMTP_USER || process.env.SMTP_USERNAME || '').trim();
}

/** Gmail often displays app passwords with spaces; Nodemailer needs them removed. */
function smtpPass() {
  return String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');
}

function mailFrom() {
  const explicit = (process.env.MAIL_FROM || process.env.EMAIL_FROM || '').trim();
  if (explicit) return explicit;
  const u = smtpUser();
  return u ? `"Mess Manager" <${u}>` : undefined;
}

function getTransporter() {
  if (cachedTransporter !== undefined) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    cachedTransporter = null;
    return null;
  }

  const user = smtpUser();
  const pass = smtpPass();
  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cachedTransporter;
}

const MONTHS_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

/**
 * Build the HTML body of a monthly bill email for one member.
 * Pure function so it can also be reused for in-app preview / PDF later.
 */
function buildBillEmailHtml({ messName, monthLabel, bill, joinCode }) {
  const owesMess = bill.netBalance < 0;
  const statusColor = owesMess ? '#dc2626' : '#059669';
  const statusLabel = owesMess
    ? `দিতে হবে ৳ ${fmt(Math.abs(bill.netBalance))}`
    : `পাবেন ৳ ${fmt(bill.netBalance)}`;

  return `<!doctype html>
<html lang="bn">
<head><meta charset="utf-8"><title>মাসিক বিল</title></head>
<body style="margin:0;padding:0;background:#f4f1ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ff;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(124,58,237,0.12);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 100%);padding:32px 28px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">${messName || 'Mess Manager'}</div>
          <div style="font-size:24px;font-weight:800;margin-top:6px;">মাসিক বিল</div>
          <div style="font-size:14px;margin-top:2px;opacity:0.9;">${monthLabel}</div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-size:16px;color:#0f172a;">প্রিয় <strong>${escapeHtml(bill.user?.name || 'সদস্য')}</strong>,</div>
          <div style="font-size:14px;color:#475569;margin-top:6px;line-height:1.55;">
            ${monthLabel} মাসের আপনার সম্পূর্ণ বিলের হিসাব নিচে দেওয়া হলো।
          </div>
        </td></tr>

        <!-- Status pill -->
        <tr><td style="padding:18px 28px 4px;">
          <div style="display:inline-block;padding:10px 18px;border-radius:999px;background:${owesMess ? '#fef2f2' : '#ecfdf5'};color:${statusColor};font-weight:700;font-size:14px;border:1px solid ${owesMess ? '#fecaca' : '#a7f3d0'};">
            ${statusLabel}
          </div>
        </td></tr>

        <!-- Bill table -->
        <tr><td style="padding:18px 28px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid #ede9fe;border-radius:14px;overflow:hidden;">
            ${row('মোট মিল', `${bill.totalMeals || 0} টি`)}
            ${row('মিল রেট', `৳ ${fmt(bill.mealRate)}`)}
            ${row('খাদ্য বিল', `৳ ${fmt(bill.foodCost)}`, true)}
            ${bill.expensePaid > 0 ? row('আপনি বাজার দিয়েছেন', `৳ ${fmt(bill.expensePaid)}`) : ''}
            ${bill.advance > 0 ? row('অগ্রিম জমা', `৳ ${fmt(bill.advance)}`) : ''}
            <tr><td colspan="2" style="padding:14px 18px;background:${owesMess ? '#fef2f2' : '#ecfdf5'};border-top:2px solid ${owesMess ? '#fecaca' : '#a7f3d0'};">
              <table width="100%"><tr>
                <td style="font-weight:700;color:#0f172a;font-size:14px;">নেট ব্যালেন্স</td>
                <td align="right" style="font-weight:800;font-size:18px;color:${statusColor};">${statusLabel}</td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 28px 32px;">
          <div style="font-size:13px;color:#475569;line-height:1.6;">
            ${owesMess
              ? 'অনুগ্রহ করে নির্ধারিত সময়ের মধ্যে বিল পরিশোধ করুন।'
              : 'মেস আপনাকে এই পরিমাণ অর্থ ফেরত দেবে।'}
          </div>
          ${joinCode ? `<div style="margin-top:18px;font-size:12px;color:#94a3b8;">Mess Code: <strong style="color:#6d28d9;letter-spacing:0.18em;">${joinCode}</strong></div>` : ''}
          <div style="margin-top:18px;padding-top:18px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
            এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে — সরাসরি উত্তর দেবেন না।
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label, value, emphasized = false) {
  return `<tr>
    <td style="padding:12px 18px;font-size:13px;color:#64748b;border-bottom:1px solid #f5f3ff;">${escapeHtml(label)}</td>
    <td align="right" style="padding:12px 18px;font-size:14px;font-weight:${emphasized ? '700' : '600'};color:${emphasized ? '#6d28d9' : '#0f172a'};border-bottom:1px solid #f5f3ff;">${escapeHtml(value)}</td>
  </tr>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Send a single member's bill via email. Resolves to true on success,
 * false otherwise (transporter missing, no email, send error).
 */
async function sendBillEmail({ to, messName, month, year, bill, joinCode }) {
  if (!to) return false;
  const transporter = getTransporter();
  if (!transporter) return false;

  const monthLabel = `${MONTHS_BN[month - 1]} ${year}`;
  try {
    await transporter.sendMail({
      from: mailFrom() || smtpUser(),
      to,
      subject: `${monthLabel} — আপনার মাসিক বিল`,
      html: buildBillEmailHtml({ messName, monthLabel, bill, joinCode }),
    });
    return true;
  } catch (err) {
    console.error('[email] sendBillEmail failed:', err.message);
    return false;
  }
}

module.exports = { sendBillEmail, buildBillEmailHtml, MONTHS_BN };
