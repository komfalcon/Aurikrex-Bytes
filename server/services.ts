import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";

function mailTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  // Mailgun signs mail for verified domains at the relay. The optional Nodemailer
  // DKIM hook below is disabled unless all three provider-specific variables are
  // deliberately supplied for a future SMTP provider; none are required for Mailgun.
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    dkim:
      process.env.SMTP_DKIM_PRIVATE_KEY &&
      process.env.SMTP_DKIM_DOMAIN &&
      process.env.SMTP_DKIM_SELECTOR
        ? {
            domainName: process.env.SMTP_DKIM_DOMAIN,
            keySelector: process.env.SMTP_DKIM_SELECTOR,
            privateKey: process.env.SMTP_DKIM_PRIVATE_KEY,
          }
        : undefined,
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromAddress?: string
) {
  const transport = mailTransport();
  if (!transport) {
    console.info(`[Email placeholder] ${subject} for ${to}`);
    return;
  }
  const from = fromAddress || process.env.SMTP_FROM || "info@aurikrex.tech";
  await transport.sendMail({ from, to, subject, html });
}

export async function sendAuthEmail(to: string, subject: string, html: string) {
  await sendEmail(
    to,
    subject,
    html,
    process.env.SMTP_FROM || "info@aurikrex.tech"
  );
}
export function verificationEmailHtml(url: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f3ef;color:#172033;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:42px 20px"><div style="background:#fff;border:1px solid #e3e4e8;border-radius:18px;overflow:hidden"><div style="padding:28px 34px;border-bottom:1px solid #ececf0"><div style="font-family:Georgia,serif;font-size:24px;color:#172033">Aurikrex <strong style="color:#2f67d8">Bytes</strong></div></div><div style="padding:44px 34px 38px"><div style="color:#2f67d8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">A considered daily read</div><h1 style="font-family:Georgia,serif;font-size:36px;line-height:1.1;font-weight:normal;margin:14px 0 16px">You're almost ready for your daily briefing.</h1><p style="font-size:16px;line-height:1.7;color:#626b7c;margin:0 0 26px">Confirm your email to start receiving Aurikrex Bytes — a daily tech briefing with the context behind what matters.</p><a href="${url}" style="display:inline-block;background:#2f67d8;color:#fff;text-decoration:none;border-radius:8px;padding:15px 24px;font-size:15px;font-weight:bold">Verify Email &nbsp;→</a><p style="font-size:12px;line-height:1.6;color:#8991a0;margin:28px 0 0">This link expires in 24 hours. If you didn't create an Aurikrex Bytes account, you can safely ignore this email.</p></div><div style="padding:22px 34px;background:#f8f8f6;border-top:1px solid #ececf0;color:#737b89;font-size:12px;line-height:1.6">Aurikrex Bytes — what matters in tech.<br />Need a hand? <a href="mailto:info@aurikrex.tech" style="color:#2f67d8">info@aurikrex.tech</a></div></div></div></body></html>`;
}

export async function sendSupportEmail(
  to: string,
  subject: string,
  html: string
) {
  await sendEmail(
    to,
    subject,
    html,
    process.env.SMTP_FROM_SUPPORT || "support@aurikrex.tech"
  );
}

export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function getCloudinaryUploadSignature(folder = "aurikrex/posts") {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET || ""
  );
  return {
    timestamp,
    folder,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  };
}
