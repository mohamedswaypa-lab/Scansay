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

## 9. Review invitations (Google / Tripadvisor)
- The hotel pastes its Google review link (Google Business Profile → *Ask for reviews*) and optionally Tripadvisor under **Intyg → Recensioner på Google och Tripadvisor**.
- When staff reply and tick **Markera som löst**, the reply also carries one invitation to leave a public review. It goes to **every** guest whose case is closed — complaints and praise, any rating — once per guest. There is no rating filter on purpose: Google forbids asking only happy guests.
- A new complaint has the box unticked by default (first reply = "we're on it"); the follow-up reply, when it is fixed, has it ticked.
- Clicks go through `scansay.se/api/form?a=r…`, so the dashboard shows invitations sent and how many clicked through.
- Needs the two `review_…` columns from `supabase/update-3.sql`.

## 10. Parent and daughter companies, roles, guest replies
Run `supabase/update-4.sql` once (after update-3).

**Parent company (koncern)**
- In admin → open the customer → **Koncern** → choose *Moderbolag* and set **Max antal dotterbolag**. Save.
- The parent's users now get a *Koncernöversikt* instead of an inbox: numbers per daughter (messages, satisfied guests, resolved complaints, time to fix, urgent alarms, review invitations) and a comparison table. They never see the guests' messages or contact details.
- Under **Dotterbolag** they create daughters themselves (name, city, manager's email) until the limit is reached. The manager gets the normal welcome email with *Välj lösenord*. Each daughter gets the same package, modules and number of logins as the parent.
- You can also link an existing customer to a parent in admin: **Koncern → Tillhör moderbolag**.
- Someone who is a user in several companies gets a company switcher at the top.

**Roles inside each company** (set when inviting under *Användare*, and changeable later)
| Role | Sees | Can |
|---|---|---|
| Ägare / Chef (Gruppadmin) | everything | settings, QR codes, alarms, users, replies |
| Handläggare (agent) | Inkorg, Notiser | reply to guests, forward cases, mark solved |
| Medarbetare (worker) | only cases from their own departments (urgent alarms always) | "Jag tar det", "Markera som åtgärdat", notifications – no replies to guests |
| Läsare | Översikt (statistics, no message text) | – |
All limits are checked on the server, not only hidden in the page.

**Forward a case:** *Skicka vidare* in the inbox sends the case to a colleague by email and phone notification and logs it in the case.

**Guest replies:** every reply to a guest now has a **Svara** button (and a link in SMS). The guest answers on scansay.se/svar, the answer appears in the same case, the case opens again, and the person who replied gets an email plus a phone notification. Links work for 30 days.

**If emails don't arrive:**
1. Brevo → *Transactional → Logs*: look up the address. "Delivered" means it reached the mailbox (check spam); "Blocked/Hard bounce" shows why.
2. Brevo → *Senders, Domains & Dedicated IPs → Domains*: authenticate **scansay.se** (add the DKIM, SPF and DMARC records Brevo shows in your DNS). Without this Gmail and Outlook often put the mail in spam or reject it.
3. `MAIL_FROM` must be an address on that authenticated domain, e.g. `ScanSay <hello@scansay.se>`.
4. Make sure **hello@scansay.se** really receives mail (email forwarding at your domain provider to your Gmail, or Google Workspace). Otherwise replies to system emails disappear.

## 11. Packages with roles, offer alternatives, messages, case numbers
Run the new part of `supabase/update-4.sql` again (safe to repeat) and re-run `supabase/retention.sql`.

**Offer → package with roles.** In admin → Ansökningar → open the company:
- **5. Inloggningar per roll:** number of Chefer, Handläggare, Medarbetare and Läsare (the owner is always one extra).
- **Koncern:** *Enskilt företag* or *Moderbolag med dotterbolag* + how many daughters are included. Each daughter gets the same roles.
- **Paketalternativ:** set up a package and press *Lägg till paketet ovan som alternativ*; change it and add the next one. With alternatives in the list the customer chooses one on the signing page, and the signed choice is what *Godkänn och skapa konto* uses.
- You can change the role numbers later under Kunder → the company → *Inloggningar per roll*.
- The company cannot invite more people per role than the package allows (checked on the server). The parent company can give one person roles in several daughters (and in the parent); that person switches company at the top after login.

**Messages from admin now reach the company.** Admin → Meddelanden (new message, reply or *Utskick till flera*) is saved for the company and emailed to its owner and managers. They read and answer under **Meddelanden** in their dashboard; you get the answer in admin and by email to NOTIFY_EMAIL.

**Guest answers** email only the staff member who wrote the last reply (no push to everyone).

**Case numbers.** Every case shows its number (the one the guest got, e.g. `C7PQK-0FFA8`) and the inbox has a search box. A guest can go to **scansay.se/svar**, type the case number and the same email/phone, and gets a fresh link to the conversation. Staff can mark a case solved without replying and open it again (*↺ Öppna igen*).

**How long is it kept?** Guest messages: the period the company chose under GDPR (6, 12, 18 or 24 months, default 12), then deleted every night by `retention.sql`. Before deletion the numbers (count, ratings, solved) are kept in `stats_monthly` without text or contact details. Messages between you and the company: 24 months. Signed contracts (`signatures`): kept, since they are accounting and contract records.
