# Resend Email Integration

Aurikrex Bytes sends transactional emails (Email verification, Password reset, Account alerts, Support) via the **Resend API** as the primary email provider, with automatic fallback to SMTP.

## Environment Variables

To activate Resend on Vercel or locally, set these variables in your environment:

```env
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM=Aurikrex Bytes <info@aurikrex.com>
RESEND_FROM_SUPPORT=Aurikrex Bytes Support <support@aurikrex.com>
```

## How It Works

1. **Primary Provider (Resend)**: When `RESEND_API_KEY` is present, emails are dispatched directly to `https://api.resend.com/emails` over HTTPS.
2. **Fallback Provider (SMTP)**: If `RESEND_API_KEY` is omitted or if Resend fails, the system falls back to `SMTP_HOST` / Nodemailer if configured.
3. **Domain Setup in Resend**:
   - Go to [Resend Dashboard > Domains](https://resend.com/domains).
   - Add `aurikrex.com`.
   - Copy the MX, SPF, and DKIM DNS records provided by Resend and add them to your DNS provider (Cloudflare, Namecheap, etc.).
