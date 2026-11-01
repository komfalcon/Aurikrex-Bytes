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
  fromAddress?: string,
  headers?: Record<string, string>
) {
  const defaultFrom =
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||
    "Aurikrex Bytes <info@aurikrex.com>";
  const from = fromAddress || defaultFrom;

  // 1. Resend API (Primary)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          ...(headers ? { headers } : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Resend API Error] Status ${response.status}: ${errorText}`
        );
        throw new Error(`Resend error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Resend Email Sent] ID: ${data?.id} to ${to}`);
      return data;
    } catch (err) {
      console.error(
        "[Resend API Delivery Failure]",
        err instanceof Error ? err.message : String(err)
      );
      // Fall through to SMTP if configured
    }
  }

  // 2. SMTP Fallback
  const transport = mailTransport();
  if (transport) {
    await transport.sendMail({ from, to, subject, html, headers });
    return;
  }

  console.info(`[Email placeholder] ${subject} for ${to}`);
}

export async function sendAuthEmail(to: string, subject: string, html: string) {
  await sendEmail(
    to,
    subject,
    html,
    process.env.RESEND_FROM || process.env.SMTP_FROM || "Aurikrex Bytes <info@aurikrex.com>"
  );
}

export function verificationEmailHtml(url: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f3ef;color:#172033;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:42px 20px"><div style="background:#fff;border:1px solid #e3e4e8;border-radius:18px;overflow:hidden"><div style="padding:28px 34px;border-bottom:1px solid #ececf0"><div style="font-family:Georgia,serif;font-size:24px;color:#172033">Aurikrex <strong style="color:#2f67d8">Bytes</strong></div></div><div style="padding:44px 34px 38px"><div style="color:#2f67d8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">A considered daily read</div><h1 style="font-family:Georgia,serif;font-size:36px;line-height:1.1;font-weight:normal;margin:14px 0 16px">You're almost ready for your daily briefing.</h1><p style="font-size:16px;line-height:1.7;color:#626b7c;margin:0 0 26px">Confirm your email to start receiving Aurikrex Bytes — a daily tech briefing with the context behind what matters.</p><a href="${url}" style="display:inline-block;background:#2f67d8;color:#fff;text-decoration:none;border-radius:8px;padding:15px 24px;font-size:15px;font-weight:bold">Verify Email &nbsp;→</a><p style="font-size:12px;line-height:1.6;color:#8991a0;margin:28px 0 0">This link expires in 24 hours. If you didn't create an Aurikrex Bytes account, you can safely ignore this email.</p></div><div style="padding:22px 34px;background:#f8f8f6;border-top:1px solid #ececf0;color:#737b89;font-size:12px;line-height:1.6">Aurikrex Bytes — what matters in tech.<br />Need a hand? <a href="mailto:support@aurikrex.com" style="color:#2f67d8">support@aurikrex.com</a></div></div></div></body></html>`;
}

export function resetPasswordEmailHtml(url: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f3ef;color:#172033;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:42px 20px"><div style="background:#fff;border:1px solid #e3e4e8;border-radius:18px;overflow:hidden"><div style="padding:28px 34px;border-bottom:1px solid #ececf0"><div style="font-family:Georgia,serif;font-size:24px;color:#172033">Aurikrex <strong style="color:#2f67d8">Bytes</strong></div></div><div style="padding:44px 34px 38px"><div style="color:#2f67d8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Account Security</div><h1 style="font-family:Georgia,serif;font-size:36px;line-height:1.1;font-weight:normal;margin:14px 0 16px">Reset your password.</h1><p style="font-size:16px;line-height:1.7;color:#626b7c;margin:0 0 26px">We received a request to reset the password for your Aurikrex Bytes account. Click the button below to choose a new password.</p><a href="${url}" style="display:inline-block;background:#2f67d8;color:#fff;text-decoration:none;border-radius:8px;padding:15px 24px;font-size:15px;font-weight:bold">Reset Password &nbsp;→</a><p style="font-size:12px;line-height:1.6;color:#8991a0;margin:28px 0 0">This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email.</p></div><div style="padding:22px 34px;background:#f8f8f6;border-top:1px solid #ececf0;color:#737b89;font-size:12px;line-height:1.6">Aurikrex Bytes — what matters in tech.<br />Need a hand? <a href="mailto:support@aurikrex.com" style="color:#2f67d8">support@aurikrex.com</a></div></div></div></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Extracts a crisp one-line "Why it matters" summary from a post's explicit whyItMatters field
 * or from Paragraph 2 (The Why It Matters section) of its 3-paragraph editorial body.
 */
export function extractWhyItMattersLine(post: {
  body: string;
  whyItMatters?: string | null;
}): string {
  if (post.whyItMatters && post.whyItMatters.trim().length > 10) {
    const clean = post.whyItMatters.replace(/\*\*|__|\*|_/g, "").trim();
    return clean.length > 175 ? `${clean.slice(0, 172).trim()}…` : clean;
  }

  const paragraphs = (post.body || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map(p => p.replace(/\*\*|__|\*|_/g, "").trim())
    .filter(Boolean);

  // Paragraph 2 in aiCurator is "Why It Matters"; fall back to Paragraph 1
  const target = paragraphs[1] || paragraphs[0] || "";
  const firstSentenceMatch = target.match(/^(.+?[.!?])(?:\s|$)/);
  const line = firstSentenceMatch ? firstSentenceMatch[1].trim() : target;
  return line.length > 175 ? `${line.slice(0, 172).trim()}…` : line;
}

export interface DigestPostItem {
  id: number;
  headline: string;
  body: string;
  category?: string | null;
  sourcePublisher?: string | null;
  whyItMatters?: string | null;
  isEditorPick?: boolean | null;
}

export function dailyDigestEmailHtml(params: {
  editionDate: string;
  posts: DigestPostItem[];
  readerName?: string;
  unsubscribeUrl: string;
  baseUrl?: string;
}) {
  const baseUrl = (params.baseUrl || process.env.APP_BASE_URL || "https://www.bytes.aurikrex.com").replace(/\/$/, "");
  const items = params.posts.slice(0, 10);
  const greetingName = params.readerName ? `, ${escapeHtml(params.readerName)}` : "";

  const storiesMarkup = items
    .map((post, index) => {
      const whyLine = escapeHtml(extractWhyItMattersLine(post));
      const cat = escapeHtml(post.category || "Tech");
      const pub = post.sourcePublisher ? ` &middot; ${escapeHtml(post.sourcePublisher)}` : "";
      const leadBadge =
        index === 0 || post.isEditorPick
          ? `<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:999px;margin-right:6px;">Lead Pick</span>`
          : "";
      const storyUrl = `${baseUrl}/post/${post.id}`;

      return `<div style="padding:18px 0;border-bottom:1px solid #ececf0;">
        <div style="margin-bottom:6px;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">
          ${leadBadge}<span>${cat}${pub}</span>
        </div>
        <h2 style="font-family:Georgia,serif;font-size:19px;line-height:1.3;margin:0 0 8px;font-weight:normal;">
          <a href="${storyUrl}" style="color:#0f172a;text-decoration:none;">${escapeHtml(post.headline)}</a>
        </h2>
        <p style="font-size:14px;line-height:1.55;color:#475569;margin:0 0 10px;">
          <strong style="color:#1e293b;">Why it matters:</strong> ${whyLine}
        </p>
        <a href="${storyUrl}" style="font-size:13px;font-weight:600;color:#2f67d8;text-decoration:none;">Read full brief &rarr;</a>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f3ef;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e3e4e8;border-radius:18px;overflow:hidden;">
      <div style="padding:24px 30px;border-bottom:1px solid #ececf0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-family:Georgia,serif;font-size:22px;color:#172033;">
          Aurikrex <strong style="color:#2f67d8;">Bytes</strong>
        </div>
        <div style="font-size:12px;color:#64748b;font-weight:600;">8:00 AM WAT Edition &middot; ${escapeHtml(params.editionDate)}</div>
      </div>
      <div style="padding:32px 30px 28px;">
        <div style="color:#2f67d8;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">
          Today&rsquo;s Finite Tech Drop (${items.length} ${items.length === 1 ? "Byte" : "Bytes"})
        </div>
        <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.18;font-weight:normal;margin:10px 0 8px;color:#0f172a;">
          Good morning${greetingName}. Here is what matters today.
        </h1>
        <p style="font-size:14px;line-height:1.6;color:#64748b;margin:0 0 18px;">
          Five quiet minutes of high-signal tech context. Open your desk to complete today&rsquo;s reading streak.
        </p>
        ${storiesMarkup}
        <div style="margin-top:26px;text-align:center;">
          <a href="${baseUrl}/dashboard" style="display:inline-block;background:#2f67d8;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 26px;font-size:15px;font-weight:700;">
            Open Today&rsquo;s Reading Desk &rarr;
          </a>
        </div>
      </div>
      <div style="padding:20px 30px;background:#f8f8f6;border-top:1px solid #ececf0;color:#737b89;font-size:12px;line-height:1.6;">
        Aurikrex Bytes &mdash; A calmer way to keep up.<br />
        Prefer web push only? <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#2f67d8;text-decoration:underline;">Unsubscribe from the 8:00 AM email briefing</a> or manage preferences in your <a href="${baseUrl}/profile" style="color:#2f67d8;text-decoration:underline;">reader profile</a>.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendMorningEmailDigest(
  editionDate: string,
  editionPosts: DigestPostItem[],
  options?: { force?: boolean }
): Promise<{ sentCount: number; skipped?: boolean }> {
  if (!editionPosts.length) {
    return { sentCount: 0, skipped: true };
  }

  const {
    getSystemSetting,
    setSystemSetting,
    listEmailDigestRecipients,
  } = await import("./db.js");

  const ledgerKey = `email_digest_sent_${editionDate}`;
  if (!options?.force) {
    const alreadySent = await getSystemSetting(ledgerKey);
    if (alreadySent === "true") {
      return { sentCount: 0, skipped: true };
    }
  }

  const recipients = await listEmailDigestRecipients();
  if (!recipients.length) {
    await setSystemSetting(ledgerKey, "true");
    return { sentCount: 0 };
  }

  const baseUrl = (process.env.APP_BASE_URL || "https://www.bytes.aurikrex.com").replace(/\/$/, "");
  const leadHeadline = editionPosts[0]?.headline || "Today's Tech Briefing";
  const subject = `☕ ${leadHeadline} (+${Math.max(0, editionPosts.length - 1)} more in today's Bytes)`;

  let sentCount = 0;
  for (const recipient of recipients) {
    const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(recipient.unsubscribeToken)}`;
    const html = dailyDigestEmailHtml({
      editionDate,
      posts: editionPosts,
      readerName: recipient.name,
      unsubscribeUrl,
      baseUrl,
    });
    try {
      await sendEmail(recipient.email, subject, html, undefined, {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
      });
      sentCount++;
    } catch (err) {
      console.warn(`[EmailDigest] Failed sending to ${recipient.email}:`, err);
    }
  }

  await setSystemSetting(ledgerKey, "true");
  return { sentCount };
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
    process.env.RESEND_FROM_SUPPORT ||
      process.env.SMTP_FROM_SUPPORT ||
      "Aurikrex Bytes Support <support@aurikrex.com>"
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
