# ScanSay live: setup step by step

The full illustrated guide with a test checklist is the doc "ScanSay: Go live step by step". This file is the short version.

The site runs on GitHub + Vercel. When everything below is set up, these work for real on your domain:
- the website's application form
- admin approval, which creates the account and emails a login link
- customer login, forgotten password and setting a password
- QR codes that open the form
- one-time codes by email or SMS
- messages saved in the database
- alarms to email, SMS, Teams, Slack or your own system
- replies to the guest
- invites for colleagues
- published certificates
- card payment through Stripe (optional)

Locally and with `?demo=1` everything still runs on demo data.

## 1. Database: Supabase (about 10 minutes)
1. Create an account at supabase.com → **New project** → region **EU North (Stockholm)**. Pick a strong database password.
2. **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://scansay.se` (your domain).
   - **Redirect URLs**: add `https://scansay.se/app/`.
4. **Authentication → Sign In / Providers → Email**: turn off **Confirm email**. ScanSay sends its own invite.
5. **Project Settings → API Keys** → tab **Legacy API keys**: copy the `anon` key and the `service_role` key. Copy the Project URL too (`https://xxxx.supabase.co`). The new `sb_publishable_` and `sb_secret_` keys also work.
6. For GDPR deletion after 12 months: **Database → Extensions** → turn on `pg_cron`, then SQL Editor → New query → paste `supabase/retention.sql` → Run.
7. Sign Supabase's data processing agreement (DPA) under Settings → Legal.

## 2. Email: Brevo (EU)
1. Create an account at brevo.com.
2. Go to **Senders, Domains & Dedicated IPs** → add `scansay.se` → add the DNS records Brevo shows (SPF, DKIM, DMARC) at your domain registrar. Wait until they show as verified.
3. **SMTP & API** → create an API key.

## 3. SMS: 46elks (Sweden)
Create an account at 46elks.se, top up credit and copy the API username and password.

## 4. Environment variables in Vercel
Project → Settings → Environment Variables. Add the following, then go to **Deployments → ⋯ → Redeploy**.

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL from Supabase |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_KEY` | service_role key (keep it secret) |
| `ADMIN_TOKEN` | Your admin password: a long random string, e.g. `openssl rand -hex 24` |
| `SIGN_SECRET` | Random string, e.g. `openssl rand -hex 32` |
| `OTP_SECRET` | Random string, e.g. `openssl rand -hex 32` |
| `BREVO_API_KEY` | From Brevo |
| `MAIL_FROM` | `ScanSay <hello@scansay.se>` |
| `ELKS_USER`, `ELKS_PASS` | From 46elks |
| `SMS_FROM` | `ScanSay` (max 11 characters) |
| `NOTIFY_EMAIL` | `hello@scansay.se`. New applications and signed contracts are sent here. |
| `SITE_URL` | `https://scansay.se` |
| `STRIPE_SECRET_KEY` | (optional) `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | (optional) `whsec_...` |

Card payments with Stripe (optional):
1. In Stripe, go to Developers → Webhooks → **Add endpoint** `https://scansay.se/api/stripe`.
2. Select these events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

## 5. Test it before the first customer (15 minutes)
1. Go to `https://scansay.se/admin/` and log in with `ADMIN_TOKEN`.
2. Settings → **Företagsuppgifter i avtalet**: fill in org.nr, address and bankgiro.
3. On the website: apply with your own email.
4. In admin: **Ansökningar** → open → **Godkänn och skapa konto**. An invite arrives by email.
5. Open the email → choose a password → the dashboard opens.
6. **QR-koder**: add a place → **Testa koden i formuläret** → send a message → you receive a code → enter it.
7. The message shows up in **Inkorg** and you receive an alarm email. Reply → the reply arrives at your email.
8. **Larm**: add Teams (instructions are on the page) → **Spara och testa**.
9. Log out → **Glömt lösenord?** → you receive a link.

## 6. Good to know
- **Admin** keeps its working data (invoices, notes, team) in the database (`admin_state`). Real effects (create, lock, delete accounts, modules) go through `/api/admin`.
- **Locking an account** in admin means nobody at the customer can log in, and the QR codes show "Tillfälligt pausad" (temporarily paused).
- **Staff module**: when you turn it off in admin, the Personal tab disappears for the customer. The staff page itself (`staff/`), where employees check in, is not connected to the database yet. Keep the module off until it is.
- **WhatsApp groups** cannot receive messages from other systems (WhatsApp does not allow it). Use SMS or Teams.
- **The chat between colleagues** in the dashboard is hidden on the live site. Customers contact you at hello@scansay.se or through the chat bot on the website.
- The demo account: `https://scansay.se/app/?demo=1`.

## 7. Legal (before you charge)
- The following are templates in Swedish:
  - the contract (`legal/contract.js`)
  - the terms (`legal/villkor.html`)
  - the data processing agreement (`legal/pub-avtal.html`)
  - the privacy policy (on the website)
  - DPIA, ROPA and MBL (`admin/docs/`)
- **Have a Swedish lawyer review them** and fill in everything in [brackets].
- Register the company and enter its org.nr everywhere.
- Sign data processing agreements with Supabase, Brevo, 46elks, Vercel and Stripe. All offer standard agreements.
- Keep the signed-contract emails. They are your evidence if a card payment is disputed. A copy is also saved in the database (`signatures`).

## 8. The app on the phone (notifications)
The dashboard can be installed as an app on phones and computers, and every user can turn on notifications for their own device.

**One-time setup:**
1. In Supabase → SQL Editor → New query, paste all of `supabase/update-3.sql` and click Run. This creates the `push_subs` table.
2. Upload the new files to GitHub as usual. Nothing else has to be set: the notification key is made from `SIGN_SECRET`.
   - Optional: set your own key with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:hello@scansay.se`).
   - If you later change `SIGN_SECRET` (or the VAPID key), every device has to turn notifications on again.

**What each staff member does (tell your customers this):**
- **Android (Chrome):** log in at scansay.se → menu ⋮ → *Install app*. Open ScanSay from the home screen → **Larm** → *ScanSay i mobilen* → **Slå på notiser** → *Allow*.
- **iPhone (iOS 16.4 or later):** open scansay.se in **Safari** → Share button → *Add to Home Screen*. Open ScanSay from the home screen, log in → **Larm** → **Slå på notiser** → *Allow*. (iPhone only allows notifications from apps on the home screen.)
- **Computer:** Chrome or Edge → the install icon in the address bar, or just turn on notifications on the Larm page.

**How it works:**
- Each device chooses *only urgent*, *complaints + urgent* (default) or *everything*, and can be limited to some departments. Urgent alarms always come through.
- A notification shows the department, place, topic and the guest's text. The guest's email or phone number is never sent.
- The message is encrypted end to end; Apple/Google only carry it.
- Logging out turns notifications off on that device. Removing a colleague under Användare removes their devices.
- **Skicka testlarm** on the Larm page also sends a notification to every device of the company, and **Skicka testnotis** sends one only to your own devices.
- The app opens without internet but needs internet for new data. A screen then says there is no connection.
