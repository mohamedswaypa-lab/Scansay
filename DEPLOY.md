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

## 12. Guests can answer with Reply in their mail program (optional, recommended)
Today every email to a guest has a **Svara** button (works without setup). To also let guests just press *Reply*:
1. In your DNS add an MX record for a subdomain, e.g. **reply.scansay.se**, pointing to Brevo's inbound servers (Brevo → *Inbound parsing* shows the exact values).
2. In Brevo → Inbound parsing → add a webhook for `reply.scansay.se` to `https://scansay.se/api/form?a=inbound&k=YOUR-SECRET`.
3. In Vercel add `REPLY_DOMAIN` = `reply.scansay.se` and `INBOUND_SECRET` = the same secret (a long random string). Redeploy.
Then the Reply-To of guest emails becomes a private address per case; the answer is added to the case (only if it comes from the guest's own address), the case opens again and the staff member who replied last gets an email.

## 13. Closing a case
- *Markera som löst* is always manual (also after an AI suggestion).
- When a case is closed (with or without a written reply) the guest gets one message: "your case is solved / thank you", a **Svara** button and – if the company has added its Google/Tripadvisor link under Intyg – the review invitation. Every guest with a closed case gets the same, whatever the rating. Re-opening and closing again does not send it twice.
- Inbox filter **Gästen svarade** shows cases where the guest's answer is the latest.

## 14. Update 5: roles, case flow, tasks, team chat (November 2026)
**Run `supabase/update-5.sql` once** in Supabase → SQL Editor (safe to run again). Then run `supabase/retention.sql` again so old chat messages are deleted after 12 months.

Who does what:
- **Ägare of a koncern**: adds only hotels and their **Chef** (as many as the package allows: `max_children`). Sees statistics for every hotel, the **Intyg** for every hotel (print all, one per page), and chats with the managers in the **Koncernen** channel. No inbox.
- **Chef (Ägare/Gruppadmin of a hotel)**: adds Handläggare, Medarbetare and Läsare within the package quota (`roles` on the account). Gets statistics and the team card (answers, solved cases, tasks, praise). As soon as the hotel has a Handläggare, the Chef no longer gets the inbox or the guests' contact details.
- **Handläggare**: works the inbox, answers guests, sends tasks to Medarbetare ("📋 Skicka uppdrag") and closes cases. May add and remove Medarbetare only.
- **Medarbetare** (cleaning, maintenance, parking, security): gets a push/email and sees only *Mina uppdrag*. Presses **Klart** when done; the Handläggare gets an email and sees "klart HH:MM" on the case.
- **Läsare**: statistics only.
Everyone can only add or remove people below their own role. When someone is removed, their open tasks go back to the inbox, their private chats are deleted and their name is removed from old chat messages (GDPR).

Case flow:
- Answering the guest (or sending a task) moves the case to **Pågående**. A case can never be solved in the same click as the answer.
- **Markera som löst** is possible only from Pågående and at the earliest **30 minutes** later, so there is time to fix and double-check. The same 30 minutes apply to a Medarbetare's **Klart**. Change it with the env var `CASE_MIN_MINUTES` (e.g. `15`).
- When solved, the guest gets the close notice with Svara and (if set up) the review invitation – the same for every guest.

Guest form: the main question and four 1–5 ratings now depend on the industry (hotel: Renlighet, Bekvämlighet, Personal, Frukost; café: Mat och dryck, Service, Väntetid, Atmosfär; taxi: Föraren, Bilen, Punktlighet, Pris; gym: Utrustning, Renlighet, Personal, Trängsel …). The ratings show on the case in the inbox. The code page tells the guest to check the spam folder.

**Codes landing in spam**: the notice helps, but the real fix is to authenticate your domain in Brevo: Brevo → Senders, Domains & Dedicated IPs → Domains → Add `scansay.se` → add the DKIM, SPF (TXT `v=spf1 include:spf.brevo.com ~all`) and DMARC (TXT on `_dmarc`: `v=DMARC1; p=none; rua=mailto:hello@scansay.se`) records at your DNS provider → Verify. Use `MAIL_FROM` with that same domain (e.g. `ScanSay <kod@scansay.se>`). It usually takes 1–2 days before Gmail/Outlook trust it.

## 15. New look, logo, video, stickers, contract reminders (5 November 2026)
No database changes this time. Just upload the files.

- **Logo (inspired by Asia Gardens):** an ornate emblem – a lotus-shaped frame with fine borders, small petals and your QR corner squares inside – above or beside **SCANSAY** in a classic serif (Libre Baskerville), with a thin line and "SKANNA & SÄG DET" / "SCAN & SAY IT" in the stacked version. Files in `brand/` keep their old names, so every page, the emails and the app icons pick it up. In the middle of every sticker QR code the emblem sits on a blue square; stickers end with "Drivs av / Powered by ScanSay". Headings use the same serif (self-hosted `fonts/baskerville.woff`, OFL).
- **Colours:** electric blue `#1D4ED8`, navy `#0A1F44`, white and red `#E4002B` (replaces lime) on the website, dashboards, admin, guest form and emails. Site styles: `theme-pepsi.css` (loaded last).
- **Video:** `video/story.mp4` (Swedish) and `video/story-en.mp4` (English), 16 seconds in 1080p: scan → message → task to staff → happy guest. The `-720` files are used on phones. The old background videos are no longer used. **Delete these old files from GitHub:** `video/bg*, city*, code*, cta-flow*, flow*, hero-map*, mesh*, net*, qr.*, qrwave*, shapes*`.
- **Home page:** a hero slider with 4 slides (video, dashboard, stickers, team), "Systemet steg för steg", "QR-koden i verkligheten" (hotel, taxi, café, gym) and a dashboard section with tabs. The Guide page also has the video and the steps.
- **Stickers:** 14 colours plus your own colour (new: pink, sun yellow, sky blue, purple, navy; lime is now red) and 5 writing styles (Modern, Kraftig, Vänlig, Elegant, Versaler). These are chosen under QR-koder → step 3.
- **FAQ:** new category "Team, roller och dekaler".
- **Contract:** version 2026-11-05 with Bilaga 3 (roles, tasks, team chat). The DPA and privacy policy now cover tasks and chat.
- **Admin:**
  - An application with an open offer has the button **🔔 Påminn om signering**. It sends the same offer again by email and SMS, with a new 30-day link, and logs the reminder.
  - A customer without a signature has **✍ Skicka avtal att signera** and then **🔔 Påminn om avtalet**.
  - When the customer signs, the customer card shows "signerat" automatically.

## 16. Logo, look and video (6 November 2026)
No database changes. Upload the files.

- **Logo:** your blue QR speech-bubble icon sitting above the "n" and "S" of **ScanSay** ("Scan" black, "Say" blue). Files in `brand/` keep their old names, so every page, the emails and the app icons pick it up: `scansay-logo.svg` (white backgrounds), `scansay-logo-white.svg` (dark/photo backgrounds), `scansay-logo-light/dark(-en).svg` (with "Skanna · Säg det"), `scansay-icon.svg`, `email-logo.png`, `app/icons/*`. The same icon sits in the middle of every sticker QR code.
- **Colours and type:** white, blue `#1D4ED8`, black text `#0A0F1C`; bold Plus Jakarta Sans headings. Website styles `theme-luxe.css`; dashboard styles `dash-navy.css` (manager dashboard, admin, admin tools). Staff app and guest form have a white top bar with the logo.
- **Home page video:** four sharp 1080p films we render ourselves (`video/hero-restaurant|gym|taxi|bus.mp4`, plus `_en`): the real ScanSay sticker for each place (your QR code with the emblem in the middle, "Drivs av ScanSay") turns in 3D, a phone scans it, the feedback form opens and "Tack!" appears. Posters `img/scenes/hero-*.jpg`; the photo carousel uses frames from the same films (`img/scenes/card-*.jpg`). The source is `_render/scene.html` (not needed on the server).
- **QR code options:** the sticker editor in the dashboard (QR-koder) now has "QR-kodens stil" (Fyrkant / Rundad / Prickar) and "QR-kodens färg" (Svart / Marinblå / Blå). Rundad is the default. All styles keep the logo in the middle and scan normally.
- **Call-to-action band** ("Redo att höra era gäster?"): deep navy with a soft blue glow and the emblem as a watermark, white button and outlined button.
- **Update 6 Nov (evening):** the logo emblem now has a real QR pattern inside the lotus frame. New sticker names in the films (Café Linnea, Atlas Gym, Taxi Nova, Linje 4). Films also play in the "Platserna" carousel and as the "Så fungerar det" film (`video/story*.mp4`). All old pictures with the previous logo were replaced: `img/v5_step1-4(_en).jpg`, `img/f_*.jpg` (fresh dashboard screenshots), `img/tool_form(_en).jpg`, `img/about_scene(_en).png`, and the two "För personalen / För ledningen" pictures (`img/scenes/split-*.jpg`). Footer, AI-insikter and other dark sections now have readable light text; the old red accents are blue. Dashboards: premium look – gradient KPI cards, dark-blue AI insight panel, softer cards; admin tools have the new logo.


### 16b. Realistiska hållare (nov 2026)
Varje dekal visas nu i en verklig hållare: Café = akrylställ på träfot, Gym = borstad aluminiumplatta med skruvar, Taxi = nackstödsram i grafit, Buss = akrylpanel på kromdistanser. Alla filmer (video/hero-*, video/story*), affischer, kort, steg-bilder och dekalbandet (img/scenes/stk_*.png) är omrenderade med samma riktiga QR-koder och logga.
