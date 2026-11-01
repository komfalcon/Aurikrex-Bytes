# Aurikrex Bytes: External Scheduler Trigger Setup

This guide provides step-by-step instructions to configure external schedulers for Aurikrex Bytes daily push notifications:
- **Primary Scheduler:** [cron-job.org](https://cron-job.org) (High precision, free)
- **Secondary Backup:** Cloudflare Worker cron trigger (Serverless edge, retries on failure)

Due to atomic idempotency guards in the Aurikrex Bytes notification ledger (`push_sends`), duplicate triggers across schedulers within the same window are completely harmless—only the first arriving request claims and dispatches the notification.

---

## 1. Primary Scheduler: cron-job.org

Set up two scheduled jobs on [cron-job.org](https://cron-job.org):
1. **Morning Briefing:** `07:00 UTC` (08:00 AM WAT)
2. **Evening Recap:** `21:00 UTC` (10:00 PM WAT)

### Job 1: Morning Briefing (08:00 AM WAT)
1. Log in to [cron-job.org](https://cron-job.org) and click **"Create Cronjob"**.
2. **Title:** `Aurikrex Bytes - Morning Push (08:00 WAT)`
3. **URL:** `https://<YOUR_APP_DOMAIN>/api/cron/notify?slot=morning`  
   *(e.g., `https://www.bytes.aurikrex.com/api/cron/notify?slot=morning`)*
4. **Schedule:**
   - Set execution interval: **User-defined / Cron expression**.
   - Schedule: `Every day at 07:00 UTC` (or cron expression `0 7 * * *`).
   - Time zone: `UTC`.
5. **Request Method:** `GET`
6. **Headers:** Under **Advanced** -> **Headers**, add:
   - `Authorization`: `Bearer <YOUR_CRON_SECRET>`
   - `X-Trigger-Source`: `cron-job-org`
   - `Accept`: `application/json`
7. **Failure Notifications:**
   - Enable **"Send notification email on execution failure"**.
   - Set threshold to: *Notify after 1 consecutive failure*.
8. Click **"Save"** or **"Create Cronjob"**.

### Job 2: Evening Recap (10:00 PM WAT)
1. Click **"Create Cronjob"**.
2. **Title:** `Aurikrex Bytes - Evening Push (10:00 WAT)`
3. **URL:** `https://<YOUR_APP_DOMAIN>/api/cron/notify?slot=evening`  
   *(e.g., `https://www.bytes.aurikrex.com/api/cron/notify?slot=evening`)*
4. **Schedule:**
   - Schedule: `Every day at 21:00 UTC` (or cron expression `0 21 * * *`).
   - Time zone: `UTC`.
5. **Request Method:** `GET`
6. **Headers:**
   - `Authorization`: `Bearer <YOUR_CRON_SECRET>`
   - `X-Trigger-Source`: `cron-job-org`
   - `Accept`: `application/json`
7. **Failure Notifications:**
   - Enable **"Send notification email on execution failure"**.
8. Click **"Save"** or **"Create Cronjob"**.

---

## 2. Secondary Backup: Cloudflare Worker

The Cloudflare Worker in `ops/cloudflare-notify-trigger` executes cron triggers at `07:02 UTC` and `21:02 UTC` (2 minutes past target hour) as a zero-cost redundant fallback. If the primary job already dispatched, the Worker safely receives `{ status: "already_done" }`.

### Prerequisites
- Node.js 18+ and `npm` installed.
- Cloudflare account.

### Click-by-Click Deployment

1. Navigate to the Worker directory:
   ```bash
   cd ops/cloudflare-notify-trigger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Authenticate Wrangler with your Cloudflare account (if not already logged in):
   ```bash
   npx wrangler login
   ```

4. Store your secret key securely in Cloudflare:
   ```bash
   npx wrangler secret put CRON_SECRET
   ```
   *When prompted, paste your production `CRON_SECRET` value and press Enter.*

5. (Optional) If using a custom domain or staging URL, set `NOTIFY_URL`:
   ```bash
   npx wrangler secret put NOTIFY_URL
   ```
   *Paste `https://<YOUR_APP_DOMAIN>/api/cron/notify` (default is `https://www.bytes.aurikrex.com/api/cron/notify`).*

6. Deploy the Worker:
   ```bash
   npx wrangler deploy
   ```

7. Verify cron triggers in the Cloudflare Dashboard:
   - Go to **Cloudflare Dashboard** -> **Workers & Pages** -> **aurikrex-notify-trigger** -> **Settings** -> **Triggers**.
   - Confirm that the two cron triggers appear:
     - `2 7 * * *` (07:02 UTC)
     - `2 21 * * *` (21:02 UTC)
