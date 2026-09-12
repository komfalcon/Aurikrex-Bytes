# Mailgun SMTP and DKIM

Aurikrex Bytes sends mail through Mailgun's SMTP relay using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_FROM_SUPPORT`. No `SMTP_DKIM_*` variables are required or expected for the Mailgun setup.

Mailgun applies DKIM signing at the relay for a verified sending domain. The application therefore leaves Nodemailer's optional self-signing hook disabled by default. The hook is retained only for a possible future provider migration and activates only when all three provider-specific variables are deliberately supplied: `SMTP_DKIM_DOMAIN`, `SMTP_DKIM_SELECTOR`, and `SMTP_DKIM_PRIVATE_KEY`. These variables should remain unset for Mailgun.

## Manual production check

Falcon should confirm in Mailgun's domain-verification view that `aurikrex.tech` reports DKIM as verified. This status is controlled by the DKIM DNS records already added in Cloudflare, not by application configuration. After DNS and domain verification are confirmed, send a real verification email and password-reset email and verify receipt.
