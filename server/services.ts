import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";

function mailTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    dkim: process.env.SMTP_DKIM_PRIVATE_KEY && process.env.SMTP_DKIM_DOMAIN && process.env.SMTP_DKIM_SELECTOR
      ? { domainName: process.env.SMTP_DKIM_DOMAIN, keySelector: process.env.SMTP_DKIM_SELECTOR, privateKey: process.env.SMTP_DKIM_PRIVATE_KEY }
      : undefined,
  });
}

export async function sendEmail(to: string, subject: string, html: string, fromAddress?: string) {
  const transport = mailTransport();
  if (!transport) {
    console.info(`[Email placeholder] ${subject} for ${to}`);
    return;
  }
  const from = fromAddress || process.env.SMTP_FROM || "info@aurikrex.tech";
  await transport.sendMail({ from, to, subject, html });
}

export async function sendAuthEmail(to: string, subject: string, html: string) {
  await sendEmail(to, subject, html, process.env.SMTP_FROM || "info@aurikrex.tech");
}

export async function sendSupportEmail(to: string, subject: string, html: string) {
  await sendEmail(to, subject, html, process.env.SMTP_FROM_SUPPORT || "support@aurikrex.tech");
}

export function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export function getCloudinaryUploadSignature(folder = "aurikrex/posts") {
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET || "");
  return { timestamp, folder, signature, apiKey: process.env.CLOUDINARY_API_KEY || "", cloudName: process.env.CLOUDINARY_CLOUD_NAME || "" };
}
